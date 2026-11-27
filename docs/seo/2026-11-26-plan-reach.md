# Plan reach: 200 miles and nationwide (2026-11-26)

Mason's decision of November 26, 2026. Prices and plan names do not change. It replaces the plan scopes in `2026-10-23-plan-rename.md`.

## The rule

| | Steer Me Right ($395) | Steer Me Right Pro ($695) |
|---|---|---|
| Dealers | Within 200 miles of the buyer's ZIP code, whatever the state | Nationwide |
| Shipping | Not included | Shipping quotes on long-distance deals; the buyer pays the carrier |
| Trade-in | Not included | We compare offers on the trade-in from several areas and negotiate it with the deal |
| Models | One | Up to three, priced side by side, with our pick |

The buyer still pays any carrier, and on Private Client any inspection shop, but since November 27, 2026 the public cards and copy no longer say so (Mason: it states the obvious).

Withdrawn:

- The public offer to upgrade to Pro later for the $300 difference. Plans bought before November 26, 2026 keep it (Terms of Service, "Plans bought before November 26, 2026"). Mason may still offer Pro for the difference himself when a 200-mile search is thin; nothing public says so.
- "The Steer Me Right plan does not include out-of-state dealers." State lines no longer matter.
- From Pro: "first in line", "we play each model's dealers against each other's written offers" as a Pro-only line, and "we help coordinate shipping when the dealer is open to it".

Exact strings are in claim rows `PLAN-REACH-2026-11-26`, `STEER-ME-RIGHT-SCOPE-2026-11-26` and `PRO-SCOPE-2026-11-26`. The three 2026-10-23 scope and upgrade rows are retired.

## Where it lives

- Plan cards: `index.html` and `how-it-works.html` (six bullets; `index.html` took over the six-bullet cards when `schedule.html` was retired on 2026-11-27). The generated families copy the homepage card from their renderers; the city pages copy the plans-page card from `scripts/render-market-pages.mjs`.
- `index.html`: the header, sticky bar and fees-section buttons say "See plans" and start no checkout; only the buttons on the two plan cards and the closing band do. The fees chart has a Pro bar.
- `/car-search` skill, step 2 and 3: the radius is capped at 200 miles on Steer Me Right.
- Intake (`buying/intake.js`): a question can carry `byTier` overrides. The "How far" choices stop at 200 miles on Steer Me Right.
- Buyer emails: the welcome and what-to-expect plan lines. The byte-for-byte snapshot in `api/_tests/customer-email.test.mjs` (`TODAY`) changes only with Mason's OK on the preview.

## Pro as an add-on at checkout

Live since November 26, 2026 (Mason's instruction, set up directly on the live account with no sandbox run).

- `paidTier()` in `api/_lib/checkout-offer.js`: a Steer Me Right checkout that pays the Pro total ($695, or that total less one approved discount) is recorded as a Pro purchase. Every other total still goes to review.
- `GET /api/purchase-status?next=intake&tier=<link's tier>&session_id={CHECKOUT_SESSION_ID}` redirects a paid buyer to the intake page of the plan they bought.

In Stripe:

- Product "Add Steer Me Right Pro" (`prod_VhdDfeMMXZrNJI`), one-time price $300 (`price_1UgDwq2RwNuweXRLJSbrKZVi`), same tax code as the plans.
- The $395 payment link (`plink_1UTqg72RwNuweXRL2Gzng7nn`) lists it as an optional item, quantity 1, and redirects after payment to `https://www.steermeright.com/api/purchase-status?next=intake&tier=full_service&session_id={CHECKOUT_SESSION_ID}`.

Checked on the day: the live checkout page shows the add-on under "Add to your order", and the redirect sends an unknown session to the Steer Me Right intake page. Not checked: a real payment with the add-on. On the first one, confirm the buyer lands on `payment-success-concierge.html`, the purchase row says `concierge` and the intake asks the Pro questions. To switch the add-on off, remove the optional item from the link; the redirect can stay.

## Not changed

- Short price lines such as "$395 for one model or $695 for up to three" stay where the sentence says nothing else about the plans.
- Page headers outside `index.html`.
- Stripe plan names and prices, and the Pro and Private Client payment links. The Steer Me Right and Steer Me Right Pro product descriptions were updated to the new scopes on November 26, 2026.
