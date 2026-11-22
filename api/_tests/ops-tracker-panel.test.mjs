import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { PGlite } from '@electric-sql/pglite';
import { dealTrackerSettings, replyAddress, replyToken, signLink } from '../_lib/deal-tracker.js';
import { dealerNameWarning } from '../_lib/buyer-updates.js';
import { renderBuyerUpdateEmail } from '../_lib/buyer-update-email.js';
import { dealTrackerHandler } from '../deal-tracker.js';
import { outboxHandler } from '../outbox-dispatch.js';
import { opsHandler } from '../ops.js';

// The Deal Tracker panel on the ops dashboard's deal page (plan, "Ops dashboard
// panel"), the Buyer Update email and the reply address.

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
  assert.ok(seen.body.includes('Updates from Mason') && seen.body.includes('PANEL-SENTINEL Two prices are in.'));

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

test('the panel shows drafts to approve, warns about a dealer name before Price agreed, and escapes what agents write', async t => {
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

test('the reply address is the mailbox plus the buyer\'s reply token, and the mailbox must be plain', () => {
  const base = { DEAL_TRACKER_ENABLED: '1', DEAL_TRACKER_SECRET: SECRET };
  const id = crypto.randomUUID();
  const settings = dealTrackerSettings({ ...base, DEAL_REPLY_MAILBOX: ' deals@mailbox.example.test ' });
  assert.equal(settings.replyMailbox, 'deals@mailbox.example.test');
  assert.equal(replyAddress(settings, id), `deals+${replyToken(SECRET, id)}@mailbox.example.test`);
  assert.equal(dealTrackerSettings(base).replyMailbox, null);
  assert.equal(replyAddress(dealTrackerSettings(base), id), null);
  for (const bad of ['deals+x@mailbox.example.test', 'not an address', 'deals@']) {
    assert.throws(() => dealTrackerSettings({ ...base, DEAL_REPLY_MAILBOX: bad }), /DEAL_REPLY_MAILBOX/, bad);
  }
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
