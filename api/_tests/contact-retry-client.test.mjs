import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../../script.js', import.meta.url), 'utf8');
const leadId = '06a28d37-b5d9-4f0e-a20c-c8e506ef5477';

function contactPage({ measurementFails = false, conflictAlways = false, forwardingConfigured = true, web3forms = async () => ({ success: true }) } = {}) {
  const fields = { name: 'Buyer', email: 'buyer@example.test', phone: '', message: 'Looking for a Mazda CX-5', website: '' };
  const storage = new Map(), storedLeads = new Map(), requests = [], events = [], emails = [];
  const submit = { disabled: false, dataset: {}, textContent: 'Send message', setAttribute() {} };
  const status = { textContent: '', dataset: {} };
  const form = { querySelector: selector => selector === '[type="submit"]' ? submit : status,
    addEventListener(event, fn) { this[event] = fn; }, reset() { this.resetCount = (this.resetCount || 0) + 1; } };
  const location = new URL('https://www.driverightcarbuying.com/austin.html');
  const window = { location, crypto, addEventListener() {}, setTimeout, clearTimeout,
    sessionStorage: { getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) },
    dataLayer: { push(event) { if (measurementFails) throw new Error('Analytics blocked'); events.push(event); } } };
  const document = { referrer: '', body: { dataset: {} }, getElementById: () => null, querySelectorAll: selector => selector === '#contact-form' ? [form] : [] };
  const fetch = async (url, options) => {
    if (url === 'https://api.web3forms.com/submit') {
      emails.push({ url, ...options });
      return { json: web3forms };
    }
    requests.push({ url, ...options });
    const key = options.headers['Idempotency-Key'];
    const prior = storedLeads.get(key);
    const conflict = conflictAlways || (prior && prior !== options.body);
    if (conflict) return { ok: false, status: 409, json: async () => ({ ok: false, error: 'idempotency_conflict' }) };
    storedLeads.set(key, options.body);
    if (requests.length === 1) throw new Error('Response lost after the lead was saved');
    return { ok: true, status: 200, json: async () => ({ ok: true, lead_id: leadId, forwarding_configured: forwardingConfigured }) };
  };
  class FormData {
    forEach(fn) { for (const [key, value] of Object.entries(fields)) fn(value, key); }
  }
  vm.runInNewContext(source, { window, document, URL, URLSearchParams, Date, Set, console, crypto, AbortController, fetch, FormData });
  return { fields, requests, events, emails, form, status, submit, window, send: () => form.submit({ preventDefault() {} }) };
}

test('an unchanged contact retry recovers the original saved lead with the same key', async () => {
  const page = contactPage();
  await page.send();
  assert.equal(page.events.length, 0);
  await page.send();
  assert.equal(page.requests.length, 2);
  assert.equal(page.requests[0].headers['Idempotency-Key'], page.requests[1].headers['Idempotency-Key']);
  assert.equal(page.requests[0].body, page.requests[1].body);
  assert.match(page.status.textContent, /message was saved/);
  assert.equal(page.events.length, 1);
});

test('editing a saved contact request after a lost response recovers a conflicting key once', async () => {
  const page = contactPage();
  await page.send();
  page.fields.message = 'Updated search: Toyota RAV4';
  await page.send();
  assert.match(page.status.textContent, /message was saved/);
  assert.equal(page.requests.length, 3);
  assert.notEqual(page.requests[1].headers['Idempotency-Key'], page.requests[2].headers['Idempotency-Key']);
  assert.equal(page.requests[1].body, page.requests[2].body);
  assert.equal(page.events.length, 1);
  assert.equal(page.submit.disabled, false);
});

test('a persistent key conflict stops after one restart and leaves the form editable', async () => {
  const page = contactPage({ conflictAlways: true });
  await page.send();
  assert.ok(page.requests.length <= 2);
  assert.equal(page.submit.disabled, false);
  assert.match(page.status.className, /error/);
  assert.equal(page.form.resetCount, undefined);
});

test('blocked analytics and unconfigured forwarding still show a saved contact request and contact options', async () => {
  const page = contactPage({ measurementFails: true, forwardingConfigured: false });
  await page.send();
  await page.send();
  assert.match(page.status.textContent, /message was saved/);
  assert.doesNotMatch(page.status.textContent, /follow up shortly/);
  assert.match(page.status.textContent, /hello@driverightcarbuying.com|512/);
  assert.equal(page.submit.disabled, false);
  assert.equal(page.form.resetCount, 1);
});

test('a saved contact message is emailed to Mason through Web3Forms once', async () => {
  const page = contactPage({ forwardingConfigured: false });
  await page.send();
  assert.equal(page.emails.length, 0, 'a lost save response sends no email');
  await page.send();
  assert.equal(page.emails.length, 1);
  const email = JSON.parse(page.emails[0].body);
  assert.match(email.access_key, /^[0-9a-f-]{36}$/);
  assert.equal(email.email, 'buyer@example.test');
  assert.equal(email.replyto, 'buyer@example.test');
  assert.equal(email.name, 'Buyer');
  assert.match(email.subject, /Buyer/);
  assert.match(email.message, /Looking for a Mazda CX-5/);
  assert.match(email.message, /Page: \/austin.html/);
  assert.match(email.message, new RegExp(leadId));
  assert.match(page.status.textContent, /Mason replies within one business day/);
});

test('a Web3Forms failure still shows the saved message with direct contact options', async () => {
  const page = contactPage({ forwardingConfigured: false, web3forms: async () => { throw new Error('Offline'); } });
  await page.send();
  await page.send();
  assert.equal(page.emails.length, 1);
  assert.match(page.status.textContent, /hello@driverightcarbuying.com/);
  assert.equal(page.submit.disabled, false);
});

test('configured server forwarding or a filled honeypot skips the browser email', async () => {
  const forwarded = contactPage({ forwardingConfigured: true });
  await forwarded.send();
  await forwarded.send();
  assert.equal(forwarded.emails.length, 0);
  const bot = contactPage({ forwardingConfigured: false });
  bot.fields.website = 'spam.example';
  await bot.send();
  await bot.send();
  assert.equal(bot.emails.length, 0);
});

test('the shared client exposes the Mason email sender to the buying pages', () => {
  const page = contactPage();
  assert.equal(typeof page.window.driveRightClient.emailMason, 'function');
});
