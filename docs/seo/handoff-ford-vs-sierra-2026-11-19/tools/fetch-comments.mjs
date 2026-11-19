// node fetch-comments.mjs <pair> [conc]: comments (raw text stays in scratchpad) for each candidate thread not already coded in a car file.
import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import path from 'node:path';
import { S } from './lib.mjs';
const key = process.argv[2], conc = Number(process.argv[3] ?? 3);
let keepMap = null; try { keepMap = JSON.parse(await readFile(path.join(S, 'work', key, 'screen-keep.json'), 'utf8')); } catch {}
const cands = JSON.parse(await readFile(path.join(S, 'work', key, 'candidates.json'), 'utf8')).filter(t => !t.inA && !t.inB && t.n >= 3 && (!keepMap || keepMap[t.id] !== false));
await mkdir(path.join(S, 'raw/comments'), { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function get(url) {
  for (let i = 0; i < 8; i++) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(60000) });
      if (r.status === 429) { await sleep(6000); continue; }
      const j = await r.json().catch(() => null);
      if (r.ok && j?.data) return j.data;
      await sleep(1500 * (i + 1));
    } catch { await sleep(2000 * (i + 1)); }
  }
  throw new Error('failed ' + url);
}
let done = 0; const queue = [...cands];
await Promise.all(Array.from({ length: conc }, async () => {
  for (let t; (t = queue.shift()); ) {
    const file = path.join(S, 'raw/comments', t.id + '.json');
    try { await access(file); done++; continue; } catch {}
    const all = []; let after = 0;
    for (let page = 0; page < 4; page++) {
      const rows = await get(`https://arctic-shift.photon-reddit.com/api/comments/search?link_id=${t.id}&limit=100&sort=asc${after ? `&after=${after}` : ''}&fields=id,author,created_utc,body,parent_id`);
      for (const c of rows) all.push({ id: c.id, a: c.author, c: c.created_utc, b: c.body, p: c.parent_id });
      if (rows.length < 100) break;
      after = rows.at(-1).created_utc;
    }
    const uniq = [...new Map(all.map(c => [c.id, c])).values()];
    await writeFile(file, JSON.stringify(uniq));
    if (++done % 25 === 0) console.log(key, 'fetched', done, '/', cands.length);
  }
}));
console.log(key, 'comments fetched for', cands.length, 'threads');
