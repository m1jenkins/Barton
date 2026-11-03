import { pathToFileURL } from 'node:url';
import { runLeadEmailWorker } from '../api/_lib/outbox-workers.js';
export { runLeadEmailWorker };

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const result = await runLeadEmailWorker();
    console.log(JSON.stringify(result));
    process.exitCode = result.exitCode;
  } catch {
    console.error('Lead email worker failed; check SMTP settings and database access.');
    process.exitCode = 1;
  }
}
