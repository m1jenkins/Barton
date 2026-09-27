# Launch gate G1: live Stripe checkout

The owner completes this checklist in the Stripe and Vercel dashboards before any Google Ads campaign is enabled. Paid clicks must land on a checkout that charges exactly what the ads say and records the purchase.

Why it matters:
- The payment webhook only records a purchase when the paid total is **exactly 29500 or 89500 USD cents** (`api/stripe-webhook.js`).
- Any other total goes to review instead. When that happens:
  - no purchase row is written;
  - the confirmation page never verifies;
  - onboarding is blocked;
  - Google Ads never sees the conversion.

Sources:
- `docs/seo-execution/stripe-cutover.md`, which records the account `acct_1THdU32RwNuweXRL` and link IDs as of Sep 18-19;
- the Stripe section of `docs/implementation-operations.md`.

## 1. Payment Links (Stripe dashboard, live mode)

| Plan | Link | What must be true |
|---|---|---|
| Full Service $295 | **No live $295 link was recorded.** Only a test-mode one exists (`plink_1UHIS02RwNuweXRLQrlEwBy3`). | Create or identify the live link: one-time price **$295.00 USD**, quantity fixed at 1. Don't reuse `plink_1TIFCQ2RwNuweXRLcY0BQ39p`: it has a $295 price on the old AI product. |
| Ultimate Concierge $895 | `plink_1TQz4h2RwNuweXRL9wj5z8XW` (existing) | One-time price **$895.00 USD**, quantity fixed at 1. |
| Old Full Service $495 | `plink_1THdyn2RwNuweXRLbq3hnlee` | Deactivate for new sales at cutover. Keep its history. |
| Old AI Agent $195 | `plink_1U8EM42RwNuweXRLhGlvFxmr` | Deactivate for new sales. Historical receipts stay supported. |

Complete these steps on both current links:
- [ ] **Promotion codes off.** A $10 code turns $295 into $285, and that purchase is never recorded.
- [ ] **Tax doesn't change the total.** The cutover record found no Stripe Tax registrations, so Stripe calculates zero tax and totals stay exact.
  - Don't change tax settings just to make totals pass.
  - If you are, or become, registered to collect tax anywhere, tell me before launch. Totals would change and purchases would stop recording, which needs a reviewed code change first.
- [ ] **Product name and description match the site.** Remove old wording such as "lowest price", "average savings of $1,500–$4,000", "handles every detail" and "door-to-door". A description that mirrors the published plan cards:
  - Full Service: "New, used, and CPO inventory search; price negotiation and fee review; a dedicated advisor through the process; documented vehicle recommendations. Vehicle costs are separate."
  - Ultimate Concierge: "Everything in Full Service, plus auctions, forums, and niche sources; priority communication and coordination; delivery coordination where available. Vehicle costs are separate."
- [ ] **After-payment redirect.** Use exactly these URLs, including the literal token:
  - Full Service: `https://www.driverightcarbuying.com/payment-success-fullservice.html?session_id={CHECKOUT_SESSION_ID}`
  - Concierge: `https://www.driverightcarbuying.com/payment-success-concierge.html?session_id={CHECKOUT_SESSION_ID}`

## 2. Webhook (Stripe dashboard, live mode)

- [ ] Endpoint `we_1U6VpH2RwNuweXRLx7jBbwfr` → `https://www.driverightcarbuying.com/api/stripe-webhook` is enabled. It must send `checkout.session.completed` and `checkout.session.async_payment_succeeded`.
- [ ] Its signing secret is the one saved as `STRIPE_WEBHOOK_SECRET` in Vercel **Production**. Don't use the secret from another endpoint, and don't mix test and live keys.

## 3. Vercel production environment (project `barton`)

- [ ] `STRIPE_PAYMENT_LINK_FULL_SERVICE_URL` is the live **$295** link from step 1.
- [ ] `STRIPE_PAYMENT_LINK_CONCIERGE_URL` is the live **$895** link.
- [ ] `CHECKOUT_PAUSED` is unset or not `true`.
- [ ] Redeploy after changing any variable. Variables only apply to new deployments.

## 4. Look without paying

- [ ] On `https://www.driverightcarbuying.com/schedule.html`, choose Full Service. The Stripe page must show **$295.00**, the new description and no promotion-code field. Close it without paying.
- [ ] Do the same for Ultimate Concierge: **$895.00**.

Each "Choose this plan" click creates an unpaid checkout-attempt record. That's harmless and expected.

## 5. One real purchase (part of gate G2, after the tracking PR and GTM version are live)

1. **Buy.** Buy Full Service with your own card. Tag Assistant should be connected to `www.driverightcarbuying.com`.
2. **Verify.** The confirmation page must say the payment is verified, and Tag Assistant must show `purchase_verified` with value 295, currency USD and a `transaction_id`. Note that ID.
3. **Refund.** Refund the payment in Stripe. Stripe keeps its processing fee, about $9.
4. **Retract.** In Google Ads, go to Goals, then Conversions, then Uploads, and upload a **retraction** adjustment for that `transaction_id`. The test sale then doesn't count toward the campaign.
5. **Record.** Log the date and outcome in `change-log.md`.
