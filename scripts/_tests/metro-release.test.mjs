import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { validateMetroRelease, sha256, origin, htmlDocument } from '../metro-release.mjs';
import { renderDrafts } from '../render-metro-drafts.mjs';
import { createDraftServer } from '../preview-metros.mjs';
const today='2026-09-16';
const review=()=>({status:'approved',reviewer:'Fixture reviewer',qualification:'Fixture subject specialist',reviewedOn:'2026-09-15',expiresOn:'2026-12-15',evidenceRef:'fixture-evidence/record'});
const tier=`${origin}/#service-full`, organization=`${origin}/#organization`;
async function fixture(t,{approved=true}={}) {
 const root=await mkdtemp(path.join(tmpdir(),'barton-metro-'));t.after(()=>rm(root,{recursive:true,force:true}));await mkdir(path.join(root,'data'));
 const write=(file,value)=>writeFile(path.join(root,file),typeof value==='string'?value:JSON.stringify(value));
 const market={id:'M04',slug:'dallas-fort-worth.html',name:'Dallas–Fort Worth',availabilityRef:'owner',tierIds:[tier],releaseStatus:approved?'approved':'draft',serviceBoundary:'Remote only in fixture',sellerLimits:'Fixture seller scope',pickupDeliveryLimits:'Buyer arranges pickup in fixture',responseCapacity:'Fixture operating record',primaryQuery:'Fixture query',serp:{observedOn:today,location:'Dallas fixture',competitors:['a','b','c','d','e']},claimIds:['C1'],sourceIds:['S1']};
 for(const k of ['baseline','demandEvidence','logisticsEvidence','checkoutParity','qualifiedReview','editorialReview','qa'])market[k]=review();
 const page=`<!doctype html><html lang="en"><head><link rel="canonical" href="${origin}/${market.slug}"></head><body><h1>Car buying in Dallas–Fort Worth</h1><p>Fixture approved local statement.</p><a href="/service-areas.html">Areas</a><script type="application/ld+json">${JSON.stringify({'@type':'Service','@id':tier,provider:{'@id':organization},areaServed:{name:market.name}})}</script></body></html>`;
 market.publishedSha256=sha256(page);
 const hubHtml=`<meta name="barton-metro-id" content="hub"><link rel="canonical" href="${origin}/service-areas.html"><h1>Areas</h1><a href="/${market.slug}">Dallas–Fort Worth</a>`;
 const registry={hub:{releaseStatus:approved?'approved':'draft',editorialReview:review(),qualifiedReview:review(),qa:review(),publishedSha256:sha256(hubHtml)},ownerConfirmation:{id:'owner',date:today},markets:[market],legacyTexas:[]};
 const files={
  'data/metro-release.json':registry,
  'data/entities.json':{organization:{id:organization},serviceAreas:approved?[{pageUrl:`${origin}/${market.slug}`,name:market.name,releaseStatus:'approved',providerRef:organization,localBusinessEntity:false}]:[]},
  'data/services.json':{services:[{id:tier,marketApprovals:{M04:review()}}]},
  'data/metro-dossiers.json':[{marketId:'M04',modules:[{claimIds:['C1'],sourceIds:['S1']},{claimIds:['C1'],sourceIds:['S1']}],example:{type:'worksheet'}}],
  'data/claims.csv':'claim_id,status,approved_copy,reviewer,last_reviewed,expires_on\nC1,approved,Fixture approved local statement.,Fixture reviewer,2026-09-15,2026-12-15\n',
  'data/source-registry.csv':'source_id,verification_status,source_url,reviewer,next_review\nS1,approved,https://example.org/authority,Fixture reviewer,2026-12-15\n',
  'data/content-inventory.csv':`canonical_url,source_file,lifecycle_status\n${origin}/${market.slug},${market.slug},${approved?'approved_indexable':'local_only_draft'}\n${origin}/service-areas.html,service-areas.html,${approved?'approved_indexable':'local_only_draft'}\n`,
  '.vercelignore':'draft-artifacts\ndocs\ndata\nscripts\nAGENTS.md\nCLAUDE.md\n',
  'sitemap.xml':`<?xml version="1.0"?><urlset>${approved?`<url><loc>${origin}/${market.slug}</loc></url><url><loc>${origin}/service-areas.html</loc></url>`:''}</urlset>`,
 };
 if(approved){files[market.slug]=page;files['service-areas.html']=hubHtml;}
 for(const [file,value]of Object.entries(files))await write(file,value);
 return {root,write,market,registry,files,page,check:()=>validateMetroRelease(root,{today})};
}
test('eligible approved page, marked hub, registry and sitemap pass together',async t=>{const f=await fixture(t);assert.deepEqual(await f.check(),[]);});
test('private pending market with no public artifacts passes',async t=>{const f=await fixture(t,{approved:false});f.market.qualifiedReview=null;await f.write('data/metro-release.json',f.registry);assert.deepEqual(await f.check(),[]);});
for(const status of ['pending_evidence','pending_qualified_review','revoked','retired'])test(`${status} claim blocks publication`,async t=>{const f=await fixture(t);await f.write('data/claims.csv',f.files['data/claims.csv'].replace('C1,approved,',`C1,${status},`));assert.match((await f.check()).join('\n'),/claim pending, expired, revoked or incomplete/);});
for(const change of ['expired','blank copy','missing reviewer'])test(`${change} claim blocks publication`,async t=>{const f=await fixture(t);let csv=f.files['data/claims.csv'];csv=change==='expired'?csv.replace('2026-12-15','2026-09-15'):change==='blank copy'?csv.replace('Fixture approved local statement.',''):csv.replace('Fixture reviewer','');await f.write('data/claims.csv',csv);assert.notDeepEqual(await f.check(),[]);});
for(const field of ['baseline','demandEvidence','logisticsEvidence','checkoutParity','qualifiedReview','editorialReview','qa','serviceBoundary'])test(`missing ${field} cannot be replaced by owner sign-off`,async t=>{const f=await fixture(t);f.market[field]=null;await f.write('data/metro-release.json',f.registry);assert.match((await f.check()).join('\n'),new RegExp(field==='qualifiedReview'?'qualified review':field));});
test('missing owner confirmation fails closed',async t=>{const f=await fixture(t);delete f.registry.ownerConfirmation;await f.write('data/metro-release.json',f.registry);assert.match((await f.check()).join('\n'),/owner coverage/);});
test('expired source prevents release',async t=>{const f=await fixture(t);await f.write('data/source-registry.csv',f.files['data/source-registry.csv'].replace('2026-12-15','2026-09-15'));assert.match((await f.check()).join('\n'),/source review/);});
test('pending source prevents release',async t=>{const f=await fixture(t);await f.write('data/source-registry.csv',f.files['data/source-registry.csv'].replace('S1,approved','S1,pending'));assert.match((await f.check()).join('\n'),/source review/);});
test('noindex and sitemap disagreement fails',async t=>{const f=await fixture(t);await f.write(f.market.slug,f.page.replace('<head>','<head><meta name="robots" content="noindex, follow">'));assert.match((await f.check()).join('\n'),/indexing\/sitemap disagreement/);});
test('sitemap omission fails for eligible page',async t=>{const f=await fixture(t);await f.write('sitemap.xml','<urlset/>');assert.match((await f.check()).join('\n'),/indexing\/sitemap disagreement/);});
test('noindex does not authorize deploying a new draft',async t=>{const f=await fixture(t,{approved:false});await f.write(f.market.slug,`<meta content='NOINDEX' name='robots'><h1>Unapproved draft</h1>`);assert.match((await f.check()).join('\n'),/publicly deployable/);});
test('legacy bytes can remain noindex but cannot be replaced by unapproved copy',async t=>{const f=await fixture(t,{approved:false});const legacy='<meta name="robots" content="noindex, follow"><h1>Legacy Houston</h1>';f.registry.legacyTexas=[{slug:'houston.html',marketId:'M04',sha256:sha256(legacy),redirectTo:null}];await f.write('data/metro-release.json',f.registry);await f.write('houston.html',legacy);assert.deepEqual(await f.check(),[]);await f.write('houston.html',legacy+'<p>New claim</p>');assert.match((await f.check()).join('\n'),/legacy containment/);});
test('missing draft exclusion or negated ignore rule fails containment',async t=>{const f=await fixture(t);await f.write('.vercelignore','docs\ndata\nscripts\nAGENTS.md\nCLAUDE.md\n');assert.match((await f.check()).join('\n'),/exclude draft-artifacts/);await f.write('.vercelignore',f.files['.vercelignore']+'!draft-artifacts/metros/houston.html\n');assert.match((await f.check()).join('\n'),/re-inclusion/);});
test('unapproved public hub fails even when marked and noindexed',async t=>{const f=await fixture(t,{approved:false});await f.write('service-areas.html','<meta name="barton-metro-id" content="hub"><meta name="robots" content="noindex"><a href="/dallas-fort-worth.html">DFW</a>');const errors=(await f.check()).join('\n');assert.match(errors,/hub approval\/evidence\/artifact mismatch/);assert.match(errors,/no eligible markets/);});
test('new discovery links to pending market fail',async t=>{const f=await fixture(t,{approved:false});await f.write('index.html','<a href="/dallas-fort-worth.html">DFW</a>');assert.match((await f.check()).join('\n'),/discovery link/);});
test('recorded legacy discovery links cannot increase',async t=>{const f=await fixture(t,{approved:false});f.registry.legacyDiscoveryLinks=[{source:'about.html',target:f.market.slug,count:1}];await f.write('data/metro-release.json',f.registry);await f.write('about.html',`<a href="/${f.market.slug}">DFW</a>`);assert.deepEqual(await f.check(),[]);await f.write('about.html',`<a href="/${f.market.slug}">DFW</a><a href="/${f.market.slug}">DFW</a>`);assert.match((await f.check()).join('\n'),/discovery link/);});
test('hub must link each eligible market',async t=>{const f=await fixture(t);await f.write('service-areas.html','<h1>Areas</h1>');assert.match((await f.check()).join('\n'),/Hub missing/);});
for(const kind of ['entity','service','schema','approved text','hash','inventory'])test(`${kind} mismatch blocks public release`,async t=>{const f=await fixture(t);if(kind==='entity')await f.write('data/entities.json',{organization:{id:organization},serviceAreas:[]});if(kind==='service')await f.write('data/services.json',{services:[{id:tier}]});if(kind==='schema')await f.write(f.market.slug,f.page.replace('"@type":"Service"','"@type":"LocalBusiness"'));if(kind==='approved text')await f.write(f.market.slug,f.page.replace('Fixture approved local statement.','Unapproved statement.'));if(kind==='hash')await f.write(f.market.slug,f.page+'<!-- changed -->');if(kind==='inventory')await f.write('data/content-inventory.csv',f.files['data/content-inventory.csv'].replace('approved_indexable','local_only_draft'));assert.notDeepEqual(await f.check(),[]);});
test('malformed or missing registry is a failure, never an empty eligible set',async t=>{const f=await fixture(t);await f.write('data/metro-release.json','{');assert.match((await f.check()).join('\n'),/failed closed/);});
test('HTML parsing ignores commented directives and handles attribute order',()=>{assert.equal(htmlDocument('<!-- <meta name="robots" content="noindex"> -->').noindex,false);assert.equal(htmlDocument("<meta content='noindex, follow' name=robots>").noindex,true);});
test('renderer emits static accessible noindex drafts with actual module text',async t=>{const output=await mkdtemp(path.join(tmpdir(),'barton-render-'));t.after(()=>rm(output,{recursive:true,force:true}));const pages=await renderDrafts({output});assert.equal(pages.size,3);for(const [file,html]of pages){const doc=htmlDocument(html);assert.equal(doc.noindex,true);assert.equal(doc.h1.length,1);assert.deepEqual(doc.canonical,[`${origin}/${file}`]);assert.match(doc.visibleText,/Local editorial draft/);assert.ok(doc.links.includes('#main-content'));}assert.match(htmlDocument(pages.get('houston.html')).visibleText,/Harris County has documented historic flooding/);assert.match(htmlDocument(pages.get('dallas-fort-worth.html')).visibleText,/Tarrant County/);await renderDrafts({output,check:true});await writeFile(path.join(output,'houston.html'),'stale');await assert.rejects(renderDrafts({output,check:true}),/stale draft/);});
test('loopback preview serves only drafts/assets and refuses private files and mutations',async t=>{const server=createDraftServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise(resolve=>server.close(resolve)));const base=`http://127.0.0.1:${server.address().port}`;const response=await fetch(base+'/houston.html');assert.equal(response.status,200);assert.match(response.headers.get('content-security-policy'),/form-action 'none'/);assert.match(await response.text(),/Houston/);for(const route of ['/data/metro-release.json','/.env.local','/api/leads','/api/checkout-start','/docs/metro-city-pages-implementation-plan.md','/draft-artifacts/metros/houston.html'])assert.equal((await fetch(base+route)).status,404);assert.equal((await fetch(base+'/houston.html',{method:'POST',body:'test'})).status,405);const ref=await fetch(base+'/schedule.html');assert.match(await ref.text(),/does not load forms, payment links or tracking/);});
test('a draft copied under a nested deployable path is rejected',async t=>{const f=await fixture(t,{approved:false});await mkdir(path.join(f.root,'unexpected'));await f.write('unexpected/city.html','<meta name="barton-metro-id" content="M04"><meta name="robots" content="noindex"><h1>Copied draft</h1>');assert.match((await f.check()).join('\n'),/unapproved metro artifact published/);});
test('future reviewer date and unknown service tier fail closed',async t=>{const f=await fixture(t);f.market.qualifiedReview.reviewedOn='2027-01-01';f.market.tierIds=['unknown'];await f.write('data/metro-release.json',f.registry);const errors=(await f.check()).join('\n');assert.match(errors,/qualified review/);assert.match(errors,/unknown\/missing service tiers/);});
for(const field of ['editorialReview','qualifiedReview','qa'])test(`marked hub requires its own ${field}`,async t=>{const f=await fixture(t);f.registry.hub[field]=null;await f.write('data/metro-release.json',f.registry);assert.match((await f.check()).join('\n'),/hub approval\/evidence\/artifact mismatch/);});
for(const status of ['draft','revoked'])test(`marked ${status} hub cannot use approved market status`,async t=>{const f=await fixture(t);f.registry.hub.releaseStatus=status;await f.write('data/metro-release.json',f.registry);assert.match((await f.check()).join('\n'),/hub approval\/evidence\/artifact mismatch/);});
test('approved marked hub still requires an eligible market', async t => {
  const f = await fixture(t, { approved: false });
  const hubHtml = `<meta name="barton-metro-id" content="hub"><link rel="canonical" href="${origin}/service-areas.html"><h1>Areas</h1>`;
  f.registry.hub.releaseStatus = 'approved';
  f.registry.hub.publishedSha256 = sha256(hubHtml);
  await f.write('data/metro-release.json', f.registry);
  await f.write('service-areas.html', hubHtml);
  await f.write('data/content-inventory.csv', f.files['data/content-inventory.csv'].replace('service-areas.html,local_only_draft', 'service-areas.html,approved_indexable'));
  await f.write('sitemap.xml', `<urlset><url><loc>${origin}/service-areas.html</loc></url></urlset>`);
  assert.deepEqual(await f.check(), ['service-areas.html: public hub has no eligible markets']);
});
for (const file of ['copied-hub.html', 'unexpected/service-areas.html', 'dallas-fort-worth.html']) {
  test(`hub marker is rejected at ${file} despite a valid canonical hub`, async t => {
    const f = await fixture(t);
    await mkdir(path.dirname(path.join(f.root, file)), { recursive: true });
    await f.write(file, f.files['service-areas.html']);
    assert.ok((await f.check()).includes(`${file}: unapproved metro artifact published`));
  });
}
for (const gate of ['hash', 'canonical', 'inventory', 'indexing', 'sitemap']) {
  test(`marked hub still requires matching ${gate}`, async t => {
    const f = await fixture(t);
    if (gate === 'hash') await f.write('service-areas.html', f.files['service-areas.html'] + '<p>Unreviewed addition.</p>');
    if (gate === 'canonical') await f.write('service-areas.html', f.files['service-areas.html'].replace(`${origin}/service-areas.html`, `${origin}/wrong-hub.html`));
    if (gate === 'inventory') await f.write('data/content-inventory.csv', f.files['data/content-inventory.csv'].replace('service-areas.html,approved_indexable', 'service-areas.html,local_only_draft'));
    if (gate === 'indexing') await f.write('service-areas.html', f.files['service-areas.html'] + '<meta name="robots" content="noindex">');
    if (gate === 'sitemap') await f.write('sitemap.xml', f.files['sitemap.xml'].replace(`<url><loc>${origin}/service-areas.html</loc></url>`, ''));
    const expected = { hash: /hub approval\/evidence\/artifact mismatch/, canonical: /hub canonical mismatch/, inventory: /hub inventory mismatch/, indexing: /indexable sitemap-listed hub/, sitemap: /indexable sitemap-listed hub/ };
    assert.match((await f.check()).join('\n'), expected[gate]);
  });
}
