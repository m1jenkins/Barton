import { database } from './_lib/db.js';
import { checkLink, dealTrackerSettings, loadBuyerView, renderLinkClosed, renderTracker, renderUnavailable, touchOpened } from './_lib/deal-tracker.js';
import { requestUrl, withApiErrors } from './_lib/http.js';

// A buyer's Deal Tracker at /deal/<token> (vercel.json rewrites it here as ?t=).
// GET only for now: it checks the link, renders the page and records the open.
// docs/deal-tracker-build-plan-2026-11-21.md, docs/adr/0001.
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

function send(res, status, body, extra = {}) {
  res.statusCode = status;
  for (const [name, value] of Object.entries({ ...SECURITY_HEADERS, ...extra })) res.setHeader(name, value);
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.end(body);
}

export function dealTrackerHandler({ environment = process.env, getDatabase = database, now = () => Date.now() } = {}) {
  return withApiErrors(async (req, res) => {
    if (req.method !== 'GET') return send(res, 405, renderLinkClosed(), { Allow: 'GET' });
    try {
      // Switched off, the page does not exist and the database is never opened.
      const settings = dealTrackerSettings(environment);
      if (!settings) return send(res, 404, renderLinkClosed());
      const sql = getDatabase();
      const at = now();
      const link = await checkLink(sql, settings, requestUrl(req).searchParams.get('t') ?? '', at);
      if (link.status !== 'ok') return send(res, REFUSED[link.status] ?? 404, renderLinkClosed());
      const view = await loadBuyerView(sql, link.onboardingId, at);
      if (!view) return send(res, 404, renderLinkClosed());
      await touchOpened(sql, link.onboardingId, at);
      return send(res, 200, renderTracker(view));
    } catch (error) {
      // Database errors can quote values, so only the error's kind is logged and
      // the visitor gets a page that says nothing about the deal.
      console.error('[deal_tracker_error]', { name: error?.name || 'Error', code: error?.code || 'unknown' });
      return send(res, error?.name === 'ConfigError' ? 503 : 500, renderUnavailable());
    }
  });
}

export default dealTrackerHandler();
