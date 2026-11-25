import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { PGlite } from '@electric-sql/pglite';
import { dealTrackerSettings, signLink } from '../_lib/deal-tracker.js';
import { dealerNameWarning } from '../_lib/buyer-updates.js';
import { loadDashboard } from '../_lib/ops-dashboard.js';
import { renderBuyerUpdateEmail } from '../_lib/buyer-update-email.js';
import { dealTrackerHandler } from '../deal-tracker.js';
import { outboxHandler } from '../outbox-dispatch.js';
import { opsHandler } from '../ops.js';

// The Deal Tracker panel on the ops dashboard's deal page (plan, "Ops dashboard
// panel"), the Buyer Update email and the text number.

const password = 'ops-password-for-tests-only-0123456789';
const SECRET = 'deal-tracker-secret-for-tests-only-0123456789';
const ORIGIN = 'https://www.steermeright.com';
const environment = { OPS_PASSWORD: password, APP_ORIGIN: ORIGIN, DEAL_TRACKER_ENABLED: '1', DEAL_TRACKER_SECRET: SECRET };
const off = { OPS_PASSWORD: password, APP_ORIGIN: ORIGIN };
const basic = `Basic ${Buffer.from(`mason:${password}`).toString('base64')}`;
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
  sql.json = value => JSON.stringify(value);
  return sql;
}

async function database(t) {
  const pg = await PGlite.create();
  t.after(() => pg.close());
  for (const migration of migrations) await pg.exec(migration);
  return pg;
}

// A paid intake with its deal and link, shortlisted at two dealers.
async function intake(pg, { link = true } = {}) {
  const id = crypto.randomUUID(), attempt = crypto.randomUUID(), purchase = crypto.randomUUID(), session = `cs_live_${id}`, dealId = crypto.randomUUID();
  await pg.query(`INSERT INTO checkout_attempts (id, client_reference_id, idempotency_key, request_hash, tier_id, expected_amount, status)
    VALUES ($1, $1, $2, $3, 'full_service', 39500, 'paid')`, [attempt, attempt, 'a'.repeat(64)]);
  await pg.query(`INSERT INTO stripe_events (event_id, event_type, checkout_session_id, livemode, stripe_created_at)
    VALUES ($1, 'checkout.session.completed', $1, true, now())`, [session]);
  await pg.query(`INSERT INTO purchases (id, checkout_session_id, checkout_attempt_id, client_reference_id, stripe_event_id,
    stripe_payment_intent_id, tier_id, amount_total, currency, payment_status, livemode, paid_at)
    VALUES ($1, $2, $3, $3, $2, 'pi_1', 'full_service', 39500, 'usd', 'paid', true, now())`, [purchase, session, attempt]);
  await pg.query(`INSERT INTO onboarding_submissions (id, checkout_session_id, purchase_id, idempotency_key, request_hash, tier_id, name, email, phone, city, fields)
    VALUES ($1, $2, $3, $5, $4, 'full_service', 'Riley Buyer', 'riley.buyer@example.test', '205-555-0100', 'Austin', '{"preferred_makes":"Toyota RAV4"}')`,
  [id, session, purchase, 'b'.repeat(64), id]);
  await pg.query(`INSERT INTO deals (id, onboarding_id, shortlisted_at) VALUES ($1, $2, now() - interval '3 days')`, [dealId, id]);
  await pg.query(`INSERT INTO deal_listings (id, deal_id, rank, title, price_cents, vin, listing_url, dealer_name)
    VALUES ($1, $2, 1, '2025 Toyota RAV4 XLE', 3400000, '2T3P1RFV5SW000001', 'https://dealer.example/rav4', 'Zzyzx Motors'),
           ($3, $2, 2, '2025 Toyota RAV4 LE', 3200000, '2T3P1RFV5SW000002', 'https://other.example/rav4', 'Quorra Auto Haus')`,
  [crypto.randomUUID(), dealId, crypto.randomUUID()]);
  if (link) await pg.query('INSERT INTO deal_tracker_links (onboarding_id) VALUES ($1)', [id]);
  return id;
}

const agentDraft = async (pg, id, body) =>
  (await pg.query(`INSERT INTO buyer_updates (onboarding_id, body, actor) VALUES ($1, $2, 'deal-desk') RETURNING id`, [id, body])).rows[0].id;

function request(method, { url = '/api/ops', headers = {}, body } = {}) {
  const req = Readable.from(body ? [Buffer.from(body)] : []);
  Object.assign(req, { method, url, headers: { host: 'www.steermeright.com', ...headers } });
  return req;
}
function response() {
  return {
    statusCode: 200, headers: {}, body: '',
    setHeader(name, value) { this.headers[name.toLowerCase()] = value; },
    getHeader(name) { return this.headers[name.toLowerCase()]; },
    end(body = '') { this.body = String(body); }
  };
}
function ops(pg, env = environment) {
  const handler = opsHandler({ environment: env, getDatabase: () => tagged(pg) });
  const call = async (method, options) => { const res = response(); await handler(request(method, options), res); return res; };
  return {
    page: id => call('GET', { url: `/api/ops?deal=${id}`, headers: { authorization: basic } }),
    home: () => call('GET', { headers: { authorization: basic } }),
    post: fields => call('POST', { headers: { authorization: basic, origin: ORIGIN }, body: new URLSearchParams(fields).toString() })
  };
}
async function buyerPage(pg, token) {
  const res = response();
  await dealTrackerHandler({ environment, getDatabase: () => tagged(pg) })(request('GET', { url: `/api/deal-tracker?t=${encodeURIComponent(token)}` }), res);
  return res;
}
const updates = async (pg, id) => (await pg.query('SELECT id, body, status, actor, ready_for_pick, on_masons_say, posted_at, retracted_at FROM buyer_updates WHERE onboarding_id = $1 ORDER BY id', [id])).rows;

test('Mason posts a Buyer Update from the ops page and the buyer sees it; an empty one is not saved', async t => {
  const pg = await database(t);
  const id = await intake(pg);
  const { post } = ops(pg);

  const posted = await post({ tracker: 'post', deal: id, body: 'PANEL-SENTINEL Two prices are in.\r\n\r\nMore tomorrow.', ready_for_pick: '1' });
  assert.equal(posted.statusCode, 303);
  assert.equal(posted.headers.location, `/api/ops?deal=${id}`);
  const [row] = await updates(pg, id);
  assert.deepEqual([row.actor, row.status, row.ready_for_pick, row.body], ['mason', 'posted', true, 'PANEL-SENTINEL Two prices are in.\n\nMore tomorrow.']);
  const seen = await buyerPage(pg, signLink(SECRET, id, 1));
  assert.ok(seen.body.includes('Latest from Mason') && seen.body.includes('PANEL-SENTINEL Two prices are in.'));

  await post({ tracker: 'post', deal: id, body: 'no tick' });
  assert.equal((await updates(pg, id))[1].ready_for_pick, false);

  for (const body of ['', '   \r\n ', 'x'.repeat(4001)]) {
    const refused = await post({ tracker: 'post', deal: id, body });
    assert.equal(refused.statusCode, 400);
    assert.match(refused.body, /Not saved/);
  }
  assert.equal((await updates(pg, id)).length, 2, 'nothing refused was written');
  // A 4,000-character update fits, even with every character encoded in the form.
  assert.equal((await post({ tracker: 'post', deal: id, body: '’'.repeat(4000) })).statusCode, 303);
});

test('approve, discard and take back change the row, only for an update on that deal', async t => {
  const pg = await database(t);
  const id = await intake(pg);
  const other = await intake(pg);
  const { post } = ops(pg);
  const approve = await agentDraft(pg, id, 'APPROVE-SENTINEL');
  const discard = await agentDraft(pg, id, 'DISCARD-SENTINEL');
  const foreign = await agentDraft(pg, other, 'FOREIGN-SENTINEL');

  assert.equal((await post({ tracker: 'approve', deal: id, update: String(approve) })).statusCode, 303);
  assert.equal((await post({ tracker: 'approve', deal: id, update: String(approve) })).statusCode, 303, 'a repeat is harmless');
  assert.equal((await post({ tracker: 'discard', deal: id, update: String(discard) })).statusCode, 303);
  const rows = await updates(pg, id);
  assert.equal(rows[0].status, 'posted');
  assert.equal(rows[0].on_masons_say, true);
  assert.ok(rows[0].posted_at);
  assert.equal(rows[1].status, 'retracted');
  assert.equal(rows[1].posted_at, null);
  const { rows: [due] } = await pg.query(`SELECT email_after > now() + interval '4 minutes' AS held FROM buyer_updates WHERE id = $1`, [approve]);
  assert.equal(due.held, true, 'the take-back window starts at approval');

  assert.equal((await post({ tracker: 'retract', deal: id, update: String(approve) })).statusCode, 303);
  const [taken] = await updates(pg, id);
  assert.equal(taken.status, 'retracted');
  assert.ok(taken.retracted_at);
  assert.ok(!(await buyerPage(pg, signLink(SECRET, id, 1))).body.includes('APPROVE-SENTINEL'));

  for (const action of ['approve', 'discard', 'retract']) {
    const refused = await post({ tracker: action, deal: id, update: String(foreign) });
    assert.equal(refused.statusCode, 400, action);
  }
  assert.equal((await post({ tracker: 'approve', deal: id, update: 'abc' })).statusCode, 400);
  assert.equal((await post({ tracker: 'wipe', deal: id })).statusCode, 400);
  assert.equal((await updates(pg, other))[0].status, 'draft', 'another deal\'s update is untouched');
});

test('revoke, restore and reissue the buyer\'s link from the ops page', async t => {
  const pg = await database(t);
  const id = await intake(pg);
  const { post, page } = ops(pg);
  const first = signLink(SECRET, id, 1);
  assert.ok((await page(id)).body.includes(`${ORIGIN}/deal/${first}`), 'the link is on the panel');

  await post({ tracker: 'revoke', deal: id });
  assert.equal((await buyerPage(pg, first)).statusCode, 410);
  assert.ok((await page(id)).body.includes('Restore link'));
  await post({ tracker: 'restore', deal: id });
  assert.equal((await buyerPage(pg, first)).statusCode, 200);

  await post({ tracker: 'reissue', deal: id, version: '1' });
  await post({ tracker: 'reissue', deal: id, version: '1' });
  const { rows: [link] } = await pg.query('SELECT version, revoked_at FROM deal_tracker_links WHERE onboarding_id = $1', [id]);
  assert.equal(link.version, 2, 'a double submit reissues once');
  assert.equal((await buyerPage(pg, first)).statusCode, 404);
  const second = signLink(SECRET, id, 2);
  const panel = await page(id);
  assert.ok(panel.body.includes(`${ORIGIN}/deal/${second}`) && !panel.body.includes(first), 'the new link replaces the old one on the panel');
  assert.equal((await buyerPage(pg, second)).statusCode, 200);

  const unlinked = await intake(pg, { link: false });
  const before = await page(unlinked);
  assert.ok(before.body.includes('<h2>Deal Tracker</h2>') && before.body.includes('no link') && !before.body.includes('name="tracker"'));
  assert.equal((await post({ tracker: 'post', deal: unlinked, body: 'hello' })).statusCode, 400);
});

test('the panel shows drafts to approve, warns about a dealer name before Quotes in, and escapes what agents write', async t => {
  const pg = await database(t);
  const id = await intake(pg);
  const { post, page } = ops(pg);
  await agentDraft(pg, id, 'Zzyzx Motors came down <script>alert(1)</script>');
  await post({ tracker: 'post', deal: id, body: 'quorra auto haus answered' });

  const before = (await page(id)).body;
  const panel = before.split('<h2>Deal Tracker</h2>')[1].split('<h2>Shortlist')[0];
  assert.ok(panel.includes('value="approve"') && panel.includes('value="discard"') && panel.includes('Draft by deal-desk'));
  assert.ok(panel.includes("Names Zzyzx Motors, which the buyer can't see yet"));
  assert.ok(panel.includes("Names Quorra Auto Haus, which the buyer can't see yet"), 'a posted update is checked too, whatever its case');
  assert.ok(panel.includes('&lt;script&gt;') && !before.includes('<script>'));
  assert.ok(panel.includes('Take back') && /Email leaves in about [45] min/.test(panel));
  assert.ok(panel.includes("The buyer's email leaves about five minutes after you post, unless you take it back."));
  assert.ok(before.indexOf('<h2>Update deal</h2>') < before.indexOf('<h2>Deal Tracker</h2>'));

  // From Quotes in the buyer's page names each car's dealer (adr/0003), so there's nothing to warn about.
  await pg.query(`INSERT INTO deal_events (onboarding_id, kind, actor, dealer_name, vin, otd_cents) VALUES ($1, 'quote', 'mason', 'Zzyzx Motors', '2T3P1RFV5SW000001', 3500000)`, [id]);
  assert.ok(!(await page(id)).body.includes('which the buyer can'), 'no warning once quotes are in');
  await post({ edit: 'agreed', deal: id, dealer: 'Zzyzx Motors', otd: '33000', vin: '2T3P1RFV5SW000001' });
  assert.ok(!(await page(id)).body.includes('which the buyer can'), 'no warning once a price is agreed');
});

test('switched off, the deal page has no Deal Tracker panel and a tracker POST changes nothing', async t => {
  const pg = await database(t);
  const id = await intake(pg);
  const { post, page } = ops(pg, off);
  await agentDraft(pg, id, 'OFF-SENTINEL');
  const shown = await page(id);
  assert.equal(shown.statusCode, 200);
  assert.ok(!shown.body.includes('Deal Tracker') && !shown.body.includes('OFF-SENTINEL'));
  for (const fields of [{ tracker: 'post', deal: id, body: 'hello' }, { tracker: 'revoke', deal: id }]) {
    assert.equal((await post(fields)).statusCode, 404);
  }
  assert.equal((await updates(pg, id)).length, 1);
  const { rows: [link] } = await pg.query('SELECT revoked_at FROM deal_tracker_links WHERE onboarding_id = $1', [id]);
  assert.equal(link.revoked_at, null);
});

test('the update email previews the start of the update, carries the link, and escapes the words', () => {
  const link = `${ORIGIN}/deal/${signLink(SECRET, crypto.randomUUID(), 1)}`;
  const words = 'The dealer came down again and I think there is more room on the doc fee. '.repeat(6);
  const email = renderBuyerUpdateEmail({ firstName: 'Riley', body: `<b>Good news</b> & more.\n\n${words}TAIL-SENTINEL`, link });
  assert.equal(email.subject, 'An update on your car search');
  assert.ok(email.text.includes(link) && email.html.includes(link));
  assert.ok(email.html.includes('&lt;b&gt;Good news&lt;/b&gt; &amp; more.') && !email.html.includes('<b>Good news'));
  assert.ok(!email.text.includes('TAIL-SENTINEL') && !email.html.includes('TAIL-SENTINEL'), 'only the start shows');
  const preview = email.text.split('\n').find(line => line.startsWith('<b>Good news'));
  assert.ok(preview.endsWith('…') && preview.length <= 281, preview);
  assert.match(preview, /[A-Za-z]…$/, 'cut at the end of a word');
  const last = preview.slice(0, -1).split(' ').at(-1);
  assert.match(words, new RegExp(`\\b${last}\\b`), 'no half word');
  assert.match(email.text, /Reply to this email/);
  assert.doesNotMatch(`${email.subject}\n${email.text}\n${email.html}`, /\bbriefs?\b/i);
  const short = renderBuyerUpdateEmail({ firstName: '', body: 'Short one.', link });
  assert.ok(short.text.includes('Short one.') && !short.text.includes('…'));
});

test('the text number buyers reach Mason at is a 10-digit US number, optional, and the old reply mailbox is ignored', () => {
  const base = { DEAL_TRACKER_ENABLED: '1', DEAL_TRACKER_SECRET: SECRET };
  assert.equal(dealTrackerSettings(base).text, null);
  for (const value of ['512-555-0142', '(512) 555-0142', '+1 512 555 0142', '15125550142']) {
    assert.deepEqual(dealTrackerSettings({ ...base, DEAL_TRACKER_TEXT_NUMBER: value }).text, { href: 'sms:+15125550142', label: '(512) 555-0142' }, value);
  }
  for (const bad of ['555-0142', '512-555-014x', '+44 20 7946 0958']) {
    assert.throws(() => dealTrackerSettings({ ...base, DEAL_TRACKER_TEXT_NUMBER: bad }), /DEAL_TRACKER_TEXT_NUMBER/, bad);
  }
  const settings = dealTrackerSettings({ ...base, DEAL_REPLY_MAILBOX: 'deals+x@not valid' });
  assert.ok(!('replyMailbox' in settings), 'DEAL_REPLY_MAILBOX is no longer read');
});

test('a dealer-name warning lists each named dealer once, ignoring case and spacing', () => {
  const names = ['Zzyzx Motors', 'Quorra Auto Haus', 'Vandelay Imports'];
  assert.deepEqual(dealerNameWarning('zzyzx  motors and QUORRA AUTO HAUS, then Zzyzx Motors again', names), ['Zzyzx Motors', 'Quorra Auto Haus']);
  assert.deepEqual(dealerNameWarning('Nothing named here', names), []);
});

test('?jobs=buyer_updates runs only the Buyer Update worker', async () => {
  const ran = [];
  const worker = name => async () => { ran.push(name); return { configured: true, claimed: 0, sent: 0, failed: 0, exhausted: 0, exitCode: 0 }; };
  const secret = 's'.repeat(40);
  const handler = outboxHandler({
    environment: { CRON_SECRET: secret, DEAL_TRACKER_ENABLED: '1', DEAL_TRACKER_SECRET: SECRET, OPS_ALERT_EMAIL: 'alerts@example.test',
      INTAKE_SMTP_USER: 'sender@example.test', INTAKE_SMTP_PASSWORD: 'x' },
    getDatabase: () => ({}), buyerUpdateWorker: worker('buyer_updates'), opsAlertWorker: worker('ops_alerts'), intakeEmailWorker: worker('intake_email'),
    logger: { error() {} }
  });
  const res = response();
  await handler(request('GET', { url: '/api/outbox-dispatch?jobs=buyer_updates', headers: { authorization: `Bearer ${secret}` } }), res);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(ran, ['buyer_updates']);
  assert.deepEqual(Object.keys(JSON.parse(res.body).workers), ['buyer_updates']);
});

test('switched off, loadDashboard runs today\'s queries and works on a database without db/013', async t => {
  const pg = await PGlite.create();
  t.after(() => pg.close());
  for (const migration of migrations.slice(0, -1)) await pg.exec(migration);
  const seen = [];
  const sql = async (strings, ...values) => {
    const query = strings.reduce((text, part, index) => text + (index ? `$${index}` : '') + part, '');
    seen.push(query);
    return (await pg.query(query, values)).rows;
  };
  const data = await loadDashboard(sql);
  assert.ok(!('picks' in data));
  assert.ok(seen.length && !seen.some(query => /buyer_/.test(query)));
  const res = response();
  await opsHandler({ environment: off, getDatabase: () => tagged(pg) })(request('GET', { headers: { authorization: basic } }), res);
  assert.equal(res.statusCode, 200);
});

// ---------- Buyer Picks (build step 5) ----------

const VINS = ['2T3P1RFV5SW000001', '2T3P1RFV5SW000002'];
// Quotes in on both cars and a "ready for your call" update, then a pick as the buyer's page writes it.
async function picked(pg, id, { kind = 'pick' } = {}) {
  await pg.query(`INSERT INTO deal_events (onboarding_id, kind, actor, dealer_name, vin, otd_cents, occurred_at)
    VALUES ($1, 'quote', 'deal-desk', 'Zzyzx Motors', $2, 3640000, now() - interval '1 day'),
           ($1, 'quote', 'deal-desk', 'Quorra Auto Haus', $3, 3690000, now() - interval '1 day')`, [id, ...VINS]);
  const { rows: [update] } = await pg.query(`INSERT INTO buyer_updates (onboarding_id, body, status, ready_for_pick, actor) VALUES ($1, 'Ready', 'posted', true, 'mason') RETURNING id`, [id]);
  const values = kind === 'pick' ? [VINS[0], 'Zzyzx Motors', 3640000] : [null, null, null];
  const { rows: [row] } = await pg.query(`INSERT INTO buyer_picks (onboarding_id, kind, opened_by_update_id, vin, dealer_name, otd_cents, created_at)
    VALUES ($1, $2, $3, $4, $5, $6, now() - interval '12 hours') RETURNING id`, [id, kind, update.id, ...values]);
  return Number(row.id);
}
const pickRows = async (pg, id) => (await pg.query('SELECT id, cleared_at, cleared_by FROM buyer_picks WHERE onboarding_id = $1 ORDER BY id', [id])).rows;
const panelOf = html => html.split('<h2>Buyer Pick')[1].split('<h2>Buyer Documents')[0];

test('the panel shows the standing pick as picked, warns when the price moved or the dealer was dropped, and lists past picks', async t => {
  const pg = await database(t);
  const id = await intake(pg);
  const { page } = ops(pg);
  const pick = await picked(pg, id);
  let html = (await page(id)).body;
  assert.ok(html.includes("Ready for your call opens the buyer's pick"));
  let panel = panelOf(html);
  assert.ok(html.includes('<h2>Buyer Pick (1)</h2>'));
  assert.ok(panel.includes('2025 Toyota RAV4 XLE') && panel.includes(`VIN ${VINS[0]}`) && panel.includes('$36,400 from Zzyzx Motors'));
  assert.ok(panel.includes('value="clear_pick"') && panel.includes(`name="pick" value="${pick}"`) && !panel.includes('warn-line'));

  await pg.query(`INSERT INTO deal_events (onboarding_id, kind, actor, dealer_name, vin, otd_cents) VALUES ($1, 'quote', 'deal-desk', 'Zzyzx Motors', $2, 3700000)`, [id, VINS[0]]);
  panel = panelOf((await page(id)).body);
  assert.ok(panel.includes('The price has moved since the pick: best so far is now $37,000') && panel.includes('$36,400 from Zzyzx Motors'));

  await pg.query(`INSERT INTO deal_events (onboarding_id, kind, actor, dealer_name) VALUES ($1, 'dropped', 'mason', 'Zzyzx Motors')`, [id]);
  panel = panelOf((await page(id)).body);
  assert.ok(panel.includes('Zzyzx Motors was dropped since the pick, so the buyer can pick again.'));

  await pg.query(`UPDATE buyer_picks SET cleared_at = now(), cleared_by = 'dealer_dropped' WHERE id = $1`, [pick]);
  html = (await page(id)).body;
  panel = panelOf(html);
  assert.ok(html.includes('<h2>Buyer Pick (0)</h2>') && panel.includes('No pick standing'));
  assert.ok(panel.includes('<li class="muted">') && panel.includes('cleared when the dealer was dropped') && !panel.includes('value="clear_pick"'));
});

test('Clear acts once, only on that deal\'s pick, and the buyer can pick again', async t => {
  const pg = await database(t);
  const id = await intake(pg);
  const other = await intake(pg);
  const { post, page } = ops(pg);
  const pick = await picked(pg, id);
  const foreign = await picked(pg, other, { kind: 'keep_looking' });
  for (const value of [String(foreign), 'abc', '']) assert.equal((await post({ tracker: 'clear_pick', deal: id, pick: value })).statusCode, 400, value);
  assert.equal((await pickRows(pg, other))[0].cleared_at, null, 'another deal\'s pick is untouched');

  assert.equal((await post({ tracker: 'clear_pick', deal: id, pick: String(pick) })).statusCode, 303);
  const [first] = await pickRows(pg, id);
  assert.equal(first.cleared_by, 'mason');
  assert.equal((await post({ tracker: 'clear_pick', deal: id, pick: String(pick) })).statusCode, 303, 'a repeat is harmless');
  assert.deepEqual(await pickRows(pg, id), [first], 'and changes nothing');
  assert.ok(panelOf((await page(id)).body).includes('cleared by you'));
  assert.ok((await buyerPage(pg, signLink(SECRET, id, 1))).body.includes('Pick this car at $36,400'), 'the round is open again');

  const switchedOff = await ops(pg, off).post({ tracker: 'clear_pick', deal: other, pick: String(foreign) });
  assert.equal(switchedOff.statusCode, 404);
  assert.equal((await pickRows(pg, other))[0].cleared_at, null);
});

test('the main dashboard tags a deal with a standing pick and lists it under Needs you; switched off, neither', async t => {
  const pg = await database(t);
  const pickedDeal = await intake(pg);
  const looking = await intake(pg);
  const dropped = await intake(pg);
  const quiet = await intake(pg);
  await picked(pg, pickedDeal);
  await picked(pg, looking, { kind: 'keep_looking' });
  await picked(pg, dropped);
  await pg.query(`INSERT INTO deal_events (onboarding_id, kind, actor, dealer_name) VALUES ($1, 'dropped', 'mason', 'Zzyzx Motors')`, [dropped]);

  const body = (await ops(pg).home()).body;
  const tile = deal => body.split('<h2>Open deals')[1].split('<h2>')[0].split('<a class="tile').find(part => part.includes(`deal=${deal}`));
  assert.ok(tile(pickedDeal).includes('<span class="tag">Pick made</span>'));
  assert.ok(tile(looking).includes('<span class="tag">Wants more options</span>'));
  assert.ok(!tile(dropped).includes('Pick made') && !tile(quiet).includes('Pick made'), 'a pick whose dealer was dropped no longer stands');
  const needs = body.split('<h2>Needs you')[1].split('<h2>')[0];
  assert.ok(body.includes('<h2>Needs you (2)</h2>'));
  assert.ok(needs.includes(`/api/ops?deal=${pickedDeal}`) && needs.includes('Picked the 2025 Toyota RAV4 XLE at $36,400 from Zzyzx Motors'));
  assert.ok(needs.includes(`/api/ops?deal=${looking}`) && needs.includes('Asked us to keep looking'));

  const switchedOff = (await ops(pg, off).home()).body;
  assert.ok(!switchedOff.includes('Pick made') && !switchedOff.includes('Wants more options') && switchedOff.includes('<h2>Needs you (0)</h2>'));
});

// Buyer Documents on the deal page: the list, and downloads behind the same sign-in.
const withStore = { ...environment, BLOB_READ_WRITE_TOKEN: 'vercel_blob_rw_token_for_tests_only' };
function memoryStore(files = new Map()) {
  const calls = [];
  return {
    files, calls,
    async get(pathname) { calls.push(pathname); const file = files.get(pathname); return file ? { body: file, size: file.length, contentType: 'application/pdf' } : null; },
    async presignUpload() { throw new Error('not here'); }, async head() { throw new Error('not here'); }, async del() { throw new Error('not here'); }
  };
}
const fileRow = async (pg, id, { docType = 'pre_approval', contentType = 'application/pdf', deleted = false } = {}) => {
  const path = `deals/${id}/${crypto.randomUUID()}.pdf`;
  const { rows: [row] } = await pg.query(`INSERT INTO buyer_documents (onboarding_id, doc_type, blob_path, content_type, bytes, deleted_at)
    VALUES ($1, $2, $3, $4, 2621440, $5) RETURNING id`, [id, docType, path, contentType, deleted ? '2026-12-01T12:00:00Z' : null]);
  return { id: Number(row.id), path };
};
async function download(pg, documentId, { env = withStore, store, auth = basic } = {}) {
  const res = response();
  await opsHandler({ environment: env, getDatabase: () => tagged(pg), documentStore: store })(
    request('GET', { url: `/api/ops?document=${documentId}`, headers: auth ? { authorization: auth } : {} }), res);
  return res;
}

test('the panel lists Buyer Documents with their size and a download, or when the file was deleted', async t => {
  const pg = await database(t);
  const id = await intake(pg);
  const live = await fileRow(pg, id);
  const gone = await fileRow(pg, id, { docType: 'id', deleted: true });
  const page = (await ops(pg).page(id)).body;
  const panel = page.split('<h2>Buyer Documents (2)</h2>')[1];
  assert.ok(panel, 'the section is there');
  assert.ok(panel.includes('<strong>Loan pre-approval</strong>') && panel.includes('· 2.5 MB'));
  assert.ok(panel.includes(`<a class="nowrap" href="/api/ops?document=${live.id}">Download</a>`));
  assert.ok(panel.includes('<strong>ID</strong>') && panel.includes('Deleted Dec 1, 2026'));
  assert.ok(!panel.includes(`document=${gone.id}`) && !page.includes(live.path), 'no store path on the page');
  assert.ok(!(await ops(pg, off).page(id)).body.includes('Buyer Documents'), 'switched off, no section');
});

test('Mason downloads any deal\'s document with the right bytes and headers; unknown 404, deleted 410, no sign-in 401, switched off 404', async t => {
  const pg = await database(t);
  const id = await intake(pg);
  const other = await intake(pg);
  const mine = await fileRow(pg, id, { docType: 'insurance' });
  const theirs = await fileRow(pg, other, { contentType: 'text/html' });
  const deleted = await fileRow(pg, id, { deleted: true });
  const store = memoryStore(new Map([[mine.path, Buffer.from('%PDF-1.7 MINE')], [theirs.path, Buffer.from('<b>THEIRS</b>')]]));

  const ok = await download(pg, mine.id, { store });
  assert.equal(ok.statusCode, 200);
  assert.equal(ok.body, '%PDF-1.7 MINE');
  assert.equal(ok.headers['content-type'], 'application/pdf');
  assert.equal(ok.headers['content-disposition'], `attachment; filename="insurance-${mine.id}.pdf"`);
  assert.equal(ok.headers['x-content-type-options'], 'nosniff');
  assert.match(ok.headers['cache-control'], /no-store/);
  assert.equal(ok.headers['content-security-policy'], "sandbox; default-src 'none'");
  assert.equal(ok.headers['content-length'], '13');

  // Mason owns every deal; a stored type outside the allowed list goes out as plain bytes.
  const foreign = await download(pg, theirs.id, { store });
  assert.equal(foreign.statusCode, 200);
  assert.equal(foreign.headers['content-type'], 'application/octet-stream');
  assert.equal(foreign.headers['content-disposition'], `attachment; filename="pre_approval-${theirs.id}.bin"`);

  assert.equal((await download(pg, 987654, { store })).statusCode, 404);
  assert.equal((await download(pg, 'abc', { store })).statusCode, 404);
  assert.equal((await download(pg, deleted.id, { store })).statusCode, 410);
  store.calls.length = 0;
  assert.equal((await download(pg, mine.id, { store, auth: null })).statusCode, 401);
  assert.equal((await download(pg, mine.id, { store, env: { ...off, BLOB_READ_WRITE_TOKEN: 'x' } })).statusCode, 404);
  assert.equal((await download(pg, mine.id, { store, env: environment })).statusCode, 503, 'no store set up');
  assert.equal(store.calls.length, 0, 'none of those reached the store');
});
