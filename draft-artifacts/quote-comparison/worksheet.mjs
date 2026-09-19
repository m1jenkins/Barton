export const COST_FIELDS = [
  ['sellingPrice', 'Vehicle selling price'],
  ['dealerFees', 'Dealer fees'],
  ['addOns', 'Selected products / add-ons'],
  ['taxes', 'Quoted taxes'],
  ['registration', 'Title / registration charges'],
  ['delivery', 'Delivery charge'],
  ['other', 'Other quoted purchase costs'],
];

export function parseAmount(input) {
  const value = String(input ?? '').trim();
  if (!value) return { status: 'unknown', cents: null };
  if (!/^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,2})?$/.test(value)) {
    return { status: 'invalid', cents: null };
  }
  const [whole, fraction = ''] = value.replaceAll(',', '').split('.');
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  if (!Number.isSafeInteger(cents)) return { status: 'invalid', cents: null };
  return { status: 'known', cents };
}

export function emptyQuote() {
  return { costs: Object.fromEntries(COST_FIELDS.map(([key]) => [key, ''])), incentives: [], incentivesConfirmed: false };
}

export function calculateQuote(quote = emptyQuote()) {
  const missing = [];
  const invalid = [];
  const unresolved = [];
  const costs = {};
  let enteredSubtotalCents = 0;
  let knownCount = 0;
  for (const [key, label] of COST_FIELDS) {
    const amount = parseAmount(quote.costs?.[key]);
    costs[key] = amount;
    if (amount.status === 'known') { enteredSubtotalCents += amount.cents; knownCount += 1; }
    else if (amount.status === 'unknown') missing.push(label);
    else invalid.push(`${label}: enter a non-negative dollar amount with at most two decimal places.`);
  }
  if (!Number.isSafeInteger(enteredSubtotalCents)) invalid.push('Combined amounts are too large to calculate safely.');
  let adjustment = 0;
  let possibleReduction = 0;
  const incentives = (quote.incentives ?? []).map((incentive, index) => {
    const label = `Incentive ${index + 1}`;
    const amount = parseAmount(incentive.amount);
    const eligibility = ['eligible', 'ineligible'].includes(incentive.eligibility) ? incentive.eligibility : 'unknown';
    const included = ['yes', 'no'].includes(incentive.included) ? incentive.included : 'unknown';
    if (amount.status === 'unknown') missing.push(`${label} amount`);
    if (amount.status === 'invalid') invalid.push(`${label}: enter a non-negative dollar amount with at most two decimal places.`);
    if (included === 'unknown') missing.push(`${label}: whether it is already in the selling price`);
    if (eligibility === 'unknown') unresolved.push(`${label}: eligibility is unconfirmed`);
    if (amount.status === 'known' && included !== 'unknown') {
      if (eligibility === 'eligible' && included === 'no') adjustment -= amount.cents;
      if (eligibility !== 'eligible' && included === 'yes') adjustment += amount.cents;
      if (eligibility === 'unknown') possibleReduction += amount.cents;
      if (!Number.isSafeInteger(adjustment) || !Number.isSafeInteger(possibleReduction)) invalid.push('Combined incentives are too large to calculate safely.');
    }
    return { label, amount, eligibility, included };
  });
  if (quote.incentivesConfirmed !== true) missing.push('Confirm the incentive list and which incentives can be combined, or that there are none');
  const calculatedBase = enteredSubtotalCents + adjustment;
  const calculatedConditional = calculatedBase - possibleReduction;
  const inputsKnown = missing.length === 0 && invalid.length === 0;
  if (!Number.isSafeInteger(calculatedBase) || !Number.isSafeInteger(calculatedConditional)) invalid.push('Combined incentives are too large to calculate safely.');
  if (inputsKnown && (calculatedBase < 0 || calculatedConditional < 0)) invalid.push('Incentives exceed the entered purchase costs. Check the amounts and whether they are already included.');
  const ready = inputsKnown && invalid.length === 0;
  const complete = ready && unresolved.length === 0;
  return {
    costs, incentives, missing, invalid, unresolved, complete,
    incentivesConfirmed: quote.incentivesConfirmed === true,
    status: invalid.length ? 'invalid' : complete ? 'complete' : 'needs_information',
    enteredSubtotalCents: knownCount && Number.isSafeInteger(enteredSubtotalCents) ? enteredSubtotalCents : null,
    totalCents: complete ? calculatedBase : null,
    preEligibilityCents: ready && unresolved.length ? calculatedBase : null,
    conditionalTotalCents: ready && unresolved.length ? calculatedConditional : null,
  };
}

export function compareQuotes(a, b, comparable = false) {
  if (!a.complete || !b.complete) return { ready: false, reason: 'Complete both quotes and confirm incentive terms before comparing totals.' };
  if (!comparable) return { ready: false, reason: 'Confirm the vehicles, equipment, timing, and purchase-cost basis are comparable.' };
  return { ready: true, differenceCents: b.totalCents - a.totalCents };
}

export function formatMoney(cents) {
  return cents === null ? 'Unknown' : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
}

export function exportCsv(a, b, comparable = false, exampleIndex = null) {
  const rows = [['Quote', 'Item', 'Amount USD', 'Status', 'Eligibility', 'Already included in selling price']];
  for (const [name, result] of [['Quote A', a], ['Quote B', b]]) {
    for (const [key, label] of COST_FIELDS) {
      const amount = result.costs[key];
      rows.push([name, label, amount.status === 'known' ? (amount.cents / 100).toFixed(2) : '', amount.status, '', '']);
    }
    for (const incentive of result.incentives) rows.push([name, incentive.label, incentive.amount.status === 'known' ? (incentive.amount.cents / 100).toFixed(2) : '', incentive.amount.status, incentive.eligibility, incentive.included]);
    rows.push([name, 'Incentive list and combination terms confirmed', '', result.incentivesConfirmed ? 'yes' : 'no', '', '']);
    rows.push([name, 'Purchase total', result.totalCents === null ? '' : (result.totalCents / 100).toFixed(2), result.status, '', '']);
    if (result.preEligibilityCents !== null) {
      rows.push([name, 'Scenario before unconfirmed incentives', (result.preEligibilityCents / 100).toFixed(2), 'scenario only', '', '']);
      rows.push([name, 'Scenario if every unconfirmed incentive applies', (result.conditionalTotalCents / 100).toFixed(2), 'scenario only', '', '']);
    }
    for (const note of [...result.missing, ...result.invalid, ...result.unresolved]) rows.push([name, note, '', 'needs information', '', '']);
  }
  const comparison = compareQuotes(a, b, comparable);
  rows.push(['Comparison', 'Comparable basis confirmed', '', comparable ? 'yes' : 'no', '', '']);
  rows.push(['Comparison', 'Quote B minus Quote A', comparison.ready ? (comparison.differenceCents / 100).toFixed(2) : '', comparison.ready ? 'entered purchase costs only' : 'not comparable yet', '', '']);
  rows.push(['Disclosure', 'Input origin', '', [0, 1].includes(exampleIndex) ? `Started from hypothetical example ${exampleIndex + 1}; invented sample figures may have been edited. Verify every amount before use.` : 'User-entered figures; source not verified by this worksheet.', '', '']);
  rows.push(['Disclosure', 'Private review draft. Entered purchase costs only; scenarios hold other entered charges fixed. No tax estimation, financing interest, trade-in, down payment, or customer-result claim.', '', '', '', '']);
  return rows.map(row => row.map(cell => `"${String(cell).replaceAll('"', '""')}"`).join(',')).join('\r\n') + '\r\n';
}

const costs = (sellingPrice, addOns, taxes = '2000', delivery = '0', registration = '250') => ({ sellingPrice, dealerFees: '500', addOns, taxes, registration, delivery, other: '0' });
export const EXAMPLES = [
  {
    title: 'Hypothetical example 1: a smaller discount can have a lower total',
    explanation: 'Invented figures only, including the quoted tax amounts. Quote A totals $37,250; Quote B totals $36,550. The $700 difference is arithmetic, not typical savings or a customer result.',
    quotes: [
      { costs: costs('33000', '1500'), incentives: [], incentivesConfirmed: true },
      { costs: costs('33800', '0'), incentives: [], incentivesConfirmed: true },
    ],
  },
  {
    title: 'Hypothetical example 2: an included rebate still needs eligibility',
    explanation: 'Every amount is invented. Quote A already includes an unconfirmed $1,000 rebate. Its scenario is $36,300 without that rebate or $35,300 if eligible. Quote B is $35,600. No final comparison is shown while eligibility is unknown.',
    quotes: [
      { costs: costs('32000', '0', '2100', '400', '300'), incentives: [{ amount: '1000', eligibility: 'unknown', included: 'yes' }], incentivesConfirmed: true },
      { costs: costs('32700', '0', '2100', '0', '300'), incentives: [], incentivesConfirmed: true },
    ],
  },
];
