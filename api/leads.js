import { randomUUID } from 'node:crypto';
import { database } from './_lib/db.js';
import { leadDestination, dispatchLeadForwardSafely } from './_lib/lead-forward-outbox.js';
import { HttpError, assertSameOrigin, readJsonBody, requireMethod, sendJson, withApiErrors } from './_lib/http.js';
import { verifyTurnstile } from './_lib/turnstile.js';
import { idempotencyKey, payloadHash, validateLeadPayload } from './_lib/validation.js';
import { trackOpenAIAdsConversion } from './_lib/openai-ads-capi.js';

export function leadRequestHash(value) {
  const normalized = validateLeadPayload(value);
  delete normalized.turnstile_token;
  return payloadHash(normalized);
}

export function matchesLeadRequest(record, hash) {
  if (record.request_hash === hash) return true;
  // Recheck stored business fields under the current privacy normalization.
  // This preserves pre-release lost-response retries without changing history.
  try { return leadRequestHash(record) === hash; } catch { return false; }
}

export function leadHandler({ getDatabase = database, verifyToken = verifyTurnstile, notify = trackOpenAIAdsConversion } = {}) {
  return async function handle(req, res) {
    requireMethod(req, 'POST');
    assertSameOrigin(req);
    const key = idempotencyKey(req);
    const body = await readJsonBody(req, 32768);
    const lead = validateLeadPayload(body);
    const hashInput = { ...lead };
    delete hashInput.turnstile_token;
    const hash = payloadHash(hashInput);
    const sql = getDatabase();

    const [prior] = await sql`
      SELECT id, request_hash, name, email, phone, message, vehicle, source, source_page, attribution, created_at
      FROM leads WHERE idempotency_key = ${key}
    `;
    if (prior) {
      if (!matchesLeadRequest(prior, hash)) throw new HttpError(409, 'idempotency_conflict', 'Idempotency-Key was already used');
      const destination = leadDestination();
      await dispatchLeadForwardSafely({ sql, leadId: prior.id });
      return sendJson(res, 200, { ok: true, lead_id: prior.id, forwarding_configured: Boolean(destination) });
    }

    const turnstileVerified = await verifyToken(lead.turnstile_token);
    const leadId = randomUUID();
    const destination = leadDestination();
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
      if (!record || !matchesLeadRequest(record, hash)) {
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

    await dispatchLeadForwardSafely({ sql, leadId: persisted.record.id });
    if (persisted.created) {
      notify({
        eventType: 'lead_created',
        eventId: `lead:${persisted.record.id}`,
        timestampMs: Date.now(),
        sourcePage: persisted.record.source_page
      }, req);
    }
    return sendJson(res, persisted.created ? 201 : 200, { ok: true, lead_id: persisted.record.id, forwarding_configured: Boolean(destination) });
  };
}

export default withApiErrors(leadHandler());
