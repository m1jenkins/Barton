# Metro baseline capture and cohort review

Template only. No measurement has been supplied. Keep missing values blank/null, never zero. Owner page sign-off is already recorded; this captures evidence, not another approval request.

## Capture record (one per market and each old URL)

| Field | Value to capture |
| --- | --- |
| Market ID / canonical / legacy URLs | |
| Analyst / export date / property and timezone | |
| 28-day window start and end (28 completed days) | |
| GSC export reference and filters | |
| Prior 16-month query/page/device/country export | |
| Branded/non-brand definition and excluded queries | |
| GA4 property, consent/filter limitations, export reference | |
| Lead/purchase ledger reference and reconciliation method | |
| External backlinks/referring pages and export reference | |
| Canonical / robots / sitemap / URL Inspection observation date | |
| Query family, metro location, device, five competitors, observation date | |
| AI prompt-panel source and limitations | |

1. Obtain authorized read-only exports; do not submit URLs or change properties. Record all filters, timezone, extraction date and reporting lag. Preserve restricted raw exports outside the public artifact and link access-controlled references.
2. Use a single comparable 28-completed-day window. Export GSC query/page/device/country data with impressions, clicks, CTR and average position. Segment brand/non-brand and each old DFW URL before consolidation. Record privacy-suppressed queries and incomplete coverage; missing query rows are not zero demand.
3. Export organic landing sessions and engaged visits from GA4. Capture identifiable AI referrals separately; do not infer invisible AI usage. Where an account exposes an AI report, record its actual available fields and limitations rather than assuming access.
4. Reconcile qualified inquiries to durable lead records and purchases to verified server/payment records. Define qualified inquiry and attribution window; document deduplication, refunds and margin inputs. CTA clicks and success-page visits are not conversions. Never put customer PII in this repository.
5. Save external backlink/referral evidence for Dallas, Fort Worth and Arlington, plus the other six existing URLs. Combine it with `data/metro-link-inventory.csv`; repository anchors are a different dataset. Preserve meaningful anchor destinations if a later reviewed redirect is chosen.
6. Record representative desktop/mobile SERPs from the market without bypassing a challenge. Separate independent assistance, dealer concierge, directory and informational intent. Ungeolocated web samples in the dossiers are leads for research, not local rankings or measured demand.
7. Have an accountable analyst/reviewer record the completed packet, dates, limits and next review in the market baseline/demand fields. A source URL alone is not a baseline. Define numerical targets only after inspecting the observed data.

## Cohort review log

Use one row per released URL. The clock starts on an actual authorized release, not on draft generation or merge. Keep production verification separate from local implementation QA.

| Review | Required checks | Record a decision and evidence |
| --- | --- | --- |
| Release / day 0 | Actual canonical/robots/sitemap, approved source/claim expiry, mobile/keyboard/JS-off, production conversion-path and consent checks, URL Inspection | Release artifact and date, reviewers, baseline packet; contain any failed gate |
| Day 30 | Indexing, non-brand query fit, impressions/clicks, landing engagement, attributable qualified inquiries; compare same-length baseline with lag/seasonality notes | Continue observation or fix a diagnosed issue; do not expand from impressions alone |
| Day 60 | Intent quality, inquiry-to-purchase reconciliation, objections, support capacity, measured margin; factual/source changes | Improve local content or process using evidence; record corrected copy and review |
| Day 90 | Distinct demand/value and qualified business outcomes; overlap with nearby pages; incoming links | Retain, improve, or propose merge/redirect. Release a redirect only after destination, link/traffic and qualified-copy gates pass |

For every review record: analyst, period, evidence reference, missing-data limits, action owner, due date and source/claim refresh dates. Do not invent a ranking, traffic, AI-citation or conversion target. Escalate evidence access/reviewer needs through the existing FirstMate release-evidence task.
