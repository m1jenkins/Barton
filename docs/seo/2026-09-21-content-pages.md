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

