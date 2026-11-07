#!/usr/bin/env node

// Tell IndexNow engines (Bing, and through Bing, Copilot and part of ChatGPT search)
// which public URLs changed, so they recrawl without waiting.
//
//   node scripts/indexnow.mjs                 # every URL in sitemap.xml
//   node scripts/indexnow.mjs /about.html /   # only these paths
//   node scripts/indexnow.mjs --dry-run       # print the request, send nothing
//
// Run it after a deploy is live. The key file (<key>.txt at the site root) must be
// reachable at https://www.steermeright.com/<key>.txt or the engines reject the ping.

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

export const INDEXNOW_KEY = 'fc69ca18e07e517074ebc1f9c48e0c61';
export const SITE_HOST = 'www.steermeright.com';
const ENDPOINT = 'https://api.indexnow.org/indexnow';

export function sitemapUrls(xml) {
  return [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((match) => match[1]);
}

export function buildPayload(urls) {
  const origin = `https://${SITE_HOST}`;
  const urlList = [...new Set(urls.map((url) => new URL(url, origin).href))];
  for (const url of urlList) {
    if (new URL(url).host !== SITE_HOST) throw new Error(`Not a ${SITE_HOST} URL: ${url}`);
  }
  return {
    host: SITE_HOST,
    key: INDEXNOW_KEY,
    keyLocation: `${origin}/${INDEXNOW_KEY}.txt`,
    urlList,
  };
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const paths = args.filter((arg) => !arg.startsWith('--'));
  const root = new URL('..', import.meta.url);

  const keyFile = (await readFile(new URL(`${INDEXNOW_KEY}.txt`, root), 'utf8')).trim();
  if (keyFile !== INDEXNOW_KEY) throw new Error(`${INDEXNOW_KEY}.txt does not contain the key.`);

  const urls = paths.length ? paths : sitemapUrls(await readFile(new URL('sitemap.xml', root), 'utf8'));
  const payload = buildPayload(urls);

  if (dryRun) {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }

  const live = await fetch(payload.keyLocation);
  if (!live.ok || (await live.text()).trim() !== INDEXNOW_KEY) {
    throw new Error(`Key file is not live at ${payload.keyLocation} (HTTP ${live.status}). Deploy first.`);
  }

  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/json; charset=utf-8' },
    body: JSON.stringify(payload),
  });
  // 200 = accepted, 202 = accepted and key validation pending. Anything else is a failure.
  console.log(`IndexNow: HTTP ${response.status} for ${payload.urlList.length} URL(s).`);
  if (response.status !== 200 && response.status !== 202) {
    console.error(await response.text());
    process.exitCode = 1;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
