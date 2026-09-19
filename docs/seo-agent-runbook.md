# Drive Right SEO agent runbook

Prepared September 18, 2026, from the website review and owner decisions in the accompanying Codex conversation. This is an execution specification, not evidence that the tasks below have been implemented or published.

Copy-ready instructions are in [seo-agent-prompts.md](seo-agent-prompts.md). Start with its coordinator prompt, or run individual task prompts in the order below.

## Business decisions

- Target nationwide organic Google discovery and qualified purchases of Full Service.
- Full Service becomes **$295 USD, one-time service fee**. Retire the standalone **AI Agent Buying Service**. These two changes were explicitly requested by the owner; do not ask for that decision again.
- Default: Ultimate Concierge remains **$895** with its existing supported scope. Keep the buying-brief experience; discontinuing a paid AI offer does not mean deleting the brief parser.
- Retain the real Austin base while describing supported remote nationwide service. All-state/all-city availability was already confirmed in `data/services.json`; this does not establish local offices or specific logistics promises.
- Use dedicated weekly engineering, editorial, and outreach effort. Preserve the current design and static HTML architecture.
- Execution targets for the first 90 days: correct offer and checkout parity, reliable measurement, eight substantial guide releases/upgrades, one usable worksheet, and two permissioned customer stories where evidence exists. A clearly labeled worked example can replace an unsupported story.
- Rankings, traffic increases, reviews, earned links, customer permissions, and qualified approval are outcomes agents cannot promise or fabricate.

## What Codex can do

Capability observations below are session-specific. Recheck tools and account access at execution time.

| Work | Codex capability | Evidence or prerequisite |
| --- | --- | --- |
| Website copy, metadata, internal links, schema, redirects in code, tests | Direct execution | Repository and Node 24 are available. |
| Retiring AI purchases and implementing $295 Full Service | Direct repository implementation; connected activation | Existing checkout, payment ledger, webhook, onboarding, and tests are in this repository. Stripe activation is a separate coordinated step. |
| Public-site audit and search-result research | Direct execution | Public browsing and HTTP checks worked. General web search is not a controlled Google rank tracker or keyword-volume source. |
| Browser/mobile/accessibility checks | Direct execution | `chrome-devtools-axi` is installed; start a session when needed. Prefer it over other browser automation. |
| Vercel project inspection and deployment preparation | Connected capability, partly verified | Team/project listing succeeded and identified `barton`. `get_project` returned a connector argument-mapping error; inspect through other supported tools or an authenticated browser/CLI. Deployment/domain-write access was not verified. |
| Stripe prices and Payment Links | Connected capability, access not verified | Stripe read/write tools are exposed. Discover and confirm the correct business account and test/live mode before account operations. Do not infer access from an installed plugin. |
| GSC, GA4, GTM, Google Business Profile | Conditional execution | No dedicated connector surfaced in plugin discovery; the local `claude-seo` CLI and Google API configuration are absent. Use an available authenticated browser or properly scoped API access. If unavailable, request the specific access or export after completing independent work. |
| Keyword volumes, historical rankings, backlink exports | Conditional execution | Requires a suitable authorized data source. Public research can prepare candidate queries and outreach prospects without pretending those are measured volumes or a complete backlink profile. |
| Guides, worksheet, case-study drafts, outreach drafts | Direct preparation | Current primary sources, approved service facts, and supplied customer evidence determine what can be published. |
| Customer permission, factual business attestation, qualified legal/financial/safety review | Human input | Codex can organize evidence and exact-copy review packets; it cannot supply the underlying authority or invent reviewer sign-off. |
| Sending outreach or requesting reviews | Conditional execution | Prepare drafts and recipients first. Send only under explicit user instructions covering the communication. |

Do not classify an account task as inherently manual just because access is missing. Codex may execute it once the appropriate connection, authority, and concrete scope exist.

## Operating contract for every agent

1. Read `AGENTS.md`, the relevant task record, and current code before editing. Use Node 24 and the checks in `.github/workflows/checks.yml`. Read `.ai_rules` and `.cursorrules` for UI work. Follow relevant installed skills and verify current external documentation when needed.
2. These implementation prompts authorize the named repository task, research, tests, and local previews. They do not themselves authorize production activation, external messages, new paid services, or removal of editorial release gates. The separate activation prompt covers a concrete verified release. Apply any additional authorization already given in the execution conversation without asking for it again.
3. Inspect Git state; preserve unrelated work. Default to sequential implementation in the current checkout. If isolated worktrees are needed, make these runbook files available there first: a worktree from HEAD does not inherit uncommitted documents.
4. One owner integrates shared files. Parallel read-only research or independent evidence packets are fine; do not run concurrent writers against homepage, service registries, shared scripts, schema validation, or sitemap. The coordinator integrates changes and reruns affected checks.
5. Do not remove `noindex`, publish private drafts, mark claims approved, or change protected metro artifact hashes to bypass a failure. Read `docs/claim-review-workflow.md` and `docs/metro-execution-2026-09-16.md`. Complete the exact applicable evidence/review requirement, and preserve containment elsewhere. A failed gate is a specific dependency, not a reason to stop independent tasks.
6. Capture current facts rather than copying old audit findings as present truth. Starting observations: nine live sitemap URLs; 55 of 64 root HTML files locally noindexed; apex-to-www returned 307; prices still $195/$495/$895. Search snapshots can lag live HTML.
7. Never put secrets, raw customer records, payment details, or unrestricted analytics exports in Git. Keep private evidence in access-controlled storage and commit only redacted summaries/references. The existing Vercel exclusions keep `docs/` and `data/` out of deployment; retain those exclusions.
8. Each agent writes `docs/seo-execution/SEO-XX.md` with scope, starting revision, status, changed files, checks/results, evidence dates, remaining dependencies, and exact next action. Distinguish `verified_local` from `verified_live`. A report without the requested implementation is not an implemented task.
9. Use statuses `not_started`, `in_progress`, `waiting_for_access`, `waiting_for_evidence`, `ready_for_review`, `verified_local`, and `verified_live`. Record finished local work even when an external step is waiting. Never record missing metrics as zero.
10. Do not create sidebar tasks or scheduled automations just because this runbook mentions agents or weekly work. Only create those when the user asks. Use subagents only when the invoked coordinator prompt authorizes them, and use bounded assignments. Prefer `gh-axi` for GitHub operations; attach any PR that is actually created to its Codex task.

## Task order and acceptance criteria

All tasks start as **not_started**. Current research informs this specification but does not count as task completion.

| ID | Task and owner | Dependencies | Concrete completion evidence |
| --- | --- | --- | --- |
| SEO-01 | Offer transition — commerce engineer | None | Tested two-offer UI; $295 server/client parity; retired AI acquisition routes; historical payments still work; Stripe cutover packet. |
| SEO-02 | Search baseline and keyword map — research/analytics agent | None; authenticated data conditional | Dated, reproducible baseline or precise access gaps; query-to-page map; five relevant competitor pages with observed differences. |
| SEO-03 | Technical SEO and performance — web engineer | Integrate SEO-01 first; audit can start immediately | Observed crawl/canonical/navigation/performance defects fixed locally; unchanged content containment; live-setting changes prepared. |
| SEO-04 | Nationwide commercial pages — content/web agent | SEO-01; use available SEO-02 findings | Homepage, pricing, process, About, and Resources explain the national $295 offer with distinct page roles and consistent metadata/schema. |
| SEO-05 | First three guide releases — editorial agent | Drafting may start immediately; integrate after SEO-04 | Revised source-mapped guides, worksheets/examples, named missing review requirements, and per-page release eligibility. |
| SEO-06 | Proof and comparison worksheet — content agent | SEO-04 for offer wording; customer evidence conditional | Functional quote-comparison worksheet and two evidence-supported case-study packets or labeled worked examples. |
| SEO-07 | Organic conversion measurement — analytics engineer | SEO-01 and SEO-02 tracking audit | Tested attribution and verified lead/purchase event path; account configuration and reconciliation results distinguished from local tests. |
| SEO-08 | Authority and eligible local presence — research/outreach agent | SEO-04 and SEO-06 assets; research can start earlier | 30 relevant prospects, first ten tailored draft pitches, review-request drafts, and actual GBP eligibility/account audit. No messages sent by default. |
| SEO-09 | Integrated release candidate — release engineer | SEO-01/03/04/07 integrated; include only ready SEO-05/06 artifacts | Exact candidate revision, checks, changed URLs, external changes, cutover order, rollback, and production verification checklist. |
| SEO-10 | Weekly optimization and day-90 metro selection — SEO analyst | Actual SEO-09 activation; data access conditional | Comparable dated report, up to three evidence-led improvements, and later a ranked metro evidence backlog. |

### Execution waves

- **Start now:** SEO-01 implementation; SEO-02 research/access discovery; read-only audits for SEO-03 and SEO-07. These have independent outputs.
- **Next:** integrate SEO-01, then SEO-03, SEO-04, and SEO-07 sequentially for overlapping files. Prepare SEO-05 review packets and SEO-06 evidence concurrently only with disjoint ownership.
- **Launch:** prepare SEO-09 as soon as the core offer, technical work, and conversion path are ready. Release approved core improvements without waiting for every future article or customer story. Include only eligible content in each release batch.
- **Continue:** SEO-08 after its supporting assets exist; manually run SEO-10 weekly after actual activation. Through weeks 3–12, use SEO-10 to choose two substantive content improvements per week, prioritizing the initial eight-guide target. Repeat SEO-09 for later publication batches.

### SEO-01: commerce transition details

Preserve `full_service` and `concierge` as internal IDs. Separate tiers accepted for **new checkout creation** from legacy tiers accepted for **paid fulfillment**. Reject new `consultation` purchases but continue verifying and fulfilling valid historical purchases. Keep the legacy confirmation route available for paid users and noindexed.

Update HTML, client plan maps, server pricing, active service/schema records, generated city previews, relevant scripts/tests, and current operational docs. Remove current acquisition links and three-plan copy; preserve explicitly historical records. Redirect the retired AI landing page to `/schedule.html`, explain the replacement there, update sitemap/internal links, and handle old AI pricing fragments safely. Do not delete the buying-brief parser.

Existing checkout attempts snapshot `expected_amount`, but checkout retries currently resolve the tier's current Payment Link. Avoid returning a newly priced link for an old attempt. Define and test a stale-offer response and explicit client restart with a new idempotency key, while preserving the old attempt and honoring valid already-created paid sessions at their recorded amount. Never rewrite historical ledger rows to $295. Inspect actual tax/discount behavior: do not weaken webhook amount validation merely to make a test pass.

Prepare the Stripe test/live account mapping, new $295 price/link, retirement of old acquisition links, success URL, environment changes, and cutover sequence. Use a coordinated deployment boundary so the visible offer and payable amount agree. Account writes occur only under the separately invoked activation scope.

### SEO-02 and SEO-07: measurement contract

Record property, timezone, extraction date, reporting lag, filters, and completeness. Use the most recent 28 completed days available consistently across sources, plus up to 16 months of GSC history. Separate brand/non-brand using a documented brand variant list. Record query/page/device/country impressions, clicks, CTR, and position; obtain aggregate totals separately where query suppression prevents summing rows reliably.

Reconcile organic landing activity to durable leads and verified payments using available consented attribution. Define a qualified inquiry as a deduplicated, contactable prospective buyer with an in-scope vehicle request and buying intent, classified from actual records; phone/CTA clicks alone do not qualify. Report missing qualification separately. Preserve campaign/referrer privacy limits; do not send contact or buying-brief content to analytics.

Use existing `cta_click`, `phone_click`, `generate_lead`, `begin_checkout`, server `purchase`, and server `onboarding_complete` contracts. Audit GTM before adding another tag. Ensure retries/webhook replay/confirmation refresh do not multiply conversions. Inspect existing collector, retry scheduling, and deduplication; implement proven gaps locally and record exact external configuration dependencies. Do not invent a GA4 property, collector URL, or credentials.

### SEO-04 through SEO-06: content contract

- Homepage owns broad nationwide buying-service/concierge intent. Pricing owns fee, inclusions, and tier comparison. How it works owns process, negotiation help, buyer responsibilities, and evaluation of the fee. Avoid separate synonym landing pages.
- Keep geographic/service facts, prices, contact information, titles/descriptions, social metadata, and schema aligned. Retain one Organization identity; do not create fictional LocalBusiness branches.
- Start SEO-05 with `blog-buy-new-car-below-msrp.html`, `blog-dealership-addons-complete-guide.html`, and `blog-used-car-inspection-checklist.html`. Their September 5 preparation already contains useful research; inspect it before rewriting. Only implement an indexable release when the documented exact-copy and subject review gates are actually satisfied.
- Link approved resources from the hub and relevant commercial pages, with descriptive links back to the service. Verify that each approved indexable landing page is reachable. Review Tesla/FSD claims before promoting the currently orphaned Tesla page; resolve unsupported copy or contain it through the established workflow.
- The worksheet compares user-entered vehicle quotes and distinguishes vehicle price, line-item costs, conditional incentives, and missing inputs. Use explicit hypothetical examples. Do not build a tax estimator, invent savings benchmarks, or collect worksheet PII.
- Customer stories require original evidence and permission. The historical testimonial attestations do not establish invented locations, new customer quotes, or new savings calculations.

### SEO-08 and SEO-10: authority and expansion contract

Prepare useful outreach tied to actual published resources or clearly labeled previews. A prospect row must include its public URL, audience relevance, specific asset/pitch, and documented contact route. Prioritize editorial references, relevant communities, and legitimate partnerships; never buy ranking links, scrape private contact details, or promise earned placements.

Google Business Profile eligibility requires appropriate real-world customer contact. Inspect any actual profile before suggesting edits. National organic reach does not justify national map coverage or separate city profiles. Review requests must be honest, non-incentivized, and not filtered by expected sentiment. Drafting is not sending.

Measure outcomes on days 30/60/90 from the actual publication date, not from draft creation. Annotate the price change and distinguish new pages from comparable existing-page cohorts. Improve existing relevant pages before adding more URLs. At day 90, apply `docs/metro-seo-expansion-plan.md` and existing release evidence to select up to three metro candidates. Keep the 20 city-name variants private until they satisfy the existing distinct-value and release requirements; do not duplicate the existing metro release-evidence task.

## Release and reporting

SEO-09 creates `docs/seo-execution/release-candidate.md` containing exact Git revision, included tasks/URLs, tests and preview evidence, observed external configuration, proposed changes, dependencies, cutover sequence, and rollback. Do not mark it ready while checkout prices or required content approvals are unresolved.

After the user invokes the activation prompt, verify the candidate is unchanged and apply only its supported, authorized operations. Deploy and then verify production behavior; a merge or a successful build is not production verification. Submit the canonical sitemap and request Google recrawl through supported Search Console workflows for the released pages only. Ordinary service/articles do not use Google's restricted JobPosting/BroadcastEvent Indexing API.

Before release run the workflow checks using Node 24, plus `npm run check:buying` where shared buying/UI assets changed and the live redirect matrix after activation. Preserve content-hashed homepage assets, generated-preview drift checks, legacy receipt behavior, and private draft exclusions. Measure mobile Lighthouse diagnostically and CrUX field data where available; no field data is not a failed score. Aim for LCP ≤2.5s, INP ≤200ms, CLS ≤0.1; label lab and field measurements separately.

Every final handoff reports: what changed; tested revision and results; what is locally ready versus live; exact missing access/evidence; next task ID. When an operation is blocked, finish independent authorized work and ask only for the specific missing input, with the reason and applicable source.

## Primary references

- [Google SEO Starter Guide](https://developers.google.com/search/docs/fundamentals/seo-starter-guide)
- [Google spam policies, including doorway abuse](https://developers.google.com/search/docs/essentials/spam-policies#doorway-abuse)
- [Google Business Profile eligibility](https://support.google.com/business/answer/13763036?hl=en)
- [Core Web Vitals and Google Search](https://developers.google.com/search/docs/appearance/core-web-vitals)
- Repository authorities: `AGENTS.md`, `.github/workflows/checks.yml`, `docs/release-readiness.md`, `docs/claim-review-workflow.md`, `docs/implementation-operations.md`, and the current metro release decision/workflow.
