BEGIN;

-- The Deal Tracker: a buyer's private page for their deal (GLOSSARY.md,
-- docs/adr/0001 and 0002, docs/deal-tracker-build-plan-2026-11-21.md).
-- A deal now opens at paid intake for the two paid plans (POST /api/onboarding),
-- so every table here hangs off deals(onboarding_id), as deal_events does.
--
-- Who writes what (adr/0002): only the website writes deal_tracker_links,
-- buyer_picks and buyer_documents, so an agent can never record
-- something as if the buyer did it. Agents may insert into buyer_updates and
-- nothing else here; only the website changes a row once it exists.

-- What the buyer's page shows per car: our estimated total until a dealer
-- quotes in writing, the color, and the listing's photos and details
-- (adr/0003). photo_urls is a JSON array of the listing's https photo URLs,
-- which the page serves through its own link so a photo host can't name the
-- dealer early; details is a JSON object of named listing fields.
ALTER TABLE deal_listings ADD COLUMN IF NOT EXISTS est_otd_cents integer;
ALTER TABLE deal_listings ADD COLUMN IF NOT EXISTS color varchar(60);
ALTER TABLE deal_listings ADD COLUMN IF NOT EXISTS photo_urls jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE deal_listings ADD COLUMN IF NOT EXISTS details jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE deal_listings DROP CONSTRAINT IF EXISTS deal_listings_photos_valid;
ALTER TABLE deal_listings ADD CONSTRAINT deal_listings_photos_valid CHECK (jsonb_typeof(photo_urls) = 'array' AND jsonb_array_length(photo_urls) <= 20);
ALTER TABLE deal_listings DROP CONSTRAINT IF EXISTS deal_listings_details_valid;
ALTER TABLE deal_listings ADD CONSTRAINT deal_listings_details_valid CHECK (jsonb_typeof(details) = 'object');
ALTER TABLE deal_listings DROP CONSTRAINT IF EXISTS deal_listings_est_otd_valid;
ALTER TABLE deal_listings ADD CONSTRAINT deal_listings_est_otd_valid CHECK (est_otd_cents IS NULL OR est_otd_cents >= 0);

-- One row per buyer's private link. It holds no secret: the link's signature is
-- an HMAC of the intake ID and version under DEAL_TRACKER_SECRET, so reading
-- this table is not enough to rebuild a link. Reissuing adds one to version,
-- which kills the old link. The opened times are the only thing a GET changes.
CREATE TABLE IF NOT EXISTS deal_tracker_links (
  onboarding_id uuid PRIMARY KEY REFERENCES deals(onboarding_id) ON DELETE CASCADE,
  version integer NOT NULL DEFAULT 1,
  revoked_at timestamptz,
  first_opened_at timestamptz,
  last_opened_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT deal_tracker_links_version_valid CHECK (version >= 1)
);

-- A Buyer Update: the only free text a buyer sees from us. A draft never shows.
-- A posted one shows at once and its email leaves after email_after, so Mason
-- has a few minutes to take it back; a retracted one disappears and never emails.
-- on_masons_say is the agent's own claim that Mason told it to post, or is set
-- by the website when Mason approves a draft.
CREATE TABLE IF NOT EXISTS buyer_updates (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  onboarding_id uuid NOT NULL REFERENCES deals(onboarding_id) ON DELETE CASCADE,
  body text NOT NULL,
  status varchar(10) NOT NULL DEFAULT 'draft',
  ready_for_pick boolean NOT NULL DEFAULT false,
  actor varchar(60) NOT NULL,
  on_masons_say boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  posted_at timestamptz,
  email_after timestamptz,
  emailed_at timestamptz,
  email_attempts integer NOT NULL DEFAULT 0,
  email_error varchar(300),
  retracted_at timestamptz,
  CONSTRAINT buyer_updates_status_valid CHECK (status IN ('draft', 'posted', 'retracted')),
  CONSTRAINT buyer_updates_body_valid CHECK (length(btrim(body)) > 0 AND length(body) <= 4000),
  CONSTRAINT buyer_updates_actor_valid CHECK (length(btrim(actor)) > 0),
  CONSTRAINT buyer_updates_posted_on_masons_say CHECK (status <> 'posted' OR actor = 'mason' OR on_masons_say),
  -- A discarded draft is retracted without ever having been posted.
  CONSTRAINT buyer_updates_times_valid CHECK (
    (status <> 'draft' OR posted_at IS NULL) AND (status <> 'posted' OR posted_at IS NOT NULL)
    AND (status = 'retracted') = (retracted_at IS NOT NULL)
    AND (emailed_at IS NULL OR posted_at IS NOT NULL)
    AND email_attempts >= 0
  )
);
CREATE INDEX IF NOT EXISTS buyer_updates_deal_idx ON buyer_updates (onboarding_id, created_at);
CREATE INDEX IF NOT EXISTS buyer_updates_email_due_idx ON buyer_updates (email_after) WHERE status = 'posted' AND emailed_at IS NULL;

-- Agents can insert rows, so an insert decides nothing but the words, whether it
-- is a draft or posted, and the on_masons_say claim. The times are set here: a
-- new row can't arrive already emailed, already retracted, or with the take-back
-- window skipped. The agent role can't sign a row as Mason either.
CREATE OR REPLACE FUNCTION buyer_updates_before_insert() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status NOT IN ('draft', 'posted') THEN
    RAISE EXCEPTION 'A Buyer Update starts as draft or posted' USING ERRCODE = 'check_violation';
  END IF;
  IF current_user = 'paperclip_agent' AND lower(btrim(NEW.actor)) = 'mason' THEN
    RAISE EXCEPTION 'An agent cannot post a Buyer Update as mason' USING ERRCODE = 'check_violation';
  END IF;
  NEW.created_at := now();
  NEW.emailed_at := NULL;
  NEW.email_attempts := 0;
  NEW.email_error := NULL;
  NEW.retracted_at := NULL;
  IF NEW.status = 'posted' THEN
    NEW.posted_at := now();
    NEW.email_after := now() + interval '5 minutes';
  ELSE
    NEW.posted_at := NULL;
    NEW.email_after := NULL;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS buyer_updates_before_insert ON buyer_updates;
CREATE TRIGGER buyer_updates_before_insert BEFORE INSERT ON buyer_updates
  FOR EACH ROW EXECUTE FUNCTION buyer_updates_before_insert();

-- A Buyer Pick: one car at its best price so far, or "keep looking". It opens
-- only under a posted update with ready_for_pick. vin, dealer_name and otd_cents
-- record the offer as picked, so a later price change shows. One standing row
-- per opening update; Mason can clear one, and a pick is cleared when its
-- dealer is dropped.
CREATE TABLE IF NOT EXISTS buyer_picks (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  onboarding_id uuid NOT NULL REFERENCES deals(onboarding_id) ON DELETE CASCADE,
  kind varchar(15) NOT NULL,
  opened_by_update_id bigint NOT NULL REFERENCES buyer_updates(id) ON DELETE CASCADE,
  vin varchar(17),
  dealer_name varchar(200),
  otd_cents integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  cleared_at timestamptz,
  cleared_by varchar(20),
  CONSTRAINT buyer_picks_kind_valid CHECK (kind IN ('pick', 'keep_looking')),
  CONSTRAINT buyer_picks_offer_valid CHECK (
    (kind = 'pick' AND vin IS NOT NULL AND dealer_name IS NOT NULL AND otd_cents IS NOT NULL AND otd_cents >= 0)
    OR (kind = 'keep_looking' AND vin IS NULL AND dealer_name IS NULL AND otd_cents IS NULL)
  ),
  CONSTRAINT buyer_picks_cleared_valid CHECK (
    (cleared_at IS NULL) = (cleared_by IS NULL) AND (cleared_by IS NULL OR cleared_by IN ('mason', 'dealer_dropped'))
  )
);
CREATE UNIQUE INDEX IF NOT EXISTS buyer_picks_one_standing ON buyer_picks (opened_by_update_id) WHERE cleared_at IS NULL;
CREATE INDEX IF NOT EXISTS buyer_picks_deal_idx ON buyer_picks (onboarding_id, created_at);

-- A Buyer Document, held in a private Vercel Blob store at blob_path. The buyer
-- sees only a receipt (type and time). deleted_at is when the file was removed,
-- 30 days after the deal's latest close.
CREATE TABLE IF NOT EXISTS buyer_documents (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  onboarding_id uuid NOT NULL REFERENCES deals(onboarding_id) ON DELETE CASCADE,
  doc_type varchar(20) NOT NULL,
  blob_path varchar(500) NOT NULL UNIQUE,
  content_type varchar(100) NOT NULL,
  bytes bigint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT buyer_documents_type_valid CHECK (doc_type IN (
    'pre_approval', 'trade_in_photos', 'trade_in_title', 'payoff_letter', 'insurance', 'id', 'other')),
  CONSTRAINT buyer_documents_bytes_valid CHECK (bytes BETWEEN 1 AND 20971520)
);
CREATE INDEX IF NOT EXISTS buyer_documents_deal_idx ON buyer_documents (onboarding_id, created_at);

-- Two more emails to Mason: a Buyer Pick or "keep looking", and an agent's
-- draft waiting for approval. Neither has a deal_events row, so each is keyed
-- by dedupe_key ('pick:<id>', 'draft:<id>') and carries its ids in payload.
ALTER TABLE ops_alert_outbox DROP CONSTRAINT IF EXISTS ops_alert_kind_valid;
ALTER TABLE ops_alert_outbox ADD CONSTRAINT ops_alert_kind_valid CHECK (kind IN (
  'needs_mason', 'agent_overdue', 'digest', 'buyer_pick', 'update_draft'));

-- Paperclip's role (db/010) reads the new tables and inserts Buyer Updates only.
-- Skipped where the role doesn't exist.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'paperclip_agent') THEN
    GRANT SELECT ON deal_tracker_links, buyer_updates, buyer_picks, buyer_documents TO paperclip_agent;
    GRANT INSERT ON buyer_updates TO paperclip_agent;
  END IF;
END $$;

COMMIT;
