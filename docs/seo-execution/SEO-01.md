# SEO-01 — offer transition

Prepared September 18, 2026. Starting revision: `3bf03f6288a16b578e49cb1375254c7285a70855`. Local implementation: `verified_local`; connected activation: `waiting_for_access` and tax/terms `waiting_for_evidence`. Final revision/checks: [release candidate](release-candidate.md).

Implemented Full Service at $295 and Concierge at $895 across current commercial copy, client/server plans, schema, service registries and generated private city/metro previews. The buying-brief parser remains. New `consultation` attempts return 410; old fragments show the retirement explanation without selecting another plan. The retired AI landing has a permanent pricing redirect and a noindexed static fallback; it is absent from acquisition navigation/sitemap.

New attempts snapshot amount/currency plus a hash of the configured offer. Missing or changed snapshots return `409 stale_offer` with no URL. The UI requires an explicit restart at the displayed current price and a new key, preserving the old attempt and durable lead. Pre-change normalization cannot trap historical retries behind an idempotency conflict. Changed data on a current offer still conflicts.

Historical $195/$495 purchases retain their recorded amounts, original tier, signed-webhook validation, receipt verification and intake. Receipt copy no longer pretends every Full Service customer paid today's price. No historical database rows were rewritten. A guarded checkout pause supports a coordinated cutover without suspending paid fulfillment.

Main changes: `api/_lib/config.js`, `checkout-offer.js`, validation, checkout/lead/webhook/status handlers, `db/003_checkout_offer_snapshot.sql`, `buying/checkout.js`, `buying/app.js`, `script.js`, five commercial pages, receipt pages, policy/pricing references, registries, renderers, redirects and tests. The protected nine legacy Texas HTML files/hashes remain unchanged; their contained historical copy is an explicit exception, not a current offer source.

Verification includes actual handler/transaction branches with SQL fixtures, current/legacy amounts, stale/replayed/conflicting requests, concurrent insert races, signature/amount/currency/reference rejection, unpaid receipts, historical intake, browser restart/keyboard/mobile checks and the integrated workflow. These fixtures do not prove real PostgreSQL migrations or connected Stripe payments.

Read-only Stripe discovery verified the correct live business account, three old active links and unresolved automatic-tax/promotion/quantity configuration. New $295 test/live links, isolated database, credentials and total parity remain unverified. [stripe-cutover.md](stripe-cutover.md) contains the exact account IDs, environment mapping, connected tests, atomic paused order and rollback.

Next action: complete that connected test gate when the correct sandbox/database and tax treatment are available. Do not activate production from local test results alone.
