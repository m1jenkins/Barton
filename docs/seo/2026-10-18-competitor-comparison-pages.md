# Competitor comparison pages — October 18, 2026

Three indexable pages for searchers who are looking at CarEdge, Delivrd and similar car buying services. Claim row: `COMPARISON-PAGES-2026-10-18` in `data/claims.csv`. Sources: `CMP-HUB-*`, `CMP-CE-*` and `CMP-DL-*` rows in `data/source-registry.csv`. Test: `scripts/_tests/competitor-comparisons.test.mjs`.

## Decision

The session user asked for an SEO win that captures "search traffic of people looking for websites like CarEdge or Delivered to me" and for the work to be owned end to end. That is a direct request for competitor-intent pages, so it supersedes the October 1 plan's deferral of comparative service lists ([plan](2026-10-01-national-competitor-seo-plan.md#editorial-plan-what-to-publish-and-in-what-order)) for these two named competitors and the hub that compares them. Merging the pull request is the publication decision; owner sign-off on individual strings is not separately recorded.

| URL | Owns | Title |
| --- | --- | --- |
| `/compare-car-buying-services.html` | car buying service comparison, CarEdge vs Delivrd, best car buying service | Car Buying Services Compared: CarEdge vs Delivrd vs Drive Right |
| `/caredge-alternatives.html` | CarEdge alternatives, sites like CarEdge, CarEdge concierge cost | CarEdge Alternatives: Compare Fees and Services \| Drive Right |
| `/delivrd-alternatives.html` | Delivrd alternatives, Delivrd cost (and the "Delivered" misspelling) | Delivrd Alternatives: New and Used Car Buying Help \| Drive Right |

No standalone "[competitor] review" or "Drive Right vs X" pages. Add one only if Search Console shows impressions for that exact query.

## Update 2026-10-23: used-car push

- New page `/used-car-buying-service.html` (title "Used Car Buying Service: We Find and Negotiate It | Drive Right") targets used-car buying service and used-car broker searches. Its only outside fact is Delivrd's used-car pause and $1,000 fee (`CMP-UC-01`, rechecked 2026-10-23). It joins the comparison-page test set.
- `/delivrd-alternatives.html` is retitled "Delivrd Alternatives for Used Cars and a Lower Fee" and leads with the pause and the $605/$305 fee gap; the pause and price were rechecked 2026-10-23.
- Both pages show the two plan cards near the top. Their buttons are plain `/schedule.html#…` links, which `script.js` already turns into direct checkout; do not add `data-plan`, or one click starts two checkouts.
- Only Delivrd is described as new-only. Authority Auto's services page lists pre-owned packages, and CarEdge, Car Pal and Automatch list used cars.

## Why these pages

Search observations on 2026-10-18 came from a search tool, not Google rank data, and could not see Reddit or keyword volumes:

- "caredge alternatives", "sites like caredge" and "delivrd alternatives" returned no page written for car buyers. Results were data aggregators (Semrush, Similarweb, CB Insights) or unrelated brands with similar names.
- Every "CarEdge vs Delivrd" style page found was written by a competitor (Motrix, CarWhere, AutoCompanion, CarEdge, Car Concierge Pro). Most were undated and lightly sourced, and six returned 404, 410 or a redirect.
- CarEdge's own guide ranked first for "car buying service comparison" and "best car buying service 2026" while quoting $400–1,200 for its Concierge; its pricing page says $999.
- Person-led fees seen clustered at $999–$1,000. Drive Right's $395 and $695 are the clearest difference.
- Search Console (2026-08-20 to 2026-09-16) showed "car buying service comparison" once, at position 30, on `schedule.html`. The query map row now points at the hub.

## What changed

- Three new current-design pages (`buying/resources.css` reading layout, comparison table styles added there) with Article and BreadcrumbList JSON-LD, a visible checked date, a competitor bias disclosure, a non-affiliation notice and a corrections address.
- Discovery: "Compare services" in the shared footer of the 13 current-design pages (city drafts regenerated; `austin.html` re-pinned in `data/metro-release.json`), a "Compare car buying services" section on `blog.html`, a link on `car-buying-service.html`, and a pricing FAQ entry on `schedule.html` ("How do you compare with CarEdge or Delivrd?").
- Records: `sitemap.xml`, `llms.txt`, `data/content-inventory.csv`, `docs/seo-execution/query-map.csv`, `data/claims.csv`, `data/source-registry.csv` (46 rows) and four seed prompts (`DR-ALT-01` to `04`) in `data/ai-prompt-panel.csv`.

## Writing rules for these pages

- Facts about another company come only from that company's own pages (or, for USAA, TrueCar's SEC filing), are quoted or closely paraphrased, carry the check date, and link to the source.
- No competitor savings figures, ratings, review counts or guarantees are repeated. Each competitor gets a fair "when X is the better pick" section.
- Drive Right statements reuse approved claim rows word for word: `SEO-PRICE-2026-09-27`, `COMPENSATION-COPY-2026-10-05`, `REFUND-LINE-2026-10-05`, `REPLY-WINDOW-2026-10-05`, `TIMELINE-2026-10-05`, `CONCIERGE-SCOPE-2026-10-05`, `MSRP-DISCOUNT-2026-09-28`. Nothing claims Drive Right has no change fee or handles trade-ins; no approved record says so.
- No `Review`, `AggregateRating`, `FAQPage`, `Organization` or `Service` markup for other companies (the validator rejects the first two and the stable-ID rules reject the last two).
- The site validator blocks the phrases "savings guarantee" and "hundreds of clients" anywhere on a page, competitor descriptions included.

## Fact sheet (checked 2026-10-18)

| Company | Facts used | Source |
| --- | --- | --- |
| CarEdge | Concierge "$999 flat, per car", one fee covers the whole search, paid "At search start"; "Buying or leasing, new or used"; closed deals in all 50 states; FAQ: typically 7 to 10 days from sign-up to possession; fee non-refundable 24 hours after the initial consultation or once you agree to proceed, "regardless of the outcome"; "One-time. No commissions, no dealer kickbacks." | [pricing](https://caredge.com/pricing) (refund and timing text is in the collapsed FAQ and its FAQPage data) |
| CarEdge | Concierge scope: research, dealer outreach, test drive coordination, price negotiation, paperwork review and delivery logistics | [service page](https://caredge.com/carbuyingservice) |
| CarEdge | AI Buying Agent "$49.99 in beta (normally $149)"; a human steps in for unusual problems; refund before dealer outreach | [checkout](https://caredge.com/checkout/ai-buying-agent) |
| CarEdge | CarEdge Certified: enrollment "bills a card"; certified dealers "show up first"; dealers cannot pay to change a grade | [for dealers](https://caredge.com/for-dealers) |
| CarEdge | Terms section 6: "may receive compensation or other consideration in connection with referrals, sponsored placements, marketplace activity or Consumer-requested services" | [terms](https://caredge.com/terms) (last updated 2026-07-24) |
| Delivrd | Insta-Pay Deal Negotiation $1,000 per deal, paid up front; pre-checkout notice "PAUSE on USED: We're only negotiating new cars"; deal starts within 7–10 business days of the consult (other pages: 10–15); GX550 6–12 month wait; trade-in and financing review included | [Insta-Pay](https://www.delivrdto.me/insta-pay-service) |
| Delivrd | "Flat fee. One deal…"; "We put in the hours whether you buy the car or not."; at least two options; refund only before work starts; $250 trim/features change, $500 different car | [service agreement](https://www.delivrdto.me/service-agreement) |
| Delivrd | Founder Tomi Mikula plus deal coordinators and negotiators; never accepts kickbacks or bonuses from dealerships; all 50 states | [team](https://www.delivrdto.me/team), [about](https://www.delivrdto.me/about-us), [press](https://resources.delivrdto.me/press) |
| Car Pal | Full Service $1,195 (cars, SUVs), $1,695 (trucks), possible $200–$500 scarcity surcharge; new and used, purchase or lease; used-car inspections and delivery arranged; $495 consulting; beat-your-deal split capped at $1,500; a broker "gets paid by a dealership" and "Car Pal is not a car broker"; Chapel Hill, NC, nationwide | [pricing](https://car-pal.com/pricing/), [FAQ](https://car-pal.com/faqs/) |
| Automatch Consulting | Premium $499, Platinum $599, Prestige custom quote; new, pre-owned and lease; created by Tom McParland | [payments](https://automatchconsulting.com/payments/), [home](https://automatchconsulting.com/) |
| Authority Auto | Full-service pricing by phone; new-car buying or leasing; negotiates with multiple dealerships; free deal review splits the savings; "will never accept any type of commission from a dealer" | [full service](https://www.authorityauto.com/full-service), [services](https://www.authorityauto.com/services), [deal review](https://www.authorityauto.com/improve-your-deal), [FAQ](https://www.authorityauto.com/faqs) |
| Costco Auto Program | Operated by Affinity Auto Programs; prearranged price with participating dealers; does not negotiate individual transactions; dealers pay a participation fee; new and pre-owned | [costcoauto.com](https://www.costcoauto.com/) |
| Consumer Reports Build & Buy | Provided and operated by TrueCar; CR collects a fee from TrueCar per TrueCar-dealer purchase; member savings need Digital or All Access | [CR service page](https://www.consumerreports.org/cars/car-prices-build-buy-service/) |
| USAA | TrueCar partnership "ended on September 30, 2020" | [TrueCar 10-Q, Q1 2021](https://www.sec.gov/Archives/edgar/data/1327318/000132731821000030/true-20210331.htm) |
| CarBargains | Ceased operations September 15, 2023 | [Checkbook](https://www.checkbook.org/carbargains/) |

Deliberately not used: Delivrd's $2,500 Concierge and $500 consultation (unlinked old pages), a CSS-hidden "5-8 business days" notice and hidden template testimonials on Delivrd's site; CarEdge Pro ($49/mo or $99/yr, conflicting descriptions) and the $749.25 Perks at Work member price; every competitor savings, ROI, rating and deal-count figure; TrueCar's own site (returned 403); Motrix, CarWhere, Rolo Rides and Car Concierge Pro (seen in search results, not verified); CarEdge's 2022 date for the USAA shutdown, which conflicts with TrueCar's filing.

## Maintenance

- Monthly, by 2026-11-18: Delivrd's used-car pause (temporary; another page calls it a 30-day hold) and CarEdge's AI beta price.
- Quarterly, by 2027-01-16: every other `CMP-*` row, and whenever a company changes its offer.
- When a fact changes: edit the page text, then update the visible "Updated" date, the Article `dateModified`, the sitemap `lastmod`, the `CMP-*` rows (`retrieved` date, `next_review`, `claim_scope`) and `COMPARISON-PAGES-2026-10-18` (`last_reviewed`, `expires_on`). The test fails if an outside link on these pages has no registry row, or a row's link disappears.
- The "lowest published fee where a person negotiates" line is only true while the hub's first table is complete and current. Recheck it whenever a competitor changes price or a new one is added.
- Corrections from the companies named go to hello@driverightcarbuying.com; fix confirmed errors the same day.

## Measurement

The three URLs return 404 on the live site until the pull request merges. After it deploys:

1. Search Console (owner): URL Inspection and Request indexing for the three URLs; confirm the sitemap shows 16 URLs.
2. Bing Webmaster Tools (owner): submit the three URLs. ChatGPT search and Copilot draw heavily on Bing.
3. After four weeks, compare impressions, clicks and average position for the `competitor_alternatives`, `competitor_pricing` and `service_comparison` rows in `docs/seo-execution/query-map.csv`, and visits from these pages to `schedule.html`.
4. Run the `DR-ALT-01` to `DR-ALT-04` prompts once the pages are indexed and record cited URLs and whether competitor prices match the registry.

Decision rules: impressions with a low click rate means revisit titles and descriptions; no impressions after six weeks means check index status and internal links before rewriting; consistent demand for a specific "Drive Right vs X" or other competitor query justifies one more page, written to the same rules.

## Checks run (Node 24.22.0)

`node scripts/validate-site.mjs` (69 HTML files, 16 sitemap URLs), `npm run check:api`, `npm run check:js`, `npm run check:metros`, `npm run check:cities`, `npm test` (267 tests) and `git diff --check` all pass. The new test was mutation-checked: removing a source row, adding an unregistered link, changing the Article date, rewording the approved compensation line and removing a Resources link each fail it. Pages rendered in Chromium at 1280px and 390px with no horizontal overflow and no console errors.
