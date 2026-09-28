# Google Search ads copy: approval sheet (ADS-GOOGLE-2026-10)

Status: **awaiting Mason's signature. Not approved.** Version 3, prepared 2026-09-27. It replaces version 2 (sha256 `5598ede8…fe82`) and version 1 (`491af36e…c0e7`); neither was recorded as approved. Version 3 sells to the buyer's pain: hours at the dealer, nights scrolling listings, haggling with people who do it all day. It promises time and sanity saved and a better deal, and keeps the price as a one-line qualifier. Nothing on this sheet is live. No ad may be enabled until the `ADS-GOOGLE-2026-10` row in `data/claims.csv` says `approved` (launch gate G4 in `docs/google-ads-launch-plan-2026-09-27.md`).

This sheet lists every string a searcher can see in the Google Ads Editor import files (`editor-import/06`-`10`, built from `plan.json` by `build-editor-csv.mjs`): 48 headlines, 15 descriptions, 15 sitelink strings, 12 callouts, 9 snippet strings, 5 display paths, 5 final URLs and 2 call-asset values: 111 rows in all. Keywords, negatives, budgets and bidding are not shown to searchers, so they are not on this sheet. A string that is not on this sheet is not approved.

Signing approves exactly this text. Any later wording change needs a new approval.

## Sign-off (your only step)

1. Read the rows. If you want anything changed, tell me instead of editing this file. I'll update `plan.json`, rebuild the Editor files and regenerate this sheet so all three match.
2. Check that the sheet hasn't changed since it was prepared. This command must print the hash in the row's `claim_text`:
   ```bash
   shasum -a 256 outputs/2026-10-google-search-ads/ad-copy-approval.md
   ```
3. Change these five fields in the `ADS-GOOGLE-2026-10` row of `data/claims.csv`. Leave every other field as it is.

| Field | Now | After you sign |
|---|---|---|
| `status` | `pending_owner_confirmation` | `approved` |
| `reviewer` | blank | `Mason (business owner)` |
| `last_reviewed` | blank | the date you sign (YYYY-MM-DD) |
| `expires_on` | blank | `2026-12-21` or earlier |
| `approved_copy` | blank | `outputs/2026-10-google-search-ads/ad-copy-approval.md sha256 <the hash from step 2>` |

## Notes

- **How the ads read.** In every non-brand ad the brand name is pinned first and a question about the searcher's problem is pinned second ("Dreading the Dealership?", "Outmatched by the Salesperson?"). Every other headline and description sells the answer: your time and sanity back, the legwork and haggling done for you, a better deal, and the final call staying yours. Price appears once per ad as a qualifier ("From $395, One Time").
- **Time and sanity lines** rest on your statement of 2026-09-27 ("We save people time. That is the whole purpose of the service.") and on what the service does: the advisor does the searching, the dealer contact and the negotiating. "Skip the hours at the dealer" is also the homepage headline.
- **Better-deal lines** ("We Fight for a Better Price", "negotiate for a better deal", "We Tell You If It's a Bad Deal") describe what the advisor does and aims for: negotiation, fee review and documented recommendations. "Best deal" and "lowest price" stay out: `CLM-014` marks that wording `revise_to_bounded_language`, and the ad checker blocks "best". If you want the literal words, say so; it's your call as owner and I'll record it against `CLM-014`.
- **Call hours.** Google reads the call schedule in the Ads account's time zone. If the account isn't on Central time, convert 09:00-17:00 Central before import.
- **Expiry.** `2026-12-21` is the earliest date among the approvals these lines rest on: the Austin base and phone (`data/entities.json`, next review 2026-12-21), the hours (`ENT-HOURS-2026-09-22`, 2026-12-22) and the prices (`SEO-PRICE-2026-09-27`, 2026-12-26).
- **Held back until `CLM-013` is approved:** "On Your Side, Not the Dealer's", "No Dealer Commissions", "Paid Only by Our Customers" and "We are paid only by our customers, never by dealers, sellers or lenders." Today `how-it-works.html:127` says the site makes no statement about dealer compensation either way.

## Evidence sources

Line numbers are for this branch as of 2026-09-27.

| Key | What it covers | Evidence |
|---|---|---|
| TIME | The service saves buyers time and stress | Owner statement by Mason, 2026-09-27: "We save people time. That is the whole purpose of the service." The advisor does the searching, dealer contact and negotiating (ACT, FS). The homepage headline says "Skip the hours at the dealer." (`index.html:273`). "Sanity" and "weekends/evenings back" restate the same benefit; they claim no number. |
| DEAL | Negotiating for a better price; flagging a bad deal | The advisor negotiates the price, reviews fees and documents recommendations (FS; `car-buying-service.html:159`, `:166`, `:170`). Worded as the aim ("for a better price") and the advice ("we tell you"), never as a promised outcome. "Best" and "lowest" are excluded (`CLM-014`, `revise_to_bounded_language`). |
| PAIN | A question naming the searcher's problem | Asks about the buyer's situation. It says nothing about Drive Right. |
| MKT | "Salespeople negotiate every day" | A general statement about dealership sales staff, not about Drive Right. |
| ACT | Contacting dealers, comparing offers, doing the legwork | `car-buying-service.html:153` ("remote research, offer comparison, seller communication, price negotiation, and fee review"), `:159` ("communicate with participating sellers, and handle the price negotiation and fee review included in your plan") and `:166` ("compare available offers, discuss price and fees with participating sellers"). The same service list appears at `schedule.html:153`. |
| P | Plan names, the two prices, "one time" | `data/claims.csv` `SEO-PRICE-2026-09-27`: approved by Mason on 2026-09-27, expires 2026-12-26. Plan cards at `car-buying-service.html:184-206` ("$395 one-time service fee", "$695 one-time service fee"), `schedule.html:153` and `pricing.md`. Checkout amounts at `api/_lib/config.js:15` (39500) and `:20` (69500). Live Stripe prices, read 2026-09-27 on account `acct_1THdU32RwNuweXRL`: `price_1UKRa92RwNuweXRLDifV4iNz` "Full Service - $395" (USD 39500, one-time, active) and `price_1UKRaB2RwNuweXRL8LLSGR4C` "Ultimate Concierge - $695" (USD 69500, one-time, active). |
| LIVE | Landing pages match the ads | Fetched 2026-09-27: `/`, `/car-buying-service.html`, `/schedule.html`, `/how-it-works.html` and `/about.html` all return HTTP 200 with no `noindex`. Each shows $395 and $695 and no $295 or $895. |
| ENT | Austin base, United States service area, phone | `data/entities.json` approval block: owner confirmed 2026-09-21, next review 2026-12-21. Shown on the site at `car-buying-service.html:153`, `about.html:131` ("From Austin"), `how-it-works.html:115` and the `schedule.html:155` footer ("Based in Austin. Here for buyers nationwide."). |
| HRS | Call hours | `data/claims.csv` `ENT-HOURS-2026-09-22`: approved, expires 2026-12-22, Mon-Fri 09:00-17:00 America/Chicago. Shown on the site at `index.html:415`. |
| SVC | "Car buying (and negotiation) service" | `car-buying-service.html:152` H1 "Car buying and negotiation service."; `how-it-works.html:115` "an Austin-based car buying and negotiation service supporting buyers nationwide". |
| NAT | Remote, nationwide | `car-buying-service.html:153` and `schedule.html:153`: "supports buyers nationwide through remote research". Also `about.html:10`. |
| FS | Full Service inclusions | Plan card at `car-buying-service.html:188-194`: "Research, negotiation, and fee review with a dedicated advisor"; "New, used, and CPO inventory search"; "Price negotiation and fee review"; "Dedicated advisor through the process"; "Documented vehicle recommendations". The same list appears at `schedule.html:153`, `pricing.md:10` and `data/services.json:18-21`. |
| UC | Ultimate Concierge inclusions | Plan card at `car-buying-service.html:203-206`: "Everything in Full Service"; "Auctions, forums, and niche sources"; "Priority communication and coordination"; "Delivery coordination where available". The same list appears at `pricing.md:16` and `data/services.json:35-40`. |
| DEC | Buyer makes every decision | `car-buying-service.html:153` ("You choose the vehicle, review the final terms, and decide whether to buy") and `:160` ("does not buy a vehicle for you or make the purchase decision"). The buyer list at `:173-179`. Also `how-it-works.html:115`, `about.html:141,161` and `pricing.md:21`. |
| EXC | Vehicle and delivery costs are separate | `schedule.html:153`: "Service fees are separate from the car price, taxes, registration, inspections, financing, insurance, and delivery." Also `car-buying-service.html:167`. |
| NEG | "Car negotiator" | The `schedule.html:8` title ("Car Negotiator & Buying Service Pricing"), `car-buying-service.html:169-170` and `how-it-works.html:122`. |
| BR | Brand name | `data/entities.json:8` ("Drive Right"), the domain driverightcarbuying.com and the `about.html:8` title ("About Drive Right Car Buying Service"). |
| NAV | Link, call to action, display path or a Google-defined label | Makes no factual claim beyond its destination existing (checked under LIVE). |

## Every string

"Used in" names the ad group for ad text (Brand; NB = non-brand campaign: NB-Service, NB-Negotiation, NB-Concierge, NB-Advisor) and the campaign (Brand or NB) for sitelinks, callouts, snippets and the call asset. "Pinned" means pinned to that headline position.

### Responsive search ads: headlines and descriptions

| # | Text | Type | Chars | Used in | What it claims | Evidence |
|---|---|---|---|---|---|---|
| 1 | Drive Right Car Buying | Headline | 22 | Brand, NB-Service, NB-Concierge; pinned H1 | Business name | BR |
| 2 | Drive Right Buying Service | Headline | 26 | Brand, NB-Service, NB-Negotiation, NB-Concierge, NB-Advisor; pinned H1 | Business name + "buying service" | BR, SVC |
| 3 | Dreading the Dealership? | Headline | 24 | NB-Service; pinned H2 | Names the searcher's problem | PAIN |
| 4 | No Time to Shop for a Car? | Headline | 26 | NB-Service; pinned H2 | Names the searcher's problem | PAIN |
| 5 | Not Sure It's a Good Deal? | Headline | 26 | NB-Service; pinned H2 | Names the searcher's problem | PAIN |
| 6 | Save Your Time and Your Sanity | Headline | 30 | Brand, NB-Service, NB-Negotiation, NB-Concierge, NB-Advisor | The service saves the buyer time and stress | TIME |
| 7 | Skip the Hours at the Dealer | Headline | 28 | Brand, NB-Service, NB-Advisor | The buyer spends fewer hours at dealerships | TIME |
| 8 | Car Buying, Handled for You | Headline | 27 | NB-Service | The advisor does the buying work; the buyer decides | SVC, ACT |
| 9 | Stop Scrolling Car Listings | Headline | 27 | NB-Service, NB-Concierge, NB-Advisor | The advisor does the listing search instead of the buyer | TIME, ACT |
| 10 | We Haggle So You Don't Have To | Headline | 30 | NB-Service, NB-Negotiation, NB-Advisor | The advisor negotiates instead of the buyer | FS |
| 11 | We Tell You If It's a Bad Deal | Headline | 30 | NB-Service, NB-Negotiation, NB-Advisor | The advisor compares offers and documents recommendations | DEAL, FS |
| 12 | Get Your Weekends Back | Headline | 22 | NB-Service, NB-Concierge | The buyer spends less of their own time car shopping | TIME |
| 13 | A Negotiator in Your Corner | Headline | 27 | Brand, NB-Service | The advisor negotiates for the buyer | FS |
| 14 | We Negotiate. You Decide. | Headline | 25 | Brand, NB-Service, NB-Negotiation, NB-Advisor | The advisor negotiates; the buyer decides | FS, DEC |
| 15 | From $395, One Time | Headline | 19 | NB-Service, NB-Negotiation, NB-Advisor | Lowest plan is $395, paid once | P, LIVE |
| 16 | Drive Right Car Buying Help | Headline | 27 | NB-Negotiation, NB-Advisor; pinned H1 | Business name + "car buying help" | BR, SVC |
| 17 | Hate Haggling Over Price? | Headline | 25 | NB-Negotiation; pinned H2 | Names the searcher's problem | PAIN |
| 18 | Outmatched by the Salesperson? | Headline | 30 | NB-Negotiation; pinned H2 | Names the searcher's problem | PAIN |
| 19 | Worried About Overpaying? | Headline | 25 | NB-Negotiation; pinned H2 | Names the searcher's problem | PAIN |
| 20 | Bring Your Own Car Negotiator | Headline | 29 | NB-Negotiation | The buyer hires Drive Right to negotiate | NEG, FS |
| 21 | Salespeople Haggle All Day | Headline | 26 | NB-Negotiation | Dealership sales staff negotiate daily | MKT |
| 22 | Now You Have a Negotiator Too | Headline | 29 | NB-Negotiation | The buyer gets a negotiator (pairs with the salespeople line) | NEG, FS |
| 23 | We Fight for a Better Price | Headline | 27 | NB-Negotiation | The advisor negotiates for a better price (aim) | DEAL |
| 24 | Fees Checked Before You Sign | Headline | 28 | NB-Negotiation | Fee review happens before the buyer signs | FS, DEC |
| 25 | Can't Find the Car You Want? | Headline | 28 | NB-Concierge; pinned H2 | Names the searcher's problem | PAIN |
| 26 | Too Busy to Shop Around? | Headline | 24 | NB-Concierge; pinned H2 | Names the searcher's problem | PAIN |
| 27 | Tired of Endless Listings? | Headline | 26 | NB-Concierge; pinned H2 | Names the searcher's problem | PAIN |
| 28 | Your Car Buying Concierge | Headline | 25 | NB-Concierge | Ultimate Concierge plan used as a category | P, UC |
| 29 | A Car Finder Who Haggles Too | Headline | 28 | NB-Concierge | Concierge searches for the car and negotiates | FS, UC |
| 30 | We Search Beyond the Lot | Headline | 24 | NB-Concierge | Concierge searches auctions, forums and niche sources | UC |
| 31 | Auctions and Niche Sources | Headline | 26 | NB-Concierge | Concierge searches auctions and niche sources | UC |
| 32 | We Do the Legwork. You Decide. | Headline | 30 | NB-Concierge | The advisor does the legwork; the buyer decides | ACT, DEC |
| 33 | Save Hours of Searching | Headline | 23 | NB-Concierge | Concierge does the searching, saving the buyer hours | TIME, UC |
| 34 | Ultimate Concierge: $695 | Headline | 24 | Brand, NB-Concierge | Ultimate Concierge fee is $695 | P, LIVE |
| 35 | Overwhelmed by Car Buying? | Headline | 26 | NB-Advisor; pinned H2 | Names the searcher's problem | PAIN |
| 36 | Not Sure Which Car to Buy? | Headline | 26 | NB-Advisor; pinned H2 | Names the searcher's problem | PAIN |
| 37 | No Time to Car Shop? | Headline | 20 | NB-Advisor; pinned H2 | Names the searcher's problem | PAIN |
| 38 | Your Personal Car Shopper | Headline | 25 | NB-Advisor | A dedicated advisor searches for the buyer | FS |
| 39 | Help Buying Your Next Car | Headline | 25 | NB-Advisor | General description of the service | SVC |
| 40 | Get Your Evenings Back | Headline | 22 | NB-Advisor | The buyer spends less of their own time car shopping | TIME |
| 41 | Drive Right, Based in Austin | Headline | 28 | Brand; pinned H1 | Business name; Austin city base | BR, ENT |
| 42 | Let Us Do the Legwork | Headline | 21 | Brand | The advisor does the searching and dealer contact | ACT |
| 43 | Car Buying and Negotiation | Headline | 26 | Brand | Service covers car buying and negotiation | SVC |
| 44 | Full Service: $395 One Time | Headline | 27 | Brand | Full Service fee is $395, one time | P, LIVE |
| 45 | Compare Our Two Plans | Headline | 21 | Brand | Exactly two plans are offered (CTA) | P, NAV |
| 46 | See How Drive Right Works | Headline | 25 | Brand | Links to the process (CTA) | NAV |
| 47 | Remote Support Nationwide | Headline | 25 | Brand | Remote service for buyers anywhere in the US | ENT, NAT |
| 48 | Start Your Buying Brief | Headline | 23 | Brand | Starts the buying brief (CTA) | NAV |
| 49 | Skip the hours at the dealer. We search, contact dealers and negotiate for a better deal. | Description | 89 | Brand, NB-Service | Time saved; what the advisor does; negotiating for a better deal (aim) | TIME, ACT, DEAL |
| 50 | Save your time and your sanity. Tell us what you want and we handle the dealer for you. | Description | 87 | NB-Service, NB-Negotiation, NB-Concierge | Time and stress saved; the advisor deals with the dealer | TIME, ACT |
| 51 | Hours at the dealer, nights on listing sites, or one advisor doing the legwork for $395. | Description | 88 | NB-Service, NB-Advisor | Time saved; the advisor does the legwork; Full Service price | TIME, ACT, FS, P, LIVE |
| 52 | Not sure it's a good deal? We compare offers, check the fees and tell you what we'd do. | Description | 87 | NB-Service, NB-Advisor | Names the problem; offer comparison, fee review and documented recommendations | PAIN, ACT, FS, DEAL |
| 53 | Salespeople negotiate every day. Now you have a negotiator too, for a one-time $395 fee. | Description | 88 | NB-Negotiation | Salespeople negotiate daily; Full Service adds a negotiator for $395 | MKT, FS, P, LIVE |
| 54 | Hate haggling? Send us in. We negotiate the price and check the fees before you sign. | Description | 85 | NB-Negotiation | Names the problem; negotiation and fee review before the buyer signs | PAIN, FS, DEC |
| 55 | Worried about overpaying? We compare offers and push for a better price before you sign. | Description | 88 | NB-Negotiation | Names the problem; offer comparison; negotiating for a better price (aim) | PAIN, ACT, DEAL, DEC |
| 56 | Can't find the car you want? We search past the dealer lot, auctions and forums included. | Description | 89 | NB-Concierge | Names the problem; Concierge search sources | PAIN, UC |
| 57 | Too busy to shop around? Ultimate Concierge does the searching and the haggling for $695. | Description | 89 | NB-Concierge | Names the problem; Concierge searches and negotiates; price | PAIN, UC, FS, P, LIVE |
| 58 | Stop scrolling listings and sitting in dealerships. We do the legwork. You make the call. | Description | 89 | NB-Concierge | Time saved; the advisor does the legwork; the buyer decides | TIME, ACT, DEC |
| 59 | Overwhelmed by car buying? One advisor handles the search, the dealers and the haggling. | Description | 88 | NB-Advisor | Names the problem; one dedicated advisor does the search, dealer contact and negotiation | PAIN, FS, ACT |
| 60 | Get your evenings back. We research, contact dealers and negotiate. You make the call. | Description | 86 | NB-Advisor | Time saved; what the advisor does; the buyer decides | TIME, ACT, DEC |
| 61 | Drive Right is an Austin-based car buying and negotiation service for buyers nationwide. | Description | 88 | Brand | Brand; Austin base; service; US buyers | BR, ENT, SVC, NAT |
| 62 | Full Service is $395 and Ultimate Concierge is $695, one time. Vehicle costs are separate. | Description | 90 | Brand | Both prices, one time; fee excludes vehicle costs | P, LIVE, EXC |
| 63 | Compare both plans, see how the process works and choose the help that fits your search. | Description | 88 | Brand | Two plans; process page (CTA) | P, NAV |

### Sitelinks

| # | Text | Type | Chars | Used in | What it claims | Evidence |
|---|---|---|---|---|---|---|
| 64 | Compare Plans and Pricing | Sitelink text | 25 | Brand, NB | Links to plans and prices (CTA) | NAV |
| 65 | Full Service is $395 one time | Sitelink line 1 | 29 | Brand, NB | Full Service fee is $395, one time | P, LIVE |
| 66 | Ultimate Concierge is $695 | Sitelink line 2 | 26 | Brand, NB | Ultimate Concierge fee is $695 | P, LIVE |
| 67 | How It Works | Sitelink text | 12 | Brand, NB | Links to the process page | NAV |
| 68 | Tell us what you want | Sitelink line 1 | 21 | Brand, NB | The brief collects what the buyer wants (CTA) | NAV |
| 69 | We search, haggle, you decide | Sitelink line 2 | 29 | Brand, NB | The advisor searches and negotiates; the buyer decides | ACT, FS, DEC |
| 70 | What We Handle for You | Sitelink text | 22 | Brand, NB | Links to what the service handles | NAV, ACT |
| 71 | The search, the dealers, the haggle | Sitelink line 1 | 35 | Brand, NB | Inventory search, dealer contact and negotiation | FS, ACT |
| 72 | And what stays your decision | Sitelink line 2 | 28 | Brand, NB | Page lists what stays with the buyer | DEC, NAV |
| 73 | About Drive Right | Sitelink text | 17 | Brand, NB | Links to the About page | BR, NAV |
| 74 | Based in Austin, Texas | Sitelink line 1 | 22 | Brand, NB | Austin city base | ENT |
| 75 | Remote support nationwide | Sitelink line 2 | 25 | Brand, NB | Remote service for buyers anywhere in the US | ENT, NAT |
| 76 | Start Your Buying Brief | Sitelink text | 23 | Brand, NB | Starts the buying brief (CTA) | NAV |
| 77 | Describe the car you want | Sitelink line 1 | 25 | Brand, NB | The brief collects what the buyer wants (CTA) | NAV |
| 78 | Then we get to work | Sitelink line 2 | 19 | Brand, NB | The advisor starts after the brief (CTA) | NAV, ACT |

### Callouts

| # | Text | Type | Chars | Used in | What it claims | Evidence |
|---|---|---|---|---|---|---|
| 79 | We Haggle for You | Callout | 17 | Brand, NB | The advisor negotiates the price | FS |
| 80 | We Contact the Dealers | Callout | 22 | NB | The advisor contacts dealers | ACT |
| 81 | We Sort the Listings | Callout | 20 | NB | The advisor searches inventory for the buyer | ACT, FS |
| 82 | Skip Hours at the Dealer | Callout | 24 | Brand, NB | The buyer spends fewer hours at dealerships | TIME |
| 83 | Fee Check Before You Sign | Callout | 25 | NB | Fee review happens before the buyer signs | FS, DEC |
| 84 | You Make Every Decision | Callout | 23 | Brand, NB | Buyer makes every purchase decision | DEC |
| 85 | One-Time Service Fee | Callout | 20 | Brand, NB | Both plans are one-time fees | P |
| 86 | Full Service $395 | Callout | 17 | NB | Full Service fee is $395 | P, LIVE |
| 87 | Ultimate Concierge $695 | Callout | 23 | NB | Ultimate Concierge fee is $695 | P, LIVE |
| 88 | Remote Support Nationwide | Callout | 25 | Brand, NB | Remote service for buyers anywhere in the US | ENT, NAT |
| 89 | Based in Austin, Texas | Callout | 22 | Brand | Austin city base | ENT |
| 90 | Dedicated Advisor | Callout | 17 | Brand | Each buyer gets a dedicated advisor | FS |

### Structured snippets

| # | Text | Type | Chars | Used in | What it claims | Evidence |
|---|---|---|---|---|---|---|
| 91 | Service catalog | Snippet header | 15 | NB | Google-defined snippet header (no claim) | NAV |
| 92 | Inventory Search | Snippet value (Service catalog) | 16 | NB | Full Service includes inventory search | FS |
| 93 | Price Negotiation | Snippet value (Service catalog) | 17 | NB | Full Service includes price negotiation | FS |
| 94 | Fee Review | Snippet value (Service catalog) | 10 | NB | Full Service includes fee review | FS |
| 95 | Vehicle Recommendations | Snippet value (Service catalog) | 23 | NB | Full Service includes documented vehicle recommendations | FS |
| 96 | Types | Snippet header | 5 | NB | Google-defined snippet header (no claim) | NAV |
| 97 | New Cars | Snippet value (Types) | 8 | NB | Search covers new cars | FS |
| 98 | Used Cars | Snippet value (Types) | 9 | NB | Search covers used cars | FS |
| 99 | Certified Pre-Owned | Snippet value (Types) | 19 | NB | Search covers CPO | FS |

### Display paths

| # | Text | Type | Chars | Used in | What it claims | Evidence |
|---|---|---|---|---|---|---|
| 100 | car-buying/service | Display path | 18 | NB-Service | Display path (no claim) | NAV |
| 101 | car-buying/negotiation | Display path | 22 | NB-Negotiation | Display path (no claim) | NAV |
| 102 | concierge/pricing | Display path | 17 | NB-Concierge | Display path (no claim) | NAV |
| 103 | car-buying/help | Display path | 15 | NB-Advisor | Display path (no claim) | NAV |
| 104 | car-buying | Display path | 10 | Brand | Display path (no claim) | NAV |

### Final URLs

| # | Value | Type | Used in | What it claims | Evidence |
|---|---|---|---|---|---|
| 105 | `https://www.driverightcarbuying.com/car-buying-service.html` | Final URL | Brand, NB, NB-Service, NB-Negotiation | Landing page; live 200, indexable, shows $395/$695 and no $295/$895 | LIVE |
| 106 | `https://www.driverightcarbuying.com/schedule.html` | Final URL | Brand, NB, NB-Concierge | Landing page; live 200, indexable, shows $395/$695 and no $295/$895 | LIVE |
| 107 | `https://www.driverightcarbuying.com/` | Final URL | Brand, NB, NB-Advisor | Landing page; live 200, indexable, shows $395/$695 and no $295/$895 | LIVE |
| 108 | `https://www.driverightcarbuying.com/how-it-works.html` | Final URL | Brand, NB | Landing page; live 200, indexable, shows $395/$695 and no $295/$895 | LIVE |
| 109 | `https://www.driverightcarbuying.com/about.html` | Final URL | Brand, NB | Landing page; live 200, indexable, shows $395/$695 and no $295/$895 | LIVE |

### Call asset

| # | Value | Type | Used in | What it claims | Evidence |
|---|---|---|---|---|---|
| 110 | `(512) 910-4938 (US)` | Call: phone | Brand, NB | Business phone | ENT, HRS |
| 111 | `(Monday[09:00-17:00]);(Tuesday[09:00-17:00]);(Wednesday[09:00-17:00]);(Thursday[09:00-17:00]);(Friday[09:00-17:00])` | Call: schedule | Brand, NB | Calls answered Mon-Fri 09:00-17:00 Central (see Notes) | HRS |
