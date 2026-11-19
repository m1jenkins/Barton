// node themes.mjs <pair>: digest of coder theme notes (paraphrased) for the entry writer.
import { readFile, readdir, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { S, PAIRS } from './lib.mjs';
const key = process.argv[2], dir = path.join(S, 'work', key), P = PAIRS[key];
const out = { a: {}, b: {} };
for (const f of (await readdir(path.join(dir, 'coded'))).filter(f => /^batch-\d+\.json$/.test(f))) {
  const j = JSON.parse(await readFile(path.join(dir, 'coded', f), 'utf8'));
  for (const side of ['a', 'b']) for (const [topic, v] of Object.entries(j.themes?.[side] ?? {})) for (const pol of ['pos', 'neg']) for (const note of v[pol] ?? []) ((out[side][topic] ??= {})[pol] ??= []).push(note);
}
let md = `# Coder theme notes, ${key} (paraphrased by the coders; "Owners report" = what owners report, not confirmed defects)\n`;
for (const side of ['a', 'b']) { md += `\n## Car ${side} (${P[side]})\n`; for (const [topic, v] of Object.entries(out[side])) { md += `\n### ${topic}\n`; for (const pol of ['pos', 'neg']) if (v[pol]?.length) md += `- ${pol}: ${v[pol].join(' | ')}\n`; } }
await mkdir(path.join(S, 'entries', key), { recursive: true });
await writeFile(path.join(S, 'entries', key, 'themes-digest.md'), md);
console.log('wrote themes digest', md.length);
