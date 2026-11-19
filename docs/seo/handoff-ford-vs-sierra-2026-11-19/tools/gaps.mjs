// node gaps.mjs <pair> [--write]: comments the first coder left empty (no opinion, no pick) whose text names a target car.
// Writes work/<pair>/gap-batches/gap-NN.txt (same format as batches, only those comments) and gap-ids.json.
import { readFile, readdir, writeFile, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { S, PAIRS, match } from './lib.mjs';
const key = process.argv[2], write = process.argv.includes('--write'), dir = path.join(S, 'work', key), P = PAIRS[key];
const coded = new Map();
for (const f of (await readdir(path.join(dir, 'coded'))).filter(f => /^batch-\d+\.json$/.test(f))) for (const c of JSON.parse(await readFile(path.join(dir, 'coded', f), 'utf8')).comments) coded.set(c.id, c);
const sampled = JSON.parse(await readFile(path.join(dir, 'sampled.json'), 'utf8'));
const cands = new Map(JSON.parse(await readFile(path.join(dir, 'candidates.json'), 'utf8')).map(t => [t.id, t]));
const one = s => s.replace(/\s+/g, ' ').trim();
const lines = [], ids = []; let n = 0, files = 0; const out = [];
const flush = async () => { if (!lines.length) return; files++; if (write) await writeFile(path.join(dir, 'gap-batches', `gap-${String(files).padStart(2, '0')}.txt`), lines.join('\n')); lines.length = 0; n = 0; };
if (write) { await rm(path.join(dir, 'gap-batches'), { recursive: true, force: true }); await mkdir(path.join(dir, 'gap-batches'), { recursive: true }); }
for (const t of sampled) {
  const raw = JSON.parse(await readFile(path.join(S, 'raw/comments', t.id + '.json'), 'utf8')); const byId = new Map(raw.map(x => [x.id, x]));
  const pick = t.comments.filter(id => { const c = coded.get(id), x = byId.get(id); return c && !c.m.length && !c.rec && (match(P.a, x.b, true) || match(P.b, x.b, true)); });
  if (!pick.length) continue;
  const th = cands.get(t.id);
  const au = new Map(); const person = a => (au.has(a) || au.set(a, 'p' + (au.size + 1)), au.get(a));
  for (const id of t.comments) person(byId.get(id).a);
  if (n + pick.length > 220) await flush();
  lines.push(`=== THREAD ${t.id} | r/${t.sub} | ${t.created} | models matched in post by script: ${t.names.join(', ') || 'none'}`, `TITLE: ${one(th.title)}`, `POST: ${one(th.body).slice(0, 1200)}`, '--- COMMENTS: id | person | replying to | text');
  for (const id of pick) { const x = byId.get(id), par = x.p?.startsWith('t1_') ? x.p.slice(3) : 'post'; lines.push(`${id} | ${person(x.a)} | ${par} | ${one(x.b).slice(0, 1200)}`); ids.push(id); n++; }
  lines.push('');
}
await flush();
if (write) await writeFile(path.join(dir, 'gap-ids.json'), JSON.stringify(ids));
console.log(key, 'empty-coded comments naming a target car:', ids.length, 'of', coded.size, 'files', files);
