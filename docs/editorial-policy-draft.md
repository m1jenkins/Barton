# Drive Right Editorial Policy

> **DRAFT — NOT APPROVED FOR PUBLICATION OR OPERATIONAL RELIANCE.** This policy requires approval from the business owner and a qualified legal reviewer. Texas legal, consumer-finance, safety, tax, title, warranty, and remedy content must also receive review from a suitably qualified subject-matter reviewer before publication.

## Purpose and scope

This draft governs public website copy, articles, local pages, structured data, social metadata, AI-generated drafts, testimonials, pricing, service descriptions, and claims used by Drive Right. Its purpose is to make every consequential or promotional statement traceable to an approved source and reviewer.

This document is an internal control, not legal advice and not a representation that existing content is accurate.

## Core standards

1. Publish for a defined reader need. A page must have a distinct intent, owner, conversion role, and lifecycle status in `data/content-inventory.csv`.
2. Prefer first-party evidence for Drive Right facts and primary authoritative sources for laws, rules, taxes, safety, finance, title procedures, incentives, and other consequential claims.
3. Separate observation, opinion, estimate, example, and guarantee. Labels and caveats must be visible where a reasonable reader encounters the claim.
4. Do not publish an absolute or universal promise such as “best,” “lowest,” “zero,” “always,” or “guaranteed” unless the claim scope is precisely defined and the evidence and qualified review support that wording.
5. Keep visible copy, metadata, structured data, checkout copy, confirmation pages, and internal data records materially consistent.
6. Never invent a customer, credential, relationship, office, service area, address, award, result, source, reviewer, or review date.

## Claim classes and required evidence

| Claim class | Minimum record | Required review |
| --- | --- | --- |
| Price, feature, availability, response time | Current owner-approved service record, effective date, and operational confirmation | Business owner; legal review when terms or remedies are implicated |
| Savings, volume, time saved, rate, or performance number | Reproducible first-party dataset, methodology, population, period, sample size, and limitations | Claims reviewer; qualified reviewer for financial or legal implications |
| Guarantee or refund | Complete approved terms, eligibility, exclusions, process, remedy, and consistent checkout/policy copy | Business owner and qualified legal reviewer |
| Testimonial or case result | Original statement, written permission, transaction evidence, calculation method, and disclosure of atypicality or material connection when applicable | Business owner and qualified legal reviewer |
| Founder or company experience | Dated ledger or other verifiable record plus an as-of date | Business owner and claims reviewer |
| Independence, kickback, commission, or relationship claim | Revenue-source attestation, relevant contracts or ledger, and defined scope | Business owner and qualified legal reviewer |
| Legal, tax, title, warranty, safety, remedy, or finance guidance | Current primary sources with jurisdiction/effective date and claim-level mapping | Qualified subject-matter reviewer |
| Local presence | Owner-confirmed physical and customer-facing facts; approved address and profile references | Business owner and local-content reviewer |
| Recommendation, ranking, or “best” list | Disclosed criteria, inputs, weighting, evaluated set, limitations, and refresh date | Editor and claims reviewer |

Claim records live in `data/claims.csv`. A blank approval field means “not approved,” not “approved by default.”

## Consequential-content release gate

Content about legal rights, taxes, title transfer, warranties, credit, lending, safety, insurance, remedies, or government procedures must not be indexable until all of the following are true:

- Every consequential statement maps to a current primary source in `data/source-registry.csv`.
- Jurisdiction, source effective date, retrieval date, and reviewer are recorded.
- A qualified reviewer has approved the exact public copy.
- The page displays an author, reviewer where relevant, published or materially updated date, and review cadence.
- The page distinguishes general education from advice for an individual situation.
- Visible links lead to the cited primary authorities.
- Metadata, structured data, excerpts, and internal links do not overstate the reviewed copy.

If any requirement lapses, set the page to the contained lifecycle state, remove it from discovery surfaces, and route it through the claim workflow. Containment is a risk control, not evidence that the content is wrong.

## Authorship and review identity

Every substantive article must name a real author who accepts responsibility for the draft. Author pages and schema may include only verified credentials and experience. The organization must not be used as a substitute for a real reviewer on high-stakes content.

The review record must include reviewer name, role, relevant qualification, review date, scope, and next-review date. Do not display “reviewed by” unless the named person reviewed the exact published version.

## Pricing, offers, and service terms

`data/services.json` is the governed staging record for price and feature facts. Until its approval block is complete, values are observed current values rather than approved promises. The schedule page, checkout, metadata, articles, local pages, and confirmation pages must be checked together whenever price, service level, guarantee, or refund copy changes.

“Free consultation” must not appear unless the owner defines and approves a genuinely free offer that is distinct from the paid consultant tier. Guarantee and refund language remains pending owner and qualified legal review.

## Testimonials and quantitative outcomes

Do not publish a testimonial amount or outcome until its source, permission, calculation, and exact wording are approved. Visible copy and structured data must use the same approved amount and context. A single result must not be presented as typical.

Aggregate savings, time, customer-count, transaction-volume, lender-rate, and similar claims need an auditable calculation artifact and an as-of date. When the supporting cohort changes, recalculate the claim rather than carrying forward an old number.

## Local and entity content

`data/entities.json` defines the intended entity model: one Organization, one owner-confirmed Austin business only after address review, and eight non-location service areas. A service-area page must not create a fictional LocalBusiness, street address, map point, or local office. Each metro page needs genuinely local, verifiable decision value rather than place-name substitution.

## Structured-data and visible-copy parity

Structured data must be generated or manually checked against the same approved records used for visible copy. It must not introduce stronger claims, extra credentials, different testimonial amounts, unsupported addresses, or different prices. Schema types must match what the page visibly represents.

## AI-assisted drafting

AI may help outline, transform, or quality-check content, but it is not an authority. A human owner remains responsible for sources, calculations, claims, and publication. AI-generated citations must be opened and verified; invented or inaccessible sources invalidate the draft.

## Corrections, freshness, and removals

Provide a monitored route for correction requests. Record the affected URL, reported issue, evidence, triage owner, decision, correction date, and whether metadata/schema/excerpts also changed. Material corrections should be disclosed on the page when appropriate.

Review intervals are risk-based:

- Legal, tax, finance, safety, title, warranty, remedy, incentive, and price-sensitive content: on material change and at least every six months unless the qualified reviewer sets a shorter interval.
- Service prices, checkout links, guarantees, refunds, and SLAs: whenever operations change and at least quarterly.
- Local/entity facts and testimonials: at least annually and whenever the underlying fact changes.
- Evergreen educational content: at least annually.

Expired approval returns the claim or page to pending review.

## Publication checklist

- Page and claim IDs exist in the governed data files.
- Required evidence is archived and accessible to the reviewer.
- Reviewers and dates are recorded; no future or fabricated date is used.
- Title, description, body, CTA, schema, and linked conversion page agree.
- Sources support the exact adjacent claims.
- Page has a unique intent and is included in the internal-link plan.
- Accessibility, privacy, analytics, canonical, robots, sitemap, and rendering checks pass.
- Rollback or containment action is known.

## Approval record

| Role | Name | Decision | Date | Notes |
| --- | --- | --- | --- | --- |
| Business owner | Pending | Not approved | — | Required before adoption |
| Qualified legal reviewer | Pending | Not approved | — | Required before adoption |
| Editorial owner | Pending | Not approved | — | Required before operational rollout |

