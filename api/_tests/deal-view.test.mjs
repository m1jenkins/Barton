import test from 'node:test';
import assert from 'node:assert/strict';
import { agreedOffer, bestPrices, dealerNames, droppedAfter } from '../_lib/deal-view.js';

const A = '2T3P1RFV5SW00000A';
const B = '2T3P1RFV5SW00000B';
const listings = [{ vin: A, dealer_name: 'North Toyota' }, { vin: B, dealer_name: 'South Toyota' }];
const at = hour => `2026-11-20T${String(hour).padStart(2, '0')}:00:00Z`;
let nextId = 1;
const event = (kind, hour, values = {}) => ({ id: nextId++, kind, occurred_at: at(hour), dealer_name: null, vin: null, otd_cents: null, ...values });
const quote = (hour, dealer, vin, otd, kind = 'quote') => event(kind, hour, { dealer_name: dealer, vin, otd_cents: otd });
const prices = (events, list = listings) => Object.fromEntries([...bestPrices(list, events)].map(([vin, best]) => [vin, [best.otd_cents, best.dealer_name]]));

test('the best price so far is the lowest dealer price per car, and each car is priced on its own', () => {
  const events = [
    quote(1, 'North Toyota', A, 3300000), quote(2, 'Lake Toyota', A, 3250000),
    quote(3, 'South Toyota', B, 3100000), quote(4, 'Lake Toyota', B, 3150000)
  ];
  assert.deepEqual(prices(events), { [A]: [3250000, 'Lake Toyota'], [B]: [3100000, 'South Toyota'] });
  const best = bestPrices(listings, events).get(A);
  assert.deepEqual(best, { otd_cents: 3250000, dealer_name: 'Lake Toyota', occurred_at: at(2) });
  assert.deepEqual(prices([quote(1, 'North Toyota', A, 3300000)]), { [A]: [3300000, 'North Toyota'] }, 'a car with no price is absent');
});

test('a dealer who raises their price is held to the raised price', () => {
  const events = [quote(1, 'North Toyota', A, 3200000), quote(2, 'Lake Toyota', A, 3250000), quote(3, 'North Toyota', A, 3300000)];
  assert.deepEqual(prices(events), { [A]: [3250000, 'Lake Toyota'] }, 'the other dealer is now lowest');
  assert.deepEqual(prices([quote(1, 'North Toyota', A, 3200000), quote(2, ' north toyota ', A, 3260000)]), { [A]: [3260000, 'north toyota'] },
    'dealer names match as summarizeDeal keys them');
});

test('a dropped dealer\'s price disappears until they quote again', () => {
  const quotes = [quote(1, 'North Toyota', A, 3200000), quote(2, 'Lake Toyota', A, 3250000), quote(3, 'North Toyota', B, 3000000)];
  const dropped = [...quotes, event('dropped', 4, { dealer_name: 'north toyota' })];
  assert.deepEqual(prices(dropped), { [A]: [3250000, 'Lake Toyota'] }, 'B had only North Toyota, so it has no price');
  assert.deepEqual(prices([...dropped, quote(5, 'North Toyota', A, 3240000)]), { [A]: [3240000, 'North Toyota'] },
    'back in the deal, only what the dealer quotes after the drop counts');
  assert.deepEqual(prices([...dropped, event('email_received', 5, { dealer_name: 'North Toyota' })]), { [A]: [3250000, 'Lake Toyota'] },
    'an email from a dropped dealer does not bring their withdrawn prices back');
  assert.deepEqual(prices([...dropped, event('note', 5, { dealer_name: 'North Toyota', note: 'Called' })]), { [A]: [3250000, 'Lake Toyota'] },
    'a note does not bring a dealer back');
  assert.deepEqual([droppedAfter(false, 'dropped'), droppedAfter(true, 'email_received'), droppedAfter(true, 'note'), droppedAfter(false, 'counter')],
    [true, false, true, false]);
});

test('counters, missing or off-shortlist VINs never count; VIN case does not matter', () => {
  const events = [
    quote(1, 'North Toyota', A, 3300000),
    quote(2, 'North Toyota', A, 2900000, 'counter'),
    quote(3, 'Lake Toyota', null, 2800000),
    quote(4, 'Lake Toyota', 'ZZZZZZZZZZZZZZZZZ', 2700000),
    quote(5, 'South Toyota', B.toLowerCase(), 3100000)
  ];
  assert.deepEqual(prices(events), { [A]: [3300000, 'North Toyota'], [B]: [3100000, 'South Toyota'] });
  assert.deepEqual(prices(events, [{ vin: A.toLowerCase() }]), { [A]: [3300000, 'North Toyota'] }, 'a lower-case shortlist VIN still matches');
  assert.deepEqual(prices([quote(1, null, A, 3000000)]), {}, 'a price with no dealer is not one');
});

test('an agreed price counts as that dealer\'s latest price, and ties go to the earlier price', () => {
  const events = [quote(1, 'North Toyota', A, 3300000), quote(2, 'Lake Toyota', A, 3250000), quote(3, 'North Toyota', A, 3240000, 'agreed')];
  assert.deepEqual(prices(events), { [A]: [3240000, 'North Toyota'] });
  assert.deepEqual(prices([quote(1, 'North Toyota', A, 3260000, 'agreed'), quote(2, 'Lake Toyota', A, 3250000)]), { [A]: [3250000, 'Lake Toyota'] });
  assert.deepEqual(prices([quote(1, 'North Toyota', A, 3250000), quote(2, 'Lake Toyota', A, 3250000)]), { [A]: [3250000, 'North Toyota'] });
});

test('event order in the input does not change the answer', () => {
  const events = [
    quote(1, 'North Toyota', A, 3200000), quote(2, 'Lake Toyota', A, 3250000), quote(3, 'North Toyota', A, 3300000),
    quote(3, 'South Toyota', B, 3000000), event('dropped', 4, { dealer_name: 'South Toyota' }), quote(5, 'Lake Toyota', B, 3050000),
    quote(6, 'Lake Toyota', A, 3260000, 'agreed')
  ];
  const ordered = prices(events);
  assert.deepEqual(ordered, { [A]: [3260000, 'Lake Toyota'], [B]: [3050000, 'Lake Toyota'] });
  assert.deepEqual(prices([...events].reverse()), ordered);
  assert.deepEqual(prices([events[3], events[6], events[0], events[5], events[2], events[4], events[1]]), ordered);
  assert.deepEqual(agreedOffer(listings, [...events].reverse()), agreedOffer(listings, events));
  // Same minute: the id breaks the tie, so the later row is the dealer's latest.
  const sameTime = [{ ...quote(1, 'North Toyota', A, 3300000), id: 20 }, { ...quote(1, 'North Toyota', A, 3200000), id: 10 }];
  assert.deepEqual(prices(sameTime), { [A]: [3300000, 'North Toyota'] });
});

test('the agreed offer is the latest agreed from a dealer still in the deal', () => {
  const events = [
    quote(1, 'North Toyota', A, 3200000, 'agreed'),
    quote(2, 'Lake Toyota', B.toLowerCase(), 3100000, 'agreed')
  ];
  assert.deepEqual(agreedOffer(listings, events), { vin: B, dealer_name: 'Lake Toyota', otd_cents: 3100000, occurred_at: at(2) });
  const dropped = [...events, event('dropped', 3, { dealer_name: 'Lake Toyota' })];
  assert.deepEqual(agreedOffer(listings, dropped), { vin: A, dealer_name: 'North Toyota', otd_cents: 3200000, occurred_at: at(1) },
    'a dropped dealer\'s agreed price is ignored');
  assert.equal(agreedOffer(listings, [...dropped, event('dropped', 4, { dealer_name: 'North Toyota' })]), null);
  assert.equal(agreedOffer(listings, [quote(1, 'North Toyota', A, 3200000)]), null, 'a quote is not an agreed price');
  assert.equal(agreedOffer(listings, [quote(1, 'North Toyota', null, 3200000, 'agreed')]).vin, null, 'no VIN');
  assert.equal(agreedOffer(listings, [quote(1, 'North Toyota', 'ZZZZZZZZZZZZZZZZZ', 3200000, 'agreed')]).vin, null, 'a car off the shortlist');
});

test('dealer names come from the shortlist and the log, once each', () => {
  const events = [event('first_email_sent', 1, { dealer_name: ' Lake Toyota ' }), quote(2, 'north toyota', A, 3200000), event('note', 3, { note: 'No dealer' })];
  assert.deepEqual(dealerNames(listings, events), ['North Toyota', 'South Toyota', 'Lake Toyota']);
  assert.deepEqual(dealerNames([], []), []);
});
