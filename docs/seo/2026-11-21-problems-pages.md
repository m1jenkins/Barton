# Problems-by-year pages — November 21, 2026

Read this before editing `toyota-rav4-problems.html`, `ford-f-150-problems.html` or `honda-civic-problems.html`, or before adding another `<make>-<model>-problems.html`. It is written so a session that has only this file and the three finished car files can finish the other 18 cars.

## What the pages are

"`<car>` problems by year: years to avoid and what owners report". Each page targets "`<car>` problems", "`<car>` years to avoid", "best year used `<car>`" and "`<car>` reliability by year" (the rows written to `docs/seo-execution/query-map.csv`). It is a family of its own, separate from the price guides and the car-versus-car pages, and it links both. Mason asked for it on November 21, 2026 in the Edmunds trim-guide and buying-tips style: verdict first, a year-by-year table, a chart, the common problems by part, what owners report on Reddit, recalls and investigations, what to check before buying, "is the 2026 better?" and a FAQ.

Page order: one-paragraph answer; year-by-year table (our verdict, complaints per 100,000 sold, complaints, recalls, the reason); a chart of the rate by model year (plain HTML and CSS, values printed, bars shaded by verdict); generations and what changed; common problems by component; Reddit; recalls and investigations; what to check; the 2026; plans; FAQ; sources. The photo is the price guide's.

## How it is built

| Piece | File |
|---|---|
| One data file per car, self-contained | `data/problems-pages/<car key>.json` (key = the price guide's slug stem, e.g. `toyota-rav4`) |
| Page renderer (`--check` fails on drift) | `scripts/render-problems-pages.mjs`, `npm run build:problems`, `npm run check:problems` |
| NHTSA reader (counts and campaign ids only) | `scripts/nhtsa-problems.mjs`, `npm run nhtsa:problems -- <key> [--write]` |
| Wiring into sitemap, blog, llms.txt, inventory, query map, source registry | `scripts/wire-problems-pages.mjs`, `npm run wire:problems` |
| Test | `scripts/_tests/problems-pages.test.mjs` (part of `npm test`) |
| Verdict colors and the problem lists | `buying/problems.css` (loaded after `buying/price-guide.css`) |

The page shell comes from `render-market-pages.mjs` (so from `car-negotiation-service.html`'s head, header and footer); layout classes come from `buying/price-guide.css`. Do not edit the generated `*-problems.html` files. A car file whose `status` is `"stub"` is skipped by the renderer, the wiring script and the page tests; it holds only the NHTSA settings and counts. Setting `status` to `"ready"` publishes it.

`web-analytics.js` measures `-problems.html` pages through a pattern (added November 21, 2026; that changes the hashed `script.js` URL on every page and re-pins `austin.html` in `data/metro-release.json`, as the November 20 analytics commit did). Nothing more is needed for the other 18.

## Finishing a car (steps)

All 21 car files exist. The three finished ones are `toyota-rav4`, `ford-f-150` and `honda-civic`; read all three before starting. For each remaining car:

1. **Check the NHTSA counts.** The stub already holds `nhtsa.byYear` for 2016 to 2026, read November 21, 2026. Re-read with `node scripts/nhtsa-problems.mjs <key> --write` if it is a different day. Look at the table it prints: a year that shows 0 complaints for a car that was on sale usually means a listing name is missing (see "NHTSA quirks"). Add the missing listing to `nhtsa.listings`, then re-run with `--write`.
2. **See what NHTSA says about recalls and investigations.** `node scripts/nhtsa-problems.mjs <key> --recalls --investigations` prints each recall's id, date, component and the first 200 characters of NHTSA's summary (from the cache, never stored), and every NHTSA investigation since 2016 that names the car, open ones first. `node scripts/nhtsa-problems.mjs` does not print full summaries; to read one in full open the cached file under `~/.cache/barton-nhtsa/<make>/recalls-<listing>-<year>.json` (`Summary`, `Consequence`, `Remedy`). Read an investigation's description at `https://api.nhtsa.gov/safetyIssues/byNhtsaId?nhtsaId=<id>` (it is also its source row).
3. **Find U.S. sales by calendar year, 2016 to 2025.** Maker year-end releases first (the price guide and the comparison pages already cite several; reuse those source rows and say "reused from ..."), then Good Car Bad Car's `<car>-sales-figures` page. Put the numbers in `sales`. A nameplate whose sales include other models (Ford F-Series, Ram, Silverado) needs an estimate: copy the share method the car's comparison page uses and say so in `salesNote`. If a figure looks low or odd (the Civic's 2022), say so in the page and in the open items.
4. **Copy the published rates.** If `data/comparison-pages.json` has a "per 100,000 sold, by model year" chart for the car, copy its values for the same years into `publishedRates` (side `a` or `b`). The test fails if they differ from the fresh count over sales by more than 5%, or from any comparison page by more than 3 or 5%. Years the comparison pages don't cover (2016 to 2018) use the fresh rate.
5. **Set the verdicts** with the rule below and write a one-line reason for every model year.
6. **Write the copy** with the writing pattern below: `answer`, `generations`, `problems`, `notableRecalls`, `investigations` (or `noInvestigations`), `checks`, `newer`, `faq`, `reddit.paragraphs`, `card`, `title`, `description`, `h1`.
7. **List the sources** with ids `VEH-PRB-<CODE>-01`, `-02`, ... in order. `<CODE>` is the car's short code (`RAV4`, `F150`, `CIVIC`; use the code the price guide uses where there is one).
8. **Build and wire:** `npm run build:problems && npm run wire:problems`.
9. **Check:** `node scripts/validate-site.mjs`, `npm run check:vehicles`, `npm run check:problems`, `npm test`. All must pass.
10. **Add a section to "Open items for Mason" below** with the car's verdict table and every judgment call, then commit.

Set `status` to `"ready"` and add the copy fields; keep the `nhtsa` block exactly as the script wrote it.

## Data shape (a ready car file)

```
key, name, status ("stub" | "ready")
short                  "RAV4"          used in sentences
make                   "Toyota"        used in "a Toyota dealer"
newerYear              "2026"
published, checkedOn   "2026-11-21"    visible date and Article.dateModified are checkedOn
title, description, h1
card                   one line for blog.html
llms                   optional, one line for llms.txt (defaults to card)
queries                optional list of target searches (defaults to four)
bestYears, avoidYears  strings shown in the glance panel, e.g. "2022–2025"
answer                 [paragraph, paragraph]; the first is the lead
salesNote              one sentence naming where sales come from
sales                  {"2016": units, ... "2025": units}
salesShare, salesRaw   only when an estimate is used (the F-150's 59% of F-Series)
publishedRates         {"2019": 203, ...} from the comparison pages
verdicts               {"2016": ["check", "reason", "override note?"], ... "2026": [...]}
chartNote              optional sentence under the chart
generations            [{name, years, text}]
problems               [{title, component, years: [from, to], text}]
reddit.paragraphs      [our reading of the Reddit themes]
recallsIntro           optional; default is a sentence with the campaign count
notableRecalls         [{id, years, title, text}]
investigations         [{id, status, years, title, text}]  or []
noInvestigations       sentence used when the list is empty
checks                 [{title, text}]  the VIN lookup item is added for you
newer                  [sentence pair]
faq                    [[question, answer]]
sources                [{id, title, url, scope, note}]
nhtsa                  written by scripts/nhtsa-problems.mjs (see below)
```

`nhtsa` holds `make`, `years`, `listings` (the names NHTSA files complaints under), `models` (product-model prefixes a record must start with), `exclude` (a regular expression for names to drop, such as `LIGHTNING`), `recallModels`, `investigationTerms`, `readOn`, and `byYear[year] = {complaints, crashes, fires, components: {PART: n}, recalls: [ids]}`. Raw complaint text never enters the repository; the cache is `~/.cache/barton-nhtsa` (or `$BARTON_NHTSA_CACHE`).

**Live figures in copy.** Write figures as tokens so prose cannot drift from the counts: `{c:2019}` complaints, `{r:2019}` rate per 100,000, `{rec:2019}` recalls, `{k:2019:ENGINE}` complaints naming a part, `{pool:2023-2025}` pooled rate, `{pc:2023-2025}` pooled complaints, `{base}` the yardstick, `{guide}` the price guide's URL. Part names are NHTSA's upper-case labels after grouping (see below). A token the page cannot resolve fails the build.

## NHTSA method

Matches section E of `docs/seo/handoff-ford-vs-sierra-2026-11-19/briefs/research.md`.

- Complaints: `complaintsByVehicle?make=&model=&modelYear=` for every listing in `nhtsa.listings` and every model year 2016 to 2026. A record counts when it has a Vehicle product whose `productYear` is the requested year and whose `productModel` starts with one of `nhtsa.models` and does not match `nhtsa.exclude`. Deduplicated by `odiNumber` across listings (so "RAV4", "RAV4 HYBRID", "RAV4 PRIME" and "RAV4 PLUG-IN HYBRID" are one set). F-150 excludes Lightning.
- Parts: a complaint can name several parts; it counts once under each. Names are grouped per complaint so one complaint is not counted twice for near-duplicates: `ENGINE AND ENGINE COOLING` into `ENGINE`; `FUEL SYSTEM`, `GASOLINE`, `DIESEL` and `HYBRID PROPULSION SYSTEM` into `FUEL/PROPULSION SYSTEM`; `VISIBILITY/WIPER` into `VISIBILITY`; `HYDRAULIC` into `SERVICE BRAKES`. Child-seat part names that are not all capitals are dropped.
- Recalls: `recallsByVehicle` for each name in `nhtsa.recallModels`, deduplicated by campaign number (stored as `22V-519`). `nhtsa.recallExcludeManufacturers` drops third-party conversions (the Sierra's Rollx Vans wheelchair conversion).
- Investigations: NHTSA's list cannot be filtered by vehicle, so the script reads every page and matches `investigationTerms` in the subject and description. Read each hit before using it; a match can be about another model (the Civic's EA25005 names a 2009 Civic in a paragraph about counterfeit air bag inflators and is not a Civic investigation).
- Rates: complaints for model year Y over U.S. sales in calendar year Y, times 100,000. Model years and calendar years do not line up; the page says so.

### NHTSA quirks found building the 21 files

- Node's default `fetch` user agent gets HTTP 403 from `api.nhtsa.gov`; the script sends its own. `curl` works.
- A name and year with no listing returns HTTP 400. The script treats it as zero.
- NHTSA files the same records under several names. F-150 uses `F-150`, `F-150 SUPER CREW`, `F-150 (SUPER CREW) GAS`, `F-150 SUPER CREW HEV` and `F-150 (SUPER CREW) HEV` by year; aliases for cab styles return the same records, which deduplication handles. `F-150 SUPER CREW HEV` and `F-150 (SUPER CREW) HEV` differ only by parentheses, so the cache gives names with parentheses or doubled spaces their own file names.
- Ranger: 2021 and 2022 answer to `RANGER SUPER CREW`, 2023 and later to `RANGER (SUPER CREW)`; plain `RANGER` works for 2019 and 2020. Tesla Model Y 2021 on uses `MODEL Y  5-SEAT` (two spaces) and `MODEL Y 7-SEAT`, 2024 `MODEL Y (All Variants)`; Model 3 2025 uses `MODEL 3 (ALL VARIANTS)`. Ram 2022 on uses `1500 CREW CAB` and `RAM 1500 CREW CAB`; its product model stays `1500`.
- The `products/vehicle/models` listing endpoint is truncated after about 16 names and cannot be used to discover listings. Probe candidate names with `complaintsByVehicle` instead.
- Toyota's 2026 Camry, Corolla, Tacoma and Tundra returned no complaints on November 21, 2026 (the API answers with a count of 0).
- Still to confirm by the finishing session: the Sierra's 2016 count (54) looks thin against 2017's 433 and the Ranger has 1 and 1 complaints for 2016 and 2017 when it was not sold in the U.S.; neither listing name was found. The Sierra file's `exclude` drops 2500, 3500, HD and EV names and keeps `SIERRA DENALI` records, which may be 1500 or HD; the F-150 versus Sierra research left them out, so decide and note it.

## Judgment rules for Buy, Check first and Avoid

Mason's call, from the numbers. The rule gives a starting verdict; a session may move a year one step and must say why in the entry's third element (`"avoid to check: why"`), which the test requires. List every override in the open items.

1. **Yardstick.** The median of the car's 2019 to 2025 rates, using `publishedRates` where present. It is printed on the page.
2. **Buy:** rate at or under 1.25 times the yardstick.
3. **Check first:** over 1.25 and up to 2 times the yardstick.
4. **Avoid:** over 2 times the yardstick.
5. **Overrides (one step only).** Down a step when a free recall explains most of a spike and a VIN lookup shows whether it was done (RAV4 2021 air bags, Civic 2022 steering). Up a step when an open NHTSA investigation or recall query covers the year, or one part carries over 40% of the complaints with no completed recall (F-150 2020). Name the recall or investigation and its number in the reason.
6. **2016 to 2018** use the fresh rate (no comparison page covers them). **2026** has no full year of sales and no rate: give it Buy or Check first on recalls and early complaints only, and say it is too new to rate.
7. **Doubtful sales figures.** If the denominator looks wrong, judge on the counts and the parts named too, and say so on the page (the Civic's 2022).
8. **Best used years** are the Buy years from the newest ones back to the first Check first; a Buy year sandwiched between worse years can still be listed ("2020–2021, 2024–2025"). **Years to avoid** are the Avoid years, after overrides.
9. Compare the verdicts with the price guide's `condition` take on used years (for example "make 2023 the floor") and the guide's `watch` list; where they disagree, say so in the open items. Do not edit the price guide.

## Writing pattern

Load the `edmunds-style` skill before drafting and the `unslop` skill after (balanced pass, numbers untouched). The finished three are the model.

- **Verdict first.** The lead names the best years with their rates, the years to skip with their rates and the reason, the years in between, and what the rates are (one clause). Second paragraph: how the rates were made, the denominator's weakness if any, the 2026 in one clause, and a link to the price guide.
- **Every number against a yardstick or a named year.** "{r:2019} against {r:2022} for the 2022", never a bare rate.
- **Name the recall.** Give the campaign number, what it covers in plain words, that the fix is free, and what to ask for. Use NHTSA's summary for the description; do not copy it.
- **Complaints are owner reports, not defects.** A part count names a part, not a cause. Say so when you cannot explain a count.
- **Reddit is "what owners report".** Paraphrase the themes in `data/reddit-sentiment/cars/<key>.json`; never quote or name users; say the Reddit files cover January 2025 onward (the renderer says it). The renderer pulls the topic figures itself.
- **Nobody here has driven these cars.** No "feels", "rides" or "we found". Impressions are attributed to a named publication or to what owners report. Opinions and picks are ours ("we'd buy", "we'd keep looking").
- **No "X, not Y" disclaimers, no caveat tacked on a paragraph, no stacked hedges, no tricolons, no brochure words.** One "not a promise" in the sources note ("The verdicts are our judgment from these figures, not a promise about any one car", a test checks it).
- **No tax, title or registration advice. No dealer names. Never "brief" or "broker".** Steer Me Right statements are the plan cards and the lines the renderer adds ("Dealers and lenders pay us nothing.", "Full refund if you cancel before negotiations begin.", "We can’t promise a specific discount"); do not write others.
- **Generations** come from the maker or a named publication with the source in the sentence ("(Wikipedia)"); if only a secondary page was read, the source note says "check against <maker> before relying on a detail".
- **What to check** is specific to the car's known issues (recall numbers, the part, how to confirm), plus the VIN lookup the renderer adds and an independent inspection. No tax or title advice.
- **The 2026 paragraph is two sentences** and links the price guide.

## Sources

Every outside link on a page is in that page's `sources` and has a row in `data/source-registry.csv` (`npm run wire:problems` writes the rows: `article_url` is the page, `next_review` December 21, 2026, status `secondary_research_checked`). The test checks it. Ids `VEH-PRB-<CODE>-NN`, sequential. The first two sources of every page are the NHTSA complaints API (use one real request URL as the link) and `https://www.nhtsa.gov/recalls` (the VIN lookup the page links). Add one source per investigation cited (`https://api.nhtsa.gov/safetyIssues/byNhtsaId?nhtsaId=<id>`), per sales release, per generation page and per outside article. Reusing a price guide's or comparison page's source: keep its URL and say "from the <car> price guide" or "reused from <page> (VEH-...)" in the note. If you read a figure only in a search snippet or a page summary, the note says so. Never invent a figure; no MarketCheck or listings figures.

## Monthly maintenance

NHTSA counts grow as owners file and as new recalls land. Each month (with the price guides' refresh):

1. `npm run nhtsa:problems -- --all --write` (or `node scripts/nhtsa-problems.mjs --all --write`), about 30 minutes uncached; add `--refresh` to ignore the cache.
2. Re-read the verdict tables the build prints; if a rate moves a year across a threshold, change its verdict and reason. The test fails when a published comparison rate and the fresh rate drift apart by more than the tolerance.
3. Update the 2026 (and a 2027 model year when it has complaints) text, recall lists and investigations; the `nhtsa.years` range stays 2016 to 2026 until Mason widens it.
4. Bump `checkedOn` on changed pages, `npm run build:problems && npm run wire:problems`, run the checks, run `npm run indexnow` after deploying.
5. Reread the open items below.

## Decisions and rules from the build

- The family is separate from the price guides. The price guide's "Safety" and "New, used or CPO" sections stay as they are; the coordinator links the problems pages from them.
- The Reddit sections are built at render time from each car's coded file, so the figures cannot drift. Those files cover January 2025 onward.
- The verdict marks use sign blue (Buy), mid gray (Check first) and ink (Avoid), with the word always printed, so color is never the only signal.
- The renderer reuses the price guide's photo and credits. No new images.

## Open items for Mason

Every verdict below is from the rule above; the override column is where a judgment moved it. Read the picks, the overrides and the weak figures.

**Ford F-150** (yardstick 122 per 100,000; Buy up to 153, Check first up to 244, Avoid above that). Best used: 2023–2025. Avoid: 2016, 2018, 2021.

| Model year | Our verdict | Per 100,000 | Complaints | Recalls | Override |
|---|---|---|---|---|---|
| 2016 | Avoid | 375 | 1,818 | 14 |  |
| 2017 | Check first | 220 | 1,162 | 18 |  |
| 2018 | Avoid | 363 | 1,945 | 19 |  |
| 2019 | Check first | 194 | 1,031 | 9 |  |
| 2020 | Check first | 122 | 569 | 11 | buy to check: 44% of complaints name the power train, and RQ21002 is open |
| 2021 | Avoid | 311 | 1,332 | 29 |  |
| 2022 | Check first | 214 | 830 | 23 |  |
| 2023 | Buy | 117 | 529 | 13 |  |
| 2024 | Buy | 53 | 239 | 11 |  |
| 2025 | Buy | 27 | 131 | 16 |  |
| 2026 | Check first | n/a | 24 | 8 |  |

**Honda Civic** (yardstick 94 per 100,000; Buy up to 118, Check first up to 188, Avoid above that). Best used: 2020–2021, 2024–2025. Avoid: 2016.

| Model year | Our verdict | Per 100,000 | Complaints | Recalls | Override |
|---|---|---|---|---|---|
| 2016 | Avoid | 295 | 1,084 | 5 |  |
| 2017 | Check first | 162 | 613 | 6 |  |
| 2018 | Check first | 185 | 602 | 6 |  |
| 2019 | Check first | 142 | 464 | 4 |  |
| 2020 | Buy | 94 | 246 | 5 |  |
| 2021 | Buy | 62 | 164 | 4 |  |
| 2022 | Check first | 719 | 963 | 4 | avoid to check: the complaint spike traces to a free recall a dealer can confirm |
| 2023 | Check first | 170 | 343 | 4 |  |
| 2024 | Buy | 60 | 146 | 3 |  |
| 2025 | Buy | 45 | 108 | 2 |  |
| 2026 | Buy | n/a | 34 | 1 |  |

**Toyota RAV4** (yardstick 55 per 100,000; Buy up to 69, Check first up to 110, Avoid above that). Best used: 2022–2025. Avoid: 2019–2020.

| Model year | Our verdict | Per 100,000 | Complaints | Recalls | Override |
|---|---|---|---|---|---|
| 2016 | Check first | 73 | 257 | 3 |  |
| 2017 | Check first | 79 | 324 | 3 |  |
| 2018 | Check first | 81 | 348 | 3 |  |
| 2019 | Avoid | 203 | 913 | 8 |  |
| 2020 | Avoid | 152 | 659 | 6 |  |
| 2021 | Check first | 125 | 513 | 5 | avoid to check: the complaint spike traces to recalls a VIN lookup confirms |
| 2022 | Buy | 45 | 179 | 3 |  |
| 2023 | Buy | 55 | 248 | 3 |  |
| 2024 | Buy | 44 | 208 | 4 |  |
| 2025 | Buy | 21 | 103 | 4 |  |
| 2026 | Check first | n/a | 56 | 2 |  |

Judgment calls and weak figures:

1. **Read every verdict and override.** The three overrides: RAV4 2021 (Avoid to Check first: 147 of 513 complaints name air bags and two free recalls cover them), Civic 2022 (Avoid to Check first: 806 of 963 complaints name steering; Honda recalled the gearbox, 24V-744, and NHTSA closed EA23003), F-150 2020 (Buy to Check first: 248 of 569 complaints name the power train and NHTSA's recall query RQ21002 is open). The 2026 rows are Buy or Check first on recalls and early complaints alone.
2. **The F-150 rates rest on our estimate** of 59% of F-Series sales (Ford publishes no F-150 total), the share our F-150 comparison pages use; a quarter's production share was the only check. The 2016 to 2018 rates use Good Car Bad Car's F-Series totals read through a page summary.
3. **The Civic's 2022 rate (719) rests on 133,932 sales,** which looks low next to 2023's 200,381 (read through Good Car Bad Car's table and a search snippet). Without a better figure the page leans on the count (963, the highest of any year).
4. **The price guides' used-year floors differ slightly from the pages.** The RAV4 guide says make 2023 the floor; the page lists 2022 to 2025 (2022's rate, 45, is lower than 2023's, 55). The F-150 guide's 2023 floor and the page's 2023 to 2025 agree. The Civic guide says look at a 2023 to 2025; the page calls the 2023 Check first and lists 2020 to 2021 and 2024 to 2025 as best.
5. **Generations are from Wikipedia** (read through page summaries on November 21, 2026) plus the price guides' Toyota page for the 2026 RAV4. Check the details against the makers before leaning on them, especially the RAV4's hybrid and Prime dates and the Civic hatchback and hybrid years.
6. **Sales for 2024 and 2025 RAV4** come from Toyota's release read through a page summary; the release lists Hybrid and Plug-in rows separately and we could not confirm the RAV4 row includes them (same caveat as the comparison pages).
7. **Open NHTSA items quoted:** F-150 EA26001 (open since January 31, 2026) and RQ21002 (open since August 2021). Update when NHTSA changes their status; the RAV4 has no open investigation on NHTSA's list as of November 21, 2026 (PE21005, closed in 2024).
8. **Stubs still to finish (18):** Chevrolet Colorado, Chevrolet Silverado 1500, Ford Ranger, GMC Sierra 1500, Honda Accord, Honda CR-V, Hyundai Elantra, Hyundai Tucson, Kia Sportage, Mazda CX-5, Ram 1500, Subaru Forester, Tesla Model 3, Tesla Model Y, Toyota Camry, Toyota Corolla, Toyota Tacoma, Toyota Tundra. Their NHTSA counts and recall ids are already in the files (see the quirks list for the ones whose listing names need a second look). The Tesla, Ranger and Ram files already carry the extra listing names from the quirks above; the Ram file includes the 2019 to 2024 Classic (old-body) trucks, which may or may not belong on a Ram 1500 page.
9. **Photos and CSS.** The pages reuse each price guide's photo; `buying/problems.css` is new (verdict marks, rate columns, problem lists). The coordinator links the problems pages from the price guides and comparison pages.

### Override rule added while finishing the other 18 cars (November 22, 2026)

Besides a free recall explaining most of a year's complaints, a year may move up one step when an open NHTSA investigation names it and that part is the year's top complaint part, with at least 100 complaints and 40% or more of the year's total (used for the GM trucks under EA25007 and the 2022 Ram under PE24018). A year may also move up when one uncovered part carries half or more of its complaints (Colorado 2017; Tucson 2018–2019; CX-5 2021), when a recall without a remedy reaches it (Tundra 2025, 26V-750), or when NHTSA's count looks incomplete (Sierra 2016). Every such year says so in its reason. Mason should confirm or narrow this rule.

`firstSold` (Model 3 2017, Model Y 2020, Ranger 2019) starts a car's table, chart and checks at its first U.S. sales year; the test's sales floor is 10,000 a year after the first.

### honda-cr-v
**Honda CR-V** (yardstick 136 per 100,000; Buy up to 170, Check first up to 272, Avoid above that). Best used: 2024–2025. Avoid: 2017–2019.

| Model year | Our verdict | Per 100,000 | Complaints | Recalls | Override |
|---|---|---|---|---|---|
| 2016 | Buy | 111 | 396 | 3 |  |
| 2017 | Avoid | 473 | 1,787 | 7 |  |
| 2018 | Avoid | 573 | 2,172 | 5 |  |
| 2019 | Avoid | 290 | 1,113 | 8 |  |
| 2020 | Check first | 136 | 454 | 9 | buy to check: NHTSA’s analysis EA24002 into inadvertent braking is still open on 2017 to 2022 CR-Vs, and PE25016 covers 2020 to 2022 Hybrids |
| 2021 | Check first | 125 | 452 | 5 | buy to check: NHTSA’s analysis EA24002 into inadvertent braking is still open on 2017 to 2022 CR-Vs, and PE25016 covers 2020 to 2022 Hybrids |
| 2022 | Check first | 149 | 356 | 6 | buy to check: NHTSA’s analysis EA24002 into inadvertent braking is still open on 2017 to 2022 CR-Vs, and PE25016 covers 2020 to 2022 Hybrids |
| 2023 | Check first | 176 | 637 | 8 |  |
| 2024 | Buy | 121 | 491 | 5 |  |
| 2025 | Buy | 75 | 308 | 5 |  |
| 2026 | Check first | n/a | 199 | 2 |  |

Judgment calls and weak figures:

1. **The three overrides (2020, 2021, 2022: Buy to Check first).** Rule 5, up a step when an open NHTSA investigation covers the year: EA24002 (open, opened April 16, 2024) covers 2017–2022 CR-Vs; PE25016 (open, October 29, 2025) covers 2020–2022 Hybrids. Without them 2020–2022 would be best years; the price guide's "make 2023 the floor" advice would then disagree more. Read EA24002's description: it is about inadvertent emergency braking; the 2020–2022 braking counts (89, 111, 57) are 20 to 25% of those years' complaints, so the override rests on the open investigation, not the counts.
2. **The guide's floor disagrees.** The price guide says buy 2023 or newer. The page rates 2023 Check first (steering 398 of 637, recall 24V-744) and calls 2024–2025 the best years, so it is stricter than the guide on 2023 and agrees on the cutoff.
3. **2016 rates Buy (111) and is not listed as best.** The rate is low (396 complaints), but it is the oldest year and a different generation; the answer paragraph mentions it. Decide if bestYears should read "2024–2025, 2016".
4. **Yardstick 136 is high** because 2017–2019 are not in it (it uses 2019–2025) but 2019 (290), 2023 (176) are. A low yardstick would flip 2020–2022 to Check first by rule alone.
5. **Sales.** 2016–2018 come from Good Car Bad Car's table read through a page summary (357,335, 377,895, 379,013); 2019–2025 reproduce the rates on our comparison pages (Honda FactBook). The page does not say in words that totals include the hybrid. 2022 (238,155) is low and lifts the 2022 rate.
6. **Hand-read text tallies.** "Most engine complaints on the 2017 and 2018 mention oil or a fuel smell" comes from a keyword count in the cached NHTSA text (338 of 543 and 358 of 545 mention oil), not stored in the repo; the CarComplaints oil dilution story is the published source.
7. **Generation text** from Wikipedia through a page summary that did not reach the engine tables; says only what it printed (fifth generation Hybrid arrived with the 2020 update). Check against Honda.
8. **The 2026 is Check first** because 26V-663 (October 9, 2026) reissued the tire repair kit recall 26V-366 for cars already fixed; both cover only Hybrids. Weak: could equally be Buy.

### mazda-cx-5
**Mazda CX-5** (yardstick 46 per 100,000; Buy up to 57, Check first up to 92, Avoid above that). Best used: 2022–2025. Avoid: 2016, 2017, 2019, 2021.

| Model year | Our verdict | Per 100,000 | Complaints | Recalls | Override |
|---|---|---|---|---|---|
| 2016 | Avoid | 456 | 512 | 5 |  |
| 2017 | Avoid | 118 | 150 | 1 |  |
| 2018 | Check first | 84 | 126 | 3 |  |
| 2019 | Avoid | 179 | 277 | 2 |  |
| 2020 | Check first | 75 | 110 | 0 |  |
| 2021 | Avoid | 90 | 152 | 0 | check to avoid: the engine carries 55% of the complaints with no recall to explain them |
| 2022 | Buy | 46 | 70 | 0 |  |
| 2023 | Buy | 44 | 67 | 0 |  |
| 2024 | Buy | 35 | 47 | 0 |  |
| 2025 | Buy | 21 | 29 | 0 |  |
| 2026 | Check first | n/a | 22 | 0 |  |

Judgment calls and weak figures:

1. **One override (2021: Check first to Avoid).** The rate (90) is two points under the Avoid line (92); the engine is 84 of 152 complaints (55%), 68 of those mention oil in the text we read, and NHTSA lists no recall for the 2021. The rule allows one step up when one part carries over 40% with no recall. Without it 2021 would be Check first.
2. **Yardstick 46** (median of 179, 75, 90, 46, 44, 35, 21). The two comparison pages print different 2021 and 2022 rates (89 and 44 on the RAV4 page, 90 and 46 on the CR-V page); I copied the CR-V page's, which is the later one, and both are inside the test tolerance. With 89 and 44 the yardstick is 44 and 2021 would be Avoid by rule without an override.
3. **The 2018 stays Check first** (rate 84, line 92). Its engine count is 105 of 126 (83%) but recall 19V-497 covers engine stalling on 2018–2019 CX-5s, so I did not apply the 40% rule. Decide if it should be Avoid.
4. **2016 is Avoid** at 456 but 161 of 512 complaints are lighting (recall 20V-063, free); without those it is still 313.
5. **Small counts.** No year has more than 512 complaints and 2022–2026 have 70 or fewer, so one part moves a rate a lot.
6. **Sales.** 2019–2025 come from Mazda's releases (2021: 168,383 from release text; Good Car Bad Car prints 163,940). 2016–2018 from Good Car Bad Car alone (112,235, 127,563, 150,622).
7. **Hand-read text tallies:** oil in 86 of 105 (2018), 92 of 137 (2019), 68 of 84 (2021) engine complaints; "cylinder deactivation" in 91, 97 of the first two. Not stored.
8. **Guide agreement.** Guide: a 2022–2025 is safer than a 2019 or 2021; the page agrees, and adds 2016, 2017 as Avoid and 2018, 2020 Check first. No guide statement contradicts it.
9. **Generation text** from Wikipedia through a page summary that stopped at 100,000 characters; the page calls the third generation KM, not KH. The 2022 facelift year is not stated there.
10. **The 2026 is Check first** because it is a redesign with 22 complaints; no recall, so it could be Buy.

### subaru-forester
**Subaru Forester** (yardstick 89 per 100,000; Buy up to 111, Check first up to 178, Avoid above that). Best used: 2022–2025. Avoid: 2016–2020.

| Model year | Our verdict | Per 100,000 | Complaints | Recalls | Override |
|---|---|---|---|---|---|
| 2016 | Avoid | 233 | 417 | 3 |  |
| 2017 | Avoid | 336 | 596 | 1 |  |
| 2018 | Avoid | 291 | 500 | 3 |  |
| 2019 | Avoid | 463 | 836 | 3 |  |
| 2020 | Avoid | 341 | 605 | 0 |  |
| 2021 | Check first | 139 | 215 | 0 |  |
| 2022 | Buy | 89 | 101 | 1 |  |
| 2023 | Buy | 51 | 77 | 1 |  |
| 2024 | Buy | 18 | 33 | 2 |  |
| 2025 | Buy | 59 | 105 | 3 |  |
| 2026 | Check first | n/a | 37 | 4 |  |

Judgment calls and weak figures:

1. **No overrides.** Every verdict follows the rule. Avoid: 2016–2020; Check first 2021; Buy 2022–2025; 2026 Check first.
2. **The 2019 and 2020 spike is windshields.** 374 of 406 visibility complaints on the 2019 and 274 of 301 on the 2020 mention cracking, from a keyword count in cached NHTSA text (not stored). No recall covers it. Avoid here is a cost and annoyance verdict as much as a safety one; Mason may want it softened to Check first (a one-step override is allowed only for a free recall or an open investigation, which does not apply).
3. **Air bag sensor, 2016–2018.** PE19009 closed January 22, 2020 after Subaru's recall 19V-701 (366,282 cars, 2015–2018 with seat heaters). The air bag complaints (101, 167, 100) are 20 to 28% of those years, so I did not move the verdicts down.
4. **Yardstick 89** equals the 2022 rate, so 2022 is Buy by the width of a rounding step; its rate is lifted by low sales (114,096).
5. **Sales.** 2019–2025 from Subaru's releases (same figures as the comparison pages); 2016–2018 from Good Car Bad Car alone (178,593, 177,563, 171,613). Subaru reports gas and Hybrid together.
6. **Guide agreement.** Guide: look at 2023 or 2024, skip 2019 and 2020. Page agrees and also lists 2022 and 2025 as Buy.
7. **2025 is Buy at 59** with 105 complaints and three recalls, a redesign year; flag if Mason wants it Check first.
8. **Generation text** from Wikipedia; the page summary stopped before the sixth generation (the 2025 redesign is described only from our price guide).
9. **2026 Check first** because of 26V-685 (do not drive until fixed, filed October 19, 2026) and four recalls.

### hyundai-tucson
**Hyundai Tucson** (yardstick 146 per 100,000; Buy up to 182, Check first up to 292, Avoid above that). Best used: 2020–2021, 2023–2024. Avoid: 2016–2019, 2022.

| Model year | Our verdict | Per 100,000 | Complaints | Recalls | Override |
|---|---|---|---|---|---|
| 2016 | Avoid | 1812 | 1,626 | 5 |  |
| 2017 | Avoid | 956 | 1,097 | 3 |  |
| 2018 | Avoid | 259 | 399 | 1 | check to avoid: the engine carries 62% of the complaints, with no recall to explain them, and the 2016 and 2017 engines show the same pattern |
| 2019 | Avoid | 282 | 387 | 1 | check to avoid: the engine carries 53% of the complaints, with no engine recall to explain them, and the rate is within ten points of the line |
| 2020 | Buy | 146 | 180 | 1 |  |
| 2021 | Buy | 56 | 85 | 1 |  |
| 2022 | Avoid | 293 | 513 | 3 |  |
| 2023 | Buy | 86 | 184 | 2 |  |
| 2024 | Buy | 77 | 159 | 4 |  |
| 2025 | Check first | 197 | 461 | 7 |  |
| 2026 | Check first | n/a | 106 | 6 |  |

Judgment calls and weak figures:

1. **Two overrides: 2018 and 2019, Check first to Avoid.** The engine carries 249 of 399 (62%) and 205 of 387 (53%) complaints, mostly oil and knocking in the text we read, and no engine recall covers either year (21V-727 covers the 2017 only). Rates are 259 and 282; the Avoid line is 292. Without them 2018–2019 are Check first and the avoid list is 2016, 2017, 2022. They also match the price guide's "skip 2019 to 2021" warning in part.
2. **The 2022 is Avoid by one point (293 against 292).** The Hybrid and Plug-in Hybrid listings add complaints (117 and 7 in NHTSA's per-listing counts before deduplication) but Hyundai's sales row may not include hybrids, which would overstate the rate. Without the hybrid listings the count drops and the year could be Check first. No recall or investigation explains it, so no override; the page says the rate may be overstated.
3. **The 2020 and 2021 are Buy** (146, 56) though the price guide says skip 2019–2021 unless recall 20V-543 is done. The page keeps the rule's verdict, tells readers to confirm 20V-543 and notes the 2020's engine share is 42%. Decide whether to move the 2020 to Check first.
4. **Rates.** I added the TUCSON PHEV listing (11 complaints in 2023, 3 in 2024), which the RAV4 vs Tucson page already counted; fresh 2023 is now 88 and 2024 is 77. publishedRates use 86 and 77, inside tolerance of both comparison pages (83/88 and 76/77). Yardstick 146 is high because 2019, 2022 and 2025 are in it.
5. **Sales.** 2019–2025 from Hyundai's releases (read through summaries) and Good Car Bad Car; 2016–2018 from Good Car Bad Car alone (89,713, 114,735, 153,792). The 2016 rate (1,812) rests on the smallest denominator in the table.
6. **Hand-read text tallies (not stored):** engine complaints mentioning oil (200 of 430 in 2016, 321 of 619 in 2017); transmission mentioned in 271 of 518 2016 power train complaints; fuel injectors named in 103 of 137 2022 fuel complaints; "rear" in 138 of 227 2016 structure complaints.
7. **2025 Check first** (197): braking complaints are 222 of 461; recall 26V-316 covers them. Without braking the rate is about 102. The rule gives Check first with no override.
8. **Generation text** from Wikipedia through a page summary that cut off before the North American fourth generation; the 2022 hybrid start is inferred from NHTSA's listings.
9. **2026 Check first** (six recalls including an engine replacement).

### kia-sportage
**Kia Sportage** (yardstick 69 per 100,000; Buy up to 86, Check first up to 138, Avoid above that). Best used: 2021–2022, 2024–2025. Avoid: 2016–2018, 2020, 2023.

| Model year | Our verdict | Per 100,000 | Complaints | Recalls | Override |
|---|---|---|---|---|---|
| 2016 | Avoid | 167 | 135 | 2 |  |
| 2017 | Avoid | 555 | 404 | 4 |  |
| 2018 | Avoid | 200 | 166 | 3 |  |
| 2019 | Check first | 82 | 73 | 2 | buy to check: the engine carries 56% of the complaints with no recall to explain them, and the rate is four points under the line |
| 2020 | Avoid | 206 | 174 | 2 |  |
| 2021 | Buy | 61 | 54 | 2 |  |
| 2022 | Buy | 38 | 47 | 1 |  |
| 2023 | Avoid | 151 | 212 | 7 |  |
| 2024 | Buy | 69 | 112 | 3 |  |
| 2025 | Buy | 42 | 77 | 1 |  |
| 2026 | Buy | n/a | 48 | 1 |  |

Judgment calls and weak figures:

1. **One override: 2019, Buy to Check first.** Rate 82 is four under the Buy line (86); the engine is 41 of 73 (56%) with no recall; the neighboring 2016–2018 and 2020 engines are all Avoid. Without it the 2019 is a best year.
2. **The 2023 count is 212, matching the comparison page.** The first stub omitted the SPORTAGE PHEV listing (16 complaints in 2023, 2 in 2026); I added it to nhtsa.listings and recallModels and re-ran the reader. 2023 now rates 151 (Avoid), and 2026 has 48 complaints.
3. **Yardstick 69** is low because 2021, 2022, 2024, 2025 are low; most older years are Avoid.
4. **Sales.** Good Car Bad Car's table for all ten years, read through a page summary; 2024 and 2025 match Kia as reported by Best Selling Cars. 2016–2023 rest on the table alone. The page doesn't say if hybrids and plug-ins are included.
5. **Guide agreement.** Guide: look at 2024 or 2025, be wary of 2020 or 2023. Page agrees and adds 2016–2018 as Avoid and 2021–2022 as Buy.
6. **Hand-read text tallies (not stored):** oil in 54 of 91 2020 engine complaints, 97 of 230 in 2017; screen in 19 of 46 2023 electrical complaints.
7. **Recall counts.** Seven 2023 recalls, as the guide says (the PHEV listing adds one).
8. **Generation text** from Wikipedia through a page summary; 2026 is the facelift the page dates to May 2025.
9. **2026 Buy** on 46 complaints and one over-the-air recall.

### toyota-camry
**Toyota Camry** (yardstick 53 per 100,000; Buy up to 66.3, Check first up to 106, Avoid above that). Best used: 2016–2017, 2021–2025. Avoid: 2018–2019.

| Model year | Our verdict | Per 100,000 | Complaints | Recalls | Override |
|---|---|---|---|---|---|
| 2016 | Buy | 49 | 189 | 3 |  |
| 2017 | Buy | 40 | 153 | 3 |  |
| 2018 | Avoid | 230 | 789 | 8 |  |
| 2019 | Avoid | 124 | 420 | 7 |  |
| 2020 | Check first | 98 | 287 | 3 |  |
| 2021 | Buy | 53 | 166 | 1 |  |
| 2022 | Buy | 23 | 70 | 1 |  |
| 2023 | Buy | 24 | 69 | 2 |  |
| 2024 | Buy | 17 | 53 | 1 |  |
| 2025 | Buy | 57 | 181 | 6 |  |
| 2026 | Buy | n/a | 0 | 3 |  |

Judgment calls and weak figures:

1. No overrides. Every year follows the rule. Read the picks: 2016 and 2017 rate Buy (49 and 40) and are listed with 2021 to 2025 as best years even though they are sandwiched under the Avoid years 2018 and 2019.
2. The Camry price guide says skip the 2019 and 2020 and look at a 2022 to 2024 gas car or a 2025 hybrid. The page rates the 2020 Check first (98, under the 106 Avoid line) and lists 2021 to 2025 as best, so it is a little more generous than the guide on 2020 and 2021.
3. 2021: 86 of 166 complaints (52%) name air bags, but recall 23V-865 covers the passenger occupant sensor, so no up-step; the rule's 40% test needs 'no completed recall'.
4. 2025 (57, Buy) carries six recalls including inverter recall 25V-869 (power loss or fire risk) and 26V-511. Left at Buy because the rate is at the yardstick; a stricter reading would make it Check first. The 'about 27 bumper covers, 21 windshields' split is copied from the Camry price guide's reading of complaint text, not recounted.
5. Sales: Good Car Bad Car's Camry table, read through a page summary; 2019 to 2025 give the same rates as the Camry vs Accord page (Toyota releases). 2016 and 2017 are GCBC only.
6. The only investigation that names the Camry is DP19004 (closed, withdrawn petition about Camry Hybrid brake actuator valves); it is listed on the page.
7. The 2026 shows 0 complaints on NHTSA's list (Toyota's 2026 cars returned 0 on November 21) and 3 recalls; rated Buy, 'too new to rate'.
8. Generations come from Wikipedia page summaries (XV50, XV70, XV80), flagged on the page to check against Toyota.

### honda-accord
**Honda Accord** (yardstick 146 per 100,000; Buy up to 182.5, Check first up to 292, Avoid above that). Best used: 2023–2024. Avoid: 2018–2019.

| Model year | Our verdict | Per 100,000 | Complaints | Recalls | Override |
|---|---|---|---|---|---|
| 2016 | Buy | 178 | 615 | 4 |  |
| 2017 | Check first | 183 | 589 | 3 |  |
| 2018 | Avoid | 695 | 2,023 | 6 |  |
| 2019 | Avoid | 298 | 798 | 6 |  |
| 2020 | Check first | 207 | 412 | 6 |  |
| 2021 | Check first | 146 | 297 | 4 | buy to check: open NHTSA analysis EA24002 covers the 2021 and no recall addresses it |
| 2022 | Check first | 208 | 323 | 4 |  |
| 2023 | Buy | 120 | 238 | 9 |  |
| 2024 | Buy | 146 | 238 | 6 |  |
| 2025 | Check first | 85 | 132 | 3 | buy to check: steering carries over 40% of the complaints and no recall covers it |
| 2026 | Buy | n/a | 16 | 2 |  |

Judgment calls and weak figures:

1. Two overrides, both Buy to Check first. 2021 (146, exactly the yardstick): open NHTSA engineering analysis EA24002 covers 2018 to 2022 Accords. 2025 (85, the lowest rate): 55 of 132 complaints (42%) name steering and no recall covers it. Both are up-steps under rule 5; the second reaches Check first on the lowest-rate year, so Mason may prefer to keep the 2025 at Buy.
2. EA24002 also covers 2020 and 2022, which already rate Check first (207 and 208); I did not move them to Avoid. A strict reading of the rule would make 2020 and 2022 Avoid and leave 2023 and 2024 as the only best years (as now). I stepped up only years that would otherwise read Buy.
3. 2017 rates Check first by one point (183 against a Buy line of 182.5); 2016 rates Buy at 178. Neither is listed as a best year (the cars are 9 to 10 years old and 2016's electrical and lighting counts are high).
4. The Accord price guide makes 2023 the floor for a used Accord; the page lists 2023 to 2024 as best. The guide's 'steering on 2024 and 2025' warning is why the 2025 is Check first.
5. The 2024 steering text ('128 complaints, many describing a clicking or sticky rack') is the price guide's count from complaint text on November 17, not recounted; the page counts steering complaints itself (75 + 55).
6. Sales: Good Car Bad Car's Accord table via a page summary. 2019 to 2024 give the same rates as the Camry vs Accord page; the 2025 rate there is 85, fresh count 88 (within 5%, published value kept).
7. The Reddit paragraph links the 1.5-liter turbo's oil dilution and head gasket reports to the 2018 engine count (614); that is a reading, not a finding, and the page says 'line up'.
8. Generations are from Wikipedia page summaries (the tenth and eleventh generation URL returns the combined Honda Accord article; the note says so). Check against Honda.

### toyota-corolla
**Toyota Corolla** (yardstick 48 per 100,000; Buy up to 60, Check first up to 96, Avoid above that). Best used: 2016–2018, 2022–2025. Avoid: 2020.

| Model year | Our verdict | Per 100,000 | Complaints | Recalls | Override |
|---|---|---|---|---|---|
| 2016 | Buy | 59 | 216 | 1 |  |
| 2017 | Buy | 58 | 191 | 3 |  |
| 2018 | Buy | 47 | 144 | 3 |  |
| 2019 | Check first | 68 | 207 | 6 |  |
| 2020 | Avoid | 135 | 320 | 6 |  |
| 2021 | Check first | 76 | 189 | 1 |  |
| 2022 | Buy | 48 | 107 | 0 |  |
| 2023 | Buy | 37 | 85 | 6 |  |
| 2024 | Buy | 32 | 74 | 4 |  |
| 2025 | Buy | 18 | 44 | 2 |  |
| 2026 | Buy | n/a | 0 | 1 |  |

Judgment calls and weak figures:

1. No overrides. 2016 to 2018 rate Buy (59, 58, 47) and are listed with 2022 to 2025 as best years; 2019 (68) and 2021 (76) are Check first and 2020 (135) is Avoid.
2. 2020: engine is 112 of 320 complaints (35%), under the 40% test, and the 22TC07 stalling campaign is a service campaign, not a recall, so no override; the rate alone puts it at Avoid. The Corolla price guide also says skip the 2020.
3. The 2019 recall 20V-012 and the 2018 row: NHTSA lists 20V-012 against the 2018 Corolla only because its notice names 2018 to 2019 for other models; it covers the 2019 Corolla. The page ties it to 2019.
4. Sales: Good Car Bad Car's Corolla table; the 2023 to 2025 total is one unit under Toyota's year-end releases (per the Corolla vs Elantra page). Published rates kept from the Corolla vs Elantra page (68, 135, 76, 48, 37, 32, 18); the Civic vs Corolla page has 134 and 17 for 2020 and 2025 (inside tolerance).
5. NHTSA count includes the GR Corolla (listing 'GR COROLLA') and Corolla iM; Corolla Cross is excluded by the file's `exclude`.
6. Generations are from Wikipedia (E170 and E210 page summaries; the E170 summary did not confirm Toyota Safety Sense P). Check against Toyota.
7. The Reddit paragraph says NHTSA's field doesn't say if the 2020 engine complaints are about the coolant bypass valve Reddit owners raise; no link is claimed.

### hyundai-elantra
**Hyundai Elantra** (yardstick 130 per 100,000; Buy up to 162.5, Check first up to 260, Avoid above that). Best used: 2021–2025. Avoid: 2017.

| Model year | Our verdict | Per 100,000 | Complaints | Recalls | Override |
|---|---|---|---|---|---|
| 2016 | Check first | 142 | 295 | 2 | buy to check: air bag inflator recall 26V-307 covers the 2016 and NHTSA’s inflator analysis EA16003 is open |
| 2017 | Avoid | 389 | 771 | 4 |  |
| 2018 | Check first | 142 | 284 | 0 | buy to check: the engine carries over 40% of the complaints and no recall covers the 2018 |
| 2019 | Check first | 144 | 253 | 1 | buy to check: the engine carries over 40% of the complaints and recall 21V-301 covers only 2.0-liter cars |
| 2020 | Check first | 243 | 256 | 3 |  |
| 2021 | Buy | 130 | 162 | 7 |  |
| 2022 | Buy | 136 | 159 | 8 |  |
| 2023 | Buy | 130 | 174 | 4 |  |
| 2024 | Buy | 47 | 64 | 2 |  |
| 2025 | Buy | 24 | 36 | 2 |  |
| 2026 | Check first | n/a | 6 | 4 |  |

Judgment calls and weak figures:

1. Added the missing NHTSA listing 'ELANTRA HEV' (2023: 55 complaints, 2024: 6) to nhtsa.listings and recallModels and re-ran the reader with --write. Counts now match the Corolla vs Elantra page (2023: 174, 2024: 64). Recall counts for 2021 and 2022 rose by one (HEV recalls). The Elantra GT stays excluded.
2. Three overrides, all Buy to Check first. 2016 (142): air bag inflator recall 26V-307 (May 2026, may rupture; final remedy was due August 2026) and open NHTSA analysis EA16003, but EA16003's own text covers older ARC inflators and a 2009 Elantra, and NHTSA's summary does not link it to the 2016 inflator, so this is the weakest override. 2018 (142): 146 of 284 complaints (51%) name the engine and NHTSA lists no recall for 2018. 2019 (144): 138 of 253 (55%) name the engine and recall 21V-301 covers only the 2.0-liter engine.
3. 2020 (243) stays Check first by the rule (Avoid line is 260); 113 of 256 (44%) name the engine but recall 21V-301 applies, so no up-step. A stricter reading puts 2020 at Avoid.
4. The Elantra's yardstick (130) is high because the 2019 to 2025 median includes four years at 130 to 243, so a Buy year here still draws about 3 times a Corolla Buy year. The page says so and links the Corolla vs Elantra page.
5. Price guide says look at a 2023 or newer; the page lists 2021 to 2025 as best. 2021 (130) and 2022 (136) are Buy but carry the pretensioner recalls (21V-796, 22V-123, 22V-218, 22V-354), which the page tells buyers to confirm.
6. The 2026 is rated Check first (not Buy) because it has four recalls, two of them fastener recalls (26V-692 strut, 26V-693 lug nuts that can let a wheel detach).
7. Sales: Good Car Bad Car (names no source of its own). Hyundai's tables list one Elantra row that may not include the hybrid, which would overstate rates.
8. No Hyundai powertrain-warranty figures are on the page (the only sourced figures come through a 2018 Motor1 table); the check just says to ask a dealer.
9. Generations are from Wikipedia page summaries (the sub-article URLs 404, so the combined Hyundai Elantra article was read in two chunks). Check against Hyundai.

### tesla-model-3
**Tesla Model 3** (yardstick 221 per 100,000; Buy up to 276.3, Check first up to 442, Avoid above that). Best used: 2023–2025. Avoid: 2018, 2021.

| Model year | Our verdict | Per 100,000 | Complaints | Recalls | Override |
|---|---|---|---|---|---|
| 2016 | Check first | n/a | 0 | 0 |  |
| 2017 | Check first | n/a | 27 | 16 |  |
| 2018 | Avoid | 741 | 1,040 | 19 |  |
| 2019 | Check first | 389 | 626 | 22 |  |
| 2020 | Check first | 221 | 456 | 21 | buy to check: open NHTSA evaluation PE26006 covers the 2020 and its failures exceed the earlier recalls |
| 2021 | Avoid | 559 | 680 | 22 |  |
| 2022 | Check first | 396 | 775 | 18 |  |
| 2023 | Buy | 187 | 434 | 12 |  |
| 2024 | Buy | 158 | 224 | 5 |  |
| 2025 | Buy | 75 | 128 | 3 |  |
| 2026 | Buy | n/a | 19 | 1 |  |

Judgment calls and weak figures:

1. TEST PROBLEM: the shared test requires car.sales[year] > 50000 for every year 2016 to 2025, which fails for 2016 and 2017 (not sold or 1,667 units). The file leaves 2016 and 2017 out of `sales` (the renderer then shows 'Too new to rate' and judges those years on counts). The coordinator needs a one-line test exemption for years with no sales (my scratch copy of the test with that exemption passes).
2. The 2016 row is a placeholder: no Model 3 was sold (first deliveries July 28, 2017). The verdict model has no 'not sold' value, so it carries Check first with the reason 'Not sold ...'; the table also prints 'Too new to rate' for it. A 'none' verdict in the renderer would be cleaner.
3. 2017 (27 complaints, 1,667 estimated sales) is left unrated and set to Check first on the count.
4. Sales are Good Car Bad Car's estimates (Tesla publishes no Model 3 sales), read from its Model 3 USA and Canada page on November 21 through a page summary. 2021 (121,610) looks low next to 2020 (206,500) and 2022 (195,698); 2024 (142,100) is also lower than 2023 (232,702) in a refresh year. The 2021 rate (559) is therefore probably high; the 2021 reason says so, and the verdict stays Avoid by the rule and by the count.
5. One override: 2020 Buy (221, the yardstick) to Check first: open NHTSA evaluation PE26006 (front lower lateral links, 156 complaints, 2018 to 2020 Model 3 and 2021 to 2023 Model Y). PE26006 also covers 2018 (Avoid) and 2019 (Check first); I did not step 2019 to Avoid (it is a preliminary evaluation, the lowest stage).
6. Tesla's AEB complaints are 53 to 69% of the 2021 and 2022 complaints. No up-step: recall 21V-846 (software) exists and NHTSA closed PE22002 (phantom braking) on June 29, 2026 after reports fell. Still, 'no recall' vs 'recall' is a judgment; a strict reading of the 40% test would push 2022 to Avoid.
7. Yardstick 221 is higher than a conventional car's and the Buy line is 276; Tesla rates are not comparable to the Camry's. The page says rates compare years of the same car.
8. Many recall counts (16 to 22 for 2017 to 2022) are mostly software and label campaigns that name the 2017 to 2022 range; the page does not claim they are mostly OTA, only individual ones read in NHTSA's remedy text.
9. Generations and trims are from a Wikipedia page summary (first 100,000 characters only). Check against Tesla.

### tesla-model-y
**Tesla Model Y** (yardstick 352.5 per 100,000; Buy up to 440.6, Check first up to 705, Avoid above that). Best used: 2024–2025. Avoid: 2021.

| Model year | Our verdict | Per 100,000 | Complaints | Recalls | Override |
|---|---|---|---|---|---|
| 2016 | Check first | n/a | 0 | 0 |  |
| 2017 | Check first | n/a | 0 | 0 |  |
| 2018 | Check first | n/a | 0 | 0 |  |
| 2019 | Check first | n/a | 0 | 3 |  |
| 2020 | Check first | 713 | 285 | 24 | avoid to check: the 40,001 sales is a partial first year that inflates the rate, and the 285 complaints are the fewest of 2020 to 2023 |
| 2021 | Avoid | 685 | 1,107 | 23 | check to avoid: two open NHTSA evaluations, PE25010 and PE26006, name the 2021 and its rate is near the Avoid line |
| 2022 | Check first | 393 | 888 | 20 | buy to check: open NHTSA evaluation PE26006 covers the 2022 and its failures exceed the earlier recalls |
| 2023 | Check first | 312 | 1,205 | 17 | buy to check: open NHTSA evaluation PE26006 covers the 2023 and its failures exceed the earlier recalls |
| 2024 | Buy | 109 | 341 | 5 |  |
| 2025 | Buy | 47 | 118 | 3 |  |
| 2026 | Check first | n/a | 0 | 8 |  |

Judgment calls and weak figures:

1. TEST PROBLEM: the shared test requires car.sales[year] > 50000 for 2016 to 2025; the Model Y fails for 2016 to 2019 (not sold) and 2020 (estimated 40,001, a partial year, which the comparison page also uses and which my file needs so the 2020 rate (713) agrees with that page). The coordinator needs a test exemption; my scratch copy of the test with the exemption passes.
2. The 2016 to 2019 rows are placeholders: no Model Y was sold. They carry Check first with a 'Not sold ...' reason, and the table prints 'Too new to rate' for them. A renderer 'none' verdict would be cleaner. NHTSA lists three recalls against 2019 (21V-388, 21V-389, 24V-051) because their model year ranges start in 2019; the page says so.
3. Estimate method: Good Car Bad Car's Model Y estimates (2020: 40,001, 2021: 161,527, 2022: 225,799, 2023: 385,897, 2024: 313,699, 2025: 253,020), reused from the Model Y vs RAV4 comparison. Cox Automotive's estimates are higher (about 394,000 for 2023 and 373,000 for 2024 in search summaries), which would lower the rates; the comparison page's pooled 2023 to 2025 rate drops from 175 to about 148 on Cox's figures.
4. Four overrides. 2020 Avoid to Check first (rule 7: the denominator is a partial first year and the 285 complaints are the fewest of 2020 to 2023; the rate 713 is only 8 over the Avoid line of 705). 2021 Check first to Avoid (685, 20 under the line: two open evaluations name it, PE25010 on door handles and PE26006 on lateral links). 2022 and 2023 Buy to Check first (PE26006 covers 2021 to 2023).
5. The yardstick is 352.5 (median of six rates); the page prints it with the .5. The Buy line is 440.6 and the Avoid line 705.
6. I left out DP26010 (open since October 9, 2026: a petition on 2026 Robotaxi Model Y and Cybercab speed in school zones); it does not bear on a used purchase.
7. Tesla's AEB complaints are 38 to 56% of the 2020 to 2023 complaints (584 of 1,107 in 2021). No 40% up-step because recall 21V-846 exists and PE22002 is closed; same judgment as the Model 3.
8. The page's 2026 verdict is Check first on eight recalls (lateral link 26V-558, contactors 25V-690, others) and no complaints yet.
9. Generations and trims are from a Wikipedia page summary (first 100,000 characters); the 2025 refresh and 2026 trims should be checked against Tesla.

### chevrolet-silverado-1500
### Chevrolet Silverado 1500: problems verdicts (open items)

**Chevrolet Silverado 1500** (yardstick 173 per 100,000; Buy up to 216.3, Check first up to 346, Avoid above that). Best used: 2025, 2020. Avoid: 2021.

| Model year | Our verdict | Per 100,000 | Complaints | Recalls | Override |
|---|---|---|---|---|---|
| 2016 | Buy | 183 | 804 | 12 |  |
| 2017 | Buy | 189 | 842 | 7 |  |
| 2018 | Buy | 117 | 524 | 7 |  |
| 2019 | Check first | 253 | 1,112 | 10 |  |
| 2020 | Buy | 173 | 759 | 12 |  |
| 2021 | Avoid | 227 | 866 | 8 | check to avoid: engine is 53% of the complaints and NHTSA’s EA25007 on 6.2-liter engine failures is still open |
| 2022 | Check first | 206 | 672 | 6 | buy to check: engine is 42% of the complaints and NHTSA’s EA25007 on 6.2-liter engine failures is still open |
| 2023 | Check first | 113 | 406 | 3 | buy to check: engine is 45% of the complaints and NHTSA’s EA25007 on 6.2-liter engine failures is still open |
| 2024 | Check first | 91 | 328 | 2 | buy to check: engine is 53% of the complaints and NHTSA’s EA25007 on 6.2-liter engine failures is still open |
| 2025 | Buy | 32 | 119 | 0 |  |
| 2026 | Check first | n/a | 137 | 3 |  |

Judgment calls and weak figures:

1. **Overrides (four, all up one step on engine evidence).** 2021 Check to Avoid; 2022, 2023, 2024 Buy to Check. Policy I used (extends rule 5): move up one step when an open NHTSA investigation names the year and its part is the year's top complaint part with 100+ complaints and 40%+ share (EA25007 covers 2019–2024 6.2-liter engines). 2019 (39% engine) and 2020 (36%) stayed put; 2025 (53% engine, only 63 complaints, not in EA25007's written scope) stayed Buy. Your call whether this is too harsh.
2. **2016–2018 sales are our estimate.** GM published no light-duty split before 2019. All-Silverado totals (Good Car Bad Car: 574,876; 585,864; 585,582, read through a page summary) times 76.2%, the 2019 light-duty share (438,686 of 575,569). Rates 184, 189, 117 could move with real figures.
3. **2019 LD figure (438,686) was read only through a search summary** (reused from the F-150 vs Silverado page, VEH-F1S-52).
4. **Price guide differs.** The guide says make 2023 the floor; the page rates 2023 Check first (engine evidence) and 2025/2020 best. The guide also says EA25007 covers 2025 and 2026 engines; NHTSA's opening summary names only 2019–2024, which is what the page says.
5. **Heavy duty.** The nhtsa.exclude regex drops 2500/3500/HD/EV names and keeps the bare "SILVERADO" listing, which can include records NHTSA files without a weight class. Not checked further.
6. Generations from Wikipedia (page summary); the Silverado 2027 redesign was not on the pages read.

### gmc-sierra-1500
### GMC Sierra 1500: problems verdicts (open items)

**GMC Sierra 1500** (yardstick 275 per 100,000; Buy up to 343.8, Check first up to 550, Avoid above that). Best used: 2025, 2017. Avoid: 2019, 2022.

| Model year | Our verdict | Per 100,000 | Complaints | Recalls | Override |
|---|---|---|---|---|---|
| 2016 | Check first | 33 | 54 | 8 | buy to check: the NHTSA count of 54 complaints looks incomplete next to the 2017’s 433, so the low rate can’t be trusted |
| 2017 | Buy | 268 | 433 | 6 |  |
| 2018 | Check first | 188 | 307 | 7 | buy to check: transmission and drivetrain is 43% of the complaints and no recall on NHTSA’s list covers it |
| 2019 | Avoid | 386 | 668 | 10 | check to avoid: engine is 51% of the complaints and NHTSA’s EA25007 on 6.2-liter engine failures is still open |
| 2020 | Check first | 271 | 489 | 12 | buy to check: engine is 54% of the complaints and NHTSA’s EA25007 on 6.2-liter engine failures is still open |
| 2021 | Check first | 341 | 611 | 7 | buy to check: engine is 62% of the complaints and NHTSA’s EA25007 on 6.2-liter engine failures is still open |
| 2022 | Avoid | 430 | 616 | 6 | check to avoid: engine is 44% of the complaints and NHTSA’s EA25007 on 6.2-liter engine failures is still open |
| 2023 | Check first | 275 | 522 | 3 | buy to check: engine is 46% of the complaints and NHTSA’s EA25007 on 6.2-liter engine failures is still open |
| 2024 | Check first | 180 | 386 | 1 | buy to check: engine is 58% of the complaints and NHTSA’s EA25007 on 6.2-liter engine failures is still open |
| 2025 | Buy | 57 | 132 | 1 |  |
| 2026 | Check first | n/a | 92 | 2 |  |

Judgment calls and weak figures:

1. **2016 count (54).** Probed 19 GMC listing names (SIERRA, SIERRA 1500, SIERRA DENALI, cab styles, SLT/SLE, LIMITED, CLASSIC, 2500/3500 HD and others): only "SIERRA 1500" returns records, and the 54 include 30 filed under productModel SIERRA DENALI. NHTSA's own counts are 865 (2014), 819 (2015), 54 (2016), 433 (2017), so the dip is NHTSA's. The rule gives Buy (rate 33); I moved it to Check first ("buy to check") as an incomplete count.
2. **Denali records** are kept as the stub's regex does (they are 1500-family in this listing; HD Denali would come under 2500/3500 names).
3. **Overrides (up one step):** 2018 (power train 43%, no power train recall), 2019 Check to Avoid, 2020, 2021, 2023, 2024 Buy to Check, 2022 Check to Avoid. Same policy as the Silverado (open EA25007, engine 44–62% share). Result: only 2017 and 2025 stay Buy. Price guide says make 2023 the floor; page rates 2023 Check first.
4. **2016–2018 sales are our estimate:** all-Sierra totals (221,680; 217,943; 219,554) times 74.2% (2019 light-duty share, 172,452 of 232,325).
5. **RQ26003** (opened October 9, 2026) is cited with its 118-complaint count; recall 25V-060 covers only 2022 chrome-deflector trucks.
6. Wikipedia read through a page summary; 2024 refresh and 2027 redesign not on the pages read.

### ram-1500
### Ram 1500: problems verdicts (open items)

**Ram 1500** (yardstick 122 per 100,000; Buy up to 152.5, Check first up to 244, Avoid above that). Best used: 2020–2021, 2023–2024. Avoid: 2016.

| Model year | Our verdict | Per 100,000 | Complaints | Recalls | Override |
|---|---|---|---|---|---|
| 2016 | Avoid | 322 | 1,571 | 17 |  |
| 2017 | Check first | 177 | 888 | 13 |  |
| 2018 | Buy | 125 | 671 | 15 |  |
| 2019 | Check first | 237 | 1,505 | 30 |  |
| 2020 | Buy | 115 | 650 | 14 |  |
| 2021 | Buy | 122 | 694 | 15 |  |
| 2022 | Check first | 138 | 646 | 17 | buy to check: NHTSA’s open PE24018 covers engine stalls on 2022 trucks and engine is the top complaint part |
| 2023 | Buy | 47 | 211 | 12 |  |
| 2024 | Buy | 42 | 79 | 7 |  |
| 2025 | Check first | 187 | 382 | 8 |  |
| 2026 | Check first | n/a | 110 | 9 |  |

Judgment calls and weak figures:

1. **Classic.** NHTSA does not list the Classic separately: "1500 CLASSIC" returns the same complaint records as "1500" for 2019–2021 (and the crew/quad names for 2022–2023), and its recall listing returns nothing, since Classic recalls come back under "1500". So nothing could be dropped. The page says the counts include the Classic (generations section, answer, FAQ, check item) and that the sales totals include it too. The nhtsa block is unchanged.
2. **Sales are weak and mixed-basis (biggest caveat).** Ram published no 1500-only total before 2024. 2016–2021 are all Ram pickups (1500, Classic, HD) from carfigures.com via a page summary (its 2022 and 2023 figures conflict with other sources and were not used); 2022 is 468,344 (Auto Dealer Today, search summary); 2023 is 444,926 (Motor1; page doesn't say HD included); 2024–2025 are light-duty pickups (187,013; 204,139, FCA release) because the Tundra vs Ram page publishes those rates (42, 187) and the test holds me to them. Rates 2016–2023 are therefore understated, and the 2023-to-2024 step is partly a denominator change. The page says so.
3. **Override:** 2022 Buy to Check (open PE24018 engine stalls on 2022 trucks, engine is the top part with 257 complaints). 2021 (engine 41%) stays Buy because recall 23V-265 covers that engine fault.
4. **2025 Check first (187):** 203 of 382 complaints name electrical, with five software and hardware recalls; no override.
5. **Price guide:** it calls 2023 and 2024 low counts and flags 2019–2022; the page agrees (best 2020–2021, 2023–2024).
6. RQ23003 (open, 2013–2016) is cited against the 2016 Avoid. Wikipedia read for the first 100,000 characters only.

### toyota-tundra
### Toyota Tundra: problems verdicts (open items)

**Toyota Tundra** (yardstick 99 per 100,000; Buy up to 123.8, Check first up to 198, Avoid above that). Best used: 2016–2021. Avoid: 2022–2024.

| Model year | Our verdict | Per 100,000 | Complaints | Recalls | Override |
|---|---|---|---|---|---|
| 2016 | Buy | 105 | 120 | 6 |  |
| 2017 | Buy | 68 | 79 | 6 |  |
| 2018 | Buy | 85 | 100 | 9 |  |
| 2019 | Buy | 66 | 74 | 10 |  |
| 2020 | Buy | 44 | 48 | 5 |  |
| 2021 | Buy | 29 | 24 | 3 |  |
| 2022 | Avoid | 418 | 438 | 14 |  |
| 2023 | Avoid | 339 | 426 | 14 |  |
| 2024 | Avoid | 229 | 367 | 10 |  |
| 2025 | Check first | 99 | 147 | 6 | buy to check: recall 26V-750 reaches 2025 trucks, was filed November 12, 2026, and its owner letters do not start until December 28, 2026 |
| 2026 | Check first | n/a | 0 | 3 |  |

Judgment calls and weak figures:

1. **Tundra recall 26V-750** is worded as on the F-150 vs Tundra page: filed November 12, 2026, 2022–2023 and 2025–2026 trucks, cracked camshaft, owner letters from December 28, 2026, alongside 24V-381, 25V-767 and 26V-320 (V35A main bearings). The 62,490-truck figure is carried from that comparison page (NHTSA's cache here holds no unit counts).
2. **Override:** 2025 Buy to Check (rate 99 is Buy; the camshaft recall reaches it, filed 10 days before the page date, no remedy mailed yet). I did not apply the same to the Ranger's 26V-343 because its remedy is out (letters mailed October 23, 2026). Policy: a loss-of-drive-power recall filed within ~90 days with no remedy yet.
3. **Yardstick is 99**, pulled up by the three V35A years, so every 2016–2021 truck rates Buy (even the 2016 at 105). Best years are therefore all old-generation (5.7 V8); 2025 not listed.
4. **2021's count is 24** on Toyota's lowest sales year (81,959); small numbers.
5. **2026:** NHTSA returned 0 complaints, so no rate; Check first on the recall.
6. Price guide counts (166 of 436 engine on 2022) differ from this page's fresh counts (207 of 438); the guide used an earlier read.
7. Sales: Good Car Bad Car via page summary (2016–2018 new here: 114,489; 116,285; 118,258).

### toyota-tacoma
### Toyota Tacoma: problems verdicts (open items)

**Toyota Tacoma** (yardstick 38 per 100,000; Buy up to 47.5, Check first up to 76, Avoid above that). Best used: 2020–2023, 2025. Avoid: 2016–2019, 2024.

| Model year | Our verdict | Per 100,000 | Complaints | Recalls | Override |
|---|---|---|---|---|---|
| 2016 | Avoid | 170 | 325 | 4 |  |
| 2017 | Avoid | 124 | 246 | 5 |  |
| 2018 | Avoid | 85 | 210 | 3 |  |
| 2019 | Avoid | 88 | 219 | 4 |  |
| 2020 | Buy | 38 | 90 | 1 |  |
| 2021 | Buy | 32 | 81 | 0 |  |
| 2022 | Buy | 25 | 60 | 3 |  |
| 2023 | Buy | 24 | 57 | 4 |  |
| 2024 | Avoid | 82 | 158 | 6 |  |
| 2025 | Buy | 44 | 122 | 5 |  |
| 2026 | Check first | n/a | 0 | 0 |  |

Judgment calls and weak figures:

1. **Yardstick is low (38)** because 2020–2023 draw 24–38, so the rule marks 2016–2019 and 2024 Avoid (rates 170, 124, 85, 88, 82). 2018 (85) and 2024 (82) are within 10 of the Avoid line (76). No override applied: the fuel pump recalls cover about a third of 2018 and 2019's complaints, not most. Your call if you want 2018 and 2024 moved down to Check first.
2. **2026 Check first** with 0 complaints and 0 recalls on NHTSA's list (Toyota 2026 returned nothing): no record, same design as 2024–2025.
3. **2025 structure** is the top part (47 of 122) and no recall explains it; kept Buy (rate 44).
4. **Sales:** 2019–2025 from Toyota releases reused from the Colorado vs Tacoma page; 2016–2018 (191,631; 198,124; 245,659) from Good Car Bad Car via page summary. Whether Tacoma Hybrid sales are inside the totals is unconfirmed.
5. No NHTSA investigation names the Tacoma. Wikipedia third and fourth generations read from offset 100,000 summary; 2026 changes not covered.
6. Price guide watch list (2024–2025 recalls) agrees.

### chevrolet-colorado
### Chevrolet Colorado: problems verdicts (open items)

**Chevrolet Colorado** (yardstick 111 per 100,000; Buy up to 138.8, Check first up to 222, Avoid above that). Best used: 2018–2022, 2024–2025. Avoid: 2016–2017.

| Model year | Our verdict | Per 100,000 | Complaints | Recalls | Override |
|---|---|---|---|---|---|
| 2016 | Avoid | 660 | 718 | 4 |  |
| 2017 | Avoid | 193 | 218 | 1 | check to avoid: transmission and drivetrain is half of the complaints (108 of 218) and NHTSA lists no recall for it |
| 2018 | Buy | 136 | 183 | 1 |  |
| 2019 | Buy | 124 | 152 | 0 |  |
| 2020 | Buy | 91 | 88 | 0 |  |
| 2021 | Buy | 111 | 81 | 1 |  |
| 2022 | Buy | 65 | 58 | 1 |  |
| 2023 | Check first | 204 | 145 | 3 |  |
| 2024 | Buy | 131 | 128 | 3 |  |
| 2025 | Buy | 26 | 28 | 1 |  |
| 2026 | Check first | n/a | 22 | 1 |  |

Judgment calls and weak figures:

1. **2016 steering:** 466 of 718 complaints name steering. NHTSA's steering recalls 16V-054 and 21V-213 list 2015 trucks only (checked in recallsByVehicle), so none covers the 2016. RQ19001 (closed) is cited for context.
2. **Override:** 2017 Check to Avoid (power train 108 of 218, 50%, no power train recall on the list). That is the 100+ complaints and 40%+ policy used on the GM trucks (clause: no recall for the part).
3. **EA26006 (open)** names the 2023–2026 Colorado but its evidence so far is Lyriq-based and brakes are only 23–24% of Colorado complaints, so no override on 2023–2025; 2026 is Check first because it is the only listing with no data but the open investigation. The price guide leads with EA26006; the page does too.
4. **2023 Check first (204)** on rate alone; forward collision avoidance 47 (recall 24V-133).
5. 2018 (136) is just inside the Buy line (138.8).
6. Sales 2019–2025 reused from Best-Selling-Cars via the Colorado vs Tacoma page; 2016–2018 Good Car Bad Car page summary. The page summary's 2019 (121,703) and 2020 (96,236) differ slightly from the Best-Selling-Cars figures used (122,304; 96,238); I kept the comparison page's.
7. Canyon counts are not included (separate NHTSA name).

### ford-ranger
### Ford Ranger: problems verdicts (open items)

**Ford Ranger** (yardstick 127 per 100,000; Buy up to 158.8, Check first up to 254, Avoid above that). Best used: 2020–2023, 2025. Avoid: 2019.

| Model year | Our verdict | Per 100,000 | Complaints | Recalls | Override |
|---|---|---|---|---|---|
| 2019 | Avoid | 304 | 272 | 11 |  |
| 2020 | Buy | 130 | 132 | 7 |  |
| 2021 | Buy | 127 | 120 | 6 |  |
| 2022 | Buy | 68 | 39 | 5 |  |
| 2023 | Buy | 59 | 19 | 4 |  |
| 2024 | Check first | 214 | 99 | 13 |  |
| 2025 | Buy | 65 | 46 | 13 |  |
| 2026 | Check first | n/a | 9 | 8 |  |

Judgment calls and weak figures:

1. **Not sold 2016–2018.** Per the coordinator, firstSold is 2019; no 2016–2018 verdict or sales entries. NHTSA lists 1 complaint each for 2016 and 2017 (air bags) under the Ranger name; they are excluded from the page by firstSold.
2. **The test's 50,000-sales floor fails for the Ranger:** sales were 32,334 (2023) and 46,205 (2024) and only the first year (2019) is exempt. Not faked; the test or the renderer needs a lower floor for this car (e.g., 25,000) or the Ranger waived.
3. **Verdicts:** 2019 Avoid (304), 2024 Check (214), the rest Buy; no overrides. 2025 stays Buy even with engine recall 26V-343 because the remedy (new long block) is out; compare the Tundra 2025 override. 2026 Check first (26V-343, 26V-548 remedy expected December 2026, 26V-605 remedy under development).
4. **2023 rests on 19 complaints and 32,334 sales** (rate 59).
5. **Sales** reused from the Tacoma vs Ranger page (2020 and 2021 columns on one Best-Selling-Cars page are both labeled FY2021).
6. RQ21002 (open) is about the 2020 rearview camera recall's timing; PE24019 closed September 19, 2025 and lists 2024–2025 Rangers as similar-pump vehicles outside recall 25V-455. Power train is the top part every year but its share is under 40% except 2021 (50%, 60 complaints), so no override.
