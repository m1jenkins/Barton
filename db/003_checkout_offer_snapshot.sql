BEGIN;
-- Do not backfill: legacy attempts must restart before receiving a current link.
-- Their recorded amounts, paid sessions and fulfillment remain untouched.
ALTER TABLE checkout_attempts ADD COLUMN IF NOT EXISTS offer_key varchar(64);
COMMIT;
