# SEO priority execution — September 25, 2026

Executed against `a1c3597` in America/Chicago; public checks also fall on September 26 UTC. Released through [PR #76](https://github.com/m1jenkins/Barton/pull/76) at production revision `444a053264da214251b97e5e5e492879b5246d4b`; see the release verification below. This records implementation of the [growth plan](2026-09-25-seo-growth-plan.md), not a second audit. [Sanitized evidence](2026-09-25-seo-execution-evidence.json) contains the URL matrix, account observations and verification limits.

## Completed actions

| Plan item | Result | Remaining boundary |
|---|---|---|
| A02 discovery | Resubmitted the existing eight-URL sitemap. Google displayed **Sitemap submitted successfully**. Requested indexing of the service explainer; Google accepted it into the priority crawl queue. | A submission is not indexing. Sitemap report still showed last read September 19 and seven discovered pages immediately after submission. |
| A02 core-page verification | Individually inspected all six intended indexed pages. All use the inspected URL as Google's selected canonical. Requested a targeted Policy recrawl because its recorded crawl was August 20; Google accepted it. | Await actual recrawling; do not repeat accepted requests merely to seek a faster result. |
| A03 process correction | Replaced the pre-payment introduction step with payment followed by intake. Step 04 reuses the pricing page's existing Stripe instruction; step 05 preserves the existing scope/timing confirmation and buyer control. | A reviewed deliverable example is a separate open part of A03. No new commercial promise or checkout behavior was introduced. |
| A04 site name | Homepage `WebSite.name` now says **Drive Right**, keeping the existing alternate name, homepage URL, page title and Organization reference. | Production raw HTML and rendered schema verified after release; Google's later site-name selection remains unverified. |
| A05 freshness | Corrected Resources' inventory date from its actual September 22 reorganization; replaced the obsolete Texas draft-update label with its current pending-review status. Updated only three sitemap dates with specific supporting changes. | The Texas source-check date remains August 12. No new source review or guide approval is claimed. |
| A12 search baseline | Captured the preceding non-overlapping 28 days, exact impression values exposed by GSC's visible cards, and the complete page tables for both periods. | Qualified leads, orders, service revenue, GA4 account delivery and Bing remain unverified. |
| A13 factual cleanup | Updated existing `llms.txt` from Texas-only positioning to the already advertised nationwide service and added the service-explainer link. | No AI visibility lift is claimed; prompt-panel waves remain open. |

At the initial execution checkpoint, website changes were local and uncommitted, while the Google submissions above were completed account actions. The website changes are now deployed as recorded below. No DNS write, customer communication, payment, new guide release or city release occurred.

## Google index matrix

Each indexed page reported a successful fetch by Googlebot smartphone, crawl/indexing allowed, and the intended self-canonical. Crawl times below are exactly the displayed GSC values; the inspection UI did not state their timezone.

| Intended URL | State | Last crawl displayed | Action |
|---|---|---|---|
| `/` | Indexed; selected canonical = inspected URL | Sep 25, 1:02:40 PM | Preserve; verify revised schema after deployment |
| `/about.html` | Indexed; selected canonical = inspected URL | Sep 25, 2:08:13 AM | Preserve |
| `/how-it-works.html` | Indexed; selected canonical = inspected URL | Sep 25, 11:47:40 AM | Corrected process locally; verify after deployment |
| `/schedule.html` | Indexed; selected canonical = inspected URL | Sep 25, 7:28:03 PM | Preserve |
| `/blog.html` | Indexed; selected canonical = inspected URL | Sep 22, 5:46:24 PM | Preserve review gates |
| `/policy.html` | Indexed; selected canonical = inspected URL | Aug 20, 5:57:11 AM | Targeted recrawl accepted; sitemap field says temporary processing error |
| `/car-buying-service.html` | Discovered, currently not indexed; sitemap recognized | None | Indexing request accepted after Google's live check |
| `/texas-local-market-intelligence.html` | Unknown to Google; no referring sitemap detected in this inspection | None | Strengthen approved local usefulness before requesting indexing |

The service explainer's earlier audit state was unknown; the implementation inspection showed it discovered with the sitemap recognized. The Texas hub's latest inspection differs from the earlier discovered state. These are two dated observations, not proof that submission caused either change. Keep the original audit evidence unchanged.

## Search comparison

Web (text), no query/page/country/device filters. Dates are the GSC reporting dates without conversion to the observer's timezone. Exact impressions below come from accessible labels on the visible cards, not an export.

| Metric | Jul 30–Aug 26 | Aug 27–Sep 23 |
|---|---:|---:|
| Property clicks | 46 | 21 |
| Property impressions | 3,720 | 1,687 |
| Displayed CTR | 1.2% | 1.2% |
| Displayed average position | 23.7 | 26.2 |
| Homepage clicks | 23 | 17 |
| Homepage impressions | 721 | 1,067 |
| Pricing clicks / impressions | 2 / 35 | 1 / 35 |

Property and page aggregation differ. Do not sum page impressions to reproduce property totals. Unreported URLs remain unavailable rather than being assigned zero. The current intended commercial pages and the contained archive had different trends; this comparison does not establish that pricing, containment or recent design changes caused the property-level decline. The separate three-month Google AI report is not mixed into these windows.

## Freshness decisions

| File / sitemap URL | Date decision | Evidence |
|---|---|---|
| Homepage | `2026-09-25` | Preferred site-name structured data corrected in this change |
| Process | `2026-09-25` | Material checkout-sequence correction in this change |
| Service explainer | `2026-09-23` | `76ce94a` added FAQPage data matching visible questions; important structured data change |
| Resources | Keep sitemap `2026-09-22`; visible inventory date now matches | `9cadb03` reorganized the inventory into service guides and guides still in review; the current edit corrects the historical label |
| Texas hub | Keep sitemap `2026-09-22`; keep source-check date August 12 | This change only corrects a status label; no newly reviewed local material |
| About, Pricing, Policy | Retain existing dates | Later shared-navigation/layout and disclaimer changes are not used for a blanket editorial date bump; no terms effective date is invented |

Future releases should update a page's sitemap date alongside meaningful content or structured-data changes, and record source checks separately from publication and editorial updates. [Google's sitemap guidance](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap) supports accurate significant-update dates; [site-name guidance](https://developers.google.com/search/docs/appearance/site-names) supports a concise brand name in the existing WebSite node.

## Verification

- Node `24.20.0`; site validation passed for 65 HTML files and eight sitemap URLs.
- All 181 existing tests passed. The first sandbox run could not bind loopback sockets in three preview tests; the full permitted run passed all three as well. No test was weakened or skipped.
- API syntax, all four private metro drafts, all 20 private city drafts and their hub, redirect configuration (15 permanent rules), and whitespace checks passed.
- The exact revised WebSite snippet passed Schema.org Markup Validator: one WebSite, zero errors, zero warnings. Full-document parsing also confirmed one site node and the existing Organization reference. This is not a Google site-name selection result.
- Local browser check at 390×844 confirmed payment precedes intake. Followed Process → Pricing and selected both plans: each immediately attempted checkout and reached the preview's expected no-credentials error, without a pre-payment contact form. Existing direct-checkout tests separately passed. No live card or payment session was used.
- No CSS/JS assets changed, so no homepage asset-hash update was needed. Noindex, canonicals, eight-URL sitemap membership, legacy city hashes and protected editorial/Tesla containment remain intact.

## Work requiring another input or a later release

The legacy apex still returns NOERROR with zero A/AAAA answers; `https://www.austincarbuyingservice.com/about.html` still returns 308 to the matching canonical page. DNS/hosting administrator access was not established, so A01 remains open. A repository redirect cannot repair missing DNS.

A07–A11 remain governed by the existing exact-copy, qualified-review, compensation, customer-permission and local-evidence gates in [claim review](../claim-review-workflow.md) and [release readiness](../release-readiness.md). Preparing more unapproved claims would not complete those items. A06 production performance work and the rest of A12/A13 were not represented as complete.

Release follow-up is recorded below. No recurring monitor was created.

## Release review — September 25/26, 2026

The original `design/caption-trim` working tree was preserved. Latest `origin/main` (`3e49b58`) has the same tracked file tree as `a1c3597`; its design changes were already merged. The focused `codex/seo-execution-release` branch contains only the seven SEO site/data edits and the associated execution, audit and baseline records. Draft cleanup PR #74 and the local interactive planning artifact are outside this release.

Review confirmed that payment precedes intake in `buying/app.js` (`startDirect`) and the server-verified confirmation pages. The process correction reuses the existing Stripe instruction and retains buyer control. Prices stay $295/$895; no checkout code, assets, source-review dates, editorial release gates, metro hashes or Tesla disposition changed. The homepage retains a single WebSite node, its alternate name, canonical URL and Organization reference. Date changes match the documented significant edits. No blocking review finding remains.

Fresh validation used Node `24.13.0`: locked dependency installation, site validation (65 HTML files, eight sitemap URLs), API syntax, buying syntax, four private metro drafts, 20 private city drafts plus hub, 15 permanent redirect rules, all 181 tests, and whitespace checks passed.

Authenticated Search Console follow-up: Policy now shows **September 25, 2026, 9:35:54 PM** as its last crawl, a successful Googlebot smartphone fetch, crawl/indexing allowed, and the inspected URL as both declared and Google-selected canonical. Its sitemap is now recognized, replacing the prior temporary-processing-error observation. The service explainer remains **Discovered — currently not indexed**, with the sitemap recognized and no crawl/canonical yet. These are observed states, not proof that the requests caused a change. Neither request nor the sitemap was resubmitted. GSC does not state the crawl timestamp timezone.

### Deployed revision and public verification

[PR #76](https://github.com/m1jenkins/Barton/pull/76) merged as **`444a053264da214251b97e5e5e492879b5246d4b`**. Vercel production deployment **`dpl_2vnWdmfu2DWfqAWCud7SQ5SE8YCo`** is READY ([deployment](https://vercel.com/m1jenkins-projects/barton/2vnWdmfu2DWfqAWCud7SQ5SE8YCo)). The checked preview was `f2567830f1f6f79de17d9aebd61a37c734098987`, deployment `dpl_7XxzzoTxN93Lno49nfHP68vFj6iV`; preview and merged public source match. PR checks passed 3/3 and the merged-main [Node 24 run](https://github.com/m1jenkins/Barton/actions/runs/36213802862) succeeded. The evidence follow-up changes deployment-excluded documentation only.

[Durable public verification](2026-09-25-seo-release-verification.json) records the response matrix and timestamps (September 25 America/Chicago, September 26 UTC):

- **Payment and intake:** production raw HTML and browser show payment at step 04, intake after verification at step 05; obsolete introduction copy is absent. Pricing remains $295/$895. Both checkout modules match source exactly. A direct unpaid Full Service confirmation visit says payment could not be verified and does not expose intake or record a purchase. No live checkout session or payment was created; paid success/analytics reconciliation remain separate dependencies.
- **Site name:** exactly one rendered and raw WebSite node, named Drive Right, retaining its alternate name, canonical homepage URL and Organization reference. This proves deployment, not Google's eventual site-name choice.
- **Sitemap:** eight URLs and exact source match. Home/process dates are September 25; service explainer September 23; other dates unchanged. Resources' visible date is September 22, guide reviews remain pending, and Texas retains its August 12 source check.
- **Canonicals and indexing:** all 58 direct HTML pages match source after the identified Cloudflare email-protection/beacon transformations; all eight intended indexed URLs are 200 with self-canonicals and `index, follow`. The other 50 direct HTML pages retain `noindex, follow`. Seven existing redirects remain, including retired AI to Pricing. All legacy city pages and protected legal/finance/safety guides remain contained. Tesla remains 200, self-canonical, `noindex, follow`, off sitemap, without a redirect.
- **Deployment exclusions:** sampled documentation, governance data, private metro/city drafts and validation scripts return 404. No draft publication or gate changes occurred. All original working-tree SEO files retain their starting hashes; unrelated cleanup PR #74 and the local interactive artifact remain untouched.
- **Redirects:** all 14 live permanent, query-preserving one-hop checks passed. The legacy apex is outside that www-host matrix and still returns NOERROR with zero A/AAAA answers.
- **Browser limits:** preview and production process/pricing/schema were inspected. The requested 390px viewport override did not take effect (actual width 744px), so this follow-up does not claim a fresh 390px check; the earlier local mobile observation above remains historical. No CSS or behavior changed.

Search Console's sitemap report now shows **last read September 25, Success, eight discovered pages**, up from September 19/seven. This observation predates Google's fetch of the newly deployed sitemap dates; no post-deploy fetch is claimed. Policy recrawl progress and the service explainer's pending state are recorded above. No indexing or sitemap request was resubmitted.

### Remaining dependencies and next task

**Highest-value next task: restore DNS for `austincarbuyingservice.com` at the authoritative DNS/hosting account, then verify its HTTPS certificate and permanent path/query-preserving redirects to the canonical www site.** The intended destination must be confirmed from the hosting configuration; do not guess an address or change the working legacy www record. Administrator access/confirmation remains the dependency. The current repository redirect cannot fix missing DNS.

Also open: Google's crawl/index decision for the service explainer and eventual site-name selection; the reviewed deliverable example; compensation attestation/customer permission and individual guide/worksheet/local release reviews; GA4/Bing account and qualified-lead/order/revenue reconciliation; current performance evidence and AI prompt-panel waves. These remain separate work and none is represented as completed by this release. No recurring monitor was created.
