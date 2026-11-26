import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { PGlite } from '@electric-sql/pglite';
import { loadBuyerView, signLink } from '../_lib/deal-tracker.js';
import { approveDraft, discardDraft, postUpdate, retractUpdate } from '../_lib/buyer-updates.js';
import { buyerUpdateEmailSettings, dispatchBuyerUpdateEmails } from '../_lib/buyer-update-email.js';
import { dealTrackerHandler } from '../deal-tracker.js';
import { carSearchHandler } from '../car-search.js';
import { carSearchRequest } from '../../scripts/car-search.mjs';

// Buyer Updates are the only free text a buyer sees from us (GLOSSARY.md,
// docs/adr/0002). Written before the feature: a draft never shows, a retracted
// update disappears and never emails, and an agent's row can't be posted
// without the on_masons_say claim.

const SECRET = 'deal-tracker-secret-for-tests-only-0123456789';
const environment = {
  DEAL_TRACKER_ENABLED: '1', DEAL_TRACKER_SECRET: SECRET, APP_ORIGIN: 'https://www.steermeright.com',
  INTAKE_SMTP_USER: 'sender@example.test', INTAKE_SMTP_PASSWORD: 'smtp-password-for-tests'
};
const NOW = Date.parse('2026-12-10T18:00:00Z');

const migrations = await Promise.all(['001_durable_leads_and_payments.sql', '002_standard_purchase_analytics.sql',
  '003_checkout_offer_snapshot.sql', '004_intake_email_outbox.sql', '005_deal_search.sql', '006_dealer_handoff.sql',
  '007_deal_events.sql', '008_deal_events_per_car.sql', '012_deal_events_agents.sql', '013_deal_tracker.sql']
  .map(name => readFile(new URL(`../../db/${name}`, import.meta.url), 'utf8')));

function tagged(client) {
  const sql = async (strings, ...values) => {
    const query = strings.reduce((text, part, index) => text + (index ? `$${index}` : '') + part, '');
    return (await client.query(query, values)).rows;
  };
  sql.begin = fn => client.transaction(tx => fn(tagged(tx)));
  sql.json = value => JSON.stringify(value);
  return sql;
}

async function database(t) {
  const pg = await PGlite.create();
  t.after(() => pg.close());
  for (const migration of migrations) await pg.exec(migration);
  return pg;
}

async function intake(pg, { email = 'riley.buyer@example.test' } = {}) {
  const id = crypto.randomUUID(), attempt = crypto.randomUUID(), purchase = crypto.randomUUID(), session = `cs_live_${id}`;
  await pg.query(`INSERT INTO checkout_attempts (id, client_reference_id, idempotency_key, request_hash, tier_id, expected_amount, status)
    VALUES ($1, $1, $2, $3, 'full_service', 39500, 'paid')`, [attempt, attempt, 'a'.repeat(64)]);
  await pg.query(`INSERT INTO stripe_events (event_id, event_type, checkout_session_id, livemode, stripe_created_at)
    VALUES ($1, 'checkout.session.completed', $1, true, now())`, [session]);
  await pg.query(`INSERT INTO purchases (id, checkout_session_id, checkout_attempt_id, client_reference_id, stripe_event_id,
    stripe_payment_intent_id, tier_id, amount_total, currency, payment_status, livemode, paid_at)
    VALUES ($1, $2, $3, $3, $2, 'pi_1', 'full_service', 39500, 'usd', 'paid', true, now())`, [purchase, session, attempt]);
  await pg.query(`INSERT INTO onboarding_submissions (id, checkout_session_id, purchase_id, idempotency_key, request_hash, tier_id, name, email, phone, city, fields)
    VALUES ($1, $2, $3, $6, $4, 'full_service', 'Riley Buyer', $5, '205-555-0100', 'Austin', '{"preferred_makes":"Toyota RAV4"}')`,
  [id, session, purchase, 'b'.repeat(64), email, id]);
  await pg.query('INSERT INTO deals (id, onboarding_id) VALUES ($1, $2)', [crypto.randomUUID(), id]);
  await pg.query('INSERT INTO deal_tracker_links (onboarding_id) VALUES ($1)', [id]);
  return id;
}

// An agent's insert, as scripts/deal-desk-db.mjs makes it.
const agentUpdate = async (pg, id, body, { status = 'draft', say = false } = {}) =>
  (await pg.query(`INSERT INTO buyer_updates (onboarding_id, body, status, actor, on_masons_say) VALUES ($1, $2, $3, 'deal-desk', $4) RETURNING id`,
    [id, body, status, say])).rows[0].id;

function response() {
  return {
    statusCode: 200, headers: {}, body: '',
    setHeader(name, value) { this.headers[name.toLowerCase()] = value; },
    getHeader(name) { return this.headers[name.toLowerCase()]; },
    end(body = '') { this.body = String(body); }
  };
}
async function page(pg, id) {
  const req = Readable.from([]);
  Object.assign(req, { method: 'GET', url: `/api/deal-tracker?t=${signLink(SECRET, id, 1)}`, headers: { host: 'www.steermeright.com' } });
  const res = response();
  await dealTrackerHandler({ environment, getDatabase: () => tagged(pg), now: () => NOW })(req, res);
  assert.equal(res.statusCode, 200);
  return res.body;
}
async function seen(pg, id) {
  return `${await page(pg, id)}\n${JSON.stringify(await loadBuyerView(tagged(pg), id, NOW))}`;
}

function mailer() {
  const sent = [];
  return { sent, createTransport: () => ({ sendMail: async message => { sent.push(message); return { messageId: `<${sent.length}@test>` }; }, close() {} }) };
}
const dispatch = (pg, mail, env = environment) => dispatchBuyerUpdateEmails({ sql: tagged(pg), environment: env, createTransport: mail.createTransport });
// Moves every posted update's email past its take-back window.
const windowPassed = pg => pg.query(`UPDATE buyer_updates SET email_after = now() - interval '1 minute' WHERE email_after IS NOT NULL`);

test('a draft never shows; posting it shows it; taking it back removes it', async t => {
  const pg = await database(t);
  const sql = tagged(pg);
  const id = await intake(pg);
  const draft = await agentUpdate(pg, id, 'DRAFT-SENTINEL the dealer came down a little');
  assert.ok(!(await seen(pg, id)).includes('DRAFT-SENTINEL'), 'a draft is not on the page or in the view');

  await approveDraft(sql, draft);
  assert.ok((await seen(pg, id)).includes('DRAFT-SENTINEL the dealer came down a little'), 'an approved draft shows');

  await retractUpdate(sql, draft);
  assert.ok(!(await seen(pg, id)).includes('DRAFT-SENTINEL'), 'a retracted update is gone');
  const { rows: [row] } = await pg.query('SELECT status, retracted_at, on_masons_say FROM buyer_updates WHERE id = $1', [draft]);
  assert.equal(row.status, 'retracted');
  assert.ok(row.retracted_at);
});

test('a discarded draft never shows and can no longer be approved', async t => {
  const pg = await database(t);
  const sql = tagged(pg);
  const id = await intake(pg);
  const draft = await agentUpdate(pg, id, 'DISCARD-SENTINEL');
  await discardDraft(sql, draft);
  await approveDraft(sql, draft).catch(() => {});
  assert.ok(!(await seen(pg, id)).includes('DISCARD-SENTINEL'));
  const { rows: [row] } = await pg.query('SELECT status, posted_at FROM buyer_updates WHERE id = $1', [draft]);
  assert.equal(row.status, 'retracted');
  assert.equal(row.posted_at, null);
});

test('Mason\'s own update and an agent\'s update posted on his say show at once, escaped', async t => {
  const pg = await database(t);
  const sql = tagged(pg);
  const id = await intake(pg);
  await postUpdate(sql, { onboardingId: id, body: 'MASON-SENTINEL <b>two dealers</b> & counting' });
  await agentUpdate(pg, id, 'AGENT-SENTINEL posted on Mason\'s say', { status: 'posted', say: true });
  const html = await page(pg, id);
  assert.ok(html.includes('MASON-SENTINEL &lt;b&gt;two dealers&lt;/b&gt; &amp; counting'), 'buyer-facing text is escaped');
  assert.ok(!html.includes('<b>two dealers</b>'));
  assert.ok(html.includes('AGENT-SENTINEL'));
  const { rows } = await pg.query(`SELECT actor, status, on_masons_say FROM buyer_updates WHERE onboarding_id = $1 ORDER BY id`, [id]);
  assert.deepEqual(rows.map(row => [row.actor, row.status]), [['mason', 'posted'], ['deal-desk', 'posted']]);
});

test('the database refuses an agent row that is posted without on_masons_say, or that arrives already emailed', async t => {
  const pg = await database(t);
  const id = await intake(pg);
  await assert.rejects(agentUpdate(pg, id, 'not allowed', { status: 'posted', say: false }), /buyer_updates_posted_on_masons_say/);
  await assert.rejects(pg.query(`INSERT INTO buyer_updates (onboarding_id, body, status, actor, on_masons_say) VALUES ($1, 'x', 'retracted', 'deal-desk', true)`, [id]));
  // An insert can't skip the take-back window or claim the email already went.
  const { rows: [row] } = await pg.query(`INSERT INTO buyer_updates (onboarding_id, body, status, actor, on_masons_say, emailed_at, email_after)
    VALUES ($1, 'x', 'posted', 'deal-desk', true, now(), now() - interval '1 day') RETURNING emailed_at, email_after > now() + interval '4 minutes' AS held`, [id]);
  assert.equal(row.emailed_at, null);
  assert.equal(row.held, true);
});

test('a posted update emails the buyer once, after the take-back window, with their link, replying to Mason', async t => {
  const pg = await database(t);
  const sql = tagged(pg);
  const id = await intake(pg);
  const mail = mailer();
  await postUpdate(sql, { onboardingId: id, body: 'EMAIL-SENTINEL Two written prices are in.' });

  assert.equal((await dispatch(pg, mail)).sent, 0, 'nothing leaves inside the take-back window');
  assert.equal(mail.sent.length, 0);

  await windowPassed(pg);
  const result = await dispatch(pg, mail);
  assert.equal(result.configured, true);
  assert.equal(result.sent, 1);
  assert.equal(mail.sent.length, 1);
  const [message] = mail.sent;
  const to = typeof message.to === 'string' ? message.to : message.to.address;
  assert.equal(to, 'riley.buyer@example.test');
  const link = `https://www.steermeright.com/deal/${signLink(SECRET, id, 1)}`;
  assert.ok(message.text.includes(link) && message.html.includes(link), 'the email carries the buyer\'s link');
  const replyTo = typeof message.replyTo === 'string' ? message.replyTo : message.replyTo.address;
  assert.equal(replyTo, 'mason@steermeright.com');
  assert.doesNotMatch(`${message.subject}\n${message.text}\n${message.html}`, /\bbriefs?\b/i);

  assert.equal((await dispatch(pg, mail)).sent, 0, 'a rerun sends nothing twice');
  assert.equal(mail.sent.length, 1);
  const { rows: [row] } = await pg.query('SELECT emailed_at FROM buyer_updates WHERE onboarding_id = $1', [id]);
  assert.ok(row.emailed_at);
});

test('a retracted update is never emailed, and a draft is never emailed', async t => {
  const pg = await database(t);
  const sql = tagged(pg);
  const id = await intake(pg);
  const mail = mailer();
  const posted = await postUpdate(sql, { onboardingId: id, body: 'RETRACT-SENTINEL sent by mistake' });
  await agentUpdate(pg, id, 'DRAFT-SENTINEL waiting for Mason');
  await retractUpdate(sql, posted.id);
  await windowPassed(pg);
  const result = await dispatch(pg, mail);
  assert.equal(result.sent, 0);
  assert.equal(mail.sent.length, 0);
  const { rows } = await pg.query('SELECT emailed_at FROM buyer_updates WHERE onboarding_id = $1', [id]);
  assert.ok(rows.every(row => row.emailed_at === null));
});

test('no update email goes to a buyer whose link is revoked or whose deal has no link', async t => {
  const pg = await database(t);
  const sql = tagged(pg);
  const revoked = await intake(pg);
  const unlinked = await intake(pg, { email: 'other.buyer@example.test' });
  await postUpdate(sql, { onboardingId: revoked, body: 'one' });
  await postUpdate(sql, { onboardingId: unlinked, body: 'two' });
  await pg.query('UPDATE deal_tracker_links SET revoked_at = now() WHERE onboarding_id = $1', [revoked]);
  await pg.query('DELETE FROM deal_tracker_links WHERE onboarding_id = $1', [unlinked]);
  await windowPassed(pg);
  const mail = mailer();
  await dispatch(pg, mail);
  assert.equal(mail.sent.length, 0);
});

test('a failed send is retried, and switched off nothing is sent or read', async t => {
  const pg = await database(t);
  const sql = tagged(pg);
  const id = await intake(pg);
  await postUpdate(sql, { onboardingId: id, body: 'retry me' });
  await windowPassed(pg);
  const failing = { createTransport: () => ({ sendMail: async () => { throw Object.assign(new Error('boom riley.buyer@example.test'), { code: 'ECONNECTION' }); }, close() {} }) };
  const failed = await dispatch(pg, failing);
  assert.equal(failed.failed, 1);
  const { rows: [row] } = await pg.query('SELECT emailed_at, email_attempts, email_error FROM buyer_updates WHERE onboarding_id = $1', [id]);
  assert.equal(row.emailed_at, null);
  assert.equal(row.email_attempts, 1);
  assert.ok(!String(row.email_error).includes('riley.buyer'), 'the stored error carries no buyer detail');
  const mail = mailer();
  assert.equal((await dispatch(pg, mail)).sent, 1);

  assert.equal(buyerUpdateEmailSettings({ ...environment, DEAL_TRACKER_ENABLED: '0' }), null);
  assert.equal(buyerUpdateEmailSettings({ ...environment, INTAKE_SMTP_USER: '', INTAKE_SMTP_PASSWORD: '' }), null);
  const off = await dispatchBuyerUpdateEmails({ sql: () => { throw new Error('the database must not be read'); }, environment: { ...environment, DEAL_TRACKER_ENABLED: '' }, createTransport: mail.createTransport });
  assert.equal(off.configured, false);
});

// The /car-search skill drafts the shortlist update through /api/car-search
// (scripts/car-search.mjs draft). Whatever the request says, the row is a draft
// signed car-search, so only Mason's approval on the ops dashboard posts it.
test('a /car-search draft is always a draft signed car-search, and the buyer never sees it', async t => {
  t.mock.method(console, 'error', () => {});
  const pg = await database(t);
  const sql = tagged(pg);
  const id = await intake(pg);
  const token = 'car-search-token-for-tests-only-0123456789';
  const post = async (body, env = environment) => {
    const res = response();
    await carSearchHandler({ environment: { ...env, CAR_SEARCH_TOKEN: token }, getDatabase: () => sql })({
      method: 'POST', url: '/api/car-search', body,
      headers: { host: 'www.steermeright.com', authorization: `Bearer ${token}`, 'content-type': 'application/json' }
    }, res);
    return { status: res.statusCode, body: JSON.parse(res.body) };
  };
  const rows = async () => (await pg.query(`SELECT status, actor, on_masons_say, ready_for_pick, posted_at, email_after
    FROM buyer_updates WHERE onboarding_id = $1 ORDER BY id`, [id])).rows;

  const saved = await post({ intake_id: id, action: 'draft_update', text: 'CARSEARCH-SENTINEL Your shortlist is in.',
    status: 'posted', post: true, actor: 'mason', on_masons_say: true, ready_for_pick: true });
  assert.equal(saved.status, 200);
  assert.equal(saved.body.update.status, 'draft');
  assert.deepEqual(await rows(), [{ status: 'draft', actor: 'car-search', on_masons_say: false, ready_for_pick: false, posted_at: null, email_after: null }]);
  assert.ok(!(await seen(pg, id)).includes('CARSEARCH-SENTINEL'), 'the draft is not on the page or in the view');

  await approveDraft(sql, saved.body.update.id);
  assert.ok((await seen(pg, id)).includes('CARSEARCH-SENTINEL Your shortlist is in.'), 'Mason\'s approval posts it');

  assert.equal((await post({ intake_id: id, action: 'draft_update', text: '   ' })).body.error, 'invalid_update');
  assert.equal((await post({ intake_id: id, action: 'draft_update', text: 'x'.repeat(4001) })).status, 422);
  const missing = await post({ intake_id: crypto.randomUUID(), action: 'draft_update', text: 'Hello' });
  assert.deepEqual([missing.status, missing.body.error], [404, 'deal_not_found']);
  const off = await post({ intake_id: id, action: 'draft_update', text: 'Hello' }, { APP_ORIGIN: environment.APP_ORIGIN });
  assert.deepEqual([off.status, off.body.error], [404, 'not_found']);
  assert.equal((await rows()).length, 1, 'nothing else was saved');

  // The script sends the text as it reads it, from a file or stdin.
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, init });
    return new Response(JSON.stringify({ ok: true, update: { id: 9, status: 'draft' } }), { status: 200 });
  };
  const sent = await carSearchRequest(['draft', id, '-'], { environment: { CAR_SEARCH_TOKEN: token }, fetchImpl, read: async () => 'From stdin' });
  assert.equal(sent.status, 200);
  assert.equal(calls[0].url, 'https://www.steermeright.com/api/car-search');
  assert.deepEqual(JSON.parse(calls[0].init.body), { intake_id: id, action: 'draft_update', text: 'From stdin' });
  await assert.rejects(carSearchRequest(['draft', id], { environment: { CAR_SEARCH_TOKEN: token }, fetchImpl }), /Usage/);
});

// /car-negotiation and /dealer-reply save their updates the same way, signed with
// their own name. There is no way to post from here: a request can pick which
// skill signs the draft and nothing else, and never Mason.
test('a draft from /car-negotiation or /dealer-reply is signed by that skill, is still only a draft, and no other name is taken', async t => {
  t.mock.method(console, 'error', () => {});
  const pg = await database(t);
  const sql = tagged(pg);
  const id = await intake(pg);
  const token = 'car-search-token-for-tests-only-0123456789';
  const post = async body => {
    const res = response();
    await carSearchHandler({ environment: { ...environment, CAR_SEARCH_TOKEN: token }, getDatabase: () => sql })({
      method: 'POST', url: '/api/car-search', body,
      headers: { host: 'www.steermeright.com', authorization: `Bearer ${token}`, 'content-type': 'application/json' }
    }, res);
    return { status: res.statusCode, body: JSON.parse(res.body) };
  };
  const rows = async () => (await pg.query(`SELECT status, actor, on_masons_say, ready_for_pick, posted_at, email_after
    FROM buyer_updates WHERE onboarding_id = $1 ORDER BY id`, [id])).rows;
  const draft = actor => ({ status: 'draft', actor, on_masons_say: false, ready_for_pick: false, posted_at: null, email_after: null });

  const saved = [];
  for (const skill of ['car-negotiation', 'dealer-reply', 'car-search']) {
    const result = await post({ intake_id: id, action: 'draft_update', skill, text: `SKILL-SENTINEL from ${skill}`,
      status: 'posted', post: true, actor: 'mason', on_masons_say: true, ready_for_pick: true });
    assert.deepEqual([result.status, result.body.update.status, result.body.update.signed], [200, 'draft', skill]);
    saved.push(result.body.update.id);
  }
  assert.deepEqual(await rows(), [draft('car-negotiation'), draft('dealer-reply'), draft('car-search')]);
  assert.ok(!(await seen(pg, id)).includes('SKILL-SENTINEL'), 'no draft is on the page or in the view');

  for (const skill of ['mason', 'Mason', ' mason ', 'duet-deals', 'car-negotiation ', '', 42, true, ['dealer-reply'], { name: 'dealer-reply' }]) {
    const refused = await post({ intake_id: id, action: 'draft_update', skill, text: 'REFUSED-SENTINEL' });
    assert.deepEqual([refused.status, refused.body.error], [400, 'invalid_skill'], JSON.stringify(skill));
  }
  for (const action of ['post_update', 'update', 'post', 'approve_update', 'approve_draft']) {
    const refused = await post({ intake_id: id, action, skill: 'car-negotiation', text: 'REFUSED-SENTINEL', id: saved[0], update_id: saved[0] });
    assert.deepEqual([refused.status, refused.body.error], [400, 'invalid_action'], action);
  }
  assert.deepEqual(await rows(), [draft('car-negotiation'), draft('dealer-reply'), draft('car-search')], 'nothing else was saved or posted');

  // Only Mason's approval on the ops dashboard posts it, and the row keeps the skill's name.
  await approveDraft(sql, saved[0]);
  assert.ok((await seen(pg, id)).includes('SKILL-SENTINEL from car-negotiation'));
  assert.ok(!(await seen(pg, id)).includes('SKILL-SENTINEL from dealer-reply'));
  assert.deepEqual((await rows()).map(row => [row.actor, row.status, row.on_masons_say]),
    [['car-negotiation', 'posted', true], ['dealer-reply', 'draft', false], ['car-search', 'draft', false]]);

  // The script passes the skill's name on, and sends nothing for any other name or a flag.
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, init });
    return new Response(JSON.stringify({ ok: true, update: { id: 9, status: 'draft', signed: 'dealer-reply' } }), { status: 200 });
  };
  const run = args => carSearchRequest(args, { environment: { CAR_SEARCH_TOKEN: token }, fetchImpl, read: async () => 'From stdin' });
  assert.equal((await run(['draft', id, '-', 'dealer-reply'])).status, 200);
  assert.deepEqual(JSON.parse(calls[0].init.body), { intake_id: id, action: 'draft_update', text: 'From stdin', skill: 'dealer-reply' });
  for (const name of ['mason', 'duet-deals', '--post', '--ready-for-pick', '']) {
    await assert.rejects(run(['draft', id, '-', name]), /Usage/, name);
  }
  assert.equal(calls.length, 1, 'nothing else was sent');
});
