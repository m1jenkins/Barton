# SEO priority execution — September 25, 2026

Executed against `a1c3597` in America/Chicago; public checks also fall on September 26 UTC. Released through [PR #76](https://github.com/m1jenkins/Barton/pull/76) at production revision `444a053264da214251b97e5e5e492879b5246d4b`; see the release verification below. This records implementation of the [growth plan](2026-09-25-seo-growth-plan.md), not a second audit. [Sanitized evidence](2026-09-25-seo-execution-evidence.json) contains the URL matrix, account observations and verification limits.

## Completed actions

| Plan item | Result | Remaining boundary |
|---|---|---|
| A01 legacy apex | Added the Vercel-confirmed Cloudflare apex A record; valid auto-renewing certificate and canonical 308 now verified through public DNS. Both public-recursive and normal-system-resolver live matrices pass 14/14 per host. | No remaining DNS, certificate or access dependency; existing permanent HTTP chains are recorded below. |
| A02 discovery | Resubmitted the existing eight-URL sitemap. Google displayed **Sitemap submitted successfully**. Requested indexing of the service explainer; Google accepted it into the priority crawl queue. | A submission is not indexing. Sitemap report still showed last read September 19 and seven discovered pages immediately after submission. |
| A02 core-page verification | Individually inspected all six intended indexed pages. All use the inspected URL as Google's selected canonical. Requested a targeted Policy recrawl because its recorded crawl was August 20; Google accepted it. | Await actual recrawling; do not repeat accepted requests merely to seek a faster result. |
| A03 process correction | Replaced the pre-payment introduction step with payment followed by intake. Step 04 reuses the pricing page's existing Stripe instruction; step 05 preserves the existing scope/timing confirmation and buyer control. | A reviewed deliverable example is a separate open part of A03. No new commercial promise or checkout behavior was introduced. |
| A04 site name | Homepage `WebSite.name` now says **Drive Right**, keeping the existing alternate name, homepage URL, page title and Organization reference. | Production raw HTML and rendered schema verified after release; Google's later site-name selection remains unverified. |
| A05 freshness | Corrected Resources' inventory date from its actual September 22 reorganization; replaced the obsolete Texas draft-update label with its current pending-review status. Updated only three sitemap dates with specific supporting changes. | The Texas source-check date remains August 12. No new source review or guide approval is claimed. |
| A12 search baseline | Captured the preceding non-overlapping 28 days, exact impression values exposed by GSC's visible cards, and the complete page tables for both periods. | Qualified leads, orders, service revenue, GA4 account delivery and Bing remain unverified. |
| A13 factual cleanup | Updated existing `llms.txt` from Texas-only positioning to the already advertised nationwide service and added the service-explainer link. | No AI visibility lift is claimed; prompt-panel waves remain open. |

At the initial execution checkpoint, website changes were local and uncommitted, while the Google submissions above were completed account actions. The website changes are now deployed as recorded below. At that initial checkpoint, no DNS write, customer communication, payment, new guide release or city release occurred; the later DNS repair is recorded below.

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

At the release checkpoint, the legacy apex returned NOERROR with zero A/AAAA answers while legacy www redirected correctly. The initial follow-up below established hosting access; the final follow-up restores DNS and verifies a valid certificate and permanent redirects through public resolvers. A repository redirect cannot repair missing DNS.

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

**Highest-value next task: inspect the service explainer’s subsequent crawl/index state and Google-selected canonical in Search Console, read-only.** Its accepted indexing request and the sitemap must not be resubmitted. Legacy apex DNS, certificate and redirect acceptance through both public-recursive and normal system DNS are now complete as recorded below.

Also open: Google's crawl/index decision for the service explainer and eventual site-name selection; the reviewed deliverable example; compensation attestation/customer permission and individual guide/worksheet/local release reviews; GA4/Bing account and qualified-lead/order/revenue reconciliation; current performance evidence and AI prompt-panel waves. These remain separate work and none is represented as completed by this release. No recurring monitor was created.

## Legacy-apex follow-up — September 25/26, 2026

**Initial checkpoint: partial remediation; superseded by the completed DNS/hosting repair below.** [Dated verification evidence](2026-09-25-legacy-apex-verification.json) records the authenticated account reads, exact hosting mutation, authoritative/public DNS answers, certificate failures, and both repository live matrices. Work started from `31a835f` in an isolated `codex/legacy-apex-dns` worktree; the original `design/caption-trim` working tree and cleanup PR #74 were not changed.

### Authority, hosting and exact change

- Cloudflare is authoritative: `lloyd.ns.cloudflare.com` and `yolanda.ns.cloudflare.com`. An authenticated read confirms the active `austincarbuyingservice.com` zone and the same nameservers as both authoritative servers and public resolvers. Exact account/zone identifiers are supplied separately to the owner and excluded from this public repository.
- The existing Vercel `barton` project, already owns and verifies both legacy hosts. The apex previously had `redirect: www.austincarbuyingservice.com`, `redirectStatusCode: null`. Only that existing apex domain was PATCHed to **`redirect: www.driverightcarbuying.com`, `redirectStatusCode: 308`**, at **2026-09-26 03:27:59 UTC**. A fresh project-domain listing confirmed all four other entries, including working legacy www, unchanged. This is an account setting, not a `vercel.json` edit or a content deployment. Its public HTTPS behavior is still unverified because DNS/TLS fail below.
- Authenticated `GET /v6/domains/austincarbuyingservice.com/config` returned `configuredBy: null`, `misconfigured: true`, no A values, and rank-1 recommended IPv4 values **`216.150.1.1` and `216.150.16.1`**. These came from this hosting account, not a generic IP guess. The [Vercel API contract](https://vercel.com/docs/rest-api/domains/get-a-domain-s-configuration) explicitly permits using one preferred IP; the narrow pending change uses the first.
- **No DNS record was changed.** A normal refresh restored the existing Wrangler session’s zone-read access, but DNS record listing returned HTTP 403 / Cloudflare code 10000 (`Authentication error`). The OAuth scopes lack DNS access despite the user’s zone role reporting DNS permissions. The browser dashboard was signed out. Access needed: an authenticated dashboard session with DNS edit permission for this exact zone, or a zone-restricted API token with **Zone → DNS → Edit** and **Zone → Zone → Read**. No new credential or permission grant was created.

### Original DNS administrator handoff (now applied)

The initial handoff specified the following record, after checking for a competing apex A/CNAME. The final browser-assisted follow-up below applied it:

| Field | Value |
|---|---|
| Type | `A` |
| Name | `@` (`austincarbuyingservice.com`) |
| IPv4 address | `216.150.1.1` |
| Proxy status | **DNS only** (`proxied: false`) |
| TTL | `300` seconds |

Keep both nameservers, every email/unrelated DNS record, and `www CNAME 172ff48f5e356dac.vercel-dns-017.com` (observed TTL 600) unchanged. Do not add an AAAA record, replace the zone, or change Cloudflare security/rules. DNS-only sends this new host to Vercel directly, consistent with [Vercel’s Cloudflare guidance](https://vercel.com/kb/guide/cloudflare-with-vercel). This does not change the proxy status of any existing record. Full zone inventory could not be read; public apex MX/TXT/CAA queries returned no records, which is not proof that no email or verification records exist at other names.

### Initial acceptance results before DNS access

| Check | Observed result |
|---|---|
| Authoritative DNS | Both Cloudflare nameservers: apex A and AAAA **NOERROR, zero answers**. Nameservers unchanged. |
| Public DNS | `1.1.1.1` and `8.8.8.8`: same empty apex A/AAAA result. Negative-response SOA TTL/minimum is 1,800 seconds. |
| Ordinary public apex HTTPS | Root, query-bearing root, About, Process, Pricing, Texas hub, Tesla park and legacy inquiry probes all fail DNS resolution (`curl` exit 6). No public redirect pass is claimed. |
| Apex certificate | DNS-based TLS connection fails resolution. Forced-address/SNI diagnostics to **both** Vercel-confirmed rank-1 addresses fail hostname validation; a valid apex certificate is not yet being served there. TLS verification stayed enabled. |
| Forced-address HTTP diagnostic | The About URL returns 308 to HTTPS on the same apex with the full query intact. This is not a public DNS, valid-TLS, or canonical-host redirect pass. |
| Working legacy www | Valid hostname/chain/date certificate (Let’s Encrypt YR2; Aug 3–Nov 1, 2026). Existing root/About migrations remain 308 and preserve queries. |
| Repository www live matrix | **14/14 passed**, including permanent statuses, complete query preservation and terminal 2xx targets. |
| Repository explicitly using legacy apex | **12 passed, 2 failed**: its root and About migration checks fail DNS resolution. This prevents the www-only pass from concealing the apex outage. |
| Node 24 local checks | Node `24.20.0`; `npm ci`, site/API/metro/city checks, 15-rule redirect config, all **181 tests**, and whitespace validation passed. |

Live commands (run both after repair):

```sh
BASE_URL=https://www.driverightcarbuying.com LEGACY_BASE_URL=https://www.austincarbuyingservice.com node scripts/check-redirects.mjs
BASE_URL=https://www.driverightcarbuying.com LEGACY_BASE_URL=https://austincarbuyingservice.com node scripts/check-redirects.mjs
```

After the DNS write, check both authoritative servers and public resolvers, allowing existing negative caches to expire. Confirm Vercel detects the A record and serves a trusted, unexpired certificate whose SAN covers the apex; if issuance remains blocked, inspect that domain’s certificate/configuration status in the same Vercel project. Repeat ordinary public HTTPS root and representative path probes without `--resolve`, including `utm_source=redirect-validator&utm_campaign=query-preservation&seo_redirect_probe=keep%2Bme&multi=one&multi=two&space=a%20b`. Each HTTPS host migration must be a permanent redirect to the matching canonical path with the exact query preserved; follow to its terminal response. Existing retired paths such as `/inquiry.html` can additionally perform their already-approved canonical-site route redirect. Verify the final Tesla target still returns 200 with `noindex, follow`, self-canonical and no sitemap membership.

No pricing, checkout, guide/city/Tesla release gates, source dates, sitemap membership or content changed. No Search Console inspection/indexing request or sitemap submission was made in this follow-up. At this initial checkpoint, DNS, certificate and public redirect acceptance were dependencies; the final follow-up below supersedes that status.

## Legacy-apex completion — September 25/26, 2026

**The DNS and hosting repair is applied and passes both public-recursive and normal-system-resolver verification.** The user supplied an authenticated Cloudflare browser session. [Completion evidence](2026-09-25-legacy-apex-completion.json) preserves the final DNS, TLS, full redirect chains and repository matrix results separately from the earlier failed checkpoint.

The legacy zone contained exactly two records before the change: the DNS-only `www` CNAME and `_vercel` verification TXT, both with TTL 600. Added **one `A @ → 216.150.1.1`, DNS only, TTL 300** after re-reading Vercel’s rank-1 recommendation. A full dashboard reload showed all three records and confirmed both original records’ values, TTLs and proxy states unchanged. Nameservers remain `lloyd.ns.cloudflare.com` and `yolanda.ns.cloudflare.com`; no email or unrelated record was changed. First authoritative and public confirmation was **2026-09-26 03:51:54 UTC**.

Vercel now reports `configuredBy: A`, `aValues: [216.150.1.1]`, `misconfigured: false`, no conflicts, and HTTP-01 certificate eligibility. Because HTTPS initially still served a nonmatching certificate, requested a Vercel-managed certificate **only for the legacy apex**. Issuance succeeded, and its account metadata confirms automatic renewal. The served certificate is **Let’s Encrypt YR1**, SAN `austincarbuyingservice.com`, valid **September 26, 2026 02:55:34 UTC through December 25, 2026 02:55:33 UTC**. TLS 1.3, trust chain, hostname and dates passed from both public-resolver paths. All Vercel project-domain settings remain identical to the earlier verified hosting fix, including the direct canonical-host 308 and the working www host.

| Final verification | Result |
|---|---|
| Both authoritative nameservers; public `1.1.1.1` and `8.8.8.8` | Apex A returns `216.150.1.1`; authoritative TTL 300. AAAA remains absent; no guessed IPv6 record added. |
| Explicit HTTP/HTTPS matrix | **20/20 passed** using fresh recursive DNS from each public resolver, with certificate validation enabled and no fixed connection addresses. |
| HTTPS root and real paths | Root, query-bearing root, About, Process, Pricing, Texas hub and Tesla park return **308 directly to the matching canonical www URL**, then 200 with the intended self-canonical. |
| Query preservation | Exact `utm_source`, `utm_campaign`, encoded `keep%2Bme`, duplicate `multi` keys, and `space=a%20b` retained throughout every tested chain. |
| Existing route chains | HTTPS `/inquiry.html` migrates to the canonical same path, then its existing 308 to Pricing. HTTP root/About retain **two permanent 308 hops**: HTTPS apex, then canonical www. No temporary hop, loop or changed route destination. |
| Repository live matrices with public DNS | **14/14 www and 14/14 legacy apex passed** on Node `24.20.0`. The repository script and expectations were unchanged; the evidence includes the temporary public-DNS lookup adapter used to avoid the local stale negative cache. |
| Normal system-resolver matrix | **14/14 www and 14/14 legacy apex passed** on the final run at **2026-09-26 04:06:58 UTC**, using the unmodified repository script, normal system DNS, and default TLS validation, without the lookup adapter. |
| Preservation | Pricing still $295/$895. Tesla’s canonical target remains 200, `noindex, follow`, self-canonical, absent from the unchanged eight-URL sitemap. Existing www redirects pass. |
| Repository checks | Node `24.20.0`: locked install, site/API/metro/city checks, 15 permanent redirect rules, **181/181 tests**, and whitespace checks passed. |

**No DNS, certificate or hosting-access dependency remains.** Some DNS-over-HTTPS requests and this Mac’s ordinary resolver retained pre-change negative results during propagation (observed SOA negative TTL/minimum 1,800 seconds); a local cache flush did not immediately clear them. The final ordinary live runs now pass for both hosts. The evidence preserves those earlier failures separately and identifies the resolver used for each successful run. No system nameserver or hosts-file change, TLS bypass, new account grant, Search Console request or sitemap submission was made.

This completion changes documentation only in the repository. The original working tree, cleanup PR #74, pricing, checkout, guides/cities/Tesla restrictions, source dates, and all site assets remain unchanged. The service explainer’s subsequent Google crawl/index decision is the single highest-value next check; use read-only inspection and preserve the accepted requests.

## Service-explainer indexing follow-up — September 25/26, 2026

**No observed indexing change.** Read-only inspection at **September 25, 11:23 PM America/Chicago (September 26, 04:23 UTC)** still reports **Discovered — currently not indexed** for `https://www.driverightcarbuying.com/car-buying-service.html`. This follows the latest committed release-review observation, not the earlier “unknown to Google” audit. [Dated supporting evidence](2026-09-25-service-indexing-progress.json) contains the sanitized visible report transcription, comparison baseline, public response metadata and exact field availability.

Work started from `main` revision `dc15c6f3eee5b286e6a1fed0dd7c59ab83fa2d54` in an isolated documentation worktree. [PR #79](https://github.com/m1jenkins/Barton/pull/79) has already completed the legacy-apex repair; it is not an open dependency or evidence of a change in this URL's indexing.

| Google index inspection field | Current displayed result | Interpretation / comparison |
|---|---|---|
| Overall status | **URL is not on Google** | Confirmed displayed status; not indexed |
| Exclusion reason | **Discovered - currently not indexed** | Unchanged from the latest release review |
| Last crawl / crawled as | **N/A / N/A** | Unavailable; no new crawl information exposed |
| Crawl allowed? / page fetch / indexing allowed? | **N/A / N/A / N/A** | Unavailable, not confirmed failures or denials |
| Referring sitemap | `https://www.driverightcarbuying.com/sitemap.xml` | Still recognized |
| Referring page | **None detected** | Displayed result, not proof of no incoming links |
| User-declared canonical | **N/A** | Unavailable in Google's index report; the public HTML declaration is separately confirmed below |
| Google-selected canonical | **N/A** | Unavailable; no canonical selection can be claimed |

“View crawled page” is disabled. These are Google index-report values; no live URL test or indexing request was run. N/A does not establish that Google has never crawled the URL. There is no crawl timestamp to convert, and the inspection UI does not state a crawl timezone.

The existing **Sitemaps** report at **04:23:53 UTC** shows `/sitemap.xml`, type **Sitemap**, submitted **September 25, 2026**, last read **September 25, 2026**, **Success**, **eight discovered pages**, and **zero discovered videos**. This is unchanged from the latest committed release review. September 19/seven was the older initial checkpoint and is not the current comparison baseline. The report was read without submitting it; success and discovery counts do not establish indexing or a fresh fetch of the latest sitemap bytes.

Public GETs at **04:25:20–04:25:21 UTC** independently confirmed:

- The service URL returns **HTTP 200** directly, with `<meta name="robots" content="index, follow">`, no `X-Robots-Tag` response header, and exactly one canonical pointing to the inspected URL.
- `robots.txt` returns **200** and matches committed `main`. Its Googlebot group allows `/` and disallows only `/uuyh`, so it permits this page's path; it declares the canonical sitemap URL.
- `sitemap.xml` returns **200**, exactly matches committed `main`, and contains **eight URLs**. The service explainer appears **once**, with `lastmod` **2026-09-23**.

The initial Python urllib GET returned 403; normal curl GETs then returned 200, including the captured check above. The cause of that client-specific difference is unverified. A public 200 and permissive directives do not establish a successful Googlebot fetch or Google's indexing eligibility assessment; those GSC fields remain unavailable. No security setting was changed.

**Single highest-value next task: perform one later read-only URL Inspection of the service explainer on September 28, 2026, and record whether crawl/fetch and Google-selected canonical data have become available.** The current follow-up exposed no new Google crawl or canonical data. Keep the accepted request and sitemap submission intact; neither submission guarantees indexing. No recurring monitor was created.

This follow-up changes documentation and evidence only. No indexing request, sitemap resubmission, DNS/hosting write, pricing/content change, or guide/city/Tesla restriction change occurred. The original working tree and unrelated cleanup PR #74 are outside this change.

Validation for this documentation follow-up used **Node 24.20.0**: locked dependency installation, site validation (65 HTML files/eight sitemap URLs), API/buying syntax, four private metro drafts, 20 private city drafts plus hub, 15-rule redirect configuration, **181/181 tests** with no skips, and whitespace checks passed. All 20 pre-existing modified/untracked files in the original checkout retain their saved SHA-256 hashes.
