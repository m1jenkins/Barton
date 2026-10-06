# Drive Right website

Source for www.driverightcarbuying.com, a flat-fee car-buying service based in Austin. It is a static HTML site with a few Vercel serverless functions for leads and Stripe checkout. Every push to `main` deploys to production.

## Where things live

Every `.html` file in the repo root is a live page, and its file name is its URL (`about.html` → `/about.html`, `index.html` → `/`). Do not rename or move a root page without adding a redirect in `vercel.json`.

| Path | What it is |
| --- | --- |
| `*.html` (root) | Public pages. Each one is a complete, standalone file: the header, footer and nav are copied into every page, so a site-wide change means editing each page. |
| `buying/` | The current design system and checkout used by the homepage and main pages. `daisy.css` + `drive-right.css` are the shared styles; `houston.css` is the Houston pilot only. `checkout.js` and `app.js` send every plan button straight to Stripe (the car details come after payment), `inquiry.js` runs the no-payment "Talk to Mason" inquiry, and `intake.js` + `intake-chat.js/css` run the chat intake on the Full Service and Ultimate Concierge payment pages. |
| `styles.css`, `seo-content.css`, `legacy-refresh.css` | The older page components and the shared visual layer that aligns their typography, navigation, colors, and reading layout with the current site. |
| `logo-motion.css`, `logo-motion.js`, `assets/mascot/` | The approved Mariner Blue Miata mark beside the header wordmark on public pages. The sprites are deployed; their reference sheets stay out of production. |
| `script.js` | Shared page script: mobile menu, lead forms, checkout start, payment verification, analytics, and it loads `openai-ads.js` and consented `web-analytics.js`. Used by every page except `ai-car-buying-agent.html` and the local quote worksheet. Parts of it are minified onto very long lines, so search for the function name before editing. |
| `accessibility.css/js`, `openai-ads.js` | Small shared helpers loaded by pages. |
| `logo-motion.css/js` | The header mascot, a Mariner Blue Miata beside the wordmark, loaded by every page. It does the first-visit drive-by intro and headlight winks, and also covers the payment-success celebration. |
| `assets/` | Images and fonts. `assets/buying/` holds photos and self-hosted fonts for the current design; `assets/external/` holds optimized photos (`source/` keeps the originals); `assets/mascot/` holds the mascot sprites, built by `scripts/build-mascot-sprites.mjs` from `assets/mascot/reference/` (not deployed). |
| `api/` | Vercel serverless functions: `leads`, `checkout-start`, `stripe-webhook`, `purchase-status`, `onboarding`, and the protected `outbox-dispatch` cron. Shared code in `api/_lib/`, tests in `api/_tests/`. |
| `db/` | PostgreSQL migrations, applied in number order. |
| `vercel.json` | Redirects and security headers. Check with `node scripts/check-redirects.mjs --config-only`. |
| `sitemap.xml`, `robots.txt`, `llms.txt`, `pricing.md` | Public files for search engines and AI assistants. Keep prices in `pricing.md`, `llms.txt` and `schedule.html` in sync. |
| `scripts/` | Local tools: site validator, preview servers, draft generators. Not deployed. |
| `data/` | Governed source data (claims, sources, metro and city page data, release gates). Not deployed. |
| `docs/` | Plans, decision records and evidence. Not deployed. See [docs/README.md](docs/README.md). |
| `draft-artifacts/` | Private city/metro renders and archived hand-authored guide/worksheet previews. Not deployed. Regenerate city/metro pages with their scripts. |
| `outputs/` | Private ad-campaign review bundle. Not deployed. |
| `.agents/`, `.superdesign/` | Tool-owned folders (installed agent skills, design scratch). Not deployed. |

`.vercelignore` lists everything that stays out of the deployment.

The three released guides use `buying/resources.css`. `compare-car-quotes.html` uses `buying/quote-comparison.css/js` and the shared calculation library `buying/quote-worksheet.js`; its private preview uses that same library. The worksheet intentionally loads no measurement scripts. Publication is recorded in `docs/resource-release-2026-10-04.md`.

## Two page styles

The site is partway through a redesign, so pages come in two families. Match the family of the page you are editing.

- **Current design**: `index.html`, `about.html`, `schedule.html`, `how-it-works.html`, `car-buying-service.html`, `blog.html`, `policy.html`, `texas-local-market-intelligence.html`, `ai-car-buying-agent.html`, `houston.html`, and the `payment-success*.html` pages. They load `buying/daisy.css` and `buying/drive-right.css`, and their markup is scoped under `.dr`. Some of these pages are redirected or `noindex`; the design family does not determine indexability.
- **Legacy components**: the `blog-*.html` posts, the other Texas city pages (`austin.html`, `dallas.html`, and so on), `inquiry.html`, `success.html`, `tesla-fsd-for-sale.html` and the topic pages. They load `styles.css` and `legacy-refresh.css`. Their indexability is governed per page, independent of styling.

Design rules for all pages are in `.ai_rules` (`.cursorrules` points to the same file).

## Rules that trip up edits

- **Homepage asset hashes.** `index.html` loads `buying/drive-right.css`, `buying/app.js`, `script.js` and `logo-motion.css/js` with a `?v=<hash>` suffix. After changing one of those files, run `node scripts/validate-site.mjs`; it prints the new URL to paste into `index.html`.
- **Header mascot on every page.** Every root page's `<head>` ends with the logo-intro gate script and the `logo-motion.css`/`logo-motion.js` tags. A new page copies that block, and a change to either file means updating its `?v=` on every page; `scripts/_tests/seo-release.test.mjs` checks both.
- **Pinned legacy Texas pages.** The legacy city pages are pinned by checksum in `data/metro-release.json` (`legacyTexas[].sha256`). Editing one means updating its checksum, or the validator fails.
- **Indexing decisions.** Which pages are indexed, `noindex`, or in the sitemap is a recorded decision (see `docs/seo/`). Do not flip `robots` tags or the sitemap as a side effect of another change.

## Checks

Use Node 24.

```sh
npm ci
node scripts/validate-site.mjs   # page metadata, asset hashes, sitemap, schema
npm run check:api                # syntax check for the serverless functions
npm run check:js                 # all first-party JavaScript, including browser modules and local tools
npm run check:metros             # drafts match their generator
npm run check:cities
npm test
```

CI runs the same list in `.github/workflows/checks.yml`. Site validation also follows local HTML, CSS and browser module resources, rejects references excluded from deployment, and checks their content-hash versions. `npm run check:assets` runs that resource check alone. Database delivery tests use the development-only PGlite PostgreSQL runtime with synthetic records.

`npm run leads:dispatch` retries one due batch of configured lead notifications and reports aggregate counts. It requires a configured destination and scoped database access; see [lead notification recovery](docs/implementation-operations.md#lead-notification-recovery). Connect it to an authorized scheduler for unattended recovery.

## Local preview

`npm run preview` serves the site at `http://127.0.0.1:4175`. API calls return "unavailable" locally, so nothing is charged and no lead is created. Use a Vercel preview deployment for Stripe test purchases.

Other previews: `npm run preview:cities` (city page drafts, port 4177), `npm run preview:metros`, `npm run preview:guides`, `npm run preview:worksheet`.

## More detail

- Checkout, leads and onboarding: [docs/implementation-operations.md](docs/implementation-operations.md); the plan-first checkout: [docs/checkout-streamline-2026-10-05.md](docs/checkout-streamline-2026-10-05.md)
- Metro and city page drafts: [docs/metro-execution-2026-09-16.md](docs/metro-execution-2026-09-16.md), [docs/city-pages-2026-09-17.md](docs/city-pages-2026-09-17.md)
- OpenAI ads tracking: [docs/openai-ads-setup.md](docs/openai-ads-setup.md)
- Fonts: the pages load the Latin WOFF2 subsets in `assets/buying/fonts/`, built from the TTF sources there by `node scripts/build-fonts.mjs` (needs `uv`). The TTF sources stay out of the deployment. Font licenses are in the same folder.
