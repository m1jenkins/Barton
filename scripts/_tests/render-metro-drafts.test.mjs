import test from 'node:test';
import assert from 'node:assert/strict';
import { copyFile, mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { csvRows, htmlDocument } from '../metro-release.mjs';
import { renderDrafts } from '../render-metro-drafts.mjs';

async function fixture(t) {
  const root = await mkdtemp(path.join(tmpdir(), 'barton-citations-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, 'data'));
  for (const file of ['metro-release.json', 'metro-dossiers.json', 'services.json', 'source-registry.csv']) {
    await copyFile(new URL(`../../data/${file}`, import.meta.url), path.join(root, 'data', file));
  }
  const registryFile = path.join(root, 'data/source-registry.csv');
  const sources = csvRows(await readFile(registryFile, 'utf8'));
  const saveSources = async rows => {
    const headers = Object.keys(rows[0]);
    const cell = value => `"${value.replaceAll('"', '""')}"`;
    await writeFile(registryFile, [headers, ...rows.map(row => headers.map(key => row[key]))].map(row => row.map(cell).join(',')).join('\n') + '\n');
  };
  return { root, output: path.join(root, 'drafts'), sources, saveSources };
}

test('renderer refreshes shared citations from registry changes and detects stale drafts', async t => {
  const f = await fixture(t);
  const originalPages = await renderDrafts(f);
  for (const [file, html] of originalPages) {
    assert.equal(html, await readFile(new URL(`../../draft-artifacts/metros/${file}`, import.meta.url), 'utf8'));
  }
  const source = f.sources.find(row => row.source_id === 'TX-EV-001');
  const oldUrl = source.source_url;
  const oldTitle = source.source_title;
  source.source_url = 'https://example.org/revised-emissions?fuel=gas&county=Harris';
  source.source_title = 'Updated emissions, "county" & <vehicle> guidance';
  await f.saveSources(f.sources);
  await assert.rejects(renderDrafts({ ...f, check: true }), /stale draft/);
  const pages = await renderDrafts(f);
  for (const file of ['dallas-fort-worth.html', 'houston.html']) {
    const doc = htmlDocument(await readFile(path.join(f.output, file), 'utf8'));
    assert.ok(doc.links.includes(source.source_url));
    assert.ok(!doc.links.includes(oldUrl));
    assert.ok(doc.visibleText.includes(source.source_title));
    assert.ok(!doc.visibleText.includes(oldTitle));
    assert.equal(doc.noindex, true);
  }
  assert.equal(pages.get('service-areas.html'), originalPages.get('service-areas.html'));
  await renderDrafts({ ...f, check: true });
});

for (const missing of ['row', 'source_url', 'source_title']) {
  test(`renderer rejects a missing citation ${missing} before writing drafts`, async t => {
    const f = await fixture(t);
    if (missing === 'row') f.sources = f.sources.filter(row => row.source_id !== 'TX-EV-001');
    else f.sources.find(row => row.source_id === 'TX-EV-001')[missing] = '';
    await f.saveSources(f.sources);
    await assert.rejects(renderDrafts(f), /DFW-PROP-01: missing citation URL or title for source TX-EV-001/);
    await assert.rejects(readdir(f.output), { code: 'ENOENT' });
  });
}
