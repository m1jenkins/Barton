// The numbers behind the two deal pages (scripts/render-deal-pages.mjs). Everything here reads data/vehicle-pages.json,
// so a monthly refresh of the price guides flows through; data/deal-pages.json holds only copy, ordering inputs and the pages' own sources.
// Anything the parsers do not recognise throws, so a refreshed guide cannot slip a new wording past them silently.

export const monthNumber = { January: 1, February: 2, March: 3, April: 4, May: 5, June: 6, July: 7, August: 8, September: 9, October: 10, November: 11, December: 12 };
export const monthName = Object.fromEntries(Object.entries(monthNumber).map(([name, number]) => [number, name]));
export const dollars = value => `$${Math.round(value).toLocaleString('en-US')}`;
export const strip = html => String(html).replace(/<[^>]+>/g, '');
export const longDate = iso => new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
export const shortDate = iso => new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
export const roundTo50 = value => Math.round(value / 50) * 50;
export const carKey = vehicle => vehicle.slug.replace(/-price\.html$/, '');

// ---- Discounts ("What to pay") -----------------------------------------------------------------------------------------
// A guide's discount reads "2–3% under", "4% under", "4% or more", "MSRP" or "Any discount", as in render-vehicle-pages.mjs.
export function discountRange(text) {
  if (text === 'MSRP') return { low: 0, high: 0, open: false };
  if (text === 'Any discount') return { low: 0, high: 0, open: true };
  const found = text.match(/^(\d+(?:\.\d+)?)(?:–(\d+(?:\.\d+)?))?% (under|or more)$/);
  if (!found) throw new Error(`Unreadable discount "${text}"`);
  const low = Number(found[1]);
  const open = found[3] === 'or more';
  return { low, high: open ? low : Number(found[2] ?? found[1]), open };
}
export const midpoint = range => (range.low + range.high) / 2;
export const percentText = (text, base = 'MSRP') => {
  if (text === 'MSRP') return 'At MSRP';
  if (text === 'Any discount') return 'Any discount';
  return text.replace(/ under$/, ` under ${base}`);
};
export function dollarsOff(text, price) {
  const range = discountRange(text);
  if (!range.low && !range.high) return null;
  const low = roundTo50(price * range.low / 100), high = roundTo50(price * range.high / 100);
  if (range.open) return `${dollars(low)} or more`;
  return low === high ? dollars(low) : `${dollars(low)}–${dollars(high)}`;
}

// One entry per guide: its pick trim, the pay row that covers it, and the numbers the ranking needs.
export function rankCars(vehicles, config) {
  const rows = [];
  for (const vehicle of vehicles) {
    const key = carKey(vehicle);
    const car = config.cars[key];
    if (!car) throw new Error(`data/deal-pages.json has no entry for ${key}`);
    if (car.fixedPrice) continue;
    const pay = vehicle.pay.rows[car.payRow];
    if (!pay) throw new Error(`${key}: pay row ${car.payRow} does not exist`);
    const pick = vehicle.trims.rows.find(trim => trim.pick);
    if (!pick) throw new Error(`${key}: no pick trim`);
    const price = pick.prices[0];
    if (typeof price !== 'number') throw new Error(`${key}: the pick trim's first price is not a number`);
    const fair = discountRange(pay.fair), strong = discountRange(pay.strong);
    const headline = vehicle.glance.find(tile => tile.section === 'incentives');
    if (!headline) throw new Error(`${key}: no incentives tile in glance`);
    rows.push({ key, vehicle, car, pay, pick, price, fair, strong, score: midpoint(fair), strongScore: midpoint(strong), headline: strip(headline.value).replace(/\s+/g, ' ').trim() });
  }
  rows.sort((a, b) => b.score - a.score || b.strongScore - a.strongScore || a.vehicle.name.localeCompare(b.vehicle.name));
  return rows;
}

// ---- Offers ------------------------------------------------------------------------------------------------------------
const moneyFirst = text => { const found = text.match(/\$([\d,]+)/); return found ? Number(found[1].replace(/,/g, '')) : null; };
const moneyMax = text => Math.max(...[...text.matchAll(/\$([\d,]+)/g)].map(found => Number(found[1].replace(/,/g, ''))));
// Dates in an `ends` string. A date with no year ("through November 30") is the next such day on or after `asOf`.
// A date after "from" is a start date ("deliveries from November 3, 2026"), not an end.
function dateIn(text, asOf) {
  const found = [];
  for (const match of text.replace(/\bfrom [A-Z][a-z]+ \d{1,2}(?:, \d{4})?/g, '').matchAll(/([A-Z][a-z]+) (\d{1,2})(?:, (\d{4}))?/g)) {
    if (!monthNumber[match[1]]) continue;
    const month = String(monthNumber[match[1]]).padStart(2, '0'), day = String(match[2]).padStart(2, '0');
    let iso = `${match[3] ?? asOf.slice(0, 4)}-${month}-${day}`;
    if (!match[3] && iso < asOf) iso = `${Number(asOf.slice(0, 4)) + 1}-${month}-${day}`;
    found.push(iso);
  }
  return found;
}

// How an `ends` string reads against the date the page is built for: live, over, over in most places, or undated.
export function endState(ends, asOf) {
  const dates = dateIn(ends || '', asOf).sort();
  if (!dates.length) return { state: 'undated', first: null, last: null };
  const first = dates[0], last = dates.at(-1);
  if (last < asOf) return { state: 'over', first, last };
  if (first < asOf) return { state: 'mostly-over', first, last };
  return { state: 'live', first, last };
}
// A card says "Ends November 30." or "Ends January 4." with no year; the next such date on or after the page date is meant.
export function cardEnd(text, asOf) {
  const found = text.match(/Ends ([A-Z][a-z]+) (\d{1,2})/);
  if (!found || !monthNumber[found[1]]) return null;
  const year = Number(asOf.slice(0, 4));
  let iso = `${year}-${String(monthNumber[found[1]]).padStart(2, '0')}-${String(found[2]).padStart(2, '0')}`;
  if (iso < asOf) iso = `${year + 1}${iso.slice(4)}`;
  return iso;
}

const noOffer = /^(No public offers|No finance|No financing|Excluded from)/i;
const programWords = /military|college|graduate|first responder|recognition|loyalty|conquest|costco|step-up/i;

export function classify(vehicle, row, overrides) {
  const override = overrides[`${vehicle.slug}|${row.offer}`];
  if (override) return { ...override };
  if (noOffer.test(row.detail)) return { kind: 'none' };
  if (programWords.test(row.offer)) return { kind: 'program', amount: moneyFirst(row.offer) ?? moneyFirst(row.detail) };
  if (/financing/i.test(row.offer) && /\d%/.test(row.detail)) return { kind: 'apr', rateText: row.detail.match(/(\d+(?:\.\d+)?%)/)[1], rate: Number(row.detail.match(/(\d+(?:\.\d+)?)%/)[1]), term: termIn(row.detail) };
  if (/\blease/i.test(row.offer)) return lease(row);
  const rate = row.offer.match(/^(\d+(?:\.\d+)?)%(?: (?:to|or) (\d+(?:\.\d+)?)%)? APR/);
  if (rate) return { kind: 'apr', rate: Number(rate[1]), rateText: rate[2] ? `${rate[1]}–${rate[2]}%` : `${rate[1]}%`, term: termIn(row.offer) ?? termIn(row.detail) };
  if (/cash|allowance|price cut/i.test(row.offer)) {
    const upTo = /^Up to/i.test(row.detail);
    const figure = upTo ? moneyMax(row.detail) : moneyFirst(row.offer) ?? moneyFirst(row.detail);
    if (!Number.isFinite(figure)) throw new Error(`${vehicle.slug}: no cash figure in "${row.offer}"; add an override in data/deal-pages.json`);
    return { kind: 'cash', figure, upTo };
  }
  if (/Certified used rate/i.test(row.offer)) return { kind: 'used' };
  return { kind: 'other' };
}
function termIn(text) {
  const found = text.match(/(up to )?(\d+)(?: to (\d+))? months/i);
  if (!found) return null;
  return `${found[1] ? 'up to ' : ''}${found[3] ? `${found[2]} to ${found[3]}` : found[2]} months`;
}
function lease(row) {
  const text = `${row.offer} ${row.detail}`;
  const pay = text.match(/\$([\d,]+) a month/);
  const months = text.match(/(\d+)(?: or \d+)? months/);
  const due = text.match(/\$([\d,]+) due/);
  if (!pay || !months) return { kind: 'lease', payment: null };
  const payment = Number(pay[1].replace(/,/g, '')), term = Number(months[1]);
  const signing = due ? Number(due[1].replace(/,/g, '')) : null;
  return { kind: 'lease', payment, term, signing, effective: signing === null ? null : payment + signing / term };
}

export function offerLedger(vehicles, config) {
  const overrides = config.rowKinds;
  const used = new Set();
  const offers = [];
  for (const vehicle of vehicles) {
    const key = carKey(vehicle);
    const car = config.cars[key];
    for (const row of vehicle.incentives.rows) {
      const found = classify(vehicle, row, overrides);
      if (overrides[`${vehicle.slug}|${row.offer}`]) used.add(`${vehicle.slug}|${row.offer}`);
      offers.push({ key, vehicle, car, row, ...found, end: endState(row.ends, config.asOf) });
    }
  }
  for (const name of Object.keys(overrides)) if (!used.has(name)) throw new Error(`rowKinds entry "${name}" matches no incentive row; the guide changed, so review it`);
  return offers;
}

// ---- Cash or the rate? --------------------------------------------------------------------------------------------------
export const totalPaid = (amount, apr, months) => { if (!apr) return amount; const r = apr / 1200; return (amount * r / (1 - (1 + r) ** -months)) * months; };
// The loan rate at which taking `cash` and borrowing at that rate costs the same as the rate offer. Below it, take the cash.
export function breakEven(choice, rateOption, cashOption) {
  const target = totalPaid(choice.price - rateOption.cash, rateOption.rate, choice.months);
  let low = 0, high = 40;
  for (let i = 0; i < 80; i++) {
    const mid = (low + high) / 2;
    if (totalPaid(choice.price - cashOption.cash, mid, choice.months) < target) low = mid; else high = mid;
  }
  return Math.round(low * 100) / 100;
}
export function cashOrRate(vehicle, pair, topCredit) {
  const choice = vehicle.incentives.choice;
  if (!choice) throw new Error(`${vehicle.slug}: no incentives.choice`);
  const rate = choice.options[pair.rate], cash = choice.options[pair.cash];
  if (!rate || !cash) throw new Error(`${vehicle.slug}: cashOrRate option index out of range`);
  const average = totalPaid(choice.price, choice.baseRate, choice.months);
  const lessRate = average - totalPaid(choice.price - rate.cash, rate.rate, choice.months);
  const lessCash = average - totalPaid(choice.price - cash.cash, cash.rate, choice.months);
  const even = breakEven(choice, rate, cash);
  return { vehicle, choice, rate, cash, lessRate, lessCash, even, topCredit, cashAtTop: even > topCredit };
}

// ---- Substitution ---------------------------------------------------------------------------------------------------------
// Copy may hold {tokens}; an unknown one throws, so a typo cannot reach the page.
export function fill(text, tokens) {
  return text.replace(/\{([A-Za-z0-9.]+)\}/g, (_, name) => {
    if (!(name in tokens)) throw new Error(`Unknown token {${name}} in "${text.slice(0, 60)}"`);
    return tokens[name];
  });
}
// A copy line that quotes a guide's wording must still find it there after a refresh.
export function checkNeeds(vehicles, needs, where) {
  for (const { slug, text } of needs) {
    const vehicle = vehicles.find(item => item.slug === slug);
    if (!vehicle) throw new Error(`${where}: no guide ${slug}`);
    if (!JSON.stringify(vehicle).replaceAll('\\"', '"').includes(text)) throw new Error(`${where}: "${text}" is no longer in ${slug}; the guide changed, so reread this line`);
  }
}
