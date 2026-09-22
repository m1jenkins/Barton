# Tesla FSD URL disposition — 2026-09-22

Closes the open Mason decision in `docs/seo/2026-09-21-claim-safety-redirects.md`.

## Decision

**Keep noindex park (status quo).**

| Field | Value |
| --- | --- |
| Date | 2026-09-22 |
| URL | `https://www.driverightcarbuying.com/tesla-fsd-for-sale.html` |
| Rationale | Owner standing SEO queue / next-wave brief |
| 301 | Rejected for now |
| 410 | Rejected for now |

## What stays in force

- Serve the real HTML page (HTTP 200).
- `<meta name="robots" content="noindex, follow">`.
- Self-canonical to the www URL above.
- Absent from `sitemap.xml`.
- Not linked from indexable commercial hubs as a current offer (`index.html`, `schedule.html`, `how-it-works.html`, `about.html`, `blog.html`).
- Footer links from this page to the nine Texas city pages remain the recorded `legacyDiscoveryLinks` in `data/metro-release.json`. Those edges are fine while the page is crawlable under noindex.

## What this is not

- Not an indexable landing page.
- Not a live Tesla / FSD inventory listing.
- Not an approved expansion of commercial offerings.
- Not exact-copy approval of `SEO-TESLA-2026-09-18` (still `contained_pending_qualified_review`).

Revisit only with a later named Mason decision.
