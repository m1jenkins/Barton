// A deal's prices per car, worked out from its deal_events log alone. Shared by
// the ops dashboard and the buyer's Deal Tracker so both agree on the Best price
// so far (docs/deal-tracker-build-plan-2026-11-21.md, "Best price so far").
// Pure functions: no database, no HTML.

const PRICED = new Set(['quote', 'agreed']);
// A dealer we hear from or write to again is back in the deal after a drop.
const UNDROPS = new Set(['quote', 'agreed', 'first_email_sent', 'email_received']);

export const dealerKey = name => String(name ?? '').trim().toLowerCase();
const vinKey = vin => String(vin ?? '').trim().toUpperCase();
const time = value => new Date(value).getTime();

// Whether a dealer is dropped after one more of their events. summarizeDeal
// uses this too, so the dashboard and the buyer's page drop the same dealers.
export function droppedAfter(dropped, kind) {
  if (kind === 'dropped') return true;
  return UNDROPS.has(kind) ? false : dropped;
}

// Oldest first by occurred_at, then id. Callers pass events in either order.
const chronological = events => [...events].sort((a, b) =>
  time(a.occurred_at) - time(b.occurred_at) || Number(a.id ?? 0) - Number(b.id ?? 0));

// One pass over the log: who is dropped now, plus each event in order with its dealer key.
function replay(events) {
  const dropped = new Map();
  const lastDrop = new Map();
  const ordered = chronological(events).filter(event => dealerKey(event.dealer_name)).map((event, order) => {
    const key = dealerKey(event.dealer_name);
    dropped.set(key, droppedAfter(dropped.get(key) ?? false, event.kind));
    if (event.kind === 'dropped') lastDrop.set(key, order);
    return { event, key, order };
  });
  // A drop withdraws the dealer's prices: only what they quote after it stands.
  return { ordered, isDropped: key => dropped.get(key) === true, withdrawn: entry => entry.order < (lastDrop.get(entry.key) ?? -1) };
}

const shortlistVins = listings => new Set(listings.map(item => vinKey(item.vin)).filter(Boolean));

// Each shortlisted car's Best price so far, keyed by upper-cased VIN: the lowest
// of each standing dealer's latest written price on that car. A raised price
// replaces the dealer's lower one; counters are ours and never count. A dealer
// who comes back after being dropped has to quote again before a price shows.
export function bestPrices(listings, events) {
  const vins = shortlistVins(listings);
  const { ordered, isDropped, withdrawn } = replay(events);
  const latest = new Map();
  for (const entry of ordered) {
    const { event, key } = entry;
    const vin = vinKey(event.vin);
    if (!PRICED.has(event.kind) || event.otd_cents == null || !vins.has(vin)) continue;
    latest.set(`${key} ${vin}`, { ...entry, vin });
  }
  const best = new Map();
  for (const entry of latest.values()) {
    if (isDropped(entry.key) || withdrawn(entry)) continue;
    const held = best.get(entry.vin);
    if (held && (held.event.otd_cents < entry.event.otd_cents || (held.event.otd_cents === entry.event.otd_cents && held.order < entry.order))) continue;
    best.set(entry.vin, entry);
  }
  return new Map([...best].map(([vin, { event }]) => [vin, {
    otd_cents: event.otd_cents, dealer_name: event.dealer_name.trim(), occurred_at: event.occurred_at
  }]));
}

// The price agreed on this deal: the latest 'agreed' from a dealer still in it.
export function agreedOffer(listings, events) {
  const vins = shortlistVins(listings);
  const { ordered, isDropped, withdrawn } = replay(events);
  const agreed = ordered.filter(entry => entry.event.kind === 'agreed' && !isDropped(entry.key) && !withdrawn(entry)).at(-1);
  if (!agreed) return null;
  const vin = vinKey(agreed.event.vin);
  return { vin: vins.has(vin) ? vin : null, dealer_name: agreed.event.dealer_name.trim(), otd_cents: agreed.event.otd_cents ?? null, occurred_at: agreed.event.occurred_at };
}

// Every dealer named on the shortlist or in the log, once each, as first written.
export function dealerNames(listings, events) {
  const names = new Map();
  for (const name of [...listings.map(item => item.dealer_name), ...events.map(event => event.dealer_name)]) {
    const key = dealerKey(name);
    if (key && !names.has(key)) names.set(key, String(name).trim());
  }
  return [...names.values()];
}
