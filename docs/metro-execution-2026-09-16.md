# Metro foundation execution — September 16, 2026

This implements the foundation and a private Texas pilot. The two original metro plans are copied byte-for-byte from the supplied intake snapshots; this dated record carries subsequent instructions and execution decisions.

## Authority and boundaries

Barton is the separate project, with authoritative source `/Users/user/Documents/GitHub/Barton` and remote `https://github.com/m1jenkins/Barton.git`. Work began in an isolated Barton worktree at `a05bbf91f6c79ee18b98801f46bfac0f428a1ee8`. FirstMate owns project registration and final merge. No GameTime work, production deployment, redirect, indexing submission or paid research occurred.

The captain said “i approve all pages, do not wait for my approval”; “They can do everything in all states/cities”; and “Use existing reviews on the website now. There might be some in the codebase if not present”. `data/metro-release.json` records this nationwide current-tier availability and page/merge sign-off once. It is not missing owner approval. It does not supply exact operating commitments, claim proof, customer permissions, qualified review or analytics exports. Project-wide yolo remains off; the task's approval does not change that setting.

## Files and local workflow

- `data/metro-release.json`: 20 candidate MSAs, five additional Texas dossier/backlog records, all nine existing URL dispositions, and the dated authority record. Null means unknown; empty claim/source lists on untouched candidates mean research not started.
- `data/metro-dossiers.json`: DFW, Houston and Austin evidence, proposed wording, source limitations, provisional search samples, exact historical review provenance and transparent worksheet. Modules reference `sourceIds`; citation URLs and titles come only from the matching rows in `data/source-registry.csv`.
- `data/claims.csv`, `data/source-registry.csv`, `data/content-inventory.csv`: the existing governance inventories, extended with proposed claims/sources and local-only lifecycle rows. All new approved-copy fields are blank.
- `scripts/metro-release.mjs`: release eligibility and public-artifact checks, called by `scripts/validate-site.mjs`.
- `scripts/render-metro-drafts.mjs`: small static renderer. `npm run draft:metros` writes only `draft-artifacts/metros/{service-areas,dallas-fort-worth,houston}.html`; `npm run check:metros` rejects stale generated HTML, including citations changed in the source registry. Missing referenced sources or citation URLs/titles stop rendering before any drafts are written.
- `npm run preview:metros`: allowlisted loopback-only server on port 4176. Main-site references resolve to an explanatory local boundary page; no production forms, checkout links, analytics or scripts are loaded. GET/HEAD only; API/private-file requests fail. Worksheet fields have no submission or storage behavior.
- `.vercelignore`: excludes `draft-artifacts`, `docs`, `data`, `scripts`, and agent memory from automatic Vercel preview/production uploads. The existing site consumes none of these data files at runtime. Do not configure a build to copy these private artifacts into a public output directory.

Drafts preserve the established Instrument Serif/Inter, paper/sage/ink palette and quiet static layout. They include ordinary navigation, skip link, semantic headings, native details, a keyboard-scrollable comparison table and explicit labels. No new public page or `/markets` route is created. Canonical draft paths retain the proposed root `.html` convention. Service/organization schema will require approved visible facts before release; these private drafts deliberately emit no availability schema.

## Release contract

Changing a record to `approved` alone fails. The hub has its own editorial/qualified/QA reviews and reviewed artifact hash; a market approval cannot release the hub automatically. An eligible page needs concrete service/seller/pickup/response facts; query/SERP record; baseline, demand, logistics, checkout parity, editorial, qualified and QA records; at least two mapped local modules and a worksheet or permissioned case; current approved claim/source rows; matching content inventory, services and entity records; exact reviewed artifact SHA-256; and matching canonical, hub, schema and sitemap. Approval records use `{status, reviewer, reviewedOn, expiresOn, evidenceRef}`; qualified review additionally records `qualification`. References point to actual review/evidence packets, never synthetic fixtures or this implementation report. Dates and named reviewers must reflect completed work.

A release also needs `services[].marketApprovals[metroId]`, an approved service-area entity with the existing Organization provider, inventory status `approved_indexable`, and approved exact copy present in visible content. Expired/revoked/pending claims fail closed. An approved state is a checked publication input, not proof that the business, qualified reviewer or deployed QA actually accepted the page. Humans must authenticate the referenced evidence and review all copy, including metadata; software cannot certify legal adequacy or infer truth from a checked field.

All nine existing Texas HTML files are preserved by hash and remain noindexed. The sitemap still has nine entries and `vercel.json` is unchanged. Newly copying a draft to a public root path fails even with noindex. Current legacy discovery links on About, Policy, Tesla and the Texas hub are recorded at intake and may not increase; they are preserved as existing behavior, not certified release approval. No new hub may link unreleased pages. The new local-only hub has separate draft semantics and is excluded from deployment.

The production gates in `docs/release-readiness.md` still apply. Local QA does not supply production API/payment verification, qualified acceptance, live URL Inspection or analytics reconciliation. Do not mark `qa` approved from this local draft check. `data/services.json` records the captain-confirmed current-tier availability, with an explicit pointer and limits; exact commercial approval remains separate. No runtime service-eligibility bypass or nationwide checkout/public marketing change is part of this patch.

## Evidence findings and remaining needs

The scout `barton-texas-evidence-20260916` opened ten primary authorities on September 16 and supplied seven proposed claims. DFW focuses on county/emissions and seller-versus-title routing. Houston uses historical flood context with vehicle-specific title-history limitations, Harris County private-sale budget questions, and supplemental emissions context. Austin records Travis County title coordination and I-35 closure planning. Shared statewide rules are not proof of distinct local demand.

Tarrant's title FAQ includes out-of-state safety-inspection wording inconsistent with TxDMV's non-commercial 2025 change. The checklist is not copied; a qualified reviewer must resolve applicability/currentness. Harris County's older vehicle-age wording is also excluded. Sources are traceable observations, not qualified approval. Source dates are retained separately from retrieval dates.

Current homepage/code searches found no current named review section. Historical Michael R., Sarah K. and David L. statements were recovered at commit `5ef774f6b0449c167c175d0781554fbc0a803b3d`, with exact source links in the dossiers. Historical city labels do not prove transactions. Permission, original platform/date, material connections and transaction/calculation evidence were not found. CLM-004/005 retain conflicting Michael savings amounts; no amount is chosen. Drafts use a blank comparison worksheet, not a fabricated case or reattributed testimonial.

Five-result query samples per pilot are provisional and not metro-geolocated/mobile. Google browser attempts encountered an unusual-traffic challenge. No ranks, demand volume or AI-panel results are claimed. Actual GSC, GA4, qualified inquiry/purchase and backlink baselines remain null. Use `metro-baseline-template.md` before release or redirect review.

The one existing FirstMate decision task `barton-metro-release-evidence-20260916` owns remaining qualified exact-copy review, review provenance/customer proof, operating-detail evidence and actual analytics/access work. It does not ask the captain to approve pages or nationwide availability again. No duplicate decision task is needed.

## URL preservation and maintenance

`data/metro-link-inventory.csv` captures repository anchor counts for all nine old Texas URLs (including self-links), not external backlinks. Reproduce with `node scripts/inventory-metro-links.mjs`; do not regenerate the approved baseline merely to silence a new-link validation error. DFW has 58 Dallas, 50 Fort Worth and 50 Arlington anchors across 48 source files each at intake. Preserve these URLs until real traffic/backlinks are captured and a reviewed destination exists. No redirect is applied here.

The original release and editorial workflows remain authoritative. Refresh sources before publication and at material changes. The baseline template includes 30/60/90-day decisions; no invented targets or page scores are assigned.

## Implementation verification

See `draft-artifacts/verification/README.md` and its three preview screenshots. Node 24 clean install, site/API checks, 96 tests (42 focused release/renderer/preview cases), deterministic draft check, whitespace check and original-artifact comparison passed locally. The new GitHub workflow runs these checks on pull requests and main. CI has not run until the implementation is pushed through no-mistakes. The existing sharp audit advisory is recorded in the verification note; no unrelated dependency upgrade is included.
