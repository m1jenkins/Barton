import test from 'node:test';
import assert from 'node:assert/strict';
import { questions, stepsFor, normalizeAnswer, restoreState, nextQuestion, progress, isComplete, answerQuestion, skipQuestion, formValues, questionForControl, firstName } from './intake.js';
import { validateOnboardingPayload } from '../api/_lib/validation.js';

const reply = (state, ...answers) => answers.reduce((current, answer) => answerQuestion(current, answer, 'full_service'), state);
const usedBuyer = () => reply(restoreState(), 'I’m looking for a Miata', 'Used', '2019-2023', '40k', '$30k', 'Financing', 'Not yet', 'Yes', '2018 Honda Civic, 70k miles', 'ASAP', 'Austin, TX', 'Nationwide', 'Weekend drives', 'Blue, not white', 'Jane Smith', '512.555.0100', 'Jane@Example.com', 'Text', 'Soft top only');

test('a used-car buyer answers every question in order and finishes', () => {
  const state = usedBuyer();
  assert.equal(nextQuestion(state, 'full_service'), null);
  assert.equal(isComplete(state, 'full_service'), true);
  assert.deepEqual(progress(state, 'full_service'), { done: 19, total: 19 });
  assert.deepEqual(state.answers, {
    preferred_makes: 'Mazda MX-5 Miata', condition: 'Used', model_years: '2019–2023', max_mileage: 'Under 40,000 mi', budget: 'Up to $30,000 out the door',
    payment_method: 'Financing', financing_status: 'Not yet', trade_in: 'Yes, I have a trade-in', trade_vehicle: '2018 Honda Civic, 70k miles', timeline: 'As soon as possible',
    city: 'Austin, TX', search_radius: 'Anywhere in the US', needs: 'Weekend drives', colors: 'Blue, not white', name: 'Jane Smith', phone: '(512) 555-0100',
    email: 'jane@example.com', contact_preference: 'Text', notes: 'Soft top only',
  });
  assert.equal(firstName(state), 'Jane');
});

test('new cars skip model years and mileage, cash skips pre-approval, and no trade skips the trade question', () => {
  const state = reply(restoreState(), 'A Toyota RAV4 Hybrid', 'New', '45000', 'Cash', 'No');
  assert.equal(nextQuestion(state, 'full_service').key, 'timeline');
  const keys = stepsFor(state.answers, 'full_service').map(question => question.key);
  for (const key of ['model_years', 'max_mileage', 'financing_status', 'trade_vehicle', 'delivery_address']) assert.ok(!keys.includes(key), key);
});

test('only Ultimate Concierge asks where the car should be delivered', () => {
  assert.ok(stepsFor({}, 'concierge').some(question => question.key === 'delivery_address'));
  assert.ok(!stepsFor({}, 'full_service').some(question => question.key === 'delivery_address'));
});

test('the budget is the all-in, out-the-door amount, or a monthly payment', () => {
  assert.equal(normalizeAnswer('budget', '$45,000'), 'Up to $45,000 out the door');
  assert.equal(normalizeAnswer('budget', 'under 42k OTD'), 'Up to $42,000 out the door');
  assert.equal(normalizeAnswer('budget', '$650/month'), 'Up to $650 a month');
  assert.equal(normalizeAnswer('budget', 'about 600 a month'), 'Up to $600 a month');
  assert.equal(normalizeAnswer('budget', '30-40k'), '$30,000–$40,000 out the door');
  assert.equal(normalizeAnswer('budget', '$40k, a bit more for the right car'), '$40k, a bit more for the right car');
  assert.throws(() => normalizeAnswer('budget', 'flexible'), /Give us a number/);
  assert.throws(() => normalizeAnswer('budget', 'under 40,000 miles'), /sounds like mileage/);
  assert.throws(() => normalizeAnswer('budget', '40k-30k'), /lower amount first/);
  assert.match(questions.find(question => question.key === 'budget').hint, /taxes, fees and delivery/);
});

test('answers are checked the way the form and server check them', () => {
  assert.equal(normalizeAnswer('phone', '+1 (512) 555-0100'), '+1 (512) 555-0100');
  assert.equal(normalizeAnswer('phone', '1 512 555 0100'), '(512) 555-0100');
  assert.throws(() => normalizeAnswer('phone', '555-0100'), /area code/);
  assert.throws(() => normalizeAnswer('email', 'jane@example'), /doesn’t look right/);
  assert.throws(() => normalizeAnswer('email', 'jane smith@example.com'), /doesn’t look right/);
  assert.throws(() => normalizeAnswer('model_years', '2023-2019'), /earlier year first/);
  assert.throws(() => normalizeAnswer('max_mileage', '$40,000'), /sounds like a price/);
  assert.throws(() => normalizeAnswer('preferred_makes', 'not sure'), /kind of car/);
  assert.throws(() => normalizeAnswer('notes', 'x'.repeat(1001)), /1,000 characters/);
  assert.equal(normalizeAnswer('model_years', '2020+'), '2020 or newer');
  assert.equal(normalizeAnswer('search_radius', '100'), 'Within 100 miles');
});

test('required questions cannot be skipped; optional ones can', () => {
  let state = reply(restoreState(), 'Miata', 'Used');
  assert.throws(() => answerQuestion(restoreState(), 'skip', 'full_service'), /need this one/);
  state = skipQuestion(state, 'full_service');
  assert.equal(state.skipped.model_years, true);
  assert.equal(nextQuestion(state, 'full_service').key, 'max_mileage');
  assert.equal(skipQuestion(reply(state, 'Flexible'), 'full_service').answers.budget, undefined, 'budget is required, so skipping it does nothing');
});

test('“change my budget to …” edits an earlier answer and keeps the current question waiting', () => {
  const state = reply(restoreState(), 'Miata', 'New', '$30k', 'change my budget to $35k');
  assert.equal(state.answers.budget, 'Up to $35,000 out the door');
  assert.equal(nextQuestion(state, 'full_service').key, 'payment_method');
});

test('editing reopens one question and then returns to the next unanswered one', () => {
  let state = reply(restoreState(), 'Miata', 'New', '$30k');
  state = { ...state, editing: 'preferred_makes' };
  assert.equal(nextQuestion(state, 'full_service').key, 'preferred_makes');
  state = answerQuestion(state, 'A Mazda CX-5', 'full_service');
  assert.equal(state.answers.preferred_makes, 'Mazda CX-5');
  assert.equal(nextQuestion(state, 'full_service').key, 'payment_method');
});

test('a saved conversation is restored, and invalid saved answers are dropped', () => {
  const state = restoreState({ version: 1, answers: { preferred_makes: 'miata', budget: 'flexible', email: 'not-an-email' }, skipped: { model_years: true, budget: true }, editing: 'nope' });
  assert.deepEqual(state, { version: 1, answers: { preferred_makes: 'Mazda MX-5 Miata' }, skipped: { model_years: true }, editing: null });
  assert.deepEqual(restoreState({ version: 2, answers: { preferred_makes: 'Miata' } }).answers, {});
});

test('form values use the form’s own option values and fill typed fields with the same meaning', () => {
  const values = formValues(usedBuyer(), 'full_service');
  assert.equal(values.condition, 'used');
  assert.equal(values.payment_method, 'finance');
  assert.equal(values.trade_in, 'yes');
  assert.equal(values.timeline, 'asap');
  assert.equal(values.contact_preference, 'text');
  assert.equal(values.year_min, '2019');
  assert.equal(values.max_mileage, '40000');
  assert.equal(values.trade_mileage, '70000');
  assert.equal(values.vehicle_type, 'coupe');
  assert.equal(values.budget, 'Up to $30,000 out the door');
  assert.equal(values.delivery_address, '', 'Full Service never sends a delivery answer');
});

test('changing an answer clears values the new answer no longer asks for', () => {
  const state = answerQuestion({ ...usedBuyer(), editing: 'condition' }, 'New', 'full_service');
  const values = formValues(state, 'full_service');
  assert.equal(values.condition, 'new');
  assert.equal(values.model_years, '');
  assert.equal(values.year_min, '');
  assert.equal(values.max_mileage, '');
});

test('typed answers outside the listed choices are sent in the buyer’s words', () => {
  const state = reply(restoreState(), 'Miata', 'New or lightly used', '2021 or newer');
  assert.equal(state.answers.condition, 'New or lightly used');
  assert.equal(formValues(state, 'full_service').condition, 'New or lightly used');
  assert.equal(nextQuestion(state, 'full_service').key, 'max_mileage', 'anything but “New” asks about mileage');
});

for (const tier of ['full_service', 'concierge']) {
  test(`every ${tier} chat answer is kept by the server, none dropped`, () => {
    let state = restoreState();
    for (const question of stepsFor({ condition: 'Used', payment_method: 'Financing', trade_in: 'Maybe' }, tier)) state.answers[question.key] = normalizeAnswer(question.key, {
      preferred_makes: 'Mazda MX-5 Miata', condition: 'Used', model_years: '2019–2023', max_mileage: 'Under 40,000 mi', budget: '$30,000', payment_method: 'Financing', financing_status: 'Not yet',
      trade_in: 'Maybe', trade_vehicle: '2018 Civic, 70k miles', timeline: 'Within 2 weeks', city: '78701', search_radius: '250 miles', needs: 'Two car seats', colors: 'Any',
      delivery_address: '100 Congress Ave, Austin', name: 'Jane Smith', phone: '512-555-0100', email: 'jane@example.com', contact_preference: 'Call', notes: 'Soft top',
    }[question.key]);
    assert.equal(isComplete(state, tier), true);
    const fields = Object.fromEntries(Object.entries(formValues(state, tier)).filter(([, value]) => value));
    const result = validateOnboardingPayload({ tier, session_id: 'cs_test_abc12345', fields });
    const kept = { ...result.fields, name: result.name, email: result.email, phone: result.phone, city: result.city };
    assert.deepEqual(Object.keys(fields).filter(key => !(key in kept)), [], 'the server allowlist drops these');
    assert.equal(kept.budget, 'Up to $30,000 out the door');
  });
}

test('form controls lead back to the question that fills them', () => {
  assert.equal(questionForControl('year_min').key, 'model_years');
  assert.equal(questionForControl('email').key, 'email');
  assert.equal(questionForControl('features'), null);
});

test('no question or hint says “brief”', () => {
  assert.doesNotMatch(JSON.stringify(questions), /brief/i);
});
