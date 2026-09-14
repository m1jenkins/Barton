import { OPENAI_ADS_PIXEL_ID } from '../../openai-ads.js';

const OPENAI_ADS_CAPI_ENDPOINT = 'https://bzr.openai.com/v1/events';
const OPENAI_ADS_CAPI_KEY_ENV = 'OPENAI_ADS_CONVERSIONS_API_KEY';
const OPENAI_ADS_CAPI_PIXEL_ID_ENV = 'OPENAI_ADS_CAPI_PIXEL_ID';
const OPENAI_ADS_SITE_ORIGIN_ENV = 'OPENAI_ADS_SITE_ORIGIN';
const OPENAI_ADS_CAPI_TIMEOUT_ENV = 'OPENAI_ADS_CAPI_TIMEOUT_MS';
const OPENAI_ADS_CAPI_DEFAULT_TIMEOUT_MS = 5000;

function requestHeader(req, name) {
  const key = name.toLowerCase();
  const value = req?.headers?.[key];
  if (Array.isArray(value)) return value[0];
  return value == null ? undefined : value;
}

function normalizeOrigin(value) {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  if (!trimmed) return '';
  try {
    const url = new URL(trimmed);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
      return '';
    }
    return url.origin;
  } catch {
    return '';
  }
}

function readRequestOrigin(req) {
  const host = requestHeader(req, 'x-forwarded-host') || requestHeader(req, 'host');
  if (!host) return '';
  const protocol = requestHeader(req, 'x-forwarded-proto') || 'https';
  try {
    return new URL(`${protocol}://${host}`).origin;
  } catch {
    return '';
  }
}

function readOpprefCookie(req) {
  const cookieHeader = requestHeader(req, 'cookie');
  if (typeof cookieHeader !== 'string') return '';
  const parts = cookieHeader.split(';');
  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed.startsWith('__oppref=')) continue;
    return trimmed.slice('__oppref='.length);
  }
  return '';
}

function sanitizeRequestPath(path) {
  if (typeof path !== 'string') return '/';
  const candidate = path.trim();
  if (!candidate) return '/';
  try {
    return new URL(candidate, 'https://example.com').pathname || '/';
  } catch {
    return candidate.startsWith('/') ? candidate : `/${candidate}`;
  }
}

function buildSourceUrl(req, { sourceUrl, sourcePage }) {
  const requestOrigin = readRequestOrigin(req);
  const canonicalOrigin = normalizeOrigin(process.env[OPENAI_ADS_SITE_ORIGIN_ENV]) || requestOrigin;
  if (!canonicalOrigin) return '';

  if (typeof sourceUrl === 'string' && sourceUrl.length > 0) {
    try {
      const candidate = new URL(sourceUrl, canonicalOrigin);
      const isTrustedOrigin =
        (!requestOrigin || candidate.origin === requestOrigin) ||
        candidate.origin === canonicalOrigin;
      if (
        ['http:', 'https:'].includes(candidate.protocol) &&
        isTrustedOrigin
      ) {
        return `${candidate.origin}${candidate.pathname}`;
      }
    } catch {
      // Intentionally fall back to source page when browser-origin URL is untrusted.
    }
  }

  const path = sanitizeRequestPath(typeof sourcePage === 'string' && sourcePage.length > 0 ? sourcePage : '/');
  return `${canonicalOrigin}${path}`;
}

function capiConfig() {
  const accessToken = process.env[OPENAI_ADS_CAPI_KEY_ENV]?.trim();
  if (!accessToken) return null;
  const rawPixelId = process.env[OPENAI_ADS_CAPI_PIXEL_ID_ENV]?.trim() || OPENAI_ADS_PIXEL_ID;
  if (!rawPixelId) return null;

  const timeoutRaw = process.env[OPENAI_ADS_CAPI_TIMEOUT_ENV]?.trim();
  const timeoutMs = Number.parseInt(timeoutRaw || '', 10);
  const parsedTimeout = Number.isInteger(timeoutMs) ? timeoutMs : OPENAI_ADS_CAPI_DEFAULT_TIMEOUT_MS;
  return {
    accessToken,
    pixelId: rawPixelId,
    timeoutMs: Math.min(Math.max(parsedTimeout, 500), 15000)
  };
}

function mapData(eventType, payload) {
  const mapping = {
    lead_created: { type: 'customer_action' },
    checkout_started: { type: 'contents' },
    order_created: { type: 'contents' }
  };
  const data = { ...(mapping[eventType] || { type: 'custom' }) };
  if (eventType === 'order_created') {
    const amount = Number(payload?.amount);
    if (Number.isInteger(amount) && amount >= 0) data.amount = amount;
    const currency = typeof payload?.currency === 'string' ? payload.currency.trim() : '';
    if (currency) data.currency = currency.toUpperCase();
  }
  return data;
}

function buildUserContext(req) {
  const user = {};
  const userAgent = requestHeader(req, 'user-agent');
  const forwardedFor = requestHeader(req, 'x-forwarded-for');
  const ipAddress = typeof forwardedFor === 'string'
    ? forwardedFor.split(',')[0]?.trim()
    : req?.socket?.remoteAddress;
  if (userAgent) user.user_agent = userAgent;
  if (ipAddress) user.ip_address = ipAddress;
  return user;
}

function buildEvent({ eventType, eventId, timestampMs, sourcePage, sourceUrl, amount, currency, req }) {
  if (!eventType || !eventId) return null;
  const resolvedSource = buildSourceUrl(req, { sourceUrl, sourcePage });
  if (!resolvedSource) return null;
  const normalizedTimestamp = Number.isFinite(timestampMs) ? timestampMs : Date.now();
  const user = buildUserContext(req);
  const oppref = readOpprefCookie(req);
  return {
    id: eventId,
    type: eventType,
    timestamp_ms: normalizedTimestamp,
    action_source: 'web',
    source_url: resolvedSource,
    data: mapData(eventType, { amount, currency }),
    ...(oppref ? { oppref } : {}),
    ...(Object.keys(user).length ? { user } : {})
  };
}

async function dispatchEvent(config, event) {
  const response = await fetch(`${OPENAI_ADS_CAPI_ENDPOINT}?pid=${encodeURIComponent(config.pixelId)}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.accessToken}`
    },
    body: JSON.stringify({ validate_only: false, events: [event] }),
    redirect: 'error',
    signal: AbortSignal.timeout(config.timeoutMs)
  });
  if (!response.ok) {
    throw new Error(`OpenAI CAPI returned HTTP ${response.status}`);
  }
}

export function trackOpenAIAdsConversion({ eventType, eventId, timestampMs, sourcePage, sourceUrl, amount, currency }, req) {
  const payload = capiConfig();
  if (!payload || !req || !eventType || typeof eventId !== 'string') return;
  const resolvedTimestamp = Number(timestampMs);
  const event = buildEvent({
    eventType,
    eventId,
    timestampMs: Number.isFinite(resolvedTimestamp) ? resolvedTimestamp : Date.now(),
    sourcePage,
    sourceUrl,
    amount,
    currency,
    req
  });
  if (!event) return;
  const fireAndForget = dispatchEvent(payload, event).catch((error) => {
    console.error('[openai_ads_capi_failed]', {
      event_id: event.id,
      event_type: eventType,
      error: String(error?.message || 'Failed to dispatch OpenAI Ads CAPI event').slice(0, 300)
    });
  });
  void fireAndForget;
}
