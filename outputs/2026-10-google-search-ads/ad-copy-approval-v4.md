# Google Search ads copy: v4 change sheet (ADS-GOOGLE-2026-10)

Status: **awaiting Mason's signature. Not approved.** Version 4, prepared 2026-10-23. Nothing here is live, nothing has been uploaded, and every campaign stays paused.

Version 4 is version 3 (`ad-copy-approval.md`, sha256 `8d7c20398e150a491e9ed317e139c596f8ee049772fb6198cda2ee7ff1d59909`, never approved) with the changes below and nothing else. They follow the plan rename Mason decided on 2026-10-23 (`docs/seo/2026-10-23-plan-rename.md`):

- "Full Service" ($395) is now **Drive Right**; "Ultimate Concierge" ($695) is now **Drive Right Pro**. Prices are unchanged.
- Pro no longer covers auctions, forums or niche sources, so the lines that said so are replaced with the new Pro scope: offers on up to three models, out-of-state dealers.
- "Start Your Buying Brief" is replaced: `AGENTS.md` bans the word "brief" in public copy.

Every string not listed here reads exactly as on the v3 sheet. `plan.json` and the Editor files in `editor-import/` were rebuilt from it with `build-editor-csv.mjs`; all strings are ASCII and within Google's limits (headline 30, description 90, sitelink text 25, sitelink lines 35, callout 25, path 15), and none uses the plan's forbidden terms. "Best" stays out even though the site now says "our pick of the best deal" for Pro: the ad checker blocks it and `CLM-014` still applies to ads.

## Changed strings (19)

| Where | Type | v3 | v4 | Length |
|---|---|---|---|---|
| Search | NonBrand | Car Buying Service | US / Car Buying Concierge / headline 3 (pinned H2) | Headline | Can't Find the Car You Want? | Torn Between a Few Cars? | 24 |
| Search | NonBrand | Car Buying Service | US / Car Buying Concierge / headline 8 | Headline | We Search Beyond the Lot | Offers on Up to 3 Models | 24 |
| Search | NonBrand | Car Buying Service | US / Car Buying Concierge / headline 9 | Headline | Auctions and Niche Sources | Out-of-State Dealers Too | 24 |
| Search | NonBrand | Car Buying Service | US / Car Buying Concierge / headline 15 | Headline | Ultimate Concierge: $695 | Drive Right Pro: $695 | 21 |
| Search | NonBrand | Car Buying Service | US / Car Buying Concierge / description 1 | Description | Can't find the car you want? We search past the dealer lot, auctions and forums included. | Torn between a few cars? We get dealer offers on up to three models, side by side. | 82 |
| Search | NonBrand | Car Buying Service | US / Car Buying Concierge / description 2 | Description | Too busy to shop around? Ultimate Concierge does the searching and the haggling for $695. | Too busy to shop around? Drive Right Pro does the searching and the haggling for $695. | 86 |
| Search | NonBrand | Car Buying Service | US / Car Buying Concierge / display path | Display path | concierge/pricing | compare/pricing | 15 |
| Search | NonBrand | Car Buying Service | US / sitelink 1 line 1 | Sitelink line 1 | Full Service is $395 one time | Drive Right plan: $395 one time | 31 |
| Search | NonBrand | Car Buying Service | US / sitelink 1 line 2 | Sitelink line 2 | Ultimate Concierge is $695 | Drive Right Pro: $695 one time | 30 |
| Search | NonBrand | Car Buying Service | US / sitelink 5 text | Sitelink text | Start Your Buying Brief | Start Your Car Search | 21 |
| Search | NonBrand | Car Buying Service | US / callout 8 | Callout | Full Service $395 | Drive Right Plan $395 | 21 |
| Search | NonBrand | Car Buying Service | US / callout 9 | Callout | Ultimate Concierge $695 | Drive Right Pro $695 | 20 |
| Search | Brand | Drive Right | US / Brand / headline 10 | Headline | Full Service: $395 One Time | Drive Right: $395 One Time | 26 |
| Search | Brand | Drive Right | US / Brand / headline 11 | Headline | Ultimate Concierge: $695 | Drive Right Pro: $695 | 21 |
| Search | Brand | Drive Right | US / Brand / headline 15 | Headline | Start Your Buying Brief | Start Your Car Search | 21 |
| Search | Brand | Drive Right | US / Brand / description 2 | Description | Full Service is $395 and Ultimate Concierge is $695, one time. Vehicle costs are separate. | Drive Right is $395 and Drive Right Pro is $695, one time. Vehicle costs are separate. | 86 |
| Search | Brand | Drive Right | US / sitelink 1 line 1 | Sitelink line 1 | Full Service is $395 one time | Drive Right plan: $395 one time | 31 |
| Search | Brand | Drive Right | US / sitelink 1 line 2 | Sitelink line 2 | Ultimate Concierge is $695 | Drive Right Pro: $695 one time | 30 |
| Search | Brand | Drive Right | US / sitelink 5 text | Sitelink text | Start Your Buying Brief | Start Your Car Search | 21 |

## Evidence for the new strings

| String | Rests on |
|---|---|
| "Drive Right: $395 One Time", "Drive Right plan: $395 one time", "Drive Right Plan $395", "Drive Right Pro: $695", "Drive Right Pro: $695 one time", "Drive Right Pro $695", the Brand description 2 | `PLAN-NAMES-2026-10-23` (names) and `SEO-PRICE-2026-09-27` (amounts) in `data/claims.csv`; the plan cards on `schedule.html` |
| "Torn Between a Few Cars?", "Offers on Up to 3 Models", "Torn between a few cars? We get dealer offers on up to three models, side by side." | `PRO-SCOPE-2026-10-23` ("Offers on up to three models, priced side by side") |
| "Out-of-State Dealers Too" | `PRO-SCOPE-2026-10-23` ("Out-of-state dealers, and we help coordinate shipping when the dealer is open to it") |
| "Too busy to shop around? Drive Right Pro does the searching and the haggling for $695." | `PRO-SCOPE-2026-10-23` (everything in Drive Right: the search and the negotiation) and `SEO-PRICE-2026-09-27` |
| "Start Your Car Search", "compare/pricing" | Navigation; no claim. The sitelink still opens the homepage. |

## Unchanged v3 strings whose evidence moves

The v3 sheet keys some unchanged strings to the old "UC" (Ultimate Concierge) scope. They now rest on `PRO-SCOPE-2026-10-23` and `DRIVE-RIGHT-SCOPE-2026-10-23` instead, with the same wording:

- "A Car Finder Who Haggles Too" and "Save Hours of Searching": both plans search and negotiate.
- "Your Car Buying Concierge" stays as a generic description that matches the ad group's "car buying concierge" keywords. It is no longer a plan name. If you would rather drop the word now that no plan is called Concierge, say so and I'll replace it.

## Sign-off

1. Read the rows above (and the v3 sheet, if you have not yet). If you want anything changed, tell me instead of editing a file.
2. Check that neither sheet has changed. These must print the hashes in the `ADS-GOOGLE-2026-10` row's `claim_text`:
   ```bash
   shasum -a 256 outputs/2026-10-google-search-ads/ad-copy-approval.md outputs/2026-10-google-search-ads/ad-copy-approval-v4.md
   ```
3. In that row of `data/claims.csv`, set `status` to `approved`, `reviewer` to `Mason (business owner)`, `last_reviewed` to the date you sign, `expires_on` to `2026-12-21` or earlier, and `approved_copy` to both sheet paths with their hashes. Leave the other fields as they are.

Upload stays a separate step under the launch plan's gates (`docs/google-ads-launch-plan-2026-09-27.md`).
