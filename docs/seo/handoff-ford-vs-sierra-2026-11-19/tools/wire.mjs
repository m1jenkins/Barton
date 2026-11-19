// node wire.mjs <spec.json> [--write]: sitemap, blog card + ItemList, llms.txt, content inventory, query map and source registry rows for one comparison page.
// spec: { slug, name, cardBlurb, cardCta, llmsDesc, inventoryNote, queries:[...], carsText:"Subaru Forester and Honda CR-V" , codeNote }
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
const R = '/home/user/Barton';
const spec = JSON.parse(await readFile(process.argv[2], 'utf8')), write = process.argv.includes('--write');
const url = `https://www.steermeright.com/${spec.slug}`;
const edit = async (file, fn) => { const p = path.join(R, file); const t = await readFile(p, 'utf8'); const n = fn(t); if (n === t) throw new Error('no change ' + file); if (write) await writeFile(p, n); };
// sitemap
await edit('sitemap.xml', t => t.includes(url) ? t : t.replace('</urlset>', `  <url>\n    <loc>${url}</loc>\n    <lastmod>2026-11-18</lastmod>\n  </url>\n</urlset>`));
// blog.html: ItemList then card
await edit('blog.html', t => {
  if (t.includes(`"url": "${url}"`)) return t;
  const positions = [...t.matchAll(/"position": (\d+),/g)].map(m => Number(m[1]));
  const next = Math.max(...positions) + 1;
  const lastItem = t.lastIndexOf('"url": "https://www.steermeright.com/', t.indexOf('"position": ' + Math.max(...positions)) );
  const anchor = `"url": "https://www.steermeright.com/`;
  // append after the item with the highest position
  const posIdx = t.indexOf(`"position": ${Math.max(...positions)},`);
  const close = t.indexOf('\n        }', posIdx);
  let out = t.slice(0, close) + `\n        },\n        {\n          "@type": "ListItem",\n          "position": ${next},\n          "name": "${spec.name}",\n          "url": "${url}"` + t.slice(close);
  const cards = [...out.matchAll(/<li class="info-card"><span class="tag">Comparison<\/span>.*<\/li>\n/g)];
  const last = cards.at(-1); const at = last.index + last[0].length;
  return out.slice(0, at) + `<li class="info-card"><span class="tag">Comparison</span><h3>${spec.name}</h3><p>${spec.cardBlurb}</p><a href="/${spec.slug}">${spec.cardCta}</a></li>\n` + out.slice(at);
});
await edit('llms.txt', t => { if (t.includes(url)) return t; const lines = t.split('\n'); let i = lines.map(l => / vs /.test(l.split(']')[0]) && l.includes('steermeright.com/')).lastIndexOf(true); lines.splice(i + 1, 0, `- [${spec.name}](${url}): ${spec.llmsDesc}`); return lines.join('\n'); });
await edit('data/content-inventory.csv', t => { if (t.includes(url)) return t; const lines = t.split('\n'); const i = lines.map(l => l.includes(',vehicle_comparison,')).lastIndexOf(true); const note = `Generated from data/comparison-pages.json (plus each car’s entry in data/vehicle-pages.json) by npm run build:vehicles; do not edit by hand. ${spec.inventoryNote} Figures dated 2026-11-18. See docs/seo/2026-11-15-vehicle-price-pages.md.`; const stem = spec.slug.replace('.html', ''); lines.splice(i + 1, 0, `${url},${spec.slug},vehicle_comparison,${stem.replace(/-/g, '_')},vehicle_prices,indexable_owner_publication,third_party_sources_registered_VEH_rows,assisted_concierge,Session user via direct instruction (2026-11-18),2026-11-18,,"${note}"`); return lines.join('\n'); });
await edit('docs/seo-execution/query-map.csv', t => { if (t.includes(url)) return t; const lines = t.split('\n'); const i = lines.map(l => l.includes(',vehicle_comparison,')).lastIndexOf(true); const rows = spec.queries.map(q => `${q},vehicle_comparison,${url},exploratory_seed,2026-11-18,,,,,,,P2,SEO-2026-11-15-VEHICLES,dated_third_party_sources,Vehicle comparison page; no Search Console data yet. See docs/seo/2026-11-15-vehicle-price-pages.md`); lines.splice(i + 1, 0, ...rows); return lines.join('\n'); });
// source registry rows from the entry's sources
const cmp = JSON.parse(await readFile(path.join(R, 'data/comparison-pages.json'), 'utf8')).comparisons.find(c => c.slug === spec.slug);
if (cmp) await edit('data/source-registry.csv', t => {
  if (t.includes(`${cmp.sources[0].id},`)) return t;
  const q = v => /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
  const rows = cmp.sources.map(s => [s.id, url, s.note, s.title.split(':')[0], 'United States', s.url, s.title, 'retrieved 2026-11-18', '', 'secondary_research_checked', '2026-12-18', `Read on 2026-11-18 in the page-building session, or carried from the ${spec.carsText} price guides; figures not independently verified. Recheck with the monthly refresh.`].map(q).join(','));
  return t.replace(/\n?$/, '\n') + rows.join('\n') + '\n';
});
console.log('wired', spec.slug, write ? '(written)' : '(dry run)');
