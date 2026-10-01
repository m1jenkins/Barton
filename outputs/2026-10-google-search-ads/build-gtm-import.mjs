// Builds the GTM "Merge" import for container GTM-W577B3D4 from docs/google-ads-setup.md §3.
// Usage: node outputs/2026-10-google-search-ads/build-gtm-import.mjs [--check]
// The file only adds new variables, triggers (including the two Consent Initialization triggers)
// and the two new conversion tags. Edits to existing
// tags (Call Button, the three tags to pause, the Google tag's page_location) and the consent
// default tag are manual; gtm/README.md lists them. Import with Admin → Import Container →
// existing workspace "Google Ads purchase tracking" → Merge → "Rename conflicting".
// Entity IDs start at 900 so they can't collide with the live container's (Version 6 tops out at 25).
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const outFile = join(root, 'gtm', 'gtm-import-merge.json');
const guide = readFileSync(join(root, '..', '..', 'docs', 'google-ads-setup.md'), 'utf8');
const check = process.argv.includes('--check');

const ACCOUNT_ID = '6349220223';
const CONTAINER_ID = '249056149';
const PUBLIC_ID = 'GTM-W577B3D4';
const CONVERSION_ID = '18071301983';
const HOSTNAME = 'www.driverightcarbuying.com';
const LABELS = { purchase: 'r1JaCNq9v4gdEN_eiKlD', beginCheckout: 'A1cuCKHhx4gdEN_eiKlD', phoneClick: 'AmVzCKThx4gdEN_eiKlD' };
const UUID_RE = '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

// The guide is the source of truth for labels; fail rather than import a stale one.
for (const [name, label] of Object.entries(LABELS)) {
  if (!guide.includes(label)) throw new Error(`Label for ${name} (${label}) is not in docs/google-ads-setup.md`);
}

const ids = { accountId: ACCOUNT_ID, containerId: CONTAINER_ID };
const template = (key, value) => ({ type: 'TEMPLATE', key, value });
const boolean = (key, value) => ({ type: 'BOOLEAN', key, value: String(value) });
const condition = (type, arg0, arg1) => ({ type, parameter: [template('arg0', arg0), template('arg1', arg1)] });
const hostnameIs = condition('EQUALS', '{{Page Hostname}}', HOSTNAME);

const dlv = (variableId, key) => ({
  ...ids, variableId, name: `DLV – ${key}`, type: 'v', fingerprint: '0',
  parameter: [{ type: 'INTEGER', key: 'dataLayerVersion', value: '2' }, boolean('setDefaultValue', false), template('name', key)],
});

const variable = [
  dlv('901', 'transaction_id'),
  dlv('902', 'value'),
  dlv('903', 'currency'),
  dlv('904', 'service_tier'),
  dlv('905', 'checkout_attempt_id'),
  { ...ids, variableId: '906', name: 'JS – GPC', type: 'j', fingerprint: '0', parameter: [template('name', 'navigator.globalPrivacyControl')] },
  {
    ...ids, variableId: '907', name: 'Page URL – sanitized', type: 'remm', fingerprint: '0',
    notes: 'Drops the query string (Stripe session_id) on /payment-success* pages; every other page passes Page URL through.',
    parameter: [
      boolean('setDefaultValue', true),
      template('input', '{{Page Path}}'),
      boolean('fullMatch', true),
      boolean('replaceAll', false),
      boolean('ignoreCase', true),
      template('defaultValue', '{{Page URL}}'),
      { type: 'LIST', key: 'map', list: [{ type: 'MAP', map: [template('key', '^/payment-success.*$'), template('value', 'https://{{Page Hostname}}{{Page Path}}')] }] },
    ],
  },
];

const customEvent = (triggerId, event, extra = []) => ({
  ...ids, triggerId, name: `CE – ${event}`, type: 'CUSTOM_EVENT', fingerprint: '0',
  customEventFilter: [condition('EQUALS', '{{_event}}', event)],
  filter: [hostnameIs, ...extra],
});

const trigger = [
  customEvent('911', 'purchase_verified', [
    condition('MATCH_REGEX', '{{DLV – service_tier}}', '^(full_service|concierge)$'),
    condition('GREATER', '{{DLV – value}}', '0'),
    condition('MATCH_REGEX', '{{DLV – transaction_id}}', UUID_RE),
  ]),
  customEvent('912', 'begin_checkout'),
  customEvent('913', 'phone_click'),
  // The consent default tags (manual, from a gallery template) fire on exactly one of these.
  { ...ids, triggerId: '914', name: 'Consent Init – GPC on', type: 'CONSENT_INIT', fingerprint: '0', filter: [condition('EQUALS', '{{JS – GPC}}', 'true')] },
  { ...ids, triggerId: '915', name: 'Consent Init – GPC off', type: 'CONSENT_INIT', fingerprint: '0', filter: [{ ...condition('EQUALS', '{{JS – GPC}}', 'true'), negate: true }] },
];

const conversionTag = (tagId, name, label, firingTriggerId, extra) => ({
  ...ids, tagId, name, type: 'awct', fingerprint: '0',
  parameter: [
    boolean('enableNewCustomerReporting', false),
    boolean('enableConversionLinker', true),
    boolean('enableProductReporting', false),
    boolean('enableShippingData', false),
    template('conversionId', CONVERSION_ID),
    template('conversionLabel', label),
    boolean('rdp', false),
    ...extra,
  ],
  firingTriggerId: [firingTriggerId],
  tagFiringOption: 'ONCE_PER_EVENT',
  monitoringMetadata: { type: 'MAP' },
  consentSettings: { consentStatus: 'NOT_SET' },
});

const tag = [
  conversionTag('921', 'Google Ads – Purchase – verified', LABELS.purchase, '911', [
    template('conversionValue', '{{DLV – value}}'),
    template('orderId', '{{DLV – transaction_id}}'),
    template('currencyCode', '{{DLV – currency}}'),
  ]),
  conversionTag('922', 'Google Ads – Begin checkout', LABELS.beginCheckout, '912', [
    template('orderId', '{{DLV – checkout_attempt_id}}'),
  ]),
];

const builtInVariable = [
  ['EVENT', 'Event'], ['PAGE_URL', 'Page URL'], ['PAGE_HOSTNAME', 'Page Hostname'], ['PAGE_PATH', 'Page Path'],
].map(([type, name]) => ({ ...ids, type, name }));

const exportJson = {
  exportFormatVersion: 2,
  exportTime: '2026-09-27 19:45:00',
  containerVersion: {
    path: `accounts/${ACCOUNT_ID}/containers/${CONTAINER_ID}/versions/0`,
    ...ids,
    containerVersionId: '0',
    container: { path: `accounts/${ACCOUNT_ID}/containers/${CONTAINER_ID}`, ...ids, publicId: PUBLIC_ID, usageContext: ['WEB'] },
    tag, trigger, variable, builtInVariable,
  },
};

const text = JSON.stringify(exportJson, null, 2) + '\n';
if (check) {
  let current = '';
  try { current = readFileSync(outFile, 'utf8'); } catch {}
  if (current !== text) {
    console.error('gtm/gtm-import-merge.json is stale; run build-gtm-import.mjs');
    process.exit(1);
  }
  console.log('gtm/gtm-import-merge.json is up to date');
} else {
  mkdirSync(dirname(outFile), { recursive: true });
  writeFileSync(outFile, text);
  console.log(`wrote ${outFile}`);
}
