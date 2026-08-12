import { createHash } from 'node:crypto';
import { SERVICE_TIERS } from './config.js';
import { HttpError, header } from './http.js';

const IDEMPOTENCY_PATTERN = /^[A-Za-z0-9._:-]{8,128}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SESSION_PATTERN = /^cs_(?:(?:test|live)_)?[A-Za-z0-9]{8,220}$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function cleanString(value, field, { required = false, max = 500, min = 0 } = {}) {
  if (value == null) value = '';
  if (typeof value !== 'string') throw new HttpError(422, 'invalid_payload', `${field} must be a string`);
  const result = value.trim();
  if (required && result.length === 0) throw new HttpError(422, 'invalid_payload', `${field} is required`);
  if (result.length < min || result.length > max) throw new HttpError(422, 'invalid_payload', `${field} has an invalid length`);
  return result;
}

function validateAttributionTouch(value, field) {
  if (value == null) return null;
  if (typeof value !== 'object' || Array.isArray(value)) {
    throw new HttpError(422, 'invalid_payload', `${field} must be an object`);
  }
  const touch = {
    captured_at: cleanString(value.captured_at, `${field}.captured_at`, { max: 40 }),
    landing_path: cleanString(value.landing_path, `${field}.landing_path`, { max: 300 }),
    referrer: cleanString(value.referrer, `${field}.referrer`, { max: 1000 }),
    utm_source: cleanString(value.utm_source, `${field}.utm_source`, { max: 200 }),
    utm_medium: cleanString(value.utm_medium, `${field}.utm_medium`, { max: 200 }),
    utm_campaign: cleanString(value.utm_campaign, `${field}.utm_campaign`, { max: 300 }),
    utm_content: cleanString(value.utm_content, `${field}.utm_content`, { max: 300 }),
    utm_term: cleanString(value.utm_term, `${field}.utm_term`, { max: 300 })
  };
  if (touch.captured_at && Number.isNaN(Date.parse(touch.captured_at))) {
    throw new HttpError(422, 'invalid_payload', `${field}.captured_at is invalid`);
  }
  if (touch.landing_path && (!touch.landing_path.startsWith('/') || touch.landing_path.startsWith('//'))) {
    throw new HttpError(422, 'invalid_payload', `${field}.landing_path must be a same-site path`);
  }
  return touch;
}

export function validateAttribution(value) {
  if (value == null) return {};
  if (typeof value !== 'object' || Array.isArray(value)) {
    throw new HttpError(422, 'invalid_payload', 'attribution must be an object');
  }
  return {
    first_touch: validateAttributionTouch(value.first_touch, 'attribution.first_touch'),
    last_touch: validateAttributionTouch(value.last_touch, 'attribution.last_touch')
  };
}

export function idempotencyKey(req) {
  const value = header(req, 'idempotency-key')?.trim();
  if (!value || !IDEMPOTENCY_PATTERN.test(value)) {
    throw new HttpError(400, 'invalid_idempotency_key', 'Idempotency-Key must be 8-128 safe ASCII characters');
  }
  return value;
}

export function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
}

export function payloadHash(value) {
  return createHash('sha256').update(stableStringify(value)).digest('hex');
}

export function validateLeadPayload(body) {
  const honeypot = cleanString(body.honeypot ?? body.website ?? body._company_website, 'honeypot', { max: 200 });
  if (honeypot) throw new HttpError(422, 'invalid_payload', 'Invalid form submission');

  const name = cleanString(body.name, 'name', { required: true, max: 120 });
  const email = cleanString(body.email, 'email', { required: true, max: 254 }).toLowerCase();
  if (!EMAIL_PATTERN.test(email)) throw new HttpError(422, 'invalid_payload', 'email is invalid');

  const result = {
    name,
    email,
    phone: cleanString(body.phone, 'phone', { max: 40 }),
    message: cleanString(body.message, 'message', { max: 3000 }),
    vehicle: cleanString(body.vehicle, 'vehicle', { max: 300 }),
    source: cleanString(body.source, 'source', { max: 100 }) || 'website',
    source_page: cleanString(body.source_page ?? body.page_path, 'source_page', { max: 300 }) || '/',
    attribution: validateAttribution(body.attribution),
    turnstile_token: cleanString(body.turnstile_token, 'turnstile_token', { max: 2048 })
  };

  if (!result.message && !result.vehicle) throw new HttpError(422, 'invalid_payload', 'message or vehicle is required');
  if (!result.source_page.startsWith('/') || result.source_page.startsWith('//')) {
    throw new HttpError(422, 'invalid_payload', 'source_page must be a same-site path');
  }
  return result;
}

export function validateCheckoutPayload(body) {
  const tier = validateTier(body.tier ?? body.tier_id);
  const sourcePage = cleanString(body.source_page ?? body.source_path, 'source_page', { max: 300 }) || '/schedule.html';
  if (!sourcePage.startsWith('/') || sourcePage.startsWith('//')) {
    throw new HttpError(422, 'invalid_payload', 'source_page must be a same-site path');
  }
  const leadId = body.lead_id == null || body.lead_id === '' ? null : cleanString(body.lead_id, 'lead_id', { max: 36 });
  if (leadId && !UUID_PATTERN.test(leadId)) throw new HttpError(422, 'invalid_payload', 'lead_id is invalid');
  return {
    tier,
    source_page: sourcePage,
    lead_id: leadId?.toLowerCase() || null,
    attribution: validateAttribution(body.attribution)
  };
}

export function validateTier(value) {
  const tier = cleanString(value, 'tier', { required: true, max: 32 });
  if (!Object.hasOwn(SERVICE_TIERS, tier)) throw new HttpError(422, 'invalid_tier', 'tier is invalid');
  return tier;
}

export function validateSessionId(value) {
  const sessionId = cleanString(value, 'session_id', { required: true, max: 255 });
  if (!SESSION_PATTERN.test(sessionId)) throw new HttpError(422, 'invalid_session', 'session_id is invalid');
  return sessionId;
}

export function validateClientReferenceId(value) {
  if (typeof value !== 'string' || !UUID_PATTERN.test(value)) return null;
  return value.toLowerCase();
}

const ONBOARDING_FIELDS = Object.freeze({
  contact_preference: 40,
  vehicle_type: 80,
  condition: 40,
  preferred_makes: 500,
  year_min: 12,
  max_mileage: 20,
  budget: 80,
  budget_other: 120,
  payment_method: 80,
  trade_in: 80,
  primary_use: 120,
  features_other: 500,
  timeline: 80,
  colors: 300,
  dealbreakers: 2000,
  notes: 3000,
  consultation_questions: 3000,
  delivery_address: 1000,
  trade_identifier: 120,
  trade_mileage: 20,
  trade_condition: 120
});

export function validateOnboardingPayload(body) {
  const fields = body.fields;
  if (!fields || typeof fields !== 'object' || Array.isArray(fields)) {
    throw new HttpError(422, 'invalid_payload', 'fields must be an object');
  }
  const honeypot = cleanString(fields.honeypot ?? fields.website ?? fields._company_website, 'honeypot', { max: 200 });
  if (honeypot) throw new HttpError(422, 'invalid_payload', 'Invalid form submission');

  const tier = validateTier(body.tier ?? body.tier_id);
  const sessionId = validateSessionId(body.session_id);
  const name = cleanString(fields.name, 'name', { required: true, max: 120 });
  const email = cleanString(fields.email, 'email', { required: true, max: 254 }).toLowerCase();
  if (!EMAIL_PATTERN.test(email)) throw new HttpError(422, 'invalid_payload', 'email is invalid');

  const answers = {};
  for (const [key, max] of Object.entries(ONBOARDING_FIELDS)) {
    if (fields[key] == null || fields[key] === '') continue;
    answers[key] = cleanString(String(fields[key]), key, { max });
  }

  const rawFeatures = fields.features;
  if (rawFeatures != null && rawFeatures !== '') {
    const features = Array.isArray(rawFeatures) ? rawFeatures : String(rawFeatures).split(',');
    answers.features = features.map((item) => cleanString(String(item), 'features', { max: 80 })).filter(Boolean).slice(0, 30);
  }

  return {
    session_id: sessionId,
    tier,
    name,
    email,
    phone: cleanString(fields.phone, 'phone', { required: true, max: 40 }),
    city: cleanString(fields.city, 'city', { required: true, max: 160 }),
    fields: answers
  };
}

export function paymentLinkWithReference(baseUrl, clientReferenceId) {
  const url = new URL(baseUrl);
  url.searchParams.set('client_reference_id', clientReferenceId);
  return url.toString();
}

export function isPaidCheckoutEvent(event) {
  if (!['checkout.session.completed', 'checkout.session.async_payment_succeeded'].includes(event?.type)) return false;
  const session = event.data?.object;
  return session?.object === 'checkout.session' && session.mode === 'payment' && session.payment_status === 'paid';
}
