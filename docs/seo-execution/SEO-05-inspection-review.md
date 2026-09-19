# SEO-05 — used-car inspection guide review packet

Prepared 2026-09-18 (America/Los_Angeles). Status: `ready_for_review`; local preparation is implemented, production publication and search release are ineligible.

- Private proposed artifact: [`blog-used-car-inspection-checklist.html`](../../draft-artifacts/guides/blog-used-car-inspection-checklist.html)
- Proposed future public URL: `https://www.driverightcarbuying.com/blog-used-car-inspection-checklist.html`. This remains the source-map canonical, not publication authorization.
- Starting revision: `3bf03f6288a16b578e49cb1375254c7285a70855`
- Exact proposed file SHA-256: `0e393b5d401fa141feeb62aa17ef0b0fb0291d148b2c7f02a7c93b211341ba8e`
- Claim family: `CLM-025`; existing source records `SEP-USED-01` through `SEP-USED-03`; proposed `SEP-USED-04`.
- Exact approval scope: the linked file at this hash, including metadata/schema, records and walkaround instructions, test-drive caution, recall and inspection discussion, decision worksheet, service CTA, and authorship/review disclosure. Limited excerpt approval cannot release the full guide.

## Implemented scope

Preserved the September observation checklist, independent-inspector questions, four-field decision worksheet, and hypothetical weak-cooling example. Added the national DOJ approved NMVTIS provider directory while retaining the accurately labeled Texas route. Added the FTC distinction between mechanical and safety inspections, with a question about the provider's scope. Draft/source dates now read September 18. The CTA names $295 USD Full Service and $895 USD Ultimate Concierge one-time fees and keeps vehicle/third-party costs and inspection arrangements separate. Pricing comes from the owner's runbook decision; this is not a live checkout verification.

## Source and exact-copy mapping

Each source below was retrieved 2026-09-18. Refreshed/proposed rows are in [SEO-05-source-registry.csv](SEO-05-source-registry.csv). Neither retrieval nor authority-name attribution replaces qualified review.

| Record and proposed copy location | Primary support and observed source date | Review boundary |
| --- | --- | --- |
| `SEP-USED-01`, `#before-visit`: Texas Title Check directs buyers to approved providers | [TxDMV, Title Check — Look before you buy](https://www.txdmv.gov/motorists/buying-or-selling-a-vehicle/title-check-look-before-you-buy), “How To Do a Title Check”; no publication/effective date stated | Texas route remains explicitly labeled. No report price, complete title clearance, transfer eligibility, or vehicle-condition guarantee is claimed. |
| `SEP-USED-04`, `#before-visit`: national “approved NMVTIS provider list for public customers” | [U.S. DOJ/Bureau of Justice Assistance, Research Vehicle History](https://vehiclehistory.bja.ojp.gov/nmvtis_vehiclehistory), approved-provider links for commercial and public customers; no publication/effective date stated | New national navigation route only. The directory distinguishes public providers from commercial-only access. No provider is endorsed or named as universally superior. |
| `SEP-USED-02`, `#before-visit` and `#inspection`: Buyers Guide warranty status, independent inspection, certified cars, written report, alternatives, mechanical/safety distinction | [FTC, Buying a Used Car From a Dealer](https://consumer.ftc.gov/articles/buying-used-car-dealer), “Dealer Sales and the Buyers Guide” and “Get an Independent Inspection Before You Buy”; dated April 2024 | Applies to the stated dealer-sale scope. Mechanical inspection is distinct from a safety inspection; neither the article nor history report is a condition certificate. |
| `SEP-USED-03`, `#walkaround`: VIN lookup omits repaired and some newly announced recalls | [NHTSA, Check for Recalls](https://www.nhtsa.gov/recalls), VIN search coverage and exclusions; no publication/effective date stated, dynamic VIN data | Current exclusions match the draft. Ask the qualified reviewer whether the concise “among other limitations” needs expansion for the intended audience; do not present a zero result as safety clearance. |

The walkaround and test-drive method, EV/hybrid specialist question, observations-versus-diagnosis distinction, and decision worksheet are original editorial material. Agency links do not certify those instructions. The weak-cooling example is explicitly hypothetical, leaves diagnosis and repair cost unknown, and supplies no safety assurance or repair prediction.

## Accountable approvals still missing

1. Mason, or another named responsible author, must accept the exact revised text; the existing founder/lead-advisor attribution is not a mechanical credential or revision acceptance.
2. A named qualified automotive mechanical/safety reviewer must review the complete walkaround, safe observation boundaries, test-drive wording, warning-message handling, recall limitations, inspection scope, and EV/hybrid questions. Document relevant training/experience; do not invent certification.
3. A named qualified consumer-law reviewer must approve the dealer-sale Buyers Guide and title-history wording, the Texas-specific route, and national audience boundaries. Mechanical competence alone does not cover legal/title guidance.
4. The editorial/claims owner must verify the national service CTA and the continued separation of advisor support from the independent inspection and its charges.

Review questions: Are the non-diagnostic steps and test-drive cautions safe and sufficiently bounded? Does the checklist risk implying that a layperson can clear a vehicle's condition? Is the recall limitation clear enough for older/imported/limited-manufacturer vehicles? Is dealer-sale guidance clearly separated from private-sale circumstances? Does the national provider route need any additional title-history limitation? Are transport, inspection selection, payment, and service scope left with the actual engagement/provider rather than promised by the article?

Required fields remain missing: named author acceptance and date; reviewer legal name, role, relevant qualifications and jurisdictional scope; exact approved file/text hash; review date; expiry; next review; required edits; material-change triggers. `approved_copy` remains blank. A populated source row is not an approval record.

## Page release decision

The proposed revision exists only under `draft-artifacts/guides/`, excluded from deployment by `.vercelignore`. The root page retains its September 5 editorial copy and dates, with the separately authorized $295/$895 service CTA update as its only editorial change. SEO-03 additionally moves the unchanged GTM bootstrap after blocking CSS in the root template. Existing discovery links reach that prior root draft, not this new proposed copy. Noindex alone does not authorize shipping the proposed revision.

Keep the visible warning, `noindex, follow`, draft BlogPosting status, and sitemap exclusion. Do not claim accepted current authorship or a qualified reviewer in schema. Existing owner-authorized draft links remain labeled drafts.

After actual approval, the publisher must deliberately promote the approved private artifact into the public root and synchronize the exact claim/source/inventory records, author/reviewer/date disclosures, schema, robots, sitemap, and Resources label for this page only. Repeat local/rendered validation and obtain activation authorization for that concrete candidate. Recheck on changes to safety/title/recall guidance, source availability, article method, offer, or authorship and at least every six months after approval.

See [SEO-05.md](SEO-05.md) for local checks. This packet contains no production verification or mechanical clearance for an individual car.
