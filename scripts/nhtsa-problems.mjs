// Reads NHTSA owner complaints and recalls for one car (or all of them) and writes only counts and campaign ids into
// data/problems-pages/<car key>.json. Raw responses are cached outside the repository (~/.cache/barton-nhtsa, or
// $BARTON_NHTSA_CACHE) and complaint text never leaves the cache.
//
//   node scripts/nhtsa-problems.mjs toyota-rav4            # read, print the tables, change nothing
//   node scripts/nhtsa-problems.mjs toyota-rav4 --write    # also write nhtsa.byYear and nhtsa.readOn into the car file
//   node scripts/nhtsa-problems.mjs --all --write          # every file in data/problems-pages
//   --refresh   ignore the cache and read NHTSA again
//   --recalls   print each recall's id, date, component and the first 200 characters of NHTSA's summary (for naming notable ones)
//   --investigations   also scan NHTSA's investigation list for the car's name (open ones first) and print candidates
//
// Method (matches docs/seo/handoff-ford-vs-sierra-2026-11-19/briefs/research.md section E): every listing name in
// `nhtsa.listings` is read for every model year in `nhtsa.years`; a record counts when it has a Vehicle product whose
// productYear is the requested year and whose productModel starts with one of `nhtsa.models` (and does not match
// `nhtsa.exclude`); complaints are deduplicated by odiNumber. Recalls are read for each name in `nhtsa.recallModels`
// and deduplicated by campaign number. NHTSA answers HTTP 400 for a name and year with no listing; that is zero.
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const folder = path.join(root, 'data/problems-pages');
const cache = process.env.BARTON_NHTSA_CACHE || path.join(homedir(), '.cache/barton-nhtsa');
const today = process.env.BARTON_TODAY || new Date().toLocaleDateString("en-CA");
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
// Cache file names. Two listing names can differ only in parentheses or a doubled space ("F-150 SUPER CREW HEV" and
// "F-150 (SUPER CREW) HEV" are different NHTSA listings), so those get an encoded name of their own.
const slug = text => /[()]|\s{2}/.test(text) ? `x${encodeURIComponent(text).toLowerCase().replace(/%/g, '_')}` : text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// Read one URL, through the cache. Returns { status, body }; a 400 is cached as an empty answer.
async function cached(file, url, refresh) {
  const target = path.join(cache, file);
  if (!refresh && existsSync(target)) return JSON.parse(await readFile(target, 'utf8'));
  let last;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const response = await fetch(url, { headers: { accept: 'application/json', 'user-agent': 'barton-nhtsa-problems' } });
      if (response.status === 400) last = { status: 400, body: null };
      else if (response.ok) last = { status: 200, body: await response.json() };
      else throw new Error(`HTTP ${response.status}`);
      break;
    } catch (error) {
      last = null;
      if (attempt === 4) throw new Error(`${url}: ${error.message}`);
      await pause(1000 * (attempt + 1));
    }
  }
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, JSON.stringify({ ...last, url, fetched: today }));
  return { ...last, url, fetched: today };
}

// NHTSA names a part several ways. Grouped here, per complaint, so a complaint naming two of them counts once. Names that are
// not all capitals are child-seat parts ("Base", "Harness") and are left out.
const groups = {
  'ENGINE AND ENGINE COOLING': 'ENGINE',
  'FUEL SYSTEM': 'FUEL/PROPULSION SYSTEM',
  'GASOLINE': 'FUEL/PROPULSION SYSTEM',
  'DIESEL': 'FUEL/PROPULSION SYSTEM',
  'HYBRID PROPULSION SYSTEM': 'FUEL/PROPULSION SYSTEM',
  'VISIBILITY/WIPER': 'VISIBILITY',
  'HYDRAULIC': 'SERVICE BRAKES',
};
const enc = encodeURIComponent;
const campaignId = raw => { const found = /^(\d{2}[A-Z])(\d{3})\d{3}$/.exec(raw); return found ? `${found[1]}-${found[2]}` : raw; };

async function complaintsFor(config, year, refresh) {
  const seen = new Map();
  const models = config.models.map(name => name.toUpperCase());
  const exclude = config.exclude ? new RegExp(config.exclude, 'i') : null;
  for (const listing of config.listings) {
    const answer = await cached(`${slug(config.make)}/complaints-${slug(listing)}-${year}.json`, `https://api.nhtsa.gov/complaints/complaintsByVehicle?make=${enc(config.make)}&model=${enc(listing)}&modelYear=${year}`, refresh);
    for (const record of answer.body?.results ?? []) {
      const fits = (record.products ?? []).some(product => product.type === 'Vehicle' && String(product.productYear) === String(year)
        && models.some(prefix => product.productModel.toUpperCase().startsWith(prefix)) && !(exclude && exclude.test(product.productModel)));
      if (fits && !seen.has(record.odiNumber)) seen.set(record.odiNumber, record);
    }
  }
  const components = {};
  let crashes = 0, fires = 0;
  for (const record of seen.values()) {
    if (record.crash) crashes++;
    if (record.fire) fires++;
    const named = new Set(String(record.components ?? '').replace(/SERVICE BRAKES,\s*(HYDRAULIC|AIR|ELECTRIC)/g, 'SERVICE BRAKES').split(',')
      .map(part => part.split(':')[0].trim()).filter(name => name && name === name.toUpperCase()).map(name => groups[name] ?? name));
    for (const name of named) components[name] = (components[name] ?? 0) + 1;
  }
  const sorted = Object.fromEntries(Object.entries(components).sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0])));
  return { complaints: seen.size, crashes, fires, components: sorted };
}

async function recallsFor(config, year, refresh) {
  const seen = new Map();
  const skip = (config.recallExcludeManufacturers ?? []).map(name => name.toLowerCase());
  for (const model of config.recallModels) {
    const answer = await cached(`${slug(config.make)}/recalls-${slug(model)}-${year}.json`, `https://api.nhtsa.gov/recalls/recallsByVehicle?make=${enc(config.make)}&model=${enc(model)}&modelYear=${year}`, refresh);
    for (const recall of answer.body?.results ?? []) {
      if (skip.some(name => String(recall.Manufacturer ?? '').toLowerCase().includes(name))) continue;
      const id = campaignId(recall.NHTSACampaignNumber);
      if (!seen.has(id)) seen.set(id, recall);
    }
  }
  return seen;
}

// NHTSA's investigation list cannot be filtered by vehicle, so read all of it (100 a page, newest first) and match the car's name.
async function investigationCandidates(config, refresh) {
  const terms = (config.investigationTerms ?? config.models).map(term => new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i'));
  const found = [];
  for (let offset = 0; ; offset += 100) {
    const page = await cached(`investigations/page-${String(offset).padStart(5, '0')}.json`, `https://api.nhtsa.gov/investigations/?max=100&offset=${offset}`, refresh);
    const results = page.body?.results ?? [];
    for (const item of results) {
      const text = `${item.subject} ${item.description}`;
      const opened = (item.openDate ?? item.latestActivityDate ?? '').slice(0, 10);
      if (opened && Number(opened.slice(0, 4)) >= 2016 && terms.some(term => term.test(text))) found.push({ id: item.nhtsaId, status: item.status === 'O' ? 'open' : 'closed', opened, subject: item.subject });
    }
    if (results.length < 100 || offset > 6000) break;
  }
  return found.sort((x, y) => (x.status === y.status ? y.opened.localeCompare(x.opened) : x.status === 'open' ? -1 : 1));
}

async function run(key, flags) {
  const file = path.join(folder, `${key}.json`);
  if (!existsSync(file)) throw new Error(`No ${path.relative(root, file)}`);
  const car = JSON.parse(await readFile(file, 'utf8'));
  const config = car.nhtsa;
  if (!config?.make || !config.listings?.length) throw new Error(`${key}: nhtsa.make and nhtsa.listings are required`);
  config.models ??= [config.listings[0]];
  config.recallModels ??= [config.listings[0]];
  const byYear = {};
  for (let year = config.years[0]; year <= config.years[1]; year++) {
    const complaints = await complaintsFor(config, year, flags.refresh);
    const recalls = await recallsFor(config, year, flags.refresh);
    byYear[year] = { ...complaints, recalls: [...recalls.keys()].sort() };
    if (flags.recalls) for (const [id, recall] of [...recalls].sort()) console.log(`  ${year} ${id} ${recall.ReportReceivedDate} ${recall.Component}: ${String(recall.Summary).replace(/\s+/g, ' ').slice(0, 200)}`);
  }
  console.log(`\n${key}  (${config.make}; listings: ${config.listings.join(', ')}; years ${config.years.join('–')})`);
  console.log('year  complaints  recalls  crash  fire  top components');
  for (const [year, row] of Object.entries(byYear)) {
    const top = Object.entries(row.components).slice(0, 4).map(([name, count]) => `${name} ${count}`).join(', ');
    console.log(`${year}  ${String(row.complaints).padStart(10)}  ${String(row.recalls.length).padStart(7)}  ${String(row.crashes).padStart(5)}  ${String(row.fires).padStart(4)}  ${top}`);
  }
  if (flags.investigations) {
    const list = await investigationCandidates(config, flags.refresh);
    console.log(`\nInvestigations naming ${(config.investigationTerms ?? config.models).join(' / ')} (open first):`);
    for (const item of list) console.log(`  ${item.id} ${item.status} opened ${item.opened}: ${item.subject}`);
  }
  if (flags.write) {
    car.nhtsa = { ...config, readOn: today, byYear };
    await writeFile(file, `${JSON.stringify(car, null, 2)}\n`);
    console.log(`wrote ${path.relative(root, file)}`);
  }
}

const args = process.argv.slice(2);
const flags = { write: args.includes('--write'), refresh: args.includes('--refresh'), recalls: args.includes('--recalls'), investigations: args.includes('--investigations') };
const keys = args.includes('--all')
  ? (await readdir(folder)).filter(name => name.endsWith('.json')).map(name => name.replace(/\.json$/, '')).sort()
  : args.filter(arg => !arg.startsWith('--'));
if (!keys.length) { console.error('Usage: node scripts/nhtsa-problems.mjs <car key>|--all [--write] [--refresh] [--recalls] [--investigations]'); process.exit(2); }
for (const key of keys) await run(key, flags);
