import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { dispatchAnalyticsOutbox, dispatchAnalyticsOutboxSafely } from '../_lib/analytics-outbox.js';
import { runAnalyticsWorker } from '../_lib/outbox-workers.js';

const environment = { ANALYTICS_FORWARD_URL: 'https://collector.example.test/events' };
function tagged(client) {
  const sql = async (strings, ...values) => (await client.query(strings.reduce((text, part, index) => text + (index ? `$${index}` : '') + part, ''), values)).rows;
  sql.begin = fn => client.transaction(tx => fn(tagged(tx)));
  return sql;
}

test('analytics retry claims and exhausted leases work against the committed PostgreSQL schema', async t => {
  const pg = await PGlite.create(); t.after(() => pg.close());
  await pg.exec(await readFile(new URL('../../db/001_durable_leads_and_payments.sql', import.meta.url), 'utf8'));
  const sql = tagged(pg), keys = [];
  await pg.query(`INSERT INTO analytics_outbox(event_name, dedupe_key, payload) VALUES ('purchase', 'receipt', $1)`, [JSON.stringify({ event_id: 'purchase:receipt', email: 'private@example.test' })]);
  let fail = true;
  t.mock.method(console, 'error', () => {});
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    keys.push(options.headers['Idempotency-Key']); assert.doesNotMatch(options.body, /private@example/);
    if (fail) throw Error('transport included https://secret:credential@example.test');
    return { ok: true };
  });
  assert.equal((await dispatchAnalyticsOutbox({ sql, environment })).failed, 1);
  assert.equal((await dispatchAnalyticsOutbox({ sql, environment })).claimed, 0);
  assert.doesNotMatch((await pg.query('SELECT last_error FROM analytics_outbox')).rows[0].last_error, /secret|credential|https:/);
  await pg.exec(`UPDATE analytics_outbox SET available_at = now() - interval '1 second'`);
  fail = false;
  assert.equal((await dispatchAnalyticsOutbox({ sql, environment })).sent, 1);
  assert.deepEqual(keys, ['purchase:receipt', 'purchase:receipt']);
  assert.equal((await dispatchAnalyticsOutbox({ sql, environment })).claimed, 0);
  await pg.exec(`UPDATE analytics_outbox SET status = 'processing', attempts = 1, available_at = now() + interval '1 minute'`);
  assert.equal((await dispatchAnalyticsOutbox({ sql, environment })).claimed, 0);
  await pg.exec(`UPDATE analytics_outbox SET available_at = now() - interval '1 second'`);
  assert.equal((await dispatchAnalyticsOutbox({ sql, environment })).sent, 1);
  await pg.exec(`UPDATE analytics_outbox SET status = 'processing', attempts = 8, available_at = now() + interval '1 minute'`);
  assert.equal((await runAnalyticsWorker({ sql, environment })).exhausted, 0);
  await pg.exec(`UPDATE analytics_outbox SET available_at = now() - interval '1 second'`);
  const result = await runAnalyticsWorker({ sql, environment }); assert.equal(result.claimed, 0); assert.equal(result.exhausted, 1); assert.equal(result.exitCode, 1);
});

test('analytics dispatch waits for all deliveries after an acknowledgement failure and omits private error text', async t => {
  const logs = []; t.mock.method(console, 'error', (...args) => logs.push(args));
  let release, completed = false;
  const sql = async (strings, ...values) => {
    if (strings.join('').includes('RETURNING event.id')) return [1, 2].map(id => ({ id, event_name: 'purchase', dedupe_key: `receipt${id}`, attempts: 1, payload: {} }));
    if (values.includes(1)) throw Error('sql contains postgres://private-password');
    return [];
  };
  sql.begin = fn => fn(sql);
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    if (options.headers['Idempotency-Key'].endsWith('2')) await new Promise(resolve => { release = resolve; });
    return { ok: true };
  });
  const pending = dispatchAnalyticsOutboxSafely({ sql, environment }).then(result => { completed = true; return result; });
  await new Promise(resolve => setImmediate(resolve)); assert.equal(completed, false);
  release(); const result = await pending; assert.equal(result.dispatcher_error, true);
  assert.doesNotMatch(JSON.stringify(logs), /private-password|postgres:/);
});

test('analytics rejects a lease that expires before the delivery timeout', async () => {
  await assert.rejects(dispatchAnalyticsOutbox({ sql: {}, environment: { ...environment, ANALYTICS_OUTBOX_LEASE_SECONDS: '15', ANALYTICS_FORWARD_TIMEOUT_MS: '15000' } }), /lease must exceed/);
});

test('an unconfigured analytics dispatcher does not open a database connection', async () => {
  assert.deepEqual(await dispatchAnalyticsOutbox({ environment: {} }), { configured: false, claimed: 0, sent: 0, failed: 0 });
});
