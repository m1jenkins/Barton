import { bestPrices, pickStatus } from './deal-view.js';
import { summarizeDeal } from './ops-dashboard.js';

// Buyer Picks (GLOSSARY.md, docs/adr/0002, plan "Decisions": Buyer Pick). Only
// this website code writes them: the buyer picks a car or asks us to keep
// looking on the Deal Tracker (makePick, keepLooking), Mason clears one from the
// ops dashboard (clearPick), and the alerts job clears a pick whose dealer was
// dropped (clearDroppedPicks). Agents read them with scripts/deal-desk-db.mjs.

const iso = ms => new Date(ms).toISOString();
const vinKey = vin => String(vin ?? '').trim().toUpperCase();
const UNIQUE_VIOLATION = '23505';

// The round is opened by the deal's latest posted "ready for your call" update.
// Taking that update back closes it again (or falls back to an older one).
async function openingUpdate(sql, onboardingId) {
  const [update] = await sql`SELECT id FROM buyer_updates
    WHERE onboarding_id = ${onboardingId} AND status = 'posted' AND ready_for_pick
    ORDER BY posted_at DESC, id DESC LIMIT 1`;
  return update ? Number(update.id) : null;
}

const standingFor = (sql, updateId) => sql`SELECT id, kind, vin, dealer_name, otd_cents, created_at FROM buyer_picks
  WHERE opened_by_update_id = ${updateId} AND cleared_at IS NULL`;

// The opening update's id and the pick standing under it, or nulls. The
// caller judges the pick against the log with pickStatus.
export async function openPickRound(sql, onboardingId) {
  const updateId = await openingUpdate(sql, onboardingId);
  if (updateId == null) return { update_id: null, pick: null };
  const [pick] = await standingFor(sql, updateId);
  return { update_id: updateId, pick: pick ?? null };
}

// Everything a pick is checked against, read inside the transaction. The deal
// row is locked so two submits from the same page can't both pass the checks.
async function dealState(tx, onboardingId, now) {
  const [deal] = await tx`SELECT id, onboarding_id, shortlisted_at, created_at FROM deals WHERE onboarding_id = ${onboardingId} FOR UPDATE`;
  if (!deal) return null;
  const listings = await tx`SELECT rank, title, vin, dealer_name, target_price_cents FROM deal_listings WHERE deal_id = ${deal.id} ORDER BY rank`;
  const events = await tx`SELECT id, kind, dealer_name, vin, otd_cents, note, occurred_at
    FROM deal_events WHERE onboarding_id = ${onboardingId} ORDER BY occurred_at, id`;
  const summary = summarizeDeal({ onboarding_id: deal.onboarding_id, shortlisted_at: deal.shortlisted_at, created_at: deal.created_at }, events, listings, now);
  return { listings, events, stage: summary.stage };
}

// The checks both writes share: Quotes in, an open round, nothing standing in
// it. A pick whose dealer was dropped no longer stands, and is cleared here so
// the new row can take its place.
async function openRound(tx, onboardingId, now) {
  const state = await dealState(tx, onboardingId, now);
  if (!state || state.stage !== 'quoted') return { error: 'not_open' };
  const updateId = await openingUpdate(tx, onboardingId);
  if (updateId == null) return { error: 'not_open' };
  for (const pick of await standingFor(tx, updateId)) {
    if (pickStatus(pick, state.listings, state.events).status !== 'dealer_dropped') return { error: 'already_picked' };
    await tx`UPDATE buyer_picks SET cleared_at = ${iso(now)}::timestamptz, cleared_by = 'dealer_dropped' WHERE id = ${pick.id} AND cleared_at IS NULL`;
  }
  return { ...state, updateId };
}

// Both run in one transaction and write nothing unless every check passes. The
// unique index on standing picks backs up the lock: a violation is "already picked".
async function inRound(sql, onboardingId, now, write) {
  try {
    return await sql.begin(async tx => {
      const round = await openRound(tx, onboardingId, now);
      return round.error ? round : write(tx, round);
    });
  } catch (error) {
    if (error?.code === UNIQUE_VIOLATION) return { error: 'already_picked' };
    throw error;
  }
}

// One car, by its shortlist rank, at its Best price so far. The VIN, dealer and
// price come from the log, never the form; expectedCents is the price the buyer
// was shown, so a price that moved in between is refused, not picked.
export function makePick(sql, { onboardingId, rank, expectedCents, now = Date.now() }) {
  return inRound(sql, onboardingId, now, async (tx, { listings, events, updateId }) => {
    const listing = Number.isSafeInteger(rank) ? listings.find(item => Number(item.rank) === rank) : null;
    if (!listing || !vinKey(listing.vin)) return { error: 'no_car' };
    const best = bestPrices(listings, events).get(vinKey(listing.vin));
    if (!best) return { error: 'no_price' };
    if (best.otd_cents !== expectedCents) return { error: 'price_changed', current_cents: best.otd_cents };
    const [row] = await tx`INSERT INTO buyer_picks (onboarding_id, kind, opened_by_update_id, vin, dealer_name, otd_cents, created_at)
      VALUES (${onboardingId}, 'pick', ${updateId}, ${vinKey(listing.vin)}, ${best.dealer_name}, ${best.otd_cents}, ${iso(now)}::timestamptz)
      RETURNING id`;
    return { ok: true, id: Number(row.id) };
  });
}

// "None of these, keep looking": a row with no car, dealer or price.
export function keepLooking(sql, { onboardingId, now = Date.now() }) {
  return inRound(sql, onboardingId, now, async (tx, { updateId }) => {
    const [row] = await tx`INSERT INTO buyer_picks (onboarding_id, kind, opened_by_update_id, created_at)
      VALUES (${onboardingId}, 'keep_looking', ${updateId}, ${iso(now)}::timestamptz) RETURNING id`;
    return { ok: true, id: Number(row.id) };
  });
}

// Mason clears a pick from the ops dashboard. Acts once, on an uncleared row of that deal.
export async function clearPick(sql, id, onboardingId, by = 'mason') {
  const rows = await sql`UPDATE buyer_picks SET cleared_at = now(), cleared_by = ${by}
    WHERE id = ${id} AND onboarding_id = ${onboardingId} AND cleared_at IS NULL RETURNING id`;
  return rows.length === 1;
}

// The alerts job: every standing pick whose dealer was dropped is cleared, so
// the buyer can pick again and no "picked a car" email goes out for it.
export async function clearDroppedPicks(sql) {
  const picks = await sql`SELECT id, onboarding_id, kind, vin, dealer_name, otd_cents, created_at
    FROM buyer_picks WHERE cleared_at IS NULL AND kind = 'pick'`;
  let cleared = 0;
  for (const [onboardingId, rows] of Map.groupBy(picks, pick => String(pick.onboarding_id))) {
    const listings = await sql`SELECT l.rank, l.vin, l.dealer_name FROM deal_listings l JOIN deals d ON d.id = l.deal_id
      WHERE d.onboarding_id = ${onboardingId} ORDER BY l.rank`;
    const events = await sql`SELECT id, kind, dealer_name, vin, otd_cents, occurred_at
      FROM deal_events WHERE onboarding_id = ${onboardingId} ORDER BY occurred_at, id`;
    for (const pick of rows) {
      if (pickStatus(pick, listings, events).status !== 'dealer_dropped') continue;
      const done = await sql`UPDATE buyer_picks SET cleared_at = now(), cleared_by = 'dealer_dropped'
        WHERE id = ${pick.id} AND cleared_at IS NULL RETURNING id`;
      cleared += done.length;
    }
  }
  return cleared;
}
