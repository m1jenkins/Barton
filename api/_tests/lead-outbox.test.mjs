import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { dispatchLeadForwardOutbox, leadDestination, leadDeliverySettings } from '../_lib/lead-forward-outbox.js';
import { runLeadWorker } from '../../scripts/dispatch-leads.mjs';

const environment = { LEAD_FORWARD_URL: 'https://notifications.example.test/leads' };
const leadId = '06a28d37-b5d9-4f0e-a20c-c8e506ef5477';
const otherId = 'a5caa16e-dc66-4eea-9b0a-d4299989440e';
const schema = await readFile(new URL('../../db/001_durable_leads_and_payments.sql', import.meta.url), 'utf8');

function tagged(client) {
  const sql = async (strings, ...values) => {
    const query = strings.reduce((text, part, index) => text + (index ? `$${index}` : '') + part, '');
    return (await client.query(query, values)).rows;
  };
  sql.begin = fn => client.transaction(tx => fn(tagged(tx)));
  return sql;
}

test('lead notifications retry, recover expired claims and fence older workers in PostgreSQL', async t => {
  const pg = await PGlite.create();
  t.after(() => pg.close());
  await pg.exec(schema);
  const sql = tagged(pg);
  const queue = async (id = leadId, minutesAgo = 0) => {
    await pg.query(`INSERT INTO leads (id, idempotency_key, request_hash, name, email, vehicle, created_at)
      VALUES ($1, $2, $3, 'Buyer', 'buyer@example.test', 'Mazda CX-5', now() - $4 * interval '1 minute')`, [id, id, 'a'.repeat(64), minutesAgo]);
    await pg.query('INSERT INTO lead_forward_outbox (lead_id) VALUES ($1)', [id]);
  };
  const row = async () => (await pg.query('SELECT * FROM lead_forward_outbox WHERE lead_id = $1', [leadId])).rows[0];
  const reset = () => pg.exec('TRUNCATE leads CASCADE');

  await t.test('an unconfigured destination touches no database', async () => {
    assert.deepEqual(await runLeadWorker({ environment: {} }), { configured: false, exhausted: null, exitCode: 1 });
    assert.deepEqual(await dispatchLeadForwardOutbox({ environment: {} }), { configured: false, claimed: 0, sent: 0, failed: 0 });
  });

  await t.test('a failed delivery waits for backoff, retries the same ID, then stays sent', async t => {
    await queue();
    const requests = [];
    t.mock.method(console, 'error', () => {});
    t.mock.method(globalThis, 'fetch', async (url, options) => {
      requests.push({ url: String(url), ...options });
      return { ok: requests.length > 1, status: requests.length === 1 ? 503 : 204 };
    });
    assert.equal((await runLeadWorker({ sql, environment })).failed, 1);
    assert.equal((await row()).status, 'failed');
    assert.equal((await runLeadWorker({ sql, environment })).claimed, 0, 'a browser retry must not hammer the notification endpoint');
    await pg.exec("UPDATE lead_forward_outbox SET last_attempt_at = now() - interval '31 seconds'");
    assert.equal((await runLeadWorker({ sql, environment })).sent, 1);
    assert.equal((await row()).attempts, 2);
    assert.equal((await row()).status, 'sent');
    assert.equal((await runLeadWorker({ sql, environment })).claimed, 0);
    assert.equal(requests.length, 2);
    assert.equal(requests[0].headers['Idempotency-Key'], leadId);
    assert.equal(requests[1].headers['Idempotency-Key'], leadId);
    assert.equal(requests[0].body, requests[1].body);
    const forwarded = JSON.parse(requests[0].body);
    assert.equal(forwarded.email, 'buyer@example.test');
    assert.equal(forwarded.request_hash, undefined);
    assert.equal(forwarded.idempotency_key, undefined);
    assert.equal(requests[0].redirect, 'error');
    await reset();
  });

  await t.test('targeted dispatch and a bounded oldest-first batch keep other leads queued', async t => {
    await queue(leadId, 1);
    await queue(otherId, 2);
    t.mock.method(globalThis, 'fetch', async () => ({ ok: true }));
    assert.equal((await dispatchLeadForwardOutbox({ sql, environment, leadId })).sent, 1);
    assert.equal((await pg.query('SELECT status FROM lead_forward_outbox WHERE lead_id = $1', [otherId])).rows[0].status, 'pending');
    await reset();
    await queue(leadId, 1);
    await queue(otherId, 2);
    const keys = [];
    t.mock.method(globalThis, 'fetch', async (url, options) => { keys.push(options.headers['Idempotency-Key']); return { ok: true }; });
    assert.equal((await runLeadWorker({ sql, environment: { ...environment, LEAD_OUTBOX_BATCH_SIZE: '1' } })).claimed, 1);
    assert.deepEqual(keys, [otherId]);
    assert.equal((await row()).status, 'pending');
    await reset();
  });

  await t.test('a live lease cannot be stolen, and an expired one can be recovered', async t => {
    await queue();
    await pg.exec("UPDATE lead_forward_outbox SET status = 'processing', attempts = 1, last_attempt_at = now()");
    t.mock.method(globalThis, 'fetch', async () => ({ ok: true }));
    assert.equal((await runLeadWorker({ sql, environment })).claimed, 0);
    await pg.exec("UPDATE lead_forward_outbox SET last_attempt_at = now() - interval '61 seconds'");
    assert.equal((await runLeadWorker({ sql, environment })).sent, 1);
    assert.equal((await row()).attempts, 2);
    await reset();
  });

  await t.test('a late failed worker cannot overwrite a newer successful delivery', async t => {
    await queue();
    let completeOld, started;
    const delivering = new Promise(resolve => { started = resolve; });
    let calls = 0;
    t.mock.method(console, 'error', () => {});
    t.mock.method(globalThis, 'fetch', async () => {
      if (++calls === 1) { started(); return new Promise(resolve => { completeOld = resolve; }); }
      return { ok: true };
    });
    const old = runLeadWorker({ sql, environment });
    await delivering;
    assert.equal((await runLeadWorker({ sql, environment })).claimed, 0);
    await pg.exec("UPDATE lead_forward_outbox SET last_attempt_at = now() - interval '61 seconds'");
    assert.equal((await runLeadWorker({ sql, environment })).sent, 1);
    completeOld({ ok: false, status: 503 });
    await old;
    assert.equal((await row()).status, 'sent');
    assert.equal((await row()).attempts, 2);
    assert.equal((await row()).last_error, null);
    await reset();
  });

  await t.test('an expired final lease is exhausted and cannot be sent again', async t => {
    await queue();
    const env = { ...environment, LEAD_OUTBOX_MAX_ATTEMPTS: '2' };
    await pg.exec("UPDATE lead_forward_outbox SET status = 'processing', attempts = 2, last_attempt_at = now()");
    t.mock.method(globalThis, 'fetch', () => { throw new Error('Exhausted jobs must not be sent'); });
    assert.equal((await runLeadWorker({ sql, environment: env })).exhausted, 0);
    await pg.exec("UPDATE lead_forward_outbox SET last_attempt_at = now() - interval '61 seconds'");
    const result = await runLeadWorker({ sql, environment: env });
    assert.equal(result.claimed, 0);
    assert.equal(result.exhausted, 1);
    assert.equal(result.exitCode, 1);
    assert.equal(JSON.stringify(result).includes('buyer@example.test'), false);
    await reset();
  });

  await t.test('delivery failures keep private response and request details out of logs', async t => {
    await queue();
    const logs = [];
    t.mock.method(console, 'error', (...args) => logs.push(args));
    t.mock.method(globalThis, 'fetch', async () => { throw new Error('buyer@example.test secret-token private-destination'); });
    await runLeadWorker({ sql, environment });
    const evidence = JSON.stringify(logs) + (await row()).last_error;
    assert.doesNotMatch(evidence, /buyer@example|secret-token|private-destination/);
    assert.match(evidence, /lead_forward_failed/);
    await reset();
  });
});

test('notification destinations and worker settings fail closed', () => {
  for (const value of ['http://example.test', 'https://user:secret@example.test', 'https://example.test/#secret', 'not a URL']) {
    assert.throws(() => leadDestination({ LEAD_FORWARD_URL: value }));
  }
  assert.throws(() => leadDeliverySettings({ LEAD_OUTBOX_LEASE_SECONDS: '15', LEAD_FORWARD_TIMEOUT_MS: '15000' }));
  assert.throws(() => leadDeliverySettings({ LEAD_OUTBOX_MAX_ATTEMPTS: '2.5' }));
});
