import { randomUUID } from 'node:crypto';
import { database } from './_lib/db.js';
import { HttpError, assertSameOrigin, readJsonBody, requireMethod, sendJson, withApiErrors } from './_lib/http.js';
import { verifyTurnstile } from './_lib/turnstile.js';
import { idempotencyKey, payloadHash, validateLeadPayload } from './_lib/validation.js';

function configuredForwardUrl() {
  const raw = process.env.LEAD_FORWARD_URL?.trim();
  if (!raw) return null;
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new HttpError(503, 'forward_configuration_invalid', 'Lead forwarding is unavailable');
  }
  if (url.protocol !== 'https:' || url.username || url.password || url.hash) {
    throw new HttpError(503, 'forward_configuration_invalid', 'Lead forwarding is unavailable');
  }
  return url;
}

async function forwardAfterCommit(sql, lead, destination) {
  if (!destination) return;

  const [claim] = await sql`
    UPDATE lead_forward_outbox
    SET status = 'processing', attempts = attempts + 1, last_attempt_at = now(), last_error = NULL
    WHERE lead_id = ${lead.id}
      AND (
        status IN ('pending', 'failed')
        OR (status = 'processing' AND last_attempt_at < now() - interval '5 minutes')
      )
    RETURNING lead_id
  `;
  if (!claim) return;

  const bearer = process.env.LEAD_FORWARD_BEARER_TOKEN?.trim();
  try {
    const response = await fetch(destination, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': lead.id,
        ...(bearer ? { Authorization: `Bearer ${bearer}` } : {})
      },
      body: JSON.stringify({
        lead_id: lead.id,
        name: lead.name,
        email: lead.email,
        phone: lead.phone,
        message: lead.message,
        vehicle: lead.vehicle,
        source: lead.source,
        source_page: lead.source_page,
        attribution: lead.attribution,
        created_at: lead.created_at
      }),
      redirect: 'error',
      signal: AbortSignal.timeout(8000)
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    await sql`
      UPDATE lead_forward_outbox
      SET status = 'sent', sent_at = now(), last_error = NULL
      WHERE lead_id = ${lead.id}
    `;
  } catch (error) {
    const message = String(error?.message || 'forward failed').slice(0, 300);
    await sql`
      UPDATE lead_forward_outbox
      SET status = 'failed', last_error = ${message}
      WHERE lead_id = ${lead.id}
    `;
    console.error('[lead_forward_failed]', { lead_id: lead.id, error: message });
  }
}

async function handle(req, res) {
  requireMethod(req, 'POST');
  assertSameOrigin(req);
  const key = idempotencyKey(req);
  const body = await readJsonBody(req, 32768);
  const lead = validateLeadPayload(body);
  const hashInput = { ...lead };
  delete hashInput.turnstile_token;
  const hash = payloadHash(hashInput);
  const sql = database();

  const [prior] = await sql`
    SELECT id, request_hash, name, email, phone, message, vehicle, source, source_page, attribution, created_at
    FROM leads WHERE idempotency_key = ${key}
  `;
  if (prior) {
    if (prior.request_hash !== hash) throw new HttpError(409, 'idempotency_conflict', 'Idempotency-Key was already used');
    await forwardAfterCommit(sql, prior, configuredForwardUrl());
    return sendJson(res, 200, { ok: true, lead_id: prior.id });
  }

  const turnstileVerified = await verifyTurnstile(lead.turnstile_token);
  const leadId = randomUUID();
  const destination = configuredForwardUrl();
  const persisted = await sql.begin(async (tx) => {
    const inserted = await tx`
      INSERT INTO leads (
        id, idempotency_key, request_hash, name, email, phone, message, vehicle,
        source, source_page, attribution, turnstile_verified
      ) VALUES (
        ${leadId}, ${key}, ${hash}, ${lead.name}, ${lead.email}, ${lead.phone}, ${lead.message}, ${lead.vehicle},
        ${lead.source}, ${lead.source_page}, ${tx.json(lead.attribution)}, ${turnstileVerified}
      )
      ON CONFLICT (idempotency_key) DO NOTHING
      RETURNING id, request_hash, name, email, phone, message, vehicle, source, source_page, attribution, created_at
    `;
    const record = inserted[0] || (await tx`
      SELECT id, request_hash, name, email, phone, message, vehicle, source, source_page, attribution, created_at
      FROM leads WHERE idempotency_key = ${key}
    `)[0];
    if (!record || record.request_hash !== hash) {
      throw new HttpError(409, 'idempotency_conflict', 'Idempotency-Key was already used');
    }
    if (destination) {
      await tx`
        INSERT INTO lead_forward_outbox (lead_id) VALUES (${record.id})
        ON CONFLICT (lead_id) DO NOTHING
      `;
    }
    return { record, created: inserted.length === 1 };
  });

  await forwardAfterCommit(sql, persisted.record, destination);
  return sendJson(res, persisted.created ? 201 : 200, { ok: true, lead_id: persisted.record.id });
}

export default withApiErrors(handle);
