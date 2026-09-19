# SEO-02 — search baseline and query-to-page map

- **Starting revision:** `3bf03f6288a16b578e49cb1375254c7285a70855`.
- **Evidence date:** September 18, 2026, America/Los_Angeles / September 19, 2026, UTC. Search observations began approximately 02:12 UTC; Core Web Vitals was inspected in the same research session.
- **Overall status:** `waiting_for_access` for Drive Right GA4 identity/access and business-record reconciliation. Public research/query mapping are `verified_local`; GSC and GTM account observations below are `verified_live` read-only evidence. No release or account activation is implied.
- **Scope:** SEO-02 research and measurement discovery. No website, tag, Google property, indexing, payment, customer, or production changes.
- **Changed artifacts:** this record, [query-map.csv](query-map.csv), and [baseline-template.md](baseline-template.md). Only sanitized summaries and selected commercial query rows are retained; raw account exports, account-holder identities, customer records, and credentials are excluded.

## Findings that inform implementation

1. The verified GSC property already receives impressions for broad car-buying and negotiation queries. For August 20–September 16, `car buying service` has 184 impressions, zero reported clicks, and average position 35.1; `car buying services` has 55 impressions and position 38.2; `car negotiation service` has 17 impressions and position 20.5. This supports improving the existing national homepage and process page before creating more synonym URLs. These are property-level query metrics, not search volume or a current localized ranking.
2. The latest 28 days contain **27 clicks and 2,518 impressions**, compared with 51 clicks and 3,346 impressions in the preceding 28 days. That is a descriptive baseline, not evidence about the unlaunched $295 offer. Page containment, historical content changes, reporting lag, and small counts prevent attributing the difference to one cause.
3. Query reporting is incomplete by design: all 205 available query rows sum to only 5 clicks and 1,145 impressions. Keep property totals separate from query segments; do not describe the reported non-brand share as the site's complete traffic mix.
4. The live GTM container is an older Google Ads/Clarity setup. It has no visible GA4 tag or the current durable-event triggers. Its generic form-submit conversion is not evidence that a lead reached the database. SEO-07 needs a concrete account configuration packet in addition to local event tests.
5. Search history includes URLs now held behind editorial/noindex gates. Historical impressions are not approval to release those pages. Maintain the guide and metro review workflow.

## Access discovery and observed measurement state

| Source | Verified observation | Scope and remaining limitation |
| --- | --- | --- |
| Search Console | Authenticated URL-prefix property `https://www.driverightcarbuying.com/` is accessible. | This property does not establish coverage of the apex, HTTP, or other subdomains. No domain property for Drive Right was visible in the selector. No verification/settings changes made. |
| GSC performance | Web report read with no query/page/country/device filters. Latest default 28 complete days: August 20–September 16. | UI read, not API extraction. Exact click/impression totals cross-checked against daily, device, and country rows. CTR/position displayed by GSC are rounded. |
| GSC history | Selecting 16 months exposes **164 daily rows**, April 6–September 16, 2026. | Earlier history is unavailable in this property view; it is not recorded as zero. All 164 rows were read and aggregated into sanitized monthly totals. |
| GSC Core Web Vitals | Source is Chrome UX report; last updated **September 15, 2026**. **Mobile and desktop both report insufficient usage data in the last 90 days**, with their report buttons disabled. | No field LCP, INP, CLS, or valid URL-group counts are available. This is neither a passing nor a failing field score. Keep SEO-03's lab measurements separate. [Observed property report](https://search.google.com/search-console/core-web-vitals?resource_id=https%3A%2F%2Fwww.driverightcarbuying.com%2F) |
| GSC Links | Snapshot displays 27 external links, with the homepage as the reported target of all 27. Top sites: `syg.ma` (8), `reddit.com` (6), `glbrain.com` (3), `1st-street.com` (2), `theomnibuzz.com` (2). | This is the GSC report, not a complete backlink inventory, historical link-growth series, or quality verdict. No disavow or outreach action taken. |
| GA4 | Google Analytics is authenticated. The universal picker search `driveright` returns no Analytics result; `drive` returns an unrelated property only. | Drive Right's numeric GA4 property ID, web-stream measurement ID, timezone, and reporting access are unconfirmed. Do not infer a nonexistent property or use another business's metrics. |
| GTM | Drive Right account `6349220223`, container `249056149`, public container ID `GTM-W577B3D4`. Live **Version 6**, published **April 29, 2026**; workspace reports zero changes. | Read-only inspection confirms the published configuration. Container permission for publishing is not inferred or exercised. |
| Keyword-volume/rank tools | Available tool metadata and plugin discovery did not surface a dedicated GSC/GA4/GTM, keyword-volume, or backlink connector. `claude-seo` is not on PATH; its Google API config file is absent; no relevant configured environment-variable names were present. | No authenticated Google Ads Keyword Planner, DataForSEO, Ahrefs, or Semrush access was established. Search samples do not substitute for volume, difficulty, localized rank, or full backlink metrics. |
| Durable leads/purchases and collector | Repository contracts and the parallel [technical/tracking audit](technical-tracking-audit.md) are available. | No authorized production aggregate query or collector acknowledgement export was read in SEO-02. Organic qualified inquiries, paid orders, revenue, refund-adjusted value, and GA4 reconciliation remain **unavailable**, not zero. |

Browser discovery used a separate Codex in-app browser. The main agent's Chrome audit session was not reused. Existing authentication worked; no new Google access, account setup, or permission grant was performed.

## Baseline methodology and completeness

- **Property:** URL prefix `https://www.driverightcarbuying.com/`.
- **Timezone:** Pacific Time (`America/Los_Angeles`), per GSC's daily reporting convention. Do not silently compare it with an unverified GA4 timezone. [Google discrepancy guidance](https://support.google.com/webmasters/answer/17010575)
- **Extraction date:** September 18 PDT / September 19 UTC, 2026. GSC reported “Last update: 6.5 hours ago” during capture; latest complete report date was September 16.
- **Filters:** Search type Web; all countries/devices; no query/page/search-appearance filter. The 24-hour and generative-AI-specific reports were not used.
- **Window:** August 20–September 16 inclusive (28 days); comparison July 23–August 19 inclusive (28 days). Both derived from the same observed daily series.
- **Totals:** GSC chart reads 27 clicks, 2.52K impressions, 1.1% CTR, position 26.4 for the current window. Exact daily sum is 27/2,518, matching device and country sums. Calculated CTR is 1.0723%, so the 1.1% card is a rounded display.
- **Dimensions:** All 205 query rows, 30 page rows, 58 country rows, and 3 device rows were read. These are separate marginal breakdowns, not a combined query × page × device × country export. Query-to-page assignments in the map are editorial recommendations, not claimed observed URL/query pairs.
- **Suppression/aggregation:** The query table omits anonymized queries; the observed 22-click/1,373-impression difference cannot be assigned to brand/non-brand. Page totals can also differ because page and property aggregation differ. [Google report definitions](https://support.google.com/webmasters/answer/7576553), [data discrepancies](https://support.google.com/webmasters/answer/17010575)
- **Privacy:** Retain aggregates and selected nonpersonal query terms. Do not commit unrestricted exports or customer-level joins. Missing metrics remain blank/`unavailable`.

The numeric baseline, history, device/country/page summaries, repeatable export shape, and business-event definitions are in [baseline-template.md](baseline-template.md).

## Brand segmentation

Normalize case and surrounding whitespace. Version 1 exact-brand candidates are `drive right`, `driveright`, `drive right car buying`, `driveright car buying`, optional trailing `service`, and the `driverightcarbuying.com` domain. Keep ambiguous dealer-like variants in a separate bucket: `drive right auto`, `driveright auto sales`, `drive right automotive`, `right drive`, `rightdrive`, `drivewrite`, and geographic/dealer extensions. A lexical match does not prove brand intent.

| Reported query segment, current 28 days | Rows | Clicks | Impressions |
| --- | ---: | ---: | ---: |
| Exact lexical brand match | 1 | 0 | 1 |
| Ambiguous brand-like variants | 12 | 2 | 53 |
| Remaining reported non-brand queries | 192 | 3 | 1,091 |
| Reported query total | 205 | 5 | 1,145 |
| Unassigned difference from property totals | Not a query count | 22 | 1,373 |

Even the exact lexical `drive right` row can refer to another business. Do not use this small sample to claim brand recognition. Preserve the variant list across comparisons; review new variants separately.

## Query-to-page ownership

[query-map.csv](query-map.csv) distinguishes measured GSC query rows from exploratory seeds; blank metrics mean unmeasured. Priorities are based on service fit, observed impressions where available, and existing-page readiness, not invented search volume.

| Intent | Preferred existing URL | Implementation direction |
| --- | --- | --- |
| Nationwide car-buying service and broad concierge | `/` | Explain the remote service, actual deliverables, buyer control, and Austin base. Lead with $295 Full Service; keep $895 Concierge as supported additional scope. |
| Service cost, fee, and plan comparison | `/schedule.html` | Show two active offers, fee exclusions, scope differences, and next steps. Do not keep an AI price as a new-sale option. |
| Negotiation help and process | `/how-it-works.html` | Explain how quotes/recommendations reach the buyer, what the buyer approves, seller participation, and work outside the fee. |
| Brand identity and evidence | `/about.html` | Use supported business facts and actual proof; do not imitate competitors' credentials or savings claims. |
| Resource discovery | `/blog.html` | Keep the existing Resources URL. Link released resources, and keep draft/review labels and release gates. |
| Quote comparison and below-MSRP evaluation | `/blog-buy-new-car-below-msrp.html` | Preserve its review status. Add the SEO-06 worksheet as a utility when eligible; compare the whole quote, not just discount. |
| Dealer add-ons | `/blog-dealership-addons-complete-guide.html` | Source-backed buyer questions and line-item worksheet; preserve required review. |
| Used-car inspection | `/blog-used-car-inspection-checklist.html` | Separate buyer observations from a qualified independent inspection, with practical questions and limitations. |

The retired `/ai-car-buying-agent.html` is a transition route to `/schedule.html`, not a query-growth target. City drafts remain private. Do not create a separate national landing page for every service synonym.

SEO-06's integrating owner selected `draft-artifacts/quote-comparison/index.html` as the private worksheet draft, with `/quote-comparison.html` proposed only after required approval. It is not a current public URL. Keep the existing below-MSRP guide as the explanatory intent owner; link the utility when its release becomes eligible.

## Five observed competing pages

All pages were opened through public browsing on September 18 PDT / September 19 UTC, 2026. The sample is **exploratory**: location, personalization, engine ordering, search volume, and rank were not controlled. Competitor statements below describe their pages, not independently verified results or licenses. Fee snapshots are not feature-equivalent price comparisons.

| Page and dated source | Observed content/offer | Specific Drive Right opportunity |
| --- | --- | --- |
| [CarEdge pricing](https://caredge.com/pricing), checked 2026-09-18 PDT; `/concierge` redirected here | Page displays $999 human Concierge and a separate $49.99 beta AI offer; compares human contact, negotiation, paperwork, timing, logistics, and customer approvals. | Give $295 Full Service and $895 Concierge a clear responsibility/scope comparison. Define excluded vehicle costs and approval points. Retire Drive Right's AI sale coherently; do not copy competing outcome or speed promises. The older search snippet was stale compared with the opened page. |
| [Motosaic homepage](https://www.motosaic.com/), checked 2026-09-18 PDT | Connects discovery, shortlisting, test-drive decisions, deal structure, and delivery. Explains a Charlotte base with remote national reach. Fee depends on scope and is confirmed before work; visible FAQs address pre-owned fit and the buyer's responsibilities. | Explain the national remote workflow and what an actual deliverable looks like. Preserve a visible fixed fee for the supported Drive Right plans. Use labeled worked examples until permissioned customer evidence exists; do not imitate the site's savings/time or credential claims. |
| [Car Concierge homepage](https://www.gocarconcierge.com/), checked 2026-09-18 PDT | Displays $900 Standard, $1,000 with trade-in help, and $1,200 luxury service; describes payment stages, scope, nationwide sourcing, and a stepwise process. Links cost and add-on explainers. | Make the one-time Drive Right fee, what Concierge adds, and out-of-scope vehicle expenses easy to scan. Connect the national pages with approved explanatory content. Do not borrow “licensed broker,” fiduciary, delivery, or financing scope without Drive Right evidence. |
| [Car Deal Audit quote checker](https://cardealaudit.com/dealer-quote-checker), checked 2026-09-18 PDT | Offers browser-based quote-line entry, separates vehicle price/fees/add-ons/credits, flags reconciliation against a stated total, and links a side-by-side comparison tool. The page shows a source-review date and a worked example. | SEO-06 should make missing inputs, conditional incentives, and quote differences explicit; provide a printable result with no data submission. The guide can explain how to request an itemized quote. Keep taxes user-entered; do not copy state-calculator assumptions. |
| [Edmunds used-car inspection guide](https://www.edmunds.com/car-buying/inspect-that-used-car-before-buying.html), checked 2026-09-18 PDT | Named author Peter Gareffa; page dated September 19, 2025. Explains records, exterior/interior checks, test drives, limits of history reports, and the role of a professional inspection. | Keep the Drive Right guide action-oriented with buyer questions, an inspection request template, and clear limits. Its release still needs the required technical/safety reviewer; a checklist is not a diagnosis or an assurance of vehicle condition. |

Searches used to discover the sample: `nationwide car buying concierge service cost negotiation help CarEdge CarPal Automatch`; `car buying service compare dealer quotes add ons pre purchase inspection checklist`; `site.edmunds.com used car inspection checklist buying`. Sources were opened directly before recording current observations. No ranking or volume estimate is attached to these searches.

## Tracking handoff to SEO-07

[Live container Version 6](https://tagmanager.google.com/#/versions/accounts/6349220223/containers/249056149/versions/6) has seven tags: Google Tag `AW-18071301983`, Conversion Linker, Microsoft Clarity, and Google Ads conversion tags for Book Appointment, Call Button, Schedule Free Call, and Submit Lead Form. No GA4 measurement ID or tag was visible. A Google Ads destination is not a GA4 property ID.

| Existing live trigger | Verified condition | Meaning for the release packet |
| --- | --- | --- |
| Book Consultation | All Elements; Click Text contains `Book Consultation` | Legacy CTA conversion; not paid-order evidence. |
| Book Now — $1,850 | All Elements; Click Text contains `Book Now — $1,850` | Stale offer text; do not retarget pricing text as a purchase event. |
| Book Now — $795 | All Elements; **Click Target** contains `Book Now — $795` | Stale and mismatched click-field condition. |
| Call Button | All Elements; Click Text contains the public business phone number | Phone intent only, not a qualified inquiry. |
| Schedule Free Call | All Elements; Click Text contains `Schedule Free Call` | CTA intent only. |
| Form Submission | Form Submission; **All Forms** | Can fire independently of durable API receipt; must not represent verified leads. |
| All Elements | No tag attached in the displayed version | Do not infer useful business measurement. |

Prepare an account-specific draft mapping for the existing `cta_click`, `phone_click`, `generate_lead`, and `begin_checkout` contracts; map server-verified `purchase` and `onboarding_complete` through the approved collector. Reconcile/remove duplicate legacy business-conversion counting in that reviewed draft. Confirm destination/consent configuration and receipt semantics before activation; do not simply install another overlapping tag. This research did not create a GTM workspace, edit tags, publish, or send test events.

## Remaining dependencies and next action

| Dependency | Status | Exact next action |
| --- | --- | --- |
| Core national offer/copy | `verified_local` research input ready | SEO-01/04 owner can use this map immediately; no analytics-access dependency blocks the $295/$895 copy and retirement work. |
| GSC repeatability | `verified_live` browser access | Reuse the observed property; for future programmatic extraction request `webmasters.readonly` access if desired. Do not ask for GSC access again while this authenticated browser remains available. |
| Drive Right GA4 | `waiting_for_access` | Identify the numeric property and stream, timezone, and read access, or provide a sanitized aggregate export for August 20–September 16 and July 23–August 19. Do not create a property under this prompt. |
| Lead/payment/collector reconciliation | `waiting_for_access` | Supply authorized aggregate durable lead/purchase/outbox/collector records for those dates with deduplication/qualification rules; record `unknown` where qualification is absent. No customer details needed. |
| Keyword volume/history | `waiting_for_access` | Connect an existing authorized source or provide a dated US-wide keyword/ranking export with device, location, method, and metric definitions. This is optional to local implementation. |
| Content claims/customer evidence | `waiting_for_evidence` | SEO-05/06 retain exact-copy/subject/permission requirements. Search demand does not waive them. |

One consolidated access question for the coordinator's handoff: **Which Drive Right GA4 property and approved collector should be used, and can read access or sanitized organic lead/purchase aggregates for August 20–September 16 and July 23–August 19 be made available?** GSC and GTM access are already verified; this asks for missing measurement identity/evidence, not permission to implement the authorized repository work.

## Checks performed

- Read `AGENTS.md`, runbook, SEO-02 prompt, current preferred URLs, sitemap, and operations/tracking evidence.
- Confirmed selected GSC property before using figures; unrelated account metrics were not retained as Drive Right evidence.
- Read all available rows for each stated GSC breakdown; validated 28-day click/impression totals three ways and 164-day history length.
- Opened all five competitor sources; avoided stale search-snippet prices where direct content differed.
- Verified GTM live-version label and exact form trigger without account mutation.
- Validation passed: **35 unique CSV rows** (16 observed GSC queries, 19 exploratory seeds), every preferred URL resolves to an existing repository HTML file, seed metrics stay blank, and date/numeric fields are valid. The 164-day/monthly, device/country, and brand-segment arithmetic reconciles. This document-only task does not require application unit tests.
- No live business reconciliation is claimed; missing GA4/collector evidence remains open.
