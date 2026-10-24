# Plan rename: Drive Right and Drive Right Pro (2026-10-23)

Owner decision (Mason, 2026-10-23). Prices do not change.

| Was | Now | Price | Tier ID (unchanged) | Anchor (unchanged) |
| --- | --- | --- | --- | --- |
| Full Service | **Drive Right** | $395 | `full_service` | `#full-service` |
| Ultimate Concierge | **Drive Right Pro** | $695 | `concierge` | `#concierge` |

Tier IDs, anchors, `payment-success-*.html` URLs, Stripe Payment Link URLs and Vercel env vars keep their old names so checkout, analytics, links and ads keep working.

## What each plan includes

**Drive Right ($395).** For buyers who know the car they want. One model, with any trims, colors and packages within it. New, used and CPO dealer inventory. We negotiate the price and check the fees. Written recommendations: what we found and what we'd do. Switching to a different model is not included.

**Drive Right Pro ($695).** For buyers torn between a few cars. Offers on up to three models priced side by side ("model" = make + model; trims, colors and packages within a model are free). Dealers for each model are played against each other's written offers. Out-of-state dealers, with help coordinating shipping when the out-of-state dealer is open to it. First in line. Our pick of the best deal, judged on out-the-door price plus resale and running costs, not just the sticker.

**Both plans.** One dedicated advisor from start to finish. "Full refund if you cancel before negotiations begin." "Dealers and lenders pay us nothing." (Both sentences word for word.)

**Upgrade.** A Drive Right client can upgrade to Drive Right Pro later by paying the $300 difference. Added to `policy.html` (Terms of Service, "Upgrading") and next to every plan table.

**Removed everywhere live.** Auctions, forums and private sellers are no longer part of any plan. Example cross-shops use real rivals only: BMW X5 vs Mercedes GLE, BMW X3 vs Mercedes GLC, RAV4 Hybrid vs CR-V Hybrid. $695 is not called an introductory or founding price.

## Owner confirmations (2026-10-23)

Mason approved all changes in chat ("Push + approve all changes"), including three points the decision left open:

- The Drive Right plan does not include out-of-state dealers; the comparison tables say so.
- Switching to a different model is not included on the Drive Right plan (pricing FAQ, `policy.html`).
- There is no upgrade Payment Link; Mason collects the $300 difference his own way for now.

## Copy rules

- Where the plan name equals the brand, write "the Drive Right plan" or "Drive Right ($395)", never "Drive Right's Drive Right plan".
- Plan cards: "Best if you know the car you want" / "Best if you're torn between a few cars". Shared strings live in claim rows `DRIVE-RIGHT-SCOPE-2026-10-23` and `PRO-SCOPE-2026-10-23`.
- The comparison tables say the Drive Right plan does not include out-of-state dealers, because the owner listed them as a Pro feature.
- Competitors' own tier names (CarEdge Concierge, Car Pal and Authority Auto "Full Service") are unchanged.

## Claim records (`data/claims.csv`)

- Added, approved: `PLAN-NAMES-2026-10-23`, `DRIVE-RIGHT-SCOPE-2026-10-23`, `PRO-SCOPE-2026-10-23`, `PLAN-UPGRADE-2026-10-23`.
- Retired: `CONCIERGE-SCOPE-2026-10-05`, `CONCIERGE-SHIPPING-2026-10-23`.
- Updated: `PROMO-HALLOWEEN-2026-10-23` (banner names the new plans; SPOOKY25 and the Oct 31 end are unchanged), `COMPARISON-PAGES-2026-10-18` (plan name and reused rows), `SEO-PRICE-2026-09-27` (note only; still the current price row).
- `ADS-GOOGLE-2026-10` redrafted as v4: v3 sheet plus `outputs/2026-10-google-search-ads/ad-copy-approval-v4.md` (19 changed strings). `plan.json` and the Editor CSVs are rebuilt. Mason approved v4 on 2026-10-23 (both sheet hashes recorded in `approved_copy`, expires 2026-12-21). Approval is gate G4 only: nothing is uploaded, and the campaigns stay paused until the other launch gates pass.

## Generated and archived copies

The city and metro drafts in `draft-artifacts/` were regenerated from the new homepage and `data/services.json` (`npm run draft:cities`, `npm run draft:metros`), and the three archived guide previews in `draft-artifacts/guides/` got the same plan-name fix as the live guides. With that, `npm test` and every CI check pass. Mason later cleared every folder for edits, so dated records may be corrected where they would mislead; the v3 and v4 ad sheets stay byte-for-byte because their hashes are the signed approval.

## Stripe

Live account "Drive Right Car Buying" (`acct_1THdU32RwNuweXRL`). Buyers see the product name at checkout and on receipts, so the products are renamed; prices, Payment Links and env vars are not touched. Checked read-only on 2026-10-23:

| Plan | Payment Link (live in Vercel) | Price | Product | Product name now |
| --- | --- | --- | --- | --- |
| $395 | `plink_1UTqg72RwNuweXRL2Gzng7nn` | `price_1UKRa92RwNuweXRLDifV4iNz` | `prod_UGAAjsCtQNRd28` | "Car Buying Service" |
| $695 | `plink_1UKRaL2RwNuweXRLyyHblHey` | `price_1UKRaB2RwNuweXRL8LLSGR4C` | `prod_UHctPBgsLqlPea` | "Ultimate Concierge" |

Both links' only line item is the price above, on the product above. The SPOOKY25 coupon is scoped to these two products, so renaming them doesn't affect it.

Both products have descriptions that predate the current approved copy. The $395 one promises "the lowest price" and says "Clients save $1,500–$4,000 on average"; the $695 one promises "sourcing rare and high-value vehicles" and "door-to-door delivery". Planned replacements:

- `prod_UGAAjsCtQNRd28` → name **Drive Right**, description: "For buyers who know the car they want. One model, with any trims, colors and packages. We search new, used and CPO dealer inventory, negotiate the price and check the fees. One dedicated advisor, start to finish, and written recommendations. Full refund if you cancel before negotiations begin. Dealers and lenders pay us nothing."
- `prod_UHctPBgsLqlPea` → name **Drive Right Pro**, description: "For buyers torn between a few cars. Offers on up to three models, priced side by side, with each model's dealers played against each other's written offers. Includes out-of-state dealers (we help coordinate shipping when the dealer is open to it), first-in-line service and our pick of the best deal on out-the-door price, resale and running costs. Full refund if you cancel before negotiations begin. Dealers and lenders pay us nothing."

Do the rename in the same window as the push to `main`, so checkout and site match.

### Change record

Done 2026-10-23 at 20:29 CT, right after the site push (`d664811`, live on production at 20:29 CT), on Mason's go-ahead ("Push + approve all changes"). Run through the Stripe API by Claude Code; prices, Payment Links and env vars untouched.

| Product | Old name | New name | Description |
| --- | --- | --- | --- |
| `prod_UGAAjsCtQNRd28` ($395) | Car Buying Service | Drive Right | Replaced with the text above |
| `prod_UHctPBgsLqlPea` ($695) | Ultimate Concierge | Drive Right Pro | Replaced with the text above |

Checked afterwards by opening both live Payment Links (not paid): the hosted checkout shows "Drive Right" at $395.00 and "Drive Right Pro" at $695.00 with the new descriptions. Each link's stored line-item `description` still reads the old name (Stripe snapshots it when the link is made); it is not what buyers see. The price nicknames ("Full Service - $395", "Ultimate Concierge - $695") are dashboard-only and were left as they are.
