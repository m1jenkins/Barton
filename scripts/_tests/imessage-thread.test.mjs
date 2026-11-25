import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import {
  appleDate, contactDatabases, decodeAttributedBody, formatThread, handleKey, isReaction, loadContacts,
  looksLikeHandle, nameMatches, parseArgs, readThread, usefulAttachments
} from '../imessage-thread.mjs';

// Made-up people and numbers only: this repository is public.

function typedstream(text, lengthPrefix) {
  const body = Buffer.from(text, 'utf8');
  return Buffer.concat([
    Buffer.from([0x04, 0x0b]), Buffer.from('streamtyped'), Buffer.from([0x81, 0xe8, 0x03, 0x84, 0x01, 0x40, 0x84, 0x84, 0x84]),
    Buffer.from('NSString'), Buffer.from([0x01, 0x94, 0x84, 0x01, 0x2b]), lengthPrefix(body.length), body,
    Buffer.from([0x86, 0x84, 0x02, 0x69, 0x49])
  ]);
}

const oneByte = (n) => Buffer.from([n]);
const twoBytes = (n) => { const b = Buffer.alloc(3); b[0] = 0x81; b.writeUInt16LE(n, 1); return b; };

// Nanoseconds since 2001-01-01, as current macOS stores message.date.
const appleNanos = (iso) => BigInt(Date.parse(iso) / 1000 - 978307200) * 1000000000n;

test('attributedBody text decodes for short, long and non-ASCII messages', () => {
  assert.equal(decodeAttributedBody(typedstream('See you at 3', oneByte)), 'See you at 3');
  const long = 'The out-the-door number is $31,250. '.repeat(10);
  assert.equal(decodeAttributedBody(typedstream(long, twoBytes)), long);
  assert.equal(decodeAttributedBody(typedstream('Sounds good — thanks “Pat” 👍', oneByte)), 'Sounds good — thanks “Pat” 👍');
  assert.equal(decodeAttributedBody(null), null);
  assert.equal(decodeAttributedBody(Buffer.from('no string here')), null);
});

test('one phone number in any format gives one key; emails are lowercased', () => {
  for (const value of ['+15125550142', '(512) 555-0142', '512.555.0142', '15125550142']) assert.equal(handleKey(value), '5125550142');
  assert.equal(handleKey('Pat@Example.com'), 'pat@example.com');
  assert.equal(handleKey('555-0142'), null);
  assert.ok(looksLikeHandle('512 555 0142'));
  assert.ok(looksLikeHandle('pat@example.com'));
  assert.ok(!looksLikeHandle('Pat Example RAV4'));
});

test('a name matches when every word appears in the contact', () => {
  const contact = { first: 'Pat', last: 'Example RAV4', organization: null };
  assert.ok(nameMatches(contact, 'pat rav4'));
  assert.ok(!nameMatches(contact, 'pat civic'));
  assert.ok(!nameMatches(contact, '   '));
});

test('dates, tapbacks and arguments', () => {
  assert.equal(appleDate(Number(appleNanos('2026-11-20T15:00:00Z'))).toISOString(), '2026-11-20T15:00:00.000Z');
  assert.equal(appleDate(Date.parse('2010-01-01T00:00:00Z') / 1000 - 978307200).toISOString(), '2010-01-01T00:00:00.000Z');
  assert.ok(isReaction(2001) && isReaction(3000) && !isReaction(0) && !isReaction(1000));
  assert.deepEqual(parseArgs(['Pat', 'Example', '--last', '5']).query, 'Pat Example');
  assert.throws(() => parseArgs(['--since', 'yesterday', 'Pat']), /--since/);
  assert.throws(() => parseArgs([]), /contact name/);
});

test('link previews drop and a photo listed twice shows once, from disk', () => {
  const kept = usefulAttachments([
    { path: '/a/x.pluginPayloadAttachment', name: null, onDisk: true },
    { path: null, name: 'IMG_1.jpg', onDisk: false },
    { path: '/a/IMG_1.jpg', name: 'IMG_1.jpg', onDisk: true }
  ]);
  assert.deepEqual(kept.map((file) => file.path), ['/a/IMG_1.jpg']);
});

function messagesFixture(dir) {
  const file = join(dir, 'chat.db');
  const db = new DatabaseSync(file);
  db.exec(`
    CREATE TABLE handle (ROWID INTEGER PRIMARY KEY, id TEXT);
    CREATE TABLE chat (ROWID INTEGER PRIMARY KEY);
    CREATE TABLE chat_handle_join (chat_id INTEGER, handle_id INTEGER);
    CREATE TABLE chat_message_join (chat_id INTEGER, message_id INTEGER);
    CREATE TABLE message (ROWID INTEGER PRIMARY KEY, guid TEXT, date INTEGER, is_from_me INTEGER, text TEXT, attributedBody BLOB,
      service TEXT, associated_message_type INTEGER DEFAULT 0, date_retracted INTEGER DEFAULT 0,
      date_edited INTEGER DEFAULT 0, item_type INTEGER DEFAULT 0, handle_id INTEGER);
    CREATE TABLE attachment (ROWID INTEGER PRIMARY KEY, filename TEXT, mime_type TEXT, transfer_name TEXT);
    CREATE TABLE message_attachment_join (message_id INTEGER, attachment_id INTEGER);
    INSERT INTO handle VALUES (1, '+15125550142'), (2, '5125550142'), (3, '+15125550199');
    INSERT INTO chat VALUES (10), (11), (12);
    INSERT INTO chat_handle_join VALUES (10, 1), (11, 2), (12, 1), (12, 3);
  `);
  const insert = db.prepare(`INSERT INTO message (ROWID, guid, date, is_from_me, text, attributedBody, service,
    associated_message_type, date_retracted, date_edited, item_type, handle_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  const link = db.prepare('INSERT INTO chat_message_join VALUES (?, ?)');
  const rows = [
    [101, '2026-11-20T15:00:00Z', 0, 'Any numbers yet?', null, 'iMessage', 0, 0, 0, 0, 1, 10],
    [102, '2026-11-20T15:05:00Z', 1, null, typedstream('Two quotes in, best is $31,250', oneByte), 'iMessage', 0, 0, 0, 0, 0, 10],
    [103, '2026-11-20T15:06:00Z', 0, 'Liked “Two quotes in”', null, 'iMessage', 2001, 0, 0, 0, 1, 10],
    [104, '2026-11-21T09:00:00Z', 0, 'Sent the insurance card', null, 'SMS', 0, 0, 0, 0, 2, 11],
    [105, '2026-11-21T09:30:00Z', 1, 'wrong thread', null, 'SMS', 0, 1, 0, 0, 2, 11],
    [106, '2026-11-21T10:00:00Z', 0, 'group chat hello', null, 'iMessage', 0, 0, 0, 0, 1, 12],
    [107, '2026-11-21T10:01:00Z', 0, null, null, 'iMessage', 0, 0, 0, 1, 1, 10]
  ];
  for (const [id, iso, fromMe, text, body, service, type, retracted, edited, itemType, handle, chat] of rows) {
    insert.run(id, `GUID-${id}`, appleNanos(iso), fromMe, text, body, service, type, retracted, edited, itemType, handle);
    link.run(chat, id);
  }
  db.exec(`INSERT INTO attachment VALUES (1, '~/Library/Messages/Attachments/ab/IMG_1.jpg', 'image/jpeg', 'IMG_1.jpg');
    INSERT INTO message_attachment_join VALUES (104, 1);`);
  db.close();
  return file;
}

test('a thread joins every handle for the number, keeps sent texts, and leaves out groups, tapbacks and events', () => {
  const dir = mkdtempSync(join(tmpdir(), 'imessage-thread-'));
  try {
    const chatDb = messagesFixture(dir);
    mkdirSync(join(dir, 'Library/Messages/Attachments/ab'), { recursive: true });
    writeFileSync(join(dir, 'Library/Messages/Attachments/ab/IMG_1.jpg'), 'jpg');

    const thread = readThread(chatDb, ['5125550142'], { home: dir });
    assert.equal(thread.handles, 2);
    assert.deepEqual(thread.messages.map((m) => m.text),
      ['Any numbers yet?', 'Two quotes in, best is $31,250', 'Sent the insurance card', 'wrong thread']);
    assert.equal(thread.messages[1].fromMe, true);
    assert.equal(thread.messages[3].unsent, true);
    assert.deepEqual(thread.messages[2].attachments,
      [{ path: join(dir, 'Library/Messages/Attachments/ab/IMG_1.jpg'), mime: 'image/jpeg', name: 'IMG_1.jpg', onDisk: true }]);

    assert.equal(readThread(chatDb, ['5125550142'], { reactions: true, home: dir }).messages.length, 5);
    assert.equal(readThread(chatDb, ['5125550142'], { since: new Date('2026-11-21T00:00:00Z'), home: dir }).messages.length, 2);
    assert.deepEqual(readThread(chatDb, ['9995550100'], { home: dir }), { handles: 0, messages: [] });

    const out = formatThread({ name: 'Pat Example', handles: ['+15125550142'], messages: thread.messages.slice(-2), total: 4 });
    assert.match(out, /^Texts with Pat Example \(\+15125550142\): last 2 of 4 messages/);
    assert.match(out, /Pat Example: Sent the insurance card\n {4}attachment: .*IMG_1\.jpg \(image\/jpeg\)/);
    assert.match(out, /Mason: \[unsent\]$/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('contacts load from every Contacts source with their numbers', () => {
  const dir = mkdtempSync(join(tmpdir(), 'imessage-contacts-'));
  try {
    mkdirSync(join(dir, 'Sources/ABC'), { recursive: true });
    for (const file of [join(dir, 'AddressBook-v22.abcddb'), join(dir, 'Sources/ABC/AddressBook-v22.abcddb')]) {
      const db = new DatabaseSync(file);
      db.exec(`CREATE TABLE ZABCDRECORD (Z_PK INTEGER PRIMARY KEY, ZFIRSTNAME TEXT, ZMIDDLENAME TEXT, ZLASTNAME TEXT, ZNICKNAME TEXT, ZORGANIZATION TEXT);
        CREATE TABLE ZABCDPHONENUMBER (ZOWNER INTEGER, ZFULLNUMBER TEXT);
        CREATE TABLE ZABCDEMAILADDRESS (ZOWNER INTEGER, ZADDRESS TEXT);`);
      if (file.includes('Sources')) {
        db.exec(`INSERT INTO ZABCDRECORD VALUES (1, 'Pat', NULL, 'Example RAV4', NULL, NULL), (2, 'No', NULL, 'Number', NULL, NULL);
          INSERT INTO ZABCDPHONENUMBER VALUES (1, '(512) 555-0142');
          INSERT INTO ZABCDEMAILADDRESS VALUES (1, 'pat@example.com');`);
      }
      db.close();
    }
    const databases = contactDatabases(dir);
    assert.equal(databases.length, 2);
    const contacts = loadContacts(databases);
    assert.equal(contacts.length, 1);
    assert.deepEqual(contacts[0].keys.sort(), ['5125550142', 'pat@example.com']);
    assert.ok(nameMatches(contacts[0], 'Pat RAV4'));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
