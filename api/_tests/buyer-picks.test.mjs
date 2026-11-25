import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { PGlite } from '@electric-sql/pglite';
import { clearDroppedPicks, clearPick, keepLooking, makePick, openPickRound } from '../_lib/buyer-picks.js';
import { loadBuyerView, signLink } from '../_lib/deal-tracker.js';
import { dispatchOpsAlerts } from '../_lib/ops-alerts.js';
import { dealTrackerHandler } from '../deal-tracker.js';

// Buyer Picks and "keep looking" on the Deal Tracker (GLOSSARY.md, docs/adr/0002,
// docs/deal-tracker-build-plan-2026-11-21.md, "Decisions": Buyer Pick, Hidden;
// "Tests": refused before a "ready for your call" update; one per opening;
// flagged when the price moves; cleared when the dealer is dropped).

const SECRET = 'deal-tracker-secret-for-tests-only-0123456789';
const ORIGIN = 'https://www.steermeright.com';
const environment = { DEAL_TRACKER_ENABLED: '1', DEAL_TRACKER_SECRET: SECRET, APP_ORIGIN: ORIGIN };
const NOW = Date.parse('2026-12-10T18:00:00Z');
const DAY = 86400000;
// Negative days are after NOW, when the buyer picks.
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

async function database(t) {
  const pg = await PGlite.create();
  t.after(() => pg.close());
  for (const migration of migrations) await pg.exec(migration);
  return pg;
}

// Car 3 never gets a written price.
const CARS = [
  { rank: 1, title: '2024 Toyota RAV4 XLE', vin: '1HGCM82633A004352', dealer: 'Zzyzx Motors', url: 'https://listings.example/sentinel-listing-1', otd: 3640000 },
  { rank: 2, title: '2023 Honda CR-V EX-L', vin: '2T3W1RFV8MW123456', dealer: 'Quorra Auto Haus', url: 'https://listings.example/sentinel-listing-2', otd: 3690000 },
  { rank: 3, title: '2024 Mazda CX-5 Select', vin: '5YJ3E1EA7KF317000', dealer: 'Vandelay Imports', url: 'https://listings.example/sentinel-listing-3', otd: null }
];
// From Quotes in the page names each car's listed dealer and links its listing
// (adr/0003); a VIN, another dealer's name from the log, contact details and our
// notes never show.
const SECRETS = [...CARS.map(car => car.vin), 'Ozymandias Autoplex', 'sales@dealer.example', 'WHY-SENTINEL'];

const event = (pg, id, kind, { dealer = null, vin = null, otd = null, daysAgo = 5 } = {}) =>
  pg.query(`INSERT INTO deal_events (onboarding_id, kind, actor, dealer_name, vin, otd_cents, note, occurred_at)
    VALUES ($1, $2, 'deal-desk', $3, $4, $5, 'NOTE-SENTINEL', $6)`, [id, kind, dealer, vin, otd, at(daysAgo)]);

// A paid intake with its deal, link and shortlist, built up to stage: shortlisted, emailing or quoted.
async function intake(pg, { stage = 'quoted' } = {}) {
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
  await pg.query(`INSERT INTO deals (id, onboarding_id, shortlisted_at) VALUES ($1, $2, $3)`, [dealId, id, at(9)]);
  await pg.query('INSERT INTO deal_tracker_links (onboarding_id) VALUES ($1)', [id]);
  for (const car of CARS) {
    await pg.query(`INSERT INTO deal_listings (id, deal_id, rank, title, price_cents, target_price_cents, walk_away_cents, vin, listing_url,
        dealer_name, dealer_email, why, est_otd_cents)
      VALUES ($1, $2, $3, $4, 3450000, 3111100, 3222200, $5, $6, $7, 'sales@dealer.example', 'WHY-SENTINEL', 3777700)`,
    [crypto.randomUUID(), dealId, car.rank, car.title, car.vin, car.url, car.dealer]);
  }
  if (stage === 'shortlisted') return id;
  for (const car of CARS) await event(pg, id, 'first_email_sent', { dealer: car.dealer, daysAgo: 8 });
  if (stage === 'emailing') return id;
  for (const car of CARS.filter(item => item.otd)) await event(pg, id, 'quote', { dealer: car.dealer, vin: car.vin, otd: car.otd, daysAgo: 6 });
  return id;
}

// A Buyer Update as the ops dashboard or an agent leaves it.
const readyUpdate = async (pg, id, { status = 'posted', ready = true } = {}) => {
  const { rows: [row] } = await pg.query(`INSERT INTO buyer_updates (onboarding_id, body, status, ready_for_pick, actor, on_masons_say)
    VALUES ($1, 'Ready for your call', $2, $3, 'mason', true) RETURNING id`, [id, status === 'retracted' ? 'posted' : status, ready]);
  if (status === 'retracted') await pg.query(`UPDATE buyer_updates SET status = 'retracted', retracted_at = now() WHERE id = $1`, [row.id]);
  return Number(row.id);
};

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
async function open(pg, id, { token = tokenFor(id), now = NOW } = {}) {
  const res = response();
  await dealTrackerHandler({ environment, getDatabase: () => tagged(pg), now: () => now })(request('GET', `/api/deal-tracker?t=${encodeURIComponent(token)}`), res);
  return res;
}
// A POST from the page, as a browser sends it.
async function send(pg, id, fields, { token = tokenFor(id), headers = { origin: ORIGIN }, env = environment, now = NOW } = {}) {
  const res = response();
  await dealTrackerHandler({ environment: env, getDatabase: () => tagged(pg), now: () => now })(request('POST', `/api/deal-tracker?t=${encodeURIComponent(token)}`,
    { headers: { 'content-type': 'application/x-www-form-urlencoded', ...headers }, body: new URLSearchParams(fields).toString() }), res);
  return res;
}
const pickCar = (pg, id, rank, price, options) => send(pg, id, { action: 'pick', car: String(rank), price: String(price) }, options);
const picks = async (pg, id) => (await pg.query('SELECT * FROM buyer_picks WHERE onboarding_id = $1 ORDER BY id', [id])).rows;
const snapshot = async pg => JSON.stringify((await pg.query('SELECT * FROM buyer_picks ORDER BY id')).rows);

function assertAbsent(haystack, needles, where) {
  const lower = haystack.toLowerCase();
  for (const needle of needles) assert.ok(!lower.includes(String(needle).toLowerCase()), `${where} must not contain ${needle}`);
}

test('before a "ready for your call" update there is no pick: no buttons, and every pick POST writes nothing', async t => {
  const pg = await database(t);
  const id = await intake(pg);
  const refusedAll = async label => {
    const html = (await open(pg, id)).body;
    assert.ok(!html.includes('Pick this car') && !html.includes('keep looking') && !html.includes('id="dt-pick"'), label);
    for (const fields of [{ action: 'pick_review', car: '1', price: '3640000' }, { action: 'pick', car: '1', price: '3640000' },
      { action: 'keep_looking_review' }, { action: 'keep_looking' }]) {
      const res = await send(pg, id, fields);
      assert.equal(res.statusCode, 409, `${label}: ${fields.action}`);
      assert.ok(res.body.includes('Picking isn’t open right now') && res.body.includes(`href="/deal/${tokenFor(id)}"`));
    }
    assert.equal((await picks(pg, id)).length, 0, label);
  };
  await refusedAll('no update at all');
  await readyUpdate(pg, id, { ready: false });
  await refusedAll('an ordinary posted update');
  await readyUpdate(pg, id, { status: 'draft' });
  await refusedAll('a draft ready-for-your-call update');
  await readyUpdate(pg, id, { status: 'retracted' });
  await refusedAll('a retracted ready-for-your-call update');

  const opening = await readyUpdate(pg, id);
  assert.deepEqual(await openPickRound(tagged(pg), id), { update_id: opening, pick: null });
  const html = (await open(pg, id)).body;
  assert.ok(html.includes('Pick this car at $36,400') && html.includes('Pick this car at $36,900'));
  assert.equal(html.split('Pick this car').length - 1, 2, 'only the cars with a best price so far');
  assert.ok(html.includes('None of these, keep looking') && html.includes('These prices are ready for your call.'));
  assert.ok(html.includes('<input type="hidden" name="action" value="pick_review"><input type="hidden" name="car" value="1"><input type="hidden" name="price" value="3640000">'));
  const view = await loadBuyerView(tagged(pg), id, NOW);
  assert.deepEqual(view.cars.map(car => car.can_pick), [true, true, false]);
  assert.deepEqual(view.pick, { open: true, standing: null });

  // Taking the update back closes the round again.
  await pg.query(`UPDATE buyer_updates SET status = 'retracted', retracted_at = now() WHERE id = $1`, [opening]);
  await refusedAll('the opening update taken back');
});

test('outside Quotes in there are no buttons and a pick is refused, even with a round open', async t => {
  const pg = await database(t);
  for (const stage of ['shortlisted', 'emailing']) {
    const id = await intake(pg, { stage });
    await readyUpdate(pg, id);
    assert.ok(!(await open(pg, id)).body.includes('Pick this car'), stage);
    assert.equal((await send(pg, id, { action: 'pick_review', car: '1', price: '3640000' })).statusCode, 409, stage);
    assert.equal((await pickCar(pg, id, 1, 3640000)).statusCode, 409, stage);
    assert.equal((await send(pg, id, { action: 'keep_looking' })).statusCode, 409, stage);
  }
  const agreed = await intake(pg);
  await readyUpdate(pg, agreed);
  await event(pg, agreed, 'agreed', { dealer: CARS[0].dealer, vin: CARS[0].vin, otd: 3610000, daysAgo: 1 });
  assert.ok(!(await open(pg, agreed)).body.includes('Pick this car'));
  assert.equal((await pickCar(pg, agreed, 2, 3690000)).statusCode, 409);
  assert.equal((await send(pg, agreed, { action: 'keep_looking' })).statusCode, 409);

  const closed = await intake(pg);
  await readyUpdate(pg, closed);
  await event(pg, closed, 'closed', { daysAgo: 1 });
  const refused = await pickCar(pg, closed, 1, 3640000);
  assert.equal(refused.statusCode, 409);
  assert.ok(refused.body.includes('This search is closed'));
  assert.equal((await pg.query('SELECT count(*)::int AS n FROM buyer_picks')).rows[0].n, 0);
});

test('the confirm step writes nothing; the pick writes one row with the VIN, dealer and price from the log', async t => {
  const pg = await database(t);
  const id = await intake(pg);
  await readyUpdate(pg, id);
  const token = tokenFor(id);

  const review = await send(pg, id, { action: 'pick_review', car: '1', price: '3640000' });
  assert.equal(review.statusCode, 200);
  assert.ok(review.body.includes('You’re picking the 2024 Toyota RAV4 XLE at $36,400 out the door.'));
  assert.ok(review.body.includes('<input type="hidden" name="action" value="pick"><input type="hidden" name="car" value="1"><input type="hidden" name="price" value="3640000">'));
  assert.ok(review.body.includes('Yes, that’s my pick') && review.body.includes(`href="/deal/${token}#dt-cars">Go back</a>`));
  assert.ok(review.body.includes(`action="/deal/${token}"`));
  const keep = await send(pg, id, { action: 'keep_looking_review' });
  assert.equal(keep.statusCode, 200);
  assert.ok(keep.body.includes('You’re asking us to keep looking.') && keep.body.includes('value="keep_looking"'));
  assert.equal((await picks(pg, id)).length, 0, 'the confirm step saves nothing');

  // A forged price, a car with no price, an unknown or junk rank: each refused, nothing written.
  const forged = await pickCar(pg, id, 1, 3000000);
  assert.equal(forged.statusCode, 409);
  assert.ok(forged.body.includes('The price on that car just changed') && forged.body.includes('2024 Toyota RAV4 XLE is now $36,400'));
  assert.ok(forged.body.includes(`href="/deal/${token}"`), 'with a link back');
  assert.equal((await send(pg, id, { action: 'pick_review', car: '1', price: '3000000' })).statusCode, 409, 'the confirm step checks it too');
  const unpriced = await pickCar(pg, id, 3, 3777700);
  assert.equal(unpriced.statusCode, 409);
  assert.ok(unpriced.body.includes('That car has no written price yet'));
  for (const rank of ['9', 'abc', '']) {
    const res = await send(pg, id, { action: 'pick', car: rank, price: '3640000' });
    assert.equal(res.statusCode, 400, rank);
    assert.ok(res.body.includes('That car isn’t on your list'));
  }
  assert.equal((await picks(pg, id)).length, 0);

  const done = await pickCar(pg, id, 1, 3640000);
  assert.equal(done.statusCode, 303);
  assert.equal(done.headers.location, `/deal/${token}#dt-pick`);
  const [row] = await picks(pg, id);
  assert.deepEqual([row.kind, row.vin, row.dealer_name, row.otd_cents, row.cleared_at], ['pick', CARS[0].vin, CARS[0].dealer, 3640000, null]);
  assert.equal(new Date(row.created_at).getTime(), NOW);

  const html = (await open(pg, id)).body;
  const section = html.split('id="dt-pick"')[1].split('</section>')[0];
  assert.ok(section.includes('You picked the 2024 Toyota RAV4 XLE at $36,400 out the door. The price isn’t agreed until I confirm it with the dealer.'));
  assert.ok(section.includes('If you chose by mistake, let me know'));
  assert.ok(!html.includes('Pick this car') && !html.includes('None of these, keep looking'), 'the buttons are gone');
  const view = await loadBuyerView(tagged(pg), id, NOW);
  assert.deepEqual(view.pick, { open: true, standing: { kind: 'pick', rank: 1, otd_cents: 3640000, at: new Date(NOW).toISOString(), flag: null, current_cents: 3640000 } });
});

test('one pick per opening update; a newer ready-for-your-call update opens a new round; after Mason clears, the buyer picks again', async t => {
  const pg = await database(t);
  const id = await intake(pg);
  const sql = tagged(pg);
  const first = await readyUpdate(pg, id);
  assert.equal((await pickCar(pg, id, 1, 3640000)).statusCode, 303);
  for (const fields of [{ action: 'pick', car: '2', price: '3690000' }, { action: 'keep_looking' }, { action: 'pick_review', car: '2', price: '3690000' }, { action: 'keep_looking_review' }]) {
    const res = await send(pg, id, fields);
    assert.equal(res.statusCode, 409, fields.action);
    assert.ok(res.body.includes('You’ve already made your pick'));
  }
  assert.deepEqual(await makePick(sql, { onboardingId: id, rank: 2, expectedCents: 3690000, now: NOW }), { error: 'already_picked' });
  assert.deepEqual(await keepLooking(sql, { onboardingId: id, now: NOW }), { error: 'already_picked' });
  assert.equal((await picks(pg, id)).length, 1);

  const second = await readyUpdate(pg, id);
  assert.ok((await open(pg, id)).body.includes('Pick this car'), 'a new round is open');
  assert.equal((await send(pg, id, { action: 'keep_looking' })).statusCode, 303);
  let rows = await picks(pg, id);
  assert.deepEqual(rows.map(row => [Number(row.opened_by_update_id), row.kind, row.cleared_at]), [[first, 'pick', null], [second, 'keep_looking', null]]);

  // Mason clears it: once, only on this deal.
  const other = await intake(pg);
  assert.equal(await clearPick(sql, rows[1].id, other), false, 'not another deal\'s pick');
  assert.equal(await clearPick(sql, rows[1].id, id), true);
  assert.equal(await clearPick(sql, rows[1].id, id), false, 'a repeat changes nothing');
  assert.equal((await picks(pg, id))[1].cleared_by, 'mason');
  assert.equal((await pickCar(pg, id, 2, 3690000)).statusCode, 303, 'the same round takes a new pick');
  rows = await picks(pg, id);
  assert.deepEqual(rows.map(row => [row.kind, row.cleared_by]), [['pick', null], ['keep_looking', 'mason'], ['pick', null]]);
  assert.equal(rows[2].dealer_name, CARS[1].dealer);
});

test('if the price moves after the pick, the pick stays as picked and is flagged with the current price', async t => {
  const pg = await database(t);
  const id = await intake(pg);
  await readyUpdate(pg, id);
  await pickCar(pg, id, 1, 3640000);
  const before = await snapshot(pg);

  // The picked dealer raises their price.
  await event(pg, id, 'quote', { dealer: CARS[0].dealer, vin: CARS[0].vin, otd: 3700000, daysAgo: -0.1 });
  assert.equal(await snapshot(pg), before, 'the row is unchanged');
  let html = (await open(pg, id)).body;
  let section = html.split('id="dt-pick"')[1].split('</section>')[0];
  assert.ok(section.includes('at $36,400 out the door') && section.includes('The price on this car has changed since you picked it. Its best price so far is now $37,000. I’ll be in touch about it.'));
  assert.ok(!html.includes('Pick this car'), 'a flagged pick still stands');
  assert.deepEqual((await loadBuyerView(tagged(pg), id, NOW)).pick.standing.flag, 'price_moved');

  // Another dealer undercuts on the same car: still moved, now to the lower price.
  await event(pg, id, 'quote', { dealer: 'Ozymandias Autoplex', vin: CARS[0].vin, otd: 3590000, daysAgo: -0.2 });
  html = (await open(pg, id)).body;
  section = html.split('id="dt-pick"')[1].split('</section>')[0];
  assert.ok(section.includes('Its best price so far is now $35,900'));
  assert.equal(await snapshot(pg), before);
  const view = JSON.stringify(await loadBuyerView(tagged(pg), id, NOW));
  assertAbsent(`${html}${view}`, SECRETS, 'the flagged page');
});

test('when the picked dealer is dropped, the round opens again at once, and the job clears the pick without an alert', async t => {
  const pg = await database(t);
  const sql = tagged(pg);
  const id = await intake(pg);
  await readyUpdate(pg, id);
  await pickCar(pg, id, 1, 3640000);
  await event(pg, id, 'dropped', { dealer: CARS[0].dealer, daysAgo: -0.1 });
  const before = await snapshot(pg);

  const html = (await open(pg, id)).body;
  assert.ok(html.includes('Pick this car at $36,900') && !html.includes('Pick this car at $36,400'), 'the dropped dealer\'s car has no price');
  assert.ok(!html.includes('You picked'));
  assert.equal(await snapshot(pg), before, 'a GET wrote nothing');
  assert.deepEqual((await loadBuyerView(sql, id, NOW)).pick, { open: true, standing: null });

  // The alerts job, switched on: clears it, and no "picked a car" email goes out.
  const sent = [];
  await dispatchOpsAlerts({ sql, now: Date.parse('2026-11-20T09:00:00Z'), tracker: true,
    environment: { ...environment, OPS_ALERT_EMAIL: 'alerts@example.test', INTAKE_SMTP_USER: 'sender@example.test', INTAKE_SMTP_PASSWORD: 'not-real' },
    createTransport: () => ({ async sendMail(mail) { sent.push(mail); }, close() {} }) });
  const [row] = await picks(pg, id);
  assert.equal(row.cleared_by, 'dealer_dropped');
  assert.ok(row.cleared_at);
  assert.ok(!sent.some(mail => /picked a car/.test(mail.subject)));
  assert.equal((await pg.query(`SELECT count(*)::int AS n FROM ops_alert_outbox WHERE kind = 'buyer_pick'`)).rows[0].n, 0);
  assert.equal(await clearDroppedPicks(sql), 0, 'a rerun clears nothing twice');

  // Before the job runs, a new pick clears the dropped one in its own transaction.
  const other = await intake(pg);
  await readyUpdate(pg, other);
  await pickCar(pg, other, 1, 3640000);
  await event(pg, other, 'dropped', { dealer: CARS[0].dealer, daysAgo: -0.1 });
  assert.equal((await pickCar(pg, other, 2, 3690000, { now: NOW + DAY })).statusCode, 303);
  assert.deepEqual((await picks(pg, other)).map(item => [item.dealer_name, item.cleared_by]), [[CARS[0].dealer, 'dealer_dropped'], [CARS[1].dealer, null]]);
});

test('clearDroppedPicks clears only picks whose dealer was dropped after the pick, even if they came back', async t => {
  const pg = await database(t);
  const sql = tagged(pg);
  const back = await intake(pg);
  const moved = await intake(pg);
  const kept = await intake(pg);
  for (const id of [back, moved, kept]) {
    await readyUpdate(pg, id);
    await pickCar(pg, id, 1, 3640000);
  }
  await event(pg, back, 'dropped', { dealer: CARS[0].dealer, daysAgo: -0.1 });
  await event(pg, back, 'quote', { dealer: CARS[0].dealer, vin: CARS[0].vin, otd: 3640000, daysAgo: -0.2 });
  await event(pg, moved, 'quote', { dealer: CARS[0].dealer, vin: CARS[0].vin, otd: 3700000, daysAgo: -0.1 });
  await send(pg, kept, { action: 'keep_looking' });
  assert.equal(await clearDroppedPicks(sql), 1);
  assert.equal((await picks(pg, back))[0].cleared_by, 'dealer_dropped');
  assert.equal((await picks(pg, moved))[0].cleared_at, null, 'a moved price is flagged, not cleared');
  assert.equal((await picks(pg, kept))[0].cleared_at, null);
});

test('"keep looking" writes one row with no car, dealer or price, and the page says so', async t => {
  const pg = await database(t);
  const id = await intake(pg);
  await readyUpdate(pg, id);
  const res = await send(pg, id, { action: 'keep_looking' });
  assert.equal(res.statusCode, 303);
  assert.equal(res.headers.location, `/deal/${tokenFor(id)}#dt-pick`);
  const rows = await picks(pg, id);
  assert.equal(rows.length, 1);
  assert.deepEqual([rows[0].kind, rows[0].vin, rows[0].dealer_name, rows[0].otd_cents], ['keep_looking', null, null, null]);
  const html = (await open(pg, id)).body;
  assert.ok(html.includes('You asked me to keep looking.') && !html.includes('Pick this car'));
  assert.deepEqual((await loadBuyerView(tagged(pg), id, NOW)).pick.standing,
    { kind: 'keep_looking', rank: null, otd_cents: null, at: new Date(NOW).toISOString(), flag: null, current_cents: null });
});

test('privacy: with a pick standing, nothing the link returns gives a VIN, another dealer from the log, contact details or our notes', async t => {
  const pg = await database(t);
  const id = await intake(pg);
  await readyUpdate(pg, id);
  const outputs = [];
  const keep = (label, res) => outputs.push([label, res.body]);
  keep('confirm page', await send(pg, id, { action: 'pick_review', car: '1', price: '3640000' }));
  keep('keep-looking confirm page', await send(pg, id, { action: 'keep_looking_review' }));
  keep('price changed', await pickCar(pg, id, 1, 1));
  keep('no price', await pickCar(pg, id, 3, 1));
  keep('no car', await pickCar(pg, id, 9, 1));
  await pickCar(pg, id, 1, 3640000);
  keep('already picked', await pickCar(pg, id, 2, 3690000));
  await event(pg, id, 'quote', { dealer: 'Ozymandias Autoplex', vin: CARS[0].vin, otd: 3500000, daysAgo: -0.1 });
  keep('the page with a flagged pick', await open(pg, id));
  const notOpen = await intake(pg);
  keep('not open', await pickCar(pg, notOpen, 1, 3640000));
  outputs.push(['the view', JSON.stringify(await loadBuyerView(tagged(pg), id, NOW))]);
  assert.ok(outputs.at(-1)[1].includes('"price_moved"'));
  for (const [label, text] of outputs) {
    assertAbsent(text, SECRETS, label);
    assert.doesNotMatch(text, /\bbriefs?\b/i, label);
  }
});

test('another site, a forged, revoked or expired link, or the switch off: a pick POST writes nothing', async t => {
  const pg = await database(t);
  const id = await intake(pg);
  await readyUpdate(pg, id);
  const fields = { action: 'pick', car: '1', price: '3640000' };
  for (const headers of [{ origin: 'https://evil.example.test' }, { origin: 'null', 'sec-fetch-site': 'cross-site' }]) {
    assert.equal((await send(pg, id, fields, { headers })).statusCode, 403);
    assert.equal((await send(pg, id, { action: 'keep_looking' }, { headers })).statusCode, 403);
  }
  const good = tokenFor(id);
  for (const token of [good.slice(0, -1) + (good.endsWith('a') ? 'b' : 'a'), signLink('another-secret-that-is-long-enough-0123456789', id, 1), 'junk']) {
    assert.equal((await send(pg, id, fields, { token })).statusCode, 404);
  }
  const expired = await intake(pg);
  await readyUpdate(pg, expired);
  await event(pg, expired, 'closed', { daysAgo: 4 });
  assert.equal((await pickCar(pg, expired, 1, 3640000)).statusCode, 410);
  await pg.query('UPDATE deal_tracker_links SET revoked_at = now() WHERE onboarding_id = $1', [id]);
  assert.equal((await send(pg, id, fields)).statusCode, 410);
  for (const env of [{}, { DEAL_TRACKER_ENABLED: '0', DEAL_TRACKER_SECRET: SECRET }]) {
    const res = response();
    await dealTrackerHandler({ environment: env, getDatabase: () => { throw new Error('the database must not be opened'); } })(
      request('POST', `/api/deal-tracker?t=${good}`, { headers: { origin: ORIGIN }, body: 'action=pick&car=1&price=3640000' }), res);
    assert.equal(res.statusCode, 404);
  }
  assert.equal((await pg.query('SELECT count(*)::int AS n FROM buyer_picks')).rows[0].n, 0);
});
