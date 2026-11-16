import { readFile, writeFile } from 'node:fs/promises';
import { basename, dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { escapeHtml, oneLine } from '../api/_lib/intake-email.js';

// The "car search update" email: a dashboard-style HTML email for a buyer, built
// from one JSON file per deal (see "Deal update email" in
// docs/implementation-operations.md). The JSON lives in .car-searches/ (git-ignored)
// because it holds a buyer's deal. Nothing here sends mail or reads the database.
//
// Data file fields (money in cents):
//   updated_at, buyer_first_name,
//   search { title, down_cents, target_payment_cents },
//   assumptions { tax_rate, fees_cents, new { label, apr, months }, used { label, apr, months } },
//   cars[] { rank, title, short_title?, condition, finance 'new'|'used', color, mileage, dealer, dealer_short,
//            location, distance_miles, listing_url, asking_cents, market_cents, days_on_lot,
//            status 'negotiating'|'quoted'|'waiting'|'dropped',
//            quote_otd_cents?, first_quote_otd_cents?, quote_sale_cents?,
//            our_offer_otd_cents? | our_offer_sale_cents?, credits[] { label, cents, in_quote }, notes[] },
//   activity[] { at, text }
//
// Email clients strip scripts, flex, grid and SVG, so every chart is a table whose
// cell widths are percentages. Only fields named below are read: a target price,
// a walk-away price, dealer contacts or anything else in the JSON never reaches the email.

const COLOR = Object.freeze({
  navy: '#0E1B2E', sign: '#1A4B8C', tint: '#EDF0F4', sky: '#E3ECF8', line: '#DDE2E9', grid: '#E8ECF1',
  body: '#465061', soft: '#6B7585', rest: '#9AA8BB', estimate: '#B4C7E2', white: '#FFFFFF'
});
const FONT = "Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif";
const DISPLAY = "'Inter Tight',Inter,'Helvetica Neue',Arial,sans-serif";
const FONT_ORIGIN = 'https://www.steermeright.com/assets/buying/fonts';
const STATUS = Object.freeze({
  negotiating: { label: 'Negotiating', color: COLOR.sign, order: 0 },
  quoted: { label: 'Dealer priced it', color: '#6F9BD1', order: 1 },
  waiting: { label: 'Waiting on reply', color: COLOR.rest, order: 2 },
  dropped: { label: 'Dropped', color: '#C3CBD6', order: 3 }
});

// ---------- Numbers ----------

export function estimatePayment({ financedCents, aprPercent, months }) {
  if (!(financedCents > 0)) return 0;
  const monthly = aprPercent / 100 / 12;
  const dollars = financedCents / 100;
  const payment = monthly === 0 ? dollars / months : dollars * monthly / (1 - (1 + monthly) ** -months);
  return Math.round(payment * 100);
}

const wholeDollars = cents => Math.round(cents / 100);
const usd = cents => cents == null ? '' : `$${new Intl.NumberFormat('en-US').format(wholeDollars(cents))}`;
const signedUsd = cents => `${cents < 0 ? '−' : '+'}$${new Intl.NumberFormat('en-US').format(Math.abs(wholeDollars(cents)))}`;
const miles = value => `${new Intl.NumberFormat('en-US').format(value)} mi`;
const clamp = (value, low, high) => Math.min(high, Math.max(low, value));
const percent = (part, whole) => whole > 0 ? clamp(Math.round(part / whole * 100), 0, 100) : 0;
const when = iso => new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/Chicago', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short'
}).format(new Date(iso));
const whenShort = iso => new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/Chicago', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
}).format(new Date(iso));
const day = iso => new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', month: 'short', day: 'numeric' }).format(new Date(iso));

function safeUrl(value) {
  try {
    const url = new URL(String(value));
    if (['http:', 'https:'].includes(url.protocol) && !url.username && !url.password) return url.href;
  } catch {}
  return '';
}

// Adds the numbers the email shows to each car. A dealer's out-the-door quote is
// used as given. Otherwise the out-the-door price is estimated from the dealer's
// price, or failing that the online listing, plus tax and about $1,000 of fees.
export function analyze(data) {
  if (!data || !Array.isArray(data.cars) || data.cars.length === 0) throw new Error('The deal data needs a cars list.');
  const { down_cents: down, target_payment_cents: goal } = data.search || {};
  if (!Number.isInteger(down) || !Number.isInteger(goal)) throw new Error('search.down_cents and search.target_payment_cents are required.');
  const { tax_rate: tax, fees_cents: fees } = data.assumptions || {};
  const estimateOtd = price => Math.round(price * (1 + tax)) + fees;

  const cars = data.cars.map(car => {
    const hasQuote = car.quote_otd_cents != null;
    const dealerPrice = hasQuote || car.quote_sale_cents != null;
    const otd = hasQuote ? car.quote_otd_cents : estimateOtd(car.quote_sale_cents ?? car.asking_cents);
    const extraCredit = (car.credits || []).filter(credit => credit.in_quote === false).reduce((sum, credit) => sum + credit.cents, 0);
    const otdAfterCredits = otd - extraCredit;
    const loan = data.assumptions[car.finance === 'new' ? 'new' : 'used'];
    const payment = estimatePayment({ financedCents: otdAfterCredits - down, aprPercent: loan.apr, months: loan.months });
    const ourOffer = car.our_offer_otd_cents ?? (car.our_offer_sale_cents != null ? estimateOtd(car.our_offer_sale_cents) : null);
    return {
      ...car, hasQuote, dealerPrice, otd, otdAfterCredits, extraCredit, payment, ourOffer,
      ourOfferIsEstimate: car.our_offer_otd_cents == null && ourOffer != null,
      marketGap: car.asking_cents - car.market_cents,
      marketOtd: estimateOtd(car.market_cents)
    };
  });

  const live = cars.filter(car => car.status !== 'dropped');
  const priced = live.filter(car => car.dealerPrice);
  const best = [...priced].sort((a, b) => a.payment - b.payment)[0] || null;
  const lowestQuote = [...live.filter(car => car.hasQuote)].sort((a, b) => a.otdAfterCredits - b.otdAfterCredits)[0] || null;
  const counts = Object.fromEntries(Object.keys(STATUS).map(key => [key, cars.filter(car => car.status === key).length]));
  return { cars, live, priced, best, lowestQuote, counts, down, goal, tax, fees };
}

// ---------- HTML pieces ----------

const e = escapeHtml;
const space = '&nbsp;';

function cardRow(inner, { gap = 12 } = {}) {
  return `<tr><td style="padding:0 0 ${gap}px">`
    + `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${COLOR.white};border:1px solid ${COLOR.line};border-radius:16px">`
    + `<tr><td class="pad" style="padding:22px 24px;font-family:${FONT};color:${COLOR.navy}">${inner}</td></tr></table></td></tr>`;
}

const heading = (text, sub = '') => `<h2 style="margin:0;font:600 19px/1.3 ${FONT};color:${COLOR.navy}">${e(text)}</h2>`
  + (sub ? `<p style="margin:4px 0 0;font:400 14px/1.45 ${FONT};color:${COLOR.body}">${sub}</p>` : '');

const dot = color => `<span style="color:${color};font-size:13px;line-height:1">&#9679;</span>`;
const statusText = car => `${dot(STATUS[car.status].color)}${space}<span style="color:${COLOR.body}">${e(STATUS[car.status].label)}</span>`;

// A horizontal bar made of table cells. `pct` is 0 to 100 of the cell's width.
function bar(pct, color, height = 16) {
  const width = clamp(Math.round(pct), pct > 0 ? 1 : 0, 100);
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>`
    + (width > 0 ? `<td width="${width}%" bgcolor="${color}" style="background:${color};height:${height}px;line-height:${height}px;font-size:0;border-radius:0 4px 4px 0">${space}</td>` : '')
    + (width < 100 ? `<td style="font-size:0;line-height:${height}px">${space}</td>` : '')
    + `</tr></table>`;
}

function meter(pct, color = COLOR.sign) {
  const width = clamp(Math.round(pct), 0, 100);
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:12px"><tr>`
    + (width > 0 ? `<td width="${width}%" bgcolor="${color}" style="background:${color};height:8px;line-height:8px;font-size:0;border-radius:999px">${space}</td>` : '')
    + (width < 100 ? `<td width="${100 - width}%" bgcolor="${COLOR.sky}" style="background:${COLOR.sky};height:8px;line-height:8px;font-size:0;border-radius:999px">${space}</td>` : '')
    + `</tr></table>`;
}

function kpi(label, value, sub, meterHtml = '', position = 'middle') {
  const padding = position === 'first' ? '0 5px 0 0' : position === 'last' ? '0 0 0 5px' : '0 5px';
  return `<td class="stack kpi" width="33%" valign="top" style="padding:${padding}">`
    + `<table role="presentation" class="tile" width="100%" height="150" cellpadding="0" cellspacing="0" border="0" style="background:${COLOR.white};border-radius:14px;height:150px"><tr>`
    + `<td style="padding:16px 18px;font-family:${FONT}">`
    + `<p style="margin:0;font:600 13px/1.3 ${FONT};color:${COLOR.body}">${e(label)}</p>`
    + `<p style="margin:8px 0 0;font:600 30px/1.05 ${FONT};letter-spacing:-0.5px;color:${COLOR.navy}">${value}</p>`
    + meterHtml
    + `<p style="margin:10px 0 0;font:400 13px/1.4 ${FONT};color:${COLOR.body}">${sub}</p>`
    + `</td></tr></table></td>`;
}

function lede(a, search) {
  const { priced, goal } = a;
  const under = priced.filter(car => car.payment <= goal);
  const goalText = `${usd(goal)} a month`;
  const downText = usd(a.down);
  if (priced.length === 0) return `No dealer has priced a car yet. We are waiting on replies from ${a.counts.waiting} dealers.`;
  const lead = priced.length === 1 ? 'One car has a dealer price' : `${priced.length} cars have a dealer price`;
  if (under.length === priced.length) return `${lead}, and ${priced.length === 1 ? 'it lands' : 'all land'} under your ${goalText} goal with ${downText} down.`;
  if (under.length === 0) return `${lead}, and ${priced.length === 1 ? 'it is' : 'none are'} under your ${goalText} goal with ${downText} down yet.`;
  return `${lead}. ${under.length} of them land under your ${goalText} goal with ${downText} down.`;
}

function kpiRow(a) {
  const { best, lowestQuote, goal, priced, cars, down } = a;
  const tiles = [
    best
      ? kpi('Lowest estimated payment', `${usd(best.payment)}<span style="font-size:15px;font-weight:400;color:${COLOR.body}"> /mo</span>`,
        `${e(best.dealer_short)}, car #${best.rank}. Goal: ${usd(goal)}.`, meter(percent(best.payment, goal)), 'first')
      : kpi('Lowest estimated payment', '—', 'Waiting on dealer prices.', '', 'first'),
    lowestQuote
      ? kpi('Lowest out-the-door quote', usd(lowestQuote.otdAfterCredits),
        `${e(lowestQuote.dealer_short)}${lowestQuote.extraCredit || (lowestQuote.credits || []).some(credit => credit.in_quote) ? ', credits included' : ''}. After ${usd(down)} down.`,
        meter(percent(lowestQuote.otdAfterCredits - down, lowestQuote.otdAfterCredits)))
      : kpi('Lowest out-the-door quote', '—', 'No itemized quote yet.'),
    kpi('Cars with a dealer price', `${priced.length}<span style="font-size:15px;font-weight:400;color:${COLOR.body}"> of ${cars.length}</span>`,
      `${a.counts.negotiating + a.counts.quoted} in play, ${a.counts.waiting} waiting on a reply.`, meter(percent(priced.length, cars.length)), 'last')
  ];
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>${tiles.join('')}</tr></table>`;
}

// One stacked bar split by status, with a legend underneath.
function pipeline(a) {
  const order = Object.keys(STATUS).sort((x, y) => STATUS[x].order - STATUS[y].order);
  const total = a.cars.length;
  const cells = order.filter(key => a.counts[key] > 0).map(key => {
    const width = Math.max(1, Math.round(a.counts[key] / total * 100));
    return `<td width="${width}%" bgcolor="${STATUS[key].color}" align="center" style="background:${STATUS[key].color};height:30px;font:600 13px/30px ${FONT};color:${key === 'waiting' || key === 'dropped' ? COLOR.navy : COLOR.white}">${a.counts[key]}</td>`;
  }).join('<td width="2" style="font-size:0">&nbsp;</td>');
  const legend = order.map(key => `<td style="padding:10px 14px 0 0;font:400 13px/1.3 ${FONT};color:${COLOR.body}">${dot(STATUS[key].color)}${space}${e(STATUS[key].label)}</td>`).join('');
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:14px"><tr>${cells}</tr></table>`
    + `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>${legend}</tr></table>`;
}

// "Ex-loaner, sold as new" becomes "Ex-loaner"; "BMW Certified" becomes "Certified".
const shortCondition = car => car.condition.split(',')[0].replace(/^BMW /, '');

// Horizontal bars of estimated monthly payment with a line at the goal.
function paymentChart(a) {
  const rows = a.live.slice().sort((x, y) => x.payment - y.payment);
  const top = Math.max(a.goal, ...rows.map(car => car.payment));
  const scale = Math.ceil(top * 1.08 / 25000) * 25000;
  const linePct = a.goal / scale * 100;
  const overRoom = scale - a.goal;
  const chartRows = rows.map(car => {
    const color = car.dealerPrice ? COLOR.sign : COLOR.estimate;
    const under = car.payment <= a.goal;
    const inside = bar(under ? car.payment / a.goal * 100 : 100, color, 18);
    const outside = under ? '' : bar((car.payment - a.goal) / overRoom * 100, color, 18);
    // The vertical padding sits on the cell that carries the goal line, so the line runs unbroken down the chart.
    return `<tr>`
      + `<td width="128" style="padding:6px 8px 6px 0;font:400 12px/1.3 ${FONT};color:${COLOR.body}"><strong style="font-weight:600;font-size:13px;color:${COLOR.navy}">${e(car.dealer_short)}</strong> <span style="color:${COLOR.soft}">#${car.rank}</span><br>${e(shortCondition(car))}</td>`
      + `<td style="padding:0"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>`
      + `<td width="${linePct.toFixed(1)}%" style="padding:7px 0;border-right:2px solid ${COLOR.navy}">${inside}</td>`
      + `<td width="${(100 - linePct).toFixed(1)}%" style="padding:7px 0">${outside}</td></tr></table></td>`
      + `<td width="58" align="right" style="padding:6px 0 6px 8px;font:600 14px/1.2 ${FONT};color:${COLOR.navy}">${usd(car.payment)}</td></tr>`;
  }).join('');
  const axis = `<tr><td width="128"></td><td style="padding-top:2px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>`
    + `<td width="${linePct.toFixed(1)}%" align="right" style="font:600 12px/1.3 ${FONT};color:${COLOR.navy}">${usd(a.goal)} goal</td>`
    + `<td align="right" style="padding-left:8px;font:400 12px/1.3 ${FONT};color:${COLOR.soft}">${usd(scale)}</td></tr></table></td><td width="58"></td></tr>`;
  const legend = `<p style="margin:14px 0 0;font:400 13px/1.5 ${FONT};color:${COLOR.body}">`
    + `<span style="color:${COLOR.sign}">&#9632;</span> Based on a price from the dealer${space}${space}`
    + `<span style="color:${COLOR.estimate}">&#9632;</span> Estimated from the online listing</p>`;
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:16px">${chartRows}${axis}</table>${legend}`;
}

// Bars for one car's out-the-door price: what the dealer said, what we offered, and the market.
function priceLadder(car) {
  // When the dealer's price is exactly our offer, one bar says so instead of two identical ones.
  const matched = car.ourOffer != null && car.ourOffer === car.otd && car.extraCredit === 0;
  const estimate = car.ourOfferIsEstimate || !car.hasQuote ? ', est.' : '';
  const rows = [
    car.first_quote_otd_cents != null && car.first_quote_otd_cents !== car.otd && { label: 'First quote', cents: car.first_quote_otd_cents, color: COLOR.rest },
    !matched && { label: car.hasQuote ? 'Latest quote' : 'Dealer price, est.', cents: car.otd, color: car.hasQuote ? COLOR.sign : COLOR.estimate },
    car.extraCredit > 0 && { label: 'After credit', cents: car.otdAfterCredits, color: COLOR.sign },
    car.ourOffer != null && { label: matched ? `Our offer, matched${estimate}` : `Our offer${car.ourOfferIsEstimate ? ', est.' : ''}`, cents: car.ourOffer, color: COLOR.navy },
    { label: 'Market value, est.', cents: car.marketOtd, color: COLOR.rest }
  ].filter(Boolean);
  const values = rows.map(row => row.cents);
  const floor = Math.floor(Math.min(...values) * 0.94 / 500000) * 500000;
  const ceiling = Math.max(...values);
  const body = rows.map(row => `<tr>`
    + `<td width="112" style="padding:4px 8px 4px 0;font:400 13px/1.3 ${FONT};color:${COLOR.body}">${e(row.label)}</td>`
    + `<td style="padding:4px 0">${bar(percent(row.cents - floor, ceiling - floor), row.color, 14)}</td>`
    + `<td width="64" align="right" style="padding:4px 0 4px 8px;font:600 13px/1.3 ${FONT};color:${COLOR.navy}">${usd(row.cents)}</td></tr>`).join('');
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:14px">${body}</table>`
    + `<p style="margin:6px 0 0;font:400 12px/1.4 ${FONT};color:${COLOR.soft}">Out-the-door price. Bars start at ${usd(floor)}.</p>`;
}

function carCard(car, a) {
  const link = safeUrl(car.listing_url);
  const room = a.goal - car.payment;
  const credits = (car.credits || []).filter(credit => credit.in_quote === false)
    .map(credit => `<tr><td style="padding:6px 0;font:400 14px/1.4 ${FONT};color:${COLOR.body};border-top:1px solid ${COLOR.grid}">${e(credit.label)}</td>`
      + `<td align="right" style="padding:6px 0;font:600 14px/1.4 ${FONT};color:${COLOR.navy};border-top:1px solid ${COLOR.grid}">−${usd(credit.cents)}</td></tr>`).join('');
  const notes = (car.notes || []).map(note => `<tr><td width="14" valign="top" style="padding:3px 0 0;font-size:10px;color:${COLOR.rest}">&#9679;</td>`
    + `<td style="padding:2px 0 4px;font:400 13px/1.5 ${FONT};color:${COLOR.body}">${e(note)}</td></tr>`).join('');
  const inner = `<p style="margin:0;font:600 12px/1.3 ${FONT};letter-spacing:0.6px;text-transform:uppercase;color:${COLOR.body}">#${car.rank}${space}·${space}${statusText(car)}</p>`
    + `<h3 style="margin:8px 0 0;font:600 19px/1.3 ${FONT};color:${COLOR.navy}">${e(car.title)}</h3>`
    + `<p style="margin:4px 0 0;font:400 14px/1.5 ${FONT};color:${COLOR.body}">${e(car.condition)}${space}·${space}${e(car.color)}${space}·${space}${e(miles(car.mileage))}`
    + (link ? `${space}·${space}<a href="${e(link)}" style="color:${COLOR.sign};font-weight:600">Listing</a>` : '')
    + `<br>${e(car.dealer)}, ${e(car.location)} (${car.distance_miles} mi)${space}·${space}${car.days_on_lot} days on the lot</p>`
    + `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:16px;border-top:1px solid ${COLOR.line};border-bottom:1px solid ${COLOR.line}"><tr>`
    + `<td class="stack" width="50%" valign="top" style="padding:14px 12px 14px 0;font-family:${FONT}">`
    + `<p style="margin:0;font:400 13px/1.3 ${FONT};color:${COLOR.body}">Estimated payment</p>`
    + `<p style="margin:2px 0 0;font:600 28px/1.1 ${FONT};letter-spacing:-0.5px;color:${COLOR.navy}">${usd(car.payment)}<span style="font-size:14px;font-weight:400;color:${COLOR.body}"> /mo</span></p>`
    + `<p style="margin:4px 0 0;font:400 13px/1.4 ${FONT};color:${COLOR.body}">${room >= 0 ? `${usd(room)} under` : `${usd(-room)} over`} your ${usd(a.goal)} goal</p></td>`
    + `<td class="stack" width="50%" valign="top" style="padding:14px 0 14px 12px;font-family:${FONT}">`
    + `<p style="margin:0;font:400 13px/1.3 ${FONT};color:${COLOR.body}">${car.hasQuote ? 'Out the door' : 'Out the door, estimated'}</p>`
    + `<p style="margin:2px 0 0;font:600 28px/1.1 ${FONT};letter-spacing:-0.5px;color:${COLOR.navy}">${usd(car.otdAfterCredits)}</p>`
    + `<p style="margin:4px 0 0;font:400 13px/1.4 ${FONT};color:${COLOR.body}">Asking ${usd(car.asking_cents)}, market ${usd(car.market_cents)}</p></td></tr></table>`
    + (credits ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${credits}</table>` : '')
    + priceLadder(car)
    + (notes ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:14px">${notes}</table>` : '');
  return cardRow(inner);
}

// Asking price against market value: the bar grows left when below market, right when above.
function gapCell(gap) {
  const span = 10000_00;
  const width = Math.max(gap === 0 ? 0 : 6, Math.round(Math.min(Math.abs(gap), span) / span * 100));
  const below = gap < 0;
  const color = below ? COLOR.sign : COLOR.rest;
  const half = (side) => `<td width="50%" style="${side === 'left' ? 'border-right:1px solid ' + COLOR.line : ''}">`
    + (side === (below ? 'left' : 'right')
      ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>${below ? `<td width="${100 - width}%" style="font-size:0">&nbsp;</td>` : ''}`
        + `<td width="${width}%" bgcolor="${color}" style="background:${color};height:8px;line-height:8px;font-size:0">&nbsp;</td>${below ? '' : `<td width="${100 - width}%" style="font-size:0">&nbsp;</td>`}</tr></table>`
      : `<span style="font-size:0">&nbsp;</span>`)
    + `</td>`;
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>${half('left')}${half('right')}</tr></table>`
    + `<p style="margin:3px 0 0;font:400 12px/1.2 ${FONT};color:${COLOR.body};text-align:center">${gap === 0 ? 'At market' : signedUsd(gap)}</p>`;
}

function carTable(a) {
  const rows = a.cars.slice().sort((x, y) => STATUS[x.status].order - STATUS[y.status].order || x.rank - y.rank);
  const header = `<tr>${['#', 'Car', 'Asking vs. market', 'Est. /mo'].map((text, index) => `<td${index === 2 ? ' class="hide-m" width="150"' : ''}${index === 3 ? ' align="right" width="62"' : ''}${index === 0 ? ' width="28"' : ''} style="padding:0 0 8px;font:600 12px/1.3 ${FONT};color:${COLOR.soft};border-bottom:1px solid ${COLOR.line}">${text}</td>`).join('')}</tr>`;
  const body = rows.map(car => {
    const dim = car.status === 'dropped';
    const paymentText = dim ? '—' : `${car.dealerPrice ? '' : '~'}${usd(car.payment)}`;
    return `<tr>`
      + `<td valign="top" style="padding:10px 0;font:600 13px/1.4 ${FONT};color:${COLOR.soft};border-bottom:1px solid ${COLOR.grid}">${car.rank}</td>`
      + `<td valign="top" style="padding:10px 8px 10px 0;font:400 13px/1.4 ${FONT};color:${COLOR.body};border-bottom:1px solid ${COLOR.grid}">`
      + `<strong style="font-weight:600;color:${dim ? COLOR.soft : COLOR.navy}">${e(car.short_title || car.title)}</strong>, ${e(car.color.split(' / ')[0])}<br>`
      + `${e(car.dealer_short)} · ${e(car.condition.split(',')[0])} · ${statusText(car)}</td>`
      + `<td class="hide-m" valign="middle" style="padding:10px 12px 10px 0;border-bottom:1px solid ${COLOR.grid}">${gapCell(car.marketGap)}</td>`
      + `<td align="right" valign="top" style="padding:10px 0;font:600 14px/1.4 ${FONT};color:${dim ? COLOR.soft : car.dealerPrice ? COLOR.navy : COLOR.body};border-bottom:1px solid ${COLOR.grid}">${paymentText}</td></tr>`;
  }).join('');
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:14px">${header}${body}</table>`
    + `<p style="margin:10px 0 0;font:400 12px/1.5 ${FONT};color:${COLOR.soft}">A tilde (~) means the payment is estimated from the online listing because the dealer has not priced the car yet.</p>`;
}

function activity(data) {
  const items = (data.activity || []).map(item => `<tr>`
    + `<td width="104" valign="top" style="padding:8px 12px 8px 0;font:600 12px/1.5 ${FONT};color:${COLOR.soft};border-top:1px solid ${COLOR.grid}">${e(whenShort(item.at))}</td>`
    + `<td valign="top" style="padding:8px 0;font:400 14px/1.5 ${FONT};color:${COLOR.body};border-top:1px solid ${COLOR.grid}">${e(item.text)}</td></tr>`).join('');
  return items ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:12px">${items}</table>` : '';
}

function method(data, a) {
  const { new: fresh, used } = data.assumptions;
  const item = text => `<tr><td width="14" valign="top" style="padding:4px 0 0;font-size:10px;color:${COLOR.rest}">&#9679;</td><td style="padding:2px 0 6px;font:400 14px/1.5 ${FONT};color:${COLOR.body}">${text}</td></tr>`;
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:12px">`
    + item(`<strong style="font-weight:600;color:${COLOR.navy}">Estimated payment</strong> is the out-the-door price, minus your ${usd(a.down)} down, financed over ${fresh.months} months.`)
    + item(`New cars and ex-loaners use ${e(fresh.label)} at ${fresh.apr}%, the rate Austin offered. Used and certified cars use ${e(used.label)} at ${used.apr}% until you have a credit-union quote. A better rate lowers every payment here.`)
    + item(`<strong style="font-weight:600;color:${COLOR.navy}">Out the door</strong> means everything you pay: the car, dealer fees, tax, title and registration. Where a dealer has not given us a number, we estimate it from their price (or the online listing) plus ${(data.assumptions.tax_rate * 100).toFixed(2).replace(/\.?0+$/, '')}% tax and about ${usd(data.assumptions.fees_cents)} in fees.`)
    + item('Dealers can change an offer until you sign, so treat these as today\'s numbers. We check every line before you do.')
    + `</table>`;
}

const STYLE = `
@font-face{font-family:Inter;src:url('${FONT_ORIGIN}/inter-latin.woff2') format('woff2');font-weight:400;font-style:normal}
@font-face{font-family:Inter;src:url('${FONT_ORIGIN}/inter-semibold-latin.woff2') format('woff2');font-weight:600;font-style:normal}
@font-face{font-family:'Inter Tight';src:url('${FONT_ORIGIN}/inter-tight-black-latin.woff2') format('woff2');font-weight:900;font-style:normal}
body,table,td{-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%}
a{color:${COLOR.sign}}
@media only screen and (max-width:620px){
  .shell{width:100%!important}
  .pad{padding-left:16px!important;padding-right:16px!important}
  .gutter{padding-left:12px!important;padding-right:12px!important}
  .stack{display:block!important;width:100%!important;padding:0 0 10px!important}
  .hide-m{display:none!important}
  .tile{height:auto!important}
  .h1{font-size:34px!important}
}`;

export function renderDealUpdateEmail(data) {
  const a = analyze(data);
  const name = oneLine(data.buyer_first_name || '');
  const title = oneLine(data.search.title || 'Your car search');
  const best = a.best;
  const subject = oneLine(`${title}: ${a.priced.length} ${a.priced.length === 1 ? 'car' : 'cars'} priced${best ? `, as low as about ${usd(best.payment)}/month` : ''}`).slice(0, 200);
  const preheader = best
    ? `Best estimate so far is ${usd(best.payment)} a month with ${usd(a.down)} down (${best.dealer_short}). ${a.counts.negotiating} cars in negotiation.`
    : `${a.counts.waiting} dealers have not replied yet.`;
  const intro = `${name ? `Hi ${e(name)}, here is` : 'Here is'} where your car search stands. ${e(lede(a, data.search))}`;

  const negotiating = a.cars.filter(car => ['negotiating', 'quoted'].includes(car.status)).sort((x, y) => x.payment - y.payment);

  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8">`
    + `<meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light">`
    + `<meta name="x-apple-disable-message-reformatting"><title>${e(title)}</title><style>${STYLE}</style></head>`
    + `<body style="margin:0;padding:0;background:${COLOR.tint};font-family:${FONT}">`
    + `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:${COLOR.tint};font-size:1px;line-height:1px">${e(preheader)}${'&zwnj;&nbsp;'.repeat(40)}</div>`
    + `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${COLOR.tint}" style="background:${COLOR.tint}"><tr><td align="center" class="gutter" style="padding:0 0 24px">`
    + `<table role="presentation" class="shell" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px">`
    // Top bar
    + `<tr><td><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${COLOR.white}" style="background:${COLOR.white};border-bottom:1px solid ${COLOR.line}"><tr>`
    + `<td class="pad" style="padding:18px 24px;font:600 22px/1 ${FONT};letter-spacing:-1px;color:${COLOR.navy}">steer me right</td>`
    + `<td class="pad" align="right" style="padding:18px 24px;font:400 13px/1 ${FONT};color:${COLOR.body}">Car search update</td></tr></table></td></tr>`
    // Hero
    + `<tr><td bgcolor="${COLOR.sign}" class="pad" style="background:${COLOR.sign};padding:30px 24px 22px">`
    + `<p style="margin:0 0 10px;font:400 14px/1.3 ${FONT};color:${COLOR.sky}">Updated ${e(when(data.updated_at))}</p>`
    + `<h1 class="h1" style="margin:0;font:900 44px/0.96 ${DISPLAY};letter-spacing:-0.4px;text-transform:uppercase;color:${COLOR.white}">${e(title)}</h1>`
    + `<p style="margin:14px 0 18px;font:400 16px/1.5 ${FONT};color:${COLOR.white}">${intro}</p>`
    + kpiRow(a)
    + `</td></tr>`
    + `<tr><td style="padding:12px 0 0;font-size:0;line-height:0">&nbsp;</td></tr>`
    // Cards
    + cardRow(heading('Where every car stands', `${a.cars.length} cars on your list.`) + pipeline(a))
    + cardRow(heading('Estimated monthly payment', `With ${usd(a.down)} down. Lowest first. The dark line is your ${usd(a.goal)} goal.`) + paymentChart(a))
    + (negotiating.length ? `<tr><td style="padding:8px 4px 10px">${heading('Cars with a dealer price')}</td></tr>` + negotiating.map(car => carCard(car, a)).join('') : '')
    + cardRow(heading('All cars on your list', 'The bar shows the asking price against market value. Blue is below market.') + carTable(a))
    + cardRow(heading('What happened lately', 'Times are Central.') + activity(data))
    + cardRow(heading('How we work these numbers') + method(data, a))
    // Footer
    + `<tr><td class="pad" style="padding:8px 24px 0;font:400 13px/1.6 ${FONT};color:${COLOR.body}">Questions about a car, or ready to move on one? Reply to this email and Mason will get back to you.<br>`
    + `<span style="color:${COLOR.soft}">Steer Me Right</span></td></tr>`
    + `</table></td></tr></table></body></html>`;

  const lines = [
    `${title.toUpperCase()}`, `Updated ${when(data.updated_at)}`, '',
    `${name ? `Hi ${name}, here is` : 'Here is'} where your car search stands. ${lede(a, data.search)}`, '',
    best ? `Lowest estimated payment: ${usd(best.payment)}/mo (${best.dealer_short}). Goal: ${usd(a.goal)}/mo with ${usd(a.down)} down.` : '',
    a.lowestQuote ? `Lowest out-the-door quote: ${usd(a.lowestQuote.otdAfterCredits)} (${a.lowestQuote.dealer_short}).` : '',
    `Cars with a dealer price: ${a.priced.length} of ${a.cars.length}. ${a.counts.negotiating} negotiating, ${a.counts.quoted} priced by the dealer, ${a.counts.waiting} waiting on a reply, ${a.counts.dropped} dropped.`, '',
    'CARS WITH A DEALER PRICE',
    ...negotiating.flatMap(car => [
      `#${car.rank} ${car.title}, ${car.color}, ${miles(car.mileage)} (${car.dealer}, ${car.location})`,
      `  Estimated payment ${usd(car.payment)}/mo. Out the door ${car.hasQuote ? '' : '(estimated) '}${usd(car.otdAfterCredits)}. Asking ${usd(car.asking_cents)}, market ${usd(car.market_cents)}.`,
      ...(car.notes || []).map(note => `  - ${note}`), ''
    ]),
    'ALL CARS',
    ...a.cars.slice().sort((x, y) => STATUS[x.status].order - STATUS[y.status].order || x.rank - y.rank).map(car => `#${car.rank} ${car.dealer_short}, ${car.short_title || car.title}: ${car.status === 'dropped' ? 'dropped' : `${car.dealerPrice ? '' : '~'}${usd(car.payment)}/mo (${STATUS[car.status].label.toLowerCase()})`}`),
    '', 'WHAT HAPPENED LATELY', ...(data.activity || []).map(item => `${day(item.at)}: ${item.text}`), '',
    `Payments are estimates: out-the-door price minus ${usd(a.down)} down, financed over ${data.assumptions.new.months} months at ${data.assumptions.new.apr}% (new) or ${data.assumptions.used.apr}% (used). Dealers can change an offer until you sign.`, '',
    'Questions about a car? Reply to this email and Mason will get back to you.', 'Steer Me Right', ''
  ].filter((line, index, all) => line !== '' || all[index - 1] !== '').join('\n');

  return { subject, html, text: lines };
}

// node scripts/deal-update-email.mjs <data.json> [--out <folder>]
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [input] = process.argv.slice(2).filter(arg => !arg.startsWith('--'));
  const outIndex = process.argv.indexOf('--out');
  if (!input) {
    console.error('Usage: node scripts/deal-update-email.mjs <data.json> [--out <folder>]');
    process.exit(1);
  }
  const data = JSON.parse(await readFile(input, 'utf8'));
  const { subject, html, text } = renderDealUpdateEmail(data);
  const folder = resolve(outIndex > 0 ? process.argv[outIndex + 1] : dirname(resolve(input)));
  const stem = basename(input, '.json');
  await writeFile(resolve(folder, `${stem}-email.html`), html);
  await writeFile(resolve(folder, `${stem}-email.txt`), text);
  console.log(`Subject: ${subject}\nWrote ${resolve(folder, `${stem}-email.html`)} and .txt`);
}
