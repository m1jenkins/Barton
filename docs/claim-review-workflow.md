# Drive Right Claim Review Workflow

## Objective

Move claims from observation to approved publication through a traceable evidence and review process. This workflow applies to visible copy, metadata, schema, checkout and confirmation copy, testimonials, local pages, and AI-generated drafts.

## Status vocabulary

- `observed`: present in the repository but not evaluated.
- `pending_evidence`: evidence owner or methodology is incomplete.
- `pending_owner_confirmation`: a business or operational fact needs owner confirmation.
- `pending_qualified_review`: source material exists or is being collected but a qualified reviewer has not approved the exact copy.
- `conflicts_with_current_offer`: page copy disagrees with the governed observed pricing or service record.
- `contained_pending_qualified_review`: removed from search/discovery while consequential review is incomplete.
- `revise_to_bounded_language`: the underlying idea may be usable but an absolute or universal construction is not approved.
- `do_not_publish_without_proof`: claim must remain absent unless the stated evidence and review gate are satisfied.
- `approved`: exact wording, scope, evidence, reviewer, approval date, and expiry are complete.
- `retired`: no longer used; historical evidence and decision are preserved.

Only `approved` claims may be intentionally introduced or expanded. An existing claim in another status is not grandfathered.

## Roles

- **Business owner:** confirms service, price, customer, revenue, relationship, experience, address, and operating facts.
- **Editorial owner:** maintains inventory, scopes pages, verifies claim-to-source mapping, and coordinates synchronized edits.
- **Claims reviewer:** checks calculations, samples, scope, phrasing, and visible/schema parity.
- **Qualified reviewer:** reviews high-stakes legal, tax, finance, safety, title, insurance, warranty, or remedy claims within their competence.
- **Publisher:** applies only the exact approved version and records deployment evidence.

One person may fill multiple roles only when qualified, but owner confirmation does not replace independent qualified review for high-stakes content.

## Workflow

### 1. Intake and inventory

Create or update the row in `data/claims.csv` before editing public copy. Record:

- Stable claim ID and exact observed wording.
- Claim class and all known locations, including JSON-LD and metadata.
- Conflict, risk, owner, required evidence, and current status.
- Related page lifecycle in `data/content-inventory.csv`.

Search the whole repository for variants, numbers, superlatives, schema values, and CTA wording. Treat materially equivalent wording as the same claim family unless separate scopes require separate records.

### 2. Classify risk and choose the release gate

Use the strictest applicable class:

- **High stakes:** legal, tax, credit, lending, insurance, safety, title, warranty, rights, remedies, or government procedure. Contain until primary sources and qualified review are complete.
- **Commercial commitment:** price, service level, guarantee, refund, availability, checkout, or deliverable. Require owner/operations approval and legal review when terms or remedies are involved.
- **Outcome or experience:** savings, rates, time, volume, win rate, “best,” “lowest,” “zero,” or customer result. Require reproducible evidence and bounded wording.
- **Entity/local:** name, address, office, service area, credential, or relationship. Require owner proof and schema-visible parity.

### 3. Build the evidence packet

For first-party claims, archive the source data and a reproducible calculation note containing population, inclusions/exclusions, date range, sample size, formula, limitations, preparer, and preparation date.

For external claims, add claim-level rows to `data/source-registry.csv`. Prefer current primary authority. Record jurisdiction, effective date, retrieval date, source title and URL, exact supporting section, and archive location where permitted.

For testimonials, include the original statement, written publication permission, any material-connection disclosure, transaction evidence, and calculation method. Do not silently reconcile conflicting amounts.

### 4. Draft bounded public language

Draft only what the evidence supports. Define market, period, population, conditions, and limitations near the claim. Replace absolute phrasing unless exhaustive evidence truly supports it. Keep advice and examples distinct from guarantees.

The proposed exact wording goes in `approved_copy`; it stays blank until review is complete.

### 5. Review and approval

The assigned reviewer checks:

- Evidence authenticity and reproducibility.
- Exact support for the proposed wording.
- Current jurisdiction and effective date for consequential content.
- Conflicts with other claims, service terms, checkout, or policy.
- Whether a disclosure, limitation, or non-typical-results statement is needed.
- Expiry and next-review date.

Approval requires reviewer identity, review date, expiry, and exact copy. A comment, verbal assent, or checked draft without those fields is not approval.

### 6. Publish as one synchronized change

Update every recorded location in the same release: body copy, title/description, Open Graph, schema, article hub excerpt, local-page variant, CTA, schedule/checkout, confirmation page, and policy where relevant. Generate structured content only from approved record fields when practical.

After deployment, verify rendered visible copy, JSON-LD, canonical, robots, sitemap, internal links, mobile layout, and conversion path. Save the deployment or verification reference in the claim record or linked release log.

### 7. Monitor, expire, correct, or retire

Before `expires_on`, revalidate evidence and wording. A changed price, source, law, service process, testimonial permission, or address triggers immediate review. If support lapses, contain or remove the claim first, then investigate.

For a correction, record what changed and search all variants again. Retired claims keep their evidence and rationale but must be removed from public and structured surfaces.

## Contained editorial archive and draft hubs

All legacy `/blog-*.html` articles remain in `contained_pending_qualified_review`. They are preserved at their existing URLs with a visible editorial-status warning, `noindex, follow`, no sitemap membership, and no cards on the public resource hub. The four legal URLs called out in the initial containment gate must not redirect merely to hide unresolved claims:

- `/blog-texas-title-transfer.html`
- `/blog-texas-car-buying-laws.html`
- `/blog-spot-delivery-scam.html`
- `/blog-private-party-vs-dealership.html`

Five new consequential resource hubs also remain contained until their source-registry rows include claim-level support and the appropriate qualified reviewer approves the exact text:

- `/texas-car-buying-rules-paperwork.html`
- `/auto-financing-credit-fi.html`
- `/used-car-due-diligence.html`
- `/new-car-pricing-incentives.html`
- `/vehicle-selection-total-cost.html`

`/how-it-works.html` and `/texas-local-market-intelligence.html` may remain indexable only while their language stays bounded, their entity representation remains truthful, and no unreviewed consequential claim is introduced. Reindexing is a page-specific approval action, not a bulk release of the archive.

## Acceptance checklist

- [ ] Claim row exists and all public/schema locations are listed.
- [ ] Evidence packet is reproducible and archived.
- [ ] Primary sources and jurisdiction/effective dates are recorded where required.
- [ ] Exact copy is approved by the correct reviewer(s).
- [ ] Approval and expiry dates are complete.
- [ ] No conflicting price, guarantee, testimonial, address, or outcome variant remains.
- [ ] Visible copy and schema are materially identical in meaning.
- [ ] All affected pages and conversion steps were tested after deployment.
- [ ] Monitoring owner and next-review date are assigned.
