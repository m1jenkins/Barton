import { createHash, timingSafeEqual } from 'node:crypto';
import { database } from './_lib/db.js';
import { leadDestination } from './_lib/lead-forward-outbox.js';
import { analyticsDestination } from './_lib/analytics-outbox.js';
import { intakeEmailSettings } from './_lib/intake-email.js';
import { leadEmailSettings } from './_lib/lead-email.js';
import { customerEmailSettings } from './_lib/customer-email.js';
import { runLeadWorker, runAnalyticsWorker, runIntakeEmailWorker, runLeadEmailWorker, runCustomerEmailWorker } from './_lib/outbox-workers.js';
import { header, sendJson } from './_lib/http.js';

export const config = { maxDuration: 60 };
const digest = value => createHash('sha256').update(value).digest();

export function outboxHandler({ environment = process.env, getDatabase = database,
  leadWorker = runLeadWorker, analyticsWorker = runAnalyticsWorker,
  intakeEmailWorker = runIntakeEmailWorker, leadEmailWorker = runLeadEmailWorker,
  customerEmailWorker = runCustomerEmailWorker, logger = console } = {}) {
  return async (req, res) => {
    if (req.method !== 'GET') return sendJson(res, 405, { ok: false, error: 'method_not_allowed' }, { Allow: 'GET' });
    const secret = environment.CRON_SECRET;
    if (typeof secret !== 'string' || secret.length < 32) return sendJson(res, 503, { ok: false, error: 'scheduler_unconfigured' });
    const authorization = header(req, 'authorization') || '';
    if (!timingSafeEqual(digest(authorization), digest(`Bearer ${secret}`))) return sendJson(res, 401, { ok: false, error: 'unauthorized' });

    let sql;
    const jobs = [['leads', leadDestination, leadWorker], ['analytics', analyticsDestination, analyticsWorker],
      ['intake_email', intakeEmailSettings, intakeEmailWorker], ['lead_email', leadEmailSettings, leadEmailWorker],
      ['customer_email', customerEmailSettings, customerEmailWorker]];
    const results = await Promise.all(jobs.map(async ([name, destination, worker]) => {
      try {
        if (!destination(environment)) return [name, { configured: false, claimed: 0, sent: 0, failed: 0, exhausted: null }];
        sql ||= getDatabase();
        const { exitCode, ...counts } = await worker({ sql, environment });
        if (exitCode) logger.error('[outbox_attention_required]', { worker: name, failed: counts.failed, exhausted: counts.exhausted });
        return [name, { ...counts, ok: exitCode === 0 }];
      } catch {
        logger.error('[outbox_dispatch_failed]', { worker: name });
        return [name, { configured: true, ok: false, dispatcher_error: true }];
      }
    }));
    const workers = Object.fromEntries(results);
    const ok = results.every(([, result]) => result.ok !== false);
    return sendJson(res, ok ? 200 : 503, { ok, workers });
  };
}

export default outboxHandler();
