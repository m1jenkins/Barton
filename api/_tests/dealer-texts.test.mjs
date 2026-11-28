import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { parseTexts } from '../_lib/buyer-texts.js';
import { agentDealerTexts, cleanupDealerTexts, contactKey, listDealerThreads, parseContact, saveDealerTexts } from '../_lib/dealer-texts.js';
import { carSearchHandler } from '../car-search.js';

// Dealer Texts (adr/0005): what the Mac is told, what the endpoint files, the
// agents' read and cleanup. Invented people, dealers and numbers only.

const token = 'car-search-token-for-tests-only-0123456789';
const NOW = Date.parse('2026-12-10T18:00:00Z');
const DAY = 86400000;
const migrations = await Promise.all(['001_durable_leads_and_payments.sql', '002_standard_purchase_analytics.sql',
  '003_checkout_offer_snapshot.sql', '004_intake_email_outbox.sql', '005_deal_search.sql', '006_dealer_handoff.sql',
  '007_deal_events.sql', '008_deal_events_per_car.sql', '012_deal_events_agents.sql', '013_deal_tracker.sql', '014_buyer_texts.sql', '016_dealer_texts.sql']
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

async function intake(pg, { name = 'Riley Buyer', phone = '205-555-0100', email = 'riley.buyer@example.test', deal = true, createdDaysAgo = 10 } = {}) {
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
    VALUES ($1, $2, $3, $5, $4, 'full_service', $9, $6, $7, 'Austin', '{}', $8)`,
  [id, session, purchase, 'b'.repeat(64), id, email, phone, new Date(NOW - createdDaysAgo * DAY).toISOString(), name]);
  if (deal) await pg.query('INSERT INTO deals (id, onboarding_id) VALUES ($1, $2)', [crypto.randomUUID(), id]);
  return id;
}

const event = (pg, id, kind, daysAgo) => pg.query(`INSERT INTO deal_events (onboarding_id, kind, actor, occurred_at)
  VALUES ($1, $2, 'mason', $3)`, [id, kind, new Date(NOW - daysAgo * DAY).toISOString()]);

const message = (guid, overrides = {}) => ({
  guid, sent_at: '2026-12-09T15:00:00Z', from_dealer: true, body: 'Can do $31,250 plus TTL', service: 'RCS', ...overrides
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

const DEALER = Object.freeze({ key: '5125550177', name: 'Sam · North Toyota', how: 'contact_tag' });
const post = (sql, intakeId, contact, messages) => call(sql, { method: 'POST', body: { intake_id: intakeId, action: 'dealer_texts', contact, messages } });

test('the Mac is told each open deal\'s buyer name, buyer number and dealer list, and nothing for closed deals', async t => {
  const pg = await database(t);
  const sql = tagged(pg);
  const open = await intake(pg, { name: 'Ace Example' });
  const closed = await intake(pg, { name: 'Charles Closed', phone: '205-555-0111' });
  await event(pg, closed, 'closed', 1);
  await pg.query(`INSERT INTO dealer_text_contacts (onboarding_id, phone_key, dealer_name, contact_name, added_by)
    VALUES ($1, '5125550188', 'South Honda', 'Pat', 'deal-test'), ($2, '5125550199', 'East Kia', null, 'deal-test')`, [open, closed]);

  const deals = await listDealerThreads(sql);
  assert.deepEqual(deals.map(deal => [deal.intake_id, deal.buyer_name, deal.buyer_phone]), [[open, 'Ace Example', '205-555-0100']]);
  assert.equal(deals[0].since, new Date(NOW - 17 * DAY).toISOString());
  assert.deepEqual(deals[0].dealer_contacts, [{ key: '5125550188', dealer_name: 'South Honda', contact_name: 'Pat' }]);

  assert.equal((await call(sql, { url: '/api/car-search?texts=dealers', auth: 'Bearer wrong' })).statusCode, 401);
  const res = await call(sql, { url: '/api/car-search?texts=dealers' });
  assert.deepEqual([res.statusCode, res.body.deals.length], [200, 1]);
});

test('a dealer thread is filed once under its deal, takes edits and unsends, and agents read it labeled as dealer texts', async t => {
  const pg = await database(t);
  const sql = tagged(pg);
  const id = await intake(pg);
  const first = await post(sql, id, DEALER, [message('D-1'), message('D-2', { from_dealer: false, body: 'Can you do $30,900?', sent_at: '2026-12-09T15:05:00Z' })]);
  assert.deepEqual([first.statusCode, first.body.saved], [200, 2]);
  await post(sql, id, DEALER, [message('D-1', { body: 'Can do $31,000 plus TTL', edited: true }), message('D-2', { from_dealer: false, unsent: true, body: 'x', sent_at: '2026-12-09T15:05:00Z' })]);
  assert.equal((await pg.query('SELECT count(*)::int AS n FROM dealer_texts')).rows[0].n, 2, 'a rerun adds nothing twice');

  const read = await call(sql, { url: `/api/car-search?intake=${id}&read=texts` });
  const dealer = read.body.dealer_texts;
  assert.equal(read.body.total, 0, 'dealer texts never show up as the buyer\'s');
  assert.match(dealer.note, /never quote them to a dealer or in a Buyer Update/i);
  assert.deepEqual(dealer.threads.map(thread => [thread.dealer, thread.filed_by, Boolean(thread.last_synced_at)]), [['Sam · North Toyota', 'contact_tag', true]]);
  assert.deepEqual(dealer.texts.map(text => [text.dealer, text.from, text.body, text.source_message_id, text.edited ?? false]),
    [['Sam · North Toyota', 'dealer', 'Can do $31,000 plus TTL', 'text:D-1', true], ['Sam · North Toyota', 'mason', '[unsent]', 'text:D-2', false]]);
  assert.equal((await agentDealerTexts(sql, id, { last: 1 })).texts.length, 1);

  const quiet = await intake(pg, { phone: '205-555-0144' });
  assert.equal((await post(sql, quiet, { ...DEALER, how: 'dealer_list' }, [])).statusCode, 200);
  assert.equal((await agentDealerTexts(sql, quiet)).threads[0].filed_by, 'dealer_list', 'a quiet dealer still records the sync');
});

test('one dealer tagged for two clients files the same text under both deals', async t => {
  const pg = await database(t);
  const sql = tagged(pg);
  const one = await intake(pg);
  const two = await intake(pg, { phone: '205-555-0155' });
  for (const id of [one, two]) assert.deepEqual(await saveDealerTexts(sql, id, DEALER, parseTexts([message('D-1')], { from: 'from_dealer' })), { saved: 1 });
  assert.equal((await agentDealerTexts(sql, one)).total, 1);
  assert.equal((await agentDealerTexts(sql, two)).total, 1);
});

test('a buyer\'s number is never filed as a dealer, and closed deals and bad input are refused', async t => {
  const pg = await database(t);
  const sql = tagged(pg);
  const id = await intake(pg);
  const other = await intake(pg, { phone: '205-555-0155', email: 'other.buyer@example.test' });
  for (const key of ['2055550100', '2055550155', 'other.buyer@example.test']) {
    const res = await post(sql, id, { key, name: 'Looks like a dealer', how: 'contact_tag' }, [message('B-1')]);
    assert.deepEqual([res.statusCode, res.body.error], [409, 'buyer_contact'], key);
  }
  assert.equal((await pg.query('SELECT count(*)::int AS n FROM dealer_texts')).rows[0].n, 0);

  const bad = await post(sql, id, { key: '(512) 555-0177', how: 'guess' }, [{ guid: 'x y' }]);
  assert.equal(bad.statusCode, 422);
  assert.match(bad.body.problems.join('\n'), /contact\.key[\s\S]*contact\.how/);
  const noFrom = await post(sql, id, DEALER, [{ guid: 'D-1', sent_at: '2026-12-09T15:00:00Z', from_buyer: true }]);
  assert.match(noFrom.body.problems.join('\n'), /from_dealer/);

  await event(pg, other, 'closed', 0);
  const refused = await post(sql, other, DEALER, [message('D-1')]);
  assert.deepEqual([refused.statusCode, refused.body.error], [409, 'not_syncing']);
});

test('contact keys match the Mac\'s rule, and the backup list only takes clean keys', async t => {
  assert.deepEqual(['+1 (512) 555-0177', 'Sam@North.Example', '555-0177', ''].map(contactKey), ['5125550177', 'sam@north.example', null, null]);
  assert.deepEqual(parseContact(DEALER), DEALER);
  assert.ok(parseContact({ key: 'Sam@North.Example', how: 'contact_tag' }).problems);
  const pg = await database(t);
  const id = await intake(pg);
  await assert.rejects(pg.query(`INSERT INTO dealer_text_contacts (onboarding_id, phone_key, added_by) VALUES ($1, '(512) 555-0177', 'x')`, [id]));
  await assert.rejects(pg.query(`INSERT INTO dealer_text_contacts (onboarding_id, phone_key, added_by) VALUES ($1, 'Sam@North.Example', 'x')`, [id]));
  await pg.query(`INSERT INTO dealer_text_contacts (onboarding_id, phone_key, added_by) VALUES ($1, '5125550177', 'x'), ($1, 'sam@north.example', 'x')`, [id]);
});

test('dealer texts go 30 days after the deal\'s latest close, with the cron\'s text cleanup', async t => {
  const pg = await database(t);
  const sql = tagged(pg);
  const old = await intake(pg);
  const recent = await intake(pg, { phone: '205-555-0166' });
  for (const id of [old, recent]) await saveDealerTexts(sql, id, DEALER, parseTexts([message(`D-${id}`)], { from: 'from_dealer' }), { now: NOW - 40 * DAY });
  await event(pg, old, 'closed', 31);
  await event(pg, recent, 'closed', 29);
  assert.deepEqual(await cleanupDealerTexts({ sql, now: NOW }), { deleted: 1 });
  assert.equal((await agentDealerTexts(sql, old)).total, 0);
  assert.equal((await agentDealerTexts(sql, recent)).total, 1);
});
