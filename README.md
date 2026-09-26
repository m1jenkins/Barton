# Drive Right website

Source for www.driverightcarbuying.com, a flat-fee car-buying service based in Austin. It is a static HTML site with a few Vercel serverless functions for leads and Stripe checkout. Every push to `main` deploys to production.

## Where things live

Every `.html` file in the repo root is a live page, and its file name is its URL (`about.html` → `/about.html`, `index.html` → `/`). Do not rename or move a root page without adding a redirect in `vercel.json`.

| Path | What it is |
| --- | --- |
| `*.html` (root) | Public pages. Each one is a complete, standalone file: the header, footer and nav are copied into every page, so a site-wide change means editing each page. |
| `buying/` | The current design system and the buying-brief app used by the homepage and main pages. `daisy.css` + `drive-right.css` are the shared styles; `houston.css` is the Houston pilot only. `intake.js`, `brief.js`, `checkout.js` and `app.js` run the brief-and-checkout flow. |
| `styles.css`, `seo-content.css` | The legacy stylesheet used by older, `noindex` pages (blog posts, legacy city pages, `inquiry.html`). |
| `script.js` | Shared page script: mobile menu, lead forms, checkout start, payment verification, analytics, and it loads `openai-ads.js`. Used by every page except `ai-car-buying-agent.html`. Parts of it are minified onto very long lines, so search for the function name before editing. |
| `accessibility.css/js`, `ad-consent.css/js`, `openai-ads.js` | Small shared helpers loaded by pages. |
| `assets/` | Images and fonts. `assets/buying/` holds photos and self-hosted fonts for the current design; `assets/external/` holds optimized photos (`source/` keeps the originals). |
| `api/` | Vercel serverless functions: `leads`, `checkout-start`, `stripe-webhook`, `purchase-status`, `onboarding`. Shared code in `api/_lib/`, tests in `api/_tests/`. |
| `db/` | PostgreSQL migrations, applied in number order. |
| `vercel.json` | Redirects and security headers. Check with `node scripts/check-redirects.mjs --config-only`. |
| `sitemap.xml`, `robots.txt`, `llms.txt`, `pricing.md` | Public files for search engines and AI assistants. Keep prices in `pricing.md`, `llms.txt` and `schedule.html` in sync. |
| `scripts/` | Local tools: site validator, preview servers, draft generators. Not deployed. |
| `data/` | Governed source data (claims, sources, metro and city page data, release gates). Not deployed. |
| `docs/` | Plans, decision records and evidence. Not deployed. See [docs/README.md](docs/README.md). |
| `draft-artifacts/` | Generated private drafts (city pages, metro pages, guide rewrites). Not deployed. Regenerate them; do not hand-edit. |
| `outputs/` | Private ad-campaign review bundle. Not deployed. |
| `.agents/`, `.superdesign/` | Tool-owned folders (installed agent skills, design scratch). Not deployed. |

`.vercelignore` lists everything that stays out of the deployment.

## Two page styles

The site is partway through a redesign, so pages come in two families. Match the family of the page you are editing.

- **Current design**: `index.html`, `about.html`, `schedule.html`, `how-it-works.html`, `car-buying-service.html`, `blog.html`, `policy.html`, `texas-local-market-intelligence.html`, `ai-car-buying-agent.html`, `houston.html`, and the `payment-success*.html` pages. They load `buying/daisy.css` and `buying/drive-right.css`, and their markup is scoped under `.dr`. Some of these pages are redirected or `noindex`; the design family does not determine indexability.
- **Legacy design** (`noindex`): the `blog-*.html` posts, the other Texas city pages (`austin.html`, `dallas.html`, and so on), `inquiry.html`, `success.html`, `tesla-fsd-for-sale.html` and the topic pages. They load `styles.css`.

Design rules for all pages are in `.ai_rules` (`.cursorrules` points to the same file).

## Rules that trip up edits

- **Homepage asset hashes.** `index.html` loads `buying/drive-right.css`, `buying/app.js` and `script.js` with a `?v=<hash>` suffix. After changing one of those files, run `node scripts/validate-site.mjs`; it prints the new URL to paste into `index.html`.
- **Pinned legacy Texas pages.** The legacy city pages are pinned by checksum in `data/metro-release.json` (`legacyTexas[].sha256`). Editing one means updating its checksum, or the validator fails.
- **Indexing decisions.** Which pages are indexed, `noindex`, or in the sitemap is a recorded decision (see `docs/seo/`). Do not flip `robots` tags or the sitemap as a side effect of another change.
- **Claims.** Prices, guarantees and factual claims go through `docs/claim-review-workflow.md`.

## Checks

Use Node 24.

```sh
npm ci
node scripts/validate-site.mjs   # page metadata, asset hashes, sitemap, schema
npm run check:api                # syntax check for the serverless functions
npm run check:metros             # drafts match their generator
npm run check:cities
npm test
```

CI runs the same list in `.github/workflows/checks.yml`.

## Local preview

`npm run preview` serves the site at `http://127.0.0.1:4175`. API calls return "unavailable" locally, so nothing is charged and no lead is created. Use a Vercel preview deployment for Stripe test purchases.

Other previews: `npm run preview:cities` (city page drafts, port 4177), `npm run preview:metros`, `npm run preview:guides`, `npm run preview:worksheet`.

## More detail

- Buying brief and checkout flow: [docs/implementation-operations.md](docs/implementation-operations.md)
- Metro and city page drafts: [docs/metro-execution-2026-09-16.md](docs/metro-execution-2026-09-16.md), [docs/city-pages-2026-09-17.md](docs/city-pages-2026-09-17.md)
- OpenAI ads tracking: [docs/openai-ads-setup.md](docs/openai-ads-setup.md)
- Font and photo credits: font licenses are in `assets/buying/fonts/`.
