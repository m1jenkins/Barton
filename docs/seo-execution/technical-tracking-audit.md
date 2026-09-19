# SEO-03 / SEO-07 technical and tracking audit

Status: `ready_for_review` (read-only audit; coordinator owns implementation). Starting revision: `3bf03f6288a16b578e49cb1375254c7285a70855`. Evidence collected September 18, 2026 America/Los_Angeles, approximately September 19 02:13–02:23 UTC. Node: `v24.20.0`. Only this audit document was written by the audit assignment. No deployment, account mutation, customer request, analytics conversion, or payment was made.

## Reobserved public and account state

The production homepage returned 200 with canonical `https://www.driverightcarbuying.com/`, Texas positioning, and $195/$495/$895 offers. Public `/robots.txt` returned 200, permits search crawling, and points to the canonical sitemap. `/sitemap.xml` returned 200 and contains nine URLs. All nine were fetched and returned 200, `index, follow`, and a single matching canonical: `/`, `/about.html`, `/schedule.html`, `/ai-car-buying-agent.html`, `/policy.html`, `/blog.html`, `/how-it-works.html`, `/texas-local-market-intelligence.html`, and `/tesla-fsd-for-sale.html`. These are starting production observations, not evidence that this release candidate is live.

A local parse5 crawl found 64 root HTML files, 55 noindexed, with `/tesla-fsd-for-sale.html` the only indexable page unreachable from the homepage's crawlable anchor graph. No missing/mismatched canonical was found among the nine indexable URLs. Homepage has three H1 elements across its alternative interactive states; that count alone does not establish a search defect. Browser/performance work belongs to the coordinator; this audit did not use its Chrome session or claim CrUX measurements.

Vercel connector access was actually tested:

- `list_teams` succeeded for `m1jenkins-projects`, team `team_bOoOO0qJxyoS6sZdujIFV6ze`.
- `list_projects`, `list_deployments`, and `get_deployment` succeeded for `barton`, project `prj_oYDm1o5sOBi27rnxjpTQS2L8Et7m`.
- Current production deployment: `dpl_GCU85qMLjwArpTGiXtmCNFXLd3K3`, READY, Git revision `3bf03f6288a16b578e49cb1375254c7285a70855`, [deployment inspector](https://vercel.com/m1jenkins-projects/barton/GCU85qMLjwArpTGiXtmCNFXLd3K3). Aliases include both apex/www current and legacy domains.
- `get_project` remains unusable: exposed `projectId` reaches an underlying tool that requires `idOrName`; sending `idOrName` is rejected/removed by the connector's schema. This is a connector mapping failure, not evidence of denied project access.
- No Vercel CLI executable was available. Domain settings, environment values, collector configuration, database access, or write authority were not verified by this audit.

## Redirect evidence and exact hosting dependency

Executed the existing matrix with Node 24:

```sh
BASE_URL=https://www.driverightcarbuying.com LEGACY_BASE_URL=https://www.austincarbuyingservice.com node scripts/check-redirects.mjs
```

The network sandbox initially prevented fetches; rerunning the same read-only check with approved network access completed. Eleven cases passed. Only apex root and `/about.html` canonicalization failed: HTTP **307**, expected **308**. Both preserved the complete query string, including `keep%2Bme`. HTTP→HTTPS returned 301; index, malformed trailing slash, legacy host, and legacy route redirects returned 308 with terminal 2xx targets.

At 02:16:44 UTC, both apex 307s contained `x-vercel-id`, `server: cloudflare`, and `Location` on the canonical www hostname, but omitted the app-level security headers present on the www 200. Local `vercel.json` already sets `permanent: true` for apex root and wildcard host redirects. The live deployment revision matches that config. This is evidence of a redirect before repository routing; a Vercel domain-level redirect is the leading inference. Cloudflare fronts responses, so the exact account setting is not proven by headers alone.

Activation dependency: inspect [Barton Domains](https://vercel.com/m1jenkins-projects/barton/settings/domains), capture the `driverightcarbuying.com` domain redirect's actual status, and change its redirect to `www.driverightcarbuying.com` to **308 Permanent Redirect**, preserving paths/queries. If no such Vercel setting exists, inspect the Cloudflare zone's redirect rules before changing anything. Keep the existing permanent repository rules. Rerun the full matrix afterward. [Vercel domain redirect documentation](https://vercel.com/docs/domains/working-with-domains/deploying-and-redirecting) and [custom domain redirect statuses](https://vercel.com/changelog/domains-can-now-be-redirected-with-a-custom-status-code) support the proposed operation; no setting was changed here.

## Tesla page requires containment before reachability changes

At the starting revision, `tesla-fsd-for-sale.html:19` and `:31` promise FSD for life in social metadata; `:53` and `:62` assert verification/savings in schema. Body `:193`, `:198`, and `:264` claim lifetime retention, thousands saved, weeks saved, and a same-week shortlist. These claims have no located claim/source approval rows. The bounded ordinary meta description does not resolve the visible/schema conflict.

Current primary evidence was rechecked: [Tesla subscription support](https://www.tesla.com/support/full-self-driving-subscriptions) describes $99/month subject to changing terms, hardware/feature limits, and active driver supervision. [Tesla transfer support](https://www.tesla.com/support/fsd-transfer) says its transfer program ended March 31, 2026 and describes retention for a specific transferred-vehicle scenario. Neither source supports the page's universal lifetime promise, Drive Right's same-week process guarantee, or outcome savings.

Next local action: record the claim family and page status under the existing workflow, contain the page with noindex and remove its sitemap membership until exact service/technical copy has appropriate review. Do not fix this orphan by promoting its unsupported copy. Preserve a useful canonical URL and bounded explanation rather than creating a new synonym landing page.

## Proven measurement gaps to implement after SEO-01

| Finding | Starting code and reproduction | Targeted correction and regression |
| --- | --- | --- |
| Internal navigation destroys last-touch acquisition | `script.js:8`, `attribution()`, unconditionally writes a new session last touch. VM execution of the exact Git source with a Google campaign entry followed by `/schedule.html` produced empty last-touch UTMs and the site's own origin as referrer; first touch survived. Organic search similarly has only the referrer origin, while current flattened dataLayer source/medium remain empty. | Preserve session acquisition across ordinary internal navigation; update last touch for a new external/campaign entry with explicit first-touch semantics. Test organic entry, referral entry, paid UTM precedence, internal navigation, direct return, malformed/blocked storage, and first-touch retention. Distinguish an observed referrer from an inferred traffic classification. |
| Generic client conversion events lack durable deduplication | `script.js:8`, `track()`, creates a random ID for every event; generic retry/reload flows have no durable conversion emission guard. `buying/checkout.js:31` and `:48` already guard successful lead/checkout tracking in their persisted ledger, which must remain intact. | Use the returned lead/attempt ID for `generate_lead`/`begin_checkout` identity and guard repeated emissions across refresh/retry in the supported client flow. Keep CTA/phone clicks as intent events. Test same durable ID repeated, a different ID accepted, failed API responses omitted, and storage failure isolation. |
| Analytics retry depends on future commerce traffic | Only `api/stripe-webhook.js:161` and `api/onboarding.js:95` invoke the dispatcher. `api/_lib/analytics-outbox.js:47` supports eligible-time claiming and capped attempts, but nothing invokes it during quiet periods. `docs/implementation-operations.md:164` already acknowledges this gap. | Add a callable local CLI worker or appropriately authenticated dispatcher entry point; do not activate a new scheduler under this prompt. Test collector non-2xx/timeout→failed/backoff, repeated delivery retaining ID, expired lease eligibility, max-attempt exhaustion, and unavailable configuration. Prepare periodic invocation and exhausted-attempt alerting as explicit activation dependencies. |
| API allows URL query data into analytics attribution | `api/_lib/validation.js:26–27`, `:87`, `:101` validate lengths/same-site prefix but retain query/fragment data and complete referrer URLs. A synthetic request with `landing_path=/?email=synthetic@example.com` and referrer query/hash passed validation unchanged; purchase payload forwards that attribution. The browser already reduces referrer to origin. | Enforce pathname-only source/landing paths and credential-free http(s) referrer origins at the server boundary, preserving separately allowlisted campaign fields. Test query/hash stripping, malformed URLs, relative/network-path inputs, credentials, unknown-key removal, and unchanged valid attribution. Do not put contact/brief data in measurement payloads. |

The coordinator owns all code and tests; this table does not mean the corrections are integrated.

## Existing business-event path and test limits

1. `/api/leads` validates and idempotently inserts a durable lead. Browser `generate_lead` occurs only after an accepted response. Lead receipt does **not** imply qualification: qualification still needs actual contactability, in-scope vehicle intent, deduplication, and a recorded classification.
2. `/api/checkout-start` snapshots amount/currency and generates the reference tying payment to an attempt. SEO-01 owns stale-offer protection and retirement. `begin_checkout` represents an attempt, not a purchase.
3. `/api/stripe-webhook` verifies raw-body signature and paid one-time session status, resolves the stored attempt, validates amount/currency against that attempt, and transactionally records purchase/outbox. `stripe_events.event_id`, `purchases.checkout_session_id`, and `(event_name,dedupe_key)` enforce deduplication. Preserve delayed `checkout.session.async_payment_succeeded` handling and historical tiers/amounts.
4. `/api/purchase-status` checks the Stripe session against the persisted purchase. It only reads and never emits `purchase`. Client confirmation retry/refresh does not create purchases.
5. `/api/onboarding` requires a verified paid purchase and matching tier, permits one immutable submission per paid session, and transactionally enqueues `onboarding_complete`. Confirmation views are not onboarding completions.
6. The analytics dispatcher claims with `FOR UPDATE SKIP LOCKED`, sends a durable `Idempotency-Key`, marks acknowledged 2xx delivery, and backs off failures. A collector must acknowledge durable ingestion and deduplicate; HTTP acceptance alone does not prove GA4 receipt.
7. Lead forwarding is a separate PII-bearing fulfillment integration. It retries only when the same lead is submitted again (`api/leads.js:25` and `:96`); failed lead forwarding needs its own operational replay path. Do not reuse its payload for analytics.

`node --test api/_tests/backend.test.mjs` passed 17/17 on the audited baseline. Existing tests cover validation, amount records, identity construction, schema uniqueness, and a successful mocked dispatch. The baseline has no behavioral endpoint/database test proving webhook replay/delayed payment/confirmation refresh and no failed collector retry test. Those are the valuable additional tests; schema-text assertions alone are insufficient end-to-end evidence. No actual PostgreSQL/Stripe/collector reconciliation was possible in this assignment.

## Actual public GTM configuration, not inferred analytics access

Read the public [GTM container script](https://www.googletagmanager.com/gtm.js?id=GTM-W577B3D4) and parsed its `resource` JSON without executing it. Observed resource version **6**:

- Google tag `AW-18071301983`, Google Ads conversion tags 10, 12, 15, 16, conversion linker, click/form listeners, and a custom template tag (18).
- No GA4 `G-…` measurement ID or GA4 event tag in the parsed resource.
- Conversion predicates include `gtm.click` text containing `Book Consultation`, `Book Now — $1,850`, `Book Now — $795`, `(512) 910-4938`, and `Schedule Free Call`, plus `gtm.formSubmit`.
- No configured resource predicate consumes `cta_click`, `phone_click`, `generate_lead`, `begin_checkout`, `purchase`, or `onboarding_complete`. Their occasional appearance in the generic GTM runtime is not configured tracking evidence.

This is a concrete external mismatch: stale button and form-submit conditions cannot establish durable leads or purchases. Do not add another container to compensate. Under later authorized activation, inspect the authenticated GTM workspace/version, replace success assumptions with the existing durable event contracts, retain click intent as secondary, verify consent behavior, and remove/retire obsolete price-text conditions. Preview with failed/successful lead requests and repeat attempts before publishing. No actual GTM/GA4 account access or destination delivery was proved by the public script.

## Remaining account/evidence dependencies

- Vercel/Cloudflare domain configuration evidence and the single 307→308 change described above.
- Correct GTM account/workspace for `GTM-W577B3D4`, an actual GA4 property/web-stream mapping if GA4 is intended, approved consent behavior, and event configuration. Public tag presence is not account authority or conversion delivery.
- Actual `ANALYTICS_FORWARD_URL` collector identity, bearer secret via the secret store, its durable ingestion/deduplication behavior, consent-approved field mapping, destination credentials, retry invocation ownership/cadence, and exhausted-attempt alert routing. Do not invent these values.
- Authorized aggregate database/Stripe/collector exports for the same completed reporting window and timezone. Reconcile paid Checkout Session IDs against purchase rows/outbox acknowledgements without committing raw customers or financial records. Separate test/live modes; distinguish missing data from zero.
- Qualified-inquiry classification and permission to use resulting aggregate outcomes. Phone/CTA clicks and unqualified durable leads are not qualified inquiries.
- Browser mobile/desktop lab diagnostics and CrUX availability must be recorded independently by SEO-03. This audit supplied crawl/header/account evidence only.

Next action: coordinator integrates SEO-01, applies the proven local tracking/containment fixes, adds meaningful regressions, then records the final result in SEO-03/SEO-07 and the integrated release candidate. Retest live state only after separately authorized activation.
