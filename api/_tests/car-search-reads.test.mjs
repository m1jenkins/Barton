import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { carSearchHandler } from '../car-search.js';
import { carSearchRequest } from '../../scripts/car-search.mjs';

// What an agent working a deal reads through /api/car-search with CAR_SEARCH_TOKEN
// and no database login (scripts/car-search.mjs picks, documents, texts, deal).
// Buyer Picks and Buyer Documents are read-only here: only the buyer's page
// writes them (docs/adr/0002). A document is listed, never opened, and neither
// its place in the store nor a deleted file ever shows. Invented people only.

const token = 'car-search-token-for-tests-only-0123456789';
const environment = {
  CAR_SEARCH_TOKEN: token, DEAL_TRACKER_ENABLED: '1', DEAL_TRACKER_SECRET: 'deal-tracker-secret-for-tests-only-0123456789',
  APP_ORIGIN: 'https://www.steermeright.com', BLOB_READ_WRITE_TOKEN: 'blob-token-for-tests-only'
};
const VIN = '2T3P1RFV5SW000001';

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
  sql.json = value => JSON.stringify(value);
  return sql;
}

async function database(t) {
  const pg = await PGlite.create();
  t.after(() => pg.close());
  for (const migration of migrations) await pg.exec(migration);
  return pg;
}

// A paid intake, by default with a deal and one shortlisted car.
async function intake(pg, { deal = true } = {}) {
  const id = crypto.randomUUID(), attempt = crypto.randomUUID(), purchase = crypto.randomUUID(), session = `cs_live_${id}`;
  await pg.query(`INSERT INTO checkout_attempts (id, client_reference_id, idempotency_key, request_hash, tier_id, expected_amount, status)
    VALUES ($1, $1, $2, $3, 'full_service', 39500, 'paid')`, [attempt, attempt, 'a'.repeat(64)]);
  await pg.query(`INSERT INTO stripe_events (event_id, event_type, checkout_session_id, livemode, stripe_created_at)
    VALUES ($1, 'checkout.session.completed', $1, true, now())`, [session]);
  await pg.query(`INSERT INTO purchases (id, checkout_session_id, checkout_attempt_id, client_reference_id, stripe_event_id,
    stripe_payment_intent_id, tier_id, amount_total, currency, payment_status, livemode, paid_at)
    VALUES ($1, $2, $3, $3, $2, 'pi_1', 'full_service', 39500, 'usd', 'paid', true, now())`, [purchase, session, attempt]);
  await pg.query(`INSERT INTO onboarding_submissions (id, checkout_session_id, purchase_id, idempotency_key, request_hash, tier_id, name, email, phone, city, fields)
    VALUES ($1, $2, $3, $5, $4, 'full_service', 'Riley Buyer', 'riley.buyer@example.test', '205-555-0100', 'Austin', '{}')`,
  [id, session, purchase, 'b'.repeat(64), id]);
  if (!deal) return id;
  const dealId = crypto.randomUUID();
  await pg.query(`INSERT INTO deals (id, onboarding_id, search_summary, shortlisted_at) VALUES ($1, $2, 'One RAV4 near Austin', now())`, [dealId, id]);
  await pg.query(`INSERT INTO deal_listings (id, deal_id, rank, title, price_cents, target_price_cents, vin, listing_url, dealer_name)
    VALUES ($1, $2, 1, '2025 Toyota RAV4 XLE', 3400000, 3250000, $3, 'https://dealer.example/rav4', 'North Toyota')`, [crypto.randomUUID(), dealId, VIN]);
  return id;
}

const readyUpdate = async (pg, id, body = 'Ready for your call') => (await pg.query(`INSERT INTO buyer_updates (onboarding_id, body, status, ready_for_pick, actor)
  VALUES ($1, $2, 'posted', true, 'mason') RETURNING id`, [id, body])).rows[0].id;

const addPick = async (pg, id, updateId, minutesAgo, kind = 'pick', values = [VIN, 'North Toyota', 3350000]) =>
  Number((await pg.query(`INSERT INTO buyer_picks (onboarding_id, kind, opened_by_update_id, vin, dealer_name, otd_cents, created_at)
    VALUES ($1, $2, $3, $4, $5, $6, now() - $7 * interval '1 minute') RETURNING id`,
  [id, kind, updateId, ...(kind === 'pick' ? values : [null, null, null]), minutesAgo])).rows[0].id);

const addDocument = async (pg, id, docType, minutesAgo, { deleted = false, bytes = 4096 } = {}) =>
  Number((await pg.query(`INSERT INTO buyer_documents (onboarding_id, doc_type, blob_path, content_type, bytes, created_at, deleted_at)
    VALUES ($1, $2, $3, 'application/pdf', $4, now() - $5 * interval '1 minute', $6) RETURNING id`,
  [id, docType, `deals/${id}/${crypto.randomUUID()}.pdf`, bytes, minutesAgo, deleted ? new Date().toISOString() : null])).rows[0].id);

function response() {
  return {
    statusCode: 200, headers: {}, raw: '',
    setHeader(name, value) { this.headers[name.toLowerCase()] = value; },
    end(value = '') { this.raw = String(value); }
  };
}

// Any touch of the Blob store fails the test: a list never opens a file.
const noStore = new Proxy({}, { get: (_, name) => () => { throw new Error(`the store must not be touched (${String(name)})`); } });
const noDatabase = () => { throw new Error('the database must not be read'); };

async function get(sql, query, { auth = `Bearer ${token}`, env = environment } = {}) {
  const res = response();
  await carSearchHandler({ environment: env, getDatabase: typeof sql === 'function' && sql.length === 0 ? sql : () => sql, documentStore: noStore })({
    method: 'GET', url: `/api/car-search?${query}`, headers: { host: 'www.steermeright.com', ...(auth ? { authorization: auth } : {}) }
  }, res);
  return { status: res.statusCode, body: JSON.parse(res.raw), raw: res.raw, headers: res.headers };
}

const snapshot = async pg => JSON.stringify([
  (await pg.query('SELECT * FROM buyer_picks ORDER BY id')).rows,
  (await pg.query('SELECT * FROM buyer_documents ORDER BY id')).rows,
  (await pg.query('SELECT * FROM buyer_updates ORDER BY id')).rows,
  (await pg.query('SELECT * FROM deal_events ORDER BY id')).rows
]);

test('every read needs the bearer token, and without it the database is never read', async () => {
  const id = crypto.randomUUID();
  for (const read of ['picks', 'documents', 'texts', 'deal']) {
    for (const auth of [null, 'Bearer wrong-token-wrong-token-wrong-token-0123', `Basic ${token}`, token]) {
      const refused = await get(noDatabase, `intake=${id}&read=${read}`, { auth });
      assert.deepEqual([refused.status, refused.body], [401, { ok: false, error: 'unauthorized' }], `${read} with ${auth}`);
    }
  }
  const unset = await get(noDatabase, `intake=${id}&read=picks`, { env: { ...environment, CAR_SEARCH_TOKEN: '' } });
  assert.equal(unset.status, 503);
});

test('with the Deal Tracker switched off, picks and documents answer 404 without reading the database', async t => {
  t.mock.method(console, 'error', () => {});
  const pg = await database(t);
  const id = await intake(pg);
  await addPick(pg, id, await readyUpdate(pg, id), 5);
  await addDocument(pg, id, 'pre_approval', 5);
  for (const env of [{ CAR_SEARCH_TOKEN: token }, { ...environment, DEAL_TRACKER_ENABLED: '0' }, { ...environment, DEAL_TRACKER_ENABLED: '' }]) {
    for (const read of ['picks', 'documents']) {
      const off = await get(noDatabase, `intake=${id}&read=${read}`, { env });
      assert.deepEqual([off.status, off.body.error, off.body.message], [404, 'not_found', 'The Deal Tracker is off.'], read);
      assert.ok(!off.raw.includes(VIN) && !off.raw.includes('pre_approval'));
    }
  }
  // The deal's own log doesn't depend on the tracker.
  const deal = await get(tagged(pg), `intake=${id}&read=deal`, { env: { CAR_SEARCH_TOKEN: token } });
  assert.deepEqual([deal.status, deal.body.intake_id], [200, id]);
});

test('an unknown intake, an intake with no deal, a bad ID or a bad read is refused and nothing is listed', async t => {
  const pg = await database(t);
  const sql = tagged(pg);
  const id = await intake(pg);
  const noDeal = await intake(pg, { deal: false });
  await addPick(pg, id, await readyUpdate(pg, id), 5);
  await addDocument(pg, id, 'pre_approval', 5);
  for (const read of ['picks', 'documents', 'texts', 'deal']) {
    for (const unknown of [crypto.randomUUID(), noDeal]) {
      const missing = await get(sql, `intake=${unknown}&read=${read}`);
      assert.deepEqual([missing.status, missing.body.ok, missing.body.error], [404, false, 'deal_not_found'], read);
      assert.deepEqual(Object.keys(missing.body).sort(), ['error', 'message', 'ok']);
    }
    for (const bad of ['', 'abc', '%25', '________', `${id}'--`, `${id}0`]) {
      const refused = await get(noDatabase, `intake=${encodeURIComponent(bad)}&read=${read}`);
      assert.deepEqual([refused.status, refused.body.error], [400, 'invalid_intake'], `${read} ${bad}`);
    }
  }
  for (const read of ['', 'pick', 'document', 'everything', 'threads']) {
    const refused = await get(noDatabase, `intake=${id}&read=${read}`);
    assert.deepEqual([refused.status, refused.body.error], [400, 'invalid_read'], read);
  }
  assert.equal((await get(noDatabase, `intake=${id}&read=picks&last=2`)).body.error, 'invalid_last');
  assert.equal((await get(noDatabase, `intake=${id}&read=texts&last=0`)).body.error, 'invalid_last');
});

test('picks lists one deal\'s standing Buyer Picks with the car\'s title, never a cleared one, and writes nothing', async t => {
  const pg = await database(t);
  const sql = tagged(pg);
  const id = await intake(pg);
  const other = await intake(pg);
  const first = await readyUpdate(pg, id);
  const second = await readyUpdate(pg, id, 'Ready again');
  const byMason = await addPick(pg, id, first, 30, 'pick', [VIN, 'CLEARED-BY-MASON Motors', 3300000]);
  await pg.query(`UPDATE buyer_picks SET cleared_at = now(), cleared_by = 'mason' WHERE id = $1`, [byMason]);
  const dropped = await addPick(pg, id, first, 25, 'pick', [VIN, 'DEALER-DROPPED Motors', 3310000]);
  await pg.query(`UPDATE buyer_picks SET cleared_at = now(), cleared_by = 'dealer_dropped' WHERE id = $1`, [dropped]);
  const pick = await addPick(pg, id, first, 20);
  const keep = await addPick(pg, id, second, 10, 'keep_looking');
  await addPick(pg, other, await readyUpdate(pg, other), 1, 'pick', [VIN, 'OTHER-DEAL Motors', 3000000]);
  // A closed deal still lists its pick: the read doesn't depend on the deal being open.
  await pg.query(`INSERT INTO deal_events (onboarding_id, kind, actor, note) VALUES ($1, 'closed', 'mason', 'Other')`, [id]);
  const before = await snapshot(pg);

  const listed = await get(sql, `intake=${id.toUpperCase()}&read=picks`);
  assert.equal(listed.status, 200);
  assert.deepEqual(Object.keys(listed.body).sort(), ['intake_id', 'note', 'ok', 'picks']);
  assert.equal(listed.body.intake_id, id);
  assert.deepEqual(listed.body.picks.map(row => row.id), [keep, pick], 'newest first, standing only');
  assert.deepEqual(Object.keys(listed.body.picks[0]).sort(), ['created_at', 'dealer_name', 'id', 'kind', 'otd_cents', 'title', 'vin']);
  const { created_at: pickedAt, ...car } = listed.body.picks[1];
  assert.deepEqual(car, { id: pick, kind: 'pick', title: '2025 Toyota RAV4 XLE', vin: VIN, dealer_name: 'North Toyota', otd_cents: 3350000 });
  assert.ok(!Number.isNaN(Date.parse(pickedAt)));
  const { created_at: askedAt, ...none } = listed.body.picks[0];
  assert.deepEqual(none, { id: keep, kind: 'keep_looking', title: null, vin: null, dealer_name: null, otd_cents: null });
  assert.ok(!Number.isNaN(Date.parse(askedAt)));
  for (const gone of ['CLEARED-BY-MASON', 'DEALER-DROPPED', 'OTHER-DEAL', 'cleared_at', 'cleared_by', '3250000']) {
    assert.ok(!listed.raw.includes(gone), `${gone} never shows`);
  }
  // The first 8 characters name the deal too, as on scripts/deal-desk-db.mjs deal.
  assert.deepEqual((await get(sql, `intake=${id.slice(0, 8)}&read=picks`)).body.picks.map(row => row.id), [keep, pick]);

  // Once every pick is cleared the list is empty, not an error.
  await pg.query(`UPDATE buyer_picks SET cleared_at = now(), cleared_by = 'mason' WHERE onboarding_id = $1 AND cleared_at IS NULL`, [id]);
  const cleared = await get(sql, `intake=${id}&read=picks`);
  assert.deepEqual([cleared.status, cleared.body.picks], [200, []]);
  await pg.query(`UPDATE buyer_picks SET cleared_at = NULL, cleared_by = NULL WHERE id IN ($1, $2)`, [pick, keep]);
  assert.equal(await snapshot(pg), before, 'reading wrote nothing');
});

test('only the buyer makes a pick: no request to /api/car-search writes one', async t => {
  t.mock.method(console, 'error', () => {});
  const pg = await database(t);
  const sql = tagged(pg);
  const id = await intake(pg);
  const updateId = await readyUpdate(pg, id);
  await pg.query(`INSERT INTO deal_events (onboarding_id, kind, actor, dealer_name, vin, otd_cents) VALUES ($1, 'quote', 'duet-deals', 'North Toyota', $2, 3350000)`, [id, VIN]);
  const before = await snapshot(pg);
  const post = async (url, body) => {
    const res = response();
    await carSearchHandler({ environment, getDatabase: () => sql, documentStore: noStore })({
      method: 'POST', url, body,
      headers: { host: 'www.steermeright.com', authorization: `Bearer ${token}`, 'content-type': 'application/json' }
    }, res);
    return { status: res.statusCode, body: JSON.parse(res.raw) };
  };
  for (const action of ['pick', 'picks', 'make_pick', 'keep_looking', 'clear_pick', 'documents', 'document']) {
    for (const url of ['/api/car-search', `/api/car-search?intake=${id}&read=picks`]) {
      const refused = await post(url, { intake_id: id, action, rank: 1, vin: VIN, dealer_name: 'North Toyota', otd_cents: 3350000,
        kind: 'pick', opened_by_update_id: Number(updateId), expected_cents: 3350000 });
      assert.deepEqual([refused.status, refused.body.error], [400, 'invalid_action'], `${action} at ${url}`);
    }
  }
  for (const method of ['PUT', 'PATCH', 'DELETE']) {
    const res = response();
    await carSearchHandler({ environment, getDatabase: noDatabase })({ method, url: `/api/car-search?intake=${id}&read=picks`,
      headers: { host: 'www.steermeright.com', authorization: `Bearer ${token}` } }, res);
    assert.equal(res.statusCode, 405, method);
  }
  assert.equal(await snapshot(pg), before, 'nothing was written');
  assert.equal((await pg.query('SELECT count(*)::int AS n FROM buyer_picks')).rows[0].n, 0);
});

test('documents lists id, type, content type, size and date only: never a deleted file, a store path or contents', async t => {
  const pg = await database(t);
  const sql = tagged(pg);
  const id = await intake(pg);
  const other = await intake(pg);
  const older = await addDocument(pg, id, 'pre_approval', 30);
  const big = await addDocument(pg, id, 'insurance', 10, { bytes: 20 * 1024 * 1024 });
  const middle = await addDocument(pg, id, 'payoff_letter', 20);
  await addDocument(pg, id, 'trade_in_title', 1, { deleted: true });
  await addDocument(pg, other, 'id', 1);
  await pg.query(`INSERT INTO deal_events (onboarding_id, kind, actor, note) VALUES ($1, 'closed', 'mason', 'Other')`, [id]);
  const before = await snapshot(pg);

  const listed = await get(sql, `intake=${id}&read=documents`);
  assert.equal(listed.status, 200);
  assert.deepEqual(Object.keys(listed.body).sort(), ['documents', 'intake_id', 'note', 'ok']);
  assert.deepEqual(listed.body.documents.map(doc => doc.id), [big, middle, older], 'newest first, live files only');
  for (const doc of listed.body.documents) {
    assert.deepEqual(Object.keys(doc).sort(), ['bytes', 'content_type', 'created_at', 'doc_type', 'id']);
    assert.ok(!Number.isNaN(Date.parse(doc.created_at)));
  }
  const { created_at: sentAt, ...file } = listed.body.documents[0];
  assert.deepEqual(file, { id: big, doc_type: 'insurance', content_type: 'application/pdf', bytes: 20971520 });
  for (const hidden of ['deals/', 'blob_path', '.pdf"', 'trade_in_title', 'deleted_at', other]) {
    assert.ok(!listed.raw.includes(hidden), `${hidden} never shows`);
  }
  assert.deepEqual([listed.headers['content-type'], listed.headers['content-disposition'], listed.headers['cache-control']],
    ['application/json; charset=utf-8', undefined, 'no-store, max-age=0'], 'a list is JSON, never a download');

  // Once every file is deleted the list is empty, and a deal's list is only its own.
  await pg.query('UPDATE buyer_documents SET deleted_at = now() WHERE onboarding_id = $1 AND deleted_at IS NULL', [id]);
  const emptied = await get(sql, `intake=${id}&read=documents`);
  assert.deepEqual([emptied.status, emptied.body.documents], [200, []]);
  await pg.query('UPDATE buyer_documents SET deleted_at = NULL WHERE id IN ($1, $2, $3)', [older, big, middle]);
  assert.deepEqual((await get(sql, `intake=${other}&read=documents`)).body.documents.map(doc => doc.doc_type), ['id']);
  assert.equal(await snapshot(pg), before, 'reading wrote nothing');
});

test('texts and deal give an agent the synced thread and the deal\'s log without a database login', async t => {
  const pg = await database(t);
  const sql = tagged(pg);
  const id = await intake(pg);
  const never = await get(sql, `intake=${id}&read=texts`);
  assert.deepEqual([never.status, never.body.last_synced_at, never.body.total], [200, null, 0]);
  assert.match(never.body.note, /Never synced/);
  await pg.query(`INSERT INTO buyer_text_threads (onboarding_id, last_synced_at) VALUES ($1, now())`, [id]);
  for (const [guid, hour, fromBuyer, body, unsent] of [['G-1', 15, true, 'Is the RAV4 still there?', false], ['G-2', 16, false, '', true], ['G-3', 17, true, 'Blue is fine', false]]) {
    await pg.query(`INSERT INTO buyer_texts (message_guid, onboarding_id, sent_at, from_buyer, body, service, unsent, edited, attachments, synced_at)
      VALUES ($1, $2, $3, $4, $5, 'RCS', $6, false, '[]'::jsonb, now())`, [guid, id, `2026-12-09T${hour}:00:00Z`, fromBuyer, body, unsent]);
  }
  const texts = await get(sql, `intake=${id}&read=texts&last=2`);
  assert.deepEqual(Object.keys(texts.body).sort(), ['dealer_texts', 'intake_id', 'last_synced_at', 'note', 'ok', 'texts', 'total']);
  assert.deepEqual([texts.body.dealer_texts.total, texts.body.dealer_texts.threads], [0, []]);
  assert.equal(texts.body.total, 3);
  assert.ok(texts.body.last_synced_at);
  assert.deepEqual(texts.body.texts.map(text => [text.from, text.body]), [['mason', '[unsent]'], ['buyer', 'Blue is fine']]);
  assert.equal((await get(sql, `intake=${id}&read=texts`)).body.texts.length, 3);

  await pg.query(`INSERT INTO deal_events (onboarding_id, kind, actor, dealer_name, vin, otd_cents) VALUES ($1, 'quote', 'duet-deals', 'North Toyota', $2, 3350000)`, [id, VIN]);
  await readyUpdate(pg, id, 'Two prices are in.');
  const before = await snapshot(pg);
  const deal = await get(sql, `intake=${id.slice(0, 8)}&read=deal`);
  assert.equal(deal.status, 200);
  assert.deepEqual(Object.keys(deal.body).sort(), ['events', 'intake_id', 'listings', 'ok', 'shortlisted_at', 'summary', 'updates']);
  assert.deepEqual([deal.body.intake_id, deal.body.summary], [id, 'One RAV4 near Austin']);
  assert.deepEqual(deal.body.listings.map(car => [car.rank, car.title, car.vin, car.target_price_cents, car.dealer_name]),
    [[1, '2025 Toyota RAV4 XLE', VIN, 3250000, 'North Toyota']]);
  assert.deepEqual(deal.body.events.map(event => [event.kind, event.dealer_name, event.otd_cents]), [['quote', 'North Toyota', 3350000]]);
  assert.deepEqual(deal.body.updates.map(update => [update.body, update.status]), [['Two prices are in.', 'posted']]);
  // The buyer's contact details are not part of a deal's log.
  for (const hidden of ['riley.buyer@example.test', '205-555-0100']) assert.ok(!deal.raw.includes(hidden));
  assert.equal(await snapshot(pg), before, 'reading wrote nothing');
});

test('the helper script reads with a GET and the token, and never posts', async () => {
  const id = crypto.randomUUID();
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    calls.push({ url, init });
    return new Response(JSON.stringify({ ok: true, intake_id: id, picks: [] }), { status: 200 });
  };
  const run = args => carSearchRequest(args, { environment: { CAR_SEARCH_TOKEN: token, CAR_SEARCH_URL: 'http://localhost:3000/' }, fetchImpl });

  assert.deepEqual(await run(['picks', id]), { status: 200, body: { ok: true, intake_id: id, picks: [] } });
  await run(['documents', id]);
  await run(['texts', id, '40']);
  await run(['texts', id]);
  await run(['deal', id.slice(0, 8)]);
  assert.deepEqual(calls.map(call => call.url), [
    `http://localhost:3000/api/car-search?intake=${id}&read=picks`,
    `http://localhost:3000/api/car-search?intake=${id}&read=documents`,
    `http://localhost:3000/api/car-search?intake=${id}&read=texts&last=40`,
    `http://localhost:3000/api/car-search?intake=${id}&read=texts`,
    `http://localhost:3000/api/car-search?intake=${id.slice(0, 8)}&read=deal`
  ]);
  for (const { init } of calls) {
    assert.ok(init.method === undefined || init.method === 'GET', 'a read is a GET');
    assert.equal(init.body, undefined, 'a read sends no body');
    assert.deepEqual(init.headers, { Authorization: `Bearer ${token}`, Accept: 'application/json' });
  }

  // A refusal comes back as it is, for the script to exit non-zero on.
  const off = await carSearchRequest(['documents', id], { environment: { CAR_SEARCH_TOKEN: token },
    fetchImpl: async () => new Response(JSON.stringify({ ok: false, error: 'not_found', message: 'The Deal Tracker is off.' }), { status: 404 }) });
  assert.deepEqual(off, { status: 404, body: { ok: false, error: 'not_found', message: 'The Deal Tracker is off.' } });

  // Nothing is sent for a command the script doesn't know, a missing ID or a stray argument:
  // an unknown command must never fall through to a POST.
  const sent = calls.length;
  for (const bad of [['picks'], ['documents'], ['pick', id], ['document', id], ['picks', id, '5'], ['documents', id, 'out.pdf'], ['deal', id, '2'], ['clear', id]]) {
    await assert.rejects(run(bad), /Usage/, bad.join(' '));
  }
  await assert.rejects(run(['texts', id, 'all']), /whole number/);
  await assert.rejects(carSearchRequest(['picks', id], { environment: {}, fetchImpl }), /CAR_SEARCH_TOKEN is not set/);
  assert.equal(calls.length, sent, 'nothing was sent');
});
