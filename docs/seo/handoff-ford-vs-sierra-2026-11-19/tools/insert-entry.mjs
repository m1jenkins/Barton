// node insert-entry.mjs <entry.json>: append (or replace by slug) an entry in data/comparison-pages.json, indent 1 as the file is.
import { readFile, writeFile } from 'node:fs/promises';
const p = '/home/user/Barton/data/comparison-pages.json';
const d = JSON.parse(await readFile(p, 'utf8')), e = JSON.parse(await readFile(process.argv[2], 'utf8'));
const i = d.comparisons.findIndex(c => c.slug === e.slug);
if (i >= 0) d.comparisons[i] = e; else d.comparisons.push(e);
await writeFile(p, JSON.stringify(d, null, 1) + '\n'); console.log(i >= 0 ? 'replaced' : 'appended', e.slug, d.comparisons.length);
