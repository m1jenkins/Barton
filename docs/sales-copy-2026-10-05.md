# Sales copy and conversion changes, 2026-10-05

Decision record for the homepage, Austin and pricing page rewrite that followed the 2026-10-05 conversion audit. Claim rows: `SAVINGS-ADDONS-2026-10-05`, `VOLUME-SEARCH-2026-10-05`, `BEST-DEAL-2026-10-05`, `COMPENSATION-COPY-2026-10-05`, `REPLY-WINDOW-2026-10-05`, `TIMELINE-2026-10-05`, `CONCIERGE-SCOPE-2026-10-05`, `REFUND-LINE-2026-10-05` and `SALES-COPY-2026-10-05` in `data/claims.csv`.

## What the audit found

The live homepage asked for $395 before it earned it: one testimonial on the whole site, the refund promise buried on `policy.html`, no money argument, no promise about what happens after payment, hedged copy ("participating dealers", "where available"), two equal paid buttons in the hero, and technical drag (830 KB of TTF fonts, illustration details hidden for seconds while scrolling, a consent bar covering almost half of the first screen, a sticky pricing header taking a quarter of the mobile viewport). Vercel Web Analytics had no rows because it is opt-in and shipped on 2026-10-04.

## Owner decisions (Mason, 2026-10-05)

| Topic | Decision |
| --- | --- |
| Headline | "Let us deal with the dealer." moves from the pricing page to the homepage; the subline carries the money angle |
| Hero CTA | One paid button (Full Service · $395) plus an outlined "Talk to Mason first" button; Concierge is sold on the plan cards |
| Hero visual | The Mazda MX-5 press photo is replaced by a savings section. Owner words: "we can save the average car buyer thousands by making sure dealers don't include worthless add-ons and misc fees -- we also search thousands of cars and send hundreds of emails to get you the best spec, for the best deal" |
| Claims | "I approve" for: average buyer saves thousands; thousands of cars searched; hundreds of emails sent; best spec, best deal |
| Dealer money | "No, never. Say it plainly (I approve)": dealers and lenders pay Drive Right nothing |
| Reply window | Mason replies within one business day of payment |
| Timeline | Most searches take one to two weeks; rare specs and factory orders take longer, said up front |
| Concierge | Wider search (auctions, forums, private sellers, out-of-state dealers); first-in-line service; help arranging shipping for out-of-state deals |
| Hedges | Dropped on the homepage, Austin page and pricing page; disclosures stay on `how-it-works.html` and `car-buying-service.html` |
| Proof | Mason collects more written client reviews (request message below); the review grid ships with Michael R. only |
| Header | Phone number in every current-design header; "Car buying service" leaves the main nav (footer link stays); the pricing page header has one checkout button |
| Extras | Austin hero mirrors the homepage; optional phone field on the inquiry form; footer hours read "Mon–Fri, 9 a.m.–5 p.m. Central" |
| Tech | WOFF2 font subsets; static illustrations; compressed consent bar; analytics verified and reported |

## Exact published strings

Homepage (`index.html`), also rendered into the local-only city drafts:

- H1: `Let us deal with the dealer.` (city drafts: `Let us deal with the dealer in {City}.`)
- Subline: `We find the car, work the dealers by phone and email, negotiate for a price below MSRP and strip the add-ons and junk fees. You keep your evenings and sign only when you’re happy.`
- Hero buttons: `Get Full Service · $395` (opens Stripe) and `Talk to Mason first` (opens the inquiry dialog)
- Trust lines: `One flat fee, paid once through Stripe.` · `Full refund if you cancel before negotiations begin.` · `Dealers pay us nothing. You’re the only one we work for.` · `Mason replies within one business day.`
- Savings section: `Dealers make thousands on add-ons and fees. We make sure you don’t pay them.` / `The average car buyer saves thousands when the worthless add-ons and misc fees come off the deal. That’s our job on every purchase.` / cards `Thousands of cars searched.`, `Hundreds of emails sent.`, `The best spec at the best deal.` (card bodies are in the claim rows)
- Legwork cards: `We research the cars and contact the dealers for you.` · `We compare the offers, negotiate for a price below MSRP and push back on the fees, by phone and email.` · `Pick up the keys. You approve the deal and sign, and the car is yours. Concierge clients get help arranging shipping for out-of-state deals.`
- Proof heading: `What clients say.`
- Plan cards: `Full refund if you cancel before negotiations begin.` under each price; Concierge bullets `Wider search: auctions, forums, private sellers and out-of-state dealers` / `First in line: your search starts ahead of Full Service clients` / `We help arrange shipping for out-of-state deals`
- Founder: `I research, buy, own and sell cars across new, used, CPO and enthusiast markets, so I know how add-ons, fees and “market adjustments” get slipped into a deal, and how to get them out.` / `Drive Right started when friends, family and coworkers kept asking me to handle their deals. Now I do it for buyers nationwide, one search at a time.`
- FAQ order: How long does it take? · What if I change my mind? · Do dealers pay you? · Can you get me a price below MSRP? · Where can you help me buy? · Am I in control of the final decision? · What does Drive Right do?
- Meta, Open Graph and Twitter description: `Let us deal with the dealer. Drive Right works the dealers, negotiates for a price below MSRP and strips the add-ons and fees for buyers nationwide. Flat fee: $395 or $695.`

Pricing page (`schedule.html`): the intro ends `You make the final call, and Mason replies within one business day of payment.`; plan notes add `Mason replies within one business day.`; step 02 reads `Share what you want right after checkout. Mason replies within one business day to confirm the search and when it starts.`; FAQ gains `How long does it take?` and `Do dealers pay you?`; description `Let us deal with the dealer. Flat fee of $395 or $695: we search, work the dealers, negotiate for a price below MSRP and check the fees. Full refund if you cancel before negotiations begin.`

Austin page (`austin.html`): H1 `Austin car buying service. Let us deal with the dealer.`, the homepage subline plus `Based in Austin, here for Texas buyers.`, the same buttons and trust lines.

Elsewhere: `how-it-works.html` step 02 and the Concierge plan card; `car-buying-service.html` Concierge plan card; `payment-success-fullservice.html` and `payment-success-concierge.html` intake success message (`Mason replies within one business day to confirm the search and when it starts.`); `buying/inquiry.js` success message (`Thanks. Your car search inquiry is saved. Mason replies within one business day, or call (512) 910-4938.`); `pricing.md` Concierge "Includes" line.

## Review request for past clients

Each review is published only after its own `testimonial` row in `data/claims.csv` quotes the client's exact words and records the permission. Suggested message from Mason:

> Hi {first name}, thanks again for letting me help with the {car}. I'm adding a few client reviews to the Drive Right site and would love to include yours. Two or three sentences is plenty: what you were dreading about buying, and how it went. If you're happy for me to publish it, reply with the text and let me know whether I can use your first name, last initial and city (for example "Michael R., Austin"). If you'd rather I didn't publish anything, no problem at all.

Markup for each new review (`index.html` "What clients say" section, after Michael R.): `<div class="review-grid">` containing `<figure class="review-card"><blockquote><p>…</p></blockquote><figcaption>Name L., City</figcaption></figure>`. The grid lays out one to nine cards. No Review or AggregateRating schema.

## How to judge the change

For 30 days before and after release, compare `cta_click` with `cta_location` `hero` (homepage), `pricing` and `closing` (pricing page) and `header` against homepage and pricing page visits, `begin_checkout` per `cta_click`, `generate_lead` (inquiry) per homepage visit, and `purchase_verified` per `begin_checkout`. The measurement check in `docs/measurement-check-2026-10-05.md` records what currently fires and what still needs a GTM trigger.

## Phase 2 (recorded, not built)

- Redesign of the 47 legacy pages (`styles.css`), which still show the old header and no phone number.
- Post-payment intake drop-off review (markup changed in `edf96bc`).
- Stripe checkout page copy check in test mode (`outputs/2026-10-google-search-ads/stripe-checklist.md`).
- Custom 404 page.
