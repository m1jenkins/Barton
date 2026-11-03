BEGIN;
-- One deal per paid intake that Mason has run a car search for. The /car-search
-- skill opens it when it submits a shortlist through POST /api/car-search.
CREATE TABLE IF NOT EXISTS deals (
  id uuid PRIMARY KEY,
  onboarding_id uuid NOT NULL UNIQUE REFERENCES onboarding_submissions(id) ON DELETE CASCADE,
  search_summary text,
  shortlisted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Cars the search found, in ranked order. Market value, target and walk-away
-- prices are for Mason only and never go into a dealer email.
CREATE TABLE IF NOT EXISTS deal_listings (
  id uuid PRIMARY KEY,
  deal_id uuid NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  rank smallint NOT NULL,
  title varchar(200) NOT NULL,
  price_cents integer,
  market_price_cents integer,
  target_price_cents integer,
  walk_away_cents integer,
  mileage integer,
  days_on_lot integer,
  vin varchar(17),
  listing_url varchar(2048) NOT NULL,
  dealer_name varchar(200) NOT NULL,
  dealer_location varchar(200),
  dealer_email varchar(254),
  dealer_phone varchar(40),
  why text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT deal_listings_rank_unique UNIQUE (deal_id, rank),
  CONSTRAINT deal_listings_rank_valid CHECK (rank BETWEEN 1 AND 20),
  CONSTRAINT deal_listings_amounts_valid CHECK (
    (price_cents IS NULL OR price_cents >= 0) AND (market_price_cents IS NULL OR market_price_cents >= 0)
    AND (target_price_cents IS NULL OR target_price_cents >= 0) AND (walk_away_cents IS NULL OR walk_away_cents >= 0)
    AND (mileage IS NULL OR mileage >= 0) AND (days_on_lot IS NULL OR days_on_lot >= 0)
  )
);

-- First emails to dealers. Nothing is sent until Mason opens the email's link
-- and presses Send.
CREATE TABLE IF NOT EXISTS dealer_email_drafts (
  id uuid PRIMARY KEY,
  deal_id uuid NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  dealer_name varchar(200) NOT NULL,
  listing_ranks smallint[] NOT NULL DEFAULT '{}',
  to_email varchar(254) NOT NULL,
  subject varchar(200) NOT NULL,
  body text NOT NULL,
  status varchar(20) NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz,
  sent_at timestamptz,
  last_error varchar(300),
  CONSTRAINT dealer_email_status_valid CHECK (status IN ('pending', 'sending', 'sent', 'failed', 'discarded'))
);
CREATE INDEX IF NOT EXISTS dealer_email_drafts_deal_idx ON dealer_email_drafts (deal_id, created_at);

-- Emails to Mason about a deal, queued in the same transaction as the shortlist
-- and retried by the daily cron.
CREATE TABLE IF NOT EXISTS deal_jobs (
  deal_id uuid NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  kind varchar(30) NOT NULL,
  status varchar(20) NOT NULL DEFAULT 'pending',
  attempts integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_attempt_at timestamptz,
  done_at timestamptz,
  last_error varchar(300),
  PRIMARY KEY (deal_id, kind),
  CONSTRAINT deal_jobs_kind_valid CHECK (kind IN ('email_shortlist')),
  CONSTRAINT deal_jobs_status_valid CHECK (status IN ('pending', 'processing', 'done', 'failed')),
  CONSTRAINT deal_jobs_attempts_valid CHECK (attempts >= 0)
);
CREATE INDEX IF NOT EXISTS deal_jobs_status_idx ON deal_jobs (status, created_at);
COMMIT;
