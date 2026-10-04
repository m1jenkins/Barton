import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { htmlDocument } from '../metro-release.mjs';

const root = new URL('../../', import.meta.url);
const read = name => readFile(new URL(name, root), 'utf8');
const guides = ['blog-buy-new-car-below-msrp.html', 'blog-dealership-addons-complete-guide.html', 'blog-used-car-inspection-checklist.html'];

test('released guides preserve their URLs, source links, examples, byline and ordinary discovery', async () => {
  const hub = htmlDocument(await read('blog.html')), sitemap = await read('sitemap.xml');
  for (const name of guides) {
    const html = await read(name), document = htmlDocument(html);
    assert.equal(document.noindex, false);
    assert.equal(document.h1.length, 1);
    assert.deepEqual(document.canonical, [`https://www.driverightcarbuying.com/${name}`]);
    assert.match(html, /<body class="dr" data-buying-page="guide">/);
    assert.ok(document.links.some(url => /consumer\.ftc\.gov|consumerfinance\.gov|nhtsa\.gov/.test(url)));
    assert.ok(document.links.includes('/compare-car-quotes.html'));
    assert.ok(hub.links.includes(`/${name}`));
    assert.ok(sitemap.includes(`/${name}</loc>`));
    assert.match(document.visibleText, /Mason/);
    assert.match(document.visibleText, /hypothetical/i);
    assert.match(document.visibleText, /\$395 USD/);
    assert.doesNotMatch(document.visibleText, /\bbrief\b|review pending|draft|guaranteed savings|saved \$7,000/i);
    const article = document.schemas.find(schema => schema['@type'] === 'Article');
    assert.equal(article.dateModified, '2026-10-04');
    assert.equal(article.headline, document.h1[0]);
  }
});

test('public worksheet has no tracking or capture scripts and uses the shared tested calculations', async () => {
  const html = await read('compare-car-quotes.html'), document = htmlDocument(html);
  assert.equal(document.noindex, false);
  assert.match(document.visibleText, /Entries stay in this tab and are not saved or submitted/);
  assert.doesNotMatch(html, /googletagmanager|openai-ads|web-analytics|src="\/script\.js|buying\/app\.js|<form[^>]+action=/);
  assert.match(html, /buying\/quote-comparison\.js/);
  assert.match(await read('buying/quote-comparison.js'), /\.\/quote-worksheet\.js/);
  assert.match(await read('draft-artifacts/quote-comparison/worksheet.mjs'), /\.\.\/\.\.\/buying\/quote-worksheet\.js/);
});
