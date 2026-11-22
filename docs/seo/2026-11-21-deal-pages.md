# Deal pages — November 21, 2026

Two generated pages that roll the 22 vehicle price guides up into the searches a price guide cannot answer on its own. Read `docs/seo/2026-11-15-vehicle-price-pages.md` first; these pages read their car figures from `data/vehicle-pages.json` and follow its rules.

| Page | Targets |
| --- | --- |
| `cars-selling-below-msrp.html` | "cars selling below msrp", "which new cars have the biggest discounts", "dealer markups 2026" |
| `new-car-deals-this-month.html` | "0% apr car deals november 2026", "best car deals this month", "<brand> incentives november" |

## How they are built

```sh
npm run build:deals   # after changing either data file, the script, buying/deal-pages.css, or car-negotiation-service.html's head/header/footer
npm run check:deals   # CI runs this; fails when the pages drift
```

- `data/deal-pages.json`: copy, ordering inputs and each page's own sources. It holds no car figure that the guides also hold.
- `data/vehicle-pages.json`: every MSRP, discount range, offer, loan input and photo. A refresh of the guides flows into both pages on the next build.
- `scripts/deal-model.mjs`: the parsers and arithmetic. `scripts/render-deal-pages.mjs`: the HTML. `buying/deal-pages.css`: a small sheet (`dl-*` classes) loaded after `buying/price-guide.css`, whose title band, section bar, ruled sections, tables, plan cards and questions the pages borrow.
- `scripts/_tests/deal-pages.test.mjs`: pages match the renderer; indexable, canonical, one h1, Article `dateModified` equals the visible date; plan lines and banned words; every outside link is a registered `VEH-DEAL-*` or `VEH-INC-*` row with `article_url` equal to the page; sitemap, `blog.html`, `llms.txt`, inventory and query-map entries; ranking order; parsers throw on wording they do not know.
- Do not edit the generated HTML. `planCards` is copied from `render-vehicle-pages.mjs`; a test checks the strings still match.

### The ranking page

- Order: the middle of the "Fair deal" range of the pay row that covers the trim we'd buy (`payRow` in the data file), ties broken by the "Strong deal" midpoint. The renderer maps "2–3% under", "4% under", "4% or more", "MSRP" and "Any discount" to numbers and throws on anything else, as the guides' renderer does.
- Groups are cut at fair-deal midpoints of 5 and 3. Each group has a `count`; if a refresh moves a car across a line the build fails so the group intro (which says "seven of these eight are pickups") gets reread.
- Dollars are the percentage of the pick trim's starting MSRP, rounded to $50, as in the guides. The guides' own tiles use each row's `example` trim, so a dollar figure here can differ slightly from the guide's tile.
- Each row's "More room on…" line is the guide's best other pay row, shown only when it beats the pick row.
- "Trims that sell at or near sticker" lists every pay row whose fair deal tops out at 2% under or less. It is computed, so it changes with the guides.
- Tesla Model Y and Model 3 are fixed-price new, so they sit in their own table with the used-car discount rows from their guides. They are not ranked.

### The deals page

- Every row of every guide's `incentives.rows` is classified (`classify()` in `deal-model.mjs`): rate, cash, lease, program (military, college, first responder, loyalty, conquest), used or certified, no offer, other. Anything that cannot be parsed into the figure its kind needs throws (a cash row with no dollar figure, for example), and the fix is a `rowKinds` override in the data file. An override that no longer matches a row fails the build, as does one whose `needsInDetail` text left the row.
- Ends: `endState()` reads every date in the guide's `ends` string against `asOf` (2026-11-21). "Over" offers are dropped; "mostly over" ones (the F-150's 0%, ended November 16 in most regions) stay in the tables with a flag and are excluded from the verdict.
- Leases are ranked within pickups, SUVs and cars by payment plus the due-at-signing amount spread over the term, for the first region each guide lists. Rows whose payments the parser cannot read stay in the full list.
- Cash or 0%: `breakEven()` finds the loan rate at which cash and the low rate cost the same, from each guide's `incentives.choice` inputs (price, months, the 6.35% average new-car rate). Below that rate, take the cash.
- Prose that quotes a guide's wording carries `needs` strings; the build fails if a refreshed guide no longer contains them. Copy may use `{tokens}`; an unknown token throws.
- Headline offers and the by-brand blocks use each guide's `incentives.cards`; the military, college and loyalty table merges identical offers across cars.

## Rules

Same as the price guides: no listings-connector figures, no tax, title or registration advice, no dealer names, review scores not used, "car search" never the banned word, never call Steer Me Right a broker, no Steer Me Right deal results. Steer Me Right statements are the approved plan copy, word for word. The estimates sentence ("our estimate…, not a promise.") appears once, in the sources note.

Sources: every outside link is a guide's own source under a new id (`VEH-DEAL-01` to `-64`, `VEH-INC-01` to `-21`), registered in `data/source-registry.csv` with the page as `article_url`, the original row's URL, authority and title, and a note that the figure was carried from the guide and not reread on November 21. The `from` field in the data file names the guide source. Nothing on either page was read fresh from a publisher on November 21; the date read is the guide's `checkedOn`, shown beside each source.

## Maintenance

**The deals page goes stale at month end.** Most offers on it (113 of the 151 listed) end November 30, 2026, and Honda and Kia's run to January 4, 2027. On December 1:

1. Refresh the price guides' incentives first (`incentives.rows`, `.cards`, `.choice`, `pay` ranges, `checkedOn`), per the monthly steps in the vehicle doc.
2. In `data/deal-pages.json`: set `asOf` and `updated`; rename "November 2026" in `pages.*.title`, `h1`, `description`, brand headings and `lead`; re-pick the "four to look at" (`picks` need a guide card with that label and figure); recheck the `choice` pairs (rate and cash option indices), `regions` items and `needs` strings; update `groups[].count` and the group intros if cars move between groups; update `rowKinds` overrides the build rejects.
3. `npm run build:deals`, then read the verdict paragraph of each page against the tables. Bump the `sitemap.xml` `lastmod` for both pages, the `next_review` of the `VEH-DEAL-*` and `VEH-INC-*` registry rows, and the date in `llms.txt`, `blog.html` copy and the inventory notes.
4. If a month's guides are not refreshed, take the deals page down (or set it to noindex) rather than leave expired offers up; the ranking page ages more slowly but its "headline offer" column shares the problem.

At model-year changeover: new guides need a `cars` entry (brand, segment, `payRow`, `prices` source ids, a `line` with `needs`), a `brandOffers` entry if the maker is new, and source rows.

## Open items for Mason

Every judgment on these pages is mine from the guides, not yours. Read these first.

1. **The ranking itself.** Midpoint of the fair range for the trim we'd buy, which is the guides' own pick. A different trim moves a car (the Tundra's Capstone row is 6–7%, the Camry's LE/SE/XSE row 5–6%). Group lines at 5% and 3% are mine.
2. **The verdict on the ranking page**: pickups leave the most room, the RAV4, Civic and CR-V the least.
3. **The four picks on the deals page**: Tucson 0%, Sportage 0% (through January 4), Silverado's 0% against its cash, Tundra 1.99%. The "who it suits" and "the catch" lines are opinion.
4. **Per-car one-liners (ranking page).** Each quotes a guide figure and carries a `needs` check. The Colorado line says Edmunds' Texas prices put the LT near 10% under so our 6–7% is the cautious end; the RAV4 line calls its 24 days the tightest supply of the 21 (true of the days-of-supply figures the guides cite, not of every metric).
5. **Break-even rates** are our arithmetic on each guide's `choice` inputs. They treat a buyer's own loan as running the same term as the guide's example, and leave out employee pricing (Ram), which its 0% gives up. The Ranger row pairs Ford's cash with its 4.9% although Ford's page does not say they combine.
6. **Weak or snippet-only figures carried over**: the Raptor R markups of $5,000 and up (a Ford Raptor Forum thread read through a page summary, cited as such on the page); the Tucson plug-in offers (read at one ZIP); Ford's Los Angeles 2.9% rate (no end date); the Colorado's November 30 end date (GM Authority and Kelley Blue Book, not Chevrolet's page); the Camry and Corolla lease regions; Tesla's financing (TeslaNorth and Electrek, since Tesla's site refuses automated reads).
7. **The F-150's 0% offer ended November 16 in most regions**; it stays in the tables with a flag. Decide whether a flagged row should be removed outright.
8. **Offer counts.** "151 offers" counts guide rows, which include one row per region or model year in some guides, so it overstates distinct offers.
9. **Lease ranking** uses the first region each guide lists. Three lease rows have payments the parser does not read and appear only in the full list.
10. **Dollar column** uses the pick trim's price where the guides use the row's example trim; the two differ on a few cars (the Sierra's SLT against its Elevation example, for one).
11. **The cash table** ranks the GMC Denali diesel at the manufacturer's $6,755 and leaves out the $4,545 dealer reduction GMC bundles into its $11,300 headline.
12. **Cross-links** to these pages from the price guides, the hub (`new-car-pricing-incentives.html`) and the homepage are not added; the coordinator handles those.
13. **Photos**: every guide's main photo appears at about 112px with the guides' credits in a folded "Photo credits" list on the ranking page only. The Model Y and Model 3 credits appear there too although those photos are not shown.
