// Buyer Texts (docs/adr/0004, db/014): Mason's texts with a buyer, copied from
// the Messages app on his Mac by scripts/imessage-sync.mjs through
// /api/car-search. The Mac asks which threads to send (listTextThreads), reads
// only those numbers and emails, and posts each thread's messages (saveTexts).
// Agents read them (agentTexts), through /api/car-search (scripts/car-search.mjs
// texts) or scripts/deal-desk-db.mjs; the daily cron deletes them 30 days after
// the deal's latest close (cleanupTexts). Nothing here reaches the buyer's page.

const DAY = 86400000;
const KEEP_DAYS = 30;
// A buyer often texts about the car before paying, so the thread starts a week
// before the intake; anything older stays on the Mac.
export const TEXTS_LEAD_DAYS = 7;
export const MAX_TEXTS_PER_REQUEST = 500;
const GUID = /^[A-Za-z0-9:_.\-]{1,100}$/;

const iso = ms => new Date(ms).toISOString();

export class TextsError extends Error {
  constructor(problems) {
    super(`Fix these and send again:\n- ${problems.join('\n- ')}`);
    this.problems = problems;
  }
}

// The deals whose texts the Mac should send: open ones (no close, or reopened
// since). Each comes with the intake's phone and email and where the thread starts.
export async function listTextThreads(sql) {
  const rows = await sql`SELECT o.id, o.phone, o.email, o.created_at FROM deals d
    JOIN onboarding_submissions o ON o.id = d.onboarding_id
    LEFT JOIN LATERAL (SELECT e.kind FROM deal_events e
      WHERE e.onboarding_id = d.onboarding_id AND e.kind IN ('closed', 'reopened')
      ORDER BY e.occurred_at DESC, e.id DESC LIMIT 1) last ON true
    WHERE last.kind IS DISTINCT FROM 'closed'
    ORDER BY o.created_at, o.id`;
  return rows.map(row => ({
    intake_id: row.id, phone: row.phone || null, email: row.email || null,
    since: iso(new Date(row.created_at).getTime() - TEXTS_LEAD_DAYS * DAY)
  }));
}

function boolean(value, path, problems) {
  if (value === undefined) return false;
  if (typeof value !== 'boolean') problems.push(`${path} must be true or false`);
  return value === true;
}

function shortText(value, path, problems, max) {
  if (value == null || value === '') return null;
  if (typeof value !== 'string' || value.length > max) { problems.push(`${path} must be text up to ${max} characters`); return null; }
  return value;
}

// The messages for one thread, checked. Throws TextsError with every problem.
export function parseTexts(input) {
  const problems = [];
  if (!Array.isArray(input)) throw new TextsError(['messages must be a list']);
  if (input.length > MAX_TEXTS_PER_REQUEST) throw new TextsError([`send at most ${MAX_TEXTS_PER_REQUEST} messages at a time`]);
  const messages = input.map((message, index) => {
    const path = `messages[${index}]`;
    const item = message && typeof message === 'object' && !Array.isArray(message) ? message : {};
    if (item !== message) problems.push(`${path} must be an object`);
    if (!GUID.test(item.guid ?? '')) problems.push(`${path}.guid must be the Messages GUID`);
    const sent = Date.parse(item.sent_at ?? '');
    if (Number.isNaN(sent)) problems.push(`${path}.sent_at must be an ISO date`);
    if (typeof item.from_buyer !== 'boolean') problems.push(`${path}.from_buyer must be true or false`);
    const unsent = boolean(item.unsent, `${path}.unsent`, problems);
    const edited = boolean(item.edited, `${path}.edited`, problems);
    let body = item.body ?? '';
    if (typeof body !== 'string' || body.length > 20000) { problems.push(`${path}.body must be text up to 20000 characters`); body = ''; }
    const attachments = item.attachments ?? [];
    if (!Array.isArray(attachments) || attachments.length > 20) problems.push(`${path}.attachments must be a list of at most 20`);
    const files = Array.isArray(attachments) ? attachments.slice(0, 20).map((file, n) => ({
      name: shortText(file?.name, `${path}.attachments[${n}].name`, problems, 200),
      mime: shortText(file?.mime, `${path}.attachments[${n}].mime`, problems, 100)
    })) : [];
    return {
      guid: item.guid, sent_at: Number.isNaN(sent) ? null : iso(sent), from_buyer: item.from_buyer === true,
      body: unsent ? '' : body, service: shortText(item.service, `${path}.service`, problems, 20),
      unsent, edited, attachments: files
    };
  });
  if (problems.length) throw new TextsError(problems);
  return messages;
}

// Saves one thread's messages and records the sync, even with no messages.
// A rerun adds nothing twice; an edited or unsent text replaces the old copy.
// Returns { saved } or { error: 'not_syncing' } for a deal that isn't open.
export async function saveTexts(sql, intakeId, messages, { now = Date.now() } = {}) {
  const open = await listTextThreads(sql);
  if (!open.some(thread => thread.intake_id === intakeId)) return { error: 'not_syncing' };
  let saved = 0;
  for (const message of messages) {
    // ::text first: a bare ::jsonb makes postgres.js see a jsonb parameter and
    // encode the JSON string again, storing a string instead of an array.
    const rows = await sql`INSERT INTO buyer_texts (message_guid, onboarding_id, sent_at, from_buyer, body, service,
        unsent, edited, attachments, synced_at)
      VALUES (${message.guid}, ${intakeId}, ${message.sent_at}::timestamptz, ${message.from_buyer}, ${message.body},
        ${message.service}, ${message.unsent}, ${message.edited}, ${JSON.stringify(message.attachments)}::text::jsonb, ${iso(now)}::timestamptz)
      ON CONFLICT (message_guid) DO UPDATE SET body = EXCLUDED.body, unsent = EXCLUDED.unsent, edited = EXCLUDED.edited,
        attachments = EXCLUDED.attachments, synced_at = EXCLUDED.synced_at
      WHERE buyer_texts.onboarding_id = EXCLUDED.onboarding_id
      RETURNING message_guid`;
    saved += rows.length;
  }
  await sql`INSERT INTO buyer_text_threads (onboarding_id, last_synced_at) VALUES (${intakeId}, ${iso(now)}::timestamptz)
    ON CONFLICT (onboarding_id) DO UPDATE SET last_synced_at = EXCLUDED.last_synced_at`;
  return { saved };
}

// One deal's texts for an agent, oldest first, with when the Mac last synced.
export async function loadTexts(sql, intakeId, { last = null } = {}) {
  const [thread] = await sql`SELECT last_synced_at FROM buyer_text_threads WHERE onboarding_id = ${intakeId}`;
  const rows = await sql`SELECT sent_at, from_buyer, body, service, unsent, edited, attachments
    FROM buyer_texts WHERE onboarding_id = ${intakeId} ORDER BY sent_at, message_guid`;
  const texts = last ? rows.slice(-last) : rows;
  return { last_synced_at: thread?.last_synced_at ?? null, total: rows.length, texts };
}

// What an agent is shown: who sent each text, an unsent one as "[unsent]", and a
// note on how far to trust the thread. last is how many of the newest to show.
export async function agentTexts(sql, intakeId, { last = null } = {}) {
  const { last_synced_at, total, texts } = await loadTexts(sql, intakeId, { last });
  return {
    intake_id: intakeId,
    last_synced_at,
    note: !last_synced_at ? 'Never synced: ask Mason what the buyer said by text.'
      : total ? 'Synced from Mason\'s Mac; anything after last_synced_at is missing.'
        : 'Synced, but no texts match the phone or email on the intake. The buyer may text from another number: ask Mason.',
    total,
    texts: texts.map(text => ({
      sent_at: text.sent_at, from: text.from_buyer ? 'buyer' : 'mason', body: text.unsent ? '[unsent]' : text.body,
      ...(text.edited ? { edited: true } : {}), ...(text.attachments.length ? { attachments: text.attachments } : {})
    }))
  };
}

// Every text on a deal whose latest close/reopen is a close more than 30 days ago.
export async function cleanupTexts({ sql, now = Date.now() }) {
  const deleted = await sql`DELETE FROM buyer_texts t USING (
      SELECT d.onboarding_id FROM deals d
      JOIN LATERAL (SELECT e.kind, e.occurred_at FROM deal_events e
        WHERE e.onboarding_id = d.onboarding_id AND e.kind IN ('closed', 'reopened')
        ORDER BY e.occurred_at DESC, e.id DESC LIMIT 1) last ON true
      WHERE last.kind = 'closed' AND last.occurred_at < ${iso(now - KEEP_DAYS * DAY)}::timestamptz) due
    WHERE t.onboarding_id = due.onboarding_id
    RETURNING t.message_guid`;
  return { deleted: deleted.length };
}

// Texts only arrive through /api/car-search, so without its token there is
// nothing to clean up and the job stays off.
export const buyerTextSettings = (environment = process.env) => Boolean(environment.CAR_SEARCH_TOKEN?.trim());

// The worker shape api/outbox-dispatch.js expects; the daily cron runs it.
export async function runBuyerTextCleanupWorker({ sql, now = Date.now() } = {}) {
  const result = await cleanupTexts({ sql, now });
  return { configured: true, ...result, exitCode: 0 };
}
