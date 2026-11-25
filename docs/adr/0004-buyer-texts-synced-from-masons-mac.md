# Buyer Texts are copied from Mason's Mac so agents can read them

Mason decided this on November 25, 2026. It changes one consequence of [0003](0003-dealers-shown-from-quotes-in-and-buyers-text-mason.md): buyers still text Mason on his own number, but agents can now read those texts.

**What is copied.** A LaunchAgent on Mason's Mac runs `scripts/imessage-sync.mjs` every 10 minutes. It asks `/api/car-search` (with `CAR_SEARCH_TOKEN`) for the open deals and each intake's phone and email, then reads only those one-to-one threads in the Messages app, from a week before the intake. It sends text, sender, time, edited and unsent flags, and each attachment's name and type. The files stay on the Mac, and an unsent text arrives with no words. Every other thread on the Mac, group chats and tapbacks included, is never read or sent. A number two open deals share is skipped. A closed deal stops syncing.

**Who is covered.** A buyer whose intake has a deal row: one opened at paid intake while the Deal Tracker is on, or by `/car-search`. A deal syncs until a `closed` event, so a finished deal never marked closed keeps syncing. A buyer who texts from a number or email not on the intake is not matched.

**Where it lives.** `buyer_texts` and `buyer_text_threads` (db/014) in Neon. Paperclip's role reads both and writes neither, because a row reads as the buyer's own words. Only `/api/car-search` writes them, so whoever holds `CAR_SEARCH_TOKEN` (today only Mason's `.env.local` and Vercel) can add rows and list every open buyer's phone and email. Agents read through `node scripts/deal-desk-db.mjs texts <intake ID>`, which shows when the Mac last synced. The daily cron's `text_cleanup` deletes a deal's texts 30 days after its latest close, as for Buyer Documents. The buyer's Deal Tracker never shows them.

## Considered options

- **Read the Messages database only when an agent runs on the Mac** (`scripts/imessage-thread.mjs`): kept for runs on the Mac, but Paperclip and cloud agents can't reach it.
- **Android phone with Google Messages for Web, read through the browser**: rejected. It needs an open, paired browser tab, and it's slow and breaks when the page changes.
- **A business texting line with an API** (Quo and others): still open. It would sync without the Mac, but needs A2P 10DLC registration and moving buyers to a new number.
- **Mac connects to Neon directly**: rejected. It would put a write-capable database credential on the Mac, while the car-search token is already there.

## Consequences

- Sync runs only while the Mac is awake, signed in and has Full Disk Access for the Node binary the LaunchAgent uses. That grant covers anything that Node binary runs, not just this script. Nothing alerts when sync stops; an agent must check `last_synced_at` before treating a thread as current.
- Texts can hold dealer names, prices, credit terms and signed document links, and every agent with database access can read them. Nothing from a text goes into a dealer email or word for word into a Buyer Update.
- Texts from before payment are copied only from a week before the intake. Leads who never pay are not copied.
- Photos and PDFs in texts stay on the Mac. An agent needing one asks Mason, or opens it when running on the Mac.
