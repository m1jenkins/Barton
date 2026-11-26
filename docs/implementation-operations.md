# Durable lead and payment operations

This implementation makes PostgreSQL the source of truth for lead receipt, checkout attempts, verified purchases, and onboarding. Browser redirects and confirmation-page loads alone are not purchase evidence and must not emit purchase conversions. The browser may emit `purchase_verified` only after `/api/purchase-status` returns `verified: true`, keyed by the server purchase ID, for ad-platform conversion measurement (Google Ads via GTM).

## API contract

All state-changing browser calls require an exact allowed `Origin`, JSON, and an `Idempotency-Key` header (8–128 characters using letters, digits, `.`, `_`, `:`, or `-`). Responses are `Cache-Control: no-store` and never return customer fields.

### `POST /api/leads`

Request:

```json
{
  "name": "Ada Buyer",
  "email": "ada@example.com",
  "phone": "512-555-0100",
  "message": "I am comparing compact SUVs.",
  "vehicle": "Mazda CX-5",
  "source_page": "/austin.html",
  "honeypot": "",
  "turnstile_token": "optional-when-not-configured",
  "attribution": {
    "first_touch": { "landing_path": "/austin.html", "utm_source": "google" },
    "last_touch": { "landing_path": "/austin.html", "utm_source": "google" }
  }
}
```

The endpoint validates and commits the lead before returning `{ "ok": true, "lead_id": "…", "forwarding_configured": false }` (the last field reflects whether a notification destination is configured). Reusing an idempotency key with identical normalized data returns the original ID; reusing it with different data returns `409`. The pricing dialog uses source `pricing_inquiry`, requires a vehicle and email, and permits an empty name. Existing lead sources still require a name. The dialog's optional questions box (up to 2,000 characters) is appended to `message`, so questions are no longer squeezed into the 300-character `vehicle` field. After any lead is saved — the pricing dialog (`buying/inquiry.js`) or the legacy `#contact-form` (`script.js`) — the browser posts it to Web3Forms (`api.web3forms.com/submit`) through the shared `emailMason` helper in `script.js` (public access key there, exposed as `window.driveRightClient.emailMason`), which emails Mason with the visitor's address as reply-to. Filled honeypots are not emailed, and the database row stays the source of truth. If neither Web3Forms nor `LEAD_FORWARD_URL` delivers it, the dialog offers an explicit email handoff and the contact form shows direct contact options.

If `LEAD_FORWARD_URL` is configured, the endpoint creates an outbox row in the same database transaction and only calls the downstream HTTPS service after that transaction commits. The downstream request carries the durable lead ID as its own `Idempotency-Key`. A forwarding failure never changes a successfully stored lead into a failed lead response. A malformed `LEAD_FORWARD_URL` is a configuration error, so every lead request fails until it is fixed.

Grokbot doesn't use forwarding (Mason's call, November 3, 2026), so `LEAD_FORWARD_URL` stays unset and the Web3Forms email keeps reaching Mason. Instead, when `LEAD_NOTIFY_EMAIL` is set, the same transaction queues the lead in `lead_email_outbox` (`db/009_lead_email_outbox.sql`, `api/_lib/lead-email.js`). Right after the commit, the site emails a `New lead <id>` notice to that address through the intake email's SMTP settings (`INTAKE_SMTP_*`). The notice carries only the ID, source, page and time. The daily cron retries failures (`workers.lead_email`), and `npm run lead-emails:dispatch` sends one batch by hand. A failed send stores only an error code (`Lead email failed (EAUTH)`) and logs `[lead_email_failed]`. Check it with `SELECT status, count(*) FROM lead_email_outbox GROUP BY status;`. Apply migration 009 before setting the variable: with the variable set and no table, every lead insert fails. Both were done on November 3.

The notice wakes Grokbot's Client Outreach assistant, which reads the lead from Neon, drafts a reply, and after Mason's tap sends it as `mason@steermeright.com` through a Gmail relay that sends via Zoho SMTP. Zoho's forwarding of that mailbox to the relay has been off since November 10, 2026, after Gmail rate-limited it, so Client Outreach doesn't see customer replies. Steps and Grokbot's rules: [client-inquiries-setup-2026-11-03.md](client-inquiries-setup-2026-11-03.md). Its prompts query `leads` (`id`, `created_at`, `name`, `email`, `phone`, `vehicle`, `message`, `source`, `source_page`) and `onboarding_submissions.email`, and match the notice's `New lead <id>` subject, so a change to any of those needs that doc's prompts updated and re-sent.

### `POST /api/checkout-start`

Request:

```json
{
  "tier": "full_service",
  "lead_id": "optional-durable-lead-uuid",
  "source_page": "/schedule.html",
  "attribution": {
    "first_touch": { "landing_path": "/", "utm_source": "google" },
    "last_touch": { "landing_path": "/schedule.html", "utm_source": "google" }
  }
}
```

New-sale tier IDs are `full_service` ($395 USD) and `concierge` ($695 USD); these replaced $295/$895 on 2026-09-27. A $195/$345 change on 2026-10-23 was reverted the same day. `consultation` returns `410 tier_retired` for new checkout but remains valid for paid receipt verification and onboarding. The server selects the corresponding environment-configured Stripe Payment Link, persists an attempt with allowlisted first/last-touch attribution, and returns `{ "ok": true, "url": "…", "attempt_id": "…" }`. It adds a server-generated UUID as Stripe's `client_reference_id`; the browser cannot supply a price or redirect URL.

### `POST /api/stripe-webhook`

The function reads the raw request body and verifies `Stripe-Signature`. Subscribe this endpoint only to:

- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`

An event is purchase evidence only when it contains a one-time Checkout Session whose `payment_status` is `paid`, whose `client_reference_id` maps to a stored attempt, and whose currency and total exactly match that stored attempt's immutable amount/currency, including historical $195/$495 attempts. The transaction inserts the Stripe event, one purchase keyed by Checkout Session ID, updates the attempt, and inserts one standard `purchase` analytics-outbox row keyed by that same session ID. Its payload includes a durable event ID, transaction and purchase IDs, service tier, value, currency, governed page context, and allowlisted first/last-touch attribution. Replayed event IDs and second paid events for the same Checkout Session cannot create another purchase or outbox event.

After the ledger transaction commits, the function opportunistically dispatches an atomically claimed outbox batch when `ANALYTICS_FORWARD_URL` is configured. Each HTTPS request carries the durable event ID in both the body and `Idempotency-Key` header. Acknowledged `2xx` responses mark the row sent; timeouts and non-`2xx` responses return it to `failed` with capped exponential backoff. A delivery failure never rolls back or changes the response for an already verified purchase.

Unmatched sessions and amount mismatches are retained with review outcomes but return `2xx` after the record commits. Monitor those outcomes; they usually indicate an old direct Payment Link, inconsistent live/test configuration, or a Stripe price changed without a matching application release.

### `GET /api/purchase-status?session_id=…&tier=…`

The endpoint retrieves the Checkout Session from Stripe and compares it with the database purchase. It returns only verification state, tier, and—when verified—the internal purchase ID with the purchase's `value` (major currency units) and uppercase `currency`:

```json
{
  "ok": true,
  "verified": true,
  "tier": "full_service",
  "purchase_id": "…",
  "value": 395,
  "currency": "USD"
}
```

`value` and `currency` come from the `purchases` ledger row, not the current offer, so a historical $295 Full Service purchase still reports `295` after the $395 price change. If Stripe reports paid before its webhook has committed, the status is `processing`; the client can retry with bounded backoff. Unverified responses (`processing`, `unverified`, `not_found`) and errors are unchanged and carry no amount. No name, email, phone, Stripe customer, or payment-method data is returned.

### `POST /api/onboarding`

Request:

```json
{
  "session_id": "cs_test_…",
  "tier": "full_service",
  "fields": {
    "name": "Ada Buyer",
    "email": "ada@example.com",
    "phone": "512-555-0100",
    "city": "Austin, TX",
    "preferred_makes": "Mazda, Toyota",
    "features": ["awd", "safety-suite"]
  }
}
```

The session must already have a webhook-verified paid purchase and its tier must match. A purchase can have only one immutable onboarding submission. A successful response is `{ "ok": true, "onboarding_id": "…" }`.

The server persists only allowlisted form fields and drops unknown keys. The allowlist covers the current contact, vehicle, budget, trade-in, preference, consultation-question, and concierge-delivery fields, plus the five the chat intake adds (`model_years`, `financing_status`, `trade_vehicle`, `search_radius`, `needs`); tier and session identity always come from the top-level verified contract. The same transaction creates one `onboarding_complete` outbox event keyed by Checkout Session ID, so browser refreshes cannot duplicate it.

## Paid intake email — November 2, 2026

The paid intake used to reach Postgres only, so Mason never saw it unless he queried the database (the first live buyer's intake sat unseen on November 1). `db/004_intake_email_outbox.sql` adds `intake_email_outbox`, one row per `onboarding_submissions` row, and backfills every intake saved before it. `POST /api/onboarding` inserts the row in the same transaction as the intake, then sends it right after commit. The daily `/api/outbox-dispatch` cron retries anything unsent (`workers.intake_email`), and `npm run intake:dispatch` runs one batch by hand.

Delivery is SMTP through the steermeright.com Google Workspace mailbox (moved from Zoho on November 20, 2026, when Mason stopped using Zoho) (`api/_lib/intake-email.js`, nodemailer). Each email goes to `INTAKE_EMAIL_TO` (default `mason@steermeright.com`) from `INTAKE_SMTP_USER`, with the buyer as Reply-To. The subject is `Paid intake: <name> · <car> · <plan>`. The body has Text/Call/Email/Open in Stripe buttons, every answered question, the plan, amount and Central-time paid and intake times, the Stripe payment link, checkout session, attribution and any earlier inquiry. A plain-text part carries the same content.

| Variable | Purpose |
| --- | --- |
| `INTAKE_SMTP_USER` | Google Workspace mailbox that sends, e.g. `mason@steermeright.com`. Required with the password; neither set means intakes stay queued and the cron reports `configured:false`. |
| `INTAKE_SMTP_PASSWORD` | Google app password for that mailbox (Google Account → Security → 2-Step Verification → App passwords; needs 2-Step Verification on). Not the account password. Store as a sensitive production variable. |
| `INTAKE_EMAIL_TO` | Optional recipient, default `mason@steermeright.com`. |
| `INTAKE_SMTP_HOST` / `INTAKE_SMTP_PORT` | Optional, default `smtp.gmail.com` / `465` (SSL). Gmail sends only as the signed-in address or a verified alias, so keep `INTAKE_SMTP_USER` as the From address. |
| `INTAKE_OUTBOX_MAX_ATTEMPTS` / `INTAKE_OUTBOX_RETRY_SECONDS` | Optional, default 8 attempts with exponential backoff from 60 seconds. |

Failures store only the SMTP error code (`Intake email failed (EAUTH)`), never the message or credentials, and log `[intake_email_failed]`. Check delivery with `SELECT status, attempts, last_error, sent_at FROM intake_email_outbox ORDER BY created_at DESC;`. Apply migration 004 before deploying code that writes the table.

## Customer email — November 14, 2026

Until now no email reached a buyer automatically. Mason decided on November 13, 2026 that fixed lifecycle emails go out on their own. Each one is a template personalized with the buyer's own answers. Deal-specific updates (prices, dealers) are still sent by hand.

| Template | Queued | Sent |
| --- | --- | --- |
| `welcome` | By `POST /api/onboarding`, in the intake transaction | Right after commit |
| `what_to_expect` | With `welcome` | 12 hours later, so at the next morning's cron run |
| `deal_done` | By the cron, once the deal's latest `closed`/`reopened` event in `deal_events` is `closed` (within the last 14 days) | At that cron run |
| `review_ask` | With `deal_done`, but only if `GOOGLE_REVIEW_URL` is set | 4 days after the deal closed |

How it works:
- **Queue.** The queue is `customer_email_outbox` (`db/011_customer_email_outbox.sql`). It holds one row per buyer per template, so an email can never go out twice. The worker is `api/_lib/customer-email.js`, and it runs in the daily `/api/outbox-dispatch` cron as `workers.customer_email`. Retries, backoff and the lease work as they do for the intake email.
- **Who gets the deal emails.** Only buyers who have a `welcome` row get `deal_done` or `review_ask`. Buyers from before launch therefore get nothing.
- **Reopened deals.** A reopened deal cancels any deal emails not yet sent. If the deal closes again later, they are not re-queued; send that one by hand.
- **Sender.** Mail goes through the intake email's SMTP settings (Google Workspace) (`INTAKE_SMTP_*`), from "Mason at Steer Me Right" `<INTAKE_SMTP_USER>`, with Reply-To `CUSTOMER_EMAIL_REPLY_TO` (default `mason@steermeright.com`).
- **Plans.** Only the $395 and Pro plans get these emails. The retired consultation plan gets none.
- **Templates.** They live in `api/_lib/customer-emails/` and share the shell in `api/_lib/email-layout.js` (site palette and fonts, table layout, HTML and plain text built from one content list). They read only the whitelisted answers in `buyerFromRow`. Contact details, the delivery address, trade-in plates and free-text notes never appear.

| Variable | Purpose |
| --- | --- |
| `CUSTOMER_EMAIL_ENABLED` | `1` turns the emails on. While unset, nothing is queued or sent, and turning it on later doesn't send old welcomes. |
| `GOOGLE_REVIEW_URL` | The https "write a review" link from the Google Business Profile. Set in production on November 20, 2026 to `https://g.page/r/CRhIsN4U_eXLEBM/review` (Mason). The button shows the Google G from `assets/email/google-g.png`, a PNG because email clients drop SVG. While unset, no review email is queued, and a queued one is cancelled at send time. |
| `CUSTOMER_EMAIL_REPLY_TO` | Optional. Default `mason@steermeright.com`. |

Commands:
- `npm run customer-emails:preview` renders every email for four sample buyers into the git-ignored `.email-previews/`. Open it in the browser pane with the `email-previews` entry in `.claude/launch.json`. Change copy or layout in the template files, re-run the preview, and get Mason's OK before deploying.
- `npm run customer-emails:test -- all` (or one template name) sends sample renders to `INTAKE_EMAIL_TO` only. It needs `INTAKE_SMTP_*` in `.env.local`.
- `npm run customer-emails:dispatch` sends one batch by hand.
- `npm run customer-emails:cancel -- <intake ID>` stops every email not yet sent to that buyer, and also blocks deal emails from being queued for them later.

Check the queue with `SELECT template, status, send_after, sent_at, last_error FROM customer_email_outbox ORDER BY created_at DESC;`. A failure stores only the SMTP error code (`Customer email failed (EAUTH)`) and logs `[customer_email_failed]`.

Apply migration 011 to Neon before deploying the code that writes the table. `POST /api/onboarding` writes it only when `CUSTOMER_EMAIL_ENABLED` is set, but the cron reads it as soon as the flag is on.

## Car search — November 2, 2026

Mason runs each car search himself in Claude Code on his Max plan. On November 11, 2026 he chose to let agents run on that subscription too.

How a search runs:

1. The paid intake email now ends its summary with a ready-to-copy command, `/car-search <intake ID>`.
2. In Claude Code, opened on this repository, Mason runs that command. The skill (`.claude/skills/car-search/SKILL.md`) loads the search details with `node scripts/car-search.mjs get <intake ID>` (`GET /api/car-search`). It then searches the MarketCheck connector, checks each strong candidate's VIN, history and market value, and sets a target price for each car. It also drafts one first email per dealer, using the dealer email MarketCheck lists or one published on the dealer's site.
3. The skill shows Mason the ranked table, then saves `.car-searches/<intake ID>.json` (git-ignored) and runs `node scripts/car-search.mjs submit …` (`POST /api/car-search`). The server checks the shortlist, reports every problem at once if any, and saves `deals`, `deal_listings` and `dealer_email_drafts`. Nothing is emailed: Mason reviews the shortlist in Claude Code. (Until November 3 the submit also emailed him the shortlist through the `deal_jobs` outbox, which is no longer written.) Submitting again replaces the shortlist until the deal is handed off.
4. When Mason says "send them", the skill runs `node scripts/car-search.mjs handoff <intake ID>` (`POST /api/car-search` with `"action": "handoff"`). The server marks the deal's drafts `handed_off`, which locks the shortlist. It returns what Grokbot needs to open the deal: the cars with their asking, market and target prices, the search details and the first emails. Grokbot reads anything else, the buyer's details included, from Neon. The script posts that to Grokbot's "New deal" webhook with `Authorization: Bearer <DEALER_BOT_KEY>`. A 200 only means Grokbot started a run. If the post fails, run `handoff` again, and the server returns the same handoff. A deal whose first email already went out from Zoho can't be handed off.
5. Grokbot shows each first email to Mason as a card in its chat, sends it from the dealer-only Gmail inbox when he taps Send, and negotiates the replies. It logs each first email, quote, counter, agreed price, dropped dealer and closing in `deal_events` (`db/007_deal_events.sql`, keyed per car by `db/008_deal_events_per_car.sql`). Dealer emails sign off "Mason" and never mention Steer Me Right. The plan is [dealer-replies-plan-2026-11-03.md](dealer-replies-plan-2026-11-03.md), and Grokbot's rules and setup are in [dealer-bot-setup-2026-11-03.md](dealer-bot-setup-2026-11-03.md).
6. Drafts from shortlist emails sent before the handoff existed still open from their links. `GET /api/dealer-email?token=…` shows one draft with editable To, Subject and Message fields, and only the page's same-origin POST sends it, from the Zoho mailbox. Opening a link never sends anything, so mail scanners that follow links are harmless. Each link is the draft ID plus an HMAC under `DEAL_LINK_SECRET`, links expire after 30 days, and a handed-off draft can't be sent there. Remove the page once those deals finish.

Grokbot connects straight to Neon (`barton-checkout-db`) as `neondb_owner`, the only role that can log in, which the site uses too. Mason chose on November 3 to let it read everything, buyer details included. Its rules (setup doc, step 11) let it insert into `deal_events` and nothing else: no updates, deletes or schema changes without Mason asking in chat. Step 11 also lists the tables and columns it queries (`onboarding_submissions`, `deals`, `deal_listings`, `dealer_email_drafts`), so a migration that renames or drops one of them needs that prompt updated and re-sent to Grokbot. Neon can restore the branch to any point in the last 6 hours if a bad write gets through. Mason dropped walk-away prices on November 3, so `deal_listings.walk_away_cents` is only filled on older deals.

Grokbot answers dealer replies now. `/car-negotiation <intake ID>` (`.claude/skills/car-negotiation/`) is still available for a second opinion on a hard quote: Mason pastes the thread, and it itemizes the quote and drafts a reply. It logs quotes in `.car-searches/<intake ID>-negotiation.md` (git-ignored). Its `pricing.md` holds dated market figures and doc-fee rules, last researched November 3, 2026. Refresh them when they go stale.

Setup, in order:

1. Apply `db/005_deal_search.sql` through `db/008_deal_events_per_car.sql` to Neon, in order, before deploying. Paid intakes do not touch these tables, so the intake flow does not depend on them, but `/api/car-search` does. A handoff fails until 006 allows the `handed_off` status, and Grokbot can't log a deal until 007 exists. 008 keeps one row per car when an email covers two. All four were applied by November 3.
2. Generate two random values, for example with `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`. Set them in Vercel production as `CAR_SEARCH_TOKEN` and `DEAL_LINK_SECRET`, then redeploy.
3. On Mason's computer, create `.env.local` in the repository root (git-ignored) with the line `CAR_SEARCH_TOKEN=<the same token>`. Add `DEALER_BOT_URL` and `DEALER_BOT_KEY` from Grokbot's "New deal" routine (step 6 of the setup doc).
4. Keep the MarketCheck connector connected on claude.ai, so Claude Code sessions can use it.

| Variable | Purpose |
| --- | --- |
| `CAR_SEARCH_TOKEN` | Bearer token for `/api/car-search`, 32+ characters, in Vercel and in Mason's `.env.local`. Unset in Vercel means the endpoint returns 503. Whoever holds it can read every deal: search details, shortlists and logs, Buyer Picks, Buyer Documents and Buyer Texts. |
| `DEAL_LINK_SECRET` | 32+ random characters that sign the dealer email links in shortlist emails sent before the handoff. Only `/api/dealer-email` needs it now. Changing it breaks those links. |
| `CAR_SEARCH_URL` | Local only and optional: the deployment `scripts/car-search.mjs` talks to, default `https://www.steermeright.com`. |
| `DEALER_EMAIL_FROM_NAME` | Optional sender name on dealer emails sent from `/api/dealer-email`, default `Steer Me Right`. |
| `DEALER_BOT_URL` / `DEALER_BOT_KEY` | Local only: Grokbot's "New deal" webhook and its key, for `scripts/car-search.mjs handoff`. Keep the key out of chats and commits. |

Check the deals with `SELECT onboarding_id, shortlisted_at FROM deals ORDER BY created_at DESC;`, their first emails with `SELECT dealer_name, to_email, status, decided_at, sent_at, last_error FROM dealer_email_drafts ORDER BY created_at DESC;`, and one deal's negotiation with `SELECT occurred_at, kind, dealer_name, otd_cents / 100 AS otd, note FROM deal_events WHERE onboarding_id = '<intake ID>' ORDER BY occurred_at;`. A send from `/api/dealer-email` that fails stores only an error code (`Dealer email failed (EAUTH)`) and logs `[dealer_email_failed]`.

### Deal update email — November 4, 2026

`node scripts/deal-update-email.mjs .car-searches/<id>-update.json [--out <dir>]` renders a dashboard-style status email for the buyer and writes `<id>-update-email.html` and `.txt` next to the data file (or into `--out`). It only drafts: nothing is sent, and it reads no database. The first one is the BMW X5 search (`38358c20`).

- The data file is git-ignored buyer data, in cents: `search` (title, down payment, target payment), `assumptions` (tax rate, estimated fees, APR and term for `new` and `used`), `cars[]` and `activity[]`. Build it by hand, or have Claude build it, from `deal_listings`, `deal_events` and the search file. The field list is in the script's header comment, and `scripts/_tests/deal-update-email.test.mjs` has a complete fake example.
- Each car's estimated payment is computed. The script uses the dealer's out-the-door quote (`quote_otd_cents`) if there is one, otherwise the dealer's price (`quote_sale_cents`) or the asking price, plus tax and estimated fees. It subtracts credits marked `in_quote: false` (credits already inside a quote stay marked `true`) and the down payment, then amortizes. New cars and ex-loaners use the `new` rate and everything else the `used` rate, set per car by `finance`. The chart draws a dealer's price in solid blue and an estimate from the online listing in light blue.
- Only whitelisted fields are rendered, so target and walk-away prices, staff names and dealer contacts in the data never appear in the output (the tests feed decoys). Activity lines are written for the buyer, so leave out staff names, trade-in details and internal notes there too.
- The HTML is table-based with inline styles (no script, SVG, flex or grid), forces a light color scheme, and loads Inter from `/assets/buying/fonts/`. Keep it under Gmail's ~102 KB clipping limit: the X5 email with 14 cars is about 83 KB.

## Ops dashboard — November 20, 2026

`https://www.steermeright.com/api/ops` is Mason's private overview of every deal. Sign in by requesting a 10-minute email link (sent through `INTAKE_SMTP_*` to `OPS_ALERT_EMAIL`, or `INTAKE_EMAIL_TO` / `mason@steermeright.com`) or using `OPS_PASSWORD`; either sets a 30-day `HttpOnly` `SameSite=Lax` session cookie scoped to `/api/ops` (HTTP Basic auth with `OPS_PASSWORD` is also still accepted). Rotating `OPS_PASSWORD` invalidates all sessions and links immediately; without `OPS_PASSWORD` the page answers 503. It is rendered on the server from Neon on each load (no script, no analytics, `noindex`, `no-store`) and refreshes every two minutes. `?deal=<intake ID>` opens one deal: controls to close, reopen or update it, its shortlist with target and walk-away prices, first emails and full log. Code: `api/ops.js`, `api/_lib/ops-auth.js`, `api/_lib/ops-dashboard.js` and `api/_lib/ops-alerts.js`; tests in `api/_tests/ops-dashboard.test.mjs`.

- **Needs you**, in this order: open `needs_mason` questions, first emails still `pending` or `failed`, paid intakes from the last 60 days with no car search, agents that are overdue, and open deals with nothing logged for two days.
- **Agents** lists every agent seen in 30 days: when it last ran, how often it said it runs, and when it last logged a deal event. It is overdue once it misses two runs (twice `expect_minutes`, plus five minutes).
- **Open deals** are tiles at the top of the page; each opens its deal. Stage, best out-the-door quote (ignoring dropped dealers) and target come from `deal_events` alone. Nothing stores a status, so the agents only ever add rows. **Last 7 days** shows one line per deal per day (kinds of event, best price, dealers) with no notes; notes stay on the deal's page, where the log is grouped by day, long notes fold under "more", and each answer sits under its question. Below that are the last 14 days of website leads. The page shows no buyer email or phone.
- The page only adds rows, all with `actor` `mason`. Answering a question (an option button, a typed reply, or just **Done**) adds a `resolved` row with the `answer` if any and `resolves_event_id`. **Update deal** on a deal's page adds `closed` (note starts with Bought, Buyer walked away, Refunded or Other), `reopened`, `agreed` (dealer, out-the-door price, optional car), `dropped` (dealer) or `note`. Only a form posted from the page's own origin counts.

**How agents read a deal (November 26, 2026).** `node scripts/car-search.mjs deal | picks | documents | texts <intake ID>` goes through `GET /api/car-search?intake=<ID>&read=deal|picks|documents|texts` with `CAR_SEARCH_TOKEN`, so the skills Mason runs on his Mac (`/car-search`, `/car-negotiation`, `/dealer-reply`) need no database login. Each takes the intake ID or its first 8 characters. `deal` is the shortlist with each car's prices, the event log and the Buyer Updates; the other three are under "Deal Tracker" below. `scripts/deal-desk-db.mjs` has the same four reads from the same queries in `api/_lib`. Tests: `api/_tests/car-search-reads.test.mjs`.

**How agents feed it.** Claude Duet agents use `scripts/deal-desk-db.mjs`. It logs in to Neon as the `paperclip_agent` role with `DEAL_DESK_DATABASE_URL`, which is not kept on Mason's Mac, so these writes don't run there:
- `log <events.json | ->`: one JSON object per event with `intake_id`, `kind`, and as needed `dealer_name`, `vin`, `otd_cents`, `itemized`, `note`, `source_message_id`, `occurred_at`, plus `actor`, the agent's short name such as `duet-deals`. Kinds from `db/012_deal_events_agents.sql`: `email_received` (a dealer email that isn't a quote), `form_submitted` (an agent filled in a dealer's web form), `needs_mason` (blocked on Mason; `note` is the question and `options` up to six short answers shown as buttons, such as `["Approve", "Counter at $32,500"]`) and `resolved` (`resolves_event_id` plus an optional `answer`, when Mason answered somewhere else).
- `ran <actor> [minutes] [note]` at the end of every run, even when nothing happened, with how often it runs. Without it the dashboard can't tell a quiet inbox from a dead agent.
- `answers [actor]` at the start of every run: Mason's answers to that agent's questions that haven't been acted on. After acting, `ack <resolved_id> [note]` logs a note with `source_message_id` `answer:<id>`, which takes it off the list.

**Alerts.** With `OPS_ALERT_EMAIL` set, `GET /api/outbox-dispatch` emails Mason through the `INTAKE_SMTP_*` login: one email per `needs_mason` from the last two days (skipped if answered first), one per agent each time it goes overdue, and a digest once a day after `OPS_DIGEST_HOUR` (default 8 am Central). The digest lists what needs him, agents overdue, quiet deals and what moved in the last 24 hours, and is sent even when nothing needs him, so a missing digest means alerts are broken. Queue: `ops_alert_outbox`, up to five attempts. Vercel's cron runs once a day, so `.github/workflows/ops-alerts.yml` calls `/api/outbox-dispatch?jobs=ops_alerts` every 10 minutes (GitHub may run it late). It needs the repository secret `CRON_SECRET`, the same value as in Vercel; until that is set it does nothing. A failed run means an email failed, and GitHub emails the repository owner.

Only deals that went through `/car-search` have a `deals` row, so only they appear. To turn it on: apply `db/012_deal_events_agents.sql` to Neon (before agents use the new fields), set `OPS_PASSWORD` (24+ random characters) and `OPS_ALERT_EMAIL` in Vercel Production, redeploy, and add `CRON_SECRET` as a GitHub Actions secret.

## Deal Tracker — November 21, 2026

The buyer's private page for one deal, at `https://www.steermeright.com/deal/<token>` (`vercel.json` rewrites it to `api/deal-tracker.js`). Plan and decisions: [deal-tracker-build-plan-2026-11-21.md](deal-tracker-build-plan-2026-11-21.md), [adr/](adr/) (0003, November 25, 2026: dealers from Quotes in, buyers text Mason) and [GLOSSARY.md](../GLOSSARY.md). Everything is behind `DEAL_TRACKER_ENABLED`; unset, the page answers 404 without touching the database and every other route, email and script behaves as before. Tables: `db/013_deal_tracker.sql`.

- **Link.** The intake ID plus an HMAC under `DEAL_TRACKER_SECRET`, with a version kept in `deal_tracker_links`. The intake opens the deal and its link (full-service and concierge tiers); the welcome and what-to-expect emails carry it. It stops working three days after the deal's latest close and works again on reopen. Mason can revoke, restore or reissue it on the deal's ops page. Deals opened before the switch went on have no link; nothing backfills them.
- **What the buyer sees** is an allow-list built in `loadBuyerView` (`api/_lib/deal-tracker.js`): the stage, their cars by shortlist rank with the best out-the-door price so far (`api/_lib/deal-view.js`; a dropped dealer's earlier prices don't count until that dealer quotes again), each car's listing photos and details (`photo_urls` and `details` on `deal_listings`, rules in `api/_lib/listing-media.js`), posted Buyer Updates, their pick, receipts for documents and the number to text Mason at. No dealer name, listing link or VIN before Quotes in; from Quotes in each car names its dealer and location and links its listing. Target and walk-away prices never show. Photos are fetched by the function and served at `/deal/<token>/photo/<rank>/<n>` (only images under 4 MB, no redirects followed), so a photo host never shows. The page loads only its own CSS and script, with no analytics.
- **Buyer Updates** (`api/_lib/buyer-updates.js`). Mason posts from the deal's ops page. The skills Mason runs on his Mac (`/car-search`, `/car-negotiation`, `/dealer-reply`) save drafts only, with `node scripts/car-search.mjs draft <intake ID> <file | -> [skill]` (`/api/car-search`, `"action": "draft_update"`, signed with the skill's name from a fixed list, `car-search` by default, never posted and never signed `mason`); since November 26, 2026 they have no way to post, so when Mason says "post it" in a chat the skill saves a draft and he approves it on the ops page. Agents with the database login insert rows with `node scripts/deal-desk-db.mjs update`, where `--post` still posts on his say (adr/0002); without Mason's say a row is a draft he approves or discards there, and a database trigger stops an agent signing as Mason. A posted update is emailed to the buyer after a five-minute take-back window by the `buyer_updates` job (`api/_lib/buyer-update-email.js`, through `INTAKE_SMTP_*`, with the ordinary Reply-To).
- **Questions by text, and Buyer Texts.** There is no question box and no reply address (adr/0003). The page shows `DEAL_TRACKER_TEXT_NUMBER` as "Text me at …" with an `sms:` link; unset, it says to email Mason. Buyer Texts (adr/0004, `db/014_buyer_texts.sql`, `api/_lib/buyer-texts.js`) are copied into Neon from Mason's Mac by `scripts/imessage-sync.mjs`, a LaunchAgent run every 10 minutes (`install` / `uninstall` / `--dry-run`; log in `~/Library/Logs/steermeright-imessage-sync.log`). It gets the open deals' numbers from `GET /api/car-search?texts=threads` and posts each thread with `"action": "texts"`, both with `CAR_SEARCH_TOKEN`. It needs Full Disk Access for the Node binary it runs with; run `install` again after a Node upgrade. Agents read with `node scripts/car-search.mjs texts <intake ID> [last N]` (`?read=texts`; or `deal-desk-db.mjs texts` with the database login) and check `last_synced_at`. On the Mac, `node scripts/imessage-thread.mjs "<name or phone>"` reads a thread directly with no Neon involved; it needs Full Disk Access for the program running it (in the Claude desktop app, the bundled Claude Code binary under `~/Library/Application Support/Claude/claude-code/<version>/`, re-granted when that folder changes; in a terminal, the terminal app).
- **Buyer Pick** (`api/_lib/buyer-picks.js`). Each pick emails Mason an ops alert and shows under "Needs you". A pick opens when an update is posted "Ready for your call"; the buyer picks a car or asks to keep looking, and a pick clears itself if its dealer is dropped. Agents only read them: `node scripts/car-search.mjs picks <intake ID>` (`?read=picks`) lists the deal's standing picks, never a cleared one, and nothing on `/api/car-search` writes a pick (adr/0002).
- **Buyer Documents** (`api/_lib/buyer-documents.js`). The browser uploads straight to a private Vercel Blob store with a short-lived signed URL (images and PDFs, 20 MB each); an ID is taken only after Price agreed. The buyer's link can never read a file back. Mason downloads at `/api/ops?document=<id>`. Agents list a deal's files with `node scripts/car-search.mjs documents <intake ID>` (`?read=documents`: id, type, content type, size and date only, never a deleted file, a store path or contents) and download one with `node scripts/car-search.mjs document <id>`. With the Deal Tracker off, `picks` and `documents` answer 404. The daily cron's `document_cleanup` job deletes files 30 days after the deal's latest close.
- **Jobs.** `.github/workflows/ops-alerts.yml` calls `/api/outbox-dispatch?jobs=ops_alerts,buyer_updates` every 10 minutes; the daily Vercel cron runs everything, `document_cleanup` and `text_cleanup` (Buyer Texts 30 days after the latest close, on whenever `CAR_SEARCH_TOKEN` is set) included. The workflow may only name jobs that exist: an unknown name answers 400.
- **Previews.** `npm run deal-tracker:preview` serves every state of the page on port 4180 with sample data; `npm run customer-emails:preview` shows each email with and without the tracker. Copy changes need Mason's OK.

To turn it on, in this order: create a private Vercel Blob store connected to the project; apply `db/013_deal_tracker.sql` to Neon; set the variables below in Vercel Production, `DEAL_TRACKER_ENABLED` last; redeploy; then run one test deal end to end, including listing photos, a pick and a large document upload and download.

**Launched November 25, 2026.** Migrations 013 and 014 were already on Neon. The private Blob store `barton-buyer-documents` (iad1) is connected to the project and sets `BLOB_READ_WRITE_TOKEN`. `DEAL_TRACKER_SECRET` (sensitive) and `DEAL_TRACKER_ENABLED=1` are set in Production, and the production deployment of `662ae98` was redeployed with them. `DEAL_TRACKER_TEXT_NUMBER` is unset on Mason's call, so the page says to email him. `CUSTOMER_EMAIL_ENABLED` stays off until Mason approves the emails. Until then the welcome email doesn't go out, so copy each new buyer's link from their deal page on `/api/ops` and send it yourself.

The launch test ran on the live site as intake `d230f97c-88aa-48e4-97d7-1df797474767` ("Test Buyer", mason@steermeright.com, a `livemode=false` purchase on `cs_test_DealTrackerLaunch20261125`, events by `tracker-launch-test`). It went through `/api/onboarding`, `/api/car-search`, quotes and Price agreed (as `deal_events`), a "ready for your call" update posted on the agents' path and its buyer email (the link in it matched the one built from the secret), a pick and its ops alert, a 19.5 MB PDF upload and its download with `car-search.mjs document`, and was then closed as "other". Nothing went to a dealer. Not yet tried from `/api/ops`: copying the link, posting an update, clearing a pick and downloading a document. Leave its rows as they are. Listing photos from `img2.carmax.com` never load through the photo route: CarMax's CDN doesn't answer Vercel's servers, so each request times out after 8 seconds. dealer.com, HomeNet and Jazel photos load in under a second. The `/car-search` skill now leaves CarMax photos out.

## Required environment

| Variable | Requirement |
| --- | --- |
| `DATABASE_URL` | Required. Pooled PostgreSQL connection string for the deployed environment. |
| `APP_ORIGIN` | Required in production. Exact canonical origin, normally `https://www.driverightcarbuying.com`. |
| `ALLOWED_ORIGINS` | Optional comma-separated additional exact origins, such as an explicitly approved preview. Do not use wildcards. |
| `STRIPE_SECRET_KEY` | Required for webhook construction and purchase-status verification. Keep test and live environments separate. |
| `STRIPE_WEBHOOK_SECRET` | Required. Signing secret for this exact deployed webhook endpoint and mode. |
| `CHECKOUT_PAUSED` | Set `true` during coordinated cutover to stop new checkout creation. Does not disable paid receipts/webhooks/onboarding. Default false. |
| `STRIPE_PAYMENT_LINK_FULL_SERVICE_URL` | Required for the $395 full-service tier; must be the 39500-cent link listed under "Reverted" in [stripe-cutover-2026-10-23.md](seo-execution/stripe-cutover-2026-10-23.md). |
| `STRIPE_PAYMENT_LINK_CONCIERGE_URL` | Required for the $695 concierge tier; must be the 69500-cent link listed in the same section. |
| `STRIPE_PAYMENT_LINK_PRIVATE_CLIENT_URL` | Required for the $1,995 Private Client tier (`private_client`); must be a 199500-cent link. Launch steps: `docs/seo/2026-11-26-private-client-plan.md`. |
| `TURNSTILE_SECRET_KEY` | Optional. When configured, lead requests must include a valid token for an allowed hostname. |
| `LEAD_FORWARD_URL` | Optional HTTPS downstream destination used only after a lead commit. |
| `LEAD_FORWARD_BEARER_TOKEN` | Optional bearer credential for that downstream destination. |
| `LEAD_NOTIFY_EMAIL` | Optional. Client Outreach's Grokbot inbox; each new lead emails it a `New lead <id>` notice through the `INTAKE_SMTP_*` settings. Needs `db/009_lead_email_outbox.sql` on Neon first. Keep the address out of the repository. |
| `LEAD_OUTBOX_BATCH_SIZE` | Optional lead-notification claim size, default `10`, allowed `1`–`50`. |
| `LEAD_OUTBOX_LEASE_SECONDS` | Optional processing lease, default `60`, allowed `15`–`600`; must exceed the delivery timeout. |
| `LEAD_OUTBOX_MAX_ATTEMPTS` | Optional attempt cap, default `8`, allowed `1`–`25`. |
| `LEAD_OUTBOX_RETRY_SECONDS` | Optional initial retry delay, default `30`, allowed `5`–`3600`; exponential backoff is capped at six hours. |
| `LEAD_FORWARD_TIMEOUT_MS` | Optional notification request timeout, default `8000`, allowed `500`–`15000`. |
| `OPS_PASSWORD` | Optional. Turns on the private dashboard at `/api/ops`; at least 24 characters. Unset, the page answers 503. |
| `OPS_ALERT_EMAIL` | Optional. Where ops alerts and the morning digest go; needs `INTAKE_SMTP_USER`/`INTAKE_SMTP_PASSWORD`. Unset, no alerts. |
| `OPS_DIGEST_HOUR` | Optional Central-time hour after which the daily digest goes out, default `8`, allowed `0`–`23`. |
| `DEAL_TRACKER_ENABLED` | Optional. `1`, `true` or `yes` turns on the Deal Tracker. Needs `db/013_deal_tracker.sql` on Neon first. Unset, nothing changes. |
| `DEAL_TRACKER_SECRET` | Required with the tracker: 32+ random characters that sign buyers' links and upload tickets. Changing it breaks every link. |
| `DEAL_TRACKER_TEXT_NUMBER` | Optional 10-digit US number buyers text Mason at, shown on their page. Unset, the page says to email. Anything else fails loudly. |
| `BLOB_READ_WRITE_TOKEN` | Set by Vercel when the private Blob store is connected (or `BLOB_STORE_ID`). Without it Buyer Documents are off. |
| `DATABASE_MAX_CONNECTIONS` | Optional per-function-process limit, default `1`, allowed `1`–`5`. Use a pooled database endpoint. |
| `ANALYTICS_FORWARD_URL` | Optional credential-free HTTPS endpoint for the server-side analytics collector. When absent, outbox rows remain pending. |
| `ANALYTICS_FORWARD_BEARER_TOKEN` | Optional bearer credential for the analytics collector. |
| `ANALYTICS_OUTBOX_BATCH_SIZE` | Optional claim size, default `10`, allowed `1`–`50`. |
| `ANALYTICS_OUTBOX_LEASE_SECONDS` | Optional processing lease, default `60`, allowed `15`–`600`. Expired claims can be recovered. |
| `ANALYTICS_OUTBOX_MAX_ATTEMPTS` | Optional delivery-attempt cap, default `8`, allowed `1`–`25`. |
| `ANALYTICS_OUTBOX_RETRY_SECONDS` | Optional initial retry delay, default `30`, allowed `5`–`3600`; subsequent retries back off to six hours. |
| `ANALYTICS_FORWARD_TIMEOUT_MS` | Optional per-request timeout, default `5000`, allowed `500`–`15000`. |

No secrets belong in HTML, JavaScript, SQL, or committed environment files.

Apply `db/003_checkout_offer_snapshot.sql` before this candidate. New attempts snapshot an `offer_key` derived from tier, amount, currency and configured Payment Link. Retries with a missing/stale key, changed amount or currency return `409 stale_offer` without a URL. The UI shows the current fee and requires another explicit submit (Restart checkout), preserving the old attempt and creating a new idempotency key. A conflicting payload still returns `409 idempotency_conflict`. Never backfill old offers or rewrite historical amounts.

Current live links enable automatic tax and promotion codes; Stripe tax behavior is unspecified on each price and inferred by currency in account settings. This is unresolved parity, not a successful checkout check. See [the Stripe cutover packet](seo-execution/stripe-cutover.md). Do not disable lawful tax collection or weaken amount checks to force a passing payment.

## Stripe dashboard configuration

For new sales, keep the final payable total at full service `39500 usd` and concierge `69500 usd`. Retire the old AI/$495 and $295/$895 acquisition links after the coordinated cutover. Preserve historical attempts, prices, receipts and valid already-created sessions. If discounts or tax change the Checkout Session total, this version intentionally sends it to review instead of silently recording a mismatched conversion.

Set each Payment Link's post-payment redirect in Stripe, including the literal Stripe replacement token:

- The historical AI receipt page was removed on 2026-10-23; `/payment-success-consultant.html` now 301s to `/schedule.html`. Deactivate any AI Payment Link that is still live, and do not reactivate AI sales.
- Full service (Steer Me Right, $395): `https://www.steermeright.com/payment-success-fullservice.html?session_id={CHECKOUT_SESSION_ID}`
- Concierge (Steer Me Right Pro, $695): `https://www.steermeright.com/payment-success-concierge.html?session_id={CHECKOUT_SESSION_ID}`

Keep these query-string URLs. The payment pages move `session_id` out of the address before GTM loads (see [Checkout Session ID privacy](#september-27-2026-checkout-session-id-privacy)), so no Stripe change is needed. The pages also accept `#session_id={CHECKOUT_SESSION_ID}`, but Stripe documents the token only in query strings, and Clarity records fragments anyway.

Register `https://www.driverightcarbuying.com/api/stripe-webhook` as a Stripe webhook destination and copy its endpoint signing secret into the matching Vercel environment. Do not use the account secret from another webhook or mix test and live keys.

## Release order and verification

1. Run the numbered SQL files in `db/` order against a new or backed-up target database. They are transactional; `002_standard_purchase_analytics.sql` normalizes any unsent legacy sale events to `purchase` without changing acknowledged history.
2. Add the required environment variables separately to Development, Preview, and Production. Use different Stripe keys, webhook secrets, and databases where practical.
3. Configure the two active Payment Link success URLs and the webhook destination in Stripe; retain historical receipt verification.
4. For the $395/$695 prices, follow [stripe-cutover-2026-09-27.md](seo-execution/stripe-cutover-2026-09-27.md) and the revert in [stripe-cutover-2026-10-23.md](seo-execution/stripe-cutover-2026-10-23.md); for the earlier offer transition, the atomic paused cutover in [stripe-cutover.md](seo-execution/stripe-cutover.md). Deploy matching API, browser assets and environment values together with new checkout paused; verify preview/test-mode parity before any production promotion. Do not expose the new $395/$695 API with an old $295/$895 link or separately deploy the old acquisition UI.
5. Run `npm test` and `npm run check:api`; send a test lead twice with the same key, then with a conflicting payload.
6. Complete one Stripe test purchase for each active tier, plus replay already-created historical $195/$495 fixtures. Confirm one `purchases` row and one `purchase` outbox row per Checkout Session, even after resending the webhook from Stripe. Confirm the configured collector receives the same `event_id` and `Idempotency-Key` once.
7. Verify that a direct visit with a fabricated or unpaid session never unlocks onboarding.

Useful reconciliation queries:

```sql
SELECT outcome, count(*) FROM stripe_events GROUP BY outcome ORDER BY outcome;
SELECT status, count(*) FROM checkout_attempts GROUP BY status ORDER BY status;
SELECT status, count(*) FROM analytics_outbox GROUP BY status ORDER BY status;
SELECT status, count(*) FROM lead_forward_outbox GROUP BY status ORDER BY status;
```

## Deliberate operational gaps

The application now writes and dispatches a standard `purchase` event plus `onboarding_complete`. No destination URL, credentials, destination-specific mapping, or consent policy was provided, so none was invented or activated. The configured analytics collector must acknowledge only durable ingestion, honor `Idempotency-Key`, map `purchase` to the approved analytics destinations, and preserve `event_id`/`transaction_id` for destination deduplication. Until that collector and credentials are configured and verified, purchase-ledger counts—not ad-platform counts—are authoritative.

Dispatch is triggered opportunistically by verified Stripe webhook and onboarding requests. `npm run analytics:dispatch` now provides a bounded worker invocation. It sends one due batch, reports aggregate delivery/exhaustion counts, exits nonzero for missing collector, delivery failure or expired exhausted leases, and fences acknowledgements by attempt number. The protected `GET /api/outbox-dispatch` Vercel cron now invokes both bounded workers daily. Missing destinations are reported as unconfigured and skipped; they are not marked delivered. See the scheduler section below. Daily reconciliation must compare paid Stripe Checkout Sessions, `purchases`, `analytics_outbox` status, and collector/destination acknowledgements.

Leave `TURNSTILE_SECRET_KEY` unset until a matching client widget is installed and its token is submitted with the lead form. Enabling the secret without the widget intentionally causes browser lead submissions to fail verification.

Failed optional lead forwards can be retried with `npm run leads:dispatch` (below). The daily scheduler is configured in the repository; the notification destination remains external setup; downstream systems must honor the durable lead ID as an idempotency key.

Define and apply an approved retention/deletion policy for lead and onboarding PII, restrict database access, encrypt backups, and avoid logging request bodies. Webhook rows intentionally omit the full Stripe event payload and customer fields.

## Lead notification recovery

`npm run leads:dispatch` sends one bounded batch from the existing `lead_forward_outbox`. It uses the same HTTPS destination, bearer credential, allowlisted lead payload and durable lead ID as the immediate post-commit delivery. It requires no SQL migration. Only leads queued while forwarding was configured are eligible; configuring a destination later does not automatically backfill older unqueued leads.

The dispatcher commits an atomic `FOR UPDATE SKIP LOCKED` claim before calling the destination. Pending rows are due immediately; failed rows wait for exponential backoff from their last attempt; processing rows become eligible after their lease expires. Sent rows and exhausted rows are never automatically resent. Each acknowledgement checks both processing state and attempt number, so a late worker cannot overwrite a newer outcome. The destination must durably accept the lead before returning `2xx` and deduplicate retries by `Idempotency-Key`.

The CLI prints only `configured`, `claimed`, `sent`, `failed`, `exhausted` and `exitCode` counts/state. It exits nonzero for a missing destination, failed delivery, dispatcher error or an exhausted row; a final in-progress attempt becomes exhausted only when its lease expires. Logs and stored error messages omit customer fields, downstream response bodies, credentials and destination URLs. A notification claim or acknowledgement failure after the lead commits does not turn its successful API receipt into an error.

Run it from a worker with narrowly scoped database and destination credentials. The protected daily Vercel cron provides unattended retry when a destination is configured. Review exhausted rows and the downstream durable receipt before manually resetting an attempt count; never reset sent rows as a routine retry. This repository installs a scheduler but does not invent or activate a notification destination.

Contact forms preserve their idempotency key on ordinary network retries. A confirmed `idempotency_conflict` after the visitor changes the form restarts the request once with a new key; a second conflict stops and leaves the form editable. When forwarding is unconfigured, the saved-message state offers direct contact options. Optional analytics errors cannot replace a successful saved-inquiry state. The shared 15-second request deadline covers both response headers and the response body.

## Protected retry scheduler — October 4, 2026

`vercel.json` schedules `GET /api/outbox-dispatch` at `17 14 * * *` (14:17 UTC daily). The conservative daily interval works without assuming an upgraded Vercel plan. Opportunistic delivery still runs after the original committed request. This schedule is a recovery sweep, not a promise of immediate downstream delivery after an outage.

The route requires a production-only `CRON_SECRET` of at least 32 characters in `Authorization: Bearer …`. A random sensitive secret was installed in the linked Barton project through the Vercel connector before deployment; it is not committed or written to the review artifact. Unauthenticated requests return 401 before a database connection. A missing/short secret returns 503. Workers share the function's database client, claim one bounded batch each, and settle before the response. Missing destinations return `configured:false` and do no database work. Failed/exhausted deliveries return HTTP 503 plus aggregate counts and emit `[outbox_attention_required]`; dispatcher failures emit `[outbox_dispatch_failed]` without raw private error text. Responses are `no-store`.

Check the Vercel cron run history and function logs after activation. Email/Slack failure notification is not configured: there is no existing alert destination or delivery credential. Connect that actual account destination to these failure signals before treating alerting as operational. A successful empty cron response proves authorization and scheduling only, not notification/collector delivery.

The live project environment metadata was checked October 4: neither `LEAD_FORWARD_URL` nor `ANALYTICS_FORWARD_URL` was configured. No provider or credential was invented. Once actual destinations are supplied, set them only in the intended environment, verify a synthetic idempotent durable receipt, and review existing pending/exhausted counts. The cron never backfills unqueued leads.

## Vercel website measurement — October 4, 2026

The production `/_vercel/insights/script.js` endpoint was confirmed enabled. PR #95's unconditional snippet was superseded by `web-analytics.js`, with no static-site runtime package. The updated Ad privacy control explicitly describes both OpenAI and Vercel measurement; earlier OpenAI-only permission does not enable Vercel. Declining, revocation, expired preference and Global Privacy Control keep this integration off.

Only released informational paths on production hosts can load the SDK. `beforeSend` accepts page views only, strips query/fragment data, excludes customer identity/custom-event payloads and rejects unknown paths. Receipts and the quote worksheet are excluded. Since the SDK sends external referrers intact, views with an external path/query/fragment/credentials are suppressed. The SDK identity is reset before any automatic view. Browser tests confirm the revised consent UI; regression tests cover the production host, GPC, receipt, referrer and URL filters. Cookieless page measurement does not close the separate purchase outbox collector or destination reconciliation gap.

Update, November 25, 2026: `beforeSend` now also accepts four custom events, `cta_click`, `generate_lead`, `begin_checkout` and `phone_click`, which `script.js`'s `track()` hands to `web-analytics.js`. Each event's payload is rebuilt from an allowlist of at most one slug-valued field (`cta_location`, `form_name` or `service_tier`), never IDs, labels or typed text. The rebuild matters because the SDK sends the original payload if `beforeSend` returns none. Vercel stores custom events only on Pro or Enterprise, and its UTM breakdowns are a paid add-on.

## Campaign tags on links we control — November 25, 2026

`script.js` saves `utm_source`, `utm_medium`, `utm_campaign`, `utm_content` and `utm_term` as first and last touch. Leads (`leads.attribution`) and checkouts (`checkout_attempts.attribution`) carry them, and so does the GTM dataLayer. Vercel does not show them without the paid add-on, so read them in Neon or GA4.

Links on channels we run use one lowercase scheme so the sources group cleanly:

| Channel | Link |
|---|---|
| Google Business Profile, website button | `https://www.steermeright.com/?utm_source=google&utm_medium=organic&utm_campaign=gbp` |
| YouTube channel links section | `https://www.steermeright.com/?utm_source=youtube&utm_medium=social&utm_campaign=channel` |
| YouTube video descriptions | `https://www.steermeright.com/?utm_source=youtube&utm_medium=social&utm_campaign=video&utm_content=<video-slug>` |
| Reddit posts and comments | `https://www.steermeright.com/?utm_source=reddit&utm_medium=social&utm_campaign=<subreddit>` |
| Mason's email signature | `https://www.steermeright.com/?utm_source=email&utm_medium=signature&utm_campaign=mason` |

Point a tag at a deeper page by swapping the path, keeping the query. Every page carries a self-canonical, so tagged URLs are not indexed separately. ChatGPT search adds `utm_source=chatgpt.com` to the links it cites and sends no referrer; that is why ChatGPT visits looked like direct traffic in Vercel. From October 15 to November 25, 2026 it was first touch on 6 of 25 leads and 11 started checkouts, but only 1 of 10 paid checkouts. Google referrals were first touch on 6 of those 10.

Lifecycle emails are not tagged: they reach people who have already paid, and their only site links are the shared logo and footer in `api/_lib/email-layout.js`. The Deal Tracker emails share that file.

## September 18, 2026 local measurement changes

Internal navigation preserves the last acquisition touch; a new external referrer or explicit campaign can replace it. Stripe returns and confirmation routes preserve acquisition instead of creating a payment-provider referral. First touch remains the stored first acquisition. Browser and API restrict referrer to HTTP(S) origin and source/landing paths to pathname (no credentials, query or fragment). Delivery sanitizes historical queued payload copies too, without rewriting the ledger. Pre-change lead retries compare normalized stored business fields when the old hash differs; changed business data still conflicts. Existing consent mechanisms are retained; the live GTM consent/configuration still needs the documented account audit. `generate_lead` uses `lead:<lead_id>` and `begin_checkout` uses `checkout:<attempt_id>`, with session and memory guards. CTA/phone clicks remain intent only. No contact or buying-brief content is added to analytics. GA4 identity and collector/destination reconciliation remain unresolved.

## September 27, 2026 Google Ads purchase measurement

Google tags are GTM-only (container `GTM-W577B3D4`): pages only push to `dataLayer`, and `scripts/validate-site.mjs` rejects gtag.js loaders, direct `AW-`/`G-` config and hard-coded conversion calls. Browser event contracts:

- `begin_checkout`: pushed once per checkout attempt after `/api/checkout-start` succeeds, with `event_id` `checkout:<attempt_id>`, `service_tier` and `checkout_attempt_id`. The push carries `eventCallback` and `eventTimeout: 1000`; the Stripe redirect waits for GTM's callback for at most one second, does not wait when GTM has not loaded, and is never blocked by a tracking error.
- `purchase_verified`: pushed on a confirmation page only after `/api/purchase-status` returns `verified: true` with a UUID `purchase_id`, a finite positive `value` and a three-letter uppercase `currency`. It carries `transaction_id` (the server purchase ID), `value`, `currency` and `service_tier` with the usual page context and first/last-touch attribution; `event_id` is `purchase_verified:<purchase_id>`. Memory and `sessionStorage` guards send it once per browser session, so map `transaction_id` in the Google Ads conversion tag to dedupe a receipt reopened elsewhere. `processing`, `unverified`, `not_found`, request errors and sessions held for review never fire it. No contact data or Checkout Session ID enters the data layer, and the ID stays out of tag requests (next section).

The OpenAI Ads Pixel maps `purchase_verified` to `order_created` only on a verified receipt page after its secure session ID leaves the address, with existing measurement consent and GPC gating. It uses `purchase:<purchase UUID>` and the recorded amount in cents. Ordinary receipt visits do not load it. The server `purchase` outbox event keeps the Checkout Session ID as its `transaction_id`, so do not send both to the same Google Ads conversion action. GTM tag, trigger and conversion-action setup is account work; this change does not modify the container. See [the October 2 release record](openai-ads-cro-2026-10-02.md).

### Google ad click IDs (stored for reconciliation)

`attribution()` keeps Google's `gclid`, `gbraid` and `wbraid` in the first and last touch when they match `^[A-Za-z0-9_-]{8,256}$`; a new ad click starts a new last touch. Under Global Privacy Control they are not captured, and any stored ones are dropped on the next page load. `validateAttributionTouch` adds a click-ID key only when it is valid and never rejects a request for a bad one, so touches without click IDs keep the eight legacy keys and existing request hashes still match. The IDs are stored in `leads.attribution` and `checkout_attempts.attribution` (no migration) and travel with the lead-forwarding payload. They are not added to the data layer and not forwarded to the analytics collector, whose allowlist in `api/_lib/analytics.js` omits them. `policy.html` discloses this; publish that text only once the GTM consent step in `docs/google-ads-setup.md` is live.

Reconcile paid purchases with ad clicks for a completed window (aggregate outcomes only; no contact tables):

```sql
SELECT p.id AS order_id, p.paid_at, p.tier_id, p.amount_total / 100.0 AS value, upper(p.currency) AS currency,
       COALESCE(a.attribution->'last_touch'->>'gclid', a.attribution->'first_touch'->>'gclid') AS gclid,
       COALESCE(a.attribution->'last_touch'->>'gbraid', a.attribution->'first_touch'->>'gbraid') AS gbraid,
       COALESCE(a.attribution->'last_touch'->>'wbraid', a.attribution->'first_touch'->>'wbraid') AS wbraid,
       a.attribution->'last_touch'->>'utm_source' AS last_source, a.attribution->'last_touch'->>'utm_medium' AS last_medium
FROM purchases p JOIN checkout_attempts a ON a.id = p.checkout_attempt_id
WHERE p.livemode AND p.paid_at >= $1 AND p.paid_at < $2;
```

Attempts with `status = 'review_required'` were paid in Stripe but produced no purchase row (for example a promotion code or tax changed the total); list them separately.

## September 27, 2026 Checkout Session ID privacy

Stripe returns buyers to the payment pages with the Checkout Session ID in the URL, and that ID is the only credential `/api/onboarding` needs for the one immutable intake. GTM (`GTM-W577B3D4`, live Version 6) runs the Google tag and Microsoft Clarity on every page, plus four Google Ads conversion tags that send `url` = `{{Page URL}}` when they fire. Before this change they sent the ID to Google and Microsoft.

What the four `payment-success*.html` pages do now:

- **Inline head script.** It is the first script in `<head>`, before the GTM snippet. It moves `session_id` or the legacy `checkout_session_id`, from the query or a `#session_id=` fragment, into `sessionStorage` under `drive_right_checkout_session:<path>`. It then replaces the address without the ID and keeps every other parameter and anchor. If storage is blocked, the ID stays in `window.driveRightCheckoutSession` for that page load only.
- **`checkoutSessionId()` in `script.js`.** It reads the address first and repeats the move if the head script didn't run (for example, under a future CSP that blocks inline scripts). Then it reads `sessionStorage`, then the in-memory fallback.
- **Verified state.** The verified ID stays in memory. `<body>` gets `data-purchase-verified="true"`, which `buying/intake-chat.js` watches to start the chat intake. The old `data-verified-session-id` attribute put the ID into the DOM that Clarity records.
- **Reloads and new tabs.** A reload in the same tab verifies again. A bookmark, new tab or copied URL no longer carries the ID and shows the missing-link message. That is intended: the link worked as a bearer credential.
- **Unchanged:** Stripe success URLs, `/api/purchase-status`, `/api/onboarding`, `purchase_verified` and historical receipts. `api/_tests/checkout-session-privacy.test.mjs` pins the script order and behavior.

Measured in an offline headless Chrome with the live Version 6 container, the Google tag and Clarity 0.8.70, using a fake `cs_test_…` ID. Every hostname was blocked, and each tag request was captured locally and never sent.

| Where the ID went | Before | After |
|---|---|---|
| Google tag page view (`ccm/collect` `dl`) and remarketing (`viewthroughconversion`, `rmkt/collect` `url`) | Yes | No |
| "Submit Lead Form" conversion, fired by the intake form (`pagead/conversion`, `1p-conversion` `url`) | Yes | No |
| Clarity uploads: page URL, and `data-verified-session-id` in the DOM recording | Yes | No |
| The next page's referrer (Google `dr`/`ref`, Clarity) | Yes | No |

The same hits still fire after the change, only without the ID. Three alternatives failed the same measurement:

- **Removing the ID from `script.js` only.** `script.js` loads at the end of `<body>`, after GTM has started. Google stayed clean only while `script.js` ran before the Google tag read the address. With `script.js` 400 ms slower (as after a deploy or on a cache miss), every Google hit and Clarity still got the ID, and later Google hits sent the old URL as `ref`. The DOM attribute still reached Clarity either way.
- **A `#session_id=` fragment in Stripe.** Google hits dropped the fragment, but Clarity recorded it.
- **GTM `page_location` sanitizing only.** With a sanitized `page_location` on the Google tag, its remarketing, page-view and conversion hits dropped the ID. GTM's own `ccm/collect` page view still sent it, and Clarity isn't affected.

Still visible, all first party or on the buyer's device:

- Chrome's History list keeps the return URL; the address bar, the back/forward entry and later referrers don't.
- Vercel request logs and the `/api/purchase-status?session_id=…` requests.
- The page's navigation-timing entry, which page scripts could read; neither tag sent it.

Account-side steps, not applied:

- **Clarity:** exclude it from `/payment-success*` with a GTM trigger exception. The project's served config unmasks `body`, so Clarity records page text as displayed. In the test it masked typed values and placeholders. The Full Service and Ultimate Concierge chat intake (October 5, 2026) shows each answer, contact details included, as page text, so the chat panel carries `data-clarity-mask="true"`. The exclusion is still the complete fix.
- **Google tag:** keep the sanitized `page_location` as defense in depth. It doesn't cover GTM's own page view or Clarity, so the page code is the fix.

After deploy, check a payment page: once it loads, the address bar shows no `session_id`, and no request to a Google or Clarity host contains `session_id`, `cs_live_` or `cs_test_`.
