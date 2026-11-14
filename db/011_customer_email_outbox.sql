BEGIN;
-- Automated emails to the buyer (api/_lib/customer-email.js): welcome and
-- what-to-expect when the intake is submitted, then deal-done and a review ask
-- after the deal closes. One row per buyer per template, so each email goes out
-- at most once. send_after holds an email back until its time. 'cancelled' rows
-- never send (npm run customer-emails:cancel, or a reopened deal).
-- No backfill: buyers from before this table existed get nothing.
CREATE TABLE IF NOT EXISTS customer_email_outbox (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  onboarding_id uuid NOT NULL REFERENCES onboarding_submissions(id) ON DELETE CASCADE,
  template varchar(40) NOT NULL,
  send_after timestamptz NOT NULL DEFAULT now(),
  status varchar(20) NOT NULL DEFAULT 'pending',
  attempts integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_attempt_at timestamptz,
  sent_at timestamptz,
  last_error varchar(300),
  CONSTRAINT customer_email_template_valid CHECK (template IN ('welcome', 'what_to_expect', 'deal_done', 'review_ask')),
  CONSTRAINT customer_email_status_valid CHECK (status IN ('pending', 'processing', 'sent', 'failed', 'cancelled')),
  CONSTRAINT customer_email_attempts_valid CHECK (attempts >= 0),
  CONSTRAINT customer_email_once UNIQUE (onboarding_id, template)
);
CREATE INDEX IF NOT EXISTS customer_email_due_idx ON customer_email_outbox (send_after)
  WHERE status IN ('pending', 'failed', 'processing');
COMMIT;
