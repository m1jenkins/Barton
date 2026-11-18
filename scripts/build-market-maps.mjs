// Draws the dealer-circle map for each city page that has a `map` entry in data/market-pages.json
// and writes it to data/market-maps/<id>.svg, which render-market-pages.mjs inlines.
//
// Boundaries: US Census Bureau cartographic boundary file cb_2024_us_state_500k (public domain).
// Download and unzip it, then pass the folder:
//   curl -O https://www2.census.gov/geo/tiger/GENZ2024/shp/cb_2024_us_state_500k.zip && unzip cb_2024_us_state_500k.zip -d census
//   node scripts/build-market-maps.mjs census
// then `npm run build:markets`. The SVGs are committed; this script is not part of CI.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const census = process.argv[2];
if (!census) throw new Error('Pass the folder holding cb_2024_us_state_500k.shp and .dbf');

const MILES_PER_DEGREE_LAT = 69.05;
const WIDTH = 640, HEIGHT = 520, RADIUS_PX = 190;
const colors = { water: '#E3ECF8', land: '#FFFFFF', coast: '#C3CBD6', border: '#465061', circle: '#1A4B8C', ink: '#0E1B2E', muted: '#465061' };

// Minimal shapefile (polygon) and dBase readers: enough for the Census state file.
function readShapes(buffer) {
  const shapes = [];
  let offset = 100;
  while (offset < buffer.length) {
    const length = buffer.readInt32BE(offset + 4) * 2;
    const start = offset + 8;
    const type = buffer.readInt32LE(start);
    const rings = [];
    if (type === 5) {
      const parts = buffer.readInt32LE(start + 36), points = buffer.readInt32LE(start + 40);
      const index = Array.from({ length: parts }, (_, i) => buffer.readInt32LE(start + 44 + i * 4));
      const base = start + 44 + parts * 4;
      for (let p = 0; p < parts; p++) {
        const end = p + 1 < parts ? index[p + 1] : points;
        const ring = [];
        for (let i = index[p]; i < end; i++) ring.push([buffer.readDoubleLE(base + i * 16), buffer.readDoubleLE(base + i * 16 + 8)]);
        rings.push(ring);
      }
    }
    shapes.push(rings);
    offset = start + length;
  }
  return shapes;
}

function readDbf(buffer) {
  const count = buffer.readUInt32LE(4), headerLength = buffer.readUInt16LE(8), recordLength = buffer.readUInt16LE(10);
  const fields = [];
  for (let at = 32; buffer[at] !== 0x0d; at += 32) fields.push({ name: buffer.toString('latin1', at, at + 11).replace(/\0.*$/, ''), length: buffer[at + 16] });
  return Array.from({ length: count }, (_, r) => {
    let at = headerLength + r * recordLength + 1;
    const row = {};
    for (const field of fields) { row[field.name] = buffer.toString('latin1', at, at + field.length).trim(); at += field.length; }
    return row;
  });
}

// Sutherland–Hodgman clip of a ring to an axis-aligned box.
function clip(ring, [minX, minY, maxX, maxY]) {
  const edges = [
    [p => p[0] >= minX, (a, b) => [minX, a[1] + (b[1] - a[1]) * (minX - a[0]) / (b[0] - a[0])]],
    [p => p[0] <= maxX, (a, b) => [maxX, a[1] + (b[1] - a[1]) * (maxX - a[0]) / (b[0] - a[0])]],
    [p => p[1] >= minY, (a, b) => [a[0] + (b[0] - a[0]) * (minY - a[1]) / (b[1] - a[1]), minY]],
    [p => p[1] <= maxY, (a, b) => [a[0] + (b[0] - a[0]) * (maxY - a[1]) / (b[1] - a[1]), maxY]],
  ];
  let output = ring;
  for (const [inside, cross] of edges) {
    const input = output;
    output = [];
    for (let i = 0; i < input.length; i++) {
      const current = input[i], previous = input[(i + input.length - 1) % input.length];
      if (inside(current)) { if (!inside(previous)) output.push(cross(previous, current)); output.push(current); }
      else if (inside(previous)) output.push(cross(previous, current));
    }
    if (!output.length) break;
  }
  return output;
}

const round = value => Math.round(value * 10) / 10;

function drawMap(market, states) {
  const { lat, lon, places } = market.map;
  const radiusMiles = 50;
  const k = RADIUS_PX / (radiusMiles / MILES_PER_DEGREE_LAT);
  const cos = Math.cos(lat * Math.PI / 180);
  const project = ([x, y]) => [WIDTH / 2 + (x - lon) * cos * k, HEIGHT / 2 - (y - lat) * k];
  const margin = 4;
  const box = [-margin, -margin, WIDTH + margin, HEIGHT + margin];

  const land = [];
  const edgeOwners = new Map();
  for (const { name, rings } of states) {
    for (const ring of rings) {
      const projected = ring.map(project);
      if (!projected.some(([x, y]) => x >= box[0] && x <= box[2] && y >= box[1] && y <= box[3])) continue;
      // Record raw-coordinate edges so shared state lines can be found before clipping.
      for (let i = 1; i < ring.length; i++) {
        const a = ring[i - 1].join(','), b = ring[i].join(',');
        const key = a < b ? `${a}|${b}` : `${b}|${a}`;
        const owners = edgeOwners.get(key) || new Set();
        owners.add(name);
        edgeOwners.set(key, owners);
      }
      const clipped = clip(projected, box);
      if (clipped.length > 2) land.push(clipped);
    }
  }

  // Thin the outline: drop points closer than 0.8px to the last kept one.
  const thin = points => points.filter((point, i) => {
    if (i === 0) return true;
    const last = thin.last;
    const keep = !last || Math.hypot(point[0] - last[0], point[1] - last[1]) >= 0.8;
    if (keep) thin.last = point;
    return keep;
  });
  const pathOf = (points, close) => { thin.last = points[0]; const kept = thin(points); return `M${kept.map(([x, y]) => `${round(x)} ${round(y)}`).join('L')}${close ? 'Z' : ''}`; };
  const landPath = land.map(points => pathOf(points, true)).join('');

  // State lines: edges owned by two states, chained into polylines, clipped to the view by the SVG itself.
  const borderSegments = [...edgeOwners].filter(([, owners]) => owners.size > 1).map(([key]) => key.split('|').map(point => project(point.split(',').map(Number))))
    .filter(([a, b]) => [a, b].some(([x, y]) => x >= box[0] && x <= box[2] && y >= box[1] && y <= box[3]));
  const borderPath = borderSegments.map(([a, b]) => `M${round(a[0])} ${round(a[1])}L${round(b[0])} ${round(b[1])}`).join('');

  const scaleMiles = 25, scalePx = scaleMiles / MILES_PER_DEGREE_LAT * k;
  // `minor` labels are hidden on phones (buying/market.css); their dots stay.
  const placeMarks = places.map(({ name, lat: plat, lon: plon, anchor = 'start', dy = 4, minor }) => {
    const [x, y] = project([plon, plat]);
    const dx = { end: -7, middle: 0, start: 7 }[anchor];
    return `<circle cx="${round(x)}" cy="${round(y)}" r="3" fill="${colors.ink}"/><text x="${round(x + dx)}" y="${round(y + dy)}" text-anchor="${anchor}" class="mm-place${minor ? ' mm-minor' : ''}">${name}</text>`;
  }).join('');
  const regionLabels = market.map.regions.map(({ name, lat: rlat, lon: rlon, water }) => {
    const [x, y] = project([rlon, rlat]);
    return `<text x="${round(x)}" y="${round(y)}" text-anchor="middle" class="${water ? 'mm-water' : 'mm-region'}">${name}</text>`;
  }).join('');

  return `<svg class="market-map__svg" viewBox="0 0 ${WIDTH} ${HEIGHT}" role="img" aria-labelledby="market-map-title market-map-desc" xmlns="http://www.w3.org/2000/svg">
<title id="market-map-title">${market.map.title}</title>
<desc id="market-map-desc">${market.map.description}</desc>
<rect width="${WIDTH}" height="${HEIGHT}" fill="${colors.water}"/>
<path d="${landPath}" fill="${colors.land}" stroke="${colors.coast}" stroke-width="1" fill-rule="evenodd"/>
<path d="${borderPath}" fill="none" stroke="${colors.border}" stroke-width="1.4" stroke-dasharray="5 4" stroke-linecap="round"/>
<circle cx="${WIDTH / 2}" cy="${HEIGHT / 2}" r="${RADIUS_PX}" fill="${colors.circle}" fill-opacity=".07" stroke="${colors.circle}" stroke-width="2"/>
${regionLabels}
${placeMarks}
<circle cx="${WIDTH / 2}" cy="${HEIGHT / 2}" r="6" fill="${colors.circle}" stroke="#fff" stroke-width="2"/>
<text x="${WIDTH / 2 + 10}" y="${HEIGHT / 2 - 8}" class="mm-center">${market.map.centerLabel}</text>
<g transform="translate(20 ${HEIGHT - 24})"><rect x="-8" y="-12" width="${round(scalePx + 16)}" height="36" rx="6" fill="#fff" fill-opacity=".9"/><path d="M0 0H${round(scalePx)}M0 -5V0M${round(scalePx)} -5V0" stroke="${colors.ink}" stroke-width="1.5" fill="none"/><text x="0" y="16" class="mm-scale">${scaleMiles} miles</text></g>
${borderSegments.length ? `<g transform="translate(${WIDTH - 118} ${HEIGHT - 20})"><rect x="-8" y="-16" width="118" height="26" rx="6" fill="#fff" fill-opacity=".9"/><path d="M0 -4H22" stroke="${colors.border}" stroke-width="1.4" stroke-dasharray="5 4"/><text x="30" y="0" class="mm-scale">State line</text></g>` : ''}
</svg>
`;
}

const [shp, dbf] = await Promise.all(['shp', 'dbf'].map(ext => readFile(path.join(census, `cb_2024_us_state_500k.${ext}`))));
const rows = readDbf(dbf);
const states = readShapes(shp).map((rings, i) => ({ name: rows[i].STUSPS, rings }));
const data = JSON.parse(await readFile(path.join(root, 'data/market-pages.json'), 'utf8'));
await mkdir(path.join(root, 'data/market-maps'), { recursive: true });
for (const market of data.markets.filter(market => market.map)) {
  const id = market.slug.replace(/^car-buying-service-|\.html$/g, '');
  const file = path.join(root, 'data/market-maps', `${id}.svg`);
  const svg = drawMap(market, states);
  await writeFile(file, svg);
  console.log(`wrote data/market-maps/${id}.svg (${(svg.length / 1024).toFixed(1)} KB)`);
}
