import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { cancelCustomerEmails } from '../api/_lib/customer-email.js';
import { TEMPLATE_NAMES, buyerFromRow, renderCustomerEmail } from '../api/_lib/customer-emails/index.js';
import { database } from '../api/_lib/db.js';
import { escapeHtml as e, intakeEmailSettings, smtpTransport } from '../api/_lib/intake-email.js';
import { runCustomerEmailWorker } from '../api/_lib/outbox-workers.js';
import { localEnv } from './car-search.mjs';

// Automated buyer emails (api/_lib/customer-email.js):
//   npm run customer-emails:preview                   render every email for sample buyers into .email-previews/
//   npm run customer-emails:test -- <template|all>    send sample renders to Mason only (INTAKE_EMAIL_TO)
//   npm run customer-emails:dispatch                  queue closed deals and send what's due, once
//   npm run customer-emails:cancel -- <intake ID>     stop every email not yet sent to that buyer
// test, dispatch and cancel read INTAKE_SMTP_*, DATABASE_URL and the rest from the
// environment or .env.local.
const USAGE = 'Usage: node scripts/customer-emails.mjs preview | test <template|all> | dispatch | cancel <intake ID>';
export const SAMPLE_REVIEW_URL = 'https://g.page/r/sample-review-link/review';

// Made-up buyers that cover each plan and the edge cases a template must survive.
export const SAMPLE_BUYERS = Object.freeze({
  standard: {
    label: '$395 plan, full answers',
    row: {
      tier_id: 'full_service', name: 'Pat Rivera', city: 'Tuscaloosa, AL',
      fields: {
        preferred_makes: 'Subaru Ascent', vehicle_type: 'SUV', condition: 'New', budget: 'Up to $42,000 out the door',
        payment_method: 'Financing', trade_in: 'Yes, I have a trade-in', timeline: 'Within a month',
        search_radius: 'Within 150 miles', delivery_address: '12 Private Lane', notes: 'Kids, dog, lots of road trips'
      }
    }
  },
  pro: {
    label: 'Pro plan',
    row: {
      tier_id: 'concierge', name: 'Jordan Lee', city: 'Austin, TX',
      fields: {
        preferred_makes: 'BMW X5, Mercedes GLE or Genesis GV80', condition: 'New or CPO', budget: '$70,000–$80,000',
        payment_method: 'Cash', trade_in: 'No trade-in', timeline: '1–3 months'
      }
    }
  },
  sparse: {
    label: 'Sparse answers, no city',
    row: { tier_id: 'full_service', name: 'sam', city: '', fields: { vehicle_type: 'Truck' } }
  },
  awkward: {
    label: 'Long name and HTML characters',
    row: {
      tier_id: 'concierge', name: 'Maximiliana-Christabel <b>O’Connor-Washington</b> III', city: 'Saint Petersburg & Tampa, FL',
      fields: {
        preferred_makes: 'Toyota Grand Highlander <script>alert(1)</script> Hybrid Max Platinum with every package there is, in any color but white, black or that dull grey',
        budget: 'Under $60k "all in"', trade_in: 'Maybe', payment_method: 'Not sure yet'
      }
    }
  }
});

export function renderSamples() {
  return Object.entries(SAMPLE_BUYERS).flatMap(([key, sample]) => TEMPLATE_NAMES.map(template => ({
    key, template, label: sample.label,
    ...renderCustomerEmail(template, buyerFromRow(sample.row), { reviewUrl: SAMPLE_REVIEW_URL })
  })));
}

function previewIndex(renders) {
  const nav = TEMPLATE_NAMES.map(template => `<a href="#${template}">${template.replace(/_/g, ' ')}</a>`).join(' · ');
  const sections = TEMPLATE_NAMES.map(template => `<section id="${template}"><h2>${template.replace(/_/g, ' ')}</h2>`
    + renders.filter(render => render.template === template).map(render => `<article>`
      + `<p class="who">${e(render.label)} · ${(Buffer.byteLength(render.html) / 1024).toFixed(1)} KB</p>`
      + `<p class="subject">${e(render.subject)}</p><p class="pre">${e(render.preheader)}</p>`
      + `<div class="frames"><iframe title="${e(render.subject)}" src="${render.key}-${template}.html" width="640" height="900"></iframe>`
      + `<iframe class="mobile" title="${e(render.subject)}, phone width" src="${render.key}-${template}.html" width="375" height="900"></iframe></div>`
      + `<details><summary>Plain-text version</summary><pre>${e(render.text)}</pre></details></article>`).join('')
    + `</section>`).join('');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Customer email previews</title>`
    + `<style>body{margin:0;padding:24px;font:15px/1.5 -apple-system,Segoe UI,Helvetica,Arial,sans-serif;background:#f6f7f9;color:#0E1B2E}`
    + `h1{margin:0 0 4px}h2{margin:40px 0 8px;text-transform:capitalize}nav{margin-bottom:8px}nav a{color:#1A4B8C;text-transform:capitalize}`
    + `article{margin:16px 0 32px;padding:16px;background:#fff;border:1px solid #DDE2E9;border-radius:12px}`
    + `.who{margin:0;color:#6B7585;font-size:13px}.subject{margin:4px 0 0;font-weight:600}.pre{margin:0 0 12px;color:#465061}`
    + `.frames{display:flex;gap:16px;flex-wrap:wrap;align-items:flex-start}iframe{border:1px solid #DDE2E9;border-radius:8px;background:#fff;max-width:100%}`
    + `pre{white-space:pre-wrap;background:#f6f7f9;padding:12px;border-radius:8px;font-size:13px}</style></head>`
    + `<body><h1>Customer email previews</h1><p>Sample buyers only. Each email at desktop and phone width; subject and inbox preview text above it.</p>`
    + `<nav>${nav}</nav>${sections}</body></html>`;
}

export async function writePreviews(folder = new URL('../.email-previews/', import.meta.url)) {
  const renders = renderSamples();
  await mkdir(folder, { recursive: true });
  for (const render of renders) {
    await writeFile(new URL(`${render.key}-${render.template}.html`, folder), render.html);
    await writeFile(new URL(`${render.key}-${render.template}.txt`, folder), render.text);
  }
  await writeFile(new URL('index.html', folder), previewIndex(renders));
  return { folder: resolve(new URL(folder).pathname), count: renders.length };
}

async function sendTests(which, environment) {
  const templates = which === 'all' ? TEMPLATE_NAMES : [which];
  if (!templates.every(template => TEMPLATE_NAMES.includes(template))) throw new Error(`Template must be all or one of: ${TEMPLATE_NAMES.join(', ')}`);
  const settings = intakeEmailSettings(environment);
  if (!settings) throw new Error('INTAKE_SMTP_USER and INTAKE_SMTP_PASSWORD are not set. Add them to .env.local.');
  const reviewUrl = environment.GOOGLE_REVIEW_URL?.trim() || SAMPLE_REVIEW_URL;
  const transport = smtpTransport(settings);
  try {
    for (const template of templates) {
      const { subject, text, html } = renderCustomerEmail(template, buyerFromRow(SAMPLE_BUYERS.standard.row), { reviewUrl });
      await transport.sendMail({
        from: { name: 'Mason at Steer Me Right', address: settings.user }, to: settings.to,
        subject: `[Test] ${subject}`, text, html, headers: { 'X-Steer-Customer-Email': `test:${template}` }
      });
      console.log(`Sent ${template} to ${settings.to}`);
    }
  } finally {
    transport.close?.();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [command, argument] = process.argv.slice(2);
  const environment = { ...localEnv(), ...process.env };
  try {
    if (command === 'preview') {
      const { folder, count } = await writePreviews();
      console.log(`Wrote ${count} emails to ${folder}. Open index.html there.`);
    } else if (command === 'test' && argument) {
      await sendTests(argument, environment);
    } else if (command === 'dispatch') {
      Object.assign(process.env, environment);
      const result = await runCustomerEmailWorker({ environment });
      console.log(JSON.stringify(result));
      process.exitCode = result.exitCode;
    } else if (command === 'cancel' && /^[0-9a-f-]{36}$/i.test(argument || '')) {
      Object.assign(process.env, environment);
      const sql = database();
      try {
        const cancelled = await cancelCustomerEmails(sql, argument);
        console.log(cancelled.length ? `Cancelled: ${cancelled.join(', ')}` : 'Nothing left to cancel for that intake.');
      } finally {
        await sql.end({ timeout: 5 });
      }
    } else {
      console.error(USAGE);
      process.exitCode = 1;
    }
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
