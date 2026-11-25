import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { PGlite } from '@electric-sql/pglite';
import { checkLink, dealTrackerSettings, loadBuyerView, signLink } from '../_lib/deal-tracker.js';
import { dealTrackerHandler } from '../deal-tracker.js';

// The rules that protect buyers and dealers on the Deal Tracker
// (docs/deal-tracker-build-plan-2026-11-21.md, "Decisions": Hidden, Link; and
// docs/adr/0003: dealers and listings show from Quotes in, photos come through
// the page's own path). Every fixture value that must stay hidden is a sentinel
// that could not appear by accident.

const SECRET = 'deal-tracker-secret-for-tests-only-0123456789';
const environment = { DEAL_TRACKER_ENABLED: '1', DEAL_TRACKER_SECRET: SECRET, APP_ORIGIN: 'https://www.steermeright.com' };
const NOW = Date.parse('2026-12-10T18:00:00Z');
const DAY = 86400000;
const at = daysAgo => new Date(NOW - daysAgo * DAY).toISOString();

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

const CARS = [
  { rank: 1, title: '2024 Toyota RAV4 XLE', color: 'Lunar Rock', mileage: 12345, vin: '1HGCM82633A004352', dealer: 'Zzyzx Motors',
    url: 'https://listings.example/sentinel-listing-1', email: 'sales@zzyzx-motors.example' },
  { rank: 2, title: '2023 Honda CR-V EX-L', color: 'Canyon River Blue', mileage: 23456, vin: '2T3W1RFV8MW123456', dealer: 'Quorra Auto Haus',
    url: 'https://listings.example/sentinel-listing-2', email: 'desk@quorra-auto.example' },
  // A title that carries its dealer's name and VIN: neither may reach the buyer.
  { rank: 3, title: '2024 Mazda CX-5 Select at Vandelay Imports 5YJ3E1EA7KF317000', color: 'Soul Red', mileage: 34567, vin: '5YJ3E1EA7KF317000',
    dealer: 'Vandelay Imports', url: 'https://listings.example/sentinel-listing-3', email: 'internet@vandelay.example' }
];
// Each car's photos sit on a host named for its dealer, so a photo URL on the page
// would name the dealer. The page serves them from its own path instead.
const photosOf = car => [1, 2, 3].map(n => `https://photos-${car.rank}.sentinel-cdn.example/img-${n}.jpg`);
// A feature that carries the dealer's name: the name comes out of car text at
// every stage (from Quotes in the dealer has its own line).
const detailsOf = car => ({ trim: 'XLE', drivetrain: 'AWD', features: ['Blind-spot monitor', `Certified by ${car.dealer}`] });
// asking 34,500 and estimated total 37,777 are for the buyer; the rest never are,
// at any stage: targets, walk-away, our notes, the dealer's email and phone, and
// where a photo really lives.
const NEVER = ['31,111', '31111', '32,222', '32222', '33,333', '33333', '35,555', '35555',
  'WHY-SENTINEL', 'SUMMARY-SENTINEL', 'NOTE-SENTINEL', '512-555-0142', 'sentinel-cdn',
  ...CARS.map(car => car.email)];
// What names a dealer: hidden before Quotes in. The VIN stays off the page always.
const dealerSecrets = car => [car.dealer, car.url, car.vin, 'Sentinelville'];

async function database(t) {
  const pg = await PGlite.create();
  t.after(() => pg.close());
  for (const migration of migrations) await pg.exec(migration);
  return pg;
}

// One paid intake with a deal opened at intake and its link row.
async function intake(pg, { name = 'Riley Buyer' } = {}) {
  const id = crypto.randomUUID(), attempt = crypto.randomUUID(), purchase = crypto.randomUUID(), session = `cs_live_${id}`;
  await pg.query(`INSERT INTO checkout_attempts (id, client_reference_id, idempotency_key, request_hash, tier_id, expected_amount, status)
    VALUES ($1, $1, $2, $3, 'full_service', 39500, 'paid')`, [attempt, attempt, 'a'.repeat(64)]);
  await pg.query(`INSERT INTO stripe_events (event_id, event_type, checkout_session_id, livemode, stripe_created_at)
    VALUES ($1, 'checkout.session.completed', $1, true, now())`, [session]);
  await pg.query(`INSERT INTO purchases (id, checkout_session_id, checkout_attempt_id, client_reference_id, stripe_event_id,
    stripe_payment_intent_id, tier_id, amount_total, currency, payment_status, livemode, paid_at)
    VALUES ($1, $2, $3, $3, $2, 'pi_1', 'full_service', 39500, 'usd', 'paid', true, now())`, [purchase, session, attempt]);
  await pg.query(`INSERT INTO onboarding_submissions (id, checkout_session_id, purchase_id, idempotency_key, request_hash, tier_id, name, email, phone, city, fields)
    VALUES ($1, $2, $3, $6, $4, 'full_service', $5, 'riley.buyer@example.test', '205-555-0100', 'Austin',
      '{"preferred_makes":"Toyota RAV4 or Honda CR-V","budget":"$38,000 all in","delivery_address":"ADDRESS-SENTINEL 12 Oak St","trade_identifier":"PLATE-SENTINEL"}')`,
  [id, session, purchase, 'b'.repeat(64), name, id]);
  await pg.query('INSERT INTO deals (id, onboarding_id) VALUES ($1, $2)', [crypto.randomUUID(), id]);
  await pg.query('INSERT INTO deal_tracker_links (onboarding_id) VALUES ($1)', [id]);
  return id;
}

async function shortlist(pg, id) {
  const { rows: [deal] } = await pg.query(`UPDATE deals SET shortlisted_at = $2, search_summary = 'SUMMARY-SENTINEL mentions Zzyzx Motors'
    WHERE onboarding_id = $1 RETURNING id`, [id, at(9)]);
  for (const car of CARS) {
    await pg.query(`INSERT INTO deal_listings (id, deal_id, rank, title, price_cents, market_price_cents, target_price_cents, walk_away_cents,
        mileage, days_on_lot, vin, listing_url, dealer_name, dealer_location, dealer_email, dealer_phone, why, est_otd_cents, color, photo_urls, details)
      VALUES ($1, $2, $3, $4, 3450000, 3333300, 3111100, 3222200, $5, 41, $6, $7, $8, 'Sentinelville, TX', $9, '512-555-0142', 'WHY-SENTINEL', 3777700, $10, $11, $12)`,
    [crypto.randomUUID(), deal.id, car.rank, car.title, car.mileage, car.vin, car.url, car.dealer, car.email, car.color,
      JSON.stringify(photosOf(car)), JSON.stringify(detailsOf(car))]);
  }
}

const event = (pg, id, kind, { dealer = null, vin = null, otd = null, note = 'NOTE-SENTINEL', daysAgo = 5 } = {}) =>
  pg.query(`INSERT INTO deal_events (onboarding_id, kind, actor, dealer_name, vin, otd_cents, note, occurred_at)
    VALUES ($1, $2, 'deal-desk', $3, $4, $5, $6, $7)`, [id, kind, dealer, vin, otd, note, at(daysAgo)]);

// Builds a deal up to the named stage, each stage adding to the one before.
const ORDER = ['confirming', 'shortlisted', 'emailing', 'quoted', 'agreed'];
async function dealAt(pg, stage) {
  const id = await intake(pg);
  const reached = name => ORDER.indexOf(stage) >= ORDER.indexOf(name);
  if (reached('shortlisted')) await shortlist(pg, id);
  if (reached('emailing')) for (const car of CARS) await event(pg, id, 'first_email_sent', { dealer: car.dealer, vin: car.vin, daysAgo: 8 });
  if (reached('quoted')) {
    await event(pg, id, 'quote', { dealer: CARS[0].dealer, vin: CARS[0].vin, otd: 3640000, daysAgo: 6 });
    await event(pg, id, 'quote', { dealer: CARS[1].dealer, vin: CARS[1].vin, otd: 3690000, daysAgo: 6 });
    await event(pg, id, 'counter', { dealer: CARS[0].dealer, vin: CARS[0].vin, otd: 3555500, daysAgo: 5 });
    await pg.query(`INSERT INTO deal_events (onboarding_id, kind, actor, dealer_name, note, options, occurred_at)
      VALUES ($1, 'needs_mason', 'deal-desk', $2, 'NOTE-SENTINEL should we push Zzyzx Motors?', '["Yes","No"]', $3)`, [id, CARS[0].dealer, at(5)]);
  }
  if (reached('agreed')) await event(pg, id, 'agreed', { dealer: CARS[0].dealer, vin: CARS[0].vin, otd: 3610000, daysAgo: 4 });
  return id;
}

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
async function open(pg, token, { now = NOW, env = environment } = {}) {
  const res = response();
  await dealTrackerHandler({ environment: env, getDatabase: () => tagged(pg), now: () => now })(request('GET', `/api/deal-tracker?t=${encodeURIComponent(token)}`), res);
  return res;
}
const tokenFor = (id, version = 1) => signLink(SECRET, id, version);

function assertAbsent(haystack, needles, where) {
  const lower = haystack.toLowerCase();
  for (const needle of needles) assert.ok(!lower.includes(String(needle).toLowerCase()), `${where} must not contain ${needle}`);
}
// Everything a buyer could receive for a deal: the page and the data behind it.
async function everything(pg, id) {
  const page = await open(pg, tokenFor(id));
  assert.equal(page.statusCode, 200);
  const view = JSON.stringify(await loadBuyerView(tagged(pg), id, NOW));
  return { html: page.body, view, page };
}

for (const stage of ['confirming', 'shortlisted', 'emailing']) {
  test(`before Quotes in (${stage}): no dealer name, location, listing link, VIN, photo source, target or walk-away price reaches the buyer`, async t => {
    const pg = await database(t);
    const id = await dealAt(pg, stage);
    const { html, view } = await everything(pg, id);
    for (const [where, text] of [['the page', html], ['the buyer view', view]]) {
      assertAbsent(text, CARS.flatMap(dealerSecrets), where);
      assertAbsent(text, NEVER, where);
      assertAbsent(text, ['ADDRESS-SENTINEL', 'PLATE-SENTINEL', 'riley.buyer@example.test', '205-555-0100'], where);
    }
  });
}

test('from Quotes in every car names its dealer and location and links its listing; VINs, photo sources and targets stay hidden', async t => {
  const pg = await database(t);
  const id = await dealAt(pg, 'quoted');
  const { html, view } = await everything(pg, id);
  for (const car of CARS) {
    assert.ok(html.includes(car.dealer), `the page names ${car.dealer}`);
    assert.ok(html.includes(car.url), `the page links ${car.url}`);
  }
  assert.ok(html.includes('Sentinelville, TX'), 'the dealer\'s location shows');
  assert.match(html, /don’t contact these dealers yourself/);
  for (const [where, text] of [['the page', html], ['the buyer view', view]]) {
    assertAbsent(text, [...CARS.map(car => car.vin), ...NEVER], where);
    assertAbsent(text, ['ADDRESS-SENTINEL', 'PLATE-SENTINEL', 'riley.buyer@example.test', '205-555-0100'], where);
  }
});

test('from Shortlisted the buyer sees each car with its photos, details, asking price and estimated total, then its best price so far', async t => {
  const pg = await database(t);
  const listedId = await dealAt(pg, 'shortlisted');
  const listed = await everything(pg, listedId);
  for (const shown of ['2024 Toyota RAV4 XLE', '2023 Honda CR-V EX-L', '2024 Mazda CX-5 Select', 'Lunar Rock', '12,345', '34,500', '37,777',
    'Car details', 'Drivetrain', 'AWD', 'Blind-spot monitor', '3 photos']) {
    assert.ok(listed.html.includes(shown), `the page shows ${shown}`);
  }
  // Photos come from the page's own path, never from where they live.
  const token = tokenFor(listedId);
  for (const car of CARS) for (const n of [0, 1, 2]) assert.ok(listed.html.includes(`src="/deal/${token}/photo/${car.rank}/${n}"`), `photo ${car.rank}/${n} is served by the page`);
  assert.ok(listed.html.includes('Each car’s dealer and listing show here once written prices come in.'));
  const quoted = await everything(pg, await dealAt(pg, 'quoted'));
  assert.ok(quoted.html.includes('36,400') && quoted.html.includes('36,900'), 'written prices show');
  assert.ok(quoted.html.includes('37,777'), 'the unquoted car keeps its estimated total');
});

test('a confirming deal shows the search details the buyer gave, minus the private ones', async t => {
  const pg = await database(t);
  const { html } = await everything(pg, await dealAt(pg, 'confirming'));
  assert.ok(html.includes('Toyota RAV4 or Honda CR-V'));
  assert.ok(html.includes('Riley'));
});

test('after Price agreed the agreed car leads with its dealer and price, the others stay listed, and targets stay hidden', async t => {
  const pg = await database(t);
  const id = await dealAt(pg, 'agreed');
  const { html, view } = await everything(pg, id);
  assert.ok(html.includes('Zzyzx Motors'), 'the agreed dealer is named');
  assert.ok(html.includes('https://listings.example/sentinel-listing-1'), 'the agreed car links to its listing');
  assert.ok(html.includes('36,100'), 'the agreed price shows');
  for (const [where, text] of [['the page', html], ['the buyer view', view]]) {
    assertAbsent(text, [...CARS.map(car => car.vin), ...NEVER], where);
  }
  assert.ok(html.includes('2023 Honda CR-V EX-L'), 'the other cars stay listed');
});

test('closing a deal never reveals more: bought keeps only the car bought, any other close names no dealer', async t => {
  const pg = await database(t);
  const bought = await dealAt(pg, 'agreed');
  await event(pg, bought, 'closed', { note: 'Bought: NOTE-SENTINEL picked up Saturday', daysAgo: 1 });
  const done = await everything(pg, bought);
  assert.ok(done.html.includes('Zzyzx Motors'), 'the dealer of the car bought is named');
  assertAbsent(done.html, [CARS[1].dealer, CARS[1].url, CARS[2].dealer, CARS[2].url, ...CARS.map(car => car.vin), ...NEVER], 'the bought page');
  const walked = await dealAt(pg, 'quoted');
  await event(pg, walked, 'closed', { note: 'Buyer walked away: NOTE-SENTINEL', daysAgo: 1 });
  const closed = await everything(pg, walked);
  for (const text of [closed.html, closed.view]) assertAbsent(text, [...CARS.flatMap(dealerSecrets), ...NEVER], 'the closed page');
});

test('the page is private: no caching, no indexing, no referrer, no script or request to anyone else', async t => {
  const pg = await database(t);
  const { page, html } = await everything(pg, await dealAt(pg, 'agreed'));
  assert.match(page.headers['cache-control'], /no-store/);
  assert.match(page.headers['x-robots-tag'], /noindex/);
  assert.equal(page.headers['referrer-policy'], 'no-referrer');
  assert.match(page.headers['content-security-policy'], /default-src 'none'/);
  assert.match(html, /<meta name="robots" content="noindex/);
  assertAbsent(html, ['googletagmanager', 'gtag(', 'google-analytics', 'web-analytics', 'openai-ads', 'script.js'], 'the page');
  // Every URL the browser would fetch on load is this site's own, photos
  // included. Listings are links the buyer chooses to follow.
  for (const [, tag, url] of html.matchAll(/<(link|script|img|source|iframe)\b[^>]*?\b(?:href|src)="([^"]*)"/g)) {
    assert.ok(url.startsWith('/') && !url.startsWith('//'), `${tag} loads ${url}`);
  }
  assert.ok(html.includes('<img class="dt-photo"'), 'the page has photos to check');
  for (const [, url] of html.matchAll(/<a\b[^>]*?\bhref="(https?:[^"]*)"/g)) {
    assert.ok(CARS.some(car => car.url === url) || new URL(url).hostname === 'www.steermeright.com', `links to ${url}`);
  }
  assert.doesNotMatch(html, /\bbriefs?\b/i);
});

test('opening the page changes nothing except the opened times', async t => {
  const pg = await database(t);
  const id = await dealAt(pg, 'quoted');
  const tables = ['deals', 'deal_listings', 'deal_events', 'buyer_updates', 'buyer_picks', 'buyer_documents', 'ops_alert_outbox', 'onboarding_submissions'];
  const snapshot = async () => JSON.stringify(await Promise.all(tables.map(async name => (await pg.query(`SELECT * FROM ${name} ORDER BY 1`)).rows)));
  const before = await snapshot();
  await open(pg, tokenFor(id), { now: NOW });
  await open(pg, tokenFor(id), { now: NOW + 3600000 });
  assert.equal(await snapshot(), before);
  const { rows: [link] } = await pg.query('SELECT version, revoked_at, first_opened_at, last_opened_at FROM deal_tracker_links WHERE onboarding_id = $1', [id]);
  assert.equal(link.version, 1);
  assert.equal(link.revoked_at, null);
  assert.ok(link.first_opened_at && link.last_opened_at >= link.first_opened_at);
});

test('a forged, old-version, revoked or expired link is refused, and tells the visitor nothing about the deal', async t => {
  const pg = await database(t);
  const id = await dealAt(pg, 'quoted');
  const other = await dealAt(pg, 'quoted');
  const good = tokenFor(id);
  const refused = async (token, options) => {
    const res = await open(pg, token, options);
    assert.notEqual(res.statusCode, 200);
    assert.ok(res.statusCode >= 400 && res.statusCode < 500);
    assertAbsent(res.body, ['Riley', '34,500', '37,777', 'RAV4', ...CARS.flatMap(dealerSecrets), ...NEVER], 'a refused page');
    assert.match(res.headers['cache-control'], /no-store/);
    return res;
  };
  assert.equal((await open(pg, good)).statusCode, 200);
  // Forged: another deal's signature, a flipped character, a bare intake ID, junk.
  await refused(good.slice(0, -1) + (good.endsWith('a') ? 'b' : 'a'));
  await refused(tokenFor(other).replace(other.replaceAll('-', ''), id.replaceAll('-', '')));
  await refused(id);
  await refused('not-a-link');
  await refused('');
  await refused(signLink('another-secret-that-is-long-enough-0123456789', id, 1));
  // Reissued: the old link dies, the new one works.
  await pg.query('UPDATE deal_tracker_links SET version = 2 WHERE onboarding_id = $1', [id]);
  await refused(good);
  assert.equal((await open(pg, tokenFor(id, 2))).statusCode, 200);
  // Revoked.
  await pg.query('UPDATE deal_tracker_links SET revoked_at = now() WHERE onboarding_id = $1', [id]);
  const revoked = await refused(tokenFor(id, 2));
  assert.match(revoked.body, /mason@steermeright\.com/, 'a refused page says how to reach Mason');
  assert.equal((await checkLink(tagged(pg), dealTrackerSettings(environment), tokenFor(id, 2), NOW)).status, 'revoked');
  // A deal with no link row (opened before launch) has no page.
  await pg.query('DELETE FROM deal_tracker_links WHERE onboarding_id = $1', [other]);
  await refused(tokenFor(other));
});

test('the link works until 3 days after the latest close, and reopening restores it', async t => {
  const pg = await database(t);
  const id = await dealAt(pg, 'agreed');
  const token = tokenFor(id);
  await event(pg, id, 'closed', { note: 'Bought', daysAgo: 2 });
  assert.equal((await open(pg, token)).statusCode, 200, 'two days after closing');
  assert.equal((await open(pg, token, { now: NOW + 2 * DAY })).statusCode >= 400, true, 'four days after closing');
  assert.equal((await checkLink(tagged(pg), dealTrackerSettings(environment), token, NOW + 2 * DAY)).status, 'expired');
  await pg.query(`INSERT INTO deal_events (onboarding_id, kind, actor, occurred_at) VALUES ($1, 'reopened', 'mason', $2)`, [id, new Date(NOW + 2 * DAY).toISOString()]);
  assert.equal((await open(pg, token, { now: NOW + 3 * DAY })).statusCode, 200, 'reopened');
  await pg.query(`INSERT INTO deal_events (onboarding_id, kind, actor, note, occurred_at) VALUES ($1, 'closed', 'mason', 'Refunded', $2)`, [id, new Date(NOW + 4 * DAY).toISOString()]);
  assert.equal((await open(pg, token, { now: NOW + 6 * DAY })).statusCode, 200, 'two days after the latest close');
  assert.equal((await open(pg, token, { now: NOW + 8 * DAY })).statusCode >= 400, true, 'four days after the latest close');
});

// A stand-in for fetch: records each URL and answers with what the test says.
function photoHost(answer = () => ({ status: 200, type: 'image/jpeg', body: Buffer.from('JPEG-BYTES') })) {
  const asked = [];
  const fetchImpl = async (url, options) => {
    asked.push({ url, redirect: options.redirect });
    const { status, type, body = Buffer.alloc(0), length } = answer(url);
    return {
      status,
      headers: new Headers({ 'content-type': type ?? '', ...(length != null ? { 'content-length': String(length) } : {}) }),
      arrayBuffer: async () => body
    };
  };
  return { asked, fetchImpl };
}
async function photo(pg, token, which, fetchImpl, { now = NOW } = {}) {
  const res = response();
  await dealTrackerHandler({ environment, getDatabase: () => tagged(pg), now: () => now, fetchImpl })(
    request('GET', `/api/deal-tracker?t=${encodeURIComponent(token)}&photo=${which}`), res);
  return res;
}

test('a listing photo comes through the page: only the stored URL is fetched, redirects are not followed, and only small images pass', async t => {
  const pg = await database(t);
  const id = await dealAt(pg, 'shortlisted');
  const token = tokenFor(id);
  const host = photoHost();
  const res = await photo(pg, token, '2.1', host.fetchImpl);
  assert.equal(res.statusCode, 200);
  assert.equal(res.headers['content-type'], 'image/jpeg');
  assert.equal(res.body, 'JPEG-BYTES');
  assert.match(res.headers['cache-control'], /private/);
  assert.equal(res.headers['referrer-policy'], 'no-referrer');
  assert.deepEqual(host.asked, [{ url: photosOf(CARS[1])[1], redirect: 'manual' }]);
  assertAbsent(JSON.stringify(res.headers), ['sentinel-cdn', ...CARS.flatMap(dealerSecrets)], 'the photo response');
  // No such car or photo, or a malformed one: nothing is fetched.
  const none = photoHost();
  for (const which of ['9.0', '1.3', '1.20', 'x', '1', '1.-1', '']) assert.equal((await photo(pg, token, which, none.fetchImpl)).statusCode, 404, which);
  assert.deepEqual(none.asked, []);
  // What the host answers decides nothing but whether a photo shows.
  for (const [label, answer] of [
    ['a redirect', () => ({ status: 302, type: 'text/html' })],
    ['a page', () => ({ status: 200, type: 'text/html', body: Buffer.from('<html>') })],
    ['an SVG', () => ({ status: 200, type: 'image/svg+xml', body: Buffer.from('<svg/>') })],
    ['too big by header', () => ({ status: 200, type: 'image/jpeg', length: 5 * 1024 * 1024 })],
    ['too big by body', () => ({ status: 200, type: 'image/jpeg', body: Buffer.alloc(5 * 1024 * 1024) })],
    ['empty', () => ({ status: 200, type: 'image/jpeg' })],
    ['a failure', () => { throw new Error('network'); }]
  ]) {
    const refused = await photo(pg, token, '1.0', photoHost(answer).fetchImpl);
    assert.equal(refused.statusCode, 404, label);
    assert.equal(refused.body, '', label);
  }
});

test('a refused link or a closed search fetches no photo, and a bad stored URL is never fetched', async t => {
  const pg = await database(t);
  const id = await dealAt(pg, 'shortlisted');
  const host = photoHost();
  assert.ok((await photo(pg, signLink('another-secret-that-is-long-enough-0123456789', id, 1), '1.0', host.fetchImpl)).statusCode >= 400);
  await pg.query('UPDATE deal_tracker_links SET revoked_at = now() WHERE onboarding_id = $1', [id]);
  assert.equal((await photo(pg, tokenFor(id), '1.0', host.fetchImpl)).statusCode, 410);
  const walked = await dealAt(pg, 'quoted');
  await event(pg, walked, 'closed', { note: 'Buyer walked away', daysAgo: 1 });
  assert.equal((await photo(pg, tokenFor(walked), '1.0', host.fetchImpl)).statusCode, 404, 'a search closed without a purchase shows no cars');
  // Rows written before the checks, or by hand: an http, address or local URL is skipped, not fetched.
  const odd = await dealAt(pg, 'shortlisted');
  await pg.query(`UPDATE deal_listings SET photo_urls = $1 WHERE deal_id = (SELECT id FROM deals WHERE onboarding_id = $2) AND rank = 1`,
    [JSON.stringify(['http://photos.example/a.jpg', 'https://10.0.0.1/a.jpg', 'https://localhost/a.jpg', 'https://intranet/a.jpg', 'https://ok.example/a.jpg']), odd]);
  const html = (await open(pg, tokenFor(odd))).body;
  assert.ok(html.includes(`/photo/1/0"`) && !html.includes(`/photo/1/1"`), 'only the one good photo is offered');
  await photo(pg, tokenFor(odd), '1.0', host.fetchImpl);
  assert.deepEqual(host.asked.map(item => item.url), ['https://ok.example/a.jpg']);
});

test('switched off, the page does not exist and the database is never touched', async () => {
  const getDatabase = () => { throw new Error('the database must not be opened'); };
  for (const env of [{}, { DEAL_TRACKER_ENABLED: '0', DEAL_TRACKER_SECRET: SECRET }, { DEAL_TRACKER_SECRET: SECRET }]) {
    const res = response();
    await dealTrackerHandler({ environment: env, getDatabase, now: () => NOW })(request('GET', `/api/deal-tracker?t=${tokenFor(crypto.randomUUID())}`), res);
    assert.equal(res.statusCode, 404);
  }
  assert.equal(dealTrackerSettings({}), null);
  assert.throws(() => dealTrackerSettings({ DEAL_TRACKER_ENABLED: '1', DEAL_TRACKER_SECRET: 'short' }));
  assert.throws(() => dealTrackerSettings({ DEAL_TRACKER_ENABLED: '1' }));
});
