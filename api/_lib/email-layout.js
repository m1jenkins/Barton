import { escapeHtml as e, oneLine } from './intake-email.js';

// The shell every customer email shares (api/_lib/customer-emails/). A template
// describes its content as a list of nodes, and this file turns the same list
// into the HTML part and the plain-text part, so the two always say the same thing.
// The look follows the deal update email (scripts/deal-update-email.mjs): the site's
// palette and fonts, table layout only, because email clients strip flex, grid,
// SVG and scripts. Nothing here reads data: templates pass only what they show.

export const COLOR = Object.freeze({
  navy: '#0E1B2E', sign: '#1A4B8C', tint: '#EDF0F4', sky: '#E3ECF8', line: '#DDE2E9', grid: '#E8ECF1',
  body: '#465061', soft: '#6B7585', white: '#FFFFFF'
});
const FONT = "Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif";
const DISPLAY = "'Inter Tight',Inter,'Helvetica Neue',Arial,sans-serif";
const FONT_ORIGIN = 'https://www.steermeright.com/assets/buying/fonts';
export const SITE = 'https://www.steermeright.com';
export const HELLO = 'hello@steermeright.com';

export function safeUrl(value) {
  try {
    const url = new URL(String(value));
    if (url.protocol === 'https:' && !url.username && !url.password) return url.href;
  } catch {}
  return '';
}

// ---------- Content nodes ----------
// A paragraph's text is a string, or an array of strings and { b: 'bold text' }.

export const paragraph = text => ({ kind: 'p', text });
export const note = text => ({ kind: 'note', text });
export const steps = items => ({ kind: 'steps', items });
export const checklist = items => ({ kind: 'checklist', items });
// Things to avoid: a muted cross instead of a check.
export const avoidList = items => ({ kind: 'checklist', items, avoid: true });
export const rows = items => ({ kind: 'rows', items: items.filter(([, value]) => oneLine(value)) });
export const button = (href, label) => ({ kind: 'button', href: safeUrl(href), label });
export const card = (title, nodes, sub = '') => ({ title, sub, nodes: nodes.filter(Boolean) });

const parts = text => (Array.isArray(text) ? text : [text]).filter(part => part != null && part !== '');
const plain = text => parts(text).map(part => typeof part === 'string' ? part : part.b).join('');
const rich = text => parts(text).map(part => typeof part === 'string'
  ? e(part) : `<strong style="font-weight:600;color:${COLOR.navy}">${e(part.b)}</strong>`).join('');

const BODY = `font:400 15px/1.6 ${FONT};color:${COLOR.body}`;
const table = inner => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${inner}</table>`;

function nodeHtml(node) {
  switch (node.kind) {
    case 'p': return `<p style="margin:12px 0 0;${BODY}">${rich(node.text)}</p>`;
    case 'note': return `<p style="margin:14px 0 0;font:400 13px/1.55 ${FONT};color:${COLOR.soft}">${rich(node.text)}</p>`;
    case 'steps': return `<div style="margin-top:6px">${table(node.items.map((item, index) => `<tr>`
      + `<td width="44" valign="top" style="padding:14px 0 0;font:900 20px/1.2 ${DISPLAY};color:${COLOR.sign}">${String(index + 1).padStart(2, '0')}</td>`
      + `<td valign="top" style="padding:14px 0 0">`
      + `<p style="margin:0;font:600 16px/1.4 ${FONT};color:${COLOR.navy}">${e(item.title)}</p>`
      + `<p style="margin:4px 0 0;${BODY}">${rich(item.body)}</p></td></tr>`).join(''))}</div>`;
    case 'checklist': return `<div style="margin-top:6px">${table(node.items.map(item => `<tr>`
      + `<td width="26" valign="top" style="padding:11px 0 0;font:600 15px/1.6 ${FONT};color:${node.avoid ? COLOR.soft : COLOR.sign}">${node.avoid ? '&#10005;' : '&#10003;'}</td>`
      + `<td valign="top" style="padding:11px 0 0;${BODY}">${rich(item)}</td></tr>`).join(''))}</div>`;
    case 'rows': return `<div style="margin-top:10px">${table(node.items.map(([label, value]) => `<tr>`
      + `<td class="stack" width="150" valign="top" style="padding:9px 14px 9px 0;font:600 14px/1.5 ${FONT};color:${COLOR.soft};border-top:1px solid ${COLOR.grid}">${e(label)}</td>`
      + `<td class="stack" valign="top" style="padding:9px 0;font:400 15px/1.5 ${FONT};color:${COLOR.navy};border-top:1px solid ${COLOR.grid}">${e(oneLine(value))}</td></tr>`).join(''))}</div>`;
    case 'button': return node.href ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:20px"><tr>`
      + `<td bgcolor="${COLOR.navy}" style="background:${COLOR.navy};border-radius:999px">`
      + `<a href="${e(node.href)}" style="display:inline-block;padding:14px 26px;font:600 15px/1 ${FONT};color:${COLOR.white};text-decoration:none;border-radius:999px">${e(node.label)}</a>`
      + `</td></tr></table>` : '';
    default: throw new Error(`Unknown email node: ${node.kind}`);
  }
}

function nodeText(node) {
  switch (node.kind) {
    case 'p': case 'note': return plain(node.text);
    case 'steps': return node.items.map((item, index) => `${index + 1}. ${item.title}\n   ${plain(item.body)}`).join('\n');
    case 'checklist': return node.items.map(item => `${node.avoid ? 'x' : '-'} ${plain(item)}`).join('\n');
    case 'rows': return node.items.map(([label, value]) => `${label}: ${oneLine(value)}`).join('\n');
    case 'button': return node.href ? `${node.label}: ${node.href}` : '';
    default: throw new Error(`Unknown email node: ${node.kind}`);
  }
}

const STYLE = `
@font-face{font-family:Inter;src:url('${FONT_ORIGIN}/inter-latin.woff2') format('woff2');font-weight:400;font-style:normal}
@font-face{font-family:Inter;src:url('${FONT_ORIGIN}/inter-semibold-latin.woff2') format('woff2');font-weight:600;font-style:normal}
@font-face{font-family:'Inter Tight';src:url('${FONT_ORIGIN}/inter-tight-black-latin.woff2') format('woff2');font-weight:900;font-style:normal}
body,table,td{-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%}
a{color:${COLOR.sign}}
@media only screen and (max-width:620px){
  .shell{width:100%!important}
  .pad{padding-left:20px!important;padding-right:20px!important}
  .gutter{padding-left:12px!important;padding-right:12px!important}
  .stack{display:block!important;width:100%!important;padding-right:0!important}
  .stack+.stack{border-top:0!important;padding-top:0!important}
  .h1{font-size:38px!important}
}`;

// email: { subject, preheader, kicker, heading, intro: [text], cards: [card], signoff }
export function renderEmail({ subject, preheader, kicker, heading, intro, cards, signoff }) {
  const cleanSubject = oneLine(subject).slice(0, 200);
  const introHtml = intro.map(text => `<p style="margin:14px 0 0;font:400 17px/1.55 ${FONT};color:${COLOR.white}">${rich(text)}</p>`).join('');
  const cardHtml = cards.map(c => `<tr><td style="padding:0 0 12px">`
    + `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${COLOR.white}" style="background:${COLOR.white};border:1px solid ${COLOR.line};border-radius:16px">`
    + `<tr><td class="pad" style="padding:24px 28px 26px;font-family:${FONT}">`
    + `<h2 style="margin:0;font:600 19px/1.3 ${FONT};color:${COLOR.navy}">${e(c.title)}</h2>`
    + (c.sub ? `<p style="margin:4px 0 0;font:400 14px/1.5 ${FONT};color:${COLOR.soft}">${rich(c.sub)}</p>` : '')
    + c.nodes.map(nodeHtml).join('')
    + `</td></tr></table></td></tr>`).join('');

  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8">`
    + `<meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light">`
    + `<meta name="x-apple-disable-message-reformatting"><title>${e(cleanSubject)}</title><style>${STYLE}</style></head>`
    + `<body style="margin:0;padding:0;background:${COLOR.tint};font-family:${FONT}">`
    + `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:${COLOR.tint};font-size:1px;line-height:1px">${e(oneLine(preheader))}${'&zwnj;&nbsp;'.repeat(40)}</div>`
    + `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${COLOR.tint}" style="background:${COLOR.tint}"><tr><td align="center" class="gutter" style="padding:0 0 28px">`
    + `<table role="presentation" class="shell" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px">`
    // Top bar
    + `<tr><td>${table(`<tr><td bgcolor="${COLOR.white}" class="pad" style="background:${COLOR.white};padding:18px 28px;border-bottom:1px solid ${COLOR.line}">`
      + `<a href="${SITE}/" style="font:600 22px/1 ${FONT};letter-spacing:-1px;color:${COLOR.navy};text-decoration:none">steer me right</a></td></tr>`)}</td></tr>`
    // Title band
    + `<tr><td bgcolor="${COLOR.sign}" class="pad" style="background:${COLOR.sign};padding:32px 28px 30px">`
    + (kicker ? `<p style="margin:0 0 12px;font:600 14px/1.3 ${FONT};color:${COLOR.sky}">${e(kicker)}</p>` : '')
    + `<h1 class="h1" style="margin:0;font:900 46px/0.96 ${DISPLAY};letter-spacing:-0.4px;text-transform:uppercase;color:${COLOR.white}">${e(heading)}</h1>`
    + introHtml
    + `</td></tr>`
    + `<tr><td style="padding:12px 0 0;font-size:0;line-height:0">&nbsp;</td></tr>`
    + cardHtml
    // Sign-off
    + `<tr><td class="pad" style="padding:10px 28px 0">`
    + `<p style="margin:0;${BODY}">${e(signoff)}</p>`
    + `<p style="margin:2px 0 0;font:600 16px/1.5 ${FONT};color:${COLOR.navy}">Mason</p>`
    + `<p style="margin:0;font:400 14px/1.5 ${FONT};color:${COLOR.soft}">Founder and lead advisor, Steer Me Right</p>`
    + `<p style="margin:14px 0 0;${BODY}">Reply to this email any time. It comes straight to me.</p>`
    + `</td></tr>`
    // Footer
    + `<tr><td class="pad" style="padding:22px 28px 0;font:400 12px/1.6 ${FONT};color:${COLOR.soft}">`
    + `Steer Me Right · Car research and negotiation, based in Austin, here for buyers nationwide<br>`
    + `<a href="mailto:${HELLO}" style="color:${COLOR.soft}">${HELLO}</a> · Mon–Fri, 9 a.m.–5 p.m. Central · <a href="${SITE}/" style="color:${COLOR.soft}">steermeright.com</a><br>`
    + `You’re getting this email because you bought a Steer Me Right plan.`
    + `</td></tr>`
    + `</table></td></tr></table></body></html>`;

  const text = [
    heading.toUpperCase(),
    kicker || '',
    '',
    ...intro.map(plain).flatMap(line => [line, '']),
    ...cards.flatMap(c => [
      c.title.toUpperCase(),
      c.sub ? plain(c.sub) : '',
      ...c.nodes.map(nodeText).filter(Boolean).flatMap(block => [block, '']),
      ''
    ]),
    signoff, 'Mason', 'Founder and lead advisor, Steer Me Right', '',
    'Reply to this email any time. It comes straight to me.', '',
    '--',
    `Steer Me Right · ${HELLO} · Mon–Fri, 9 a.m.–5 p.m. Central · steermeright.com`,
    'You’re getting this email because you bought a Steer Me Right plan.'
  ].filter((line, index, all) => line !== '' || (index > 0 && all[index - 1] !== '')).join('\n').trim() + '\n';

  return { subject: cleanSubject, preheader: oneLine(preheader), html, text };
}
