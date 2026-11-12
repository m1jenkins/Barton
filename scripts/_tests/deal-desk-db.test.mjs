import assert from 'node:assert/strict';
import test from 'node:test';
import { parseEvent } from '../deal-desk-db.mjs';

const intake = '0a1b2c3d-1111-4222-8333-444455556666';

test('a quote becomes one deal_events row', () => {
  const row = parseEvent({
    intake_id: intake.toUpperCase(), kind: 'quote', dealer_name: ' Example Toyota ', vin: '4t1dakbe1sa000000',
    otd_cents: 2925800, itemized: { sale_cents: 2700000, doc_fee_cents: 22500 }, source_message_id: 'msg-1',
    occurred_at: '2026-11-11T20:00:00Z'
  });
  assert.equal(row.onboarding_id, intake);
  assert.equal(row.dealer_name, 'Example Toyota');
  assert.equal(row.vin, '4T1DAKBE1SA000000');
  assert.equal(row.occurred_at, '2026-11-11T20:00:00.000Z');
});

test('every problem is reported at once', () => {
  assert.throws(() => parseEvent({ intake_id: '0a1b2c3d', kind: 'offer', vin: 'short', otd_cents: 12.5 }),
    /intake_id.*kind.*vin.*otd_cents/);
});

test('a quote needs a number', () => {
  assert.throws(() => parseEvent({ intake_id: intake, kind: 'quote' }), /quote needs otd_cents or itemized/);
  assert.equal(parseEvent({ intake_id: intake, kind: 'note', note: 'Dealer called' }).otd_cents, null);
});
