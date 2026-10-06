import test from 'node:test';
import assert from 'node:assert/strict';
import { MEASUREMENT_OPT_OUT_COOKIE, initializePrivacyChoices, measurementOptedOut } from '../../privacy-choices.js';
import { MEASUREMENT_OPT_OUT_COOKIE as SERVER_COOKIE, measurementDeclined, trackOpenAIAdsConversion } from '../_lib/openai-ads-capi.js';
import { createOpenAIAds } from '../../openai-ads.js';
import { createWebAnalytics } from '../../web-analytics.js';

test('browser and server read the same opt-out cookie, and only its exact value', () => {
  assert.equal(SERVER_COOKIE, MEASUREMENT_OPT_OUT_COOKIE);
  for (const cookie of ['dr_ad_measurement=off', 'a=1; dr_ad_measurement=off', 'dr_ad_measurement=off; b=2']) {
    assert.equal(measurementOptedOut(cookie), true);
    assert.equal(measurementDeclined({ headers: { cookie } }), true);
  }
  for (const cookie of ['', 'dr_ad_measurement=on', 'dr_ad_measurement=offline', 'xdr_ad_measurement=off', undefined]) {
    assert.equal(measurementOptedOut(cookie), false);
    assert.equal(measurementDeclined({ headers: { cookie } }), false);
  }
  assert.equal(measurementDeclined({ headers: { 'sec-gpc': '1' } }), true);
  assert.equal(measurementDeclined({ headers: {} }), false);
});

// A cookie jar that applies Max-Age=0 like a browser, enough for document.cookie.
function jar(initial = '') {
  const values = new Map(initial ? initial.split('; ').map(pair => pair.split('=')) : []);
  return {
    get cookie() { return [...values].map(pair => pair.join('=')).join('; '); },
    set cookie(value) {
      const [pair, ...attributes] = value.split('; ');
      const [name, cookieValue] = pair.split('=');
      if (attributes.includes('Max-Age=0')) values.delete(name); else values.set(name, cookieValue);
    }
  };
}

function page({ cookie = '', gpc = false, legacy = false, toggle = false } = {}) {
  const events = [], inserted = [];
  const element = tag => ({
    tagName: tag.toUpperCase(), dataset: {}, hidden: tag === 'button', disabled: false, textContent: '', listeners: {},
    appendChild(child) { child.parentElement = this; inserted.push(child); },
    after(node) { inserted.push(node); },
    addEventListener(type, listener) { this.listeners[type] = listener; }
  });
  const policy = element('a');
  policy.parentElement = element(legacy ? 'li' : 'nav');
  const controls = toggle ? { '[data-measurement-toggle]': element('button'), '[data-measurement-status]': element('p') } : {};
  const d = jar(cookie);
  Object.assign(d, {
    visibilityState: 'visible', body: element('body'), createElement: element, addEventListener() {},
    querySelector: selector => ({ 'footer a[href$="policy.html"]': policy, ...controls })[selector] ?? null
  });
  const w = {
    location: { protocol: 'https:', hostname: 'www.driverightcarbuying.com' }, navigator: { globalPrivacyControl: gpc },
    dispatchEvent: event => events.push(event.type), addEventListener() {}
  };
  initializePrivacyChoices(w, d);
  const link = inserted.find(node => 'measurementOptOutLink' in node.dataset);
  return { d, events, inserted, link, ...controls };
}

test('the footer link sits beside Policy in both footer styles and points at the opt-out section', () => {
  const current = page();
  assert.equal(current.link.href, '/policy.html#opt-out');
  assert.equal(current.link.textContent, 'Opt out of ad measurement');
  const legacy = page({ legacy: true });
  assert.equal(legacy.inserted[1].tagName, 'LI');
  assert.equal(legacy.inserted[0].href, '/policy.html#opt-out');
  assert.equal(page({ cookie: 'dr_ad_measurement=off' }).link.textContent, 'Ad measurement is off');
});

test('the policy button opts out, forgets the ad click reference, and opts back in', () => {
  const f = page({ cookie: '__oppref=abc', toggle: true });
  const button = f['[data-measurement-toggle]'], status = f['[data-measurement-status]'];
  assert.equal(button.hidden, false);
  assert.equal(button.textContent, 'Turn off ad measurement');
  button.listeners.click();
  assert.equal(f.d.cookie, 'dr_ad_measurement=off');
  assert.deepEqual(f.events, ['drive-right:measurement-choice']);
  assert.equal(f.link.textContent, 'Ad measurement is off');
  assert.equal(status.textContent, 'Ad measurement is off in this browser.');
  button.listeners.click();
  assert.equal(f.d.cookie, '');
  assert.equal(button.textContent, 'Turn off ad measurement');
  assert.equal(f.events.length, 2);
});

test('under Global Privacy Control the choice is already off and cannot be turned on', () => {
  const f = page({ gpc: true, toggle: true });
  assert.equal(f['[data-measurement-toggle]'].disabled, true);
  assert.equal(f.link.textContent, 'Ad measurement is off');
  assert.match(f['[data-measurement-status]'].textContent, /Global Privacy Control/);
});

test('an opted-out browser loads neither the OpenAI Pixel nor Vercel analytics', () => {
  const scripts = [];
  const w = { location: new URL('https://www.driverightcarbuying.com/blog.html'), navigator: {}, sessionStorage: { getItem() {}, setItem() {} } };
  const d = { cookie: 'dr_ad_measurement=off', referrer: '', body: { dataset: {} }, createElement: () => ({}), head: { appendChild: script => scripts.push(script) } };
  const ads = createOpenAIAds(w, d, 'test-pixel');
  ads.setConsent({ measurement: true });
  ads.track('generate_lead', { lead_id: 'a' });
  createWebAnalytics(w, d).setConsent(true);
  assert.equal(scripts.length, 0);
  d.cookie = '';
  ads.setConsent({ measurement: true });
  createWebAnalytics(w, d).setConsent(true);
  assert.equal(scripts.length, 2);
});

test('server conversions are skipped for an opted-out or GPC request', async t => {
  const old = process.env.OPENAI_ADS_CONVERSIONS_API_KEY, oldFetch = globalThis.fetch;
  process.env.OPENAI_ADS_CONVERSIONS_API_KEY = 'test-key';
  const sent = [];
  globalThis.fetch = async (url, init) => { sent.push(JSON.parse(init.body)); return { ok: true }; };
  t.after(() => {
    if (old === undefined) delete process.env.OPENAI_ADS_CONVERSIONS_API_KEY; else process.env.OPENAI_ADS_CONVERSIONS_API_KEY = old;
    globalThis.fetch = oldFetch;
  });
  const event = { eventType: 'lead_created', eventId: 'lead:a', sourcePage: '/' };
  const headers = { host: 'www.driverightcarbuying.com' };
  trackOpenAIAdsConversion(event, { headers: { ...headers, cookie: 'dr_ad_measurement=off' } });
  trackOpenAIAdsConversion(event, { headers: { ...headers, 'sec-gpc': '1' } });
  trackOpenAIAdsConversion(event, { headers });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(sent.length, 1);
  assert.equal(sent[0].events[0].id, 'lead:a');
});
