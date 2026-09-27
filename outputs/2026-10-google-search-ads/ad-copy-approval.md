# Google Search ads copy: approval sheet (ADS-GOOGLE-2026-10)

Status: **pending owner confirmation**. Nothing on this sheet is live, and no ad may be enabled until the `ADS-GOOGLE-2026-10` row in `data/claims.csv` is approved (launch gate G4 in `docs/google-ads-launch-plan-2026-09-27.md`).

Every text asset in `plan.json` is listed once, with where it is used and what it rests on. Approving the row approves exactly this text; any later wording change needs a new approval.

## How to approve

1. Read every row. Strike or edit anything you don't want to say; I'll regenerate `plan.json`, the Editor files and this sheet.
2. When the sheet is right, record the approval in the `ADS-GOOGLE-2026-10` row of `data/claims.csv`:
   - `status`: `approved`
   - `reviewer`: your name
   - `last_reviewed`: the approval date
   - `expires_on`: at most 90 days later, and no later than the price approval (`SEO-PRICE-2026-09-18` expires 2026-12-18)
   - `approved_copy`: this file's path plus the SHA-256 printed by `shasum -a 256 outputs/2026-10-google-search-ads/ad-copy-approval.md`
3. The price and plan lines rest on the approved price row. They must change the same day the price does.

## What each basis means

| Basis | Meaning | Source |
|---|---|---|
| approved price/plan | Plan names and one-time fees | `data/claims.csv` `SEO-PRICE-2026-09-18` |
| approved entity fact | Austin base, United States service area, phone, hours | `data/entities.json` owner approval (Sep 21-22) |
| site copy, needs ad approval | Plan inclusions and service descriptions already published on the site but never approved as exact copy (`data/services.json` `serviceLevelReview: pending_operations_confirmation`) | `schedule.html` plan cards, `pricing.md`, `car-buying-service.html` (H1 and "does not buy a vehicle for you or make the purchase decision"), the `schedule.html` title "Car Negotiator" |
| navigation/CTA | Points to a page or action; makes no factual claim | — |
| brand name | "Drive Right" name variants | `data/entities.json` |

"Vehicle costs are separate" and "Delivery and vehicle costs are separate" paraphrase the published exclusion "Service fees are separate from the car price, taxes, registration, inspections, financing, insurance, and delivery."

## Assets

| # | Text | Type | Chars | Used in | Basis |
|---|---|---|---|---|---|
| 1 | Drive Right Car Buying | Headline (pinned H1) | 22 | Brand: Brand; Non-brand: Car Buying Concierge; Non-brand: Car Buying Service | brand name |
| 2 | Drive Right Buying Service | Headline (pinned H1) | 26 | Brand: Brand; Non-brand: Car Buying Advisor; Non-brand: Car Buying Concierge; Non-brand: Car Buying Service; Non-brand: Car Negotiation | brand name |
| 3 | Car Buying Service | Headline | 18 | Non-brand: Car Buying Service | site copy, needs ad approval |
| 4 | One-Time $295 Service Fee | Headline | 25 | Non-brand: Car Buying Service | approved price/plan |
| 5 | Car Buying and Negotiation | Headline | 26 | Brand: Brand; Non-brand: Car Buying Service; Non-brand: Car Negotiation | site copy, needs ad approval |
| 6 | Full Service: $295 One Time | Headline | 27 | Brand: Brand; Non-brand: Car Buying Advisor; Non-brand: Car Buying Concierge; Non-brand: Car Buying Service; Non-brand: Car Negotiation | approved price/plan |
| 7 | Ultimate Concierge: $895 | Headline | 24 | Brand: Brand; Non-brand: Car Buying Advisor; Non-brand: Car Buying Concierge; Non-brand: Car Buying Service; Non-brand: Car Negotiation | approved price/plan |
| 8 | Remote Support Nationwide | Headline | 25 | Brand: Brand; Non-brand: Car Buying Advisor; Non-brand: Car Buying Concierge; Non-brand: Car Buying Service; Non-brand: Car Negotiation | approved entity fact |
| 9 | Austin-Based Car Buying Help | Headline | 28 | Non-brand: Car Buying Service | approved entity fact |
| 10 | New, Used and CPO Search | Headline | 24 | Brand: Brand; Non-brand: Car Buying Advisor; Non-brand: Car Buying Service | site copy, needs ad approval |
| 11 | Negotiation and Fee Review | Headline | 26 | Non-brand: Car Buying Service; Non-brand: Car Negotiation | site copy, needs ad approval |
| 12 | A Dedicated Buying Advisor | Headline | 26 | Brand: Brand; Non-brand: Car Buying Advisor; Non-brand: Car Buying Concierge; Non-brand: Car Buying Service; Non-brand: Car Negotiation | site copy, needs ad approval |
| 13 | You Make Every Decision | Headline | 23 | Brand: Brand; Non-brand: Car Buying Advisor; Non-brand: Car Buying Concierge; Non-brand: Car Buying Service; Non-brand: Car Negotiation | site copy, needs ad approval |
| 14 | Compare Our Two Plans | Headline | 21 | Brand: Brand; Non-brand: Car Buying Concierge; Non-brand: Car Buying Service | approved price/plan, navigation/CTA |
| 15 | See How Drive Right Works | Headline | 25 | Brand: Brand; Non-brand: Car Buying Service; Non-brand: Car Negotiation | navigation/CTA |
| 16 | Car buying help with inventory search, price negotiation and fee review. Plans from $295. | Description | 89 | Non-brand: Car Buying Service | approved price/plan, site copy, needs ad approval |
| 17 | Full Service is $295 and Ultimate Concierge is $895, one time. Vehicle costs are separate. | Description | 90 | Brand: Brand; Non-brand: Car Buying Advisor; Non-brand: Car Buying Service; Non-brand: Car Negotiation | approved price/plan, site copy, needs ad approval |
| 18 | A dedicated advisor searches new, used and CPO options and documents recommendations. | Description | 85 | Brand: Brand; Non-brand: Car Buying Advisor; Non-brand: Car Buying Service | site copy, needs ad approval |
| 19 | Based in Austin with remote support nationwide. You make every purchase decision. | Description | 81 | Non-brand: Car Buying Concierge; Non-brand: Car Buying Service; Non-brand: Car Negotiation | approved entity fact, site copy, needs ad approval |
| 20 | Drive Right Car Buying Help | Headline (pinned H1) | 27 | Non-brand: Car Buying Advisor; Non-brand: Car Negotiation | brand name |
| 21 | Car Negotiation Service | Headline | 23 | Non-brand: Car Negotiation | site copy, needs ad approval |
| 22 | Hire a Car Negotiator | Headline | 21 | Non-brand: Car Negotiation | site copy, needs ad approval |
| 23 | Price Negotiation Help | Headline | 22 | Non-brand: Car Negotiation | site copy, needs ad approval |
| 24 | Two Plans From $295 | Headline | 19 | Non-brand: Car Buying Advisor; Non-brand: Car Negotiation | approved price/plan |
| 25 | Full Service includes price negotiation and fee review for a $295 one-time fee. | Description | 79 | Non-brand: Car Negotiation | approved price/plan, site copy, needs ad approval |
| 26 | See what the service covers, what it costs and what stays your decision. | Description | 72 | Non-brand: Car Negotiation | navigation/CTA |
| 27 | Car Buying Concierge | Headline | 20 | Non-brand: Car Buying Concierge | site copy, needs ad approval |
| 28 | Car Concierge Service | Headline | 21 | Non-brand: Car Buying Concierge | site copy, needs ad approval |
| 29 | Auctions and Niche Sources | Headline | 26 | Non-brand: Car Buying Concierge | site copy, needs ad approval |
| 30 | Priority Communication | Headline | 22 | Non-brand: Car Buying Concierge | site copy, needs ad approval |
| 31 | One-Time Concierge Fee | Headline | 22 | Non-brand: Car Buying Concierge | approved price/plan |
| 32 | Car Finder Service | Headline | 18 | Non-brand: Car Buying Concierge | site copy, needs ad approval |
| 33 | Ultimate Concierge is $895 one time and includes everything in Full Service. | Description | 76 | Non-brand: Car Buying Concierge | approved price/plan, site copy, needs ad approval |
| 34 | Concierge adds auctions, forums and niche sources plus priority communication. | Description | 78 | Non-brand: Car Buying Concierge | site copy, needs ad approval |
| 35 | Delivery coordination where available. Delivery and vehicle costs are separate. | Description | 79 | Non-brand: Car Buying Concierge | site copy, needs ad approval |
| 36 | Car Buying Advisor | Headline | 18 | Non-brand: Car Buying Advisor | site copy, needs ad approval |
| 37 | Car Buying Consultant | Headline | 21 | Non-brand: Car Buying Advisor | site copy, needs ad approval |
| 38 | Help Buying Your Next Car | Headline | 25 | Non-brand: Car Buying Advisor | site copy, needs ad approval |
| 39 | Car Buying Help Nationwide | Headline | 26 | Non-brand: Car Buying Advisor | approved entity fact, site copy, needs ad approval |
| 40 | Start Your Buying Brief | Headline | 23 | Non-brand: Car Buying Advisor | navigation/CTA |
| 41 | Price negotiation and fee review are included. You make every purchase decision. | Description | 80 | Non-brand: Car Buying Advisor | site copy, needs ad approval |
| 42 | Austin-based car buying help with remote support for buyers nationwide. | Description | 71 | Non-brand: Car Buying Advisor | approved entity fact, site copy, needs ad approval |
| 43 | Compare Plans and Pricing | Sitelink text | 25 | Brand; Non-brand | navigation/CTA |
| 44 | Full Service is $295 one time | Sitelink line | 29 | Brand; Non-brand | approved price/plan |
| 45 | Ultimate Concierge is $895 | Sitelink line | 26 | Brand; Non-brand | approved price/plan |
| 46 | How It Works | Sitelink text | 12 | Brand; Non-brand | navigation/CTA |
| 47 | See each step of the process | Sitelink line | 28 | Brand; Non-brand | navigation/CTA |
| 48 | You make every purchase decision | Sitelink line | 32 | Brand; Non-brand | site copy, needs ad approval |
| 49 | Car Buying Service | Sitelink text | 18 | Brand; Non-brand | site copy, needs ad approval |
| 50 | Service scope and current fees | Sitelink line | 30 | Brand; Non-brand | navigation/CTA |
| 51 | What the buyer stays in charge of | Sitelink line | 33 | Brand; Non-brand | site copy, needs ad approval |
| 52 | About Drive Right | Sitelink text | 17 | Brand; Non-brand | brand name, navigation/CTA |
| 53 | Based in Austin, Texas | Sitelink line | 22 | Brand; Non-brand | approved entity fact |
| 54 | Remote support nationwide | Sitelink line | 25 | Brand; Non-brand | approved entity fact |
| 55 | Start Your Buying Brief | Sitelink text | 23 | Brand; Non-brand | navigation/CTA |
| 56 | Tell us what you are looking for | Sitelink line | 32 | Brand; Non-brand | navigation/CTA |
| 57 | Then choose the plan that fits | Sitelink line | 30 | Brand; Non-brand | navigation/CTA |
| 58 | One-Time Service Fee | Callout | 20 | Brand; Non-brand | approved price/plan |
| 59 | Full Service $295 | Callout | 17 | Non-brand | approved price/plan |
| 60 | Ultimate Concierge $895 | Callout | 23 | Non-brand | approved price/plan |
| 61 | Remote Support Nationwide | Callout | 25 | Brand; Non-brand | approved entity fact |
| 62 | Based in Austin, Texas | Callout | 22 | Brand; Non-brand | approved entity fact |
| 63 | Dedicated Advisor | Callout | 17 | Brand; Non-brand | site copy, needs ad approval |
| 64 | New, Used and CPO Search | Callout | 24 | Non-brand | site copy, needs ad approval |
| 65 | Price Negotiation | Callout | 17 | Non-brand | site copy, needs ad approval |
| 66 | Fee Review | Callout | 10 | Non-brand | site copy, needs ad approval |
| 67 | Vehicle Recommendations | Callout | 23 | Non-brand | site copy, needs ad approval |
| 68 | Inventory Search | Snippet (Service catalog) | 16 | Non-brand | site copy, needs ad approval |
| 69 | Price Negotiation | Snippet (Service catalog) | 17 | Non-brand | site copy, needs ad approval |
| 70 | Fee Review | Snippet (Service catalog) | 10 | Non-brand | site copy, needs ad approval |
| 71 | Vehicle Recommendations | Snippet (Service catalog) | 23 | Non-brand | site copy, needs ad approval |
| 72 | New Cars | Snippet (Types) | 8 | Non-brand | site copy, needs ad approval |
| 73 | Used Cars | Snippet (Types) | 9 | Non-brand | site copy, needs ad approval |
| 74 | Certified Pre-Owned | Snippet (Types) | 19 | Non-brand | site copy, needs ad approval |
| 75 | Drive Right, Based in Austin | Headline (pinned H1) | 28 | Brand: Brand | brand name, approved entity fact |
| 76 | Drive Right is an Austin-based car buying and negotiation service for buyers nationwide. | Description | 88 | Brand: Brand | brand name, approved entity fact, site copy, needs ad approval |
| 77 | Compare both plans, see how the process works and choose the help that fits your search. | Description | 88 | Brand: Brand | navigation/CTA |

## Not on this sheet (held back)

These wait for `CLM-013` (compensation attestation) to be approved, and then need their own approval of exact copy. See `docs/clm-013-compensation-attestation.md`.

| Text | Type | Chars |
|---|---|---|
| No Dealer Commissions | Headline, callout | 21 |
| Paid Only by Our Customers | Headline | 26 |
| We are paid only by our customers, never by dealers, sellers or lenders. | Description | 72 |

Never in these ads without a separately approved claim: savings, time saved or speed; customer counts; reviews or testimonials; guarantees; refunds; "free"; best, lowest, perfect; "flat fee"; broker, licensed, fiduciary; financing or rates; "outreach to dozens of dealers"; "Not a dealership".
