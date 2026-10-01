# Drive Right: Google Search ads launch plan (first 30 days)

**Status:** approved by the owner on September 27, 2026, in the planning session. Launch gates G1–G5 are open, and no campaign is enabled.

Related files:
- Campaign files: `outputs/2026-10-google-search-ads/`
- Account steps: [google-ads-setup.md](google-ads-setup.md)
- Compensation claim fast track: [clm-013-compensation-attestation.md](clm-013-compensation-attestation.md)

The approved text is kept verbatim below. In it, "you" is the owner and "I" is the assistant that prepared it.

## Implementation notes (September 27, 2026)

- **Setup doc moved.** `docs/google-ads-setup.md` ships with the docs change instead of the tracking PR, so every account step is available at once.
- **Negatives are campaign-level.** Non-brand negatives import as campaign negatives, not a shared list, because there is only one non-brand campaign. The Editor import is simpler this way.
- **The checker blocks until G2.** `plan.json` keeps `tracking.primary_conversion_verified: false` until gate G2 passes, so `gads_tools.py check` blocks until then by design.
- **Prices changed after approval.** On September 27, 2026 the owner moved Full Service from $295 to $395 and Ultimate Concierge from $895 to $695 (PR #84, claim `SEO-PRICE-2026-09-27`). Every price, amount and conversion value in the approved text below, in `plan.json`, in the Editor files and in the copy sheet was updated to match. Nothing else in the approved text changed.
- **G1 detail.** The owner reports the live $395/$695 Payment Links and the Vercel production env vars were updated on September 27. G1 still needs the checks in `outputs/2026-10-google-search-ads/stripe-checklist.md` (promo codes, tax, descriptions, a look at each checkout).
- **Generator added.** `outputs/2026-10-google-search-ads/build-editor-csv.mjs` rebuilds the Editor files from `plan.json`, and `--check` detects drift.

---

## Context

Drive Right (www.driverightcarbuying.com) is an Austin-based car buying and negotiation service. It supports buyers nationwide remotely and sells two one-time service fees, paid up front through Stripe: **Full Service $395** and **Ultimate Concierge $695**.

Organic search brings little business today: 21 clicks in the last 28 days. "Car buying service" had 152 impressions and 0 clicks.

The goal is to learn whether Google Search can win paying customers for **≤ $150 of ad spend each**, within a **$1,500 cap for the first 30 days**.

Three facts shape the plan:
1. **Google Ads can't see a real sale today.** The existing account (`AW-18071301983`, inside GTM `GTM-W577B3D4`) counts clicks on old button text ("Book Now — $1,850"), phone-link clicks and every form submit, including each homepage chat answer. No purchase reaches Google.
2. **The ad landing pages have no lead step.** Visitors go from "Choose this plan" straight to Stripe, so the only real conversion is a verified purchase.
3. **Only prices, hours, email, phone, the Austin base and the US service area are approved copy** (`data/claims.csv`, `data/entities.json`). Dollar savings, speed, reviews, guarantees, refunds, "free", "best/lowest" and "no dealer commissions" stay out of ads until approved. Time-saving lines rest on the owner's statement of September 27 and go live with the rest of the copy through G4.

## Your decisions

| Topic | Decision |
|---|---|
| Budget | $1,500 for the first 30 days, as $49/day: $46 non-brand plus $3 brand (×30.4 = $1,489.60) |
| Geography | United States, people *in* the location (Presence only), English |
| Break-even | $150 ad spend per paying customer, both plans blended |
| Account | Existing account with old campaigns: audit and pause first |
| Excluded searches | Broker, lease, membership programs (Costco, USAA, AAA and similar), Carvana/CarMax/TrueCar and similar |
| Calls | Call button Mon–Fri 9:00–17:00 Central |
| Dealer pay | Customers are the only payer. Fast-track approval of "No dealer commissions" (CLM-013); ads use it only after approval |
| How changes get in | I generate a Google Ads Editor import with everything **paused**, plus checklists. You import, review and enable |

## Launch gates: all must pass before anything is enabled (Week 0, Mon Sep 28 – Fri Oct 2)

| # | Gate | Who | Why |
|---|---|---|---|
| G1 | **Live Stripe checkout is right.** Full Service charges $395; Concierge charges $695 (new live links reported set on Sep 27). Product descriptions drop old claims ("lowest price", "average savings $1,500–$4,000", "door-to-door"). Promo codes are off, and tax doesn't change the total. Any total other than exactly 39500/69500 cents records no purchase, fires no conversion and breaks onboarding. | You, in Stripe; I list every link, amount and text to check | `data/services.json:24-27`, `docs/seo-execution/stripe-cutover.md:13-34`, `api/stripe-webhook.js:62-71` |
| G2 | **Purchase tracking works end to end.** PR 1 below plus GTM and Google Ads setup, verified in GTM Preview on a Vercel preview with Stripe in test mode. Then one live purchase by you, refunded (about $9 in Stripe fees) and retracted in Google Ads by transaction ID. | Me (code), you (merge, GTM publish, test purchase) | Today's conversions would train bidding on chat turns and phone-link clicks |
| G3 | **Account cleaned.** Old campaigns paused. Legacy conversion actions set to secondary. Recommendation auto-apply off. Auto-tagging on. Account time zone noted. Advertiser verification, billing and Policy Manager checked. | You, following my checklist | Old campaigns would spend against the cap and pollute bidding |
| G4 | **Ad copy approved.** One claims row per the workflow, `ADS-GOOGLE-2026-10`, lists every asset's exact text with reviewer, date and expiry. | Mason | `docs/claim-review-workflow.md`: only approved copy goes on a new surface |
| G5 | **Checks pass.** `gads_tools.py check` passes (already dry-run: 0 errors). Editor's "Check changes" is clean. Everything posts **paused**, and I read it back against `plan.json`. | Me, then you | Plan → check → validate → create paused → enable |

If a gate slips, launch slips.

## Strategy

| Campaign | Daily budget | Bidding | Keywords | Landing pages |
|---|---|---|---|---|
| **Search \| NonBrand \| Car Buying Service \| US** | $46 | Maximize conversions, no target. The campaign goal is "Purchase – verified" only | Exact + phrase, 4 ad groups | `/car-buying-service.html`, `/schedule.html`, `/` |
| **Search \| Brand \| Drive Right \| US** | $3 | Maximize clicks, $2 CPC ceiling | Exact + phrase brand terms | `/` |

Both campaigns use the same settings:
- Google Search only: Search Partners off, Display Expansion off.
- US, Presence targeting, English.
- All hours and devices.
- AI Max off: no search term matching, text customization or final URL expansion. No broad match.
- In-market "Motor vehicles" audiences in observation only.
- Account final URL suffix `utm_source=google&utm_medium=cpc&utm_campaign={campaignid}&utm_content={adgroupid}&utm_term={keyword}`, so the site's own purchase ledger marks paid clicks.

Why:
- **Exact + phrase only.** This is a new account with no conversion history. Broad match and AI Max wait for verified conversions and mature negatives.
- **Purchase is the only primary goal.** Checkout starts, phone clicks and calls of 60s or more are secondary signals that don't steer bids.
- **No bid target yet.** Google allows Smart Bidding with no history. Waiting for about 30 purchases before setting Target CPA is this skill's heuristic, not a Google rule.
- **Brand is cheap insurance** for `drive right car buying` searches. Bare "drive right" isn't bid on, because it collides with "Drive Right Auto Sales".
- **No A/B tests in 30 days.** A copy test needs roughly 1,500–3,800 clicks per variant; the month buys about 300–400 clicks.

**Budget guard.** Google may spend 2× the daily budget on one day, and its 30.4× limit runs per *calendar* month, while the window runs Oct 5 – Nov 3. So:
- keep cumulative spend at or below $50 × days elapsed, plus 5%;
- on Fri Oct 30, set the remaining budgets to ($1,500 − spent) ÷ 5 days.

## Content

### Ad groups and keywords (non-brand)

Seeds come from Search Console (`docs/seo-execution/query-map.csv`). On Day 0, Keyword Planner supplies bid ranges, and keywords with no volume are dropped. The September 27 run dropped five non-brand keywords. Brand keywords stay even without volume (owner decision, September 27). Results are in `outputs/2026-10-google-search-ads/keyword-planner/`.

| Ad group | Landing page | Keywords (`[exact]`, `"phrase"`) |
|---|---|---|
| Car Buying Service | `/car-buying-service.html` | [car buying service], "car buying service", [car buying services], "nationwide car buying service", [car buying agent], "car buying agent", "car buying service cost" |
| Car Negotiation | `/car-buying-service.html` (see note) | [car negotiation service], "car negotiation service", [car negotiator], "car negotiator", "car price negotiation service", "hire someone to negotiate car price", "car buying negotiator" |
| Car Buying Concierge | `/schedule.html` | [car buying concierge], "car buying concierge", "car concierge service", [car finder service], [car locator service] |
| Car Buying Advisor | `/` | [car buying advisor], "car buying advisor", [car buying consultant], "car buying consultant", [car shopping service], "personal car shopper", [help buying a car] |
| Brand (brand campaign) | `/` | [drive right car buying], "drive right car buying", [driveright car buying], [driverightcarbuying], [driverightcarbuying.com] |

Why Car Negotiation doesn't use `/how-it-works.html` yet: that page's "Compensation and independence disclosure" says dealer-compensation statements are "pending owner attestation". It asks visitors to request a written disclosure before paying, which is friction for paid clicks. The explainer page (H1 "Car buying and negotiation service.") is used until CLM-013 is approved. How It Works stays a sitelink.

### Negative keywords

**Non-brand shared list "DR NonBrand Negatives v1"** (phrase unless marked). Negatives don't match close variants, so the Editor file adds plurals and spacing variants (careers, leases, rentals, "car max", "true car", "auto trader" and so on).
- **Own brand:** drive right, driveright, driverightcarbuying
- **Selling or appraising a car** ("car buying service" often means *we buy your car*): sell, selling, we buy, buy my car, cash for, junk, scrap, instant offer, trade in value, trade-in value, what is my car worth
- **Excluded by you:**
  - broker
  - lease, leasing
  - costco, usaa, aaa, sams club, sam's club, credit union, navy federal, penfed
  - carvana, carmax, truecar, autotrader, cargurus, vroom, cars.com
- **Jobs and education:** jobs, job, career, careers, salary, hiring, how to become, course, courses, training, license, licensed
- **Wrong service:** driving school, driving lessons, driving test, dmv, rental, rent a car, insurance, repair, mechanic, parts, detailing, valet, oil change, shipping, transport, gps, tracker
- **Financing:** financing, bad credit, buy here pay here, car loan, auto loan
- **Retired AI offer:** ai
- **Free-program intent:** [free car buying service], [free car buying services]. These are exact on purpose: a bare "free" would block "stress free car buying".
- **Out-of-scope vehicles:** motorcycle, boat, forklift, tractor

**Brand campaign** (the "Drive Right Auto Sales" collision): auto sales, motors, automotive, dealership, inventory, for sale, driving school, insurance, tires.

The collision check passed: no negative blocks one of our keywords.

### Responsive search ads

Two or three brand headlines are pinned to H1 in every ad (Google's Limited Ad Serving guidance for newer advertisers). In non-brand ads, three questions about the searcher's problem are pinned to H2, so each ad names the problem right after the brand and a question never sits next to another question. Every other headline and description sells the answer: time and sanity back, the legwork and haggling done for the buyer, a better deal, and the final call staying theirs. Price appears once per ad as a qualifier. The service is explained on the landing pages, not in the ads (owner direction, September 27). Time lines rest on the owner's statement of September 27 ("We save people time. That is the whole purpose of the service."); better-deal lines are worded as the aim, never as "best" or "lowest" (`CLM-014`).

Shared descriptions:
- **D-Skip:** "Skip the hours at the dealer. We search, contact dealers and negotiate for a better deal."
- **D-Sanity:** "Save your time and your sanity. Tell us what you want and we handle the dealer for you."
- **D-Legwork:** "Hours at the dealer, nights on listing sites, or one advisor doing the legwork for $395."
- **D-GoodDeal:** "Not sure it's a good deal? We compare offers, check the fees and tell you what we'd do."
- **D-Price:** "Full Service is $395 and Ultimate Concierge is $695, one time. Vehicle costs are separate."

**Car Buying Service**
- Path: `car-buying/service`
- H1 pinned: Drive Right Car Buying · Drive Right Buying Service
- H2 pinned: Dreading the Dealership? · No Time to Shop for a Car? · Not Sure It's a Good Deal?
- Headlines: Save Your Time and Your Sanity · Skip the Hours at the Dealer · Car Buying, Handled for You · Stop Scrolling Car Listings · We Haggle So You Don't Have To · We Tell You If It's a Bad Deal · Get Your Weekends Back · A Negotiator in Your Corner · We Negotiate. You Decide. · From $395, One Time
- Descriptions:
  - D-Skip
  - D-Sanity
  - D-Legwork
  - D-GoodDeal

**Car Negotiation**
- Path: `car-buying/negotiation`
- H1 pinned: Drive Right Car Buying Help · Drive Right Buying Service
- H2 pinned: Hate Haggling Over Price? · Outmatched by the Salesperson? · Worried About Overpaying?
- Headlines: Bring Your Own Car Negotiator · Salespeople Haggle All Day · Now You Have a Negotiator Too · We Haggle So You Don't Have To · We Fight for a Better Price · Fees Checked Before You Sign · We Tell You If It's a Bad Deal · Save Your Time and Your Sanity · We Negotiate. You Decide. · From $395, One Time
- Descriptions:
  - "Salespeople negotiate every day. Now you have a negotiator too, for a one-time $395 fee."
  - "Hate haggling? Send us in. We negotiate the price and check the fees before you sign."
  - "Worried about overpaying? We compare offers and push for a better price before you sign."
  - D-Sanity

**Car Buying Concierge**
- Path: `concierge/pricing`
- H1 pinned: Drive Right Car Buying · Drive Right Buying Service
- H2 pinned: Can't Find the Car You Want? · Too Busy to Shop Around? · Tired of Endless Listings?
- Headlines: Your Car Buying Concierge · A Car Finder Who Haggles Too · We Search Beyond the Lot · Auctions and Niche Sources · Stop Scrolling Car Listings · We Do the Legwork. You Decide. · Save Your Time and Your Sanity · Save Hours of Searching · Get Your Weekends Back · Ultimate Concierge: $695
- Descriptions:
  - "Can't find the car you want? We search past the dealer lot, auctions and forums included."
  - "Too busy to shop around? Ultimate Concierge does the searching and the haggling for $695."
  - "Stop scrolling listings and sitting in dealerships. We do the legwork. You make the call."
  - D-Sanity

**Car Buying Advisor**
- Path: `car-buying/help`
- H1 pinned: Drive Right Car Buying Help · Drive Right Buying Service
- H2 pinned: Overwhelmed by Car Buying? · Not Sure Which Car to Buy? · No Time to Car Shop?
- Headlines: Your Personal Car Shopper · Help Buying Your Next Car · Save Your Time and Your Sanity · Skip the Hours at the Dealer · Stop Scrolling Car Listings · We Tell You If It's a Bad Deal · We Haggle So You Don't Have To · Get Your Evenings Back · We Negotiate. You Decide. · From $395, One Time
- Descriptions:
  - "Overwhelmed by car buying? One advisor handles the search, the dealers and the haggling."
  - "Get your evenings back. We research, contact dealers and negotiate. You make the call."
  - D-GoodDeal
  - D-Legwork

**Brand**
- Path: `car-buying`
- H1 pinned: Drive Right Car Buying · Drive Right Buying Service · Drive Right, Based in Austin
- Headlines: Save Your Time and Your Sanity · Skip the Hours at the Dealer · We Negotiate. You Decide. · Let Us Do the Legwork · A Negotiator in Your Corner · Car Buying and Negotiation · Full Service: $395 One Time · Ultimate Concierge: $695 · Compare Our Two Plans · See How Drive Right Works · Remote Support Nationwide · Start Your Buying Brief
- Descriptions:
  - "Drive Right is an Austin-based car buying and negotiation service for buyers nationwide."
  - D-Price
  - D-Skip
  - "Compare both plans, see how the process works and choose the help that fits your search."

### Assets (both campaigns)

**Sitelinks** (text | description 1 | description 2 → page):
- Compare Plans and Pricing | Full Service is $395 one time | Ultimate Concierge is $695 → `/schedule.html`
- How It Works | Tell us what you want | We search, haggle, you decide → `/how-it-works.html`
- What We Handle for You | The search, the dealers, the haggle | And what stays your decision → `/car-buying-service.html`
- About Drive Right | Based in Austin, Texas | Remote support nationwide → `/about.html`
- Start Your Buying Brief | Describe the car you want | Then we get to work → `/`

There are five, not six, on purpose. The blog, policy page and Texas hub carry content still pending review.

**Callouts:**
- Non-brand: We Haggle for You · We Contact the Dealers · We Sort the Listings · Skip Hours at the Dealer · Fee Check Before You Sign · You Make Every Decision · One-Time Service Fee · Full Service $395 · Ultimate Concierge $695 · Remote Support Nationwide
- Brand: We Haggle for You · Skip Hours at the Dealer · You Make Every Decision · One-Time Service Fee · Remote Support Nationwide · Based in Austin, Texas · Dedicated Advisor

**Structured snippets:**
- Service catalog: Inventory Search, Price Negotiation, Fee Review, Vehicle Recommendations
- Types: New Cars, Used Cars, Certified Pre-Owned

**Call asset:** (512) 910-4938, scheduled Mon–Fri 9:00–17:00 Central (set in the account's time zone), with call reporting on. "Calls from ads ≥ 60s" is a secondary conversion.

**Not at launch:**
- Business name and logo: need advertiser verification and a logo file.
- Images: rights to the photos aren't established.
- Price asset: needs at least 3 items, and there are 2 plans.
- Promotions: there are none.
- Lead form: no privacy or CRM setup.
- Location: the Business Profile isn't public.

### Copy sources and blocked claims
- **Approved today:**
  - Plan names and prices: `SEO-PRICE-2026-09-27`, expires 2026-12-26.
  - Austin base, US service area, phone and hours: `data/entities.json` owner approval.
- **Live on the site but needing ad-copy approval (G4):**
  - Inventory search (new, used, CPO), price negotiation and fee review, dedicated advisor, documented recommendations.
  - Concierge extras (auctions, forums and niche sources; priority communication; delivery coordination where available).
  - "You make every purchase decision" (`car-buying-service.html:160`, `pricing.md:21`).
  - "Car negotiator" wording (the `schedule.html` title).
  - Contacting dealers and comparing offers (`car-buying-service.html:153`, `:159`, `:166`).
  - Time and sanity saved ("Save Your Time and Your Sanity", "Skip the Hours at the Dealer", "Get Your Weekends Back"): the owner's statement of September 27; the homepage headline already says "Skip the hours at the dealer."
  - A better deal ("We Fight for a Better Price", "We Tell You If It's a Bad Deal"): the advisor's negotiation, fee review and documented recommendations, worded as the aim. "Best" and "lowest" stay out (`CLM-014`, `revise_to_bounded_language`).
  - Questions about the searcher's problem, pinned to H2 ("Dreading the Dealership?"). They make no claim about Drive Right.
- **Never in ads without approval:**
  - Dollar savings or speed; customer counts; reviews or testimonials.
  - Guarantees, refunds, "free".
  - best, lowest, perfect.
  - "flat fee" (the approved wording is "one-time service fee").
  - broker, licensed, fiduciary; financing or rates.
  - "outreach to dozens of dealers"; "Not a dealership" (the owner had that disambiguation removed on Sep 25).

### "No dealer commissions" fast track (CLM-013)
1. You sign a written attestation that revenue comes only from customer fees: no referral, commission or spiff from dealers, sellers, lenders, insurers or affiliates.
2. You keep the evidence (Stripe payouts and statements); it isn't committed to the repo.
3. The reviewer named on the CLM-013 row approves the exact wording and expiry.
4. One release replaces the disclosure at `how-it-works.html:127`. Car Negotiation can then move to How It Works as a logged landing-page change.
5. The ads then add:
   - headlines "No Dealer Commissions", "Paid Only by Our Customers" and "On Your Side, Not the Dealer's";
   - a callout "No Dealer Commissions";
   - the line "We are paid only by our customers, never by dealers, sellers or lenders." (72 characters).

The checker already passes this variant. It goes in as one logged creative change and never before approval.

## Tracking changes (code in this repo; branch first, since every push to `main` deploys)

### PR 1: launch-critical (needed for G2)

1. **`api/purchase-status.js`.** Return `value` and `currency` from the purchase ledger row (`amount_total/100`, so historical prices stay right), via a small exported `verifiedPurchaseBody()`.
2. **`script.js`:**
   - `track()` accepts `purchase_verified`, keyed by `transaction_id`. It's deduped across refresh like the existing `lead:`/`checkout:` events.
   - `track()` gains a `{beforeNavigation}` option. It pushes with `eventCallback` and a 1-second `eventTimeout`, and resolves immediately when GTM is absent or blocked. Checkout never waits more than 1 second.
   - `initializePaidOnboarding` calls a new `trackVerifiedPurchase()` only in the `verified` branch. It sends the server's `purchase_id`, value, currency and tier. Processing, unverified, not-found, errors and a missing value never fire. This keeps `docs/implementation-operations.md:3` intact: a page load alone is still not evidence.
   - `startCheckout` awaits `begin_checkout` before the Stripe redirect.
3. **`buying/checkout.js` `runDirect`/`run`** (the `/schedule.html` plan buttons). Same awaited `begin_checkout`, inside try/catch.
4. **Hash cascade.**
   - New `checkout.js?v=` in `buying/app.js:3`.
   - New `script.js?v=` and `app.js?v=` on the 12 pages that load them, including the 4 `payment-success*` pages. `node scripts/validate-site.mjs` prints the URLs.
   - Then run `npm run draft:cities`.
5. **Tests.**
   - New `api/_tests/purchase-verified-client.test.mjs`: one event per verified purchase, with the server's ID, value and tier; none on reload, processing, unverified, not-found, network error or missing value.
   - Extend `direct-checkout-client`, `attribution-client`, `buying/brief.test.js`, `offer-transition` and `backend` tests. They cover: push → callback → redirect order, redirect within about 1 second when GTM never answers, no delay without GTM, and the new value field.
6. **Docs.** Update the purchase-status contract in `docs/implementation-operations.md`. New `docs/google-ads-setup.md` with the account checklist below, linked from `docs/README.md` under Advertising.
7. **Constraints respected.**
   - Only `dataLayer.push`: the validator rejects `gtag()` loaders, config and conversion calls in pages (`scripts/validate-site.mjs:474-488`).
   - `script.js` lines 1-2 stay untouched, because a test strips them.
   - Timers and navigator go through `window.`, and there's no `Object.hasOwn` (old Safari).

### PR 2: store ad click IDs (ships with an approved privacy-policy update; not a launch gate)

- **`script.js` `attribution()`.**
  - Capture `gclid`, `gbraid` and `wbraid` in first and last touch; a new ad click starts a new last touch.
  - Malformed IDs are dropped silently, never sent as a 422.
  - IDs are skipped and scrubbed when the browser sends Global Privacy Control.
- **`api/_lib/validation.js` `validateAttributionTouch`.** Allowlist the IDs, adding keys only when valid so today's duplicate-request hashes don't change. They're stored in `checkout_attempts.attribution` (no migration) and not forwarded to the analytics collector.
- **`policy.html`.** Disclose stored ad click IDs and fix outdated mentions:
  - Google Analytics is named but not installed.
  - Microsoft Clarity isn't disclosed.
  
  This is legal-class text, so it needs qualified review.
- **Why it's worth it:** reconciliation by click ID now, offline conversion import later. Until then, the final URL suffix UTMs mark paid purchases in the ledger.

### Known limits accepted for launch
- **Totals that aren't exactly $395/$695** record no purchase. G1 fixes promo codes and tax.
- **Stripe webhook later than about 15 seconds:** the confirmation page shows an error and no conversion fires. The weekly reconciliation of the ledger against Google Ads catches the gap.
- **Ad blockers and Safari limits** undercount browser conversions. Reconciliation covers this now; offline import after PR 2.

## Account setup checklist (you apply; exact steps go in `docs/google-ads-setup.md`)

- **GTM** (container `GTM-W577B3D4`), one new version:
  - **Variables:** dataLayer `transaction_id`, `value`, `currency`, `service_tier`, `checkout_attempt_id`; JavaScript variable "JS – GPC" = `navigator.globalPrivacyControl`.
  - **Consent Initialization** (all pages): when GPC is on, deny `ad_user_data` and `ad_personalization`. Whether to also deny `ad_storage` is an owner/legal call.
  - **Triggers** (all require Page Hostname = `www.driverightcarbuying.com`): custom events `purchase_verified` (also `service_tier` ∈ full_service|concierge and value > 0), `begin_checkout`, `phone_click`.
  - **Tags:**
    - New "Purchase – verified" Google Ads conversion with value, transaction ID and currency.
    - New "Begin checkout" with transaction ID = checkout attempt ID.
    - Re-point the existing **Call Button** tag to `phone_click`; no second phone tag.
    - Pause Book Appointment, Schedule Free Call and Submit Lead Form.
    - Keep the Google tag and Conversion Linker.
    - Strip the query string from `page_location` on `/payment-success*`, so the Stripe session ID isn't sent to Google.
  - **Confirm automatic enhanced conversions / user-provided data are off.** The payment pages' onboarding form collects name, email and phone.
  - **Test and publish:** test on a Vercel preview (conversion tags show "Not fired" because of the hostname condition, with the variables filled). Publish only after PR 1 is live.
- **Google Ads:**
  - "Purchase – verified": Purchase category, primary and the campaign's only goal, count Every (deduped by transaction ID), value from tag, 30-day click window, data-driven attribution.
  - "Begin checkout" and "Call Button" (phone click): secondary, count One. Calls from ads ≥ 60s: secondary.
  - Legacy actions: set to secondary, then remove once they stop firing.
  - Auto-tagging on; final URL suffix set; auto-apply off; old campaigns paused; enhanced conversions off.
  - Run Keyword Planner on the keyword list and export the results for me.

## 30-day operating plan

| When | What happens | Changes allowed |
|---|---|---|
| **Week 0** (Sep 28 – Oct 2) | Gates G1–G5; PR 1 merged; GTM published; test purchase; Keyword Planner; paused import; your final review | Build only |
| **Launch** (Mon Oct 5) | You enable both campaigns in the morning, when calls get answered | Enable only |
| **Days 1–7** (Oct 5–11) | Daily: search terms, spend vs $49/day, disapprovals, landing pages return 200, checkouts appearing | Exact negatives for obviously irrelevant 0-conversion terms (logged). No bid, budget or copy changes. |
| **Days 8–14** (Oct 12–18) | Search terms every 2 days; word-fragment review; "Limited by budget" and impression share | Phrase negatives after a collision check. **Safety check at $450 spend** (3× target) with 0 purchases: alert and diagnose the funnel, don't cut bids. |
| **Days 15–21** (Oct 19–25) | Weekly review; asset labels used as diagnostics only | If CLM-013 is approved, add the commission assets (one logged change). Keyword pause only if spend ≥ $300, 0 purchases, and a binomial test at p < 0.05 against p0 = CPC ÷ $150 (at a $4 CPC that takes about 110 clicks). |
| **Days 22–30** (Oct 26 – Nov 3) | Weekly review; budget guard on Fri Oct 30; Nov 3 data pull; ledger vs Google Ads reconciliation | Only the budget guard |

- **Pre-set day-14 fallback** (needs your approval): if there are fewer than 2 verified purchases but 15 or more checkout starts, propose making `begin_checkout` a primary conversion so bidding gets signal.
- **Emergency stops** (pause first, then alert):
  - a landing page is down or "Destination not working" appears;
  - spend is on pace to exceed the cap by more than 5%;
  - brand-unsafe query spend;
  - an account policy notice;
  - clicks keep coming but checkouts stop for 3 or more days (tracking alarm: freeze changes).
- **Reviews:** Mondays Oct 12, 19, 26 and Nov 2, plus the day-30 report on Nov 3. Each covers:
  - spend vs cap, clicks, CTR, CPC;
  - checkouts, verified purchases (ledger), CPA;
  - top search terms and negatives added;
  - the change log and pending approvals.
- **Data access:** before each review, you export the Campaign, Search terms and Keyword reports. Alternatively, connect Google's read-only Google Ads MCP and I run the queries myself.

## Day-30 decision rules (fixed now, judged on verified Stripe purchases, about $1,470 spent)

| Verified purchases | CPA | Decision | Error check |
|---|---|---|---|
| ≥ 10 | ≤ about $147 | **Scale** with your new cap: budget +≤20% per step every 1–2 weeks while CPA ≤ $150. Consider Target CPA after about 30 purchases in 30 days. | If the true CPA were $300, only a 3% chance of scaling by mistake |
| 4–9 | about $163–$368 | **Hold and fix.** Keep the budget flat, work on the funnel and pending approvals, and run 30 more days. | — |
| ≤ 3 | ≥ about $490 | **Stop and rethink.** Pause non-brand, keep brand, and review the offer, pages and tracking. | If the true CPA were $150, only a 1% chance of stopping by mistake |

Guardrails: search-term quality, refunds (net revenue) and your client capacity.

## What I'll produce after you approve (on branches; you merge)

1. **PR 1: tracking** (code, tests, hashes, `docs/implementation-operations.md`, `docs/google-ads-setup.md`).
2. **PR 2: click IDs plus the proposed policy text**, marked as waiting for policy review.
3. **Docs PR** (nothing in it is deployed):
   - `docs/google-ads-launch-plan-2026-09-27.md`: this plan as the decision record, linked from `docs/README.md`.
   - `outputs/2026-10-google-search-ads/`:
     - `INDEX.md`
     - `plan.json` (checker input)
     - `editor-import/` CSVs for campaigns, ad groups, keywords, negatives, RSAs, sitelinks, callouts, snippets and the call asset, all paused
     - `stripe-checklist.md`
     - `change-log.md`
   - `data/claims.csv`:
     - `ADS-GOOGLE-2026-10` (exact ad copy, `pending_owner_confirmation`, approval fields blank)
     - notes for the CLM-013 attestation packet

## Verification

- `python3 ~/.claude/skills/google-search-ads/gads_tools.py check outputs/2026-10-google-search-ads/plan.json` must report 0 errors. The two warnings (five sitelinks) are justified above.
- These must pass on Node 24: `node scripts/validate-site.mjs && npm run check:api && npm run check:buying && npm run check:metros && npm run check:cities && npm test && git diff --check`, plus `node scripts/check-redirects.mjs --config-only`.
- On a Vercel preview with Stripe in test mode, GTM Preview must show:
  - `begin_checkout` before the redirect, from both `/car-buying-service.html` and `/schedule.html`;
  - `purchase_verified` exactly once with the purchase UUID, 395/695 and USD;
  - no second event on refresh;
  - an immediate redirect when `googletagmanager.com` is blocked.
- In production, one test purchase by you must:
  - fire in Tag Assistant;
  - show "Recording conversions" in Google Ads within about 24 hours;
  - then be refunded and retracted by transaction ID.
- After the Editor import, the paused account read-back must match `plan.json` on campaigns, budgets, networks, geo, bidding, keywords, negatives, RSAs and assets.
