import { readFile, readdir, stat } from 'node:fs/promises';
import { resolve, relative, sep } from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parse } from 'parse5';

const root = fileURLToPath(new URL('..', import.meta.url));
const origin = 'https://www.driverightcarbuying.com';
const resourceRels = new Set(['stylesheet', 'icon', 'apple-touch-icon', 'preload', 'modulepreload', 'prefetch']);

function deploymentRule(pattern) {
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replaceAll('*', '[^/]*');
  return new RegExp(`^${escaped}(?:/|$)`);
}

export async function validateAssets(directory = root) {
  const errors = [], resources = new Map(), inspected = new Set();
  let references = 0;
  const rules = (await readFile(resolve(directory, '.vercelignore'), 'utf8')).split(/\r?\n/)
    .map(line => line.trim()).filter(line => line && !line.startsWith('#')).map(deploymentRule);
  const rootFiles = (await readdir(directory, { withFileTypes: true })).filter(entry => entry.isFile()).map(entry => entry.name);
  const queue = rootFiles.filter(file => /\.(?:html|css|js)$/.test(file));
  for (const entry of await readdir(resolve(directory, 'buying'), { withFileTypes: true })) {
    if (entry.isFile() && /\.(?:css|js)$/.test(entry.name) && !entry.name.endsWith('.test.js')) queue.push(`buying/${entry.name}`);
  }

  async function check(file, value, line) {
    if (!value || value.startsWith('#')) return;
    let url;
    try { url = new URL(value, `${origin}/${file}`); } catch {
      errors.push({ file, line, message: `Invalid resource URL: ${value}` });
      return;
    }
    if (url.origin !== origin) return;
    references++;
    let pathname;
    try { pathname = decodeURIComponent(url.pathname); } catch {
      errors.push({ file, line, message: `Invalid resource encoding: ${value}` });
      return;
    }
    const target = relative(directory, resolve(directory, `.${pathname}`));
    if (target === '..' || target.startsWith(`..${sep}`) || rules.some(rule => rule.test(target))) {
      errors.push({ file, line, message: `Resource is excluded from deployment: ${value}` });
      return;
    }
    if (!resources.has(target)) {
      try {
        if (!(await stat(resolve(directory, target))).isFile()) throw new Error('not a file');
        resources.set(target, await readFile(resolve(directory, target)));
      } catch { resources.set(target, null); }
    }
    const content = resources.get(target);
    if (!content) {
      errors.push({ file, line, message: `Local resource is missing: ${value}` });
      return;
    }
    const version = url.searchParams.get('v');
    if (/^[0-9a-f]{12}$/i.test(version || '')) {
      const current = createHash('sha256').update(content).digest('hex').slice(0, 12);
      if (version !== current) errors.push({ file, line, message: `Stale resource version: ${value}; use v=${current}` });
    }
    if (/\.(?:css|js)$/.test(target) && !inspected.has(target)) queue.push(target);
  }

  while (queue.length) {
    const file = queue.shift();
    if (inspected.has(file)) continue;
    inspected.add(file);
    const source = await readFile(resolve(directory, file), 'utf8');
    if (file.endsWith('.html')) {
      async function walk(node) {
        const attrs = Object.fromEntries((node.attrs || []).map(attr => [attr.name, attr.value]));
        const line = node.sourceCodeLocation?.startLine;
        for (const name of ['src', 'poster']) if (attrs[name]) await check(file, attrs[name], line);
        for (const name of ['srcset', 'imagesrcset']) {
          if (!attrs[name] || attrs[name].startsWith('data:')) continue;
          for (const candidate of attrs[name].split(',')) await check(file, candidate.trim().split(/\s+/)[0], line);
        }
        if (node.tagName === 'link' && (attrs.rel || '').split(/\s+/).some(rel => resourceRels.has(rel))) await check(file, attrs.href, line);
        for (const child of [...node.childNodes || [], ...(node.content ? [node.content] : [])]) await walk(child);
      }
      await walk(parse(source, { sourceCodeLocationInfo: true }));
    } else if (file.endsWith('.css')) {
      for (const match of source.matchAll(/url\(\s*(?:"([^"]*)"|'([^']*)'|([^)'"\s]+))\s*\)/gi)) await check(file, match[1] ?? match[2] ?? match[3]);
    } else if (file.endsWith('.js')) {
      // Literal browser imports only; computed imports and bare package specifiers are outside this static check.
      for (const match of source.matchAll(/\b(?:import\s*(?:\(\s*|[^;]*?\bfrom\s*)?|export\s+[^;]*?\bfrom\s*)['"]([^'"]+)['"]/g)) {
        if (/^(?:\.{1,2}\/|\/|https?:)/.test(match[1])) await check(file, match[1]);
      }
    }
  }
  return { errors, references, files: inspected.size };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = await validateAssets();
  for (const error of result.errors) console.error(`${error.file}${error.line ? `:${error.line}` : ''}: ${error.message}`);
  if (result.errors.length) process.exitCode = 1;
  else console.log(`Asset validation passed: ${result.references} local references across ${result.files} public source files.`);
}
