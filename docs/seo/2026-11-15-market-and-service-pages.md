# City pages and more service-intent pages — November 15, 2026

Read this before editing a `car-buying-service-<city>.html` page, `car-buying-service-near-me.html`, `car-buying-concierge.html`, `car-finder-service.html`, `new-car-buying-service.html` or `car-buying-help.html`, or before adding another city.

## Decision

Mason asked on November 15, 2026 for more pages "capturing searches for people seeking car buying assistance", including "in specific markets. So someone searching for car buying assistance in Los Angeles or Miami", and said "Come up with a plan and execute on it." Eleven pages were built in that session. Pushing to `main` is the publication step.

| URL | Owns | Why |
| --- | --- | --- |
| `/car-buying-service-near-me.html` | car buying service near me, nationwide car buying service | Hub for the city pages; answers the "near me" question honestly (one office, in Austin) |
| `/car-buying-service-{new-york,los-angeles,chicago,miami,atlanta,washington-dc}.html` | car buying service / car buying help in that city | The six largest non-Texas metros we could pull listing data for |
| `/car-buying-concierge.html` | car buying concierge, car concierge service | Keyword Planner 100–1K a month; the site had no impressions for any "concierge" query (October 23 pull) |
| `/car-finder-service.html` | car finder service, car locator, personal car shopper | Keyword Planner 100–1K a month and rising; 8 + 12 + 13 Search Console impressions with no page |
| `/new-car-buying-service.html` | new car buying service, new car negotiation service | Sibling of `used-car-buying-service.html` |
| `/car-buying-help.html` | car buying help, help buying a car, car buying assistance | 24 + 20 impressions; mostly tips-seekers, so the page leads with the free tools and the free question |

None of these eleven pages uses "broker", and a test keeps it that way. The broker searches are handled by `car-broker-vs-car-buying-service.html`, published the same day in a separate session (see [2026-11-15-seo-overhaul.md](2026-11-15-seo-overhaul.md)).

## How the city pages relate to the metro release contract

`data/metro-release.json` reserves `los-angeles.html`, `miami.html`, `service-areas.html` and the other metro slugs, and `scripts/metro-release.mjs` blocks a public page at any of them until serp, baseline, reviewer and dossier records exist. None of that evidence was gathered. The city pages therefore use different URLs (`car-buying-service-<city>.html`), carry no `barton-metro-id` marker, and leave `data/metro-release.json`, `data/entities.json` and `data/services.json` untouched. They are an owner-directed publication, like Austin on September 29, not a metro-contract release. A test keeps them off the reserved slugs.

What keeps them from being the same page six times:

- **Local numbers.** Each page shows dealer listings within 50 miles of the city center on the pull date: new and used counts, median asking prices, the three most-listed new makes and, where the directory call worked, the franchised dealership count. Source: the API connector to dealership listings that the `/car-search` skill uses. Mason asked on November 15, 2026 that public copy not name the provider, since it may change; the pages say "our API connector to dealership listings".
- **Plan guidance that changes with the map.** The Steer Me Right plan does not include out-of-state dealers (owner confirmation, October 23). That matters in New York, Chicago and Washington, where the dealer circle crosses state lines, and not in Los Angeles, Miami or Atlanta. Each page says which.
- **No local pretence.** Every page says the office is in Austin and that there is none in the city. No local review, savings figure, transaction or address. Schema is `Article` plus `BreadcrumbList` only.
- **No tax, title, registration or emissions advice**, in line with the September 16 metro decision.

## How they are built

`data/market-pages.json` holds the figures and each city's own paragraphs. `scripts/render-market-pages.mjs` writes the seven root files, taking the head assets, header and footer from `car-negotiation-service.html`. Do not edit the seven files by hand.

```sh
npm run build:markets   # after changing the data, the script, or car-negotiation-service.html's head/header/footer
npm run check:markets   # CI runs this; fails when the files drift
```

A change to `logo-motion.css/js`, `script.js` or `buying/app.js` hashes means updating `car-negotiation-service.html` first, then `npm run build:markets`.

The four service pages are ordinary hand-edited files in the same guide layout (`buying/resources.css`).

## City-specific sections (November 17, 2026)

Mason said on November 17, 2026 that the six city pages were "pretty much the same" with "nothing unique about these pages to this specific market", and asked for free-to-use photos and a local blurb. Chicago is the pilot. Each part is an optional field on a `markets[]` entry, so a city without them renders as before:

- **`photo`**: one photo under the title, from Wikimedia Commons (CC BY, CC BY-SA, CC0 or public domain), handled like the vehicle pages' photos: original in `assets/external/source/market-<city>-<name>-original.jpg` (1920 wide, metadata stripped), AVIF and WebP at 640, 960 and 1600 in `assets/external/optimized/`, credited in the folded "Photo and map credits" list. Prefer a road people there know over a plain skyline, and crop or skip dealer signs. It also becomes the page's `Article.image`.
- **`map`**: the 50-mile dealer circle with state lines, drawn by `scripts/build-market-maps.mjs` from the Census `cb_2024_us_state_500k` file (public domain; the script's header says how to get it) into `data/market-maps/<city>.svg`, which the page inlines. State lines are edges two states share; the coast is drawn plain. `minor` places drop their label on phones. After adding a city's `map`, run the map script, then `npm run build:markets`, and check the map at phone width.
- **`local`**: a "Buying a car around <city>" section of two to four `[heading, paragraph]` pairs about what is really different there (Chicago: road salt and used-car rust, all-wheel drive, getting to the dealer without a car). Same limits as the rest of the page: no tax, registration or emissions advice, no invented local customers, and no inspection claim (we can ask a dealer for photos; the buyer arranges the inspection).
- **More `faq` entries** about the same local issues, so the three shared questions aren't most of the list.
- **`updated`**: a city's own date when only its page changed; update its sitemap `lastmod` too.

The styles are in `buying/market.css`, linked with a content hash only on pages that use these fields. All six cities now have a photo, a map, a local section and extra FAQ entries (New York, Los Angeles, Miami, Atlanta and Washington on November 17, 2026, after the Chicago pilot). Their photos are Wikimedia Commons CC BY, CC BY-SA or CC0 files, credited per page. Maps with no state line in view omit the "State line" key. Still to do: the extra listing figures (top models, days on the lot, hybrid and EV share), which wait on open items 1 and 2.

## Rules for all eleven pages

- Steer Me Right statements reuse the approved rows word for word: `PLAN-NAMES-2026-10-23`, `DRIVE-RIGHT-SCOPE-2026-10-23`, `PRO-SCOPE-2026-10-23`, `COMPENSATION-COPY-2026-10-05`, `REFUND-LINE-2026-10-05`, `REPLY-WINDOW-2026-10-05`, `TIMELINE-2026-10-05`, `MSRP-DISCOUNT-2026-09-28`, the homepage's "Not sure which plan you need?" line and its "paperwork remotely where we can" line (`HOMEPAGE-PLAN-CARDS-2026-10-30`).
- No outside links, except a city photo's credit (its Wikimedia Commons file and licence; the test allows exactly those two). The one competitor statement ("Most services where a person negotiates for you charge $999 or more") points to `compare-car-buying-services.html`, where the sources are registered. If that line stops being true there, change it here too.
- No leasing, trade-in or financing-help claim. `car-buying-help.html` says plainly that Steer Me Right is not a lender and offers no financial assistance, because some "car buying assistance" searches are about money.
- City claim row: `MARKET-PAGES-2026-11-15` in `data/claims.csv`.

## Open items for Mason

1. **Data terms.** The pages publish aggregate counts and median asking prices drawn from the listings connector (MarketCheck on the pull date; not named on the pages). Nobody has checked that the subscription allows this. If it does not, remove the tables and the first paragraph of each `market` entry and rebuild.
2. **Connector quota.** The pull made 18 calls. Two of the dealership-directory calls came back `429 Monthly API quota exhausted` (New York and Washington, which is why those two pages show no dealership count); other calls in the same batch succeeded. Check the quota before the next paid car search.
3. **The District of Columbia line.** The Washington page tells District residents to ask before paying, because nearly every dealer near them is out of state and the $395 plan excludes out-of-state dealers. If Mason treats Maryland and Virginia dealers as in scope for a District buyer on the $395 plan, change `plan` for that market.
4. **Texas.** Houston, Dallas, Fort Worth, San Antonio and the other legacy Texas pages stay `noindex`. Indexing them is a separate recorded decision.

## Next cities

Philadelphia, Phoenix, Boston, the San Francisco Bay Area, Seattle and Denver were planned and dropped when the quota error appeared. Add them only after (a) the quota question is settled and (b) the first six show impressions in Search Console. Each needs its own figures and its own two paragraphs; do not publish a city with borrowed numbers or none.

## Maintenance

- Refresh the figures at least quarterly (claim row expires 2027-02-15): update `data/market-pages.json` (`inventory.pulledOn`, `updated`, each market's numbers and any sentence that quotes them), rebuild, and update the seven sitemap `lastmod` dates.
- The calls used: `search_active_cars` with `zip`, `radius=50`, `car_type=new|used`, `rows=0`, `stats=price` (and `facets=make|0|3` for new); `search_dealerships` with `zip`, `radius=50`, `dealer_type=franchise`, `mc_category=Dealer`, `rows=1`. Do not facet on `dealer_id`; the response is enormous.

## Measurement

1. After the push: `npm run indexnow`, then Search Console URL Inspection and Request indexing for the eleven URLs.
2. After four weeks: impressions, clicks and position for the `local_service` and the new `service_intent` rows in `docs/seo-execution/query-map.csv`, and visits from these pages to `schedule.html`.
3. A city page with impressions but no clicks needs a better title. A city page with no impressions after six weeks should be checked for index status before anything is rewritten. If Search Console reports the city pages as duplicates of each other or of the hub, stop adding cities and thicken the existing ones.

## Records

`sitemap.xml`, `llms.txt`, `blog.html` (two new sections, `ItemList` positions 18 to 28), `car-buying-service.html` (links), `data/content-inventory.csv` (11 rows), `docs/seo-execution/query-map.csv` (14 rows), `data/claims.csv` (`MARKET-PAGES-2026-11-15`), `scripts/_tests/market-pages.test.mjs`, `package.json` and `.github/workflows/checks.yml` (`check:markets`).
