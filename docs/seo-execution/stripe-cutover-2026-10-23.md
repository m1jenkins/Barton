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
| Full Service | `prod_UGAAjsCtQNRd28` | `price_1UTpIM2RwNuweXRLKrEeDeI5` ($195.00) | `plink_1UTpIc2RwNuweXRLwziPUbJj` `https://book.stripe.com/9B68wI6ADeUr1AocNS04807` | `plink_1UKRaI2RwNuweXRL2owI9BHC` ($395) |
| Ultimate Concierge | `prod_UHctPBgsLqlPea` | `price_1UTpIN2RwNuweXRLN2uE5Xe7` ($345.00) | `plink_1UTpId2RwNuweXRLsGC6h7uk` `https://buy.stripe.com/28E3cocZ14fNcf28xC04808` | `plink_1UKRaL2RwNuweXRLyyHblHey` ($695) |

The old $395/$695 prices and links were left active so live checkout keeps working until the cutover below. No test-mode links were made: only the live account was connected.

## Cutover order

Every push to `main` deploys to production. Once this change is live, new attempts expect 19500/34500, so the env vars and the deploy must change together:

1. In Vercel Production, set `CHECKOUT_PAUSED=true`. Then set `STRIPE_PAYMENT_LINK_FULL_SERVICE_URL=https://book.stripe.com/9B68wI6ADeUr1AocNS04807` and `STRIPE_PAYMENT_LINK_CONCIERGE_URL=https://buy.stripe.com/28E3cocZ14fNcf28xC04808`.
2. Merge the PR. Env changes only apply to deployments made after the change, so redeploy if the merge deployed first.
3. On production, check the prices on `/`, `/schedule.html` and `/how-it-works.html`. Open each checkout button and confirm Stripe shows $195 or $345 without paying.
4. Set `CHECKOUT_PAUSED=false` and redeploy.
5. Deactivate `plink_1UKRaI2RwNuweXRL2owI9BHC` and `plink_1UKRaL2RwNuweXRLyyHblHey`. Buyers who already paid are unaffected.

Done on 2026-10-23: steps 1–5 completed in order. Production deploys `dpl_9CDgxCx6wZ5fbr6Gq6wKgMk573eg` (paused) and `dpl_CKLBbYrnAU9T8c5aksPRrXEZnMvC` (unpaused) serve commit `037a96b`; both checkout buttons opened Stripe at $195.00 and $345.00 (not paid; two unpaid verification attempts remain in `checkout_attempts`). Both old links are inactive, with a message pointing buyers back to the pricing page.

Rollback: set `CHECKOUT_PAUSED=true`. Do not point the new code at the old $395/$695 links; the amounts will not match and paid purchases go to review.

## Outside this repo

- **Google Ads:** `outputs/2026-10-google-search-ads/plan.json` and the Editor CSVs now say $195/$345. The live ads still say $395/$695 and need a new `ADS-GOOGLE-2026-10` approval before upload. The "Purchase – verified" conversion's default value ($395) should become $195.
- **ChatGPT ads:** `outputs/2026-10-02-dealer-pain-ads/ads.json` now says $195; the live ads must be edited in the ads platform.
- **Stripe product description:** unchanged.

## Not changed here

Dated docs and evidence files (`docs/seo/`, earlier cutover packets, `ad-copy-approval.md`) describe what was true when recorded.
