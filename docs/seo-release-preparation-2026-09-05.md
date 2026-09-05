# SEO preparation — September 5, 2026

Repository edits only. No deployment, account changes, payment submission, customer contact, or reviewer approval occurred.

## Outcome and containment decision

| Page | Work prepared | Indexing decision |
| --- | --- | --- |
| `index.html` | Requested Texas Car Buying Service / From Search to Negotiation H1; Austin base, Texas scope, bounded service description; matching meta/social descriptions; existing title retained | Remains indexable; copy change ready for normal deployment validation |
| `blog-used-car-inspection-checklist.html` | Buyer observation checklist, inspector questions, original decision worksheet, hypothetical example, primary links | Keep noindex; author acceptance and mechanical/safety plus consumer-law review missing |
| `blog-dealership-addons-complete-guide.html` | Product-by-product questions, written terms, optional-product distinction, financed-cost example; unsupported markups and accusations removed | Keep noindex; author acceptance and qualified consumer-finance, insurance, warranty review missing |
| `blog-buy-new-car-below-msrp.html` | Comparable quote request, incentive conditions, arithmetic example, counteroffer script, contract reconciliation | Keep noindex; author acceptance and qualified consumer-finance/advertising review missing |
| `austin.html` | Austin base; observed plans and fees; bounded remote/pickup/delivery discussion; county, emissions, I-35 planning; practical questions; original contact form preserved | Keep noindex; logistics, attributable activity or non-brand demand, and owner/local/subject review missing |
| `blog.html` | Direct links to the three revised articles, explicitly labeled review-pending drafts | Remains indexable; no assertion that drafts are approved |

Initial and final inventory: **64 root HTML files; 55 noindexed; nine sitemap URLs**. All 35 legacy articles, all nine cities, and all five consequential draft hubs remain excluded. No newly indexable page is claimed. Sitemap and redirect configuration are unchanged. In particular, the permanent redirect from `blog-dealer-addons-exposed.html` still targets the complete add-ons guide.

Gate 5 in `docs/release-readiness.md` remains controlling. Source verification is not qualified review. The user explicitly requested direct discovery links for these three articles, so only these three receive clearly labeled draft links on `blog.html`, despite the older workflow's blanket no-card rule. This is not a search release and requires no validator relaxation. Austin's homepage and Texas-hub promotion remain deferred until its release gate passes; the hub's existing draft-status reference is preserved.

## Research and claim mapping

The `SEP-*` rows in `data/source-registry.csv` map the exact retained consequential statements to primary sources and named page sections. They record retrieval on September 5, 2026, authority, jurisdiction, source publication/effective-date limitations, supporting sections, and required reviewer roles. A role is not a reviewer identity. Approval and next-review dates remain unassigned.

Primary authorities used: FTC for dealer disclosures, inspections, warranties and quote comparison; CFPB for MSRP, optional products, GAP and financed add-ons; TxDMV for title-history lookups; NHTSA for recall-search limitations; Travis County Tax Office for local title-service routes; TCEQ for Austin-area emissions applicability; TxDOT for I-35 Central construction and closure information. Links appear beside supported claims in the pages. No live incentive amount, tax rate, discount benchmark, inspection price, or average customer outcome was introduced.

Original editorial material consists of questions, organizing worksheets, and explicitly hypothetical comparisons. Safety cautions and the observation/test-drive method still require mechanical/safety approval even where they are not claims of agency requirements. Source mapping does not certify this method.

Related material inspected: the overlapping dealer-addons article and its existing redirect; new-car incentive hub and high-demand MSRP article; used-car due-diligence hub and vehicle-history article. The rewritten articles have distinct intents: pre-purchase observation/inspection preparation, optional-product evaluation, and new-car quote/negotiation comparison. No dealer-ranking or broad market-timing article was released.

The original pages identify Mason and link to `about.html`, which identifies him as founder and lead advisor. The revised bylines truthfully credit the original article and disclose the AI-assisted revision and pending author acceptance. Unverified original publication dates and the schema assertion of current authorship were removed; `dateModified` matches the visible September 5 draft update. Add an accepted author and actual review details to both page and schema only after review. Historical unsupported prose removed from HTML comments remains available in Git history.

## Business and checkout verification

Austin base is supported by `docs/local-seo-package.md`, the existing About page, and the task's stated business facts. Texas and the other eight named service areas match `data/entities.json`. No street address, walk-in hours, branch, credential, or public office is added. Austin schema uses Organization, Service, City, WebPage, and BreadcrumbList.

Read-only public checkout inspection confirmed the configured links and base amounts:

| Local tier | Public checkout | Observed base fee |
| --- | --- | --- |
| AI Agent Buying Service | https://book.stripe.com/6oU3co4svaEb92QcNS04804 | USD 195 |
| Full Service | https://book.stripe.com/cNi14ge357rZena29e04800 | USD 495 |
| Ultimate Concierge | https://buy.stripe.com/8x2fZa6AD27Ffre7ty04803 | USD 895 |

All show address-dependent tax calculation. These base amounts match `data/services.json`, `schedule.html`, and `api/_lib/config.js` (19500/49500/89500 cents). This verifies publicly rendered pricing, not production environment settings, purchase completion, or owner approval. No private customer or payment information was entered.

**External copy conflicts remain:** AI checkout promises “dozens” of options; Full Service checkout promises the lowest price and average savings of $1,500–$4,000; Concierge says it handles every detail and implies door-to-door fulfillment. Those stronger claims are not supported by approved evidence in this repository and were not copied into the drafts. Owner must either substantiate and obtain required approval or replace them with the bounded governed service descriptions. No external edits were authorized for this task. The service registry records the observation without filling approval fields.

The homepage's existing testimonial sections were outside the requested heading/support-copy change and remain subject to the prior claims/evidence gates. This task does not certify those statements or declare the entire site production-ready.

## Exact remaining owner and reviewer inputs

1. **All three articles:** Mason (or another real responsible author) must accept the exact revised text. Supply qualified reviewer name, relevant qualifications, exact approved copy/revision, approval date, expiry/next-review date, and material-change triggers. Inspection needs mechanical/safety and consumer-law coverage; add-ons needs consumer-finance/insurance/warranty coverage; MSRP needs consumer-finance/advertising coverage. Multiple reviewers may be necessary.
2. **Austin operations:** Written coverage boundaries or ZIP policy; which steps are remote; whether advisor attendance is offered, where and at what cost; inspection selection/booking/payment responsibility; signing and handover responsibilities; seller/carrier arrangements, delivery eligibility and separate charges; available communication channels and scheduling limitations. Approve the exact service descriptions and current fees with an effective date. Do not invent hours or response-time promises.
3. **Austin release evidence:** An attributable Austin consultation/activity record or genuine non-brand demand evidence (for example a dated Search Console export showing relevant query/page data and period). Public road/county facts are useful regional evidence but do not replace this business/demand gate. Obtain named owner and local-content approval; review the retained title/emissions guidance with an appropriately qualified reviewer.
4. **Optional future customer example:** Use only an existing documented engagement with source records, written publication permission, calculation method if quantified, and required review. None was found. A case study is a future opportunity, not a fabricated release prerequisite; Gate 5 asks for a real example where available.
5. **Checkout copy:** Resolve the observed unsupported deliverable/outcome promises above through approved evidence or bounded wording in a separately authorized account change.

For a later approved release, update only the approved page's lifecycle and exact claim approvals, remove its noindex, add its canonical URL to the sitemap, and align visible author/reviewer/date fields with JSON-LD. Promote Austin from the homepage and Texas hub only at that point. Change the validator's Austin containment expectation only alongside this documented release; retain checks for the other eight cities. Replace draft labels on the three resource links only as each individual article is approved.

## Validation

- `node scripts/validate-site.mjs`: passed, 64 HTML files and nine sitemap URLs; existing validator unchanged.
- `git diff --check`: passed after all edits.
- Local browser checks: desktop 1440 × 1000 and mobile 390 × 844; additional narrow homepage check at 320 px. Confirmed wrapping and no horizontal page overflow. The homepage retains its existing responsive typography and CTA/form layout.
- A scoped `seo-content.css` fixes white navigation on the light draft pages, keeps breadcrumbs/status text below the fixed header, and stacks long draft bylines on mobile. Homepage styling is unchanged.
- `npm run check:api`: passed. `npm test`: 17 passed, zero failed.
- Supplemental checks passed for internal links and fragment targets, single H1, canonical and social-description parity, JSON-LD parsing, unchanged robots state on every page, and governance CSV column consistency.
- No live form/payment submission was attempted. Form markup, JS, API and payment configuration remain unchanged; verification compares their contracts to the original files.

## After deployment

Complete the existing release-readiness infrastructure, analytics, redirect, and rendered-quality gates. For each genuinely released URL, inspect the production canonical and robots response, then inspect it in Search Console. Submit the production sitemap after canonical/redirect checks pass (this preparation does not add sitemap members). Compare non-brand impressions, clicks, and qualified inquiries with the preceding 28-day baseline over the following 28 days, segmented by landing page. Keep unreleased drafts out of indexing requests.
