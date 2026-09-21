import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { origin, htmlDocument } from './metro-release.mjs';

export const projectRoot = fileURLToPath(new URL('..', import.meta.url));
export const cityDraftRoot = path.join(projectRoot, 'draft-artifacts/cities');
export const requestedCities = ['New York City', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix', 'Philadelphia', 'San Antonio', 'San Diego', 'Dallas', 'Fort Worth', 'Jacksonville', 'Austin', 'San Jose', 'Charlotte', 'Columbus', 'Indianapolis', 'San Francisco', 'Seattle', 'Denver', 'Nashville'];
const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export function validateCityData(data) {
  if (data.status !== 'private_draft' || data.publicationReview !== null) throw new Error('City collection must retain private-draft status until a governed release');
  if (JSON.stringify(data.cities?.map(c => c.name)) !== JSON.stringify(requestedCities)) throw new Error('City collection must match the requested 20 cities in order');
  if (new Set(data.cities.map(c => c.slug)).size !== 20) throw new Error('Duplicate city slug');
  for (const city of data.cities) {
    if (!/^[a-z0-9-]+\.html$/.test(city.slug)) throw new Error(`Invalid city slug: ${city.slug}`);
    if (!city.state || !city.localSentence || city.localSentence.split(/\s+/).length > 40) throw new Error(`${city.name}: provide a short local sentence`);
  }
}

function replaceRequired(html, from, to) {
  if (!html.includes(from)) throw new Error(`Homepage copy changed; review city substitution: ${from}`);
  return html.replace(from, to);
}

function pageMetadata(homepage, { slug, title, description, city }) {
  const url = `${origin}/${slug}`;
  const homeTitle = homepage.match(/<title>([^<]+)<\/title>/)?.[1];
  const homeDescription = homepage.match(/<meta name="description" content="([^"]+)">/)?.[1];
  if (!homeTitle || !homeDescription) throw new Error('Homepage metadata is missing');
  let html = homepage.replaceAll(homeTitle, escape(title)).replaceAll(homeDescription, escape(description));
  html = replaceRequired(html, '<meta name="robots" content="index, follow">', `<meta name="robots" content="noindex, nofollow">\n    <meta name="barton-metro-id" content="CITY-${escape(slug.replace('.html', ''))}">`);
  for (const tag of ['<link rel="canonical" href=', '<meta property="og:url" content=', '<meta name="twitter:url" content=']) {
    html = replaceRequired(html, `${tag}"${origin}/">`, `${tag}"${url}">`);
  }
  const area = city ? { '@type': 'City', name: city.name, containedInPlace: { '@type': 'State', name: city.state } } : { '@type': 'Country', name: 'United States' };
  return html.replace(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g, (_, json) => {
    let schema = JSON.parse(json);
    if (schema['@graph']) {
      for (const node of schema['@graph']) {
        if (node['@type'] === 'Organization') {
          node.description = 'Drive Right is based in Austin and provides remote vehicle research, offer comparison, and seller communication.';
          node.areaServed = { '@type': 'Country', name: 'United States' };
          node.contactPoint.areaServed = 'US';
        } else if (node['@type'] === 'Service') node.areaServed = area;
      }
    } else if (schema['@type'] === 'BreadcrumbList') {
      schema.itemListElement.push({ '@type': 'ListItem', position: 2, name: city?.name || 'Cities', item: url });
    } else if (schema['@type'] === 'WebSite') {
      schema = { '@context': 'https://schema.org', '@type': city ? 'WebPage' : 'CollectionPage', '@id': `${url}#webpage`, url, name: title, description, inLanguage: 'en-US', publisher: { '@id': `${origin}/#organization` } };
    }
    return `<script type="application/ld+json">\n${JSON.stringify(schema, null, 2).replace(/</g, '\\u003c')}\n    </script>`;
  });
}

// index.html is the template. Keep every section, asset, class, and interaction
// shared with the homepage; only change geography and one sentence of context.
export function renderCity(city, homepage) {
  const name = escape(city.name);
  const description = homepage.match(/<meta name="description" content="([^"]+)">/)[1].replace('nationwide', `buyers in ${city.name}`);
  let html = pageMetadata(homepage, { slug: city.slug, title: `${city.name} Car Buying Service | Drive Right`, description, city });
  for (const [from, to] of [
    ['Nationwide car buying.<br>', `${name} car buying.<br>`],
    ['flat-fee nationwide car buying and negotiation service.', `flat-fee car buying and negotiation service for ${name} buyers.`],
    ['Full Service is $295 USD one time, Ultimate Concierge is $895 USD one time, and you remain', `${escape(city.localSentence)} Full Service is $295 USD one time, Ultimate Concierge is $895 USD one time, and you remain`],
    ['We help buyers research vehicles', `We help ${name} buyers research vehicles`],
    ['We’re based in Austin and serve buyers nationwide through remote support.', `We’re based in Austin and help buyers in ${name} remotely.`],
    ['Based in Austin. Here for buyers nationwide.', `Based in Austin. Here for ${name}.`],
  ]) html = replaceRequired(html, from, to);
  return html;
}

function renderHub(data, homepage) {
  let html = pageMetadata(homepage, { slug: 'service-areas.html', title: 'Car Buying Service by City | Drive Right', description: 'Find your Drive Right city page for remote vehicle research, offer comparison, and car buying support from our Austin-based team.' });
  html = html.replace('data-buying-page="home"', 'data-buying-page="cities"');
  html = html.replace(/<main id="main-content" tabindex="-1">[\s\S]*?<\/main>/, `<main id="main-content" tabindex="-1"><section class="section-space page-width"><div class="hero-intro"><h1>Find your city.<br><em>Consider it handled.</em></h1><p>The same Drive Right service, with your city in mind.</p></div><nav class="plan-grid" aria-label="City pages">${data.cities.map(city => `<a class="outline-button" href="/${city.slug}">${escape(city.name)} <span data-icon="arrow"></span></a>`).join('\n')}</nav></section></main>`);
  html = html.replace(/<dialog id="edit-dialog"[\s\S]*?<\/dialog>/, '');
  return replaceRequired(html, 'Based in Austin. Here for buyers nationwide.', 'Based in Austin. Here for you.');
}

export async function renderCityPages({ root = projectRoot, output = cityDraftRoot, check = false } = {}) {
  const [dataText, homepage] = await Promise.all(['data/city-pages.json', 'index.html'].map(file => readFile(path.join(root, file), 'utf8')));
  const data = JSON.parse(dataText);
  validateCityData(data);
  const pages = new Map(data.cities.map(city => [city.slug, renderCity(city, homepage)]));
  pages.set('service-areas.html', renderHub(data, homepage));
  for (const [slug, html] of pages) {
    const doc = htmlDocument(html);
    if (!doc.noindex || doc.canonical[0] !== `${origin}/${slug}`) throw new Error(`${slug}: invalid metadata`);
  }
  if (!check) await mkdir(output, { recursive: true });
  for (const [file, html] of pages) {
    if (check) {
      if (await readFile(path.join(output, file), 'utf8') !== html) throw new Error(`${file}: stale city page; run npm run draft:cities`);
    } else await writeFile(path.join(output, file), html);
  }
  const unexpected = (await readdir(output)).filter(file => file.endsWith('.html') && !pages.has(file));
  if (unexpected.length) throw new Error(`Unexpected city pages: ${unexpected.join(', ')}`);
  return pages;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const pages = await renderCityPages({ check: process.argv.includes('--check') });
  console.log(`${process.argv.includes('--check') ? 'Verified' : 'Rendered'} ${pages.size - 1} homepage-based city pages and their hub in draft-artifacts/cities.`);
}
