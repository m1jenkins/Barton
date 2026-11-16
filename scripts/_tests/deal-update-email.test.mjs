import test from 'node:test';
import assert from 'node:assert/strict';
import { analyze, estimatePayment, renderDealUpdateEmail } from '../deal-update-email.mjs';

// A made-up deal. The private-looking fields (target, walk-away, dealer contacts, buyer notes)
// carry decoy values so the tests can prove they never reach the email.
const DECOYS = ['424242', '171717', 'secret.dealer@example.com', '555-0100', 'TRADE-VIN-DECOY'];

function fixture(overrides = {}) {
  const car = (rank, extra = {}) => ({
    rank, title: '2026 Test Wagon', condition: 'New', finance: 'new', color: 'Blue / Black', mileage: 10,
    dealer: `Dealer ${rank} Motors`, dealer_short: `Dealer ${rank}`, location: 'Austin, TX', distance_miles: 12,
    listing_url: 'https://example.com/car', asking_cents: 60_000_00, market_cents: 58_000_00, days_on_lot: 40, status: 'waiting',
    target_cents: 424242_00, walk_away_cents: 171717_00, dealer_email: 'secret.dealer@example.com', dealer_phone: '555-0100',
    trade_note: 'TRADE-VIN-DECOY', ...extra
  });
  return {
    updated_at: '2026-11-04T19:24:00Z',
    buyer_first_name: 'Sam',
    search: { title: 'Your wagon search', down_cents: 20_000_00, target_payment_cents: 900_00 },
    assumptions: {
      tax_rate: 0.0625, fees_cents: 1_000_00,
      new: { label: 'Test Finance', apr: 1.9, months: 60 }, used: { label: 'a used loan', apr: 6.5, months: 60 }
    },
    cars: [
      car(1, { status: 'negotiating', quote_otd_cents: 62_000_00, first_quote_otd_cents: 64_000_00, our_offer_otd_cents: 60_500_00, notes: ['Itemized worksheet received.'] }),
      car(2, { title: '2024 Test <b>Wagon</b> & Co', condition: 'Used', finance: 'used', quote_sale_cents: 50_000_00, status: 'quoted' }),
      car(3),
      car(4, { status: 'dropped', quote_otd_cents: 90_000_00 })
    ],
    activity: [{ at: '2026-11-04T18:00:00Z', text: 'Dealer 1 sent a worksheet.' }],
    ...overrides
  };
}

test('payment matches a standard amortization', () => {
  // $20,000 at 6% for 60 months is the textbook $386.66.
  assert.equal(estimatePayment({ financedCents: 20_000_00, aprPercent: 6, months: 60 }), 38666);
  assert.equal(estimatePayment({ financedCents: 12_000_00, aprPercent: 0, months: 60 }), 20000);
  assert.equal(estimatePayment({ financedCents: 0, aprPercent: 6, months: 60 }), 0);
  assert.equal(estimatePayment({ financedCents: -5_00, aprPercent: 6, months: 60 }), 0);
});

test('dealer quotes are used as given and other cars are estimated from the dealer price or listing', () => {
  const { cars } = analyze(fixture());
  const [quoted, dealerPriced, listing] = cars;
  assert.equal(quoted.otd, 62_000_00);
  assert.equal(quoted.hasQuote, true);
  // $50,000 sale price plus 6.25% tax plus $1,000 of fees.
  assert.equal(dealerPriced.otd, 50_000_00 * 1.0625 + 1_000_00);
  assert.equal(dealerPriced.dealerPrice, true);
  assert.equal(dealerPriced.hasQuote, false);
  assert.equal(listing.otd, 60_000_00 * 1.0625 + 1_000_00);
  assert.equal(listing.dealerPrice, false);
});

test('a credit that is not in the quote lowers the payment, and one already in the quote does not', () => {
  const base = analyze(fixture()).cars[0];
  const data = fixture();
  data.cars[0].credits = [{ label: 'Finance credit', cents: 1_000_00, in_quote: false }, { label: 'Loyalty', cents: 2_000_00, in_quote: true }];
  const credited = analyze(data).cars[0];
  assert.equal(credited.otdAfterCredits, base.otd - 1_000_00);
  assert.ok(credited.payment < base.payment);
});

test('the dropped car stays out of the summary numbers and the chart', () => {
  const a = analyze(fixture());
  assert.equal(a.live.length, 3);
  assert.equal(a.priced.length, 2);
  assert.equal(a.best.rank, 2);
  const { html } = renderDealUpdateEmail(fixture());
  assert.doesNotMatch(html.slice(html.indexOf('Estimated monthly payment'), html.indexOf('Cars with a dealer price')), /Dealer 4/);
});

test('the email is table-based and script-free', () => {
  const { html, text, subject } = renderDealUpdateEmail(fixture());
  assert.match(html, /^<!doctype html>/);
  for (const banned of [/<script/i, /display:\s*flex/i, /display:\s*grid/i, /<svg/i, /<img/i, /<link /i]) assert.doesNotMatch(html, banned);
  assert.match(html, /role="presentation"/);
  assert.match(subject, /2 cars priced/);
  assert.match(text, /Lowest estimated payment: \$\d/);
  assert.ok(subject.length <= 200);
});

test('the same numbers are in the html and the plain-text part', () => {
  const { html, text } = renderDealUpdateEmail(fixture());
  for (const figure of analyze(fixture()).cars.filter(car => car.status !== 'dropped').map(car => `$${new Intl.NumberFormat('en-US').format(Math.round(car.payment / 100))}`)) {
    assert.ok(html.includes(figure), `html has ${figure}`);
    assert.ok(text.includes(figure), `text has ${figure}`);
  }
});

test('nothing private reaches the email, and the word "brief" is never used', () => {
  const { html, text, subject } = renderDealUpdateEmail(fixture());
  for (const decoy of DECOYS) for (const output of [html, text, subject]) assert.ok(!output.includes(decoy), `${decoy} leaked`);
  assert.doesNotMatch(`${html}\n${text}\n${subject}`, /\bbrief/i);
  assert.doesNotMatch(`${html}\n${text}`, /walk.?away/i);
});

test('text from the data is escaped in the html', () => {
  const data = fixture();
  data.cars[1].notes = ['<img src=x onerror=alert(1)>'];
  data.buyer_first_name = '<i>Sam</i>';
  const { html } = renderDealUpdateEmail(data);
  assert.ok(!html.includes('<img'));
  assert.ok(!html.includes('<i>Sam'));
  assert.ok(html.includes('2024 Test &lt;b&gt;Wagon&lt;/b&gt; &amp; Co'));
});

test('only http and https listing links are linked', () => {
  const data = fixture();
  data.cars[0].listing_url = 'javascript:alert(1)';
  data.cars[1].listing_url = 'https://user:pass@example.com/car';
  const { html } = renderDealUpdateEmail(data);
  assert.ok(!html.includes('javascript:'));
  assert.ok(!html.includes('user:pass'));
});

test('every bar width is a percent from 0 to 100, and quoted bars differ from estimated ones', () => {
  const { html } = renderDealUpdateEmail(fixture());
  for (const [, width] of html.matchAll(/<td width="(\d+(?:\.\d+)?)%"/g)) assert.ok(Number(width) >= 0 && Number(width) <= 100, `${width}%`);
  assert.ok(html.includes('bgcolor="#1A4B8C"'));
  assert.ok(html.includes('bgcolor="#B4C7E2"'));
});

test('a payment over the goal gets a second bar past the goal line', () => {
  const data = fixture();
  data.search.target_payment_cents = 300_00;
  const { html } = renderDealUpdateEmail(data);
  assert.match(html, /\$300 goal/);
  assert.match(html, /over your \$300 goal/);
});

test('missing deal data fails with a clear message', () => {
  assert.throws(() => renderDealUpdateEmail({ cars: [] }), /cars list/);
  assert.throws(() => renderDealUpdateEmail({ cars: [{}], search: {} }), /down_cents/);
});
