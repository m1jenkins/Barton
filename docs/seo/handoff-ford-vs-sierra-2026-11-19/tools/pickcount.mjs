// node pickcount.mjs <pair> <codedDir>: picks for a or b in neutral and home venues (after one-pick-per-person), from sampled threads only.
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { S, PAIRS } from './lib.mjs';
const [key, sub] = process.argv.slice(2), dir = path.join(S, 'work', key), P = PAIRS[key];
const sampled = JSON.parse(await readFile(path.join(dir, 'sampled.json'), 'utf8'));
const coded = new Map(), flags = new Map();
for (const f of (await readdir(path.join(dir, sub))).filter(f => /^batch-\d+\.json$/.test(f))) { const j = JSON.parse(await readFile(path.join(dir, sub, f), 'utf8')); for (const c of j.comments) coded.set(c.id, c); for (const t of j.threads) flags.set(t.id, t); }
const out = { neutral: { a: 0, b: 0, other: 0 }, homeA: { a: 0, b: 0, other: 0 }, homeB: { a: 0, b: 0, other: 0 }, threadsCoded: 0 };
for (const t of sampled) { const fl = flags.get(t.id); if (!fl) continue; out.threadsCoded++; if (fl.offTopic || fl.keepOrRepair) continue; const seen = new Set();
  for (const id of t.comments) { const c = coded.get(id); if (!c?.rec) continue; const p = t.authors[id]; if (seen.has(p)) continue; seen.add(p); out[t.venue][c.rec === P.a ? 'a' : c.rec === P.b ? 'b' : 'other']++; } }
console.log(key, sub, JSON.stringify(out));
