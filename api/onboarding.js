import { randomUUID } from 'node:crypto';
import { pageContext } from './_lib/analytics.js';
import { database } from './_lib/db.js';
import { HttpError, assertSameOrigin, readJsonBody, requireMethod, sendJson, withApiErrors } from './_lib/http.js';
import { idempotencyKey, payloadHash, validateOnboardingPayload } from './_lib/validation.js';

async function handle(req, res) {
  requireMethod(req, 'POST');
  assertSameOrigin(req);
  const key = idempotencyKey(req);
  const onboarding = validateOnboardingPayload(await readJsonBody(req, 65536));
  const hash = payloadHash(onboarding);
  const sql = database();

  const [prior] = await sql`
    SELECT id, request_hash FROM onboarding_submissions WHERE idempotency_key = ${key}
  `;
  if (prior) {
    if (prior.request_hash !== hash) throw new HttpError(409, 'idempotency_conflict', 'Idempotency-Key was already used');
    return sendJson(res, 200, { ok: true, onboarding_id: prior.id });
  }

  const onboardingId = randomUUID();
  const persisted = await sql.begin(async (tx) => {
    const [purchase] = await tx`
      SELECT p.id, p.checkout_session_id, p.tier_id, p.payment_status,
             a.source_page, a.attribution
      FROM purchases p
      JOIN checkout_attempts a ON a.id = p.checkout_attempt_id
      WHERE p.checkout_session_id = ${onboarding.session_id}
      FOR UPDATE
    `;
    if (!purchase || purchase.payment_status !== 'paid') {
      throw new HttpError(403, 'purchase_not_verified', 'A verified paid session is required');
    }
    if (purchase.tier_id !== onboarding.tier) {
      throw new HttpError(409, 'tier_mismatch', 'The selected tier does not match the purchase');
    }

    const [existingForSession] = await tx`
      SELECT id, request_hash FROM onboarding_submissions
      WHERE checkout_session_id = ${onboarding.session_id}
    `;
    if (existingForSession) {
      if (existingForSession.request_hash !== hash) {
        throw new HttpError(409, 'onboarding_exists', 'Onboarding was already submitted for this purchase');
      }
      return { id: existingForSession.id, created: false };
    }

    const inserted = await tx`
      INSERT INTO onboarding_submissions (
        id, checkout_session_id, purchase_id, idempotency_key, request_hash, tier_id,
        name, email, phone, city, fields
      ) VALUES (
        ${onboardingId}, ${onboarding.session_id}, ${purchase.id}, ${key}, ${hash}, ${onboarding.tier},
        ${onboarding.name}, ${onboarding.email}, ${onboarding.phone}, ${onboarding.city}, ${tx.json(onboarding.fields)}
      )
      ON CONFLICT (idempotency_key) DO NOTHING
      RETURNING id
    `;
    if (inserted.length === 1) {
      await tx`
        INSERT INTO analytics_outbox (event_name, dedupe_key, payload)
        VALUES (
          'onboarding_complete',
          ${onboarding.session_id},
          ${tx.json({
            event_id: `onboarding:${onboarding.session_id}`,
            onboarding_id: inserted[0].id,
            purchase_id: purchase.id,
            source_page: purchase.source_page,
            ...pageContext(purchase.source_page),
            service_tier: purchase.tier_id,
            attribution: purchase.attribution
          })}
        )
        ON CONFLICT (event_name, dedupe_key) DO NOTHING
      `;
      return { id: inserted[0].id, created: true };
    }
    const [idempotentRace] = await tx`
      SELECT id, request_hash FROM onboarding_submissions WHERE idempotency_key = ${key}
    `;
    if (!idempotentRace || idempotentRace.request_hash !== hash) {
      throw new HttpError(409, 'idempotency_conflict', 'Idempotency-Key was already used');
    }
    return { id: idempotentRace.id, created: false };
  });

  return sendJson(res, persisted.created ? 201 : 200, { ok: true, onboarding_id: persisted.id });
}

export default withApiErrors(handle);
