import { allowedOrigins } from './config.js';
import { HttpError } from './http.js';

export async function verifyTurnstile(token) {
  const secret = process.env.TURNSTILE_SECRET_KEY?.trim();
  if (!secret) return false;
  if (!token) throw new HttpError(422, 'turnstile_required', 'A Turnstile token is required');

  const form = new URLSearchParams({ secret, response: token });
  let response;
  try {
    response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form,
      redirect: 'error',
      signal: AbortSignal.timeout(5000)
    });
  } catch {
    throw new HttpError(503, 'turnstile_unavailable', 'Turnstile verification is unavailable');
  }

  if (!response.ok) throw new HttpError(503, 'turnstile_unavailable', 'Turnstile verification is unavailable');
  const result = await response.json();
  if (!result.success) throw new HttpError(422, 'turnstile_failed', 'Turnstile verification failed');

  const expectedHosts = new Set([...allowedOrigins()].map((origin) => new URL(origin).hostname));
  if (result.hostname && !expectedHosts.has(result.hostname)) {
    throw new HttpError(422, 'turnstile_failed', 'Turnstile verification failed');
  }
  return true;
}
