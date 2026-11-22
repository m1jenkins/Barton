import { createHash, timingSafeEqual } from 'node:crypto';
import { ConfigError } from './config.js';

// Mason's private deal dashboard at /api/ops (docs/implementation-operations.md,
// "Ops dashboard"). Everything on it is read from Neon: the deals opened at paid
// intake or by the /car-search skill and the deal_events log his agents add to.
// It only ever writes one thing, a 'resolved' row when Mason marks a needs_mason item done.

const STALE_DAYS = 2;
const TIME_ZONE = 'America/Chicago';
const DEALER_KINDS = new Set(['quote', 'email_received', 'agreed']);
const KIND_LABELS = Object.freeze({
  first_email_sent: 'First email sent', quote: 'Quote', counter: 'Counter', agreed: 'Agreed', dropped: 'Dropped',
  note: 'Note', closed: 'Closed', reopened: 'Reopened', email_received: 'Dealer email', form_submitted: 'Form submitted',
  needs_mason: 'Needs you', resolved: 'Resolved'
});
const STAGES = Object.freeze({
  confirming: 'Confirming search', shortlisted: 'Shortlisted', emailing: 'Emailing dealers', quoted: 'Quotes in', agreed: 'Price agreed', closed: 'Closed'
});
const TIERS = Object.freeze({ consultation: 'Consultation', full_service: 'Full service', concierge: 'Concierge' });

// OPS_PASSWORD turns the dashboard on. Unset, it answers 503; too short, it fails loudly.
export function opsPassword(environment = process.env) {
  const value = environment.OPS_PASSWORD?.trim();
  if (!value) return null;
  if (value.length < 24) throw new ConfigError('OPS_PASSWORD must be at least 24 characters');
  return value;
}

const digest = value => createHash('sha256').update(value).digest();

// HTTP Basic auth: any user name, the password must match OPS_PASSWORD.
export function isAuthorized(authorization, password) {
  const match = /^Basic\s+([A-Za-z0-9+/=]+)$/.exec(authorization || '');
  if (!match) return false;
  const decoded = Buffer.from(match[1], 'base64').toString('utf8');
  const colon = decoded.indexOf(':');
  if (colon < 0) return false;
  return timingSafeEqual(digest(decoded.slice(colon + 1)), digest(password));
}

export async function loadDashboard(sql) {
  const [needs, drafts, waiting, deals, events, activity, leads, runs, logged] = await Promise.all([
    sql`SELECT e.id, e.onboarding_id, e.note, e.options, e.actor, e.dealer_name, e.occurred_at, o.name
      FROM deal_events e JOIN onboarding_submissions o ON o.id = e.onboarding_id
      WHERE e.kind = 'needs_mason' AND NOT EXISTS (SELECT 1 FROM deal_events r WHERE r.resolves_event_id = e.id)
      ORDER BY e.occurred_at, e.id`,
    sql`SELECT d.dealer_name, d.status, d.created_at, d.last_error, o.name, deals.onboarding_id
      FROM dealer_email_drafts d JOIN deals ON deals.id = d.deal_id JOIN onboarding_submissions o ON o.id = deals.onboarding_id
      WHERE d.status IN ('pending', 'failed') ORDER BY d.created_at`,
    // Paid intakes still waiting for a car search: no deal yet (before the Deal
    // Tracker, or the switch off) or a deal in Confirming search, unless Mason closed it.
    sql`SELECT o.id, o.name, o.city, o.tier_id, o.created_at, o.fields->>'preferred_makes' AS wants
      FROM onboarding_submissions o LEFT JOIN deals d ON d.onboarding_id = o.id
      WHERE d.shortlisted_at IS NULL AND o.created_at > now() - interval '60 days'
        AND (SELECT e.kind FROM deal_events e WHERE e.onboarding_id = o.id AND e.kind IN ('closed', 'reopened')
          ORDER BY e.occurred_at DESC, e.id DESC LIMIT 1) IS DISTINCT FROM 'closed'
      ORDER BY o.created_at`,
    sql`SELECT d.id, d.onboarding_id, d.created_at, d.shortlisted_at, o.name, o.city, o.tier_id
      FROM deals d JOIN onboarding_submissions o ON o.id = d.onboarding_id
      WHERE d.created_at > now() - interval '180 days' ORDER BY d.created_at DESC`,
    sql`SELECT e.onboarding_id, e.kind, e.dealer_name, e.vin, e.otd_cents, e.note, e.occurred_at
      FROM deal_events e JOIN deals d ON d.onboarding_id = e.onboarding_id
      WHERE d.created_at > now() - interval '180 days' ORDER BY e.occurred_at, e.id`,
    sql`SELECT e.onboarding_id, e.kind, e.dealer_name, e.otd_cents, e.occurred_at, o.name
      FROM deal_events e JOIN onboarding_submissions o ON o.id = e.onboarding_id
      WHERE e.occurred_at > now() - interval '7 days' AND e.kind <> 'resolved'
      ORDER BY e.occurred_at DESC, e.id DESC LIMIT 400`,
    sql`SELECT name, vehicle, message, source_page, created_at FROM leads
      WHERE created_at > now() - interval '14 days' ORDER BY created_at DESC LIMIT 30`,
    loadRuns(sql),
    loadLogged(sql)
  ]);
  const listings = deals.length ? await sql`SELECT deal_id, rank, title, vin, price_cents, target_price_cents
    FROM deal_listings WHERE deal_id IN (SELECT id FROM deals WHERE created_at > now() - interval '180 days') ORDER BY deal_id, rank` : [];
  return { needs, drafts, waiting, deals, events, activity, leads, listings, agents: agentStatus(runs, logged) };
}

export const loadRuns = sql => sql`SELECT DISTINCT ON (actor) actor, ran_at AS last_run, expect_minutes, note
  FROM agent_runs WHERE ran_at > now() - interval '30 days' ORDER BY actor, ran_at DESC`;
export const loadLogged = sql => sql`SELECT actor, max(occurred_at) AS last_logged FROM deal_events
  WHERE actor IS NOT NULL AND actor <> 'mason' AND occurred_at > now() - interval '30 days' GROUP BY actor`;

// Each agent seen in the last 30 days: when it last ran (agent_runs) and last
// logged a deal event. Overdue once it has missed two of its stated runs.
export function agentStatus(runs, logged, now = Date.now()) {
  const agents = new Map();
  for (const run of runs) agents.set(run.actor, { actor: run.actor, last_run: run.last_run, expect_minutes: run.expect_minutes, note: run.note, last_logged: null });
  for (const row of logged) {
    const agent = agents.get(row.actor) ?? { actor: row.actor, last_run: null, expect_minutes: null, note: null };
    agents.set(row.actor, { ...agent, last_logged: row.last_logged });
  }
  return [...agents.values()].map(agent => {
    const due = agent.expect_minutes && agent.last_run ? time(agent.last_run) + (agent.expect_minutes * 2 + 5) * 60000 : null;
    return { ...agent, overdue: due != null && now > due };
  }).sort((a, b) => Number(b.overdue) - Number(a.overdue) || a.actor.localeCompare(b.actor));
}

export async function loadDeal(sql, onboardingId) {
  const [deal] = await sql`SELECT d.id, d.onboarding_id, d.search_summary, d.created_at, d.shortlisted_at, o.name, o.city, o.tier_id
    FROM deals d JOIN onboarding_submissions o ON o.id = d.onboarding_id WHERE d.onboarding_id = ${onboardingId}`;
  if (!deal) return null;
  const [listings, events, drafts] = await Promise.all([
    sql`SELECT rank, title, vin, price_cents, market_price_cents, target_price_cents, walk_away_cents, mileage, days_on_lot,
        dealer_name, dealer_location, listing_url FROM deal_listings WHERE deal_id = ${deal.id} ORDER BY rank`,
    sql`SELECT id, kind, actor, dealer_name, vin, otd_cents, note, options, answer, resolves_event_id, occurred_at
      FROM deal_events WHERE onboarding_id = ${onboardingId} ORDER BY occurred_at DESC, id DESC`,
    sql`SELECT dealer_name, status, created_at, sent_at, last_error FROM dealer_email_drafts WHERE deal_id = ${deal.id} ORDER BY created_at`
  ]);
  return { deal, listings, events, drafts };
}

// A needs_mason row that is still open, or null. Used before logging 'resolved'.
export async function resolveNeed(sql, eventId, answer = null) {
  return sql.begin(async tx => {
    const [need] = await tx`SELECT id, onboarding_id FROM deal_events
      WHERE id = ${eventId} AND kind = 'needs_mason'
        AND NOT EXISTS (SELECT 1 FROM deal_events r WHERE r.resolves_event_id = ${eventId})
      FOR UPDATE`;
    if (!need) return false;
    await tx`INSERT INTO deal_events (onboarding_id, kind, actor, resolves_event_id, answer, note)
      VALUES (${need.onboarding_id}, 'resolved', 'mason', ${need.id}, ${answer || null},
        ${answer ? 'Answered on the ops dashboard' : 'Marked done on the ops dashboard'})`;
    return true;
  });
}

export const OUTCOMES = Object.freeze(['Bought', 'Buyer walked away', 'Refunded', 'Other']);
export const DEAL_EDITS = Object.freeze(['close', 'reopen', 'agreed', 'drop', 'note']);

// "$32,300", "32300" or "32,300.50" to cents; null if it isn't a sensible car price.
export function dollarsToCents(text) {
  const cleaned = String(text ?? '').replace(/[$,\s]/g, '');
  if (!/^\d{1,7}(\.\d{1,2})?$/.test(cleaned)) return null;
  const cents = Math.round(Number(cleaned) * 100);
  return cents >= 100000 && cents <= 100000000 ? cents : null;
}

// Mason's own update to a deal, from the form on its page. Adds one deal_events
// row with actor 'mason'; returns an error message instead when the form is incomplete.
export async function editDeal(sql, onboardingId, form) {
  const edit = form.edit;
  if (!DEAL_EDITS.includes(edit)) return { error: 'Unknown change' };
  const [deal] = await sql`SELECT d.id FROM deals d WHERE d.onboarding_id = ${onboardingId}`;
  if (!deal) return { error: 'No such deal' };
  const text = value => String(value ?? '').trim().replace(/\s+/g, ' ');
  const note = text(form.note).slice(0, 1000) || null;
  const dealer = text(form.dealer).slice(0, 200) || null;
  const row = { kind: edit, dealer: null, vin: null, otd: null, note };
  if (edit === 'close') {
    const outcome = OUTCOMES.includes(form.outcome) ? form.outcome : 'Other';
    row.kind = 'closed';
    row.note = note ? `${outcome}: ${note}` : outcome;
  } else if (edit === 'reopen') {
    row.kind = 'reopened';
  } else if (edit === 'agreed') {
    row.otd = dollarsToCents(form.otd);
    if (!dealer || row.otd == null) return { error: 'Price agreed needs the dealer and the out-the-door price' };
    row.dealer = dealer;
    const [listing] = form.vin ? await sql`SELECT vin FROM deal_listings WHERE deal_id = ${deal.id} AND vin = ${String(form.vin)}` : [];
    row.vin = listing?.vin ?? null;
  } else if (edit === 'drop') {
    if (!dealer) return { error: 'Pick the dealer to drop' };
    row.kind = 'dropped';
    row.dealer = dealer;
  } else if (edit === 'note' && !note) {
    return { error: 'The note is empty' };
  }
  await sql`INSERT INTO deal_events (onboarding_id, kind, actor, dealer_name, vin, otd_cents, note)
    VALUES (${onboardingId}, ${row.kind}, 'mason', ${row.dealer}, ${row.vin}, ${row.otd}, ${row.note})`;
  return { ok: true };
}

const time = value => new Date(value).getTime();

// One deal's state, worked out from its event log alone.
export function summarizeDeal(deal, events, listings, now = Date.now()) {
  const dealers = new Map();
  let closed = false;
  let outcome = null;
  let lastActivity = time(deal.shortlisted_at || deal.created_at);
  let lastDealer = null;
  let emailed = false;
  for (const event of events) {
    lastActivity = Math.max(lastActivity, time(event.occurred_at));
    if (event.kind === 'closed') [closed, outcome] = [true, event.note ?? null];
    if (event.kind === 'reopened') [closed, outcome] = [false, null];
    if (event.kind === 'first_email_sent') emailed = true;
    if (DEALER_KINDS.has(event.kind)) lastDealer = Math.max(lastDealer ?? 0, time(event.occurred_at));
    if (!event.dealer_name) continue;
    const key = event.dealer_name.trim().toLowerCase();
    const dealer = dealers.get(key) ?? { name: event.dealer_name, quote: null, vin: null, agreed: false, dropped: false };
    if (['quote', 'agreed'].includes(event.kind) && event.otd_cents != null) {
      dealer.quote = event.otd_cents;
      dealer.vin = event.vin;
    }
    if (event.kind === 'agreed') dealer.agreed = true;
    if (event.kind === 'dropped') dealer.dropped = true;
    if (['quote', 'agreed', 'first_email_sent', 'email_received'].includes(event.kind)) dealer.dropped = false;
    dealers.set(key, dealer);
  }
  const live = [...dealers.values()].filter(dealer => !dealer.dropped);
  const quoted = live.filter(dealer => dealer.quote != null).sort((a, b) => a.quote - b.quote);
  const best = quoted[0] ?? null;
  const agreed = live.find(dealer => dealer.agreed) ?? null;
  const pick = agreed ?? best;
  const listing = (pick?.vin && listings.find(item => item.vin === pick.vin)) || listings[0] || null;
  // A deal opened at paid intake is in Confirming search until its shortlist arrives.
  const stage = closed ? 'closed' : agreed ? 'agreed' : quoted.length ? 'quoted' : !deal.shortlisted_at ? 'confirming'
    : emailed || dealers.size ? 'emailing' : 'shortlisted';
  const quietDays = Math.floor((now - lastActivity) / 86400000);
  return {
    onboarding_id: deal.onboarding_id, name: deal.name, city: deal.city, tier_id: deal.tier_id,
    car: listing?.title ?? null, cars: listings.length, target_cents: listing?.target_price_cents ?? null,
    best_cents: pick?.quote ?? null, best_dealer: pick?.name ?? null,
    dealers: dealers.size, quotes: quoted.length, stage, closed, outcome,
    live_dealers: live.map(dealer => dealer.name),
    last_activity: new Date(lastActivity), last_dealer: lastDealer ? new Date(lastDealer) : null,
    // A confirming deal is already under "Needs you" as waiting for a car search.
    quiet_days: quietDays, stale: !closed && !['confirming', 'shortlisted'].includes(stage) && quietDays >= STALE_DAYS
  };
}

export function summarizeDeals({ deals, events, listings }, now = Date.now()) {
  const eventsByDeal = Map.groupBy(events, event => event.onboarding_id);
  const listingsByDeal = Map.groupBy(listings, listing => listing.deal_id);
  return deals.map(deal => summarizeDeal(deal, eventsByDeal.get(deal.onboarding_id) ?? [], listingsByDeal.get(deal.id) ?? [], now));
}

// ---------- HTML ----------

const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
// Markup built by safe`` stays as it is when nested in another safe``; every other value is escaped.
class Safe {
  constructor(text) { this.text = text; }
  toString() { return this.text; }
}
const raw = text => new Safe(text);
const safe = (strings, ...values) => new Safe(strings.reduce((out, part, index) => {
  const value = values[index - 1];
  return out + (value instanceof Safe ? value.text : escapeHtml(value)) + part;
}));
const join = (items, render) => new Safe(items.map(item => String(render(item))).join(''));

const money = cents => (cents == null ? '—' : `$${Math.round(cents / 100).toLocaleString('en-US')}`);
const absolute = value => new Intl.DateTimeFormat('en-US', { timeZone: TIME_ZONE, dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
function ago(value, now) {
  const minutes = Math.max(0, Math.round((now - time(value)) / 60000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}
const when = (value, now) => safe`<time datetime="${new Date(value).toISOString()}" title="${absolute(value)}">${ago(value, now)}</time>`;
const dealLink = (id, name) => safe`<a href="/api/ops?deal=${id}">${name}</a>`;
const clip = (text, max) => (text && text.length > max ? `${text.slice(0, max - 1)}…` : text ?? '');

function versus(best, target) {
  if (best == null || target == null) return '';
  const diff = best - target;
  if (diff === 0) return safe` <span class="tag good">at target</span>`;
  return diff < 0
    ? safe` <span class="tag good">${money(-diff)} under</span>`
    : safe` <span class="tag warn">${money(diff)} over</span>`;
}

function page(title, body, { refresh = true } = {}) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow, noarchive">
${refresh ? '<meta http-equiv="refresh" content="120">' : ''}
<title>${escapeHtml(title)}</title>
<style>${STYLES}</style>
</head>
<body>
${body}
</body>
</html>`;
}

const STYLES = `
:root{--bg:#f6f6f4;--card:#fff;--text:#1b1d1f;--muted:#6a6f75;--line:#e3e3df;--accent:#1f5fbf;--good:#1d7a46;--good-bg:#e4f4ea;--warn:#a2410c;--warn-bg:#fcebdc;--chip:#eef0f2;color-scheme:light}
@media (prefers-color-scheme:dark){:root{--bg:#141618;--card:#1d2023;--text:#e8e9ea;--muted:#9aa0a6;--line:#2e3236;--accent:#7fb0ff;--good:#7fd6a2;--good-bg:#173323;--warn:#ffb27a;--warn-bg:#3a2414;--chip:#2a2e32;color-scheme:dark}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--text);font:15px/1.45 system-ui,-apple-system,"Segoe UI",sans-serif;padding:20px 16px 48px;max-width:1180px;margin-inline:auto}
h1{font-size:20px;margin:0}
h2{font-size:13px;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);margin:28px 0 10px}
a{color:var(--accent);text-decoration:none}a:hover{text-decoration:underline}
header{display:flex;justify-content:space-between;align-items:baseline;gap:12px;flex-wrap:wrap}
.muted{color:var(--muted)}
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px;margin-top:16px}
.stat{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:12px 14px}
.stat b{display:block;font-size:24px;font-variant-numeric:tabular-nums}
.card{background:var(--card);border:1px solid var(--line);border-radius:10px;overflow:hidden}
.list{list-style:none;margin:0;padding:0}
.list li{padding:12px 14px;border-top:1px solid var(--line);display:flex;gap:12px;align-items:flex-start;justify-content:space-between}
.list li:first-child{border-top:0}
.list .main{min-width:0}
.list p{margin:2px 0 0;overflow-wrap:anywhere}
.empty{padding:14px;color:var(--muted)}
.scroll{overflow-x:auto}
table{border-collapse:collapse;width:100%;font-variant-numeric:tabular-nums}
th,td{text-align:left;padding:10px 14px;border-top:1px solid var(--line);vertical-align:top}
td.wide{min-width:150px}
th{font-size:12px;color:var(--muted);font-weight:600;border-top:0;white-space:nowrap}
td.num,th.num{text-align:right;white-space:nowrap}
.tag{display:inline-block;font-size:12px;padding:1px 8px;border-radius:999px;background:var(--chip);white-space:nowrap}
.tag.good{background:var(--good-bg);color:var(--good)}
.tag.warn{background:var(--warn-bg);color:var(--warn)}
button{font:inherit;font-size:13px;padding:5px 12px;border-radius:8px;border:1px solid var(--line);background:var(--chip);color:var(--text);cursor:pointer}
button:hover{border-color:var(--muted)}
button.primary{background:var(--accent);border-color:var(--accent);color:var(--card)}
form.answer{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px;align-items:center}
form.answer input[type=text]{font:inherit;font-size:13px;padding:5px 9px;border-radius:8px;border:1px solid var(--line);background:var(--bg);color:var(--text);flex:1 1 180px;min-width:0}
details summary{cursor:pointer;color:var(--muted);padding:10px 0}
.nowrap{white-space:nowrap}
.tiles{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:12px}
.tile{display:flex;flex-direction:column;gap:8px;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:14px;color:var(--text)}
.tile:hover{text-decoration:none;border-color:var(--accent);box-shadow:0 2px 10px rgba(0,0,0,.06)}
.tile.stale{border-color:var(--warn)}
.tile-top{display:flex;gap:10px;align-items:center}
.tile-name{display:flex;flex-direction:column;min-width:0;line-height:1.25}
.tile-name .muted{font-size:13px}
.tile-car{font-size:14px}
.tile-price{font-variant-numeric:tabular-nums}
.tile-foot{display:flex;gap:6px;align-items:center;flex-wrap:wrap;font-size:13px}
.tile-foot .muted{margin-left:auto}
.icon{flex:none;display:grid;place-items:center;width:40px;height:40px;border-radius:50%;background:var(--chip);color:var(--muted)}
.icon.s-emailing{background:#e6eefb;color:var(--accent)}
.icon.s-quoted{background:var(--warn-bg);color:var(--warn)}
.icon.s-agreed{background:var(--good-bg);color:var(--good)}
@media (prefers-color-scheme:dark){.icon.s-emailing{background:#1b2a42}}
h3.day{font-size:12px;font-weight:600;color:var(--muted);margin:0;padding:8px 14px;background:var(--bg);border-top:1px solid var(--line)}
h3.day:first-child{border-top:0}
.list.compact li{padding:8px 14px;align-items:center}
.list.compact li:first-child{border-top:1px solid var(--line)}
.note{margin:4px 0 0;font-size:14px;color:var(--muted)}
details.note summary{padding:0;color:var(--muted)}
details.note p{color:var(--text);white-space:pre-wrap}
.edit{padding:4px 14px}
.edit form.row{display:flex;flex-wrap:wrap;gap:8px;align-items:center;padding:10px 0;border-top:1px solid var(--line)}
.edit form.row:first-child{border-top:0}
.edit label{display:flex;gap:8px;align-items:center;font-size:14px;font-weight:600}
.edit label.grow{flex:1 1 260px}
.edit input,.edit select{font:inherit;font-size:13px;padding:5px 9px;border-radius:8px;border:1px solid var(--line);background:var(--bg);color:var(--text);font-weight:400;min-width:0}
.edit label.grow input{flex:1}
.edit input.money{width:130px}
@media (max-width:640px){.hide-sm{display:none}th,td{padding:9px 10px}}
`;

const optionList = options => (Array.isArray(options) ? options : typeof options === 'string' ? (() => { try { return JSON.parse(options); } catch { return []; } })() : [])
  .filter(option => typeof option === 'string' && option.trim()).slice(0, 6);

// Mason answers a needs_mason here: one button per option the agent offered, or
// a typed reply, or just Done. The agent reads the answer with `deal-desk-db.mjs answers`.
function needForm(need, back = null) {
  return safe`<form method="post" action="/api/ops" class="answer">
    <input type="hidden" name="resolve" value="${need.id}">${back ? safe`<input type="hidden" name="back" value="${back}">` : ''}
    ${join(optionList(need.options), option => safe`<button type="submit" name="answer" value="${option}" class="primary">${option}</button>`)}
    <input type="text" name="reply" maxlength="1000" placeholder="${optionList(need.options).length ? 'Or type a reply' : 'Reply (optional)'}" aria-label="Reply to the agent">
    <button type="submit">Done</button></form>`;
}

function needsSection(data, summaries, now) {
  const items = [
    ...data.needs.map(need => ({ group: 0, at: need.occurred_at, html: safe`<li><div class="main">
      <strong>${dealLink(need.onboarding_id, need.name)}</strong>${need.dealer_name ? safe` <span class="muted">· ${need.dealer_name}</span>` : ''}
      <p>${need.note}</p>
      <p class="muted">${need.actor || 'agent'} · ${when(need.occurred_at, now)}</p>${needForm(need)}</div></li>` })),
    ...data.drafts.map(draft => ({ group: 1, at: draft.created_at, html: safe`<li><div class="main">
      <strong>${dealLink(draft.onboarding_id, draft.name)}</strong> <span class="muted">· ${draft.dealer_name}</span>
      <p>${draft.status === 'failed' ? safe`First email failed to send${draft.last_error ? `: ${draft.last_error}` : ''}` : 'First email is waiting for your approval'}</p>
      <p class="muted">${when(draft.created_at, now)}</p></div>
      <span class="tag ${draft.status === 'failed' ? 'warn' : ''}">${draft.status === 'failed' ? 'Failed' : 'To approve'}</span></li>` })),
    ...data.waiting.map(intake => ({ group: 2, at: intake.created_at, html: safe`<li><div class="main">
      <strong>${intake.name}</strong> <span class="muted">· ${intake.city}</span>
      <p>Paid intake with no car search yet${intake.wants ? `: ${clip(intake.wants, 120)}` : ''}</p>
      <p class="muted">${TIERS[intake.tier_id] ?? intake.tier_id} · ${when(intake.created_at, now)} · <code>${intake.id}</code></p></div>
      <span class="tag">Run /car-search</span></li>` })),
    ...(data.agents ?? []).filter(agent => agent.overdue).map(agent => ({ group: 3, at: agent.last_run, html: safe`<li><div class="main">
      <strong>${agent.actor}</strong>
      <p>Hasn't run since ${absolute(agent.last_run)}; it said it runs every ${agent.expect_minutes} minutes</p>
      <p class="muted">Last run ${when(agent.last_run, now)}</p></div>
      <span class="tag warn">Agent overdue</span></li>` })),
    ...summaries.filter(deal => deal.stale).map(deal => ({ group: 4, at: deal.last_activity, html: safe`<li><div class="main">
      <strong>${dealLink(deal.onboarding_id, deal.name)}</strong> <span class="muted">· ${STAGES[deal.stage]}</span>
      <p>Nothing logged for ${deal.quiet_days} days${deal.car ? ` on the ${deal.car}` : ''}</p>
      <p class="muted">Last activity ${when(deal.last_activity, now)}</p></div>
      <span class="tag warn">Quiet</span></li>` }))
  ].sort((a, b) => a.group - b.group || time(a.at) - time(b.at));
  return safe`<h2>Needs you (${items.length})</h2><div class="card">${items.length
    ? safe`<ul class="list">${join(items, item => item.html)}</ul>`
    : raw('<p class="empty">Nothing is waiting on you.</p>')}</div>`;
}

function agentsSection(agents, now) {
  if (!agents?.length) return raw('');
  return safe`<h2>Agents (${agents.length})</h2><div class="card scroll"><table>
    <thead><tr><th>Agent</th><th class="num">Last run</th><th class="num hide-sm">Runs every</th><th class="num">Last logged</th><th class="hide-sm">Last note</th></tr></thead>
    <tbody>${join(agents, agent => safe`<tr>
      <td class="wide"><strong>${agent.actor}</strong>${agent.overdue ? raw(' <span class="tag warn">Overdue</span>') : ''}</td>
      <td class="num">${agent.last_run ? when(agent.last_run, now) : raw('<span class="muted">never</span>')}</td>
      <td class="num hide-sm">${agent.expect_minutes ? `${agent.expect_minutes} min` : '—'}</td>
      <td class="num">${agent.last_logged ? when(agent.last_logged, now) : '—'}</td>
      <td class="hide-sm muted">${clip(agent.note, 120)}</td></tr>`)}</tbody></table></div>`;
}

function dealsTable(rows, now) {
  if (!rows.length) return raw('<div class="card"><p class="empty">No deals.</p></div>');
  return safe`<div class="card scroll"><table>
    <thead><tr><th>Buyer</th><th class="hide-sm">Car</th><th>How it ended</th><th class="num">Price</th><th class="num">Closed</th></tr></thead>
    <tbody>${join(rows, deal => safe`<tr>
      <td class="wide">${dealLink(deal.onboarding_id, deal.name)}<br><span class="muted">${deal.city}</span></td>
      <td class="hide-sm wide">${deal.car ?? '—'}</td>
      <td class="wide">${clip(deal.outcome, 90) || '—'}</td>
      <td class="num">${money(deal.best_cents)}${deal.best_dealer ? safe`<br><span class="muted">${deal.best_dealer}</span>` : ''}</td>
      <td class="num">${when(deal.last_activity, now)}</td></tr>`)}</tbody></table></div>`;
}

const CAR_ICON = raw('<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 17v-4l2.2-5A2 2 0 0 1 7 6.8h10a2 2 0 0 1 1.8 1.2L21 13v4"/><path d="M3 13h18M5 17h14"/><circle cx="7.5" cy="17" r="1.8"/><circle cx="16.5" cy="17" r="1.8"/></svg>');

// One clickable tile per open deal; the whole tile opens the deal's page.
function dealTiles(rows, now) {
  if (!rows.length) return raw('<div class="card"><p class="empty">No open deals.</p></div>');
  return safe`<div class="tiles">${join(rows, deal => safe`<a class="tile${deal.stale ? ' stale' : ''}" href="/api/ops?deal=${deal.onboarding_id}">
    <span class="tile-top"><span class="icon s-${deal.stage}">${CAR_ICON}</span>
      <span class="tile-name"><strong>${deal.name}</strong><span class="muted">${deal.city}</span></span></span>
    <span class="tile-car">${deal.car ?? 'No car picked yet'}${deal.cars > 1 ? safe` <span class="muted">+${deal.cars - 1}</span>` : ''}</span>
    <span class="tile-price">${deal.best_cents != null ? safe`<strong>${money(deal.best_cents)}</strong>${versus(deal.best_cents, deal.target_cents)}`
      : deal.stage === 'confirming' ? raw('<span class="muted">Search not run yet</span>') : safe`<span class="muted">Target ${money(deal.target_cents)}</span>`}</span>
    <span class="tile-foot"><span class="tag ${deal.stage === 'agreed' ? 'good' : ''}">${STAGES[deal.stage]}</span>${deal.stale ? safe` <span class="tag warn">Quiet ${deal.quiet_days}d</span>` : ''}
      <span class="muted">${when(deal.last_activity, now)}</span></span></a>`)}</div>`;
}

const dayKey = value => new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE }).format(new Date(value));
function dayLabel(value, now) {
  const key = dayKey(value);
  if (key === dayKey(now)) return 'Today';
  if (key === dayKey(now - 86400000)) return 'Yesterday';
  return new Intl.DateTimeFormat('en-US', { timeZone: TIME_ZONE, weekday: 'short', month: 'short', day: 'numeric' }).format(new Date(value));
}
const plural = (count, label) => (count > 1 ? `${count} × ${label}` : label);

// The last week, one line per deal per day: what kinds of thing happened and
// the best price seen. Notes stay on the deal's own page.
export function groupActivity(events, now = Date.now()) {
  const days = new Map();
  for (const event of events) {
    const label = dayLabel(event.occurred_at, now);
    const deals = days.get(label) ?? new Map();
    const line = deals.get(event.onboarding_id) ?? { onboarding_id: event.onboarding_id, name: event.name, kinds: new Map(), dealers: new Set(), best: null, last: event.occurred_at };
    line.kinds.set(event.kind, (line.kinds.get(event.kind) ?? 0) + 1);
    if (event.dealer_name) line.dealers.add(event.dealer_name);
    if (['quote', 'agreed'].includes(event.kind) && event.otd_cents != null) line.best = Math.min(line.best ?? Infinity, event.otd_cents);
    if (time(event.occurred_at) > time(line.last)) line.last = event.occurred_at;
    deals.set(event.onboarding_id, line);
    days.set(label, deals);
  }
  return [...days].map(([label, deals]) => ({ label, lines: [...deals.values()] }));
}

const kindTone = kind => (kind === 'needs_mason' ? 'warn' : ['agreed', 'closed'].includes(kind) ? 'good' : '');

function activitySection(events, now) {
  const days = groupActivity(events, now);
  if (!days.length) return raw('<div class="card"><p class="empty">Nothing happened in the last 7 days.</p></div>');
  return safe`<div class="card">${join(days, day => safe`<h3 class="day">${day.label}</h3><ul class="list compact">${join(day.lines, line => {
    const dealers = [...line.dealers];
    return safe`<li><div class="main"><strong>${dealLink(line.onboarding_id, line.name)}</strong>
      ${join([...line.kinds], ([kind, count]) => safe` <span class="tag ${kindTone(kind)}">${plural(count, KIND_LABELS[kind] ?? kind)}</span>`)}
      ${line.best != null ? safe` · <strong>${money(line.best)}</strong>` : ''}${dealers.length ? safe` <span class="muted hide-sm">· ${clip(dealers.join(', '), 70)}</span>` : ''}</div>
      <span class="muted nowrap">${when(line.last, now)}</span></li>`;
  })}</ul>`)}</div>`;
}

// A note on one line; the rest opens under "more".
function shortNote(text, max = 140) {
  if (!text) return '';
  const flat = text.replace(/\s+/g, ' ').trim();
  if (flat.length <= max) return safe`<p class="note">${flat}</p>`;
  return safe`<details class="note"><summary>${clip(flat, max)}</summary><p>${text}</p></details>`;
}

function eventLine(event, now, { answer = null, form = null } = {}) {
  return safe`<li><div class="main">
    <span class="tag ${kindTone(event.kind)}">${KIND_LABELS[event.kind] ?? event.kind}</span>${event.dealer_name ? safe` <span class="muted">${event.dealer_name}</span>` : ''}${event.otd_cents != null ? safe` · <strong>${money(event.otd_cents)}</strong>` : ''}
    ${shortNote(event.note)}${answer ? safe`<p class="note"><span class="tag good">Answered</span> ${answer.answer ? clip(answer.answer, 200) : 'Done'}</p>` : ''}${form ?? ''}</div>
    <span class="muted nowrap">${event.actor ? `${event.actor} · ` : ''}${when(event.occurred_at, now)}</span></li>`;
}

export function renderDashboard(data, now = Date.now()) {
  const summaries = summarizeDeals(data, now);
  const open = summaries.filter(deal => !deal.closed);
  const recentClosed = summaries.filter(deal => deal.closed && now - time(deal.last_activity) < 30 * 86400000);
  const order = { agreed: 0, quoted: 1, emailing: 2, shortlisted: 3, confirming: 4 };
  open.sort((a, b) => order[a.stage] - order[b.stage] || time(b.last_activity) - time(a.last_activity));
  const needCount = data.needs.length + data.drafts.length + data.waiting.length + open.filter(deal => deal.stale).length
    + (data.agents ?? []).filter(agent => agent.overdue).length;
  const body = safe`
<header><h1>Deals</h1><span class="muted">Updated ${absolute(now)} CT · refreshes every 2 minutes</span></header>
<div class="stats">
  <div class="stat"><b>${needCount}</b><span class="muted">Need you</span></div>
  <div class="stat"><b>${open.length}</b><span class="muted">Open deals</span></div>
  <div class="stat"><b>${open.filter(deal => deal.stage === 'agreed').length}</b><span class="muted">Price agreed</span></div>
  <div class="stat"><b>${recentClosed.length}</b><span class="muted">Closed, last 30 days</span></div>
  <div class="stat"><b>${data.leads.length}</b><span class="muted">Leads, last 14 days</span></div>
</div>
<h2>Open deals (${open.length})</h2>
${dealTiles(open, now)}
${recentClosed.length ? safe`<details><summary>Closed in the last 30 days (${recentClosed.length})</summary>${dealsTable(recentClosed, now)}</details>` : ''}
${needsSection(data, open, now)}
${agentsSection(data.agents, now)}
<h2>Last 7 days</h2>
${activitySection(data.activity, now)}
<h2>Website leads, last 14 days (${data.leads.length})</h2>
<div class="card">${data.leads.length ? safe`<ul class="list">${join(data.leads, lead => safe`<li><div class="main">
  <strong>${lead.name}</strong>${lead.vehicle ? safe` <span class="muted">· ${clip(lead.vehicle, 80)}</span>` : ''}
  ${lead.message ? safe`<p>${clip(lead.message, 220)}</p>` : ''}
  <p class="muted">${lead.source_page}</p></div><span class="muted nowrap">${when(lead.created_at, now)}</span></li>`)}</ul>` : raw('<p class="empty">No leads in the last 14 days.</p>')}</div>`;
  return page('Deals · ops', String(body));
}

// Mason's controls on a deal's page. Each form adds one deal_events row (editDeal).
function editPanel(deal, summary, listings) {
  const hidden = edit => safe`<input type="hidden" name="edit" value="${edit}"><input type="hidden" name="deal" value="${deal.onboarding_id}">`;
  const dealerNames = [...new Set([...summary.live_dealers, ...listings.map(item => item.dealer_name).filter(Boolean)])];
  if (summary.closed) {
    return safe`<div class="card edit"><form method="post" action="/api/ops" class="row">${hidden('reopen')}
      <span><span class="tag good">Closed</span> ${summary.outcome ?? ''}</span><button type="submit">Reopen deal</button></form></div>`;
  }
  return safe`<div class="card edit">
  <form method="post" action="/api/ops" class="row">${hidden('close')}
    <label>Close deal <select name="outcome">${join(OUTCOMES, outcome => safe`<option>${outcome}</option>`)}</select></label>
    <input type="text" name="note" maxlength="300" placeholder="Details (optional)" aria-label="Closing details">
    <button type="submit" class="primary">Close deal</button></form>
  <form method="post" action="/api/ops" class="row">${hidden('agreed')}
    <label>Price agreed <input type="text" name="dealer" list="dealers-${deal.onboarding_id}" maxlength="200" placeholder="Dealer" required></label>
    <input type="text" name="otd" inputmode="decimal" placeholder="Out-the-door $" aria-label="Out-the-door price" required class="money">
    ${listings.length ? safe`<select name="vin" aria-label="Car"><option value="">Car (optional)</option>${join(listings.filter(item => item.vin), item => safe`<option value="${item.vin}">${clip(item.title, 40)}</option>`)}</select>` : ''}
    <button type="submit">Save</button></form>
  ${summary.live_dealers.length ? safe`<form method="post" action="/api/ops" class="row">${hidden('drop')}
    <label>Drop dealer <select name="dealer">${join(summary.live_dealers, name => safe`<option>${name}</option>`)}</select></label>
    <button type="submit">Drop</button></form>` : ''}
  <form method="post" action="/api/ops" class="row">${hidden('note')}
    <label class="grow">Note <input type="text" name="note" maxlength="1000" placeholder="Add a note to the log" required></label>
    <button type="submit">Add</button></form>
  <datalist id="dealers-${deal.onboarding_id}">${join(dealerNames, name => safe`<option value="${name}">`)}</datalist></div>`;
}

export function renderDeal(detail, now = Date.now()) {
  const { deal, listings, events, drafts } = detail;
  const summary = summarizeDeal(deal, [...events].reverse(), listings, now);
  const answers = new Map(events.filter(event => event.resolves_event_id).map(event => [String(event.resolves_event_id), event]));
  const shown = events.filter(event => event.kind !== 'resolved');
  const days = Map.groupBy(shown, event => dayLabel(event.occurred_at, now));
  const body = safe`
<p><a href="/api/ops">← All deals</a></p>
<header><h1>${deal.name}</h1><span class="muted">${deal.city} · ${TIERS[deal.tier_id] ?? deal.tier_id} · <code>${deal.onboarding_id}</code></span></header>
<div class="stats">
  <div class="stat"><b>${STAGES[summary.stage]}</b><span class="muted">Stage</span></div>
  <div class="stat"><b>${money(summary.best_cents)}</b><span class="muted">${summary.best_dealer ?? 'Best out-the-door'}</span></div>
  <div class="stat"><b>${money(summary.target_cents)}</b><span class="muted">Target</span></div>
  <div class="stat"><b>${summary.quotes}/${summary.dealers}</b><span class="muted">Dealers quoting</span></div>
</div>
<h2>Update deal</h2>
${editPanel(deal, summary, listings)}
${deal.search_summary ? safe`<h2>Search</h2><div class="card"><p class="empty" style="color:inherit">${deal.search_summary}</p></div>` : ''}
<h2>Shortlist (${listings.length})</h2>
${listings.length ? safe`<div class="card scroll"><table>
  <thead><tr><th>#</th><th>Car</th><th>Dealer</th><th class="num">Asking</th><th class="num">Market</th><th class="num">Target</th><th class="num hide-sm">Walk away</th><th class="num hide-sm">Days on lot</th></tr></thead>
  <tbody>${join(listings, item => safe`<tr><td>${item.rank}</td>
    <td class="wide"><a href="${/^https?:\/\//i.test(item.listing_url) ? item.listing_url : '#'}" rel="noopener noreferrer" target="_blank">${item.title}</a>${item.vin ? safe`<br><span class="muted">${item.vin}</span>` : ''}</td>
    <td class="wide">${item.dealer_name}${item.dealer_location ? safe`<br><span class="muted">${item.dealer_location}</span>` : ''}</td>
    <td class="num">${money(item.price_cents)}</td><td class="num">${money(item.market_price_cents)}</td><td class="num">${money(item.target_price_cents)}</td>
    <td class="num hide-sm">${money(item.walk_away_cents)}</td><td class="num hide-sm">${item.days_on_lot ?? '—'}</td></tr>`)}</tbody></table></div>` : raw('<div class="card"><p class="empty">No cars on the shortlist.</p></div>')}
${drafts.length ? safe`<h2>First emails</h2><div class="card"><ul class="list compact">${join(drafts, draft => safe`<li><div class="main"><strong>${draft.dealer_name}</strong>${draft.last_error ? safe`<p class="muted">${draft.last_error}</p>` : ''}</div>
  <span class="muted nowrap">${draft.status} · ${when(draft.sent_at || draft.created_at, now)}</span></li>`)}</ul></div>` : ''}
<h2>Log (${shown.length})</h2>
<div class="card">${shown.length ? join([...days], ([label, items]) => safe`<h3 class="day">${label}</h3><ul class="list compact">${join(items, event => {
    const answer = answers.get(String(event.id)) ?? null;
    const open = event.kind === 'needs_mason' && !answer;
    return eventLine(event, now, { answer, form: open ? needForm(event, deal.onboarding_id) : null });
  })}</ul>`) : raw('<p class="empty">Nothing logged yet.</p>')}</div>`;
  return page(`${deal.name} · ops`, String(body));
}

export function renderMessage(title, message) {
  return page(title, safe`<p><a href="/api/ops">← All deals</a></p><h1>${title}</h1><p>${message}</p>`, { refresh: false });
}

