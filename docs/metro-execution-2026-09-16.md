# Metro release execution — September 16, 2026

The current DFW, Houston, Austin and service-area hub files in `draft-artifacts/metros/` are private editorial drafts. Generate them with `npm run draft:metros`; verify them with `npm run check:metros`. The loopback preview is `npm run preview:metros`. The drafts are excluded from Vercel output by `.vercelignore`, and no new public metro URL, redirect, sitemap entry or indexing change is authorized. A `noindex` tag alone does not authorize publication.

## Current decision

[The metro release decision](metro-release-decision-2026-09-16.md) is the authoritative record for the withdrawn proposals, bounded remote-service scope, testimonial attestation, pending analytics, and private-draft status. It supersedes the earlier proposed Texas passages and keeps the DFW, Houston, Austin and hub drafts private. The earlier Tarrant inspection-checklist conflict is outside this rollout; the original metro plan snapshots remain byte-preserved.

## Release contract

`scripts/metro-release.mjs`, invoked by `scripts/validate-site.mjs`, keeps the existing fail-closed gate. A market needs a concrete operating boundary and logistics, query/SERP and demand evidence, actual baseline, checkout parity, two claim/source-mapped local modules and a worksheet or permissioned case, current approved claim/source rows, editorial and qualified review, QA, service/entity/inventory parity, reviewed artifact hash, canonical and sitemap parity. The hub has separate review, QA and artifact approval. No field is set to approved merely because the owner confirmed availability or the testimonial attestation.

The existing task `barton-metro-release-evidence-20260916` retains these obligations; do not create a duplicate task or claim launch eligibility. Draft generation and noindex are not publication authorization.

The nine existing Texas HTML files, their current noindex behavior, existing discovery links and the sitemap remain under their previous containment and redirect review. Do not edit the original metro plan snapshots or use the old regulatory source collection as new publication evidence.

## Implementation verification

### Houston visual pilot — September 17, 2026

The user explicitly requested implementation and testing of a Houston-only redesign against the current homepage, preserving `/houston.html`, existing metadata/indexability, local content and conversion behavior, with no production deployment or other-city rollout. This supersedes the byte-preservation instruction only for this visual revision of Houston. `legacyTexas` records the original hash and this authorization reference alongside the new preserved artifact hash; this is not a content-claim approval, release approval, or indexing change. Houston remains `draft` / `noindex, follow`, and the existing claim, evidence, publication and production gates still apply. The release validator and all other city baselines remain unchanged. Houston imports the existing buying-page styles and adds only `buying/houston.css`; the homepage and shared styles/scripts are unchanged.

See the [initial verification record](../draft-artifacts/verification/README.md) for local results, preview screenshots and the dependency advisory. Those results describe the initial implementation revision. The current required checks are defined in [the GitHub workflow](../.github/workflows/checks.yml); follow-up changes require their own validation evidence from the active delivery run.

The user subsequently instructed that this branch and all its changes be merged into `main`. That authorizes merging the visual pilot; the private metro drafts, other-city rollout and indexing gates are unchanged.

### Houston search entry — September 17, 2026

The user requested the homepage car-search text box on the Houston page. The Houston hero now starts the existing buying brief with the entered vehicle details; the mobile CTA returns to that box. The hero pricing link remains available. `buying/houston-search.js` handles the same opening parser and browser brief storage used by the homepage, with the existing hash handoff as a storage fallback. The `legacyTexas` Houston hash records this authorized page revision. This is not a content-claim approval, metro release, indexing change, or production deployment.
