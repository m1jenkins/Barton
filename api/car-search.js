import { createHash, timingSafeEqual } from 'node:crypto';
import { database } from './_lib/db.js';
import { ShortlistError, carSearchToken, loadSearch, parseShortlist, saveShortlist } from './_lib/car-search.js';
import { dealLinkSettings, draftLink } from './_lib/deal-email.js';
import { dispatchDealJobsSafely } from './_lib/deal-jobs.js';
import { HttpError, header, readJsonBody, requestUrl, sendJson, withApiErrors } from './_lib/http.js';

// Used by the /car-search skill through scripts/car-search.mjs, never by a browser.
// GET ?intake=<id> returns the search details; POST saves the shortlist and
// emails Mason a send link for each dealer email draft.
export const config = { maxDuration: 30 };
const digest = value => createHash('sha256').update(value).digest();
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

    const links = dealLinkSettings(environment);
    if (!links) throw new HttpError(503, 'service_unavailable', 'DEAL_LINK_SECRET is not configured');
    const body = await readJsonBody(req, 262144);
    const intakeId = typeof body.intake_id === 'string' ? body.intake_id.toLowerCase() : '';
    if (!UUID.test(intakeId)) throw new HttpError(400, 'invalid_intake', 'intake_id must be an intake ID');
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
        message: 'A dealer email for this search has already gone out, so its shortlist can no longer be replaced.' });
    }
    const email = await dispatch({ sql, environment, dealId: saved.dealId });
    return sendJson(res, 200, {
      ok: true,
      cars: shortlist.listings.length,
      dealer_emails: saved.drafts.map(draft => ({ dealer: draft.dealer_name, to: draft.to_email, review_and_send: draftLink(links, draft.id) })),
      email_to_mason: email.sent ? 'sent' : 'queued'
    });
  });
}

export default carSearchHandler();
