import { createHash, timingSafeEqual } from 'node:crypto';
import { blobStore, documentSettings, readDocument, sendDocument } from './_lib/buyer-documents.js';
import { BuyerUpdateError, draftUpdate } from './_lib/buyer-updates.js';
import { database } from './_lib/db.js';
import { dealTrackerEnabled } from './_lib/deal-tracker.js';
import { ShortlistError, carSearchToken, handOffDeal, loadSearch, parseShortlist, saveShortlist } from './_lib/car-search.js';
import { TextsError, listTextThreads, parseTexts, saveTexts } from './_lib/buyer-texts.js';
import { HttpError, header, readJsonBody, requestUrl, sendJson, withApiErrors } from './_lib/http.js';

// Used by the /car-search skill through scripts/car-search.mjs, never by a browser.
// GET ?intake=<id> returns the search details; POST saves the shortlist; POST
// with "action": "handoff" marks the deal's first emails handed off and returns
// the deal for the script to post to Grokbot. GET ?document=<id> returns a Buyer
// Document as a download (scripts/car-search.mjs document <id>). GET ?texts=threads
// lists the open deals' numbers and POST "action": "texts" saves one thread's
// Buyer Texts, both for scripts/imessage-sync.mjs on Mason's Mac (adr/0004).
// POST "action": "draft_update" saves a draft Buyer Update for Mason to approve
// on the ops dashboard (scripts/car-search.mjs draft); it never posts one.
export const config = { maxDuration: 30 };
const digest = value => createHash('sha256').update(value).digest();
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HANDOFF_ERRORS = Object.freeze({
  intake_not_found: [404, 'No intake has that ID.'],
  no_shortlist: [409, 'Submit a shortlist for this intake first.'],
  started_in_zoho: [409, 'A first email for this search already went out from Zoho, so finish this deal there.'],
  no_dealer_emails: [409, 'This shortlist has no dealer email left to hand off.']
});

const DOCUMENT_ERRORS = Object.freeze({
  not_found: [404, 'document_not_found', 'No Buyer Document has that id.'],
  deleted: [410, 'document_deleted', 'This file was deleted 30 days after the deal closed.'],
  missing: [404, 'document_missing', 'The store has no file for this document.']
});

// documentStore: the Blob store, for tests; by default built from documentSettings.
export function carSearchHandler({ environment = process.env, getDatabase = database, documentStore = null } = {}) {
  return withApiErrors(async (req, res) => {
    if (!['GET', 'POST'].includes(req.method)) throw new HttpError(405, 'method_not_allowed', 'Use GET, POST');
    const token = carSearchToken(environment);
    if (!token) throw new HttpError(503, 'service_unavailable', 'Car search is not configured');
    if (!timingSafeEqual(digest(header(req, 'authorization') || ''), digest(`Bearer ${token}`))) {
      throw new HttpError(401, 'unauthorized', 'Bearer token required');
    }

    if (req.method === 'GET' && requestUrl(req).searchParams.has('document')) {
      // An agent fetches a Buyer Document (plan, "Documents").
      if (!dealTrackerEnabled(environment)) return sendJson(res, 404, { ok: false, error: 'not_found', message: 'The Deal Tracker is off.' });
      const documents = documentSettings(environment);
      if (!documents) return sendJson(res, 503, { ok: false, error: 'documents_unavailable', message: 'The Buyer Document store is not set up.' });
      const file = await readDocument({ sql: getDatabase(), store: documentStore ?? blobStore(documents),
        id: requestUrl(req).searchParams.get('document') });
      if (file.error) {
        const [status, error, message] = DOCUMENT_ERRORS[file.error];
        return sendJson(res, status, { ok: false, error, message });
      }
      return sendDocument(res, file);
    }

    if (req.method === 'GET' && requestUrl(req).searchParams.get('texts') === 'threads') {
      return sendJson(res, 200, { ok: true, threads: await listTextThreads(getDatabase()) });
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
    if (body.action === 'texts') {
      let messages;
      try {
        messages = parseTexts(body.messages);
      } catch (error) {
        if (!(error instanceof TextsError)) throw error;
        return sendJson(res, 422, { ok: false, error: 'invalid_texts', problems: error.problems });
      }
      const result = await saveTexts(getDatabase(), intakeId, messages);
      if (result.error) return sendJson(res, 409, { ok: false, error: 'not_syncing', message: 'This intake has no open deal, so its texts are not synced.' });
      return sendJson(res, 200, { ok: true, saved: result.saved });
    }
    if (body.action === 'draft_update') {
      // Always a draft, always signed car-search: whatever else the request says,
      // only Mason's approval on the ops dashboard puts it in front of the buyer.
      if (!dealTrackerEnabled(environment)) return sendJson(res, 404, { ok: false, error: 'not_found', message: 'The Deal Tracker is off.' });
      let draft;
      try {
        draft = await draftUpdate(getDatabase(), { onboardingId: intakeId, body: body.text, actor: 'car-search' });
      } catch (error) {
        if (!(error instanceof BuyerUpdateError)) throw error;
        return sendJson(res, 422, { ok: false, error: 'invalid_update', message: error.message });
      }
      if (!draft) return sendJson(res, 404, { ok: false, error: 'deal_not_found', message: 'This intake has no deal, so it has no Deal Tracker to draft for.' });
      return sendJson(res, 200, { ok: true, update: { id: draft.id, status: 'draft' },
        next: 'Mason gets an email and approves or discards the draft on the deal\'s ops page. The buyer sees nothing until he approves.' });
    }
    if (body.action !== undefined) throw new HttpError(400, 'invalid_action', 'action must be "handoff", "texts", "draft_update" or left out');

    // With the Deal Tracker on, every car needs its estimated total and color.
    const tracker = dealTrackerEnabled(environment);
    let shortlist;
    try {
      shortlist = parseShortlist(body.shortlist, { requireTracker: tracker });
    } catch (error) {
      if (!(error instanceof ShortlistError)) throw error;
      return sendJson(res, 422, { ok: false, error: 'invalid_shortlist', problems: error.problems });
    }

    const sql = getDatabase();
    const [intake] = await sql`SELECT id FROM onboarding_submissions WHERE id = ${intakeId}`;
    if (!intake) throw new HttpError(404, 'intake_not_found', 'No intake has that ID');
    const saved = await saveShortlist(sql, intakeId, shortlist, { tracker });
    if (saved.locked) {
      return sendJson(res, 409, { ok: false, error: 'emails_already_sent',
        message: 'This search\'s dealer emails have already gone out or been handed to Grokbot, so its shortlist can no longer be replaced.' });
    }
    return sendJson(res, 200, {
      ok: true,
      cars: shortlist.listings.length,
      dealer_emails: saved.drafts.map(draft => ({ dealer: draft.dealer_name, to: draft.to_email }))
    });
  });
}

export default carSearchHandler();
