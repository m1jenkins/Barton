import { ConfigError } from './config.js';
import { dealTrackerSettings, linkUrl, replyAddress } from './deal-tracker.js';
import { button, card, note, paragraph, renderEmail } from './email-layout.js';
import { intakeEmailSettings, oneLine, smtpTransport } from './intake-email.js';
import { buyerFromRow } from './customer-emails/index.js';

// The one email a Buyer Update sends the buyer (GLOSSARY.md; plan, "Decisions":
// Buyer Updates, Buyer emails): a short preview and their Deal Tracker link.
// Sent by the 10-minute run (.github/workflows/ops-alerts.yml, ?jobs=buyer_updates)
// once an update's take-back window (email_after) has passed. buyer_updates is its
// own queue: emailed_at marks it sent, email_attempts and email_error the failures.

const EMAIL_PATTERN = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;
const DEFAULT_REPLY_TO = 'mason@steermeright.com';
const FROM_NAME = 'Mason at Steer Me Right';
const MAX_ATTEMPTS = 8;
const BATCH = 20;
const PREVIEW_LENGTH = 280;

// Null unless the Deal Tracker is on and the intake's SMTP login is set.
export function buyerUpdateEmailSettings(environment = process.env) {
  const tracker = dealTrackerSettings(environment);
  if (!tracker) return null;
  const smtp = intakeEmailSettings(environment);
  if (!smtp) return null;
  // The same fallback reply-to the lifecycle emails use (customer-email.js).
  const replyTo = environment.CUSTOMER_EMAIL_REPLY_TO?.trim() || DEFAULT_REPLY_TO;
  if (!EMAIL_PATTERN.test(replyTo)) throw new ConfigError('CUSTOMER_EMAIL_REPLY_TO must be an email address');
  return { ...smtp, replyTo, tracker };
}

// The start of the update on one line, cut at a word.
export function previewText(body, max = PREVIEW_LENGTH) {
  const text = oneLine(body);
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const space = cut.lastIndexOf(' ');
  return `${(space > max / 2 ? cut.slice(0, space) : cut).replace(/[\s,;:.–—-]+$/, '')}…`;
}

export function renderBuyerUpdateEmail({ firstName, body, link }) {
  const preview = previewText(body);
  return renderEmail({
    subject: 'An update on your car search',
    preheader: previewText(body, 110),
    kicker: 'Deal Tracker',
    heading: 'An update from Mason',
    intro: [`${firstName ? `Hi ${firstName}, I` : 'I'}’ve posted a new update about your car search.`],
    cards: [card('The update', [
      paragraph(preview),
      button(link, 'Read it on your Deal Tracker'),
      note(['Or open this link: ', link]),
      paragraph('Have a question about it? Reply to this email and I’ll answer within one business day.')
    ])],
    signoff: 'Talk soon,'
  });
}

// SMTP errors can quote the message or the address; keep only the error code.
const errorCode = error => (/^[A-Z0-9_]{2,40}$/.test(error?.code || '') ? error.code : 'UNKNOWN');

// One update, in its own transaction. The row is re-read FOR UPDATE SKIP LOCKED
// with every condition checked again, so a take-back or revoke that lands just
// before wins, and two runs can't both send it.
async function deliver(sql, id, transport, settings) {
  return sql.begin(async tx => {
    const [row] = await tx`SELECT u.id, u.onboarding_id, u.body, u.email_attempts, l.version, o.name, o.email
      FROM buyer_updates u
      JOIN deal_tracker_links l ON l.onboarding_id = u.onboarding_id AND l.revoked_at IS NULL
      JOIN onboarding_submissions o ON o.id = u.onboarding_id
      WHERE u.id = ${id} AND u.status = 'posted' AND u.emailed_at IS NULL AND u.email_after <= now() AND u.email_attempts < ${MAX_ATTEMPTS}
      FOR UPDATE OF u SKIP LOCKED`;
    if (!row) return 'skipped';
    try {
      const { firstName } = buyerFromRow({ name: row.name });
      const email = renderBuyerUpdateEmail({ firstName, body: row.body, link: linkUrl(settings.tracker, row.onboarding_id, row.version) });
      await transport.sendMail({
        from: { name: FROM_NAME, address: settings.user },
        to: { name: oneLine(row.name), address: row.email },
        replyTo: replyAddress(settings.tracker, row.onboarding_id) ?? settings.replyTo,
        subject: email.subject, text: email.text, html: email.html,
        headers: { 'X-Steer-Customer-Email': 'buyer_update' }
      });
    } catch (error) {
      const code = errorCode(error);
      await tx`UPDATE buyer_updates SET email_attempts = email_attempts + 1, email_error = ${`Update email failed (${code})`} WHERE id = ${row.id}`;
      console.error('[buyer_update_email_failed]', { id: Number(row.id), attempt: Number(row.email_attempts) + 1, code });
      return 'failed';
    }
    await tx`UPDATE buyer_updates SET emailed_at = now(), email_error = NULL WHERE id = ${row.id}`;
    return 'sent';
  });
}

export async function dispatchBuyerUpdateEmails({ sql, environment = process.env, createTransport = smtpTransport } = {}) {
  const settings = buyerUpdateEmailSettings(environment);
  if (!settings) return { configured: false, claimed: 0, sent: 0, failed: 0 };
  // A deal with no link, or a revoked one, gets no email; its row stays unsent.
  const due = await sql`SELECT u.id FROM buyer_updates u
    JOIN deal_tracker_links l ON l.onboarding_id = u.onboarding_id AND l.revoked_at IS NULL
    WHERE u.status = 'posted' AND u.emailed_at IS NULL AND u.email_after <= now() AND u.email_attempts < ${MAX_ATTEMPTS}
    ORDER BY u.email_after, u.id LIMIT ${BATCH}`;
  const counts = { configured: true, claimed: due.length, sent: 0, failed: 0 };
  if (!due.length) return counts;
  const transport = createTransport(settings);
  try {
    // One SMTP connection, one message at a time: Gmail throttles parallel sends.
    for (const { id } of due) {
      const result = await deliver(sql, id, transport, settings);
      if (result !== 'skipped') counts[result] += 1;
    }
    return counts;
  } finally {
    transport.close?.();
  }
}

// The worker shape api/outbox-dispatch.js expects. Exhausted: posted updates
// from the last week that ran out of attempts and never reached the buyer.
export async function runBuyerUpdateWorker({ sql, environment = process.env, createTransport } = {}) {
  const result = await dispatchBuyerUpdateEmails({ sql, environment, createTransport });
  if (!result.configured) return { ...result, exhausted: null, exitCode: 1 };
  const [row] = await sql`SELECT count(*)::integer AS exhausted FROM buyer_updates
    WHERE status = 'posted' AND emailed_at IS NULL AND email_attempts >= ${MAX_ATTEMPTS} AND posted_at > now() - interval '7 days'`;
  const exhausted = Number(row.exhausted);
  return { ...result, exhausted, exitCode: result.failed || exhausted ? 1 : 0 };
}
