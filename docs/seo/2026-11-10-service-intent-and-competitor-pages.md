# Service-intent and competitor pages — November 10, 2026

Read this before editing `car-negotiation-service.html`, `car-buying-service-cost.html`, `is-caredge-concierge-worth-it.html` or `delivrd-review.html`, or before adding another page for a competitor or service search. It records why the four pages exist, what they may say, and how they are kept current. The writing rules, fact sheet and maintenance steps in [2026-10-18-competitor-comparison-pages.md](2026-10-18-competitor-comparison-pages.md) apply to all four; this file records only what is new.

## Decision

Mason asked on November 9, 2026 (thread "SEO review and fixes") for an SEO review aimed at "people looking for car buying services and for people Googling our competitors, like Car Edge or Delivered", with new pages to be proposed first. Four pages were proposed and he approved them on November 10, 2026 ("i approve all changes and pages"). Merging the pull request is the publication step.

| URL | Owns | Why |
| --- | --- | --- |
| `/car-negotiation-service.html` | car negotiation service, car negotiator, car buying agent, car buyer's advocate, hire someone to negotiate car price | "car negotiation service" was the site's best non-brand query (105 impressions, position 13.6, July 22 to October 21, 2026) with no page written for it; the agent, advocate and consultant variants added about 150 more impressions |
| `/car-buying-service-cost.html` | car buying service cost, auto broker fees, how much do car brokers charge | Fee questions showed in Search Console with nothing on the site answering them; two held-back blog posts covered the ground but carried unapproved claims |
| `/is-caredge-concierge-worth-it.html` | is caredge worth it, caredge concierge review, caredge concierge cost | Catches the competitor name plus "review" or "worth it", which the alternatives page only partly covers |
| `/delivrd-review.html` | delivrd review, delivrd car buying reviews, delivrd legit | Same, for Delivrd (and the "Delivered" spelling) |

The October 18 plan said to add competitor "review" pages only once Search Console showed demand for those exact queries. The new Search Console property has had data only since November 7, so that rule could not be applied; Mason's direct request on November 10 supersedes it for these two pages.

## Rules specific to these pages

- **"Review" means Delivrd's own pages, nothing else.** The Delivrd review carries a competitor-bias disclosure in its opening box, gives no rating, repeats no third-party review or star count, and answers "Is Delivrd legit?" only with what Delivrd's own pages say. Keep it that way; a rating or a quoted customer review would turn a sourced comparison into an opinion piece from a competitor.
- **No "broker" for Steer Me Right.** The cost page explains the broker search terms and quotes Car Pal's line that a broker "gets paid by a dealership", but Steer Me Right is never described as a broker (the Google Ads plan forbids the word and Texas regulates it).
- **No leasing claim.** Steer Me Right has no approved statement about leases, so the CarEdge page does not say whether we handle them.
- **Steer Me Right copy** reuses the approved rows word for word: `PLAN-NAMES-2026-10-23`, `DRIVE-RIGHT-SCOPE-2026-10-23`, `PRO-SCOPE-2026-10-23`, `COMPENSATION-COPY-2026-10-05`, `REFUND-LINE-2026-10-05`, `REPLY-WINDOW-2026-10-05`, `TIMELINE-2026-10-05`, `MSRP-DISCOUNT-2026-09-28`. The "free question" line on the CarEdge page is the homepage's approved "Not sure which plan you need?" copy.
- **Homepage linking.** The homepage still links none of the competitor pages (October 30 decision). The new pages are reached from `blog.html`, `car-buying-service.html`, the other comparison pages, `how-it-works.html` and the three released guides.

## Records

- `sitemap.xml` (21 URLs), `llms.txt`, `blog.html` (cards and `ItemList` positions 13 to 16), `data/content-inventory.csv` (four `indexable_owner_publication` rows), `docs/seo-execution/query-map.csv` (13 rows, Search Console figures from the October 23 pull), `data/claims.csv` (`COMPARISON-PAGES-2026-10-18` observed locations).
- `data/source-registry.csv`: `CMP-CN-*` (negotiation), `CMP-CO-*` (cost), `CMP-CW-*` (CarEdge), `CMP-DR-*` (Delivrd). Prices rechecked November 10, 2026 carry `next_review` 2026-12-10; facts carried over from the October 18 check say so in `effective_date` and keep 2027-01-16.
- `scripts/_tests/competitor-comparisons.test.mjs` now checks all eight pages for indexability, dates, byline, approved claims and registered outside links. The six competitor pages must link each other; the two service pages must link the hub.

## Fact changes found on November 10, 2026

Delivrd's Insta-Pay page no longer carries the "PAUSE on USED" notice or the 7 to 10 business day line; it says "New Cars Only" and "within 5-8 business days". The existing pages were updated in the same pull request (see the update note in the October 18 file). CarEdge's refund and timing FAQ answers were not in the fetched pricing page (the FAQ is collapsed), so those two facts are dated October 18, 2026 on the pages that use them. CarEdge's AI Buying Agent checkout page refuses automated fetches; its price was read from the pricing page.

## Measurement

1. After the merge: `npm run indexnow`, then Search Console URL Inspection and Request indexing for the four URLs.
2. After four weeks: impressions, clicks and position for the `service_intent`, `competitor_pricing` and `competitor_review` rows in `docs/seo-execution/query-map.csv`, and visits from these pages to `schedule.html`.
3. Decision rules from the October 18 file apply: low click rate means revisit titles and descriptions; no impressions after six weeks means check index status and internal links before rewriting.

## Checks run

`node scripts/validate-site.mjs` (72 HTML files, 21 sitemap URLs), `npm test` (317 tests) and `git diff --check` pass. The four pages rendered in Chromium at 1280px and 390px with no horizontal overflow and no console errors other than the sandbox blocking Google Tag Manager.
