# Vehicle price pages — November 15, 2026

Read this before editing `ford-f-150-price.html` or adding another `<make>-<model>-price.html` page.

## Decision

Mason asked on November 15, 2026 for "a page for every popular modern car", built as "sort of a dashboard for buyers": MSRP, trims, "what the steer me right take is on what trim they think is best", whether the car is best bought new, used or CPO, current incentives, and "what we think the percentage under MSRP is possible for the average deal". Information comes from online sources; where we are unsure, the page says so and points to contact. The goal is traffic that leads to the paid plans. The Ford F-150 is the first page and the template.

Nothing is published until it is pushed to `main`. The F-150 page was built and wired in this session and left uncommitted for Mason to read first.

## How they are built

`data/vehicle-pages.json` holds every figure and sentence. `scripts/render-vehicle-pages.mjs` writes the root files, taking the page chrome and plan cards from `scripts/render-market-pages.mjs` (so from `car-negotiation-service.html`) and adding `buying/price-guide.css` for the page's own layout. Do not edit the generated files by hand.

```sh
npm run build:vehicles   # after changing the data, the script, price-guide.css, or car-negotiation-service.html's head/header/footer
npm run check:vehicles   # CI runs this; fails when the files drift
```

A price cell, engine or incentive end date left empty in the data renders as an "Ask us" link to the pricing page. Use that instead of guessing.

## Page sections

Mason asked on November 15, 2026 for the page to follow the Edmunds model page, then for it to be "more visual. more graphics. less text", with the safety ratings broken out into their own report card. The order is: photos, a strip of review scores, a lead paragraph, pros and cons, what to pay (moved up November 16, 2026), the reviewer scorecard, the service call-out, the trim price table, the trim we'd buy, the plans, incentives, three new-versus-used charts, rivals, what to watch for, questions, the safety report card (NHTSA stars or IIHS grades by test, recalls by model year), sources. Mason moved the safety report card from after the scorecard to the bottom on November 16, 2026; the score strip at the top still links down to it.

**Layout (redesigned later on November 15, 2026).** Mason called the first version "very AI generated" and asked for a complete redesign modelled on car review sites, with no "rounded gray boxes". Edmunds, Kelley Blue Book and U.S. News model pages were the references. The page now has its own layout, and it is the one place the site's tinted 24px cards, pill buttons and flat blue title band do not apply:

- White page, hairline rules, square corners. A section starts with a navy rule and a heading; content sits on the open page, not in a card.
- The price panel is a card: frosted glass with large corners, a soft shadow and a pill button, each row a label over its figure on one left edge, linking to the section that explains it (Mason asked for an Apple-style glass card, then for less text, the same day). Keep sentences out of it and do not give it a colored top bar.
- The title and the section bar are on sign blue, straight out of the site header. Under the bar the blue deepens to navy and ends on one shallow arc part-way down the photos (`.vp-stage::before`), so the photos and the glass price panel sit across its edge. Mason asked for this on November 15, 2026 after the white top read as "empty/AI generated" next to Edmunds' blue and white; the single arc and the navy keep it from copying their double wave. Below the arc the page is white. Three things give it depth (Mason asked for another layer the same day): a pale sky arc behind the navy one, swung left so it shows more on that side (`.vp-stage::after`); a lighter blue glow rising from the curve under the price panel; and a soft shadow under the photos.
- The section bar sticks below the site header and marks the current section (CSS only, `:target-current`, where the browser supports it). It is solid sign blue so it matches the band while in it and the header once stuck.
- Two columns on desktop: photos and the review on the left, a price panel (the at-a-glance figures and a link to the plans) that stays in view on the right. On a phone the panel sits under the photos.
- One large photo with the four smaller ones stacked beside it; every credit sits in a folded “Photo credits” link at the foot of the page (moved there November 15, 2026, because the line under the gallery crowded the top of the page on phones).
- The plan cards are the homepage's (`index.html`, `#plans`): the blue card, the dark Pro card, the steering-wheel photos, three lines each, pill buttons. Mason called the flat version "a wall of text" and asked for the homepage design. The copy is the homepage's word for word, held in `planCards` in the render script, so change both together. The buttons stay plain `/schedule.html` links with no `data-plan`.
- The dark "Rather not do this yourself?" call-out sits after the safety section, with a "See the plans" button. Mason asked for the service to be sold higher up the page; do not move it back to the end.
- **What to pay** sits right under the overview (Mason, November 16, 2026) and is in Liquid Glass like the price panel, at his request: one glass card per trim group, with the group and the reason on the left and two tiles on the right, a frosted "Fair deal" and a sign-blue "Strong deal", each a big percent under MSRP plus the dollars off the group's `example` trim (rounded to $50, from that trim's starting MSRP). The worked example below is the sum, sticker − discount = price, in the same glass. `pay.rows[].fair` and `.strong` must read "2–3% under", "4% under", "4% or more", "MSRP" or "Any discount"; the renderer throws on anything else. Mason turned down a percent-axis range chart here twice (November 15 and 16, 2026) as hard to read; do not bring one back.
- The incentives section is ruled like the rest of the review: the four offers on a two-by-two grid (label, figure in ink with its unit in sign blue, one line), the dated note with the link to Ford's offers page, then the cash-or-0% comparison and the military/college note with a figure row and "Ask us". The cash-or-0% block is a copy of Aave's "Unmatched savings rates" card from Mobbin (Mason asked for it on November 15, 2026): copy on the left, a pill bar per deal on the right with the amount at its end, the best deal in sign blue and the rest in gray. Keep "save" out of this block: `scripts/validate-site.mjs` blocks "$5,000" or "$7,000" near it as a client-savings claim, and these figures move every month. The render script works out each amount from `incentives.choice` (price, months, the average rate and each offer's rate and cash): total paid at the average rate with no offer, minus total paid on that deal, rounded to $50. Mason tried a copy of Intercom's offer and add-on cards (cream fill, yellow highlight) on November 15, 2026 and dropped it the same day for not matching the page; do not bring back the fill, the highlight or the boxed cards.
- Every other section sits on a full-width, square-edged tint band (`vp-section--band`, `--sage`); since what to pay moved up on November 16, 2026 the tinted ones are what to pay, our pick, incentives, rivals and questions, modelled on Kelley Blue Book’s model pages, so a new section is obvious while scrolling (Mason, November 16, 2026). The band replaces the navy rule on that section and the white one after it. Edmunds’ rounded gray section panels were considered and left out, since Mason ruled out rounded gray boxes on this page.
- Every class is `vp-*` in `buying/price-guide.css`. Do not reuse `.guide-*`, `.highlight-box` or `.price-*` here.

Every chart is plain HTML and CSS drawn by the generator from numbers in the data file: one hue (sign blue), each value printed beside its mark, no script. The full tables (engines by trim, every offer with dates, which route fits) and the source list sit in collapsed `<details>` so the text stays on the page for search engines without sitting in the reader's way. Keep prose to a sentence or two per section; put a number in a chart or the panel before putting it in a paragraph. A trim row with `"pick": true` gets the "Our pick" tag.

The section order follows Edmunds; the words, numbers and photo are ours or licensed. He also called the guide layout's call-out box, with its rule down the left edge, an AI giveaway: the rule was removed from `.highlight-box` in `buying/resources.css` for every guide page the same day, and the opening paragraph of a vehicle page is plain text, not a box. Do not bring back left-edge accent rules on call-outs.

## Rules

- **Every outside figure has a source.** Each entry in a vehicle's `sources` gets a `VEH-<MODEL>-NN` row in `data/source-registry.csv`, and a test enforces it. Link the manufacturer's own page for MSRP and incentives.
- **Review scores belong to their publishers.** Quote each score with its source and a link, do not average them, do not copy review text, and never add `AggregateRating` or `Review` schema for them (a test blocks it).
- **Photos need a licence we can meet.** A main photo plus four smaller ones, all from Wikimedia Commons (CC BY, CC BY-SA or public domain), each credited in the folded “Photo credits” list at the foot of the page with a link to the file and, where there is one, the licence. Mason first chose Ford's press photos on November 15, 2026; Ford's media site says they are for editorial use only and it refuses scripted downloads, so he switched to Wikimedia the same day. Do not take photos from Edmunds or other review sites. Originals go in `assets/external/source/` (`vehicle-<make>-<model>-<name>-original.jpg`), resized AVIF and WebP files in `assets/external/optimized/`. Avoid photos where a dealer's name is readable; crop it out and say “cropped” in the credit.
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

## Toyota RAV4 (added November 15, 2026)

Mason asked for "the exact same page as the Ford F-150 but for the 2026/27 Toyota RAV4". `toyota-rav4-price.html` uses the same template and data shape, with these differences:

- **Safety uses IIHS grades.** NHTSA had not crash-tested the 2026 or 2027 RAV4 on November 15, 2026 (ratings API vehicle IDs 22557 to 22559 and 22738 to 22740 read "Not Rated"). The renderer now takes `safety.outOf` (a count of IIHS ratings at Good, shown as squares) and a `grade` per row in place of `stars`. Switch back to NHTSA stars when NHTSA publishes them.
- **No cash back.** Toyota lists none on the RAV4, so the cash-or-0% block compares Toyota's 4.99% with Experian's average rate instead.
- **2027 prices are partly secondary.** Toyota confirmed only the LE ($32,300) and plug-in SE ($42,100); the rest come from Kelley Blue Book's November 6 report because Toyota's pricing PDF refused downloads. Replace them with Toyota's figures once toyota.com shows the 2027. Mason had the notes under both trims tables removed on November 15, 2026 (too long), so the page says this only through its sources list. He also dropped the trims table's "Room to negotiate" column the same day because it repeated the discount table under "What to pay"; discounts by trim live only there.
- **Photos.** The two XLE Premium photos carried a dealer's plate frames; the frames are blurred and the credits say so.

Open items for Mason, as for the F-150: the pick (2026 XLE Premium, AWD if you see snow), "skip the plug-in unless you can charge at home", "buy new, as a 2026" and the 2023 floor for used were written from the research. The discount ranges lean on TrueCar's November averages, Edmunds' Texas-based suggested prices and a small CarWhere sample (55 buyers); there is no TrueCar figure for the plug-in. Offers all end November 30, 2026.

## Honda CR-V (added November 16, 2026)

Mason asked for "the same page as the Ford 150 and Toyota RAV4 for the Honda CR-V". `honda-cr-v-price.html` uses the same template and data shape. Differences from the RAV4:

- **Safety uses NHTSA stars.** NHTSA rates every 2026 version 5 stars overall. IIHS rates the updated moderate overlap test Poor (rear passenger), so the CR-V is not a 2026 Top Safety Pick; the page says so in the safety note and the cons.
- **Two model years, one car.** Honda's 2027 is the 2026 with a price rise ($600 on the LX, $400 on the rest, destination $1,450 to $1,550). Honda's finance and lease offers are on the 2027 only, and no region we checked had offers on a leftover 2026, so the take is "buy new, and price both model years". The 2026 Sport Touring went from $42,250 to $42,550 in Honda's January 6, 2026 price update; some outlets still quote the old figure. Honda says an all-new, hybrid-only CR-V arrives in 2027 as a 2028 model; update the page when it is priced.
- **What to pay** is for the 2026, with three groups: gas trims, the Sport and TrailSport hybrids (closest to sticker), and the Sport-L and Sport Touring (most room).
- **Photos.** No TrailSport photo exists on Wikimedia Commons, so the gallery shows a Sport Touring instead. The main photo is cropped to drop another brand's truck. All metadata was stripped, because the rear photo's file carried the car's VIN.

Open items for Mason: the pick (2026 Sport Hybrid, AWD if you see snow), "price both model years" and the 2023 floor for used were written from the research. The discount ranges lean on TrueCar's November averages (about 40 sales a month), Edmunds' Austin-based suggested prices and CarWhere's 48 verified buyers. Offers end January 4, 2027, except the military and graduate offers (March 31, 2027). Honda's site blocks scripted reads, so the offers were read in a browser at four ZIPs.

## GMC Sierra 1500 (added November 16, 2026)

Mason asked to "start a product page for the GMC Sierra". `gmc-sierra-1500-price.html` covers the Sierra 1500 (not the HD or the Sierra EV) in the same template and data shape. Differences:

- **The 2026 is a runout.** GMC already sells an all-new 2027 (5.7L and 6.6L V8s, a 10-speed on every engine, no SLE or SLT), and gmc.com moved the 2026 to `/trucks/previous-year/sierra/1500`. The trims table shows "Dropped" in the 2027 column for the SLE and SLT: the renderer now prints a text price cell as text, and an empty one is still "Ask us".
- **GMC's cash is diesel-only.** $8,250, or 0% for 60 months plus $2,000, on the 3.0L Duramax; gas 2026s get lease deals. Edmunds' November tips describe a $6,250 rebate without naming the engine; gmc.com ties it to the diesel, so the page follows gmc.com.
- **Safety mixes NHTSA stars and IIHS grades.** The headline is the crew cab 4WD (4 stars overall; other cabs score 5). IIHS rates the crew cab Marginal in the small overlap front test (a 2019 Silverado test carried forward) and Acceptable in the updated side test; those two rows sit under the stars. The 2025 recall count leaves out the one NHTSA listing, a third-party wheelchair conversion.
- **6.2L V8.** Recall 25V274 (2021 to 2024 L87 engines) and NHTSA's open investigation EA26005 (2021 to 2026, including remedied engines) are why the page says to skip the 6.2L. Update the pick, the FAQ answer and the watch item when NHTSA closes the investigation or GM files a new recall.
- **Photos.** Elevation front and rear and the Denali had dealers' plate frames; the frames are blurred. The AT4X is cropped to drop another brand's auto-show sign. Metadata was stripped, because the Elevation file carried the truck's VIN.

Open items for Mason: the pick (2026 SLT crew cab, 5.3L V8; the diesel if you tow), "skip the 6.2L", "buy new, as a 2026" and the 2023 floor for used were written from the research. The discount ranges lean on TrueCar's starting market averages per trim (base configurations, destination included), iSeeCars invoice figures and a small CarWhere sample (32 deals, as of June). Not confirmed on a primary page: the military and first-responder dollar amounts (GM doesn't publish them for the Sierra), Ram's and Toyota's destination charges (so the rivals line quotes prices without destination), and the Denali Ultimate's standard engine (GMC's overview says 6.2L, its configurator lists the diesel first). Offers end November 30, 2026.

## Toyota Tacoma (added November 16, 2026)

Mason asked to "create product page for Toyota Tacoma". `toyota-tacoma-price.html` uses the same template and data shape. Differences:

- **Both model years are on toyota.com.** The 2027 Tacoma is already listed ($32,725 SR); every 2027 trim is $180 above the 2026 except the TRD Sport and TRD Off-Road (+$520). Both price lists were read on toyota.com in a browser. The 4x4, manual and i-FORCE MAX step-ups come from iSeeCars' configuration list, which matched toyota.com's base prices to the dollar.
- **It sells under sticker, unlike the RAV4.** What to pay has four groups: the SR (least room), the SR5 to TRD Off-Road (5–6% fair), the Limited and hybrids, and the Trailhunter and TRD Pro (TrueCar shows the TRD Pro at sticker). TrueCar's figures are starting market averages against starting TSRP per trim (base configurations, destination included), read in the browser; the TRD Off-Road's 2% looks low against Edmunds (7%) and owner reports (9–12%), so it stays in the 5–6% group.
- **Offers differ a lot by region and year.** The SR5 gets its own rates and $500 finance cash, New York gives gas 2026s no rate except the Limited, and only Southern California and Greater New York have 2027 offers. The TRD Pro and Trailhunter get nothing. Toyota's pages disagree on whether the $500 military and college rebates stack with the special rates (the feed says no, Greater New York's bullets say yes), so the cash-or-rate chart leaves the rebates out and the add-on tells buyers to ask.
- **Safety mixes NHTSA stars and IIHS grades,** as on the Sierra: the 2026 Double Cab is 4 stars overall (3 frontal); NHTSA has not tested the XtraCab. IIHS rates the updated moderate overlap Marginal (rear passenger), so the 2026 is not a Top Safety Pick. Recall counts are for model "TACOMA"; the "TACOMA HYBRID" listing (2024: 4, 2025: 2) is mostly the same campaigns.
- **Photos.** All five are from Wikimedia Commons (three CC0 from one photographer, two CC BY-SA). The originals were rate-limited, so Commons' 3840px renders were used. The TRD Sport rear is cropped to drop a shopping-centre sign. Sharp strips metadata on export.

Open items for Mason: the pick (2026 TRD Sport, 4x4 if you leave pavement; TRD Off-Road if you use trails), "skip the hybrid unless you want the torque or the outlet" and "buy new, as a 2026" were written from the research. The discount ranges lean on TrueCar's starting averages, Edmunds' Texas suggested prices, CarWhere's 31 verified 2026 buyers and owner forum reports. Not confirmed on a primary page: per-version towing (only the 6,500-pound maximum is Toyota's), the Colorado's price (PickupTruckTalk, not GM) and the Ranger's destination charge. Cox's October report gives no Tacoma days-of-supply figure (it is likely in Cox's downloadable data file, not fetched), so the page uses Toyota's brand figure and Edmunds' 18 days to sell. Offers end November 30, 2026.

## Toyota Corolla and GR Corolla (added November 16, 2026)

Mason asked for a Toyota Corolla product page with "a section on the GR COROLLA". `toyota-corolla-price.html` uses the same template, covering the sedan, Hybrid and Hatchback, and the GR Corolla gets its own section after "The trim we'd buy":

- **The spotlight section.** `vehicle.spotlight` is optional; when present the renderer adds a tab after "Our pick" and a section (`vp-spotlight`) with a wide photo, four figure cards (the incentives grid's markup), a trims table, a glass "what to pay" card (`pay.rows` uses the same discount wording and `example` must match a spotlight trim name) and up to three bar charts (`vp-charts--2` exists for two). Its photo is credited in the folded "Photo credits" list and counted by the outside-link test. Use it for any version buyers shop on its own (a Raptor, a TRD Pro), not for an ordinary trim.
- **Prices moved during the year.** Toyota raised every 2026 Corolla $400 since launch (two $200 steps) and the GR Corolla $600, and destination went from $1,195 to $1,295. Launch articles, U.S. News and KBB still print the old figures. toyota.com now leads with the 2027; the 2026 sedan and hybrid prices come from toyota.com/corolla/2026/, the 2026 Hatchback's ($24,580 SE, $27,575 XSE) from iSeeCars because toyota.com no longer shows it, and the FX Edition's $26,980 from Toyota's November 5 price list (iSeeCars says $27,180). The FX is left out of the trims table, since it has no 2027 price, and named in the note under it.
- **It sells under sticker, unlike the RAV4.** Cox counted 36 days of supply. What to pay has three groups: the gas LE and SE (TrueCar 5.6–7.2% under TSRP), the hybrids (2.9–4.8%) and the XSE and Hatchback (2.0–2.9%). TrueCar folds the Hybrid into the Corolla page; Edmunds and KBB blocked automated reads of their price data for the sedan, so only TrueCar, iSeeCars invoice and CarWhere's 52 buyers feed the ranges. The GR Corolla range (3–4% fair, 5–6% strong) leans on Edmunds' Texas prices and its "about $1,500 below sticker" note; TrueCar blocked the GR page.
- **ToyotaCare differs by model year:** two years or 25,000 miles on the 2026, one year or 10,000 miles on the 2027 (Toyota's August 18, 2026 release). The page uses that as a reason to buy the 2026.
- **Safety mixes NHTSA stars and IIHS grades.** The 2026 sedan and Hybrid are 5 stars overall. IIHS rates the updated moderate overlap Marginal (rear passenger) on the gas sedan only, the Hatchback's side Acceptable, and gives no Top Safety Pick. Recall counts combine NHTSA's "COROLLA", "COROLLA HYBRID" and "COROLLA HATCHBACK" listings; the API answers 400 with an empty result for a model year with none (2022).
- **Photos.** Six from Wikimedia Commons (five CC0, the LE CC BY-SA), including a second GR Corolla shot for its section, all cropped and resized to 1920 wide. The main photo is a 2024 Hybrid SE, captioned as looking the same as the 2026.

Open items for Mason: the pick (2026 Hybrid LE; XLE for heated seats; skip the Hybrid SE), "buy new, as a 2026", the skip-the-2020 line for used, and the GR take ("buy the base car with the manual") were written from the research. GR Corolla incentives were read only for the Gulf States region; Edmunds says there is no national cash. Offers end November 30, 2026.

## Tesla Model Y, used (added November 16, 2026)

Mason asked for a Tesla Model Y page "tailored towards the used options at dealers". Tesla sells new Model Ys only direct, at a set price, so there is no dealer discount on a new one. `tesla-model-y-price.html` keeps the template but is about buying used:

- **`labels` overrides the template's wording.** Any heading or fixed line the renderer prints (pay heading, trims heading, table column and captions, pick heading, the incentives and condition sections' headings and tab names, the "Can you negotiate" answer, the related links, the breadcrumb) can be replaced per vehicle; the defaults are the new-car wording, so other pages are unchanged. `pay.base` sets the word after "under" in the deal tiles ("asking" here), and `pay.walk.under` the line under the worked total. `incentives.choice` and `incentives.addons` may be left out or empty.
- **The "trims" table is model years.** Each row is a model year (2020 to 2025) with Recurrent's September 2026 average dealer asking price, what changed and the EPA range by version. The redesigned 2026 is left out because it is still scarce used and Recurrent gives no figure; the note under the table says Tesla sells it new from $39,990.
- **No published sale-to-asking figure exists** for used Model Ys, so the discount ranges (1–2% fair, 3–4% strong on 2023 to 2025; 1% and 2–3% on 2020 to 2022) are our estimate from Recurrent's 16-day median time to sell and its June-to-September price moves. Say so if they are changed.
- **The incentives section compares new from Tesla.** Tesla's site and its Current Offers page refuse automated reads, so new prices come from Electrek's November 13, 2026 read of the configurator, fees from The Weekly Driver, and the 2.49% APR from TeslaNorth (October 23, 2026). The warranty terms come from Tesla's own PDFs: the 1-year/10,000-mile used warranty applies only to cars Tesla sells, and the battery warranty transfers from any seller. The cash-or-0% block compares used loan rates by credit tier instead.
- **Figures read only through search snippets** (the sites blocked automated reads): the Edmunds 8.2 and rank, the U.S. News 8.6 and 78 reliability, and the Hardware 4 date (about May 2023, with no official cutoff; the "2024s have Hardware 4" line is inferred from build dates). Check these in a browser before pushing.
- **Photos.** Five from Wikimedia Commons, all CC BY-SA 4.0, uncropped. Commons had no usable first-generation dashboard photo, so the interior shot is the redesigned cabin, captioned as such; the redesign photo is an Australian-market car with its plates removed by the photographer.

Open items for Mason: the pick (2024 Long Range, AWD if you see snow), "buy used, a 2023 or 2024", "skip a 2020 or 2021 unless the price allows for it" and the discount estimates were written from the research. Tesla's prices and APR change without notice; recheck them at the monthly refresh, along with recall 26V507 (headlights, no fix yet) and NHTSA's door handle and suspension investigations.

## Maintenance

- **Monthly**: incentives table, the incentives tile, the offer cards (`incentives.cards`), the cash-or-0% inputs (`incentives.choice`) if the cash, rate or average loan rate changed, the worked example if the cash offer changed, `checkedOn`, `updated`, the sitemap `lastmod`, and the `next_review` dates of the `VEH-*` rows. Ford's offers page must be read at more than one ZIP; offers differ by region.
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
