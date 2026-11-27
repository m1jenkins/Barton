BEGIN;
-- A draft is 'handed_off' once Mason says to send the first emails
-- (scripts/car-search.mjs handoff), with decided_at as the time of the handoff.
-- A handed-off draft locks the shortlist the way a sent one does.
ALTER TABLE dealer_email_drafts DROP CONSTRAINT IF EXISTS dealer_email_status_valid;
ALTER TABLE dealer_email_drafts ADD CONSTRAINT dealer_email_status_valid
  CHECK (status IN ('pending', 'sending', 'sent', 'failed', 'discarded', 'handed_off'));
COMMIT;
