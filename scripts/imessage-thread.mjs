#!/usr/bin/env node
// Prints Mason's one-to-one text thread with a person, read straight from this
// Mac's Messages database (iMessage, RCS and SMS synced from his iPhone).
//
//   node scripts/imessage-thread.mjs "<contact name>" [--since YYYY-MM-DD] [--last N] [--reactions]
//   node scripts/imessage-thread.mjs <phone number or email> [...]
//
// Read-only and local: it opens ~/Library/Messages/chat.db and the Contacts
// databases read-only and prints to stdout. Nothing is stored or sent anywhere.
// It needs macOS Full Disk Access for the program running it (in the Claude
// desktop app, the bundled Claude Code binary, not Claude.app itself).
// Group chats are left out. Attachments print as local file paths to open.

import { existsSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { pathToFileURL } from 'node:url';

const APPLE_EPOCH_SECONDS = 978307200; // 2001-01-01T00:00:00Z

// A phone number's last ten digits, so +1 (814) 555-0100, 8145550100 and the
// SMS, RCS and iMessage handles for one number all match. Emails lowercased.
export function handleKey(value) {
  const text = String(value ?? '').trim();
  if (!text) return null;
  if (text.includes('@')) return text.toLowerCase();
  const digits = text.replace(/\D/g, '');
  return digits.length >= 10 ? digits.slice(-10) : null;
}

export function looksLikeHandle(query) {
  const text = String(query).trim();
  return text.includes('@') || (!/[a-z]/i.test(text) && text.replace(/\D/g, '').length >= 10);
}

// Every word of the query must appear somewhere in the contact's name fields.
export function nameMatches(contact, query) {
  const haystack = [contact.first, contact.middle, contact.last, contact.nickname, contact.organization]
    .filter(Boolean).join(' ').toLowerCase();
  const words = String(query).toLowerCase().split(/\s+/).filter(Boolean);
  return words.length > 0 && words.every((word) => haystack.includes(word));
}

export function contactName(contact) {
  return [contact.first, contact.last].filter(Boolean).join(' ') || contact.organization || contact.nickname || '(no name)';
}

// Newer macOS versions leave message.text empty and keep the text in
// attributedBody, an NSAttributedString in Apple's typedstream format. The
// string follows the "NSString" class name and a "+" marker, prefixed by its
// length in bytes: one byte, or 0x81 + two bytes, or 0x82 + four bytes.
export function decodeAttributedBody(blob) {
  if (!blob) return null;
  const bytes = Buffer.from(blob);
  const classAt = bytes.indexOf('NSString');
  if (classAt < 0) return null;
  const markerAt = bytes.indexOf(0x2b, classAt + 8);
  if (markerAt < 0) return null;
  let at = markerAt + 1;
  let length = bytes[at];
  if (length === 0x81) { length = bytes.readUInt16LE(at + 1); at += 3; }
  else if (length === 0x82) { length = bytes.readUInt32LE(at + 1); at += 5; }
  else at += 1;
  if (length === undefined || at + length > bytes.length) return null;
  return bytes.subarray(at, at + length).toString('utf8');
}

// message.date is nanoseconds since 2001 on current macOS, seconds on old rows.
export function appleDate(value) {
  const number = Number(value);
  if (!number) return null;
  const seconds = Math.abs(number) > 1e12 ? number / 1e9 : number;
  return new Date((seconds + APPLE_EPOCH_SECONDS) * 1000);
}

// Tapbacks ("Liked …") and their removals are stored as messages of their own.
export function isReaction(associatedMessageType) {
  const type = Number(associatedMessageType) || 0;
  return type >= 2000 && type < 4000;
}

function localStamp(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function expandHome(path, home) {
  return path && path.startsWith('~/') ? join(home, path.slice(2)) : path;
}

export function contactDatabases(addressBookDir) {
  const found = [];
  const root = join(addressBookDir, 'AddressBook-v22.abcddb');
  if (existsSync(root)) found.push(root);
  const sources = join(addressBookDir, 'Sources');
  if (existsSync(sources)) {
    for (const entry of readdirSync(sources, { withFileTypes: true })) {
      const file = join(sources, entry.name, 'AddressBook-v22.abcddb');
      if (entry.isDirectory() && existsSync(file)) found.push(file);
    }
  }
  return found;
}

// Every contact with its phone numbers and emails, merged across Contacts sources.
export function loadContacts(databases) {
  const contacts = new Map();
  for (const file of databases) {
    const db = new DatabaseSync(file, { readOnly: true });
    try {
      const records = db.prepare(`SELECT Z_PK AS id, ZFIRSTNAME AS first, ZMIDDLENAME AS middle, ZLASTNAME AS last,
        ZNICKNAME AS nickname, ZORGANIZATION AS organization FROM ZABCDRECORD`).all();
      const handles = new Map();
      for (const row of db.prepare('SELECT ZOWNER AS owner, ZFULLNUMBER AS value FROM ZABCDPHONENUMBER').all()
        .concat(db.prepare('SELECT ZOWNER AS owner, ZADDRESS AS value FROM ZABCDEMAILADDRESS').all())) {
        const key = handleKey(row.value);
        if (!key) continue;
        if (!handles.has(row.owner)) handles.set(row.owner, new Map());
        handles.get(row.owner).set(key, row.value);
      }
      for (const record of records) {
        const own = handles.get(record.id);
        if (!own) continue;
        const contact = { first: record.first, middle: record.middle, last: record.last, nickname: record.nickname, organization: record.organization };
        const identity = `${contactName(contact)}|${[...own.keys()].sort().join(',')}`;
        if (!contacts.has(identity)) contacts.set(identity, { ...contact, handles: [...own.values()], keys: [...own.keys()] });
      }
    } finally {
      db.close();
    }
  }
  return [...contacts.values()];
}

// Link previews are stored as .pluginPayloadAttachment files: the link is in
// the text already. RCS often lists a photo twice, once without a local file;
// keep one row per file name, preferring the copy on disk.
export function usefulAttachments(files) {
  const kept = new Map();
  for (const file of files) {
    if (/\.pluginPayloadAttachment$/i.test(file.path || file.name || '')) continue;
    const name = (file.name || (file.path || '').split('/').pop() || '').replace(/\.heic\.jpeg$/i, '.heic').toLowerCase();
    const key = name || `#${kept.size}`;
    const seen = kept.get(key);
    if (!seen || (file.onDisk && !seen.onDisk)) kept.set(key, file);
  }
  return [...kept.values()];
}

// The one-to-one thread for a set of handle keys, oldest first. Messages are
// found through their chat, not message.handle_id, so sent messages with no
// handle still show and the person's group-chat messages don't.
export function readThread(chatDbPath, keys, { since = null, reactions = false, home = homedir() } = {}) {
  const db = new DatabaseSync(chatDbPath, { readOnly: true });
  try {
    const wanted = new Set(keys);
    const handleIds = db.prepare('SELECT ROWID AS id, id AS value FROM handle').all()
      .filter((row) => wanted.has(handleKey(row.value))).map((row) => row.id);
    if (!handleIds.length) return { handles: 0, messages: [] };
    const rows = db.prepare(`
      SELECT DISTINCT m.ROWID AS id, m.guid, CAST(m.date AS REAL) AS date, m.is_from_me AS fromMe, m.text, m.attributedBody AS body,
        m.service, m.associated_message_type AS associatedType, COALESCE(m.date_retracted, 0) > 0 AS retracted,
        COALESCE(m.date_edited, 0) > 0 AS edited
      FROM chat_handle_join chj
      JOIN chat_message_join cmj ON cmj.chat_id = chj.chat_id
      JOIN message m ON m.ROWID = cmj.message_id
      WHERE chj.handle_id IN (${handleIds.map(() => '?').join(',')})
        AND (SELECT COUNT(*) FROM chat_handle_join other WHERE other.chat_id = chj.chat_id) = 1
        AND COALESCE(m.item_type, 0) = 0
      ORDER BY m.date, m.ROWID`).all(...handleIds);
    const attachmentQuery = db.prepare(`SELECT a.filename, a.mime_type AS mime, a.transfer_name AS name
      FROM message_attachment_join maj JOIN attachment a ON a.ROWID = maj.attachment_id WHERE maj.message_id = ?`);
    const messages = [];
    for (const row of rows) {
      if (!reactions && isReaction(row.associatedType)) continue;
      const date = appleDate(row.date);
      if (since && date && date < since) continue;
      const files = usefulAttachments(attachmentQuery.all(row.id).map((file) => {
        const path = expandHome(file.filename, home);
        return { path, mime: file.mime || null, name: file.name || null, onDisk: Boolean(path && existsSync(path)) };
      }));
      const text = (row.text || decodeAttributedBody(row.body) || '').replace(/￼/g, '').trim();
      messages.push({
        guid: row.guid, date, fromMe: Boolean(row.fromMe), service: row.service || null, text,
        unsent: Boolean(row.retracted), edited: Boolean(row.edited), attachments: files
      });
    }
    return { handles: handleIds.length, messages };
  } finally {
    db.close();
  }
}

export function formatThread({ name, handles, messages, total }) {
  const lines = [`Texts with ${name} (${handles.join(', ')}): ${total === messages.length ? `${total} messages` : `last ${messages.length} of ${total} messages`}`];
  for (const message of messages) {
    const who = message.fromMe ? 'Mason' : name;
    let text = message.unsent ? '[unsent]' : message.text || (message.attachments.length ? '' : '[no text]');
    if (message.edited && !message.unsent) text += ' (edited)';
    lines.push(`${message.date ? localStamp(message.date) : '????-??-?? ??:??'} ${who}: ${text.replace(/[ \t]*\n+[ \t]*/g, '\n    ')}`.trimEnd());
    for (const file of message.attachments) {
      const what = [file.mime, file.onDisk ? null : 'not downloaded to this Mac'].filter(Boolean).join(', ');
      lines.push(`    attachment: ${file.path || file.name || '(unknown file)'}${what ? ` (${what})` : ''}`);
    }
  }
  return lines.join('\n');
}

export function parseArgs(argv) {
  const options = { query: [], since: null, last: null, reactions: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--reactions') options.reactions = true;
    else if (arg === '--since') {
      const value = argv[++i];
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value ?? '')) throw new Error('--since needs a date like 2026-11-20');
      options.since = new Date(`${value}T00:00:00`);
    } else if (arg === '--last') {
      const value = Number(argv[++i]);
      if (!Number.isInteger(value) || value < 1) throw new Error('--last needs a whole number of messages');
      options.last = value;
    } else if (arg.startsWith('--')) throw new Error(`Unknown option ${arg}`);
    else options.query.push(arg);
  }
  options.query = options.query.join(' ').trim();
  if (!options.query) throw new Error('Give a contact name, phone number or email');
  return options;
}

const ACCESS_HELP = `macOS blocked reading Messages or Contacts. Give Full Disk Access (System Settings > Privacy & Security >
Full Disk Access) to the program running this command. In the Claude desktop app that is the bundled Claude Code
binary under ~/Library/Application Support/Claude/claude-code/<version>/, not Claude.app; its folder changes when
Claude Code updates, so it may need adding again.`;

function main() {
  if (process.platform !== 'darwin') throw new Error('This reads the Messages app on Mason\'s Mac, so it only runs on macOS.');
  const options = parseArgs(process.argv.slice(2));
  const home = homedir();
  const chatDb = join(home, 'Library/Messages/chat.db');
  let contacts;
  try {
    contacts = loadContacts(contactDatabases(join(home, 'Library/Application Support/AddressBook')));
  } catch (error) {
    if (/authoriz|not permitted|unable to open/i.test(error.message)) throw new Error(ACCESS_HELP);
    throw error;
  }

  let name;
  let keys;
  let handles;
  if (looksLikeHandle(options.query)) {
    const key = handleKey(options.query);
    const owner = contacts.find((contact) => contact.keys.includes(key));
    name = owner ? contactName(owner) : options.query;
    keys = [key];
    handles = [options.query];
  } else {
    const matches = contacts.filter((contact) => nameMatches(contact, options.query));
    if (!matches.length) throw new Error(`No contact with a phone number or email matches "${options.query}". Try a phone number instead.`);
    if (matches.length > 1) {
      throw new Error(`"${options.query}" matches ${matches.length} contacts; use a fuller name or a phone number:\n${
        matches.map((contact) => `  ${contactName(contact)}: ${contact.handles.join(', ')}`).join('\n')}`);
    }
    name = contactName(matches[0]);
    keys = matches[0].keys;
    handles = matches[0].handles;
  }

  let thread;
  try {
    thread = readThread(chatDb, keys, { since: options.since, reactions: options.reactions, home });
  } catch (error) {
    if (/authoriz|not permitted|unable to open/i.test(error.message)) throw new Error(ACCESS_HELP);
    throw error;
  }
  if (!thread.handles) throw new Error(`No texts with ${name} (${handles.join(', ')}) in Messages on this Mac.`);
  const total = thread.messages.length;
  const messages = options.last ? thread.messages.slice(-options.last) : thread.messages;
  console.log(formatThread({ name, handles, messages, total }));
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  try {
    main();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
