import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { ConfigError } from '../_lib/config.js';
import { carSearchToken, loadSearch, parseShortlist, saveShortlist, ShortlistError } from '../_lib/car-search.js';
import { DETAIL_FIELDS } from '../_lib/listing-media.js';
import { dealLinkSettings, draftToken, verifyDraftToken } from '../_lib/deal-email.js';
import { renderIntakeEmail } from '../_lib/intake-email.js';
import { loadDeal, summarizeDeal } from '../_lib/ops-dashboard.js';
import { carSearchHandler } from '../car-search.js';
import { dealerEmailHandler } from '../dealer-email.js';
import { carSearchRequest, localEnv } from '../../scripts/car-search.mjs';

const token = 'car-search-token-for-tests-only-0123456789';
const environment = {
  CAR_SEARCH_TOKEN: token, DEAL_LINK_SECRET: 'link-secret-for-tests-only-0123456789', APP_ORIGIN: 'https://www.steermeright.com',
  INTAKE_SMTP_USER: 'mason@steermeright.com', INTAKE_SMTP_PASSWORD: 'app-password-not-real'
};
const migrationNames = ['001_durable_leads_and_payments.sql', '002_standard_purchase_analytics.sql',
  '003_checkout_offer_snapshot.sql', '004_intake_email_outbox.sql', '005_deal_search.sql', '006_dealer_handoff.sql',
  '007_deal_events.sql', '008_deal_events_per_car.sql', '012_deal_events_agents.sql', '013_deal_tracker.sql'];
const migrations = await Promise.all(migrationNames.map(name => readFile(new URL(`../../db/${name}`, import.meta.url), 'utf8')));
// Production before db/013: what the Deal Tracker switch-off path must still work against.
const migrationsBefore013 = migrations.filter((_, index) => migrationNames[index] !== '013_deal_tracker.sql');

function tagged(client) {
  const sql = async (strings, ...values) => {
    const query = strings.reduce((text, part, index) => text + (index ? `$${index}` : '') + part, '');
    return (await client.query(query, values)).rows;
  };
  sql.begin = fn => client.transaction(tx => fn(tagged(tx)));
  return sql;
}

const fields = {
  preferred_makes: 'Subaru Ascent', model_years: '2024 or newer', budget: 'Up to $38,000', search_radius: '100 miles',
  features: ['AWD', 'Moonroof'], delivery_address: '12 Private Lane', trade_identifier: 'ABC1234', contact_preference: 'text'
};

const shortlist = {
  summary: 'Searched 350 miles around Tuscaloosa. Two Limiteds under market.',
  listings: [
    { rank: 1, title: '2025 Subaru Ascent Limited, Crimson Red / Slate Black', price: 35884, market_price: 37346,
      target_price: 34500, mileage: 15203, days_on_lot: 121, vin: '4s4wmauD7p3412345',
      listing_url: 'https://dealer-one.example/ascent', dealer_name: 'Dealer One', dealer_location: 'Johnson City, TN (about 370 mi)',
      dealer_email: 'sales@dealer-one.example', why: 'Price already cut once.' },
    { rank: 2, title: '2024 Subaru Ascent Touring', price: 34433, listing_url: 'https://dealer-two.example/a',
      dealer_name: 'Dealer Two', dealer_phone: '229-555-0199' }
  ],
  dealer_emails: [
    { dealer_name: 'Dealer One', to: 'sales@dealer-one.example', listing_ranks: [1],
      subject: '2025 Subaru Ascent Limited availability', body: 'Hello,\n\nIs the Ascent still available?\n\nMason' }
  ]
};

function response() {
  return {
    statusCode: 200, headers: {}, body: '',
    setHeader(name, value) { this.headers[name.toLowerCase()] = value; },
    end(body = '') { this.body = String(body); }
  };
}
const json = res => JSON.parse(res.body);

test('the car search endpoint and dealer email links stay off until their secrets are set', () => {
  assert.equal(carSearchToken({}), null);
  assert.throws(() => carSearchToken({ CAR_SEARCH_TOKEN: 'short' }), ConfigError);
  assert.equal(carSearchToken(environment), token);
  assert.equal(dealLinkSettings({}), null);
  assert.throws(() => dealLinkSettings({ DEAL_LINK_SECRET: 'short' }), ConfigError);
});

test('a shortlist is normalized to cents, and every problem in a bad one is reported at once', () => {
  const parsed = parseShortlist(shortlist);
  assert.deepEqual([parsed.listings[0].price_cents, parsed.listings[0].market_price_cents, parsed.listings[0].target_price_cents,
    parsed.listings[0].days_on_lot], [3588400, 3734600, 3450000, 121]);
  const older = parseShortlist({ ...shortlist, listings: [{ ...shortlist.listings[0], walk_away_price: 35500 }] });
  assert.ok(!('walk_away_cents' in older.listings[0]), 'a saved search from before walk-away prices were dropped still submits');
  assert.equal(parsed.listings[0].vin, '4S4WMAUD7P3412345');
  assert.equal(parsed.listings[1].market_price_cents, null);
  assert.equal(parseShortlist({ summary: 'Nothing under budget nearby.', listings: [], dealer_emails: [] }).listings.length, 0);

  const bad = {
    summary: '',
    listings: [{ ...shortlist.listings[0], listing_url: 'javascript:alert(1)', target_price: 34500.5 }, { ...shortlist.listings[1], rank: 1 }],
    dealer_emails: [{ ...shortlist.dealer_emails[0], to: 'sales at dealer', listing_ranks: [7] }]
  };
  assert.throws(() => parseShortlist(bad), error => {
    assert.ok(error instanceof ShortlistError);
    assert.deepEqual(error.problems, [
      'summary is required', 'listings[0].target_price must be a whole number from 0 to 1000000',
      'listings[0].listing_url must be an http(s) URL', 'listings[1].rank 1 is used twice',
      'dealer_emails[0].listing_ranks must list the ranks of the cars this email asks about', 'dealer_emails[0].to must be one email address'
    ]);
    return true;
  });
});

// The same shortlist as the car search skill writes it once the Deal Tracker is on.
const trackerShortlist = { ...shortlist, listings: [
  { ...shortlist.listings[0], est_otd: 38250, color: '  Crimson\n Red Pearl ' },
  { ...shortlist.listings[1], est_otd: 36900, color: 'Magnetite Gray Metallic' }
] };

test('with the Deal Tracker on, every car needs our estimated total and its color', () => {
  const parsed = parseShortlist(trackerShortlist, { requireTracker: true });
  assert.deepEqual(parsed.listings.map(listing => [listing.est_otd_cents, listing.color]),
    [[3825000, 'Crimson Red Pearl'], [3690000, 'Magnetite Gray Metallic']]);

  assert.throws(() => parseShortlist({ ...shortlist, listings: [shortlist.listings[0], { ...trackerShortlist.listings[1], color: ' ' }] },
    { requireTracker: true }), error => {
    assert.deepEqual(error.problems, [
      'listings[0].est_otd is required: our estimated out-the-door total in whole dollars',
      'listings[0].color is required: the exterior color as the listing gives it',
      'listings[1].color is required: the exterior color as the listing gives it'
    ]);
    return true;
  });

  const bad = listings => () => parseShortlist({ ...trackerShortlist, listings }, { requireTracker: true });
  const [one] = trackerShortlist.listings;
  assert.throws(bad([{ ...one, est_otd: -1 }, { ...one, rank: 2, est_otd: 38250.5 }, { ...one, rank: 3, est_otd: 1_000_001 },
    { ...one, rank: 4, color: 'x'.repeat(61) }, { ...one, rank: 5, color: 7 }]), error => {
    assert.deepEqual(error.problems, [
      'listings[0].est_otd must be a whole number from 0 to 1000000', 'listings[1].est_otd must be a whole number from 0 to 1000000',
      'listings[2].est_otd must be a whole number from 0 to 1000000', 'listings[3].color must be at most 60 characters',
      'listings[4].color must be a string'
    ]);
    return true;
  });

  // Switched off: neither field is needed, and ones that are sent are still checked.
  assert.deepEqual(parseShortlist(shortlist).listings.map(listing => [listing.est_otd_cents, listing.color]), [[null, null], [null, null]]);
  assert.deepEqual(parseShortlist(trackerShortlist).listings.map(listing => listing.est_otd_cents), [3825000, 3690000]);
  assert.throws(() => parseShortlist({ ...shortlist, listings: [{ ...one, est_otd: -1 }] }), /est_otd must be a whole number/);
});

test('photos are up to 20 https URLs on a named host, in order; anything else is reported', () => {
  const one = trackerShortlist.listings[0];
  const photos = ['https://cdn.example.test/a.jpg', 'https://photos.dealer.example/b.webp?w=1024'];
  const parsed = parseShortlist({ ...trackerShortlist, listings: [{ ...one, photos }] }, { requireTracker: true });
  assert.deepEqual(parsed.listings[0].photo_urls, photos);
  assert.deepEqual(parseShortlist(trackerShortlist, { requireTracker: true }).listings[0].photo_urls, [], 'optional: none is an empty list');

  const bad = ['http://cdn.example.test/a.jpg', 'https://10.0.0.5/a.jpg', 'https://localhost/a.jpg', 'https://intranet/a.jpg',
    'https://user:pass@cdn.example.test/a.jpg', 'https://cdn.example.test:8443/a.jpg', 'https://[::1]/a.jpg', 'not a url', 42];
  assert.throws(() => parseShortlist({ ...trackerShortlist, listings: [{ ...one, photos: bad }] }), error => {
    assert.ok(error instanceof ShortlistError);
    assert.deepEqual(error.problems, bad.map((_, index) => `listings[0].photos[${index}] must be an https photo URL on a named host`));
    return true;
  });
  const many = Array.from({ length: 21 }, (_, index) => `https://cdn.example.test/${index}.jpg`);
  assert.throws(() => parseShortlist({ ...trackerShortlist, listings: [{ ...one, photos: many }] }), /listings\[0\]\.photos can hold at most 20 photos/);
  assert.throws(() => parseShortlist({ ...trackerShortlist, listings: [{ ...one, photos: 'https://cdn.example.test/a.jpg' }] }), /listings\[0\]\.photos must be a list of photo URLs/);
});

test('details keep only the named listing fields and up to 40 features; an unknown key is reported', () => {
  const one = trackerShortlist.listings[0];
  const details = { trim: ' Limited ', drivetrain: 'AWD', engine: '2.4L turbo', mpg: 21, interior_color: 'Slate Black', seats: 7,
    features: ['Heated seats', ' Heated   seats ', 'Third row'] };
  const parsed = parseShortlist({ ...trackerShortlist, listings: [{ ...one, details }] });
  assert.deepEqual(parsed.listings[0].details, { trim: 'Limited', drivetrain: 'AWD', engine: '2.4L turbo', mpg: '21', interior_color: 'Slate Black', seats: '7',
    features: ['Heated seats', 'Third row'] });
  assert.deepEqual(parseShortlist(trackerShortlist).listings[0].details, {}, 'optional: none is an empty object');
  for (const [key] of DETAIL_FIELDS) assert.ok(parseShortlist({ ...trackerShortlist, listings: [{ ...one, details: { [key]: 'x' } }] }).listings[0].details[key] === 'x', key);

  assert.throws(() => parseShortlist({ ...trackerShortlist, listings: [{ ...one, details: { trim: 'XLE', vin: 'nope', dealer_name: 'Dealer One' } }] }), error => {
    assert.ok(error.problems.some(problem => problem.startsWith('listings[0].details.vin isn\'t a detail the page shows')));
    assert.ok(error.problems.some(problem => problem.startsWith('listings[0].details.dealer_name isn\'t a detail the page shows')));
    return true;
  });
  assert.throws(() => parseShortlist({ ...trackerShortlist, listings: [{ ...one, details: { engine: 'x'.repeat(121) } }] }), /details\.engine must be one line of text, up to 120 characters/);
  assert.throws(() => parseShortlist({ ...trackerShortlist, listings: [{ ...one, details: { trim: { name: 'XLE' } } }] }), /details\.trim must be one line/);
  const tooMany = Array.from({ length: 41 }, (_, index) => `Feature ${index}`);
  assert.throws(() => parseShortlist({ ...trackerShortlist, listings: [{ ...one, details: { features: tooMany } }] }), /details\.features must be a list of up to 40 features/);
  assert.throws(() => parseShortlist({ ...trackerShortlist, listings: [{ ...one, details: ['AWD'] }] }), /details must be an object of listing details/);
});

test('dealer email links verify only for the draft they were made for', () => {
  const links = dealLinkSettings(environment);
  const draftId = '4b4f163a-6c85-4ffd-8b93-df90e5b017e9';
  const link = draftToken(links, draftId);
  assert.equal(verifyDraftToken(links, link), draftId);
  assert.equal(verifyDraftToken(links, link.replace(draftId, 'c2d1f0b4-3a9e-4f7a-9d38-1f6b2e0c5a77')), null);
  assert.equal(verifyDraftToken(dealLinkSettings({ ...environment, DEAL_LINK_SECRET: 'x'.repeat(40) }), link), null);
  assert.equal(verifyDraftToken(links, 'not-a-token'), null);
});

test('the intake email carries the command that starts its car search', () => {
  const onboardingId = '4b4f163a-6c85-4ffd-8b93-df90e5b017e9';
  const { text, html } = renderIntakeEmail({ onboarding_id: onboardingId, name: 'Pat Buyer', email: 'pat@example.test', phone: '',
    city: 'Tuscaloosa, AL', tier_id: 'full_service', amount_total: 39500, currency: 'usd', fields });
  assert.ok(text.includes(`Start the car search in Claude Code (Barton folder):\n/car-search ${onboardingId}`));
  assert.ok(html.includes(`/car-search ${onboardingId}`));
});

test('a car search goes from intake to a shortlist, and its first emails go out from Zoho or to Grokbot', async t => {
  t.mock.method(console, 'error', () => {});
  const pg = await PGlite.create();
  t.after(() => pg.close());
  const sql = tagged(pg);
  for (const migration of migrations) await pg.exec(migration);
  const addIntake = async () => {
    const intake = crypto.randomUUID(), attempt = crypto.randomUUID(), purchase = crypto.randomUUID(), session = `cs_live_${intake}`;
    await pg.query(`INSERT INTO checkout_attempts (id, client_reference_id, idempotency_key, request_hash, tier_id, expected_amount, status)
      VALUES ($1, $1, $2, $3, 'full_service', 39500, 'paid')`, [attempt, attempt, 'a'.repeat(64)]);
    await pg.query(`INSERT INTO stripe_events (event_id, event_type, checkout_session_id, livemode, stripe_created_at)
      VALUES ($1, 'checkout.session.completed', $2, true, now())`, [session, session]);
    await pg.query(`INSERT INTO purchases (id, checkout_session_id, checkout_attempt_id, client_reference_id, stripe_event_id,
      stripe_payment_intent_id, tier_id, amount_total, currency, payment_status, livemode, paid_at)
      VALUES ($1, $2, $3, $4, $5, 'pi_123', 'full_service', 39500, 'usd', 'paid', true, now())`, [purchase, session, attempt, attempt, session]);
    await pg.query(`INSERT INTO onboarding_submissions (id, checkout_session_id, purchase_id, idempotency_key, request_hash, tier_id, name, email, phone, city, fields)
      VALUES ($1, $2, $3, $6, $4, 'full_service', 'Pat Buyer', 'pat@example.test', '205-555-0100', 'Tuscaloosa, AL', $5)`,
    [intake, session, purchase, 'b'.repeat(64), JSON.stringify(fields), intake]);
    return intake;
  };
  const id = await addIntake();

  const mail = [];
  const createTransport = () => ({ async sendMail(message) { mail.push(message); }, close() {} });
  const api = carSearchHandler({ environment, getDatabase: () => sql });
  const get = async (intake, authorization = `Bearer ${token}`) => {
    const res = response();
    await api({ method: 'GET', url: `/api/car-search?intake=${intake}`, headers: { host: 'www.steermeright.com', authorization } }, res);
    return res;
  };
  const post = async body => {
    const res = response();
    await api({ method: 'POST', url: '/api/car-search', body,
      headers: { host: 'www.steermeright.com', authorization: `Bearer ${token}`, 'content-type': 'application/json' } }, res);
    return res;
  };
  let drafts;

  await t.test('only the token holder can read an intake, and private details stay out', async () => {
    const off = response();
    await carSearchHandler({ environment: {} })({ method: 'GET', url: '/api/car-search', headers: {} }, off);
    assert.equal(off.statusCode, 503);
    assert.equal((await get(id, 'Bearer wrong')).statusCode, 401);
    assert.equal((await get(crypto.randomUUID())).statusCode, 404);

    const res = await get(id);
    assert.equal(res.statusCode, 200);
    const body = json(res);
    assert.deepEqual([body.buyer, body.lives_in, body.plan, body.shortlist], ['Pat Buyer', 'Tuscaloosa, AL', 'Steer Me Right ($395)', null]);
    assert.deepEqual(body.search, { Car: 'Subaru Ascent', 'Model years': '2024 or newer', 'All-in budget': 'Up to $38,000',
      'How far': '100 miles', Features: 'AWD, Moonroof' });
    for (const hidden of ['12 Private Lane', 'ABC1234', 'pat@example.test', '205-555-0100']) assert.ok(!res.body.includes(hidden), hidden);
  });

  await t.test('an invalid shortlist saves nothing and lists what to fix', async () => {
    const res = await post({ intake_id: id, shortlist: { summary: 'x', listings: 'none' } });
    assert.equal(res.statusCode, 422);
    assert.deepEqual(json(res).problems, ['listings must be an array', 'dealer_emails must be an array']);
    assert.equal((await pg.query('SELECT count(*)::int AS n FROM deals')).rows[0].n, 0);
  });

  await t.test('a valid shortlist is saved, and nothing is emailed', async () => {
    const res = await post({ intake_id: id, shortlist });
    assert.equal(res.statusCode, 200);
    const body = json(res);
    drafts = (await pg.query('SELECT * FROM dealer_email_drafts ORDER BY created_at')).rows;
    assert.deepEqual(body, { ok: true, cars: 2, dealer_emails: [{ dealer: 'Dealer One', to: 'sales@dealer-one.example' }] });
    assert.deepEqual(drafts.map(row => [row.listing_ranks, row.status]), [[[1], 'pending']]);

    assert.equal(mail.length, 0);
    assert.equal(json(await get(id)).shortlist.cars, 2);
  });

  await t.test('submitting again replaces the shortlist', async () => {
    const res = await post({ intake_id: id, shortlist: { ...shortlist, listings: shortlist.listings.slice(0, 1) } });
    assert.equal(res.statusCode, 200);
    assert.equal(json(res).cars, 1);
    assert.equal((await pg.query('SELECT count(*)::int AS n FROM deal_listings')).rows[0].n, 1);
    drafts = (await pg.query('SELECT * FROM dealer_email_drafts')).rows;
    assert.equal(drafts.length, 1);
  });

  await t.test('the draft page shows the email, and only a same-origin POST sends it', async () => {
    const page = dealerEmailHandler({ environment, getDatabase: () => sql, createTransport });
    const link = draftToken(dealLinkSettings(environment), drafts[0].id);

    const view = response();
    await page({ method: 'GET', url: `/api/dealer-email?token=${encodeURIComponent(link)}`, headers: { host: 'www.steermeright.com' } }, view);
    assert.equal(view.statusCode, 200);
    assert.equal(view.headers['x-robots-tag'], 'noindex, nofollow');
    assert.ok(view.body.includes('2025 Subaru Ascent Limited availability'));
    assert.ok(view.body.includes('name="action" value="send"'));
    assert.equal(mail.length, 0, 'opening the link sends nothing');

    const missing = response();
    await page({ method: 'GET', url: '/api/dealer-email?token=bad', headers: { host: 'www.steermeright.com' } }, missing);
    assert.equal(missing.statusCode, 404);

    const form = new URLSearchParams({ token: link, action: 'send', to: 'internet@dealer-one.example',
      subject: 'Ascent Limited: out-the-door price?', body: 'Hello,\n\nEdited by Mason.' }).toString();
    const request = (origin = 'http://localhost:3000') => ({ method: 'POST', url: '/api/dealer-email', rawBody: Buffer.from(form),
      headers: { host: 'www.steermeright.com', origin, 'content-type': 'application/x-www-form-urlencoded' } });

    const crossSite = response();
    await page(request('https://evil.example'), crossSite);
    assert.equal(crossSite.statusCode, 403);

    const sent = response();
    await page(request(), sent);
    assert.equal(sent.statusCode, 303);
    assert.match(sent.headers.location, /&done=sent$/);
    assert.equal(mail.length, 1);
    assert.deepEqual([mail[0].to, mail[0].subject, mail[0].text], ['internet@dealer-one.example', 'Ascent Limited: out-the-door price?', 'Hello,\n\nEdited by Mason.\n']);
    assert.deepEqual(mail[0].from, { name: 'Steer Me Right', address: 'mason@steermeright.com' });
    assert.equal((await pg.query('SELECT status FROM dealer_email_drafts WHERE id = $1', [drafts[0].id])).rows[0].status, 'sent');

    const twice = response();
    await page(request(), twice);
    assert.equal(twice.statusCode, 409);
    assert.ok(twice.body.includes('This email was already sent'));
    assert.ok(!twice.body.includes('value="send"'), 'a sent draft has no send button');
    assert.equal(mail.length, 1, 'a second press sends nothing');
  });

  await t.test('once a dealer email has gone out, the shortlist cannot be replaced or handed to Grokbot', async () => {
    const res = await post({ intake_id: id, shortlist });
    assert.equal(res.statusCode, 409);
    assert.equal(json(res).error, 'emails_already_sent');
    assert.equal((await pg.query('SELECT count(*)::int AS n FROM deal_listings')).rows[0].n, 1);
    const handoff = await post({ intake_id: id, action: 'handoff' });
    assert.deepEqual([handoff.statusCode, json(handoff).error], [409, 'started_in_zoho']);
  });

  await t.test('a handoff gives Grokbot the deal, and the buyer\'s details stay in Neon', async () => {
    const other = await addIntake();
    assert.equal((await post({ intake_id: other, action: 'handoff' })).statusCode, 409, 'no shortlist yet');
    assert.equal((await post({ intake_id: other, action: 'send' })).statusCode, 400);
    assert.equal((await post({ intake_id: other, shortlist })).statusCode, 200);

    const res = await post({ intake_id: other, action: 'handoff' });
    assert.equal(res.statusCode, 200);
    const ref = other.slice(0, 8);
    assert.deepEqual(json(res).handoff, {
      type: 'new_deal', intake_id: other, deal: ref, label: `Deals/${ref} · Subaru Ascent`,
      search: { lives_in: 'Tuscaloosa, AL', details: { Car: 'Subaru Ascent', 'Model years': '2024 or newer',
        'All-in budget': 'Up to $38,000', 'How far': '100 miles', Features: 'AWD, Moonroof' } },
      summary: shortlist.summary,
      cars: [
        { rank: 1, title: '2025 Subaru Ascent Limited, Crimson Red / Slate Black', vin: '4S4WMAUD7P3412345',
          listing_url: 'https://dealer-one.example/ascent', dealer: 'Dealer One', dealer_location: 'Johnson City, TN (about 370 mi)',
          dealer_phone: null, asking: 35884, market: 37346, target: 34500, mileage: 15203, days_on_lot: 121, why: 'Price already cut once.' },
        { rank: 2, title: '2024 Subaru Ascent Touring', vin: null, listing_url: 'https://dealer-two.example/a', dealer: 'Dealer Two',
          dealer_location: null, dealer_phone: '229-555-0199', asking: 34433, market: null, target: null, mileage: null,
          days_on_lot: null, why: '' }
      ],
      dealers: [{ dealer: 'Dealer One', to: 'sales@dealer-one.example', ranks: [1],
        subject: '2025 Subaru Ascent Limited availability', body: 'Hello,\n\nIs the Ascent still available?\n\nMason' }]
    });
    for (const hidden of ['Pat Buyer', 'pat@example.test', '205-555-0100', '12 Private Lane', 'ABC1234', 'Steer Me Right']) {
      assert.ok(!res.body.includes(hidden), hidden);
    }

    const again = await post({ intake_id: other, action: 'handoff' });
    assert.deepEqual(json(again), json(res), 'a retry returns the same handoff');
    const [draft] = (await pg.query(`SELECT d.* FROM dealer_email_drafts AS d JOIN deals ON deals.id = d.deal_id
      WHERE deals.onboarding_id = $1`, [other])).rows;
    assert.equal(draft.status, 'handed_off');
    const replaced = await post({ intake_id: other, shortlist });
    assert.deepEqual([replaced.statusCode, json(replaced).error], [409, 'emails_already_sent']);

    const page = dealerEmailHandler({ environment, getDatabase: () => sql, createTransport });
    const view = response();
    await page({ method: 'GET', url: `/api/dealer-email?token=${encodeURIComponent(draftToken(dealLinkSettings(environment), draft.id))}`,
      headers: { host: 'www.steermeright.com' } }, view);
    assert.ok(view.body.includes('Handed to Grokbot'));
    assert.ok(!view.body.includes('value="send"'), 'an old link cannot send a handed-off email from Zoho');
  });

  await t.test('Grokbot logs each deal\'s quotes in deal_events, once per car per Gmail message', async () => {
    const other = (await pg.query('SELECT onboarding_id FROM deals ORDER BY created_at DESC LIMIT 1')).rows[0].onboarding_id;
    const log = (kind, message, otd, vin = '4S4WMAUD7P3412345') => pg.query(`INSERT INTO deal_events (onboarding_id, kind, dealer_name, vin, otd_cents, itemized, source_message_id)
      VALUES ($1, $2, 'Dealer One', $6, $3, $4, $5) ON CONFLICT DO NOTHING RETURNING id`,
    [other, kind, otd, JSON.stringify({ sale_price_cents: 3588400, doc_fee_cents: 22500 }), message, vin]);
    assert.equal((await log('quote', 'gmail-1', 3870900)).rows.length, 1);
    assert.equal((await log('quote', 'gmail-1', 3870900)).rows.length, 0, 'a rerun logs the same email once');
    assert.equal((await log('quote', 'gmail-1', 3790000, '4S4WMAUD7P3499999')).rows.length, 1, 'one email can quote two cars');
    assert.equal((await log('quote', 'gmail-5', 3790000, null)).rows.length, 1);
    assert.equal((await log('quote', 'gmail-5', 3790000, null)).rows.length, 0, 'a car without a VIN is logged once too');
    assert.equal((await log('counter', 'gmail-2', 3720000)).rows.length, 1);
    await assert.rejects(log('offer', 'gmail-3', 1), /deal_events_kind_valid/);
    await assert.rejects(log('quote', 'gmail-4', -1), /deal_events_otd_valid/);
    await assert.rejects(pg.query(`INSERT INTO deal_events (onboarding_id, kind) VALUES ($1, 'note')`, [crypto.randomUUID()]), /foreign key/);
  });
});

test('a shortlist for a deal opened at paid intake fills that same deal and moves it out of Confirming search', async () => {
  const pg = await PGlite.create();
  const sql = tagged(pg);
  for (const migration of migrations) await pg.exec(migration);
  const intake = crypto.randomUUID(), attempt = crypto.randomUUID(), purchase = crypto.randomUUID(), session = `cs_live_${intake}`;
  await pg.query(`INSERT INTO checkout_attempts (id, client_reference_id, idempotency_key, request_hash, tier_id, expected_amount, status)
    VALUES ($1, $2, $3, $4, 'full_service', 39500, 'paid')`, [attempt, attempt, attempt, 'a'.repeat(64)]);
  await pg.query(`INSERT INTO stripe_events (event_id, event_type, checkout_session_id, livemode, stripe_created_at)
    VALUES ($1, 'checkout.session.completed', $2, true, now())`, [session, session]);
  await pg.query(`INSERT INTO purchases (id, checkout_session_id, checkout_attempt_id, client_reference_id, stripe_event_id,
    stripe_payment_intent_id, tier_id, amount_total, currency, payment_status, livemode, paid_at)
    VALUES ($1, $2, $3, $4, $5, 'pi_123', 'full_service', 39500, 'usd', 'paid', true, now())`, [purchase, session, attempt, attempt, session]);
  await pg.query(`INSERT INTO onboarding_submissions (id, checkout_session_id, purchase_id, idempotency_key, request_hash, tier_id, name, email, phone, city, fields)
    VALUES ($1, $2, $3, $6, $4, 'full_service', 'Pat Buyer', 'pat@example.test', '205-555-0100', 'Tuscaloosa, AL', $5)`,
  [intake, session, purchase, 'b'.repeat(64), JSON.stringify(fields), intake]);
  // What POST /api/onboarding does with the Deal Tracker switched on.
  const dealId = crypto.randomUUID();
  await pg.query('INSERT INTO deals (id, onboarding_id) VALUES ($1, $2)', [dealId, intake]);
  await pg.query('INSERT INTO deal_tracker_links (onboarding_id) VALUES ($1)', [intake]);

  const stage = async () => {
    const detail = await loadDeal(sql, intake);
    return summarizeDeal(detail.deal, [...detail.events].reverse(), detail.listings).stage;
  };
  assert.equal((await loadSearch(sql, intake)).shortlist, null, 'a deal in Confirming search has no shortlist yet');
  assert.equal(await stage(), 'confirming');

  const saved = await saveShortlist(sql, intake, parseShortlist(shortlist));
  assert.equal(saved.dealId, dealId, 'the deal opened at intake keeps its ID');
  const deals = (await pg.query('SELECT id, shortlisted_at FROM deals WHERE onboarding_id = $1', [intake])).rows;
  assert.equal(deals.length, 1);
  assert.ok(deals[0].shortlisted_at);
  assert.equal((await loadSearch(sql, intake)).shortlist.cars, 2);
  assert.equal(await stage(), 'shortlisted');
  assert.equal((await pg.query('SELECT count(*)::int AS n FROM deal_tracker_links WHERE onboarding_id = $1', [intake])).rows[0].n, 1);
  await pg.close();
});

test('the helper script calls the API with the token from .env.local', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'car-search-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  await writeFile(join(dir, '.env.local'), `# local\nCAR_SEARCH_TOKEN="${token}"\nCAR_SEARCH_URL=http://localhost:3000/\n`);
  const environment = localEnv(join(dir, '.env.local'));
  assert.deepEqual(environment, { CAR_SEARCH_TOKEN: token, CAR_SEARCH_URL: 'http://localhost:3000/' });

  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    calls.push({ url, init });
    return { status: 200, json: async () => ({ ok: true }) };
  };
  await carSearchRequest(['get', 'abc'], { environment, fetchImpl });
  assert.equal(calls[0].url, 'http://localhost:3000/api/car-search?intake=abc');
  assert.equal(calls[0].init.headers.Authorization, `Bearer ${token}`);

  await writeFile(join(dir, 'shortlist.json'), JSON.stringify(shortlist));
  await carSearchRequest(['submit', 'abc', join(dir, 'shortlist.json')], { environment, fetchImpl });
  assert.equal(calls[1].init.method, 'POST');
  assert.deepEqual(JSON.parse(calls[1].init.body), { intake_id: 'abc', shortlist });

  await assert.rejects(carSearchRequest(['get', 'abc'], { environment: {}, fetchImpl }), /CAR_SEARCH_TOKEN is not set/);
  await assert.rejects(carSearchRequest(['submit', 'abc'], { environment, fetchImpl }), /Usage/);
  await assert.rejects(carSearchRequest(['handoff', 'abc'], { environment, fetchImpl }), /DEALER_BOT_URL and DEALER_BOT_KEY are not set/);
  assert.equal(calls.length, 2, 'a handoff without the webhook settings never reaches the server');
});

test('handoff posts the server\'s handoff to Grokbot\'s webhook with its key', async () => {
  const environment = { CAR_SEARCH_TOKEN: token, DEALER_BOT_URL: 'https://bot.example/hooks/new-deal', DEALER_BOT_KEY: 'bot-key-123' };
  const handoff = { type: 'new_deal', deal: 'abcd1234', dealers: [{ dealer: 'Dealer One' }] };
  const calls = [];
  const fetchFor = webhook => async (url, init = {}) => {
    calls.push({ url, init });
    return url.startsWith('https://www.steermeright.com') ? { status: 200, json: async () => ({ ok: true, handoff }) } : webhook;
  };

  const sent = await carSearchRequest(['handoff', 'abc'], { environment,
    fetchImpl: fetchFor({ ok: true, status: 200, text: async () => '{"success":true,"runUuid":"run-1"}' }) });
  assert.deepEqual(JSON.parse(calls[0].init.body), { intake_id: 'abc', action: 'handoff' });
  assert.equal(calls[1].url, 'https://bot.example/hooks/new-deal');
  assert.deepEqual(calls[1].init.headers, { Authorization: 'Bearer bot-key-123', 'Content-Type': 'application/json' });
  assert.deepEqual(JSON.parse(calls[1].init.body), handoff);
  assert.equal(sent.status, 200);
  assert.deepEqual([sent.body.ok, sent.body.deal, sent.body.dealer_emails, sent.body.grokbot], [true, 'abcd1234', 1, { success: true, runUuid: 'run-1' }]);

  const refused = await carSearchRequest(['handoff', 'abc'], { environment,
    fetchImpl: fetchFor({ ok: false, status: 401, text: async () => '{"message":"Invalid API key bot-key-123"}' }) });
  assert.equal(refused.status, 502);
  assert.equal(refused.body.ok, false);
  assert.ok(!JSON.stringify(refused.body).includes('bot-key-123'), 'the key is never printed');

  await assert.rejects(carSearchRequest(['handoff', 'abc'], { environment: { ...environment, DEALER_BOT_URL: 'http://bot.example' },
    fetchImpl: fetchFor(null) }), /https/);
});

async function addIntake(pg) {
  const intake = crypto.randomUUID(), attempt = crypto.randomUUID(), purchase = crypto.randomUUID(), session = `cs_live_${intake}`;
  await pg.query(`INSERT INTO checkout_attempts (id, client_reference_id, idempotency_key, request_hash, tier_id, expected_amount, status)
    VALUES ($1, $1, $2, $3, 'full_service', 39500, 'paid')`, [attempt, attempt, 'a'.repeat(64)]);
  await pg.query(`INSERT INTO stripe_events (event_id, event_type, checkout_session_id, livemode, stripe_created_at)
    VALUES ($1, 'checkout.session.completed', $2, true, now())`, [session, session]);
  await pg.query(`INSERT INTO purchases (id, checkout_session_id, checkout_attempt_id, client_reference_id, stripe_event_id,
    stripe_payment_intent_id, tier_id, amount_total, currency, payment_status, livemode, paid_at)
    VALUES ($1, $2, $3, $4, $5, 'pi_123', 'full_service', 39500, 'usd', 'paid', true, now())`, [purchase, session, attempt, attempt, session]);
  await pg.query(`INSERT INTO onboarding_submissions (id, checkout_session_id, purchase_id, idempotency_key, request_hash, tier_id, name, email, phone, city, fields)
    VALUES ($1, $2, $3, $6, $4, 'full_service', 'Pat Buyer', 'pat@example.test', '205-555-0100', 'Tuscaloosa, AL', $5)`,
  [intake, session, purchase, 'b'.repeat(64), JSON.stringify(fields), intake]);
  return intake;
}

async function database(t, migrationList) {
  const pg = await PGlite.create();
  t.after(() => pg.close());
  for (const migration of migrationList) await pg.exec(migration);
  return pg;
}

const listingsOf = (pg, intake) => pg.query(`SELECT l.* FROM deal_listings AS l JOIN deals AS d ON d.id = l.deal_id
  WHERE d.onboarding_id = $1 ORDER BY l.rank`, [intake]).then(result => result.rows);

test('saveShortlist stores each car\'s estimated total, color, photos and details only with the Deal Tracker on', async t => {
  const pg = await database(t, migrations);
  const sql = tagged(pg);
  const on = await addIntake(pg);
  const photos = ['https://cdn.example.test/1.jpg', 'https://cdn.example.test/2.jpg'];
  const details = { trim: 'Limited', drivetrain: 'AWD', features: ['Third row'] };
  const withMedia = { ...trackerShortlist, listings: [{ ...trackerShortlist.listings[0], photos, details }, trackerShortlist.listings[1]] };
  await saveShortlist(sql, on, parseShortlist(withMedia, { requireTracker: true }), { tracker: true });
  assert.deepEqual((await listingsOf(pg, on)).map(row => [row.rank, row.est_otd_cents, row.color, row.photo_urls, row.details]),
    [[1, 3825000, 'Crimson Red Pearl', photos, details], [2, 3690000, 'Magnetite Gray Metallic', [], {}]]);

  const off = await addIntake(pg);
  await saveShortlist(sql, off, parseShortlist(withMedia));
  assert.deepEqual((await listingsOf(pg, off)).map(row => [row.est_otd_cents, row.color, row.photo_urls, row.details]),
    [[null, null, [], {}], [null, null, [], {}]], 'switched off, the columns keep their defaults');
});

test('photos and details go to Postgres as text, so postgres.js can\'t encode them twice', async () => {
  const queries = [];
  const tx = async (strings, ...values) => {
    const query = strings.join('?');
    queries.push(query);
    if (query.includes('SELECT id FROM deals')) return [{ id: 'deal-1' }];
    if (query.includes('count(*)')) return [{ count: 0 }];
    return [];
  };
  const sql = { begin: work => work(tx) };
  await saveShortlist(sql, 'intake-1', parseShortlist(trackerShortlist, { requireTracker: true }), { tracker: true });
  const insert = queries.find(query => query.includes('INSERT INTO deal_listings'));
  assert.match(insert, /\?::text::jsonb, \?::text::jsonb\)/);
});

test('with the Deal Tracker off, saveShortlist works on a database without db/013', async t => {
  const pg = await database(t, migrationsBefore013);
  const sql = tagged(pg);
  const intake = await addIntake(pg);
  const saved = await saveShortlist(sql, intake, parseShortlist(trackerShortlist));
  assert.equal(saved.locked, false);
  const rows = await listingsOf(pg, intake);
  assert.equal(rows.length, 2);
  assert.ok(!('est_otd_cents' in rows[0]), 'the database really is from before db/013');
  await assert.rejects(saveShortlist(sql, intake, parseShortlist(trackerShortlist), { tracker: true }), /est_otd_cents/);
});

test('the car search endpoint requires and stores the estimate and color only when the Deal Tracker is on', async t => {
  const call = async (api, body) => {
    const res = response();
    await api({ method: 'POST', url: '/api/car-search', body,
      headers: { host: 'www.steermeright.com', authorization: `Bearer ${token}`, 'content-type': 'application/json' } }, res);
    return res;
  };

  const pg = await database(t, migrations);
  const sql = tagged(pg);
  const on = carSearchHandler({ environment: { ...environment, DEAL_TRACKER_ENABLED: 'true' }, getDatabase: () => sql });
  const intake = await addIntake(pg);
  const missing = await call(on, { intake_id: intake, shortlist });
  assert.equal(missing.statusCode, 422);
  assert.deepEqual(json(missing).problems, [
    'listings[0].est_otd is required: our estimated out-the-door total in whole dollars',
    'listings[0].color is required: the exterior color as the listing gives it',
    'listings[1].est_otd is required: our estimated out-the-door total in whole dollars',
    'listings[1].color is required: the exterior color as the listing gives it'
  ]);
  assert.equal((await pg.query('SELECT count(*)::int AS n FROM deal_listings')).rows[0].n, 0);

  const saved = await call(on, { intake_id: intake, shortlist: trackerShortlist });
  assert.equal(saved.statusCode, 200);
  assert.deepEqual(json(saved), { ok: true, cars: 2, dealer_emails: [{ dealer: 'Dealer One', to: 'sales@dealer-one.example' }] });
  assert.deepEqual((await listingsOf(pg, intake)).map(row => [row.est_otd_cents, row.color]),
    [[3825000, 'Crimson Red Pearl'], [3690000, 'Magnetite Gray Metallic']]);

  // Switched off, against production as it is before db/013: today's body and the new one both save.
  const before = await database(t, migrationsBefore013);
  const beforeSql = tagged(before);
  const off = carSearchHandler({ environment, getDatabase: () => beforeSql });
  for (const body of [shortlist, trackerShortlist]) {
    const res = await call(off, { intake_id: await addIntake(before), shortlist: body });
    assert.equal(res.statusCode, 200);
    assert.equal(json(res).cars, 2);
  }
});

// Agents fetch a Buyer Document with the car-search token (plan, "Documents").
test('an agent downloads a Buyer Document with the bearer token, and deleted files are gone', async t => {
  const pg = await database(t, migrations);
  const sql = tagged(pg);
  const intake = await addIntake(pg);
  await pg.query('INSERT INTO deals (id, onboarding_id) VALUES ($1, $2)', [crypto.randomUUID(), intake]);
  const add = async ({ docType = 'pre_approval', deleted = false } = {}) => {
    const path = `deals/${intake}/${crypto.randomUUID()}.jpg`;
    const { rows: [row] } = await pg.query(`INSERT INTO buyer_documents (onboarding_id, doc_type, blob_path, content_type, bytes, deleted_at)
      VALUES ($1, $2, $3, 'image/jpeg', 11, $4) RETURNING id`,
    [intake, docType, path, deleted ? new Date().toISOString() : null]);
    return { id: Number(row.id), path };
  };
  const plain = await add();
  const idDoc = await add({ docType: 'id' });
  const gone = await add({ deleted: true });
  const reads = [];
  const store = {
    async get(pathname) { reads.push(pathname); return { body: Buffer.from('JPEG-BYTES!'), size: 11, contentType: 'image/jpeg' }; },
    async presignUpload() { throw new Error('no'); }, async head() { throw new Error('no'); }, async del() { throw new Error('no'); }
  };
  const on = { ...environment, DEAL_TRACKER_ENABLED: '1', DEAL_TRACKER_SECRET: 'deal-tracker-secret-for-tests-only-0123456789', BLOB_READ_WRITE_TOKEN: 'vercel_blob_rw_test' };
  const get = async (id, { env = on, auth = `Bearer ${token}` } = {}) => {
    const res = response();
    await carSearchHandler({ environment: env, getDatabase: () => sql, documentStore: store })(
      { method: 'GET', url: `/api/car-search?document=${id}`, headers: { host: 'www.steermeright.com', ...(auth ? { authorization: auth } : {}) } }, res);
    return res;
  };

  assert.equal((await get(plain.id, { auth: null })).statusCode, 401);
  assert.equal((await get(plain.id, { auth: 'Bearer wrong' })).statusCode, 401);
  const ok = await get(plain.id);
  assert.equal(ok.statusCode, 200);
  assert.equal(ok.body, 'JPEG-BYTES!');
  assert.deepEqual([ok.headers['content-type'], ok.headers['content-disposition'], ok.headers['x-content-type-options'], ok.headers['content-security-policy']],
    ['image/jpeg', `attachment; filename="pre_approval-${plain.id}.jpg"`, 'nosniff', "sandbox; default-src 'none'"]);
  assert.match(ok.headers['cache-control'], /no-store/);

  const id = await get(idDoc.id);
  assert.equal(id.statusCode, 200);
  assert.equal(id.headers['content-disposition'], `attachment; filename="id-${idDoc.id}.jpg"`);

  assert.equal((await get(gone.id)).statusCode, 410);
  assert.equal(json(await get(987654)).error, 'document_not_found');
  assert.equal((await get(987654)).statusCode, 404);
  assert.equal((await get(plain.id, { env: environment })).statusCode, 404, 'Deal Tracker off');
  const unset = await get(plain.id, { env: { ...on, BLOB_READ_WRITE_TOKEN: '' } });
  assert.equal(unset.statusCode, 503);
  assert.equal(json(unset).error, 'documents_unavailable');
});

test('the helper script saves a Buyer Document where it is told, or under .car-searches/documents, and never prints it', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'car-search-doc-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const environment = { CAR_SEARCH_TOKEN: token, CAR_SEARCH_URL: 'http://localhost:3000' };
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    calls.push({ url, init });
    if (url.endsWith('document=404')) return { status: 404, json: async () => ({ ok: false, error: 'document_not_found' }) };
    return {
      status: 200,
      headers: new Headers({ 'content-type': 'application/pdf', 'content-disposition': 'attachment; filename="payoff_letter-12.pdf"' }),
      arrayBuffer: async () => new TextEncoder().encode('%PDF-PAYOFF').buffer
    };
  };
  const named = join(dir, 'nested', 'payoff.pdf');
  const saved = await carSearchRequest(['document', '12', named], { environment, fetchImpl });
  assert.equal(calls[0].url, 'http://localhost:3000/api/car-search?document=12');
  assert.equal(calls[0].init.headers.Authorization, `Bearer ${token}`);
  assert.deepEqual(saved, { status: 200, body: { ok: true, document: 12, saved: named, bytes: 11, content_type: 'application/pdf' } });
  assert.equal(await readFile(named, 'utf8'), '%PDF-PAYOFF');
  assert.ok(!JSON.stringify(saved).includes('PAYOFF'), 'the result never carries the contents');

  const byDefault = await carSearchRequest(['document', '12'], { environment, fetchImpl, documentsDir: join(dir, 'documents') });
  assert.equal(byDefault.body.saved, join(dir, 'documents', 'payoff_letter-12.pdf'));
  assert.equal(await readFile(byDefault.body.saved, 'utf8'), '%PDF-PAYOFF');

  const missing = await carSearchRequest(['document', '404'], { environment, fetchImpl, documentsDir: join(dir, 'documents') });
  assert.deepEqual(missing, { status: 404, body: { ok: false, error: 'document_not_found' } });
  for (const bad of [['document'], ['document', 'abc'], ['document', '../12']]) {
    await assert.rejects(carSearchRequest(bad, { environment, fetchImpl }), /Usage/, bad.join(' '));
  }
  assert.equal(calls.length, 3);
});
