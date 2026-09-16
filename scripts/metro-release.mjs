import { readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { parse } from 'parse5';

export const origin = 'https://www.driverightcarbuying.com';
export const sha256 = value => createHash('sha256').update(value).digest('hex');
export function csvRows(text) {
  const rows = []; let row = [], cell = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') { if (quoted && text[i + 1] === '"') { cell += '"'; i++; } else quoted = !quoted; }
    else if (!quoted && (c === ',' || c === '\n')) {
      row.push(cell.replace(/\r$/, '')); cell = '';
      if (c === '\n') { rows.push(row); row = []; }
    } else cell += c;
  }
  if (quoted) throw new Error('Unclosed CSV quotation');
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const headers = rows.shift();
  return rows.filter(r => r.some(Boolean)).map(r => {
    if (r.length !== headers.length) throw new Error('CSV column count mismatch');
    return Object.fromEntries(headers.map((key, i) => [key, r[i]]));
  });
}
export function htmlDocument(html) {
  const nodes = []; const visit = n => { nodes.push(n); for (const c of n.childNodes ?? []) visit(c); };
  visit(parse(html));
  const attr = (n, key) => n.attrs?.find(a => a.name === key)?.value;
  const text = n => n.nodeName === '#text' ? n.value : (n.childNodes ?? []).map(text).join('');
  const tags = name => nodes.filter(n => n.tagName === name);
  const directives = tags('meta').filter(n => ['robots', 'googlebot'].includes(attr(n, 'name')?.toLowerCase())).flatMap(n => (attr(n, 'content') ?? '').toLowerCase().split(/[\s,]+/));
  return {
    noindex: directives.includes('noindex') || directives.includes('none'),
    conflictingRobots: directives.includes('index') && (directives.includes('noindex') || directives.includes('none')),
    canonical: tags('link').filter(n => attr(n, 'rel')?.split(/\s+/).includes('canonical')).map(n => attr(n, 'href')),
    links: tags('a').map(n => attr(n, 'href')).filter(Boolean),
    h1: tags('h1').map(text),
    visibleText: nodes.filter(n => n.nodeName === '#text' && !['script', 'style'].includes(n.parentNode?.tagName)).map(n => n.value).join(' ').replace(/\s+/g, ' '),
    schemas: tags('script').filter(n => attr(n, 'type') === 'application/ld+json').map(n => JSON.parse(text(n))),
    markers: tags('meta').filter(n => attr(n, 'name') === 'barton-metro-id').map(n => attr(n, 'content')),
  };
}
const present = value => typeof value === 'string' && value.trim().length > 0 && !/^(pending|unknown|tbd)$/i.test(value);
const date = value => /^\d{4}-\d{2}-\d{2}$/.test(value ?? '') && new Date(value).toISOString().slice(0, 10) === value;
function currentReview(review, today) {
  return review?.status === 'approved' && present(review.reviewer) && present(review.evidenceRef)
    && date(review.reviewedOn) && review.reviewedOn <= today && date(review.expiresOn) && review.expiresOn > today;
}
export function releaseReasons(market, context) {
  const { registry, claims, sources, dossiers, today } = context;
  const reasons = [];
  if (market.releaseStatus !== 'approved') reasons.push('release status is not approved');
  if (market.availabilityRef !== registry.ownerConfirmation?.id || (!date(registry.ownerConfirmation?.date) || registry.ownerConfirmation.date > today)) reasons.push('owner coverage/sign-off missing');
  for (const key of ['serviceBoundary', 'sellerLimits', 'pickupDeliveryLimits', 'responseCapacity', 'primaryQuery']) {
    if (!present(market[key])) reasons.push(`${key} missing`);
  }
  for (const key of ['baseline', 'demandEvidence', 'logisticsEvidence', 'checkoutParity', 'editorialReview', 'qa']) {
    if (!currentReview(market[key], today)) reasons.push(`${key} evidence/review missing or expired`);
  }
  if (!currentReview(market.qualifiedReview, today) || !present(market.qualifiedReview?.qualification)) reasons.push('qualified review missing or expired');
  if (!date(market.serp?.observedOn) || market.serp.observedOn > today || !market.serp?.location || market.serp?.competitors?.length !== 5) reasons.push('dated five-competitor search record missing');
  const dossier = dossiers.find(d => d.marketId === market.id);
  if (!dossier || dossier.modules?.length < 2 || !['worksheet', 'permissioned_case'].includes(dossier.example?.type)) reasons.push('two local modules and example/worksheet missing');
  if (!market.claimIds?.length || !market.sourceIds?.length) reasons.push('claim/source mapping missing');
  for (const id of market.claimIds ?? []) {
    const claim = claims.find(c => c.claim_id === id);
    if (!claim || claim.status !== 'approved' || !present(claim.approved_copy) || !present(claim.reviewer)
      || !date(claim.last_reviewed) || claim.last_reviewed > today || !date(claim.expires_on) || claim.expires_on <= today) reasons.push(`${id}: claim pending, expired, revoked or incomplete`);
  }
  for (const id of market.sourceIds ?? []) {
    const source = sources.find(s => s.source_id === id);
    if (!source || source.verification_status !== 'approved' || !present(source.reviewer) || !present(source.source_url)
      || !date(source.next_review) || source.next_review <= today) reasons.push(`${id}: source review missing or expired`);
  }
  for (const module of dossier?.modules ?? []) {
    if (!module.claimIds?.length || !module.sourceIds?.length || !module.claimIds.every(id => market.claimIds?.includes(id))
      || !module.sourceIds.every(id => market.sourceIds?.includes(id))) reasons.push('local module lacks mapped claim/source');
  }
  return reasons;
}
export async function validateMetroRelease(root, { today = new Date().toISOString().slice(0, 10) } = {}) {
  const errors = [];
  const fail = message => errors.push(message);
  try {
    const read = file => readFile(path.join(root, file), 'utf8');
    const [registry, entities, services, dossiers] = await Promise.all(['data/metro-release.json', 'data/entities.json', 'data/services.json', 'data/metro-dossiers.json'].map(async f => JSON.parse(await read(f))));
    const [claims, sources, inventory] = await Promise.all(['data/claims.csv', 'data/source-registry.csv', 'data/content-inventory.csv'].map(async f => csvRows(await read(f))));
    const context = { registry, claims, sources, dossiers, today };
    if (!Array.isArray(registry.markets) || !registry.markets.length || !Array.isArray(registry.legacyTexas)) throw new Error('Missing metro records');
    const ids = new Set(), slugs = new Set();
    for (const m of registry.markets) {
      if (!/^[a-z0-9-]+\.html$/.test(m.slug) || ids.has(m.id) || slugs.has(m.slug)) fail(`Invalid/duplicate metro ID or slug: ${m.id}`);
      ids.add(m.id); slugs.add(m.slug);
      if (!['draft', 'approved', 'revoked'].includes(m.releaseStatus)) fail(`${m.id}: unknown release status`);
      if (!m.tierIds?.length || !m.tierIds.every(id => services.services.some(s => s.id === id))) fail(`${m.id}: unknown/missing service tiers`);
      if (!inventory.some(row => row.canonical_url === `${origin}/${m.slug}`)) fail(`${m.id}: missing content inventory`);
    }
    const ignore = (await read('.vercelignore')).split(/\r?\n/).map(s => s.trim()).filter(s => s && !s.startsWith('#'));
    // Exact directory exclusions are intentional. Re-inclusion rules could expose nested draft material.
    for (const entry of ['draft-artifacts', 'docs', 'data', 'scripts', 'AGENTS.md', 'CLAUDE.md']) if (!ignore.includes(entry)) fail(`.vercelignore must exclude ${entry}`);
    if (ignore.some(line => line.startsWith('!'))) fail('.vercelignore re-inclusion rules require containment review');
    const sitemap = await read('sitemap.xml');
    const sitemapUrls = [...sitemap.matchAll(/<loc>\s*([^<]+)\s*<\/loc>/g)].map(m => m[1]);
    const publicHtml = new Map();
    async function scan(directory = '') {
      for (const entry of await readdir(path.join(root, directory), { withFileTypes: true })) {
        const relative = path.posix.join(directory, entry.name);
        if (entry.name.startsWith('.') || ['node_modules', 'draft-artifacts', 'docs', 'data', 'scripts'].includes(relative)) continue;
        if (entry.isDirectory()) await scan(relative);
        else if (entry.isFile() && entry.name.endsWith('.html')) publicHtml.set(relative, { html: await read(relative) });
      }
    }
    await scan();
    for (const [file, page] of publicHtml) page.document = htmlDocument(page.html);
    const eligible = new Set();
    for (const m of registry.markets) {
      const reasons = releaseReasons(m, context);
      if (!reasons.length) eligible.add(m.slug);
      if (m.releaseStatus === 'approved' && reasons.length) fail(`${m.id}: unsafe release: ${reasons.join('; ')}`);
      const page = publicHtml.get(m.slug), legacy = registry.legacyTexas.find(l => l.slug === m.slug);
      if (page && !eligible.has(m.slug)) {
        if (!legacy || sha256(page.html) !== legacy.sha256) fail(`${m.slug}: unapproved new/replaced page is publicly deployable (noindex is not containment)`);
        if (!page.document.noindex || page.document.conflictingRobots) fail(`${m.slug}: unreleased page must remain noindex`);
      }
      if (!eligible.has(m.slug) && sitemapUrls.includes(`${origin}/${m.slug}`)) fail(`${m.slug}: unreleased sitemap membership`);
      if (eligible.has(m.slug)) {
        if (!page || page.document.noindex || page.document.conflictingRobots || !sitemapUrls.includes(`${origin}/${m.slug}`)) fail(`${m.slug}: approved page/indexing/sitemap disagreement`);
        if (page && (page.document.canonical.length !== 1 || page.document.canonical[0] !== `${origin}/${m.slug}` || page.document.h1.length !== 1)) fail(`${m.slug}: canonical/H1 mismatch`);
        if (!page || sha256(page.html) !== m.publishedSha256) fail(`${m.slug}: reviewed artifact hash mismatch`);
        if (!inventory.some(row => row.canonical_url === `${origin}/${m.slug}` && row.source_file === m.slug && row.lifecycle_status === 'approved_indexable')) fail(`${m.slug}: inventory release mismatch`);
        const area = entities.serviceAreas.find(a => a.pageUrl === `${origin}/${m.slug}`);
        if (!area || area.releaseStatus !== 'approved' || area.providerRef !== entities.organization.id || area.localBusinessEntity !== false || area.name !== m.name) fail(`${m.slug}: service-area entity mismatch`);
        for (const id of m.tierIds) if (!currentReview(services.services.find(s => s.id === id)?.marketApprovals?.[m.id], today)) fail(`${m.slug}: service registry approval mismatch`);
        for (const id of m.claimIds) if (page && !page.document.visibleText.includes(claims.find(c => c.claim_id === id)?.approved_copy)) fail(`${m.slug}: exact approved copy missing`);
        if (page) {
          const nodes = []; const walk = n => { if (!n || typeof n !== 'object') return; nodes.push(n); Object.values(n).forEach(v => Array.isArray(v) ? v.forEach(walk) : walk(v)); }; page.document.schemas.forEach(walk);
          if (nodes.some(n => (Array.isArray(n['@type']) ? n['@type'] : [n['@type']]).some(type => ['LocalBusiness', 'AutoDealer'].includes(type)) || n.address || n.geo)) fail(`${m.slug}: fictional local-presence schema`);
          const serviceNodes = nodes.filter(n => n['@type'] === 'Service');
          if (!m.tierIds.every(id => serviceNodes.some(n => n['@id'] === id)) || serviceNodes.some(n => !m.tierIds.includes(n['@id']) || n.provider?.['@id'] !== entities.organization.id || n.areaServed?.name !== m.name)) fail(`${m.slug}: Service schema does not match approved entity/tier/area`);
          if (!page.document.links.some(h => new URL(h, origin).pathname === '/service-areas.html')) fail(`${m.slug}: missing hub link`);
        }
      }
    }
    for (const old of registry.legacyTexas) {
      if (!ids.has(old.marketId)) fail(`${old.slug}: unknown disposition market`);
      if (eligible.has(old.slug)) continue;
      const page = publicHtml.get(old.slug);
      if (!page || !page.document.noindex || sha256(page.html) !== old.sha256 || sitemapUrls.includes(`${origin}/${old.slug}`)) fail(`${old.slug}: legacy containment/preservation changed`);
      if (old.redirectTo !== null) fail(`${old.slug}: redirect pending separate baseline/release review`);
    }
    const hub = publicHtml.get('service-areas.html');
    const hubRecord = registry.hub;
    if (!hubRecord || !['draft', 'approved', 'revoked'].includes(hubRecord.releaseStatus)) fail('Missing/invalid hub release record');
    if (hub) {
      if (hubRecord?.releaseStatus !== 'approved' || !currentReview(hubRecord?.editorialReview, today)
        || !currentReview(hubRecord?.qualifiedReview, today) || !currentReview(hubRecord?.qa, today)
        || sha256(hub.html) !== hubRecord?.publishedSha256) fail('service-areas.html: hub approval/evidence/artifact mismatch');
      if (hub.document.canonical.length !== 1 || hub.document.canonical[0] !== `${origin}/service-areas.html`) fail('service-areas.html: hub canonical mismatch');
      if (!inventory.some(row => row.canonical_url === `${origin}/service-areas.html` && row.source_file === 'service-areas.html' && row.lifecycle_status === 'approved_indexable')) fail('service-areas.html: hub inventory mismatch');
    }
    if (hubRecord?.releaseStatus === 'approved' && !hub) fail('Approved hub artifact is missing');
    if (hub && !eligible.size) fail('service-areas.html: public hub has no eligible markets');
    if (eligible.size && (!hub || hub.document.noindex || !sitemapUrls.includes(`${origin}/service-areas.html`))) fail('Approved markets need an indexable sitemap-listed hub');
    for (const [file, page] of publicHtml) {
      for (const marker of page.document.markers) if (!ids.has(marker) || !eligible.has(file)) fail(`${file}: unapproved metro artifact published`);
      for (const href of page.document.links) {
        const url = new URL(href, `${origin}/${file}`);
        if (url.origin !== origin) continue;
        if (url.pathname.startsWith('/draft-artifacts/')) fail(`${file}: links to private draft artifact`);
        const target = url.pathname.slice(1);
        if ((file === 'service-areas.html' || !page.document.noindex) && (slugs.has(target) || registry.legacyTexas.some(l => l.slug === target)) && !eligible.has(target)) {
          const baseline = registry.legacyDiscoveryLinks?.find(l => l.source === file && l.target === target);
          const count = page.document.links.filter(h => { const u = new URL(h, `${origin}/${file}`); return u.origin === origin && u.pathname === url.pathname; }).length;
          if (file === 'service-areas.html' || !baseline || count > baseline.count) fail(`${file}: discovery link to unreleased ${target}`);
        }
      }
    }
    if (hub) for (const slug of eligible) if (!hub.document.links.some(h => new URL(h, origin).pathname === `/${slug}`)) fail(`Hub missing ${slug}`);
    for (const area of entities.serviceAreas) if (area.releaseStatus === 'approved' && !eligible.has(new URL(area.pageUrl).pathname.slice(1))) fail('Entity registry advertises an unreleased metro');
  } catch (error) { fail(`Metro release validation failed closed: ${error.message}`); }
  return errors;
}
