// Builds the vehicle price pages (<make>-<model>-price.html) from data/vehicle-pages.json.
// The page chrome and the plan cards come from render-market-pages.mjs, so asset hashes follow
// car-negotiation-service.html. Run `npm run build:vehicles` after changing the data, this script,
// buying/price-guide.css or the chrome page; `npm run check:vehicles` fails when the files drift.
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { shell, plans } from './render-market-pages.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const origin = 'https://www.steermeright.com';
const chromePage = 'car-negotiation-service.html';
const stylesheet = 'buying/price-guide.css';
const read = file => readFile(path.join(root, file), 'utf8');
const longDate = iso => new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
const dollars = value => `$${value.toLocaleString('en-US')}`;
const paragraphs = list => list.map(text => `<p>${text}</p>`).join('\n');
const faq = entries => `<div class="faq-list">\n${entries.map(([question, answer]) => `<details><summary>${question}</summary><p>${answer}</p></details>`).join('\n')}\n</div>`;

// A table inside the shared scroll region. `head` and each row are arrays of cell HTML; the first cell of a row is its header.
function table(id, caption, head, rows) {
  return `<div class="compare-scroll" role="region" aria-labelledby="${id}" tabindex="0">
<table class="compare-table price-table">
<caption id="${id}" class="sr-only">${caption}</caption>
<thead><tr>${head.map(cell => `<th scope="col">${cell}</th>`).join('')}</tr></thead>
<tbody>
${rows.map(([first, ...rest]) => `<tr><th scope="row">${first}</th>${rest.map(cell => `<td>${cell}</td>`).join('')}</tr>`).join('\n')}
</tbody>
</table>
</div>`;
}

// Photos are licensed (Wikimedia Commons) and carry the credit each licence requires.
const credit = image => `Photo: <a href="${image.sourceUrl}" rel="noopener">${image.author}</a>, ${image.licenseUrl ? `<a href="${image.licenseUrl}" rel="noopener">${image.license}</a>` : image.license}${image.note ? `, ${image.note}` : ''}.`;
const picture = (image, widths, sizes, priority) => `<picture>${['avif', 'webp'].map(type => `<source type="image/${type}" srcset="${widths.map(width => `/assets/external/optimized/${image.file}-${width}.${type} ${width}w`).join(', ')}" sizes="${sizes}">`).join('')}<img src="/assets/external/source/${image.file}-original.jpg" alt="${image.alt}" width="${image.width}" height="${image.height}" decoding="async"${priority ? ' fetchpriority="high"' : ' loading="lazy"'}></picture>`;
const photo = (image, gallery) => `<figure class="price-photo">
${picture(image, [640, 960, 1600], '(max-width: 1040px) 94vw, 1000px', true)}
<figcaption>${image.caption} ${credit(image)}</figcaption>
</figure>
<ul class="price-gallery" role="list">
${gallery.map(item => `<li><figure>${picture(item, [480, 960], '(max-width: 700px) 46vw, 240px', false)}<figcaption><strong>${item.caption}</strong> ${credit(item)}</figcaption></figure></li>`).join('\n')}
</ul>`;

const percent = (value, max) => `${Math.round((value / max) * 1000) / 10}%`;
const stars = count => `<span class="price-stars" role="img" aria-label="${count} out of 5 stars">${'<i>★</i>'.repeat(count)}${'<i class="off">★</i>'.repeat(5 - count)}</span>`;
// One row per value: label, a bar scaled to `max`, and the value printed beside it.
const bars = (rows, max) => `<ul class="price-bars" role="list">
${rows.map(row => `<li><span class="price-bars__label">${row.label}</span><span class="price-bars__track" aria-hidden="true"><span style="--w:${percent(row.value, max)}"></span></span><span class="price-bars__value">${row.display ?? row.value}</span></li>`).join('\n')}
</ul>`;

function vehiclePage(vehicle, updated) {
  const checked = longDate(vehicle.checkedOn);
  const name = vehicle.name;
  const ask = `<a href="/schedule.html">Ask us</a>`;
  const topPrice = Math.max(...vehicle.trims.rows.map(trim => trim.prices[0]));
  const discountScale = 12;
  const walk = vehicle.pay.walk;
  const body = `<article class="guide-page page-width">
<p class="guide-breadcrumb"><a href="/blog.html">Resources</a> / ${name} price</p>
<header class="guide-heading"><h1>${vehicle.h1}</h1><p class="prose-meta">By <a href="/about.html">Mason</a> · Updated <time datetime="${updated}">${longDate(updated)}</time></p></header>
${photo(vehicle.photo, vehicle.gallery)}
<dl class="price-glance" aria-label="${name} at a glance">
${vehicle.glance.map(tile => `<div><dt>${tile.label}</dt><dd><span class="price-glance__figure">${tile.value}</span><span class="price-glance__note">${tile.note}</span></dd></div>`).join('\n')}
</dl>
<div class="guide-body">
<p class="price-lead">${vehicle.summary}</p>
<nav aria-label="Article contents"><p><a href="#reviews">Review scores</a> · <a href="#safety">Safety</a> · <a href="#trims">Trims and MSRP</a> · <a href="#pick">Our pick</a> · <a href="#pay">What to pay</a> · <a href="#incentives">Incentives</a> · <a href="#new-used">New, used or CPO</a> · <a href="#watch">What to watch for</a> · <a href="#faq">Questions</a></p></nav>

<div class="price-proscons">
<section><h2>What we like</h2><ul>${vehicle.pros.map(item => `<li>${item}</li>`).join('')}</ul></section>
<section><h2>What we’d think twice about</h2><ul>${vehicle.cons.map(item => `<li>${item}</li>`).join('')}</ul></section>
</div>

<h2 id="reviews">What the reviewers say</h2>
${vehicle.scores.intro ? `<p>${vehicle.scores.intro}</p>\n` : ''}<ul class="price-scores" role="list">
${vehicle.scores.cards.map(card => `<li><a href="${card.url}" rel="noopener">${card.source}</a><p class="price-scores__value">${card.display}<span> out of ${card.scale}</span></p><span class="price-meter" aria-hidden="true"><span style="--w:${percent(card.value, card.scale)}"></span></span><p class="price-scores__detail">${card.detail}</p></li>`).join('\n')}
</ul>
<p class="compare-note">${vehicle.scores.note}</p>

<h2 id="safety">Safety report card</h2>
<div class="price-report">
<div class="price-report__grade"><p class="price-report__score">${vehicle.safety.overall}<span> out of 5</span></p>${stars(vehicle.safety.overall)}<p>${vehicle.safety.label}</p><p class="price-report__vehicle">${vehicle.safety.vehicle}</p></div>
<dl class="price-report__tests">
${vehicle.safety.rows.map(row => `<div><dt>${row.label}</dt><dd>${stars(row.stars)}${row.note ? `<span>${row.note}</span>` : ''}</dd></div>`).join('\n')}
</dl>
<div class="price-report__recalls"><h3>${vehicle.safety.recallsTitle}</h3>
${bars(vehicle.safety.recalls, Math.max(...vehicle.safety.recalls.map(row => row.value)))}
<p>${vehicle.safety.reliability}</p></div>
</div>
<p class="compare-note">${vehicle.safety.note}</p>

<h2 id="trims">${vehicle.modelYear} ${name} trims and MSRP</h2>
${vehicle.trims.intro ? `${paragraphs(vehicle.trims.intro)}\n` : ''}<ul class="price-ladder" role="list">
${vehicle.trims.rows.map(trim => `<li><p class="price-ladder__name">${trim.name}<span>${trim.short}</span></p><span class="price-bars__track" aria-hidden="true"><span style="--w:${percent(trim.prices[0], topPrice)}"></span></span><p class="price-ladder__price">${dollars(trim.prices[0])}<span>${vehicle.trims.columns[1].replace(' MSRP', '')}: ${dollars(trim.prices[1])}</span></p><p class="price-ladder__room"><span>Room to negotiate</span>${trim.roomLabel}</p></li>`).join('\n')}
</ul>
<p class="compare-note">${vehicle.trims.note}</p>
${paragraphs(vehicle.trims.after)}
<details class="price-more"><summary>Engines and what each trim adds</summary>
${table('trim-caption', `${vehicle.modelYear} ${name} trims with starting MSRP, checked ${checked}`, ['Trim', ...vehicle.trims.columns, 'Engines', 'Room to negotiate'],
    vehicle.trims.rows.map(trim => [`${trim.name}<span>${trim.gets}</span>`, ...trim.prices.map(price => price ? `<strong>${dollars(price)}</strong>` : ask), trim.engine || ask, trim.room || ask]))}
</details>

<h2 id="pick">The trim we’d buy</h2>
${paragraphs(vehicle.pick)}

<h2 id="pay">What to pay: how far under MSRP</h2>
${paragraphs(vehicle.pay.intro)}
<div class="price-card">
<p class="price-key"><span class="price-key__fair"></span>A fair deal <span class="price-key__strong"></span>A strong deal starts here</p>
<ul class="price-range" role="list">
${vehicle.pay.rows.map(row => `<li><p class="price-range__name">${row.trims}</p><span class="price-range__track" aria-hidden="true">${row.fairHigh ? `<span class="price-range__fair" style="--from:${percent(row.fairLow, discountScale)};--w:${percent(row.fairHigh - row.fairLow, discountScale)}"></span>` : ''}${row.strongAt ? `<span class="price-range__strong" style="--from:${percent(row.strongAt, discountScale)}"></span>` : ''}</span><p class="price-range__value">${row.fair}<span>Strong: ${row.strong.toLowerCase()}</span></p></li>`).join('\n')}
</ul>
<p class="price-range__axis" aria-hidden="true"><span>MSRP</span><span>3%</span><span>6%</span><span>9%</span><span>12% under</span></p>
</div>
<p class="compare-note">${vehicle.pay.note}</p>
<div class="price-card">
<h3>${walk.title}</h3>
<ul class="price-walk" role="list">
<li><span class="price-bars__label">${walk.stickerLabel}</span><span class="price-walk__track" aria-hidden="true"><span class="price-walk__base" style="--w:100%"></span></span><span class="price-bars__value">${dollars(walk.sticker)}</span></li>
${walk.steps.map((step, index) => `<li><span class="price-bars__label">${step.label}</span><span class="price-walk__track" aria-hidden="true"><span class="price-walk__cut" style="--from:${percent(walk.sticker - walk.steps.slice(0, index + 1).reduce((sum, item) => sum + item.amount, 0), walk.sticker)};--w:${percent(step.amount, walk.sticker)}"></span></span><span class="price-bars__value">−${dollars(step.amount)}</span></li>`).join('\n')}
<li class="price-walk__total"><span class="price-bars__label">${walk.totalLabel}</span><span class="price-walk__track" aria-hidden="true"><span style="--w:${percent(walk.total, walk.sticker)}"></span></span><span class="price-bars__value">${dollars(walk.total)}</span></li>
</ul>
</div>
${paragraphs(vehicle.pay.after)}
</div>

${plans(`vehicle-${vehicle.slug.replace(/-price\.html$/, '')}`)}

<div class="guide-body">
<h2 id="incentives">${name} incentives right now</h2>
${paragraphs(vehicle.incentives.intro)}
<ul class="price-offers" role="list">
${vehicle.incentives.cards.map(card => `<li><p class="price-offers__big">${card.big}<span>${card.unit}</span></p><p>${card.short}</p></li>`).join('\n')}
</ul>
<p class="compare-note">${vehicle.incentives.note}</p>
${paragraphs(vehicle.incentives.after)}
<details class="price-more"><summary>Every offer, with dates and regions</summary>
${table('incentive-caption', `Manufacturer offers on the ${name}, checked ${checked}`, ['Offer', 'What it is', 'Applies to', 'Ends'],
    vehicle.incentives.rows.map(row => [row.offer, row.detail, row.applies, row.ends || ask]))}
</details>

<h2 id="new-used">New, used or CPO?</h2>
${paragraphs(vehicle.condition.intro)}
<div class="price-charts">
${vehicle.condition.charts.map(chart => `<section class="price-card"><h3>${chart.title}</h3>
${bars(chart.bars, Math.max(...chart.bars.map(row => row.value)))}
<p class="price-card__source">${chart.source}</p></section>`).join('\n')}
</div>
${paragraphs(vehicle.condition.after)}
<details class="price-more"><summary>Which route fits you, and what to check</summary>
${table('condition-caption', `Buying a ${name} new, certified pre-owned or used`, ['Route', 'Best when', 'What to check'],
    vehicle.condition.rows.map(row => [row.route, row.when, row.check]))}
</details>

<h2 id="rivals">Rivals worth pricing against it</h2>
${paragraphs(vehicle.rivals)}

<h2 id="watch">What to watch for at the dealer</h2>
<ul>
${vehicle.watch.map(item => `<li>${item}</li>`).join('\n')}
</ul>
<p>Compare dealers on the whole price in writing. The free <a href="/compare-car-quotes.html">quote comparison worksheet</a> lines offers up side by side, and the <a href="/blog-dealership-addons-complete-guide.html">dealership add-ons guide</a> covers what to ask about each extra.</p>

<h2 id="faq">Common questions</h2>
${faq([
    ...vehicle.faq,
    [`Can you negotiate a ${name} for me?`, `Yes. Steer Me Right charges a flat $395 for one model or $695 for up to three. We find it in dealer stock, get written out-the-door offers and negotiate for a price below MSRP. We can’t promise a specific discount: the market for a given car sets what a dealer will do.`],
    ['Do dealers pay you?', 'No. Dealers and lenders pay us nothing. You pay the flat fee, and you’re the only one we work for.'],
    ['What if I change my mind?', 'Cancel before negotiations begin and you get a full refund. During negotiations, refund eligibility depends on the work already done. Read the <a href="/policy.html#refund-policy">refund policy</a>.'],
  ])}

<div class="highlight-box"><p><strong>Rather not do this yourself?</strong> <a href="/schedule.html#full-service">The Steer Me Right plan is $395</a> and <a href="/schedule.html#concierge">Steer Me Right Pro is $695</a>, for new, used and CPO cars. Your advisor searches, works the dealers by phone and email, negotiates and checks the fees. Full refund if you cancel before negotiations begin. Dealers and lenders pay us nothing.</p></div>

<section class="guide-notes" aria-labelledby="guide-sources"><h2 id="guide-sources">Sources and updates</h2><p>Written by <a href="/about.html">Mason</a>, Steer Me Right’s founder and lead advisor. Prices, incentives and market figures were checked on ${checked} and change often, so confirm them with the dealer before you sign. The discount ranges are our estimate from the sources below, not a promise. If something is out of date or wrong, email <a href="mailto:hello@steermeright.com">hello@steermeright.com</a> and we will correct it.</p>
<details class="price-more"><summary>All ${vehicle.sources.length} sources</summary>
<ul>
${vehicle.sources.map(source => `<li><a href="${source.url}" rel="noopener">${source.title}</a>${source.note ? `: ${source.note}` : ''}</li>`).join('\n')}
</ul>
</details>
<p>Related: <a href="/new-car-buying-service.html">new car buying service</a>, <a href="/blog-buy-new-car-below-msrp.html">comparing complete new-car quotes</a> and <a href="/car-negotiation-service.html">car negotiation service</a>.</p></section>
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
