import { briefText, restoreBrief } from './brief.js';

export const plans = Object.freeze({
  full_service: { name: 'Full Service', fee: 295 },
  concierge: { name: 'Ultimate Concierge', fee: 895 },
});

// Persist the exact payload and key before sending. A timeout may mean the server
// committed successfully; retrying must not create a second lead or change its hash.
export function createCheckout({ store, request, createId, attribution, track = () => {}, sourcePage = '/schedule.html' }) {
  const saved = store.read();
  const state = saved?.version === 1 && Array.isArray(saved.leads) && Array.isArray(saved.checkouts)
    ? saved : { version: 1, leads: [], checkouts: [], contact: {} };
  let pending;
  const persist = () => store.write(state);
  async function run({ tier, contact, brief, honeypot = '', token = '' }) {
    if (!Object.hasOwn(plans, tier)) throw new Error('Please choose Full Service or Ultimate Concierge.');
    if (honeypot) throw new Error('We could not submit this form. Please try again.');
    const clean = { name: String(contact.name || '').trim(), email: String(contact.email || '').trim().toLowerCase(), phone: String(contact.phone || '').trim() };
    if (!clean.name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean.email)) throw new Error('Enter your name and a valid email address.');
    const draft = restoreBrief(brief);
    const payload = { ...clean, vehicle: draft.answers.vehicle || '', message: Object.keys(draft.answers).length ? briefText(draft) : 'Direct plan purchase. No buying brief supplied yet.', source: 'buying_brief', source_page: sourcePage };
    const identity = JSON.stringify(payload);
    let lead = state.leads.find(item => item.identity === identity);
    if (!lead) {
      lead = { identity, key: createId(), payload: { ...payload, attribution }, brief: draft };
      state.leads.push(lead);
    }
    state.contact = clean;
    persist();
    if (!lead.id) {
      const result = await request('/api/leads', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': lead.key }, body: JSON.stringify({ ...lead.payload, honeypot, turnstile_token: token }) });
      if (!result.lead_id) throw new Error('Your request could not be confirmed. Please retry.');
      lead.id = result.lead_id;
      persist();
      track('generate_lead', { form_name: 'buying_brief', lead_id: lead.id });
    }
    let checkout = state.checkouts.find(item => !item.stale && item.tier === tier && item.leadId === lead.id);
    if (!checkout) {
      checkout = { tier, leadId: lead.id, key: createId(), payload: { tier, lead_id: lead.id, source_page: sourcePage, attribution } };
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
    state.lastCheckout = { tier, brief: draft, contact: clean };
    if (!checkout.tracked) {
      checkout.tracked = true;
      track('begin_checkout', { service_tier: tier, checkout_attempt_id: result.attempt_id || '' });
    }
    persist();
    return result;
  }
  return {
    contact: state.contact,
    lastCheckout: () => state.lastCheckout,
    submit(input) {
      if (!pending) pending = run(input).finally(() => { pending = null; });
      return pending;
    },
  };
}
