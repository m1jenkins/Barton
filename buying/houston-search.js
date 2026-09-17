import { parseConversation } from './intake.js';
import { applyAnswer, createStore, restoreBrief } from './brief.js';

const form = document.getElementById('houston-search');
const input = document.getElementById('houston-answer');
const error = document.getElementById('houston-search-error');

function sizeInput() {
  input.style.height = 'auto';
  input.style.height = `${Math.min(input.scrollHeight, 160)}px`;
}

function startBrief(raw) {
  try {
    const brief = applyAnswer(restoreBrief(), parseConversation(raw, 'vehicle'));
    const store = createStore(window);
    const persistence = store.write(brief);
    const destination = new URL('/#conversation', location.origin);
    if (persistence === 'memory') destination.hash += `?draft=${encodeURIComponent(JSON.stringify(brief))}`;
    location.assign(destination.href);
  } catch (reason) {
    error.textContent = reason.message;
    input.setAttribute('aria-invalid', 'true');
    input.focus();
  }
}

form.addEventListener('submit', event => {
  event.preventDefault();
  startBrief(input.value);
});
input.addEventListener('input', () => {
  error.textContent = '';
  input.removeAttribute('aria-invalid');
  sizeInput();
});
input.addEventListener('keydown', event => {
  if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
    event.preventDefault();
    form.requestSubmit();
  }
});
document.getElementById('houston-example').addEventListener('click', () => startBrief('A Mazda Miata, under $30k'));
