# SEO-07 — organic conversion measurement

Prepared September 18, 2026. Starting revision: `3bf03f6288a16b578e49cb1375254c7285a70855`. Local implementation: `verified_local`; destination setup and real reconciliation: `waiting_for_access`. Account observations are in [SEO-02](SEO-02.md); final source/checks are in [release-candidate.md](release-candidate.md).

## Implemented and tested

- First touch is retained; internal navigation/direct reloads preserve the latest acquisition. New campaigns/external referrals update last touch. Stripe payment returns cannot replace acquisition with a payment-provider referral.
- Browser and server restrict URL attribution to safe origins/pathnames and bounded campaign fields. Outbound copies of historical queued analytics are sanitized without mutating ledger/history. Contact information and buying-brief content are excluded from the analytics contract.
- `generate_lead` and `begin_checkout` use durable `lead:<id>` and `checkout:<attempt_id>` identities after successful API receipt. Session/memory guards suppress client replay; absent durable IDs do not emit business conversions. CTA/phone clicks remain separate intent signals.
- Signed server payment validation remains authoritative. `purchase` uses `purchase:<checkout_session_id>` plus `transaction_id`; receipt rendering emits no purchase. Historical amounts/tiers, delayed paid events, replay and session deduplication are covered.
- Outbox delivery acknowledgements are fenced by attempt number so a stale worker cannot acknowledge a newer claim. `npm run analytics:dispatch` sends one due batch and reports aggregate counts/exhaustion; missing configuration and failures return nonzero. No scheduler or public worker endpoint was activated.

Changes are in `script.js`, validation/analytics/outbox modules, lead/checkout/onboarding handlers, the bounded worker and targeted tests. Tests cover actual legacy hash normalization, stale offers, Google/referral/campaign/internal/Stripe attribution, storage denial, collector failure/retry/exhaustion, lease fencing, historic payload privacy, delayed/replayed events and confirmation refresh. Local fixtures and a synthetic browser fetch stub do not establish live ingestion.

## Business metrics

| Contract / record | Meaning | Cannot establish alone |
| --- | --- | --- |
| `cta_click`, `phone_click` | Intent/action | Contactability, qualification, payment |
| Durable lead + `generate_lead` | Saved inquiry, deduplicated by durable ID | Qualified inquiry without actual review |
| `begin_checkout` | Persisted attempt and returned checkout URL | Paid order |
| Verified `purchases` + server `purchase` | Signed paid session matching recorded offer; one per session | Fulfillment, customer satisfaction or net revenue after refunds |
| Server `onboarding_complete` | Intake saved for a verified purchase | Service completion |

Qualified inquiry means a deduplicated, contactable prospective buyer with an in-scope vehicle request and buying intent, classified from actual business records. Unknown qualification remains unknown. Attribute organic acquisition from consented/referrer/campaign evidence; missing UTMs or direct traffic are not automatically organic. Report first-touch and last-touch conventions explicitly. Compare the same completed dates/timezone and keep GSC clicks separate from GA4 sessions and ledger orders.

## Concrete external configuration draft

Verified GTM account `6349220223`, container `249056149` / `GTM-W577B3D4`, live Version 6. Existing tags use Google Ads `AW-18071301983`, Clarity and legacy CTA/all-form triggers; there is no observed GA4 tag or current durable-event mapping. Workspace changes were zero; no edits or publication occurred.

1. Identify the actual Drive Right numeric GA4 property, web stream/measurement ID, timezone and read access. Do not substitute the observed Ads ID or another business's property.
2. In a separately authorized review workspace, map exact custom events `cta_click`, `phone_click`, `generate_lead`, `begin_checkout` and approved business fields. Only durable `generate_lead` should represent a saved lead. Retire duplicate legacy all-form/price-text conversions after inspecting downstream dependencies; preserve phone intent separately. Do not install overlapping tags blindly.
3. Confirm the approved consent model and existing ad-privacy integration. Review GA4 cross-domain/unwanted payment referrals, event destinations and URL/PII controls. This candidate preserves the existing consent mechanisms; it does not claim the live container is configured correctly.
4. Configure a real approved HTTPS collector and credentials via `ANALYTICS_FORWARD_URL` / `ANALYTICS_FORWARD_BEARER_TOKEN`. It must durably ingest before 2xx, honor stable `Idempotency-Key`, enforce privacy/consent and map purchase/receipt currency/value correctly. Deduplicate at the collector; do not assume an arbitrary GA4 `event_id` deduplicates all event types. Preserve purchase `transaction_id`.
5. Wire the bounded worker to an authorized scheduler with restricted database/collector credentials, retry-aware frequency and alerts on failed/exhausted rows. Review capacity against batch size/backoff. No automation was created here. Optional lead-forward recovery remains a separately documented operational dependency.
6. Use sandbox events to verify browser/debug views and collector acknowledgements, then compare paid Stripe sessions, purchase ledger, outbox status and destination acknowledgements for one consistent completed window. Record attempted/sent/failed/exhausted separately. Keep aggregate evidence only in Git.

GA4 identity, approved collector/consent mapping, preview database, actual scheduling and business-record qualification are missing. No successful live delivery or organic lead-to-payment conversion rate is claimed. Next action: provide the confirmed property/stream and scoped integration access; execute this configuration/reconciliation packet in the authorized test scope before production activation.
