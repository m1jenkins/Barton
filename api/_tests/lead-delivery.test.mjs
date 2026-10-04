import test from 'node:test';
import assert from 'node:assert/strict';
import { leadHandler, leadRequestHash } from '../leads.js';
import { withApiErrors } from '../_lib/http.js';

const leadId = '06a28d37-b5d9-4f0e-a20c-c8e506ef5477';
const payload = { name: 'Buyer', email: 'buyer@example.test', vehicle: 'Mazda CX-5', source_page: '/schedule.html' };

function leadDatabase({ prior = false, failure = 'claim' } = {}) {
  let committed = prior;
  const record = { id: leadId, request_hash: leadRequestHash(payload), ...payload };
  const sql = async (strings) => {
    const query = strings.join('?');
    if (query.includes('FROM leads WHERE idempotency_key')) return prior ? [record] : [];
    if (query.includes('INSERT INTO leads')) return [record];
    if (query.includes('INSERT INTO lead_forward_outbox')) return [];
    if (query.includes("SET status = 'processing'")) {
      if (failure === 'claim') throw new Error('Outbox database unavailable');
      return [{ lead_id: leadId, attempts: 1, ...record }];
    }
    if (query.includes("SET status = 'failed'")) throw new Error('Failure acknowledgement unavailable');
    throw new Error(`Unexpected SQL: ${query}`);
  };
  sql.json = value => value;
  sql.begin = async fn => { const result = await fn(sql); committed = true; return result; };
  return { sql, committed: () => committed };
}

async function submit(sql) {
  const req = { method: 'POST', headers: { origin: 'https://www.driverightcarbuying.com', 'content-type': 'application/json', 'idempotency-key': 'lead:test-0001' }, body: payload };
  const res = { setHeader() {}, end(value) { this.body = JSON.parse(value); } };
  await withApiErrors(leadHandler({ getDatabase: () => sql, verifyToken: async () => false, notify() {} }))(req, res);
  return res;
}

for (const prior of [false, true]) {
  for (const failure of ['claim', 'acknowledge']) {
    test(`${prior ? 'a retried' : 'a newly committed'} lead still succeeds when forwarding cannot ${failure}`, async t => {
      const environment = { APP_ORIGIN: 'https://www.driverightcarbuying.com', ALLOWED_ORIGINS: '', LEAD_FORWARD_URL: 'https://notifications.example.test/leads' };
      const previous = Object.fromEntries(Object.keys(environment).map(key => [key, process.env[key]]));
      Object.assign(process.env, environment);
      t.after(() => { for (const [key, value] of Object.entries(previous)) value === undefined ? delete process.env[key] : process.env[key] = value; });
      t.mock.method(console, 'error', () => {});
      t.mock.method(globalThis, 'fetch', async () => { throw new Error('Network unavailable'); });
      const db = leadDatabase({ prior, failure });
      const res = await submit(db.sql);
      assert.equal(db.committed(), true);
      assert.equal(res.statusCode, prior ? 200 : 201, 'notification failures must not change a saved lead into a failed submission');
      assert.equal(res.body.lead_id, leadId);
      assert.equal(res.body.forwarding_configured, true);
      assert.equal(res.body.email, undefined);
    });
  }
}
