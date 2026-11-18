import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { csvRows, htmlDocument } from '../metro-release.mjs';
import { renderVehiclePages } from '../render-vehicle-pages.mjs';

const root = new URL('../../', import.meta.url);
const read = name => readFile(new URL(name, root), 'utf8');
const origin = 'https://www.steermeright.com';
const data = JSON.parse(await read('data/vehicle-pages.json'));

test('vehicle price pages on disk match data/vehicle-pages.json and the current page chrome', async () => {
  for (const { slug, html } of await renderVehiclePages()) assert.equal(await read(slug), html, `${slug} is stale; run npm run build:vehicles`);
});

test('vehicle price pages are indexable, dated, labelled as estimates and carry the approved plan lines', async () => {
  const sitemap = await read('sitemap.xml');
  const inventory = csvRows(await read('data/content-inventory.csv'));
  const resources = htmlDocument(await read('blog.html')).links;
  for (const vehicle of data.vehicles) {
    const name = vehicle.slug, html = await read(name), document = htmlDocument(html);
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
    assert.match(document.visibleText, /We can’t promise a specific discount/, name);
    assert.match(document.visibleText, /our estimate[^.]*, not a promise\./i, `${name} labels the discount ranges as estimates`);
    // Other publishers' scores are quoted with links, never marked up as our own rating.
    assert.doesNotMatch(JSON.stringify(document.schemas), /AggregateRating|"Review"/, name);
    assert.doesNotMatch(document.visibleText, /\bbrief\b|\bbrokers?\b|average savings|guaranteed|lowest price|best price/i, name);
    assert.ok(document.links.includes('/schedule.html#full-service'), `${name} links the Steer Me Right plan`);
    assert.ok(resources.includes(`/${name}`), `blog.html links /${name}`);
    assert.equal(inventory.find(row => row.canonical_url === `${origin}/${name}`)?.lifecycle_status, 'indexable_owner_publication', name);
  }
});

test('every outside link on a vehicle price page is a registered, dated source', async () => {
  const registry = csvRows(await read('data/source-registry.csv'));
  for (const vehicle of data.vehicles) {
    const document = htmlDocument(await read(vehicle.slug));
    const outside = [...new Set(document.links.filter(href => /^https?:/.test(href) && new URL(href).origin !== origin))];
    assert.deepEqual(outside.toSorted(), [...new Set([...vehicle.sources.map(source => source.url), ...[vehicle.photo, ...vehicle.gallery, vehicle.spotlight?.photo].filter(Boolean).flatMap(image => [image.sourceUrl, image.licenseUrl])].filter(Boolean))].toSorted(), `${vehicle.slug} outside links`);
    for (const source of vehicle.sources) {
      const row = registry.find(entry => entry.source_id === source.id);
      assert.equal(row?.source_url, source.url, `${source.id} is in data/source-registry.csv`);
      assert.equal(row.article_url, `${origin}/${vehicle.slug}`, source.id);
      assert.match(row.next_review, /^\d{4}-\d{2}-\d{2}$/, `${source.id} has a review date`);
    }
  }
});

// Car-versus-car pages (data/comparison-pages.json) are built by the same script and held to the same rules.
const comparisons = JSON.parse(await read('data/comparison-pages.json')).comparisons;

test('comparison pages are indexable, dated, labelled as estimates and carry the approved plan lines', async () => {
  const sitemap = await read('sitemap.xml');
  const inventory = csvRows(await read('data/content-inventory.csv'));
  const resources = htmlDocument(await read('blog.html')).links;
  for (const cmp of comparisons) {
    const name = cmp.slug, html = await read(name), document = htmlDocument(html);
    assert.equal(document.noindex, false, name);
    assert.deepEqual(document.canonical, [`${origin}/${name}`], name);
    assert.ok(sitemap.includes(`<loc>${origin}/${name}</loc>`), `${name} sitemap entry`);
    assert.equal(document.h1.length, 1, name);
    for (const car of cmp.cars) assert.ok(data.vehicles.some(vehicle => vehicle.slug === car.slug), `${name} compares ${car.slug}, which has a price guide`);
    assert.match(document.visibleText, /\$395/, name);
    assert.match(document.visibleText, /\$695/, name);
    assert.match(document.visibleText, /Dealers and lenders pay us nothing\./, name);
    assert.match(document.visibleText, /Full refund if you cancel before negotiations begin\./, name);
    assert.match(document.visibleText, /We can’t promise a specific discount/, name);
    assert.match(document.visibleText, /our estimate[^.]*, not a promise\./i, name);
    assert.doesNotMatch(JSON.stringify(document.schemas), /AggregateRating|"Review"/, name);
    assert.doesNotMatch(document.visibleText, /\bbrief\b|\bbrokers?\b|average savings|guaranteed|lowest price|best price/i, name);
    assert.ok(document.links.includes('/schedule.html#concierge'), `${name} links the Pro plan`);
    assert.ok(resources.includes(`/${name}`), `blog.html links /${name}`);
    assert.equal(inventory.find(row => row.canonical_url === `${origin}/${name}`)?.lifecycle_status, 'indexable_owner_publication', name);
  }
});

test('every outside link on a comparison page is a registered, dated source', async () => {
  const registry = csvRows(await read('data/source-registry.csv'));
  for (const cmp of comparisons) {
    const document = htmlDocument(await read(cmp.slug));
    const photos = cmp.cars.map(car => data.vehicles.find(vehicle => vehicle.slug === car.slug).photo).flatMap(image => [image.sourceUrl, image.licenseUrl]).filter(Boolean);
    const outside = [...new Set(document.links.filter(href => /^https?:/.test(href) && new URL(href).origin !== origin))];
    assert.deepEqual(outside.toSorted(), [...new Set([...cmp.sources.map(source => source.url), ...photos])].toSorted(), `${cmp.slug} outside links`);
    for (const source of cmp.sources) {
      const row = registry.find(entry => entry.source_id === source.id);
      assert.equal(row?.source_url, source.url, `${source.id} is in data/source-registry.csv`);
      assert.equal(row.article_url, `${origin}/${cmp.slug}`, source.id);
      assert.match(row.next_review, /^\d{4}-\d{2}-\d{2}$/, `${source.id} has a review date`);
    }
  }
});

test('Reddit Sentiment Index data holds codes only: no comment text and no usernames', async () => {
  const { summarize } = await import('../reddit-sentiment.mjs');
  for (const cmp of comparisons) {
    const coded = JSON.parse(await read(cmp.reddit.dataFile));
    const threads = new Set(coded.threads.map(thread => thread.id));
    for (const comment of coded.comments) {
      assert.deepEqual(Object.keys(comment).sort(), ['id', 'm', 'rec', 'thread'], `${comment.id} carries only its id, thread and codes`);
      assert.ok(threads.has(comment.thread), `${comment.id} belongs to a listed thread`);
    }
    for (const thread of coded.threads) assert.deepEqual(Object.keys(thread).sort(), ['created', 'id', 'subreddit'], thread.id);
    const summary = summarize(coded);
    assert.ok(summary.venues.neutral.comments > 0, `${cmp.slug} has comments from neutral subreddits`);
    const html = await read(cmp.slug);
    for (const side of ['a', 'b']) assert.match(html, new RegExp(`vs-index__score">${summary.index[side]}<`), `${cmp.slug} shows the computed index`);
  }
});

// Per-car Reddit files (data/reddit-sentiment/cars/<key>.json) feed the Reddit section of each price guide and can be
// paired into a comparison by scripts/reddit-sentiment-pair.mjs. They hold Reddit ids and codes, never comment text or
// usernames; theme notes are the coders' paraphrases.
const carFiles = async () => Promise.all((await readdir(new URL('data/reddit-sentiment/cars/', root))).filter(file => file.endsWith('.json')).map(async file => [file, JSON.parse(await read(`data/reddit-sentiment/cars/${file}`))]));

test('per-car Reddit files hold ids and codes only, and every vehicle key is well formed and named', async () => {
  const { keyPattern, topics } = await import('../reddit-sentiment.mjs');
  const models = JSON.parse(await read('data/reddit-sentiment/models.json'));
  for (const key of Object.keys(models)) assert.match(key, keyPattern, `models.json key ${key}`);
  // One key per model, or the same car's opinions split across two keys.
  const names = Object.values(models);
  assert.deepEqual(names.filter((name, i) => names.indexOf(name) !== i), [], 'each model name appears under one key only');
  const known = key => keyPattern.test(key) && Boolean(models[key]);
  const fields = ['car', 'collected', 'comments', 'duplicatePicksDropped', 'gaps', 'home', 'keepThreadPicksDropped', 'keepThreads', 'rules', 'source', 'subreddits', 'themes', 'threads', 'threadsFrom', 'threadsTo', 'uncoded'];
  for (const [file, coded] of await carFiles()) {
    assert.deepEqual(Object.keys(coded).sort(), fields, `${file} fields`);
    assert.equal(file, `${coded.car.key}.json`, file);
    assert.equal(models[coded.car.key], coded.car.name, `${file} car name matches models.json`);
    const threads = new Set();
    for (const thread of coded.threads) {
      assert.deepEqual(Object.keys(thread).sort(), ['created', 'id', 'names', 'subreddit'], `${file} ${thread.id}`);
      assert.match(thread.id, /^[a-z0-9]+$/, `${file} thread id`);
      assert.ok(thread.names.includes(coded.car.key), `${file} ${thread.id} names the car`);
      for (const key of thread.names) assert.ok(known(key), `${file} ${thread.id}: unknown key ${key}`);
      threads.add(thread.id);
    }
    const ids = new Set();
    for (const comment of coded.comments) {
      assert.deepEqual(Object.keys(comment).sort(), ['id', 'm', 'rec', 'thread'], `${file} ${comment.id} carries only its id, thread and codes`);
      assert.match(comment.id, /^[a-z0-9]+$/, `${file} comment id`);
      assert.ok(!ids.has(comment.id), `${file} ${comment.id} is listed once`);
      ids.add(comment.id);
      assert.ok(threads.has(comment.thread), `${file} ${comment.id} belongs to a listed thread`);
      assert.ok(comment.rec === null || known(comment.rec), `${file} ${comment.id}: unknown pick ${comment.rec}`);
      for (const [key, topic, polarity] of comment.m) {
        assert.ok(known(key), `${file} ${comment.id}: unknown key ${key}`);
        assert.ok(topics[topic], `${file} ${comment.id}: topic ${topic}`);
        assert.ok(['pos', 'neg', 'mixed'].includes(polarity), `${file} ${comment.id}: polarity ${polarity}`);
      }
    }
    for (const [topic, sides] of Object.entries(coded.themes)) {
      assert.ok(topics[topic], `${file} theme topic ${topic}`);
      assert.deepEqual(Object.keys(sides).sort(), ['neg', 'pos'], `${file} ${topic}`);
      for (const note of [...sides.pos, ...sides.neg]) assert.doesNotMatch(note, /["“”]|\bu\/|https?:/, `${file} ${topic}: theme notes are paraphrases, never quotes, usernames or links`);
    }
  }
});

test('price guides show the Reddit figures computed from their car file', async () => {
  const { summarizeCar } = await import('../reddit-sentiment.mjs');
  const { carSentimentFile } = await import('../render-vehicle-pages.mjs');
  const files = new Map(await carFiles());
  for (const vehicle of data.vehicles) {
    const file = carSentimentFile(vehicle).split('/').at(-1);
    if (!files.has(file)) continue;
    const summary = summarizeCar(files.get(file)), html = await read(vehicle.slug);
    assert.match(html, new RegExp(`vp-rd-big">${summary.index}<`), `${vehicle.slug} shows the computed index`);
    if (summary.picks.all >= 20) assert.match(html, new RegExp(`vp-rd-big">${summary.picks.share}%<`), `${vehicle.slug} shows the computed pick share`);
    for (const figure of Object.values(summary.topics)) {
      if (figure.mentions < 15) continue;
      const shown = `${figure.net > 0 ? '+' : figure.net < 0 ? '−' : ''}${Math.abs(figure.net)}<span class="sr-only"> net, from ${figure.mentions} mentions`;
      assert.ok(html.includes(shown), `${vehicle.slug} shows a topic net of ${figure.net} from ${figure.mentions} mentions`);
    }
    for (const item of summary.crossShopped) assert.match(html, new RegExp(`${item.threads} threads?</span>`), `${vehicle.slug} cross-shopped count`);
  }
});
