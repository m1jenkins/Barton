import { ConfigError, allowedOrigins } from './config.js';

export class HttpError extends Error {
  constructor(status, code, message) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.code = code;
  }
}

export function header(req, name) {
  const value = req.headers?.[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
}

export function requireMethod(req, method) {
  if (req.method !== method) {
    throw new HttpError(405, 'method_not_allowed', `Use ${method}`);
  }
}

export function assertSameOrigin(req) {
  const origin = header(req, 'origin');
  if (!origin || !allowedOrigins().has(origin)) {
    throw new HttpError(403, 'origin_not_allowed', 'Request origin is not allowed');
  }
}

export function assertSameSiteRead(req) {
  const origin = header(req, 'origin');
  if (origin && !allowedOrigins().has(origin)) {
    throw new HttpError(403, 'origin_not_allowed', 'Request origin is not allowed');
  }
  const fetchSite = header(req, 'sec-fetch-site');
  if (fetchSite === 'cross-site') {
    throw new HttpError(403, 'origin_not_allowed', 'Cross-site requests are not allowed');
  }
}

export async function readRawBody(req, limitBytes = 65536, { allowParsedBody = true } = {}) {
  if (Buffer.isBuffer(req.rawBody)) {
    if (req.rawBody.length > limitBytes) throw new HttpError(413, 'payload_too_large', 'Request body is too large');
    return req.rawBody;
  }
  if (allowParsedBody) {
    let parsedBody;
    try {
      parsedBody = req.body;
    } catch {
      throw new HttpError(400, 'invalid_json', 'Request body must contain valid JSON');
    }
    if (Buffer.isBuffer(parsedBody)) {
      if (parsedBody.length > limitBytes) throw new HttpError(413, 'payload_too_large', 'Request body is too large');
      return parsedBody;
    }
    if (typeof parsedBody === 'string') {
      const body = Buffer.from(parsedBody, 'utf8');
      if (body.length > limitBytes) throw new HttpError(413, 'payload_too_large', 'Request body is too large');
      return body;
    }
    if (parsedBody && typeof parsedBody === 'object') {
      throw new HttpError(500, 'raw_body_unavailable', 'Raw request body is unavailable');
    }
  }

  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > limitBytes) throw new HttpError(413, 'payload_too_large', 'Request body is too large');
    chunks.push(buffer);
  }
  return Buffer.concat(chunks);
}

export async function readJsonBody(req, limitBytes = 65536) {
  const contentType = (header(req, 'content-type') || '').split(';', 1)[0].trim().toLowerCase();
  if (contentType !== 'application/json') {
    throw new HttpError(415, 'unsupported_media_type', 'Content-Type must be application/json');
  }

  let parsedBody;
  try {
    parsedBody = req.body;
  } catch {
    throw new HttpError(400, 'invalid_json', 'Request body must contain valid JSON');
  }
  if (parsedBody && typeof parsedBody === 'object' && !Buffer.isBuffer(parsedBody)) {
    const encoded = Buffer.byteLength(JSON.stringify(parsedBody));
    if (encoded > limitBytes) throw new HttpError(413, 'payload_too_large', 'Request body is too large');
    return parsedBody;
  }

  const raw = await readRawBody(req, limitBytes);
  try {
    const parsed = JSON.parse(raw.toString('utf8'));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('not an object');
    return parsed;
  } catch {
    throw new HttpError(400, 'invalid_json', 'Request body must be a JSON object');
  }
}

export function requestUrl(req) {
  const host = header(req, 'x-forwarded-host') || header(req, 'host') || 'localhost';
  const protocol = header(req, 'x-forwarded-proto') || 'https';
  return new URL(req.url || '/', `${protocol}://${host}`);
}

export function sendJson(res, status, body, extraHeaders = {}) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  for (const [name, value] of Object.entries(extraHeaders)) res.setHeader(name, value);
  res.end(JSON.stringify(body));
}

export function sendNoContent(res, status = 204) {
  res.statusCode = status;
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.end();
}

export function withApiErrors(handler) {
  return async function guardedHandler(req, res) {
    try {
      await handler(req, res);
    } catch (error) {
      if (error instanceof HttpError) {
        if (error.status === 405) res.setHeader('Allow', error.message.replace('Use ', ''));
        return sendJson(res, error.status, { ok: false, error: error.code });
      }
      if (error instanceof ConfigError) {
        console.error('[api_configuration_error]', error.message);
        return sendJson(res, 503, { ok: false, error: 'service_unavailable' });
      }
      console.error('[api_unhandled_error]', {
        name: error?.name || 'Error',
        code: error?.code || 'unknown',
        message: String(error?.message || 'Unhandled API error').slice(0, 300)
      });
      return sendJson(res, 500, { ok: false, error: 'internal_error' });
    }
  };
}
