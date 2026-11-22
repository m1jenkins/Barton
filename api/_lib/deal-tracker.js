// The Deal Tracker: a buyer's private page for their deal (GLOSSARY.md,
// docs/deal-tracker-build-plan-2026-11-21.md). DEAL_TRACKER_ENABLED switches the
// whole thing on; until then a paid intake opens no deal and nothing changes.
export const dealTrackerEnabled = (environment = process.env) =>
  ['1', 'true', 'yes'].includes(String(environment.DEAL_TRACKER_ENABLED || '').trim().toLowerCase());
