# Docs index

Nothing in `docs/` is deployed. The docs fall into two groups:

- **Current**: how the site and its tools work now, and rules still in force. Read these.
- **Historical**: finished work, kept because `data/*.csv`, `data/*.json` and other docs link to them by path. They record what was true on their date: prices, plan names, the brand (Drive Right until October 30, 2026) and file paths in them may be out of date. Don't act on their instructions unless a current doc sends you there (some do, for evidence or a past procedure). Where one disagrees with a current doc, the current doc wins.

Add new files rather than renaming old ones. When a doc stops being current, move its line from the first group to the second.

## Current

### Operations

- [implementation-operations.md](implementation-operations.md): leads, checkout, the Stripe webhook, onboarding (the API contract), paid intake and buyer emails, car search, the ops dashboard and the Deal Tracker.
- [adr/](adr/) and [GLOSSARY.md](../GLOSSARY.md): the Deal Tracker's lasting decisions (0001 to 0004) and the terms to use exactly.
- [deal-tracker-build-plan-2026-11-21.md](deal-tracker-build-plan-2026-11-21.md): the Deal Tracker plan, launched in Production on November 25, 2026: Mason's decisions, the data, code and setup, and tests. Code comments cite it.
- [checkout-streamline-2026-10-05.md](checkout-streamline-2026-10-05.md): the plan-first checkout that replaced the chat intake, and the October 4–6 outage that led to it.
- [seo-execution/stripe-cutover-2026-10-23.md](seo-execution/stripe-cutover-2026-10-23.md): the live Payment Links (its "Reverted" section, $395/$695) and the 50OFF promotion code. The $195/$345 cut it opens with was reverted the same day.

### Plans and website copy

- [seo/2026-11-26-plan-reach.md](seo/2026-11-26-plan-reach.md): Steer Me Right limited to dealers within 200 miles, Pro nationwide with shipping quotes and trade-in support, the public $300 upgrade withdrawn, and the Stripe steps for Pro as a checkout add-on.
- [seo/2026-11-26-private-client-plan.md](seo/2026-11-26-private-client-plan.md): Steer Me Right Private Client, the $1,995 plan for cars with an MSRP of $100,000 or more: what it adds over Pro, the rules, where it lives and the launch steps.
- [seo/2026-11-27-plans-on-homepage.md](seo/2026-11-27-plans-on-homepage.md): The plans moved onto the homepage and `schedule.html` was retired behind a 301: what moved, how plan links open checkout now, what was left alone and the after-deploy steps.
- [content-approval-2026-10-01.md](content-approval-2026-10-01.md): owner approval of all current website content; replaces older pending-review instructions for public copy.
- [editorial-policy-draft.md](editorial-policy-draft.md): editorial standards for guide content.
- [release-readiness.md](release-readiness.md): what must be true before a draft page goes public.
- [resource-release-2026-10-04.md](resource-release-2026-10-04.md): the three released guides and the local quote worksheet.

### SEO and generated pages

- [seo/2026-09-21-claim-safety-redirects.md](seo/2026-09-21-claim-safety-redirects.md): redirects, claim safety and the apex → www setup outside the repo.
- [seo/2026-09-21-content-pages.md](seo/2026-09-21-content-pages.md): the indexing rules for the service pages and the legal blog posts (don't mass-request indexing); `scripts/_tests/seo-content-pages.test.mjs` pins them.
- [seo/2026-09-22-tesla-fsd-disposition.md](seo/2026-09-22-tesla-fsd-disposition.md): why `tesla-fsd-for-sale.html` stays a noindex park.
- [seo/2026-10-18-competitor-comparison-pages.md](seo/2026-10-18-competitor-comparison-pages.md): the CarEdge and Delivrd comparison pages, their sourced fact sheet and the monthly and quarterly rechecks.
- [seo/2026-11-07-brand-search-visibility.md](seo/2026-11-07-brand-search-visibility.md): why the bare "steer me right" search shows a song instead of the site, the Search Console, Maps and Bing steps left after the rename, and IndexNow.
- [local-seo-package.md](local-seo-package.md): the Google Business Profile's hidden-address service-area setup, which the brand search doc and `data/entities.json` rely on. Its September status notes are dated.
- [seo/2026-11-10-service-intent-and-competitor-pages.md](seo/2026-11-10-service-intent-and-competitor-pages.md): the car negotiation, service cost, CarEdge Concierge and Delivrd review pages, their rules and records.
- [seo/2026-11-15-seo-overhaul.md](seo/2026-11-15-seo-overhaul.md): the November 15, 2026 audit, the car broker page, homepage links and short-address redirects, and the owner actions that remain.
- [seo/2026-11-15-market-and-service-pages.md](seo/2026-11-15-market-and-service-pages.md): the seventeen generated city pages, their hub and four more service-intent pages; how the city pages are generated, their rules and open items.
- [seo/2026-11-15-vehicle-price-pages.md](seo/2026-11-15-vehicle-price-pages.md): the per-model price pages and car-versus-car pages; how they are generated, sourcing rules, the monthly incentive refresh and open items.
- [seo/2026-11-21-deal-pages.md](seo/2026-11-21-deal-pages.md), [seo/2026-11-21-roundup-pages.md](seo/2026-11-21-roundup-pages.md), [seo/2026-11-21-hybrid-pages.md](seo/2026-11-21-hybrid-pages.md), [seo/2026-11-21-problems-pages.md](seo/2026-11-21-problems-pages.md): the four page families built from the price guides.

### Metro drafts

- [metro-execution-2026-09-16.md](metro-execution-2026-09-16.md): how to generate and preview the metro drafts, and the release gate.
- [metro-release-decision-2026-09-16.md](metro-release-decision-2026-09-16.md): which drafts were approved or withdrawn.

### Homepage, media and ads

- [redesign-wise-2026-10-25/README.md](redesign-wise-2026-10-25/README.md): the current homepage design, published October 30, 2026.
- [homepage-legwork-motion-2026-10-23.md](homepage-legwork-motion-2026-10-23.md): the Remotion legwork card videos, how they play and how to re-render them.
- [media-inventory.md](media-inventory.md): where the external photos came from.
- [openai-ads-setup.md](openai-ads-setup.md): ChatGPT ads conversion tracking (the pixel in `openai-ads.js`).
- [openai-ads-cro-2026-10-02.md](openai-ads-cro-2026-10-02.md): the pricing inquiry path and verified purchase measurement that the setup doc and `implementation-operations.md` defer to. Its campaign notes are dated.

## Historical

### Site and copy

- [repository-audit-2026-10-04.md](repository-audit-2026-10-04.md): the October 4 repository audit and lead/form reliability fixes.
- [sales-copy-2026-10-05.md](sales-copy-2026-10-05.md): the October 5 conversion rewrite, with owner decisions and exact strings.
- [measurement-check-2026-10-05.md](measurement-check-2026-10-05.md): which analytics events fired after that rewrite.
- [copy-cleanup-2026-10-23.md](copy-cleanup-2026-10-23.md): the October 23 plain-language copy pass and the claim rows it touched.
- [homepage-legwork-review-2026-09-17.md](homepage-legwork-review-2026-09-17.md), [homepage-visual-refresh-2026-10-07.md](homepage-visual-refresh-2026-10-07.md): earlier homepage versions, replaced by the October 30 redesign.
- [clm-013-compensation-attestation.md](clm-013-compensation-attestation.md): the evidence packet for the "no dealer commissions" claim (CLM-013, approved September 30).

### SEO

- [seo-execution/](seo-execution/): the September task-by-task SEO work (`SEO-01` to `SEO-10`, [status.md](seo-execution/status.md), [release-candidate.md](seo-execution/release-candidate.md)) and the earlier Stripe price packets (`stripe-cutover.md`, `stripe-cutover-2026-09-27.md`). The current Stripe record is listed above.
- [seo-agent-runbook.md](seo-agent-runbook.md) and [seo-agent-prompts.md](seo-agent-prompts.md): the plan and prompts behind that work.
- [seo-release-preparation-2026-09-05.md](seo-release-preparation-2026-09-05.md), [MAPS-ANALYSIS-driverightcarbuying.com.md](MAPS-ANALYSIS-driverightcarbuying.com.md), [ai-retrieval-experiment.md](ai-retrieval-experiment.md): September SEO and Maps work under the old domain.
- [seo/2026-09-25-seo-growth-plan.md](seo/2026-09-25-seo-growth-plan.md), [seo/2026-09-25-seo-execution.md](seo/2026-09-25-seo-execution.md) and the `seo/2026-09-25-*.json` evidence: the September growth plan and release. Current SEO docs still use the growth plan's evidence tags (**REQUIRED**, **RECOMMENDED** and so on).
- [seo/2026-10-01-national-competitor-seo-plan.md](seo/2026-10-01-national-competitor-seo-plan.md) and [its research](seo/2026-10-01-national-competitor-research.md), with the `seo/2026-10-01-*` catalogs: the October 1 national competitor plan.
- [seo/2026-10-23-plan-rename.md](seo/2026-10-23-plan-rename.md): Full Service and Ultimate Concierge renamed Drive Right and Drive Right Pro. Its scopes were replaced by the November 26 plan reach doc.
- [seo/2026-10-23-search-console-queries-and-ad-themes.md](seo/2026-10-23-search-console-queries-and-ad-themes.md): the October 23 Search Console query pull and Google Ads themes. The Google Ads campaign files it cites were removed on October 30.
- [seo/handoff-ford-vs-sierra-2026-11-19/](seo/handoff-ford-vs-sierra-2026-11-19/): how the F-150 vs Sierra page was finished. Its `briefs/research.md` section E is cited by `scripts/nhtsa-problems.mjs`.

### Metro and city plans

- [metro-seo-expansion-plan.md](metro-seo-expansion-plan.md), [metro-city-pages-implementation-plan.md](metro-city-pages-implementation-plan.md), [metro-baseline-template.md](metro-baseline-template.md): the September metro plans and template.
- [city-pages-2026-09-17.md](city-pages-2026-09-17.md): the 20 homepage-based city drafts, removed on November 26, 2026.

### Advertising

- [openai-ads-marketing.md](openai-ads-marketing.md), [openai-ads-homepage-2026-10-06.md](openai-ads-homepage-2026-10-06.md), [openai-ads-rethink-2026-10-23.md](openai-ads-rethink-2026-10-23.md): ChatGPT ads strategy, campaign changes and the October 23 rethink.
