import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile, readdir } from 'node:fs/promises';
import { dirname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

// Vercel bundles each function from its static imports. A browser module outside
// api/ can carry content-hashed imports (`./ad-consent.js?v=…`) that the tracer
// cannot resolve, so the file is left out and the function crashes at startup.
const api = resolve(fileURLToPath(new URL('..', import.meta.url)));
const root = resolve(api, '..');
const importPattern = /\bfrom\s*(['"])([^'"]+)\1|\bimport\s*\(\s*(['"])([^'"]+)\3\s*\)|^\s*import\s*(['"])([^'"]+)\5/gm;

async function importProblems(entry) {
  const seen = new Set();
  const problems = [];
  async function visit(file) {
    if (seen.has(file)) return;
    seen.add(file);
    const source = await readFile(file, 'utf8');
    for (const match of source.matchAll(importPattern)) {
      const specifier = match[2] || match[4] || match[6];
      if (!specifier.startsWith('.')) continue;
      const target = resolve(dirname(file), specifier);
      const where = `${relative(root, file)} imports ${specifier}`;
      if (/[?#]/.test(specifier)) problems.push(`${where}: query or fragment`);
      else if (!target.startsWith(api + sep)) problems.push(`${where}: outside api/`);
      else if (!existsSync(target)) problems.push(`${where}: missing file`);
      else await visit(target);
    }
  }
  await visit(entry);
  return problems;
}

test('every API function imports only files inside api/, without query strings', async () => {
  const entries = (await readdir(api)).filter(name => name.endsWith('.js'));
  for (const name of ['checkout-start.js', 'leads.js', 'stripe-webhook.js']) assert.ok(entries.includes(name), name);
  for (const name of entries) assert.deepEqual(await importProblems(resolve(api, name)), [], name);
});
