import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
const source = await readFile(new URL('../../script.js', import.meta.url), 'utf8');
// gtm: undefined (not loaded), 'callback' (runs eventCallback after its tags) or 'silent'.
function page(href, path = '/car-buying-service.html', failOnce = false, gtm) {
  const attrs = new Map([['href', href]]), handlers = {}, events = {}, calls = [], redirects = [], order = [];
  const link = {dataset:{},innerHTML:'Choose this plan',textContent:'Choose this plan',getAttribute:k=>attrs.get(k),setAttribute:(k,v)=>attrs.set(k,v),removeAttribute:k=>attrs.delete(k),addEventListener:(k,fn)=>handlers[k]=fn};
  const storage = () => { const data = new Map(); return {getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)}; };
  const location = new URL(path, 'https://www.driverightcarbuying.com'); location.assign=url=>{order.push('redirect');redirects.push(url);};
  const dataLayer = [];
  dataLayer.push = item => {order.push(`push:${item.event}`);Array.prototype.push.call(dataLayer,item);if(gtm==='callback'&&item.eventCallback)setImmediate(()=>{order.push('callback');item.eventCallback('GTM-W577B3D4');});return dataLayer.length;};
  const window = {location,localStorage:storage(),sessionStorage:storage(),crypto,dataLayer,...(gtm?{google_tag_manager:{'GTM-W577B3D4':{}}}:{}),setTimeout,clearTimeout,alert(){},addEventListener:(k,fn)=>events[k]=fn};
  const document = {referrer:'',body:{dataset:{}},getElementById:()=>null,querySelectorAll:selector=>selector.includes('a[href*="schedule.html#"]')?[link]:[]};
  const fetch = async (url, options) => {calls.push({url,...options});if(failOnce && calls.length===1)throw new Error('Network lost');return {ok:true,json:async()=>({ok:true,url:'https://buy.stripe.com/example',attempt_id:'attempt'})};};
  vm.runInNewContext(source, {window,document,URL,URLSearchParams,Date,Set,setTimeout,clearTimeout,console,crypto,AbortController,fetch});
  return {link,events,window,calls,redirects,order,click:()=>handlers.click?.({preventDefault(){}})};
}
const tick = () => new Promise(resolve => setImmediate(resolve));
async function until(check) { for (let i = 0; i < 200 && !check(); i++) await tick(); }
for(const [hash,tier] of [['full-service','full_service'],['concierge','concierge'],['contact-full_service','full_service'],['contact-concierge','concierge']]) {
  test(`service selection ${hash} opens Stripe without a lead or contact form`,async()=>{
    const p=page(`/schedule.html#${hash}`);
    assert.ok(p.window.driveRightClient, 'checkout adapter is available before DOMContentLoaded');
    await p.click();
    assert.equal(p.calls.length,1);
    assert.equal(p.calls[0].url,'/api/checkout-start');
    const body=JSON.parse(p.calls[0].body);
    assert.equal(body.tier,tier);assert.equal(body.lead_id,null);assert.equal(body.name,undefined);assert.equal(body.email,undefined);
    assert.equal(body.source_page,'/car-buying-service.html');
    assert.deepEqual(p.redirects,['https://buy.stripe.com/example']);
    p.events.pageshow();assert.equal(p.link.getAttribute('aria-disabled'),undefined);
  });
}
test('failed direct checkout retries the same attempt without collecting details',async()=>{
 const p=page('/schedule.html#full-service','/',true);
 await p.click();assert.equal(p.link.getAttribute('aria-disabled'),undefined);
 await p.click();assert.equal(p.calls.length,2);
 assert.equal(p.calls[0].headers['Idempotency-Key'],p.calls[1].headers['Idempotency-Key']);
 assert.equal(p.redirects.length,1);
});
test('begin_checkout lets GTM finish its tags before Stripe opens',async()=>{
 const p=page('/schedule.html#full-service','/car-buying-service.html',false,'callback');
 await p.click();
 assert.deepEqual(p.order,['push:begin_checkout','callback','redirect']);
 const [event]=p.window.dataLayer;
 assert.equal(event.event_id,'checkout:attempt');assert.equal(event.eventTimeout,1000);assert.equal(typeof event.eventCallback,'function');
 assert.deepEqual(p.redirects,['https://buy.stripe.com/example']);
});
test('a GTM that never calls back holds the Stripe redirect for at most one second',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});
 const p=page('/schedule.html#concierge','/car-buying-service.html',false,'silent');
 p.click();
 await until(()=>p.order.length);
 t.mock.timers.tick(999);await tick();
 assert.deepEqual(p.order,['push:begin_checkout']);
 t.mock.timers.tick(1);await until(()=>p.redirects.length);
 assert.deepEqual(p.order,['push:begin_checkout','redirect']);
});
test('without GTM the Stripe redirect does not wait',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});
 const p=page('/schedule.html#full-service');
 p.click();
 await until(()=>p.redirects.length);
 assert.deepEqual(p.order,['push:begin_checkout','redirect']);
});
test('unrelated and external schedule fragments do not trigger checkout',async()=>{
 for(const href of ['/schedule.html#pricing','https://other.example/schedule.html#concierge']){const p=page(href);await p.click();assert.equal(p.calls.length,0);}
});
test('pricing retry has no pre-purchase contact inputs',async()=>{
 const html=await readFile(new URL('../../schedule.html',import.meta.url),'utf8');
 assert.doesNotMatch(html,/id="(?:buyer-name|buyer-email|plan-contact-form|checkout-turnstile)"/);
 assert.match(html,/id="checkout-submit"[^>]*type="button"/);
});
