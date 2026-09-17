import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { draftRoot } from './render-metro-drafts.mjs';
const root = fileURLToPath(new URL('..', import.meta.url));
const references = new Set(['/how-it-works.html','/schedule.html','/policy.html','/texas-local-market-intelligence.html']);
export function createDraftServer() {
  return createServer(async (req, res) => {
    const headers = {'Cache-Control':'no-store','X-Robots-Tag':'noindex, nofollow', 'Content-Security-Policy':"default-src 'none'; style-src 'self'; font-src 'self'; img-src 'self'; form-action 'none'; frame-ancestors 'none'; base-uri 'none'"};
    try {
      if (!['GET','HEAD'].includes(req.method)) { res.writeHead(405,headers).end(); return; }
      const route = new URL(req.url,'http://localhost').pathname;
      if (references.has(route)) {
        res.writeHead(200,{...headers,'Content-Type':'text/html; charset=utf-8'}).end(`<!doctype html><html lang="en"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Local reference boundary</title><h1>Central page reference</h1><p>The draft links to ${route}. Inspect the existing repository page for its current wording. This isolated preview does not load forms, payment links or tracking.</p><a href="/service-areas.html">Return to local drafts</a></html>`);return;
      }
      const drafts = new Set(['/service-areas.html','/dallas-fort-worth.html','/houston.html','/austin.html','/metro-draft.css']);
      const assets = new Set(['/buying/daisy.css','/assets/buying/fonts/instrument-serif.ttf','/assets/buying/fonts/inter.ttf','/favicon.png']);
      const file = drafts.has(route) ? path.join(draftRoot,route.slice(1)) : assets.has(route) ? path.join(root,route.slice(1)) : null;
      if (!file) { res.writeHead(404,headers).end('Not found');return; }
      const mime = {'.html':'text/html; charset=utf-8','.css':'text/css','.ttf':'font/ttf','.png':'image/png'};
      const bytes = await readFile(file);res.writeHead(200,{...headers,'Content-Type':mime[path.extname(file)]}).end(req.method === 'HEAD' ? undefined : bytes);
    } catch { res.writeHead(404,headers).end('Not found'); }
  });
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port=Number(process.env.BARTON_METRO_PREVIEW_PORT || 4176);
  createDraftServer().listen(port,'127.0.0.1',()=>console.log(`Local-only metro drafts: http://127.0.0.1:${port}/service-areas.html`));
}
