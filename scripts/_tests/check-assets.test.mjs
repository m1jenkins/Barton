import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { validateAssets } from '../check-assets.mjs';

test('asset checks follow CSS and module dependencies and reject missing, private and stale resources', async t => {
  const root = await mkdtemp(join(tmpdir(), 'barton-assets-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  for (const folder of ['buying', 'assets', 'docs']) await mkdir(join(root, folder));
  await writeFile(join(root, '.vercelignore'), 'docs\nbuying/*.test.js\n');
  await writeFile(join(root, 'docs/private.svg'), '<svg/>');
  await writeFile(join(root, 'buying/private.test.js'), 'const test = true;');
  await writeFile(join(root, 'assets/font.ttf'), 'font');
  await writeFile(join(root, 'buying/child.js'), 'export const child = true;');
  await writeFile(join(root, 'buying/app.js'), "import './child.js?v=000000000000';\nimport './missing.js';");
  await writeFile(join(root, 'buying/style.css'), "@font-face{src:url('../assets/font.ttf')} .car{background:url('../assets/missing.webp')}");
  await writeFile(join(root, 'index.html'), '<link rel="stylesheet" href="/buying/style.css"><script type="module" src="/buying/app.js"></script><img src="/docs/private.svg"><script src="/buying/private.test.js"></script><img srcset="/assets/font.ttf 1x, /missing.webp 2x"><img src="https://outside.example/image.webp">');
  const result = await validateAssets(root);
  assert.equal(result.errors.length, 6);
  for (const expected of ['Stale resource version', 'missing.js', 'missing.webp', 'docs/private.svg', 'private.test.js']) {
    assert.ok(result.errors.some(error => error.message.includes(expected)), expected);
  }
  assert.equal(result.errors.some(error => error.message.includes('font.ttf')), false, 'relative CSS URLs resolve from their own file');
  const hash = createHash('sha256').update('export const child = true;').digest('hex').slice(0, 12);
  await writeFile(join(root, 'buying/app.js'), `import './child.js?v=${hash}';`);
  await writeFile(join(root, 'buying/style.css'), "@font-face{src:url('../assets/font.ttf')}");
  await writeFile(join(root, 'index.html'), '<link rel="stylesheet" href="/buying/style.css"><script type="module" src="/buying/app.js"></script>');
  assert.deepEqual((await validateAssets(root)).errors, []);
});
