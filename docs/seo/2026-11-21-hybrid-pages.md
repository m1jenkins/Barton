# "Is the hybrid worth it?" pages, November 21, 2026

Read this before editing a `<make>-<model>-hybrid-vs-gas.html` page or adding another car. The price guides are in `2026-11-15-vehicle-price-pages.md`; these pages reuse their look, their prices and their Reddit files.

## What they are

Each page answers one search, "is the <car> hybrid worth it?", verdict first, then the numbers behind it: the price premium on like-for-like trims, EPA mpg for both versions, the year's gas bill at 12,000 and 15,000 miles, the years until the fuel savings cover the premium, what else changes (power, torque, cargo, towing and payload, AWD, the F-150's generator, the battery warranty), whether this month's incentives favor one version, resale, what owners on Reddit report about real mpg, "Buy the hybrid if / Buy the gas version if", and a few questions. Each links its car's price guide and any comparison page that features the car.

Built November 21, 2026 for five cars: Honda CR-V, Ford F-150 (PowerBoost against the 2.7L and 3.5L EcoBoost), Toyota Tacoma (i-FORCE MAX against i-FORCE), Hyundai Tucson (with the plug-in) and Honda Civic. Each sells both versions for 2026: Honda's spec pages list the CR-V and Civic hybrids beside the gas cars, Ford's models page marks "Hybrid Available" on five F-150 trims, EPA has 2026 records for the Tacoma i-FORCE MAX, and hyundaiusa.com prices the 2026 Tucson, Hybrid and Plug-in Hybrid.

## How they are built

One data file per car in `data/hybrid-pages/<car key>.json` (the key is the price guide's slug stem, such as `honda-cr-v`). `scripts/render-hybrid-pages.mjs` renders every file in the folder (files starting with an underscore are not cars), taking the page chrome from `car-negotiation-service.html` through `shell()` and the layout from `buying/price-guide.css` plus a small sheet of its own, `buying/hybrid-pages.css` (`hp-*` classes: a one-photo hero, a four-item strip, the numbers tables, the "buy if" ticks). Do not edit the generated pages by hand.

```sh
npm run build:hybrids   # after changing a data file, the script, hybrid-pages.css or car-negotiation-service.html's head/header/footer
npm run check:hybrids   # CI runs this; fails when the files drift
node scripts/render-hybrid-pages.mjs --wire   # adds any missing sitemap, blog.html, llms.txt, content-inventory, query-map and source-registry rows (safe to rerun)
```

`data/hybrid-pages/_shared.json` holds what every page uses: the miles (12,000 and 15,000), EPA's gas and electricity prices, the EIA weekly average and the shared sources (EPA's price API, EPA's label explainer, EIA, the Arctic Shift archive). They are numbered on after each car's own sources.

**What a car file holds.** Prose (verdict, "buy if" lists, the intro to each section, FAQ, incentives, resale), plus the inputs the renderer calculates from:

- `scenarios[]`: each a like-for-like pair. `gas` and `hybrid` name a trim in the price guide's table (`trim`, or `guideTrim` when the label differs), with `plus` for a step the table lacks (4x4, AWD) or `price` to set it outright. The renderer reads the price from `data/vehicle-pages.json`, so a price change in the guide reaches the page on the next build. A scenario with `premium: { amount, atMost: true }` takes the premium from outside the table (the F-150, where Cars.com prices the PowerBoost as an option) and every figure derived from it prints "up to". `epa[]` lists the EPA records (vehicle id, combined, city, highway) by drivetrain; money is worked out for every row.
- `extraPremiums[]`: more pairs shown in the premium table only.
- `plugin`: optional (the Tucson). The renderer works out a best case: a full charge used every day, 365 days a year, at EPA's electricity price.
- `changes[]`, `sources[]` (with `id`, `url`, `title`, `authority`, `scope`, `note`, optional `status` and `registryNote`), `queries`, `blog`, `llms`.
- Prose may state a number only if the renderer also prints it (a test checks the table cells against the calculation). When you change a price or an mpg, reread the prose for the numbers it quotes.

**The arithmetic.** Annual gas cost = miles ÷ EPA combined mpg × price. Break-even years = premium ÷ (gas cost − hybrid cost). Four conditions: 12,000 and 15,000 miles, at EPA's price ($4.00, the fueleconomy.gov API) and at the EIA national average for regular ($3.805, week of November 16, 2026). EPA's own label figure assumes 15,000 miles and rounds to $50, so ours differ by a few dollars from it; the page says how it is worked out.

## Rules

- **Verdict first, with the number that decides it.** Edmunds-style: claim, number, payoff; every number against a yardstick; praise and catch together. The skill is `.claude/skills/edmunds-style`.
- **Nobody here has driven these cars.** Power, torque and 0-60 times are the maker's or a named publication's. Owner mileage is "what owners on Reddit report", paraphrased from the car's `themes.mpg`, never quoted and never a confirmed defect. The Reddit counts are computed from the car's file at build time and cover every version of the car, not only the hybrid; the page says so.
- **Every outside figure has a source the research read, dated.** Each source gets a `VEH-HYB-<CODE>-NN` row in `data/source-registry.csv` with `article_url` set to the page (`--wire` writes them); a test enforces it and also that the page's outside links equal its sources plus its photo credit. A figure reused from a price guide keeps that guide's URL and says "from the <car> price guide". A figure seen only in a search result says so in `registryNote`.
- **No MarketCheck or listings figures.** None were used.
- **The cost and break-even figures are labelled as our estimates** ("not a promise" once, in the sources note). No savings figures for Steer Me Right clients, no deal results, no tax or registration advice, no dealer names. Never "brief" or "broker".
- **Plan cards and plan lines are the price guides' word for word** (a test compares the card text with `render-vehicle-pages.mjs`).
- **No outside figure goes in the prose that the renderer can't back up.** Where the research could not confirm something (the F-150's 4WD charge, the Honda and Ford battery terms), the page says what is unknown.

## What each page targets

| Page | Searches | Verdict as written |
| --- | --- | --- |
| `honda-cr-v-hybrid-vs-gas.html` | honda cr-v hybrid worth it; cr-v hybrid vs gas; cr-v hybrid vs gas mpg | Yes |
| `ford-f-150-hybrid-vs-gas.html` | ford f-150 hybrid worth it; f-150 powerboost vs ecoboost; f-150 hybrid vs gas mpg | No, unless you want the generator |
| `toyota-tacoma-hybrid-vs-gas.html` | toyota tacoma hybrid worth it; tacoma i-force max vs i-force; tacoma hybrid vs gas mpg | No, unless you want the power or the outlet |
| `hyundai-tucson-hybrid-vs-gas.html` | hyundai tucson hybrid worth it; tucson hybrid vs gas; tucson hybrid vs gas mpg | Yes, if you skip Hyundai's financing |
| `honda-civic-hybrid-vs-gas.html` | honda civic hybrid worth it; civic hybrid vs gas; civic hybrid vs gas mpg | Yes |

Each car has four query-map rows (`SEO-2026-11-21-HYBRIDS`, exploratory seeds, no Search Console data yet).

## How the research was done (November 21, 2026)

- **EPA:** vehicle records through `fueleconomy.gov/ws/rest/vehicle/<id>` (ids are in the tables and the sources list), prices from `.../ws/rest/fuelprices`. The 2026 gas CR-V, Civic and Tucson are in EPA's list under model names such as "CR-V FWD", "Civic 4Dr" and "Tucson FWD"; the F-150 hybrid is "F150 Pickup 4WD HEV" and the Tacoma's is "Tacoma Hybrid 4WD".
- **EIA:** `eia.gov/petroleum/gasdiesel/`, U.S. regular, $3.805 on November 16, 2026 ($3.995 a week earlier, $4.153 two weeks earlier).
- **Makers:** Honda Information Center (CR-V and Civic specs, read as a page), Toyota's pressroom (Tacoma), Ford's model pages and Hyundai's warranty page (read in a browser, since these sites refuse scripted reads).
- **Secondary:** Cars.com (F-150 option prices and tow and payload by engine), iSeeCars (depreciation, per-trim Tacoma towing and payload, Tucson cargo and weight).
- **Reddit:** each car's coded file in `data/reddit-sentiment/cars/`.

## Monthly maintenance

1. Update `_shared.json`: the EIA price, week and release date (and EPA's price if it moved). Update the shared source scope for the EIA line to match.
2. Reread the incentives paragraph of every car against the maker's offers page, and the premium note where a price moved. Offers end November 30, 2026 (Honda leases January 4, 2027).
3. `npm run build:hybrids`, then reread each page's verdict and range sentences against the tables. The prose quotes some computed numbers by hand (break-even ranges, gallons, dollars a year).
4. Bump each car's `checkedOn`; the page's date follows it. Move `next_review` in the registry.

## Adding a car

Add `data/hybrid-pages/<key>.json` (copy `honda-civic.json`, the simplest), make sure the car has a price guide and a Reddit file, run `npm run build:hybrids`, then `node scripts/render-hybrid-pages.mjs --wire`, then `node scripts/validate-site.mjs`, `npm run check:vehicles` and `npm test`. Check that each EPA record is for the right trim: EPA files gas Civics and Tucsons under model names without trims, so match the combined rating to the guide's mpg for that trim. The coordinator adds links from the price guides afterwards; the guides were not edited.

## Open items for Mason

Every verdict and pick below is a judgment I wrote from the numbers. Change the data file and rebuild if you disagree.

1. **CR-V: "Yes, for most buyers."** Sport Hybrid ($35,630) against EX ($33,150), the trim it matches: +$2,480. 40 against 30 mpg (front-drive), $476 a year at 15,000 miles and $3.805, break-even 5.2 years (5.0 to 6.5 across the four conditions, 5.5 to 7.3 with AWD). Sport-L Hybrid against EX-L: +$3,325, 6.7 to 8.7 years. The page also says dealers give a point less off the hybrid (about $350, from the price guide's ranges).
2. **F-150: "No, unless you want the generator."** The premium is Cars.com's PowerBoost option price, up to $9,635 on an XLT with 4WD included, against a 2.7L, 20 mpg, and up to $6,415 against a 3.5L, 19 mpg; the hybrid is 23. At 15,000 miles and $3.805 the payback is up to 25.9 years against the 2.7L, up to 12.3 against the 3.5L and up to 9.8 on a King Ranch or Platinum ($5,140). The true figures are lower because a gas 4x4 needs a 4WD charge we couldn't find. Even at half the XLT premium the page says about 13 years. If a sourced 4x4 price turns up, replace the `premium` overrides with prices and the "up to" disappears.
3. **Tacoma: "No, unless you want the power or the outlet."** TRD Sport 4x4 automatic ($43,615 with the guide's $3,200 4x4 step) against i-FORCE MAX ($47,335): +$3,720; 23 against 21 mpg; $236 a year; 15.0 to 19.7 years (15.7 at 15,000 miles and $3.805). TRD Off-Road is also +$3,720 and Limited +$3,325. Dealers' typical discounts widen the gap to roughly $4,000 to $5,400.
4. **Tucson: "Yes, if you skip Hyundai's financing."** Hybrid SEL ($32,750) against SEL ($31,050): +$1,700; 38 against 28 mpg front-drive (36 against 26 AWD); $536 a year; 3.0 to 4.0 years. The Hybrid Limited against a gas Limited with AWD is +$1,250 and 2.0 to 2.6 years. Hyundai's 0% (gas) against 2.9% (hybrid) on a $33,000, 60-month loan is $2,490 of interest; with that the payback is about 7.8 years, and about 10 if the gas truck takes its full extra $1,250 of bonus cash. That loan size is my assumption. The plug-in, $6,425 over a Hybrid SEL with AWD, is about 14 years in the best case (32 electric miles every day of the year); the page says to buy it only if you charge nightly.
5. **Civic: "Yes, for most buyers."** Sport Hybrid ($29,395) against Sport ($26,695): +$2,700; 49 against 34 mpg; $514 a year; 5.0 to 6.6 years (hatchback 5.2 to 6.9). The page leans on power (200 against 150 hp; Edmunds 6.6 against 10.0 seconds to 60 mph) as much as fuel, and notes dealers give a point less off the hybrid (about $300).

**Figures that are weak or came from snippets. Check before tightening the wording:**

- **Hybrid battery terms.** Honda's page (8 years or 100,000 miles for abnormal degradation) was seen only in a search result because Honda refused our reads, and one outlet prints 10 years and 150,000 miles. The F-150's 8 years and 100,000 miles is from CarGurus and a dealer FAQ, not Ford. I could not find a Civic term and the page says so. Toyota's 10 years and 150,000 miles is from its own press release; Hyundai's 10 years and 100,000 miles is from its warranty page.
- **F-150 prices and ratings.** The option prices, 11,600-pound hybrid towing, 1,740-pound payload and the 2.7L/3.5L tow and payload figures are Cars.com's (February 18, 2026, and the engine-to-figure mapping in its list was garbled in the read). Ford's page gives 420 hp and 570 lb-ft; Cars.com prints 430 hp. EPA also lists a rear-drive PowerBoost (vehicle 50447, 24 mpg) that Ford's page doesn't show; if it exists, its premium and payback would be smaller.
- **Tacoma towing, payload and weight** are iSeeCars' per-trim list (6,400 gas against 6,000 hybrid on a TRD Sport 4x4; hybrid payload higher), not Toyota's. EPA's gas 4x4 record 50091 is used for the TRD Sport; the three other 4x4 records read 21 combined too.
- **Resale figures** are iSeeCars'. The Civic's five-year figures (28.4% and 35.1%) come from its comparison page and conflict with the Civic price guide's 7.0% three-year figure, which may be the hybrid and gas cars together or a different model-year mix. The CR-V and Tucson three-year figures are the guides'.
- **Tucson hybrid torque** is left out: sources print 258 and 271 lb-ft. Power, cargo and weight are iSeeCars'.
- **CR-V hybrid torque:** Honda lists 247 lb-ft for the electric traction motor and no system figure; the page says so.
- **Tucson plug-in cost** assumes a full charge every day and EPA's $0.15 a kilowatt-hour. EPA's own annual cost figure for the plug-in is a gas-only 35 mpg number and isn't used.
- **Reddit mpg notes** come from the car's themes file and are about every version of the car. The Tacoma's describe the gas truck only; the page says no note is about the hybrid.
