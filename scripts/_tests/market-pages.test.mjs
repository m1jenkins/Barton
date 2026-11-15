import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { csvRows, htmlDocument } from '../metro-release.mjs';
import { renderMarketPages } from '../render-market-pages.mjs';

const root = new URL('../../', import.meta.url);
const read = name => readFile(new URL(name, root), 'utf8');
const origin = 'https://www.steermeright.com';
const data = JSON.parse(await read('data/market-pages.json'));
const hub = data.hub.slug;
const marketPages = data.markets.map(market => market.slug);
const servicePages = ['car-buying-concierge.html', 'car-finder-service.html', 'new-car-buying-service.html', 'car-buying-help.html'];
const pages = [hub, ...marketPages, ...servicePages];

test('city pages on disk match data/market-pages.json and the current page chrome', async () => {
  for (const { slug, html } of await renderMarketPages()) assert.equal(await read(slug), html, `${slug} is stale; run npm run build:markets`);
});

test('city and service pages are indexable guides with approved Steer Me Right claims and no outside links', async () => {
  const sitemap = await read('sitemap.xml');
  const inventory = csvRows(await read('data/content-inventory.csv'));
  const resources = htmlDocument(await read('blog.html')).links;
  for (const name of pages) {
    const html = await read(name), document = htmlDocument(html);
    assert.equal(document.noindex, false, name);
    assert.deepEqual(document.canonical, [`${origin}/${name}`], name);
    assert.ok(sitemap.includes(`<loc>${origin}/${name}</loc>`), `${name} sitemap entry`);
    assert.equal(document.h1.length, 1, name);
    const article = document.schemas.flatMap(schema => schema['@graph'] || [schema]).find(node => node['@type'] === 'Article');
    assert.equal(article?.headline, document.h1[0], `${name} Article headline`);
    assert.equal(article.dateModified, html.match(/<time datetime="(\d{4}-\d{2}-\d{2})">/)?.[1], `${name} visible date matches Article.dateModified`);

    assert.match(document.visibleText, /\$395/, name);
    assert.match(document.visibleText, /\$695/, name);
    assert.match(document.visibleText, /Dealers and lenders pay us nothing\./, name);
    assert.match(document.visibleText, /Full refund if you cancel before negotiations begin\./, name);
    assert.doesNotMatch(document.visibleText, /\bbrief\b|\bbrokers?\b|average savings|guaranteed|lowest price|best price/i, name);
    // Competitor facts live on the comparison pages, where each outside link has a dated source row.
    assert.deepEqual(document.links.filter(href => /^https?:/.test(href) && new URL(href).origin !== origin), [], `${name} outside links`);
    assert.ok(document.links.includes('/schedule.html#full-service'), `${name} links the Steer Me Right plan`);
    assert.ok(resources.includes(`/${name}`), `blog.html links /${name}`);
    assert.equal(inventory.find(row => row.canonical_url === `${origin}/${name}`)?.lifecycle_status, 'indexable_owner_publication', name);
  }
});

test('each city page says where the office is, dates its listing figures and links the hub and the other cities', async () => {
  const pulled = new Date(`${data.inventory.pulledOn}T12:00:00Z`).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
  const hubDocument = htmlDocument(await read(hub));
  for (const market of data.markets) {
    const document = htmlDocument(await read(market.slug));
    assert.match(document.visibleText, new RegExp(`has no office in ${market.name}`), market.slug);
    assert.match(document.visibleText, new RegExp(`API connector to dealership listings[^.]*pulled ${pulled}`), `${market.slug} dates its figures`);
    assert.ok(document.visibleText.includes(market.new.toLocaleString('en-US')), `${market.slug} shows its own listing count`);
    for (const other of [hub, ...marketPages].filter(slug => slug !== market.slug)) assert.ok(document.links.includes(`/${other}`), `${market.slug} links /${other}`);
    assert.ok(hubDocument.links.includes(`/${market.slug}`), `hub links /${market.slug}`);
    // Service-area pages must not claim a local presence in schema.
    assert.doesNotMatch(JSON.stringify(document.schemas), /LocalBusiness|AutoDealer|streetAddress|"geo"|Review|AggregateRating/, market.slug);
  }
});

test('city pages stay off the URLs reserved by the metro release contract', async () => {
  const registry = JSON.parse(await read('data/metro-release.json'));
  const reserved = new Set([...registry.markets.map(market => market.slug), registry.hub.slug]);
  for (const name of [hub, ...marketPages]) assert.equal(reserved.has(name), false, name);
});
