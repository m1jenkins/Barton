# SEO-05 — new-car quote guide review packet

Prepared 2026-09-18 (America/Los_Angeles). Status: `ready_for_review`; local preparation is implemented, production publication and search release are ineligible.

- Private proposed artifact: [`blog-buy-new-car-below-msrp.html`](../../draft-artifacts/guides/blog-buy-new-car-below-msrp.html)
- Proposed future public URL: `https://www.driverightcarbuying.com/blog-buy-new-car-below-msrp.html`. This remains the source-map canonical, not publication authorization.
- Starting revision: `3bf03f6288a16b578e49cb1375254c7285a70855`
- Exact proposed file SHA-256: `885aafb6fec5dd6698e8a0c08fcf45edee61d15673232f79092a4cf0f1b45906`
- Claim family: `CLM-027`; source records `SEP-NEW-01` through `SEP-NEW-03`.
- Full approval scope: the linked HTML at this hash, including title, descriptions, schema, all article text, examples, service CTA, and authorship/review disclosure. A reviewer approving only an excerpt must identify its exact text and cannot release the whole page.

## Implemented scope

Retained the September 5 quote-request template, incentive questions, counteroffer script, hypothetical $35,000 comparison, and final-document reconciliation. Added a specific check against counting a discount or rebate twice when it is already included in the selling price. Draft/source-check dates now read September 18. The service links identify $295 USD Full Service and $895 USD Ultimate Concierge as one-time service fees, separate from vehicle and third-party costs. These fees use the owner decision in the runbook; this packet does not verify a live checkout cutover.

## Source and exact-copy mapping

All sources were retrieved again on 2026-09-18. These are source observations, not reviewer approval or legal effective dates. Refreshed machine-readable rows are in [SEO-05-source-registry.csv](SEO-05-source-registry.csv).

| Record and proposed copy location | Primary support and observed source date | Review boundary |
| --- | --- | --- |
| `SEP-NEW-01`, `#msrp`: “MSRP is the manufacturer’s suggested retail price for the vehicle with its specified features. It is different from the total purchase cost, which includes other charges.” | [CFPB, What factors into the price of a car or vehicle?](https://www.consumerfinance.gov/ask-cfpb/what-factors-into-the-price-of-a-car-or-vehicle-en-723/), opening definition and other costs; last reviewed 2023-09-12, modified 2023-09-14 | Confirm that the sticker comparison instructions avoid confusing destination/options, installed products, and total cost. No invoice-cost or typical-discount assertion is made. |
| `SEP-NEW-02`, `#request` and final documents: written out-the-door quote, availability, incentive conditions, and matching contract | [FTC, Car Dealer Ads and Promotions: Know Before You Go](https://consumer.ftc.gov/articles/car-dealer-ads-and-promotions-know-you-go), “Know Before You Go,” restrictions under low prices/discounts, and “Before You Sign a Contract”; dated July 2022 | Confirm consumer-finance and advertising treatment, conditions in the sample request, and lack of a guaranteed seller response. |
| `SEP-NEW-03`, `#compare`: APR, amount financed, loan length, total payments, and separate trade/payoff | [FTC, Financing or Leasing a Car](https://consumer.ftc.gov/articles/financing-or-leasing-car), “Before You Buy or Lease a Car,” “Factoring in a Trade-in,” and “Financing a Car”; dated July 2022 | Confirm the purchase/lease boundary and financing comparison. The double-counting check is an original worksheet instruction consistent with itemized quote review, not an agency-prescribed formula. |

Original material requiring exact-copy review includes the two quoted request scripts, the comparison fields, and the new paragraph beginning “Ask whether the quoted selling price already includes the dealer discount and rebates.” The $35,000 example is explicitly hypothetical: $33,000 + $1,500 = $34,500; $34,500 − $33,800 = $700. It excludes taxes, fees, and financing and is not a market benchmark, tax estimator, or customer result.

## Accountable approvals still missing

1. Mason, or another named responsible author, must accept the full revised draft. The existing About page supports original attribution only; it does not establish acceptance of this AI-assisted revision.
2. A named reviewer with demonstrable competence in U.S. consumer auto finance must approve the price/loan/trade comparisons, incentive handling, example assumptions, and wording.
3. A named reviewer competent in consumer advertising and relevant consumer law must review promotion eligibility and the quote/contract guidance for the intended national audience. One reviewer may cover both domains only with documented competence.
4. The editorial/claims owner must verify the fee CTA against the integrated SEO-01/04 offer and confirm that no specific discount, typical savings, or successful negotiation outcome is implied.

Questions to resolve in the review: Is the separation between an already-applied discount and a conditional rebate clear enough? Does the comparison explain its excluded costs without implying a complete out-the-door quote? Is any jurisdiction-specific qualification needed for the retained wording? Are the no-outcome-promise and original-author disclosures accurate?

The required record is currently unfilled: reviewer legal name, role, relevant qualifications and jurisdictional scope, exact approved text or file hash, approval date, expiry date, next-review date, required edits, and material-change triggers. `approved_copy` remains blank. A role label or this packet is not a signature.

## Page release decision

The proposed revision exists only under `draft-artifacts/guides/`, excluded from deployment by `.vercelignore`. The root page retains its September 5 editorial copy and dates, with the separately authorized $295/$895 service CTA update as its only editorial change. SEO-03 additionally moves the unchanged GTM bootstrap after blocking CSS in the root template. Existing discovery links reach that prior root draft, not this new proposed copy. Noindex alone does not authorize shipping the proposed revision.

Keep `noindex, follow`, visible editorial warning, pending-review BlogPosting status, and sitemap exclusion. No accepted current author or reviewer is asserted in schema. Existing owner-authorized draft discovery links remain labeled drafts; no new indexable promotion is authorized.

After real approvals are recorded, the publisher must bind the approved revision/hash, deliberately promote that exact private artifact into the public root, update the claim/source/inventory records, synchronize visible author/reviewer dates and schema, remove noindex for this page only, add its canonical sitemap entry, and replace its Resources draft label. Run validation and rendered checks against that exact candidate before a separately authorized activation. Recheck on changes to offer, finance/advertising guidance, example method, authorship, or source support and at least every six months after approval.

Local check evidence is recorded in [SEO-05.md](SEO-05.md). Nothing in this packet records production verification.
