import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { INDEXNOW_KEY, buildPayload, sitemapUrls } from '../indexnow.mjs';

const root = new URL('../../', import.meta.url);

test('the IndexNow key file at the site root holds the key', async () => {
  assert.equal((await readFile(new URL(`${INDEXNOW_KEY}.txt`, root), 'utf8')).trim(), INDEXNOW_KEY);
});

test('every sitemap URL builds into one valid IndexNow payload', async () => {
  const urls = sitemapUrls(await readFile(new URL('sitemap.xml', root), 'utf8'));
  assert.ok(urls.length > 0);
  const payload = buildPayload(urls);
  assert.equal(payload.host, 'www.steermeright.com');
  assert.equal(payload.keyLocation, `https://www.steermeright.com/${INDEXNOW_KEY}.txt`);
  assert.equal(payload.urlList.length, new Set(urls).size);
});

test('paths resolve against the site and other hosts are refused', () => {
  assert.deepEqual(buildPayload(['/about.html', '/about.html']).urlList, ['https://www.steermeright.com/about.html']);
  assert.throws(() => buildPayload(['https://www.driverightcarbuying.com/']), /Not a www\.steermeright\.com URL/);
});
