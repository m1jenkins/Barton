# Claim-safety sync and redirect housekeeping — September 21, 2026

Scope: sync retired pricing out of `llms.txt` and `austin.html`, make the retired AI page's
redirect status explicit, and record what is still owner- or dashboard-owned. Dry run only:
nothing here deploys, resubmits a sitemap, changes robots directives, or touches Search Console.

## Fee truth used in this change

| Source | Full Service | Ultimate Concierge | AI Agent |
| --- | --- | --- | --- |
| `pricing.md` (Updated 2026-09-18) | $295 one time | $895 one time | Retired for new sales |
| `data/services.json` (`lastObservedAt` 2026-09-18) | 295 | 895 | `retired_for_new_sales` under `retiredServices` |
| `schedule.html` / `index.html` / `how-it-works.html` | $295 | $895 | Retirement note only |

No new fee, discount, savings figure, or street address was introduced. `data/services.json`
records `commercialTerms.guarantee` and `commercialTerms.refund` as
`pending_owner_and_legal_review` with `approvedPublicCopy: null`, so no Savings Guarantee or
average-savings language appears in this change.

## Evidence for the stale surfaces (retrieved 2026-09-20 PT)

- `llms.txt` carried `Updated: 2026-09-14` and advertised "$195 AI Agent Buying Service, $495 Full
  Service, and $895 Concierge", plus a primary-page link to `ai-car-buying-agent.html`, which
  redirects to `/schedule.html`.
- `austin.html` (`noindex, follow`) still showed plan cards for "AI Agent Buying Service — $195" and
  "Hire Drive Right Full Service — $495", an FAQ entry "Can I use the $195 plan…", and a body link
  to `ai-car-buying-agent.html`.
- The other eight Texas city pages carry no service-fee figures at all; they link to `schedule.html`
  for plans and pricing. Austin was the only leftover.
- Apex `https://driverightcarbuying.com/` answered **307** with a `Location` on the www host.
- `ai-car-buying-agent.html` answered **308** to `/schedule.html`.
- `tesla-fsd-for-sale.html` answered **200** with `noindex, follow`, self-canonical, off sitemap.
- Search result snippets still showed older "$195" and Savings Guarantee wording that is not in the
  current HTML. Treat that as cache lag, not a live source to edit.

## What changed in this PR

1. **`llms.txt`** — `Updated: 2026-09-21`; the plans line now reads "$295 Full Service and $895
   Ultimate Concierge"; the AI Agent primary-page bullet is replaced by a "Retired offers" section
   that states the retirement and the redirect. Service-area framing ("service-area business, not a
   car dealer… does not operate storefronts in each metro") is unchanged.
2. **`austin.html`** — the plan block is now Full Service $295 and Ultimate Concierge $895, wording
   taken from `pricing.md` and `schedule.html`; the retirement sentence mirrors the approved
   `schedule.html` copy; the "$195 plan" FAQ and the `ai-car-buying-agent.html` link are gone; the
   fee-provenance sentence now points at the recorded pricing source instead of the September 5
   checkout observation, which no longer matches the $295 tier
   (`data/services.json` records `checkoutStatus: new_295_link_required_before_activation`). The page
   keeps `noindex, follow`; it is not added to the sitemap and no unique local marketing claim was
   invented.
3. **`data/metro-release.json`** — `legacyTexas` pins `austin.html` by SHA-256, so the contained-bytes
   hash is re-pinned to the edited file with the reason in the `decision` field. Without this,
   `scripts/validate-site.mjs` fails with "legacy containment/preservation changed". This supersedes
   the `austin.html` sentence in `docs/seo-execution/release-candidate.md`, which described the page
   as retaining historical price copy at that release.
4. **`vercel.json`** — the retired AI page now declares `"statusCode": 301` instead of
   `"permanent": true` (which Vercel emits as 308).
5. **`scripts/check-redirects.mjs`** — the config check reads the declared status (`statusCode`, or
   308 for `permanent: true`), requires a permanent status for every rule, and requires exactly 301
   for the retired AI page. The live apex/www cases now accept either permanent status instead of
   308 only, because that status is host-level configuration (below). 307 still fails.
6. **`data/claims.csv`** — CLM-018 (retired $195/$495/$895 price claim) records the two cleared
   locations.

## Apex → www is not fixed by a file in this repo

`vercel.json` already contains permanent apex → www rules for both `/` and `/:path*`, and the live
deployment matches that config, yet the apex answers 307. `docs/seo-execution/technical-tracking-audit.md`
records that the 307 arrives before repository routing (Vercel domain-level redirect is the leading
inference; Cloudflare fronts the response, so headers alone do not prove which account setting
emits it). **Editing `vercel.json` cannot change that status.** Mason (or whoever holds account
access) has to change it where it is configured:

1. Open [Barton → Settings → Domains](https://vercel.com/m1jenkins-projects/barton/settings/domains)
   and inspect the `driverightcarbuying.com` redirect to `www.driverightcarbuying.com`.
2. Set it to a permanent status (301 or 308 — Google treats both as permanent; the repo's earlier
   note proposed 308), preserving path and query.
3. If no such Vercel setting exists, inspect the Cloudflare zone's redirect rules before changing
   anything.
4. Re-run the live matrix: `BASE_URL=https://www.driverightcarbuying.com LEGACY_BASE_URL=https://www.austincarbuyingservice.com node scripts/check-redirects.mjs`.

The other `vercel.json` host rules keep `permanent: true` (308), which preserves the request method
for any non-GET request that reaches the apex or legacy host.

## Closed decision (2026-09-22): `tesla-fsd-for-sale.html`

**Chosen option: Keep noindex park (status quo).** Date: 2026-09-22. Rationale: owner standing SEO queue / next-wave brief.

The page stays a real HTML document that answers **200**, with `<meta name="robots" content="noindex, follow">`, self-canonical `https://www.driverightcarbuying.com/tesla-fsd-for-sale.html`, and **no** `sitemap.xml` entry. It is crawlable so existing inbound and footer discovery links still resolve; it is not a publication or inventory URL.

**301 and 410 remain explicitly rejected for now.** Do not add a `vercel.json` redirect or gone status without a later named Mason decision.

The option table below is the menu that was open on 2026-09-21. Only the first row is in force.

| Option | When it fits | Consequence | 2026-09-22 |
| --- | --- | --- | --- |
| Keep noindex park (status quo) | The page may return, or its links still matter | Stays crawlable and excluded | **Chosen** |
| 301 to a relevant page | A current page covers the same intent | Needs a named target; do not send it to a page that does not answer the query | Rejected |
| 410 | Permanently retired with no equivalent | Drops from the index fastest; existing inbound links dead-end | Rejected |

`data/metro-release.json` lists `tesla-fsd-for-sale.html` in `legacyDiscoveryLinks` as a source of one link to each Texas city page. Those edges stay as recorded while the page remains crawlable under noindex.

Inventory: `data/content-inventory.csv` marks the URL `contained_pending_qualified_review` / `none_while_contained`. Claim `SEO-TESLA-2026-09-18` stays contained; this park is not exact-copy approval.

See `docs/seo/2026-09-22-tesla-fsd-disposition.md`.

## Also open, not changed here

- `llms.txt` describes Texas coverage while `pricing.md`, `index.html`, and `schedule.html` describe
  nationwide remote support. That is a coverage-scope question for Mason, not a claim-safety fix, so
  the Texas framing was left as-is.
- Live Search Console work (sitemap confirmation, coverage comparison, URL inspection, any Request
  indexing) stays with Mason. No Verify click, no invented coverage numbers.

## Acceptance checks

Repository checks (run before merge; all passed on this branch):

```sh
node scripts/validate-site.mjs
node scripts/check-redirects.mjs --config-only
npm test
```

Content checks:

- [x] `rg -n '\$195|\$495' llms.txt austin.html` returns nothing.
- [x] `rg -n 'ai-car-buying-agent' austin.html` returns nothing.
- [x] `llms.txt` money tokens are exactly $295 and $895, matching `pricing.md`.
- [x] `austin.html` still has `<meta name="robots" content="noindex, follow">` and is absent from `sitemap.xml`.
- [x] `tesla-fsd-for-sale.html` keep-noindex park closed 2026-09-22: `noindex, follow`, self-canonical, absent from `sitemap.xml`, no 301/410 in `vercel.json`.
- [x] No Savings Guarantee, refund promise, average-savings figure, or street address added anywhere.

After any deploy (Mason, live):

- [ ] `curl -sI https://driverightcarbuying.com/` returns 301 (or 308) with `location: https://www.driverightcarbuying.com/` — requires the dashboard change above, not this PR.
- [ ] `curl -sI https://www.driverightcarbuying.com/ai-car-buying-agent.html` returns 301 with `location: /schedule.html`.
- [ ] `curl -s https://www.driverightcarbuying.com/llms.txt | rg '195|495'` returns nothing.
- [ ] `curl -s https://www.driverightcarbuying.com/austin.html | rg '\$195|\$495'` returns nothing.
- [ ] Full live matrix: `BASE_URL=https://www.driverightcarbuying.com LEGACY_BASE_URL=https://www.austincarbuyingservice.com node scripts/check-redirects.mjs`.
