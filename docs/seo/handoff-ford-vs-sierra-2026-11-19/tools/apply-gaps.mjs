// node apply-gaps.mjs <pair>: replace first-pass codes of gap comments with the completeness pass's codes (ids and codes only).
import { readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { S } from './lib.mjs';
const key = process.argv[2], dir = path.join(S, 'work', key);
const gap = new Map();
for (const f of (await readdir(path.join(dir, 'gap-coded'))).filter(f => /^gap-\d+\.json$/.test(f))) for (const c of JSON.parse(await readFile(path.join(dir, 'gap-coded', f), 'utf8')).comments) gap.set(c.id, c);
const want = new Set(JSON.parse(await readFile(path.join(dir, 'gap-ids.json'), 'utf8')));
let changed = 0, filledOp = 0, filledPick = 0;
for (const f of (await readdir(path.join(dir, 'coded'))).filter(f => /^batch-\d+\.json$/.test(f))) {
  const p = path.join(dir, 'coded', f), j = JSON.parse(await readFile(p, 'utf8')); let touched = false;
  for (const c of j.comments) { const g = gap.get(c.id); if (!g || !want.has(c.id)) continue; if (g.m.length || g.rec) { c.m = g.m; c.rec = g.rec ?? null; changed++; if (g.m.length) filledOp++; if (g.rec) filledPick++; touched = true; } }
  if (touched) await writeFile(p, JSON.stringify(j));
}
console.log(key, 'gap ids', want.size, 'coded', gap.size, 'filled', changed, 'with opinions', filledOp, 'with picks', filledPick);
