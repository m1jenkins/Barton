# Research brief: one car-versus-car comparison page (steermeright.com)

You research the facts for ONE car-versus-car page. You do not write page copy and you do not touch the repository
(/home/user/Barton). No git commands, no edits there. Write only into the scratchpad folder named in your prompt.

Today is 2026-11-18. Public site rules that bind the figures you gather:
- Never use the words "brief" or "broker" anywhere, including your notes about Steer Me Right.
- No MarketCheck, listings or dealer-inventory figures. No averaged review scores (quote each publisher's own score with its link).
- Every outside figure needs a source URL you actually read, and the date you read it. If you only saw it in a search
  snippet or a summary, say "snippet" or "summary". Never invent or estimate a figure to fill a gap; write NOT FOUND.
- Round nothing a source printed exactly.

## Read first (in /home/user/Barton)
1. AGENTS.md and docs/seo/2026-11-15-vehicle-price-pages.md: the "Per-car Reddit files" section is not yours; read the sections on the two cars'
   price guides, and the car-vs-car sections ("Toyota RAV4 vs Honda CR-V", "Honda Civic vs Toyota Corolla", "Ford F-150 vs Chevrolet
   Silverado 1500", "Toyota Camry vs Honda Accord", "GMC Sierra 1500 vs Chevrolet Silverado 1500"). They record which method each figure used and which
   figures were weak.
2. data/vehicle-pages.json: the entries for your two cars (find them by `slug`). Reuse their figures wherever they are current (starting MSRP by trim,
   pay ranges "targets", offers, EPA, recalls, resale, safety, reviews, sources). Say "reused from <slug>" for each reused figure and keep the original source id/URL.
3. data/comparison-pages.json: the reference comparison named in your prompt. See what each section carries:
   glance, board (scoreboard rows), reviews, price (trim table, targets, charts such as days of supply, depreciation), mpg (charts), space (charts; towing for trucks),
   reliability (signals list, complaints-per-100,000-sold charts by model year and by component, recall chart, issues), resale, safety rows, faq, sources. Produce the same kinds of figures for your pair.

## What to gather (each with trim/drivetrain, number, source, date read)
A. Price: starting MSRP by trim for both cars (2026 model year; say if the 2027 is also on sale and its prices), destination charge, AWD/4x4 step-up. Reuse from the guides.
B. How far under sticker each sells: reuse the guides' pay ranges and the sale-price sources they used (Edmunds Texas prices, TrueCar averages, iSeeCars invoice, KBB fair price, CarWhere). Re-check anything that can be read. Cox days of supply (Cox Automotive's October or November 2026 report) if it names the brand or model.
C. Fuel economy / towing: EPA combined (city/highway) per powertrain from fueleconomy.gov's web service (https://www.fueleconomy.gov/ws/rest/...; works with curl) and EPA annual fuel cost. Trucks: towing and payload by configuration, bed length and volume, power and torque by engine; maker pages where readable.
D. Space: cargo volume (seats up/down), rear legroom, ground clearance (SUVs), wheelbase/length where relevant, from maker or EPA/Cars.com/KBB pages, with the source for each.
E. Reliability, same method as the existing pages: NHTSA owner complaints (https://api.nhtsa.gov/complaints/complaintsByVehicle?make=&model=&modelYear=, works with curl; read EVERY model-name listing for the car, e.g. hybrid and cab-name variants, and deduplicate by odiNumber) for model years 2019 to 2025, with counts by component. U.S. sales by calendar year 2019 to 2025 from the manufacturer's year-end sales releases or Best-Selling-Cars (cite the page). Complaints per 100,000 sold = complaints for model year Y / sales in calendar year Y x 100,000; also the 2023-2025 pooled rate. Recalls per model year (NHTSA recallsByVehicle; dedupe by campaign number; reuse the price guides' counts where they match). Note quirks (a model year with no listing returns HTTP 400; a nameplate whose sales include other models). Also: Consumer Reports predicted reliability verdict (if publicly readable), J.D. Power Vehicle Dependability brand figures (2026 study), RepairPal rating and annual repair cost, iSeeCars 200,000-mile share or lifespan figure. Mark which side each signal favors.
F. Resale: iSeeCars (or KBB) 3-year and 5-year depreciation, class average, average used asking prices by model year if a source gives them (CarWhere/iSeeCars), CPO program terms (reuse the guides').
G. Safety: NHTSA star ratings (overall, frontal, side, rollover) with vehicle IDs, IIHS grades by test and award, for the 2026 (or the newest year rated) of each car.
H. Reviews: each publisher's own score for each car with the URL: Edmunds, Kelley Blue Book (expert), U.S. News, J.D. Power (quality, driving experience, resale), plus the class rank each cites. Reuse from the guides where current.
I. A short "what the cars are like" fact list a writer can use without having driven them: powertrains and outputs, standard safety equipment, notable features and the one or two known faults each car's coverage mentions. Attribute each to a named publication or the maker.

## Method and limits
- This environment has no browser. Use WebFetch and WebSearch. Edmunds, TrueCar, Cox and some maker sites return 403 to scripted reads: say so and use the price guides' figures instead; do not try to get around a block.
- NHTSA and fueleconomy.gov APIs work with curl. Save raw NHTSA JSON under your scratchpad folder, and compute tables with a script rather than by hand.
- Be exact about which model years and which trims a figure belongs to.

## Deliverable
Write ONE markdown file `<scratchpad>/research/<pair>.md` with the sections A-I above, each figure as a table row or bullet:
`figure | value | trim/drivetrain | source id | read on`. Then a **Sources** table (every source id you used, sequential ids `VEH-<CODE>-01`, `-02`, ... where CODE is given in your prompt;
columns: id | URL | publisher: page title | what it supports and how it was read (page / browser-like fetch / summary / snippet) | date read). Then **Reused from price guides**,
**Not found / weak** and **Contradictions between sources**. Put raw tables (complaints by model year x component, sales by year) in the same file.
Finish with a 10-line summary: which car wins each measurable signal (price, discount, mpg, space/towing, complaints per 100k, recalls, resale, safety, reviews), stated as facts with numbers.
Keep your final message to the file path plus those 10 lines.
