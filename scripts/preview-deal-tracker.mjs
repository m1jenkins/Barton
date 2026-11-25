#!/usr/bin/env node
// Local preview of the Deal Tracker page in every state, for Mason to approve the
// copy before launch. Each page is renderTracker() on a hand-written view, the same
// shape loadBuyerView() returns. Synthetic buyer and dealers; no database, no secrets.
// The Buyer Pick works: a POST saves nothing. A pick or "keep looking" shows the
// confirm page, and confirming it goes to the matching sample. Sending a document
// works too, against a fake local upload endpoint that counts the bytes and keeps
// nothing. Listing photos are the site's own car photos, served at the same
// /deal/<state>/photo/<rank>/<n> path the real page uses. The text number is made up.
// npm run deal-tracker:preview, then open http://127.0.0.1:4180
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { renderLinkClosed, renderPickConfirm, renderTracker } from '../api/_lib/deal-tracker.js';

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
// A made-up number in the 555-01xx range, which is never assigned.
export const SAMPLE_CONTACT = Object.freeze({ href: 'sms:+15125550142', label: '(512) 555-0142' });
// Each sample car's photos, from the site's own vehicle images.
const PHOTOS = Object.freeze({
  1: ['vehicle-toyota-rav4-xle-premium', 'vehicle-toyota-rav4-rear', 'vehicle-toyota-rav4-interior', 'vehicle-toyota-rav4-woodland'],
  2: ['vehicle-honda-cr-v-ex-l', 'vehicle-honda-cr-v-ex-rear', 'vehicle-honda-cr-v-ex-l-interior'],
  3: ['vehicle-mazda-cx-5-front', 'vehicle-mazda-cx-5-rear', 'vehicle-mazda-cx-5-interior']
});
const car = (rank, title, color, mileage, asking, estimate, details, extra = {}) => ({
  rank, title, color, mileage, asking_cents: asking * 100, estimate_cents: estimate * 100, best_cents: null, agreed: false,
  photo_count: PHOTOS[rank].length, details, dealer: null, listing_url: null, ...extra
});
const shortlist = [
  car(1, '2024 Toyota RAV4 XLE', 'Lunar Rock', 12345, 34500, 37777, {
    facts: [{ label: 'Trim', value: 'XLE' }, { label: 'Drivetrain', value: 'AWD' }, { label: 'Engine', value: '2.5L 4-cylinder' },
      { label: 'Transmission', value: '8-speed automatic' }, { label: 'MPG', value: '27 city / 34 highway' }, { label: 'Interior', value: 'Black fabric' }],
    features: ['Blind-spot monitor', 'Power moonroof', 'Heated front seats', 'Apple CarPlay and Android Auto', 'Power liftgate']
  }),
  car(2, '2023 Honda CR-V EX-L', 'Canyon River Blue', 23456, 33900, 37150, {
    facts: [{ label: 'Trim', value: 'EX-L' }, { label: 'Drivetrain', value: 'AWD' }, { label: 'Engine', value: '1.5L turbo 4-cylinder' },
      { label: 'Transmission', value: 'CVT' }, { label: 'Interior', value: 'Gray leather' }],
    features: ['Leather seats', 'Heated front seats', 'Wireless phone charger', 'Power liftgate']
  }),
  car(3, '2024 Mazda CX-5 Select', 'Soul Red', 18990, 31200, 34480, {
    facts: [{ label: 'Trim', value: '2.5 S Select' }, { label: 'Drivetrain', value: 'AWD' }, { label: 'Engine', value: '2.5L 4-cylinder' },
      { label: 'Transmission', value: '6-speed automatic' }],
    features: ['Adaptive cruise control', 'Blind-spot monitor', 'Apple CarPlay and Android Auto']
  })
];
// From Quotes in, each car names its dealer and links its listing (adr/0003).
const dealers = {
  1: { dealer: { name: 'Example Motors of Springfield', location: 'Springfield (about 12 mi)' }, listing_url: 'https://dealer.example/inventory/sample-rav4' },
  2: { dealer: { name: 'Sample Honda', location: 'Shelbyville (about 34 mi)' }, listing_url: 'https://honda.example/inventory/sample-cr-v' },
  3: { dealer: { name: 'Placeholder Mazda', location: 'Capital City (about 58 mi)' }, listing_url: 'https://mazda.example/inventory/sample-cx-5' }
};
const named = item => ({ ...item, ...dealers[item.rank] });
const quoted = [
  named({ ...shortlist[0], best_cents: 3640000 }),
  named({ ...shortlist[1], best_cents: 3690000 }),
  named(shortlist[2])
];
const agreedCars = [
  { ...quoted[0], best_cents: 3610000, agreed: true },
  quoted[1], quoted[2]
];
const agreed = { rank: 1, dealer_name: 'Example Motors of Springfield', otd_cents: 3610000 };
// Buyer Updates as loadBuyerView() returns them: posted only, oldest first.
const update = (id, at, body, extra = {}) => ({ type: 'update', id, body, at, ready_for_pick: false, ...extra });
const confirmed = update(1, '2026-12-01T16:05:00Z', 'Thanks, Sam. I’ve read through your search details and I’m starting with used RAV4s and CR-Vs from 2022 on, within 100 miles of Springfield.\n\nI’ll post the shortlist here in a day or two.');
const emailed = update(2, '2026-12-03T21:40:00Z', 'All three dealers have my email asking for a written out-the-door price. Most answer within two business days.');
const pricesIn = update(3, '2026-12-08T19:15:00Z', 'Two written prices are in. The RAV4 is the best so far at $36,400 out the door, and I’ve asked that dealer to do better on the doc fee.\n\nNothing to do on your side yet.');
const readyForCall = update(4, '2026-12-10T20:15:00Z', 'The RAV4 dealer came down to $36,100. That’s a good price for this car, and I don’t think there’s much more room. Let me know which one you’d like.', { ready_for_pick: true });
// The Buyer Pick in Quotes in: open after a "ready for your call" update, then as picked.
const noPick = { open: false, standing: null };
const pickable = quoted.map(item => ({ ...item, can_pick: item.best_cents != null }));
const picked = (extra = {}) => ({ open: true, standing: { kind: 'pick', rank: 1, otd_cents: 3640000, at: '2026-12-10T22:40:00Z', flag: null, current_cents: 3640000, ...extra } });
// Buyer Document receipts as loadBuyerView() returns them: type and time only.
const docs = (stage, outcome = null) => ({ can_upload: outcome !== 'other', can_upload_id: stage === 'agreed' || outcome === 'bought' });
const sentPreApproval = { doc_type: 'pre_approval', at: '2026-12-02T20:15:00Z' };
const sentTradePhotos = { doc_type: 'trade_in_photos', at: '2026-12-04T17:40:00Z' };
const sentId = { doc_type: 'id', at: '2026-12-11T18:05:00Z' };
const agreedNote = update(5, '2026-12-11T17:30:00Z', 'Done: $36,100 out the door on the RAV4. The dealer has the paperwork ready from Saturday. Bring your license and proof of insurance.');

export const SAMPLE_VIEWS = Object.freeze({
  'confirming-search': { ...docs('confirming'), documents: [], stage: 'confirming', outcome: null, buyer: { ...buyer, recap }, cars: [], agreed: null, timeline: [confirmed] },
  shortlisted: { ...docs('shortlisted'), documents: [sentPreApproval], stage: 'shortlisted', outcome: null, buyer, cars: shortlist, agreed: null, timeline: [confirmed] },
  'emailing-dealers': { ...docs('emailing'), documents: [sentPreApproval], stage: 'emailing', outcome: null, buyer, cars: shortlist, agreed: null, timeline: [confirmed, emailed] },
  'quotes-in': { dealers_shown: true, ...docs('quoted'), documents: [sentPreApproval, sentTradePhotos], stage: 'quoted', outcome: null, buyer, cars: quoted, agreed: null, pick: noPick, timeline: [emailed, pricesIn] },
  'quotes-in-ready': { dealers_shown: true, ...docs('quoted'), documents: [sentPreApproval, sentTradePhotos], stage: 'quoted', outcome: null, buyer, cars: pickable, agreed: null, pick: { open: true, standing: null }, timeline: [emailed, pricesIn, readyForCall] },
  'quotes-in-picked': { dealers_shown: true, ...docs('quoted'), documents: [sentPreApproval, sentTradePhotos], stage: 'quoted', outcome: null, buyer, cars: quoted, agreed: null, pick: picked(), timeline: [emailed, pricesIn, readyForCall] },
  'quotes-in-price-moved': { dealers_shown: true, ...docs('quoted'), documents: [sentPreApproval, sentTradePhotos], stage: 'quoted', outcome: null, buyer, cars: [{ ...quoted[0], best_cents: 3690000 }, quoted[1], quoted[2]], agreed: null,
    pick: picked({ flag: 'price_moved', current_cents: 3690000 }), timeline: [emailed, pricesIn, readyForCall] },
  'quotes-in-keep-looking': { dealers_shown: true, ...docs('quoted'), documents: [sentPreApproval, sentTradePhotos], stage: 'quoted', outcome: null, buyer, cars: quoted, agreed: null,
    pick: { open: true, standing: { kind: 'keep_looking', rank: null, otd_cents: null, at: '2026-12-10T22:40:00Z', flag: null, current_cents: null } }, timeline: [emailed, pricesIn, readyForCall] },
  'price-agreed': { dealers_shown: true, ...docs('agreed'), documents: [sentPreApproval, sentTradePhotos, sentId], stage: 'agreed', outcome: null, buyer, cars: agreedCars, agreed, timeline: [readyForCall, agreedNote] },
  'price-agreed-no-car': { dealers_shown: true, ...docs('agreed'), documents: [sentPreApproval], stage: 'agreed', outcome: null, buyer, cars: quoted, agreed: { rank: null, dealer_name: 'Example Motors of Springfield', otd_cents: 3610000 }, timeline: [agreedNote] },
  'closed-bought': { dealers_shown: true, ...docs('closed', 'bought'), documents: [sentPreApproval, sentTradePhotos, sentId], stage: 'closed', outcome: 'bought', buyer, cars: [agreedCars[0]], agreed, timeline: [agreedNote] },
  'closed-other': { ...docs('closed', 'other'), documents: [], stage: 'closed', outcome: 'other', buyer, cars: [], agreed: null, dealers_shown: false }
});
// The two confirm pages, each the page a pick button or "keep looking" posts to.
export const SAMPLE_CONFIRMS = Object.freeze({ 'confirm-pick': pickable[0], 'confirm-keep-looking': null });
const LABELS = {
  'confirming-search': 'Confirming search', shortlisted: 'Shortlisted', 'emailing-dealers': 'Emailing dealers', 'quotes-in': 'Quotes in',
  'quotes-in-ready': 'Quotes in, ready for your call', 'quotes-in-picked': 'Quotes in, picked', 'quotes-in-price-moved': 'Quotes in, picked and the price moved',
  'quotes-in-keep-looking': 'Quotes in, asked to keep looking', 'confirm-pick': 'Confirm page: a pick', 'confirm-keep-looking': 'Confirm page: keep looking',
  'price-agreed': 'Price agreed', 'price-agreed-no-car': 'Price agreed (no car on the shortlist)', 'closed-bought': 'Closed (bought)',
  'closed-other': 'Closed (other)', 'link-closed': 'Refused link'
};

const mime = { '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.woff2': 'font/woff2', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml' };
const index = () => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Deal Tracker preview</title></head><body style="font:16px/1.6 system-ui;max-width:640px;margin:40px auto;padding:0 16px">
<h1>Deal Tracker preview</h1><p>Sample buyer Sam, sample cars, dealers and text number. Every page is rendered by <code>renderTracker</code>.</p>
<ul>${Object.entries(LABELS).map(([key, label]) => `<li><a href="/deal/${key}">${label}</a></li>`).join('')}</ul></body></html>`;

export function createDealTrackerPreview() {
  return createServer(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    if (!['GET', 'HEAD', 'POST', 'PUT'].includes(req.method)) { res.writeHead(405, { Allow: 'GET, HEAD, POST, PUT' }).end('Method not allowed'); return; }
    let pathname;
    try { pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); }
    catch { res.writeHead(400).end('Invalid path'); return; }
    const html = body => res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }).end(req.method === 'HEAD' ? undefined : body);
    if (pathname === '/') return html(index());
    // The fake store: takes the file's bytes, counts them and keeps nothing.
    if (req.method === 'PUT') {
      if (!/^\/preview-upload\/[0-9a-f-]{36}$/.test(pathname)) { req.resume(); res.writeHead(404).end('Not found'); return; }
      let size = 0;
      for await (const chunk of req) size += chunk.length;
      res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ ok: true, size }));
      return;
    }
    const state = pathname.startsWith('/deal/') ? pathname.slice(6) : null;
    const known = state && Object.hasOwn(SAMPLE_VIEWS, state);
    if (req.method === 'POST') {
      // The pick and documents post here, like the real page. Nothing is kept.
      if (!known) { req.resume(); res.writeHead(404).end('Not found'); return; }
      const chunks = [];
      for await (const chunk of req) if ((chunks.push(chunk), chunks.length > 64)) break;
      const form = new URLSearchParams(Buffer.concat(chunks).toString('utf8').slice(0, 65536));
      const action = form.get('action');
      // A document: the same JSON the real page's script gets, with a local upload URL.
      // The preview's ticket is just the type, so the receipt can name it.
      const json = body => res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' }).end(JSON.stringify(body));
      if (action === 'upload_start') {
        return json({ ok: true, upload: { url: `/preview-upload/${randomUUID()}`, method: 'PUT', headers: { 'x-content-type': form.get('content_type') ?? '' } }, ticket: form.get('doc_type') ?? 'other' });
      }
      if (action === 'upload_done') return json({ ok: true, receipt: { doc_type: form.get('ticket') ?? 'other', at: new Date().toISOString() } });
      if (action === 'pick_review') return html(renderPickConfirm(SAMPLE_VIEWS[state].cars.find(item => String(item.rank) === form.get('car')) ?? pickable[0], `/deal/${state}`, SAMPLE_CONTACT));
      if (action === 'keep_looking_review') return html(renderPickConfirm(null, `/deal/${state}`, SAMPLE_CONTACT));
      const next = { pick: '/deal/quotes-in-picked#dt-pick', keep_looking: '/deal/quotes-in-keep-looking#dt-pick' }[action] ?? `/deal/${state}`;
      res.writeHead(303, { Location: next }).end();
      return;
    }
    // A listing photo: /deal/<state>/photo/<rank>/<n>, from the site's own images.
    const photo = /^\/deal\/[\w-]+\/photo\/(\d)\/(\d{1,2})$/.exec(pathname);
    if (photo) {
      const name = PHOTOS[photo[1]]?.[Number(photo[2])];
      if (!name) { res.writeHead(404).end('Not found'); return; }
      res.writeHead(200, { 'Content-Type': 'image/webp' }).end(req.method === 'HEAD' ? undefined : await readFile(resolve(root, `assets/external/optimized/${name}-960.webp`)));
      return;
    }
    if (state === 'link-closed') return html(renderLinkClosed(SAMPLE_CONTACT));
    if (state && Object.hasOwn(SAMPLE_CONFIRMS, state)) return html(renderPickConfirm(SAMPLE_CONFIRMS[state], '/deal/quotes-in-ready', SAMPLE_CONTACT));
    if (known) return html(renderTracker(SAMPLE_VIEWS[state], { action: `/deal/${state}`, contact: SAMPLE_CONTACT }));
    // The page's own stylesheets, script, fonts and icon; nothing private.
    try {
      if (pathname.split('/').some(part => part.startsWith('.')) || !/^\/(?:buying\/[\w-]+\.css|buying\/deal-tracker\.js|logo-motion\.css|favicon\.png|assets\/buying\/fonts\/[\w-]+\.woff2)$/.test(pathname)) throw new Error('Not served');
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
