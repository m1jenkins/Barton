import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { ConfigError } from '../_lib/config.js';
import {
  cancelCustomerEmails, customerEmailSettings, dispatchCustomerEmails, enqueueIntakeEmails, scheduleClosedDeals
} from '../_lib/customer-email.js';
import { TEMPLATE_NAMES, buyerFromRow, renderCustomerEmail } from '../_lib/customer-emails/index.js';
import { runCustomerEmailWorker } from '../_lib/outbox-workers.js';
import { SAMPLE_BUYERS, SAMPLE_REVIEW_URL, renderSamples } from '../../scripts/customer-emails.mjs';

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
    assert.doesNotMatch(html, /<script|<svg|<img|display:\s*(flex|grid)/i, where);
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
