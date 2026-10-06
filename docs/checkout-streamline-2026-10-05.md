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

## Chat intake after payment

The owner asked on 2026-10-05 to reuse the retired chat for the paid intake, with an all-in, out-the-door budget and whatever else is needed to start a search. They also asked for an extra 0.2 seconds of "thinking" before each reply.

**What the buyer sees.** On `payment-success-fullservice.html` and `payment-success-concierge.html`, once payment verifies, the intake is a conversation: one question at a time, with tap-to-answer choices, a pencil on each answer to change it, and a Skip on optional questions. On phones it fills the screen like a messaging app. At the end the buyer checks the answers and sends them. "Use a form instead" opens the existing form with the answers filled in, and stays chosen for that tab.

**Questions** (`buying/intake.js`, in order). Required ones are marked *.

| Question | Field | Asked when |
| --- | --- | --- |
| Car* | `preferred_makes` | Always |
| New, used or CPO* | `condition` | Always |
| Model years | `model_years`, and `year_min` when it fits | Not new |
| Mileage | `max_mileage` | Not new |
| All-in, out-the-door budget* (a monthly payment works too) | `budget` | Always |
| How you're paying | `payment_method` | Always |
| Loan pre-approval | `financing_status` | Financing |
| Trade-in | `trade_in` | Always |
| The trade-in's year, make, model and mileage | `trade_vehicle`, and `trade_mileage` when it has one | A trade-in or maybe |
| Timing* | `timeline` | Always |
| Where you live* (city and state, or ZIP) | `city` | Always |
| How far you'd go | `search_radius` | Always |
| What the car needs to do | `needs` | Always |
| Colors | `colors` | Always |
| Delivery location | `delivery_address` | Ultimate Concierge |
| Name*, phone*, email* | `name`, `phone`, `email` | Always |
| Best way to reach you | `contact_preference` | Always |
| Anything else | `notes` | Always |

The car answer also sets `vehicle_type` when it names one type (an SUV, a truck). Choice answers send the form's own option values (`used`, `asap`, `finance`), so chat and form submissions look the same in the database; anything typed outside the choices is sent in the buyer's words. The Ultimate Concierge form's budget is now a typed all-in amount like Full Service's, instead of price ranges.

**How it's built.**

- The chat writes every answer into `#onboarding-form`, adding hidden inputs for the five chat-only fields, and submits it through script.js's existing handler. The payment check, idempotency key, `/api/onboarding` contract and `onboarding_complete` are unchanged. The server allowlist gained the five new fields; `buying/intake.test.js` fails if any chat answer would be dropped.
- The form stays visible until the chat module loads, so a buyer whose browser can't load it still has a working intake.
- The chat's answer box is not a `<form>`, so GTM's All Forms trigger still fires only on the final submit, never on each answer.
- The conversation is saved in the tab's `sessionStorage`, so a reload in the same tab picks up where it left off, and it is cleared after a successful submit.
- Answers are shown as page text, so the chat panel has `data-clarity-mask="true"`. Excluding Clarity from the payment pages (`docs/google-ads-setup.md` §3) is still the complete fix.
- Reply pacing is the old chat's (`min(1300, 750 + 4 ms per character)`, or 250 ms with reduced motion) plus 200 ms.
- The layout reuses the old chat styles in `daisy.css` and `drive-right.css` (`body[data-view="conversation"]`, `#intake-view`); `buying/intake-chat.css` fits them to the payment page. Pruning those rules would break this chat.

**Not changed.** The AI Agent (`payment-success-consultant.html`) and generic `payment-success.html` pages keep their forms.

**Still to check on a Vercel preview with Stripe in test mode.** The local preview can't verify a purchase. There, check one test purchase per plan: the chat starts after verification, the submit returns 201, and the `onboarding_submissions` row holds the chat fields.

**How to judge it.** Compare `onboarding_complete` per `purchase_verified` for the 30 days before and after release.
