# SEO-06 — private worksheet exact-copy review packet

Prepared 2026-09-18 (America/Los_Angeles). Local implementation is `verified_local`; editorial status is `ready_for_review`. Public release is ineligible pending real author acceptance and qualified consumer-finance review.

## Exact review artifact

Review the complete private page, calculation module, rendered messages, examples, CSV disclosure, and print output together. There is no public worksheet URL or canonical yet. The files below identify the proposed revision; a later byte change requires a new binding.

| File | SHA-256 |
| --- | --- |
| [`index.html`](../../draft-artifacts/quote-comparison/index.html) | `88933b4a114365f1af963a27b18b59f355c7355817c045efb84e62e5e6e19f03` |
| [`styles.css`](../../draft-artifacts/quote-comparison/styles.css) | `f1774db6759f5ce789bfeb20ab1c649f0c615b75a23168dab78c7ad62d268079` |
| [`app.js`](../../draft-artifacts/quote-comparison/app.js) | `ecee34ca4f2b11b54a55c3a87d117fe9142ab298dda5f24f4125a7ac5f8845fa` |
| [`worksheet.mjs`](../../draft-artifacts/quote-comparison/worksheet.mjs) | `439634d94935356a4e7940f33bff9af4282773164f1882b0049e8ed1ec48b909` |
| [`preview-worksheet.mjs`](../../scripts/preview-worksheet.mjs) | `ed4910d321192c4e798694a1c75475643c6003463cb9cdc42f1a885e612996cc` |
| [`quote-comparison.test.mjs`](../../scripts/_tests/quote-comparison.test.mjs) | `e2b495cd30df9ad237f77419f95ca9c81709d4ad3e6bf8576b0577784e708bf8` |

## Method to review

The worksheet adds entered vehicle price, dealer fees, selected products, quoted tax, title/registration, delivery, and other purchase costs. It does not calculate tax or source prices. Blank is unknown; an entered `0` is a recorded zero. Invalid/unsafe amounts, missing costs, unconfirmed inclusion, and an unconfirmed incentive list prevent a complete total.

| Incentive eligibility | Already included in selling price | Arithmetic |
| --- | --- | --- |
| Confirmed eligible | Yes | No second subtraction |
| Confirmed eligible | No | Subtract once |
| Ineligible | Yes | Add back |
| Ineligible | No | No deduction |
| Unconfirmed | Yes | Add back for the pre-eligibility scenario; show a second scenario if eligible |
| Unconfirmed | No | Leave the starting cost unchanged for the pre-eligibility scenario; show a second scenario if eligible |
| Any | Unconfirmed | No total or scenario because the starting-price basis is unknown |

Unconfirmed eligibility never produces a complete purchase total or a comparison conclusion. Both scenarios hold other entered charges fixed and direct the reader to request a revised quote when terms change. Combined incentives must be acknowledged separately. Comparison also requires the reader to confirm equivalent specification, equipment, timing, and terms. Trade-in, down payment, financing interest, and loan payments are excluded from these purchase-cost fields. The resulting difference is entered-cost arithmetic, not a recommendation, verified savings, or service outcome.

The CSV preserves unknown/invalid states, unresolved conditions, scenario labels, and whether the inputs started from a hypothetical example. It does not output malformed raw text as a spreadsheet formula. The page asks for no PII, transmits no entries, and uses no storage or external assets. Print retains the draft disclosure and available input/result text.

## Claim-level sources proposed for the coordinator

Sources were opened and verified on 2026-09-18. The original arithmetic method and examples are Drive Right draft editorial work, not an FTC-certified calculator.

| Proposed source ID | Private artifact / support | Primary source, section, date | Required reviewer / status |
| --- | --- | --- | --- |
| `SEO06-QUOTE-01` | `draft-artifacts/quote-comparison/index.html`: itemized written offer, actual charges, discount conditions, and quote-to-document comparison | [FTC, Car Dealer Ads and Promotions: Know Before You Go](https://consumer.ftc.gov/articles/car-dealer-ads-and-promotions-know-you-go), “Know Before You Go,” low-price/discount restrictions, and “Before You Sign a Contract”; July 2022 publication; U.S.; retrieved 2026-09-18 | Qualified consumer-finance/advertising reviewer; `primary_source_checked_pending_qualified_review`; no reviewer identity or next-review date assigned |
| `SEO06-QUOTE-02` | Purchase-cost comparison separated from financing and trade-in; no payment-based ranking | [FTC, Financing or Leasing a Car](https://consumer.ftc.gov/articles/financing-or-leasing-car), “Before You Buy or Lease a Car,” “Factoring in a Trade-in,” “Financing a Car”; July 2022 publication; U.S.; retrieved 2026-09-18 | Qualified consumer-finance reviewer; `primary_source_checked_pending_qualified_review`; no approval inferred |

Proposed claim family: **private quote comparison using entered purchase costs, explicit incentive conditions, and hypothetical examples**, class `finance_guidance`, status `pending_qualified_review`, location the four private worksheet files plus these proof packets. Evidence is this method, primary-source map, 15 automated tests, and browser/print results in [SEO-06.md](SEO-06.md). Leave `approved_copy`, reviewer identity, approval, and expiry blank. No actual customer-outcome claim should be created from either worked example.

Proposed inventory record: artifact `draft-artifacts/quote-comparison/index.html`; intent `compare_written_vehicle_quotes`; lifecycle `local_only_draft`; review `author_and_consumer_finance_review_pending`; conversion `none_while_private`; accountable editorial owner unassigned; public URL unassigned. Preserve the `draft-artifacts` deployment exclusion. The integrating owner alone updates shared registries.

## Required accountable review

- A real responsible author must accept the exact page, example, and output wording.
- A named qualified consumer-finance reviewer must approve the field definitions, incentive scenarios, treatment of unknown inputs, comparable-basis confirmation, no-tax-estimation boundary, and export/print disclosures. Have consumer-advertising/legal competence review any claimed outcome or promotional wording before public use.
- A claims/editorial reviewer must reproduce both examples and confirm that the UI does not imply a verified quote, tax rate, lender decision, or guaranteed saving.
- Before a public version is proposed, assign its real URL and integrate approved visible source links, accepted author/review information, metadata/schema where appropriate, resource placement, and claims/inventory records. None is authorized merely by a passed test or noindex tag.

The missing approval record must include legal name, role, relevant qualifications and jurisdictional scope, exact file hashes or approved text, review/approval date, expiry, next review, required edits, and material-change triggers. The existing $295/$895 service decision does not supply subject review for this worksheet. No outreach has been sent to obtain these approvals.

Review questions: Are the eligibility scenarios and already-included amounts sufficiently explicit? Does the fixed-charge assumption need stronger wording? Could a user mistake entered zero for a seller-confirmed amount? Is trade/financing separation clear? Do the comparison and CSV retain enough context when saved independently? Is the hypothetical origin clear after partial edits? Is any additional limitation needed before a national public release?

Publication decision: remain private until those questions and records are complete. Recheck on any calculation, field, example, source, export, or service-claim change and at least every six months after approval.
