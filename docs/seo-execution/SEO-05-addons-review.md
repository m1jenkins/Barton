# SEO-05 — dealer add-on guide review packet

Prepared 2026-09-18 (America/Los_Angeles). Status: `ready_for_review`; local preparation is implemented, production publication and search release are ineligible.

- Private proposed artifact: [`blog-dealership-addons-complete-guide.html`](../../draft-artifacts/guides/blog-dealership-addons-complete-guide.html)
- Proposed future public URL: `https://www.driverightcarbuying.com/blog-dealership-addons-complete-guide.html`. This remains the source-map canonical, not publication authorization.
- Starting revision: `3bf03f6288a16b578e49cb1375254c7285a70855`
- Exact proposed file SHA-256: `70c05c3884d5bd64508d3473ee7f0e42b33c609982e687bf6300fc91cb464b0d`
- Claim family: `CLM-026`; source records `SEP-ADD-01` through `SEP-ADD-04`.
- Full approval scope: the linked HTML at this hash, including title, descriptions, schema, all product questions, examples, service CTA, and authorship/review disclosure. Approval of a limited excerpt is not whole-page approval.

## Implemented scope

Retained the September 5 product questions, optional-product distinction, written-term comparison, financed-cost example, and restrained cancellation guidance. Missing terms now read “unknown,” with an “awaiting information” decision state. Added an explicitly hypothetical deductible example to show what to ask before accepting a contract. Draft/source dates now read September 18. Service links identify $295 USD Full Service and $895 USD Ultimate Concierge as one-time fees separate from vehicle and third-party costs, using the owner-approved offer decision. Live checkout parity belongs to SEO-01/09.

## Source and exact-copy mapping

All sources were retrieved again on 2026-09-18. Refreshed rows are in [SEO-05-source-registry.csv](SEO-05-source-registry.csv). Source dates below do not imply a law's effective date.

| Record and proposed copy location | Primary support and observed source date | Review boundary |
| --- | --- | --- |
| `SEP-ADD-01`, `#itemize`: extended warranties, GAP, and credit insurance are generally optional; ask lender for a written claimed requirement | [CFPB, Am I required to purchase an extended warranty, GAP, or credit insurance?](https://www.consumerfinance.gov/ask-cfpb/am-i-required-to-purchase-an-extended-warranty-or-guaranteed-asset-protection-gap-insurance-from-a-lender-or-dealer-to-get-an-auto-loan-en-807/), opening answer and optional-product questions; reviewed 2024-03-05, modified 2024-03-11 | Review national scope and the distinction between a loan add-on and already-installed equipment. The draft does not claim that every seller must accept a requested price or remove every package. |
| `SEP-ADD-02`, `#products`: GAP “may cover some or all of the difference between a vehicle’s cash value and the remaining loan or lease balance after a covered theft or total loss” | [CFPB, What kind of auto insurance options are available when financing a car?](https://www.consumerfinance.gov/ask-cfpb/what-kind-of-auto-insurance-options-are-available-when-financing-a-car-en-731/), “GAP insurance”; reviewed 2024-03-08, modified 2024-10-07 | Qualified insurance review of cash-value/loan-balance wording, exclusions, deductibles, negative-equity questions, and alternatives. No guaranteed full payoff or equivalence of different products. |
| `SEP-ADD-03`, `#products`: service contract/warranty distinction, possible overlap, exclusions, deductibles, administrator, and repair authorization | [FTC, Auto Warranties and Auto Service Contracts](https://consumer.ftc.gov/articles/auto-warranties-and-auto-service-contracts), “Differences” and “Facts About Auto Service Contracts”; dated April 2024 | Qualified warranty review of all contract questions. The invented $100 deductible note illustrates a missing term and states no actual product rule. |
| `SEP-ADD-04`, `#cost`: financed add-ons can incur interest and payments may continue after benefits expire | [CFPB, Overcharging for add-on products on auto loans](https://www.consumerfinance.gov/archive/blog/overcharging-for-add-on-products-on-auto-loans/), opening financing/benefit-period discussion; published 2022-05-02, archived | Used only to explain a financing mechanism. The archive does not establish current enforcement policy, automatic refunds, or a buyer's individual remedy. |

Original comparison fields, product-selection questions, and cancellation questions require exact-copy review. The existing arithmetic is independently reproducible: $900 ÷ 60 = $15 per payment **before interest**. It is not a loan quote. The new $100 example expressly identifies an unknown per-visit/per-repair basis and is not a typical deductible or provider claim. No markup percentage, universal product value, tax estimate, or savings benchmark appears.

## Accountable approvals still missing

1. Mason, or another named responsible author, must accept the full revision; original attribution is not acceptance.
2. A named consumer-finance reviewer must approve optional-product language, financed cost, comparison assumptions, and restrained cancellation/refund wording.
3. A named reviewer with relevant insurance competence must approve GAP wording and related product questions for the national audience.
4. A named reviewer competent in auto warranty/service-contract terms must approve the product distinctions, exclusions, deductible example, authorization, and cancellation questions. One person may fill multiple roles only with documented competence.
5. The claims/editorial owner must confirm exact CTA fee/scope parity with integrated SEO-01/04.

Review questions: Could “generally optional” be misread as a universal ability to remove dealer-installed equipment? Does the draft adequately separate GAP products from auto insurance? Does any cancellation sentence imply an unsupported refund or monthly-payment change? Does “financed total” need a clearer lender-provided definition? Are the hypothetical examples and unknown fields unambiguous?

Missing approval fields: reviewer legal name, role, qualifications and jurisdictional competence, approved exact text/file hash, approval date, expiry, next review, required edits, and material-change triggers. `approved_copy` remains blank. Source retrieval and this packet do not fill these fields.

## Page release decision

The proposed revision exists only under `draft-artifacts/guides/`, excluded from deployment by `.vercelignore`. The root page retains its September 5 editorial copy and dates, with the separately authorized $295/$895 service CTA update as its only editorial change. SEO-03 additionally moves the unchanged GTM bootstrap after blocking CSS in the root template. Existing discovery links reach that prior root draft, not this new proposed copy. Noindex alone does not authorize shipping the proposed revision.

Keep `noindex, follow`, editorial warning, pending-review schema status, and sitemap exclusion. Preserve the existing redirect from `blog-dealer-addons-exposed.html`; it does not establish review. Keep existing permitted discovery links labeled as drafts. Do not add accepted authorship or reviewer claims to schema yet.

After real approvals, deliberately promote the approved private artifact into the public root and synchronize records, visible author/reviewer/date fields, schema, robots, the canonical sitemap entry, and the Resources label for this page only. Revalidate the exact approved candidate before separate activation. Recheck when product terms, source guidance, offer, example method, or authorship changes and at least every six months after approval.

Local verification is in [SEO-05.md](SEO-05.md); production behavior was not verified by this packet.
