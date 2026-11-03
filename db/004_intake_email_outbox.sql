BEGIN;
-- One email to Mason per paid intake. Rows are queued in the onboarding
-- transaction whether or not SMTP is configured, so nothing is lost before setup.
CREATE TABLE IF NOT EXISTS intake_email_outbox (
  onboarding_id uuid PRIMARY KEY REFERENCES onboarding_submissions(id) ON DELETE CASCADE,
  status varchar(20) NOT NULL DEFAULT 'pending',
  attempts integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_attempt_at timestamptz,
  sent_at timestamptz,
  last_error varchar(300),
  CONSTRAINT intake_email_status_valid CHECK (status IN ('pending', 'processing', 'sent', 'failed')),
  CONSTRAINT intake_email_attempts_valid CHECK (attempts >= 0)
);

-- Intakes saved before this table existed were never emailed.
INSERT INTO intake_email_outbox (onboarding_id)
SELECT id FROM onboarding_submissions
ON CONFLICT (onboarding_id) DO NOTHING;
COMMIT;
