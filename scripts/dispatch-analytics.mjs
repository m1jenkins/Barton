import { pathToFileURL } from 'node:url';
import { analyticsDestination, dispatchAnalyticsOutbox } from '../api/_lib/analytics-outbox.js';
import { database } from '../api/_lib/db.js';
import { integerEnv } from '../api/_lib/config.js';

// Invoke from an authorized worker with scoped database/collector credentials.
// This adds no public endpoint and installs no scheduler.
export async function runAnalyticsWorker({ sql, environment = process.env } = {}) {
  if (!analyticsDestination(environment)) return { configured: false, exhausted: null, exitCode: 1 };
  const client = sql || database();
  const maxAttempts = integerEnv('ANALYTICS_OUTBOX_MAX_ATTEMPTS', 8, { min: 1, max: 25 }, environment);
  try {
    const result = await dispatchAnalyticsOutbox({ sql: client, environment });
    const [row] = await client`
      SELECT count(*)::integer AS exhausted FROM analytics_outbox
      WHERE status <> 'sent' AND attempts >= ${maxAttempts} AND available_at <= now()
    `;
    const exhausted = Number(row.exhausted);
    return { ...result, exhausted, exitCode: result.failed || exhausted ? 1 : 0 };
  } finally {
    if (!sql) await client.end({ timeout: 5 });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const result = await runAnalyticsWorker();
    console.log(JSON.stringify(result)); // Aggregate delivery counts only.
    process.exitCode = result.exitCode;
  } catch {
    console.error('Analytics worker failed; check scoped configuration and database access.');
    process.exitCode = 1;
  }
}
