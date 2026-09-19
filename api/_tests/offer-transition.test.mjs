import test from 'node:test';
import assert from 'node:assert/strict';
import { checkoutHandler } from '../checkout-start.js';
import { withApiErrors } from '../_lib/http.js';
import { offerKey } from '../_lib/checkout-offer.js';
import { SERVICE_TIERS } from '../_lib/config.js';
import { payloadHash, validateCheckoutPayload, validateOnboardingPayload } from '../_lib/validation.js';
import { recordEvent } from '../stripe-webhook.js';
import webhook from '../stripe-webhook.js';
import { verifiedPurchase } from '../purchase-status.js';

const link='https://buy.stripe.com/test_current';
const ref='71ce2e4c-99b0-4d62-91ef-334605514dcf';
const body={tier:'full_service',source_page:'/schedule.html'};
function env(t) {
 for(const [key,value] of Object.entries({APP_ORIGIN:'http://localhost:3000',STRIPE_PAYMENT_LINK_FULL_SERVICE_URL:link,STRIPE_PAYMENT_LINK_CONCIERGE_URL:link,CHECKOUT_PAUSED:'false'})) {
  const old=process.env[key];process.env[key]=value;t.after(()=>{if(old===undefined)delete process.env[key];else process.env[key]=old;});
 }
}
async function call(handler, input=body, key='checkout:current') {
 const res={headers:{},setHeader(k,v){this.headers[k]=v;},end(v){this.body=JSON.parse(v);}};
 await withApiErrors(handler)({method:'POST',headers:{origin:'http://localhost:3000','content-type':'application/json','idempotency-key':key},body:input},res);
 return res;
}
function attempt(overrides={}) {
 return {id:'attempt',client_reference_id:ref,tier_id:'full_service',request_hash:payloadHash(validateCheckoutPayload(body)),expected_amount:29500,currency:'usd',offer_key:offerKey('full_service',SERVICE_TIERS.full_service,link),...overrides};
}
function checkoutDb(prior,{race=false}={}) {
 const calls=[];let selects=0;
 const sql=async(strings,...values)=>{
  const query=strings.join('?');calls.push({query,values});
  if(query.includes('SELECT id, client_reference_id'))return race&&++selects===1?[]:prior?[prior]:[];
  if(query.includes('INSERT INTO checkout_attempts'))return race?[]:[{id:values[0],client_reference_id:values[1],request_hash:values[3],expected_amount:values[5],currency:values[6],offer_key:values[10]}];
  throw new Error('Unexpected SQL in checkout fixture');
 };
 sql.begin=fn=>fn(sql);sql.json=v=>v;return {sql,calls};
}
test('new Full Service creates a $295 snapshot; retired checkout never touches database',async t=>{
 env(t);const db=checkoutDb();const handler=checkoutHandler({getDatabase:()=>db.sql,notify:()=>{}});
 const res=await call(handler);assert.equal(res.statusCode,201);assert.match(res.body.url,/client_reference_id=/);
 assert.equal(db.calls.find(c=>c.query.includes('INSERT')).values[5],29500);
 const count=db.calls.length;const retired=await call(handler,{tier:'consultation'});assert.equal(retired.statusCode,410);assert.equal(retired.body.error,'tier_retired');assert.equal(db.calls.length,count);
});
test('current retry returns same reference; old amount, currency, missing or changed offer key require restart',async t=>{
 env(t);
 for(const overrides of [{},{expected_amount:49500},{currency:'eur'},{offer_key:null},{offer_key:'old-link'}]) {
  const record=attempt(overrides),saved=structuredClone(record),db=checkoutDb(record);
  const res=await call(checkoutHandler({getDatabase:()=>db.sql,notify:()=>{}}));
  assert.equal(res.statusCode,Object.keys(overrides).length?409:200);
  if(Object.keys(overrides).length){assert.equal(res.body.error,'stale_offer');assert.equal(res.body.url,undefined);}
  else assert.equal(new URL(res.body.url).searchParams.get('client_reference_id'),ref);
  assert.deepEqual(record,saved);assert.equal(db.calls.length,1);
 }
});
test('idempotency collision and concurrent stale insert fail closed',async t=>{
 env(t);
 for(const [record,race,error] of [[attempt({request_hash:'other'}),false,'idempotency_conflict'],[attempt({expected_amount:49500}),true,'stale_offer']]) {
  const db=checkoutDb(record,{race});const res=await call(checkoutHandler({getDatabase:()=>db.sql,notify:()=>{}}));
  assert.equal(res.statusCode,409);assert.equal(res.body.error,error);assert.equal(res.body.url,undefined);
 }
});
// Ledger fixture executes the actual webhook transaction branches and dedupe behavior.
function ledger(initialAttempt) {
 const events=new Map(),purchases=new Map(),outbox=new Map();let status;
 const sql=async(strings,...v)=>{
  const q=strings.join('?');
  if(q.includes('INSERT INTO stripe_events')){if(events.has(v[0]))return [];events.set(v[0],'received');return [{event_id:v[0]}];}
  if(q.includes('FROM checkout_attempts'))return v[0]===initialAttempt.client_reference_id?[initialAttempt]:[];
  if(q.includes('UPDATE stripe_events')){events.set(v.at(-1),q.match(/outcome = '([^']+)'/)[1]);return [];}
  if(q.includes('INSERT INTO purchases')){if(purchases.has(v[1]))return [];purchases.set(v[1],{id:v[0],checkout_session_id:v[1],client_reference_id:v[3],tier_id:v[6],amount_total:v[7],currency:v[8],payment_status:'paid'});return [{id:v[0]}];}
  if(q.includes('UPDATE checkout_attempts')){status=q.includes("'paid'")?'paid':'review_required';return [];}
  if(q.includes('INSERT INTO analytics_outbox')){outbox.set(v[0],v[1]);return [];}
  throw new Error('Unexpected SQL in ledger fixture');
 };sql.begin=fn=>fn(sql);sql.json=v=>v;return {sql,events,purchases,outbox,status:()=>status};
}
function event(tier,amount,overrides={}) {return {id:`evt_${tier}`,type:'checkout.session.completed',created:1789776000,livemode:false,data:{object:{id:`cs_test_${tier.replace('_','')}12345678`,object:'checkout.session',mode:'payment',payment_status:'paid',client_reference_id:ref,currency:'usd',amount_total:amount,...overrides}}};}
test('historical $195/$495 and new $295/$895 paid sessions retain their amounts through delayed/replayed webhooks and receipt refresh',async()=>{
 for(const [tier,amount] of [['consultation',19500],['full_service',49500],['full_service',29500],['concierge',89500]]){
  const record=attempt({tier_id:tier,expected_amount:amount,offer_key:null}),db=ledger(record),e=event(tier,amount);
  const unpaid={...e,id:'evt_wait',data:{object:{...e.data.object,payment_status:'unpaid'}}};
  assert.equal((await recordEvent(unpaid,db.sql)).recorded,false);
  assert.equal((await recordEvent({...e,type:'checkout.session.async_payment_succeeded'},db.sql)).recorded,true);
  assert.equal((await recordEvent(e,db.sql)).duplicate,true);
  assert.equal((await recordEvent({...e,id:e.id+'_second'},db.sql)).recorded,false);
  assert.equal(db.purchases.size,1);assert.equal(db.outbox.size,1);assert.equal(record.expected_amount,amount);
  assert.equal([...db.outbox.values()][0].value,amount/100);
  const purchase=[...db.purchases.values()][0];
  for(let refresh=0;refresh<3;refresh++)assert.equal(verifiedPurchase(e.data.object,purchase,tier),true);
  assert.equal(verifiedPurchase({...e.data.object,amount_total:amount+1},purchase,tier),false);
  assert.equal(verifiedPurchase(e.data.object,purchase,'wrong_tier'),false);
  assert.equal(validateOnboardingPayload({tier,session_id:e.data.object.id,fields:{name:'Test Buyer',email:'buyer@example.test',phone:'512-555-0100',city:'Austin'}}).tier,tier);
 }
});
test('tax, discount, currency, wrong reference and unpaid mismatch do not produce a purchase',async()=>{
 for(const overrides of [{amount_total:31934},{amount_total:28000},{currency:'eur'},{client_reference_id:'f5dbf6c1-fb6c-4452-9190-a440527bad07'},{payment_status:'unpaid'}]){
  const db=ledger(attempt());assert.equal((await recordEvent(event('full_service',29500,overrides),db.sql)).recorded,false);assert.equal(db.purchases.size,0);assert.equal(db.outbox.size,0);
 }
});
test('unsigned webhook rejected before database use',async()=>{
 const res={setHeader(){},end(v){this.body=JSON.parse(v);}};await webhook({method:'POST',headers:{}},res);assert.equal(res.statusCode,400);assert.equal(res.body.error,'invalid_signature');
});
test('pre-release checkout hash changes still return stale_offer, including a concurrent old insert',async t=>{
 env(t);
 const raw={tier:'full_service',lead_id:null,source_page:'/schedule.html',attribution:{first_touch:{captured_at:'2026-09-01T00:00:00.000Z',landing_path:'/',referrer:'https://www.google.com/',utm_source:'',utm_medium:'',utm_campaign:'',utm_content:'',utm_term:''},last_touch:null}};
 const old=attempt({expected_amount:49500,offer_key:null,request_hash:payloadHash(raw)});
 assert.notEqual(old.request_hash,payloadHash(validateCheckoutPayload(raw)));
 for(const race of [false,true]){
  const db=checkoutDb(old,{race});const res=await call(checkoutHandler({getDatabase:()=>db.sql,notify:()=>{}}),raw);
  assert.equal(res.statusCode,409);assert.equal(res.body.error,'stale_offer');assert.equal(res.body.url,undefined);
 }
});
