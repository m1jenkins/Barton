import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { csvRows, htmlDocument } from '../metro-release.mjs';

const root = new URL('../../', import.meta.url);
const read = (file) => readFile(new URL(file, root), 'utf8');
const pageFile = 'tesla-fsd-for-sale.html';
const canonical = 'https://www.driverightcarbuying.com/tesla-fsd-for-sale.html';
const cities = [
  'arlington.html',
  'austin.html',
  'dallas.html',
  'el-paso.html',
  'fort-worth.html',
  'houston.html',
  'new-braunfels.html',
  'san-antonio.html',
  'san-marcos.html',
];
const topicHubs = [
  'texas-car-buying-rules-paperwork.html',
  'auto-financing-credit-fi.html',
  'used-car-due-diligence.html',
  'new-car-pricing-incentives.html',
  'vehicle-selection-total-cost.html',
];

test('tesla FSD page stays a noindex park with self-canonical and no sitemap or redirect', async () => {
  const html = await read(pageFile);
  const document = htmlDocument(html);
  const robots = html.match(/<meta\s+name="robots"\s+content="([^"]+)"/i)?.[1] ?? '';

  assert.equal(document.noindex, true);
  assert.equal(document.conflictingRobots, false);
  assert.equal(robots, 'noindex, follow');
  assert.deepEqual(document.canonical, [canonical]);
  assert.doesNotMatch(await read('sitemap.xml'), /tesla-fsd-for-sale/);

  const vercel = JSON.parse(await read('vercel.json'));
  assert.equal(
    vercel.redirects.some((rule) => /tesla-fsd-for-sale/.test(rule.source) || /tesla-fsd-for-sale/.test(rule.destination ?? '')),
    false,
    'must not 301 tesla-fsd-for-sale.html',
  );
  assert.equal(
    (vercel.headers ?? []).some((rule) => /tesla-fsd-for-sale/.test(rule.source)),
    false,
    'must not attach a gone/noindex header rule that replaces the HTML park',
  );

  assert.match(document.visibleText, /Archived/);
  assert.match(document.visibleText, /not a list of Teslas for sale/i);
  assert.match(document.visibleText, /\$295/);
  assert.match(document.visibleText, /\$895/);
  assert.doesNotMatch(html, /\$195|\$495|savings guarantee|streetAddress|"@type":\s*"LocalBusiness"/i);
  assert.doesNotMatch(html, /Start my FSD Tesla search/i);
  assert.doesNotMatch(html, /Teslas With FSD Included For Sale/);
  assert.equal(
    document.schemas.flatMap((schema) => schema['@graph'] || [schema]).some((node) => node['@type'] === 'Service'),
    false,
    'parked page must not advertise a Tesla FSD Service offer',
  );
  assert.equal(
    document.schemas.some((schema) => schema['@type'] === 'FAQPage'),
    false,
    'do not emit unreviewed FSD FAQ schema',
  );
});

test('tesla FSD inventory and claim rows record the keep-noindex park', async () => {
  const inventory = csvRows(await read('data/content-inventory.csv')).find((row) => row.source_file === pageFile);
  assert.ok(inventory, 'content-inventory.csv must include tesla-fsd-for-sale.html');
  assert.equal(inventory.canonical_url, canonical);
  assert.match(inventory.lifecycle_status, /^contained_/);
  assert.equal(inventory.conversion_role, 'none_while_contained');
  assert.equal(inventory.redirect_destination, '');
  assert.match(inventory.notes, /Keep noindex park/i);
  assert.match(inventory.notes, /2026-09-22/);
  assert.match(inventory.notes, /301 and 410 rejected/);

  const claim = csvRows(await read('data/claims.csv')).find((row) => row.claim_id === 'SEO-TESLA-2026-09-18');
  assert.equal(claim.status, 'contained_pending_qualified_review');
  assert.match(claim.observed_locations, /tesla-fsd-for-sale\.html/);
  assert.match(claim.conflict_or_risk, /keep-noindex park/i);
});

test('docs close the tesla FSD decision as keep-noindex and reject 301/410', async () => {
  const closed = await read('docs/seo/2026-09-21-claim-safety-redirects.md');
  const note = await read('docs/seo/2026-09-22-tesla-fsd-disposition.md');
  const pages = await read('docs/seo/2026-09-21-content-pages.md');

  assert.doesNotMatch(closed, /## Open decision for Mason: `tesla-fsd-for-sale\.html`/);
  assert.match(closed, /Closed decision \(2026-09-22\): `tesla-fsd-for-sale\.html`/);
  assert.match(closed, /Keep noindex park \(status quo\)/);
  assert.match(closed, /301 and 410 remain explicitly rejected/);
  assert.match(note, /Keep noindex park \(status quo\)/);
  assert.match(note, /2026-09-22/);
  assert.match(note, /Rejected for now/);
  assert.match(pages, /Tesla FSD park \(closed 2026-09-22\)/);
});

test('city pages and topic hubs stay noindex and off the sitemap', async () => {
  const sitemap = await read('sitemap.xml');
  for (const file of [...cities, ...topicHubs, pageFile]) {
    assert.equal(htmlDocument(await read(file)).noindex, true, file);
    assert.doesNotMatch(sitemap, new RegExp(file.replaceAll('.', '\\.')));
  }
});
