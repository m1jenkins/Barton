import test from 'node:test';
import assert from 'node:assert/strict';
import { fields, parseConversation, parseOpening, nextField, isComplete } from './intake.js';
import { restoreBrief, applyAnswer, briefText, createStore, onboardingValues } from './brief.js';
import { createCheckout, plans } from './checkout.js';
import { validateLeadPayload, validateCheckoutPayload } from '../api/_lib/validation.js';

const draft = () => applyAnswer(restoreBrief(null), parseConversation('A family SUV under $30000 in 02108', 'vehicle'));
const memoryStore = () => { let value; return {read:()=>value,write:v=>{value=structuredClone(v);}}; };

test('five-digit prices and mileage never become ZIPs', () => {
  for (const price of ['$30000','$30,000','$30k']) {
    assert.deepEqual(parseOpening(`A family SUV under ${price} in 78701`), {vehicle:'Family SUV',budget:'Up to $30,000',zip:'78701'});
  }
  assert.deepEqual(parseConversation('30000','budget').values, {budget:'Up to $30,000'});
  assert.deepEqual(parseConversation('$30000','zip').values, {budget:'Up to $30,000'});
  assert.deepEqual(parseConversation('under 40000 miles','mileage').values, {mileage:'Under 40,000 mi'});
  assert.equal(parseConversation('02108','zip').values.zip, '02108');
});
test('only three essentials are needed; vehicle categories are accepted', () => {
  let brief = restoreBrief(null);
  for (const answer of ['a family SUV','$30000','78701']) brief = applyAnswer(brief, parseConversation(answer,nextField(brief.answers,brief.skipped).key));
  assert.equal(isComplete(brief.answers),true);
  assert.equal(brief.answers.vehicle,'Family SUV');
  assert.deepEqual(brief.skipped,{});
});
test('corrections are atomic, preserve unasked fields and reject accidental replacement', () => {
  const original = draft();
  const changed = applyAnswer(original,parseConversation('Change my budget to $35000','year'));
  assert.equal(changed.answers.budget,'Up to $35,000');
  assert.equal(changed.answers.zip,'02108');
  assert.equal(changed.answers.year,undefined);
  assert.equal(original.answers.budget,'Up to $30,000');
  assert.throws(()=>applyAnswer(original,parseConversation('$40000','year')),/already set/);
  assert.throws(()=>applyAnswer(original,{skipped:['budget']}),/required/);
});
test('year suffixes and color exclusions retain the intended constraint', () => {
  assert.equal(parseConversation('2024 or newer','year').values.year,'2024 or newer');
  assert.equal(parseConversation('White, not black','color').values.color,'White, not black');
  assert.throws(()=>parseOpening('Miata, white but not black'),/exclusions/);
});
test('versioning, malformed storage, skips and priorities round-trip safely', () => {
  let brief = applyAnswer(draft(),{skipped:['mileage']});
  brief.priorities.budget = 'prefer';
  brief = applyAnswer(brief,{values:{year:'Any year'}});
  assert.deepEqual(restoreBrief(JSON.parse(JSON.stringify(brief))),brief);
  assert.equal(brief.priorities.year,undefined);
  assert.deepEqual(restoreBrief({version:99,answers:brief.answers}).answers,{});
  assert.match(briefText(brief),/Mileage: Not specified \(skipped\)/);
  assert.match(briefText(brief),/Color: Not specified \(not yet answered\)/);
  assert.match(briefText(brief),/Car-price budget: Up to \$30,000 \[Prefer\]/);
});
test('storage denial keeps in-memory edits and restores from history on refresh', () => {
  const history = {state:null,replaceState(value){this.state=value;}};
  const w = {history};
  Object.defineProperty(w,'localStorage',{get(){throw new Error('denied');}});
  Object.defineProperty(w,'sessionStorage',{get(){throw new Error('denied');}});
  const store = createStore(w);
  assert.equal(store.read(),null);
  store.write(draft());
  assert.equal(store.persistence,'memory');
  assert.deepEqual(createStore(w).read(),draft());
});
test('quota failures fall back to session storage and damaged JSON is ignored', () => {
  let session;
  const store = createStore({localStorage:{getItem(){return '{bad';},setItem(){throw new Error('quota');}},sessionStorage:{getItem(){return session || null;},setItem(k,v){session=v;}}});
  assert.equal(store.read(),null);
  store.write(draft());
  assert.equal(store.persistence,'sessionStorage');
  assert.equal(JSON.parse(session).answers.zip,'02108');
});
test('onboarding carries a complete brief without assigning price to total budget or ZIP to city', () => {
  const brief=applyAnswer(draft(),{values:{year:'2019–2023',mileage:'Under 40000 mi',color:'White',transmission:'Manual',trim:'Sport',radius:'250 miles'}});
  const result=onboardingValues(brief,{name:'Ada',email:'ada@example.test'});
  assert.equal(result.budget,undefined);
  assert.equal(result.city,undefined);
  assert.equal(result.year_min,'2019');
  assert.equal(result.max_mileage,'40000');
  assert.equal(result.vehicle_type,'suv');
  assert.match(result.notes,/not an all-in budget/);
  for (const name of ['Search radius','Trim','Transmission']) assert.ok(result.notes.includes(name));
  assert.equal(onboardingValues(applyAnswer(draft(),{values:{year:'2020 or older'}})).year_min,undefined);
});
test('customer intake survives persistence, editing, download, and onboarding mapping', () => {
  const notes = 'Please call before visiting.\nI have a listing to share: https://example.test/car?price=30000';
  const brief = applyAnswer(draft(), { values: { condition: 'cpo', timeline: 'Within a month', payment_method: 'Financing', trade_in: 'No trade-in', needs: 'Space for two car seats and a dog.', notes } });
  const restored = restoreBrief(JSON.parse(JSON.stringify(brief)));
  assert.deepEqual(restored, brief);
  assert.equal(restored.priorities.notes, undefined);
  assert.equal(restored.priorities.payment_method, undefined);
  const result = onboardingValues(restored);
  assert.equal(result.condition, 'cpo');
  assert.equal(result.timeline, '1-month');
  assert.equal(result.payment_method, 'finance');
  assert.equal(result.trade_in, 'no');
  assert.ok(briefText(restored).includes(notes));
  assert.ok(result.notes.includes('Everyday needs: Space for two car seats and a dog.'));
  assert.ok(result.notes.includes(`Anything else: ${notes}`));
  const edited = applyAnswer(restored, parseConversation('Change my notes to Please arrange Saturday delivery.', 'year'));
  assert.equal(edited.answers.notes, 'Please arrange Saturday delivery.');
  assert.equal(edited.answers.budget, restored.answers.budget);
  assert.equal(onboardingValues(applyAnswer(draft(), { values: { timeline: 'Before October 10', trade_in: '2018 Civic with 70,000 miles' } })).timeline, undefined);
});
test('a maximum-length complete brief fits the existing lead and onboarding notes limit', () => {
  const values = Object.fromEntries(fields.map(field => [field.key, 'x'.repeat(field.maxLength || 180)]));
  Object.assign(values, { year: '2024 or newer', mileage: '999999 miles', budget: '$10000000', zip: '02108', radius: '5000 miles', transmission: 'Automatic' });
  const brief = applyAnswer(restoreBrief(null), { values });
  const message = briefText(brief);
  assert.ok(message.length <= 3000, `Brief has ${message.length} characters`);
  assert.equal(onboardingValues(brief).notes, message);
  assert.doesNotThrow(() => validateLeadPayload({ name: 'Ada Buyer', email: 'ada@example.test', message }));
});
for (const [tier,plan] of Object.entries(plans)) {
  test(`${plan.name} links its validated lead to the selected checkout`, async () => {
    const calls=[];const store=memoryStore();let id=0;
    const flow=createCheckout({store,createId:()=>`request-${++id}`,attribution:{},request:async(url,options)=>{
      const body=JSON.parse(options.body);calls.push({url,body,key:options.headers['Idempotency-Key']});
      if(url==='/api/leads'){validateLeadPayload(body);return {ok:true,lead_id:'71ce2e4c-99b0-4d62-91ef-334605514dcf'};}
      validateCheckoutPayload(body);return {ok:true,url:'https://buy.stripe.com/test-example',attempt_id:'attempt'};
    }});
    const brief = applyAnswer(draft(), { values: { condition: 'Used', timeline: 'Within a month', payment_method: 'Financing', trade_in: '2018 Civic, 70000 miles', needs: 'Room for two car seats', notes: 'Saturday delivery, please.\nCall before a viewing.' } });
    await flow.submit({tier,contact:{name:'Ada Buyer',email:'ADA@example.test'},brief});
    assert.equal(calls[0].body.email,'ada@example.test');
    assert.equal(calls[0].body.phone,'');
    assert.match(calls[0].body.message,/ZIP code: 02108/);
    assert.match(calls[0].body.message,/Trade-in: 2018 Civic, 70000 miles/);
    assert.ok(calls[0].body.message.includes('Saturday delivery, please.\nCall before a viewing.'));
    assert.equal(calls[1].body.tier,tier);
    assert.equal(calls[1].body.lead_id,'71ce2e4c-99b0-4d62-91ef-334605514dcf');
    assert.equal(store.read().lastCheckout.tier,tier);
    assert.deepEqual(store.read().lastCheckout.brief, brief);
  });
}
test('a lost lead response retries identical key and payload even after refresh and attribution change', async () => {
  const store=memoryStore(),calls=[];let count=0;
  const request=async(url,opts)=>{calls.push({url,key:opts.headers['Idempotency-Key'],body:JSON.parse(opts.body)});if(url==='/api/leads'&&++count===1)throw new Error('response lost');return url==='/api/leads'?{ok:true,lead_id:'71ce2e4c-99b0-4d62-91ef-334605514dcf'}:{ok:true,url:'https://buy.stripe.com/test-example'};};
  const options={store,request,createId:()=>crypto.randomUUID(),attribution:{first_touch:{utm_source:'original'}}};
  const input={tier:'full_service',contact:{name:'Ada',email:'ada@example.test'},brief:draft()};
  await assert.rejects(createCheckout(options).submit(input),/response lost/);
  await createCheckout({...options,attribution:{first_touch:{utm_source:'new'}}}).submit(input);
  assert.equal(calls[0].key,calls[1].key);
  assert.deepEqual(calls[0].body,calls[1].body);
});
test('checkout failure and cancellation reuse the saved lead and checkout request', async () => {
  const store=memoryStore(),calls=[];let checkouts=0;
  const request=async(url,opts)=>{calls.push({url,key:opts.headers['Idempotency-Key'],body:opts.body});if(url==='/api/leads')return {ok:true,lead_id:'71ce2e4c-99b0-4d62-91ef-334605514dcf'};if(++checkouts===1)throw new Error('offline');return {ok:true,url:'https://buy.stripe.com/test-example'};};
  const options={store,request,createId:()=>crypto.randomUUID(),attribution:{}};
  const input={tier:'concierge',contact:{name:'Ada',email:'ada@example.test'},brief:draft()};
  await assert.rejects(createCheckout(options).submit(input),/offline/);
  await createCheckout(options).submit(input);
  await createCheckout(options).submit(input);
  assert.equal(calls.filter(c=>c.url==='/api/leads').length,1);
  assert.equal(new Set(calls.filter(c=>c.url==='/api/checkout-start').map(c=>c.key)).size,1);
});
test('changing brief or contact creates a distinct request; a double submit is coalesced', async () => {
  const store=memoryStore(),leads=[];let id=0;
  const flow=createCheckout({store,createId:()=>`request-${++id}`,attribution:{},request:async(url,opts)=>{if(url==='/api/leads'){leads.push(JSON.parse(opts.body));return {ok:true,lead_id:crypto.randomUUID()};}return {ok:true,url:'https://buy.stripe.com/test-example'};}});
  const input={tier:'full_service',contact:{name:'Ada',email:'ada@example.test'},brief:draft()};
  await Promise.all([flow.submit(input),flow.submit(input)]);
  assert.equal(leads.length,1);
  await flow.submit({...input,brief:applyAnswer(draft(),{correction:true,values:{budget:'$35000'}})});
  assert.equal(leads.length,2);
  assert.match(leads[1].message,/35,000/);
});
test('direct purchases require contact and include a readable message without a brief', async () => {
  const store=memoryStore();let lead;
  const flow=createCheckout({store,createId:()=>crypto.randomUUID(),attribution:{},request:async(url,opts)=>{if(url==='/api/leads'){lead=JSON.parse(opts.body);validateLeadPayload(lead);return {ok:true,lead_id:crypto.randomUUID()};}return {ok:true,url:'https://buy.stripe.com/test-example'};}});
  await assert.rejects(flow.submit({tier:'full_service',contact:{},brief:null}),/name/);
  await assert.rejects(flow.submit({tier:'full_service',contact:{name:'Ada',email:'ada@example.test'},honeypot:'spam'}),/submit this form/);
  await flow.submit({tier:'full_service',contact:{name:'Ada',email:'ada@example.test'},brief:null});
  assert.match(lead.message,/No buying brief/);
});
test('stale offer requires another user submit with a new key and preserves the old attempt', async () => {
  const store=memoryStore(),calls=[],events=[];let attempts=0;
  const options={store,createId:()=>crypto.randomUUID(),attribution:{},track:(...e)=>events.push(e),request:async(url,opts)=>{
    calls.push({url,key:opts.headers['Idempotency-Key']});
    if(url==='/api/leads')return {ok:true,lead_id:'71ce2e4c-99b0-4d62-91ef-334605514dcf'};
    if(++attempts===1){const e=new Error('stale_offer');e.code='stale_offer';throw e;}
    return {ok:true,url:'https://buy.stripe.com/new295',attempt_id:'new-attempt'};
  }};
  const input={tier:'full_service',contact:{name:'Buyer',email:'buyer@example.test'},brief:draft()};
  await assert.rejects(createCheckout(options).submit(input), /\$295 USD.*Restart checkout/);
  assert.equal(attempts,1);
  await createCheckout(options).submit(input);
  const checkoutCalls=calls.filter(c=>c.url==='/api/checkout-start');
  assert.notEqual(checkoutCalls[0].key,checkoutCalls[1].key);
  assert.equal(calls.filter(c=>c.url==='/api/leads').length,1);
  assert.equal(store.read().checkouts.length,2);
  assert.equal(store.read().checkouts[0].stale,true);
  assert.equal(events.filter(e=>e[0]==='begin_checkout').length,1);
});
test('retired consultation cannot collect a new lead or checkout',async()=>{
  let called=false;
  const flow=createCheckout({store:memoryStore(),request:()=>{called=true;},createId:()=>crypto.randomUUID(),attribution:{}});
  await assert.rejects(flow.submit({tier:'consultation',contact:{name:'Buyer',email:'buyer@example.test'}}),/Full Service or Ultimate Concierge/);
  assert.equal(called,false);
});
