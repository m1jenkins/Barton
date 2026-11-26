import { existsSync, readFileSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// Helper for the /car-search skill (.claude/skills/car-search/SKILL.md):
//   node scripts/car-search.mjs get <intake ID>                    search details for one paid intake
//   node scripts/car-search.mjs submit <intake ID> <shortlist.json>  save the shortlist and email it to Mason
//   node scripts/car-search.mjs handoff <intake ID>                hand the deal and its first emails to Grokbot
//   node scripts/car-search.mjs draft <intake ID> <text file | -> [skill]
//                                                                  save a draft Buyer Update for Mason to approve
//                                                                  on the deal's ops page; it never posts one. skill is who
//                                                                  signs it: car-search (the default), car-negotiation or dealer-reply
//   node scripts/car-search.mjs document <document id> [output file]
//                                                                  save one Buyer Document (ids from `documents`), by default to
//                                                                  .car-searches/documents/ (git-ignored); prints where, never the contents
// What an agent working a deal reads, with no database login. Each takes the intake ID or its first 8 characters:
//   node scripts/car-search.mjs picks <intake ID>                  the standing Buyer Picks, newest first: a car at its price as
//                                                                  picked, or "keep looking". Read-only: only the buyer makes one
//                                                                  (adr/0002), and Mason confirms it with the dealer
//   node scripts/car-search.mjs documents <intake ID>              the Buyer Documents: id, type, content type, size and date.
//                                                                  Never a file's contents, and deleted files never show
//   node scripts/car-search.mjs texts <intake ID> [last N]         the buyer's texts with Mason (Buyer Texts, adr/0004), oldest first,
//                                                                  with when Mason's Mac last synced them
//   node scripts/car-search.mjs deal <intake ID>                   the shortlist with each car's prices, the full event log
//                                                                  and the Buyer Updates
// Reads CAR_SEARCH_TOKEN, and optionally CAR_SEARCH_URL, from the environment
// or from .env.local in the repository root (git-ignored). handoff also needs
// DEALER_BOT_URL and DEALER_BOT_KEY, Grokbot's "New deal" webhook
// (docs/dealer-bot-setup-2026-11-03.md, step 6). submit passes the shortlist
// JSON through as is; the server checks it, including each car's est_otd and
// color once the Deal Tracker is on.
const USAGE = 'Usage: node scripts/car-search.mjs get <intake ID> | submit <intake ID> <shortlist.json> | handoff <intake ID> | draft <intake ID> <text file | -> [car-search | car-negotiation | dealer-reply] | document <document id> [output file] | picks <intake ID> | documents <intake ID> | texts <intake ID> [last N] | deal <intake ID>';
// GET-only: none of these can change anything.
const READS = ['picks', 'documents', 'texts', 'deal'];
const COMMANDS = ['get', 'submit', 'handoff', 'draft', 'document', ...READS];
// Who may sign a draft Buyer Update; the server holds the same list.
const DRAFT_SKILLS = ['car-search', 'car-negotiation', 'dealer-reply'];
const DOCUMENTS_DIR = fileURLToPath(new URL('../.car-searches/documents/', import.meta.url));

export function localEnv(file = new URL('../.env.local', import.meta.url)) {
  if (!existsSync(file)) return {};
  return Object.fromEntries(readFileSync(file, 'utf8').split(/\r?\n/)
    .map(line => /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line))
    .filter(Boolean)
    .map(([, key, value]) => [key, value.replace(/^(['"])(.*)\1$/, '$2')]));
}

// Checked before the server marks anything handed off.
function dealerBot(environment) {
  const url = environment.DEALER_BOT_URL?.trim();
  const key = environment.DEALER_BOT_KEY?.trim();
  if (!url || !key) {
    throw new Error('DEALER_BOT_URL and DEALER_BOT_KEY are not set. Add them to .env.local (see step 6 of docs/dealer-bot-setup-2026-11-03.md).');
  }
  if (!/^https:\/\//.test(url)) throw new Error('DEALER_BOT_URL must be an https URL.');
  return { url, key };
}

// A 200 from Grokbot only means it started a run: its cards show up in its chat.
async function postToDealerBot(bot, handoff, fetchImpl) {
  const response = await fetchImpl(bot.url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${bot.key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(handoff)
  });
  const text = (await response.text().catch(() => '')).replaceAll(bot.key, '[key]').slice(0, 2000);
  let reply;
  try { reply = JSON.parse(text); } catch { reply = text; }
  return {
    status: response.ok ? 200 : 502,
    body: response.ok
      ? { ok: true, deal: handoff.deal, dealer_emails: handoff.dealers.length, grokbot: reply,
        next: 'Grokbot started a run. Its approval cards show up in its chat in a minute or two.' }
      : { ok: false, error: `Grokbot answered HTTP ${response.status}`, grokbot: reply,
        next: 'Nothing reached a dealer. Fix the webhook, then run handoff again: the server returns the same handoff.' }
  };
}

// The server names the file (<type>-<id>.<ext>); only a plain name is kept.
function savedName(disposition, id) {
  const name = /filename="([^"]+)"/i.exec(disposition ?? '')?.[1] ?? '';
  return /^[a-z0-9_-]{1,40}\.[a-z0-9]{1,5}$/i.test(name) ? name : `document-${id}`;
}

// One Buyer Document saved to disk. The result says where and how big, never what's in it.
async function saveDocument(base, headers, id, output, fetchImpl, documentsDir) {
  const response = await fetchImpl(`${base}/api/car-search?document=${encodeURIComponent(id)}`, { headers: { ...headers, Accept: '*/*' } });
  if (response.status !== 200) {
    return { status: response.status, body: await response.json().catch(() => ({ ok: false, error: `HTTP ${response.status}` })) };
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  const target = output ? resolve(output) : join(documentsDir, savedName(response.headers.get('content-disposition'), id));
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, bytes, { mode: 0o600 });
  return { status: 200, body: { ok: true, document: Number(id), saved: target, bytes: bytes.length, content_type: response.headers.get('content-type') } };
}

// draft reads its text from a file, or from stdin when the file is -.
const readText = source => (source === '-' ? new Response(process.stdin).text() : readFile(source, 'utf8'));

export async function carSearchRequest([command, intakeId, file, skill], { environment = { ...localEnv(), ...process.env }, fetchImpl = fetch, documentsDir = DOCUMENTS_DIR, read = readText } = {}) {
  const token = environment.CAR_SEARCH_TOKEN?.trim();
  if (!token) throw new Error('CAR_SEARCH_TOKEN is not set. Add it to .env.local (see "Car search" in docs/implementation-operations.md).');
  if (!intakeId || !COMMANDS.includes(command) || (['submit', 'draft'].includes(command) && !file)) throw new Error(USAGE);
  if (command === 'document' && !/^[1-9]\d{0,17}$/.test(intakeId)) throw new Error(USAGE);
  if (command === 'draft' && skill != null && !DRAFT_SKILLS.includes(skill)) throw new Error(USAGE);
  if (READS.includes(command) && file != null && !(command === 'texts' && /^[1-9]\d{0,3}$/.test(file))) {
    throw new Error(command === 'texts' ? 'texts takes a whole number of texts to show' : USAGE);
  }
  const bot = command === 'handoff' ? dealerBot(environment) : null;
  const base = (environment.CAR_SEARCH_URL?.trim() || 'https://www.steermeright.com').replace(/\/+$/, '');
  const headers = { Authorization: `Bearer ${token}`, Accept: 'application/json' };
  if (command === 'document') return saveDocument(base, headers, intakeId, file, fetchImpl, documentsDir);
  // Every command is named here: one this list doesn't know sends nothing.
  const post = async () => (command === 'submit' ? { intake_id: intakeId, shortlist: JSON.parse(await readFile(file, 'utf8')) }
    : command === 'draft' ? { intake_id: intakeId, action: 'draft_update', text: await read(file), ...(skill ? { skill } : {}) }
      : command === 'handoff' ? { intake_id: intakeId, action: 'handoff' } : null);
  let response;
  if (command === 'get') {
    response = await fetchImpl(`${base}/api/car-search?intake=${encodeURIComponent(intakeId)}`, { headers });
  } else if (READS.includes(command)) {
    const query = new URLSearchParams({ intake: intakeId, read: command, ...(file ? { last: file } : {}) });
    response = await fetchImpl(`${base}/api/car-search?${query}`, { headers });
  } else {
    const body = await post();
    if (!body) throw new Error(USAGE);
    response = await fetchImpl(`${base}/api/car-search`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
  }
  const body = await response.json().catch(() => ({ ok: false, error: `HTTP ${response.status}` }));
  if (command !== 'handoff' || !body.ok) return { status: response.status, body };
  return postToDealerBot(bot, body.handoff, fetchImpl);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const { status, body } = await carSearchRequest(process.argv.slice(2));
    console.log(JSON.stringify(body, null, 2));
    if (status >= 400) process.exitCode = 1;
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
