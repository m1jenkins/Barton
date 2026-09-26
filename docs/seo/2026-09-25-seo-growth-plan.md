# Drive Right SEO and AI search growth plan

Prepared September 25, 2026 (America/Chicago); public fetches September 26, 2026 UTC. Barton repository revision `a1c3597`. Scope: audit and plan only; no publication, account changes, outreach or indexing changes.

## Recommendation

Get the service explainer discovered by Google, repair the broken legacy-domain entry point, resolve the Texas hub’s indexing/value gap, then release a small set of useful, reviewed resources and proof. Build on the nationwide commercial pages already live. The biggest content opportunity is finishing the three existing guide drafts and quote worksheet, not creating more near-identical city pages.

## What the audit established

| Check | Current evidence | Meaning |
|---|---|---|
| Public search pages | 8 sitemap URLs; all 200, index/follow, self-canonical, one H1, distinct titles/descriptions, parseable JSON-LD | Good technical starting point; GSC lists six indexed and directly confirms two are not indexed |
| Root HTML inventory | 65 files locally: 8 index/follow, 57 noindex/follow. Live: 8 direct index/follow, 50 direct noindex/follow, 7 redirects | The local noindex count includes redirect-source files; this is not 57 errors |
| Search access probes | 9 search/retrieval user-agent strings × home, explainer and pricing = 27 responses with HTTP 200 | No user-agent-only denial observed; real bot-IP/CDN access still needs logs |
| Raw HTML | Main service copy, current prices, links and structured data are present before JavaScript | No rendering migration is indicated |
| Existing SEO foundations | Organization/Service/WebSite/Breadcrumb data, contact details, internal navigation, current $295/$895 offer | Preserve; do not propose them as missing |
| Legacy migration | Old www host → current host works; old bare host has no A/AAAA answer | Repair DNS/hosting before its redirect can run |
| Current host redirects | HTTPS apex → www is already 301; HTTP apex still takes two permanent hops | Retire the old “temporary 307” finding; simplify HTTP chain as maintenance |
| Draft containment | Tested nonexistent path, /service-areas.html and private city draft path return 404; nine legacy cities remain noindex | Do not undo deliberate release controls |
| Search results freshness | Search tool returned an older homepage with retired $195/$495 offers; fresh raw HTML and browser show $295/$895 | Cached retrieval does not describe the current deployment |
| Tests | Node 24 site validator passes: 65 files, 8 sitemap URLs. Config-only redirect check passes: 15 rules | Local rules passing does not prove live DNS or search index coverage |

Technical eligibility is not ranking or indexing. This audit made 105 public requests (70 URL checks and 35 crawler/host probes), reviewed the repository and primary platform guidance, and inspected the live homepage. The user signed into GSC during the audit. Authenticated performance, indexing, sitemap, AI-control and AI-performance evidence is now included below. Bing, verified bot-IP logs and organic revenue remain unverified. GSC currently has no field Core Web Vitals data. No fresh lab performance score is claimed.

Evidence tags: **REQUIRED** = documented eligibility/policy requirement; **RECOMMENDED** = platform guidance; **OBSERVED** = a measured observation, not a ranking factor; **HYPOTHESIS** = a plausible benefit to test. Site findings are direct observations unless described as historical or unverified. Priority P0 means resolve the technical problem or uncertainty first; it does not mean the entire site is blocked.

## Authenticated Search Console findings

Read September 25 after the user supplied sign-in; property `https://www.driverightcarbuying.com/`. No settings, sitemap submissions or indexing requests were changed.

| Observation | Finding | Action |
|---|---|---|
| Web (text), August 27–September 23 | 21 clicks; 1.69K displayed impressions (rounded); 1.2% CTR; average position 26.2 | Use as the current dated baseline; collect the preceding non-overlapping period |
| Intended URLs listed indexed | Home, About, How It Works, Pricing, Resources and Policy | Six of eight intended pages; individually verify selected canonical/freshness when implementing |
| `/car-buying-service.html` | URL is unknown to Google; no referring sitemap detected; no last crawl | Current sitemap resubmission and a targeted indexing request are the first search actions |
| `/texas-local-market-intelligence.html` | Discovered, currently not indexed; sitemap known; no last crawl | Strengthen approved local usefulness and follow up on crawl/indexing; preserve city gates |
| Google's live tests | Both missing pages are available to Google and can be indexed | No current fetch/noindex blocker found on these two URLs |
| Sitemap | Success; last read September 19; 7 discovered pages, versus 8 in the live file | Get Google to re-read the current sitemap; do not create a second sitemap |
| Whole-property index report | 12 indexed / 45 not indexed; report updated September 20 | Counts include old URLs and lag current HTML; not a target to get all pages indexed |
| Exclusion reasons | 29 noindex, 3 redirect, 12 crawled/not indexed, 1 discovered/not indexed | Respect intentional exclusions; inspect relevant URLs individually |
| AI eligibility | Inherits `Include` from driverightcarbuying.com | Already enabled; no change needed |
| Google AI report, June 24–September 23 | 748 impressions; homepage 360 | Existing visibility, not a citation-rate or 28-day metric; historical contained pages appear |
| Core Web Vitals overview | No mobile or desktop data | Unknown field performance, not a fail |

Selected reported 28-day queries: `car buying service` 152 impressions / 0 clicks; `car buying services` 49 / 0; `car broker service` 46 / 0. This supports the existing national service content; it does not prove search volume, keyword difficulty or that low CTR is a snippet problem. [Sanitized account evidence](2026-09-25-search-console-evidence.json).

## Execution order and effort

Effort estimates are planning judgments, not quotations; reviewer and platform waiting time is additional. Owner roles below are proposed responsibilities, not existing assignments.

| When | Work | Exit condition |
|---|---|---|
| Days 1–3 | A02 service-page discovery/recrawl; A01 legacy DNS; A12 qualified-outcome baseline | Broken hostname fixed or assigned to domain owner; every intended URL has a known state and action; baseline dates recorded |
| Days 4–7 | A03 process consistency; A04 brand schema; A05 dates; A09 disclosure packet; A10 profile status | Small truthful commercial corrections ready; real disclosure/profile facts known |
| Weeks 2–3 | A07 first approved guide, then remaining guides; A08 reviewed worksheet; A06 production diagnostics | Each released asset passes its own eligibility/review checks and has useful links |
| Weeks 3–4 | A09 first verified case study; A10 profile/citation completion; A13 small AI baseline | Proof is publishable, entity facts agree, visibility measurement is repeatable |
| Days 30–90 | Review outcomes; A11 evidence-ready Austin pilot; selectively improve successful pages | Expansion follows qualified demand, distinctive local evidence and completed gates |

Start measurement immediately. Prepare content while account checks run, but gate each public release on its own access, indexing and approval findings. Do not make a low-volume legacy-domain fix a blanket blocker for unrelated work on reachable canonical pages.

## Detailed backlog

The two top priorities are ordered by current commercial visibility, followed by legacy-link recovery.

### A02 · P0 · Tier 1 · Index — Get the service explainer discovered and resolve the Texas hub

**Owner:** SEO owner with GSC/Bing access. **Effort:** 0.5–1 day. **Dependency:** GSC access is now available; Bing access and production logs still needed.

**Finding:** Google lists six of the eight intended search URLs as indexed. Direct inspection says car-buying-service.html is unknown to Google and texas-local-market-intelligence.html is discovered, currently not indexed. Both pass Google’s live availability test.

**Evidence:** Authenticated September 25: sitemap Success, last read September 19, seven discovered URLs versus eight in the current file. Indexed report dated September 20 lists 12 URLs, six of them current intended pages. The two direct inspections show no last crawl. Google AI control inherits Include. REQUIRED: indexed, snippet-eligible content for Google AI supporting links.

**Impact:** The service explainer cannot currently win Google traffic despite good raw HTML and existing internal links. The Texas hub also cannot appear, but needs a stronger reader benefit as well as crawl follow-up.

**Change:** Resubmit the current eight-URL sitemap and request indexing of the live-test-passing service explainer during implementation; retain its existing global navigation links. Inspect the six listed core pages for Google-selected canonical and freshness. For the Texas hub, strengthen useful approved local information under A11 before a targeted recrawl; do not release nine contained city pages just to fill it. Check Bing and verified bot-IP logs. Monitor older noindex/redirect URLs as Google recrawls; do not request them for indexing.

**Verify:** Save a dated URL-level matrix and sitemap fetch status. Confirm the explainer moves from unknown to discovered/crawled/indexed; request submission itself is not success. Verify selected canonicals. Record the Texas hub’s subsequent crawl/index decision. Google AI Include is already confirmed; no setting change is needed.

**Risk:** No bulk noindex removal. The aggregate report lags current HTML; its old indexed archive URLs are not authorization to release them. Live tests confirm Google can fetch these two pages now, not that either is indexed. This planning audit did not submit a sitemap or request indexing.

**Platform sources:** [ai](https://developers.google.com/search/docs/appearance/ai-features), [control](https://support.google.com/webmasters/answer/16908024), [sitemap](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap), [bots](https://developers.openai.com/api/docs/bots).

### A01 · P0 · Tier 0 · Access — Restore the legacy domain’s bare hostname

**Owner:** Domain administrator. **Effort:** 0.5 day. **Dependency:** Confirm the existing domain/DNS account.

**Finding:** The old www hostname redirects, but austincarbuyingservice.com cannot be resolved. This is a real broken migration entry point, not the previously fixed temporary redirect on the current domain.

**Evidence:** Live curl requests to the legacy apex root and /about.html failed DNS resolution. Google Public DNS returned no A or AAAA answer. The legacy www versions returned 308 directly to the matching current URL. REQUIRED: permanent moves need working redirects; see Google’s redirect guidance.

**Impact:** Recover visitors and any historical link signals that still use the bare old domain. The amount of affected traffic/backlink value is unmeasured.

**Change:** Restore the correct apex DNS/hosting attachment and valid HTTPS certificate, then redirect root and paths permanently to the matching www.driverightcarbuying.com URL. Keep the working legacy www route. In the same maintenance window, shorten current HTTP apex → HTTPS apex → HTTPS www where the edge configuration safely permits.

**Verify:** Test HTTP and HTTPS, bare and www, root and /about.html. Require resolvable DNS, valid TLS, 301/308, preserved paths, and final 200/self-canonical. Run the live redirect script with both legacy base hostnames; record any remaining two-hop chains.

**Risk:** Incorrect DNS changes can interrupt the legacy hostname or mail. Preserve unrelated records. This fix is not a claim that the canonical site is inaccessible.

**Platform sources:** [redirect](https://developers.google.com/search/docs/crawling-indexing/301-redirects).

### A03 · P1 · Tier 2 · Foundations — Align the process page with the current purchase path

**Owner:** Site editor + operations owner. **Effort:** 0.5–1 day. **Dependency:** A02 for search promotion; confirm the intended checkout sequence.

**Finding:** The process page says buyers introduce themselves before paying. Pricing says details are collected after payment, and the current page controller starts direct checkout. Search visitors can receive conflicting expectations.

**Evidence:** Live how-it-works.html steps 04–05 versus schedule.html; buying/app.js calls checkoutFlow.startDirect(tier). Current live prices already agree at $295/$895. RECOMMENDED: clear, reliable people-first information; the conversion effect is a HYPOTHESIS.

**Impact:** Make the commercial landing pages easier to trust and reduce uncertainty before payment.

**Change:** Correct the workflow explanation to the actual approved sequence. Keep / as the broad service entry, car-buying-service.html as the explainer, how-it-works.html as the workflow and schedule.html as pricing. Add a concrete approved deliverable example or annotated sample to the explainer; describe what changes between plans and what the buyer still does. Preserve current URLs, truthful fees and buyer control.

**Verify:** Walk the unpaid start path in a suitable test environment; compare visible text, links, metadata and schema across the four pages. Do not charge a real card for SEO QA. Evaluate qualified inquiry/checkout behavior after release, not raw clicks alone.

**Risk:** Do not rebuild checkout under this task, promise a response time, or invent deliverables. Keep exact-copy approval requirements for any new commercial commitments.

**Platform sources:** [content](https://developers.google.com/search/docs/fundamentals/creating-helpful-content).

### A04 · P2 · Tier 2 · Foundations — Use the brand as the structured site name

**Owner:** Site editor. **Effort:** 0.25 day. **Dependency:** A02.

**Finding:** Homepage WebSite.name contains the full keyword-and-price title instead of a concise brand name.

**Evidence:** Live JSON-LD: WebSite.name = “Nationwide Car Buying Service: $295 & $895 | Drive Right”. Organization.name already says Drive Right. RECOMMENDED: Google site-name guidance favors the site’s actual concise name.

**Impact:** Make the preferred search-result site name consistent with the visible brand. This does not guarantee Google will use it or improve rankings.

**Change:** Set WebSite.name to Drive Right and retain the truthful alternateName Drive Right Car Buying Service. Keep the page title as a separate search snippet title. Preserve the canonical homepage URL and existing Organization identifier.

**Verify:** Check raw JSON-LD, Schema Markup Validator and URL Inspection after release. Google’s Rich Results Test does not validate the site-name feature.

**Risk:** Avoid generic service keywords or prices in the site-name field; do not create a second competing Organization.

**Platform sources:** [sitename](https://developers.google.com/search/docs/appearance/site-names).

### A05 · P2 · Tier 2 · Foundations — Make freshness dates follow meaningful content changes

**Owner:** Site editor. **Effort:** 0.5 day. **Dependency:** Review the actual content change history.

**Finding:** The resource hub says its inventory was updated September 5; the Texas hub says draft/source links were checked August 12. Sitemap entries largely remain September 22 while later page edits exist.

**Evidence:** Live blog.html, texas-local-market-intelligence.html and sitemap.xml; homepage history contains September 23 and 25 changes. Not every edit warrants a new lastmod. RECOMMENDED: Google uses consistently accurate lastmod values tied to significant updates.

**Impact:** Give readers and crawlers honest freshness signals, particularly when reviewed guides become available.

**Change:** Review page-level significant changes and update sitemap lastmod in the same release. Separate published, substantively updated and source-checked dates on editorial pages. Remove obsolete “draft updated” labels from any genuinely approved public resource; keep an accurate review status until then.

**Verify:** Compare each changed page against its release record, visible dates and sitemap. No daily date bump, blanket timestamp rewrite or fabricated source-check date.

**Risk:** False freshness erodes credibility; small caption or formatting changes do not automatically justify a new editorial date.

**Platform sources:** [sitemap](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap).

### A06 · P2 · Tier 2 · Foundations — Measure the current mobile site before more performance work

**Owner:** Developer. **Effort:** 0.5–1 day diagnosis; fixes depend on results. **Dependency:** Current production measurements.

**Finding:** Current production Core Web Vitals are unknown. The existing good mobile lab results belong to a September 19 local build; the homepage has changed since then.

**Evidence:** Current authenticated GSC overview shows no mobile or desktop Core Web Vitals data. docs/seo-execution/performance-evidence.md reports local LCP near 2.0s and low CLS for September 19 only. This audit obtained no new production trace. RECOMMENDED: field p75 LCP ≤2.5s, INP ≤200ms, CLS ≤0.1.

**Impact:** Catch regressions without spending time redoing an already measured loading-order fix.

**Change:** Measure current home, pricing, About and the first released guide on mobile. Exercise brief editing, plan selection and consent controls. Inspect hero/founder image loading, fonts and third-party scripts only where a trace shows a bottleneck. Retain responsive picture sources and explicit image dimensions already present.

**Verify:** Record live build, device/network settings, repeated lab samples and field data separately. Use CrUX/GSC if available; absence of field data is “unknown,” not a pass. Preserve homepage asset hashes and run the repository validator after asset edits.

**Risk:** A Lighthouse score or localhost trace cannot prove real-user INP or ranking improvement. Avoid an unrelated redesign.

**Platform sources:** [vitals](https://web.dev/articles/vitals).

### A07 · P1 · Tier 3 · Content — Release the three prepared guides one page at a time

**Owner:** Mason + editorial owner + qualified reviewers. **Effort:** 4–7 working days total, excluding reviewer wait. **Dependency:** A02 on each URL; exact-copy/source approvals.

**Finding:** The site has only eight intended indexable pages and no released independent editorial article in this crawl. Three substantially revised guides already exist privately, while the public versions remain noindex.

**Evidence:** Live Resources links to eight in-review pages; private guides and review packets are documented in SEO-05. Fifty root URLs return 200/noindex, including utility pages and the editorial/local archive. RECOMMENDED: original useful content; REQUIRED: avoid scaled low-value publication. Local project policy requires exact-copy approval.

**Impact:** Expand useful coverage around car quote comparison, add-ons and inspection with assets already partly prepared. These are commercially relevant opportunities, not measured search-volume forecasts.

**Change:** Start with the below-MSRP quote-comparison guide if its reviewer is ready, then add-ons and used-car inspection; readiness can reorder the batch. Refresh primary sources, add an accepted named author linked to About, name the qualified reviewer where appropriate, show a useful worksheet/example and honest dates. Move only each approved revision into its existing public URL; then switch that page to index/follow, add it to the sitemap and approved Resources cards, and link to the service/pricing pages contextually.

**Verify:** For every page: exact approved text/source/expiry record, 200, self-canonical, no unintended noindex/nosnippet, accurate Article/Breadcrumb data, raw-HTML value, mobile QA, internal links and URL Inspection. Record release date and compare qualified outcomes over subsequent complete windows.

**Risk:** No bulk archive release. Mechanical/safety, finance/warranty and consumer-law review differ. Keep the four specifically protected legal articles and the Tesla FSD park unchanged unless their separate gates are met.

**Platform sources:** [content](https://developers.google.com/search/docs/fundamentals/creating-helpful-content), [spam](https://developers.google.com/search/docs/essentials/spam-policies).

### A08 · P1 · Tier 3 · Content — Turn the existing quote worksheet into a useful public resource

**Owner:** Editorial owner + developer + consumer-finance reviewer. **Effort:** 2–3 days after approval. **Dependency:** A07 quote guide; worksheet review packet accepted.

**Finding:** The quote comparison worksheet is already implemented and tested as a deployment-excluded private draft. It has no public URL yet.

**Evidence:** draft-artifacts/quote-comparison/ and docs/seo-execution/SEO-06.md document the working draft, hypothetical examples, privacy constraints and review requirements. RECOMMENDED: useful first-hand material. Its ability to earn links/citations is a HYPOTHESIS.

**Impact:** Provide a concrete reason to visit, refer to and share Drive Right beyond generic buying advice.

**Change:** Complete the existing review packet and publish the proposed /quote-comparison.html only when eligible. Keep the method, definitions, limitations and at least one clearly hypothetical worked example in initial HTML; interactive arithmetic can enhance it. Link it from the quote guide, Resources and relevant service page. Preserve local-only input handling and user-entered tax assumptions.

**Verify:** Run the existing calculation/privacy tests plus responsive, keyboard and print/CSV checks. Test unknown values and discounts already included in a quote. Validate search eligibility and make one clear path back to service pricing.

**Risk:** Do not imply the tool supplies a legal/tax answer, guarantees savings or represents a real customer result. Avoid duplicating the guide’s search intent: guide explains the comparison; tool performs it.

**Platform sources:** [content](https://developers.google.com/search/docs/fundamentals/creating-helpful-content).

### A09 · P1 · Tier 3 · Content — Resolve compensation disclosure and add permissioned proof

**Owner:** Mason + claims/editorial reviewers. **Effort:** 1–3 days of preparation; evidence dependent. **Dependency:** Actual relationship records and customer permission.

**Finding:** Founder biography and real vehicle photos already exist. The larger remaining trust gap is an unresolved compensation disclosure and the lack of a verified, useful customer-process case study.

**Evidence:** Live how-it-works.html explicitly says dealer referral/commission statements await owner attestation; CLM-013 remains pending_evidence. SEO-06 has proof packets, not approved case-study outcomes. RECOMMENDED: identifiable expertise and verifiable first-hand evidence.

**Impact:** Help buyers assess incentives and understand the work they receive; give writers and AI systems specific facts they can responsibly reference.

**Change:** Use actual revenue-source/relationship records to replace the pending disclosure with the approved factual statement. Produce one anonymized, permissioned case study showing initial requirements, written comparison, decisions, scope and limitations. Reuse existing proof packets; distinguish hypothetical examples from customer stories. Link author information to the existing About page rather than duplicating it.

**Verify:** Reviewer can reproduce every monetary/outcome claim and confirm permissions. Visible text, metadata/schema and approved_copy agree. Publish relevant methodology and limitations; do not expose customer identifiers or private deal records.

**Risk:** Never assume “zero commissions,” invent savings or turn personal car ownership into credentials. A real case study is valuable even without a savings headline.

**Platform sources:** [content](https://developers.google.com/search/docs/fundamentals/creating-helpful-content), [organization](https://developers.google.com/search/docs/appearance/structured-data/organization).

### A10 · P1 · Tier 4–5 · Local & authority — Finish one accurate business identity across local platforms

**Owner:** Mason / profile owner. **Effort:** 1–2 days plus platform verification. **Dependency:** Public profile verification and platform eligibility.

**Finding:** The latest project record says the Google Auto broker service-area profile is awaiting verification; no public Maps URL is recorded. Organization markup is already present and sameAs is intentionally empty.

**Evidence:** data/entities.json and docs/local-seo-package.md, dated September 22. Current private profile status was not accessible in this audit. REQUIRED: truthful business representation; RECOMMENDED: current entity information.

**Impact:** Strengthen brand disambiguation and local discovery for the real Austin-based business.

**Change:** First check whether verification has completed; reuse the existing profile. When its public URL exists, add that exact URL to Organization.sameAs and a visible contact/review path. Align name, phone, hours, URL and current $295/$895 services. Reuse or claim Bing/Apple profiles only where the actual service model meets current platform rules. Ask genuine completed customers for honest reviews through an approved workflow. Use the existing relevant outreach prospect list after a useful resource/case study is public.

**Verify:** Check the public profile and website side by side. Keep the verification address hidden, one real operation, and no fictional city offices. Tag profile website links; measure qualified contacts and review activity. Any outreach is a later explicitly authorized action.

**Risk:** Do not create another GBP, publish a private address, add LocalBusiness markup against the project’s current restriction, buy links or gate/incentivize reviews. Remote nationwide service does not establish a physical local presence.

**Platform sources:** [business](https://support.google.com/business/answer/3038177), [organization](https://developers.google.com/search/docs/appearance/structured-data/organization), [spam](https://developers.google.com/search/docs/essentials/spam-policies).

### A11 · P2 · Tier 4–5 · Local & authority — Build one genuinely useful Austin page before expanding cities

**Owner:** Mason + local editorial owner. **Effort:** 2–4 days per evidence-ready pilot. **Dependency:** A02; metro release gates and distinct local evidence.

**Finding:** All nine legacy Texas city pages are noindex. Twenty private city drafts largely reuse the homepage with city substitutions; they are not twenty SEO launch opportunities.

**Evidence:** Live city responses and data/metro-release.json; README documents the shared template and one local sentence. The Texas hub currently routes to nine contained city pages. REQUIRED: avoid doorway/scaled pages; project gates remain authoritative.

**Impact:** Test local search demand and conversion on a page supported by the actual Austin operation.

**Change:** Prioritize Austin when baseline demand and logistics evidence support it. Explain real service boundaries, seller/inspection/delivery coordination and a verified local example without asserting an office. Update the Texas hub only with approved useful destinations. Evaluate Houston or a combined DFW page afterward; decide Dallas/Fort Worth/Arlington consolidation only after query/backlink review. Do not launch the 20-city collection unchanged.

**Verify:** Complete the market dossier, owner/page sign-off, distinct-intent evidence, qualified/editorial review, QA and release hash. Re-pin any edited contained legacy Texas page. Verify internal links, sitemap and Google/Bing indexing after authorized release.

**Risk:** Availability confirmation is not page approval or unique local evidence. No automatic city redirects, duplicate storefronts or national-scale doorway expansion.

**Platform sources:** [spam](https://developers.google.com/search/docs/essentials/spam-policies), [business](https://support.google.com/business/answer/3038177).

### A12 · P1 · Tier 6 · Measure — start now — Use the refreshed search baseline and connect qualified outcomes

**Owner:** Analytics owner + developer. **Effort:** 1–2 days setup; 30–45 minutes weekly. **Dependency:** Correct GSC/Bing/GA4 identities and aggregate outcome access.

**Finding:** Search performance is now freshly observed in GSC, but organic-qualified-lead and revenue reporting remain unverified. Existing tracking code/test evidence does not establish account delivery.

**Evidence:** Authenticated GSC, Web (text), all countries/devices: August 27–September 23 shows 21 clicks, 1.69K displayed impressions, 1.2% CTR and position 26.2. The 1.69K value is rounded, not an exact export. Reported queries include car buying service: 152 impressions/0 clicks; car buying services: 49/0; car broker service: 46/0. These are property metrics, not search volumes.

**Impact:** Prioritize pages by qualified customer demand and judge releases without mistaking clicks, sample answers or form attempts for purchases.

**Change:** Use this dated baseline and capture the preceding non-overlapping 28 days with matching filters/timezone. Identify the actual Drive Right GA4 property/stream and confirm current tag delivery. Reuse cta_click, phone_click, durable generate_lead, begin_checkout and server-verified purchase; reconcile with approved aggregate records. Retain organic and AI referral attribution. Remove duplicate/stale conversion definitions only after checking the current container. Do not request GSC access again while this signed-in session is available.

**Verify:** Record impressions, clicks, CTR and average position by intended page/intent; separate exact brand, ambiguous auto-sales names and nonbrand without assigning suppressed queries. Record qualified inquiries, paid orders and service revenue with dedupe definitions. Report missing metrics as unavailable. Compare comparable complete windows and log release dates.

**Risk:** The older traffic decline is not evidence that the new prices or recent changes caused it. Avoid a second overlapping tag, PII in analytics, premature purchase events or treating phone clicks as qualified leads.

**Platform sources:** [ai](https://developers.google.com/search/docs/appearance/ai-features).

### A13 · P2 · Tier 6 · Measure — start now — Update the AI prompt panel and measure repeatable visibility

**Owner:** SEO/editorial owner. **Effort:** 0.5 day setup; small monthly sample. **Dependency:** A12; pages eligible under A02.

**Finding:** The existing prompt panel still emphasizes Texas and the retired standalone AI Agent offer. It has seed rows rather than a current measured baseline.

**Evidence:** Authenticated Google Search generative-AI report shows 748 impressions for June 24–September 23, including 360 on the homepage; this is not a cross-engine citation rate. data/ai-prompt-panel.csv still has not_run seeds, including retired DR-AGENT-* questions. No new multi-engine prompt baseline was run. Expected incremental citation gains remain a HYPOTHESIS.

**Impact:** Measure whether the right service facts and URLs appear, rather than optimizing for obsolete offers or one fluctuating answer.

**Change:** Version a small panel of real buying questions: nationwide service, negotiation help, two-plan fees, Austin support, quote comparison, add-ons and inspection. Keep retired-service prompts only as accuracy/retirement checks. Run two baseline waves with consistent location, engine/model/search settings and record whether web search occurred, cited URLs and brands. Repeat monthly; retain history. Add IndexNow notifications for eligible public changes only after Bing setup. Track the authenticated Google AI impression report alongside the prompt panel; keep its period distinct from the 28-day Web baseline.

**Verify:** Use rolling results, citation correctness and referred qualified inquiries. Keep missing engine observations blank and never call a single answer market share. Confirm IndexNow’s response separately from actual indexing; no indexing guarantee.

**Risk:** No special AI schema, new llms.txt project, MCP server or content chunking campaign. Existing llms.txt can receive a low-cost factual cleanup alongside service edits, but is not a Google SEO priority. No recurring automation is created by this planning task.

**Platform sources:** [ai](https://developers.google.com/search/docs/appearance/ai-features), [bots](https://developers.openai.com/api/docs/bots), [indexnow](https://www.indexnow.org/documentation).

## URL ownership and the first content batch

| URL / asset | Intended role | Next step |
|---|---|---|
| `/` | Nationwide car buying service entry | Keep current fees, founder proof and crawlable route to service scope |
| `/car-buying-service.html` | What the service covers and buyer responsibilities | Add a reviewed concrete deliverable example; retain accurate dealer disambiguation here |
| `/how-it-works.html` | Process, responsibilities and compensation disclosure | Correct the sequence and finish the factual disclosure |
| `/schedule.html` | Two-plan pricing and purchase entry | Keep fee/scope/terms parity; measure true checkout/purchase events |
| `/about.html` | Existing Mason biography, experience and contact/entity evidence | Reuse as author identity; add only accepted verifiable facts |
| `/blog.html` | Resources discovery | Replace review-only emphasis with approved resources as they become available |
| `/blog-buy-new-car-below-msrp.html` | Compare complete written quotes | Reuse `draft-artifacts/guides/` and `SEO-05-msrp-review.md`; consumer-finance/advertising review |
| `/blog-dealership-addons-complete-guide.html` | Compare optional product costs and terms | Reuse `SEO-05-addons-review.md`; finance/insurance/warranty review |
| `/blog-used-car-inspection-checklist.html` | Buyer observations plus independent inspection questions | Reuse `SEO-05-inspection-review.md`; mechanical/safety/consumer-law review |
| Proposed `/quote-comparison.html` | Interactive worksheet with readable method/example | Reuse `draft-artifacts/quote-comparison/` and `SEO-06-review-packet.md`; currently private |
| `/texas-local-market-intelligence.html` and `/austin.html` | Real local service context | Complete Austin evidence gate, then promote approved local content |

Do not create separate landing pages for every variation of “car buyer,” “car negotiator,” “car concierge” and “buying service.” These roles are editorial assignments to validate with query-to-page data, not proof of keyword cannibalization or measured keyword volume.

## Measurement and acceptance

Use the freshly observed August 27–September 23 baseline: 21 clicks, 1.69K displayed impressions (rounded), 1.2% CTR and position 26.2. The separate June 24–September 23 Google AI report shows 748 impressions. Earlier August 20–September 16 totals (27 clicks/2,518 impressions) overlap the new window and are not a valid previous-period comparison. Collect the preceding non-overlapping window before calculating change. Query reporting omits anonymized terms; do not assign missing traffic to brand or nonbrand.

- **Weekly:** intended URL index state, query/page impressions and clicks, correct canonical, qualified inquiries, paid orders, service revenue, and released-page changes. Review at most three proposed improvements at a time.
- **Monthly:** Google Business Profile activity and factual consistency, AI citations/mentions from the fixed panel, AI referrals and referred qualified outcomes, and source/review expiries.
- **Success for the first month:** working legacy host, a documented index decision for all eight intended URLs, truthful and consistent commercial pages, one to three individually approved guides when reviewers are ready, a reviewed worksheet when eligible, and a reliable baseline. These are delivery targets, not traffic promises.
- **Success over 60–90 days:** more relevant nonbrand visibility and qualified business outcomes versus comparable complete periods; inspect page cohorts and query mix before crediting any single change. Set numeric traffic/revenue targets after current baseline and capacity are known.

No scheduled automation was created. No cross-engine AI citation rate, localized rank, keyword volume, field-performance pass or organic revenue figure is invented.

## Keep these boundaries

- Preserve the Tesla FSD page at its URL with `noindex, follow`, self-canonical, off sitemap. It has a named keep-noindex decision; it is not a redirect, deletion or indexing candidate.
- Preserve contained legal/finance/safety articles until their individual source and exact-copy approvals are complete. A noindex warning is not a substitute for review, nor publication permission.
- Keep the 20-city collection and metro drafts private. Follow `data/metro-release.json`; re-pin `legacyTexas[].sha256` when editing contained legacy pages.
- Preserve the Austin service-area model. Do not publish the hidden verification address, invent Maps identifiers, or manufacture LocalBusiness locations.
- No special AI optimization build is indicated. A service business does not need Merchant Center product feeds, agentic checkout or an MCP server for this plan. Existing FAQ markup is not a citation/ranking promise.
- Retain readable HTML and existing title/H1/canonical work. Do not replatform for rendering, rewrite every title, reinstall analytics or redo the existing performance fix without new evidence.

## Implementation handoff

This plan supersedes stale operational assumptions for these observed items: the current apex is permanent, the current live offer is $295/$895, founder photos/biography and the service explainer are already live. It does not supersede claim, legal, metro or release authority.

Reuse the existing work: `docs/seo-execution/SEO-02.md` and `query-map.csv` for historical demand; `SEO-05-*-review.md` for guides; `SEO-06-review-packet.md` and proof packets for the worksheet/case-study evidence; `SEO-07.md` for measurement contracts; `SEO-08-prospects.md` for future authorized outreach. `data/fasttrack-reindex.csv` is an older queue: select releases by current review readiness and demand rather than blindly following its legal-heavy ordering. Reconcile inventory/status notes with the observed deployment when work begins.

For implementation use Node 24 and the current `.github/workflows/checks.yml` checks. Content/config edits: site validation, relevant draft checks, and redirect config/live checks; changed behavior additionally gets appropriate tests from `package.json`. Asset edits must refresh the content-hashed homepage URLs. Final release verification must cover raw HTML, robots/canonical/sitemap, source approvals, internal links, mobile behavior and the actual conversion path.

Evidence files: [sanitized audit snapshot](2026-09-25-seo-audit-evidence.json). Raw public fetches are retained locally in `/private/tmp/barton-seo-audit-2026-09-25/`; this temporary folder is not the durable record. The interactive planning artifact remains local and outside this focused release. This plan is under `docs/`, which the existing `.vercelignore` excludes from deployment.
