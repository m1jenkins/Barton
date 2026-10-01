# Drive Right Release Readiness

Content approval updated: October 1, 2026; infrastructure notes retain their recorded dates.

Current local candidate: [SEO release-candidate record](seo-execution/release-candidate.md). The historical sections below are context; current measured evidence and exact unresolved dependencies are in that record. No activation has occurred.

## Local release-candidate status

The repository-side containment, canonical model, content architecture, media migration, form/payment contracts, governance data, and automated checks are implemented. The local candidate is not a production deployment and does not by itself establish analytics reconciliation, live redirects, database durability, or crawler access.

Run the local acceptance commands defined in [the checks workflow](../.github/workflows/checks.yml), using the Node version it specifies. [The package scripts](../package.json) define the individual checks.

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
- Reconcile Stripe purchases, the purchase ledger, outbox deliveries, and analytics daily until the verified purchase count is within 5%.
- Do not describe the measurement goal as complete while the dispatcher or destination credentials are absent.

## Gate 3: deployment and canonical verification

- Deploy to a preview, run the full form/payment/browser matrix, then promote the same artifact to production.
- Live check on September 22, 2026: the Vercel domain setting for `driverightcarbuying.com` now redirects to `www` with a permanent `301`, and `/about.html` keeps its path (it was a temporary `307` on August 20). `http://driverightcarbuying.com` still takes two permanent hops (Cloudflare to HTTPS, then Vercel to `www`). Query-string preservation and the legacy apex were not rechecked; rerun the full matrix from an unrestricted network.
- Verify Cloudflare and Vercel produce one permanent hop for HTTP, apex/www, `/index.html`, malformed `.html/`, the legacy domain, and `inquiry.html`; preserve query strings.
- Confirm the legacy domain no longer serves a competing 200 response.
- Inspect sanitized edge/function logs and validate crawler IPs using the applicable official method before concluding that named crawlers have access.
- Submit only the production `sitemap.xml` after the redirect and canonical checks pass.

## Gate 4: search, analytics, and AI baselines

- Verify both domains as Google Search Console and Bing Webmaster Tools domain properties; connect GSC to GA4 and enable Bing AI Performance where the account exposes it.
- Export 16 months of query/page/device/country data before consolidating redirects. Record the initial 28-day baseline by topic cluster, metro, branded/non-branded query, landing page, and verified purchase.
- Run the 24-prompt panel in `data/ai-prompt-panel.csv` twice, 14 days apart, with two repetitions per platform/prompt condition. Treat citations as observations, never rankings.
- Start the 42-day matched-page retrieval experiment only after the 28-day baseline and factual/indexation/accessibility/privacy guardrails are recorded.

## Current website content and local pages

All current website content is approved by the owner. See [the October 1 approval](content-approval-2026-10-01.md). Existing city pages, resource hubs, articles, and service copy do not require further content verification or approval and must not carry pre-publication warnings.

Retain the current indexing and redirect decisions when editing these pages. Separate artifacts in `draft-artifacts/` remain local previews. Update pinned city hashes after authorized edits, and run the technical checks.

Keep Google Business Profile, Bing Places, Apple Business Connect, and website contact details synchronized when making authorized account changes.

## Gate 6: rendered quality and performance

- Repeat desktop/mobile keyboard navigation, JavaScript-disabled visibility, form error/success, payment gating, internal-link, structured-data, and accessibility checks on the deployed artifact.
- Current browser/field measurement evidence is tracked in [SEO-03](seo-execution/SEO-03.md). Chrome DevTools CLI is available. The original optional MCP configuration reference is:

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

Roll back the promoted application artifact if forms, payment verification, factual accuracy, privacy, accessibility, indexation, or consultation tracking regresses. Keep correct permanent canonical/legacy redirects unless the redirect matrix itself fails. Preserve the recorded indexing decisions during rollback.

## September 5, 2026 SEO preparation

See [the page-specific preparation record](seo-release-preparation-2026-09-05.md) for the original revisions and sources. The current website copy, including the three priority articles and Austin, is covered by the October 1 owner approval.
