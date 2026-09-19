import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { parse } from 'parse5';
import { htmlDocument } from '../metro-release.mjs';
import { renderCityPages, validateCityData, requestedCities, projectRoot } from '../render-city-pages.mjs';
import { createCityServer } from '../preview-cities.mjs';

function bodyStructure(html) {
  const document = parse(html);
  const body = document.childNodes.find(node => node.tagName === 'html').childNodes.find(node => node.tagName === 'body');
  const structure = node => ({ tag: node.tagName, attrs: node.attrs, children: (node.childNodes || []).filter(child => child.tagName).map(structure) });
  return structure(body);
}

test('all 20 city pages preserve the entire homepage layout, assets, navigation and forms', async t => {
  const output = await mkdtemp(path.join(tmpdir(), 'barton-cities-'));
  t.after(() => rm(output, { recursive: true, force: true }));
  const homepage = await readFile(path.join(projectRoot, 'index.html'), 'utf8');
  const homeStructure = bodyStructure(homepage);
  const data = JSON.parse(await readFile(path.join(projectRoot, 'data/city-pages.json'), 'utf8'));
  const pages = await renderCityPages({ output });
  assert.equal(pages.size, 21);
  assert.deepEqual(data.cities.map(city => city.name), requestedCities);
  const hub = htmlDocument(pages.get('service-areas.html'));
  const homeStyles = [...homepage.matchAll(/<link rel="stylesheet"[^>]+>/g)].map(match => match[0]);
  for (const city of data.cities) {
    const html = pages.get(city.slug);
    const doc = htmlDocument(html);
    assert.deepEqual(bodyStructure(html), homeStructure, `${city.name}: homepage structure drifted`);
    assert.deepEqual([...html.matchAll(/<link rel="stylesheet"[^>]+>/g)].map(match => match[0]), homeStyles);
    assert.equal(doc.noindex, true);
    assert.equal(doc.h1[0], `${city.name} car buying.Consider it handled.`);
    assert.deepEqual(doc.canonical, [`https://www.driverightcarbuying.com/${city.slug}`]);
    assert.ok(hub.links.includes(`/${city.slug}`));
    assert.ok(doc.visibleText.includes(city.localSentence));
    assert.doesNotMatch(html, /city-pages\.(css|js)|city-review-note|local-guide|city-worksheet/);
    for (const section of ['legwork-section', 'pricing-preview']) {
      const pattern = new RegExp(`<section class="${section}[^]*?<\\/section>`);
      assert.equal(html.match(pattern)[0], homepage.match(pattern)[0], `${city.name}: ${section} differs`);
    }
    const nodes = doc.schemas[0]['@graph'];
    assert.equal(nodes.filter(n => n['@type'] === 'Service').length, 3);
    for (const node of nodes.filter(n => n['@type'] === 'Service')) {
      assert.equal(node.areaServed.name, city.name);
      assert.equal(node.provider['@id'], 'https://www.driverightcarbuying.com/#organization');
    }
    assert.ok(!nodes.some(n => ['LocalBusiness', 'AutoDealer', 'Review', 'AggregateRating'].includes(n['@type']) || n.address || n.geo));
    assert.equal(html, await readFile(path.join(projectRoot, 'draft-artifacts/cities', city.slug), 'utf8'));
  }
  await renderCityPages({ output, check: true });
  await writeFile(path.join(output, 'seattle.html'), 'stale');
  await assert.rejects(renderCityPages({ output, check: true }), /stale city page/);
});

test('city data stays limited to the requested cities and short introductions', async () => {
  const data = JSON.parse(await readFile(path.join(projectRoot, 'data/city-pages.json'), 'utf8'));
  const missing = structuredClone(data);
  delete missing.cities[0].localSentence;
  assert.throws(() => validateCityData(missing), /short local sentence/);
  const duplicate = structuredClone(data);
  duplicate.cities[0].slug = duplicate.cities[1].slug;
  assert.throws(() => validateCityData(duplicate), /Duplicate city slug/);
  const changed = structuredClone(data);
  changed.cities.pop();
  assert.throws(() => validateCityData(changed), /requested 20 cities/);
});

test('preview serves the homepage, cities and real shared assets without exposing private files or APIs', async t => {
  const server = await createCityServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const pages = await renderCityPages({ check: true });
  const paths = new Set(['/', '/accessibility.css', '/accessibility.js', '/buying/intake.js', '/buying/brief.js', '/buying/checkout.js', '/openai-ads.js']);
  for (const [slug, html] of pages) {
    paths.add(`/${slug}`);
    for (const match of html.matchAll(/(?:src|href)="(\/[^"#]+)"/g)) paths.add(match[1]);
    for (const match of html.matchAll(/(\/assets\/[^\s,"]+) \d+w/g)) paths.add(match[1]);
  }
  const responses = await Promise.all([...paths].map(async route => {
    const response = await fetch(origin + route);
    await response.arrayBuffer();
    return { route, response };
  }));
  for (const { route, response } of responses) {
    assert.equal(response.status, 200, route);
    assert.equal(response.headers.get('x-robots-tag'), 'noindex, nofollow');
    assert.match(response.headers.get('content-security-policy'), /form-action 'none'/);
  }
  for (const route of ['/data/city-pages.json', '/.env', '/scripts/render-city-pages.mjs', '/draft-artifacts/cities/austin.html', '/buying/brief.test.js', '/%2e%2e/data/services.json']) assert.equal((await fetch(origin + route)).status, 404, route);
  const api = await fetch(origin + '/api/leads', { method: 'POST', body: '{}' });
  assert.equal(api.status, 503);
  assert.match((await api.json()).error, /local preview/);
  assert.equal((await fetch(origin + '/austin.html', { method: 'POST', body: 'test' })).status, 405);
  assert.equal(await (await fetch(origin + '/austin.html', { method: 'HEAD' })).text(), '');
  assert.equal(await (await fetch(origin + '/')).text(), await readFile(path.join(projectRoot, 'index.html'), 'utf8'));
  assert.equal(await (await fetch(origin + '/schedule.html')).text(), await readFile(path.join(projectRoot, 'schedule.html'), 'utf8'));
});
