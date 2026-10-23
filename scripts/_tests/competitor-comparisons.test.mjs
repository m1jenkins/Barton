import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { csvRows, htmlDocument } from '../metro-release.mjs';

const root = new URL('../../', import.meta.url);
const read = name => readFile(new URL(name, root), 'utf8');
const origin = 'https://www.driverightcarbuying.com';
const hub = 'compare-car-buying-services.html';
const pages = [hub, 'caredge-alternatives.html', 'delivrd-alternatives.html'];

test('comparison pages are indexable guides with matching dates, byline and approved Drive Right claims', async () => {
  const sitemap = await read('sitemap.xml');
  for (const name of pages) {
    const html = await read(name), document = htmlDocument(html);
    assert.equal(document.noindex, false, name);
    assert.deepEqual(document.canonical, [`${origin}/${name}`], name);
    assert.ok(sitemap.includes(`<loc>${origin}/${name}</loc>`), `${name} sitemap entry`);
    assert.match(html, /<body class="dr" data-buying-page="guide">/, name);
    assert.equal(document.h1.length, 1, name);

    const article = document.schemas.flatMap(schema => schema['@graph'] || [schema]).find(node => node['@type'] === 'Article');
    assert.equal(article?.headline, document.h1[0], `${name} Article headline`);
    assert.equal(article.author?.url, `${origin}/about.html`, `${name} byline`);
    const shown = html.match(/<time datetime="(\d{4}-\d{2}-\d{2})">/)?.[1];
    assert.equal(article.dateModified, shown, `${name} visible date matches Article.dateModified`);
    assert.match(document.visibleText, new RegExp(`checked[^.]*${new Date(`${shown}T12:00:00Z`).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' })}`, 'i'), `${name} states when competitor facts were checked`);

    // Drive Right facts reuse approved claim rows word for word (SEO-PRICE-2026-10-23, COMPENSATION-COPY-2026-10-05, REFUND-LINE-2026-10-05).
    assert.match(document.visibleText, /\$195/, name);
    assert.match(document.visibleText, /\$345/, name);
    assert.match(document.visibleText, /Dealers and lenders pay us nothing\./, name);
    assert.match(document.visibleText, /Full refund if you cancel before negotiations begin\./, name);
    assert.match(document.visibleText, /not affiliated with/i, `${name} non-affiliation notice`);
    assert.doesNotMatch(document.visibleText, /\bbrief\b|average savings|guaranteed savings/i, name);
  }
});

// Facts about other companies go stale, so every outside link on these pages must trace to a dated row in data/source-registry.csv.
test('every outside source is registered with a dated primary-source check, and no registered source goes unused', async () => {
  const sources = csvRows(await read('data/source-registry.csv'));
  for (const name of pages) {
    const pageUrl = `${origin}/${name}`;
    const linked = new Set(htmlDocument(await read(name)).links
      .map(href => new URL(href, pageUrl))
      .filter(url => /^https?:$/.test(url.protocol) && url.origin !== origin)
      .map(url => url.href));
    const registered = sources.filter(row => row.article_url === pageUrl);
    assert.ok(linked.size > 0, `${name} links to the companies it describes`);
    for (const href of linked) {
      const row = registered.find(entry => new URL(entry.source_url).href === href);
      assert.ok(row, `${name} links ${href} without a source-registry row`);
      assert.equal(row.verification_status, 'primary_source_checked', `${row.source_id} status`);
      assert.match(row.effective_date, /retrieved \d{4}-\d{2}-\d{2}/, `${row.source_id} retrieval date`);
      assert.match(row.next_review, /^\d{4}-\d{2}-\d{2}$/, `${row.source_id} next review`);
    }
    for (const row of registered) assert.ok(linked.has(new URL(row.source_url).href), `${row.source_id} is registered but not linked from ${name}`);
  }
});

test('the hub and both alternatives pages link to each other and are discoverable from Resources and the explainer', async () => {
  for (const name of pages) {
    const links = htmlDocument(await read(name)).links;
    for (const other of pages.filter(page => page !== name)) assert.ok(links.includes(`/${other}`), `${name} links /${other}`);
    assert.ok(links.includes('/schedule.html#full-service'), `${name} links the Full Service plan`);
  }
  const resources = htmlDocument(await read('blog.html')).links;
  for (const name of pages) assert.ok(resources.includes(`/${name}`), `blog.html links /${name}`);
  assert.ok(htmlDocument(await read('car-buying-service.html')).links.includes(`/${hub}`));
  assert.ok(htmlDocument(await read('schedule.html')).links.includes(`/${hub}`));

  const inventory = csvRows(await read('data/content-inventory.csv'));
  for (const name of pages) {
    const row = inventory.find(entry => entry.canonical_url === `${origin}/${name}`);
    assert.equal(row?.source_file, name);
    assert.equal(row.lifecycle_status, 'indexable_owner_publication');
  }
});
