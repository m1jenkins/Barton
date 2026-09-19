import { randomUUID } from 'node:crypto';
import { ConfigError, paymentLinkForTier, serviceTier } from './_lib/config.js';
import { assertCurrentOffer, offerKey } from './_lib/checkout-offer.js';
import { database } from './_lib/db.js';
import { HttpError, assertSameOrigin, readJsonBody, requireMethod, sendJson, withApiErrors } from './_lib/http.js';
import { idempotencyKey, payloadHash, paymentLinkWithReference, validateCheckoutPayload } from './_lib/validation.js';
import { trackOpenAIAdsConversion } from './_lib/openai-ads-capi.js';

export function checkoutHandler({ getDatabase = database, notify = trackOpenAIAdsConversion } = {}) {
return async function handle(req, res) {
  requireMethod(req, 'POST');
  assertSameOrigin(req);
  if (process.env.CHECKOUT_PAUSED === 'true') throw new ConfigError('New checkout is paused for cutover');
  const key = idempotencyKey(req);
  const checkout = validateCheckoutPayload(await readJsonBody(req, 8192));
  const hash = payloadHash(checkout);
  const service = serviceTier(checkout.tier);
  const baseUrl = paymentLinkForTier(checkout.tier);
  const currentOffer = offerKey(checkout.tier, service, baseUrl);
  const sql = getDatabase();

  const [prior] = await sql`
    SELECT id, client_reference_id, request_hash, expected_amount, currency, offer_key
    FROM checkout_attempts WHERE idempotency_key = ${key}
  `;
  if (prior) {
    // Old URL normalization may also change the hash. A stale offer returns no
    // link and must restart regardless; current-offer conflicts still fail below.
    assertCurrentOffer(prior, service, currentOffer);
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
        expected_amount, currency, lead_id, source_page, attribution, offer_key
      ) VALUES (
        ${attemptId}, ${clientReferenceId}, ${key}, ${hash}, ${checkout.tier},
        ${service.amount}, ${service.currency}, ${checkout.lead_id}, ${checkout.source_page},
        ${tx.json(checkout.attribution)}, ${currentOffer}
      )
      ON CONFLICT (idempotency_key) DO NOTHING
      RETURNING id, client_reference_id, request_hash, expected_amount, currency, offer_key
    `;
    const record = inserted[0] || (await tx`
      SELECT id, client_reference_id, request_hash, expected_amount, currency, offer_key
      FROM checkout_attempts WHERE idempotency_key = ${key}
    `)[0];
    if (record) assertCurrentOffer(record, service, currentOffer);
    if (!record || record.request_hash !== hash) {
      throw new HttpError(409, 'idempotency_conflict', 'Idempotency-Key was already used');
    }
    return { record, created: inserted.length === 1 };
  });

  if (persisted.created) {
    notify({
      eventType: 'checkout_started',
      eventId: `checkout:${persisted.record.id}`,
      timestampMs: Date.now(),
      sourcePage: checkout.source_page
    }, req);
  }

  return sendJson(res, persisted.created ? 201 : 200, {
    ok: true,
    url: paymentLinkWithReference(baseUrl, persisted.record.client_reference_id),
    attempt_id: persisted.record.id
  });
};
}

export default withApiErrors(checkoutHandler());
