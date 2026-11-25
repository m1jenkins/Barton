import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runDocumentCleanupWorker } from '../_lib/buyer-documents.js';
import { outboxHandler } from '../outbox-dispatch.js';

const secret = 'test-secret-for-bounded-cron-authentication';
function response() {
  return { headers: {}, setHeader(key, value) { this.headers[key] = value; }, end(value) { this.body = JSON.parse(value); } };
}
const request = (token = secret, method = 'GET') => ({ method, headers: { authorization: `Bearer ${token}` } });

test('cron rejects public requests before invoking any worker or database', async () => {
  let calls = 0;
  const handler = outboxHandler({ environment: { CRON_SECRET: secret }, getDatabase() { calls++; }, leadWorker() { calls++; }, analyticsWorker() { calls++; } });
  for (const [req, code] of [[request('wrong'), 401], [{ method: 'GET', headers: {} }, 401], [request(secret, 'POST'), 405]]) {
    const res = response(); await handler(req, res); assert.equal(res.statusCode, code);
    assert.match(res.headers['Cache-Control'], /no-store/);
  }
  assert.equal(calls, 0);
  const res = response(); await outboxHandler({ environment: {} })(request(), res); assert.equal(res.statusCode, 503);
});

test('cron honestly skips missing destinations without touching the database', async () => {
  const res = response();
  await outboxHandler({ environment: { CRON_SECRET: secret }, getDatabase() { throw Error('must not connect'); } })(request(), res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.workers.leads.configured, false);
  assert.equal(res.body.workers.analytics.configured, false);
  assert.equal(res.body.workers.buyer_updates.configured, false);
  assert.equal(res.body.workers.document_cleanup.configured, false);
  assert.equal(res.body.workers.deal_mail, undefined, 'the reply-address mail job is gone');
});

test('cron waits for both configured workers and reports aggregate failures without secrets', async () => {
  const logs = [], sql = {}, seen = [];
  let release;
  const environment = { CRON_SECRET: secret, LEAD_FORWARD_URL: 'https://notify.example.test', ANALYTICS_FORWARD_URL: 'https://analytics.example.test' };
  const handler = outboxHandler({ environment, getDatabase: () => sql, logger: { error(...args) { logs.push(args); } },
    async leadWorker(options) { seen.push(options.sql); throw Error('postgres://password@example.test/private-buyer'); },
    async analyticsWorker(options) { seen.push(options.sql); await new Promise(resolve => { release = resolve; }); return { configured: true, claimed: 2, sent: 2, failed: 0, exhausted: 0, exitCode: 0 }; }
  });
  const res = response(), pending = handler(request(), res);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(res.body, undefined);
  release(); await pending;
  assert.deepEqual(seen, [sql, sql]);
  assert.equal(res.statusCode, 503);
  assert.equal(res.body.workers.analytics.sent, 2);
  assert.equal(res.body.workers.leads.dispatcher_error, true);
  assert.doesNotMatch(JSON.stringify([res.body, logs]), /password|private-buyer|test-secret|example\.test/);
});

test('failed or exhausted deliveries surface as a failed cron run', async () => {
  const res = response(), logs = [];
  await outboxHandler({ environment: { CRON_SECRET: secret, LEAD_FORWARD_URL: 'https://notify.example.test' }, getDatabase: () => ({}),
    logger: { error(...args) { logs.push(args); } },
    leadWorker: async () => ({ configured: true, claimed: 2, sent: 1, failed: 1, exhausted: 3, exitCode: 1 })
  })(request(), res);
  assert.equal(res.statusCode, 503);
  assert.deepEqual(logs[0], ['[outbox_attention_required]', { worker: 'leads', failed: 1, exhausted: 3 }]);
});

test('cron runs the customer email worker only once it is turned on', async () => {
  const smtp = { INTAKE_SMTP_USER: 'hello@steermeright.com', INTAKE_SMTP_PASSWORD: 'app-password-not-real' };
  let calls = 0;
  const customerEmailWorker = async () => { calls++; return { configured: true, claimed: 1, sent: 1, failed: 0, skipped: 0, scheduled: 0, exhausted: 0, exitCode: 0 }; };
  const quiet = { intakeEmailWorker: async () => ({ configured: true, claimed: 0, sent: 0, failed: 0, exhausted: 0, exitCode: 0 }) };

  const off = response();
  await outboxHandler({ environment: { CRON_SECRET: secret, ...smtp }, getDatabase: () => ({}), customerEmailWorker, ...quiet })(request(), off);
  assert.equal(off.body.workers.customer_email.configured, false);
  assert.equal(calls, 0);

  const on = response();
  await outboxHandler({ environment: { CRON_SECRET: secret, ...smtp, CUSTOMER_EMAIL_ENABLED: '1' }, getDatabase: () => ({}), customerEmailWorker, ...quiet })(request(), on);
  assert.equal(on.statusCode, 200);
  assert.equal(on.body.workers.customer_email.sent, 1);
  assert.equal(calls, 1);
});

test('cron runs the Buyer Update worker only with the Deal Tracker on', async () => {
  const smtp = { INTAKE_SMTP_USER: 'hello@steermeright.com', INTAKE_SMTP_PASSWORD: 'app-password-not-real' };
  let calls = 0;
  const buyerUpdateWorker = async () => { calls++; return { configured: true, claimed: 1, sent: 1, failed: 0, exhausted: 0, exitCode: 0 }; };
  const quiet = { intakeEmailWorker: async () => ({ configured: true, claimed: 0, sent: 0, failed: 0, exhausted: 0, exitCode: 0 }) };

  const off = response();
  await outboxHandler({ environment: { CRON_SECRET: secret, ...smtp }, getDatabase: () => ({}), buyerUpdateWorker, ...quiet })(request(), off);
  assert.equal(off.statusCode, 200);
  assert.equal(off.body.workers.buyer_updates.configured, false);
  assert.equal(calls, 0);

  const on = response();
  const tracker = { DEAL_TRACKER_ENABLED: '1', DEAL_TRACKER_SECRET: 'deal-tracker-secret-for-tests-only-0123456789' };
  await outboxHandler({ environment: { CRON_SECRET: secret, ...smtp, ...tracker }, getDatabase: () => ({}), buyerUpdateWorker, ...quiet })(request(), on);
  assert.equal(on.statusCode, 200);
  assert.equal(on.body.workers.buyer_updates.sent, 1);
  assert.equal(calls, 1);
});

test('?jobs=document_cleanup runs the Buyer Document cleanup, and only with the Deal Tracker on and a store set up', async () => {
  const tracker = { DEAL_TRACKER_ENABLED: '1', DEAL_TRACKER_SECRET: 'deal-tracker-secret-for-tests-only-0123456789' };
  const store = { deleted: [], async del(pathname) { this.deleted.push(pathname); } };
  // Stands in for Postgres: one file past its 30 days, then its row marked deleted.
  const queries = [];
  const sql = async strings => {
    const query = strings.join('?');
    queries.push(query);
    return query.includes('SELECT d.id, d.blob_path') ? [{ id: 7, blob_path: 'deals/x/7.pdf' }] : [{ id: 7 }];
  };
  const documentCleanupWorker = options => runDocumentCleanupWorker({ ...options, store });
  const run = async environment => {
    const res = response();
    await outboxHandler({ environment: { CRON_SECRET: secret, ...environment }, getDatabase: () => sql, documentCleanupWorker })(
      { ...request(), url: '/api/outbox-dispatch?jobs=document_cleanup' }, res);
    return res;
  };

  const off = await run({ BLOB_READ_WRITE_TOKEN: 'vercel_blob_rw_test' });
  assert.equal(off.statusCode, 200);
  assert.deepEqual(Object.keys(off.body.workers), ['document_cleanup']);
  assert.equal(off.body.workers.document_cleanup.configured, false);
  assert.equal((await run(tracker)).body.workers.document_cleanup.configured, false, 'no store set up');
  assert.equal(queries.length, 0);

  const on = await run({ ...tracker, BLOB_READ_WRITE_TOKEN: 'vercel_blob_rw_test' });
  assert.equal(on.statusCode, 200);
  assert.deepEqual(on.body.workers.document_cleanup, { configured: true, deleted: 1, failed: 0, ok: true });
  assert.deepEqual(store.deleted, ['deals/x/7.pdf']);
  assert.doesNotMatch(JSON.stringify(on.body), /vercel_blob_rw_test/);
});

test('?jobs=ops_alerts,buyer_updates, as the 10-minute workflow calls it, runs just those two, and deal_mail is no longer a job', async () => {
  const workflow = await readFile(new URL('../../.github/workflows/ops-alerts.yml', import.meta.url), 'utf8');
  assert.ok(workflow.includes('/api/outbox-dispatch?jobs=ops_alerts,buyer_updates"'));
  assert.doesNotMatch(workflow, /deal_mail/);
  const quiet = async () => ({ configured: true, claimed: 0, sent: 0, failed: 0, exhausted: 0, exitCode: 0 });
  const tracker = { DEAL_TRACKER_ENABLED: '1', DEAL_TRACKER_SECRET: 'deal-tracker-secret-for-tests-only-0123456789' };
  const run = async url => {
    const res = response();
    await outboxHandler({ environment: { CRON_SECRET: secret, ...tracker }, getDatabase: () => ({}), opsAlertWorker: quiet, buyerUpdateWorker: quiet })(
      { ...request(), url }, res);
    return res;
  };

  const ok = await run('/api/outbox-dispatch?jobs=ops_alerts,buyer_updates');
  assert.equal(ok.statusCode, 200);
  assert.deepEqual(Object.keys(ok.body.workers), ['ops_alerts', 'buyer_updates']);
  const old = await run('/api/outbox-dispatch?jobs=ops_alerts,buyer_updates,deal_mail');
  assert.equal(old.statusCode, 400);
  assert.equal(old.body.error, 'unknown_job');
});
