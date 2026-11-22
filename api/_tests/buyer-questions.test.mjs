import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { PGlite } from '@electric-sql/pglite';
import { discardHeld, releaseHeld } from '../_lib/buyer-questions.js';
import { approveDraft, postUpdate } from '../_lib/buyer-updates.js';
import { loadBuyerView, signLink } from '../_lib/deal-tracker.js';
import { dispatchOpsAlerts, queueAlerts, opsAlertSettings } from '../_lib/ops-alerts.js';
import { dealTrackerHandler } from '../deal-tracker.js';

// Buyer Questions from the Deal Tracker, the timeline they share with Buyer
// Updates, and the alerts they send Mason (GLOSSARY.md, docs/adr/0001 and 0002,
// docs/deal-tracker-build-plan-2026-11-21.md, "Decisions": Buyer Questions, Alerts).

const SECRET = 'deal-tracker-secret-for-tests-only-0123456789';
const ORIGIN = 'https://www.steermeright.com';
const environment = { DEAL_TRACKER_ENABLED: '1', DEAL_TRACKER_SECRET: SECRET, APP_ORIGIN: ORIGIN };
const NOW = Date.parse('2026-12-10T18:00:00Z');
const DAY = 86400000;
const HOUR = 3600000;
const at = (daysAgo, from = NOW) => new Date(from - daysAgo * DAY).toISOString();

const names = ['001_durable_leads_and_payments.sql', '002_standard_purchase_analytics.sql',
  '003_checkout_offer_snapshot.sql', '004_intake_email_outbox.sql', '005_deal_search.sql', '006_dealer_handoff.sql',
  '007_deal_events.sql', '008_deal_events_per_car.sql', '012_deal_events_agents.sql', '013_deal_tracker.sql'];
const migrations = await Promise.all(names.map(name => readFile(new URL(`../../db/${name}`, import.meta.url), 'utf8')));

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

async function database(t, { through013 = true } = {}) {
  const pg = await PGlite.create();
  t.after(() => pg.close());
  for (const migration of through013 ? migrations : migrations.slice(0, -1)) await pg.exec(migration);
  return pg;
}

const CARS = [
  { rank: 1, title: '2024 Toyota RAV4 XLE', vin: '1HGCM82633A004352', dealer: 'Zzyzx Motors', url: 'https://listings.example/sentinel-listing-1' },
  { rank: 2, title: '2023 Honda CR-V EX-L', vin: '2T3W1RFV8MW123456', dealer: 'Quorra Auto Haus', url: 'https://listings.example/sentinel-listing-2' }
];
const dealerSecrets = CARS.flatMap(car => [car.dealer, car.url, car.vin]);
const NEVER = ['31,111', '31111', '32,222', '32222', 'WHY-SENTINEL', 'NOTE-SENTINEL', 'Sentinelville', 'sales@dealer.example'];

// A paid intake with its deal and link; with the deal 'quoted' it has a shortlist and two written prices.
async function intake(pg, { stage = 'confirming', name = 'Riley Buyer', link = true } = {}) {
  const id = crypto.randomUUID(), attempt = crypto.randomUUID(), purchase = crypto.randomUUID(), session = `cs_live_${id}`;
  await pg.query(`INSERT INTO checkout_attempts (id, client_reference_id, idempotency_key, request_hash, tier_id, expected_amount, status)
    VALUES ($1, $1, $2, $3, 'full_service', 39500, 'paid')`, [attempt, attempt, 'a'.repeat(64)]);
  await pg.query(`INSERT INTO stripe_events (event_id, event_type, checkout_session_id, livemode, stripe_created_at)
    VALUES ($1, 'checkout.session.completed', $1, true, now())`, [session]);
  await pg.query(`INSERT INTO purchases (id, checkout_session_id, checkout_attempt_id, client_reference_id, stripe_event_id,
    stripe_payment_intent_id, tier_id, amount_total, currency, payment_status, livemode, paid_at)
    VALUES ($1, $2, $3, $3, $2, 'pi_1', 'full_service', 39500, 'usd', 'paid', true, now())`, [purchase, session, attempt]);
  await pg.query(`INSERT INTO onboarding_submissions (id, checkout_session_id, purchase_id, idempotency_key, request_hash, tier_id, name, email, phone, city, fields)
    VALUES ($1, $2, $3, $6, $4, 'full_service', $5, 'riley.buyer@example.test', '205-555-0100', 'Austin', '{"preferred_makes":"Toyota RAV4"}')`,
  [id, session, purchase, 'b'.repeat(64), name, id]);
  const dealId = crypto.randomUUID();
  await pg.query('INSERT INTO deals (id, onboarding_id) VALUES ($1, $2)', [dealId, id]);
  if (link) await pg.query('INSERT INTO deal_tracker_links (onboarding_id) VALUES ($1)', [id]);
  if (stage === 'confirming') return id;
  await pg.query('UPDATE deals SET shortlisted_at = $2 WHERE onboarding_id = $1', [id, at(9)]);
  for (const car of CARS) {
    await pg.query(`INSERT INTO deal_listings (id, deal_id, rank, title, price_cents, target_price_cents, walk_away_cents, vin, listing_url,
        dealer_name, dealer_location, dealer_email, why, est_otd_cents)
      VALUES ($1, $2, $3, $4, 3450000, 3111100, 3222200, $5, $6, $7, 'Sentinelville, TX', 'sales@dealer.example', 'WHY-SENTINEL', 3777700)`,
    [crypto.randomUUID(), dealId, car.rank, car.title, car.vin, car.url, car.dealer]);
  }
  for (const car of CARS) await event(pg, id, 'quote', { dealer: car.dealer, vin: car.vin, otd: car.rank === 1 ? 3640000 : 3690000, daysAgo: 6 });
  return id;
}

const event = (pg, id, kind, { dealer = null, vin = null, otd = null, note = 'NOTE-SENTINEL', daysAgo = 5 } = {}) =>
  pg.query(`INSERT INTO deal_events (onboarding_id, kind, actor, dealer_name, vin, otd_cents, note, occurred_at)
    VALUES ($1, $2, 'deal-desk', $3, $4, $5, $6, $7)`, [id, kind, dealer, vin, otd, note, at(daysAgo)]);

// Mail to the reply address, as the later mail job will file it (build step 7).
let mailIds = 0;
const emailed = async (pg, id, body, { sender = 'riley.buyer@example.test', held = false, createdAt = null } = {}) =>
  Number((await pg.query(`INSERT INTO buyer_questions (onboarding_id, body, source, sender_email, held, mail_message_id, created_at)
    VALUES ($1, $2, 'email', $3, $4, $5, coalesce($6::timestamptz, now())) RETURNING id`, [id, body, sender, held, `msg-id-${++mailIds}`, createdAt])).rows[0].id);

function request(method, url, { headers = {}, body } = {}) {
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
const tokenFor = (id, version = 1) => signLink(SECRET, id, version);
const handler = (pg, { env = environment, now = NOW } = {}) =>
  dealTrackerHandler({ environment: env, getDatabase: () => tagged(pg), now: () => now });
async function open(pg, token, options) {
  const res = response();
  await handler(pg, options)(request('GET', `/api/deal-tracker?t=${encodeURIComponent(token)}`), res);
  return res;
}
// The question box's POST, as a browser sends it from the page.
async function ask(pg, token, body, { action = 'question', headers = { origin: ORIGIN }, ...options } = {}) {
  const res = response();
  const form = new URLSearchParams({ action, body }).toString();
  await handler(pg, options)(request('POST', `/api/deal-tracker?t=${encodeURIComponent(token)}`,
    { headers: { 'content-type': 'application/x-www-form-urlencoded', ...headers }, body: form }), res);
  return res;
}
const questions = async (pg, id) => (await pg.query('SELECT * FROM buyer_questions WHERE onboarding_id = $1 ORDER BY id', [id])).rows;
const count = async pg => (await pg.query('SELECT count(*)::int AS n FROM buyer_questions')).rows[0].n;

function assertAbsent(haystack, needles, where) {
  const lower = haystack.toLowerCase();
  for (const needle of needles) assert.ok(!lower.includes(String(needle).toLowerCase()), `${where} must not contain ${needle}`);
}

test('a question from the page is saved once, sends the buyer back to the timeline, and shows as theirs, escaped', async t => {
  const pg = await database(t);
  const id = await intake(pg, { stage: 'quoted' });
  const token = tokenFor(id);
  const page = await open(pg, token);
  assert.ok(page.body.includes(`<form class="dt-ask" method="post" action="/deal/${token}">`), 'the box posts to the page itself');
  assert.match(page.body, /<textarea[^>]*name="body"[^>]*maxlength="4000" required>/);
  assert.ok(page.body.includes('I answer every question here within one business day.'));

  const res = await ask(pg, token, 'Is the doc fee <script>alert(1)</script> in the price?\r\n\r\nThanks');
  assert.equal(res.statusCode, 303);
  assert.equal(res.headers.location, `/deal/${token}#dt-updates`);
  assert.match(res.headers['cache-control'], /no-store/);
  const [row] = await questions(pg, id);
  assert.deepEqual([row.source, row.held, row.sender_email, row.mail_message_id, row.body],
    ['page', false, null, null, 'Is the doc fee <script>alert(1)</script> in the price?\n\nThanks']);

  const after = (await open(pg, token)).body;
  const timeline = after.split('id="dt-updates"')[1].split('</section>')[0];
  assert.ok(timeline.includes('class="dt-question"') && timeline.includes('You asked ·'));
  assert.ok(timeline.includes('Is the doc fee &lt;script&gt;alert(1)&lt;/script&gt; in the price?\n\nThanks'), 'escaped, line breaks kept');
  assert.doesNotMatch(after, /<script/i);
});

test('empty and over-long questions are refused, the sixth in an hour is held back, and a double submit counts once', async t => {
  const pg = await database(t);
  const id = await intake(pg);
  const token = tokenFor(id);
  for (const body of ['', '  \r\n  ', 'x'.repeat(4001)]) {
    const res = await ask(pg, token, body);
    assert.equal(res.statusCode, 400, JSON.stringify(body.slice(0, 5)));
    assert.ok(res.body.includes(`href="/deal/${token}"`), 'the refusal links back');
  }
  assert.equal(await count(pg), 0);
  assert.equal((await ask(pg, token, 'x'.repeat(4000))).statusCode, 303, '4,000 characters fit');

  // A double submit: the same words twice in a row add one row; ten minutes on they're a new question.
  assert.equal((await ask(pg, token, 'Same again?')).statusCode, 303);
  assert.equal((await ask(pg, token, 'Same again?', { now: NOW + 60000 })).statusCode, 303);
  assert.equal(await count(pg), 2);

  for (const n of [3, 4, 5]) assert.equal((await ask(pg, token, `Question ${n}`)).statusCode, 303);
  const limited = await ask(pg, token, 'Question 6');
  assert.equal(limited.statusCode, 429);
  assert.ok(limited.body.includes('sent a few questions in a row. I have them. If something is urgent, email me at mason@steermeright.com.'));
  assert.equal(await count(pg), 5, 'the sixth in an hour is not saved');
  assert.equal((await ask(pg, token, 'Question 6', { now: NOW + HOUR + 60000 })).statusCode, 303, 'an hour later it goes through');

  // At most 20 a day, counted over the last 24 hours.
  const other = await intake(pg);
  for (let hours = 2; hours <= 21; hours++) {
    await pg.query(`INSERT INTO buyer_questions (onboarding_id, body, source, created_at) VALUES ($1, $2, 'page', $3)`, [other, `Earlier ${hours}`, new Date(NOW - hours * HOUR).toISOString()]);
  }
  assert.equal((await ask(pg, tokenFor(other), 'One more')).statusCode, 429);
  assert.equal((await ask(pg, tokenFor(other), 'One more', { now: NOW + 4 * HOUR })).statusCode, 303, 'older ones age out');
});

test('a forged, old-version, revoked or expired link, or the switch off, writes nothing and answers as GET does', async t => {
  const pg = await database(t);
  const id = await intake(pg, { stage: 'quoted' });
  const expired = await intake(pg, { stage: 'quoted' });
  await event(pg, expired, 'closed', { note: 'Bought', daysAgo: 4 });
  const good = tokenFor(id);
  const same = async token => {
    const get = await open(pg, token);
    const post = await ask(pg, token, 'Should not be saved');
    assert.equal(post.statusCode, get.statusCode, token);
    assert.ok(post.statusCode >= 400 && post.statusCode < 500);
    assert.ok(post.body.includes('This link isn’t active'));
  };
  await same(good.slice(0, -1) + (good.endsWith('a') ? 'b' : 'a'));
  await same(signLink('another-secret-that-is-long-enough-0123456789', id, 1));
  await same('not-a-link');
  await same(tokenFor(expired));
  await pg.query('UPDATE deal_tracker_links SET version = 2 WHERE onboarding_id = $1', [id]);
  await same(good);
  await pg.query('UPDATE deal_tracker_links SET revoked_at = now() WHERE onboarding_id = $1', [id]);
  await same(tokenFor(id, 2));
  assert.equal((await open(pg, tokenFor(id, 2))).statusCode, 410);
  assert.equal(await count(pg), 0);

  const getDatabase = () => { throw new Error('the database must not be opened'); };
  for (const env of [{}, { DEAL_TRACKER_ENABLED: '0', DEAL_TRACKER_SECRET: SECRET }]) {
    const res = response();
    await dealTrackerHandler({ environment: env, getDatabase })(request('POST', `/api/deal-tracker?t=${good}`,
      { headers: { origin: ORIGIN }, body: 'action=question&body=hi' }), res);
    assert.equal(res.statusCode, 404);
  }
});

test('another site cannot post with the link; this page can, whatever Origin its no-referrer policy sends', async t => {
  const pg = await database(t);
  const id = await intake(pg);
  const token = tokenFor(id);
  for (const headers of [{ origin: 'https://evil.example.test' }, { origin: 'http://www.steermeright.com' },
    { origin: 'null', 'sec-fetch-site': 'cross-site' }, { 'sec-fetch-site': 'same-site' }]) {
    const res = await ask(pg, token, 'From elsewhere', { headers });
    assert.equal(res.statusCode, 403, JSON.stringify(headers));
    assert.ok(res.body.includes('This link isn’t active'));
  }
  assert.equal(await count(pg), 0);
  assert.equal((await ask(pg, token, 'One', { headers: { origin: 'null', 'sec-fetch-site': 'same-origin' } })).statusCode, 303);
  assert.equal((await ask(pg, token, 'Two', { headers: {} })).statusCode, 303);
  assert.equal(await count(pg), 2);
});

test('an unknown action is refused; a search closed without a purchase has no box and takes no question; bought still does', async t => {
  const pg = await database(t);
  const id = await intake(pg, { stage: 'quoted' });
  // 'pick' is a real action since build step 5 (buyer-picks.test.mjs), so this uses one that isn't.
  const unknown = await ask(pg, tokenFor(id), 'Wipe this', { action: 'wipe' });
  assert.equal(unknown.statusCode, 400);

  await event(pg, id, 'closed', { note: 'Buyer walked away', daysAgo: 1 });
  const page = (await open(pg, tokenFor(id))).body;
  assert.ok(!page.includes('dt-ask') && !page.includes('name="body"') && !page.includes('<form'));
  const refused = await ask(pg, tokenFor(id), 'Can we reopen?');
  assert.equal(refused.statusCode, 409);
  assert.match(refused.body, /mason@steermeright\.com/);
  assert.equal(await count(pg), 0);

  const bought = await intake(pg, { stage: 'quoted' });
  await event(pg, bought, 'agreed', { dealer: CARS[0].dealer, vin: CARS[0].vin, otd: 3610000, daysAgo: 3 });
  await event(pg, bought, 'closed', { note: 'Bought', daysAgo: 1 });
  assert.ok((await open(pg, tokenFor(bought))).body.includes('name="body"'));
  assert.equal((await ask(pg, tokenFor(bought), 'Where do I send the registration?')).statusCode, 303);
  assert.equal(await count(pg), 1);
});

test('the timeline: held mail stays off until released, discarded mail never shows, and no sender address ever does', async t => {
  const pg = await database(t);
  const id = await intake(pg, { stage: 'quoted' });
  const sql = tagged(pg);
  const own = await emailed(pg, id, 'EMAIL-SENTINEL from the buyer');
  const held = await emailed(pg, id, 'HELD-SENTINEL from a cousin', { sender: 'cousin@example.test', held: true });
  const dropped = await emailed(pg, id, 'DISCARD-SENTINEL spam', { sender: 'spam@example.test', held: true });
  await discardHeld(sql, dropped, id);
  // Mason answers the held one before releasing it: the buyer's view mustn't point at it.
  await postUpdate(sql, { onboardingId: id, body: 'ANSWER-SENTINEL to the cousin', answersQuestionId: held });

  const check = async () => {
    const html = (await open(pg, tokenFor(id))).body;
    const view = await loadBuyerView(sql, id, NOW);
    const json = JSON.stringify(view);
    for (const [where, text] of [['the page', html], ['the view', json]]) {
      assertAbsent(text, ['DISCARD-SENTINEL', 'cousin@example.test', 'spam@example.test', 'riley.buyer@example.test', 'msg-id-', 'sender_email', 'mail_message_id', '"held"'], where);
    }
    return { html, view };
  };
  let { html, view } = await check();
  assert.ok(html.includes('EMAIL-SENTINEL') && html.includes('You asked by email'));
  assert.ok(!html.includes('HELD-SENTINEL') && !JSON.stringify(view).includes('HELD-SENTINEL'));
  const answer = view.timeline.find(item => item.body.startsWith('ANSWER-SENTINEL'));
  assert.ok(!('answers_question_id' in answer), 'an answer to a hidden question names no question');
  assert.deepEqual(Object.keys(view.timeline.find(item => item.id === own && item.type === 'question')).sort(), ['at', 'body', 'by_email', 'id', 'type']);

  assert.equal(await releaseHeld(sql, held, id), true);
  ({ html, view } = await check());
  const question = html.split('<li class="dt-question">').find(part => part.includes('HELD-SENTINEL'));
  assert.ok(question.includes('You asked by email'));
  assert.ok(question.split('</li>')[0].includes('Mason’s answer') && question.includes('ANSWER-SENTINEL'), 'the answer sits under its question');
  assert.equal(html.split('ANSWER-SENTINEL').length - 1, 1, 'and is not shown a second time');
  assert.equal(view.timeline.find(item => item.body.startsWith('ANSWER-SENTINEL')).answers_question_id, held);
  assert.ok(!html.includes('DISCARD-SENTINEL'));
});

test('a timeline renders newest first, a late answer brings its question back to the top, and the stage page keeps dealers hidden', async t => {
  const pg = await database(t);
  const id = await intake(pg, { stage: 'quoted' });
  const sql = tagged(pg);
  const asked = Number((await pg.query(`INSERT INTO buyer_questions (onboarding_id, body, source, created_at) VALUES ($1, 'FIRST-QUESTION', 'page', $2) RETURNING id`, [id, at(3)])).rows[0].id);
  await pg.query(`INSERT INTO buyer_updates (onboarding_id, body, status, actor) VALUES ($1, 'MIDDLE-UPDATE', 'posted', 'mason')`, [id]);
  await pg.query(`UPDATE buyer_updates SET posted_at = $2 WHERE onboarding_id = $1`, [id, at(2)]);
  await pg.query(`INSERT INTO buyer_questions (onboarding_id, body, source, created_at) VALUES ($1, 'LATER-QUESTION', 'page', $2)`, [id, at(1)]);
  const html = (await open(pg, tokenFor(id))).body;
  assert.ok(html.indexOf('LATER-QUESTION') < html.indexOf('MIDDLE-UPDATE') && html.indexOf('MIDDLE-UPDATE') < html.indexOf('FIRST-QUESTION'));

  const { id: late } = await postUpdate(sql, { onboardingId: id, body: 'LATE-ANSWER', answersQuestionId: asked });
  await pg.query('UPDATE buyer_updates SET posted_at = $2 WHERE id = $1', [late, at(0.5)]);
  const later = (await open(pg, tokenFor(id))).body;
  assert.ok(later.indexOf('FIRST-QUESTION') < later.indexOf('LATE-ANSWER') && later.indexOf('LATE-ANSWER') < later.indexOf('LATER-QUESTION'));
  const view = JSON.stringify(await loadBuyerView(sql, id, NOW));
  for (const [where, text] of [['the page', later], ['the view', view]]) {
    assertAbsent(text, [...dealerSecrets, ...NEVER], where);
  }
});

// ---------- Alerts to Mason ----------

const alertEnv = { OPS_ALERT_EMAIL: 'alerts@example.test', INTAKE_SMTP_USER: 'sender@example.test', INTAKE_SMTP_PASSWORD: 'not-real', APP_ORIGIN: ORIGIN };
const trackerAlertEnv = { ...alertEnv, DEAL_TRACKER_ENABLED: '1', DEAL_TRACKER_SECRET: SECRET };
const night = Date.parse('2026-11-20T09:00:00Z'); // 3 am Central: no digest
const morning = Date.parse('2026-11-20T15:00:00Z'); // 9 am Central
function mailbox() {
  const sent = [];
  return { sent, createTransport: () => ({ async sendMail(mail) { sent.push(mail); }, close() {} }) };
}
const opening = async (pg, id) =>
  Number((await pg.query(`INSERT INTO buyer_updates (onboarding_id, body, status, ready_for_pick, actor) VALUES ($1, 'Ready for your call', 'posted', true, 'mason') RETURNING id`, [id])).rows[0].id);
const pick = async (pg, id, kind = 'pick') => {
  const update = await opening(pg, id);
  return Number((await pg.query(`INSERT INTO buyer_picks (onboarding_id, kind, opened_by_update_id, vin, dealer_name, otd_cents)
    VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`, kind === 'pick' ? [id, kind, update, CARS[0].vin, CARS[0].dealer, 3610000] : [id, kind, update, null, null, null])).rows[0].id);
};
const pageQuestion = async (pg, id, body, createdAt = null) =>
  Number((await pg.query(`INSERT INTO buyer_questions (onboarding_id, body, source, created_at) VALUES ($1, $2, 'page', coalesce($3::timestamptz, now())) RETURNING id`, [id, body, createdAt])).rows[0].id);
const agentDraft = async (pg, id, body) =>
  Number((await pg.query(`INSERT INTO buyer_updates (onboarding_id, body, actor) VALUES ($1, $2, 'deal-desk') RETURNING id`, [id, body])).rows[0].id);

test('each Buyer Question, draft update, held email and pick emails Mason once, and a rerun sends nothing new', async t => {
  const pg = await database(t);
  const sql = tagged(pg);
  const id = await intake(pg, { stage: 'quoted' });
  const question = await pageQuestion(pg, id, `Does the price include the doc fee?\nAnd tint <b>bold</b>. ${'More words. '.repeat(80)}TAIL-SENTINEL`);
  await pageQuestion(pg, id, 'OLD-QUESTION from last week', new Date(Date.now() - 3 * DAY).toISOString());
  const draft = await agentDraft(pg, id, 'DRAFT-SENTINEL: both dealers have quoted.');
  const held = await emailed(pg, id, 'HELD-SENTINEL text that must stay out of the alert', { sender: 'cousin@example.test', held: true });
  const picked = await pick(pg, id);
  const kept = await pick(pg, id, 'keep_looking');
  const { sent, createTransport } = mailbox();

  const first = await dispatchOpsAlerts({ sql, environment: trackerAlertEnv, createTransport, now: night });
  assert.equal(first.sent, 5);
  assert.ok(sent.every(mail => mail.to === 'alerts@example.test'));
  const bySubject = Object.fromEntries(sent.map(mail => [mail.subject, mail]));
  assert.deepEqual(Object.keys(bySubject).sort(), ['Draft update waiting: Riley Buyer', 'Held email on Riley Buyer\'s deal', 'Question from Riley Buyer',
    'Riley Buyer asked us to keep looking', 'Riley Buyer picked a car']);
  const link = `${ORIGIN}/api/ops?deal=${id}`;
  assert.ok(sent.every(mail => mail.text.includes(link) && mail.html.includes(link)));

  const asked = bySubject['Question from Riley Buyer'];
  assert.ok(asked.text.includes('Does the price include the doc fee?\nAnd tint <b>bold</b>.') && asked.text.includes('Asked on the Deal Tracker'));
  assert.ok(!asked.text.includes('TAIL-SENTINEL'), 'only the first 600 characters');
  assert.ok(asked.html.includes('And tint &lt;b&gt;bold&lt;/b&gt;.') && !asked.html.includes('<b>bold'), 'the HTML part escapes the buyer\'s words');
  assert.ok(!sent.some(mail => mail.text.includes('OLD-QUESTION')), 'a question older than two days is left to the dashboard');
  assert.ok(bySubject['Draft update waiting: Riley Buyer'].text.includes('DRAFT-SENTINEL') && bySubject['Draft update waiting: Riley Buyer'].text.includes('deal-desk'));
  const heldMail = bySubject['Held email on Riley Buyer\'s deal'];
  assert.ok(heldMail.text.includes('cousin@example.test') && heldMail.text.includes('stays out of the agents\' queue'));
  assert.ok(!heldMail.text.includes('HELD-SENTINEL') && !heldMail.html.includes('HELD-SENTINEL'), 'never the held text');
  const pickMail = bySubject['Riley Buyer picked a car'];
  assert.ok(pickMail.text.includes('2024 Toyota RAV4 XLE') && pickMail.text.includes('$36,100'));

  const rows = (await pg.query(`SELECT dedupe_key, kind, event_id, payload, status FROM ops_alert_outbox ORDER BY id`)).rows;
  assert.deepEqual(rows.map(row => row.dedupe_key).sort(), [`draft:${draft}`, `held:${held}`, `pick:${kept}`, `pick:${picked}`, `question:${question}`].sort());
  assert.ok(rows.every(row => row.event_id === null && row.payload.intake_id === id && row.status === 'sent'));
  assert.equal(rows.find(row => row.kind === 'buyer_question').payload.question_id, question);

  const again = await dispatchOpsAlerts({ sql, environment: trackerAlertEnv, createTransport, now: night });
  assert.deepEqual([again.claimed, sent.length], [0, 5], 'nothing twice');

  // The digest counts them under "From your buyers".
  await dispatchOpsAlerts({ sql, environment: trackerAlertEnv, createTransport, now: morning });
  const digest = sent.at(-1);
  assert.match(digest.subject, /^Deals this morning/);
  assert.ok(digest.text.includes('From your buyers') && digest.text.includes('2 Buyer Questions waiting for an answer (Riley Buyer)')
    && digest.text.includes('1 held email to release or discard') && digest.text.includes('1 draft update waiting for your approval')
    && digest.text.includes('1 buyer picked a car') && digest.text.includes('1 buyer asked us to keep looking'));
  assert.ok(!digest.text.includes('HELD-SENTINEL'));
});

test('an alert is skipped once it no longer needs Mason: answered, approved, released or discarded, cleared', async t => {
  const pg = await database(t);
  const sql = tagged(pg);
  const id = await intake(pg, { stage: 'quoted' });
  const question = await pageQuestion(pg, id, 'Answered before the email went');
  const draft = await agentDraft(pg, id, 'Approved before the email went');
  const discarded = await emailed(pg, id, 'Discarded', { sender: 'spam@example.test', held: true });
  const released = await emailed(pg, id, 'RELEASED-SENTINEL', { sender: 'cousin@example.test', held: true });
  const picked = await pick(pg, id);
  const settings = { ...opsAlertSettings(alertEnv), tracker: true };
  await queueAlerts(sql, settings, night, { tracker: true });
  assert.equal((await pg.query('SELECT count(*)::int AS n FROM ops_alert_outbox')).rows[0].n, 5);

  await postUpdate(sql, { onboardingId: id, body: 'Yes, it does.', answersQuestionId: question });
  await approveDraft(sql, draft, id);
  await discardHeld(sql, discarded, id);
  await releaseHeld(sql, released, id);
  await pg.query(`UPDATE buyer_picks SET cleared_at = now(), cleared_by = 'mason' WHERE id = $1`, [picked]);
  const { sent, createTransport } = mailbox();
  const result = await dispatchOpsAlerts({ sql, environment: trackerAlertEnv, createTransport, now: night });
  assert.equal(result.skipped, 5);
  // Released mail now counts as the buyer's question, so it alerts as one.
  assert.equal(result.sent, 1);
  assert.equal(sent[0].subject, 'Question from Riley Buyer');
  assert.ok(sent[0].text.includes('RELEASED-SENTINEL') && sent[0].text.includes('By email from cousin@example.test'));
  const statuses = (await pg.query(`SELECT dedupe_key, status FROM ops_alert_outbox ORDER BY id`)).rows;
  assert.deepEqual(statuses.filter(row => row.status === 'skipped').map(row => row.dedupe_key).sort(),
    [`draft:${draft}`, `held:${discarded}`, `held:${released}`, `pick:${picked}`, `question:${question}`].sort());
});

test('switched off, no buyer alert is queued and no buyer_* table is queried, even before db/013', async t => {
  const old = await database(t, { through013: false });
  const seen = [];
  const sql = tagged(old, seen);
  const id = await intake(old, { link: false });
  await old.query(`INSERT INTO deal_events (onboarding_id, kind, actor, note) VALUES ($1, 'needs_mason', 'deal-desk', 'Approve the counter?')`, [id]);
  const { sent, createTransport } = mailbox();
  await queueAlerts(sql, opsAlertSettings(alertEnv), night);
  const result = await dispatchOpsAlerts({ sql, environment: alertEnv, createTransport, now: morning });
  assert.equal(result.failed, 0);
  assert.ok(sent.some(mail => mail.subject.startsWith('Deals this morning')), 'the digest still goes');
  assert.ok(!sent.some(mail => mail.text.includes('From your buyers')));
  assert.ok(seen.length && !seen.some(query => /buyer_/.test(query)), 'no buyer_* table is named');

  // On a full database with buyer rows, the switch off still queues none of them.
  const pg = await database(t);
  const full = tagged(pg);
  const deal = await intake(pg, { stage: 'quoted' });
  await pageQuestion(pg, deal, 'Not alerted while off');
  await agentDraft(pg, deal, 'Not alerted while off');
  await pick(pg, deal);
  await dispatchOpsAlerts({ sql: full, environment: alertEnv, createTransport, now: night });
  assert.equal((await pg.query(`SELECT count(*)::int AS n FROM ops_alert_outbox WHERE kind <> 'digest'`)).rows[0].n, 0);
});
