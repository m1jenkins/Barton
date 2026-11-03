import { existsSync, readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

// Helper for the /car-search skill (.claude/skills/car-search/SKILL.md):
//   node scripts/car-search.mjs get <intake ID>                    search details for one paid intake
//   node scripts/car-search.mjs submit <intake ID> <shortlist.json>  save the shortlist and email it to Mason
//   node scripts/car-search.mjs handoff <intake ID>                hand the deal and its first emails to Grokbot
// Reads CAR_SEARCH_TOKEN, and optionally CAR_SEARCH_URL, from the environment
// or from .env.local in the repository root (git-ignored). handoff also needs
// DEALER_BOT_URL and DEALER_BOT_KEY, Grokbot's "New deal" webhook
// (docs/dealer-bot-setup-2026-11-03.md, step 6).
const USAGE = 'Usage: node scripts/car-search.mjs get <intake ID> | submit <intake ID> <shortlist.json> | handoff <intake ID>';

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

export async function carSearchRequest([command, intakeId, file], { environment = { ...localEnv(), ...process.env }, fetchImpl = fetch } = {}) {
  const token = environment.CAR_SEARCH_TOKEN?.trim();
  if (!token) throw new Error('CAR_SEARCH_TOKEN is not set. Add it to .env.local (see "Car search" in docs/implementation-operations.md).');
  if (!intakeId || !['get', 'submit', 'handoff'].includes(command) || (command === 'submit' && !file)) throw new Error(USAGE);
  const bot = command === 'handoff' ? dealerBot(environment) : null;
  const base = (environment.CAR_SEARCH_URL?.trim() || 'https://www.steermeright.com').replace(/\/+$/, '');
  const headers = { Authorization: `Bearer ${token}`, Accept: 'application/json' };
  const response = command === 'get'
    ? await fetchImpl(`${base}/api/car-search?intake=${encodeURIComponent(intakeId)}`, { headers })
    : await fetchImpl(`${base}/api/car-search`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(command === 'submit'
        ? { intake_id: intakeId, shortlist: JSON.parse(await readFile(file, 'utf8')) }
        : { intake_id: intakeId, action: 'handoff' })
    });
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
