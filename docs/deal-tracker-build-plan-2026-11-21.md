# Deal Tracker build plan — November 21, 2026

Status: launched in Production on November 25, 2026 (`DEAL_TRACKER_ENABLED=1`; launch record under "Deal Tracker" in [implementation-operations.md](implementation-operations.md)). Mason settled the decisions below on November 21, 2026, and changed two of them on November 25, 2026 ([adr/0003](adr/0003-dealers-shown-from-quotes-in-and-buyers-text-mason.md)): each car shows the listing's photos and details, its dealer and listing link show from Quotes in, and buyers text Mason instead of asking on the page. Buyer Questions, the reply address and the mail job were removed before launch. Where this plan still describes them below, 0003 wins.

The Deal Tracker is a private page where a buyer follows their deal and talks with Mason, instead of over email. Terms are in [GLOSSARY.md](../GLOSSARY.md). The decisions that are hard to undo are recorded in [adr/0001](adr/0001-deal-tracker-private-link-and-buyer-documents.md) (private link, write-only documents), [adr/0002](adr/0002-buyer-records-outside-the-deal-log.md) (what agents can and can't write) and [adr/0003](adr/0003-dealers-shown-from-quotes-in-and-buyers-text-mason.md) (dealers from Quotes in, texting). This file holds everything else, and the order to build it in.

## Decisions

| Area | Decision |
| --- | --- |
| Who gets one | Full service and concierge buyers whose paid intake comes after launch. No backfill. |
| Stages | A deal opens at paid intake in a new first stage, Confirming search, which ends when the shortlist arrives. Mason's confirmation is the first Buyer Update. |
| Closed | Means the deal is over: picked up, walked away or refunded. Signing and pickup happen during Price agreed. |
| Link | No account. Works until 3 days after the latest close, comes back on reopen, and Mason can revoke or reissue it. No public "send me my link" page. |
| Cars | Shown from Shortlisted with the listing's photos and details, year, model, trim, color, mileage, asking price and our estimated total. The estimate gives way to the best price so far once a dealer quotes in writing. |
| Hidden | Dealer names, listing links and VINs until Quotes in; from then each car names its dealer and links its listing (adr/0003). Target and walk-away prices never show. All cars stay visible after a price is agreed. |
| Buyer Updates | The only words from us on the page. Mason posts one, tells an agent to post it, or approves an agent's draft. The buyer's email leaves on the next 10-minute run, and Mason can take an update back. |
| Buyer emails | Only a Buyer Update emails the buyer. Stage changes and new prices are silent. |
| Buyer questions | By text to Mason, at the number in `DEAL_TRACKER_TEXT_NUMBER` (adr/0003). No question box. Unset, the page says to email him. |
| Reply address | Dropped before launch (adr/0003). Emails keep the ordinary Reply-To. |
| Buyer Pick | Opens only after a "ready for your call" update. One car at its best price so far, or "none of these, keep looking". If the price later moves, the pick stays and is flagged. Mason can clear it. A Pro buyer still gets one pick. |
| Buyer Documents | Types: loan pre-approval, trade-in photos, trade-in title or registration, payoff letter, insurance, ID (from Price agreed only), other. Images and PDFs, 20 MB a file. The buyer sees a receipt, never the file. |
| Storage | A private Vercel Blob store. Files are deleted 30 days after close. |
| Alerts | Each Buyer Pick, "keep looking" and waiting draft emails Mason. |
| Lifecycle emails | Welcome keeps the "what you asked for" recap and the plan, plus the link. What-to-expect becomes a short nudge with the buyer's to-do list. Deal-done and the review ask stay full emails. |
| After a no-purchase close | The page shows a short "this search is closed" note and how to reach Mason. |
| Launch | Everything ships together, behind one switch, after a run on a test deal. |

## What the buyer sees, by stage

| Stage | On the page |
| --- | --- |
| Confirming search | The search details they gave, how the search works, what helps from their side, what to hold off on. |
| Shortlisted, Emailing dealers | The cars, each with its photos and details, asking price and estimated total, marked "waiting on a written price". No dealer yet. |
| Quotes in | Each car's best price so far, its dealer and a link to its listing, and a request not to contact the dealers. After a "ready for your call" update: a pick button per priced car and "none of these, keep looking". |
| Price agreed | The agreed car, its dealer and listing link, the before-you-sign and pickup checklists, and the ID upload. Other cars stay listed with their dealers. |
| Closed (bought) | Congratulations and the after-you-drive-off checklist, until the link expires. |
| Closed (other) | The short closed note. |

Every stage also shows the Buyer Updates, the number to text Mason at and the document upload with its receipts.

## Data: `db/013_deal_tracker.sql`

Apply to Neon before the code deploys. New tables pick up `SELECT` for `paperclip_agent` through the default privileges in `db/010`; the only new write grant is `INSERT` on `buyer_updates`.

- **`deals`**: no new columns. A row is now inserted in the `POST /api/onboarding` transaction for the two paid plans. `saveShortlist` already tolerates an existing row.
- **`deal_listings`**: add `est_otd_cents integer`, `color varchar(60)`, `photo_urls jsonb` (up to 20 https URLs) and `details jsonb` (the named fields in `api/_lib/listing-media.js` plus `features`).
- **`deal_tracker_links`**: `onboarding_id` (primary key), `version`, `revoked_at`, `first_opened_at`, `last_opened_at`. It holds no secret: the link's signature is an HMAC of the intake ID and `version` under `DEAL_TRACKER_SECRET`, so agents reading the table can't rebuild a link. Reissuing adds one to `version`.
- **`buyer_updates`**: `id`, `onboarding_id`, `body`, `status` (`draft`, `posted`, `retracted`), `ready_for_pick`, `actor`, `on_masons_say`, `created_at`, `posted_at`, `email_after`, `emailed_at`, `retracted_at`. Agents insert rows; only the website changes one. A check constraint allows an agent's row to be `posted` only with `on_masons_say` set, so the claim is at least on record.
- **`buyer_picks`**: `id`, `onboarding_id`, `kind` (`pick`, `keep_looking`), `opened_by_update_id`, `vin`, `dealer_name`, `otd_cents`, `created_at`, `cleared_at`. One uncleared row per opening update.
- **`buyer_documents`**: `id`, `onboarding_id`, `doc_type`, `blob_path`, `content_type`, `bytes`, `created_at`, `deleted_at`.
- **`ops_alert_outbox`**: widen the `kind` check with `buyer_pick` and `update_draft`.

## Code

The site has nine functions today and `api/_tests/function-bundle.test.mjs` watches the bundle, so the buyer side is one new function, not several.

| File | Change |
| --- | --- |
| `api/deal-tracker.js` (new) | `GET` renders the page, and with `photo=<rank>.<n>` passes through one listing photo. `POST` takes `pick`, `keep_looking`, `upload_start`, `upload_done`. Checks the link's signature, version, revocation and expiry on every request. |
| `api/_lib/deal-tracker.js` (new) | Link signing and checking, the buyer's view of a deal, and the page HTML. |
| `api/_lib/deal-view.js` (new) | Best price so far per car, worked out from `deal_events`. Shared with the ops dashboard so both agree. |
| `api/_lib/listing-media.js` (new) | The photo URL rule and the listing detail fields, shared by car search and the page. |
| `api/_lib/buyer-documents.js` (new) | Upload URLs, receipts, download for Mason and agents, and the cleanup. Adds `@vercel/blob` (2.3 or later, for private stores). |
| `api/_lib/buyer-update-email.js` (new) | The email about a Buyer Update: short preview and the link. |
| `api/onboarding.js` | Open the deal and the link row in the intake transaction. |
| `api/_lib/ops-dashboard.js`, `api/ops.js` | `confirming` stage; a Deal Tracker panel per deal (below). |
| `api/_lib/ops-alerts.js` | The two new alert kinds. |
| `api/outbox-dispatch.js` | Two new jobs: `buyer_updates`, `document_cleanup`. |
| `.github/workflows/ops-alerts.yml` | Call `?jobs=ops_alerts,buyer_updates`. Cleanup runs in the daily Vercel cron. |
| `api/_lib/car-search.js`, `scripts/car-search.mjs`, the `car-search` skill | Accept and require `est_otd_cents` and `color` per car; accept optional `photos` and `details`. |
| `api/car-search.js` | A `document` action so agents can fetch a Buyer Document with the existing bearer token. |
| `scripts/deal-desk-db.mjs` | `update` (draft or post), `picks`, `documents`; `log` now requires a VIN on `quote` and `agreed`. |
| `api/_lib/customer-emails/*` | Shorter welcome and what-to-expect; every template carries the link. |
| `vercel.json` | Rewrite `/deal/:token` and `/deal/:token/photo/:rank/:n` to the function; `noindex`, `no-store` and `Referrer-Policy: no-referrer` on it. |

### The page

- Server-rendered by the function, in the current `buying/*.css` style. Read `.ai_rules` first.
- Loads no GTM, analytics or third-party script, like the quote worksheet.
- `GET` changes nothing except the opened times, because mail scanners follow links. Picks and "keep looking" are `POST`s behind a confirm step.
- Buyer-written text is escaped everywhere it is shown, on the page and on the ops dashboard.
- Uploads are rate-limited per link by counting recent rows.
- Listing photos are fetched by the server and served from the buyer's link, so a photo host never shows on the page.
- An expired or revoked link shows a plain page with how to reach Mason, not a 404.
- Copy must follow the public-copy rules in `AGENTS.md` and gets Mason's OK from a local preview before launch.

### Best price so far

`summarizeDeal` tracks one price per dealer and keeps the latest. The buyer's view needs a price per car:

1. Take `quote` and `agreed` events with an out-the-door price and a VIN on the shortlist.
2. Keep each dealer's latest one per VIN, and drop dealers whose latest event is `dropped`.
3. The lowest that remains is the car's best price so far.

A quote on a car that isn't on the shortlist doesn't show until the car is added. `counter` events are ours and never show.

### Buyer Updates from a chat

`node scripts/deal-desk-db.mjs update <intake ID> --post` inserts a posted update with `on_masons_say`; without `--post` it inserts a draft. The rule that agents post only on Mason's word goes into the `car-search`, `car-negotiation` and `dealer-reply` skills. A posted update sets `email_after` to five minutes on, so the email leaves on the next 10-minute run unless Mason takes it back first. The ops dashboard warns when a draft or update contains a shortlisted dealer's name before Quotes in.

### Reading the reply addresses

Dropped before launch (adr/0003). Buyers text Mason, and nothing reads his mail.

### Documents

- `upload_start` returns a presigned upload URL capped at 20 MB and the allowed types; the browser sends the file straight to the store, since a Vercel function body tops out at 4.5 MB. `upload_done` records the row after checking the file exists.
- Mason downloads from the ops dashboard. Agents fetch through `api/car-search.js` with the car-search token. Nothing on the buyer's page links to a file.
- The cleanup job deletes files 30 days after the latest close, and skips reopened deals.

### Ops dashboard panel

Per deal: the link with copy, revoke and reissue; first and last opened; a box to post a Buyer Update with a "ready for your call" tick; drafts with approve and discard; posted updates with take back; the pick with clear; documents with download. The deals list marks deals with an open pick.

## Setup only Mason can do

1. Create a private Blob store in the Vercel project.
2. Add to Vercel Production: `DEAL_TRACKER_SECRET`, `DEAL_TRACKER_TEXT_NUMBER` (once the number is chosen), the Blob store's token, and `DEAL_TRACKER_ENABLED` last.
3. Apply `db/013_deal_tracker.sql` to Neon (`barton-checkout-db`).
4. Read and approve the page copy (`npm run deal-tracker:preview`) and the shortened emails (`npm run customer-emails:preview`).

## Build order

It launches as one piece, but it is built and tested in this order so each layer can be checked before the next sits on it:

1. Migration, the deal opening at intake, the `confirming` stage on the ops dashboard.
2. Link signing, the read-only page for every stage, the per-car price view, the estimate in car search.
3. Buyer Updates: ops panel, agent script, the update email, take back.
4. Buyer Questions from the page, the timeline, alerts: built, then dropped (adr/0003).
5. Buyer Pick and "keep looking".
6. Documents from the page, download, cleanup.
7. The reply address: built, then dropped (adr/0003). Listing photos and details, and dealers from Quotes in, took its place.
8. Shortened lifecycle emails with the link.
9. Test deal end to end with the switch on in a preview, then production, including the listing photos.

## Tests

In `api/_tests/`, on the in-memory Postgres the other suites use:

- Link: a forged, old-version, revoked or expired link is refused; reopening restores it.
- Buyer's view: no dealer name, listing link or VIN appears in the HTML or any response before Quotes in; from Quotes in each car names its dealer; target and walk-away prices never appear.
- Best price so far: latest per dealer, lowest per car, dropped dealers and raised prices handled.
- Pick: refused before a "ready for your call" update; one per opening; flagged when the price moves; cleared when the dealer is dropped.
- Updates: a draft never shows; a retracted update disappears and its email is never sent; an agent row can't be `posted` without `on_masons_say`.
- Photos: served only for a live link and a car on the deal, only image types under 4 MB, no redirects followed.
- Documents: type and size limits, ID refused on the page before Price agreed, no download path from the buyer's link, cleanup at 30 days.
- `function-bundle` and `outbox-cron` suites updated for the new function and jobs.

## Open items

- The number buyers text. Mason is weighing a dedicated business number, for example Quo (formerly OpenPhone), which has an API and webhooks but needs US carrier A2P 10DLC registration before it can text buyers. Not decided; until then `DEAL_TRACKER_TEXT_NUMBER` is just shown on the page.
- Whether Mason's own Claude chats outside this repository have `DEAL_DESK_DATABASE_URL`, which the `update` command needs.
- `AGENTS.md` and `docs/implementation-operations.md` carry the Deal Tracker entries; keep them in step with adr/0003.
