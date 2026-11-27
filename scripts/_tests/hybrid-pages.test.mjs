import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { csvRows, htmlDocument } from '../metro-release.mjs';
import { renderHybridPages, loadCars, allSources, scenarioNumbers, carFiles } from '../render-hybrid-pages.mjs';

const root = new URL('../../', import.meta.url);
const read = name => readFile(new URL(name, root), 'utf8');
const origin = 'https://www.steermeright.com';
const { shared, cars, comparisons, vehicles } = await loadCars();
const banned = /\bbrief\b|\bbrokers?\b|average savings|guaranteed|lowest price|best price/i;

test('hybrid pages on disk match data/hybrid-pages and the current page chrome', async () => {
  for (const { slug, html } of await renderHybridPages()) assert.equal(await read(slug), html, `${slug} is stale; run npm run build:hybrids`);
});

test('every car file is named for its key, follows the slug and source-id patterns, and points at a real price guide', async () => {
  assert.ok(cars.length >= 5, 'at least the first five cars');
  assert.deepEqual((await carFiles()).map(file => file.replace(/\.json$/, '')), cars.map(({ car }) => car.key));
  const seen = new Set();
  for (const { car, vehicle } of cars) {
    assert.match(car.slug, /^[a-z0-9]+(-[a-z0-9]+)*-hybrid-vs-gas\.html$/, car.slug);
    assert.equal(car.slug, `${car.priceGuide.replace(/-price\.html$/, '')}-hybrid-vs-gas.html`, `${car.key} slug follows its price guide`);
    assert.equal(car.key, car.priceGuide.replace(/-price\.html$/, ''), `${car.key} key is the price-guide stem`);
    assert.ok(!seen.has(car.slug), `${car.slug} is unique`); seen.add(car.slug);
    assert.equal(car.name, vehicle.name, `${car.key} name matches the price guide`);
    assert.equal(car.h1, `Is the ${car.name} hybrid worth it?`, `${car.key} h1`);
    assert.match(car.code, /^[A-Z0-9]+$/, car.key);
    const sources = allSources(car, shared);
    sources.forEach((source, index) => assert.equal(source.id, `VEH-HYB-${car.code}-${String(index + 1).padStart(2, '0')}`, `${car.key} source ${index + 1} id`));
    assert.equal(new Set(sources.map(source => source.url)).size, sources.length, `${car.key} sources are distinct`);
    for (const key of ['title', 'description', 'verdict', 'chooseHybrid', 'chooseGas', 'scenarios', 'changes', 'incentives', 'resale', 'reddit', 'faq', 'queries', 'blog', 'llms', 'sources']) assert.ok(car[key]?.length ?? Object.keys(car[key] ?? {}).length, `${car.key} has ${key}`);
    assert.ok(car.faq.length >= 3 && car.faq.length <= 5, `${car.key} has 3 to 5 questions`);
    assert.ok(car.title.length <= 65 && car.description.length <= 160, `${car.key} title and description fit a result`);
    assert.match(car.verdict.lead, /^<strong>/, `${car.key} leads with the verdict`);
  }
});

test('prices come from the price guide, EPA figures are cited by vehicle id, and the shared gas prices are dated', async () => {
  assert.match(shared.gasPrices.eia.week, /^\d{4}-\d{2}-\d{2}$/);
  assert.ok(shared.gasPrices.eia.regular > 2 && shared.gasPrices.eia.regular < 8);
  for (const { car, vehicle } of cars) {
    const sources = allSources(car, shared);
    for (const scenario of car.scenarios) {
      const numbers = scenarioNumbers(scenario, vehicle, shared);
      assert.ok(numbers.premium > 0, `${car.key}: ${scenario.label} premium`);
      for (const row of scenario.epa) for (const side of [row.gas, row.hybrid]) {
        assert.ok(side.hwy && side.city && side.comb, `${car.key} ${side.id} has all three EPA figures`);
        assert.ok(sources.some(source => source.url === `https://www.fueleconomy.gov/ws/rest/vehicle/${side.id}`), `${car.key}: EPA vehicle ${side.id} is a listed source`);
      }
      assert.ok(scenario.epa.every(row => row.hybrid.comb > row.gas.comb), `${car.key}: ${scenario.label} the hybrid is rated better`);
    }
    if (car.plugin) assert.ok(sources.some(source => source.url === `https://www.fueleconomy.gov/ws/rest/vehicle/${car.plugin.epa.id}`), `${car.key} plug-in EPA record`);
  }
});

test('hybrid pages are indexable, dated, lead with a verdict and carry the approved plan lines', async () => {
  const sitemap = await read('sitemap.xml');
  const inventory = csvRows(await read('data/content-inventory.csv'));
  const resources = htmlDocument(await read('blog.html')).links;
  const llms = await read('llms.txt');
  const queries = csvRows(await read('docs/seo-execution/query-map.csv'));
  for (const { car, vehicle } of cars) {
    const name = car.slug, html = await read(name), document = htmlDocument(html);
    assert.equal(document.noindex, false, name);
    assert.deepEqual(document.canonical, [`${origin}/${name}`], name);
    assert.ok(sitemap.includes(`<loc>${origin}/${name}</loc>`), `${name} sitemap entry`);
    assert.equal(document.h1.length, 1, name);
    const article = document.schemas.flatMap(schema => schema['@graph'] || [schema]).find(node => node['@type'] === 'Article');
    assert.equal(article?.headline, document.h1[0], `${name} Article headline`);
    assert.equal(article.dateModified, html.match(/<time datetime="(\d{4}-\d{2}-\d{2})">/)?.[1], `${name} visible date matches Article.dateModified`);
    assert.equal(article.datePublished, '2026-11-21', name);
    assert.match(document.visibleText, /\$395/, name);
    assert.match(document.visibleText, /\$695/, name);
    assert.match(document.visibleText, /Dealers and lenders pay us nothing\./, name);
    assert.match(document.visibleText, /Full refund if you cancel before negotiations begin\./, name);
    assert.match(document.visibleText, /We can’t promise a specific discount/, name);
    assert.match(document.visibleText, /our estimates[^.]*, not a promise\./i, `${name} labels the fuel costs as estimates`);
    assert.doesNotMatch(JSON.stringify(document.schemas), /AggregateRating|"Review"/, name);
    assert.doesNotMatch(document.visibleText, banned, name);
    assert.doesNotMatch(JSON.stringify(car), banned, `${car.key} data`);
    assert.doesNotMatch(JSON.stringify(car), /—/, `${car.key} data has no em dashes`);
    assert.ok(document.links.includes('/#full-service'), `${name} links the Steer Me Right plan`);
    assert.ok(document.links.includes(`/${car.priceGuide}`), `${name} links its price guide`);
    for (const cmp of comparisons.filter(entry => entry.cars.some(item => item.slug === car.priceGuide))) assert.ok(document.links.includes(`/${cmp.slug}`), `${name} links ${cmp.slug}`);
    assert.ok(document.visibleText.includes(shared.gasPrices.eia.label) && document.visibleText.includes(shared.gasPrices.epa.label), `${name} shows both gas prices`);
    assert.match(document.visibleText, /Buy the hybrid if/, name);
    assert.match(document.visibleText, /Buy the gas version if/, name);
    assert.ok(resources.includes(`/${name}`), `blog.html links /${name}`);
    assert.equal(inventory.find(row => row.canonical_url === `${origin}/${name}`)?.lifecycle_status, 'indexable_owner_publication', name);
    assert.ok(llms.includes(`${origin}/${name}`), `${name} is in llms.txt`);
    for (const query of car.queries) assert.ok(queries.some(row => row.query === query && row.preferred_url === `${origin}/${name}`), `${name} query-map row for "${query}"`);
    assert.ok(vehicle, name);
  }
});

test('plan cards are word for word the price guides’ plan cards', async () => {
  const guide = await read('scripts/render-vehicle-pages.mjs');
  const mine = await read('scripts/render-hybrid-pages.mjs');
  const cards = text => text.slice(text.indexOf('const planCards = ['), text.indexOf('const tick'));
  assert.equal(cards(mine).trim(), cards(guide).trim());
});

test('every outside link on a hybrid page is a registered, dated source', async () => {
  const registry = csvRows(await read('data/source-registry.csv'));
  for (const { car, vehicle } of cars) {
    const document = htmlDocument(await read(car.slug));
    const outside = [...new Set(document.links.filter(href => /^https?:/.test(href) && new URL(href).origin !== origin))];
    const sources = allSources(car, shared);
    const photo = [vehicle.photo.sourceUrl, vehicle.photo.licenseUrl].filter(Boolean);
    assert.deepEqual(outside.toSorted(), [...new Set([...sources.map(source => source.url), ...photo])].toSorted(), `${car.slug} outside links`);
    for (const source of sources) {
      const row = registry.find(entry => entry.source_id === source.id);
      assert.equal(row?.source_url, source.url, `${source.id} is in data/source-registry.csv`);
      assert.equal(row.article_url, `${origin}/${car.slug}`, source.id);
      assert.match(row.effective_date, /retrieved 2026-\d{2}-\d{2}/, `${source.id} is dated`);
      assert.match(row.next_review, /^\d{4}-\d{2}-\d{2}$/, `${source.id} has a review date`);
    }
  }
});

test('the numbers on each page are the ones the renderer works out from EPA, the price guide and the EIA price', async () => {
  for (const { car, vehicle } of cars) {
    const html = await read(car.slug);
    const first = scenarioNumbers(car.scenarios[0], vehicle, shared);
    const fifteen = first.rows[0].cells.find(cell => cell.priceKey === 'eia' && cell.miles === 15000);
    const years = (Math.round(fifteen.breakEven * 10) / 10).toFixed(1);
    assert.ok(html.includes(`vp-strip__source">Break-even</span><span class="vp-strip__score">${first.atMost ? 'up to ' : ''}${years}<small>`), `${car.slug} strip break-even ${years}`);
    assert.ok(html.includes(`$${first.premium.toLocaleString('en-US')}`), `${car.slug} shows the premium`);
    for (const scenario of car.scenarios) for (const row of scenarioNumbers(scenario, vehicle, shared).rows) for (const cell of row.cells) {
      assert.ok(html.includes(`${(Math.round(cell.breakEven * 10) / 10).toFixed(1)}</strong> years`), `${car.slug} shows break-even ${cell.breakEven}`);
    }
  }
});

test('the Reddit section uses the car’s own coded file and quotes no comments', async () => {
  const { summarizeCar } = await import('../reddit-sentiment.mjs');
  for (const { car, coded } of cars) {
    const html = await read(car.slug), summary = summarizeCar(coded);
    assert.match(html, /<section id="reddit" class="vp-section">/, car.slug);
    assert.ok(html.includes(`counted ${summary.topics.mpg.mentions.toLocaleString('en-US')} opinions`), `${car.slug} shows the computed fuel-economy count`);
    assert.doesNotMatch(car.reddit.lead, /["“”]|\bu\/|https?:/, `${car.key} Reddit lead is a paraphrase`);
  }
});
