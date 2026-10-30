# Homepage redesign modeled on Wise.com — October 25, 2026

Status: **published 2026-10-30** at the session user's direction ("Implement this website design. Once done, push to main"). Claim row: `HOMEPAGE-WISE-2026-10-30`.

## Why

From Sep 1 to Oct 23, every one of the 36 Stripe Checkout sessions expired unpaid ([openai-ads-rethink-2026-10-23.md](../openai-ads-rethink-2026-10-23.md)). The old homepage asked a stranger for $395 in one click, with one review and no price comparison. The redesign keeps both paid plans but leads with a free first step and puts the fee comparison on the homepage.

## Model

The layout copies wise.com/us section by section: section order, type scale (89px and 58px heavy uppercase display, 45px semibold headings, 18px body), the 1240px content width, the lime `#9FE870` and forest `#163300` palette, the pill buttons, and the card radii. Wise Sans is proprietary, so the display face is Inter Tight Black (OFL, self-hosted, 22 KB). No Wise copy, logos or images are used.

| Wise section | Drive Right section |
| --- | --- |
| Lime hero with the transfer calculator | Lime hero with a **dealer quote checker**: out-the-door price, add-ons (itemized or total), the price without them, then "Send Mason my quote", which opens the existing inquiry form with the numbers filled in |
| Flag row | Circle photos of Mason's cars |
| Three features | One advisor / Full refund before negotiations / New, used and CPO |
| Lifestyle photo with "Received" pill | Michael R. and his Corvette, "New Tahoe, under MSRP" |
| "100% transparent pricing" bars vs banks | **Fee comparison bars**: Drive Right $395, Automatch $499, CarEdge $999, Delivrd $1,000, Car Pal $1,195 |
| Three product cards | Three plans: Talk to Mason (free), Drive Right $395, Drive Right Pro $695 |
| "Safe at every step" | "On your side at every step" |
| Trustpilot carousel | Michael R.'s review |
| "Built for business too" | Drive Right Pro: "Torn between a few cars?" |
| "Take Wise everywhere" band | Closing band over the two-Miatas photo |
| Country link grid | Guides and comparison links |
| Footnotes and footer | Disclosures and footer |

## New copy

Most strings reuse approved claim rows. These are new or reworded, recorded in `HOMEPAGE-WISE-2026-10-30`; Mason's sign-off on each string is not separately recorded:

- The quote checker itself: "Have a dealer quote? Check it here", "Send Mason my quote". It's a free quote review in practice, the same offer the Oct 23 ads rethink proposed and left pending.
- "Most services where a person negotiates for you charge $999 or more." This rests on the 2026-10-18 fact sheet (3 of the 4 listed competitors charge $999 or more).
- The competitor bars on the homepage. Until now these facts appeared only on the comparison pages. The prices are the checked rows `CMP-*`; recheck them by 2026-11-18.
- Mock content in the plan art: a sample RAV4 Hybrid question, and "BMW X5 / Mercedes GLE / The one we'd take".
- The H1 keeps the approved "Let us deal with the dealer." with its period.

## Shipped with it

- The tests that pinned the old homepage markup now check the new hero, header and plan cards. The city-page renderer substitutes against the new markup, and the 20 private city drafts were regenerated.
- `buying/home-wise.css` and `buying/home-wise.js` load with `?v=` content hashes. Re-run `node scripts/validate-site.mjs` after editing either one, and update the hash.
- `scripts/validate-site.mjs` accepts the new `.wz-nav` no-JavaScript fallback.
- Recheck the competitor prices by 2026-11-18, together with the `CMP-*` rows.

Screenshot: `desktop-first-screen.png`.
