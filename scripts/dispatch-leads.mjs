import { pathToFileURL } from 'node:url';
import { runLeadWorker } from '../api/_lib/outbox-workers.js';
export { runLeadWorker };

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
