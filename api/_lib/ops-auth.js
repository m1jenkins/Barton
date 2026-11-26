import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { ConfigError } from './config.js';
import { escapeHtml, intakeEmailSettings, smtpTransport } from './intake-email.js';

// Passwordless sign-in for Mason's private /api/ops dashboard:
//   - Email magic link (10-minute stateless HMAC token sent to OPS_ALERT_EMAIL / INTAKE_EMAIL_TO)
//   - 30-day HttpOnly SameSite=Lax signed session cookie scoped to /api/ops
//   - Optional password fallback using OPS_PASSWORD (which also signs tokens/cookies)
// Rotating OPS_PASSWORD in Vercel immediately invalidates all sessions and pending links.
export const SESSION_COOKIE = 'ops_session';
export const SESSION_SECONDS = 30 * 86400;
export const MAGIC_LINK_SECONDS = 10 * 60;
export const CHALLENGE_SECONDS = 15 * 60;
export const SEND_COOLDOWN_MS = 60 * 1000;

const DEFAULT_ORIGIN = 'https://www.steermeright.com';
const EMAIL_PATTERN = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const digest = value => createHash('sha256').update(String(value ?? '')).digest();
const same = (a, b) => timingSafeEqual(digest(a), digest(b));
const sign = (secret, purpose, payload) => createHmac('sha256', secret).update(`${purpose}:${payload}`).digest('base64url');

export function normalizeDealId(value) {
  const id = String(value ?? '').trim().toLowerCase();
  return UUID.test(id) ? id : null;
}

export function nextLocation(dealId) {
  const clean = normalizeDealId(dealId);
  return clean ? `/api/ops?deal=${clean}` : '/api/ops';
}

export function passwordMatches(input, password) {
  return typeof input === 'string' && input.length > 0 && same(input, password);
}

export function parseCookie(cookieHeader, name) {
  if (typeof cookieHeader !== 'string' || !cookieHeader) return null;
  for (const part of cookieHeader.split(';')) {
    const eq = part.indexOf('=');
    if (eq < 0) continue;
    if (part.slice(0, eq).trim() === name) return part.slice(eq + 1).trim();
  }
  return null;
}

export function createSessionToken(secret, now = Date.now()) {
  const exp = Math.floor(now / 1000) + SESSION_SECONDS;
  return `s1.${exp}.${sign(secret, 'ops-session-v1', String(exp))}`;
}

export function verifySessionToken(token, secret, now = Date.now()) {
  const match = /^s1\.(\d{10,12})\.([A-Za-z0-9_-]{43})$/.exec(String(token ?? ''));
  if (!match) return false;
  const exp = Number(match[1]);
  const nowSec = Math.floor(now / 1000);
  if (exp <= nowSec || exp > nowSec + SESSION_SECONDS + 60) return false;
  return same(match[2], sign(secret, 'ops-session-v1', match[1]));
}

export function isSessionAuthorized(cookieHeader, secret, now = Date.now()) {
  const token = parseCookie(cookieHeader, SESSION_COOKIE);
  return token ? verifySessionToken(token, secret, now) : false;
}

export function sessionCookieHeader(token, { secure = true } = {}) {
  return `${SESSION_COOKIE}=${token}; Path=/api/ops; Max-Age=${SESSION_SECONDS}; HttpOnly; SameSite=Lax${secure ? '; Secure' : ''}`;
}

export function clearSessionCookieHeader({ secure = true } = {}) {
  return `${SESSION_COOKIE}=; Path=/api/ops; Max-Age=0; HttpOnly; SameSite=Lax${secure ? '; Secure' : ''}`;
}

export function createMagicToken(secret, { dealId = null, now = Date.now() } = {}) {
  const exp = Math.floor(now / 1000) + MAGIC_LINK_SECONDS;
  const deal = normalizeDealId(dealId) ?? '';
  return `m1.${exp}.${deal}.${sign(secret, 'ops-magic-v1', `${exp}:${deal}`)}`;
}

export function verifyMagicToken(token, secret, now = Date.now()) {
  const match = /^m1\.(\d{10,12})\.([0-9a-f-]*)\.([A-Za-z0-9_-]{43})$/.exec(String(token ?? ''));
  if (!match) return { ok: false, dealId: null };
  const exp = Number(match[1]);
  const deal = match[2];
  if (deal && !UUID.test(deal)) return { ok: false, dealId: null };
  const nowSec = Math.floor(now / 1000);
  if (exp <= nowSec || exp > nowSec + MAGIC_LINK_SECONDS + 60) return { ok: false, dealId: null };
  if (!same(match[3], sign(secret, 'ops-magic-v1', `${match[1]}:${deal}`))) return { ok: false, dealId: null };
  return { ok: true, dealId: deal || null };
}

export function createChallengeToken(secret, now = Date.now()) {
  const exp = Math.floor(now / 1000) + CHALLENGE_SECONDS;
  return `c1.${exp}.${sign(secret, 'ops-challenge-v1', String(exp))}`;
}

export function verifyChallengeToken(token, secret, now = Date.now()) {
  const match = /^c1\.(\d{10,12})\.([A-Za-z0-9_-]{43})$/.exec(String(token ?? ''));
  if (!match) return false;
  const exp = Number(match[1]);
  const nowSec = Math.floor(now / 1000);
  if (exp <= nowSec || exp > nowSec + CHALLENGE_SECONDS + 60) return false;
  return same(match[2], sign(secret, 'ops-challenge-v1', match[1]));
}

export function magicLinkSettings(environment = process.env) {
  const smtp = intakeEmailSettings(environment);
  if (!smtp) return null;
  const to = environment.OPS_ALERT_EMAIL?.trim() || smtp.to;
  if (!EMAIL_PATTERN.test(to)) throw new ConfigError('OPS_ALERT_EMAIL must be an email address');
  const origin = (environment.APP_ORIGIN?.trim() || DEFAULT_ORIGIN).replace(/\/+$/, '');
  return { ...smtp, to, origin };
}

export function renderMagicLinkEmail(url) {
  const text = [
    'Use this link to sign in to the Steer Me Right ops dashboard:',
    '',
    url,
    '',
    'It expires in 10 minutes and keeps this browser signed in for 30 days.',
    'If you did not ask for this link, you can ignore this email.'
  ].join('\n');
  const html = `<div style="font:15px/1.5 -apple-system,'Segoe UI',Arial,sans-serif;color:#1b1d1f;max-width:560px">
<p style="margin:0 0 16px">Use the button below to sign in to the Steer Me Right ops dashboard.</p>
<p style="margin:0 0 18px"><a href="${escapeHtml(url)}" style="display:inline-block;background:#1f5fbf;color:#fff;text-decoration:none;font-weight:600;padding:10px 18px;border-radius:8px">Sign in to ops dashboard</a></p>
<p style="margin:0 0 10px;color:#6a6f75;font-size:13px">This link expires in 10 minutes and keeps your browser signed in for 30 days. If you didn't ask for it, you can ignore this email.</p>
<p style="margin:0;color:#6a6f75;font-size:12px;word-break:break-all">${escapeHtml(url)}</p>
</div>`;
  return { subject: 'Sign in to Steer Me Right ops', text, html };
}

export async function sendMagicLinkEmail({ settings, token, createTransport = smtpTransport }) {
  const url = `${settings.origin}/api/ops?login=${encodeURIComponent(token)}`;
  const { subject, text, html } = renderMagicLinkEmail(url);
  const transport = createTransport(settings);
  try {
    await transport.sendMail({
      from: { name: 'Steer Me Right ops', address: settings.user },
      to: settings.to,
      subject, text, html
    });
    return { ok: true, url };
  } catch (error) {
    const code = /^[A-Z0-9_]{2,40}$/.test(error?.code || '') ? error.code : 'UNKNOWN';
    console.error('[ops_magic_link_failed]', { code });
    return { ok: false, code };
  } finally {
    transport.close?.();
  }
}
