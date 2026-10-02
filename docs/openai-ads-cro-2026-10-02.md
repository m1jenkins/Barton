# OpenAI campaign and pricing changes — October 2, 2026

The owner authorized implementing the campaign review recommendations. Ads Manager changes use its browser UI, as requested; no Ads Manager connector is used.

## Pricing and inquiries

`schedule.html` keeps the $395 Full Service and $695 Ultimate Concierge checkout paths and adds “Talk to Mason about my car search” beside each payment button. Each card includes the existing Mason photo and introduction. The existing Michael R. Tahoe review now sits directly below the plans, with its original qualification. Prices, Stripe links and fulfillment scope remain unchanged.

The dialog requires a vehicle description and email; vehicle budget, buying timeline and name are optional. `buying/inquiry.js` saves through `/api/leads`, uses the durable lead UUID for `generate_lead`, retains the same idempotency key after a failed/lost response, coalesces pending submits, and keeps contact/search contents out of analytics. Its business flow has no import dependency on optional ad measurement; the shared client owns that destination. Other lead sources still require a name. No database migration is needed.

Production environment metadata currently shows no `LEAD_FORWARD_URL` or email-provider connection. Inquiries save to PostgreSQL. The API returns `forwarding_configured`; while false, the confirmation offers an explicit “Email Mason these details” handoff. It opens the visitor’s email app only after they click. Private draft contents remain in memory, not in the recorded DOM. With an existing notification webhook configured, the normal saved-inquiry confirmation replaces this handoff. Automatic notification delivery remains pending a destination/integration; no email provider or credential was created.

## Purchase measurement

The existing `/api/purchase-status` verifier compares Stripe’s paid Checkout Session with the payment ledger. After verification and removal of the secure session token from the address, the browser maps `purchase_verified` to OpenAI `order_created`. Value comes from the ledger, converted from dollars to integer cents; currency is the verified currency. The event ID is `purchase:<purchase UUID>`, shared with the optional server helper. The secure Stripe session ID is never an OpenAI event identifier.

The Pixel still requires explicit measurement consent, a production hostname and no GPC. Receipt page views and unverified receipts do not initialize it. Purchase events preserve personalization opt-out, duplicate suppression and failure isolation. The purchase path catches a slow module import without delaying payment verification. Consent text and the policy disclose verified purchases. No new matching fields, CAPI credentials or server activation were added. Production metadata has no `OPENAI_ADS_CONVERSIONS_API_KEY`, so CAPI remains inactive; live purchase delivery cannot be claimed before a genuine paid receipt.

This receipt exception supersedes the blanket payment-page exclusion described in older setup notes. The existing Stripe ledger and Google purchase event remain authoritative and unchanged.

## Campaign changes

Two ads are added to the existing Drive Right campaign and Recommended ad group, retaining their control’s image, description and landing URL:

| Ad name | Title | Landing URL |
| --- | --- | --- |
| Car search \| $395 upfront \| Oct 2 | Car buying help for a $395 flat fee | `/schedule.html#full-service` |
| Niche search \| $695 upfront \| Oct 2 | Hard-to-find car search · $695 | `/schedule.html#concierge` |

Both were visibly marked Serving after a fresh browser reload. The six existing ads remain active. New variants use `utm_source=chatgpt&utm_medium=cpc&utm_campaign={campaign_id}&utm_content={ad_id}`. The current campaign retains its $65/day budget and October 6 end date. Delivery is platform allocated; this is a directional creative test, not an evenly randomized experiment.

Created and verified “Saved inquiry” (`lead_created`) and “Verified purchase” (`order_created`) definitions on the existing My first pixel source. Both retain the displayed 30-day click / 1-day view windows and show zero received conversions. Existing Checkout Started remains intact; no optimization setting changed.

The separate conversion campaign is conditional on a genuine conversion being received and verified in Ads Manager. It has not been activated, because no real inquiry or paid order is currently available for that validation. Its eventual budget must come out of the existing $65/day total.

## Verification

Node 24 API and client syntax, site validation, metro/city draft checks, and all 224 tests pass. Tests cover inquiry success/failure, lost-response retries, double submission, email handoff, consent, GPC, amount conversion, receipt verification, sanitized URLs, historical prices and duplicate receipts. Browser QA checked desktop and 390 × 844 mobile rendering, the native dialog, keyboard focus restoration, and a local unavailable-API response that preserves input for retry. Localhost loads no OpenAI SDK and creates no real leads or purchases.

A read-only production ledger check from the campaign start (`2026-09-28T00:47:00Z`) found zero live paid orders, zero saved inquiries, six started checkout attempts and no live webhook records. These counts confirm the lack of purchases; they do not identify a single cause or prove ad attribution. No fabricated conversion or real payment was sent for testing.

GitHub checks passed for commit `c9c5d69`. The Git push did not start a Vercel deployment during the verification window, so the existing authenticated CLI published production deployment `dpl_2tbXMCWuPu1q7VbF9G8xVodQNfWa`. The live domain shows the inquiry buttons, Mason photos and relocated review. All five changed JS/CSS assets match the checked source. Cloudflare transforms HTML email links, so raw HTML byte equality is not expected. A deliberately invalid inquiry returns HTTP 422 before any database write. Both new goal definitions and the single $65/day campaign were visibly verified in Ads Manager. No fabricated live conversion was created.
