import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { PGlite } from '@electric-sql/pglite';
import { ConfigError } from '../_lib/config.js';
import { agentStatus, dollarsToCents, isAuthorized, opsPassword, summarizeDeal } from '../_lib/ops-dashboard.js';
import { digestEmail, dispatchOpsAlerts, opsAlertSettings, queueAlerts } from '../_lib/ops-alerts.js';
import { outboxHandler } from '../outbox-dispatch.js';
import { pendingAnswers } from '../../scripts/deal-desk-db.mjs';
import { opsHandler } from '../ops.js';

const password = 'ops-password-for-tests-only-0123456789';
const environment = { OPS_PASSWORD: password, APP_ORIGIN: 'https://www.steermeright.com' };
const basic = (pass, user = 'mason') => `Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}`;
const migrations = await Promise.all(['001_durable_leads_and_payments.sql', '002_standard_purchase_analytics.sql',
  '003_checkout_offer_snapshot.sql', '004_intake_email_outbox.sql', '005_deal_search.sql', '006_dealer_handoff.sql',
  '007_deal_events.sql', '008_deal_events_per_car.sql', '012_deal_events_agents.sql', '013_deal_tracker.sql']
  .map(name => readFile(new URL(`../../db/${name}`, import.meta.url), 'utf8')));

function tagged(client) {
  const sql = async (strings, ...values) => {
    const query = strings.reduce((text, part, index) => text + (index ? `$${index}` : '') + part, '');
    return (await client.query(query, values)).rows;
  };
  sql.begin = fn => client.transaction(tx => fn(tagged(tx)));
  return sql;
}

function request(method, { url = '/api/ops', headers = {}, body } = {}) {
  const req = Readable.from(body ? [Buffer.from(body)] : []);
  Object.assign(req, { method, url, headers: { host: 'www.steermeright.com', ...headers } });
  return req;
}
function response() {
  return {
    statusCode: 200, headers: {}, body: '',
    setHeader(name, value) { this.headers[name.toLowerCase()] = value; },
    end(body = '') { this.body = String(body); }
  };
}
async function call(handler, method, options) {
  const res = response();
  await handler(request(method, options), res);
  return res;
}

async function seed(pg) {
  const intake = async (name, city, { deal = true, confirming = false } = {}) => {
    const id = crypto.randomUUID(), attempt = crypto.randomUUID(), purchase = crypto.randomUUID(), session = `cs_live_${id}`;
    await pg.query(`INSERT INTO checkout_attempts (id, client_reference_id, idempotency_key, request_hash, tier_id, expected_amount, status)
      VALUES ($1, $1, $2, $3, 'full_service', 39500, 'paid')`, [attempt, attempt, 'a'.repeat(64)]);
    await pg.query(`INSERT INTO stripe_events (event_id, event_type, checkout_session_id, livemode, stripe_created_at)
      VALUES ($1, 'checkout.session.completed', $1, true, now())`, [session]);
    await pg.query(`INSERT INTO purchases (id, checkout_session_id, checkout_attempt_id, client_reference_id, stripe_event_id,
      stripe_payment_intent_id, tier_id, amount_total, currency, payment_status, livemode, paid_at)
      VALUES ($1, $2, $3, $3, $2, 'pi_1', 'full_service', 39500, 'usd', 'paid', true, now())`, [purchase, session, attempt]);
    await pg.query(`INSERT INTO onboarding_submissions (id, checkout_session_id, purchase_id, idempotency_key, request_hash, tier_id, name, email, phone, city, fields)
      VALUES ($1, $2, $3, $7, $4, 'full_service', $5, 'buyer@example.test', '205-555-0100', $6, '{"preferred_makes":"Toyota RAV4"}')`,
    [id, session, purchase, 'b'.repeat(64), name, city, id]);
    if (!deal) return { id };
    const dealId = crypto.randomUUID();
    // Opened at paid intake with the Deal Tracker on: no shortlist yet.
    if (confirming) {
      await pg.query(`INSERT INTO deals (id, onboarding_id, created_at) VALUES ($1, $2, now() - interval '5 days')`, [dealId, id]);
      await pg.query('INSERT INTO deal_tracker_links (onboarding_id) VALUES ($1)', [id]);
      return { id, dealId };
    }
    await pg.query(`INSERT INTO deals (id, onboarding_id, search_summary, shortlisted_at, created_at) VALUES ($1, $2, 'Two RAV4s near Austin', now() - interval '5 days', now() - interval '5 days')`, [dealId, id]);
    await pg.query(`INSERT INTO deal_listings (id, deal_id, rank, title, price_cents, target_price_cents, vin, listing_url, dealer_name)
      VALUES ($1, $2, 1, '2025 Toyota RAV4 XLE', 3400000, 3250000, '2T3P1RFV5SW000001', 'https://dealer.example/rav4', 'North Toyota'),
             ($3, $2, 2, '2025 Toyota RAV4 LE', 3200000, 3100000, '2T3P1RFV5SW000002', 'https://other.example/rav4', 'South Toyota')`,
    [crypto.randomUUID(), dealId, crypto.randomUUID()]);
    return { id, dealId };
  };
  const log = (id, kind, values = {}) => pg.query(`INSERT INTO deal_events (onboarding_id, kind, dealer_name, vin, otd_cents, note, actor, resolves_event_id, options, occurred_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $10, now() - make_interval(hours => $9)) RETURNING id`,
  [id, kind, values.dealer ?? null, values.vin ?? null, values.otd ?? null, values.note ?? null, values.actor ?? 'duet', values.resolves ?? null, values.hoursAgo ?? 1,
    values.options ? JSON.stringify(values.options) : null]);
  return { intake, log };
}

test('the dashboard stays off without a long OPS_PASSWORD and checks the password in constant time', () => {
  assert.equal(opsPassword({}), null);
  assert.throws(() => opsPassword({ OPS_PASSWORD: 'short' }), ConfigError);
  assert.ok(isAuthorized(basic(password), password));
  assert.ok(isAuthorized(basic(password, ''), password));
  assert.ok(!isAuthorized(basic('wrong'), password));
  assert.ok(!isAuthorized(`Bearer ${password}`, password));
  assert.ok(!isAuthorized(undefined, password));
});

test('typed prices become cents, and nonsense is refused', () => {
  assert.deepEqual(['$32,300', '32300', ' 32,300.50 ', '900', '$', '1e5', '-30000', '99999999'].map(dollarsToCents),
    [3230000, 3230000, 3230050, null, null, null, null, null]);
});

test('a deal\'s stage, best price and quiet days come from its event log alone', () => {
  const now = Date.parse('2026-11-20T18:00:00Z');
  const deal = { onboarding_id: 'x', name: 'Pat', created_at: '2026-11-10T00:00:00Z', shortlisted_at: '2026-11-10T00:00:00Z' };
  const listings = [{ title: 'Car A', vin: 'A'.repeat(17), target_price_cents: 3000000 }, { title: 'Car B', vin: 'B'.repeat(17), target_price_cents: 2800000 }];
  const at = day => `2026-11-${day}T12:00:00Z`;
  const events = [
    { kind: 'first_email_sent', dealer_name: 'One', occurred_at: at(11) },
    { kind: 'quote', dealer_name: 'One', vin: 'A'.repeat(17), otd_cents: 3100000, occurred_at: at(12) },
    { kind: 'quote', dealer_name: 'Two', vin: 'B'.repeat(17), otd_cents: 2750000, occurred_at: at(13) },
    { kind: 'dropped', dealer_name: 'two', occurred_at: at(14) }
  ];
  const summary = summarizeDeal(deal, events, listings, now);
  assert.deepEqual([summary.stage, summary.best_cents, summary.best_dealer, summary.target_cents, summary.quotes, summary.quiet_days, summary.stale],
    ['quoted', 3100000, 'One', 3000000, 1, 6, true], 'a dropped dealer\'s quote no longer counts');
  const agreed = summarizeDeal(deal, [...events, { kind: 'agreed', dealer_name: 'One', vin: 'A'.repeat(17), otd_cents: 2990000, occurred_at: at(20) }], listings, now);
  assert.deepEqual([agreed.stage, agreed.best_cents, agreed.stale], ['agreed', 2990000, false]);
  const closed = summarizeDeal(deal, [...events, { kind: 'closed', occurred_at: at(15) }], listings, now);
  assert.deepEqual([closed.stage, closed.stale], ['closed', false]);

  // Opened at paid intake, before its shortlist: Confirming search, and never quiet.
  const opened = { ...deal, shortlisted_at: null };
  const confirming = summarizeDeal(opened, [], [], now);
  assert.deepEqual([confirming.stage, confirming.stale, confirming.quiet_days, confirming.car], ['confirming', false, 10, null]);
  assert.equal(summarizeDeal(opened, [{ kind: 'note', note: 'Called the buyer', occurred_at: at(11) }], [], now).stage, 'confirming');
  assert.equal(summarizeDeal(opened, [{ kind: 'closed', note: 'Refunded', occurred_at: at(12) }], [], now).stage, 'closed');
  assert.equal(summarizeDeal(opened, events, [], now).stage, 'quoted', 'a quote outranks a missing shortlist');
});

test('/api/ops asks for a password, renders every deal from Neon, and takes Mason\'s answers', async t => {
  t.mock.method(console, 'error', () => {});
  const pg = await PGlite.create();
  t.after(() => pg.close());
  for (const migration of migrations) await pg.exec(migration);
  const sql = tagged(pg);
  const { intake, log } = await seed(pg);
  const pat = await intake('Pat <Buyer>', 'Austin, TX');
  const sam = await intake('Sam Quiet', 'Dallas, TX');
  await intake('New Paid', 'Houston, TX', { deal: false });
  await pg.query(`INSERT INTO leads (id, idempotency_key, request_hash, name, email, vehicle, message) VALUES ($1, $3, $2, 'Lee Lead', 'lee@example.test', 'Honda CR-V', 'Can you help?')`,
    [...(id => [id, 'c'.repeat(64), id])(crypto.randomUUID())]);

  await log(pat.id, 'first_email_sent', { dealer: 'North Toyota', hoursAgo: 90 });
  await log(pat.id, 'form_submitted', { dealer: 'South Toyota', note: 'Filled in the e-price form', actor: 'duet-forms', hoursAgo: 80 });
  await log(pat.id, 'quote', { dealer: 'North Toyota', vin: '2T3P1RFV5SW000001', otd: 3230000, hoursAgo: 3 });
  const [need] = (await log(pat.id, 'needs_mason', { dealer: 'North Toyota', note: 'Dealer wants a deposit <script>alert(1)</script>', hoursAgo: 2 })).rows;
  await log(sam.id, 'first_email_sent', { dealer: 'North Toyota', hoursAgo: 100 });
  const [question] = (await log(pat.id, 'needs_mason', { dealer: 'North Toyota', actor: 'duet-deals', note: 'Counter at $33,000?', options: ['Approve', 'Hold at $32,500'], hoursAgo: 1 })).rows;
  await pg.query(`INSERT INTO agent_runs (actor, ran_at, expect_minutes, note) VALUES
    ('duet-inbox', now() - interval '2 hours', 10, 'Checked inbox'), ('duet-deals', now() - interval '5 minutes', 15, 'Nothing new')`);

  const handler = opsHandler({ environment, getDatabase: () => sql });
  assert.equal((await call(opsHandler({ environment: {}, getDatabase: () => sql }), 'GET')).statusCode, 503);
  const locked = await call(handler, 'GET', { headers: { authorization: basic('wrong') } });
  assert.equal(locked.statusCode, 401);
  assert.equal(locked.headers['www-authenticate'], undefined, 'no browser Basic Auth popup');
  assert.ok(locked.body.includes('Steer Me Right ops') && locked.body.includes('name="auth" value="password"'));
  assert.ok(!locked.body.includes('Pat'), 'nothing from Neon before sign-in');

  const page = await call(handler, 'GET', { headers: { authorization: basic(password) } });
  assert.equal(page.statusCode, 200);
  assert.equal(page.headers['cache-control'], 'no-store, max-age=0');
  assert.match(page.headers['x-robots-tag'], /noindex/);
  assert.match(page.headers['content-security-policy'], /default-src 'none'/);
  assert.ok(page.body.includes('Pat &lt;Buyer&gt;') && !page.body.includes('Pat <Buyer>'), 'buyer text is escaped');
  assert.ok(page.body.includes('&lt;script&gt;') && !page.body.includes('<script>'), 'agent notes are escaped');
  assert.ok(page.body.includes('$32,300') && page.body.includes('$200 under'), 'best quote against the target');
  assert.ok(page.body.includes('Nothing logged for 4 days'), 'the quiet deal is flagged');
  assert.ok(page.body.includes('New Paid') && page.body.includes('Run /car-search'), 'a paid intake with no search is flagged');
  assert.ok(page.body.includes('Lee Lead') && page.body.includes('Form submitted'));
  assert.ok(!page.body.includes('buyer@example.test') && !page.body.includes('205-555-0100'), 'no buyer contact details');
  assert.match(page.body, /Need you<\/span>/);
  assert.ok(page.body.includes('value="Approve"') && page.body.includes('value="Hold at $32,500"'), 'the agent\'s options are buttons');
  assert.ok(page.body.includes('Agent overdue') && page.body.includes('duet-inbox'), 'an agent that missed two runs is flagged');
  assert.ok(page.body.includes('<h2>Agents (4)</h2>'), 'agents from runs and from the log are listed');

  const detail = await call(handler, 'GET', { url: `/api/ops?deal=${pat.id}`, headers: { authorization: basic(password) } });
  assert.equal(detail.statusCode, 200);
  assert.ok(detail.body.includes('2025 Toyota RAV4 LE') && detail.body.includes('Two RAV4s near Austin'));
  assert.ok(detail.body.includes(`name="resolve" value="${need.id}"`));
  assert.equal((await call(handler, 'GET', { url: `/api/ops?deal=${crypto.randomUUID()}`, headers: { authorization: basic(password) } })).statusCode, 404);

  const form = `resolve=${need.id}&back=${pat.id}`;
  const crossSite = await call(handler, 'POST', { headers: { authorization: basic(password), origin: 'https://evil.example' }, body: form });
  assert.equal(crossSite.statusCode, 403);
  const done = await call(handler, 'POST', { headers: { authorization: basic(password), origin: environment.APP_ORIGIN }, body: form });
  assert.equal(done.statusCode, 303);
  assert.equal(done.headers.location, `/api/ops?deal=${pat.id}`);
  await call(handler, 'POST', { headers: { authorization: basic(password), origin: environment.APP_ORIGIN }, body: form });
  const resolved = (await pg.query(`SELECT actor, onboarding_id FROM deal_events WHERE kind = 'resolved'`)).rows;
  assert.deepEqual(resolved, [{ actor: 'mason', onboarding_id: pat.id }], 'resolving twice logs one row');
  const after = await call(handler, 'GET', { headers: { authorization: basic(password) } });
  assert.ok(!after.body.split('<h2>Open deals')[0].includes('Dealer wants a deposit'), 'the item leaves Needs you');

  const answered = await call(handler, 'POST', { headers: { authorization: basic(password), origin: environment.APP_ORIGIN },
    body: `resolve=${question.id}&answer=Hold+at+%2432%2C500&reply=` });
  assert.equal(answered.headers.location, '/api/ops');
  const answers = await pendingAnswers(sql, 'duet-deals');
  assert.deepEqual(answers.map(row => [row.answer, row.question, Number(row.question_id)]), [['Hold at $32,500', 'Counter at $33,000?', Number(question.id)]]);
  assert.equal((await pendingAnswers(sql, 'duet-forms')).length, 0, 'each agent sees only its own answers');
  await pg.query(`INSERT INTO deal_events (onboarding_id, kind, note, source_message_id) VALUES ($1, 'note', 'Countered', $2)`, [pat.id, `answer:${answers[0].resolved_id}`]);
  assert.equal((await pendingAnswers(sql)).length, 0, 'an acked answer stops being listed');
  const detailAfter = await call(handler, 'GET', { url: `/api/ops?deal=${pat.id}`, headers: { authorization: basic(password) } });
  assert.ok(detailAfter.body.includes('<span class="tag good">Answered</span> Hold at $32,500'), 'the answer sits under its question');
  assert.ok(!detailAfter.body.includes('>Resolved</span>'), 'resolved rows fold into their question');

  // The home page opens each open deal from a tile, and the week's activity is one line per deal per day.
  assert.ok(after.body.includes(`class="tile" href="/api/ops?deal=${pat.id}"`) || after.body.includes(`class="tile stale" href="/api/ops?deal=${pat.id}"`));
  assert.ok(after.body.includes('<h3 class="day">Today</h3>'));
  assert.ok(!after.body.split('<h2>Last 7 days')[1].includes('Filled in the e-price form'), 'notes stay on the deal page');

  // Mason updates a deal from its page; each change is one row with actor mason.
  const post = body => call(handler, 'POST', { headers: { authorization: basic(password), origin: environment.APP_ORIGIN }, body });
  assert.equal((await call(handler, 'POST', { headers: { authorization: basic(password), origin: 'https://evil.example' }, body: `edit=close&deal=${sam.id}` })).statusCode, 403);
  assert.equal((await post(`edit=agreed&deal=${pat.id}&dealer=North+Toyota&otd=abc`)).statusCode, 400, 'a price that isn\'t one is refused');
  assert.equal((await post(`edit=note&deal=${crypto.randomUUID()}&note=hi`)).statusCode, 400, 'an unknown deal is refused');
  const agreed = await post(`edit=agreed&deal=${pat.id}&dealer=North+Toyota&otd=%2431%2C950&vin=2T3P1RFV5SW000001`);
  assert.equal(agreed.statusCode, 303);
  assert.equal(agreed.headers.location, `/api/ops?deal=${pat.id}`);
  await post(`edit=drop&deal=${pat.id}&dealer=South+Toyota`);
  await post(`edit=close&deal=${sam.id}&outcome=Bought&note=North+Toyota+at+%2430k`);
  const mason = (await pg.query(`SELECT onboarding_id, kind, dealer_name, vin, otd_cents, note FROM deal_events WHERE actor = 'mason' AND kind <> 'resolved' ORDER BY id`)).rows;
  assert.deepEqual(mason.map(row => [row.kind, row.dealer_name, row.vin, row.otd_cents, row.note]), [
    ['agreed', 'North Toyota', '2T3P1RFV5SW000001', 3195000, null],
    ['dropped', 'South Toyota', null, null, null],
    ['closed', null, null, null, 'Bought: North Toyota at $30k']]);
  const home = await call(handler, 'GET', { headers: { authorization: basic(password) } });
  const openPart = home.body.split('<h2>Open deals')[1].split('Closed in the last 30 days')[0];
  assert.ok(openPart.includes('Pat &lt;Buyer&gt;') && !openPart.includes('Sam Quiet'), 'the closed deal leaves the open tiles');
  assert.ok(home.body.includes('Bought: North Toyota at $30k'), 'closed deals show how they ended');
  const samPage = await call(handler, 'GET', { url: `/api/ops?deal=${sam.id}`, headers: { authorization: basic(password) } });
  assert.ok(samPage.body.includes('value="reopen"'), 'a closed deal can be reopened');
  await post(`edit=reopen&deal=${sam.id}`);
  const reopened = await call(handler, 'GET', { headers: { authorization: basic(password) } });
  assert.ok(reopened.body.split('<h2>Open deals')[1].split('<h2>')[0].includes('Sam Quiet'));

  await assert.rejects(pg.query(`INSERT INTO deal_events (onboarding_id, kind) VALUES ($1, 'resolved')`, [pat.id]), /deal_events_resolves_valid/);
  await assert.rejects(pg.query(`INSERT INTO deal_events (onboarding_id, kind, options) VALUES ($1, 'note', '["x"]')`, [pat.id]), /deal_events_options_valid/);
  await assert.rejects(pg.query(`INSERT INTO deal_events (onboarding_id, kind, resolves_event_id) VALUES ($1, 'note', $2)`, [pat.id, need.id]), /deal_events_resolves_valid/);
});

test('a deal in Confirming search shows once as a tile and once as waiting for a car search', async t => {
  t.mock.method(console, 'error', () => {});
  const pg = await PGlite.create();
  t.after(() => pg.close());
  for (const migration of migrations) await pg.exec(migration);
  const sql = tagged(pg);
  const { intake, log } = await seed(pg);
  const casey = await intake('Casey Confirming', 'Austin, TX', { confirming: true });
  const old = await intake('Old Paid', 'Houston, TX', { deal: false });
  const shut = await intake('Shut Confirming', 'Waco, TX', { confirming: true });
  await log(shut.id, 'closed', { note: 'Refunded', hoursAgo: 5 });
  await intake('Pat Shortlisted', 'Dallas, TX');

  const handler = opsHandler({ environment, getDatabase: () => sql });
  const page = await call(handler, 'GET', { headers: { authorization: basic(password) } });
  assert.equal(page.statusCode, 200);
  const [, openPart] = page.body.split('<h2>Open deals');
  const tiles = openPart.split('<h2>Needs you')[0];
  const needs = page.body.split('<h2>Needs you')[1].split('<h2>')[0];
  assert.equal(tiles.split(`href="/api/ops?deal=${casey.id}"`).length - 1, 1, 'one tile for the confirming deal');
  assert.ok(tiles.includes('Confirming search') && tiles.includes('Search not run yet') && tiles.includes('No car picked yet'));
  assert.ok(!tiles.includes('Target —'));
  assert.equal(needs.split('Casey Confirming').length - 1, 1, 'listed once under Needs you');
  assert.ok(needs.includes(casey.id) && needs.includes('Paid intake with no car search yet'));
  assert.ok(needs.includes('Old Paid') && needs.includes(old.id), 'an intake from before the Deal Tracker still waits');
  assert.ok(!needs.includes('Shut Confirming') && !needs.includes('Pat Shortlisted'), 'closed or shortlisted deals do not wait');
  assert.ok(!needs.includes('Quiet'), 'a confirming deal is never quiet');
  assert.ok(page.body.includes('<h2>Needs you (2)</h2>'));

  const detail = await call(handler, 'GET', { url: `/api/ops?deal=${casey.id}`, headers: { authorization: basic(password) } });
  assert.equal(detail.statusCode, 200);
  assert.ok(detail.body.includes('<b>Confirming search</b>') && detail.body.includes('No cars on the shortlist.') && detail.body.includes('Nothing logged yet.'));

  const alertEnv = { OPS_ALERT_EMAIL: 'alerts@example.test', INTAKE_SMTP_USER: 'mason@steermeright.com', INTAKE_SMTP_PASSWORD: 'not-real' };
  const digest = await digestEmail(sql, opsAlertSettings(alertEnv));
  assert.ok(digest.text.includes('Casey Confirming (Austin, TX)') && !digest.text.includes('Quiet for 2+ days'));
  assert.equal(digest.subject, 'Deals this morning: 2 need you');
});

test('the deal page\'s shortlist shows each car\'s best price so far', async t => {
  t.mock.method(console, 'error', () => {});
  const pg = await PGlite.create();
  t.after(() => pg.close());
  for (const migration of migrations) await pg.exec(migration);
  const sql = tagged(pg);
  const { intake, log } = await seed(pg);
  const pat = await intake('Pat Buyer', 'Austin, TX');
  await log(pat.id, 'quote', { dealer: 'North Toyota', vin: '2T3P1RFV5SW000001', otd: 3230000, hoursAgo: 5 });
  await log(pat.id, 'quote', { dealer: 'Lake Toyota', vin: '2T3P1RFV5SW000001', otd: 3190000, hoursAgo: 4 });
  await log(pat.id, 'quote', { dealer: 'Lake Toyota', vin: '2T3P1RFV5SW000001', otd: 3290000, hoursAgo: 3 });
  await log(pat.id, 'counter', { dealer: 'South Toyota', vin: '2T3P1RFV5SW000002', otd: 2900000, hoursAgo: 2 });

  const handler = opsHandler({ environment, getDatabase: () => sql });
  const detail = await call(handler, 'GET', { url: `/api/ops?deal=${pat.id}`, headers: { authorization: basic(password) } });
  assert.equal(detail.statusCode, 200);
  const shortlist = detail.body.split('<h2>Shortlist')[1].split('<h2>')[0];
  assert.ok(shortlist.includes('<th class="num">Target</th><th class="num">Best so far</th>'));
  const [quoted, unquoted] = shortlist.split('<tbody>')[1].split('</tr>');
  assert.ok(quoted.includes('$32,300<br><span class="muted">North Toyota</span>'), 'Lake Toyota raised its price, so North Toyota is lowest');
  assert.ok(!quoted.includes('$31,900') && !quoted.includes('Lake Toyota'));
  assert.ok(unquoted.includes('2025 Toyota RAV4 LE') && /\$31,000<\/td>\s*<td class="num">—<\/td>/.test(unquoted) &&!unquoted.includes('$29,000'), 'a counter is not a price');
});

test('ops alerts email each new question and overdue agent once, plus one morning digest', async t => {
  t.mock.method(console, 'error', () => {});
  const pg = await PGlite.create();
  t.after(() => pg.close());
  for (const migration of migrations) await pg.exec(migration);
  const sql = tagged(pg);
  const { intake, log } = await seed(pg);
  const pat = await intake('Pat Buyer', 'Austin, TX');
  await log(pat.id, 'quote', { dealer: 'North Toyota', vin: '2T3P1RFV5SW000001', otd: 3230000, hoursAgo: 3 });
  const [need] = (await log(pat.id, 'needs_mason', { dealer: 'North Toyota', note: 'Approve the $500 deposit?', options: ['Approve', 'Decline'], hoursAgo: 1 })).rows;
  await log(pat.id, 'needs_mason', { note: 'Old question', hoursAgo: 72 });

  const alertEnv = { OPS_ALERT_EMAIL: 'alerts@example.test', INTAKE_SMTP_USER: 'mason@steermeright.com', INTAKE_SMTP_PASSWORD: 'not-real' };
  assert.equal(opsAlertSettings({}), null);
  assert.throws(() => opsAlertSettings({ OPS_ALERT_EMAIL: 'alerts@example.test' }), ConfigError);
  const sent = [];
  const createTransport = () => ({ async sendMail(mail) { sent.push(mail); }, close() {} });
  const morning = Date.parse('2026-11-20T15:00:00Z'); // 9 am Central
  const night = Date.parse('2026-11-20T09:00:00Z'); // 3 am Central
  await pg.query(`INSERT INTO agent_runs (actor, ran_at, expect_minutes) VALUES ('duet-inbox', $1, 10)`, [new Date(night - 2 * 3600000).toISOString()]);

  assert.equal((await dispatchOpsAlerts({ sql, environment: alertEnv, createTransport, now: night })).sent, 2, 'no digest before 8 am');
  assert.deepEqual(sent.map(mail => mail.subject).sort(), ['Agent overdue: duet-inbox', 'Needs you: Pat Buyer · North Toyota']);
  const needMail = sent.find(mail => mail.subject.startsWith('Needs you'));
  assert.equal(needMail.to, 'alerts@example.test');
  assert.ok(needMail.text.includes('Answers offered: Approve / Decline') && needMail.text.includes(`/api/ops?deal=${pat.id}`));
  assert.ok(!sent.some(mail => mail.text.includes('Old question')), 'a question older than two days is left to the digest');

  await dispatchOpsAlerts({ sql, environment: alertEnv, createTransport, now: morning });
  await dispatchOpsAlerts({ sql, environment: alertEnv, createTransport, now: morning });
  assert.equal(sent.length, 3, 'one digest a day, and nothing sent twice');
  const digest = sent[2];
  assert.equal(digest.subject, 'Deals this morning: 3 need you');
  assert.ok(digest.text.includes('Pat Buyer: Approve the $500 deposit?') && digest.text.includes('duet-inbox: last ran'));
  assert.ok(digest.html.includes('<p style="margin:16px 0 4px;font-weight:600">Questions from your agents</p>'));
  assert.ok(!digest.text.includes('buyer@example.test'));

  // A question answered before its email goes out is skipped.
  const [late] = (await log(pat.id, 'needs_mason', { note: 'Late one', hoursAgo: 0 })).rows;
  await pg.query(`INSERT INTO ops_alert_outbox (dedupe_key, kind, event_id) VALUES ($1, 'needs_mason', $2)`, [`need:${late.id}`, late.id]);
  await log(pat.id, 'resolved', { resolves: late.id });
  const skipped = await dispatchOpsAlerts({ sql, environment: alertEnv, createTransport, now: morning });
  assert.deepEqual([skipped.sent, skipped.skipped], [0, 1]);
  assert.equal(Number(need.id) > 0, true);

  const failing = () => ({ async sendMail() { throw Object.assign(new Error('535 auth failed for mason'), { code: 'EAUTH' }); }, close() {} });
  await log(pat.id, 'needs_mason', { note: 'Another', hoursAgo: 0 });
  const failed = await dispatchOpsAlerts({ sql, environment: alertEnv, createTransport: failing, now: morning });
  assert.equal(failed.failed, 1);
  assert.deepEqual((await pg.query(`SELECT last_error FROM ops_alert_outbox WHERE status = 'failed'`)).rows, [{ last_error: 'Ops alert failed (EAUTH)' }]);
});

test('the dispatcher runs only the jobs it is asked for', async () => {
  const ran = [];
  const worker = name => async () => { ran.push(name); return { exitCode: 0, sent: 0 }; };
  const handler = outboxHandler({
    environment: { CRON_SECRET: 's'.repeat(40), OPS_ALERT_EMAIL: 'alerts@example.test', INTAKE_SMTP_USER: 'mason@steermeright.com', INTAKE_SMTP_PASSWORD: 'x' },
    getDatabase: () => ({}), opsAlertWorker: worker('ops_alerts'), intakeEmailWorker: worker('intake_email'), logger: { error() {} }
  });
  const res = response();
  await handler(request('GET', { url: '/api/outbox-dispatch?jobs=ops_alerts', headers: { authorization: `Bearer ${'s'.repeat(40)}` } }), res);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(ran, ['ops_alerts']);
  assert.deepEqual(Object.keys(JSON.parse(res.body).workers), ['ops_alerts']);
  const bad = response();
  await handler(request('GET', { url: '/api/outbox-dispatch?jobs=nope', headers: { authorization: `Bearer ${'s'.repeat(40)}` } }), bad);
  assert.equal(bad.statusCode, 400);
});

test('an agent is overdue only after missing two of its stated runs', () => {
  const now = Date.parse('2026-11-20T12:00:00Z');
  const at = minutes => new Date(now - minutes * 60000).toISOString();
  const status = agentStatus([
    { actor: 'late', last_run: at(26), expect_minutes: 10 }, { actor: 'fine', last_run: at(24), expect_minutes: 10 },
    { actor: 'unknown', last_run: at(600), expect_minutes: null }
  ], [{ actor: 'logger-only', last_logged: at(5) }], now);
  assert.deepEqual(status.map(agent => [agent.actor, agent.overdue]), [['late', true], ['fine', false], ['logger-only', false], ['unknown', false]]);
});

test('alert payloads go to Postgres as text, so postgres.js can\'t encode them twice', async () => {
  const queries = [];
  const sql = async (strings, ...values) => {
    const query = strings.join('?');
    queries.push(query);
    return query.includes('agent_runs') ? [{ actor: 'duet-deals', last_run: '2026-11-01T12:00:00Z', expect_minutes: 10, note: null }] : [];
  };
  await queueAlerts(sql, { digestHour: 0 }, Date.parse('2026-11-25T18:00:00Z'));
  const inserts = queries.filter(query => query.includes('INSERT INTO ops_alert_outbox (dedupe_key, kind, payload)'));
  assert.equal(inserts.length, 2, 'an overdue agent and the digest');
  for (const insert of inserts) assert.match(insert, /\?::text::jsonb\)/);
});

test('/api/ops magic link emails a 10-minute link, confirms on POST, and sets a 30-day session cookie', async t => {
  t.mock.method(console, 'error', () => {});
  const pg = await PGlite.create();
  t.after(() => pg.close());
  for (const migration of migrations) await pg.exec(migration);
  const sql = tagged(pg);
  const { intake } = await seed(pg);
  const pat = await intake('Pat Cookie', 'Austin, TX');

  let clock = Date.parse('2026-11-25T20:00:00Z');
  const sent = [];
  const createTransport = () => ({ async sendMail(mail) { sent.push(mail); }, close() {} });
  const env = {
    ...environment,
    OPS_ALERT_EMAIL: 'mason@steermeright.com',
    INTAKE_SMTP_USER: 'mason@steermeright.com',
    INTAKE_SMTP_PASSWORD: 'app-password-for-tests'
  };
  const handler = opsHandler({ environment: env, getDatabase: () => sql, now: () => clock, createTransport });

  // Visiting a deal while signed out shows the magic-link form preserving the deal ID.
  const gate = await call(handler, 'GET', { url: `/api/ops?deal=${pat.id}` });
  assert.equal(gate.statusCode, 401);
  assert.equal(gate.headers['www-authenticate'], undefined);
  assert.ok(gate.body.includes('Email me a sign-in link'));
  assert.ok(gate.body.includes(`name="deal" value="${pat.id}"`));
  assert.ok(!gate.body.includes('Pat Cookie'));
  const challenge = /name="challenge" value="([^"]+)"/.exec(gate.body)?.[1];
  assert.ok(challenge);

  // Blind POST without a valid challenge or from another origin is refused.
  assert.equal((await call(handler, 'POST', { headers: { origin: 'https://evil.example' }, body: `auth=send&challenge=${challenge}` })).statusCode, 403);
  assert.equal((await call(handler, 'POST', { headers: { origin: 'null', 'sec-fetch-site': 'cross-site' }, body: `auth=send&challenge=${challenge}` })).statusCode, 403);
  assert.equal((await call(handler, 'POST', { headers: { origin: 'null' }, body: `auth=send&challenge=${challenge}` })).statusCode, 403);
  assert.equal((await call(handler, 'POST', { headers: { origin: env.APP_ORIGIN }, body: 'auth=send&challenge=bad' })).statusCode, 400);
  // Same-origin browser form POST with Origin: null (e.g. under no-referrer) is allowed when Sec-Fetch-Site is same-origin.
  assert.equal((await call(handler, 'POST', { headers: { origin: 'null', 'sec-fetch-site': 'same-origin' }, body: 'auth=send&challenge=bad' })).statusCode, 400);
  assert.equal(sent.length, 0);

  // Honeypot silently skips sending mail.
  const bot = await call(handler, 'POST', { headers: { origin: env.APP_ORIGIN }, body: `auth=send&challenge=${encodeURIComponent(challenge)}&website=https://spam.example` });
  assert.equal(bot.statusCode, 200);
  assert.equal(sent.length, 0);

  // Legitimate request sends one email to OPS_ALERT_EMAIL using canonical APP_ORIGIN (ignoring spoofed Host).
  const reqSend = await call(handler, 'POST', {
    headers: { host: 'spoofed.example', origin: 'https://spoofed.example' },
    body: `auth=send&challenge=${encodeURIComponent(challenge)}&deal=${pat.id}`
  });
  assert.equal(reqSend.statusCode, 200);
  assert.ok(reqSend.body.includes('Check your inbox'));
  assert.equal(sent.length, 1);
  assert.equal(sent[0].to, 'mason@steermeright.com');
  const linkMatch = /https:\/\/www\.steermeright\.com\/api\/ops\?login=([A-Za-z0-9._%-]+)/.exec(sent[0].text);
  assert.ok(linkMatch, 'email carries a magic link on canonical APP_ORIGIN');
  const token = decodeURIComponent(linkMatch[1]);

  // Rapid repeat within 60 seconds does not spam SMTP.
  await call(handler, 'POST', { headers: { origin: env.APP_ORIGIN }, body: `auth=send&challenge=${encodeURIComponent(challenge)}` });
  assert.equal(sent.length, 1);

  // GET ?login=<token> is mail-scanner safe: no Set-Cookie, no deal data, just the POST button.
  const landing = await call(handler, 'GET', { url: `/api/ops?login=${encodeURIComponent(token)}` });
  assert.equal(landing.statusCode, 200);
  assert.equal(landing.headers['set-cookie'], undefined);
  assert.ok(landing.body.includes('name="auth" value="verify"') && !landing.body.includes('Pat Cookie'));

  // POST auth=verify sets the 30-day HttpOnly Secure SameSite=Lax cookie and redirects to the deal.
  const verified = await call(handler, 'POST', {
    headers: { origin: env.APP_ORIGIN },
    body: `auth=verify&token=${encodeURIComponent(token)}`
  });
  assert.equal(verified.statusCode, 303);
  assert.equal(verified.headers.location, `/api/ops?deal=${pat.id}`);
  const setCookie = verified.headers['set-cookie'];
  assert.match(setCookie, /^ops_session=s1\.\d+\.[A-Za-z0-9_-]{43}; Path=\/api\/ops; Max-Age=2592000; HttpOnly; SameSite=Lax; Secure$/);
  const cookie = setCookie.split(';')[0];

  // The cookie opens the dashboard and deal page without Basic auth for 30 days.
  const dealPage = await call(handler, 'GET', { url: `/api/ops?deal=${pat.id}`, headers: { cookie } });
  assert.equal(dealPage.statusCode, 200);
  assert.ok(dealPage.body.includes('Pat Cookie'));

  // Advance 29 days: still signed in.
  clock += 29 * 86400 * 1000;
  assert.equal((await call(handler, 'GET', { headers: { cookie } })).statusCode, 200);

  // Expired magic link is rejected (both GET and POST).
  const expiredLink = await call(handler, 'GET', { url: `/api/ops?login=${encodeURIComponent(token)}` });
  assert.equal(expiredLink.statusCode, 401);
  assert.ok(expiredLink.body.includes('expired or is invalid'));
  assert.equal((await call(handler, 'POST', { headers: { origin: env.APP_ORIGIN }, body: `auth=verify&token=${encodeURIComponent(token)}` })).statusCode, 401);

  // Advance past 30 days: session cookie expires.
  clock += 2 * 86400 * 1000;
  assert.equal((await call(handler, 'GET', { headers: { cookie } })).statusCode, 401);

  // Password form fallback sets a 30-day session cookie; wrong password returns 401.
  assert.equal((await call(handler, 'POST', { headers: { origin: env.APP_ORIGIN }, body: 'auth=password&password=wrong' })).statusCode, 401);
  const passLogin = await call(handler, 'POST', {
    headers: { origin: env.APP_ORIGIN },
    body: `auth=password&password=${encodeURIComponent(password)}&deal=${pat.id}`
  });
  assert.equal(passLogin.statusCode, 303);
  assert.equal(passLogin.headers.location, `/api/ops?deal=${pat.id}`);
  const passCookie = passLogin.headers['set-cookie'].split(';')[0];
  assert.equal((await call(handler, 'GET', { headers: { cookie: passCookie } })).statusCode, 200);

  // Rotating OPS_PASSWORD immediately invalidates existing session cookies.
  const rotated = opsHandler({ environment: { ...env, OPS_PASSWORD: 'brand-new-ops-password-0123456789' }, getDatabase: () => sql, now: () => clock, createTransport });
  assert.equal((await call(rotated, 'GET', { headers: { cookie: passCookie } })).statusCode, 401);

  // Sign out clears the cookie and redirects to /api/ops.
  const out = await call(handler, 'POST', { headers: { origin: env.APP_ORIGIN, cookie: passCookie }, body: 'auth=logout' });
  assert.equal(out.statusCode, 303);
  assert.equal(out.headers.location, '/api/ops');
  assert.match(out.headers['set-cookie'], /^ops_session=; Path=\/api\/ops; Max-Age=0; HttpOnly; SameSite=Lax; Secure$/);
});
