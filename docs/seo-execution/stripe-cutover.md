# Stripe offer cutover packet

Prepared September 18, 2026, America/Los_Angeles (account reads September 19 UTC). This is a concrete activation dependency, not authority to change accounts or deploy. Starting revision: `3bf03f6288a16b578e49cb1375254c7285a70855`. Candidate reference and final checks: [release-candidate.md](release-candidate.md).

Follow-up on tested revision `acf9116bdcc48372340b94688f3476b9dc8a35b6`: [connected evidence](SEO-09-connected-validation.md) records four actual test payments, real PostgreSQL migration/replay, tax/discount/retirement diagnostics, scoped missing inputs and proposed terms. The user supplied Stripe MCP test mode; all mutations were test-only. No live mutation/payment occurred. The subsequent [owner scope correction](SEO-09-connected-validation.md#scope-correction-after-owner-feedback) narrows remaining work to checkout configuration, the application paid-order/receipt path and applicable terms decisions. Analytics and monitored-email tests are deferred from checkout activation; no further general validation cycle or new checkout/tax infrastructure is planned.

## Observed account and links

Initial read-only discovery returned **Drive Right Car Buying**, `acct_1THdU32RwNuweXRL`, **live mode**. After the user connected test access, discovery returned the same business context with **livemode=false**. Initial live reads below remain historical configuration evidence; subsequent writes/payments were exclusively in confirmed test mode. MCP access does not provide the application's API credentials or prove webhook delivery.

| Existing live offer | Payment Link / price | Observed configuration | Required transition |
| --- | --- | --- | --- |
| AI Agent, $195 | `plink_1U8EM42RwNuweXRLhGlvFxmr`; `price_1U8EL02RwNuweXRLz9yBjkO8` | Active; quantity 1, adjustable 0–5; promotion codes and automatic tax enabled | Retire new acquisition. Preserve paid history and verify already-created session behavior before deactivation. |
| Full Service, $495 | `plink_1THdyn2RwNuweXRLbq3hnlee`; `price_1TQz5y2RwNuweXRLxxPijXOS` | Active; fixed quantity 1; promotion codes and automatic tax enabled | Create a new $295 price/link with reviewed total/tax treatment; do not mutate historical amounts. Retire old acquisition link at cutover. |
| Concierge, $895 | `plink_1TQz4h2RwNuweXRL9wj5z8XW`; `price_1TQz0Y2RwNuweXRLtdflhgYw` | Active; fixed quantity 1; promotion codes and automatic tax enabled | Keep $895 scope; reconcile total/tax/discount behavior. Use a new controlled link if needed. |

Other old links `plink_1TIFCQ2RwNuweXRLcY0BQ39p` and `plink_1TJ3eP2RwNuweXRLCzmRiXrZ` are inactive. The former's inactive message still promotes AI; include that copy in the eventual retirement change. Do not reactivate either.

The refreshed expanded-line-item read shows `plink_1TIFCQ2RwNuweXRLcY0BQ39p` has a $295 price, `price_1TIFA12RwNuweXRL696B0Hkl`, on the old AI product and consultant receipt route. It is not the required new Full Service link. Do not select it by matching the amount alone.

All three current prices report `tax_behavior: unspecified`. Account Tax Settings report active, provider `stripe`, `tax_behavior: inferred_by_currency`, tax code `txcd_20060048`. These facts do **not** establish tax liability, exemption, or a lawful new configuration. Do not disable lawful tax or weaken amount validation to force a passing checkout.

Fresh `GetTaxRegistrations(status=all, limit=100)` returned an empty list with `has_more=false`. An active Tax Settings object is not an active registration. Stripe documents that missing registrations produce zero calculated tax; this is not evidence of exemption. [Stripe tax guidance](https://docs.stripe.com/tax/payment-links). The user confirmed Austin, TX 78701 and requested a simple solution. Proposed preparation is quantity 1, no discounts, fixed final $295/$895 totals using approved tax treatment; no custom tax engine. Classification and historical $100 upgrade-credit handling still require a recorded accountable decision.

Test mode also has no registrations. Actual Austin 78701 calculation `taxcalc_1UHId22RwNuweXRLKCXffn9K` returns zero for both inclusive service lines with `taxability_reason=not_collecting`. Configured head-office ZIP is 78704; confirm the user's correct address before any change. The $10 test discount probe returns 28500 instead of 29500; it is not part of the candidate links. No registration, exemption override or shared Tax Settings change was made.

The candidate requires final paid totals of **29500 USD cents** and **89500 USD cents**. Discounts, variable quantities, or extra service taxes that change those totals intentionally fail the current exact-total check. Activation therefore needs an accountable tax/operations decision and sandbox evidence: either a lawful fixed, inclusive total with appropriate disclosures, or a separately reviewed implementation that models additional tax/discount components. The latter would be new code and a new candidate. Today's links are not proven compatible.

## Required mapping

| Item | Preview/test | Production/live |
| --- | --- | --- |
| Business account | Confirmed `acct_1THdU32RwNuweXRL`, `livemode=false` | Verified account above; reconfirm at activation |
| New Full Service price/link | `price_1UHIS02RwNuweXRLmjLL9lM1` / `plink_1UHIS02RwNuweXRLQrlEwBy3`; actual 29500 paid base-total test | Missing; create only after test validation and activation authority |
| Concierge link | `price_1UHISD2RwNuweXRL8WaTp3GQ` / `plink_1UHISD2RwNuweXRLgdPmzzCa`; actual 89500 paid base-total test | Existing link requires parity review |
| Database | Disposable loopback PostgreSQL 17.6 provisioned and validated; recreate for final boundary tests | Confirm target, backup, migration state and restricted credentials |
| Stripe credentials | MCP test access available; application test API key and endpoint signing secret still missing | Confirm matching live key/signing secret; never copy into Git |
| Webhook | Configured preview endpoint and matching signing secret required | Enabled `we_1U6VpH2RwNuweXRLx7jBbwfr`: `https://www.driverightcarbuying.com/api/stripe-webhook`, API `2026-06-24.dahlia`, `checkout.session.completed` + `checkout.session.async_payment_succeeded`; signing-secret parity and delivery remain unverified |

Success URLs must contain the **literal** replacement token `{CHECKOUT_SESSION_ID}`:

- Full Service: `https://www.driverightcarbuying.com/payment-success-fullservice.html?session_id={CHECKOUT_SESSION_ID}`.
- Concierge: `https://www.driverightcarbuying.com/payment-success-concierge.html?session_id={CHECKOUT_SESSION_ID}`.
- Historical AI receipt: retain `/payment-success-consultant.html?session_id={CHECKOUT_SESSION_ID}` and legacy fulfillment. This is not a new-sale link.

Current live success redirects already have the correct corresponding paths/token. For sandbox validation, use the explicitly allowed preview origin and test webhook, never mix modes.

Test current links initially used matching `http://localhost:8765` receipt paths/token. Automatic approval review blocked browser access to that origin; permission is pending. The $295 payment itself succeeded. Concierge was separately completed using Stripe-hosted confirmation, which its test link now retains. These diagnostic links have automatic tax disabled for base-total validation and are not approved production templates. Actual Stripe-hosted $295/$895/$195 receipts were viewed; application receipts and email delivery remain incomplete.

Environment values to map privately: `APP_ORIGIN`, explicit `ALLOWED_ORIGINS`, `DATABASE_URL`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PAYMENT_LINK_FULL_SERVICE_URL`, `STRIPE_PAYMENT_LINK_CONCIERGE_URL`, and `CHECKOUT_PAUSED`. The retired consultation URL is no longer consumed for new sales. Confirm optional lead forwarding, Turnstile and analytics configuration separately; enabling Turnstile without its matching client widget blocks leads.

## Connected checklist and current scope

The original checklist below preserves the test specification and evidence gaps. Apply the owner scope correction linked above: do not rerun passing cases, and do not block checkout on collector setup, monitored-email delivery or a broader positive-tax/location matrix. Required payment amount checks and historical fulfillment remain intact.

Local fixtures exercise application branches but are not PostgreSQL or Stripe integration evidence. In the authorized sandbox, apply numbered migrations including additive `db/003_checkout_offer_snapshot.sql`, then record redacted results for:

1. One $295 Full Service and one $895 Concierge session; visible offer, selected price, quantity, currency, discounts, tax and final total agree. Check all applicable tax locations/configurations rather than one no-tax address.
2. One durable lead and attempt after duplicate submit/retry; changed business payload conflicts. New `consultation` checkout returns 410 without a link.
3. Old $495/missing-offer-key attempt retry returns `409 stale_offer`, no URL; explicit review/restart uses a new key. Preserve original attempt. Retry a pre-change lead request including old URL normalization.
4. Signed paid events for historical $195/$495 and current $295/$895; delayed asynchronous payment, repeated event ID, and different event IDs for one session each yield one purchase/outbox event per session. Existing valid session amount remains authoritative.
5. Unsigned, wrong-amount, wrong-currency, unpaid and mismatched-reference requests do not create a purchase. Receipt refresh/direct fake receipt does not emit purchase or unlock intake. Valid historical receipt still permits its original intake.
6. Collector failure/retry, durable acknowledgement, destination mapping and `event_id` deduplication; reconcile Stripe paid sessions → purchases → outbox → acknowledged destination. Test onboarding once with stable identity.
7. Document the actual behavior of deactivated acquisition links and previously created unpaid sessions. Do not cancel or rewrite historical orders as a shortcut.

**Observed gate 7 result:** deactivating the test AI link blocked both new visitors and payment from a session opened before deactivation. That open session stayed unpaid. Temporarily re-enabling only this test fixture allowed its $195 historical payment; subsequent deactivation preserved the paid session/receipt. Thus the cutover must not promise old unpaid sessions remain payable. Current/historical test payments and PostgreSQL snapshot reconciliation pass, but real Stripe-origin delivery and external collector acknowledgements remain pending; see the [current gate matrix](SEO-09-connected-validation.md#connected-gate-disposition).

## Atomic, paused activation order

This order supersedes older staged API-then-form instructions. It may be executed only after the concrete candidate, account scope, tax treatment, content gates and production activation are authorized.

1. Freeze the reviewed candidate revision; resolve the checkout-specific dependencies under the current scope above. Capture current live deployment, non-secret price/link IDs, protected artifacts and aggregate ledger/outbox counts. Back up the target database through its approved process.
2. Apply the additive migration to production. It leaves old `offer_key` values null so old attempts cannot silently reuse a new-priced link. Never backfill historical prices, delete purchase rows, or drop the new column during rollback.
3. Prepare reviewed live $295/$895 links, immutable prices and matching success redirects. Keep new acquisition unavailable until the coordinated boundary; confirm no promotion/quantity/tax surprise and approved scope descriptions. Record IDs and configuration, not credentials.
4. Build the candidate with matching API, HTML, hashed assets and live environment together, **`CHECKOUT_PAUSED=true`**. Preserve paid webhook/status/onboarding routes. At the agreed boundary retire the old AI/$495 acquisition links and their stale promotional messages, then promote the paused candidate. Cached older clients receive safe retirement/stale-offer responses. Confirm treatment of already-created sessions from the sandbox evidence.
5. Inspect the promoted paused build: correct two offers, retired route's query-preserving 308, retained historical receipt verification, no private artifacts. Validate live link settings without making an unauthorized charge. Reconcile historical events processed during the boundary.
6. Enable new checkout with the matching environment and same reviewed source revision only after offer/link parity is demonstrated. Verify the deployment applying that environment, then perform any explicitly authorized production payment smoke test and reconciliation. Tax or amount mismatch means pause, investigate and preserve evidence.
7. Apply the separately reviewed apex-domain 307→308 correction and measurement configuration; rerun their exact checks. Record live evidence in task records. No GTM publication, scheduler, message or sitemap submission is implied by preparing this packet.

## Rollback

Set `CHECKOUT_PAUSED=true` on a deployment that implements the guard; verify it returns 503 for new checkout while historical fulfillment remains available. Keep compatible ledger/webhook/receipt code and the additive column. Do not blindly restore the old three-offer API/UI or point a $295 attempt at a $495 link. A source rollback needs a reviewed two-offer-compatible patch or continued checkout pause. Restore link/environment/deployment combinations as one verified unit, preserve all paid history, then replay/reconcile failed events after the corrected release. Any refund or customer communication requires its own authorized scope.

**Next action:** match the intended $295/$895 link settings to application totals, confirm the application paid-order/receipt path, and resolve only applicable terms/settings decisions including the historical $100 credit. Keep passing Stripe/database evidence and defer analytics/email work; do not build a replacement checkout or custom tax solution. Production remains unchanged. **Activation readiness remains unresolved; separate activation authority is still required.**
