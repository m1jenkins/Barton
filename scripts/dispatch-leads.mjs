import { pathToFileURL } from 'node:url';
import { database } from '../api/_lib/db.js';
import { dispatchLeadForwardOutbox, leadDestination, leadDeliverySettings } from '../api/_lib/lead-forward-outbox.js';

// Run with scoped credentials from an authorized worker. No public retry route.
export async function runLeadWorker({ sql, environment = process.env } = {}) {
  if (!leadDestination(environment)) return { configured: false, exhausted: null, exitCode: 1 };
  const { maxAttempts, leaseSeconds } = leadDeliverySettings(environment);
  const client = sql || database();
  try {
    const result = await dispatchLeadForwardOutbox({ sql: client, environment });
    const [row] = await client`
      SELECT count(*)::integer AS exhausted FROM lead_forward_outbox
      WHERE status <> 'sent' AND attempts >= ${maxAttempts}
        AND (status <> 'processing' OR last_attempt_at IS NULL
             OR last_attempt_at <= now() - ${leaseSeconds} * interval '1 second')
    `;
    const exhausted = Number(row.exhausted);
    return { ...result, exhausted, exitCode: result.failed || exhausted ? 1 : 0 };
  } finally {
    if (!sql) await client.end({ timeout: 5 });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const result = await runLeadWorker();
    console.log(JSON.stringify(result));
    process.exitCode = result.exitCode;
  } catch {
    console.error('Lead worker failed; check scoped configuration and database access.');
    process.exitCode = 1;
  }
}
