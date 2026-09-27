# Stripe price change packet: $395 Full Service, $695 Ultimate Concierge

Prepared September 27, 2026. Owner decision (Mason): Full Service goes from $295 to $395 and Ultimate Concierge from $895 to $695. Plan names, tier IDs and scope do not change. Claim record: `SEO-PRICE-2026-09-27` in `data/claims.csv` (replaces `SEO-PRICE-2026-09-18`). This packet follows the pattern in [stripe-cutover.md](stripe-cutover.md); that file's links and amounts are now historical.

No Stripe object was created, read or changed while preparing this packet. The link URLs below are placeholders until Mason creates them; do not guess or reuse an older link because its amount looks right.

## What the code now expects

| Tier ID | Plan name | New-sale amount | Env var |
| --- | --- | --- | --- |
| `full_service` | Full Service | `39500` USD cents | `STRIPE_PAYMENT_LINK_FULL_SERVICE_URL` |
| `concierge` | Ultimate Concierge | `69500` USD cents | `STRIPE_PAYMENT_LINK_CONCIERGE_URL` |

`api/_lib/config.js` (`SERVICE_TIERS`) and `buying/checkout.js` (`plans`) carry these amounts. Each new checkout attempt stores `expected_amount` and an `offer_key` hashed from tier, amount, currency and Payment Link URL. The webhook records a purchase only when the paid Checkout Session total equals the attempt's stored amount.

Past amounts keep verifying because they live on the attempt row, not in `SERVICE_TIERS`:

- Paid $195 AI, $495 Full Service, $295 Full Service and $895 Concierge sessions keep their receipts, onboarding and analytics value. `api/_tests/offer-transition.test.mjs` covers all six amounts.
- An unpaid attempt created at $295/$895 that is retried after the change returns `409 stale_offer` with no URL. The browser shows the new fee and asks the buyer to restart.
- `payment-success-concierge.html` no longer prints a price. Like the Full Service page, it says "see your receipt for the amount paid", so buyers who paid $895 are not shown $695.

## What Mason must do in Stripe

Account: **Drive Right Car Buying**, `acct_1THdU32RwNuweXRL`. Do test mode first, then live mode.

### 1. Full Service, $395

- **Product:** the existing **Full Service** product. Do not use the old AI Agent product: an inactive $295 link on that product exists (`plink_1TIFCQ2RwNuweXRLcY0BQ39p`) and is not a Full Service link.
- **New price:** one-time, **$395.00 USD** (39500 cents). Leave the $295 and $495 prices as they are. Archive them later if you like, but do not delete or edit them.
- **New Payment Link** on that price:
  - Quantity fixed at 1, not adjustable.
  - Promotion codes off. A discount changes the total, and the webhook will then refuse to record the purchase.
  - Tax: use the same treatment as the current $295 link. The final paid total must be exactly $395.00. If tax would be added on top, stop and decide before going live (see "Tax" below).
  - After payment, redirect to `https://www.driverightcarbuying.com/payment-success-fullservice.html?session_id={CHECKOUT_SESSION_ID}`. Type `{CHECKOUT_SESSION_ID}` exactly like that; Stripe fills it in.
- **Replaces:** whatever $295 link `STRIPE_PAYMENT_LINK_FULL_SERVICE_URL` points to today.
- **Set:** `STRIPE_PAYMENT_LINK_FULL_SERVICE_URL=<new https://buy.stripe.com/... URL>`.

### 2. Ultimate Concierge, $695

- **Product:** the existing **Ultimate Concierge** product.
- **New price:** one-time, **$695.00 USD** (69500 cents). Leave the $895 price alone.
- **New Payment Link:** the same settings as Full Service. Redirect after payment to `https://www.driverightcarbuying.com/payment-success-concierge.html?session_id={CHECKOUT_SESSION_ID}`.
- **Replaces:** whatever $895 link `STRIPE_PAYMENT_LINK_CONCIERGE_URL` points to today. The last recorded public $895 link was `https://buy.stripe.com/8x2fZa6AD27Ffre7ty04803`. It has been removed from `data/services.json`.
- **Set:** `STRIPE_PAYMENT_LINK_CONCIERGE_URL=<new https://buy.stripe.com/... URL>`.

### 3. Vercel environment and deploy order

Every push to `main` deploys to production. Once this change is live, new attempts expect 39500/69500. If the env vars still point at the $295/$895 links, buyers would pay the old amount and the webhook would mark each payment `amount_mismatch` instead of recording a purchase. So:

1. Create the test-mode $395/$695 links. Set them on a Preview deployment of this branch with the test-mode `STRIPE_SECRET_KEY`/`STRIPE_WEBHOOK_SECRET`, then make one test purchase per plan. Check that each purchase is recorded at 39500 and 69500 and that the receipt page loads.
2. Create the live $395/$695 links.
3. In Vercel Production, set `CHECKOUT_PAUSED=true`. Then set both live link URLs in `STRIPE_PAYMENT_LINK_FULL_SERVICE_URL` and `STRIPE_PAYMENT_LINK_CONCIERGE_URL`.
4. Merge the PR. The production deploy picks up the new env values. Env changes only apply to deployments made after the change, so redeploy if the merge deployed first.
5. On production, check the prices on `/`, `/schedule.html` and `/how-it-works.html`. Open each checkout button and confirm Stripe shows $395 or $695 without paying.
6. Set `CHECKOUT_PAUSED=false` and redeploy. If Mason authorizes a live smoke purchase, make it and refund it.
7. Deactivate the old live $295 Full Service and $895 Concierge Payment Links. The test evidence (gate 7 in [stripe-cutover.md](stripe-cutover.md)) shows that deactivating a link also blocks sessions opened before deactivation. Buyers who already paid are unaffected, and their receipts keep verifying.

Rollback: set `CHECKOUT_PAUSED=true`. Do not point the new code at the old $295/$895 links. The amounts will not match and paid purchases go to review.

## Tax

The last recorded account state ([stripe-cutover.md](stripe-cutover.md#observed-account-and-links)) had automatic tax enabled but no tax registrations. Tax therefore calculated to zero, and the exact-total check passed. If registrations have been added since, a tax line would make the total higher than 39500/69500, and those purchases would go to review. Keep the new links on the same tax treatment Mason uses for the current links, and confirm the test purchases total exactly $395.00 and $695.00.

## Not changed here

- The Stripe product names and descriptions.
- Legacy page `blog-roi-car-buying-service.html` (noindex, contained). It still discusses a $495 fee as a worked example, as it did before the $295 change.
- Historical evidence files (`SEO-09-connected-validation.md`, `stripe-test-evidence.json`, dated `docs/seo/` records). They describe what was true when recorded.
