import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { ConfigError } from '../_lib/config.js';
import { dispatchLeadEmails, leadEmailQueued, leadEmailSettings, renderLeadEmail } from '../_lib/lead-email.js';
import { withApiErrors } from '../_lib/http.js';
import { leadHandler, leadRequestHash } from '../leads.js';
import { outboxHandler } from '../outbox-dispatch.js';
import { runLeadEmailWorker } from '../../scripts/dispatch-lead-emails.mjs';

const notify = 'outreach@notify.example.test';
const environment = { LEAD_NOTIFY_EMAIL: notify, INTAKE_SMTP_USER: 'mason@steermeright.com', INTAKE_SMTP_PASSWORD: 'app-password-not-real' };
const leadId = '06a28d37-b5d9-4f0e-a20c-c8e506ef5477';
const otherId = 'a5caa16e-dc66-4eea-9b0a-d4299989440e';
const migrations = await Promise.all(['001_durable_leads_and_payments.sql', '009_lead_email_outbox.sql']
  .map(name => readFile(new URL(`../../db/${name}`, import.meta.url), 'utf8')));

function tagged(client) {
  const sql = async (strings, ...values) => {
    const query = strings.reduce((text, part, index) => text + (index ? `$${index}` : '') + part, '');
    return (await client.query(query, values)).rows;
  };
  sql.begin = fn => client.transaction(tx => fn(tagged(tx)));
  return sql;
}

test('notices stay off until LEAD_NOTIFY_EMAIL is set, and send from the Zoho intake mailbox', () => {
  assert.equal(leadEmailSettings({}), null);
  assert.equal(leadEmailQueued({}), false);
  assert.equal(leadEmailQueued({ LEAD_NOTIFY_EMAIL: '  ' }), false);
  assert.throws(() => leadEmailSettings({ ...environment, LEAD_NOTIFY_EMAIL: 'not an address' }), ConfigError);
  assert.throws(() => leadEmailSettings({ LEAD_NOTIFY_EMAIL: notify }), ConfigError);
  assert.equal(leadEmailQueued({ LEAD_NOTIFY_EMAIL: notify }), true, 'queueing must not depend on SMTP settings, so it can never fail a lead');
  const settings = leadEmailSettings(environment);
  assert.deepEqual([settings.to, settings.user, settings.host, settings.port], [notify, 'mason@steermeright.com', 'smtppro.zoho.com', 465]);
});

test('the notice names the lead by ID and carries no contact details', () => {
  const { subject, text } = renderLeadEmail({ lead_id: leadId, source: 'pricing_inquiry', source_page: '/schedule.html', created_at: '2026-11-03T18:04:11Z' });
  assert.equal(subject, `New lead ${leadId}`);
  assert.match(text, /Source: pricing_inquiry \(\/schedule\.html\)/);
  assert.match(text, /Saved: 2026-11-03T18:04:11\.000Z/);
});

test('notices are queued durably, sent once, and retried after an SMTP failure', async t => {
  const pg = await PGlite.create();
  t.after(() => pg.close());
  for (const migration of migrations) await pg.exec(migration);
  const sql = tagged(pg);
  const queue = async id => {
    await pg.query(`INSERT INTO leads (id, idempotency_key, request_hash, name, email, phone, vehicle, source, source_page)
      VALUES ($1, $2, $3, 'Pat Buyer', 'pat@example.test', '205-555-0100', 'Mazda CX-5', 'pricing_inquiry', '/schedule.html')`, [id, id, 'a'.repeat(64)]);
    await pg.query('INSERT INTO lead_email_outbox (lead_id) VALUES ($1)', [id]);
  };
  const status = async (id = leadId) => (await pg.query('SELECT * FROM lead_email_outbox WHERE lead_id = $1', [id])).rows[0];

  await t.test('unconfigured notices touch neither the database nor the network', async () => {
    assert.deepEqual(await dispatchLeadEmails({ environment: {} }), { configured: false, claimed: 0, sent: 0, failed: 0 });
    assert.deepEqual(await runLeadEmailWorker({ environment: {} }), { configured: false, exhausted: null, exitCode: 1 });
  });

  await t.test('a refused login is recorded by code only, then a later run delivers it once', async t => {
    await queue(leadId);
    t.mock.method(console, 'error', () => {});
    const sent = [];
    let fail = true, closed = 0;
    const createTransport = () => ({
      async sendMail(message) {
        if (fail) throw Object.assign(new Error('535 Authentication failed for app-password-not-real'), { code: 'EAUTH' });
        sent.push(message);
      },
      close() { closed += 1; }
    });
    assert.equal((await runLeadEmailWorker({ sql, environment, createTransport })).failed, 1);
    assert.equal((await status()).status, 'failed');
    assert.equal((await status()).last_error, 'Lead email failed (EAUTH)');
    assert.equal((await dispatchLeadEmails({ sql, environment, createTransport })).claimed, 0, 'backoff holds the retry');

    fail = false;
    await pg.exec("UPDATE lead_email_outbox SET last_attempt_at = now() - interval '61 seconds'");
    const result = await runLeadEmailWorker({ sql, environment, createTransport });
    assert.deepEqual([result.sent, result.exitCode], [1, 0]);
    assert.deepEqual([(await status()).status, (await status()).attempts], ['sent', 2]);
    assert.equal((await dispatchLeadEmails({ sql, environment, createTransport })).claimed, 0);
    assert.equal(closed, 2, 'each run closes its SMTP connection');
    assert.equal(sent.length, 1);
    assert.equal(sent[0].to, notify);
    assert.equal(sent[0].from.address, 'mason@steermeright.com');
    assert.equal(sent[0].subject, `New lead ${leadId}`);
    assert.equal(sent[0].headers['X-Steer-Lead-Id'], leadId);
    assert.equal(sent[0].replyTo, undefined);
    assert.doesNotMatch(JSON.stringify(sent[0]), /Pat Buyer|pat@example\.test|555-0100|Mazda/);
  });

  await t.test('a targeted send leaves other leads queued for the cron', async () => {
    await queue(otherId);
    await pg.exec(`UPDATE lead_email_outbox SET status = 'pending', attempts = 0 WHERE lead_id = '${leadId}'`);
    const createTransport = () => ({ async sendMail() {} });
    assert.equal((await dispatchLeadEmails({ sql, environment, leadId: otherId, createTransport })).sent, 1);
    assert.equal((await status()).status, 'pending');
  });
});

test('a new lead queues its notice in the lead transaction and still succeeds when the notice cannot send', async t => {
  const env = { APP_ORIGIN: 'https://www.steermeright.com', ALLOWED_ORIGINS: '', LEAD_NOTIFY_EMAIL: notify };
  const previous = Object.fromEntries([...Object.keys(env), 'LEAD_FORWARD_URL', 'INTAKE_SMTP_USER', 'INTAKE_SMTP_PASSWORD'].map(key => [key, process.env[key]]));
  for (const key of ['LEAD_FORWARD_URL', 'INTAKE_SMTP_USER', 'INTAKE_SMTP_PASSWORD']) delete process.env[key];
  Object.assign(process.env, env);
  t.after(() => { for (const [key, value] of Object.entries(previous)) value === undefined ? delete process.env[key] : process.env[key] = value; });
  const errors = [];
  t.mock.method(console, 'error', (...args) => errors.push(args[0]));

  const payload = { name: 'Buyer', email: 'buyer@example.test', vehicle: 'Mazda CX-5', source_page: '/schedule.html' };
  const record = { id: leadId, request_hash: leadRequestHash(payload), ...payload };
  const queued = [];
  let inTransaction = false;
  const sql = async strings => {
    const query = strings.join('?');
    if (query.includes('FROM leads WHERE idempotency_key')) return [];
    if (query.includes('INSERT INTO leads')) return [record];
    if (query.includes('INSERT INTO lead_email_outbox')) { queued.push(inTransaction); return []; }
    throw new Error(`Unexpected SQL: ${query}`);
  };
  sql.json = value => value;
  sql.begin = async fn => { inTransaction = true; try { return await fn(sql); } finally { inTransaction = false; } };

  // SMTP isn't configured here, so the post-commit send fails with a configuration error.
  const req = { method: 'POST', headers: { origin: 'https://www.steermeright.com', 'content-type': 'application/json', 'idempotency-key': 'lead:test-0002' }, body: payload };
  const res = { setHeader() {}, end(value) { this.body = JSON.parse(value); } };
  await withApiErrors(leadHandler({ getDatabase: () => sql, verifyToken: async () => false, notify() {} }))(req, res);
  assert.equal(res.statusCode, 201);
  assert.equal(res.body.lead_id, leadId);
  assert.deepEqual(queued, [true], 'the notice row is written in the same transaction as the lead');
  assert.ok(errors.includes('[lead_email_dispatch_failed]'));
});

test('the daily cron runs the lead email worker beside the other outboxes', async () => {
  const secret = 'test-secret-for-bounded-cron-authentication';
  const request = { method: 'GET', headers: { authorization: `Bearer ${secret}` } };
  const response = () => ({ headers: {}, setHeader() {}, end(value) { this.body = JSON.parse(value); } });
  const off = response();
  await outboxHandler({ environment: { CRON_SECRET: secret }, getDatabase() { throw Error('must not connect'); } })(request, off);
  assert.equal(off.body.workers.lead_email.configured, false);

  const on = response();
  const done = async () => ({ configured: true, claimed: 1, sent: 1, failed: 0, exhausted: 0, exitCode: 0 });
  await outboxHandler({ environment: { CRON_SECRET: secret, ...environment }, getDatabase: () => ({}),
    intakeEmailWorker: done, leadEmailWorker: done
  })(request, on);
  assert.deepEqual(on.body.workers.lead_email, { configured: true, claimed: 1, sent: 1, failed: 0, exhausted: 0, ok: true });
});
