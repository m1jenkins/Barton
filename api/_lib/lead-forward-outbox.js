import { ConfigError, integerEnv } from './config.js';
import { database } from './db.js';

export function leadDestination(environment = process.env) {
  const raw = environment.LEAD_FORWARD_URL?.trim();
  if (!raw) return null;
  let url;
  try { url = new URL(raw); } catch { throw new ConfigError('LEAD_FORWARD_URL must be a valid URL'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.hash) {
    throw new ConfigError('LEAD_FORWARD_URL must be a credential-free HTTPS URL without a fragment');
  }
  return url;
}

export function leadDeliverySettings(environment = process.env) {
  const timeoutMs = integerEnv('LEAD_FORWARD_TIMEOUT_MS', 8000, { min: 500, max: 15000 }, environment);
  const leaseSeconds = integerEnv('LEAD_OUTBOX_LEASE_SECONDS', 60, { min: 15, max: 600 }, environment);
  if (leaseSeconds * 1000 <= timeoutMs) throw new ConfigError('LEAD_OUTBOX_LEASE_SECONDS must exceed the delivery timeout');
  return {
    batchSize: integerEnv('LEAD_OUTBOX_BATCH_SIZE', 10, { min: 1, max: 50 }, environment),
    maxAttempts: integerEnv('LEAD_OUTBOX_MAX_ATTEMPTS', 8, { min: 1, max: 25 }, environment),
    retrySeconds: integerEnv('LEAD_OUTBOX_RETRY_SECONDS', 30, { min: 5, max: 3600 }, environment),
    leaseSeconds, timeoutMs
  };
}

async function claimLeads(sql, leadId, { batchSize, maxAttempts, leaseSeconds, retrySeconds }) {
  // Use the existing queue's timestamp; this worker needs no schema migration.
  return sql.begin(async tx => tx`
    WITH eligible AS (
      SELECT outbox.lead_id
      FROM lead_forward_outbox AS outbox
      JOIN leads AS lead ON lead.id = outbox.lead_id
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
      ORDER BY lead.created_at, outbox.lead_id
      FOR UPDATE OF outbox SKIP LOCKED
      LIMIT ${batchSize}
    )
    UPDATE lead_forward_outbox AS outbox
    SET status = 'processing', attempts = outbox.attempts + 1,
        last_attempt_at = now(), last_error = NULL
    FROM eligible JOIN leads AS lead ON lead.id = eligible.lead_id
    WHERE outbox.lead_id = eligible.lead_id
    RETURNING outbox.lead_id, outbox.attempts,
              lead.name, lead.email, lead.phone, lead.message, lead.vehicle,
              lead.source, lead.source_page, lead.attribution, lead.created_at
  `);
}

async function deliverLead(sql, row, destination, { bearerToken, timeoutMs }) {
  // Contact data belongs in the configured notification request, never in logs.
  const payload = Object.fromEntries(['lead_id', 'name', 'email', 'phone', 'message', 'vehicle', 'source', 'source_page', 'attribution', 'created_at'].map(key => [key, row[key]]));
  try {
    const response = await fetch(destination, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': row.lead_id, ...(bearerToken ? { Authorization: `Bearer ${bearerToken}` } : {}) },
      body: JSON.stringify(payload), redirect: 'error', signal: AbortSignal.timeout(timeoutMs)
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const updated = await sql`
      UPDATE lead_forward_outbox
      SET status = 'sent', sent_at = now(), last_error = NULL
      WHERE lead_id = ${row.lead_id} AND status = 'processing' AND attempts = ${row.attempts}
      RETURNING lead_id
    `;
    return updated.length === 1;
  } catch {
    // Fetch errors can contain the destination or other private request details.
    await sql`
      UPDATE lead_forward_outbox
      SET status = 'failed', last_error = 'Lead delivery failed'
      WHERE lead_id = ${row.lead_id} AND status = 'processing' AND attempts = ${row.attempts}
    `;
    console.error('[lead_forward_failed]', { lead_id: row.lead_id, attempt: row.attempts });
    return false;
  }
}

export async function dispatchLeadForwardOutbox({ sql, environment = process.env, leadId = null } = {}) {
  const destination = leadDestination(environment);
  if (!destination) return { configured: false, claimed: 0, sent: 0, failed: 0 };
  const settings = leadDeliverySettings(environment);
  const client = sql || database();
  const rows = await claimLeads(client, leadId, settings);
  const outcomes = await Promise.allSettled(rows.map(row => deliverLead(client, row, destination, {
    timeoutMs: settings.timeoutMs, bearerToken: environment.LEAD_FORWARD_BEARER_TOKEN?.trim()
  })));
  const sent = outcomes.filter(outcome => outcome.status === 'fulfilled' && outcome.value).length;
  if (outcomes.some(outcome => outcome.status === 'rejected')) console.error('[lead_delivery_ack_failed]');
  return { configured: true, claimed: rows.length, sent, failed: rows.length - sent };
}

export async function dispatchLeadForwardSafely(options) {
  try { return await dispatchLeadForwardOutbox(options); } catch {
    console.error('[lead_dispatch_failed]');
    return { configured: true, claimed: 0, sent: 0, failed: 0, dispatcher_error: true };
  }
}
