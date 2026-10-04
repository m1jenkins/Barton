const openAIAds = { track(...args) { try { window.driveRightOpenAIAds?.track(...args); } catch {} } };
import("./openai-ads.js?v=da560ef53873").catch(() => {});
import("./web-analytics.js?v=26da362313b5").catch(() => {});
// Shared adapter for the redesigned buying pages; legacy page handlers stay intact.
window.addEventListener('DOMContentLoaded', () => {
  window.driveRightClient = { requestJson, track, createId, attribution: attributionData };
  window.dispatchEvent(new Event('drive-right-client-ready'));
});
async function yieldToMain(){return"scheduler"in window&&"yield"in scheduler?await scheduler.yield():new Promise(e=>setTimeout(e,0))}const dataLayer=window.dataLayer=window.dataLayer||[],nav=document.getElementById("nav")||document.querySelector?.(".site-header"),hamburger=document.getElementById("hamburger"),mobileMenu=document.getElementById("mobile-menu"),mobileClose=document.getElementById("mobile-close");let lastFocusedElement=null;function createId(){return window.crypto&&typeof window.crypto.randomUUID=="function"?window.crypto.randomUUID():`${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`}function pageContext(){const e=window.location.pathname.split("/").pop()||"index.html",o={"arlington.html":"Arlington","austin.html":"Austin","dallas.html":"Dallas","el-paso.html":"El Paso","fort-worth.html":"Fort Worth","houston.html":"Houston","new-braunfels.html":"New Braunfels","san-antonio.html":"San Antonio","san-marcos.html":"San Marcos"},n={"ai-car-buying-agent.html":"agent_service","blog.html":"all_topics","how-it-works.html":"service_comparison","texas-car-buying-rules-paperwork.html":"texas_rules_and_risk","auto-financing-credit-fi.html":"financing","used-car-due-diligence.html":"used_car_due_diligence","new-car-pricing-incentives.html":"new_car_pricing","vehicle-selection-total-cost.html":"vehicle_selection","texas-local-market-intelligence.html":"texas_metros"},t=e==="index.html"?"home":e.startsWith("blog-")?"article":e==="ai-car-buying-agent.html"?"service_landing":n[e]?"resource_hub":o[e]?"local_service_area":e==="schedule.html"?"service":e.startsWith("payment-success")?"payment_confirmation":"other";return{page_type:t,cluster:t==="article"?e.replace(/^blog-/,"").replace(/\.html$/,""):n[e]||"",city:o[e]||""}}const emittedConversions = new Set();
const NAVIGATION_TRACK_TIMEOUT_MS = 1000;
// Conversions need their durable server ID and are sent once per browser session.
// With beforeNavigation, the returned promise resolves when GTM's eventCallback
// runs, after the timeout, or at once when GTM is not loaded.
function track(event, properties = {}, { beforeNavigation = false } = {}) {
  const skipped = () => beforeNavigation ? Promise.resolve() : undefined;
  let eventId = createId();
  if (event === 'generate_lead' || event === 'begin_checkout' || event === 'purchase_verified') {
    const id = event === 'generate_lead' ? properties.lead_id : event === 'begin_checkout' ? properties.checkout_attempt_id : properties.transaction_id;
    if (!id) return skipped();
    eventId = `${event === 'generate_lead' ? 'lead' : event === 'begin_checkout' ? 'checkout' : 'purchase_verified'}:${id}`;
    const key = `drive_right_event_${eventId}`;
    if (emittedConversions.has(eventId)) return skipped();
    try { if (window.sessionStorage.getItem(key)) return skipped(); } catch {}
    emittedConversions.add(eventId);
    try { window.sessionStorage.setItem(key, '1'); } catch {}
  }
  openAIAds.track(event, properties);
  const context = pageContext(), first = attributionData?.first_touch || {}, last = attributionData?.last_touch || {};
  const payload = {event, event_id:eventId, page_type:context.page_type, topic_cluster:context.cluster, city:context.city,
    first_touch_source:first.utm_source || '', first_touch_medium:first.utm_medium || '', first_touch_campaign:first.utm_campaign || '', first_touch_referrer:first.referrer || '', first_touch_landing_path:first.landing_path || '',
    last_touch_source:last.utm_source || '', last_touch_medium:last.utm_medium || '', last_touch_campaign:last.utm_campaign || '', last_touch_referrer:last.referrer || '', last_touch_landing_path:last.landing_path || '', ...properties};
  if (!beforeNavigation) { try { dataLayer.push(payload); } catch { /* Measurement cannot interrupt a saved lead or checkout. */ } return; }
  return new Promise(resolve => {
    let done = false;
    const finish = () => { if (done) return; done = true; window.clearTimeout(timer); resolve(); };
    const timer = window.setTimeout(finish, NAVIGATION_TRACK_TIMEOUT_MS);
    try {
      dataLayer.push({ ...payload, eventCallback: finish, eventTimeout: NAVIGATION_TRACK_TIMEOUT_MS });
      if (!window.google_tag_manager) finish();
    } catch { finish(); }
  });
}
// Called only after /api/purchase-status verifies the paid session. The server
// purchase ID is the transaction ID, so a refresh or a GTM conversion tag can dedupe it.
function trackVerifiedPurchase(result) {
  try {
    if (!result || result.verified !== true) return;
    const { purchase_id: purchaseId, value, currency, tier } = result;
    if (typeof purchaseId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(purchaseId)) return;
    if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return;
    if (typeof currency !== 'string' || !/^[A-Z]{3}$/.test(currency)) return;
    const properties = { transaction_id: purchaseId, value, currency, service_tier: tier };
    track('purchase_verified', properties);
    // Verification can finish before the optional tracker imports. Reaching the same
    // adapter after import closes that race; its purchase ID suppresses duplicates.
    import('./openai-ads.js?v=da560ef53873').then(({ openAIAds: ads }) => ads.track('purchase_verified', properties)).catch(() => {});
  } catch {}
}
// Stripe's return URL carries the Checkout Session ID, which also unlocks the one-time intake.
// Each payment page's inline head script moves it into sessionStorage before GTM loads, so tags
// and Clarity never see it. This reads it back, and makes the same move if that script did not run.
// The verified ID stays in memory, never in the DOM, where Clarity would record it.
let verifiedCheckoutSessionId = '';
function checkoutSessionId() {
  const key = `drive_right_checkout_session:${window.location.pathname}`;
  let id = '';
  try {
    const query = new URLSearchParams(window.location.search), hash = new URLSearchParams(window.location.hash.slice(1));
    let inQuery = false, inHash = false;
    for (const name of ['session_id', 'checkout_session_id']) {
      if (query.has(name)) { id ||= query.get(name); query.delete(name); inQuery = true; }
      if (hash.has(name)) { id ||= hash.get(name); hash.delete(name); inHash = true; }
    }
    if (inQuery || inHash) {
      const search = query.toString(), fragment = inHash ? hash.toString() : window.location.hash.slice(1);
      window.history.replaceState(window.history.state, '', window.location.pathname + (search ? `?${search}` : '') + (fragment ? `#${fragment}` : ''));
    }
  } catch {}
  try {
    if (id) window.sessionStorage.setItem(key, id);
    else id = window.sessionStorage.getItem(key) || '';
  } catch {}
  return id || window.driveRightCheckoutSession || '';
}
function onScroll(){nav&&nav.classList.toggle("scrolled",window.scrollY>60||nav.dataset.lightNav==="true")}window.addEventListener("scroll",onScroll,{passive:!0}),onScroll();function setMenuState(e){if(!mobileMenu||!hamburger)return;const o=()=>{mobileMenu.classList.toggle("open",e),mobileMenu.setAttribute("aria-hidden",String(!e)),mobileMenu.inert=!e,hamburger.setAttribute("aria-expanded",String(e)),document.body.style.overflow=e?"hidden":""};document.startViewTransition?document.startViewTransition(o):o(),e?(lastFocusedElement=document.activeElement,mobileMenu.querySelector('button, a, input, select, textarea, [tabindex]:not([tabindex="-1"])')?.focus()):lastFocusedElement&&typeof lastFocusedElement.focus=="function"&&lastFocusedElement.focus()}hamburger&&mobileMenu&&mobileClose&&(hamburger.addEventListener("click",()=>setMenuState(!0)),mobileClose.addEventListener("click",()=>setMenuState(!1)),mobileMenu.querySelectorAll("a").forEach(e=>{e.addEventListener("click",()=>setMenuState(!1))}),mobileMenu.addEventListener("keydown",e=>{if(e.key==="Escape"){setMenuState(!1);return}if(e.key!=="Tab")return;const o=Array.from(mobileMenu.querySelectorAll('button, a, input, select, textarea, [tabindex]:not([tabindex="-1"])')).filter(r=>!r.disabled&&r.offsetParent!==null);if(!o.length)return;const n=o[0],t=o[o.length-1];e.shiftKey&&document.activeElement===n?(e.preventDefault(),t.focus()):!e.shiftKey&&document.activeElement===t&&(e.preventDefault(),n.focus())})),document.querySelectorAll(".reveal").forEach(e=>{e.classList.add("visible")}),document.querySelectorAll('a[href^="#"]').forEach(e=>{e.addEventListener("click",o=>{const n=e.getAttribute("href");if(!n||n==="#")return;let t;try{t=document.querySelector(n)}catch{return}if(!t)return;o.preventDefault();const r=nav?nav.offsetHeight+8:8,i=t.getBoundingClientRect().top+window.pageYOffset-r;window.scrollTo({top:i,behavior:"smooth"})})});function attribution() {
  const params = new URLSearchParams(window.location.search);
  // Google ad click IDs let a verified purchase be matched to its ad click. Only
  // well-formed IDs are kept, and none under Global Privacy Control (stored ones are dropped).
  const clickIdKeys = ['gclid', 'gbraid', 'wbraid'];
  const gpc = window.navigator?.globalPrivacyControl === true;
  const safeReferrer = value => { try { const url = new URL(value); return /^https?:$/.test(url.protocol) ? url.origin : ''; } catch { return ''; } };
  const cleanTouch = value => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const touch = {};
    for (const key of ['captured_at', 'landing_path', 'referrer', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term']) touch[key] = typeof value[key] === 'string' ? value[key].slice(0, key === 'captured_at' ? 40 : key === 'utm_source' || key === 'utm_medium' ? 200 : 300) : '';
    touch.landing_path = touch.landing_path.startsWith('/') && !touch.landing_path.startsWith('//') ? touch.landing_path.split(/[?#]/)[0] : '/';
    touch.referrer = safeReferrer(touch.referrer);
    for (const key of clickIdKeys) if (!gpc && typeof value[key] === 'string' && /^[A-Za-z0-9_-]{8,256}$/.test(value[key])) touch[key] = value[key];
    return touch;
  };
  const current = cleanTouch({ captured_at: new Date().toISOString(), landing_path: window.location.pathname, referrer: document.referrer, ...Object.fromEntries(['utm_source','utm_medium','utm_campaign','utm_content','utm_term', ...clickIdKeys].map(key => [key, params.get(key) || ''])) });
  const read = (storage, key) => { try { return cleanTouch(JSON.parse(storage.getItem(key))); } catch { return null; } };
  let first = null, last = null;
  try { first = read(window.localStorage, 'drive_right_first_touch'); } catch {}
  try { last = read(window.sessionStorage, 'drive_right_last_touch'); } catch {}
  const paymentReturn = /^\/payment-success(?:-(?:consultant|fullservice|concierge))?\.html$/.test(window.location.pathname);
  const checkoutReferrer = ['https://checkout.stripe.com', 'https://buy.stripe.com', 'https://book.stripe.com'].includes(current.referrer);
  if (checkoutReferrer) current.referrer = '';
  first ||= current;
  last ||= paymentReturn ? first : current;
  const external = current.referrer && current.referrer !== window.location.origin;
  const campaign = ['utm_source','utm_medium','utm_campaign','utm_content','utm_term', ...clickIdKeys].some(key => current[key]);
  if (!paymentReturn && (external || campaign)) {
    const same = last && ['landing_path','referrer','utm_source','utm_medium','utm_campaign','utm_content','utm_term', ...clickIdKeys].every(key => (last[key] || '') === (current[key] || ''));
    if (!same) last = current;
  }
  // Internal navigation, reloads and payment returns keep acquisition attribution.
  try { window.localStorage.setItem('drive_right_first_touch', JSON.stringify(first)); } catch {}
  try { window.sessionStorage.setItem('drive_right_last_touch', JSON.stringify(last)); } catch {}
  return { first_touch: first, last_touch: last };
}
const attributionData=attribution();function objectFromForm(e){const o={};return new FormData(e).forEach((n,t)=>{Object.prototype.hasOwnProperty.call(o,t)?o[t]=Array.isArray(o[t])?o[t].concat(n):[o[t],n]:o[t]=n}),o}async function requestJson(url, options = {}) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(url, { credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, ...options, signal: controller.signal });
    let body = {};
    try { body = await response.json(); } catch (error) { if (controller.signal.aborted) throw error; }
    if (!response.ok || body?.ok !== true) {
      const error = new Error(body?.error || 'The request could not be completed.');
      error.status = response.status;
      error.code = body?.error;
      throw error;
    }
    return body;
  } catch (error) {
    if (controller.signal.aborted) {
      const timeout = new Error('The request timed out. Please try again.');
      timeout.code = 'request_timeout';
      throw timeout;
    }
    throw error;
  } finally {
    // The deadline covers headers and the complete body, including slow streams.
    window.clearTimeout(timer);
  }
}
async function saveLead(action, payload) {
  const send = () => requestJson('/api/leads', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey(action) },
    body: JSON.stringify(payload)
  });
  try { return await send(); } catch (error) {
    if (error.code !== 'idempotency_conflict') throw error;
    // A changed form after a lost response is a new submission. Keep ordinary
    // network retries on the old key, and restart a conflicting key only once.
    clearIdempotencyKey(action);
    return await send();
  }
}
function setButtonState(e,o,n){e&&(e.dataset.originalText||(e.dataset.originalText=e.textContent),e.disabled=o,e.textContent=o?n:e.dataset.originalText,e.setAttribute("aria-busy",String(o)))}function showFormStatus(e,o,n){let t=e.querySelector("[data-form-status]");t||(t=document.createElement("p"),t.dataset.formStatus="",t.setAttribute("role","status"),t.setAttribute("aria-live","polite"),e.appendChild(t)),t.className=n?"form-status form-status--error":"form-status form-status--success",t.textContent=o}function idempotencyKey(e){const o=`drive_right_idem_${e}`;try{const n=window.sessionStorage.getItem(o);if(n)return n;const t=createId();return window.sessionStorage.setItem(o,t),t}catch{return createId()}}function clearIdempotencyKey(e){try{window.sessionStorage.removeItem(`drive_right_idem_${e}`)}catch{}}async function startCheckout(e,o){if(e==="consultation"){window.location.assign("/schedule.html#retired-plan");return;}const n=`checkout_${e}`,t=await requestJson("/api/checkout-start",{method:"POST",headers:{"Content-Type":"application/json","Idempotency-Key":idempotencyKey(n)},body:JSON.stringify({tier:e,lead_id:o||null,source_page:window.location.pathname,attribution:attributionData})}).catch(error=>{if(error.code==="stale_offer"){clearIdempotencyKey(n);window.location.assign("/schedule.html#full-service");throw new Error("The offer changed. Review the current price before restarting checkout.");}throw error;});clearIdempotencyKey(n);try{await track("begin_checkout",{service_tier:e,checkout_attempt_id:t.attempt_id||""},{beforeNavigation:!0})}catch{}window.location.assign(t.url)}const heroForm=document.getElementById("hero-form");heroForm&&heroForm.addEventListener("submit",async e=>{e.preventDefault();const o=document.getElementById("hero-submit");setButtonState(o,!0,"Sending…");const n=objectFromForm(heroForm);try{if(heroForm.dataset.leadId){showFormStatus(heroForm,"Your request is saved. Reopening secure checkout…",!1),await startCheckout("full_service",heroForm.dataset.leadId);return}const t=await saveLead("hero_lead",{name:n.name,email:n.email,phone:n.phone||"",vehicle:n.vehicle,message:n.vehicle?`Vehicle interest: ${n.vehicle}`:"",source_page:window.location.pathname,honeypot:n.website||"",turnstile_token:n["cf-turnstile-response"]||"",attribution:attributionData});heroForm.dataset.leadId=t.lead_id||"",clearIdempotencyKey("hero_lead"),track("generate_lead",{form_name:"hero_lead",lead_id:t.lead_id||""}),showFormStatus(heroForm,"Saved. Opening secure checkout…",!1),await startCheckout("full_service",t.lead_id)}catch(t){showFormStatus(heroForm,t.message||"We could not save your request. Please try again.",!0),setButtonState(o,!1)}}),document.querySelectorAll("#contact-form").forEach(e=>{e.addEventListener("submit",async o=>{o.preventDefault();const n=e.querySelector('[type="submit"]');setButtonState(n,!0,"Sending…");const t=objectFromForm(e);try{const r=await saveLead(`contact_${window.location.pathname}`,{name:t.name,email:t.email,phone:t.phone||"",message:t.message,source_page:window.location.pathname,honeypot:t.website||"",turnstile_token:t["cf-turnstile-response"]||"",attribution:attributionData});clearIdempotencyKey(`contact_${window.location.pathname}`),track("generate_lead",{form_name:"contact",lead_id:r.lead_id||""}),e.reset(),showFormStatus(e,r.forwarding_configured===true?"Thanks—your message was saved. We will follow up shortly.":"Your message was saved. To get in touch, email Mason at hello@driverightcarbuying.com or call (512) 910-4938.",!1),setButtonState(n,!1)}catch(r){showFormStatus(e,r.message||"We could not save your message. Please try again.",!0),setButtonState(n,!1)}})}),document.querySelectorAll('[data-service-tier], a[href*="schedule.html#"]').forEach(link => {
  const target = new URL(link.getAttribute('href') || '', window.location.href);
  const fragments = { '#full-service': 'full_service', '#concierge': 'concierge', '#contact-full_service': 'full_service', '#contact-concierge': 'concierge' };
  const tier = link.dataset.serviceTier || (target.origin === window.location.origin && target.pathname === '/schedule.html' ? fragments[target.hash] : null);
  if (!tier) return;
  const label = link.innerHTML;
  const reset = () => { link.innerHTML = label; link.removeAttribute('aria-disabled'); link.removeAttribute('aria-busy'); };
  window.addEventListener('pageshow', reset);
  link.addEventListener('click', async event => {
    event.preventDefault();
    if (link.getAttribute('aria-disabled') === 'true') return;
    link.setAttribute('aria-disabled', 'true');
    link.setAttribute('aria-busy', 'true');
    link.textContent = 'Opening secure checkout…';
    try { await startCheckout(tier); }
    catch (error) { reset(); window.alert(error.message || 'Checkout is temporarily unavailable. Please try again.'); }
  });
});
document.querySelectorAll("[data-cta-location]").forEach(e=>{e.addEventListener("click",()=>{track("cta_click",{cta_location:e.getAttribute("data-cta-location")||"unknown",cta_label:(e.textContent||"").trim().slice(0,80)})})}),document.querySelectorAll('a[href^="tel:"]').forEach(e=>{e.addEventListener("click",()=>{track("phone_click",{link_text:(e.textContent||"").trim().slice(0,80)})})});function updatePaymentGate(e,o){const n=document.getElementById("payment-verification"),t=document.getElementById("verified-purchase-content");if(n){n.dataset.state=e;const r=n.querySelector("[data-verification-heading]"),i=n.querySelector("[data-verification-message]");r&&(r.textContent=e==="verified"?"Payment verified":e==="error"?"Payment could not be verified":"Verifying payment"),i&&(i.textContent=o),n.hidden=e==="verified"}t&&(t.hidden=e!=="verified")}async function initializePaidOnboarding(){const e=document.body.dataset.purchaseTier;if(!e)return;const o=checkoutSessionId();if(!o){updatePaymentGate("error","This page needs the secure checkout session link from your Stripe receipt. No purchase was recorded from this page visit.");return}const n=[0,1e3,2e3,4e3,8e3];for(let t=0;t<n.length;t+=1){n[t]&&(updatePaymentGate("pending","Stripe confirmed payment; waiting for the signed webhook record…"),await new Promise(r=>setTimeout(r,n[t])));try{const r=await requestJson(`/api/purchase-status?session_id=${encodeURIComponent(o)}&tier=${encodeURIComponent(e)}`,{method:"GET"});if(r.verified){verifiedCheckoutSessionId=o,document.body.dataset.purchaseVerified="true",updatePaymentGate("verified","Payment verified."),trackVerifiedPurchase(r);return}if(r.status==="processing"&&t<n.length-1)continue;updatePaymentGate("error","Stripe has not confirmed a paid checkout for this service. No purchase was recorded from this page visit.");return}catch(r){if(t<n.length-1&&(!r.status||r.status>=500))continue;updatePaymentGate("error",r.message||"We could not verify this checkout. Please use the link in your receipt or contact support.");return}}}const onboardingForm=document.getElementById("onboarding-form");onboardingForm&&onboardingForm.addEventListener("submit",async e=>{e.preventDefault();const o=verifiedCheckoutSessionId,n=document.body.dataset.purchaseTier;if(!o||!n){showFormStatus(onboardingForm,"Verify the paid checkout before submitting this intake.",!0);return}const t=document.getElementById("onboarding-submit");setButtonState(t,!0,"Submitting…");try{await requestJson("/api/onboarding",{method:"POST",headers:{"Content-Type":"application/json","Idempotency-Key":idempotencyKey(`onboarding_${o}`)},body:JSON.stringify({session_id:o,tier:n,fields:objectFromForm(onboardingForm)})});const r=document.getElementById("onboarding-success");onboardingForm.hidden=!0,r&&(r.style.display="block",r.scrollIntoView({behavior:"smooth",block:"start"}))}catch(r){showFormStatus(onboardingForm,r.message||"We could not save your intake. Please try again.",!0),setButtonState(t,!1)}});const budgetSelect=document.getElementById("ob-budget"),budgetOther=document.getElementById("ob-budget-other");budgetSelect&&budgetOther&&budgetSelect.addEventListener("change",()=>{const e=budgetSelect.value==="other";budgetOther.style.display=e?"block":"none",budgetOther.required=e});const otherCheck=document.getElementById("features-other-check"),otherText=document.getElementById("features-other-text");otherCheck&&otherText&&otherCheck.addEventListener("change",()=>{otherText.style.display=otherCheck.checked?"block":"none",otherText.required=otherCheck.checked}),initializePaidOnboarding();

// Available before deferred buying modules run, including direct checkout URLs.
window.driveRightClient = { requestJson, track, createId, attribution: attributionData };
