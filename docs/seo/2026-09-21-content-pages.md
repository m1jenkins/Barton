# SEO content and pages — 2026-09-21

## Goal

Improve the indexable service pages for nationwide car-buying-service and car-negotiator intent, then add one substantial explainer page without expanding unreviewed claims or releasing contained local/editorial pages.

## URLs

### New

- `https://www.driverightcarbuying.com/car-buying-service.html`
  - Intent: explain what a car-buying and negotiation service does.
  - Positioning: Drive Right is an Austin-based service-area business providing remote support nationwide, not a vehicle dealer.
  - Name disambiguation: visitors looking for a dealership or a similarly named “Drive Right Auto Sales” business are told they may be looking for a different company.
  - Conversion path: compare Full Service at $295 USD one time and Ultimate Concierge at $895 USD one time.

### Updated

- `https://www.driverightcarbuying.com/`
- `https://www.driverightcarbuying.com/how-it-works.html`
- `https://www.driverightcarbuying.com/schedule.html`
- `https://www.driverightcarbuying.com/about.html`
- `https://www.driverightcarbuying.com/blog.html`

The updates align titles, descriptions, social metadata, structured-data descriptions, and visible copy with the current nationwide remote offer. They also add contextual links to the new explainer.

## Content design

The new page answers five distinct questions:

1. What does a car-buying service do?
2. What can a car negotiator handle under Drive Right’s current plans?
3. What remains the buyer’s responsibility?
4. How is Drive Right different from a dealer or similarly named auto-sales business?
5. Which plan fits the requested level of support?

The page uses the existing buying-page layout and shared assets. No new component, animation, dependency, contact claim, location, or testimonial is introduced.

## Claim sources

- `pricing.md`
  - Nationwide remote support from an Austin base.
  - Full Service is $295 USD one time.
  - Ultimate Concierge is $895 USD one time.
  - Drive Right is a service-area business, not a vehicle dealer or a storefront in every metro.
  - Vehicle price, taxes, registration, inspection, financing, insurance, and delivery are separate.
- `data/services.json`
  - Full Service scope: new, used, and CPO search; price negotiation and fee review; dedicated advisor; documented recommendations.
  - Ultimate Concierge scope: Full Service plus broader sourcing, priority communication and coordination, and delivery coordination where available.
  - Availability is owner-confirmed across states and cities.
  - Standalone AI Agent service is retired for new sales.
- `data/entities.json`
  - One Organization, based in Austin, serving the United States.
  - No approved storefront or LocalBusiness location.
- `data/claims.csv`
  - `SEO-PRICE-2026-09-18` is the approved exact pricing and retirement record.
  - Pending savings, guarantee, refund, testimonial, experience, independence, and service-level claims are excluded.
- `docs/claim-review-workflow.md`
  - Only approved claims may be intentionally introduced or expanded.
  - Visible copy, metadata, schema, and conversion surfaces must remain aligned.
- `docs/editorial-policy-draft.md`
  - Used as a conservative drafting checklist only; it remains unapproved policy.

## Intentional geographic framing

Commercial service copy uses “Austin-based” and “nationwide remote support.” Existing Texas-only framing remains only on the separate Texas market hub and contained city pages. Those pages are outside this change, remain `noindex` where already contained, and do not imply storefronts.

## Acceptance checks

- [x] Homepage has one `h1` element and no retired `$195` or `$495` offer.
- [x] All updated metadata uses current nationwide/Austin framing and current prices.
- [x] New explainer is `index, follow`, has one canonical URL, and is included in `sitemap.xml`.
- [x] Home, How It Works, About, Pricing, and Resources provide contextual routes to the explainer where appropriate.
- [x] New copy contains no savings percentage or average, guarantee, refund promise, street address, LocalBusiness markup, testimonial, or review count.
- [x] City pages and contained blog/resource pages retain their current robots state.
- [x] `data/content-inventory.csv` records the new page intent and lifecycle.
- [x] Repository tests and `scripts/validate-site.mjs` pass.

## GSC: Crawled currently not indexed (2026-09-21)

Do not mass-request index for these URLs. GSC’s “crawled currently not indexed” report here is expected crawl waste and containment, not a publication queue.

### `/uuyh/` is not a site page

Checked 2026-09-21 against the repository and live origin:

- The string `uuyh` does not appear in navigation, HTML, or other committed site files.
- `https://www.driverightcarbuying.com/uuyh/` returns HTTP 200 `application/javascript` from Cloudflare. The body is Google Tag Manager container JavaScript (`Copyright 2012 Google Inc`, GTM macros). This is consistent with a first-party Google Tag Gateway / measurement path, not an HTML landing page.
- `https://www.driverightcarbuying.com/uuyh` (no trailing slash) returns HTTP 404 HTML. Ordinary unknown paths such as `/zzzzjunkpath/` 308-strip the slash under `trailingSlash: false`.

Handling in this change:

- `robots.txt` disallows `/uuyh` for Googlebot, Bingbot, and `*` (prefix match also covers `/uuyh/`).
- `vercel.json` sets `X-Robots-Tag: noindex, nofollow, noarchive` on `/uuyh` and `/uuyh/`.
- Permanent 308 applies only to slashless `/uuyh` → `/`, matching other junk/legacy `vercel.json` redirects.
- Do **not** 308 `/uuyh/`. Redirecting the slash URL would risk breaking the Cloudflare-served GTM script if browsers or tags request that path.

If GSC still lists `/uuyh/` after robots pickup, treat it as measurement-path noise. Do not add it to the sitemap or Request Indexing.

### Legacy `blog-*.html` URLs

These are **intentional noindex**, not soft-orphan pages that should be indexed. They stay off `sitemap.xml`. Reindexing is page-specific after claim review (`docs/claim-review-workflow.md`); it is not a bulk GSC action.

**Must remain at URL with `noindex, follow` (do not redirect to hide unresolved claims):**

- `blog-texas-title-transfer.html`
- `blog-texas-car-buying-laws.html`
- `blog-spot-delivery-scam.html`
- `blog-private-party-vs-dealership.html`

**Already 308 in `vercel.json` (historical aliases, not index candidates):**

- `blog-dealer-addons-exposed.html` → `blog-dealership-addons-complete-guide.html` (target remains noindex)
- `blog-roi-car-buying-service.html` → `how-it-works.html`
- `blog-flat-fees-vs-commissions.html` → `how-it-works.html`
- `blog-zero-kickbacks-promise.html` → `how-it-works.html`
- `blog-skip-dealership-marathon.html` → `how-it-works.html`

**Remaining public-root `blog-*.html` files** (price, dealer, financing, inspection, and similar articles) stay `noindex, follow` with inventory lifecycle `contained_pending_*`. Google can still crawl them from historical links; that shows up as crawled-not-indexed. That is acceptable waste until an individual article is approved.

**Contained hubs** (also noindex; hub cards exist on `blog.html` but are labeled as excluded from search):

- `texas-car-buying-rules-paperwork.html`
- `auto-financing-credit-fi.html`
- `used-car-due-diligence.html`
- `new-car-pricing-incentives.html`
- `vehicle-selection-total-cost.html`

**Indexable on the resource hub, not part of the blog-archive waste set:** `car-buying-service.html`, `how-it-works.html`, `schedule.html`, and `texas-local-market-intelligence.html`. Three draft cards (`blog-used-car-inspection-checklist.html`, `blog-dealership-addons-complete-guide.html`, `blog-buy-new-car-below-msrp.html`) remain noindex pending author and qualified review.

