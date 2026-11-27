# Handoff: finish the Ford F-150 vs GMC Sierra 1500 page (November 19, 2026)

**Done.** The page shipped with option A below ("Too few to call"). The `tools/` and `work/` folders this README describes were removed on November 26, 2026; recover them from git history (commit `bbbbb6a`) if the pair is ever recoded. `briefs/research.md` section E stays, because `scripts/nhtsa-problems.mjs` cites it.

Five car-vs-car pages were built and pushed to `main` on November 19, 2026 (see `docs/seo/2026-11-15-vehicle-price-pages.md`, sections "Head-to-head Reddit top-ups" and one per pair). The sixth, `ford-f-150-vs-gmc-sierra-1500.html`, was stopped by the instructions' own gate: its neutral venue had **95 picks** (F-150 87, Sierra 8), under the 100 floor. This folder holds what is needed to finish it. It contains ids and codes only: no Reddit text, and usernames are hashed.

## What is here

- `work/f-150-sierra/coded/batch-01..07.json`: first-coder output (v3 rubric), ids and codes. Batch 04 left 8 of 428 comments uncoded.
- `work/f-150-sierra/second.json`, `second2.json`: the two blind second-coder files (50 and 100 comments); `agreement.json` is their score: 69% on picks (9 of 13 comments either coder picked on), 65% on stance (28 of 43). Below the 85% floor.
- `work/f-150-sierra/sampled.json`: the sampled threads and comment ids (authors hashed), `candidates.json`: the 261 candidate threads without text.
- `research/f-150-vs-sierra.md`: the finished research (sections A–I, 51 VEH-FVS sources). Read its "Not found / weak" and "Contradictions".
- `tools/`, `briefs/`: the scripts and coder, screen, research and builder briefs. `tools/lib.mjs` expects the scripts to sit in `<scratch>/tools` with `raw/` and `work/` beside them.

## Why the count is low

Rubric v3 counts an opinion or pick only when the comment names the model. Sierra owners write "my Denali", "my AT4", "the 6.2", so most Sierra comments are skipped, and picks run 87 F-150 to 8 Sierra. That is partly the rubric, not Reddit's view. Neutral picks before this top-up were 42 (38 / 4).

## Options (the owner has not chosen)

A. **Build with what exists**: merge, write the pair file, set `reddit.minimumPicks` (30) so the hero strip reads "Too few to call", say plainly on the page that most Sierra comments name only a trim, and flag the blind check (69% / 65%) as below the floor, as the Forester vs RAV4 and Colorado vs Tacoma pages do.
B. **Recode with a looser rule** for this pair only: a trim name that belongs to one model (Denali, AT4, AT4X, Elevation, SLT for the Sierra; Raptor, Tremor, Lariat, King Ranch, Platinum for the F-150) counts as that model. Needs the comment text again (re-fetch with `tools/fetch-comments.mjs` from the ids in `candidates.json`, rebuild batches with `tools/sample.mjs`, recode 7 batches, re-run the 150-comment blind check) and costs about 1.5M tokens. Then re-check the 100-pick floor.

## Steps for option A (about an hour)

1. Create a scratch folder, copy `tools/` into it, copy `work/` beside it, and edit `S` in `tools/lib.mjs` if the path differs. Pre-existing neutral picks are in the car files already merged to `main`.
2. `node tools/merge.mjs f-150-sierra --rubric=v3` (dry run), then `--write`; it edits `data/reddit-sentiment/cars/ford-f-150.json` and `gmc-sierra-1500.json`. Then `node scripts/reddit-sentiment-pair.mjs ford-f-150 gmc-sierra-1500 ford-f-150-vs-gmc-sierra-1500.html` and confirm the neutral count (it was 95).
3. `node tools/themes.mjs f-150-sierra` and `node scripts/reddit-sentiment.mjs data/reddit-sentiment/ford-f-150-vs-gmc-sierra-1500.json` for the builder's inputs.
4. Run a Sonnet builder per `briefs/builder.md` (code FVS, reference entries `ford-f-150-vs-chevrolet-silverado-1500.html` and `gmc-sierra-1500-vs-chevrolet-silverado-1500.html` and the new `ford-f-150-vs-toyota-tundra.html`), loading `edmunds-style`. Known facts for it: NHTSA recall 25V-060 (2022 Sierra grille deflector) exists although the Sierra pages say there is none; F-150 figures must match the F-150 vs Tundra page (including the guide conflicts listed in its doc section).
5. `tools/insert-entry.mjs`, `tools/wire.mjs` (spec shape in `tools/wire.mjs`), `node scripts/render-vehicle-pages.mjs`, then `node scripts/validate-site.mjs`, `npm run check:vehicles`, `npm run check:js`, `npm test`. Add a doc section for the pair. One commit, explicit paths.
