# Pricing room and fee rules

Background for judging a quote and setting counters, researched November 3, 2026. The figures are monthly snapshots. Once one is more than about three months old, treat it as a direction rather than a number, and check current data before it decides a move. Sources are listed at the end.

## New cars

- **Average discount.** In July 2026 the average new car sold for $49,855 against an average MSRP of $51,621, about 3.4% under sticker [1]. Edmunds put the gap between MSRP and transaction price at its widest since February 2021 in early 2026 [2]. That is a fleet average: low single-digit percent, varying widely by model.
- **Supply decides the room.** Days' supply in September 2026 was 35 for Toyota and 41 for Lexus, the least room to negotiate. Jeep had 169, Ram 152 and Dodge 149, the most room, against 82 for the industry [3]. Supply varies by model and region, so the local version is MarketCheck's count of the same model nearby and its days on lot. High supply does not guarantee factory cash.
- **Factory incentives.** Incentives were smaller than a year earlier: 6.4% of transaction price in July 2026 and 6.6% by September, against 7.3% in July 2025 [1]. Part of that money goes to financing and lease offers, not cash. Look up each car's offers with `search_oem_incentives_by_zip`.
- **Invoice.** An OTD near invoice is a strong new-car deal, and prior-model-year cars can go below it [4, one commercial source]. Invoice is not the dealer's cost, because holdback and dealer cash sit underneath it, and many models never get near it. Use invoice as a benchmark only when Mason has a reliable figure. Dealer emails ask for the itemized OTD, not the invoice.
- **Bait prices.** An advertised price can be bait. Confirm that the car is in stock and that its window sticker matches before trusting the price [5].

## Used and certified cars

- **Market value.** Price each car against its own market with `predict_price_with_comparables`, comparable listings nearby, and `get_car_history` for price cuts and moves between dealers.
- **Time on the lot.** This is the main leverage. In CarGurus' 2011 data, 53% of used listings older than 30 days had at least one price cut, rising to 60% after 45 days [6]. The data is old, so use it for direction only.
- **Certified premium.** Certified cars cost more for the warranty: about 3.6% on average in 2018 sales, from about 2% on mainstream models to about 8% on luxury ones [7]. Weigh the premium against the certified warranty's actual terms.
- **No match-or-beat.** No two used cars are alike, so match-or-beat works poorly [4]. Argue from comps and days on lot instead.

## Fees and add-ons

- **Doc fee.** A dealer charges every buyer the same doc fee. Where the state caps it, a fee above the cap is improper, so ask for a correction. Where it is uncapped, it is dealer profit: leave the line alone and take the difference out of the sale price through the OTD [5].
- **Texas doc fee.** Up to $225 is presumed reasonable under 7 TAC §84.205, as amended in 2024. A dealer charging more must first file a notice and cost analysis with the OCCC. The OCCC circulated a draft amendment in May 2026, so check the adopted rule before relying on the figure [8].
- **Other states.** Confirm a cap on the state's statute, DMV or attorney general site. Commercial lists of doc-fee caps disagree with each other.
- **Dealer add-ons.** These include tint, paint and fabric protection, nitrogen tires, VIN etching and wheel locks. The buyer does not have to pay for an add-on they did not ask for, even one already installed [9]. That is leverage, not a legal right everywhere: a dealer can refuse to sell the car without it.
- **Typical prices.** Consumer Reports gives these for context: VIN etching $200 to $300, paint protection about $600, rustproofing about $800, and a dealer extended warranty $2,000 or more [9].

## Law

These points guide Mason's judgment. Dealer emails stay with price and offers (SKILL.md step 5).
- The FTC's CARS Rule never took effect. The Fifth Circuit vacated it on January 27, 2025, and the FTC withdrew it effective February 12, 2026 [10]. Do not cite it. The FTC Act's general ban on deceptive practices and each state's own laws still apply.
- For California dealers, SB 766 (in effect October 1, 2026) bans charging for add-ons that give the buyer no benefit and requires telling buyers that add-ons are optional [11].

## Sources

1. Kelley Blue Book, July 2026 transaction prices and incentives: https://mediaroom.kbb.com/2026-08-11-Kelley-Blue-Book-Report-New-Vehicle-Prices-Trend-Higher-in-July-as-Incentives-Decline-and-Sales-Pace-Slows; September follow-up tables: https://www.coxautoinc.com/wp-content/uploads/2026/10/September-2026-Kelley-Blue-Book-Average-Transaction-Price-tables.pdf
2. Edmunds, Jessica Caldwell, Chicago Fed symposium 2026: https://www.chicagofed.org/-/media/images/events/2026/ais/jessica-caldwell-automotive-landscape-shifts-pricing-value-affordability.pdf
3. Cox Automotive, September 2026 new-vehicle inventory: https://www.coxautoinc.com/insights/september-2026-new-vehicle-inventory/
4. CarEdge (a competing car-buying service): https://caredge.com/guides/how-much-dealers-mark-up-new-cars-in-2026 and https://caredge.com/guides/negotiate-a-car-by-email
5. Consumer Reports, negotiating by email or phone: https://www.consumerreports.org/car-pricing-negotiation/how-to-negotiate-car-prices-by-email-or-phone; dealership tactics: https://consumerreports.org/cars/buying-a-car/beat-four-square-and-other-car-dealership-sales-tactics-a7590220303/
6. CarGurus, 2011 used-listing price drops: https://blog.cargurus.com/2011/02/22/buying-a-used-car-wait-for-the-price-to-drop
7. iSeeCars, certified pre-owned premium study: https://www.iseecars.com/certified-pre-owned-cars-study
8. Texas OCCC, doc-fee rule amendment (2024) and May 2026 draft: https://occc.texas.gov/sites/default/files/2024-06/mvsf-docfee-adoption-fc-071124.pdf and https://occc.texas.gov/wp-content/uploads/2026/05/mvsf-docfeerule-precmtdraft-mtgnotice-051426.pdf
9. Consumer Reports, dealership extras: https://www.consumerreports.org/cars/buying-a-car/just-say-no-to-these-car-dealership-extras-a9471188276
10. Federal Register, CARS Rule withdrawal (91 FR 6507): https://www.govinfo.gov/content/pkg/FR-2026-02-12/html/2026-02866.htm
11. California SB 766, bill author's release: https://sd24.senate.ca.gov/news/press-release/senator-allen-delivers-needed-transparency-and-consumer-protections-car-shoppers; California DMV implementation notice: https://www.dmv.ca.gov/portal/file/26olin10-pdf/
