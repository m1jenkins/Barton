import { randomUUID } from 'node:crypto';
import { ConfigError } from './config.js';
import { SEARCH_FIELDS, display, oneLine } from './intake-email.js';
import { DETAIL_FIELDS, MAX_FEATURES, MAX_PHOTOS, photoUrl } from './listing-media.js';

// Mason runs each car search himself in Claude Code with the /car-search skill
// (.claude/skills/car-search). The skill reads an intake's search details and
// submits the shortlist through /api/car-search, authorized by CAR_SEARCH_TOKEN.
export function carSearchToken(environment = process.env) {
  const token = environment.CAR_SEARCH_TOKEN?.trim();
  if (!token) return null;
  if (token.length < 32) throw new ConfigError('CAR_SEARCH_TOKEN must be at least 32 characters');
  return token;
}

const PLAN_NAMES = Object.freeze({ full_service: 'Steer Me Right ($395)', concierge: 'Steer Me Right Pro ($695)', private_client: 'Steer Me Right Private Client ($1,995)' });
// Not needed to search, so not handed to the search session.
const PRIVATE_FIELDS = new Set(['delivery_address', 'trade_identifier', 'consultation_questions']);

export async function loadSearch(sql, onboardingId) {
  const [intake] = await sql`
    SELECT o.id, o.tier_id, o.name, o.city, o.fields, o.created_at, d.id AS deal_id, d.shortlisted_at,
      (SELECT count(*)::integer FROM deal_listings AS l WHERE l.deal_id = d.id) AS cars
    FROM onboarding_submissions AS o
    LEFT JOIN deals AS d ON d.onboarding_id = o.id
    WHERE o.id = ${onboardingId}
  `;
  if (!intake) return null;
  const fields = intake.fields && typeof intake.fields === 'object' && !Array.isArray(intake.fields) ? intake.fields : {};
  const search = Object.fromEntries(SEARCH_FIELDS
    .filter(([key]) => !PRIVATE_FIELDS.has(key))
    .map(([key, label]) => [label, display(fields[key])])
    .filter(([, value]) => value));
  const emails = intake.deal_id ? await sql`
    SELECT dealer_name, to_email, status FROM dealer_email_drafts WHERE deal_id = ${intake.deal_id} ORDER BY created_at, id
  ` : [];
  return {
    intake_id: intake.id,
    buyer: intake.name,
    lives_in: intake.city,
    plan: PLAN_NAMES[intake.tier_id] || intake.tier_id,
    intake_sent: new Date(intake.created_at).toISOString(),
    search,
    shortlist: intake.shortlisted_at ? {
      submitted: new Date(intake.shortlisted_at).toISOString(),
      cars: intake.cars,
      dealer_emails: emails.map(row => ({ dealer: row.dealer_name, to: row.to_email, status: row.status }))
    } : null
  };
}

// The one deal an intake ID, or its first 8 or more characters, names. Errors:
// invalid, not_found, and ambiguous with how many deals matched.
export const DEAL_ID = /^[0-9a-f]{8}[0-9a-f-]{0,28}$/i;
export async function findDeal(sql, id) {
  if (!DEAL_ID.test(id ?? '')) return { error: 'invalid' };
  const deals = await sql`SELECT id, onboarding_id, search_summary, shortlisted_at FROM deals
    WHERE onboarding_id::text LIKE ${id.toLowerCase() + '%'}`;
  if (deals.length === 1) return { deal: deals[0] };
  return { error: deals.length ? 'ambiguous' : 'not_found', matches: deals.length };
}

// One deal for an agent working it: its shortlist with each car's prices and
// dealer, the full event log, and the Buyer Updates, so the agent sees what the
// buyer was told. deal is a row from findDeal.
export async function loadDeal(sql, deal) {
  const listings = await sql`SELECT rank, title, vin, price_cents, market_price_cents, target_price_cents, mileage,
      days_on_lot, dealer_name, dealer_location, dealer_email, dealer_phone, listing_url, why
    FROM deal_listings WHERE deal_id = ${deal.id} ORDER BY rank`;
  const events = await sql`SELECT id, occurred_at, kind, actor, dealer_name, vin, otd_cents, itemized, note, options, answer, source_message_id, resolves_event_id
    FROM deal_events WHERE onboarding_id = ${deal.onboarding_id} ORDER BY occurred_at, id`;
  let updates = null;
  try {
    updates = await sql`SELECT id, status, actor, on_masons_say, ready_for_pick, body,
        created_at, posted_at, emailed_at, retracted_at
      FROM buyer_updates WHERE onboarding_id = ${deal.onboarding_id} ORDER BY created_at, id`;
  } catch (error) {
    // 42P01: db/013 isn't applied yet, so there are no Buyer Updates to show.
    if (error?.code !== '42P01') throw error;
  }
  return { intake_id: deal.onboarding_id, summary: deal.search_summary, shortlisted_at: deal.shortlisted_at, listings, events, updates };
}

export class ShortlistError extends Error {
  constructor(problems) {
    super(`Fix these and submit again:\n- ${problems.join('\n- ')}`);
    this.problems = problems;
  }
}

const EMAIL_PATTERN = /^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]+$/;

function text(value, path, problems, { max, required = false, singleLine = false }) {
  if (value == null || value === '') {
    if (required) problems.push(`${path} is required`);
    return null;
  }
  if (typeof value !== 'string') {
    problems.push(`${path} must be a string`);
    return null;
  }
  const trimmed = singleLine ? oneLine(value) : value.trim();
  if (required && !trimmed) problems.push(`${path} is required`);
  if (trimmed.length > max) problems.push(`${path} must be at most ${max} characters`);
  return trimmed || null;
}

function whole(value, path, problems, max) {
  if (value == null) return null;
  if (!Number.isInteger(value) || value < 0 || value > max) {
    problems.push(`${path} must be a whole number from 0 to ${max}`);
    return null;
  }
  return value;
}

const cents = dollars => dollars == null ? null : dollars * 100;

function email(value, path, problems, required) {
  const address = text(value, path, problems, { max: 254, required, singleLine: true });
  if (address && !EMAIL_PATTERN.test(address)) problems.push(`${path} must be one email address`);
  return address;
}

function webUrl(value, path, problems) {
  const raw = text(value, path, problems, { max: 2048, required: true, singleLine: true });
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (['http:', 'https:'].includes(url.protocol) && !url.username && !url.password) return url.href;
  } catch {}
  problems.push(`${path} must be an http(s) URL`);
  return null;
}

// est_otd and color are what the buyer's Deal Tracker page shows per car until a
// dealer quotes in writing, so they are required once it is on. A blank one is
// reported with what it should hold.
function trackerField(value, path, problems, required, hint, parse) {
  if (value == null || (typeof value === 'string' && !oneLine(value))) {
    if (required) problems.push(`${path} is required: ${hint}`);
    return null;
  }
  return parse();
}

// The listing's photos for the buyer's page (adr/0003): up to 20 https URLs, in
// the listing's order. Optional: a listing without photos shows none.
function photos(value, path, problems) {
  if (value == null) return [];
  if (!Array.isArray(value)) {
    problems.push(`${path} must be a list of photo URLs`);
    return [];
  }
  if (value.length > MAX_PHOTOS) problems.push(`${path} can hold at most ${MAX_PHOTOS} photos`);
  return value.slice(0, MAX_PHOTOS).flatMap((item, index) => {
    const url = photoUrl(item);
    if (!url) problems.push(`${path}[${index}] must be an https photo URL on a named host`);
    return url ? [url] : [];
  });
}

// The listing's details for the buyer's page: only the named fields
// (DETAIL_FIELDS), each a short line of text, and up to 40 features.
const DETAIL_KEYS = new Set([...DETAIL_FIELDS.map(([key]) => key), 'features']);
function details(value, path, problems) {
  if (value == null) return {};
  if (typeof value !== 'object' || Array.isArray(value)) {
    problems.push(`${path} must be an object of listing details`);
    return {};
  }
  const out = {};
  for (const key of Object.keys(value)) {
    if (!DETAIL_KEYS.has(key)) problems.push(`${path}.${key} isn't a detail the page shows; use ${[...DETAIL_KEYS].join(', ')}`);
  }
  for (const [key] of DETAIL_FIELDS) {
    const item = value[key];
    if (item == null || item === '') continue;
    const line = typeof item === 'number' && Number.isFinite(item) ? String(item) : typeof item === 'string' ? oneLine(item) : null;
    if (line == null || line.length > 120) problems.push(`${path}.${key} must be one line of text, up to 120 characters`);
    else if (line) out[key] = line;
  }
  if (value.features != null) {
    const list = Array.isArray(value.features) ? value.features : null;
    if (!list || list.length > MAX_FEATURES || list.some(item => typeof item !== 'string' || !oneLine(item) || oneLine(item).length > 120)) {
      problems.push(`${path}.features must be a list of up to ${MAX_FEATURES} features, each one line up to 120 characters`);
    } else if (list.length) {
      out.features = [...new Set(list.map(oneLine))];
    }
  }
  return out;
}

// Checks a submitted shortlist and reports every problem at once, so one retry
// can fix them all. Prices are whole dollars in, cents out.
export function parseShortlist(input, { requireTracker = false } = {}) {
  const problems = [];
  const value = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  const summary = text(value.summary, 'summary', problems, { max: 4000, required: true });
  const listings = Array.isArray(value.listings) ? value.listings : (problems.push('listings must be an array'), []);
  const emails = Array.isArray(value.dealer_emails) ? value.dealer_emails : (problems.push('dealer_emails must be an array'), []);
  if (listings.length > 20) problems.push('listings can hold at most 20 cars');
  if (emails.length > 20) problems.push('dealer_emails can hold at most 20 emails');

  const ranks = new Set();
  const parsedListings = listings.slice(0, 20).map((item, index) => {
    const path = `listings[${index}]`;
    const listing = item && typeof item === 'object' ? item : {};
    const rank = listing.rank;
    if (!Number.isInteger(rank) || rank < 1 || rank > 20) problems.push(`${path}.rank must be a whole number from 1 to 20`);
    else if (ranks.has(rank)) problems.push(`${path}.rank ${rank} is used twice`);
    else ranks.add(rank);
    const vin = text(listing.vin, `${path}.vin`, problems, { max: 17, singleLine: true });
    if (vin && !/^[A-HJ-NPR-Z0-9]{17}$/i.test(vin)) problems.push(`${path}.vin must be a 17-character VIN`);
    return {
      rank,
      title: text(listing.title, `${path}.title`, problems, { max: 200, required: true, singleLine: true }),
      price_cents: cents(whole(listing.price, `${path}.price`, problems, 1_000_000)),
      market_price_cents: cents(whole(listing.market_price, `${path}.market_price`, problems, 1_000_000)),
      target_price_cents: cents(whole(listing.target_price, `${path}.target_price`, problems, 1_000_000)),
      est_otd_cents: cents(trackerField(listing.est_otd, `${path}.est_otd`, problems, requireTracker,
        'our estimated out-the-door total in whole dollars', () => whole(listing.est_otd, `${path}.est_otd`, problems, 1_000_000))),
      color: trackerField(listing.color, `${path}.color`, problems, requireTracker, 'the exterior color as the listing gives it',
        () => text(listing.color, `${path}.color`, problems, { max: 60, singleLine: true })),
      mileage: whole(listing.mileage, `${path}.mileage`, problems, 1_000_000),
      days_on_lot: whole(listing.days_on_lot, `${path}.days_on_lot`, problems, 3650),
      vin: vin ? vin.toUpperCase() : null,
      listing_url: webUrl(listing.listing_url, `${path}.listing_url`, problems),
      dealer_name: text(listing.dealer_name, `${path}.dealer_name`, problems, { max: 200, required: true, singleLine: true }),
      dealer_location: text(listing.dealer_location, `${path}.dealer_location`, problems, { max: 200, singleLine: true }),
      dealer_email: email(listing.dealer_email, `${path}.dealer_email`, problems, false),
      dealer_phone: text(listing.dealer_phone, `${path}.dealer_phone`, problems, { max: 40, singleLine: true }),
      why: text(listing.why, `${path}.why`, problems, { max: 2000 }) || '',
      photo_urls: photos(listing.photos, `${path}.photos`, problems),
      details: details(listing.details, `${path}.details`, problems)
    };
  });

  const parsedEmails = emails.slice(0, 20).map((item, index) => {
    const path = `dealer_emails[${index}]`;
    const draft = item && typeof item === 'object' ? item : {};
    const listingRanks = Array.isArray(draft.listing_ranks) ? draft.listing_ranks : [];
    if (listingRanks.length === 0 || listingRanks.some(rank => !ranks.has(rank))) {
      problems.push(`${path}.listing_ranks must list the ranks of the cars this email asks about`);
    }
    return {
      dealer_name: text(draft.dealer_name, `${path}.dealer_name`, problems, { max: 200, required: true, singleLine: true }),
      listing_ranks: [...new Set(listingRanks.filter(rank => ranks.has(rank)))],
      to_email: email(draft.to, `${path}.to`, problems, true),
      subject: text(draft.subject, `${path}.subject`, problems, { max: 200, required: true, singleLine: true }),
      body: text(draft.body, `${path}.body`, problems, { max: 5000, required: true })
    };
  });

  if (problems.length) throw new ShortlistError(problems);
  return { summary, listings: parsedListings, emails: parsedEmails };
}

// Opens the intake's deal if needed and replaces its shortlist. Once its first
// emails are handed off the shortlist is locked, so those emails keep their
// cars. 'sending' and 'sent' are first emails sent from the site before
// November 3, 2026; they lock it too. With the Deal Tracker off the listing INSERT
// names no db/013 column, so it works before that migration is applied.
export async function saveShortlist(sql, onboardingId, shortlist, { tracker = false } = {}) {
  return sql.begin(async tx => {
    await tx`INSERT INTO deals (id, onboarding_id) VALUES (${randomUUID()}, ${onboardingId}) ON CONFLICT (onboarding_id) DO NOTHING`;
    const [deal] = await tx`SELECT id FROM deals WHERE onboarding_id = ${onboardingId} FOR UPDATE`;
    const [sent] = await tx`
      SELECT count(*)::integer AS count FROM dealer_email_drafts
      WHERE deal_id = ${deal.id} AND status IN ('sending', 'sent', 'handed_off')
    `;
    if (sent.count > 0) return { dealId: deal.id, locked: true };

    await tx`DELETE FROM dealer_email_drafts WHERE deal_id = ${deal.id}`;
    await tx`DELETE FROM deal_listings WHERE deal_id = ${deal.id}`;
    for (const listing of shortlist.listings) {
      if (tracker) {
        // ::text first: a bare ::jsonb makes postgres.js see a jsonb parameter and
        // encode the JSON string again, storing a string the CHECKs reject.
        await tx`
          INSERT INTO deal_listings (id, deal_id, rank, title, price_cents, market_price_cents, target_price_cents,
            mileage, days_on_lot, vin, listing_url, dealer_name, dealer_location, dealer_email, dealer_phone, why,
            est_otd_cents, color, photo_urls, details)
          VALUES (${randomUUID()}, ${deal.id}, ${listing.rank}, ${listing.title}, ${listing.price_cents}, ${listing.market_price_cents},
            ${listing.target_price_cents}, ${listing.mileage}, ${listing.days_on_lot}, ${listing.vin},
            ${listing.listing_url}, ${listing.dealer_name}, ${listing.dealer_location}, ${listing.dealer_email},
            ${listing.dealer_phone}, ${listing.why}, ${listing.est_otd_cents}, ${listing.color},
            ${JSON.stringify(listing.photo_urls)}::text::jsonb, ${JSON.stringify(listing.details)}::text::jsonb)
        `;
        continue;
      }
      await tx`
        INSERT INTO deal_listings (id, deal_id, rank, title, price_cents, market_price_cents, target_price_cents,
          mileage, days_on_lot, vin, listing_url, dealer_name, dealer_location, dealer_email, dealer_phone, why)
        VALUES (${randomUUID()}, ${deal.id}, ${listing.rank}, ${listing.title}, ${listing.price_cents}, ${listing.market_price_cents},
          ${listing.target_price_cents}, ${listing.mileage}, ${listing.days_on_lot}, ${listing.vin},
          ${listing.listing_url}, ${listing.dealer_name}, ${listing.dealer_location}, ${listing.dealer_email},
          ${listing.dealer_phone}, ${listing.why})
      `;
    }
    const drafts = [];
    for (const draft of shortlist.emails) {
      const id = randomUUID();
      await tx`
        INSERT INTO dealer_email_drafts (id, deal_id, dealer_name, listing_ranks, to_email, subject, body)
        VALUES (${id}, ${deal.id}, ${draft.dealer_name}, ${draft.listing_ranks}, ${draft.to_email}, ${draft.subject}, ${draft.body})
      `;
      drafts.push({ id, dealer_name: draft.dealer_name, to_email: draft.to_email });
    }
    await tx`
      UPDATE deals SET search_summary = ${shortlist.summary}, shortlisted_at = now(), updated_at = now() WHERE id = ${deal.id}
    `;
    return { dealId: deal.id, locked: false, drafts };
  });
}

// Marks a shortlisted deal's first emails handed off once Mason says to send
// them, which locks the shortlist (saveShortlist), so the cars those emails ask
// about stay the ones on the buyer's page. It sends nothing. Calling it again
// returns the same answer.
export async function handOffDeal(sql, onboardingId) {
  const search = await loadSearch(sql, onboardingId);
  if (!search) return { error: 'intake_not_found' };
  if (!search.shortlist) return { error: 'no_shortlist' };
  return sql.begin(async tx => {
    const [deal] = await tx`SELECT id FROM deals WHERE onboarding_id = ${onboardingId} FOR UPDATE`;
    await tx`
      UPDATE dealer_email_drafts SET status = 'handed_off', decided_at = now()
      WHERE deal_id = ${deal.id} AND status IN ('pending', 'failed')
    `;
    const drafts = await tx`
      SELECT dealer_name, to_email FROM dealer_email_drafts
      WHERE deal_id = ${deal.id} AND status = 'handed_off' ORDER BY created_at, id
    `;
    if (drafts.length === 0) return { error: 'no_dealer_emails' };
    return {
      deal: search.intake_id.slice(0, 8),
      dealer_emails: drafts.map(draft => ({ dealer: draft.dealer_name, to: draft.to_email }))
    };
  });
}
