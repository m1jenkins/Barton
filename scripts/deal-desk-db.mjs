import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import postgres from 'postgres';
import { localEnv } from './car-search.mjs';

// Neon access for Paperclip's Deal Desk agent (docs/paperclip-operating-plan-2026-11-11.md):
//   node scripts/deal-desk-db.mjs deals                 every deal with its last logged event
//   node scripts/deal-desk-db.mjs deal <intake ID or its first 8 characters>
//                                                       one deal's shortlist and its full event log
//                                                       (and its Buyer Updates, so an agent sees what the buyer was told)
//   node scripts/deal-desk-db.mjs log <events.json | ->  add events to deal_events; a rerun adds nothing twice.
//                                                       A quote or agreed needs the car's VIN: the Deal Tracker prices each car by VIN
//   node scripts/deal-desk-db.mjs update <intake ID> <actor> [--post] [--ready-for-pick] [--answers <question id>] <text file | ->
//                                                       add a Buyer Update (1-4000 characters). Without --post it is a draft
//                                                       for Mason to approve on the ops dashboard. --post only on Mason's say
//                                                       in this chat (adr/0002): the buyer sees it at once and the email leaves
//                                                       about five minutes later unless Mason takes it back. --ready-for-pick
//                                                       opens the Buyer Pick; --answers links the Buyer Question it answers
//   node scripts/deal-desk-db.mjs questions [intake ID] Buyer Questions, unanswered first (answered: a posted update
//                                                       answers it); with an intake ID, that deal's only. Held mail from
//                                                       anyone but the buyer never shows here until Mason releases it
//   node scripts/deal-desk-db.mjs picks [intake ID]     standing Buyer Picks, newest first, with the car's title: one car
//                                                       at its price as picked, or "keep looking". Read-only: only the
//                                                       buyer makes one (adr/0002). A pick is what they want, not an
//                                                       agreed price: Mason confirms it with the dealer
//   node scripts/deal-desk-db.mjs ran <actor> [minutes] [note]
//                                                       record that an agent ran (every run, even with nothing new);
//                                                       minutes is how often it runs, for the dashboard's overdue check
//   node scripts/deal-desk-db.mjs answers [actor]       Mason's answers to needs_mason questions not yet acted on
//   node scripts/deal-desk-db.mjs ack <resolved id> [note]
//                                                       mark one of those answers acted on, so it stops being listed
// Connects with DEAL_DESK_DATABASE_URL, the paperclip_agent role from db/010, which can read
// every table, insert into deal_events and, from db/013, insert into buyer_updates. Amounts are cents, as in deal_events.
const USAGE = 'Usage: node scripts/deal-desk-db.mjs deals | deal <intake ID> | log <events.json | -> | update <intake ID> <actor> [--post] [--ready-for-pick] [--answers <question id>] <text file | -> | questions [intake ID] | picks [intake ID] | ran <actor> [minutes] [note] | answers [actor] | ack <resolved id> [note]';
const ACTOR = /^[a-z0-9][a-z0-9 ._-]{0,59}$/i;
const INTAKE_ID = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
export const POST_RULE = 'Posted on Mason\'s say. He can take it back on the ops dashboard before the email leaves.';
// email_received, form_submitted, needs_mason and resolved come from db/012; the ops
// dashboard (/api/ops) lists open needs_mason rows under "Needs you" until a
// resolved row names them in resolves_event_id.
export const EVENT_KINDS = ['first_email_sent', 'quote', 'counter', 'agreed', 'dropped', 'note', 'closed', 'reopened',
  'email_received', 'form_submitted', 'needs_mason', 'resolved'];

const text = (value, max) => (value == null || value === '' ? null : String(value).trim().slice(0, max));

// One deal_events row from the agent's JSON. Throws with every problem at once.
export function parseEvent(input) {
  const problems = [];
  const event = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  if (event !== input) problems.push('each event must be a JSON object');
  if (!INTAKE_ID.test(event.intake_id ?? '')) problems.push('intake_id must be the full intake ID');
  if (!EVENT_KINDS.includes(event.kind)) problems.push(`kind must be one of ${EVENT_KINDS.join(', ')}`);
  if (event.vin != null && !/^[A-HJ-NPR-Z0-9]{17}$/i.test(event.vin)) problems.push('vin must be 17 characters');
  if (event.otd_cents != null && !(Number.isInteger(event.otd_cents) && event.otd_cents >= 0)) problems.push('otd_cents must be a whole number of cents');
  if (event.itemized != null && (typeof event.itemized !== 'object' || Array.isArray(event.itemized))) problems.push('itemized must be an object of line items in cents');
  if (event.occurred_at != null && Number.isNaN(Date.parse(event.occurred_at))) problems.push('occurred_at must be an ISO date');
  if (['quote', 'counter', 'agreed'].includes(event.kind) && event.otd_cents == null && event.itemized == null) problems.push(`a ${event.kind} needs otd_cents or itemized`);
  // The buyer's page prices each car by VIN, so a quote without one would never show.
  if (['quote', 'agreed'].includes(event.kind) && !event.vin) problems.push(`a ${event.kind} needs vin, the 17-character VIN of the car it prices`);
  if (event.kind === 'needs_mason' && !text(event.note, 4000)) problems.push('a needs_mason needs a note saying what Mason has to do');
  if (event.kind === 'resolved' && !(Number.isInteger(event.resolves_event_id) && event.resolves_event_id > 0)) problems.push('a resolved needs resolves_event_id, the id of the needs_mason row it closes');
  if (event.kind !== 'resolved' && event.resolves_event_id != null) problems.push('only a resolved takes resolves_event_id');
  if (event.options != null && (event.kind !== 'needs_mason' || !Array.isArray(event.options) || event.options.length < 1 || event.options.length > 6
    || !event.options.every(option => typeof option === 'string' && option.trim() && option.trim().length <= 60))) {
    problems.push('options is for a needs_mason only: 1 to 6 answers of up to 60 characters each');
  }
  if (event.answer != null && (event.kind !== 'resolved' || typeof event.answer !== 'string' || event.answer.length > 1000)) problems.push('answer is for a resolved only, up to 1000 characters');
  if (event.actor != null && !ACTOR.test(event.actor)) problems.push('actor must be a short name, up to 60 letters, digits, spaces, dots, dashes or underscores');
  if (problems.length) throw new Error(problems.join('; '));
  return {
    onboarding_id: event.intake_id.toLowerCase(),
    kind: event.kind,
    dealer_name: text(event.dealer_name, 200),
    vin: event.vin ? event.vin.toUpperCase() : null,
    otd_cents: event.otd_cents ?? null,
    itemized: event.itemized ?? null,
    note: text(event.note, 4000),
    source_message_id: text(event.source_message_id, 255),
    occurred_at: event.occurred_at ? new Date(event.occurred_at).toISOString() : new Date().toISOString(),
    actor: text(event.actor, 60),
    resolves_event_id: event.resolves_event_id ?? null,
    // A JSON string: postgres.js would send a bare JS array as a Postgres array, not jsonb.
    options: event.options ? JSON.stringify(event.options.map(option => option.trim())) : null,
    answer: text(event.answer, 1000)
  };
}

export async function listDeals(sql) {
  return sql`
    SELECT d.onboarding_id AS intake_id, left(d.onboarding_id::text, 8) AS deal,
      (SELECT title FROM deal_listings l WHERE l.deal_id = d.id ORDER BY rank LIMIT 1) AS top_car,
      (SELECT count(*)::int FROM deal_listings l WHERE l.deal_id = d.id) AS cars,
      e.kind AS last_event, e.dealer_name AS last_dealer, e.occurred_at AS last_event_at
    FROM deals d
    LEFT JOIN LATERAL (SELECT kind, dealer_name, occurred_at FROM deal_events
      WHERE onboarding_id = d.onboarding_id ORDER BY occurred_at DESC, id DESC LIMIT 1) e ON true
    ORDER BY coalesce(e.occurred_at, d.created_at) DESC`;
}

export async function showDeal(sql, id) {
  if (!/^[0-9a-f-]{8,36}$/i.test(id ?? '')) throw new Error(USAGE);
  const deals = await sql`SELECT id, onboarding_id, search_summary, shortlisted_at FROM deals
    WHERE onboarding_id::text LIKE ${id.toLowerCase() + '%'}`;
  if (deals.length !== 1) throw new Error(deals.length ? `${id} matches ${deals.length} deals; give more of the intake ID` : `No deal for ${id}. Deals that never went through /car-search have no row, so log them in Paperclip only.`);
  const [deal] = deals;
  const listings = await sql`SELECT rank, title, vin, price_cents, market_price_cents, target_price_cents, mileage,
      days_on_lot, dealer_name, dealer_location, dealer_email, dealer_phone, listing_url, why
    FROM deal_listings WHERE deal_id = ${deal.id} ORDER BY rank`;
  const events = await sql`SELECT id, occurred_at, kind, actor, dealer_name, vin, otd_cents, itemized, note, options, answer, source_message_id, resolves_event_id
    FROM deal_events WHERE onboarding_id = ${deal.onboarding_id} ORDER BY occurred_at, id`;
  let updates = null;
  try {
    updates = await sql`SELECT id, status, actor, on_masons_say, ready_for_pick, answers_question_id, body,
        created_at, posted_at, emailed_at, retracted_at
      FROM buyer_updates WHERE onboarding_id = ${deal.onboarding_id} ORDER BY created_at, id`;
  } catch (error) {
    // 42P01: db/013 isn't applied yet, so there are no Buyer Updates to show.
    if (error?.code !== '42P01') throw error;
  }
  return { intake_id: deal.onboarding_id, summary: deal.search_summary, shortlisted_at: deal.shortlisted_at, listings, events, updates };
}

// One Buyer Update (db/013). Plain tagged values, no sql(row) helper, so tests can run it on PGlite.
export async function addUpdate(sql, { intakeId, actor, body, post = false, readyForPick = false, answersQuestionId = null } = {}) {
  const problems = [];
  const words = typeof body === 'string' ? body.trim() : '';
  const name = typeof actor === 'string' ? actor.trim() : '';
  const question = answersQuestionId == null || answersQuestionId === '' ? null : Number(answersQuestionId);
  if (!INTAKE_ID.test(intakeId ?? '')) problems.push('the intake ID must be the full intake ID');
  if (!ACTOR.test(name)) problems.push('actor must be the agent\'s short name, up to 60 letters, digits, spaces, dots, dashes or underscores');
  // The ops dashboard signs Mason's own updates; an agent never does.
  else if (name.toLowerCase() === 'mason') problems.push('actor can\'t be mason: use the agent\'s own name');
  if (!words) problems.push('the update needs some text');
  else if ([...words].length > 4000) problems.push('the update must be at most 4000 characters');
  if (question != null && !(Number.isSafeInteger(question) && question > 0)) problems.push('--answers needs a Buyer Question id');
  if (problems.length) throw new Error(problems.join('; '));
  const id = intakeId.toLowerCase();
  const [deal] = await sql`SELECT onboarding_id FROM deals WHERE onboarding_id = ${id}`;
  if (!deal) throw new Error(`No deal for ${id}, so there is no Deal Tracker to post to.`);
  if (question != null) {
    const [asked] = await sql`SELECT id FROM buyer_questions WHERE id = ${question} AND onboarding_id = ${id}`;
    if (!asked) throw new Error(`Buyer Question ${question} isn't on this deal.`);
  }
  // The insert trigger sets posted_at and email_after; on_masons_say is this agent's claim that Mason said to post.
  const [row] = await sql`INSERT INTO buyer_updates (onboarding_id, body, status, ready_for_pick, answers_question_id, actor, on_masons_say)
    VALUES (${id}, ${words}, ${post ? 'posted' : 'draft'}, ${Boolean(readyForPick)}, ${question}, ${name}, ${Boolean(post)})
    RETURNING id, status, posted_at, email_after`;
  return row;
}

// update's arguments after the intake ID: <actor> [--post] [--ready-for-pick] [--answers <id>] <text file | ->
export function parseUpdateArgs(args) {
  const options = { post: false, readyForPick: false, answersQuestionId: null };
  const positional = [];
  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (arg === '--post') options.post = true;
    else if (arg === '--ready-for-pick') options.readyForPick = true;
    else if (arg === '--answers') options.answersQuestionId = args[++index] ?? '';
    else if (arg.startsWith('--')) throw new Error(`Unknown option ${arg}. ${USAGE}`);
    else positional.push(arg);
  }
  if (positional.length !== 2 || options.answersQuestionId === '') throw new Error(USAGE);
  return { actor: positional[0], source: positional[1], ...options };
}

// The agents' queue of Buyer Questions (db/013). Discarded ones never show, and
// held mail shows only once Mason releases it, body or otherwise (adr/0001).
export async function listQuestions(sql, intakeId = null) {
  if (intakeId != null && !INTAKE_ID.test(intakeId)) throw new Error('questions takes the full intake ID, or nothing for every deal');
  const id = intakeId?.toLowerCase() ?? null;
  return sql`SELECT q.id, q.onboarding_id AS intake_id, q.source, q.sender_email, q.body, q.created_at,
      EXISTS (SELECT 1 FROM buyer_updates u WHERE u.answers_question_id = q.id AND u.status = 'posted') AS answered
    FROM buyer_questions q
    WHERE q.discarded_at IS NULL AND (NOT q.held OR q.released_at IS NOT NULL)
      AND (${id}::uuid IS NULL OR q.onboarding_id = ${id}::uuid)
    ORDER BY answered, q.created_at, q.id`;
}

// Standing Buyer Picks (db/013), newest first. Only the website writes them;
// this only reads. A cleared pick (by Mason, or its dealer dropped) never shows.
export async function listPicks(sql, intakeId = null) {
  if (intakeId != null && !INTAKE_ID.test(intakeId)) throw new Error('picks takes the full intake ID, or nothing for every deal');
  const id = intakeId?.toLowerCase() ?? null;
  return sql`SELECT p.id, p.onboarding_id AS intake_id, p.kind, p.vin, p.dealer_name, p.otd_cents, p.created_at,
      (SELECT l.title FROM deal_listings l JOIN deals d ON d.id = l.deal_id
        WHERE d.onboarding_id = p.onboarding_id AND upper(l.vin) = upper(p.vin) ORDER BY l.rank LIMIT 1) AS title
    FROM buyer_picks p
    WHERE p.cleared_at IS NULL AND (${id}::uuid IS NULL OR p.onboarding_id = ${id}::uuid)
    ORDER BY p.created_at DESC, p.id DESC`;
}

export async function logEvents(sql, inputs) {
  const rows = (Array.isArray(inputs) ? inputs : [inputs]).map(parseEvent);
  let added = 0;
  for (const row of rows) {
    const result = await sql`INSERT INTO deal_events ${sql(row, 'onboarding_id', 'kind', 'dealer_name', 'vin', 'otd_cents', 'itemized', 'note', 'source_message_id', 'occurred_at', 'actor', 'resolves_event_id', 'options', 'answer')}
      ON CONFLICT DO NOTHING`;
    added += result.count;
  }
  return { added, skipped_as_already_logged: rows.length - added };
}

export async function recordRun(sql, actor, minutes, note) {
  if (!ACTOR.test(actor ?? '')) throw new Error('ran needs the agent\'s short name, such as duet-inbox');
  const every = minutes == null || minutes === '' ? null : Number(minutes);
  if (every != null && !(Number.isInteger(every) && every >= 1 && every <= 10080)) throw new Error('minutes must be a whole number from 1 to 10080');
  const [row] = await sql`INSERT INTO agent_runs (actor, expect_minutes, note) VALUES (${actor}, ${every}, ${text(note, 1000)}) RETURNING id, ran_at`;
  return row;
}

// Answers Mason gave on the dashboard (or that an agent logged for him) that no
// agent has acked yet. An ack is a note whose source_message_id is 'answer:<id>'.
export async function pendingAnswers(sql, actor = null) {
  return sql`
    SELECT r.id AS resolved_id, r.onboarding_id AS intake_id, r.answer, r.occurred_at AS answered_at,
      q.id AS question_id, q.actor AS asked_by, q.dealer_name, q.note AS question, q.options
    FROM deal_events r JOIN deal_events q ON q.id = r.resolves_event_id
    WHERE r.kind = 'resolved' AND r.answer IS NOT NULL
      AND (${actor}::text IS NULL OR q.actor = ${actor})
      AND NOT EXISTS (SELECT 1 FROM deal_events a WHERE a.source_message_id = 'answer:' || r.id)
    ORDER BY r.occurred_at`;
}

export async function ackAnswer(sql, resolvedId, note) {
  const id = Number(resolvedId);
  if (!Number.isSafeInteger(id) || id <= 0) throw new Error('ack needs the resolved_id from answers');
  const [answer] = await sql`SELECT onboarding_id FROM deal_events WHERE id = ${id} AND kind = 'resolved'`;
  if (!answer) throw new Error(`No resolved event has id ${id}`);
  return logEvents(sql, { intake_id: answer.onboarding_id, kind: 'note', note: note || `Acted on Mason's answer ${id}`, source_message_id: `answer:${id}` });
}

async function main([command, argument, ...rest]) {
  const environment = { ...localEnv(), ...process.env };
  const url = environment.DEAL_DESK_DATABASE_URL?.trim();
  if (!url) throw new Error('DEAL_DESK_DATABASE_URL is not set. It is the paperclip_agent connection string (db/010_paperclip_agent_grants.sql).');
  if (!['deals', 'deal', 'log', 'update', 'questions', 'picks', 'ran', 'answers', 'ack'].includes(command) || (['deal', 'log', 'update', 'ran', 'ack'].includes(command) && !argument)) throw new Error(USAGE);
  const update = command === 'update' ? parseUpdateArgs(rest) : null;
  const read = source => (source === '-' ? new Response(process.stdin).text() : readFile(source, 'utf8'));
  const sql = postgres(url, { max: 1, idle_timeout: 5, connect_timeout: 10, prepare: false, transform: { undefined: null } });
  try {
    if (command === 'deals') return await listDeals(sql);
    if (command === 'deal') return await showDeal(sql, argument);
    if (update) {
      const row = await addUpdate(sql, { intakeId: argument, ...update, body: await read(update.source) });
      return update.post ? { ...row, rule: POST_RULE } : row;
    }
    if (command === 'questions') return await listQuestions(sql, argument ?? null);
    if (command === 'picks') return await listPicks(sql, argument ?? null);
    if (command === 'ran') return await recordRun(sql, argument, /^\d+$/.test(rest[0] ?? '') ? rest.shift() : null, rest.join(' '));
    if (command === 'answers') return await pendingAnswers(sql, argument ?? null);
    if (command === 'ack') return await ackAnswer(sql, argument, rest.join(' '));
    return await logEvents(sql, JSON.parse(await read(argument)));
  } finally {
    await sql.end({ timeout: 5 });
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main(process.argv.slice(2))
    .then(result => console.log(JSON.stringify(result, null, 2)))
    .catch(error => { console.error(error.message); process.exitCode = 1; });
}
