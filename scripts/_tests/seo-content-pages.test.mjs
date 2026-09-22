import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
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

  const homepageHtml = await read('index.html');
  const homepage = htmlDocument(homepageHtml);
  const hero = homepageHtml.match(/<div class="hero-intro" id="hero">([\s\S]*?)<\/div>/)?.[1] ?? '';
  assert.equal(homepage.h1.length, 1);
  assert.match(hero, /Nationwide car buying/);
  assert.match(hero, /Remote research and negotiation\./);
  assert.match(hero, /We research vehicles, compare offers, and negotiate purchases\./);
  assert.doesNotMatch(hero, /\$295|\$895|you remain in control|Full Service|Ultimate Concierge/i);
  assert.match(homepageHtml, /class="hero-fees"/);
  assert.match(homepage.visibleText, /\$295/);
  assert.match(homepage.visibleText, /\$895/);
  assert.match(homepage.visibleText, /Full Service/);
  assert.match(homepage.visibleText, /Ultimate Concierge/);

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

test('homepage Organization schema records owner-confirmed hours and service areas without a storefront', async () => {
  const entities = JSON.parse(await read('data/entities.json'));
  const homepage = htmlDocument(await read('index.html'));
  const organization = homepage.schemas.flatMap(schema => schema['@graph'] || [schema]).find(node => node['@type'] === 'Organization');
  const cities = entities.serviceAreas.map(area => area.name);

  assert.equal(entities.googleBusinessProfile.status, 'owner_confirmed_live');
  assert.equal(entities.googleBusinessProfile.publicUrl, null);
  assert.equal(entities.organization.sameAsStatus, 'pending_owner_confirmation');
  assert.deepEqual(entities.organization.sameAs, []);
  assert.match(entities.organization.sameAsTodo, /TODO: add the public Google Business Profile/);
  assert.equal(entities.businessBase.city, 'Austin');
  assert.equal(entities.businessBase.publicStorefrontConfirmed, false);
  assert.ok(entities.serviceAreas.every(area => area.localBusinessEntity === false));
  assert.equal(entities.businessLocations.length, 0);

  const hours = organization.openingHoursSpecification;
  assert.equal(hours.length, 1);
  assert.deepEqual(hours[0].dayOfWeek, ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']);
  assert.equal(hours[0].opens, '09:00');
  assert.equal(hours[0].closes, '17:00');
  assert.equal(hours[0].timeZone, 'America/Chicago');
  assert.equal(organization.sameAs, undefined);
  assert.equal(organization.streetAddress, undefined);
  assert.equal(organization.address, undefined);
  assert.equal(organization.geo, undefined);

  const served = organization.areaServed.map(entry => entry.name);
  assert.ok(served.includes('United States'));
  for (const city of cities) assert.ok(served.includes(city), city);

  assert.match(homepage.visibleText, /Monday–Friday 09:00–17:00 America\/Chicago/);
  assert.match(await read('policy.html'), /mailto:hello@driverightcarbuying\.com/);
  assert.doesNotMatch(await read('policy.html'), /mason@driverightcarbuying\.com/);
  assert.match(await read('llms.txt'), /\$295 Full Service and \$895 Ultimate Concierge/);
  assert.match(await read('llms.txt'), /AI Agent Buying Service is retired for new sales/);
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

const legalBlogs = [
  'blog-texas-title-transfer.html',
  'blog-texas-car-buying-laws.html',
  'blog-spot-delivery-scam.html',
  'blog-private-party-vs-dealership.html',
];

test('junk /uuyh path is unlinked, disallowed, and not redirected at the GTM slash URL', async () => {
  const robots = await read('robots.txt');
  for (const agent of ['Googlebot', 'Bingbot', '*']) {
    const group = robots.match(new RegExp(`User-agent:\\s*${agent === '*' ? '\\*' : agent}\\s*[\\s\\S]*?(?=\\nUser-agent:|\\n#|$)`));
    assert.ok(group, `robots.txt should include a ${agent} group`);
    assert.match(group[0], /Disallow:\s*\/uuyh\b/, `${agent} must disallow /uuyh`);
  }

  const config = JSON.parse(await read('vercel.json'));
  const slashless = config.redirects.find((rule) => rule.source === '/uuyh' && !rule.has);
  assert.equal(slashless?.destination, '/');
  assert.equal(slashless?.permanent, true);
  assert.equal(
    config.redirects.some((rule) => rule.source === '/uuyh/'),
    false,
    'must not 308 /uuyh/; live Cloudflare serves GTM JavaScript there',
  );

  for (const source of ['/uuyh', '/uuyh/']) {
    const rule = config.headers.find((entry) => entry.source === source);
    assert.ok(rule, `vercel.json should set headers for ${source}`);
    assert.ok(rule.headers.some((header) => header.key === 'X-Robots-Tag' && /noindex/i.test(header.value)));
  }

  assert.doesNotMatch(await read('sitemap.xml'), /uuyh/);

  const htmlFiles = (await readdir(new URL('.', root))).filter((file) => file.endsWith('.html'));
  for (const file of htmlFiles) {
    assert.doesNotMatch(await read(file), /\bhref\s*=\s*["'][^"']*uuyh/i, file);
  }
});

test('legacy blog HTML stays noindex and is documented as crawl waste, not an index request', async () => {
  const files = (await readdir(new URL('.', root))).filter((file) => /^blog-.*\.html$/.test(file));
  assert.ok(files.length >= 30, 'expected the contained blog archive to remain in the public root');
  for (const file of files) {
    assert.equal(htmlDocument(await read(file)).noindex, true, file);
  }

  const sitemap = await read('sitemap.xml');
  assert.doesNotMatch(sitemap, /blog-/);

  const docs = await read('docs/seo/2026-09-21-content-pages.md');
  assert.match(docs, /do not (?:mass[- ])?request index/i);
  assert.match(docs, /crawled currently not indexed/i);
  for (const file of legalBlogs) {
    assert.match(docs, new RegExp(file.replaceAll('.', '\\.')));
  }
});

