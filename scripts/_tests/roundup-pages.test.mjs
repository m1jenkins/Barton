import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { csvRows, htmlDocument } from '../metro-release.mjs';
import { renderRoundupPages } from '../render-roundup-pages.mjs';

const root = new URL('../../', import.meta.url);
const read = name => readFile(new URL(name, root), 'utf8');
const origin = 'https://www.steermeright.com';
const data = JSON.parse(await read('data/roundup-pages.json'));
const vehicles = JSON.parse(await read('data/vehicle-pages.json')).vehicles;

test('roundup pages on disk match data/roundup-pages.json, the price guides and the current page chrome', async () => {
  for (const { slug, html } of await renderRoundupPages()) assert.equal(await read(slug), html, `${slug} is stale; run npm run build:roundups`);
});

test('roundup pages are indexable, dated, labelled as estimates and carry the approved plan lines', async () => {
  const sitemap = await read('sitemap.xml');
  const inventory = csvRows(await read('data/content-inventory.csv'));
  const queries = csvRows(await read('docs/seo-execution/query-map.csv'));
  const resources = htmlDocument(await read('blog.html')).links;
  const llms = await read('llms.txt');
  for (const page of data.pages) {
    const name = page.slug, html = await read(name), document = htmlDocument(html);
    assert.equal(document.noindex, false, name);
    assert.deepEqual(document.canonical, [`${origin}/${name}`], name);
    assert.ok(sitemap.includes(`<loc>${origin}/${name}</loc>`), `${name} sitemap entry`);
    assert.equal(document.h1.length, 1, name);
    const article = document.schemas.flatMap(schema => schema['@graph'] || [schema]).find(node => node['@type'] === 'Article');
    assert.equal(article?.headline, document.h1[0], `${name} Article headline`);
    assert.equal(article.dateModified, html.match(/<time datetime="(\d{4}-\d{2}-\d{2})">/)?.[1], `${name} visible date matches Article.dateModified`);
    for (const line of [/\$395/, /\$695/, /Dealers and lenders pay us nothing\./, /Full refund if you cancel before negotiations begin\./, /We can’t promise a specific discount/, /our estimate[^.]*, not a promise\./i]) assert.match(document.visibleText, line, name);
    assert.doesNotMatch(JSON.stringify(document.schemas), /AggregateRating|"Review"/, name);
    assert.doesNotMatch(document.visibleText, /\bbrief\b|\bbrokers?\b|average savings|guaranteed|lowest price|best price/i, name);
    assert.ok(document.links.includes('/schedule.html#full-service') && document.links.includes('/schedule.html#concierge'), `${name} links both plans`);
    assert.ok(resources.includes(`/${name}`), `blog.html links /${name}`);
    assert.equal(inventory.find(row => row.canonical_url === `${origin}/${name}`)?.lifecycle_status, 'indexable_owner_publication', name);
    assert.ok(queries.some(row => row.preferred_url === `${origin}/${name}`), `${name} has query-map rows`);
    assert.ok(llms.includes(`${origin}/${name}`), `llms.txt lists ${name}`);
    // Every price guide and comparison page it links exists.
    for (const href of document.links.filter(link => /^\/[a-z0-9-]+\.html$/.test(link))) assert.ok((await read(href.slice(1)).catch(() => null)) !== null, `${name} links ${href}, which exists`);
  }
});

test('every price guide named by a roundup entry exists, and each page ranks only trims the guide lists', async () => {
  for (const page of data.pages) for (const entry of page.entries) {
    if (!entry.guide) continue;
    const guide = vehicles.find(vehicle => vehicle.slug === entry.guide);
    assert.ok(guide, `${page.slug}: ${entry.key} names the price guide ${entry.guide}`);
    for (const trim of [entry.startTrim, entry.pickTrim, entry.baseTrim, entry.buyTrim, ...(entry.offers ?? []).map(offer => offer.trim)].filter(Boolean)) assert.ok(guide.trims.rows.some(row => row.name === trim), `${entry.guide} lists the trim ${trim}`);
  }
});

test('the hybrid page ranks only trims that cost $35,000 or less with destination', async () => {
  const page = data.pages.find(entry => entry.kind === 'hybrids');
  for (const entry of page.entries) for (const offer of entry.offers) {
    const guide = entry.guide ? vehicles.find(vehicle => vehicle.slug === entry.guide) : null;
    const msrp = offer.msrp ?? guide.trims.rows.find(row => row.name === offer.trim).prices[entry.col ?? 0] + (offer.add ?? 0);
    assert.ok(msrp + entry.dest <= 35000, `${entry.key} ${offer.label} is ${msrp + entry.dest}`);
  }
});

test('every outside link on a roundup page is a registered, dated source', async () => {
  const registry = csvRows(await read('data/source-registry.csv'));
  for (const page of data.pages) {
    const document = htmlDocument(await read(page.slug));
    const photos = page.entries.filter(entry => entry.guide).map(entry => vehicles.find(vehicle => vehicle.slug === entry.guide).photo).flatMap(image => [image.sourceUrl, image.licenseUrl]).filter(Boolean);
    const outside = [...new Set(document.links.filter(href => /^https?:/.test(href) && new URL(href).origin !== origin))];
    assert.deepEqual(outside.toSorted(), [...new Set([...page.sources.map(source => source.url), ...photos])].toSorted(), `${page.slug} outside links`);
    for (const source of page.sources) {
      assert.match(source.id, new RegExp(`^VEH-RND-${page.code}-\\d{2}$`), source.id);
      const row = registry.find(entry => entry.source_id === source.id);
      assert.equal(row?.source_url, source.url, `${source.id} is in data/source-registry.csv`);
      assert.equal(row.article_url, `${origin}/${page.slug}`, source.id);
      assert.match(row.next_review, /^\d{4}-\d{2}-\d{2}$/, `${source.id} has a review date`);
    }
  }
});
