import { createHmac, timingSafeEqual } from 'node:crypto';
import { ConfigError } from './config.js';
import { centralTime, escapeHtml, oneLine } from './intake-email.js';

// Mason gets one email per submitted car search. Each dealer email draft in it
// links to /api/dealer-email, where he edits and sends it. A link is the draft
// ID plus an HMAC of it, so no link secret is stored in the database.
const LINK_DAYS = 30;
const EMAIL_PATTERN = /^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]+$/;

export function dealLinkSettings(environment = process.env) {
  const secret = environment.DEAL_LINK_SECRET?.trim();
  if (!secret) return null;
  if (secret.length < 32) throw new ConfigError('DEAL_LINK_SECRET must be at least 32 characters');
  let origin;
  try {
    origin = new URL(environment.APP_ORIGIN?.trim() || 'https://www.steermeright.com').origin;
  } catch {
    throw new ConfigError('APP_ORIGIN must be a URL');
  }
  const fromName = oneLine(environment.DEALER_EMAIL_FROM_NAME || 'Steer Me Right').slice(0, 80);
  return { secret, origin, fromName };
}

const signature = (secret, draftId) => createHmac('sha256', secret).update(`dealer-email:${draftId}`).digest('base64url');

export const draftToken = (settings, draftId) => `${draftId}.${signature(settings.secret, draftId)}`;

export const draftLink = (settings, draftId) =>
  `${settings.origin}/api/dealer-email?token=${encodeURIComponent(draftToken(settings, draftId))}`;

// Returns the draft ID a link was made for, or null for anything else.
export function verifyDraftToken(settings, token) {
  const match = /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.([A-Za-z0-9_-]{43})$/.exec(String(token || ''));
  if (!match) return null;
  const expected = Buffer.from(signature(settings.secret, match[1]));
  const given = Buffer.from(match[2]);
  return expected.length === given.length && timingSafeEqual(expected, given) ? match[1] : null;
}

export const linkExpired = (createdAt, now = Date.now()) => now - new Date(createdAt).getTime() > LINK_DAYS * 86_400_000;

const dollars = cents => cents == null ? '' : new Intl.NumberFormat('en-US', {
  style: 'currency', currency: 'USD', maximumFractionDigits: 0
}).format(cents / 100);
const miles = value => value == null ? '' : `${new Intl.NumberFormat('en-US').format(value)} mi`;
export const carFor = fields => oneLine(fields?.preferred_makes || fields?.vehicle_type || 'car search');
const plural = (count, word) => `${count} ${word}${count === 1 ? '' : 's'}`;

const lotDays = value => value == null ? '' : `${value} ${value === 1 ? 'day' : 'days'} on lot`;
const headline = listing => [dollars(listing.price_cents), miles(listing.mileage), lotDays(listing.days_on_lot)].filter(Boolean).join(' · ');

// Market value, target and walk-away are Mason's negotiating numbers.
function pricing(listing) {
  const line = [
    listing.market_price_cents != null && `market ${dollars(listing.market_price_cents)}`,
    listing.target_price_cents != null && `target ${dollars(listing.target_price_cents)}`,
    listing.walk_away_cents != null && `walk away at ${dollars(listing.walk_away_cents)}`
  ].filter(Boolean).join(' · ');
  return line && line[0].toUpperCase() + line.slice(1);
}

function listingLines(listing) {
  return [
    `${listing.rank}. ${[listing.title, headline(listing)].filter(Boolean).join(' · ')}`,
    pricing(listing) && `   ${pricing(listing)}`,
    `   ${[listing.dealer_name, listing.dealer_location, listing.dealer_email, listing.dealer_phone].filter(Boolean).join(' · ')}`,
    listing.vin && `   VIN ${listing.vin}`,
    listing.why && `   ${oneLine(listing.why)}`,
    `   ${listing.listing_url}`
  ].filter(Boolean).join('\n');
}

const shell = (intro, body) => `<!doctype html><html><body style="margin:0;padding:24px;background:#f5f6f8;font:15px/1.5 -apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#1d232c">`
  + `<div style="max-width:680px;margin:0 auto;background:#ffffff;border-radius:10px;padding:24px">`
  + `<p style="margin:0 0 16px;white-space:pre-wrap">${escapeHtml(intro)}</p>${body}</div></body></html>`;
const heading = title => `<h2 style="margin:24px 0 8px;font-size:16px">${escapeHtml(title)}</h2>`;
const button = (href, label) => `<a href="${escapeHtml(href)}" style="display:inline-block;margin:8px 8px 0 0;padding:8px 14px;border-radius:6px;background:#1f3a5f;color:#ffffff;text-decoration:none;font-weight:600">${escapeHtml(label)}</a>`;

// `deal` carries the buyer's name and search fields; links are already built.
export function renderShortlistEmail({ deal, listings, drafts }) {
  const car = carFor(deal.fields);
  const subject = oneLine(`Car search ready: ${car} · ${deal.name} · ${plural(listings.length, 'car')}, `
    + `${plural(drafts.length, 'email')} to approve`).slice(0, 200);
  const intro = `${deal.name}'s car search is saved. Nothing has gone to a dealer yet: open each email below to edit and send it.`
    + ' Market, target and walk-away prices are for you only.'
    + (deal.search_summary ? `\n\n${deal.search_summary}` : '');

  const text = [
    intro,
    `\nCARS (${listings.length})`,
    ...listings.map(listingLines),
    `\nEMAILS TO DEALERS (${drafts.length})`,
    ...drafts.map(draft => [
      `To ${draft.dealer_name} <${draft.to_email}>, about car ${draft.listing_ranks.join(', ')}`,
      `Subject: ${draft.subject}`,
      draft.body,
      `Review and send: ${draft.link}`
    ].join('\n')),
    `Intake ID: ${deal.onboarding_id}`
  ].join('\n\n') + '\n';

  const cars = listings.map(listing => `<div style="padding:12px 0;border-top:1px solid #e4e7ec">`
    + `<div style="font-weight:600">${escapeHtml(`${listing.rank}. ${listing.title}`)}</div>`
    + `<div>${escapeHtml([headline(listing), listing.vin && `VIN ${listing.vin}`].filter(Boolean).join(' · '))}</div>`
    + (pricing(listing) ? `<div style="font-weight:600">${escapeHtml(pricing(listing))}</div>` : '')
    + `<div style="color:#5b6472">${escapeHtml([listing.dealer_name, listing.dealer_location, listing.dealer_email, listing.dealer_phone].filter(Boolean).join(' · '))}</div>`
    + (listing.why ? `<div style="margin-top:4px">${escapeHtml(listing.why)}</div>` : '')
    + `<a href="${escapeHtml(listing.listing_url)}" style="color:#1f3a5f">Open listing</a></div>`).join('');
  const emails = drafts.map(draft => `<div style="padding:12px 0;border-top:1px solid #e4e7ec">`
    + `<div style="font-weight:600">${escapeHtml(`To ${draft.dealer_name}`)} <span style="font-weight:400;color:#5b6472">${escapeHtml(`${draft.to_email} · car ${draft.listing_ranks.join(', ')}`)}</span></div>`
    + `<div style="margin:4px 0">${escapeHtml(draft.subject)}</div>`
    + `<div style="white-space:pre-wrap;color:#465061;background:#f5f6f8;border-radius:6px;padding:10px">${escapeHtml(draft.body)}</div>`
    + `${button(draft.link, 'Review and send')}</div>`).join('');
  const html = shell(intro, heading(`Cars (${listings.length})`) + (cars || '<p>None found.</p>')
    + heading(`Emails to dealers (${drafts.length})`) + (emails || '<p>No dealer emails were drafted.</p>')
    + `<p style="margin-top:24px;color:#5b6472">Intake ID: ${escapeHtml(deal.onboarding_id)}</p>`);
  return { subject, text, html };
}

// Builds Mason's shortlist email for one deal.
export async function composeShortlistEmail(sql, dealId, links) {
  const [deal] = await sql`
    SELECT d.id, d.onboarding_id, d.search_summary, o.name, o.fields
    FROM deals AS d JOIN onboarding_submissions AS o ON o.id = d.onboarding_id
    WHERE d.id = ${dealId}
  `;
  const listings = await sql`SELECT * FROM deal_listings WHERE deal_id = ${dealId} ORDER BY rank`;
  const drafts = await sql`SELECT * FROM dealer_email_drafts WHERE deal_id = ${dealId} ORDER BY created_at, id`;
  const linked = drafts.map(draft => ({ ...draft, listing_ranks: draft.listing_ranks || [], link: draftLink(links, draft.id) }));
  return renderShortlistEmail({ deal, listings, drafts: linked });
}

export function parseDraftEdits(form) {
  const to = oneLine(form.to);
  const subject = oneLine(form.subject);
  const body = String(form.body ?? '').replace(/\r\n/g, '\n').trim();
  const problems = [];
  if (!EMAIL_PATTERN.test(to) || to.length > 254) problems.push('Enter one email address in To.');
  if (!subject || subject.length > 200) problems.push('The subject must be 1 to 200 characters.');
  if (!body || body.length > 10000) problems.push('The message must be 1 to 10,000 characters.');
  return { to, subject, body, problems };
}

// Sends one approved draft. A draft that has been "sending" for over two
// minutes is assumed to have crashed mid-send and may be sent again.
export async function sendDealerEmail({ sql, draftId, edits, transport, smtp, fromName }) {
  const [claimed] = await sql`
    UPDATE dealer_email_drafts
    SET status = 'sending', to_email = ${edits.to}, subject = ${edits.subject}, body = ${edits.body},
        decided_at = now(), last_error = NULL
    WHERE id = ${draftId}
      AND (status IN ('pending', 'failed') OR (status = 'sending' AND decided_at <= now() - interval '2 minutes'))
    RETURNING id
  `;
  if (!claimed) return { sent: false, error: 'This email was already sent, discarded, or is sending right now.' };
  try {
    await transport.sendMail({
      from: { name: fromName, address: smtp.user },
      to: edits.to, subject: edits.subject, text: `${edits.body}\n`,
      headers: { 'X-Steer-Draft-Id': draftId }
    });
  } catch (error) {
    // SMTP errors can quote the message or credentials; keep only the error code.
    const code = /^[A-Z0-9_]{2,40}$/.test(error?.code || '') ? error.code : 'UNKNOWN';
    await sql`
      UPDATE dealer_email_drafts SET status = 'failed', last_error = ${`Dealer email failed (${code})`}
      WHERE id = ${draftId} AND status = 'sending'
    `;
    console.error('[dealer_email_failed]', { draft_id: draftId, code });
    return { sent: false, error: `The email did not send (${code}). Try again in a minute.` };
  }
  await sql`UPDATE dealer_email_drafts SET status = 'sent', sent_at = now() WHERE id = ${draftId} AND status = 'sending'`;
  return { sent: true };
}

export async function discardDealerEmail({ sql, draftId }) {
  const updated = await sql`
    UPDATE dealer_email_drafts SET status = 'discarded', decided_at = now()
    WHERE id = ${draftId} AND status IN ('pending', 'failed')
    RETURNING id
  `;
  return updated.length === 1;
}

const PAGE_STYLE = `
@font-face{font-family:Inter;src:url('/assets/buying/fonts/inter-latin.woff2') format('woff2');font-weight:400}
@font-face{font-family:Inter;src:url('/assets/buying/fonts/inter-semibold-latin.woff2') format('woff2');font-weight:600}
@font-face{font-family:'Inter Tight';src:url('/assets/buying/fonts/inter-tight-black-latin.woff2') format('woff2');font-weight:900}
*{box-sizing:border-box}
body{margin:0;background:#fff;color:#0E1B2E;font:16px/1.55 Inter,-apple-system,BlinkMacSystemFont,sans-serif}
.band{background:#1A4B8C;color:#fff;padding:28px 16px}
.band h1{margin:0 auto;max-width:760px;font:900 clamp(26px,5vw,38px)/1.05 'Inter Tight',Inter,sans-serif;text-transform:uppercase}
main{max-width:760px;margin:0 auto;padding:24px 16px 48px}
.card{background:#EDF0F4;border-radius:24px;padding:20px 24px;margin:0 0 20px;color:#465061}
.card h2{margin:0 0 8px;font-size:17px;font-weight:600;color:#0E1B2E}
.card ul{margin:0;padding-left:20px}
.card a{color:#1A4B8C}
.note{border-left:3px solid #1A4B8C;padding:8px 14px;margin:0 0 20px;color:#0E1B2E}
.note.error{border-color:#963c2e}
label{display:block;font-weight:600;margin:16px 0 6px}
input,textarea{width:100%;font:inherit;color:#0E1B2E;background:#fff;border:1px solid #C3CBD6;border-radius:12px;padding:12px 14px}
input{height:52px}
textarea{min-height:320px;resize:vertical}
input:focus,textarea:focus{outline:none;border-color:#1A4B8C;box-shadow:0 0 0 4px #E3ECF8}
.actions{display:flex;flex-wrap:wrap;gap:12px;margin-top:20px}
button{font:600 16px Inter,sans-serif;border-radius:999px;padding:14px 26px;cursor:pointer;border:2px solid #0E1B2E}
.send{background:#0E1B2E;color:#fff}
.discard{background:#fff;color:#0E1B2E}
pre{white-space:pre-wrap;font:inherit;margin:0}
`;

export function renderDraftPage({ draft, listings, car, token, notice, error }) {
  const ranks = new Set(draft.listing_ranks || []);
  const cars = listings.filter(listing => ranks.has(listing.rank)).map(listing => `<li>`
    + `<a href="${escapeHtml(listing.listing_url)}" rel="noreferrer noopener" target="_blank">${escapeHtml(listing.title)}</a>`
    + escapeHtml([dollars(listing.price_cents), miles(listing.mileage)].filter(Boolean).map(part => ` · ${part}`).join(''))
    + `</li>`).join('');
  const open = ['pending', 'failed', 'sending'].includes(draft.status);
  const status = {
    sent: `Sent to ${draft.to_email} on ${centralTime(draft.sent_at)}.`,
    discarded: `Discarded on ${centralTime(draft.decided_at)}. Nothing was sent.`,
    sending: `Sending started on ${centralTime(draft.decided_at)} and never finished. Check the Sent folder before you send it again.`,
    failed: draft.last_error ? `${draft.last_error}. Nothing was sent.` : ''
  }[draft.status] || '';
  const messages = [
    notice && `<p class="note">${escapeHtml(notice)}</p>`,
    error && `<p class="note error">${escapeHtml(error)}</p>`,
    !notice && !error && status && `<p class="note">${escapeHtml(status)}</p>`
  ].filter(Boolean).join('');
  const form = open
    ? `<form method="post" action="/api/dealer-email">`
      + `<input type="hidden" name="token" value="${escapeHtml(token)}">`
      + `<label for="to">To</label><input id="to" name="to" type="email" required value="${escapeHtml(draft.to_email)}">`
      + `<label for="subject">Subject</label><input id="subject" name="subject" required maxlength="200" value="${escapeHtml(draft.subject)}">`
      + `<label for="body">Message</label><textarea id="body" name="body" required maxlength="10000">${escapeHtml(draft.body)}</textarea>`
      + `<div class="actions"><button class="send" name="action" value="send">Send to dealer</button>`
      + `<button class="discard" name="action" value="discard" formnovalidate>Discard</button></div></form>`
    : `<div class="card"><h2>${escapeHtml(draft.subject)}</h2><p>To ${escapeHtml(draft.to_email)}</p><pre>${escapeHtml(draft.body)}</pre></div>`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">`
    + `<meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow">`
    + `<title>Email to ${escapeHtml(draft.dealer_name)}</title><style>${PAGE_STYLE}</style></head><body>`
    + `<div class="band"><h1>Email to ${escapeHtml(draft.dealer_name)}</h1></div><main>${messages}`
    + `<div class="card"><h2>${escapeHtml(car)}</h2>${cars ? `<ul>${cars}</ul>` : '<p>No car is linked to this email.</p>'}</div>`
    + `${form}</main></body></html>`;
}

export function renderMessagePage(title, message) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">`
    + `<meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow">`
    + `<title>${escapeHtml(title)}</title><style>${PAGE_STYLE}</style></head><body>`
    + `<div class="band"><h1>${escapeHtml(title)}</h1></div><main><p>${escapeHtml(message)}</p></main></body></html>`;
}

