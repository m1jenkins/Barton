# Durable lead and payment operations

This implementation makes PostgreSQL the source of truth for lead receipt, checkout attempts, verified purchases, and onboarding. Browser redirects and confirmation-page loads alone are not purchase evidence and must not emit purchase conversions. The browser may emit `purchase_verified` only after `/api/purchase-status` returns `verified: true`, keyed by the server purchase ID, for ad-platform conversion measurement (Google Ads via GTM).

## API contract

All state-changing browser calls require an exact allowed `Origin`, JSON, and an `Idempotency-Key` header (8–128 characters using letters, digits, `.`, `_`, `:`, or `-`). Responses are `Cache-Control: no-store` and never return customer fields.

### `POST /api/leads`

Request:

```json
{
  "name": "Ada Buyer",
  "email": "ada@example.com",
  "phone": "512-555-0100",
  "message": "I am comparing compact SUVs.",
  "vehicle": "Mazda CX-5",
  "source_page": "/austin.html",
  "honeypot": "",
  "turnstile_token": "optional-when-not-configured",
  "attribution": {
    "first_touch": { "landing_path": "/austin.html", "utm_source": "google" },
    "last_touch": { "landing_path": "/austin.html", "utm_source": "google" }
  }
}
```

The endpoint validates and commits the lead before returning `{ "ok": true, "lead_id": "…" }`. Reusing an idempotency key with identical normalized data returns the original ID; reusing it with different data returns `409`.

If `LEAD_FORWARD_URL` is configured, the endpoint creates an outbox row in the same database transaction and only calls the downstream HTTPS service after that transaction commits. The downstream request carries the durable lead ID as its own `Idempotency-Key`. A forwarding failure never changes a successfully stored lead into a failed lead response.

### `POST /api/checkout-start`

Request:

```json
{
  "tier": "full_service",
  "lead_id": "optional-durable-lead-uuid",
  "source_page": "/schedule.html",
  "attribution": {
    "first_touch": { "landing_path": "/", "utm_source": "google" },
    "last_touch": { "landing_path": "/schedule.html", "utm_source": "google" }
  }
}
```

New-sale tier IDs are `full_service` ($295 USD) and `concierge` ($895 USD). `consultation` returns `410 tier_retired` for new checkout but remains valid for paid receipt verification and onboarding. The server selects the corresponding environment-configured Stripe Payment Link, persists an attempt with allowlisted first/last-touch attribution, and returns `{ "ok": true, "url": "…", "attempt_id": "…" }`. It adds a server-generated UUID as Stripe's `client_reference_id`; the browser cannot supply a price or redirect URL.

### `POST /api/stripe-webhook`

The function reads the raw request body and verifies `Stripe-Signature`. Subscribe this endpoint only to:

- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`

An event is purchase evidence only when it contains a one-time Checkout Session whose `payment_status` is `paid`, whose `client_reference_id` maps to a stored attempt, and whose currency and total exactly match that stored attempt's immutable amount/currency, including historical $195/$495 attempts. The transaction inserts the Stripe event, one purchase keyed by Checkout Session ID, updates the attempt, and inserts one standard `purchase` analytics-outbox row keyed by that same session ID. Its payload includes a durable event ID, transaction and purchase IDs, service tier, value, currency, governed page context, and allowlisted first/last-touch attribution. Replayed event IDs and second paid events for the same Checkout Session cannot create another purchase or outbox event.

After the ledger transaction commits, the function opportunistically dispatches an atomically claimed outbox batch when `ANALYTICS_FORWARD_URL` is configured. Each HTTPS request carries the durable event ID in both the body and `Idempotency-Key` header. Acknowledged `2xx` responses mark the row sent; timeouts and non-`2xx` responses return it to `failed` with capped exponential backoff. A delivery failure never rolls back or changes the response for an already verified purchase.

Unmatched sessions and amount mismatches are retained with review outcomes but return `2xx` after the record commits. Monitor those outcomes; they usually indicate an old direct Payment Link, inconsistent live/test configuration, or a Stripe price changed without a matching application release.

### `GET /api/purchase-status?session_id=…&tier=…`

The endpoint retrieves the Checkout Session from Stripe and compares it with the database purchase. It returns only verification state, tier, and—when verified—the internal purchase ID with the purchase's `value` (major currency units) and uppercase `currency`:

```json
{
  "ok": true,
  "verified": true,
  "tier": "full_service",
  "purchase_id": "…",
  "value": 295,
  "currency": "USD"
}
```

`value` and `currency` come from the `purchases` ledger row, not the current offer, so a historical $495 purchase reports `495`. If Stripe reports paid before its webhook has committed, the status is `processing`; the client can retry with bounded backoff. Unverified responses (`processing`, `unverified`, `not_found`) and errors are unchanged and carry no amount. No name, email, phone, Stripe customer, or payment-method data is returned.

### `POST /api/onboarding`

Request:

```json
{
  "session_id": "cs_test_…",
  "tier": "full_service",
  "fields": {
    "name": "Ada Buyer",
    "email": "ada@example.com",
    "phone": "512-555-0100",
    "city": "Austin, TX",
    "preferred_makes": "Mazda, Toyota",
    "features": ["awd", "safety-suite"]
  }
}
```

The session must already have a webhook-verified paid purchase and its tier must match. A purchase can have only one immutable onboarding submission. A successful response is `{ "ok": true, "onboarding_id": "…" }`.

The server persists only allowlisted form fields and drops unknown keys. The allowlist covers the current contact, vehicle, budget, trade-in, preference, consultation-question, and concierge-delivery fields; tier and session identity always come from the top-level verified contract. The same transaction creates one `onboarding_complete` outbox event keyed by Checkout Session ID, so browser refreshes cannot duplicate it.

## Required environment

| Variable | Requirement |
| --- | --- |
| `DATABASE_URL` | Required. Pooled PostgreSQL connection string for the deployed environment. |
| `APP_ORIGIN` | Required in production. Exact canonical origin, normally `https://www.driverightcarbuying.com`. |
| `ALLOWED_ORIGINS` | Optional comma-separated additional exact origins, such as an explicitly approved preview. Do not use wildcards. |
| `STRIPE_SECRET_KEY` | Required for webhook construction and purchase-status verification. Keep test and live environments separate. |
| `STRIPE_WEBHOOK_SECRET` | Required. Signing secret for this exact deployed webhook endpoint and mode. |
| `CHECKOUT_PAUSED` | Set `true` during coordinated cutover to stop new checkout creation. Does not disable paid receipts/webhooks/onboarding. Default false. |
| `STRIPE_PAYMENT_LINK_FULL_SERVICE_URL` | Required for the $295 full-service tier; must be a new, verified link for this release. |
| `STRIPE_PAYMENT_LINK_CONCIERGE_URL` | Required for the $895 concierge tier. |
| `TURNSTILE_SECRET_KEY` | Optional. When configured, lead requests must include a valid token for an allowed hostname. |
| `LEAD_FORWARD_URL` | Optional HTTPS downstream destination used only after a lead commit. |
| `LEAD_FORWARD_BEARER_TOKEN` | Optional bearer credential for that downstream destination. |
| `DATABASE_MAX_CONNECTIONS` | Optional per-function-process limit, default `1`, allowed `1`–`5`. Use a pooled database endpoint. |
| `ANALYTICS_FORWARD_URL` | Optional credential-free HTTPS endpoint for the server-side analytics collector. When absent, outbox rows remain pending. |
| `ANALYTICS_FORWARD_BEARER_TOKEN` | Optional bearer credential for the analytics collector. |
| `ANALYTICS_OUTBOX_BATCH_SIZE` | Optional claim size, default `10`, allowed `1`–`50`. |
| `ANALYTICS_OUTBOX_LEASE_SECONDS` | Optional processing lease, default `60`, allowed `15`–`600`. Expired claims can be recovered. |
| `ANALYTICS_OUTBOX_MAX_ATTEMPTS` | Optional delivery-attempt cap, default `8`, allowed `1`–`25`. |
| `ANALYTICS_OUTBOX_RETRY_SECONDS` | Optional initial retry delay, default `30`, allowed `5`–`3600`; subsequent retries back off to six hours. |
| `ANALYTICS_FORWARD_TIMEOUT_MS` | Optional per-request timeout, default `5000`, allowed `500`–`15000`. |

No secrets belong in HTML, JavaScript, SQL, or committed environment files.

Apply `db/003_checkout_offer_snapshot.sql` before this candidate. New attempts snapshot an `offer_key` derived from tier, amount, currency and configured Payment Link. Retries with a missing/stale key, changed amount or currency return `409 stale_offer` without a URL. The UI shows the current fee and requires another explicit submit (Restart checkout), preserving the old attempt and creating a new idempotency key. A conflicting payload still returns `409 idempotency_conflict`. Never backfill old offers or rewrite historical amounts.

Current live links enable automatic tax and promotion codes; Stripe tax behavior is unspecified on each price and inferred by currency in account settings. This is unresolved parity, not a successful checkout check. See [the Stripe cutover packet](seo-execution/stripe-cutover.md). Do not disable lawful tax collection or weaken amount checks to force a passing payment.

## Stripe dashboard configuration

For new sales, keep the final payable total at full service `29500 usd` and concierge `89500 usd`. Retire the old AI/$495 acquisition links after the coordinated cutover. Preserve historical attempts, prices, receipts and valid already-created sessions. If discounts or tax change the Checkout Session total, this version intentionally sends it to review instead of silently recording a mismatched conversion.

Set each Payment Link's post-payment redirect in Stripe, including the literal Stripe replacement token:

- Historical AI receipts remain supported at `https://www.driverightcarbuying.com/payment-success-consultant.html?session_id={CHECKOUT_SESSION_ID}`; do not reactivate new AI sales.
- Full service: `https://www.driverightcarbuying.com/payment-success-fullservice.html?session_id={CHECKOUT_SESSION_ID}`
- Concierge: `https://www.driverightcarbuying.com/payment-success-concierge.html?session_id={CHECKOUT_SESSION_ID}`

Keep these query-string URLs. The payment pages move `session_id` out of the address before GTM loads (see [Checkout Session ID privacy](#september-27-2026-checkout-session-id-privacy)), so no Stripe change is needed. The pages also accept `#session_id={CHECKOUT_SESSION_ID}`, but Stripe documents the token only in query strings, and Clarity records fragments anyway.

Register `https://www.driverightcarbuying.com/api/stripe-webhook` as a Stripe webhook destination and copy its endpoint signing secret into the matching Vercel environment. Do not use the account secret from another webhook or mix test and live keys.

## Release order and verification

1. Run the numbered SQL files in `db/` order against a new or backed-up target database. They are transactional; `002_standard_purchase_analytics.sql` normalizes any unsent legacy sale events to `purchase` without changing acknowledged history.
2. Add the required environment variables separately to Development, Preview, and Production. Use different Stripe keys, webhook secrets, and databases where practical.
3. Configure the two active Payment Link success URLs and the webhook destination in Stripe; retain historical receipt verification.
4. For this offer transition, use the atomic paused cutover in [stripe-cutover.md](seo-execution/stripe-cutover.md). Deploy matching API, browser assets and environment values together with new checkout paused; verify preview/test-mode parity before any production promotion. Do not expose the new $295 API with an old $495 link or separately deploy the old acquisition UI.
5. Run `npm test` and `npm run check:api`; send a test lead twice with the same key, then with a conflicting payload.
6. Complete one Stripe test purchase for each active tier, plus replay already-created historical $195/$495 fixtures. Confirm one `purchases` row and one `purchase` outbox row per Checkout Session, even after resending the webhook from Stripe. Confirm the configured collector receives the same `event_id` and `Idempotency-Key` once.
7. Verify that a direct visit with a fabricated or unpaid session never unlocks onboarding.

Useful reconciliation queries:

```sql
SELECT outcome, count(*) FROM stripe_events GROUP BY outcome ORDER BY outcome;
SELECT status, count(*) FROM checkout_attempts GROUP BY status ORDER BY status;
SELECT status, count(*) FROM analytics_outbox GROUP BY status ORDER BY status;
SELECT status, count(*) FROM lead_forward_outbox GROUP BY status ORDER BY status;
```

## Deliberate operational gaps

The application now writes and dispatches a standard `purchase` event plus `onboarding_complete`. No destination URL, credentials, destination-specific mapping, or consent policy was provided, so none was invented or activated. The configured analytics collector must acknowledge only durable ingestion, honor `Idempotency-Key`, map `purchase` to the approved analytics destinations, and preserve `event_id`/`transaction_id` for destination deduplication. Until that collector and credentials are configured and verified, purchase-ledger counts—not ad-platform counts—are authoritative.

Dispatch is triggered opportunistically by verified Stripe webhook and onboarding requests. `npm run analytics:dispatch` now provides a bounded worker invocation. It sends one due batch, reports aggregate delivery/exhaustion counts, exits nonzero for missing collector, delivery failure or expired exhausted leases, and fences acknowledgements by attempt number. Wire an authorized external scheduler and alerting to it during activation. No public endpoint or scheduler has been activated. Daily reconciliation must compare paid Stripe Checkout Sessions, `purchases`, `analytics_outbox` status, and collector/destination acknowledgements.

Leave `TURNSTILE_SECRET_KEY` unset until a matching client widget is installed and its token is submitted with the lead form. Enabling the secret without the widget intentionally causes browser lead submissions to fail verification.

Likewise, failed optional lead forwards remain durable for review but need a scheduled retry worker for unattended recovery. Downstream systems must honor the durable lead ID as an idempotency key.

Define and apply an approved retention/deletion policy for lead and onboarding PII, restrict database access, encrypt backups, and avoid logging request bodies. Webhook rows intentionally omit the full Stripe event payload and customer fields.

## September 18, 2026 local measurement changes

Internal navigation preserves the last acquisition touch; a new external referrer or explicit campaign can replace it. Stripe returns and confirmation routes preserve acquisition instead of creating a payment-provider referral. First touch remains the stored first acquisition. Browser and API restrict referrer to HTTP(S) origin and source/landing paths to pathname (no credentials, query or fragment). Delivery sanitizes historical queued payload copies too, without rewriting the ledger. Pre-change lead retries compare normalized stored business fields when the old hash differs; changed business data still conflicts. Existing consent mechanisms are retained; the live GTM consent/configuration still needs the documented account audit. `generate_lead` uses `lead:<lead_id>` and `begin_checkout` uses `checkout:<attempt_id>`, with session and memory guards. CTA/phone clicks remain intent only. No contact or buying-brief content is added to analytics. GA4 identity and collector/destination reconciliation remain unresolved.

## September 27, 2026 Google Ads purchase measurement

Google tags are GTM-only (container `GTM-W577B3D4`): pages only push to `dataLayer`, and `scripts/validate-site.mjs` rejects gtag.js loaders, direct `AW-`/`G-` config and hard-coded conversion calls. Browser event contracts:

- `begin_checkout`: pushed once per checkout attempt after `/api/checkout-start` succeeds, with `event_id` `checkout:<attempt_id>`, `service_tier` and `checkout_attempt_id`. The push carries `eventCallback` and `eventTimeout: 1000`; the Stripe redirect waits for GTM's callback for at most one second, does not wait when GTM has not loaded, and is never blocked by a tracking error.
- `purchase_verified`: pushed on a confirmation page only after `/api/purchase-status` returns `verified: true` with a UUID `purchase_id`, a finite positive `value` and a three-letter uppercase `currency`. It carries `transaction_id` (the server purchase ID), `value`, `currency` and `service_tier` with the usual page context and first/last-touch attribution; `event_id` is `purchase_verified:<purchase_id>`. Memory and `sessionStorage` guards send it once per browser session, so map `transaction_id` in the Google Ads conversion tag to dedupe a receipt reopened elsewhere. `processing`, `unverified`, `not_found`, request errors and sessions held for review never fire it. No contact data or Checkout Session ID enters the data layer, and the ID stays out of tag requests (next section).

The OpenAI Ads pixel ignores `purchase_verified`. The server `purchase` outbox event keeps the Checkout Session ID as its `transaction_id`, so do not send both to the same Google Ads conversion action. GTM tag, trigger and conversion-action setup is account work; this change does not modify the container.

## September 27, 2026 Checkout Session ID privacy

Stripe returns buyers to the payment pages with the Checkout Session ID in the URL, and that ID is the only credential `/api/onboarding` needs for the one immutable intake. GTM (`GTM-W577B3D4`, live Version 6) runs the Google tag and Microsoft Clarity on every page, plus four Google Ads conversion tags that send `url` = `{{Page URL}}` when they fire. Before this change they sent the ID to Google and Microsoft.

What the four `payment-success*.html` pages do now:

- **Inline head script.** It is the first script in `<head>`, before the GTM snippet. It moves `session_id` or the legacy `checkout_session_id`, from the query or a `#session_id=` fragment, into `sessionStorage` under `drive_right_checkout_session:<path>`. It then replaces the address without the ID and keeps every other parameter and anchor. If storage is blocked, the ID stays in `window.driveRightCheckoutSession` for that page load only.
- **`checkoutSessionId()` in `script.js`.** It reads the address first and repeats the move if the head script didn't run (for example, under a future CSP that blocks inline scripts). Then it reads `sessionStorage`, then the in-memory fallback.
- **Verified state.** The verified ID stays in memory. `<body>` gets `data-purchase-verified="true"`, which `buying/app.js` watches to prefill the intake. The old `data-verified-session-id` attribute put the ID into the DOM that Clarity records.
- **Reloads and new tabs.** A reload in the same tab verifies again. A bookmark, new tab or copied URL no longer carries the ID and shows the missing-link message. That is intended: the link worked as a bearer credential.
- **Unchanged:** Stripe success URLs, `/api/purchase-status`, `/api/onboarding`, `purchase_verified` and historical receipts. `api/_tests/checkout-session-privacy.test.mjs` pins the script order and behavior.

Measured in an offline headless Chrome with the live Version 6 container, the Google tag and Clarity 0.8.70, using a fake `cs_test_…` ID. Every hostname was blocked, and each tag request was captured locally and never sent.

| Where the ID went | Before | After |
|---|---|---|
| Google tag page view (`ccm/collect` `dl`) and remarketing (`viewthroughconversion`, `rmkt/collect` `url`) | Yes | No |
| "Submit Lead Form" conversion, fired by the intake form (`pagead/conversion`, `1p-conversion` `url`) | Yes | No |
| Clarity uploads: page URL, and `data-verified-session-id` in the DOM recording | Yes | No |
| The next page's referrer (Google `dr`/`ref`, Clarity) | Yes | No |

The same hits still fire after the change, only without the ID. Two alternatives failed the same measurement:

- **Removing the ID from `script.js` only.** `script.js` loads at the end of `<body>`, after GTM has started. Google stayed clean only while `script.js` ran before the Google tag read the address. With `script.js` 400 ms slower (as after a deploy or on a cache miss), every Google hit and Clarity still got the ID, and later Google hits sent the old URL as `ref`. The DOM attribute still reached Clarity either way.
- **A `#session_id=` fragment in Stripe.** Google hits dropped the fragment, but Clarity recorded it.

Still visible, all first party or on the buyer's device:

- Chrome's History list keeps the return URL; the address bar, the back/forward entry and later referrers don't.
- Vercel request logs and the `/api/purchase-status?session_id=…` requests.
- The page's navigation-timing entry, which page scripts could read; neither tag sent it.

Account-side steps, not applied (see `docs/google-ads-setup.md` §3):

- **Clarity:** exclude it from `/payment-success*` with a GTM trigger exception. The project's served config unmasks `body`, so Clarity records page text as displayed. In the test it masked typed values and placeholders. After verification, `buying/app.js` shows the buyer's saved brief as page text.
- **Google tag:** keep the sanitized `page_location` as defense in depth. It doesn't cover the conversion tags' `url` or Clarity, so the page code is the fix.

After deploy, check a payment page: once it loads, the address bar shows no `session_id`, and no request to a Google or Clarity host contains `session_id`, `cs_live_` or `cs_test_`.
