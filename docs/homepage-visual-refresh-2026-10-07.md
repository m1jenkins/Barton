# Homepage visual refresh — October 7, 2026

Status: **published 2026-10-07** (PR #99). The user of the planning session reviewed the plan and mockups and directed publication of the copy below (“Push to main / commit”). Owner (Mason) sign-off on these strings is not separately recorded. Claim row: `HOMEPAGE-VISUAL-2026-10-07` in `data/claims.csv` (`user_directed_publication`).

## Why

All ChatGPT ads land on the homepage (docs/openai-ads-homepage-2026-10-06.md), and the page read as bare: about 700 words of body copy, with the first two screens all text. The first photo sat 2.3 screens down on desktop and 4.4 on mobile; Mason's face sat 3.9 and 7.3 screens down. The page ended on the FAQ with no button.

The Oct 5 decision to take the Mazda press photo out of the hero (docs/sales-copy-2026-10-05.md) still stands. This change uses only real photos already published on the site: Mason's headshot and his own cars.

## Decisions (2026-10-07 planning session)

| Topic | Decision |
| --- | --- |
| Hero visual | Two columns. Headline, subline, buttons and trust lines are unchanged on the left; a photo mosaic of Mason and two of his cars is on the right, stacking below the trust lines on mobile |
| Savings | The three text cards become a checklist of their approved headings, beside a static drawing of a dealer quote with the add-ons crossed out |
| Closing | New band after the FAQ with both buttons and the two-Miatas photo. The red F-Type was rejected for this spot |
| Mobile | Sticky bar with both buttons. It appears only once the hero buttons are off screen and hides over the plan cards, the closing band and the footer |
| Copy | Trimmed to the exact strings below; publication directed by the session user |

## Photos

- **Hero mosaic:** `mason-headshot`, `founder-black-mustang-gt-desert`, `founder-black-supra-fall-road`.
- **"Talk to Mason first" button:** the new `mason-avatar-96` (see docs/media-inventory.md).
- **Founder grid:** the Mustang and Supra moved to the hero, so the gray Cayman and the Ford Maverick (About page photos) take their tiles. No photo appears twice except Mason's headshot.
- **Closing band:** `about-two-mazda-miatas`.

## Exact strings

Unchanged: H1, hero subline, hero buttons and trust lines, savings H2 and lead, plan cards, proof, founder text, FAQ.

| Where | Before | After |
| --- | --- | --- |
| Hero caption | — | Mason, your advisor, with a few of his own cars. |
| Savings card 1 | Thousands of cars searched. We search thousands of listings across new, used and CPO inventory to find the exact spec you want, not the one sitting on the nearest lot. | Thousands of cars searched. |
| Savings card 2 | Hundreds of emails sent. We email and call the dealers for you so they compete for your business. You never sit in the finance office. | Hundreds of emails sent. |
| Savings card 3 | The best spec at the best deal. You get the car you actually want, negotiated hard on price and stripped of the junk fees. | The best spec at the best deal. |
| Quote drawing | — | Dealer quote · Vehicle price · ~~Paint protection~~ · ~~Nitrogen tires~~ · ~~Market adjustment~~ · ~~Dealer prep fee~~ · Tax, title & license · Add-ons and junk fees: removed. Every amount reads `$ —`. Screen-reader description: “An illustration, not a real quote. Paint protection, nitrogen tires, a market adjustment and a dealer prep fee are crossed out. The vehicle price and tax, title and license stay.” |
| Legwork 1 | Tell us once, and skip the late nights on listing sites. We research the cars and contact the dealers for you. Their replies shape the options you review. | We research the cars and contact the dealers for you. Their replies shape the options you review. |
| Legwork 2 | Salespeople negotiate every day. Now you have a negotiator too. We compare the offers, negotiate for a price below MSRP and push back on the fees, by phone and email. | We compare the offers, negotiate for a price below MSRP and push back on the fees, by phone and email. |
| Legwork 3 | You approve the deal and sign, and the car is yours. Concierge clients get help arranging shipping for out-of-state deals. | You approve the deal and sign, and the car is yours. |
| Closing band | — | Tell us the car. We’ll handle the dealer. / Full refund if you cancel before negotiations begin. / Get Full Service · $395 / Talk to Mason first |
| Mobile sticky bar | — | Full Service · $395 / Talk to Mason |

Notes:
- “Salespeople negotiate every day. Now you have a negotiator too.” is also a Google Ads description (docs/google-ads-launch-plan-2026-09-27.md). It shipped trimmed; restore it to legwork card 2 if message match with that ad matters more.
- The Concierge shipping line stays on the Concierge plan card and in the legwork drawing’s screen-reader description.
- Removed text: about 95 words of paragraph copy. Added text: about 25 words in the caption and closing band, plus the drawing’s labels.

## Implementation

- `index.html` markup.
- `buying/home.css`: homepage-only layout. `buying/drive-right.css` is untouched so its `?v=` hash stays the same on the other 16 pages, including the checksum-pinned `austin.html`.
- `buying/home.js`: the sticky bar's IntersectionObserver.
- Both new files load with `?v=` content hashes.
- The new buttons reuse the existing wiring:
  - `[data-plan]` goes to Stripe (`buying/app.js`).
  - `[data-open-inquiry]` opens the inquiry dialog (`buying/inquiry.js`).
  - `[data-cta-location]` sends `cta_click` (`script.js`). The new locations are `closing` (the pricing page already uses it) and `sticky`.
- The city drafts are regenerated from `index.html` (`npm run draft:cities`).

## How to judge it

Use the 30-day before/after comparison in docs/sales-copy-2026-10-05.md (“How to judge the change”), adding `cta_click` with `cta_location` `sticky` and `closing` on the homepage. Those two values need to be included in any GTM report or trigger that filters on `cta_location` (docs/measurement-check-2026-10-05.md).

## Follow-ups

- Rights-cleared photos of Mason at work (on a dealer call, comparing quotes, a key handoff) would beat car photos in the hero (docs/openai-ads-marketing.md).
- More written client reviews; the request template is in docs/sales-copy-2026-10-05.md.
- `austin.html` mirrors the homepage hero but is checksum-pinned; update it separately if wanted.
