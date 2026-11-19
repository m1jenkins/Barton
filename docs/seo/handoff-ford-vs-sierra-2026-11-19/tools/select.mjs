// node select.mjs <pair>: candidate threads that name both cars (title or post), from the cars' home subreddits and the six neutral ones.
import { writeFile, mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { S, PAIRS, NEUTRAL, match, names, readPosts, iso, REPO } from './lib.mjs';
const key = process.argv[2], P = PAIRS[key];
const out = [];
const carFile = async k => JSON.parse(await readFile(path.join(REPO, 'data/reddit-sentiment/cars', k + '.json'), 'utf8'));
const [fa, fb] = [await carFile(P.a), await carFile(P.b)];
const have = { a: new Set(fa.threads.map(t => t.id)), b: new Set(fb.threads.map(t => t.id)) };
for (const [venue, subs] of [['homeA', P.homeA], ['homeB', P.homeB], ['neutral', NEUTRAL]]) {
  for (const sub of subs) {
    const posts = await readPosts(sub);
    let n = 0;
    for (const p of posts) {
      if (!p.n || p.n < 1) continue;
      if (/^\[(removed|deleted)\]$/.test(p.b.trim()) && !p.t) continue;
      const text = `${p.t}\n${p.b}`;
      const home = venue !== 'neutral';
      if (!match(P.a, text, venue === 'homeA') || !match(P.b, text, venue === 'homeB')) continue;
      n++;
      out.push({ id: p.id, sub: p.r, venue, created: iso(p.c), month: iso(p.c).slice(0, 7), title: p.t, body: p.b, n: p.n, names: await names(text), inA: have.a.has(p.id), inB: have.b.has(p.id) });
    }
    console.log(key, venue, sub, posts.length, 'posts ->', n);
  }
}
await mkdir(path.join(S, 'work', key), { recursive: true });
await writeFile(path.join(S, 'work', key, 'candidates.json'), JSON.stringify(out));
const by = {}; for (const t of out) by[t.venue] = (by[t.venue] ?? 0) + 1;
console.log(key, 'candidates', out.length, by, 'already in a car file:', out.filter(t => t.inA || t.inB).length);
