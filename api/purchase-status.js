import { paidTier } from './_lib/checkout-offer.js';
import { SERVICE_TIERS } from './_lib/config.js';
import { database } from './_lib/db.js';
import { assertSameSiteRead, requestUrl, requireMethod, sendJson, withApiErrors } from './_lib/http.js';
import { stripeClient } from './_lib/stripe-client.js';
import { validateClientReferenceId, validateSessionId, validateTier } from './_lib/validation.js';

export function verifiedPurchase(session, purchase, requestedTier) {
  return Boolean(
    session && purchase && purchase.payment_status === 'paid' &&
    session.payment_status === 'paid' && session.mode === 'payment' &&
    purchase.tier_id === requestedTier && purchase.amount_total === session.amount_total &&
    purchase.currency === String(session.currency || '').toLowerCase() &&
    purchase.client_reference_id === session.client_reference_id
  );
}

// Value and currency come from the ledger row, so a historical $495 purchase
// reports 495 rather than the current price.
export function verifiedPurchaseBody(purchase) {
  return {
    ok: true,
    verified: true,
    tier: purchase.tier_id,
    purchase_id: purchase.id,
    value: purchase.amount_total / 100,
    currency: String(purchase.currency).toUpperCase()
  };
}

async function retrieveSession(sessionId) {
  try {
    return await stripeClient().checkout.sessions.retrieve(sessionId);
  } catch (error) {
    if (error?.code === 'resource_missing' || error?.statusCode === 404) return null;
    throw error;
  }
}

// Where a paid buyer tells us about the car. A payment link can redirect here
// (?next=intake&tier=<its own tier>&session_id={CHECKOUT_SESSION_ID}) instead of
// straight to a page, so a Steer Me Right checkout that took the Pro add-on
// lands on the Pro intake.
export const INTAKE_PAGES = Object.freeze({
  full_service: '/payment-success-fullservice.html',
  concierge: '/payment-success-concierge.html',
  private_client: '/payment-success-private-client.html'
});

export function intakeLocation(tier, fallbackTier, sessionId) {
  const page = INTAKE_PAGES[tier] ?? INTAKE_PAGES[fallbackTier] ?? INTAKE_PAGES.full_service;
  return sessionId ? `${page}?session_id=${encodeURIComponent(sessionId)}` : page;
}

// Stripe sends the buyer here as a cross-site navigation, so this path answers
// with a redirect only: it never returns purchase data and never fails loudly.
async function redirectToIntake(url, res) {
  let sessionId = null, fallbackTier = 'full_service', tier = null;
  try {
    fallbackTier = validateTier(url.searchParams.get('tier'));
    sessionId = validateSessionId(url.searchParams.get('session_id'));
    const sql = database();
    const [session, purchases] = await Promise.all([
      retrieveSession(sessionId),
      sql`SELECT tier_id FROM purchases WHERE checkout_session_id = ${sessionId}`
    ]);
    tier = purchases[0]?.tier_id ?? null;
    // The webhook may not have landed yet: work the tier out the way it will.
    const reference = !tier && session?.payment_status === 'paid' ? validateClientReferenceId(session.client_reference_id) : null;
    if (reference) {
      const [attempt] = await sql`SELECT tier_id, expected_amount, currency FROM checkout_attempts WHERE client_reference_id = ${reference}`;
      if (attempt && attempt.currency === String(session.currency || '').toLowerCase()) tier = paidTier(session, attempt, SERVICE_TIERS);
    }
  } catch { /* Fall back to the link's own page, which shows its own unverified state. */ }
  res.statusCode = 303;
  res.setHeader('Location', intakeLocation(tier, fallbackTier, sessionId));
  res.setHeader('Cache-Control', 'no-store');
  res.end();
}

async function handle(req, res) {
  requireMethod(req, 'GET');
  const url = requestUrl(req);
  if (url.searchParams.get('next') === 'intake') return redirectToIntake(url, res);
  assertSameSiteRead(req);
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

  const verified = verifiedPurchase(session, purchase, requestedTier);

  if (verified) {
    return sendJson(res, 200, verifiedPurchaseBody(purchase));
  }

  const status = session.payment_status === 'paid' && !purchase ? 'processing' : 'unverified';
  return sendJson(res, 200, { ok: true, verified: false, tier: requestedTier, status });
}

export default withApiErrors(handle);
