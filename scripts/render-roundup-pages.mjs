// Builds the roundup pages (best-compact-suvs.html, best-hybrid-suvs-under-35000.html, cheapest-new-pickup-trucks.html)
// from data/roundup-pages.json. Prices, trims, photos, review scores, EPA-style notes and discount ranges for the cars that
// have a price guide are read from data/vehicle-pages.json at build time, so a price change there reaches these pages on the
// next build. The page chrome comes from render-market-pages.mjs (car-negotiation-service.html's head, header and footer).
// Run `npm run build:roundups` after changing the data, this script, buying/roundup.css, buying/price-guide.css or the chrome
// page; `npm run check:roundups` fails when the files drift.
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { shell, askMason } from './render-market-pages.mjs';
import { summarizeCar } from './reddit-sentiment.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const origin = 'https://www.steermeright.com';
const chromePage = 'car-negotiation-service.html';
const sheets = ['buying/price-guide.css', 'buying/roundup.css'];
const read = file => readFile(path.join(root, file), 'utf8');
const longDate = iso => new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
export const dollars = value => `$${value.toLocaleString('en-US')}`;
const paragraphs = list => list.map(text => `<p>${text}</p>`).join('\n');
const faq = entries => `<div class="vp-faq">\n${entries.map(([question, answer]) => `<details><summary>${question}</summary><p>${answer}</p></details>`).join('\n')}\n</div>`;

// ---- helpers copied from render-vehicle-pages.mjs (that file is not edited by this family; keep them in step) ----
const credit = (label, image) => `<li>${label}: <a href="${image.sourceUrl}" rel="noopener">${image.author}</a>, ${image.licenseUrl ? `<a href="${image.licenseUrl}" rel="noopener">${image.license}</a>` : image.license}${image.note ? `, ${image.note}` : ''}</li>`;
const picture = (image, widths, sizes) => `<picture>${['avif', 'webp'].map(type => `<source type="image/${type}" srcset="${widths.map(width => `/assets/external/optimized/${image.file}-${width}.${type} ${width}w`).join(', ')}" sizes="${sizes}">`).join('')}<img src="/assets/external/source/${image.file}-original.jpg" alt="${image.alt}" width="${image.width}" height="${image.height}" decoding="async" loading="lazy"></picture>`;
const percent = (value, max) => `${Math.round((value / max) * 1000) / 10}%`;
const meter = (value, max) => `<span class="vp-meter" aria-hidden="true"><span style="--w:${percent(value, max)}"></span></span>`;
const bars = rows => { const max = Math.max(...rows.map(row => row.value)); return `<ul class="vp-bars" role="list">
${rows.map(row => `<li><span class="vp-bars__label">${row.label}</span>${meter(row.value, max)}<span class="vp-bars__value">${row.display ?? row.value}</span></li>`).join('\n')}
</ul>`; };
function table(id, caption, head, rows, cls = 'vp-table') {
  return `<div class="vp-scroll" role="region" aria-labelledby="${id}" tabindex="0">
<table class="${cls}">
<caption id="${id}" class="sr-only">${caption}</caption>
<thead><tr>${head.map(cell => `<th scope="col">${cell}</th>`).join('')}</tr></thead>
<tbody>
${rows.map(([first, ...rest]) => `<tr><th scope="row">${first}</th>${rest.map(cell => `<td>${cell}</td>`).join('')}</tr>`).join('\n')}
</tbody>
</table>
</div>`;
}
// Short versions of the Steer Me Right and Pro cards (see planCards in render-vehicle-pages.mjs). The buttons link to
// the cards on the homepage and carry data-service-tier, which script.js turns into checkout. Do not add data-plan.
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

// ---- data lookups ----
const carSentimentFile = vehicle => `data/reddit-sentiment/cars/${vehicle.slug.replace(/-price\.html$/, '')}.json`;
function trimPrice(vehicle, name, col = 0) {
  const trim = vehicle.trims.rows.find(row => row.name === name);
  if (!trim) throw new Error(`${vehicle.slug} has no trim "${name}"`);
  const price = trim.prices[col];
  if (typeof price !== 'number') throw new Error(`${vehicle.slug} trim "${name}" has no price in column ${col}`);
  return price;
}
const dealText = text => /under$/.test(text) ? `${text} MSRP` : text;

// Everything a page needs about one entry, worked out from its own data plus the price guide: start and pick prices, with
// destination, the guide's scores and discount row, and the head-to-head pages that exist for the car.
function resolve(entry, vehicles, comparisons) {
  const guide = entry.guide ? vehicles.find(vehicle => vehicle.slug === entry.guide) : null;
  if (entry.guide && !guide) throw new Error(`${entry.key}: no price guide ${entry.guide}`);
  const col = entry.col ?? 0;
  const price = (spec, trim, msrp) => msrp ?? trimPrice(guide, trim, col);
  const out = { ...entry, guideData: guide };
  if (entry.startTrim || entry.startMsrp) out.start = { trim: entry.startTrim, msrp: price(entry, entry.startTrim, entry.startMsrp) };
  if (entry.pickTrim) out.pick = { trim: entry.pickTrim, msrp: price(entry, entry.pickTrim, entry.pickMsrp) };
  if (entry.baseTrim) out.base = { trim: entry.baseTrim, msrp: trimPrice(guide, entry.baseTrim, col) };
  if (entry.buyTrim) out.buy = { trim: entry.buyTrim, msrp: trimPrice(guide, entry.buyTrim, col) };
  if (out.base && !out.start) out.start = out.base;
  if (entry.offers) out.offers = entry.offers.map(offer => ({ ...offer, msrp: offer.msrp ?? trimPrice(guide, offer.trim, col) + (offer.add ?? 0) }));
  if (guide) {
    if (entry.payRow !== undefined) {
      const row = guide.pay.rows[entry.payRow];
      if (!row) throw new Error(`${entry.key}: no pay row ${entry.payRow}`);
      out.pay = row;
    }
    out.versus = comparisons.filter(cmp => cmp.cars.some(car => car.slug === guide.slug));
  }
  return out;
}

// Prose can say {{start:key}}, {{startAll:key}} (with destination), {{pick:key}}, {{pickAll:key}}, {{base:key}}, {{baseAll:key}},
// {{dest:key}} or {{offer:key:i}} (offer i with destination), so numbers follow the data.
function filler(entries) {
  const byKey = Object.fromEntries(entries.map(entry => [entry.key, entry]));
  return text => text.replace(/\{\{([a-zA-Z]+):([a-z0-9-]+)(?::(\d+))?\}\}/g, (all, kind, key, index) => {
    const entry = byKey[key];
    if (!entry) throw new Error(`{{${kind}:${key}}} names no entry`);
    const pick = name => { if (!entry[name]) throw new Error(`{{${kind}:${key}}}: ${key} has no ${name}`); return entry[name].msrp; };
    switch (kind) {
      case 'start': return dollars(pick('start'));
      case 'startAll': return dollars(pick('start') + entry.dest);
      case 'pick': return dollars(pick('pick'));
      case 'pickAll': return dollars(pick('pick') + entry.dest);
      case 'base': return dollars(pick('base'));
      case 'baseAll': return dollars(pick('base') + entry.dest);
      case 'dest': return dollars(entry.dest);
      case 'offer': return dollars(entry.offers[Number(index)].msrp + entry.dest);
      default: throw new Error(`Unknown token ${all}`);
    }
  });
}

// ---- page pieces ----
function pageFrame(page, updated, tabs, inner, credits, sourceList) {
  const checked = longDate(page.checkedOn);
  return `<article class="vp rp">
<header class="vp-head vp-width">
<p class="vp-crumb"><a href="/blog.html">Resources</a> / ${page.crumb}</p>
<h1>${page.h1}</h1>
<p class="vp-byline">By <a href="/about.html">Mason</a> · Updated <time datetime="${updated}">${longDate(updated)}</time></p>
</header>
<nav class="vp-tabs" aria-label="Article contents"><ul class="vp-width" role="list">${tabs.map(([id, label]) => `<li><a href="#${id}">${label}</a></li>`).join('')}</ul></nav>
<div class="vp-width rp-main">
<div class="vp-body">
${inner}

<aside class="vp-cta" aria-label="Steer Me Right plans"><div><p><strong>Don’t overpay, or lose weeks calling dealers.</strong>We contact dozens of dealers, negotiate the price and fees, and bring you the offers.</p><p class="vp-cta__fine">From $395. Full refund if you cancel before negotiations begin.</p></div><a class="vp-cta__button" href="#plans">Let us do the work</a></aside>

<section id="plans" class="vp-section vp-plans">
<h2>Pick how much help you want</h2>
<div class="vp-plans__grid">
${planCards.map(card => planCard(card, `roundup-${page.slug.replace(/\.html$/, '')}`)).join('\n')}
</div>
${askMason(`roundup-${page.slug.replace(/\.html$/, '')}`)}
<p class="vp-note">The Steer Me Right plan covers dealers within 200 miles of you; Steer Me Right Pro covers dealers nationwide. The fee doesn’t cover the car, taxes or registration. <a href="/policy.html#refund-policy">Refund policy</a></p>
</section>

<section id="faq" class="vp-section vp-section--band">
<h2>Common questions</h2>
${faq(page.faqFilled)}
</section>

<section class="vp-sources" aria-labelledby="guide-sources"><h2 id="guide-sources">Sources and updates</h2><p>Written by <a href="/about.html">Mason</a>, Steer Me Right’s founder and lead advisor. Prices, incentives and market figures were checked on ${checked} and change often, so confirm them with the dealer before you sign. The discount ranges are our estimate from the sources in each price guide, not a promise. Review scores belong to their publishers, are quoted with a link and are never averaged. ${page.sourcesNote} If something is out of date or wrong, email <a href="mailto:hello@steermeright.com">hello@steermeright.com</a> and we will correct it.</p>
<details class="vp-more"><summary>All ${sourceList.length} sources</summary>
<ul>
${sourceList.map(source => `<li><a href="${source.url}" rel="noopener">${source.title}</a>${source.note ? `: ${source.note}` : ''}</li>`).join('\n')}
</ul>
</details>
<p>Related: ${page.related}.</p>
${credits}</section>
</div>
</div>
</article>`;
}
const creditList = photos => photos.length ? `<details class="vp-credits"><summary>Photo credits</summary>
<ul>${photos.map(([label, image]) => credit(label, image)).join('')}</ul>
</details>` : '';

// Review scores as links to the publishers, never averaged.
const scoreLine = (guide, link) => guide.scores.cards.map(card => `<a href="${link(card.url)}" rel="noopener">${card.source}</a> ${card.display}/${card.scale}`).join(' · ');
const versusLinks = entry => entry.versus?.length ? entry.versus.map(cmp => `<a href="/${cmp.slug}">${cmp.crumb}</a>`).join(', ') : '';
const itemLinks = entry => {
  const parts = [];
  if (entry.guide) parts.push(`<a href="/${entry.guide}">${entry.name.replace(/ Hybrid$/, '')} price guide</a>`);
  const versus = versusLinks(entry);
  if (versus) parts.push(`Head to head: ${versus}`);
  return parts.length ? `<p class="rp-links">${parts.join(' · ')}</p>` : '';
};
const photoFigure = (entry, label) => entry.guideData ? `<figure class="rp-item__photo">${picture(entry.guideData.photo, [640, 960], '(max-width: 760px) 92vw, 340px')}</figure>` : '';
const fact = (label, html) => `<div><dt>${label}</dt><dd>${html}</dd></div>`;

// ---- compact SUVs: a ranked list ----
function rankedBody(page, entries, fill, link, reddit) {
  const glanceRows = entries.map((entry, i) => [`${i + 1}. <a href="#${entry.key}">${entry.name}</a>`, `${entry.year} ${entry.pick.trim}`, `<strong>${dollars(entry.pick.msrp)}</strong>`, dollars(entry.pick.msrp + entry.dest), `${entry.mpg} mpg`, entry.cargo]);
  const items = entries.map((entry, i) => {
    const guide = entry.guideData;
    const facts = [
      fact('The trim we’d buy', `${entry.year} ${entry.pick.trim} <strong>${dollars(entry.pick.msrp)}</strong> <small>${dollars(entry.pick.msrp + entry.dest)} with destination</small>`),
      fact('Starts at', `${entry.start.trim} ${dollars(entry.start.msrp)} <small>${dollars(entry.start.msrp + entry.dest)} with destination</small>`),
      fact('EPA combined', fill(entry.epa)),
      fact('Cargo behind the rear seats', `${entry.cargo} cubic feet`),
      guide ? fact('What reviewers say', scoreLine(guide, link)) : fact('Ratings', entry.ratings ? Object.values(entry.ratings).join('; ') : ''),
      entry.pay ? fact('A fair deal runs', `${dealText(entry.pay.fair)}; a strong one ${dealText(entry.pay.strong)} <small>our estimate</small>`) : '',
      reddit[entry.key] !== undefined ? fact('Reddit Sentiment Index', `<a href="/${entry.guide}#reddit">${reddit[entry.key]} out of 100</a>`) : '',
    ].filter(Boolean).join('\n');
    return `<li id="${entry.key}" class="rp-item${guide ? '' : ' rp-item--plain'}">
${photoFigure(entry)}
<div class="rp-item__body">
<h3><span class="rp-rank">${i + 1}</span> ${entry.name} <small>${entry.year}</small></h3>
<p class="rp-verdict">${fill(entry.blurb)}</p>
<dl class="rp-facts">
${facts}
</dl>
<p><strong>Who it suits.</strong> ${fill(entry.who)}</p>
<p><strong>The catch.</strong> ${fill(entry.catch)}</p>
<p class="rp-buy">${fill(entry.buy)}</p>
${itemLinks(entry)}
</div>
</li>`;
  }).join('\n');
  return `<section id="pick" class="vp-section vp-section--first">
<p class="vp-lead">${fill(page.lead)}</p>
<h2 class="rp-sub">${page.basisHeading}</h2>
<p>${fill(page.basis)}</p>
<ul class="rp-quick" role="list">
${page.quick.map(item => { const entry = entries.find(e => e.key === item.key); return `<li><span>${item.label}</span><a href="#${entry.key}">${item.text}</a></li>`; }).join('\n')}
</ul>
</section>

<section id="glance" class="vp-section">
<h2>Prices, mpg and cargo at a glance</h2>
${table('glance-caption', `Compact SUVs ranked, with the trim we’d buy, MSRP, price with destination, EPA combined mpg and cargo room, checked ${longDate(page.checkedOn)}`, ['Rank and model', 'Trim we’d buy', 'MSRP', 'With destination', 'EPA combined', 'Cargo, cu ft'], glanceRows, 'vp-table rp-table')}
</section>

<section id="ranking" class="vp-section">
<h2>${page.rankHeading}</h2>
<ol class="rp-list" role="list">
${items}
</ol>
</section>`;
}

// ---- hybrid SUVs under the line: a ranked list with an offers table per car ----
const LINE = 35000;
function hybridBody(page, entries, fill, link, reddit, vehicles) {
  const rows = entries.flatMap((entry, i) => entry.offers.map((offer, j) => [`${j === 0 ? `${i + 1}. <a href="#${entry.key}">${entry.name}</a>` : ''}<span>${offer.label}</span>`, dollars(offer.msrp), `<strong>${dollars(offer.msrp + entry.dest)}</strong>`, `${offer.mpg}`, offer.awd]));
  const items = entries.map((entry, i) => {
    const guide = entry.guideData;
    const offers = table(`offers-${entry.key}`, `${entry.name} trims under $35,000 with destination`, ['Trim', 'MSRP', 'Destination', 'With destination', 'EPA combined', 'AWD'],
      entry.offers.map(offer => [offer.label, dollars(offer.msrp), dollars(entry.dest), `<strong>${dollars(offer.msrp + entry.dest)}</strong>`, `${offer.mpg} mpg`, offer.awd]), 'vp-table rp-offers');
    const facts = [
      fact('Cargo behind the rear seats', `${entry.cargo} cubic feet`),
      guide ? fact('What reviewers say', scoreLine(guide, link)) : fact('Ratings', entry.ratings),
      entry.pay ? fact('A fair deal runs', `${dealText(entry.pay.fair)}; a strong one ${dealText(entry.pay.strong)} <small>our estimate</small>`) : '',
      reddit[entry.key] !== undefined ? fact('Reddit Sentiment Index', `<a href="/${entry.guide}#reddit">${reddit[entry.key]} out of 100</a>`) : '',
    ].filter(Boolean).join('\n');
    return `<li id="${entry.key}" class="rp-item${guide ? '' : ' rp-item--plain'}">
${photoFigure(entry)}
<div class="rp-item__body">
<h3><span class="rp-rank">${i + 1}</span> ${entry.name} <small>${entry.year}</small></h3>
<p class="rp-verdict">${fill(entry.blurb)}</p>
${offers}
<dl class="rp-facts">
${facts}
</dl>
<p><strong>Who it suits.</strong> ${fill(entry.who)}</p>
<p><strong>The catch.</strong> ${fill(entry.catch)}</p>
${itemLinks(entry)}
</div>
</li>`;
  }).join('\n');
  const missed = page.missed.map(row => {
    const guide = row.guide ? vehicles.find(vehicle => vehicle.slug === row.guide) : null;
    const msrp = row.msrp ?? trimPrice(guide, row.trim);
    const total = msrp + row.dest;
    if (total <= LINE) throw new Error(`${row.name} is under the line; it belongs in the ranking`);
    return [`${row.name} <span>${row.year}${guide ? ` · <a href="/${row.guide}">price guide</a>` : ''}</span>`, dollars(msrp), dollars(row.dest), `<strong>${dollars(total)}</strong>`, dollars(total - LINE), row.note];
  });
  return `<section id="pick" class="vp-section vp-section--first">
<p class="vp-lead">${fill(page.lead)}</p>
<h2 class="rp-sub">${page.basisHeading}</h2>
<p>${fill(page.basis)}</p>
</section>

<section id="glance" class="vp-section">
<h2>Every qualifying trim at a glance</h2>
${table('glance-caption', `Hybrid SUVs under $35,000 with destination: MSRP, price with destination, EPA combined mpg and AWD, checked ${longDate(page.checkedOn)}`, ['Model and trim', 'MSRP', 'With destination', 'EPA combined, mpg', 'AWD'], rows, 'vp-table rp-table')}
</section>

<section id="ranking" class="vp-section">
<h2>${page.rankHeading}</h2>
<ol class="rp-list" role="list">
${items}
</ol>
</section>

<section id="missed" class="vp-section vp-section--band">
<h2>The four that just miss</h2>
<p>These hybrids start above $35,000 once destination is added, so they’re not in the ranking. The nearest is the Crosstrek, $520 over.</p>
${table('missed-caption', 'Hybrid SUVs that start over $35,000 with destination', ['Model', 'MSRP', 'Destination', 'With destination', 'Over $35,000 by', 'Drive'], missed, 'vp-table rp-table')}
</section>`;
}

// ---- pickups: ranked by price with destination ----
function pickupBody(page, entries, fill, link) {
  const items = entries.map((entry, i) => {
    const guide = entry.guideData;
    const buyYear = entry.buy.buyYear ? ` <small>${entry.buy.buyYear} price</small>` : '';
    const facts = [
      fact('Base trim', `${entry.year} ${entry.base.trim} <strong>${dollars(entry.base.msrp)}</strong> <small>${dollars(entry.base.msrp + entry.dest)} with ${dollars(entry.dest)} destination</small>`),
      fact('The trim we’d buy', `${entry.buy.trim}${entry.buy.msrp !== entry.base.msrp || entry.buy.buyYear ? ` <strong>${dollars(entry.buy.msrp)}</strong> <small>${dollars(entry.buy.msrp + entry.dest)} with destination</small>${buyYear}` : ' <small>the base trim</small>'}`),
      fact('EPA', `${entry.mpg} mpg`),
      entry.pay ? fact('A fair deal runs', `${dealText(entry.pay.fair)} on the trim we’d buy; a strong one ${dealText(entry.pay.strong)} <small>our estimate</small>`) : '',
    ].filter(Boolean).join('\n');
    return `<li id="${entry.key}" class="rp-item${guide ? '' : ' rp-item--plain'}">
${photoFigure(entry)}
<div class="rp-item__body">
<h3><span class="rp-rank">${i + 1}</span> ${entry.name} <small>${entry.cls} · ${entry.year}</small></h3>
<p class="rp-verdict">${fill(entry.verdict)}</p>
<dl class="rp-facts">
${facts}
</dl>
<p><strong>What the base lacks.</strong> ${fill(entry.lacks)}</p>
<p><strong>Why that trim.</strong> ${fill(entry.why)}</p>
${itemLinks(entry)}
</div>
</li>`;
  }).join('\n');
  const rows = entries.map((entry, i) => [`${i + 1}. <a href="#${entry.key}">${entry.name}</a><span>${entry.cls}, ${entry.year}</span>`, `${entry.base.trim}`, dollars(entry.base.msrp), `<strong>${dollars(entry.base.msrp + entry.dest)}</strong>`, `${entry.buy.trim}`, `${dollars(entry.buy.msrp + entry.dest)}${entry.buy.buyYear ? ` (${entry.buy.buyYear})` : ''}`]);
  return `<section id="pick" class="vp-section vp-section--first">
<p class="vp-lead">${fill(page.lead)}</p>
<h2 class="rp-sub">${page.basisHeading}</h2>
<p>${fill(page.basis)}</p>
</section>

<section id="chart" class="vp-section">
<h2>Starting price with destination</h2>
${bars(entries.map(entry => ({ label: `${entry.name}, ${entry.base.trim}`, value: entry.base.msrp + entry.dest, display: dollars(entry.base.msrp + entry.dest) })))}
</section>

<section id="glance" class="vp-section">
<h2>The base truck and the one we’d buy</h2>
${table('glance-caption', `Pickup trucks ranked by base price with destination, with the trim we’d buy and its price with destination, checked ${longDate(page.checkedOn)}`, ['Rank and truck', 'Base trim', 'Base MSRP', 'Base with destination', 'Trim we’d buy', 'It costs, with destination'], rows, 'vp-table rp-table')}
</section>

<section id="ranking" class="vp-section">
<h2>${page.rankHeading}</h2>
<ol class="rp-list" role="list">
${items}
</ol>
</section>`;
}

const sheetLink = (file, css) => `<link rel="stylesheet" href="/${file}?v=${createHash('sha256').update(css).digest('hex').slice(0, 12)}">`;

export async function renderRoundupPages() {
  const [chrome, data, vehicleData, comparisonData] = await Promise.all([read(chromePage), read('data/roundup-pages.json').then(JSON.parse), read('data/vehicle-pages.json').then(JSON.parse), read('data/comparison-pages.json').then(JSON.parse)]);
  const css = await Promise.all(sheets.map(file => readFile(path.join(root, file))));
  const links = sheets.map((file, i) => sheetLink(file, css[i])).join('\n    ');
  const out = [];
  for (const page of data.pages) {
    const updated = page.checkedOn > data.updated ? page.checkedOn : data.updated;
    let entries = page.entries.map(entry => resolve(entry, vehicleData.vehicles, comparisonData.comparisons));
    if (page.kind === 'pickups') entries = entries.toSorted((a, b) => (a.base.msrp + a.dest) - (b.base.msrp + b.dest));
    const fill = filler(entries);
    // Every outside link on the page must be one of its registered sources.
    const known = new Set(page.sources.map(source => source.url));
    const used = new Set();
    const link = url => { if (!known.has(url)) throw new Error(`${page.slug} links ${url}, which is not in its sources`); used.add(url); return url; };
    const reddit = {};
    for (const entry of entries) {
      if (!entry.guideData) continue;
      const file = path.join(root, carSentimentFile(entry.guideData));
      if (existsSync(file)) reddit[entry.key] = summarizeCar(JSON.parse(readFileSync(file, 'utf8'))).index;
    }
    const withPage = { ...page, faqFilled: page.faq.map(([q, a]) => [q, fill(a)]) };
    let body, tabs;
    if (page.kind === 'ranked') { body = rankedBody(withPage, entries, fill, link, reddit); tabs = [['pick', 'Our pick'], ['glance', 'At a glance'], ['ranking', 'The ranking'], ['plans', 'Plans'], ['faq', 'Questions']]; }
    else if (page.kind === 'hybrids') { body = hybridBody(withPage, entries, fill, link, reddit, vehicleData.vehicles); tabs = [['pick', 'Our pick'], ['glance', 'At a glance'], ['ranking', 'The five'], ['missed', 'Just miss'], ['plans', 'Plans'], ['faq', 'Questions']]; }
    else if (page.kind === 'pickups') { body = pickupBody(withPage, entries, fill, link); tabs = [['pick', 'Our pick'], ['chart', 'Prices'], ['glance', 'At a glance'], ['ranking', 'The ranking'], ['plans', 'Plans'], ['faq', 'Questions']]; }
    else throw new Error(`Unknown kind ${page.kind}`);
    const photos = entries.filter(entry => entry.guideData).map(entry => [entry.name, entry.guideData.photo]);
    const frame = pageFrame(withPage, updated, tabs, body, creditList(photos), page.sources);
    const html = shell(chrome, { slug: page.slug, title: page.title, description: page.description, h1: page.h1, published: page.published, updated, crumbs: [['Resources', `${origin}/blog.html`], [page.crumb, `${origin}/${page.slug}`]] }, frame);
    out.push({ slug: page.slug, html: html.replace('</head>', `    ${links}\n</head>`) });
  }
  return out;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const check = process.argv.includes('--check');
  let stale = 0;
  for (const { slug, html } of await renderRoundupPages()) {
    if (check) {
      const current = await read(slug).catch(() => null);
      if (current !== html) { stale++; console.error(`${slug} is out of date. Run npm run build:roundups.`); }
    } else {
      await writeFile(path.join(root, slug), html);
      console.log(`wrote ${slug}`);
    }
  }
  if (stale) process.exit(1);
  if (check) console.log('Roundup pages match data/roundup-pages.json.');
}
