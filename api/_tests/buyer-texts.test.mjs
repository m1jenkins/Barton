import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { cleanupTexts, listTextThreads, loadTexts, parseTexts, saveTexts, TextsError } from '../_lib/buyer-texts.js';
import { carSearchHandler } from '../car-search.js';
import { outboxHandler } from '../outbox-dispatch.js';
import { showTexts } from '../../scripts/deal-desk-db.mjs';

// Buyer Texts (adr/0004): the sync endpoint, who is synced, rewrites, cleanup and
// the agents' read command. Invented people and numbers only.

const token = 'car-search-token-for-tests-only-0123456789';
const NOW = Date.parse('2026-12-10T18:00:00Z');
const DAY = 86400000;
const migrations = await Promise.all(['001_durable_leads_and_payments.sql', '002_standard_purchase_analytics.sql',
  '003_checkout_offer_snapshot.sql', '004_intake_email_outbox.sql', '005_deal_search.sql', '006_dealer_handoff.sql',
  '007_deal_events.sql', '008_deal_events_per_car.sql', '012_deal_events_agents.sql', '013_deal_tracker.sql', '014_buyer_texts.sql']
  .map(name => readFile(new URL(`../../db/${name}`, import.meta.url), 'utf8')));

function tagged(client) {
  const sql = async (strings, ...values) => {
    const query = strings.reduce((text, part, index) => text + (index ? `$${index}` : '') + part, '');
    return (await client.query(query, values)).rows;
  };
  sql.begin = fn => client.transaction(tx => fn(tagged(tx)));
  return sql;
}

async function database(t) {
  const pg = await PGlite.create();
  t.after(() => pg.close());
  for (const migration of migrations) await pg.exec(migration);
  return pg;
}

async function intake(pg, { phone = '205-555-0100', email = 'riley.buyer@example.test', deal = true, createdDaysAgo = 10 } = {}) {
  const id = crypto.randomUUID(), attempt = crypto.randomUUID(), purchase = crypto.randomUUID(), session = `cs_live_${id}`;
  await pg.query(`INSERT INTO checkout_attempts (id, client_reference_id, idempotency_key, request_hash, tier_id, expected_amount, status)
    VALUES ($1, $1, $2, $3, 'full_service', 39500, 'paid')`, [attempt, attempt, 'a'.repeat(64)]);
  await pg.query(`INSERT INTO stripe_events (event_id, event_type, checkout_session_id, livemode, stripe_created_at)
    VALUES ($1, 'checkout.session.completed', $1, true, now())`, [session]);
  await pg.query(`INSERT INTO purchases (id, checkout_session_id, checkout_attempt_id, client_reference_id, stripe_event_id,
    stripe_payment_intent_id, tier_id, amount_total, currency, payment_status, livemode, paid_at)
    VALUES ($1, $2, $3, $3, $2, 'pi_1', 'full_service', 39500, 'usd', 'paid', true, now())`, [purchase, session, attempt]);
  await pg.query(`INSERT INTO onboarding_submissions (id, checkout_session_id, purchase_id, idempotency_key, request_hash, tier_id,
      name, email, phone, city, fields, created_at)
    VALUES ($1, $2, $3, $5, $4, 'full_service', 'Riley Buyer', $6, $7, 'Austin', '{}', $8)`,
  [id, session, purchase, 'b'.repeat(64), id, email, phone, new Date(NOW - createdDaysAgo * DAY).toISOString()]);
  if (deal) await pg.query('INSERT INTO deals (id, onboarding_id) VALUES ($1, $2)', [crypto.randomUUID(), id]);
  return id;
}

const event = (pg, id, kind, daysAgo) => pg.query(`INSERT INTO deal_events (onboarding_id, kind, actor, occurred_at)
  VALUES ($1, $2, 'mason', $3)`, [id, kind, new Date(NOW - daysAgo * DAY).toISOString()]);

const message = (guid, overrides = {}) => ({
  guid, sent_at: '2026-12-09T15:00:00Z', from_buyer: true, body: 'Is the RAV4 still there?', service: 'RCS', ...overrides
});

function response() {
  return {
    statusCode: 200, headers: {},
    setHeader(key, value) { this.headers[key] = value; },
    end(value) { this.body = value ? JSON.parse(value) : null; }
  };
}

function call(sql, { method = 'GET', url = '/api/car-search', body = null, auth = `Bearer ${token}` } = {}) {
  const res = response();
  const text = body == null ? '' : JSON.stringify(body);
  const req = {
    method, url, headers: { authorization: auth, 'content-type': 'application/json', host: 'www.steermeright.com' },
    async *[Symbol.asyncIterator]() { if (text) yield Buffer.from(text); }
  };
  return carSearchHandler({ environment: { CAR_SEARCH_TOKEN: token }, getDatabase: () => sql })(req, res).then(() => res);
}

test('only open deals are listed, with the intake\'s number and a thread start a week before the intake', async t => {
  const pg = await database(t);
  const sql = tagged(pg);
  const open = await intake(pg);
  const closed = await intake(pg, { phone: '205-555-0111' });
  await event(pg, closed, 'closed', 2);
  const reopened = await intake(pg, { phone: '205-555-0122' });
  await event(pg, reopened, 'closed', 3);
  await event(pg, reopened, 'reopened', 1);
  await intake(pg, { phone: '205-555-0133', deal: false });

  const threads = await listTextThreads(sql);
  assert.deepEqual(threads.map(thread => thread.intake_id).sort(), [open, reopened].sort());
  const mine = threads.find(thread => thread.intake_id === open);
  assert.equal(mine.phone, '205-555-0100');
  assert.equal(mine.email, 'riley.buyer@example.test');
  assert.equal(mine.since, new Date(NOW - 17 * DAY).toISOString());

  assert.equal((await call(sql, { url: '/api/car-search?texts=threads', auth: 'Bearer wrong' })).statusCode, 401);
  const res = await call(sql, { url: '/api/car-search?texts=threads' });
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.threads.length, 2);
});

test('a sync saves once, takes edits and unsends, records the run, and refuses a deal that isn\'t open', async t => {
  const pg = await database(t);
  const sql = tagged(pg);
  const id = await intake(pg);
  const send = messages => call(sql, { method: 'POST', body: { intake_id: id, action: 'texts', messages } });

  const first = await send([message('G-1'), message('G-2', { from_buyer: false, body: 'Yes, $31,250 out the door', sent_at: '2026-12-09T15:05:00Z' })]);
  assert.deepEqual([first.statusCode, first.body.saved], [200, 2]);
  assert.equal((await send([message('G-1'), message('G-2', { from_buyer: false, body: 'Yes, $31,250 out the door', sent_at: '2026-12-09T15:05:00Z' })])).body.saved, 2);
  assert.equal((await pg.query('SELECT count(*)::int AS n FROM buyer_texts')).rows[0].n, 2, 'a rerun adds nothing twice');

  await send([message('G-1', { body: 'Is the RAV4 XLE still there?', edited: true }),
    message('G-2', { from_buyer: false, body: 'oops', unsent: true, sent_at: '2026-12-09T15:05:00Z' })]);
  const thread = await loadTexts(sql, id);
  assert.deepEqual(thread.texts.map(text => [text.body, text.edited, text.unsent]),
    [['Is the RAV4 XLE still there?', true, false], ['', false, true]], 'an unsent text keeps no words');
  assert.ok(thread.last_synced_at);

  const quiet = await intake(pg, { phone: '205-555-0144' });
  assert.equal((await call(sql, { method: 'POST', body: { intake_id: quiet, action: 'texts', messages: [] } })).statusCode, 200);
  assert.ok((await loadTexts(sql, quiet)).last_synced_at, 'a run with no texts still records the sync');

  await event(pg, id, 'closed', 0);
  const refused = await send([message('G-3')]);
  assert.deepEqual([refused.statusCode, refused.body.error], [409, 'not_syncing']);

  const bad = await call(sql, { method: 'POST', body: { intake_id: quiet, action: 'texts', messages: [{ guid: 'x y', sent_at: 'soon' }] } });
  assert.equal(bad.statusCode, 422);
  assert.match(bad.body.problems.join('\n'), /guid[\s\S]*sent_at[\s\S]*from_buyer/);
});

test('a GUID already saved for one deal is never moved onto another', async t => {
  const pg = await database(t);
  const sql = tagged(pg);
  const one = await intake(pg);
  const two = await intake(pg, { phone: '205-555-0155' });
  await saveTexts(sql, one, parseTexts([message('G-1')]));
  assert.deepEqual(await saveTexts(sql, two, parseTexts([message('G-1', { body: 'changed' })])), { saved: 0 });
  assert.equal((await loadTexts(sql, one)).texts[0].body, 'Is the RAV4 still there?');
});

test('messages are checked before anything is saved', () => {
  assert.throws(() => parseTexts('nope'), TextsError);
  assert.throws(() => parseTexts(Array.from({ length: 501 }, (_, n) => message(`G-${n}`))), /at most 500/);
  assert.throws(() => parseTexts([message('G-1', { body: 'x'.repeat(20001) })]), /body/);
  assert.throws(() => parseTexts([message('G-1', { attachments: Array(21).fill({ name: 'a.jpg' }) })]), /attachments/);
  assert.deepEqual(parseTexts([message('G-1', { attachments: [{ name: 'IMG_1.jpg', mime: 'image/jpeg' }] })])[0].attachments,
    [{ name: 'IMG_1.jpg', mime: 'image/jpeg' }]);
});

test('texts go 30 days after the deal\'s latest close, and a reopened deal keeps them', async t => {
  const pg = await database(t);
  const sql = tagged(pg);
  const old = await intake(pg);
  const recent = await intake(pg, { phone: '205-555-0166' });
  const back = await intake(pg, { phone: '205-555-0177' });
  for (const id of [old, recent, back]) await saveTexts(sql, id, parseTexts([message(`G-${id}`)]), { now: NOW - 40 * DAY });
  await event(pg, old, 'closed', 31);
  await event(pg, recent, 'closed', 29);
  await event(pg, back, 'closed', 35);
  await event(pg, back, 'reopened', 33);

  assert.deepEqual(await cleanupTexts({ sql, now: NOW }), { deleted: 1 });
  assert.equal((await loadTexts(sql, old)).total, 0);
  assert.equal((await loadTexts(sql, recent)).total, 1);
  assert.equal((await loadTexts(sql, back)).total, 1);
});

test('the daily cron runs text_cleanup only where texts can arrive', async t => {
  const pg = await database(t);
  const sql = tagged(pg);
  const secret = 'test-secret-for-bounded-cron-authentication';
  const run = async environment => {
    const res = response();
    await outboxHandler({ environment: { CRON_SECRET: secret, ...environment }, getDatabase: () => sql })(
      { method: 'GET', url: '/api/outbox-dispatch?jobs=text_cleanup', headers: { authorization: `Bearer ${secret}` } }, res);
    return res;
  };
  assert.equal((await run({})).body.workers.text_cleanup.configured, false);
  assert.deepEqual((await run({ CAR_SEARCH_TOKEN: token })).body.workers.text_cleanup, { configured: true, deleted: 0, ok: true });
});

test('agents read a deal\'s texts with when they were last synced', async t => {
  const pg = await database(t);
  const sql = tagged(pg);
  const id = await intake(pg);
  const never = await showTexts(sql, id.slice(0, 8));
  assert.deepEqual([never.last_synced_at, never.total], [null, 0]);
  assert.match(never.note, /Never synced/);
  await saveTexts(sql, id, []);
  assert.match((await showTexts(sql, id)).note, /no texts match the phone or email/);

  await saveTexts(sql, id, parseTexts([message('G-1'), message('G-2', { from_buyer: false, sent_at: '2026-12-09T16:00:00Z',
    body: '', unsent: true }), message('G-3', { sent_at: '2026-12-09T17:00:00Z', attachments: [{ name: 'quote.jpg', mime: 'image/jpeg' }] })]));
  const read = await showTexts(sql, id, '2');
  assert.equal(read.total, 3);
  assert.deepEqual(read.texts.map(text => [text.from, text.body]), [['mason', '[unsent]'], ['buyer', 'Is the RAV4 still there?']]);
  assert.deepEqual(read.texts[1].attachments, [{ name: 'quote.jpg', mime: 'image/jpeg' }]);
  await assert.rejects(showTexts(sql, id, 'all'), /whole number/);
});
