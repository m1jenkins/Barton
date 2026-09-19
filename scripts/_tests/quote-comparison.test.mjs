import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { request } from 'node:http';
import { COST_FIELDS, EXAMPLES, parseAmount, emptyQuote, calculateQuote, compareQuotes, exportCsv } from '../../draft-artifacts/quote-comparison/worksheet.mjs';
import { createWorksheetServer } from '../preview-worksheet.mjs';

function completeQuote(overrides = {}) {
  return { costs: Object.fromEntries(COST_FIELDS.map(([key]) => [key, key === 'sellingPrice' ? '30000' : '0'])), incentives: [], incentivesConfirmed: true, ...overrides };
}

test('blank amounts remain unknown; explicit zero is a recorded value', () => {
  const blank = calculateQuote(emptyQuote());
  assert.equal(blank.enteredSubtotalCents, null);
  assert.equal(blank.totalCents, null);
  assert.equal(blank.complete, false);
  const zero = completeQuote({ costs: Object.fromEntries(COST_FIELDS.map(([key]) => [key, '0'])) });
  assert.equal(calculateQuote(zero).totalCents, 0);
  zero.costs.delivery = '';
  const missing = calculateQuote(zero);
  assert.equal(missing.totalCents, null);
  assert.ok(missing.missing.includes('Delivery charge'));
});

test('money parsing preserves cents and rejects malformed, negative, exponent and unsafe values', () => {
  for (const value of ['1.05', '1.5', '33,500.25', '0']) assert.equal(parseAmount(value).status, 'known');
  assert.equal(parseAmount('33,500.25').cents, 3350025);
  assert.equal(parseAmount('1.05').cents, 105);
  for (const value of ['-1', '1e3', '10.005', '1,23', 'Infinity', '=1+1', '9007199254740991']) assert.equal(parseAmount(value).status, 'invalid', value);
});

test('a confirmed incentive already included in selling price is not subtracted twice', () => {
  const result = calculateQuote(completeQuote({ incentives: [{ amount: '1000', eligibility: 'eligible', included: 'yes' }] }));
  assert.equal(result.totalCents, 3000000);
});

test('a confirmed incentive outside selling price is subtracted once', () => {
  const result = calculateQuote(completeQuote({ incentives: [{ amount: '1000', eligibility: 'eligible', included: 'no' }] }));
  assert.equal(result.totalCents, 2900000);
});

test('ineligible incentives already included are added back; excluded ones are not deducted', () => {
  const result = calculateQuote(completeQuote({ incentives: [{ amount: '1000', eligibility: 'ineligible', included: 'yes' }, { amount: '500', eligibility: 'ineligible', included: 'no' }] }));
  assert.equal(result.totalCents, 3100000);
});

test('unconfirmed included rebate yields two scenarios and never a complete total', () => {
  const result = calculateQuote(completeQuote({ incentives: [{ amount: '1000', eligibility: 'unknown', included: 'yes' }] }));
  assert.equal(result.preEligibilityCents, 3100000);
  assert.equal(result.conditionalTotalCents, 3000000);
  assert.equal(result.totalCents, null);
  assert.equal(result.complete, false);
});

test('unconfirmed excluded rebate is a possible reduction only', () => {
  const result = calculateQuote(completeQuote({ incentives: [{ amount: '1000', eligibility: 'unknown', included: 'no' }] }));
  assert.equal(result.preEligibilityCents, 3000000);
  assert.equal(result.conditionalTotalCents, 2900000);
  assert.equal(result.totalCents, null);
});

test('unknown incentive amount, inclusion and combination terms prevent totals', () => {
  for (const quote of [
    completeQuote({ incentives: [{ amount: '', eligibility: 'eligible', included: 'yes' }] }),
    completeQuote({ incentives: [{ amount: '1000', eligibility: 'eligible', included: 'unknown' }] }),
    completeQuote({ incentivesConfirmed: false }),
  ]) {
    const result = calculateQuote(quote);
    assert.equal(result.complete, false);
    assert.equal(result.totalCents, null);
    assert.equal(result.preEligibilityCents, null);
  }
});

test('malformed amounts and incentives larger than purchase costs do not produce a total', () => {
  const quote = completeQuote();
  quote.costs.taxes = '-50';
  assert.equal(calculateQuote(quote).status, 'invalid');
  const excessive = calculateQuote(completeQuote({ incentives: [{ amount: '31000', eligibility: 'eligible', included: 'no' }] }));
  assert.equal(excessive.totalCents, null);
  assert.equal(excessive.status, 'invalid');
});

test('safe individual amounts cannot overflow the combined calculation', () => {
  const quote = completeQuote({ costs: Object.fromEntries(COST_FIELDS.map(([key]) => [key, '90071992547400'])) });
  const result = calculateQuote(quote);
  assert.equal(result.status, 'invalid');
  assert.equal(result.totalCents, null);
  assert.equal(result.enteredSubtotalCents, null);
});

test('comparison needs complete quotes and an explicit comparable basis', () => {
  const a = calculateQuote(EXAMPLES[0].quotes[0]);
  const b = calculateQuote(EXAMPLES[0].quotes[1]);
  assert.equal(a.totalCents, 3725000);
  assert.equal(b.totalCents, 3655000);
  assert.equal(compareQuotes(a, b, false).ready, false);
  assert.equal(compareQuotes(a, b, true).differenceCents, -70000);
  assert.equal(compareQuotes(calculateQuote(emptyQuote()), b, true).ready, false);
});

test('uncertain example becomes comparable only after actual eligibility is entered', () => {
  const [qa, qb] = structuredClone(EXAMPLES[1].quotes);
  const a = calculateQuote(qa);
  const b = calculateQuote(qb);
  assert.equal(a.preEligibilityCents, 3630000);
  assert.equal(a.conditionalTotalCents, 3530000);
  assert.equal(b.totalCents, 3560000);
  assert.equal(compareQuotes(a, b, true).ready, false);
  qa.incentives[0].eligibility = 'eligible';
  assert.equal(compareQuotes(calculateQuote(qa), b, true).differenceCents, 30000);
  qa.incentives[0].eligibility = 'ineligible';
  assert.equal(compareQuotes(calculateQuote(qa), b, true).differenceCents, -70000);
});

test('CSV keeps unknown and invalid amounts distinct and includes scenario conditions', () => {
  const invalid = emptyQuote();
  invalid.costs.sellingPrice = '=HYPERLINK("https://example.invalid")';
  const csv = exportCsv(calculateQuote(invalid), calculateQuote(EXAMPLES[1].quotes[0]), false);
  assert.match(csv, /"Vehicle selling price","","invalid"/);
  assert.match(csv, /"Dealer fees","","unknown"/);
  assert.match(csv, /"Scenario before unconfirmed incentives","36300.00","scenario only"/);
  assert.match(csv, /"Purchase total","","needs_information"/);
  assert.doesNotMatch(csv, /HYPERLINK|example\.invalid/);
  assert.ok(csv.endsWith('\r\n'));
});

test('exports retain the hypothetical origin when an example is loaded', () => {
  const [a,b] = EXAMPLES[0].quotes.map(calculateQuote);
  const csv = exportCsv(a,b,true,0);
  assert.match(csv, /Started from hypothetical example 1; invented sample figures/);
  assert.match(csv, /scenarios hold other entered charges fixed/);
});

test('private preview serves only its allowlisted files with noindex and no submission route', async t => {
  const server = createWorksheetServer();
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  t.after(() => new Promise(resolve => server.close(resolve)));
  const port = server.address().port;
  const get = (path, method = 'GET') => new Promise((resolve, reject) => {
    const req = request({ hostname: '127.0.0.1', port, path, method }, res => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => resolve({ code: res.statusCode, headers: res.headers, body }));
    });
    req.on('error', reject);
    req.end();
  });
  for (const path of ['/', '/index.html', '/app.js', '/worksheet.mjs', '/styles.css']) {
    const res = await get(path);
    assert.equal(res.code, 200, path);
    assert.match(res.headers['x-robots-tag'], /noindex/);
    assert.equal(res.headers['cache-control'], 'no-store');
    assert.match(res.headers['content-security-policy'], /connect-src 'none'/);
    assert.match(res.headers['content-security-policy'], /form-action 'none'/);
  }
  assert.match((await get('/')).body, /name="robots" content="noindex, nofollow, noarchive"/);
  assert.equal((await get('/', 'HEAD')).body, '');
  for (const path of ['/api/leads', '/docs/seo-execution/SEO-06.md', '/data/claims.csv', '/.env', '/../index.html', '/%2e%2e/.env', '//index.html']) assert.equal((await get(path)).code, 404, path);
  assert.equal((await get('/%xx')).code, 400);
  assert.equal((await get('/', 'POST')).code, 405);
  assert.match(await readFile(new URL('../../.vercelignore', import.meta.url), 'utf8'), /^draft-artifacts$/m);
});
