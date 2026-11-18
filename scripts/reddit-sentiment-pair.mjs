// Builds a car-versus-car Reddit file (the shape scripts/reddit-sentiment.mjs summarize() reads) from two per-car
// files in data/reddit-sentiment/cars/, so a comparison page needs no fresh collection when both cars are coded.
//
// Threads: every thread in either car file whose post names both cars. Comments: those threads' comments, deduplicated
// by Reddit id (a neutral thread can sit in both files; car a's coding wins), with picks mapped to "a", "b" or null and
// opinions about any other model dropped. Venues: each car's home subreddits, every other subreddit neutral.
// It prints the thread and pick counts per venue so you can tell whether a head-to-head top-up collection is needed.
// Usage:
//   node scripts/reddit-sentiment-pair.mjs <keyA> <keyB> <page.html> [--out file]
//   node scripts/reddit-sentiment-pair.mjs toyota-camry honda-accord toyota-camry-vs-honda-accord.html --out /tmp/pair.json
// Without --out it writes data/reddit-sentiment/<page stem>.json, replacing any file there.
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { summarize } from './reddit-sentiment.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const carFile = key => path.join(root, 'data/reddit-sentiment/cars', `${key}.json`);

export function derivePair(carA, carB, page) {
  const side = { [carA.car.key]: 'a', [carB.car.key]: 'b' };
  const threads = new Map(), comments = new Map(), keep = new Set();
  for (const coded of [carA, carB]) {
    const both = new Set(coded.threads.filter(thread => thread.names.includes(carA.car.key) && thread.names.includes(carB.car.key)).map(thread => thread.id));
    for (const thread of coded.threads) if (both.has(thread.id) && !threads.has(thread.id)) threads.set(thread.id, { id: thread.id, subreddit: thread.subreddit, created: thread.created });
    for (const id of coded.keepThreads ?? []) if (both.has(id)) keep.add(id);
    for (const comment of coded.comments) {
      if (!both.has(comment.thread) || comments.has(comment.id)) continue;
      comments.set(comment.id, { id: comment.id, thread: comment.thread, rec: side[comment.rec] ?? null, m: comment.m.filter(([model]) => side[model]).map(([model, topic, polarity]) => [side[model], topic, polarity]) });
    }
  }
  // Only threads with coded comments are listed, as in the hand-built pair files.
  const used = new Set([...comments.values()].map(comment => comment.thread));
  const list = [...threads.values()].filter(thread => used.has(thread.id)).sort((x, y) => x.created.localeCompare(y.created) || x.id.localeCompare(y.id));
  const subreddits = {};
  for (const thread of list) subreddits[thread.subreddit] = (subreddits[thread.subreddit] ?? 0) + 1;
  const dates = list.map(thread => thread.created);
  return {
    page,
    cars: { a: carA.car.name, b: carB.car.name },
    home: { a: carA.home, b: carB.home },
    collected: [carA.collected, carB.collected].sort().at(-1),
    source: carA.source,
    threadsFrom: dates[0] ?? null,
    threadsTo: dates.at(-1) ?? null,
    subreddits,
    rules: `Derived by scripts/reddit-sentiment-pair.mjs from data/reddit-sentiment/cars/${carA.car.key}.json and ${carB.car.key}.json: every thread in either file whose post names both cars, with its coded comments (deduplicated by id; picks of other models and opinions about other models dropped). Collection and coding rules are in the two car files. Venues: ${[carA.home].flat().map(sub => `r/${sub}`).join(', ')} (home of car a), ${[carB.home].flat().map(sub => `r/${sub}`).join(', ')} (home of car b), every other subreddit neutral. See scripts/reddit-sentiment.mjs.`,
    gaps: [...new Set([...(carA.gaps ?? []), ...(carB.gaps ?? [])])],
    uncoded: (carA.uncoded ?? 0) + (carB.uncoded ?? 0),
    keepThreads: [...keep].filter(id => used.has(id)).sort(),
    threads: list,
    comments: [...comments.values()].sort((x, y) => x.thread.localeCompare(y.thread) || x.id.localeCompare(y.id)),
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [keyA, keyB, page] = process.argv.slice(2);
  const outIndex = process.argv.indexOf('--out');
  if (!keyA || !keyB || !page) { console.error('usage: node scripts/reddit-sentiment-pair.mjs <keyA> <keyB> <page.html> [--out file]'); process.exit(1); }
  const [carA, carB] = await Promise.all([keyA, keyB].map(async key => JSON.parse(await readFile(carFile(key), 'utf8'))));
  const pair = derivePair(carA, carB, page);
  const out = outIndex > 0 ? path.resolve(process.argv[outIndex + 1]) : path.join(root, 'data/reddit-sentiment', page.replace(/\.html$/, '.json'));
  await writeFile(out, `${JSON.stringify(pair, null, 1)}\n`);
  const summary = summarize(pair);
  console.log(`wrote ${path.relative(process.cwd(), out)}`);
  console.log(`threads ${summary.threads} (${Object.entries(pair.subreddits).map(([sub, n]) => `r/${sub} ${n}`).join(', ')}), comments ${summary.comments}`);
  for (const venue of ['a', 'b', 'neutral']) {
    const figures = summary.venues[venue];
    console.log(`${venue === 'neutral' ? 'neutral' : `home of ${venue}`}: ${figures.threads} threads, ${figures.comments} comments, picks a ${figures.recommend.a} / b ${figures.recommend.b}`);
  }
  const neutral = summary.venues.neutral.recommend, picks = neutral.a + neutral.b;
  console.log(`index a ${summary.index.a}, b ${summary.index.b}; neutral picks ${picks}${picks ? ` (a ${Math.round((100 * neutral.a) / picks)}%)` : ''}`);
  if (summary.venues.neutral.threads < 30 || picks < 100) console.log('Thin neutral venue: consider a head-to-head top-up collection before building a comparison page on this.');
}
