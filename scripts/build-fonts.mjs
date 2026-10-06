#!/usr/bin/env node
// Builds the Latin WOFF2 subsets the site serves from the TTF sources in assets/buying/fonts/.
// Local tool, not deployed and not run in CI: it needs `uv` (https://docs.astral.sh/uv/) so
// fonttools can run without a project Python. Re-run it whenever a TTF source changes, then
// run `node scripts/validate-site.mjs` for the refreshed CSS hashes.
import { spawnSync } from 'node:child_process';
import { statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dir = path.join(root, 'assets', 'buying', 'fonts');
// Every code point the current pages and browser scripts use: Latin-1, general punctuation
// (curly quotes, dashes, ellipsis, bullets), the euro and trademark signs, and arrows.
const unicodes = 'U+0000-00FF,U+2000-206F,U+20AC,U+2122,U+2190-21FF';
const faces = ['inter', 'inter-semibold', 'barlow-medium', 'barlow-semibold'];

for (const face of faces) {
  const input = path.join(dir, `${face}.ttf`);
  const output = path.join(dir, `${face}-latin.woff2`);
  const result = spawnSync('uvx', [
    '--from', 'fonttools[woff2]', 'pyftsubset', input,
    `--output-file=${output}`, '--flavor=woff2', '--layout-features=*', `--unicodes=${unicodes}`,
  ], { stdio: 'inherit' });
  if (result.error || result.status !== 0) {
    console.error(`build-fonts: ${face} failed${result.error ? ` (${result.error.message})` : ''}`);
    process.exit(1);
  }
  console.log(`${path.relative(root, output)}: ${(statSync(output).size / 1024).toFixed(1)} KB`);
}
