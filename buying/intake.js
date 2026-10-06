// The paid intake as a conversation: one question at a time, after Stripe payment.
// Every answer is written into the page's onboarding form, which script.js submits to
// /api/onboarding, so the payment check, idempotency and contract stay in one place.
// Question keys are that form's control names; the server allowlists every one.

const flexible = /^(any(?:\s+\w+)*|flexible|not sure|no preference|either|open to any(?:\s+\w+)*|i don.?t know|doesn.?t matter)$/i;
const skipPattern = /^(?:skip|skip for now|skip this|not specified|n\/a)$/i;
const amount = String.raw`\$?\s*(\d[\d,]*(?:\.\d+)?)\s*(k)?`;
const bound = String.raw`(?:about|around|under|up to|max(?:imum)?|less than|no more than|below|at most|~)?\s*`;
const monthly = String.raw`(?:\/\s*mo(?:nth)?|per month|a month|monthly|mo)`;
const allIn = String.raw`(?:dollars?|bucks)?\s*(?:out[- ]the[- ]door|otd|all[- ]in|total)?`;

const numberText = value => value.toLocaleString('en-US', { maximumFractionDigits: 0 });
const capitalize = text => text.charAt(0).toUpperCase() + text.slice(1);
const toNumber = (digits, k) => Number(digits.replaceAll(',', '')) * (k ? 1000 : 1);

// Choice answers keep the buyer's words in the conversation and send the form's own
// option values, so chat and form submissions read the same in the database.
const selects = {
  condition: { New: 'new', Used: 'used', 'Certified pre-owned': 'cpo', 'Open to all': 'open' },
  payment_method: { Cash: 'cash', Financing: 'finance', Lease: 'lease', 'Not sure yet': 'undecided' },
  trade_in: { 'Yes, I have a trade-in': 'yes', 'No trade-in': 'no', Maybe: 'maybe' },
  timeline: { 'As soon as possible': 'asap', 'Within 2 weeks': '2-weeks', 'Within a month': '1-month', 'No rush': 'flexible' },
  contact_preference: { Text: 'text', Call: 'call', Email: 'email' },
};

const synonyms = {
  condition: [[/^new$/i, 'New'], [/^(?:used|pre-?owned|preowned)$/i, 'Used'], [/^(?:cpo|certified|certified pre-?owned)$/i, 'Certified pre-owned'], [/^(?:open|open to all|all|any|either|no preference|not sure)$/i, 'Open to all']],
  payment_method: [[/^(?:cash|wire|paying cash|cash\/wire)$/i, 'Cash'], [/^(?:finance|financing|loan|a loan|finance it)$/i, 'Financing'], [/^(?:lease|leasing)$/i, 'Lease'], [/^(?:not sure|not sure yet|undecided|don.?t know|i don.?t know)$/i, 'Not sure yet']],
  financing_status: [[/^(?:yes|yep|yeah|i am|i.?m pre-?approved|pre-?approved|yes,? i.?m pre-?approved)$/i, 'Yes, I’m pre-approved'], [/^(?:no|nope|not yet|no,? not yet)$/i, 'Not yet']],
  trade_in: [[/^(?:yes|yep|yeah|i do|yes,? i have a trade-?in)$/i, 'Yes, I have a trade-in'], [/^(?:no|nope|none|no trade|no trade-?in)$/i, 'No trade-in'], [/^(?:maybe|possibly|not sure|undecided)$/i, 'Maybe']],
  timeline: [[/^(?:asap|as soon as possible|now|right away|immediately)$/i, 'As soon as possible'], [/^(?:within )?(?:2|two) weeks$/i, 'Within 2 weeks'], [/^(?:within )?(?:a|1|one) month$/i, 'Within a month'], [/^(?:no rush|flexible|whenever|no hurry)$/i, 'No rush']],
  contact_preference: [[/^(?:text|text me|texts|sms|texting)$/i, 'Text'], [/^(?:call|call me|phone|phone call|calls)$/i, 'Call'], [/^(?:email|e-mail|email me)$/i, 'Email']],
};

const notNew = answers => answers.condition !== 'New';

export const questions = [
  { key: 'preferred_makes', label: 'Car', question: 'What car are you looking for?', placeholder: 'A Mazda Miata, for example', hint: 'A make and model, or just the kind of car you need.', required: true, maxLength: 200 },
  { key: 'condition', label: 'New or used', question: 'New, used, or certified pre-owned?', placeholder: 'New, used, or either', choices: ['New', 'Used', 'Certified pre-owned', 'Open to all'], required: true, maxLength: 40 },
  { key: 'model_years', label: 'Model years', question: 'Which model years would work?', placeholder: 'For example, 2020 or newer', choices: ['2023 or newer', '2020 or newer', 'Any year'], when: notNew, maxLength: 40 },
  { key: 'max_mileage', label: 'Mileage', question: 'How many miles is too many?', placeholder: 'For example, under 60,000 miles', choices: ['Under 30,000 mi', 'Under 60,000 mi', 'Flexible'], when: notNew, maxLength: 40 },
  { key: 'budget', label: 'All-in budget', question: 'What’s the most you’d pay, out the door?', placeholder: 'For example, $42,000', choices: ['$30,000', '$45,000', '$60,000'], hint: 'Include taxes, fees and delivery. A monthly payment works too.', required: true, maxLength: 80 },
  { key: 'payment_method', label: 'Paying', question: 'How are you planning to pay?', placeholder: 'Cash, financing, or a lease', choices: ['Cash', 'Financing', 'Lease', 'Not sure yet'], hint: 'Just your plan for now. No financial documents needed.', maxLength: 80 },
  { key: 'financing_status', label: 'Loan pre-approval', question: 'Do you already have a loan pre-approval from a bank or credit union?', placeholder: 'Yes, or not yet', choices: ['Yes, I’m pre-approved', 'Not yet'], when: answers => answers.payment_method === 'Financing', maxLength: 80 },
  { key: 'trade_in', label: 'Trade-in', question: 'Do you have a car to trade in?', placeholder: 'Yes, no, or maybe', choices: ['Yes, I have a trade-in', 'No trade-in', 'Maybe'], maxLength: 80 },
  { key: 'trade_vehicle', label: 'Your trade-in', question: 'What’s the trade-in? The year, make, model and rough mileage.', placeholder: 'A 2018 Honda Civic, about 70,000 miles', mobilePlaceholder: '2018 Civic, 70k miles', when: answers => Boolean(answers.trade_in) && answers.trade_in !== 'No trade-in', maxLength: 200 },
  { key: 'timeline', label: 'Timing', question: 'When do you need the car?', placeholder: 'A timeframe or a date', choices: ['As soon as possible', 'Within 2 weeks', 'Within a month', 'No rush'], required: true, maxLength: 80 },
  { key: 'city', label: 'Where you live', question: 'Where do you live?', placeholder: 'Austin, TX or 78701', hint: 'A city and state or a ZIP code. We search from here, and taxes and registration depend on it.', required: true, maxLength: 160 },
  { key: 'search_radius', label: 'How far', question: 'How far would you go for the right car?', placeholder: 'For example, 250 miles', choices: ['Within 50 miles', 'Within 250 miles', 'Anywhere in the US'], maxLength: 80 },
  { key: 'needs', label: 'What it needs to do', question: 'What does the car need to do for you?', placeholder: 'Two car seats, room for the dog, a long commute…', hint: 'Passengers, cargo, driving habits and must-have features.', multiline: true, maxLength: 1000 },
  { key: 'colors', label: 'Colors', question: 'Any colors you love, or want to avoid?', placeholder: 'Blue or gray, but not white', choices: ['Open to any color'], maxLength: 300 },
  { key: 'delivery_address', label: 'Delivery', question: 'If we coordinate delivery, where should the car go?', placeholder: 'An address, or just a city for now', hint: 'Delivery coordination depends on the car and the seller.', tiers: ['concierge'], maxLength: 300 },
  { key: 'name', label: 'Name', question: 'Almost done. What’s your full name?', placeholder: 'Your full name', autocomplete: 'name', required: true, maxLength: 120 },
  { key: 'phone', label: 'Phone', question: 'What’s the best phone number for you?', placeholder: '(512) 555-1234', inputMode: 'tel', autocomplete: 'tel', required: true, maxLength: 40 },
  { key: 'email', label: 'Email', question: 'And your email address?', placeholder: 'you@example.com', inputMode: 'email', autocomplete: 'email', required: true, maxLength: 254 },
  { key: 'contact_preference', label: 'Best way to reach you', question: 'How should your advisor reach you?', placeholder: 'Text, call, or email', choices: ['Text', 'Call', 'Email'], maxLength: 40 },
  { key: 'notes', label: 'Anything else', question: 'Anything else before we start?', placeholder: 'Listings you like, dealers you’ve talked to, deal-breakers…', hint: 'Up to 1,000 characters. It’s okay to skip.', multiline: true, maxLength: 1000, skipLabel: 'Nothing else to add' },
];

const questionByKey = key => questions.find(question => question.key === key);

/** Questions this plan asks, given the answers so far (new cars skip years and mileage). */
export function stepsFor(answers = {}, tier = 'full_service') {
  return questions.filter(question => (!question.tiers || question.tiers.includes(tier)) && (!question.when || question.when(answers)));
}

function normalizeBudget(text) {
  if (/\b(?:miles?|mi)\b/i.test(text)) throw new Error('That sounds like mileage. What’s the most you’d pay, out the door?');
  const amounts = [...text.matchAll(/(\d[\d,]*(?:\.\d+)?)\s*(k)?/gi)].map(match => toNumber(match[1], match[2]));
  if (!amounts.length) throw new Error('Give us a number, like $42,000 out the door or $650 a month.');
  if (amounts.some(value => value <= 0 || value > 10000000) || /^[a-z\s]*-\s*\$?\s*\d/i.test(text)) throw new Error('Give us a positive amount, like $42,000.');
  let match = text.match(new RegExp(`^${bound}${amount}\\s*${allIn}$`, 'i'));
  if (match) return `Up to $${numberText(toNumber(match[1], match[2]))} out the door`;
  match = text.match(new RegExp(`^${bound}${amount}\\s*${monthly}$`, 'i'));
  if (match) return `Up to $${numberText(toNumber(match[1], match[2]))} a month`;
  match = text.match(new RegExp(`^${amount}\\s*(?:-|–|—|to)\\s*${amount}\\s*${allIn}$`, 'i'));
  if (match) {
    // "30-40k" means $30,000 to $40,000.
    const high = toNumber(match[3], match[4]);
    const low = toNumber(match[1], match[2] || (match[4] && Number(match[1].replaceAll(',', '')) < 1000 ? 'k' : ''));
    if (low >= high) throw new Error('Put the lower amount first, like $35,000 to $40,000.');
    return `$${numberText(low)}–$${numberText(high)} out the door`;
  }
  // Anything richer ("$40k, a bit more for the right car") is kept in the buyer's words.
  return capitalize(text);
}

function normalizeYears(text) {
  if (flexible.test(text)) return 'Any year';
  const years = text.match(/\b\d{4}\b/g)?.map(Number) || [];
  const maxYear = new Date().getFullYear() + 1;
  if (!years.length || years.length > 2 || years.some(year => year < 1900 || year > maxYear)) throw new Error(`Try a year or a range, like 2020 or newer, or “Any year”.`);
  if (years.length === 2) {
    if (years[0] > years[1]) throw new Error('Put the earlier year first, like 2019–2023.');
    return `${years[0]}–${years[1]}`;
  }
  if (/newer|onward|after|later|\+|up/i.test(text)) return `${years[0]} or newer`;
  if (/older|before|earlier/i.test(text)) return `${years[0]} or older`;
  return String(years[0]);
}

function normalizeMileage(text) {
  if (flexible.test(text)) return 'Flexible';
  if (/\$|\b(?:dollars?|bucks?|price)\b/i.test(text)) throw new Error('That sounds like a price. How many miles is too many?');
  const match = text.match(/(\d[\d,]*(?:\.\d+)?)\s*(k)?/i);
  const value = match ? toNumber(match[1], match[2]) : NaN;
  if (!Number.isFinite(value) || value <= 0 || value > 999999) throw new Error('Try a mileage limit, like under 60,000 miles.');
  return `Under ${numberText(value)} mi`;
}

function normalizeRadius(text) {
  if (/^(?:nationwide|anywhere|anywhere in the us|all (?:of )?(?:the )?(?:us|usa|united states)|flexible)$/i.test(text)) return 'Anywhere in the US';
  const match = text.match(/^(?:within\s+)?(\d[\d,]*)\s*(k)?\s*(?:miles?|mi)?$/i);
  if (!match) return capitalize(text);
  const value = toNumber(match[1], match[2]);
  if (value <= 0 || value > 5000) throw new Error('Try a distance from 1 to 5,000 miles, or “Anywhere in the US”.');
  return `Within ${numberText(value)} miles`;
}

function normalizePhone(text) {
  const digits = text.replace(/\D/g, '');
  if (digits.length < 10 || digits.length > 15 || /[a-z]/i.test(text.replace(/\b(?:ext|x)\b\.?/gi, ''))) throw new Error('Enter a phone number with the area code, like (512) 555-1234.');
  const us = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;
  return us.length === 10 && !text.trim().startsWith('+') ? `(${us.slice(0, 3)}) ${us.slice(3, 6)}-${us.slice(6)}` : text.trim();
}

// The browser's own email check (type="email") plus the server's dotted-domain rule.
const emailPattern = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

/** Validate one answer and return it as the conversation shows it. */
export function normalizeAnswer(key, raw) {
  const question = questionByKey(key);
  if (!question) throw new Error('We don’t recognize that question.');
  const text = String(raw ?? '').trim().replace(question.multiline ? /[^\S\n]+/g : /\s+/g, ' ');
  if (!text) throw new Error(question.required ? 'Add an answer to keep going.' : 'Add an answer, or skip this one.');
  if (text.length > question.maxLength) throw new Error(`Could you keep that to ${question.maxLength.toLocaleString('en-US')} characters or fewer?`);
  if (question.multiline) return text;
  for (const [pattern, value] of synonyms[key] || []) if (pattern.test(text)) return value;
  switch (key) {
    case 'preferred_makes': {
      if (flexible.test(text)) throw new Error('Describe the kind of car you need, like “a small SUV” or “a family minivan”.');
      const vehicle = text.replace(/^(?:(?:i(?:’|')?m looking for|i want|i would like|i(?:’|')?d like|looking for|a|an)\s+)+/i, '').replace(/[\s,;.]+$/, '');
      if (/^(?:mazda\s+)?(?:mx-?5\s+)?miata$/i.test(vehicle)) return 'Mazda MX-5 Miata';
      return capitalize(vehicle || text);
    }
    case 'model_years': return normalizeYears(text);
    case 'max_mileage': return normalizeMileage(text);
    case 'budget': return normalizeBudget(text);
    case 'search_radius': return normalizeRadius(text);
    case 'colors': return flexible.test(text) || /^(?:any|any color|open to any colou?r)$/i.test(text) ? 'Open to any color' : capitalize(text);
    case 'name':
      if (!/\p{L}/u.test(text)) throw new Error('What name should your advisor use?');
      return text;
    case 'phone': return normalizePhone(text);
    case 'email': {
      const email = text.toLowerCase();
      if (!emailPattern.test(email)) throw new Error('That email doesn’t look right. Try one like you@example.com.');
      return email;
    }
    case 'city':
      if (text.length < 2) throw new Error('Add a city and state, or a ZIP code.');
      return text;
    default: return capitalize(text);
  }
}

const aliases = {
  car: 'preferred_makes', vehicle: 'preferred_makes', make: 'preferred_makes', model: 'preferred_makes',
  condition: 'condition', 'new or used': 'condition', years: 'model_years', year: 'model_years', 'model years': 'model_years',
  mileage: 'max_mileage', miles: 'max_mileage', budget: 'budget', price: 'budget',
  payment: 'payment_method', paying: 'payment_method', 'trade-in': 'trade_in', 'trade in': 'trade_in', trade: 'trade_in',
  timeline: 'timeline', timing: 'timeline', city: 'city', location: 'city', zip: 'city', 'zip code': 'city',
  radius: 'search_radius', distance: 'search_radius', color: 'colors', colors: 'colors', colour: 'colors',
  name: 'name', phone: 'phone', 'phone number': 'phone', number: 'phone', email: 'email', 'email address': 'email',
};
const correction = new RegExp(`^(?:change|update|set|make)\\s+(?:my\\s+)?(${Object.keys(aliases).sort((a, b) => b.length - a.length).join('|')})\\s*(?:to\\b|as\\b|:|=)\\s*([\\s\\S]+)$`, 'i');

/** Restore a saved conversation, dropping anything that no longer validates. */
export function restoreState(value) {
  const state = { version: 1, answers: {}, skipped: {}, editing: null };
  if (!value || value.version !== 1) return state;
  for (const question of questions) {
    const saved = value.answers?.[question.key];
    if (typeof saved === 'string') {
      try { state.answers[question.key] = normalizeAnswer(question.key, saved); } catch { /* Ignore invalid saved answers. */ }
    } else if (value.skipped?.[question.key] === true && !question.required) state.skipped[question.key] = true;
  }
  if (questionByKey(value.editing)) state.editing = value.editing;
  return state;
}

/** The question waiting for an answer, or null once every applicable question is resolved. */
export function nextQuestion(state, tier) {
  if (state.editing) return questionByKey(state.editing);
  return stepsFor(state.answers, tier).find(question => !(question.key in state.answers) && !state.skipped[question.key]) || null;
}

export function progress(state, tier) {
  const steps = stepsFor(state.answers, tier);
  return { done: steps.filter(question => question.key in state.answers || state.skipped[question.key]).length, total: steps.length };
}

export function isComplete(state, tier) {
  return stepsFor(state.answers, tier).every(question => !question.required || question.key in state.answers);
}

/** Apply a reply to the current question. "Change my budget to $45k" edits an earlier answer instead. */
export function answerQuestion(state, raw, tier) {
  const current = nextQuestion(state, tier);
  const next = { ...state, answers: { ...state.answers }, skipped: { ...state.skipped }, editing: null };
  const text = String(raw ?? '').trim();
  const edit = current?.multiline ? null : text.match(correction);
  const key = edit ? aliases[edit[1].toLowerCase()] : current?.key;
  if (!key) throw new Error('Your answers are complete. Use the pencil next to an answer to change it.');
  if (!edit && skipPattern.test(text)) {
    if (questionByKey(key).required) throw new Error('We need this one to start your search.');
    delete next.answers[key];
    next.skipped[key] = true;
    return next;
  }
  next.answers[key] = normalizeAnswer(key, edit ? edit[2] : text);
  delete next.skipped[key];
  // A correction typed mid-question leaves that question waiting.
  if (edit && state.editing && state.editing !== key) next.editing = state.editing;
  return next;
}

export function skipQuestion(state, tier) {
  const current = nextQuestion(state, tier);
  if (!current || current.required) return state;
  const next = { ...state, answers: { ...state.answers }, skipped: { ...state.skipped, [current.key]: true }, editing: null };
  delete next.answers[current.key];
  return next;
}

const vehicleTypes = [['suv', /\b(?:suv|crossover)\b/i], ['truck', /\b(?:truck|pickup)\b/i], ['sedan', /\bsedan\b/i], ['minivan', /\bminivan\b/i], ['wagon', /\b(?:wagon|hatchback)\b/i], ['coupe', /\b(?:coupe|sports car|miata|mx-5|corvette)\b/i], ['ev', /\b(?:ev|electric)\b/i]];

/**
 * Form control values for every question, including blanks for questions this plan or
 * these answers no longer ask, so a changed answer clears what it replaced.
 */
export function formValues(state, tier) {
  const asked = new Set(stepsFor(state.answers, tier).map(question => question.key));
  const answer = key => (asked.has(key) && state.answers[key]) || '';
  const values = {};
  for (const question of questions) {
    const text = answer(question.key);
    values[question.key] = Object.hasOwn(selects[question.key] || {}, text) ? selects[question.key][text] : text;
  }
  // Fill the form's typed fields where the answer has the same meaning.
  values.year_min = answer('model_years').match(/^(\d{4})(?:–\d{4}| or newer)?$/)?.[1] || '';
  values.max_mileage = answer('max_mileage').match(/^Under ([\d,]+) mi$/)?.[1].replaceAll(',', '') || '';
  const tradeMiles = answer('trade_vehicle').match(/(\d[\d,]*(?:\.\d+)?)\s*(k)?\s*(?:miles?|mi)\b/i);
  values.trade_mileage = tradeMiles ? String(toNumber(tradeMiles[1], tradeMiles[2])) : '';
  const types = vehicleTypes.filter(([, pattern]) => pattern.test(answer('preferred_makes')));
  values.vehicle_type = types.length === 1 ? types[0][0] : '';
  return values;
}

/** The question a form control belongs to, for sending a buyer back to fix it. */
export function questionForControl(name) {
  return questionByKey({ year_min: 'model_years', trade_mileage: 'trade_vehicle', vehicle_type: 'preferred_makes' }[name] || name) || null;
}

export function firstName(state) {
  return (state.answers.name || '').split(' ')[0];
}
