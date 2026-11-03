import { pathToFileURL } from 'node:url';
import { runIntakeEmailWorker } from '../api/_lib/outbox-workers.js';
export { runIntakeEmailWorker };

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const result = await runIntakeEmailWorker();
    console.log(JSON.stringify(result));
    process.exitCode = result.exitCode;
  } catch {
    console.error('Intake email worker failed; check SMTP settings and database access.');
    process.exitCode = 1;
  }
}
