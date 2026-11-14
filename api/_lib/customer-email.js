import { ConfigError } from './config.js';
import { database } from './db.js';
import { intakeEmailSettings, oneLine, smtpTransport } from './intake-email.js';
import { safeUrl } from './email-layout.js';
import { EMAIL_TIERS, TEMPLATE_NAMES, buyerFromRow, renderCustomerEmail } from './customer-emails/index.js';

// Automated emails to the buyer, sent through the same Zoho mailbox as the
// intake email (INTAKE_SMTP_*). Off until CUSTOMER_EMAIL_ENABLED=1.
//   welcome         queued with the intake, sent right after it commits
//   what_to_expect  queued with the intake, held 12 hours (the next morning's cron)
//   deal_done       queued by the cron once the deal's latest close/reopen event is 'closed'
//   review_ask      queued with deal_done, held 4 days; needs GOOGLE_REVIEW_URL
// The queue is customer_email_outbox (db/011). See "Customer email" in
// docs/implementation-operations.md.

const EMAIL_PATTERN = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;
const DEFAULT_REPLY_TO = 'mason@steermeright.com';
const FROM_NAME = 'Mason at Steer Me Right';

export const customerEmailEnabled = (environment = process.env) =>
  ['1', 'true', 'yes'].includes(String(environment.CUSTOMER_EMAIL_ENABLED || '').trim().toLowerCase());

export function customerEmailSettings(environment = process.env) {
  if (!customerEmailEnabled(environment)) return null;
  const smtp = intakeEmailSettings(environment);
  if (!smtp) return null;
  const replyTo = environment.CUSTOMER_EMAIL_REPLY_TO?.trim() || DEFAULT_REPLY_TO;
  if (!EMAIL_PATTERN.test(replyTo)) throw new ConfigError('CUSTOMER_EMAIL_REPLY_TO must be an email address');
  const rawReviewUrl = environment.GOOGLE_REVIEW_URL?.trim() || '';
  const reviewUrl = rawReviewUrl ? safeUrl(rawReviewUrl) : '';
  if (rawReviewUrl && !reviewUrl) throw new ConfigError('GOOGLE_REVIEW_URL must be an https URL');
  return { ...smtp, replyTo, reviewUrl };
}

// Runs inside the onboarding transaction, so the emails are queued exactly when
// the intake is saved. Queues nothing while the feature is off, so turning it on
// later doesn't send stale welcomes.
export async function enqueueIntakeEmails(tx, { onboardingId, tierId, environment = process.env }) {
  if (!customerEmailEnabled(environment) || !EMAIL_TIERS.includes(tierId)) return 0;
  const inserted = await tx`
    INSERT INTO customer_email_outbox (onboarding_id, template, send_after)
    VALUES (${onboardingId}, 'welcome', now()),
           (${onboardingId}, 'what_to_expect', now() + interval '12 hours')
    ON CONFLICT (onboarding_id, template) DO NOTHING
    RETURNING id
  `;
  return inserted.length;
}

// Queues deal_done (and review_ask) for buyers whose deal closed in the last two
// weeks, and cancels both if the deal was reopened before they went out. Only
// buyers with a welcome row that wasn't cancelled qualify, so buyers from before
// launch and buyers Mason paused get nothing.
export async function scheduleClosedDeals(sql, { reviewUrl = '' } = {}) {
  const cancelled = await sql`
    WITH latest AS (
      SELECT DISTINCT ON (onboarding_id) onboarding_id, kind
      FROM deal_events WHERE kind IN ('closed', 'reopened')
      ORDER BY onboarding_id, occurred_at DESC, id DESC
    )
    UPDATE customer_email_outbox AS outbox
    SET status = 'cancelled', last_error = 'Deal reopened'
    FROM latest
    WHERE latest.onboarding_id = outbox.onboarding_id AND latest.kind = 'reopened'
      AND outbox.template IN ('deal_done', 'review_ask') AND outbox.status IN ('pending', 'failed')
    RETURNING outbox.id
  `;
  const queued = await sql`
    WITH latest AS (
      SELECT DISTINCT ON (onboarding_id) onboarding_id, kind, occurred_at
      FROM deal_events WHERE kind IN ('closed', 'reopened')
      ORDER BY onboarding_id, occurred_at DESC, id DESC
    ), closed AS (
      SELECT latest.onboarding_id, latest.occurred_at
      FROM latest
      JOIN customer_email_outbox AS welcome
        ON welcome.onboarding_id = latest.onboarding_id AND welcome.template = 'welcome' AND welcome.status <> 'cancelled'
      WHERE latest.kind = 'closed'
        AND latest.occurred_at >= welcome.created_at
        AND latest.occurred_at > now() - interval '14 days'
    )
    INSERT INTO customer_email_outbox (onboarding_id, template, send_after)
    SELECT onboarding_id, 'deal_done', now() FROM closed
    UNION ALL
    SELECT onboarding_id, 'review_ask', occurred_at + interval '4 days' FROM closed WHERE ${Boolean(reviewUrl)}::boolean
    ON CONFLICT (onboarding_id, template) DO NOTHING
    RETURNING id
  `;
  return { queued: queued.length, cancelled: cancelled.length };
}

async function claimEmails(sql, onboardingId, { batchSize, maxAttempts, leaseSeconds, retrySeconds }) {
  return sql.begin(async tx => tx`
    WITH eligible AS (
      SELECT outbox.id
      FROM customer_email_outbox AS outbox
      WHERE (${onboardingId}::uuid IS NULL OR outbox.onboarding_id = ${onboardingId})
        AND outbox.send_after <= now()
        AND outbox.attempts < ${maxAttempts}
        AND (
          outbox.status = 'pending'
          OR (outbox.status = 'failed' AND (
            outbox.last_attempt_at IS NULL
            OR outbox.last_attempt_at <= now() - LEAST(21600, ${retrySeconds} * power(2, LEAST(10, GREATEST(0, outbox.attempts - 1)))) * interval '1 second'
          ))
          OR (outbox.status = 'processing' AND (
            outbox.last_attempt_at IS NULL
            OR outbox.last_attempt_at <= now() - ${leaseSeconds} * interval '1 second'
          ))
        )
      ORDER BY outbox.send_after, outbox.id
      FOR UPDATE OF outbox SKIP LOCKED
      LIMIT ${batchSize}
    ), claimed AS (
      UPDATE customer_email_outbox AS outbox
      SET status = 'processing', attempts = outbox.attempts + 1,
          last_attempt_at = now(), last_error = NULL
      FROM eligible
      WHERE outbox.id = eligible.id
      RETURNING outbox.id, outbox.onboarding_id, outbox.template, outbox.attempts
    )
    SELECT claimed.id, claimed.onboarding_id, claimed.template, claimed.attempts,
           o.tier_id, o.name, o.email, o.city, o.fields
    FROM claimed
    JOIN onboarding_submissions AS o ON o.id = claimed.onboarding_id
    ORDER BY claimed.id
  `);
}

async function finish(sql, row, status, lastError = null) {
  const updated = await sql`
    UPDATE customer_email_outbox
    SET status = ${status}, last_error = ${lastError},
        sent_at = CASE WHEN ${status} = 'sent' THEN now() ELSE sent_at END
    WHERE id = ${row.id} AND status = 'processing' AND attempts = ${row.attempts}
    RETURNING id
  `;
  return updated.length === 1;
}

async function deliver(sql, row, transport, settings) {
  if (row.template === 'review_ask' && !settings.reviewUrl) {
    await finish(sql, row, 'cancelled', 'No GOOGLE_REVIEW_URL');
    return 'skipped';
  }
  try {
    const { subject, text, html } = renderCustomerEmail(row.template, buyerFromRow(row), { reviewUrl: settings.reviewUrl });
    await transport.sendMail({
      from: { name: FROM_NAME, address: settings.user },
      to: { name: oneLine(row.name), address: row.email },
      replyTo: settings.replyTo,
      subject, text, html,
      headers: { 'X-Steer-Customer-Email': row.template }
    });
    return await finish(sql, row, 'sent') ? 'sent' : 'failed';
  } catch (error) {
    // SMTP errors can quote the message or credentials; keep only the error code.
    const code = /^[A-Z0-9_]{2,40}$/.test(error?.code || '') ? error.code : 'UNKNOWN';
    await finish(sql, row, 'failed', `Customer email failed (${code})`);
    console.error('[customer_email_failed]', { id: row.id, template: row.template, attempt: row.attempts, code });
    return 'failed';
  }
}

export async function dispatchCustomerEmails({ sql, environment = process.env, onboardingId = null, createTransport = smtpTransport } = {}) {
  const settings = customerEmailSettings(environment);
  if (!settings) return { configured: false, claimed: 0, sent: 0, failed: 0, skipped: 0 };
  const client = sql || database();
  const rows = await claimEmails(client, onboardingId, settings);
  const result = { configured: true, claimed: rows.length, sent: 0, failed: 0, skipped: 0 };
  if (rows.length === 0) return result;
  const transport = createTransport(settings);
  try {
    // One SMTP connection, one message at a time: Zoho throttles parallel sends.
    for (const row of rows) result[await deliver(client, row, transport, settings)] += 1;
    return result;
  } finally {
    transport.close?.();
  }
}

export async function dispatchCustomerEmailsSafely(options) {
  try { return await dispatchCustomerEmails(options); } catch {
    console.error('[customer_email_dispatch_failed]');
    return { configured: true, claimed: 0, sent: 0, failed: 0, skipped: 0, dispatcher_error: true };
  }
}

// npm run customer-emails:cancel -- <onboarding_id>: stops every email not yet
// sent to that buyer. Templates not queued yet get a cancelled row, which the
// one-row-per-template rule then keeps from ever being queued.
export async function cancelCustomerEmails(sql, onboardingId) {
  return sql.begin(async tx => {
    const updated = await tx`
      UPDATE customer_email_outbox
      SET status = 'cancelled', last_error = 'Cancelled by Mason'
      WHERE onboarding_id = ${onboardingId} AND status IN ('pending', 'failed', 'processing')
      RETURNING template
    `;
    const inserted = await tx`
      INSERT INTO customer_email_outbox (onboarding_id, template, status, last_error)
      SELECT ${onboardingId}::uuid, template, 'cancelled', 'Cancelled by Mason'
      FROM unnest(${[...TEMPLATE_NAMES]}::text[]) AS template
      ON CONFLICT (onboarding_id, template) DO NOTHING
      RETURNING template
    `;
    return [...updated, ...inserted].map(row => row.template).sort();
  });
}
