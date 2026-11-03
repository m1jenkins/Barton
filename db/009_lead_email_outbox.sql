BEGIN;
-- One notice email per lead to LEAD_NOTIFY_EMAIL (Grokbot's Client Outreach
-- inbox), which wakes it to read the lead from Neon. Rows are queued in the
-- /api/leads transaction only while that variable is set.
CREATE TABLE IF NOT EXISTS lead_email_outbox (
  lead_id uuid PRIMARY KEY REFERENCES leads(id) ON DELETE CASCADE,
  status varchar(20) NOT NULL DEFAULT 'pending',
  attempts integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_attempt_at timestamptz,
  sent_at timestamptz,
  last_error varchar(300),
  CONSTRAINT lead_email_status_valid CHECK (status IN ('pending', 'processing', 'sent', 'failed')),
  CONSTRAINT lead_email_attempts_valid CHECK (attempts >= 0)
);
-- No backfill: Mason already answered every earlier lead from Zoho.
COMMIT;
