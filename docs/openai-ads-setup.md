# OpenAI Ads conversion setup

**Production status — September 13, 2026:** The browser Pixel and opt-in controls are live at https://www.driverightcarbuying.com/. Vercel deployment `dpl_C9WyvZrn52qZnjg3DQZf36K4uBXx` was built, checked, and promoted successfully. The live homepage loaded no OpenAI SDK before consent and exactly one SDK after acceptance, with no console errors or warnings. The updated privacy disclosure is visible on the public policy page. Ads Manager event receipt remains unconfirmed: its event stream displayed no received events during the bounded verification session.

**Release scope:** Production contains the browser implementation only. Separate CAPI changes arrived concurrently in the shared working tree; they were preserved but excluded from this release. The release was assembled from baseline commit `4de9a7ebf8dad49f4d331dcc9f143dfc7049e5b7` plus the tested browser/consent files in `/private/tmp/drive-right-openai-ads-release`. No source commit or push was made. The CAPI descriptions below document local work, not deployed behavior.

Updated September 13, 2026. The advertiser signed in through the Codex browser and confirmed that **SpurAuto is the account for Drive Right**. Its existing web source, **My first pixel**, has now been configured in the deployed browser tracker. The account also has a **Lead Created** conversion based on `lead_created`, with no linked campaign and zero events displayed over the last seven days. The source warning is “No recent conversion events.” No account, pixel, ad, campaign, billing setting, or deployment was created or changed in Ads Manager.

The connector remains unavailable: its latest read returned “Reauthentication required,” with an unauthorized response from the OAuth token endpoint. Browser access works independently. Reconnect the Ads Manager app with the same OpenAI identity used for the browser; if the error persists after a fresh connection, contact support. No credentials were inspected or changed.

## Implementation

Mode: **Pixel in production; additional CAPI work exists locally and is not part of this deployment**. The site uses static HTML and a shared browser script, npm, and Node 24 Vercel functions with PostgreSQL and Stripe. Existing `track()` calls publish to `dataLayer` for GTM; verified purchases use the server analytics outbox. The deployed destination is called from browser success boundaries. Server dispatch changes listed below remain local and unverified by this release.

Changed files:

- `openai-ads.js`: public Pixel configuration, consent bridge, single initialization, event mapping, deduplication, and failure isolation.
- `script.js`: imports the destination and calls it from existing `track()`.
- `ad-consent.js` and `ad-consent.css`: visitor-facing opt-in controls, preference persistence and withdrawal.
- `policy.html`: factual OpenAI measurement disclosure and a preference control.
- `.vercelignore`: keeps local secrets, agent configuration, tests and task reports out of the deployment.
- `api/_tests/openai-ads.test.mjs`: consent, event mapping, duplicates, SDK failures, and actual hero-form success/failure tests.
- `api/_lib/openai-ads-capi.js`: server-side OpenAI Ads CAPI dispatch client and helpers.
- `api/leads.js`: `lead_created` CAPI fire-and-forget event from durable lead write.
- `api/checkout-start.js`: `checkout_started` CAPI fire-and-forget event from durable checkout attempt creation.
- `api/stripe-webhook.js`: `order_created` CAPI fire-and-forget event from verified paid checkout event handling.
- `README.md`: links to this report and the marketing brief.
- `docs/openai-ads-setup.md` and `docs/openai-ads-marketing.md`: setup and launch preparation.

All 64 HTML pages already load `script.js`; one uses a module tag and the others use classic script tags. A caught dynamic import supports both and keeps a missing analytics module from preventing the main script from running. The integration runs once per document. It appends the asynchronous SDK to the head after consent; it deliberately does not insert an unconditional loader into every HTML head. Localhost, preview domains, Global Privacy Control, and all existing success/payment confirmation paths suppress the new destination.

## Event inventory

| OpenAI event | Coverage in this patch | Boundary / rationale |
| --- | --- | --- |
| `page_viewed` | New | Once per eligible document after measurement consent. |
| `lead_created` | New | Existing `generate_lead`, after `/api/leads` accepts the hero or contact form and returns a durable lead ID. A saved lead is not necessarily a qualified sales prospect. |
| `checkout_started` | New | Existing `begin_checkout`, after `/api/checkout-start` returns a durable attempt ID, before redirect to Stripe. Covers all three service tiers and the hero flow. |
| `contents_viewed` | Deferred | Page views cover initial landing-page diagnosis; add separately if article/service engagement becomes a useful optimization signal. |
| `items_added` | Not applicable | There is no cart or quantity-increment flow. |
| `order_created` | Local CAPI only; not deployed | Emitted from verified Stripe webhook processing when paid checkout is recorded. Uses server-side `amount` + `currency` and canonicalized source context. |
| `registration_completed` | Not applicable | No account registration flow. Paid intake is not account creation. |
| `appointment_scheduled` | Deferred | No confirmed calendar-booking success boundary; a plan selection or payment is not an appointment. |
| `subscription_created`, `trial_started` | Not applicable | Current services use one-time payment links. |
| `app_installed`, `app_opened` | Not applicable | No native app surface. |
| `custom` | Not added | Standard events cover the implemented boundaries; CTA and phone clicks remain existing GTM events. |

Existing OpenAI events: none. Existing events reused as evidence: `generate_lead`, `begin_checkout`; unchanged browser intent events: `cta_click`, `phone_click`; unchanged server events: `purchase`, `onboarding_complete`.

Lead and checkout data include only their documented data family. No value is assigned to leads, and no potentially stale service amount is copied into checkout events. `event_id` is `lead:<durable lead ID>` or `checkout:<durable attempt ID>`. Repeated IDs are suppressed in memory and, when available, session storage. These are event identifiers, not customer-matching identifiers. Page views are per document. `order_created` is now implemented server-side via CAPI. For `lead_created` and `checkout_started`, CAPI is emitted alongside browser Pixel events with shared event IDs for dedupe.

## Configuration and consent

The single configuration is `OPENAI_ADS_PIXEL_ID` in `openai-ads.js`, now populated from the existing source in the confirmed account. It is public, not a secret. Because this is a static site with no frontend build, adding a Vercel environment variable alone will not replace that value. The configured value was read from the pixel ID control in Ads Manager; all 24 tests passed again after configuration.

No repository-visible consent manager API was found, so this implementation supplies its own **Ad privacy** controls for OpenAI measurement. Both acceptance and rejection use equally prominent buttons. The Pixel is not loaded until a visitor allows measurement. A footer control and a policy-page control reopen the choices.

The decision is stored under `drive_right_openai_consent_v1` for up to 180 days. Invalid, expired, future-dated or unreadable preferences mean no consent. If storage is blocked, a choice applies only to the current page. Withdrawal propagates to other open tabs, and a restored page rereads the choice. GPC keeps measurement off and disables acceptance. First-visit prompts are suppressed on paid intake/confirmation pages, which also do not load the Pixel. These controls govern OpenAI measurement only; existing GTM behavior is unchanged.

The integration initializes once through the shared script. Do not add a second OpenAI initializer in GTM; a pre-existing `oaiq` causes this adapter to decline initialization. The optional `drive-right:ads-consent` event remains available for a future trusted consent-manager integration, but no external tag is required for this setup.

The module sends `opt_out: true` for every event sent through the site controls; they do not grant personalization. GPC suppresses measurement entirely. Revocation stops future events and removes unsent queued measurements before a slow SDK loads. Events suppressed before consent are not replayed. Debug is not enabled. The code catches its own failures; it never awaits ad-network requests during form submission or checkout. An unavailable SDK disables this destination for the current document.

**User matching:** no manual identifier fields are sent by our adapter. Current official documentation says the Pixel performs automatic advanced matching, detecting supported contact details and hashing them in the browser. The new prompt and privacy disclosure explicitly describe this behavior before consent. Consequently, this patch relies on that documented automatic matching instead of adding a second manual `init({ user })` and another normalization path. The pixel edit dialog has no visible matching toggle; no undocumented switch was invented. Raw form contents are not copied into our measurement calls. [OpenAI conversion measurement](https://help.openai.com/en/articles/20001409-conversion-measurement)

The current [Measurement Pixel documentation](https://developers.openai.com/ads/measurement-pixel) and [supported events](https://developers.openai.com/ads/supported-events) were checked. Current docs expose consent controls and additional matching fields beyond the installed reference, including `postal_code` rather than its older `zip_code`; no location or matching fields are used here. SDK-managed attribution, timestamps, URLs and batching are left to the SDK.

## CAPI and purchase follow-up

The following concurrent local changes were not deployed or validated as part of the browser release. CAPI is wired locally for confirmed server-side conversion boundaries:

- Required: `OPENAI_ADS_CONVERSIONS_API_KEY` (disables dispatch entirely when missing).
- Optional: `OPENAI_ADS_SITE_ORIGIN` (preferred canonical origin for `source_url`; defaults to request origin).
- Optional: `OPENAI_ADS_CAPI_PIXEL_ID` (defaults to the same pixel ID as the browser SDK via `OPENAI_ADS_PIXEL_ID`).
- Optional: `OPENAI_ADS_CAPI_TIMEOUT_MS` (defaults to 5000ms; clamped 500-15000ms).

`order_created` is emitted from verified paid Stripe webhook processing and paired to a shared dedupe family (`purchase:<session_id>`). No new database, queue, or scheduler has been added in this run. Existing backend purchase counts remain the source of truth.

## Verification and activation

- `npm test`: **24 passed**, including seven new tests. The actual hero handler was exercised with mocked API responses for rejected lead, rejected checkout, and full success.
- `npm run check:api`, `node --check script.js`, `node --check openai-ads.js`: **passed**.
- `node scripts/validate-site.mjs`: **passed**, 64 HTML files and nine sitemap URLs.
- Skill secret-exposure scan: **zero findings**.
- Skill setup checker with `--require pixel`: **passed**. This is a static marker check; it does not prove a configured Pixel ID, SDK delivery, attribution, or dashboard receipt.
- CAPI verification with `--require capi` has not been run yet; it is the next recommended check when validating source-url trust, dedupe IDs, and `oppref` handling end-to-end.
- Production deployment: **successful**. Staged tracker and consent files matched the tested files byte-for-byte before promotion. Live OpenAI receipt: **unconfirmed**. No fabricated lead or purchase has been sent to an ad account.
- Browser QA: local homepage and policy page rendered at desktop and 390 × 844 mobile sizes. Decline, persistence after reload, reopen, acceptance across navigation, and withdrawal were verified through visible states. No console errors/warnings were reported. Homepage and pricing module loading were also checked. Localhost never sends live ad events.

Remaining live check: confirm a consented page view arrives in Ads Manager. Production prompt, consent-gated SDK loading, and disclosure have been verified. The existing Lead Created definition can be selected when a campaign is created; none has been linked or launched here. No new event definitions are required just to send page views or checkout starts to the Pixel. Lead and checkout failures are tested with mocks; a real paid checkout has not been executed. SDK blocking, the dynamic import loading window, and rapid navigation can still cause undercounting. Existing purchases remain server-only and are not yet forwarded to OpenAI.

The advertiser should review that the implementation satisfies their privacy, security, consent, and data handling requirements before launching campaigns or deploying further measurement changes.
