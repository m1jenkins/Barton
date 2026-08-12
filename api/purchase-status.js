import { database } from './_lib/db.js';
import { assertSameSiteRead, requestUrl, requireMethod, sendJson, withApiErrors } from './_lib/http.js';
import { stripeClient } from './_lib/stripe-client.js';
import { validateSessionId, validateTier } from './_lib/validation.js';

async function retrieveSession(sessionId) {
  try {
    return await stripeClient().checkout.sessions.retrieve(sessionId);
  } catch (error) {
    if (error?.code === 'resource_missing' || error?.statusCode === 404) return null;
    throw error;
  }
}

async function handle(req, res) {
  requireMethod(req, 'GET');
  assertSameSiteRead(req);
  const url = requestUrl(req);
  const sessionId = validateSessionId(url.searchParams.get('session_id'));
  const requestedTier = validateTier(url.searchParams.get('tier'));

  const [session, purchases] = await Promise.all([
    retrieveSession(sessionId),
    database()`
      SELECT id, checkout_session_id, client_reference_id, tier_id, amount_total, currency, payment_status
      FROM purchases WHERE checkout_session_id = ${sessionId}
    `
  ]);
  const purchase = purchases[0];

  if (!session) {
    return sendJson(res, 200, { ok: true, verified: false, tier: requestedTier, status: 'not_found' });
  }

  const verified = Boolean(
    purchase &&
    purchase.payment_status === 'paid' &&
    session.payment_status === 'paid' &&
    session.mode === 'payment' &&
    purchase.tier_id === requestedTier &&
    purchase.amount_total === session.amount_total &&
    purchase.currency === String(session.currency || '').toLowerCase() &&
    purchase.client_reference_id === session.client_reference_id
  );

  if (verified) {
    return sendJson(res, 200, {
      ok: true,
      verified: true,
      tier: purchase.tier_id,
      purchase_id: purchase.id
    });
  }

  const status = session.payment_status === 'paid' && !purchase ? 'processing' : 'unverified';
  return sendJson(res, 200, { ok: true, verified: false, tier: requestedTier, status });
}

export default withApiErrors(handle);
