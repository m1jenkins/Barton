# Project agent memory

This file is the project's committed home for project-intrinsic agent knowledge: build, test, release, architecture, and sharp-edge notes that should travel with the code.

- Use Node 24 and the checks in `package.json` / `.github/workflows/checks.yml`.
- Read `.ai_rules` and `.cursorrules` before UI changes.
- Homepage CSS/JS URLs use content hashes to avoid stale live caches; `scripts/validate-site.mjs` checks them and reports the required URLs after asset changes.
- Metro drafts and release gates: `docs/metro-execution-2026-09-16.md`, `data/metro-release.json`, and `docs/release-readiness.md`. Draft generation is local-only; noindex is not publication authorization. Editing a contained legacy Texas page also means re-pinning its `legacyTexas[].sha256`, or `scripts/validate-site.mjs` fails.
- Redirects: `vercel.json` plus `scripts/check-redirects.mjs` (`--config-only` for the file, env vars for the live matrix). Apex → www status is host/dashboard configuration that runs before repo routing; see `docs/seo/2026-09-21-claim-safety-redirects.md`.
- `tesla-fsd-for-sale.html` is a keep-noindex park (2026-09-22): real page, `noindex, follow`, self-canonical, off sitemap; do not 301, 410, or index it without a later named Mason decision. See `docs/seo/2026-09-22-tesla-fsd-disposition.md`.
- Claim approval and source mapping: `docs/claim-review-workflow.md`. Keep exact-copy approval separate from owner availability/page sign-off.

## Maintaining this file

Keep this file for knowledge useful to almost every future agent session in this project.
Do not repeat what the codebase already shows; point to the authoritative file or command instead.
Prefer rewriting or pruning existing entries over appending new ones.
When updating this file, preserve this bar for all agents and keep entries concise.
