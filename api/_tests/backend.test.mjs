import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { HttpError } from '../_lib/http.js';
import {
  analyticsDestination,
  deliveryEvent,
  dispatchAnalyticsOutbox,
  retryDelaySeconds
} from '../_lib/analytics-outbox.js';
import { pageContext, purchaseEventPayload } from '../_lib/analytics.js';
import {
  idempotencyKey,
  isPaidCheckoutEvent,
  payloadHash,
  paymentLinkWithReference,
  stableStringify,
  validateCheckoutPayload,
  validateLeadPayload,
  validateOnboardingPayload
} from '../_lib/validation.js';

test('stable hashing is independent of object key order', () => {
  const first = { tier: 'consultation', nested: { b: 2, a: 1 } };
  const second = { nested: { a: 1, b: 2 }, tier: 'consultation' };
  assert.equal(stableStringify(first), stableStringify(second));
  assert.equal(payloadHash(first), payloadHash(second));
  assert.match(payloadHash(first), /^[0-9a-f]{64}$/);
});

test('idempotency keys are required and constrained', () => {
  assert.equal(idempotencyKey({ headers: { 'idempotency-key': 'lead:12345678' } }), 'lead:12345678');
  assert.throws(
    () => idempotencyKey({ headers: { 'idempotency-key': 'short' } }),
    (error) => error instanceof HttpError && error.code === 'invalid_idempotency_key'
  );
});

test('lead validation accepts the client contract and rejects a filled honeypot', () => {
  assert.deepEqual(
    validateLeadPayload({
      name: 'Ada Buyer',
      email: 'ADA@example.com',
      phone: '',
      message: 'Please help with an SUV.',
      vehicle: '',
      source_page: '/austin.html',
      honeypot: ''
    }),
    {
      name: 'Ada Buyer',
      email: 'ada@example.com',
      phone: '',
      message: 'Please help with an SUV.',
      vehicle: '',
      source: 'website',
      source_page: '/austin.html',
      attribution: {},
      turnstile_token: ''
    }
  );
  assert.throws(
    () => validateLeadPayload({ name: 'Bot', email: 'bot@example.com', message: 'spam', honeypot: 'filled' }),
    (error) => error instanceof HttpError && error.status === 422
  );
});

test('lead attribution is allowlisted and normalized', () => {
  const result = validateLeadPayload({
    name: 'Ada Buyer',
    email: 'ada@example.com',
    message: 'Please help.',
    attribution: {
      first_touch: {
        captured_at: '2026-08-12T12:00:00.000Z',
        landing_path: '/austin.html',
        utm_source: ' Search ',
        injected: 'discard me'
      },
      last_touch: null
    }
  });
  assert.equal(result.attribution.first_touch.utm_source, 'Search');
  assert.equal(Object.hasOwn(result.attribution.first_touch, 'injected'), false);
  assert.equal(result.attribution.last_touch, null);
});

test('checkout validation uses an allowlisted tier and optional lead UUID', () => {
  assert.deepEqual(
    validateCheckoutPayload({
      tier: 'full_service',
      source_page: '/schedule.html',
      lead_id: '7b3d2ef2-8f34-4f4c-8a8a-a8261cb05e81'
    }),
    {
      tier: 'full_service',
      source_page: '/schedule.html',
      lead_id: '7b3d2ef2-8f34-4f4c-8a8a-a8261cb05e81',
      attribution: {}
    }
  );
  assert.throws(
    () => validateCheckoutPayload({ tier: 'invented' }),
    (error) => error instanceof HttpError && error.code === 'invalid_tier'
  );
});

test('payment link keeps configured parameters and replaces client_reference_id', () => {
  const result = new URL(paymentLinkWithReference(
    'https://buy.stripe.com/test?locale=en&client_reference_id=old',
    '7b3d2ef2-8f34-4f4c-8a8a-a8261cb05e81'
  ));
  assert.equal(result.searchParams.get('locale'), 'en');
  assert.equal(result.searchParams.getAll('client_reference_id').length, 1);
  assert.equal(result.searchParams.get('client_reference_id'), '7b3d2ef2-8f34-4f4c-8a8a-a8261cb05e81');
});

test('onboarding accepts fields only for a supported paid tier contract', () => {
  const result = validateOnboardingPayload({
    session_id: 'cs_test_1234567890',
    tier: 'consultation',
    fields: {
      name: 'Ada Buyer',
      email: 'ada@example.com',
      phone: '512-555-0100',
      city: 'Austin, TX',
      preferred_makes: 'Mazda',
      features: ['awd', 'safety-suite'],
      ignored_field: 'not persisted'
    }
  });
  assert.equal(result.tier, 'consultation');
  assert.deepEqual(result.fields.features, ['awd', 'safety-suite']);
  assert.equal(result.fields.preferred_makes, 'Mazda');
  assert.equal(Object.hasOwn(result.fields, 'ignored_field'), false);
});

test('only a paid one-time Checkout Session is a purchase event', () => {
  const base = {
    type: 'checkout.session.completed',
    data: { object: { object: 'checkout.session', mode: 'payment', payment_status: 'paid' } }
  };
  assert.equal(isPaidCheckoutEvent(base), true);
  assert.equal(isPaidCheckoutEvent({ ...base, data: { object: { ...base.data.object, payment_status: 'unpaid' } } }), false);
  assert.equal(isPaidCheckoutEvent({ ...base, type: 'payment_intent.succeeded' }), false);
});

test('database constraints dedupe Stripe sessions and analytics events', async () => {
  const migration = await readFile(new URL('../../db/001_durable_leads_and_payments.sql', import.meta.url), 'utf8');
  assert.match(migration, /checkout_session_id varchar\(255\) NOT NULL UNIQUE/);
  assert.match(migration, /UNIQUE \(event_name, dedupe_key\)/);
  assert.match(migration, /checkout_session_id varchar\(255\) NOT NULL UNIQUE REFERENCES purchases/);
});

test('purchase analytics payload has a durable ID and standard commerce fields', () => {
  assert.deepEqual(purchaseEventPayload({
    checkoutSessionId: 'cs_test_1234567890',
    purchaseId: '06a28d37-b5d9-4f0e-a20c-c8e506ef5477',
    checkoutAttemptId: '91f915a1-ae92-4c4b-a742-c1c935ca07e0',
    leadId: null,
    sourcePage: '/austin.html',
    serviceTier: 'full_service',
    amountTotal: 49500,
    currency: 'usd',
    attribution: { first_touch: { utm_source: 'google' }, last_touch: null }
  }), {
    event_id: 'purchase:cs_test_1234567890',
    transaction_id: 'cs_test_1234567890',
    checkout_session_id: 'cs_test_1234567890',
    purchase_id: '06a28d37-b5d9-4f0e-a20c-c8e506ef5477',
    checkout_attempt_id: '91f915a1-ae92-4c4b-a742-c1c935ca07e0',
    lead_id: null,
    source_page: '/austin.html',
    page_type: 'local_service_area',
    topic_cluster: '',
    city: 'Austin',
    service_tier: 'full_service',
    value: 495,
    currency: 'USD',
    attribution: { first_touch: { utm_source: 'google' }, last_touch: null }
  });
});

test('analytics destination requires an explicit credential-free HTTPS URL', () => {
  assert.equal(analyticsDestination({}), null);
  assert.equal(
    analyticsDestination({ ANALYTICS_FORWARD_URL: 'https://analytics.example/collect?source=server' }).href,
    'https://analytics.example/collect?source=server'
  );
  assert.throws(() => analyticsDestination({ ANALYTICS_FORWARD_URL: 'http://analytics.example/collect' }));
  assert.throws(() => analyticsDestination({ ANALYTICS_FORWARD_URL: 'https://user:pass@analytics.example/collect' }));
});

test('delivery envelope preserves the durable event ID and exponential retry is bounded', () => {
  assert.deepEqual(deliveryEvent({
    event_name: 'purchase',
    dedupe_key: 'cs_test_1234567890',
    created_at: '2026-08-20T12:00:00.000Z',
    payload: { event_id: 'purchase:cs_test_1234567890', value: 495 }
  }), {
    event_id: 'purchase:cs_test_1234567890',
    event_name: 'purchase',
    dedupe_key: 'cs_test_1234567890',
    occurred_at: '2026-08-20T12:00:00.000Z',
    properties: { event_id: 'purchase:cs_test_1234567890', value: 495 }
  });
  assert.equal(retryDelaySeconds(1, 30), 30);
  assert.equal(retryDelaySeconds(4, 30), 240);
  assert.equal(retryDelaySeconds(99, 3600), 21600);
});

test('analytics dispatcher claims a row, sends its ID idempotently, and marks it sent', async (t) => {
  const row = {
    id: 41,
    event_name: 'purchase',
    dedupe_key: 'cs_test_1234567890',
    payload: { event_id: 'purchase:cs_test_1234567890', value: 495, currency: 'USD' },
    attempts: 1,
    created_at: '2026-08-20T12:00:00.000Z'
  };
  const statements = [];
  const tag = async (strings) => {
    const statement = strings.join('?');
    statements.push(statement);
    return statement.includes('RETURNING event.id') ? [row] : [];
  };
  tag.begin = async (callback) => callback(tag);
  let request;
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    request = { url: String(url), options };
    return { ok: true, status: 204 };
  });

  const result = await dispatchAnalyticsOutbox({
    sql: tag,
    environment: {
      ANALYTICS_FORWARD_URL: 'https://analytics.example/collect',
      ANALYTICS_FORWARD_BEARER_TOKEN: 'test-token'
    }
  });

  assert.deepEqual(result, { configured: true, claimed: 1, sent: 1, failed: 0 });
  assert.equal(request.url, 'https://analytics.example/collect');
  assert.equal(request.options.headers['Idempotency-Key'], 'purchase:cs_test_1234567890');
  assert.equal(request.options.headers.Authorization, 'Bearer test-token');
  assert.equal(JSON.parse(request.options.body).event_name, 'purchase');
  assert.ok(statements.some((statement) => statement.includes("status = 'processing'")));
  assert.ok(statements.some((statement) => statement.includes("status = 'sent'")));
});

test('Stripe webhook enqueues one standard purchase event', async () => {
  const webhook = await readFile(new URL('../stripe-webhook.js', import.meta.url), 'utf8');
  const migration = await readFile(new URL('../../db/002_standard_purchase_analytics.sql', import.meta.url), 'utf8');
  assert.match(webhook, /INSERT INTO analytics_outbox/);
  assert.match(webhook, /'purchase'/);
  assert.doesNotMatch(webhook, /consultation_booked|service_purchase/);
  assert.match(migration, /event_name IN \('consultation_booked', 'service_purchase'\)/);
  assert.match(migration, /ON CONFLICT \(event_name, dedupe_key\) DO NOTHING/);
});

test('analytics context uses governed page types and clusters', () => {
  assert.deepEqual(pageContext('/austin.html'), {
    page_type: 'local_service_area',
    topic_cluster: '',
    city: 'Austin'
  });
  assert.deepEqual(pageContext('/auto-financing-credit-fi.html'), {
    page_type: 'resource_hub',
    topic_cluster: 'financing',
    city: ''
  });
});
