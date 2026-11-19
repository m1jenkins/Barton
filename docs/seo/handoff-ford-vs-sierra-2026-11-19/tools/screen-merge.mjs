import { readFile, writeFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { S } from './lib.mjs';
const key = process.argv[2], dir = path.join(S, 'work', key);
let all = {}; try { all = JSON.parse(await readFile(path.join(dir, 'screen-keep.json'), 'utf8')); } catch {}
for (const f of await readdir(path.join(dir, 'screen-out')).catch(() => [])) Object.assign(all, JSON.parse(await readFile(path.join(dir, 'screen-out', f), 'utf8')));
await writeFile(path.join(dir, 'screen-keep.json'), JSON.stringify(all));
const v = Object.values(all); console.log(key, 'screened', v.length, 'kept', v.filter(Boolean).length);
