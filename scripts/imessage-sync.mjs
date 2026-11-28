#!/usr/bin/env node
// Copies Buyer Texts (docs/adr/0004) from the Messages app on Mason's Mac to
// Neon, so agents can read what a buyer said:
//
//   node scripts/imessage-sync.mjs            sync once
//   node scripts/imessage-sync.mjs --dry-run  show which numbers and how many texts would go, sending nothing
//   node scripts/imessage-sync.mjs install    run it every 10 minutes (a LaunchAgent), and once now
//   node scripts/imessage-sync.mjs uninstall  stop the schedule
//
// It asks /api/car-search which deals are open, with each intake's phone and
// email, and reads only those one-to-one threads, from a week before the intake.
// No other thread on the Mac is read or sent. A number two open deals share is
// skipped. Needs CAR_SEARCH_TOKEN in .env.local, and macOS Full Disk Access for
// the Node binary that runs it. The log holds counts, never message text.
//
// Dealer Texts (docs/adr/0005) go the same way. A dealer's Contacts card keeps
// a dealer-only name ("Ruben · Hamer Toyota") and says which client it is for
// in Notes, on a line like "SMR: Ace" or "SMR: Ace, Charles". Each name must
// match exactly one open deal's buyer (first name, or more of the name when two
// buyers share it); otherwise that tag is skipped and logged, never guessed.
// A card with no tag is synced only if its number is on a deal's
// dealer_text_contacts list in Neon. A buyer's own number is never a dealer.

import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { localEnv } from './car-search.mjs';
import { contactDatabases, contactName, handleKey, loadContacts, readThread } from './imessage-thread.mjs';

const LABEL = 'com.steermeright.imessage-sync';
const INTERVAL_SECONDS = 600;
const MAX_BATCH_BYTES = 200000; // the endpoint reads at most 262144
const MAX_BATCH_COUNT = 500;

// A ten-digit US number that can't be real: one digit repeated (0000000000),
// or an area code or exchange starting with 0 or 1, which US numbers never do.
export function fakePhone(key) {
  return /^\d{10}$/.test(key) && (/^(\d)\1{9}$/.test(key) || !/^[2-9]\d{2}[2-9]\d{6}$/.test(key));
}

// Which handles to read for each open deal. A phone with fewer than ten digits,
// or a fake one, is ignored; a number or email two deals share is dropped from both.
export function planThreads(threads) {
  const owners = new Map();
  const plans = threads.map((thread) => {
    const phone = handleKey(thread.phone);
    const keys = [...new Set([fakePhone(phone) ? null : phone, handleKey(thread.email)].filter(Boolean))];
    for (const key of keys) owners.set(key, (owners.get(key) ?? 0) + 1);
    return { intake_id: thread.intake_id, keys, since: new Date(thread.since) };
  });
  const ready = [];
  const skipped = [];
  for (const plan of plans) {
    const keys = plan.keys.filter((key) => owners.get(key) === 1);
    if (keys.length) ready.push({ ...plan, keys });
    else skipped.push({ intake_id: plan.intake_id, reason: plan.keys.length ? 'shares its number with another open deal' : 'has no usable phone or email' });
  }
  return { ready, skipped };
}

// One message as the endpoint takes it. Unsent texts go with no words.
export function toPayload(message) {
  if (!message.guid || !message.date) return null;
  return {
    guid: message.guid,
    sent_at: message.date.toISOString(),
    from_buyer: !message.fromMe,
    body: message.unsent ? '' : message.text.slice(0, 20000),
    service: message.service ? message.service.slice(0, 20) : null,
    unsent: message.unsent,
    edited: message.edited,
    attachments: message.attachments.slice(0, 20).map((file) => ({
      name: (file.name || (file.path ? basename(file.path) : '') || '').slice(0, 200) || null,
      mime: file.mime ? file.mime.slice(0, 100) : null
    }))
  };
}

// Splits messages so each request stays under the endpoint's body limit.
export function batches(messages, { maxBytes = MAX_BATCH_BYTES, maxCount = MAX_BATCH_COUNT } = {}) {
  const out = [];
  let current = [];
  let size = 0;
  for (const message of messages) {
    const bytes = Buffer.byteLength(JSON.stringify(message)) + 1;
    if (current.length && (size + bytes > maxBytes || current.length >= maxCount)) {
      out.push(current);
      current = [];
      size = 0;
    }
    current.push(message);
    size += bytes;
  }
  if (current.length || !out.length) out.push(current);
  return out;
}

// The client names a contact's Notes file it under: every "SMR: ..." line,
// split on commas, semicolons, "&" and "and". Case and spacing don't matter.
export function smrTags(note) {
  const names = [];
  for (const match of String(note ?? '').matchAll(/\bSMR\s*:\s*([^\r\n]*)/gi)) {
    for (const name of match[1].split(/[,;&]|\band\b/i)) {
      const clean = name.replace(/\s+/g, ' ').trim();
      if (clean && !names.some((seen) => seen.toLowerCase() === clean.toLowerCase())) names.push(clean);
    }
  }
  return names;
}

const words = (value) => String(value ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  .split(/[^a-z0-9']+/).filter(Boolean);

// A tag names a buyer when each of its words is one of the buyer's name words:
// "Ace" and "Ace Aguilera" both name "Ace Aguilera"; "Al" doesn't name "Alex".
export function tagNamesBuyer(tag, buyerName) {
  const have = new Set(words(buyerName));
  const want = words(tag);
  return want.length > 0 && want.every((word) => have.has(word));
}

const usableKey = (value) => {
  const key = handleKey(value);
  return key && !fakePhone(key) ? key : null;
};

// Which dealer threads to send, from the open deals (GET ?texts=dealers) and the
// Mac's contacts. Returns { ready: [{ intake_id, since, contact: { key, name,
// how }, keys }], skipped: [{ who, reason }] }. A tagged card is filed only by
// its tags; the deal lists only cover cards with no tag.
export function planDealerThreads(deals, contacts) {
  const buyerKeys = new Set(deals.flatMap((deal) => [usableKey(deal.buyer_phone), usableKey(deal.buyer_email)]).filter(Boolean));
  const ready = new Map();
  const skipped = [];
  const add = (deal, contact, keys) => {
    const id = `${deal.intake_id}|${contact.key}`;
    if (!ready.has(id)) ready.set(id, { intake_id: deal.intake_id, since: new Date(deal.since), contact, keys });
  };
  const taggedKeys = new Set();
  for (const card of contacts) {
    const tags = smrTags(card.note);
    if (!tags.length) continue;
    const name = contactName(card);
    const keys = [...new Set(card.keys.filter((key) => !fakePhone(key)))];
    keys.forEach((key) => taggedKeys.add(key));
    if (!keys.length) { skipped.push({ who: name, reason: 'has an SMR tag but no usable phone or email' }); continue; }
    if (keys.some((key) => buyerKeys.has(key))) { skipped.push({ who: name, reason: 'has an SMR tag but is an open deal\'s buyer, so it is never synced as a dealer' }); continue; }
    for (const tag of tags) {
      const matches = deals.filter((deal) => tagNamesBuyer(tag, deal.buyer_name));
      if (matches.length === 1) add(matches[0], { key: keys[0], name, how: 'contact_tag' }, keys);
      else skipped.push({ who: name, reason: matches.length
        ? `"SMR: ${tag}" matches ${matches.length} open deals; add the client's last name to the tag`
        : `"SMR: ${tag}" matches no open deal` });
    }
  }
  const cardOf = new Map(contacts.flatMap((card) => card.keys.map((key) => [key, card])));
  for (const deal of deals) {
    for (const listed of deal.dealer_contacts ?? []) {
      const key = usableKey(listed.key);
      if (!key || taggedKeys.has(key)) continue;
      const card = cardOf.get(key);
      const name = card ? contactName(card) : [listed.contact_name, listed.dealer_name].filter(Boolean).join(' · ') || null;
      if (buyerKeys.has(key)) { skipped.push({ who: name || `…${key.slice(-4)}`, reason: 'is on a dealer list but is an open deal\'s buyer' }); continue; }
      add(deal, { key, name, how: 'dealer_list' }, [key]);
    }
  }
  return { ready: [...ready.values()], skipped };
}

// A message as the dealer_texts action takes it: from_dealer in place of from_buyer.
export function toDealerPayload(message) {
  const payload = toPayload(message);
  if (!payload) return null;
  const { from_buyer: fromOther, ...rest } = payload;
  return { ...rest, from_dealer: fromOther };
}

// Sends the dealer threads. Problems with one dealer or with the server are
// logged and counted; they never stop the Buyer Texts sync.
async function syncDealerTexts({ base, headers, fetchImpl, chatDb, home, addressBookDir, dryRun, log }) {
  const result = { dealers: 0, texts: 0, skipped: [], failed: [] };
  const listed = await fetchImpl(`${base}/api/car-search?texts=dealers`, { headers });
  const list = await listed.json().catch(() => ({}));
  if (!listed.ok || !list.ok || !Array.isArray(list.deals)) {
    result.unavailable = `couldn't get the open deals for dealer texts (HTTP ${listed.status}); the site may not have the update yet`;
    return result;
  }
  let contacts;
  try {
    contacts = loadContacts(contactDatabases(addressBookDir));
  } catch (error) {
    result.unavailable = /authoriz|not permitted|unable to open/i.test(error.message)
      ? `macOS blocked reading Contacts. Give Full Disk Access to ${process.execPath}.`
      : `couldn't read Contacts: ${error.message}`;
    return result;
  }
  const { ready, skipped } = planDealerThreads(list.deals, contacts);
  result.skipped = skipped;
  for (const plan of ready) {
    result.dealers += 1;
    try {
      const thread = readThread(chatDb, plan.keys, { since: plan.since, home });
      const messages = thread.messages.map(toDealerPayload).filter(Boolean);
      if (dryRun) {
        log(`${plan.intake_id.slice(0, 8)}  dealer ${plan.contact.name ?? plan.contact.key} (${plan.contact.how})  ${messages.length} texts since ${plan.since.toISOString().slice(0, 10)}`);
        result.texts += messages.length;
        continue;
      }
      for (const batch of batches(messages)) {
        const response = await fetchImpl(`${base}/api/car-search`, {
          method: 'POST',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({ intake_id: plan.intake_id, action: 'dealer_texts', contact: plan.contact, messages: batch })
        });
        const body = await response.json().catch(() => ({}));
        if (!response.ok || !body.ok) throw new Error(body.error || `HTTP ${response.status}`);
        result.texts += body.saved;
      }
    } catch (error) {
      result.failed.push({ intake_id: plan.intake_id, dealer: plan.contact.name, error: error.message });
    }
  }
  return result;
}

export async function syncTexts({
  environment = { ...localEnv(), ...process.env }, fetchImpl = fetch, home = homedir(),
  chatDb = join(home, 'Library/Messages/chat.db'), addressBookDir = join(home, 'Library/Application Support/AddressBook'),
  dryRun = false, log = console.log
} = {}) {
  const token = environment.CAR_SEARCH_TOKEN?.trim();
  if (!token) throw new Error('CAR_SEARCH_TOKEN is not set. Add it to .env.local (see "Car search" in docs/implementation-operations.md).');
  const base = (environment.CAR_SEARCH_URL?.trim() || 'https://www.steermeright.com').replace(/\/+$/, '');
  const headers = { Authorization: `Bearer ${token}`, Accept: 'application/json' };

  const listed = await fetchImpl(`${base}/api/car-search?texts=threads`, { headers });
  const list = await listed.json().catch(() => ({}));
  if (!listed.ok || !list.ok || !Array.isArray(list.threads)) throw new Error(`Couldn't get the open deals (HTTP ${listed.status}); nothing was sent.`);
  const { ready, skipped } = planThreads(list.threads);

  const summary = { deals: ready.length, texts: 0, skipped, failed: [] };
  for (const plan of ready) {
    let thread;
    try {
      thread = readThread(chatDb, plan.keys, { since: plan.since, home });
    } catch (error) {
      if (/authoriz|not permitted|unable to open/i.test(error.message)) {
        throw new Error(`macOS blocked reading Messages. Give Full Disk Access to ${process.execPath} (System Settings > Privacy & Security > Full Disk Access).`);
      }
      throw error;
    }
    const messages = thread.messages.map(toPayload).filter(Boolean);
    const short = plan.intake_id.slice(0, 8);
    if (dryRun) {
      const first = messages[0]?.sent_at.slice(0, 10) ?? '-';
      log(`${short}  ${plan.keys.join(', ')}  ${messages.length} texts since ${plan.since.toISOString().slice(0, 10)} (first ${first})`);
      summary.texts += messages.length;
      continue;
    }
    try {
      for (const batch of batches(messages)) {
        const response = await fetchImpl(`${base}/api/car-search`, {
          method: 'POST',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({ intake_id: plan.intake_id, action: 'texts', messages: batch })
        });
        const body = await response.json().catch(() => ({}));
        if (!response.ok || !body.ok) throw new Error(body.error || `HTTP ${response.status}`);
        summary.texts += body.saved;
      }
    } catch (error) {
      summary.failed.push({ intake_id: plan.intake_id, error: error.message });
    }
  }
  for (const skip of skipped) log(`skipped ${skip.intake_id.slice(0, 8)}: ${skip.reason}`);
  for (const failure of summary.failed) log(`failed ${failure.intake_id.slice(0, 8)}: ${failure.error}`);
  log(`${new Date().toISOString()} ${dryRun ? 'would sync' : 'synced'} ${summary.texts} texts for ${summary.deals} open deals`);

  const dealers = await syncDealerTexts({ base, headers, fetchImpl, chatDb, home, addressBookDir, dryRun, log });
  summary.dealer = dealers;
  if (dealers.unavailable) log(`dealer texts skipped: ${dealers.unavailable}`);
  for (const skip of dealers.skipped) log(`dealer skipped: ${skip.who}: ${skip.reason}`);
  for (const failure of dealers.failed) log(`dealer failed ${failure.intake_id.slice(0, 8)} ${failure.dealer ?? ''}: ${failure.error}`);
  if (!dealers.unavailable) log(`${new Date().toISOString()} ${dryRun ? 'would sync' : 'synced'} ${dealers.texts} dealer texts from ${dealers.dealers} dealer threads`);
  return summary;
}

export function launchAgentPlist({ node, script, workingDirectory, logFile, interval = INTERVAL_SECONDS }) {
  const xml = (value) => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>${LABEL}</string>
  <key>ProgramArguments</key>
  <array><string>${xml(node)}</string><string>${xml(script)}</string></array>
  <key>WorkingDirectory</key><string>${xml(workingDirectory)}</string>
  <key>StartInterval</key><integer>${interval}</integer>
  <key>RunAtLoad</key><true/>
  <key>StandardOutPath</key><string>${xml(logFile)}</string>
  <key>StandardErrorPath</key><string>${xml(logFile)}</string>
</dict>
</plist>
`;
}

function install() {
  const home = homedir();
  const plistFile = join(home, 'Library/LaunchAgents', `${LABEL}.plist`);
  const logFile = join(home, 'Library/Logs/steermeright-imessage-sync.log');
  const script = fileURLToPath(import.meta.url);
  mkdirSync(join(home, 'Library/LaunchAgents'), { recursive: true });
  mkdirSync(join(home, 'Library/Logs'), { recursive: true });
  writeFileSync(plistFile, launchAgentPlist({ node: process.execPath, script, workingDirectory: fileURLToPath(new URL('..', import.meta.url)), logFile }));
  const domain = `gui/${process.getuid()}`;
  try { execFileSync('launchctl', ['bootout', `${domain}/${LABEL}`], { stdio: 'ignore' }); } catch { /* not loaded yet */ }
  execFileSync('launchctl', ['bootstrap', domain, plistFile]);
  console.log(`Installed ${plistFile}: syncs every ${INTERVAL_SECONDS / 60} minutes while this Mac is awake.
Log: ${logFile}
Give Full Disk Access to ${process.execPath} (System Settings > Privacy & Security > Full Disk Access),
then check the log. Run install again after moving to a new Node version.`);
}

function uninstall() {
  const plistFile = join(homedir(), 'Library/LaunchAgents', `${LABEL}.plist`);
  try { execFileSync('launchctl', ['bootout', `gui/${process.getuid()}/${LABEL}`], { stdio: 'ignore' }); } catch { /* not loaded */ }
  if (existsSync(plistFile)) rmSync(plistFile);
  console.log('Stopped the texts sync. Texts already in Neon stay until the daily cleanup.');
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const [command] = process.argv.slice(2);
  try {
    if (process.platform !== 'darwin') throw new Error('This reads the Messages app on Mason\'s Mac, so it only runs on macOS.');
    if (command === 'install') install();
    else if (command === 'uninstall') uninstall();
    else if (command === undefined || command === '--dry-run') {
      const summary = await syncTexts({ dryRun: command === '--dry-run' });
      if (summary.failed.length || summary.dealer?.failed.length) process.exitCode = 1;
    }
    else throw new Error('Usage: node scripts/imessage-sync.mjs [--dry-run] | install | uninstall');
  } catch (error) {
    console.error(`${new Date().toISOString()} ${error.message}`);
    process.exitCode = 1;
  }
}
