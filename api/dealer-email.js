import { database } from './_lib/db.js';
import { intakeEmailSettings, smtpTransport } from './_lib/intake-email.js';
import {
  carFor, dealLinkSettings, discardDealerEmail, linkExpired, parseDraftEdits, renderDraftPage, renderMessagePage,
  sendDealerEmail, verifyDraftToken
} from './_lib/deal-email.js';
import { HttpError, assertSameOrigin, header, readRawBody, requestUrl, withApiErrors } from './_lib/http.js';

// Mason opens one dealer email draft from the link in his shortlist email,
// edits it, and sends or discards it. GET only shows the draft, because mail
// scanners open links; sending needs the form's same-origin POST.
export const config = { api: { bodyParser: false }, maxDuration: 30 };
const NOTICES = Object.freeze({ sent: 'Sent. Replies go to your inbox.', discarded: 'Discarded. Nothing was sent.' });

function sendHtml(res, status, html) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Content-Security-Policy',
    "default-src 'none'; style-src 'unsafe-inline'; font-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'");
  res.end(html);
}

async function loadDraft(sql, draftId) {
  const [draft] = await sql`
    SELECT draft.*, o.fields
    FROM dealer_email_drafts AS draft
    JOIN deals AS d ON d.id = draft.deal_id
    JOIN onboarding_submissions AS o ON o.id = d.onboarding_id
    WHERE draft.id = ${draftId}
  `;
  if (!draft) return null;
  const listings = await sql`
    SELECT rank, title, price_cents, mileage, listing_url FROM deal_listings WHERE deal_id = ${draft.deal_id} ORDER BY rank
  `;
  return { draft, listings };
}

export function dealerEmailHandler({ environment = process.env, getDatabase = database, createTransport = smtpTransport } = {}) {
  return withApiErrors(async (req, res) => {
    if (!['GET', 'POST'].includes(req.method)) throw new HttpError(405, 'method_not_allowed', 'Use GET, POST');
    const links = dealLinkSettings(environment);
    const smtp = intakeEmailSettings(environment);
    if (!links || !smtp) return sendHtml(res, 503, renderMessagePage('Not set up', 'Dealer emails are not configured yet.'));

    let form = {};
    if (req.method === 'POST') {
      assertSameOrigin(req);
      const type = (header(req, 'content-type') || '').split(';', 1)[0].trim().toLowerCase();
      if (type !== 'application/x-www-form-urlencoded') throw new HttpError(415, 'unsupported_media_type', 'Send the form');
      form = Object.fromEntries(new URLSearchParams((await readRawBody(req, 65536, { allowParsedBody: false })).toString('utf8')));
    }
    const query = requestUrl(req).searchParams;
    const token = req.method === 'POST' ? form.token : query.get('token');
    const draftId = verifyDraftToken(links, token);
    const loaded = draftId && await loadDraft(getDatabase(), draftId);
    if (!loaded) return sendHtml(res, 404, renderMessagePage('Link not found', 'This link is not valid. Open the newest email about this car search.'));
    if (linkExpired(loaded.draft.created_at)) {
      return sendHtml(res, 410, renderMessagePage('Link expired', 'Links to dealer emails work for 30 days. Nothing was sent.'));
    }
    const page = extra => renderDraftPage({ ...loaded, car: carFor(loaded.draft.fields), token, ...extra });
    if (req.method === 'GET') return sendHtml(res, 200, page({ notice: NOTICES[query.get('done')] }));
    const withEdits = (draft, edits) => ({ ...draft, to_email: edits.to, subject: edits.subject, body: edits.body });

    const sql = getDatabase();
    const again = done => {
      res.statusCode = 303;
      res.setHeader('Location', `/api/dealer-email?token=${encodeURIComponent(token)}&done=${done}`);
      res.setHeader('Cache-Control', 'no-store, max-age=0');
      res.end();
    };
    if (form.action === 'discard') {
      if (await discardDealerEmail({ sql, draftId })) return again('discarded');
      return sendHtml(res, 409, page({ error: 'This email was already sent or discarded.' }));
    }
    if (form.action !== 'send') throw new HttpError(400, 'invalid_action', 'Choose send or discard');

    const edits = parseDraftEdits(form);
    if (edits.problems.length) return sendHtml(res, 422, page({ draft: withEdits(loaded.draft, edits), error: edits.problems.join(' ') }));
    const transport = createTransport(smtp);
    try {
      const result = await sendDealerEmail({ sql, draftId, edits, transport, smtp, fromName: links.fromName });
      if (result.sent) return again('sent');
      // Keep Mason's edits on screen if the draft can still be sent.
      const [current] = await sql`SELECT * FROM dealer_email_drafts WHERE id = ${draftId}`;
      const draft = ['pending', 'failed'].includes(current.status) ? withEdits(current, edits) : current;
      return sendHtml(res, 409, page({ draft, error: result.error }));
    } finally {
      transport.close?.();
    }
  });
}

export default dealerEmailHandler();
