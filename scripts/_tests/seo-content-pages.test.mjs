import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { htmlDocument } from '../metro-release.mjs';

const root = new URL('../../', import.meta.url);
const read = file => readFile(new URL(file, root), 'utf8');
const newPage = 'car-buying-service.html';

test('service-intent pages publish current prices without retired or unapproved claims', async () => {
  const files = ['index.html', 'how-it-works.html', 'schedule.html', 'about.html', newPage];
  const forbidden = /\$(?:195|495)\b|average savings|savings guarantee|refund(?:s| promise)|streetAddress|reviewCount|aggregateRating|LocalBusiness/i;

  for (const file of files) {
    const html = await read(file);
    assert.doesNotMatch(html, forbidden, file);
  }

  const homepage = htmlDocument(await read('index.html'));
  assert.equal(homepage.h1.length, 1);
  assert.match(homepage.visibleText, /\$295/);
  assert.match(homepage.visibleText, /\$895/);

  for (const file of ['index.html', 'how-it-works.html', 'schedule.html']) {
    const head = (await read(file)).match(/<head>([\s\S]*?)<\/head>/i)?.[1] ?? '';
    for (const [label, pattern] of [
      ['meta description', /<meta name="description"\s+content="([^"]+)"/i],
      ['Open Graph description', /<meta property="og:description"\s+content="([^"]+)"/i],
    ]) {
      const description = head.match(pattern)?.[1] ?? '';
      assert.match(description, /\$295/, `${file} ${label} should include Full Service pricing`);
      assert.match(description, /\$895/, `${file} ${label} should include Ultimate Concierge pricing`);
    }
  }
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
  const claims = await read('data/claims.csv');
  const pricingClaim = claims.split('\n').find(line => line.startsWith('SEO-PRICE-2026-09-18,'));
  assert.match(pricingClaim, /car-buying-service\.html/);
  assert.match(pricingClaim, /about\.html/);
});

test('city and editorial containment remains accurate after homepage copy changes', async () => {
  const cityData = JSON.parse(await read('data/city-pages.json'));
  for (const city of cityData.cities) {
    const html = await read(`draft-artifacts/cities/${city.slug}`);
    const document = htmlDocument(html);
    assert.equal(document.noindex, true, city.slug);
    assert.doesNotMatch(document.visibleText, /buyers buyers/i, city.slug);
    assert.match(document.visibleText, new RegExp(`We help ${city.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} car buyers`, 'i'), city.slug);
  }

  for (const file of ['austin.html', 'arlington.html', 'dallas.html', 'el-paso.html', 'fort-worth.html', 'houston.html', 'new-braunfels.html', 'san-antonio.html', 'san-marcos.html']) {
    assert.equal(htmlDocument(await read(file)).noindex, true, file);
  }

  const hub = htmlDocument(await read('blog.html'));
  assert.match(hub.visibleText, /service guides below are indexable/i);
  assert.match(hub.visibleText, /consequential topic hubs and older articles remain excluded from search/i);
});

