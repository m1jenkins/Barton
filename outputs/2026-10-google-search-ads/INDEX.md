# Google Search ads launch bundle (October 2026)

**Status:** not published. Every campaign is created **paused**, and nothing is enabled until launch gates G1–G5 pass (`docs/google-ads-launch-plan-2026-09-27.md`). Account steps are in `docs/google-ads-setup.md`.

| File | What it is |
|---|---|
| `plan.json` | Source of truth: campaigns, budgets, targeting, keywords, negatives, responsive search ads, assets and governance limits. Edit this file, never the CSVs. |
| `editor-import/01…10-*.csv` | Google Ads Editor import files generated from `plan.json`. Import them in number order. |
| `build-editor-csv.mjs` | Rebuilds `editor-import/` from `plan.json`. `--check` fails if the CSVs are stale. |
| `ad-copy-approval.md` | Gate G4: every unique ad text, its length, where it's used and its basis. Approved through `ADS-GOOGLE-2026-10` in `data/claims.csv`. |
| `stripe-checklist.md` | Gate G1: live Payment Links, webhook, Vercel variables and the test purchase. |
| `change-log.md` | One line per account change, with reason, expected effect, rollback and review date. |

## Checks

```sh
node outputs/2026-10-google-search-ads/build-editor-csv.mjs --check
python3 ~/.claude/skills/google-search-ads/gads_tools.py check outputs/2026-10-google-search-ads/plan.json
```

The second command currently reports **one error on purpose**: `tracking.primary_conversion_verified` is `false` because purchase tracking hasn't passed gate G2. When G2 passes:
1. set it to `true`;
2. log the change;
3. re-run the command.

It must then report 0 errors and 2 warnings. The warnings are that there are five sitelinks, not six. That's deliberate: only five destination pages are live, approved and conversion-relevant.

## Import notes

- **Campaign-level negatives, not a shared list.** There is one non-brand campaign, so campaign negatives do the same job and import cleanly. Move them to a shared list if a second non-brand campaign is added.
- **Headers:** column names follow Google Ads Editor's "CSV file columns" help page. Editor shows a column-mapping preview on import; confirm it before "Finish and review changes".
- **Structured snippet columns aren't documented by Google.** If Editor doesn't map `09-structured-snippets.csv`, add the two snippets by hand. There are two rows.
- **Call asset:** the call asset schedule uses Editor's `(Monday[09:00-17:00])` format, in the account's time zone. Verify it after import.
- **Settings to set by hand:** some campaign settings don't import from CSV (Presence targeting, bid limits, conversion goals, AI Max). `docs/google-ads-setup.md` lists them.
