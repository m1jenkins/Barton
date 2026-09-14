import { fields, restoredAnswers, restoredSkipped, restoredPriorities, isConcrete, normalizeAnswer } from './intake.js';

export const BRIEF_KEY = 'drive_right_buying_brief_v1';
export const BRIEF_VERSION = 1;

export function restoreBrief(value) {
  const source = value?.version === BRIEF_VERSION ? value : {};
  const answers = restoredAnswers(source.answers);
  const skipped = restoredSkipped(source.skipped, answers);
  return { version: BRIEF_VERSION, answers, skipped, priorities: restoredPriorities(source.priorities, answers, skipped) };
}

export function applyAnswer(brief, result) {
  const next = restoreBrief(brief);
  for (const [key, value] of Object.entries(result.values || {})) {
    const field = fields.find(item => item.key === key);
    if (!field) continue;
    if (!result.correction && next.answers[key] && next.answers[key] !== value) {
      throw new Error(`You already set ${field.label.toLowerCase()} to “${next.answers[key]}”. Say “Change my ${key} to …” or edit your brief.`);
    }
    next.answers[key] = normalizeAnswer(key, value);
    delete next.skipped[key];
  }
  for (const key of result.skipped || []) {
    const field = fields.find(item => item.key === key);
    if (!field || field.required) throw new Error('Vehicle, car-price budget, and ZIP are required.');
    delete next.answers[key];
    next.skipped[key] = true;
  }
  next.priorities = restoredPriorities(next.priorities, next.answers, next.skipped);
  return next;
}

export function briefText(brief) {
  const { answers, skipped, priorities } = restoreBrief(brief);
  const lines = ['DRIVE RIGHT — YOUR BUYING BRIEF', ''];
  for (const field of fields) {
    const value = answers[field.key] || (skipped[field.key] ? 'Not specified (skipped)' : 'Not specified (not yet answered)');
    const priority = isConcrete(field.key, answers[field.key]) ? ` [${priorities[field.key] === 'must' ? 'Must-have' : 'Prefer'}]` : '';
    const note = field.key === 'budget' ? ' (vehicle price before taxes, fees, and delivery; not an all-in budget)' : field.key === 'zip' ? ' (search origin)' : '';
    lines.push(`${field.label.replace(/\?$/, '')}: ${value}${priority}${note}`);
  }
  return lines.join('\n');
}

// Storage access itself can throw. History is a same-tab fallback, including refresh.
export function createStore(w, key = BRIEF_KEY, { local = true } = {}) {
  let memory;
  let persistence = 'memory';
  const stores = () => {
    const result = [];
    for (const name of local ? ['localStorage', 'sessionStorage'] : ['sessionStorage']) {
      try { if (w[name]) result.push([name, w[name]]); } catch { /* Private browsing. */ }
    }
    return result;
  };
  return {
    get persistence() { return persistence; },
    read(fresh = false) {
      if (fresh) memory = undefined;
      if (memory !== undefined) return memory;
      for (const [name, storage] of stores()) {
        try {
          const value = JSON.parse(storage.getItem(key));
          if (value) { persistence = name; return (memory = value); }
        } catch { /* Ignore damaged or inaccessible storage. */ }
      }
      return (memory = w.history?.state?.[key] || null);
    },
    write(value) {
      memory = value;
      persistence = 'memory';
      for (const [name, storage] of stores()) {
        try { storage.setItem(key, JSON.stringify(value)); if (persistence === 'memory') persistence = name; } catch { /* Try next store. */ }
      }
      try { w.history.replaceState({ ...w.history.state, [key]: value }, ''); } catch { /* Memory still works. */ }
      return persistence;
    },
  };
}

export function onboardingValues(brief, contact = {}) {
  const { answers } = restoreBrief(brief);
  const values = { name: contact.name || '', email: contact.email || '', phone: contact.phone || '', preferred_makes: answers.vehicle || '', colors: answers.color || '' };
  const selections = {
    condition: { New: 'new', Used: 'used', 'Certified pre-owned': 'cpo', 'Open to all': 'open' },
    payment_method: { Cash: 'cash', Financing: 'finance', Lease: 'lease', 'Not sure yet': 'undecided' },
    trade_in: { 'No trade-in': 'no', 'Yes, I have a trade-in': 'yes', 'Not sure yet': 'maybe' },
    timeline: { 'As soon as possible': 'asap', 'Within 2 weeks': '2-weeks', 'Within a month': '1-month', 'No rush': 'flexible' },
  };
  for (const [key, options] of Object.entries(selections)) {
    if (Object.hasOwn(options, answers[key])) values[key] = options[answers[key]];
  }
  const types = [['suv', /\b(?:suv|crossover)\b/i], ['truck', /\b(?:truck|pickup)\b/i], ['sedan', /\bsedan\b/i], ['minivan', /\bminivan\b/i], ['wagon', /\b(?:wagon|hatchback)\b/i], ['coupe', /\b(?:coupe|sports car)\b/i]];
  const matches = types.filter(([, pattern]) => pattern.test(answers.vehicle || ''));
  if (matches.length === 1) values.vehicle_type = matches[0][0];
  // ZIP is not a city, and vehicle-price budget is not a total/out-the-door budget.
  // Keep both in the complete notes; only populate fields with matching semantics.
  if (/^\d{4}(?:–\d{4}| or newer)?$/.test(answers.year || '')) values.year_min = answers.year.slice(0, 4);
  if (/^Under [\d,]+ mi$/.test(answers.mileage || '')) values.max_mileage = answers.mileage.replace(/\D/g, '');
  if (Object.keys(answers).length) values.notes = briefText(brief);
  return values;
}
