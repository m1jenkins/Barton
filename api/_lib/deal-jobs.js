import { database } from './db.js';
import { intakeEmailSettings, smtpTransport } from './intake-email.js';
import { composeShortlistEmail, dealLinkSettings } from './deal-email.js';

// deal_jobs is an outbox like intake_email_outbox: the shortlist email to Mason
// is queued in the same transaction as the shortlist, sent right after commit,
// and retried by the daily cron. It stays queued until SMTP and link signing
// are both configured.
const MAX_ATTEMPTS = 8;
const RETRY_SECONDS = 60;
const LEASE_SECONDS = 180;
const BATCH_SIZE = 10;

export function dealJobSettings(environment = process.env) {
  const smtp = intakeEmailSettings(environment);
  const links = dealLinkSettings(environment);
  return smtp && links ? { smtp, links } : null;
}

async function claimDealJobs(sql, dealId) {
  return sql.begin(async tx => tx`
    WITH eligible AS (
      SELECT job.deal_id, job.kind
      FROM deal_jobs AS job
      WHERE (${dealId}::uuid IS NULL OR job.deal_id = ${dealId})
        AND job.attempts < ${MAX_ATTEMPTS}
        AND (
          job.status = 'pending'
          OR (job.status = 'failed' AND (
            job.last_attempt_at IS NULL
            OR job.last_attempt_at <= now() - LEAST(21600, ${RETRY_SECONDS} * power(2, LEAST(10, GREATEST(0, job.attempts - 1)))) * interval '1 second'
          ))
          OR (job.status = 'processing' AND (
            job.last_attempt_at IS NULL
            OR job.last_attempt_at <= now() - ${LEASE_SECONDS} * interval '1 second'
          ))
        )
      ORDER BY job.created_at, job.deal_id, job.kind
      FOR UPDATE OF job SKIP LOCKED
      LIMIT ${BATCH_SIZE}
    )
    UPDATE deal_jobs AS job
    SET status = 'processing', attempts = job.attempts + 1, last_attempt_at = now(), last_error = NULL
    FROM eligible
    WHERE job.deal_id = eligible.deal_id AND job.kind = eligible.kind
    RETURNING job.deal_id, job.kind, job.attempts
  `);
}

export async function dispatchDealJobs({ sql, environment = process.env, dealId = null, createTransport = smtpTransport } = {}) {
  const settings = dealJobSettings(environment);
  if (!settings) return { configured: false, claimed: 0, sent: 0, failed: 0 };
  const client = sql || database();
  const jobs = await claimDealJobs(client, dealId);
  if (jobs.length === 0) return { configured: true, claimed: 0, sent: 0, failed: 0 };
  const transport = createTransport(settings.smtp);
  let sent = 0;
  try {
    // One SMTP connection, one message at a time: Zoho throttles parallel sends.
    for (const job of jobs) {
      try {
        const { subject, text, html } = await composeShortlistEmail(client, job.deal_id, settings.links);
        await transport.sendMail({
          from: { name: 'Steer Me Right car search', address: settings.smtp.user },
          to: settings.smtp.to, subject, text, html,
          headers: { 'X-Steer-Deal-Id': job.deal_id }
        });
        const updated = await client`
          UPDATE deal_jobs SET status = 'done', done_at = now(), last_error = NULL
          WHERE deal_id = ${job.deal_id} AND kind = ${job.kind} AND status = 'processing' AND attempts = ${job.attempts}
          RETURNING deal_id
        `;
        if (updated.length === 1) sent += 1;
      } catch (error) {
        // SMTP errors can quote the message or credentials; keep only the error code.
        const code = /^[A-Z0-9_]{2,40}$/.test(error?.code || '') ? error.code : 'UNKNOWN';
        await client`
          UPDATE deal_jobs SET status = 'failed', last_error = ${`Shortlist email failed (${code})`}
          WHERE deal_id = ${job.deal_id} AND kind = ${job.kind} AND status = 'processing' AND attempts = ${job.attempts}
        `;
        console.error('[deal_job_failed]', { deal_id: job.deal_id, kind: job.kind, attempt: job.attempts, code });
      }
    }
  } finally {
    transport.close?.();
  }
  return { configured: true, claimed: jobs.length, sent, failed: jobs.length - sent };
}

export async function dispatchDealJobsSafely(options) {
  try { return await dispatchDealJobs(options); } catch {
    console.error('[deal_job_dispatch_failed]');
    return { configured: true, claimed: 0, sent: 0, failed: 0, dispatcher_error: true };
  }
}

export async function runDealWorker({ sql, environment = process.env, createTransport } = {}) {
  if (!dealJobSettings(environment)) return { configured: false, exhausted: null, exitCode: 1 };
  const client = sql || database();
  try {
    const result = await dispatchDealJobs({ sql: client, environment, createTransport });
    const [row] = await client`
      SELECT count(*)::integer AS exhausted FROM deal_jobs
      WHERE status <> 'done' AND attempts >= ${MAX_ATTEMPTS}
        AND (status <> 'processing' OR last_attempt_at IS NULL
             OR last_attempt_at <= now() - ${LEASE_SECONDS} * interval '1 second')
    `;
    const exhausted = Number(row.exhausted);
    return { ...result, exhausted, exitCode: result.failed || exhausted ? 1 : 0 };
  } finally {
    if (!sql) await client.end({ timeout: 5 });
  }
}
