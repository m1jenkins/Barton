// Builds the vehicle price pages (<make>-<model>-price.html) from data/vehicle-pages.json.
// The page chrome and the plan cards come from render-market-pages.mjs, so asset hashes follow
// car-negotiation-service.html. Run `npm run build:vehicles` after changing the data, this script,
// buying/price-guide.css or the chrome page; `npm run check:vehicles` fails when the files drift.
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { shell } from './render-market-pages.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const origin = 'https://www.steermeright.com';
const chromePage = 'car-negotiation-service.html';
const stylesheet = 'buying/price-guide.css';
const read = file => readFile(path.join(root, file), 'utf8');
const longDate = iso => new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
const dollars = value => `$${value.toLocaleString('en-US')}`;
const paragraphs = list => list.map(text => `<p>${text}</p>`).join('\n');
const faq = entries => `<div class="vp-faq">\n${entries.map(([question, answer]) => `<details><summary>${question}</summary><p>${answer}</p></details>`).join('\n')}\n</div>`;

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

// Photos are licensed (Wikimedia Commons). Each one is credited by name in the line under the gallery.
const credit = (label, image) => `<span>${label}: <a href="${image.sourceUrl}" rel="noopener">${image.author}</a>, ${image.licenseUrl ? `<a href="${image.licenseUrl}" rel="noopener">${image.license}</a>` : image.license}${image.note ? `, ${image.note}` : ''}</span>`;
const picture = (image, widths, sizes, priority) => `<picture>${['avif', 'webp'].map(type => `<source type="image/${type}" srcset="${widths.map(width => `/assets/external/optimized/${image.file}-${width}.${type} ${width}w`).join(', ')}" sizes="${sizes}">`).join('')}<img src="/assets/external/source/${image.file}-original.jpg" alt="${image.alt}" width="${image.width}" height="${image.height}" decoding="async"${priority ? ' fetchpriority="high"' : ' loading="lazy"'}></picture>`;
// One large photo with the smaller ones stacked beside it.
const gallery = (main, rest) => `<div class="vp-gallery">
<figure class="vp-gallery__main">${picture(main, [640, 960, 1600], '(max-width: 1000px) 94vw, 680px', true)}<figcaption>${main.caption}</figcaption></figure>
${rest.map(item => `<figure>${picture(item, [480, 960], '(max-width: 1000px) 24vw, 180px', false)}<figcaption>${item.caption}</figcaption></figure>`).join('\n')}
</div>
<p class="vp-credits">Photos. ${[credit('Main', main), ...rest.map(item => credit(item.caption, item))].join(' · ')}</p>`;

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
// Room to negotiate as three pips beside the word.
const roomLevels = { 'Little to none': 0, Thin: 1, Moderate: 2, Good: 3 };
const room = label => `${label in roomLevels ? `<span class="vp-pips" aria-hidden="true">${[1, 2, 3].map(step => `<i${step <= roomLevels[label] ? ' class="on"' : ''}></i>`).join('')}</span>` : ''}${label}`;
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

function vehiclePage(vehicle, updated) {
  const checked = longDate(vehicle.checkedOn);
  const name = vehicle.name;
  const ask = `<a href="/schedule.html">Ask us</a>`;
  const topPrice = Math.max(...vehicle.trims.rows.map(trim => trim.prices[0]));
  const walk = vehicle.pay.walk;
  const tabs = [['overview', 'Overview'], ['reviews', 'Review scores'], ['safety', 'Safety'], ['trims', 'Trims and MSRP'], ['pick', 'Our pick'], ['pay', 'What to pay'], ['incentives', 'Incentives'], ['new-used', 'New, used or CPO'], ['watch', 'What to watch for'], ['faq', 'Questions']];
  const body = `<article class="vp">
<header class="vp-head vp-width">
<p class="vp-crumb"><a href="/blog.html">Resources</a> / ${name} price</p>
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

<section id="reviews" class="vp-section">
<h2>What the reviewers say</h2>
${vehicle.scores.intro ? `<p>${vehicle.scores.intro}</p>\n` : ''}<ul class="vp-scorecard" role="list">
${vehicle.scores.cards.map(card => `<li><a href="${card.url}" rel="noopener">${card.source}</a><p class="vp-scorecard__score">${card.display}<span> out of ${card.scale}</span></p>${meter(card.value, card.scale)}<p class="vp-scorecard__detail">${card.detail}</p></li>`).join('\n')}
</ul>
<p class="vp-note">${vehicle.scores.note}</p>
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

<aside class="vp-cta" aria-label="Steer Me Right plans"><div><p><strong>Don’t overpay, or lose weeks calling dealers.</strong>We contact dozens of dealers, negotiate the price and fees, and bring you the offers.</p><p class="vp-cta__fine">From $395. Full refund if you cancel before negotiations begin.</p></div><a class="vp-cta__button" href="#plans">Let us do the work</a></aside>

<section id="trims" class="vp-section">
<h2>${vehicle.modelYear} ${name} trims and MSRP</h2>
${vehicle.trims.intro ? `${paragraphs(vehicle.trims.intro)}\n` : ''}<table class="vp-trims">
<caption class="sr-only">${vehicle.modelYear} ${name} starting MSRP by trim, checked ${checked}</caption>
<thead><tr><th scope="col">Trim</th>${vehicle.trims.columns.map(column => `<th scope="col">${column}</th>`).join('')}<th scope="col">Room to negotiate</th></tr></thead>
<tbody>
${vehicle.trims.rows.map(trim => `<tr><th scope="row">${trim.name}${trim.pick ? ' <span class="vp-tag">Our pick</span>' : ''}<span>${trim.short}</span></th><td class="vp-trims__price"><span>${dollars(trim.prices[0])}</span>${meter(trim.prices[0], topPrice)}</td>${trim.prices.slice(1).map(price => `<td>${price ? dollars(price) : ask}</td>`).join('')}<td class="vp-trims__room">${room(trim.roomLabel)}</td></tr>`).join('\n')}
</tbody>
</table>
<p class="vp-note">${vehicle.trims.note}</p>
${paragraphs(vehicle.trims.after)}
<details class="vp-more"><summary>Engines and what each trim adds</summary>
${table('trim-caption', `${vehicle.modelYear} ${name} trims with starting MSRP, checked ${checked}`, ['Trim', ...vehicle.trims.columns, 'Engines', 'Room to negotiate'],
    vehicle.trims.rows.map(trim => [`${trim.name}<span>${trim.gets}</span>`, ...trim.prices.map(price => price ? `<strong>${dollars(price)}</strong>` : ask), trim.engine || ask, trim.room || ask]))}
</details>
</section>

<section id="pick" class="vp-section">
<h2>The trim we’d buy</h2>
${paragraphs(vehicle.pick)}
</section>

<section id="pay" class="vp-section">
<h2>What to pay: how far under MSRP</h2>
${paragraphs(vehicle.pay.intro)}
<div class="vp-ledgers">
<div class="vp-sticker">
<h3 id="discount-caption">${vehicle.pay.tableTitle}</h3>
<table aria-labelledby="discount-caption">
<thead><tr><th scope="col">Trim</th><th scope="col">Fair deal</th><th scope="col">Strong deal</th></tr></thead>
<tbody>
${vehicle.pay.rows.map(row => `<tr><th scope="row">${row.trims}</th><td>${row.fair}</td><td>${row.strong}</td></tr>`).join('\n')}
</tbody>
</table>
</div>
<div class="vp-sticker">
<h3>${walk.title}</h3>
<p class="vp-sticker__split" aria-hidden="true"><span style="--w:${percent(walk.total, walk.sticker)}"></span>${walk.steps.map(step => `<span style="--w:${percent(step.amount, walk.sticker)}"></span>`).join('')}</p>
<dl>
<div><dt>${walk.stickerLabel}</dt><dd>${dollars(walk.sticker)}</dd></div>
${walk.steps.map(step => `<div class="vp-sticker__cut"><dt>${step.label}</dt><dd>−${dollars(step.amount)}</dd></div>`).join('\n')}
<div class="vp-sticker__total"><dt>${walk.totalLabel}</dt><dd>${dollars(walk.total)}</dd></div>
</dl>
</div>
</div>
<p class="vp-note">${vehicle.pay.note}</p>
${paragraphs(vehicle.pay.after)}
</section>

<section id="plans" class="vp-section vp-plans">
<h2>Pick how much help you want</h2>
<div class="vp-plans__grid">
${planCards.map(card => planCard(card, `vehicle-${vehicle.slug.replace(/-price\.html$/, '')}`)).join('\n')}
</div>
<p class="vp-note">You can upgrade to Steer Me Right Pro later by paying the $300 difference. The fee doesn’t cover the car, taxes or registration. <a href="/policy.html#refund-policy">Refund policy</a></p>
</section>

<section id="incentives" class="vp-section">
<h2>${name} incentives right now</h2>
${paragraphs(vehicle.incentives.intro)}
<ul class="vp-ic-offers" role="list">
${vehicle.incentives.cards.map(card => `<li><p class="vp-ic-offers__label">${card.label}</p><p class="vp-ic-offers__big">${card.figure} <span>${card.word}</span></p><p class="vp-ic-offers__text">${card.text}</p></li>`).join('\n')}
</ul>
<p class="vp-note">${vehicle.incentives.note}</p>
${cashOrRate(vehicle.incentives.choice)}
<div class="vp-ic-addons${vehicle.incentives.addons.length === 1 ? ' vp-ic-addons--one' : ''}">
${vehicle.incentives.addons.map(card => `<article><h3>${card.title}</h3><p>${card.text}</p><p class="vp-ic-addons__foot"><span><strong>${card.figure}</strong> ${card.unit}<span>${card.detail}</span></span><a href="${card.href}">${card.link}</a></p></article>`).join('\n')}
</div>
<details class="vp-more"><summary>Every offer, with dates and regions</summary>
${table('incentive-caption', `Manufacturer offers on the ${name}, checked ${checked}`, ['Offer', 'What it is', 'Applies to', 'Ends'],
    vehicle.incentives.rows.map(row => [row.offer, row.detail, row.applies, row.ends || ask]))}
</details>
</section>

<section id="new-used" class="vp-section">
<h2>New, used or CPO?</h2>
${paragraphs(vehicle.condition.intro)}
<div class="vp-charts">
${vehicle.condition.charts.map(chart => `<section><h3>${chart.title}</h3>
${bars(chart.bars)}
<p class="vp-charts__source">${chart.source}</p></section>`).join('\n')}
</div>
${paragraphs(vehicle.condition.after)}
<details class="vp-more"><summary>Which route fits you, and what to check</summary>
${table('condition-caption', `Buying a ${name} new, certified pre-owned or used`, ['Route', 'Best when', 'What to check'],
    vehicle.condition.rows.map(row => [row.route, row.when, row.check]))}
</details>
</section>

<section id="rivals" class="vp-section">
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

<section id="faq" class="vp-section">
<h2>Common questions</h2>
${faq([
    ...vehicle.faq,
    [`Can you negotiate a ${name} for me?`, `Yes. Steer Me Right charges a flat $395 for one model or $695 for up to three. We find it in dealer stock, get written out-the-door offers and negotiate for a price below MSRP. We can’t promise a specific discount: the market for a given car sets what a dealer will do.`],
    ['Do dealers pay you?', 'No. Dealers and lenders pay us nothing. You pay the flat fee, and you’re the only one we work for.'],
    ['What if I change my mind?', 'Cancel before negotiations begin and you get a full refund. During negotiations, refund eligibility depends on the work already done. Read the <a href="/policy.html#refund-policy">refund policy</a>.'],
  ])}
</section>

<section class="vp-sources" aria-labelledby="guide-sources"><h2 id="guide-sources">Sources and updates</h2><p>Written by <a href="/about.html">Mason</a>, Steer Me Right’s founder and lead advisor. Prices, incentives and market figures were checked on ${checked} and change often, so confirm them with the dealer before you sign. The discount ranges are our estimate from the sources below, not a promise. If something is out of date or wrong, email <a href="mailto:hello@steermeright.com">hello@steermeright.com</a> and we will correct it.</p>
<details class="vp-more"><summary>All ${vehicle.sources.length} sources</summary>
<ul>
${vehicle.sources.map(source => `<li><a href="${source.url}" rel="noopener">${source.title}</a>${source.note ? `: ${source.note}` : ''}</li>`).join('\n')}
</ul>
</details>
<p>Related: <a href="/new-car-buying-service.html">new car buying service</a>, <a href="/blog-buy-new-car-below-msrp.html">comparing complete new-car quotes</a> and <a href="/car-negotiation-service.html">car negotiation service</a>.</p></section>
</div>
</div>
</div>
</article>`;
  return { slug: vehicle.slug, title: vehicle.title, description: vehicle.description, h1: vehicle.h1, crumbs: [['Resources', `${origin}/blog.html`], [`${name} price`, `${origin}/${vehicle.slug}`]], body };
}

export async function renderVehiclePages() {
  const [chrome, data, css] = await Promise.all([read(chromePage), read('data/vehicle-pages.json').then(JSON.parse), readFile(path.join(root, stylesheet))]);
  const link = `<link rel="stylesheet" href="/${stylesheet}?v=${createHash('sha256').update(css).digest('hex').slice(0, 12)}">`;
  return data.vehicles.map(vehicle => {
    const page = vehiclePage(vehicle, data.updated);
    const html = shell(chrome, { ...page, published: vehicle.published, updated: data.updated }, page.body);
    return { slug: page.slug, html: html.replace('</head>', `    ${link}\n</head>`) };
  });
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
