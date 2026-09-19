# SEO-09 connected validation — September 19, 2026 UTC

**Stripe-hosted payments and isolated database checks pass. The owner requested a simple checkout and no further general validation cycle. Remaining checkout-specific dependencies are described below; broader measurement work is deferred.**

Exact tested revision: `acf9116bdcc48372340b94688f3476b9dc8a35b6`, branch `codex/seo-release-candidate`, Node `v24.20.0`. Application files and migrations remain identical to implementation commit `e7b0a153ecc69f65705a6835f9d1ca6013ae668a`. Local commits `07fa041` and `acf9116` add the isolated database runner and sanitized Stripe evidence; these release documents are a documentation-only follow-up. No application defect was established and no application patch was required.

## Scope correction after owner feedback

On September 19 the owner stated: “stripe works fine, don't over engineer a simple checkout.” Keep the existing Stripe-hosted Payment Links and application integration. Do not build a new checkout, tax engine or discount system, or repeat successful payments and database checks without a demonstrated defect. This instruction accepts the existing payment evidence for planning; it does not turn unperformed checks into passes or authorize production changes.

External analytics/collector reconciliation stays with SEO-07 and is **not a checkout activation blocker**. Monitored receipt-email delivery and a broader location/positive-tax test matrix are deferred from this checkout task. Retain their unverified status below. No new terms proposal is part of this scope; existing copy review requirements and customer entitlements remain recorded.

Limit remaining checkout work to matching the $295/$895 links and application totals, confirming the application's paid-order/receipt path against the intended environment, and resolving any settings or existing terms that would change those totals. The observed $10 discount produces a paid-total mismatch; the existing $100 upgrade-credit clause needs an explicit disposition without erasing an entitlement. Preserve existing tax settings pending a concrete decision; do not treat `not_collecting` as an exemption. No automatic approval denial or environment isolation requirement is waived.

The matrix and missing-input table below retain the original comprehensive checklist for audit history. Their analytics, monitored-email and broader tax-matrix entries are follow-up work, not additional checkout release gates. No new infrastructure is required merely to repeat existing evidence.

## Environment and authority

After the user supplied Stripe MCP test access, fresh discovery confirmed **Drive Right Car Buying**, `acct_1THdU32RwNuweXRL`, **livemode=false** before any mutation. Every Stripe write used this test context. No live Stripe payment/link/tax/webhook setting, deployment, merge, Google setting, scheduler or outbound message changed.

Earlier read-only live inspection confirmed active $195 AI/$495 Full Service/$895 Concierge links with promotions and automatic tax enabled, no Tax Registrations, and the expected enabled production webhook with completed/async-paid event subscriptions. Live IDs and exact configuration are in [stripe-cutover.md](stripe-cutover.md). The inactive live $295 AI link was not reused.

The database was a **new disposable PostgreSQL 17.6** Docker instance from the already-installed `public.ecr.aws/supabase/postgres:17.6.1.147` image, with a loopback-only port and `seo09_validation` database. No image download or production data/credentials were used. Both test instances were stopped/removed after validation, including temporary data. The configured `.env.local` database was never used: its isolation is unverified, its origin is production, its Stripe API value is unrecognized, and analytics forwarding credentials are absent. No credentials were printed or committed.

## Stripe test transactions and receipts

Synthetic contacts at `example.test` and Stripe's test card were used. Authenticated MCP reads confirmed all four sessions **livemode=false, status=complete, payment_status=paid, USD**, quantity 1, with zero discount, shipping and tax. Base-case links use inclusive prices, fixed quantity, no promotion entry and automatic tax disabled **for this diagnostic only**. This does not approve production tax treatment.

| Case | Test Payment Link | Verified paid session | Total cents |
| --- | --- | --- | ---: |
| Full Service | `plink_1UHIS02RwNuweXRLQrlEwBy3` | `cs_test_a1WEYD1RcqYyE06J7bFTVGX5cbG4w9EHtmg76WLSh4w2jd57gVkiBXscyy` | 29500 |
| Concierge | `plink_1UHISD2RwNuweXRLgdPmzzCa` | `cs_test_a1aRVA1tELowhniRzl8blLo0eUe5dw7bM4QVYnlkGTLGTgFG6AjmJia0kd` | 89500 |
| Historical AI fixture | `plink_1UHIWd2RwNuweXRLjSXMHfAj` | `cs_test_a1yEAQoWhEz7zWWLW3HSHcakyWRnUlFXuXGFCawfgWMlAznahor3HWssAo` | 19500 |
| Historical Full Service fixture | `plink_1UHIXI2RwNuweXRL5BJOLhYo` | `cs_test_a1sm0rH2KBwALMzj6Bg3eHxrc5hp7nZMCmCeYCby33X0DVKuaGki4lcICJ` | 49500 |

Current test prices: `price_1UHIS02RwNuweXRLmjLL9lM1` ($295) and `price_1UHISD2RwNuweXRL8WaTp3GQ` ($895). Current test links remain available for follow-up; both historical test links are inactive. No real customer's order was accessed or changed. [stripe-test-evidence.json](stripe-test-evidence.json) stores only sanitized reconciliation fields, without contact data or receipt-access URLs.

All four charges generated receipt URLs. The browser verified TEST receipts **#1294-1473 ($295)**, **#1104-0575 ($895)** and **#1946-6769 ($195)** with quantity 1 and matching totals. The $195 receipt remained accessible after retiring its test link. The $495 hosted confirmation and generated receipt URL were verified; its receipt page was not separately opened. **Email delivery is unverified** because synthetic inboxes are not monitored.

Initial current links used corresponding local receipt paths with literal `{CHECKOUT_SESSION_ID}`. After the $295 payment, automatic approval review denied browser access to `http://localhost:8765` because that exact browser-origin permission was not explicit. A narrow permission request is pending; the restriction was not bypassed. Concierge was tested separately with Stripe-hosted confirmation, which its test link now retains. Application receipt-page validation is incomplete. The preferred browser CLI returned stale references; Stripe-hosted tests were completed using CUA.

## Retirement, discount and tax behavior

**Retirement:** opened the $195 test checkout while active, then deactivated its test link. A fresh visit showed retirement copy. Submitting the pre-opened session showed **“This link can no longer accept payments”**; MCP still reported open/unpaid. The test link was temporarily re-enabled to create the historical paid fixture, then deactivated again. That session remained paid at 19500 and its receipt remained accessible. This is observed behavior for the tested Payment Link flow: do not promise unpaid legacy sessions remain payable after deactivation. No session was cancelled or historical amount rewritten.

**Discount:** a separate diagnostic coupon `4ryTROBq` ($10 off, one redemption maximum) produced session `cs_test_a1J0gLoI950yGkVsvjttdxmd1C2fuM15WzAYbxaslhpc2MtD4l0pxLQ3Re`: subtotal 29500, discount 1000, total **28500**, unpaid. It is not attached to candidate links. Real database tests reject discounted totals against a 29500 attempt; the candidate cannot silently enable a discount/credit.

**Tax:** test Tax Registrations were empty, with no further pages. Tax Settings were active, default behavior `inferred_by_currency`, code `txcd_20060048`. Calculation `taxcalc_1UHId22RwNuweXRLKCXffn9K` used supplied Austin TX **78701**, that existing code, and inclusive 29500/89500 lines. Each returned zero tax, explicitly **taxability_reason=not_collecting**. No exemption override, registration or shared Tax Settings change was made. Configured head-office ZIP **78704** differs from the user's supplied **78701**; the owner must confirm the correct address before a correction. No full address is recorded here.

Absent registrations can produce zero calculated tax. [Stripe guidance](https://docs.stripe.com/tax/payment-links). Texas defines specific taxable-service categories; a ZIP alone does not classify this advisory service. [Texas Comptroller](https://comptroller.texas.gov/taxes/publications/96-259.php). Applicable locations, a positive-tax case and lawful classification remain unresolved. No custom tax engine is proposed.

## Isolated PostgreSQL evidence

[The runner](../../scripts/validate-connected-db.mjs) requires a new empty `seo09_` database on literal `127.0.0.1`, rejects connection-query overrides, never loads dotenv, substitutes synthetic integration credentials, and disables external fetches. Migrations use a reserved connection; a five-connection pool exercises races. It refuses a nonempty database. Initial runner/connection setup issues were fixed before passing runs; application code was unchanged.

Final command at `acf9116bdcc48372340b94688f3476b9dc8a35b6`:

```sh
SEO09_DATABASE_URL=postgresql://postgres@127.0.0.1:54016/seo09_validation \
SEO09_STRIPE_EVIDENCE=docs/seo-execution/stripe-test-evidence.json \
node scripts/validate-connected-db.mjs
```

The port records this run only; recreate a fresh disposable database for reruns. **Eight scenario groups passed**:

1. Migrations 001–003, legacy outbox normalization, preserved pre-migration $495 amount/null offer key.
2. Five concurrent identical leads create one row/one 201 and one durable ID; changed business payload conflicts.
3. Five concurrent checkouts per current tier create one 29500/89500 attempt each, stable references and changed-payload conflicts; retired consultation returns 410 with no attempt/link.
4. Historical retry returns 409 stale_offer without a link; explicit new-key restart succeeds and preserves the old row.
5. Locally signed synthetic $195/$495/$295/$895 events exercise the signature handler, real transactions, unpaid then async-paid, concurrent same/different event-ID replay, receipt predicates and idempotent saved intake.
6. Missing/incorrect signatures, increased tax-like totals, discounts, currency/unpaid/reference mismatches add no purchase; fake-session intake returns 403 without a row.
7. Actual outbox SQL records failure, respects retry timing, retains IDs and fences concurrent workers. Transport is stubbed 503 then 204.
8. The four MCP-read paid snapshots above are replayed in deliberately **locally signed synthetic envelopes**. Each yields one purchase/intake, its original amount and stable purchase/onboarding outbox identities; snapshot receipt predicates pass. This is session-data reconciliation, **not Stripe-origin webhook delivery or SDK retrieval**.

Final test counts: **8 purchases, 8 onboarding rows, 16 outbox rows** (four synthetic sessions plus four actual test-session snapshots). All 16 were acknowledged by the transport stub; later dispatch claimed none. These are test counts, not business metrics or external acknowledgements. The runner intentionally reports `stripePaymentsVerified=false` because it does not contact Stripe; separate authenticated MCP evidence establishes the four actual payments.

## Connected gate disposition

| Gate | Verified | Remaining |
| --- | --- | --- |
| 1. Current totals/tax/discounts | Real $295/$895 paid totals; quantity/currency; discount and Austin tax diagnostics | Approved tax classification/address and applicable location/positive-tax cases; production-compatible settings |
| 2. Durable retries/retired AI | Real PostgreSQL concurrency/conflict/durable-ID/410 checks | Configured preview HTTP endpoint checks |
| 3. Stale attempts/old lead normalization | PostgreSQL stale restart; regression suite covers legacy lead/hash normalization | Final preview/browser restart and legacy-lead HTTP checks |
| 4. Paid history/dedupe | Four actual Stripe payments; real ledger replay of snapshots and synthetic delayed/replayed events | Stripe-origin signed delivery/redelivery and actual delayed payment into preview |
| 5. Invalid requests/receipts/intake | Signature and invalid-payment DB checks; persisted historical intake; Stripe-hosted receipts | SDK retrieval, application receipt/refresh/fake-session routes, monitored email delivery |
| 6. Analytics | Real SQL retry/fencing/IDs including actual payment snapshots | Approved collector/consent/destination, durable external acknowledgement and reconciliation |
| 7. Link retirement | New visits and pre-opened unpaid session blocked; paid record/receipt preserved | Carry observed behavior into authorized cutover; no promise of continued unpaid availability |

## Simple terms proposal and exact missing inputs

The user confirmed Austin 78701 and delegated simple drafting. Price/retirement approval `SEO-PRICE-2026-09-18` remains valid. No named accountable reviewer/date/expiry or acceptance of newly drafted text was supplied. [Claim review workflow](../claim-review-workflow.md) requires: “Approval requires reviewer identity, review date, expiry, and exact copy.” No approval fields were invented.

Proposed exact scope copy:

> Full Service is a one-time $295 service for vehicle research, price negotiation and fee review, a dedicated advisor, and documented vehicle recommendations. Ultimate Concierge is a one-time $895 service that includes Full Service plus expanded sourcing, priority communication and delivery coordination where available. You choose the vehicle, review the paperwork, arrange financing and insurance, and decide whether to buy. Vehicle purchase costs, registration, independent inspections and delivery charges are separate. Seller participation, availability and timing vary. We do not guarantee a particular saving, vehicle or financing outcome.

Proposed refund basis follows existing policy: full refund before active negotiations; discretionary partial refund during negotiations for work not completed; no service-fee refund after completed vehicle purchase, subject to applicable rights. Paid AI engagements retain agreed terms. These are review proposals, not new promises or historical term changes.

| Missing input | Exact requirement |
| --- | --- |
| Application credentials/endpoint | Scoped test API key via secure local reference, matching signing secret and authorized reachable test webhook. **MCP test access is available**; it does not supply application environment credentials. Browser permission for localhost:8765 is separately pending. The isolated DB can be recreated locally. |
| Tax/discount decision | Accountable classification, correct head-office address and applicable locations; accept fixed inclusive $295/$895 totals with discounts disabled or request a reviewed implementation. Zero not_collecting is insufficient. |
| Scope/refund/historical credit | Business/operations exact deliverables/timing approval and qualified remedy/liability review as required. Resolve the existing **$100 historical upgrade credit**: discounting $295 fails current exact-total validation. Do not erase prior entitlements, add a coupon or invent a refund workaround. Open claim families include CLM-011/024/029/030; no new CLM-013/016/017 evidence or removed claims are inferred. |
| Analytics/email | Approved collector URL/credential reference, durable-ack/deduplication/consent contract and Drive Right destination/property/stream; authorized monitored test inbox. No Google publication or scheduler is implied. |

## Checks and next action

On `acf9116bdcc48372340b94688f3476b9dc8a35b6`, Node `v24.20.0`: **160 regression tests passed, 0 failed, 0 skipped; eight PostgreSQL groups passed**. Runner syntax, site/API/metro/city/buying checks, config-only redirects and diff checks passed. Site: 64 HTML files/seven sitemap URLs; four metro drafts; 20 city drafts plus hub; 14 redirect rules. Dependencies were unchanged from the prior clean install. No new audit/performance result is inferred.

Next: resolve only the checkout-specific dependencies in the scope correction above. Do not request collector/inbox access or repeat the complete connected checklist to unblock checkout. The unchanged application checks remain valid at the recorded revision. **Activation readiness remains unresolved; no live change is authorized.**
