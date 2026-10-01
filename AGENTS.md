# Project agent memory

This file is the project's committed home for project-intrinsic agent knowledge: build, test, release, architecture, and sharp-edge notes that should travel with the code.

- Use Node 24 and the checks in `package.json` / `.github/workflows/checks.yml`.
- Read `README.md` first: it maps every folder, the two page styles (current `buying/*.css` vs legacy `styles.css`), and which folders are not deployed. `docs/README.md` indexes the docs.
- Root `*.html` files are live URLs; each page carries its own copy of the header, footer and nav. Do not rename or move them without a `vercel.json` redirect.
- Public copy uses “car search” or “search details”; never use “brief” (including metadata, accessibility labels, dynamic messages, and downloads).
- Read `.ai_rules` before UI changes (`.cursorrules` is a symlink to it).
- Homepage CSS/JS URLs use content hashes to avoid stale live caches; `scripts/validate-site.mjs` checks them and reports the required URLs after asset changes.
- The owner approved all current website content on October 1, 2026; see `docs/content-approval-2026-10-01.md`. Do not add draft warnings or require another content verification/approval for existing website copy.
- Metro generation and release records: `docs/metro-execution-2026-09-16.md`, `data/metro-release.json`, and `docs/release-readiness.md`. Draft generation is local-only. Editing a pinned legacy Texas page also means updating its `legacyTexas[].sha256`, or `scripts/validate-site.mjs` fails.
- Redirects: `vercel.json` plus `scripts/check-redirects.mjs` (`--config-only` for the file, env vars for the live matrix). Apex → www status is host/dashboard configuration that runs before repo routing; see `docs/seo/2026-09-21-claim-safety-redirects.md`.
- `tesla-fsd-for-sale.html` is a keep-noindex park (2026-09-22): real page, `noindex, follow`, self-canonical, off sitemap; do not 301, 410, or index it without a later named Mason decision. See `docs/seo/2026-09-22-tesla-fsd-disposition.md`.
- Google Ads: plan `docs/google-ads-launch-plan-2026-09-27.md`; campaign source `outputs/2026-10-google-search-ads/plan.json`. Rebuild its Editor CSVs with `build-editor-csv.mjs` in that folder; never hand-edit them. Ad text is a claims surface and goes live only through the approved `ADS-GOOGLE-2026-10` row. Google tags stay GTM-only (`scripts/validate-site.mjs`).

## Maintaining this file

Keep this file for knowledge useful to almost every future agent session in this project.
Do not repeat what the codebase already shows; point to the authoritative file or command instead.
Prefer rewriting or pruning existing entries over appending new ones.
When updating this file, preserve this bar for all agents and keep entries concise.
