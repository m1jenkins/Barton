import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { csvRows, origin } from './metro-release.mjs';
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
export function renderMarket(market, dossier, services, sources) {
  const names = { M04: 'Dallas–Fort Worth', M05: 'Houston', 'TX-AUS': 'Austin' };
  const scenarios = {
    M04: 'If you live in the Dallas–Fort Worth area and see a car outside your immediate search area, compare the written vehicle offer and the buyer-paid shipping charge before deciding.',
    M05: 'If you live in the Houston area and are considering cars from more than one seller, ask for comparable written offers and shipping estimates before deciding.',
    'TX-AUS': 'If you live in Austin and are open to a car from another city, include the seller’s written terms and buyer-paid shipping charge in the same comparison.',
  };
  const localName = names[market.id];
  if (!localName || !dossier?.firstPartyProof?.review) throw new Error(`${market.id}: missing draft or attested review`);
  const review = dossier.firstPartyProof.review;
  const hasModules = Array.isArray(dossier.modules) && dossier.modules.length > 0;
  const hasCompleteModules = hasModules
    && dossier.modules.length >= 2
    && dossier.modules.every(module => Array.isArray(module?.claimIds) && module.claimIds.length > 0
      && Array.isArray(module?.sourceIds) && module.sourceIds.length > 0
      && module.claimIds.every(id => market.claimIds?.includes(id))
      && module.sourceIds.every(id => market.sourceIds?.includes(id)));
  const modules = hasModules
    ? `\n<div class="module-grid">${dossier.modules.map((module, i) => {
      const citations = module.sourceIds.map(id => {
        const source = sources.find(item => item.source_id === id);
        if (!source?.source_url?.trim() || !source.source_title?.trim()) throw new Error(`${module.id}: missing citation URL or title for source ${id}`);
        return `<a href="${escape(source.source_url)}">${escape(source.source_title)}</a>`;
      }).join('; ');
      return `<section class="local-module" aria-labelledby="module-${i}"><p class="eyebrow">Local decision ${String(i + 1).padStart(2, '0')}</p><h2 id="module-${i}">${escape(module.title)}</h2><p>${escape(module.body)}</p><p><strong>Your next step.</strong> ${escape(module.decision)}</p><p>${escape(module.limitations)}</p><p class="source">Sources: ${citations} · Retrieved ${escape(module.asOf)}. Draft interpretation; qualified review pending.</p></section>`;
    }).join('\n')}</div>`
    : '';
  const moduleStatus = hasCompleteModules
    ? 'Claim/source-mapped local modules are present.'
    : 'Distinct local buyer evidence and two claim/source-mapped local modules are still missing.';
  const intro = `Remote car-finding and buying support for ${localName} buyers. Start with your vehicle needs, then compare real offers before you choose.`;
  const body = `<nav aria-label="Breadcrumb" class="breadcrumbs"><a href="/service-areas.html">Service areas</a><span aria-hidden="true"> / </span>${escape(localName)}</nav>
<section class="metro-hero"><p class="eyebrow">Private local draft</p><h1>Car-buying help in<br><em>${escape(localName)}.</em></h1><p class="lead">${escape(intro)}</p><a class="draft-button" href="#buying-brief">Prepare your buying brief <span aria-hidden="true">↗</span></a></section>
<section class="intro-grid" aria-labelledby="approach"><h2 id="approach">A clearer search,<br>from wherever you are.</h2><div><p>Drive Right helps buyers remotely find cars, compare options, communicate with sellers and negotiate purchase terms within the chosen plan. You decide whether to buy. The agency does not inspect vehicles, attend visits, handle vehicle registration or perform vehicle safety work.</p><p>Start with the car you want, your budget and the locations you would consider. Seller participation and vehicle availability depend on the particular search. Buyers pay vehicle shipping charges, in addition to the vehicle price and Drive Right service fee.</p><ol><li>Describe the vehicle and the decision you need help making.</li><li>Compare written offers and unresolved seller terms.</li><li>Choose the car and shipping arrangement that work for you.</li></ol></div></section>
<section class="local-module" aria-labelledby="scenario-title"><p class="eyebrow">Hypothetical buyer scenario</p><h2 id="scenario-title">Compare offers across locations.</h2><p>${escape(scenarios[market.id])}</p><p>This is a planning example, not a finding about local prices, supply or buyer demand.</p></section>${modules}
<section class="worksheet" aria-labelledby="worksheet-title"><p class="eyebrow">A practical comparison</p><h2 id="worksheet-title">${escape(dossier.example.title)}</h2><p>${escape(dossier.example.disclosure)}</p><div class="table-scroll" role="region" aria-label="Vehicle comparison worksheet" tabindex="0"><table><caption>Complete from written information; leave unknowns unresolved.</caption><thead><tr><th scope="col">Question to resolve</th><th scope="col">Option A</th><th scope="col">Option B</th></tr></thead><tbody>${dossier.example.rows.map(r => `<tr><th scope="row">${escape(r)}</th><td>Not yet recorded</td><td>Not yet recorded</td></tr>`).join('')}</tbody></table></div></section>
<section class="local-module" aria-labelledby="review-title"><p class="eyebrow">Historical customer words</p><h2 id="review-title">A buyer’s own account.</h2><blockquote><p>${escape(review.exact_quote)}</p><footer>— ${escape(review.name)} · Historical city label: ${escape(review.historical_city_label)}</footer></blockquote><p>This historical statement is presented with the business owner’s attestation of the original, publication permission and supporting records. It does not establish a ${escape(localName)} transaction or a typical result.</p></section>
<section class="plans" aria-labelledby="plans"><h2 id="plans">Choose the support<br>your search needs.</h2><p>These are the current central-page service fees. Check the central plan and policy for scope and terms. Vehicle price and buyer-paid shipping charges are separate.</p><ul>${services.services.map(s => `<li><h3>${escape(s.name)}</h3><p class="price">$${s.price} <span>service fee</span></p></li>`).join('')}</ul><a class="text-link" href="/schedule.html">Read the central plan reference</a></section>
<section class="questions" aria-labelledby="questions"><h2 id="questions">Questions for your search.</h2><details open><summary>Can Drive Right meet me at a seller?</summary><p>No. The car-finding and buying support described here is remote. Drive Right does not attend visits.</p></details><details open><summary>Who pays to ship a vehicle?</summary><p>The buyer pays vehicle shipping charges. Compare a written shipping quote with the vehicle offer before deciding.</p></details><details open><summary>Does this page establish local prices or availability?</summary><p>No. The scenario and worksheet are planning aids. Local buyer and market evidence is still insufficient for release.</p></details></section>
<section id="buying-brief" class="brief" aria-labelledby="brief-title"><div><p class="eyebrow">Your starting point</p><h2 id="brief-title">Make room for<br>a clearer decision.</h2><p>Note the vehicle, budget and seller locations you would consider. This local worksheet sends nothing and does not reserve a service.</p></div><fieldset><legend>Practice buying brief — stays on this page</legend><label for="buyer-zip">Buyer ZIP</label><input id="buyer-zip" name="buyer-zip" inputmode="numeric" maxlength="5" autocomplete="off"><label for="vehicle">Vehicle needs</label><textarea id="vehicle" name="vehicle" rows="3"></textarea><label for="questions-note">Questions about offers or shipping</label><textarea id="questions-note" name="questions-note" rows="3"></textarea><p>No information is submitted or saved by Drive Right.</p></fieldset></section>
<section class="draft-boundary" aria-label="Release status"><h2>Private draft status</h2><p>${moduleStatus} Analytics baseline, editorial review, qualified review and release QA remain pending. This page is not approved for publication.</p></section>`;
  return layout({ title:`Car-buying help in ${localName}`, description:intro, slug:market.slug, marketId:market.id, body });
}
export function renderHub(markets) {
  return layout({ title:'Service areas — private planning draft', description:'Private remote car-buying service-area drafts.', slug:'service-areas.html', body:`<section class="metro-hero"><p class="eyebrow">Drive Right · Austin, Texas</p><h1>A clearer car search.<br><em>Wherever you begin.</em></h1><p class="lead">Drive Right helps people find and buy cars remotely. These service-area pages are private editorial drafts. No market below has passed its local evidence and release gates.</p></section><section class="module-grid" aria-label="Pilot drafts">${markets.map(m => `<article class="local-module"><h2><a href="/${escape(m.slug)}">${escape(m.name)}</a></h2><p>Explore a remote buying brief, hypothetical comparison and historical customer words. Local market evidence remains insufficient for publication.</p><a class="text-link" href="/${escape(m.slug)}">Read the draft</a></article>`).join('')}</section><section class="intro-grid"><h2>Remote support.<br>Buyer choice.</h2><div><p>The business owner has confirmed current-tier availability. Drive Right can help buyers research cars, compare written offers and communicate with sellers. Buyers decide whether to purchase and pay vehicle shipping charges. Drive Right does not inspect vehicles, attend visits, register vehicles or perform safety work.</p><p>These drafts do not claim local prices, inventory, demand or completed transactions. Google Search Console, GA4 and lead, purchase and backlink baselines remain pending. Each page needs distinct local evidence and the existing reviews before it can be released.</p></div></section>` });
}
export async function renderDrafts({ root = fileURLToPath(new URL('..', import.meta.url)), output = draftRoot, check = false } = {}) {
  const readJson = async file => JSON.parse(await readFile(path.join(root, file), 'utf8'));
  const [registry, dossiers, services, sources] = await Promise.all([
    ...['data/metro-release.json','data/metro-dossiers.json','data/services.json'].map(readJson),
    readFile(path.join(root, 'data/source-registry.csv'), 'utf8').then(csvRows),
  ]);
  const markets = registry.markets.filter(m => ['M04','M05','TX-AUS'].includes(m.id));
  const pages = new Map(markets.map(m => [m.slug, renderMarket(m, dossiers.find(d => d.marketId === m.id), services, sources)]));
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
