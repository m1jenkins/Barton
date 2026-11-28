# Price rise on January 15, 2027

Owner decision, November 28, 2026: Steer Me Right goes from $395 to $495 and Pro from $695 to $845 on January 15, 2027. Private Client stays at $1,995. The new prices are the regular prices from then on. Seasonal sales back to $395 and $695 come later, a few short windows a year (research: the "Higher prices with seasonal sales" doc in the project).

## Until January 15: the notice

The homepage's Steer Me Right and Pro cards carry `<p class="wz-plan-rise">Price goes to $… on January&nbsp;15</p>` under the price (`wz-plan-pricing` in `index.html`, styles in `buying/home-wise.css`). Two tests (`scripts/_tests/seo-release.test.mjs`, `scripts/_tests/seo-content-pages.test.mjs`) still forbid the retired $495 everywhere except that exact notice.

## On January 15: the switch-over

Nothing here happens without the owner's go-ahead on the day.

1. Stripe: add $495 and $845 prices to the two payment links, and update the Steer Me Right link's optional Pro item to the new difference ($350).
2. Site config: change the Steer Me Right and Pro amounts in `SERVICE_TIERS` (`api/_lib/config.js`) in the same deploy, or new checkouts go to review.
3. Copy: replace $395 and $695 on every page that names them (homepage cards, hero and sticky buttons, plan FAQ, metadata, schema offers, city and vehicle pages via their builds, `data/services.json`, `docs/seo/2026-11-26-plan-reach.md`, `AGENTS.md`). Remove the `wz-plan-rise` notice and its test exceptions, and drop $495 from the tests' retired-price lists.
4. Run `npm test`, `npm run check:buying` and every `check:` build, then `npm run indexnow` after the deploy.

## Before any sale

- Retire the live Stripe codes with no end date: `50OFF` (50% off, unlimited) and `SPRING150` (minimum $500, so it would start applying to Pro at $845).
- `expectedPaidAmount` in `api/_lib/checkout-offer.js` only approves percent-off coupons. A $100 or $150 off sale coupon needs amount-off support and a test first.
- A crossed-out "was" price is only honest once buyers have actually paid the new price for a real stretch. Run no sale before mid-February 2027, and keep sales short (about 7 to 8 weeks a year in total).
