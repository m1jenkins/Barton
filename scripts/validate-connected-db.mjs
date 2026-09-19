// Opt-in integration check. Requires a NEW, disposable loopback PostgreSQL database.
// No .env file is loaded and no Stripe/destination API request is made.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import Stripe from 'stripe';
import { database } from '../api/_lib/db.js';
import leads from '../api/leads.js';
import checkout from '../api/checkout-start.js';
import webhook from '../api/stripe-webhook.js';
import onboarding from '../api/onboarding.js';
import { verifiedPurchase } from '../api/purchase-status.js';
import { dispatchAnalyticsOutbox } from '../api/_lib/analytics-outbox.js';

const target = new URL(process.env.SEO09_DATABASE_URL || 'postgres://invalid/');
assert.ok(['postgres:', 'postgresql:'].includes(target.protocol));
assert.equal(target.hostname, '127.0.0.1', 'Only an explicit loopback database is accepted');
assert.match(target.pathname, /^\/seo09_[a-z0-9_]+$/, 'Use a dedicated seo09_ database');
assert.equal(target.search, '', 'Connection overrides are not permitted');
for (const key of Object.keys(process.env)) {
  if (/^(STRIPE_|DATABASE_|ANALYTICS_|LEAD_FORWARD_|TURNSTILE_|OPENAI_ADS_)/.test(key)) delete process.env[key];
}
Object.assign(process.env, {
  DATABASE_URL: target.href, DATABASE_MAX_CONNECTIONS: '5',
  APP_ORIGIN: 'http://localhost:3000', ALLOWED_ORIGINS: '', CHECKOUT_PAUSED: 'false',
  STRIPE_SECRET_KEY: 'sk_test_synthetic_not_an_api_credential',
  STRIPE_WEBHOOK_SECRET: 'whsec_synthetic_local_signature_only',
  STRIPE_PAYMENT_LINK_FULL_SERVICE_URL: 'https://buy.stripe.com/test_synthetic_full',
  STRIPE_PAYMENT_LINK_CONCIERGE_URL: 'https://buy.stripe.com/test_synthetic_concierge'
});
const originalFetch = globalThis.fetch;
globalThis.fetch = async () => { throw new Error('External fetch forbidden in database validation'); };
const sql = database();
const checks = [];
async function check(name, run) { await run(); checks.push(name); console.log(`PASS ${name}`); }
async function call(handler, body, key = randomUUID(), extra = {}) {
  const res = { setHeader() {}, end(value) { this.body = JSON.parse(value); } };
  await handler({ method: 'POST', headers: { origin: process.env.APP_ORIGIN,
    'content-type': 'application/json', 'idempotency-key': key, ...extra.headers }, body,
    ...(extra.rawBody ? { rawBody: extra.rawBody } : {}) }, res);
  return res;
}
async function count(table) { return Number((await sql`SELECT count(*) AS count FROM ${sql(table)}`)[0].count); }
async function migrate(name) {
  const connection = await sql.reserve();
  try {
    await connection.unsafe(await readFile(new URL(`../db/${name}`, import.meta.url), 'utf8')).simple();
  } finally { connection.release(); }
}
async function seedAttempt(tier, amount) {
  const id = randomUUID(), reference = randomUUID(), key = randomUUID();
  const [row] = await sql`INSERT INTO checkout_attempts
    (id, client_reference_id, idempotency_key, request_hash, tier_id, expected_amount, currency)
    VALUES (${id}, ${reference}, ${key}, ${'0'.repeat(64)}, ${tier}, ${amount}, 'usd') RETURNING *`;
  return row;
}
function paidEvent(attempt, overrides = {}) {
  return { id: `evt_${randomUUID().replaceAll('-', '')}`, type: 'checkout.session.completed',
    created: Math.floor(Date.now() / 1000), livemode: false, data: { object: {
      id: `cs_test_${randomUUID().replaceAll('-', '')}`, object: 'checkout.session', mode: 'payment',
      payment_status: 'paid', client_reference_id: attempt.client_reference_id,
      currency: 'usd', amount_total: attempt.expected_amount, ...overrides
    } } };
}
async function deliver(event, signature = true) {
  const payload = JSON.stringify(event);
  const header = Stripe.webhooks.generateTestHeaderString({ payload, secret: process.env.STRIPE_WEBHOOK_SECRET });
  return call(webhook, undefined, randomUUID(), { rawBody: Buffer.from(payload),
    headers: signature ? { 'stripe-signature': header } : {} });
}

try {
  const tables = await sql`SELECT tablename FROM pg_tables WHERE schemaname = 'public'`;
  assert.equal(tables.length, 0, 'Refusing to modify a nonempty database');
  const [{ version }] = await sql`SELECT version()`;
  console.log(version);
  let legacy;
  await check('numbered migrations preserve historical amounts and leave legacy offer key null', async () => {
    await migrate('001_durable_leads_and_payments.sql');
    legacy = await seedAttempt('full_service', 49500);
    await sql`INSERT INTO analytics_outbox (event_name, dedupe_key, payload)
      VALUES ('service_purchase', 'migration_probe', ${sql.json({ event_id: 'purchase:migration_probe' })})`;
    await migrate('002_standard_purchase_analytics.sql');
    assert.equal((await sql`SELECT event_name FROM analytics_outbox WHERE dedupe_key = 'migration_probe'`)[0].event_name, 'purchase');
    await sql`DELETE FROM analytics_outbox WHERE dedupe_key = 'migration_probe'`;
    await migrate('003_checkout_offer_snapshot.sql');
    const [saved] = await sql`SELECT * FROM checkout_attempts WHERE id = ${legacy.id}`;
    assert.equal(saved.expected_amount, 49500); assert.equal(saved.offer_key, null);
  });
  let leadId;
  await check('concurrent lead submission persists one record and changed payload conflicts', async () => {
    const body = { name: 'Synthetic Buyer', email: 'buyer@example.test', vehicle: 'Synthetic vehicle' };
    const key = randomUUID();
    const results = await Promise.all(Array.from({ length: 5 }, () => call(leads, body, key)));
    assert.equal(results.filter(r => r.statusCode === 201).length, 1);
    assert.ok(results.every(r => [200, 201].includes(r.statusCode)));
    assert.equal(new Set(results.map(r => r.body.lead_id)).size, 1);
    leadId = results[0].body.lead_id;
    assert.equal(await count('leads'), 1);
    assert.equal((await call(leads, { ...body, vehicle: 'Changed vehicle' }, key)).statusCode, 409);
  });
  const current = [];
  await check('concurrent $295/$895 checkout retries persist one snapshot per tier; AI returns 410', async () => {
    for (const [tier, amount] of [['full_service', 29500], ['concierge', 89500]]) {
      const key = randomUUID(), body = { tier, lead_id: leadId, source_page: '/schedule.html' };
      const results = await Promise.all(Array.from({ length: 5 }, () => call(checkout, body, key)));
      assert.equal(results.filter(r => r.statusCode === 201).length, 1);
      assert.ok(results.every(r => [200, 201].includes(r.statusCode)));
      assert.equal(new Set(results.map(r => r.body.attempt_id)).size, 1);
      assert.equal(new Set(results.map(r => r.body.url)).size, 1);
      const [row] = await sql`SELECT * FROM checkout_attempts WHERE id = ${results[0].body.attempt_id}`;
      assert.equal(row.expected_amount, amount); assert.equal(row.currency, 'usd'); assert.ok(row.offer_key);
      current.push(row);
      assert.equal((await call(checkout, { ...body, source_page: '/different.html' }, key)).statusCode, 409);
    }
    const before = await count('checkout_attempts');
    const retired = await call(checkout, { tier: 'consultation' });
    assert.equal(retired.statusCode, 410); assert.equal(retired.body.url, undefined);
    assert.equal(await count('checkout_attempts'), before);
  });
  await check('stale historical retry returns no link; explicit new-key restart preserves old attempt', async () => {
    const res = await call(checkout, { tier: 'full_service' }, legacy.idempotency_key);
    assert.equal(res.statusCode, 409); assert.equal(res.body.error, 'stale_offer'); assert.equal(res.body.url, undefined);
    assert.equal((await call(checkout, { tier: 'full_service' })).statusCode, 201);
    const [old] = await sql`SELECT * FROM checkout_attempts WHERE id = ${legacy.id}`;
    assert.equal(old.expected_amount, 49500); assert.equal(old.offer_key, null);
  });
  const paid = [];
  await check('signed synthetic $195/$495/$295/$895 events dedupe under concurrent replay and preserve intake', async () => {
    const attempts = [await seedAttempt('consultation', 19500), legacy, ...current];
    for (const attempt of attempts) {
      const event = paidEvent(attempt);
      const unpaid = { ...event, id: `${event.id}_unpaid`, data: { object: { ...event.data.object, payment_status: 'unpaid' } } };
      assert.equal((await deliver(unpaid)).statusCode, 200);
      const asyncPaid = { ...event, type: 'checkout.session.async_payment_succeeded' };
      const results = await Promise.all([deliver(asyncPaid), deliver(asyncPaid), deliver({ ...event, id: `${event.id}_other` })]);
      assert.ok(results.every(r => r.statusCode === 200));
      const rows = await sql`SELECT * FROM purchases WHERE checkout_session_id = ${event.data.object.id}`;
      assert.equal(rows.length, 1); assert.equal(rows[0].amount_total, attempt.expected_amount);
      assert.equal((await sql`SELECT * FROM analytics_outbox WHERE dedupe_key = ${event.data.object.id}`).length, 1);
      for (let i = 0; i < 3; i++) assert.equal(verifiedPurchase(event.data.object, rows[0], attempt.tier_id), true);
      const intake = { tier: attempt.tier_id, session_id: event.data.object.id,
        fields: { name: 'Synthetic Buyer', email: 'buyer@example.test', phone: '512-555-0100', city: 'Austin' } };
      const key = randomUUID();
      const responses = await Promise.all([call(onboarding, intake, key), call(onboarding, intake, key)]);
      assert.deepEqual(responses.map(r => r.statusCode).sort(), [200, 201]);
      assert.equal((await call(onboarding, intake)).statusCode, 200);
      paid.push(event.data.object);
    }
    assert.equal(await count('purchases'), 4); assert.equal(await count('onboarding_submissions'), 4);
    assert.equal(await count('analytics_outbox'), 8);
  });
  await check('invalid signature, increased tax total, discount, currency, unpaid and unmatched references cannot purchase', async () => {
    const attempt = await seedAttempt('full_service', 29500);
    assert.equal((await deliver(paidEvent(attempt), false)).statusCode, 400);
    const tampered = paidEvent(attempt), raw = JSON.stringify(tampered);
    const signature = Stripe.webhooks.generateTestHeaderString({ payload: raw, secret: 'whsec_wrong' });
    assert.equal((await call(webhook, undefined, randomUUID(), { rawBody: Buffer.from(raw), headers: { 'stripe-signature': signature } })).statusCode, 400);
    for (const change of [{ amount_total: 31934 }, { amount_total: 28000 }, { currency: 'eur' },
      { payment_status: 'unpaid' }, { client_reference_id: randomUUID() }]) {
      assert.equal((await deliver(paidEvent(attempt, change))).statusCode, 200);
    }
    assert.equal(await count('purchases'), 4); assert.equal(await count('analytics_outbox'), 8);
    const fake = await call(onboarding, { tier: 'full_service', session_id: 'cs_test_nonexistent12345',
      fields: { name: 'Synthetic Buyer', email: 'buyer@example.test', phone: '512-555-0100', city: 'Austin' } });
    assert.equal(fake.statusCode, 403); assert.equal(await count('onboarding_submissions'), 4);
  });
  await check('real outbox SQL retries with stable IDs and concurrent workers acknowledge each event once (transport stub)', async () => {
    const env = { ANALYTICS_FORWARD_URL: 'https://collector.example.test/synthetic', ANALYTICS_OUTBOX_BATCH_SIZE: '50' };
    const keys = [], acknowledged = new Set(); let failing = true;
    globalThis.fetch = async (url, options) => {
      assert.equal(String(url), env.ANALYTICS_FORWARD_URL);
      const key = options.headers['Idempotency-Key']; keys.push(key);
      if (!failing) acknowledged.add(key);
      return { ok: !failing, status: failing ? 503 : 204 };
    };
    const originalError = console.error;
    try {
      console.error = () => {};
      assert.equal((await dispatchAnalyticsOutbox({ sql, environment: env })).failed, 8);
    } finally { console.error = originalError; }
    assert.equal((await dispatchAnalyticsOutbox({ sql, environment: env })).claimed, 0);
    await sql`UPDATE analytics_outbox SET available_at = now() WHERE status = 'failed'`;
    failing = false;
    const workers = await Promise.all([dispatchAnalyticsOutbox({ sql, environment: env }), dispatchAnalyticsOutbox({ sql, environment: env })]);
    assert.equal(workers.reduce((sum, worker) => sum + worker.sent, 0), 8);
    assert.equal(acknowledged.size, 8); assert.equal(keys.length, 16);
    assert.equal((await dispatchAnalyticsOutbox({ sql, environment: env })).claimed, 0);
    const rows = await sql`SELECT status, attempts FROM analytics_outbox`;
    assert.ok(rows.every(row => row.status === 'sent' && row.attempts === 2));
  });
  let stripeSnapshotReplay = 0;
  if (process.env.SEO09_STRIPE_EVIDENCE) {
    await check('MCP-read paid test session snapshots reconcile to purchases and intake under locally signed replay', async () => {
      const evidence = JSON.parse(await readFile(process.env.SEO09_STRIPE_EVIDENCE, 'utf8'));
      assert.equal(evidence.livemode, false);
      assert.equal(evidence.sessions.length, 4);
      for (const { session, tier_id, expected_amount } of evidence.sessions) {
        assert.equal(session.livemode, false); assert.equal(session.payment_status, 'paid');
        assert.match(session.id, /^cs_test_/); assert.equal(session.amount_total, expected_amount);
        assert.ok([19500, 29500, 49500, 89500].includes(expected_amount));
        const attempt = await seedAttempt(tier_id, expected_amount);
        await sql`UPDATE checkout_attempts SET client_reference_id = ${session.client_reference_id} WHERE id = ${attempt.id}`;
        // This is deliberately a synthetic envelope/signature, not a claim of Stripe webhook delivery.
        const event = { id: `evt_local_replay_${randomUUID().replaceAll('-', '')}`, type: 'checkout.session.completed',
          created: session.created, livemode: false, data: { object: session } };
        const responses = await Promise.all([deliver(event), deliver(event), deliver({ ...event, id: `${event.id}_other` })]);
        assert.ok(responses.every(res => res.statusCode === 200));
        const rows = await sql`SELECT * FROM purchases WHERE checkout_session_id = ${session.id}`;
        assert.equal(rows.length, 1); assert.equal(verifiedPurchase(session, rows[0], tier_id), true);
        assert.equal((await sql`SELECT * FROM analytics_outbox WHERE dedupe_key = ${session.id}`).length, 1);
        const intake = { tier: tier_id, session_id: session.id,
          fields: { name: 'Synthetic Buyer', email: 'buyer@example.test', phone: '512-555-0100', city: 'Austin' } };
        const key = randomUUID();
        const saved = await Promise.all([call(onboarding, intake, key), call(onboarding, intake, key)]);
        assert.deepEqual(saved.map(res => res.statusCode).sort(), [200, 201]);
        stripeSnapshotReplay++;
      }
      assert.equal(await count('purchases'), 8); assert.equal(await count('onboarding_submissions'), 8);
      assert.equal(await count('analytics_outbox'), 16);
      const delivery = { sql, environment: { ANALYTICS_FORWARD_URL: 'https://collector.example.test/synthetic', ANALYTICS_OUTBOX_BATCH_SIZE: '50' } };
      assert.equal((await dispatchAnalyticsOutbox(delivery)).sent, 8);
      assert.equal((await dispatchAnalyticsOutbox(delivery)).claimed, 0);
    });
  }
  console.log(JSON.stringify({ checks: checks.length, passed: checks.length, purchases: await count('purchases'),
    onboarding: await count('onboarding_submissions'), outbox: await count('analytics_outbox'),
    realPostgres: true, stripeEvents: 'locally signed synthetic', collector: 'transport stub',
    stripeSnapshotReplay, stripePaymentsVerified: false, destinationDeliveryVerified: false }));
} finally {
  globalThis.fetch = originalFetch;
  await sql.end({ timeout: 5 });
}
