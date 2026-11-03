import { database } from './db.js';
import { integerEnv } from './config.js';
import { analyticsDestination, dispatchAnalyticsOutbox } from './analytics-outbox.js';
import { dispatchLeadForwardOutbox, leadDestination, leadDeliverySettings } from './lead-forward-outbox.js';
import { dispatchIntakeEmails, intakeEmailSettings } from './intake-email.js';

export async function runLeadWorker({ sql, environment = process.env } = {}) {
  if (!leadDestination(environment)) return { configured: false, exhausted: null, exitCode: 1 };
  const { maxAttempts, leaseSeconds } = leadDeliverySettings(environment);
  const client = sql || database();
  try {
    const result = await dispatchLeadForwardOutbox({ sql: client, environment });
    const [row] = await client`
      SELECT count(*)::integer AS exhausted FROM lead_forward_outbox
      WHERE status <> 'sent' AND attempts >= ${maxAttempts}
        AND (status <> 'processing' OR last_attempt_at IS NULL
             OR last_attempt_at <= now() - ${leaseSeconds} * interval '1 second')
    `;
    const exhausted = Number(row.exhausted);
    return { ...result, exhausted, exitCode: result.failed || exhausted ? 1 : 0 };
  } finally {
    if (!sql) await client.end({ timeout: 5 });
  }
}

export async function runAnalyticsWorker({ sql, environment = process.env } = {}) {
  if (!analyticsDestination(environment)) return { configured: false, exhausted: null, exitCode: 1 };
  const client = sql || database();
  const maxAttempts = integerEnv('ANALYTICS_OUTBOX_MAX_ATTEMPTS', 8, { min: 1, max: 25 }, environment);
  try {
    const result = await dispatchAnalyticsOutbox({ sql: client, environment });
    const [row] = await client`
      SELECT count(*)::integer AS exhausted FROM analytics_outbox
      WHERE status <> 'sent' AND attempts >= ${maxAttempts} AND available_at <= now()
    `;
    const exhausted = Number(row.exhausted);
    return { ...result, exhausted, exitCode: result.failed || exhausted ? 1 : 0 };
  } finally {
    if (!sql) await client.end({ timeout: 5 });
  }
}

export async function runIntakeEmailWorker({ sql, environment = process.env, createTransport } = {}) {
  const settings = intakeEmailSettings(environment);
  if (!settings) return { configured: false, exhausted: null, exitCode: 1 };
  const client = sql || database();
  try {
    const result = await dispatchIntakeEmails({ sql: client, environment, createTransport });
    const [row] = await client`
      SELECT count(*)::integer AS exhausted FROM intake_email_outbox
      WHERE status <> 'sent' AND attempts >= ${settings.maxAttempts}
        AND (status <> 'processing' OR last_attempt_at IS NULL
             OR last_attempt_at <= now() - ${settings.leaseSeconds} * interval '1 second')
    `;
    const exhausted = Number(row.exhausted);
    return { ...result, exhausted, exitCode: result.failed || exhausted ? 1 : 0 };
  } finally {
    if (!sql) await client.end({ timeout: 5 });
  }
}
