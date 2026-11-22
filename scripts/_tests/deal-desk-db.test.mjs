import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { addUpdate, listDocuments, listPicks, listQuestions, parseEvent, parseUpdateArgs, showDeal } from '../deal-desk-db.mjs';

const intake = '0a1b2c3d-1111-4222-8333-444455556666';

test('a quote becomes one deal_events row', () => {
  const row = parseEvent({
    intake_id: intake.toUpperCase(), kind: 'quote', dealer_name: ' Example Toyota ', vin: '4t1dakbe1sa000000',
    otd_cents: 2925800, itemized: { sale_cents: 2700000, doc_fee_cents: 22500 }, source_message_id: 'msg-1',
    occurred_at: '2026-11-11T20:00:00Z'
  });
  assert.equal(row.onboarding_id, intake);
  assert.equal(row.dealer_name, 'Example Toyota');
  assert.equal(row.vin, '4T1DAKBE1SA000000');
  assert.equal(row.occurred_at, '2026-11-11T20:00:00.000Z');
});

test('every problem is reported at once', () => {
  assert.throws(() => parseEvent({ intake_id: '0a1b2c3d', kind: 'offer', vin: 'short', otd_cents: 12.5 }),
    /intake_id.*kind.*vin.*otd_cents/);
});

test('a quote needs a number', () => {
  assert.throws(() => parseEvent({ intake_id: intake, kind: 'quote' }), /quote needs otd_cents or itemized/);
  assert.equal(parseEvent({ intake_id: intake, kind: 'note', note: 'Dealer called' }).otd_cents, null);
});

test('an agent logs who it is, what blocks it, and which block is resolved', () => {
  const need = parseEvent({ intake_id: intake, kind: 'needs_mason', actor: 'duet-deals', note: 'Approve the counter to Example Toyota' });
  assert.deepEqual([need.actor, need.resolves_event_id], ['duet-deals', null]);
  assert.throws(() => parseEvent({ intake_id: intake, kind: 'needs_mason' }), /needs_mason needs a note/);
  assert.equal(parseEvent({ intake_id: intake, kind: 'resolved', resolves_event_id: 42 }).resolves_event_id, 42);
  assert.throws(() => parseEvent({ intake_id: intake, kind: 'resolved' }), /resolved needs resolves_event_id/);
  assert.throws(() => parseEvent({ intake_id: intake, kind: 'note', note: 'x', resolves_event_id: 42 }), /only a resolved/);
  assert.throws(() => parseEvent({ intake_id: intake, kind: 'note', note: 'x', actor: '<bot>' }), /actor must be/);
  assert.equal(parseEvent({ intake_id: intake, kind: 'form_submitted', dealer_name: 'Example Toyota' }).kind, 'form_submitted');
});

test('a question carries answer buttons, and an answer belongs on its resolved', () => {
  assert.equal(parseEvent({ intake_id: intake, kind: 'needs_mason', note: 'Counter?', options: [' Approve ', 'Decline'] }).options, '["Approve","Decline"]');
  assert.throws(() => parseEvent({ intake_id: intake, kind: 'needs_mason', note: 'x', options: [] }), /options is for a needs_mason only/);
  assert.throws(() => parseEvent({ intake_id: intake, kind: 'note', note: 'x', options: ['a'] }), /options is for a needs_mason only/);
  assert.equal(parseEvent({ intake_id: intake, kind: 'resolved', resolves_event_id: 7, answer: 'Approve' }).answer, 'Approve');
  assert.throws(() => parseEvent({ intake_id: intake, kind: 'note', note: 'x', answer: 'Approve' }), /answer is for a resolved only/);
});

test('a quote or agreed names the car by VIN; a counter needn\'t', () => {
  for (const kind of ['quote', 'agreed']) {
    assert.throws(() => parseEvent({ intake_id: intake, kind, otd_cents: 3000000 }),
      new RegExp(`a ${kind} needs vin, the 17-character VIN of the car it prices`));
    assert.equal(parseEvent({ intake_id: intake, kind, vin: '4T1DAKBE1SA000000', otd_cents: 3000000 }).kind, kind);
  }
  assert.equal(parseEvent({ intake_id: intake, kind: 'counter', otd_cents: 2950000 }).vin, null);
});

test('parseUpdateArgs reads the actor, the flags and the text source in any order', () => {
  assert.deepEqual(parseUpdateArgs(['duet-deals', '--post', '--answers', '12', '--ready-for-pick', '-']),
    { actor: 'duet-deals', source: '-', post: true, readyForPick: true, answersQuestionId: '12' });
  assert.deepEqual(parseUpdateArgs(['duet-deals', 'update.txt']),
    { actor: 'duet-deals', source: 'update.txt', post: false, readyForPick: false, answersQuestionId: null });
  assert.throws(() => parseUpdateArgs(['duet-deals']), /Usage/);
  assert.throws(() => parseUpdateArgs(['duet-deals', '-', '--answers']), /Usage/);
  assert.throws(() => parseUpdateArgs(['duet-deals', '--publish', '-']), /Unknown option --publish/);
});

const migrationNames = ['001_durable_leads_and_payments.sql', '002_standard_purchase_analytics.sql',
  '003_checkout_offer_snapshot.sql', '004_intake_email_outbox.sql', '005_deal_search.sql', '006_dealer_handoff.sql',
  '007_deal_events.sql', '008_deal_events_per_car.sql', '012_deal_events_agents.sql', '013_deal_tracker.sql'];
const migrations = await Promise.all(migrationNames.map(name => readFile(new URL(`../../db/${name}`, import.meta.url), 'utf8')));

function tagged(client) {
  return async (strings, ...values) => {
    const query = strings.reduce((text, part, index) => text + (index ? `$${index}` : '') + part, '');
    return (await client.query(query, values)).rows;
  };
}

// A database with one paid intake that has a deal and one shortlisted car, and one intake without a deal.
async function database(t, { through013 = true } = {}) {
  const pg = await PGlite.create();
  t.after(() => pg.close());
  for (const migration of through013 ? migrations : migrations.slice(0, -1)) await pg.exec(migration);
  const intake = async ({ deal = true } = {}) => {
    const id = crypto.randomUUID(), attempt = crypto.randomUUID(), purchase = crypto.randomUUID(), session = `cs_live_${id}`;
    await pg.query(`INSERT INTO checkout_attempts (id, client_reference_id, idempotency_key, request_hash, tier_id, expected_amount, status)
      VALUES ($1, $1, $2, $3, 'full_service', 39500, 'paid')`, [attempt, attempt, 'a'.repeat(64)]);
    await pg.query(`INSERT INTO stripe_events (event_id, event_type, checkout_session_id, livemode, stripe_created_at)
      VALUES ($1, 'checkout.session.completed', $1, true, now())`, [session]);
    await pg.query(`INSERT INTO purchases (id, checkout_session_id, checkout_attempt_id, client_reference_id, stripe_event_id,
      stripe_payment_intent_id, tier_id, amount_total, currency, payment_status, livemode, paid_at)
      VALUES ($1, $2, $3, $3, $2, 'pi_1', 'full_service', 39500, 'usd', 'paid', true, now())`, [purchase, session, attempt]);
    await pg.query(`INSERT INTO onboarding_submissions (id, checkout_session_id, purchase_id, idempotency_key, request_hash, tier_id, name, email, phone, city, fields)
      VALUES ($1, $2, $3, $5, $4, 'full_service', 'Pat Buyer', 'buyer@example.test', '205-555-0100', 'Austin, TX', '{}')`,
    [id, session, purchase, 'b'.repeat(64), id]);
    if (!deal) return id;
    const dealId = crypto.randomUUID();
    await pg.query(`INSERT INTO deals (id, onboarding_id, search_summary, shortlisted_at) VALUES ($1, $2, 'One RAV4 near Austin', now())`, [dealId, id]);
    await pg.query(`INSERT INTO deal_listings (id, deal_id, rank, title, price_cents, vin, listing_url, dealer_name)
      VALUES ($1, $2, 1, '2025 Toyota RAV4 XLE', 3400000, '2T3P1RFV5SW000001', 'https://dealer.example/rav4', 'North Toyota')`, [crypto.randomUUID(), dealId]);
    return id;
  };
  return { pg, sql: tagged(pg), withDeal: await intake(), withoutDeal: await intake({ deal: false }) };
}

test('addUpdate saves a draft for Mason to approve', async t => {
  const { sql, withDeal } = await database(t);
  const row = await addUpdate(sql, { intakeId: withDeal.toUpperCase(), actor: 'duet-deals', body: '  Two dealers have quoted on the 2025 RAV4 XLE in Blue.  ' });
  assert.equal(row.status, 'draft');
  assert.equal(row.posted_at, null);
  assert.equal(row.email_after, null);
  const [saved] = await sql`SELECT body, on_masons_say, ready_for_pick, actor, onboarding_id FROM buyer_updates WHERE id = ${row.id}`;
  assert.deepEqual(saved, { body: 'Two dealers have quoted on the 2025 RAV4 XLE in Blue.', on_masons_say: false, ready_for_pick: false, actor: 'duet-deals', onboarding_id: withDeal });
});

test('addUpdate with post shows at once and emails about five minutes later', async t => {
  const { pg, sql, withDeal } = await database(t);
  const [{ id: questionId }] = (await pg.query(`INSERT INTO buyer_questions (onboarding_id, body, source) VALUES ($1, 'Any news?', 'page') RETURNING id`, [withDeal])).rows;
  const row = await addUpdate(sql, { intakeId: withDeal, actor: 'duet-deals', body: 'Prices are in. Pick the one you want.', post: true, readyForPick: true, answersQuestionId: String(questionId) });
  assert.equal(row.status, 'posted');
  const wait = new Date(row.email_after) - new Date(row.posted_at);
  assert.ok(Math.abs(wait - 5 * 60_000) < 1000, `email_after is ${wait} ms after posted_at`);
  const [saved] = await sql`SELECT on_masons_say, ready_for_pick, answers_question_id FROM buyer_updates WHERE id = ${row.id}`;
  assert.deepEqual([saved.on_masons_say, saved.ready_for_pick, Number(saved.answers_question_id)], [true, true, Number(questionId)]);
});

test('addUpdate refuses bad text, Mason\'s name, bad actors and IDs, and intakes with no deal', async t => {
  const { sql, withDeal, withoutDeal } = await database(t);
  const add = values => addUpdate(sql, { intakeId: withDeal, actor: 'duet-deals', body: 'Hello', ...values });
  await assert.rejects(add({ body: '   ' }), /needs some text/);
  await assert.rejects(add({ body: 'x'.repeat(4001) }), /at most 4000 characters/);
  assert.equal((await add({ body: 'x'.repeat(4000) })).status, 'draft');
  await assert.rejects(add({ actor: 'mason' }), /can't be mason/);
  await assert.rejects(add({ actor: 'Mason', post: true }), /can't be mason/);
  await assert.rejects(add({ actor: '<bot>' }), /actor must be/);
  await assert.rejects(add({ intakeId: withDeal.slice(0, 8) }), /full intake ID/);
  await assert.rejects(add({ intakeId: withoutDeal }), /No deal for/);
  await assert.rejects(add({ answersQuestionId: '999' }), /Buyer Question 999 isn't on this deal/);
  await assert.rejects(add({ answersQuestionId: 'abc' }), /--answers needs a Buyer Question id/);
  const [{ count }] = await sql`SELECT count(*)::int AS count FROM buyer_updates`;
  assert.equal(count, 1, 'only the 4000-character draft went in');
});

test('questions lists Buyer Questions unanswered first, hides held mail until released and discarded mail always', async t => {
  const { pg, sql, withDeal } = await database(t);
  const ask = async (body, { source = 'page', sender = null, held = false, minutesAgo = 0, deal = withDeal } = {}) =>
    Number((await pg.query(`INSERT INTO buyer_questions (onboarding_id, body, source, sender_email, held, mail_message_id, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, now() - $7 * interval '1 minute') RETURNING id`,
    [deal, body, source, sender, held, source === 'email' ? `msg-id-${body}` : null, minutesAgo])).rows[0].id);
  const answered = await ask('ANSWERED-OLDEST', { minutesAgo: 30 });
  const open = await ask('OPEN-LATER', { minutesAgo: 10 });
  const emailed = await ask('EMAILED', { source: 'email', sender: 'buyer@example.test', minutesAgo: 20 });
  const held = await ask('HELD-SENTINEL', { source: 'email', sender: 'cousin@example.test', held: true, minutesAgo: 5 });
  const dropped = await ask('DISCARD-SENTINEL', { source: 'email', sender: 'spam@example.test', held: true, minutesAgo: 4 });
  await pg.query('UPDATE buyer_questions SET discarded_at = now() WHERE id = $1', [dropped]);
  await addUpdate(sql, { intakeId: withDeal, actor: 'duet-deals', body: 'A draft does not answer it', answersQuestionId: String(open) });
  await pg.query(`INSERT INTO buyer_updates (onboarding_id, body, status, actor, answers_question_id) VALUES ($1, 'Yes.', 'posted', 'mason', $2)`, [withDeal, answered]);

  const rows = await listQuestions(sql, withDeal.toUpperCase());
  assert.deepEqual(rows.map(row => [Number(row.id), row.answered]), [[emailed, false], [open, false], [answered, true]]);
  assert.deepEqual(Object.keys(rows[0]).sort(), ['answered', 'body', 'created_at', 'id', 'intake_id', 'sender_email', 'source']);
  assert.deepEqual([rows[0].source, rows[0].sender_email, rows[0].intake_id], ['email', 'buyer@example.test', withDeal]);
  const everyDeal = await listQuestions(sql);
  assert.equal(everyDeal.length, 3);
  assert.ok(!everyDeal.some(row => [held, dropped].includes(Number(row.id))), 'held and discarded mail are not listed');
  const all = JSON.stringify(everyDeal);
  for (const hidden of ['HELD-SENTINEL', 'cousin@example.test', 'DISCARD-SENTINEL', 'spam@example.test']) assert.ok(!all.includes(hidden), hidden);

  await pg.query('UPDATE buyer_questions SET released_at = now() WHERE id = $1', [held]);
  const released = await listQuestions(sql);
  assert.ok(released.some(row => Number(row.id) === held && row.body === 'HELD-SENTINEL' && row.sender_email === 'cousin@example.test'));
  assert.ok(!JSON.stringify(released).includes('DISCARD-SENTINEL'));

  // A deal filter: another deal's question doesn't show under this one.
  const { pg: pg2, sql: sql2, withDeal: deal2 } = await database(t);
  await pg2.query(`INSERT INTO buyer_questions (onboarding_id, body, source) VALUES ($1, 'THIS-DEAL', 'page')`, [deal2]);
  assert.deepEqual((await listQuestions(sql2, deal2)).map(row => row.body), ['THIS-DEAL']);
  assert.deepEqual(await listQuestions(sql2, crypto.randomUUID()), []);
  await assert.rejects(listQuestions(sql2, deal2.slice(0, 8)), /full intake ID/);
});

test('showDeal lists the deal\'s Buyer Updates, or null before db/013', async t => {
  const { sql, withDeal } = await database(t);
  await addUpdate(sql, { intakeId: withDeal, actor: 'duet-deals', body: 'Draft for Mason' });
  await addUpdate(sql, { intakeId: withDeal, actor: 'duet-deals', body: 'Posted on his say', post: true });
  const deal = await showDeal(sql, withDeal.slice(0, 8));
  assert.deepEqual(deal.updates.map(update => [update.body, update.status, update.on_masons_say]),
    [['Draft for Mason', 'draft', false], ['Posted on his say', 'posted', true]]);
  assert.deepEqual(Object.keys(deal.updates[0]).sort(), ['actor', 'answers_question_id', 'body', 'created_at', 'emailed_at', 'id',
    'on_masons_say', 'posted_at', 'ready_for_pick', 'retracted_at', 'status']);

  const before = await database(t, { through013: false });
  const old = await showDeal(before.sql, before.withDeal);
  assert.equal(old.updates, null);
  assert.equal(old.intake_id, before.withDeal);
  assert.equal(old.listings.length, 1);
  assert.deepEqual(old.events, []);
});

test('picks lists standing Buyer Picks newest first with the car\'s title, never cleared ones, and writes nothing', async t => {
  const { pg, sql, withDeal } = await database(t);
  const { rows: [update] } = await pg.query(`INSERT INTO buyer_updates (onboarding_id, body, status, ready_for_pick, actor) VALUES ($1, 'Ready', 'posted', true, 'mason') RETURNING id`, [withDeal]);
  const { rows: [later] } = await pg.query(`INSERT INTO buyer_updates (onboarding_id, body, status, ready_for_pick, actor) VALUES ($1, 'Ready again', 'posted', true, 'mason') RETURNING id`, [withDeal]);
  const insert = async (kind, opening, minutesAgo, values = [null, null, null]) =>
    Number((await pg.query(`INSERT INTO buyer_picks (onboarding_id, kind, opened_by_update_id, vin, dealer_name, otd_cents, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, now() - $7 * interval '1 minute') RETURNING id`, [withDeal, kind, opening, ...values, minutesAgo])).rows[0].id);
  const cleared = await insert('pick', update.id, 30, ['2T3P1RFV5SW000001', 'North Toyota', 3300000]);
  await pg.query(`UPDATE buyer_picks SET cleared_at = now(), cleared_by = 'mason' WHERE id = $1`, [cleared]);
  const pick = await insert('pick', update.id, 20, ['2T3P1RFV5SW000001', 'North Toyota', 3350000]);
  const keep = await insert('keep_looking', later.id, 10);
  const before = JSON.stringify((await pg.query('SELECT * FROM buyer_picks ORDER BY id')).rows);

  const rows = await listPicks(sql, withDeal.toUpperCase());
  assert.deepEqual(rows.map(row => Number(row.id)), [keep, pick]);
  assert.deepEqual(Object.keys(rows[0]).sort(), ['created_at', 'dealer_name', 'id', 'intake_id', 'kind', 'otd_cents', 'title', 'vin']);
  assert.deepEqual([rows[1].kind, rows[1].vin, rows[1].dealer_name, rows[1].otd_cents, rows[1].title, rows[1].intake_id],
    ['pick', '2T3P1RFV5SW000001', 'North Toyota', 3350000, '2025 Toyota RAV4 XLE', withDeal]);
  assert.deepEqual([rows[0].kind, rows[0].vin, rows[0].title], ['keep_looking', null, null]);
  assert.equal((await listPicks(sql)).length, 2);
  assert.deepEqual(await listPicks(sql, crypto.randomUUID()), []);
  await assert.rejects(listPicks(sql, withDeal.slice(0, 8)), /full intake ID/);
  assert.equal(JSON.stringify((await pg.query('SELECT * FROM buyer_picks ORDER BY id')).rows), before, 'read-only');
});

test('documents lists the Buyer Documents an agent may use, newest first, never deleted ones or ones on held mail, and writes nothing', async t => {
  const { pg, sql, withDeal } = await database(t);
  const held = async released => Number((await pg.query(`INSERT INTO buyer_questions (onboarding_id, body, source, sender_email, held, mail_message_id, released_at)
    VALUES ($1, 'files', 'email', 'cousin@example.test', true, $2, $3) RETURNING id`, [withDeal, `mail-${crypto.randomUUID()}`, released ? new Date().toISOString() : null])).rows[0].id);
  const add = async (docType, minutesAgo, { source = 'page', questionId = null, deleted = false } = {}) =>
    Number((await pg.query(`INSERT INTO buyer_documents (onboarding_id, doc_type, blob_path, content_type, bytes, source, question_id, mail_message_id, created_at, deleted_at)
      VALUES ($1, $2, $3, 'application/pdf', 4096, $4, $5, $6, now() - $7 * interval '1 minute', $8) RETURNING id`,
    [withDeal, docType, `deals/${withDeal}/${crypto.randomUUID()}.pdf`, source, questionId, source === 'email' ? `mail-${crypto.randomUUID()}` : null, minutesAgo,
      deleted ? new Date().toISOString() : null])).rows[0].id);
  const older = await add('pre_approval', 30);
  const newer = await add('insurance', 10);
  const released = await add('payoff_letter', 20, { source: 'email', questionId: await held(true) });
  await add('id', 5, { source: 'email', questionId: await held(false) });
  await add('trade_in_title', 1, { deleted: true });
  const before = JSON.stringify((await pg.query('SELECT * FROM buyer_documents ORDER BY id')).rows);

  const rows = await listDocuments(sql, withDeal.toUpperCase());
  assert.deepEqual(rows.map(row => Number(row.id)), [newer, released, older]);
  assert.deepEqual(Object.keys(rows[0]).sort(), ['bytes', 'content_type', 'created_at', 'doc_type', 'id', 'intake_id', 'source']);
  assert.ok(!JSON.stringify(rows).includes('deals/'), 'no store path');
  assert.deepEqual([rows[1].doc_type, rows[1].source, Number(rows[1].bytes), rows[1].intake_id], ['payoff_letter', 'email', 4096, withDeal]);
  assert.equal((await listDocuments(sql)).length, 3);
  assert.deepEqual(await listDocuments(sql, crypto.randomUUID()), []);
  await assert.rejects(listDocuments(sql, withDeal.slice(0, 8)), /full intake ID/);
  assert.equal(JSON.stringify((await pg.query('SELECT * FROM buyer_documents ORDER BY id')).rows), before, 'read-only');
});
