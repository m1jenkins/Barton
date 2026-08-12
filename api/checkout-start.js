import { randomUUID } from 'node:crypto';
import { paymentLinkForTier, serviceTier } from './_lib/config.js';
import { database } from './_lib/db.js';
import { HttpError, assertSameOrigin, readJsonBody, requireMethod, sendJson, withApiErrors } from './_lib/http.js';
import { idempotencyKey, payloadHash, paymentLinkWithReference, validateCheckoutPayload } from './_lib/validation.js';

async function handle(req, res) {
  requireMethod(req, 'POST');
  assertSameOrigin(req);
  const key = idempotencyKey(req);
  const checkout = validateCheckoutPayload(await readJsonBody(req, 8192));
  const hash = payloadHash(checkout);
  const service = serviceTier(checkout.tier);
  const baseUrl = paymentLinkForTier(checkout.tier);
  const sql = database();

  const [prior] = await sql`
    SELECT id, client_reference_id, request_hash
    FROM checkout_attempts WHERE idempotency_key = ${key}
  `;
  if (prior) {
    if (prior.request_hash !== hash) throw new HttpError(409, 'idempotency_conflict', 'Idempotency-Key was already used');
    return sendJson(res, 200, {
      ok: true,
      url: paymentLinkWithReference(baseUrl, prior.client_reference_id),
      attempt_id: prior.id
    });
  }

  const attemptId = randomUUID();
  const clientReferenceId = randomUUID();
  const persisted = await sql.begin(async (tx) => {
    if (checkout.lead_id) {
      const [lead] = await tx`SELECT id FROM leads WHERE id = ${checkout.lead_id}`;
      if (!lead) throw new HttpError(422, 'invalid_lead', 'lead_id does not exist');
    }
    const inserted = await tx`
      INSERT INTO checkout_attempts (
        id, client_reference_id, idempotency_key, request_hash, tier_id,
        expected_amount, currency, lead_id, source_page, attribution
      ) VALUES (
        ${attemptId}, ${clientReferenceId}, ${key}, ${hash}, ${checkout.tier},
        ${service.amount}, ${service.currency}, ${checkout.lead_id}, ${checkout.source_page},
        ${tx.json(checkout.attribution)}
      )
      ON CONFLICT (idempotency_key) DO NOTHING
      RETURNING id, client_reference_id, request_hash
    `;
    const record = inserted[0] || (await tx`
      SELECT id, client_reference_id, request_hash
      FROM checkout_attempts WHERE idempotency_key = ${key}
    `)[0];
    if (!record || record.request_hash !== hash) {
      throw new HttpError(409, 'idempotency_conflict', 'Idempotency-Key was already used');
    }
    return { record, created: inserted.length === 1 };
  });

  return sendJson(res, persisted.created ? 201 : 200, {
    ok: true,
    url: paymentLinkWithReference(baseUrl, persisted.record.client_reference_id),
    attempt_id: persisted.record.id
  });
}

export default withApiErrors(handle);
