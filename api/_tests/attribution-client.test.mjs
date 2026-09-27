import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { validateAttribution, validateLeadPayload } from '../_lib/validation.js';
const source=await readFile(new URL('../../script.js',import.meta.url),'utf8');
const storage=()=>{const values=new Map();return {getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)};};
function page(url,referrer='',local=storage(),session=storage(),extra={}) {
 const window={location:new URL(url),localStorage:local,sessionStorage:session,crypto,addEventListener(){},dataLayer:[],setTimeout,clearTimeout,...extra};
 const document={referrer,body:{dataset:{}},getElementById:()=>null,querySelectorAll:()=>[]};
 const context=vm.createContext({window,document,URL,URLSearchParams,Date,Set,setTimeout,clearTimeout,console});
 vm.runInContext(source,context);
 return {touch:()=>JSON.parse(vm.runInContext('JSON.stringify(attributionData)',context)),track:(name,p={},o)=>vm.runInContext(`track(${JSON.stringify(name)},${JSON.stringify(p)}${o?`,${JSON.stringify(o)}`:''})`,context),window,local,session};
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
test('track stays fire-and-forget; a navigation wait resolves at once when nothing is sent or GTM is absent',async()=>{
 const p=page('https://www.driverightcarbuying.com/');
 const settledNow=promise=>Promise.race([promise.then(()=>true),new Promise(resolve=>setImmediate(()=>resolve(false)))]);
 assert.equal(p.track('cta_click',{cta_location:'pricing'}),undefined);
 assert.equal(p.track('begin_checkout',{checkout_attempt_id:'attempt'}),undefined);
 assert.equal(p.track('begin_checkout',{checkout_attempt_id:'attempt'}),undefined);
 for(const [event,properties] of [['begin_checkout',{}],['begin_checkout',{checkout_attempt_id:'attempt'}],['purchase_verified',{}]]){
  assert.equal(await settledNow(p.track(event,properties,{beforeNavigation:true})),true,`${event} ${JSON.stringify(properties)}`);
 }
 assert.equal(p.window.dataLayer.length,2);
 assert.equal(await settledNow(p.track('begin_checkout',{checkout_attempt_id:'next'},{beforeNavigation:true})),true);
 assert.equal(p.window.dataLayer.length,3);assert.equal(p.window.dataLayer[2].event_id,'checkout:next');assert.equal(p.window.dataLayer[2].eventTimeout,1000);
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

test('Google click IDs stay in both touches across navigation and Stripe returns but never reach the dataLayer',()=>{
 const gclid='TeSt_Click-1234567890abc';
 const land=page(`https://www.driverightcarbuying.com/car-buying-service.html?gclid=${gclid}&utm_source=google&utm_medium=cpc`,'https://www.google.com/');
 assert.equal(land.touch().first_touch.gclid,gclid);assert.equal(land.touch().last_touch.gclid,gclid);
 const pricing=page('https://www.driverightcarbuying.com/schedule.html','https://www.driverightcarbuying.com/car-buying-service.html',land.local,land.session);
 assert.deepEqual(pricing.touch(),land.touch());
 pricing.track('begin_checkout',{checkout_attempt_id:'attempt-1'});
 assert.equal(pricing.window.dataLayer.length,1);assert.equal(JSON.stringify(pricing.window.dataLayer).includes(gclid),false);
 const returned=page('https://www.driverightcarbuying.com/payment-success-fullservice.html?session_id=private','https://checkout.stripe.com/',land.local,land.session);
 assert.equal(returned.touch().last_touch.gclid,gclid);
});
test('a new ad click replaces the last touch and keeps the first; gbraid and wbraid count as clicks',()=>{
 const first=page('https://www.driverightcarbuying.com/?gclid=FirstClick_000001');
 const second=page('https://www.driverightcarbuying.com/?gclid=SecondClick_00002','',first.local,first.session);
 assert.equal(second.touch().first_touch.gclid,'FirstClick_000001');assert.equal(second.touch().last_touch.gclid,'SecondClick_00002');
 const app=page('https://www.driverightcarbuying.com/?gbraid=0AAAAApp-Braid_1','',first.local,first.session);
 assert.equal(app.touch().last_touch.gbraid,'0AAAAApp-Braid_1');assert.equal(app.touch().last_touch.gclid,undefined);
 const web=page('https://www.driverightcarbuying.com/?wbraid=Web-Braid_000001','',first.local,first.session);
 assert.equal(web.touch().last_touch.wbraid,'Web-Braid_000001');
});
test('malformed or forged click IDs are dropped, never truncated',()=>{
 for(const bad of ['short','has%20space','%3Cscript%3E1234567','x'.repeat(257)]){
  const p=page(`https://www.driverightcarbuying.com/?gclid=${bad}`);
  assert.equal(p.touch().first_touch.gclid,undefined,bad);assert.equal(p.touch().last_touch.gclid,undefined,bad);
 }
 const session=storage();session.setItem('drive_right_last_touch',JSON.stringify({captured_at:'2026-09-01T00:00:00.000Z',landing_path:'/',referrer:'',gclid:'bad value!',gbraid:42}));
 const p=page('https://www.driverightcarbuying.com/schedule.html','',storage(),session);
 assert.equal(p.touch().last_touch.gclid,undefined);assert.equal(p.touch().last_touch.gbraid,undefined);
});
test('Global Privacy Control stops click-ID capture and scrubs stored IDs while keeping UTMs',()=>{
 const ok=page('https://www.driverightcarbuying.com/?gclid=StoredClick_00001&utm_source=google');
 assert.equal(ok.touch().first_touch.gclid,'StoredClick_00001');
 const gpc=page('https://www.driverightcarbuying.com/schedule.html?gclid=NewClick_0000001&utm_source=google','',ok.local,ok.session,{navigator:{globalPrivacyControl:true}});
 assert.equal(gpc.touch().first_touch.gclid,undefined);assert.equal(gpc.touch().last_touch.gclid,undefined);
 assert.equal(gpc.touch().last_touch.utm_source,'google');
 assert.equal(ok.local.getItem('drive_right_first_touch').includes('StoredClick'),false);
 assert.equal(ok.session.getItem('drive_right_last_touch').includes('Click_'),false);
});
test('touches without click IDs keep exactly the legacy keys on the client and the server',()=>{
 const legacy=['captured_at','landing_path','referrer','utm_campaign','utm_content','utm_medium','utm_source','utm_term'];
 const p=page('https://www.driverightcarbuying.com/?utm_source=news','https://example.org/');
 assert.deepEqual(Object.keys(p.touch().first_touch).sort(),legacy);
 const server=validateAttribution({first_touch:{utm_source:'news'},last_touch:{gclid:'',gbraid:null}});
 assert.deepEqual(Object.keys(server.first_touch).sort(),legacy);assert.deepEqual(Object.keys(server.last_touch).sort(),legacy);
});
test('server keeps valid click IDs, drops bad ones without rejecting, and the analytics forwarder strips them',async()=>{
 const value=validateAttribution({first_touch:{gclid:' Valid_Click-0001 ',gbraid:'short',wbraid:{}},last_touch:{gclid:'bad value!',wbraid:'Web-Braid_000001'}});
 assert.equal(value.first_touch.gclid,'Valid_Click-0001');assert.equal(value.first_touch.gbraid,undefined);assert.equal(value.first_touch.wbraid,undefined);
 assert.equal(value.last_touch.gclid,undefined);assert.equal(value.last_touch.wbraid,'Web-Braid_000001');
 const {purchaseEventPayload}=await import('../_lib/analytics.js');
 const payload=JSON.stringify(purchaseEventPayload({checkoutSessionId:'cs_test_123',purchaseId:'purchase',checkoutAttemptId:'attempt',leadId:null,sourcePage:'/schedule.html',serviceTier:'full_service',amountTotal:39500,currency:'usd',attribution:value}));
 assert.equal(payload.includes('Valid_Click-0001'),false);assert.equal(payload.includes('Web-Braid'),false);assert.equal(payload.includes('"attribution"'),true);
});
