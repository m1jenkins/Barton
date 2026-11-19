# Research: Ford F-150 vs GMC Sierra 1500 (car a = F-150, car b = Sierra 1500)

Prepared 2026-11-18. Source id code FVS (VEH-FVS-01 ...). Raw files: `research/f-150-vs-sierra/` (NHTSA complaints JSON in `nhtsa/raw/`, deduplicated sets `nhtsa/f150_dedup.json` and `nhtsa/sierra_dedup.json`, recalls in `nhtsa/recalls/`, ratings in `ratings/`, EPA records in `epa/`, the Ford spec PDF text in `specs/`, scripts `nhtsa/analyze.py`, `tables.py`, `groups.py`, `sales.csv`, and the two reference comparisons as JSON).

How to read the "read on" column: **2026-11-18** means read by me today (API by curl, or a page through WebFetch, which returns an extract, not a browser view). **Reused <id>** means taken from a price guide or reference comparison, with its original source id; those were read in a browser by earlier sessions on the dates the guides give (F-150 guide 2026-11-15, Sierra guide 2026-11-16, F-150 vs Silverado 2026-11-16, Sierra vs Silverado 2026-11-18). "snippet" and "summary" are web-search result text, not a page I opened.

Blocked today (HTTP 403 or 503, not worked around): edmunds.com (all pages), jdpower.com, consumerreports.org, truecar.com, gmc.com, cars.usnews.com (503), carbravo.com, gmauthority.com (one article), pickuptrucktalk.com, GMC and Ford offers pages (Ford returned a page with no offer figures). For those, the figure comes from the price guides and is labelled Reused.

---

## A. Price: starting MSRP, destination, 4x4 step-up

Both trucks: 2026 is on sale; the 2027 is also on sale (Ford "F-150" page now shows 2027; GMC's 2027 Sierra is all new). MSRP excludes destination.

### 2026 and 2027 starting MSRP by trim

| Figure | 2026 MSRP | 2027 MSRP | Trim/drivetrain | Source id | Read on |
|---|---|---|---|---|---|
| F-150 XL | $39,585 | $40,155 | 4x2 regular cab 6.5 ft (iSeeCars style list matches $39,585) | Reused VEH-F150-01/02 (original ids); iSeeCars FVS-27 | 2026-11-15 / 2026-11-18 |
| F-150 STX | $41,855 | $42,675 | | Reused VEH-F150-01/02 | 2026-11-15 |
| F-150 XLT | $44,695 | $46,525 | | Reused VEH-F150-01/02 | 2026-11-15 |
| F-150 Lariat | $59,560 | $57,730 | 4x2 SuperCrew 5.5 ft (iSeeCars matches $59,560) | Reused VEH-F150-01/02; FVS-27 | 2026-11-15 / 2026-11-18 |
| F-150 Tremor | $64,915 | $59,975 | 4x4 | Reused; FVS-27 matches $64,915 | 2026-11-15 / 2026-11-18 |
| F-150 King Ranch | $65,825 | $66,155 | 4x2 SuperCrew | Reused; FVS-27 matches | same |
| F-150 Platinum | $68,800 | $69,130 | 4x2 SuperCrew | Reused; FVS-27 matches | same |
| F-150 Raptor | $79,005 | $75,325 | 4x4 | Reused; FVS-27 matches $79,005 | same |
| Sierra Pro | $38,600 | $39,300 | 4x2 regular cab 6.6 ft (iSeeCars matches $38,600) | Reused VEH-SIERRA-01/02; FVS-28 | 2026-11-16 / 2026-11-18 |
| Sierra SLE | $49,000 | Dropped | 4x2 double cab (FVS-28 matches) | Reused VEH-SIERRA-01/02 | 2026-11-16 |
| Sierra Elevation | $50,800 | $50,200 | 4x2 double cab (FVS-28 matches) | Reused | same |
| Sierra SLT | $55,400 | Dropped | 4x2 crew cab 5.8 ft (FVS-28 matches) | Reused | same |
| Sierra Denali | $66,100 | $70,900 | 4x2 crew cab 5.8 ft (FVS-28 matches) | Reused | same |
| Sierra AT4 | $68,300 | $70,700 | 4x4 diesel (FVS-28 matches) | Reused | same |
| Sierra AT4X | $79,900 | $82,700 | 4x4 | Reused | same |
| Sierra Denali Ultimate | $84,400 | $85,100 | 4x4 | Reused | same |

- Destination: $2,795 on the F-150 (2026 and 2027; "a few early 2026 trucks show $2,595") and $2,795 on the Sierra (both years). Reused VEH-F150-02 and VEH-SIERRA-04 (gmc.com destination page returned 403 today; FVS-27 says its F-150 style list carries a $2,795 destination charge on every style, 2026-11-18).
- 2027 F-150 (Ford page, WebFetch extract, 2026-11-18, FVS-02): the XL is listed with the 3.0L V6 EcoBoost; max gas towing 13,500 lb, max gas payload 2,430 lb; hybrid "up to 12,100 lbs". Ford printed no prices on this page, so 2027 prices are Reused VEH-F150-02.
- 2027 Sierra: all new, 5.7L and 6.6L V8s, 10-speed on every engine, SLE and SLT dropped; Pro up $700, Denali up $4,800. Reused VEH-SIERRA-02/03 (gmc.com refused reads today).
- Ford's own "2026 F-150" page prints no prices (FVS-01, 2026-11-18); trims, engines and towing claims only.

### 4x4 step-up (MSRP, 2026, destination excluded), computed from iSeeCars' style lists

| Trim and body | 4x2 | 4x4 | Step-up | Source id | Read on |
|---|---|---|---|---|---|
| F-150 XL SuperCrew 5.5 ft | $43,935 | $47,820 | $3,885 | FVS-27 | 2026-11-18 |
| F-150 STX SuperCrew 5.5 ft | $47,190 | $51,070 | $3,880 | FVS-27 | 2026-11-18 |
| F-150 XLT SuperCrew 5.5 ft | $48,055 | $51,915 | $3,860 | FVS-27 | 2026-11-18 |
| F-150 Lariat SuperCrew 5.5 ft | $59,560 | $63,360 | $3,800 | FVS-27 | 2026-11-18 |
| F-150 King Ranch / Platinum SuperCrew 5.5 ft | $65,825 / $68,800 | $69,625 / $72,600 | $3,800 each | FVS-27 | 2026-11-18 |
| Sierra Pro crew cab 5.8 ft | $44,500 | $47,800 | $3,300 | FVS-28 | 2026-11-18 |
| Sierra SLE crew cab 5.8 ft | $51,600 | $54,900 | $3,300 | FVS-28 | 2026-11-18 |
| Sierra Elevation crew cab 5.8 ft | $53,600 | $56,900 | $3,300 | FVS-28 | 2026-11-18 |
| Sierra SLT crew cab 5.8 ft | $55,400 | $58,500 | $3,100 | FVS-28 | 2026-11-18 |
| Sierra Denali crew cab 5.8 ft | $66,100 | $69,400 | $3,300 | FVS-28 | 2026-11-18 |

Other iSeeCars style prices worth using: F-150 range "$37,290 to $79,005" (cheapest is the 4x2 XL regular cab 8-ft box at $37,290, which Ford's $39,585 starting price does not use); F-150 XLT cheapest listed style $45,695 (4x2 SuperCab) against Ford's $44,695 starting price (see Contradictions). Sierra range on FVS-28: $38,600 (Pro 4x2 regular cab 6.6 ft) to $84,400.

### Current offers (not re-read today; reused)

| Figure | Value | Truck | Source id | Read on |
|---|---|---|---|---|
| Cash back | $4,500 ($3,000 customer cash + $1,500 bonus), 2026 XLT; NY area also STX and Lariat; ends Nov 30 (Jan 4, 2027 in NY) | F-150 | Reused VEH-F150-03 | 2026-11-15 |
| Finance | 0% for 60 months + $500 bonus, 2026 except Raptor, ended Nov 16 in most regions (Dallas, LA to Nov 30); 1.9% for 60 months + $1,500 bonus to Nov 30 | F-150 | Reused VEH-F150-03 | 2026-11-15 |
| Lease | $499 a month, 36 months, $1,498 due, 2026 STX with 200A, to Nov 30 | F-150 | Reused VEH-F150-03 | 2026-11-15 |
| Cash | $8,250 ($6,250 purchase allowance + $2,000 bonus) on the 3.0L Duramax only; or 0% for 60 months + $2,000 on the diesel; not with GMC financing or lease; to Nov 30 | Sierra | Reused VEH-SIERRA-05 and VEH-SVS-03 (rechecked in a browser at ZIP 73301 on 2026-11-18, unchanged) | 2026-11-16 / 2026-11-18 |
| Denali diesel | $11,300 off an $80,719 example (14% under MSRP), participating dealers, to Nov 30 | Sierra | Reused VEH-SIERRA-05 | 2026-11-16 |
| Lease | $349 a month, 24 months, $5,649 due, 2026 Elevation crew cab 4WD 5.3L V8; gas Sierras get leases only | Sierra | Reused VEH-SIERRA-05 | 2026-11-16 |
| Military, first responder, college | Ford: new 2025 to 2027 Fords, end Jan 4, 2027, amount shown after verification (Ford's page lists the programs, no amounts, FVS-15). GM: 2025 to 2027 Sierra, to Jan 4, 2027, amount not published for the Sierra | both | FVS-15; Reused VEH-SIERRA-06/07 | 2026-11-18 / 2026-11-16 |

## B. How far under sticker each sells

| Figure | Value | Trim | Source id | Read on |
|---|---|---|---|---|
| Guide pay range, fair deal | XL, STX 2 to 3% under; XLT, Lariat 5 to 7% under; Tremor, King Ranch, Platinum 3 to 6% under; Raptor MSRP | F-150 | Reused price guide `pay.rows` (our estimate) | 2026-11-15 |
| Guide pay range, strong deal | XL, STX 6 to 8%; XLT, Lariat 10% or more; Tremor, King Ranch, Platinum 8 to 10%; Raptor "any discount" | F-150 | Reused price guide | 2026-11-15 |
| Guide pay range, fair | Pro 2 to 3% under; SLE, Elevation, SLT 5 to 7%; Denali, AT4, AT4X, Denali Ultimate 5 to 7% | Sierra | Reused Sierra guide `pay.rows` | 2026-11-16 |
| Guide pay range, strong | Pro 5% or more; SLE, Elevation, SLT 8 to 10%; Denali, AT4, AT4X, Denali Ultimate 8% or more | Sierra | Reused Sierra guide | 2026-11-16 |
| TrueCar average paid vs MSRP | 2026 XLT 5.6% under, Lariat 6.5% under (TrueCar's November figures) | F-150 | Reused VEH-F150-06 (truecar.com returned 403 today) | 2026-11-15 |
| TrueCar average paid vs MSRP | Pro about 2.1% under; SLE and Elevation about 4%; SLT and Denali about 7.5%; Denali, AT4, AT4X 5.4 to 7.5% | Sierra | Reused VEH-SIERRA-08 (403 today) | 2026-11-16 |
| iSeeCars dealer invoice vs MSRP | XL, STX styles: invoice 4.71% below MSRP in iSeeCars' ratio ((MSRP minus invoice) / invoice), which is 4.5% under MSRP; XLT, Lariat, Tremor, King Ranch, Platinum, Raptor 6.95% by that ratio, 6.5% under MSRP. Example: XLT 4x2 SuperCrew 5.5 ft MSRP $48,055, invoice $44,931 | F-150 | FVS-27 (computed here) | 2026-11-18 |
| iSeeCars dealer invoice vs MSRP | Pro styles 4.06% by iSeeCars' ratio (3.9% under MSRP), except Pro 4x4 regular cab 6.6 ft 6.63%; every other trim 6.27% (5.9% under MSRP). Example: SLT 4x2 crew cab MSRP $55,400, invoice $52,131 | Sierra | FVS-28 (computed here) | 2026-11-18 |
| CarWhere verified buyers | Median 4.4% ($3,500) under MSRP, 17 purchases, January to November 2026; middle half 1.9% to 10.8% under; 5.9% paid over MSRP; median MSRP $73,000; no by-trim breakdown | F-150 (all 2026) | FVS-29 (snapshot 2026-11-08) | 2026-11-18 |
| CarWhere verified buyers | 32 deals, average paid $66,795, about 9% under $73,354 average MSRP (averages, not medians); trims: AT4 about 8.8% (7 deals), AT4X about 7.7% (3), SLT about 11% (3), Elevation about 11.5% (3), Pro about 7.1% (1); as of 2026-06-16, so older | Sierra | FVS-30 | 2026-11-18 |
| Cox days of supply, end of October 2026 | F-150 93 days; Ford brand 112; GMC brand 110; industry 87. No Sierra-only figure (Silverado 1500: 99) | both | FVS-31 | 2026-11-18 |
| Cox days of supply, end of September 2026 | Ford 101 days vs industry 82 | F-150 | Reused VEH-F150-08 (Ford Authority) | 2026-11-15 |
| Edmunds "suggested price" / TMV | NOT READ (edmunds.com 403) | both | none | 2026-11-18 |

## C. Fuel economy, towing, power

### EPA fuel economy, 2026 (fueleconomy.gov web service, records saved in `epa/`)

Fuel cost is EPA's estimate at 15,000 miles a year; fueleconomy.gov price table on 2026-11-18: regular $4.00, midgrade $4.61, premium $5.01, diesel $6.13 a gallon.

| Powertrain | Drive | Comb (city/hwy) | Annual fuel cost | Record id | Source id | Read on |
|---|---|---|---|---|---|---|
| F-150 2.7L EcoBoost V6 | 4x2 | 21 (19/25) | $2,850 | 50092 | FVS-14 | 2026-11-18 |
| F-150 3.5L EcoBoost V6 | 4x2 | 20 (17/25) | $3,000 | 50093 | FVS-14 | 2026-11-18 |
| F-150 5.0L V8 | 4x2 | 19 (16/24) | $3,150 | 50094 | FVS-14 | 2026-11-18 |
| F-150 3.5L PowerBoost hybrid | 4x2 | 24 (23/25) | $2,500 | 50447 | FVS-14 | 2026-11-18 |
| F-150 2.7L EcoBoost V6 | 4x4 | 20 (18/23) | $3,000 | 50098 | FVS-14 | 2026-11-18 |
| F-150 3.5L EcoBoost V6 | 4x4 | 19 (17/23) | $3,150 | 50099 | FVS-14 | 2026-11-18 |
| F-150 5.0L V8 | 4x4 | 19 (16/24) | $3,150 | 50100 | FVS-14 | 2026-11-18 |
| F-150 3.5L PowerBoost hybrid | 4x4 | 23 (22/24) | $2,600 | 50097 | FVS-14 | 2026-11-18 |
| F-150 Tremor 3.5L / 5.0L | 4x4 | 18 (16/21) / 17 (15/20) | $3,350 / $3,550 | 50102 / 50103 | FVS-14 | 2026-11-18 |
| F-150 Raptor 3.5L High Output | 4x4 | 16 (14/18) | $3,750 | 50101 | FVS-14 | 2026-11-18 |
| F-150 Raptor R 5.2L supercharged V8 | 4x4 | 12 (10/15), premium | $6,250 | 50104 | FVS-14 | 2026-11-18 |
| Sierra 2.7L TurboMax I4 | 2WD | 20 (18/21); 19 (17/21) with Sport Mode record | $3,000; $3,150 | 49364; 49363 | FVS-14 | 2026-11-18 |
| Sierra 5.3L V8 | 2WD | 17 (16/20); 18 (16/21) with Sport Mode record | $3,550; $3,350 | 49366; 49365 | FVS-14 | 2026-11-18 |
| Sierra 3.0L Duramax diesel | 2WD | 25 (23/28) | $3,700 | 49367 | FVS-14 | 2026-11-18 |
| Sierra 2.7L TurboMax I4 | 4WD | 18 (17/20); 17 (17/18) Sport Mode record | $3,350; $3,550 | 49401; 49403 | FVS-14 | 2026-11-18 |
| Sierra 5.3L V8 | 4WD | 16 (15/18); 17 (15/19) Sport Mode record; 17 (15/19) FFV (E85) record | $3,750; $3,550; $3,550 | 49413; 49411; 49404 | FVS-14 | 2026-11-18 |
| Sierra 6.2L V8 (premium) | 4WD | 16 (15/19) | $4,700 | 49406 | FVS-14 | 2026-11-18 |
| Sierra 3.0L Duramax diesel | 4WD | 24 (22/26) (Sport Mode record) | $3,850 | 49415 | FVS-14 | 2026-11-18 |
| Sierra AT4X 6.2L / AT4X diesel | 4WD | 15 (14/16) / 19 (19/20) | $5,000 / $4,850 | 49408 / 49417 | FVS-14 | 2026-11-18 |

Fuel tank and range (EPA combined x tank, computed here): F-150 36 gal (23 gal on the 122.5-in wheelbase regular cab; 30.6 gal hybrid); Sierra 24 gal (28 gal regular cab per KBB). 4x4 range: F-150 2.7L 720 mi, 3.5L 684 mi, 5.0L 684 mi, hybrid 704 mi; Sierra 2.7L 432 mi, 5.3L 384 mi (408 mi on the 17 mpg record), 6.2L 384 mi, diesel 576 mi. Tank sources: Ford spec PDF (FVS-03) and KBB (FVS-17 for the Sierra).

### Towing, payload, power

| Figure | Value | Config | Source id | Read on |
|---|---|---|---|---|
| F-150 2.7L EcoBoost | 325 hp @ 5,500, 400 lb-ft; tow 8,400 (4x2) / 8,200 (4x4); payload 1,775 / 1,715 | | FVS-03 (Ford spec PDF V1.1, 03/31/26) | 2026-11-18 |
| F-150 5.0L V8 | 400 hp, 410 lb-ft; tow 12,800 lb (4x2 and 4x4, SuperCrew, Max Tow package); payload 2,235 (4x2) / 2,080 (4x4) | | FVS-03 | 2026-11-18 |
| F-150 3.5L EcoBoost | 400 hp, 500 lb-ft; tow 13,300 (4x2) / 13,500 (4x4); payload 2,440 (4x2) / 2,175 (4x4) | SuperCrew with Max Tow/Haul (53T) and Max Tow Axle | FVS-03 | 2026-11-18 |
| F-150 PowerBoost hybrid | 430 hp, 570 lb-ft; tow 12,400 (4x2) / 11,600 (4x4); payload 2,045 / 1,740. Ford's page quotes "up to 11,600" for hybrid tow today; KBB says hybrid 11,200 | | FVS-03, FVS-01, FVS-18 | 2026-11-18 |
| F-150 Raptor 3.5L HO | 450 hp, 510 lb-ft (premium); tow 8,200; payload 1,405 | 4x4 | FVS-03 | 2026-11-18 |
| F-150 Raptor R 5.2L supercharged | 720 hp, 640 lb-ft (premium); tow 8,700; payload 1,410 (37-in tires) | 4x4 | FVS-03 | 2026-11-18 |
| F-150 max tow / max payload overall | 13,500 lb (3.5L EcoBoost 4x4 SuperCrew 6.5-ft box with Max Trailer Tow) / 2,440 lb (3.5L 4x2) | | FVS-03, FVS-01, FVS-18 | 2026-11-18 |
| Sierra 2.7L TurboMax | 310 hp @ 5,600, 430 lb-ft | | FVS-17 | 2026-11-18 |
| Sierra 5.3L V8 | 355 hp @ 5,600, 383 lb-ft | | FVS-17 | 2026-11-18 |
| Sierra 6.2L V8 | 420 hp @ 5,600, 460 lb-ft, premium | | FVS-17 | 2026-11-18 |
| Sierra 3.0L Duramax diesel | 305 hp @ 3,750, 495 lb-ft | | FVS-17 | 2026-11-18 |
| Sierra max tow | "13,300 lbs with the turbodiesel in RWD"; 6.2L 4WD only "13,200 lbs" (KBB main page). KBB spec table by trim: crew cab SLT 5.3L 13,000, Denali 13,100, AT4 diesel 13,000, AT4X diesel 13,100, Denali Ultimate 6.2L 13,100 | | FVS-17, FVS-19 | 2026-11-18 |
| Sierra max payload | "Up to 2,260 lbs with the 2.7L"; 5.3L "up to 2,180". KBB table: Regular cab Pro 2,090; crew cab SLT 1,910; AT4 diesel 1,620; AT4X diesel 1,380 | | FVS-17, FVS-19 | 2026-11-18 |
| Sierra tow ratings differ across sources | 13,100 (cars.com SLT 4WD), 13,300 (KBB, TrueCar summary); GM Authority (summary) lists 2026 diesel 13,300 and 2026 6.2L 13,100, payloads 1,880 and 1,870 | | FVS-17, FVS-20, FVS-51 (snippet) | 2026-11-18 |

Both trucks: 10-speed automatic on the V8s; the Sierra 2.7L pairs with an 8-speed (EPA records: "Auto 8-spd"). Ford: 10-speed SelectShift, hybrid uses a 10-speed Modular Hybrid (FVS-03).

## D. Space

| Figure | F-150 | Sierra 1500 | Config | Source id | Read on |
|---|---|---|---|---|---|
| Rear legroom, crew cab | 43.6 in (SuperCrew); SuperCab 33.5 in | 43.4 in crew cab; 35.2 in double cab | | FVS-03; FVS-17 | 2026-11-18 |
| Front legroom | 43.9 in | 45 in (cars.com spec page, SLT; page has internal conflicts) | | FVS-03; FVS-20 | 2026-11-18 |
| Rear headroom, crew cab | 40.4 in | NOT FOUND | | FVS-03 | 2026-11-18 |
| Bed volume | 52.8 cu ft (5.5-ft), 62.3 (6.5-ft), 77.4 (8-ft) | About 63 cu ft on the short (5.75-ft, 70-in floor) bed per cars.com; 62.9 and 71.7 cu ft (standard bed) in search-result text for Auto123's Canadian listings; KBB: carbon bed holds "up to 63.9". Official GM figure NOT FOUND | | FVS-03; FVS-20, FVS-47 (summary) | 2026-11-18 |
| Bed length | 5.5 ft (67.1 in floor), 6.5 ft (78.9 in), 8 ft (97.6 in); 50.6 in between wheelhouses | 5.75 ft, 6.5 ft, 8 ft (KBB spec table by trim: crew cab SLT/Elevation/Denali/AT4 6.5 ft; AT4X and Denali Ultimate 5.75 ft) | | FVS-03; FVS-17, FVS-19 | 2026-11-18 |
| Wheelbase | SuperCrew 145.4 in (5.5-ft box), 157.2 in (6.5-ft box); SuperCab 145.4; regular cab 122.8 / 141.5 | Crew cab 157 in (6.5-ft bed), 148 (AT4X 5.75-ft), 147 (Denali Ultimate); double cab 147; regular cab 140 | | FVS-03; FVS-19 | 2026-11-18 |
| Overall length | SuperCrew 232.0 in (5.5-ft), 243.8 to 243.9 in (6.5-ft) | Crew cab 241.5 in (6.5-ft); AT4 242.5; AT4X 234 | | FVS-03; FVS-17, FVS-19 | 2026-11-18 |
| Ground clearance | SuperCrew 4x2 8.2 in, 4x4 9.8 in (5.5-ft); 6.5-ft 4x4 8.8 in; Tremor 10.7; Raptor 11.9 / 13.1 | 8 in minimum (crew cab SLT, Elevation, Denali); AT4 11 in; AT4X 11.5 in | | FVS-03; FVS-19 | 2026-11-18 |
| Fuel tank | 36 gal (23 gal on 122.5-in wheelbase; hybrid 30.6) | 24 gal (crew and double cab); 28 gal regular cab | | FVS-03; FVS-17, FVS-19 | 2026-11-18 |
| Seating | 3 (regular cab); 5 or 6 (SuperCab, SuperCrew) | three- or six-seat per Cars.com | | FVS-03; FVS-24 | 2026-11-18 |
| Curb weight | NOT FOUND | 4,826 lb (cars.com 4WD SLT crew cab 147 in; page conflicts on engine) | | FVS-20 | 2026-11-18 |

The Sierra's cargo-bed volume figures are not from GM and the sources disagree on method (62.9 vs 71.7); do not chart bed volume for the Sierra without an official number.

## E. Reliability

### E1. NHTSA owner complaints, model years 2019 to 2025

Method (same as the reference pages): NHTSA complaints API (`complaintsByVehicle`), read 2026-11-18, raw JSON saved; every model-name listing for the car read; deduplicated by `odiNumber`; only records with a Vehicle product whose productYear equals the requested model year and whose productModel starts with the car's name.

- F-150 listings read: "F-150" (2019 76, 2020 62; later years HTTP 400); "F-150 SUPER CREW" (2019 953, 2020 506, 2021 1,058, 2022 609); "F-150 (SUPER CREW) GAS" (2023 425, 2024 200, 2025 111, 2026 16); "F-150 SUPER CREW HEV" (2021 274, 2022 218); "F-150 (SUPER CREW) HEV" (2023 98, 2024 39, 2025 20, 2026 6). Aliases "F-150 SUPER CAB", "SUPERCAB", "REGULAR CAB", "(SUPER CAB) GAS", "(REGULAR CAB) GAS" return the same records as the SUPER CREW names. All records come back with productModel "F-150" or "F-150 HYBRID"; nothing with "Lightning" appeared, so nothing was excluded. The plain "F-150" listing (76 and 62) does not overlap the SUPER CREW sets (checked: 953 + 76 = 1,029 distinct for 2019).
- Sierra listings read: "SIERRA 1500" (2019 666, 2020 488, 2021 609, 2022 614, 2023 522, 2024 386, 2025 132, 2026 90). "SIERRA 1500 LIMITED" returns the same 614 as 2022. Not counted: "SIERRA DENALI" (2019 26, 2020 11; separate NHTSA model name, unclear whether 1500 or HD; adding them would change 2019 to 692 and 2020 to 499 complaints, rates 401 and 278). A year with no listing returns HTTP 400.
- Complaints for 2026 (not charted): F-150 22 (16 gas + 6 hybrid), Sierra 90.

### E2. U.S. sales (calendar year, units)

| Calendar year | Ford F-Series (all, includes Super Duty and Lightning) | F-150 estimated at 59% | Sierra LD (light-duty) | Source |
|---|---|---|---|---|
| 2019 | 896,526 | 528,950 | 172,452 | FVS-04 (GCBC); FVS-08 (BSC 2020) |
| 2020 | 787,372 | 464,549 | 179,239 | FVS-04; FVS-08 |
| 2021 | 726,003 | 428,342 | 178,346 | FVS-04; FVS-09 (BSC 2021) |
| 2022 | 653,957 | 385,835 | 142,404 | FVS-04; FVS-10 (BSC 2023) |
| 2023 | 750,789 | 442,966 | 189,288 | FVS-04; FVS-10 |
| 2024 | 765,649 | 451,733 | 214,819 | FVS-04 (GCBC; search result agrees, includes 33,510 Lightning); FVS-07 (BSC 2025) |
| 2025 | 828,832 (Ford's release; GCBC prints 828,842) | 489,011 | 230,156 | FVS-05 (Ford 2025 full year); FVS-07 |

All read 2026-11-18. Ford does not publish F-150-only sales (GCBC and Ford's releases both say so; FVS-05 gives only the F-150 Hybrid, 84,934 in 2025). Estimate method reused from the F-150 vs Silverado page: F-150 = 59% of F-Series. Checked here from Ford's Q3 2026 release (FVS-06): Q3 production F-Series 266,777, Super Duty 110,275, so F-150 = 156,502 = 58.66% (rounded to 59%). That is a production share in one quarter, not a sales share; Ford's F-Series sales line includes Super Duty and Lightning. The Sierra figure is "Sierra LD" only (Sierra HD and Sierra EV are separate rows; Sierra total 2025 356,218 = HD 118,066 + LD 230,156 + EV 7,996).

### E3. Complaints per 100,000 sold (complaints for model year Y over sales in calendar year Y)

| Model year | F-150 complaints | F-150 per 100k (59% estimate) | F-150 per 100k (all F-Series) | Sierra complaints | Sierra per 100k |
|---|---|---|---|---|---|
| 2019 | 1,029 | 194.5 | 114.8 | 666 | 386.2 |
| 2020 | 568 | 122.3 | 72.1 | 488 | 272.3 |
| 2021 | 1,332 | 311.0 | 183.5 | 609 | 341.5 |
| 2022 | 827 | 214.3 | 126.5 | 614 | 431.2 |
| 2023 | 523 | 118.1 | 69.7 | 522 | 275.8 |
| 2024 | 239 | 52.9 | 31.2 | 386 | 179.7 |
| 2025 | 131 | 26.8 | 15.8 | 132 | 57.4 |
| **2023 to 2025 pooled** | **893 over 1,383,710 est. sold** | **64.5** | **38.1** (893 over 2,345,270) | **1,040 over 634,263** | **164.0** |

Cross-check against the reference pages (same method, run 2026-11-16 and 2026-11-18): F-150 2023 to 2025 "889 over 1,383,709, about 64" and Sierra "1,038 over 634,263, 164"; today's counts are 4 and 2 higher because NHTSA added complaints. Every model year is within 1.2 per 100,000 of the reference charts (F-150: 194, 122, 311, 214, 117, 53, 27; Sierra: 386, 271, 341, 430, 275, 180, 57).

- Against the 59% estimate the Sierra is higher than the F-150 in every model year 2019 to 2025 (2021 is the closest: F-150 311.0, Sierra 341.5; against all F-Series sales the F-150 rate is lower still).
- Sensitivity: the F-150 rate would equal the Sierra's 164 only if F-150 sales were about 23% of F-Series (893 / (164.0/100,000) = 544,500 sold over 2023 to 2025, against 2,345,270 F-Series). The order holds at any plausible share.
- Nameplate quirks: Ford F-Series sales include Super Duty and Lightning; the F-150 complaints include the hybrid (PowerBoost) listings, which make up 157 of the 893 (2023 to 2025: 98 + 39 + 20). Model-year complaints also depend on how long a model year has been on the road (2025 is young, 2026 not charted).

### E4. Components, 2023 to 2025 model years (complaints per 100,000 sold; F-150 on the 59% estimate)

NHTSA component labels, one complaint can name several. Grouped as the reference pages grouped them (engine and engine cooling together; fuel labels together).

| Component group | F-150 complaints | F-150 per 100k | Sierra complaints | Sierra per 100k |
|---|---|---|---|---|
| Engine (incl. engine cooling) | 78 | 5.6 | 532 | 83.9 |
| Power train (transmission, axles, driveline) | 301 | 21.8 | 201 | 31.7 |
| Electrical | 209 | 15.1 | 136 | 21.4 |
| Structure | 32 | 2.3 | 133 | 21.0 |
| Fuel and propulsion | 36 | 2.6 | 71 | 11.2 |
| Forward collision avoidance (automatic emergency braking) | 84 | 6.1 | 40 | 6.3 |
| Service brakes | 105 | 7.6 | 36 | 5.7 |
| Exterior lighting | 89 | 6.4 | 29 | 4.6 |
| Steering | 29 | 2.1 | 24 | 3.8 |
| Visibility and wipers | 50 | 3.6 | 24 | 3.8 |

The Sierra's engine complaints are about 15 times the F-150's per truck sold (83.9 against 5.6 per 100,000). The F-150's power train complaints (mostly the 10-speed) are 301 of its 893 (34%). The F-150 is higher only in service brakes (7.6 against 5.7) and exterior lighting (6.4 against 4.6); forward collision avoidance is level (6.1 against 6.3). The full model-year by component tables are in the Raw tables section.

Keyword counts in complaint text (method: case-insensitive search of the NHTSA summary text; counts overlap with component counts):
- Sierra "deflector": 66 complaints (2022 27, 2023 30, 2024 9); "grille" or "grill ": 198 (2022 91, 2023 80, 2024 26; 197 of them 2022 to 2024). Without the "grille" complaints the Sierra 2023 to 2025 rate is 147.3 (106 of 1,040 removed), matching the 147 on the reference page. F-150 "deflector": 5 complaints in all years.
- Sierra engine complaints 2023 to 2025: 532, of which 118 mention "6.2"; without those 414, or 65.3 per 100,000, against 5.6 for the F-150. (The reference page counted differently and got 62.)
- Sierra "lifter": 298 complaints (2019 103, 2020 76, 2021 76, 2022 20, 2023 10, 2024 9, 2025 4). F-150 "lifter": 1.
- Sierra "6.2" anywhere in the text: 373 (2019 to 2025). Sierra "5.3": 42.
- F-150 "10-speed": 157 (2019 88, 2020 31, 2021 24, 2022 10, 2023 3, 2024 1). F-150 "shift" or "transmission": 1,264 of 3,976 deduplicated complaints (2019 to 2025 model years, 2019 512, 2020 243, 2021 254, 2022 117, 2023 76, 2024 42, 2025 20). Sierra "shift" or "transmission": 631 of 3,517.
- Crash and fire flags in complaints, 2023 to 2025: F-150 48 crash, 13 fire; Sierra 13 crash, 5 fire.

### E5. Recalls by model year (NHTSA `recallsByVehicle`, deduplicated by campaign number, read 2026-11-18)

| Model year | F-150 ("F-150" + "F-150 HYBRID") | Sierra 1500 (GM campaigns) |
|---|---|---|
| 2019 | 9 | 10 |
| 2020 | 11 | 12 |
| 2021 | 29 | 7 |
| 2022 | 23 | 6 |
| 2023 | 13 | 3 |
| 2024 | 11 | 1 |
| 2025 | 16 (14 under "F-150" + 2 under "F-150 HYBRID": 25V-199, 25V-489) | 0 (the one listing, 25V-876, is Rollx Vans' wheelchair conversion; left out as the Sierra guide does) |
| 2026 | 8 | 2 (26V-114 missing owner's manual, 26V-289 transfer case) |
| 2023 to 2026 total | 48 | 6 |
| 2027 | 3 (26V-578, 26V-655, 26V-689) | HTTP 400 (no listing) |

The F-150 price guide counts 14 for 2025 (no hybrid); the reference comparison counts 16 (with hybrid). Counts match both references otherwise (F-150 9, 11, 29, 23, 13, 11, 16, 8; Sierra 10, 12, 7, 6, 3, 1, 0, 2). Notable campaigns: F-150 hub bolt 23V-896 and 25V-512 (Trailer Tow Max Duty, 9.75-in axle), 3.5L/2.7L engine campaigns 24V-851 (cup plug; listed as 24V851 in the 2024 and 2025 results), 25V-198, 25V-344 (connecting rods, some 2025), fuel tank mounting 26V-578 (2023 to 2027); Sierra 25V-274 (6.2L, 2021 to 2024; 597,571 vehicles across GM models), 24V-797 (2020 to 2022 diesel transmission valve; 26V-083 covers repair errors), 26V-289 (2026 4WD transfer case).

**Correction for the existing Sierra pages: recall 25V-060** (received 2025-02-06; NHTSA lists it against model year 2022 Sierra 1500): "GM is recalling certain 2022 GMC Sierra 1500 vehicles equipped with chrome front grille deflectors. The attachments that hold the front grille deflectors in place may fracture, resulting in grille detachment" (consequence: "A detached front grille deflector may become a road hazard"; 70,768 vehicles; remedy: dealers reinforce or repair the attachment points; owner letters mailed March 17, 2025). The Sierra vs Silverado page and the Sierra guide say there is no recall for the grille deflector. There is one, for 2022 chrome deflectors only; the 2023 and 2024 complaints (80 and 26 mention a grille) have no recall of their own on the 2023 and 2024 lists. This is counted in the 2022 count of 6. Source FVS-13 (campaign endpoint), 2026-11-18.

### E6. Other reliability signals

| Signal | F-150 | Sierra 1500 | Favors | Source id | Read on |
|---|---|---|---|---|---|
| Consumer Reports predicted reliability, 2026 | About average (2023 to 2025 models; 9 recalls listed) | Less reliable than the average new car (2023 to 2025 models) | F-150 | Reused VEH-F150-19 / VEH-F1S-24 (F-150); VEH-SIERRA-26 / VEH-SVS-20 (Sierra); consumerreports.org 403 today | 2026-11-15 / 2026-11-16 |
| J.D. Power 2026 Vehicle Dependability Study, brand, problems per 100 three-year-old vehicles | Ford 228 | GMC 229 (Chevrolet 178, industry 204) | Even (Ford by 1) | FVS-22 (Cars.com article extract) | 2026-11-18 |
| J.D. Power 2026 VDS, large light-duty pickups | Tied third | Tied third (Ram 1500 first, Silverado second) | Even | Reused VEH-F1S-21 / VEH-SVS-19 (Pickup Truck Talk, secondary; page 403 today); FVS-22 extract lists "Ram 1500, Chevrolet Silverado, Ford F-150 (tie), and GMC Sierra (tie)" | 2026-11-18 |
| RepairPal rating | 3.5 of 5, 7th of 17 full-size trucks | 3.5 of 5, 3rd of 17 | Sierra (rank) | FVS-32 (F-150 page); FVS-33 (Sierra page) | 2026-11-18 |
| RepairPal annual repair and maintenance cost | $788; 0.28 unscheduled visits a year; 15% severe | $727; 0.2 visits; 15% severe | Sierra | FVS-32; FVS-33 | 2026-11-18 |
| iSeeCars chance of reaching 200,000 miles | 25.0% (0.25028); average lifespan 163,092 mi | 33.3% (0.33262); 174,737 mi | Sierra | FVS-34; FVS-35 | 2026-11-18 |
| iSeeCars reliability score | 8.56 of 10 (hybrid has its own lower overall 7.6) | 8.76 of 10 | Sierra | FVS-34; FVS-35 | 2026-11-18 |
| NHTSA complaints per 100,000 sold, 2023 to 2025 MY | about 64.5 (estimate); 38.1 against all F-Series sales | 164.0 | F-150 | Section E3 | 2026-11-18 |
| NHTSA recalls, 2023 to 2026 MY | 48 | 6 | Sierra | Section E5 | 2026-11-18 |
| J.D. Power 2026 Initial Quality | F-150 first among light-duty pickups (Ford Authority headline in search results) | not found | (F-150) | snippet only (search result title), FVS-45 | 2026-11-18 |

Known issues, as covered by named sources:
- 6.2L V8 (Sierra Denali, AT4X, Denali Ultimate option): recall 25V-274 (2021 to 2024 L87) and NHTSA engineering analysis EA26005, opened 2026-08-20, 997,743 vehicles, 2021 to 2026 L87, 499 post-remedy engine-failure complaints (473 got new oil, 26 got complete engines), 191 failures in engines built after May 2024, 6,953 GM-reported post-remedy incidents (Motor1 extract, FVS-36). Status as of 2026-11-18: GM's response to NHTSA's September 15 information request was due November 13; no recall decision or closure found (search summary, FVS-37). GM Authority's November article refused a read.
- Lifters, 5.3L and 6.2L V8s: Harrison v. General Motors LLC (E.D. Michigan, filed December 2021) covers Sierra and Sierra 1500 2014 to present with 5.3L, 6.0L or 6.2L V8s; February 28, 2026 the judge denied a motion to sever AFM and DFM claims. No recall (CarComplaints, FVS-38).
- F-150 10-speed shifting: owner-reported (Pickup Truck Talk, reused VEH-F150-17); 157 NHTSA complaints name it. No recall.

## F. Resale

| Figure | F-150 | Sierra 1500 | Source id | Read on |
|---|---|---|---|---|
| Value lost in 3 years, iSeeCars | 18.9% (hybrid 27.4%) | 27.8% | FVS-39 (F-150 page); FVS-40 (Sierra page) | 2026-11-18 |
| Value lost in 5 years, iSeeCars | 38.6% (hybrid 44%) | 39.5% | FVS-39; FVS-40 | 2026-11-18 |
| Full-size pickup class average, 3 / 5 years | 23.7% / 37.0% | 23.7% / 37.0% | FVS-39; FVS-40 | 2026-11-18 |
| All vehicles average, 3 / 5 years | 24.8% / 41.7% | 24.8% / 41.7% | FVS-39; FVS-40 | 2026-11-18 |
| Median asking price, used, by model year (CarWhere, snapshot 2026-11-14; medians only, no listing counts used) | 2022 $34,980; 2023 $39,482; 2024 $42,756; 2025 $44,211 | 2022 $38,690; 2023 $41,032; 2024 $43,387; 2025 $45,133 | FVS-41 (F-150 pages); FVS-42 (Sierra pages) | 2026-11-18 |
| Average asking price, used (CarGurus, footnote "as of May 3, 2026" but prices differ from the guides' November figures) | 2021 $31,442; 2022 $35,625; 2023 $40,384; 2024 $44,452; 2025 $47,894 | 2021 $33,560; 2022 $39,869; 2023 $43,103; 2024 $45,883; 2025 $46,744 | FVS-43; FVS-45 | 2026-11-18 |
| Average asking price, used (guides' figures) | 2022 $35,709; 2023 $40,476; 2024 $44,549; 2025 $47,951 | 2022 $39,967; 2023 $43,228; 2024 $46,008; 2025 $46,907 | Reused VEH-F150-11; VEH-SIERRA-16 | 2026-11-15 / 2026-11-16 |
| XLT share of used F-150 listings (2023 model year) | 49.8% | | FVS-41 | 2026-11-18 |
| KBB best resale value award, full-size pickup | Toyota Tundra (neither truck) | same | Reused VEH-F150-25 | 2026-11-15 |
| CPO | Ford Blue Advantage Gold: 172-point inspection; 6 model years or less, 80,000 miles or less; 12-month/12,000-mile comprehensive; 7-year/100,000-mile powertrain; 7 years roadside; 14-day/1,000-mile money back. Blue Certified: 139-point; 10 years or less, 150,000 miles or less; 90-day/4,000-mile; 90 days roadside | GM CarBravo certified: 12-month/12,000-mile bumper-to-bumper (Sierra guide, VEH-SIERRA-18; carbravo.com 403 today). Search results disagree on whether CarBravo carries any powertrain cover (ConsumerAffairs: none; Cars.com: mirrors Ford Gold) | FVS-16 (Ford); Reused VEH-SIERRA-18; FVS-47 (search summary) | 2026-11-18 |
| New-truck warranty | 3 yr/36,000 mi bumper-to-bumper; 5 yr/60,000 mi powertrain; hybrid/electric components 8 yr/100,000 mi; aluminum body panels 5 yr; roadside 5 yr/60,000 mi (Ford spec PDF) | GMC powertrain 5 yr/60,000 mi (Sierra guide, VEH-SIERRA-19; gmc.com 403 today) | FVS-03; Reused VEH-SIERRA-19 | 2026-11-18 / 2026-11-16 |

The Sierra's used asking prices carry a trim-mix effect (more Denali and AT4 in the Sierra mix); the Sierra reference page says so.

## G. Safety

### NHTSA 5-Star, 2026 (SafetyRatings API, read 2026-11-18; source FVS-12)

| Vehicle (id) | Overall | Frontal | Side | Rollover (risk) |
|---|---|---|---|---|
| F-150 SuperCrew gas 4x4 (21411) | 5 | 5 (driver 5, passenger 5) | 5 | 4 (19.1%) |
| F-150 SuperCrew gas 4x2 (21410) | 5 | 5 (5/5) | 5 | 4 (16.4%) |
| F-150 SuperCab gas 4x4 (21409) | 5 | 5 (driver 4, passenger 5) | 5 | 4 (19.1%) |
| F-150 regular cab gas 4x2 (21408) | 5 | 5 (driver 4, passenger 5) | 5 | 4 (16.4%) |
| F-150 SuperCrew hybrid 4x4 (21412) | 5 | 5 (5/5) | 5 | 4 (rollover possibility printed as 0.0) |
| Sierra 1500 crew cab 4WD (21849) | 4 | 4 (driver 5, passenger 4) | 5 | 4 (19.8%) |
| Sierra 1500 crew cab RWD (21848) | 5 | 4 (driver 5, passenger 4) | 5 | 4 (19.1%) |
| Sierra 1500 extended cab 4WD / RWD (21847 / 21846) | 5 | 5 | 5 | 4 (19.1%) |
| Sierra 1500 regular cab 4WD / RWD (21845 / 21844) | 5 | 5 | 5 | 4 (19.1%) |

Vehicle descriptions as NHTSA prints them ("PU/CC", "PU/EC", "PU/RC"). The Sierra crew cab RWD prints overall 5 with frontal 4, as the API returns it. NHTSA's driver-assistance fields: Sierra lists electronic stability control Standard, forward collision warning "Standard & Optional" on crew cabs, lane departure warning Standard; the F-150 records list stability control Standard and forward collision warning and lane departure warning "No" (this appears to describe NHTSA's recommended-technology listing, not Ford's equipment; Ford's order guide and KBB say automatic emergency braking is standard, FVS-48 summary). Also noted by NHTSA on the 2026 pages: complaints 16 (F-150 gas), 6 (hybrid), 90 (Sierra); Sierra investigation count 1 (EA26005).

### IIHS, 2026 crew cab (read 2026-11-18)

| Test | F-150 crew cab (FVS-25) | Sierra 1500 crew cab (FVS-26) |
|---|---|---|
| Small overlap front | Good (driver Good on a 2021 XL SuperCrew, passenger Good on a 2021 XLT SuperCrew); applies to 2021 to 2026 | Marginal (driver Good, passenger Marginal), tested on a 2019 Chevrolet Silverado 1500 LT crew cab 2WD; applies 2019 to 2026 |
| Moderate overlap front, updated | Poor, tested on a 2023 F-150 SuperCrew 4WD; applies 2023 to 2026; not to the extended cab | Not rated on the page |
| Side, updated | Good, 2023 F-150 XL SuperCrew 4WD | Acceptable, tested on a 2023 Chevrolet Silverado 1500 LT crew cab 4WD |
| Headlights | Good (XL, STX, XLT, Raptor: LED reflector, not curve-adaptive); Acceptable (Lariat, King Ranch, Platinum, Raptor: LED projector, curve-adaptive) | Not rated on the page |
| Pedestrian front crash prevention | Good, standard system and optional system | Acceptable, standard system, all 2024 to 2026 |
| Vehicle-to-vehicle front crash prevention | Poor, "with optional equipment" (optional on XLT and up; standard system on XL and STX per IIHS page) | Not rated on the page |
| LATCH child-seat anchors | Marginal (XLT SuperCrew, cloth) | Marginal (Denali, leather) |
| Award | No Top Safety Pick listed on the page | None listed on the page |

IIHS carries the Silverado's 2019 small-overlap and 2023 side tests to the Sierra because the two were redesigned together for 2019 (page text). Reference pages say neither truck is a 2026 Top Safety Pick (VEH-F1S-41, VEH-SVS-40/41).

## H. Reviews (each publisher's own score; not averaged)

| Publisher | F-150 | Sierra 1500 | Class rank cited | URL | Source id | Read on |
|---|---|---|---|---|---|---|
| Edmunds (expert, out of 10) | 8.0 | 6.7 | F-150 1st of 5 large trucks; Sierra 5th | https://www.edmunds.com/ford/f-150/ ; https://www.edmunds.com/gmc/sierra-1500/ | Reused VEH-F150-21 (read in a browser 2026-11-15) and VEH-SIERRA-10 (2026-11-16); VEH-F1S-14 lists 2026 F-150 8.0 (1st), 2027 Silverado 7.7, 2027 Ram 1500 7.5, 2026 Tundra 7.0, 2026 Sierra 6.7. Edmunds returned 403 today. Search-result text today contradicts the F-150 figure (see Contradictions) | 2026-11-15 / 2026-11-16 |
| Edmunds owner rating | not recorded for the F-150 in the guide | not recorded in the guide | | | VEH-F150-21, VEH-SIERRA-10 | |
| Kelley Blue Book (expert, out of 5) | 4.7; consumer 4.2 (60 reviews) | 4.3; consumer 4.0 (101 reviews) | F-150 #1 in best full-size trucks; Sierra tied #3 with the Silverado | https://www.kbb.com/ford/f150/2026/ ; https://www.kbb.com/gmc/sierra-1500/2026/ | FVS-18 (F-150), FVS-17 (Sierra); both read 2026-11-18 and match the guides | 2026-11-18 |
| U.S. News (out of 10) | 9.6 | 9.0 | F-150 1st of 6 full-size pickups; Sierra tied 3rd of 6 | https://cars.usnews.com/cars-trucks/ford/f-150 ; https://cars.usnews.com/cars-trucks/gmc/sierra-1500 | Reused VEH-F150-23, VEH-SIERRA-28; US News returned 503 today; a search summary today agrees the F-150 is 9.6 (FVS-45) | 2026-11-15 / 2026-11-16 |
| J.D. Power consumer rating (out of 100) | 83 | 80 | Sierra 5th among large light-duty pickups | https://www.jdpower.com/cars/2026/ford/f-150 ; https://www.jdpower.com/cars/2026/gmc/sierra-1500 | Reused VEH-F150-24, VEH-SIERRA-29, VEH-F1S-19 (Cybertruck 89, F-150 83, Silverado 82, Tundra 82); 403 today. A search summary says the Sierra "earned a 'great' rating with a 81/100" (see Contradictions) | 2026-11-15 / 2026-11-16 |
| J.D. Power sub-scores (quality and reliability, driving experience, resale) | NOT FOUND for the F-150 or Sierra (the Silverado page showed quality and reliability 84, VEH-F1S-19) | NOT FOUND | | | | |
| Cars.com (no numeric expert score; consumer rating) | consumer 4.5 of 5 from 2 reviews (100% recommend) | consumer 4.4 of 5 from 7 reviews (85% recommend) | | https://www.cars.com/research/ford-f_150-2026/ ; https://www.cars.com/research/gmc-sierra_1500-2026/ | FVS-23, FVS-24 | 2026-11-18 |

## I. What the trucks are like (fact list for a writer)

Powertrains and outputs:
- F-150 (Ford spec PDF, FVS-03; KBB FVS-18): 2.7L twin-turbo V6 325 hp/400 lb-ft; 5.0L V8 400 hp/410 lb-ft; 3.5L twin-turbo V6 400 hp/500 lb-ft; 3.5L PowerBoost full hybrid V6 430 hp/570 lb-ft; Raptor 3.5L High Output 450 hp/510 lb-ft; Raptor R 5.2L supercharged V8 720 hp/640 lb-ft. All with a 10-speed automatic. Ford sells no diesel F-150 (KBB cons: "No diesel option"). 2027: 3.0L V6 EcoBoost listed on the XL (Ford page FVS-02); an autoevolution headline in search results says the 2.7L is dropped and the 3.0L becomes the base engine (snippet, FVS-49).
- Sierra 1500 (KBB, FVS-17, FVS-19): 2.7L TurboMax I4 310 hp/430 lb-ft; 5.3L V8 355 hp/383 lb-ft; 6.2L V8 420 hp/460 lb-ft (premium); 3.0L Duramax turbodiesel I6 305 hp/495 lb-ft. 10-speed automatic on the V8s and diesel, 8-speed with the 2.7L (EPA records). Crew cab pairing in KBB's table: SLT and Denali 5.3L; AT4 and AT4X diesel; Denali Ultimate 6.2L; Pro, SLE, Elevation 2.7L.

Equipment, attributed:
- Ford, Pro Power Onboard: hybrid has it standard; 7.2 kW available on King Ranch and Platinum (Ford page extract, FVS-21); Cars.com's reviewer says the 7.2-kW generator "can power key household appliances" (FVS-23).
- Ford safety: Pre-Collision Assist with automatic emergency braking is standard on every 2026 trim per KBB and Ford's trim pages (search summary, FVS-48); IIHS lists the system as standard on XL and STX and optional above. Blind-spot monitoring and lane keeping assist standard per KBB (summary, FVS-48). 360-degree camera, heated seats and BlueCruise available on XLT (Ford guide, VEH-F150-01 and the pick text).
- GMC safety: GMC Pro Safety standard on every 2026 Sierra per J.D. Power's page text (search summary FVS-50); sources disagree on which alerts are trim-limited. IIHS lists rear automatic braking as optional.
- Sierra features: Google built-in 13.4-inch touchscreen from SLE, Super Cruise available (Sierra guide trims table); MultiPro six-position tailgate and carbon-fiber bed (KBB main page, FVS-18, via the Sierra comparison); Cars.com pros: "Cargo bed space and access", "A powerful V-8", "Available Super Cruise".

Faults named by publications:
- F-150: KBB cons "Top trim levels are expensive", "No diesel option" (FVS-18). Cars.com: "Brake pedal feels mushy and touchy in the hybrid", "Hybrid fuel economy is just average", "Ride can be firm"; reviewer recorded 18.3 mpg over about 300 miles against 23 combined; one owner calls SYNC 4 "not intuitive" (FVS-23). Pickup Truck Talk (reused VEH-F150-17): owner complaints of harsh 10-speed shifts. Recall history: 29 campaigns on 2021 and 23 on 2022 trucks.
- Sierra: KBB cons "Higher trims get expensive", "Firm ride in lower trims" (FVS-17). Cars.com cons: "Upper trims get pricey", "Nearly identical Chevrolet Silverado 1500 costs less", "Some lower-trim cabin parts appear in the top Denali Ultimate", "Google-based operating system can be finicky", "Outward visibility"; expert notes no factory towing mirrors on the Denali Ultimate, an offset rearview camera and no oil temperature gauge (FVS-24). The 6.2L investigation and lifter class action in E6; 2022 Sierras recalled for grille deflector attachments (25V-060).
- Reviewers' comparison: Edmunds' F-150 8.0 vs Sierra 6.7 (reused); KBB says the Sierra is mechanically the same as the Silverado (Sierra comparison, VEH-SVS-08).

---

## Raw tables: NHTSA complaints by model year and component group (2019 to 2025)

Source: `nhtsa/f150_dedup.json`, `nhtsa/sierra_dedup.json` (scripts `analyze.py`, `groups.py`).


**F-150: complaints by model year and component group** (a complaint can name several components, so columns do not sum to the total)

| Component group | 2019 | 2020 | 2021 | 2022 | 2023 | 2024 | 2025 |
|---|---|---|---|---|---|---|---|
| Engine (incl. engine cooling) | 306 | 113 | 133 | 59 | 45 | 25 | 8 |
| Power train | 529 | 247 | 463 | 243 | 196 | 72 | 33 |
| Electrical | 82 | 72 | 175 | 191 | 124 | 57 | 28 |
| Structure | 30 | 19 | 48 | 21 | 24 | 3 | 5 |
| Fuel and propulsion | 20 | 12 | 114 | 104 | 19 | 12 | 5 |
| Forward collision avoidance | 28 | 21 | 52 | 29 | 35 | 21 | 28 |
| Service brakes | 20 | 18 | 80 | 36 | 60 | 17 | 28 |
| Exterior lighting | 11 | 5 | 126 | 76 | 28 | 55 | 6 |
| Steering | 19 | 8 | 51 | 13 | 19 | 5 | 5 |
| Visibility and wipers | 29 | 59 | 147 | 51 | 32 | 10 | 8 |
| Unknown or other | 99 | 64 | 127 | 128 | 88 | 23 | 26 |
| **All complaints (deduplicated)** | 1029 | 568 | 1332 | 827 | 523 | 239 | 131 |

**Sierra 1500: complaints by model year and component group** (a complaint can name several components, so columns do not sum to the total)

| Component group | 2019 | 2020 | 2021 | 2022 | 2023 | 2024 | 2025 |
|---|---|---|---|---|---|---|---|
| Engine (incl. engine cooling) | 337 | 261 | 378 | 271 | 240 | 224 | 68 |
| Power train | 142 | 99 | 147 | 116 | 97 | 74 | 30 |
| Electrical | 96 | 82 | 76 | 85 | 65 | 44 | 27 |
| Structure | 15 | 13 | 13 | 109 | 98 | 32 | 3 |
| Fuel and propulsion | 27 | 28 | 43 | 33 | 40 | 23 | 8 |
| Forward collision avoidance | 8 | 14 | 6 | 25 | 15 | 14 | 11 |
| Service brakes | 112 | 53 | 25 | 31 | 18 | 11 | 7 |
| Exterior lighting | 11 | 3 | 2 | 1 | 11 | 15 | 3 |
| Steering | 43 | 40 | 35 | 13 | 14 | 7 | 3 |
| Visibility and wipers | 8 | 15 | 7 | 1 | 7 | 10 | 7 |
| Unknown or other | 45 | 45 | 47 | 77 | 56 | 36 | 15 |
| **All complaints (deduplicated)** | 666 | 488 | 609 | 614 | 522 | 386 | 132 |

Unmerged NHTSA labels (2023 to 2025) with counts are in `nhtsa/tables.txt`. Sales table: `sales.csv`.

---


## Sources

All read 2026-11-18 by me. "WebFetch extract" = the page was fetched and a model-written extract returned (not a browser view); "curl" = direct API or file download; "search summary" = web-search result text, not a page I opened.

| id | URL | publisher: page title | what it supports and how it was read | date read |
|---|---|---|---|---|
| VEH-FVS-01 | https://www.ford.com/trucks/f150/2026/ | Ford: 2026 F-150 | trims, engines, tow 13,500 and payload 2,440 claims; no prices printed; WebFetch extract | 2026-11-18 |
| VEH-FVS-02 | https://www.ford.com/trucks/f150/ | Ford: F-150 (2027 model page) | 2027 XL with 3.0L V6 EcoBoost, max gas tow 13,500, payload 2,430, hybrid up to 12,100; no prices; WebFetch extract | 2026-11-18 |
| VEH-FVS-03 | https://www.fromtheroad.ford.com/content/dam/fordmediasite/us/en/library/2026/specs/2026_Ford_F150_Specs.pdf | Ford: 2026 F-150 technical specifications V1.1 (03/31/26) | outputs, tow, payload, tank, dimensions, ground clearance, legroom, bed volume, warranty; curl download read with pdftotext (text in `specs/f150.txt`) | 2026-11-18 |
| VEH-FVS-04 | https://www.goodcarbadcar.net/ford-f150-f-series-sales-2025-2026-august/ | Good Car Bad Car: Ford F-Series sales | F-Series annual U.S. sales 2019 to 2025; says Ford publishes no F-150-only figure; page dated 2026-09-21; WebFetch extract | 2026-11-18 |
| VEH-FVS-05 | https://www.fromtheroad.ford.com/us/en/articles/2026/ford-2025-full-year-us-sales-results | Ford: 2025 full-year U.S. sales | F-Series 828,832 (+8.3%); F-150 Hybrid 84,934; no F-150 total; WebFetch extract | 2026-11-18 |
| VEH-FVS-06 | https://www.fromtheroad.ford.com/us/en/articles/2026/ford-2026-third-quarter-sales-results | Ford: 2026 third-quarter sales | Q3 production F-Series 266,777 and Super Duty 110,275; F-Series 561,508 sold through September; F-150 Hybrid 34,527 through September; WebFetch extract | 2026-11-18 |
| VEH-FVS-07 | https://www.best-selling-cars.com/usa/2025-full-year-usa-gm-buick-cadillac-chevrolet-gmc-car-sales-by-model/ | Best-Selling-Cars: 2025 GM sales by model | Sierra LD 230,156 (2025) and 214,819 (2024); Sierra HD and EV rows; WebFetch extract | 2026-11-18 |
| VEH-FVS-08 | https://www.best-selling-cars.com/usa/2020-full-year-usa-gm-sales-chevrolet-buick-cadillac-gmc/ | Best-Selling-Cars: 2020 GM sales | Sierra LD 179,239 (2020), 172,452 (2019); WebFetch extract | 2026-11-18 |
| VEH-FVS-09 | https://www.best-selling-cars.com/usa/2021-full-year-usa-gm-sales-chevrolet-buick-cadillac-gmc/ | Best-Selling-Cars: 2021 GM sales | Sierra LD 178,346 (2021); WebFetch extract | 2026-11-18 |
| VEH-FVS-10 | https://www.best-selling-cars.com/usa/2023-full-year-usa-gm-chevrolet-gmc-cadillac-buick-car-sales-by-model | Best-Selling-Cars: 2023 GM sales by model | Sierra LD 189,288 (2023), 142,404 (2022); WebFetch extract | 2026-11-18 |
| VEH-FVS-11 | https://api.nhtsa.gov/complaints/complaintsByVehicle?make=FORD&model=F-150%20(SUPER%20CREW)%20GAS&modelYear=2025 (and make=GMC&model=SIERRA%201500&modelYear=2023) | NHTSA: owner complaints API, every F-150 and Sierra 1500 listing, model years 2019 to 2026 | complaints deduplicated by ODI number; curl, JSON in `nhtsa/raw/` | 2026-11-18 |
| VEH-FVS-12 | https://api.nhtsa.gov/SafetyRatings/VehicleId/21411 (F-150 ids 21408 to 21413; Sierra 21844 to 21849) | NHTSA: 5-Star Safety Ratings API | star ratings, rollover, driver-assistance fields; curl, JSON in `ratings/` | 2026-11-18 |
| VEH-FVS-13 | https://api.nhtsa.gov/recalls/recallsByVehicle?make=FORD&model=F-150&modelYear=2022 (and make=GMC&model=SIERRA%201500; campaign 25V060000 at https://api.nhtsa.gov/recalls/campaignNumber?campaignNumber=25V060000) | NHTSA: recalls API | recall counts per model year deduplicated by campaign number; grille deflector recall text; curl, JSON in `nhtsa/recalls/` | 2026-11-18 |
| VEH-FVS-14 | https://www.fueleconomy.gov/ws/rest/vehicle/menu/model?year=2026&make=Ford (and make=GMC; https://www.fueleconomy.gov/ws/rest/fuelprices) | FuelEconomy.gov web service: 2026 Ford F150 and GMC Sierra vehicle records | EPA combined/city/highway mpg, annual fuel cost by engine and drive, fuel prices; curl, JSON in `epa/` | 2026-11-18 |
| VEH-FVS-15 | https://www.ford.com/trucks/f150/2026/incentives-and-offers/ | Ford: 2026 F-150 incentives and offers | returned a page with no cash, APR or lease figures; lists recognition programs without amounts; WebFetch extract | 2026-11-18 |
| VEH-FVS-16 | https://www.ford.com/used/about-certified/ford-blue-advantage/ | Ford Blue Advantage: certified used | Gold and Blue Certified terms; WebFetch extract | 2026-11-18 |
| VEH-FVS-17 | https://www.kbb.com/gmc/sierra-1500/2026/ (and https://www.kbb.com/gmc/sierra-1500/2026/specs/) | Kelley Blue Book: 2026 GMC Sierra 1500 | expert 4.3, consumer 4.0 (101 reviews), tied #3; engines, towing, payload, rear legroom, tank, spec table by trim, pros and cons; WebFetch extract | 2026-11-18 |
| VEH-FVS-18 | https://www.kbb.com/ford/f150/2026/ | Kelley Blue Book: 2026 Ford F-150 | expert 4.7, consumer 4.2 (60 reviews), #1; engines, tow 13,500, payload 2,440, tank 36, pros and cons; WebFetch extract | 2026-11-18 |
| VEH-FVS-19 | https://www.kbb.com/gmc/sierra-1500-crew-cab/2026/specs | Kelley Blue Book: 2026 GMC Sierra 1500 crew cab specs | Elevation, SLT, Denali: bed 6.5 ft, tank 24, wheelbase 157, length 241.5, ground clearance 8, tow 13,000 to 13,100, payload 1,910 to 1,930, EPA mpg; no bed volume or rear legroom; WebFetch extract | 2026-11-18 |
| VEH-FVS-20 | https://www.cars.com/research/gmc-sierra_1500-2026/specs/474996/ (and /474995) | Cars.com: 2026 GMC Sierra 1500 SLT specs | cargo volume 63 cu ft, floor length 70 in, rear legroom 43 in, wheelbase 147, tank 24, curb weight 4,826, tow 13,100; pages contradict themselves on engine and length; WebFetch extract | 2026-11-18 |
| VEH-FVS-21 | https://www.ford.com/trucks/f150/features/pro-power-onboard/ | Ford: F-150 Pro Power Onboard | 7.2 kW on King Ranch and Platinum, hybrid standard; garbled extract; WebFetch extract | 2026-11-18 |
| VEH-FVS-22 | https://www.cars.com/articles/tech-powertrain-glitches-drive-low-scores-in-j-d-power-dependability-study-521710 | Cars.com: J.D. Power 2026 dependability study | brand problems per 100: Ford 228, GMC 229, Chevrolet 178, industry 204; large light-duty pickup ranking text; WebFetch extract | 2026-11-18 |
| VEH-FVS-23 | https://www.cars.com/research/ford-f_150-2026/ | Cars.com: 2026 Ford F-150 | consumer 4.5 (2 reviews), pros, cons, features, reviewer notes; WebFetch extract | 2026-11-18 |
| VEH-FVS-24 | https://www.cars.com/research/gmc-sierra_1500-2026/ | Cars.com: 2026 GMC Sierra 1500 | consumer 4.4 (7 reviews), pros, cons, reviewer notes; WebFetch extract | 2026-11-18 |
| VEH-FVS-25 | https://www.iihs.org/ratings/vehicle/ford/f-150-crew-cab-pickup/2026 | IIHS: 2026 Ford F-150 crew cab | crash-test grades; WebFetch extract | 2026-11-18 |
| VEH-FVS-26 | https://www.iihs.org/ratings/vehicle/gmc/sierra-1500-crew-cab-pickup/2026 | IIHS: 2026 GMC Sierra 1500 crew cab | crash-test grades and which Silverado tests apply; WebFetch extract | 2026-11-18 |
| VEH-FVS-27 | https://www.iseecars.com/car/2026-ford-f__150-price | iSeeCars: 2026 Ford F-150 price | MSRP and invoice by style, $2,795 destination, 4x2 and 4x4 prices; WebFetch extract | 2026-11-18 |
| VEH-FVS-28 | https://www.iseecars.com/car/2026-gmc-sierra_1500-price | iSeeCars: 2026 GMC Sierra 1500 price | MSRP and invoice by style (31 styles); WebFetch extract | 2026-11-18 |
| VEH-FVS-29 | https://www.carwhere.com/price/ford/f-150/2026 | CarWhere: 2026 Ford F-150 price | median 4.4% under, 17 purchases, snapshot 2026-11-08; WebFetch extract | 2026-11-18 |
| VEH-FVS-30 | https://www.carwhere.com/dealer-invoice-price/gmc/sierra-1500/2026 | CarWhere: 2026 GMC Sierra 1500 prices paid | 32 deals, per-trim averages, as of 2026-06-16; WebFetch extract | 2026-11-18 |
| VEH-FVS-31 | https://www.coxautoinc.com/insights/october-2026-new-vehicle-inventory/ | Cox Automotive: October 2026 new-vehicle inventory | days of supply F-150 93, Silverado 99, Ford 112, GMC 110, industry 87; the brand chart is an image; WebFetch extract | 2026-11-18 |
| VEH-FVS-32 | https://repairpal.com/reliability/ford/f-150 | RepairPal: Ford F-150 reliability | 3.5 of 5, 7th of 17, $788, 0.28 visits, 15% severe; WebFetch extract | 2026-11-18 |
| VEH-FVS-33 | https://repairpal.com/reliability/gmc/sierra-1500 | RepairPal: GMC Sierra 1500 reliability | 3.5 of 5, 3rd of 17, $727, 0.2 visits, 15% severe; WebFetch extract | 2026-11-18 |
| VEH-FVS-34 | https://www.iseecars.com/car/ford-f-150 | iSeeCars: Ford F-150 | 200,000-mile chance 25.0%, lifespan 163,092 mi, reliability 8.56; WebFetch extract | 2026-11-18 |
| VEH-FVS-35 | https://www.iseecars.com/car/gmc-sierra-1500 | iSeeCars: GMC Sierra 1500 | 200,000-mile chance 33.3%, lifespan 174,737 mi, reliability 8.76; WebFetch extract | 2026-11-18 |
| VEH-FVS-36 | https://www.motor1.com/news/805731/nhtsa-gm-l87-v8-investigation-expands/ | Motor1: NHTSA expands its GM 6.2L V8 investigation | EA26005 scope and incident counts; WebFetch extract | 2026-11-18 |
| VEH-FVS-37 | (web search, no single page) | search results: NHTSA EA26005 status | GM response due Nov 13; no recall decision or closure found; search summary | 2026-11-18 |
| VEH-FVS-38 | https://www.carcomplaints.com/news/2026/gm-lifter-lawsuit-update.shtml | CarComplaints: GM lifter lawsuit update | Harrison v. GM scope and the February 28, 2026 ruling; WebFetch extract | 2026-11-18 |
| VEH-FVS-39 | https://www.iseecars.com/car/ford-f-150/resale-value | iSeeCars: Ford F-150 resale value | 3 and 5 year depreciation, class and all-vehicle averages; WebFetch extract | 2026-11-18 |
| VEH-FVS-40 | https://www.iseecars.com/car/gmc-sierra-1500/resale-value | iSeeCars: GMC Sierra 1500 resale value | 27.8% (3 years), 39.5% (5 years), class 23.7% and 37.0%, all vehicles 24.8% and 41.7%; WebFetch extract (first try returned 429) | 2026-11-18 |
| VEH-FVS-41 | https://www.carwhere.com/used-car-prices/ford/f-150/2024 (and /2022, /2023, /2025) | CarWhere: used Ford F-150 prices | median asking price by model year, snapshot 2026-11-14; XLT 49.8% of 2023 listings; WebFetch extract | 2026-11-18 |
| VEH-FVS-42 | https://www.carwhere.com/used-car-prices/gmc/sierra-1500/2024 (and /2022, /2023, /2025) | CarWhere: used GMC Sierra 1500 prices | median asking price by model year, snapshot 2026-11-14; WebFetch extract | 2026-11-18 |
| VEH-FVS-43 | https://www.cargurus.com/research/price-trends/Ford-F-150-d337 | CarGurus: Ford F-150 price trends | average used asking price 2021 to 2025; WebFetch extract | 2026-11-18 |
| VEH-FVS-44 | https://www.cargurus.com/research/price-trends/GMC-Sierra-1500-d116 | CarGurus: GMC Sierra 1500 price trends | average used asking price 2021 to 2025; WebFetch extract | 2026-11-18 |
| VEH-FVS-45 | (web search, no single page) | search results: U.S. News, Edmunds, J.D. Power figures | U.S. News F-150 9.6; Edmunds 2026 F-150 "7.7" and Sierra 6.7; J.D. Power Sierra 81; J.D. Power Initial Quality headline; summary and snippet only | 2026-11-18 |
| VEH-FVS-46 | (web search, no single page) | search results: Sierra bed volume | Auto123 and Cars.com bed-volume text (62.9, 63, 71.7 cu ft); snippet | 2026-11-18 |
| VEH-FVS-47 | (web search, no single page) | search results: GM CarBravo warranty | 12-month/12,000-mile bumper-to-bumper; sources disagree on powertrain; summary | 2026-11-18 |
| VEH-FVS-48 | (web search, no single page) | search results: 2026 F-150 standard safety equipment | AEB standard on every trim per KBB and Ford trim pages; summary | 2026-11-18 |
| VEH-FVS-49 | (web search, no single page) | search results: 2027 F-150 engines | autoevolution headline: 2.7L dropped, 3.0L becomes base; snippet | 2026-11-18 |
| VEH-FVS-50 | (web search, no single page) | search results: 2026 Sierra GMC Pro Safety | Pro Safety standard on every trim per J.D. Power text; sources disagree on features; summary | 2026-11-18 |
| VEH-FVS-51 | (web search, no single page) | search results: 2026 Sierra tow and payload | dealer pages and GM Authority text: diesel 13,300, 6.2L 13,100 to 13,200, payload 1,720 to 2,240; summary | 2026-11-18 |

## Reused from price guides and reference comparisons

- From `ford-f-150-price.html` (data/vehicle-pages.json, checked 2026-11-15): 2026 and 2027 MSRP by trim (VEH-F150-01, -02), destination $2,795 (VEH-F150-02), offers (VEH-F150-03, -04), pay ranges and TrueCar 5.6% / 6.5% (VEH-F150-06), iSeeCars invoice (VEH-F150-07), Cox September 101 vs 82 (VEH-F150-08), used asking prices (VEH-F150-11), CR about average 2026 (VEH-F150-19), Edmunds 8.0 and 1st of 5 (VEH-F150-21), KBB 4.7 / 4.2 (-22), U.S. News 9.6 and 1st of 6 (-23), J.D. Power 83 (-24), NHTSA stars (-27), 10-speed complaints (-17).
- From `gmc-sierra-1500-price.html` (checked 2026-11-16): 2026 and 2027 MSRP by trim, 2027 changes (VEH-SIERRA-01, -02, -03), destination (-04), GMC offers (-05; rechecked in browser 2026-11-18 by the Sierra comparison, VEH-SVS-03), TrueCar by trim (-08), CarWhere (-12), Cox GMC 110 days (-11), CarGurus used (-16), CarBravo (-18), GMC warranty (-19), CR below average (-26), Edmunds 6.7 and 5th (-10), KBB 4.3 / 4.0 (-27), U.S. News 9.0 tied 3rd (-28), J.D. Power 80 and 5th (-29), NHTSA 4 stars crew cab 4WD (-21), IIHS (-22), recalls by model year (-23), 6.2L investigation (-24, -25), lifter lawsuit (-30).
- From `ford-f-150-vs-chevrolet-silverado-1500.html`: the 59% F-150 sales method (VEH-F1S-43 to -46: Ford 2025 sales, Ford Q3 2026, Good Car Bad Car), the NHTSA cab-name listing method (VEH-F1S-35), EPA records 50092 to 50103 and 50447 (VEH-F1S-06), Ford spec PDF (VEH-F1S-07), CR F-150 about average (VEH-F1S-24), RepairPal (-25), iSeeCars (-27, -30), IIHS F-150 (-41), Cox F-150 93 (-53), CarWhere F-150 4.4% (-56), Pro Power Onboard 7.2 kW (-57), Edmunds large-truck list (-14). All matched today's re-reads except where noted below.
- From `gmc-sierra-1500-vs-chevrolet-silverado-1500.html`: Sierra LD sales by year (VEH-SVS-42 to -45), NHTSA "SIERRA 1500" method (VEH-SVS-31), grille deflector complaint note, EPA Sierra records (VEH-SVS-07), RepairPal Sierra (-22), iSeeCars Sierra (-24, -26), KBB Sierra specs (-08), CR Sierra (-20), J.D. Power ranking (-19).

## Not found / weak

- Edmunds, J.D. Power, Consumer Reports, U.S. News, TrueCar, GMC, Ford offers figures, CarBravo: blocked or no figures today; all figures reused from the guides and labelled. Edmunds "suggested price" (Texas sales): not read.
- J.D. Power category sub-scores (quality and reliability, driving experience, resale) for either truck: NOT FOUND.
- Sierra official bed volume, rear headroom and curb weight: NOT FOUND from GM (gmc.com refused reads); the 62.9, 63 and 71.7 cu ft figures are third-party and inconsistent. Sierra tow ratings differ by a few hundred pounds across KBB, TrueCar and cars.com; only a window sticker settles a given truck.
- Sierra-only days of supply: Cox gives GMC brand 110 only. F-150 hybrid-only complaint rate not computed.
- Rule check for the writer: Cox days of supply (section B), CarWhere median asking prices and the XLT share of used listings (sections B and F) and CarGurus average asking prices (section F) are derived from dealer inventory or listings. They are included because the research request asks for them and the reference comparisons use Cox and CarWhere; if the "no listings or dealer-inventory figures" rule is read strictly, drop them. No MarketCheck or listings-connector data was used.
- F-150 sales are an estimate (59% of F-Series, a one-quarter production share). Ford does not publish F-150-only sales.
- CarBravo powertrain cover: sources disagree; guide quotes only the 12-month/12,000-mile bumper-to-bumper term.
- F-150 NHTSA driver-assistance fields say "No" for forward collision warning and lane departure warning, which conflicts with Ford's equipment; treated as an NHTSA listing quirk, not used.
- Sierra EPA diesel 4WD: only the "with Sport Mode" record carries the 24 mpg 4WD diesel; no plain "Sierra 4WD" diesel record appeared in the menu.

## Contradictions between sources

1. **Edmunds F-150 score.** Guides and the F-150 vs Silverado page (read in a browser 2026-11-15 and 11-16): 8.0, 1st of 5. Web-search result text today (FVS-45): 7.7 for the 2026 F-150, "7.5" in another result's text, and a Sierra rank of 4th (the guides say 5th). Edmunds blocked a direct read. Re-read in a browser before publishing; if Edmunds rescored, the 8.0 changes.
2. **J.D. Power Sierra score.** Guide and Sierra vs Silverado page: 80 (5th). Search summary today: 81/100 "great". Not re-readable.
3. **Grille deflector recall.** The Sierra guide and Sierra vs Silverado page say there is no recall; NHTSA lists recall 25V-060 (2022 Sierra 1500, chrome deflectors, 70,768 vehicles, February 2025). Complaints about 2023 and 2024 trucks have no matching recall.
4. **F-150 starting price.** Ford-based guide: XL $39,585, XLT $44,695. iSeeCars lists an XL 8-ft regular cab at $37,290 and its cheapest XLT at $45,695 (a $1,000 gap); iSeeCars' own headline "starts at $37,290". Different style sets, not necessarily an error.
5. **F-150 hybrid towing.** Ford spec PDF: 11,600 lb (4x4), 12,400 (4x2). KBB: "up to 11,200". Ford's 2027 page: "up to 12,100".
6. **F-150 payload.** Ford spec PDF: max 2,440 lb is the 4x2 3.5L; the 4x4 figure is 2,175. The reference comparison and guide quote 2,440 without the drive; the 2027 page says 2,430.
7. **Sierra payload and tow.** KBB (crew cab SLT 1,910 payload, 13,000 tow) vs KBB main page (2,260 with the 2.7L, 13,300 diesel RWD) vs cars.com (2,274 or 2,289 payload, 13,100 tow) vs GM Authority summary (diesel 1,880, 6.2L 1,870). Different trims and configurations.
8. **CarGurus dates.** The pages say "as of May 3, 2026" but their prices differ from the guides' November 15 and 16 figures (F-150 2022: $35,625 today vs $35,709; Sierra 2022: $39,869 vs $39,967). The page footnote is probably stale text; the figures moved.
9. **Reference page versus today's counts.** Not a contradiction between sources: NHTSA added complaints since the reference pages (F-150 2023 to 2025 889 then, 893 now; Sierra 1,038 then, 1,040 now). Every per-year rate is within 1.2 per 100,000 of the reference charts.
10. **iSeeCars percent difference.** iSeeCars' ratio is (MSRP minus invoice) divided by invoice (4.71%, 6.95%, 6.27%, 4.06%); the same gap measured under MSRP is 4.5%, 6.5%, 5.9%, 3.9%. The guides' "about 4.5%" and "about 6%" use the under-MSRP basis.

---

## Summary: which truck wins each measurable signal

1. **Price (starting, volume trim):** Sierra Pro starts $38,600 against $39,585 for the F-150 XL (before the $2,795 destination both charge); the Sierra's 4x4 step-up is $3,100 to $3,300 against $3,800 to $3,885.
2. **Discount:** a tie on fair-deal ranges (5 to 7% under on the volume trims); the Sierra SLT and Denali average about 7.5% under in TrueCar's data against 5.6% for the F-150 XLT; Sierra buyers reported about 11% on SLTs and Elevations (3 deals each) against a median 4.4% for 17 F-150 buyers; Cox days of supply 93 (F-150) against 110 (GMC brand, no Sierra-only figure), so the Sierra has more room.
3. **MPG:** the F-150 wins as a 4x4: hybrid 23 combined and $2,600 a year, V8 19 against the Sierra's 5.3L at 16 or 17; the Sierra's diesel (24 combined 4WD, 25 2WD) beats every F-150 on mpg but costs $3,850 a year in fuel against $2,600.
4. **Towing and space:** the F-150 tows 13,500 lb (3.5L 4x4) against the Sierra's 13,300 (diesel RWD), carries up to 2,440 against 2,260, and its tank is 36 gallons against 24 (about 684 miles against 384 to 432 on a gas 4x4); rear legroom is 43.6 against 43.4 inches.
5. **Complaints per 100,000 sold (2023 to 2025):** the F-150 wins, about 64.5 (estimated sales) against 164.0 for the Sierra, and the Sierra is higher in every model year 2019 to 2025; 532 of the Sierra's 1,040 complaints are about the engine.
6. **Recalls (2023 to 2026 model years):** the Sierra wins, 6 against 48 for the F-150.
7. **Other reliability:** Consumer Reports favors the F-150 (about average against less reliable than average); iSeeCars (33.3% against 25.0% reach 200,000 miles) and RepairPal ($727 against $788; 3rd against 7th of 17) favor the Sierra; J.D. Power brand scores are even (Ford 228, GMC 229).
8. **Resale:** the F-150 wins, losing 18.9% of its value in three years against 27.8% for the Sierra (class average 23.7%), and 38.6% against 39.5% in five years.
9. **Safety:** the F-150 wins, 5 stars overall from NHTSA for the crew cab 4x4 against 4 for the Sierra, and Good in IIHS small overlap and side tests against Marginal and Acceptable (the F-150's updated moderate overlap is Poor; the Sierra's is not rated).
10. **Reviews:** the F-150 scores higher at every publisher we could read (Edmunds 8.0 against 6.7, with a re-check flagged; KBB 4.7 against 4.3; U.S. News 9.6 against 9.0; J.D. Power 83 against 80).
