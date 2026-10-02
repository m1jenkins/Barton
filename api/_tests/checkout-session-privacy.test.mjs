import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile, readdir } from 'node:fs/promises';
import { createOpenAIAds } from '../../openai-ads.js';

// Stripe returns buyers to the payment pages with the Checkout Session ID in the URL, and that
// ID also unlocks the one-time intake. GTM runs the Google tag and Clarity on these pages, so the
// ID must leave the address before GTM loads and never be written into the recorded DOM.
const root = new URL('../../', import.meta.url);
const read = file => readFile(new URL(file, root), 'utf8');
const source = await read('script.js');
const origin = 'https://www.driverightcarbuying.com';
const sessionId = 'cs_test_a1B2c3D4e5F6g7H8';
const purchaseId = '06a28d37-b5d9-4f0e-a20c-c8e506ef5477';
const verified = { ok: true, verified: true, tier: 'full_service', purchase_id: purchaseId, value: 295, currency: 'USD' };
const key = path => `drive_right_checkout_session:${path}`;
const pages = (await readdir(root)).filter(name => /^payment-success[a-z-]*\.html$/.test(name)).sort();
const headScript = html => {
  const head = html.slice(html.indexOf('<head>'), html.indexOf('</head>'));
  return head.match(/<script>([\s\S]*?)<\/script>/)[1];
};
const inlineScript = headScript(await read('payment-success-fullservice.html'));

const storage = (values = new Map()) => ({
  values,
  getItem: k => values.get(k) ?? null,
  setItem: (k, v) => values.set(k, String(v)),
  removeItem: k => values.delete(k)
});
const blocked = () => ({ getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); }, removeItem() {} });

// One browser tab: the address, its history entry and sessionStorage, shared by the inline head
// script and script.js the way a real page shares them.
function tab(url, { session = storage() } = {}) {
  const location = new URL(url);
  const replaced = [];
  const history = {
    state: null,
    replaceState(state, title, next) { this.state = state; location.href = new URL(next, location.href).href; replaced.push(location.href); }
  };
  const window = { location, history, sessionStorage: session, localStorage: storage(), crypto, dataLayer: [], addEventListener() {}, setTimeout, clearTimeout };
  return { window, location, history, replaced, session };
}

function runHeadScript(t) {
  const { window } = t;
  vm.runInNewContext(inlineScript, { window, location: window.location, history: window.history, sessionStorage: window.sessionStorage, URLSearchParams });
}

// script.js on a payment page, with stubbed purchase-status and onboarding APIs.
function runPage(t, { tier = 'full_service', responses = [verified], adMeasurement } = {}) {
  const requests = [];
  const gate = { dataset: { state: 'pending' }, hidden: false, querySelector: () => null };
  const content = { hidden: true };
  const body = { dataset: { purchaseTier: tier } };
  const listeners = {};
  const form = { hidden: false, addEventListener: (type, fn) => { listeners[type] = fn; }, querySelector: () => null, appendChild() {} };
  const button = { dataset: {}, textContent: 'Submit', setAttribute() {} };
  const success = { style: {}, scrollIntoView() {} };
  const elements = { 'payment-verification': gate, 'verified-purchase-content': content, 'onboarding-form': form, 'onboarding-submit': button, 'onboarding-success': success };
  const document = {
    referrer: 'https://checkout.stripe.com/', body,
    getElementById: id => elements[id] || null,
    querySelectorAll: () => [],
    createElement: () => ({ dataset: {}, setAttribute() {} })
  };
  const sdkScripts = [];
  if (adMeasurement !== undefined) {
    document.head = { appendChild: script => sdkScripts.push(script) };
    t.window.navigator = { globalPrivacyControl: false };
    t.window.driveRightOpenAIAds = createOpenAIAds(t.window, document, 'test-pixel');
    t.window.driveRightOpenAIAds.setConsent({ measurement: adMeasurement });
  }
  const fetch = async (url, options = {}) => {
    requests.push({ url, method: options.method || 'GET', body: options.body ? JSON.parse(options.body) : null });
    if (url === '/api/onboarding') return { ok: true, status: 200, json: async () => ({ ok: true, onboarding_id: 'b3c1a1d2-0000-4000-8000-000000000001' }) };
    const next = responses[Math.min(requests.length, responses.length) - 1];
    return { ok: true, status: 200, json: async () => JSON.parse(JSON.stringify(next)) };
  };
  class FormData { forEach(fn) { fn('Test Buyer', 'name'); fn('buyer@example.test', 'email'); } }
  vm.runInNewContext(source, { window: t.window, document, URL, URLSearchParams, Date, Set, setTimeout: fn => setTimeout(fn, 0), clearTimeout, console, crypto, AbortController, fetch, FormData });
  const settled = async () => {
    for (let i = 0; i < 500 && !['verified', 'error'].includes(gate.dataset.state); i++) await new Promise(resolve => setImmediate(resolve));
    return gate.dataset.state;
  };
  const submit = async () => { await listeners.submit({ preventDefault() {} }); return requests.at(-1); };
  return { body, gate, form, requests, settled, submit, dataLayer: t.window.dataLayer, sdkScripts };
}

test('the real payment verifier reports an OpenAI purchase only for consented paid receipts after address sanitization', async () => {
  for (const [adMeasurement, responses, expected] of [[true, [verified], 1], [false, [verified], 0],
    [true, [{ ok: true, verified: false, status: 'unverified' }], 0]]) {
    const t = tab(`${origin}/payment-success-fullservice.html?session_id=${sessionId}`);
    runHeadScript(t);
    const page = runPage(t, { adMeasurement, responses });
    await page.settled();
    const calls = (t.window.oaiq?.q || []).map(args => Array.from(args));
    const purchases = calls.filter(call => call[1] === 'order_created');
    assert.equal(purchases.length, expected);
    assert.equal(page.sdkScripts.length, expected);
    assert.equal(calls.filter(call => call[1] === 'page_viewed').length, 0);
    assert.equal(JSON.stringify(calls).includes(sessionId), false);
    if (expected) {
      assert.equal(purchases[0][2].amount, 29500);
      assert.equal(purchases[0][3].event_id, `purchase:${purchaseId}`);
      assert.equal(purchases[0][3].opt_out, true);
    }
  }
});

test('every payment page moves the session ID out of the URL before GTM loads', async () => {
  assert.deepEqual(pages, ['payment-success-concierge.html', 'payment-success-consultant.html', 'payment-success-fullservice.html', 'payment-success.html']);
  for (const page of pages) {
    const html = await read(page);
    const head = html.slice(html.indexOf('<head>'), html.indexOf('</head>'));
    assert.match(html, /<body\b[^>]*\bdata-purchase-tier="(?:full_service|concierge|consultation)"/, page);
    assert.equal(headScript(html), inlineScript, `${page} carries the same inline script`);
    const first = head.indexOf('<script');
    assert.equal(head.indexOf('<script>'), first, `${page}: the inline script is the first script in <head>`);
    assert.ok(first < head.indexOf('googletagmanager.com/gtm.js'), `${page}: it runs before the GTM loader`);
    assert.ok(head.indexOf('<meta charset="UTF-8">') < first, `${page}: charset stays first`);
  }
  assert.match(inlineScript, /'drive_right_checkout_session:' \+ location\.pathname/);
  assert.match(source, /`drive_right_checkout_session:\$\{window\.location\.pathname\}`/);
});

test('the head script keeps the rest of the URL and stores query, fragment and legacy IDs', () => {
  for (const [url, address] of [
    [`/payment-success-fullservice.html?session_id=${sessionId}`, '/payment-success-fullservice.html'],
    [`/payment-success-fullservice.html?utm_source=stripe&session_id=${sessionId}&utm_medium=email`, '/payment-success-fullservice.html?utm_source=stripe&utm_medium=email'],
    [`/payment-success-fullservice.html#session_id=${sessionId}`, '/payment-success-fullservice.html'],
    [`/payment-success-fullservice.html?checkout_session_id=${sessionId}#payment-verification`, '/payment-success-fullservice.html#payment-verification'],
    [`/payment-success-fullservice.html?session_id=${sessionId}&checkout_session_id=cs_test_other123456`, '/payment-success-fullservice.html']
  ]) {
    const t = tab(origin + url);
    runHeadScript(t);
    assert.equal(t.location.href, origin + address, url);
    assert.deepEqual(t.replaced, [origin + address], url);
    assert.deepEqual([...t.session.values], [[key('/payment-success-fullservice.html'), sessionId]], url);
    assert.equal(t.window.driveRightCheckoutSession, undefined, url);
  }
});

test('the head script leaves pages without an ID untouched and drops an empty one', () => {
  const plain = tab(`${origin}/payment-success-fullservice.html?utm_source=stripe#payment-verification`);
  runHeadScript(plain);
  assert.deepEqual(plain.replaced, []);
  assert.equal(plain.session.values.size, 0);
  const empty = tab(`${origin}/payment-success-fullservice.html?session_id=&utm_source=stripe`);
  runHeadScript(empty);
  assert.equal(empty.location.href, `${origin}/payment-success-fullservice.html?utm_source=stripe`);
  assert.equal(empty.session.values.size, 0);
});

test('verification and the intake use the moved ID, which stays out of the DOM, data layer and address', async () => {
  const t = tab(`${origin}/payment-success-fullservice.html?session_id=${sessionId}`);
  runHeadScript(t);
  assert.equal(t.location.search, '');
  const page = runPage(t);
  assert.equal(await page.settled(), 'verified');
  assert.deepEqual(page.requests.map(r => r.url), [`/api/purchase-status?session_id=${sessionId}&tier=full_service`]);
  assert.equal(page.body.dataset.purchaseVerified, 'true');
  assert.equal(JSON.stringify(page.body.dataset).includes(sessionId), false);
  assert.equal(page.dataLayer.filter(e => e.event === 'purchase_verified').length, 1);
  assert.equal(JSON.stringify(page.dataLayer).includes(sessionId), false);
  const intake = await page.submit();
  assert.equal(intake.url, '/api/onboarding');
  assert.equal(intake.method, 'POST');
  assert.equal(intake.body.session_id, sessionId);
  assert.equal(intake.body.tier, 'full_service');
  assert.equal(page.form.hidden, true);
  assert.equal(t.location.href, `${origin}/payment-success-fullservice.html`);
});

test('a reload in the same tab verifies again from sessionStorage', async () => {
  const first = tab(`${origin}/payment-success-concierge.html?session_id=${sessionId}`);
  runHeadScript(first);
  assert.equal(await runPage(first, { tier: 'concierge' }).settled(), 'verified');
  const reload = tab(first.location.href, { session: first.session });
  runHeadScript(reload);
  assert.deepEqual(reload.replaced, []);
  const page = runPage(reload, { tier: 'concierge', responses: [{ ...verified, tier: 'concierge', value: 895 }] });
  assert.equal(await page.settled(), 'verified');
  assert.deepEqual(page.requests.map(r => r.url), [`/api/purchase-status?session_id=${sessionId}&tier=concierge`]);
});

test('script.js still verifies and cleans the address when the head script did not run', async () => {
  for (const [url, address] of [
    [`/payment-success-consultant.html?utm_source=stripe&session_id=${sessionId}`, '/payment-success-consultant.html?utm_source=stripe'],
    [`/payment-success-consultant.html#session_id=${sessionId}`, '/payment-success-consultant.html'],
    [`/payment-success-consultant.html?checkout_session_id=${sessionId}`, '/payment-success-consultant.html']
  ]) {
    const t = tab(origin + url);
    const page = runPage(t, { tier: 'consultation', responses: [{ ...verified, tier: 'consultation', value: 495 }] });
    assert.equal(await page.settled(), 'verified', url);
    assert.deepEqual(page.requests.map(r => r.url), [`/api/purchase-status?session_id=${sessionId}&tier=consultation`], url);
    assert.equal(t.location.href, origin + address, url);
    assert.equal(t.session.getItem(key('/payment-success-consultant.html')), sessionId, url);
  }
});

test('blocked storage keeps the ID in memory for the current page load', async () => {
  const t = tab(`${origin}/payment-success.html?session_id=${sessionId}`, { session: blocked() });
  runHeadScript(t);
  assert.equal(t.location.href, `${origin}/payment-success.html`);
  assert.equal(t.window.driveRightCheckoutSession, sessionId);
  const page = runPage(t);
  assert.equal(await page.settled(), 'verified');
  assert.equal((await page.submit()).body.session_id, sessionId);
});

test('stored IDs are per page, and a new return from Stripe replaces the stored one', async () => {
  const session = storage(new Map([[key('/payment-success-concierge.html'), sessionId]]));
  const other = tab(`${origin}/payment-success-fullservice.html`, { session });
  runHeadScript(other);
  const missing = runPage(other);
  assert.equal(await missing.settled(), 'error');
  assert.deepEqual(missing.requests, []);

  const fresh = 'cs_test_n3wS3ssion9876';
  session.setItem(key('/payment-success-fullservice.html'), 'cs_test_olderSession1234');
  const t = tab(`${origin}/payment-success-fullservice.html?session_id=${fresh}`, { session });
  runHeadScript(t);
  const page = runPage(t);
  assert.equal(await page.settled(), 'verified');
  assert.deepEqual(page.requests.map(r => r.url), [`/api/purchase-status?session_id=${fresh}&tier=full_service`]);
  assert.equal(session.getItem(key('/payment-success-fullservice.html')), fresh);
});

test('the buying app waits for the non-secret verified flag that script.js sets', async () => {
  const app = await read('buying/app.js');
  assert.match(source, /document\.body\.dataset\.purchaseVerified="true"/);
  assert.match(app, /document\.body\.dataset\.purchaseVerified !== 'true'/);
  assert.match(app, /attributeFilter:\['data-purchase-verified'\]/);
  for (const [name, text] of [['script.js', source], ['buying/app.js', app]]) {
    assert.doesNotMatch(text, /verifiedSessionId|verified-session-id/, name);
  }
});
