BEGIN;

-- Steer Me Right Private Client (2026-11-26): a third plan, $1,995, for cars
-- with an MSRP of $100,000 or more. It is its own tier, 'private_client';
-- 'concierge' stays the key for Steer Me Right Pro. Apply this before the code
-- that lets a buyer check out on the new plan deploys, or the attempt, purchase
-- and intake inserts fail their tier checks.
ALTER TABLE checkout_attempts DROP CONSTRAINT IF EXISTS checkout_tier_valid;
ALTER TABLE checkout_attempts ADD CONSTRAINT checkout_tier_valid
  CHECK (tier_id IN ('consultation', 'full_service', 'concierge', 'private_client'));

ALTER TABLE purchases DROP CONSTRAINT IF EXISTS purchase_tier_valid;
ALTER TABLE purchases ADD CONSTRAINT purchase_tier_valid
  CHECK (tier_id IN ('consultation', 'full_service', 'concierge', 'private_client'));

ALTER TABLE onboarding_submissions DROP CONSTRAINT IF EXISTS onboarding_tier_valid;
ALTER TABLE onboarding_submissions ADD CONSTRAINT onboarding_tier_valid
  CHECK (tier_id IN ('consultation', 'full_service', 'concierge', 'private_client'));

COMMIT;
