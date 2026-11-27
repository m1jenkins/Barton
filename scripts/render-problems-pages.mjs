// Builds the "<car> problems by year" pages (<make>-<model>-problems.html) from data/problems-pages/<car key>.json.
// One file per car. A file whose `status` is not "ready" (a stub holding only the NHTSA settings and counts written by
// scripts/nhtsa-problems.mjs) is skipped. Chrome and plan cards follow the price guides: the page shell comes from
// render-market-pages.mjs and the layout classes from buying/price-guide.css, plus buying/problems.css for the verdict marks.
// Run `npm run build:problems` after changing a car file, this script, problems.css or car-negotiation-service.html's
// head/header/footer; `npm run check:problems` fails when a page drifts. How to add a car: docs/seo/2026-11-21-problems-pages.md.
import { createHash } from 'node:crypto';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { shell, askMason } from './render-market-pages.mjs';
import { summarizeCar, topics as sentimentTopics } from './reddit-sentiment.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const origin = 'https://www.steermeright.com';
const chromePage = 'car-negotiation-service.html';
const sheets = ['buying/price-guide.css', 'buying/problems.css'];
const folder = 'data/problems-pages';
const read = file => readFile(path.join(root, file), 'utf8');
const longDate = iso => new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
const monthYear = iso => new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const count = value => value.toLocaleString('en-US');
const paragraphs = list => list.map(text => `<p>${text}</p>`).join('\n');
const faq = entries => `<div class="vp-faq">\n${entries.map(([question, answer]) => `<details><summary>${question}</summary><p>${answer}</p></details>`).join('\n')}\n</div>`;
export const slugFor = key => `${key}-problems.html`;
export const verdictNames = { buy: 'Buy', check: 'Check first', avoid: 'Avoid' };
// The model years the pages cover. Calendar-year sales exist through 2025; the newest model year has no rate.
export const firstYear = 2016, lastRatedYear = 2025;
// A car first sold in the U.S. after 2016 (Model 3, Model Y, the returning Ranger) sets `firstSold`; its table, chart and counts start there.
export const startOf = car => Math.max(firstYear, car.firstSold ?? firstYear);

// NHTSA's component names, in plain words. A name not listed here is shown in sentence case.
export const componentLabels = {
  'ELECTRICAL SYSTEM': 'Electrical system',
  'ENGINE': 'Engine',
  'ENGINE AND ENGINE COOLING': 'Engine and cooling',
  'POWER TRAIN': 'Transmission and drivetrain',
  'FUEL/PROPULSION SYSTEM': 'Fuel and hybrid system',
  'FUEL SYSTEM': 'Fuel system',
  'STEERING': 'Steering',
  'SERVICE BRAKES': 'Brakes',
  'AIR BAGS': 'Air bags',
  'FORWARD COLLISION AVOIDANCE': 'Automatic emergency braking',
  'LANE DEPARTURE': 'Lane keeping',
  'EXTERIOR LIGHTING': 'Exterior lighting',
  'VISIBILITY': 'Wipers and visibility',
  'STRUCTURE': 'Body and structure',
  'SUSPENSION': 'Suspension',
  'LATCHES/LOCKS/LINKAGES': 'Latches and locks',
  'SEATS': 'Seats',
  'TIRES': 'Tires',
  'WHEELS': 'Wheels',
  'VEHICLE SPEED CONTROL': 'Speed control',
  'BACK OVER PREVENTION': 'Backup camera',
  'SEAT BELTS': 'Seat belts',
  'ELECTRONIC STABILITY CONTROL (ESC)': 'Stability control',
  'EQUIPMENT': 'Equipment',
  'UNKNOWN OR OTHER': 'Unknown or other',
};
export const componentLabel = name => componentLabels[name] ?? (name.charAt(0) + name.slice(1).toLowerCase());

// ---- helpers shared in spirit with render-vehicle-pages.mjs (that file does not export them) ----
function table(id, caption, head, rows) {
  return `<div class="vp-scroll" role="region" aria-labelledby="${id}" tabindex="0">
<table class="vp-table pb-table">
<caption id="${id}" class="sr-only">${caption}</caption>
<thead><tr>${head.map(cell => `<th scope="col">${cell}</th>`).join('')}</tr></thead>
<tbody>
${rows.map(([first, ...rest]) => `<tr><th scope="row">${first}</th>${rest.map(cell => `<td>${cell}</td>`).join('')}</tr>`).join('\n')}
</tbody>
</table>
</div>`;
}
const credit = (label, image) => `<li>${label}: <a href="${image.sourceUrl}" rel="noopener">${image.author}</a>, ${image.licenseUrl ? `<a href="${image.licenseUrl}" rel="noopener">${image.license}</a>` : image.license}${image.note ? `, ${image.note}` : ''}</li>`;
const picture = (image, widths, sizes, priority) => `<picture>${['avif', 'webp'].map(type => `<source type="image/${type}" srcset="${widths.map(width => `/assets/external/optimized/${image.file}-${width}.${type} ${width}w`).join(', ')}" sizes="${sizes}">`).join('')}<img src="/assets/external/source/${image.file}-original.jpg" alt="${image.alt}" width="${image.width}" height="${image.height}" decoding="async"${priority ? ' fetchpriority="high"' : ' loading="lazy"'}></picture>`;
const meter = (value, max) => `<span class="vp-meter" aria-hidden="true"><span style="--w:${Math.round((value / max) * 1000) / 10}%"></span></span>`;
const bars = rows => { const max = Math.max(...rows.map(row => row.value)); return `<ul class="vp-bars" role="list">
${rows.map(row => `<li><span class="vp-bars__label">${row.label}</span>${meter(row.value, max)}<span class="vp-bars__value">${row.display ?? row.value}</span></li>`).join('\n')}
</ul>`; };
// Short versions of the Steer Me Right and Pro cards, as on the price guides (render-vehicle-pages.mjs `planCards`).
// Change both together. The buttons link to the cards on the homepage (/#full-service, /#concierge) and carry
// data-service-tier, which script.js turns into checkout. Do not add data-plan.
const planCards = [
  { name: 'Steer Me Right', fit: 'Best if the car is within 200 miles of you.', price: '$395', photo: 'plan-steering-wheel-toyota-192.webp', href: '/#full-service', tier: 'full_service',
    items: ['One model, with any trims, colors and packages', 'We contact dealers within 200 miles that have it in stock', 'We negotiate the price and fees'] },
  { name: 'Steer Me Right Pro', fit: 'Best if you want the best deal anywhere in the country.', price: '$695', photo: 'plan-steering-wheel-porsche-192.webp', href: '/#concierge', tier: 'concierge', pro: true,
    items: ['Dealers nationwide, with shipping quotes on long-distance deals', 'Trade-in support: we compare offers and negotiate it with the deal', 'Offers on up to three models'] },
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
<a class="vp-plan__button" href="${card.href}" data-service-tier="${card.tier}" data-cta-location="${location}">Get ${card.name}</a>
</article>`;

// ---- the numbers ----
const median = list => { const sorted = list.toSorted((x, y) => x - y), mid = sorted.length >> 1; return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2; };
// Rate per 100,000 sold for one model year, or null when the year has no sales figure. A rate already printed on one of our
// comparison pages (`publishedRates`) wins, so the pages agree; the car file keeps the figure, and the test holds it within 5%
// of the fresh count over sales.
export function yearFigures(car) {
  const years = [];
  for (let year = startOf(car); year <= car.nhtsa.years[1]; year++) {
    const row = car.nhtsa.byYear[year];
    if (!row) continue;
    const sold = car.sales?.[year] ?? null;
    const fresh = sold ? (row.complaints / sold) * 1e5 : null;
    const rate = fresh === null ? null : Math.round(car.publishedRates?.[year] ?? fresh);
    years.push({ year, complaints: row.complaints, recalls: row.recalls.length, components: row.components, sold, fresh, rate });
  }
  return years;
}
// The car's own yardstick: the median rate of its 2019 to 2025 model years.
export const baselineOf = figures => median(figures.filter(item => item.rate !== null && item.year >= 2019).map(item => item.rate));
// Pooled rate for a run of model years: complaints over sales, only counting years that have sales.
export function pooled(car, from, to, component = null) {
  let complaints = 0, sold = 0;
  for (let year = from; year <= to; year++) {
    const row = car.nhtsa.byYear[year];
    if (!row) continue;
    const n = component ? (row.components[component] ?? 0) : row.complaints;
    complaints += n;
    if (car.sales?.[year]) sold += car.sales[year];
  }
  return { complaints, sold, rate: sold ? (complaints / sold) * 1e5 : null };
}
const rateText = value => value === null ? 'n/a' : value < 10 ? value.toFixed(1) : count(Math.round(value));
const allRecalls = car => [...new Set(Object.values(car.nhtsa.byYear).flatMap(row => row.recalls))];
const yearsText = ([from, to]) => from === to ? `${from}` : `${from}–${to}`;
const chip = verdict => `<span class="pb-chip pb-chip--${verdict}">${verdictNames[verdict]}</span>`;

// Columns, one per model year, coloured by verdict, every value printed.
function rateColumns(figures, car) {
  const rated = figures.filter(item => item.rate !== null);
  const max = Math.max(...rated.map(item => item.rate));
  return `<ol class="vp-cols pb-cols" role="list">
${rated.map(item => `<li><span class="vp-cols__value">${count(item.rate)}</span><span class="vp-cols__bar" aria-hidden="true" data-verdict="${car.verdicts[item.year][0]}" style="--h:${Math.round((item.rate / max) * 1000) / 10}"></span><span class="vp-cols__label">${item.year}<span class="sr-only">, ${verdictNames[car.verdicts[item.year][0]]}</span></span></li>`).join('\n')}
</ol>
<ul class="pb-key" role="list"><li>${chip('buy')}</li><li>${chip('check')}</li><li>${chip('avoid')}</li></ul>`;
}

function recallColumns(figures) {
  const max = Math.max(...figures.map(item => item.recalls), 1);
  return `<ol class="vp-cols pb-cols pb-cols--recalls" role="list">
${figures.map(item => `<li><span class="vp-cols__value">${item.recalls}</span><span class="vp-cols__bar" aria-hidden="true" style="--h:${Math.round((item.recalls / max) * 1000) / 10}"></span><span class="vp-cols__label">${item.year}</span></li>`).join('\n')}
</ol>`;
}

// What Reddit says, from the car's coded file: figures worked out by summarizeCar(), notes the coders' paraphrases.
function redditSection(car, coded) {
  const sentiment = summarizeCar(coded);
  const reliability = sentiment.topics.reliability;
  const short = car.short;
  const homes = [coded.home].flat().map(sub => `r/${sub}`);
  const negatives = Object.entries(sentiment.topics)
    .filter(([topic, figure]) => topic !== 'reliability' && figure.mentions >= 15 && figure.net !== null && figure.net < 0)
    .sort((x, y) => x[1].net - y[1].net).slice(0, 3)
    .map(([topic]) => `<li><b>${sentimentTopics[topic]}.</b> ${coded.themes[topic]?.neg?.[0] ?? ''}</li>`);
  const list = items => `<ul role="list">${items.map(item => `<li>${item}</li>`).join('')}</ul>`;
  const rel = coded.themes.reliability ?? { pos: [], neg: [] };
  return `<section id="reddit" class="vp-section">
<h2>What owners report on Reddit</h2>
<p>Reliability is the topic Reddit raises most about the ${short}: ${count(reliability.mentions)} mentions in ${count(sentiment.threads)} threads, ${reliability.pos} positive and ${reliability.neg} negative, a net of ${reliability.net > 0 ? '+' : reliability.net < 0 ? '−' : ''}${Math.abs(reliability.net)} on a scale from −100 to +100. Our Reddit Sentiment Index for the ${short} is ${sentiment.index} out of 100 (50 is even). The threads run from ${monthYear(coded.threadsFrom)} to ${monthYear(coded.threadsTo)} and come from ${homes.length > 1 ? `${homes.slice(0, -1).join(', ')} and ${homes.at(-1)}` : homes[0]} and the rest of Reddit, so they say little about a car that owners stopped discussing before 2025. The <a href="/${car.guide}#reddit">${car.name} price guide</a> has the full topic breakdown.</p>
${car.reddit?.paragraphs?.length ? paragraphs(car.reddit.paragraphs) : ''}
<div class="vp-rd-themes">
<section><h3>What owners praise about reliability</h3>${list(rel.pos)}</section>
<section><h3>What owners report going wrong</h3><ul class="vp-rd-themes__neg" role="list">${rel.neg.map(item => `<li>${item}</li>`).join('')}</ul></section>
</div>
${negatives.length ? `<section class="pb-rd-more"><h3>Other complaints that come up</h3><ul role="list">${negatives.join('')}</ul></section>` : ''}
<p class="vp-note">Our own reading of public Reddit comments from the Arctic Shift archive, January 2025 onward, collected ${longDate(coded.collected)}; the method is in the price guide. Complaints are what owners report, not confirmed defects.</p>
</section>`;
}

// ---- the page ----
function problemsPage(car, vehicle, comparisons, coded, updated) {
  const checked = longDate(car.checkedOn);
  const figures = yearFigures(car);
  const baseline = baselineOf(figures);
  const guide = `/${car.guide}`;
  // Copy may carry live figures so prose cannot drift from the counts: {c:2019} complaints, {r:2019} rate, {rec:2019} recalls,
  // {k:2019:ENGINE} complaints naming a part, {pool:2023-2025} pooled rate, {pc:2023-2025} pooled complaints, {base} the yardstick.
  const byYear = year => car.nhtsa.byYear[year] ?? (() => { throw new Error(`${car.key}: no NHTSA row for ${year}`); })();
  const subst = text => text.replaceAll('{guide}', guide)
    .replace(/\{c:(\d{4})\}/g, (_, year) => count(byYear(year).complaints))
    .replace(/\{r:(\d{4})\}/g, (_, year) => count(figures.find(item => item.year === Number(year)).rate))
    .replace(/\{rec:(\d{4})\}/g, (_, year) => `${byYear(year).recalls.length}`)
    .replace(/\{k:(\d{4}):([^}]+)\}/g, (_, year, part) => count(byYear(year).components[part] ?? 0))
    .replace(/\{pool:(\d{4})-(\d{4})\}/g, (_, from, to) => rateText(pooled(car, Number(from), Number(to)).rate))
    .replace(/\{pc:(\d{4})-(\d{4})\}/g, (_, from, to) => count(pooled(car, Number(from), Number(to)).complaints))
    .replace(/\{base\}/g, count(baseline));
  const recalls = allRecalls(car);
  const rated = figures.filter(item => item.rate !== null);
  const recent = pooled(car, 2023, 2025);
  const versus = comparisons.filter(cmp => cmp.cars.some(entry => entry.slug === car.guide));
  const topParts = Object.entries(Object.values(car.nhtsa.byYear).reduce((sum, row) => { for (const [name, n] of Object.entries(row.components)) sum[name] = (sum[name] ?? 0) + n; return sum; }, {}))
    .filter(([name]) => name !== 'UNKNOWN OR OTHER').sort((x, y) => y[1] - x[1]).slice(0, 8);
  const totalComplaints = figures.reduce((sum, item) => sum + item.complaints, 0);
  const tabs = [['answer', 'Verdict'], ['years', 'Year by year'], ['chart', 'Chart'], ['generations', 'Generations'], ['problems', 'Common problems'], ['reddit', 'Reddit'], ['recalls', 'Recalls'], ['check', 'What to check'], ['newer', 'The 2026'], ['faq', 'Questions']];
  const glance = [
    ['Best used years', car.bestYears, 'years'],
    ['Years to avoid', car.avoidYears, 'years'],
    [`Complaints per 100,000 sold, 2023–2025`, `${rateText(recent.rate)}`, 'chart'],
    [`Recalls, ${startOf(car)}–${car.nhtsa.years[1]} model years`, `${recalls.length}`, 'recalls'],
  ];
  const body = `<article class="vp pb">
<header class="vp-head vp-width">
<p class="vp-crumb"><a href="/blog.html">Resources</a> / ${car.name} problems</p>
<h1>${car.h1}</h1>
<p class="vp-byline">By <a href="/about.html">Mason</a> · Updated <time datetime="${updated}">${longDate(updated)}</time></p>
</header>
<nav class="vp-tabs" aria-label="Article contents"><ul class="vp-width" role="list">${tabs.map(([id, label]) => `<li><a href="#${id}">${label}</a></li>`).join('')}</ul></nav>

<div class="vp-stage">
<div class="vp-layout vp-width">
<div class="vp-hero">
<div class="vp-gallery pb-photo"><figure class="vp-gallery__main">${picture(vehicle.photo, [640, 960, 1600], '(max-width: 1000px) 94vw, 680px', true)}<figcaption>${vehicle.photo.caption}</figcaption></figure></div>
</div>

<aside class="vp-rail">
<ul class="vp-glance" role="list" aria-label="${car.name} problems at a glance">
${glance.map(([label, value, section]) => `<li><a href="#${section}"><span class="vp-glance__label">${label}</span><span class="vp-glance__figure">${value}</span></a></li>`).join('\n')}
</ul>
<a class="vp-button" href="${guide}">${car.name} price guide</a>
<p class="vp-rail__fine">Dealers and lenders pay us nothing.</p>
</aside>

<div class="vp-body">
<section id="answer" class="vp-section vp-section--first">
${car.answer.map((text, index) => `<p class="${index ? '' : 'vp-lead'}">${subst(text)}</p>`).join('\n')}
</section>

<section id="years" class="vp-section">
<h2>${car.name} reliability by year</h2>
${table('years-caption', `${car.name} model years ${startOf(car)} to ${car.nhtsa.years[1]}: our verdict, NHTSA owner complaints and recalls, checked ${checked}`,
    ['Year', 'Our verdict', 'Per 100,000 sold', 'Complaints', 'Recalls', 'Why'],
    figures.map(item => { const [verdict, reason] = car.verdicts[item.year]; return [`${item.year}`, chip(verdict), item.rate === null ? '<span class="pb-na">Too new to rate</span>' : `<strong>${count(item.rate)}</strong>`, count(item.complaints), `${item.recalls}`, subst(reason)]; }))}
<p class="vp-note">Complaints are owner reports to NHTSA, counted once each across every ${car.name} listing (${car.nhtsa.listings.length > 3 ? 'all the trim and body-style listings' : car.nhtsa.listings.join(', ')}) and read on ${longDate(car.nhtsa.readOn)}. Each rate divides a model year’s complaints by the U.S. sales of the same calendar year. Model years and calendar years don’t line up, since a model year’s cars sell across two calendar years, so the rate compares years with each other. ${car.salesNote} Our verdicts use this car’s own yardstick, the median of ${count(baseline)} complaints per 100,000 across its 2019 to 2025 model years: Buy up to 1.25 times it, Check first up to twice it, Avoid above that. A recall, free or not, never moves a verdict. A year can move when NHTSA has an open investigation on it or one part carries most of its complaints,; the reason column says so.</p>
</section>

<section id="chart" class="vp-section vp-section--band">
<h2>Complaints per 100,000 sold, by model year</h2>
${rateColumns(figures, car)}
<p class="vp-note">NHTSA owner complaints for each model year over that calendar year’s U.S. sales, ${startOf(car)} to ${lastRatedYear}. A newer model year has had less time on the road to collect complaints, so its bar is still growing. The ${car.nhtsa.years[1]} model year has no full year of sales and is not charted.${car.chartNote ? ` ${subst(car.chartNote)}` : ''}</p>
${versus.length ? `<p class="vp-note">The same method runs on our head-to-head pages: ${versus.map(cmp => `<a href="/${cmp.slug}">${cmp.crumb}</a>`).join(', ')}.</p>` : ''}
</section>

<section id="generations" class="vp-section">
<h2>${car.short} generations: what changed</h2>
${car.generations.map(gen => `<h3>${gen.name} <span class="pb-years">${gen.years}</span></h3>\n<p>${subst(gen.text)}</p>`).join('\n')}
</section>

<section id="problems" class="vp-section vp-section--band">
<h2>Common ${car.short} problems by component</h2>
<p>NHTSA files each complaint under the parts the owner names, and one complaint can name more than one. Across all ${count(totalComplaints)} ${car.short} complaints for the ${startOf(car)} to ${car.nhtsa.years[1]} model years, these parts come up most:</p>
${bars(topParts.map(([name, n]) => ({ label: componentLabel(name), value: n, display: count(n) })))}
<ul class="pb-issues" role="list">
${car.problems.map(problem => {
    const stat = pooled(car, problem.years[0], problem.years[1], problem.component);
    const sold = stat.rate === null ? '' : `, ${rateText(stat.rate)} per 100,000 sold`;
    return `<li><strong>${problem.title} <span class="pb-years">${yearsText(problem.years)} model years</span></strong><span class="pb-count">${count(stat.complaints)} complaints naming ${componentLabel(problem.component).toLowerCase()}${sold}.</span> ${subst(problem.text)}</li>`;
  }).join('\n')}
</ul>
</section>

${redditSection(car, coded)}

<section id="recalls" class="vp-section vp-section--band">
<h2>${car.short} recalls and investigations</h2>
<p>${car.recallsIntro ? subst(car.recallsIntro) : `NHTSA lists ${recalls.length} different recall campaigns against ${car.short} model years ${startOf(car)} to ${car.nhtsa.years[1]}.`} A campaign that covers several model years counts once in each, so the bars add to more than that.</p>
${recallColumns(figures)}
<h3 style="margin-top:28px">Recalls worth knowing about</h3>
<ul class="pb-issues" role="list">
${car.notableRecalls.map(recall => `<li><strong>${recall.title} <span class="pb-years">${recall.years}</span></strong><span class="pb-count">Recall ${recall.id}.</span> ${subst(recall.text)}</li>`).join('\n')}
</ul>
<h3 style="margin-top:28px">Open and recent NHTSA investigations</h3>
${car.investigations.length ? `<ul class="pb-issues" role="list">
${car.investigations.map(item => `<li><strong>${item.title} <span class="pb-years">${item.years}</span></strong><span class="pb-count">${item.id}, ${item.status}.</span> ${subst(item.text)}</li>`).join('\n')}
</ul>` : `<p>${subst(car.noInvestigations)}</p>`}
</section>

<section id="check" class="vp-section">
<h2>What to check before you buy a used ${car.short}</h2>
<ul class="vp-watch" role="list">
<li><strong>Open recalls by VIN.</strong>Enter the VIN at <a href="https://www.nhtsa.gov/recalls" rel="noopener">nhtsa.gov/recalls</a>. A recall fix is free at a ${car.make} dealer, and the lookup shows which ones are still open on that exact car.</li>
${car.checks.map(item => `<li><strong>${item.title}</strong>${subst(item.text)}</li>`).join('\n')}
</ul>
<p>Our <a href="${guide}">${car.name} price guide</a> covers what a new or used one should cost, and the <a href="/blog-used-car-inspection-checklist.html">used car inspection checklist</a> covers the rest of the walk-around.</p>
</section>

<section id="newer" class="vp-section vp-section--band">
<h2>Is the ${car.newerYear} better?</h2>
${paragraphs(car.newer.map(subst))}
</section>

<aside class="vp-cta" aria-label="Steer Me Right plans"><div><p><strong>Rather not sort the good years from the bad ones yourself?</strong>We find the ${car.short} you want in dealer stock, negotiate the price and fees, and bring you the offers.</p><p class="vp-cta__fine">From $395. Full refund if you cancel before negotiations begin.</p></div><a class="vp-cta__button" href="#plans">See the plans</a></aside>

<section id="plans" class="vp-section vp-plans">
<h2>Pick how much help you want</h2>
<div class="vp-plans__grid">
${planCards.map(card => planCard(card, `problems-${car.key}`)).join('\n')}
</div>
${askMason(`problems-${car.key}`, car.name)}
<p class="vp-note">The Steer Me Right plan covers dealers within 200 miles of you; Steer Me Right Pro covers dealers nationwide. The fee doesn’t cover the car, taxes or registration. We can’t promise a specific discount: the market for a given car sets what a dealer will do. <a href="/policy.html#refund-policy">Refund policy</a></p>
</section>

<section id="faq" class="vp-section vp-section--band">
<h2>Common questions</h2>
${faq(car.faq.map(([question, answer]) => [question, subst(answer)]))}
</section>

<section class="vp-sources" aria-labelledby="guide-sources"><h2 id="guide-sources">Sources and updates</h2><p>Written by <a href="/about.html">Mason</a>, Steer Me Right’s founder and lead advisor. Complaint and recall counts were read from NHTSA on ${longDate(car.nhtsa.readOn)} and change as owners file more; sales figures and everything else were checked on ${checked}. The verdicts are our judgment from these figures, not a promise about any one car. The Reddit figures are our own reading of public comments, not a survey of owners. If something is out of date or wrong, email <a href="mailto:mason@steermeright.com">mason@steermeright.com</a>.</p>
<details class="vp-more"><summary>All ${car.sources.length} sources</summary>
<ul>
${car.sources.map(source => `<li><a href="${source.url}" rel="noopener">${source.title}</a>${source.note ? `: ${source.note}` : ''}</li>`).join('\n')}
</ul>
</details>
<p>Related: <a href="${guide}">${car.name} price guide</a>${versus.map(cmp => `, <a href="/${cmp.slug}">${cmp.crumb}</a>`).join('')}, <a href="/new-car-buying-service.html">new car buying service</a> and <a href="/car-negotiation-service.html">car negotiation service</a>.</p>
<details class="vp-credits"><summary>Photo credits</summary>
<ul>${credit(vehicle.photo.caption, vehicle.photo)}</ul>
</details></section>
</div>
</div>
</div>
</article>`;
  return { slug: car.slug, title: car.title, description: car.description, h1: car.h1, crumbs: [['Resources', `${origin}/blog.html`], [`${car.name} problems`, `${origin}/${car.slug}`]], body };
}

const sheetLink = (file, css) => `<link rel="stylesheet" href="/${file}?v=${createHash('sha256').update(css).digest('hex').slice(0, 12)}">`;

// The cars with copy: every data/problems-pages/*.json whose status is "ready".
export async function problemsCars() {
  const cars = [];
  for (const name of (await readdir(path.join(root, folder))).filter(file => file.endsWith('.json')).sort()) {
    const car = JSON.parse(await read(`${folder}/${name}`));
    cars.push({ ...car, slug: slugFor(car.key), guide: `${car.key}-price.html`, file: `${folder}/${name}` });
  }
  return cars;
}

export async function renderProblemsPages() {
  const [chrome, vehicleData, comparisonData, cars, ...css] = await Promise.all([read(chromePage), read('data/vehicle-pages.json').then(JSON.parse), read('data/comparison-pages.json').then(JSON.parse), problemsCars(), ...sheets.map(file => read(file))]);
  const links = sheets.map((file, index) => sheetLink(file, css[index])).join('\n    ');
  const pages = [];
  for (const car of cars) {
    if (car.status !== 'ready') continue;
    const vehicle = vehicleData.vehicles.find(entry => entry.slug === car.guide);
    if (!vehicle) throw new Error(`${car.key}: no price guide ${car.guide}`);
    const redditFile = path.join(root, `data/reddit-sentiment/cars/${car.key}.json`);
    if (!existsSync(redditFile)) throw new Error(`${car.key}: no Reddit car file`);
    const coded = JSON.parse(readFileSync(redditFile, 'utf8'));
    const page = problemsPage({ ...car, make: car.make ?? vehicle.name.split(' ')[0] }, vehicle, comparisonData.comparisons, coded, car.checkedOn);
    const html = shell(chrome, { ...page, published: car.published, updated: car.checkedOn }, page.body);
    pages.push({ slug: page.slug, html: html.replace('</head>', `    ${links}\n</head>`) });
  }
  return pages;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const check = process.argv.includes('--check');
  let stale = 0;
  const pages = await renderProblemsPages();
  for (const { slug, html } of pages) {
    if (check) {
      const current = await read(slug).catch(() => null);
      if (current !== html) { stale++; console.error(`${slug} is out of date. Run npm run build:problems.`); }
    } else {
      await writeFile(path.join(root, slug), html);
      console.log(`wrote ${slug}`);
    }
  }
  const skipped = (await problemsCars()).filter(car => car.status !== 'ready').length;
  if (stale) process.exit(1);
  console.log(check ? `Problems pages match data/problems-pages (${pages.length} pages, ${skipped} cars without copy yet).` : `${pages.length} pages written, ${skipped} cars without copy yet.`);
}
