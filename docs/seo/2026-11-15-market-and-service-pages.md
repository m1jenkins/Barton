# City pages and more service-intent pages — November 15, 2026

Read this before editing a `car-buying-service-<city>.html` page, `car-buying-service-near-me.html`, `car-buying-concierge.html`, `car-finder-service.html`, `new-car-buying-service.html` or `car-buying-help.html`, or before adding another city.

## Decision

Mason asked on November 15, 2026 for more pages "capturing searches for people seeking car buying assistance", including "in specific markets. So someone searching for car buying assistance in Los Angeles or Miami", and said "Come up with a plan and execute on it." Eleven pages were built in that session; three more cities followed on November 17, 2026 (see "Philadelphia, Boston and Phoenix"), then four more the same day (see "Dallas–Fort Worth, Houston, San Francisco and Detroit") and four more on November 18, 2026 (see "Seattle, Denver, Minneapolis–St. Paul and Tampa"). Pushing to `main` is the publication step.

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

## Philadelphia, Boston and Phoenix (November 17, 2026)

Mason said on November 17, 2026 to build these three now, overriding the impressions and connector-quota gate under "Next cities", and not to call the listings connector. He was told that no public source publishes metro-level listing counts, median asking prices, top makes or franchised dealer counts for them, and chose "Census counts + S&P". So these three entries in `data/market-pages.json` carry a `figures` block (rows of `[label, value, source and date, registry id]`, a table caption and a note) in place of `new`, `used`, `medianNew`, `medianUsed`, `topMakes` and `franchiseDealers`. Each page shows its figures beside the named source and date, with no outside link, and says the figures come from public sources. They also carry their own `published` date.

| City | Figures | Sources |
| --- | --- | --- |
| Philadelphia | 381 new-car dealer locations; 7th for new-vehicle registrations, $651 average monthly payment, 69 days' supply (January to June 2025) | `MKT-PHL-01` to `04` |
| Boston | 336 new-car dealer locations; 8th, $636, 78 days' supply | `MKT-BOS-01` to `04` |
| Phoenix | 218 new-car dealer locations; nothing else public was found | `MKT-PHX-01` |

- **Dealer locations** are NAICS 44111 (new car dealers) establishments from the Census Bureau's County Business Patterns 2023 county file (`cbp23co.zip`, dated June 26, 2025), summed over the counties of the 2023 metro delineation (`list1_2023.xlsx`: CBSA 37980, 14460 and 38060). The county breakdown is in each registry row. The 2024 file was not out on November 17, 2026; recheck it at the next refresh. The Census API needs a key, so the file is the source.
- **Rank, payment and supply** come from S&P Global Mobility's October 2, 2025 blog post "Mapping the market" (published on Mobility Global's site), for designated market areas (Philadelphia; Boston-Manchester), January to June 2025. Phoenix is outside its top ten. These are a DMA, not the Census metro area, and the page says so.
- A city-by-city comparison of these figures with the six listing-count cities is not valid: different boundaries, different measures. The hub's table lists only the six listing-count cities and names the three others in a sentence.
- CarEdge publishes city-level new listing counts (Phoenix: 10,320 on October 27, 2026). They were not used: CarEdge is a competitor on our comparison pages, the radius is undefined, and its republishing terms were not checked.
- Renderer changes: `scripts/render-market-pages.mjs` takes `figures` (a `marketFigures` helper), a per-city `published` date and a dated-sources line, and the hub counts and names the cities from the data. `buying/market.css` sizes the figures table and stacks it (label, value, source) at 700px and below. `scripts/build-market-maps.mjs` now draws a state that surrounds the whole map (Phoenix had no outline point inside the frame). The six existing pages changed only in their "Other cities" list; their maps and tables are byte-identical. `scripts/_tests/market-pages.test.mjs` checks each figure, its source text and its `MKT-*` registry row for `figures` cities.
- Photos: Philadelphia, the Benjamin Franklin Parkway (Meihe Chen, CC BY-SA 4.0); Boston, Storrow Drive below Beacon Hill (King of Hearts, CC BY-SA 4.0); Phoenix, Interstate 10 at Loop 202 and State Route 51 (Alan Stark, CC BY-SA 2.0). Cropped to 1920x1080 with sharp (JPEG quality 82; WebP 78; AVIF 52).
- The Philadelphia circle takes in a corner of Maryland (Cecil County) as well as Pennsylvania, New Jersey and Delaware; the Delaware River is the Pennsylvania and New Jersey line and is drawn as coast, not dashed, so the map caption says so.
- Claim row: `MARKET-PAGES-2026-11-17`.

## Dallas–Fort Worth, Houston, San Francisco and Detroit (November 17, 2026)

Mason asked on November 17, 2026 for a second wave built the same way as Philadelphia, Boston and Phoenix: public figures only, no listings connector, no CarEdge or other competitor data. Austin was left out because the page template says there is no office in the city.

| City | Slug | Circle center | Figures | Sources |
| --- | --- | --- | --- | --- |
| Dallas–Fort Worth | `car-buying-service-dallas-fort-worth.html` | Arlington (76010), midway between the two downtowns | 381 dealer locations; 3rd, $808, 62 days’ supply | `MKT-DFW-01` to `04` |
| Houston | `car-buying-service-houston.html` | Downtown Houston (77002) | 317; 4th, $840, 63 | `MKT-HOU-01` to `04` |
| San Francisco (Bay Area) | `car-buying-service-san-francisco.html` | Union Square (94108) | 229 (San Francisco-Oakland-Fremont) and 91 (San Jose-Sunnyvale-Santa Clara), two rows; 10th, $718, 74 | `MKT-SFO-01` to `05` |
| Detroit | `car-buying-service-detroit.html` | Downtown Detroit (48226) | 263; 9th, $586, 61 | `MKT-DET-01` to `04` |

- **Census counts.** The 2024 county file (`cbp24co.zip`) still returned 404 on November 17, 2026, so all four use County Business Patterns 2023. Since reference year 2017 CBP drops any cell with fewer than three establishments (CBP methodology page), so a county with one or two new-car dealers has no NAICS 44111 row. Four Houston counties (Austin, Chambers, San Jacinto, Waller) and San Benito (San Jose metro) are in that position, and their county sums (313 and 89) undercount. Houston and San Jose therefore use the CBP 2023 metropolitan area file (`cbp23msa.zip`, same release date), which publishes the metro totals directly (317 and 91). For Dallas–Fort Worth, San Francisco-Oakland-Fremont and Detroit every county has a row and the county sum equals the metro file. County breakdowns are in each registry row. The San Francisco page shows the two Census metros as separate rows and never adds them.
- **S&P figures** are from the same October 2, 2025 "Mapping the market" post, re-read on November 17, 2026. The market paragraphs use only that post's own comparisons (Dallas–Fort Worth and Houston have the highest payments and the article ties that to full-size pickups; Detroit is the only market under $600 and has the lowest supply; San Francisco and Miami are the only two where EV registrations outnumber hybrids).
- **Texas.** These are city pages, not metro-contract releases: `data/metro-release.json` (which reserves `dallas-fort-worth.html` and `houston.html`), the noindex legacy Texas pages and their `legacyTexas` hashes are unchanged, and no new page links them. The September 16 metro decision ruled flood-history advice out of Texas metro copy, so the Houston and Dallas–Fort Worth pages carry none. Two tests that keep the legacy Texas pages off the sitemap matched any URL ending in `houston.html` or `fort-worth.html`; they now match the whole path.
- **Circles.** All four are single-state except Detroit, whose circle takes a thin strip of Ohio north of Toledo and, across the Detroit River, part of Essex County, Ontario. None overlaps an earlier city page. The Dallas–Fort Worth circle covers the same ground as the noindex legacy Dallas, Fort Worth and Arlington pages. Bits of the Red River (the Oklahoma line) touch the top edge of that map, outside the circle, and its caption says so.
- **Canada.** The Detroit page says nothing about whether Canadian dealers are covered; that is Mason's call (open item 5).
- **Local sections.** Dallas–Fort Worth: hail (NWS Fort Worth climate narrative), summer heat, NTTA toll roads. Houston: heat on batteries and hoses (AAA Texas, as reported by ABC13 Houston), testing the air conditioning in slow traffic (same source), TxDOT's Houston-area toll roads, full-size pickups and garages. San Francisco: one-way bridge tolls (511.org, Golden Gate Bridge district), home charging (US Department of Energy), curbing wheels on steep streets (SFMTA) and the Public Works street grade map. Detroit: road salt (Michigan EGLE winter road maintenance guide; MDOT's pages refused automated reads) and winter tires (Michigan State Police). An automaker employee-pricing section was drafted for Detroit and dropped because it would have added a service claim nobody has approved.
- **Renderer and map script.** `scripts/build-market-maps.mjs` takes an optional `foreignLand` list (ISO codes) and a second folder holding Natural Earth's `ne_10m_admin_0_countries_lakes` file (public domain), and draws that country as land with no dashed line (Detroit: `["CAN"]`); and an optional `centerAnchor` (`"end"` puts the center label left of the dot, `"below"` under it) for a city with places just east of center (San Francisco, Dallas–Fort Worth). `scripts/render-market-pages.mjs` credits Natural Earth on a map that uses `foreignLand`. The nine earlier maps and pages are byte-identical apart from each page's "Other cities" list and the hub's sentence naming the public-figure cities.
- Photos: Dallas–Fort Worth, the High Five Interchange (Danazar, CC BY-SA 3.0; the original is 1979 px wide, so the crop is close to full size); Houston, the Katy Freeway from the McKee Street overpass (Famartin, CC BY-SA 4.0); San Francisco, traffic on the Golden Gate Bridge (Frank Schulenburg, CC BY-SA 4.0); Detroit, northbound I-75 under the Waterman Street bridge (42-BRT, CC0 1.0). Cropped to 1920x1080 with sharp (JPEG quality 82; WebP 78; AVIF 52), metadata stripped; no plate is readable at 3x zoom.
- Sources read for the local sections (November 17, 2026): weather.gov/fwd/dfw_narrative (hail and summer heat); ntta.org/plan-your-trip (NTTA roads, ZipCash); txdot.gov Houston-area toll roads page (electronic tolls, Grand Parkway); abc13.com July 2022 report quoting AAA Texas (battery, hoses and belts, air conditioning); 511.org/travel/bridges (one-way toll directions); goldengate.org/tolls; afdc.energy.gov home and multifamily charging pages; sfmta.com blog on curbing wheels (and the Public Works street grade map); Michigan EGLE "Winter Road Maintenance" (road salt corrodes vehicles); michigan.gov/msp winter tire safety tips. Place coordinates: Census Gazetteer and, for Ontario, Natural Resources Canada geonames.
- Claim row: `MARKET-PAGES-2026-11-17-B`.

## Seattle, Denver, Minneapolis–St. Paul and Tampa (November 18, 2026)

Mason approved building this wave on November 18, 2026, overriding the impressions gate that "Next cities" then set. Same method as the last two waves: public figures only, no listings connector, no CarEdge or other competitor data. Austin stays out (the template says there is no office in the city), and no Texas city was added.

| City | Slug | Circle center | Figure | Source |
| --- | --- | --- | --- | --- |
| Seattle | `car-buying-service-seattle.html` | Downtown Seattle (98101) | 254 dealer locations, Seattle-Tacoma-Bellevue (county file) | `MKT-SEA-01` |
| Denver | `car-buying-service-denver.html` | Downtown Denver (80202) | 153, Denver-Aurora-Centennial (metro file) | `MKT-DEN-01` |
| Minneapolis–St. Paul | `car-buying-service-minneapolis-st-paul.html` | St. Paul’s Midway (55104), midway between the two downtowns | 216, Minneapolis-St. Paul-Bloomington (metro file) | `MKT-MSP-01` |
| Tampa | `car-buying-service-tampa.html` | Downtown Tampa (33602) | 186, Tampa-St. Petersburg-Clearwater (county file) | `MKT-TPA-01` |

- **Census counts.** `cbp24co.zip` and `cbp24msa.zip` still returned 404 on November 18, 2026, so all four use County Business Patterns 2023 (files dated June 26, 2025), NAICS 44111, with counties from the 2023 delineation (`list1_2023.xlsx`). Seattle and Tampa's county sums equal the metro file. Denver's county file has no row for Clear Creek, Elbert, Gilpin or Park (sum 152 against 153) and the Twin Cities' none for Chisago, Le Sueur or Mille Lacs (211 against 216), so those two cite the metro file. County breakdowns are in each registry row. Neighboring Census metros inside the circles (Boulder, Greeley, Lakeland-Winter Haven, North Port-Bradenton-Sarasota, Bremerton, Olympia) were counted but not shown; each page shows one figure, like Phoenix.
- **S&P.** "Mapping the market" (October 2, 2025) was re-read on November 18, 2026: none of the four is among its ten DMAs, so there are no S&P rows.
- **Circles.** Seattle, Denver and Tampa are single-state. The Seattle circle stops about 96 miles short of the Canadian border, outside both the circle and the map frame. The Twin Cities circle crosses into Wisconsin (Hudson, River Falls, New Richmond, Prescott), and the Census metro itself includes two Wisconsin counties. In the Census state file the St. Croix (and below Prescott the Mississippi) is a shared edge, so the line draws dashed, and the caption says it follows those rivers (Minnesota DNR: most of the St. Croix is the state boundary; it meets the Mississippi near Prescott). No circle overlaps an earlier city page; the nearest existing centers are 205 miles away (Tampa to Miami).
- **Local sections** (sources read November 18, 2026). Seattle: WSDOT toll pages for SR 520, SR 99 and the Tacoma Narrows Bridge (Pay By Mail costs more; Tacoma Narrows also has toll booths); the WSDOT ferry schedule page (routes, Best Times to Travel); Seattle City Light’s EV FAQ (dryer-type outlet) and the Department of Energy home-charging page. Denver: the NWS "Top 12 Events of the 2010s in Colorado" (2018 hail); CDOT’s current traction-law page (tires rated all-weather or winter with the required tread, or chains or a traction device; all-wheel drive only "highly recommends", although a February 2025 CDOT release listed it as an option); E-470’s FAQ and License Plate Toll pages. Twin Cities: two MPCA bulletins (salt damages vehicles); AAA Minneapolis tire maintenance (quarter test); MnDOT’s E-ZPass pages. Tampa: AAA Club Alliance on summer sun (dashboard, paint, battery, air conditioning); the Tampa Hillsborough Expressway Authority’s SunPass guide; WUSF’s April 9, 2026 report quoting FDOT on the Skyway going cashless. No tax, registration, emissions or flood advice; the Tampa page carries no flood or hurricane-damage advice.
- **Renderer.** `scripts/render-market-pages.mjs` spells numbers up to twenty in the hub (it stopped at ten, and the hub now names eleven public-figure cities). No CSS or test change. The thirteen earlier maps and pages are byte-identical apart from each page's "Other cities" list and the hub's sentence naming the public-figure cities.
- **Photos.** Seattle, I-5 southbound on the Ship Canal Bridge (SounderBruce, CC BY-SA 2.0); Minneapolis–St. Paul, I-94 at Dale Street (Tony Webster, CC BY 2.0), with one minivan’s rear plate blurred because it was close to legible at 3x zoom; Tampa, the Sunshine Skyway Bridge (Joseph Gage, CC BY-SA 2.0). All from Commons’ 1920px renditions (originals returned 429 to this client), cropped to 1920x1080 with sharp (JPEG 82, WebP 78, AVIF 52), metadata stripped. Denver has no photo yet.
- Claim row: `MARKET-PAGES-2026-11-18`.

## Rules for all twenty-two pages

- Steer Me Right statements reuse the approved rows word for word: `PLAN-NAMES-2026-10-23`, `DRIVE-RIGHT-SCOPE-2026-10-23`, `PRO-SCOPE-2026-10-23`, `COMPENSATION-COPY-2026-10-05`, `REFUND-LINE-2026-10-05`, `REPLY-WINDOW-2026-10-05`, `TIMELINE-2026-10-05`, `MSRP-DISCOUNT-2026-09-28`, the homepage's "Not sure which plan you need?" line and its "paperwork remotely where we can" line (`HOMEPAGE-PLAN-CARDS-2026-10-30`).
- No outside links, except a city photo's credit (its Wikimedia Commons file and licence; the test allows exactly those two). The one competitor statement ("Most services where a person negotiates for you charge $999 or more") points to `compare-car-buying-services.html`, where the sources are registered. If that line stops being true there, change it here too.
- No leasing, trade-in or financing-help claim. `car-buying-help.html` says plainly that Steer Me Right is not a lender and offers no financial assistance, because some "car buying assistance" searches are about money.
- City claim row: `MARKET-PAGES-2026-11-15` in `data/claims.csv`.

## Open items for Mason

1. **Data terms.** The pages publish aggregate counts and median asking prices drawn from the listings connector (MarketCheck on the pull date; not named on the pages). Nobody has checked that the subscription allows this. If it does not, remove the tables and the first paragraph of each `market` entry and rebuild.
2. **Connector quota.** The pull made 18 calls. Two of the dealership-directory calls came back `429 Monthly API quota exhausted` (New York and Washington, which is why those two pages show no dealership count); other calls in the same batch succeeded. Check the quota before the next paid car search.
3. **The District of Columbia line.** The Washington page tells District residents to ask before paying, because nearly every dealer near them is out of state and the $395 plan excludes out-of-state dealers. If Mason treats Maryland and Virginia dealers as in scope for a District buyer on the $395 plan, change `plan` for that market.
4. **Texas.** Houston, Dallas, Fort Worth, San Antonio and the other legacy Texas pages stay `noindex`. Indexing them is a separate recorded decision. The Dallas–Fort Worth and Houston city pages (November 17, 2026) do not change that.
5. **Canadian dealers.** The Detroit circle crosses into Ontario. (The Seattle circle does not reach Canada.) Neither plan statement mentions Canadian dealers. If Mason wants to say whether Windsor-area dealers are in scope, add it to that page's `plan` and caption.

## Next cities

Seventeen city pages now exist, and the site would pass twenty with the next wave of four. Before adding cities, settle the linking: today every city page links every other city, and the hub and `blog.html` link every city, all enforced by `scripts/_tests/market-pages.test.mjs`. Mason has to approve the change (for example, each page links the hub plus its region's cities, and `blog.html` links the hub plus a compact list). Wait for Search Console data on the November 17 and 18 pages (see "Measurement") unless Mason says to build sooner. Candidates with public Census figures and no reserved-slug conflict: San Diego, Orlando, Charlotte, Portland, St. Louis, Baltimore. Each needs its own figures and its own paragraphs; do not publish a city with borrowed numbers or none.

## Maintenance

- Refresh the figures at least quarterly (claim rows expire 2027-02-15): update `data/market-pages.json` (`inventory.pulledOn`, `updated`, each market's numbers and any sentence that quotes them; for the public-figure cities, the `figures` rows and their `MKT-*` registry rows), rebuild, and update the sitemap `lastmod` dates.
- The calls used: `search_active_cars` with `zip`, `radius=50`, `car_type=new|used`, `rows=0`, `stats=price` (and `facets=make|0|3` for new); `search_dealerships` with `zip`, `radius=50`, `dealer_type=franchise`, `mc_category=Dealer`, `rows=1`. Do not facet on `dealer_id`; the response is enormous.

## Measurement

1. After each push: `npm run indexnow` with the new page paths and the hub, then Search Console URL Inspection and Request indexing for each new URL.
2. Four weeks after each wave (the November 18 wave: December 16, 2026): impressions, clicks and position for its `local_service` rows in `docs/seo-execution/query-map.csv`, and visits from those pages to `schedule.html`.
3. A city page with impressions but no clicks needs a better title. A city page with no impressions after six weeks should be checked for index status before anything is rewritten. If Search Console reports the city pages as duplicates of each other or of the hub, stop adding cities and thicken the existing ones.

## Records

`sitemap.xml`, `llms.txt`, `blog.html` (`ItemList` positions 22 to 39 for the hub and the seventeen cities), `car-buying-service.html` (links), `data/content-inventory.csv` (one row per page), `docs/seo-execution/query-map.csv` (`local_service` and `service_intent` rows, `SEO-2026-11-15`), `data/claims.csv` (`MARKET-PAGES-2026-11-15`, `MARKET-PAGES-2026-11-17`, `MARKET-PAGES-2026-11-17-B`, `MARKET-PAGES-2026-11-18`), `data/source-registry.csv` (`MKT-*`), `data/market-maps/*.svg`, `scripts/_tests/market-pages.test.mjs`, `package.json` and `.github/workflows/checks.yml` (`check:markets`).
