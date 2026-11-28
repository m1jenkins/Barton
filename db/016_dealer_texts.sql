BEGIN;

-- Dealer Texts (docs/adr/0005): Mason's one-to-one texts with a dealership
-- contact, copied from the Messages app on his Mac by scripts/imessage-sync.mjs
-- through /api/car-search and filed under a deal. A dealer is filed under a deal
-- when its macOS Contacts card has "SMR: <client first name>" in Notes, or, if
-- the card has no tag, when its number is on that deal's dealer_text_contacts
-- list. Only open deals sync, from a week before the intake. Text only, as for
-- Buyer Texts: attachments are listed by name and type and stay on the Mac. The
-- daily cron deletes a deal's dealer texts 30 days after its latest close.
-- Never shown on the buyer's Deal Tracker, never quoted to a dealer or in a
-- Buyer Update.
CREATE TABLE IF NOT EXISTS dealer_texts (
  message_guid varchar(100) NOT NULL,
  onboarding_id uuid NOT NULL REFERENCES deals(onboarding_id) ON DELETE CASCADE,
  contact_key varchar(254) NOT NULL,
  contact_name varchar(200),
  sent_at timestamptz NOT NULL,
  from_dealer boolean NOT NULL,
  body text NOT NULL DEFAULT '',
  service varchar(20),
  unsent boolean NOT NULL DEFAULT false,
  edited boolean NOT NULL DEFAULT false,
  attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  synced_at timestamptz NOT NULL DEFAULT now(),
  -- One dealer can be tagged for two clients ("SMR: Ace, Charles"), so the
  -- same text can be filed under two deals.
  PRIMARY KEY (onboarding_id, message_guid),
  CONSTRAINT dealer_texts_body_valid CHECK (length(body) <= 20000 AND (NOT unsent OR body = '')),
  CONSTRAINT dealer_texts_attachments_valid CHECK (jsonb_typeof(attachments) = 'array' AND jsonb_array_length(attachments) <= 20)
);
CREATE INDEX IF NOT EXISTS dealer_texts_deal_idx ON dealer_texts (onboarding_id, sent_at);

-- When the Mac last synced each dealer's thread for a deal, even with nothing
-- new, so a reader can tell a quiet dealer from a sync that stopped. how says
-- whether the Contacts tag or the dealer_text_contacts list filed it.
CREATE TABLE IF NOT EXISTS dealer_text_threads (
  onboarding_id uuid NOT NULL REFERENCES deals(onboarding_id) ON DELETE CASCADE,
  contact_key varchar(254) NOT NULL,
  contact_name varchar(200),
  how varchar(20) NOT NULL,
  last_synced_at timestamptz NOT NULL,
  PRIMARY KEY (onboarding_id, contact_key),
  CONSTRAINT dealer_text_threads_how_valid CHECK (how IN ('contact_tag', 'dealer_list'))
);

-- The backup: dealer phone numbers (or emails) an agent found for a deal, for
-- example in a dealer's email signature. The Mac syncs a number on this list
-- only when its Contacts card has no "SMR:" tag (the tag always wins), and never
-- a number or email that belongs to an open deal's buyer. phone_key is the
-- number's last ten digits, or the email lowercased.
CREATE TABLE IF NOT EXISTS dealer_text_contacts (
  id bigserial PRIMARY KEY,
  onboarding_id uuid NOT NULL REFERENCES deals(onboarding_id) ON DELETE CASCADE,
  phone_key varchar(254) NOT NULL,
  dealer_name varchar(200),
  contact_name varchar(200),
  added_by varchar(60) NOT NULL,
  source_message_id varchar(255),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT dealer_text_contacts_unique UNIQUE (onboarding_id, phone_key),
  CONSTRAINT dealer_text_contacts_key_valid CHECK (phone_key ~ '^[0-9]{10}$' OR (phone_key LIKE '%@%' AND phone_key = lower(phone_key)))
);

-- The agents' role (db/010) reads all three. It writes only the backup list:
-- a dealer text reads as the dealer's own words, so only the sync endpoint adds those.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'paperclip_agent') THEN
    GRANT SELECT ON dealer_texts, dealer_text_threads, dealer_text_contacts TO paperclip_agent;
    GRANT INSERT ON dealer_text_contacts TO paperclip_agent;
    GRANT USAGE ON SEQUENCE dealer_text_contacts_id_seq TO paperclip_agent;
  END IF;
END $$;

COMMIT;
