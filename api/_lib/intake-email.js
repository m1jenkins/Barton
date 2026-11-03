import nodemailer from 'nodemailer';
import { ConfigError, integerEnv } from './config.js';
import { database } from './db.js';

// Paid intakes are emailed to Mason through the steermeright.com Zoho mailbox.
// The database row stays the source of truth; this queue only tracks delivery.
const DEFAULT_TO = 'mason@steermeright.com';
const EMAIL_PATTERN = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;

const PLAN_NAMES = Object.freeze({
  full_service: 'Steer Me Right ($395 plan)',
  concierge: 'Steer Me Right Pro ($695 plan)',
  consultation: 'Consultation (retired plan)'
});

// Chat intake labels first (buying/intake.js), then the older form's fields.
export const SEARCH_FIELDS = Object.freeze([
  ['preferred_makes', 'Car'],
  ['vehicle_type', 'Vehicle type'],
  ['condition', 'New or used'],
  ['model_years', 'Model years'],
  ['year_min', 'Oldest model year'],
  ['max_mileage', 'Max mileage'],
  ['budget', 'All-in budget'],
  ['budget_other', 'Budget details'],
  ['payment_method', 'Paying'],
  ['financing_status', 'Loan pre-approval'],
  ['trade_in', 'Trade-in'],
  ['trade_vehicle', 'Trade-in vehicle'],
  ['trade_identifier', 'Trade-in VIN or plate'],
  ['trade_mileage', 'Trade-in mileage'],
  ['trade_condition', 'Trade-in condition'],
  ['timeline', 'Timing'],
  ['search_radius', 'How far'],
  ['primary_use', 'Main use'],
  ['needs', 'What it needs to do'],
  ['features', 'Features'],
  ['features_other', 'Other features'],
  ['colors', 'Colors'],
  ['dealbreakers', 'Dealbreakers'],
  ['delivery_address', 'Delivery address'],
  ['consultation_questions', 'Consultation questions'],
  ['notes', 'Anything else']
]);
const KNOWN_FIELDS = new Set([...SEARCH_FIELDS.map(([key]) => key), 'contact_preference']);

export function intakeEmailSettings(environment = process.env) {
  const user = environment.INTAKE_SMTP_USER?.trim();
  const password = environment.INTAKE_SMTP_PASSWORD?.trim();
  if (!user && !password) return null;
  if (!user || !password) throw new ConfigError('INTAKE_SMTP_USER and INTAKE_SMTP_PASSWORD must be set together');
  const to = environment.INTAKE_EMAIL_TO?.trim() || DEFAULT_TO;
  for (const [name, value] of [['INTAKE_SMTP_USER', user], ['INTAKE_EMAIL_TO', to]]) {
    if (!EMAIL_PATTERN.test(value)) throw new ConfigError(`${name} must be an email address`);
  }
  const timeoutMs = integerEnv('INTAKE_SMTP_TIMEOUT_MS', 15000, { min: 1000, max: 30000 }, environment);
  const leaseSeconds = integerEnv('INTAKE_OUTBOX_LEASE_SECONDS', 120, { min: 30, max: 900 }, environment);
  if (leaseSeconds * 1000 <= timeoutMs * 2) throw new ConfigError('INTAKE_OUTBOX_LEASE_SECONDS must exceed twice the SMTP timeout');
  return {
    host: environment.INTAKE_SMTP_HOST?.trim() || 'smtppro.zoho.com',
    port: integerEnv('INTAKE_SMTP_PORT', 465, { min: 1, max: 65535 }, environment),
    user, password, to, timeoutMs, leaseSeconds,
    batchSize: integerEnv('INTAKE_OUTBOX_BATCH_SIZE', 10, { min: 1, max: 50 }, environment),
    maxAttempts: integerEnv('INTAKE_OUTBOX_MAX_ATTEMPTS', 8, { min: 1, max: 25 }, environment),
    retrySeconds: integerEnv('INTAKE_OUTBOX_RETRY_SECONDS', 60, { min: 5, max: 3600 }, environment)
  };
}

export const escapeHtml = value => String(value).replace(/[&<>"']/g, character => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]
));
export const oneLine = value => String(value ?? '').replace(/\s+/g, ' ').trim();
export const display = value => Array.isArray(value) ? value.join(', ') : String(value ?? '').trim();

export function centralTime(value) {
  if (!value) return '';
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Chicago', weekday: 'short', month: 'short', day: 'numeric',
    year: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short'
  }).format(new Date(value));
}

function money(cents, currency) {
  const amount = Number(cents) / 100;
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency: String(currency || 'usd').toUpperCase(),
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2
  }).format(amount);
}

function describeTouch(touch) {
  if (!touch || typeof touch !== 'object') return '';
  const campaign = ['utm_source', 'utm_medium', 'utm_campaign'].map(key => touch[key]).filter(Boolean).join(' / ');
  return [
    campaign,
    touch.landing_path ? `landed on ${touch.landing_path}` : '',
    touch.referrer ? `from ${touch.referrer}` : ''
  ].filter(Boolean).join(', ');
}

function stripeUrl(row) {
  if (!row.stripe_payment_intent_id) return '';
  return `https://dashboard.stripe.com/${row.livemode ? '' : 'test/'}payments/${encodeURIComponent(row.stripe_payment_intent_id)}`;
}

export function renderIntakeEmail(row) {
  const fields = row.fields && typeof row.fields === 'object' && !Array.isArray(row.fields) ? row.fields : {};
  const plan = PLAN_NAMES[row.tier_id] || row.tier_id;
  const car = oneLine(fields.preferred_makes || fields.vehicle_type || 'car search');
  const phoneDigits = String(row.phone || '').replace(/[^\d+]/g, '');
  const paid = `${money(row.amount_total, row.currency)} on ${centralTime(row.paid_at)}`;
  const stripe = stripeUrl(row);

  const contact = [
    ['Name', row.name],
    ['Email', row.email],
    ['Phone', row.phone],
    ['Lives in', row.city],
    ['Best way to reach', fields.contact_preference]
  ];
  const search = [
    ...SEARCH_FIELDS.map(([key, label]) => [label, display(fields[key])]),
    ...Object.keys(fields).filter(key => !KNOWN_FIELDS.has(key)).map(key => [key, display(fields[key])])
  ];
  const lead = row.lead_id
    ? [row.lead_vehicle, row.lead_message].filter(Boolean).map(oneLine).join(' — ') || 'Saved without details'
    : '';
  const purchase = [
    ['Plan', plan],
    ['Paid', paid],
    ['Intake sent', centralTime(row.created_at)],
    ['Stripe payment', stripe],
    ['Checkout session', row.checkout_session_id],
    ['Checkout started on', row.source_page],
    ['First visit', describeTouch(row.attribution?.first_touch)],
    ['Last visit', describeTouch(row.attribution?.last_touch)],
    ['Earlier inquiry', lead],
    ['Purchase ID', row.purchase_id],
    ['Intake ID', row.onboarding_id]
  ];
  const sections = [['Contact', contact], ['Car search', search], ['Purchase', purchase]]
    .map(([title, rows]) => [title, rows.filter(([, value]) => value != null && String(value).trim() !== '')]);

  const subject = oneLine(`Paid intake: ${row.name} · ${car} · ${plan}`).slice(0, 200);
  const summary = `${row.name} paid ${paid} and filled out the intake. Reply to this email to answer the buyer directly.`;

  // The /car-search skill (.claude/skills/car-search) takes the intake ID.
  const start = `/car-search ${row.onboarding_id}`;
  const text = [
    summary,
    `\nStart the car search in Claude Code (Barton folder):\n${start}`,
    ...sections.map(([title, rows]) => [`\n${title.toUpperCase()}`, ...rows.map(([label, value]) => `${label}: ${value}`)].join('\n'))
  ].join('\n') + '\n';

  const button = (href, label) => `<a href="${escapeHtml(href)}" style="display:inline-block;margin:0 8px 8px 0;padding:8px 14px;border-radius:6px;background:#1f3a5f;color:#ffffff;text-decoration:none;font-weight:600">${escapeHtml(label)}</a>`;
  const actions = [
    phoneDigits && button(`sms:${phoneDigits}`, 'Text'),
    phoneDigits && button(`tel:${phoneDigits}`, 'Call'),
    button(`mailto:${row.email}`, 'Email'),
    stripe && button(stripe, 'Open in Stripe')
  ].filter(Boolean).join('');
  const table = rows => `<table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse">${rows.map(([label, value]) => (
    `<tr><td style="padding:6px 12px 6px 0;vertical-align:top;color:#5b6472;white-space:nowrap">${escapeHtml(label)}</td>`
    + `<td style="padding:6px 0;vertical-align:top;white-space:pre-wrap">${escapeHtml(value)}</td></tr>`
  )).join('')}</table>`;
  const html = `<!doctype html><html><body style="margin:0;padding:24px;background:#f5f6f8;font:15px/1.5 -apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#1d232c">`
    + `<div style="max-width:680px;margin:0 auto;background:#ffffff;border-radius:10px;padding:24px">`
    + `<p style="margin:0 0 16px">${escapeHtml(summary)}</p><div style="margin-bottom:8px">${actions}</div>`
    + `<p style="margin:16px 0 4px;color:#5b6472">Start the car search in Claude Code (Barton folder):</p>`
    + `<p style="margin:0;padding:10px 12px;background:#f5f6f8;border-radius:6px;font:14px/1.4 Consolas,Menlo,monospace">${escapeHtml(start)}</p>`
    + sections.map(([title, rows]) => `<h2 style="margin:24px 0 8px;font-size:16px">${escapeHtml(title)}</h2>${table(rows)}`).join('')
    + `</div></body></html>`;

  return { subject, text, html };
}

async function claimIntakes(sql, onboardingId, { batchSize, maxAttempts, leaseSeconds, retrySeconds }) {
  return sql.begin(async tx => tx`
    WITH eligible AS (
      SELECT outbox.onboarding_id
      FROM intake_email_outbox AS outbox
      WHERE (${onboardingId}::uuid IS NULL OR outbox.onboarding_id = ${onboardingId})
        AND outbox.attempts < ${maxAttempts}
        AND (
          outbox.status = 'pending'
          OR (outbox.status = 'failed' AND (
            outbox.last_attempt_at IS NULL
            OR outbox.last_attempt_at <= now() - LEAST(21600, ${retrySeconds} * power(2, LEAST(10, GREATEST(0, outbox.attempts - 1)))) * interval '1 second'
          ))
          OR (outbox.status = 'processing' AND (
            outbox.last_attempt_at IS NULL
            OR outbox.last_attempt_at <= now() - ${leaseSeconds} * interval '1 second'
          ))
        )
      ORDER BY outbox.created_at, outbox.onboarding_id
      FOR UPDATE OF outbox SKIP LOCKED
      LIMIT ${batchSize}
    ), claimed AS (
      UPDATE intake_email_outbox AS outbox
      SET status = 'processing', attempts = outbox.attempts + 1,
          last_attempt_at = now(), last_error = NULL
      FROM eligible
      WHERE outbox.onboarding_id = eligible.onboarding_id
      RETURNING outbox.onboarding_id, outbox.attempts
    )
    SELECT claimed.onboarding_id, claimed.attempts,
           o.tier_id, o.name, o.email, o.phone, o.city, o.fields, o.created_at,
           p.id AS purchase_id, p.checkout_session_id, p.stripe_payment_intent_id,
           p.amount_total, p.currency, p.livemode, p.paid_at,
           a.source_page, a.attribution, a.lead_id,
           l.vehicle AS lead_vehicle, l.message AS lead_message
    FROM claimed
    JOIN onboarding_submissions AS o ON o.id = claimed.onboarding_id
    JOIN purchases AS p ON p.id = o.purchase_id
    JOIN checkout_attempts AS a ON a.id = p.checkout_attempt_id
    LEFT JOIN leads AS l ON l.id = a.lead_id
  `);
}

export function smtpTransport(settings) {
  return nodemailer.createTransport({
    host: settings.host, port: settings.port, secure: settings.port === 465,
    auth: { user: settings.user, pass: settings.password },
    connectionTimeout: settings.timeoutMs, greetingTimeout: settings.timeoutMs, socketTimeout: settings.timeoutMs
  });
}

async function deliverIntake(sql, row, transport, settings) {
  try {
    const { subject, text, html } = renderIntakeEmail(row);
    await transport.sendMail({
      from: { name: 'Steer Me Right intake', address: settings.user },
      to: settings.to,
      replyTo: { name: oneLine(row.name), address: row.email },
      subject, text, html,
      headers: { 'X-Steer-Intake-Id': row.onboarding_id }
    });
    const updated = await sql`
      UPDATE intake_email_outbox
      SET status = 'sent', sent_at = now(), last_error = NULL
      WHERE onboarding_id = ${row.onboarding_id} AND status = 'processing' AND attempts = ${row.attempts}
      RETURNING onboarding_id
    `;
    return updated.length === 1;
  } catch (error) {
    // SMTP errors can quote the message or credentials; keep only the error code.
    const code = /^[A-Z0-9_]{2,40}$/.test(error?.code || '') ? error.code : 'UNKNOWN';
    await sql`
      UPDATE intake_email_outbox
      SET status = 'failed', last_error = ${`Intake email failed (${code})`}
      WHERE onboarding_id = ${row.onboarding_id} AND status = 'processing' AND attempts = ${row.attempts}
    `;
    console.error('[intake_email_failed]', { onboarding_id: row.onboarding_id, attempt: row.attempts, code });
    return false;
  }
}

export async function dispatchIntakeEmails({ sql, environment = process.env, onboardingId = null, createTransport = smtpTransport } = {}) {
  const settings = intakeEmailSettings(environment);
  if (!settings) return { configured: false, claimed: 0, sent: 0, failed: 0 };
  const client = sql || database();
  const rows = await claimIntakes(client, onboardingId, settings);
  if (rows.length === 0) return { configured: true, claimed: 0, sent: 0, failed: 0 };
  const transport = createTransport(settings);
  try {
    let sent = 0;
    // One SMTP connection, one message at a time: Zoho throttles parallel sends.
    for (const row of rows) if (await deliverIntake(client, row, transport, settings)) sent += 1;
    return { configured: true, claimed: rows.length, sent, failed: rows.length - sent };
  } finally {
    transport.close?.();
  }
}

export async function dispatchIntakeEmailsSafely(options) {
  try { return await dispatchIntakeEmails(options); } catch {
    console.error('[intake_email_dispatch_failed]');
    return { configured: true, claimed: 0, sent: 0, failed: 0, dispatcher_error: true };
  }
}
