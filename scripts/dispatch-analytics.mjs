import { pathToFileURL } from 'node:url';
import { runAnalyticsWorker } from '../api/_lib/outbox-workers.js';
export { runAnalyticsWorker };

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
