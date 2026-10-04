# Repository audit — October 4, 2026

The audit found recoverable failures around saved leads and incomplete static checks. This change fixes those failures, adds a notification retry worker, and records the next useful projects. The starting point was `746b5ac`; the original 225 tests passed before the audit. The resulting suite has 249 passing tests.

## Scope and findings

Reviewed the root marketing pages, both page styles, the guided car search, pricing inquiry, checkout/receipt/onboarding boundaries, lead and analytics queues, SQL schema, deployment exclusions, redirects, content release records, private generators, guide drafts and quote worksheet. Production services and customer records were not exercised. The existing offer, historical receipt and SEO tests passed.

| Area | Finding | Implemented result |
| --- | --- | --- |
| Saved leads | A notification claim or acknowledgement error could return HTTP 500 after the lead had committed. | The API returns its durable saved receipt even when notification dispatch fails. |
| Notification recovery | Failed forwards were stored, but the repository had no retry worker. | `npm run leads:dispatch` claims bounded batches, respects retry backoff, recovers expired processing leases, caps attempts, and fences acknowledgements by attempt number. |
| Contact retries | After a lost response, editing the form could reuse a conflicting key and trap the visitor in repeated HTTP 409 responses. | Ordinary retries keep their key; a confirmed key conflict restarts once. Unconfigured forwarding shows direct contact options. |
| Form deadlines | The 15-second timer ended when headers arrived, so a stalled JSON body could leave the form busy indefinitely. | The deadline covers the whole response and restores an editable form after timeout. |
| Optional measurement | A throwing analytics adapter could replace a successful inquiry with an error message. | Saved-inquiry confirmation survives analytics errors. |
| API inputs | Pre-parsed arrays were accepted where raw arrays were rejected; integer settings accepted partial strings. | Both JSON paths reject arrays; integer configuration rejects fractions and trailing text. |
| Build coverage | The syntax list missed first-party helpers and browser scripts; asset checks covered only selected version hashes. | Automatic syntax discovery plus local HTML/CSS/module asset validation now run in CI. |
| Deployment inputs | Agent/review directories, SQL source and browser tests lacked explicit exclusions. | `.vercelignore` excludes them; the asset checker rejects public references to excluded files. |

## Evidence

Failures were reproduced before their fixes: saved leads returning 500, a missing response-body deadline, conflicting edited contact retries, false inquiry failures, inconsistent JSON-array handling, and partial integer parsing. Regression tests exercise the production handlers and browser source, rather than copying their implementations.

- `npm ci`: clean install, zero reported vulnerabilities.
- `npm test`: **249 passed**, zero failures or skips; **24 additional tests** over the baseline.
- `npm run check:js`: **73** JavaScript files; `check:api`: **29**; `check:buying`: **13** browser files plus site validation.
- `node scripts/validate-site.mjs`: **65** root HTML files, **9** sitemap URLs and **566** local resource references.
- `npm run check:metros` and `npm run check:cities`: **4** metro drafts and **20** city drafts plus their hub match their generators.
- `node scripts/check-redirects.mjs --config-only`: **16** permanent redirect rules retained.
- `git diff --check`: passed.

Notification tests execute the production SQL against PostgreSQL via the dev-only PGlite runtime and the existing committed schema. They cover backoff, stable downstream idempotency keys, oldest-first bounded claims, active/expired leases, exhausted attempts, late acknowledgements and private-error handling. Interleaved workers are exercised; a physical multi-connection PostgreSQL stress test is outside this local test harness.

Browser checks use the real local site and a separate synthetic API fixture. They cover desktop rendering, the nine-step car search, refresh persistence, pricing handoff, a 390px mobile viewport, inquiry save/contact handoff, dialog focus restoration, and a stalled response body followed by an editable retry. The fixture never forwards a real lead or opens a payment transaction.

The static asset checker follows local HTML resources, CSS `url()` values and literal JavaScript imports. Computed imports and remote resource availability are outside that check. Its deployment patterns cover the current `.vercelignore` rules.

## Operating the new worker

See [implementation-operations.md#lead-notification-recovery](implementation-operations.md#lead-notification-recovery) for configuration, exit status, downstream deduplication and exhausted-row review. It uses the existing schema. It does not backfill leads that were never queued, and installing the command does not activate a destination or scheduler.

## Next useful work, in order

| Priority | Project | Concrete next step and dependency |
| --- | --- | --- |
| 1 | Connect lead notifications and unattended recovery | Choose the actual notification destination, verify a synthetic durable receipt, then connect a scoped scheduler and alert on nonzero worker exits. The October 2 operations record reported no configured connection; live account state was not re-read by this audit. |
| 2 | Close measurement delivery | Reconcile the existing analytics collector and `analytics:dispatch` scheduler with actual account configuration. Review existing PR #95 (Vercel Web Analytics) before adding another analytics implementation. Preserve current consent and customer-data boundaries. |
| 3 | Reuse the completed quote worksheet and guide drafts | Continue the existing national SEO backlog with the private quote worksheet and the three guide drafts. They already have generators/governance and useful tests. Promote specific assets through their recorded release requirements; avoid starting a duplicate tool. |
| 4 | Document one client case | Supply one consented transaction with evidence, comparable pricing, fee treatment and redaction. It can support the existing service explainer, founder authorship and guide links without inventing savings. |

The existing [national SEO backlog](seo/2026-10-01-national-seo-backlog.csv), [October 2 pricing/measurement record](openai-ads-cro-2026-10-02.md), and [release checklist](release-readiness.md) remain the authoritative launch records. Existing public copy retains its October 1 owner approval.

## Change footprint

Most HTML changes only refresh the content hash of the shared script. City files were regenerated, and the pinned Austin legacy SHA was updated with its changed cache URL. Service prices, public routes, sitemap/indexing decisions, Google tag ownership and historical payment behavior retain their existing contracts. The new PostgreSQL test dependency is development-only. Review assets live in `.lavish/`, which is excluded from deployment.
