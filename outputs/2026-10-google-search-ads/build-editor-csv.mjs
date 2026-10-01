// Builds Google Ads Editor import files from plan.json (the campaign source of truth).
// Usage: node outputs/2026-10-google-search-ads/build-editor-csv.mjs [--check]
// Headers follow Google Ads Editor's "CSV file columns" help page (answer 57747). Editor still
// shows a column mapping before import; confirm it, keep campaigns paused, then review changes.
// Also writes keyword-planner/keywords.csv: the single "Keyword" column upload that Keyword
// Planner's "Get search volume and forecasts" accepts (answer 7337243; 80 characters, 10 words max).
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const outDir = join(root, 'editor-import');
const plannerDir = join(root, 'keyword-planner');
const plan = JSON.parse(readFileSync(join(root, 'plan.json'), 'utf8'));
const check = process.argv.includes('--check');

const MATCH = { EXACT: 'Exact', PHRASE: 'Phrase' };
const NEGATIVE = { EXACT: 'Campaign negative exact', PHRASE: 'Campaign negative phrase' };
const BIDDING = { MAXIMIZE_CONVERSIONS: 'Maximize conversions', MAXIMIZE_CLICKS: 'Maximize clicks' };
const PIN = { HEADLINE_1: '1', HEADLINE_2: '2', HEADLINE_3: '3', DESCRIPTION_1: '1', DESCRIPTION_2: '2' };

const cell = value => {
  const text = value == null ? '' : String(value);
  if (!/^[\x20-\x7e]*$/.test(text)) throw new Error(`Non-ASCII or control character in: ${text}`);
  return /[",]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};
const csv = (header, rows) => [header, ...rows].map(row => row.map(cell).join(',')).join('\n') + '\n';
const networks = c => ['Google Search', c.networks.search_partners && 'Search Partners', c.networks.display_expansion && 'Display'].filter(Boolean).join(';');
const schedule = call => call.days.map(day => `(${day}[${call.hours}])`).join(';');

const files = {};
const campaigns = plan.campaigns;

files['01-campaigns.csv'] = csv(
  ['Campaign', 'Campaign type', 'Networks', 'Budget', 'Budget type', 'Languages', 'Bid strategy type', 'Campaign status'],
  campaigns.map(c => [c.name, c.campaign_type, networks(c), c.daily_budget.toFixed(2), 'Daily', c.languages.join(';'),
    BIDDING[c.bidding.strategy], c.status === 'PAUSED' ? 'Paused' : c.status])
);

files['02-locations.csv'] = csv(
  ['Campaign', 'Location', 'Location ID'],
  campaigns.flatMap(c => c.geo.targets.map((name, i) => [c.name, name, c.geo.location_ids[i]]))
);

files['03-ad-groups.csv'] = csv(
  ['Campaign', 'Ad group', 'Ad group status'],
  campaigns.flatMap(c => c.ad_groups.map(g => [c.name, g.name, 'Enabled']))
);

files['04-keywords.csv'] = csv(
  ['Campaign', 'Ad group', 'Keyword', 'Criterion type', 'Status'],
  campaigns.flatMap(c => c.ad_groups.flatMap(g => g.keywords.map(k => [c.name, g.name, k.text, MATCH[k.match_type], 'Enabled'])))
);

files['05-campaign-negative-keywords.csv'] = csv(
  ['Campaign', 'Keyword', 'Criterion type'],
  campaigns.flatMap(c => c.negatives.map(n => [c.name, n.text, NEGATIVE[n.match_type]]))
);

const headlineCols = Array.from({ length: 15 }, (_, i) => [`Headline ${i + 1}`, `Headline ${i + 1} position`]).flat();
const descriptionCols = Array.from({ length: 4 }, (_, i) => [`Description ${i + 1}`, `Description ${i + 1} position`]).flat();
files['06-responsive-search-ads.csv'] = csv(
  ['Campaign', 'Ad group', 'Ad type', ...headlineCols, ...descriptionCols, 'Path 1', 'Path 2', 'Final URL', 'Status'],
  campaigns.flatMap(c => c.ad_groups.flatMap(g => g.rsas.map(ad => {
    const heads = Array.from({ length: 15 }, (_, i) => ad.headlines[i] ? [ad.headlines[i].text, PIN[ad.headlines[i].pin] ?? ''] : ['', '']).flat();
    const descs = Array.from({ length: 4 }, (_, i) => ad.descriptions[i] ? [ad.descriptions[i].text, PIN[ad.descriptions[i].pin] ?? ''] : ['', '']).flat();
    return [c.name, g.name, 'Responsive search ad', ...heads, ...descs, ad.path1, ad.path2 ?? '', ad.final_url, 'Enabled'];
  })))
);

files['07-sitelinks.csv'] = csv(
  ['Campaign', 'Link text', 'Description line 1', 'Description line 2', 'Final URL'],
  campaigns.flatMap(c => c.assets.sitelinks.map(s => [c.name, s.text, s.d1, s.d2, s.url]))
);

files['08-callouts.csv'] = csv(
  ['Campaign', 'Callout text'],
  campaigns.flatMap(c => c.assets.callouts.map(text => [c.name, text]))
);

files['09-structured-snippets.csv'] = csv(
  ['Campaign', 'Header', 'Values'],
  campaigns.flatMap(c => (c.assets.snippets ?? []).map(s => [c.name, s.header, s.values.join(';')]))
);

files['10-call-assets.csv'] = csv(
  ['Campaign', 'Phone number', 'Country code', 'Ad schedule'],
  campaigns.filter(c => c.assets.call).map(c => [c.name, c.assets.call.phone, c.assets.call.country, schedule(c.assets.call)])
);

// Historical volume ignores match type, so each keyword text appears once, in plan order.
const plannerKeywords = [...new Set(campaigns.flatMap(c => c.ad_groups.flatMap(g => g.keywords.map(k => k.text))))];
for (const text of plannerKeywords) {
  if (text.length > 80 || text.split(/\s+/).length > 10) throw new Error(`Too long for Keyword Planner: ${text}`);
}
const plannerFiles = { 'keywords.csv': csv(['Keyword'], plannerKeywords.map(text => [text])) };

let stale = [];
for (const [dir, group] of [[outDir, files], [plannerDir, plannerFiles]]) {
  if (!check) mkdirSync(dir, { recursive: true });
  for (const [name, body] of Object.entries(group)) {
    const path = join(dir, name);
    if (check) {
      let current = null;
      try { current = readFileSync(path, 'utf8'); } catch {}
      if (current !== body) stale.push(join(dir.slice(root.length + 1), name));
    } else {
      writeFileSync(path, body);
    }
  }
}
if (check && stale.length) {
  console.error(`Stale generated files (run without --check to rebuild): ${stale.join(', ')}`);
  process.exit(1);
}
console.log(`${check ? 'Checked' : 'Wrote'} ${Object.keys(files).length} Editor import files in ${outDir} and ${Object.keys(plannerFiles).length} Keyword Planner file in ${plannerDir}`);
