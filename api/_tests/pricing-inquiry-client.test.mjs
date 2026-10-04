import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const source = (await readFile(new URL('../../buying/inquiry.js', import.meta.url), 'utf8')).replace(/^import .*;\n/, '');
const leadId = '06a28d37-b5d9-4f0e-a20c-c8e506ef5477';

function inquiry(request, track) {
  const listeners = {}, requests = [], events = [], dialogListeners = {};
  const fields = { vehicle: 'Used Mazda CX-5', budget: '$35,000', timeline: 'Within a month', email: 'buyer@example.com', name: '', website: '' };
  const submit = { disabled: false, textContent: 'Send my car search inquiry', setAttribute() {}, removeAttribute() {} };
  const status = { textContent: '', focus() { this.focused = true; } };
  const interest = { value: 'Not sure yet' };
  const emailHandoff = { hidden: true, href: 'mailto:hello@driverightcarbuying.com', addEventListener(event, fn) { this.click = fn; } };
  const navigations = [];
  const form = { elements: { namedItem: () => interest }, querySelector: selector => selector === '[type="submit"]' ? submit : selector === '[data-email-inquiry]' ? emailHandoff : status,
    addEventListener: (event, fn) => { listeners[event] = fn; }, reset() { this.wasReset = true; } };
  const close = { addEventListener(event, fn) { this.click = fn; } };
  const dialog = { querySelector: () => close, addEventListener: (event, fn) => { dialogListeners[event] = fn; },
    showModal() { this.open = true; }, close() { this.open = false; dialogListeners.close(); } };
  const opener = { dataset: { openInquiry: 'Ultimate Concierge' }, addEventListener(event, fn) { this.click = fn; }, focus() { this.focused = true; } };
  const client = {
    attribution: { first_touch: { utm_source: 'chatgpt' } }, createId: () => crypto.randomUUID(),
    track: track || ((event, data) => events.push({ event, data })),
    requestJson: async (url, options) => { requests.push({ url, ...options }); return request(requests.length); }
  };
  vm.runInNewContext(source, {
    document: { getElementById: id => id === 'car-search-inquiry' ? dialog : form, querySelectorAll: () => [opener] },
    window: { location: { pathname: '/schedule.html', assign: url => navigations.push(url) }, driveRightClient: client },
    FormData: class { get(key) { return fields[key]; } }
  });
  return { requests, events, fields, form, status, submit, dialog, opener, close, interest, emailHandoff, navigations,
    send: () => listeners.submit({ preventDefault() {} }) };
}

test('pricing inquiry opens with the chosen service and restores focus on close', () => {
  const f = inquiry(() => ({ lead_id: leadId }));
  f.opener.click();
  assert.equal(f.dialog.open, true);
  assert.equal(f.interest.value, 'Ultimate Concierge');
  f.close.click();
  assert.equal(f.dialog.open, false);
  assert.equal(f.opener.focused, true);
});

test('without a notification connection the saved inquiry offers an explicit email handoff, with no private URL in the DOM', async () => {
  const f = inquiry(() => ({ lead_id: leadId, forwarding_configured: false }));
  await f.send();
  assert.equal(f.emailHandoff.hidden, false);
  assert.match(f.status.textContent, /email Mason these details/);
  assert.equal(f.emailHandoff.href, 'mailto:hello@driverightcarbuying.com');
  assert.equal(f.navigations.length, 0, 'submission itself does not open or send an email');
  f.emailHandoff.click({ preventDefault() {} });
  const draft = new URL(f.navigations[0]);
  assert.equal(draft.pathname, 'hello@driverightcarbuying.com');
  assert.match(draft.searchParams.get('body'), /Used Mazda CX-5/);
  assert.match(draft.searchParams.get('body'), /buyer@example.com/);
  assert.equal(f.events.length, 1, 'email handoff is not another conversion');
  f.opener.click();
  assert.equal(f.emailHandoff.hidden, true);
});

test('a configured notification connection uses the saved-inquiry confirmation without the email handoff', async () => {
  const f = inquiry(() => ({ lead_id: leadId, forwarding_configured: true }));
  await f.send();
  assert.equal(f.emailHandoff.hidden, true);
  assert.doesNotMatch(f.status.textContent, /button below/);
});

test('an analytics failure cannot turn a saved inquiry into a submission error', async () => {
  const f = inquiry(() => ({ lead_id: leadId, forwarding_configured: false }), () => { throw new Error('Analytics unavailable'); });
  await f.send();
  assert.match(f.status.textContent, /inquiry is saved/);
  assert.equal(f.form.wasReset, true);
  assert.equal(f.emailHandoff.hidden, false);
  assert.equal(f.submit.disabled, false);
});

test('pricing inquiry persists search and contact details and reports only the durable saved lead', async () => {
  const f = inquiry(() => ({ lead_id: leadId }));
  f.opener.click();
  await f.send();
  const payload = JSON.parse(f.requests[0].body);
  assert.equal(f.requests[0].url, '/api/leads');
  assert.equal(payload.source, 'pricing_inquiry');
  assert.equal(payload.name, '');
  assert.equal(payload.email, f.fields.email);
  assert.equal(payload.vehicle, f.fields.vehicle);
  assert.match(payload.message, /Ultimate Concierge/);
  assert.match(payload.message, /Vehicle budget: \$35,000/);
  assert.match(payload.message, /Buying timeline: Within a month/);
  assert.equal(payload.attribution.first_touch.utm_source, 'chatgpt');
  assert.deepEqual(JSON.parse(JSON.stringify(f.events)), [{ event: 'generate_lead', data: { form_name: 'pricing_inquiry', lead_id: leadId } }]);
  assert.equal(JSON.stringify(f.events).includes(f.fields.email), false);
  assert.equal(f.form.wasReset, true);
  assert.equal(f.status.focused, true);
  assert.match(f.status.textContent, /inquiry is saved/);
  assert.equal(f.submit.disabled, false);
});

test('a failed or lost response produces no conversion and retries the identical idempotency key', async () => {
  const f = inquiry(attempt => { if (attempt === 1) throw new Error('Lost response'); return { lead_id: leadId }; });
  await f.send();
  assert.equal(f.events.length, 0);
  assert.match(f.status.textContent, /could not be sent/);
  assert.equal(f.form.wasReset, undefined);
  await f.send();
  assert.equal(f.requests[0].headers['Idempotency-Key'], f.requests[1].headers['Idempotency-Key']);
  assert.equal(f.requests[0].body, f.requests[1].body);
  assert.equal(f.events.length, 1);
});

test('editing a failed inquiry creates a new request key instead of conflicting with its prior payload', async () => {
  const f = inquiry(() => { throw new Error('Unavailable'); });
  await f.send();
  f.fields.vehicle = 'New Toyota RAV4';
  await f.send();
  assert.notEqual(f.requests[0].headers['Idempotency-Key'], f.requests[1].headers['Idempotency-Key']);
  assert.equal(f.events.length, 0);
});

test('a second submit while the first is pending does not create another inquiry', async () => {
  let resolve;
  const f = inquiry(() => new Promise(done => { resolve = done; }));
  const first = f.send();
  await f.send();
  assert.equal(f.requests.length, 1);
  assert.equal(f.submit.disabled, true);
  resolve({ lead_id: leadId });
  await first;
  assert.equal(f.events.length, 1);
  assert.equal(f.submit.disabled, false);
});

test('a malformed success response never becomes a saved lead conversion', async () => {
  for (const response of [{}, { lead_id: 'cs_test_private' }, { lead_id: 'bad-id' }]) {
    const f = inquiry(() => response);
    await f.send();
    assert.equal(f.events.length, 0);
    assert.match(f.status.textContent, /could not be sent/);
  }
});
