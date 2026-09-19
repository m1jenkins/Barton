# SEO-05 — first three guide preparation

Prepared and verified locally September 18, 2026 (America/Los_Angeles). The final SEO-09 boundary review moved all new editorial revisions into deployment-excluded private artifacts.

- Task status: `ready_for_review`.
- Local implementation: `verified_local`.
- Publication dependency: `waiting_for_evidence` — exact author acceptance and accountable qualified review remain absent.
- Starting revision: `3bf03f6288a16b578e49cb1375254c7285a70855`.
- Scope: three private proposed guides, exact-copy/source packets, and a loopback preview. No publication, indexing release, outreach, or approval occurred.

## Private proposed revisions

| Private artifact | Implemented improvement | Release eligibility / exact packet |
| --- | --- | --- |
| [`blog-buy-new-car-below-msrp.html`](../../draft-artifacts/guides/blog-buy-new-car-below-msrp.html) | Added a double-counting check for included discounts/rebates; retained written quote and counteroffer templates, hypothetical arithmetic, and separate financing/trade comparison | Not eligible for public deployment or indexing; [consumer-finance/advertising review packet](SEO-05-msrp-review.md) |
| [`blog-dealership-addons-complete-guide.html`](../../draft-artifacts/guides/blog-dealership-addons-complete-guide.html) | Added unknown-term/awaiting-information states and a hypothetical deductible-basis question; retained product questions and pre-interest arithmetic | Not eligible for public deployment or indexing; [finance/insurance/warranty review packet](SEO-05-addons-review.md) |
| [`blog-used-car-inspection-checklist.html`](../../draft-artifacts/guides/blog-used-car-inspection-checklist.html) | Added the national DOJ NMVTIS public-provider route and mechanical/safety inspection distinction; retained observation worksheet and hypothetical example | Not eligible for public deployment or indexing; [mechanical/safety/consumer-law review packet](SEO-05-inspection-review.md) |

These private files are byte-for-byte identical to the initial September 18 proposals, so their review-packet SHA-256 values remain unchanged. They use September 18 visible draft/source-check dates matching BlogPosting `dateModified`. They retain original-article attribution, AI-assisted revision disclosure, pending author/qualified review, visible warnings, `noindex, follow`, and draft schema status. Their source canonical URLs describe the intended future public location only.

The existing `draft-artifacts` exclusion in `.vercelignore` prevents all three proposed bodies from shipping with the core offer release. Neither noindex nor an existing public draft route supplies authorization for these new editorial revisions.

## Public-root boundary

Each root guide was restored from the starting revision, preserving its **September 5 editorial copy, source-check date, visible draft date, and schema date**. The only editorial change from that revision is one authorized commercial CTA paragraph naming Full Service at **$295 USD** and Ultimate Concierge at **$895 USD** as one-time service fees, separate from vehicle/third-party costs. SEO-03 additionally relocates the unchanged GTM bootstrap after blocking CSS in each root template. The three starting files had no AI landing-page acquisition link to replace.

| Root file retained for the core candidate | SHA-256 after authorized CTA and SEO-03 template updates |
| --- | --- |
| [`blog-buy-new-car-below-msrp.html`](../../blog-buy-new-car-below-msrp.html) | `24d754838e7e464d4177bb79250aa7765193214cd76ffd388c1c0747191d5e00` |
| [`blog-dealership-addons-complete-guide.html`](../../blog-dealership-addons-complete-guide.html) | `27b9174aff9ef9d7ca7556599b7766e634a6504f0c3eec76bd11c16258193ae5` |
| [`blog-used-car-inspection-checklist.html`](../../blog-used-car-inspection-checklist.html) | `82434f662e47a7bdb6a5374aebd5f488041b27eee739dab778c90532b2d4fc68` |

All roots remain `noindex, follow`, pending-review schema, and outside the sitemap. Existing draft discovery links continue to reach those prior root drafts; no public site link reaches the new private proposals. The editorial diff from the starting revision is **three authorized CTA paragraph replacements across three files**. SEO-03 also moves the same GTM bootstrap after CSS in each root template. The owner fee decision is already authorized in the runbook; live checkout cutover remains SEO-01/09 work.

## Source integration

Ten existing primary sources were rechecked on September 18. The new source is [DOJ/BJA's approved NMVTIS provider directory](https://vehiclehistory.bja.ojp.gov/nmvtis_vehiclehistory). Supporting sections, observed publication/review dates, and limitations appear in the per-guide packets. Two FTC sources expose July 2022 publication dates previously recorded as unstated. The archived May 2022 CFPB add-on article supports the financing mechanism only, not current enforcement policy.

[SEO-05-source-registry.csv](SEO-05-source-registry.csv) contains ten replacement rows keyed by existing `SEP-*` IDs plus proposed `SEP-USED-04`. `article_url` remains the intended public canonical; notes and packets identify the **private proposed copy**. Every verification status remains `primary_source_checked_pending_qualified_review`, with no assigned approval or next-review date. This subtask did not edit shared source, claim, inventory, validator, sitemap, or common-asset files.

Coordinator integration must distinguish current root acquisition and SEO-03 template changes from the private editorial proposal. Keep `CLM-025`, `CLM-026`, and `CLM-027` pending review and point the proposed-copy evidence to the private files/packets. No approved-copy field is populated by moving an artifact.

## Private preview

Run `node scripts/preview-guides.mjs`, then visit `http://127.0.0.1:4197/`. The root redirects locally to the MSRP draft; each guide uses its normal basename on this loopback server. `DRIVE_RIGHT_GUIDE_PREVIEW_PORT` can select another port.

The server binds only `127.0.0.1`. Its explicit allowlist contains exactly three private HTML files and five existing CSS/JS assets: `styles.css`, `seo-content.css`, `script.js`, `openai-ads.js`, and `ad-consent.js`. It returns noindex/nofollow/noarchive/nosnippet, no-store, no-referrer, and a CSP blocking external resources, connections, form submission, and framing. Other pages, assets, docs/data, and API paths are deliberately unavailable; the preview is for the three exact-copy drafts, not navigation or checkout testing. Public-root link validation is separate.

## Verification

Node: `v24.20.0`.

- Initial proposal validation passed using `node scripts/validate-site.mjs` (then 64 root HTML files / 9 sitemap URLs), followed by parse5, unique IDs, one H1 each, **108 local links/fragment targets**, canonical/social/schema/date parity, service CTA, and containment checks.
- Proposal arithmetic passed: `$33,000 + $1,500 − $33,800 = $700`; `$900 ÷ 60 = $15` before interest. No example claims a customer result or predicts a repair cost.
- The exact proposed HTML was rendered locally at **1440 × 1000** and emulated **390 × 844**, with no horizontal page overflow and visible draft/status/service text. Those proposal bytes are now preserved unchanged under the private path. Initial screenshots under `/tmp/seo05-*` included the site's existing consent panel; these checks do not represent a complete accessibility or qualified-content audit.
- Final boundary verification checks byte-identical private proposal hashes, root copies equal to the starting revision plus one authorized CTA replacement and relocation of the unchanged GTM bootstrap after CSS each, September 5 root dates, unchanged noindex/schema status, no sitemap membership, and `draft-artifacts` exclusion.
- The dedicated preview receives syntax and live loopback allowlist/header/method/traversal checks. Scoped `git diff --check` passes. The coordinator runs the final complete workflow against the integrated core candidate.

## Remaining dependencies and next action

1. Integrating owner: preserve the private/public distinction in shared claim, source, inventory, status, and release records. Private proposal hashes remain the review targets; root hashes above identify candidate content with the authorized CTA and SEO-03 template changes.
2. Responsible author: accept each exact private revision with a name and date. Original attribution does not establish revision acceptance.
3. Qualified reviewers: resolve the per-page questions and provide identities, competence/jurisdiction, approved exact copy/hash, approval/expiry dates, next review, and material-change triggers. MSRP needs consumer-finance and advertising/consumer-law coverage; add-ons needs finance, insurance, and warranty coverage; inspection needs mechanical/safety and consumer-law/title coverage.
4. Publisher: only after actual approval, deliberately promote the approved private artifact to its public root and synchronize records, author/reviewer disclosure, schema, robots, sitemap, and Resources labeling in a separately authorized release. These private proposals do not prevent a valid core service/commerce release.
