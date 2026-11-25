import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { ConfigError } from '../_lib/config.js';
import {
  cancelCustomerEmails, customerEmailSettings, dispatchCustomerEmails, enqueueIntakeEmails, scheduleClosedDeals
} from '../_lib/customer-email.js';
import { TEMPLATE_NAMES, buyerFromRow, renderCustomerEmail } from '../_lib/customer-emails/index.js';
import { GOOGLE_G } from '../_lib/email-layout.js';
import { runCustomerEmailWorker } from '../_lib/outbox-workers.js';
import { SAMPLE_BUYERS, SAMPLE_REVIEW_URL, renderSamples } from '../../scripts/customer-emails.mjs';
import { createHash } from 'node:crypto';
import { renderBuyerUpdateEmail } from '../_lib/buyer-update-email.js';
import { allowedOrigins } from '../_lib/config.js';
import { checkLink, dealTrackerSettings, linkUrl } from '../_lib/deal-tracker.js';
import { onboardingHandler } from '../onboarding.js';
import { SAMPLE_TRACKER, SAMPLE_UPDATE, renderTrackerSamples } from '../../scripts/customer-emails.mjs';

const environment = {
  INTAKE_SMTP_USER: 'hello@steermeright.com', INTAKE_SMTP_PASSWORD: 'app-password-not-real',
  CUSTOMER_EMAIL_ENABLED: '1', GOOGLE_REVIEW_URL: 'https://g.page/r/test/review'
};
const migrations = await Promise.all(['001_durable_leads_and_payments.sql', '002_standard_purchase_analytics.sql',
  '003_checkout_offer_snapshot.sql', '004_intake_email_outbox.sql', '005_deal_search.sql', '006_dealer_handoff.sql',
  '007_deal_events.sql', '008_deal_events_per_car.sql', '011_customer_email_outbox.sql']
  .map(name => readFile(new URL(`../../db/${name}`, import.meta.url), 'utf8')));

function tagged(client) {
  const sql = async (strings, ...values) => {
    const query = strings.reduce((text, part, index) => text + (index ? `$${index}` : '') + part, '');
    return (await client.query(query, values)).rows;
  };
  sql.begin = fn => client.transaction(tx => fn(tagged(tx)));
  return sql;
}

// ---------- Rendering ----------

test('every template renders for every sample buyer with matching HTML and text', () => {
  const renders = renderSamples();
  assert.equal(renders.length, TEMPLATE_NAMES.length * Object.keys(SAMPLE_BUYERS).length);
  for (const { subject, preheader, html, text, key, template } of renders) {
    const where = `${key}/${template}`;
    assert.ok(subject && preheader && html && text, where);
    assert.ok(subject.length <= 200, where);
    assert.ok(Buffer.byteLength(html) < 60 * 1024, `${where} stays well under Gmail's 102 KB clip`);
    // The only image allowed is the Google G on the review button: a hosted PNG with
    // empty alt text, so the button still reads right when a mail app blocks images.
    const images = html.match(/<img\b[^>]*>/gi) || [];
    assert.ok(images.every(tag => tag.includes(`src="${GOOGLE_G}"`) && tag.includes('alt=""')), where);
    assert.equal(images.length, template === 'review_ask' ? 1 : 0, where);
    assert.doesNotMatch(html, /<script|<svg|display:\s*(flex|grid)/i, where);
    assert.match(html, /role="presentation"/, where);
    assert.doesNotMatch(subject + html + text, /\bbrief\b|walk-?away/i, where);
    assert.ok(text.includes('Reply to this email any time'), where);
  }
});

test('the HTML and text parts carry the same facts', () => {
  const buyer = buyerFromRow(SAMPLE_BUYERS.standard.row);
  const { html, text } = renderCustomerEmail('welcome', buyer);
  for (const fact of ['Subaru Ascent', 'Up to $42,000 out the door', 'Within 150 miles', 'Tuscaloosa, AL', 'Steer Me Right · $395',
    'Within one business day', '$300 difference']) {
    assert.ok(html.includes(fact.replace('&', '&amp;')), `html: ${fact}`);
    assert.ok(text.includes(fact), `text: ${fact}`);
  }
});

test('plans get their own copy', () => {
  const pro = renderCustomerEmail('welcome', buyerFromRow(SAMPLE_BUYERS.pro.row)).text;
  const standard = renderCustomerEmail('welcome', buyerFromRow(SAMPLE_BUYERS.standard.row)).text;
  assert.match(pro, /Steer Me Right Pro · \$695/);
  assert.match(pro, /up to three models/);
  assert.doesNotMatch(pro, /\$300 difference/);
  assert.match(standard, /\$300 difference/);
  assert.match(renderCustomerEmail('what_to_expect', buyerFromRow(SAMPLE_BUYERS.standard.row)).text, /trade-in/,
    'buyers with a trade-in get the trade-in tip');
  assert.doesNotMatch(renderCustomerEmail('what_to_expect', buyerFromRow(SAMPLE_BUYERS.pro.row)).text, /trade-in/);
  const cash = renderCustomerEmail('what_to_expect', buyerFromRow(SAMPLE_BUYERS.pro.row));
  assert.doesNotMatch(cash.text, /pre-approval/, 'cash buyers skip the loan tip');
  assert.match(renderCustomerEmail('what_to_expect', buyerFromRow(SAMPLE_BUYERS.standard.row)).text, /Get a loan pre-approval/);
  assert.match(renderCustomerEmail('what_to_expect', buyerFromRow(SAMPLE_BUYERS.awkward.row)).text, /If you might finance/);
  assert.match(cash.text, /^x Contacting the dealers/m, 'the hold-off list is marked as things to avoid');
  assert.match(cash.html, /&#10005;/);
});

test('buyer text is escaped and private answers never reach the email', () => {
  const awkward = renderCustomerEmail('welcome', buyerFromRow(SAMPLE_BUYERS.awkward.row));
  assert.doesNotMatch(awkward.html, /<script>|<b>O/);
  assert.match(awkward.html, /&lt;script&gt;/);
  assert.match(awkward.subject, /^You’re in, Maximiliana-Christabel\./);
  const standard = renderCustomerEmail('welcome', buyerFromRow(SAMPLE_BUYERS.standard.row));
  for (const secret of ['12 Private Lane', 'Kids, dog', 'pat@', '555']) {
    assert.ok(!standard.html.includes(secret) && !standard.text.includes(secret), secret);
  }
  const sparse = renderCustomerEmail('welcome', buyerFromRow(SAMPLE_BUYERS.sparse.row));
  assert.match(sparse.text, /Vehicle type: Truck/);
  assert.match(sparse.subject, /^You’re in, Sam\./, 'an all-lowercase first name is capitalized');
  assert.doesNotMatch(sparse.text, /Where you are/);
});

test('the review email needs an https review link and shows it', () => {
  const buyer = buyerFromRow(SAMPLE_BUYERS.standard.row);
  assert.throws(() => renderCustomerEmail('review_ask', buyer, {}));
  assert.throws(() => renderCustomerEmail('review_ask', buyer, { reviewUrl: 'javascript:alert(1)' }));
  const { html, text } = renderCustomerEmail('review_ask', buyer, { reviewUrl: SAMPLE_REVIEW_URL });
  assert.ok(html.includes(`href="${SAMPLE_REVIEW_URL}"`));
  assert.ok(text.includes(`Leave a Google review: ${SAMPLE_REVIEW_URL}`));
});

test('settings stay off until the flag and SMTP are both set', () => {
  assert.equal(customerEmailSettings({}), null);
  assert.equal(customerEmailSettings({ CUSTOMER_EMAIL_ENABLED: '1' }), null);
  assert.equal(customerEmailSettings({ ...environment, CUSTOMER_EMAIL_ENABLED: '' }), null);
  const settings = customerEmailSettings(environment);
  assert.equal(settings.replyTo, 'mason@steermeright.com');
  assert.equal(settings.reviewUrl, 'https://g.page/r/test/review');
  assert.equal(customerEmailSettings({ ...environment, GOOGLE_REVIEW_URL: '' }).reviewUrl, '');
  assert.throws(() => customerEmailSettings({ ...environment, GOOGLE_REVIEW_URL: 'http://example.test' }), ConfigError);
  assert.throws(() => customerEmailSettings({ ...environment, CUSTOMER_EMAIL_REPLY_TO: 'nope' }), ConfigError);
});

// ---------- Queue ----------

test('customer emails are queued with the intake, sent when due, once each', async t => {
  t.mock.method(console, 'error', () => {});
  const pg = await PGlite.create();
  t.after(() => pg.close());
  const sql = tagged(pg);
  for (const migration of migrations) await pg.exec(migration);

  const insertIntake = async (tier = 'full_service') => {
    const id = crypto.randomUUID(), attempt = crypto.randomUUID(), purchase = crypto.randomUUID(), session = `cs_${id}`;
    await pg.query(`INSERT INTO checkout_attempts (id, client_reference_id, idempotency_key, request_hash, tier_id, expected_amount, status)
      VALUES ($1, $5, $2, $3, $4, 39500, 'paid')`, [attempt, `key-${attempt}`, 'a'.repeat(64), tier, attempt]);
    await pg.query(`INSERT INTO stripe_events (event_id, event_type, checkout_session_id, livemode, stripe_created_at)
      VALUES ($1, 'checkout.session.completed', $1, true, now())`, [session]);
    await pg.query(`INSERT INTO purchases (id, checkout_session_id, checkout_attempt_id, client_reference_id, stripe_event_id,
      stripe_payment_intent_id, tier_id, amount_total, currency, payment_status, livemode, paid_at)
      VALUES ($1, $2, $3, $3, $2, 'pi_1', $4, 39500, 'usd', 'paid', true, now())`, [purchase, session, attempt, tier]);
    await pg.query(`INSERT INTO onboarding_submissions (id, checkout_session_id, purchase_id, idempotency_key, request_hash, tier_id, name, email, phone, city, fields)
      VALUES ($1, $2, $3, $7, $4, $5, 'Pat Rivera', 'pat@example.test', '205-555-0100', 'Tuscaloosa, AL', $6)`,
    [id, session, purchase, 'b'.repeat(64), tier, JSON.stringify(SAMPLE_BUYERS.standard.row.fields), `key-${id}`]);
    return id;
  };
  const rows = async id => Object.fromEntries((await pg.query(
    'SELECT template, status, attempts, send_after, last_error FROM customer_email_outbox WHERE onboarding_id = $1', [id])).rows
    .map(row => [row.template, row]));
  const sent = [];
  let fail = false;
  const createTransport = () => ({
    async sendMail(message) {
      if (fail) throw Object.assign(new Error('535 Authentication failed for app-password-not-real'), { code: 'EAUTH' });
      sent.push(message);
    },
    close() {}
  });
  const closeDeal = async (id, kind = 'closed', at = 'now()') => {
    await pg.query('INSERT INTO deals (id, onboarding_id) VALUES ($1, $1) ON CONFLICT DO NOTHING', [id]);
    await pg.query(`INSERT INTO deal_events (onboarding_id, kind, occurred_at) VALUES ($1, $2, ${at})`, [id, kind]);
  };

  const buyer = await insertIntake();

  await t.test('nothing is queued while the feature is off, or for the retired plan', async () => {
    assert.equal(await sql.begin(tx => enqueueIntakeEmails(tx, { onboardingId: buyer, tierId: 'full_service', environment: {} })), 0);
    assert.equal(await sql.begin(tx => enqueueIntakeEmails(tx, { onboardingId: buyer, tierId: 'consultation', environment })), 0);
    assert.deepEqual(await rows(buyer), {});
  });

  await t.test('the intake queues welcome now and what-to-expect 12 hours out, idempotently', async () => {
    assert.equal(await sql.begin(tx => enqueueIntakeEmails(tx, { onboardingId: buyer, tierId: 'full_service', environment })), 2);
    assert.equal(await sql.begin(tx => enqueueIntakeEmails(tx, { onboardingId: buyer, tierId: 'full_service', environment })), 0);
    const queued = await rows(buyer);
    const hours = (queued.what_to_expect.send_after - queued.welcome.send_after) / 36e5;
    assert.ok(hours > 11.99 && hours < 12.01, `held ${hours} hours`);
  });

  await t.test('unconfigured sending touches nothing', async () => {
    assert.equal((await dispatchCustomerEmails({ sql, environment: { ...environment, CUSTOMER_EMAIL_ENABLED: '0' } })).configured, false);
    assert.deepEqual(await runCustomerEmailWorker({ sql, environment: {} }), { configured: false, exhausted: null, exitCode: 1 });
  });

  await t.test('a failed send keeps only the error code and backs off, then sends once', async () => {
    fail = true;
    assert.equal((await dispatchCustomerEmails({ sql, environment, createTransport })).failed, 1);
    assert.equal((await rows(buyer)).welcome.last_error, 'Customer email failed (EAUTH)');
    assert.equal((await dispatchCustomerEmails({ sql, environment, createTransport })).claimed, 0, 'backoff holds the retry');
    fail = false;
    await pg.exec("UPDATE customer_email_outbox SET last_attempt_at = now() - interval '61 seconds'");
    const result = await dispatchCustomerEmails({ sql, environment, createTransport });
    assert.deepEqual([result.claimed, result.sent], [1, 1], 'only the welcome is due');
    assert.equal((await rows(buyer)).welcome.status, 'sent');
    assert.equal((await rows(buyer)).what_to_expect.status, 'pending');
    assert.equal(sent.length, 1);
    assert.deepEqual(sent[0].to, { name: 'Pat Rivera', address: 'pat@example.test' });
    assert.deepEqual(sent[0].from, { name: 'Mason at Steer Me Right', address: 'hello@steermeright.com' });
    assert.equal(sent[0].replyTo, 'mason@steermeright.com');
    assert.equal(sent[0].headers['X-Steer-Customer-Email'], 'welcome');
    assert.match(sent[0].subject, /^You’re in, Pat\./);
  });

  await t.test('what-to-expect goes out once its time comes, and never twice', async () => {
    await pg.exec("UPDATE customer_email_outbox SET send_after = now() - interval '1 second' WHERE template = 'what_to_expect'");
    assert.equal((await dispatchCustomerEmails({ sql, environment, createTransport })).sent, 1);
    assert.equal((await dispatchCustomerEmails({ sql, environment, createTransport })).claimed, 0);
    assert.equal(sent.at(-1).subject, 'How your car search works, step by step');
  });

  await t.test('a lease that expired mid-send is retried', async () => {
    const other = await insertIntake();
    await sql.begin(tx => enqueueIntakeEmails(tx, { onboardingId: other, tierId: 'full_service', environment }));
    await pg.query(`UPDATE customer_email_outbox SET status = 'processing', attempts = 1, last_attempt_at = now() - interval '10 minutes'
      WHERE onboarding_id = $1 AND template = 'welcome'`, [other]);
    assert.equal((await dispatchCustomerEmails({ sql, environment, onboardingId: other, createTransport })).sent, 1);
    assert.equal((await rows(other)).welcome.attempts, 2);
  });

  await t.test('a closed deal queues deal-done now and the review ask four days after closing', async () => {
    await closeDeal(buyer);
    const worker = await runCustomerEmailWorker({ sql, environment, createTransport });
    assert.equal(worker.scheduled, 2);
    assert.equal(worker.sent, 1);
    assert.equal(sent.at(-1).subject, 'Congratulations on the new car, Pat');
    const queued = await rows(buyer);
    assert.equal(queued.deal_done.status, 'sent');
    assert.equal(queued.review_ask.status, 'pending');
    assert.ok(queued.review_ask.send_after > new Date(Date.now() + 3.9 * 864e5));
    assert.equal((await scheduleClosedDeals(sql, { reviewUrl: 'x' })).queued, 0, 'already queued');
    await pg.exec("UPDATE customer_email_outbox SET send_after = now() WHERE template = 'review_ask'");
    assert.equal((await dispatchCustomerEmails({ sql, environment, createTransport })).sent, 1);
    assert.match(sent.at(-1).html, /g\.page\/r\/test\/review/);
  });

  await t.test('a reopened deal cancels emails not yet sent; old and pre-launch deals get nothing', async () => {
    const reopened = await insertIntake();
    await sql.begin(tx => enqueueIntakeEmails(tx, { onboardingId: reopened, tierId: 'full_service', environment }));
    await closeDeal(reopened, 'closed');
    assert.equal((await scheduleClosedDeals(sql, { reviewUrl: 'x' })).queued, 2);
    await closeDeal(reopened, 'reopened', "now() + interval '1 minute'");
    assert.equal((await scheduleClosedDeals(sql, { reviewUrl: 'x' })).cancelled, 2);
    assert.equal((await rows(reopened)).deal_done.status, 'cancelled');

    const stale = await insertIntake();
    await sql.begin(tx => enqueueIntakeEmails(tx, { onboardingId: stale, tierId: 'full_service', environment }));
    await pg.query("UPDATE customer_email_outbox SET created_at = now() - interval '30 days' WHERE onboarding_id = $1", [stale]);
    await closeDeal(stale, 'closed', "now() - interval '20 days'");

    const beforeLaunch = await insertIntake();
    await closeDeal(beforeLaunch);

    assert.equal((await scheduleClosedDeals(sql, { reviewUrl: 'x' })).queued, 0);
    assert.equal((await rows(stale)).deal_done, undefined);
    assert.deepEqual(await rows(beforeLaunch), {});
  });

  await t.test('no review link means no review ask', async () => {
    const noLink = await insertIntake();
    await sql.begin(tx => enqueueIntakeEmails(tx, { onboardingId: noLink, tierId: 'full_service', environment }));
    await closeDeal(noLink);
    assert.equal((await scheduleClosedDeals(sql, { reviewUrl: '' })).queued, 1);
    assert.equal((await rows(noLink)).review_ask, undefined);

    // A review ask queued while the link was set is skipped if it's gone at send time.
    await pg.query("INSERT INTO customer_email_outbox (onboarding_id, template) VALUES ($1, 'review_ask')", [noLink]);
    await pg.query("UPDATE customer_email_outbox SET status = 'sent' WHERE onboarding_id = $1 AND template <> 'review_ask'", [noLink]);
    const result = await dispatchCustomerEmails({ sql, environment: { ...environment, GOOGLE_REVIEW_URL: '' }, createTransport });
    assert.equal(result.skipped, 1);
    assert.equal((await rows(noLink)).review_ask.status, 'cancelled');
  });

  await t.test('cancelling a buyer stops what is queued and blocks deal emails later', async () => {
    const paused = await insertIntake();
    await sql.begin(tx => enqueueIntakeEmails(tx, { onboardingId: paused, tierId: 'full_service', environment }));
    assert.deepEqual(await cancelCustomerEmails(sql, paused), ['deal_done', 'review_ask', 'welcome', 'what_to_expect']);
    const before = sent.length;
    await dispatchCustomerEmails({ sql, environment, onboardingId: paused, createTransport });
    await closeDeal(paused);
    await runCustomerEmailWorker({ sql, environment, createTransport });
    assert.equal(sent.slice(before).filter(message => message.to.address === 'pat@example.test' && /Congratulations|You’re in/.test(message.subject)).length, 0);
    assert.ok(Object.values(await rows(paused)).every(row => row.status === 'cancelled'));
  });
});

test('a new paid intake queues the customer emails in its transaction and sends the welcome after commit', async () => {
  const source = await readFile(new URL('../onboarding.js', import.meta.url), 'utf8');
  const transaction = source.slice(source.indexOf('sql.begin'), source.indexOf('await dispatchAnalyticsOutboxSafely'));
  assert.match(transaction, /await enqueueIntakeEmails\(tx, \{ onboardingId: inserted\[0\]\.id, tierId: onboarding\.tier \}\)/);
  assert.match(source, /if \(persisted\.created\) await dispatchCustomerEmailsSafely\(\{ onboardingId: persisted\.id \}\)/);
});

test('the Google G on the review button is a committed PNG, since email clients drop SVG', async () => {
  const png = await readFile(new URL('../../assets/email/google-g.png', import.meta.url));
  assert.deepEqual([...png.subarray(1, 4)].map(byte => String.fromCharCode(byte)).join(''), 'PNG');
  assert.ok(GOOGLE_G.startsWith('https://www.steermeright.com/assets/email/'));
});

// ---------- With the Deal Tracker (build step 8) ----------

const SECRET = 'deal-tracker-secret-for-tests-only-0123456789';
const trackerEnvironment = { ...environment, DEAL_TRACKER_ENABLED: '1', DEAL_TRACKER_SECRET: SECRET };
const trackerMigrations = await Promise.all(['001_durable_leads_and_payments.sql', '002_standard_purchase_analytics.sql',
  '003_checkout_offer_snapshot.sql', '004_intake_email_outbox.sql', '005_deal_search.sql', '006_dealer_handoff.sql',
  '007_deal_events.sql', '008_deal_events_per_car.sql', '011_customer_email_outbox.sql', '012_deal_events_agents.sql', '013_deal_tracker.sql']
  .map(name => readFile(new URL(`../../db/${name}`, import.meta.url), 'utf8')));

// Every query the code runs, for checking what it touches.
function recorded(client, seen = []) {
  const sql = async (strings, ...values) => {
    const query = strings.reduce((text, part, index) => text + (index ? `$${index}` : '') + part, '');
    seen.push(query);
    return (await client.query(query, values)).rows;
  };
  sql.seen = seen;
  sql.begin = fn => client.transaction(tx => fn(recorded(tx, seen)));
  sql.json = value => JSON.stringify(value);
  return sql;
}

// A paid checkout, so the intake can be submitted against it.
async function paidCheckout(pg) {
  const attempt = crypto.randomUUID(), purchase = crypto.randomUUID(), session = `cs_test_${attempt.replaceAll('-', '')}`;
  await pg.query(`INSERT INTO checkout_attempts (id, client_reference_id, idempotency_key, request_hash, tier_id, expected_amount, status)
    VALUES ($1, $1, $3, $2, 'full_service', 39500, 'paid')`, [attempt, 'a'.repeat(64), `key-${attempt}`]);
  await pg.query(`INSERT INTO stripe_events (event_id, event_type, checkout_session_id, livemode, stripe_created_at)
    VALUES ($1, 'checkout.session.completed', $1, false, now())`, [session]);
  await pg.query(`INSERT INTO purchases (id, checkout_session_id, checkout_attempt_id, client_reference_id, stripe_event_id,
    stripe_payment_intent_id, tier_id, amount_total, currency, payment_status, livemode, paid_at)
    VALUES ($1, $2, $3, $3, $2, 'pi_1', 'full_service', 39500, 'usd', 'paid', false, now())`, [purchase, session, attempt]);
  return { purchase, session };
}

// An intake saved straight to the table, its deal opened when asked.
async function savedIntake(pg, { deal = false } = {}) {
  const id = crypto.randomUUID();
  const { purchase, session } = await paidCheckout(pg);
  await pg.query(`INSERT INTO onboarding_submissions (id, checkout_session_id, purchase_id, idempotency_key, request_hash, tier_id, name, email, phone, city, fields)
    VALUES ($1, $2, $3, $5, $4, 'full_service', 'Pat Rivera', 'pat@example.test', '205-555-0100', 'Tuscaloosa, AL', $6)`,
  [id, session, purchase, 'b'.repeat(64), `key-${id}`, JSON.stringify(SAMPLE_BUYERS.standard.row.fields)]);
  if (deal) await pg.query('INSERT INTO deals (id, onboarding_id) VALUES ($1, $1)', [id]);
  return id;
}

// POST /api/onboarding for a new paid checkout, as the intake page sends it.
async function submitIntake(pg, sql, handlerEnvironment) {
  const { session } = await paidCheckout(pg);
  const res = {
    statusCode: 200, headers: {}, body: '',
    setHeader(name, value) { this.headers[name.toLowerCase()] = value; },
    end(body = '') { this.body = String(body); }
  };
  await onboardingHandler({ environment: handlerEnvironment, getDatabase: () => sql })({
    method: 'POST', url: '/api/onboarding',
    headers: { origin: [...allowedOrigins()][0], 'content-type': 'application/json', 'idempotency-key': crypto.randomUUID() },
    body: { session_id: session, tier: 'full_service', fields: { name: 'Pat Buyer', email: 'pat@example.test', phone: '205-555-0100', city: 'Austin, TX', preferred_makes: 'Toyota RAV4' } }
  }, res);
  return { status: res.statusCode, id: JSON.parse(res.body).onboarding_id };
}

// process.env for one test: the onboarding handler queues and dispatches the
// customer emails from it. DATABASE_URL is always dropped, so no dispatcher the
// handler calls can reach anything outside the test.
function useProcessEnv(t, values) {
  const saved = process.env;
  t.after(() => { process.env = saved; });
  process.env = { ...saved, ...values };
  for (const name of ['DATABASE_URL', ...Object.keys(values).filter(name => values[name] === undefined)]) delete process.env[name];
}

const fakeTransport = sent => () => ({ async sendMail(message) { sent.push(message); }, close() {} });
const patToday = template => renderCustomerEmail(template, buyerFromRow({ ...SAMPLE_BUYERS.standard.row, name: 'Pat Rivera' }), { reviewUrl: environment.GOOGLE_REVIEW_URL });

// Taken from the code before step 8: sha256 of [subject, preheader, text, html]
// for the four sample buyers, first 16 hex. Without a live link every email must
// stay byte-for-byte what Mason approved; change these only with his OK on new copy.
const TODAY = Object.freeze({
  welcome: '71a948ee7319e178', what_to_expect: '9f0396b1ae112c44', deal_done: '03fac51172d220da', review_ask: '960a71ae060b6bca'
});
function snapshot(template, options) {
  const hash = createHash('sha256');
  for (const sample of Object.values(SAMPLE_BUYERS)) {
    const { subject, preheader, text, html } = renderCustomerEmail(template, buyerFromRow(sample.row), { reviewUrl: SAMPLE_REVIEW_URL, ...options });
    hash.update(JSON.stringify([subject, preheader, text, html]));
  }
  return hash.digest('hex').slice(0, 16);
}

test('without a live Deal Tracker link every email is byte-for-byte today\'s', () => {
  for (const template of TEMPLATE_NAMES) {
    for (const options of [{}, { tracker: undefined }, { tracker: null }, { tracker: { link: '' } },
      { tracker: { link: 'http://www.steermeright.com/deal/not-https' } }]) {
      assert.equal(snapshot(template, options), TODAY[template], `${template} ${JSON.stringify(options)}`);
    }
  }
});

test('with a link, each Deal Tracker email carries it, and the welcome and what-to-expect get shorter', () => {
  const renders = renderTrackerSamples();
  assert.equal(renders.length, TEMPLATE_NAMES.length * Object.keys(SAMPLE_BUYERS).length);
  for (const { key, template, text, html } of renders) {
    const where = `${key}/${template}`;
    const today = renderCustomerEmail(template, buyerFromRow(SAMPLE_BUYERS[key].row), { reviewUrl: SAMPLE_REVIEW_URL });
    if (template === 'review_ask') {
      // Sent four days after the close, when the link has already closed.
      assert.deepEqual([text, html], [today.text, today.html], where);
      continue;
    }
    assert.ok(text.includes(`Open your Deal Tracker: ${SAMPLE_TRACKER.link}`), where);
    assert.ok(html.includes(`href="${SAMPLE_TRACKER.link}"`), where);
    assert.equal(text.split(SAMPLE_TRACKER.link).length - 1, 1, `${where}: the link once in the text part`);
    assert.equal((text.match(/Reply to this email any time/g) || []).length, 1, `${where}: one reply line`);
    if (template !== 'deal_done') assert.ok(text.length <= today.text.length, `${where}: no longer than today's`);
  }
  const of = (key, template) => renders.find(render => render.key === key && render.template === template);

  const welcome = of('standard', 'welcome');
  assert.equal(welcome.subject, 'You’re in, Pat. Here’s what happens next', 'the welcome subject stays');
  for (const fact of ['YOUR DEAL TRACKER', 'Keep this link to yourself', 'WHAT YOU ASKED FOR', 'Subaru Ascent', 'Tuscaloosa, AL',
    'YOUR PLAN: STEER ME RIGHT', '$300 difference', 'Within one business day']) assert.ok(welcome.text.includes(fact), `welcome: ${fact}`);
  assert.ok(welcome.text.indexOf('YOUR DEAL TRACKER') < welcome.text.indexOf('WHAT YOU ASKED FOR'), 'the link comes first');
  assert.doesNotMatch(welcome.text, /We find the cars and work the dealers/, 'the step-by-step is gone');
  assert.equal((welcome.text.match(/Keep this link to yourself/g) || []).length, 1);
  assert.match(of('pro', 'welcome').text, /Pro searches start ahead of the line/);

  for (const key of Object.keys(SAMPLE_BUYERS)) {
    const nudge = of(key, 'what_to_expect');
    const today = renderCustomerEmail('what_to_expect', buyerFromRow(SAMPLE_BUYERS[key].row)).text;
    assert.ok(nudge.text.length < today.length / 2, `${key}: ${nudge.text.length} is under half of ${today.length}`);
    assert.equal(nudge.subject, 'Your to-do list for the car search');
    assert.match(nudge.text, /Line up insurance/);
    assert.match(nudge.text, /Tell me if anything changes/);
    assert.match(nudge.text, /hold off on contacting dealers yourself/);
    assert.doesNotMatch(nudge.text, /HOW LONG IT TAKES|WHAT STAYS WITH YOU|THE SEARCH, STEP BY STEP/);
  }
  assert.match(of('standard', 'what_to_expect').text, /Get a loan pre-approval .*send it on your Deal Tracker/, 'financing');
  assert.match(of('awkward', 'what_to_expect').text, /If you might finance/, 'not sure yet');
  assert.doesNotMatch(of('pro', 'what_to_expect').text, /pre-approval|trade-in/, 'cash, no trade-in');
  assert.match(of('standard', 'what_to_expect').text, /trade-in .*on your Deal Tracker/, 'trade-in');
  assert.doesNotMatch(of('sparse', 'what_to_expect').text, /trade-in/);

  const done = of('standard', 'deal_done');
  assert.equal(done.subject, 'Congratulations on the new car, Pat');
  for (const fact of ['BEFORE YOU SIGN', 'AT PICKUP', 'AFTER YOU DRIVE OFF', 'If a number doesn’t match, don’t sign.',
    'stays open for three days after the deal closes', 'not legal or tax advice']) assert.ok(done.text.includes(fact), `deal_done: ${fact}`);
});

test('no email in either form says brief, OTD, undefined or null', () => {
  const renders = [...renderSamples(), ...renderTrackerSamples(),
    renderBuyerUpdateEmail({ firstName: 'Pat', body: SAMPLE_UPDATE, link: SAMPLE_TRACKER.link })];
  for (const { subject, preheader, text, html } of renders) {
    assert.doesNotMatch(`${subject}\n${preheader}\n${text}\n${html}`, /\bbriefs?\b|\bOTD\b|\bundefined\b|\bnull\b/i, subject);
  }
});

test('the Buyer Update email has one reply line and prints its link once in the text part', () => {
  const link = SAMPLE_TRACKER.link;
  const { text, html } = renderBuyerUpdateEmail({ firstName: 'Pat', body: SAMPLE_UPDATE, link });
  assert.equal(text.split(link).length - 1, 1);
  assert.match(text, /^Read it on your Deal Tracker: https:\/\/www\.steermeright\.com\/deal\/sample-link$/m);
  assert.ok(html.includes(`href="${link}"`) && html.includes(`Or open this link: ${link}`), 'the HTML keeps the button and the visible link');
  assert.equal((text.match(/Reply to this email/g) || []).length, 1);
  assert.equal((html.match(/Reply to this email/g) || []).length, 1);
});

test('the queue sends today\'s email on a database without db/013, touching no Deal Tracker table while it is off', async t => {
  const pg = await PGlite.create();
  t.after(() => pg.close());
  for (const migration of migrations) await pg.exec(migration);
  const sql = recorded(pg);
  const buyer = await savedIntake(pg);
  await sql.begin(tx => enqueueIntakeEmails(tx, { onboardingId: buyer, tierId: 'full_service', environment }));
  const sent = [];
  for (const env of [environment, { ...environment, DEAL_TRACKER_ENABLED: '0', DEAL_TRACKER_SECRET: 'short' }]) {
    await pg.exec("UPDATE customer_email_outbox SET status = 'pending', attempts = 0, send_after = now() - interval '1 second'");
    sql.seen.length = 0;
    assert.equal((await dispatchCustomerEmails({ sql, environment: env, createTransport: fakeTransport(sent) })).sent, 2);
    assert.ok(!sql.seen.some(query => /deal_tracker_links|deal_events/.test(query)), 'no Deal Tracker query');
  }
  assert.equal(sent.length, 4);
  for (const message of sent) {
    const today = patToday(message.headers['X-Steer-Customer-Email']);
    assert.deepEqual([message.subject, message.text, message.html, message.replyTo], [today.subject, today.text, today.html, 'mason@steermeright.com']);
  }
});

test('with the Deal Tracker on, only a buyer with a live link gets the link, and every email replies to Mason', async t => {
  const pg = await PGlite.create();
  t.after(() => pg.close());
  for (const migration of trackerMigrations) await pg.exec(migration);
  const sql = recorded(pg);
  const settings = dealTrackerSettings(trackerEnvironment);

  const [live, revoked, noLink, closedLong, closedRecent] = [
    await savedIntake(pg, { deal: true }), await savedIntake(pg, { deal: true }), await savedIntake(pg, { deal: true }),
    await savedIntake(pg, { deal: true }), await savedIntake(pg, { deal: true })];
  for (const id of [live, revoked, closedLong, closedRecent]) await pg.query('INSERT INTO deal_tracker_links (onboarding_id) VALUES ($1)', [id]);
  await pg.query('UPDATE deal_tracker_links SET version = 2 WHERE onboarding_id = $1', [live]);
  await pg.query('UPDATE deal_tracker_links SET revoked_at = now() WHERE onboarding_id = $1', [revoked]);
  await pg.query("INSERT INTO deal_events (onboarding_id, kind, occurred_at) VALUES ($1, 'closed', now() - interval '4 days')", [closedLong]);
  await pg.query("INSERT INTO deal_events (onboarding_id, kind, occurred_at) VALUES ($1, 'closed', now() - interval '1 day')", [closedRecent]);
  for (const id of [live, revoked, noLink, closedLong, closedRecent]) {
    await pg.query("INSERT INTO customer_email_outbox (onboarding_id, template) VALUES ($1, 'welcome')", [id]);
  }

  // The emails sent, split into those with a Deal Tracker link (by the intake ID
  // in its token) and the rest.
  const send = async env => {
    await pg.exec("UPDATE customer_email_outbox SET status = 'pending', attempts = 0");
    const sent = [];
    assert.equal((await dispatchCustomerEmails({ sql, environment: env, createTransport: fakeTransport(sent) })).sent, 5);
    const linked = new Map(), others = [];
    for (const message of sent) {
      const token = message.text.match(/\/deal\/([0-9a-f]{32})\./);
      if (token) linked.set(token[1], message); else others.push(message);
    }
    return { linked, others };
  };
  const today = patToday('welcome');
  const hex = id => id.replaceAll('-', '');

  {
    const { linked, others } = await send(trackerEnvironment);
    assert.deepEqual([...linked.keys()].sort(), [hex(live), hex(closedRecent)].sort(), 'not revoked, missing or closed over three days ago');
    assert.equal(others.length, 3);
    const message = linked.get(hex(live));
    const link = linkUrl(settings, live, 2);
    assert.ok(message.text.includes(link) && message.html.includes(link));
    assert.equal(message.replyTo, 'mason@steermeright.com');
    assert.deepEqual(await checkLink(sql, settings, link.split('/deal/')[1]), { status: 'ok', onboardingId: live });
    for (const other of others) {
      assert.deepEqual([other.subject, other.text, other.html, other.replyTo], [today.subject, today.text, today.html, 'mason@steermeright.com']);
    }
  }
});

test('a paid intake\'s welcome carries the new buyer\'s Deal Tracker link', async t => {
  t.mock.method(console, 'error', () => {});
  const pg = await PGlite.create();
  t.after(() => pg.close());
  for (const migration of trackerMigrations) await pg.exec(migration);
  const sql = recorded(pg);
  // onboarding.js queues the emails and dispatches them with process.env and the
  // real SMTP transport. With no SMTP login there, its own dispatch sends nothing,
  // and the test then sends the same queue through a fake transport.
  useProcessEnv(t, { CUSTOMER_EMAIL_ENABLED: '1', INTAKE_SMTP_USER: undefined, INTAKE_SMTP_PASSWORD: undefined });
  const { status, id } = await submitIntake(pg, sql, trackerEnvironment);
  assert.equal(status, 201);

  const sent = [];
  const result = await dispatchCustomerEmails({ sql, environment: trackerEnvironment, onboardingId: id, createTransport: fakeTransport(sent) });
  assert.deepEqual([result.claimed, result.sent], [1, 1], 'the welcome is due at once');
  const [welcome] = sent;
  assert.equal(welcome.headers['X-Steer-Customer-Email'], 'welcome');
  const settings = dealTrackerSettings(trackerEnvironment);
  const link = linkUrl(settings, id, 1);
  assert.ok(welcome.text.includes(`Open your Deal Tracker: ${link}`) && welcome.html.includes(`href="${link}"`));
  assert.deepEqual(await checkLink(sql, settings, link.split('/deal/')[1]), { status: 'ok', onboardingId: id });
  assert.equal(welcome.replyTo, 'mason@steermeright.com');
});

test('a bad DEAL_TRACKER_SECRET never breaks a paid intake, and spends no email attempt', async t => {
  t.mock.method(console, 'error', () => {});
  const pg = await PGlite.create();
  t.after(() => pg.close());
  for (const migration of trackerMigrations) await pg.exec(migration);
  const sql = recorded(pg);
  const bad = { ...environment, DEAL_TRACKER_ENABLED: '1', DEAL_TRACKER_SECRET: 'too-short', INTAKE_SMTP_HOST: '127.0.0.1', INTAKE_SMTP_PORT: '9' };
  assert.throws(() => dealTrackerSettings(bad), ConfigError);
  useProcessEnv(t, bad);
  const { status, id } = await submitIntake(pg, sql, bad);
  assert.equal(status, 201, 'the buyer still gets their confirmation');
  const queued = async () => (await pg.query('SELECT template, status, attempts FROM customer_email_outbox WHERE onboarding_id = $1 ORDER BY template', [id])).rows;
  assert.deepEqual(await queued(), [
    { template: 'welcome', status: 'pending', attempts: 0 }, { template: 'what_to_expect', status: 'pending', attempts: 0 }
  ], 'the welcome waits, unspent, for the secret to be fixed');
  assert.ok(console.error.mock.calls.some(call => call.arguments[0] === '[customer_email_dispatch_failed]'));
  await assert.rejects(dispatchCustomerEmails({ sql, environment: bad, createTransport: fakeTransport([]) }), ConfigError,
    'the cron surfaces it, as it does a bad CUSTOMER_EMAIL_REPLY_TO');
  assert.equal((await queued())[0].attempts, 0);
});
