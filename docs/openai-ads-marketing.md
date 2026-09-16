# Drive Right: initial ChatGPT ads brief

September 13, 2026. Draft strategy and copy; nothing has been published or scheduled and no budget has been committed.

## Recommendation

Position Drive Right as practical help turning car research into a purchase decision: vehicle research, offer comparison, and negotiation support for Texas buyers. Start with the advisor service, then test AI-assisted research as a separate offer after its landing page and commercial terms are consistent.

OpenAI recommends useful, specific creative variations with landing pages that match the advertised service. The proposed intent themes below are creative hypotheses, not promises about which conversations will trigger an ad. [OpenAI creative guidance](https://help.openai.com/en/articles/20001212)

Business basis: the local service records list research, pricing/fee review, dealer negotiation and advisory support. Current local prices are $195, $495 and $895, but public search snapshots and older records conflict. Use `availabilityConfirmation` in [the service registry](../data/services.json) for owner-confirmed coverage and its limits; operating details and exact commercial copy still need their recorded reviews. Avoid price-led ads until the landing page, Stripe checkout and service terms agree. Do not reuse unsupported savings, loan-rate reductions, customer counts, guarantees or testimonials from older copy.

## Three initial angles

| Angle | Likely need | Draft headline | Draft body | Proposed destination |
| --- | --- | --- | --- | --- |
| Compare the offers | A buyer has a shortlist or dealer quote and wants help making sense of the deal. | Car-buying advice for Texas buyers | Compare vehicle options, pricing and dealer fees with Drive Right. Get research and negotiation support for your next purchase. | `/how-it-works.html` |
| Delegate the legwork | A buyer wants a car but has little time for research and dealer conversations. | Help with the work of buying a car | Drive Right helps Texas buyers research cars, compare offers and negotiate with sellers. Explore the service that fits your search. | `/schedule.html#full-service` |
| AI-assisted research | A buyer wants options organized around a concrete vehicle brief. | Turn your car search into a shortlist | Explore Drive Right's AI-assisted car-buying research. Review organized options and available dealer outreach, with the final decision in your hands. | `/ai-car-buying-agent.html` after its offer is ready |

Alternate headlines for a second creative per angle:

- Compare: **Get help comparing your next car deal**.
- Delegate: **Car research and negotiation, with help**.
- AI research: **AI-assisted research for your next car**.

Keep the existing plan comparison CTA for now. Do not introduce a free quote-review or free consultation offer unless the business actually provides it and the landing page supports it. The homepage lead form currently proceeds into paid checkout; avoid presenting that flow as a free appointment.

## Context hints to test

Use concise descriptions of customer needs, for example:

- Comparing dealer offers and out-the-door vehicle pricing before buying.
- Choosing among new, used and certified pre-owned cars with an advisor's help.
- Delegating vehicle research and dealer negotiation during an active car search.
- Organizing a vehicle shortlist around a buyer's preferences and budget.

Context hints supplement the creative. They do not act as exact-match keywords or replace explicit geographic restrictions. Resolve supported local targeting in the actual account before launch. [OpenAI targeting documentation](https://developers.openai.com/ads/campaign-targeting)

Start with the Austin service area if the account supports a suitable restriction, then consider broader Texas coverage after confirming capacity and lead quality. Do not rely on the word “Texas” in copy or hints to prevent nationwide spending. If only broader geography is available, revisit the economics before running. Use the main service pages initially; local city templates have unresolved release status in this repository.

## Landing page priorities

1. Reconcile the current fee, included work, payment timing, upgrade credit and refund terms across each proposed destination and checkout.
2. Show what the buyer gets: a real, redacted sample comparison or deal sheet with permission, plus a short explanation of advisor responsibilities and what the customer decides.
3. Put the service area and primary CTA near the offer. State the next step accurately: compare plans, submit an inquiry, or start paid service.
4. Test the full mobile form-to-checkout path. Remove draft disclaimers from paid destinations only after the underlying questions are resolved; do not simply hide them.
5. Verify public access for OAI-AdsBot and OAI-SearchBot. Local robots rules allow access, but production CDN/firewall access remains unverified.

For imagery, use rights-cleared photos of the advisor at work or a redacted comparison sheet. Avoid invented client results and stock imagery that suggests Drive Right owns dealership inventory. No new image assets were generated or uploaded in this run.

## Bounded first experiment

An illustrative starting test is **$20/day for 14 days, $280 planned media spend**, subject to the user's budget and the account's supported minimums and spending controls. This is a proposal, not an approved or configured spend limit. Prefer a supported total cap; confirm actual pacing behavior before launch.

For a small test, begin with the comparison and delegation angles in one tightly scoped campaign, two distinct ads per angle if supported. Keep the AI-service angle for a subsequent test so limited traffic can answer one question at a time. Campaign objectives, bids, targeting values and final creative lengths must be checked against the live account controls rather than guessed.

Track each creative using a consistent destination query, for example:

`?utm_source=openai&utm_medium=paid_social&utm_campaign=drive_right_austin_pilot&utm_content=compare_v1`

Change `utm_content` per ad; keep campaign naming stable. Do not put names, email addresses, phone numbers or financial details into URLs. Platform attribution and UTM reports serve different purposes and will not necessarily match.

Judge performance by qualified inquiries and paid service engagements. A qualified inquiry should have an actionable vehicle brief, fit the confirmed service area, and indicate interest in a paid service. The initial Pixel only measures accepted leads and checkout starts; it cannot prove lead quality or paid revenue. Until CAPI is implemented, reconcile paid engagements against Stripe and the durable purchase ledger.

Use these operating metrics:

| Metric | Calculation / use |
| --- | --- |
| Lead acceptance rate | Accepted leads divided by landing visits; diagnose landing-page friction. |
| Qualified lead rate | Qualified inquiries divided by accepted leads; diagnose fit. |
| Cost per qualified lead | Spend divided by qualified inquiries; compare creative angles. |
| Paid acquisition cost | Spend divided by attributed paid engagements; assess business viability. |
| Allowable acquisition cost | Service contribution after delivery cost and desired profit; derive from real margins before scaling. |

Check event delivery and form errors as soon as the test starts. Review lead fit after the first few inquiries and results at the end of the bounded test. Pause for broken measurement or irrelevant traffic. If there are too few outcomes, report the test as inconclusive; do not declare a winning ad from clicks alone. No recurring monitor has been scheduled.

## Inputs remaining before launch

The signed-in SpurAuto account is confirmed by the advertiser as the Drive Right account, and its existing web Pixel ID is configured locally. The visitor consent controls and OpenAI privacy disclosure are implemented. Remaining inputs: account readiness; production receipt verification; a verified destination and service offer; the user's budget cap; available geographic targeting; and any required approved creative assets. The account-admin skill was used only for account discovery; no membership or logo change was needed.
