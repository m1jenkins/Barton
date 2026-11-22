# Roundup pages — November 21, 2026

Read this before editing `best-compact-suvs.html`, `best-hybrid-suvs-under-35000.html` or `cheapest-new-pickup-trucks.html`, or adding another ranked roundup. Written from the brief to build three ranked roundups from the price guides plus researched cars, and to refresh `blog-best-cars-under-30k.html`.

## How they are built

`data/roundup-pages.json` holds the sentences, the ranking order, the trim names and each page's `sources`. `scripts/render-roundup-pages.mjs` writes the root files. It takes the page chrome from `car-negotiation-service.html` through `scripts/render-market-pages.mjs`, and styles them with `buying/price-guide.css` plus the small `buying/roundup.css` (ranked item, ruled facts list, quick picks; no cards, square corners, as on the price guides).

```sh
npm run build:roundups   # after changing the data, the script, either stylesheet or car-negotiation-service.html's head/header/footer
npm run check:roundups   # fails when the files drift
```

For a car with a price guide, an entry names the guide (`guide`) and the trims (`startTrim`, `pickTrim`, `baseTrim`, `buyTrim`, `offers[].trim`, plus `col` for the 2026 or 2027 price column). The script reads MSRP, the guide's review scores and photo, the discount row (`payRow`), the Reddit Sentiment Index and the head-to-head pages that exist from `data/vehicle-pages.json`, `data/comparison-pages.json` and `data/reddit-sentiment/cars/`, so a price change in a guide reaches the roundup on the next build. A trim name that a guide no longer lists fails the build. The destination charge is the entry's `dest`: the price guides keep it in prose, not data, so update `dest` by hand when a guide's destination changes. Researched cars (no guide) carry explicit `startMsrp`, `pickMsrp` or `base`/`buy` figures, a shorter entry, no photo and no discount estimate.

Prose can use `{{start:key}}`, `{{startAll:key}}` (with destination), `{{pick:key}}`, `{{pickAll:key}}`, `{{base:key}}`, `{{baseAll:key}}`, `{{dest:key}}` and `{{offer:key:i}}` so numbers follow the data. Numbers typed into prose do not; recheck them when a guide changes.

## Rules

- **Price means MSRP plus the maker's destination charge** on every roundup, and the pages say so. The hybrid page's $35,000 line is checked by a test: every ranked trim must cost $35,000 or less with destination.
- **Each car is priced as its maker sells it now.** A 2026 where our guide covers it, a 2027 where the maker lists only that year (Maverick, Santa Cruz, Frontier, Canyon, Gladiator, Rogue, Equinox, Niro, Corolla Cross). The rows carry the model year.
- **Source ids are `VEH-RND-CSUV-NN`, `VEH-RND-HYBSUV-NN` and `VEH-RND-TRUCK-NN`**, one registry row per source in `data/source-registry.csv` with `article_url` set to the page. A test fails if a link on a page isn't in its `sources` or the registry. Figures reused from a guide keep the guide's URL, and the note says "from the <car> price guide".
- Review scores are quoted from the guides with links, never averaged; no `AggregateRating` or `Review` schema. Rankings are our judgment and the pages say so.
- Photos come from the guides (Wikimedia Commons, credited in the folded "Photo credits" list). Researched cars have none: the Commons photos for those models weren't looked for, because the guides' licence checks and cropping rules make each one a separate job.
- No MarketCheck or listings figures. No savings figures for Steer Me Right clients.
- The generated pages follow the vehicle doc's layout rules (`docs/seo/2026-11-15-vehicle-price-pages.md`). Do not hand-edit them.

## What each page targets

| Page | Targets |
| --- | --- |
| `best-compact-suvs.html` | best compact SUVs, best compact SUV 2026, best small SUV, compact SUV rankings |
| `best-hybrid-suvs-under-35000.html` | best hybrid SUV under $35,000, cheapest hybrid SUV, hybrid SUV under $35k |
| `cheapest-new-pickup-trucks.html` | cheapest new pickup truck, cheapest pickup trucks 2026, cheapest full-size truck |

Query-map rows are in `docs/seo-execution/query-map.csv` (`vehicle_roundup`). Each page has its sitemap entry, `blog.html` card and ItemList item, `llms.txt` line and `data/content-inventory.csv` row.

## Sources method (November 21, 2026)

- **Makers' own pages**, read with a plain browser request: Chevrolet (Equinox from $29,700), Nissan (its page embeds MSRP and destination per model year: Rogue S $29,690 and $1,575, Rogue Hybrid SV $35,490, Frontier S King Cab $32,490 and $1,775), Hyundai (Santa Cruz SE $30,300), Kia (Niro Hybrid $29,890, Sportage), GMC (Canyon Elevation $39,900), Jeep (Gladiator Sport S $43,895), Toyota (Corolla Cross 2026 page and the October 2, 2026 release for the 2027), and the Subaru Crosstrek release. Ford, Honda and Edmunds refused automated requests; Ford's Maverick figures came through Cars.com's November 11, 2026 article.
- **Destination charges** that no maker page showed came from U.S. News's review of each model (Santa Cruz $1,650, Equinox $1,995, Niro $1,495, Corolla Cross $1,595, Gladiator $1,995, Canyon $2,095, Ridgeline $1,495). The Crosstrek's $1,525 is from Subaru's release (a search summary said $1,475; the release says $1,525).
- **EPA** from the fueleconomy.gov web service; **NHTSA** overall ratings from its ratings web service; **cargo space** from U.S. News's model pages.
- Cars with a price guide: figures come from the guides, which carry their own dated sources.

## Open items for Mason

1. **Read every ranking and pick.** Compact SUVs: RAV4, Tucson, Sportage, CR-V, CX-5, Forester, Rogue, Equinox, in that order, and the six "pick by need" lines. Hybrids under $35,000: RAV4 LE, Sportage Hybrid S, Tucson Hybrid SEL, Niro, Corolla Cross Hybrid SE. The trims named on the trucks page ("the one we'd buy") are the guides' picks where a guide exists, and ours for the rest: Maverick XL (with AWD for snow or towing), Santa Cruz SE, Frontier SV, Canyon Elevation, Ridgeline Sport, Gladiator Sport S. The Sierra's pick, the SLT at $55,400, is far from the cheapest trim; the SLE ($49,000) is mentioned as the first with the Google screen.
2. **Weak or snippet-only figures.** The Rogue SV ($32,265 with destination) rests on Motor1's article, whose own table disagrees with its text; the S figure is Nissan's. The Frontier SV ($36,190) is a 2026 figure from U.S. News. The Ridgeline Sport ($40,795) is U.S. News's 2026 figure; Honda's own page refused the request and sources disagreed by $200. The Gladiator's 2027 start of $43,895 is Jeep's, but U.S. News lists 2026 trims at $43,015 (Sport S) and a table showing every Sport-family trim at $39,820, which we left out as a likely artifact. The Corolla Cross Hybrid's 42 mpg is Toyota's estimate for the 2027 (the EPA had not listed it); its cargo figure is U.S. News's AWD figure for the gas model. Cargo for hybrids is U.S. News's figure for the model's gas version in several rows.
3. **The Maverick XL is a hybrid-only 2027 at $29,990**, $10 under $30,000 in `blog-best-cars-under-30k.html`. A 2026 gas XL ($27,145 on U.S. News's page) may still be on lots and cheaper.
4. **Prose numbers**: the FAQs and verdict lines contain typed figures (for example "$710 cheaper", "$2,385 under the F-150"). They match the data today; a guide price change won't update them.
5. **Discount ranges** shown on the compact SUV and truck pages are the guides' estimates for the trim we'd buy. Nothing is shown for researched cars.
6. **Destination figures for guide cars** are kept in the roundup data (`dest`), from each guide's FAQ or trims note. Update them when a guide does.
7. **Photos** for researched cars: none. Wikimedia photos for the Equinox, Rogue, Maverick and others were not sourced.
8. **Cross-links from the price guides** to these pages are left to the coordinator.

## Monthly maintenance

Refresh prices and destination (`dest`) on the first days of each month and when a maker changes model year, then `checkedOn`, `updated`, the sitemap `lastmod` and the `next_review` of the `VEH-RND-*` rows (December 21, 2026 now). When a maker prices the 2027 Corolla Cross, Rogue Hybrid or Seltos Hybrid, recheck the hybrid page's line: the Kia Seltos Hybrid was not yet priced on November 21, 2026 and may qualify.

## Refresh of `blog-best-cars-under-30k.html` (November 21, 2026)

The page is hand-written, noindex (`noindex, follow`, owner-approved October 1, 2026) and not in the sitemap or on `blog.html`, so no sitemap `lastmod` was changed. The brief says the page earns Search Console impressions; a noindex page cannot, so the brief may mean another URL. Indexing was left as it is. Mason should decide whether to index it.

What changed, all by hand in the page's own style (legacy styles, no outside links, publishers named in the text):

- **Method.** The old copy said picks were ranked by total ownership cost but gave no figures. It now says picks come from price with destination, published scores and fuel economy, and counts destination everywhere.
- **Stale prices fixed.** Santa Cruz is no longer under $30,000 (2027 SE $31,950 with destination, last model year); the Maverick XL at $29,990 is the one pickup that fits; the "F-150 or Tacoma exceeds $45,000" line now cites an F-150 XLT at $47,490 and a Tacoma TRD Sport at $42,160 with destination; the Camry LE is $30,895 with destination, so it no longer fits; the Corolla Hybrid line cites $24,975 ($26,270 with destination) and 50 mpg; the federal EV credit line is gone (the credit has ended) and the Bolt LT at $28,995 is the new EV pick.
- **Claims removed** because no source backed them: handling, interior-quality and "feels" lines, the Texas trade-up resale line, the $4,000 fuel-savings line, the "60% of a five-year budget" and 45%/70% depreciation lines (replaced by the RAV4 guide's iSeeCars figures: 24.8% average, 13.8% for a RAV4 Hybrid).
- **Links added**: price guides for the Civic, Camry and Corolla, the Civic versus Corolla and Camry versus Accord pages, and the new compact SUV and cheapest pickup roundups.
- **Dates**: `dateModified` 2026-11-21 and a visible "Updated November 21, 2026" in the byline.
- Structure and headings kept, except "Best Midsize Sedan" became "Best Sedan" because the Civic is a compact, and "Best Truck" now names the Maverick alone.
