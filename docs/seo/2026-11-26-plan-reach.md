# Plan reach: 200 miles and nationwide (2026-11-26)

Mason's decision of November 26, 2026. Prices and plan names do not change. It replaces the plan scopes in `2026-10-23-plan-rename.md`.

## The rule

| | Steer Me Right ($395) | Steer Me Right Pro ($695) |
|---|---|---|
| Dealers | Within 200 miles of the buyer's ZIP code, whatever the state | Nationwide |
| Shipping | Not included | Shipping quotes on long-distance deals; the buyer pays the carrier |
| Trade-in | Not included | We compare offers on the trade-in from several areas and negotiate it with the deal |
| Models | One | Up to three, priced side by side, with our pick |

Withdrawn:

- The public offer to upgrade to Pro later for the $300 difference. Plans bought before November 26, 2026 keep it (Terms of Service, "Plans bought before November 26, 2026"). Mason may still offer Pro for the difference himself when a 200-mile search is thin; nothing public says so.
- "The Steer Me Right plan does not include out-of-state dealers." State lines no longer matter.
- From Pro: "first in line", "we play each model's dealers against each other's written offers" as a Pro-only line, and "we help coordinate shipping when the dealer is open to it".

Exact strings are in claim rows `PLAN-REACH-2026-11-26`, `STEER-ME-RIGHT-SCOPE-2026-11-26` and `PRO-SCOPE-2026-11-26`. The three 2026-10-23 scope and upgrade rows are retired.

## Where it lives

- Plan cards: `schedule.html` and `how-it-works.html` (six bullets), `index.html` (three bullets). The generated families copy the homepage card from their renderers; the city pages copy the plans-page card from `scripts/render-market-pages.mjs`.
- `schedule.html` and `index.html`: the header, sticky bar and fees-section buttons say "See plans" and start no checkout; only the buttons on the two plan cards and the closing band do. The fees chart has a Pro bar.
- `/car-search` skill, step 2 and 3: the radius is capped at 200 miles on Steer Me Right.
- Intake (`buying/intake.js`): a question can carry `byTier` overrides. The "How far" choices stop at 200 miles on Steer Me Right.
- Buyer emails: the welcome and what-to-expect plan lines. The byte-for-byte snapshot in `api/_tests/customer-email.test.mjs` (`TODAY`) changes only with Mason's OK on the preview.

## Pro as an add-on at checkout

The server accepts it; Stripe is not set up for it yet.

- `paidTier()` in `api/_lib/checkout-offer.js`: a Steer Me Right checkout that pays the Pro total ($695, or that total less one approved discount) is recorded as a Pro purchase. Every other total still goes to review.
- `GET /api/purchase-status?next=intake&tier=<link's tier>&session_id={CHECKOUT_SESSION_ID}` redirects a paid buyer to the intake page of the plan they bought.

To switch it on, in Stripe:

1. Create a one-time product for the add-on (for example "Add Steer Me Right Pro", $300 USD, one active price).
2. Add it to the $395 payment link as an optional item ("Add recommended products"), quantity 1, not adjustable.
3. Change that link's after-payment redirect to `https://www.steermeright.com/api/purchase-status?next=intake&tier=full_service&session_id={CHECKOUT_SESSION_ID}`.
4. Pay once in a sandbox with and without the add-on. With it, the buyer should land on `payment-success-concierge.html`, the purchase row should say `concierge`, and the intake should ask the Pro questions.

Until step 4 passes, leave the live link as it is: without the redirect change, a buyer who took the add-on would land on the Steer Me Right intake and fail verification.

## Not changed

- Short price lines such as "$395 for one model or $695 for up to three" stay where the sentence says nothing else about the plans.
- Page headers outside `schedule.html` and `index.html`.
- Stripe product names and descriptions; update them when the site change deploys.
