import { createHash } from 'node:crypto';
import { HttpError } from './http.js';

// Stripe discounts the owner has approved, keyed by coupon ID. See
// docs/seo-execution/stripe-cutover-2026-10-23.md#promotion-code-50off.
export const APPROVED_DISCOUNTS = Object.freeze({
  '1GEB7DeZ': Object.freeze({ code: '50OFF', promotionCode: 'promo_1UTqrW2RwNuweXRLRq1pDJgE', percentOff: 50 }),
  // Halloween sale; Stripe stops accepting it at midnight Central on Oct 31, 2026.
  'Cd7Edniu': Object.freeze({ code: 'SPOOKY25', promotionCode: 'promo_1UTr3y2RwNuweXRLmAbkQp8w', percentOff: 25 })
});

function objectId(value) {
  if (typeof value === 'string') return value;
  return value && typeof value.id === 'string' ? value.id : null;
}

function approvedDiscount(entry) {
  const coupon = objectId(entry?.coupon);
  if (coupon && Object.hasOwn(APPROVED_DISCOUNTS, coupon)) return APPROVED_DISCOUNTS[coupon];
  const promotionCode = objectId(entry?.promotion_code);
  return Object.values(APPROVED_DISCOUNTS).find(d => promotionCode && d.promotionCode === promotionCode) ?? null;
}

// What a paid Checkout Session should total for an attempt, or null when its
// discounts are not ones we approved. Undiscounted sessions must pay the full
// attempt amount; a discounted one must start from that amount and take off
// exactly one approved percentage.
export function expectedPaidAmount(session, expectedAmount) {
  const discounts = Array.isArray(session.discounts) ? session.discounts : [];
  const discountTotal = session.total_details?.amount_discount ?? 0;
  if (discounts.length === 0 && discountTotal === 0) return expectedAmount;
  if (discounts.length !== 1 || session.amount_subtotal !== expectedAmount) return null;
  const discount = approvedDiscount(discounts[0]);
  if (!discount) return null;
  const amountOff = Math.round(expectedAmount * discount.percentOff / 100);
  return discountTotal === amountOff ? expectedAmount - amountOff : null;
}

// The tier a paid Checkout Session bought, or null when its total fits neither
// the attempt nor the add-on. The Steer Me Right payment link offers Steer Me
// Right Pro as an optional item for the difference (2026-11-26), so a Steer Me
// Right attempt that pays the Pro total is a Pro purchase. Nothing else moves
// an attempt to another tier.
export function paidTier(session, attempt, tiers) {
  const total = Number.isInteger(session.amount_total) ? session.amount_total : null;
  if (total === null) return null;
  if (total === expectedPaidAmount(session, attempt.expected_amount)) return attempt.tier_id;
  const base = tiers.full_service, pro = tiers.concierge;
  const addOn = attempt.tier_id === 'full_service' && attempt.expected_amount === base.amount && attempt.currency === pro.currency;
  return addOn && total === expectedPaidAmount(session, pro.amount) ? 'concierge' : null;
}

export function offerKey(tier, service, paymentLink) {
  return createHash('sha256').update(JSON.stringify([tier, service.amount, service.currency, String(paymentLink)])).digest('hex');
}

// Never mutate an old attempt, including attempts whose paid session arrives later.
// Pre-migration attempts have no offer key and must also restart explicitly.
export function assertCurrentOffer(attempt, service, key) {
  if (attempt.expected_amount !== service.amount || attempt.currency !== service.currency || attempt.offer_key !== key) {
    throw new HttpError(409, 'stale_offer', 'Review the current fee and start a new checkout');
  }
}
