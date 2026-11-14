import { SEARCH_FIELDS, display, oneLine } from '../intake-email.js';
import * as welcome from './welcome.js';
import * as whatToExpect from './what-to-expect.js';
import * as dealDone from './deal-done.js';
import * as reviewAsk from './review-ask.js';

// Every automated email to a buyer, by the template name stored in
// customer_email_outbox.template (db/011_customer_email_outbox.sql).
export const TEMPLATES = Object.freeze({
  welcome, what_to_expect: whatToExpect, deal_done: dealDone, review_ask: reviewAsk
});
export const TEMPLATE_NAMES = Object.freeze(Object.keys(TEMPLATES));

// Plans that get the emails. The retired consultation plan had no car search.
export const EMAIL_TIERS = Object.freeze(['full_service', 'concierge']);
const PLANS = Object.freeze({
  full_service: { name: 'Steer Me Right', price: '$395' },
  concierge: { name: 'Steer Me Right Pro', price: '$695' }
});

// The search answers a buyer sees repeated back in the welcome email. Contact
// details, the delivery address, trade-in plates and free-text notes stay out.
const RECAP_KEYS = ['preferred_makes', 'vehicle_type', 'condition', 'model_years', 'budget',
  'payment_method', 'trade_in', 'timeline', 'search_radius'];
const LABELS = new Map(SEARCH_FIELDS);
const short = (value, max = 160) => {
  const text = oneLine(display(value));
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
};

// 'cash' skips the loan tip; anything unclear gets the "if you might finance" version.
function payingFrom(answer) {
  if (/financ|loan|lease/i.test(answer)) return 'finance';
  if (/^\s*(cash|paying cash|all cash)\b/i.test(answer)) return 'cash';
  return 'unknown';
}

// The only buyer facts a template can see, built from an onboarding_submissions row.
export function buyerFromRow(row) {
  const fields = row.fields && typeof row.fields === 'object' && !Array.isArray(row.fields) ? row.fields : {};
  const plan = PLANS[row.tier_id] || PLANS.full_service;
  const first = short(oneLine(row.name).split(' ')[0].replace(/[^\p{L}\p{M}'’.-]/gu, ''), 40);
  // "sam" becomes "Sam"; a name typed with any capitals is left as typed.
  const firstName = first === first.toLowerCase() ? first.charAt(0).toUpperCase() + first.slice(1) : first;
  return {
    firstName,
    isPro: row.tier_id === 'concierge',
    plan: plan.name,
    price: plan.price,
    hasTradeIn: /^(yes|maybe)/i.test(display(fields.trade_in)),
    paying: payingFrom(display(fields.payment_method)),
    recap: [
      ...RECAP_KEYS.map(key => [LABELS.get(key), short(fields[key])]),
      ['Where you are', short(row.city, 80)]
    ].filter(([, value]) => value)
  };
}

export function renderCustomerEmail(template, buyer, options = {}) {
  const module = TEMPLATES[template];
  if (!module) throw new Error(`Unknown customer email: ${template}`);
  return module.render(buyer, options);
}
