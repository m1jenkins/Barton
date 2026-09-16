# Local draft verification — September 16, 2026

Historical record for initial implementation commit `41dbfe6`, before the subsequent review fixes. The recorded run used Node v24.20.0: `npm ci`, `node scripts/validate-site.mjs`, `npm run check:api`, `npm test` (96 tests), `npm run check:metros`, and `git diff --check` passed. The validator reported 64 root HTML pages and nine sitemap URLs. Original root HTML, sitemap, redirects and .gitignore were unchanged. Both plan hashes matched the intake manifest. This record does not establish results for later revisions; see [the current checks workflow](../../.github/workflows/checks.yml) and the active delivery run for current validation requirements and results.

That run's 42 added tests executed release validation on isolated fixture sites, rendered generated HTML, and sent HTTP requests to a loopback preview. They covered eligible approval, each missing evidence/review class, pending/expired/revoked claims, source expiry, unknown tiers, malformed records, hub/service/entity/inventory/schema/hash mismatches, sitemap/noindex disagreement, unsafe root/nested draft publication, legacy preservation, Vercel exclusion loss, renderer drift and private-file/POST refusal. See [the metro tooling tests](../../scripts/_tests/) for current coverage. Synthetic fixture approvals are never copied into real market records.

Browser checks used separate named `chrome-devtools-axi` sessions on loopback port 4176:

- DFW desktop 1440 × 1000: typography, normal navigation and content inspected; screenshot `dfw-desktop.png`.
- Houston mobile 390 × 844: screenshot `houston-mobile.png`; viewport and document scroll width both 390. Narrow 320 × 740: both widths 320. The comparison table intentionally scrolls inside its labeled keyboard-focusable region.
- Keyboard: Tab reaches the visible outlined skip link; Enter moves focus to `main-content`. Native details toggles with Enter. Explicit labels appear in the accessibility tree. No console messages were reported after these checks.
- JavaScript-disabled session launched with `--blink-settings=scriptEnabled=false`: hub static content rendered at 1440 × 1000 (`hub-nojs-desktop.png`). Houston was also opened directly and its static text inspected. Browser tool clicking in that session was unavailable; ordinary-session keyboard behavior and generated static markup supply the interaction evidence. The allowlisted preview additionally denies scripts and form submission through CSP.
- No production page, lead endpoint, payment checkout or credentials were used. Central-page reference links intentionally show a local boundary page. Live conversion and deployed accessibility/performance gates remain pending.

Tool limitations: the batch browser evaluator rejected one callback and navigation to browser settings was unavailable; verification used supported individual browser commands and a separate no-JS launch. These were harness limitations, not site errors.

`npm ci` reports one pre-existing high-severity audit finding for sharp <0.35.4 (GHSA-rgj7-g3m4-5g8c). The lockfile's sharp version is unchanged by this scoped implementation; the added parse5 HTML parser is not implicated. This remains a dependency maintenance finding, not a metro release acceptance.
