import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { PGlite } from '@electric-sql/pglite';
import { loadBuyerView, signLink } from '../_lib/deal-tracker.js';
import { cleanupDocuments } from '../_lib/buyer-documents.js';
import { dealTrackerHandler } from '../deal-tracker.js';

// Buyer Documents are write-only through the buyer's link (docs/adr/0001): a
// buyer can add files but never view or download one back, and sees only a
// receipt of each file's type and time. Written before the feature. The store
// is a fake that records every call, so a read through the link can't hide.

const SECRET = 'deal-tracker-secret-for-tests-only-0123456789';
const environment = {
  DEAL_TRACKER_ENABLED: '1', DEAL_TRACKER_SECRET: SECRET, APP_ORIGIN: 'https://www.steermeright.com',
  BLOB_READ_WRITE_TOKEN: 'vercel_blob_rw_token_for_tests_only'
};
const NOW = Date.parse('2026-12-10T18:00:00Z');
const DAY = 86400000;
const MB = 1024 * 1024;
const FILE = 'FILE-SENTINEL-CONTENTS-OF-A-DRIVERS-LICENSE';

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

const VIN = '1HGCM82633A004352';
async function deal(pg, { agreed = false } = {}) {
  const id = crypto.randomUUID(), attempt = crypto.randomUUID(), purchase = crypto.randomUUID(), session = `cs_live_${id}`;
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
  const dealId = crypto.randomUUID();
  await pg.query('INSERT INTO deals (id, onboarding_id, shortlisted_at) VALUES ($1, $2, $3)', [dealId, id, new Date(NOW - 9 * DAY).toISOString()]);
  await pg.query('INSERT INTO deal_tracker_links (onboarding_id) VALUES ($1)', [id]);
  await pg.query(`INSERT INTO deal_listings (id, deal_id, rank, title, price_cents, vin, listing_url, dealer_name, est_otd_cents, color)
    VALUES ($1, $2, 1, '2024 Toyota RAV4 XLE', 3450000, $3, 'https://listings.example/one', 'Zzyzx Motors', 3777700, 'Lunar Rock')`, [crypto.randomUUID(), dealId, VIN]);
  await event(pg, id, 'quote', { otd: 3640000, daysAgo: 6 });
  if (agreed) await event(pg, id, 'agreed', { otd: 3610000, daysAgo: 4 });
  return id;
}
const event = (pg, id, kind, { otd = null, note = null, daysAgo = 5 } = {}) =>
  pg.query(`INSERT INTO deal_events (onboarding_id, kind, actor, dealer_name, vin, otd_cents, note, occurred_at)
    VALUES ($1, $2, 'mason', 'Zzyzx Motors', $3, $4, $5, $6)`, [id, kind, VIN, otd, note, new Date(NOW - daysAgo * DAY).toISOString()]);

// Stands in for the private Blob store. `put` is what the buyer's browser does with the upload URL.
function fakeStore() {
  const blobs = new Map();
  const calls = [];
  return {
    blobs, calls,
    put(pathname, { size = FILE.length, contentType = 'application/pdf' } = {}) { blobs.set(pathname, { size, contentType, body: Buffer.from(FILE) }); },
    async presignUpload({ pathname, contentType, maximumSizeInBytes }) {
      calls.push(['presignUpload', pathname, contentType, maximumSizeInBytes]);
      return { url: `https://blob.example.test/put/${pathname}?sig=PUT-ONLY-SIGNATURE`, method: 'PUT', headers: { 'content-type': contentType } };
    },
    async head(pathname) {
      calls.push(['head', pathname]);
      const blob = blobs.get(pathname);
      return blob ? { pathname, size: blob.size, contentType: blob.contentType } : null;
    },
    async get(pathname) {
      calls.push(['get', pathname]);
      const blob = blobs.get(pathname);
      return blob ? { body: blob.body, size: blob.size, contentType: blob.contentType } : null;
    },
    async del(pathname) { calls.push(['del', pathname]); blobs.delete(pathname); }
  };
}
const reads = store => store.calls.filter(([name]) => name === 'get');

function response() {
  return {
    statusCode: 200, headers: {}, body: '',
    setHeader(name, value) { this.headers[name.toLowerCase()] = value; },
    getHeader(name) { return this.headers[name.toLowerCase()]; },
    write(chunk) { this.body += Buffer.isBuffer(chunk) ? chunk.toString('latin1') : String(chunk); return true; },
    end(body = '') { this.body += Buffer.isBuffer(body) ? body.toString('latin1') : String(body); }
  };
}
async function call(pg, store, id, method, { form, query = '', env = environment, now = NOW, token = signLink(SECRET, id, 1) } = {}) {
  const body = form ? new URLSearchParams(form).toString() : '';
  const req = Readable.from(body ? [Buffer.from(body)] : []);
  Object.assign(req, { method, url: `/api/deal-tracker?t=${token}${query}`,
    headers: { host: 'www.steermeright.com', ...(body ? { 'content-type': 'application/x-www-form-urlencoded', 'sec-fetch-site': 'same-origin' } : {}) } });
  const res = response();
  await dealTrackerHandler({ environment: env, getDatabase: () => tagged(pg), now: () => now, documentStore: store })(req, res);
  return res;
}
const json = res => { try { return JSON.parse(res.body); } catch { return null; } };
const start = (pg, store, id, form = {}, options) => call(pg, store, id, 'POST',
  { form: { action: 'upload_start', doc_type: 'insurance', content_type: 'application/pdf', bytes: String(2 * MB), ...form }, ...options });
const done = (pg, store, id, ticket, options) => call(pg, store, id, 'POST', { form: { action: 'upload_done', ticket }, ...options });
// The whole upload as a browser does it: ask for a URL, send the file to the store, report back.
async function upload(pg, store, id, form = {}, stored = {}) {
  const started = await start(pg, store, id, form);
  assert.equal(started.statusCode, 200, started.body);
  const { ticket } = json(started);
  const pathname = store.calls.findLast(([name]) => name === 'presignUpload')[1];
  store.put(pathname, { contentType: form.content_type ?? 'application/pdf', size: Number(form.bytes ?? 2 * MB), ...stored });
  return { started, pathname, ticket, finished: await done(pg, store, id, ticket) };
}
const rows = async (pg, id) => (await pg.query('SELECT * FROM buyer_documents WHERE onboarding_id = $1 ORDER BY id', [id])).rows;

test('a buyer hands over a document and gets a receipt of its type and time, nothing more', async t => {
  const pg = await database(t);
  const store = fakeStore();
  const id = await deal(pg);
  const { started, pathname, finished } = await upload(pg, store, id);
  assert.equal(finished.statusCode, 200, finished.body);

  const [row] = await rows(pg, id);
  assert.equal(row.doc_type, 'insurance');
  assert.equal(row.blob_path, pathname);
  assert.equal(row.source, 'page');
  assert.equal(Number(row.bytes), 2 * MB);
  assert.ok(pathname.includes(id), 'the file is stored under its deal');

  // The upload URL is the only store URL the link ever returns, and it only writes.
  const upstream = json(started);
  assert.match(upstream.upload.url, /PUT-ONLY-SIGNATURE/);
  assert.equal(store.calls.find(([name]) => name === 'presignUpload')[3], 20 * MB, 'the upload URL is capped at 20 MB');
  assert.ok(!finished.body.includes('blob.example.test') && !finished.body.includes(pathname), 'reporting the upload returns no file location');

  const view = await loadBuyerView(tagged(pg), id, NOW);
  assert.equal(view.documents.length, 1);
  assert.deepEqual(Object.keys(view.documents[0]).sort(), ['at', 'doc_type'], 'a receipt is the type and the time');
  assert.equal(view.documents[0].doc_type, 'insurance');
  const page = await call(pg, store, id, 'GET');
  assert.equal(page.statusCode, 200);
  for (const text of [page.body, JSON.stringify(view)]) {
    for (const hidden of [pathname, 'blob.example.test', 'PUT-ONLY-SIGNATURE', FILE, String(row.id).padStart(6, '#')]) {
      assert.ok(!text.includes(hidden), `the buyer's page must not contain ${hidden}`);
    }
  }
  assert.equal(reads(store).length, 0, 'nothing read the file');
});

test('there is no download path from the buyer\'s link', async t => {
  const pg = await database(t);
  const store = fakeStore();
  const id = await deal(pg, { agreed: true });
  const { pathname, ticket } = await upload(pg, store, id, { doc_type: 'id', content_type: 'image/jpeg' });
  const [row] = await rows(pg, id);
  const attempts = [];
  for (const query of [`&document=${row.id}`, `&download=${row.id}`, `&doc=${row.id}`, `&file=${encodeURIComponent(pathname)}`, `&action=document&id=${row.id}`, `&ticket=${encodeURIComponent(ticket)}`]) {
    attempts.push(await call(pg, store, id, 'GET', { query }));
  }
  for (const action of ['download', 'document', 'get_document', 'upload_get', 'view', 'open', 'receipt', 'upload_url']) {
    attempts.push(await call(pg, store, id, 'POST', { form: { action, id: String(row.id), document: String(row.id), pathname, ticket } }));
  }
  // Reporting the same upload again must not turn into a way to fetch it.
  attempts.push(await done(pg, store, id, ticket));
  for (const res of attempts) {
    assert.ok(!res.body.includes(FILE), 'the file\'s contents never come back');
    assert.ok(!res.body.includes('blob.example.test') && !res.body.includes(pathname), 'no file location comes back');
    assert.doesNotMatch(String(res.headers['content-type'] || ''), /image|pdf|octet-stream/);
    assert.equal(res.headers['content-disposition'], undefined);
    assert.equal(res.headers.location?.includes('blob') ?? false, false);
  }
  assert.equal(reads(store).length, 0, 'the buyer\'s link never reads from the store');
  assert.equal((await rows(pg, id)).length, 1, 'and a replay files nothing twice');
});

test('ID is refused on the page before Price agreed and accepted after', async t => {
  const pg = await database(t);
  const store = fakeStore();
  const before = await deal(pg);
  const refused = await start(pg, store, before, { doc_type: 'id', content_type: 'image/jpeg' });
  assert.ok(refused.statusCode >= 400 && refused.statusCode < 500);
  assert.equal(store.calls.length, 0, 'no upload URL is issued');
  assert.ok(!(await call(pg, store, before, 'GET')).body.includes('value="id"'), 'the ID type is not offered yet');

  const after = await deal(pg, { agreed: true });
  assert.ok((await call(pg, store, after, 'GET')).body.includes('value="id"'));
  const { finished } = await upload(pg, store, after, { doc_type: 'id', content_type: 'image/jpeg' });
  assert.equal(finished.statusCode, 200);
  assert.equal((await rows(pg, after))[0].doc_type, 'id');
});

test('only images and PDFs up to 20 MB are taken, and what was stored is checked, not what was promised', async t => {
  const pg = await database(t);
  const store = fakeStore();
  const id = await deal(pg);
  for (const form of [
    { content_type: 'text/html' }, { content_type: 'image/svg+xml' }, { content_type: 'application/zip' }, { content_type: 'application/x-msdownload' },
    { bytes: String(20 * MB + 1) }, { bytes: '0' }, { bytes: 'lots' }, { doc_type: 'passport' }, { doc_type: '' }
  ]) {
    const res = await start(pg, store, id, form);
    assert.ok(res.statusCode >= 400 && res.statusCode < 500, JSON.stringify(form));
  }
  assert.equal(store.calls.length, 0, 'no upload URL is issued for a refused file');
  for (const contentType of ['application/pdf', 'image/jpeg', 'image/png', 'image/heic', 'image/webp']) {
    assert.equal((await start(pg, store, id, { content_type: contentType })).statusCode, 200, contentType);
  }

  // The browser lied: a bigger file, or a different type, landed in the store.
  for (const stored of [{ size: 20 * MB + 1 }, { contentType: 'text/html' }]) {
    const lied = await upload(pg, store, id, {}, stored);
    assert.ok(lied.finished.statusCode >= 400 && lied.finished.statusCode < 500);
    assert.ok(!store.blobs.has(lied.pathname), 'the file is removed from the store');
  }
  // Reporting an upload that never reached the store.
  const ghost = json(await start(pg, store, id));
  assert.ok((await done(pg, store, id, ghost.ticket)).statusCode >= 400);
  assert.ok((await done(pg, store, id, 'not-a-ticket')).statusCode >= 400);
  assert.equal((await rows(pg, id)).length, 0, 'none of it was filed');
});

test('an upload belongs to the link that started it', async t => {
  const pg = await database(t);
  const store = fakeStore();
  const mine = await deal(pg);
  const theirs = await deal(pg);
  const started = json(await start(pg, store, mine));
  const pathname = store.calls.at(-1)[1];
  store.put(pathname, { size: 2 * MB });
  const crossed = await done(pg, store, theirs, started.ticket);
  assert.ok(crossed.statusCode >= 400 && crossed.statusCode < 500, 'another deal\'s link can\'t claim it');
  assert.equal((await rows(pg, theirs)).length, 0);
  assert.equal((await done(pg, store, mine, started.ticket)).statusCode, 200);
  assert.equal((await rows(pg, mine)).length, 1);
});

test('a refused link, a cross-site post or the switch off never reaches the store', async t => {
  const pg = await database(t);
  const store = fakeStore();
  const id = await deal(pg);
  const good = signLink(SECRET, id, 1);
  const forged = good.slice(0, -1) + (good.endsWith('a') ? 'b' : 'a');
  assert.ok((await start(pg, store, id, {}, { token: forged })).statusCode >= 400);
  await pg.query('UPDATE deal_tracker_links SET revoked_at = now() WHERE onboarding_id = $1', [id]);
  assert.ok((await start(pg, store, id)).statusCode >= 400);
  await pg.query('UPDATE deal_tracker_links SET revoked_at = NULL WHERE onboarding_id = $1', [id]);
  assert.equal((await start(pg, store, id, {}, { env: { ...environment, DEAL_TRACKER_ENABLED: '0' } })).statusCode, 404);
  assert.equal(store.calls.length, 0);
  assert.equal((await rows(pg, id)).length, 0);
});

test('files are deleted 30 days after the latest close, and a reopened deal keeps its files', async t => {
  const pg = await database(t);
  const store = fakeStore();
  const sql = tagged(pg);
  const closedLongAgo = await deal(pg, { agreed: true });
  const closedRecently = await deal(pg, { agreed: true });
  const reopened = await deal(pg, { agreed: true });
  const open = await deal(pg);
  const paths = {};
  for (const [name, id] of Object.entries({ closedLongAgo, closedRecently, reopened, open })) paths[name] = (await upload(pg, store, id)).pathname;
  await event(pg, closedLongAgo, 'closed', { note: 'Bought', daysAgo: 31 });
  await event(pg, closedRecently, 'closed', { note: 'Bought', daysAgo: 29 });
  await event(pg, reopened, 'closed', { note: 'Refunded', daysAgo: 40 });
  await event(pg, reopened, 'reopened', { daysAgo: 35 });

  const result = await cleanupDocuments({ sql, store, now: NOW });
  assert.equal(result.deleted, 1);
  assert.ok(!store.blobs.has(paths.closedLongAgo), 'the long-closed deal\'s file is gone from the store');
  for (const name of ['closedRecently', 'reopened', 'open']) assert.ok(store.blobs.has(paths[name]), `${name} keeps its file`);
  assert.ok((await rows(pg, closedLongAgo))[0].deleted_at, 'and the row records when');
  for (const id of [closedRecently, reopened, open]) assert.equal((await rows(pg, id))[0].deleted_at, null);

  assert.equal((await cleanupDocuments({ sql, store, now: NOW })).deleted, 0, 'a rerun deletes nothing twice');
  // A receipt outlives its file, so the buyer still sees what they handed over.
  assert.equal(reads(store).length, 0);
});
