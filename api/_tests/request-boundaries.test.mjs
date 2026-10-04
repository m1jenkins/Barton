import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { ConfigError, integerEnv } from '../_lib/config.js';
import { HttpError, readJsonBody } from '../_lib/http.js';

const source = await readFile(new URL('../../script.js', import.meta.url), 'utf8');

function client(fetch) {
  const timers = new Map();
  let nextTimer = 0;
  const window = {
    location: new URL('https://www.driverightcarbuying.com/'),
    navigator: {}, crypto, addEventListener() {}, dataLayer: [],
    setTimeout(callback) { timers.set(++nextTimer, callback); return nextTimer; },
    clearTimeout(id) { timers.delete(id); }
  };
  const document = { referrer: '', body: { dataset: {} }, getElementById: () => null, querySelectorAll: () => [] };
  vm.runInNewContext(source, { window, document, URL, URLSearchParams, Date, Set, console, crypto, AbortController, fetch });
  return { request: window.driveRightClient.requestJson, timers };
}

test('the request timeout remains active while the response body is downloading', async () => {
  let readingBody;
  const bodyStarted = new Promise(resolve => { readingBody = resolve; });
  const page = client(async (url, { signal }) => ({
    ok: true,
    json: () => new Promise((resolve, reject) => {
      signal.addEventListener('abort', () => reject(signal.reason), { once: true });
      readingBody();
    })
  }));
  const result = page.request('/api/leads');
  await bodyStarted;
  assert.equal(page.timers.size, 1, 'a stalled body must not leave the form waiting forever');
  page.timers.values().next().value();
  await assert.rejects(result, error => error.code === 'request_timeout' && /try again/i.test(error.message));
  assert.equal(page.timers.size, 0);
});

test('successful and malformed responses both release the request timeout', async () => {
  for (const valid of [true, false]) {
    const page = client(async () => ({ ok: true, status: 200, json: async () => valid ? { ok: true, lead_id: 'saved' } : Promise.reject(new SyntaxError('Invalid JSON')) }));
    if (valid) assert.equal((await page.request('/api/leads')).lead_id, 'saved');
    else await assert.rejects(page.request('/api/leads'));
    assert.equal(page.timers.size, 0);
  }
});

test('raw and platform-parsed JSON arrays are both rejected as invalid JSON objects', async () => {
  for (const parsed of [false, true]) {
    const req = parsed ? { body: [] } : Readable.from(['[]']);
    req.headers = { 'content-type': 'application/json' };
    await assert.rejects(readJsonBody(req), error => error instanceof HttpError && error.status === 400 && error.code === 'invalid_json');
  }
});

test('integer configuration rejects fractional and partially numeric settings', () => {
  for (const raw of ['2.5', '2connections', '1e2', '0x2', 'NaN', 'Infinity']) {
    assert.throws(() => integerEnv('DATABASE_MAX_CONNECTIONS', 1, { min: 1, max: 5 }, { DATABASE_MAX_CONNECTIONS: raw }), ConfigError, raw);
  }
  assert.equal(integerEnv('LIMIT', 1, { min: 1, max: 5 }, { LIMIT: ' 3 ' }), 3);
  assert.equal(integerEnv('LIMIT', 1, { min: 1, max: 5 }, {}), 1);
});
