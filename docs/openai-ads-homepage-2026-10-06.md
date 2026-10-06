# OpenAI ads: homepage landing and audit — October 6, 2026

The owner asked for every ChatGPT ad to land on the homepage instead of `/schedule.html`, and for the low performers to be removed. Ads Manager was changed through the in-app browser and checked again after a reload.

## Landing page

The Link field on all 14 ads in **Drive Right campaign** / **Recommended ad group** is now `https://www.driverightcarbuying.com/`. Before, they pointed at `/schedule.html#full-service` or `#concierge`. Tracking parameters are separate fields and were not changed: Oct 2 ads use `utm_medium=cpc&utm_campaign={campaign_id}`, Sep 30 ads use `utm_medium=paid&utm_campaign=drive_right`, and the two original Full Service ads have none. While an edit was in review, the ads kept serving. Older records in `outputs/*/ads.json` still list the previous URLs.

The live homepage covers both the $395 and $695 offers, so the niche/$695 ad copy still matches the page.

## Audit (Sep 23 – Oct 6, Ads Manager)

The campaign had 12,759 impressions, 265 clicks and $359.26 in spend. Every ad shows 0 conversions, so this audit uses only CTR and CPC.

Paused, not deleted (each can be switched back on):

| Ad | Impr. | Clicks | CTR | CPC | Spend | Reason |
| --- | --- | --- | --- | --- | --- | --- |
| Full Service \| Flat fee | 1,998 | 22 | 1.10% | $1.78 | $39.09 | CTR less than half the ~2.4–2.6% of the other ads with volume |
| Full Service \| Advisor support | 1,337 | 14 | 1.05% | $2.02 | $28.23 | Same |
| Niche search \| $695 upfront \| Oct 2 | 942 | 24 | 2.55% | $3.18 | $57.31 | Duplicates Hard-to-find spec (same copy and audience) at 3× the CPC |

Kept running:

| Ad | Impr. | Clicks | CTR | CPC |
| --- | --- | --- | --- | --- |
| Car search \| Tired of chasing deals \| Sep 30 | 4,969 | 120 | 2.41% | $1.16 |
| Niche search \| Hard-to-find spec \| Sep 30 | 2,816 | 69 | 2.45% | $1.05 |
| Car search \| $395 upfront \| Oct 2 | 576 | 15 | 2.60% | $1.97 |

The six Oct 2 dealer-pain ads, plus Offer comparison and Dealer negotiation (Sep 30), each received between 1 and 43 impressions. The platform has barely served them, so there is too little data to call them low performers. Because they cost about $0, they were left on.

## Open items

- At the owner's request, the campaign was extended to **Nov 5, 2026** at $25/day to reach the account promotion ("spend $115.53 by Oct 12 and receive $500 in credit" when extended). Six days at $25 gives about $150, a margin of roughly $35 if the campaign delivers its full budget. If it runs to Nov 5, the extension allows up to about $750 more.
- Zero conversions on 265 clicks means measurement and the landing page should both be checked before any budget is raised.
