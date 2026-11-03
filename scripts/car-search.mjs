import { existsSync, readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

// Helper for the /car-search skill (.claude/skills/car-search/SKILL.md):
//   node scripts/car-search.mjs get <intake ID>                    search details for one paid intake
//   node scripts/car-search.mjs submit <intake ID> <shortlist.json>  save the shortlist, email Mason the send links
// Reads CAR_SEARCH_TOKEN, and optionally CAR_SEARCH_URL, from the environment
// or from .env.local in the repository root (git-ignored).
const USAGE = 'Usage: node scripts/car-search.mjs get <intake ID> | submit <intake ID> <shortlist.json>';

export function localEnv(file = new URL('../.env.local', import.meta.url)) {
  if (!existsSync(file)) return {};
  return Object.fromEntries(readFileSync(file, 'utf8').split(/\r?\n/)
    .map(line => /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line))
    .filter(Boolean)
    .map(([, key, value]) => [key, value.replace(/^(['"])(.*)\1$/, '$2')]));
}

export async function carSearchRequest([command, intakeId, file], { environment = { ...localEnv(), ...process.env }, fetchImpl = fetch } = {}) {
  const token = environment.CAR_SEARCH_TOKEN?.trim();
  if (!token) throw new Error('CAR_SEARCH_TOKEN is not set. Add it to .env.local (see "Car search" in docs/implementation-operations.md).');
  if (!intakeId || !['get', 'submit'].includes(command) || (command === 'submit' && !file)) throw new Error(USAGE);
  const base = (environment.CAR_SEARCH_URL?.trim() || 'https://www.steermeright.com').replace(/\/+$/, '');
  const headers = { Authorization: `Bearer ${token}`, Accept: 'application/json' };
  const response = command === 'get'
    ? await fetchImpl(`${base}/api/car-search?intake=${encodeURIComponent(intakeId)}`, { headers })
    : await fetchImpl(`${base}/api/car-search`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ intake_id: intakeId, shortlist: JSON.parse(await readFile(file, 'utf8')) })
    });
  const body = await response.json().catch(() => ({ ok: false, error: `HTTP ${response.status}` }));
  return { status: response.status, body };
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
