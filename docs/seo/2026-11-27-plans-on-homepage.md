# One plans page: the homepage (2026-11-27)

Mason, November 27, 2026: the homepage and `schedule.html` were nearly the same page. The homepage's "See what's included" button led to `schedule.html`, which repeated the homepage with fuller plan cards, and buyers landing on the site found that confusing. He asked to commit to one page.

## What changed

- `index.html#plans` now has everything the pricing page had for choosing a plan: the refund line, the three full plan cards (`#full-service`, `#concierge`, `#private-client`, strings unchanged from the pricing page), each with its own checkout and a "Talk to Mason about my car search" button, the "Not sure which plan you need?" band and the fine print. The "See what's included" button is gone, and every homepage button that went to `schedule.html` now scrolls to `#plans` (or `#concierge` for the Pro section).
- The plan FAQ ("Questions before you choose.") moved to the homepage, above the closing band, with two edits that keep earlier homepage rules:
  - "What happens after I pay?" says "We reply to confirm the search" without "within one business day" (no reply-time promise on the homepage, 2026-11-26).
  - "How do you compare with CarEdge or Delivrd?" is left out (the homepage does not link the competitor pages, 2026-10-30). Those pages stay linked from `car-buying-service.html` and the Resources page.
- The homepage Service schema lists all three plans, with URLs `https://www.steermeright.com/#full-service`, `#concierge` and `#private-client`. `scripts/validate-site.mjs` expects these URLs on every page.
- `schedule.html` is deleted. `vercel.json` 301s `/schedule.html` and `/schedule` to `/`. The destination has no fragment, so browsers should carry an old link's `#private-client` through to the homepage card (check after deploying). A bare `/schedule.html` lands on the top of the homepage, not on the plans. `/pricing`, `/pricing.html`, `/inquiry.html`, `/ai-car-buying-agent.html` and `/payment-success-consultant.html` now go straight to `/`, so nothing chains.
- Every page that linked `schedule.html` now links the homepage: `/#plans` for "Pricing", "Get started" and plain plan links; `/#full-service` and `/#concierge` for plan buttons. Links that used to open Stripe straight away (any `schedule.html#full-service` or `#concierge` link, through `script.js`) carry `data-service-tier`, so they still do. `/#private-client` links only navigate, as before. Generated families were changed in their renderers and data, then rebuilt.
- `sitemap.xml` drops `schedule.html`, and the homepage `lastmod` moved to 2026-11-27. `llms.txt`, `pricing.md` and `data/services.json` point to the homepage.
- The nine pinned legacy Texas pages were re-pinned in `data/metro-release.json`; their only change is the plan links. `data/content-inventory.csv` marks `schedule.html` as a retired redirect.
- Not carried over from the pricing page, because the homepage already covers them: its hero lead, "The worst parts of car buying, off your plate.", the three checkout steps, the advisor blurb, the "Get your time back." closing band, and its title and meta description.
- `seo-release.test.mjs` now checks the three cards and three Services on `index.html`, the 301, and that no page links `schedule.html`. `direct-checkout-client.test.mjs` checks that `/#full-service` and `/#concierge` links with `data-service-tier` open checkout.

## Left as it was

- `script.js` still turns `schedule.html#…` links into checkout, and its retired-plan and stale-offer paths still send buyers to `/schedule.html#…`, which the 301 forwards. Changing it would bump the `script.js` hash on every page. Do it the next time `script.js` changes for another reason.
- `buying/checkout.js` keeps `/schedule.html` as its default `sourcePage`. `buying/app.js` always passes the page's path, so the default is unused. Changing it would bump the `checkout.js` and `app.js` hashes.
- `api/_lib/analytics.js` still labels `/schedule.html` as the service page, for older events. `web-analytics.js` still lists it.
- Historical docs, `data/claims.csv` locations and the SEO evidence files still name `schedule.html`. They are records of what was true then.
- `buying/home-wise.css` still has the two-card grid and `.wz-plan-private` rules, which no page uses now. Removing them would bump the stylesheet hash on every page that loads it.

## After deploying

- Run `npm run indexnow`, and resubmit `sitemap.xml` in Search Console.
- Point anything outside the repo that links `schedule.html` at `https://www.steermeright.com/#plans`: ad final URLs, email signatures, and any agent instructions that read the live pricing page (the Client Outreach instructions in `docs/client-inquiries-setup-2026-11-03.md` say to read `schedule.html`). The 301 covers them meanwhile.
- Done November 27, 2026 (Mason): the Google Business Profile's "Menu or services link" went from `/schedule.html?utm_…` to `https://www.steermeright.com/?utm_source=google&utm_medium=organic&utm_campaign=gbp#plans`. Its website button already pointed at the homepage, and the profile has no booking link, products or posts. Both links are listed under "Campaign tags on links we control" in `docs/implementation-operations.md`.
- With `BASE_URL` set, `node scripts/check-redirects.mjs` checks the live 301. Also open `https://www.steermeright.com/schedule.html#private-client` in a browser and check it lands on the Private Client card.
- Check GTM, GA4 and ad conversions for anything keyed on the `/schedule.html` path (page-view triggers, funnels, audiences, conversion URLs). Plan clicks now come from `/` with `cta_location` `plans`.
