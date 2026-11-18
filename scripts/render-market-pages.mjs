// Builds the public city pages and their hub from data/market-pages.json.
// The page chrome (head assets, header, footer) is copied from car-negotiation-service.html,
// so asset hashes follow that page. Run `npm run build:markets` after changing the data, buying/market.css,
// this script, or the chrome page; `npm run check:markets` fails when the files drift.
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const origin = 'https://www.steermeright.com';
const chromePage = 'car-negotiation-service.html';
const read = file => readFile(path.join(root, file), 'utf8');
const escapeHtml = value => value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;');
const longDate = iso => new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
const numberWords = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
const joinNames = names => names.length < 3 ? names.join(' and ') : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;
const count = value => value.toLocaleString('en-US');
const dollars = value => `$${count(value)}`;

// Wraps a page body in the shared chrome. `crumbs` is [[name, url], ...] after Home.
export function shell(chrome, { slug, title, description, h1, published, updated, crumbs, image }, body) {
  const url = `${origin}/${slug}`;
  const start = chrome.indexOf('<main id="main-content" tabindex="-1">');
  const end = chrome.indexOf('</main>');
  const oldTitle = chrome.match(/<title>([^<]*)<\/title>/)[1];
  const oldDescription = chrome.match(/<meta name="description" content="([^"]*)">/)[1];
  if (start < 0 || end < 0) throw new Error(`${chromePage}: main element not found`);
  const schema = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Article',
        '@id': `${url}#article`,
        mainEntityOfPage: url,
        headline: h1,
        description,
        author: { '@type': 'Person', name: 'Mason', url: `${origin}/about.html` },
        publisher: { '@id': `${origin}/#organization` },
        datePublished: published,
        dateModified: updated,
        image: image || `${origin}/assets/external/social/drive-right-two-mazda-miatas-1200x630.jpg`,
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [['Home', `${origin}/`], ...crumbs].map(([name, item], index) => ({ '@type': 'ListItem', position: index + 1, name, item })),
      },
    ],
  };
  const head = chrome.slice(0, start)
    .replaceAll(oldTitle, escapeHtml(title))
    .replaceAll(oldDescription, escapeHtml(description))
    .replaceAll(`${origin}/${chromePage}`, url)
    .replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/, `<script type="application/ld+json">\n${JSON.stringify(schema, null, 2)}\n    </script>`);
  return `${head}<main id="main-content" tabindex="-1">\n${body}\n${chrome.slice(end)}`;
}

// The two plan cards, word for word from the approved plan copy (PLAN-NAMES, DRIVE-RIGHT-SCOPE and PRO-SCOPE of 2026-10-23).
// The buttons are plain /schedule.html links; script.js turns them into checkout. Do not add data-plan.
export const plans = location => `<section class="plan-grid guide-plans" aria-label="Steer Me Right plans">
  <article class="plan-card" data-featured>
    <h2>Steer Me Right</h2><p class="plan-for">Best if you know the car you want</p><p class="plan-description">One advisor finds it, works the dealers and handles the haggling.</p><p class="plan-price">$395<span>one-time service fee</span></p><p class="plan-assurance">Full refund if you cancel before negotiations begin.</p>
    <ul><li>One model, with any trims, colors and packages</li><li>New, used and CPO dealer inventory</li><li>We negotiate the price and check the fees</li><li>One dedicated advisor, start to finish</li><li>Written recommendations: what we found and what we’d do</li></ul>
    <a href="/schedule.html#full-service" data-cta-location="${location}" class="primary-button">Get Steer Me Right</a>
  </article>
  <article class="plan-card">
    <h2>Steer Me Right Pro</h2><p class="plan-for">Best if you’re torn between a few cars</p><p class="plan-description">Torn between a BMW X5 and a Mercedes GLE? We price up to three models and tell you which deal we’d take.</p><p class="plan-price">$695<span>one-time service fee</span></p><p class="plan-assurance">Full refund if you cancel before negotiations begin.</p>
    <ul><li>Everything in Steer Me Right</li><li>Offers on up to three models, priced side by side</li><li>We play each model’s dealers against each other’s written offers</li><li>Out-of-state dealers, and we help coordinate shipping when the dealer is open to it</li><li>First in line: your search starts ahead of Steer Me Right plan searches</li><li>Our pick of the best deal, judged on out-the-door price plus resale and running costs, not just the sticker</li></ul>
    <a href="/schedule.html#concierge" data-cta-location="${location}" class="outline-button">Get Steer Me Right Pro</a>
  </article>
</section>
<p class="plan-policy">A model means a make and model, like a BMW X5. Trims, colors and packages within a model don’t count extra. On the Steer Me Right plan, you can upgrade to Steer Me Right Pro later by paying the $300 difference.</p>`;

// City photos are licensed (Wikimedia Commons) and credited in the folded list under "Sources and updates".
const picture = (image, sizes) => `<picture>${['avif', 'webp'].map(type => `<source type="image/${type}" srcset="${[640, 960, 1600].map(width => `/assets/external/optimized/${image.file}-${width}.${type} ${width}w`).join(', ')}" sizes="${sizes}">`).join('')}<img src="/assets/external/source/${image.file}-original.jpg" alt="${image.alt}" width="${image.width}" height="${image.height}" decoding="async" fetchpriority="high"></picture>`;
const credits = market => `<details class="market-credits"><summary>Photo and map credits</summary><ul>${market.photo ? `<li>Photo: <a href="${market.photo.sourceUrl}" rel="noopener">${market.photo.author}</a>, <a href="${market.photo.licenseUrl}" rel="noopener">${market.photo.license}</a></li>` : ''}${market.mapSvg ? `<li>Map: drawn by Steer Me Right from US Census Bureau state boundaries${market.map.foreignLand ? ' and Natural Earth country boundaries (both public domain)' : ' (public domain)'}.</li>` : ''}</ul></details>`;
// Optional per-city sections: a photo, the dealer-circle map (data/market-maps/<id>.svg, from scripts/build-market-maps.mjs)
// and a "buying a car around <city>" section. A city without them renders as before.
const marketId = market => market.slug.replace(/^car-buying-service-|\.html$/g, '');
const stylesheet = 'buying/market.css';

const faq = entries => `<div class="faq-list">\n${entries.map(([question, answer]) => `<details><summary>${question}</summary><p>${answer}</p></details>`).join('\n')}\n</div>`;
const heading = (h1, updated) => `<header class="guide-heading"><h1>${h1}</h1><p class="prose-meta">By <a href="/about.html">Mason</a> · Updated <time datetime="${updated}">${longDate(updated)}</time></p></header>`;

// The figures block under "The <city> car market right now". Cities with listing counts show the dealer-listing table from the
// connector pull. A city with only public figures (`figures` in the data) shows each figure beside its named source and date instead.
function marketFigures(data, market, pulled) {
  if (market.figures) {
    const rows = market.figures.rows.map(([label, value, source]) => `<tr><th scope="row">${label}</th><td>${value}</td><td>${source}</td></tr>`).join('\n');
    return `<div class="compare-scroll" role="region" aria-labelledby="market-data-caption" tabindex="0">
<table class="compare-table market-figures">
<caption id="market-data-caption" class="sr-only">${market.figures.caption}</caption>
<thead><tr><th scope="col">Figure</th><th scope="col">${market.name}</th><th scope="col">Source and date</th></tr></thead>
<tbody>
${rows}
</tbody>
</table>
</div>
<p class="compare-note">${market.figures.note}</p>`;
  }
  return `<div class="compare-scroll" role="region" aria-labelledby="market-data-caption" tabindex="0">
<table class="compare-table">
<caption id="market-data-caption" class="sr-only">Dealer listings within ${data.inventory.radiusMiles} miles of ${market.center} (ZIP ${market.zip}) on ${pulled}</caption>
<thead><tr><th scope="col">Within ${data.inventory.radiusMiles} miles of ${market.center}</th><th scope="col">New cars</th><th scope="col">Used cars</th></tr></thead>
<tbody>
<tr><th scope="row">Dealer listings</th><td>${count(market.new)}</td><td>${count(market.used)}</td></tr>
<tr><th scope="row">Median asking price</th><td>${dollars(market.medianNew)}</td><td>${dollars(market.medianUsed)}</td></tr>
<tr><th scope="row">Most-listed makes</th><td>${market.topMakes.join(', ')}</td><td>Not pulled</td></tr>${market.franchiseDealers ? `\n<tr><th scope="row">Franchised dealerships</th><td colspan="2">${count(market.franchiseDealers)}</td></tr>` : ''}
</tbody>
</table>
</div>
<p class="compare-note">Dealer listings within ${data.inventory.radiusMiles} miles of ZIP ${market.zip}, from our API connector to dealership listings, the same data we use for client searches, pulled ${pulled}. Asking prices are what dealers advertise, not what cars sell for. Listings change daily, and a listed car may already be sold.</p>`;
}

function marketPage(data, market) {
  const pulled = longDate(data.inventory.pulledOn);
  const updated = market.updated || data.updated;
  const h1 = `Car buying service in ${market.name}: written offers from ${market.area} dealers, negotiated for you`;
  const others = data.markets.filter(other => other !== market).map(other => `<a href="/${other.slug}">${other.name}</a>`).join(' · ');
  const body = `<article class="guide-page page-width">
<p class="guide-breadcrumb"><a href="/car-buying-service.html">Car buying service</a> / <a href="/${data.hub.slug}">Cities</a> / ${market.name}</p>
${heading(h1, updated)}
<div class="guide-body">
${market.photo ? `<figure class="market-photo">${picture(market.photo, '(max-width: 900px) 94vw, 840px')}<figcaption>${market.photo.caption}</figcaption></figure>\n` : ''}<div class="highlight-box"><p><strong>Short answer:</strong> Steer Me Right is a flat-fee car buying service for ${market.area} buyers. We’re based in Austin and do the work by phone and email: we find the car, get written out-the-door offers from dealers around ${market.name} and negotiate the price and fees. It costs <strong>$395</strong> for one model or <strong>$695</strong> for up to three. Dealers and lenders pay us nothing.</p></div>
</div>

${plans(`market-${market.slug.replace(/^car-buying-service-|\.html$/g, '')}`)}

<div class="guide-body">
<nav aria-label="Article contents"><p><a href="#market">The market right now</a> · ${market.local ? `<a href="#local">Buying around ${market.name}</a> · ` : ''}<a href="#plan">Which plan fits</a> · <a href="#how">How it works</a> · <a href="#you">What stays with you</a> · <a href="#faq">Questions</a></p></nav>

<h2 id="market">The ${market.name} car market right now</h2>
<p>${market.market[0]}</p>
${marketFigures(data, market, pulled)}
<p>${market.market[1]}</p>
${market.mapSvg ? `<figure class="market-map">\n${market.mapSvg}<figcaption>${market.map.caption}</figcaption></figure>\n` : ''}${market.local ? `\n<h2 id="local">Buying a car around ${market.name}</h2>\n${market.local.map(([title, text]) => `<h3>${title}</h3>\n<p>${text}</p>`).join('\n')}\n` : ''}
<h2 id="plan">Which plan fits a ${market.name} buyer</h2>
<p>${market.plan}</p>
<p>Not sure? Tell us your situation and we’ll tell you which plan fits. No payment needed to ask, and we reply within one business day. Email <a href="mailto:hello@steermeright.com">hello@steermeright.com</a> or use “Talk to Mason” on the <a href="/schedule.html">pricing page</a>.</p>

<h2 id="how">How it works from ${market.name}</h2>
<ol>
<li><strong>You pay the flat fee and tell us the car.</strong> Model, trims and colors you’d accept, budget, and how far you’d go to pick it up. Mason replies within one business day to confirm the search and when it starts.</li>
<li><strong>We find the cars.</strong> Your advisor searches new, used and CPO dealer inventory for the model.</li>
<li><strong>We get written offers and negotiate.</strong> Each dealer is asked for an out-the-door price in writing. Offers go against each other, and add-ons and padded fees get questioned before you see a contract.</li>
<li><strong>You pick.</strong> We send written recommendations and our pick of the best deal. You make the final call, sign the paperwork and pick up the car from the dealer.</li>
</ol>
<p>Most searches take one to two weeks from payment to a signed deal. Rare specs and factory orders take longer, and we tell you that up front. We can’t promise a specific discount: the market for a given car sets what a dealer will do. The full process is on <a href="/how-it-works.html">how it works</a>.</p>

<h2 id="you">What stays with you</h2>
<p>You decide which car, if any, to buy. You arrange the inspection, pick the financing and insurance, read the contract and sign it. Our fee does not include the car, taxes, registration, inspection, financing, insurance or delivery. We don’t give tax or registration advice for your state; the dealer’s paperwork and your state’s motor vehicle agency are the sources for that.</p>

<h2 id="faq">Common questions</h2>
${faq([
    ...market.faq,
    [`How much does a car buying service cost in ${market.name}?`, `Steer Me Right charges the same flat fee everywhere: $395 for one model or $695 for up to three. Most services where a person negotiates for you charge $999 or more, by their own published prices; see <a href="/compare-car-buying-services.html">car buying services compared</a>.`],
    ['Do dealers pay you?', 'No. Dealers and lenders pay us nothing. You pay the flat fee, and you’re the only one we work for.'],
    ['What if I change my mind?', 'Cancel before negotiations begin and you get a full refund. During negotiations, refund eligibility depends on the work already done. Read the <a href="/policy.html#refund-policy">refund policy</a>.'],
  ])}

<div class="highlight-box"><p><strong>Ready to hand off the dealers?</strong> <a href="/schedule.html#full-service">The Steer Me Right plan is $395</a> and <a href="/schedule.html#concierge">Steer Me Right Pro is $695</a>, for new, used and CPO cars. Full refund if you cancel before negotiations begin. Dealers and lenders pay us nothing.</p></div>

<section class="guide-notes" aria-labelledby="guide-sources"><h2 id="guide-sources">Sources and updates</h2><p>Written by <a href="/about.html">Mason</a>, Steer Me Right’s founder and lead advisor. Steer Me Right is based in Austin, Texas, and has no office in ${market.name}. ${market.figures ? 'The market figures come from the public sources named in the table and will be refreshed when this page is updated.' : `The listing figures were pulled on ${pulled} and will be refreshed when this page is updated.`} If something is out of date or wrong, email <a href="mailto:hello@steermeright.com">hello@steermeright.com</a> and we will correct it.</p><p>Other cities: ${others} · <a href="/${data.hub.slug}">all cities</a>. Related: <a href="/car-negotiation-service.html">car negotiation service</a> and <a href="/car-buying-service-cost.html">what a car buying service costs</a>.</p>${market.photo || market.mapSvg ? credits(market) : ''}</section>
</div>
</article>`;
  return {
    slug: market.slug,
    title: `Car Buying Service in ${market.name}: Flat $395 | Steer Me Right`,
    description: `Car buying help in ${market.name}: we get written offers from ${market.area} dealers and negotiate price and fees for a flat $395 or $695. Dealers pay us nothing.`,
    h1,
    crumbs: [['Car buying service near you', `${origin}/${data.hub.slug}`], [market.name, `${origin}/${market.slug}`]],
    image: market.photo ? `${origin}/assets/external/source/${market.photo.file}-original.jpg` : undefined,
    published: market.published,
    updated,
    extras: Boolean(market.photo || market.mapSvg || market.local),
    body,
  };
}

function hubPage(data) {
  const pulled = longDate(data.inventory.pulledOn);
  const listed = data.markets.filter(market => !market.figures), publicOnly = data.markets.filter(market => market.figures);
  const rows = listed.map(market => `<tr><th scope="row"><a href="/${market.slug}">${market.name}</a></th><td>${count(market.new)}</td><td>${count(market.used)}</td><td>${dollars(market.medianNew)}</td><td>${dollars(market.medianUsed)}</td></tr>`).join('\n');
  const body = `<article class="guide-page page-width">
<p class="guide-breadcrumb"><a href="/car-buying-service.html">Car buying service</a> / Cities</p>
${heading(data.hub.h1, data.updated)}
<div class="guide-body">
<div class="highlight-box"><p><strong>Short answer:</strong> Steer Me Right has one office, in Austin, Texas, and works with dealers in every state by phone and email. What matters for your deal is the dealers near you, not an office near you. We find the car, get written out-the-door offers from those dealers and negotiate the price and fees for a flat <strong>$395</strong> (one model) or <strong>$695</strong> (up to three models). Dealers and lenders pay us nothing.</p></div>
</div>

${plans('market-hub')}

<div class="guide-body">
<nav aria-label="Article contents"><p><a href="#near">What “near me” means here</a> · <a href="#cities">Cities with local numbers</a> · <a href="#other">Somewhere else</a> · <a href="#faq">Questions</a></p></nav>

<h2 id="near">What “near me” means for a car buying service</h2>
<p>You don’t visit us, and we don’t visit the dealer. A negotiation happens by phone and email whether the advisor is across town or across the country, and the dealer’s written offer reads the same either way. The local part is the inventory: which dealers within driving distance of you have the car, and what each will put in writing.</p>
<p>So the useful question is not “is there a car buying service in my city?” It is “will this one contact the dealers around me, and who pays it?” We contact dealers that have your car in stock wherever you live. You pay us a flat fee, and nobody else pays us anything.</p>

<h2 id="cities">Cities where we’ve published local numbers</h2>
<p>For these ${numberWords[listed.length]} metros we pulled how many cars dealers had listed and what they were asking, so you can see the size of the market we’d be working for you. Each page also explains which plan fits if dealers near you sit across a state line.</p>
<div class="compare-scroll" role="region" aria-labelledby="hub-data-caption" tabindex="0">
<table class="compare-table">
<caption id="hub-data-caption" class="sr-only">Dealer listings within ${data.inventory.radiusMiles} miles of each city center on ${pulled}</caption>
<thead><tr><th scope="col">City</th><th scope="col">New cars listed</th><th scope="col">Used cars listed</th><th scope="col">Median new asking price</th><th scope="col">Median used asking price</th></tr></thead>
<tbody>
${rows}
</tbody>
</table>
</div>
<p class="compare-note">Dealer listings within ${data.inventory.radiusMiles} miles of each city center, from our API connector to dealership listings, the same data we use for client searches, pulled ${pulled}. Asking prices are what dealers advertise, not what cars sell for. Listings change daily, and a listed car may already be sold.</p>
${publicOnly.length ? `<p>${joinNames(publicOnly.map(market => `<a href="/${market.slug}">${market.name}</a>`))} have no listing numbers here. For those ${numberWords[publicOnly.length]}, each page shows figures that public sources have published, with the source and date beside each one.</p>\n` : ''}<p>In Texas, where we’re based, see <a href="/austin.html">car buying in Austin</a> and the <a href="/texas-local-market-intelligence.html">Texas local markets</a> page.</p>

<h2 id="other">If your city isn’t listed</h2>
<p>The list above is only where we’ve published numbers so far. The service is the same everywhere in the United States, at the same fee. One rule changes with where you live: the Steer Me Right plan ($395) does not include out-of-state dealers, and Steer Me Right Pro ($695) does. If the nearest big dealer cluster is across a state line from you, Pro is usually the plan to look at.</p>
<p>Not sure? Tell us your situation and we’ll tell you which plan fits. No payment needed to ask, and we reply within one business day. Email <a href="mailto:hello@steermeright.com">hello@steermeright.com</a> or use “Talk to Mason” on the <a href="/schedule.html">pricing page</a>.</p>

<h2 id="faq">Common questions</h2>
${faq([
    ['Is there a car buying service near me?', 'Steer Me Right works with dealers in every state from one office in Austin, Texas. The work is done by phone and email, so you don’t need a local office. You pick up the car from the dealer.'],
    ['Do you charge more in bigger cities?', 'No. The fee is $395 for one model or $695 for up to three, wherever you live.'],
    ['Can you use dealers in a neighboring state?', 'Yes, on Steer Me Right Pro, which includes out-of-state dealers and help coordinating shipping when the dealer is open to it. The Steer Me Right plan covers dealers in your own state.'],
    ['Do dealers pay you?', 'No. Dealers and lenders pay us nothing. You pay the flat fee, and you’re the only one we work for.'],
    ['What if I change my mind?', 'Cancel before negotiations begin and you get a full refund. During negotiations, refund eligibility depends on the work already done. Read the <a href="/policy.html#refund-policy">refund policy</a>.'],
  ])}

<div class="highlight-box"><p><strong>Ready to hand off the dealers?</strong> <a href="/schedule.html#full-service">The Steer Me Right plan is $395</a> and <a href="/schedule.html#concierge">Steer Me Right Pro is $695</a>, for new, used and CPO cars. Full refund if you cancel before negotiations begin. Dealers and lenders pay us nothing.</p></div>

<section class="guide-notes" aria-labelledby="guide-sources"><h2 id="guide-sources">Sources and updates</h2><p>Written by <a href="/about.html">Mason</a>, Steer Me Right’s founder and lead advisor. Steer Me Right is based in Austin, Texas, and has no other office. The listing figures were pulled on ${pulled} and will be refreshed when this page is updated. If something is out of date or wrong, email <a href="mailto:hello@steermeright.com">hello@steermeright.com</a> and we will correct it.</p><p>Related: <a href="/car-buying-service.html">car buying service</a>, <a href="/car-negotiation-service.html">car negotiation service</a> and <a href="/compare-car-buying-services.html">car buying services compared</a>.</p></section>
</div>
</article>`;
  return { slug: data.hub.slug, title: data.hub.title, description: data.hub.description, h1: data.hub.h1, crumbs: [['Car buying service near you', `${origin}/${data.hub.slug}`]], body };
}

export async function renderMarketPages() {
  const [chrome, data, css] = await Promise.all([read(chromePage), read('data/market-pages.json').then(JSON.parse), readFile(path.join(root, stylesheet))]);
  for (const market of data.markets) if (market.map) market.mapSvg = await read(`data/market-maps/${marketId(market)}.svg`);
  const link = `<link rel="stylesheet" href="/${stylesheet}?v=${createHash('sha256').update(css).digest('hex').slice(0, 12)}">`;
  return [hubPage(data), ...data.markets.map(market => marketPage(data, market))]
    .map(page => {
      const html = shell(chrome, { ...page, published: page.published || data.published, updated: page.updated || data.updated }, page.body);
      return { slug: page.slug, html: page.extras ? html.replace('</head>', `    ${link}\n</head>`) : html };
    });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const check = process.argv.includes('--check');
  let stale = 0;
  for (const { slug, html } of await renderMarketPages()) {
    if (check) {
      const current = await read(slug).catch(() => null);
      if (current !== html) { stale++; console.error(`${slug} is out of date. Run npm run build:markets.`); }
    } else {
      await writeFile(path.join(root, slug), html);
      console.log(`wrote ${slug}`);
    }
  }
  if (stale) process.exit(1);
  if (check) console.log('Market pages match data/market-pages.json.');
}
