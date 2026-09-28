# Google Search ads copy: approval sheet (ADS-GOOGLE-2026-10)

Status: **awaiting Mason's signature. Not approved.** Prepared 2026-09-27. Nothing on this sheet is live. No ad may be enabled until the `ADS-GOOGLE-2026-10` row in `data/claims.csv` says `approved` (launch gate G4 in `docs/google-ads-launch-plan-2026-09-27.md`).

This sheet lists every string a searcher can see in the Google Ads Editor import files (`editor-import/06`-`10`, built from `plan.json` by `build-editor-csv.mjs`): 32 headlines, 13 descriptions, 15 sitelink strings, 10 callouts, 9 snippet strings, 5 display paths, 5 final URLs and 2 call-asset values: 91 rows in all. Each row says what the string claims and where the evidence is. Keywords, negatives, budgets and bidding are not shown to searchers, so they are not on this sheet. A string that is not on this sheet is not approved.

Signing approves exactly this text. Any later wording change needs a new approval.

## Sign-off (your only step)

1. Read the decisions below (D1-D6) and every row.
2. If you want anything struck or reworded, **don't sign and don't edit this file**. Tell me what to change. I'll update `plan.json`, rebuild the Editor files and regenerate this sheet so all three match.
3. Check that the sheet hasn't changed since it was prepared. This command must print the hash in the row's `claim_text`:
   ```bash
   shasum -a 256 outputs/2026-10-google-search-ads/ad-copy-approval.md
   ```
4. Change these five fields in the `ADS-GOOGLE-2026-10` row of `data/claims.csv`. Leave every other field as it is.

| Field | Now | After you sign |
|---|---|---|
| `status` | `pending_owner_confirmation` | `approved` |
| `reviewer` | blank | `Mason (business owner)` |
| `last_reviewed` | blank | the date you sign (YYYY-MM-DD) |
| `expires_on` | blank | `2026-12-21` or earlier (see D6) |
| `approved_copy` | blank | `outputs/2026-10-google-search-ads/ad-copy-approval.md sha256 <the hash from step 3>` |

A chat message, a checked box or a comment is not approval. Approval needs these fields filled in (`docs/claim-review-workflow.md`, step 5).

## Decisions only you can make

- **D1. Labels the site doesn't use.** These four headlines describe the service in words that don't appear on the site. "Car Buying Consultant" (the site says "advisor"), "Car Finder Service" (the site says "inventory search" and "sourcing"), "Car Concierge Service" and "Hire a Car Negotiator" (the site uses "car negotiator" but never "hire"). They're accurate descriptions of the service. Signing means you accept them as labels. Strike any you don't want.
- **D2. Plan inclusions are a promise to every buyer.** The plan-inclusion lines (sources FS and UC) repeat published plan cards, but their scope review is still open (`data/services.json:26`, `serviceLevelReview: pending_operations_confirmation`). Signing confirms that every Full Service buyer gets new, used and CPO inventory search, price negotiation, fee review, a dedicated advisor and documented recommendations. It also confirms that every Ultimate Concierge buyer additionally gets auctions, forums and niche-source searches and priority communication. None of these lines promises a price or an outcome.
- **D3. Delivery line (row flagged D3).** It uses the published wording "delivery coordination where available". That same wording is part of `CLM-030`, which is still `pending_owner_confirmation`. PR #85 (open) brings the Concierge intake form in line with it. Signing this sheet approves the ad line only, not `CLM-030`. Strike the row if you'd rather wait.
- **D4. Held-back lines are not on this sheet.** "No Dealer Commissions", "Paid Only by Our Customers" and "We are paid only by our customers, never by dealers, sellers or lenders." wait for `CLM-013` (compensation attestation, `docs/clm-013-compensation-attestation.md`). They then need their own exact-copy approval.
- **D5. Call hours (row flagged D5).** Your approved hours are Mon-Fri 09:00-17:00 Central. Google reads the call schedule in the Ads account's time zone. If the account isn't on Central time, the numbers must be converted in Editor before import (gate G3). The fact you're approving is the Central hours, not the digits.
- **D6. Expiry.** This approval rests on three approvals that expire at different times: the price (`SEO-PRICE-2026-09-27`, expires 2026-12-26), the hours (`ENT-HOURS-2026-09-22`, expires 2026-12-22) and the Austin base, service area and phone (`data/entities.json` approval, next review 2026-12-21). Use the earliest date, `2026-12-21`, or an earlier one. A change to the price, a plan's scope, the phone number or the hours voids the affected lines that same day.

Never in these ads without a separately approved claim: savings, time saved or speed; customer counts; reviews or testimonials; guarantees; refunds; "free"; best, lowest, perfect; "flat fee"; broker, licensed, fiduciary; financing or rates; "outreach to dozens of dealers"; "Not a dealership". No string on this sheet uses any of them.

## Evidence sources

Line numbers are for this branch as of 2026-09-27.

| Key | What it covers | Evidence |
|---|---|---|
| P | Plan names, the two prices, "one time" | `data/claims.csv` `SEO-PRICE-2026-09-27`: approved by Mason on 2026-09-27, expires 2026-12-26. Plan cards at `car-buying-service.html:184-206` ("$395 one-time service fee", "$695 one-time service fee"), `schedule.html:153` and `pricing.md`. Checkout amounts at `api/_lib/config.js:15` (39500) and `:20` (69500). Live Stripe prices, read 2026-09-27 on account `acct_1THdU32RwNuweXRL`: `price_1UKRa92RwNuweXRLDifV4iNz` "Full Service - $395" (USD 39500, one-time, active) and `price_1UKRaB2RwNuweXRL8LLSGR4C` "Ultimate Concierge - $695" (USD 69500, one-time, active). |
| LIVE | Landing pages match the ads | Fetched 2026-09-27: `/`, `/car-buying-service.html`, `/schedule.html`, `/how-it-works.html` and `/about.html` all return HTTP 200 with no `noindex`. Each shows $395 and $695 and no $295 or $895. |
| ENT | Austin base, United States service area, phone | `data/entities.json` approval block: owner confirmed 2026-09-21, next review 2026-12-21. Shown on the site at `car-buying-service.html:153`, `about.html:131` ("From Austin"), `how-it-works.html:115` and the `schedule.html:155` footer ("Based in Austin. Here for buyers nationwide."). |
| HRS | Call hours | `data/claims.csv` `ENT-HOURS-2026-09-22`: approved, expires 2026-12-22, Mon-Fri 09:00-17:00 America/Chicago. Shown on the site at `index.html:415`. |
| SVC | "Car buying (and negotiation) service" | `car-buying-service.html:152` H1 "Car buying and negotiation service."; `how-it-works.html:115` "an Austin-based car buying and negotiation service supporting buyers nationwide". |
| NAT | Remote, nationwide | `car-buying-service.html:153` and `schedule.html:153`: "supports buyers nationwide through remote research". Also `about.html:10`. |
| FS | Full Service inclusions | Plan card at `car-buying-service.html:188-194`: "Research, negotiation, and fee review with a dedicated advisor"; "New, used, and CPO inventory search"; "Price negotiation and fee review"; "Dedicated advisor through the process"; "Documented vehicle recommendations". The same list appears at `schedule.html:153`, `pricing.md:10` and `data/services.json:18-21`. The scope review is still open (D2). |
| UC | Ultimate Concierge inclusions | Plan card at `car-buying-service.html:203-206`: "Everything in Full Service"; "Auctions, forums, and niche sources"; "Priority communication and coordination"; "Delivery coordination where available". The same list appears at `pricing.md:16` and `data/services.json:35-40`. The scope review is still open (D2). |
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
| 3 | Car Buying Service | Headline | 18 | NB-Service | Drive Right is a car buying service | SVC |
| 4 | One-Time $395 Service Fee | Headline | 25 | NB-Service | Full Service fee is $395, one time | P, LIVE |
| 5 | Car Buying and Negotiation | Headline | 26 | Brand, NB-Service, NB-Negotiation | Service covers car buying and negotiation | SVC |
| 6 | Full Service: $395 One Time | Headline | 27 | Brand, NB-Service, NB-Negotiation, NB-Concierge, NB-Advisor | Full Service fee is $395, one time | P, LIVE |
| 7 | Ultimate Concierge: $695 | Headline | 24 | Brand, NB-Service, NB-Negotiation, NB-Concierge, NB-Advisor | Ultimate Concierge fee is $695 | P, LIVE |
| 8 | Remote Support Nationwide | Headline | 25 | Brand, NB-Service, NB-Negotiation, NB-Concierge, NB-Advisor | Remote service for buyers anywhere in the US | ENT, NAT |
| 9 | Austin-Based Car Buying Help | Headline | 28 | NB-Service | Austin city base; car buying service | ENT, SVC |
| 10 | New, Used and CPO Search | Headline | 24 | Brand, NB-Service, NB-Advisor | Full Service searches new, used and CPO inventory | FS |
| 11 | Negotiation and Fee Review | Headline | 26 | NB-Service, NB-Negotiation | Full Service includes negotiation and fee review | FS |
| 12 | A Dedicated Buying Advisor | Headline | 26 | Brand, NB-Service, NB-Negotiation, NB-Concierge, NB-Advisor | Each buyer gets a dedicated advisor | FS |
| 13 | You Make Every Decision | Headline | 23 | Brand, NB-Service, NB-Negotiation, NB-Concierge, NB-Advisor | Buyer makes every purchase decision | DEC |
| 14 | Compare Our Two Plans | Headline | 21 | Brand, NB-Service, NB-Concierge | Exactly two plans are offered (CTA) | P, NAV |
| 15 | See How Drive Right Works | Headline | 25 | Brand, NB-Service, NB-Negotiation | Links to the process (CTA) | NAV |
| 16 | Drive Right Car Buying Help | Headline | 27 | NB-Negotiation, NB-Advisor; pinned H1 | Business name + "car buying help" | BR, SVC |
| 17 | Car Negotiation Service | Headline | 23 | NB-Negotiation | Service includes car price negotiation | SVC, FS |
| 18 | Hire a Car Negotiator | Headline | 21 | NB-Negotiation | Buyer can hire Drive Right as a car negotiator **D1** | NEG, FS |
| 19 | Price Negotiation Help | Headline | 22 | NB-Negotiation | Full Service includes price negotiation | FS |
| 20 | Two Plans From $395 | Headline | 19 | NB-Negotiation, NB-Advisor | Two plans; lowest is $395 | P, LIVE |
| 21 | Car Buying Concierge | Headline | 20 | NB-Concierge | Ultimate Concierge plan name used as a category | P, UC |
| 22 | Car Concierge Service | Headline | 21 | NB-Concierge | Concierge plan described as a service **D1** | P, UC |
| 23 | Auctions and Niche Sources | Headline | 26 | NB-Concierge | Concierge searches auctions and niche sources | UC |
| 24 | Priority Communication | Headline | 22 | NB-Concierge | Concierge includes priority communication | UC |
| 25 | One-Time Concierge Fee | Headline | 22 | NB-Concierge | Concierge fee is one time | P |
| 26 | Car Finder Service | Headline | 18 | NB-Concierge | Category label; site says "inventory search" / "sourcing", never "car finder" **D1** | FS, UC |
| 27 | Car Buying Advisor | Headline | 18 | NB-Advisor | A dedicated advisor handles the buying work | FS |
| 28 | Car Buying Consultant | Headline | 21 | NB-Advisor | Category label; site says "advisor", never "consultant" **D1** | FS |
| 29 | Help Buying Your Next Car | Headline | 25 | NB-Advisor | General description of the service | SVC |
| 30 | Car Buying Help Nationwide | Headline | 26 | NB-Advisor | Service available to US buyers | SVC, NAT, ENT |
| 31 | Start Your Buying Brief | Headline | 23 | NB-Advisor | Starts the buying brief (CTA) | NAV |
| 32 | Drive Right, Based in Austin | Headline | 28 | Brand; pinned H1 | Business name; Austin city base | BR, ENT |
| 33 | Car buying help with inventory search, price negotiation and fee review. Plans from $395. | Description | 89 | NB-Service | Service includes search, negotiation, fee review; lowest plan $395 | FS, P, LIVE |
| 34 | Full Service is $395 and Ultimate Concierge is $695, one time. Vehicle costs are separate. | Description | 90 | Brand, NB-Service, NB-Negotiation, NB-Advisor | Both prices, one time; fee excludes vehicle costs | P, LIVE, EXC |
| 35 | A dedicated advisor searches new, used and CPO options and documents recommendations. | Description | 85 | Brand, NB-Service, NB-Advisor | Dedicated advisor; new/used/CPO search; documented recommendations | FS |
| 36 | Based in Austin with remote support nationwide. You make every purchase decision. | Description | 81 | NB-Service, NB-Negotiation, NB-Concierge | Austin base; remote US service; buyer decides | ENT, NAT, DEC |
| 37 | Full Service includes price negotiation and fee review for a $395 one-time fee. | Description | 79 | NB-Negotiation | Full Service inclusions and price | FS, P, LIVE |
| 38 | See what the service covers, what it costs and what stays your decision. | Description | 72 | NB-Negotiation | Landing page shows scope, price, buyer role (CTA) | NAV, DEC |
| 39 | Ultimate Concierge is $695 one time and includes everything in Full Service. | Description | 76 | NB-Concierge | Concierge price; includes all of Full Service | P, LIVE, UC |
| 40 | Concierge adds auctions, forums and niche sources plus priority communication. | Description | 78 | NB-Concierge | Concierge extras | UC |
| 41 | Delivery coordination where available. Delivery and vehicle costs are separate. | Description | 79 | NB-Concierge | Concierge coordinates delivery where available; fee excludes delivery and vehicle costs **D3** | UC, EXC |
| 42 | Price negotiation and fee review are included. You make every purchase decision. | Description | 80 | NB-Advisor | Full Service inclusions; buyer decides | FS, DEC |
| 43 | Austin-based car buying help with remote support for buyers nationwide. | Description | 71 | NB-Advisor | Austin base; remote US service | ENT, NAT, SVC |
| 44 | Drive Right is an Austin-based car buying and negotiation service for buyers nationwide. | Description | 88 | Brand | Brand; Austin base; service; US buyers | BR, ENT, SVC, NAT |
| 45 | Compare both plans, see how the process works and choose the help that fits your search. | Description | 88 | Brand | Two plans; process page (CTA) | P, NAV |

### Sitelinks

| # | Text | Type | Chars | Used in | What it claims | Evidence |
|---|---|---|---|---|---|---|
| 46 | Compare Plans and Pricing | Sitelink text | 25 | Brand, NB | Links to plans and prices (CTA) | NAV |
| 47 | Full Service is $395 one time | Sitelink line 1 | 29 | Brand, NB | Full Service fee is $395, one time | P, LIVE |
| 48 | Ultimate Concierge is $695 | Sitelink line 2 | 26 | Brand, NB | Ultimate Concierge fee is $695 | P, LIVE |
| 49 | How It Works | Sitelink text | 12 | Brand, NB | Links to the process page | NAV |
| 50 | See each step of the process | Sitelink line 1 | 28 | Brand, NB | How It Works shows each step | NAV |
| 51 | You make every purchase decision | Sitelink line 2 | 32 | Brand, NB | Buyer makes every purchase decision | DEC |
| 52 | Car Buying Service | Sitelink text | 18 | Brand, NB | Drive Right is a car buying service | SVC |
| 53 | Service scope and current fees | Sitelink line 1 | 30 | Brand, NB | Page shows scope and current fees | NAV, P |
| 54 | What the buyer stays in charge of | Sitelink line 2 | 33 | Brand, NB | Page lists what stays with the buyer | DEC, NAV |
| 55 | About Drive Right | Sitelink text | 17 | Brand, NB | Links to the About page | BR, NAV |
| 56 | Based in Austin, Texas | Sitelink line 1 | 22 | Brand, NB | Austin city base | ENT |
| 57 | Remote support nationwide | Sitelink line 2 | 25 | Brand, NB | Remote service for buyers anywhere in the US | ENT, NAT |
| 58 | Start Your Buying Brief | Sitelink text | 23 | Brand, NB | Starts the buying brief (CTA) | NAV |
| 59 | Tell us what you are looking for | Sitelink line 1 | 32 | Brand, NB | Brief collects the buyer's needs (CTA) | NAV |
| 60 | Then choose the plan that fits | Sitelink line 2 | 30 | Brand, NB | Plan is chosen after the brief (CTA) | NAV, P |

### Callouts

| # | Text | Type | Chars | Used in | What it claims | Evidence |
|---|---|---|---|---|---|---|
| 61 | One-Time Service Fee | Callout | 20 | Brand, NB | Both plans are one-time fees | P |
| 62 | Full Service $395 | Callout | 17 | NB | Full Service fee is $395 | P, LIVE |
| 63 | Ultimate Concierge $695 | Callout | 23 | NB | Ultimate Concierge fee is $695 | P, LIVE |
| 64 | Remote Support Nationwide | Callout | 25 | Brand, NB | Remote service for buyers anywhere in the US | ENT, NAT |
| 65 | Based in Austin, Texas | Callout | 22 | Brand, NB | Austin city base | ENT |
| 66 | Dedicated Advisor | Callout | 17 | Brand, NB | Each buyer gets a dedicated advisor | FS |
| 67 | New, Used and CPO Search | Callout | 24 | NB | Full Service searches new, used and CPO inventory | FS |
| 68 | Price Negotiation | Callout | 17 | NB | Full Service includes price negotiation | FS |
| 69 | Fee Review | Callout | 10 | NB | Full Service includes fee review | FS |
| 70 | Vehicle Recommendations | Callout | 23 | NB | Full Service includes documented vehicle recommendations | FS |

### Structured snippets

| # | Text | Type | Chars | Used in | What it claims | Evidence |
|---|---|---|---|---|---|---|
| 71 | Service catalog | Snippet header | 15 | NB | Google-defined snippet header (no claim) | NAV |
| 72 | Inventory Search | Snippet value (Service catalog) | 16 | NB | Full Service includes inventory search | FS |
| 73 | Price Negotiation | Snippet value (Service catalog) | 17 | NB | Full Service includes price negotiation | FS |
| 74 | Fee Review | Snippet value (Service catalog) | 10 | NB | Full Service includes fee review | FS |
| 75 | Vehicle Recommendations | Snippet value (Service catalog) | 23 | NB | Full Service includes documented vehicle recommendations | FS |
| 76 | Types | Snippet header | 5 | NB | Google-defined snippet header (no claim) | NAV |
| 77 | New Cars | Snippet value (Types) | 8 | NB | Search covers new cars | FS |
| 78 | Used Cars | Snippet value (Types) | 9 | NB | Search covers used cars | FS |
| 79 | Certified Pre-Owned | Snippet value (Types) | 19 | NB | Search covers CPO | FS |

### Display paths

| # | Text | Type | Chars | Used in | What it claims | Evidence |
|---|---|---|---|---|---|---|
| 80 | car-buying/service | Display path | 18 | NB-Service | Display path (no claim) | NAV |
| 81 | car-buying/negotiation | Display path | 22 | NB-Negotiation | Display path (no claim) | NAV |
| 82 | concierge/pricing | Display path | 17 | NB-Concierge | Display path (no claim) | NAV |
| 83 | car-buying/help | Display path | 15 | NB-Advisor | Display path (no claim) | NAV |
| 84 | car-buying | Display path | 10 | Brand | Display path (no claim) | NAV |

### Final URLs

| # | Value | Type | Used in | What it claims | Evidence |
|---|---|---|---|---|---|
| 85 | `https://www.driverightcarbuying.com/car-buying-service.html` | Final URL | Brand, NB, NB-Service, NB-Negotiation | Landing page; live 200, indexable, shows $395/$695 and no $295/$895 | LIVE |
| 86 | `https://www.driverightcarbuying.com/schedule.html` | Final URL | Brand, NB, NB-Concierge | Landing page; live 200, indexable, shows $395/$695 and no $295/$895 | LIVE |
| 87 | `https://www.driverightcarbuying.com/` | Final URL | Brand, NB, NB-Advisor | Landing page; live 200, indexable, shows $395/$695 and no $295/$895 | LIVE |
| 88 | `https://www.driverightcarbuying.com/how-it-works.html` | Final URL | Brand, NB | Landing page; live 200, indexable, shows $395/$695 and no $295/$895 | LIVE |
| 89 | `https://www.driverightcarbuying.com/about.html` | Final URL | Brand, NB | Landing page; live 200, indexable, shows $395/$695 and no $295/$895 | LIVE |

### Call asset

| # | Value | Type | Used in | What it claims | Evidence |
|---|---|---|---|---|---|
| 90 | `(512) 910-4938 (US)` | Call: phone | Brand, NB | Business phone | ENT, HRS |
| 91 | `(Monday[09:00-17:00]);(Tuesday[09:00-17:00]);(Wednesday[09:00-17:00]);(Thursday[09:00-17:00]);(Friday[09:00-17:00])` | Call: schedule | Brand, NB | Calls answered Mon-Fri 09:00-17:00 (account time zone) **D5** | HRS |
