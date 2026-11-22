import { createHash, createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { dealTrackerSettings } from './deal-tracker.js';

// Buyer Documents (GLOSSARY.md, docs/adr/0001, plan "Documents"). Write-only
// through the buyer's link: the page gets an upload URL and a receipt, never a
// file or its location. Mason downloads from the ops dashboard and agents through
// /api/car-search; the cleanup job deletes files 30 days after the latest close.
// Only this file talks to the private Vercel Blob store, through blobStore().

export const DOC_LABELS = Object.freeze({
  pre_approval: 'Loan pre-approval',
  trade_in_photos: 'Trade-in photos',
  trade_in_title: 'Trade-in title or registration',
  payoff_letter: 'Payoff letter',
  insurance: 'Proof of insurance',
  id: 'ID',
  other: 'Something else'
});
// Images and PDFs only, each with the extension its stored name gets.
export const CONTENT_TYPES = Object.freeze({
  'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/png': 'png', 'image/heic': 'heic', 'image/heif': 'heif', 'image/webp': 'webp'
});
export const MAX_BYTES = 20 * 1024 * 1024;
// Per link, counted from the rows already there (plan, "The page").
const PER_HOUR = 20;
const PER_DAY = 60;
const MINUTE = 60000;
const DAY = 1440 * MINUTE;
const UPLOAD_MINUTES = 10;
const TICKET_MINUTES = 60;
const KEEP_DAYS = 30;
// The presigned PUT goes to the Blob control API, not the store's own host:
// @vercel/blob 2.9.0 builds it as https://vercel.com/api/blob/?pathname=… The
// page's connect-src allows this origin, and presignUpload refuses any other.
export const UPLOAD_ORIGIN = 'https://vercel.com';

const iso = ms => new Date(ms).toISOString();
const baseType = value => String(value ?? '').split(';', 1)[0].trim().toLowerCase();

// Null unless the Deal Tracker is on and a store is set up: BLOB_READ_WRITE_TOKEN,
// or BLOB_STORE_ID for the OIDC token Vercel gives its functions (the package
// reads VERCEL_OIDC_TOKEN itself). The token stays in this object; never log it.
export function documentSettings(environment = process.env) {
  const tracker = dealTrackerSettings(environment);
  if (!tracker) return null;
  const token = String(environment.BLOB_READ_WRITE_TOKEN ?? '').trim() || null;
  const storeId = String(environment.BLOB_STORE_ID ?? '').trim() || null;
  if (!token && !storeId) return null;
  return { secret: tracker.secret, token, storeId };
}

// ---------- The store ----------

// The private Blob store behind four calls. @vercel/blob loads on first use, so
// functions that never touch a document never load it.
export function blobStore(settings) {
  const auth = settings.token ? { token: settings.token } : { storeId: settings.storeId };
  const sdk = () => import('@vercel/blob');
  return {
    // A presigned PUT for one pathname, one content type and at most maximumSizeInBytes,
    // valid for ten minutes. The headers are the ones @vercel/blob's own browser upload sends.
    async presignUpload({ pathname, contentType, maximumSizeInBytes }) {
      const { issueSignedToken, presignUrl, parseStoreIdFromDelegationToken } = await sdk();
      const limits = { allowedContentTypes: [contentType], maximumSizeInBytes, validUntil: Date.now() + UPLOAD_MINUTES * MINUTE };
      const signed = await issueSignedToken({ ...auth, pathname, operations: ['put'], ...limits });
      const { presignedUrl } = await presignUrl(signed, { operation: 'put', pathname, access: 'private', ...limits });
      if (new URL(presignedUrl).origin !== UPLOAD_ORIGIN) throw new Error('The Blob upload URL is not on the expected host');
      return {
        url: presignedUrl,
        method: 'PUT',
        headers: {
          'x-vercel-blob-access': 'private',
          'x-content-type': contentType,
          'x-api-version': '13',
          'x-vercel-blob-store-id': parseStoreIdFromDelegationToken(signed.delegationToken)
        }
      };
    },
    async head(pathname) {
      const { head, BlobNotFoundError } = await sdk();
      try {
        const blob = await head(pathname, auth);
        return { pathname: blob.pathname, size: blob.size, contentType: blob.contentType };
      } catch (error) {
        if (error instanceof BlobNotFoundError) return null;
        throw error;
      }
    },
    async get(pathname) {
      const { get } = await sdk();
      const result = await get(pathname, { ...auth, access: 'private', useCache: false });
      if (!result || result.statusCode !== 200) return null;
      return { body: result.stream, size: result.blob.size, contentType: result.blob.contentType };
    },
    async del(pathname) {
      const { del } = await sdk();
      await del(pathname, auth);
    }
  };
}

// ---------- Upload tickets ----------

// What upload_done has to show for the file it reports: an HMAC under the Deal
// Tracker secret, with an "upload:" prefix so it can never pass as a link
// signature or the other way round. It names the deal, the stored name, the
// type and when it expires; it carries nothing secret.
const sign = (secret, payload) => createHmac('sha256', secret).update(`upload:${payload}`).digest('base64url');
const sameSignature = (a, b) => timingSafeEqual(createHash('sha256').update(a).digest(), createHash('sha256').update(b).digest());

export function issueTicket(secret, { onboardingId, pathname, docType, contentType, expires }) {
  const payload = Buffer.from(JSON.stringify({ i: onboardingId, p: pathname, t: docType, c: contentType, e: expires })).toString('base64url');
  return `${payload}.${sign(secret, payload)}`;
}

// The ticket's contents, or null when it is forged, expired or for another deal.
export function readTicket(secret, ticket, onboardingId, now = Date.now()) {
  const match = /^([A-Za-z0-9_-]{1,2000})\.([A-Za-z0-9_-]{43})$/.exec(String(ticket ?? ''));
  if (!match || !sameSignature(match[2], sign(secret, match[1]))) return null;
  let body;
  try { body = JSON.parse(Buffer.from(match[1], 'base64url').toString('utf8')); } catch { return null; }
  if (!body || body.i !== onboardingId || !Number.isFinite(body.e) || body.e < now) return null;
  if (!Object.hasOwn(DOC_LABELS, body.t) || !Object.hasOwn(CONTENT_TYPES, body.c)) return null;
  if (typeof body.p !== 'string' || !body.p.startsWith(`deals/${onboardingId}/`)) return null;
  return { pathname: body.p, docType: body.t, contentType: body.c };
}

// ---------- The buyer's page ----------

const idAllowed = (stage, outcome) => stage === 'agreed' || outcome === 'bought';

// The upload URL for one file the buyer is about to send, after every check.
// The stored name is chosen here; nothing from the buyer's file name is used.
// A refused request never reaches the store.
export async function startUpload({ sql, store, settings, onboardingId, stage, outcome, docType, contentType, bytes, now = Date.now() }) {
  if (outcome === 'other') return { error: 'closed' };
  if (!Object.hasOwn(DOC_LABELS, docType ?? '')) return { error: 'bad_type' };
  if (docType === 'id' && !idAllowed(stage, outcome)) return { error: 'id_not_yet' };
  const type = baseType(contentType);
  if (!Object.hasOwn(CONTENT_TYPES, type)) return { error: 'bad_content_type' };
  const size = /^\d{1,9}$/.test(String(bytes ?? '')) ? Number(bytes) : null;
  if (!size) return { error: 'empty' };
  if (size > MAX_BYTES) return { error: 'too_large' };
  const [recent] = await sql`SELECT count(*) FILTER (WHERE created_at > ${iso(now - 60 * MINUTE)}::timestamptz)::int AS hour, count(*)::int AS day
    FROM buyer_documents WHERE onboarding_id = ${onboardingId} AND source = 'page' AND created_at > ${iso(now - DAY)}::timestamptz`;
  if (recent && (recent.hour >= PER_HOUR || recent.day >= PER_DAY)) return { error: 'rate_limited' };
  const pathname = `deals/${onboardingId}/${randomUUID()}.${CONTENT_TYPES[type]}`;
  const upload = await store.presignUpload({ pathname, contentType: type, maximumSizeInBytes: MAX_BYTES });
  const ticket = issueTicket(settings.secret, { onboardingId, pathname, docType, contentType: type, expires: now + TICKET_MINUTES * MINUTE });
  return { upload: { url: upload.url, method: upload.method, headers: upload.headers }, ticket };
}

const receipt = row => ({ doc_type: row.doc_type, at: new Date(row.created_at).toISOString() });

// The buyer's browser says the file is in the store. What is there is checked,
// not what was promised: a file too big, empty or of another type is deleted.
// A replay of the same ticket files nothing twice. Returns a receipt only.
export async function finishUpload({ sql, store, settings, onboardingId, ticket, now = Date.now() }) {
  const upload = readTicket(settings.secret, ticket, onboardingId, now);
  if (!upload) return { error: 'bad_ticket' };
  const stored = await store.head(upload.pathname);
  if (!stored) return { error: 'missing' };
  const size = Number(stored.size);
  if (!(size >= 1 && size <= MAX_BYTES) || baseType(stored.contentType) !== upload.contentType) {
    await store.del(upload.pathname);
    return { error: 'mismatch' };
  }
  const [row] = await sql`INSERT INTO buyer_documents (onboarding_id, doc_type, blob_path, content_type, bytes, source, created_at)
    VALUES (${onboardingId}, ${upload.docType}, ${upload.pathname}, ${upload.contentType}, ${size}, 'page', ${iso(now)}::timestamptz)
    ON CONFLICT (blob_path) DO NOTHING RETURNING doc_type, created_at`;
  if (row) return { receipt: receipt(row) };
  const [filed] = await sql`SELECT doc_type, created_at FROM buyer_documents WHERE blob_path = ${upload.pathname} AND onboarding_id = ${onboardingId}`;
  return filed ? { receipt: receipt(filed) } : { error: 'bad_ticket' };
}

// The buyer's receipts, oldest first. A receipt outlives its file. A document
// that came on held mail shows only once Mason releases that mail (a discarded
// email was never released); agents follow the same rule.
export async function listReceipts(sql, onboardingId) {
  const rows = await sql`SELECT d.doc_type, d.created_at FROM buyer_documents d LEFT JOIN buyer_questions q ON q.id = d.question_id
    WHERE d.onboarding_id = ${onboardingId} AND (q.id IS NULL OR NOT q.held OR q.released_at IS NOT NULL)
    ORDER BY d.created_at, d.id`;
  return rows.map(receipt);
}

// ---------- Mason and agents ----------

export const fileType = contentType => (Object.hasOwn(CONTENT_TYPES, baseType(contentType)) ? baseType(contentType) : 'application/octet-stream');

// One document's file for Mason (forAgent false) or an agent. Errors:
// not_found, deleted, missing (no file in the store), and for agents held:
// nothing from held mail reaches them until Mason releases it.
export async function readDocument({ sql, store, id, forAgent = false }) {
  if (!/^[1-9]\d{0,17}$/.test(String(id ?? ''))) return { error: 'not_found' };
  const [doc] = await sql`SELECT d.id, d.doc_type, d.blob_path, d.content_type, d.bytes, d.deleted_at, q.held, q.released_at
    FROM buyer_documents d LEFT JOIN buyer_questions q ON q.id = d.question_id WHERE d.id = ${String(id)}::bigint`;
  if (!doc) return { error: 'not_found' };
  if (forAgent && doc.held && !doc.released_at) return { error: 'held' };
  if (doc.deleted_at) return { error: 'deleted' };
  const file = await store.get(doc.blob_path);
  if (!file) return { error: 'missing' };
  const contentType = fileType(doc.content_type);
  return {
    body: file.body,
    contentType,
    bytes: Number(file.size ?? doc.bytes),
    filename: `${doc.doc_type}-${Number(doc.id)}.${CONTENT_TYPES[contentType] ?? 'bin'}`
  };
}

// Sends a document as a download that a browser never renders in place. extra
// carries the caller's own headers (they can't loosen these).
export async function sendDocument(res, file, extra = {}) {
  const headers = {
    ...extra,
    'Content-Type': file.contentType,
    'Content-Disposition': `attachment; filename="${file.filename}"`,
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'no-store, max-age=0',
    'Content-Security-Policy': "sandbox; default-src 'none'"
  };
  res.statusCode = 200;
  for (const [name, value] of Object.entries(headers)) res.setHeader(name, value);
  if (Number.isSafeInteger(file.bytes) && file.bytes > 0) res.setHeader('Content-Length', String(file.bytes));
  if (Buffer.isBuffer(file.body) || file.body instanceof Uint8Array) return res.end(file.body);
  // A Web or Node stream: both are async iterable in Node 24.
  for await (const chunk of file.body) {
    if (!res.write(chunk) && typeof res.once === 'function') await new Promise(resolve => res.once('drain', resolve));
  }
  res.end();
}

// ---------- Cleanup ----------

// Every live file on a deal whose latest close/reopen is a close more than 30
// days before now: the file goes, then the row records when. Reopened and open
// deals keep theirs. One failure doesn't stop the rest. The mailbox side
// (mail_trashed_at) is the mail job's.
export async function cleanupDocuments({ sql, store, now = Date.now() }) {
  const due = await sql`SELECT d.id, d.blob_path FROM buyer_documents d
    JOIN LATERAL (SELECT e.kind, e.occurred_at FROM deal_events e
      WHERE e.onboarding_id = d.onboarding_id AND e.kind IN ('closed', 'reopened')
      ORDER BY e.occurred_at DESC, e.id DESC LIMIT 1) last ON true
    WHERE d.deleted_at IS NULL AND last.kind = 'closed' AND last.occurred_at < ${iso(now - KEEP_DAYS * DAY)}::timestamptz
    ORDER BY d.id`;
  let deleted = 0, failed = 0;
  for (const doc of due) {
    try {
      await store.del(doc.blob_path);
      const done = await sql`UPDATE buyer_documents SET deleted_at = ${iso(now)}::timestamptz WHERE id = ${doc.id} AND deleted_at IS NULL RETURNING id`;
      deleted += done.length;
    } catch {
      failed += 1;
    }
  }
  return { deleted, failed };
}

// The worker shape api/outbox-dispatch.js expects; the daily cron runs it.
export async function runDocumentCleanupWorker({ sql, environment = process.env, store = null, now = Date.now() } = {}) {
  const settings = documentSettings(environment);
  if (!settings) return { configured: false, deleted: 0, failed: 0, exitCode: 1 };
  const result = await cleanupDocuments({ sql, store: store ?? blobStore(settings), now });
  return { configured: true, ...result, exitCode: result.failed ? 1 : 0 };
}
