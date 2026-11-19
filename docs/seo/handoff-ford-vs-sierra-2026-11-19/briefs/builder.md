# Builder brief: one entry for data/comparison-pages.json

You write the data entry (one JSON object) for a new car-versus-car page on steermeright.com, from research and Reddit files that are already collected.
You do NOT edit anything in the repository /home/user/Barton (other sessions share the checkout; no git commands either). You write only into the scratchpad folder named in your prompt.

FIRST, load the `edmunds-style` skill with the Skill tool and follow it for every sentence you write (verdict first, claim + number + payoff, every number against a yardstick or named rival, praise and catch in the same paragraph,
calibrated adjectives, one clear pick plus a line for the buyer who should choose differently). Read its formats.md "Two-car head-to-head" and examples.md. Nobody on this project has driven these cars for the page:
write nothing that implies a drive (no "feels", "rides", "we found it quiet"); attribute impressions to the named publication or to what Reddit owners report. Plain, concrete, human prose: no brochure words,
no stacked superlatives, no "X, not Y" disclaimers, no tacked-on caveat sentences, no filler like "it's worth noting". Public copy says "car search" or "search details", never "brief"; never "broker"; Reddit gripes are "what owners report" (not confirmed defects);
no listings or MarketCheck figures; no averaged review scores; no AggregateRating.

## Read first (in /home/user/Barton)
- AGENTS.md; docs/seo/2026-11-15-vehicle-price-pages.md (the car-vs-car sections and the "Rules" section).
- data/comparison-pages.json: print the reference entry named in your prompt (python3 or node; the file is large, print one entry) and copy its structure, key order and level of detail exactly. Also read the entry of the other nearest sibling named in your prompt.
- data/vehicle-pages.json: the two cars' entries (find by slug): `trims.rows` (names, prices, `pick`), `pay` ranges, `incentives`, `safety`, `reviews`/score strip, sources, photo. Figures reused from them must say so in the source note.
- Your research file and the Reddit files named in your prompt.

## Hard constraints (tests enforce several)
- `slug`, `cars[0..1].slug` must be existing price-guide slugs; `price.picks.a/b` must be exact `trims.rows[].name` values in those guides (the renderer computes dollars from that trim's starting MSRP). `reddit.dataFile` = `data/reddit-sentiment/<slug without .html>.json`.
- Every outside link that appears on the page (including every `reviews.rows[].href`, and any `<a href>` you put in prose) must also be in `sources` with the identical URL. Do not put outside links in prose unless needed. Internal links (/foo.html) only to pages that exist in the repo root.
- `sources`: objects `{id, url, title, note}`; ids `VEH-<CODE>-NN` sequential from 01 (CODE in your prompt); title "Publisher: page title"; the note says what the source supports and the date read, and "from the X price guide" for reused figures. Use only sources the research file actually read; nothing invented.
- Numbers: every chart row has numeric `a`/`b` plus `aText`/`bText`; `win` is "a", "b" or null (null = even). Round nothing a source printed exactly. State which trim/drivetrain a figure belongs to. No figure without a yardstick.
- Reddit numbers: take every count and index from the Reddit summary file you are given, exactly (threads, comments, neutral threads, picks, shares, index). Do not compute your own. `reddit.minimumPicks` only when neutral picks are under 100 (then 30), and say the neutral sample is small.
- Reddit theme lists (`praise` and `gripes`) come from the coders' theme notes (paraphrased; "Owners report ..." for faults) and the topic nets; 4 each, no quotes, nothing that identifies a person.
- The verdict (`summary`) and the two `choose` lists ("Buy the X if…") are Mason's call: write them from the research with one clear pick, and list them first in open-items.md. Reliability `signals` favor a side only where the numbers say so; `win: null` where even or unmeasured. Say which signals are secondary.
- `checkedOn` and `published`: 2026-11-18. `title` pattern: "<A> vs <B> (2026): Price, MPG, Reliability | Steer Me Right" (trucks: "Price, Towing, Reliability"). `description` one sentence like the references. `h1`, `crumb` ("A vs B" short names). `related`: HTML line of links to real pages (see reference). `faq`: 4-6 questions people actually ask about this pair, answers one to three sentences with numbers. `plansIntro`: two sentences selling Steer Me Right Pro for a buyer cross-shopping these two (no promised savings).
- Public logos: `cars[].logos.make` needs assets/logos/<make>.webp and <make>-white.webp (subaru and mazda are being added by someone else; use "subaru"/"mazda"); omit `logos.model` unless assets/logos/<model>-white.webp exists.

## Deliverables (write into the folder named in your prompt)
1. `entry.json`: the single entry object, valid JSON (python3 -c "import json;json.load(open(...))"), same key order as the reference.
2. `open-items.md`: every judgement call and weak figure Mason should check, with the entry field it affects: the verdict and Buy-if lists, the discount ranges, anything read only from a summary or snippet, contradictions between sources, figures reused rather than re-read, the neutral-venue size, signals decided on thin data.
3. A final message of at most 8 lines: file paths, the verdict sentence, the Reddit headline numbers you used, and anything that blocked you.
Self-check before finishing: no "brief", no "broker", no "guaranteed|lowest price|best price|average savings"; every link in sources; `undefined` nowhere; each chart `max` large enough; sections complete (strip, glance, summary, choose, board, reviews, price, mpg, space, reliability, reddit, resale, safety, plansIntro, faq, related, sources).
