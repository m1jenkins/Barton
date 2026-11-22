import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { allowedOrigins } from '../_lib/config.js';
import { dealTrackerEnabled } from '../_lib/deal-tracker.js';
import { onboardingHandler } from '../onboarding.js';

const migrations = await Promise.all(['001_durable_leads_and_payments.sql', '002_standard_purchase_analytics.sql',
  '003_checkout_offer_snapshot.sql', '004_intake_email_outbox.sql', '005_deal_search.sql', '006_dealer_handoff.sql',
  '007_deal_events.sql', '008_deal_events_per_car.sql', '012_deal_events_agents.sql', '013_deal_tracker.sql']
  .map(name => readFile(new URL(`../../db/${name}`, import.meta.url), 'utf8')));

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

function response() {
  return {
    statusCode: 200, headers: {}, body: '',
    setHeader(name, value) { this.headers[name.toLowerCase()] = value; },
    end(body = '') { this.body = String(body); }
  };
}

test('the Deal Tracker switch is on only for 1, true or yes', () => {
  for (const value of ['1', 'true', 'yes', ' TRUE ', 'Yes']) assert.equal(dealTrackerEnabled({ DEAL_TRACKER_ENABLED: value }), true, value);
  for (const value of [undefined, '', '0', 'false', 'no', 'on', 'enabled']) assert.equal(dealTrackerEnabled({ DEAL_TRACKER_ENABLED: value }), false, String(value));
  assert.equal(dealTrackerEnabled({}), false);
});

test('a paid intake opens its deal and Deal Tracker link only with the switch on, and only for the two plans with a car search', async t => {
  t.mock.method(console, 'error', () => {});
  const pg = await PGlite.create();
  t.after(() => pg.close());
  for (const migration of migrations) await pg.exec(migration);
  const sql = tagged(pg);
  const origin = [...allowedOrigins()][0];

  const paid = async tier => {
    const attempt = crypto.randomUUID(), purchase = crypto.randomUUID(), session = `cs_test_${attempt.replaceAll('-', '')}`;
    await pg.query(`INSERT INTO checkout_attempts (id, client_reference_id, idempotency_key, request_hash, tier_id, expected_amount, status)
      VALUES ($1, $1, $4, $2, $3, 39500, 'paid')`, [attempt, 'a'.repeat(64), tier, `key-${attempt}`]);
    await pg.query(`INSERT INTO stripe_events (event_id, event_type, checkout_session_id, livemode, stripe_created_at)
      VALUES ($1, 'checkout.session.completed', $1, false, now())`, [session]);
    await pg.query(`INSERT INTO purchases (id, checkout_session_id, checkout_attempt_id, client_reference_id, stripe_event_id,
      stripe_payment_intent_id, tier_id, amount_total, currency, payment_status, livemode, paid_at)
      VALUES ($1, $2, $3, $3, $2, 'pi_1', $4, 39500, 'usd', 'paid', false, now())`, [purchase, session, attempt, tier]);
    return session;
  };
  const submit = async (environment, tier, session, key = crypto.randomUUID()) => {
    const res = response();
    await onboardingHandler({ environment, getDatabase: () => sql })({
      method: 'POST', url: '/api/onboarding',
      headers: { origin, 'content-type': 'application/json', 'idempotency-key': key },
      body: { session_id: session, tier, fields: { name: 'Pat Buyer', email: 'pat@example.test', phone: '205-555-0100', city: 'Austin, TX', preferred_makes: 'Toyota RAV4' } }
    }, res);
    return { status: res.statusCode, id: JSON.parse(res.body).onboarding_id, key };
  };
  const counts = async id => (await pg.query(`SELECT
      (SELECT count(*)::int FROM deals WHERE onboarding_id = $1) AS deals,
      (SELECT count(*)::int FROM deal_tracker_links WHERE onboarding_id = $1) AS links`, [id])).rows[0];

  const off = await submit({}, 'full_service', await paid('full_service'));
  assert.equal(off.status, 201);
  assert.deepEqual(await counts(off.id), { deals: 0, links: 0 }, 'switched off, an intake opens no deal');
  assert.ok(!sql.seen.some(query => /\bdeals\b|deal_tracker_links/.test(query)), 'switched off, no new query runs');

  const on = { DEAL_TRACKER_ENABLED: 'true' };
  for (const tier of ['full_service', 'concierge']) {
    const session = await paid(tier);
    const first = await submit(on, tier, session);
    assert.equal(first.status, 201);
    assert.deepEqual(await counts(first.id), { deals: 1, links: 1 }, tier);
    const [link] = (await pg.query('SELECT version, revoked_at FROM deal_tracker_links WHERE onboarding_id = $1', [first.id])).rows;
    assert.deepEqual(link, { version: 1, revoked_at: null });
    const [deal] = (await pg.query('SELECT shortlisted_at FROM deals WHERE onboarding_id = $1', [first.id])).rows;
    assert.equal(deal.shortlisted_at, null, 'the deal opens in Confirming search');

    const replay = await submit(on, tier, session, first.key);
    assert.deepEqual([replay.status, replay.id], [200, first.id]);
    const again = await submit(on, tier, session);
    assert.deepEqual([again.status, again.id], [200, first.id], 'the same intake under a new key is the same intake');
    assert.deepEqual(await counts(first.id), { deals: 1, links: 1 }, 'a replay adds nothing');
  }

  const consultation = await submit(on, 'consultation', await paid('consultation'));
  assert.equal(consultation.status, 201);
  assert.deepEqual(await counts(consultation.id), { deals: 0, links: 0 }, 'a consultation has no car search, so no deal');
  assert.equal((await pg.query('SELECT count(*)::int AS n FROM deals')).rows[0].n, 2);
});
