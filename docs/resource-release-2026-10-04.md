# Resource release — October 4, 2026

The owner requested: “Do whatever you need to do to take this across the finish line and implement your suggestions. When you're done, push and merge to main.” This authorizes the audit's proposed guide and worksheet publication. It is a new owner-directed release; the October 1 approval did not publish the separate private previews. No specialist review, new credentials, customer records or new customer outcomes are attributed to this instruction.

## Released URLs

| URL | Implementation |
| --- | --- |
| `/blog-buy-new-car-below-msrp.html` | Existing URL, updated quote request and comparison guide in the current design. |
| `/blog-dealership-addons-complete-guide.html` | Existing URL, written product/coverage/cost questions and bounded examples. |
| `/blog-used-car-inspection-checklist.html` | Existing URL, observations, records and questions for an independent mechanic. |
| `/compare-car-quotes.html` | New free worksheet: cents arithmetic, unknown costs, conditional incentives, print and CSV. |

These four resources are individually indexable, self-canonical and in the sitemap. The resource hub and relevant topic/service pages link to them through ordinary anchors. Other city, archive, legal and Tesla FSD indexing/redirect decisions remain unchanged. The guide content builds on the archived AI-assisted revisions, retains Mason's original authorship, uses the actual update date, links primary sources and labels invented examples. The inventory and CLM-025–027 reflect this release without claiming a qualified third-party review.

The guide wrappers reuse the site's current header/footer, self-hosted fonts and palette. `buying/resources.css` provides a reusable reading layout. The private guide files are archived hand-authored previews, not outputs of a guide generator. They remain excluded from deployment.

## Source check

The source-linked statements were checked against these official pages on October 4. The unavailable FTC financing page was replaced with the CFPB auto-loan comparison page. No dealer statistics, savings rates, legal deadlines, tax rates or promises were added.

- [FTC: dealer ads and written out-the-door quotes](https://consumer.ftc.gov/articles/car-dealer-ads-and-promotions-know-you-go)
- [CFPB: components of vehicle price](https://www.consumerfinance.gov/ask-cfpb/what-factors-into-the-price-of-a-car-or-vehicle-en-723/)
- [CFPB: compare auto loan offers](https://www.consumerfinance.gov/ask-cfpb/how-do-i-compare-auto-loan-offers-what-should-i-look-at-besides-the-monthly-payment-en-753/)
- [CFPB: optional extended warranty, GAP and credit insurance](https://www.consumerfinance.gov/ask-cfpb/am-i-required-to-purchase-an-extended-warranty-or-guaranteed-asset-protection-gap-insurance-from-a-lender-or-dealer-to-get-an-auto-loan-en-807/)
- [CFPB: vehicle insurance options](https://www.consumerfinance.gov/ask-cfpb/what-kind-of-auto-insurance-options-are-available-when-financing-a-car-en-731/)
- [FTC: warranties and service contracts](https://consumer.ftc.gov/articles/auto-warranties-and-auto-service-contracts)
- [CFPB: financed add-on periods and refunds](https://www.consumerfinance.gov/archive/blog/overcharging-for-add-on-products-on-auto-loans/)
- [FTC: independent used-car inspections and Buyers Guides](https://consumer.ftc.gov/articles/buying-used-car-dealer)
- [NHTSA: VIN recall lookup and limitations](https://www.nhtsa.gov/recalls)
- [DOJ: approved NMVTIS report providers](https://vehiclehistory.bja.ojp.gov/nmvtis_vehiclehistory)
- [TxDMV: Title Check](https://www.txdmv.gov/motorists/buying-or-selling-a-vehicle/title-check-look-before-you-buy)

## Worksheet boundaries and evidence

The public worksheet and private preview share `buying/quote-worksheet.js`. Costs are parsed into integer cents; blank is unknown, not zero. Included incentives are counted once; unconfirmed eligibility produces scenarios rather than a final comparison. Both quotes must be complete and the visitor must confirm comparable terms. Exports retain the hypothetical origin when examples are loaded. The page has no GTM, OpenAI, Vercel analytics, session replay, quote API or persistent input storage. Its standard navigation can take a visitor to other pages, which have their own measurement controls.

Existing calculation/export tests and new public-resource checks cover these boundaries. Browser verification covers desktop and 390px mobile views, both example states, visible calculation results, updated privacy controls and resource navigation. Technical checks protect source/schema parity, local assets, shared hashes and generated city/metro previews.

N04–N09 of the [national backlog](seo/2026-10-01-national-seo-backlog.csv) now have these implementation artifacts. Search indexing and organic results require later observation; publication is not evidence that search engines selected or ranked the pages. N11's detailed client case still needs the underlying transaction records and consent. Existing approved testimonials are preserved, with no invented financial breakdown.
