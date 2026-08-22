#!/usr/bin/env node
// Local development server for the Drive Right static site + /api serverless
// functions. Production runs on Vercel; this harness lets you exercise the
// static pages and the Node API handlers (api/*.js) together on one origin.
//
// Usage:
//   PORT=8080 node scripts/dev-server.mjs
//
// It loads a local .env (if present), serves the repo root as static files,
// and dispatches /api/<name> to the default export of api/<name>.js using the
// standard Node req/res objects the handlers already fall back to.

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = Number.parseInt(process.env.PORT || '8080', 10);

function loadDotEnv() {
  const envPath = path.join(repoRoot, '.env');
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match) continue;
    const key = match[1];
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadDotEnv();

const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.woff2': 'font/woff2'
};

async function serveApi(name, req, res) {
  const modulePath = path.join(repoRoot, 'api', `${name}.js`);
  if (!name || name.includes('/') || name.startsWith('_') || !existsSync(modulePath)) {
    res.statusCode = 404;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: false, error: 'not_found' }));
    return;
  }
  const mod = await import(pathToFileURL(modulePath).href);
  await mod.default(req, res);
}

async function serveStatic(pathname, res) {
  let relative = decodeURIComponent(pathname);
  if (relative === '/' || relative === '') relative = '/index.html';
  let filePath = path.join(repoRoot, relative);
  if (!filePath.startsWith(repoRoot)) {
    res.statusCode = 403;
    res.end('Forbidden');
    return;
  }

  let target = filePath;
  try {
    const info = await stat(target);
    if (info.isDirectory()) target = path.join(target, 'index.html');
  } catch {
    // Vercel serves clean URLs: /austin -> /austin.html
    if (!path.extname(target) && existsSync(`${target}.html`)) {
      target = `${target}.html`;
    }
  }

  try {
    const body = await readFile(target);
    res.statusCode = 200;
    res.setHeader('Content-Type', CONTENT_TYPES[path.extname(target)] || 'application/octet-stream');
    res.end(body);
  } catch {
    res.statusCode = 404;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end('<h1>404 Not Found</h1>');
  }
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://localhost:${port}`);
    if (url.pathname.startsWith('/api/')) {
      await serveApi(url.pathname.slice('/api/'.length), req, res);
      return;
    }
    await serveStatic(url.pathname, res);
  } catch (error) {
    console.error('[dev-server] error', error);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ ok: false, error: 'internal_error' }));
    }
  }
});

server.listen(port, () => {
  console.log(`Drive Right dev server on http://localhost:${port}`);
  console.log(`DATABASE_URL ${process.env.DATABASE_URL ? 'is set' : 'is NOT set (API DB calls will fail)'}`);
});
