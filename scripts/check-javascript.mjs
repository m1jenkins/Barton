import { readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const folders = ['api', 'buying', 'scripts', 'draft-artifacts/quote-comparison', 'outputs/2026-10-google-search-ads'];

export async function javascriptFiles(directory, mode = 'all') {
  const files = [];
  async function walk(folder) {
    for (const entry of await readdir(resolve(directory, folder), { withFileTypes: true })) {
      const file = folder ? `${folder}/${entry.name}` : entry.name;
      if (entry.isDirectory()) await walk(file);
      else if (entry.isFile() && /\.(?:js|mjs)$/.test(entry.name)) files.push(file);
    }
  }
  if (mode !== 'api') {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (entry.isFile() && /\.(?:js|mjs)$/.test(entry.name)) files.push(entry.name);
    }
  }
  for (const folder of mode === 'api' ? ['api'] : mode === 'frontend' ? ['buying'] : folders) await walk(folder);
  return files.sort();
}

export async function checkJavaScript(directory = root, mode = 'all') {
  const files = await javascriptFiles(directory, mode);
  const errors = [];
  for (const file of files) {
    const result = spawnSync(process.execPath, ['--check', resolve(directory, file)], { encoding: 'utf8' });
    if (result.status !== 0) errors.push({ file, message: result.error?.message || result.stderr.trim() });
  }
  return { files, errors };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const mode = process.argv.includes('--api') ? 'api' : process.argv.includes('--frontend') ? 'frontend' : 'all';
  const result = await checkJavaScript(root, mode);
  for (const error of result.errors) console.error(`${error.file}: ${error.message}`);
  if (result.errors.length) process.exitCode = 1;
  else console.log(`JavaScript syntax passed: ${result.files.length} files checked (${mode}).`);
}
