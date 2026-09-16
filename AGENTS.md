# Project agent memory

This file is the project's committed home for project-intrinsic agent knowledge: build, test, release, architecture, and sharp-edge notes that should travel with the code.

- Use Node 24 and the checks in `package.json` / `.github/workflows/checks.yml`.
- Read `.ai_rules` and `.cursorrules` before UI changes.
- Metro drafts and release gates: `docs/metro-execution-2026-09-16.md`, `data/metro-release.json`, and `docs/release-readiness.md`. Draft generation is local-only; noindex is not publication authorization.
- Claim approval and source mapping: `docs/claim-review-workflow.md`. Keep exact-copy approval separate from owner availability/page sign-off.

## Maintaining this file

Keep this file for knowledge useful to almost every future agent session in this project.
Do not repeat what the codebase already shows; point to the authoritative file or command instead.
Prefer rewriting or pruning existing entries over appending new ones.
When updating this file, preserve this bar for all agents and keep entries concise.
