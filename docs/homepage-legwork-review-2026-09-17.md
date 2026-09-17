# Homepage legwork copy review — September 17, 2026

Local implementation only. No deployment or publication approval is recorded by this change. Follow `docs/claim-review-workflow.md`; the homepage remains `active_review_required` in `data/content-inventory.csv`.

## Outreach volume

**CLM-029 proposed exact wording:** “Every plan includes outreach to dozens of dealers.”

Source: the business owner's September 17, 2026 task instruction: “The business owner confirms that every plan includes outreach to dozens of dealers.” This confirms an operating fact for all plans. It does not approve exact public wording or supply a reproducible volume packet.

The proposed sentence is absent from homepage copy, SVG text, accessible descriptions, metadata, and schema. Before using it, attach dated outreach records for each plan and a counting note (unique dealers versus locations or repeat inquiries, population, period, inclusions/exclusions, and limitations). A named claims reviewer must approve exact wording and record review and expiry dates. `approved_copy` remains blank.

Bounded page copy: “We use your brief to research vehicles and contact participating dealers. Their replies shape the options you review.” The branching storefront illustration represents outreach and returning replies, without a numeric count or a promise of response. Existing scope references: `schedule.html#consultation`, `data/services.json`, CLM-022 and CLM-023. It does not represent a guaranteed number of options, dealer relationships, or inventory coverage.

Repository search found no existing approval of this outreach-volume wording. The “dozens of options” checkout observation in `docs/seo-release-preparation-2026-09-05.md` describes a different deliverable claim and provides no approval for this one.

## Compare and negotiate

Bounded page copy: “We compare available offers and discuss price and fees with sellers, with email negotiation where available.” Sources: `schedule.html#consultation` lists email negotiation where available; `schedule.html#full-service` lists price negotiation and fee review. The scope record remains observed, pending approval.

The graphic uses two neutral illustrative offers with price and fee placeholders. Neither is ranked, selected, or labeled best; no savings, discount, lowest price, or guaranteed result is shown.

## Coordination scope

**CLM-030 bounded local draft:** “We help clarify what comes next. You review the paperwork, sign, and decide whether to buy.” Adjacent scope note: “Ultimate Concierge: delivery coordination where available. Confirm paperwork and pickup support for your plan.”

`schedule.html#concierge` explicitly lists “Delivery coordination where available.” `data/services.json` also places expanded transaction coordination and conditional delivery coordination under Ultimate Concierge. Neither source establishes paperwork handling or pickup coordination for every plan. The records are observed scope, not exact-copy approval. Prices and plan pages are untouched.

The checklist is labeled “For your review,” with empty boxes for “Read the terms” and “Your decision,” and an unsigned line labeled “Your signature.” The map says “Pickup.” A single stationary document gains its review items and blank signature line, then the location appears; motion never signs or checks off the buyer's purchase decision. Its accessible description also states that paperwork and pickup support need confirmation for the buyer's plan.

Awaiting business owner/operations confirmation: which plans include paperwork assistance or pickup coordination, what that assistance entails, and seller/location limits. Do not strengthen the draft into an included-benefit promise until those facts and the exact wording are approved with reviewer and expiry fields. No approval has been inferred from service availability or from this UI request.

## Locations and release boundary

- `index.html#how-it-works`: heading, outreach and comparison copy, all three SVG titles/descriptions, and the existing `/#conversation` CTA.
- `index.html#legwork-coordinate`: buyer responsibilities and adjacent plan limitation.
- `data/claims.csv`: CLM-029 and CLM-030; approval fields intentionally blank.
- `data/content-inventory.csv`: homepage review state retained and this packet linked.

No metadata, JSON-LD, pricing, checkout copy, or other page is changed. All new process copy is a bounded local draft for review, not an approved commercial commitment.
