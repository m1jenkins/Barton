// node merge.mjs <pair> [--write]: assemble coder output into the two car files (ids and codes only). Dry run unless --write.
import { readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { S, PAIRS, REPO, NEUTRAL } from './lib.mjs';
import { topics, keyPattern } from '/home/user/Barton/scripts/reddit-sentiment.mjs';
const ser = d => '{\n' + Object.entries(d).map(([k, v]) => ' ' + JSON.stringify(k) + ': ' + (k === 'threads' || k === 'comments' ? '[\n' + v.map(x => '  ' + JSON.stringify(x)).join(',\n') + '\n ]' : JSON.stringify(v, null, 1).split('\n').join('\n '))).join(',\n') + '\n}\n';
const rubric = (process.argv.find(a => /^--rubric=/.test(a)) ?? '--rubric=v2').split('=')[1];
const key = process.argv[2], write = process.argv.includes('--write'), P = PAIRS[key], dir = path.join(S, 'work', key);
const models = JSON.parse(await readFile(path.join(REPO, 'data/reddit-sentiment/models.json'), 'utf8'));
const carPath = k => path.join(REPO, 'data/reddit-sentiment/cars', k + '.json');
const files = { a: JSON.parse(await readFile(carPath(P.a), 'utf8')), b: JSON.parse(await readFile(carPath(P.b), 'utf8')) };
const sampled = JSON.parse(await readFile(path.join(dir, 'sampled.json'), 'utf8'));
const cands = JSON.parse(await readFile(path.join(dir, 'candidates.json'), 'utf8'));
const agree = JSON.parse(await readFile(path.join(dir, 'agreement.json'), 'utf8'));
const coded = new Map(), flags = new Map();
for (const f of (await readdir(path.join(dir, 'coded'))).filter(f => /^batch-\d+\.json$/.test(f))) {
  const j = JSON.parse(await readFile(path.join(dir, 'coded', f), 'utf8'));
  for (const c of j.comments) coded.set(c.id, c); for (const t of j.threads) flags.set(t.id, t);
}
const stats = { sampledThreads: sampled.length, offTopic: 0, keepThreads: 0, dupPicks: 0, keepPicks: 0, uncoded: 0 };
const newThreads = [], newComments = [];
for (const t of sampled) {
  const fl = flags.get(t.id); if (!fl) throw new Error('no thread flags ' + t.id);
  if (fl.offTopic) { stats.offTopic++; continue; }
  if (fl.keepOrRepair) stats.keepThreads++;
  const seen = new Set(); const comments = [];
  for (const id of t.comments) {
    const c = coded.get(id); if (!c) { stats.uncoded++; continue; }
    for (const [m, tp, pol] of c.m) if (!keyPattern.test(m) || !models[m] || !topics[tp] || !['pos', 'neg', 'mixed'].includes(pol)) throw new Error(`bad code ${id} ${m} ${tp} ${pol}`);
    if (c.rec && (!keyPattern.test(c.rec) || !models[c.rec])) throw new Error(`bad pick ${id} ${c.rec}`);
    let rec = c.rec ?? null; const person = t.authors[id];
    if (rec) { if (fl.keepOrRepair) { rec = null; stats.keepPicks++; } else if (seen.has(person)) { rec = null; stats.dupPicks++; } else seen.add(person); }
    const m = [...new Map(c.m.map(x => [x.join('|'), x])).values()];
    comments.push({ id, thread: t.id, rec, m });
  }
  newThreads.push({ id: t.id, subreddit: t.sub, created: t.created, names: t.names.filter(n => n !== 'ford-sierra'), venue: t.venue });
  newComments.push(...comments);
}
// Copy already-coded threads naming both cars from one file to the other (codes cover every model named).
const have = { a: new Set(files.a.threads.map(t => t.id)), b: new Set(files.b.threads.map(t => t.id)) };
const homeSet = { a: new Set(P.homeA.map(s => s.toLowerCase())), b: new Set(P.homeB.map(s => s.toLowerCase())) };
const copies = { a: [], b: [] };
for (const c of cands) {
  for (const [from, to] of [['a', 'b'], ['b', 'a']]) {
    if (!have[from].has(c.id) || have[to].has(c.id)) continue;
    const sub = c.sub.toLowerCase();
    if (homeSet[from].has(sub)) continue; // a car's own subreddit stays in that car's file
    copies[to].push(c.id);
  }
}
const out = {}, summary = {};
for (const side of ['a', 'b']) {
  const f = files[side], k = side === 'a' ? P.a : P.b, other = side === 'a' ? P.b : P.a;
  const add = newThreads.filter(t => t.venue === 'neutral' || t.venue === (side === 'a' ? 'homeA' : 'homeB'));
  const ids = new Set(f.threads.map(t => t.id));
  const cIds0 = new Set(f.comments.map(c => c.id));
  const fresh = add.filter(t => !ids.has(t.id));
  for (const t of add) if (!ids.has(t.id)) f.threads.push({ id: t.id, subreddit: t.subreddit, created: t.created, names: [...new Set([...t.names, k, other])].sort() });
  const addIds = new Set(add.map(t => t.id)), cIds = new Set(f.comments.map(c => c.id));
  for (const c of newComments) if (addIds.has(c.thread) && !cIds.has(c.id)) { f.comments.push(c); cIds.add(c.id); }
  // copies from the other file
  const src = files[side === 'a' ? 'b' : 'a'];
  for (const id of copies[side]) {
    const th = src.threads.find(t => t.id === id); if (!th || ids.has(id)) continue;
    f.threads.push({ id, subreddit: th.subreddit, created: th.created, names: [...new Set([...th.names, P.a, P.b])].sort() });
    for (const c of src.comments) if (c.thread === id && !cIds.has(c.id)) { f.comments.push(JSON.parse(JSON.stringify(c))); cIds.add(c.id); }
    if ((src.keepThreads ?? []).includes(id)) f.keepThreads = [...new Set([...(f.keepThreads ?? []), id])].sort();
  }
  // names on existing threads that name both cars (older tooling may have missed one)
  for (const t of f.threads) if (copies[side].includes(t.id) === false && cands.some(c => c.id === t.id)) t.names = [...new Set([...t.names, P.a, P.b])].sort();
  for (const t of add) if (flags.get(t.id).keepOrRepair) f.keepThreads = [...new Set([...(f.keepThreads ?? []), t.id])].sort();
  f.threads.sort((x, y) => x.created.localeCompare(y.created) || x.id.localeCompare(y.id));
  const threadIds = new Set(f.threads.map(t => t.id));
  f.comments = f.comments.filter(c => threadIds.has(c.thread));
  const home = new Set([f.home].flat().map(s => s.toLowerCase()));
  f.subreddits = {}; for (const t of f.threads) f.subreddits[t.subreddit] = (f.subreddits[t.subreddit] ?? 0) + 1;
  f.threadsFrom = f.threads[0].created; f.threadsTo = f.threads.at(-1).created;
  const sub = Object.fromEntries(f.threads.map(t => [t.id, t.subreddit.toLowerCase()]));
  const nHome = f.comments.filter(c => home.has(sub[c.thread])).length, nNeutral = f.comments.length - nHome;
  f.duplicatePicksDropped += stats.dupPicks; f.keepThreadPicksDropped += stats.keepPicks;
  const kHome = fresh.filter(t => t.venue !== 'neutral').length, kNeutral = fresh.length - kHome;
  const addedComments = newComments.filter(c => addIds.has(c.thread) && !cIds0.has(c.id)).length;
  const homes = [f.home].flat().map(s => `r/${s}`).join(' and ');
  const topup = `Head-to-head top-up (November 18, 2026): posts from January 1, 2025 on, in ${homes} and in ${NEUTRAL.map(s => 'r/' + s).join(', ')}, whose title or text names both ${files.a.car.name} and ${files.b.car.name} (${cands.length} found, ${cands.filter(c => !c.inA && !c.inB).length} not yet coded; the ones that weigh the two were sampled evenly by month, about 1,500 comments a venue, at most 120 a thread). Added to this file: ${fresh.length} new threads (${kHome} home, ${kNeutral} neutral) and ${addedComments} comments, plus ${copies[side].length} already-coded threads from ${other === P.a ? files.a.car.name : files.b.car.name}'s file, coded to the same rubric. A second coder re-coded ${agree.comments} random top-up comments blind (${rubric} rubric): ${agree.picksWhereEitherPicked.pct ?? 'n/a'}% agreement on picks (${agree.picksWhereEitherPicked.agree} of ${agree.picksWhereEitherPicked.n} comments either coder picked on; ${agree.picksAll50.pct}% over all ${agree.comments}) and ${agree.stance.pct}% on stance toward the two cars (${agree.stance.agree} of ${agree.stance.n})${agree.pass ? '' : ', below the 85% floor'}.`;
  f.rules = f.rules.replace(/[\d,]+ comments coded \([\d,]+ home, [\d,]+ neutral\) in [\d,]+ threads\./, `${f.comments.length.toLocaleString('en-US')} comments coded (${nHome.toLocaleString('en-US')} home, ${nNeutral.toLocaleString('en-US')} neutral) in ${f.threads.length} threads.`);
  f.rules = `${f.rules.replace(/ Head-to-head top-up \(November 18, 2026\)[^]*$/, '')} ${topup}`;
  summary[side] = { file: k, addedThreads: fresh.length, addedComments, copiedThreads: copies[side].length, totalThreads: f.threads.length, totalComments: f.comments.length, home: nHome, neutral: nNeutral };
  if (write) await writeFile(carPath(k), ser(f));
}
console.log(JSON.stringify({ pair: key, write, stats, summary }, null, 1));
