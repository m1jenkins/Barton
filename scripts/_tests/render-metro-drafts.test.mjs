import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { csvRows, htmlDocument } from '../metro-release.mjs';
import { renderDrafts, renderMarket } from '../render-metro-drafts.mjs';

const root = new URL('../../', import.meta.url);
const read = file => readFile(new URL(file, root), 'utf8');
const withdrawn = ['DFW-PROP-01', 'DFW-PROP-02', 'HOU-PROP-01', 'HOU-PROP-02', 'HOU-PROP-03', 'AUS-PROP-01', 'AUS-PROP-02'];
const withdrawnCopy = [
  'DFW spans several emissions-program counties',
  'For a transaction handled in Tarrant County',
  'Harris County has documented historic flooding',
  'For a Harris County private-party purchase',
  'TCEQ lists Brazoria, Fort Bend, Galveston',
  'If your individual-sale transaction belongs with Travis County',
  'Check TxDOT’s I-35 Central closure map',
];
const exactQuotes = {
  M04: 'I know literally nothing about cars, but I do know one of my friends got suckered into a lemon of a car recently and I wanted to avoid the same mistake. Drive Right was amazing, I had my needs heard and I LOVE my new Mazda CX-30 Turbo. I never would have considered this car in the first place, let alone the financing and incentives they found for me. 11/10 stars.',
  M05: 'Drive Right found me a new Tahoe under MSRP and negotiated away the dealer add-ons.',
  'TX-AUS': "I used to bring my dad with to the dealer to help me, but now that he lives 1200 miles away, I didn't have him to lean on anymore. Drive Right took away the anxiety and saved me probably a dozen or two hours of my time.",
};
const draftFiles = ['dallas-fort-worth.html', 'houston.html', 'austin.html', 'service-areas.html'];

test('four current drafts render privately with exact attested historical quotes', async t => {
  const output = await mkdtemp(path.join(tmpdir(), 'barton-metro-drafts-'));
  t.after(() => rm(output, { recursive: true, force: true }));
  const pages = await renderDrafts({ output });
  const dossiers = JSON.parse(await read('data/metro-dossiers.json'));
  const release = JSON.parse(await read('data/metro-release.json'));
  const claims = csvRows(await read('data/claims.csv'));
  const activeClaimIds = new Set(claims.map(row => row.claim_id));
  const ignoredEntries = new Set((await read('.vercelignore')).split(/\r?\n/).map(line => line.trim()).filter(line => line && !line.startsWith('#')));
  assert.ok(![...ignoredEntries].some(entry => entry === '!draft-artifacts' || entry.startsWith('!draft-artifacts/')));
  assert.deepEqual([...pages.keys()], draftFiles.slice(0, 3).concat('service-areas.html'));
  for (const file of draftFiles) {
    const html = pages.get(file);
    const doc = htmlDocument(html);
    assert.equal(doc.noindex, true);
    assert.equal(doc.h1.length, 1);
    assert.ok(doc.links.includes('#main-content'));
    assert.match(doc.visibleText, /private|Private/);
    assert.match(doc.visibleText, /shipping charges/);
    assert.match(doc.visibleText, /does not inspect vehicles/);
    assert.equal(html, await read(`draft-artifacts/metros/${file}`));
    for (const id of withdrawn) assert.ok(!html.includes(id));
    for (const passage of withdrawnCopy) assert.ok(!html.includes(passage));
  }
  for (const [id, file] of [['M04','dallas-fort-worth.html'], ['M05','houston.html'], ['TX-AUS','austin.html']]) {
    const market = release.markets.find(item => item.id === id);
    const dossier = dossiers.find(item => item.marketId === id);
    const review = dossier.firstPartyProof.review;
    assert.equal(review.exact_quote, exactQuotes[id]);
    assert.equal(market.releaseStatus, 'draft');
    assert.equal(market.baseline, null);
    assert.match(market.baselineStatus, /^pending_/);
    assert.equal(dossier.modules.length, 0);
    const document = htmlDocument(pages.get(file));
    assert.ok(document.visibleText.includes(review.exact_quote));
    assert.ok(document.visibleText.includes(`Historical city label: ${review.historical_city_label}`));
    assert.match(review.attestation, /permission/);
    for (const withdrawnId of withdrawn) {
      assert.ok(!market.claimIds.includes(withdrawnId));
      assert.ok(!activeClaimIds.has(withdrawnId));
    }
  }
  assert.equal(release.hub.releaseStatus, 'draft');
  assert.match(release.hub.baselineStatus, /^pending_/);
  await renderDrafts({ output, check: true });
  await writeFile(path.join(output, 'austin.html'), 'stale');
  await assert.rejects(renderDrafts({ output, check: true }), /stale draft/);
});

test('mapped local modules render with validated source citations', async () => {
  const dossiers = JSON.parse(await read('data/metro-dossiers.json'));
  const release = JSON.parse(await read('data/metro-release.json'));
  const services = JSON.parse(await read('data/services.json'));
  const sources = csvRows(await read('data/source-registry.csv'));
  const source = sources.find(row => row.source_url && row.source_title);
  const dossier = {
    ...dossiers.find(item => item.marketId === 'M04'),
    modules: [{
      id: 'M04-M01',
      title: 'Compare remote offers',
      body: 'Compare written offers before choosing a car.',
      decision: 'Keep the buyer-paid shipping charge visible.',
      limitations: 'Planning example only.',
      sourceIds: [source.source_id],
      asOf: '2026-09-16',
    }],
  };
  const market = release.markets.find(item => item.id === 'M04');
  const html = renderMarket(market, dossier, services, sources);
  const text = htmlDocument(html).visibleText;
  assert.match(text, /Compare remote offers/);
  assert.ok(htmlDocument(html).links.includes(source.source_url));
  assert.doesNotMatch(text, /two claim\/source-mapped local modules are still missing/);
  assert.throws(() => renderMarket(market, dossier, services, [{ ...source, source_url: '' }]), /missing citation URL or title/);
});
