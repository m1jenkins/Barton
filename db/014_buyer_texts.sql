BEGIN;

-- Buyer Texts (docs/adr/0004): Mason's one-to-one texts with a buyer, copied
-- from the Messages app on his Mac by scripts/imessage-sync.mjs through
-- /api/car-search, so agents can read what the buyer said. Only the buyer's own
-- intake number or email is synced, from a week before the intake and only
-- while the deal is open. Text only: attachments are listed by name and type,
-- and the files stay on the Mac. The daily cron deletes a deal's texts 30 days
-- after its latest close. The buyer's Deal Tracker never shows them.
CREATE TABLE IF NOT EXISTS buyer_texts (
  message_guid varchar(100) PRIMARY KEY,
  onboarding_id uuid NOT NULL REFERENCES deals(onboarding_id) ON DELETE CASCADE,
  sent_at timestamptz NOT NULL,
  from_buyer boolean NOT NULL,
  body text NOT NULL DEFAULT '',
  service varchar(20),
  unsent boolean NOT NULL DEFAULT false,
  edited boolean NOT NULL DEFAULT false,
  attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  synced_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT buyer_texts_body_valid CHECK (length(body) <= 20000 AND (NOT unsent OR body = '')),
  CONSTRAINT buyer_texts_attachments_valid CHECK (jsonb_typeof(attachments) = 'array' AND jsonb_array_length(attachments) <= 20)
);
CREATE INDEX IF NOT EXISTS buyer_texts_deal_idx ON buyer_texts (onboarding_id, sent_at);

-- When the Mac last synced each deal's thread, even with nothing new, so a
-- reader can tell a quiet buyer from a sync that stopped.
CREATE TABLE IF NOT EXISTS buyer_text_threads (
  onboarding_id uuid PRIMARY KEY REFERENCES deals(onboarding_id) ON DELETE CASCADE,
  last_synced_at timestamptz NOT NULL
);

-- The agents' role (db/010) reads both tables and writes neither: a row here
-- reads as the buyer's own words, so only the sync endpoint adds them.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'paperclip_agent') THEN
    GRANT SELECT ON buyer_texts, buyer_text_threads TO paperclip_agent;
  END IF;
END $$;

COMMIT;
