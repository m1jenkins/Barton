import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const port = Number(process.env.DRIVE_RIGHT_PREVIEW_PORT || 4175);
const mime = { '.html':'text/html; charset=utf-8', '.css':'text/css', '.js':'text/javascript', '.jpg':'image/jpeg', '.webp':'image/webp', '.avif':'image/avif', '.png':'image/png', '.ttf':'font/ttf', '.svg':'image/svg+xml' };
createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname.startsWith('/api/')) { res.writeHead(503, {'Content-Type':'application/json'}).end(JSON.stringify({ok:false,error:'Secure checkout is available in the configured payment environment. This local preview has no payment credentials.'})); return; }
  try {
    const path = decodeURIComponent(url.pathname);
    if (path.split('/').some(p => p.startsWith('.') || ['node_modules','db','docs','data','scripts','draft-artifacts','outputs'].includes(p)) || path.includes('.test.')) throw new Error('Private file');
    let file = resolve(root, '.' + path);
    if (!file.startsWith(root + sep) && file !== root) throw new Error('Invalid path');
    if ((await stat(file)).isDirectory()) file = resolve(file, 'index.html');
    const type = mime[extname(file)];
    if (!type) throw new Error('Private file');
    res.writeHead(200, {'Content-Type':type,'Cache-Control':'no-store','X-Robots-Tag':'noindex, nofollow'}).end(await readFile(file));
  } catch { res.writeHead(404).end('Not found'); }
}).listen(port, '127.0.0.1', () => console.log(`Drive Right preview: http://127.0.0.1:${port}`));
