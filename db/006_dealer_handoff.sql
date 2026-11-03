BEGIN;
-- First emails now go to dealers through Grokbot, from a Gmail inbox used only
-- for dealers (docs/dealer-replies-plan-2026-11-03.md). A draft handed to
-- Grokbot is 'handed_off', with decided_at as the time of the handoff. Grokbot
-- sends it once Mason approves it there, and a handed-off draft locks the
-- shortlist the way a sent one does.
ALTER TABLE dealer_email_drafts DROP CONSTRAINT IF EXISTS dealer_email_status_valid;
ALTER TABLE dealer_email_drafts ADD CONSTRAINT dealer_email_status_valid
  CHECK (status IN ('pending', 'sending', 'sent', 'failed', 'discarded', 'handed_off'));
COMMIT;
