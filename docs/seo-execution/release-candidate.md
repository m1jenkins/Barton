# Nationwide offer and SEO release candidate

Prepared September 18, 2026 (America/Los_Angeles). **Ready for review and connected testing; production activation is not complete.**

- Starting production/repository revision: `3bf03f6288a16b578e49cb1375254c7285a70855`.
- Tested implementation commit: `e7b0a153ecc69f65705a6835f9d1ca6013ae668a`.
- Local branch: `codex/seo-release-candidate`.
- This packet is a documentation-only follow-up to that implementation commit; deployment files are unchanged. No branch was pushed, merged or deployed.

## Included implementation

Full Service is $295 USD one time and Concierge remains $895. Standalone AI acquisition is retired, while historical $195/$495 receipts, signed payment records and onboarding remain supported. Offer snapshots, explicit stale-checkout restart and a guarded pause prevent old attempts from silently receiving a newly priced link. Five commercial pages have distinct national search roles and static service content. The Austin base, buyer control and existing scope limits remain explicit.

Technical changes include two-offer metadata/schema, canonical/link reachability, hashed changed assets, retired-AI permanent redirect, Tesla claim containment, and a measured loading-order correction: the unchanged GTM bootstrap follows blocking CSS on affected templates. Attribution now survives internal navigation and Stripe returns; durable conversion identities, historical payload sanitization and a fenced outbox worker are tested. The worker is not scheduled or connected to an invented collector.

The current `sharp` development dependency and lockfile were patched from 0.35.3 to 0.35.4 after the clean install identified a published advisory. Clean install now reports zero vulnerabilities. The [maintainer advisory](https://github.com/lovell/sharp/security/advisories/GHSA-rgj7-g3m4-5g8c) and [technical task](SEO-03.md) record the reason.

## Changed URLs and deployment boundary

[changed-urls.csv](changed-urls.csv) lists all **28 modified root HTML URLs**, their robots state and exact change category. Principal changes:

| Surface | Candidate behavior |
| --- | --- |
| `/`, `/schedule.html`, `/how-it-works.html`, `/about.html`, `/blog.html` | National positioning, current offers, distinct page roles and aligned metadata |
| `/ai-car-buying-agent.html` | Query-preserving 308 to pricing; noindexed static fallback |
| `/tesla-fsd-for-sale.html` | Visible review warning, noindex and sitemap removal; no added promotion |
| Four `/payment-success*.html` routes | Retained historical verification; amount-neutral receipt copy; no view-based purchase |
| Three first-wave guide root URLs | Prior September 5 editorial bodies/dates, approved fee CTA, unchanged GTM moved after CSS; noindex retained |
| Other changed guides/hubs and `/policy.html` | Current acquisition/fee references; existing editorial/terms review state retained |
| `/api/leads`, `/api/checkout-start`, `/api/stripe-webhook`, `/api/purchase-status`, `/api/onboarding` | Durable compatibility, offer transition, recorded-amount fulfillment and private analytics handling |
| Shared script/buying assets, sitemap and Vercel config | Cache invalidation, two-plan UI, seven canonical sitemap URLs, private exclusions and permanent retirement redirect |

The seven sitemap URLs are `/`, `/about.html`, `/schedule.html`, `/policy.html`, `/blog.html`, `/how-it-works.html`, and `/texas-local-market-intelligence.html`. Ordinary links reach every one. No new guide, worksheet or city URL was made indexable.

**Excluded from deployment:** `draft-artifacts/` (three revised guides, quote worksheet, 20 city pages/hub and four metro drafts), `docs/`, `data/`, local tools/tests, and the existing private advertising review bundle under `outputs/`. `.vercelignore` enforces those directory exclusions. No private draft has a new public link or sitemap entry. The three source-mapped guide proposals and worksheet remain available through dedicated loopback previews.

All nine protected legacy Texas HTML files and **37 recorded hash fields** exactly match the starting revision. `austin.html` therefore retains contained historical price copy; it is not the active pricing authority. The old ROI article is already permanently redirected. Old acquisition links must be retired in Stripe at cutover; preserving a protected file is not authorization to continue old sales.

## Validation evidence

Node `v24.20.0`, clean lockfile install. All applicable workflow commands passed:

| Check | Result |
| --- | --- |
| `npm ci` | Passed; zero reported dependency vulnerabilities after patch |
| `node scripts/validate-site.mjs` | Passed: 64 root HTML files, seven sitemap URLs; canonical/link/schema/containment/hash validation |
| `npm run check:api` | Passed |
| `npm run check:metros` | Passed: four private drafts |
| `npm run check:cities` | Passed: 20 private city pages plus hub |
| `npm test` | **160 passed, 0 failed, 0 skipped** |
| `npm run check:buying` | Passed |
| `node scripts/check-redirects.mjs --config-only` | Passed: 14 permanent redirect rules |
| `git diff --check` | Passed |
| Preview, mobile/desktop, keyboard, no-JS, worksheet print/export | Passed within the documented scope; [browser evidence](browser-evidence.md), [worksheet evidence](SEO-06.md) |

Payment tests execute handler/transaction branches against controlled SQL fixtures: retired new sale, current $295/$895, historical $195/$495, stale/missing offer key, old request hashes, conflict/race, unsigned/wrong currency/amount/reference, delayed and replayed webhooks, receipt refresh and collector retry/fencing. Browser checkout responses were synthetic. **Real PostgreSQL migration, Stripe sandbox payment, collector ingestion and live reconciliation remain unverified.**

[performance-evidence.md](performance-evidence.md) and its sanitized JSON contain five mobile runs per template, paired starting-revision data, controlled loading-order probes, final source hashes and desktop spot checks. Final mobile median LCP/CLS: homepage approximately **2.005s / 0.01025**, pricing **2.011s / 0.03056**, MSRP guide **1.828s / 0**. Pricing before the fix was **1.05844 CLS**. Do not infer field performance, lifetime CLS, INP, SEO gains or precise production latency from these local traces. GSC reports insufficient field data on both mobile and desktop.

## Evidence, approval and account dependencies

| Gate | Verified preparation | Still required before the relevant activation |
| --- | --- | --- |
| Commercial decision | Owner authorized $295, AI retirement, $895 default and existing nationwide availability | Accountable review of exact bounded scope/terms copy and existing unresolved guarantee/refund/identity claims; no new approval inferred |
| Stripe parity | Read-only correct live account/link/tax settings; immutable amount checks and concrete cutover packet | Correct sandbox and isolated preview DB; new $295 link; reviewed lawful total/tax/discount treatment; actual connected test results |
| Deployment/environment | Local branch/config/migration and observed Barton deployment | Confirm target/environment/webhook identity, protected preview, backup and exact atomic promotion; separate activation authority |
| Measurement | GSC/GTM access and dated baseline; local event/outbox tests | Drive Right GA4 property/stream; approved collector/consent mapping and credentials; authorized worker scheduling; real reconciliation |
| Canonical host | Live apex root and path return 307; repository rules already permanent | Inspect actual Vercel domain or upstream Cloudflare setting; authorized 308 correction and live matrix |
| New guides/worksheet | Exact private artifacts, primary sources, tests and review packets | Real author acceptance and qualified subject review; release individually later |
| Proof/GBP/outreach | Two hypothetical examples, 30 prospects, ten pitches, neutral review drafts; actual account audit | Actual permissioned customer evidence, correct profile/in-person eligibility evidence, explicit sending instructions |

Verified Search Console baseline: August 20–September 16, 2026, **27 clicks / 2,518 impressions**; previous 28 days **51 / 3,346**. This is pre-launch context, not an effect of this candidate. Suppressed query totals, missing GA4/business qualification and limited field history are documented in [SEO-02](SEO-02.md). Missing measures are not zero.

## Cutover and rollback

Use [stripe-cutover.md](stripe-cutover.md) as the single detailed account/environment/order packet. It maps verified live IDs, missing test IDs, success URLs, migration and tax decision; it requires the connected test gate before live operations.

At an authorized boundary, apply the additive migration, prepare reviewed matching live links, retire old acquisition links, and promote matching HTML/API/hashed assets/environment with `CHECKOUT_PAUSED=true`. Verify the paused deployment and paid fulfillment before enabling new checkout with that reviewed configuration. Preserve old paid sessions and ledger amounts. Do not deploy API and offer UI independently or weaken payment validation.

For rollback, pause new checkout on a deployment that implements the guard; preserve compatible webhook/receipt/intake handling, the additive column and all history. Do not blindly restore the old three-offer API or pair a $295 attempt with a $495 link. Repair or restore a coherent reviewed two-offer deployment/environment while paused, then reconcile before reopening. No account rollback action has been performed.

## Production verification after separate authorization

- Confirm the promoted source revision/environment, visible $295/$895 offers and no retired purchase option; inspect new and old cached-client paths.
- Verify matched live link currency/quantity/discount/tax/final total and literal success-session token. Perform only explicitly authorized live payment smoke tests.
- Verify legacy signed paid records/receipts/intake, stale-offer explicit restart, replay deduplication, fabricated/unpaid receipt rejection and pause behavior.
- Reconcile paid sessions → purchase records → outbox → collector/destination acknowledgements. Record mismatches/exhaustion and qualified-inquiry unknowns, not just browser clicks.
- Run the full redirect matrix including old AI route and apex path/query preservation; verify expected 308 terminal behavior.
- Check canonical www 200s, robots and seven-URL sitemap; noindex remains for contained pages. Confirm drafts, worksheet, source/review/account packets, tests and ad review outputs are inaccessible.
- Recheck deployed asset hashes, console/network failures, mobile/keyboard/no-JS behavior and loading order; retain lab/field distinctions.
- Record actual live evidence and activation date before starting SEO-10's first comparable reporting cycle. No automatic indexing submission, outreach or automation is implied.

**Next task:** SEO-09 connected validation using the missing sandbox/database and measurement identity, then review/activate only the resulting verified scope. SEO-10 remains `not_started` until actual activation. Full dependency tracker: [status.md](status.md).
