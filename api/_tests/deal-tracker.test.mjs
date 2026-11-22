import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { allowedOrigins } from '../_lib/config.js';
import { checkLink, dealTrackerEnabled, dealTrackerSettings, linkUrl, redactCarText, renderLinkClosed, renderTracker, replyToken, signLink } from '../_lib/deal-tracker.js';
import { dealTrackerHandler } from '../deal-tracker.js';
import { onboardingHandler } from '../onboarding.js';
import { SAMPLE_VIEWS, createDealTrackerPreview } from '../../scripts/preview-deal-tracker.mjs';

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
  assert.deepEqual(settings, { secret: SECRET, origin: 'https://example.test', replyMailbox: null });
  assert.equal(dealTrackerSettings({ DEAL_TRACKER_ENABLED: '1', DEAL_TRACKER_SECRET: SECRET }).origin, 'https://www.steermeright.com');
  assert.equal(linkUrl(settings, id, 3), `https://example.test/deal/${token}`);
  const sql = tagged(pg);
  assert.deepEqual(await checkLink(sql, settings, token), { status: 'ok', onboardingId: id });
  for (const bad of [signLink(SECRET, id, 1), `${token}x`, token.toUpperCase(), id, '', null]) {
    assert.equal((await checkLink(sql, settings, bad)).status, 'invalid', String(bad));
  }
});

test('the reply token is stable, differs per deal and per secret, and is not the link signature', () => {
  const id = crypto.randomUUID(), other = crypto.randomUUID();
  const token = replyToken(SECRET, id);
  assert.match(token, /^[0-9a-f]{20}$/);
  assert.equal(replyToken(SECRET, id), token);
  assert.notEqual(replyToken(SECRET, other), token);
  assert.notEqual(replyToken(`${SECRET}-other`, id), token);
  const link = signLink(SECRET, id, 1);
  assert.ok(!link.includes(token) && !Buffer.from(link.split('.')[1], 'base64url').toString('hex').includes(token));
});

test('every preview state renders without empty values', () => {
  for (const [name, view] of Object.entries(SAMPLE_VIEWS)) {
    const html = renderTracker(view);
    for (const junk of ['undefined', 'null', 'NaN', '[object']) assert.ok(!html.includes(junk), `${name} contains ${junk}`);
    assert.doesNotMatch(html, /<script/i, name);
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

test('the question box shows on every preview state but a search closed without a purchase, and the timeline marks the buyer\'s own words', () => {
  for (const [name, view] of Object.entries(SAMPLE_VIEWS)) {
    const html = renderTracker(view, { action: `/deal/${name}` });
    if (view.outcome === 'other') {
      assert.ok(!html.includes('<form') && !html.includes('dt-ask'), name);
      continue;
    }
    assert.ok(html.includes(`<form class="dt-ask" method="post" action="/deal/${name}">`), name);
    assert.ok(html.includes('<label class="dt-ask__label" for="dt-question">Your question</label>'), name);
    assert.match(html, /<textarea class="dt-ask__field" id="dt-question" name="body" rows="5" maxlength="4000" required><\/textarea>/, name);
    assert.ok(html.includes('<input type="hidden" name="action" value="question">'), name);
  }
  // Without an action the form posts to the page's own URL.
  assert.ok(renderTracker(SAMPLE_VIEWS.shortlisted).includes('<form class="dt-ask" method="post">'));

  const html = renderTracker(SAMPLE_VIEWS['price-agreed']);
  const thread = html.split('<li class="dt-question">')[1].split('</li>')[0];
  assert.ok(thread.includes('You asked by email ·') && thread.includes('<div class="dt-answer">') && thread.includes('Mason’s answer ·'));
  assert.ok(html.indexOf('You asked by email') < html.indexOf('Done: $36,100'), 'newest first');
  const waiting = renderTracker(SAMPLE_VIEWS['emailing-dealers']).split('<li class="dt-question">').find(part => part.includes('trade-in appraised'));
  assert.ok(waiting.split('</li>')[0].includes('You asked ·') && !waiting.split('</li>')[0].includes('dt-answer'), 'an unanswered question stands alone');
  assert.doesNotMatch(html, /\bbriefs?\b|\bticket\b|\brequest\b/i);
});

test('the preview takes the question box POST and goes back to the timeline, saving nothing', async t => {
  const server = createDealTrackerPreview();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => server.close());
  const base = `http://127.0.0.1:${server.address().port}`;
  const posted = await fetch(`${base}/deal/quotes-in`, { method: 'POST', body: 'action=question&body=Hello', redirect: 'manual',
    headers: { 'content-type': 'application/x-www-form-urlencoded' } });
  assert.equal(posted.status, 303);
  assert.equal(posted.headers.get('location'), '/deal/quotes-in#dt-updates');
  assert.equal((await fetch(`${base}/deal/nowhere`, { method: 'POST', body: 'x' })).status, 404);
  const page = await (await fetch(`${base}/deal/quotes-in`)).text();
  assert.ok(page.includes('action="/deal/quotes-in"'));
});
