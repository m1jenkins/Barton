# Plan-first checkout and the October 4–6 API outage

## The outage (fixed in cfe3a2d)

From 2026-10-04 07:24 UTC (the PR #96 deploy) until 2026-10-06 03:07 UTC, `/api/checkout-start`, `/api/leads` and `/api/stripe-webhook` failed at startup with HTTP 500 (`FUNCTION_INVOCATION_FAILED`). Every checkout button showed an error.

- **Cause.** PR #96 versioned the browser import in `openai-ads.js` as `./ad-consent.js?v=…`. `api/_lib/openai-ads-capi.js` imported `openai-ads.js` for the public Pixel ID. Vercel's function file tracer cannot resolve a query-string specifier, so the three bundles shipped without `ad-consent.js` and crashed with `ERR_MODULE_NOT_FOUND`.
- **Fix.** The server helper owns its copy of the Pixel ID. `api/_tests/function-bundle.test.mjs` fails if any function's import graph leaves `api/` or uses a query string or fragment, and `openai-ads.test.mjs` keeps the two Pixel IDs equal.
- **Impact.** Logs for the broken deployment show four checkout attempts (2026-10-06 02:51–02:52 UTC, when the owner reported the error) and no lead or webhook requests.
- **Verified live.** GET returns 405 on all three endpoints. A checkout POST naming a nonexistent `lead_id` returns `422 invalid_lead` for both plans: the origin check, pause flag, Payment Link configuration and database were all reached, and nothing was written.

## Plan-first checkout

The owner asked on 2026-10-05: “The current checkout is a bit convoluted. Can we streamline it (maybe get rid of the text-to-sign up idea) and come up with something easier, higher converting?”

**Before.** The homepage hero was a chat (“What car are you looking for?”). It asked up to nine questions one at a time, showed a summary, then sent the buyer to `/schedule.html` to choose a plan and pay. It never asked for contact details, so a visitor who stopped part-way left nothing to follow up on, and paid buyers typed most answers again in the intake.

**After.**

- Every plan button opens Stripe directly through `/api/checkout-start`: the homepage hero and plan cards, How it works, the Austin page and the pricing page. The buyer describes the car after payment.
- “Not ready to pay? Talk to Mason about your car search” opens the existing pricing inquiry (vehicle and email, no payment) on the homepage and the Austin page.
- The header CTA on every page is “Get started”, linking to `/schedule.html`. It was “Start my search”, linking to the chat.
- How it works describes the same three steps as the pricing page: pick your plan, tell us the car, we do the legwork and you decide.
- The Full Service and Ultimate Concierge intakes show the essentials first (the car, new or used, timing, budget and contact details). Other preferences sit in one optional, collapsed section. Field names and the `/api/onboarding` contract are unchanged.
- A checkout error opens one retry dialog (“Checkout didn’t open. Nothing was charged.”) instead of an error code.
- Removed: `buying/intake.js`, `buying/brief.js`, `buying/houston-search.js` and the chat, summary and editor markup. The legacy Texas pages whose bytes changed were re-pinned in `data/metro-release.json`.

**Fixed in passing.**

- Plan checkouts started outside the pricing page recorded `source_page` as `/schedule.html`. They now record the page the buyer was on.
- The Full Service intake's trade-in details never appeared after the August inline-script cleanup. They now appear for “Yes” or “Maybe” and clear for “No”.

**Unchanged.** Prices, Stripe Payment Links, server contracts and idempotency, `begin_checkout` and `purchase_verified`, consent and privacy handling, and the `script.js` direct-checkout links on blog and legacy pages.

**How to judge it.** For 30 days before and after the release, compare checkout starts per homepage visit and paid purchases per checkout start. Plan buttons send `cta_click` with `cta_location` `hero`, `pricing` or `plans`.
