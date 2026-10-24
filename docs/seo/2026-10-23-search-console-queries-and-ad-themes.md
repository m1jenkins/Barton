# Search Console queries and Google Ads search themes (2026-10-23)

Read this before choosing Google Ads keywords, search themes or negatives, or before reading Search Console query data for the site. It records the latest Search Console query pull, what each candidate ad term showed, and the decisions that came out of it.

Older Search Console snapshots (`docs/seo/2026-09-25-search-console-evidence.json`, `docs/seo-execution/SEO-02.md`, `docs/seo-execution/query-map.csv`) are dated records for their own windows. Where they differ from this file, this file is newer.

## Source

- **Property:** `https://www.driverightcarbuying.com/` (URL prefix), Web search, no filters.
- **Window:** July 22 – October 21, 2026 (Search Console "3 months"), read on October 23, 2026 ("Last update: 3.5 hours ago").
- **Totals:** 110 clicks, 7.18K impressions, 1.5% CTR, average position 24.
- **Rows:** 400 queries. The top 200 (every query with 2+ impressions) were read. The rest have 1 impression each. Search Console leaves out anonymized queries.
- **Access:** read in the owner's browser via the Claude in Chrome extension. The browser's default Google profile asks to re-verify. Adding `&authuser=1` to the report URL (it becomes `/u/1/search-console/...`) opens the profile that owns the property. Read only: nothing was saved, submitted or exported.
- **Search volume** comes from `outputs/2026-10-google-search-ads/keyword-planner/historical-metrics-2026-09-27.csv` (US, ranges only).

What Search Console can tell you here: at position 24, it shows which searches Google already ties to the site, not how many people search. Keyword Planner is the demand measure. A term with Keyword Planner volume and zero Search Console impressions usually means the site doesn't rank for it, not that nobody searches for it.

## Service-intent queries (90 days)

| Query | Clicks | Impressions | Position |
|---|---|---|---|
| car buying service | 2 | 441 | 29.0 |
| car negotiation service | 3 | 105 | 13.6 |
| car buyers advocate | 0 | 64 | 29.5 |
| car buying services | 1 | 59 | 37.9 |
| car broker service | 0 | 49 | 28.7 |
| car negotiator | 1 | 49 | 17.9 |
| car buying agent | 0 | 39 | 20.8 |
| car buying advocate | 0 | 33 | 18.7 |
| car shopping service | 0 | 30 | 46.5 |
| car buying help | 0 | 24 | 38.6 |
| vehicle negotiator | 0 | 22 | 22.1 |
| used car buying service | 0 | 22 | 46.5 |
| auto buying services | 0 | 21 | 46.7 |
| car buying negotiation service | 0 | 20 | 16.1 |
| car buying helper | 0 | 20 | 22.2 |
| car broker | 0 | 17 | 8.9 |
| car buyers agent | 0 | 17 | 23.8 |
| professional car negotiator | 0 | 17 | 28.3 |
| car buying consultant | 0 | 17 | 29.4 |
| personal car shopper in texas | 0 | 13 | 6.7 |
| car finding service | 0 | 12 | 44.9 |
| auto broker fees | 0 | 11 | 74.7 |
| car buying expert | 0 | 10 | 11.1 |
| car finder service | 0 | 8 | 43.2 |
| car buying broker | 1 | 8 | 13.8 |
| new car negotiation service | 1 | 7 | 14.6 |
| car broker near me | 2 | 6 | 3.7 |
| hire someone to negotiate car price | 0 | 4 | 2.5 |

No query containing "concierge" or "locator" reached 2 impressions, even though 25 site pages use "concierge".

**Brand confusion:** "drive right auto sales" (66 impressions, 4 clicks), "right drive fort worth" (66), "drive right auto" (28) and "driveright auto sales" (20) are other businesses. This matches the launch plan's reason for not bidding on bare "drive right". The brand keywords are exact and phrase "drive right car buying", which these queries don't match, so they need no extra negatives.

**Not ad terms:** "cars under 30k" variants (several hundred impressions combined), "best dealership in …", "upfront pricing car dealer texas" (134) and "best dealership opportunities for 2025" (108) come from blog content. Their searchers are researching cars or dealers, not hiring a service.

## Search themes (Performance Max)

The approved launch plan is Search only, with display expansion off (`plan.json` governance). Search themes exist only in Performance Max, which serves on Display, YouTube and Gmail too. Building a Performance Max campaign is an owner decision outside the plan, and it can't use the plan's campaign-level negatives (they would need an account-level list).

If a Performance Max campaign is built, use these 12 themes:

| Theme | Keyword Planner (US/mo) | Search Console evidence |
|---|---|---|
| car buying service | 1K–10K | 441 impr, 2 clicks |
| car negotiation service | 100–1K | 105 impr, 3 clicks (best non-brand query) |
| car negotiator | 100–1K | 49 impr, 1 click |
| car buying agent | 100–1K | 39 + "car buyers agent" 17 |
| car buying advocate | not run | "car buyers advocate" 64 + "car buying advocate" 33 |
| car buying consultant | 100–1K | 17 |
| hire someone to negotiate car price | 10–100 | 4 at position 2.5 |
| professional car negotiator | not run | 17 + "car buying negotiation service" 20 |
| car buying service cost | 10–100 | fee questions ("auto broker fees", "car broker fees", "how much do car brokers charge") ≈ 22 |
| car buying concierge | 100–1K | 0 (site doesn't rank; ads can fill the gap) |
| car finder service | 100–1K, +900% 3-month | 8 + "car finding service" 12 |
| personal car shopper | 10–100 | "personal car shopper in texas" 13 at position 6.7 |

Rejected, and why:
- **Close variants of a kept theme** (themes already match variants): car buying services, car buying negotiator, car price negotiation service, car shopping service, new car negotiation service.
- **No data or weak intent:** car concierge service (also valet and chauffeur searches), car locator service, nationwide car buying service, negotiate car price for me, someone to buy a car for me.
- **Tips-seekers with the highest bids:** help buying a car ($2.46–$11.50 top-of-page), car buying help, car buying helper.
- **Sellers:** used car buying service (many searchers want to sell their car; the plan already blocks "we buy" and "sell").
- **Location terms** (Texas, Austin): location targeting does this job.
- **"broker" terms:** real demand (car broker service 49, car broker near me 2 clicks), but "broker" is on the plan's forbidden list and in its negatives. Only the owner can change that.
- **Competitor and own-brand terms:** banned (`allow_competitor_terms: false`) or owned by the Brand campaign.

## Changes to the Search plan

- **Removed [help buying a car]** from the Car Buying Advisor ad group in `outputs/2026-10-google-search-ads/plan.json` (logged in `change-log.md`).
- **Candidates, not added:** "car buying advocate", "professional car negotiator" and "vehicle negotiator" (removed on 2026-09-27 for no Keyword Planner data; Search Console now shows 22 impressions). Run them through Keyword Planner before adding them to `plan.json`.

## Repeating this pull

1. Open `https://search.google.com/search-console/performance/search-analytics?resource_id=https%3A%2F%2Fwww.driverightcarbuying.com%2F&num_of_days=90&authuser=1`.
2. Set **Rows per page** to 500 (the page shows 100 at a time in text extraction; use **Next page**).
3. Record the window, totals and row count, and add a new dated file rather than editing this one.
