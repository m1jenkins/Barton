# Drive Right Local SEO Package

> September 22, 2026: owner confirmed a live Auto broker **service-area** Google Business Profile. Google verification is still processing, so there is **no public Maps/GBP URL** yet. Do not invent a CID or `sameAs` URL. Do not publish the hidden verification address, `streetAddress`, `geo`, or `LocalBusiness` markup.
>
> September 18, 2026 correction: remote nationwide coverage alone does not establish Google Business Profile eligibility. See [the actual account/eligibility audit](seo-execution/SEO-08.md). The 2026-09-22 owner confirmation covers profile existence and SAB mode; it does not authorize storefront listings or a public address.

Status date: September 22, 2026. Companion to `docs/release-readiness.md` Gate 5 and `data/entities.json`.

## Entity model constraint

Drive Right is a **service-area business**: one Austin-based operation serving nine Texas metros (`data/entities.json`, `localBusinessEntity: false` for all metros) plus remote nationwide support. Do not create storefront listings in Dallas, Houston, or any other metro. One profile per platform, service-area mode.

## Canonical NAP record (sync everywhere)

| Field | Value | Source of truth |
| --- | --- | --- |
| Name | Drive Right | `data/entities.json` |
| Phone | +1 (512) 910-4938 | footer, JSON-LD `Organization.telephone` |
| URL | https://www.driverightcarbuying.com/ | canonical |
| Email | hello@driverightcarbuying.com | schema, footer, and `policy.html` |
| Hours | Monday–Friday 09:00–17:00 America/Chicago; weekends closed | `data/entities.json`, homepage JSON-LD |
| Area served | United States, plus nine named Texas metros | `data/entities.json` |
| sameAs | omit until a public GBP URL exists | `organization.sameAsStatus` remains pending |

Public contact email is `hello@driverightcarbuying.com`. Schema, footer, and `policy.html` use that address. Do not publish `mason@driverightcarbuying.com` as the public inbox.

## Google Business Profile (do first)

1. ~~Owner confirms the real Austin address (kept hidden for SAB verification) plus hours and phone.~~ Owner-confirmed 2026-09-21/22. Hidden verification address stays out of schema and NAP.
2. ~~Create profile in **Service Area Business** mode.~~ Live as Auto broker SAB. Service cities: Austin, Arlington, Dallas, El Paso, Fort Worth, Houston, New Braunfels, San Antonio, San Marcos. Public Maps URL still pending verification.
3. Category in use: Auto broker. Do not switch to "Car dealer".
4. Add services matching the current paid tiers from `data/services.json` (Full Service $295, Ultimate Concierge $895). AI Agent is retired for new sales. Keep prices consistent with schedule.html.
5. Fill description within GBP limits using homepage-approved copy; no savings claims beyond what `data/claims.csv` has approved.
6. Upload logo + real photos (media inventory: `docs/media-inventory.md`).
7. Enable messaging/chat only if response SLA is operationally staffed.
8. After Google publishes a profile URL, add that exact URL to `organization.sameAs` and set `sameAsStatus` to `approved`. Until then, leave `sameAs` empty.

## Bing Places and Apple Business Connect

Mirror the GBP record exactly after Google is verified. Bing Places can import from GBP. Apple Business Connect requires its own verification; use the same hidden-address SAB treatment.

## NAP sync surfaces

- Site footer (already correct) and JSON-LD `Organization.telephone`
- All 9 metro pages once released from noindex
- Directory citations: start with the high-trust set only (Yelp, Nextdoor, BBB, Chamber directories where membership exists). Never pay for citation networks that fabricate addresses.

## Review-request workflow

1. Trigger: after vehicle delivery/purchase completes.
2. Ask by SMS or personal email within 48 hours; one polite follow-up max after 5-7 days.
3. Request copy template (compliant, non-incentivized): "Thanks again for letting Drive Right handle your [vehicle] purchase. If you have 60 seconds, a Google review about your experience helps other Texas buyers find us: [direct review link]"
4. Rules per editorial policy: never incentivize or gate reviews, never invent testimonials, never publish a review amount/outcome without recorded permission. Respond to every review, including critical ones, without disputing facts publicly.

## Measurement hooks

- Tag the profile website link with UTM: `?utm_source=google&utm_medium=organic&utm_campaign=gbp` - the site's existing attribution capture (`script.js`) records first/last touch automatically.
- GBP insights to log monthly: calls, direction requests (expect near-zero for SAB), website clicks, message count.
- Fold into Gate 4 baseline: branded vs non-branded queries, metro segments.

## External launch blockers (not repo-fixable)

1. Apex -> www redirect currently returns temporary 307 (confirmed live 2026-08-20). Fix in Vercel domain settings ("Redirect to www" must be permanent/301), then rerun `scripts/check-redirects.mjs`.
2. Verify GSC + Bing Webmaster domain properties; export the 16-month query history and 28-day baseline before flipping any fast-track pages live.
3. Resubmit sitemap.xml in GSC only after the redirect matrix passes (Gate 3 ordering).
