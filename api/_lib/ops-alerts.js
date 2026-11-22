import { clearDroppedPicks } from './buyer-picks.js';
import { ConfigError, integerEnv } from './config.js';
import { dealTrackerEnabled } from './deal-tracker.js';
import { escapeHtml, intakeEmailSettings, smtpTransport } from './intake-email.js';
import { agentStatus, loadDashboard, loadRuns, summarizeDeals } from './ops-dashboard.js';

// Emails to Mason from the ops dashboard (docs/implementation-operations.md, "Ops
// dashboard"): one per needs_mason item, one when an agent goes overdue, and a
// morning digest. With the Deal Tracker on, also one per Buyer Question, Buyer
// Pick or "keep looking", held email and agent's draft update. GET /api/outbox-dispatch queues and sends them; the GitHub
// workflow .github/workflows/ops-alerts.yml calls it every 10 minutes with
// ?jobs=ops_alerts. Sent through the paid intake's SMTP login (Google Workspace).

const TIME_ZONE = 'America/Chicago';
const EMAIL_PATTERN = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;
const MAX_ATTEMPTS = 5;
const LEASE_MINUTES = 10;

// OPS_ALERT_EMAIL turns alerts on and says where they go.
export function opsAlertSettings(environment = process.env) {
  const to = environment.OPS_ALERT_EMAIL?.trim();
  if (!to) return null;
  if (!EMAIL_PATTERN.test(to)) throw new ConfigError('OPS_ALERT_EMAIL must be an email address');
  const smtp = intakeEmailSettings(environment);
  if (!smtp) throw new ConfigError('OPS_ALERT_EMAIL needs INTAKE_SMTP_USER and INTAKE_SMTP_PASSWORD');
  return {
    ...smtp, to,
    digestHour: integerEnv('OPS_DIGEST_HOUR', 8, { min: 0, max: 23 }, environment),
    origin: (environment.APP_ORIGIN?.trim() || 'https://www.steermeright.com').replace(/\/$/, '')
  };
}

function central(now) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23'
  }).formatToParts(new Date(now)).map(part => [part.type, part.value]));
  return { date: `${parts.year}-${parts.month}-${parts.day}`, hour: Number(parts.hour) };
}

// tracker: whether the Deal Tracker is on. Off, this runs exactly the queries it
// always has and never names a buyer_* table.
export async function queueAlerts(sql, settings, now = Date.now(), { tracker = false } = {}) {
  // A pick whose dealer was dropped is cleared first, within one 10-minute run,
  // so no "picked a car" email goes out for it.
  if (tracker) await clearDroppedPicks(sql);
  // Only fresh items: an old open question is in the digest, not a new email.
  await sql`INSERT INTO ops_alert_outbox (dedupe_key, kind, event_id)
    SELECT 'need:' || e.id, 'needs_mason', e.id FROM deal_events e
    WHERE e.kind = 'needs_mason' AND e.occurred_at > now() - interval '2 days'
      AND NOT EXISTS (SELECT 1 FROM deal_events r WHERE r.resolves_event_id = e.id)
    ON CONFLICT (dedupe_key) DO NOTHING`;
  for (const agent of agentStatus(await loadRuns(sql), [], now).filter(item => item.overdue)) {
    const lastRun = new Date(agent.last_run).toISOString();
    await sql`INSERT INTO ops_alert_outbox (dedupe_key, kind, payload)
      VALUES (${`agent:${agent.actor}:${lastRun}`}, 'agent_overdue',
        ${JSON.stringify({ actor: agent.actor, last_run: lastRun, expect_minutes: agent.expect_minutes })})
      ON CONFLICT (dedupe_key) DO NOTHING`;
  }
  if (tracker) await queueBuyerAlerts(sql);
  const today = central(now);
  if (today.hour >= settings.digestHour) {
    await sql`INSERT INTO ops_alert_outbox (dedupe_key, kind, payload)
      VALUES (${`digest:${today.date}`}, 'digest', ${JSON.stringify({ date: today.date })})
      ON CONFLICT (dedupe_key) DO NOTHING`;
  }
}

// None of these has a deal_events row, so each is keyed by dedupe_key and
// carries its row id and intake ID in payload (db/013). Like needs_mason, only
// the last two days: anything older is on the dashboard and in the digest.
async function queueBuyerAlerts(sql) {
  await sql`INSERT INTO ops_alert_outbox (dedupe_key, kind, payload)
    SELECT 'question:' || q.id, 'buyer_question', jsonb_build_object('question_id', q.id, 'intake_id', q.onboarding_id)
    FROM buyer_questions q
    WHERE q.discarded_at IS NULL AND (NOT q.held OR q.released_at IS NOT NULL)
      AND coalesce(q.released_at, q.created_at) > now() - interval '2 days'
    ON CONFLICT (dedupe_key) DO NOTHING`;
  await sql`INSERT INTO ops_alert_outbox (dedupe_key, kind, payload)
    SELECT 'draft:' || u.id, 'update_draft', jsonb_build_object('update_id', u.id, 'intake_id', u.onboarding_id)
    FROM buyer_updates u WHERE u.status = 'draft' AND u.created_at > now() - interval '2 days'
    ON CONFLICT (dedupe_key) DO NOTHING`;
  await sql`INSERT INTO ops_alert_outbox (dedupe_key, kind, payload)
    SELECT 'held:' || q.id, 'held_mail', jsonb_build_object('question_id', q.id, 'intake_id', q.onboarding_id)
    FROM buyer_questions q
    WHERE q.held AND q.released_at IS NULL AND q.discarded_at IS NULL AND q.created_at > now() - interval '2 days'
    ON CONFLICT (dedupe_key) DO NOTHING`;
  await sql`INSERT INTO ops_alert_outbox (dedupe_key, kind, payload)
    SELECT 'pick:' || p.id, 'buyer_pick', jsonb_build_object('pick_id', p.id, 'intake_id', p.onboarding_id)
    FROM buyer_picks p WHERE p.cleared_at IS NULL AND p.created_at > now() - interval '2 days'
    ON CONFLICT (dedupe_key) DO NOTHING`;
}

const money = cents => (cents == null ? '—' : `$${Math.round(cents / 100).toLocaleString('en-US')}`);
const clock = value => new Intl.DateTimeFormat('en-US', { timeZone: TIME_ZONE, dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
const parseJson = value => (typeof value === 'string' ? JSON.parse(value) : value ?? {});

// Plain text, with the HTML part made from it, so the two never differ. A line
// is a string, or { h: 'Heading' } for a section title.
function message(subject, lines, link) {
  const text = [...lines.map(line => (typeof line === 'object' ? line.h : line)), '', link].join('\n');
  const html = `<div style="font:15px/1.5 -apple-system,'Segoe UI',Arial,sans-serif;color:#1b1d1f;max-width:640px">${
    lines.map(line => (typeof line === 'object' ? `<p style="margin:16px 0 4px;font-weight:600">${escapeHtml(line.h)}</p>`
      : line === '' ? '' : `<p style="margin:2px 0">${escapeHtml(line)}</p>`)).join('')
  }<p style="margin-top:18px"><a href="${escapeHtml(link)}">${escapeHtml(link)}</a></p></div>`;
  return { subject: subject.slice(0, 180), text, html };
}

async function needEmail(sql, alert, settings) {
  const [need] = await sql`SELECT e.id, e.onboarding_id, e.note, e.options, e.actor, e.dealer_name, e.occurred_at, o.name,
      EXISTS (SELECT 1 FROM deal_events r WHERE r.resolves_event_id = e.id) AS resolved
    FROM deal_events e JOIN onboarding_submissions o ON o.id = e.onboarding_id WHERE e.id = ${alert.event_id}`;
  if (!need || need.resolved) return null;
  const options = parseJson(need.options);
  return message(`Needs you: ${need.name}${need.dealer_name ? ` · ${need.dealer_name}` : ''}`, [
    need.note,
    ...(Array.isArray(options) && options.length ? ['', `Answers offered: ${options.join(' / ')}`] : []),
    '', `From ${need.actor || 'an agent'} at ${clock(need.occurred_at)} CT. Answer on the dashboard:`
  ], `${settings.origin}/api/ops?deal=${need.onboarding_id}`);
}

async function overdueEmail(sql, alert, settings) {
  const payload = parseJson(alert.payload);
  const [latest] = await sql`SELECT max(ran_at) AS last_run FROM agent_runs WHERE actor = ${payload.actor}`;
  if (latest?.last_run && new Date(latest.last_run).getTime() > Date.parse(payload.last_run)) return null;
  return message(`Agent overdue: ${payload.actor}`, [
    `${payload.actor} last ran at ${clock(payload.last_run)} CT. It said it runs every ${payload.expect_minutes} minutes, so it has missed at least two runs.`,
    '', 'Check it in Claude. Until it runs again, nothing it watches is being handled.'
  ], `${settings.origin}/api/ops`);
}

export async function digestEmail(sql, settings, now = Date.now(), { tracker = false } = {}) {
  const data = await loadDashboard(sql, { tracker });
  const deals = summarizeDeals(data, now);
  const open = deals.filter(deal => !deal.closed);
  const day = now - 86400000;
  const moved = new Map();
  for (const event of data.events) {
    if (new Date(event.occurred_at).getTime() < day) continue;
    const deal = deals.find(item => item.onboarding_id === event.onboarding_id);
    if (!deal) continue;
    const line = moved.get(deal.onboarding_id) ?? { deal, kinds: [] };
    line.kinds.push(event.kind.replaceAll('_', ' '));
    moved.set(deal.onboarding_id, line);
  }
  const overdue = data.agents.filter(agent => agent.overdue);
  const quiet = open.filter(deal => deal.stale);
  const questions = data.questions ?? [];
  const held = data.held ?? [];
  const needCount = data.needs.length + data.drafts.length + data.waiting.length + quiet.length + overdue.length + questions.length + held.length;
  const section = (title, items) => (items.length ? ['', { h: title }, ...items.map(item => `- ${item}`)] : []);
  const buyers = tracker ? await buyerCounts(sql, questions, held) : [];
  const lines = [
    needCount ? `${needCount} thing${needCount === 1 ? '' : 's'} need you. ${open.length} open deal${open.length === 1 ? '' : 's'}.`
      : `Nothing needs you. ${open.length} open deal${open.length === 1 ? '' : 's'}.`,
    ...section('Questions from your agents', data.needs.map(need => `${need.name}: ${need.note.replace(/\s+/g, ' ').slice(0, 200)}`)),
    ...section('First emails', data.drafts.map(draft => `${draft.name} · ${draft.dealer_name}: ${draft.status === 'failed' ? 'failed to send' : 'waiting for your approval'}`)),
    ...section('Paid, no car search yet', data.waiting.map(intake => `${intake.name} (${intake.city})`)),
    ...section('Agents overdue', overdue.map(agent => `${agent.actor}: last ran ${clock(agent.last_run)} CT`)),
    ...section('Quiet for 2+ days', quiet.map(deal => `${deal.name}: ${deal.quiet_days} days, ${deal.car ?? 'no car'}`)),
    ...section('From your buyers', buyers),
    ...section('Moved in the last 24 hours', [...moved.values()].map(({ deal, kinds }) =>
      `${deal.name}: ${[...new Set(kinds)].join(', ')}${deal.best_cents != null ? `. Best ${money(deal.best_cents)} vs target ${money(deal.target_cents)}` : ''}`)),
    ...(data.leads.length ? ['', `${data.leads.length} website lead${data.leads.length === 1 ? '' : 's'} in the last 14 days.`] : [])
  ];
  return message(needCount ? `Deals this morning: ${needCount} need${needCount === 1 ? 's' : ''} you` : 'Deals this morning: nothing needs you',
    lines, `${settings.origin}/api/ops`);
}

const dealUrl = (settings, id) => `${settings.origin}/api/ops?deal=${id}`;
const clipText = (text, max) => (text.length > max ? `${text.slice(0, max).trimEnd()}…` : text);
// Line by line, so the HTML part keeps the writer's line breaks; every line is escaped by message().
const bodyLines = (text, max = 4000) => clipText(String(text ?? '').trim(), max).split('\n');

// Each builder rereads its row and returns null (skipped) when it no longer needs Mason.
async function questionEmail(sql, alert, settings) {
  const { question_id: id } = parseJson(alert.payload);
  const [question] = await sql`SELECT q.onboarding_id, q.body, q.source, q.sender_email, q.held, q.released_at, q.discarded_at, o.name,
      EXISTS (SELECT 1 FROM buyer_updates u WHERE u.answers_question_id = q.id AND u.status = 'posted') AS answered
    FROM buyer_questions q JOIN onboarding_submissions o ON o.id = q.onboarding_id WHERE q.id = ${id}`;
  if (!question || question.answered || question.discarded_at || (question.held && !question.released_at)) return null;
  return message(`Question from ${question.name}`, [
    ...bodyLines(question.body, 600),
    '', `${question.source === 'email' ? `By email from ${question.sender_email}` : 'Asked on the Deal Tracker'}. The page promises an answer within one business day. Answer it on the dashboard:`
  ], dealUrl(settings, question.onboarding_id));
}

async function draftEmail(sql, alert, settings) {
  const { update_id: id } = parseJson(alert.payload);
  const [update] = await sql`SELECT u.onboarding_id, u.body, u.status, u.actor, u.ready_for_pick, u.answers_question_id, o.name
    FROM buyer_updates u JOIN onboarding_submissions o ON o.id = u.onboarding_id WHERE u.id = ${id}`;
  if (!update || update.status !== 'draft') return null;
  return message(`Draft update waiting: ${update.name}`, [
    `${update.actor} wrote this Buyer Update${update.answers_question_id != null ? ' in answer to a Buyer Question' : ''}. The buyer sees it only once you approve it.`,
    ...(update.ready_for_pick ? ['It is marked ready for the buyer\'s call, so approving it opens their pick.'] : []),
    '', ...bodyLines(update.body),
    '', 'Approve or discard it on the dashboard:'
  ], dealUrl(settings, update.onboarding_id));
}

// Never the held text: the alert says only who sent it.
async function heldEmail(sql, alert, settings) {
  const { question_id: id } = parseJson(alert.payload);
  const [mail] = await sql`SELECT q.onboarding_id, q.sender_email, q.held, q.released_at, q.discarded_at, q.created_at, o.name
    FROM buyer_questions q JOIN onboarding_submissions o ON o.id = q.onboarding_id WHERE q.id = ${id}`;
  if (!mail || !mail.held || mail.released_at || mail.discarded_at) return null;
  return message(`Held email on ${mail.name}'s deal`, [
    `An email to ${mail.name}'s reply address came from ${mail.sender_email} at ${clock(mail.created_at)} CT. That isn't the address on their intake, so it was held.`,
    '', 'It stays out of the agents\' queue and off the buyer\'s page until you release it. Release or discard it on the dashboard:'
  ], dealUrl(settings, mail.onboarding_id));
}

async function pickEmail(sql, alert, settings) {
  const { pick_id: id } = parseJson(alert.payload);
  const [pick] = await sql`SELECT p.onboarding_id, p.kind, p.vin, p.dealer_name, p.otd_cents, p.cleared_at, o.name,
      (SELECT l.title FROM deal_listings l JOIN deals d ON d.id = l.deal_id
        WHERE d.onboarding_id = p.onboarding_id AND upper(l.vin) = upper(p.vin) ORDER BY l.rank LIMIT 1) AS title
    FROM buyer_picks p JOIN onboarding_submissions o ON o.id = p.onboarding_id WHERE p.id = ${id}`;
  if (!pick || pick.cleared_at) return null;
  const link = dealUrl(settings, pick.onboarding_id);
  if (pick.kind === 'keep_looking') {
    return message(`${pick.name} asked us to keep looking`, [
      `${pick.name} chose none of the cars on the shortlist and asked us to keep looking.`, '', 'See the deal on the dashboard:'
    ], link);
  }
  return message(`${pick.name} picked a car`, [
    `${pick.title ?? 'A car not on the shortlist'} (VIN ${pick.vin})`,
    `${money(pick.otd_cents)} out the door from ${pick.dealer_name}, their best price so far when picked.`,
    '', 'The price isn\'t agreed until you confirm it with the dealer. See the deal on the dashboard:'
  ], link);
}

// The digest's "From your buyers" lines: counts of the four alert kinds, with names where it helps.
async function buyerCounts(sql, questions, held) {
  const [drafts] = await sql`SELECT count(*)::int AS n FROM buyer_updates WHERE status = 'draft'`;
  const [picks] = await sql`SELECT count(*) FILTER (WHERE kind = 'pick')::int AS picks, count(*) FILTER (WHERE kind = 'keep_looking')::int AS keep_looking
    FROM buyer_picks WHERE cleared_at IS NULL AND created_at > now() - interval '1 day'`;
  const count = (n, one, many) => `${n} ${n === 1 ? one : many}`;
  const names = rows => [...new Set(rows.map(row => row.name))].join(', ');
  return [
    ...(questions.length ? [`${count(questions.length, 'Buyer Question', 'Buyer Questions')} waiting for an answer (${names(questions)})`] : []),
    ...(held.length ? [`${count(held.length, 'held email', 'held emails')} to release or discard (${names(held)})`] : []),
    ...(drafts.n ? [`${count(drafts.n, 'draft update', 'draft updates')} waiting for your approval`] : []),
    ...(picks.picks ? [`${count(picks.picks, 'buyer', 'buyers')} picked a car in the last 24 hours`] : []),
    ...(picks.keep_looking ? [`${count(picks.keep_looking, 'buyer', 'buyers')} asked us to keep looking in the last 24 hours`] : [])
  ];
}

const BUILDERS = {
  needs_mason: needEmail, agent_overdue: overdueEmail, digest: (sql, alert, settings) => digestEmail(sql, settings, Date.now(), { tracker: settings.tracker }),
  buyer_question: questionEmail, update_draft: draftEmail, held_mail: heldEmail, buyer_pick: pickEmail
};

export async function dispatchOpsAlerts({ sql, environment = process.env, createTransport = smtpTransport, now = Date.now(), tracker = dealTrackerEnabled(environment) } = {}) {
  const found = opsAlertSettings(environment);
  if (!found) return { configured: false, claimed: 0, sent: 0, failed: 0, skipped: 0 };
  const settings = { ...found, tracker };
  await queueAlerts(sql, settings, now, { tracker });
  const alerts = await sql`UPDATE ops_alert_outbox SET status = 'processing', attempts = attempts + 1, last_attempt_at = now()
    WHERE id IN (SELECT id FROM ops_alert_outbox
      WHERE attempts < ${MAX_ATTEMPTS} AND (status IN ('pending', 'failed')
        OR (status = 'processing' AND last_attempt_at < now() - ${LEASE_MINUTES} * interval '1 minute'))
      ORDER BY created_at LIMIT 20 FOR UPDATE SKIP LOCKED)
    RETURNING id, kind, event_id, payload, attempts`;
  const counts = { configured: true, claimed: alerts.length, sent: 0, failed: 0, skipped: 0 };
  if (!alerts.length) return counts;
  const transport = createTransport(settings);
  try {
    for (const alert of alerts) {
      try {
        const email = await BUILDERS[alert.kind](sql, alert, settings);
        if (!email) {
          await sql`UPDATE ops_alert_outbox SET status = 'skipped', last_error = NULL WHERE id = ${alert.id}`;
          counts.skipped += 1;
          continue;
        }
        await transport.sendMail({ from: { name: 'Steer Me Right ops', address: settings.user }, to: settings.to, ...email });
        await sql`UPDATE ops_alert_outbox SET status = 'sent', sent_at = now(), last_error = NULL WHERE id = ${alert.id}`;
        counts.sent += 1;
      } catch (error) {
        // SMTP errors can quote the message; keep only the error code.
        const code = /^[A-Z0-9_]{2,40}$/.test(error?.code || '') ? error.code : 'UNKNOWN';
        await sql`UPDATE ops_alert_outbox SET status = 'failed', last_error = ${`Ops alert failed (${code})`} WHERE id = ${alert.id}`;
        console.error('[ops_alert_failed]', { id: alert.id, kind: alert.kind, attempt: alert.attempts, code });
        counts.failed += 1;
      }
    }
  } finally {
    transport.close?.();
  }
  return counts;
}

export async function runOpsAlertWorker({ sql, environment = process.env, createTransport } = {}) {
  const result = await dispatchOpsAlerts({ sql, environment, createTransport });
  if (!result.configured) return { ...result, exhausted: null, exitCode: 1 };
  const [row] = await sql`SELECT count(*)::integer AS exhausted FROM ops_alert_outbox
    WHERE status = 'failed' AND attempts >= ${MAX_ATTEMPTS} AND created_at > now() - interval '7 days'`;
  const exhausted = Number(row.exhausted);
  return { ...result, exhausted, exitCode: result.failed || exhausted ? 1 : 0 };
}
