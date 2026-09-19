# SEO-06 — private quote worksheet and proof preparation

Prepared September 18, 2026 (America/Los_Angeles). Starting revision: `3bf03f6288a16b578e49cb1375254c7285a70855`; implemented in the shared working tree under disjoint ownership after SEO-05.

- Local implementation: `verified_local`.
- Task/content status: `ready_for_review`.
- Public release: `waiting_for_evidence` — responsible author acceptance and qualified consumer-finance review are missing.
- Expanded real customer stories: `waiting_for_evidence`; two labeled worked examples and precise evidence-request packets are complete.

## Implemented artifact

The usable worksheet is [`draft-artifacts/quote-comparison/index.html`](../../draft-artifacts/quote-comparison/index.html), with local-only `styles.css`, `app.js`, and `worksheet.mjs`. It compares two sets of entered USD purchase costs, never estimates tax, and requests no name, VIN, contact information, or uploads. Entries remain in tab memory, with no storage, analytics, external assets, or data submission. A local CSV download and print/save-as-PDF control preserve the result for the user.

Missing amounts remain unknown; explicit zero is distinct. Incentive rows record amount, eligibility, and whether the starting selling price already includes the incentive. Confirmed included incentives are not deducted twice. Ineligible included incentives are added back. Unconfirmed eligibility produces labeled scenarios that hold other charges fixed, never a final comparison. The user must confirm incentive combination terms and comparable vehicle/equipment/timing/terms before seeing a difference. Trade-in, down payment, loan payments, and financing interest remain separate.

The first example illustrates a $37,250 versus $36,550 entered-cost comparison. The second illustrates a $36,300/$35,300 conditional scenario versus $35,600, with no final comparison until eligibility is known. Both are explicitly hypothetical in the page and saved CSV. They are not customer proof, tax estimates, market prices, typical savings, or service results.

The responsive layout uses the site's existing navy text, blue accent, pale neutral surfaces, and simple geometry. Inputs have labels and associated validation text; native controls and focus restoration support keyboard use. Print CSS keeps both quotes together, retains disclosures, and avoids split comparison blocks.

## Preview and containment

Run `node scripts/preview-worksheet.mjs`, then open `http://127.0.0.1:4196/`. `DRIVE_RIGHT_WORKSHEET_PORT` can select another valid port. The server binds only `127.0.0.1` and serves an explicit allowlist: the page, CSS, app module, and calculation module. It returns noindex/nofollow/noarchive/nosnippet headers, no-store caching, no-referrer, and a restrictive CSP that disables connections and form submission. The HTML also carries noindex and a submission-blocking CSP.

All other paths, traversal attempts, docs/data, and API routes return 404; non-GET/HEAD requests return 405. The existing `draft-artifacts` entry in `.vercelignore` keeps the entire worksheet out of production. No public-page links, canonical URL, sitemap entry, schema publication claim, or external deployment was added.

The coordinator may add a convenience package command for the existing preview script. `npm test` already includes `scripts/_tests/*.test.mjs`, so the new regression file participates without changing the shared test script.

## Evidence and review packets

- [Exact-copy worksheet review, source mapping, and proposed registry records](SEO-06-review-packet.md)
- [Worked example / future customer-proof packet 1](SEO-06-proof-packet-1.md)
- [Worked example / future customer-proof packet 2](SEO-06-proof-packet-2.md)

Existing historical testimonial attestations in `data/metro-dossiers.json` identify privately held original statements and permission, but are explicitly for private draft use and have null approved copy. They do not establish new transaction details, expanded case permissions, comparable quote records, or either example's invented amounts. No private customer records were imported and no messages were sent.

The coordinator owns shared claim, source, inventory, package, and public-site integration. Suggested source IDs `SEO06-QUOTE-01` and `SEO06-QUOTE-02` and a private inventory/claim description are in the review packet; their statuses remain pending and public URL remains unassigned.

## Verification

Node `v24.20.0`:

- `node --check` passed for the app, calculation module, and preview script.
- `node --test scripts/_tests/quote-comparison.test.mjs`: **15 passed, 0 failed**. Covers empty versus zero, cents parsing, invalid/negative/unsafe amounts, every inclusion/eligibility case, incentive list completeness, combined totals, negative totals, comparison gating, both examples, CSV unknown/error/scenario/provenance labels, safe text export, and loopback allowlist/headers/method/traversal containment.
- Parse5 HTML inspection passed: no parse errors or duplicate IDs, one H1, all inputs labeled, noindex present, and only local asset references.
- Isolated Chrome session `worksheet`: examples produced the expected totals and conditional states; empty tax suppressed comparison; invalid input gained associated validation; adding an incentive focused its amount; Tab moved to eligibility; removal restored focus to Add. CSV was created in the page and inspected with the scenario conditions and draft disclosure. The print button invoked the browser print action.
- Browser resource entries showed only the three local worksheet assets; localStorage and sessionStorage remained empty. Reloading cleared inputs. Desktop **1440 × 1000**, mobile **390 × 844**, and narrow **320 × 800** checks showed no horizontal page overflow. Mobile screenshots were visually inspected.
- Real headless Chrome printing produced a **three-page blank worksheet PDF**. Rendered pages were inspected: quotes share a page, the comparison and disclosures remain readable, and text is not clipped. This is actual print-layout evidence; the interactive print-control action was tested separately. It does not claim a manual review of a filled real-customer printout.
- Scoped `git diff --check` passed. The coordinator will run the complete integrated workflow.

Ephemeral screenshots/PDF used for inspection are under `/tmp/seo06-worksheet-*` and `/tmp/seo06-print-v2-*`. They contain only empty or hypothetical inputs and are not deployment assets.

## Next action

Integrate the private artifact, preview command, tests, and pending governance records. Obtain a real author and qualified consumer-finance reviewer for the exact files/hashes and output method; record identities, competence, approved copy, approval/expiry dates, next review, and material-change triggers. Keep it private until those requirements pass. A core service/commerce release can proceed independently when its own gates are satisfied. A later public worksheet release must assign the final URL, synchronize approved source/author/schema information and resource placement, rerun checks, and receive activation authorization.
