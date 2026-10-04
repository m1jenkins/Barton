# Repository audit — October 4, 2026

The audit found recoverable failures around saved leads and incomplete static checks. This change fixes those failures, adds a notification retry worker, and records the next useful projects. The starting point was `746b5ac`; the original 225 tests passed before the audit. The resulting suite has 263 passing tests. The owner then authorized implementation of the follow-ups and a push/merge to main.

## Scope and findings

Reviewed the root marketing pages, both page styles, the guided car search, pricing inquiry, checkout/receipt/onboarding boundaries, lead and analytics queues, SQL schema, deployment exclusions, redirects, content release records, private generators, guide drafts and quote worksheet. Live Vercel project configuration and the enabled analytics script were read; customer records and payment transactions were not exercised. The existing offer, historical receipt and SEO tests passed.

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
- `npm test`: **263 passed**, zero failures or skips; **38 additional tests** over the baseline.
- `npm run check:js`: **82** JavaScript files; `check:api`: **34**; `check:buying`: **16** browser files plus site validation.
- `node scripts/validate-site.mjs`: **66** root HTML files, **13** sitemap URLs and **587** local resource references.
- `npm run check:metros` and `npm run check:cities`: **4** metro drafts and **20** city drafts plus their hub match their generators.
- `node scripts/check-redirects.mjs --config-only`: **16** permanent redirect rules retained.
- `git diff --check`: passed.

Notification tests execute the production SQL against PostgreSQL via the dev-only PGlite runtime and the existing committed schema. They cover backoff, stable downstream idempotency keys, oldest-first bounded claims, active/expired leases, exhausted attempts, late acknowledgements and private-error handling. Interleaved workers are exercised; a physical multi-connection PostgreSQL stress test is outside this local test harness.

Browser checks use the real local site and a separate synthetic API fixture. They cover desktop rendering, the nine-step car search, refresh persistence, pricing handoff, a 390px mobile viewport, inquiry save/contact handoff, dialog focus restoration, and a stalled response body followed by an editable retry. Follow-up browser checks cover the public worksheet arithmetic, unknown-incentive scenarios, a downloaded CSV, 390px guides/tool, table/anchor navigation and updated measurement controls. The fixture never forwards a real lead or opens a payment transaction.

The static asset checker follows local HTML resources, CSS `url()` values and literal JavaScript imports. Computed imports and remote resource availability are outside that check. Its deployment patterns cover the current `.vercelignore` rules.

## Operating the new worker

See [implementation-operations.md#lead-notification-recovery](implementation-operations.md#lead-notification-recovery) for configuration, exit status, downstream deduplication and exhausted-row review. It uses the existing schema. It does not backfill leads that were never queued. The protected Vercel cron now schedules both bounded workers, but it cannot deliver to missing destinations.

## Follow-up implementation

| Suggested project | Result and remaining dependency |
| --- | --- |
| Unattended lead recovery | Protected daily Vercel cron added; production-only secret configured. Actual notification destination and a provider credential are still absent. Failed/exhausted runs surface in cron history and generic function logs; external alerts need a real destination. |
| Measurement delivery | Existing PR #95 reviewed; consented, filtered Vercel page measurement implemented without its stale snippet/package changes. Analytics retry gains private error handling, settled delivery outcomes and PostgreSQL checks. The purchase collector URL/credential and destination reconciliation are still absent. |
| Guides and quote worksheet | Three prepared revisions are released at their existing URLs and a new free worksheet is published at `/compare-car-quotes.html`. Resource discovery, Article data, current design, primary source checks, owner release record, inventory and sitemap are complete. The worksheet has no quote capture, GTM or analytics. |
| Client case | Approved testimonials remain available. No underlying transaction records were supplied for a richer comparable-price/fee case; no new evidence or savings breakdown was invented. |

See [resource-release-2026-10-04.md](resource-release-2026-10-04.md) and the scheduler/website-measurement sections in [implementation-operations.md](implementation-operations.md). The outstanding account destinations and client records were requested while independent implementation continued.

## Change footprint

Most HTML changes only refresh the content hash of the shared script. City files were regenerated, and the pinned Austin legacy SHA was updated with its changed cache URL. Service prices, existing public routes, Google tag ownership and historical payment behavior retain their existing contracts. The four explicitly released resources are individually indexable; other containment decisions remain intact. The new PostgreSQL test dependency is development-only. Review assets live in `.lavish/`, which is excluded from deployment.
