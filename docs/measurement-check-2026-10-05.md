# Measurement check after the 2026-10-05 sales rewrite

What the site's analytics events do and do not fire after the conversion changes in `docs/sales-copy-2026-10-05.md`, checked on the local preview (`npm run preview`, built-in browser, 2026-10-06) and by reading the code. Report only: no tracking configuration was changed beyond adding `data-cta-location` to the pricing page buttons that were previously untracked.

## What fires (verified locally)

| Action | Event pushed to `dataLayer` | Notes |
| --- | --- | --- |
| Homepage hero "Get Full Service · $395" | `cta_click` with `cta_location: "hero"`, `cta_label: "Get Full Service · $395"`, `page_type: "home"` | Then `POST /api/checkout-start` (503 locally by design; on production it returns the Stripe URL and `begin_checkout` follows from `buying/checkout.js`) |
| Homepage hero "Talk to Mason first" | `cta_click` with `cta_location: "hero"`, `cta_label: "Talk to Mason first"` | Opens the inquiry dialog; a saved inquiry sends `generate_lead` with `form_name: "pricing_inquiry"` from `buying/inquiry.js` |
| Pricing page plan card "Get Full Service" | `cta_click` with `cta_location: "pricing"`, `page_type: "service"` | New in this release: the plan-card and closing buttons on `schedule.html` had `data-plan` but no `data-cta-location`, so the metric in `docs/checkout-streamline-2026-10-05.md` could not be computed for them |
| Pricing page closing buttons | `cta_click` with `cta_location: "closing"` | New in this release |
| Header "Get started" / header checkout button | `cta_click` with `cta_location: "header"` | Unchanged |
| Header or footer phone link | `phone_click` with `link_text` | Bound by `script.js` on every `a[href^="tel:"]`; the header link carries no `data-cta-location`, so it does not double-fire as `cta_click`. GTM can split header from footer on the `header-phone` click class |

The push point is `track()` in `script.js` (event id, per-session de-duplication for `generate_lead`, `begin_checkout` and `purchase_verified`, first and last touch attribution). GTM is skipped on `localhost` and `127.0.0.1`, so the local preview proves the `dataLayer` payloads, not the container.

## What cannot be verified from the repo

- **GTM triggers.** The container export in `outputs/2026-10-google-search-ads/gtm/gtm-import-merge.json` has triggers for `purchase_verified`, `begin_checkout` and `phone_click` only. If the live container `GTM-W577B3D4` has no `cta_click` or `generate_lead` trigger, the before/after comparison in `docs/checkout-streamline-2026-10-05.md` has no numerator for clicks or inquiries. Check the live container (Tags → trigger list) and add Custom Event triggers for `cta_click` (with `cta_location` as a variable) and `generate_lead`.
- **Conversion events end to end.** `begin_checkout` and `purchase_verified` need a Stripe session. Run one Stripe test checkout on a Vercel preview deployment and read `dataLayer` on the receipt page.
- **The owner's own machine.** Local DNS blocks `googletagmanager.com`, but the production site also loads a first-party tag path (`/uuyh/…`) that the block does not cover, so clicks made on production from that machine do send hits.

## Why Vercel Web Analytics shows nothing

`web-analytics.js` shipped on 2026-10-04 and loads only when all of these hold: the visitor clicked "Allow measurement" (a stored choice from before the `webAnalytics` field exists counts as off), the host is `www.driverightcarbuying.com` or the apex, the path is one of the 13 public paths in the script, and the landing referrer is not an external URL with a path. It records pageviews only. `/_vercel/insights/script.js` returns 200, so the project setting is on; the zero rows reflect the opt-in design, not a fault. Under this design it will never produce funnel numbers.

## Options for Mason (decisions, not done)

1. Add `cta_click` and `generate_lead` triggers to GTM so GA4 (or the ads platforms) receive clicks and inquiries. This is the smallest change and keeps the current consent model.
2. Count the funnel server-side from data the site already stores: checkout attempts (`/api/checkout-start`, with `source_page`) and leads (`/api/leads`) per day, against Vercel's request logs for homepage and pricing page views. No consent question, because nothing new is collected from the browser.
3. Switch Vercel Web Analytics to load without the consent gate. It sets no cookie, but the policy page currently describes it as part of the opt-in choice, so the policy text and the consent copy would need to change first.

Until one of these happens, the 30-day before/after comparison should use option 2's server-side counts.
