import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { createOpenAIAds } from '../../openai-ads.js';
import { AD_CONSENT_KEY, readAdConsent } from '../../ad-consent.js';

test('saved consent expires and rejects malformed or future-dated choices', () => {
  const now = Date.now();
  const read = value => readAdConsent({ getItem(key) { assert.equal(key, AD_CONSENT_KEY); return JSON.stringify(value); } }, now);
  for (const measurement of [true, false]) {
    assert.equal(read({ version: 1, measurement, savedAt: now }).measurement, measurement);
  }
  for (const value of [null, {}, { version: 1, measurement: 'true', savedAt: now },
    { version: 1, measurement: true, savedAt: now + 1 },
    { version: 1, measurement: true, savedAt: now - 180 * 86400000 }]) assert.equal(read(value), null);
  assert.equal(readAdConsent({ getItem() { throw Error('storage blocked'); } }), null);
  assert.equal(readAdConsent({ getItem() { return 'not json'; } }), null);
});

function fixture({ pixelId = 'test-pixel', hostname = 'www.driverightcarbuying.com', pathname = '/', search = '', hash = '', verified = false, gpc = false, storageBlocked = false } = {}) {
  const scripts = [];
  const storage = new Map();
  const w = {
    location: { hostname, pathname, search, hash }, navigator: { globalPrivacyControl: gpc },
    sessionStorage: {
      getItem(key) { if (storageBlocked) throw Error('blocked'); return storage.get(key); },
      setItem(key, value) { if (storageBlocked) throw Error('blocked'); storage.set(key, value); }
    }
  };
  const d = { body: { dataset: { purchaseVerified: verified ? 'true' : 'false' } }, createElement: () => ({}), head: { appendChild: script => scripts.push(script) } };
  const ads = createOpenAIAds(w, d, pixelId);
  return { w, d, ads, scripts, calls: () => (w.oaiq?.q || []).map(args => Array.from(args)) };
}

test('no SDK or events without both a Pixel ID and explicit consent', () => {
  for (const pixelId of ['', 'test-pixel']) {
    const f = fixture({ pixelId });
    f.ads.track('generate_lead', { lead_id: 'a' });
    f.ads.setConsent({ measurement: false });
    assert.equal(f.scripts.length, 0);
    if (!pixelId) {
      f.ads.setConsent({ measurement: true });
      assert.equal(f.scripts.length, 0);
    }
  }
});

test('production only; GPC and unverified payment/success pages suppress all measurement', () => {
  for (const options of [{ hostname: 'localhost' }, { hostname: 'preview.vercel.app' }, { gpc: true },
    { pathname: '/payment-success.html' }, { pathname: '/payment-success-fullservice.html' }, { pathname: '/success.html' }]) {
    const f = fixture(options);
    f.ads.setConsent({ measurement: true, personalization: true });
    f.ads.track('generate_lead', { lead_id: 'a' });
    assert.equal(f.scripts.length, 0);
  }
});

test('initializes once and maps only confirmed events, with stable IDs and no form data', () => {
  const f = fixture();
  f.ads.track('generate_lead', { lead_id: 'before-consent' });
  f.ads.setConsent({ measurement: true });
  f.ads.setConsent({ measurement: true });
  f.ads.track('generate_lead', { lead_id: 'abc', email: 'private@example.com', message: 'private message' });
  f.ads.track('generate_lead', { lead_id: 'abc' });
  f.ads.track('begin_checkout', { checkout_attempt_id: 'xyz' });
  f.ads.track('begin_checkout', { checkout_attempt_id: 'xyz' });
  for (const event of ['cta_click', 'phone_click', 'purchase', 'onboarding_complete', 'generate_lead', 'begin_checkout']) f.ads.track(event);
  // A purchase-shaped event on an ordinary page is not proof of a verified receipt.
  f.ads.track('purchase_verified', { transaction_id: '06a28d37-b5d9-4f0e-a20c-c8e506ef5477', value: 395, currency: 'USD', service_tier: 'full_service' });
  assert.equal(f.scripts.length, 1);
  assert.equal(f.scripts[0].src, 'https://bzrcdn.openai.com/sdk/oaiq.min.js');
  assert.equal(f.scripts[0].async, true);
  assert.equal(f.calls().filter(call => call[0] === 'init').length, 1);
  const events = f.calls().filter(call => call[0] === 'measure');
  assert.deepEqual(events, [
    ['measure', 'page_viewed', { type: 'contents' }, { opt_out: true }],
    ['measure', 'lead_created', { type: 'customer_action' }, { opt_out: true, event_id: 'lead:abc' }],
    ['measure', 'checkout_started', { type: 'contents' }, { opt_out: true, event_id: 'checkout:xyz' }]
  ]);
});

const purchase = { transaction_id: '06a28d37-b5d9-4f0e-a20c-c8e506ef5477', value: 395, currency: 'USD' };

test('a consented verified receipt reports the paid amount in cents once, without a page view or checkout bearer', () => {
  const f = fixture({ pathname: '/payment-success-fullservice.html', verified: true });
  f.ads.setConsent({ measurement: true });
  assert.equal(f.scripts.length, 0, 'receipt visits never initialize the Pixel by themselves');
  f.ads.track('purchase_verified', { ...purchase, email: 'private@example.com', session_id: 'cs_test_private' });
  f.ads.track('purchase_verified', purchase);
  f.ads.track('generate_lead', { lead_id: 'ignored-on-receipt' });
  f.ads.track('begin_checkout', { checkout_attempt_id: 'ignored-on-receipt' });
  assert.equal(f.scripts.length, 1);
  assert.deepEqual(f.calls().filter(call => call[0] === 'measure'), [
    ['measure', 'order_created', { type: 'contents', amount: 39500, currency: 'USD' }, { opt_out: true, event_id: `purchase:${purchase.transaction_id}` }]
  ]);
  const reloadedWindow = { ...f.w, oaiq: undefined };
  const reloaded = createOpenAIAds(reloadedWindow, f.d, 'test-pixel');
  reloaded.setConsent({ measurement: true });
  reloaded.track('purchase_verified', purchase);
  assert.equal(reloadedWindow.oaiq, undefined, 'the duplicate receipt does not load an SDK');
});

test('receipt purchase tracking requires verification, sanitized address, consent, valid ledger fields and no GPC', () => {
  for (const options of [{ verified: false }, { gpc: true }, { search: '?session_id=cs_test_private' },
    { hash: '#checkout_session_id=cs_test_private' }, { hostname: 'localhost' }, { pathname: '/success.html' }]) {
    const f = fixture({ pathname: '/payment-success-fullservice.html', verified: true, ...options });
    f.ads.setConsent({ measurement: true });
    f.ads.track('purchase_verified', purchase);
    assert.equal(f.scripts.length, 0, JSON.stringify(options));
  }
  for (const invalid of [{ transaction_id: 'cs_test_private' }, { transaction_id: '' }, { value: 0 },
    { value: -395 }, { value: '395' }, { value: Infinity }, { currency: 'usd' }, { currency: 'US' }]) {
    const f = fixture({ pathname: '/payment-success-fullservice.html', verified: true });
    f.ads.setConsent({ measurement: true });
    f.ads.track('purchase_verified', { ...purchase, ...invalid });
    assert.equal(f.scripts.length, 0, JSON.stringify(invalid));
  }
  const declined = fixture({ pathname: '/payment-success-fullservice.html', verified: true });
  declined.ads.track('purchase_verified', purchase);
  declined.ads.setConsent({ measurement: true });
  assert.equal(declined.scripts.length, 0, 'suppressed purchases are not replayed on a later choice');
  const revoked = fixture({ pathname: '/payment-success-fullservice.html', verified: true });
  revoked.ads.setConsent({ measurement: true });
  revoked.ads.track('purchase_verified', purchase);
  revoked.ads.setConsent({ measurement: false });
  assert.equal(revoked.calls().filter(call => call[0] === 'measure').length, 0);
});

test('purchase reporting uses the recorded value, including older receipts and fractional dollar amounts', () => {
  for (const value of [295, 495, 695, 895, 395.12]) {
    const f = fixture({ pathname: '/payment-success-concierge.html', verified: true });
    f.ads.setConsent({ measurement: true });
    f.ads.track('purchase_verified', { ...purchase, value });
    assert.equal(f.calls().find(call => call[1] === 'order_created')[2].amount, Math.round(value * 100));
  }
});

test('withdrawal clears unsent events and does not replay suppressed conversions on regrant', () => {
  const f = fixture();
  f.ads.setConsent({ measurement: true });
  f.ads.track('generate_lead', { lead_id: 'a' });
  f.ads.setConsent({ measurement: false });
  f.ads.track('generate_lead', { lead_id: 'b' });
  assert.equal(f.calls().filter(call => call[0] === 'measure').length, 0);
  f.ads.setConsent({ measurement: true, personalization: true });
  f.ads.track('generate_lead', { lead_id: 'c' });
  assert.deepEqual(f.calls().filter(call => call[0] === 'measure'), [
    ['measure', 'lead_created', { type: 'customer_action' }, { opt_out: false, event_id: 'lead:c' }]
  ]);
  assert.equal(f.scripts.length, 1);
});

test('blocked storage, SDK exceptions, network errors, and duplicate ownership do not throw', () => {
  const f = fixture({ storageBlocked: true });
  f.ads.setConsent({ measurement: true });
  f.ads.track('generate_lead', { lead_id: 'a' });
  f.ads.track('generate_lead', { lead_id: 'a' });
  assert.equal(f.calls().filter(call => call[1] === 'lead_created').length, 1);
  f.w.oaiq = () => { throw Error('SDK failed'); };
  assert.doesNotThrow(() => f.ads.track('generate_lead', { lead_id: 'b' }));
  const network = fixture();
  network.ads.setConsent({ measurement: true });
  network.scripts[0].onerror();
  network.ads.track('generate_lead', { lead_id: 'c' });
  assert.deepEqual(network.calls(), []);
  const duplicate = fixture();
  duplicate.w.oaiq = () => { throw Error('other owner'); };
  assert.doesNotThrow(() => duplicate.ads.setConsent({ measurement: true }));
  assert.equal(duplicate.scripts.length, 0);
});

test('real hero flow tracks accepted leads and checkout attempts only after successful API responses', async () => {
  const source = (await readFile(new URL('../../script.js', import.meta.url), 'utf8'))
    .replace(/^const openAIAds = [^\n]+\n/, '')
    .replace(/^import\([^\n]+\)\.catch\(\(\) => \{\}\);\n/gm, '');
  for (const outcome of ['lead-fails', 'checkout-fails', 'success']) {
    const events = [], requests = [], navigations = [], listeners = {};
    const status = { setAttribute() {} };
    const hero = { dataset: {}, addEventListener: (event, handler) => { listeners[event] = handler; }, querySelector: () => status };
    const button = { dataset: {}, textContent: 'Submit', setAttribute() {} };
    const context = {
      openAIAds: { track: (event, properties) => events.push({ event, properties, requests: [...requests] }) },
      document: {
        body: { dataset: {} }, referrer: '',
        getElementById: id => ({ 'hero-form': hero, 'hero-submit': button }[id] || null),
        querySelectorAll: () => []
      },
      window: { dataLayer: [], location: { pathname: '/', search: '', assign: url => navigations.push(url) },
        addEventListener() {}, setTimeout, clearTimeout,
        localStorage: { getItem() {}, setItem() {} }, sessionStorage: { getItem() {}, setItem() {}, removeItem() {} } },
      FormData: class { forEach(fn) { fn('Test Buyer', 'name'); fn('test@example.com', 'email'); } },
      URLSearchParams, URL, AbortController, setTimeout,
      fetch: async url => {
        requests.push(url);
        const fails = (url === '/api/leads' && outcome === 'lead-fails') || (url === '/api/checkout-start' && outcome === 'checkout-fails');
        return { ok: !fails, status: fails ? 500 : 200,
          json: async () => fails ? { ok: false } : { ok: true, lead_id: 'lead-id', attempt_id: 'attempt-id', url: 'https://checkout.stripe.com/test' } };
      }
    };
    vm.runInNewContext(source, context);
    await listeners.submit({ preventDefault() {} });
    assert.deepEqual(events.map(item => item.event), outcome === 'lead-fails' ? [] : outcome === 'checkout-fails' ? ['generate_lead'] : ['generate_lead', 'begin_checkout']);
    if (events[0]) assert.equal(events[0].requests.at(-1), '/api/leads');
    if (events[1]) assert.equal(events[1].requests.at(-1), '/api/checkout-start');
    assert.equal(navigations.length, outcome === 'success' ? 1 : 0);
  }
});
