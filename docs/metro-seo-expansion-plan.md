# Drive Right metro search expansion framework

**Status:** planning only, September 16, 2026. This document does not approve national service coverage, publish a page, change indexing, or make a claim about expected rankings.

## 1. Decision and starting point

Build a **metro service page only where Drive Right can actually fulfill the advertised service**, then support it with useful local purchase information and verifiable evidence. Treat Google organic results and AI citations as the main national discovery surfaces. An Austin-based Google Business Profile cannot be expanded into a nationwide local-map presence merely by listing distant service areas.

The live homepage says Drive Right is based in Austin and serves Texas buyers. The repository has nine Texas service-area pages, all marked `noindex`; the sitemap contains no metro pages. `docs/release-readiness.md` Gate 5 requires unique verified logistics, dated regional evidence, a real example where available, and either attributable consultation activity or genuine non-brand demand before a metro page is released. `data/entities.json` records one organization and no satellite offices. The current `robots.txt` permits the principal search crawlers, and `llms.txt` already exists. These are useful foundations, but they do not make the noindexed pages eligible to appear in Google search features.

**First business decision:** confirm whether out-of-Texas buyers are eligible today for each tier, and document what is remote, what is in person, seller reach, delivery coordination, turnaround, prices, and buyer responsibilities. Review state-specific operating and advertising requirements before claiming service in a new state. For example, the California DMV describes compensated vehicle purchase assistance and negotiation within its autobroker framework; a qualified reviewer must determine how Drive Right's actual model applies there. Until that decision is made, the outside-Texas markets below are research candidates, not service claims.

## 2. Define the 20-market pool

Use **metropolitan statistical areas (MSAs), not city limits**, as the initial geography. The following is the 20 largest U.S. MSA pool by the Census Bureau's July 2025 population estimates. Population is a starting proxy for audience size, **not a ranking of car purchases or of Drive Right's opportunity**. S&P Global Mobility's first-half 2025 new-vehicle registration ranking differs from population order, so the publication order must be separately scored.

| Census population rank | Metro label for research | Existing Drive Right page? |
| ---: | --- | --- |
| 1 | New York–Newark–Jersey City | No |
| 2 | Los Angeles–Long Beach–Anaheim | No |
| 3 | Chicago–Naperville–Elgin | No |
| 4 | Dallas–Fort Worth–Arlington | Dallas, Fort Worth, Arlington drafts; all noindex |
| 5 | Houston–Pasadena–The Woodlands | Houston draft; noindex |
| 6 | Atlanta–Sandy Springs–Roswell | No |
| 7 | Washington–Arlington–Alexandria | No |
| 8 | Miami–Fort Lauderdale–West Palm Beach | No |
| 9 | Philadelphia–Camden–Wilmington | No |
| 10 | Phoenix–Mesa–Chandler | No |
| 11 | Boston–Cambridge–Newton | No |
| 12 | Riverside–San Bernardino–Ontario | No |
| 13 | San Francisco–Oakland–Fremont | No |
| 14 | Detroit–Warren–Dearborn | No |
| 15 | Seattle–Tacoma–Bellevue | No |
| 16 | Minneapolis–St. Paul–Bloomington | No |
| 17 | Tampa–St. Petersburg–Clearwater | No |
| 18 | San Diego–Chula Vista–Carlsbad | No |
| 19 | Denver–Aurora–Centennial | No |
| 20 | Orlando–Kissimmee–Sanford | No |

Austin and San Antonio are already meaningful Drive Right markets even though they are outside this strict top-20 population pool. Keep them in the existing Texas strategy. Do not mistake the 20-population list for a mandate to prioritize New York over the Austin base.

## 3. Choose launch order with an opportunity score

Apply a **pass/fail service gate** first: owner-confirmed eligibility, operational capacity, and jurisdictional review for the actual tier and wording. A market that fails the gate can remain on the research list, but no service landing page should claim availability there.

For eligible metros, score each on a 0–5 scale, then use these planning weights:

| Factor | Weight | Evidence to collect |
| --- | ---: | --- |
| Search demand and buyer intent | 25% | GSC non-brand queries, Google Ads Keyword Planner or another documented volume source, query intent and search-result composition |
| Ability to serve profitably | 25% | Staff capacity, seller participation, delivery/pickup feasibility, expected margin by service tier |
| Competitive opening | 20% | Representative mobile and desktop results, incumbent service pages, their evidence and conversion gaps |
| Local proof and content depth | 15% | Consented buyer stories, documented first-party deal patterns, local process details, dated primary sources |
| Existing brand/search traction | 15% | Direct inquiries, GSC impressions, referral relationships and legitimate local mentions |

These weights are a **decision hypothesis**, not measured rankings. Record the data source, period, and confidence for each score. Use a paid registration dataset if available; S&P's published 2025 DMA top ten can serve as a directional check, but DMA and MSA boundaries differ. Do not equate population or vehicle registrations with demand for a paid buying advisor.

**Likely first experiment:** bring Dallas–Fort Worth and Houston through their existing review gates. These are both in the population top 20 and already have drafted URLs, so they minimize new-market uncertainty. Use Austin as the operational reference market and build its local evidence in parallel. Select the first outside-Texas market only after the service gate and opportunity score are complete.

## 4. Search-intent research for each metro

Create a one-page research record for each MSA with the following query families. Confirm actual volume and search-result intent before choosing one primary query and supporting variants:

| Intent | Seed patterns to test | Intended page |
| --- | --- | --- |
| Hire assistance now | `car buying service [metro]`, `car buying concierge [metro]`, `car buying advisor [metro]` | Metro service page |
| Specific help | `help negotiating car price [metro]`, `car purchase negotiation service [metro]`, `new car buying help [metro]` | Metro page section or distinct service page only if the intent and offer differ |
| Evaluate trust and price | `car buying service cost [metro]`, `is a car buying service worth it [metro]` | Pricing/process pages, linked from metro page |
| Local purchase decisions | `[state] title/registration`, `buy used car [metro] inspection`, `out the door price [metro]` | Reviewed guide or resource, not a near-duplicate service page |

Sample the results from the metro itself on mobile and desktop; log ads, local pack, organic pages, AI answers, autocomplete, and the actual competitor type. Distinguish independent buyer-side services from dealers, lead marketplaces, and brokers. Use terms such as **broker** only when the offer and jurisdictional review support them. One metro page should cover close variants; do not make separate URLs for synonyms or every suburb.

## 5. The metro dossier: evidence before a page

Each market needs a maintained record with:

1. **Service facts:** eligible ZIPs or wider region, tiers available, remote/in-person boundary, who contacts sellers, who signs and pays, pickup and transport limits, response-time commitment.
2. **Local buyer decisions:** two or more specific issues that actually change a purchase decision there, supported by a primary source or Drive Right's documented experience. Examples to investigate include local inventory mix, inspection logistics, taxes/registration, weather-related vehicle checks, and cross-state pickup. The owner and qualified reviewer approve consequential claims.
3. **First-party proof:** a permissioned, anonymized example with vehicle, criteria, date range, what Drive Right did, and outcome/limitations if supported. If none exists, use a transparent worked example with no implied real customer or savings claim.
4. **Search record:** primary query, adjacent questions, competitors, SERP date/location, current Drive Right visibility, and what distinct answer the page will provide.
5. **Governance:** sources, effective/as-of dates, content owner, legal/financial reviewer where needed, next review date, and claim IDs in the existing registry.

A location page is ready for drafting only when a buyer in that metro could use its local material independently of the sales pitch. Use a city-swap review: if replacing the metro name leaves the page useful in the same way, the page needs more genuine local substance. There is no Google-required word count or unique-text percentage; measure the value of the facts and decisions it adds. As an internal warning at 30 or more location pages, audit the whole group for repeated sections and evidence quality before adding more.

## 6. Page blueprint

One page per distinct MSA and service intent, with a reusable layout but individually researched main content:

1. **Clear H1 and opening answer:** e.g. “Car-buying help in Houston.” State Drive Right's actual base, availability, how it helps, and the boundaries of service.
2. **Who this is for and what happens:** vehicle types, search radius, buyer decisions, seller outreach, written quote comparison, pickup/delivery responsibilities, and any unavailable services.
3. **Local decision module A:** sourced market fact or first-party pattern plus the practical decision it changes. Show the source and as-of date.
4. **Local decision module B:** different local issue, such as inspection or transaction logistics, with precise caveats and review.
5. **Real example or transparent worksheet:** never fabricated testimonials, deal volumes, discounts, or dealer relationships.
6. **Pricing and scope:** link to the approved central plan page; keep fees and exclusions consistent with checkout and policy.
7. **Direct questions:** answer the market's actual search questions in visible text. Add a useful comparison table or checklist where it helps; do not add FAQ markup solely to chase a search feature.
8. **Action:** a call or buying-brief CTA that lets the visitor enter their ZIP and confirms actual availability before payment. Show contact details and who is responsible for the purchase.

For AI search, give direct, sourced answers near the relevant question, name Drive Right clearly, and expose the content in the initial HTML. Include an author/reviewer identity where the subject warrants it and update dates only when facts change. Google says AI search uses its core search systems and recommends original, non-commodity content; it does **not** require `llms.txt`, arbitrary passage lengths, AI-only schema, or manufactured mentions. Prioritize accurate first-party evidence and ordinary search eligibility.

## 7. Site architecture and local-presence rules

- Add a human-useful **service-areas hub** that groups approved metros and describes the service boundary. Link to it from navigation or a relevant homepage section, and link each metro page back to the hub, its plan, process, and genuinely related guides. Keep a clear browseable hierarchy rather than a footer filled with 20 keyword links.
- Preserve one canonical URL per MSA. The existing root `.html` pattern can be retained for the pilot; decide the Dallas–Fort Worth consolidation and redirect mapping only after reviewing existing links and GSC data. Dallas, Fort Worth and Arlington must not become three near-identical routes for the same offer.
- On release: unique title/description and H1, self canonical, static crawlable HTML, approved visible service facts, internal links, sitemap entry, and removal of `noindex`. Confirm the deployed response and Google URL Inspection. A self canonical on a `noindex` page does not make it eligible for search.
- Keep the existing **Organization** identity on the site; describe a metro as a **Service area** where appropriate. `BreadcrumbList` may reflect real navigation. Do not create a `LocalBusiness` branch, address, map pin, review profile, or `sameAs` for an office that does not exist. Structured data must match visible, approved facts.
- An Austin service-area Google Business Profile should represent the real Austin operation. Google's guidance permits one profile for the service area and says its overall service boundary generally should be within about two hours' drive. Its allowance of up to 20 named areas is not permission to represent 20 distant metros as local branches. National organic pages and Google Maps visibility are different goals.

## 8. Rollout and measurement

**Phase 0 — baseline and feasibility.** Confirm national/state service facts, jurisdictional review owners, current offer/checkout parity, GSC and GA4 access, and the 28-day baseline already specified in `docs/release-readiness.md`. Capture branded/non-brand metro queries, index coverage, organic landing pages, qualified leads, and verified purchases. Record AI-feature impressions by page in Search Console's Generative AI report and a repeatable manual prompt panel for other AI search systems. The Google report was rolled out to all sites by August 31, 2026, but reports visibility rather than guaranteed citations or sales.

**Phase 1 — two-page Texas pilot.** Complete the Dallas–Fort Worth and Houston dossiers, decide DFW URL consolidation, approve exact claims, publish only the approved pages, and check rendering, indexing, mobile experience, and the full contact/payment path. Noindex stays in place until their gates pass.

**Phase 2 — measured expansion.** After the pilot has enough search and lead data, add the next 2–4 eligible metros in an operationally manageable batch. Do fresh SERP and content research for each. Reuse components and governance, not locality claims or filler.

**Phase 3 — remaining candidate pool.** Publish a market only when it passes the same service and evidence gates. If a candidate is not serviceable, hold it and evaluate the next-ranked eligible market rather than publish a page that overstates reach.

Review at roughly 30, 60, and 90 days per released cohort. Leading indicators: successful indexing, non-brand impressions for the target query family, AI-feature impressions, local referral mentions, and engaged visits. Business outcomes: qualified inquiry rate, paid conversion rate, contribution margin by metro, and customer objections. Diagnose pages with no impressions, wrong-query traffic, or low-quality leads before expanding the template. Gate 5 already calls for merge/redirect decisions at day 90 for unsuccessful metro pages. Set numerical targets after the baseline; there is no defensible traffic or ranking forecast yet.

## 9. Inputs needed to turn this into a publication plan

- Owner-confirmed coverage map and tier-by-state operating model.
- Qualified state-by-state review for broker/dealer, advertising, fee, financing, title, tax, and delivery language that the planned pages would mention.
- GSC, GA4, Search Console Generative AI report, and verified inquiry/purchase baselines.
- Keyword and SERP dataset for the 20 MSAs, plus accessible automotive registration data if available.
- Permissioned case material or real internal deal records, with calculations and claims review.
- A named editorial owner and reviewers with enough capacity to keep local facts current.

## Sources and rationale

- [U.S. Census Bureau, Vintage 2025 metro population tables](https://www.census.gov/data/tables/time-series/demo/popest/2020s-total-metro-and-micro-statistical-areas.html) — candidate population pool; not purchase volume.
- [S&P Global Mobility, first-half 2025 new-vehicle registration DMA ranking](https://www.mobilityglobal.com/en-us/automotive-insights/blog/national-auto-trends-in-top-markets) — directional automotive demand comparison; DMA differs from MSA.
- [Google Search spam policies](https://developers.google.com/search/docs/essentials/spam-policies) — doorway and scaled-content abuse.
- [Google's generative AI optimization guide](https://developers.google.com/search/docs/fundamentals/ai-optimization-guide) — original content, ordinary SEO, crawlability, and rejected AI-specific hacks.
- [Google AI features and your website](https://developers.google.com/search/docs/appearance/ai-features) — indexing and snippet eligibility for Google AI features.
- [Google Business Profile service-area guidance](https://support.google.com/business/answer/9157481) — one profile for a service-area business, up to 20 named areas, and general two-hour boundary guidance.
- [Google's Search Console Generative AI performance announcement](https://developers.google.com/search/blog/2026/06/gen-ai-performance-reports) — AI-feature impression reporting and rollout.
- [California DMV autobroker definition](https://qr.dmv.ca.gov/portal/handbook/vehicle-industry-registration-procedures-manual-2/general-information-licensees/autobroker/) — example of why state-specific offer review precedes national claims.
