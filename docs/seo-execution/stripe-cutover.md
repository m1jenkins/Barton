# Stripe offer cutover packet

Prepared September 18, 2026, America/Los_Angeles (account reads September 19 UTC). This is a concrete activation dependency, not authority to change accounts or deploy. Starting revision: `3bf03f6288a16b578e49cb1375254c7285a70855`. Candidate reference and final checks: [release-candidate.md](release-candidate.md).

## Observed account and links

Read-only Stripe account discovery returned **Drive Right Car Buying**, `acct_1THdU32RwNuweXRL`, **live mode**. No test account/sandbox was surfaced. Account listing alone does not prove target-environment credentials or webhook configuration. Payment Link, line-item, and Tax Settings reads were successful; no Stripe writes or payments were made.

| Existing live offer | Payment Link / price | Observed configuration | Required transition |
| --- | --- | --- | --- |
| AI Agent, $195 | `plink_1U8EM42RwNuweXRLhGlvFxmr`; `price_1U8EL02RwNuweXRLz9yBjkO8` | Active; quantity 1, adjustable 0–5; promotion codes and automatic tax enabled | Retire new acquisition. Preserve paid history and verify already-created session behavior before deactivation. |
| Full Service, $495 | `plink_1THdyn2RwNuweXRLbq3hnlee`; `price_1TQz5y2RwNuweXRLxxPijXOS` | Active; fixed quantity 1; promotion codes and automatic tax enabled | Create a new $295 price/link with reviewed total/tax treatment; do not mutate historical amounts. Retire old acquisition link at cutover. |
| Concierge, $895 | `plink_1TQz4h2RwNuweXRL9wj5z8XW`; `price_1TQz0Y2RwNuweXRLtdflhgYw` | Active; fixed quantity 1; promotion codes and automatic tax enabled | Keep $895 scope; reconcile total/tax/discount behavior. Use a new controlled link if needed. |

Other old links `plink_1TIFCQ2RwNuweXRLcY0BQ39p` and `plink_1TJ3eP2RwNuweXRLCzmRiXrZ` are inactive. The former's inactive message still promotes AI; include that copy in the eventual retirement change. Do not reactivate either.

All three current prices report `tax_behavior: unspecified`. Account Tax Settings report active, provider `stripe`, `tax_behavior: inferred_by_currency`, tax code `txcd_20060048`. These facts do **not** establish tax liability, exemption, or a lawful new configuration. Do not disable lawful tax or weaken amount validation to force a passing checkout.

The candidate requires final paid totals of **29500 USD cents** and **89500 USD cents**. Discounts, variable quantities, or extra service taxes that change those totals intentionally fail the current exact-total check. Activation therefore needs an accountable tax/operations decision and sandbox evidence: either a lawful fixed, inclusive total with appropriate disclosures, or a separately reviewed implementation that models additional tax/discount components. The latter would be new code and a new candidate. Today's links are not proven compatible.

## Required mapping

| Item | Preview/test | Production/live |
| --- | --- | --- |
| Business account | Drive Right sandbox/test-mode identity unconfirmed | Verified account above; reconfirm at activation |
| New Full Service price/link | Missing; create under authorized test scope | Missing; create only after test validation and activation authority |
| Concierge link | Test equivalent missing | Existing link requires parity review |
| Database | Isolated preview PostgreSQL access missing | Confirm target, backup, migration state and restricted credentials |
| Stripe credentials | Matching test API key and endpoint signing secret missing | Confirm matching live key/signing secret; never copy into Git |
| Webhook | Configured preview endpoint required | `https://www.driverightcarbuying.com/api/stripe-webhook`; actual subscription/configuration still to verify |

Success URLs must contain the **literal** replacement token `{CHECKOUT_SESSION_ID}`:

- Full Service: `https://www.driverightcarbuying.com/payment-success-fullservice.html?session_id={CHECKOUT_SESSION_ID}`.
- Concierge: `https://www.driverightcarbuying.com/payment-success-concierge.html?session_id={CHECKOUT_SESSION_ID}`.
- Historical AI receipt: retain `/payment-success-consultant.html?session_id={CHECKOUT_SESSION_ID}` and legacy fulfillment. This is not a new-sale link.

Current live success redirects already have the correct corresponding paths/token. For sandbox validation, use the explicitly allowed preview origin and test webhook, never mix modes.

Environment values to map privately: `APP_ORIGIN`, explicit `ALLOWED_ORIGINS`, `DATABASE_URL`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PAYMENT_LINK_FULL_SERVICE_URL`, `STRIPE_PAYMENT_LINK_CONCIERGE_URL`, and `CHECKOUT_PAUSED`. The retired consultation URL is no longer consumed for new sales. Confirm optional lead forwarding, Turnstile and analytics configuration separately; enabling Turnstile without its matching client widget blocks leads.

## Connected test gate

Local fixtures exercise application branches but are not PostgreSQL or Stripe integration evidence. In the authorized sandbox, apply numbered migrations including additive `db/003_checkout_offer_snapshot.sql`, then record redacted results for:

1. One $295 Full Service and one $895 Concierge session; visible offer, selected price, quantity, currency, discounts, tax and final total agree. Check all applicable tax locations/configurations rather than one no-tax address.
2. One durable lead and attempt after duplicate submit/retry; changed business payload conflicts. New `consultation` checkout returns 410 without a link.
3. Old $495/missing-offer-key attempt retry returns `409 stale_offer`, no URL; explicit review/restart uses a new key. Preserve original attempt. Retry a pre-change lead request including old URL normalization.
4. Signed paid events for historical $195/$495 and current $295/$895; delayed asynchronous payment, repeated event ID, and different event IDs for one session each yield one purchase/outbox event per session. Existing valid session amount remains authoritative.
5. Unsigned, wrong-amount, wrong-currency, unpaid and mismatched-reference requests do not create a purchase. Receipt refresh/direct fake receipt does not emit purchase or unlock intake. Valid historical receipt still permits its original intake.
6. Collector failure/retry, durable acknowledgement, destination mapping and `event_id` deduplication; reconcile Stripe paid sessions → purchases → outbox → acknowledged destination. Test onboarding once with stable identity.
7. Document the actual behavior of deactivated acquisition links and previously created unpaid sessions. Do not cancel or rewrite historical orders as a shortcut.

## Atomic, paused activation order

This order supersedes older staged API-then-form instructions. It may be executed only after the concrete candidate, account scope, tax treatment, content gates and production activation are authorized.

1. Freeze the reviewed candidate revision; complete the sandbox gate above. Capture current live deployment, non-secret price/link IDs, protected artifacts and aggregate ledger/outbox counts. Back up the target database through its approved process.
2. Apply the additive migration to production. It leaves old `offer_key` values null so old attempts cannot silently reuse a new-priced link. Never backfill historical prices, delete purchase rows, or drop the new column during rollback.
3. Prepare reviewed live $295/$895 links, immutable prices and matching success redirects. Keep new acquisition unavailable until the coordinated boundary; confirm no promotion/quantity/tax surprise and approved scope descriptions. Record IDs and configuration, not credentials.
4. Build the candidate with matching API, HTML, hashed assets and live environment together, **`CHECKOUT_PAUSED=true`**. Preserve paid webhook/status/onboarding routes. At the agreed boundary retire the old AI/$495 acquisition links and their stale promotional messages, then promote the paused candidate. Cached older clients receive safe retirement/stale-offer responses. Confirm treatment of already-created sessions from the sandbox evidence.
5. Inspect the promoted paused build: correct two offers, retired route's query-preserving 308, retained historical receipt verification, no private artifacts. Validate live link settings without making an unauthorized charge. Reconcile historical events processed during the boundary.
6. Enable new checkout with the matching environment and same reviewed source revision only after offer/link parity is demonstrated. Verify the deployment applying that environment, then perform any explicitly authorized production payment smoke test and reconciliation. Tax or amount mismatch means pause, investigate and preserve evidence.
7. Apply the separately reviewed apex-domain 307→308 correction and measurement configuration; rerun their exact checks. Record live evidence in task records. No GTM publication, scheduler, message or sitemap submission is implied by preparing this packet.

## Rollback

Set `CHECKOUT_PAUSED=true` on a deployment that implements the guard; verify it returns 503 for new checkout while historical fulfillment remains available. Keep compatible ledger/webhook/receipt code and the additive column. Do not blindly restore the old three-offer API/UI or point a $295 attempt at a $495 link. A source rollback needs a reviewed two-offer-compatible patch or continued checkout pause. Restore link/environment/deployment combinations as one verified unit, preserve all paid history, then replay/reconcile failed events after the corrected release. Any refund or customer communication requires its own authorized scope.

**Next action:** connect the correct sandbox and isolated preview database, identify the accountable tax/operations decision, and execute the connected test gate. Production is unchanged.
