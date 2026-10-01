# SEO preparation — September 5, 2026

This is a historical record of repository edits and technical checks. All current public website content, including the three guides and Austin page below, is now owner-approved under [the October 1 instruction](content-approval-2026-10-01.md).

## Prepared pages

| Page | Work prepared |
| --- | --- |
| `blog-used-car-inspection-checklist.html` | Buyer observation checklist, inspector questions, decision worksheet, hypothetical example, and primary links |
| `blog-dealership-addons-complete-guide.html` | Product questions, written terms, optional-product distinction, and financed-cost example |
| `blog-buy-new-car-below-msrp.html` | Quote requests, incentive conditions, arithmetic example, counteroffer script, and contract reconciliation |
| `austin.html` | Austin base, service plans, transaction planning, county/emissions/I-35 resources, and contact form |
| `blog.html` | Direct links to the guides |

The warning-removal change retains current indexing and redirects. Historical counts and prices below describe the September 5 implementation rather than current offers.

## Source mapping

The `SEP-*` rows in `data/source-registry.csv` preserve the source URLs and page sections used for the September revisions.

Primary authorities used: FTC for dealer disclosures, inspections, warranties and quote comparison; CFPB for MSRP, optional products, GAP and financed add-ons; TxDMV for title-history lookups; NHTSA for recall-search limitations; Travis County Tax Office for local title-service routes; TCEQ for Austin-area emissions applicability; TxDOT for I-35 Central construction and closure information. Links appear beside supported claims in the pages. No live incentive amount, tax rate, discount benchmark, inspection price, or average customer outcome was introduced.

The articles retain their original attribution and AI-assisted revision disclosure. Current service prices are $395 for Full Service and $695 for Ultimate Concierge; the earlier checkout observations are retained in the service and Stripe history records.

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
