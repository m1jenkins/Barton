import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../../script.js', import.meta.url), 'utf8');
const purchaseId = '06a28d37-b5d9-4f0e-a20c-c8e506ef5477';
const sessionId = 'cs_test_a1B2c3D4e5F6g7H8';
const verified = { ok: true, verified: true, tier: 'full_service', purchase_id: purchaseId, value: 395, currency: 'USD' };
const processing = { ok: true, verified: false, tier: 'full_service', status: 'processing' };
const storage = () => { const values = new Map(); return { getItem: k => values.get(k) ?? null, setItem: (k, v) => values.set(k, String(v)), removeItem: k => values.delete(k) }; };

// The real confirmation-page script: data-purchase-tier, a Stripe session link and a
// stubbed purchase-status API. Each response is a JSON body, { httpStatus, body }, or
// an Error for a network failure; the last one repeats. Retry backoff runs at once.
function paymentPage(responses, { session = storage(), tier = 'full_service' } = {}) {
  const requests = [], delays = [];
  const gate = { dataset: { state: 'pending' }, hidden: false, querySelector: () => null };
  const content = { hidden: true };
  const body = { dataset: { purchaseTier: tier } };
  const window = {
    location: new URL(`https://www.driverightcarbuying.com/payment-success-fullservice.html?session_id=${sessionId}`),
    localStorage: storage(), sessionStorage: session, crypto, dataLayer: [], addEventListener() {}, setTimeout, clearTimeout
  };
  const document = {
    referrer: 'https://checkout.stripe.com/', body,
    getElementById: id => ({ 'payment-verification': gate, 'verified-purchase-content': content })[id] || null,
    querySelectorAll: () => []
  };
  const fetch = async url => {
    requests.push(url);
    const next = responses[Math.min(requests.length, responses.length) - 1];
    if (next instanceof Error) throw next;
    const status = next.httpStatus || 200;
    return { ok: status < 400, status, json: async () => JSON.parse(JSON.stringify(next.httpStatus ? next.body : next)) };
  };
  const retryTimeout = (fn, ms) => { delays.push(ms); return setTimeout(fn, 0); };
  vm.runInNewContext(source, { window, document, URL, URLSearchParams, Date, Set, setTimeout: retryTimeout, clearTimeout, console, crypto, AbortController, fetch });
  const settled = async () => {
    // Wait on the clock, not a turn count: five 1 ms retry timers can outlast 500 immediates on a slow CI runner.
    const deadline = Date.now() + 5000;
    while (!['verified', 'error'].includes(gate.dataset.state) && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 1));
    return gate.dataset.state;
  };
  return { window, body, content, requests, delays, settled, purchases: () => window.dataLayer.filter(item => item.event === 'purchase_verified') };
}

test('a verified purchase-status response sends one purchase_verified with the server values only', async () => {
  const p = paymentPage([verified]);
  assert.equal(await p.settled(), 'verified');
  assert.equal(p.content.hidden, false);
  assert.equal(p.body.dataset.purchaseVerified, 'true');
  assert.equal(JSON.stringify(p.body.dataset).includes(sessionId), false);
  assert.deepEqual(p.requests, [`/api/purchase-status?session_id=${sessionId}&tier=full_service`]);
  assert.equal(p.window.dataLayer.length, 1);
  const [event] = p.purchases();
  assert.equal(event.event_id, `purchase_verified:${purchaseId}`);
  assert.equal(event.transaction_id, purchaseId);
  assert.equal(event.value, 395);
  assert.equal(event.currency, 'USD');
  assert.equal(event.service_tier, 'full_service');
  assert.equal(event.page_type, 'payment_confirmation');
  // Attribution and page context only: no contact data, session ID or GTM callback.
  assert.deepEqual(Object.keys(event).sort(), ['city', 'currency', 'event', 'event_id',
    'first_touch_campaign', 'first_touch_landing_path', 'first_touch_medium', 'first_touch_referrer', 'first_touch_source',
    'last_touch_campaign', 'last_touch_landing_path', 'last_touch_medium', 'last_touch_referrer', 'last_touch_source',
    'page_type', 'service_tier', 'topic_cluster', 'transaction_id', 'value']);
  assert.equal(JSON.stringify(p.window.dataLayer).includes(sessionId), false);
});

test('the purchase keeps its recorded value and tier, including historical $295, $495 and $895 receipts', async () => {
  for (const value of [295, 495]) {
    const p = paymentPage([{ ...verified, value }]);
    assert.equal(await p.settled(), 'verified');
    assert.equal(p.purchases()[0].value, value);
  }
  for (const value of [695, 895]) {
    const concierge = paymentPage([{ ...verified, tier: 'concierge', value }], { tier: 'concierge' });
    assert.equal(await concierge.settled(), 'verified');
    assert.equal(concierge.purchases()[0].service_tier, 'concierge');
    assert.equal(concierge.purchases()[0].value, value);
  }
});

test('reloading the confirmation page in the same browser session does not resend the purchase', async () => {
  const session = storage();
  const first = paymentPage([verified], { session });
  assert.equal(await first.settled(), 'verified');
  assert.equal(first.purchases().length, 1);
  const reload = paymentPage([verified], { session });
  assert.equal(await reload.settled(), 'verified');
  assert.equal(reload.purchases().length, 0);
  assert.equal(reload.window.dataLayer.length, 0);
  const another = paymentPage([{ ...verified, purchase_id: 'f5dbf6c1-fb6c-4452-9190-a440527bad07' }], { session });
  assert.equal(await another.settled(), 'verified');
  assert.equal(another.purchases().length, 1, 'a different purchase is still reported');
});

test('processing retries report the purchase once, only after it verifies', async () => {
  const p = paymentPage([processing, processing, verified]);
  assert.equal(await p.settled(), 'verified');
  assert.equal(p.requests.length, 3);
  assert.deepEqual(p.delays, [1000, 2000]);
  assert.equal(p.purchases().length, 1);
  const stuck = paymentPage([processing]);
  assert.equal(await stuck.settled(), 'error');
  assert.equal(stuck.requests.length, 5);
  assert.equal(stuck.window.dataLayer.length, 0);
});

test('unverified, not_found and failed status checks never report a purchase', async () => {
  for (const [name, response, attempts] of [
    ['unverified', { ok: true, verified: false, tier: 'full_service', status: 'unverified' }, 1],
    ['not_found', { ok: true, verified: false, tier: 'full_service', status: 'not_found' }, 1],
    ['network error', new TypeError('Failed to fetch'), 5],
    ['server error', { httpStatus: 500, body: { ok: false, error: 'server_error' } }, 5],
    ['rejected request', { httpStatus: 400, body: { ok: false, error: 'invalid_session_id' } }, 1]
  ]) {
    const p = paymentPage([response]);
    assert.equal(await p.settled(), 'error', name);
    assert.equal(p.requests.length, attempts, name);
    assert.equal(p.window.dataLayer.length, 0, name);
  }
});

test('a verified response without a valid purchase ID, value or currency is not reported', async () => {
  const { value, ...withoutValue } = verified;
  const { currency, ...withoutCurrency } = verified;
  const { purchase_id: id, ...withoutId } = verified;
  assert.ok(value && currency && id);
  for (const response of [
    withoutValue, { ...verified, value: 0 }, { ...verified, value: -395 }, { ...verified, value: '395' }, { ...verified, value: null },
    withoutId, { ...verified, purchase_id: sessionId }, { ...verified, purchase_id: 'purchase-1' },
    withoutCurrency, { ...verified, currency: 'usd' }, { ...verified, currency: 'US' }, { ...verified, currency: 'USDX' },
    { ...verified, verified: 'true' }
  ]) {
    const p = paymentPage([response]);
    assert.equal(await p.settled(), 'verified', JSON.stringify(response));
    assert.equal(p.window.dataLayer.length, 0, JSON.stringify(response));
  }
});
