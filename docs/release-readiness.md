# Drive Right Release Readiness

Status date: August 20, 2026

## Local release-candidate status

The repository-side containment, canonical model, content architecture, media migration, form/payment contracts, governance data, and automated checks are implemented. The local candidate is not a production deployment and does not by itself establish analytics reconciliation, live redirects, database durability, or crawler access.

Local acceptance commands:

```sh
node scripts/validate-site.mjs
npm run check:api
npm test
git diff --check
```

After deployment, run the one-hop host/path matrix:

```sh
BASE_URL=https://www.driverightcarbuying.com \
LEGACY_BASE_URL=https://www.austincarbuyingservice.com \
node scripts/check-redirects.mjs
```

## Gate 1: infrastructure and payment setup

- Apply the numbered `db/*.sql` migrations in order to the production PostgreSQL database.
- Set the production variables listed in `.env.example`; keep optional Turnstile enforcement disabled until the visible client widget is installed and tested.
- Configure each Stripe Payment Link to return to its matching confirmation page with the literal `{CHECKOUT_SESSION_ID}` parameter.
- Register the signature-verified Stripe webhook and complete duplicate-delivery, amount/currency, refresh, direct-visit, bot, and delayed-webhook tests.
- Confirm `/api/leads`, `/api/checkout-start`, `/api/purchase-status`, `/api/onboarding`, and `/api/stripe-webhook` run in the production Vercel environment.
- Preserve database and Stripe identifiers during rollback; do not delete ledgers or idempotency records.

## Gate 2: governed analytics

- Remove the live GTM container's stale all-form and price/click-text conversion triggers before release.
- Configure only the approved client events: `cta_click`, `phone_click`, `generate_lead`, and `begin_checkout`.
- Configure the consent-approved HTTPS collector for the implemented outbox dispatcher. Standard `purchase` and `onboarding_complete` events must originate from verified server records, not success-page loads; the collector must honor the durable event ID and idempotency header.
- Add a scheduled invocation path for unattended retries and alert when outbox rows reach the configured attempt cap; request-triggered dispatch alone cannot guarantee recovery during quiet periods.
- Reconcile Stripe purchases, the purchase ledger, outbox deliveries, and analytics daily until the verified consultation count is within 5%.
- Do not describe the measurement goal as complete while the dispatcher or destination credentials are absent.

## Gate 3: deployment and canonical verification

- Deploy to a preview, run the full form/payment/browser matrix, then promote the same artifact to production.
- Live check on August 20, 2026: the apex-to-`www` hop preserves the path and query string but still returns temporary `307`; the other ten host/path cases pass. Correct the upstream Vercel/domain redirect and rerun the matrix before promotion.
- Verify Cloudflare and Vercel produce one permanent hop for HTTP, apex/www, `/index.html`, malformed `.html/`, the legacy domain, and `inquiry.html`; preserve query strings.
- Confirm the legacy domain no longer serves a competing 200 response.
- Inspect sanitized edge/function logs and validate crawler IPs using the applicable official method before concluding that named crawlers have access.
- Submit only the production `sitemap.xml` after the redirect and canonical checks pass.

## Gate 4: search, analytics, and AI baselines

- Verify both domains as Google Search Console and Bing Webmaster Tools domain properties; connect GSC to GA4 and enable Bing AI Performance where the account exposes it.
- Export 16 months of query/page/device/country data before consolidating redirects. Record the initial 28-day baseline by topic cluster, metro, branded/non-branded query, landing page, and verified consultation.
- Run the 24-prompt panel in `data/ai-prompt-panel.csv` twice, 14 days apart, with two repetitions per platform/prompt condition. Treat citations as observations, never rankings.
- Start the 42-day matched-page retrieval experiment only after the 28-day baseline and factual/indexation/accessibility/privacy guardrails are recorded.

## Gate 5: editorial and local evidence

- Keep every legacy blog article and the five consequential draft hubs noindexed until claim-level primary-source mapping and an accountable qualified review are complete.
- Replace “Draft updated” with a truthful visible reviewer identity/date and matching `dateModified` only after approval; reindex only the approved page.
- Obtain owner/legal approval for guarantees, refund boundaries, operational start times, independence/referral disclosures, and any first-party outcome claim before reuse.
- Publish the requested case studies, Texas title-transfer checklist, and deal-sheet worksheet only with customer consent, reproducible evidence, and the required reviewer. No placeholder case study or synthetic testimonial is an acceptable substitute.
- Keep all nine metro pages noindexed until each has unique verified logistics, dated regional evidence, a real example where available, and either attributable consultation activity or genuine non-brand demand. Merge/redirect failures at the day-90 gate.
- Complete Google Business Profile, Bing Places, Apple Business Connect, review-request, and outreach work in the owned accounts; keep name, phone, URL, hours, and service area synchronized.

## Gate 6: rendered quality and performance

- Repeat desktop/mobile keyboard navigation, JavaScript-disabled visibility, form error/success, payment gating, internal-link, structured-data, and accessibility checks on the deployed artifact.
- The required five-run mobile performance trace is still external to this repository. Add a Chrome DevTools MCP server to the Codex config if it is not available:

```json
{
  "chrome-devtools": {
    "type": "local",
    "command": ["npx", "-y", "chrome-devtools-mcp@latest"]
  }
}
```

- Record the median of five mobile Lighthouse runs. Release requires LCP at or below 2.5 seconds and no accessibility regression.

## Rollback boundary

Roll back the promoted application artifact if forms, payment verification, factual accuracy, privacy, accessibility, indexation, or consultation tracking regresses. Keep correct permanent canonical/legacy redirects unless the redirect matrix itself fails. Keep consequential content contained until its exact release gate is satisfied.
