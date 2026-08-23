# Drive Right Local SEO Package

Status date: August 21, 2026. Companion to `docs/release-readiness.md` Gate 5 and `data/entities.json`.

## Entity model constraint

Drive Right is a **service-area business**: one Austin-based operation serving nine Texas metros (`data/entities.json`, `localBusinessEntity: false` for all metros). Do not create storefront listings in Dallas, Houston, or any other metro. One profile per platform, service-area mode.

## Canonical NAP record (sync everywhere)

| Field | Value | Source of truth |
| --- | --- | --- |
| Name | Drive Right | `data/entities.json` |
| Phone | +1 (512) 910-4938 | footer, JSON-LD `Organization.telephone` |
| URL | https://www.driverightcarbuying.com/ | canonical |
| Email | hello@driverightcarbuying.com | schema + footer |
| Area served | Texas (9 named metros) | `data/entities.json` |

Open inconsistency to resolve with owner: `policy.html` displays mason@driverightcarbuying.com while schema/footer use hello@. Pick one public contact email and sync all surfaces.

## Google Business Profile (do first)

1. Owner confirms the real Austin address (kept hidden for SAB verification) plus hours and phone.
2. Create profile in **Service Area Business** mode: hide address, set Texas service area, list the 9 metros as areas served.
3. Category: pick the most accurate available category at setup time; evaluate candidates rather than defaulting to "Car dealer", which misrepresents the model.
4. Add services matching the three approved tiers from `data/services.json`; keep prices consistent with schedule.html.
5. Fill description within GBP limits using homepage-approved copy; no savings claims beyond what `data/claims.csv` has approved.
6. Upload logo + real photos (media inventory: `docs/media-inventory.md`).
7. Enable messaging/chat only if response SLA is operationally staffed.

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
