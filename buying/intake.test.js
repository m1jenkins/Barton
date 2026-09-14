import test from 'node:test';
import assert from 'node:assert/strict';
import {
  fields, normalizeAnswer, parseOpening, parseDetails, parseConversation, nextField, nextIntakeField,
  restoredAnswers, restoredSkipped, restoredPriorities, isComplete, isFullyResolved,
  locationText,
} from './intake.js';

test('the opening example captures the model and budget, then asks ZIP', () => {
  const answers = parseOpening('A Mazda Miata, under $30k');
  assert.deepEqual(answers, { budget: 'Up to $30,000', vehicle: 'Mazda MX-5 Miata' });
  assert.equal(nextField(answers).key, 'zip');
});
test('years and mileage supplied up front are retained without becoming the budget', () => {
  const answers = parseOpening('2019–2023 Mazda Miata, under 40k miles');
  assert.equal(answers.year, '2019–2023');
  assert.equal(answers.mileage, 'Under 40,000 mi');
  assert.equal(answers.budget, undefined);
  assert.equal(answers.vehicle, 'Mazda MX-5 Miata');
});
test('a direct price, decimal shorthand, and comma-separated mileage normalize', () => {
  assert.equal(normalizeAnswer('budget', '$27.5k'), 'Up to $27,500');
  assert.equal(normalizeAnswer('mileage', 'under 40,000 miles'), 'Under 40,000 mi');
  assert.equal(normalizeAnswer('radius', '250 miles'), '250 mi');
  assert.equal(parseDetails('250 miles', 'radius').values.radius, '250 mi');
});
test('ZIP codes retain leading zeroes and invalid answers do not advance', () => {
  assert.equal(normalizeAnswer('zip', '02108'), '02108');
  for (const value of ['7870', '78701-1000', 'hello']) assert.throws(() => normalizeAnswer('zip', value));
  for (const value of ['-30000', '0', 'free']) assert.throws(() => normalizeAnswer('budget', value));
  assert.throws(() => normalizeAnswer('year', '2023–2019'));
  assert.throws(() => normalizeAnswer('transmission', 'something else'));
});
test('flexible answers and nationwide searches remain explicit', () => {
  assert.equal(normalizeAnswer('year', 'Any year'), 'Any year');
  assert.equal(normalizeAnswer('trim', 'not sure'), 'Open to any trim');
  assert.equal(normalizeAnswer('radius', 'Nationwide'), 'Nationwide');
  assert.equal(locationText({ radius: 'Nationwide', zip: '02108' }), 'Nationwide · from 02108');
});
test('saved data is validated before restoration', () => {
  assert.deepEqual(restoredAnswers({ vehicle: 'Miata', zip: 'nope', budget: 'Up to $30,000', year: '<script>' }), { vehicle: 'Mazda MX-5 Miata', budget: 'Up to $30,000' });
  assert.deepEqual(restoredAnswers(null), {});
});

test('the three required details unlock review while optional details can be skipped', () => {
  const answers = { vehicle: 'Mazda MX-5 Miata', budget: 'Up to $30,000', zip: '02108' };
  const skipped = { year: true, mileage: true };
  assert.equal(isComplete(answers), true);
  assert.equal(nextField(answers, skipped).key, 'condition');
  assert.equal(isFullyResolved(answers, skipped), false);
  assert.throws(() => normalizeAnswer('budget', 'Flexible'));
});

test('the guided intake asks about the customer and ends with final details', () => {
  const answers = parseOpening('A family SUV under $30k in 78701');
  const skipped = {};
  const asked = [];
  let field;
  while ((field = nextIntakeField(answers, skipped))) {
    asked.push(field.key);
    assert.equal(Boolean(field.required), false);
    skipped[field.key] = true;
  }
  assert.deepEqual(asked, ['condition', 'timeline', 'payment_method', 'trade_in', 'needs', 'notes']);
  assert.equal(isComplete(answers), true);
  assert.equal(nextField(answers, skipped).key, 'year');
  assert.equal(fields.at(-1).key, 'notes');
});

test('customer context keeps numbers, exclusions, and correction-like wording intact', () => {
  const cases = {
    trade_in: '2018 Honda Civic, 70000 miles, $12000 still owed',
    timeline: 'Before October 2026',
    payment_method: 'Financing with $5000 down',
    needs: 'Actually, room for 3 kids, no black seats, and 40 miles of commuting.',
    notes: 'Make room for a wheelchair.\nPlease avoid black; delivery to 02108 after October 2026.',
  };
  for (const [key, value] of Object.entries(cases)) {
    assert.deepEqual(parseConversation(value, key), { values: { [key]: value }, skipped: [], correction: false });
  }
  assert.deepEqual(parseConversation('Change my budget to $35k', 'notes'), { values: { budget: 'Up to $35,000' }, skipped: [], correction: true });
  assert.equal(parseConversation('Change my notes to Please call first.\nDelivery on Saturday.', 'timeline').values.notes, 'Please call first.\nDelivery on Saturday.');
});

test('long notes validate, restore, and skip without receiving a priority', () => {
  const notes = 'a'.repeat(1000);
  assert.equal(parseConversation(notes, 'notes').values.notes, notes);
  assert.throws(() => parseConversation(`${notes}a`, 'notes'), /1,000/);
  assert.throws(() => normalizeAnswer('needs', 'a'.repeat(301)), /300/);
  assert.deepEqual(restoredAnswers({ notes }), { notes });
  assert.deepEqual(parseConversation('Skip for now', 'notes').skipped, ['notes']);
  assert.deepEqual(restoredPriorities({ notes: 'must', timeline: 'must', condition: 'must' }, { notes, timeline: 'Within a month', condition: 'Open to all' }), {});
});

test('common multi-detail answers are extracted locally and retained together', () => {
  assert.deepEqual(parseDetails('Manual, white, under 40k miles.', 'year').values, {
    mileage: 'Under 40,000 mi', color: 'White', transmission: 'Manual',
  });
  assert.deepEqual(parseDetails('A Mazda Miata, manual, white, under 40k miles, under $35k, 02108', 'vehicle').values, {
    vehicle: 'Mazda MX-5 Miata', mileage: 'Under 40,000 mi', color: 'White', transmission: 'Manual', budget: 'Up to $35,000', zip: '02108',
  });
});

test('corrections target named details without answering the current question', () => {
  assert.deepEqual(parseConversation('Change my budget to $35k', 'year'), { values: { budget: 'Up to $35,000' }, skipped: [], correction: true });
  assert.deepEqual(parseConversation('Actually, automatic.', 'year'), { values: { transmission: 'Automatic' }, skipped: [], correction: true });
  assert.throws(() => parseConversation('Actually, under 40k', 'year'), /budget or mileage/);
});

test('skips and priority restoration are validated independently from answers', () => {
  const answers = restoredAnswers({ vehicle: 'Miata', budget: 'Up to $30,000', zip: '02108', year: 'Any year' });
  const skipped = restoredSkipped({ mileage: true, color: true, zip: true }, answers);
  assert.deepEqual(skipped, { mileage: true, color: true });
  assert.deepEqual(restoredPriorities({ vehicle: 'prefer', budget: 'prefer', year: 'must', mileage: 'must' }, answers, skipped), {
    vehicle: 'prefer', budget: 'prefer',
  });
});
