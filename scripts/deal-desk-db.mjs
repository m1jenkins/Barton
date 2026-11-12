import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import postgres from 'postgres';
import { localEnv } from './car-search.mjs';

// Neon access for Paperclip's Deal Desk agent (docs/paperclip-operating-plan-2026-11-11.md):
//   node scripts/deal-desk-db.mjs deals                 every deal with its last logged event
//   node scripts/deal-desk-db.mjs deal <intake ID or its first 8 characters>
//                                                       one deal's shortlist and its full event log
//   node scripts/deal-desk-db.mjs log <events.json | ->  add events to deal_events; a rerun adds nothing twice
// Connects with DEAL_DESK_DATABASE_URL, the paperclip_agent role from db/010, which can read
// every table and insert into deal_events only. Amounts are cents, as in deal_events.
const USAGE = 'Usage: node scripts/deal-desk-db.mjs deals | deal <intake ID> | log <events.json | ->';
export const EVENT_KINDS = ['first_email_sent', 'quote', 'counter', 'agreed', 'dropped', 'note', 'closed', 'reopened'];

const text = (value, max) => (value == null || value === '' ? null : String(value).trim().slice(0, max));

// One deal_events row from the agent's JSON. Throws with every problem at once.
export function parseEvent(input) {
  const problems = [];
  const event = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  if (event !== input) problems.push('each event must be a JSON object');
  if (!/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(event.intake_id ?? '')) problems.push('intake_id must be the full intake ID');
  if (!EVENT_KINDS.includes(event.kind)) problems.push(`kind must be one of ${EVENT_KINDS.join(', ')}`);
  if (event.vin != null && !/^[A-HJ-NPR-Z0-9]{17}$/i.test(event.vin)) problems.push('vin must be 17 characters');
  if (event.otd_cents != null && !(Number.isInteger(event.otd_cents) && event.otd_cents >= 0)) problems.push('otd_cents must be a whole number of cents');
  if (event.itemized != null && (typeof event.itemized !== 'object' || Array.isArray(event.itemized))) problems.push('itemized must be an object of line items in cents');
  if (event.occurred_at != null && Number.isNaN(Date.parse(event.occurred_at))) problems.push('occurred_at must be an ISO date');
  if (['quote', 'counter', 'agreed'].includes(event.kind) && event.otd_cents == null && event.itemized == null) problems.push(`a ${event.kind} needs otd_cents or itemized`);
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
    occurred_at: event.occurred_at ? new Date(event.occurred_at).toISOString() : new Date().toISOString()
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
  const events = await sql`SELECT occurred_at, kind, dealer_name, vin, otd_cents, itemized, note, source_message_id
    FROM deal_events WHERE onboarding_id = ${deal.onboarding_id} ORDER BY occurred_at, id`;
  return { intake_id: deal.onboarding_id, summary: deal.search_summary, shortlisted_at: deal.shortlisted_at, listings, events };
}

export async function logEvents(sql, inputs) {
  const rows = (Array.isArray(inputs) ? inputs : [inputs]).map(parseEvent);
  let added = 0;
  for (const row of rows) {
    const result = await sql`INSERT INTO deal_events ${sql(row, 'onboarding_id', 'kind', 'dealer_name', 'vin', 'otd_cents', 'itemized', 'note', 'source_message_id', 'occurred_at')}
      ON CONFLICT DO NOTHING`;
    added += result.count;
  }
  return { added, skipped_as_already_logged: rows.length - added };
}

async function main([command, argument]) {
  const environment = { ...localEnv(), ...process.env };
  const url = environment.DEAL_DESK_DATABASE_URL?.trim();
  if (!url) throw new Error('DEAL_DESK_DATABASE_URL is not set. It is the paperclip_agent connection string (db/010_paperclip_agent_grants.sql).');
  if (!['deals', 'deal', 'log'].includes(command) || (command !== 'deals' && !argument)) throw new Error(USAGE);
  const sql = postgres(url, { max: 1, idle_timeout: 5, connect_timeout: 10, prepare: false, transform: { undefined: null } });
  try {
    if (command === 'deals') return await listDeals(sql);
    if (command === 'deal') return await showDeal(sql, argument);
    const raw = argument === '-' ? await new Response(process.stdin).text() : await readFile(argument, 'utf8');
    return await logEvents(sql, JSON.parse(raw));
  } finally {
    await sql.end({ timeout: 5 });
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main(process.argv.slice(2))
    .then(result => console.log(JSON.stringify(result, null, 2)))
    .catch(error => { console.error(error.message); process.exitCode = 1; });
}
