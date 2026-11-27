BEGIN;
-- The agents' record of each deal after the handoff. One row per thing that
-- happened: a first email sent, a dealer's quote, a counter, an agreed price, a
-- dropped dealer, a note Mason passed on, or the deal closing or reopening.
-- onboarding_id is the handoff's intake_id. Amounts are cents, as elsewhere.
-- source_message_id is the Gmail message a row came from or was sent as, so a
-- rerun of an agent's inbox check can't log the same email twice.
CREATE TABLE IF NOT EXISTS deal_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  onboarding_id uuid NOT NULL REFERENCES deals(onboarding_id) ON DELETE CASCADE,
  kind varchar(20) NOT NULL,
  dealer_name varchar(200),
  vin varchar(17),
  otd_cents integer,
  itemized jsonb,
  note text,
  source_message_id varchar(255),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT deal_events_kind_valid CHECK (kind IN ('first_email_sent', 'quote', 'counter', 'agreed', 'dropped', 'note', 'closed', 'reopened')),
  CONSTRAINT deal_events_otd_valid CHECK (otd_cents IS NULL OR otd_cents >= 0),
  CONSTRAINT deal_events_itemized_object CHECK (itemized IS NULL OR jsonb_typeof(itemized) = 'object')
);
CREATE INDEX IF NOT EXISTS deal_events_deal_idx ON deal_events (onboarding_id, occurred_at);
CREATE UNIQUE INDEX IF NOT EXISTS deal_events_message_kind_unique ON deal_events (source_message_id, kind)
  WHERE source_message_id IS NOT NULL;
COMMIT;
