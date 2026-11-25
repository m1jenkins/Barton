import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { PGlite } from '@electric-sql/pglite';
import { ConfigError } from '../_lib/config.js';
import { cleanupDocuments, documentSettings, issueTicket, readDocument, readTicket } from '../_lib/buyer-documents.js';
import { renderTracker, signLink } from '../_lib/deal-tracker.js';
import { dealTrackerHandler } from '../deal-tracker.js';
import { SAMPLE_VIEWS } from '../../scripts/preview-deal-tracker.mjs';

// Buyer Documents beyond the protection suite (buyer-documents-privacy.test.mjs):
// the upload ticket, the rate limit, a closed search, a store that isn't set up,
// the page's form and script, reading a file, and cleanup that survives a failure.

const SECRET = 'deal-tracker-secret-for-tests-only-0123456789';
const environment = {
  DEAL_TRACKER_ENABLED: '1', DEAL_TRACKER_SECRET: SECRET, APP_ORIGIN: 'https://www.steermeright.com',
  BLOB_READ_WRITE_TOKEN: 'vercel_blob_rw_token_for_tests_only'
};
const noStore = { DEAL_TRACKER_ENABLED: '1', DEAL_TRACKER_SECRET: SECRET, APP_ORIGIN: 'https://www.steermeright.com' };
const NOW = Date.parse('2026-12-10T18:00:00Z');
const DAY = 86400000;
const MB = 1024 * 1024;

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
    VALUES ($1, $2, $3, $5, $4, 'full_service', 'Riley Buyer', 'riley.buyer@example.test', '205-555-0100', 'Austin', '{}')`,
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
const addDocument = (pg, id, { minutesAgo = 5, docType = 'insurance', deleted = false } = {}) =>
  pg.query(`INSERT INTO buyer_documents (onboarding_id, doc_type, blob_path, content_type, bytes, created_at, deleted_at)
    VALUES ($1, $2, $3, 'application/pdf', 1000, $4, $5) RETURNING id`,
  [id, docType, `deals/${id}/${crypto.randomUUID()}.pdf`,
    new Date(NOW - minutesAgo * 60000).toISOString(), deleted ? new Date(NOW).toISOString() : null]).then(result => Number(result.rows[0].id));

function fakeStore() {
  const blobs = new Map();
  const calls = [];
  return {
    blobs, calls,
    put(pathname, { size = 9, contentType = 'application/pdf', body = Buffer.from('FILE-BODY') } = {}) { blobs.set(pathname, { size, contentType, body }); },
    async presignUpload({ pathname, contentType }) {
      calls.push(['presignUpload', pathname]);
      return { url: `https://blob.example.test/put/${pathname}`, method: 'PUT', headers: { 'x-content-type': contentType } };
    },
    async head(pathname) { calls.push(['head', pathname]); const blob = blobs.get(pathname); return blob ? { pathname, size: blob.size, contentType: blob.contentType } : null; },
    async get(pathname) { calls.push(['get', pathname]); const blob = blobs.get(pathname); return blob ? { body: blob.body, size: blob.size, contentType: blob.contentType } : null; },
    async del(pathname) { calls.push(['del', pathname]); blobs.delete(pathname); }
  };
}

function response() {
  return {
    statusCode: 200, headers: {}, body: '',
    setHeader(name, value) { this.headers[name.toLowerCase()] = value; },
    end(body = '') { this.body += String(body); }
  };
}
async function call(pg, store, id, method, { form, env = environment, now = NOW } = {}) {
  const body = form ? new URLSearchParams(form).toString() : '';
  const req = Readable.from(body ? [Buffer.from(body)] : []);
  Object.assign(req, { method, url: `/api/deal-tracker?t=${signLink(SECRET, id, 1)}`,
    headers: { host: 'www.steermeright.com', ...(body ? { 'content-type': 'application/x-www-form-urlencoded', 'sec-fetch-site': 'same-origin' } : {}) } });
  const res = response();
  await dealTrackerHandler({ environment: env, getDatabase: () => tagged(pg), now: () => now, documentStore: store })(req, res);
  return res;
}
const start = (pg, store, id, form = {}, options) => call(pg, store, id, 'POST',
  { form: { action: 'upload_start', doc_type: 'insurance', content_type: 'application/pdf', bytes: String(2 * MB), ...form }, ...options });

test('documentSettings needs the Deal Tracker on and a store: a read-write token, or a store ID for Vercel\'s OIDC', () => {
  assert.equal(documentSettings({}), null);
  assert.equal(documentSettings({ BLOB_READ_WRITE_TOKEN: 'vercel_blob_rw_x' }), null, 'switch off');
  assert.equal(documentSettings(noStore), null, 'no store');
  assert.deepEqual(documentSettings(environment), { secret: SECRET, token: 'vercel_blob_rw_token_for_tests_only', storeId: null });
  assert.deepEqual(documentSettings({ ...noStore, BLOB_STORE_ID: 'store_abc' }), { secret: SECRET, token: null, storeId: 'store_abc' });
  assert.throws(() => documentSettings({ ...environment, DEAL_TRACKER_SECRET: 'short' }), ConfigError);
});

test('an upload ticket is refused when tampered with, expired, for another deal or signed with another secret, and carries no secret', () => {
  const id = crypto.randomUUID();
  const fields = { onboardingId: id, pathname: `deals/${id}/${crypto.randomUUID()}.pdf`, docType: 'insurance', contentType: 'application/pdf', expires: NOW + 3600000 };
  const ticket = issueTicket(SECRET, fields);
  assert.deepEqual(readTicket(SECRET, ticket, id, NOW), { pathname: fields.pathname, docType: 'insurance', contentType: 'application/pdf' });
  assert.ok(!ticket.includes(SECRET) && !Buffer.from(ticket.split('.')[0], 'base64url').toString().includes(SECRET), 'no secret inside');

  const [payload, signature] = ticket.split('.');
  const swap = (text, at) => text.slice(0, at) + (text[at] === 'A' ? 'B' : 'A') + text.slice(at + 1);
  const retyped = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(payload, 'base64url')), t: 'id' })).toString('base64url');
  for (const bad of [`${swap(payload, 3)}.${signature}`, `${payload}.${swap(signature, 5)}`, `${retyped}.${signature}`, `${payload}.`, 'not-a-ticket', '', null]) {
    assert.equal(readTicket(SECRET, bad, id, NOW), null, String(bad));
  }
  assert.equal(readTicket(SECRET, ticket, id, NOW + 3600001), null, 'expired');
  assert.equal(readTicket(SECRET, ticket, crypto.randomUUID(), NOW), null, 'another deal');
  assert.equal(readTicket(SECRET, issueTicket(`${SECRET}-other`, fields), id, NOW), null, 'forged without the secret');
  // A path outside the deal's own folder is refused even with a good signature.
  assert.equal(readTicket(SECRET, issueTicket(SECRET, { ...fields, pathname: 'deals/elsewhere/x.pdf' }), id, NOW), null);
});

test('the 21st document in an hour, or the 61st in a day, is refused without asking the store', async t => {
  const pg = await database(t);
  const store = fakeStore();
  const id = await deal(pg);
  for (let index = 0; index < 20; index++) await addDocument(pg, id, { minutesAgo: 30 });
  const hour = await start(pg, store, id);
  assert.equal(hour.statusCode, 429);
  assert.equal(JSON.parse(hour.body).error, 'rate_limited');
  assert.equal(store.calls.length, 0);

  const other = await deal(pg);
  for (let index = 0; index < 60; index++) await addDocument(pg, other, { minutesAgo: 120 + index * 10 });
  assert.equal((await start(pg, store, other)).statusCode, 429);
  // Documents older than a day don't count.
  const older = await deal(pg);
  for (let index = 0; index < 60; index++) await addDocument(pg, older, { minutesAgo: 25 * 60 });
  assert.equal((await start(pg, store, older)).statusCode, 200);
  assert.equal(store.calls.length, 1);
});

test('a search closed without a purchase has no document section and takes no upload; a bought one still does', async t => {
  const pg = await database(t);
  const store = fakeStore();
  const id = await deal(pg);
  await event(pg, id, 'closed', { note: 'Buyer walked away', daysAgo: 1 });
  const page = await call(pg, store, id, 'GET');
  assert.equal(page.statusCode, 200);
  assert.ok(!page.body.includes('Send me a document') && !page.body.includes('<script'));
  const refused = await start(pg, store, id);
  assert.equal(refused.statusCode, 409);
  assert.equal(JSON.parse(refused.body).error, 'closed');
  assert.equal(store.calls.length, 0);

  const bought = await deal(pg, { agreed: true });
  await event(pg, bought, 'closed', { note: 'Bought', daysAgo: 1 });
  assert.ok((await call(pg, store, bought, 'GET')).body.includes('value="id"'));
  assert.equal((await start(pg, store, bought, { doc_type: 'id', content_type: 'image/png' })).statusCode, 200);
});

test('with no store set up, uploads answer 503 JSON and the page still renders, saying so', async t => {
  const pg = await database(t);
  const store = fakeStore();
  const id = await deal(pg);
  const refused = await start(pg, store, id, {}, { env: noStore });
  assert.equal(refused.statusCode, 503);
  assert.match(refused.headers['content-type'], /application\/json/);
  assert.match(refused.headers['content-security-policy'], /default-src 'none'/);
  assert.deepEqual(Object.keys(JSON.parse(refused.body)).sort(), ['error', 'message', 'ok']);
  const done = await call(pg, store, id, 'POST', { form: { action: 'upload_done', ticket: 'x' }, env: noStore });
  assert.equal(done.statusCode, 503);
  assert.equal(store.calls.length, 0);

  const page = await call(pg, store, id, 'GET', { env: noStore });
  assert.equal(page.statusCode, 200);
  assert.ok(page.body.includes('Send me a document') && page.body.includes('isn’t available right now'));
  assert.ok(!page.body.includes('dt-docs-form') && !page.body.includes('<script'), 'no form and no script');
});

test('the page offers ID only from Price agreed, lists receipts with labels and times, and loads the script only with the form', () => {
  const html = (name, options) => renderTracker(SAMPLE_VIEWS[name], { action: `/deal/${name}`, ...options });
  for (const name of ['confirming-search', 'shortlisted', 'emailing-dealers', 'quotes-in', 'quotes-in-ready']) {
    assert.ok(html(name).includes('<select class="dt-field" id="dt-doc-type" name="doc_type" required>'), name);
    assert.ok(!html(name).includes('value="id"'), name);
  }
  for (const name of ['price-agreed', 'price-agreed-no-car', 'closed-bought']) assert.ok(html(name).includes('<option value="id">ID</option>'), name);

  const agreed = html('price-agreed');
  assert.ok(agreed.includes('<li>Loan pre-approval · sent <time datetime="2026-12-02T20:15:00Z">Dec 2, 2:15 PM</time></li>'));
  assert.ok(agreed.includes('<li>Trade-in photos · sent') && agreed.includes('<li>ID · sent'));
  assert.ok(agreed.includes('<input class="dt-field dt-field--file" id="dt-doc-file" name="file" type="file" accept="application/pdf,image/jpeg,image/png,image/heic,image/heif,image/webp,'));
  assert.ok(agreed.includes('aria-live="polite"') && agreed.includes('<noscript>'));
  assert.ok(agreed.includes('it can’t be opened from this page'));
  assert.ok(agreed.includes('<form class="dt-docs" id="dt-docs-form" method="post" action="/deal/price-agreed"'));
  assert.equal(agreed.match(/<script\b/g).length, 1);
  assert.ok(agreed.includes('<script src="/buying/deal-tracker.js" defer></script>'));
  // No receipts yet: the list and its heading wait, hidden, for the script to fill them.
  assert.ok(html('confirming-search').includes('<h3 class="dt-receipts__title" hidden id="dt-receipts-title">'));
  assert.ok(html('confirming-search').includes('<ul class="dt-receipts" id="dt-receipts" hidden></ul>'));
  assert.ok(agreed.includes('<h3 class="dt-receipts__title" id="dt-receipts-title">What you’ve sent</h3>'));
  assert.ok(!html('price-agreed', { uploads: false }).includes('<script'), 'no form, no script');
  assert.ok(!html('closed-other').includes('<script') && !html('closed-other').includes('dt-docs'));
  for (const name of Object.keys(SAMPLE_VIEWS)) assert.doesNotMatch(html(name), /\bbriefs?\b|\battachment|\bupload\b/i, name);
});

test('the page\'s CSP allows its own script and the Blob upload API, and nothing inline', async t => {
  const pg = await database(t);
  const page = await call(pg, fakeStore(), await deal(pg), 'GET');
  const csp = page.headers['content-security-policy'];
  assert.match(csp, /(^|; )default-src 'none'(;|$)/);
  assert.match(csp, /(^|; )script-src 'self'(;|$)/);
  assert.match(csp, /(^|; )connect-src 'self' https:\/\/vercel\.com(;|$)/);
  assert.doesNotMatch(csp, /unsafe-inline|unsafe-eval|\*/);
});

test('buying/deal-tracker.js parses and reaches no other site on its own', async () => {
  const file = new URL('../../buying/deal-tracker.js', import.meta.url);
  const checked = spawnSync(process.execPath, ['--check', file.pathname], { encoding: 'utf8' });
  assert.equal(checked.status, 0, checked.stderr);
  const source = (await readFile(file, 'utf8')).replace(/^\s*\/\/.*$/gm, '');
  assert.doesNotMatch(source, /https?:\/\/|\/\/[a-z0-9.-]+\.[a-z]{2,}/i, 'no URL to another origin');
  assert.doesNotMatch(source, /\bimport\b|gtag|dataLayer|analytics|localStorage|document\.cookie|innerHTML/);
});

test('readDocument gives Mason or an agent any file, and says when a file is gone or missing', async t => {
  const pg = await database(t);
  const sql = tagged(pg);
  const store = fakeStore();
  const id = await deal(pg);
  const live = await addDocument(pg, id, { docType: 'pre_approval' });
  const [{ blob_path: path }] = (await pg.query('SELECT blob_path FROM buyer_documents WHERE id = $1', [live])).rows;
  store.put(path, { contentType: 'application/pdf' });
  const file = await readDocument({ sql, store, id: live });
  assert.deepEqual([file.filename, file.contentType, file.bytes, String(file.body)], [`pre_approval-${live}.pdf`, 'application/pdf', 9, 'FILE-BODY']);

  // A row whose file never reached the store.
  assert.deepEqual(await readDocument({ sql, store, id: await addDocument(pg, id) }), { error: 'missing' });

  assert.deepEqual(await readDocument({ sql, store, id: await addDocument(pg, id, { deleted: true }) }), { error: 'deleted' });
  for (const bad of ['999999', '0', '-1', '1 OR 1=1', '', null]) assert.deepEqual(await readDocument({ sql, store, id: bad }), { error: 'not_found' }, String(bad));
});

test('one failed delete doesn\'t stop the cleanup, and a rerun picks it up', async t => {
  const pg = await database(t);
  const sql = tagged(pg);
  const id = await deal(pg, { agreed: true });
  const first = await addDocument(pg, id);
  const second = await addDocument(pg, id);
  await event(pg, id, 'closed', { note: 'Bought', daysAgo: 31 });
  const [{ blob_path: stuck }] = (await pg.query('SELECT blob_path FROM buyer_documents WHERE id = $1', [first])).rows;
  const store = fakeStore();
  const flaky = { ...store, async del(pathname) { if (pathname === stuck) throw new Error('store down'); return store.del(pathname); } };
  assert.deepEqual(await cleanupDocuments({ sql, store: flaky, now: NOW }), { deleted: 1, failed: 1 });
  const rows = (await pg.query('SELECT id, deleted_at FROM buyer_documents ORDER BY id')).rows;
  assert.deepEqual(rows.map(row => [Number(row.id), Boolean(row.deleted_at)]), [[first, false], [second, true]]);
  assert.deepEqual(await cleanupDocuments({ sql, store, now: NOW }), { deleted: 1, failed: 0 });
});
