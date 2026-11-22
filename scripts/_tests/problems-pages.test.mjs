import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { csvRows, htmlDocument } from '../metro-release.mjs';
import { baselineOf, firstYear, startOf, problemsCars, renderProblemsPages, yearFigures } from '../render-problems-pages.mjs';

const root = new URL('../../', import.meta.url);
const read = name => readFile(new URL(name, root), 'utf8');
const origin = 'https://www.steermeright.com';
const vehicles = JSON.parse(await read('data/vehicle-pages.json')).vehicles;
const comparisons = JSON.parse(await read('data/comparison-pages.json')).comparisons;
const cars = await problemsCars();
const ready = cars.filter(car => car.status === 'ready');

test('every price guide has a problems file, and a file that is not ready holds only NHTSA settings and counts', () => {
  assert.deepEqual(cars.map(car => car.key).toSorted(), vehicles.map(vehicle => vehicle.slug.replace(/-price\.html$/, '')).toSorted(), 'one file per price guide');
  for (const car of cars) {
    const nhtsa = car.nhtsa;
    assert.ok(nhtsa.make && nhtsa.listings.length && nhtsa.models.length && nhtsa.recallModels.length, `${car.key} NHTSA settings`);
    assert.deepEqual(nhtsa.years, [2016, 2026], `${car.key} years`);
    assert.match(nhtsa.readOn, /^\d{4}-\d{2}-\d{2}$/, `${car.key} readOn`);
    for (let year = nhtsa.years[0]; year <= nhtsa.years[1]; year++) {
      const row = nhtsa.byYear[year];
      assert.ok(row, `${car.key} ${year} row`);
      // Counts and campaign ids only: raw complaint text never enters the repository.
      assert.deepEqual(Object.keys(row).toSorted(), ['complaints', 'components', 'crashes', 'fires', 'recalls'], `${car.key} ${year} fields`);
      assert.ok(Number.isInteger(row.complaints) && row.complaints >= 0, `${car.key} ${year} complaints`);
      for (const [name, n] of Object.entries(row.components)) { assert.equal(name, name.toUpperCase(), `${car.key} component ${name}`); assert.ok(Number.isInteger(n) && n > 0 && n <= row.complaints, `${car.key} ${year} ${name}`); }
      for (const id of row.recalls) assert.match(id, /^[0-9A-Z-]{6,10}$/, `${car.key} ${year} recall id ${id}`);
    }
    if (car.status !== 'ready') assert.equal(car.status, 'stub', `${car.key} status`);
  }
});

test('problems pages on disk match data/problems-pages and the current page chrome', async () => {
  const pages = await renderProblemsPages();
  assert.deepEqual(pages.map(page => page.slug).toSorted(), ready.map(car => car.slug).toSorted());
  for (const { slug, html } of pages) assert.equal(await read(slug), html, `${slug} is stale; run npm run build:problems`);
});

test('problems pages are indexable, dated, carry the plan lines and are listed everywhere a page must be', async () => {
  const sitemap = await read('sitemap.xml'), llms = await read('llms.txt');
  const inventory = csvRows(await read('data/content-inventory.csv'));
  const queries = csvRows(await read('docs/seo-execution/query-map.csv'));
  const blog = await read('blog.html');
  const resources = htmlDocument(blog).links;
  for (const car of ready) {
    const name = car.slug, html = await read(name), document = htmlDocument(html);
    assert.equal(document.noindex, false, name);
    assert.deepEqual(document.canonical, [`${origin}/${name}`], name);
    assert.equal(document.h1.length, 1, name);
    assert.equal(document.h1[0], car.h1, name);
    const article = document.schemas.flatMap(schema => schema['@graph'] || [schema]).find(node => node['@type'] === 'Article');
    assert.equal(article?.headline, document.h1[0], `${name} Article headline`);
    assert.equal(article.dateModified, html.match(/<time datetime="(\d{4}-\d{2}-\d{2})">/)?.[1], `${name} visible date matches Article.dateModified`);
    assert.equal(article.dateModified, car.checkedOn, name);
    assert.match(document.visibleText, /\$395/, name);
    assert.match(document.visibleText, /\$695/, name);
    assert.match(document.visibleText, /Dealers and lenders pay us nothing\./, name);
    assert.match(document.visibleText, /Full refund if you cancel before negotiations begin\./, name);
    assert.match(document.visibleText, /We can’t promise a specific discount/, name);
    assert.match(document.visibleText, /not a promise about any one car\./, `${name} says once that verdicts are not a promise`);
    assert.doesNotMatch(JSON.stringify(document.schemas), /AggregateRating|"Review"/, name);
    assert.doesNotMatch(document.visibleText, /\bbrief\b|\bbrokers?\b|average savings|guaranteed|lowest price|best price/i, name);
    assert.doesNotMatch(html, /\{[a-z]+:|\{guide\}|\{base\}|undefined|NaN/, `${name} has an unresolved token`);
    assert.ok(document.links.includes('/schedule.html#full-service'), `${name} links the plan`);
    assert.ok(document.links.includes(`/${car.guide}`), `${name} links its price guide`);
    for (const cmp of comparisons.filter(entry => entry.cars.some(side => side.slug === car.guide))) assert.ok(document.links.includes(`/${cmp.slug}`), `${name} links ${cmp.slug}`);
    for (const href of document.links.filter(href => href.startsWith('/') && !href.startsWith('//'))) {
      const file = href.split('#')[0].split('?')[0];
      if (file && file.endsWith('.html')) await read(file.slice(1));
    }
    assert.ok(sitemap.includes(`<loc>${origin}/${name}</loc>`), `${name} sitemap entry`);
    assert.ok(resources.includes(`/${name}`), `blog.html links /${name}`);
    assert.ok(blog.includes(`"url": "${origin}/${name}"`), `blog.html ItemList has ${name}`);
    assert.ok(llms.includes(`${origin}/${name}`), `llms.txt has ${name}`);
    assert.equal(inventory.find(row => row.canonical_url === `${origin}/${name}`)?.lifecycle_status, 'indexable_owner_publication', name);
    assert.ok(queries.filter(row => row.preferred_url === `${origin}/${name}`).length >= 3, `${name} has query-map rows`);
  }
});

test('every outside link on a problems page is a registered, dated source', async () => {
  const registry = csvRows(await read('data/source-registry.csv'));
  for (const car of ready) {
    const document = htmlDocument(await read(car.slug));
    const vehicle = vehicles.find(entry => entry.slug === car.guide);
    const photo = [vehicle.photo.sourceUrl, vehicle.photo.licenseUrl].filter(Boolean);
    const outside = [...new Set(document.links.filter(href => /^https?:/.test(href) && new URL(href).origin !== origin))];
    assert.deepEqual(outside.toSorted(), [...new Set([...car.sources.map(source => source.url), ...photo])].toSorted(), `${car.slug} outside links`);
    const code = car.sources[0].id.replace(/-\d+$/, '');
    car.sources.forEach((source, index) => assert.equal(source.id, `${code}-${String(index + 1).padStart(2, '0')}`, `${car.key} source ids run in order`));
    assert.match(code, /^VEH-PRB-[A-Z0-9]+$/, car.key);
    for (const source of car.sources) {
      const row = registry.find(entry => entry.source_id === source.id);
      assert.equal(row?.source_url, source.url, `${source.id} is in data/source-registry.csv`);
      assert.equal(row.article_url, `${origin}/${car.slug}`, source.id);
      assert.match(row.next_review, /^\d{4}-\d{2}-\d{2}$/, `${source.id} has a review date`);
    }
  }
});

test('verdicts follow the stated rule or say why they moved one step, and the rates agree with our comparison pages', () => {
  const tier = (rate, baseline) => rate > 2 * baseline ? 'avoid' : rate > 1.25 * baseline ? 'check' : 'buy';
  for (const car of ready) {
    const figures = yearFigures(car);
    const baseline = baselineOf(figures);
    for (let year = startOf(car); year <= car.nhtsa.years[1]; year++) {
      const entry = car.verdicts[year];
      assert.ok(entry && ['buy', 'check', 'avoid'].includes(entry[0]) && entry[1], `${car.key} ${year} verdict and reason`);
      const item = figures.find(figure => figure.year === year);
      if (item.rate === null) continue;
      const expected = tier(item.rate, baseline);
      if (entry[0] !== expected) assert.match(entry[2] ?? '', new RegExp(`^${expected} to ${entry[0]}: .{15,}`), `${car.key} ${year} is ${entry[0]} but the rule says ${expected}; give the override reason as "${expected} to ${entry[0]}: why"`);
      else assert.equal(entry[2], undefined, `${car.key} ${year} follows the rule and needs no override note`);
    }
    // A partial first sales year (firstSold) may have no rate (the 2017 Model 3 sold about 1,667); every later year needs at least 10,000 (the Ranger sold 32,334 in 2023), which still catches a missing year.
    for (let year = startOf(car); year <= 2025; year++) if (year !== car.firstSold) assert.ok(car.sales[year] > 10000, `${car.key} sales for ${year}`);
    for (const [year, published] of Object.entries(car.publishedRates ?? {})) {
      const fresh = figures.find(figure => figure.year === Number(year)).fresh;
      assert.ok(Math.abs(fresh - published) / published <= 0.05, `${car.key} ${year}: published ${published} against ${fresh.toFixed(1)} from today's counts`);
    }
    // Where a comparison page charts the same model year, the numbers agree.
    for (const cmp of comparisons) {
      const side = cmp.cars.findIndex(entry => entry.slug === car.guide);
      if (side < 0) continue;
      const chart = cmp.reliability.charts.find(entry => /per 100,000 sold, by model year/.test(entry.title));
      if (!chart) continue; // some pairs chart only pooled rates or raw counts
      for (const row of chart.rows) {
        const mine = figures.find(figure => figure.year === Number(row.label))?.rate, theirs = row[side ? 'b' : 'a'];
        assert.ok(Math.abs(mine - theirs) <= Math.max(3, theirs * 0.05), `${car.key} ${row.label}: ${mine} here, ${theirs} on ${cmp.slug}`);
      }
    }
    const components = new Set(Object.values(car.nhtsa.byYear).flatMap(row => Object.keys(row.components)));
    for (const problem of car.problems) assert.ok(components.has(problem.component), `${car.key} problem component ${problem.component}`);
    for (const item of car.investigations) assert.match(item.id, /^[A-Z]{2}\d{5,6}$/, `${car.key} investigation id`);
    assert.ok(car.bestYears && car.avoidYears && car.answer.length && car.faq.length >= 4 && car.checks.length >= 4 && car.generations.length, `${car.key} has its copy`);
  }
});
