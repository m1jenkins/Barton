# Google Ads setup: account, GTM and Editor steps

**Status, September 27, 2026:** step 2's three new conversion actions are created in Google Ads (Claude, in the owner's signed-in browser); the other steps aren't applied yet.
- The owner applies these steps in Google Ads, Google Tag Manager and Google Ads Editor, or an agent does it in the owner's signed-in browser. The repository holds no Google credentials.
- Plan and launch gates: [google-ads-launch-plan-2026-09-27.md](google-ads-launch-plan-2026-09-27.md).
- Campaign files: `outputs/2026-10-google-search-ads/`.
- Code side: the "verified purchase tracking" PR, which adds the `purchase_verified` dataLayer event and makes `begin_checkout` reach GTM before the Stripe redirect.

Accounts:
- Google Ads: `AW-18071301983` (conversion ID `18071301983`).
- GTM: account `6349220223`, container `249056149` / `GTM-W577B3D4` (live Version 6 as of Sep 18).

Log every change in `outputs/2026-10-google-search-ads/change-log.md`.

Order: 1 → 2 → 3 happen before the Editor import (4). Launch (6) only after gates G1–G5 pass.

## 1. Account audit (gate G3)

- [ ] **Campaigns:** pause every enabled campaign. Pause, don't remove, so history is kept. Log each name and its last-30-day spend.
- [ ] **Recommendations → Auto-apply:** turn every type off, on every tab.
- [ ] **Experiments:** end any running experiment. Experiments made in the web interface auto-apply results by default.
- [ ] **Assets at account level:** pause or remove any asset with old prices ($1,850, $895, $795, $495, $295, $195), "free", savings, speed or other claims not on `outputs/2026-10-google-search-ads/ad-copy-approval.md`. Account-level assets show on every campaign.
- [ ] **Account-level and shared negative keyword lists:** note any that would block the new keywords (`editor-import/04-keywords.csv`).
- [ ] **Account settings:**
  - [ ] Auto-tagging **on**.
  - [ ] Note the account **time zone** (the call schedule uses it) and confirm the currency is **USD**.
- [ ] **Billing and verification:**
  - [ ] Payment method valid.
  - [ ] Advertiser verification complete, or started if requested.
  - [ ] Policy Manager shows no account-level issue or Limited Ad Serving notice.

## 2. Conversion actions (Goals → Conversions)

| Action | Setup | Goal role |
|---|---|---|
| **Purchase – verified** (created 2026-09-27; ID `7802445530`, label `r1JaCNq9v4gdEN_eiKlD`) | Website; manual setup with Google Tag Manager. Category **Purchase**. Value: use different values per conversion (default 395; the tag sends the amount actually paid). Count: **Every**, deduplicated by transaction ID. Click-through window: 30 days. Attribution: data-driven. | **Primary.** The only goal of the non-brand campaign. |
| **Begin checkout** (created 2026-09-27; ID `7802581153`, label `A1cuCKHhx4gdEN_eiKlD`) | Category Begin checkout. Count **One**. Google no longer offers "Don't use a value", so the action falls back to $1 when the tag sends none; as a secondary action that doesn't affect bidding. | Secondary |
| **Phone click** (created 2026-09-27; ID `7802581156`, label `AmVzCKThx4gdEN_eiKlD`) | Category Contact, fired by the `phone_click` event in step 3. Count **One**; same $1 fallback value. The "Call Button" action this row used to describe isn't in the Ads account. | Secondary |
| **Calls from ads** | Created with the call asset in step 4. Count a call at **60 seconds** or longer. | Secondary |
| Book Appointment, Schedule Free Call, Submit Lead Form (existing) | Leave as is for now; remove after they've stopped firing for 30 days. | **Secondary** |

- [ ] **Enhanced conversions:** off. The payment pages' onboarding form collects name, email and phone, and automatic collection must not read it.
- [ ] **Account-default goals:** only Purchases is primary.

## 3. GTM: one new version

Work in a new workspace named "Google Ads purchase tracking". Publish it only after the tracking PR is live in production.

**Variables**
- Data Layer Variables (version 2): `transaction_id`, `value`, `currency`, `service_tier`, `checkout_attempt_id`.
- JavaScript Variable **JS – GPC**: `navigator.globalPrivacyControl`.
- Regex Table **Page URL – sanitized**, input `{{Page Path}}`:
  - `^/payment-success` → `https://{{Page Hostname}}{{Page Path}}`
  - default → `{{Page URL}}`

**Consent Initialization (All Pages)**

Add a consent-mode default tag, for example a Community Template such as "Consent Mode (Google tags)":
- When **JS – GPC** equals `true`, deny `ad_user_data` and `ad_personalization`.
- Otherwise grant them.

Whether GPC should also deny `ad_storage` is an owner or legal decision; the default here leaves it granted.

**Triggers** (Custom Event; every one requires Page Hostname equals `www.driverightcarbuying.com`)
- `purchase_verified`, also requiring:
  - `service_tier` matches regex `^(full_service|concierge)$`;
  - `value` greater than 0;
  - `transaction_id` matches regex `^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$`.
- `begin_checkout`
- `phone_click`

**Tags**
- **New "Google Ads – Purchase – verified":**
  - Google Ads Conversion Tracking, conversion ID `18071301983`, label `r1JaCNq9v4gdEN_eiKlD`.
  - Value `{{DLV – value}}`, transaction ID `{{DLV – transaction_id}}`, currency `{{DLV – currency}}`.
  - Trigger: `purchase_verified`.
- **New "Google Ads – Begin checkout":** label `A1cuCKHhx4gdEN_eiKlD`; transaction ID `{{DLV – checkout_attempt_id}}`; trigger `begin_checkout`.
- **Existing "Call Button":** set its label to the Phone click label `AmVzCKThx4gdEN_eiKlD` and replace its click-text trigger with the `phone_click` trigger. Don't add a second phone tag, or clicks count twice.
- **Pause** "Book Appointment", "Schedule Free Call" and "Submit Lead Form". The All Forms trigger behind Submit Lead Form can fire on each homepage chat answer.
- **Keep** the Google tag (`AW-18071301983`) and Conversion Linker on All Pages.
- **Google tag configuration:** add the parameter `page_location` = `{{Page URL – sanitized}}`, so hits from `/payment-success*` don't carry the Stripe `session_id`.
  - In Tag Assistant, check the conversion request on a payment page.
  - If the conversion tag still sends `session_id`, note it in the change log; it needs a code-side fix.

**Test, then publish**
1. Preview on a Vercel preview deployment with Stripe in test mode. The conversion tags should show **Not fired**, because of the hostname condition, with every variable filled.
2. After the tracking PR is merged, preview on production. Check `begin_checkout` on both `/car-buying-service.html` and `/schedule.html` without paying.
3. Publish with version notes.
4. The live test purchase is step 5 of `outputs/2026-10-google-search-ads/stripe-checklist.md`.

## 4. Build the campaigns in Google Ads Editor

1. Get recent changes for the whole account.
2. Go to **Account → Import → From file**, and import `outputs/2026-10-google-search-ads/editor-import/01-campaigns.csv` through `10-call-assets.csv` in order.
   - At each preview, confirm the column mapping.
   - Choose **Finish and review changes**.
   - Everything must stay **Paused**.
3. Set these by hand in each campaign's settings:
   - [ ] **Networks:** Google Search only. Search Partners off; Display Network off.
   - [ ] **Locations:** United States.
     - **Location options → Target:** Presence ("People in or regularly in your included locations").
     - **Exclude:** Presence.
   - [ ] **Language:** English.
   - [ ] **Non-brand bidding:** Maximize conversions, no target CPA. Conversion goals: **campaign-specific, Purchases only**.
   - [ ] **Brand bidding:** Maximize clicks with maximum CPC bid limit **$2.00**.
   - [ ] **Automation off:** broad match, AI Max (search term matching, text customization, final URL expansion) and automatically created assets.
   - [ ] **EU political ads:** "No".
   - [ ] **Audience (non-brand):** In-market "Motor vehicles" in **Observation** (not Targeting).
   - [ ] **Call assets:** Mon–Fri 09:00–17:00 Central, converted to the account's time zone; call reporting on; conversion action "Calls from ads" (60 seconds).
   - [ ] **Structured snippets:** add by hand if Editor didn't map `09-structured-snippets.csv`.
     - Service catalog: Inventory Search; Price Negotiation; Fee Review; Vehicle Recommendations.
     - Types: New Cars; Used Cars; Certified Pre-Owned.
4. Post changes. The campaigns stay paused.
5. In the Google Ads web interface, go to Admin → Account settings → Tracking and set the **final URL suffix**:
   `utm_source=google&utm_medium=cpc&utm_campaign={campaignid}&utm_content={adgroupid}&utm_term={keyword}`
6. Export the account from Editor as a CSV and send it for a read-back against `plan.json`.

## 5. Keyword Planner (Day 0)

1. Go to Tools → Planning → Keyword Planner → **Get search volume and forecasts**.
2. Choose **Upload a file** and select `outputs/2026-10-google-search-ads/keyword-planner/keywords.csv`: one `Keyword` column, 23 unique keywords from `plan.json`, with each match type folded into one row. Or paste the same list.
3. Click **Get started**, then check the settings:
   - location: United States;
   - network: Google (not search partners);
   - dates: the last 12 months.
   The language filter stays locked at "All languages".
4. On **Saved keywords**, use the download icon → **.csv**. Skip the forecast: it treats the keywords as broad match, and the plan uses only exact and phrase. Keyword Planner saves a draft plan, and nothing is added to a campaign.
5. Results go in `outputs/2026-10-google-search-ads/keyword-planner/`. The September 27 run is `historical-metrics-2026-09-27.csv`. Keywords with no volume are dropped from `plan.json` before launch, and the builder regenerates `keywords.csv`.

## 6. Launch day (Monday, October 5, 2026)

1. **Confirm:** gates G1–G5 are all checked in the launch plan.
2. **Enable:** enable both campaigns in the morning, when calls get answered.
3. **Log:** log the time in `change-log.md`.
4. **Watch:**
   - there are no disapprovals within a few hours;
   - spend and clicks begin;
   - the landing pages return 200.

## 7. Before each weekly review

Export as CSV for the last 7 days (and month to date):
- Campaigns: cost, clicks, impressions, and conversions by conversion action.
- Search terms, including match type.
- Keywords.

Also share the count of verified purchases from the purchases ledger for the same dates. That is an aggregate count only; no customer details.

Alternatively, connect Google's read-only Google Ads MCP server (github.com/googleads/google-ads-mcp) so the queries can run directly.
