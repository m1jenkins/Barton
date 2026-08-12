BEGIN;

CREATE TABLE IF NOT EXISTS leads (
  id uuid PRIMARY KEY,
  idempotency_key varchar(128) NOT NULL UNIQUE,
  request_hash char(64) NOT NULL,
  name varchar(120) NOT NULL,
  email varchar(254) NOT NULL,
  phone varchar(40) NOT NULL DEFAULT '',
  message text NOT NULL DEFAULT '',
  vehicle varchar(300) NOT NULL DEFAULT '',
  source varchar(100) NOT NULL DEFAULT 'website',
  source_page varchar(300) NOT NULL DEFAULT '/',
  attribution jsonb NOT NULL DEFAULT '{}'::jsonb,
  turnstile_verified boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT leads_request_hash_format CHECK (request_hash ~ '^[0-9a-f]{64}$')
);

CREATE TABLE IF NOT EXISTS lead_forward_outbox (
  lead_id uuid PRIMARY KEY REFERENCES leads(id) ON DELETE CASCADE,
  status varchar(20) NOT NULL DEFAULT 'pending',
  attempts integer NOT NULL DEFAULT 0,
  last_attempt_at timestamptz,
  sent_at timestamptz,
  last_error varchar(300),
  CONSTRAINT lead_forward_status_valid CHECK (status IN ('pending', 'processing', 'sent', 'failed')),
  CONSTRAINT lead_forward_attempts_valid CHECK (attempts >= 0)
);

CREATE TABLE IF NOT EXISTS checkout_attempts (
  id uuid PRIMARY KEY,
  client_reference_id uuid NOT NULL UNIQUE,
  idempotency_key varchar(128) NOT NULL UNIQUE,
  request_hash char(64) NOT NULL,
  tier_id varchar(32) NOT NULL,
  expected_amount integer NOT NULL,
  currency char(3) NOT NULL DEFAULT 'usd',
  lead_id uuid REFERENCES leads(id) ON DELETE SET NULL,
  source_page varchar(300) NOT NULL DEFAULT '/schedule.html',
  attribution jsonb NOT NULL DEFAULT '{}'::jsonb,
  status varchar(24) NOT NULL DEFAULT 'started',
  stripe_checkout_session_id varchar(255),
  created_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz,
  CONSTRAINT checkout_request_hash_format CHECK (request_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT checkout_tier_valid CHECK (tier_id IN ('consultation', 'full_service', 'concierge')),
  CONSTRAINT checkout_amount_positive CHECK (expected_amount > 0),
  CONSTRAINT checkout_status_valid CHECK (status IN ('started', 'paid', 'review_required'))
);

CREATE TABLE IF NOT EXISTS stripe_events (
  event_id varchar(255) PRIMARY KEY,
  event_type varchar(120) NOT NULL,
  checkout_session_id varchar(255),
  livemode boolean NOT NULL,
  stripe_created_at timestamptz NOT NULL,
  outcome varchar(40) NOT NULL DEFAULT 'received',
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  CONSTRAINT stripe_event_outcome_valid CHECK (
    outcome IN ('received', 'ignored', 'recorded', 'duplicate_session', 'unmatched_attempt', 'amount_mismatch')
  )
);

CREATE TABLE IF NOT EXISTS purchases (
  id uuid PRIMARY KEY,
  checkout_session_id varchar(255) NOT NULL UNIQUE,
  checkout_attempt_id uuid NOT NULL REFERENCES checkout_attempts(id),
  client_reference_id uuid NOT NULL,
  stripe_event_id varchar(255) NOT NULL UNIQUE REFERENCES stripe_events(event_id),
  stripe_payment_intent_id varchar(255),
  tier_id varchar(32) NOT NULL,
  amount_total integer NOT NULL,
  currency char(3) NOT NULL,
  payment_status varchar(20) NOT NULL,
  livemode boolean NOT NULL,
  paid_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT purchase_tier_valid CHECK (tier_id IN ('consultation', 'full_service', 'concierge')),
  CONSTRAINT purchase_amount_positive CHECK (amount_total > 0),
  CONSTRAINT purchase_status_paid CHECK (payment_status = 'paid')
);

CREATE TABLE IF NOT EXISTS analytics_outbox (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  event_name varchar(80) NOT NULL,
  dedupe_key varchar(255) NOT NULL,
  payload jsonb NOT NULL,
  status varchar(20) NOT NULL DEFAULT 'pending',
  attempts integer NOT NULL DEFAULT 0,
  available_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  last_error varchar(300),
  UNIQUE (event_name, dedupe_key),
  CONSTRAINT analytics_outbox_status_valid CHECK (status IN ('pending', 'processing', 'sent', 'failed')),
  CONSTRAINT analytics_outbox_attempts_valid CHECK (attempts >= 0)
);

CREATE TABLE IF NOT EXISTS onboarding_submissions (
  id uuid PRIMARY KEY,
  checkout_session_id varchar(255) NOT NULL UNIQUE REFERENCES purchases(checkout_session_id),
  purchase_id uuid NOT NULL UNIQUE REFERENCES purchases(id),
  idempotency_key varchar(128) NOT NULL UNIQUE,
  request_hash char(64) NOT NULL,
  tier_id varchar(32) NOT NULL,
  name varchar(120) NOT NULL,
  email varchar(254) NOT NULL,
  phone varchar(40) NOT NULL,
  city varchar(160) NOT NULL,
  fields jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT onboarding_request_hash_format CHECK (request_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT onboarding_tier_valid CHECK (tier_id IN ('consultation', 'full_service', 'concierge'))
);

CREATE INDEX IF NOT EXISTS checkout_attempts_created_at_idx ON checkout_attempts (created_at DESC);
CREATE INDEX IF NOT EXISTS stripe_events_session_idx ON stripe_events (checkout_session_id);
CREATE INDEX IF NOT EXISTS analytics_outbox_delivery_idx ON analytics_outbox (status, available_at);
CREATE INDEX IF NOT EXISTS leads_created_at_idx ON leads (created_at DESC);

COMMIT;
