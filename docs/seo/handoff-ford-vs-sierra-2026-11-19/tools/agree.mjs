// node agree.mjs <pair>: agreement between work/<pair>/coded/* (first coder) and work/<pair>/second.json (second coder).
import { readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { S, PAIRS } from './lib.mjs';
const key = process.argv[2], P = PAIRS[key], dir = path.join(S, 'work', key);
const first = new Map();
for (const f of (await readdir(path.join(dir, 'coded'))).filter(f => /^batch-\d+\.json$/.test(f))) for (const c of JSON.parse(await readFile(path.join(dir, 'coded', f), 'utf8')).comments) first.set(c.id, c);
const second = []; for (const f of ['second.json', 'second2.json']) { try { second.push(...JSON.parse(await readFile(path.join(dir, f), 'utf8')).comments); } catch {} }
const stance = (c, car) => { const o = c.m.filter(x => x[0] === car).map(x => x[2]); if (!o.length) return 'none'; const pos = o.includes('pos'), neg = o.includes('neg'), mix = o.includes('mixed'); return mix || (pos && neg) ? 'mixed' : pos ? 'pos' : 'neg'; };
let pickEither = 0, pickSame = 0, pickAll = 0, pickAllSame = 0, stEither = 0, stSame = 0;
for (const s of second) {
  const f = first.get(s.id); if (!f) { console.log('missing first', s.id); continue; }
  pickAll++; if ((f.rec ?? null) === (s.rec ?? null)) pickAllSame++;
  if (f.rec || s.rec) { pickEither++; if ((f.rec ?? null) === (s.rec ?? null)) pickSame++; }
  for (const car of [P.a, P.b]) { const x = stance(f, car), y = stance(s, car); if (x !== 'none' || y !== 'none') { stEither++; if (x === y) stSame++; } }
}
const pct = (a, b) => b ? Math.round(100 * a / b) : null;
const r = { comments: second.length, picksWhereEitherPicked: { n: pickEither, agree: pickSame, pct: pct(pickSame, pickEither) }, picksAll50: { pct: pct(pickAllSame, pickAll) }, stance: { n: stEither, agree: stSame, pct: pct(stSame, stEither) } };
r.pass = (pickEither < 8 ? r.picksAll50.pct >= 85 : r.picksWhereEitherPicked.pct >= 85 && r.picksAll50.pct >= 85) && r.stance.pct >= 85;
console.log(JSON.stringify(r)); await writeFile(path.join(dir, 'agreement.json'), JSON.stringify(r));
