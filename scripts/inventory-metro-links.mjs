import { readdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { htmlDocument, origin } from './metro-release.mjs';
export async function inventoryMetroLinks({ root = fileURLToPath(new URL('..', import.meta.url)) } = {}) {
  const observedOn = new Date().toISOString().slice(0, 10);
  const registry=JSON.parse(await readFile(path.join(root,'data/metro-release.json'),'utf8'));
  const targets=new Set(registry.legacyTexas.map(m=>m.slug));
  const rows=['source_file,target_file,link_count,source_indexable,observed_on'];
  for(const file of (await readdir(root)).filter(f=>f.endsWith('.html')).sort()){
    const doc=htmlDocument(await readFile(path.join(root,file),'utf8'));const counts=new Map();
    for(const href of doc.links){const url=new URL(href,`${origin}/${file}`);const target=url.pathname.slice(1);if(url.origin===origin&&targets.has(target))counts.set(target,(counts.get(target)??0)+1);}
    for(const [target,count] of [...counts].sort())rows.push([file,target,count,!doc.noindex,observedOn].join(','));
  }
  await writeFile(path.join(root,'data/metro-link-inventory.csv'),rows.join('\n')+'\n');
  return rows.length - 1;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const count = await inventoryMetroLinks();
  console.log(`Recorded ${count} repository link pairs. This is not a GSC or backlink export.`);
}
