import { randomUUID } from 'node:crypto';
import { ConfigError } from './config.js';
import { SEARCH_FIELDS, display, oneLine } from './intake-email.js';

// Mason runs each car search himself in Claude Code with the /car-search skill
// (.claude/skills/car-search). The skill reads an intake's search details and
// submits the shortlist through /api/car-search, authorized by CAR_SEARCH_TOKEN.
export function carSearchToken(environment = process.env) {
  const token = environment.CAR_SEARCH_TOKEN?.trim();
  if (!token) return null;
  if (token.length < 32) throw new ConfigError('CAR_SEARCH_TOKEN must be at least 32 characters');
  return token;
}

const PLAN_NAMES = Object.freeze({ full_service: 'Steer Me Right ($395)', concierge: 'Steer Me Right Pro ($695)' });
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

// Checks a submitted shortlist and reports every problem at once, so one retry
// can fix them all. Prices are whole dollars in, cents out.
export function parseShortlist(input) {
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
      walk_away_cents: cents(whole(listing.walk_away_price, `${path}.walk_away_price`, problems, 1_000_000)),
      mileage: whole(listing.mileage, `${path}.mileage`, problems, 1_000_000),
      days_on_lot: whole(listing.days_on_lot, `${path}.days_on_lot`, problems, 3650),
      vin: vin ? vin.toUpperCase() : null,
      listing_url: webUrl(listing.listing_url, `${path}.listing_url`, problems),
      dealer_name: text(listing.dealer_name, `${path}.dealer_name`, problems, { max: 200, required: true, singleLine: true }),
      dealer_location: text(listing.dealer_location, `${path}.dealer_location`, problems, { max: 200, singleLine: true }),
      dealer_email: email(listing.dealer_email, `${path}.dealer_email`, problems, false),
      dealer_phone: text(listing.dealer_phone, `${path}.dealer_phone`, problems, { max: 40, singleLine: true }),
      why: text(listing.why, `${path}.why`, problems, { max: 2000 }) || ''
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

// Opens the intake's deal if needed and replaces its shortlist. Once any dealer
// email has gone out or been handed to Grokbot the shortlist is locked, so
// those emails keep their cars.
export async function saveShortlist(sql, onboardingId, shortlist) {
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
      await tx`
        INSERT INTO deal_listings (id, deal_id, rank, title, price_cents, market_price_cents, target_price_cents, walk_away_cents,
          mileage, days_on_lot, vin, listing_url, dealer_name, dealer_location, dealer_email, dealer_phone, why)
        VALUES (${randomUUID()}, ${deal.id}, ${listing.rank}, ${listing.title}, ${listing.price_cents}, ${listing.market_price_cents},
          ${listing.target_price_cents}, ${listing.walk_away_cents}, ${listing.mileage}, ${listing.days_on_lot}, ${listing.vin},
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
    await tx`
      INSERT INTO deal_jobs (deal_id, kind) VALUES (${deal.id}, 'email_shortlist')
      ON CONFLICT (deal_id, kind) DO UPDATE
      SET status = 'pending', attempts = 0, created_at = now(), last_attempt_at = NULL, done_at = NULL, last_error = NULL
    `;
    return { dealId: deal.id, locked: false, drafts };
  });
}

const dollars = cents => cents == null ? null : Math.round(cents / 100);

// Hands a shortlisted deal to Grokbot, which sends each first email from the
// dealer inbox once Mason approves it there and then negotiates
// (docs/dealer-replies-plan-2026-11-03.md). The handoff is built from an
// allowlist: never the buyer's name or contact details, the fields loadSearch
// withholds, the plan or the walk-away price. Calling it again returns the same
// handoff, so a failed post to Grokbot can be retried.
export async function handOffDeal(sql, onboardingId) {
  const search = await loadSearch(sql, onboardingId);
  if (!search) return { error: 'intake_not_found' };
  if (!search.shortlist) return { error: 'no_shortlist' };
  return sql.begin(async tx => {
    const [deal] = await tx`SELECT id, search_summary FROM deals WHERE onboarding_id = ${onboardingId} FOR UPDATE`;
    const [zoho] = await tx`
      SELECT count(*)::integer AS count FROM dealer_email_drafts WHERE deal_id = ${deal.id} AND status IN ('sending', 'sent')
    `;
    if (zoho.count > 0) return { error: 'started_in_zoho' };
    await tx`
      UPDATE dealer_email_drafts SET status = 'handed_off', decided_at = now()
      WHERE deal_id = ${deal.id} AND status IN ('pending', 'failed')
    `;
    const drafts = await tx`
      SELECT dealer_name, to_email, listing_ranks, subject, body FROM dealer_email_drafts
      WHERE deal_id = ${deal.id} AND status = 'handed_off' ORDER BY created_at, id
    `;
    if (drafts.length === 0) return { error: 'no_dealer_emails' };
    const listings = await tx`
      SELECT rank, title, vin, listing_url, dealer_name, dealer_location, dealer_phone, price_cents, market_price_cents,
        target_price_cents, mileage, days_on_lot, why
      FROM deal_listings WHERE deal_id = ${deal.id} ORDER BY rank
    `;
    const ref = search.intake_id.slice(0, 8);
    const car = oneLine(search.search.Car || search.search['Vehicle type'] || 'car search').replaceAll('/', '-').slice(0, 60);
    return {
      handoff: {
        type: 'new_deal',
        intake_id: search.intake_id,
        deal: ref,
        label: `Deals/${ref} · ${car}`,
        search: { lives_in: search.lives_in, details: search.search },
        summary: deal.search_summary || '',
        cars: listings.map(listing => ({
          rank: listing.rank, title: listing.title, vin: listing.vin, listing_url: listing.listing_url,
          dealer: listing.dealer_name, dealer_location: listing.dealer_location, dealer_phone: listing.dealer_phone,
          asking: dollars(listing.price_cents), market: dollars(listing.market_price_cents), target: dollars(listing.target_price_cents),
          mileage: listing.mileage, days_on_lot: listing.days_on_lot, why: listing.why
        })),
        dealers: drafts.map(draft => ({
          dealer: draft.dealer_name, to: draft.to_email, ranks: draft.listing_ranks || [], subject: draft.subject, body: draft.body
        }))
      }
    };
  });
}
