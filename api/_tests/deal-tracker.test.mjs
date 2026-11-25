import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { allowedOrigins } from '../_lib/config.js';
import { checkLink, dealTrackerEnabled, dealTrackerSettings, linkUrl, redactCarText, renderLinkClosed, renderPickConfirm, renderTracker, signLink, textNumber } from '../_lib/deal-tracker.js';
import { dealTrackerHandler } from '../deal-tracker.js';
import { onboardingHandler } from '../onboarding.js';
import { SAMPLE_CONFIRMS, SAMPLE_CONTACT, SAMPLE_VIEWS, createDealTrackerPreview } from '../../scripts/preview-deal-tracker.mjs';

const migrations = await Promise.all(['001_durable_leads_and_payments.sql', '002_standard_purchase_analytics.sql',
  '003_checkout_offer_snapshot.sql', '004_intake_email_outbox.sql', '005_deal_search.sql', '006_dealer_handoff.sql',
  '007_deal_events.sql', '008_deal_events_per_car.sql', '012_deal_events_agents.sql', '013_deal_tracker.sql']
  .map(name => readFile(new URL(`../../db/${name}`, import.meta.url), 'utf8')));

function tagged(client, seen = []) {
  const sql = async (strings, ...values) => {
    const query = strings.reduce((text, part, index) => text + (index ? `$${index}` : '') + part, '');
    seen.push(query);
    return (await client.query(query, values)).rows;
  };
  sql.seen = seen;
  sql.begin = fn => client.transaction(tx => fn(tagged(tx, seen)));
  sql.json = value => JSON.stringify(value);
  return sql;
}

function response() {
  return {
    statusCode: 200, headers: {}, body: '',
    setHeader(name, value) { this.headers[name.toLowerCase()] = value; },
    end(body = '') { this.body = String(body); }
  };
}

test('the Deal Tracker switch is on only for 1, true or yes', () => {
  for (const value of ['1', 'true', 'yes', ' TRUE ', 'Yes']) assert.equal(dealTrackerEnabled({ DEAL_TRACKER_ENABLED: value }), true, value);
  for (const value of [undefined, '', '0', 'false', 'no', 'on', 'enabled']) assert.equal(dealTrackerEnabled({ DEAL_TRACKER_ENABLED: value }), false, String(value));
  assert.equal(dealTrackerEnabled({}), false);
});

test('a paid intake opens its deal and Deal Tracker link only with the switch on, and only for the two plans with a car search', async t => {
  t.mock.method(console, 'error', () => {});
  const pg = await PGlite.create();
  t.after(() => pg.close());
  for (const migration of migrations) await pg.exec(migration);
  const sql = tagged(pg);
  const origin = [...allowedOrigins()][0];

  const paid = async tier => {
    const attempt = crypto.randomUUID(), purchase = crypto.randomUUID(), session = `cs_test_${attempt.replaceAll('-', '')}`;
    await pg.query(`INSERT INTO checkout_attempts (id, client_reference_id, idempotency_key, request_hash, tier_id, expected_amount, status)
      VALUES ($1, $1, $4, $2, $3, 39500, 'paid')`, [attempt, 'a'.repeat(64), tier, `key-${attempt}`]);
    await pg.query(`INSERT INTO stripe_events (event_id, event_type, checkout_session_id, livemode, stripe_created_at)
      VALUES ($1, 'checkout.session.completed', $1, false, now())`, [session]);
    await pg.query(`INSERT INTO purchases (id, checkout_session_id, checkout_attempt_id, client_reference_id, stripe_event_id,
      stripe_payment_intent_id, tier_id, amount_total, currency, payment_status, livemode, paid_at)
      VALUES ($1, $2, $3, $3, $2, 'pi_1', $4, 39500, 'usd', 'paid', false, now())`, [purchase, session, attempt, tier]);
    return session;
  };
  const submit = async (environment, tier, session, key = crypto.randomUUID()) => {
    const res = response();
    await onboardingHandler({ environment, getDatabase: () => sql })({
      method: 'POST', url: '/api/onboarding',
      headers: { origin, 'content-type': 'application/json', 'idempotency-key': key },
      body: { session_id: session, tier, fields: { name: 'Pat Buyer', email: 'pat@example.test', phone: '205-555-0100', city: 'Austin, TX', preferred_makes: 'Toyota RAV4' } }
    }, res);
    return { status: res.statusCode, id: JSON.parse(res.body).onboarding_id, key };
  };
  const counts = async id => (await pg.query(`SELECT
      (SELECT count(*)::int FROM deals WHERE onboarding_id = $1) AS deals,
      (SELECT count(*)::int FROM deal_tracker_links WHERE onboarding_id = $1) AS links`, [id])).rows[0];

  const off = await submit({}, 'full_service', await paid('full_service'));
  assert.equal(off.status, 201);
  assert.deepEqual(await counts(off.id), { deals: 0, links: 0 }, 'switched off, an intake opens no deal');
  assert.ok(!sql.seen.some(query => /\bdeals\b|deal_tracker_links/.test(query)), 'switched off, no new query runs');

  const on = { DEAL_TRACKER_ENABLED: 'true' };
  for (const tier of ['full_service', 'concierge']) {
    const session = await paid(tier);
    const first = await submit(on, tier, session);
    assert.equal(first.status, 201);
    assert.deepEqual(await counts(first.id), { deals: 1, links: 1 }, tier);
    const [link] = (await pg.query('SELECT version, revoked_at FROM deal_tracker_links WHERE onboarding_id = $1', [first.id])).rows;
    assert.deepEqual(link, { version: 1, revoked_at: null });
    const [deal] = (await pg.query('SELECT shortlisted_at FROM deals WHERE onboarding_id = $1', [first.id])).rows;
    assert.equal(deal.shortlisted_at, null, 'the deal opens in Confirming search');

    const replay = await submit(on, tier, session, first.key);
    assert.deepEqual([replay.status, replay.id], [200, first.id]);
    const again = await submit(on, tier, session);
    assert.deepEqual([again.status, again.id], [200, first.id], 'the same intake under a new key is the same intake');
    assert.deepEqual(await counts(first.id), { deals: 1, links: 1 }, 'a replay adds nothing');
  }

  const consultation = await submit(on, 'consultation', await paid('consultation'));
  assert.equal(consultation.status, 201);
  assert.deepEqual(await counts(consultation.id), { deals: 0, links: 0 }, 'a consultation has no car search, so no deal');
  assert.equal((await pg.query('SELECT count(*)::int AS n FROM deals')).rows[0].n, 2);
});

const SECRET = 'deal-tracker-secret-for-tests-only-0123456789';

test('a signed link round-trips, and its token is the intake ID plus a signature', async t => {
  const pg = await PGlite.create();
  t.after(() => pg.close());
  await pg.exec('CREATE TABLE deal_tracker_links (onboarding_id uuid PRIMARY KEY, version integer NOT NULL, revoked_at timestamptz); CREATE TABLE deal_events (id bigint, onboarding_id uuid, kind text, occurred_at timestamptz)');
  const id = crypto.randomUUID();
  await pg.query('INSERT INTO deal_tracker_links VALUES ($1, 3, NULL)', [id]);
  const token = signLink(SECRET, id, 3);
  assert.match(token, /^[0-9a-f]{32}\.[A-Za-z0-9_-]{43}$/);
  assert.equal(token.split('.')[0], id.replaceAll('-', ''));
  assert.equal(signLink(SECRET, id.toUpperCase(), 3), token, 'the ID is case-insensitive');
  assert.notEqual(signLink(SECRET, id, 2), token, 'the version is signed');
  const settings = dealTrackerSettings({ DEAL_TRACKER_ENABLED: '1', DEAL_TRACKER_SECRET: SECRET, APP_ORIGIN: 'https://example.test/' });
  assert.deepEqual(settings, { secret: SECRET, origin: 'https://example.test', text: null });
  assert.equal(dealTrackerSettings({ DEAL_TRACKER_ENABLED: '1', DEAL_TRACKER_SECRET: SECRET }).origin, 'https://www.steermeright.com');
  assert.equal(linkUrl(settings, id, 3), `https://example.test/deal/${token}`);
  const sql = tagged(pg);
  assert.deepEqual(await checkLink(sql, settings, token), { status: 'ok', onboardingId: id });
  for (const bad of [signLink(SECRET, id, 1), `${token}x`, token.toUpperCase(), id, '', null]) {
    assert.equal((await checkLink(sql, settings, bad)).status, 'invalid', String(bad));
  }
});

test('the text number reads any US punctuation, and a bad one stops the tracker loudly', () => {
  const want = { href: 'sms:+15125550142', label: '(512) 555-0142' };
  for (const raw of ['5125550142', '512-555-0142', '(512) 555-0142', '+1 512 555 0142', '1.512.555.0142']) assert.deepEqual(textNumber(raw), want, raw);
  for (const raw of ['', null, '555-0142', '512555014', '44 20 7946 0958', '512-555-0142 ext 4', 'call me']) assert.equal(textNumber(raw), null, String(raw));
  const on = { DEAL_TRACKER_ENABLED: '1', DEAL_TRACKER_SECRET: SECRET };
  assert.deepEqual(dealTrackerSettings({ ...on, DEAL_TRACKER_TEXT_NUMBER: '512-555-0142' }).text, want);
  assert.throws(() => dealTrackerSettings({ ...on, DEAL_TRACKER_TEXT_NUMBER: 'not a number' }), /DEAL_TRACKER_TEXT_NUMBER/);
});

test('every preview state renders without empty values', () => {
  for (const [name, view] of Object.entries(SAMPLE_VIEWS)) {
    const html = renderTracker(view);
    for (const junk of ['undefined', 'null', 'NaN', '[object']) assert.ok(!html.includes(junk), `${name} contains ${junk}`);
    // The only script is the site's own document helper, on pages with the document form.
    const scripts = html.match(/<script\b[^>]*>/gi) ?? [];
    assert.deepEqual(scripts, view.can_upload ? ['<script src="/buying/deal-tracker.js" defer>'] : [], name);
  }
  assert.doesNotMatch(renderLinkClosed(), /undefined|null|NaN|\[object|<script/i);
  assert.match(renderTracker(SAMPLE_VIEWS['closed-other']), /mason@steermeright\.com/);
  assert.doesNotMatch(renderTracker(SAMPLE_VIEWS['closed-other']), /RAV4|Example Motors/);
});

test('a car title or color loses its dealer names and VINs, and anything left dangling', () => {
  const secrets = ['Vandelay Imports', 'Zzyzx Motors', '5YJ3E1EA7KF317000'];
  const cases = [
    ['2024 Mazda CX-5 Select at Vandelay Imports 5YJ3E1EA7KF317000', '2024 Mazda CX-5 Select'],
    ['2024 Mazda CX-5 Select @ vandelay imports', '2024 Mazda CX-5 Select'],
    ['ZZYZX MOTORS - 2023 Honda CR-V EX-L', '2023 Honda CR-V EX-L'],
    ['2023 Honda CR-V EX-L | 5yj3e1ea7kf317000', '2023 Honda CR-V EX-L'],
    ['Soul Red', 'Soul Red'],
    ['Vandelay Imports', '']
  ];
  for (const [text, shown] of cases) assert.equal(redactCarText(text, secrets), shown, text);
  assert.equal(redactCarText(null, secrets), '');
  assert.equal(redactCarText('2024 Toyota RAV4 XLE', []), '2024 Toyota RAV4 XLE');
});

test('the Deal Tracker answers GET and POST only', async () => {
  for (const method of ['PUT', 'DELETE', 'PATCH', 'HEAD']) {
    const res = response();
    await dealTrackerHandler({ environment: { DEAL_TRACKER_ENABLED: '1', DEAL_TRACKER_SECRET: SECRET }, getDatabase: () => { throw new Error('no database'); } })(
      { method, url: '/api/deal-tracker?t=x', headers: { host: 'www.steermeright.com' } }, res);
    assert.equal(res.statusCode, 405, method);
    assert.equal(res.headers.allow, 'GET, POST');
    assert.match(res.headers['cache-control'], /no-store/);
  }
});

test('every page but a closed search says how to reach Mason: by text when the number is set, by email otherwise', () => {
  for (const [name, view] of Object.entries(SAMPLE_VIEWS)) {
    const texted = renderTracker(view, { action: `/deal/${name}`, contact: SAMPLE_CONTACT });
    const emailed = renderTracker(view, { action: `/deal/${name}` });
    // No question box any more (adr/0003).
    for (const html of [texted, emailed]) assert.ok(!html.includes('dt-ask__field') && !html.includes('value="question"'), name);
    assert.ok(texted.includes('Text me at <a href="sms:+15125550142">(512) 555-0142</a>'), name);
    assert.ok(!emailed.includes('sms:') && emailed.includes('mailto:mason@steermeright.com'), name);
    assert.equal(texted.includes('<section class="dt-section" aria-labelledby="dt-ask">'), view.outcome !== 'other', name);
  }
  assert.ok(renderLinkClosed(SAMPLE_CONTACT).includes('Text me at'));
  assert.ok(renderPickConfirm(null, '/deal/x', SAMPLE_CONTACT).includes('sms:+15125550142'));
  // Buyer Updates, newest first.
  const html = renderTracker(SAMPLE_VIEWS['price-agreed']);
  assert.ok(html.indexOf('Done: $36,100') < html.indexOf('The RAV4 dealer came down'), 'newest first');
  assert.doesNotMatch(html, /\bbriefs?\b|\bticket\b|\brequest\b/i);
});

test('the preview serves each sample car\'s photos at the page\'s own photo path', async t => {
  const server = createDealTrackerPreview();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => server.close());
  const base = `http://127.0.0.1:${server.address().port}`;
  const photo = await fetch(`${base}/deal/quotes-in/photo/1/0`);
  assert.equal(photo.status, 200);
  assert.equal(photo.headers.get('content-type'), 'image/webp');
  assert.ok((await photo.arrayBuffer()).byteLength > 1000);
  assert.equal((await fetch(`${base}/deal/quotes-in/photo/1/9`)).status, 404);
  assert.equal((await fetch(`${base}/deal/nowhere`, { method: 'POST', body: 'x' })).status, 404);
  const page = await (await fetch(`${base}/deal/quotes-in`)).text();
  assert.ok(page.includes('src="/deal/quotes-in/photo/1/0"'));
});

test('the Buyer Pick previews: buttons only when ready for your call, then what the buyer chose, and the two confirm pages', () => {
  const html = name => renderTracker(SAMPLE_VIEWS[name], { action: `/deal/${name}` });
  const ready = html('quotes-in-ready');
  assert.equal(ready.split('Pick this car at').length - 1, 2, 'one per priced car');
  assert.ok(ready.includes('Pick this car at $36,400') && ready.includes('None of these, keep looking') && ready.includes('action="/deal/quotes-in-ready"'));
  for (const name of ['quotes-in', 'quotes-in-picked', 'quotes-in-price-moved', 'quotes-in-keep-looking', 'shortlisted', 'price-agreed']) {
    assert.ok(!html(name).includes('Pick this car') && !html(name).includes('None of these, keep looking'), name);
  }
  assert.ok(html('quotes-in-picked').includes('You picked the 2024 Toyota RAV4 XLE at $36,400 out the door.'));
  assert.ok(html('quotes-in-price-moved').includes('The price on this car has changed since you picked it. Its best price so far is now $36,900.'));
  assert.ok(html('quotes-in-keep-looking').includes('You asked me to keep looking.'));
  for (const [name, car] of Object.entries(SAMPLE_CONFIRMS)) {
    const page = renderPickConfirm(car, '/deal/quotes-in-ready');
    for (const junk of ['undefined', 'null', 'NaN', '[object']) assert.ok(!page.includes(junk), `${name} contains ${junk}`);
    assert.doesNotMatch(page, /<script|\bbriefs?\b/i, name);
    assert.ok(page.includes('href="/deal/quotes-in-ready#dt-cars">Go back</a>'), name);
  }
  assert.ok(renderPickConfirm(SAMPLE_CONFIRMS['confirm-pick']).includes('You’re picking the 2024 Toyota RAV4 XLE at $36,400 out the door.'));
  assert.ok(renderPickConfirm(null).includes('You’re asking us to keep looking.'));
});

test('the preview walks the pick: the button shows the confirm page, and confirming goes to the picked sample', async t => {
  const server = createDealTrackerPreview();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => server.close());
  const base = `http://127.0.0.1:${server.address().port}`;
  const post = body => fetch(`${base}/deal/quotes-in-ready`, { method: 'POST', body, redirect: 'manual', headers: { 'content-type': 'application/x-www-form-urlencoded' } });
  const review = await post('action=pick_review&car=2&price=3690000');
  assert.equal(review.status, 200);
  assert.ok((await review.text()).includes('2023 Honda CR-V EX-L at $36,900'));
  assert.ok((await (await post('action=keep_looking_review')).text()).includes('keep looking'));
  assert.equal((await post('action=pick&car=2&price=3690000')).headers.get('location'), '/deal/quotes-in-picked#dt-pick');
  assert.equal((await post('action=keep_looking')).headers.get('location'), '/deal/quotes-in-keep-looking#dt-pick');
  assert.ok((await (await fetch(`${base}/deal/confirm-pick`)).text()).includes('Yes, that’s my pick'));
  assert.ok((await (await fetch(`${base}/deal/confirm-keep-looking`)).text()).includes('Yes, keep looking'));
});

test('the preview walks a document: upload_start, a PUT to its fake local store, then upload_done\'s receipt, keeping nothing', async t => {
  const server = createDealTrackerPreview();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => server.close());
  const base = `http://127.0.0.1:${server.address().port}`;
  const post = body => fetch(`${base}/deal/price-agreed`, { method: 'POST', body, headers: { 'content-type': 'application/x-www-form-urlencoded' } });
  const started = await (await post('action=upload_start&doc_type=id&content_type=image%2Fjpeg&bytes=5')).json();
  assert.equal(started.ok, true);
  assert.match(started.upload.url, /^\/preview-upload\/[0-9a-f-]{36}$/);
  const put = await fetch(`${base}${started.upload.url}`, { method: started.upload.method, headers: started.upload.headers, body: 'hello' });
  assert.deepEqual(await put.json(), { ok: true, size: 5 });
  const done = await (await post(`action=upload_done&ticket=${started.ticket}`)).json();
  assert.equal(done.receipt.doc_type, 'id');
  assert.ok(!Number.isNaN(Date.parse(done.receipt.at)));
  assert.equal((await fetch(`${base}/preview-upload/elsewhere`, { method: 'PUT', body: 'x' })).status, 404);
  const script = await fetch(`${base}/buying/deal-tracker.js`);
  assert.equal(script.status, 200);
  assert.match(script.headers.get('content-type'), /javascript/);
  assert.equal((await fetch(`${base}/buying/app.js`)).status, 404, 'only the Deal Tracker\'s own script is served');
});
