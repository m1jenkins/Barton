#!/usr/bin/env node

const permanentStatuses = new Set([301, 308]);
const failures = [];
const timeoutMs = Number(process.env.REDIRECT_TIMEOUT_MS ?? 15_000);

function usageError(message) {
  console.error(`Configuration error: ${message}`);
  console.error('Usage: BASE_URL=https://www.driverightcarbuying.com LEGACY_BASE_URL=https://www.austincarbuyingservice.com node scripts/check-redirects.mjs');
  process.exit(2);
}

function parseBase(name) {
  const raw = process.env[name];
  if (!raw) usageError(`${name} is required.`);

  let url;
  try {
    url = new URL(raw);
  } catch {
    usageError(`${name} must be an absolute URL; received ${JSON.stringify(raw)}.`);
  }

  if (!['http:', 'https:'].includes(url.protocol)) usageError(`${name} must use HTTP or HTTPS.`);
  if (url.username || url.password) usageError(`${name} must not contain credentials.`);
  if (url.pathname !== '/' || url.search || url.hash) usageError(`${name} must contain only an origin (no path, query, or fragment).`);
  url.pathname = '/';
  return url;
}

function buildUrl(base, pathname, query) {
  const url = new URL(base.href);
  url.pathname = pathname;
  url.search = query;
  url.hash = '';
  return url;
}

const base = parseBase('BASE_URL');
const legacy = parseBase('LEGACY_BASE_URL');

if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) usageError('REDIRECT_TIMEOUT_MS must be a positive number when provided.');
if (base.origin === legacy.origin) usageError('BASE_URL and LEGACY_BASE_URL must use different origins.');

const query = 'utm_source=redirect-validator&utm_campaign=query-preservation&seo_redirect_probe=keep%2Bme';
const cases = [];

const httpSource = buildUrl(base, '/about.html', query);
httpSource.protocol = 'http:';
cases.push({
  name: 'HTTP to canonical HTTPS',
  source: httpSource,
  target: buildUrl(base, '/about.html', query),
});

if (!base.hostname.includes(':') && base.hostname !== 'localhost' && !/^\d+(?:\.\d+){3}$/.test(base.hostname)) {
  const alternateHost = base.hostname.startsWith('www.') ? base.hostname.slice(4) : `www.${base.hostname}`;
  const alternateSource = buildUrl(base, '/about.html', query);
  alternateSource.hostname = alternateHost;
  cases.push({
    name: 'Apex/www host canonicalization',
    source: alternateSource,
    target: buildUrl(base, '/about.html', query),
  });
}

cases.push(
  {
    name: 'index.html canonicalization',
    source: buildUrl(base, '/index.html', query),
    target: buildUrl(base, '/', query),
  },
  {
    name: 'Malformed .html/ canonicalization',
    source: buildUrl(base, '/about.html/', query),
    target: buildUrl(base, '/about.html', query),
  },
  {
    name: 'Legacy-domain migration',
    source: buildUrl(legacy, '/about.html', query),
    target: buildUrl(base, '/about.html', query),
  },
  {
    name: 'Legacy inquiry route',
    source: buildUrl(base, '/inquiry.html', query),
    target: buildUrl(base, '/schedule.html', query),
  },
);

async function request(url) {
  return fetch(url, {
    method: 'GET',
    redirect: 'manual',
    headers: {
      accept: 'text/html,application/xhtml+xml',
      'user-agent': 'DriveRightRedirectValidator/1.0',
    },
    signal: AbortSignal.timeout(timeoutMs),
  });
}

async function checkRedirect(testCase) {
  let response;
  try {
    response = await request(testCase.source);
  } catch (error) {
    failures.push(`${testCase.name}: request failed for ${testCase.source.href}: ${error.message}`);
    return;
  }

  if (!permanentStatuses.has(response.status)) {
    failures.push(`${testCase.name}: expected status 301 or 308 from ${testCase.source.href}, received ${response.status}.`);
    return;
  }

  const location = response.headers.get('location');
  if (!location) {
    failures.push(`${testCase.name}: ${response.status} response from ${testCase.source.href} has no Location header.`);
    return;
  }

  let resolvedLocation;
  try {
    resolvedLocation = new URL(location, testCase.source);
  } catch {
    failures.push(`${testCase.name}: invalid Location header ${JSON.stringify(location)} from ${testCase.source.href}.`);
    return;
  }

  if (resolvedLocation.href !== testCase.target.href) {
    failures.push(
      `${testCase.name}: expected Location ${testCase.target.href}, received ${resolvedLocation.href}. `
      + 'The canonical redirect must preserve the complete query string in one hop.',
    );
    return;
  }

  let targetResponse;
  try {
    targetResponse = await request(testCase.target);
  } catch (error) {
    failures.push(`${testCase.name}: canonical target request failed for ${testCase.target.href}: ${error.message}`);
    return;
  }

  if (targetResponse.status < 200 || targetResponse.status >= 300) {
    const extraLocation = targetResponse.headers.get('location');
    failures.push(
      `${testCase.name}: canonical target ${testCase.target.href} returned ${targetResponse.status}`
      + `${extraLocation ? ` with another redirect to ${new URL(extraLocation, testCase.target).href}` : ''}; expected a terminal 2xx response.`,
    );
    return;
  }

  console.log(`✓ ${testCase.name}: ${response.status} ${testCase.source.href} → ${testCase.target.href}`);
}

await Promise.all(cases.map(checkRedirect));

if (failures.length) {
  console.error(`\nRedirect validation failed with ${failures.length} issue${failures.length === 1 ? '' : 's'}:`);
  for (const failure of failures) console.error(`✖ ${failure}`);
  process.exitCode = 1;
} else {
  console.log(`\nRedirect validation passed: ${cases.length} permanent, query-preserving one-hop redirects checked.`);
}
