import test from 'node:test';
import assert from 'node:assert/strict';
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
