import { createHash, timingSafeEqual } from 'node:crypto';
import { blobStore, documentSettings, listDocuments, readDocument, sendDocument } from './_lib/buyer-documents.js';
import { listPicks } from './_lib/buyer-picks.js';
import { BuyerUpdateError, draftUpdate } from './_lib/buyer-updates.js';
import { database } from './_lib/db.js';
import { dealTrackerEnabled } from './_lib/deal-tracker.js';
import { DEAL_ID, ShortlistError, carSearchToken, findDeal, handOffDeal, loadDeal, loadSearch, parseShortlist, saveShortlist } from './_lib/car-search.js';
import { TextsError, agentTexts, listTextThreads, parseTexts, saveTexts } from './_lib/buyer-texts.js';
import { agentDealerTexts, listDealerThreads, parseContact, saveDealerTexts } from './_lib/dealer-texts.js';
import { HttpError, header, readJsonBody, requestUrl, sendJson, withApiErrors } from './_lib/http.js';

// Used by the /car-search skill through scripts/car-search.mjs, never by a browser.
// GET ?intake=<id> returns the search details; POST saves the shortlist; POST
// with "action": "handoff" marks the deal's first emails handed off, which locks
// the shortlist, and sends nothing. GET ?document=<id> returns a Buyer
// Document as a download (scripts/car-search.mjs document <id>). GET ?texts=threads
// lists the open deals' numbers and POST "action": "texts" saves one thread's
// Buyer Texts, both for scripts/imessage-sync.mjs on Mason's Mac (adr/0004).
// GET ?texts=dealers and POST "action": "dealer_texts" do the same for Dealer
// Texts, a dealer's thread filed under a deal (adr/0005).
// POST "action": "draft_update" saves a draft Buyer Update for Mason to approve
// on the ops dashboard (scripts/car-search.mjs draft); it never posts one. The
// draft is signed with the skill that wrote it ("skill", one of DRAFT_SKILLS).
// GET ?intake=<id>&read=picks|documents|texts|deal is what an agent working a
// deal reads without a database login (scripts/car-search.mjs picks, documents,
// texts, deal): the standing Buyer Picks, the list of Buyer Documents (never a
// file), the Buyer Texts with the Dealer Texts, or the shortlist and event log. Nothing here writes a
// Buyer Pick or a Buyer Document: only the buyer's page does (adr/0002).
export const config = { maxDuration: 30 };
const digest = value => createHash('sha256').update(value).digest();
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HANDOFF_ERRORS = Object.freeze({
  intake_not_found: [404, 'No intake has that ID.'],
  no_shortlist: [409, 'Submit a shortlist for this intake first.'],
  no_dealer_emails: [409, 'This shortlist has no dealer email left to hand off.']
});

const DOCUMENT_ERRORS = Object.freeze({
  not_found: [404, 'document_not_found', 'No Buyer Document has that id.'],
  deleted: [410, 'document_deleted', 'This file was deleted 30 days after the deal closed.'],
  missing: [404, 'document_missing', 'The store has no file for this document.']
});

const READS = Object.freeze(['picks', 'documents', 'texts', 'deal']);
// The skills Mason runs that may save a draft Buyer Update, and so the only
// names a draft from here can be signed with. Left out, it is car-search.
const DRAFT_SKILLS = Object.freeze(['car-search', 'car-negotiation', 'dealer-reply']);
const TRACKER_OFF = Object.freeze({ ok: false, error: 'not_found', message: 'The Deal Tracker is off.' });

// One of the reads above, for the deal an intake ID or its first 8 characters
// names. Buyer Picks and Buyer Documents exist only with the Deal Tracker on;
// off, the answer is 404 before the database is touched.
async function sendRead(res, params, { environment, getDatabase }) {
  const read = params.get('read');
  if (!READS.includes(read)) return sendJson(res, 400, { ok: false, error: 'invalid_read', message: `read must be one of ${READS.join(', ')}` });
  if (['picks', 'documents'].includes(read) && !dealTrackerEnabled(environment)) return sendJson(res, 404, TRACKER_OFF);
  const last = params.get('last');
  if (last != null && !(read === 'texts' && /^[1-9]\d{0,3}$/.test(last))) {
    return sendJson(res, 400, { ok: false, error: 'invalid_last', message: 'last goes with read=texts only: how many of the newest texts to show, 1 to 9999' });
  }
  const intake = params.get('intake') || '';
  if (!DEAL_ID.test(intake)) return sendJson(res, 400, { ok: false, error: 'invalid_intake', message: 'intake must be an intake ID or its first 8 characters' });
  const sql = getDatabase();
  const found = await findDeal(sql, intake);
  if (found.error === 'ambiguous') return sendJson(res, 409, { ok: false, error: 'ambiguous_intake', message: `That matches ${found.matches} deals; give more of the intake ID.` });
  if (found.error) return sendJson(res, 404, { ok: false, error: 'deal_not_found', message: 'No deal has that intake ID. An intake has a deal once it has a car search, or from paid intake with the Deal Tracker on.' });
  const intakeId = found.deal.onboarding_id;
  if (read === 'picks') {
    const picks = await listPicks(sql, intakeId);
    return sendJson(res, 200, { ok: true, intake_id: intakeId,
      note: 'Standing picks only, newest first. A Buyer Pick is what the buyer wants, not an agreed price: Mason confirms it with the dealer.',
      picks: picks.map(pick => ({ id: Number(pick.id), kind: pick.kind, title: pick.title ?? null, vin: pick.vin ?? null,
        dealer_name: pick.dealer_name ?? null, otd_cents: pick.otd_cents == null ? null : Number(pick.otd_cents), created_at: pick.created_at })) });
  }
  if (read === 'documents') {
    // What each file is, never where it is stored or what is in it.
    const documents = await listDocuments(sql, intakeId);
    return sendJson(res, 200, { ok: true, intake_id: intakeId,
      note: 'Newest first; deleted files never show. Fetch one with `node scripts/car-search.mjs document <id>`. They can hold ID and financial details: never quote them to a dealer or in a Buyer Update.',
      documents: documents.map(doc => ({ id: Number(doc.id), doc_type: doc.doc_type, content_type: doc.content_type,
        bytes: Number(doc.bytes), created_at: doc.created_at })) });
  }
  if (read === 'texts') {
    const count = last == null ? null : Number(last);
    return sendJson(res, 200, { ok: true, ...await agentTexts(sql, intakeId, { last: count }),
      dealer_texts: await agentDealerTexts(sql, intakeId, { last: count }) });
  }
  return sendJson(res, 200, { ok: true, ...await loadDeal(sql, found.deal) });
}

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

    if (req.method === 'GET' && requestUrl(req).searchParams.has('read')) {
      return sendRead(res, requestUrl(req).searchParams, { environment, getDatabase });
    }

    if (req.method === 'GET' && requestUrl(req).searchParams.get('texts') === 'threads') {
      return sendJson(res, 200, { ok: true, threads: await listTextThreads(getDatabase()) });
    }

    if (req.method === 'GET' && requestUrl(req).searchParams.get('texts') === 'dealers') {
      return sendJson(res, 200, { ok: true, deals: await listDealerThreads(getDatabase()) });
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
      return sendJson(res, 200, { ok: true, ...result });
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
    if (body.action === 'dealer_texts') {
      const contact = parseContact(body.contact);
      let messages;
      try {
        if (contact.problems) throw new TextsError(contact.problems);
        messages = parseTexts(body.messages, { from: 'from_dealer' });
      } catch (error) {
        if (!(error instanceof TextsError)) throw error;
        return sendJson(res, 422, { ok: false, error: 'invalid_texts', problems: error.problems });
      }
      const result = await saveDealerTexts(getDatabase(), intakeId, contact, messages);
      if (result.error === 'not_syncing') return sendJson(res, 409, { ok: false, error: 'not_syncing', message: 'This intake has no open deal, so its texts are not synced.' });
      if (result.error) return sendJson(res, 409, { ok: false, error: 'buyer_contact', message: 'That number or email is an open deal\'s buyer, so it is never filed as a dealer.' });
      return sendJson(res, 200, { ok: true, saved: result.saved });
    }
    if (body.action === 'draft_update') {
      // Always a draft, signed with one of the skills' names and never Mason's:
      // whatever else the request says, only Mason's approval on the ops
      // dashboard puts it in front of the buyer.
      if (!dealTrackerEnabled(environment)) return sendJson(res, 404, TRACKER_OFF);
      const skill = body.skill ?? 'car-search';
      if (!DRAFT_SKILLS.includes(skill)) return sendJson(res, 400, { ok: false, error: 'invalid_skill', message: `skill must be one of ${DRAFT_SKILLS.join(', ')}, or left out` });
      let draft;
      try {
        draft = await draftUpdate(getDatabase(), { onboardingId: intakeId, body: body.text, actor: skill });
      } catch (error) {
        if (!(error instanceof BuyerUpdateError)) throw error;
        return sendJson(res, 422, { ok: false, error: 'invalid_update', message: error.message });
      }
      if (!draft) return sendJson(res, 404, { ok: false, error: 'deal_not_found', message: 'This intake has no deal, so it has no Deal Tracker to draft for.' });
      return sendJson(res, 200, { ok: true, update: { id: draft.id, status: 'draft', signed: skill },
        next: 'Mason gets an email and approves or discards the draft on the deal\'s ops page. The buyer sees nothing until he approves.' });
    }
    if (body.action !== undefined) throw new HttpError(400, 'invalid_action', 'action must be "handoff", "texts", "dealer_texts", "draft_update" or left out');

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
        message: 'This search\'s dealer emails have already gone out or been handed off, so its shortlist can no longer be replaced.' });
    }
    return sendJson(res, 200, {
      ok: true,
      cars: shortlist.listings.length,
      dealer_emails: saved.drafts.map(draft => ({ dealer: draft.dealer_name, to: draft.to_email }))
    });
  });
}

export default carSearchHandler();
