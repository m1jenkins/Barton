import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { ConfigError } from '../_lib/config.js';
import { dispatchIntakeEmails, intakeEmailSettings, renderIntakeEmail } from '../_lib/intake-email.js';
import { runIntakeEmailWorker } from '../../scripts/dispatch-intake-emails.mjs';
import { outboxHandler } from '../outbox-dispatch.js';

const environment = { INTAKE_SMTP_USER: 'hello@steermeright.com', INTAKE_SMTP_PASSWORD: 'app-password-not-real' };
const onboardingId = '4b4f163a-6c85-4ffd-8b93-df90e5b017e9';
const otherId = 'c2d1f0b4-3a9e-4f7a-9d38-1f6b2e0c5a77';
const migrations = await Promise.all(['001_durable_leads_and_payments.sql', '002_standard_purchase_analytics.sql',
  '003_checkout_offer_snapshot.sql', '004_intake_email_outbox.sql']
  .map(name => readFile(new URL(`../../db/${name}`, import.meta.url), 'utf8')));

function tagged(client) {
  const sql = async (strings, ...values) => {
    const query = strings.reduce((text, part, index) => text + (index ? `$${index}` : '') + part, '');
    return (await client.query(query, values)).rows;
  };
  sql.begin = fn => client.transaction(tx => fn(tagged(tx)));
  return sql;
}

const row = {
  onboarding_id: onboardingId, purchase_id: '8c754f76-813e-42ef-af02-772f962d786d', tier_id: 'full_service',
  name: 'Pat <Buyer>', email: 'pat@example.test', phone: '(205) 555-0100', city: 'Tuscaloosa, AL',
  created_at: '2026-11-01T15:29:07Z', paid_at: '2026-11-01T15:10:29Z', amount_total: 39500, currency: 'usd',
  livemode: true, stripe_payment_intent_id: 'pi_123', checkout_session_id: 'cs_live_123', source_page: '/',
  attribution: { last_touch: { utm_source: 'google', utm_medium: 'cpc', landing_path: '/austin.html' } },
  fields: { preferred_makes: 'Subaru Ascent', budget: 'Up to $38,000', features: ['AWD', 'Moonroof'],
    contact_preference: 'text', notes: '<script>alert(1)</script>', future_field: 'kept' }
};

test('settings stay off until both SMTP values are set, and default to Mason at Zoho', () => {
  assert.equal(intakeEmailSettings({}), null);
  assert.throws(() => intakeEmailSettings({ INTAKE_SMTP_USER: 'hello@steermeright.com' }), ConfigError);
  assert.throws(() => intakeEmailSettings({ ...environment, INTAKE_EMAIL_TO: 'not an address' }), ConfigError);
  const settings = intakeEmailSettings(environment);
  assert.equal(settings.to, 'mason@steermeright.com');
  assert.equal(settings.host, 'smtppro.zoho.com');
  assert.equal(settings.port, 465);
});

test('the email carries every answer, escapes buyer text and links the live Stripe payment', () => {
  const { subject, text, html } = renderIntakeEmail(row);
  assert.equal(subject, 'Paid intake: Pat <Buyer> · Subaru Ascent · Steer Me Right ($395 plan)');
  for (const expected of ['Car: Subaru Ascent', 'All-in budget: Up to $38,000', 'Features: AWD, Moonroof',
    'Best way to reach: text', 'future_field: kept', 'Paid: $395 on Sun, Nov 1, 2026, 9:10 AM CST',
    'Stripe payment: https://dashboard.stripe.com/payments/pi_123', 'Last visit: google / cpc, landed on /austin.html']) {
    assert.ok(text.includes(expected), expected);
  }
  assert.ok(!text.includes('Trade-in'), 'unanswered questions are left out');
  assert.ok(!html.includes('<script>'));
  assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
  assert.ok(html.includes('href="sms:2055550100"'));
  assert.ok(renderIntakeEmail({ ...row, livemode: false }).text.includes('dashboard.stripe.com/test/payments/pi_123'));
  assert.ok(!/\bbrief\b/i.test(text + html));
});

test('intake emails are queued durably, sent once, and retried after an SMTP failure', async t => {
  const pg = await PGlite.create();
  t.after(() => pg.close());
  const sql = tagged(pg);
  for (const migration of migrations.slice(0, 3)) await pg.exec(migration);
  const insertIntake = async (id, session) => {
    const attempt = crypto.randomUUID(), purchase = crypto.randomUUID();
    await pg.query(`INSERT INTO checkout_attempts (id, client_reference_id, idempotency_key, request_hash, tier_id, expected_amount, status)
      VALUES ($1, $1, $2, $3, 'full_service', 39500, 'paid')`, [attempt, attempt, 'a'.repeat(64)]);
    await pg.query(`INSERT INTO stripe_events (event_id, event_type, checkout_session_id, livemode, stripe_created_at)
      VALUES ($1, 'checkout.session.completed', $2, true, now())`, [session, session]);
    await pg.query(`INSERT INTO purchases (id, checkout_session_id, checkout_attempt_id, client_reference_id, stripe_event_id,
      stripe_payment_intent_id, tier_id, amount_total, currency, payment_status, livemode, paid_at)
      VALUES ($1, $2, $3, $4, $5, 'pi_123', 'full_service', 39500, 'usd', 'paid', true, now())`, [purchase, session, attempt, attempt, session]);
    await pg.query(`INSERT INTO onboarding_submissions (id, checkout_session_id, purchase_id, idempotency_key, request_hash, tier_id, name, email, phone, city, fields)
      VALUES ($1, $2, $3, $6, $4, 'full_service', 'Pat Buyer', 'pat@example.test', '205-555-0100', 'Tuscaloosa, AL', $5)`,
    [id, session, purchase, 'b'.repeat(64), JSON.stringify({ preferred_makes: 'Subaru Ascent' }), id]);
  };
  const status = async (id = onboardingId) => (await pg.query('SELECT * FROM intake_email_outbox WHERE onboarding_id = $1', [id])).rows[0];

  await t.test('the migration queues intakes saved before it existed', async () => {
    await insertIntake(onboardingId, 'cs_live_before_migration');
    await pg.exec(migrations[3]);
    assert.equal((await status()).status, 'pending');
  });

  await t.test('unconfigured SMTP touches neither the database nor the network', async () => {
    assert.deepEqual(await dispatchIntakeEmails({ environment: {} }), { configured: false, claimed: 0, sent: 0, failed: 0 });
    assert.deepEqual(await runIntakeEmailWorker({ environment: {} }), { configured: false, exhausted: null, exitCode: 1 });
  });

  await t.test('a refused login is recorded by code only, then a later run delivers it once', async t => {
    t.mock.method(console, 'error', () => {});
    const sent = [];
    let fail = true, closed = 0;
    const createTransport = () => ({
      async sendMail(message) {
        if (fail) throw Object.assign(new Error('535 Authentication failed for app-password-not-real'), { code: 'EAUTH' });
        sent.push(message);
      },
      close() { closed += 1; }
    });
    assert.equal((await runIntakeEmailWorker({ sql, environment, createTransport })).failed, 1);
    assert.equal((await status()).status, 'failed');
    assert.equal((await status()).last_error, 'Intake email failed (EAUTH)');
    assert.equal((await dispatchIntakeEmails({ sql, environment, createTransport })).claimed, 0, 'backoff holds the retry');

    fail = false;
    await pg.exec("UPDATE intake_email_outbox SET last_attempt_at = now() - interval '61 seconds'");
    const result = await runIntakeEmailWorker({ sql, environment, createTransport });
    assert.deepEqual([result.sent, result.exitCode], [1, 0]);
    assert.equal((await status()).status, 'sent');
    assert.equal((await status()).attempts, 2);
    assert.equal((await dispatchIntakeEmails({ sql, environment, createTransport })).claimed, 0);
    assert.equal(closed, 2, 'each run closes its SMTP connection');
    assert.equal(sent.length, 1);
    assert.equal(sent[0].to, 'mason@steermeright.com');
    assert.deepEqual(sent[0].replyTo, { name: 'Pat Buyer', address: 'pat@example.test' });
    assert.equal(sent[0].from.address, 'hello@steermeright.com');
    assert.match(sent[0].subject, /^Paid intake: Pat Buyer · Subaru Ascent/);
  });

  await t.test('a targeted send leaves other intakes queued for the cron', async () => {
    await insertIntake(otherId, 'cs_live_other');
    await pg.query('INSERT INTO intake_email_outbox (onboarding_id) VALUES ($1)', [otherId]);
    await pg.exec(`UPDATE intake_email_outbox SET status = 'pending', attempts = 0 WHERE onboarding_id = '${onboardingId}'`);
    const createTransport = () => ({ async sendMail() {} });
    assert.equal((await dispatchIntakeEmails({ sql, environment, onboardingId: otherId, createTransport })).sent, 1);
    assert.equal((await status()).status, 'pending');
  });
});

test('a new paid intake queues its email in the same transaction and sends it after commit', async () => {
  const source = await readFile(new URL('../onboarding.js', import.meta.url), 'utf8');
  const transaction = source.slice(source.indexOf('sql.begin'), source.indexOf('await dispatchAnalyticsOutboxSafely'));
  assert.match(transaction, /INSERT INTO intake_email_outbox \(onboarding_id\) VALUES \(\$\{inserted\[0\]\.id\}\)/);
  assert.match(source, /if \(persisted\.created\) await dispatchIntakeEmailsSafely\(\{ onboardingId: persisted\.id \}\)/);
});

test('the daily cron runs the intake email worker beside the other outboxes', async () => {
  const secret = 'test-secret-for-bounded-cron-authentication';
  const res = { headers: {}, setHeader(key, value) { this.headers[key] = value; }, end(value) { this.body = JSON.parse(value); } };
  const request = { method: 'GET', headers: { authorization: `Bearer ${secret}` } };
  await outboxHandler({ environment: { CRON_SECRET: secret }, getDatabase() { throw Error('must not connect'); } })(request, res);
  assert.equal(res.body.workers.intake_email.configured, false);

  const configured = { headers: {}, setHeader() {}, end(value) { this.body = JSON.parse(value); } };
  await outboxHandler({ environment: { CRON_SECRET: secret, ...environment }, getDatabase: () => ({}),
    intakeEmailWorker: async () => ({ configured: true, claimed: 1, sent: 1, failed: 0, exhausted: 0, exitCode: 0 })
  })(request, configured);
  assert.deepEqual(configured.body.workers.intake_email, { configured: true, claimed: 1, sent: 1, failed: 0, exhausted: 0, ok: true });
});
