# Nationwide offer and SEO release candidate

Prepared September 18, 2026 (America/Los_Angeles); connected follow-up September 19 UTC. **Four Stripe test payments and isolated PostgreSQL validation pass. The owner requested a simple checkout; no rebuild or further general validation cycle is planned. Checkout-specific configuration and fulfillment dependencies remain; analytics and email-delivery testing are deferred.**

- Starting production/repository revision: `3bf03f6288a16b578e49cb1375254c7285a70855`.
- Tested implementation commit: `e7b0a153ecc69f65705a6835f9d1ca6013ae668a`.
- Latest tested repository revision: `acf9116bdcc48372340b94688f3476b9dc8a35b6`. Application files are unchanged from the implementation commit; two local commits add a database runner and sanitized Stripe test evidence. All 160 tests, eight PostgreSQL scenario groups and relevant Node 24 checks passed; [connected evidence](SEO-09-connected-validation.md).
- Local branch: `codex/seo-release-candidate`.
- This packet and the connected-validation follow-up are documentation-only updates over the latest tested revision; deployment files are unchanged. No branch was pushed, merged or deployed.

## Current checkout scope

The September 19 owner direction supersedes the broader gate list only as described in the [scope correction](SEO-09-connected-validation.md#scope-correction-after-owner-feedback). Keep Stripe-hosted Payment Links and the passing payment/database evidence. Analytics collector setup, monitored receipt-email testing and a broader tax-location matrix do not block this checkout release. Matching link totals, the application paid-order/receipt path and applicable existing terms still matter. No new checkout, tax engine, discount system or terms rewrite is proposed. Unperformed checks remain unverified.

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

The initial payment/browser evidence used controlled SQL/fetch fixtures. The continuation now verifies **real PostgreSQL migrations/concurrency and actual Stripe test-mode payments at $295/$895/$195/$495**, with sanitized paid snapshots reconciled through locally signed replay into the isolated ledger and intake. Real Stripe-origin webhook delivery, application SDK session retrieval, email delivery, external collector ingestion and production reconciliation remain unverified. See the [precise gate matrix](SEO-09-connected-validation.md#connected-gate-disposition).

Latest follow-up at `acf9116bdcc48372340b94688f3476b9dc8a35b6`, Node `v24.20.0`: **160/160 regression tests and eight PostgreSQL groups passed**, plus runner syntax and site/API/metro/city/buying/redirect/diff checks. Dependencies are unchanged from the prior clean install. Stripe-hosted current/historical payments and receipts were checked; performance and production were not retested. A test $10 discount produces $285 and is incompatible with exact-total validation. Austin 78701 tax calculation returns zero with `not_collecting`; configured head-office ZIP is 78704, requiring owner confirmation. Deactivating the test AI link blocks new visits and its pre-opened unpaid session while preserving the paid record/receipt. Test access is now available through MCP; scoped application credentials, webhook endpoint/secret, collector and accountable decisions are still missing. Local browser receipt access was denied by automatic approval review; an exact-origin permission request is pending. No application defect was established or application code changed.

[performance-evidence.md](performance-evidence.md) and its sanitized JSON contain five mobile runs per template, paired starting-revision data, controlled loading-order probes, final source hashes and desktop spot checks. Final mobile median LCP/CLS: homepage approximately **2.005s / 0.01025**, pricing **2.011s / 0.03056**, MSRP guide **1.828s / 0**. Pricing before the fix was **1.05844 CLS**. Do not infer field performance, lifetime CLS, INP, SEO gains or precise production latency from these local traces. GSC reports insufficient field data on both mobile and desktop.

## Evidence, approval and account dependencies

| Gate | Verified preparation | Still required before the relevant activation |
| --- | --- | --- |
| Commercial decision | Owner authorized $295, AI retirement, $895 default and existing nationwide availability; Austin 78701 reconfirmed and simple terms drafted | Named accountable review of exact scope/refund/liability copy and historical $100 credit; draft is not sign-off |
| Stripe parity | Confirmed test MCP context; actual $295/$895/$195/$495 payments; local PostgreSQL migration/replay; tax/discount/retirement diagnostics | Scoped application test key + signing secret/reachable webhook, application receipt checks, tax/address/credit decisions and remaining external gate results |
| Deployment/environment | Local branch/config/migration and observed Barton deployment | Confirm target/environment/webhook identity, protected preview, backup and exact atomic promotion; separate activation authority |
| Measurement | GSC/GTM baseline; real PostgreSQL outbox retry/fencing and test-session snapshot reconciliation using stub transport | Drive Right GA4 property/stream; approved collector/consent credentials; external acknowledgement/reconciliation; scheduling at separately authorized activation |
| Canonical host | Live apex root and path return 307; repository rules already permanent | Inspect actual Vercel domain or upstream Cloudflare setting; authorized 308 correction and live matrix |
| New guides/worksheet | Exact private artifacts, primary sources, tests and review packets | Real author acceptance and qualified subject review; release individually later |
| Proof/GBP/outreach | Two hypothetical examples, 30 prospects, ten pitches, neutral review drafts; actual account audit | Actual permissioned customer evidence, correct profile/in-person eligibility evidence, explicit sending instructions |

Verified Search Console baseline: August 20–September 16, 2026, **27 clicks / 2,518 impressions**; previous 28 days **51 / 3,346**. This is pre-launch context, not an effect of this candidate. Suppressed query totals, missing GA4/business qualification and limited field history are documented in [SEO-02](SEO-02.md). Missing measures are not zero.

## Cutover and rollback

Use [stripe-cutover.md](stripe-cutover.md) as the single detailed account/environment/order packet. It maps verified live IDs, missing test IDs, success URLs, migration and tax decision; its connected checklist is narrowed by the owner scope correction above; live operations still require separate authority and matching checkout configuration.

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

**Next task:** close only the checkout-specific configuration, paid-order/receipt and applicable terms dependencies in the [scope correction](SEO-09-connected-validation.md#scope-correction-after-owner-feedback). Do not repeat all seven gates or require collector/inbox setup for checkout. **Activation readiness remains unresolved.** SEO-10 remains `not_started` until actual activation. Full dependency tracker: [status.md](status.md).
