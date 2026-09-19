import { createServer } from 'node:http';
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { cityDraftRoot, projectRoot, renderCityPages } from './render-city-pages.mjs';

const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.avif': 'image/avif', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.ttf': 'font/ttf', '.woff': 'font/woff', '.woff2': 'font/woff2' };

export async function createCityServer({ root = projectRoot, output = cityDraftRoot } = {}) {
  const data = JSON.parse(await readFile(path.join(root, 'data/city-pages.json'), 'utf8'));
  const files = new Map();
  async function addPublicFiles(directory, recursive = false) {
    for (const entry of await readdir(path.join(root, directory), { withFileTypes: true })) {
      if (entry.name.startsWith('.') || entry.name.includes('.test.')) continue;
      const relative = path.join(directory, entry.name);
      if (recursive && entry.isDirectory()) await addPublicFiles(relative, true);
      else if (entry.isFile() && mime[path.extname(entry.name)]) files.set(`/${relative}`, path.join(root, relative));
    }
  }
  await addPublicFiles('');
  await addPublicFiles('buying');
  await addPublicFiles('assets', true);
  for (const slug of [...data.cities.map(city => city.slug), 'service-areas.html']) files.set(`/${slug}`, path.join(output, slug));
  return createServer(async (req, res) => {
    const headers = {
      'Cache-Control': 'no-store',
      'X-Robots-Tag': 'noindex, nofollow',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data:; connect-src 'self'; form-action 'none'; frame-src 'none'; frame-ancestors 'none'; base-uri 'none'",
    };
    try {
      let route = new URL(req.url, 'http://localhost').pathname;
      if (route.startsWith('/api/')) {
        res.writeHead(503, { ...headers, 'Content-Type': 'application/json' }).end(JSON.stringify({ error: 'This local preview does not submit inquiries or payments.' }));
        return;
      }
      if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405, { ...headers, Allow: 'GET, HEAD' }).end(); return; }
      if (route === '/') route = '/index.html';
      const file = files.get(route);
      if (!file) { res.writeHead(404, headers).end('Not found'); return; }
      const bytes = await readFile(file);
      res.writeHead(200, { ...headers, 'Content-Type': mime[path.extname(file)] }).end(req.method === 'HEAD' ? undefined : bytes);
    } catch { res.writeHead(404, headers).end('Not found'); }
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await renderCityPages();
  const server = await createCityServer();
  const port = Number(process.env.BARTON_CITY_PREVIEW_PORT || 4177);
  server.listen(port, '127.0.0.1', () => console.log(`City page preview: http://127.0.0.1:${port}/service-areas.html`));
}
