import { plans, createCheckout, createStore } from './checkout.js?v=585d841060e1';

const $ = selector => document.querySelector(selector);
const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[c]);
const icons = { arrow:'M4 12h16m-7-7 7 7-7 7', close:'m6 6 12 12M6 18 18 6' };
const icon = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${icons[name] || ''}"/></svg>`;
document.querySelectorAll('[data-icon]').forEach(element => { element.innerHTML = icon(element.dataset.icon); });

// Static scenes are the fallback. The head script prepares blank artwork before
// paint; only take over if it is still prepared, so a late load never rewinds it.
function initLegworkMotion() {
  const cards = [...document.querySelectorAll('[data-legwork-card]')];
  const root = document.documentElement;
  if (!cards.length || !root.classList.contains('legwork-motion')) return;
  const preference = matchMedia('(prefers-reduced-motion: reduce)');
  if (preference.matches || !('IntersectionObserver' in window)) {
    root.classList.remove('legwork-motion');
    clearTimeout(window.driveRightLegworkFallback);
    return;
  }
  const played = new Set();
  const visible = new Set();
  const active = new Map();
  let nextTimer = null;
  let stopped = false;
  const playNext = () => {
    if (stopped || nextTimer !== null || document.hidden) return;
    const card = cards.find(card => visible.has(card) && !played.has(card));
    if (!card) return;
    played.add(card);
    card.classList.add('is-playing');
    // Follow the actual CSS sequence, handing over during its last second.
    const duration = Math.max(0, ...card.getAnimations({ subtree:true }).map(animation => animation.effect.getComputedTiming().endTime));
    active.set(card, setTimeout(() => {
      finish(card);
      playNext();
    }, duration));
    nextTimer = setTimeout(() => {
      nextTimer = null;
      playNext();
    }, Math.max(0, duration - 1000));
  };
  const finish = card => {
    if (!active.has(card)) return;
    clearTimeout(active.get(card));
    // Remove animation styles so a later visit to the section cannot replay a card.
    card.classList.add('is-complete');
    card.classList.remove('is-playing');
    visible.delete(card);
    observer.unobserve(card);
    active.delete(card);
    if (!active.size) {
      clearTimeout(nextTimer);
      nextTimer = null;
    }
  };
  const observer = new IntersectionObserver(entries => {
    entries.forEach(({ target:card, isIntersecting, intersectionRatio }) => {
      if (isIntersecting && intersectionRatio >= .35) visible.add(card);
      else visible.delete(card);
      if (!isIntersecting) finish(card);
    });
    playNext();
  }, { threshold:[0, .35] });
  cards.forEach(card => observer.observe(card));
  preference.addEventListener('change', event => {
    if (!event.matches) return;
    stopped = true;
    clearTimeout(nextTimer);
    root.classList.remove('legwork-motion');
    [...active.keys()].forEach(finish);
    visible.clear();
    observer.disconnect();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) [...active.keys()].forEach(finish);
    else playNext();
  });
  clearTimeout(window.driveRightLegworkFallback);
}
initLegworkMotion();

function closeOnBackdrop(dialog) {
  dialog.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => dialog.close()));
  dialog.addEventListener('click', event => { if (event.target !== dialog) return; const r = dialog.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) dialog.close(); });
}
document.querySelectorAll('dialog').forEach(closeOnBackdrop);

// Every plan button goes straight to Stripe. The buyer describes the car after
// payment, so nothing is asked first. Errors open one retry dialog per page.
const checkoutStore = createStore(window);
const planButtons = [...document.querySelectorAll('[data-plan]')];
const planLabels = new Map(planButtons.map(button => [button, button.innerHTML]));
let checkoutFlow, selectedTier, checkoutPending = false, checkoutDialog;
const failureMessages = {
  page_loading: 'The page is still loading.',
  request_timeout: 'Stripe took too long to respond.',
  service_unavailable: 'Secure checkout is briefly unavailable.',
};
function setBusy(buttons, busy) {
  for (const button of buttons) {
    if (busy) { button.setAttribute('aria-busy', 'true'); button.textContent = 'Opening secure checkout…'; }
    else { button.removeAttribute('aria-busy'); if (planLabels.has(button)) button.innerHTML = planLabels.get(button); }
  }
}
function retryDialog() {
  if (checkoutDialog) return checkoutDialog;
  checkoutDialog = document.createElement('dialog');
  checkoutDialog.id = 'contact-dialog';
  checkoutDialog.setAttribute('aria-labelledby', 'contact-title');
  checkoutDialog.innerHTML = `<header class="dialog-header"><h2 id="contact-title">Checkout didn’t open.</h2><button class="icon-button" data-close type="button" aria-label="Close checkout message">${icon('close')}</button></header><p class="dialog-description">Nothing was charged. Try again, or call Mason at <a href="tel:+15129104938">(512) 910-4938</a>.</p><div id="chosen-plan" class="chosen-plan"></div><p id="contact-error" class="input-error" role="alert"></p><button id="checkout-submit" class="primary-button" type="button">Retry secure checkout ${icon('arrow')}</button><p class="small-note">Pay securely with Stripe, then tell us about the car.</p>`;
  document.body.append(checkoutDialog);
  closeOnBackdrop(checkoutDialog);
  checkoutDialog.querySelector('#checkout-submit').addEventListener('click', () => startPlanCheckout(selectedTier));
  return checkoutDialog;
}
function showCheckoutError(tier, error) {
  const dialog = retryDialog();
  const plan = plans[tier];
  const reason = error.code === 'stale_offer' ? error.message : failureMessages[error.code] || 'We couldn’t open secure checkout.';
  dialog.querySelector('#contact-error').textContent = reason;
  dialog.querySelector('#chosen-plan').innerHTML = `<span>${escape(plan.name)}<br><small>One-time service fee</small></span><strong>$${plan.fee}</strong>`;
  dialog.querySelector('#checkout-submit').innerHTML = `${error.code === 'stale_offer' ? 'Restart checkout' : 'Retry secure checkout'} ${icon('arrow')}`;
  if (!dialog.open) dialog.showModal();
}
async function startPlanCheckout(tier) {
  if (!plans[tier] || checkoutPending) return;
  selectedTier = tier;
  const client = window.driveRightClient;
  if (!client) { showCheckoutError(tier, { code: 'page_loading' }); return; }
  checkoutPending = true;
  const retry = checkoutDialog?.open ? [checkoutDialog.querySelector('#checkout-submit')] : [];
  const buttons = [...planButtons.filter(button => button.dataset.plan === tier), ...retry];
  setBusy(buttons, true);
  try {
    checkoutFlow ||= createCheckout({ store:checkoutStore, request:client.requestJson, createId:client.createId, attribution:client.attribution, track:client.track, sourcePage:location.pathname });
    const result = await checkoutFlow.start(tier);
    window.location.assign(result.url);
  } catch (error) {
    setBusy(buttons, false);
    showCheckoutError(tier, error);
  } finally {
    checkoutPending = false;
  }
}
planButtons.forEach(button => button.addEventListener('click', event => { event.preventDefault(); startPlanCheckout(button.dataset.plan); }));
// Back from Stripe, the page returns from cache with its buttons still busy.
window.addEventListener('pageshow', event => {
  if (!event.persisted) return;
  checkoutStore.read(true);
  checkoutFlow = null;
  setBusy(planButtons, false);
  if (checkoutDialog?.open) checkoutDialog.close();
});
function syncPlan() {
  if (['#consultation', '#contact-consultation'].includes(location.hash)) {
    history.replaceState(history.state, '', location.pathname + location.search + '#retired-plan');
    document.getElementById('retired-plan')?.focus();
  }
  const tier = location.hash.replace('#contact-', '');
  if (plans[tier] && location.hash.startsWith('#contact-')) {
    history.replaceState(history.state, '', location.pathname + location.search + '#pricing');
    startPlanCheckout(tier);
  } else if (checkoutDialog?.open) checkoutDialog.close();
}
window.addEventListener('popstate', syncPlan);
window.addEventListener('hashchange', syncPlan);
syncPlan();

// Payment pages: script.js sets this non-secret flag once the paid session verifies.
const verifiedContent = $('#verified-purchase-content');
if (verifiedContent) {
  const onVerified = () => {
    if (document.body.dataset.purchaseVerified !== 'true') return;
    $('.skip-link')?.setAttribute('href', '#verified-purchase-content');
  };
  new MutationObserver(onVerified).observe(document.body, { attributes:true, attributeFilter:['data-purchase-verified'] });
  onVerified();
  // A field the browser flags inside the collapsed preferences must be visible to fix.
  $('#onboarding-form')?.addEventListener('invalid', event => event.target.closest('details')?.setAttribute('open', ''), true);
  // Trade-in details appear only for a possible trade, and clear when it is withdrawn.
  const tradeIn = $('#ob-trade-in'), tradeDetails = $('#trade-in-details');
  tradeIn?.addEventListener('change', () => {
    const hasTrade = ['yes', 'maybe'].includes(tradeIn.value);
    if (tradeDetails) tradeDetails.style.display = hasTrade ? 'block' : 'none';
    if (!hasTrade) tradeDetails?.querySelectorAll('input,select').forEach(control => { control.value = ''; });
  });
}
