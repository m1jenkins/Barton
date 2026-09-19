#!/usr/bin/env node
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = new URL('../draft-artifacts/quote-comparison/', import.meta.url);
const files = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/index.html', ['index.html', 'text/html; charset=utf-8']],
  ['/styles.css', ['styles.css', 'text/css; charset=utf-8']],
  ['/app.js', ['app.js', 'text/javascript; charset=utf-8']],
  ['/worksheet.mjs', ['worksheet.mjs', 'text/javascript; charset=utf-8']],
]);

export function createWorksheetServer() {
  return createServer(async (req, res) => {
    res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive, nosnippet');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Content-Security-Policy', "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'none'; form-action 'none'; base-uri 'none'; frame-ancestors 'none'");
    if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405, { Allow: 'GET, HEAD' }).end('Method not allowed'); return; }
    let pathname;
    try { pathname = decodeURIComponent((req.url ?? '').split('?')[0]); }
    catch { res.writeHead(400).end('Invalid path'); return; }
    const file = files.get(pathname);
    if (!file) { res.writeHead(404).end('Not found'); return; }
    try {
      const body = await readFile(fileURLToPath(new URL(file[0], root)));
      res.writeHead(200, { 'Content-Type': file[1] }).end(req.method === 'HEAD' ? undefined : body);
    } catch { res.writeHead(404).end('Not found'); }
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.env.DRIVE_RIGHT_WORKSHEET_PORT || 4196);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid DRIVE_RIGHT_WORKSHEET_PORT');
  createWorksheetServer().listen(port, '127.0.0.1', () => {
    console.log(`Private worksheet preview: http://127.0.0.1:${port}`);
  });
}
