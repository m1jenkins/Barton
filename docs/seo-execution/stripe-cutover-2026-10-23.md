# Stripe price change packet: $195 Full Service, $345 Ultimate Concierge

Prepared October 23, 2026. Owner decision (Mason): cut both prices in half, rounded. Full Service goes from $395 to $195 and Ultimate Concierge from $695 to $345. Plan names, tier IDs and scope do not change. Claim record: `SEO-PRICE-2026-10-23` in `data/claims.csv` (replaces `SEO-PRICE-2026-09-27`). This packet follows [stripe-cutover-2026-09-27.md](stripe-cutover-2026-09-27.md); that file's links and amounts are now historical.

## What the code now expects

| Tier ID | Plan name | New-sale amount | Env var |
| --- | --- | --- | --- |
| `full_service` | Full Service | `19500` USD cents | `STRIPE_PAYMENT_LINK_FULL_SERVICE_URL` |
| `concierge` | Ultimate Concierge | `34500` USD cents | `STRIPE_PAYMENT_LINK_CONCIERGE_URL` |

Full Service now has the same amount as the retired $195 AI Agent tier (`consultation`). That is safe: the webhook takes the tier from the checkout attempt row, not from the paid amount, and `consultation` still returns `410 tier_retired` for new checkout.

Past amounts keep verifying because they live on the attempt row. An unpaid attempt created at $395/$695 that is retried after the change returns `409 stale_offer` (`api/_tests/offer-transition.test.mjs`).

## Stripe objects created (live mode, 2026-10-23)

Account: **Drive Right Car Buying**, `acct_1THdU32RwNuweXRL`. Created through the Stripe API with settings copied from the links they replace (automatic tax on, promotion codes off, quantity fixed at 1, same redirect pages).

| Plan | Product | New price | New Payment Link | Replaces |
| --- | --- | --- | --- | --- |
| Full Service | `prod_UGAAjsCtQNRd28` | `price_1UTpIM2RwNuweXRLKrEeDeI5` ($195.00) | `plink_1UTppv2RwNuweXRLFtpjEswd` `https://book.stripe.com/eVqcMYe356nV92Q01604809` (replaced `plink_1UTpIc…` the same day; see below) | `plink_1UKRaI2RwNuweXRL2owI9BHC` ($395) |
| Ultimate Concierge | `prod_UHctPBgsLqlPea` | `price_1UTpIN2RwNuweXRLN2uE5Xe7` ($345.00) | `plink_1UTpId2RwNuweXRLsGC6h7uk` `https://buy.stripe.com/28E3cocZ14fNcf28xC04808` | `plink_1UKRaL2RwNuweXRLyyHblHey` ($695) |

The old $395/$695 prices and links were left active so live checkout keeps working until the cutover below. No test-mode links were made: only the live account was connected.

## Cutover order

Every push to `main` deploys to production. Once this change is live, new attempts expect 19500/34500, so the env vars and the deploy must change together:

1. In Vercel Production, set `CHECKOUT_PAUSED=true`. Then set `STRIPE_PAYMENT_LINK_FULL_SERVICE_URL=https://book.stripe.com/eVqcMYe356nV92Q01604809` and `STRIPE_PAYMENT_LINK_CONCIERGE_URL=https://buy.stripe.com/28E3cocZ14fNcf28xC04808`.
2. Merge the PR. Env changes only apply to deployments made after the change, so redeploy if the merge deployed first.
3. On production, check the prices on `/`, `/schedule.html` and `/how-it-works.html`. Open each checkout button and confirm Stripe shows $195 or $345 without paying.
4. Set `CHECKOUT_PAUSED=false` and redeploy.
5. Deactivate `plink_1UKRaI2RwNuweXRL2owI9BHC` and `plink_1UKRaL2RwNuweXRLyyHblHey`. Buyers who already paid are unaffected.

Done on 2026-10-23: steps 1–5 completed in order. Production deploys `dpl_9CDgxCx6wZ5fbr6Gq6wKgMk573eg` (paused) and `dpl_CKLBbYrnAU9T8c5aksPRrXEZnMvC` (unpaused) serve commit `037a96b`; both checkout buttons opened Stripe at $195.00 and $345.00 (not paid; two unpaid verification attempts remain in `checkout_attempts`). Both old links are inactive, with a message pointing buyers back to the pricing page.

**Full Service link replaced the same day.** `plink_1UTpIc…` copied `setup_future_usage=off_session` from the old link, so Stripe told buyers "you allow Drive Right Car Buying to charge you for this payment and future payments". It was replaced by `plink_1UTppv2RwNuweXRLFtpjEswd` (`https://book.stripe.com/eVqcMYe356nV92Q01604809`): same price, redirect, tax and name settings, no saved card. `STRIPE_PAYMENT_LINK_FULL_SERVICE_URL` now points at it, served by `dpl_4pxg1C3iUemK2ojLEjp165JiWA6o`. No pause was needed because both links charge 19500. `plink_1UTpIc…` is inactive. Two more unpaid verification attempts were created.

Rollback: set `CHECKOUT_PAUSED=true`. Do not point the new code at the old $395/$695 links; the amounts will not match and paid purchases go to review.

## Outside this repo

- **Google Ads:** `outputs/2026-10-google-search-ads/plan.json` and the Editor CSVs now say $195/$345. The live ads still say $395/$695 and need a new `ADS-GOOGLE-2026-10` approval before upload. The "Purchase – verified" conversion's default value ($395) should become $195.
- **ChatGPT ads:** `outputs/2026-10-02-dealer-pain-ads/ads.json` now says $195; the live ads must be edited in the ads platform.
- **Stripe product description:** unchanged.

## Not changed here

Dated docs and evidence files (`docs/seo/`, earlier cutover packets, `ad-copy-approval.md`) describe what was true when recorded.

## Reverted (2026-10-23, same day)

Owner decision (Mason): go back to $395 Full Service and $695 Ultimate Concierge. `SEO-PRICE-2026-09-27` is the current price claim again, and `SEO-PRICE-2026-10-23` was removed with the rest of the price commit. The card-saving fix stays: the new $395 link doesn't set `setup_future_usage`.

| Plan | Price | Payment Link now in Vercel |
| --- | --- | --- |
| Full Service | `price_1UKRa92RwNuweXRLDifV4iNz` ($395.00) | `plink_1UTqg72RwNuweXRL2Gzng7nn` `https://book.stripe.com/00wcMYgbd7rZ0wk15a0480a` (new; no saved card) |
| Ultimate Concierge | `price_1UKRaB2RwNuweXRL8LLSGR4C` ($695.00) | `plink_1UKRaL2RwNuweXRLyyHblHey` `https://buy.stripe.com/bJe00ccZ14fN4MA9BG04806` (reactivated original) |

The code returned to 39500/69500 by restoring the files only the price commit (`037a96b`) touched and reversing the prices in pages that later commits also changed, so the later inquiry work stayed. The same pause, set, push, verify, unpause order was used. Afterwards the $195 (`plink_1UTppv…`) and $345 (`plink_1UTpId…`) links were deactivated, and the ChatGPT ad "Full Service $195" was paused.

## Promotion code 50OFF

Added on 2026-10-23 at the owner's request: 50% off one payment of Full Service ($395 → $197.50) or Ultimate Concierge ($695 → $347.50).

- Coupon `1GEB7DeZ` ("50% off", `percent_off` 50, `duration` once), limited to `prod_UGAAjsCtQNRd28` and `prod_UHctPBgsLqlPea`.
- Promotion code `50OFF` (`promo_1UTqrW2RwNuweXRLRq1pDJgE`): no expiry, no redemption limit.
- Both live Payment Links (`plink_1UTqg7…` and `plink_1UKRaL…`) have promotion codes switched on.

Before this, any discount made the paid total differ from the attempt's `expected_amount`, and the webhook sent the purchase to review. `expectedPaidAmount` in `api/_lib/checkout-offer.js` now accepts exactly one discount from `APPROVED_DISCOUNTS`, and only when the pre-discount subtotal equals the plan price and the discount is exactly that coupon's percentage. The purchase records the amount actually paid, which also feeds analytics. Any other coupon, stacked discounts, a wrong subtotal or a wrong discount size still go to review. Tests are in `api/_tests/offer-transition.test.mjs`.

To retire 50OFF, deactivate the promotion code in Stripe. Removing its entry from `APPROVED_DISCOUNTS` also stops new discounted payments from recording, but buyers could still enter the code until it's deactivated in Stripe.

## Halloween code SPOOKY25

Added on 2026-10-23 at the owner's request, with a scrolling Halloween banner on the site.

- Coupon `Cd7Edniu` ("Halloween 25% off", 25%, once, both plan products, `redeem_by` 2026-11-01T05:00Z = midnight Central on Oct 31).
- Promotion code `SPOOKY25` (`promo_1UTr3y2RwNuweXRLmAbkQp8w`), `expires_at` the same moment. Full Service $395 → $296.25, Ultimate Concierge $695 → $521.25.
- Approved in `APPROVED_DISCOUNTS` (`api/_lib/checkout-offer.js`) and tested in `api/_tests/offer-transition.test.mjs`. Claim row: `PROMO-HALLOWEEN-2026-10-23`.
- The banner lives in `script.js` (`showHalloweenBanner`). It skips `/payment-success*` pages and removes itself at the same moment the code expires, so it needs no cleanup deploy. Remove the dead code and the `APPROVED_DISCOUNTS` entry in a later cleanup.
