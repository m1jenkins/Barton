# Why "steer me right" doesn't find the site, and the fix (2026-11-07)

Read this before working on brand search, the Google Business Profile, Search Console for steermeright.com or the Organization schema. It records what Google and Bing showed on November 7, 2026, eight days after the October 30 rename from Drive Right Car Buying (driverightcarbuying.com) to Steer Me Right (steermeright.com), what changed in the repo, and the account work only Mason can do.

Evidence tags follow the [growth plan](2026-09-25-seo-growth-plan.md): **REQUIRED** = platform rule, **RECOMMENDED** = platform guidance, **OBSERVED** = measured, **HYPOTHESIS** = plausible and untested.

## Diagnosis

The site is not missing from Google. It is indexed and ranks first when the search says what the business is. It loses the bare phrase because "Steer Me Right" is already a well-known song.

| Google query (Austin location, Nov 7) | Where steermeright.com appears |
|---|---|
| `site:steermeright.com` | Indexed: home, About, How it works, pricing, guides, comparison pages |
| `steer me right car buying` | #1 and #2, with an AI Overview naming Steer Me Right |
| `steer me right austin` | #1–#4 |
| `steermeright` | #1–#2 |
| `steer me right reviews` | #1 (homepage with its Google reviews quote) |
| `steer me right` | **Not in the top 60.** A Google music panel for The Neville Brothers' 1990 song (Aaron Neville also recorded it) fills page 1, plus Spotify, YouTube, Genius and Shazam results. Page 2 is more song results |
| `drive right car buying` | The **old** domain still ranks #1 with sitelinks; steermeright.com/austin is #2 |
| `car buying service austin` | Old-domain URLs still appear; the new domain mostly doesn't yet |

**Bing:** `site:steermeright.com` returns nothing relevant, so the new domain is barely in Bing's index. Bing feeds Copilot and part of ChatGPT search. [OBSERVED]

### Why the bare phrase loses

1. **Entity competition.** Google treats a bare phrase as navigational to the best-known entity. A song with a music panel, decades of Spotify, YouTube and lyrics pages, and a famous artist outweighs an eight-day-old domain with no other sites talking about it. No on-page change overrides that. Only the brand's own popularity does: branded searches, mentions, reviews and profiles. [OBSERVED; Ahrefs found web mentions and branded search volume track visibility far better than backlinks]
2. **The domain move isn't registered.** The signed-in Search Console account has a property for `https://www.driverightcarbuying.com/` but **none for steermeright.com**. So the new sitemap has never been submitted, the Change of Address tool hasn't been run, and there's no data on the new domain. The 308 redirects are correct, so Google is moving rankings anyway, just slowly. That's why the old domain still wins "drive right car buying". [REQUIRED: Change of Address needs both properties verified]
3. **Profiles that should corroborate the brand don't.**
   - Google Maps shows **two** "Steer Me Right" listings. One is the service-area profile with the 4 five-star reviews, but it says "Open 24 hours" while the site says Mon–Fri 9–5 ([cid 14692427625443379224](https://maps.google.com/?cid=14692427625443379224)). The other has no reviews, shows a public street address, and opens as "AM LLC" ([cid 4449030103840805460](https://maps.google.com/?cid=4449030103840805460)). Google allows one profile per business. The duplicate splits signals and risks suspension, and a public address breaks the hidden-address service-area setup in [local-seo-package.md](../local-seo-package.md). [REQUIRED]
   - Neither listing gets a knowledge panel on any brand query.
   - The YouTube channel "Steer Me Right Car Buying" ([@MasonsCarRadio](https://www.youtube.com/channel/UCjshNKt5SKJyIc5Kb1xT-Cg), 325 subscribers) ranks on page 1 for "steer me right car buying" but never links to steermeright.com, and the site never linked to it until this change.
4. **Old-domain redirect chain.** `https://driverightcarbuying.com/` → `https://www.driverightcarbuying.com/` → `https://www.steermeright.com/` is two hops. The first hop comes from the Vercel domain setting, not `vercel.json`. Old www URLs redirect page to page in one 308, which is correct. [RECOMMENDED: avoid chains]

## What changed in the repo (this commit)

| Change | Why | Tag |
|---|---|---|
| Homepage and About `Organization` gain `sameAs` (the YouTube channel) and `alternateName` ["Steer Me Right Car Buying Service", "Steer Me Right Car Buying", "Drive Right Car Buying"] | Ties the new name to the old one and to an owned profile. The registry (`data/entities.json`) now holds `sameAs` as `approved` and keeps the Maps URL out until the listing is fixed | RECOMMENDED |
| Homepage `WebSite.alternateName` adds "SteerMeRight" | Site-name signal for the run-together spelling people type | RECOMMENDED |
| About page: "Until October 2026, Steer Me Right was called Drive Right Car Buying" and a link to the YouTube channel | Visible confirmation of the rename for people and crawlers following old reviews and links | RECOMMENDED |
| Footer YouTube link (`rel="me"`) on the three pages that share the current footer (home, About, pricing) | Two-way link between site and channel | HYPOTHESIS |
| `llms.txt` notes the former name and domain | AI assistants reading it can join the two names | HYPOTHESIS |
| IndexNow key file (`fc69ca18e07e517074ebc1f9c48e0c61.txt`) and `npm run indexnow` (`scripts/indexnow.mjs`) | Pings Bing and other IndexNow engines with sitemap URLs or named paths. Run it after each deploy that changes public pages | RECOMMENDED |

Not changed: page titles, H1s and approved copy. The titles already end in "| Steer Me Right" and win every qualified brand query, so rewriting approved copy wouldn't change the bare-phrase result.

## Owner actions, in order

Accounts and settings are Mason's. Each step says how to verify it.

**Done on November 7, 2026 (signed in as the Search Console owner):**
- Steps 1, 2 and 4. The Domain property `sc-domain:steermeright.com` is verified by the Vercel DNS TXT record `google-site-verification=y3_tgDIf…` (record `rec_377a9ce0b942082acfd3c4db`). **Don't delete it, or the property loses verification.** The sitemap was submitted: Success, 17 pages.
- URL Inspection: `/`, `/car-buying-service.html` and `/schedule.html` are already indexed on the new domain. `/about.html` was "Discovered – currently not indexed". Indexing was requested for `/` (it changed) and `/about.html`.
- IndexNow accepted all 17 sitemap URLs (HTTP 202).
- Step 3, with Mason's approval: Change of Address was submitted from `https://www.driverightcarbuying.com/` to `steermeright.com`. Validation passed (homepage 301, both sites verified, all five sample pages redirect), and the old property shows "This site is currently moving", started November 7, 2026. **Keep the old domain and its redirects for at least 180 days, and preferably a year.**
- Step 7, with Mason's approval: the YouTube channel now has a "Steer Me Right" link to `https://www.steermeright.com/`, and its description ends with a line pointing to the site. YouTube link titles are limited to about 30 characters.
- Step 9, with Mason's approval: the Vercel domain `driverightcarbuying.com` now redirects (301) straight to `www.steermeright.com`, keeping paths and query strings. The Stripe webhook on `www.driverightcarbuying.com/api/` is unaffected. `austincarbuyingservice.com` still has the same two-hop setup (a Vercel domain redirect to `www.driverightcarbuying.com`) and takes the same fix.
- Not done: step 5 (Maps listing). Mason didn't approve these edits. Step 8 (Bing) needs Mason to sign in to Bing Webmaster Tools.

| # | Do this | Where | Verify |
|---|---|---|---|
| 1 | Add a **Domain property** `steermeright.com` and verify it with the DNS TXT record (DNS is on Vercel) | Search Console → Add property | The property opens with no "verification" banner |
| 2 | Submit `https://www.steermeright.com/sitemap.xml` | New property → Sitemaps | Status "Success", 17 discovered pages |
| 3 | Run **Change of Address** from `https://www.driverightcarbuying.com/` to the new property. Keep the old domain and its redirects for at least a year | Old property → Settings → Change of address | Old property shows "This site is moving to steermeright.com" |
| 4 | URL Inspection → Request indexing for `/`, `/about.html`, `/car-buying-service.html`, `/schedule.html` | New property | Each shows "URL is on Google" with Google-selected canonical on steermeright.com |
| 5 | Fix the Maps listings: keep the reviewed service-area profile (cid 14692427625443379224), set hours to Mon–Fri 9–5, website `https://www.steermeright.com/?utm_source=google&utm_medium=organic&utm_campaign=gbp`, and remove or report the duplicate "AM LLC" listing at the street address | business.google.com, or "Suggest an edit → Remove → Duplicate" on Maps | Maps search "Steer Me Right Austin" returns one listing |
| 6 | Once one public listing remains, add its Maps URL to `organization.sameAs` in `data/entities.json` and to both pages' `Organization.sameAs` | Repo | `npm run check:buying` passes |
| 7 | Add `https://www.steermeright.com` to the YouTube channel's links and description, and rename the handle away from `@MasonsCarRadio` if a Steer Me Right handle is free | YouTube Studio → Customization | The channel About page lists the site |
| 8 | Import the new property into **Bing Webmaster Tools** (it can import from Search Console), submit the sitemap, then run `npm run indexnow` | bing.com/webmasters | Bing `site:steermeright.com` returns the site |
| 9 | Point the old apex `driverightcarbuying.com` straight at `https://www.steermeright.com` in the Vercel domain settings, skipping the www hop. The apex is proxied by Cloudflare, and the 301 to www comes from Vercel (`x-vercel-id` on the response) | Vercel → Project → Domains | `curl -sI https://driverightcarbuying.com/` returns 308 to `www.steermeright.com` |
| 10 | Update every profile that still says Drive Right or links the old domain: Stripe receipts (done Oct 30), email signatures, Facebook, Instagram, LinkedIn, Yelp, BBB, Apple Business Connect, Bing Places | Each service | A Google search for `"driverightcarbuying.com"` returns only redirects and old pages |

## Earning the bare phrase (months, not days)

The song won't go away. Steer Me Right can only win "steer me right" for searchers who mean the business, and that comes from popularity, not markup. In order of expected effect:

1. **Reviews on the one Google profile.** Ask every finished buyer, with the review link in the delivery email. Never gate or buy them. [REQUIRED policy; OBSERVED effect]
2. **YouTube.** Call-in and short-form videos with "Steer Me Right" in the channel name, a spoken mention and the site in each description. YouTube mentions showed the strongest correlation with AI Overview visibility in the Ahrefs studies. [OBSERVED]
3. **Mentions where car buyers already look:** answers in r/askcarsales and r/whatcarshouldIbuy (as Mason, disclosed, not promotional), local Austin press or podcasts, and car-buying roundups that list advocates. Each mention that names "Steer Me Right" next to "car buying" teaches Google which meaning of the phrase people want. [OBSERVED]
4. **Branded searches from ads.** The Google Ads brand campaign should bid on "steer me right" exact and "steer me right car buying" phrase. People clicking through to the site for the bare phrase is the clearest demand signal there is. [HYPOTHESIS for organic effect]
5. **Consistency.** Use the same name, email (hello@steermeright.com), phone and hours on the site, the Google profile, Bing Places, Apple and every directory. [RECOMMENDED]

## How to measure

- **Weekly, for 8 weeks:** search `steer me right`, `steer me right car buying`, `steermeright`, `drive right car buying` and `car buying service austin` signed out with Austin location, and record steermeright.com's best position and whether a business panel shows. A browser `fetch('/search?q=…')` from a google.com tab, counting `steermeright.com` in the HTML, is a quick check: 52 hits on a query where it ranks #1, 0 for pages 3–6 of the bare phrase on Nov 7.
- **Search Console (new property), after 2–4 weeks of data:** filter Queries to "steer", and track impressions and average position for "steer me right" and its variants. Compare the old property's clicks falling against the new one's rising.
- **Done when:** the old domain no longer ranks for "drive right car buying", one Google listing shows a panel for "steer me right car buying", and steermeright.com appears anywhere in the top 20 for "steer me right".
