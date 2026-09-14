import { fields, normalizeAnswer, parseConversation, nextField, nextIntakeField, isComplete, isConcrete, choicesFor, restoredPriorities } from './intake.js';
import { BRIEF_KEY, restoreBrief, applyAnswer, briefText, createStore, onboardingValues } from './brief.js';
import { plans, createCheckout } from './checkout.js';

const $ = selector => document.querySelector(selector);
const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[c]);
const icons = { up:'M12 20V4m-7 7 7-7 7 7', arrow:'M4 12h16m-7-7 7 7-7 7', back:'m15 4-8 8 8 8', edit:'m16 3 5 5-12 12-6 1 1-6L16 3Zm-3 3 5 5', close:'m6 6 12 12M6 18 18 6', check:'m5 12 4 4L19 6', download:'M12 3v12m-5-5 5 5 5-5M5 17v4h14v-4' };
const icon = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${icons[name] || ''}"/></svg>`;
document.querySelectorAll('[data-icon]').forEach(element => { element.innerHTML = icon(element.dataset.icon); });

// A guided example stays separate from the buyer's saved brief.
const processSteps = [...document.querySelectorAll('[data-process-step]')];
function showProcessStep(index) {
  processSteps.forEach((button, step) => {
    const active = step === index;
    button.setAttribute('aria-expanded', String(active));
    button.closest('li').classList.toggle('is-active', active);
    button.getAttribute('aria-controls').split(' ').forEach(id => {
      document.getElementById(id).hidden = !active;
    });
  });
  $('[data-process-counter]').textContent = String(index + 1).padStart(2, '0');
}
processSteps.forEach((button, index) => {
  button.disabled = false;
  button.addEventListener('click', () => showProcessStep(index));
  button.addEventListener('keydown', event => {
    const directions = { ArrowDown:1, ArrowUp:-1, Home:-index, End:processSteps.length - 1 - index };
    if (!(event.key in directions)) return;
    event.preventDefault();
    const next = (index + directions[event.key] + processSteps.length) % processSteps.length;
    processSteps[next].focus();
    showProcessStep(next);
  });
});
if (processSteps.length) showProcessStep(0);

const briefStore = createStore(window);
const checkoutStore = createStore(window, 'drive_right_buying_checkout_v1', { local:false });
let brief = restoreBrief(briefStore.read());
const handoff = new URLSearchParams(location.hash.split('?')[1] || '').get('draft');
if (handoff) {
  try { brief = restoreBrief(JSON.parse(handoff)); } catch { /* Ignore malformed handoff. */ }
  history.replaceState(history.state, '', location.pathname + location.search + location.hash.split('?')[0]);
}
let view = 'home';
let optionalQuestions = false;
let replyPending = false;
let replyTimer;
const home = document.body.dataset.buyingPage === 'home';
const input = $('#answer');
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
function persist() {
  const storage = briefStore.write(brief);
  const message = storage === 'localStorage' ? '' : storage === 'sessionStorage' ? 'Draft saved for this tab. Download a copy to keep it.' : 'Browser storage is unavailable. Keep a downloaded copy of your brief.';
  if ($('#saved-indicator')) $('#saved-indicator').textContent = message;
  return storage;
}
function currentField() { return (optionalQuestions ? nextField : nextIntakeField)(brief.answers, brief.skipped); }
function sizeAnswer() {
  input.style.height = 'auto';
  input.style.height = `${Math.min(input.scrollHeight, 160)}px`;
}
function cancelReply() {
  clearTimeout(replyTimer);
  replyPending = false;
}
function prepareReply() {
  cancelReply();
  replyPending = true;
  renderConversation();
  // These are guided prompts, paced briefly so the response feels conversational.
  // The answer is already saved, including when the buyer leaves during the pause.
  const delay = reduced() ? 250 : Math.min(1300, 750 + (currentField()?.question.length || 80) * 4);
  replyTimer = setTimeout(() => {
    replyPending = false;
    if (view !== 'conversation') return;
    renderConversation();
    if (currentField()) input.focus({ preventScroll:true });
    else $('#brief-ready .primary-button').focus({ preventScroll:true });
  }, delay);
}
function renderConversation() {
  const field = currentField();
  const steps = fields.filter(f => optionalQuestions || f.required || f.intake);
  const completed = steps.filter(f => brief.answers[f.key] || brief.skipped[f.key]).length;
  $('#step-label').textContent = `${completed} of ${steps.length} details`;
  $('#intake-progress').max = steps.length;
  $('#intake-progress').value = completed;
  const rows = fields.filter(f => brief.answers[f.key] || brief.skipped[f.key]);
  const log = $('#messages');
  let response = log.querySelector('.message.assistant');
  if (!response) { response = document.createElement('div'); response.className = 'message assistant'; log.append(response); }
  // Keep existing answers mounted so only the new turn animates and is announced.
  log.querySelectorAll('[data-answer]').forEach(message => { if (!rows.some(f => f.key === message.dataset.answer)) message.remove(); });
  for (const f of rows) {
    let message = log.querySelector(`[data-answer="${f.key}"]`);
    if (!message) { message = document.createElement('div'); message.className = 'message user'; message.dataset.answer = f.key; log.insertBefore(message, response); }
    const markup = `<div class="bubble"><p>${escape(brief.answers[f.key] || 'Skipped for now')}</p><button class="bubble-edit" data-edit="${f.key}" aria-label="Edit ${escape(f.label)}">${icon('edit')}</button></div><span class="message-label">${escape(f.label)}</span>`;
    if (message.querySelector('p')?.textContent !== (brief.answers[f.key] || 'Skipped for now')) message.innerHTML = markup;
  }
  const reply = replyPending
    ? '<div class="typing-bubble"><span class="sr-only">Drive Right is preparing the next reply.</span><span class="typing-dot" aria-hidden="true"></span><span class="typing-dot" aria-hidden="true"></span><span class="typing-dot" aria-hidden="true"></span></div>'
    : `<p class="assistant-reply">${escape(field?.question || 'Your brief is ready. Take a look, make it yours, and we’ll go from there.')}</p>`;
  const responseMarkup = `<span class="message-label assistant-name">Drive Right</span>${reply}`;
  if (response.innerHTML !== responseMarkup) response.innerHTML = responseMarkup;
  $('#choices').innerHTML = field && !replyPending ? choicesFor(field, brief.answers).map(choice => `<button class="choice-button" type="button" data-choice="${escape(choice)}">${escape(choice)}</button>`).join('') : '';
  $('#choices').hidden = !field || replyPending;
  $('#skip-detail').hidden = !field || field.required || replyPending;
  $('#skip-detail').textContent = field?.key === 'notes' ? 'Nothing else to add' : 'Skip for now';
  $('#composer').hidden = !field && !replyPending;
  $('#composer').setAttribute('aria-busy', String(replyPending));
  input.readOnly = replyPending;
  $('#composer .send-button').disabled = replyPending;
  input.inputMode = field?.inputMode || 'text';
  // Keep correction phrases possible even while asking for a five-digit ZIP.
  input.maxLength = field?.maxLength || 180;
  input.rows = !replyPending && field?.multiline ? 3 : 1;
  input.enterKeyHint = field?.multiline ? 'enter' : 'send';
  $('#composer').classList.toggle('is-multiline', !replyPending && Boolean(field?.multiline));
  input.placeholder = replyPending ? 'Your reply…' : field?.placeholder || 'Your answer';
  $('#answer-label').textContent = replyPending ? 'Your reply' : field?.question || 'Your answer';
  $('#input-hint').textContent = replyPending ? '' : field?.hint || 'You can edit any answer.';
  $('.conversation-controls').hidden = !field;
  $('#review-progress').hidden = !isComplete(brief.answers) || replyPending;
  $('#brief-ready').hidden = Boolean(field) || !isComplete(brief.answers) || replyPending;
  $('#add-details').hidden = !nextField(brief.answers, brief.skipped) || optionalQuestions;
  requestAnimationFrame(() => { sizeAnswer(); log.scrollTo({ top:log.scrollHeight, behavior:reduced() ? 'instant' : 'smooth' }); });
}
function detailSummary(value = brief) {
  const a = value.answers;
  return [a.budget ? `${a.budget} car price` : '', a.zip ? `ZIP ${a.zip}` : '', a.radius || ''].filter(Boolean).join(' · ');
}
function renderBrief() {
  $('#brief-vehicle').textContent = brief.answers.vehicle;
  $('#brief-details').innerHTML = fields.filter(f => !['vehicle','notes'].includes(f.key) && brief.answers[f.key]).map(f => `<div class="brief-detail"><dt>${escape(f.label)}</dt><dd><button data-edit="${f.key}" aria-label="Edit ${escape(f.label)}">${escape(brief.answers[f.key])}</button></dd></div>`).join('');
  $('#brief-notes-value').textContent = brief.answers.notes || 'Add any final details';
  $('#brief-notes-value').classList.toggle('is-empty', !brief.answers.notes);
}
function setView(next, focus = true) {
  cancelReply();
  if (!['home','conversation','brief'].includes(next)) next = 'home';
  if (next === 'brief' && !isComplete(brief.answers)) {
    next = 'conversation';
    history.replaceState(history.state, '', location.pathname + location.search + '#conversation');
  }
  view = next;
  document.body.dataset.view = next === 'brief' ? 'summary' : next;
  $('#intake-view').hidden = next === 'brief';
  $('#summary-view').hidden = next !== 'brief';
  $('#home-content').hidden = next !== 'home';
  $('.chat-heading').hidden = next !== 'conversation';
  $('#messages').hidden = next !== 'conversation';
  if (next === 'brief') $('[data-brief-link]').setAttribute('aria-current', 'page');
  else $('[data-brief-link]').removeAttribute('aria-current');
  if (next === 'conversation') renderConversation();
  if (next === 'brief') renderBrief();
  if (next === 'home') {
    $('#composer').hidden = false; $('#choices').hidden = true; $('#skip-detail').hidden = true;
    $('#brief-ready').hidden = true; $('.conversation-controls').hidden = true;
    input.placeholder = 'What car are you dreaming of?'; input.inputMode = 'text';
    input.readOnly = false; input.maxLength = 180; input.rows = 1; input.enterKeyHint = 'send';
    $('#composer').classList.remove('is-multiline'); $('#composer').setAttribute('aria-busy', 'false'); $('#composer .send-button').disabled = false;
    $('#answer-label').textContent = 'What car are you dreaming of?';
    requestAnimationFrame(sizeAnswer);
  }
  document.title = next === 'brief' ? 'Your buying brief | Drive Right' : next === 'conversation' ? 'Describe your next car | Drive Right' : 'Texas Car Buying Service | Drive Right';
  if (focus) {
    window.scrollTo({ top:0, behavior:'instant' });
    (next === 'brief' ? $('#summary-title') : next === 'conversation' && currentField() ? input : $('#main-content')).focus({ preventScroll:true });
  }
}
function navigate(next, focus = true) {
  if (next === 'brief' && !isComplete(brief.answers)) next = 'conversation';
  const fragment = next === 'home' ? '' : `#${next}`;
  if (location.hash !== fragment) history.pushState(history.state, '', location.pathname + location.search + fragment);
  setView(next, focus);
}
function submit(raw) {
  if (replyPending) return;
  const field = currentField();
  if (!field) { navigate('brief'); return; }
  try {
    brief = applyAnswer(brief, parseConversation(raw, field.key));
    persist(); input.value = ''; $('#input-error').textContent = ''; input.removeAttribute('aria-invalid');
    if (view === 'home') navigate('conversation', false);
    prepareReply();
  } catch (error) {
    $('#input-error').textContent = error.message; input.setAttribute('aria-invalid','true'); input.focus();
  }
}
function openEditor(keys) {
  cancelReply();
  if (view === 'conversation') renderConversation();
  const selected = fields.filter(f => keys.includes(f.key));
  $('#edit-fields').innerHTML = selected.map(f => {
    const priority = brief.priorities[f.key] || f.defaultPriority;
    const attributes = `id="edit-${f.key}" name="${f.key}" placeholder="${escape(f.placeholder)}" maxlength="${f.maxLength || (f.key === 'zip' ? 5 : 180)}" inputmode="${f.inputMode || 'text'}" ${f.required ? 'required' : ''}`;
    const control = f.multiline ? `<textarea ${attributes} rows="4">${escape(brief.answers[f.key] || '')}</textarea>` : `<input ${attributes} value="${escape(brief.answers[f.key] || '')}">`;
    return `<div class="edit-field ${f.multiline ? 'edit-field-wide' : ''}" data-field="${f.key}" data-skipped="${Boolean(brief.skipped[f.key])}"><label for="edit-${f.key}">${escape(f.label)}${f.required ? ' *' : ' (optional)'}${control}</label>${f.hint ? `<span class="editor-status">${escape(f.hint)}</span>` : ''}${f.priority === false ? '' : `<div class="priority-control editor-priority-control" role="group" aria-label="${escape(f.label)} priority">${['must','prefer'].map(p => `<button type="button" class="priority-button ${priority === p ? 'is-selected' : ''}" aria-pressed="${priority === p}" data-priority="${p}">${p === 'must' ? 'Must-have' : 'Prefer'}</button>`).join('')}</div>`}${f.required ? '' : `<button type="button" class="editor-skip" data-skip="${f.key}">${brief.skipped[f.key] ? 'Skipped for now' : 'Skip for now'}</button>`}</div>`;
  }).join('');
  $('#edit-error').textContent = '';
  $('#edit-dialog').showModal();
}
function download() {
  const url = URL.createObjectURL(new Blob([briefText(brief)], { type:'text/plain;charset=utf-8' }));
  const link = document.createElement('a'); link.href = url; link.download = 'drive-right-buying-brief.txt'; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
if (home) {
  $('#composer').addEventListener('submit', e => { e.preventDefault(); submit(input.value); });
  input.addEventListener('input', () => { $('#input-error').textContent = ''; input.removeAttribute('aria-invalid'); });
  input.addEventListener('input', sizeAnswer);
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && (view === 'home' || !currentField()?.multiline)) { e.preventDefault(); $('#composer').requestSubmit(); }
  });
  $('#example').addEventListener('click', () => Object.keys(brief.answers).length ? navigate(isComplete(brief.answers) ? 'brief' : 'conversation') : submit('A Mazda Miata, under $30k'));
  $('#choices').addEventListener('click', e => { const b = e.target.closest('[data-choice]'); if (b) submit(b.dataset.choice); });
  $('#skip-detail').addEventListener('click', () => submit('Skip for now'));
  $('#add-details').addEventListener('click', () => { optionalQuestions = true; prepareReply(); });
  $('#edit-brief').addEventListener('click', () => openEditor(fields.map(f => f.key)));
  document.addEventListener('click', e => { const b = e.target.closest('[data-edit]'); if (b) openEditor(b.dataset.edit.split(',')); });
  $('#edit-fields').addEventListener('click', e => {
    const priority = e.target.closest('[data-priority]');
    if (priority) priority.parentElement.querySelectorAll('button').forEach(b => { b.classList.toggle('is-selected', b === priority); b.setAttribute('aria-pressed', String(b === priority)); });
    const skip = e.target.closest('[data-skip]');
    if (skip) { const row = skip.closest('[data-field]'); row.dataset.skipped = 'true'; row.querySelector('input,textarea').value = ''; skip.textContent = 'Skipped for now'; }
  });
  $('#edit-fields').addEventListener('input', e => { const row = e.target.closest('[data-field]'); if (row) row.dataset.skipped = 'false'; });
  $('#edit-form').addEventListener('submit', e => {
    e.preventDefault(); const next = restoreBrief(brief);
    try {
      $('#edit-fields').querySelectorAll('[data-field]').forEach(row => {
        const key = row.dataset.field, value = row.querySelector('input,textarea').value.trim(), field = fields.find(f => f.key === key);
        if (value) { next.answers[key] = normalizeAnswer(key, value); delete next.skipped[key]; }
        else { if (field.required) throw new Error(`${field.label} is required.`); delete next.answers[key]; if (row.dataset.skipped === 'true') next.skipped[key] = true; else delete next.skipped[key]; }
        if (isConcrete(key, next.answers[key])) next.priorities[key] = row.querySelector('.is-selected')?.dataset.priority || field.defaultPriority;
      });
      next.priorities = restoredPriorities(next.priorities, next.answers, next.skipped);
      brief = next; persist(); if (view === 'brief') renderBrief(); else renderConversation(); $('#edit-dialog').close();
    } catch (error) { $('#edit-error').textContent = error.message; }
  });
  $('#download-brief').addEventListener('click', download);
  $('#save-brief').addEventListener('click', () => { const saved = persist(); $('#brief-status').textContent = saved === 'localStorage' ? 'Your brief is saved on this device.' : 'This browser cannot save a lasting draft. Download your brief to keep a copy.'; });
  window.addEventListener('hashchange', () => setView(location.hash.slice(1) || 'home'));
  window.addEventListener('popstate', () => setView(location.hash.slice(1) || 'home'));
  setView(location.hash.slice(1) || 'home', false);
}

// The hash is used only when all browser stores are unavailable. It carries the
// non-contact brief between these pages, never contact details or API credentials.
const redesigned = new Set(['/', '/index.html', '/schedule.html', '/how-it-works.html']);
document.addEventListener('click', e => {
  const a = e.target.closest('a[href]');
  if (!a || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || a.target) return;
  const url = new URL(a.href, location.href);
  if (home && url.origin === location.origin && ['/', '/index.html'].includes(url.pathname) && ['', '#brief', '#conversation'].includes(url.hash)) {
    e.preventDefault(); navigate(url.hash.slice(1) || 'home'); return;
  }
  if (briefStore.persistence === 'memory' && url.origin === location.origin && redesigned.has(url.pathname) && url.pathname !== location.pathname) {
    const route = url.hash || '#home'; url.hash = `${route}?draft=${encodeURIComponent(JSON.stringify(brief))}`; a.href = url.href;
  }
});

document.querySelectorAll('dialog').forEach(dialog => {
  dialog.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => dialog.close()));
  dialog.addEventListener('click', event => { if (event.target !== dialog) return; const r = dialog.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) dialog.close(); });
});

const pricingSummary = $('#pricing-brief');
function compactMarkup(value, link = true) {
  return `<div><h2>${escape(value.answers.vehicle || 'Your buying brief')}</h2><p>${escape(detailSummary(value))}</p></div>${link ? '<a class="text-link" href="/#brief">Review your brief '+icon('arrow')+'</a>' : ''}`;
}
if (pricingSummary && Object.keys(brief.answers).length) { pricingSummary.innerHTML = compactMarkup(brief); pricingSummary.hidden = false; }
const contactDialog = $('#contact-dialog');
let selectedTier, checkoutFlow, checkoutPending = false;
window.addEventListener('pageshow', event => {
  if (!event.persisted) return;
  brief = restoreBrief(briefStore.read(true));
  checkoutStore.read(true);
  checkoutFlow = null;
  if (home) setView(location.hash.slice(1) || 'home', false);
  if (pricingSummary) {
    pricingSummary.hidden = !Object.keys(brief.answers).length;
    pricingSummary.innerHTML = compactMarkup(brief);
  }
});
if (contactDialog) {
  const remembered = checkoutStore.read()?.contact || {};
  for (const key of ['name','email','phone']) $(`#buyer-${key}`).value = typeof remembered[key] === 'string' ? remembered[key] : '';
  const showPlan = (tier, updateURL = true) => {
    if (!plans[tier]) return;
    selectedTier = tier;
    $('#chosen-plan').innerHTML = `<span>${escape(plans[tier].name)}<br><small>One-time service fee</small></span><strong>$${plans[tier].fee}</strong>`;
    $('#contact-error').textContent = '';
    if (updateURL) history.pushState({ ...history.state, buyingContact: true }, '', `#contact-${tier}`);
    if (!contactDialog.open) contactDialog.showModal();
  };
  document.querySelectorAll('[data-plan]').forEach(a => a.addEventListener('click', e => { e.preventDefault(); showPlan(a.dataset.plan); }));
  const syncPlan = () => {
    const tier = location.hash.replace('#contact-', '');
    if (plans[tier] && location.hash.startsWith('#contact-')) showPlan(tier, false);
    else if (contactDialog.open) contactDialog.close();
  };
  window.addEventListener('popstate', syncPlan);
  window.addEventListener('hashchange', syncPlan);
  contactDialog.addEventListener('close', () => {
    if (!location.hash.startsWith('#contact-')) return;
    if (history.state?.buyingContact) history.back();
    else history.replaceState(history.state, '', '#pricing');
  });
  syncPlan();
  $('#plan-contact-form').addEventListener('submit', async e => {
    e.preventDefault();
    if (checkoutPending) return;
    const client = window.driveRightClient;
    if (!client) { $('#contact-error').textContent = 'The page is still loading. Please try again.'; return; }
    checkoutFlow ||= createCheckout({ store:checkoutStore, request:client.requestJson, createId:client.createId, attribution:client.attribution, track:client.track });
    const data = new FormData(e.currentTarget), button = $('#checkout-submit');
    const contact = Object.fromEntries(['name','email','phone'].map(k => [k, data.get(k)]));
    const requestTier = selectedTier;
    checkoutPending = true;
    button.disabled = true; button.setAttribute('aria-busy','true'); button.textContent = 'Saving your request…'; $('#contact-error').textContent = '';
    try {
      const result = await checkoutFlow.submit({ tier:requestTier, contact, brief, honeypot:data.get('website') || '', token:data.get('cf-turnstile-response') || '' });
      if (!contactDialog.open || selectedTier !== requestTier) return;
      button.textContent = 'Opening secure checkout…'; window.location.assign(result.url);
    } catch (error) {
      $('#contact-error').textContent = `${error.message || 'We couldn’t open checkout.'} Your details are still here. Please try again.`;
      button.disabled = false; button.setAttribute('aria-busy','false'); button.innerHTML = 'Continue to checkout '+icon('arrow');
    } finally {
      checkoutPending = false;
      button.disabled = false;
      button.setAttribute('aria-busy','false');
      button.innerHTML = 'Continue to checkout '+icon('arrow');
    }
  });
  window.addEventListener('pageshow', () => { const b = $('#checkout-submit'); b.disabled = false; b.setAttribute('aria-busy','false'); b.innerHTML = 'Continue to checkout '+icon('arrow'); });
}

const paidBrief = $('#paid-brief');
if (paidBrief) {
  let filled = false;
  function carryOver() {
    if (filled || !document.body.dataset.verifiedSessionId) return;
    filled = true;
    $('.skip-link').href = '#verified-purchase-content';
    const ledger = checkoutStore.read();
    const snapshot = ledger?.lastCheckout?.tier === document.body.dataset.purchaseTier ? ledger.lastCheckout : null;
    const value = snapshot ? restoreBrief(snapshot.brief) : brief;
    const contact = snapshot?.contact || ledger?.contact || {};
    if (Object.keys(value.answers).length) { paidBrief.innerHTML = compactMarkup(value, false) + `<details><summary>View all saved preferences</summary><pre>${escape(briefText(value))}</pre></details>`; paidBrief.hidden = false; }
    const form = $('#onboarding-form');
    for (const [name, text] of Object.entries(onboardingValues(value, contact))) {
      const control = form.elements.namedItem(name);
      if (control && !control.value && text) {
        // Paid plans have different timeline options; only select an exact match.
        // Every answer also remains in the complete notes, including custom dates.
        if (control.tagName === 'SELECT' && ![...control.options].some(option => option.value === text)) continue;
        if (name === 'year_min') control.min = '1886'; control.value = text;
      }
    }
    // Existing API fields preserve the entire brief, including constraints without
    // dedicated onboarding inputs (ZIP, radius, trim, transmission, and priorities).
  }
  new MutationObserver(carryOver).observe(document.body, { attributes:true, attributeFilter:['data-verified-session-id'] });
  carryOver();
}
persist();
