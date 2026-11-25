import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import { batches, fakePhone, launchAgentPlist, planThreads, syncTexts, toPayload } from '../imessage-sync.mjs';

// The Mac side of Buyer Texts (adr/0004). The rule that matters: only threads
// the server lists, from their start date, ever leave the Mac. Invented data only.

const appleNanos = (iso) => BigInt(Date.parse(iso) / 1000 - 978307200) * 1000000000n;
const token = 'car-search-token-for-tests-only-0123456789';
const BUYER = '0a1b2c3d-1111-4222-8333-444455556666';

function chatFixture(dir) {
  const file = join(dir, 'chat.db');
  const db = new DatabaseSync(file);
  db.exec(`
    CREATE TABLE handle (ROWID INTEGER PRIMARY KEY, id TEXT);
    CREATE TABLE chat_handle_join (chat_id INTEGER, handle_id INTEGER);
    CREATE TABLE chat_message_join (chat_id INTEGER, message_id INTEGER);
    CREATE TABLE message (ROWID INTEGER PRIMARY KEY, guid TEXT, date INTEGER, is_from_me INTEGER, text TEXT, attributedBody BLOB,
      service TEXT, associated_message_type INTEGER DEFAULT 0, date_retracted INTEGER DEFAULT 0, date_edited INTEGER DEFAULT 0,
      item_type INTEGER DEFAULT 0);
    CREATE TABLE attachment (ROWID INTEGER PRIMARY KEY, filename TEXT, mime_type TEXT, transfer_name TEXT);
    CREATE TABLE message_attachment_join (message_id INTEGER, attachment_id INTEGER);
    INSERT INTO handle VALUES (1, '+12055550100'), (2, '+15125550199');
    INSERT INTO chat_handle_join VALUES (10, 1), (20, 2);
  `);
  const insert = db.prepare(`INSERT INTO message (ROWID, guid, date, is_from_me, text, service, date_retracted)
    VALUES (?, ?, ?, ?, ?, 'RCS', ?)`);
  const link = db.prepare('INSERT INTO chat_message_join VALUES (?, ?)');
  const rows = [
    [1, 'OLD-1', '2026-10-01T12:00:00Z', 0, 'old personal chat', 0, 10],
    [2, 'BUY-1', '2026-12-01T12:00:00Z', 0, 'Any quotes yet?', 0, 10],
    [3, 'BUY-2', '2026-12-01T12:05:00Z', 1, 'Two so far', 0, 10],
    [4, 'BUY-3', '2026-12-01T12:06:00Z', 1, 'typo', 1, 10],
    [5, 'FRIEND-1', '2026-12-01T13:00:00Z', 0, 'dinner tonight?', 0, 20]
  ];
  for (const [id, guid, iso, fromMe, text, retracted, chat] of rows) {
    insert.run(id, guid, appleNanos(iso), fromMe, text, retracted);
    link.run(chat, id);
  }
  db.close();
  return file;
}

function fakeServer(threads, { listStatus = 200 } = {}) {
  const posts = [];
  const fetchImpl = async (url, options = {}) => {
    assert.equal(options.headers.Authorization, `Bearer ${token}`);
    if (!options.method) {
      assert.match(url, /\/api\/car-search\?texts=threads$/);
      return new Response(JSON.stringify(listStatus === 200 ? { ok: true, threads } : { ok: false }), { status: listStatus });
    }
    const body = JSON.parse(options.body);
    posts.push(body);
    return new Response(JSON.stringify({ ok: true, saved: body.messages.length }), { status: 200 });
  };
  return { fetchImpl, posts };
}

const environment = { CAR_SEARCH_TOKEN: token, CAR_SEARCH_URL: 'https://example.test' };

test('only the listed buyer\'s thread, from its start date, is sent; unsent texts go without words', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'imessage-sync-'));
  try {
    const chatDb = chatFixture(dir);
    const { fetchImpl, posts } = fakeServer([{ intake_id: BUYER, phone: '(205) 555-0100', email: null, since: '2026-11-24T00:00:00Z' }]);
    const summary = await syncTexts({ environment, fetchImpl, chatDb, home: dir, log: () => {} });
    assert.deepEqual([summary.deals, summary.texts, summary.failed], [1, 3, []]);
    assert.equal(posts.length, 1);
    assert.deepEqual(posts[0].messages.map((m) => [m.guid, m.from_buyer, m.body, m.unsent]),
      [['BUY-1', true, 'Any quotes yet?', false], ['BUY-2', false, 'Two so far', false], ['BUY-3', false, '', true]]);
    const sent = JSON.stringify(posts);
    assert.ok(!sent.includes('dinner tonight') && !sent.includes('old personal chat'), 'nothing outside the listed thread and window');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('a dry run and a failed listing send nothing', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'imessage-sync-'));
  try {
    const chatDb = chatFixture(dir);
    const lines = [];
    const dry = fakeServer([{ intake_id: BUYER, phone: '205-555-0100', email: null, since: '2026-11-24T00:00:00Z' }]);
    const summary = await syncTexts({ environment, fetchImpl: dry.fetchImpl, chatDb, home: dir, dryRun: true, log: (line) => lines.push(line) });
    assert.equal(dry.posts.length, 0);
    assert.equal(summary.texts, 3);
    assert.match(lines[0], /^0a1b2c3d {2}2055550100 {2}3 texts since 2026-11-24/);
    assert.ok(!lines.join('\n').includes('Any quotes'), 'the dry run shows counts, never words');

    const down = fakeServer([], { listStatus: 500 });
    await assert.rejects(syncTexts({ environment, fetchImpl: down.fetchImpl, chatDb, home: dir, log: () => {} }), /nothing was sent/);
    assert.equal(down.posts.length, 0);
    await assert.rejects(syncTexts({ environment: {}, fetchImpl: down.fetchImpl, chatDb, home: dir }), /CAR_SEARCH_TOKEN/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('a number two open deals share, or a short phone, is skipped', () => {
  const since = '2026-11-24T00:00:00Z';
  const { ready, skipped } = planThreads([
    { intake_id: 'a', phone: '205-555-0100', email: 'shared@example.test', since },
    { intake_id: 'b', phone: '+1 205 555 0100', email: null, since },
    { intake_id: 'c', phone: '555-0100', email: null, since },
    { intake_id: 'd', phone: '512-555-0142', email: 'shared@example.test', since }
  ]);
  assert.deepEqual(ready.map((plan) => [plan.intake_id, plan.keys]), [['d', ['5125550142']]]);
  assert.deepEqual(skipped.map((skip) => skip.intake_id), ['a', 'b', 'c']);
});

test('fake phone numbers are ignored, and the intake\'s email still matches', () => {
  for (const fake of ['0000000000', '9999999999', '1235550100', '2051550100']) assert.ok(fakePhone(fake), fake);
  for (const real of ['2055550100', '5125550142', 'pat@example.test', null]) assert.ok(!fakePhone(real), real);
  const since = '2026-11-24T00:00:00Z';
  const { ready, skipped } = planThreads([
    { intake_id: 'a', phone: '000-000-0000', email: 'pat@example.test', since },
    { intake_id: 'b', phone: '0000000000', email: null, since },
    { intake_id: 'c', phone: '000-000-0000', email: null, since }
  ]);
  assert.deepEqual(ready.map((plan) => [plan.intake_id, plan.keys]), [['a', ['pat@example.test']]]);
  assert.deepEqual(skipped.map((skip) => [skip.intake_id, skip.reason]),
    [['b', 'has no usable phone or email'], ['c', 'has no usable phone or email']], 'two fake numbers are not a shared number');
});

test('payloads and batches stay inside the endpoint\'s limits', () => {
  assert.equal(toPayload({ guid: null, date: new Date() }), null);
  const long = toPayload({ guid: 'G', date: new Date('2026-12-01T12:00:00Z'), fromMe: false, text: 'x'.repeat(25000),
    service: 'iMessage', unsent: false, edited: false, attachments: [{ path: '/a/IMG_1.jpg', mime: 'image/jpeg', name: null }] });
  assert.equal(long.body.length, 20000);
  assert.deepEqual(long.attachments, [{ name: 'IMG_1.jpg', mime: 'image/jpeg' }]);

  const messages = Array.from({ length: 30 }, (_, n) => ({ guid: `G-${n}`, body: 'y'.repeat(9000) }));
  const split = batches(messages, { maxBytes: 50000 });
  assert.ok(split.length > 1 && split.every((batch) => Buffer.byteLength(JSON.stringify(batch)) < 50000));
  assert.equal(split.flat().length, 30);
  assert.deepEqual(batches([]), [[]], 'an empty thread still posts once, to record the sync');
  assert.equal(batches(Array.from({ length: 1200 }, (_, n) => ({ guid: `G-${n}` }))).length, 3);
});

test('the LaunchAgent runs this script with the given Node every 10 minutes', () => {
  const plist = launchAgentPlist({ node: '/opt/node/bin/node', script: '/repo/scripts/imessage-sync.mjs', workingDirectory: '/repo', logFile: '/logs/sync.log' });
  assert.match(plist, /<string>\/opt\/node\/bin\/node<\/string><string>\/repo\/scripts\/imessage-sync\.mjs<\/string>/);
  assert.match(plist, /<key>StartInterval<\/key><integer>600<\/integer>/);
});
