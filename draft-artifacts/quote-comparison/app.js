import { COST_FIELDS, EXAMPLES, emptyQuote, calculateQuote, compareQuotes, formatMoney, exportCsv } from './worksheet.mjs';

const form = document.querySelector('#worksheet');
const comparable = document.querySelector('#comparable');
const prefixes = ['a', 'b'];
let sequence = 0;
let loadedExample = null;
const el = (tag, text, className) => {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
};

function renumberIncentives(prefix) {
  document.querySelectorAll(`#${prefix}-incentives .incentive`).forEach((row, index) => {
    row.querySelector('legend').textContent = `Incentive ${index + 1}`;
    row.querySelector('button').setAttribute('aria-label', `Remove incentive ${index + 1} from Quote ${prefix.toUpperCase()}`);
  });
}

function addIncentive(prefix, values = { amount: '', eligibility: 'unknown', included: 'unknown' }) {
  const row = el('fieldset', undefined, 'incentive');
  row.append(el('legend', 'Incentive'));
  const id = `${prefix}-incentive-${sequence++}`;
  const amountLabel = el('label', 'Amount · USD');
  const amount = el('input');
  Object.assign(amount, { id: `${id}-amount`, type: 'text', inputMode: 'decimal', autocomplete: 'off', value: values.amount });
  amount.dataset.field = 'amount';
  amount.setAttribute('aria-describedby', `${id}-error amount-help`);
  amountLabel.htmlFor = amount.id;
  amountLabel.append(amount);
  const error = el('p', '', 'field-error');
  error.id = `${id}-error`;
  error.hidden = true;
  row.append(amountLabel, error);
  for (const [field, label, options] of [
    ['eligibility', 'Eligibility confirmed by the seller?', [['unknown', 'Unconfirmed'], ['eligible', 'Yes — eligible'], ['ineligible', 'No — ineligible']]],
    ['included', 'Already included in the selling price?', [['unknown', 'Unconfirmed'], ['yes', 'Yes — already included'], ['no', 'No — not included']]],
  ]) {
    const wrapper = el('label', label);
    const select = el('select');
    select.id = `${id}-${field}`;
    select.dataset.field = field;
    for (const [value, text] of options) { const option = el('option', text); option.value = value; select.append(option); }
    select.value = values[field];
    wrapper.htmlFor = select.id;
    wrapper.append(select);
    row.append(wrapper);
  }
  const remove = el('button', 'Remove incentive', 'remove');
  remove.type = 'button';
  remove.addEventListener('click', () => {
    row.remove();
    renumberIncentives(prefix);
    update();
    document.querySelector(`.add-incentive[data-quote="${prefixes.indexOf(prefix)}"]`).focus();
  });
  row.append(remove);
  document.querySelector(`#${prefix}-incentives`).append(row);
  renumberIncentives(prefix);
  return amount;
}

function readQuote(prefix) {
  return {
    costs: Object.fromEntries(COST_FIELDS.map(([key]) => [key, document.getElementById(`${prefix}-${key}`).value])),
    incentives: [...document.querySelectorAll(`#${prefix}-incentives .incentive`)].map(row => Object.fromEntries(['amount', 'eligibility', 'included'].map(field => [field, row.querySelector(`[data-field="${field}"]`).value]))),
    incentivesConfirmed: document.getElementById(`${prefix}-confirmed`).checked,
  };
}

function renderResult(prefix, result) {
  const target = document.getElementById(`${prefix}-result`);
  target.replaceChildren();
  target.append(el('h3', result.complete ? 'Entered purchase total' : 'Information still needed'));
  if (result.complete) target.append(el('span', formatMoney(result.totalCents), 'amount'));
  else if (result.enteredSubtotalCents === null) target.append(el('p', 'No valid amounts entered yet.'));
  else if (result.preEligibilityCents !== null) {
    target.append(el('p', `Before unconfirmed incentives: ${formatMoney(result.preEligibilityCents)}`));
    target.append(el('p', `If every unconfirmed incentive applies: ${formatMoney(result.conditionalTotalCents)}`));
    target.append(el('p', 'Scenarios only. Confirm eligibility and that the incentives can be combined.'));
  } else target.append(el('p', `Entered-cost subtotal: ${formatMoney(result.enteredSubtotalCents)}. This is not a complete purchase total.`));
  if (result.enteredSubtotalCents !== null || result.invalid.length || result.incentives.length) {
    const list = el('ul');
    for (const item of [...result.invalid, ...result.missing, ...result.unresolved]) list.append(el('li', item));
    if (list.childNodes.length) target.append(list);
  }
  for (const [key] of COST_FIELDS) {
    const input = document.getElementById(`${prefix}-${key}`);
    const error = document.getElementById(`${prefix}-${key}-error`);
    const invalid = result.costs[key].status === 'invalid';
    input.setAttribute('aria-invalid', String(invalid));
    error.hidden = !invalid;
    error.textContent = invalid ? 'Use a non-negative USD amount with no more than two decimal places.' : '';
  }
  result.incentives.forEach((incentive, index) => {
    const row = document.querySelectorAll(`#${prefix}-incentives .incentive`)[index];
    const invalid = incentive.amount.status === 'invalid';
    row.querySelector('input').setAttribute('aria-invalid', String(invalid));
    row.querySelector('.field-error').hidden = !invalid;
    row.querySelector('.field-error').textContent = invalid ? 'Use a non-negative USD amount with no more than two decimal places.' : '';
  });
}

function update() {
  const results = prefixes.map(prefix => calculateQuote(readQuote(prefix)));
  results.forEach((result, index) => renderResult(prefixes[index], result));
  const comparison = compareQuotes(...results, comparable.checked);
  let text = comparison.reason;
  if (comparison.ready) {
    const difference = comparison.differenceCents;
    text = difference === 0 ? 'The entered purchase totals are equal.' : `On the entered purchase costs, Quote ${difference > 0 ? 'A' : 'B'} is ${formatMoney(Math.abs(difference))} lower.`;
  }
  document.querySelector('#comparison-result').textContent = text;
  return results;
}

function setQuotes(quotes) {
  prefixes.forEach((prefix, index) => {
    const quote = quotes[index];
    for (const [key] of COST_FIELDS) document.getElementById(`${prefix}-${key}`).value = quote.costs[key];
    document.getElementById(`${prefix}-incentives`).replaceChildren();
    for (const incentive of quote.incentives) addIncentive(prefix, incentive);
    document.getElementById(`${prefix}-confirmed`).checked = quote.incentivesConfirmed;
  });
  comparable.checked = false;
  document.querySelector('#export-note').textContent = '';
  update();
}

for (const prefix of prefixes) {
  for (const [key] of COST_FIELDS) {
    const input = document.getElementById(`${prefix}-${key}`);
    const error = el('span', '', 'field-error');
    error.id = `${prefix}-${key}-error`;
    error.hidden = true;
    input.parentElement.append(error);
    input.setAttribute('aria-describedby', `amount-help ${error.id}`);
  }
}
form.addEventListener('submit', event => event.preventDefault());
form.addEventListener('input', update);
form.addEventListener('change', update);
document.querySelectorAll('.add-incentive').forEach(button => button.addEventListener('click', () => {
  const prefix = prefixes[Number(button.dataset.quote)];
  document.getElementById(`${prefix}-confirmed`).checked = false;
  const input = addIncentive(prefix);
  update();
  input.focus();
}));
document.querySelectorAll('[data-example]').forEach(button => button.addEventListener('click', () => {
  loadedExample = Number(button.dataset.example);
  const example = EXAMPLES[loadedExample];
  setQuotes(example.quotes);
  document.querySelector('#example-note').textContent = `${example.title}. ${example.explanation} Replace these figures with your written quotes before using the worksheet.`;
}));
document.querySelector('#clear').addEventListener('click', () => {
  loadedExample = null;
  setQuotes([emptyQuote(), emptyQuote()]);
  document.querySelector('#example-note').textContent = 'Worksheet cleared. No entries were saved.';
  document.getElementById('a-sellingPrice').focus();
});
document.querySelector('#download').addEventListener('click', () => {
  const results = update();
  const file = new Blob([exportCsv(...results, comparable.checked, loadedExample)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'drive-right-quote-comparison.csv';
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  document.querySelector('#export-note').textContent = 'Your CSV includes entered amounts, missing information, incentive conditions, and the draft disclosure. It was created in this tab.';
});
document.querySelector('#print').addEventListener('click', () => window.print());
update();
