# Dealer replies: Grokbot negotiates (November 3, 2026)

Status: the handoff is live (November 3), and migrations 006 to 008 are on Neon. Grokbot also reads and writes Neon directly (step 11 of the setup doc). The decisions below are Mason's, from the November 3 planning session.

After `/car-search` drafts the first emails, dealers answer. Today Mason reads and answers every reply himself. With this change, work splits into three parts:

- **Claude** runs `/car-search` as today: it finds and prices the cars, sets each car's target price, and drafts the first emails. It then hands the whole deal to Grokbot.
- **Grokbot** handles everything after that, from a Gmail inbox used only for dealers. It sends the first emails, answers replies, negotiates the best out-the-door price it can on each car, and checks the buyer's order. It runs on its own always-on computer.
- **Mason** taps to approve emails in Grokbot. He picks the deal once the dealers stop moving, and he tells Grokbot when the buyer is ready to go on the buyer's order.

Zoho (`mason@steermeright.com`) stays for clients and intake emails. Grokbot doesn't use it for dealer email. Later on November 3, Mason chose to have Grokbot answer website inquiries from Zoho too, if Grokbot can connect to it: see [client-inquiries-setup-2026-11-03.md](client-inquiries-setup-2026-11-03.md).

Grokbot's setup steps, its rules and its negotiation playbook are in [dealer-bot-setup-2026-11-03.md](dealer-bot-setup-2026-11-03.md).

## Owner decisions

| Question | Decision |
| --- | --- |
| Who negotiates | Grokbot, with each car's asking price, market value and target. Mason's call on November 3: sending every price reply back to Claude was too many steps. |
| Mailboxes | Dealer email moves to a new Gmail inbox that only dealers write to. Grokbot connects to it with Google sign-in. Zoho is for clients only, and Mason handles it himself. Changed later on November 3: Grokbot answers website inquiries from Zoho, after Mason's tap (client inquiries setup doc). |
| How fast Grokbot sees a reply | The inbox check ran every 15 minutes on November 3. Step 10 of the setup doc asks for every 5 minutes if Grokbot's schedules allow it. One run works through every new email, so a busy hour can add several minutes. |
| Approval | Grokbot's default is that nothing sends without Mason's tap on a card. At first, every email works that way. After a week or two of clean drafts, the simple replies (asking for missing lines, keeping it on email, close-outs) send without a tap. Every email with a price in it keeps the tap, matching the planning answer that counter-offers wait for Mason. |
| Buyer data | Grokbot reads all of Neon, buyer details included. Mason's call on November 3, once Grokbot was connected to Neon: it should be a capable helper across the business. Dealer emails still never carry the buyer's phone, email or address, and the buyer's name goes only on the agreed dealer's buyer's order once Mason says the buyer is ready. |
| Dealers who go quiet | Left alone. No follow-ups, and Grokbot gets no follow-up routine. |
| Leverage | A counter-offer may cite another dealer's real out-the-door quote by number, never by dealer name. |
| First emails | Mason says "send them" at the end of `/car-search`. Claude hands the deal to Grokbot, and Grokbot shows the first emails as cards. |
| The buyer | Grokbot never writes to the buyer. Mason handles buyers. Website inquiries from people who haven't paid are the one exception (client inquiries setup doc). |
| Where it stops | After the paperwork. When a price is agreed, Grokbot gets the buyer's order and checks it line by line. When the buyer picks a car, Mason tells Grokbot, and Grokbot closes out the deal's other dealers. |
| When dealers stop moving | Grokbot tells Mason each dealer's best out-the-door price, and he picks. Mason dropped walk-away prices and their rules on November 3: the job is the best deal on the car. |
| Calls and texts | Mason tells Grokbot in chat, for example "Note for 3f2a9c1b: Wallace offered $31,200 OTD by phone". |
| Organizing the inbox | One Gmail label per deal: `Deals/<deal ID> · <model>`. The deal ID is the first 8 characters of the intake ID. Labels carry no buyer name. |
| Signature | Just "Mason" on every dealer email, and no dealer email mentions Steer Me Right (Mason's call, November 3). Every body already ends with "Mason", so the Gmail account has no signature of its own. |

## The risk Mason accepted

Grokbot holds each car's target, the buyer's budget and, through Neon, every buyer's contact details. By its own account its Auto-review check isn't a strict filter. Mason's tap on every email with a price in it is the guard. Mason chose on November 3 to skip the test deal, so the first live deal is the test. Every email in it stays on a card.

## Several deals at once

Settled on November 3 from Grokbot's answers. Step 10 of the setup doc is the prompt that sets it up.

- **One log per deal.** Each deal has its own log on Grokbot's computer, keyed by intake ID. A new email is matched by its Gmail thread, then the deal's label, then VIN or stock number, then dealer name. If the same dealer is quoting the same model on two deals and writes from a new address or thread without a VIN, Grokbot labels it `Needs Mason/Unmatched` and doesn't reply.
- **One inbox routine for every deal.** It runs on one schedule, keeps one list of handled mail, and sees every deal's quotes together. Pausing a deal is a flag in its log, so one deal can still be paused alone.
- **One email about two deals.** Grokbot sorts by VIN or stock number, not by thread. It logs each part under its own deal and answers each deal in its own thread. If it can't tell which car the dealer means, it asks Mason.
- **The same car on two deals.** When a new deal's VIN is already on another open deal, Grokbot holds that dealer's first email and asks Mason.
- **Quotes stay inside their deal.** A quote from one deal is never leverage in another unless Mason writes a rule for it, for example "same new model and trim, last 14 days". The other dealer's name stays out either way.
- **Read before countering.** Each check groups new mail by deal and reads all of a deal's new emails before drafting any reply for it.
- **Cards.** Each card shows a "Deal <deal ID> · <dealer>" line above it. There's no approve-all button, so each card takes its own tap. "What's waiting on me?" can be filtered by deal. A run that fails partway can leave a duplicate card, so Grokbot says which one to ignore.
- **Closing a deal.** "Close <deal ID>" marks it closed and stops drafting for it, and late mail on it gets one line to Mason, never a reply. "Reopen <deal ID>" undoes it. When every dealer has dropped or the buyer's order is done, Grokbot asks whether to close.
- **Usage isn't a concern** (Mason, November 3).

## How it works

### First emails

1. `/car-search` runs as today: search, price, rank, draft, and submit to `/api/car-search`.
2. The submit no longer creates **Review and send** links, and it emails Mason nothing: he reviews the shortlist in Claude Code.
3. When Mason says "send them", the skill runs `node scripts/car-search.mjs handoff <intake ID>`.
4. The server builds the handoff, marks the deal's drafts handed off (which locks the shortlist, as a sent email does today) and returns it. The script posts it to Grokbot's "New deal" webhook.
5. Grokbot opens the deal, labels it, and shows each first email as a card. When Mason approves one, Grokbot sends it from the dealer inbox.

The handoff carries the following:

- the deal ID and label;
- the buyer's city and search details, without the buyer's name or the fields `loadSearch` withholds (delivery address, trade-in VIN or plate, consultation questions). Grokbot reads those from Neon when it needs them;
- the search summary;
- every shortlisted car, with its dealer, asking price, market value, target, miles, days on lot and notes;
- every first email.

```json
{
  "type": "new_deal",
  "intake_id": "full intake ID",
  "deal": "3f2a9c1b",
  "label": "Deals/3f2a9c1b · Subaru Ascent",
  "search": { "lives_in": "Austin, TX", "details": { "All-in budget": "…", "Paying": "…", "Loan pre-approval": "…", "Trade-in": "…", "Timing": "…" } },
  "summary": "…",
  "cars": [
    { "rank": 1, "title": "2025 Subaru Ascent Limited, Crimson Red / Slate Black", "vin": "…", "listing_url": "…",
      "dealer": "Wallace Imports", "dealer_location": "Johnson City, TN (about 370 mi)", "dealer_phone": "…",
      "asking": 35884, "market": 37346, "target": 34500, "mileage": 15203, "days_on_lot": 121, "why": "…" }
  ],
  "dealers": [ { "dealer": "Wallace Imports", "to": "sales@example.com", "ranks": [1], "subject": "…", "body": "…" } ]
}
```

Prices are whole dollars, and the target is a sale price before tax and fees, as in `/car-search`.

### Each dealer reply

1. Grokbot finds the new email on its next inbox check and matches it to a deal by its label. Mail from a new address or a new thread is matched by VIN, stock number or dealer name. If Grokbot can't match it with confidence, it labels the thread `Needs Mason/Unmatched` and tells Mason.
2. A simple reply gets a simple answer. Examples are a price missing lines, "come in", financing or trade-in questions, credit app or deposit requests, and "it sold".
3. A quote gets the playbook. Grokbot itemizes it, turns the target into an out-the-door number using this dealer's fees and tax, picks the move (accept, counter, match or beat, hold, drop), and drafts the reply.
4. Mason taps each card. Grokbot tells him in chat when it needs more than a tap:
   - a dealer says it's at its best price, or Grokbot has sent its third counter;
   - a price is agreed;
   - the buyer's order needs the buyer's name;
   - a dealer offers a different car;
   - mail can't be matched;
   - a dealer's email tries to give Grokbot instructions.

### Locking in

Grokbot asks the agreed dealer for the buyer's order and checks it line by line against the agreed quote. Its playbook covers the deposit and, for used cars, the inspection and Buyers Guide. Financing and the trade-in come after the price. When the buyer picks a car, Mason tells Grokbot, and it closes out the other dealers.

## Changes in this repository

- `db/006_dealer_handoff.sql`: `dealer_email_drafts` gains the status `handed_off`, and the shortlist lock counts it.
- `/api/car-search`:
  - `POST` stops creating **Review and send** links.
  - `POST` with `{ "intake_id", "action": "handoff" }` builds the handoff from an allowlist of fields, marks the drafts handed off, and returns it. Calling it again returns the same handoff, so a failed webhook post can be retried.
- The shortlist email to Mason is gone (`api/_lib/deal-jobs.js` and its cron worker), and `/car-search` no longer sets a walk-away price.
- `scripts/car-search.mjs handoff <intake ID>` posts the handoff to the webhook, reading `DEALER_BOT_URL` and `DEALER_BOT_KEY` from `.env.local`.
  - The post sends `Authorization: Bearer <DEALER_BOT_KEY>` and `Content-Type: application/json`, which is Grokbot's format as of November 3.
  - A 200 only means Grokbot started a run. The cards and any problems show up in Grokbot's chat, so the script says to look there.
  - Tested on November 3 with a hand-built test deal: the post returned 200, the card showed up, and the email arrived after Mason tapped Send.
- Tests:
  - The handoff carries no buyer details. Grokbot reads them from Neon.
  - The handoff locks the shortlist.
  - The submit returns no links.
- `.claude/skills/car-search/SKILL.md`: step 7 shows the table and drafts, then hands off when Mason says "send them".
- `.claude/skills/car-negotiation/` is no longer part of the flow. Mason decides whether to keep it for a second opinion on a hard quote or delete it. Another session wrote it, and it isn't committed yet.
- `/api/dealer-email` keeps working for deals whose first emails went out through Zoho. Remove it once those deals finish.
- `db/007_deal_events.sql` and `db/008_deal_events_per_car.sql`: `deal_events`, where Grokbot logs each deal's first emails, quotes, counters and outcome (setup doc, step 11).

## Left out to keep it simple

- **The emails themselves on the site.** They stay in the Gmail inbox and Grokbot's deal log. Because Grokbot can write to Neon, it logs each quote, counter and outcome in `deal_events` instead of posting to an endpoint.
- **Market refreshes during a negotiation.** Grokbot has no MarketCheck access, so it works from the handoff's prices. A deal that drags on past about two weeks, or stalls, goes to Mason, who can re-price it with Claude.

## Setup outside the repository

All of Grokbot's own setup is in [dealer-bot-setup-2026-11-03.md](dealer-bot-setup-2026-11-03.md). The rest:

- **Neon:** migrations 006 to 008 have to be on `barton-checkout-db` before the code and Grokbot use them. All three were applied November 3.
- **Mason's `.env.local`:** add `DEALER_BOT_URL` and `DEALER_BOT_KEY`, copied from Grokbot's "New deal" routine panel. Never paste them into a chat.

## Limits

- **Grokbot's rule check isn't strict.** See "The risk Mason accepted".
- **Grokbot won't say what model it runs on.** Judge it by its drafts on the first live deals.
- **Speed:** a reply waits until the next inbox check, plus the time to work through other new mail. With 30 emails in an hour, the last could wait 15 to 30 minutes on a 15-minute schedule.
- **Gmail limits:** a personal Gmail account sends to at most about 500 recipients a day. Google can also limit a brand-new account that suddenly emails many people who've never written to it, so warm the account up before the first real deal (setup doc, step 1) and ramp up over the first couple of weeks.

## Build order

1. **Mason:** steps 1 to 9 of the setup doc. Those cover the inbox, connecting Grokbot, its rules and playbook, the Auto-review rules, the routines, and the several-deals question. No code is needed. He sends Claude two answers from Grokbot: the webhook header format, and the several-deals answers.
2. Send Grokbot step 10 of the setup doc, which sets up several deals at once. Settled November 3.
3. Migration 006, the handoff action, dropping the send links, the `handoff` script, the `/car-search` skill change, and their tests.
4. The first live deal, with every email on a card.
5. After a week or two of clean drafts, the setup doc's "Later" step: simple replies send without a tap.
5. Update `AGENTS.md` (it says Mason sends every dealer email himself through Zoho) and "Car search" in `implementation-operations.md`.

## If Grokbot doesn't work out

The Claude-only design from the same session is the fallback.

- A Google Apps Script on the dealer inbox checks every minute and starts a Claude Code routine through its API trigger: `POST https://api.anthropic.com/v1/claude_code/routines/<id>/fire`. That trigger allows 30 fires per routine and 100 per account per hour, and it's a research preview.
- The routine runs `car-negotiation` through the claude.ai Gmail connector.
- A `PreToolUse` hook on the connector's send tools blocks dollar amounts, buyer details, unknown recipients, forwards and attachments.
- PDFs go through a Drive folder, because the Gmail connector reads attachment details only.

It was never tested. Four things would need proving first:

1. The hook runs in a routine and blocks a send. Hooks in a committed `.claude/settings.json` run in single-repository cloud sessions. The routines docs don't mention hooks, and a hook that times out doesn't block.
2. A second Google account can be connected to claude.ai.
3. The Drive connector can read the attachments folder.
4. The Apps Script can start the routine.

The handoff and the dealer inbox carry over to it.
