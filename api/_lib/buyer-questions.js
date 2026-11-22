// Buyer Questions (GLOSSARY.md, docs/adr/0001 and 0002). Only this website code
// writes them: the buyer asks on the Deal Tracker (askQuestion), and Mason
// releases or discards held mail from the ops dashboard. Agents read them with
// scripts/deal-desk-db.mjs and answer with a Buyer Update.

export const MAX_QUESTION_LENGTH = 4000;
// Per link, counted from the rows already there (plan, "The page").
const PER_HOUR = 5;
const PER_DAY = 20;
// A second identical submit this soon after the first is a double click, not a question.
const REPEAT_MINUTES = 10;
const MINUTE = 60000;

const iso = ms => new Date(ms).toISOString();

// Form posts send CRLF; the page and the ops dashboard want plain newlines.
export function cleanQuestion(body) {
  const text = String(body ?? '').replace(/\r\n?/g, '\n').trim();
  if (!text) return { error: 'empty' };
  if (text.length > MAX_QUESTION_LENGTH) return { error: 'too_long' };
  return { text };
}

// A question from the buyer's page. created_at is the request's time, so the
// rate limit and the timeline agree with the clock the handler was given.
export async function askQuestion(sql, { onboardingId, body, now = Date.now() }) {
  const { text, error } = cleanQuestion(body);
  if (error) return { error };
  const [recent] = await sql`SELECT
      count(*) FILTER (WHERE created_at > ${iso(now - 60 * MINUTE)}::timestamptz)::int AS hour,
      count(*)::int AS day,
      (SELECT q.body FROM buyer_questions q
        WHERE q.onboarding_id = ${onboardingId} AND q.source = 'page' AND q.created_at > ${iso(now - REPEAT_MINUTES * MINUTE)}::timestamptz
        ORDER BY q.created_at DESC, q.id DESC LIMIT 1) AS last_body
    FROM buyer_questions
    WHERE onboarding_id = ${onboardingId} AND source = 'page' AND created_at > ${iso(now - 1440 * MINUTE)}::timestamptz`;
  if (recent?.last_body === text) return { ok: true, repeat: true };
  if (recent && (recent.hour >= PER_HOUR || recent.day >= PER_DAY)) return { error: 'rate_limited' };
  const [row] = await sql`INSERT INTO buyer_questions (onboarding_id, body, source, created_at)
    VALUES (${onboardingId}, ${text}, 'page', ${iso(now)}::timestamptz) RETURNING id`;
  return { ok: true, id: Number(row.id) };
}

// Held mail (from anyone but the buyer) counts only once Mason releases it.
// Each acts once, on a held row of that deal that is neither released nor discarded.
export async function releaseHeld(sql, id, onboardingId) {
  const rows = await sql`UPDATE buyer_questions SET released_at = now()
    WHERE id = ${id} AND onboarding_id = ${onboardingId} AND held AND released_at IS NULL AND discarded_at IS NULL
    RETURNING id`;
  return rows.length === 1;
}

export async function discardHeld(sql, id, onboardingId) {
  const rows = await sql`UPDATE buyer_questions SET discarded_at = now()
    WHERE id = ${id} AND onboarding_id = ${onboardingId} AND held AND released_at IS NULL AND discarded_at IS NULL
    RETURNING id`;
  return rows.length === 1;
}
