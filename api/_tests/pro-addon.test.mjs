import test from 'node:test';
import assert from 'node:assert/strict';
import { paidTier } from '../_lib/checkout-offer.js';
import { SERVICE_TIERS } from '../_lib/config.js';
import { intakeLocation } from '../purchase-status.js';

// The Steer Me Right payment link offers Steer Me Right Pro as an optional item
// for the difference (2026-11-26). These pin what counts as that add-on.
const attempt = tier => ({ tier_id: tier, expected_amount: SERVICE_TIERS[tier].amount, currency: 'usd' });
const session = (total, extra = {}) => ({ amount_total: total, amount_subtotal: total, discounts: [], total_details: { amount_discount: 0 }, ...extra });

test('a checkout that pays its own plan’s fee buys that plan', () => {
  assert.equal(paidTier(session(39500), attempt('full_service'), SERVICE_TIERS), 'full_service');
  assert.equal(paidTier(session(69500), attempt('concierge'), SERVICE_TIERS), 'concierge');
});

test('a Steer Me Right checkout that pays the Pro total is a Pro purchase', () => {
  assert.equal(paidTier(session(69500), attempt('full_service'), SERVICE_TIERS), 'concierge');
});

test('any other total goes to review, and no other plan changes tier', () => {
  for (const total of [0, 30000, 39499, 69501, 109000]) assert.equal(paidTier(session(total), attempt('full_service'), SERVICE_TIERS), null, String(total));
  assert.equal(paidTier(session(39500), attempt('concierge'), SERVICE_TIERS), null, 'Pro never becomes Steer Me Right');
  assert.equal(paidTier(session(69500), attempt('consultation'), SERVICE_TIERS), null);
  assert.equal(paidTier({ amount_total: null }, attempt('full_service'), SERVICE_TIERS), null);
  // An old attempt at another price is not the current $395 offer, so the add-on does not apply to it.
  assert.equal(paidTier(session(69500), { tier_id: 'full_service', expected_amount: 29500, currency: 'usd' }, SERVICE_TIERS), null);
});

test('an approved discount works on the add-on total, and an unapproved one still goes to review', () => {
  const half = { amount_total: 34750, amount_subtotal: 69500, discounts: [{ coupon: '1GEB7DeZ' }], total_details: { amount_discount: 34750 } };
  assert.equal(paidTier(half, attempt('full_service'), SERVICE_TIERS), 'concierge');
  const unknown = { ...half, discounts: [{ coupon: 'not-approved' }] };
  assert.equal(paidTier(unknown, attempt('full_service'), SERVICE_TIERS), null);
});

test('the intake redirect sends each plan to its own page and falls back to the link’s own', () => {
  assert.equal(intakeLocation('concierge', 'full_service', 'cs_test_1'), '/payment-success-concierge.html?session_id=cs_test_1');
  assert.equal(intakeLocation('full_service', 'full_service', 'cs_test_1'), '/payment-success-fullservice.html?session_id=cs_test_1');
  assert.equal(intakeLocation(null, 'concierge', 'cs_test_1'), '/payment-success-concierge.html?session_id=cs_test_1');
  assert.equal(intakeLocation(null, 'consultation', null), '/payment-success-fullservice.html');
});
