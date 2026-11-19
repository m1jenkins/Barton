// node validate-coded.mjs <pair>: each work/<pair>/coded/batch-NN.json must cover exactly the ids in batches/batch-NN.txt
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { S } from './lib.mjs';
const key = process.argv[2], dir = path.join(S, 'work', key);
const models = JSON.parse(await readFile('/home/user/Barton/data/reddit-sentiment/models.json', 'utf8'));
for (const f of (await readdir(path.join(dir, 'batches'))).sort()) {
  const n = f.match(/batch-(\d+)/)[1], text = await readFile(path.join(dir, 'batches', f), 'utf8');
  const want = new Set([...text.matchAll(/^([A-Za-z0-9]+) \| p\d+ \| /gm)].map(m => m[1]));
  let got; try { got = JSON.parse(await readFile(path.join(dir, 'coded', `batch-${n}.json`), 'utf8')); } catch (e) { console.log(key, n, 'MISSING/INVALID', e.code ?? e.message.slice(0, 40)); continue; }
  const ids = new Set(got.comments.map(c => c.id)); const miss = [...want].filter(i => !ids.has(i)), extra = [...ids].filter(i => !want.has(i));
  const bad = got.comments.filter(c => (c.rec && !models[c.rec]) || c.m.some(m => !models[m[0]])).length;
  const picks = got.comments.filter(c => c.rec).length, ops = got.comments.filter(c => c.m.length).length;
  console.log(key, n, miss.length || extra.length || bad ? `PROBLEM missing ${miss.length} extra ${extra.length} badkeys ${bad}` : 'ok', `comments ${got.comments.length}/${want.size} picks ${picks} opinions ${ops}`);
}
