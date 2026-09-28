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
2026-09-27 | Conversions (account 230-950-4242, AW-18071301983) | created "Purchase – verified" (ID 7802445530, label r1JaCNq9v4gdEN_eiKlD): Purchase, Primary, different values (default $395), count Every, 30-day click window, data-driven, enhanced conversions off | only primary goal for the non-brand campaign (setup guide step 2) | "Awaiting conversions" until the GTM tag fires | remove the action | after GTM publish (G2) | owner (T4 task)
2026-09-27 | Conversions | created "Begin checkout" (ID 7802581153, label A1cuCKHhx4gdEN_eiKlD): count One, $1 fallback value (Google removed "Don't use a value"); the wizard forced Primary, changed to Secondary right after | observation only | not included in account-level goals | remove the action | after GTM publish (G2) | owner (T4 task)
2026-09-27 | Conversions | created "Phone click" (ID 7802581156, label AmVzCKThx4gdEN_eiKlD): Contact, Secondary, count One, $1 fallback value; the planned "Call Button" action isn't in the account | observation only | not included in account-level goals | remove the action | after GTM publish (G2) | owner (T4 task)
