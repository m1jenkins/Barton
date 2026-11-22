// Wires every "ready" problems page into the files that list pages: sitemap.xml, blog.html (card and ItemList), llms.txt,
// data/content-inventory.csv, docs/seo-execution/query-map.csv and data/source-registry.csv. Idempotent: run it after adding
// or changing a car file (`npm run wire:problems`); it replaces what it wrote before and leaves everything else alone.
// A car file may carry `card` (the one-line blog card text), `llms` (the llms.txt line) and `queries` (the searches it targets).
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { origin, problemsCars } from './render-problems-pages.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = file => readFile(path.join(root, file), 'utf8');
const write = (file, text) => writeFile(path.join(root, file), text);
const csv = fields => fields.map(value => /[",\n]/.test(value) ? `"${String(value).replaceAll('"', '""')}"` : value).join(',');
const day = '2026-11-21';
const cars = (await problemsCars()).filter(car => car.status === 'ready');
const url = car => `${origin}/${car.slug}`;

// sitemap.xml
{
  let text = await read('sitemap.xml');
  text = text.replace(/  <url>\n    <loc>[^<]*-problems\.html<\/loc>\n    <lastmod>[^<]*<\/lastmod>\n  <\/url>\n/g, '');
  const entries = cars.map(car => `  <url>\n    <loc>${url(car)}</loc>\n    <lastmod>${car.checkedOn}</lastmod>\n  </url>\n`).join('');
  await write('sitemap.xml', text.replace('</urlset>', `${entries}</urlset>`));
}

// blog.html: a card section before "What to pay, by model", and ItemList entries at the end of the list.
{
  let text = await read('blog.html');
  text = text.replace(/<section class="page-width content-section" aria-labelledby="problems-title">[\s\S]*?<\/section>\n/, '');
  const section = `<section class="page-width content-section" aria-labelledby="problems-title">
<h2 id="problems-title">Problems by model year</h2>
<p>Which years to buy used and which to skip, from NHTSA owner complaints per 100,000 sold, recalls and what owners report on Reddit.</p>
<ul class="card-grid" role="list">
${cars.map(car => `<li class="info-card"><span class="tag">Problems by year</span><h3>${car.name} Problems by Year</h3><p>${car.card}</p><a href="/${car.slug}">See ${car.short} problems</a></li>`).join('\n')}
</ul>
</section>
`;
  text = text.replace('<section class="page-width content-section" aria-labelledby="prices-title">', `${section}<section class="page-width content-section" aria-labelledby="prices-title">`);
  text = text.replace(/,\n        \{\n          "@type": "ListItem",\n          "position": \d+,\n          "name": "[^"]*",\n          "url": "[^"]*-problems\.html"\n        \}/g, '');
  const positions = [...text.matchAll(/"position": (\d+)/g)].map(match => Number(match[1]));
  let next = Math.max(...positions) + 1;
  const items = cars.map(car => `,\n        {\n          "@type": "ListItem",\n          "position": ${next++},\n          "name": "${car.name} Problems by Year",\n          "url": "${url(car)}"\n        }`).join('');
  const tail = '\n        }\n      ]\n    }\n  ]\n}\n    </script>';
  if (!text.includes(tail)) throw new Error('blog.html: ItemList end not found');
  text = text.replace(tail, `\n        }${items}\n      ]\n    }\n  ]\n}\n    </script>`);
  await write('blog.html', text);
}

// llms.txt: a section before "## Cities"
{
  let text = await read('llms.txt');
  text = text.replace(/## Problems by model year\n[\s\S]*?\n\n(?=## )/, '');
  const section = `## Problems by model year\nWhich years to buy used and which to skip, from NHTSA owner complaints and recalls, dated on each page.\n${cars.map(car => `- [${car.name} Problems by Year](${url(car)}): ${car.llms ?? car.card} (checked ${car.checkedOn}).`).join('\n')}\n\n`;
  await write('llms.txt', text.replace('## Cities', `${section}## Cities`));
}

// data/content-inventory.csv
{
  const lines = (await read('data/content-inventory.csv')).split('\n').filter(line => line && !line.includes('-problems.html,'));
  for (const car of cars) lines.push(csv([url(car), car.slug, 'problems_by_year', `${car.key.replaceAll('-', '_')}_problems`, 'vehicle_problems', 'indexable_owner_publication', 'third_party_sources_registered_VEH_rows', 'assisted_full_service', `Session user via direct instruction (${day})`, day, '', `Generated from data/problems-pages/${car.key}.json by npm run build:problems; do not edit by hand. NHTSA counts read ${car.nhtsa.readOn}; verdicts are the owner's to read. See docs/seo/2026-11-21-problems-pages.md.`]));
  await write('data/content-inventory.csv', `${lines.join('\n')}\n`);
}

// docs/seo-execution/query-map.csv
{
  const lines = (await read('docs/seo-execution/query-map.csv')).split('\n').filter(line => line && !line.includes('-problems.html,'));
  for (const car of cars) {
    const name = car.name.toLowerCase();
    for (const query of car.queries ?? [`${name} problems`, `${name} years to avoid`, `best year used ${name}`, `${name} reliability by year`])
      lines.push(csv([query, 'vehicle_problems', url(car), 'exploratory_seed', day, '', '', '', '', '', '', 'P2', 'SEO-2026-11-21-PROBLEMS', 'dated_third_party_sources', 'Problems-by-year page; no Search Console data yet. See docs/seo/2026-11-21-problems-pages.md']));
  }
  await write('docs/seo-execution/query-map.csv', `${lines.join('\n')}\n`);
}

// data/source-registry.csv
{
  const authority = { 'api.nhtsa.gov': 'NHTSA', 'www.nhtsa.gov': 'NHTSA', 'www.prnewswire.com': 'Toyota Motor North America', 'www.goodcarbadcar.net': 'Good Car Bad Car', 'en.wikipedia.org': 'Wikipedia', 'www.carcomplaints.com': 'CarComplaints', 'www.fromtheroad.ford.com': 'Ford', 'pickuptrucktalk.com': 'Pickup Truck Talk', 'www.toyota.com': 'Toyota' };
  const ids = new Set(cars.flatMap(car => car.sources.map(source => source.id)));
  const lines = (await read('data/source-registry.csv')).split('\n').filter(line => line && ![...ids].some(id => line.startsWith(`${id},`)) && !/^VEH-PRB-/.test(line.split(',')[0]));
  for (const car of cars) for (const source of car.sources) {
    const host = new URL(source.url).host;
    lines.push(csv([source.id, url(car), source.scope, authority[host] ?? source.title.split(':')[0], 'United States', source.url, source.title, `retrieved ${day}`, '', 'secondary_research_checked', '2026-12-21', `${source.note[0].toUpperCase()}${source.note.slice(1)}. Read on ${day} in the page-building session; figures not independently verified. Recheck with the monthly refresh.`]));
  }
  await write('data/source-registry.csv', `${lines.join('\n')}\n`);
}
console.log(`Wired ${cars.length} problems pages.`);
