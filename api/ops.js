import { database } from './_lib/db.js';
import { HttpError, header, readRawBody, requestUrl, withApiErrors } from './_lib/http.js';
import { isAuthorized, loadDashboard, loadDeal, opsPassword, renderDashboard, renderDeal, renderMessage, resolveNeed } from './_lib/ops-dashboard.js';

// Mason's private deal dashboard. Open https://www.steermeright.com/api/ops and
// sign in with any user name and OPS_PASSWORD. GET renders the page from Neon;
// POST with resolve=<event id> answers a needs_mason item (answer or reply) or marks it done.
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

export function opsHandler({ environment = process.env, getDatabase = database, now = () => Date.now() } = {}) {
  return withApiErrors(async (req, res) => {
    if (!['GET', 'POST'].includes(req.method)) throw new HttpError(405, 'method_not_allowed', 'Use GET, POST');
    const password = opsPassword(environment);
    if (!password) return send(res, 503, renderMessage('Dashboard is off', 'Set OPS_PASSWORD in Vercel to turn it on.'));
    if (!isAuthorized(header(req, 'authorization'), password)) {
      return send(res, 401, renderMessage('Sign in', 'This page is private.'), { 'WWW-Authenticate': 'Basic realm="Steer Me Right ops", charset="UTF-8"' });
    }

    const sql = getDatabase();
    if (req.method === 'POST') {
      // The browser resends Basic credentials on any request, so a form posted
      // from another site must not count. Only this page's own origin may post.
      if (header(req, 'origin') !== requestUrl(req).origin) throw new HttpError(403, 'origin_not_allowed', 'Request origin is not allowed');
      const form = new URLSearchParams((await readRawBody(req, 16384, { allowParsedBody: false })).toString('utf8'));
      const eventId = Number(form.get('resolve'));
      if (!Number.isSafeInteger(eventId) || eventId <= 0) throw new HttpError(400, 'invalid_event', 'resolve must be an event id');
      // An option button sends answer; Done sends the typed reply, which may be empty.
      const answer = (form.get('answer') || form.get('reply') || '').trim().slice(0, 1000);
      await resolveNeed(sql, eventId, answer || null);
      const back = form.get('back');
      return send(res, 303, null, { Location: UUID.test(back || '') ? `/api/ops?deal=${back.toLowerCase()}` : '/api/ops' });
    }

    const dealId = requestUrl(req).searchParams.get('deal');
    if (dealId != null) {
      if (!UUID.test(dealId)) return send(res, 404, renderMessage('No such deal', 'That link does not match a deal.'));
      const detail = await loadDeal(sql, dealId.toLowerCase());
      if (!detail) return send(res, 404, renderMessage('No such deal', 'That link does not match a deal.'));
      return send(res, 200, renderDeal(detail, now()));
    }
    return send(res, 200, renderDashboard(await loadDashboard(sql), now()));
  });
}

export default opsHandler();
