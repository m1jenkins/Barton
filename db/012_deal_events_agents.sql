BEGIN;
-- The ops dashboard (/api/ops) reads every deal from this log. Mason's agents
-- (Claude Duet and Paperclip) add rows through scripts/deal-desk-db.mjs; they
-- never edit or delete one.
--   actor             who logged the row: an agent's short name, or 'mason'
--   email_received    a dealer email came in that isn't a quote or counter
--   form_submitted    an agent filled in a dealer's web form for the buyer
--   needs_mason       an agent is blocked on Mason; note says on what, and
--                     options (a JSON array of short strings) are the answers
--                     the dashboard offers as buttons
--   resolved          closes the needs_mason row named in resolves_event_id;
--                     answer is what Mason picked or typed, if anything
ALTER TABLE deal_events ADD COLUMN IF NOT EXISTS actor varchar(60);
ALTER TABLE deal_events ADD COLUMN IF NOT EXISTS resolves_event_id bigint REFERENCES deal_events(id) ON DELETE CASCADE;
ALTER TABLE deal_events ADD COLUMN IF NOT EXISTS options jsonb;
ALTER TABLE deal_events ADD COLUMN IF NOT EXISTS answer text;
ALTER TABLE deal_events DROP CONSTRAINT IF EXISTS deal_events_kind_valid;
ALTER TABLE deal_events ADD CONSTRAINT deal_events_kind_valid CHECK (kind IN (
  'first_email_sent', 'quote', 'counter', 'agreed', 'dropped', 'note', 'closed', 'reopened',
  'email_received', 'form_submitted', 'needs_mason', 'resolved'));
ALTER TABLE deal_events DROP CONSTRAINT IF EXISTS deal_events_resolves_valid;
ALTER TABLE deal_events ADD CONSTRAINT deal_events_resolves_valid
  CHECK ((kind = 'resolved') = (resolves_event_id IS NOT NULL));
ALTER TABLE deal_events DROP CONSTRAINT IF EXISTS deal_events_options_valid;
ALTER TABLE deal_events ADD CONSTRAINT deal_events_options_valid
  CHECK (options IS NULL OR (kind = 'needs_mason' AND jsonb_typeof(options) = 'array'));
ALTER TABLE deal_events DROP CONSTRAINT IF EXISTS deal_events_answer_valid;
ALTER TABLE deal_events ADD CONSTRAINT deal_events_answer_valid
  CHECK (answer IS NULL OR (kind = 'resolved' AND length(answer) <= 1000));
CREATE INDEX IF NOT EXISTS deal_events_resolves_idx ON deal_events (resolves_event_id) WHERE resolves_event_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS deal_events_recent_idx ON deal_events (occurred_at DESC);

-- One row each time an agent runs, whether or not it found anything, so the
-- dashboard can tell a quiet inbox from a dead agent. expect_minutes is how
-- often the agent says it runs; it counts as overdue after twice that.
CREATE TABLE IF NOT EXISTS agent_runs (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor varchar(60) NOT NULL,
  ran_at timestamptz NOT NULL DEFAULT now(),
  expect_minutes integer,
  note text,
  CONSTRAINT agent_runs_expect_valid CHECK (expect_minutes IS NULL OR expect_minutes BETWEEN 1 AND 10080)
);
CREATE INDEX IF NOT EXISTS agent_runs_actor_idx ON agent_runs (actor, ran_at DESC);

-- Emails to Mason from the ops dashboard: one per needs_mason item, one per
-- agent that goes overdue, and a morning digest. dedupe_key keeps each to one
-- email ('need:<event id>', 'agent:<actor>:<last run>', 'digest:<date>').
-- Filled and sent by GET /api/outbox-dispatch (api/_lib/ops-alerts.js).
CREATE TABLE IF NOT EXISTS ops_alert_outbox (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  dedupe_key varchar(160) NOT NULL UNIQUE,
  kind varchar(20) NOT NULL,
  event_id bigint REFERENCES deal_events(id) ON DELETE CASCADE,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status varchar(20) NOT NULL DEFAULT 'pending',
  attempts integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_attempt_at timestamptz,
  sent_at timestamptz,
  last_error varchar(300),
  CONSTRAINT ops_alert_kind_valid CHECK (kind IN ('needs_mason', 'agent_overdue', 'digest')),
  CONSTRAINT ops_alert_status_valid CHECK (status IN ('pending', 'processing', 'sent', 'failed', 'skipped'))
);
CREATE INDEX IF NOT EXISTS ops_alert_outbox_status_idx ON ops_alert_outbox (status, created_at);

-- Paperclip's role (db/010) may log runs too. Skipped where the role doesn't exist.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'paperclip_agent') THEN
    GRANT SELECT, INSERT ON agent_runs TO paperclip_agent;
    GRANT SELECT ON ops_alert_outbox TO paperclip_agent;
  END IF;
END $$;
COMMIT;
