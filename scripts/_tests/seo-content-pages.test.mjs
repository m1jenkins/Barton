import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { htmlDocument } from '../metro-release.mjs';

const root = new URL('../../', import.meta.url);
const read = file => readFile(new URL(file, root), 'utf8');
const newPage = 'car-buying-service.html';

test('service-intent pages publish current prices without retired or unapproved claims', async () => {
  const files = ['index.html', 'how-it-works.html', 'schedule.html', 'about.html', newPage];
  const forbidden = /\$(?:195|495)\b|average savings|savings guarantee|refund promise|aggregateRating|LocalBusiness/i;

  for (const file of files) {
    const html = await read(file);
    assert.doesNotMatch(html, forbidden, file);
  }

  const homepage = htmlDocument(await read('index.html'));
  assert.equal(homepage.h1.length, 1);
  assert.match(homepage.visibleText, /\$295/);
  assert.match(homepage.visibleText, /\$895/);
});

test('car-buying-service explainer is indexable, canonical, substantial and internally linked', async () => {
  const html = await read(newPage);
  const document = htmlDocument(html);
  const canonical = 'https://www.driverightcarbuying.com/car-buying-service.html';

  assert.equal(document.noindex, false);
  assert.deepEqual(document.canonical, [canonical]);
  assert.equal(document.h1.length, 1);
  assert.match(document.h1[0], /car buying (?:and negotiation )?service/i);
  assert.match(document.visibleText, /not a vehicle dealer/i);
  assert.match(document.visibleText, /Drive Right Auto Sales/i);
  assert.match(document.visibleText, /\$295/);
  assert.match(document.visibleText, /\$895/);
  assert.ok(document.visibleText.split(/\s+/).length >= 650, 'explainer should not be thin');

  for (const file of ['index.html', 'how-it-works.html', 'schedule.html', 'about.html', 'blog.html']) {
    assert.ok(htmlDocument(await read(file)).links.some(link => link.includes(newPage)), `${file} should link to ${newPage}`);
  }

  const sitemap = await read('sitemap.xml');
  assert.match(sitemap, new RegExp(`<loc>${canonical.replaceAll('.', '\\.')}</loc>`));
  const inventory = await read('data/content-inventory.csv');
  assert.match(inventory, new RegExp(`^${canonical.replaceAll('.', '\\.')},${newPage},`, 'm'));
});

