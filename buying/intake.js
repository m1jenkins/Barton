export const fields = [
  { key: 'vehicle', label: 'Car', question: 'Let’s start with your next car.\nA make and model, or just the kind of car you need.', placeholder: 'A Mazda Miata, for example', choices: [], required: true, defaultPriority: 'must' },
  { key: 'year', label: 'Year', question: 'What model years should I look for? A range is absolutely fine.', placeholder: 'For example, 2019–2023', choices: ['2019–2023', '2024 or newer', 'Any year'], defaultPriority: 'prefer' },
  { key: 'mileage', label: 'Mileage', question: 'How many miles are you comfortable with?', placeholder: 'For example, under 40,000 miles', choices: ['Under 20,000 mi', 'Under 40,000 mi', 'Under 60,000 mi'], defaultPriority: 'prefer' },
  { key: 'budget', label: 'Car-price budget', question: 'What’s the most you’d like to spend on the car itself?', placeholder: 'For example, $30,000', choices: ['$25,000', '$30,000', '$40,000'], hint: 'Vehicle price, before taxes, fees, and delivery.', required: true, defaultPriority: 'must' },
  { key: 'zip', label: 'ZIP code', question: 'What ZIP code should I start from?', placeholder: 'Your 5-digit ZIP code', choices: [], inputMode: 'numeric', hint: 'I’ll use this as the starting point for your search.', required: true, priority: false },
  { key: 'condition', label: 'Condition', question: 'Are you thinking new, used, or certified pre-owned?', placeholder: 'Your preferred condition', choices: ['New', 'Used', 'Certified pre-owned', 'Open to all'], intake: true, direct: true, maxLength: 40, defaultPriority: 'prefer' },
  { key: 'timeline', label: 'Buying timeline', question: 'When would you like to have the keys?', placeholder: 'A timeframe or a specific date', choices: ['As soon as possible', 'Within 2 weeks', 'Within a month', 'No rush'], intake: true, direct: true, maxLength: 80, priority: false },
  { key: 'payment_method', label: 'Payment plans', question: 'How are you planning to pay for your next car?', placeholder: 'Cash, financing, or still deciding', choices: ['Cash', 'Financing', 'Lease', 'Not sure yet'], hint: 'Just your plans for now. No financial documents needed.', intake: true, direct: true, maxLength: 80, priority: false },
  { key: 'trade_in', label: 'Trade-in', question: 'Do you have a car you’d like to trade in?', placeholder: 'For example, a 2018 Civic with 70,000 miles', choices: ['No trade-in', 'Yes, I have a trade-in', 'Not sure yet'], hint: 'If so, a make, model, and approximate mileage help.', intake: true, direct: true, priority: false },
  { key: 'needs', label: 'Everyday needs', question: 'What does your next car need to do for you?', placeholder: 'Two car seats, room for the dog, a daily commute…', choices: [], hint: 'Think passengers, cargo, driving habits, and must-have features.', intake: true, direct: true, multiline: true, maxLength: 300, defaultPriority: 'must' },
  { key: 'radius', label: 'Search radius', question: 'And how far should I look? The right car might be a little further afield.', placeholder: 'For example, 250 miles', choices: ['100 miles', '250 miles', '500 miles', 'Nationwide'], defaultPriority: 'prefer' },
  { key: 'color', label: 'Color', question: 'Any colors you love? Or any you’d rather avoid?', placeholder: 'Green or white, but not black', choices: ['Green', 'White', 'Black', 'Open to any color'], defaultPriority: 'prefer' },
  { key: 'trim', label: 'Trim', question: 'Do you have a trim level in mind? It’s okay to keep your options open.', placeholder: 'A preferred trim, or “open to any”', choices: [], defaultPriority: 'prefer' },
  { key: 'transmission', label: 'Transmission', question: 'Do you prefer manual, automatic, or either?', placeholder: 'Your transmission preference', choices: ['Manual', 'Automatic', 'Either'], defaultPriority: 'prefer' },
  { key: 'notes', label: 'Anything else?', question: 'Anything else you’d like us to know before we put your brief together?', placeholder: 'Dealbreakers, listings you like, delivery needs, or any final details…', choices: [], hint: 'Add as much context as you like, up to 1,000 characters. It’s okay to skip.', intake: true, direct: true, multiline: true, maxLength: 1000, priority: false },
];

// Start with the essentials, then a short customer intake. Finer car preferences
// remain optional, and the open-ended note always comes last.
const fieldOrder = field => field.required ? 0 : field.key === 'notes' ? 3 : field.intake ? 1 : 2;
fields.sort((a, b) => fieldOrder(a) - fieldOrder(b));

const fieldByKey = key => fields.find(field => field.key === key);
const optionalKeys = fields.filter(field => !field.required).map(field => field.key);
const flexible = /^(any(?:\s+\w+)*|flexible|not sure|no preference|either|open to any(?:\s+\w+)*|i don.?t know)$/i;
const amountPattern = /(\d[\d,]*(?:\.\d+)?)\s*(k)?/i;
const colorWords = ['black', 'white', 'silver', 'gray', 'grey', 'red', 'blue', 'green', 'yellow', 'orange', 'brown', 'beige', 'gold', 'navy', 'tan'];
const correctionPrefix = /^(?:actually|wait|correction|update|change|edit|set|make)\b/i;

export function amountOf(text) {
  const match = text.match(amountPattern);
  if (!match) return NaN;
  return Number(match[1].replaceAll(',', '')) * (match[2] ? 1000 : 1);
}

const numberText = value => value.toLocaleString('en-US', { maximumFractionDigits: 0 });

export function isUnrestricted(key, value) {
  if (!value) return false;
  return {
    year: 'Any year',
    mileage: 'Flexible',
    radius: 'Nationwide',
    color: 'Open to any color',
    trim: 'Open to any trim',
    transmission: 'Either',
    condition: 'Open to all',
  }[key] === value;
}

export function isConcrete(key, value) {
  return Boolean(value) && fieldByKey(key)?.priority !== false && !isUnrestricted(key, value);
}

/** Validate and normalize only one concrete field. */
export function normalizeAnswer(key, raw) {
  const field = fieldByKey(key);
  if (!field) throw new Error('I don’t recognize that detail yet.');
  const text = String(raw ?? '').trim().replace(field.multiline ? /[^\S\n]+/g : /\s+/g, ' ');
  if (!text) throw new Error('Add an answer so I know what to look for.');
  const maxLength = field.maxLength || 180;
  if (text.length > maxLength) throw new Error(`Could you keep that to ${maxLength.toLocaleString('en-US')} characters or fewer?`);
  if (field.multiline) return text;
  if (field.direct) {
    const common = {
      condition: { new: 'New', used: 'Used', cpo: 'Certified pre-owned', 'certified pre-owned': 'Certified pre-owned', 'open to all': 'Open to all', either: 'Open to all' },
      timeline: { asap: 'As soon as possible', 'no rush': 'No rush', flexible: 'No rush' },
      payment_method: { cash: 'Cash', finance: 'Financing', financing: 'Financing', loan: 'Financing', lease: 'Lease', 'not sure': 'Not sure yet' },
      trade_in: { no: 'No trade-in', none: 'No trade-in', yes: 'Yes, I have a trade-in', maybe: 'Not sure yet', 'not sure': 'Not sure yet' },
    };
    if (key === 'condition' && flexible.test(text)) return 'Open to all';
    const options = common[key];
    if (options && Object.hasOwn(options, text.toLowerCase())) return options[text.toLowerCase()];
    return text.charAt(0).toUpperCase() + text.slice(1);
  }

  if (key === 'zip') {
    if (!/^\d{5}$/.test(text)) throw new Error('Please enter a 5-digit US ZIP code, like 78701.');
    return text;
  }
  if (key === 'budget' && flexible.test(text)) throw new Error('Please enter a positive budget. You can mark it Prefer later, but I still need an amount.');
  if (flexible.test(text)) {
    if (key === 'vehicle') throw new Error('Start with a make and model, or describe the kind of car you want.');
    const labels = { year: 'Any year', mileage: 'Flexible', radius: 'Nationwide', color: 'Open to any color', trim: 'Open to any trim', transmission: 'Either' };
    if (labels[key]) return labels[key];
  }
  if (key === 'year') {
    const years = text.match(/\b\d{4}\b/g)?.map(Number) || [];
    const maxYear = new Date().getFullYear() + 1;
    if (!years.length || years.length > 2 || years.some(year => year < 1886 || year > maxYear)) throw new Error(`Try a year or range between 1886 and ${maxYear}, or “Any year”.`);
    if (years.length === 2) {
      if (years[0] > years[1]) throw new Error('Put the earlier year first, like 2019–2023.');
      return `${years[0]}–${years[1]}`;
    }
    if (/newer|onward|after|\+/.test(text.toLowerCase())) return `${years[0]} or newer`;
    if (/older|before/.test(text.toLowerCase())) return `${years[0]} or older`;
    return String(years[0]);
  }
  if (['mileage', 'budget', 'radius'].includes(key)) {
    if (key === 'budget' && /\b(?:miles?|mi)\b/i.test(text)) throw new Error('That sounds like mileage. Include a dollar amount for the budget.');
    if (key === 'mileage' && /\$|\b(?:dollars?|bucks?|price)\b/i.test(text)) throw new Error('That sounds like a price. Include miles for the mileage limit.');
    if (key === 'radius' && /^(nationwide|anywhere|all (of )?(the )?(us|usa|united states))$/i.test(text)) return 'Nationwide';
    const amount = amountOf(text);
    const max = key === 'mileage' ? 999999 : key === 'radius' ? 5000 : 10000000;
    if (/-\s*\d/.test(text) || !Number.isFinite(amount) || amount <= 0 || amount > max) throw new Error(key === 'radius' ? 'Try a distance from 1 to 5,000 miles, or “Nationwide”.' : `Enter a positive ${key === 'budget' ? 'price' : 'mileage limit'}, like ${key === 'budget' ? '$30,000' : '40,000 miles'}.`);
    if (key === 'budget') return `Up to $${numberText(amount)}`;
    if (key === 'mileage') return `Under ${numberText(amount)} mi`;
    return `${numberText(amount)} mi`;
  }
  if (key === 'transmission') {
    if (/^(manual|stick(?: shift)?)$/i.test(text)) return 'Manual';
    if (/^(automatic|auto)$/i.test(text)) return 'Automatic';
    if (/^(either|any)$/i.test(text)) return 'Either';
    throw new Error('Choose Manual, Automatic, or Either.');
  }
  if (key === 'vehicle' && /^(a\s+)?(mazda\s+)?(mx-?5\s+)?miata$/i.test(text)) return 'Mazda MX-5 Miata';
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function isSkipAnswer(key, raw) {
  return optionalKeys.includes(key) && /^(?:skip|skip for now|not specified|n\/a)$/i.test(String(raw ?? '').trim());
}

const aliases = {
  car: 'vehicle', vehicle: 'vehicle', make: 'vehicle', model: 'vehicle',
  year: 'year', years: 'year', mileage: 'mileage', miles: 'mileage',
  budget: 'budget', price: 'budget', cost: 'budget',
  zip: 'zip', 'zip code': 'zip', zipcode: 'zip',
  radius: 'radius', distance: 'radius', area: 'radius',
  color: 'color', colour: 'color', trim: 'trim',
  transmission: 'transmission', gearbox: 'transmission',
  condition: 'condition', timeline: 'timeline', timing: 'timeline',
  payment: 'payment_method', 'payment plans': 'payment_method', payment_method: 'payment_method',
  'trade-in': 'trade_in', 'trade in': 'trade_in', trade_in: 'trade_in',
  needs: 'needs', notes: 'notes', 'anything else': 'notes',
};

function keyForAlias(value) {
  const clean = value.toLowerCase().replace(/\s+/g, ' ').trim();
  return aliases[clean];
}

function assign(values, key, raw) {
  const normalized = normalizeAnswer(key, raw);
  if (values[key] && values[key] !== normalized) throw new Error(`I found two different ${fieldByKey(key).label.toLowerCase()} answers. Please keep one.`);
  values[key] = normalized;
}

function cleanVehicle(value) {
  return value.replace(/^(?:i(?:’|')?m looking for|i want|i would like|i’d like|looking for|a|an)\s+/i, '').replace(/^[\s,;]+|[\s,;]+$/g, '').replace(/\s*,\s*,\s*/g, ', ').replace(/\s+(?:for|with|and|at|in|near)\s*$/i, '').trim();
}

function stripNoise(value) {
  return value.replace(/[\s,;:.!?]+/g, ' ').replace(/\b(?:and|or|with|please|for|my|the|car|looking|want|would|like|maybe|also|actually|now)\b/gi, ' ').replace(/\s+/g, ' ').trim();
}

function hasAmbiguousAmount(text) {
  return /\b(?:under|less than|up to|below)\s+\$?\d[\d,]*(?:\.\d+)?\s*k?\b/i.test(text) && !/\$|\b(?:miles?|mi|budget|price|radius|distance)\b/i.test(text);
}

/** Extract common local patterns without mutating anything until all values validate. */
export function parseDetails(raw, currentKey = null) {
  if (currentKey && isSkipAnswer(currentKey, raw)) return { values: {}, skipped: [currentKey], correction: false };
  // Customer context can contain prices, model years, mileage, or color exclusions.
  // Keep it intact instead of interpreting it as changes to the car search.
  if (fieldByKey(currentKey)?.direct) return { values: { [currentKey]: normalizeAnswer(currentKey, raw) }, skipped: [], correction: false };
  const text = String(raw ?? '').trim().replace(/\s+/g, ' ');
  if (!text) throw new Error('Add an answer so I know what to look for.');
  if (text.length > 180) throw new Error('Could you keep that to 180 characters or fewer?');
  const values = {};
  let remaining = text;
  const consume = (match, key, normalized = match[0]) => {
    assign(values, key, normalized);
    remaining = remaining.replace(match[0], ' ');
  };

  if (!currentKey && hasAmbiguousAmount(text)) throw new Error('Which detail should I change—budget or mileage? Please name the detail.');

  const nationwide = text.match(/\b(?:nationwide|anywhere|all (?:of )?(?:the )?(?:us|usa|united states))\b/i);
  if (nationwide) consume(nationwide, 'radius', 'Nationwide');
  const radiusMatches = [...text.matchAll(/\b(?:within|radius(?:\s+of)?|distance(?:\s+of)?)\s+(\d[\d,]*(?:\.\d+)?)\s*(k)?\s*(?:miles?|mi)\b/gi)];
  for (const match of radiusMatches) consume(match, 'radius', `${match[1]}${match[2] || ''}`);
  if (currentKey === 'radius' && !values.radius) {
    const directRadius = remaining.match(/\b(?:within\s+)?(\d[\d,]*(?:\.\d+)?)\s*(k)?\s*(?:miles?|mi)\b/i);
    if (directRadius) {
      assign(values, 'radius', `${directRadius[1]}${directRadius[2] || ''}`);
      remaining = remaining.replace(directRadius[0], ' ');
    }
  }
  const mileageMatches = [...remaining.matchAll(/\b(?:(?:under|less than|up to|below|max(?:imum)?(?:\s+of)?)\s+)?(\d[\d,]*(?:\.\d+)?)\s*(k)?\s*(?:miles?|mi)\b/gi)];
  for (const match of mileageMatches) consume(match, 'mileage', `${match[1]}${match[2] || ''}`);

  // A bare amount answers the active numeric question, not an unrelated ZIP.
  if (['budget', 'mileage', 'radius'].includes(currentKey) && /^\d[\d,]*(?:\.\d+)?\s*k?$/i.test(remaining)) {
    assign(values, currentKey, remaining);
    remaining = '';
  }

  const budgetMatches = [...remaining.matchAll(/(?:\b(?:budget|price|cost)(?:\s+of)?|\b(?:under|up to|less than)\b|\$)\s*:?\s*\$?\s*(\d[\d,]*(?:\.\d+)?)\s*(k)?(?:\s*(?:dollars?|bucks?))?/gi)];
  for (const match of budgetMatches) {
    const after = remaining.slice(match.index + match[0].length);
    if (/^\s*(?:miles?|mi)\b/i.test(after)) continue;
    consume(match, 'budget', `${match[1]}${match[2] || ''}`);
  }

  for (const match of [...remaining.matchAll(/\b(\d[\d,]*(?:\.\d+)?)\s*(k)?\s*(?:dollars?|bucks?)\b/gi)]) consume(match, 'budget', `${match[1]}${match[2] || ''}`);

  // Prices and mileage are consumed first, so $30000 and 40000 miles cannot be ZIPs.
  const zipMatches = [...remaining.matchAll(/(?<![\d$.,])\b\d{5}\b(?![\d,.])/g)];
  for (const match of zipMatches) consume(match, 'zip');
  remaining = remaining.replace(/\b(?:in|near|zip(?: code)?)\s*(?=$|[,;])/gi, ' ');
  const yearMatches = [...remaining.matchAll(/\b(?:19|20)\d{2}(?:\s*[–—-]\s*(?:19|20)\d{2})?(?:\s*(?:or newer|or older|onward|\+))?\b/g)];
  for (const match of yearMatches) consume(match, 'year');

  if (currentKey === 'color' && /\b(?:not|avoid|except|no)\b/i.test(remaining)) {
    assign(values, 'color', remaining);
    remaining = '';
  }
  const anyColor = remaining.match(/\b(?:open to any|any)\s+colou?r\b/i);
  if (anyColor) consume(anyColor, 'color', 'Open to any color');
  const foundColors = colorWords.filter(color => new RegExp(`\\b${color}\\b`, 'i').test(remaining));
  if (foundColors.length && /\b(?:not|avoid|except|no)\b/i.test(remaining)) throw new Error('Please add color exclusions in the brief editor so we keep your preference exactly.');
  if (foundColors.length) {
    const normalized = foundColors.map(color => color[0].toUpperCase() + color.slice(1)).join(' or ');
    for (const color of foundColors) remaining = remaining.replace(new RegExp(`\\b${color}\\b`, 'i'), ' ');
    assign(values, 'color', normalized);
  }

  const transmissionMatches = [...remaining.matchAll(/\b(?:manual|stick(?:\s+shift)?|automatic|auto|either)\b/gi)];
  for (const match of transmissionMatches) consume(match, 'transmission', match[0]);
  const trim = remaining.match(/\b(?:trim\s*(?:level)?\s*[:=-]?\s*)?(?:sport|club|grand touring|touring|limited|premium|base)\s+trim?\b|\b(?:sport|club|grand touring|touring|limited|premium|base)\b/i);
  if (trim) consume(trim, 'trim', trim[0].replace(/\btrim\b/gi, '').trim());
  const anyTrim = remaining.match(/\b(?:open to any|any)\s+trim\b/i);
  if (anyTrim) consume(anyTrim, 'trim', 'Open to any trim');

  const hasRecognized = Object.keys(values).length > 0;
  if (currentKey && !values[currentKey] && !hasRecognized) {
    assign(values, currentKey, currentKey === 'vehicle' ? cleanVehicle(text) : text);
    remaining = '';
  } else if (currentKey === 'vehicle' && !values.vehicle) {
    const vehicle = cleanVehicle(remaining);
    if (vehicle) {
      assign(values, 'vehicle', vehicle);
      remaining = '';
    }
  }

  if (currentKey === 'vehicle' && !values.vehicle) throw new Error('Start with a make and model, or describe the kind of car you want.');
  if (!Object.keys(values).length) {
    if (currentKey) assign(values, currentKey, text);
    else throw new Error('I couldn’t find a detail to change. Please name the detail, like “change my budget to $35k”.');
  }

  const unrecognized = stripNoise(remaining);
  if (unrecognized && Object.keys(values).length > 1) throw new Error(`I recognized some details, but not “${unrecognized}”. Please rephrase without the extra detail so I don’t change the brief partially.`);
  if (unrecognized && !currentKey && Object.keys(values).length) throw new Error(`I recognized a detail, but not “${unrecognized}”. Please name the detail you want to change.`);
  return { values, skipped: [], correction: false };
}

/** Parse an explicit correction and keep it separate from the unanswered current question. */
export function parseCorrection(raw, { explicitOnly = false } = {}) {
  const text = String(raw ?? '').trim();
  if (!correctionPrefix.test(text)) return null;
  const explicit = text.match(/^(?:change|update|edit|set|make)\s+(?:my\s+)?(car|vehicle|make|model|year|years|mileage|miles|budget|price|cost|zip(?:\s+code)?|zipcode|radius|distance|area|color|colour|trim|transmission|gearbox|condition|timeline|timing|payment plans|payment_method|payment|trade-in|trade in|trade_in|needs|notes|anything else)\b\s*(?:to\b|at\b|as\b|:|=)?\s*([\s\S]+)$/i);
  if (explicit) {
    const key = keyForAlias(explicit[1]);
    const target = fieldByKey(key)?.multiline ? explicit[2].trim() : explicit[2].replace(/[.!?]+$/, '').trim();
    if (!key || !target) throw new Error('Which detail should I change? Name it and include the new value.');
    const values = {};
    assign(values, key, target);
    return { values, skipped: [], correction: true };
  }
  if (explicitOnly) return null;
  const remainder = text.replace(/^(?:actually|wait|correction)\s*[,;:]?\s*/i, '').replace(/[.!?]+$/, '').trim();
  if (!remainder) throw new Error('Which detail should I change? Name it and include the new value.');
  const parsed = parseDetails(remainder, null);
  return { ...parsed, correction: true };
}

export function parseConversation(raw, currentKey) {
  const correction = parseCorrection(raw, { explicitOnly: Boolean(fieldByKey(currentKey)?.direct) });
  return correction || parseDetails(raw, currentKey);
}

/** Read common opening phrases; preserve unrecognized vehicle descriptions verbatim. */
export function parseOpening(raw) {
  return parseDetails(raw, 'vehicle').values;
}

export function nextField(answers = {}, skipped = {}) {
  return fields.find(field => !answers[field.key] && !skipped[field.key]);
}

export function nextIntakeField(answers = {}, skipped = {}) {
  return fields.find(field => (field.required || field.intake) && !answers[field.key] && !skipped[field.key]);
}

export function isComplete(answers = {}) {
  return fields.filter(field => field.required).every(field => Boolean(answers[field.key]));
}

export function isFullyResolved(answers = {}, skipped = {}) {
  return fields.every(field => Boolean(answers[field.key] || skipped[field.key]));
}

export function resolvedCount(answers = {}, skipped = {}) {
  return fields.filter(field => Boolean(answers[field.key] || skipped[field.key])).length;
}

export function choicesFor(field, answers) {
  if (field.key !== 'trim') return field.choices;
  if (/miata|mx-?5/i.test(answers.vehicle || '')) return ['Sport', 'Club', 'Grand Touring', 'Open to any trim'];
  return ['Open to any trim'];
}

export function locationText(answers) {
  if (answers.radius === 'Nationwide') return `Nationwide · from ${answers.zip}`;
  if (!answers.radius) return `From ${answers.zip || 'your ZIP'}`;
  return `Within ${answers.radius} of ${answers.zip}`;
}

export function restoredAnswers(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const answers = {};
  for (const field of fields) {
    if (typeof value[field.key] !== 'string') continue;
    try {
      // A legacy Flexible budget was never a valid required budget. Drop it so the draft must be fixed.
      if (field.key === 'budget' && flexible.test(value[field.key])) continue;
      answers[field.key] = normalizeAnswer(field.key, value[field.key]);
    } catch { /* Ignore invalid saved fields. */ }
  }
  return answers;
}

export function restoredSkipped(value, answers = {}) {
  const source = Array.isArray(value) ? Object.fromEntries(value.map(key => [key, true])) : value;
  if (!source || typeof source !== 'object' || Array.isArray(source)) return {};
  return Object.fromEntries(optionalKeys.filter(key => source[key] === true && !answers[key]).map(key => [key, true]));
}

export function defaultPriorities(answers = {}, skipped = {}) {
  return Object.fromEntries(fields.filter(field => field.defaultPriority && isConcrete(field.key, answers[field.key]) && !skipped[field.key]).map(field => [field.key, field.defaultPriority]));
}

export function restoredPriorities(value, answers = {}, skipped = {}) {
  const priorities = defaultPriorities(answers, skipped);
  if (!value || typeof value !== 'object' || Array.isArray(value)) return priorities;
  for (const field of fields) {
    if (field.priority === false || !isConcrete(field.key, answers[field.key]) || skipped[field.key]) continue;
    if (value[field.key] === 'must' || value[field.key] === 'prefer') priorities[field.key] = value[field.key];
  }
  return priorities;
}
