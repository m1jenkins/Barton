# Drive Right AI Retrieval Experiment

## Decision

- **Experiment ID:** `dr-evidence-template-2026-01`
- **Hypothesis:** Applying a source-led answer template to six eligible informational pages will improve valid-run AI citation rate and non-brand search visibility beyond baseline variance without reducing factual accuracy, consultation conversions, indexation, accessibility, or page experience.
- **Primary KPI:** Drive Right citation rate across valid prompt runs.
- **Secondary KPIs:** cited URL distribution, citation order, correct brand treatment, claim accuracy, non-brand impressions and clicks, consultation starts, and completed bookings.
- **Threshold:** Set only after the 28-day pre-period. A positive decision requires an effect larger than observed baseline variance and no material guardrail regression; no outcome percentage is forecast in advance.
- **Owner:** Pending assignment.
- **Start date:** Pending cohort and analytics readiness.
- **Decision date:** 42 days after the treatment pages are indexed, subject to data sufficiency.

## Eligibility gate

Do not include a page unless its lifecycle is active, its claims and sources are approved, and its technical tracking is stable. The four contained legal/rules articles are excluded until qualified review and reindexing are complete. Pages with unresolved price, guarantee, testimonial, financial-outcome, or address claims are also excluded.

## Cohorts

- **Treatment:** Six informational URLs representing at least three query families. Match on the prior 28 days of non-brand impressions, current citation visibility, page type, topic risk, age, and conversion role.
- **Control:** Six comparable informational URLs with no answer-template or material source-layout change during the test.
- **Exclusions:** Home, schedule, checkout, confirmation, policy, contained pages, pages undergoing redirects/consolidation, and service-area pages in the local rebuild wave.
- **Pre-period:** 28 complete days before launch.
- **Post-period:** 42 complete days after stable indexation, with a predeclared extension only for insufficient valid runs.

Record the final URL assignments and matching variables here before launch. Do not reassign a weak performer after results appear.

## Treatment

Apply the same evidence template to every treatment page:

1. Direct two-to-four sentence answer under the main heading.
2. Visible reviewed/updated date and accountable author; qualified reviewer where the topic requires one.
3. Source-linked factual sections with scope, assumptions, and as-of dates adjacent to consequential claims.
4. A compact comparison, checklist, or decision table when it improves extraction and reader utility.
5. One clear next step and contextual internal links to the relevant hub and service path.
6. Article and breadcrumb structured data that mirrors visible facts and introduces no additional claim.

Controls receive only urgent correctness or security fixes. Log every concurrent change.

## Prompt panel and run design

`data/ai-prompt-panel.csv` contains 27 seed prompts: nine query families with three natural variants each. The `agent_service_discovery` family is a separate commercial launch baseline and should be reported separately from the informational treatment/control cohort until its page and claims are approved.

For each measurement wave, instantiate every seed as follows:

- Platforms: ChatGPT, Google AI Overviews or AI Mode, Perplexity, Gemini, and Microsoft Copilot.
- Repetitions: two independent runs per prompt/platform/wave.
- Waves: two baseline waves at least 14 days apart before treatment; then one post-launch wave after stable indexing and monthly monitoring waves.
- Conditions: record platform, model or surface, account state, location setting, device condition, exact run time, and any personalization. Do not mix logged-in and logged-out runs without labeling them.
- Archive: preserve the response or screenshot where permitted and record the archive path.

The full baseline is `27 prompts × 5 platforms × 2 repetitions × 2 waves = 540 planned runs`. Invalid, blocked, truncated, or materially personalized runs remain in the file but have `valid_run=false` with the reason in notes.

## Scoring rules

Score each valid response consistently:

- `our_domain_cited`: true only when the response visibly attributes information to a Drive Right domain URL.
- `our_url_cited`: exact cited landing URL, not the response's inferred destination.
- `citation_order`: one-based order among visible source citations; blank if uncited.
- `brand_treatment`: `recommended`, `mentioned`, `neutral_source`, `negative`, `mischaracterized`, or `absent`.
- `claim_accuracy`: `accurate`, `partially_accurate`, `inaccurate`, or `not_applicable`, checked against approved governed records.
- `click_opportunity`: `direct_link`, `source_panel`, `search_required`, or `none`.

Primary citation rate is cited valid runs divided by all valid runs. Report overall, by platform, query family, branded/non-branded construction, and treatment/control URL group. Do not treat platform-generated summaries as referrals unless analytics records an actual visit.

## Measurement

- **Search source:** Google Search Console exports segmented by page, query, country, device, and date.
- **Conversion source:** privacy-compliant analytics for consultation starts, checkout starts, and completed bookings. Reconcile event names and test them before launch.
- **AI source:** completed prompt panel with response archives and scoring audit.
- **Method:** Compare pre/post changes for treatment versus matched control. Report absolute levels, relative changes, sample sizes, missingness, and baseline variance. Keep brand and non-brand search results separate.
- **Validation:** A second reviewer rescoring at least 10% of valid AI runs must resolve disagreements before the decision.

## Guardrails

- No publication of a pending or expired claim.
- No decline in sampled factual accuracy.
- No accidental indexation of contained or confirmation pages.
- No material decline in consultation or booking conversion rate outside expected baseline variance.
- No material regression in Core Web Vitals, accessibility checks, rendering, or structured-data validity.
- No collection of sensitive prompt/account data beyond the approved measurement need.

## Confounder log

Record dated external and internal changes during the pre/post window:

- Search or AI-platform surface/model changes.
- Major algorithm or indexation events.
- Price, service, checkout, claim, schema, navigation, or internal-link changes.
- Redirects, consolidations, outages, crawl failures, analytics changes, or consent changes.
- Competitor launches, major promotions, seasonality, or news events that affect car demand.

## Stop and rollback rules

Stop new treatment rollout and restore the prior template or contain the affected page if any of the following occurs:

- A reviewer finds a material factual, legal, financial, safety, privacy, testimonial, price, or schema-visible parity error.
- A pending claim is exposed as approved or an expired source is still being used.
- Treatment causes a technical indexing failure or material accessibility/rendering regression.
- Analytics or prompt-run conditions are too inconsistent to support the declared comparison.

Pause the decision, rather than declaring failure, when a platform-wide change or site outage invalidates the comparison window. Document the reason and predeclare the replacement window.

## Result

- **Status:** Not started.
- **Outcome:** Pending.
- **Decision:** Pending baseline, cohort declaration, treatment deployment, and 42-day observation window.
- **Evidence:** Add links to the frozen prompt panel, Search Console exports, analytics export, URL assignment sheet, change log, and scoring audit.
- **Follow-up:** If positive, roll out in a second matched batch. If mixed, retain only components supported by segment-level evidence. If negative or unsafe, roll back and record the learning without deleting the run history.
