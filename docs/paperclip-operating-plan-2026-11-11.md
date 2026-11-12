# Paperclip operating plan (November 11, 2026)

Status: draft for Mason's review. Nothing has been created in Paperclip yet. Phase 1 starts once Mason signs off.

This plan sets out how Paperclip, the self-hosted agent app on Mason's Mac, should run Steer Me Right's deal work. The goal is for Mason's time to go only to decisions and to pressing Send. The Camry deal is the pilot. This repository is public, so the plan names no buyers, dealers or deal IDs.

## Mason's decisions (November 11)

| Question | Decision |
| --- | --- |
| Which plan agents run on | Mason's Claude Max subscription, through Paperclip's Claude Code adapter (`claude setup-token`). The old "no automation on the subscription" rule is gone from `AGENTS.md`. |
| Grokbot | No longer used. Claude Duet does that work now, so the Grokbot setup docs are historical. |
| Negotiation rules in the skills | Dropped. A first contact may name a target price, and quiet dealers can get follow-ups. How Mason actually writes, learned from his sent mail, replaces the list of rules. |
| Data | Paperclip agents may read everything Claude can read today, buyer details in Neon included. |
| Uptime | The Mac is on all day, so Paperclip routines can run during business hours. |
| Scope | Deal work first. SEO, site work and marketing come later. |
| Volume | One to two deals a week now, likely three to four soon. |
| The bottleneck | Dealer email. After dozens of dealers get a first email, replies pile up in the dealer Gmail inbox. Mason doesn't yet trust Claude to answer them alone, because the drafts don't sound like a seasoned negotiator. |

## How the work runs today

| Step | Who or what does it now |
| --- | --- |
| 1. Website inquiry | Site → `POST /api/leads` → Neon `leads`, plus the Web3Forms email to Mason. Duet's #client-outreach channel drafts a reply. Zoho isn't connected there, so Mason sends it from Zoho himself. |
| 2. Paid intake | Stripe → `/api/onboarding` → Neon, plus the "Paid intake" email to Mason through Zoho. |
| 3. Car search | Mason runs `/car-search <intake ID>` in Claude Code: MarketCheck, pricing, a target per car, then submit to `/api/car-search`. |
| 4. First contact | Mason asks Duet to "spin up a bot" for the deal, which gives it a deal channel. The channel drafts the quote requests, Mason approves them, and they go out as dealer-website forms through Chrome or as email from the dealer Gmail inbox. The car-search skill's `handoff` step still posts to the retired Grokbot webhook. |
| 5. Dealer replies and negotiation | The deal channel reads the dealer inbox, logs to Neon `deal_events` and drafts replies, but only when Mason asks. Nothing checks the inbox on a schedule. Mason approves each send. `/car-negotiation` is a second opinion. |
| 6. Pick and close | Mason picks the dealer, then handles the buyer's order, deposit and paperwork with the buyer. |
| 7. Buyer updates | `scripts/deal-update-email.mjs` renders an update email from a hand-built data file, and Mason sends it. |

Two gaps make the most work: no one triages the dealer inbox until Mason asks, and every reply needs his rewrite or approval. At 3 to 4 deals a week, that's roughly 150 to 250 dealer emails.

## What Paperclip owns, what stays with Mason, what stays in Duet

| | Paperclip agents | Mason | Duet |
| --- | --- | --- | --- |
| Dealer inbox | Check on a schedule, match each email to a deal and dealer, label it, log quotes to `deal_events`, track every dealer's status | | Retire the deal channels once Paperclip covers a deal, so two bots never draft in the same thread |
| Replies to dealers | Draft in Mason's voice, saved as a **Gmail draft in the dealer's thread** | Read, edit and send the draft from Gmail | |
| Picking the winner | List each dealer's best out-the-door price and ask for a decision | Decide | |
| Dealer website forms | | | Keeps sending forms through Chrome when Mason asks |
| Car search | Phase 3: run the `car-search` skill when a paid intake lands, and stop at the shortlist | Review the shortlist | |
| Buyers and leads | Phase 3: draft lead replies and buyer updates as Zoho drafts | Send | #client-outreach stays until then |
| Quick questions and one-off help | | Ask | The main Duet chat stays Mason's place to talk things through |

**Paperclip coordinates, Mason sends.** Paperclip agents never send anything to a dealer, buyer or lead. Every outgoing email is a draft that Mason sends himself. That's the only way to make the rule stick. Paperclip can only enforce an approval on a connector action set to "Ask first". An instruction like "ask Mason before emailing" is just text in a prompt, and Claude Code agents run on the Mac with permission prompts off. Instead, each agent's Claude Code settings deny the send tools (see Approval gates), so the agent has no way to send.

## Company structure

The company is the existing one Mason already claimed. Its goal: *close every paid car search at the best out-the-door price, with Mason's time spent only on decisions and sends.* Timer heartbeats stay off, so agents wake only from their routines, from a task being assigned, or from Mason's comments.

| Agent | Phase | Model | Wakes on | Skills | Tools |
| --- | --- | --- | --- | --- | --- |
| **Deal Desk** | 1 | Opus 5.5 for the pilot (Sonnet 5.5 if usage runs tight) | "Dealer inbox" routine: every 10 min from 8 am to 7 pm Central, every 30 min from 7 to 9 pm. Also Mason's comments. | `dealer-reply` (new), `car-negotiation`'s `pricing.md` and `closing.md` | Dealer Gmail: read, label, create drafts. Send, reply and forward denied. Neon: read, plus inserts into `deal_events`. MarketCheck for market checks. |
| **Chief of Staff** (the CEO slot) | 2 | Sonnet 5.5 | 8 am and 6 pm digest routines, and a check for new paid intakes every 30 min | `paperclip-board` | Neon read. Paperclip tasks and projects. |
| **Car Search** | 3 | Opus 5.5 | A task from Chief of Staff for each new paid intake | `car-search` | MarketCheck, `scripts/car-search.mjs` (`get` and `submit`). The shortlist waits for Mason. |
| **Client Desk** | 3 | Sonnet 5.5 | New leads (Neon check), and Mason asking for a buyer update | `lead-reply` (new), the deal update email script | Zoho: read and create drafts, sending denied. Neon read. |
| **Growth** | 4 | Sonnet 5.5 | A weekly routine | `seo-ai-search-visibility`, the repo's SEO runbooks | The repo, on its own branch. It never pushes, because a push to main deploys. |

How the work is laid out in Paperclip:

- **One project per deal**, named by model and deal ID (the first 8 characters of the intake ID), with no buyer name. Gmail labels follow the same rule. The current Camry label carries the buyer's first name, so rename it to the deal ID.
- **One task per dealer** within the deal. The task's status mirrors the negotiation:
  - `todo`: waiting on the dealer
  - `in_review`: a draft is waiting for Mason to send
  - `blocked`: needs a decision from Mason
  - `done`: the dealer agreed or was dropped
- Each task's comments hold the itemized quotes and Deal Desk's reasoning. Neon `deal_events` stays the permanent record.
- **Choosing the dealer** is a Paperclip board approval: "Pick a dealer for deal X". It lists every dealer's best out-the-door price beside the target. The approval only records the decision. The emails that act on it are still drafts.

Paperclip runs only on loopback, so the site on Vercel can't call it. New intakes and leads are therefore found by checking Neon on a schedule, not by webhook.

## Approval gates

| Gate | How it's enforced |
| --- | --- |
| Nothing sent to dealers, buyers or leads | **Enforced.** Each agent's Claude Code `permissions.deny` blocks the Gmail and Zoho send, reply and forward tools. Agents can only create drafts. |
| Neon writes limited to `deal_events` | **Enforced** with a dedicated Neon role, `paperclip_agent`, which can read every table and insert into `deal_events` only. The agents never get the owner role. |
| Hiring agents, budget overrides | Paperclip board approvals, which are on by default for hires. |
| Picking the winning dealer, telling a dealer the buyer is ready | Board approval or a blocked task. The real gate is that Mason sends the email. |
| Pushes to the site | Growth works on a branch, Mason merges, and no agent has push rights. |

Phase 0 checks that deny rules still apply when Paperclip starts Claude Code with permission prompts off.

## Costs and usage

- **Dollars:** none beyond the Max plan already paid for. Paperclip doesn't count subscription runs against its budgets, so a Paperclip budget won't stop an agent that's running on the subscription.
- **The real limit is Max usage.** That pool also covers Mason's own Claude Code sessions, `/car-search` and Duet, so a busy agent can leave Mason short in the middle of a deal. Ways to manage it:
  - Keep timers off, and run the inbox routine only from 8 am to 9 pm (every 10 minutes until 7, then every 30).
  - Run on Opus only where the writing has to be right (Deal Desk and Car Search), and use Sonnet everywhere else.
  - The inbox routine stops right after a cheap Gmail search when there's no new mail.
  - If the empty checks still use too much, split them off. A small "Inbox Watcher" agent on Haiku does the 10-minute search, and it assigns Deal Desk a task only when mail arrives. That way Opus wakes only to write.
  - Pausing the company stops every agent at once.
  - Week 1 of the pilot measures how much of the Max usage limit the agents use. If they take too much, Deal Desk moves to Sonnet, or to an Anthropic API key with a Paperclip monthly cap of about $50 to start. API runs are tracked in dollars, and the cap does stop them.
- **Expected volume:**
  - Per deal: about 15 dealers × 2 to 4 replies, so 30 to 60 runs that draft a reply.
  - Per day: about 70 inbox checks, most ending after one Gmail search, plus 2 digests.

## The Camry deal as a walkthrough

Where it stands on November 11:
- Most quotes were requested through dealer-website forms, and follow-ups went to seven more dealers tonight.
- Three dealers quoted an out-the-door price. The best is about $2K under the buyer's hoped-for price, but the car doesn't have the heated seats the buyer asked for.
- One dealer will match a written quote. One wants the buyer to come in. The best dealer locks the price but wants financing done in person.
- The dealer inbox has the deal's thread label with 20 threads, 3 of them unread.

What happens in Paperclip:

1. **Setup:**
   - Mason tells the Duet Camry channel to stand down.
   - Deal Desk gets the "Camry · <deal ID>" project, with one task for each dealer that has a thread or was sent a form. Each task starts with the dealer's latest quote and status.
2. **A dealer replies:** the inbox routine finds the new mail within 10 minutes.
   - Deal Desk matches the email to its task by thread, then by VIN or stock number.
   - It itemizes the quote and logs it to `deal_events`.
   - It compares the quote with the best out-the-door price so far and with the target.
3. **A draft is ready:**
   - Deal Desk writes the reply in Mason's voice. Examples: "We have a written number of $X out the door on the same car, can you beat it?", or a friendly reply to keep a come-in request on email.
   - It saves the reply as a Gmail draft in that thread and moves the task to `in_review`.
   - It adds one comment explaining why.
4. **Mason sends:** he opens Gmail's Drafts on his phone, edits if needed, and sends.
   - On the next run, Deal Desk sees the sent reply and moves the task back to `todo`.
   - It notes any edit Mason made, so the `dealer-reply` skill can learn from it.
5. **A decision comes up:** for example, whether the best price without heated seats beats a higher price with them.
   - Deal Desk opens a "Pick a dealer" approval listing every dealer's best out-the-door price and what each car is missing.
   - Mason decides there, or in chat with the buyer first.
6. **Closing:** Deal Desk drafts the close-outs to the other dealers and checks the buyer's order line by line against `closing.md`. The buyer's name goes on the buyer's order only after Mason says the buyer is ready.

## Rollout

### Phase 0: connect (Mason, about 45 minutes)

1. In Paperclip, add the Claude connection that uses the subscription, and enable Settings → Experimental → Assistant connections (MCP). Then run `/mcp` in a `claude` terminal to authorize Paperclip's MCP tools for Claude Code.
2. Create a test Claude Code agent with nothing to do, then check four things:
   - It can see the dealer Gmail and MarketCheck. These are claude.ai connectors, and they may not load with a `setup-token` login. If not, the fallback is a local Gmail MCP server.
   - It can reach Neon.
   - The send tools are blocked.
   - The run shows up in Mason's Claude usage.
3. Create the `paperclip_agent` Neon role in the Neon console, then run `db/010_paperclip_agent_grants.sql` as the owner. Store the role's connection string in Paperclip as the secret `DEAL_DESK_DATABASE_URL`.
4. Fill in the real tool names in `docs/paperclip/deal-desk.settings.json`. Use the names that the test agent's Gmail and Zoho tools show, in place of `GMAIL` and `ZOHO`. Then pass the file to Deal Desk's Claude Code with `--settings` (or the adapter's equivalent), and confirm that a send attempt is refused.

### What Mason's sent mail showed (November 11)

A read of the roughly 115 sent messages in the dealer inbox. The anonymized analysis is kept outside the repository.

- **Mason's own replies worked; the bot-written ones often didn't.**
  - Hand-typed replies were one to three sentences, sent within minutes, and asked for one thing with a consequence attached. They got itemized numbers in 6 to 13 minutes and moved dealers on price.
  - Bot replies that thanked, restated and recited VINs got ignored. One countered above the dealer's own number. The "I'm helping a buyer" template got no replies from 6 dealers, and one dealer refused to deal with brokers.
  - `dealer-reply` is built from his own replies.
- **Speed matters.** Engaged reps answer in 3 to 15 minutes. A batch of replies sent one to two hours late, which also ignored each dealer's question, lost half its dealers.
  - Thirty minutes is too slow while a deal is active. The inbox routine runs every 10 minutes during business hours and every 30 minutes otherwise.
- **First contact through the dealer's website form gets answers.** Cold email to generic leads@ or info@ addresses got about 1 reply in 15.
  - That matters for Car Search in Phase 3: it should prepare form text for Mason, or for Duet through Chrome, more than email.
- **Inbox noise Deal Desk has to handle:**
  - CRM templates
  - AI front-ends that can't negotiate
  - one dealer's CRM splitting one negotiation into 7 threads
  - prices sent only as scanned PDFs or screenshots
  - bounced addresses

  So Deal Desk matches a message by store and rep, not only by thread, and opens attachments.

### Phase 1: Deal Desk on the Camry deal (the first thing to build)

Built so far, not committed:

| Piece | File |
| --- | --- |
| The voice skill, with 17 of Mason's replies as examples (names, cars and numbers changed) | `.claude/skills/dealer-reply/` |
| Deal Desk's instructions | [paperclip/deal-desk.md](paperclip/deal-desk.md) |
| Its Claude Code deny rules, with placeholder tool names for Phase 0 to fill in | [paperclip/deal-desk.settings.json](paperclip/deal-desk.settings.json) |
| Its Neon helper, with tests | `scripts/deal-desk-db.mjs` |
| Grants for the `paperclip_agent` role | `db/010_paperclip_agent_grants.sql` |

**Blind test of `dealer-reply` (November 11).** A fresh agent drafted replies to five real dealer messages without seeing what Mason sent. Two of its replies matched Mason's, but those two cases came from messages used as skill examples, so they prove nothing about new mail.

| Case | How the draft compared with Mason's reply |
| --- | --- |
| Rival quote with the car's spec dropped | Close: it dropped the soft preference, cited the rival quote and asked them to beat it. |
| Rival quote with proof attached | Close, but wordier than Mason's. |
| Come-in request | Missed the leverage Mason used: a timeline, plus the other car he was shopping. |

The tester also found 12 gaps, which were then fixed:
- countering on the dealer's own number with something added on top
- no target on hand
- several situations at once
- requests for proof
- unreadable attachments
- a dealer's hard terms
- rival quotes on used cars
- sign-offs

Mason still has to read the skill himself before Deal Desk drafts live mail.

1. **Build the `dealer-reply` skill** with Mason in Claude Code.
   - Source material: the sent messages in the dealer inbox, about 117 messages across 64 threads so far.
   - It captures how Mason opens, counters, matches, pushes back on come-in requests and closes out a dealer.
   - Mason checks it against five real threads before it ships. It replaces the rule lists in the `car-negotiation` skill.
2. **Create Deal Desk** paused, with the skill, the deny rules and the Neon secret.
3. **Load the Camry deal:** create the project and one task per dealer from the deal's Gmail threads and `deal_events`.
4. **Dry run:** one "Run now" on the 3 unread Camry emails. Mason reviews the drafts before anything else runs.
5. **Turn on** the "Dealer inbox" routine for the Camry deal only: every 10 minutes during business hours and every 30 minutes otherwise.

The pilot is done when the Camry deal closes or after a week, whichever comes first. Mason's checks:
- How many drafts he sent unchanged or with small edits.
- Whether any email was ever matched to the wrong deal or dealer, or leaked buyer or private information. One such slip pauses Deal Desk.
- How much Max usage it took.
- Whether his dealer inbox stayed sorted.

### Phase 2: every deal

- New deals go to Deal Desk from their first contact, and the Duet deal channels retire.
- Change the `handoff` step in `/car-search`, which still posts to the retired Grokbot webhook, so it creates the Paperclip project instead.
- Add Chief of Staff's morning and evening digests: what's waiting on Mason, the best price per deal, and dealers who have gone quiet.

### Phase 3: intake to shortlist, buyers and leads

- Car Search runs the `car-search` skill as soon as Chief of Staff finds a new paid intake, and stops at the shortlist.
- Client Desk drafts lead replies and buyer update emails as Zoho drafts.
- #client-outreach in Duet retires.

### Phase 4: growth

- A weekly Growth agent for SEO checks, page updates and IndexNow runs, working on a branch that Mason merges.
- Start from the existing `docs/seo-agent-runbook.md`.

## Open questions for Mason

- Do these dealer-email rules from `AGENTS.md` stay?
  - Sign off as "Mason".
  - Never mention Steer Me Right.
  - No buyer contact details before the deal is agreed.

  This plan assumes they do. They are about privacy and identity, not negotiation tactics.
- Should Deal Desk handle dealers reached through website forms? Their replies usually arrive by email or text. Texts and calls would still need Mason to forward a note, for example a comment on the dealer's task: "Dealer A offered $X OTD by phone".
- Where should the digests reach Mason? Paperclip runs on loopback only, so the options are:
  - a Gmail draft addressed to himself
  - Tailscale, to open the Paperclip UI on his phone
  - the Duet main chat

## Follow-up outside this plan

- Rewrite or archive the Grokbot docs:
  - `dealer-bot-setup-2026-11-03.md`
  - `client-inquiries-setup-2026-11-03.md`
  - `dealer-replies-plan-2026-11-03.md`
  - the Grokbot parts of `AGENTS.md` and `implementation-operations.md`

  Start once Phase 1 shows what replaces them.
