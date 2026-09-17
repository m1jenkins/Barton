# Implementation plan: 20 metro car-buying pages

**Status:** execution plan, September 16, 2026. Companion to [the metro search framework](metro-seo-expansion-plan.md). No page in this plan is approved for publication by virtue of appearing here.

## 1. Scope and publishing rule

Build **one primary service page for each of the 20 metropolitan markets** in the earlier framework. The names within an MSA (for example, New York, Newark, and Jersey City) are coverage and search terms to research, not an automatic instruction to create three near-identical pages. Add a separate city page only when it has a distinct buyer intent, a confirmed service model, and enough local evidence to be useful on its own. This follows Google's doorway and scaled-content policies.

The project also includes a disposition decision for every existing Texas city page: Austin, Arlington, Dallas, El Paso, Fort Worth, Houston, New Braunfels, San Antonio, and San Marcos. The current nine remain noindexed under `docs/release-readiness.md` Gate 5. Dallas–Fort Worth and Houston are the first two top-20 pilots; Austin is the existing operational anchor outside the population top 20.

**Business gate for all non-Texas metros:** record which Drive Right tier can be sold and fulfilled for a buyer in each state, the remote versus in-person boundary, seller and delivery limits, pricing/checkout scope, and qualified review of jurisdiction-sensitive wording. The website currently says Texas only. A market may be researched and drafted locally while its gate is pending, but it cannot be deployed as an available local service or submitted for indexing until its claims are approved. `noindex` is a search directive, not an access control. A page cannot imply a local office, staff, or Google Business Profile that does not exist.

## 2. URL and information architecture

Use the current **root-level `.html` convention** for this rollout. `scripts/validate-site.mjs` currently enumerates root HTML files and maps only root `.html` URLs to sitemap entries. A new `/markets/` directory would require a separate validator and routing change. Add one indexable `service-areas.html` hub when it contains useful information and at least the approved pilot pages; it should list only currently served markets and explain the Austin base and remote service boundaries.

The following slugs are proposed canonical URLs. Confirm the primary search term and existing backlink/GSC data before freezing them. The **research prompt** is a question to investigate, not approved public copy or a verified local fact.

| ID | Metro market and named-city coverage | Proposed page | State/jurisdiction scope to verify | Distinct research prompt |
| --- | --- | --- | --- | --- |
| M01 | New York–Newark–Jersey City | `new-york.html` | NY, NJ | How would buyer location, seller location, pickup, and any broker terminology change the service? |
| M02 | Los Angeles–Long Beach–Anaheim | `los-angeles.html` | CA | What may Drive Right offer under California rules, and how would sourcing and delivery work across the metro? |
| M03 | Chicago–Naperville–Elgin | `chicago.html` | IL, IN | Which buyer/seller combinations cross a state line, and what transaction steps differ? |
| M04 | Dallas–Fort Worth–Arlington | `dallas-fort-worth.html` | TX | What distinct local buyer needs can support remote car-finding, written-offer comparison, seller communication, and buyer-paid shipping? |
| M05 | Houston–Pasadena–The Woodlands | **Reuse** `houston.html` | TX | What distinct local buyer needs can support remote car-finding, written-offer comparison, seller communication, and buyer-paid shipping? |
| M06 | Atlanta–Sandy Springs–Roswell | `atlanta.html` | GA | What seller outreach radius and buyer paperwork decisions can Drive Right actually support? |
| M07 | Washington–Arlington–Alexandria | `washington-dc.html` | DC, VA, MD, WV | Which parts of this four-jurisdiction metro are genuinely served, and how do cross-border purchases work? |
| M08 | Miami–Fort Lauderdale–West Palm Beach | `miami.html` | FL | Which vehicle-history and inspection questions are locally useful, and how far can sourcing extend? |
| M09 | Philadelphia–Camden–Wilmington | `philadelphia.html` | PA, NJ, DE, MD | How will service scope, pickup, title, and registration be explained across jurisdictions? |
| M10 | Phoenix–Mesa–Chandler | `phoenix.html` | AZ | Which inspection and inventory questions appear in local buyer searches and first-party inquiries? |
| M11 | Boston–Cambridge–Newton | `boston.html` | MA, NH | How are Massachusetts/New Hampshire buyer and seller cases handled and disclosed? |
| M12 | Riverside–San Bernardino–Ontario | `inland-empire.html` | CA | What distinct sourcing, travel, and delivery value separates this market from Los Angeles? |
| M13 | San Francisco–Oakland–Fremont | `san-francisco-oakland.html` | CA | What local inventory and transaction evidence can support a page distinct from other California markets? |
| M14 | Detroit–Warren–Dearborn | `detroit.html` | MI | Which vehicle-selection and inspection questions recur in actual local searches or inquiries? |
| M15 | Seattle–Tacoma–Bellevue | `seattle.html` | WA | What purchase-cost, seller communication, and pickup information can Drive Right verify? |
| M16 | Minneapolis–St. Paul–Bloomington | `minneapolis-st-paul.html` | MN, WI | Which cross-state and used-vehicle inspection decisions need a locally reviewed explanation? |
| M17 | Tampa–St. Petersburg–Clearwater | `tampa-bay.html` | FL | What vehicle-history, inspection, and seller/pickup concerns differ from Miami and Orlando? |
| M18 | San Diego–Chula Vista–Carlsbad | `san-diego.html` | CA | What local buyer questions and sourcing radius distinguish San Diego from the other California pages? |
| M19 | Denver–Aurora–Centennial | `denver.html` | CO | Which registration, total-cost, inspection, and travel questions have evidence and search demand? |
| M20 | Orlando–Kissimmee–Sanford | `orlando.html` | FL | What makes Orlando's buyer workflow distinct from Tampa and Miami? |

**Named-city rule:** the visible page may say “serving [named cities]” only where the owner confirms that coverage. The labels above define MSAs for research; they do not prove coverage of every constituent city or county.

### Existing Texas page disposition

| Existing page | Planned decision |
| --- | --- |
| `austin.html` | Complete its existing local evidence and review gate; keep it as the truthful Austin base page. |
| `houston.html` | Rewrite and release as M05 after the Houston dossier and existing gate pass. |
| `dallas.html`, `fort-worth.html`, `arlington.html` | Audit links and GSC data, consolidate useful content into M04, then permanently redirect the old URLs to the approved DFW page in the same release. Retain a separate page only if it passes the distinct-intent and evidence test. |
| `san-antonio.html`, `el-paso.html` | Keep in the Texas backlog as separate markets; complete the same release gate when demand and service evidence justify them. |
| `new-braunfels.html`, `san-marcos.html` | Review for unique demand and value. If insufficient, merge useful material into the appropriate Austin/San Antonio page and redirect only after URL and link review. |

Do not bulk redirect the existing URLs before their destination exists and the link/traffic baseline is captured.

### Shared-site changes before the first out-of-Texas release

The current national path is more than a new page template. `index.html`, `how-it-works.html`, `schedule.html`, `about.html`, page footers, `pricing.md`, `llms.txt`, and the title logic in `buying/app.js` currently frame the offer as Texas-only. Update these together to name the **approved** service scope, while continuing to state that Drive Right is based in Austin. Keep `texas-local-market-intelligence.html` as the Texas hub and link it from the broader service-areas hub; do not repurpose it as a nationwide page.

`buying/intake.js` accepts a five-digit U.S. ZIP as a search origin. Before national checkout goes live, implement and test a tier-aware coverage decision in the user flow and the server checkout path (`api/checkout-start.js` plus the relevant validation module). An out-of-coverage buyer may still be offered a clear inquiry path, but should not pay for a service that is unavailable to them. Review `policy.html` (including its Texas governing-law text), checkout descriptions, tax handling, refund language, and confirmation emails/pages with the owner and qualified reviewer. Update `data/services.json`, `data/entities.json`, and the claim records from the same approved facts. Avoid a blanket “nationwide” claim while only selected metros or tiers are operational.

## 3. Work packages and dependencies

| Order | Work package | Owner | Deliverable | Exit condition |
| ---: | --- | --- | --- | --- |
| 0 | Business coverage and offer truth | Business owner + operations | State/metro eligibility matrix with eligible tiers, ZIPs, remote/in-person scope, seller/pickup/delivery limits, response capacity | Every published market has an owner-approved service statement and checkout path |
| 1 | Jurisdiction and claim review | Qualified reviewer + owner | State-specific role/advertising/fee review; approved language for any title, tax, finance, insurance, safety, or broker claim | `data/claims.csv` and `data/services.json` contain exact approved scope; no unresolved consequential claim is copied into a page |
| 2 | Baseline and search research | SEO + analytics | 28-day GSC/GA4 baseline; query/competitor/AI-result snapshot per MSA; traffic and link inventory for old Texas URLs | Every page has a chosen intent, evidence of demand, and a baseline before a redirect or indexing change |
| 3 | Content and page system | Editor + developer + designer | Accessible static page pattern, `service-areas.html` hub, metro dossier template, source and claim workflow | Pilot page passes content, mobile, crawl, and conversion checks |
| 4 | Texas pilot | SEO + editor + reviewer + developer | M04 and M05, plus Austin evidence work | Each released URL passes the individual Gate 5 and production QA checklist below |
| 5 | National market packages | Same team | Dossiers, approved copy, page files, links, and measurement for M01–M03 and M06–M20 | Only eligible, approved markets enter a release batch |
| 6 | Evaluation and maintenance | Analytics + editor + owner | 30/60/90-day page reviews, corrections, refresh schedule, merge/redirect decisions | Qualified lead and search evidence determines the next batch |

**State research can be shared; pages cannot be cloned.** Group the remaining 18 markets for efficient expert review: Florida (M08, M17, M20), California (M02, M12, M13, M18), single-state markets (M06, M10, M14, M15, M19), and multi-state metros (M01, M03, M07, M09, M11, M16). This is a research work queue, not a promise to publish in that order. The opportunity score in the strategy document decides publication order after service eligibility is known.

## 4. Repeatable page production workflow

For **each of M01–M20**, use one record with these fields before drafting: ID; canonical slug; MSA and intended named-city coverage; confirmed buyer ZIPs; eligible service tiers; service boundary; primary query and supporting intents; five representative organic competitors and SERP date/location; source-backed local decision points; approved first-party example or transparent worksheet; claim/source IDs; reviewer; review/expiry date; CTA destination; and release status.

1. **Research the query and results.** Test `car buying service`, `car buying concierge`, `car buying advisor`, and negotiation-help variants with metro names. Record whether the results are dominated by buyer-side advisors, dealers, marketplaces, directories, or information guides. Select the page's primary intent from evidence, not a city-name substitution rule.
2. **Build the local dossier.** Obtain at least two independently useful local decision modules from primary sources or documented Drive Right work. Include an as-of date and the decision a buyer can make with each fact. Investigate the page-specific prompt in the table; discard angles that are not supported or relevant.
3. **Approve service and consequential facts.** Confirm coverage and current fees with the owner. Route broker/dealer terminology, title, tax, financing, safety, inspection, warranty, and outcome language through `docs/claim-review-workflow.md`. Record sources in `data/source-registry.csv` and exact approved wording in `data/claims.csv`.
4. **Draft a complete buyer journey.** Opening answer with the truthful Austin base and service scope; who it serves; how the tier works; the two local modules; a real consented example or clearly hypothetical worksheet; pricing/exclusions; direct questions; contact and buying-brief CTA. A visitor should understand the service and its limits without leaving the page.
5. **Perform the city-swap and overlap review.** Compare against every other metro draft. If replacing the city name leaves the content equally useful, revise it. Compare Los Angeles/Inland Empire/San Diego, Miami/Tampa/Orlando, and the DFW components especially closely. A page for a synonym, suburb, or adjacent metro needs distinct value, not just another keyword.
6. **Implement as static HTML.** Use the root `.html` path, one H1, distinct title and meta description, self canonical, crawlable body text, meaningful internal links, accessible images, and a visible contact route. Use truthful `Organization`, `WebPage`, `Service`/`areaServed`, and breadcrumbs only where their data matches the page. Do not mark every metro as a separate `LocalBusiness`.
7. **Contain until approval.** Keep unapproved market drafts in a local branch or controlled preview, away from the public production site. Any draft intentionally present on a public preview uses `noindex, follow` and stays out of `sitemap.xml`; this directive does not hide it from visitors. Add planned/released states to `data/content-inventory.csv`; add an approved market to `data/entities.json` only when the organization really serves it. Make `scripts/validate-site.mjs` release-aware so it protects unreleased pages and permits only individually approved pages to become indexable.
8. **Release one approved page or batch.** Check service text, prices, checkout, policy, metadata, social previews, structured data, internal links, and hub membership together. Remove `noindex`, add the exact canonical URL and actual modification date to the sitemap, and perform any approved one-hop redirects. Inspect the deployed HTML and use GSC URL Inspection after the production redirect matrix passes.
9. **Measure and refresh.** Track non-brand impressions/clicks by query and URL, Generative AI impressions in Search Console, AI referral visits where identifiable, qualified inquiries, paid conversions, and margin by market. Log corrections and review dates. At day 90, improve, merge, or redirect pages that do not earn distinct value or relevant demand, as Gate 5 already requires.

## 5. Release checklist for each URL

A page may change from draft to indexable only when all items are checked and recorded:

- [ ] Buyer coverage, tier, service boundary, fees, and checkout wording are owner-approved for the metro's actual jurisdictions.
- [ ] Consequential claims have evidence, a named qualified reviewer where needed, exact approved copy, and a next-review date.
- [ ] Primary query/intent and distinct local buyer value are documented; two local modules and the example/worksheet have been reviewed.
- [ ] The page, hub, internal links, canonical, metadata, and structured data agree; no fictional office, map pin, review count, team member, or saving appears.
- [ ] ZIP-based lead and checkout path handles an out-of-coverage visitor accurately before payment.
- [ ] Mobile, keyboard, JS-disabled text, form, privacy, and payment-path checks pass on the deployed artifact.
- [ ] `node scripts/validate-site.mjs`, `npm run check:api`, `npm test`, and `git diff --check` pass for the implementation release; the redirect checker passes after deployment when redirects are involved.
- [ ] Sitemap membership equals indexable approved pages, and GSC URL Inspection sees the intended canonical and robots directives.
- [ ] Analytics can attribute a qualified inquiry and verified purchase to the market without inventing a conversion from a click or success-page view.

Google requires a page to be indexed and snippet eligible before it can appear as a supporting link in AI Overviews or AI Mode. Its AI guidance calls for original, helpful information rather than AI-specific markup or `llms.txt` work. The existing crawler rules and `llms.txt` are already in place; page quality, release eligibility, and measurement carry the work here.

## 6. Rollout checkpoints

| Checkpoint | Scope | Decision |
| --- | --- | --- |
| A: foundation | Coverage matrix, reviewer capacity, GSC/GA4 baseline, page system, hub draft | Which states and tiers may the site truthfully offer? |
| B: Texas pilot | M04 DFW and M05 Houston; Austin dossier in parallel | Did the pages pass their individual release gates and create relevant search/lead signals? |
| C: first national batch | 2–4 highest-scoring eligible markets, chosen from the researched pool | Did the process and reviewer capacity work outside Texas? |
| D: subsequent batches | Remaining eligible markets in manageable groups | Which markets still justify a distinct page? |
| E: 30/60/90-day reviews | Every published batch | Refresh, improve, merge, or redirect from observed results |

Do not assign traffic or ranking targets until the baseline exists. Search visibility is a leading indicator; qualified consultations and profitable purchases determine whether to keep investing in a metro. Full coverage of all 20 is a business expansion objective, conditional on the service and evidence gates, not a reason to publish 20 pages at once.

## References

- [U.S. Census Bureau: 2025 MSA population tables](https://www.census.gov/data/tables/time-series/demo/popest/2020s-total-metro-and-micro-statistical-areas.html) — defines the original 20-market population pool.
- [Google Search spam policies](https://developers.google.com/search/docs/essentials/spam-policies) — doorway pages, scaled content, keyword stuffing.
- [Google Search AI optimization guide](https://developers.google.com/search/docs/fundamentals/ai-optimization-guide) and [AI features technical eligibility](https://developers.google.com/search/docs/appearance/ai-features) — ordinary SEO and index/snippet requirements.
- [Google Business Profile service-area guidance](https://support.google.com/business/answer/9157481) — one real service-area profile and geographic boundaries; this page plan does not create branch profiles.
- [California DMV autobroker guidance](https://qr.dmv.ca.gov/portal/handbook/vehicle-industry-registration-procedures-manual-2/general-information-licensees/autobroker/) — example of a state-specific operating question to resolve before claiming service.
