import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { htmlDocument } from '../metro-release.mjs';
import { SERVICE_TIERS, NEW_CHECKOUT_TIERS } from '../../api/_lib/config.js';
import { plans } from '../../buying/checkout.js';
const root=new URL('../../',import.meta.url);
const read=file=>readFile(new URL(file,root),'utf8');
const origin='https://www.driverightcarbuying.com';
const fileFor=href=>new URL(href,origin).pathname==='/'?'index.html':new URL(href,origin).pathname.slice(1);

test('active server, browser, registry, visible cards and schema agree on the two authorized offers',async()=>{
 const registry=JSON.parse(await read('data/services.json'));
 assert.deepEqual(Object.keys(plans),NEW_CHECKOUT_TIERS);
 assert.deepEqual(registry.services.map(s=>s.price),[295,895]);
 for(const tier of NEW_CHECKOUT_TIERS)assert.equal(plans[tier].fee*100,SERVICE_TIERS[tier].amount);
 for(const file of ['index.html','schedule.html','how-it-works.html']) {
  const html=await read(file),doc=htmlDocument(html);
  assert.equal((html.match(/class="plan-card"/g)||[]).length,2);
  assert.doesNotMatch(html,/data-(?:plan|service-tier)="consultation"|#service-consultation|\$495|\$195/);
  assert.match(doc.visibleText,/\$295/);assert.match(doc.visibleText,/\$895/);
 }
 for(const file of ['index.html','schedule.html']) {
  const services=htmlDocument(await read(file)).schemas.flatMap(s=>s['@graph']||[]).filter(n=>n['@type']==='Service');
  assert.deepEqual(services.map(s=>Number(s.offers.price)),[295,895]);
  for(const s of services)assert.equal(s.areaServed.name,'United States');
 }
});
test('every indexable sitemap landing page is reachable through ordinary homepage links',async()=>{
 const sitemap=await read('sitemap.xml');const expected=[...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m=>fileFor(m[1]));
 const pending=['index.html'],visited=new Set();
 while(pending.length){
  const file=pending.shift();if(visited.has(file))continue;visited.add(file);
  const html=await read(file),doc=htmlDocument(html);
  for(const href of doc.links){const u=new URL(href,`${origin}/${file}`);if(u.origin!==origin)continue;const next=fileFor(u.href);if(expected.includes(next)&&!visited.has(next))pending.push(next);}
 }
 for(const file of expected){assert.ok(visited.has(file),`${file} orphan`);assert.equal(htmlDocument(await read(file)).noindex,false);}
 assert.equal(expected.includes('ai-car-buying-agent.html'),false);assert.equal(expected.includes('tesla-fsd-for-sale.html'),false);
});
test('retirement redirects and unapproved content stay contained',async()=>{
 const config=JSON.parse(await read('vercel.json'));
 assert.ok(config.redirects.some(r=>r.source==='/ai-car-buying-agent.html'&&r.destination==='/schedule.html'&&[301,308].includes(r.statusCode??(r.permanent===true?308:0))));
 for(const file of ['ai-car-buying-agent.html','tesla-fsd-for-sale.html','payment-success-consultant.html','blog-buy-new-car-below-msrp.html','blog-dealership-addons-complete-guide.html','blog-used-car-inspection-checklist.html'])assert.equal(htmlDocument(await read(file)).noindex,true,file);
 for(const file of ['index.html','schedule.html','how-it-works.html','about.html','blog.html'])assert.ok(!htmlDocument(await read(file)).links.some(h=>/ai-car-buying-agent|tesla-fsd-for-sale/.test(h)),file);
});
test('payment adapter and checkout module URLs invalidate cached old offers',async()=>{
 const hash=s=>createHash('sha256').update(s).digest('hex').slice(0,12);
 const scriptHash=hash(await read('script.js')),checkoutHash=hash(await read('buying/checkout.js'));
 for(const file of ['index.html','schedule.html','how-it-works.html'])assert.ok((await read(file)).includes(`/script.js?v=${scriptHash}`),file);
 assert.ok((await read('buying/app.js')).includes(`./checkout.js?v=${checkoutHash}`));
});
