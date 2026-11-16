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
// the neutral venue's. See docs/seo/2026-11-15-vehicle-price-pages.md. Usage:
//   node scripts/reddit-sentiment.mjs data/reddit-sentiment/toyota-rav4-vs-honda-cr-v.json
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

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const summary = summarize(JSON.parse(await readFile(process.argv[2], 'utf8')));
  console.log(JSON.stringify(summary, null, 2));
}
