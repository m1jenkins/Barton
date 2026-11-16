# Vehicle price pages — November 15, 2026

Read this before editing `ford-f-150-price.html` or adding another `<make>-<model>-price.html` page.

## Decision

Mason asked on November 15, 2026 for "a page for every popular modern car", built as "sort of a dashboard for buyers": MSRP, trims, "what the steer me right take is on what trim they think is best", whether the car is best bought new, used or CPO, current incentives, and "what we think the percentage under MSRP is possible for the average deal". Information comes from online sources; where we are unsure, the page says so and points to contact. The goal is traffic that leads to the paid plans. The Ford F-150 is the first page and the template.

Nothing is published until it is pushed to `main`. The F-150 page was built and wired in this session and left uncommitted for Mason to read first.

## How they are built

`data/vehicle-pages.json` holds every figure and sentence. `scripts/render-vehicle-pages.mjs` writes the root files, taking the page chrome and plan cards from `scripts/render-market-pages.mjs` (so from `car-negotiation-service.html`) and adding `buying/price-guide.css` for the at-a-glance tiles. Do not edit the generated files by hand.

```sh
npm run build:vehicles   # after changing the data, the script, price-guide.css, or car-negotiation-service.html's head/header/footer
npm run check:vehicles   # CI runs this; fails when the files drift
```

A price cell, engine, "room to negotiate" or incentive end date left empty in the data renders as an "Ask us" link to the pricing page. Use that instead of guessing.

## Page sections

Mason asked on November 15, 2026 for the page to follow the Edmunds model page, then for it to be "more visual. more graphics. less text", with the safety ratings broken out into their own report card. The order is: a main photo and four smaller ones, at-a-glance tiles, a lead paragraph, pros and cons, review score cards with meters, the safety report card (NHTSA stars by test, recalls by model year), the trim price ladder, the trim we'd buy, the discount range chart and the worked price walk, plan cards, incentive cards, three new-versus-used charts, rivals, what to watch for, questions, sources.

Every chart is plain HTML and CSS drawn by the generator from numbers in the data file: one hue (sign blue) on a white or tinted track, each value printed beside its bar, no script. The full tables (engines by trim, every offer with dates, which route fits) and the source list sit in collapsed `<details>` so the text stays on the page for search engines without sitting in the reader's way. Keep prose to a sentence or two per section; put a number in a chart or a tile before putting it in a paragraph.

The section order follows Edmunds; the words, numbers and photo are ours or licensed. He also called the guide layout's call-out box, with its rule down the left edge, an AI giveaway: the rule was removed from `.highlight-box` in `buying/resources.css` for every guide page the same day, and the opening paragraph of a vehicle page is plain text, not a box. Do not bring back left-edge accent rules on call-outs.

## Rules

- **Every outside figure has a source.** Each entry in a vehicle's `sources` gets a `VEH-<MODEL>-NN` row in `data/source-registry.csv`, and a test enforces it. Link the manufacturer's own page for MSRP and incentives.
- **Review scores belong to their publishers.** Quote each score with its source and a link, do not average them, do not copy review text, and never add `AggregateRating` or `Review` schema for them (a test blocks it).
- **Photos need a licence we can meet.** A main photo plus a row of four smaller ones, all from Wikimedia Commons (CC BY, CC BY-SA or public domain), each credited in its caption with a link to the file and, where there is one, the licence. Mason first chose Ford's press photos on November 15, 2026; Ford's media site says they are for editorial use only and it refuses scripted downloads, so he switched to Wikimedia the same day. Do not take photos from Edmunds or other review sites. Originals go in `assets/external/source/` (`vehicle-<make>-<model>-<name>-original.jpg`), resized AVIF and WebP files in `assets/external/optimized/`. Avoid photos where a dealer's name is readable; crop it out and say “cropped” in the credit.
- **Estimates are labelled as estimates.** The discount ranges are "our estimate", dated, with "not a promise" on the page. No "guaranteed", "best price", "lowest price" or savings figures for Steer Me Right clients.
- **Dealer discount and manufacturer cash stay separate.** Published average-paid figures do not say whether rebates are inside them; the page says so.
- **Opinions are Mason's.** The trim pick and the new/used/CPO take are published under his byline. He reads them before the push.
- **No Steer Me Right deal results** until there are enough deals, with each buyer's permission, to cite without identifying anyone.
- **No tax, title or registration advice**, and no naming a dealer in the copy.
- **No listings-connector figures** until the data terms question in `2026-11-15-market-and-service-pages.md` is settled.
- Steer Me Right statements reuse the approved rows word for word (see `VEHICLE-PRICES-2026-11-15` in `data/claims.csv`). Never "brief" or "broker".

## Open items for Mason

1. **Read the opinions.** The F-150 pick (2026 XLT SuperCrew 4x4), the "skip the hybrid unless you need the generator" line, the "buy new, as a 2026" take and the 2023-or-newer floor for used were written from the research, not from Mason. Change `pick`, `condition` and the two matching tiles in the data if he disagrees.
2. **Check the discount table against real deals.** The ranges come from TrueCar averages, iSeeCars invoice figures and forum reports. Mason's own F-150 negotiations, if any, should override them.
3. **Incentives expire.** The 0% offer ended November 16 in most regions and the rest end November 30, 2026. The page needs a refresh in the first days of each month or it will show dead offers.
4. **Figures read through a page summary, not line by line**: the add-on examples (CarEdge dealer page) and the Raptor R markup reports (Ford Raptor Forum). The page states them loosely for that reason. Open both before tightening the wording.
5. **Listings connector quota.** Every call returned "Monthly API quota exhausted" on November 15, with a reset around December 1. No connector data is on this page, and a paid car search before the reset will hit the same error.

## Maintenance

- **Monthly**: incentives table, the incentives tile, the worked example if the cash offer changed, `checkedOn`, `updated`, the sitemap `lastmod`, and the `next_review` dates of the `VEH-*` rows. Ford's offers page must be read at more than one ZIP; offers differ by region.
- **At model-year changeover**: the trims table columns, `modelYear`, the short answer and the 2026-versus-2027 question.
- The claim row expires 2026-12-15.

## Adding a model

1. Research the same four things: trims and MSRP from the manufacturer; current incentives from the manufacturer's offers page at several ZIPs; sale price against MSRP (TrueCar, invoice figures, owner forums) and supply; depreciation, used prices, CPO terms, recalls and reliability.
2. Add a `vehicles` entry with its own `sources`, register the `VEH-*` rows, add the sitemap entry, a `blog.html` card and `ItemList` item, an `llms.txt` line, a `data/content-inventory.csv` row and `docs/seo-execution/query-map.csv` rows.
3. `npm run build:vehicles`, then the checks in `README.md`.
4. Once there are several models, add a hub page listing them and move the breadcrumb from Resources to the hub.

Do not publish a model with borrowed numbers or a copied take. A page whose only difference is the model name is a doorway page.

## Measurement

After the push: `npm run indexnow` and Search Console URL Inspection. After four weeks: impressions, clicks and position for the `vehicle_price` rows in `docs/seo-execution/query-map.csv`, and visits from the page to `schedule.html`. Build the next models only after the F-150 page shows impressions.
