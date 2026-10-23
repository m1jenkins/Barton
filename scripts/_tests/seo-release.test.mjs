import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
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
 assert.deepEqual(registry.services.map(s=>s.price),[395,695]);
 for(const tier of NEW_CHECKOUT_TIERS)assert.equal(plans[tier].fee*100,SERVICE_TIERS[tier].amount);
 for(const file of ['index.html','schedule.html','how-it-works.html']) {
  const html=await read(file),doc=htmlDocument(html);
  assert.equal((html.match(/class="plan-card"/g)||[]).length,2);
  assert.doesNotMatch(html,/data-(?:plan|service-tier)="consultation"|#service-consultation|\$495|\$195/);
  assert.match(doc.visibleText,/\$395/);assert.match(doc.visibleText,/\$695/);
 }
 for(const file of ['index.html','schedule.html']) {
  const services=htmlDocument(await read(file)).schemas.flatMap(s=>s['@graph']||[]).filter(n=>n['@type']==='Service');
  assert.deepEqual(services.map(s=>Number(s.offers.price)),[395,695]);
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
test('retirement redirects and existing noindex decisions remain consistent',async()=>{
 const config=JSON.parse(await read('vercel.json'));
 assert.ok(config.redirects.some(r=>r.source==='/ai-car-buying-agent.html'&&r.destination==='/schedule.html'&&[301,308].includes(r.statusCode??(r.permanent===true?308:0))));
 for(const file of ['ai-car-buying-agent.html','tesla-fsd-for-sale.html','payment-success-consultant.html'])assert.equal(htmlDocument(await read(file)).noindex,true,file);
 for(const file of ['index.html','schedule.html','how-it-works.html','about.html','blog.html'])assert.ok(!htmlDocument(await read(file)).links.some(h=>/ai-car-buying-agent|tesla-fsd-for-sale/.test(h)),file);
});
test('payment adapter and checkout module URLs invalidate cached old offers',async()=>{
 const hash=s=>createHash('sha256').update(s).digest('hex').slice(0,12);
 const scriptHash=hash(await read('script.js')),appHash=hash(await read('buying/app.js')),checkoutHash=hash(await read('buying/checkout.js'));
 for(const file of ['index.html','schedule.html','how-it-works.html'])assert.ok((await read(file)).includes(`/script.js?v=${scriptHash}`),file);
 assert.ok((await read('buying/app.js')).includes(`./checkout.js?v=${checkoutHash}`));
 // Any root page that versions the shared script or buying app must load the current build.
 let versioned=0;
 for(const file of (await readdir(root)).filter(name=>name.endsWith('.html'))){
  const html=await read(file);
  for(const [pattern,current] of [[/src="\/script\.js\?v=([0-9a-f]+)"/g,scriptHash],[/src="\/buying\/app\.js\?v=([0-9a-f]+)"/g,appHash]]){
   for(const [,version] of html.matchAll(pattern)){versioned++;assert.equal(version,current,`${file} ${pattern.source}`);}
  }
 }
 assert.ok(versioned>=24,`${versioned} versioned page references`);
});
test('every root page loads the current header mascot and gates its intro before first paint',async()=>{
 const hash=s=>createHash('sha256').update(s).digest('hex').slice(0,12);
 const cssHash=hash(await read('logo-motion.css')),jsHash=hash(await read('logo-motion.js'));
 for(const file of (await readdir(root)).filter(name=>name.endsWith('.html'))){
  const html=await read(file),head=html.slice(0,html.indexOf('</head>'));
  assert.match(html,/class="(?:wordmark|nav__wordmark)"/,`${file} header wordmark`);
  assert.ok(head.includes(`<link rel="stylesheet" href="/logo-motion.css?v=${cssHash}">`),`${file} logo-motion.css`);
  assert.ok(head.includes(`<script type="module" src="/logo-motion.js?v=${jsHash}"></script>`),`${file} logo-motion.js`);
  assert.match(head,/sessionStorage\.getItem\('dr-logo-intro'\)[\s\S]*?classList\.add\('logo-intro'\)/,`${file} intro gate`);
 }
 for(const name of ['side','wheel','q','side-lg','wheel-lg','q-lg','front'])await readFile(new URL(`assets/mascot/${name}.webp`,root));
 assert.match(await read('.vercelignore'),/^assets\/mascot\/reference$/m,'mascot reference sheets stay out of the deployment');
});
