import { randomUUID } from 'node:crypto';
import { pageContext } from './_lib/analytics.js';
import { requiredEnv } from './_lib/config.js';
import { database } from './_lib/db.js';
import { HttpError, header, readRawBody, requireMethod, sendJson, withApiErrors } from './_lib/http.js';
import { stripeClient } from './_lib/stripe-client.js';
import { isPaidCheckoutEvent, validateClientReferenceId } from './_lib/validation.js';

export const config = { api: { bodyParser: false } };

function objectId(value) {
  if (typeof value === 'string') return value;
  return value && typeof value.id === 'string' ? value.id : null;
}

async function recordEvent(event) {
  const sql = database();
  const session = event.data?.object;
  const sessionId = session?.object === 'checkout.session' ? session.id : null;
  const stripeCreatedAt = new Date(event.created * 1000).toISOString();

  return sql.begin(async (tx) => {
    const insertedEvents = await tx`
      INSERT INTO stripe_events (
        event_id, event_type, checkout_session_id, livemode, stripe_created_at
      ) VALUES (
        ${event.id}, ${event.type}, ${sessionId}, ${Boolean(event.livemode)}, ${stripeCreatedAt}
      )
      ON CONFLICT (event_id) DO NOTHING
      RETURNING event_id
    `;
    if (insertedEvents.length === 0) return { duplicate: true, recorded: false };

    if (!isPaidCheckoutEvent(event)) {
      await tx`
        UPDATE stripe_events SET outcome = 'ignored', processed_at = now()
        WHERE event_id = ${event.id}
      `;
      return { duplicate: false, recorded: false };
    }

    const clientReferenceId = validateClientReferenceId(session.client_reference_id);
    const [attempt] = clientReferenceId
      ? await tx`
          SELECT id, client_reference_id, tier_id, expected_amount, currency, lead_id, source_page, attribution
          FROM checkout_attempts WHERE client_reference_id = ${clientReferenceId}
          FOR UPDATE
        `
      : [];

    if (!attempt) {
      await tx`
        UPDATE stripe_events SET outcome = 'unmatched_attempt', processed_at = now()
        WHERE event_id = ${event.id}
      `;
      return { duplicate: false, recorded: false };
    }

    const amountTotal = Number.isInteger(session.amount_total) ? session.amount_total : null;
    const currency = typeof session.currency === 'string' ? session.currency.toLowerCase() : '';
    if (amountTotal !== attempt.expected_amount || currency !== attempt.currency) {
      await tx`
        UPDATE checkout_attempts SET status = 'review_required', stripe_checkout_session_id = ${session.id}
        WHERE id = ${attempt.id}
      `;
      await tx`
        UPDATE stripe_events SET outcome = 'amount_mismatch', processed_at = now()
        WHERE event_id = ${event.id}
      `;
      return { duplicate: false, recorded: false };
    }

    const purchaseId = randomUUID();
    const paymentIntentId = objectId(session.payment_intent);
    const purchases = await tx`
      INSERT INTO purchases (
        id, checkout_session_id, checkout_attempt_id, client_reference_id, stripe_event_id,
        stripe_payment_intent_id, tier_id, amount_total, currency, payment_status, livemode, paid_at
      ) VALUES (
        ${purchaseId}, ${session.id}, ${attempt.id}, ${attempt.client_reference_id}, ${event.id},
        ${paymentIntentId}, ${attempt.tier_id}, ${amountTotal}, ${currency}, 'paid', ${Boolean(event.livemode)}, ${stripeCreatedAt}
      )
      ON CONFLICT (checkout_session_id) DO NOTHING
      RETURNING id
    `;

    if (purchases.length === 0) {
      await tx`
        UPDATE stripe_events SET outcome = 'duplicate_session', processed_at = now()
        WHERE event_id = ${event.id}
      `;
      return { duplicate: false, recorded: false };
    }

    await tx`
      UPDATE checkout_attempts
      SET status = 'paid', stripe_checkout_session_id = COALESCE(stripe_checkout_session_id, ${session.id}), paid_at = ${stripeCreatedAt}
      WHERE id = ${attempt.id}
    `;
    await tx`
      INSERT INTO analytics_outbox (event_name, dedupe_key, payload)
      VALUES (
        ${attempt.tier_id === 'consultation' ? 'consultation_booked' : 'service_purchase'},
        ${session.id},
        ${tx.json({
          event_id: `purchase:${session.id}`,
          checkout_session_id: session.id,
          purchase_id: purchaseId,
          checkout_attempt_id: attempt.id,
          lead_id: attempt.lead_id,
          source_page: attempt.source_page,
          ...pageContext(attempt.source_page),
          service_tier: attempt.tier_id,
          value: amountTotal / 100,
          currency: currency.toUpperCase(),
          attribution: attempt.attribution
        })}
      )
      ON CONFLICT (event_name, dedupe_key) DO NOTHING
    `;
    await tx`
      UPDATE stripe_events SET outcome = 'recorded', processed_at = now()
      WHERE event_id = ${event.id}
    `;
    return { duplicate: false, recorded: true };
  });
}

async function handle(req, res) {
  requireMethod(req, 'POST');
  const signature = header(req, 'stripe-signature');
  if (!signature) throw new HttpError(400, 'invalid_signature', 'Stripe-Signature is required');
  // Do not touch Vercel's lazy request.body helper before reading the stream;
  // Stripe must receive the exact bytes it signed.
  const rawBody = await readRawBody(req, 1024 * 1024, { allowParsedBody: false });

  const stripe = stripeClient();
  const webhookSecret = requiredEnv('STRIPE_WEBHOOK_SECRET');
  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch {
    throw new HttpError(400, 'invalid_signature', 'Webhook signature verification failed');
  }

  const result = await recordEvent(event);
  return sendJson(res, 200, { ok: true, duplicate: result.duplicate });
}

export default withApiErrors(handle);
