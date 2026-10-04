import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { javascriptFiles, checkJavaScript } from '../check-javascript.mjs';

test('syntax checks discover new API helpers and report broken browser modules', async t => {
  const root = await mkdtemp(join(tmpdir(), 'barton-syntax-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await writeFile(join(root, 'package.json'), '{"type":"module"}');
  for (const folder of ['api/_lib', 'buying', 'scripts', 'draft-artifacts/quote-comparison', 'outputs/2026-10-google-search-ads']) await mkdir(join(root, folder), { recursive: true });
  await writeFile(join(root, 'api/_lib/new-helper.js'), 'export const configured = true;');
  await writeFile(join(root, 'script.js'), 'const page = window.location;');
  await writeFile(join(root, 'buying/new-module.js'), 'export const broken = ;');
  assert.deepEqual(await javascriptFiles(root, 'api'), ['api/_lib/new-helper.js']);
  const result = await checkJavaScript(root);
  assert.equal(result.files.length, 3);
  assert.equal(result.errors.length, 1);
  assert.equal(result.errors[0].file, 'buying/new-module.js');
  assert.match(result.errors[0].message, /SyntaxError/);
});
