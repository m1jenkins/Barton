import { database } from './_lib/db.js';
import { askQuestion } from './_lib/buyer-questions.js';
import { checkLink, dealTrackerSettings, loadBuyerView, renderLinkClosed, renderNotice, renderTracker, renderUnavailable, touchOpened } from './_lib/deal-tracker.js';
import { header, readRawBody, requestUrl, withApiErrors } from './_lib/http.js';

// A buyer's Deal Tracker at /deal/<token> (vercel.json rewrites it here as ?t=).
// GET checks the link, renders the page and records the open. POST takes a
// Buyer Question from the page's own form (action=question, body), after the
// same link check. docs/deal-tracker-build-plan-2026-11-21.md, docs/adr/0001.
export const config = { maxDuration: 20 };
// Every response, refused ones included: private, never cached, never framed,
// no referrer, and no script at all.
const SECURITY_HEADERS = Object.freeze({
  'Cache-Control': 'no-store, max-age=0',
  'X-Robots-Tag': 'noindex, nofollow, noarchive',
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Content-Security-Policy': "default-src 'none'; style-src 'self'; font-src 'self'; img-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'"
});
const REFUSED = Object.freeze({ invalid: 404, revoked: 410, expired: 410 });
const MASON = 'mason@steermeright.com';

function send(res, status, body, extra = {}) {
  res.statusCode = status;
  for (const [name, value] of Object.entries({ ...SECURITY_HEADERS, ...extra })) res.setHeader(name, value);
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.end(body);
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
  unknown: [400, 'That didn’t work', 'Go back to your car search and try again.']
});

export function dealTrackerHandler({ environment = process.env, getDatabase = database, now = () => Date.now() } = {}) {
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
      if (req.method === 'GET') {
        await touchOpened(sql, link.onboardingId, at);
        return send(res, 200, renderTracker(view, { action: self }));
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
      if (form.get('action') !== 'question') return notice('unknown');
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
