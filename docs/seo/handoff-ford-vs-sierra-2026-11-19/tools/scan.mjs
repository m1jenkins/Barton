// Lists every post in the given subreddits from 2025-01-01 to today via Arctic Shift date windows (search endpoints time out).
// Usage: node scan.mjs <concurrency> sub1 sub2 ...   Cache: raw/posts/<sub>/<yyyy-mm>.json (a month is "done" when the file exists)
import { mkdir, writeFile, access } from 'node:fs/promises';
import path from 'node:path';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const [conc, ...subs] = process.argv.slice(2);
const FIELDS = 'id,title,selftext,created_utc,num_comments,subreddit';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const months = [];
for (let y = 2025, m = 1; ; ) { const s = Date.UTC(y, m - 1, 1) / 1000; if (s > Date.now() / 1000) break; const e = Date.UTC(m === 12 ? y + 1 : y, m === 12 ? 0 : m, 1) / 1000; months.push({ key: `${y}-${String(m).padStart(2, '0')}`, s, e }); m++; if (m > 12) { m = 1; y++; } }
async function get(url, tries = 8) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(60000) });
      const reset = Number(r.headers.get('x-ratelimit-reset') ?? 0), remaining = r.headers.get('x-ratelimit-remaining');
      if (r.status === 429) { await sleep(Math.max(reset, 5) * 1000 + 500); continue; }
      const j = await r.json().catch(() => null);
      if (r.ok && j?.data) { if (remaining !== null && Number(remaining) < 3) await sleep(Math.max(reset, 1) * 1000); return j.data; }
      await sleep(1500 * (i + 1));
    } catch { await sleep(2000 * (i + 1)); }
  }
  throw new Error('failed ' + url);
}
async function scanMonth(sub, mo) {
  const file = path.join(root, 'raw/posts', sub, `${mo.key}.json`);
  try { await access(file); return 0; } catch {}
  const seen = new Map(); let cursor = mo.s, stuck = 0;
  for (;;) {
    const rows = await get(`https://arctic-shift.photon-reddit.com/api/posts/search?subreddit=${sub}&after=${cursor}&before=${mo.e}&limit=100&sort=asc&fields=${FIELDS}`);
    let added = 0; for (const p of rows) if (!seen.has(p.id)) { seen.set(p.id, { id: p.id, t: p.title, b: (p.selftext ?? '').slice(0, 6000), c: p.created_utc, n: p.num_comments, r: p.subreddit }); added++; }
    if (rows.length < 100) break;
    const last = rows.at(-1).created_utc;
    if (!added) { stuck++; cursor = last + 1; if (stuck > 3) break; } else { stuck = 0; cursor = last; }
  }
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify([...seen.values()]));
  return seen.size;
}
const queue = subs.flatMap(sub => months.map(mo => ({ sub, mo })));
let done = 0;
await Promise.all(Array.from({ length: Number(conc) }, async () => {
  for (let job; (job = queue.shift()); ) {
    try { const n = await scanMonth(job.sub, job.mo); console.log(`${new Date().toISOString().slice(11, 19)} ${job.sub} ${job.mo.key} ${n} (${++done})`); }
    catch (e) { console.log('FAIL', job.sub, job.mo.key, e.message); }
  }
}));
console.log('ALL DONE');
