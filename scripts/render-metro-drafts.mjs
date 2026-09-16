import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { origin } from './metro-release.mjs';
export const draftRoot = fileURLToPath(new URL('../draft-artifacts/metros/', import.meta.url));
const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[c]);
function layout({ title, description, slug, marketId = 'hub', body }) {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escape(title)} | Drive Right</title><meta name="description" content="${escape(description)}">
<meta name="robots" content="noindex, nofollow"><meta name="barton-metro-id" content="${escape(marketId)}">
<link rel="canonical" href="${origin}/${escape(slug)}"><link rel="icon" href="/favicon.png">
<link rel="stylesheet" href="/buying/daisy.css"><link rel="stylesheet" href="/metro-draft.css">
</head><body>
<a class="skip-link" href="#main-content">Skip to content</a>
<div class="draft-notice">Local editorial draft · September 16, 2026 · factual and qualified review pending</div>
<header class="site-header page-width"><a class="wordmark" href="/service-areas.html" aria-label="Drive Right draft service areas">Drive Right</a><nav aria-label="Main navigation"><a href="/service-areas.html">Areas</a><a href="/how-it-works.html">How it works</a><a href="/schedule.html">Plans</a></nav></header>
<main id="main-content" tabindex="-1" class="page-width">${body}</main>
<footer class="page-width site-footer"><p>Drive Right · Based in Austin, Texas<br>512-910-4938 · hello@driverightcarbuying.com</p><p>Local review copy. No form sends, checkout or tracking.<br><a href="/policy.html">Policy reference</a></p></footer>
</body></html>\n`;
}
export function renderMarket(market, dossier, services) {
  const localName = market.id === 'M04' ? 'Dallas–Fort Worth' : 'Houston';
  const intro = market.id === 'M04'
    ? 'Compare a Dallas, Fort Worth or Arlington shortlist as one buying decision. Keep the vehicle, seller location, registration county and handover plan together before making a trip.'
    : 'Build a Houston-area shortlist around the car and the transaction. A listing in Houston, Pasadena or The Woodlands still needs its own history, paperwork and pickup questions.';
  const modules = dossier.modules.map((m, i) => `<section class="local-module" aria-labelledby="module-${i}"><p class="eyebrow">Local decision ${String(i + 1).padStart(2, '0')}</p><h2 id="module-${i}">${escape(m.title)}</h2><p>${escape(m.body)}</p><p><strong>Your next step.</strong> ${escape(m.decision)}</p><p>${escape(m.limitations)}</p><p class="source">Sources: ${m.sources.map(s => `<a href="${escape(s.url)}">${escape(s.title)}</a>`).join('; ')} · Retrieved ${escape(m.asOf)}. Draft interpretation; qualified review pending.</p></section>`).join('\n');
  const body = `<nav aria-label="Breadcrumb" class="breadcrumbs"><a href="/service-areas.html">Service areas</a><span aria-hidden="true"> / </span>${escape(localName)}</nav>
<section class="metro-hero"><p class="eyebrow">A considered car search</p><h1>Car-buying help in<br><em>${escape(localName)}.</em></h1><p class="lead">${escape(intro)}</p><a class="draft-button" href="#buying-brief">Prepare your buying brief <span aria-hidden="true">↗</span></a></section>
<section class="intro-grid" aria-labelledby="approach"><h2 id="approach">Start with the decision<br>you need to make.</h2><div><p>Drive Right is based in Austin. Its service plans cover research, comparing options and seller communication at different levels of support. You choose the plan and decide whether to purchase.</p><p>This draft is for buyers comparing new, used or certified pre-owned vehicles. Owner-confirmed tier availability includes this market. In-person attendance, seller participation, delivery arrangements and response times still need an engagement-specific scope; none is promised here.</p><ol><li>Write down your vehicle needs, budget, buyer ZIP and acceptable seller locations.</li><li>Compare written quotes on the same basis and keep unresolved conditions visible.</li><li>Confirm inspection, paperwork and handover responsibilities before committing.</li></ol></div></section>
<div class="module-grid">${modules}</div>
<section class="worksheet" aria-labelledby="worksheet-title"><p class="eyebrow">A practical comparison</p><h2 id="worksheet-title">${escape(dossier.example.title)}</h2><p>${escape(dossier.example.disclosure)}</p><div class="table-scroll" role="region" aria-label="Vehicle comparison worksheet" tabindex="0"><table><caption>Complete from the seller’s written information; leave unknowns unresolved.</caption><thead><tr><th scope="col">Question to resolve</th><th scope="col">Option A</th><th scope="col">Option B</th></tr></thead><tbody>${dossier.example.rows.map(r => `<tr><th scope="row">${escape(r)}</th><td>Not yet recorded</td><td>Not yet recorded</td></tr>`).join('')}</tbody></table></div><p>No customer outcome is implied. An existing review does not establish a ${escape(localName)} transaction or a typical saving.</p></section>
<section class="plans" aria-labelledby="plans"><h2 id="plans">Choose the support<br>your search needs.</h2><p>These are the current central-page service fees observed in the repository. Check the central plan and policy for scope and terms; vehicle costs, taxes and third-party arrangements are separate questions to confirm.</p><ul>${services.services.map(s => `<li><h3>${escape(s.name)}</h3><p class="price">$${s.price} <span>service fee</span></p></li>`).join('')}</ul><a class="text-link" href="/schedule.html">Read the central plan reference</a></section>
<section class="questions" aria-labelledby="questions"><h2 id="questions">Before you choose a car.</h2><details open><summary>Is there a local Drive Right office?</summary><p>Drive Right is based in Austin. This page describes a service area, not a branch office or walk-in location.</p></details><details open><summary>Who arranges the inspection and pickup?</summary><p>Confirm the parties, appointments, costs and any carrier arrangements in writing for the engagement. The draft does not establish advisor attendance, an inspection booking or delivery eligibility.</p></details><details open><summary>Does a lower advertised price settle the comparison?</summary><p>Use the worksheet to collect the written price, charges, conditions and unresolved arrangements for each vehicle. A blank field is a question to resolve, not a zero-dollar cost.</p></details></section>
<section id="buying-brief" class="brief" aria-labelledby="brief-title"><div><p class="eyebrow">Your starting point</p><h2 id="brief-title">Make room for<br>a clearer decision.</h2><p>Note the vehicle, county and open questions you want to discuss. This local worksheet sends nothing and does not reserve a service.</p></div><fieldset><legend>Practice buying brief — stays on this page</legend><label for="buyer-zip">Buyer ZIP</label><input id="buyer-zip" name="buyer-zip" inputmode="numeric" maxlength="5" autocomplete="off"><label for="vehicle">Vehicle needs</label><textarea id="vehicle" name="vehicle" rows="3"></textarea><label for="questions-note">Questions before inspection or pickup</label><textarea id="questions-note" name="questions-note" rows="3"></textarea><p>No information is submitted or saved by Drive Right.</p></fieldset></section>`;
  return layout({title:`Car-buying help in ${localName}`,description:intro,slug:market.slug,marketId:market.id,body});
}
export function renderHub(markets) {
  return layout({ title:'Service areas — local planning draft', description:'Review the Dallas–Fort Worth and Houston local planning drafts.', slug:'service-areas.html', body:`<section class="metro-hero"><p class="eyebrow">Drive Right · Austin, Texas</p><h1>A clearer car search.<br><em>Local decisions matter.</em></h1><p class="lead">Review the first two metro drafts below. These links are local editorial previews; no market in this hub has passed the factual release gate.</p></section><section class="module-grid" aria-label="Pilot drafts">${markets.map(m => `<article class="local-module"><h2><a href="/${escape(m.slug)}">${escape(m.name)}</a></h2><p>${m.id === 'M04' ? 'One DFW comparison, with registration-county and transaction planning.' : 'Houston-area vehicle questions, county boundaries and a written comparison.'}</p><a class="text-link" href="/${escape(m.slug)}">Read the draft</a></article>`).join('')}</section><section class="intro-grid"><h2>Based in Austin.<br>Scope before commitments.</h2><div><p>The owner has confirmed current-tier availability across states and cities. Specific logistics and consequential wording still require evidence and review before a market is released. This draft makes no nationwide checkout or delivery promise.</p><p>Austin has a separate evidence dossier. The wider candidate list is a research queue, not a list of published offices.</p><a class="text-link" href="/texas-local-market-intelligence.html">Texas market reference</a></div></section>` });
}
export async function renderDrafts({ root = fileURLToPath(new URL('..', import.meta.url)), output = draftRoot, check = false } = {}) {
  const readJson = async file => JSON.parse(await readFile(path.join(root, file), 'utf8'));
  const [registry, dossiers, services] = await Promise.all(['data/metro-release.json','data/metro-dossiers.json','data/services.json'].map(readJson));
  const markets = registry.markets.filter(m => ['M04','M05'].includes(m.id));
  const pages = new Map(markets.map(m => [m.slug, renderMarket(m, dossiers.find(d => d.marketId === m.id), services)]));
  pages.set('service-areas.html', renderHub(markets));
  await mkdir(output, { recursive:true });
  for (const [file, html] of pages) {
    if (check) { if (await readFile(path.join(output,file),'utf8') !== html) throw new Error(`${file}: stale draft; run npm run draft:metros`); }
    else await writeFile(path.join(output,file),html);
  }
  return pages;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const pages = await renderDrafts({ check: process.argv.includes('--check') });
  console.log(`${process.argv.includes('--check') ? 'Verified' : 'Rendered'} ${pages.size} local-only drafts in draft-artifacts/metros. No public files changed.`);
}
