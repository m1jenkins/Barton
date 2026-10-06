# CLM-013 compensation attestation packet (draft)

**Status:** `approved` since 2026-09-30 (`data/claims.csv`, CLM-013 "Zero kickbacks and no dealer commissions", reviewer "Business owner via direct owner instruction", revalidation checkpoint 2026-12-29). On 2026-10-05 the owner extended it to lenders and approved the plain-language version published in the homepage hero and FAQs (COMPENSATION-COPY-2026-10-05). The packet below is the historical draft from when the row was still `pending_evidence`.

**What the owner said:** on 2026-09-27, in the Google Ads planning session, the owner said customers are Drive Right's only payer. That statement is the reason for this packet. It is **not** an attestation: the claim-review workflow needs a signed statement, evidence and a named reviewer.

**Why it matters now:** `how-it-works.html` currently says compensation statements are "pending owner attestation". It asks visitors to request a written disclosure before paying. That is friction for paid traffic, so the Google Ads plan sends negotiation searches to `/car-buying-service.html` until this is resolved. A clear, approved statement is also the strongest ad line available.

## 1. Owner attestation (sign and keep outside the repository)

> I, [full name], owner of [legal business name] doing business as Drive Right, attest that from [start date] through [signing date], Drive Right's only revenue for its car-buying services was service fees paid by its own customers. Drive Right has not received, and has no agreement to receive, any referral fee, commission, bonus, spiff or other payment from vehicle dealers, private sellers, lenders, insurers, warranty or add-on providers, or any other third party in connection with a customer's vehicle purchase. I will tell the claims reviewer before any such relationship begins.
>
> Signed: __________ Date: __________

Record here only where the signed copy is kept and the date. Don't commit it.

## 2. Evidence the reviewer checks (aggregate only; no financial records in Git)

- [ ] Revenue sources over the attestation period are only customer service-fee payments (Stripe payouts and bank deposits).
- [ ] There are no contracts, referral agreements or affiliate programs with dealers, sellers, lenders or insurers.
- [ ] There are no payments received from those parties.
- [ ] Record the reviewer's name, the review date, the period covered and the method (for example "Stripe payouts and bank statements, Jan–Sep 2026, reviewed by …").

## 3. Proposed bounded wording (for the reviewer to accept, edit or reject)

**Site: replaces the disclosure at `how-it-works.html:127`**
> Drive Right is paid only by its customers, through the one-time service fee. We do not accept referral fees, commissions or other payments from dealers, sellers, lenders or insurers.

**Ads** (they already pass the ad checker, after approval):

| Text | Type | Chars |
|---|---|---|
| No Dealer Commissions | Headline, callout | 21 |
| Paid Only by Our Customers | Headline | 26 |
| We are paid only by our customers, never by dealers, sellers or lenders. | Description | 72 |

"Never" is absolute. Use it only if the attestation covers the whole business with no exceptions; otherwise use "not by dealers, sellers or lenders".

## 4. Approval and release

1. **Approval:** the reviewer named on the CLM-013 row fills in `status`, `reviewer`, `last_reviewed`, `expires_on` and `approved_copy` with the exact site wording.
2. **Site release:** one release updates every place the claim appears:
   - the `how-it-works.html` disclosure;
   - any schema or FAQ that restates it;
   - `pricing.md` or `llms.txt` if they mention it.
   
   Re-run the site checks.
3. **Ads approval:** add the ad lines to `outputs/2026-10-google-search-ads/plan.json` (from its `pending_assets` block) and get their exact copy approved on the `ADS-GOOGLE-2026-10` sheet.
4. **Ads change:** apply it as one logged creative change in `change-log.md`.
5. **Landing page:** the Car Negotiation ad group can then move to `/how-it-works.html`, as a separate logged change.

## 5. Keeping it true

Any new partnership, affiliate link, referral arrangement or third-party payment triggers these steps before it starts:
1. Re-review the claim.
2. Take the claim down from the site and the ads.

The claim also lapses at `expires_on` unless it is re-checked.
