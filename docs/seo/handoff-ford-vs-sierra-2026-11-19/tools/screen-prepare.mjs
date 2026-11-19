// node screen-prepare.mjs <pair> <round> [onlySub...]: text files of not-yet-screened candidate posts (about 110 each) in work/<pair>/screen/.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { S } from './lib.mjs';
const [key, round] = process.argv.slice(2), dir = path.join(S, 'work', key);
let done = {}; try { done = JSON.parse(await readFile(path.join(dir, 'screen-keep.json'), 'utf8')); } catch {}
const cands = JSON.parse(await readFile(path.join(dir, 'candidates.json'), 'utf8')).filter(t => !t.inA && !t.inB && t.n >= 3 && !(t.id in done));
await mkdir(path.join(dir, 'screen'), { recursive: true }); await mkdir(path.join(dir, 'screen-out'), { recursive: true });
const one = s => s.replace(/\s+/g, ' ').trim();
const size = 150; let k = 0; const files = [];
for (let i = 0; i < cands.length; i += size) {
  const f = `screen-r${round}-${String(++k).padStart(2, '0')}.txt`;
  await writeFile(path.join(dir, 'screen', f), cands.slice(i, i + size).map(t => `${t.id} | r/${t.sub} | ${t.created} | ${one(t.title)} || ${one(t.body).slice(0, 500)}`).join('\n') + '\n');
  files.push(f);
}
console.log(key, cands.length, 'unscreened posts in', files.length, 'files:', files.join(' '));
