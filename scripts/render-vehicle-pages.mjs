// Builds the vehicle price pages (<make>-<model>-price.html) from data/vehicle-pages.json.
// The page chrome and the plan cards come from render-market-pages.mjs, so asset hashes follow
// car-negotiation-service.html. Run `npm run build:vehicles` after changing the data, this script,
// buying/price-guide.css or the chrome page; `npm run check:vehicles` fails when the files drift.
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { shell } from './render-market-pages.mjs';
import { summarize, topics as sentimentTopics } from './reddit-sentiment.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const origin = 'https://www.steermeright.com';
const chromePage = 'car-negotiation-service.html';
const stylesheet = 'buying/price-guide.css';
const read = file => readFile(path.join(root, file), 'utf8');
const longDate = iso => new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
const dollars = value => `$${value.toLocaleString('en-US')}`;
const paragraphs = list => list.map(text => `<p>${text}</p>`).join('\n');
const faq = entries => `<div class="vp-faq">\n${entries.map(([question, answer]) => `<details><summary>${question}</summary><p>${answer}</p></details>`).join('\n')}\n</div>`;

// A later-year price cell may be text ("Dropped" for a trim that does not carry over); an empty one renders "Ask us".
// A ruled table inside a scroll region. `head` and each row are arrays of cell HTML; the first cell of a row is its header.
function table(id, caption, head, rows) {
  return `<div class="vp-scroll" role="region" aria-labelledby="${id}" tabindex="0">
<table class="vp-table">
<caption id="${id}" class="sr-only">${caption}</caption>
<thead><tr>${head.map(cell => `<th scope="col">${cell}</th>`).join('')}</tr></thead>
<tbody>
${rows.map(([first, ...rest]) => `<tr><th scope="row">${first}</th>${rest.map(cell => `<td>${cell}</td>`).join('')}</tr>`).join('\n')}
</tbody>
</table>
</div>`;
}

// Photos are licensed (Wikimedia Commons). Each one is credited by name in the folded "Photo credits" line at the foot of the page.
const credit = (label, image) => `<li>${label}: <a href="${image.sourceUrl}" rel="noopener">${image.author}</a>, ${image.licenseUrl ? `<a href="${image.licenseUrl}" rel="noopener">${image.license}</a>` : image.license}${image.note ? `, ${image.note}` : ''}</li>`;
const picture = (image, widths, sizes, priority) => `<picture>${['avif', 'webp'].map(type => `<source type="image/${type}" srcset="${widths.map(width => `/assets/external/optimized/${image.file}-${width}.${type} ${width}w`).join(', ')}" sizes="${sizes}">`).join('')}<img src="/assets/external/source/${image.file}-original.jpg" alt="${image.alt}" width="${image.width}" height="${image.height}" decoding="async"${priority ? ' fetchpriority="high"' : ' loading="lazy"'}></picture>`;
// One large photo with the smaller ones stacked beside it.
const gallery = (main, rest) => `<div class="vp-gallery">
<figure class="vp-gallery__main">${picture(main, [640, 960, 1600], '(max-width: 1000px) 94vw, 680px', true)}<figcaption>${main.caption}</figcaption></figure>
${rest.map(item => `<figure>${picture(item, [480, 960], '(max-width: 1000px) 24vw, 180px', false)}<figcaption>${item.caption}</figcaption></figure>`).join('\n')}
</div>`;
const credits = (main, rest) => `<details class="vp-credits"><summary>Photo credits</summary>
<ul>${[credit('Main photo', main), ...rest.map(item => credit(item.caption, item))].join('')}</ul>
</details>`;

const percent = (value, max) => `${Math.round((value / max) * 1000) / 10}%`;
const stars = count => `<span class="vp-stars" role="img" aria-label="${count} out of 5 stars" style="--n:${count}"></span>`;
// IIHS grades a test Good, Acceptable, Marginal or Poor; the chip shows the letter and the word sits beside it.
const grade = word => `<span class="vp-grade vp-grade--${word.toLowerCase()}" aria-hidden="true">${word[0]}</span><span class="vp-grade__word">${word}</span>`;
// A safety rating is NHTSA stars (overall out of 5) or, before NHTSA has tested a car, a count of IIHS tests rated Good.
const safetyScore = safety => safety.outOf ? `${safety.overall}<small>/${safety.outOf}</small>` : '';
const safetyMark = safety => safety.outOf ? `<span class="vp-tally" role="img" aria-label="${safety.overall} of ${safety.outOf} rated Good">${Array.from({ length: safety.outOf }, (_, i) => `<i${i < safety.overall ? ' class="on"' : ''}></i>`).join('')}</span>` : stars(safety.overall);
const meter = (value, max) => `<span class="vp-meter" aria-hidden="true"><span style="--w:${percent(value, max)}"></span></span>`;
// Horizontal bars: label, a bar scaled to the largest value, and the value printed beside it.
const bars = rows => { const max = Math.max(...rows.map(row => row.value)); return `<ul class="vp-bars" role="list">
${rows.map(row => `<li><span class="vp-bars__label">${row.label}</span>${meter(row.value, max)}<span class="vp-bars__value">${row.display ?? row.value}</span></li>`).join('\n')}
</ul>`; };
// Vertical columns for a count per year.
const columns = rows => { const max = Math.max(...rows.map(row => row.value)); return `<ol class="vp-cols" role="list">
${rows.map(row => `<li><span class="vp-cols__value">${row.display ?? row.value}</span><span class="vp-cols__bar" aria-hidden="true" style="--h:${Math.round((row.value / max) * 1000) / 10}"></span><span class="vp-cols__label">${row.label}</span></li>`).join('\n')}
</ol>`; };
// The homepage's two plan cards (index.html, #plans), word for word. The buttons are plain /schedule.html links;
// script.js turns them into checkout. Do not add data-plan.
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

// Cash or 0%: how much less each Ford deal costs than full price at the average new-car rate, from the loan inputs in the data.
// Copied from Aave's "Unmatched savings rates" card (Mobbin): text on the left, one pill bar per option with its figure at the end.
const totalPaid = (amount, apr, months) => { if (!apr) return amount; const r = apr / 1200; return (amount * r / (1 - (1 + r) ** -months)) * months; };
const round50 = value => Math.round(value / 50) * 50;
function cashOrRate(choice) {
  const base = totalPaid(choice.price, choice.baseRate, choice.months);
  const rows = choice.options.map(option => ({ ...option, saved: round50(base - totalPaid(choice.price - option.cash, option.rate, choice.months)) }));
  const best = Math.max(...rows.map(row => row.saved));
  const gap = dollars(Math.round((rows[0].saved - rows[rows.length - 1].saved) / 100) * 100);
  return `<div class="vp-cash">
<div class="vp-cash__copy"><p class="vp-cash__eyebrow">${choice.eyebrow}</p><h3>${choice.title.replace('{gap}', gap)}</h3><p>${choice.text}</p></div>
<ul class="vp-cash__bars" role="list">
${rows.map(row => `<li${row.saved === best ? ' class="vp-cash__best"' : ''}><p class="vp-cash__label"><strong>${row.name}</strong> ${row.detail}</p><p class="vp-cash__row"><span class="vp-cash__bar" aria-hidden="true" style="--w:${percent(row.saved, best)}"></span><span class="vp-cash__value">${dollars(row.saved)}<small> less</small></span></p></li>`).join('\n')}
</ul>
</div>`;
}

// "What to pay": one glass card per trim group with its fair and strong deal as big figures, in dollars off a named trim
// (owner, November 16, 2026, after a percent-axis ruler proved hard to read twice). A discount reads "2–3% under",
// "4% under", "4% or more", "MSRP" or "Any discount".
const discountRange = text => {
  if (text === 'MSRP') return [0, 0];
  if (text === 'Any discount') return [0, null];
  const found = text.match(/^(\d+(?:\.\d+)?)(?:–(\d+(?:\.\d+)?))?% (under|or more)$/);
  if (!found) throw new Error(`Unreadable discount "${text}"`);
  const from = Number(found[1]);
  return [from, found[3] === 'or more' ? null : Number(found[2] ?? found[1])];
};
const roundTo50 = value => Math.round(value / 50) * 50;
function dealTile(kind, label, text, price, base = 'MSRP') {
  const [from, to] = discountRange(text);
  let figure, unit, off;
  if (text === 'MSRP') [figure, unit, off] = ['MSRP', 'no markup', 'Pay the sticker price'];
  else if (text === 'Any discount') [figure, unit, off] = ['Any', 'discount', 'Anything under sticker'];
  else {
    figure = to === null ? `${from}%+` : from === to ? `${from}%` : `${from}–${to}%`;
    unit = `under ${base}`;
    off = to === null ? `${dollars(roundTo50(price * from / 100))} or more off` : from === to ? `About ${dollars(roundTo50(price * from / 100))} off` : `About ${dollars(roundTo50(price * from / 100))}–${dollars(roundTo50(price * to / 100))} off`;
  }
  return `<div class="vp-deal__tile vp-deal__tile--${kind}"><dt>${label}</dt><dd><strong>${figure}</strong><span>${unit}</span><em>${off}</em></dd></div>`;
}
function dealCards(pay, trims) {
  return `<h3 class="vp-deals__title">${pay.tableTitle}</h3>
<ul class="vp-deals" role="list">
${pay.rows.map(row => {
    const price = trims.find(trim => trim.name === row.example).prices[0];
    return `<li class="vp-deal">
<div class="vp-deal__name"><h4>${row.trims}</h4>${row.why ? `<p>${row.why}</p>` : ''}${[row.fair, row.strong].some(text => !['MSRP', 'Any discount'].includes(text)) ? `<p class="vp-deal__basis">Dollars are for a ${dollars(price)} ${row.example}.</p>` : ''}</div>
<dl class="vp-deal__tiles">${dealTile('fair', 'Fair deal', row.fair, price, pay.base)}${dealTile('strong', 'Strong deal', row.strong, price, pay.base)}</dl>
</li>`;
  }).join('\n')}
</ul>`;
}
const priceMath = walk => `<div class="vp-math">
<h3>${walk.title}</h3>
<div class="vp-math__terms">
<p><span>${walk.stickerLabel}</span><strong>${dollars(walk.sticker)}</strong></p>
${walk.steps.map(step => `<span class="vp-math__op" aria-hidden="true">−</span>
<p><span>${step.label}</span><strong><span class="sr-only">minus </span>${dollars(step.amount)}</strong></p>`).join('\n')}
<span class="vp-math__op" aria-hidden="true">=</span>
<p class="vp-math__total"><span>${walk.totalLabel}</span><strong>${dollars(walk.total)}</strong><em>${dollars(walk.sticker - walk.total)} ${walk.under ?? 'under sticker'}</em></p>
</div>
</div>`;

// An optional section on one version of the model that buyers shop on its own (the GR Corolla on the Corolla page):
// its photo, four figures, its trims, what to pay and two comparison charts, all from `vehicle.spotlight`.
function spotlight(spot, checked) {
  const top = Math.max(...spot.trims.rows.map(trim => trim.prices[0]));
  return `<section id="${spot.id}" class="vp-section vp-spotlight">
<h2>${spot.heading}</h2>
${paragraphs(spot.intro)}
<figure class="vp-spotlight__photo">${picture(spot.photo, [640, 960, 1600], '(max-width: 1000px) 94vw, 680px', false)}<figcaption>${spot.photo.caption}</figcaption></figure>
<ul class="vp-ic-offers" role="list">
${spot.stats.map(card => `<li><p class="vp-ic-offers__label">${card.label}</p><p class="vp-ic-offers__big">${card.figure} <span>${card.word}</span></p><p class="vp-ic-offers__text">${card.text}</p></li>`).join('\n')}
</ul>
<table class="vp-trims">
<caption class="sr-only">${spot.trims.caption}, checked ${checked}</caption>
<thead><tr><th scope="col">Trim</th>${spot.trims.columns.map(column => `<th scope="col">${column}</th>`).join('')}</tr></thead>
<tbody>
${spot.trims.rows.map(trim => `<tr><th scope="row">${trim.name}<span>${trim.gets}</span></th><td class="vp-trims__price"><span>${dollars(trim.prices[0])}</span>${meter(trim.prices[0], top)}</td></tr>`).join('\n')}
</tbody>
</table>
${paragraphs(spot.pay.intro)}
<div class="vp-pay-glass">
${dealCards(spot.pay, spot.trims.rows)}
</div>
<div class="vp-charts vp-charts--${spot.charts.length}">
${spot.charts.map(chart => `<section><h3>${chart.title}</h3>
${bars(chart.bars)}
<p class="vp-charts__source">${chart.source}</p></section>`).join('\n')}
</div>
${paragraphs(spot.after)}
</section>`;
}

function vehiclePage(vehicle, updated) {
  const checked = longDate(vehicle.checkedOn);
  const name = vehicle.name;
  const ask = `<a href="/schedule.html">Ask us</a>`;
  const topPrice = Math.max(...vehicle.trims.rows.map(trim => trim.prices[0]));
  const walk = vehicle.pay.walk;
  // Headings and fixed lines. A page about used cars (the Tesla Model Y, which Tesla sells new only direct) overrides them in `labels`.
  const text = {
    crumb: `${name} price`,
    payHeading: 'What to pay: how far under MSRP',
    trimsTab: 'Trims and MSRP',
    trimsHeading: `${vehicle.modelYear} ${name} trims and MSRP`,
    trimsCaption: `${vehicle.modelYear} ${name} starting MSRP by trim, checked ${checked}`,
    trimsColumn: 'Trim',
    trimsMore: 'Engines and what each trim adds',
    trimsMoreCaption: `${vehicle.modelYear} ${name} trims with starting MSRP, checked ${checked}`,
    engineColumn: 'Engines',
    pickHeading: 'The trim we’d buy',
    incentivesTab: 'Incentives',
    incentivesHeading: `${name} incentives right now`,
    incentivesMore: 'Every offer, with dates and regions',
    incentivesCaption: `Manufacturer offers on the ${name}, checked ${checked}`,
    incentivesColumns: ['Offer', 'What it is', 'Applies to', 'Ends'],
    conditionTab: 'New, used or CPO',
    conditionHeading: 'New, used or CPO?',
    conditionCaption: `Buying a ${name} new, certified pre-owned or used`,
    negotiate: `Yes. Steer Me Right charges a flat $395 for one model or $695 for up to three. We find it in dealer stock, get written out-the-door offers and negotiate for a price below MSRP. We can’t promise a specific discount: the market for a given car sets what a dealer will do.`,
    related: '<a href="/new-car-buying-service.html">new car buying service</a>, <a href="/blog-buy-new-car-below-msrp.html">comparing complete new-car quotes</a> and <a href="/car-negotiation-service.html">car negotiation service</a>',
    ...vehicle.labels,
  };
  const tabs = [['overview', 'Overview'], ['pay', 'What to pay'], ['reviews', 'Review scores'], ['trims', text.trimsTab], ['pick', 'Our pick'], ['incentives', text.incentivesTab], ['new-used', text.conditionTab], ['watch', 'What to watch for'], ['faq', 'Questions'], ['safety', 'Safety']];
  if (vehicle.spotlight) tabs.splice(tabs.findIndex(([id]) => id === 'pick') + 1, 0, [vehicle.spotlight.id, vehicle.spotlight.tab]);
  const body = `<article class="vp">
<header class="vp-head vp-width">
<p class="vp-crumb"><a href="/blog.html">Resources</a> / ${text.crumb}</p>
<h1>${vehicle.h1}</h1>
<p class="vp-byline">By <a href="/about.html">Mason</a> · Updated <time datetime="${updated}">${longDate(updated)}</time></p>
</header>
<nav class="vp-tabs" aria-label="Article contents"><ul class="vp-width" role="list">${tabs.map(([id, label]) => `<li><a href="#${id}">${label}</a></li>`).join('')}</ul></nav>

<div class="vp-stage">
<div class="vp-layout vp-width">
<div class="vp-hero">
${gallery(vehicle.photo, vehicle.gallery)}
<ul class="vp-strip" role="list">
${vehicle.scores.cards.map(card => `<li><a href="#reviews"><span class="vp-strip__source">${card.source}</span><span class="vp-strip__score">${card.display}<small>/${card.scale}</small></span></a></li>`).join('\n')}
<li><a href="#safety"><span class="vp-strip__source">${vehicle.safety.label}</span>${vehicle.safety.outOf ? `<span class="vp-strip__score">${safetyScore(vehicle.safety)}</span>` : stars(vehicle.safety.overall)}</a></li>
</ul>
</div>

<aside class="vp-rail">
<ul class="vp-glance" role="list" aria-label="${name} at a glance">
${vehicle.glance.map(tile => `<li><a href="#${tile.section}"><span class="vp-glance__label">${tile.label}</span><span class="vp-glance__figure">${tile.value}</span></a></li>`).join('\n')}
</ul>
<a class="vp-button" href="#plans">See the plans</a>
<p class="vp-rail__fine">Dealers and lenders pay us nothing.</p>
</aside>

<div class="vp-body">
<section id="overview" class="vp-section vp-section--first">
<p class="vp-lead">${vehicle.summary}</p>
<div class="vp-verdict">
<section class="vp-verdict__pros"><h2>What we like</h2><ul role="list">${vehicle.pros.map(item => `<li>${item}</li>`).join('')}</ul></section>
<section class="vp-verdict__cons"><h2>What we’d think twice about</h2><ul role="list">${vehicle.cons.map(item => `<li>${item}</li>`).join('')}</ul></section>
</div>
</section>

<section id="pay" class="vp-section vp-section--band">
<h2>${text.payHeading}</h2>
${paragraphs(vehicle.pay.intro)}
<div class="vp-pay-glass">
${dealCards(vehicle.pay, vehicle.trims.rows)}
${priceMath(walk)}
</div>
<p class="vp-note">${vehicle.pay.note}</p>
${paragraphs(vehicle.pay.after)}
</section>

<section id="reviews" class="vp-section">
<h2>What the reviewers say</h2>
${vehicle.scores.intro ? `<p>${vehicle.scores.intro}</p>\n` : ''}<ul class="vp-scorecard" role="list">
${vehicle.scores.cards.map(card => `<li><a href="${card.url}" rel="noopener">${card.source}</a><p class="vp-scorecard__score">${card.display}<span> out of ${card.scale}</span></p>${meter(card.value, card.scale)}<p class="vp-scorecard__detail">${card.detail}</p></li>`).join('\n')}
</ul>
<p class="vp-note">${vehicle.scores.note}</p>
</section>

<aside class="vp-cta" aria-label="Steer Me Right plans"><div><p><strong>Don’t overpay, or lose weeks calling dealers.</strong>We contact dozens of dealers, negotiate the price and fees, and bring you the offers.</p><p class="vp-cta__fine">From $395. Full refund if you cancel before negotiations begin.</p></div><a class="vp-cta__button" href="#plans">Let us do the work</a></aside>

<section id="trims" class="vp-section">
<h2>${text.trimsHeading}</h2>
${vehicle.trims.intro ? `${paragraphs(vehicle.trims.intro)}\n` : ''}<table class="vp-trims">
<caption class="sr-only">${text.trimsCaption}</caption>
<thead><tr><th scope="col">${text.trimsColumn}</th>${vehicle.trims.columns.map(column => `<th scope="col">${column}</th>`).join('')}</tr></thead>
<tbody>
${vehicle.trims.rows.map(trim => `<tr><th scope="row">${trim.name}${trim.pick ? ' <span class="vp-tag">Our pick</span>' : ''}<span>${trim.short}</span></th><td class="vp-trims__price"><span>${dollars(trim.prices[0])}</span>${meter(trim.prices[0], topPrice)}</td>${trim.prices.slice(1).map(price => `<td>${typeof price === 'string' ? price : price ? dollars(price) : ask}</td>`).join('')}</tr>`).join('\n')}
</tbody>
</table>
${paragraphs(vehicle.trims.after)}
<details class="vp-more"><summary>${text.trimsMore}</summary>
${table('trim-caption', text.trimsMoreCaption, [text.trimsColumn, ...vehicle.trims.columns, text.engineColumn],
    vehicle.trims.rows.map(trim => [`${trim.name}<span>${trim.gets}</span>`, ...trim.prices.map(price => typeof price === 'string' ? price : price ? `<strong>${dollars(price)}</strong>` : ask), trim.engine || ask]))}
</details>
</section>

<section id="pick" class="vp-section vp-section--band">
<h2>${text.pickHeading}</h2>
${paragraphs(vehicle.pick)}
</section>
${vehicle.spotlight ? `\n${spotlight(vehicle.spotlight, checked)}\n` : ''}
<section id="plans" class="vp-section vp-plans">
<h2>Pick how much help you want</h2>
<div class="vp-plans__grid">
${planCards.map(card => planCard(card, `vehicle-${vehicle.slug.replace(/-price\.html$/, '')}`)).join('\n')}
</div>
<p class="vp-note">You can upgrade to Steer Me Right Pro later by paying the $300 difference. The fee doesn’t cover the car, taxes or registration. <a href="/policy.html#refund-policy">Refund policy</a></p>
</section>

<section id="incentives" class="vp-section vp-section--band">
<h2>${text.incentivesHeading}</h2>
${paragraphs(vehicle.incentives.intro)}
<ul class="vp-ic-offers" role="list">
${vehicle.incentives.cards.map(card => `<li><p class="vp-ic-offers__label">${card.label}</p><p class="vp-ic-offers__big">${card.figure} <span>${card.word}</span></p><p class="vp-ic-offers__text">${card.text}</p></li>`).join('\n')}
</ul>
<p class="vp-note">${vehicle.incentives.note}</p>
${vehicle.incentives.choice ? cashOrRate(vehicle.incentives.choice) : ''}
${vehicle.incentives.addons.length ? `<div class="vp-ic-addons${vehicle.incentives.addons.length === 1 ? ' vp-ic-addons--one' : ''}">
${vehicle.incentives.addons.map(card => `<article><h3>${card.title}</h3><p>${card.text}</p><p class="vp-ic-addons__foot"><span><strong>${card.figure}</strong> ${card.unit}<span>${card.detail}</span></span><a href="${card.href}">${card.link}</a></p></article>`).join('\n')}
</div>\n` : ''}<details class="vp-more"><summary>${text.incentivesMore}</summary>
${table('incentive-caption', text.incentivesCaption, text.incentivesColumns,
    vehicle.incentives.rows.map(row => [row.offer, row.detail, row.applies, row.ends || ask]))}
</details>
</section>

<section id="new-used" class="vp-section">
<h2>${text.conditionHeading}</h2>
${paragraphs(vehicle.condition.intro)}
<div class="vp-charts">
${vehicle.condition.charts.map(chart => `<section><h3>${chart.title}</h3>
${bars(chart.bars)}
<p class="vp-charts__source">${chart.source}</p></section>`).join('\n')}
</div>
${paragraphs(vehicle.condition.after)}
<details class="vp-more"><summary>Which route fits you, and what to check</summary>
${table('condition-caption', text.conditionCaption, ['Route', 'Best when', 'What to check'],
    vehicle.condition.rows.map(row => [row.route, row.when, row.check]))}
</details>
</section>

<section id="rivals" class="vp-section vp-section--band">
<h2>Rivals worth pricing against it</h2>
${paragraphs(vehicle.rivals)}
</section>

<section id="watch" class="vp-section">
<h2>What to watch for at the dealer</h2>
<ul class="vp-watch" role="list">
${vehicle.watch.map(item => `<li>${item}</li>`).join('\n')}
</ul>
<p>Compare dealers on the whole price in writing. The free <a href="/compare-car-quotes.html">quote comparison worksheet</a> lines offers up side by side, and the <a href="/blog-dealership-addons-complete-guide.html">dealership add-ons guide</a> covers what to ask about each extra.</p>
</section>

<section id="faq" class="vp-section vp-section--band">
<h2>Common questions</h2>
${faq([
    ...vehicle.faq,
    [`Can you negotiate a ${text.negotiateName ?? name} for me?`, text.negotiate],
    ['Do dealers pay you?', 'No. Dealers and lenders pay us nothing. You pay the flat fee, and you’re the only one we work for.'],
    ['What if I change my mind?', 'Cancel before negotiations begin and you get a full refund. During negotiations, refund eligibility depends on the work already done. Read the <a href="/policy.html#refund-policy">refund policy</a>.'],
  ])}
</section>

<section id="safety" class="vp-section">
<h2>Safety report card</h2>
<div class="vp-safety">
<div class="vp-safety__overall"><p class="vp-safety__score">${vehicle.safety.overall}<span> ${vehicle.safety.outOf ? `of ${vehicle.safety.outOf}` : 'out of 5'}</span></p>${safetyMark(vehicle.safety)}<p>${vehicle.safety.label}</p><p class="vp-safety__vehicle">${vehicle.safety.vehicle}</p></div>
<dl class="vp-safety__tests">
${vehicle.safety.rows.map(row => `<div><dt>${row.label}</dt><dd>${row.grade ? `<span class="vp-grade__pair">${grade(row.grade)}</span>` : stars(row.stars)}${row.note ? `<span>${row.note}</span>` : ''}</dd></div>`).join('\n')}
</dl>
</div>
<div class="vp-recalls"><h3>${vehicle.safety.recallsTitle}</h3>
${columns(vehicle.safety.recalls)}
<p>${vehicle.safety.reliability}</p></div>
<p class="vp-note">${vehicle.safety.note}</p>
</section>

<section class="vp-sources" aria-labelledby="guide-sources"><h2 id="guide-sources">Sources and updates</h2><p>Written by <a href="/about.html">Mason</a>, Steer Me Right’s founder and lead advisor. Prices, incentives and market figures were checked on ${checked} and change often, so confirm them with the dealer before you sign. The discount ranges are our estimate from the sources below, not a promise. If something is out of date or wrong, email <a href="mailto:hello@steermeright.com">hello@steermeright.com</a> and we will correct it.</p>
<details class="vp-more"><summary>All ${vehicle.sources.length} sources</summary>
<ul>
${vehicle.sources.map(source => `<li><a href="${source.url}" rel="noopener">${source.title}</a>${source.note ? `: ${source.note}` : ''}</li>`).join('\n')}
</ul>
</details>
<p>Related: ${text.related}.</p>
${credits(vehicle.photo, vehicle.spotlight ? [...vehicle.gallery, vehicle.spotlight.photo] : vehicle.gallery)}</section>
</div>
</div>
</div>
</article>`;
  return { slug: vehicle.slug, title: vehicle.title, description: vehicle.description, h1: vehicle.h1, crumbs: [['Resources', `${origin}/blog.html`], [text.crumb, `${origin}/${vehicle.slug}`]], body };
}

// ---- Car-versus-car pages (data/comparison-pages.json), e.g. toyota-rav4-vs-honda-cr-v.html ----
// Each car's trims, photo and review scores come from its own entry in data/vehicle-pages.json (`cars[].slug`), so a
// price change there reaches the comparison on the next build. Everything else is in the comparison's own data.
// Charts use two colors, one per car (--car-a, --car-b in buying/versus.css), and always print the value beside the mark.
const key = side => `<span class="vs-key${side === 'b' ? ' vs-key--b' : ''}" aria-hidden="true"></span>`;
// Brand and source logos in assets/logos: [width, height] in pixels, and the name screen readers hear. CSS sets the shown height.
const logoFiles = {
  toyota: [151, 96, 'Toyota'], 'toyota-white': [151, 96, 'Toyota'], honda: [119, 96, 'Honda'], 'honda-white': [119, 96, 'Honda'],
  'rav4-white': [402, 64, 'RAV4'], 'cr-v-white': [379, 64, 'CR-V'], edmunds: [414, 72, 'Edmunds'], 'edmunds-icon': [107, 72, 'Edmunds'],
  reddit: [343, 96, 'Reddit'], 'reddit-icon': [72, 72, 'Reddit'], 'iihs-hldi': [178, 120, 'IIHS-HLDI'], nhtsa: [407, 96, 'NHTSA'],
  kbb: [399, 108, 'Kelley Blue Book'], 'us-news': [291, 72, 'U.S. News'], 'jd-power': [409, 60, 'J.D. Power'], 'consumer-reports': [376, 96, 'Consumer Reports'],
};
const logo = (name, { alt = logoFiles[name][2], cls = '', eager = false } = {}) => `<img class="vs-logo${cls ? ` ${cls}` : ''}" src="/assets/logos/${name}.webp" alt="${alt}" width="${logoFiles[name][0]}" height="${logoFiles[name][1]}" decoding="async"${eager ? '' : ' loading="lazy"'}>`;
// A section heading with the logos of the sources its figures come from, e.g. { label: 'Crash tests by', names: ['iihs-hldi', 'nhtsa'] }.
const sectionHead = (title, from) => from ? `<div class="vs-head"><h2>${title}</h2><p class="vs-from"><span>${from.label}</span>${from.names.map(name => logo(name)).join('')}</p></div>` : `<h2>${title}</h2>`;
const legend = cars => `<ul class="vs-legend" role="list">${cars.map(car => `<li>${key(car.side)}${car.short}</li>`).join('')}</ul>`;
const pct = (value, max) => `${Math.round((value / max) * 1000) / 10}%`;
// Paired bars. A null value prints "Not published" in place of a bar.
function pairChart(chart, cars) {
  const max = chart.max ?? Math.max(...chart.rows.flatMap(row => [row.a, row.b]).filter(value => typeof value === 'number'));
  const bar = (row, car) => {
    const value = row[car.side], text = row[`${car.side}Text`] ?? value;
    if (value === null || value === undefined) return `<span class="vs-bar vs-bar--none"><span class="vs-bar__who">${car.short}: </span>${text ?? 'Not published'}</span>`;
    return `<span class="vs-bar vs-bar--${car.side}"><span class="vs-bar__who">${car.short}: </span><i style="--w:${pct(value, max)}" aria-hidden="true"></i>${text}</span>`;
  };
  return `<section class="vs-chart">
<h3>${chart.title}</h3>
${chart.note ? `<p class="vs-chart__note">${chart.note}</p>\n` : ''}${legend(cars)}
<ul class="vs-pairs" role="list">
${chart.rows.map(row => `<li><span class="vs-pairs__label">${row.logo ? `<a href="${row.href}" rel="noopener">${logo(row.logo, { cls: 'vs-pairs__logo' })}</a>` : row.label}${row.sub ? `<small>${row.sub}</small>` : ''}</span><span class="vs-pairs__bars">${cars.map(car => bar(row, car)).join('')}</span></li>`).join('\n')}
</ul>
</section>`;
}
// Paired columns, one pair per model year.
function pairColumns(chart, cars) {
  const max = Math.max(...chart.rows.flatMap(row => [row.a, row.b]));
  return `<section class="vs-chart">
<h3>${chart.title}</h3>
${chart.note ? `<p class="vs-chart__note">${chart.note}</p>\n` : ''}${legend(cars)}
<ol class="vs-cols" role="list">
${chart.rows.map(row => `<li><span class="vs-cols__pair">${cars.map(car => `<span class="vs-cols__bar${car.side === 'b' ? ' vs-cols__bar--b' : ''}"><b><span class="sr-only">${car.short} </span>${row[`${car.side}Text`] ?? row[car.side]}</b><i style="--h:${Math.round((row[car.side] / max) * 1000) / 10}" aria-hidden="true"></i></span>`).join('')}</span><span class="vs-cols__label">${row.label}</span></li>`).join('\n')}
</ol>
</section>`;
}
// Both cars' trims in one table, cheapest first, from each car's starting MSRP in data/vehicle-pages.json. The picked trim is marked.
function trimTable(prices, cars) {
  const rows = cars.flatMap(car => car.vehicle.trims.rows.map(trim => ({ car, trim, price: trim.prices[0] }))).sort((x, y) => x.price - y.price);
  return `<section class="vs-chart">
<h3>${prices.title}</h3>
<p class="vs-chart__note">${prices.note}</p>
<details class="vp-more"><summary>Show all ${rows.length} trims and prices</summary>
${table('trims-caption', prices.caption, ['Trim', 'Car', 'Starting MSRP'], rows.map(({ car, trim, price }) => [`${trim.name}<span>${trim.name === car.pick ? '<b>The one we’d buy.</b> ' : ''}${trim.short}</span>`, `${key(car.side)} ${car.short}`, `<strong>${dollars(price)}</strong>`]))}
</details>
</section>`;
}
// What to pay for the trims we'd buy: each target range in data is percent under MSRP, turned into dollars here from the
// picked trim's starting MSRP in data/vehicle-pages.json (rounded to $50), so a price change there reaches the table.
function priceTargets(targets, cars) {
  const msrp = car => car.vehicle.trims.rows.find(trim => trim.name === car.pick).prices[0];
  const at = (car, percent) => dollars(Math.round((msrp(car) * (1 - percent / 100)) / 50) * 50);
  const range = (car, [low, high]) => `${at(car, high)}–${at(car, low).replace('$', '')}`;
  return `<section class="vs-chart">
<h3>${targets.title}</h3>
<p class="vs-chart__note">${targets.note}</p>
<div class="vp-scroll" role="region" aria-labelledby="targets-caption" tabindex="0">
<table class="vs-board vs-targets">
<caption id="targets-caption" class="sr-only">${targets.caption}</caption>
<thead><tr><td></td>${cars.map(car => `<th scope="col"><span>${key(car.side)}${car.short}</span><small>${car.pick}</small></th>`).join('')}</tr></thead>
<tbody>
<tr class="vs-targets__msrp"><th scope="row">Sticker price</th>${cars.map(car => `<td><strong>${dollars(msrp(car))}</strong></td>`).join('')}</tr>
${targets.rows.map(row => `<tr><th scope="row">${row.label}</th>${cars.map(car => `<td><strong>${range(car, row[car.side])}</strong><span>${row[car.side][0]}–${row[car.side][1]}% under sticker</span></td>`).join('')}</tr>`).join('\n')}
<tr class="vs-targets__paid"><th scope="row">${targets.paid.label}</th>${cars.map(car => `<td>${targets.paid[car.side]}</td>`).join('')}</tr>
</tbody>
</table>
</div>
</section>`;
}
// Net sentiment per topic, from −100 (all negative) to +100 (all positive), as worked out by scripts/reddit-sentiment.mjs.
// A car with fewer than `minimum` mentions on a topic shows its count instead of a bar.
function divergeChart(chart, cars, rows, minimum) {
  const net = (figure, car) => {
    if (figure.mentions < minimum || figure.net === null) return `<span class="vs-net vs-net--${car.side} vs-net--none"><span class="sr-only">${car.short}: </span><b>${figure.mentions} mentions, too few to score</b></span>`;
    const value = figure.net;
    return `<span class="vs-net vs-net--${car.side} vs-net--${value >= 0 ? 'pos' : 'neg'}" style="--w:${Math.abs(value)}%"><span class="sr-only">${car.short}: </span><i aria-hidden="true"></i><b>${value > 0 ? '+' : value < 0 ? '−' : ''}${Math.abs(value)}<span class="sr-only"> net, from ${figure.mentions} mentions</span></b></span>`;
  };
  return `<section class="vs-chart">
<h3>${chart.title}</h3>
<p class="vs-chart__note">${chart.note}</p>
${legend(cars)}
<ul class="vs-diverge" role="list">
${rows.map(row => `<li><span class="vs-diverge__label">${row.label}<small>${cars.map(car => `${car.short} ${row[car.side].mentions}`).join(' · ')} mentions</small></span><span class="vs-diverge__bars">${cars.map(car => net(row[car.side], car)).join('')}</span></li>`).join('\n')}
<li class="vs-diverge__axis" aria-hidden="true"><span></span><span><span>All negative</span><span>Even</span><span>All positive</span></span></li>
</ul>
</section>`;
}
// Who each venue tells people to buy: one split bar per venue (the cars' own subreddits and the neutral ones).
function splitBars(split, cars, venues) {
  const bar = row => {
    const picks = venues[row.venue].recommend, all = picks.a + picks.b;
    const share = side => Math.round((picks[side] / all) * 100);
    return `<div class="vs-split${row.venue === 'neutral' ? ' vs-split--lead' : ''}"><p class="vs-split__title">${row.label} <small>${all.toLocaleString('en-US')} picks in ${venues[row.venue].threads} threads</small></p>
<div class="vs-split__bar" role="img" aria-label="${row.label}: ${cars.map(car => `${car.short} ${share(car.side)}%`).join(', ')}">${cars.map(car => `<span style="--w:${share(car.side)}%">${share(car.side)}%</span>`).join('')}</div>
<p class="vs-split__labels" aria-hidden="true">${cars.map(car => `<span>${key(car.side)}${car.short} · ${picks[car.side]}</span>`).join('')}</p></div>`;
  };
  return `<section class="vs-chart">
<h3>${split.title}</h3>
<p class="vs-chart__note">${split.note}</p>
${split.rows.map(bar).join('\n')}
</section>`;
}

function comparisonPage(cmp, vehicles, updated, sentiment) {
  const checked = longDate(cmp.checkedOn);
  const cars = cmp.cars.map((car, index) => ({ ...car, side: index ? 'b' : 'a', vehicle: vehicles.find(vehicle => vehicle.slug === car.slug) }));
  for (const car of cars) if (!car.vehicle) throw new Error(`${cmp.slug}: no vehicle ${car.slug}`);
  const [a, b] = cars;
  const by = side => cars.find(car => car.side === side);
  const edge = win => win ? `<span class="vs-edge">${key(win)}<span>${by(win).short}</span></span>` : '<span class="vs-edge vs-edge--tie">Even</span>';
  const wins = side => cmp.board.filter(row => row.win === side).length;
  const r = cmp.reddit;
  const topicRows = Object.entries(sentiment.topics).map(([topic, figures]) => ({ label: sentimentTopics[topic], ...figures })).sort((x, y) => (y.a.mentions + y.b.mentions) - (x.a.mentions + x.b.mentions));
  const tabs = [['overview', 'Overview'], ['reddit', 'Reddit Sentiment Index'], ['price', 'Price'], ['mpg', 'Fuel economy'], ['space', 'Space and power'], ['reliability', 'Reliability'], ['resale', 'Resale and used'], ['safety', 'Safety'], ['faq', 'Questions']];
  const charts = list => list.map(chart => chart.type === 'cols' ? pairColumns(chart, cars) : pairChart(chart, cars)).join('\n');
  const body = `<article class="vp vs">
<header class="vp-head vp-width">
<p class="vp-crumb"><a href="/blog.html">Resources</a> / ${cmp.crumb}</p>
<h1>${cmp.h1}</h1>
<p class="vp-byline">By <a href="/about.html">Mason</a> · Updated <time datetime="${updated}">${longDate(updated)}</time></p>
</header>
<nav class="vp-tabs" aria-label="Article contents"><ul class="vp-width" role="list">${tabs.map(([id, label]) => `<li><a href="#${id}">${label}</a></li>`).join('')}</ul></nav>

<div class="vp-stage">
<div class="vp-layout vp-width">
<div class="vp-hero">
<div class="vs-photos">
${cars.map(car => `<figure>${picture(car.vehicle.photo, [640, 960, 1600], '(max-width: 760px) 94vw, (max-width: 1000px) 47vw, 340px', true)}<figcaption>${key(car.side)}${car.logos ? `<strong class="vs-photos__brand">${logo(`${car.logos.make}-white`, { alt: '', cls: 'vs-photos__make', eager: true })}${logo(`${car.logos.model}-white`, { alt: car.name, cls: 'vs-photos__model', eager: true })}</strong>` : `<strong>${car.name}</strong>`}</figcaption></figure>`).join('\n')}
</div>
<ul class="vp-strip" role="list">
${cmp.strip.map(item => `<li><a href="#${item.section}"><span class="vp-strip__source">${item.logo ? logo(item.logo, { alt: '', cls: 'vp-strip__logo', eager: true }) : ''}${item.label}</span><span class="vp-strip__score">${item.value}</span></a></li>`).join('\n')}
</ul>
</div>

<aside class="vp-rail">
<p class="vs-glance__cars">${cars.map(car => `<span>${key(car.side)}${car.logos ? logo(car.logos.make, { alt: '', cls: 'vs-glance__make', eager: true }) : ''}${car.short}</span>`).join('')}</p>
<ul class="vs-glance" role="list" aria-label="${a.short} and ${b.short} at a glance">
${cmp.glance.map(row => `<li><a href="#${row.section}"><span class="vs-glance__label">${row.label}</span><span class="vs-glance__pair">${cars.map(car => `<span><span class="sr-only">${car.short}: </span>${row[car.side]}</span>`).join('')}</span></a></li>`).join('\n')}
</ul>
<a class="vp-button" href="#plans">Have us price both</a>
<p class="vp-rail__fine">Dealers and lenders pay us nothing.</p>
</aside>

<div class="vp-body">
<section id="overview" class="vp-section vp-section--first">
<p class="vp-lead">${cmp.summary}</p>
<div class="vp-verdict vs-verdict">
${cars.map(car => `<section><h2>${key(car.side)} Buy the ${car.short} if…</h2><ul role="list">${cmp.choose[car.side].map(item => `<li>${item}</li>`).join('')}</ul></section>`).join('\n')}
</div>
<h3 class="vs-board__title" style="margin-top:34px">Head to head</h3>
<div class="vp-scroll" role="region" aria-labelledby="board-caption" tabindex="0">
<table class="vs-board">
<caption id="board-caption" class="sr-only">${a.name} and ${b.name} compared by category, checked ${checked}</caption>
<thead><tr><th scope="col">Category</th>${cars.map(car => `<th scope="col"><span>${key(car.side)}${car.short}</span></th>`).join('')}<th scope="col">Edge</th></tr></thead>
<tbody>
${cmp.board.map(row => `<tr><th scope="row"><a href="#${row.section}">${row.label}</a></th>${cars.map(car => `<td${row.win === car.side ? ' class="vs-win"' : ''}>${row[car.side]}</td>`).join('')}<td>${edge(row.win)}</td></tr>`).join('\n')}
</tbody>
</table>
</div>
<div class="vs-tally">${cars.map(car => `<p>${key(car.side)}<strong>${wins(car.side)}</strong><span>categories to the ${car.short}</span></p>`).join('')}</div>
<div id="reviews">${pairChart(cmp.reviews, cars)}</div>
</section>

<section id="reddit" class="vp-section vp-section--band">
${sectionHead('Reddit Sentiment Index', r.from)}
${paragraphs(r.intro)}
<div class="vs-index">
${cars.map(car => `<div><p class="vs-index__car">${key(car.side)}${car.name}</p><p class="vs-index__score">${sentiment.index[car.side]}<small> / 100</small></p><div class="vs-index__scale" aria-hidden="true"><i style="--w:${sentiment.index[car.side]}%"></i></div><p class="vs-index__ends" aria-hidden="true"><span>All negative</span><span>50 = even</span><span>All positive</span></p><p class="vs-index__detail">${r.indexDetail[car.side]}</p></div>`).join('\n')}
</div>
${splitBars(r.split, cars, sentiment.venues)}
${divergeChart(r.topics, cars, topicRows, r.minimum)}
<div class="vs-themes">
${cars.map(car => `<section><h3>${key(car.side)}What Reddit says about the ${car.short}</h3><h4>Praised most for</h4><ul role="list">${r.themes[car.side].praise.map(item => `<li>${item}</li>`).join('')}</ul><h4>Criticized most for</h4><ul class="vs-themes__neg" role="list">${r.themes[car.side].gripes.map(item => `<li>${item}</li>`).join('')}</ul></section>`).join('\n')}
</div>
${paragraphs(r.after)}
</section>

<section id="price" class="vp-section">
<h2>Price, and how far under sticker each sells</h2>
${paragraphs(cmp.price.intro)}
${trimTable({ ...cmp.price.trims, caption: `${a.name} and ${b.name} trims by starting MSRP, checked ${checked}` }, cars.map(car => ({ ...car, pick: cmp.price.picks[car.side] })))}
${priceTargets({ ...cmp.price.targets, caption: `What to pay for the ${a.name} ${cmp.price.picks.a} and ${b.name} ${cmp.price.picks.b}, checked ${checked}` }, cars.map(car => ({ ...car, pick: cmp.price.picks[car.side] })))}
${charts(cmp.price.charts)}
${paragraphs(cmp.price.after)}
</section>

<section id="mpg" class="vp-section vp-section--band">
<h2>Fuel economy and running costs</h2>
${paragraphs(cmp.mpg.intro)}
${charts(cmp.mpg.charts)}
${paragraphs(cmp.mpg.after)}
</section>

<aside class="vp-cta" aria-label="Steer Me Right plans"><div><p><strong>Still torn? We’ll price both.</strong>Steer Me Right Pro gets written offers on up to three models from dealers that have them in stock, negotiates them, and gives you our pick.</p><p class="vp-cta__fine">$695 one-time. Full refund if you cancel before negotiations begin.</p></div><a class="vp-cta__button" href="#plans">See the plans</a></aside>

<section id="space" class="vp-section">
<h2>Space, power and towing</h2>
${paragraphs(cmp.space.intro)}
${charts(cmp.space.charts)}
${paragraphs(cmp.space.after)}
</section>

<section id="reliability" class="vp-section vp-section--band">
${sectionHead('Expected reliability', cmp.reliability.from)}
${paragraphs(cmp.reliability.intro)}
<h3 style="margin-top:24px">Reliability signals</h3>
<ul class="vs-signals" role="list">
<li><span>Signal</span>${cars.map(car => `<span>${key(car.side)} ${car.short}</span>`).join('')}<span>Favors</span></li>
${cmp.reliability.signals.map(row => `<li><span>${row.label}${row.note ? `<small>${row.note}</small>` : ''}</span>${cars.map(car => `<span><span class="sr-only">${car.short}: </span>${row[car.side]}</span>`).join('')}${edge(row.win)}</li>`).join('\n')}
</ul>
<div class="vs-tally">${cars.map(car => `<p>${key(car.side)}<strong>${cmp.reliability.signals.filter(row => row.win === car.side).length}</strong><span>of ${cmp.reliability.signals.length} signals favor the ${car.short}</span></p>`).join('')}</div>
${charts(cmp.reliability.charts)}
<h3 style="margin-top:28px">Known problems worth checking</h3>
<ul class="vs-issues" role="list">
${cmp.reliability.issues.map(issue => `<li><strong>${key(issue.car)}${issue.title}</strong>${issue.text}</li>`).join('\n')}
</ul>
${paragraphs(cmp.reliability.after)}
</section>


<section id="resale" class="vp-section">
<h2>Resale value and buying used</h2>
${paragraphs(cmp.resale.intro)}
${charts(cmp.resale.charts)}
${paragraphs(cmp.resale.after)}
</section>

<section id="safety" class="vp-section vp-section--band">
${sectionHead('Safety', cmp.safety.from)}
${paragraphs(cmp.safety.intro)}
<div class="vp-scroll" role="region" aria-labelledby="safety-caption" tabindex="0">
<table class="vs-board">
<caption id="safety-caption" class="sr-only">${a.name} and ${b.name} crash-test results, checked ${checked}</caption>
<thead><tr><th scope="col">Test</th>${cars.map(car => `<th scope="col"><span>${key(car.side)}${car.short}</span></th>`).join('')}<th scope="col">Edge</th></tr></thead>
<tbody>
${cmp.safety.rows.map(row => `<tr><th scope="row">${row.label}</th>${cars.map(car => `<td${row.win === car.side ? ' class="vs-win"' : ''}>${row[car.side]}</td>`).join('')}<td>${edge(row.win)}</td></tr>`).join('\n')}
</tbody>
</table>
</div>
${charts(cmp.safety.charts)}
</section>

<section id="plans" class="vp-section vp-plans">
<h2>Let us price both for you</h2>
<p>${cmp.plansIntro}</p>
<div class="vp-plans__grid">
${planCards.map(card => planCard(card, `comparison-${cmp.slug.replace(/\.html$/, '')}`)).join('\n')}
</div>
<p class="vp-note">You can upgrade to Steer Me Right Pro later by paying the $300 difference. The fee doesn’t cover the car, taxes or registration. <a href="/policy.html#refund-policy">Refund policy</a></p>
</section>

<section id="faq" class="vp-section vp-section--band">
<h2>Common questions</h2>
${faq([
    ...cmp.faq,
    [`Can you get me prices on both the ${a.short} and the ${b.short}?`, `Yes. Steer Me Right Pro is $695 and covers up to three models: we find each in dealer stock, get written out-the-door offers, negotiate for a price below MSRP and give you our pick. Steer Me Right is $395 for one model. We can’t promise a specific discount: the market for a given car sets what a dealer will do.`],
    ['Do dealers pay you?', 'No. Dealers and lenders pay us nothing. You pay the flat fee, and you’re the only one we work for.'],
    ['What if I change my mind?', 'Cancel before negotiations begin and you get a full refund. During negotiations, refund eligibility depends on the work already done. Read the <a href="/policy.html#refund-policy">refund policy</a>.'],
  ])}
</section>

<section class="vp-sources" aria-labelledby="guide-sources"><h2 id="guide-sources">Sources and updates</h2><p>Written by <a href="/about.html">Mason</a>, Steer Me Right’s founder and lead advisor. Prices, incentives and market figures were checked on ${checked} and change often, so confirm them with the dealer before you sign. The discount ranges are our estimate from the sources below, not a promise. The Reddit Sentiment Index is our own reading of public comments, not a survey of owners. NHTSA complaints are unverified owner reports: a higher rate is a reason to look closer, not proof of a defect. If something is out of date or wrong, email <a href="mailto:hello@steermeright.com">hello@steermeright.com</a> and we will correct it.</p>
<details class="vp-more"><summary>All ${cmp.sources.length} sources</summary>
<ul>
${cmp.sources.map(source => `<li><a href="${source.url}" rel="noopener">${source.title}</a>${source.note ? `: ${source.note}` : ''}</li>`).join('\n')}
</ul>
</details>
<p>Related: ${cars.map(car => `<a href="/${car.slug}">${car.short} price guide</a>`).join(', ')}, ${cmp.related}.</p>
<details class="vp-credits"><summary>Photo credits</summary>
<ul>${cars.map(car => credit(car.name, car.vehicle.photo)).join('')}</ul>
</details></section>
</div>
</div>
</div>
</article>`;
  return { slug: cmp.slug, title: cmp.title, description: cmp.description, h1: cmp.h1, crumbs: [['Resources', `${origin}/blog.html`], [cmp.crumb, `${origin}/${cmp.slug}`]], body };
}

const versusSheet = 'buying/versus.css';
const sheetLink = (file, css) => `<link rel="stylesheet" href="/${file}?v=${createHash('sha256').update(css).digest('hex').slice(0, 12)}">`;

export async function renderVehiclePages() {
  const [chrome, data, comparisons, css, versusCss] = await Promise.all([read(chromePage), read('data/vehicle-pages.json').then(JSON.parse), read('data/comparison-pages.json').then(JSON.parse), readFile(path.join(root, stylesheet)), readFile(path.join(root, versusSheet))]);
  const link = sheetLink(stylesheet, css);
  const pages = data.vehicles.map(vehicle => {
    const page = vehiclePage(vehicle, data.updated);
    const html = shell(chrome, { ...page, published: vehicle.published, updated: data.updated }, page.body);
    return { slug: page.slug, html: html.replace('</head>', `    ${link}\n</head>`) };
  });
  for (const cmp of comparisons.comparisons) {
    const sentiment = summarize(JSON.parse(await read(cmp.reddit.dataFile)));
    const page = comparisonPage(cmp, data.vehicles, comparisons.updated, sentiment);
    const html = shell(chrome, { ...page, published: cmp.published, updated: comparisons.updated }, page.body);
    pages.push({ slug: page.slug, html: html.replace('</head>', `    ${link}\n    ${sheetLink(versusSheet, versusCss)}\n</head>`) });
  }
  return pages;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const check = process.argv.includes('--check');
  let stale = 0;
  for (const { slug, html } of await renderVehiclePages()) {
    if (check) {
      const current = await read(slug).catch(() => null);
      if (current !== html) { stale++; console.error(`${slug} is out of date. Run npm run build:vehicles.`); }
    } else {
      await writeFile(path.join(root, slug), html);
      console.log(`wrote ${slug}`);
    }
  }
  if (stale) process.exit(1);
  if (check) console.log('Vehicle price pages match data/vehicle-pages.json.');
}
