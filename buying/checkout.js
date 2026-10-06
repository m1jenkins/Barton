export const plans = Object.freeze({
  full_service: { name: 'Full Service', fee: 395 },
  concierge: { name: 'Ultimate Concierge', fee: 695 },
});

export const CHECKOUT_KEY = 'drive_right_buying_checkout_v1';

// Checkout state lasts for one visit: sessionStorage keeps it across pages and
// refreshes in this tab. Storage access itself can throw, so history is a
// same-tab fallback and memory the last resort.
export function createStore(w, key = CHECKOUT_KEY) {
  let memory;
  // Earlier versions could leave a copy in localStorage. Drop it.
  try { w.localStorage?.removeItem(key); } catch { /* Private browsing. */ }
  const session = () => { try { return w.sessionStorage || null; } catch { return null; } };
  return {
    read(fresh = false) {
      if (fresh) memory = undefined;
      if (memory !== undefined) return memory;
      try {
        const value = JSON.parse(session()?.getItem(key));
        if (value) return (memory = value);
      } catch { /* Ignore damaged or inaccessible storage. */ }
      return (memory = w.history?.state?.[key] || null);
    },
    write(value) {
      memory = value;
      try { session()?.setItem(key, JSON.stringify(value)); } catch { /* History still works. */ }
      try { w.history.replaceState({ ...w.history.state, [key]: value }, ''); } catch { /* Memory still works. */ }
    },
  };
}

// Persist the exact payload and key before sending. A timeout may mean the server
// created the attempt; a retry must reuse it rather than start a second one.
export function createCheckout({ store, request, createId, attribution, track = () => {}, sourcePage = '/schedule.html' }) {
  const saved = store.read();
  const state = saved?.version === 1 && Array.isArray(saved.checkouts) ? { version: 1, checkouts: saved.checkouts } : { version: 1, checkouts: [] };
  let pending;
  const persist = () => store.write(state);
  async function run(tier) {
    if (!Object.hasOwn(plans, tier)) throw new Error('Please choose Full Service or Ultimate Concierge.');
    let checkout = state.checkouts.find(item => !item.stale && item.tier === tier && !item.leadId);
    if (!checkout) {
      checkout = { tier, leadId: null, key: createId(), payload: { tier, source_page: sourcePage, attribution } };
      state.checkouts.push(checkout);
    }
    persist();
    let result;
    try {
      result = await request('/api/checkout-start', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': checkout.key }, body: JSON.stringify(checkout.payload) });
    } catch (error) {
      if (error.code === 'stale_offer' || error.message === 'stale_offer') {
        checkout.stale = true;
        persist();
        const stale = new Error(`The offer has changed. Review ${plans[tier].name} at $${plans[tier].fee} USD, then select Restart checkout.`);
        stale.code = 'stale_offer';
        throw stale;
      }
      throw error;
    }
    const url = new URL(result.url);
    if (url.protocol !== 'https:') throw new Error('The secure checkout link could not be confirmed. Please retry.');
    if (!checkout.tracked) {
      checkout.tracked = true;
      persist();
      // Saved before waiting: GTM gets up to 1 s to send this before the caller opens
      // Stripe. An old track() returns undefined, and a failing one never blocks checkout.
      try { await track('begin_checkout', { service_tier: tier, checkout_attempt_id: result.attempt_id || '', direct: true }, { beforeNavigation: true }); } catch {}
    }
    return result;
  }
  return {
    start(tier) {
      if (!pending) pending = run(tier).finally(() => { pending = null; });
      return pending;
    },
  };
}
