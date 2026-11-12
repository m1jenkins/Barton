BEGIN;
-- Paperclip's agents (docs/paperclip-operating-plan-2026-11-11.md) connect as
-- paperclip_agent, never as neondb_owner. Mason chose on November 11, 2026 to
-- let them read everything, buyer details included, so the role reads every
-- table. It writes one thing: new rows in deal_events (scripts/deal-desk-db.mjs).
-- Create the role in the Neon console first (Roles → New role), so Neon keeps
-- its password; this file only grants. Rerunning it is harmless.
GRANT USAGE ON SCHEMA public TO paperclip_agent;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO paperclip_agent;
ALTER DEFAULT PRIVILEGES FOR ROLE neondb_owner IN SCHEMA public GRANT SELECT ON TABLES TO paperclip_agent;
GRANT INSERT ON deal_events TO paperclip_agent;
COMMIT;
