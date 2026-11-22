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
