#!/usr/bin/env node

import { access, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const primaryOrigin = 'https://www.driverightcarbuying.com';

const containedPosts = [
  'blog-texas-title-transfer.html',
  'blog-texas-car-buying-laws.html',
  'blog-spot-delivery-scam.html',
  'blog-private-party-vs-dealership.html',
];

const confirmationPages = [
  'success.html',
  'payment-success.html',
  'payment-success-consultant.html',
  'payment-success-fullservice.html',
  'payment-success-concierge.html',
];

const containedMetroPages = [
  'arlington.html',
  'austin.html',
  'dallas.html',
  'el-paso.html',
  'fort-worth.html',
  'houston.html',
  'new-braunfels.html',
  'san-antonio.html',
  'san-marcos.html',
];

const stableSchemaIds = {
  organization: `${primaryOrigin}/#organization`,
  consultation: `${primaryOrigin}/#service-consultation`,
  fullService: `${primaryOrigin}/#service-full`,
  concierge: `${primaryOrigin}/#service-concierge`,
};

const requiredStableIds = new Set(Object.values(stableSchemaIds));
const allowedServiceIds = new Set([
  stableSchemaIds.consultation,
  stableSchemaIds.fullService,
  stableSchemaIds.concierge,
]);

const failures = [];

function lineAt(source, index) {
  return source.slice(0, Math.max(0, index)).split('\n').length;
}

function fail(file, message, index, source, hint) {
  failures.push({
    file,
    line: Number.isInteger(index) && source ? lineAt(source, index) : undefined,
    message,
    hint,
  });
}

function decodeEntities(value) {
  const named = {
    amp: '&',
    apos: "'",
    gt: '>',
    lt: '<',
    quot: '"',
    nbsp: ' ',
  };

  return value.replace(/&(#x?[\da-f]+|[a-z]+);/gi, (entity, token) => {
    if (token[0] === '#') {
      const hex = token[1]?.toLowerCase() === 'x';
      const valueText = token.slice(hex ? 2 : 1);
      const codePoint = Number.parseInt(valueText, hex ? 16 : 10);
      return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : entity;
    }
    return named[token.toLowerCase()] ?? entity;
  });
}

function attributeValue(tag, attribute) {
  const escaped = attribute.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = tag.match(
    new RegExp(`\\b${escaped}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'=<>]+))`, 'i'),
  );
  return match ? decodeEntities(match[1] ?? match[2] ?? match[3] ?? '') : undefined;
}

function robotsDirectives(html) {
  const directives = [];
  const tagPattern = /<meta\b[^>]*>/gi;
  let match;
  while ((match = tagPattern.exec(html))) {
    if (attributeValue(match[0], 'name')?.toLowerCase() !== 'robots') continue;
    const content = attributeValue(match[0], 'content') ?? '';
    directives.push({
      content,
      index: match.index,
      tokens: new Set(content.toLowerCase().split(/[\s,]+/).filter(Boolean)),
    });
  }
  return directives;
}

function canonicalLinks(html) {
  const links = [];
  const tagPattern = /<link\b[^>]*>/gi;
  let match;
  while ((match = tagPattern.exec(html))) {
    const rel = (attributeValue(match[0], 'rel') ?? '').toLowerCase().split(/\s+/);
    if (!rel.includes('canonical')) continue;
    links.push({ href: attributeValue(match[0], 'href'), index: match.index });
  }
  return links;
}

function anchorLinks(html) {
  const links = [];
  const anchorPattern = /<a\b[^>]*>/gi;
  let match;
  while ((match = anchorPattern.exec(html))) {
    const href = attributeValue(match[0], 'href');
    if (href !== undefined) links.push({ href, index: match.index });
  }
  return links;
}

function expectedPageUrl(file) {
  return file === 'index.html' ? `${primaryOrigin}/` : `${primaryOrigin}/${file}`;
}

function fileForSiteUrl(url) {
  if (url.origin !== primaryOrigin) return undefined;
  if (url.pathname === '/') return 'index.html';
  let pathname;
  try {
    pathname = decodeURIComponent(url.pathname);
  } catch {
    return undefined;
  }
  if (!/^\/[a-z0-9][a-z0-9._-]*\.html$/i.test(pathname)) return undefined;
  return pathname.slice(1);
}

function allMatches(source, pattern) {
  const regex = pattern.global ? pattern : new RegExp(pattern.source, `${pattern.flags}g`);
  regex.lastIndex = 0;
  const matches = [];
  let match;
  while ((match = regex.exec(source))) {
    matches.push(match);
    if (match[0] === '') regex.lastIndex += 1;
  }
  return matches;
}

function typeList(node) {
  const type = node?.['@type'];
  return (Array.isArray(type) ? type : [type]).filter((item) => typeof item === 'string');
}

function walkJson(value, visitor) {
  if (Array.isArray(value)) {
    for (const item of value) walkJson(item, visitor);
    return;
  }
  if (!value || typeof value !== 'object') return;
  visitor(value);
  for (const child of Object.values(value)) walkJson(child, visitor);
}

function searchTextFromHtml(html) {
  return decodeEntities(
    html.replace(/<[^>]*>/gs, (tag) => tag.replace(/[^\n]/g, ' ')),
  );
}

function compactSnippet(value) {
  return value.replace(/\s+/g, ' ').trim().slice(0, 150);
}

async function fileExists(relativePath) {
  try {
    await access(path.join(repoRoot, relativePath));
    return true;
  } catch {
    return false;
  }
}

const entries = await readdir(repoRoot, { withFileTypes: true });
const rootFiles = entries.filter((entry) => entry.isFile()).map((entry) => entry.name).sort();
const htmlFiles = rootFiles.filter((file) => file.endsWith('.html'));
const publicSourceFiles = rootFiles.filter((file) => /\.(?:html|js|css|xml)$/i.test(file));
const sources = new Map();

let entityRegistry;
let serviceRegistry;
try {
  entityRegistry = JSON.parse(await readFile(path.join(repoRoot, 'data/entities.json'), 'utf8'));
  serviceRegistry = JSON.parse(await readFile(path.join(repoRoot, 'data/services.json'), 'utf8'));
} catch (error) {
  fail('data', `Governed entity/service registry could not be parsed: ${error.message}.`, undefined, undefined, 'Restore valid JSON before release.');
}

await Promise.all(
  publicSourceFiles.map(async (file) => {
    sources.set(file, await readFile(path.join(repoRoot, file), 'utf8'));
  }),
);

for (const requiredFile of [...containedPosts, ...confirmationPages, 'blog.html', 'sitemap.xml']) {
  if (!(await fileExists(requiredFile))) {
    fail(requiredFile, 'Required validation target is missing.', undefined, undefined, 'Restore it or update the validator intentionally.');
  }
}

const sitemap = sources.get('sitemap.xml') ?? '';
const sitemapLocs = [];

if (sitemap) {
  if (!/^\s*<\?xml\b/i.test(sitemap) || !/<urlset\b/i.test(sitemap) || !/<\/urlset\s*>/i.test(sitemap)) {
    fail('sitemap.xml', 'Sitemap is missing its XML declaration or urlset root.', 0, sitemap, 'Emit a complete XML sitemap document.');
  }

  for (const block of allMatches(sitemap, /<url\b[^>]*>([\s\S]*?)<\/url\s*>/gi)) {
    const locMatches = allMatches(block[1], /<loc\b[^>]*>([\s\S]*?)<\/loc\s*>/gi);
    if (locMatches.length !== 1) {
      fail('sitemap.xml', `Each <url> must contain exactly one <loc>; found ${locMatches.length}.`, block.index, sitemap);
    }
  }

  for (const match of allMatches(sitemap, /<loc\b[^>]*>([\s\S]*?)<\/loc\s*>/gi)) {
    const raw = decodeEntities(match[1].trim());
    let url;
    try {
      url = new URL(raw);
    } catch {
      fail('sitemap.xml', `Invalid <loc> URL: ${JSON.stringify(raw)}.`, match.index, sitemap, 'Use an absolute canonical HTTPS URL.');
      continue;
    }
    sitemapLocs.push({ raw, url, index: match.index });
  }
}

const locCounts = new Map();
for (const loc of sitemapLocs) {
  locCounts.set(loc.url.href, (locCounts.get(loc.url.href) ?? 0) + 1);
  if (loc.url.protocol !== 'https:' || loc.url.origin !== primaryOrigin) {
    fail('sitemap.xml', `Non-canonical sitemap origin: ${loc.raw}.`, loc.index, sitemap, `Use ${primaryOrigin}.`);
  }
  if (loc.url.search || loc.url.hash) {
    fail('sitemap.xml', `Sitemap URL contains a query string or fragment: ${loc.raw}.`, loc.index, sitemap, 'List only clean canonical URLs.');
  }
  if (/\/index\.html$/i.test(loc.url.pathname)) {
    fail('sitemap.xml', `Sitemap URL exposes index.html: ${loc.raw}.`, loc.index, sitemap, `Use ${primaryOrigin}/.`);
  }

  const pageFile = fileForSiteUrl(loc.url);
  if (!pageFile || !htmlFiles.includes(pageFile)) {
    fail('sitemap.xml', `Sitemap URL does not map to a root HTML page: ${loc.raw}.`, loc.index, sitemap, 'Remove stale URLs or add the corresponding canonical page.');
    continue;
  }

  const pageHtml = sources.get(pageFile) ?? '';
  const canonicals = canonicalLinks(pageHtml);
  if (canonicals.length !== 1 || canonicals[0].href !== loc.url.href) {
    fail(
      'sitemap.xml',
      `${loc.raw} does not match exactly one canonical link in ${pageFile}.`,
      loc.index,
      sitemap,
      `Set that page canonical to ${loc.url.href}.`,
    );
  }
}

for (const [url, count] of locCounts) {
  if (count > 1) {
    const duplicate = sitemapLocs.find((loc) => loc.url.href === url);
    fail('sitemap.xml', `Duplicate <loc> appears ${count} times: ${url}.`, duplicate?.index, sitemap, 'Keep one entry per canonical URL.');
  }
}

const sitemapFiles = new Set(sitemapLocs.map((loc) => fileForSiteUrl(loc.url)).filter(Boolean));

for (const file of htmlFiles) {
  const html = sources.get(file) ?? '';
  const robots = robotsDirectives(html);
  const noindex = robots.some((entry) => entry.tokens.has('noindex'));
  const expectedUrl = expectedPageUrl(file);
  const canonicals = canonicalLinks(html);

  if (!noindex && !sitemapFiles.has(file)) {
    fail(file, 'Indexable page is missing from sitemap.xml.', 0, html, `Add ${expectedUrl} or intentionally set noindex,follow.`);
  }
  if (noindex && sitemapFiles.has(file)) {
    fail(file, 'Noindex page is present in sitemap.xml.', robots[0]?.index ?? 0, html, 'Remove it from the sitemap.');
  }
  if (!noindex) {
    if (canonicals.length !== 1) {
      fail(file, `Indexable page must have exactly one canonical link; found ${canonicals.length}.`, 0, html, `Use ${expectedUrl}.`);
    } else if (canonicals[0].href !== expectedUrl) {
      fail(file, `Canonical is ${JSON.stringify(canonicals[0].href)}, expected ${expectedUrl}.`, canonicals[0].index, html);
    }

    if (!/<link\b[^>]*\bhref\s*=\s*["'](?:\.\/)?accessibility\.css["'][^>]*>/i.test(html)) {
      fail(file, 'Indexable page is missing the shared accessibility stylesheet.', 0, html, 'Load accessibility.css after the page stylesheet.');
    }
    if (!/<script\b[^>]*\bsrc\s*=\s*["'](?:\.\/)?accessibility\.js["'][^>]*>/i.test(html)) {
      fail(file, 'Indexable page is missing the shared accessibility behavior.', 0, html, 'Load accessibility.js so skip-link and mobile-menu focus are deterministic.');
    }
    if (!/<a\b[^>]*\bclass\s*=\s*["'][^"']*\bskip-link\b[^"']*["'][^>]*\bhref\s*=\s*["']#main-content["'][^>]*>/i.test(html)
        && !/<a\b[^>]*\bhref\s*=\s*["']#main-content["'][^>]*\bclass\s*=\s*["'][^"']*\bskip-link\b[^"']*["'][^>]*>/i.test(html)) {
      fail(file, 'Indexable page is missing a keyboard skip link to #main-content.', 0, html);
    }
    if (!/<main\b(?=[^>]*\bid\s*=\s*["']main-content["'])(?=[^>]*\btabindex\s*=\s*["']-1["'])[^>]*>/i.test(html)) {
      fail(file, 'Indexable page has no #main-content target.', 0, html, 'Give the main element id="main-content" and tabindex="-1".');
    }
    if (!/<noscript>[\s\S]*?\.nav__links[\s\S]*?\.nav__hamburger[\s\S]*?<\/noscript>/i.test(html)) {
      fail(file, 'Indexable page has no usable no-JavaScript mobile navigation override.', 0, html, 'Expose ordinary navigation links and hide the inert hamburger inside a noscript style.');
    }
    if (!/<link\b[^>]*\brel\s*=\s*["']icon["'][^>]*\bhref\s*=\s*["']\/favicon\.png["'][^>]*>/i.test(html)
        && !/<link\b[^>]*\bhref\s*=\s*["']\/favicon\.png["'][^>]*\brel\s*=\s*["']icon["'][^>]*>/i.test(html)) {
      fail(file, 'Indexable page does not reference the stable square /favicon.png.', 0, html);
    }
  }
}

if (!(await fileExists('favicon.png'))) {
  fail('favicon.png', 'Stable favicon is missing.', undefined, undefined, 'Add a square favicon at /favicon.png.');
}

const accessibilityCss = await readFile(path.join(repoRoot, 'accessibility.css'), 'utf8').catch(() => '');
if (!/@media\s*\(prefers-reduced-motion\s*:\s*reduce\)/i.test(accessibilityCss)) {
  fail('accessibility.css', 'Reduced-motion coverage is missing.', 0, accessibilityCss, 'Disable nonessential animation, smooth scrolling, and long transitions for reduced-motion users.');
}

const homepageHtml = sources.get('index.html') ?? '';
const heroWidths = [640, 960, 1440, 1920];
for (const width of heroWidths) {
  for (const format of ['avif', 'webp']) {
    const asset = `assets/external/hero/hero-aerial-car-dealership-ai-${width}.${format}`;
    if (!(await fileExists(asset))) {
      fail(asset, 'Responsive homepage hero derivative is missing.');
    }
    if (!homepageHtml.includes(`/${asset} ${width}w`)) {
      fail('index.html', `Responsive homepage hero srcset is missing ${asset}.`, 0, homepageHtml);
    }
  }
}
if (!/<link\b(?=[^>]*\brel\s*=\s*["']preload["'])(?=[^>]*\bimagesrcset\s*=)(?=[^>]*\bimagesizes\s*=)[^>]*>/i.test(homepageHtml)) {
  fail('index.html', 'Homepage hero preload is not responsive.', 0, homepageHtml, 'Keep imagesrcset and imagesizes aligned with the hero picture sources.');
}
if (!/<source\b(?=[^>]*\btype\s*=\s*["']image\/avif["'])(?=[^>]*\bsrcset\s*=)(?=[^>]*\bsizes\s*=)[^>]*>/i.test(homepageHtml)
    || !/<source\b(?=[^>]*\btype\s*=\s*["']image\/webp["'])(?=[^>]*\bsrcset\s*=)(?=[^>]*\bsizes\s*=)[^>]*>/i.test(homepageHtml)) {
  fail('index.html', 'Homepage hero picture is missing responsive AVIF/WebP sources.', 0, homepageHtml);
}

for (const controlId of ['hero-name', 'hero-email', 'hero-vehicle', 'contact-name', 'contact-email', 'contact-phone', 'contact-message']) {
  const escaped = controlId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (!new RegExp(`<label\\b[^>]*\\bfor\\s*=\\s*["']${escaped}["'][^>]*>`, 'i').test(homepageHtml)) {
    fail('index.html', `Homepage form control #${controlId} has no explicit label.`, 0, homepageHtml);
  }
}

for (const file of [...containedPosts, ...confirmationPages]) {
  const html = sources.get(file);
  if (html === undefined) continue;
  const robots = robotsDirectives(html);
  const valid = robots.length === 1
    && robots[0].tokens.has('noindex')
    && robots[0].tokens.has('follow')
    && !robots[0].tokens.has('nofollow')
    && !robots[0].tokens.has('index');
  if (!valid) {
    fail(
      file,
      `Expected one robots directive with noindex,follow; found ${robots.map((item) => item.content).join(' | ') || 'none'}.`,
      robots[0]?.index ?? 0,
      html,
      'Use <meta name="robots" content="noindex, follow">.',
    );
  }
  if (sitemapFiles.has(file)) {
    fail(file, 'Contained/confirmation page must not appear in sitemap.xml.', 0, html, 'Remove its <url> entry.');
  }
}

const blogHtml = sources.get('blog.html') ?? '';
const blogLinks = anchorLinks(blogHtml);
for (const post of containedPosts) {
  const references = blogLinks.filter(({ href }) => {
    try {
      return fileForSiteUrl(new URL(href, `${primaryOrigin}/blog.html`)) === post;
    } catch {
      return false;
    }
  });
  for (const reference of references) {
    fail('blog.html', `Blog hub links to contained post ${post}.`, reference.index, blogHtml, 'Remove the card/link while the post is contained.');
  }
}

const homepageLinks = anchorLinks(sources.get('index.html') ?? '');
for (const metro of containedMetroPages) {
  const references = homepageLinks.filter(({ href }) => {
    try {
      return fileForSiteUrl(new URL(href, `${primaryOrigin}/`)) === metro;
    } catch {
      return false;
    }
  });
  for (const reference of references) {
    fail('index.html', `Homepage links to contained metro page ${metro}.`, reference.index, sources.get('index.html') ?? '', 'Keep contained metro templates out of sitewide navigation until their evidence gate passes.');
  }
}

for (const file of htmlFiles) {
  const html = sources.get(file) ?? '';

  const gtmLoaders = allMatches(html, /googletagmanager\.com\/gtm\.js(?:\?|["'])/gi);
  if (gtmLoaders.length !== 1) {
    fail(file, `Expected exactly one GTM loader, found ${gtmLoaders.length}.`, gtmLoaders[1]?.index ?? 0, html, 'Load the single approved GTM container once.');
  }

  for (const match of allMatches(html, /<script\b[^>]*\bsrc\s*=\s*["'][^"']*googletagmanager\.com\/gtag\/js\b[^"']*["'][^>]*>/gi)) {
    fail(file, 'Standalone gtag.js loader found.', match.index, html, 'Remove it and deploy GA4/Google Ads through GTM only.');
  }
  for (const match of allMatches(html, /gtag\s*\(\s*["']config["']\s*,\s*["'](?:G-|AW-)[^"']*["']/gi)) {
    fail(file, `Direct GA/Ads gtag config found: ${compactSnippet(match[0])}.`, match.index, html, 'Configure the destination in GTM, not page source.');
  }
  for (const match of allMatches(html, /gtag\s*\(\s*["']event["']\s*,\s*["']conversion["']/gi)) {
    fail(file, 'Hardcoded Google Ads conversion event fires from page source.', match.index, html, 'Trigger the conversion once through GTM after a verified event.');
  }
  for (const match of allMatches(html, /redditstatic\.com\/ads\/pixel\.js|rdt\s*\(\s*["'](?:init|track)["']/gi)) {
    fail(file, `Hardcoded Reddit pixel/conversion snippet found: ${compactSnippet(match[0])}.`, match.index, html, 'Load and trigger Reddit measurement through the consent-aware GTM container.');
  }

  for (const link of anchorLinks(html)) {
    if (/^\s*(?:#|\?)/.test(link.href)) continue;
    let url;
    try {
      url = new URL(link.href, `${primaryOrigin}/${file}`);
    } catch {
      continue;
    }
    if (url.origin === primaryOrigin && /\/index\.html$/i.test(url.pathname)) {
      fail(file, `Internal link exposes index.html: ${link.href}.`, link.index, html, 'Link to / and preserve any intended fragment.');
    }
  }
}

for (const file of publicSourceFiles) {
  const source = sources.get(file) ?? '';
  for (const match of allMatches(source, /https?:\/\/script\.google\.com(?:\/|\b)/gi)) {
    fail(file, 'Direct script.google.com endpoint found.', match.index, source, 'Submit leads to the same-origin /api/leads endpoint.');
  }
  for (const match of allMatches(source, /(?:["']mode["']|\bmode\b)\s*:\s*["']no-cors["']/gi)) {
    fail(file, 'mode: no-cors suppresses response verification.', match.index, source, 'Use same-origin fetch and require an explicit successful JSON response.');
  }

  const imgurMatches = allMatches(source, /(?:https?:\/\/)?(?:i\.)?imgur\.com(?:\/|\b)/gi);
  if (imgurMatches.length) {
    fail(
      file,
      `${imgurMatches.length} Imgur reference${imgurMatches.length === 1 ? '' : 's'} found (first: ${compactSnippet(imgurMatches[0][0])}).`,
      imgurMatches[0].index,
      source,
      'Use a repository-owned asset path under /assets/.',
    );
  }
}

const parsedJsonLd = [];
for (const file of htmlFiles) {
  const html = sources.get(file) ?? '';
  const jsonLdPattern = /<script\b(?=[^>]*\btype\s*=\s*["']application\/ld\+json["'])[^>]*>([\s\S]*?)<\/script\s*>/gi;
  let blockNumber = 0;
  let match;
  while ((match = jsonLdPattern.exec(html))) {
    blockNumber += 1;
    try {
      parsedJsonLd.push({ file, index: match.index, value: JSON.parse(match[1].trim()) });
    } catch (error) {
      fail(file, `JSON-LD block ${blockNumber} does not parse: ${error.message}.`, match.index, html, 'Fix the JSON syntax before deployment.');
    }
  }
}

const observedStableIds = new Set();
const observedNodesById = new Map();
for (const document of parsedJsonLd) {
  const html = sources.get(document.file) ?? '';
  walkJson(document.value, (node) => {
    const id = typeof node['@id'] === 'string' ? node['@id'] : undefined;
    const types = typeList(node);
    if (id) {
      const isTypedStableDefinition = id === stableSchemaIds.organization
        ? types.includes('Organization')
        : types.includes('Service');
      if (requiredStableIds.has(id) && isTypedStableDefinition) {
        observedStableIds.add(id);
        const entriesForId = observedNodesById.get(id) ?? [];
        entriesForId.push({ file: document.file, index: document.index, node });
        observedNodesById.set(id, entriesForId);
      }
      for (const stableId of requiredStableIds) {
        const fragment = stableId.slice(stableId.indexOf('#'));
        if (id.endsWith(fragment) && id !== stableId) {
          fail(document.file, `Unstable schema ID ${id}; expected ${stableId}.`, document.index, html, 'Use the same absolute @id on every page.');
        }
      }
    }

    const isLocalBusiness = types.some((type) => type === 'LocalBusiness' || type === 'AutomotiveBusiness');
    if (types.includes('Organization') && !isLocalBusiness && id !== stableSchemaIds.organization) {
      fail(document.file, `Organization entity must use @id ${stableSchemaIds.organization}; found ${id ?? 'none'}.`, document.index, html);
    }

    if (isLocalBusiness) {
      fail(document.file, 'LocalBusiness markup is not approved for this service-area business.', document.index, html, 'Use the governed Organization as provider and express geography through Service.areaServed.');
    }

    if (types.includes('Review') || types.includes('AggregateRating')) {
      fail(document.file, 'Self-serving Review or AggregateRating markup is not approved.', document.index, html, 'Keep permitted testimonials visible, but do not mark up reviews of Drive Right on Drive Right pages.');
    }

    if (types.includes('Service')) {
      const descriptor = `${node.name ?? ''} ${node.serviceType ?? ''}`.toLowerCase();
      let expectedId;
      if (/concierge/.test(descriptor)) expectedId = stableSchemaIds.concierge;
      else if (/full[\s-]*service/.test(descriptor)) expectedId = stableSchemaIds.fullService;
      else if (/consult(?:ant|ation)|strategy\s+call/.test(descriptor)) expectedId = stableSchemaIds.consultation;

      if (expectedId && id !== expectedId) {
        fail(document.file, `Service tier must use stable @id ${expectedId}; found ${id ?? 'none'}.`, document.index, html);
      }
      if (expectedId) {
        const providerId = node.provider && typeof node.provider === 'object' ? node.provider['@id'] : undefined;
        if (providerId !== stableSchemaIds.organization) {
          fail(document.file, `Service ${expectedId} must reference the stable provider @id; found ${providerId ?? 'none'}.`, document.index, html);
        }
      }
    }
  });
}

for (const id of requiredStableIds) {
  if (!observedStableIds.has(id)) {
    fail('schema', `Required stable schema ID is not present: ${id}.`, undefined, undefined, 'Declare it on the governed Organization or service-tier entity.');
  }
}

function normalizedPhone(value) {
  return typeof value === 'string' ? value.replace(/\D/g, '') : '';
}

const governedOrganization = entityRegistry?.organization;
for (const observed of observedNodesById.get(stableSchemaIds.organization) ?? []) {
  const { file, index, node } = observed;
  const html = sources.get(file) ?? '';
  for (const property of ['name', 'url', 'email']) {
    if (node[property] !== undefined && governedOrganization?.[property] && node[property] !== governedOrganization[property]) {
      fail(file, `Organization.${property} disagrees with data/entities.json.`, index, html, `Use ${JSON.stringify(governedOrganization[property])}.`);
    }
  }
  if (node.telephone !== undefined && governedOrganization?.telephone && normalizedPhone(node.telephone) !== normalizedPhone(governedOrganization.telephone)) {
    fail(file, 'Organization.telephone disagrees with data/entities.json.', index, html, `Use ${governedOrganization.telephone}.`);
  }

  const governedSameAs = Array.isArray(governedOrganization?.sameAs) ? [...governedOrganization.sameAs].sort() : [];
  const renderedSameAs = Array.isArray(node.sameAs) ? [...node.sameAs].sort() : node.sameAs ? [node.sameAs] : [];
  const sameAsApproved = governedOrganization?.sameAsStatus === 'approved';
  if ((!sameAsApproved && renderedSameAs.length) || (node.sameAs !== undefined && sameAsApproved && JSON.stringify(renderedSameAs) !== JSON.stringify(governedSameAs))) {
    fail(file, 'Organization.sameAs exposes URLs that are not approved in data/entities.json.', index, html, 'Approve the exact official URLs in the registry before rendering them.');
  }
}

const serviceIdsByRegistry = new Map((serviceRegistry?.services ?? []).map((service) => [service.id, service]));
const serviceTargets = new Map([
  [stableSchemaIds.consultation, `${primaryOrigin}/schedule.html#consultation`],
  [stableSchemaIds.fullService, `${primaryOrigin}/schedule.html#full-service`],
  [stableSchemaIds.concierge, `${primaryOrigin}/schedule.html#concierge`],
]);

for (const [id, governedService] of serviceIdsByRegistry) {
  for (const observed of observedNodesById.get(id) ?? []) {
    const { file, index, node } = observed;
    const html = sources.get(file) ?? '';
    const target = serviceTargets.get(id);
    if (target && node.url !== target) {
      fail(file, `Service ${id} has URL ${JSON.stringify(node.url)}, expected ${target}.`, index, html);
    }
    const offers = Array.isArray(node.offers) ? node.offers : node.offers ? [node.offers] : [];
    for (const offer of offers) {
      if (Number(offer.price) !== Number(governedService.price) || offer.priceCurrency !== serviceRegistry.currency) {
        fail(file, `Service ${id} offer disagrees with data/services.json.`, index, html, `Use ${governedService.price} ${serviceRegistry.currency}.`);
      }
      if (target && offer.url !== target) {
        fail(file, `Service ${id} offer URL does not resolve to its governed pricing card.`, index, html, `Use ${target}.`);
      }
    }
  }
}

for (const document of parsedJsonLd) {
  const html = sources.get(document.file) ?? '';
  walkJson(document.value, (node) => {
    for (const candidate of [node.url, node.offers?.url]) {
      if (typeof candidate !== 'string') continue;
      let url;
      try {
        url = new URL(candidate);
      } catch {
        continue;
      }
      if (url.origin !== primaryOrigin || !url.hash) continue;
      const targetFile = fileForSiteUrl(url);
      const targetHtml = targetFile ? sources.get(targetFile) : undefined;
      const fragment = decodeURIComponent(url.hash.slice(1));
      const escaped = fragment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      if (!targetHtml || !new RegExp(`\\bid\\s*=\\s*["']${escaped}["']`, 'i').test(targetHtml)) {
        fail(document.file, `Structured-data URL fragment does not resolve: ${candidate}.`, document.index, html, 'Add the matching pricing-card ID or correct the URL.');
      }
    }
  });
}

const claimRules = [
  {
    label: '12+ hours claim',
    pattern: /\b12\s*(?:\+|plus)\s*(?:hours?|hrs?)\b/gi,
  },
  {
    label: 'absolute best price claim',
    pattern: /\babsolute\s+best\s+price\b/gi,
  },
  {
    label: 'savings guarantee claim',
    pattern: /\bsavings?\s+guarantee(?:d)?\b/gi,
  },
  {
    label: 'unsupported “hundreds” business-volume claim',
    pattern: /\b(?:help(?:ed|ing)?|serv(?:ed|ing)|assist(?:ed|ing)?|negotiate(?:d|s|ing)?|relationships?\s+span)\s+hundreds\b|\bhundreds\s+of\s+(?:texas\s+)?(?:buyers?|clients?|customers?|famil(?:y|ies)|consultations?|franchises?)\b/gi,
  },
  {
    label: '$5k/$7k savings testimonial',
    pattern: /(?:\bsav(?:e|ed|ing|ings)\b|\btestimonial\b|\breview\b|\bclient\b|\bcustomer\b)[\s\S]{0,140}?\$\s*(?:5,?000|7,?000|[57]k)\b|\$\s*(?:5,?000|7,?000|[57]k)\b[\s\S]{0,140}?(?:\bsav(?:e|ed|ing|ings)\b|\btestimonial\b|\breview\b|\bclient\b|\bcustomer\b)/gi,
  },
];

for (const file of htmlFiles) {
  const html = sources.get(file) ?? '';
  const text = searchTextFromHtml(html);
  const claimSurfaces = [html, text];

  for (const rule of claimRules) {
    const reportedLines = new Set();
    for (const surface of claimSurfaces) {
      for (const match of allMatches(surface, rule.pattern)) {
        const line = lineAt(surface, match.index);
        if (reportedLines.has(line)) continue;
        reportedLines.add(line);
        fail(file, `Unsupported high-priority claim (${rule.label}): ${JSON.stringify(compactSnippet(match[0]))}.`, match.index, surface, 'Remove it or replace it with a substantiated, approved statement.');
      }
    }
  }

  const reportedSavingsLines = new Set();
  for (const surface of claimSurfaces) {
    for (const match of allMatches(surface, /\$\s*2,?400\+?/gi)) {
      const context = surface.slice(Math.max(0, match.index - 180), match.index + match[0].length + 180);
      const line = lineAt(surface, match.index);
      if (reportedSavingsLines.has(line)) continue;
      if (/average\s+savings|avg\.?\s+savings|clients?\s+(?:save|saved)|(?:save|saved|savings)[\s\S]{0,80}(?:car|vehicle|purchase)|drive\s+right/i.test(context)) {
        reportedSavingsLines.add(line);
        fail(file, `Unsupported $2,400 savings claim: ${JSON.stringify(compactSnippet(context))}.`, match.index, surface, 'Remove it or substantiate and approve the calculation before publishing.');
      }
    }
  }
}

failures.sort((left, right) => {
  const fileOrder = left.file.localeCompare(right.file);
  if (fileOrder) return fileOrder;
  return (left.line ?? 0) - (right.line ?? 0) || left.message.localeCompare(right.message);
});

if (failures.length) {
  console.error(`Site validation failed with ${failures.length} actionable issue${failures.length === 1 ? '' : 's'}:\n`);
  for (const issue of failures) {
    const location = issue.line ? `${issue.file}:${issue.line}` : issue.file;
    console.error(`✖ ${location} — ${issue.message}`);
    if (issue.hint) console.error(`  Fix: ${issue.hint}`);
  }
  process.exitCode = 1;
} else {
  console.log(`Site validation passed: ${htmlFiles.length} HTML files and ${sitemapLocs.length} sitemap URLs checked.`);
}
