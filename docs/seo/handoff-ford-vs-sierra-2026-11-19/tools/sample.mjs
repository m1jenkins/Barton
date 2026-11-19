// node sample.mjs <pair> [target=1500]: eligible comments, even-by-month thread sampling per venue, coder batches.
import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { S } from './lib.mjs';
const key = process.argv[2], target = Number(process.argv[3] ?? 1500);
const dir = path.join(S, 'work', key);
let keepMap = null; try { keepMap = JSON.parse(await readFile(path.join(dir, 'screen-keep.json'), 'utf8')); } catch {}
const cands = JSON.parse(await readFile(path.join(dir, 'candidates.json'), 'utf8')).filter(t => !t.inA && !t.inB && t.n >= 3 && (!keepMap || keepMap[t.id] !== false));
let seed = 12345; const rnd = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const bot = a => !a || a === '[deleted]' || /^(automoderator|.*bot)$/i.test(a);
const threads = [];
for (const t of cands) {
  let raw = []; try { raw = JSON.parse(await readFile(path.join(S, 'raw/comments', t.id + '.json'), 'utf8')); } catch { continue; }
  const ok = raw.filter(c => c.b && !bot(c.a) && !/^\[(removed|deleted)\]$/.test(c.b.trim()) && c.b.trim().length >= 15).slice(0, 120);
  if (ok.length) threads.push({ ...t, comments: ok, group: t.venue === 'neutral' ? 'neutral' : 'home' });
}
const chosen = [];
const report = {};
for (const group of ['home', 'neutral']) {
  const gt = threads.filter(t => t.group === group);
  const byMonth = {}; for (const t of gt) (byMonth[t.month] ??= []).push(t);
  const months = Object.keys(byMonth).sort();
  const avail = Object.fromEntries(months.map(m => [m, byMonth[m].reduce((s, t) => s + t.comments.length, 0)]));
  let remaining = target; const quota = {};
  for (const [i, m] of [...months].sort((x, y) => avail[x] - avail[y]).entries()) { const left = months.length - i; quota[m] = Math.min(avail[m], Math.ceil(remaining / left)); remaining -= quota[m]; }
  const picked = [];
  for (const m of months) { let n = 0; for (const t of shuffle([...byMonth[m]])) { if (n >= quota[m]) break; picked.push(t); n += t.comments.length; } }
  let total = picked.reduce((s, t) => s + t.comments.length, 0);
  while (total > target * 1.08) { // drop whole threads from the fullest month
    const count = {}; for (const t of picked) count[t.month] = (count[t.month] ?? 0) + t.comments.length;
    const fullest = Object.entries(count).sort((x, y) => y[1] - x[1])[0][0];
    const idx = picked.findLastIndex(t => t.month === fullest); total -= picked[idx].comments.length; picked.splice(idx, 1);
  }
  report[group] = { threadsAvailable: gt.length, commentsAvailable: gt.reduce((s, t) => s + t.comments.length, 0), months: months.length, threadsDrawn: picked.length, comments: total };
  chosen.push(...picked);
}
await rm(path.join(dir, 'batches'), { recursive: true, force: true }); await mkdir(path.join(dir, 'batches'), { recursive: true });
chosen.sort((x, y) => x.group.localeCompare(y.group) || x.month.localeCompare(y.month) || x.id.localeCompare(y.id));
await writeFile(path.join(dir, 'sampled.json'), JSON.stringify(chosen.map(t => ({ id: t.id, sub: t.sub, venue: t.venue, created: t.created, names: t.names, comments: t.comments.map(c => c.id), authors: Object.fromEntries(t.comments.map(c => [c.id, c.a])) }))));
// Batches of about 400 comments, whole threads only.
const batches = []; let cur = [], n = 0;
for (const t of chosen) { if (n && n + t.comments.length > 430) { batches.push(cur); cur = []; n = 0; } cur.push(t); n += t.comments.length; }
if (cur.length) batches.push(cur);
const oneLine = s => s.replace(/\s+/g, ' ').trim();
for (const [i, b] of batches.entries()) {
  const lines = [];
  for (const t of b) {
    lines.push(`=== THREAD ${t.id} | r/${t.sub} | ${t.created} | models matched in post by script: ${t.names.join(', ') || 'none'}`);
    lines.push(`TITLE: ${oneLine(t.title)}`);
    lines.push(`POST: ${oneLine(t.body).slice(0, 1800)}`);
    const au = new Map(); const ids = new Set(t.comments.map(c => c.id));
    lines.push('--- COMMENTS: id | person | replying to | text');
    for (const c of t.comments) {
      if (!au.has(c.a)) au.set(c.a, 'p' + (au.size + 1));
      const parent = c.p?.startsWith('t1_') ? (ids.has(c.p.slice(3)) ? c.p.slice(3) : 'earlier comment') : 'post';
      lines.push(`${c.id} | ${au.get(c.a)} | ${parent} | ${oneLine(c.b).slice(0, 1200)}`);
    }
    lines.push('');
  }
  await writeFile(path.join(dir, 'batches', `batch-${String(i + 1).padStart(2, '0')}.txt`), lines.join('\n'));
}
console.log(key, JSON.stringify(report), 'batches', batches.length, 'sizes', batches.map(b => b.reduce((s, t) => s + t.comments.length, 0)).join(','));
