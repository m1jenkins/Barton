# Steer Me Right Private Client (2026-11-26)

Mason's decision of November 26, 2026: a third plan for cars with an MSRP of $100,000 or more. He asked for an "ultra concierge" tier, was shown a proposal (price, benefits, name, optional status, a cap on open searches) and answered "Yes, build it". Steer Me Right ($395) and Steer Me Right Pro ($695) do not change.

## The plan

| | Steer Me Right Private Client |
|---|---|
| Fee | $1,995 USD one time, flat |
| For | Cars with an MSRP of $100,000 or more, new or used |
| Optional | Yes. A buyer of a $100,000 car may still pick Steer Me Right or Pro |
| Models | No cap |
| Capacity | Four searches at a time. A buyer who pays when all four are taken is told within one business day and may wait or take a full refund |
| Reply promise | Same-day replies from Mason on business days |

What it adds over Pro:

- Allocation and build-slot search, and factory orders, when the car is not on a lot
- Negotiation of market adjustments and dealer-installed add-ons
- An independent inspection arranged on a used car; the buyer pays the shop
- A lease and loan check: money factor, residual and rate markup
- A review of the buyer's order and finance-office products before signing
- Enclosed transport quotes; the buyer pays the carrier
- A delivery-day checklist

Exact strings are in claim row `PRIVATE-CLIENT-2026-11-26`. Mason approved them as written on November 26, 2026, with the cap of four, the wait-or-refund promise, the "new or used" scope and the Terms text.

## Rules

- The internal key is `private_client`. `concierge` stays the key for Pro, so never call this plan "concierge" in code or in public copy.
- The fee stays flat. No percentage of savings or of MSRP, and no promised allocation, build slot, price or discount.
- The lease, loan and paperwork checks are not legal, tax or financial advice. No tax or registration strategies.
- Nothing in the code counts open Private Client searches. Mason watches the count and queues or refunds a fifth buyer.
- No public offer to move up to Private Client later.
- Dealer emails, the Deal Tracker privacy rules and the Buyer Update rules apply as on every plan.

## Where it lives

- Plan card, Service schema, plan notes and FAQ: `schedule.html` (`#private-client`). The card sits under the two plan cards, full width.
- `index.html`: a slim dark band under the two plan cards (`.wz-plan-private`: name, the $100,000 line, $1,995 and a "See Private Client" link to the card). Mason asked for it to be visible on the homepage without a third full card on mobile (November 26, 2026). It has no `data-plan`, so nobody pays $1,995 from a one-line summary; the homepage Service schema stays at two plans. `seo-release.test.mjs` checks both.
- One line on `how-it-works.html` (`#plans`), linking to the card.
- On phones every pricing-page card stacks its price above "one-time service fee" (`.wz-plan-row .wz-plan-price` in `buying/home-wise.css`). The refund line is no longer in any plan card: it sits once above the plans (`.wz-plan-guarantee`). On desktop `.wz-plan--wide` gives the Private Client card the full row and a two-column list. On phones (760px and under) the three cards are a row you swipe through (`.wz-plan-row`), with the next card peeking in and arrows (`data-plans-nav`, driven by `scrollRow` in `buying/home-wise.js`, the same code as the review carousel); Mason asked for it on November 26, 2026, because three stacked cards were a long scroll. `/schedule.html#private-client` scrolls the row to the third card. In that row each card drops its steering-wheel photo and folds its checklist under a "What's included" button (`data-includes-toggle`; any one opens or closes all three lists, and the cards stay the same height), so a card fits on one phone screen; Mason asked the same day, after the swipe row alone still left 1,100px cards. The fold needs JavaScript (`data-collapsible` on the row), so without it every list shows in full.
- Also named on `car-buying-service.html` (`#plans`) and `car-buying-concierge.html`. On the same day Mason said anything that assumed two plans could change: "Two plans. $395 or $695." became "Pick your plan.", "both plans" and "either plan" became "every plan" and "any plan" (city-page data and renderer included), and the `index.html` and `schedule.html` descriptions list all three fees.
- Still two-plan by choice: the "$395 or $695" price shorthand in the titles and descriptions of the city and service landing pages (they sell the two mainstream plans, and `seo-content-pages.test.mjs` wants both prices there), the homepage title, the fees chart, the footer plan links, the competitor comparison pages and the other generated families.
- Terms and refund policy: `policy.html`. Also `pricing.md`, `llms.txt`, `data/services.json`.
- Server: `SERVICE_TIERS.private_client` and `NEW_CHECKOUT_TIERS` in `api/_lib/config.js`; `INTAKE_PAGES` in `api/purchase-status.js`; `DEAL_TIERS` in `api/onboarding.js`; the plan names in `api/_lib/intake-email.js`, `api/_lib/car-search.js` and `api/_lib/ops-dashboard.js`.
- Database: `db/015_private_client_tier.sql` widens the three tier checks.
- Browser: `plans` in `buying/checkout.js`; `byTier.private_client` in `buying/intake.js`; `payment-success-private-client.html` (a copy of the Pro page).
- Buyer emails: the welcome and what-to-expect plan lines (`isPrivateClient`). The four older sample buyers still hash to the approved snapshot; the Private Client sample has its own test.
- `/car-search` skill, step 2: Private Client searches nationwide like Pro, with no cap on models.

## Launch record (2026-11-26)

Done on Mason's "Yes, launch it":

1. `db/015_private_client_tier.sql` applied to Neon (`barton-checkout-db`); the three tier checks now accept `private_client`.
2. Stripe (live): product `prod_VhXyyvtYZ6gKb8` "Steer Me Right Private Client", price `price_1Ug8sn2RwNuweXRLfzb7in8V` ($1,995 USD, one time), payment link `plink_1Ug8sv2RwNuweXRLQp9LMSV9`. Promotion codes are off, automatic tax is on like the other links, and it redirects to `payment-success-private-client.html?session_id={CHECKOUT_SESSION_ID}`.
3. Vercel Production: `STRIPE_PAYMENT_LINK_PRIVATE_CLIENT_URL` set to that link.
4. Pushed to main.

Still to do by hand: one real or sandbox payment through the link, to see the buyer land on the Private Client intake and the purchase row say `private_client`. No payment has been made on this plan yet.

## Not done

- Promotion codes are off on the link. The approved codes in `APPROVED_DISCOUNTS` would be accepted by the server if the link ever allowed them, so leave them off unless Mason wants them.
- The competitor fee chart on `schedule.html` and the comparison pages still show two plans.
