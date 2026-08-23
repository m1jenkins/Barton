#!/usr/bin/env node

import { readFile } from 'node:fs/promises';

const permanentStatuses = new Set([301, 308]);
const failures = [];
const timeoutMs = Number(process.env.REDIRECT_TIMEOUT_MS ?? 15_000);
const configOnly = process.argv.includes('--config-only');

const requiredRedirects = [
  {
    name: 'legacy apex domain',
    source: '/:path*',
    host: 'austincarbuyingservice.com',
    destination: 'https://www.driverightcarbuying.com/:path*',
  },
  {
    name: 'legacy www domain',
    source: '/:path*',
    host: 'www.austincarbuyingservice.com',
    destination: 'https://www.driverightcarbuying.com/:path*',
  },
  {
    name: 'canonical apex domain',
    source: '/:path*',
    host: 'driverightcarbuying.com',
    destination: 'https://www.driverightcarbuying.com/:path*',
  },
  { name: 'index.html', source: '/index.html', destination: '/' },
  { name: 'legacy inquiry route', source: '/inquiry.html', destination: '/schedule.html' },
  {
    name: 'legacy dealer add-ons route',
    source: '/blog-dealer-addons-exposed.html',
    destination: '/blog-dealership-addons-complete-guide.html',
  },
  { name: 'legacy ROI route', source: '/blog-roi-car-buying-service.html', destination: '/how-it-works.html' },
  { name: 'legacy flat-fee route', source: '/blog-flat-fees-vs-commissions.html', destination: '/how-it-works.html' },
  { name: 'legacy kickbacks route', source: '/blog-zero-kickbacks-promise.html', destination: '/how-it-works.html' },
  { name: 'legacy dealership-marathon route', source: '/blog-skip-dealership-marathon.html', destination: '/how-it-works.html' },
];

function usageError(message) {
  console.error(`Configuration error: ${message}`);
  console.error('Usage: BASE_URL=https://www.driverightcarbuying.com LEGACY_BASE_URL=https://www.austincarbuyingservice.com node scripts/check-redirects.mjs');
  console.error('       node scripts/check-redirects.mjs --config-only');
  process.exit(2);
}

function redirectHost(rule) {
  return rule.has?.find((condition) => condition.type === 'host')?.value;
}

async function checkLocalConfig() {
  let config;
  try {
    config = JSON.parse(await readFile(new URL('../vercel.json', import.meta.url), 'utf8'));
  } catch (error) {
    failures.push(`Local redirect config: could not read vercel.json: ${error.message}`);
    return;
  }

  if (!Array.isArray(config.redirects)) {
    failures.push('Local redirect config: vercel.json must contain a redirects array.');
    return;
  }

  for (const expected of requiredRedirects) {
    const match = config.redirects.find((rule) => (
      rule.source === expected.source
      && rule.destination === expected.destination
      && redirectHost(rule) === expected.host
    ));

    if (!match) {
      failures.push(
        `Local redirect config: missing ${expected.name} redirect ${expected.source} → ${expected.destination}`
        + `${expected.host ? ` for host ${expected.host}` : ''}.`,
      );
    } else if (match.permanent !== true) {
      failures.push(`Local redirect config: ${expected.name} must set permanent: true so Vercel emits HTTP 308.`);
    }
  }
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

await checkLocalConfig();

if (configOnly) {
  if (failures.length) {
    console.error(`Redirect configuration validation failed with ${failures.length} issue${failures.length === 1 ? '' : 's'}:`);
    for (const failure of failures) console.error(`✖ ${failure}`);
    process.exitCode = 1;
  } else {
    console.log(`✓ Redirect configuration retains ${requiredRedirects.length} permanent redirects, including apex and legacy routes.`);
  }
  process.exit();
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
    statuses: new Set([308]),
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
  {
    name: 'Legacy dealer add-ons route',
    source: buildUrl(base, '/blog-dealer-addons-exposed.html', query),
    target: buildUrl(base, '/blog-dealership-addons-complete-guide.html', query),
  },
  {
    name: 'Legacy ROI route',
    source: buildUrl(base, '/blog-roi-car-buying-service.html', query),
    target: buildUrl(base, '/how-it-works.html', query),
  },
  {
    name: 'Legacy flat-fee route',
    source: buildUrl(base, '/blog-flat-fees-vs-commissions.html', query),
    target: buildUrl(base, '/how-it-works.html', query),
  },
  {
    name: 'Legacy kickbacks route',
    source: buildUrl(base, '/blog-zero-kickbacks-promise.html', query),
    target: buildUrl(base, '/how-it-works.html', query),
  },
  {
    name: 'Legacy dealership-marathon route',
    source: buildUrl(base, '/blog-skip-dealership-marathon.html', query),
    target: buildUrl(base, '/how-it-works.html', query),
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

  const acceptedStatuses = testCase.statuses ?? permanentStatuses;
  if (!acceptedStatuses.has(response.status)) {
    failures.push(
      `${testCase.name}: expected status ${[...acceptedStatuses].join(' or ')} from ${testCase.source.href}, received ${response.status}.`,
    );
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
