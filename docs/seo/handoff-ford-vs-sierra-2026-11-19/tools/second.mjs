// node second.mjs <pair>: 50 random coded-sample comments, with context, for the blind second coder. Writes second.txt and second-ids.json.
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { S } from './lib.mjs';
const key = process.argv[2], dir = path.join(S, 'work', key), extra = process.argv[3] === 'extra', N = extra ? 100 : 50, tag = extra ? '2' : '';
const sampled = JSON.parse(await readFile(path.join(dir, 'sampled.json'), 'utf8'));
const cands = new Map(JSON.parse(await readFile(path.join(dir, 'candidates.json'), 'utf8')).map(t => [t.id, t]));
let seed = extra ? 555 : 987; const rnd = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
const flat = sampled.flatMap(t => t.comments.map(id => ({ t: t.id, id })));
for (let i = flat.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [flat[i], flat[j]] = [flat[j], flat[i]]; }
let prior = new Set(); if (extra) prior = new Set(JSON.parse(await readFile(path.join(dir, 'second-ids.json'), 'utf8')));
const pick = new Set(flat.filter(x => !prior.has(x.id)).slice(0, N).map(x => x.id));
const one = s => s.replace(/\s+/g, ' ').trim();
const lines = [], ids = [];
for (const t of sampled) {
  if (!t.comments.some(id => pick.has(id))) continue;
  const c = cands.get(t.id);
  const raw = JSON.parse(await readFile(path.join(S, 'raw/comments', t.id + '.json'), 'utf8')); const byId = new Map(raw.map(x => [x.id, x]));
  const au = new Map(); const person = a => (au.has(a) || au.set(a, 'p' + (au.size + 1)), au.get(a));
  lines.push(`=== THREAD ${t.id} | r/${t.sub} | ${t.created} | models matched in post by script: ${t.names.join(', ') || 'none'}`, `TITLE: ${one(c.title)}`, `POST: ${one(c.body).slice(0, 1800)}`, '--- LINES: CODE = code this comment; CTX = context only, do not code');
  for (const id of t.comments) {
    const x = byId.get(id); const par = x.p?.startsWith('t1_') ? byId.get(x.p.slice(3)) : null;
    if (pick.has(id) && par && !pick.has(par.id)) lines.push(`CTX ${par.id} | ${person(par.a)} | earlier | ${one(par.b).slice(0, 500)}`);
    if (pick.has(id)) { lines.push(`CODE ${id} | ${person(x.a)} | ${par ? par.id : 'post'} | ${one(x.b).slice(0, 1200)}`); ids.push(id); }
  }
  lines.push('');
}
await writeFile(path.join(dir, `second${tag}.txt`), lines.join('\n')); await writeFile(path.join(dir, `second${tag}-ids.json`), JSON.stringify(ids));
console.log(key, 'second-coder comments', ids.length);
