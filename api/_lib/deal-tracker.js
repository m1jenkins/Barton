import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { ConfigError } from './config.js';
import { CONTENT_TYPES, DOC_LABELS, MAX_BYTES, listReceipts } from './buyer-documents.js';
import { buyerFromRow } from './customer-emails/index.js';
import { openPickRound } from './buyer-picks.js';
import { agreedOffer, bestPrices, dealerNames, pickStatus } from './deal-view.js';
import { summarizeDeal } from './ops-dashboard.js';
import { DETAIL_FIELDS, MAX_FEATURES, MAX_PHOTOS, photoUrl } from './listing-media.js';

// The Deal Tracker: a buyer's private page for their deal (GLOSSARY.md,
// docs/deal-tracker-build-plan-2026-11-21.md). DEAL_TRACKER_ENABLED switches the
// whole thing on; until then a paid intake opens no deal and nothing changes.
export const dealTrackerEnabled = (environment = process.env) =>
  ['1', 'true', 'yes'].includes(String(environment.DEAL_TRACKER_ENABLED || '').trim().toLowerCase());

const DEFAULT_ORIGIN = 'https://www.steermeright.com';
const DAY = 86400000;
// A closed deal's link keeps working this long after the latest close (adr/0001).
export const LINK_GRACE_DAYS = 3;
const MASON = 'mason@steermeright.com';

// The number buyers text Mason at (adr/0003), as a US number: ten digits, or
// eleven starting with 1, in any punctuation. Null when it isn't given.
export function textNumber(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return null;
  const digits = raw.replace(/[\s().+-]/g, '');
  const match = /^1?(\d{10})$/.exec(digits);
  if (!match || /[^\d\s().+-]/.test(raw)) return null;
  const ten = match[1];
  return { href: `sms:+1${ten}`, label: `(${ten.slice(0, 3)}) ${ten.slice(3, 6)}-${ten.slice(6)}` };
}

// Null while the switch is off. On, it needs a real secret: a short one would
// make every buyer's link guessable, so it fails loudly instead.
// DEAL_TRACKER_TEXT_NUMBER is the number buyers text Mason at; unset, the page
// asks them to email instead.
export function dealTrackerSettings(environment = process.env) {
  if (!dealTrackerEnabled(environment)) return null;
  const secret = String(environment.DEAL_TRACKER_SECRET ?? '').trim();
  if (secret.length < 32) throw new ConfigError('DEAL_TRACKER_SECRET must be at least 32 characters');
  const origin = (String(environment.APP_ORIGIN ?? '').trim() || DEFAULT_ORIGIN).replace(/\/+$/, '');
  const rawText = String(environment.DEAL_TRACKER_TEXT_NUMBER ?? '').trim();
  const text = textNumber(rawText);
  if (rawText && !text) throw new ConfigError('DEAL_TRACKER_TEXT_NUMBER must be a 10-digit US phone number');
  return { secret, origin, text };
}

// ---------- Link ----------

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const TOKEN = /^([0-9a-f]{32})\.([A-Za-z0-9_-]{43})$/;
const intakeId = onboardingId => String(onboardingId).trim().toLowerCase();
const hmac = (secret, message) => createHmac('sha256', secret).update(message).digest();
const linkSignature = (secret, onboardingId, version) => hmac(secret, `link:${intakeId(onboardingId)}:${version}`).toString('base64url');

// The token is the intake ID without dashes and an HMAC of the ID and the link's
// version. The version stays out of the token, so reissuing (version + 1) kills
// every older link without the table holding anything that rebuilds one.
export function signLink(secret, onboardingId, version) {
  return `${intakeId(onboardingId).replaceAll('-', '')}.${linkSignature(secret, onboardingId, version)}`;
}

export const linkUrl = (settings, onboardingId, version) => `${settings.origin}/deal/${signLink(settings.secret, onboardingId, version)}`;

function parseToken(token) {
  const match = TOKEN.exec(String(token ?? ''));
  if (!match) return null;
  const hex = match[1];
  const id = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  return UUID.test(id) ? { id, signature: match[2] } : null;
}

// Hashing both sides first gives timingSafeEqual two equal-length buffers whatever arrives.
const sameSignature = (a, b) => timingSafeEqual(createHash('sha256').update(a).digest(), createHash('sha256').update(b).digest());

// Whether a link opens its deal. Forged, unknown and old-version links are all
// 'invalid', so a refusal never says whether a deal exists.
export async function checkLink(sql, settings, token, now = Date.now()) {
  const parsed = parseToken(token);
  if (!parsed) return { status: 'invalid', onboardingId: null };
  const [link] = await sql`SELECT version, revoked_at FROM deal_tracker_links WHERE onboarding_id = ${parsed.id}`;
  if (!link || !sameSignature(parsed.signature, linkSignature(settings.secret, parsed.id, link.version))) {
    return { status: 'invalid', onboardingId: null };
  }
  if (link.revoked_at) return { status: 'revoked', onboardingId: parsed.id };
  const [last] = await sql`SELECT kind, occurred_at FROM deal_events
    WHERE onboarding_id = ${parsed.id} AND kind IN ('closed', 'reopened')
    ORDER BY occurred_at DESC, id DESC LIMIT 1`;
  if (last?.kind === 'closed' && now - new Date(last.occurred_at).getTime() > LINK_GRACE_DAYS * DAY) {
    return { status: 'expired', onboardingId: parsed.id };
  }
  return { status: 'ok', onboardingId: parsed.id };
}

// The only write a GET makes: mail scanners follow links, so nothing else may change.
export async function touchOpened(sql, onboardingId, now = Date.now()) {
  const at = new Date(now).toISOString();
  await sql`UPDATE deal_tracker_links SET first_opened_at = COALESCE(first_opened_at, ${at}::timestamptz), last_opened_at = ${at}::timestamptz
    WHERE onboarding_id = ${onboardingId}`;
}

// ---------- The buyer's view ----------

const escapeRegExp = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const JOINER = String.raw`(?:@|-|–|—|\||,|:|·|\bat\b|\bfrom\b)`;
const DANGLING_END = new RegExp(`\\s*${JOINER}\\s*$`, 'i');
const DANGLING_START = new RegExp(`^\\s*${JOINER}\\s*`, 'i');

// A car's title or color as the buyer may see it: every dealer name and VIN on
// the deal taken out (a feed title can carry both), and any " at", "@" or "-"
// left hanging at either end.
export function redactCarText(text, secrets) {
  let out = String(text ?? '');
  const needles = [...new Set(secrets.map(value => String(value ?? '').trim()).filter(Boolean))].sort((a, b) => b.length - a.length);
  for (const needle of needles) out = out.replace(new RegExp(escapeRegExp(needle), 'gi'), ' ');
  out = out.replace(/\s+/g, ' ').trim();
  for (let before = ''; before !== out;) {
    before = out;
    out = out.replace(DANGLING_END, '').replace(DANGLING_START, '').trim();
  }
  return out;
}

const vinKey = vin => String(vin ?? '').trim().toUpperCase();
const cents = value => (value == null || !Number.isFinite(Number(value)) ? null : Math.round(Number(value)));
function webUrl(value) {
  try {
    const url = new URL(String(value ?? ''));
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}

const jsonValue = value => {
  if (typeof value !== 'string') return value;
  try { return JSON.parse(value); } catch { return null; }
};
const photoList = value => {
  const list = jsonValue(value);
  return Array.isArray(list) ? list.map(photoUrl).filter(Boolean).slice(0, MAX_PHOTOS) : [];
};

// A car's listing details as the buyer may see them: the named fields only, as
// text, each run through redact (which takes out dealer names and VINs), and
// up to 40 features.
function carDetails(value, redact) {
  const raw = jsonValue(value);
  const details = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const facts = DETAIL_FIELDS.flatMap(([key, label]) => {
    const item = details[key];
    if (item == null || typeof item === 'object') return [];
    const value = redact(String(item).slice(0, 120));
    return value ? [{ label, value }] : [];
  });
  const features = (Array.isArray(details.features) ? details.features : [])
    .filter(item => typeof item === 'string')
    .map(item => redact(item.slice(0, 120)))
    .filter(Boolean)
    .slice(0, MAX_FEATURES);
  return { facts, features };
}

// Whether the page names each car's dealer and links its listing: from Quotes
// in on (adr/0003). Before that, the dealer is taken out of everything shown.
export const dealersShown = (stage, outcome) => stage === 'quoted' || stage === 'agreed' || outcome === 'bought';

// Everything the page may show about a deal, built field by field from named
// columns. Nothing here is a spread row, so a column added later stays private
// until someone adds it on purpose. Returns null when there is no deal.
export async function loadBuyerView(sql, onboardingId, now = Date.now()) {
  const [deal] = await sql`SELECT d.id, d.onboarding_id, d.shortlisted_at, d.created_at, o.name, o.tier_id, o.city, o.fields
    FROM deals d JOIN onboarding_submissions o ON o.id = d.onboarding_id WHERE d.onboarding_id = ${onboardingId}`;
  if (!deal) return null;
  const listings = await sql`SELECT rank, title, color, mileage, price_cents, est_otd_cents, vin, listing_url, dealer_name, dealer_location,
    photo_urls, details
    FROM deal_listings WHERE deal_id = ${deal.id} ORDER BY rank`;
  const events = await sql`SELECT id, kind, dealer_name, vin, otd_cents, note, occurred_at
    FROM deal_events WHERE onboarding_id = ${onboardingId} ORDER BY occurred_at, id`;

  const summary = summarizeDeal({ onboarding_id: deal.onboarding_id, shortlisted_at: deal.shortlisted_at, created_at: deal.created_at }, events, listings, now);
  const outcome = !summary.closed ? null : /^\s*bought\b/i.test(summary.outcome ?? '') ? 'bought' : 'other';
  const buyer = buyerFromRow({ name: deal.name, tier_id: deal.tier_id, city: deal.city, fields: deal.fields });
  const view = {
    stage: summary.stage,
    outcome,
    buyer: {
      first_name: buyer.firstName,
      plan: buyer.plan,
      finance: buyer.paying !== 'cash',
      trade_in: buyer.hasTradeIn,
      // The search details only matter while the search is being confirmed.
      recap: summary.stage === 'confirming' ? buyer.recap.map(([label, value]) => ({ label, value })) : []
    },
    cars: [],
    agreed: null,
    dealers_shown: false,
    pick: { open: false, standing: null },
    // Buyer Documents: receipts only (type and time), and whether the page takes
    // a file, and an ID (from Price agreed). Nothing else about a file leaves the database.
    documents: [],
    can_upload: false,
    can_upload_id: false
  };
  if (outcome === 'other') return view;
  view.documents = await listReceipts(sql, onboardingId);
  view.can_upload = true;
  view.can_upload_id = summary.stage === 'agreed' || outcome === 'bought';

  // The timeline: posted Buyer Updates, oldest first. Drafts and retracted
  // updates never leave the database.
  const updates = await sql`SELECT id, body, posted_at, ready_for_pick FROM buyer_updates
    WHERE onboarding_id = ${onboardingId} AND status = 'posted' ORDER BY posted_at, id`;
  view.timeline = updates.map(update => ({
    type: 'update', id: Number(update.id), body: String(update.body), at: new Date(update.posted_at).toISOString(), ready_for_pick: Boolean(update.ready_for_pick)
  }));

  const shown = dealersShown(summary.stage, outcome);
  view.dealers_shown = shown;
  const offer = summary.stage === 'agreed' || outcome === 'bought' ? agreedOffer(listings, events) : null;
  // Every dealer name and VIN on the deal comes out of the car text (a feed
  // title can carry both). From Quotes in the dealer has its own line instead.
  const secrets = [...dealerNames(listings, events), ...listings.map(item => item.vin), ...events.map(event => event.vin)];
  const redact = text => redactCarText(text, secrets);
  const best = bestPrices(listings, events);
  // The Buyer Pick, in Quotes in only. A pick whose dealer was dropped counts as
  // cleared here, before the job writes it, since a GET never writes. Its VIN and
  // dealer stay in this function: the buyer's view names the car by rank.
  if (summary.stage === 'quoted') {
    const round = await openPickRound(sql, onboardingId);
    const judged = round.pick ? pickStatus(round.pick, listings, events) : null;
    const standing = judged && judged.status !== 'dealer_dropped' ? round.pick : null;
    const picked = standing?.kind === 'pick' ? listings.find(item => vinKey(item.vin) === vinKey(standing.vin)) : null;
    view.pick = {
      open: round.update_id != null,
      standing: standing && {
        kind: standing.kind,
        rank: picked ? Number(picked.rank) : null,
        otd_cents: cents(standing.otd_cents),
        at: new Date(standing.created_at).toISOString(),
        flag: judged.status === 'price_moved' ? 'price_moved' : null,
        current_cents: standing.kind === 'pick' ? cents(judged.current_cents) : null
      }
    };
  }
  const canPick = view.pick.open && !view.pick.standing;
  const cars = listings.map(item => {
    const rank = Number(item.rank);
    const vin = vinKey(item.vin);
    const isAgreed = Boolean(offer?.vin && vin === offer.vin);
    return {
      rank,
      title: redact(item.title) || `Car ${rank}`,
      color: redact(item.color) || null,
      mileage: item.mileage == null ? null : Number(item.mileage),
      asking_cents: cents(item.price_cents),
      estimate_cents: cents(item.est_otd_cents),
      best_cents: vin ? cents(best.get(vin)?.otd_cents) : null,
      agreed: isAgreed,
      // How many photos the page serves for this car, at <link>/photo/<rank>/<n>.
      // The photos' own URLs never leave the server.
      photo_count: photoList(item.photo_urls).length,
      details: carDetails(item.details, redact),
      dealer: shown && String(item.dealer_name ?? '').trim()
        ? { name: String(item.dealer_name).trim(), location: String(item.dealer_location ?? '').trim() || null }
        : null,
      listing_url: shown ? webUrl(item.listing_url) : null,
      can_pick: canPick && Boolean(vin) && best.has(vin)
    };
  });
  if (offer) {
    const car = cars.find(item => item.agreed) ?? null;
    view.agreed = { rank: car?.rank ?? null, dealer_name: offer.dealer_name, otd_cents: cents(offer.otd_cents) };
  }
  // After a purchase only the car bought stays on the page.
  view.cars = outcome === 'bought' ? cars.filter(car => car.agreed) : cars;
  return view;
}

// The source URL of one listing photo for the page's photo route: the deal's
// car by rank, its nth photo (from 0). Null when there's no such photo, or the
// search is closed without a purchase (that page shows no cars).
export async function loadPhotoSource(sql, onboardingId, rank, index, now = Date.now()) {
  if (!Number.isSafeInteger(rank) || !Number.isSafeInteger(index) || index < 0 || index >= MAX_PHOTOS) return null;
  const view = await loadBuyerView(sql, onboardingId, now);
  if (!view || !view.cars.some(car => car.rank === rank)) return null;
  const [row] = await sql`SELECT l.photo_urls FROM deal_listings l JOIN deals d ON d.id = l.deal_id
    WHERE d.onboarding_id = ${onboardingId} AND l.rank = ${rank}`;
  return row ? photoList(row.photo_urls)[index] ?? null : null;
}

// ---------- HTML ----------

const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
// Markup built by safe`` stays as it is when nested in another safe``; every other value is escaped.
class Safe {
  constructor(text) { this.text = text; }
  toString() { return this.text; }
}
const safe = (strings, ...values) => new Safe(strings.reduce((out, part, index) => {
  const value = values[index - 1];
  return out + (value instanceof Safe ? value.text : escapeHtml(value)) + part;
}));
const join = (items, render) => new Safe(items.map(item => String(render(item))).join(''));
const NOTHING = new Safe('');

const money = value => `$${Math.round(value / 100).toLocaleString('en-US')}`;
const miles = value => `${value.toLocaleString('en-US')} miles`;
const mailto = safe`<a href="mailto:${MASON}">${MASON}</a>`;
// How a buyer reaches Mason (adr/0003): a text when DEAL_TRACKER_TEXT_NUMBER is
// set (contact is textNumber()'s result), otherwise email.
const reach = (contact, start = false) => contact
  ? safe`${start ? 'Text' : 'text'} me at <a href="${contact.href}">${contact.label}</a>`
  : safe`${start ? 'Email' : 'email'} me at ${mailto}`;

const STAGES = [
  ['confirming', 'Confirming search'], ['shortlisted', 'Shortlisted'], ['emailing', 'Emailing dealers'],
  ['quoted', 'Quotes in'], ['agreed', 'Price agreed'], ['closed', 'Closed']
];

const WORDMARK = '<span class="wordmark-type">steer me righ<svg class="wordmark-t" viewBox="0 0 50 76" aria-hidden="true" focusable="false"><path d="M14.5 6V55q0 8.5 8.5 8.5H31" fill="none" stroke="currentColor" stroke-width="13"/><path class="wordmark-arrow" d="M0 24H34" fill="none" stroke="#0060E8" stroke-width="12"/><path class="wordmark-arrow-head" d="M31 11L50 24L31 37Z" fill="#0060E8"/></svg></span>';

// A private page: nothing from another origin, every URL root-relative. Its look
// is its own (buying/deal-tracker.css: sticky left overview + photo-mosaic car
// showcases on a cool-slate canvas), so it loads none of the site's shared
// stylesheets except the wordmark's. The one script is this site's own upload
// helper, only on a page with the document form.
function page(title, body, { script = false, contact = null } = {}) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow, noarchive">
<meta name="referrer" content="no-referrer">
<title>${escapeHtml(title)}</title>
<link rel="icon" href="/favicon.png" type="image/png">
<link rel="stylesheet" href="/logo-motion.css">
<link rel="stylesheet" href="/buying/deal-tracker.css">
${script ? `<script src="${UPLOAD_SCRIPT}" defer></script>\n` : ''}</head>
<body class="dt"><a class="dt-skip" href="#main-content">Skip to main content</a>
<header class="dt-header"><div class="dt-wrap">
  <a class="dt-logo" href="/" aria-label="Steer Me Right home">${WORDMARK}</a>
</div></header>
${body}
<footer class="dt-footer"><div class="dt-wrap">
  <p>Questions about your deal? ${reach(contact, true)}. I answer within one business day.</p>
  <p class="dt-footer__legal">© 2026 Steer Me Right</p>
</div></footer>
</body>
</html>`;
}

// Where the deal stands, as a card in the left rail: stage count header and the
// six stages as a checklist (done, current, still to come). A search closed
// without a purchase shows no checklist: ticking stages it never reached would
// mislead.
function stageBox(view) {
  if (view.outcome === 'other') return NOTHING;
  const at = STAGES.findIndex(([name]) => name === view.stage);
  const count = at < 0 ? NOTHING : safe`<span class="dt-progress__count">${at + 1} of ${STAGES.length}</span>`;
  return safe`<div class="dt-box dt-progress">
  <div class="dt-progress__head"><h2>Deal progress</h2>${count}</div>
  <ol class="dt-stages" aria-label="Where your deal stands">${join(STAGES, ([name, label]) => {
    const index = STAGES.findIndex(([key]) => key === name);
    const state = index < at ? 'done' : index === at ? 'current' : 'next';
    return name === view.stage
      ? safe`<li class="dt-stage" data-state="${state}" aria-current="step"><span class="dt-stage__name">${label}</span></li>`
      : safe`<li class="dt-stage" data-state="${state}"><span class="dt-stage__name">${label}</span></li>`;
  })}</ol>
</div>`;
}

// The left rail's top overview card: the hero car photo (when available) with
// Mason's mark overlapping its bottom edge, whose search it is, a single concise
// stage line, and a compact summary strip for the leading car's price.
function overviewCard(view, action = null) {
  const name = view.buyer.first_name;
  const at = STAGES.findIndex(([stageName]) => stageName === view.stage);
  const stageLine = view.outcome === 'other'
    ? 'Closed'
    : at >= 0
      ? `Stage ${at + 1} of ${STAGES.length} · ${STAGES[at][1]}`
      : view.buyer.plan;
  // With a price agreed that isn't tied to a car on the shortlist, no car is named here.
  const car = view.cars.find(item => item.agreed) ?? (view.agreed ? null : view.cars[0]) ?? null;
  const main = car ? mainFigure(car, view) : null;
  const hasPhoto = Boolean(car && action && Number(car.photo_count) > 0);
  const media = hasPhoto
    ? safe`<div class="dt-cover">
    <img class="dt-cover__img" src="${action}/photo/${car.rank}/0" alt="" width="640" height="400" decoding="async">
    <span class="dt-cover__avatar" aria-hidden="true">M</span>
  </div>`
    : safe`<div class="dt-cover dt-cover--plain">
    <span class="dt-cover__avatar" aria-hidden="true">M</span>
  </div>`;
  const leadCar = car && main ? safe`<div class="dt-overview__best">
    <div class="dt-overview__best-top">
      <div>
        <p class="dt-overview__best-label">${main[0]}</p>
        <p class="dt-overview__best-price">${money(main[1])}</p>
      </div>
      <a class="dt-button dt-button--sm" href="#car-${car.rank}">View car</a>
    </div>
    <p class="dt-overview__best-car">${car.title}</p>
  </div>` : NOTHING;
  return safe`<div class="dt-overview">
  ${media}
  <div class="dt-overview__head">
    <h1>${name ? `${name}’s car search` : 'Your car search'}</h1>
    <p class="dt-overview__stage">${stageLine}</p>
  </div>
  ${leadCar}
</div>`;
}

const section = (id, heading, body, lead = null) => safe`<section class="dt-section" aria-labelledby="${id}">
  <h2 id="${id}">${heading}</h2>${lead ? safe`<p class="dt-lead">${lead}</p>` : NOTHING}
  ${body}
</section>`;
const checklist = items => safe`<ul class="dt-checklist">${join(items, item => safe`<li>${item}</li>`)}</ul>`;

function searchDetails(view) {
  const recap = view.buyer.recap;
  const details = recap.length
    ? safe`<dl class="dt-details">${join(recap, ({ label, value }) => safe`<div><dt>${label}</dt><dd>${value}</dd></div>`)}</dl>`
    : safe`<p>I have your search details from your intake.</p>`;
  return section('dt-search', 'Your search details', safe`<div class="dt-card">${details}</div>`,
    safe`This is what you told me. If anything has changed, ${reach(view.contact)} and I’ll update the search.`);
}

function howItWorks() {
  return section('dt-how', 'How the search works', safe`<ol class="dt-steps">
    <li>I search dealer inventory for cars that match what you asked for.</li>
    <li>I check each car against the market and shortlist the best ones. They show up here with the asking price and my estimated total.</li>
    <li>I email each dealer for a written out-the-door price: the full total with fees, tax and registration.</li>
    <li>As written prices come in, each car shows its best price so far, and I push for a better one where there’s room.</li>
    <li>You decide whether to buy. Nothing is agreed without your say.</li>
  </ol>`);
}

function yourSide(view) {
  const items = [
    ...(view.buyer.finance ? [safe`If you might finance, get a loan pre-approval from your bank or credit union. It gives us a rate for the dealer to beat.`] : []),
    ...(view.buyer.trade_in ? [safe`If you’re trading in, find your title or loan payoff details, and take a few clear photos of the car in daylight.`] : []),
    safe`Keep an eye on your texts and email. When I need an answer from you, a quick reply keeps the dealers moving.`
  ];
  return section('dt-help', 'What helps from your side', safe`<div class="dt-card">${checklist(items)}</div>`);
}

function holdOff() {
  return section('dt-hold', 'What to hold off on', safe`<div class="dt-card">${checklist([
    'Please don’t call dealers or fill in online price forms for the cars you’re shopping. It brings sales calls and gets in the way of the written prices I’m asking for.',
    'Don’t fill in a credit application or let a dealer run your credit yet.',
    'Don’t sign anything or put down a deposit until we have a written out-the-door price you’re happy with.'
  ])}</div>`);
}

// The pick button on a priced car while the round is open. It only asks for
// the confirm step; the price shown travels with it so a change in between shows.
const pickButton = (car, action) => safe`<form class="dt-pick-form" method="post"${action ? safe` action="${action}"` : NOTHING}>
      <input type="hidden" name="action" value="pick_review"><input type="hidden" name="car" value="${car.rank}"><input type="hidden" name="price" value="${car.best_cents}">
      <button class="dt-button" type="submit">Pick this car at ${money(car.best_cents)}</button>
    </form>`;

// The listing's photos as one swipeable strip, with how many there are in its
// corner. Each is served from the page's own path
// (/deal/<token>/photo/<rank>/<n>), so the photo host never shows.
function photoStrip(car, action) {
  const count = Math.min(Number(car.photo_count) || 0, MAX_PHOTOS);
  if (!count || !action) return NOTHING;
  const indexes = Array.from({ length: count }, (_, index) => index);
  return safe`<div class="dt-car__media">
      <div class="dt-photos" role="region" aria-label="Photos of the ${car.title}" tabindex="0">${join(indexes, index => safe`<img class="dt-photo" src="${action}/photo/${car.rank}/${index}" alt="${car.title}, photo ${index + 1} of ${count}" width="640" height="480"${index >= 3 ? safe` loading="lazy"` : NOTHING} decoding="async">`)}</div>
      ${count > 1 ? safe`<p class="dt-photos__count">${count} photos</p>` : NOTHING}
    </div>`;
}

// How many of a listing's facts sit in the open, beside the price. The rest
// fold away with the features.
const OPEN_FACTS = 4;
const factList = (facts, name) => safe`<dl class="${name}">${join(facts, fact => safe`<div><dt>${fact.label}</dt><dd>${fact.value}</dd></div>`)}</dl>`;

// The rest of the listing's details, folded away under the car.
function detailsBlock(car) {
  const { facts = [], features = [] } = car.details ?? {};
  const rest = facts.slice(OPEN_FACTS);
  if (!rest.length && !features.length) return NOTHING;
  return safe`<details class="dt-car__more">
      <summary>Car details</summary>
      ${rest.length ? factList(rest, 'dt-facts') : NOTHING}
      ${features.length ? safe`<ul class="dt-features">${join(features, feature => safe`<li>${feature}</li>`)}</ul>` : NOTHING}
    </details>`;
}

// A car's one main figure: the agreed price, else its best price so far, else
// our estimated total.
function mainFigure(car, view) {
  const agreedHere = car.agreed && view.agreed;
  return agreedHere && view.agreed.otd_cents != null ? ['Agreed out-the-door price', view.agreed.otd_cents]
    : car.best_cents != null ? ['Best price so far', car.best_cents]
    : car.estimate_cents != null ? ['Estimated total', car.estimate_cents] : null;
}
const isWaiting = (car, view) => ['shortlisted', 'emailing', 'quoted'].includes(view.stage) && car.best_cents == null;

// One car as a showcase card: its photo mosaic/strip across the top, then a
// clean info-and-pricing row (title, color/mileage, dealer, inline specs on the
// left; main figure, asking price and pick button on the right), with the rest
// of the listing folded away underneath.
function carCard(car, view, action = null) {
  const agreedHere = car.agreed && view.agreed;
  const main = mainFigure(car, view);
  const meta = [car.color, car.mileage != null ? miles(car.mileage) : null].filter(Boolean).join(' · ');
  const dealer = car.dealer ?? (agreedHere && view.agreed.dealer_name ? { name: view.agreed.dealer_name, location: null } : null);
  const open = (car.details?.facts ?? []).slice(0, OPEN_FACTS);
  const photos = photoStrip(car, action);
  return safe`<article class="dt-car${agreedHere ? ' dt-car--agreed' : ''}${photos === NOTHING ? ' dt-car--no-photos' : ''}" id="car-${car.rank}">
    ${photos}
    <div class="dt-car__body">
      <div class="dt-car__main">
        <div class="dt-car__info">
          <h3 class="dt-car__title">${car.title}</h3>
          ${meta ? safe`<p class="dt-car__meta">${meta}</p>` : NOTHING}
          ${dealer ? safe`<p class="dt-car__dealer">At ${dealer.name}${dealer.location ? `, ${dealer.location}` : ''}</p>` : NOTHING}
          ${open.length ? factList(open, 'dt-specs') : NOTHING}
          ${car.listing_url ? safe`<p class="dt-car__link"><a href="${car.listing_url}" rel="noopener noreferrer" target="_blank">See this car on the dealer’s website</a></p>` : NOTHING}
        </div>
        <div class="dt-price">
          <dl class="dt-figures">
            ${main ? safe`<div class="dt-figure dt-figure--main"><dt>${main[0]}</dt><dd>${money(main[1])}</dd></div>` : NOTHING}
            ${car.asking_cents != null ? safe`<div class="dt-figure"><dt>Asking price</dt><dd>${money(car.asking_cents)}</dd></div>` : NOTHING}
          </dl>
          ${isWaiting(car, view) ? safe`<p class="dt-car__note">Waiting on a written price</p>` : NOTHING}
          ${car.can_pick ? pickButton(car, action) : NOTHING}
        </div>
      </div>
      ${detailsBlock(car)}
    </div>
  </article>`;
}

const carGrid = (cars, view, action = null) => safe`<div class="dt-cars${cars.length === 1 ? ' dt-cars--one' : ''}">${join(cars, car => carCard(car, view, action))}</div>`;

function carsSection(view, action = null) {
  if (!view.cars.length) return NOTHING;
  const quoted = view.cars.some(car => car.best_cents != null);
  const lead = view.cars.some(car => car.can_pick)
    ? 'These prices are ready for your call. Pick the car you want at its best price so far, or ask me to keep looking. The price isn’t agreed until I confirm it with the dealer.'
    : quoted
      ? 'Best price so far is the lowest written out-the-door price a dealer has given me on that car. It can still change while I negotiate. Cars without one yet show my estimated total.'
      : 'My estimated total is what I expect the out-the-door price to be, with fees, tax and registration. A dealer’s written price replaces it once one comes in.';
  const aside = view.dealers_shown
    ? 'Please don’t contact these dealers yourself. I’m negotiating with them, and a call or visit from you can cost us the price.'
    : 'Each car’s dealer and listing show here once written prices come in.';
  return section('dt-cars', 'Your cars', safe`${carGrid(view.cars, view, action)}
    <p class="dt-aside">${aside}</p>`, lead);
}

// The agreed price when it isn't tied to a car on the shortlist: the dealer and the figure, no car marked.
function agreedWithoutCar(view) {
  return safe`<div class="dt-card dt-agreed">
    <p class="dt-agreed__dealer">${view.agreed.dealer_name}</p>
    ${view.agreed.otd_cents != null ? safe`<dl class="dt-figures"><div class="dt-figure dt-figure--main"><dt>Agreed out-the-door price</dt><dd>${money(view.agreed.otd_cents)}</dd></div></dl>` : NOTHING}
  </div>`;
}

function agreedSection(view, action = null) {
  const car = view.cars.find(item => item.agreed);
  const others = view.cars.filter(item => !item.agreed);
  const price = view.agreed.otd_cents != null ? money(view.agreed.otd_cents) : null;
  return safe`${section('dt-agreed', car ? 'Your car' : 'Your agreed price', car ? carGrid([car], view, action) : agreedWithoutCar(view))}
  <div class="dt-pair">
  ${section('dt-sign', 'Before you sign', safe`<div class="dt-card">${checklist([
    price ? `Check that the out-the-door price on the buyer’s order is ${price}, to the dollar.` : 'Check that the out-the-door price on the buyer’s order matches the one we agreed, to the dollar.',
    'Read every line for add-ons you didn’t ask for, like paint protection, VIN etching or an extended warranty. You can say no.',
    'Check that the VIN on the paperwork matches the car in front of you.',
    'If you’re financing, compare the dealer’s rate and term with your pre-approval before you sign.',
    `If anything doesn’t match what we agreed, stop and ${view.contact ? 'text' : 'email'} me before you sign.`
  ])}</div>`)}
  ${section('dt-pickup', 'At pickup', safe`<div class="dt-card">${checklist([
    'Bring your driver’s license, proof of insurance for the new car, and your payment or loan details.',
    'If you’re trading in, bring the title or payoff details, every key, and the car’s papers.',
    'Walk around the car in good light before you drive off. Look for scratches and dents, and check you have both keys and the manuals.',
    'Try the things you’ll use every day, like the phone connection, the climate controls and the seats.'
  ])}</div>`)}
  </div>
  ${others.length ? section('dt-others', 'Your other cars', carGrid(others, view, action), 'These stay here for reference.') : NOTHING}`;
}

function boughtSection(view, action = null) {
  const car = view.cars.find(item => item.agreed);
  return safe`${car ? section('dt-bought', 'Your car', carGrid([car], view, action)) : view.agreed ? section('dt-bought', 'Your car', agreedWithoutCar(view)) : NOTHING}
  ${section('dt-after', 'After you drive off', safe`<div class="dt-card">${checklist([
    'Keep copies of everything you signed: the buyer’s order, the contract and the title paperwork.',
    'Note when your temporary tag expires, and call the dealer if your plates or registration haven’t arrived well before then.',
    'If you financed, set up your first payment with the lender rather than waiting for a bill.',
    'If you traded in a car with a loan, check that the loan shows as paid off.',
    'Move or cancel the insurance on any car you traded in.'
  ])}</div>`, safe`This page stays up for three days after your deal closes. If anything comes up with the car or the paperwork, ${reach(view.contact)}.`)}`;
}

function closedSection(view) {
  return section('dt-closed', 'This search is closed', safe`<div class="dt-card"><p>If you have a question about it, or you’d like to pick it back up, ${reach(view.contact)}. I answer within one business day.</p></div>`);
}

const updateTime = value => new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/Chicago', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
}).format(new Date(value));

const stamp = (label, at) => safe`<p class="dt-update__when">${label ? safe`${label} · ` : NOTHING}<time datetime="${at}">${updateTime(at)}</time></p>`;
// Bodies are escaped and keep their line breaks through white-space: pre-line,
// so nothing the buyer, Mason or an agent typed becomes markup.
const words = body => safe`<p class="dt-update__body">${body}</p>`;

// Buyer Updates, newest first. The newest sits at the top of the page, above
// the cars, since it says what just changed; the earlier ones follow lower down.
const newestFirst = view => [...(view.timeline ?? [])].reverse().sort((a, b) => Date.parse(b.at) - Date.parse(a.at));

export function latestUpdate(view) {
  const [latest] = newestFirst(view);
  if (!latest) return NOTHING;
  return section('dt-latest', 'Latest from Mason', safe`<div class="dt-update dt-update--latest">
    ${stamp(null, latest.at)}
    ${words(latest.body)}
  </div>`);
}

export function timelineSection(view) {
  const earlier = newestFirst(view).slice(1);
  if (!earlier.length) return NOTHING;
  return section('dt-updates', 'Earlier updates', safe`<ol class="dt-timeline">${join(earlier, item => safe`<li class="dt-update">
    ${stamp(null, item.at)}
    ${words(item.body)}
  </li>`)}</ol>`);
}

// How to reach Mason, on every stage but a closed search that didn't end in a
// purchase (that page says it itself). Buyers text him (adr/0003).
export function contactSection(view) {
  if (view.outcome === 'other') return NOTHING;
  return section('dt-ask', 'Questions?', safe`<div class="dt-card dt-host"><p>${reach(view.contact, true)}. I answer within one business day.</p></div>`);
}

const MISTAKE = 'If you chose by mistake, let me know and I’ll sort it out.';
const carTitle = (view, rank) => view.cars.find(car => car.rank === rank)?.title ?? null;

// The Buyer Pick, in Quotes in only (plan, "What the buyer sees": Quotes in).
// Open with nothing standing: below the cars, the way to ask us to keep looking
// (each priced car carries its own pick button). Once something stands: what the
// buyer chose and when, and that the price isn't agreed yet.
export function pickSection(view, action = null) {
  const pick = view.pick;
  if (view.outcome || view.stage !== 'quoted' || !pick) return NOTHING;
  const standing = pick.standing;
  if (!standing) {
    if (!pick.open) return NOTHING;
    return section('dt-pick', 'None of these right?', safe`<form class="dt-pick-form" method="post"${action ? safe` action="${action}"` : NOTHING}>
    <input type="hidden" name="action" value="keep_looking_review">
    <button class="dt-button dt-button--outline" type="submit">None of these, keep looking</button>
  </form>`, 'Ask me to keep looking and I’ll go back to the search for more cars and more written prices.');
  }
  const title = carTitle(view, standing.rank);
  const chose = standing.kind === 'keep_looking'
    ? safe`<p>You asked me to keep looking. I’ll keep searching and post an update here when I have more cars for you.</p>`
    : safe`<p>You picked ${title ? safe`the ${title}` : 'a car'} at ${money(standing.otd_cents)} out the door. The price isn’t agreed until I confirm it with the dealer.</p>
    ${standing.flag === 'price_moved' ? safe`<p>The price on this car has changed since you picked it. ${standing.current_cents != null
      ? `Its best price so far is now ${money(standing.current_cents)}.` : 'It has no written price right now.'} I’ll be in touch about it.</p>` : NOTHING}`;
  return section('dt-pick', 'Your pick', safe`<div class="dt-card dt-pick">
    ${stamp(standing.kind === 'keep_looking' ? 'You asked' : 'You picked', standing.at)}
    ${chose}
    <p class="dt-pick__mistake">${MISTAKE}</p>
  </div>`);
}

export const UPLOAD_SCRIPT = '/buying/deal-tracker.js';
const DOC_ORDER = ['pre_approval', 'trade_in_photos', 'trade_in_title', 'payoff_letter', 'insurance', 'id', 'other'];
// Built on use: buyer-documents.js imports this module back, so its constants
// aren't ready while this one loads.
const accepted = () => [...Object.keys(CONTENT_TYPES), '.pdf', '.jpg', '.jpeg', '.png', '.heic', '.heif', '.webp'].join(',');
// Whether the page shows the document form, and so loads its script.
const showsUploadForm = (view, uploads) => Boolean(view.can_upload && uploads);

// Buyer Documents (plan, "Documents"; adr/0001): a form that sends a file
// straight to the private store through buying/deal-tracker.js, and the
// receipts of what was sent. A file can never be opened from this page. The
// form stays hidden until the script shows it; without script the buyer is
// told to email the file. ID is offered only from Price agreed. uploads is
// false when the store isn't set up, and the section says so.
export function documentsSection(view, { action = null, uploads = true } = {}) {
  if (!view.can_upload) return NOTHING;
  const types = DOC_ORDER.filter(type => type !== 'id' || view.can_upload_id);
  const receipts = view.documents ?? [];
  const list = safe`<ul class="dt-receipts" id="dt-receipts"${receipts.length ? NOTHING : safe` hidden`}>${join(receipts, item => safe`<li>${DOC_LABELS[item.doc_type] ?? DOC_LABELS.other} · sent <time datetime="${item.at}">${updateTime(item.at)}</time></li>`)}</ul>`;
  const form = showsUploadForm(view, uploads)
    ? safe`<form class="dt-docs" id="dt-docs-form" method="post"${action ? safe` action="${action}"` : NOTHING} data-max-bytes="${MAX_BYTES}" hidden>
    <label class="dt-docs__label" for="dt-doc-type">What it is</label>
    <span class="dt-select"><select class="dt-field" id="dt-doc-type" name="doc_type" required>
      <option value="">Choose one</option>
      ${join(types, type => safe`<option value="${type}">${DOC_LABELS[type]}</option>`)}
    </select></span>
    <label class="dt-docs__label" for="dt-doc-file">File</label>
    <input class="dt-field dt-field--file" id="dt-doc-file" name="file" type="file" accept="${accepted()}" required>
    <p class="dt-docs__hint">A PDF or a photo (JPEG, PNG, HEIC or WebP), up to 20 MB.</p>
    <button class="dt-button" type="submit">Send document</button>
    <p class="dt-docs__status" id="dt-docs-status" role="status" aria-live="polite"></p>
  </form>
  <noscript><p class="dt-aside">Sending a file from this page needs JavaScript, which is turned off in your browser. Email the file to me at ${mailto} instead.</p></noscript>`
    : safe`<div class="dt-card"><p>Sending documents from this page isn’t available right now. Please try again later, or email the file to me at ${mailto}.</p></div>`;
  const lead = safe`A loan pre-approval, your trade-in’s title or payoff letter, or a few photos of your trade-in help me negotiate.${view.can_upload_id ? ' Now that we have a price, you can send your ID here too.' : ''} Files come only to me and stay private. Once a file is sent, it can’t be opened from this page: you’ll see a receipt of what you sent and when.`;
  return section('dt-docs', 'Send me a document', safe`<div class="dt-docs-wrap">${form}
  <div class="dt-receipts-panel">
    <h3 class="dt-receipts__title"${receipts.length ? NOTHING : safe` hidden`} id="dt-receipts-title">What you’ve sent</h3>
    ${list}
  </div></div>`, lead);
}

function stageBody(view, action = null) {
  if (view.outcome === 'other') return closedSection(view);
  if (view.outcome === 'bought') return boughtSection(view, action);
  if (view.stage === 'confirming') return safe`${searchDetails(view)}${howItWorks()}${yourSide(view)}${holdOff()}`;
  if (view.stage === 'agreed' && view.agreed) return agreedSection(view, action);
  return safe`${carsSection(view, action)}${pickSection(view, action)}`;
}

// action: the page's own path (/deal/<token>), which its forms post to and its
// photos load from. uploads: whether the document store is set up (the form
// shows only then). contact: the text number (textNumber()), or null for email.
export function renderTracker(view, { action = null, uploads = true, contact = null } = {}) {
  const shown = { ...view, contact };
  const ask = contactSection(shown);
  const progress = stageBox(shown);
  // Two columns from a wide screen: sticky deal overview, progress and contact
  // on the left; Mason's latest note, car showcases, earlier updates and
  // documents on the right. On a phone the overview and stage bar come first.
  const body = safe`<main id="main-content" class="dt-wrap dt-page" tabindex="-1">
<div class="dt-layout">
<div class="dt-rail dt-rail--top">
${overviewCard(shown, action)}
${progress}
</div>
<div class="dt-main">
${latestUpdate(shown)}
${stageBody(shown, action)}
${timelineSection(shown)}
${documentsSection(shown, { action, uploads })}
</div>
${ask === NOTHING ? NOTHING : safe`<div class="dt-rail dt-rail--more">
${ask}
</div>`}
</div>
</main>`;
  return page('Your car search · Steer Me Right', String(body), { script: showsUploadForm(shown, uploads), contact });
}

export const dollars = money;

// The confirm step before a pick or "keep looking" is written (plan, "The page").
// car is the view's car being picked, or null for "keep looking". The buttons
// post to the page's own path; "Go back" returns to the cars.
export function renderPickConfirm(car, action = null, contact = null) {
  const back = `${action ?? ''}#dt-cars`;
  const target = action ? safe` action="${action}"` : NOTHING;
  const intro = car
    ? safe`<h1>Check your pick</h1>
  <p>You’re picking the ${car.title} at ${money(car.best_cents)} out the door.</p>`
    : safe`<h1>Keep looking?</h1>
  <p>You’re asking us to keep looking.</p>`;
  const next = car
    ? ['I’ll confirm the price with the dealer in writing. It isn’t agreed until I do, and I’ll post an update on your page when it is.',
      'Please don’t contact the dealer or put down a deposit yet.']
    : ['I’ll go back to the search for more cars and more written prices, and post an update on your page when I have them.'];
  return page(`${car ? 'Check your pick' : 'Keep looking'} · Steer Me Right`, String(safe`<main id="main-content" class="dt-wrap dt-page dt-page--narrow" tabindex="-1">
<div class="dt-intro">
  ${intro}
</div>
${section('dt-next', 'What happens next', safe`<div class="dt-card">${checklist([...next,
    'Once you confirm, you can’t change it from your page. If you change your mind, just let me know.'])}</div>
  <form class="dt-pick-form dt-confirm" method="post"${target}>
    ${car ? safe`<input type="hidden" name="action" value="pick"><input type="hidden" name="car" value="${car.rank}"><input type="hidden" name="price" value="${car.best_cents}">`
    : safe`<input type="hidden" name="action" value="keep_looking">`}
    <button class="dt-button" type="submit">${car ? 'Yes, that’s my pick' : 'Yes, keep looking'}</button>
    <a class="dt-confirm__back" href="${back}">Go back</a>
  </form>`)}
</main>`), { contact });
}

// A short answer to a POST that didn't go through, with the way back.
export function renderNotice(title, text, back = null, contact = null) {
  return page(`${title} · Steer Me Right`, String(safe`<main id="main-content" class="dt-wrap dt-page dt-page--narrow" tabindex="-1">
<div class="dt-intro">
  <h1>${title}</h1>
  <p>${text}</p>
</div>
${section('dt-reach', 'What next', safe`<div class="dt-card">${back ? safe`<p><a href="${back}">Back to your car search</a></p>` : NOTHING}<p>You can always ${reach(contact)}. I answer within one business day.</p></div>`)}
</main>`), { contact });
}

// A refused link. It says nothing about whether a deal exists.
export function renderLinkClosed(contact = null) {
  return page('Link not active · Steer Me Right', String(safe`<main id="main-content" class="dt-wrap dt-page dt-page--narrow" tabindex="-1">
<div class="dt-intro">
  <h1>This link isn’t active</h1>
  <p>It may have expired or been replaced by a newer one.</p>
</div>
${section('dt-reach', 'Need it back?', safe`<div class="dt-card"><p>${reach(contact, true)} and I’ll sort it out. I answer within one business day.</p></div>`)}
</main>`), { contact });
}

// For an unexpected error: nothing about the deal, just a way to reach Mason.
export function renderUnavailable(contact = null) {
  return page('Not available · Steer Me Right', String(safe`<main id="main-content" class="dt-wrap dt-page dt-page--narrow" tabindex="-1">
<div class="dt-intro">
  <h1>This page isn’t available right now</h1>
  <p>Please try again in a few minutes.</p>
</div>
${section('dt-reach', 'Need something now?', safe`<div class="dt-card"><p>${reach(contact, true)}. I answer within one business day.</p></div>`)}
</main>`), { contact });
}
