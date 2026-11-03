import { createHash, timingSafeEqual } from 'node:crypto';
import { database } from './_lib/db.js';
import { ShortlistError, carSearchToken, handOffDeal, loadSearch, parseShortlist, saveShortlist } from './_lib/car-search.js';
import { dispatchDealJobsSafely } from './_lib/deal-jobs.js';
import { HttpError, header, readJsonBody, requestUrl, sendJson, withApiErrors } from './_lib/http.js';

// Used by the /car-search skill through scripts/car-search.mjs, never by a browser.
// GET ?intake=<id> returns the search details; POST saves the shortlist and
// emails it to Mason; POST with "action": "handoff" marks the deal's first
// emails handed off and returns the deal for the script to post to Grokbot.
export const config = { maxDuration: 30 };
const digest = value => createHash('sha256').update(value).digest();
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HANDOFF_ERRORS = Object.freeze({
  intake_not_found: [404, 'No intake has that ID.'],
  no_shortlist: [409, 'Submit a shortlist for this intake first.'],
  started_in_zoho: [409, 'A first email for this search already went out from Zoho, so finish this deal there.'],
  no_dealer_emails: [409, 'This shortlist has no dealer email left to hand off.']
});

export function carSearchHandler({ environment = process.env, getDatabase = database, dispatch = dispatchDealJobsSafely } = {}) {
  return withApiErrors(async (req, res) => {
    if (!['GET', 'POST'].includes(req.method)) throw new HttpError(405, 'method_not_allowed', 'Use GET, POST');
    const token = carSearchToken(environment);
    if (!token) throw new HttpError(503, 'service_unavailable', 'Car search is not configured');
    if (!timingSafeEqual(digest(header(req, 'authorization') || ''), digest(`Bearer ${token}`))) {
      throw new HttpError(401, 'unauthorized', 'Bearer token required');
    }

    if (req.method === 'GET') {
      const intakeId = requestUrl(req).searchParams.get('intake') || '';
      if (!UUID.test(intakeId)) throw new HttpError(400, 'invalid_intake', 'intake must be an intake ID');
      const search = await loadSearch(getDatabase(), intakeId.toLowerCase());
      if (!search) throw new HttpError(404, 'intake_not_found', 'No intake has that ID');
      return sendJson(res, 200, { ok: true, ...search });
    }

    const body = await readJsonBody(req, 262144);
    const intakeId = typeof body.intake_id === 'string' ? body.intake_id.toLowerCase() : '';
    if (!UUID.test(intakeId)) throw new HttpError(400, 'invalid_intake', 'intake_id must be an intake ID');
    if (body.action === 'handoff') {
      const result = await handOffDeal(getDatabase(), intakeId);
      if (result.error) {
        const [status, message] = HANDOFF_ERRORS[result.error];
        return sendJson(res, status, { ok: false, error: result.error, message });
      }
      return sendJson(res, 200, { ok: true, handoff: result.handoff });
    }
    if (body.action !== undefined) throw new HttpError(400, 'invalid_action', 'action must be "handoff" or left out');

    let shortlist;
    try {
      shortlist = parseShortlist(body.shortlist);
    } catch (error) {
      if (!(error instanceof ShortlistError)) throw error;
      return sendJson(res, 422, { ok: false, error: 'invalid_shortlist', problems: error.problems });
    }

    const sql = getDatabase();
    const [intake] = await sql`SELECT id FROM onboarding_submissions WHERE id = ${intakeId}`;
    if (!intake) throw new HttpError(404, 'intake_not_found', 'No intake has that ID');
    const saved = await saveShortlist(sql, intakeId, shortlist);
    if (saved.locked) {
      return sendJson(res, 409, { ok: false, error: 'emails_already_sent',
        message: 'This search\'s dealer emails have already gone out or been handed to Grokbot, so its shortlist can no longer be replaced.' });
    }
    const email = await dispatch({ sql, environment, dealId: saved.dealId });
    return sendJson(res, 200, {
      ok: true,
      cars: shortlist.listings.length,
      dealer_emails: saved.drafts.map(draft => ({ dealer: draft.dealer_name, to: draft.to_email })),
      email_to_mason: email.sent ? 'sent' : 'queued'
    });
  });
}

export default carSearchHandler();
