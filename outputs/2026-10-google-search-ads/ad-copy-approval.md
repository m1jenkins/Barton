# Google Search ads copy: approval sheet (ADS-GOOGLE-2026-10)

Status: **awaiting Mason's signature. Not approved.** Version 2, prepared 2026-09-27. It replaces version 1 (sha256 `491af36e…c0e7`), a list of plain facts whose approval was never recorded. Version 2 leads with the buyer's problem and the time the service saves. Nothing on this sheet is live. No ad may be enabled until the `ADS-GOOGLE-2026-10` row in `data/claims.csv` says `approved` (launch gate G4 in `docs/google-ads-launch-plan-2026-09-27.md`).

This sheet lists every string a searcher can see in the Google Ads Editor import files (`editor-import/06`-`10`, built from `plan.json` by `build-editor-csv.mjs`): 48 headlines, 16 descriptions, 15 sitelink strings, 11 callouts, 9 snippet strings, 5 display paths, 5 final URLs and 2 call-asset values: 111 rows in all. Keywords, negatives, budgets and bidding are not shown to searchers, so they are not on this sheet. A string that is not on this sheet is not approved.

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

- **How the ads read.** In every non-brand ad the brand name is pinned first and a question about the searcher's problem is pinned second ("Dreading the Dealership?", "Hate Haggling Over Price?"). The rest of the ad answers it: time saved, the legwork and negotiating done for you, the price, and your say over the purchase.
- **Time-saving lines** rest on your statement of 2026-09-27 ("We save people time. That is the whole purpose of the service.") and on what the service does: the advisor does the searching, the dealer contact and the negotiating. "Skip the hours at the dealer" is also the homepage headline.
- **Call hours.** Google reads the call schedule in the Ads account's time zone. If the account isn't on Central time, convert 09:00-17:00 Central before import.
- **Expiry.** `2026-12-21` is the earliest date among the approvals these lines rest on: the Austin base and phone (`data/entities.json`, next review 2026-12-21), the hours (`ENT-HOURS-2026-09-22`, 2026-12-22) and the prices (`SEO-PRICE-2026-09-27`, 2026-12-26).
- **Held back until `CLM-013` is approved:** "On Your Side, Not the Dealer's", "No Dealer Commissions", "Paid Only by Our Customers" and "We are paid only by our customers, never by dealers, sellers or lenders." Today `how-it-works.html:127` says the site makes no statement about dealer compensation either way.

## Evidence sources

Line numbers are for this branch as of 2026-09-27.

| Key | What it covers | Evidence |
|---|---|---|
| TIME | The service saves buyers time | Owner statement by Mason, 2026-09-27: "We save people time. That is the whole purpose of the service." The advisor does the searching, dealer contact and negotiating (ACT, FS). The homepage headline says "Skip the hours at the dealer." (`index.html:273`). |
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
| 6 | Car Buying Service From $395 | Headline | 28 | NB-Service | Car buying service; lowest plan $395 | SVC, P, LIVE |
| 7 | Save Time Buying Your Car | Headline | 25 | Brand, NB-Service, NB-Advisor | The service saves the buyer time | TIME |
| 8 | Skip the Hours at the Dealer | Headline | 28 | Brand, NB-Service, NB-Negotiation | The buyer spends fewer hours at dealerships | TIME |
| 9 | We Negotiate. You Decide. | Headline | 25 | Brand, NB-Service, NB-Negotiation, NB-Advisor | The advisor negotiates; the buyer decides | FS, DEC |
| 10 | Let Us Do the Legwork | Headline | 21 | Brand, NB-Service, NB-Advisor | The advisor does the searching and dealer contact | ACT |
| 11 | We Contact Dealers for You | Headline | 26 | NB-Service | The advisor contacts dealers | ACT |
| 12 | Your Own Car Buying Advisor | Headline | 27 | NB-Service | Each buyer gets a dedicated advisor | FS |
| 13 | Full Service: $395 One Time | Headline | 27 | Brand, NB-Service, NB-Negotiation, NB-Concierge, NB-Advisor | Full Service fee is $395, one time | P, LIVE |
| 14 | Ultimate Concierge: $695 | Headline | 24 | Brand, NB-Service, NB-Concierge | Ultimate Concierge fee is $695 | P, LIVE |
| 15 | Remote Support Nationwide | Headline | 25 | Brand, NB-Service, NB-Negotiation | Remote service for buyers anywhere in the US | ENT, NAT |
| 16 | Drive Right Car Buying Help | Headline | 27 | NB-Negotiation, NB-Advisor; pinned H1 | Business name + "car buying help" | BR, SVC |
| 17 | Hate Haggling Over Price? | Headline | 25 | NB-Negotiation; pinned H2 | Names the searcher's problem | PAIN |
| 18 | Outmatched by the Salesperson? | Headline | 30 | NB-Negotiation; pinned H2 | Names the searcher's problem | PAIN |
| 19 | Worried About Overpaying? | Headline | 25 | NB-Negotiation; pinned H2 | Names the searcher's problem | PAIN |
| 20 | Car Negotiation Service | Headline | 23 | NB-Negotiation | Service includes car price negotiation | SVC, FS |
| 21 | Hire Your Own Car Negotiator | Headline | 28 | NB-Negotiation | The buyer hires Drive Right to negotiate | NEG, FS |
| 22 | Let Us Do the Haggling | Headline | 22 | NB-Negotiation | The advisor negotiates the price | FS |
| 23 | Fees Reviewed Before You Sign | Headline | 29 | NB-Negotiation | Fee review happens before the buyer signs | FS, DEC |
| 24 | Two Plans From $395 | Headline | 19 | NB-Negotiation | Two plans; lowest is $395 | P, LIVE |
| 25 | A Dedicated Buying Advisor | Headline | 26 | Brand, NB-Negotiation, NB-Advisor | Each buyer gets a dedicated advisor | FS |
| 26 | Can't Find the Car You Want? | Headline | 28 | NB-Concierge; pinned H2 | Names the searcher's problem | PAIN |
| 27 | Too Busy to Shop Around? | Headline | 24 | NB-Concierge; pinned H2 | Names the searcher's problem | PAIN |
| 28 | Tired of Endless Listings? | Headline | 26 | NB-Concierge; pinned H2 | Names the searcher's problem | PAIN |
| 29 | Car Buying Concierge | Headline | 20 | NB-Concierge | Ultimate Concierge plan used as a category | P, UC |
| 30 | Car Finder Service | Headline | 18 | NB-Concierge | The service finds cars for the buyer | FS, UC |
| 31 | We Search Beyond the Lot | Headline | 24 | NB-Concierge | Concierge searches auctions, forums and niche sources | UC |
| 32 | Auctions and Niche Sources | Headline | 26 | NB-Concierge | Concierge searches auctions and niche sources | UC |
| 33 | Priority Communication | Headline | 22 | NB-Concierge | Concierge includes priority communication | UC |
| 34 | One-Time Concierge Fee | Headline | 22 | NB-Concierge | Concierge fee is one time | P |
| 35 | We Do the Legwork. You Decide. | Headline | 30 | NB-Concierge | The advisor does the legwork; the buyer decides | ACT, DEC |
| 36 | Save Hours of Searching | Headline | 23 | NB-Concierge | Concierge does the searching, saving the buyer hours | TIME, UC |
| 37 | Overwhelmed by Car Buying? | Headline | 26 | NB-Advisor; pinned H2 | Names the searcher's problem | PAIN |
| 38 | Not Sure Which Car to Buy? | Headline | 26 | NB-Advisor; pinned H2 | Names the searcher's problem | PAIN |
| 39 | No Time to Car Shop? | Headline | 20 | NB-Advisor; pinned H2 | Names the searcher's problem | PAIN |
| 40 | Car Buying Advisor | Headline | 18 | NB-Advisor | A dedicated advisor handles the buying work | FS |
| 41 | Your Personal Car Shopper | Headline | 25 | NB-Advisor | A dedicated advisor searches for the buyer | FS |
| 42 | Help Buying Your Next Car | Headline | 25 | NB-Advisor | General description of the service | SVC |
| 43 | Recommendations in Writing | Headline | 26 | NB-Advisor | Full Service includes documented recommendations | FS |
| 44 | Start Your Buying Brief | Headline | 23 | NB-Advisor | Starts the buying brief (CTA) | NAV |
| 45 | Drive Right, Based in Austin | Headline | 28 | Brand; pinned H1 | Business name; Austin city base | BR, ENT |
| 46 | Car Buying and Negotiation | Headline | 26 | Brand | Service covers car buying and negotiation | SVC |
| 47 | Compare Our Two Plans | Headline | 21 | Brand | Exactly two plans are offered (CTA) | P, NAV |
| 48 | See How Drive Right Works | Headline | 25 | Brand | Links to the process (CTA) | NAV |
| 49 | We search, contact dealers, compare offers and negotiate. You make the final call. | Description | 82 | Brand, NB-Service | What the advisor does; the buyer decides | ACT, FS, DEC |
| 50 | Your advisor negotiates the price and reviews the fees before you commit to anything. | Description | 85 | NB-Service | Negotiation and fee review before the buyer commits | FS, DEC |
| 51 | Full Service is $395 and Ultimate Concierge is $695, one time. Vehicle costs are separate. | Description | 90 | Brand, NB-Service, NB-Negotiation, NB-Advisor | Both prices, one time; fee excludes vehicle costs | P, LIVE, EXC |
| 52 | Skip the hours at the dealer. We search new, used and CPO inventory and contact dealers. | Description | 88 | NB-Service | Time saved; what the advisor does | TIME, FS, ACT |
| 53 | Salespeople negotiate every day. Now you have a negotiator too, for a one-time $395 fee. | Description | 88 | NB-Negotiation | Salespeople negotiate daily; Full Service adds a negotiator for $395 | MKT, FS, P, LIVE |
| 54 | Your advisor negotiates the price and reviews the fees. You make every purchase decision. | Description | 89 | NB-Negotiation | Negotiation and fee review; the buyer decides | FS, DEC |
| 55 | Not sure a quote is fair? We compare offers and question the fees before you sign. | Description | 82 | NB-Negotiation | Names the problem; offer comparison and fee review | PAIN, ACT, FS |
| 56 | Concierge looks past dealer lots to auctions, forums and niche sources for your car. | Description | 84 | NB-Concierge | Concierge search sources | UC |
| 57 | Ultimate Concierge is $695 one time and includes everything in Full Service. | Description | 76 | NB-Concierge | Concierge price; includes all of Full Service | P, LIVE, UC |
| 58 | Delivery coordination where available. Delivery and vehicle costs are separate. | Description | 79 | NB-Concierge | Concierge coordinates delivery where available; fee excludes delivery and vehicle costs | UC, EXC |
| 59 | We search, contact sellers and negotiate, with priority communication. You decide. | Description | 82 | NB-Concierge | What the Concierge advisor does; the buyer decides | ACT, UC, DEC |
| 60 | Your advisor searches new, used and CPO options and documents recommendations for you. | Description | 86 | NB-Advisor | Search scope and documented recommendations | FS |
| 61 | Price negotiation and fee review are included. You make every purchase decision. | Description | 80 | NB-Advisor | Full Service inclusions; the buyer decides | FS, DEC |
| 62 | Get your evenings back. We research, contact dealers and negotiate. You make the call. | Description | 86 | NB-Advisor | Time saved; what the advisor does; the buyer decides | TIME, ACT, DEC |
| 63 | Drive Right is an Austin-based car buying and negotiation service for buyers nationwide. | Description | 88 | Brand | Brand; Austin base; service; US buyers | BR, ENT, SVC, NAT |
| 64 | Compare both plans, see how the process works and choose the help that fits your search. | Description | 88 | Brand | Two plans; process page (CTA) | P, NAV |

### Sitelinks

| # | Text | Type | Chars | Used in | What it claims | Evidence |
|---|---|---|---|---|---|---|
| 65 | Compare Plans and Pricing | Sitelink text | 25 | Brand, NB | Links to plans and prices (CTA) | NAV |
| 66 | Full Service is $395 one time | Sitelink line 1 | 29 | Brand, NB | Full Service fee is $395, one time | P, LIVE |
| 67 | Ultimate Concierge is $695 | Sitelink line 2 | 26 | Brand, NB | Ultimate Concierge fee is $695 | P, LIVE |
| 68 | How It Works | Sitelink text | 12 | Brand, NB | Links to the process page | NAV |
| 69 | See each step of the process | Sitelink line 1 | 28 | Brand, NB | How It Works shows each step | NAV |
| 70 | You make every purchase decision | Sitelink line 2 | 32 | Brand, NB | Buyer makes every purchase decision | DEC |
| 71 | What We Handle for You | Sitelink text | 22 | Brand, NB | Links to what the service handles | NAV, ACT |
| 72 | Search, negotiation, fee review | Sitelink line 1 | 31 | Brand, NB | Full Service includes these three | FS |
| 73 | And what stays your decision | Sitelink line 2 | 28 | Brand, NB | Page lists what stays with the buyer | DEC, NAV |
| 74 | About Drive Right | Sitelink text | 17 | Brand, NB | Links to the About page | BR, NAV |
| 75 | Based in Austin, Texas | Sitelink line 1 | 22 | Brand, NB | Austin city base | ENT |
| 76 | Remote support nationwide | Sitelink line 2 | 25 | Brand, NB | Remote service for buyers anywhere in the US | ENT, NAT |
| 77 | Start Your Buying Brief | Sitelink text | 23 | Brand, NB | Starts the buying brief (CTA) | NAV |
| 78 | Tell us what you are looking for | Sitelink line 1 | 32 | Brand, NB | Brief collects the buyer's needs (CTA) | NAV |
| 79 | Then choose the plan that fits | Sitelink line 2 | 30 | Brand, NB | Plan is chosen after the brief (CTA) | NAV, P |

### Callouts

| # | Text | Type | Chars | Used in | What it claims | Evidence |
|---|---|---|---|---|---|---|
| 80 | We Negotiate for You | Callout | 20 | Brand, NB | The advisor negotiates the price | FS |
| 81 | We Contact the Dealers | Callout | 22 | NB | The advisor contacts dealers | ACT |
| 82 | Skip Hours at the Dealer | Callout | 24 | Brand, NB | The buyer spends fewer hours at dealerships | TIME |
| 83 | Fee Review Included | Callout | 19 | NB | Full Service includes fee review | FS |
| 84 | You Make Every Decision | Callout | 23 | Brand, NB | Buyer makes every purchase decision | DEC |
| 85 | Dedicated Advisor | Callout | 17 | Brand, NB | Each buyer gets a dedicated advisor | FS |
| 86 | One-Time Service Fee | Callout | 20 | Brand, NB | Both plans are one-time fees | P |
| 87 | Full Service $395 | Callout | 17 | NB | Full Service fee is $395 | P, LIVE |
| 88 | Ultimate Concierge $695 | Callout | 23 | NB | Ultimate Concierge fee is $695 | P, LIVE |
| 89 | Remote Support Nationwide | Callout | 25 | Brand, NB | Remote service for buyers anywhere in the US | ENT, NAT |
| 90 | Based in Austin, Texas | Callout | 22 | Brand | Austin city base | ENT |

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
