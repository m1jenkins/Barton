import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { inventoryMetroLinks } from '../inventory-metro-links.mjs';
import { csvRows } from '../metro-release.mjs';

test('link inventory dates each scan in UTC and recounts current HTML', async t => {
  const root = await mkdtemp(path.join(tmpdir(), 'barton-link-inventory-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, 'data'));
  await writeFile(path.join(root, 'data/metro-release.json'), JSON.stringify({ legacyTexas: [{ slug: 'austin.html' }, { slug: 'houston.html' }] }));
  await writeFile(path.join(root, 'houston.html'), '<meta name="robots" content="noindex"><a href="/houston.html">Houston</a>');
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2027-04-01T23:30:00-05:00') });
  for (const [scanTime, observedOn, count] of [
    ['2027-04-01T23:30:00-05:00', '2027-04-02', 1],
    ['2027-04-02T23:30:00-05:00', '2027-04-03', 2],
  ]) {
    t.mock.timers.setTime(new Date(scanTime).getTime());
    await writeFile(path.join(root, 'index.html'), '<a href="austin.html#details">Austin</a>'.repeat(count) + '<a href="/houston.html">Houston</a><a href="https://example.org/austin.html">External</a>');
    assert.equal(await inventoryMetroLinks({ root }), 3);
    const rows = csvRows(await readFile(path.join(root, 'data/metro-link-inventory.csv'), 'utf8'));
    assert.deepEqual(rows, [
      { source_file: 'houston.html', target_file: 'houston.html', link_count: '1', source_indexable: 'false', observed_on: observedOn },
      { source_file: 'index.html', target_file: 'austin.html', link_count: String(count), source_indexable: 'true', observed_on: observedOn },
      { source_file: 'index.html', target_file: 'houston.html', link_count: '1', source_indexable: 'true', observed_on: observedOn },
    ]);
  }
});
