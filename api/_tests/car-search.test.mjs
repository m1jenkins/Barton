import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { ConfigError } from '../_lib/config.js';
import { carSearchToken, parseShortlist, ShortlistError } from '../_lib/car-search.js';
import { dealJobSettings, dispatchDealJobs } from '../_lib/deal-jobs.js';
import { dealLinkSettings, draftToken, verifyDraftToken } from '../_lib/deal-email.js';
import { renderIntakeEmail } from '../_lib/intake-email.js';
import { carSearchHandler } from '../car-search.js';
import { dealerEmailHandler } from '../dealer-email.js';
import { outboxHandler } from '../outbox-dispatch.js';
import { carSearchRequest, localEnv } from '../../scripts/car-search.mjs';

const token = 'car-search-token-for-tests-only-0123456789';
const environment = {
  CAR_SEARCH_TOKEN: token, DEAL_LINK_SECRET: 'link-secret-for-tests-only-0123456789', APP_ORIGIN: 'https://www.steermeright.com',
  INTAKE_SMTP_USER: 'mason@steermeright.com', INTAKE_SMTP_PASSWORD: 'app-password-not-real'
};
const migrations = await Promise.all(['001_durable_leads_and_payments.sql', '002_standard_purchase_analytics.sql',
  '003_checkout_offer_snapshot.sql', '004_intake_email_outbox.sql', '005_deal_search.sql', '006_dealer_handoff.sql']
  .map(name => readFile(new URL(`../../db/${name}`, import.meta.url), 'utf8')));

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
      target_price: 34500, walk_away_price: 35500, mileage: 15203, days_on_lot: 121, vin: '4s4wmauD7p3412345',
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

test('the car search endpoint and emails stay off until their secrets are set', () => {
  assert.equal(carSearchToken({}), null);
  assert.throws(() => carSearchToken({ CAR_SEARCH_TOKEN: 'short' }), ConfigError);
  assert.equal(carSearchToken(environment), token);
  assert.ok(dealJobSettings({ ...environment, DEAL_LINK_SECRET: '' }), 'the shortlist email carries no links to sign');
  assert.equal(dealJobSettings({ ...environment, INTAKE_SMTP_USER: '', INTAKE_SMTP_PASSWORD: '' }), null, 'it needs SMTP');
  assert.ok(dealJobSettings(environment));
  assert.throws(() => dealLinkSettings({ DEAL_LINK_SECRET: 'short' }), ConfigError);
});

test('a shortlist is normalized to cents, and every problem in a bad one is reported at once', () => {
  const parsed = parseShortlist(shortlist);
  assert.deepEqual([parsed.listings[0].price_cents, parsed.listings[0].market_price_cents, parsed.listings[0].target_price_cents,
    parsed.listings[0].walk_away_cents, parsed.listings[0].days_on_lot], [3588400, 3734600, 3450000, 3550000, 121]);
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

test('a car search goes from intake to a shortlist email to a dealer email Mason sends', async t => {
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
  const api = carSearchHandler({ environment, getDatabase: () => sql, dispatch: opts => dispatchDealJobs({ ...opts, createTransport }) });
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

  await t.test('a valid shortlist is saved and emailed to Mason, with no send links', async () => {
    const res = await post({ intake_id: id, shortlist });
    assert.equal(res.statusCode, 200);
    const body = json(res);
    drafts = (await pg.query('SELECT * FROM dealer_email_drafts ORDER BY created_at')).rows;
    assert.deepEqual(body, { ok: true, cars: 2, email_to_mason: 'sent',
      dealer_emails: [{ dealer: 'Dealer One', to: 'sales@dealer-one.example' }] });
    assert.deepEqual(drafts.map(row => [row.listing_ranks, row.status]), [[[1], 'pending']]);

    assert.equal(mail.length, 1);
    assert.equal(mail[0].to, 'mason@steermeright.com');
    assert.equal(mail[0].subject, 'Car search ready: Subaru Ascent · Pat Buyer · 2 cars, 1 dealer email');
    for (const expected of ['Two Limiteds under market.', `Intake ID: ${id}`, 'go to Grokbot',
      '1. 2025 Subaru Ascent Limited, Crimson Red / Slate Black · $35,884 · 15,203 mi · 121 days on lot',
      '   Market $37,346 · target $34,500 · walk away at $35,500']) {
      assert.ok(mail[0].text.includes(expected), expected);
    }
    assert.ok(!(mail[0].text + mail[0].html).includes('/api/dealer-email'), 'no send links');
    assert.ok(!/\bbrief\b/i.test(mail[0].text + mail[0].html));
    assert.equal(json(await get(id)).shortlist.cars, 2);
  });

  await t.test('submitting again replaces the shortlist and emails Mason again', async () => {
    const res = await post({ intake_id: id, shortlist: { ...shortlist, listings: shortlist.listings.slice(0, 1) } });
    assert.equal(res.statusCode, 200);
    assert.equal(json(res).cars, 1);
    assert.equal((await pg.query('SELECT count(*)::int AS n FROM deal_listings')).rows[0].n, 1);
    assert.equal(mail.length, 2);
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
    assert.equal(mail.length, 2, 'opening the link sends nothing');

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
    assert.equal(mail.length, 3);
    assert.deepEqual([mail[2].to, mail[2].subject, mail[2].text], ['internet@dealer-one.example', 'Ascent Limited: out-the-door price?', 'Hello,\n\nEdited by Mason.\n']);
    assert.deepEqual(mail[2].from, { name: 'Steer Me Right', address: 'mason@steermeright.com' });
    assert.equal((await pg.query('SELECT status FROM dealer_email_drafts WHERE id = $1', [drafts[0].id])).rows[0].status, 'sent');

    const twice = response();
    await page(request(), twice);
    assert.equal(twice.statusCode, 409);
    assert.ok(twice.body.includes('This email was already sent'));
    assert.ok(!twice.body.includes('value="send"'), 'a sent draft has no send button');
    assert.equal(mail.length, 3, 'a second press sends nothing');
  });

  await t.test('once a dealer email has gone out, the shortlist cannot be replaced or handed to Grokbot', async () => {
    const res = await post({ intake_id: id, shortlist });
    assert.equal(res.statusCode, 409);
    assert.equal(json(res).error, 'emails_already_sent');
    assert.equal((await pg.query('SELECT count(*)::int AS n FROM deal_listings')).rows[0].n, 1);
    const handoff = await post({ intake_id: id, action: 'handoff' });
    assert.deepEqual([handoff.statusCode, json(handoff).error], [409, 'started_in_zoho']);
  });

  await t.test('a handoff gives Grokbot the deal without the buyer\'s details or the walk-away price', async () => {
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
    for (const hidden of ['Pat Buyer', 'pat@example.test', '205-555-0100', '12 Private Lane', 'ABC1234', '35500', 'Steer Me Right']) {
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

test('the daily cron retries shortlist emails beside the other outboxes', async () => {
  const secret = 'test-secret-for-bounded-cron-authentication';
  const request = { method: 'GET', headers: { authorization: `Bearer ${secret}` } };
  const res = { headers: {}, setHeader() {}, end(value) { this.body = JSON.parse(value); } };
  await outboxHandler({ environment: { CRON_SECRET: secret }, getDatabase() { throw Error('must not connect'); } })(request, res);
  assert.equal(res.body.workers.deals.configured, false);
});
