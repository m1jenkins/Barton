import { createHash } from 'node:crypto';
import { CONTENT_TYPES, MAX_BYTES, blobStore, documentSettings } from './buyer-documents.js';
import { LINK_GRACE_DAYS, dealTrackerSettings, replyToken } from './deal-tracker.js';

// The reply address (GLOSSARY.md, docs/adr/0001; plan, "Reading the reply
// addresses"). Each buyer's reply address is DEAL_REPLY_MAILBOX with
// +<reply token>, delivered to Mason's own mailbox. Every 10 minutes this reads
// that mailbox through the Gmail REST API with plain fetch: recent mail, headers
// only, until a recipient carries the token of a deal whose link is live. Only
// then is that one message fetched whole and filed as a Buyer Question, with its
// images and PDFs as Buyer Documents. Mail from the buyer's intake address that
// passed DMARC is the buyer's; anything else is held for Mason. Mail to an unknown
// or expired token is left alone, as ordinary mail in his inbox.
//
// The OAuth client holds gmail.modify: it can read and move mail to trash, never
// delete it, and this file never calls a delete endpoint. Its credential reaches
// Mason's whole mailbox (adr/0001), so it is guarded like the database's: it stays
// in this file's closures and never reaches a log, an error message or a row.
//
// buyer-documents.js imports this module back, so nothing here touches its
// imports while the module loads; they are used inside functions only.

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GMAIL = 'https://gmail.googleapis.com/gmail/v1/users/me';
const DAY = 86400000;
// Two days of mail per run, newest first: a run that fails is made up by the next.
const LIST_DAYS = 2;
const LIST_MAX = 100;
// Per run, so one call stays well inside the function's 60 seconds.
const MAX_FILED = 10;
const MAX_ATTACHMENTS = 10;
const HEADER_CONCURRENCY = 5;
const REQUEST_MS = 15000;
const RUN_MS = 40000;
// buyer_questions.body's own limit (db/013). The page's 4,000 is for the page;
// a reply is cut here rather than lost.
export const MAX_MAIL_BODY = 20000;
const HEADERS = ['Delivered-To', 'To', 'Cc', 'X-Original-To', 'From', 'Subject', 'Auto-Submitted', 'Precedence', 'Authentication-Results', 'Return-Path'];
// Google does not document which header carries the plus form, so all four are tried, in this order.
const RECIPIENT_HEADERS = ['delivered-to', 'to', 'cc', 'x-original-to'];

// Null unless the Deal Tracker is on with a reply mailbox, the document store is
// set up (attachments go there) and all three Gmail OAuth values are set.
export function dealMailSettings(environment = process.env) {
  const tracker = dealTrackerSettings(environment);
  const documents = tracker && documentSettings(environment);
  if (!documents) return null;
  const clientId = String(environment.DEAL_MAIL_CLIENT_ID ?? '').trim();
  const clientSecret = String(environment.DEAL_MAIL_CLIENT_SECRET ?? '').trim();
  const refreshToken = String(environment.DEAL_MAIL_REFRESH_TOKEN ?? '').trim();
  if (!tracker.replyMailbox || !clientId || !clientSecret || !refreshToken) return null;
  return { secret: tracker.secret, mailbox: tracker.replyMailbox.toLowerCase(), documents, oauth: { clientId, clientSecret, refreshToken } };
}

// ---------- Gmail ----------

class GmailError extends Error {
  constructor(operation, status) {
    super(`Gmail ${operation} failed (${status})`);
    this.status = status;
  }
}

// The five calls this site makes, over fetch. A 404 on a message reads as null:
// it is gone from the mailbox. Errors carry the operation and status, nothing else.
export function gmailClient(oauth, fetchImpl = fetch) {
  let accessToken = null;
  async function token() {
    if (accessToken) return accessToken;
    const response = await fetchImpl(TOKEN_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'refresh_token', client_id: oauth.clientId, client_secret: oauth.clientSecret, refresh_token: oauth.refreshToken }).toString(),
      signal: AbortSignal.timeout(REQUEST_MS)
    });
    if (!response.ok) throw new GmailError('sign-in', response.status);
    const body = await response.json();
    if (typeof body?.access_token !== 'string' || !body.access_token) throw new GmailError('sign-in', 'no token');
    accessToken = body.access_token;
    return accessToken;
  }
  async function call(operation, path, { method = 'GET', params = [] } = {}) {
    const url = new URL(`${GMAIL}/${path}`);
    for (const [name, value] of params) url.searchParams.append(name, value);
    const response = await fetchImpl(url.href, { method, headers: { authorization: `Bearer ${await token()}` }, signal: AbortSignal.timeout(REQUEST_MS) });
    if (response.status === 404) return null;
    if (!response.ok) throw new GmailError(operation, response.status);
    return response.json();
  }
  const message = id => `messages/${encodeURIComponent(id)}`;
  return {
    async list(query, max) {
      const body = await call('list', 'messages', { params: [['q', query], ['maxResults', String(max)]] });
      return (body?.messages ?? []).map(item => String(item.id)).filter(Boolean);
    },
    metadata: id => call('read', message(id), { params: [['format', 'metadata'], ...HEADERS.map(name => ['metadataHeaders', name])] }),
    full: id => call('read', message(id), { params: [['format', 'full']] }),
    attachment: (id, attachmentId) => call('attachment', `${message(id)}/attachments/${encodeURIComponent(attachmentId)}`),
    // Moves one message to trash. Never messages.delete: the site may not destroy mail.
    async trash(id) { await call('trash', `${message(id)}/trash`, { method: 'POST' }); }
  };
}

// For the document cleanup: the mailbox, or null while the mail side isn't set up.
export function dealMailClient(environment = process.env, fetchImpl = fetch) {
  const settings = dealMailSettings(environment);
  return settings ? gmailClient(settings.oauth, fetchImpl) : null;
}

// ---------- Headers ----------

const headerValues = (message, name) => (message?.payload?.headers ?? [])
  .filter(header => String(header.name).toLowerCase() === name).map(header => String(header.value ?? ''));
const first = (message, name) => headerValues(message, name)[0] ?? null;
// A MIME part's own header (parts carry headers directly, not under payload).
const partHeader = (part, name) => String((part?.headers ?? []).find(header => String(header.name).toLowerCase() === name)?.value ?? '');

// Every address in an address header, lowercased. Angle-bracket addresses win when
// there are any, so a display name that looks like an address isn't counted.
export function addresses(value) {
  const text = String(value ?? '');
  const angled = [...text.matchAll(/<([^<>\s]+@[^<>\s]+)>/g)].map(match => match[1]);
  const found = angled.length ? angled : [...text.matchAll(/[^\s<>",;:()]+@[^\s<>",;:()]+/g)].map(match => match[0]);
  return found.map(address => address.toLowerCase());
}

// The reply token a message was sent to: the first <local>+<token>@<domain> of our
// mailbox, header by header, whose token belongs to a live deal.
export function matchRecipient(message, mailbox, live) {
  const at = mailbox.lastIndexOf('@');
  const local = mailbox.slice(0, at), domain = mailbox.slice(at + 1);
  for (const name of RECIPIENT_HEADERS) {
    for (const value of headerValues(message, name)) {
      for (const address of addresses(value)) {
        const split = address.lastIndexOf('@');
        if (address.slice(split + 1) !== domain) continue;
        const match = /^(.+)\+([0-9a-f]{20})$/.exec(address.slice(0, split));
        if (match && match[1] === local && live.has(match[2])) return live.get(match[2]);
      }
    }
  }
  return null;
}

// Auto-replies and bounces are skipped whole: no row, no alert (plan).
export function automated(message) {
  const auto = first(message, 'auto-submitted');
  if (auto != null && auto.split(';', 1)[0].trim().toLowerCase() !== 'no') return true;
  const precedence = first(message, 'precedence')?.trim().toLowerCase();
  if (['bulk', 'junk', 'auto_reply'].includes(precedence)) return true;
  if (headerValues(message, 'return-path').some(value => /^\s*<\s*>\s*$/.test(value))) return true;
  const from = addresses(first(message, 'from'));
  return from.some(address => /^(mailer-daemon|postmaster)@/.test(address));
}

// The sender, and whether the mail is the buyer's own: one From address equal to
// the intake email, and the topmost Authentication-Results, written by Google's
// own servers, saying dmarc=pass for that From domain. A missing, foreign or
// unreadable result is never a pass, so the worst an odd header can do is hold
// the mail for Mason.
export function judgeSender(message, intakeEmail) {
  const raw = first(message, 'from') ?? '';
  const from = addresses(raw);
  const sender = from.length === 1 ? from[0] : (raw.replace(/\s+/g, ' ').trim().slice(0, 254) || 'unknown sender');
  if (from.length !== 1 || sender !== String(intakeEmail ?? '').trim().toLowerCase()) return { sender, buyer: false };
  return { sender, buyer: dmarcPass(first(message, 'authentication-results'), sender) };
}

function dmarcPass(results, sender) {
  if (!results) return false;
  const text = results.replace(/\s+/g, ' ').trim();
  if (text.split(';', 1)[0].trim().toLowerCase() !== 'mx.google.com') return false;
  const dmarc = /(?:^|;)\s*dmarc=([a-z]+)\b[^;]*?\bheader\.from=([^\s;()]+)/i.exec(text);
  return Boolean(dmarc) && dmarc[1].toLowerCase() === 'pass' && dmarc[2].toLowerCase() === sender.slice(sender.lastIndexOf('@') + 1);
}

// ---------- The message ----------

const decode = data => Buffer.from(String(data ?? ''), 'base64url');
function text(part) {
  const charset = /charset="?([^";\s]+)"?/i.exec(partHeader(part, 'content-type'))?.[1] ?? 'utf-8';
  const bytes = decode(part.body?.data);
  try { return new TextDecoder(charset).decode(bytes); } catch { return new TextDecoder().decode(bytes); }
}
const parts = part => [part, ...(part?.parts ?? []).flatMap(parts)];
const isFile = part => Boolean(part.filename) || /^\s*attachment\b/i.test(partHeader(part, 'content-disposition'));

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
export function htmlToText(html) {
  return String(html)
    .replace(/<(style|script|head)\b[\s\S]*?<\/\1\s*>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|tr|h[1-6]|blockquote)\s*>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (entity, name) => {
      if (name[0] === '#') {
        const code = name[1].toLowerCase() === 'x' ? parseInt(name.slice(2), 16) : Number(name.slice(1));
        return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : '';
      }
      return ENTITIES[name.toLowerCase()] ?? entity;
    });
}

// The new words of a reply. Conservative: it cuts only at the plain markers of a
// quoted earlier message ("On … wrote:", "-----Original Message-----", Outlook's
// rule), a trailing block of "> " lines, the "-- " signature line and a closing
// "Sent from my …". A forwarded message stays, since the buyer may mean it.
export function replyText(raw) {
  let lines = String(raw ?? '').replace(/\r\n?/g, '\n').split('\n').map(line => line.replace(/\s+$/, ''));
  const quoted = lines.findIndex((line, index) => /^On\b.{0,300}\bwrote:$/.test(line)
    || (/^On\b/.test(line) && /\bwrote:$/.test(lines[index + 1] ?? '') && line.length + (lines[index + 1] ?? '').length < 300)
    || /^-{2,}\s*Original Message\s*-{2,}$/i.test(line) || /^_{10,}$/.test(line));
  if (quoted >= 0) lines = lines.slice(0, quoted);
  const signature = lines.findIndex(line => line === '--');
  if (signature >= 0) lines = lines.slice(0, signature);
  while (lines.length && (lines.at(-1) === '' || lines.at(-1).startsWith('>'))) lines.pop();
  if (lines.length && /^Sent from my [\w ]{1,40}$/i.test(lines.at(-1))) lines.pop();
  const body = lines.join('\n').trim();
  return body.length > MAX_MAIL_BODY ? `${body.slice(0, MAX_MAIL_BODY - 1)}…` : body;
}

// The text of the message: its first text/plain part, or its first HTML part as text.
export function messageBody(message) {
  const all = parts(message.payload).filter(part => !isFile(part) && part.body?.data);
  const plain = all.find(part => String(part.mimeType).toLowerCase() === 'text/plain');
  if (plain) return replyText(text(plain));
  const html = all.find(part => String(part.mimeType).toLowerCase() === 'text/html');
  return html ? replyText(htmlToText(text(html))) : '';
}

const ALIASES = { 'image/jpg': 'image/jpeg', 'image/pjpeg': 'image/jpeg', 'application/x-pdf': 'application/pdf' };
const EXTENSIONS = { pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', heic: 'image/heic', heif: 'image/heif', webp: 'image/webp' };
const baseType = value => String(value ?? '').split(';', 1)[0].trim().toLowerCase();

// The type an attachment is filed as, from its declared type, or from its name when
// the sender's client only said octet-stream; null for anything else.
function declaredType(part) {
  const declared = ALIASES[baseType(part.mimeType)] ?? baseType(part.mimeType);
  if (Object.hasOwn(CONTENT_TYPES, declared)) return declared;
  if (declared !== 'application/octet-stream') return null;
  return EXTENSIONS[/\.([a-z0-9]+)$/i.exec(String(part.filename ?? ''))?.[1]?.toLowerCase()] ?? null;
}

// The file's first bytes must agree with its type, so nothing else is filed under an image's name.
function looksLike(type, bytes) {
  const ascii = (from, to) => bytes.subarray(from, to).toString('latin1');
  if (type === 'application/pdf') return ascii(0, 5) === '%PDF-';
  if (type === 'image/jpeg') return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (type === 'image/png') return bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (type === 'image/webp') return ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP';
  return ascii(4, 8) === 'ftyp' && ['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'mif1', 'msf1'].includes(ascii(8, 12));
}

// Images and PDFs, each at most 20 MB, as the page takes them (plan, "Documents").
export function attachmentParts(message) {
  return parts(message.payload)
    .filter(part => isFile(part) && (part.body?.attachmentId || part.body?.data))
    .map(part => ({ part, type: declaredType(part), size: Number(part.body?.size ?? 0) }))
    .filter(({ type, size }) => type && size >= 1 && size <= MAX_BYTES)
    .slice(0, MAX_ATTACHMENTS);
}

// ---------- The run ----------

const iso = ms => new Date(ms).toISOString();

// Every deal whose link is live, as checkLink in deal-tracker.js decides it, by
// its reply token: the link not revoked, and the latest close (if the deal hasn't
// reopened since) no more than three days ago.
async function liveDeals(sql, secret, now) {
  const rows = await sql`SELECT l.onboarding_id, o.email FROM deal_tracker_links l
    JOIN onboarding_submissions o ON o.id = l.onboarding_id
    LEFT JOIN LATERAL (SELECT e.kind, e.occurred_at FROM deal_events e
      WHERE e.onboarding_id = l.onboarding_id AND e.kind IN ('closed', 'reopened')
      ORDER BY e.occurred_at DESC, e.id DESC LIMIT 1) last ON true
    WHERE l.revoked_at IS NULL AND (last.kind IS DISTINCT FROM 'closed' OR last.occurred_at >= ${iso(now - LINK_GRACE_DAYS * DAY)}::timestamptz)`;
  return new Map(rows.map(row => [replyToken(secret, row.onboarding_id), { onboardingId: String(row.onboarding_id), email: row.email }]));
}

async function recorded(sql, ids) {
  if (!ids.length) return new Set();
  const rows = await sql`SELECT mail_message_id FROM buyer_questions WHERE mail_message_id = ANY(${ids}::text[])
    UNION SELECT mail_message_id FROM buyer_documents WHERE mail_message_id = ANY(${ids}::text[])`;
  return new Set(rows.map(row => row.mail_message_id));
}

async function inBatches(items, size, fn) {
  const out = [];
  for (let index = 0; index < items.length; index += size) out.push(...await Promise.all(items.slice(index, index + size).map(fn)));
  return out;
}

// A stored name worked out from the mail ID and the part, so a retry lands on the same file.
const mailPath = (onboardingId, messageId, partId, type) =>
  `deals/${onboardingId}/mail-${createHash('sha256').update(`${messageId}:${partId}`).digest('hex').slice(0, 32)}.${CONTENT_TYPES[type]}`;

// After a failed attempt: the files it stored that no row points to. Best effort;
// when the database can't say, everything stays.
async function removeStrays(sql, store, files) {
  if (!files.length) return;
  try {
    const rows = await sql`SELECT blob_path FROM buyer_documents WHERE blob_path = ANY(${files.map(file => file.pathname)}::text[])`;
    const kept = new Set(rows.map(row => row.blob_path));
    for (const file of files) if (!kept.has(file.pathname)) await store.del(file.pathname).catch(() => {});
  } catch { /* the next run overwrites the same names */ }
}

// One matched message, whole: its files into the store first, then the question
// and its documents in one transaction. A message that fails midway left no row,
// so the next run starts it again and lands on the same stored names; files of a
// failed attempt that no row points to are removed. Held mail is filed too, with
// its documents tied to it, so they stay out of agents' reach until Mason releases
// it (buyer-documents.js listReceipts and readDocument, deal-desk-db.mjs).
async function fileMessage({ sql, gmail, store, deal, messageId, meta, now }) {
  const message = await gmail.full(messageId);
  if (!message) return { result: 'gone', documents: 0 };
  const { sender, buyer } = judgeSender(meta, deal.email);
  const body = messageBody(message);
  const files = [];
  try {
    for (const { part, type } of attachmentParts(message)) {
      const data = part.body.attachmentId ? (await gmail.attachment(messageId, part.body.attachmentId))?.data : part.body.data;
      const bytes = decode(data);
      if (bytes.length < 1 || bytes.length > MAX_BYTES || !looksLike(type, bytes)) continue;
      const pathname = mailPath(deal.onboardingId, messageId, part.partId ?? part.filename, type);
      await store.put(pathname, bytes, { contentType: type });
      files.push({ pathname, type, bytes: bytes.length });
    }
    const arrived = Number(message.internalDate ?? meta.internalDate);
    const createdAt = Number.isFinite(arrived) && arrived > 0 && arrived <= now ? arrived : now;
    return await sql.begin(async tx => {
      const [question] = await tx`INSERT INTO buyer_questions (onboarding_id, body, source, sender_email, held, mail_message_id, created_at)
        VALUES (${deal.onboardingId}, ${body}, 'email', ${sender}, ${!buyer}, ${messageId}, ${iso(createdAt)}::timestamptz)
        ON CONFLICT (mail_message_id) DO NOTHING RETURNING id`;
      // Another run filed it first; its rows already point at these same names.
      if (!question) return { result: 'already', documents: 0 };
      for (const file of files) {
        await tx`INSERT INTO buyer_documents (onboarding_id, doc_type, blob_path, content_type, bytes, source, question_id, mail_message_id, created_at)
          VALUES (${deal.onboardingId}, 'other', ${file.pathname}, ${file.type}, ${file.bytes}, 'email', ${question.id}, ${messageId}, ${iso(createdAt)}::timestamptz)
          ON CONFLICT (blob_path) DO NOTHING`;
      }
      return { result: buyer ? 'accepted' : 'held', documents: files.length };
    });
  } catch (error) {
    await removeStrays(sql, store, files);
    throw error;
  }
}

// One pass over the mailbox. Returns counts only: listed, already (filed on an
// earlier run), not_ours (no live reply token, or our own sent mail), skipped
// (auto-replies and bounces), accepted, held, documents and failed. With settings
// null (switch off, or anything unset) it touches neither the network nor the database.
export async function readDealMail({ sql, settings, fetch: fetchImpl = fetch, store = null, now = Date.now(), deadline = Date.now() + RUN_MS }) {
  const counts = { listed: 0, already: 0, not_ours: 0, skipped: 0, accepted: 0, held: 0, documents: 0, failed: 0 };
  if (!settings) return { configured: false, ...counts };
  const gmail = gmailClient(settings.oauth, fetchImpl);
  const files = store ?? blobStore(settings.documents);
  // Our own sent mail and drafts are never a reply.
  const ids = await gmail.list(`newer_than:${LIST_DAYS}d -in:sent -in:drafts -in:chats`, LIST_MAX);
  counts.listed = ids.length;
  if (!ids.length) return { configured: true, ...counts };
  const done = await recorded(sql, ids);
  const fresh = ids.filter(id => !done.has(id));
  counts.already = ids.length - fresh.length;
  const live = await liveDeals(sql, settings.secret, now);
  if (!live.size) {
    counts.not_ours = fresh.length;
    return { configured: true, ...counts };
  }

  const read = await inBatches(fresh, HEADER_CONCURRENCY, async id => {
    try { return { id, message: await gmail.metadata(id) }; } catch { return { id, error: true }; }
  });
  let filed = 0;
  for (const { id, message, error } of read) {
    if (error) { counts.failed += 1; continue; }
    const labels = message?.labelIds ?? [];
    const deal = message && !labels.includes('SENT') && !labels.includes('DRAFT') ? matchRecipient(message, settings.mailbox, live) : null;
    if (!deal) { counts.not_ours += 1; continue; }
    if (automated(message)) { counts.skipped += 1; continue; }
    // Left for the next run: the cap and the clock keep one call inside its time.
    if (filed >= MAX_FILED || Date.now() > deadline) continue;
    filed += 1;
    try {
      const { result, documents } = await fileMessage({ sql, gmail, store: files, deal, messageId: id, meta: message, now });
      if (result === 'accepted' || result === 'held') counts[result] += 1;
      else if (result === 'already') counts.already += 1;
      counts.documents += documents;
    } catch (error) {
      counts.failed += 1;
      // The status code only: a Gmail or store error can quote a header or an address.
      console.error('[deal_mail_failed]', { status: Number.isInteger(error?.status) ? error.status : 'error' });
    }
  }
  return { configured: true, ...counts };
}

// The worker shape api/outbox-dispatch.js expects; the 10-minute run calls it
// with ?jobs=…,deal_mail. Alerts to Mason (a Buyer Question, held mail) come from
// the ops_alerts job, which finds the new rows itself.
export async function runDealMailWorker({ sql, environment = process.env, fetch: fetchImpl = fetch, store = null, now = Date.now() } = {}) {
  const settings = dealMailSettings(environment);
  const result = await readDealMail({ sql, settings, fetch: fetchImpl, store, now });
  return { ...result, exitCode: result.configured && !result.failed ? 0 : 1 };
}
