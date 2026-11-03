BEGIN;
-- One dealer email can quote, or one counter can answer, two cars on the same
-- deal. 007 kept one row per Gmail message and kind, so the second car's row
-- was dropped. Key on the car's VIN too. A NULL VIN still counts as one value,
-- so a rerun can't log a car without a VIN twice.
DROP INDEX IF EXISTS deal_events_message_kind_unique;
CREATE UNIQUE INDEX IF NOT EXISTS deal_events_message_kind_vin_unique ON deal_events (source_message_id, kind, vin)
  NULLS NOT DISTINCT WHERE source_message_id IS NOT NULL;
COMMIT;
