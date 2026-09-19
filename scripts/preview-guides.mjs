#!/usr/bin/env node
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repoRoot = new URL('../', import.meta.url);
const guideNames = [
  'blog-buy-new-car-below-msrp.html',
  'blog-dealership-addons-complete-guide.html',
  'blog-used-car-inspection-checklist.html',
];
const files = new Map(guideNames.map(name => [`/${name}`, [`draft-artifacts/guides/${name}`, 'text/html; charset=utf-8']]));
for (const name of ['styles.css', 'seo-content.css']) files.set(`/${name}`, [name, 'text/css; charset=utf-8']);
for (const name of ['script.js', 'openai-ads.js', 'ad-consent.js']) files.set(`/${name}`, [name, 'text/javascript; charset=utf-8']);

export function createGuidePreviewServer() {
  return createServer(async (req, res) => {
    res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive, nosnippet');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Content-Security-Policy', "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'none'; form-action 'none'; base-uri 'none'; frame-ancestors 'none'");
    if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405, { Allow: 'GET, HEAD' }).end('Method not allowed'); return; }
    let pathname;
    try { pathname = decodeURIComponent((req.url ?? '').split('?')[0]); }
    catch { res.writeHead(400).end('Invalid path'); return; }
    if (pathname === '/') { res.writeHead(302, { Location: `/${guideNames[0]}` }).end(); return; }
    const file = files.get(pathname);
    if (!file) { res.writeHead(404).end('Not found'); return; }
    try {
      const body = await readFile(fileURLToPath(new URL(file[0], repoRoot)));
      res.writeHead(200, { 'Content-Type': file[1] }).end(req.method === 'HEAD' ? undefined : body);
    } catch { res.writeHead(404).end('Not found'); }
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.env.DRIVE_RIGHT_GUIDE_PREVIEW_PORT || 4197);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid DRIVE_RIGHT_GUIDE_PREVIEW_PORT');
  createGuidePreviewServer().listen(port, '127.0.0.1', () => {
    console.log(`Private guide preview: http://127.0.0.1:${port}`);
  });
}
