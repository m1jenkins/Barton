import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { csvRows, htmlDocument } from '../metro-release.mjs';
import { renderDealPages } from '../render-deal-pages.mjs';
import { cardEnd, checkNeeds, classify, discountRange, endState, fill, rankCars } from '../deal-model.mjs';

const root = new URL('../../', import.meta.url);
const read = name => readFile(new URL(name, root), 'utf8');
const origin = 'https://www.steermeright.com';
const config = JSON.parse(await read('data/deal-pages.json'));
const vehicles = JSON.parse(await read('data/vehicle-pages.json')).vehicles;
const pages = Object.values(config.pages);

test('deal pages on disk match the data files and the current page chrome', async () => {
  for (const { slug, html } of await renderDealPages()) assert.equal(await read(slug), html, `${slug} is stale; run npm run build:deals`);
});

test('deal pages are indexable, dated, and carry the approved plan lines', async () => {
  const sitemap = await read('sitemap.xml');
  const inventory = csvRows(await read('data/content-inventory.csv'));
  const resources = htmlDocument(await read('blog.html')).links;
  const llms = await read('llms.txt');
  const queries = csvRows(await read('docs/seo-execution/query-map.csv'));
  for (const page of pages) {
    const html = await read(page.slug), document = htmlDocument(html);
    assert.equal(document.noindex, false, page.slug);
    assert.deepEqual(document.canonical, [`${origin}/${page.slug}`], page.slug);
    assert.ok(sitemap.includes(`<loc>${origin}/${page.slug}</loc>`), `${page.slug} sitemap entry`);
    assert.equal(document.h1.length, 1, page.slug);
    const article = document.schemas.flatMap(schema => schema['@graph'] || [schema]).find(node => node['@type'] === 'Article');
    assert.equal(article?.headline, document.h1[0], `${page.slug} Article headline`);
    assert.equal(article.dateModified, html.match(/<time datetime="(\d{4}-\d{2}-\d{2})">/)?.[1], `${page.slug} visible date matches Article.dateModified`);
    assert.match(document.visibleText, /\$395/, page.slug);
    assert.match(document.visibleText, /\$695/, page.slug);
    assert.match(document.visibleText, /Dealers and lenders pay us nothing\./, page.slug);
    assert.match(document.visibleText, /Full refund if you cancel before negotiations begin\./, page.slug);
    assert.match(document.visibleText, /We can’t promise a specific discount/, page.slug);
    assert.match(document.visibleText, /our estimate[^.]*, not a promise\./i, `${page.slug} labels its estimates once`);
    assert.doesNotMatch(JSON.stringify(document.schemas), /AggregateRating|"Review"/, page.slug);
    assert.doesNotMatch(document.visibleText, /\bbrief\b|\bbrokers?\b|average savings|guaranteed|lowest price|best price/i, page.slug);
    assert.doesNotMatch(html, /\bbrief\b|\bbrokers?\b/i, `${page.slug} source, including alt text and metadata`);
    assert.ok(document.links.includes('/schedule.html#full-service'), `${page.slug} links the plan`);
    assert.ok(resources.includes(`/${page.slug}`), `blog.html links /${page.slug}`);
    assert.ok(llms.includes(`${origin}/${page.slug}`), `llms.txt lists ${page.slug}`);
    assert.equal(inventory.find(row => row.canonical_url === `${origin}/${page.slug}`)?.lifecycle_status, 'indexable_owner_publication', page.slug);
    assert.ok(queries.some(row => row.preferred_url === `${origin}/${page.slug}`), `${page.slug} has query-map rows`);
  }
});

test('every outside link on a deal page is a registered, dated source', async () => {
  const registry = csvRows(await read('data/source-registry.csv'));
  for (const [key, page] of [['msrp', config.pages.msrp], ['deals', config.pages.deals]]) {
    const document = htmlDocument(await read(page.slug));
    const outside = [...new Set(document.links.filter(href => /^https?:/.test(href) && new URL(href).origin !== origin))];
    const listed = config.sources[key].map(entry => {
      const source = vehicles.flatMap(vehicle => vehicle.sources).find(item => item.id === entry.from);
      assert.ok(source, `${entry.id} points at ${entry.from}`);
      return source.url;
    });
    const photos = key === 'msrp' ? vehicles.map(vehicle => vehicle.photo).flatMap(image => [image.sourceUrl, image.licenseUrl]).filter(Boolean) : [];
    assert.deepEqual(outside.toSorted(), [...new Set([...listed, ...photos])].toSorted(), `${page.slug} outside links`);
    for (const entry of config.sources[key]) {
      const row = registry.find(item => item.source_id === entry.id);
      assert.equal(row?.article_url, `${origin}/${page.slug}`, entry.id);
      const original = registry.find(item => item.source_id === entry.from);
      assert.equal(row.source_url, original.source_url, `${entry.id} matches the guide's source ${entry.from}`);
      assert.match(row.next_review, /^\d{4}-\d{2}-\d{2}$/, `${entry.id} has a review date`);
    }
  }
});

test('the plan cards are the price guides’ plan cards, word for word', async () => {
  const guide = await read('scripts/render-vehicle-pages.mjs'), mine = await read('scripts/render-deal-pages.mjs');
  for (const text of ['Best if you know the car you want.', '$395', 'One model, with any trims, colors and packages', 'We contact dozens of dealers that have it in stock', 'We negotiate the price and fees', 'Best if you’re torn between a few cars.', '$695', 'We present offers on up to three models', 'We handle the paperwork remotely where we can, so you just pick up your car', 'Shipping help in some cases']) {
    assert.ok(guide.includes(text) && mine.includes(text), text);
  }
});

test('the ranking page lists every guide, in order of the fair-deal midpoint', async () => {
  const ranked = rankCars(vehicles, config);
  for (let i = 1; i < ranked.length; i++) assert.ok(ranked[i - 1].score >= ranked[i].score, `${ranked[i].key} is out of order`);
  const html = await read(config.pages.msrp.slug);
  for (const vehicle of vehicles) assert.ok(html.includes(`href="/${vehicle.slug}"`), `links ${vehicle.slug}`);
  let last = -1;
  for (const row of ranked) {
    const at = html.indexOf(`<a href="/${row.vehicle.slug}">${row.vehicle.name}</a></h4>`);
    assert.ok(at > last, `${row.key} appears after the car ranked above it`);
    last = at;
  }
  const names = new Set(vehicles.map(vehicle => vehicle.slug.replace(/-price\.html$/, '')));
  assert.deepEqual([...names].toSorted(), Object.keys(config.cars).toSorted(), 'data/deal-pages.json covers exactly the guides');
});

test('offers that end November 30 show the date, and ended offers are flagged', async () => {
  const html = await read(config.pages.deals.slug);
  assert.match(html, /November 30, 2026/);
  assert.match(html, /Over in most regions/);
  const document = htmlDocument(html);
  assert.match(document.visibleText, /End dates are the contract or delivery date/);
});

test('the parsers throw on wording they do not know', () => {
  assert.throws(() => discountRange('about 3 percent'), /Unreadable discount/);
  assert.throws(() => fill('{missing}', {}), /Unknown token/);
  assert.throws(() => checkNeeds(vehicles, [{ slug: 'ford-f-150-price.html', text: 'text no guide contains' }], 'test'), /no longer in/);
  assert.throws(() => classify(vehicles[0], { offer: 'Bonus cash', detail: 'Ask the dealer', applies: '', ends: '' }, {}), /no cash figure/);
  assert.deepEqual(endState('November 16, 2026. Dallas and Los Angeles showed a version through November 30.', '2026-11-21').state, 'mostly-over');
  assert.equal(endState('November 30, 2026', '2026-11-21').state, 'live');
  assert.equal(endState('November 12, 2026', '2026-11-21').state, 'over');
  assert.equal(endState('January 4, 2027 (deliveries from November 3, 2026)', '2026-11-21').state, 'live');
  assert.equal(endState('', '2026-11-21').state, 'undated');
  assert.equal(cardEnd('Ends January 4.', '2026-11-21'), '2027-01-04');
  assert.equal(cardEnd('Ends November 30.', '2026-11-21'), '2026-11-30');
});
