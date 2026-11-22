import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { listReceipts, readDocument, runDocumentCleanupWorker } from '../_lib/buyer-documents.js';
import { releaseHeld } from '../_lib/buyer-questions.js';
import { MAX_MAIL_BODY, dealMailSettings, gmailClient, readDealMail, replyText, runDealMailWorker } from '../_lib/deal-mail.js';
import { loadBuyerView, renderTracker, replyToken } from '../_lib/deal-tracker.js';
import { dispatchOpsAlerts, opsAlertSettings, queueAlerts } from '../_lib/ops-alerts.js';
import { listDocuments, listQuestions } from '../../scripts/deal-desk-db.mjs';

// The reply address (build step 7; plan, "Reading the reply addresses"; adr/0001):
// mail to a buyer's reply address read through a fake Gmail, the buyer's own
// accepted, everyone else's held, nothing else touched, and the emailed
// originals trashed 30 days after close. No test reaches Google or Vercel.

const SECRET = 'deal-tracker-secret-for-tests-only-0123456789';
const MAILBOX = 'replies@example.test';
const environment = {
  DEAL_TRACKER_ENABLED: '1', DEAL_TRACKER_SECRET: SECRET, APP_ORIGIN: 'https://www.steermeright.com', DEAL_REPLY_MAILBOX: MAILBOX,
  BLOB_READ_WRITE_TOKEN: 'vercel_blob_rw_token_for_tests_only',
  DEAL_MAIL_CLIENT_ID: 'client-id-for-tests', DEAL_MAIL_CLIENT_SECRET: 'client-secret-for-tests', DEAL_MAIL_REFRESH_TOKEN: 'refresh-token-for-tests'
};
const settings = dealMailSettings(environment);
// Real time: the alert queries compare with the database's own now().
const NOW = Date.now();
const DAY = 86400000;
const MB = 1024 * 1024;
const BUYER = 'riley.buyer@example.test';
const PASS = 'mx.google.com; dkim=pass header.i=@example.test; spf=pass smtp.mailfrom=riley.buyer@example.test; dmarc=pass (p=NONE sp=NONE dis=NONE) header.from=example.test';

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

// A paid intake with its deal and live link, in Confirming search.
async function deal(pg, { email = BUYER } = {}) {
  const id = crypto.randomUUID(), attempt = crypto.randomUUID(), purchase = crypto.randomUUID(), session = `cs_live_${id}`;
  await pg.query(`INSERT INTO checkout_attempts (id, client_reference_id, idempotency_key, request_hash, tier_id, expected_amount, status)
    VALUES ($1, $1, $2, $3, 'full_service', 39500, 'paid')`, [attempt, attempt, 'a'.repeat(64)]);
  await pg.query(`INSERT INTO stripe_events (event_id, event_type, checkout_session_id, livemode, stripe_created_at)
    VALUES ($1, 'checkout.session.completed', $1, true, now())`, [session]);
  await pg.query(`INSERT INTO purchases (id, checkout_session_id, checkout_attempt_id, client_reference_id, stripe_event_id,
    stripe_payment_intent_id, tier_id, amount_total, currency, payment_status, livemode, paid_at)
    VALUES ($1, $2, $3, $3, $2, 'pi_1', 'full_service', 39500, 'usd', 'paid', true, now())`, [purchase, session, attempt]);
  await pg.query(`INSERT INTO onboarding_submissions (id, checkout_session_id, purchase_id, idempotency_key, request_hash, tier_id, name, email, phone, city, fields)
    VALUES ($1, $2, $3, $5, $4, 'full_service', 'Riley Buyer', $6, '205-555-0100', 'Austin', '{}')`,
  [id, session, purchase, 'b'.repeat(64), id, email]);
  await pg.query('INSERT INTO deals (id, onboarding_id) VALUES ($1, $2)', [crypto.randomUUID(), id]);
  await pg.query('INSERT INTO deal_tracker_links (onboarding_id) VALUES ($1)', [id]);
  return id;
}
const event = (pg, id, kind, daysAgo) => pg.query(`INSERT INTO deal_events (onboarding_id, kind, actor, note, occurred_at)
  VALUES ($1, $2, 'mason', 'Bought', $3)`, [id, kind, new Date(NOW - daysAgo * DAY).toISOString()]);

const replyTo = id => `replies+${replyToken(SECRET, id)}@example.test`;
const PDF = Buffer.from('%PDF-1.7\nPDF-BODY-SENTINEL');
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from('PNG-BODY')]);
const b64 = value => Buffer.from(value).toString('base64url');

// One message as Gmail's API returns it: metadata (headers only) and full.
let seq = 0;
function message({ to = null, deliveredTo = null, cc = null, xOriginalTo = null, from = `Riley Buyer <${BUYER}>`, auth = PASS,
  headers = [], text = 'Is the doc fee in the price?', html = null, files = [], labels = ['INBOX'] } = {}) {
  const id = `msg${++seq}`;
  const head = [
    ...(deliveredTo ? [['Delivered-To', deliveredTo]] : []), ...(to ? [['To', to]] : []), ...(cc ? [['Cc', cc]] : []),
    ...(xOriginalTo ? [['X-Original-To', xOriginalTo]] : []), ['From', from], ['Subject', 'Re: An update on your car search'],
    ...(auth ? [['Authentication-Results', auth]] : []), ...headers
  ].map(([name, value]) => ({ name, value }));
  const attachments = {};
  const parts = [
    ...(text != null ? [{ partId: '0', mimeType: 'text/plain', filename: '', headers: [{ name: 'Content-Type', value: 'text/plain; charset="UTF-8"' }], body: { size: text.length, data: b64(text) } }] : []),
    ...(html != null ? [{ partId: '1', mimeType: 'text/html', filename: '', headers: [{ name: 'Content-Type', value: 'text/html; charset=UTF-8' }], body: { size: html.length, data: b64(html) } }] : []),
    ...files.map((file, index) => {
      const attachmentId = `att-${id}-${index}`;
      attachments[attachmentId] = file.bytes;
      return { partId: String(index + 2), mimeType: file.type, filename: file.name, headers: [{ name: 'Content-Disposition', value: `attachment; filename="${file.name}"` }],
        body: { attachmentId, size: file.size ?? file.bytes.length } };
    })
  ];
  const internalDate = String(NOW - 60000);
  return {
    id, attachments,
    meta: { id, labelIds: labels, internalDate, payload: { headers: head } },
    full: { id, labelIds: labels, internalDate, payload: { partId: '', mimeType: 'multipart/mixed', filename: '', headers: head, body: { size: 0 }, parts } }
  };
}

// Gmail behind fetch. Records every call; refuses anything but the five calls the site may make.
function fakeGmail(messages = []) {
  const box = new Map(messages.map(item => [item.id, item]));
  const calls = [];
  const failTrash = new Set();
  const reply = (status, body = {}) => ({ ok: status >= 200 && status < 300, status, json: async () => body });
  const fetch = async (href, init = {}) => {
    const method = init.method ?? 'GET';
    calls.push({ method, href, body: init.body });
    if (href === 'https://oauth2.googleapis.com/token') {
      assert.equal(method, 'POST');
      return reply(200, { access_token: 'ya29.access-token-for-tests', expires_in: 3599 });
    }
    assert.equal(init.headers?.authorization, 'Bearer ya29.access-token-for-tests');
    const url = new URL(href);
    const path = url.pathname.replace('/gmail/v1/users/me/', '');
    assert.doesNotMatch(path, /delete/i, 'never a delete endpoint');
    assert.ok(method === 'GET' || (method === 'POST' && path.endsWith('/trash')), `${method} ${path}`);
    if (path === 'messages') return reply(200, { messages: [...box.keys()].reverse().map(id => ({ id, threadId: id })), resultSizeEstimate: box.size });
    const [, id, rest, attachmentId] = /^messages\/([^/]+)(?:\/(attachments|trash)(?:\/(.+))?)?$/.exec(path) ?? [];
    const item = box.get(id);
    if (!item) return reply(404, { error: { code: 404 } });
    if (rest === 'trash') return failTrash.has(id) ? reply(503) : (box.delete(id), reply(200, { id, labelIds: ['TRASH'] }));
    if (rest === 'attachments') return reply(200, { size: item.attachments[attachmentId].length, data: b64(item.attachments[attachmentId]) });
    return reply(200, url.searchParams.get('format') === 'full' ? item.full : item.meta);
  };
  return {
    fetch, calls, box, failTrash,
    fullFetched: () => calls.filter(call => call.href.includes('format=full')).map(call => /messages\/([^?/]+)/.exec(call.href)[1]),
    count: kind => calls.filter(call => kind(call)).length
  };
}

function fakeStore() {
  const blobs = new Map();
  const calls = [];
  return {
    blobs, calls,
    async put(pathname, body, { contentType }) { calls.push(['put', pathname]); blobs.set(pathname, { body: Buffer.from(body), contentType }); },
    async get(pathname) { calls.push(['get', pathname]); const blob = blobs.get(pathname); return blob ? { body: blob.body, size: blob.body.length, contentType: blob.contentType } : null; },
    async del(pathname) { calls.push(['del', pathname]); blobs.delete(pathname); }
  };
}

const run = (pg, gmail, store, extra = {}) => readDealMail({ sql: tagged(pg), settings, fetch: gmail.fetch, store, now: NOW, ...extra });
const questions = async pg => (await pg.query('SELECT * FROM buyer_questions ORDER BY id')).rows;
const documents = async pg => (await pg.query('SELECT * FROM buyer_documents ORDER BY id')).rows;
const alertEnv = { OPS_ALERT_EMAIL: 'alerts@example.test', INTAKE_SMTP_USER: 'hello@steermeright.com', INTAKE_SMTP_PASSWORD: 'app-password-not-real' };
async function alerts(pg) {
  await queueAlerts(tagged(pg), { ...opsAlertSettings(alertEnv), digestHour: 24 }, NOW, { tracker: true });
  return (await pg.query(`SELECT dedupe_key FROM ops_alert_outbox WHERE kind <> 'digest' ORDER BY dedupe_key`)).rows.map(row => row.dedupe_key);
}

test('switched off or missing any value, the mail job makes no network call and no query', async () => {
  assert.ok(settings && settings.mailbox === MAILBOX && settings.oauth.refreshToken === 'refresh-token-for-tests');
  const sql = () => { throw new Error('must not query'); };
  for (const name of ['DEAL_TRACKER_ENABLED', 'DEAL_REPLY_MAILBOX', 'BLOB_READ_WRITE_TOKEN', 'DEAL_MAIL_CLIENT_ID', 'DEAL_MAIL_CLIENT_SECRET', 'DEAL_MAIL_REFRESH_TOKEN']) {
    const env = { ...environment, [name]: '' };
    assert.equal(dealMailSettings(env), null, name);
    let calls = 0;
    const result = await runDealMailWorker({ sql, environment: env, fetch: async () => { calls++; }, store: fakeStore() });
    assert.equal(result.configured, false, name);
    assert.equal(calls, 0, name);
  }
});

test('the buyer\'s own mail that passed DMARC is a Buyer Question, alerts Mason and shows on their page; quoted text is cut', async t => {
  const pg = await database(t);
  const id = await deal(pg);
  const mail = message({ to: `Mason <${replyTo(id)}>`, from: `"Riley Buyer" <Riley.Buyer@Example.test>`,
    text: 'Is the doc fee <b>in</b> the price?\n\nThanks,\nRiley\n\nOn Tue, Dec 1, 2026 at 9:00 AM Mason <x@example.test> wrote:\n> QUOTED-SENTINEL\n> more' });
  const gmail = fakeGmail([mail]);
  const result = await run(pg, gmail, fakeStore());
  assert.deepEqual(result, { configured: true, listed: 1, already: 0, not_ours: 0, skipped: 0, accepted: 1, held: 0, documents: 0, failed: 0 });

  const [row] = await questions(pg);
  assert.deepEqual([row.onboarding_id, row.source, row.held, row.sender_email, row.mail_message_id, row.body],
    [id, 'email', false, BUYER, mail.id, 'Is the doc fee <b>in</b> the price?\n\nThanks,\nRiley']);
  assert.deepEqual(await alerts(pg), [`question:${row.id}`], 'the same alert a question from the page raises');
  const view = await loadBuyerView(tagged(pg), id, NOW);
  assert.deepEqual(view.timeline.map(item => [item.type, item.body, item.by_email]), [['question', row.body, true]]);
  const html = renderTracker(view);
  assert.ok(html.includes('You asked by email') && html.includes('Is the doc fee &lt;b&gt;in&lt;/b&gt; the price?'));
  assert.ok(!html.includes('QUOTED-SENTINEL') && !html.includes(BUYER) && !html.includes(mail.id));
  // The sign-in is a refresh-token grant, form-encoded.
  const signIn = gmail.calls.find(call => call.href.startsWith('https://oauth2.googleapis.com/'));
  assert.deepEqual(Object.fromEntries(new URLSearchParams(signIn.body)), {
    grant_type: 'refresh_token', client_id: 'client-id-for-tests', client_secret: 'client-secret-for-tests', refresh_token: 'refresh-token-for-tests' });
});

test('any other sender, or the buyer\'s address without a DMARC pass from Google, is held: off the page and out of the agents\' queue', async t => {
  const pg = await database(t);
  const sql = tagged(pg);
  const id = await deal(pg);
  const to = replyTo(id);
  const cases = {
    cousin: message({ to, from: 'Cousin <cousin@example.test>', text: 'HELD-SENTINEL-1', files: [{ name: 'id.pdf', type: 'application/pdf', bytes: PDF }] }),
    failed: message({ to, auth: PASS.replace('dmarc=pass', 'dmarc=fail'), text: 'HELD-SENTINEL-2' }),
    missing: message({ to, auth: null, text: 'HELD-SENTINEL-3' }),
    // A sender can write its own Authentication-Results; only the topmost, Google's own, counts.
    forged: message({ to, auth: 'mx.example.test; dmarc=fail header.from=example.test', headers: [['Authentication-Results', PASS]], text: 'HELD-SENTINEL-4' }),
    otherDomain: message({ to, auth: PASS.replace('header.from=example.test', 'header.from=elsewhere.test'), text: 'HELD-SENTINEL-5' }),
    unreadable: message({ to, auth: 'mx.google.com; garbled', text: 'HELD-SENTINEL-6' }),
    twoSenders: message({ to, from: `${BUYER}, cousin@example.test`, text: 'HELD-SENTINEL-7' })
  };
  const store = fakeStore();
  const result = await run(pg, fakeGmail(Object.values(cases)), store);
  assert.deepEqual([result.accepted, result.held, result.documents, result.failed], [0, 7, 1, 0]);

  const rows = await questions(pg);
  assert.ok(rows.every(row => row.held && row.source === 'email' && !row.released_at));
  const bySender = Object.fromEntries(rows.map(row => [row.mail_message_id, row.sender_email]));
  assert.equal(bySender[cases.cousin.id], 'cousin@example.test');
  assert.equal(bySender[cases.failed.id], BUYER);
  assert.equal(bySender[cases.twoSenders.id], `${BUYER}, cousin@example.test`);
  assert.deepEqual(await alerts(pg), rows.map(row => `held:${row.id}`).sort());
  // Mason's alert says why: a stranger's address, or the buyer's own that failed the sender check. Never the text.
  const sent = [];
  await dispatchOpsAlerts({ sql, environment: { ...alertEnv, DEAL_TRACKER_ENABLED: '1', DEAL_TRACKER_SECRET: SECRET }, now: NOW,
    createTransport: () => ({ async sendMail(mail) { sent.push(mail); } }) });
  const held = sent.filter(mail => mail.subject === 'Held email on Riley Buyer\'s deal');
  assert.equal(held.length, 7);
  assert.ok(held.some(mail => mail.text.includes('from cousin@example.test') && mail.text.includes('isn\'t the address on their intake')));
  assert.ok(held.some(mail => mail.text.includes(`from ${BUYER}`) && mail.text.includes('didn\'t pass Google\'s sender check (DMARC)')));
  assert.ok(!sent.some(mail => /HELD-SENTINEL/.test(mail.text + mail.html)));

  // Nothing from held mail reaches the buyer's page, the agents' queue or an agent's download.
  const html = renderTracker(await loadBuyerView(sql, id, NOW));
  for (const needle of ['HELD-SENTINEL', 'cousin@example.test', BUYER, 'msg']) assert.ok(!html.includes(needle), needle);
  assert.deepEqual(await listReceipts(sql, id), []);
  assert.deepEqual(await listQuestions(sql, id), []);
  assert.deepEqual(await listDocuments(sql, id), []);
  const [doc] = await documents(pg);
  assert.deepEqual(await readDocument({ sql, store, id: doc.id, forAgent: true }), { error: 'held' });

  // Released, the cousin's mail and its document count, still without the sender on the page.
  const cousin = rows.find(row => row.mail_message_id === cases.cousin.id);
  assert.equal(await releaseHeld(sql, cousin.id, id), true);
  const after = renderTracker(await loadBuyerView(sql, id, NOW));
  assert.ok(after.includes('HELD-SENTINEL-1') && !after.includes('HELD-SENTINEL-2') && !after.includes('cousin@example.test'));
  assert.equal((await listReceipts(sql, id)).length, 1);
  assert.equal((await readDocument({ sql, store, id: doc.id, forAgent: true })).contentType, 'application/pdf');
});

test('auto-replies and bounces are skipped whole, never fetched in full', async t => {
  const pg = await database(t);
  const to = replyTo(await deal(pg));
  const skipped = [
    message({ to, headers: [['Auto-Submitted', 'auto-replied']] }),
    message({ to, headers: [['Auto-Submitted', 'auto-generated; owner-email=x@example.test']] }),
    message({ to, headers: [['Precedence', 'bulk']] }),
    message({ to, headers: [['Precedence', 'auto_reply']] }),
    message({ to, headers: [['Return-Path', '<>']] }),
    message({ to, from: 'Mail Delivery Subsystem <MAILER-DAEMON@example.test>' }),
    message({ to, from: 'postmaster@example.test' })
  ];
  const kept = message({ to, headers: [['Auto-Submitted', 'no']] });
  const gmail = fakeGmail([...skipped, kept]);
  const result = await run(pg, gmail, fakeStore());
  assert.deepEqual([result.skipped, result.accepted], [7, 1]);
  assert.deepEqual(gmail.fullFetched(), [kept.id]);
  assert.equal((await questions(pg)).length, 1);
});

test('mail to an unknown token, a revoked or expired link, or no token is left alone: headers only, no row, no trash', async t => {
  const pg = await database(t);
  const live = await deal(pg);
  const revoked = await deal(pg);
  await pg.query('UPDATE deal_tracker_links SET revoked_at = now() WHERE onboarding_id = $1', [revoked]);
  const expired = await deal(pg);
  await event(pg, expired, 'closed', 4);
  const grace = await deal(pg);
  await event(pg, grace, 'closed', 2);
  const reopened = await deal(pg);
  await event(pg, reopened, 'closed', 10);
  await event(pg, reopened, 'reopened', 1);

  const untouched = [
    message({ to: replyTo(revoked) }), message({ to: replyTo(expired) }),
    message({ to: `replies+${'0'.repeat(20)}@example.test` }), message({ to: MAILBOX }),
    message({ to: replyTo(live).replace('@example.test', '@elsewhere.test') }), message({ to: replyTo(live).replace('replies+', 'other+') }),
    // Our own sent copy of a reply is never a question.
    message({ to: replyTo(live), labels: ['SENT'] })
  ];
  const filed = [message({ to: replyTo(grace) }), message({ to: replyTo(reopened) })];
  const gmail = fakeGmail([...untouched, ...filed]);
  const result = await run(pg, gmail, fakeStore());
  assert.deepEqual([result.not_ours, result.accepted], [untouched.length, 2]);
  assert.deepEqual(gmail.fullFetched().sort(), filed.map(item => item.id).sort(), 'format=full only for a matched message');
  assert.equal(gmail.count(call => call.method !== 'GET' && !call.href.startsWith('https://oauth2')), 0, 'nothing moved or changed in the mailbox');
  assert.deepEqual((await questions(pg)).map(row => row.onboarding_id).sort(), [grace, reopened].sort());
  // The list asks for recent mail, not sent or drafts, with a bound.
  const list = new URL(gmail.calls.find(call => /\/messages\?/.test(call.href)).href);
  assert.match(list.searchParams.get('q'), /newer_than:\d+d/);
  assert.match(list.searchParams.get('q'), /-in:sent/);
  assert.ok(Number(list.searchParams.get('maxResults')) <= 500);
  const metadata = new URL(gmail.calls.find(call => call.href.includes('format=metadata')).href);
  assert.deepEqual(metadata.searchParams.getAll('metadataHeaders').sort(),
    ['Authentication-Results', 'Auto-Submitted', 'Cc', 'Delivered-To', 'From', 'Precedence', 'Return-Path', 'Subject', 'To', 'X-Original-To']);
});

test('the plus address is found in Delivered-To, To, Cc or X-Original-To', async t => {
  const pg = await database(t);
  const id = await deal(pg);
  const address = replyTo(id);
  const other = 'someone@example.test';
  const mails = [
    message({ deliveredTo: address, to: other }),
    message({ deliveredTo: MAILBOX, to: `"Mason at Steer Me Right" <${address.toUpperCase()}>` }),
    message({ to: `${other}, Mason <${address}>`, cc: other }),
    message({ to: 'undisclosed-recipients:;', cc: `a@example.test, ${address}` }),
    message({ to: other, xOriginalTo: address })
  ];
  const result = await run(pg, fakeGmail(mails), fakeStore());
  assert.equal(result.accepted, mails.length);
  assert.ok((await questions(pg)).every(row => row.onboarding_id === id));
});

test('images and PDFs under 20 MB are filed as Buyer Documents, an ID before Price agreed included; anything else is ignored', async t => {
  const pg = await database(t);
  const sql = tagged(pg);
  const id = await deal(pg);
  const mail = message({ to: replyTo(id), text: 'Here is my license and the pre-approval.', files: [
    { name: 'license.png', type: 'image/png', bytes: PNG },
    { name: 'preapproval.pdf', type: 'application/pdf', bytes: PDF },
    { name: 'scan.pdf', type: 'application/octet-stream', bytes: PDF },
    { name: 'huge.pdf', type: 'application/pdf', bytes: PDF, size: 20 * MB + 1 },
    { name: 'letter.docx', type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', bytes: Buffer.from('PK') },
    { name: 'fake.png', type: 'image/png', bytes: Buffer.from('<html><script>alert(1)</script>') }
  ] });
  const gmail = fakeGmail([mail]);
  const store = fakeStore();
  const result = await run(pg, gmail, store);
  assert.deepEqual([result.accepted, result.documents], [1, 3]);
  const fetched = gmail.calls.filter(call => call.href.includes('/attachments/')).map(call => call.href.split('/attachments/')[1]);
  assert.ok(!fetched.includes(`att-${mail.id}-3`) && !fetched.includes(`att-${mail.id}-4`), 'oversize and other types are never downloaded');

  const [question] = await questions(pg);
  const docs = await documents(pg);
  assert.deepEqual(docs.map(doc => [doc.doc_type, doc.content_type, Number(doc.bytes), doc.source, doc.mail_message_id, Number(doc.question_id)]), [
    ['other', 'image/png', PNG.length, 'email', mail.id, Number(question.id)],
    ['other', 'application/pdf', PDF.length, 'email', mail.id, Number(question.id)],
    ['other', 'application/pdf', PDF.length, 'email', mail.id, Number(question.id)]
  ]);
  assert.ok(docs.every(doc => doc.blob_path.startsWith(`deals/${id}/mail-`) && !doc.blob_path.includes(mail.id) && store.blobs.has(doc.blob_path)));
  assert.ok(store.blobs.get(docs[1].blob_path).body.equals(PDF));
  assert.equal((await listReceipts(sql, id)).length, 3, 'the buyer sees receipts');
  assert.equal((await loadBuyerView(sql, id, NOW)).stage, 'confirming', 'filed long before Price agreed');
  assert.equal((await readDocument({ sql, store, id: docs[0].id, forAgent: true })).contentType, 'image/png');
});

test('a rerun files nothing twice, re-uploads nothing and alerts nothing new; a failure midway is retried cleanly', async t => {
  const pg = await database(t);
  const id = await deal(pg);
  // Listed newest first, so the buyer's message is read before the cousin's.
  const mails = [
    message({ to: replyTo(id), from: 'cousin@example.test', files: [{ name: 'b.png', type: 'image/png', bytes: PNG }, { name: 'c.pdf', type: 'application/pdf', bytes: PDF }] }),
    message({ to: replyTo(id), files: [{ name: 'a.pdf', type: 'application/pdf', bytes: PDF }] })
  ];
  const gmail = fakeGmail(mails);
  const store = fakeStore();
  // The second message's second file fails to store: that message files nothing and leaves no file behind.
  const flaky = { ...store, async put(pathname, body, options) { if (store.calls.filter(call => call[0] === 'put').length === 2) { store.calls.push(['put-failed', pathname]); throw new Error('store down'); } return store.put(pathname, body, options); } };
  const first = await run(pg, gmail, flaky);
  assert.deepEqual([first.accepted, first.held, first.failed, first.documents], [1, 0, 1, 1]);
  assert.equal((await questions(pg)).length, 1);
  assert.equal(store.blobs.size, 1, 'the stray file of the failed message is removed');

  const second = await run(pg, gmail, store);
  assert.deepEqual([second.already, second.accepted, second.held, second.failed, second.documents], [1, 0, 1, 0, 2]);
  const before = { questions: await questions(pg), documents: await documents(pg), puts: store.calls.filter(call => call[0] === 'put').length, alerts: await alerts(pg) };
  assert.equal(before.documents.length, 3);
  assert.equal(store.blobs.size, 3);

  const fulls = gmail.fullFetched().length;
  const third = await run(pg, gmail, store);
  assert.deepEqual([third.already, third.accepted, third.held, third.documents], [2, 0, 0, 0]);
  assert.equal(gmail.fullFetched().length, fulls, 'a filed message is never fetched again');
  assert.deepEqual(await questions(pg), before.questions);
  assert.deepEqual(await documents(pg), before.documents);
  assert.equal(store.calls.filter(call => call[0] === 'put').length, before.puts);
  assert.deepEqual(await alerts(pg), before.alerts);
});

test('replyText keeps the buyer\'s words and cuts quotes and signatures conservatively; HTML-only mail is read as text', async t => {
  assert.equal(replyText('Yes please.\r\n\r\n-- \r\nRiley\r\n555-0100'), 'Yes please.');
  assert.equal(replyText('Sounds good\n\nSent from my iPhone'), 'Sounds good');
  assert.equal(replyText('Top.\n\n-----Original Message-----\nFrom: x'), 'Top.');
  assert.equal(replyText('Top.\n________________________________\nFrom: Mason'), 'Top.');
  assert.equal(replyText('Top.\nOn Tue, Dec 1, 2026 at 9:00 AM Mason Wright <mason@example.test>\nwrote:\n> old'), 'Top.');
  assert.equal(replyText('> quoted answer\nMy reply under it'), '> quoted answer\nMy reply under it', 'inline answers keep their context');
  assert.equal(replyText('FYI\n---------- Forwarded message ---------\nFrom: dealer'), 'FYI\n---------- Forwarded message ---------\nFrom: dealer', 'a forward stays');
  assert.equal(replyText('x'.repeat(MAX_MAIL_BODY + 50)).length, MAX_MAIL_BODY);

  const pg = await database(t);
  const id = await deal(pg);
  await run(pg, fakeGmail([message({ to: replyTo(id), text: null, html: '<div>Can we do <b>Friday</b>?<br>Thanks &amp; regards</div><style>.x{}</style>' })]), fakeStore());
  assert.equal((await questions(pg))[0].body, 'Can we do Friday?\nThanks & regards');
});

test('cleanup trashes each emailed original 30 days after close, sets mail_trashed_at, never deletes mail, and retries a Gmail failure', async t => {
  const pg = await database(t);
  const sql = tagged(pg);
  const closed = await deal(pg);
  const open = await deal(pg);
  const store = fakeStore();
  const withFiles = message({ to: replyTo(closed), files: [{ name: 'a.pdf', type: 'application/pdf', bytes: PDF }, { name: 'b.png', type: 'image/png', bytes: PNG }] });
  const flaky = message({ to: replyTo(closed), files: [{ name: 'c.pdf', type: 'application/pdf', bytes: PDF }] });
  const questionOnly = message({ to: replyTo(closed), text: 'No files here' });
  const stillOpen = message({ to: replyTo(open), files: [{ name: 'd.pdf', type: 'application/pdf', bytes: PDF }] });
  const gmail = fakeGmail([withFiles, flaky, questionOnly, stillOpen]);
  await run(pg, gmail, store);
  assert.equal((await documents(pg)).length, 4);
  await event(pg, closed, 'closed', 31);
  gmail.failTrash.add(flaky.id);

  const mail = gmailClient(settings.oauth, gmail.fetch);
  const first = await runDocumentCleanupWorker({ sql, environment, store, mail, now: NOW });
  assert.deepEqual(first, { configured: true, deleted: 3, failed: 0, trashed: 1, trash_failed: 1, exitCode: 1 });
  const trashCalls = () => gmail.calls.filter(call => call.method === 'POST' && call.href.endsWith('/trash')).map(call => /messages\/([^/]+)\/trash/.exec(call.href)[1]);
  assert.deepEqual(trashCalls().sort(), [withFiles.id, flaky.id].sort(), 'once per message, never the question-only mail or an open deal\'s');
  const rows = await documents(pg);
  const trashed = rows.filter(row => row.mail_trashed_at).map(row => row.mail_message_id);
  assert.deepEqual(trashed, [withFiles.id, withFiles.id]);
  assert.ok(rows.filter(row => row.onboarding_id === closed).every(row => row.deleted_at), 'a Gmail failure doesn\'t hold up the files');
  assert.ok(!gmail.calls.some(call => /delete/i.test(call.href) || call.method === 'DELETE'));

  gmail.failTrash.clear();
  const second = await runDocumentCleanupWorker({ sql, environment, store, mail, now: NOW });
  assert.deepEqual([second.trashed, second.trash_failed, second.deleted, second.exitCode], [1, 0, 0, 0]);
  const third = await runDocumentCleanupWorker({ sql, environment, store, mail, now: NOW });
  assert.deepEqual([third.trashed, third.trash_failed], [0, 0]);
  assert.equal(trashCalls().length, 3);
  assert.ok((await documents(pg)).filter(row => row.onboarding_id === closed).every(row => row.mail_trashed_at));
  assert.ok((await documents(pg)).filter(row => row.onboarding_id === open).every(row => !row.mail_trashed_at && !row.deleted_at));

  // A message Mason already removed counts as trashed rather than failing forever.
  const gone = await deal(pg);
  const lost = message({ to: replyTo(gone), files: [{ name: 'e.pdf', type: 'application/pdf', bytes: PDF }] });
  gmail.box.set(lost.id, lost);
  await run(pg, gmail, store);
  gmail.box.delete(lost.id);
  await event(pg, gone, 'closed', 40);
  const fourth = await runDocumentCleanupWorker({ sql, environment, store, mail, now: NOW });
  assert.deepEqual([fourth.trashed, fourth.trash_failed], [1, 0]);

  // Without the mailbox set up, cleanup is the files alone, as before.
  const filesOnly = await runDocumentCleanupWorker({ sql, environment: { ...environment, DEAL_MAIL_REFRESH_TOKEN: '' }, store, now: NOW });
  assert.deepEqual(filesOnly, { configured: true, deleted: 0, failed: 0, exitCode: 0 });
});
