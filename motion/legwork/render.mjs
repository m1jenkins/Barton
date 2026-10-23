// Renders each legwork composition to the homepage assets: an H.264 MP4, the first frame (poster
// while waiting to play) and the last frame (poster for reduced motion and no JavaScript), as WebP.
// Run: npm run render (from motion/legwork)
import { spawnSync } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const out = fileURLToPath(new URL('../../assets/buying/legwork/', import.meta.url));
const ids = process.argv.slice(2).length ? process.argv.slice(2) : ['search', 'negotiate', 'keys'];
const sharp = createRequire(new URL('../../package.json', import.meta.url))('sharp'); // the site's own devDependency
mkdirSync(out, { recursive: true });

function remotion(...args) {
  const result = spawnSync('npx', ['remotion', ...args, '--log=error'], { stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

for (const id of ids) {
  remotion('render', 'src/index.jsx', id, `${out}${id}.mp4`, '--codec=h264', '--crf=24', '--pixel-format=yuv420p', '--muted');
  for (const [frame, name] of [[0, `${id}-start`], [149, id]]) {
    const png = `${out}${name}.png`;
    remotion('still', 'src/index.jsx', id, png, `--frame=${frame}`, '--image-format=png');
    await sharp(png).webp({ quality: 82 }).toFile(`${out}${name}.webp`);
    rmSync(png);
  }
}
