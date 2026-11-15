# SEO overhaul: audit and fixes (2026-11-15)

Read this before more work on rankings for "car buying service", "auto broker" or the brand name. It records what was checked on November 15, 2026, what changed in the repo, and what only Mason can do. Mason asked for it the same day: the site "barely shows up" for auto broker and car buying service searches and not at all for "steer me right".

A second session was working that day on the old-domain redirects, indexing the Texas city pages, business details in the schema and the checkout message. This change stays out of those four areas.

Evidence tags follow the [growth plan](2026-09-25-seo-growth-plan.md).

## What the audit found

| Area | Result | Evidence |
|---|---|---|
| Crawl access | Healthy. Home returns 200 to browser, Googlebot and OAI-SearchBot user agents; apex → www is one 301; old-domain pages redirect one to one | `curl`, November 15 |
| Raw HTML | Healthy. Content, links and JSON-LD are in the first response; no JavaScript needed | `curl` |
| Speed (mobile Lighthouse, live) | Home 85, service pages 88–91; LCP 1.2–1.4 s, CLS 0; SEO category 100 on all three | Lighthouse, November 15 |
| Bing | Now indexed (`site:steermeright.com` returns the site). It returned nothing on November 7 | Bing results page |
| "Auto broker" and "car broker" searches | **Gap.** No page was written for them. The old property showed "car broker service" (49 impressions, position 28.7), "car broker" (17, 8.9), "car broker near me" (6, 3.7) | [October 23 pull](2026-10-23-search-console-queries-and-ad-themes.md) |
| Homepage links | **Gap.** The homepage did not link the negotiation page (the best non-brand query) or the cost page | Link map |
| Short addresses | **Gap.** `/about`, `/austin`, `/pricing` and the like returned 404 | `curl` |
| "Car buying service" (position 29 on the old property) | Not an on-page fault. The pages are relevant and fast. What is missing is other sites naming the business [OBSERVED: mentions track visibility far better than links] | Search Console, October 23 |
| "steer me right" alone | Unchanged from the [November 7 record](2026-11-07-brand-search-visibility.md): the song owns the phrase. Only reviews, mentions and branded searches move it | That record |

## What changed

| Change | Why | Tag |
|---|---|---|
| New page `/car-broker-vs-car-buying-service.html` | Answers auto broker and car broker searches honestly: brokers are often dealer-paid, Steer Me Right is buyer-paid. Steer Me Right is never called a broker. Outside quotes are `CMP-CB-01` to `CMP-CB-04` in `data/source-registry.csv`, read November 15, 2026, next review February 15, 2027 | RECOMMENDED |
| Homepage "Car buying services" tab links the negotiation, cost and broker pages | Passes the homepage's weight to the three service-intent pages. The October 30 rule (no competitor pages on the homepage) still holds | RECOMMENDED |
| Links to the broker page from `car-buying-service.html`, `car-buying-service-cost.html`, `car-negotiation-service.html`, `blog.html` (card and `ItemList` position 17), `llms.txt`, `sitemap.xml` (22 URLs) | No orphan page | RECOMMENDED |
| `vercel.json`: `/about`, `/austin`, `/schedule` and every other indexable page name without `.html` redirect (308) to the `.html` URL; `/pricing` goes to `/schedule.html` | Typed and shared short addresses reach the page | RECOMMENDED |
| `draft-artifacts/cities/*` regenerated | They are built from the homepage | — |

The broker page follows the rules in the [October 18](2026-10-18-competitor-comparison-pages.md) and [November 10](2026-11-10-service-intent-and-competitor-pages.md) records. It gives no competitor prices; it links the cost page for those. Its Steer Me Right lines reuse approved claim rows word for word. `scripts/_tests/competitor-comparisons.test.mjs` now checks it with the other service pages.

When a city page becomes indexable, add its name to the `/:page(...)` redirect in `vercel.json`.

## After the merge

1. `npm run indexnow`.
2. Search Console → URL Inspection → Request indexing for `/car-broker-vs-car-buying-service.html` and `/`.
3. `curl -sI https://www.steermeright.com/about` should return 308 to `/about.html`.

## What only Mason can do, by expected effect

1. **Reviews.** Four Google reviews is the thinnest part of the picture. Ask every finished buyer. The automatic review-ask email (`CUSTOMER_EMAIL_ENABLED`) does this once it is switched on. [OBSERVED]
2. **One Google Business Profile.** Remove the duplicate "AM LLC" listing and fix the hours (step 5 of the November 7 record). Two listings split the reviews and risk suspension. [REQUIRED]
3. **Listings where "auto broker" searchers look.** BBB has "Auto Brokers" and "Car Buying" categories for Austin. Add Bing Places, Apple Business Connect and Yelp with the same name, email and hours. [RECOMMENDED]
4. **Bing Webmaster Tools.** Import the Search Console property (step 8 of the November 7 record). Bing feeds Copilot and part of ChatGPT search. [RECOMMENDED]
5. **Mentions.** YouTube videos that say "Steer Me Right", disclosed answers in car-buying forums, local Austin press. This is what moves "car buying service" off page three. [OBSERVED]
6. **Brand ads** on "steer me right" until the organic result appears. [HYPOTHESIS for organic effect]

## Measure

Four weeks after the merge, in the steermeright.com Search Console property: impressions and position for the `SEO-2026-11-15` rows in `docs/seo-execution/query-map.csv`, and for "car negotiation service" and "car buying service". No impressions on the broker page after six weeks means check index status and links before rewriting.
