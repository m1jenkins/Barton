import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
export const S = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
export const REPO = '/home/user/Barton';
export const NEUTRAL = ['whatcarshouldIbuy', 'UsedCars', 'carbuying', 'askcarsales', 'cars', 'personalfinance'];

// Pairs: key a first. Home subreddits are scanned names (case-insensitive compare).
export const PAIRS = {
  'forester-cr-v': { page: 'subaru-forester-vs-honda-cr-v.html', a: 'subaru-forester', b: 'honda-cr-v', homeA: ['SubaruForester'], homeB: ['crv'] },
  'forester-rav4': { page: 'subaru-forester-vs-toyota-rav4.html', a: 'subaru-forester', b: 'toyota-rav4', homeA: ['SubaruForester'], homeB: ['rav4', 'RAV4Club'] },
  'cx-5-rav4': { page: 'mazda-cx-5-vs-toyota-rav4.html', a: 'mazda-cx-5', b: 'toyota-rav4', homeA: ['CX5'], homeB: ['rav4', 'RAV4Club'] },
  'f-150-tundra': { page: 'ford-f-150-vs-toyota-tundra.html', a: 'ford-f-150', b: 'toyota-tundra', homeA: ['f150'], homeB: ['ToyotaTundra', 'tundra'] },
  'colorado-tacoma': { page: 'chevrolet-colorado-vs-toyota-tacoma.html', a: 'chevrolet-colorado', b: 'toyota-tacoma', homeA: ['ChevyColorado'], homeB: ['ToyotaTacoma', 'Tacomaworld'] },
  'f-150-sierra': { page: 'ford-f-150-vs-gmc-sierra-1500.html', a: 'ford-f-150', b: 'gmc-sierra-1500', homeA: ['f150'], homeB: ['gmcsierra'] },
};

// Target cars' name patterns. Strict is for neutral subs, loose for the car's own subreddit.
const t = s => s.toLowerCase();
export const CAR = {
  'subaru-forester': { strict: /\bforesters?\b/i, loose: /\bforesters?\b/i },
  'honda-cr-v': { strict: /\bcr-?vs?\b/i, loose: /\bcr-?vs?\b/i },
  'toyota-rav4': { strict: /\brav[- ]?4s?\b/i, loose: /\brav[- ]?4s?\b/i },
  'mazda-cx-5': { strict: /\bcx[- ]?5s?\b/i, loose: /\bcx[- ]?5s?\b/i },
  'ford-f-150': { strict: /\bf[- ]?150s?\b(?![- ]?lightning)/i, loose: /\bf[- ]?150s?\b(?![- ]?lightning)/i },
  'toyota-tundra': { strict: /\btundras?\b/i, loose: /\btundras?\b/i },
  'gmc-sierra-1500': { strict: x => /\bsierras?\b/i.test(x) && /\b(gmc|denali|at4x?|silverado|truck|pickup)\b/i.test(x) && !/sierra (nevada|club|leone|mist)/i.test(x), loose: /\b(sierras?|gmc)\b/i },
  'chevrolet-colorado': { strict: x => (/\b(chevy|chevrolet)\s+colorado\b|\bcolorado\s+(zr2|z71|trail ?boss|bison|crew|extended|diesel|truck|pickup|wt|lt)\b|\b(19|20)\d\d\s+colorado\b/i.test(x)) || (/\bcolorados?\b/i.test(x) && /\b(zr2|z71|trail ?boss|tacoma|canyon|ranger|midsize|mid-size|pickup|truck)\b/i.test(x) && !/\bcolorado (springs|river|state|mountains|rockies|denver)\b/i.test(x) && !/\b(in|to|from|moving to|live in) colorado\b/i.test(x)), loose: /\bcolorados?\b/i },
  'toyota-tacoma': { strict: x => /\btacomas?\b/i.test(x) && /\b(toyota|truck|pickup|trd|sr5|trailhunter|midsize|mid-size|colorado|ranger|tundra|4runner|hilux|4x4)\b/i.test(x) && !/\btacoma (wa|washington|mall|narrows|dome)\b/i.test(x), loose: /\btacomas?\b/i },
};
export const match = (car, text, home) => { const r = CAR[car][home ? 'loose' : 'strict']; return typeof r === 'function' ? r(text) : r.test(text); };

// Model vocabulary for thread `names`.
let vocab;
export async function names(text) {
  if (!vocab) {
    const models = JSON.parse(await readFile(path.join(REPO, 'data/reddit-sentiment/models.json'), 'utf8'));
    const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const flex = s => esc(s).replace(/\\?-/g, '[- ]?').replace(/ /g, '[ -]?');
    vocab = [];
    for (const [key, name] of Object.entries(models)) {
      if (CAR[key]) continue;
      const parts = name.split(' '); const model = parts.slice(1).join(' ');
      const pats = [`\\b${flex(name)}s?\\b`];
      if (model.length >= 5 && !/^(model|series|class|e-tron|ev|hybrid)/i.test(model) && !/^\d/.test(model)) pats.push(`\\b${flex(model)}s?\\b`);
      vocab.push([key, new RegExp(pats.join('|'), 'i')]);
    }
    vocab.push(['chevrolet-silverado-1500', /\bsilverados?\b/i], ['ford-ranger', /\brangers?\b(?=.{0,80}(ford|truck|pickup))|\bford ranger\b/is], ['ram-1500', /\bram( 1500)?\b(?=.{0,60}(truck|1500|pickup))|\bram 1500\b/is]);
  }
  const out = new Set();
  for (const car of Object.keys(CAR)) if (match(car, text, false)) out.add(car);
  for (const [key, re] of vocab) if (re.test(text)) out.add(key);
  return [...out].sort();
}
export async function readPosts(sub) {
  const dir = path.join(S, 'raw/posts', sub);
  let files = []; try { files = (await readdir(dir)).filter(f => f.endsWith('.json')).sort(); } catch {}
  const all = []; for (const f of files) all.push(...JSON.parse(await readFile(path.join(dir, f), 'utf8')));
  return all;
}
export const iso = sec => new Date(sec * 1000).toISOString().slice(0, 10);
