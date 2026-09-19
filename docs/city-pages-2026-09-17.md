# Homepage-based city pages

Revised September 18, 2026 to match the requested homepage exactly, with minimal local copy.

`scripts/render-city-pages.mjs` reads `index.html` directly. All 20 city pages inherit its DOM structure, navigation, typography, photos, illustrated process, prices, FAQs, footer, and complete buying-brief interaction. There is no city stylesheet or separate city application.

Visible differences are limited to the city name in the hero, the introduction's service geography, one local sentence, and geographic wording in two FAQ answers and the footer. Titles, descriptions, canonical/social URLs, breadcrumbs, and service-area schema identify the corresponding city. The business remains Austin-based, with the same contact information and organization identity. No local office, address, review, or savings claim is invented.

The shared buying controller now retains the page's original title when returning from the conversation or brief. The homepage keeps its existing title and behavior.

## Local workflow

Use Node 24:

```sh
npm run draft:cities
npm run check:cities
npm run preview:cities
```

Open `http://127.0.0.1:4177/service-areas.html` for the city index, or `/new-york.html` for a representative page. `/` serves the actual homepage for comparison. All 20 pages follow the exact requested list, including separate Dallas and Fort Worth pages.

- `data/city-pages.json`: names, states, URLs, and one sentence per city.
- `index.html`: shared layout, service copy, prices, images, and asset URLs.
- `draft-artifacts/cities/`: generated HTML; do not edit by hand.
- `scripts/preview-cities.mjs`: loopback preview of the pages and actual public assets. Inquiries and payments are unavailable locally; the original brief saves and downloads on the device.

Regenerate after homepage changes. `check:cities` detects drift, and the tests compare every city's complete body structure, stylesheet URLs, process section, pricing section, navigation, and forms against the homepage. Other checks are listed in `.github/workflows/checks.yml`.

September 18 validation: all 123 tests pass, along with city drift, buying/site, API, metro, and whitespace checks. All 20 pages loaded their hero image without horizontal overflow at 320px. New York was visually reviewed at desktop and 390px widths; its original example-to-conversation flow and return to the city title worked without console warnings or errors.

## Search and publication scope

The earlier SEO research remains background guidance: [Google Ads landing-page relevance](https://support.google.com/google-ads/answer/6238826?hl=en), [Google's helpful-content guidance](https://developers.google.com/search/docs/fundamentals/creating-helpful-content), and [Google's spam policies](https://developers.google.com/search/docs/essentials/spam-policies#doorway-abuse). This revision follows the owner's explicit direction to reuse the homepage with only a short local addition. It does not claim that city-name variations alone establish organic ranking value.

The collection remains a local preview, excluded from deployment by `.vercelignore`, with `noindex, nofollow` metadata and preview response headers. The production homepage's visual content, sitemap, and existing public city routes have not been replaced. Owner-confirmed remote availability is recorded in `data/services.json#availabilityConfirmation`; the existing [release workflow](metro-execution-2026-09-16.md) and [claim workflow](claim-review-workflow.md) still apply to a later publication.

The [Maps scope record](MAPS-ANALYSIS-driverightcarbuying.com.md) documents identity and evidence limits. No Maps ranking or AI-search visibility claim is made.
