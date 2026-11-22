// Builds the two deal pages from data/deal-pages.json (copy, ordering inputs, sources) and data/vehicle-pages.json (every car figure):
//   cars-selling-below-msrp.html     the 21 guides ranked by how far under sticker a fair deal runs
//   new-car-deals-this-month.html    every current manufacturer offer in the 21 guides, sorted
// A monthly refresh of the price guides flows through on the next build. Run `npm run build:deals` after changing either data file,
// the script, buying/deal-pages.css or car-negotiation-service.html's head, header or footer; `npm run check:deals` fails on drift.
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { shell } from './render-market-pages.mjs';
import {
  breakEven, cardEnd, carKey, checkNeeds, discountRange, dollars, dollarsOff, endState, fill, longDate, midpoint,
  offerLedger, percentText, rankCars, roundTo50, shortDate, strip, totalPaid,
} from './deal-model.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const origin = 'https://www.steermeright.com';
const chromePage = 'car-negotiation-service.html';
const guideSheet = 'buying/price-guide.css';
const dealSheet = 'buying/deal-pages.css';
const read = file => readFile(path.join(root, file), 'utf8');
const esc = text => String(text).replaceAll('&', '&amp;').replaceAll('<', '&lt;');
const paragraphs = list => list.map(text => `<p>${text}</p>`).join('\n');
const sheetLink = (file, css) => `<link rel="stylesheet" href="/${file}?v=${createHash('sha256').update(css).digest('hex').slice(0, 12)}">`;
const readSpan = vehicles => {
  const dates = vehicles.map(vehicle => vehicle.checkedOn).sort();
  const [first, last] = [dates[0], dates.at(-1)];
  const month = iso => longDate(iso).replace(/ \d+, \d{4}$/, '');
  const day = iso => Number(iso.slice(8));
  return first.slice(0, 7) === last.slice(0, 7) ? `${month(first)} ${day(first)} to ${day(last)}, ${first.slice(0, 4)}` : `${longDate(first)} to ${longDate(last)}`;
};
const needsFor = (slug, list) => (list || []).map(text => ({ slug, text }));

// The two plan cards, word for word from render-vehicle-pages.mjs (a test compares the strings), so the copy stays the approved copy.
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
const plansSection = location => `<section id="plans" class="vp-section vp-plans">
<h2>Pick how much help you want</h2>
<div class="vp-plans__grid">
${planCards.map(card => planCard(card, location)).join('\n')}
</div>
<p class="vp-note">Dealers and lenders pay us nothing. You can upgrade to Steer Me Right Pro later by paying the $300 difference. The fee doesn’t cover the car, taxes or registration. <a href="/policy.html#refund-policy">Refund policy</a></p>
</section>`;
const negotiate = 'Yes. Steer Me Right charges a flat $395 for one model or $695 for up to three. We find it in dealer stock, get written out-the-door offers and negotiate for a price below MSRP. We can’t promise a specific discount: the market for a given car sets what a dealer will do.';
const faq = entries => `<div class="vp-faq">\n${entries.map(([question, answer]) => `<details><summary>${question}</summary><p>${answer}</p></details>`).join('\n')}\n</div>`;
const standardFaq = [
  ['Can you negotiate a car for me?', negotiate],
  ['Do dealers pay you?', 'No. Dealers and lenders pay us nothing, and you’re the only one we work for.'],
  ['What if I change my mind?', 'Cancel before negotiations begin and you get a full refund. During negotiations, refund eligibility depends on the work already done. Read the <a href="/policy.html#refund-policy">refund policy</a>.'],
];
const cta = '<aside class="vp-cta" aria-label="Steer Me Right plans"><div><p><strong>Don’t overpay, or lose weeks calling dealers.</strong>We contact dozens of dealers, negotiate the price and fees, and bring you the offers.</p><p class="vp-cta__fine">From $395. Full refund if you cancel before negotiations begin.</p></div><a class="vp-cta__button" href="#plans">Let us do the work</a></aside>';

let tableCount = 0;
function table(caption, head, rows, className = 'vp-table') {
  const id = `dl-table-${++tableCount}`;
  return `<div class="vp-scroll" role="region" aria-labelledby="${id}" tabindex="0">
<table class="${className}">
<caption id="${id}" class="sr-only">${caption}</caption>
<thead><tr>${head.map(cell => `<th scope="col">${cell}</th>`).join('')}</tr></thead>
<tbody>
${rows.map(([first, ...rest]) => `<tr><th scope="row">${first}</th>${rest.map(cell => `<td>${cell}</td>`).join('')}</tr>`).join('\n')}
</tbody>
</table>
</div>`;
}

const tabs = items => `<nav class="vp-tabs" aria-label="Article contents"><ul class="vp-width" role="list">${items.map(([id, label]) => `<li><a href="#${id}">${label}</a></li>`).join('')}</ul></nav>`;
const header = (page, updated) => `<header class="vp-head vp-width">
<p class="vp-crumb"><a href="/blog.html">Resources</a> / ${page.crumb}</p>
<h1>${page.h1}</h1>
<p class="vp-byline">By <a href="/about.html">Mason</a> · Updated <time datetime="${updated}">${longDate(updated)}</time></p>
</header>`;

const guideHref = vehicle => `/${vehicle.slug}`;
const carLink = vehicle => `<a href="${guideHref(vehicle)}">${vehicle.name}</a>`;
const credit = (vehicle, image) => `<li>${vehicle.name}: <a href="${image.sourceUrl}" rel="noopener">${image.author}</a>, ${image.licenseUrl ? `<a href="${image.licenseUrl}" rel="noopener">${image.license}</a>` : image.license}${image.note ? `, ${image.note}` : ''}</li>`;
const thumb = image => `<picture>${['avif', 'webp'].map(type => `<source type="image/${type}" srcset="/assets/external/optimized/${image.file}-640.${type} 640w" sizes="120px">`).join('')}<img src="/assets/external/optimized/${image.file}-640.webp" alt="${esc(image.alt)}" width="${image.width}" height="${image.height}" loading="lazy" decoding="async"></picture>`;

// A source on a deal page is a guide's source under a new id, so the page's own outside links are all registered under its own rows.
function sourceList(entries, vehicles) {
  return entries.map(entry => {
    for (const vehicle of vehicles) {
      const found = vehicle.sources.find(source => source.id === entry.from);
      if (found) return { id: entry.id, from: entry.from, vehicle, title: found.title, url: found.url, scope: found.scope, note: found.note };
    }
    throw new Error(`Source ${entry.id} points at ${entry.from}, which no price guide lists`);
  });
}
function requireSources(list, ids, where) {
  for (const id of ids) if (!list.some(source => source.from === id)) throw new Error(`${where}: ${id} is used on the page but missing from its sources in data/deal-pages.json`);
}
const sourcesHtml = (list, extraHtml) => `<details class="vp-more"><summary>All ${list.length} sources</summary>
<ul>
${list.map(source => `<li><a href="${source.url}" rel="noopener">${esc(source.title)}</a>: ${esc(source.note || source.scope)}. Read for the <a href="${guideHref(source.vehicle)}">${source.vehicle.name} price guide</a> on ${longDate(source.vehicle.checkedOn)}.</li>`).join('\n')}
</ul>
</details>`;

// ---- Page 1: cars selling below MSRP ------------------------------------------------------------------------------------------------------
function msrpPage(config, vehicles, sources) {
  const page = config.pages.msrp;
  const ranked = rankCars(vehicles, config);
  const fixed = vehicles.filter(vehicle => config.cars[carKey(vehicle)].fixedPrice);
  const groups = config.groups.map(group => ({ ...group, cars: [] }));
  for (const row of ranked) groups.find(group => row.score >= group.min).cars.push(row);
  for (const group of groups) if (group.cars.length !== group.count) throw new Error(`Group ${group.id} now has ${group.cars.length} cars, not ${group.count}; reread its intro in data/deal-pages.json and update the count`);
  for (const group of groups) checkNeeds(vehicles, group.needs || [], `group ${group.id}`);
  for (const row of ranked) checkNeeds(vehicles, needsFor(row.vehicle.slug, row.car.needs), row.key);
  checkNeeds(vehicles, [...(page.leadNeeds || []), ...(page.markupNeeds || [])], 'msrp page');
  for (const vehicle of fixed) checkNeeds(vehicles, needsFor(vehicle.slug, config.cars[carKey(vehicle)].needs), carKey(vehicle));

  const top = ranked[0], low = ranked.slice(-3).reverse();
  const topThree = ranked.slice(0, 3);
  const deepest = groups[0].cars.slice(1).map(row => row.vehicle.name);
  const list = names => names.length < 3 ? names.join(' and ') : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;
  const tokens = {
    top1: top.vehicle.name, top1Trim: top.pick.name, top1Fair: top.pay.fair.replace(/ under$/, ''), top1Dollars: dollarsOff(top.pay.fair, top.price), top1Price: dollars(top.price),
    bottom1: low[0].vehicle.name, bottom2: low[1].vehicle.name, bottom3: low[2].vehicle.name,
    bottomRange: `${Math.min(...low.map(row => row.fair.low))}–${Math.max(...low.map(row => row.fair.high))}%`,
    deepestRest: list(deepest),
    top3Names: list(topThree.map(row => row.vehicle.name)), top3Floor: `${Math.min(...topThree.map(row => row.fair.low))}%`,
  };
  const fairLabel = row => row.pay.fair.replace(/ under$/, '').replace(' or more', '%+').replace(/^(\d+(?:\.\d+)?)%$/, '$1%');

  const dealTile = (kind, label, text, row) => {
    const range = discountRange(text);
    const figure = text === 'MSRP' ? 'MSRP' : text === 'Any discount' ? 'Any' : `${range.low}${range.open ? '%+' : range.high !== range.low ? `–${range.high}%` : '%'}`;
    const off = dollarsOff(text, row.price);
    return `<div class="dl-tile dl-tile--${kind}"><dt>${label}</dt><dd><strong>${figure}</strong><span>under MSRP</span>${off ? `<em>${off}${range.open ? '' : ' off'}</em>` : ''}</dd></div>`;
  };
  const moreRoom = row => {
    const best = row.vehicle.pay.rows.map((entry, index) => ({ entry, index, score: midpoint(discountRange(entry.fair)) })).sort((a, b) => b.score - a.score)[0];
    if (best.index === row.car.payRow || best.score <= row.score) return '';
    return `<p class="dl-car__more">More room on the ${esc(best.entry.trims)}: ${esc(best.entry.fair)}.</p>`;
  };
  const carRow = (row, rank) => `<li class="dl-car">
<span class="dl-car__photo">${thumb(row.vehicle.photo)}</span>
<div class="dl-car__name"><h4><span class="dl-car__rank">${rank}</span>${carLink(row.vehicle)}</h4>
<p class="dl-car__trim">${esc(row.pay.trims)}. We’d buy the ${esc(row.pick.name)}, from ${dollars(row.price)}.</p>
<p class="dl-car__line">${row.car.line}</p>
${moreRoom(row)}</div>
<dl class="dl-car__deal">${dealTile('fair', 'Fair deal', row.pay.fair, row)}${dealTile('strong', 'Strong deal', row.pay.strong, row)}</dl>
<p class="dl-car__offer"><span>${row.vehicle.name.split(' ')[0]} offer</span><strong>${esc(row.headline)}</strong></p>
</li>`;
  let rank = 0;
  const groupHtml = groups.map(group => `<div class="dl-group">
<h3>${group.heading}</h3>
<p>${group.intro}</p>
<ol class="dl-cars" role="list">
${group.cars.map(row => carRow(row, ++rank)).join('\n')}
</ol>
</div>`).join('\n');

  const extreme = (title, rows) => `<div class="dl-extreme"><h3>${title}</h3><ol role="list">${rows.map(row => `<li><span>${carLink(row.vehicle)} <small>${esc(row.pick.name)}</small></span><strong>${row.pay.fair.replace(/ under$/, '')}</strong><em>${dollarsOff(row.pay.fair, row.price)} off</em></li>`).join('')}</ol></div>`;

  // Trims that sell at or near sticker, from every pay row in the guides.
  const nearSticker = [];
  for (const vehicle of vehicles) {
    if (config.cars[carKey(vehicle)].fixedPrice) continue;
    for (const entry of vehicle.pay.rows) if (discountRange(entry.fair).high <= page.markupMax) nearSticker.push({ vehicle, entry });
  }
  nearSticker.sort((a, b) => midpoint(discountRange(a.entry.fair)) - midpoint(discountRange(b.entry.fair)) || a.vehicle.name.localeCompare(b.vehicle.name));
  const stickerTable = table('Trims that sell within 2% of sticker, from the price guides', ['Car and trims', 'Fair deal', 'What the guide says'],
    nearSticker.map(({ vehicle, entry }) => [`${carLink(vehicle)}<span>${esc(entry.trims)}</span>`, `<strong>${esc(percentText(entry.fair))}</strong>`, esc(strip(entry.why))]));

  const teslaRows = fixed.flatMap(vehicle => vehicle.pay.rows.map((entry, index) => {
    const card = vehicle.incentives.cards[0];
    return [`${carLink(vehicle)}<span>${esc(entry.trims)} (used)</span>`, `<strong>${esc(entry.fair)}</strong>`, `<strong>${esc(entry.strong)}</strong>`, index === 0 ? `${esc(card.figure)} ${esc(card.word)}` : '', esc(strip(entry.why))];
  }));
  const teslaTable = table('Tesla used-car discounts under asking price, and the new price', ['Car and model years', 'Fair deal', 'Strong deal', 'New from Tesla', 'Why'], teslaRows);

  const sourceCheck = [...ranked.flatMap(row => row.car.prices), ...fixed.flatMap(vehicle => config.cars[carKey(vehicle)].prices), ...Object.values(config.brandOffers).flat(), page.markupSource];
  requireSources(sources, sourceCheck, 'msrp page');
  const span = readSpan(vehicles);

  const body = `<article class="vp dl">
${header(page, config.updated)}
${tabs([['verdict', 'Verdict'], ['ranking', 'All 21 ranked'], ['sticker', 'At sticker'], ['tesla', 'Tesla'], ['method', 'How we ranked'], ['faq', 'Questions'], ['sources', 'Sources']])}
<div class="vp-width vp-body dl-body">
<section id="verdict" class="vp-section vp-section--first">
<p class="vp-lead">${fill(page.lead[0], tokens)}</p>
<p>${fill(page.lead[1], tokens)}</p>
<div class="dl-extremes">
${extreme('Most room to negotiate', topThree)}
${extreme('Least room to negotiate', low)}
</div>
</section>
${cta}

<section id="ranking" class="vp-section">
<h2>All 21 ranked, most room first</h2>
<p>Each car is shown at the trim we’d buy. Dollars come off that trim’s starting MSRP, and the offer is the headline one from the car’s price guide.</p>
${groupHtml}
</section>

<section id="sticker" class="vp-section vp-section--band">
<h2>${page.markupHeading}</h2>
<p>${page.markupIntro}</p>
${stickerTable}
<p class="vp-note">If a dealer asks for more than sticker on a car in demand, <a href="/blog-high-demand-vehicles-msrp.html">our guide to high-demand vehicles</a> covers widening the search. The price guide for each car lists what to watch for at the dealer.</p>
</section>

<section id="tesla" class="vp-section">
<h2>${page.tesla.heading}</h2>
<p>${page.tesla.intro}</p>
${teslaTable}
</section>

<section id="method" class="vp-section vp-section--band">
<h2>How we ranked them</h2>
${paragraphs(page.method)}
<p>For how to compare the quotes you collect, read <a href="/blog-buy-new-car-below-msrp.html">buying a new car below MSRP</a> and the <a href="/new-car-pricing-incentives.html">new-car pricing and incentives hub</a>.</p>
</section>

${plansSection('deal-cars-selling-below-msrp')}

<section id="faq" class="vp-section vp-section--band">
<h2>Common questions</h2>
${faq([...page.faq.map(([question, answer]) => [question, fill(answer, tokens)]), ...standardFaq])}
</section>

<section id="sources" class="vp-sources" aria-labelledby="guide-sources"><h2 id="guide-sources">Sources and updates</h2><p>Written by <a href="/about.html">Mason</a>, Steer Me Right’s founder and lead advisor. Every figure here comes from the car’s price guide, read ${span}. Prices, incentives and market figures change often, so confirm them with the dealer before you sign. The discount ranges are our estimate from the sources below, not a promise. If something is out of date or wrong, email <a href="mailto:hello@steermeright.com">hello@steermeright.com</a> and we will correct it.</p>
<p>Price guides: ${vehicles.map(carLink).join(', ')}.</p>
${sourcesHtml(sources)}
<p>Related: ${page.related}.</p>
<details class="vp-credits"><summary>Photo credits</summary>
<ul>${vehicles.map(vehicle => credit(vehicle, vehicle.photo)).join('')}</ul>
</details></section>
</div>
</article>`;
  return { slug: page.slug, title: page.title, description: page.description, h1: page.h1, crumbs: [['Resources', `${origin}/blog.html`], [page.crumb, `${origin}/${page.slug}`]], body, image: page.image, published: page.published };
}

// ---- Page 2: new-car deals this month -----------------------------------------------------------------------------------------------------------
const endCell = row => {
  const state = row.end.state;
  const text = row.row.ends ? esc(row.row.ends) : 'No end date shown';
  return state === 'mostly-over' ? `${text}<span class="dl-flag">Over in most regions</span>` : text;
};
const carCell = (offer, extra) => `${carLink(offer.vehicle)}${extra ? `<span>${extra}</span>` : ''}`;
const aprSort = (a, b) => a.rate - b.rate || b.vehicle.name.localeCompare(a.vehicle.name) * -1;

function dealsPage(config, vehicles, sources) {
  const page = config.pages.deals;
  const ledger = offerLedger(vehicles, config);
  for (const [name, override] of Object.entries(config.rowKinds)) {
    if (!override.needsInDetail) continue;
    const [slug, offer] = name.split('|');
    const row = vehicles.find(vehicle => vehicle.slug === slug).incentives.rows.find(entry => entry.offer === offer);
    if (!row.detail.includes(override.needsInDetail)) throw new Error(`rowKinds "${name}" no longer matches its detail; review it`);
  }
  const named = ['apr', 'cash', 'lease', 'program'];
  const live = ledger.filter(offer => named.includes(offer.kind) && offer.end.state !== 'over');
  const alive = live.filter(offer => offer.end.state !== 'mostly-over');
  const find = slug => vehicles.find(vehicle => vehicle.slug === slug);
  const optionLess = (vehicle, index) => {
    const choice = vehicle.incentives.choice, option = choice.options[index];
    return roundTo50(totalPaid(choice.price, choice.baseRate, choice.months) - totalPaid(choice.price - option.cash, option.rate, choice.months));
  };

  // Cash or the rate
  const choiceRows = page.choice.map(entry => {
    const vehicle = find(entry.slug);
    const choice = vehicle.incentives.choice;
    const rate = choice.options[entry.rate], cash = choice.options[entry.cash];
    if (!rate || !cash) throw new Error(`${entry.slug}: choice option out of range`);
    const base = totalPaid(choice.price, choice.baseRate, choice.months);
    return { vehicle, choice, rate, cash, lessRate: roundTo50(base - totalPaid(choice.price - rate.cash, rate.rate, choice.months)), lessCash: roundTo50(base - totalPaid(choice.price - cash.cash, cash.rate, choice.months)), even: breakEven(choice, rate, cash) };
  });
  const evenFor = slug => choiceRows.find(row => row.vehicle.slug === slug).even;
  const baseRate = choiceRows[0].choice.baseRate;
  if (choiceRows.some(row => row.choice.baseRate !== baseRate)) throw new Error('The guides disagree on the average new-car rate; review the choice rows');

  // The four to look at
  const picks = page.picks.map(pick => {
    const vehicle = find(pick.slug);
    checkNeeds(vehicles, needsFor(pick.slug, pick.needs), `pick ${pick.slug}`);
    const card = vehicle.incentives.cards.find(entry => entry.label === pick.label && entry.figure === pick.figure);
    if (!card) throw new Error(`${pick.slug}: no "${pick.label}" card with figure ${pick.figure}`);
    const entry = pick.pair ? choiceRows.find(row => row.vehicle.slug === pick.slug) : null;
    if (pick.pair && (!entry || entry.rate !== vehicle.incentives.choice.options[pick.pair.rate])) throw new Error(`${pick.slug}: the pick's pair does not match its choice row`);
    const choice = vehicle.incentives.choice;
    return { pick, vehicle, card, less: optionLess(vehicle, pick.option), price: choice.price, months: choice.months, even: entry ? `${entry.even}%` : '' };
  });
  const tokens = {
    tucsonLess: dollars(picks.find(item => item.vehicle.slug === 'hyundai-tucson-price.html').less),
    silveradoEven: String(evenFor('chevrolet-silverado-1500-price.html')),
    liveCount: String(alive.length),
    carCount: String(vehicles.length),
    novCount: String(alive.filter(offer => offer.end.first === '2026-11-30').length),
    baseRate: String(baseRate),
    topCredit: String(config.topCreditRate),
  };
  checkNeeds(vehicles, [...page.cashNeeds, ...page.choiceNeeds, ...page.programNeeds, ...page.regions.flatMap(region => region.needs)], 'deals page');

  const pickHtml = picks.map(item => {
    const { pick, vehicle, card } = item;
    return `<li><p class="vp-ic-offers__label">${carLink(vehicle)}</p>
<p class="vp-ic-offers__big">${esc(card.figure)} <span>${esc(card.word)}</span></p>
<p class="vp-ic-offers__text">${esc(card.text)}</p>
<p class="dl-pick__less">About ${dollars(item.less)} less than a ${dollars(item.price)} loan over ${item.months} months at ${baseRate}%.</p>
<p class="dl-pick__who"><strong>Who it suits.</strong> ${fill(pick.who, { even: item.even })}</p>
<p class="dl-pick__catch"><strong>The catch.</strong> ${fill(pick.catch, {})}</p></li>`;
  }).join('\n');

  // APR
  const apr = live.filter(offer => offer.kind === 'apr').sort(aprSort);
  const aprRow = offer => [`<strong>${esc(offer.rateText)}</strong>`, carCell(offer), esc(offer.term ?? 'Not stated'), esc(offer.row.applies), endCell(offer)];
  const aprHead = ['Rate', 'Car', 'Term', 'Applies to', 'Ends'];
  const aprFeatured = apr.filter(offer => offer.rate <= page.aprFeature), aprRest = apr.filter(offer => offer.rate > page.aprFeature);

  // Cash
  const cash = live.filter(offer => offer.kind === 'cash').sort((a, b) => b.figure - a.figure || a.vehicle.name.localeCompare(b.vehicle.name));
  const cashRow = offer => [`<strong>${offer.upTo ? 'Up to ' : ''}${dollars(offer.figure)}</strong>`, carCell(offer), esc(offer.row.applies), `${esc(offer.row.detail)}`, endCell(offer)];

  // Choice table
  const choiceTable = table('Cash against a low rate: the loan rate at which they cost the same', ['Car and loan', 'Low-rate offer', 'Cash offer', 'Low rate: less than the average loan', 'Cash: less than the average loan', 'Cash wins if your own rate is under'],
    choiceRows.map(row => [`${carLink(row.vehicle)}<span>${dollars(row.choice.price)} over ${row.choice.months} months</span>`, esc(`${row.rate.name} ${row.rate.detail}`), esc(`${row.cash.name} ${row.cash.detail}`), `<strong>${dollars(row.lessRate)}</strong>`, `<strong>${dollars(row.lessCash)}</strong>`, `<strong>${row.even}%</strong>`]));

  // Leases
  const leaseKinds = live.filter(offer => offer.kind === 'lease');
  const leaseRanked = leaseKinds.filter(offer => offer.effective !== null && offer.effective !== undefined && offer.payment !== null);
  const segments = [...new Set(vehicles.map(vehicle => config.cars[carKey(vehicle)].segment))];
  const leaseHtml = segments.map(segment => {
    const rows = leaseRanked.filter(offer => offer.car.segment === segment).sort((a, b) => a.effective - b.effective).slice(0, page.leaseTop);
    if (!rows.length) return '';
    return `<h3>${segment}</h3>
${table(`Cheapest advertised leases on ${segment === 'SUVs' ? 'SUVs' : segment.toLowerCase()}, with the due-at-signing money spread over the term`, ['Lease', 'Payment', 'Term', 'Due at signing', 'Per month with due spread', 'Ends'],
      rows.map(offer => [`${carLink(offer.vehicle)}<span>${esc(offer.row.offer)}: ${esc(offer.row.applies)}</span>`, `${dollars(offer.payment)} a month`, `${offer.term} months`, offer.signing === null ? 'Not stated' : dollars(offer.signing), `<strong>${dollars(offer.effective)}</strong>`, endCell(offer)]))}`;
  }).join('\n');
  const unranked = leaseKinds.length - leaseRanked.length;

  // Programs, merged across cars that carry the same offer
  const programs = new Map();
  for (const offer of live.filter(entry => entry.kind === 'program')) {
    const key = [offer.car.brand, offer.row.offer, offer.amount, offer.row.ends].join('|');
    if (!programs.has(key)) programs.set(key, { offer, cars: [] });
    programs.get(key).cars.push(offer.vehicle);
  }
  const programRows = [...programs.values()].sort((a, b) => a.offer.car.brand.localeCompare(b.offer.car.brand) || a.offer.row.offer.localeCompare(b.offer.row.offer));
  const programTable = table('Military, college, first-responder and loyalty offers by brand', ['Offer', 'Amount', 'Cars', 'Who and where', 'Ends'],
    programRows.map(({ offer, cars }) => [`${esc(offer.car.brand)}<span>${esc(offer.row.offer)}</span>`, offer.amount ? `<strong>${dollars(offer.amount)}</strong>` : 'Not stated', cars.map(carLink).join(', '), `${esc(offer.row.detail)}${cars.length === 1 ? `<span>${esc(offer.row.applies)}</span>` : '<span>Models and exclusions are in each car’s price guide.</span>'}`, endCell(offer)]));

  // By brand, from each guide's own headline cards
  const brands = [...new Set(vehicles.map(vehicle => config.cars[carKey(vehicle)].brand))].sort();
  const sourceByFrom = Object.fromEntries(sources.map(source => [source.from, source]));
  const brandHtml = brands.map(brand => {
    const cars = vehicles.filter(vehicle => config.cars[carKey(vehicle)].brand === brand);
    const links = (config.brandOffers[brand] || []).map(id => sourceByFrom[id]).filter(Boolean);
    return `<div class="dl-brand">
<h3>${brand} incentives, November 2026</h3>
${links.length ? `<p class="dl-brand__src">Offer pages read: ${links.map(source => `<a href="${source.url}" rel="noopener">${esc(source.title)}</a> (read for the ${source.vehicle.name} guide)`).join(', ')}.</p>` : `<p class="dl-brand__src">Read from the car’s price guide.</p>`}
<ul role="list" class="dl-brand__cars">
${cars.map(vehicle => `<li><h4>${carLink(vehicle)}</h4><ul role="list">
${vehicle.incentives.cards.map(card => {
      const end = cardEnd(card.text, config.asOf);
      const over = end && end < config.asOf;
      return `<li><strong>${esc(card.figure)}</strong> <span>${esc(card.word)}</span> ${esc(card.label)}. ${esc(card.text)}${over ? ' <span class="dl-flag">Over</span>' : ''}</li>`;
    }).join('\n')}
</ul></li>`).join('\n')}
</ul>
</div>`;
  }).join('\n');

  // Ends
  const byDate = new Map();
  for (const offer of ledger.filter(entry => named.includes(entry.kind) && entry.end.state !== 'over')) {
    const key = offer.end.state === 'mostly-over' ? 'mostly' : offer.end.first ?? 'none';
    if (!byDate.has(key)) byDate.set(key, []);
    byDate.get(key).push(offer);
  }
  const dateKeys = [...byDate.keys()].filter(key => /^\d{4}/.test(key)).sort();
  const endRow = (label, offers) => [label, String(offers.length), [...new Set(offers.map(offer => offer.car.brand))].sort().join(', ')];
  const endRows = [...dateKeys.map(key => endRow(longDate(key), byDate.get(key))), ...(byDate.has('none') ? [endRow('No date shown', byDate.get('none'))] : [])];
  const mostly = byDate.get('mostly') || [];
  const mostlyText = mostly.length ? `<p>Already over in most regions: ${mostly.map(offer => `${esc(offer.vehicle.name)} ${esc(offer.row.offer)} (${esc(offer.row.ends)})`).join('; ')}.</p>` : '';
  const endsTable = table('When each group of offers ends', ['Ends', 'Offers', 'Brands'], endRows);

  // Ledger
  const kindLabel = { apr: 'Rate', cash: 'Cash', lease: 'Lease', program: 'Program', used: 'Used or certified', none: 'No offer', other: 'Other' };
  const ledgerTable = table('Every offer in the 21 price guides', ['Car and offer', 'Kind', 'What it is', 'Applies to', 'Ends'],
    ledger.map(offer => [`${carLink(offer.vehicle)}<span>${esc(offer.row.offer)}</span>`, kindLabel[offer.kind], esc(offer.row.detail), esc(offer.row.applies), endCell(offer)]));

  requireSources(sources, [...Object.values(config.brandOffers).flat(), ...config.dealsExtra], 'deals page');
  tokens.readSpan = readSpan(vehicles);
  const lead = page.lead.map(text => fill(text, tokens));

  const body = `<article class="vp dl">
${header(page, config.updated)}
${tabs([['verdict', 'Verdict'], ['apr', '0% APR'], ['cash', 'Cash back'], ['choice', 'Cash or 0%?'], ['leases', 'Leases'], ['programs', 'Military and college'], ['brands', 'By brand'], ['regions', 'By ZIP'], ['ends', 'Ends'], ['faq', 'Questions'], ['sources', 'Sources']])}
<div class="vp-width vp-body dl-body">
<section id="verdict" class="vp-section vp-section--first">
<p class="vp-lead">${lead[0]}</p>
<p>${lead[1]}</p>
<h2 class="dl-sub">${page.picksHeading}</h2>
<ul class="vp-ic-offers dl-picks" role="list">
${pickHtml}
</ul>
</section>
${cta}

<section id="apr" class="vp-section">
<h2>${page.aprHeading}</h2>
<p>${page.aprIntro}</p>
${table('Financing offers from lowest rate up, to 3.99%', aprHead, aprFeatured.map(aprRow))}
<details class="vp-more"><summary>${page.aprMoreSummary}</summary>
${table('Financing offers above 3.99%', aprHead, aprRest.map(aprRow))}
</details>
</section>

<section id="cash" class="vp-section vp-section--band">
<h2>${page.cashHeading}</h2>
<p>${page.cashIntro}</p>
${table('Cash back offers from largest down', ['Cash', 'Car', 'Applies to', 'Fine print', 'Ends'], cash.map(cashRow))}
</section>

<section id="choice" class="vp-section">
<h2>${page.choiceHeading}</h2>
<p>${fill(page.choiceIntro, tokens)}</p>
${choiceTable}
<p class="vp-note">${page.choiceAfter}</p>
</section>

<section id="leases" class="vp-section vp-section--band">
<h2>${page.leaseHeading}</h2>
<p>${page.leaseIntro}</p>
${leaseHtml}
<p class="vp-note">${leaseKinds.length} lease offers are live; ${unranked} list their payments in a form we do not rank and appear in the full list below. Mileage limits differ by lease and each guide states them.</p>
</section>

<section id="programs" class="vp-section">
<h2>${page.programHeading}</h2>
<p>${page.programIntro}</p>
${programTable}
</section>

<section id="brands" class="vp-section vp-section--band">
<h2>${page.brandHeading}</h2>
${brandHtml}
</section>

<section id="regions" class="vp-section">
<h2>${page.regionHeading}</h2>
<p>${page.regionIntro}</p>
<ul class="vp-watch" role="list">
${page.regions.map(region => `<li>${region.text}</li>`).join('\n')}
</ul>
</section>

<section id="ends" class="vp-section vp-section--band">
<h2>${page.endsHeading}</h2>
<p>${page.endsIntro}</p>
${endsTable}
${mostlyText}
<details class="vp-more"><summary>${page.ledgerSummary}</summary>
${ledgerTable}
</details>
</section>

${plansSection('deal-new-car-deals-this-month')}

<section id="faq" class="vp-section vp-section--band">
<h2>Common questions</h2>
${faq([...page.faq, ...standardFaq])}
</section>

<section id="sources" class="vp-sources" aria-labelledby="guide-sources"><h2 id="guide-sources">Sources and updates</h2><p>Written by <a href="/about.html">Mason</a>, Steer Me Right’s founder and lead advisor. Every offer here comes from a car’s price guide, read ${tokens.readSpan}, and offers change without notice, so confirm each one with the dealer before you sign. The break-even rates are our estimate from the loan inputs in each price guide, not a promise. If something is out of date or wrong, email <a href="mailto:hello@steermeright.com">hello@steermeright.com</a> and we will correct it.</p>
<p>Price guides: ${vehicles.map(carLink).join(', ')}.</p>
${sourcesHtml(sources)}
<p>Related: ${page.related}.</p></section>
</div>
</article>`;
  return { slug: page.slug, title: page.title, description: page.description, h1: page.h1, crumbs: [['Resources', `${origin}/blog.html`], [page.crumb, `${origin}/${page.slug}`]], body, image: page.image, published: page.published };
}

export async function renderDealPages() {
  const [chrome, config, data, guideCss, dealCss] = await Promise.all([read(chromePage), read('data/deal-pages.json').then(JSON.parse), read('data/vehicle-pages.json').then(JSON.parse), read(guideSheet), read(dealSheet)]);
  const vehicles = data.vehicles;
  const links = `${sheetLink(guideSheet, guideCss)}\n    ${sheetLink(dealSheet, dealCss)}`;
  const builds = [
    msrpPage(config, vehicles, sourceList(config.sources.msrp, vehicles)),
    dealsPage(config, vehicles, sourceList(config.sources.deals, vehicles)),
  ];
  return builds.map(page => {
    const html = shell(chrome, { ...page, updated: config.updated }, page.body);
    return { slug: page.slug, html: html.replace('</head>', `    ${links}\n</head>`) };
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const check = process.argv.includes('--check');
  let stale = 0;
  for (const { slug, html } of await renderDealPages()) {
    if (check) {
      const current = await read(slug).catch(() => null);
      if (current !== html) { stale++; console.error(`${slug} is out of date. Run npm run build:deals.`); }
    } else {
      await writeFile(path.join(root, slug), html);
      console.log(`wrote ${slug}`);
    }
  }
  if (stale) process.exit(1);
  if (check) console.log('Deal pages match data/deal-pages.json and data/vehicle-pages.json.');
}
