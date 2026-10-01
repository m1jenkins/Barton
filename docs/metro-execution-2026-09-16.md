# Metro release execution — September 16, 2026

The current DFW, Houston, Austin and service-area hub files in `draft-artifacts/metros/` are private editorial drafts. Generate them with `npm run draft:metros`; verify them with `npm run check:metros`. The loopback preview is `npm run preview:metros`. The drafts are excluded from Vercel output by `.vercelignore`, and no new public metro URL, redirect, sitemap entry or indexing change is authorized. A `noindex` tag alone does not authorize publication.

## Current decision

[The metro release decision](metro-release-decision-2026-09-16.md) is the authoritative record for the withdrawn proposals, bounded remote-service scope, testimonial attestation, pending analytics, and private-draft status. It supersedes the earlier proposed Texas passages and keeps the DFW, Houston, Austin and hub drafts private. The earlier Tarrant inspection-checklist conflict is outside this rollout; the original metro plan snapshots remain byte-preserved.

## Current public pages and separate previews

The owner approved all content currently on the website on October 1, 2026. [That instruction](content-approval-2026-10-01.md) covers existing Texas city pages and supersedes earlier content-review requirements for them. Remove pre-publication warnings and do not request another content verification for their existing copy.

`scripts/metro-release.mjs`, invoked by `scripts/validate-site.mjs`, checks deployment exclusions, public-page hashes, and the records for separate private metro artifacts. Editing a pinned Texas page requires updating `legacyTexas[].sha256`. Existing noindex directives and sitemap decisions remain in place; generating a private preview does not copy it into a public route.

## Implementation verification

### Houston visual pilot — September 17, 2026

The user explicitly requested implementation and testing of a Houston-only redesign against the current homepage, preserving `/houston.html`, existing metadata/indexability, local content and conversion behavior, with no production deployment or other-city rollout. This supersedes the byte-preservation instruction only for this visual revision of Houston. `legacyTexas` records the original hash and this authorization reference alongside the new preserved artifact hash. The current public Houston content is now covered by the October 1 approval. Houston retains `noindex, follow`. The release validator and all other city baselines remain unchanged. Houston imports the existing buying-page styles and adds only `buying/houston.css`; the homepage and shared styles/scripts are unchanged.

See the [initial verification record](../draft-artifacts/verification/README.md) for local results, preview screenshots and the dependency advisory. Those results describe the initial implementation revision. The current required checks are defined in [the GitHub workflow](../.github/workflows/checks.yml); follow-up changes require their own validation evidence from the active delivery run.

The user subsequently instructed that this branch and all its changes be merged into `main`. That authorizes merging the visual pilot; the private metro drafts, other-city rollout and indexing gates are unchanged.

### Houston search entry — September 17, 2026

The user requested the homepage car-search text box on the Houston page. The Houston hero now starts the existing buying brief with the entered vehicle details; the mobile CTA returns to that box. The hero pricing link remains available. `buying/houston-search.js` handles the same opening parser and browser brief storage used by the homepage, with the existing hash handoff as a storage fallback. The `legacyTexas` Houston hash records this authorized page revision. This search-entry change preserved the page’s existing indexing and URL.
