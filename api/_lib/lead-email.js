import { ConfigError } from './config.js';
import { database } from './db.js';
import { intakeEmailSettings, smtpTransport } from './intake-email.js';

// Each new lead sends a short notice to LEAD_NOTIFY_EMAIL (Grokbot's Client
// Outreach inbox) from the same Zoho mailbox as intake emails, so it passes
// SPF/DKIM. The notice only carries the lead ID: the receiver reads the lead
// itself from Neon, and contact details stay out of the email.
const EMAIL_PATTERN = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;

// Request path only: decides whether to queue, and never throws.
export const leadEmailQueued = (environment = process.env) => Boolean(environment.LEAD_NOTIFY_EMAIL?.trim());

export function leadEmailSettings(environment = process.env) {
  const to = environment.LEAD_NOTIFY_EMAIL?.trim();
  if (!to) return null;
  if (!EMAIL_PATTERN.test(to)) throw new ConfigError('LEAD_NOTIFY_EMAIL must be an email address');
  const smtp = intakeEmailSettings(environment);
  if (!smtp) throw new ConfigError('LEAD_NOTIFY_EMAIL needs INTAKE_SMTP_USER and INTAKE_SMTP_PASSWORD');
  return { ...smtp, to };
}

export function renderLeadEmail(row) {
  const saved = new Date(row.created_at).toISOString();
  const subject = `New lead ${row.lead_id}`;
  const text = [
    subject,
    `Source: ${row.source} (${row.source_page})`,
    `Saved: ${saved}`,
    '',
    'Read this lead from public.leads by its id.'
  ].join('\n');
  return { subject, text };
}

async function claimLeadEmails(sql, leadId, { batchSize, maxAttempts, leaseSeconds, retrySeconds }) {
  return sql.begin(async tx => tx`
    WITH eligible AS (
      SELECT outbox.lead_id
      FROM lead_email_outbox AS outbox
      WHERE (${leadId}::uuid IS NULL OR outbox.lead_id = ${leadId})
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
      ORDER BY outbox.created_at, outbox.lead_id
      FOR UPDATE OF outbox SKIP LOCKED
      LIMIT ${batchSize}
    )
    UPDATE lead_email_outbox AS outbox
    SET status = 'processing', attempts = outbox.attempts + 1,
        last_attempt_at = now(), last_error = NULL
    FROM eligible JOIN leads AS lead ON lead.id = eligible.lead_id
    WHERE outbox.lead_id = eligible.lead_id
    RETURNING outbox.lead_id, outbox.attempts, lead.source, lead.source_page, lead.created_at
  `);
}

async function deliverLeadEmail(sql, row, transport, settings) {
  try {
    const { subject, text } = renderLeadEmail(row);
    await transport.sendMail({
      from: { name: 'Steer Me Right website', address: settings.user },
      to: settings.to,
      subject, text,
      headers: { 'X-Steer-Lead-Id': row.lead_id }
    });
    const updated = await sql`
      UPDATE lead_email_outbox
      SET status = 'sent', sent_at = now(), last_error = NULL
      WHERE lead_id = ${row.lead_id} AND status = 'processing' AND attempts = ${row.attempts}
      RETURNING lead_id
    `;
    return updated.length === 1;
  } catch (error) {
    // SMTP errors can quote the message or credentials; keep only the error code.
    const code = /^[A-Z0-9_]{2,40}$/.test(error?.code || '') ? error.code : 'UNKNOWN';
    await sql`
      UPDATE lead_email_outbox
      SET status = 'failed', last_error = ${`Lead email failed (${code})`}
      WHERE lead_id = ${row.lead_id} AND status = 'processing' AND attempts = ${row.attempts}
    `;
    console.error('[lead_email_failed]', { lead_id: row.lead_id, attempt: row.attempts, code });
    return false;
  }
}

export async function dispatchLeadEmails({ sql, environment = process.env, leadId = null, createTransport = smtpTransport } = {}) {
  const settings = leadEmailSettings(environment);
  if (!settings) return { configured: false, claimed: 0, sent: 0, failed: 0 };
  const client = sql || database();
  const rows = await claimLeadEmails(client, leadId, settings);
  if (rows.length === 0) return { configured: true, claimed: 0, sent: 0, failed: 0 };
  const transport = createTransport(settings);
  try {
    let sent = 0;
    // One SMTP connection, one message at a time: Zoho throttles parallel sends.
    for (const row of rows) if (await deliverLeadEmail(client, row, transport, settings)) sent += 1;
    return { configured: true, claimed: rows.length, sent, failed: rows.length - sent };
  } finally {
    transport.close?.();
  }
}

export async function dispatchLeadEmailsSafely(options) {
  try { return await dispatchLeadEmails(options); } catch {
    console.error('[lead_email_dispatch_failed]');
    return { configured: true, claimed: 0, sent: 0, failed: 0, dispatcher_error: true };
  }
}
