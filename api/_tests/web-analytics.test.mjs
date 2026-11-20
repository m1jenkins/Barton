import test from 'node:test';
import assert from 'node:assert/strict';
import { createWebAnalytics } from '../../web-analytics.js';

function fixture({ url = 'https://www.steermeright.com/blog.html', gpc = false, referrer = '' } = {}) {
  const scripts = [], calls = [], w = { location: new URL(url), navigator: { globalPrivacyControl: gpc }, va(...args) { calls.push(args); } };
  const d = { referrer, createElement: () => ({}), head: { appendChild(script) { scripts.push(script); } } };
  return { analytics: createWebAnalytics(w, d), scripts, calls };
}

test('website measurement requires explicit permission and loads only once', () => {
  const f = fixture(); f.analytics.setConsent(false); assert.equal(f.scripts.length, 0);
  f.analytics.setConsent(true); f.analytics.setConsent(true);
  assert.equal(f.scripts.length, 1);
  assert.equal(f.scripts[0].src, '/_vercel/insights/script.js');
  assert.equal(f.scripts[0].referrerPolicy, 'no-referrer');
  assert.equal(f.calls[0][0], 'beforeSend');
  assert.equal(f.calls[1][0], 'reset');
});

test('GPC, previews, receipts, the worksheet and unknown routes never load the SDK', () => {
  for (const options of [{ gpc: true }, { url: 'https://preview.vercel.app/' }, { url: 'http://localhost/' },
    ...['/success.html', '/payment-success.html', '/payment-success-fullservice.html', '/compare-car-quotes.html', '/api/leads', '/customer/private@example.test'].map(path => ({ url: `https://www.steermeright.com${path}` }))]) {
    const f = fixture(options); f.analytics.setConsent(true); assert.equal(f.scripts.length, 0);
  }
});

test('filter strips queries and fragments, excludes payloads and stops on revocation', () => {
  const f = fixture(); f.analytics.setConsent(true);
  assert.deepEqual(f.analytics.beforeSend({ type: 'pageview', url: 'https://www.steermeright.com/blog.html?email=private#secret', payload: { name: 'private' } }), { type: 'pageview', url: 'https://www.steermeright.com/blog.html' });
  for (const event of [{ type: 'event', url: 'https://www.steermeright.com/' }, { type: 'pageview', url: 'https://other.test/' }, { type: 'pageview', url: 'https://www.steermeright.com/payment-success.html?session_id=secret' }, { type: 'pageview', url: 'not a url' }]) assert.equal(f.analytics.beforeSend(event), null);
  f.analytics.setConsent(false); assert.equal(f.analytics.beforeSend({ type: 'pageview', url: 'https://www.steermeright.com/' }), null);
});

test('external referrer paths, query strings and credentials suppress measurement', () => {
  for (const referrer of ['https://external.test/?email=private', 'https://external.test/private-name', 'https://user:password@external.test/', 'https://external.test/#private', 'invalid']) {
    const f = fixture({ referrer }); f.analytics.setConsent(true); assert.equal(f.scripts.length, 0);
  }
  for (const referrer of ['', 'https://search.example.test/', 'https://www.steermeright.com/schedule.html?private=yes']) {
    const f = fixture({ referrer }); f.analytics.setConsent(true); assert.equal(f.scripts.length, 1);
  }
});

test('measured pages are exactly the indexable sitemap pages, minus the quote worksheet', async () => {
  const { readFileSync, readdirSync } = await import('node:fs');
  const root = new URL('../../', import.meta.url);
  const sitemap = new Set([...readFileSync(new URL('sitemap.xml', root), 'utf8').matchAll(/<loc>https:\/\/www\.steermeright\.com([^<]*)<\/loc>/g)].map(m => m[1] || '/'));
  const measured = (path) => { const f = fixture({ url: `https://www.steermeright.com${path}` }); f.analytics.setConsent(true); return f.scripts.length === 1; };
  for (const path of sitemap) assert.equal(measured(path), path !== '/compare-car-quotes.html', `${path} in the sitemap`);
  for (const file of readdirSync(root).filter(name => name.endsWith('.html'))) {
    if (!sitemap.has(`/${file}`) && file !== 'index.html') assert.equal(measured(`/${file}`), false, `${file} is not in the sitemap`);
  }
});
