BEGIN;

-- Normalize unsent sale events created by the original outbox implementation.
-- The payload already carries purchase:<checkout_session_id> as its durable event_id.
INSERT INTO analytics_outbox (
  event_name, dedupe_key, payload, status, attempts, available_at, created_at, sent_at, last_error
)
SELECT
  'purchase', dedupe_key, payload, status, attempts, available_at, created_at, sent_at, last_error
FROM analytics_outbox
WHERE event_name IN ('consultation_booked', 'service_purchase')
  AND status IN ('pending', 'processing', 'failed')
ON CONFLICT (event_name, dedupe_key) DO NOTHING;

DELETE FROM analytics_outbox AS legacy
WHERE legacy.event_name IN ('consultation_booked', 'service_purchase')
  AND legacy.status IN ('pending', 'processing', 'failed')
  AND EXISTS (
    SELECT 1
    FROM analytics_outbox AS standard
    WHERE standard.event_name = 'purchase'
      AND standard.dedupe_key = legacy.dedupe_key
  );

COMMIT;
