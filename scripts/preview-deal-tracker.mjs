#!/usr/bin/env node
// Local preview of the Deal Tracker page in every state, for Mason to approve the
// copy before launch. Each page is renderTracker() on a hand-written view, the same
// shape loadBuyerView() returns. Synthetic buyer and dealers; no database, no secrets.
// The question box and the Buyer Pick work: a POST saves nothing. A question comes
// back to the page; a pick or "keep looking" shows the confirm page, and confirming
// it goes to the matching sample.
// npm run deal-tracker:preview, then open http://127.0.0.1:4180
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
// Buyer Updates as loadBuyerView() returns them: posted only, oldest first.
const update = (id, at, body, extra = {}) => ({ type: 'update', id, body, at, ready_for_pick: false, ...extra });
const confirmed = update(1, '2026-12-01T16:05:00Z', 'Thanks, Sam. I’ve read through your search details and I’m starting with used RAV4s and CR-Vs from 2022 on, within 100 miles of Springfield.\n\nI’ll post the shortlist here in a day or two.');
const emailed = update(2, '2026-12-03T21:40:00Z', 'All three dealers have my email asking for a written out-the-door price. Most answer within two business days.');
const pricesIn = update(3, '2026-12-08T19:15:00Z', 'Two written prices are in. The RAV4 is the best so far at $36,400 out the door, and I’ve asked that dealer to do better on the doc fee.\n\nNothing to do on your side yet.');
const readyForCall = update(4, '2026-12-10T20:15:00Z', 'The RAV4 dealer came down to $36,100. That’s a good price for this car, and I don’t think there’s much more room. Let me know which one you’d like.', { ready_for_pick: true });
// Buyer Questions as loadBuyerView() returns them, and an update that answers one.
const question = (id, at, body, byEmail = false) => ({ type: 'question', id, body, at, by_email: byEmail });
const askedFees = question(11, '2026-12-04T15:20:00Z', 'Will the out-the-door price include the dealer’s doc fee? The last dealer I talked to added $899 at the end.');
const feesAnswer = update(6, '2026-12-04T22:10:00Z', 'Yes. Every written price I ask for is the full total: the sale price, the doc fee, any add-ons, tax and registration.\n\nIf a dealer leaves something out, I send it back.', { answers_question_id: 11 });
const askedPickup = question(12, '2026-12-11T19:05:00Z', 'Can I pick it up Saturday morning, or does it have to be a weekday?', true);
const pickupAnswer = update(7, '2026-12-11T21:00:00Z', 'Saturday works. The dealer is open from 9, and I’ve told them you’re coming then.', { answers_question_id: 12 });
const askedTrade = question(13, '2026-12-05T02:45:00Z', 'Should I get my trade-in appraised somewhere first?');
// The Buyer Pick in Quotes in: open after a "ready for your call" update, then as picked.
const noPick = { open: false, standing: null };
const pickable = quoted.map(item => ({ ...item, can_pick: item.best_cents != null }));
const picked = (extra = {}) => ({ open: true, standing: { kind: 'pick', rank: 1, otd_cents: 3640000, at: '2026-12-10T22:40:00Z', flag: null, current_cents: 3640000, ...extra } });
const agreedNote = update(5, '2026-12-11T17:30:00Z', 'Done: $36,100 out the door on the RAV4. The dealer has the paperwork ready from Saturday. Bring your license and proof of insurance.');

export const SAMPLE_VIEWS = Object.freeze({
  'confirming-search': { stage: 'confirming', outcome: null, buyer: { ...buyer, recap }, cars: [], agreed: null, timeline: [confirmed] },
  shortlisted: { stage: 'shortlisted', outcome: null, buyer, cars: shortlist, agreed: null, timeline: [confirmed] },
  'emailing-dealers': { stage: 'emailing', outcome: null, buyer, cars: shortlist, agreed: null, timeline: [confirmed, emailed, askedFees, feesAnswer, askedTrade] },
  'quotes-in': { stage: 'quoted', outcome: null, buyer, cars: quoted, agreed: null, pick: noPick, timeline: [emailed, askedFees, feesAnswer, pricesIn] },
  'quotes-in-ready': { stage: 'quoted', outcome: null, buyer, cars: pickable, agreed: null, pick: { open: true, standing: null }, timeline: [emailed, pricesIn, readyForCall] },
  'quotes-in-picked': { stage: 'quoted', outcome: null, buyer, cars: quoted, agreed: null, pick: picked(), timeline: [emailed, pricesIn, readyForCall] },
  'quotes-in-price-moved': { stage: 'quoted', outcome: null, buyer, cars: [{ ...quoted[0], best_cents: 3690000 }, quoted[1], quoted[2]], agreed: null,
    pick: picked({ flag: 'price_moved', current_cents: 3690000 }), timeline: [emailed, pricesIn, readyForCall] },
  'quotes-in-keep-looking': { stage: 'quoted', outcome: null, buyer, cars: quoted, agreed: null,
    pick: { open: true, standing: { kind: 'keep_looking', rank: null, otd_cents: null, at: '2026-12-10T22:40:00Z', flag: null, current_cents: null } }, timeline: [emailed, pricesIn, readyForCall] },
  'price-agreed': { stage: 'agreed', outcome: null, buyer, cars: agreedCars, agreed, timeline: [readyForCall, agreedNote, askedPickup, pickupAnswer] },
  'price-agreed-no-car': { stage: 'agreed', outcome: null, buyer, cars: quoted, agreed: { rank: null, dealer_name: 'Example Motors of Springfield', otd_cents: 3610000 }, timeline: [agreedNote] },
  'closed-bought': { stage: 'closed', outcome: 'bought', buyer, cars: [agreedCars[0]], agreed, timeline: [agreedNote] },
  'closed-other': { stage: 'closed', outcome: 'other', buyer, cars: [], agreed: null }
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

const mime = { '.css': 'text/css; charset=utf-8', '.woff2': 'font/woff2', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml' };
const index = () => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Deal Tracker preview</title></head><body style="font:16px/1.6 system-ui;max-width:640px;margin:40px auto;padding:0 16px">
<h1>Deal Tracker preview</h1><p>Sample buyer Sam, sample cars and dealer. Every page is rendered by <code>renderTracker</code>.</p>
<ul>${Object.entries(LABELS).map(([key, label]) => `<li><a href="/deal/${key}">${label}</a></li>`).join('')}</ul></body></html>`;

export function createDealTrackerPreview() {
  return createServer(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    if (!['GET', 'HEAD', 'POST'].includes(req.method)) { res.writeHead(405, { Allow: 'GET, HEAD, POST' }).end('Method not allowed'); return; }
    let pathname;
    try { pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); }
    catch { res.writeHead(400).end('Invalid path'); return; }
    const html = body => res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }).end(req.method === 'HEAD' ? undefined : body);
    if (pathname === '/') return html(index());
    const state = pathname.startsWith('/deal/') ? pathname.slice(6) : null;
    const known = state && Object.hasOwn(SAMPLE_VIEWS, state);
    if (req.method === 'POST') {
      // The question box and the pick post here, like the real page. Nothing is kept.
      if (!known) { req.resume(); res.writeHead(404).end('Not found'); return; }
      const chunks = [];
      for await (const chunk of req) if ((chunks.push(chunk), chunks.length > 64)) break;
      const form = new URLSearchParams(Buffer.concat(chunks).toString('utf8').slice(0, 65536));
      const action = form.get('action');
      if (action === 'pick_review') return html(renderPickConfirm(SAMPLE_VIEWS[state].cars.find(item => String(item.rank) === form.get('car')) ?? pickable[0], `/deal/${state}`));
      if (action === 'keep_looking_review') return html(renderPickConfirm(null, `/deal/${state}`));
      const next = { pick: '/deal/quotes-in-picked#dt-pick', keep_looking: '/deal/quotes-in-keep-looking#dt-pick' }[action] ?? `/deal/${state}#dt-updates`;
      res.writeHead(303, { Location: next }).end();
      return;
    }
    if (state === 'link-closed') return html(renderLinkClosed());
    if (state && Object.hasOwn(SAMPLE_CONFIRMS, state)) return html(renderPickConfirm(SAMPLE_CONFIRMS[state], '/deal/quotes-in-ready'));
    if (known) return html(renderTracker(SAMPLE_VIEWS[state], { action: `/deal/${state}` }));
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
