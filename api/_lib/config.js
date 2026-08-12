export class ConfigError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ConfigError';
  }
}

export const SERVICE_TIERS = Object.freeze({
  consultation: Object.freeze({
    amount: 29500,
    currency: 'usd',
    paymentLinkEnv: 'STRIPE_PAYMENT_LINK_CONSULTATION_URL'
  }),
  full_service: Object.freeze({
    amount: 49500,
    currency: 'usd',
    paymentLinkEnv: 'STRIPE_PAYMENT_LINK_FULL_SERVICE_URL'
  }),
  concierge: Object.freeze({
    amount: 89500,
    currency: 'usd',
    paymentLinkEnv: 'STRIPE_PAYMENT_LINK_CONCIERGE_URL'
  })
});

export function requiredEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new ConfigError(`Missing required environment variable: ${name}`);
  }
  return value;
}

function normalizeConfiguredOrigin(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new ConfigError(`Invalid allowed origin: ${value}`);
  }

  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new ConfigError(`Allowed origin must be an HTTP(S) origin without a path: ${value}`);
  }
  return url.origin;
}

export function allowedOrigins() {
  const configured = [process.env.APP_ORIGIN, ...(process.env.ALLOWED_ORIGINS || '').split(',')]
    .map((value) => value?.trim())
    .filter(Boolean)
    .map(normalizeConfiguredOrigin);

  if (configured.length === 0) {
    if (process.env.NODE_ENV === 'production') {
      throw new ConfigError('APP_ORIGIN or ALLOWED_ORIGINS is required in production');
    }
    return new Set(['http://localhost:3000', 'http://localhost:8080']);
  }

  return new Set(configured);
}

export function serviceTier(tierId) {
  const service = SERVICE_TIERS[tierId];
  if (!service) return null;
  return service;
}

export function paymentLinkForTier(tierId) {
  const service = serviceTier(tierId);
  if (!service) return null;

  const raw = requiredEnv(service.paymentLinkEnv);
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new ConfigError(`${service.paymentLinkEnv} must be a valid URL`);
  }

  if (url.protocol !== 'https:' || url.username || url.password || url.hash) {
    throw new ConfigError(`${service.paymentLinkEnv} must be a credential-free HTTPS URL without a fragment`);
  }
  return url;
}

export function integerEnv(name, fallback, { min, max }) {
  const raw = process.env[name];
  if (!raw) return fallback;
  const value = Number.parseInt(raw, 10);
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new ConfigError(`${name} must be an integer between ${min} and ${max}`);
  }
  return value;
}
