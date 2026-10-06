import test from 'node:test';
import assert from 'node:assert/strict';
import { createCheckout, createStore, plans, CHECKOUT_KEY } from './checkout.js';
import { validateCheckoutPayload } from '../api/_lib/validation.js';

const memoryStore = () => { let value; return {read:()=>value,write:v=>{value=structuredClone(v);}}; };
const stripe = (attempt = 'attempt') => ({ ok: true, url: 'https://buy.stripe.com/test-direct', attempt_id: attempt });

for (const [tier, plan] of Object.entries(plans)) {
  test(`${plan.name} opens Stripe straight away, with no lead or contact details`, async () => {
    const calls = [];
    const flow = createCheckout({ store: memoryStore(), createId: () => 'direct-key-1', attribution: { first_touch: { utm_source: 'test' } }, sourcePage: '/',
      request: async (url, options) => { calls.push({ url, key: options.headers['Idempotency-Key'], body: JSON.parse(options.body) }); return stripe(); } });
    assert.equal((await flow.start(tier)).url, 'https://buy.stripe.com/test-direct');
    assert.deepEqual(calls.map(call => call.url), ['/api/checkout-start']);
    assert.deepEqual(calls[0].body, { tier, source_page: '/', attribution: { first_touch: { utm_source: 'test' } } });
    assert.equal(validateCheckoutPayload(calls[0].body).lead_id, null);
  });
}

test('a lost response retries the identical key and payload, even after a refresh', async () => {
  const store = memoryStore(), calls = [];
  let count = 0;
  const request = async (url, options) => { calls.push({ key: options.headers['Idempotency-Key'], body: options.body }); if (++count === 1) throw new Error('response lost'); return stripe(); };
  const options = { store, request, createId: () => crypto.randomUUID(), attribution: { first_touch: { utm_source: 'original' } } };
  await assert.rejects(createCheckout(options).start('concierge'), /response lost/);
  await createCheckout({ ...options, attribution: { first_touch: { utm_source: 'new' } } }).start('concierge');
  assert.equal(calls[0].key, calls[1].key);
  assert.equal(calls[0].body, calls[1].body);
});

test('a double click is coalesced into one request', async () => {
  let requests = 0;
  const flow = createCheckout({ store: memoryStore(), createId: () => crypto.randomUUID(), attribution: {}, request: async () => { requests++; return stripe(); } });
  await Promise.all([flow.start('full_service'), flow.start('full_service')]);
  assert.equal(requests, 1);
});

test('a stale offer needs another click with a new key and keeps the old attempt', async () => {
  const store = memoryStore(), keys = [], events = [];
  let attempts = 0;
  const options = { store, createId: () => crypto.randomUUID(), attribution: {}, track: (...event) => events.push(event), request: async (url, options) => {
    keys.push(options.headers['Idempotency-Key']);
    if (++attempts === 1) { const error = new Error('stale_offer'); error.code = 'stale_offer'; throw error; }
    return stripe('new-attempt');
  } };
  await assert.rejects(createCheckout(options).start('full_service'), error => error.code === 'stale_offer' && /\$395 USD.*Restart checkout/.test(error.message));
  await createCheckout(options).start('full_service');
  assert.notEqual(keys[0], keys[1]);
  assert.equal(store.read().checkouts.length, 2);
  assert.equal(store.read().checkouts[0].stale, true);
  assert.equal(events.filter(event => event[0] === 'begin_checkout').length, 1);
});

test('retired consultation and non-HTTPS links never open', async () => {
  let called = false;
  const retired = createCheckout({ store: memoryStore(), request: () => { called = true; }, createId: () => crypto.randomUUID(), attribution: {} });
  await assert.rejects(retired.start('consultation'), /Full Service or Ultimate Concierge/);
  assert.equal(called, false);
  const insecure = createCheckout({ store: memoryStore(), request: async () => ({ ok: true, url: 'http://buy.stripe.com/x' }), createId: () => crypto.randomUUID(), attribution: {} });
  await assert.rejects(insecure.start('full_service'), /could not be confirmed/);
});

test('begin_checkout is saved, then gets its tag before the Stripe URL returns', async () => {
  const calls = [], store = memoryStore();
  let release, returned = false;
  const flow = createCheckout({ store, createId: () => crypto.randomUUID(), attribution: {},
    track: (...args) => { calls.push(args); return new Promise(resolve => { release = resolve; }); },
    request: async () => stripe('attempt-2') });
  const started = flow.start('full_service').then(result => { returned = true; return result; });
  for (let i = 0; i < 50 && !release; i++) await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(calls.at(-1), ['begin_checkout', { service_tier: 'full_service', checkout_attempt_id: 'attempt-2', direct: true }, { beforeNavigation: true }]);
  assert.equal(store.read().checkouts.at(-1).tracked, true);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(returned, false);
  release();
  assert.equal((await started).url, 'https://buy.stripe.com/test-direct');
});

test('a failing or old begin_checkout tracker never blocks the checkout URL', async () => {
  for (const track of [() => { throw new Error('tag failed'); }, () => Promise.reject(new Error('tag failed')), () => undefined]) {
    const flow = createCheckout({ store: memoryStore(), createId: () => crypto.randomUUID(), attribution: {}, track, request: async () => stripe('attempt-3') });
    assert.equal((await flow.start('concierge')).url, 'https://buy.stripe.com/test-direct');
  }
});

test('contact details an earlier version saved are dropped on the next write', async () => {
  const store = memoryStore();
  store.write({ version: 1, leads: [{ payload: { email: 'ada@example.test' } }], checkouts: [], contact: { name: 'Ada', email: 'ada@example.test' } });
  await createCheckout({ store, createId: () => crypto.randomUUID(), attribution: {}, request: async () => stripe() }).start('full_service');
  assert.deepEqual(Object.keys(store.read()).sort(), ['checkouts', 'version']);
  assert.doesNotMatch(JSON.stringify(store.read()), /ada@example/);
});

test('the store lasts for the visit and clears a copy an earlier version kept on the device', () => {
  let session = null;
  const local = new Map([[CHECKOUT_KEY, '{}']]);
  const w = {
    localStorage: { removeItem: key => local.delete(key) },
    sessionStorage: { getItem() { return session; }, setItem(key, value) { session = value; } },
  };
  const store = createStore(w);
  assert.equal(local.size, 0);
  assert.equal(store.read(), null);
  store.write({ version: 1, checkouts: [] });
  assert.deepEqual(JSON.parse(session), { version: 1, checkouts: [] });
});

test('denied storage falls back to history, and damaged JSON is ignored', () => {
  const history = { state: null, replaceState(value) { this.state = value; } };
  const w = { history };
  Object.defineProperty(w, 'localStorage', { get() { throw new Error('denied'); } });
  Object.defineProperty(w, 'sessionStorage', { get() { throw new Error('denied'); } });
  createStore(w).write({ version: 1, checkouts: [{ tier: 'concierge' }] });
  assert.equal(createStore(w).read().checkouts[0].tier, 'concierge');
  assert.equal(createStore({ sessionStorage: { getItem() { return '{bad'; } } }).read(), null);
});
