#!/usr/bin/env node
// Local preview of the Deal Tracker page in every state, for Mason to approve the
// copy before launch. Each page is renderTracker() on a hand-written view, the same
// shape loadBuyerView() returns. Synthetic buyer and dealers; no database, no secrets.
// npm run deal-tracker:preview, then open http://127.0.0.1:4180
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { renderLinkClosed, renderTracker } from '../api/_lib/deal-tracker.js';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const buyer = {
  first_name: 'Sam', plan: 'Steer Me Right', finance: true, trade_in: true, recap: []
};
const recap = [
  { label: 'Car', value: 'Toyota RAV4 or Honda CR-V' }, { label: 'New or used', value: 'Used' },
  { label: 'Model years', value: '2022 or newer' }, { label: 'All-in budget', value: '$38,000' },
  { label: 'Paying', value: 'Financing' }, { label: 'Trade-in', value: 'Yes' },
  { label: 'Timing', value: 'Within a month' }, { label: 'How far', value: 'Up to 100 miles' },
  { label: 'Where you are', value: 'Springfield' }
];
const car = (rank, title, color, mileage, asking, estimate, extra = {}) => ({
  rank, title, color, mileage, asking_cents: asking * 100, estimate_cents: estimate * 100, best_cents: null, agreed: false, listing_url: null, ...extra
});
const shortlist = [
  car(1, '2024 Toyota RAV4 XLE', 'Lunar Rock', 12345, 34500, 37777),
  car(2, '2023 Honda CR-V EX-L', 'Canyon River Blue', 23456, 33900, 37150),
  car(3, '2024 Mazda CX-5 Select', 'Soul Red', 18990, 31200, 34480)
];
const quoted = [
  { ...shortlist[0], best_cents: 3640000 },
  { ...shortlist[1], best_cents: 3690000 },
  shortlist[2]
];
const agreedCars = [
  { ...quoted[0], best_cents: 3610000, agreed: true, listing_url: 'https://dealer.example/inventory/sample-rav4' },
  quoted[1], quoted[2]
];
const agreed = { rank: 1, dealer_name: 'Example Motors of Springfield', otd_cents: 3610000 };

export const SAMPLE_VIEWS = Object.freeze({
  'confirming-search': { stage: 'confirming', outcome: null, buyer: { ...buyer, recap }, cars: [], agreed: null },
  shortlisted: { stage: 'shortlisted', outcome: null, buyer, cars: shortlist, agreed: null },
  'emailing-dealers': { stage: 'emailing', outcome: null, buyer, cars: shortlist, agreed: null },
  'quotes-in': { stage: 'quoted', outcome: null, buyer, cars: quoted, agreed: null },
  'price-agreed': { stage: 'agreed', outcome: null, buyer, cars: agreedCars, agreed },
  'price-agreed-no-car': { stage: 'agreed', outcome: null, buyer, cars: quoted, agreed: { rank: null, dealer_name: 'Example Motors of Springfield', otd_cents: 3610000 } },
  'closed-bought': { stage: 'closed', outcome: 'bought', buyer, cars: [agreedCars[0]], agreed },
  'closed-other': { stage: 'closed', outcome: 'other', buyer, cars: [], agreed: null }
});
const LABELS = {
  'confirming-search': 'Confirming search', shortlisted: 'Shortlisted', 'emailing-dealers': 'Emailing dealers', 'quotes-in': 'Quotes in',
  'price-agreed': 'Price agreed', 'price-agreed-no-car': 'Price agreed (no car on the shortlist)', 'closed-bought': 'Closed (bought)',
  'closed-other': 'Closed (other)', 'link-closed': 'Refused link'
};

const mime = { '.css': 'text/css; charset=utf-8', '.woff2': 'font/woff2', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml' };
const index = () => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Deal Tracker preview</title></head><body style="font:16px/1.6 system-ui;max-width:640px;margin:40px auto;padding:0 16px">
<h1>Deal Tracker preview</h1><p>Sample buyer Sam, sample cars and dealer. Every page is rendered by <code>renderTracker</code>.</p>
<ul>${Object.entries(LABELS).map(([key, label]) => `<li><a href="/deal/${key}">${label}</a></li>`).join('')}</ul></body></html>`;

export function createDealTrackerPreview() {
  return createServer(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405, { Allow: 'GET, HEAD' }).end('Method not allowed'); return; }
    let pathname;
    try { pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); }
    catch { res.writeHead(400).end('Invalid path'); return; }
    const html = body => res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }).end(req.method === 'HEAD' ? undefined : body);
    if (pathname === '/') return html(index());
    const state = pathname.startsWith('/deal/') ? pathname.slice(6) : null;
    if (state === 'link-closed') return html(renderLinkClosed());
    if (state && Object.hasOwn(SAMPLE_VIEWS, state)) return html(renderTracker(SAMPLE_VIEWS[state]));
    // The page's own stylesheets, fonts and icon; nothing private.
    try {
      if (pathname.split('/').some(part => part.startsWith('.')) || !/^\/(?:buying\/[\w-]+\.css|logo-motion\.css|favicon\.png|assets\/buying\/fonts\/[\w-]+\.woff2)$/.test(pathname)) throw new Error('Not served');
      const file = resolve(root, `.${pathname}`);
      if (!file.startsWith(root + sep) || !(await stat(file)).isFile()) throw new Error('Not a file');
      res.writeHead(200, { 'Content-Type': mime[extname(file)] }).end(req.method === 'HEAD' ? undefined : await readFile(file));
    } catch { res.writeHead(404).end('Not found'); }
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.env.DEAL_TRACKER_PREVIEW_PORT || 4180);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid DEAL_TRACKER_PREVIEW_PORT');
  createDealTrackerPreview().listen(port, '127.0.0.1', () => console.log(`Deal Tracker preview: http://127.0.0.1:${port}`));
}
