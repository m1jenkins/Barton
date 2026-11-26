import { blobStore, documentSettings, readDocument, sendDocument } from './_lib/buyer-documents.js';
import { database } from './_lib/db.js';
import { HttpError, header, readRawBody, requestUrl, withApiErrors } from './_lib/http.js';
import { dealTrackerSettings, linkUrl } from './_lib/deal-tracker.js';
import { smtpTransport } from './_lib/intake-email.js';
import {
  SEND_COOLDOWN_MS, clearSessionCookieHeader, createChallengeToken, createMagicToken, createSessionToken,
  isSessionAuthorized, magicLinkSettings, nextLocation, normalizeDealId, passwordMatches,
  sendMagicLinkEmail, sessionCookieHeader, verifyChallengeToken, verifyMagicToken
} from './_lib/ops-auth.js';
import {
  editDeal, isAuthorized, loadDashboard, loadDeal, opsPassword,
  renderDashboard, renderDeal, renderMagicConfirm, renderMessage, renderSignIn, resolveNeed, trackerAction
} from './_lib/ops-dashboard.js';

// Mason's private deal dashboard. Open https://www.steermeright.com/api/ops and
// sign in via a 10-minute email magic link (or OPS_PASSWORD), which sets a 30-day
// HttpOnly session cookie (Basic auth with OPS_PASSWORD is also still accepted).
// GET renders the page from Neon;
// POST with resolve=<event id> answers a needs_mason item (answer or reply) or marks it done;
// POST with edit=<close|reopen|agreed|drop|note> and deal=<intake ID> updates a deal.
// With the Deal Tracker on, POST with tracker=<post|approve|discard|retract|revoke|restore|reissue|clear_pick>,
// deal=<intake ID> and, per update, update=<id> works its panel on the deal page.
// clear_pick takes pick=<id>. GET ?document=<id> downloads a Buyer Document (any deal's).
export const config = { maxDuration: 20 };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SECURITY_HEADERS = Object.freeze({
  'Cache-Control': 'no-store, max-age=0',
  'X-Robots-Tag': 'noindex, nofollow, noarchive',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
  'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'"
});

function send(res, status, body, extra = {}) {
  res.statusCode = status;
  for (const [name, value] of Object.entries({ ...SECURITY_HEADERS, ...extra })) res.setHeader(name, value);
  if (body != null) res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.end(body ?? '');
}

const DOCUMENT_ERRORS = Object.freeze({
  not_found: [404, 'No such document', 'That link does not match a Buyer Document.'],
  missing: [404, 'File not found', 'The store has no file for this document.'],
  deleted: [410, 'File deleted', 'This file was deleted 30 days after the deal closed. Its row stays for the record.']
});

// documentStore: the Blob store, for tests; by default built from documentSettings.
// createTransport: SMTP transport factory, for tests; by default smtpTransport.
export function opsHandler({
  environment = process.env, getDatabase = database, now = () => Date.now(),
  documentStore = null, createTransport = smtpTransport
} = {}) {
  let lastMagicSentAt = -Infinity;
  return withApiErrors(async (req, res) => {
    if (!['GET', 'POST'].includes(req.method)) throw new HttpError(405, 'method_not_allowed', 'Use GET, POST');
    const password = opsPassword(environment);
    if (!password) return send(res, 503, renderMessage('Dashboard is off', 'Set OPS_PASSWORD in Vercel to turn it on.'));

    const url = requestUrl(req);
    const secure = url.protocol === 'https:';
    const currentNow = now();
    const emailSettings = magicLinkSettings(environment);
    const authed = isSessionAuthorized(header(req, 'cookie'), password, currentNow)
      || isAuthorized(header(req, 'authorization'), password);

    const signInPage = (status, options = {}) => send(res, status, renderSignIn({
      challenge: createChallengeToken(password, currentNow),
      canEmail: Boolean(emailSettings),
      ...options
    }));

    // Magic-link landing page: GET verifies the token and renders a one-tap POST
    // button so mail scanners and link previews can never open a session.
    const loginToken = req.method === 'GET' ? url.searchParams.get('login') : null;
    if (loginToken != null) {
      const checked = verifyMagicToken(loginToken, password, currentNow);
      if (authed) return send(res, 303, null, { Location: nextLocation(checked.dealId) });
      if (!checked.ok) return signInPage(401, { error: 'That sign-in link has expired or is invalid. Request a new one below.' });
      return send(res, 200, renderMagicConfirm({ token: loginToken }));
    }

    if (req.method === 'POST') {
      // The browser resends cookies/Basic credentials on any request, so a form posted
      // from another site must not count. Only this page's own origin may post.
      if (header(req, 'origin') !== url.origin) throw new HttpError(403, 'origin_not_allowed', 'Request origin is not allowed');
      const tracker = authed ? dealTrackerSettings(environment) : null;
      // A Buyer Update is up to 4,000 characters, which can run well past 16 KB once form-encoded.
      const form = new URLSearchParams((await readRawBody(req, tracker ? 65536 : 16384, { allowParsedBody: false })).toString('utf8'));
      const authAction = form.get('auth');
      if (authAction) {
        if (authAction === 'logout') {
          return send(res, 303, null, { 'Set-Cookie': clearSessionCookieHeader({ secure }), Location: '/api/ops' });
        }
        if (authAction === 'verify') {
          const checked = verifyMagicToken(form.get('token'), password, currentNow);
          if (!checked.ok) return signInPage(401, { error: 'That sign-in link has expired or is invalid. Request a new one below.' });
          return send(res, 303, null, {
            'Set-Cookie': sessionCookieHeader(createSessionToken(password, currentNow), { secure }),
            Location: nextLocation(checked.dealId)
          });
        }
        if (authAction === 'password') {
          const dealId = normalizeDealId(form.get('deal'));
          if (!passwordMatches(form.get('password'), password)) return signInPage(401, { dealId, error: 'Incorrect password.' });
          return send(res, 303, null, {
            'Set-Cookie': sessionCookieHeader(createSessionToken(password, currentNow), { secure }),
            Location: nextLocation(dealId)
          });
        }
        if (authAction === 'send') {
          const dealId = normalizeDealId(form.get('deal'));
          if (!emailSettings) {
            return signInPage(503, { dealId, error: 'Email sign-in is not configured yet. Sign in with your password below.' });
          }
          if (!verifyChallengeToken(form.get('challenge'), password, currentNow)) {
            return signInPage(400, { dealId, error: 'That sign-in form expired. Try again.' });
          }
          const honeypot = String(form.get('website') ?? '').trim();
          if (!honeypot && currentNow - lastMagicSentAt >= SEND_COOLDOWN_MS) {
            const token = createMagicToken(password, { dealId, now: currentNow });
            const sent = await sendMagicLinkEmail({ settings: emailSettings, token, createTransport });
            if (!sent.ok) {
              return signInPage(502, { dealId, error: 'Could not send the sign-in email right now. Try again or use your password below.' });
            }
            lastMagicSentAt = currentNow;
          }
          return signInPage(200, { dealId, sent: true });
        }
        throw new HttpError(400, 'invalid_auth', 'Unknown auth action');
      }

      if (!authed) return signInPage(401, { dealId: normalizeDealId(form.get('deal')) });

      const sql = getDatabase();
      if (form.has('tracker')) {
        if (!tracker) return send(res, 404, renderMessage('Not found', 'The Deal Tracker is off.'));
        const dealId = form.get('deal') || '';
        if (!UUID.test(dealId)) throw new HttpError(400, 'invalid_deal', 'deal must be an intake ID');
        const result = await trackerAction(sql, dealId.toLowerCase(), Object.fromEntries(form));
        if (result.error) return send(res, 400, renderMessage('Not saved', `${result.error}. Go back and try again.`));
        return send(res, 303, null, { Location: `/api/ops?deal=${dealId.toLowerCase()}` });
      }
      if (form.has('edit')) {
        const dealId = form.get('deal') || '';
        if (!UUID.test(dealId)) throw new HttpError(400, 'invalid_deal', 'deal must be an intake ID');
        const result = await editDeal(sql, dealId.toLowerCase(), Object.fromEntries(form));
        if (result.error) return send(res, 400, renderMessage('Not saved', `${result.error}. Go back and try again.`));
        return send(res, 303, null, { Location: `/api/ops?deal=${dealId.toLowerCase()}` });
      }
      const eventId = Number(form.get('resolve'));
      if (!Number.isSafeInteger(eventId) || eventId <= 0) throw new HttpError(400, 'invalid_event', 'resolve must be an event id');
      // An option button sends answer; Done sends the typed reply, which may be empty.
      const answer = (form.get('answer') || form.get('reply') || '').trim().slice(0, 1000);
      await resolveNeed(sql, eventId, answer || null);
      const back = form.get('back');
      return send(res, 303, null, { Location: UUID.test(back || '') ? `/api/ops?deal=${back.toLowerCase()}` : '/api/ops' });
    }

    if (!authed) return signInPage(401, { dealId: normalizeDealId(url.searchParams.get('deal')) });

    // Off, the deal page and every POST are exactly as before. A bad secret fails loudly.
    const tracker = dealTrackerSettings(environment);
    const sql = getDatabase();
    const documentId = url.searchParams.get('document');
    if (documentId != null) {
      if (!tracker) return send(res, 404, renderMessage('Not found', 'The Deal Tracker is off.'));
      const documents = documentSettings(environment);
      if (!documents) return send(res, 503, renderMessage('Documents are off', 'Set up the Blob store in Vercel to open Buyer Documents.'));
      const file = await readDocument({ sql, store: documentStore ?? blobStore(documents), id: documentId });
      if (file.error) {
        const [status, title, message] = DOCUMENT_ERRORS[file.error];
        return send(res, status, renderMessage(title, message));
      }
      // sendDocument's own Content-Type, disposition and sandboxing CSP replace the page's.
      return sendDocument(res, file, SECURITY_HEADERS);
    }

    const dealId = url.searchParams.get('deal');
    if (dealId != null) {
      if (!UUID.test(dealId)) return send(res, 404, renderMessage('No such deal', 'That link does not match a deal.'));
      const detail = await loadDeal(sql, dealId.toLowerCase(), { tracker: Boolean(tracker) });
      if (!detail) return send(res, 404, renderMessage('No such deal', 'That link does not match a deal.'));
      if (detail.tracker?.link) detail.tracker.url = linkUrl(tracker, detail.deal.onboarding_id, detail.tracker.link.version);
      return send(res, 200, renderDeal(detail, currentNow));
    }
    return send(res, 200, renderDashboard(await loadDashboard(sql, { tracker: Boolean(tracker) }), currentNow));
  });
}

export default opsHandler();
