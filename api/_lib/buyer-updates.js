// The writes only the website makes to Buyer Updates and the buyer's link
// (GLOSSARY.md, docs/adr/0002, docs/deal-tracker-build-plan-2026-11-21.md).
// Agents insert updates through scripts/deal-desk-db.mjs, or as drafts through
// /api/car-search (scripts/car-search.mjs draft); every change after
// that is Mason's, from the ops dashboard. Each statement checks the row's
// current state in its WHERE clause, so a double submit changes nothing twice.

export const MAX_UPDATE_LENGTH = 4000;

// A message Mason can be shown as it is ("Not saved: ...").
export class BuyerUpdateError extends Error {
  constructor(message) {
    super(message);
    this.name = 'BuyerUpdateError';
  }
}

// Form posts send CRLF; the page and the email want plain newlines.
export function cleanBody(body) {
  const text = String(body ?? '').replace(/\r\n?/g, '\n').trim();
  if (!text) throw new BuyerUpdateError('The update is empty');
  if (text.length > MAX_UPDATE_LENGTH) throw new BuyerUpdateError(`The update is over ${MAX_UPDATE_LENGTH.toLocaleString('en-US')} characters`);
  return text;
}

// Mason's own update: posted at once. The insert trigger sets posted_at and
// email_after (five minutes on), which is his window to take it back.
export async function postUpdate(sql, { onboardingId, body, readyForPick = false }) {
  const text = cleanBody(body);
  const [row] = await sql`INSERT INTO buyer_updates (onboarding_id, body, status, ready_for_pick, actor)
    SELECT d.onboarding_id, ${text}, 'posted', ${Boolean(readyForPick)}, 'mason'
    FROM deals d WHERE d.onboarding_id = ${onboardingId}
    RETURNING id`;
  if (!row) throw new BuyerUpdateError('No such deal');
  return { id: row.id };
}

// A draft from the /car-search skill (POST /api/car-search "draft_update"). It
// never posts: only Mason's approval on the ops dashboard does. Null when the
// intake has no deal.
export async function draftUpdate(sql, { onboardingId, body, actor }) {
  const text = cleanBody(body);
  const [row] = await sql`INSERT INTO buyer_updates (onboarding_id, body, status, ready_for_pick, actor)
    SELECT d.onboarding_id, ${text}, 'draft', false, ${actor}
    FROM deals d WHERE d.onboarding_id = ${onboardingId}
    RETURNING id`;
  return row ? { id: Number(row.id) } : null;
}

// Each of these takes an optional intake ID: the ops dashboard passes the deal
// the form came from, so an update ID from another deal changes nothing.

// An agent's draft goes out: Mason's approval is his say (on_masons_say), and
// the take-back window starts now.
export async function approveDraft(sql, id, onboardingId = null) {
  const rows = await sql`UPDATE buyer_updates
    SET status = 'posted', posted_at = now(), email_after = now() + interval '5 minutes', on_masons_say = true
    WHERE id = ${id} AND status = 'draft' AND (${onboardingId}::uuid IS NULL OR onboarding_id = ${onboardingId}::uuid)
    RETURNING id`;
  return rows.length === 1;
}

// A discarded draft is retracted without ever having been posted.
export async function discardDraft(sql, id, onboardingId = null) {
  const rows = await sql`UPDATE buyer_updates SET status = 'retracted', retracted_at = now()
    WHERE id = ${id} AND status = 'draft' AND (${onboardingId}::uuid IS NULL OR onboarding_id = ${onboardingId}::uuid)
    RETURNING id`;
  return rows.length === 1;
}

// Mason takes a posted update back. It leaves the page at once; if its email
// already went, that can't be recalled, but the page no longer shows it.
export async function retractUpdate(sql, id, onboardingId = null) {
  const rows = await sql`UPDATE buyer_updates SET status = 'retracted', retracted_at = now()
    WHERE id = ${id} AND status = 'posted' AND (${onboardingId}::uuid IS NULL OR onboarding_id = ${onboardingId}::uuid)
    RETURNING id`;
  return rows.length === 1;
}

// The dealer names (from dealerNames in deal-view.js) that appear in an
// update's text, ignoring case and spacing, as first written in the list.
export function dealerNameWarning(body, names) {
  const flat = value => String(value ?? '').toLowerCase().replace(/\s+/g, ' ').trim();
  const text = flat(body);
  return [...new Set(names.filter(name => flat(name) && text.includes(flat(name))))];
}

// ---------- The buyer's link ----------

export async function revokeLink(sql, onboardingId) {
  const rows = await sql`UPDATE deal_tracker_links SET revoked_at = now()
    WHERE onboarding_id = ${onboardingId} AND revoked_at IS NULL RETURNING version`;
  return rows.length === 1;
}

export async function restoreLink(sql, onboardingId) {
  const rows = await sql`UPDATE deal_tracker_links SET revoked_at = NULL
    WHERE onboarding_id = ${onboardingId} AND revoked_at IS NOT NULL RETURNING version`;
  return rows.length === 1;
}

// A new link: the version goes up, which kills every older one, and the opened
// times start again so Mason can see whether the new link has been opened.
// fromVersion (from the ops form) keeps a double submit from skipping a version.
export async function reissueLink(sql, onboardingId, fromVersion = null) {
  const rows = await sql`UPDATE deal_tracker_links
    SET version = version + 1, revoked_at = NULL, first_opened_at = NULL, last_opened_at = NULL
    WHERE onboarding_id = ${onboardingId} AND (${fromVersion}::integer IS NULL OR version = ${fromVersion}::integer)
    RETURNING version`;
  return rows[0]?.version ?? null;
}
