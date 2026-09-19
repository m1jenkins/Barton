import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { validateAttribution, validateLeadPayload } from '../_lib/validation.js';
const source=await readFile(new URL('../../script.js',import.meta.url),'utf8');
const storage=()=>{const values=new Map();return {getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)};};
function page(url,referrer='',local=storage(),session=storage()) {
 const window={location:new URL(url),localStorage:local,sessionStorage:session,crypto,addEventListener(){},dataLayer:[],setTimeout,clearTimeout};
 const document={referrer,body:{dataset:{}},getElementById:()=>null,querySelectorAll:()=>[]};
 const context=vm.createContext({window,document,URL,URLSearchParams,Date,Set,setTimeout,clearTimeout,console});
 vm.runInContext(source,context);
 return {touch:()=>JSON.parse(vm.runInContext('JSON.stringify(attributionData)',context)),track:(name,p={})=>vm.runInContext(`track(${JSON.stringify(name)},${JSON.stringify(p)})`,context),window,local,session};
}
test('organic acquisition survives pricing navigation and confirmation refresh',()=>{
 const home=page('https://www.driverightcarbuying.com/','https://www.google.com/search?q=private');
 const pricing=page('https://www.driverightcarbuying.com/schedule.html','https://www.driverightcarbuying.com/',home.local,home.session);
 assert.deepEqual(pricing.touch(),home.touch());assert.equal(pricing.touch().last_touch.referrer,'https://www.google.com');
 const confirm=page('https://www.driverightcarbuying.com/payment-success.html?session_id=private','https://checkout.stripe.com/',home.local,home.session);
 assert.deepEqual(confirm.touch(),home.touch());assert.equal(confirm.window.dataLayer.length,0);
});
test('Stripe returns preserve acquisition across confirmation routes and a new session',()=>{
 const home=page('https://www.driverightcarbuying.com/','https://www.google.com/search?q=private');
 for(const route of ['payment-success','payment-success-fullservice','payment-success-concierge','payment-success-consultant']) {
  for(const origin of ['https://checkout.stripe.com','https://buy.stripe.com','https://book.stripe.com']) {
   const returned=page(`https://www.driverightcarbuying.com/${route}.html?utm_source=stripe&session_id=private`,origin,home.local,storage());
   assert.deepEqual(returned.touch(),home.touch());assert.equal(returned.window.dataLayer.length,0);
  }
 }
 const direct=page('https://www.driverightcarbuying.com/payment-success.html','https://checkout.stripe.com');
 assert.equal(direct.touch().first_touch.referrer,'');
});
test('new campaigns and external referrals replace last touch, retaining first touch',()=>{
 const first=page('https://www.driverightcarbuying.com/','https://example.org/article?email=private');
 const campaign=page('https://www.driverightcarbuying.com/schedule.html?utm_source=news&utm_medium=email&utm_campaign=fall','',first.local,first.session);
 assert.deepEqual(campaign.touch().first_touch,first.touch().first_touch);assert.equal(campaign.touch().last_touch.utm_source,'news');
 const referral=page('https://www.driverightcarbuying.com/','https://another.example/path',first.local,first.session);
 assert.equal(referral.touch().last_touch.referrer,'https://another.example');
});
test('storage denial still captures a bounded current touch',()=>{
 const denied={getItem(){throw new Error('denied');},setItem(){throw new Error('denied');}};
 const p=page('https://www.driverightcarbuying.com/?utm_source=search','https://user:secret@google.com/search?q=private',denied,denied);
 assert.equal(p.touch().first_touch.referrer,'https://google.com');assert.equal(p.touch().last_touch.landing_path,'/');
});
test('durable lead and attempt IDs dedupe retries and reloads; intent clicks stay separate',()=>{
 const p=page('https://www.driverightcarbuying.com/');
 for(let i=0;i<3;i++){p.track('generate_lead',{lead_id:'durable-lead'});p.track('begin_checkout',{checkout_attempt_id:'durable-attempt'});}
 p.track('generate_lead');p.track('begin_checkout');p.track('cta_click',{cta_location:'pricing'});p.track('cta_click',{cta_location:'pricing'});
 assert.equal(p.window.dataLayer.length,4);assert.equal(p.window.dataLayer[0].event_id,'lead:durable-lead');
 assert.equal(p.window.dataLayer[1].event_id,'checkout:durable-attempt');
 const reload=page('https://www.driverightcarbuying.com/','',p.local,p.session);reload.track('generate_lead',{lead_id:'durable-lead'});assert.equal(reload.window.dataLayer.length,0);
});
test('server drops referrer credentials, query and fragments, even for forged client attribution',()=>{
 const value=validateAttribution({first_touch:{referrer:'https://user:secret@example.test/path?email=private#token',landing_path:'/schedule.html?session_id=private#contact'},last_touch:{referrer:'javascript:secret'}});
 assert.equal(value.first_touch.referrer,'https://example.test');assert.equal(value.first_touch.landing_path,'/schedule.html');assert.equal(value.last_touch.referrer,'');
 const lead=validateLeadPayload({name:'Buyer',email:'buyer@example.test',message:'Vehicle search',source_page:'/?email=private#token'});assert.equal(lead.source_page,'/');
});

test('pre-release lead hashes preserve lost-response retries while rejecting changed business data',async()=>{
 const {leadRequestHash,matchesLeadRequest}=await import('../leads.js');
 const {payloadHash}=await import('../_lib/validation.js');
 const record={name:'Buyer',email:'buyer@example.test',phone:'',message:'Vehicle search',vehicle:'',source:'website',source_page:'/schedule.html?utm_source=old',attribution:{first_touch:{captured_at:'2026-09-01T00:00:00.000Z',landing_path:'/?utm_source=old',referrer:'https://www.google.com/',utm_source:'',utm_medium:'',utm_campaign:'',utm_content:'',utm_term:''},last_touch:null}};
 record.request_hash=payloadHash(record); // Old validator kept the URL fields verbatim.
 const original=structuredClone(record),hash=leadRequestHash(record);
 assert.notEqual(record.request_hash,hash);assert.equal(matchesLeadRequest(record,hash),true);
 assert.equal(matchesLeadRequest(record,leadRequestHash({...record,email:'different@example.test'})),false);
 assert.equal(matchesLeadRequest(record,leadRequestHash({...record,message:'Different request'})),false);
 assert.deepEqual(record,original);
});
test('historical purchase and queued analytics strip private URL parts without rewriting historical records',async()=>{
 const {purchaseEventPayload}=await import('../_lib/analytics.js');
 const {deliveryEvent}=await import('../_lib/analytics-outbox.js');
 const old={source_page:'/?email=private#token',attribution:{first_touch:{landing_path:'/schedule.html?session_id=private',referrer:'https://user:password@google.com/search?q=private',email:'private'},last_touch:null},email:'private',message:'private buying brief',event_id:'purchase:cs_test_example'};
 const snapshot=structuredClone(old);
 const delivered=deliveryEvent({event_name:'purchase',dedupe_key:'cs_test_example',payload:old,created_at:'2026-09-01'});
 assert.equal(delivered.properties.source_page,'/');assert.equal(delivered.properties.attribution.first_touch.referrer,'https://google.com');assert.equal(delivered.properties.attribution.first_touch.landing_path,'/schedule.html');assert.equal(JSON.stringify(delivered).includes('private'),false);assert.deepEqual(old,snapshot);
 const purchased=purchaseEventPayload({checkoutSessionId:'cs_test_example',sourcePage:old.source_page,attribution:old.attribution,serviceTier:'full_service',amountTotal:49500,currency:'usd'});
 assert.equal(purchased.value,495);assert.equal(purchased.source_page,'/');assert.equal(purchased.page_type,'home');assert.equal(JSON.stringify(purchased).includes('private'),false);
});
