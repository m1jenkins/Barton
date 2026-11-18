// Reddit Sentiment Index: turns hand-coded Reddit comments into the figures on a car-versus-car page.
//
// The coded data file (data/reddit-sentiment/<page>.json) holds no comment text and no usernames: for each comment, its
// Reddit id, its thread, which car it tells the poster to buy (rec: "a", "b" or null) and the opinions it gives
// (m: [car, topic, polarity] with polarity "pos", "neg" or "mixed"). Each thread records its subreddit.
//
// Venues. Each car's own subreddit (`home`) recommends its own car: r/crv picks the CR-V and r/rav4 the RAV4 by wide
// margins. Pooling every comment would mostly measure which subreddit is bigger, so the figures treat three venues
// equally: car a's subreddit, car b's subreddit, and every other (neutral) subreddit. A venue's opinions are scaled so
// each venue carries the same weight, whatever its size. Picks are reported per venue, and the headline pick share is
// the neutral venue's. See docs/seo/2026-11-15-vehicle-price-pages.md. Usage (a pair file or a car file):
//   node scripts/reddit-sentiment.mjs data/reddit-sentiment/toyota-rav4-vs-honda-cr-v.json
//   node scripts/reddit-sentiment.mjs data/reddit-sentiment/cars/toyota-camry.json
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

export const topics = {
  reliability: 'Reliability',
  mpg: 'Fuel economy',
  ride: 'Ride and comfort',
  noise: 'Noise and refinement',
  power: 'Power and driving',
  tech: 'Interior and tech',
  space: 'Space and practicality',
  price: 'Price and value',
  dealer: 'Dealers and markups',
  safety: 'Safety and driver aids',
};
export const venues = ['a', 'b', 'neutral'];

const empty = () => ({ pos: 0, neg: 0, mixed: 0 });
const add = (x, y, weight = 1) => { for (const key of ['pos', 'neg', 'mixed']) x[key] += y[key] * weight; return x; };
const total = counts => counts.pos + counts.neg + counts.mixed;
// 50 + 50 × (positive − negative) ÷ all opinions: 0 is all negative, 100 all positive, 50 even. Mixed counts on neither side.
const score = counts => total(counts) ? Math.round(50 + 50 * (counts.pos - counts.neg) / total(counts)) : null;
// Net from −100 to +100, the topic charts' scale.
const net = counts => total(counts) ? Math.round(100 * (counts.pos - counts.neg) / total(counts)) : null;

export function summarize(coded) {
  const subreddit = Object.fromEntries(coded.threads.map(thread => [thread.id, thread.subreddit.toLowerCase()]));
  // A car's home venue is one subreddit or a list of them (r/civic and r/CivicSi).
  const home = Object.fromEntries(Object.entries(coded.home).flatMap(([car, subs]) => [subs].flat().map(sub => [sub.toLowerCase(), car])));
  const venueOf = comment => home[subreddit[comment.thread]] ?? 'neutral';
  const per = Object.fromEntries(venues.map(venue => [venue, {
    recommend: { a: 0, b: 0 },
    cars: { a: empty(), b: empty() },
    topics: Object.fromEntries(Object.keys(topics).map(key => [key, { a: empty(), b: empty() }])),
    comments: 0,
    threads: new Set(),
  }]));
  for (const comment of coded.comments) {
    const venue = per[venueOf(comment)];
    venue.comments++;
    venue.threads.add(comment.thread);
    if (comment.rec === 'a' || comment.rec === 'b') venue.recommend[comment.rec]++;
    for (const [car, topic, polarity] of comment.m) {
      if (!topics[topic] || !['a', 'b'].includes(car) || !['pos', 'neg', 'mixed'].includes(polarity)) throw new Error(`Bad opinion on ${comment.id}: ${car} ${topic} ${polarity}`);
      venue.cars[car][polarity]++;
      venue.topics[topic][car][polarity]++;
    }
  }
  // Equal weight per venue: scale each venue's counts by 1 ÷ its opinions about both cars.
  const weight = Object.fromEntries(venues.map(venue => { const n = total(per[venue].cars.a) + total(per[venue].cars.b); return [venue, n ? 1 / n : 0]; }));
  const balanced = car => venues.reduce((sum, venue) => add(sum, per[venue].cars[car], weight[venue]), empty());
  const topicFigures = Object.fromEntries(Object.keys(topics).map(key => [key, Object.fromEntries(['a', 'b'].map(car => {
    const counts = venues.reduce((sum, venue) => add(sum, per[venue].topics[key][car]), empty());
    const weighted = venues.reduce((sum, venue) => add(sum, per[venue].topics[key][car], weight[venue]), empty());
    return [car, { mentions: total(counts), net: net(weighted) }];
  }))]));
  return {
    index: { a: score(balanced('a')), b: score(balanced('b')) },
    venues: Object.fromEntries(venues.map(venue => [venue, {
      comments: per[venue].comments,
      threads: per[venue].threads.size,
      recommend: per[venue].recommend,
      index: { a: score(per[venue].cars.a), b: score(per[venue].cars.b) },
      opinions: total(per[venue].cars.a) + total(per[venue].cars.b),
    }])),
    topics: topicFigures,
    comments: coded.comments.length,
    opinions: venues.reduce((sum, venue) => sum + total(per[venue].cars.a) + total(per[venue].cars.b), 0),
    picks: venues.reduce((sum, venue) => sum + per[venue].recommend.a + per[venue].recommend.b, 0),
    threads: coded.threads.length,
  };
}

// ---- One car (data/reddit-sentiment/cars/<key>.json), for the Reddit section of a price guide ----
// A car file is coded for every model a comment names, not only its own car, so a car-versus-car page can be pulled
// out of two car files (scripts/reddit-sentiment-pair.mjs). A vehicle key is the price guide's slug stem
// (toyota-rav4), and models with no guide yet get a key in the same shape (kia-telluride).
//
// Two venues count equally: the car's own subreddits (home) and every other subreddit (neutral). The index uses the
// pair pages' formula on opinions about this car only, each venue scaled to the same weight. The pick share is the
// car's share of neutral picks in threads that named it and at least one other model, so a thread asking "LE or SE?"
// cannot inflate it. Cross-shopped models are the ones most often named alongside it in neutral threads, by thread.
export const carVenues = ['home', 'neutral'];
export const keyPattern = /^[a-z0-9]+(?:-[a-z0-9]+)+$/;

export function summarizeCar(coded, { crossShopped = 8 } = {}) {
  const car = coded.car.key;
  const thread = Object.fromEntries(coded.threads.map(entry => [entry.id, entry]));
  const home = new Set([coded.home].flat().map(sub => sub.toLowerCase()));
  const venueOf = id => home.has(thread[id].subreddit.toLowerCase()) ? 'home' : 'neutral';
  const per = Object.fromEntries(carVenues.map(venue => [venue, { car: empty(), topics: Object.fromEntries(Object.keys(topics).map(key => [key, empty()])), comments: 0, threads: new Set() }]));
  // Picks in neutral threads that offered a choice (named this car and at least one other model).
  const choice = new Set(coded.threads.filter(entry => venueOf(entry.id) === 'neutral' && entry.names.includes(car) && entry.names.length > 1).map(entry => entry.id));
  const picks = { car: 0, all: 0, threads: new Set(), by: {} };
  for (const comment of coded.comments) {
    if (!thread[comment.thread]) throw new Error(`Comment ${comment.id} is in unlisted thread ${comment.thread}`);
    const venue = per[venueOf(comment.thread)];
    venue.comments++;
    venue.threads.add(comment.thread);
    if (comment.rec !== null && !keyPattern.test(comment.rec)) throw new Error(`Bad pick on ${comment.id}: ${comment.rec}`);
    if (comment.rec && choice.has(comment.thread)) {
      picks.all++;
      picks.threads.add(comment.thread);
      picks.by[comment.rec] = (picks.by[comment.rec] ?? 0) + 1;
      if (comment.rec === car) picks.car++;
    }
    for (const [model, topic, polarity] of comment.m) {
      if (!keyPattern.test(model) || !topics[topic] || !['pos', 'neg', 'mixed'].includes(polarity)) throw new Error(`Bad opinion on ${comment.id}: ${model} ${topic} ${polarity}`);
      if (model !== car) continue;
      venue.car[polarity]++;
      venue.topics[topic][polarity]++;
    }
  }
  const weight = Object.fromEntries(carVenues.map(venue => { const n = total(per[venue].car); return [venue, n ? 1 / n : 0]; }));
  const balanced = carVenues.reduce((sum, venue) => add(sum, per[venue].car, weight[venue]), empty());
  const topicFigures = Object.fromEntries(Object.keys(topics).map(key => {
    const counts = carVenues.reduce((sum, venue) => add(sum, per[venue].topics[key]), empty());
    const weighted = carVenues.reduce((sum, venue) => add(sum, per[venue].topics[key], weight[venue]), empty());
    return [key, { mentions: total(counts), pos: counts.pos, neg: counts.neg, net: net(weighted) }];
  }));
  const named = {};
  for (const entry of coded.threads) {
    if (venueOf(entry.id) !== 'neutral' || !entry.names.includes(car)) continue;
    for (const model of new Set(entry.names)) if (model !== car) named[model] = (named[model] ?? 0) + 1;
  }
  return {
    car,
    index: score(balanced),
    venues: Object.fromEntries(carVenues.map(venue => [venue, { comments: per[venue].comments, threads: per[venue].threads.size, opinions: total(per[venue].car), index: score(per[venue].car) }])),
    topics: topicFigures,
    picks: { car: picks.car, all: picks.all, threads: picks.threads.size, share: picks.all ? Math.round((100 * picks.car) / picks.all) : null, by: picks.by },
    crossShopped: Object.entries(named).sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0])).slice(0, crossShopped).map(([key, threads]) => ({ key, threads })),
    neutralThreads: coded.threads.filter(entry => venueOf(entry.id) === 'neutral' && entry.names.includes(car)).length,
    comments: coded.comments.length,
    opinions: carVenues.reduce((sum, venue) => sum + total(per[venue].car), 0),
    threads: coded.threads.length,
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const coded = JSON.parse(await readFile(process.argv[2], 'utf8'));
  const summary = coded.car ? summarizeCar(coded) : summarize(coded);
  console.log(JSON.stringify(summary, null, 2));
}
