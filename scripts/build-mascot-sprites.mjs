// Builds the header mascot sprites in assets/mascot/ from the Miata reference sheets in assets/mascot/reference/.
// Run: node scripts/build-mascot-sprites.mjs
//
// side*.webp   right-side view with the wheels left in; it drives, so it never shows headlight states.
// wheel*.webp  one daisy wheel cut from the side view; the page spins two copies over the drawn wheels.
// q*.webp      three-quarter front view, six frames left to right: down, half raised, up, up and lit,
//              left wink, right wink. Every frame is the down/off base with only the changed headlight
//              regions swapped in, so the body never shimmers between frames.
// front.webp   head-on view, same six frames, for the search chat avatar.
// The -lg files are the payment-success sizes; the rest are header and chat sizes (about 3x CSS size).
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = fileURLToPath(new URL('..', import.meta.url));
const ref = `${root}assets/mascot/reference/`;
const out = `${root}assets/mascot/`;
const manifest = JSON.parse(await readFile(`${ref}manifest.json`, 'utf8'));
const cells = Object.fromEntries(manifest.sheets.flatMap(sheet => sheet.cells.map(cell => [cell.id, { ...cell, file: sheet.file }])));
const STATES = ['down_off', 'halfway_off', 'up_off', 'up_on', 'left_up_right_down', 'left_down_right_up'];

// Side-view geometry in the trimmed side cell (pixels), measured from the silver rims and tyre bottoms.
const SIDE = { trim: [30, 221, 445, 173], wheel: { x: 360, y: 133, r: 35 } };
const SIZES = { sm: 66, lg: 124 }; // side-view height in pixels; every other view scales with it

async function cell(id) {
  const c = cells[id], [left, top, width, height] = c.rect;
  const { data, info } = await sharp(ref + c.file).extract({ left, top, width, height }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, w: info.width, h: info.height };
}
function premultiplied(img, i, j) {
  if (i < 0 || j < 0 || i >= img.w || j >= img.h) return [0, 0, 0, 0];
  const k = (j * img.w + i) * 4, a = img.data[k + 3] / 255;
  return [img.data[k] * a, img.data[k + 1] * a, img.data[k + 2] * a, img.data[k + 3]];
}
const differs = (a, b) => Math.max(...a.map((v, i) => Math.abs(v - b[i]))) > 48;

// The generated states are whole-pixel shifted copies of the base; find the shift with the fewest changed pixels.
function register(base, state) {
  let best = null;
  for (let dy = -16; dy <= 16; dy++) for (let dx = -16; dx <= 16; dx++) {
    let changed = 0;
    for (let j = 0; j < base.h; j += 2) for (let i = 0; i < base.w; i += 2) if (differs(premultiplied(base, i, j), premultiplied(state, i + dx, j + dy))) changed++;
    if (!best || changed < best.changed) best = { dx, dy, changed };
  }
  return best;
}

// Headlight regions: 6px blocks where most pixels changed (thin re-rendered edges don't qualify), grown by a block.
function regions(base, state, shift) {
  const B = 6, gw = Math.ceil(base.w / B), gh = Math.ceil(base.h / B), hot = new Uint8Array(gw * gh);
  for (let gy = 0; gy < gh; gy++) for (let gx = 0; gx < gw; gx++) {
    let n = 0, changed = 0;
    for (let j = gy * B; j < Math.min(base.h, gy * B + B); j++) for (let i = gx * B; i < Math.min(base.w, gx * B + B); i++) {
      n++; if (differs(premultiplied(base, i, j), premultiplied(state, i + shift.dx, j + shift.dy))) changed++;
    }
    if (changed / n > .45) hot[gy * gw + gx] = 1;
  }
  const grown = new Uint8Array(hot.length);
  for (let gy = 0; gy < gh; gy++) for (let gx = 0; gx < gw; gx++) if (hot[gy * gw + gx]) {
    for (let y = gy - 1; y <= gy + 1; y++) for (let x = gx - 1; x <= gx + 1; x++) if (x >= 0 && y >= 0 && x < gw && y < gh) grown[y * gw + x] = 1;
  }
  const seen = new Uint8Array(grown.length), boxes = [];
  for (let start = 0; start < grown.length; start++) if (grown[start] && !seen[start]) {
    const stack = [start]; seen[start] = 1; let x0 = gw, y0 = gh, x1 = -1, y1 = -1, core = 0;
    while (stack.length) {
      const p = stack.pop(), gx = p % gw, gy = (p - gx) / gw; core += hot[p];
      x0 = Math.min(x0, gx); x1 = Math.max(x1, gx); y0 = Math.min(y0, gy); y1 = Math.max(y1, gy);
      for (const [x, y] of [[gx - 1, gy], [gx + 1, gy], [gx, gy - 1], [gx, gy + 1]]) {
        const q = y * gw + x;
        if (x >= 0 && y >= 0 && x < gw && y < gh && grown[q] && !seen[q]) { seen[q] = 1; stack.push(q); }
      }
    }
    if (core >= 3) boxes.push({ x0: x0 * B, y0: y0 * B, x1: Math.min(base.w - 1, x1 * B + B - 1), y1: Math.min(base.h - 1, y1 * B + B - 1) });
  }
  return boxes;
}

const framesByView = new Map();
const frames = view => { if (!framesByView.has(view)) framesByView.set(view, buildFrames(view)); return framesByView.get(view); };
async function buildFrames(view) {
  const base = await cell(`headlights.${view}.down_off`), list = [];
  let x0 = base.w, y0 = base.h, x1 = -1, y1 = -1;
  for (const s of STATES) {
    const frame = Buffer.from(base.data);
    if (s !== 'down_off') {
      const state = await cell(`headlights.${view}.${s}`), shift = register(base, state);
      for (const r of regions(base, state, shift)) for (let j = r.y0; j <= r.y1; j++) for (let i = r.x0; i <= r.x1; i++) {
        const k = (j * base.w + i) * 4, si = i + shift.dx, sj = j + shift.dy;
        if (si < 0 || sj < 0 || si >= state.w || sj >= state.h) { frame[k + 3] = 0; continue; }
        state.data.copy(frame, k, (sj * state.w + si) * 4, (sj * state.w + si) * 4 + 4);
      }
    }
    for (let j = 0; j < base.h; j++) for (let i = 0; i < base.w; i++) if (frame[(j * base.w + i) * 4 + 3] > 24) {
      x0 = Math.min(x0, i); x1 = Math.max(x1, i); y0 = Math.min(y0, j); y1 = Math.max(y1, j);
    }
    list.push(frame);
  }
  const box = { left: x0 - 2, top: y0 - 2, width: x1 - x0 + 5, height: y1 - y0 + 5 };
  return { list, base, box };
}

async function strip(view, height, file) {
  const { list, base, box } = await frames(view);
  const w = Math.round(box.width * height / box.height);
  const tiles = await Promise.all(list.map(f => sharp(f, { raw: { width: base.w, height: base.h, channels: 4 } }).extract(box).resize(w, height, { kernel: 'lanczos3' }).png().toBuffer()));
  await sharp({ create: { width: w * tiles.length, height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite(tiles.map((input, i) => ({ input, left: i * w, top: 0 })))
    .webp({ quality: 92, alphaQuality: 100, effort: 6 }).toFile(out + file);
  return { file, frame: [w, height], box };
}

async function side(height, suffix) {
  const c = cells['turnaround.right.roof_down'], [cx, cy] = c.rect, [tx, ty, tw, th] = SIDE.trim, scale = height / th;
  await sharp(ref + c.file).extract({ left: cx + tx, top: cy + ty, width: tw, height: th })
    .resize(Math.round(tw * scale), height, { kernel: 'lanczos3' }).webp({ quality: 92, alphaQuality: 100, effort: 6 }).toFile(`${out}side${suffix}.webp`);
  const { x, y, r } = SIDE.wheel, d = 2 * r;
  const wheel = await sharp(ref + c.file).extract({ left: cx + tx + x - r, top: cy + ty + y - r, width: d, height: d }).ensureAlpha().raw().toBuffer();
  for (let j = 0; j < d; j++) for (let i = 0; i < d; i++) {
    const k = (j * d + i) * 4 + 3, edge = r - Math.hypot(i + .5 - r, j + .5 - r);
    wheel[k] = Math.round(wheel[k] * Math.max(0, Math.min(1, edge)));
  }
  const size = Math.round(d * scale);
  await sharp(wheel, { raw: { width: d, height: d, channels: 4 } }).resize(size, size, { kernel: 'lanczos3' }).webp({ quality: 92, alphaQuality: 100, effort: 6 }).toFile(`${out}wheel${suffix}.webp`);
}

// The three-quarter strip must keep the side view's pixel scale, so its height follows from the same source scale.
const qRatio = (await frames('front_right')).box.height / SIDE.trim[3];
for (const [name, height] of Object.entries(SIZES)) {
  const suffix = name === 'sm' ? '' : `-${name}`;
  await side(height, suffix);
  console.log(await strip('front_right', Math.round(height * qRatio), `q${suffix}.webp`));
}
console.log(await strip('front', 60, 'front.webp'));
console.log(`q height ratio ${qRatio.toFixed(4)} (side height x ratio)`);
