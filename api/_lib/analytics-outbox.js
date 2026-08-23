import { ConfigError, integerEnv } from './config.js';
import { database } from './db.js';

const DEFAULT_BATCH_SIZE = 10;
const DEFAULT_LEASE_SECONDS = 60;
const DEFAULT_MAX_ATTEMPTS = 8;
const DEFAULT_RETRY_SECONDS = 30;
const DEFAULT_TIMEOUT_MS = 5000;

export function analyticsDestination(environment = process.env) {
  const raw = environment.ANALYTICS_FORWARD_URL?.trim();
  if (!raw) return null;

  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new ConfigError('ANALYTICS_FORWARD_URL must be a valid URL');
  }
  if (url.protocol !== 'https:' || url.username || url.password || url.hash) {
    throw new ConfigError('ANALYTICS_FORWARD_URL must be a credential-free HTTPS URL without a fragment');
  }
  return url;
}

export function deliveryEvent(row) {
  const payload = row.payload && typeof row.payload === 'object' && !Array.isArray(row.payload)
    ? row.payload
    : {};
  const eventId = typeof payload.event_id === 'string' && payload.event_id
    ? payload.event_id
    : `${row.event_name}:${row.dedupe_key}`;
  return {
    event_id: eventId,
    event_name: row.event_name,
    dedupe_key: row.dedupe_key,
    occurred_at: row.created_at,
    properties: payload
  };
}

export function retryDelaySeconds(attempt, baseSeconds = DEFAULT_RETRY_SECONDS) {
  const exponent = Math.max(0, Math.min(10, attempt - 1));
  return Math.min(6 * 60 * 60, baseSeconds * (2 ** exponent));
}

async function claimEvents(sql, { batchSize, leaseSeconds, maxAttempts }) {
  return sql.begin(async (tx) => tx`
    WITH eligible AS (
      SELECT id
      FROM analytics_outbox
      WHERE status IN ('pending', 'failed', 'processing')
        AND attempts < ${maxAttempts}
        AND available_at <= now()
      ORDER BY created_at, id
      FOR UPDATE SKIP LOCKED
      LIMIT ${batchSize}
    )
    UPDATE analytics_outbox AS event
    SET status = 'processing',
        attempts = event.attempts + 1,
        available_at = now() + ${leaseSeconds} * interval '1 second',
        last_error = NULL
    FROM eligible
    WHERE event.id = eligible.id
    RETURNING event.id, event.event_name, event.dedupe_key, event.payload,
              event.attempts, event.created_at
  `);
}

async function markSent(sql, row) {
  await sql`
    UPDATE analytics_outbox
    SET status = 'sent', sent_at = now(), available_at = now(), last_error = NULL
    WHERE id = ${row.id} AND status = 'processing'
  `;
}

async function markFailed(sql, row, error, retrySeconds) {
  const message = String(error?.message || 'analytics delivery failed').slice(0, 300);
  const delay = retryDelaySeconds(row.attempts, retrySeconds);
  await sql`
    UPDATE analytics_outbox
    SET status = 'failed',
        available_at = now() + ${delay} * interval '1 second',
        last_error = ${message}
    WHERE id = ${row.id} AND status = 'processing'
  `;
  console.error('[analytics_delivery_failed]', {
    outbox_id: row.id,
    event_id: deliveryEvent(row).event_id,
    attempt: row.attempts,
    error: message
  });
}

async function deliverEvent(sql, row, destination, { bearerToken, timeoutMs, retrySeconds }) {
  const event = deliveryEvent(row);
  try {
    const response = await fetch(destination, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': event.event_id,
        ...(bearerToken ? { Authorization: `Bearer ${bearerToken}` } : {})
      },
      body: JSON.stringify(event),
      redirect: 'error',
      signal: AbortSignal.timeout(timeoutMs)
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    await markSent(sql, row);
    return true;
  } catch (error) {
    await markFailed(sql, row, error, retrySeconds);
    return false;
  }
}

export async function dispatchAnalyticsOutbox({ sql = database(), environment = process.env } = {}) {
  const destination = analyticsDestination(environment);
  if (!destination) return { configured: false, claimed: 0, sent: 0, failed: 0 };

  const batchSize = integerEnv('ANALYTICS_OUTBOX_BATCH_SIZE', DEFAULT_BATCH_SIZE, { min: 1, max: 50 }, environment);
  const leaseSeconds = integerEnv('ANALYTICS_OUTBOX_LEASE_SECONDS', DEFAULT_LEASE_SECONDS, { min: 15, max: 600 }, environment);
  const maxAttempts = integerEnv('ANALYTICS_OUTBOX_MAX_ATTEMPTS', DEFAULT_MAX_ATTEMPTS, { min: 1, max: 25 }, environment);
  const retrySeconds = integerEnv('ANALYTICS_OUTBOX_RETRY_SECONDS', DEFAULT_RETRY_SECONDS, { min: 5, max: 3600 }, environment);
  const timeoutMs = integerEnv('ANALYTICS_FORWARD_TIMEOUT_MS', DEFAULT_TIMEOUT_MS, { min: 500, max: 15000 }, environment);
  const bearerToken = environment.ANALYTICS_FORWARD_BEARER_TOKEN?.trim();
  const rows = await claimEvents(sql, { batchSize, leaseSeconds, maxAttempts });
  const outcomes = await Promise.all(rows.map((row) => deliverEvent(sql, row, destination, {
    bearerToken,
    timeoutMs,
    retrySeconds
  })));
  const sent = outcomes.filter(Boolean).length;
  return { configured: true, claimed: rows.length, sent, failed: rows.length - sent };
}

export async function dispatchAnalyticsOutboxSafely(options) {
  try {
    return await dispatchAnalyticsOutbox(options);
  } catch (error) {
    console.error('[analytics_dispatch_failed]', {
      error: String(error?.message || 'analytics dispatch failed').slice(0, 300)
    });
    return { configured: true, claimed: 0, sent: 0, failed: 0, dispatcher_error: true };
  }
}
