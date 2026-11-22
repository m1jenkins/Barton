import { database } from './_lib/db.js';
import { UPLOAD_ORIGIN, blobStore, documentSettings, finishUpload, startUpload } from './_lib/buyer-documents.js';
import { keepLooking, makePick } from './_lib/buyer-picks.js';
import { askQuestion } from './_lib/buyer-questions.js';
import { checkLink, dealTrackerSettings, dollars, loadBuyerView, renderLinkClosed, renderNotice, renderPickConfirm, renderTracker, renderUnavailable, touchOpened } from './_lib/deal-tracker.js';
import { header, readRawBody, requestUrl, withApiErrors } from './_lib/http.js';

// A buyer's Deal Tracker at /deal/<token> (vercel.json rewrites it here as ?t=).
// GET checks the link, renders the page and records the open. POST, after the
// same link check, takes a Buyer Question from the page's own form
// (action=question, body) or a Buyer Pick behind a confirm step: pick_review
// (car=<rank>, price=<cents shown>) and keep_looking_review write nothing and
// show the confirm page, whose button posts pick or keep_looking. The page's own
// script sends a Buyer Document: upload_start (doc_type, content_type, bytes)
// answers JSON with a presigned upload URL and a ticket, the browser sends the
// file straight to the private store, and upload_done (ticket) files it and
// answers with a receipt. Nothing here ever reads a file or returns where one is.
// docs/deal-tracker-build-plan-2026-11-21.md, docs/adr/0001 and 0002.
export const config = { maxDuration: 20 };
// Every response, refused ones included: private, never cached, never framed,
// no referrer. The only script is this site's own upload helper, and the only
// place it may send anything besides this site is the Blob store's upload API.
const SECURITY_HEADERS = Object.freeze({
  'Cache-Control': 'no-store, max-age=0',
  'X-Robots-Tag': 'noindex, nofollow, noarchive',
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Content-Security-Policy': `default-src 'none'; script-src 'self'; connect-src 'self' ${UPLOAD_ORIGIN}; style-src 'self'; font-src 'self'; img-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'`
});
const REFUSED = Object.freeze({ invalid: 404, revoked: 410, expired: 410 });
const MASON = 'mason@steermeright.com';

function send(res, status, body, extra = {}) {
  res.statusCode = status;
  for (const [name, value] of Object.entries({ ...SECURITY_HEADERS, ...extra })) res.setHeader(name, value);
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.end(body);
}

// The document actions answer the page's script in JSON, with the same headers.
function sendJson(res, status, body) {
  res.statusCode = status;
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) res.setHeader(name, value);
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

// The link is the buyer's credential; this only stops another site posting
// with it. Under no-referrer a browser sends "Origin: null" even from this
// page, so a null origin is judged by Sec-Fetch-Site where the browser sends it.
function crossSite(req) {
  const origin = header(req, 'origin');
  if (origin && origin !== 'null' && origin !== requestUrl(req).origin) return true;
  const site = header(req, 'sec-fetch-site');
  return Boolean(site) && site !== 'same-origin';
}

// What the buyer sees when a question doesn't go through. Nothing is saved.
const NOTICES = Object.freeze({
  empty: [400, 'Your question didn’t come through', 'The box was empty. Go back, type your question and send it again.'],
  too_long: [400, 'That question is too long', 'Please keep it under 4,000 characters, or send the long version by email.'],
  rate_limited: [429, 'I have your questions', `You've sent a few questions in a row. I have them. If something is urgent, email me at ${MASON}.`],
  closed: [409, 'This search is closed', 'Questions can’t be sent from this page any more. Email me instead and I’ll pick it up.'],
  unknown: [400, 'That didn’t work', 'Go back to your car search and try again.'],
  // A Buyer Pick that didn't go through. Nothing is saved.
  pick_closed: [409, 'This search is closed', 'Picks can’t be made from this page any more. Email me instead and I’ll sort it out.'],
  not_open: [409, 'Picking isn’t open right now', 'I open the pick on your page when the prices are ready for your call. Until then, ask me a question there if you’d like to talk about a car.'],
  already_picked: [409, 'You’ve already made your pick', 'Your page shows what you chose. If you chose by mistake, ask me a question there and I’ll sort it out.'],
  no_car: [400, 'That car isn’t on your list', 'Go back to your car search and pick again.'],
  no_price: [409, 'That car has no written price yet', 'You can pick a car once a dealer has given me a written out-the-door price for it. Go back to your car search to see the cars that have one.']
});
const PICKS = new Set(['pick_review', 'keep_looking_review', 'pick', 'keep_looking']);
const UPLOADS = new Set(['upload_start', 'upload_done']);
// What the page's script shows when a document doesn't go through. Nothing is saved.
const UPLOAD_ERRORS = Object.freeze({
  unavailable: [503, `Sending documents from this page isn’t available right now. Please try again later, or email the file to me at ${MASON}.`],
  closed: [409, `This search is closed, so documents can’t be sent from this page. Email the file to me at ${MASON} instead.`],
  bad_type: [400, 'Choose what kind of document this is, then send it again.'],
  id_not_yet: [409, 'I don’t need your ID yet. I’ll ask for it here once we have a price agreed.'],
  bad_content_type: [400, 'That kind of file can’t be sent here. Send a PDF or a photo (JPEG, PNG, HEIC or WebP).'],
  empty: [400, 'That file is empty. Choose the file again and send it.'],
  too_large: [400, `That file is over 20 MB. Send a smaller copy, or email it to me at ${MASON}.`],
  rate_limited: [429, `You’ve sent a lot of files in a short time. I have them. If you have more, email them to me at ${MASON}.`],
  bad_ticket: [400, 'That didn’t go through. Choose the file and send it again.'],
  missing: [409, 'The file didn’t reach me. Choose it and send it again.'],
  mismatch: [400, 'That file couldn’t be accepted. Send a PDF or a photo up to 20 MB.']
});
const whole = value => (/^\d{1,9}$/.test(String(value ?? '')) ? Number(value) : null);

// The checks makePick and keepLooking make, against the view, for the confirm
// step that writes nothing. Without a car it is "keep looking".
function reviewError(view, { car = null, price = null } = {}, isPick = false) {
  if (!view.pick.open) return { error: 'not_open' };
  if (view.pick.standing) return { error: 'already_picked' };
  if (!isPick) return null;
  if (!car) return { error: 'no_car' };
  if (car.best_cents == null) return { error: 'no_price' };
  if (car.best_cents !== price) return { error: 'price_changed', current_cents: car.best_cents };
  return null;
}

// documentStore: the Blob store, for tests; by default built from documentSettings
// on the first document request. It is used only while the store is configured.
export function dealTrackerHandler({ environment = process.env, getDatabase = database, now = () => Date.now(), documentStore = null } = {}) {
  return withApiErrors(async (req, res) => {
    if (!['GET', 'POST'].includes(req.method)) return send(res, 405, renderLinkClosed(), { Allow: 'GET, POST' });
    try {
      // Switched off, the page does not exist and the database is never opened.
      const settings = dealTrackerSettings(environment);
      if (!settings) return send(res, 404, renderLinkClosed());
      if (req.method === 'POST' && crossSite(req)) return send(res, 403, renderLinkClosed());
      const sql = getDatabase();
      const at = now();
      const token = requestUrl(req).searchParams.get('t') ?? '';
      const link = await checkLink(sql, settings, token, at);
      if (link.status !== 'ok') return send(res, REFUSED[link.status] ?? 404, renderLinkClosed());
      const view = await loadBuyerView(sql, link.onboardingId, at);
      if (!view) return send(res, 404, renderLinkClosed());
      // The token passed checkLink, so it is hex, a dot and base64url: safe in a path.
      const self = `/deal/${token}`;
      const documents = documentSettings(environment);
      if (req.method === 'GET') {
        await touchOpened(sql, link.onboardingId, at);
        return send(res, 200, renderTracker(view, { action: self, uploads: Boolean(documents) }));
      }

      const notice = key => {
        const [status, title, text] = NOTICES[key];
        return send(res, status, renderNotice(title, text, self));
      };
      let form;
      try {
        form = new URLSearchParams((await readRawBody(req, 32768, { allowParsedBody: false })).toString('utf8'));
      } catch (error) {
        if (error?.status === 413) return notice('too_long');
        throw error;
      }
      const action = form.get('action');
      if (UPLOADS.has(action)) {
        const refused = key => {
          const [status, message] = UPLOAD_ERRORS[key];
          return sendJson(res, status, { ok: false, error: key, message });
        };
        if (!documents) return refused('unavailable');
        const store = documentStore ?? blobStore(documents);
        const result = action === 'upload_start'
          ? await startUpload({ sql, store, settings: documents, onboardingId: link.onboardingId, stage: view.stage, outcome: view.outcome,
            docType: form.get('doc_type'), contentType: form.get('content_type'), bytes: form.get('bytes'), now: at })
          : await finishUpload({ sql, store, settings: documents, onboardingId: link.onboardingId, ticket: form.get('ticket'), now: at });
        if (result.error) return refused(result.error);
        return sendJson(res, 200, action === 'upload_start'
          ? { ok: true, upload: result.upload, ticket: result.ticket }
          : { ok: true, receipt: result.receipt });
      }
      if (PICKS.has(action)) {
        if (view.outcome === 'other') return notice('pick_closed');
        const rank = whole(form.get('car'));
        const price = whole(form.get('price'));
        const car = view.cars.find(item => item.rank === rank) ?? null;
        const refused = result => {
          if (result.error !== 'price_changed') return notice(result.error);
          return send(res, 409, renderNotice('The price on that car just changed',
            `The best price so far on the ${car?.title ?? 'car you picked'} is now ${dollars(result.current_cents)}. Go back to your car search to see it, and pick again if it still suits you.`, self));
        };
        const isPick = action.startsWith('pick');
        if (action.endsWith('_review')) {
          const problem = reviewError(view, { car, price }, isPick);
          if (problem) return refused(problem);
          return send(res, 200, renderPickConfirm(isPick ? car : null, self));
        }
        const result = isPick
          ? await makePick(sql, { onboardingId: link.onboardingId, rank, expectedCents: price, now: at })
          : await keepLooking(sql, { onboardingId: link.onboardingId, now: at });
        if (result.error) return refused(result);
        return send(res, 303, '', { Location: `${self}#dt-pick` });
      }
      if (action !== 'question') return notice('unknown');
      // A search closed without a purchase has no question box. Bought still takes questions until the link expires.
      if (view.outcome === 'other') return notice('closed');
      const result = await askQuestion(sql, { onboardingId: link.onboardingId, body: form.get('body'), now: at });
      if (result.error) return notice(result.error);
      return send(res, 303, '', { Location: `${self}#dt-updates` });
    } catch (error) {
      // Database errors can quote values, so only the error's kind is logged and
      // the visitor gets a page that says nothing about the deal.
      console.error('[deal_tracker_error]', { name: error?.name || 'Error', code: error?.code || 'unknown' });
      return send(res, error?.name === 'ConfigError' ? 503 : 500, renderUnavailable());
    }
  });
}

export default dealTrackerHandler();
