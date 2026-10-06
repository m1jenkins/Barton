# Docs index

Nothing in `docs/` is deployed. Many files here are dated decision records or evidence that `data/*.csv`, `data/*.json` and other docs link to by path, so add new files rather than renaming old ones.

## Start here

- [content-approval-2026-10-01.md](content-approval-2026-10-01.md): owner approval of all current website content; replaces older pending-review instructions for public copy.
- [release-readiness.md](release-readiness.md): what must be true before a draft page goes public.
- [editorial-policy-draft.md](editorial-policy-draft.md): editorial standards for guide content.
- [implementation-operations.md](implementation-operations.md): leads, checkout, Stripe webhook and onboarding (the API contract).
- [resource-release-2026-10-04.md](resource-release-2026-10-04.md): owner-directed release of three source-checked guides and the local quote worksheet.
- [repository-audit-2026-10-04.md](repository-audit-2026-10-04.md): repository audit, lead/form reliability fixes, expanded checks, verification and prioritized follow-up work.
- [checkout-streamline-2026-10-05.md](checkout-streamline-2026-10-05.md): the October 4–6 checkout/lead/webhook outage and the plan-first checkout that replaced the chat intake.
- [sales-copy-2026-10-05.md](sales-copy-2026-10-05.md): the 2026-10-05 conversion rewrite (headline, hero, savings section, trust lines, reply window, Concierge scope, header phone) with owner decisions, exact strings, the client review request and the Phase 2 list.
- [measurement-check-2026-10-05.md](measurement-check-2026-10-05.md): what the analytics events do and do not fire after the rewrite, and why Vercel Web Analytics stays empty.

## SEO decisions and execution

- [seo/](seo/): dated SEO decisions (redirects and claim safety, content pages, the Tesla FSD page park).
- [seo-execution/](seo-execution/): task-by-task SEO work (`SEO-01` to `SEO-10`), with [status.md](seo-execution/status.md) as the tracker and [release-candidate.md](seo-execution/release-candidate.md) as the evidence summary. Current Stripe price work: [stripe-cutover-2026-09-27.md](seo-execution/stripe-cutover-2026-09-27.md) ($395/$695).
- [seo-agent-runbook.md](seo-agent-runbook.md) and [seo-agent-prompts.md](seo-agent-prompts.md): the plan and prompts behind that work.
- [seo-release-preparation-2026-09-05.md](seo-release-preparation-2026-09-05.md), [local-seo-package.md](local-seo-package.md), [MAPS-ANALYSIS-driverightcarbuying.com.md](MAPS-ANALYSIS-driverightcarbuying.com.md), [ai-retrieval-experiment.md](ai-retrieval-experiment.md).

## Metro and city pages

- [metro-execution-2026-09-16.md](metro-execution-2026-09-16.md): how to generate and preview metro drafts, and the release gate.
- [metro-release-decision-2026-09-16.md](metro-release-decision-2026-09-16.md): which drafts were approved or withdrawn.
- [city-pages-2026-09-17.md](city-pages-2026-09-17.md): the 20 homepage-based city page drafts.
- [metro-seo-expansion-plan.md](metro-seo-expansion-plan.md), [metro-city-pages-implementation-plan.md](metro-city-pages-implementation-plan.md), [metro-baseline-template.md](metro-baseline-template.md): plans and templates.

## Homepage and media

- [homepage-legwork-review-2026-09-17.md](homepage-legwork-review-2026-09-17.md): homepage copy review.
- [media-inventory.md](media-inventory.md): where the external photos came from.

## Advertising

- [openai-ads-setup.md](openai-ads-setup.md): ChatGPT ads conversion tracking setup.
- [openai-ads-cro-2026-10-02.md](openai-ads-cro-2026-10-02.md): pricing inquiry path, verified purchase measurement, price-visible ad tests and current delivery limitations.
- [openai-ads-marketing.md](openai-ads-marketing.md): ad strategy and draft copy.
- [openai-ads-homepage-2026-10-06.md](openai-ads-homepage-2026-10-06.md): all ads moved to the homepage; low-CTR and high-CPC ads paused; campaign extended for the credit promo.
- [google-ads-launch-plan-2026-09-27.md](google-ads-launch-plan-2026-09-27.md): approved Google Search launch plan: launch gates, campaigns, ad copy and the 30-day operating plan.
- [google-ads-setup.md](google-ads-setup.md): the owner's Google Ads, Tag Manager and Editor steps.
- [clm-013-compensation-attestation.md](clm-013-compensation-attestation.md): draft packet for the "no dealer commissions" claim.
- Campaign files live outside `docs/`, in `outputs/2026-10-google-search-ads/`.
