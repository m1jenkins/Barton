import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import { mkdirSync } from 'node:fs';
import { batches, fakePhone, launchAgentPlist, planDealerThreads, planThreads, smrTags, syncTexts, tagNamesBuyer, toDealerPayload, toPayload } from '../imessage-sync.mjs';

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

// dealers: what GET ?texts=dealers answers; null answers 400, as a site
// without Dealer Texts does. Dealer threads land in dealerPosts.
function fakeServer(threads, { listStatus = 200, dealers = [] } = {}) {
  const posts = [];
  const dealerPosts = [];
  const fetchImpl = async (url, options = {}) => {
    assert.equal(options.headers.Authorization, `Bearer ${token}`);
    if (!options.method) {
      if (/\?texts=dealers$/.test(url)) {
        return new Response(JSON.stringify(dealers ? { ok: true, deals: dealers } : { ok: false, error: 'invalid_intake' }), { status: dealers ? 200 : 400 });
      }
      assert.match(url, /\/api\/car-search\?texts=threads$/);
      return new Response(JSON.stringify(listStatus === 200 ? { ok: true, threads } : { ok: false }), { status: listStatus });
    }
    const body = JSON.parse(options.body);
    (body.action === 'dealer_texts' ? dealerPosts : posts).push(body);
    return new Response(JSON.stringify({ ok: true, saved: body.messages.length }), { status: 200 });
  };
  return { fetchImpl, posts, dealerPosts };
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

// Dealer Texts (adr/0005). The rules that matter: a dealer is filed only under
// the one open deal its "SMR:" tag names, a buyer's number is never a dealer,
// and a tag that names no deal or two deals is skipped, never guessed.

const ACE = '1a2b3c4d-1111-4222-8333-444455556666';
const ACE_TWO = '2a2b3c4d-1111-4222-8333-444455556666';
const CHARLES = '3a2b3c4d-1111-4222-8333-444455556666';
const since = '2026-11-24T00:00:00Z';
const deal = (intake_id, buyer_name, buyer_phone, extra = {}) => ({ intake_id, buyer_name, buyer_phone, buyer_email: null, since, dealer_contacts: [], ...extra });
const card = (first, keys, note = '', organization = null) => ({ first, last: null, organization, keys, handles: keys, note });

test('SMR tags are read from any line of Notes, in any case, split on commas and "and"', () => {
  assert.deepEqual(smrTags('Sales manager\nSMR: Ace, Charles'), ['Ace', 'Charles']);
  assert.deepEqual(smrTags('smr:ace and  Jalen Bell; ace'), ['ace', 'Jalen Bell']);
  assert.deepEqual(smrTags('Met at the SMR office\nno tag here'), []);
  assert.deepEqual(smrTags(null), []);
  assert.ok(tagNamesBuyer('Ace', 'Ace Example'));
  assert.ok(tagNamesBuyer('ace example', 'Ace Example'));
  assert.ok(tagNamesBuyer('Jose', 'José Diaz'));
  assert.ok(!tagNamesBuyer('Al', 'Alex Example'), 'a whole word, not the start of one');
  assert.ok(!tagNamesBuyer('', 'Ace Example'));
});

test('a tagged dealer goes under the one deal its tag names; ambiguous, unknown and buyer tags are skipped', () => {
  const deals = [deal(ACE, 'Ace Example', '205-555-0100'), deal(CHARLES, 'Charles Sample', '205-555-0111'),
    deal(ACE_TWO, 'Ace Other', '205-555-0122')];
  const { ready, skipped } = planDealerThreads(deals, [
    card('Ruben · Hamer Toyota', ['5125550177'], 'SMR: Ace Example, Charles'),
    card('Pat · Ford', ['5125550188'], 'SMR: Ace'),
    card('Lee · Kia', ['5125550199'], 'SMR: Nobody'),
    card('Ace Example', ['2055550100'], 'SMR: Ace Example'),
    card('Mom', ['5125550166'])
  ]);
  assert.deepEqual(ready.map((plan) => [plan.intake_id, plan.contact.name, plan.contact.key, plan.contact.how]),
    [[ACE, 'Ruben · Hamer Toyota', '5125550177', 'contact_tag'], [CHARLES, 'Ruben · Hamer Toyota', '5125550177', 'contact_tag']]);
  assert.deepEqual(skipped.map((skip) => [skip.who, skip.reason]), [
    ['Pat · Ford', '"SMR: Ace" matches 2 open deals; add the client\'s last name to the tag'],
    ['Lee · Kia', '"SMR: Nobody" matches no open deal'],
    ['Ace Example', 'has an SMR tag but is an open deal\'s buyer, so it is never synced as a dealer']
  ]);
  assert.ok(!JSON.stringify(ready).includes('5125550166'), 'an untagged, unlisted contact is never read');
});

test('a deal\'s dealer list covers untagged contacts only, and never a buyer\'s number', () => {
  const deals = [deal(ACE, 'Ace Example', '205-555-0100', { dealer_contacts: [
    { key: '5125550188', dealer_name: 'South Honda', contact_name: 'Pat' },
    { key: '5125550177', dealer_name: 'Hamer Toyota', contact_name: null },
    { key: '5125550155', dealer_name: 'West VW', contact_name: 'Jo' },
    { key: '2055550111', dealer_name: 'Mistake', contact_name: null }
  ] }), deal(CHARLES, 'Charles Sample', '205-555-0111')];
  const { ready, skipped } = planDealerThreads(deals, [
    card('Ruben · Hamer Toyota', ['5125550177'], 'SMR: Charles'),
    card('Jo · West VW', ['5125550155'])
  ]);
  assert.deepEqual(ready.map((plan) => [plan.intake_id, plan.contact.key, plan.contact.name, plan.contact.how]), [
    [CHARLES, '5125550177', 'Ruben · Hamer Toyota', 'contact_tag'],
    [ACE, '5125550188', 'Pat · South Honda', 'dealer_list'],
    [ACE, '5125550155', 'Jo · West VW', 'dealer_list']
  ], 'the tag wins over the list; a listed number takes its Contacts name');
  assert.deepEqual(skipped.map((skip) => skip.reason), ['is on a dealer list but is an open deal\'s buyer']);
});

function contactsFixture(dir, rows) {
  const folder = join(dir, 'Library/Application Support/AddressBook');
  mkdirSync(folder, { recursive: true });
  const db = new DatabaseSync(join(folder, 'AddressBook-v22.abcddb'));
  db.exec(`
    CREATE TABLE ZABCDRECORD (Z_PK INTEGER PRIMARY KEY, ZFIRSTNAME TEXT, ZMIDDLENAME TEXT, ZLASTNAME TEXT, ZNICKNAME TEXT, ZORGANIZATION TEXT);
    CREATE TABLE ZABCDPHONENUMBER (ZOWNER INTEGER, ZFULLNUMBER TEXT);
    CREATE TABLE ZABCDEMAILADDRESS (ZOWNER INTEGER, ZADDRESS TEXT);
    CREATE TABLE ZABCDNOTE (Z_PK INTEGER PRIMARY KEY, ZCONTACT INTEGER, ZTEXT TEXT);
  `);
  rows.forEach(([first, phone, note], index) => {
    db.prepare('INSERT INTO ZABCDRECORD (Z_PK, ZFIRSTNAME) VALUES (?, ?)').run(index + 1, first);
    db.prepare('INSERT INTO ZABCDPHONENUMBER VALUES (?, ?)').run(index + 1, phone);
    if (note) db.prepare('INSERT INTO ZABCDNOTE (ZCONTACT, ZTEXT) VALUES (?, ?)').run(index + 1, note);
  });
  db.close();
}

test('a sync sends the tagged dealer\'s thread as dealer texts, and nothing from untagged contacts', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'imessage-sync-'));
  try {
    const chatDb = chatFixture(dir);
    // chatFixture's second thread (+1 512 555 0199) becomes a dealer here.
    contactsFixture(dir, [['Sam · North Toyota', '(512) 555-0199', 'SMR: Riley'], ['Riley Buyer', '(205) 555-0100', null]]);
    const threads = [{ intake_id: BUYER, phone: '(205) 555-0100', email: null, since: '2026-11-24T00:00:00Z' }];
    const dealers = [{ intake_id: BUYER, buyer_name: 'Riley Buyer', buyer_phone: '(205) 555-0100', buyer_email: null, since: '2026-11-24T00:00:00Z', dealer_contacts: [] }];
    const { fetchImpl, posts, dealerPosts } = fakeServer(threads, { dealers });
    const summary = await syncTexts({ environment, fetchImpl, chatDb, home: dir, log: () => {} });
    assert.equal(posts.length, 1, 'the Buyer Texts sync is unchanged');
    assert.equal(dealerPosts.length, 1);
    assert.deepEqual(dealerPosts[0].contact, { key: '5125550199', name: 'Sam · North Toyota', how: 'contact_tag' });
    assert.deepEqual(dealerPosts[0].messages.map((m) => [m.guid, m.from_dealer, 'from_buyer' in m]), [['FRIEND-1', true, false]]);
    assert.deepEqual([summary.dealer.dealers, summary.dealer.texts, summary.dealer.failed], [1, 1, []]);
    assert.ok(!JSON.stringify(dealerPosts).includes('Any quotes yet'), 'the buyer\'s own thread never goes as a dealer');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('a site without Dealer Texts, or a Mac without Contacts, still syncs Buyer Texts', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'imessage-sync-'));
  try {
    const chatDb = chatFixture(dir);
    const lines = [];
    const threads = [{ intake_id: BUYER, phone: '(205) 555-0100', email: null, since: '2026-11-24T00:00:00Z' }];
    const old = fakeServer(threads, { dealers: null });
    const summary = await syncTexts({ environment, fetchImpl: old.fetchImpl, chatDb, home: dir, log: (line) => lines.push(line) });
    assert.deepEqual([summary.texts, old.posts.length, old.dealerPosts.length], [3, 1, 0]);
    assert.match(lines.join('\n'), /dealer texts skipped: .*HTTP 400/);
    assert.deepEqual(summary.dealer.failed, []);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('a dealer payload says from_dealer, never from_buyer', () => {
  const payload = toDealerPayload({ guid: 'G', date: new Date('2026-12-01T12:00:00Z'), fromMe: false, text: 'hi', service: 'SMS', unsent: false, edited: false, attachments: [] });
  assert.equal(payload.from_dealer, true);
  assert.ok(!('from_buyer' in payload));
  assert.equal(toDealerPayload({ guid: null }), null);
});
