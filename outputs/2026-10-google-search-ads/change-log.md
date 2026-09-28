# Google Ads change log

One line per change to the Google Ads account, GTM container, Stripe checkout or `plan.json`. Google Ads keeps its own change history too; this log adds the reason and what to check next.

Format:

`YYYY-MM-DD HH:MM CT | campaign or area | change (old → new) | why | expect | rollback | review on | authority`

Authority values:
- `plan`: approved in `docs/google-ads-launch-plan-2026-09-27.md`
- `owner`: a named approval
- `gate`: a launch-gate step
- `emergency`: a pause under the plan's emergency stops, followed by an alert

## Entries

2026-09-27 | all | launch plan approved: $1,500 cap for the first 30 days, US Presence, $150 break-even per paying customer, exact + phrase only, purchase-only goal | owner decisions in planning session | — | — | 2026-10-02 go/no-go | owner
2026-09-27 | plan.json | bundle created; all campaigns PAUSED; `tracking.primary_conversion_verified` = false until gate G2 | tracking not yet verified | checker blocks until G2 | — | after G2 | plan
2026-09-27 | plan.json (NonBrand) | removed 5 keywords: "vehicle negotiator" [exact], "negotiate car price for me" (phrase), "auto buying concierge" (phrase), "nationwide car concierge" (phrase), "someone to help me buy a car" [exact]; 36 → 31 keywords | Keyword Planner showed no data for them (keyword-planner/historical-metrics-2026-09-27.csv); brand terms kept despite no data | none (campaigns paused) | restore from git history and rebuild | first weekly search-terms review | owner (Mason, chat 2026-09-27)
