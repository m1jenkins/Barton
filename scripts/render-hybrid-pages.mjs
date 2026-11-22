// Builds the "is the <car> hybrid worth it?" pages (<make>-<model>-hybrid-vs-gas.html), one per file in data/hybrid-pages/.
// A car file holds every sentence and EPA/price input for its page; data/hybrid-pages/_shared.json holds the gas prices and the
// sources every page uses. Prices come from the car's price guide (data/vehicle-pages.json) by trim name, so a price change there
// reaches these pages on the next build. Run `npm run build:hybrids` after changing a data file, this script, buying/hybrid-pages.css
// or car-negotiation-service.html's head/header/footer; `npm run check:hybrids` fails when the files drift.
// `node scripts/render-hybrid-pages.mjs --wire` adds any missing sitemap, blog, llms.txt, content-inventory, query-map and
// source-registry rows for the cars in the folder (idempotent).
import { createHash } from 'node:crypto';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { shell } from './render-market-pages.mjs';
import { summarizeCar, topics as sentimentTopics } from './reddit-sentiment.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const origin = 'https://www.steermeright.com';
const chromePage = 'car-negotiation-service.html';
const stylesheets = ['buying/price-guide.css', 'buying/hybrid-pages.css'];
const dataDir = 'data/hybrid-pages';
const read = file => readFile(path.join(root, file), 'utf8');
const longDate = iso => new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
const monthYear = iso => new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const dollars = value => `$${Math.round(value).toLocaleString('en-US')}`;
const years = value => `${(Math.round(value * 10) / 10).toFixed(1)}`;
const paragraphs = list => (list ?? []).map(text => `<p>${text}</p>`).join('\n');
const faq = entries => `<div class="vp-faq">\n${entries.map(([question, answer]) => `<details><summary>${question}</summary><p>${answer}</p></details>`).join('\n')}\n</div>`;
export const carFiles = async () => (await readdir(path.join(root, dataDir))).filter(file => file.endsWith('.json') && !file.startsWith('_')).sort();
export const sentimentFile = car => `data/reddit-sentiment/cars/${car.key}.json`;

// ---- Numbers: every figure on a page that is arithmetic comes from here, never from the data's prose ----
// Annual fuel cost = miles / EPA combined mpg x price. Break-even = hybrid premium / (gas cost - hybrid cost).
export const annualCost = (miles, mpg, price) => (miles / mpg) * price;
export function conditions(shared) {
  const list = [];
  for (const [priceKey, price] of [['epa', shared.gasPrices.epa.regular], ['eia', shared.gasPrices.eia.regular]]) {
    for (const miles of shared.miles) list.push({ priceKey, price, miles, label: `${miles.toLocaleString('en-US')} miles at ${priceKey === 'epa' ? shared.gasPrices.epa.label : shared.gasPrices.eia.label}` });
  }
  return list;
}
// A trim's price: explicit, or the guide's 2026 starting MSRP for `guideTrim` plus an optional step (4x4, AWD).
export function trimPrice(side, vehicle) {
  if (typeof side.price === 'number') return side.price;
  const trim = vehicle.trims.rows.find(row => row.name === (side.guideTrim ?? side.trim));
  if (!trim || typeof trim.prices[0] !== 'number') throw new Error(`${vehicle.slug}: no priced trim "${side.guideTrim ?? side.trim}"`);
  return trim.prices[0] + (side.plus ?? 0);
}
export function scenarioNumbers(scenario, vehicle, shared) {
  const gasPrice = trimPrice(scenario.gas, vehicle);
  const hybridPrice = scenario.premium ? null : trimPrice(scenario.hybrid, vehicle);
  const premium = scenario.premium ? scenario.premium.amount : hybridPrice - gasPrice;
  const rows = scenario.epa.map(row => ({
    ...row,
    cells: conditions(shared).map(condition => {
      const gas = annualCost(condition.miles, row.gas.comb, condition.price), hybrid = annualCost(condition.miles, row.hybrid.comb, condition.price);
      return { ...condition, gas, hybrid, saved: gas - hybrid, breakEven: premium / (gas - hybrid) };
    }),
  }));
  return { gasPrice, hybridPrice, premium, atMost: Boolean(scenario.premium?.atMost), rows };
}
// Plug-in: best case is a full charge used every day, so the savings are the most a buyer could expect.
export function pluginNumbers(plugin, vehicle, shared) {
  const price = trimPrice(plugin, vehicle), compare = trimPrice(plugin.compare, vehicle), premium = price - compare;
  const electricPerMile = (plugin.epa.kwhPer100 / 100) * shared.gasPrices.epa.electricity;
  const hybridPerMile = shared.gasPrices.eia.regular / plugin.compare.epa.comb;
  const miles = plugin.epa.rangeMiles * 365;
  const saved = miles * (hybridPerMile - electricPerMile);
  const charge = plugin.epa.rangeMiles * electricPerMile, sameMilesHybrid = plugin.epa.rangeMiles * hybridPerMile;
  return { price, compare, premium, electricPerMile, hybridPerMile, miles, saved, breakEven: premium / saved, charge, sameMilesHybrid };
}

// ---- Page pieces (the markup and classes are the price guides') ----
const percent = (value, max) => `${Math.round((value / max) * 1000) / 10}%`;
const meter = (value, max) => `<span class="vp-meter" aria-hidden="true"><span style="--w:${percent(value, max)}"></span></span>`;
const bars = (rows, max) => `<ul class="vp-bars" role="list">
${rows.map(row => `<li><span class="vp-bars__label">${row.label}</span>${meter(row.value, max)}<span class="vp-bars__value">${row.display}</span></li>`).join('\n')}
</ul>`;
const credit = (label, image) => `<li>${label}: <a href="${image.sourceUrl}" rel="noopener">${image.author}</a>, ${image.licenseUrl ? `<a href="${image.licenseUrl}" rel="noopener">${image.license}</a>` : image.license}${image.note ? `, ${image.note}` : ''}</li>`;
const picture = (image, widths, sizes) => `<picture>${['avif', 'webp'].map(type => `<source type="image/${type}" srcset="${widths.map(width => `/assets/external/optimized/${image.file}-${width}.${type} ${width}w`).join(', ')}" sizes="${sizes}">`).join('')}<img src="/assets/external/source/${image.file}-original.jpg" alt="${image.alt}" width="${image.width}" height="${image.height}" decoding="async" fetchpriority="high"></picture>`;
// The homepage's two plan cards (index.html, #plans), word for word, as on the price guides (render-vehicle-pages.mjs, planCards).
const planCards = [
  { name: 'Steer Me Right', fit: 'Best if you know the car you want.', price: '$395', photo: 'plan-steering-wheel-toyota-192.webp', href: '/schedule.html#full-service',
    items: ['One model, with any trims, colors and packages', 'We contact dozens of dealers that have it in stock', 'We negotiate the price and fees'] },
  { name: 'Steer Me Right Pro', fit: 'Best if you’re torn between a few cars.', price: '$695', photo: 'plan-steering-wheel-porsche-192.webp', href: '/schedule.html#concierge', pro: true,
    items: ['We present offers on up to three models', 'We handle the paperwork remotely where we can, so you just pick up your car', 'Shipping help in some cases'] },
];
const tick = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
const planCard = (card, location) => `<article class="vp-plan${card.pro ? ' vp-plan--pro' : ''}">
<span class="vp-plan__photo"><img src="/assets/external/optimized/${card.photo}" alt="" width="64" height="64" loading="lazy" decoding="async"></span>
<h3>${card.name}</h3>
<p class="vp-plan__fit">${card.fit}</p>
<p class="vp-plan__price">${card.price} <span>one-time</span></p>
<ul role="list">
${card.items.map(item => `<li>${tick}${item}</li>`).join('\n')}
</ul>
<a class="vp-plan__button" href="${card.href}" data-cta-location="${location}">Get ${card.name}</a>
</article>`;

// Sources: the car's own, then the shared ones, numbered on after them. Ids read VEH-HYB-<CODE>-NN.
export function allSources(car, shared) {
  const own = car.sources.map(source => ({ ...source }));
  const extra = shared.sharedSources.map((source, index) => ({ ...source, id: `VEH-HYB-${car.code}-${String(own.length + index + 1).padStart(2, '0')}`, status: 'primary_source_checked' }));
  return [...own, ...extra];
}

function hybridPage(car, vehicle, shared, comparisons, coded, updated) {
  const checked = longDate(car.checkedOn);
  const name = vehicle.name, short = car.short;
  const guide = `/${car.priceGuide}`;
  const conds = conditions(shared);
  const sources = allSources(car, shared);
  const numbers = car.scenarios.map(scenario => ({ scenario, ...scenarioNumbers(scenario, vehicle, shared) }));
  const first = numbers[0], firstRow = first.rows[0];
  const eiaFifteen = firstRow.cells.find(cell => cell.priceKey === 'eia' && cell.miles === 15000);
  const eiaTwelve = firstRow.cells.find(cell => cell.priceKey === 'eia' && cell.miles === 12000);
  const plug = car.plugin ? pluginNumbers(car.plugin, vehicle, shared) : null;
  const related = comparisons.filter(cmp => cmp.cars.some(entry => entry.slug === car.priceGuide));
  const upTo = number => number.atMost ? 'up to ' : '';
  const money = (number, value) => `${upTo(number)}${typeof value === 'number' ? dollars(value) : value}`;

  const tabs = [['overview', 'Verdict'], ['premium', 'Price premium'], ['mpg', 'Fuel economy'], ['cost', 'Fuel cost'], ['breakeven', 'Break-even'], ['changes', 'What else changes'], ...(plug ? [['plugin', 'Plug-in']] : []), ['incentives', 'Incentives'], ['resale', 'Resale'], ['reddit', 'Reddit'], ['faq', 'Questions']];

  // Price premium table: each scenario, then any extra like-for-like pairs.
  const pairRows = [...numbers.map(entry => ({ label: entry.scenario.label, gas: entry.scenario.gas, hybrid: entry.scenario.hybrid, gasPrice: entry.gasPrice, hybridPrice: entry.hybridPrice, premium: entry.premium, atMost: entry.atMost, note: entry.scenario.premium?.note ?? entry.scenario.note })),
    ...(car.extraPremiums ?? []).map(extra => { const gasPrice = trimPrice(extra.gas, vehicle), hybridPrice = trimPrice(extra.hybrid, vehicle); return { label: extra.label, gas: extra.gas, hybrid: extra.hybrid, gasPrice, hybridPrice, premium: hybridPrice - gasPrice, note: extra.note }; })];
  const trimCell = (side, price) => `<strong>${typeof price === 'number' ? dollars(price) : price}</strong><small>${side.trim}${side.version ? `, ${side.version}` : ''}</small>`;
  const premiumTable = `<div class="vp-scroll hp-scroll" role="region" aria-labelledby="premium-caption" tabindex="0">
<table class="hp-numbers">
<caption id="premium-caption" class="sr-only">${name} hybrid price premium over the gas version on like-for-like trims, checked ${checked}</caption>
<thead><tr><th scope="col">Like-for-like pair</th><th scope="col">${car.gasLabel}</th><th scope="col">${car.hybridLabel}</th><th scope="col">Hybrid premium</th></tr></thead>
<tbody>
${pairRows.map(row => `<tr><th scope="row">${row.label}${row.note ? `<small>${row.note}</small>` : ''}</th><td>${row.gas.trim ? trimCell(row.gas, row.gasPrice) : '<strong>Starting MSRP</strong>'}</td><td>${row.hybridPrice === null ? `<small>${row.hybrid.trim}${row.hybrid.version ? `, ${row.hybrid.version}` : ''}</small>` : trimCell(row.hybrid, row.hybridPrice)}</td><td><strong>${money(row, row.premium)}</strong></td></tr>`).join('\n')}
</tbody>
</table>
</div>`;

  // EPA table: one row per unique gas/hybrid record pair.
  const epaSeen = new Set();
  const epaRows = [];
  for (const entry of numbers) for (const row of entry.rows) { const key = `${row.gas.id}-${row.hybrid.id}`; if (!epaSeen.has(key)) { epaSeen.add(key); epaRows.push({ ...row, scenario: entry.scenario }); } }
  const mpgCell = side => `<strong>${side.comb}</strong> combined<small>${side.city} city / ${side.hwy} highway</small>`;
  const mpgTable = `<div class="vp-scroll hp-scroll" role="region" aria-labelledby="mpg-caption" tabindex="0">
<table class="hp-numbers">
<caption id="mpg-caption" class="sr-only">EPA fuel economy ratings, ${name} gas and hybrid, 2026 model year, read ${checked}</caption>
<thead><tr><th scope="col">Version</th><th scope="col">${car.gasLabel}</th><th scope="col">${car.hybridLabel}</th><th scope="col">Hybrid gain</th><th scope="col">EPA vehicle ids</th></tr></thead>
<tbody>
${epaRows.map(row => `<tr><th scope="row">${row.label}</th><td>${mpgCell(row.gas)}</td><td>${mpgCell(row.hybrid)}</td><td><strong>+${row.hybrid.comb - row.gas.comb} mpg</strong><small>${Math.round(((row.hybrid.comb - row.gas.comb) / row.gas.comb) * 100)}% better combined</small></td><td class="hp-numbers__id">${row.gas.id} (gas)<br>${row.hybrid.id} (hybrid)</td></tr>`).join('\n')}
</tbody>
</table>
</div>`;

  // Annual fuel cost table: gas, hybrid and the difference for each unique record pair, in the four conditions.
  const costSeen = new Set();
  const costBlocks = [];
  for (const entry of numbers) for (const row of entry.rows) { const key = `${row.gas.id}-${row.hybrid.id}`; if (!costSeen.has(key)) { costSeen.add(key); costBlocks.push(row); } }
  const costTable = `<div class="vp-scroll hp-scroll" role="region" aria-labelledby="cost-caption" tabindex="0">
<table class="hp-numbers">
<caption id="cost-caption" class="sr-only">Annual gasoline cost, ${name} gas and hybrid, at EPA's gas price and at the national average, for 12,000 and 15,000 miles a year</caption>
<thead><tr><th scope="col">Version</th>${conds.map(cond => `<th scope="col">${cond.label}</th>`).join('')}</tr></thead>
<tbody>
${costBlocks.map(row => `<tr><th scope="row">${car.gasLabel}<small>${row.label}, ${row.gas.comb} mpg combined</small></th>${row.cells.map(cell => `<td>${dollars(cell.gas)}</td>`).join('')}</tr>
<tr><th scope="row">${car.hybridLabel}<small>${row.label}, ${row.hybrid.comb} mpg combined</small></th>${row.cells.map(cell => `<td>${dollars(cell.hybrid)}</td>`).join('')}</tr>
<tr class="hp-numbers__gain"><th scope="row">Hybrid costs less by</th>${row.cells.map(cell => `<td><strong>${dollars(cell.saved)}</strong> a year</td>`).join('')}</tr>`).join('\n')}
</tbody>
</table>
</div>`;

  // Break-even table and chart.
  const beRows = [];
  for (const entry of numbers) for (const row of entry.rows) beRows.push({ label: `${entry.scenario.label}${entry.rows.length > 1 ? `, ${row.label.toLowerCase()}` : ''}`, premium: entry.premium, atMost: entry.atMost, cells: row.cells });
  const beTable = `<div class="vp-scroll hp-scroll" role="region" aria-labelledby="be-caption" tabindex="0">
<table class="hp-numbers">
<caption id="be-caption" class="sr-only">Years of fuel savings needed to earn back the hybrid premium, ${name}, checked ${checked}</caption>
<thead><tr><th scope="col">Pair</th><th scope="col">Hybrid premium</th>${conds.map(cond => `<th scope="col">${cond.label}</th>`).join('')}</tr></thead>
<tbody>
${beRows.map(row => `<tr><th scope="row">${row.label}</th><td><strong>${money(row, row.premium)}</strong></td>${row.cells.map(cell => `<td><strong>${row.atMost ? 'up to ' : ''}${years(cell.breakEven)}</strong> years</td>`).join('')}</tr>`).join('\n')}
</tbody>
</table>
</div>`;
  const chartMax = Math.max(...numbers.flatMap(entry => entry.rows[0].cells.map(cell => cell.breakEven)));
  const chart = `<div class="vp-charts hp-charts hp-charts--${numbers.length === 1 ? 1 : 2}">
${numbers.map(entry => `<section><h3>${entry.scenario.label}</h3>
${bars(entry.rows[0].cells.map(cell => ({ label: cell.label, value: cell.breakEven, display: `${entry.atMost ? 'up to ' : ''}${years(cell.breakEven)} years` })), chartMax)}
<p class="vp-charts__source">Years of fuel savings to earn back ${entry.atMost ? 'at most ' : ''}${dollars(entry.premium)} (${entry.rows[0].label}). Bars share one scale.</p></section>`).join('\n')}
</div>`;

  // What else changes.
  const changesTable = `<div class="vp-scroll hp-scroll" role="region" aria-labelledby="changes-caption" tabindex="0">
<table class="hp-numbers">
<caption id="changes-caption" class="sr-only">What else changes between the ${name} gas and hybrid, checked ${checked}</caption>
<thead><tr><th scope="col">&nbsp;</th><th scope="col">${car.gasLabel}</th><th scope="col">${car.hybridLabel}</th></tr></thead>
<tbody>
${car.changes.map(row => `<tr><th scope="row">${row.label}</th><td>${row.gas}</td><td>${row.hybrid}</td></tr>`).join('\n')}
</tbody>
</table>
</div>`;

  // Plug-in block (optional).
  const pluginSection = plug ? `<section id="plugin" class="vp-section">
<h2>${car.plugin.heading}</h2>
${paragraphs(car.plugin.intro)}
<div class="vp-scroll hp-scroll" role="region" aria-labelledby="plugin-caption" tabindex="0">
<table class="hp-numbers">
<caption id="plugin-caption" class="sr-only">${name} plug-in hybrid against the regular hybrid, best case for electric driving, checked ${checked}</caption>
<thead><tr><th scope="col">&nbsp;</th><th scope="col">${car.plugin.compare.label ?? car.plugin.compare.trim}</th><th scope="col">${car.plugin.label ?? car.plugin.trim}</th></tr></thead>
<tbody>
<tr><th scope="row">Starting MSRP</th><td><strong>${dollars(plug.compare)}</strong></td><td><strong>${dollars(plug.price)}</strong></td></tr>
<tr><th scope="row">Premium</th><td>&nbsp;</td><td><strong>${dollars(plug.premium)}</strong></td></tr>
<tr><th scope="row">EPA rating<small>Vehicle ids ${car.plugin.compare.epa.id} and ${car.plugin.epa.id}</small></th><td><strong>${car.plugin.compare.epa.comb}</strong> mpg combined</td><td><strong>${car.plugin.epa.mpge}</strong> MPGe on electricity, <strong>${car.plugin.epa.gasComb}</strong> mpg once the battery is empty<small>${car.plugin.epa.rangeMiles} miles of electric range, ${car.plugin.epa.kwhPer100} kWh per 100 miles</small></td></tr>
<tr><th scope="row">Cost of ${car.plugin.epa.rangeMiles} miles<small>Gas at ${shared.gasPrices.eia.label}, electricity at ${Math.round(shared.gasPrices.epa.electricity * 100)} cents a kilowatt-hour</small></th><td>$${plug.sameMilesHybrid.toFixed(2)}</td><td>$${plug.charge.toFixed(2)}</td></tr>
<tr><th scope="row">Best case, a full charge every day<small>${plug.miles.toLocaleString('en-US')} electric miles a year</small></th><td>&nbsp;</td><td><strong>${dollars(plug.saved)}</strong> a year less, <strong>${years(plug.breakEven)}</strong> years to earn back ${dollars(plug.premium)}</td></tr>
</tbody>
</table>
</div>
${paragraphs(car.plugin.after)}
</section>

` : '';

  const redditSummary = summarizeCar(coded);
  const mpgTopic = redditSummary.topics.mpg;
  const mixed = mpgTopic.mentions - mpgTopic.pos - mpgTopic.neg;
  const notes = coded.themes?.mpg ?? { pos: [], neg: [] };
  const redditSection = `<section id="reddit" class="vp-section">
<h2>What owners on Reddit report about real-world mpg</h2>
<p>${car.reddit.lead} We counted ${mpgTopic.mentions.toLocaleString('en-US')} opinions about the ${short}’s fuel economy in ${redditSummary.threads.toLocaleString('en-US')} Reddit threads about the car, posted from ${monthYear(coded.threadsFrom)} to ${monthYear(coded.threadsTo)}: ${mpgTopic.pos.toLocaleString('en-US')} positive, ${mpgTopic.neg.toLocaleString('en-US')} negative${mixed ? ` and ${mixed.toLocaleString('en-US')} mixed` : ''}. That is a net score of ${mpgTopic.net > 0 ? '+' : mpgTopic.net < 0 ? '−' : ''}${Math.abs(mpgTopic.net)} on the same −100 to +100 scale as the ${short} price guide, and it covers every version of the car, not only the hybrid.</p>
${notes.pos.length || notes.neg.length ? `<div class="hp-reddit">
<section><h3>What owners praise</h3><ul role="list">${notes.pos.map(note => `<li>${note}</li>`).join('')}</ul></section>
<section><h3>What owners complain about</h3><ul role="list">${notes.neg.map(note => `<li>${note}</li>`).join('')}</ul></section>
</div>` : ''}
${car.reddit.after ? `<p>${car.reddit.after}</p>` : ''}
<p class="vp-note">Our own reading of public Reddit comments from the Arctic Shift archive, collected ${longDate(coded.collected)}: coded by AI to a fixed rubric and checked by a second coder on a sample. Complaints are what owners report, not confirmed defects. Method and the full Reddit section are on the <a href="${guide}#reddit">${short} price guide</a>.</p>
</section>`;

  const verdictStrip = [
    { label: 'Hybrid premium', value: `${money(first, first.premium)}<small>${first.scenario.label}</small>`, section: 'premium' },
    { label: 'Break-even', value: `${first.atMost ? 'up to ' : ''}${years(eiaFifteen.breakEven)}<small> years at 15,000 miles a year, ${shared.gasPrices.eia.label} gas</small>`, section: 'breakeven' },
    { label: 'EPA combined', value: `${firstRow.hybrid.comb} <small>mpg hybrid against ${firstRow.gas.comb} gas</small>`, section: 'mpg' },
    { label: 'Verdict', value: `${car.verdict.answer}<small>${car.verdict.detail}</small>`, section: 'overview' },
  ];
  const relatedLinks = [`<a href="${guide}">${name} price guide</a>`, ...related.map(cmp => `<a href="/${cmp.slug}">${cmp.crumb}</a>`)];

  const body = `<article class="vp hp">
<header class="vp-head vp-width">
<p class="vp-crumb"><a href="/blog.html">Resources</a> / ${name} hybrid vs gas</p>
<h1>${car.h1}</h1>
<p class="vp-byline">By <a href="/about.html">Mason</a> · Updated <time datetime="${updated}">${longDate(updated)}</time></p>
</header>
<nav class="vp-tabs" aria-label="Article contents"><ul class="vp-width" role="list">${tabs.map(([id, label]) => `<li><a href="#${id}">${label}</a></li>`).join('')}</ul></nav>

<div class="vp-stage">
<div class="vp-layout vp-width">
<div class="vp-hero">
<div class="vp-gallery hp-solo"><figure class="vp-gallery__main">${picture(vehicle.photo, [640, 960, 1600], '(max-width: 1000px) 94vw, 680px')}<figcaption>${vehicle.photo.caption}</figcaption></figure></div>
<ul class="vp-strip hp-strip" role="list">
${verdictStrip.map(item => `<li><a href="#${item.section}"><span class="vp-strip__source">${item.label}</span><span class="vp-strip__score">${item.value}</span></a></li>`).join('\n')}
</ul>
</div>

<aside class="vp-rail">
<ul class="vp-glance" role="list" aria-label="${name} hybrid against gas at a glance">
${[
    ['premium', 'Hybrid premium', money(first, first.premium)],
    ['mpg', 'EPA combined, hybrid against gas', `${firstRow.hybrid.comb} <small>against ${firstRow.gas.comb} mpg</small>`],
    ['cost', `Hybrid costs less a year, 15,000 miles at ${shared.gasPrices.eia.label}`, `${first.atMost ? 'up to ' : ''}${dollars(eiaFifteen.saved)}`],
    ['breakeven', 'Years to earn back the premium', `${first.atMost ? 'up to ' : ''}${years(eiaFifteen.breakEven)}`],
  ].map(([section, label, value]) => `<li><a href="#${section}"><span class="vp-glance__label">${label}</span><span class="vp-glance__figure">${value}</span></a></li>`).join('\n')}
</ul>
<a class="vp-button" href="#plans">See the plans</a>
<p class="vp-rail__fine">Dealers and lenders pay us nothing.</p>
</aside>

<div class="vp-body">
<section id="overview" class="vp-section vp-section--first">
<p class="vp-lead">${car.verdict.lead}</p>
${paragraphs(car.verdict.more)}
<div class="vp-verdict hp-choose">
<section class="vp-verdict__pros"><h2>Buy the hybrid if…</h2><ul role="list">${car.chooseHybrid.map(item => `<li>${item}</li>`).join('')}</ul></section>
<section class="vp-verdict__cons"><h2>Buy the gas version if…</h2><ul role="list">${car.chooseGas.map(item => `<li>${item}</li>`).join('')}</ul></section>
</div>
<p class="hp-related">More on this car: ${relatedLinks.join(', ')}.</p>
</section>

<section id="premium" class="vp-section vp-section--band">
<h2>What the hybrid costs on like-for-like trims</h2>
${paragraphs(car.premiumIntro)}
${premiumTable}
<p class="hp-table-note">${car.premiumNote} Starting MSRP for the ${car.modelYear} model year without destination, from the <a href="${guide}">${short} price guide</a> unless a row says otherwise.</p>
</section>

<section id="mpg" class="vp-section">
<h2>EPA fuel economy, gas against hybrid</h2>
${paragraphs(car.mpgIntro)}
${mpgTable}
<p class="hp-table-note">${car.mpgNote ? `${car.mpgNote} ` : ''}Ratings are EPA’s ${car.modelYear} records on fueleconomy.gov, read ${checked}.</p>
</section>

<section id="cost" class="vp-section vp-section--band">
<h2>What a year of gas costs</h2>
${paragraphs(car.costIntro)}
${costTable}
<p class="hp-table-note">Gallons are miles divided by EPA’s combined rating. EPA prices regular gasoline at ${shared.gasPrices.epa.label} a gallon; the U.S. average was ${shared.gasPrices.eia.label} for the week of ${longDate(shared.gasPrices.eia.week)}, from the Energy Information Administration. EPA’s own label figure assumes 15,000 miles a year.</p>
</section>

<section id="breakeven" class="vp-section">
<h2>How many years until the hybrid pays for itself?</h2>
${paragraphs(car.breakEvenIntro)}
${beTable}
${chart}
${paragraphs(car.breakEvenAfter)}
</section>

<section id="changes" class="vp-section vp-section--band">
<h2>What else changes</h2>
${paragraphs(car.changesIntro)}
${changesTable}
${paragraphs(car.changesAfter)}
</section>

${pluginSection}<aside class="vp-cta" aria-label="Steer Me Right plans"><div><p><strong>Don’t overpay, or lose weeks calling dealers.</strong>We contact dozens of dealers, negotiate the price and fees, and bring you the offers.</p><p class="vp-cta__fine">From $395. Full refund if you cancel before negotiations begin.</p></div><a class="vp-cta__button" href="#plans">Let us do the work</a></aside>

<section id="incentives" class="vp-section">
<h2>Do this month’s incentives favor one version?</h2>
${paragraphs(car.incentives)}
</section>

<section id="resale" class="vp-section vp-section--band">
<h2>Resale: does the hybrid hold its value?</h2>
${paragraphs(car.resale)}
</section>

${redditSection}

<section id="plans" class="vp-section vp-plans">
<h2>Pick how much help you want</h2>
<div class="vp-plans__grid">
${planCards.map(card => planCard(card, `hybrid-${car.key}`)).join('\n')}
</div>
<p class="vp-note">You can upgrade to Steer Me Right Pro later by paying the $300 difference. The fee doesn’t cover the car, taxes or registration. <a href="/policy.html#refund-policy">Refund policy</a></p>
</section>

<section id="faq" class="vp-section vp-section--band">
<h2>Common questions</h2>
${faq([
    ...car.faq,
    [`Can you negotiate a ${name} for me?`, `Yes. Steer Me Right charges a flat $395 for one model or $695 for up to three. We find it in dealer stock, get written out-the-door offers and negotiate for a price below MSRP. We can’t promise a specific discount: the market for a given car sets what a dealer will do.`],
    ['Do dealers pay you?', 'No. Dealers and lenders pay us nothing. You pay the flat fee, and you’re the only one we work for.'],
  ])}
</section>

<section class="vp-sources" aria-labelledby="guide-sources"><h2 id="guide-sources">Sources and updates</h2><p>Written by <a href="/about.html">Mason</a>, Steer Me Right’s founder and lead advisor. Prices, ratings and gas prices were checked on ${checked} and change often, so confirm prices with the dealer before you sign. The annual fuel costs and break-even years are our estimates from the ratings and prices below, not a promise. If something is out of date or wrong, email <a href="mailto:hello@steermeright.com">hello@steermeright.com</a> and we will correct it.</p>
<details class="vp-more"><summary>All ${sources.length} sources</summary>
<ul>
${sources.map(source => `<li><a href="${source.url}" rel="noopener">${source.title}</a>${source.note ? `: ${source.note}` : ''}</li>`).join('\n')}
</ul>
</details>
<p>Related: ${relatedLinks.join(', ')}, <a href="/new-car-buying-service.html">new car buying service</a> and <a href="/car-negotiation-service.html">car negotiation service</a>.</p>
<details class="vp-credits"><summary>Photo credits</summary>
<ul>${credit('Main photo', vehicle.photo)}</ul>
</details></section>
</div>
</div>
</div>
</article>`;
  return { slug: car.slug, title: car.title, description: car.description, h1: car.h1, crumbs: [['Resources', `${origin}/blog.html`], [`${name} hybrid vs gas`, `${origin}/${car.slug}`]], body };
}

const sheetLink = (file, css) => `<link rel="stylesheet" href="/${file}?v=${createHash('sha256').update(css).digest('hex').slice(0, 12)}">`;

export async function loadCars() {
  const shared = JSON.parse(await read(`${dataDir}/_shared.json`));
  const vehicles = JSON.parse(await read('data/vehicle-pages.json'));
  const comparisons = JSON.parse(await read('data/comparison-pages.json')).comparisons;
  const cars = [];
  for (const file of await carFiles()) {
    const car = JSON.parse(await read(`${dataDir}/${file}`));
    if (file !== `${car.key}.json`) throw new Error(`${file}: file name must be the car key (${car.key}.json)`);
    const vehicle = vehicles.vehicles.find(entry => entry.slug === car.priceGuide);
    if (!vehicle) throw new Error(`${file}: no price guide ${car.priceGuide}`);
    const codedFile = path.join(root, sentimentFile(car));
    if (!existsSync(codedFile)) throw new Error(`${file}: no Reddit file ${sentimentFile(car)}`);
    cars.push({ car, vehicle, coded: JSON.parse(readFileSync(codedFile, 'utf8')) });
  }
  return { shared, cars, comparisons, vehicles: vehicles.vehicles };
}

export async function renderHybridPages() {
  const [chrome, { shared, cars, comparisons }, ...css] = await Promise.all([read(chromePage), loadCars(), ...stylesheets.map(file => readFile(path.join(root, file)))]);
  const links = stylesheets.map((file, index) => sheetLink(file, css[index])).join('\n    ');
  return cars.map(({ car, vehicle, coded }) => {
    const updated = car.checkedOn > shared.updated ? car.checkedOn : shared.updated;
    const page = hybridPage(car, vehicle, shared, comparisons, coded, updated);
    const html = shell(chrome, { ...page, published: car.published, updated }, page.body);
    return { slug: page.slug, html: html.replace('</head>', `    ${links}\n</head>`) };
  });
}

// ---- Wiring: source-registry, sitemap, blog, llms.txt, content inventory and query map (idempotent) ----
const csvCell = value => /[",\n]/.test(value) ? `"${String(value).replaceAll('"', '""')}"` : String(value);
export function registryRows(car, shared) {
  return allSources(car, shared).map(source => [
    source.id, `${origin}/${car.slug}`, source.scope, source.authority, 'United States', source.url, source.title,
    `retrieved ${car.checkedOn}`, '', source.status ?? 'secondary_research_checked', '2026-12-21',
    source.registryNote ?? `Read on ${car.checkedOn} in the page-building session; figures not independently verified. Recheck with the monthly refresh.`,
  ]);
}
async function appendMissing(file, entries, key) {
  const text = await read(file);
  const missing = entries.filter(entry => !key(text, entry));
  if (!missing.length) return 0;
  const body = text.endsWith('\n') ? text : `${text}\n`;
  await writeFile(path.join(root, file), body + missing.map(entry => entry.line).join('\n') + '\n');
  return missing.length;
}
export async function wire() {
  const { shared, cars } = await loadCars();
  let changed = 0;
  // source registry
  changed += await appendMissing('data/source-registry.csv', cars.flatMap(({ car }) => registryRows(car, shared).map(row => ({ id: row[0], line: row.map(csvCell).join(',') }))), (text, entry) => text.includes(`\n${entry.id},`));
  // content inventory
  changed += await appendMissing('data/content-inventory.csv', cars.map(({ car }) => ({ url: `${origin}/${car.slug}`, line: [`${origin}/${car.slug}`, car.slug, 'vehicle_hybrid_vs_gas', `${car.key.replaceAll('-', '_')}_hybrid_vs_gas`, 'vehicle_prices', 'indexable_owner_publication', 'third_party_sources_registered_VEH_rows', 'assisted_full_service', 'Session user via direct instruction (2026-11-21)', car.published, '', `Generated from data/hybrid-pages/${car.key}.json by npm run build:hybrids; do not edit by hand. Built on ${car.published} as the ${car.vehicle?.name ?? car.name} hybrid-versus-gas page. Fuel costs and break-even years use EPA ratings and the EIA gas price dated in data/hybrid-pages/_shared.json. See docs/seo/2026-11-21-hybrid-pages.md.`].map(csvCell).join(',') })), (text, entry) => text.includes(`${entry.url},`));
  // query map
  const queryRows = cars.flatMap(({ car }) => car.queries.map(query => ({ query, line: [query, 'vehicle_hybrid_vs_gas', `${origin}/${car.slug}`, 'exploratory_seed', car.published, '', '', '', '', '', '', 'P2', 'SEO-2026-11-21-HYBRIDS', 'dated_third_party_sources', 'Hybrid-versus-gas page; no Search Console data yet. See docs/seo/2026-11-21-hybrid-pages.md'].map(csvCell).join(','), url: `${origin}/${car.slug}` })));
  changed += await appendMissing('docs/seo-execution/query-map.csv', queryRows, (text, entry) => text.includes(`\n${csvCell(entry.query)},vehicle_hybrid_vs_gas,${entry.url},`));
  // sitemap
  let sitemap = await read('sitemap.xml'), added = 0;
  for (const { car } of cars) if (!sitemap.includes(`<loc>${origin}/${car.slug}</loc>`)) { sitemap = sitemap.replace('</urlset>', `  <url>\n    <loc>${origin}/${car.slug}</loc>\n    <lastmod>${car.published}</lastmod>\n  </url>\n</urlset>`); added++; }
  if (added) { await writeFile(path.join(root, 'sitemap.xml'), sitemap); changed += added; }
  // llms.txt: after the last line of the "Price guides by model" list
  let llms = await read('llms.txt'); added = 0;
  for (const { car } of cars) {
    if (llms.includes(`${origin}/${car.slug}`)) continue;
    const lines = llms.split('\n');
    const start = lines.findIndex(line => line.startsWith('## Price guides by model'));
    let end = lines.findIndex((line, index) => index > start && line.startsWith('## '));
    if (end < 0) end = lines.length;
    while (end > start && lines[end - 1] === '') end--;
    lines.splice(end, 0, `- [${car.llms.title}](${origin}/${car.slug}): ${car.llms.text} (checked ${car.checkedOn}).`);
    llms = lines.join('\n'); added++;
  }
  if (added) { await writeFile(path.join(root, 'llms.txt'), llms); changed += added; }
  // blog.html: a card after the last card of the list that holds the Civic price guide, and an ItemList entry
  let blog = await read('blog.html'); added = 0;
  for (const { car } of cars) {
    if (blog.includes(`href="/${car.slug}"`)) continue;
    const anchor = blog.indexOf('href="/honda-civic-price.html"');
    const listEnd = blog.indexOf('</ul>', anchor);
    const card = `<li class="info-card"><span class="tag">Hybrid or gas</span><h3>${car.blog.title}</h3><p>${car.blog.text}</p><a href="/${car.slug}">${car.blog.cta}</a></li>\n`;
    blog = blog.slice(0, listEnd) + card + blog.slice(listEnd);
    const positions = [...blog.matchAll(/"position": (\d+)/g)].map(match => Number(match[1]));
    const next = Math.max(...positions) + 1;
    const closing = blog.indexOf('\n      ]', blog.indexOf('"@type": "ItemList"'));
    blog = blog.slice(0, closing) + `,\n        {\n          "@type": "ListItem",\n          "position": ${next},\n          "name": ${JSON.stringify(car.blog.title)},\n          "url": "${origin}/${car.slug}"\n        }` + blog.slice(closing);
    added++;
  }
  if (added) { await writeFile(path.join(root, 'blog.html'), blog); changed += added; }
  return changed;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (process.argv.includes('--wire')) {
    console.log(`Wired ${await wire()} missing entries.`);
  } else {
    const check = process.argv.includes('--check');
    let stale = 0;
    for (const { slug, html } of await renderHybridPages()) {
      if (check) {
        const current = await read(slug).catch(() => null);
        if (current !== html) { stale++; console.error(`${slug} is out of date. Run npm run build:hybrids.`); }
      } else {
        await writeFile(path.join(root, slug), html);
        console.log(`wrote ${slug}`);
      }
    }
    if (stale) process.exit(1);
    if (check) console.log('Hybrid pages match data/hybrid-pages.');
  }
}
