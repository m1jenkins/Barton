import { questions, stepsFor, restoreState, nextQuestion, progress, isComplete, answerQuestion, skipQuestion, formValues, questionForControl, firstName } from './intake.js?v=59712ce4fac7';

// Full Service and Ultimate Concierge payment pages. The form stays the default until
// this module runs, so a buyer whose browser can't load it still has a working intake.
// Answers go into #onboarding-form and its own submit handler (script.js) sends them.
const $ = selector => document.querySelector(selector);
const chat = $('#intake-view'), form = $('#onboarding-form'), formSection = $('#onboarding');
const tier = document.body.dataset.purchaseTier;
const plans = { full_service: 'Full Service', concierge: 'Ultimate Concierge' };

if (chat && form && formSection && plans[tier]) {
  const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[c]);
  const icons = { up:'M12 20V4m-7 7 7-7 7 7', edit:'m16 3 5 5-12 12-6 1 1-6L16 3Zm-3 3 5 5' };
  const icon = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${icons[name]}"/></svg>`;
  const input = $('#answer'), log = $('#messages'), submitButton = $('#chat-submit'), success = $('#onboarding-success');
  const mobile = () => matchMedia('(max-width: 760px)').matches;
  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

  // The conversation holds contact details, so it lives in this tab's sessionStorage only.
  const draftKey = `drive_right_paid_intake_v1:${location.pathname}`;
  const draft = {
    read() { try { return JSON.parse(sessionStorage.getItem(draftKey)); } catch { return null; } },
    write(value) { try { sessionStorage.setItem(draftKey, JSON.stringify(value)); } catch { /* The page still works without a saved copy. */ } },
    clear() { try { sessionStorage.removeItem(draftKey); } catch { /* Nothing to clear. */ } },
    // A buyer who switches to the form keeps it for the rest of this tab's visit.
    get prefersForm() { try { return sessionStorage.getItem(`${draftKey}:form`) === '1'; } catch { return false; } },
    set prefersForm(value) { try { sessionStorage.setItem(`${draftKey}:form`, value ? '1' : ''); } catch { /* This visit only. */ } },
  };

  let state = restoreState(draft.read());
  let started = false, shown = false, replyPending = false, replyTimer, submitting = false;

  $('#send-answer').innerHTML = icon('up');
  const submitLabel = submitButton.textContent;
  if (!draft.prefersForm) {
    chat.hidden = false;
    formSection.hidden = true;
  } else syncForm({ emptyOnly:true });

  // Hidden inputs carry the chat-only answers (years, radius, needs…) with the form.
  // In form mode only empty fields are filled, so a reload never overwrites the buyer's edits.
  function syncForm({ emptyOnly = false } = {}) {
    for (const [name, value] of Object.entries(formValues(state, tier))) {
      let control = form.elements.namedItem(name);
      if (emptyOnly && control instanceof Element && !('chatAnswer' in control.dataset) && control.value) continue;
      if (!control) {
        if (!value) continue;
        control = Object.assign(document.createElement('input'), { type:'hidden', name });
        control.dataset.chatAnswer = '';
        form.append(control);
      }
      if (!(control instanceof Element)) continue;
      const before = control.value;
      if (control.tagName === 'SELECT' && value && ![...control.options].some(option => option.value === value)) control.add(new Option(value, value));
      control.value = value;
      // A typed field with limits (model year 2000–2027) keeps only values it accepts;
      // the full answer still travels in its own chat field.
      if (!control.required && !control.checkValidity()) control.value = '';
      if (control.tagName === 'SELECT' && control.value !== before) control.dispatchEvent(new Event('change', { bubbles:true }));
    }
  }

  function save() {
    draft.write(state);
    syncForm();
  }

  function syncViewport() {
    if (document.body.dataset.view !== 'conversation' || !mobile() || !window.visualViewport) {
      chat.style.removeProperty('--conversation-height');
      chat.style.removeProperty('--conversation-top');
      return;
    }
    chat.style.setProperty('--conversation-height', `${window.visualViewport.height}px`);
    chat.style.setProperty('--conversation-top', `${window.visualViewport.offsetTop}px`);
  }

  function sizeAnswer() {
    input.style.height = 'auto';
    input.style.height = `${Math.min(input.scrollHeight, mobile() ? 104 : 160)}px`;
    log.scrollTop = log.scrollHeight;
  }

  function cancelReply() {
    clearTimeout(replyTimer);
    replyPending = false;
  }

  function prepareReply() {
    cancelReply();
    replyPending = true;
    render();
    // Guided prompts, paced so the reply feels conversational. The owner asked for an
    // extra 0.2 seconds of thinking on every reply (2026-10-05). The answer is saved first.
    const length = nextQuestion(state, tier)?.question.length || 80;
    const delay = (reduced() ? 250 : Math.min(1300, 750 + length * 4)) + 200;
    replyTimer = setTimeout(() => {
      replyPending = false;
      render();
      if (nextQuestion(state, tier)) input.focus({ preventScroll:true });
      else submitButton.focus({ preventScroll:true });
      // Bring the answer box into view once; after that the thread scrolls inside the panel.
      if (!shown) { shown = true; $('.composer-area').scrollIntoView({ block:'nearest', behavior:reduced() ? 'auto' : 'smooth' }); }
    }, delay);
  }

  function render() {
    const question = nextQuestion(state, tier);
    const { done, total } = progress(state, tier);
    $('#step-label').textContent = `${done} of ${total} questions`;
    $('#intake-progress').max = total;
    $('#intake-progress').value = done;

    // Keep earlier messages mounted so only the new turn animates and is announced.
    const answered = [...new Set([...Object.keys(state.answers), ...Object.keys(state.skipped)])];
    const steps = stepsFor(state.answers, tier).map(step => step.key);
    let response = log.querySelector('.message.assistant[data-current]');
    if (!response) {
      response = Object.assign(document.createElement('div'), { className:'message assistant' });
      response.dataset.current = '';
      log.append(response);
    }
    log.querySelectorAll('[data-answer]').forEach(message => { if (!steps.includes(message.dataset.answer) || !answered.includes(message.dataset.answer)) message.remove(); });
    let previous = log.querySelector('[data-welcome]');
    for (const key of steps.filter(step => answered.includes(step))) {
      let message = log.querySelector(`[data-answer="${key}"]`);
      if (!message) {
        message = Object.assign(document.createElement('div'), { className:'message user' });
        message.dataset.answer = key;
      }
      // Answers stay in question order, even when an earlier one is added later.
      if (message.previousElementSibling !== previous) previous.after(message);
      const question = questions.find(item => item.key === key);
      const text = state.answers[key] ?? question.skipLabel ?? 'Skipped';
      const label = question.label;
      if (message.querySelector('p')?.textContent !== text) message.innerHTML = `<div class="bubble"><p>${escape(text)}</p><button class="bubble-edit" type="button" data-edit="${key}" aria-label="Change ${escape(label.toLowerCase())}">${icon('edit')}</button></div><span class="message-label">${escape(label)}</span>`;
      message.classList.toggle('is-editing', state.editing === key);
      previous = message;
    }
    if (response.previousElementSibling !== previous) previous.after(response);

    const editing = Boolean(state.editing);
    const complete = !question && isComplete(state, tier);
    const name = firstName(state);
    const text = question
      ? (editing ? `Sure. ${question.question}` : question.question)
      : `${name ? `Thanks, ${name}. ` : ''}That’s everything we need to start your search. Check your answers, then send them to your advisor.`;
    const reply = replyPending
      ? '<div class="typing-bubble"><span class="sr-only">Drive Right is typing.</span><span class="mx-drive" aria-hidden="true"><span class="mx-body"></span><span class="mx-wheel r"></span><span class="mx-wheel f"></span></span></div>'
      : `<p class="assistant-reply">${escape(text)}</p>${question?.hint ? `<p class="assistant-hint">${escape(question.hint)}</p>` : ''}`;
    // The head-on Miata (logo-motion.css) flips its headlights up as each reply arrives.
    const avatar = `<span class="mx-avatar${replyPending ? '' : question ? ' is-hello' : ' is-done'}" aria-hidden="true"></span>`;
    const markup = `<span class="message-label assistant-name">${avatar}Drive Right</span>${reply}`;
    if (response.innerHTML !== markup) response.innerHTML = markup;

    const choices = question && !replyPending ? question.choices || [] : [];
    $('#choices').innerHTML = choices.map(choice => `<button class="choice-button" type="button" data-choice="${escape(choice)}">${escape(choice)}</button>`).join('');
    $('#choices').hidden = !choices.length;
    const skip = $('#skip-detail');
    skip.hidden = !question || replyPending || (!editing && question.required);
    skip.textContent = editing ? 'Keep my answer' : question?.skipLabel || 'Skip';
    $('#answer-actions').hidden = $('#choices').hidden && skip.hidden;

    $('#composer').hidden = !question && !replyPending;
    $('#composer').setAttribute('aria-busy', String(replyPending));
    input.readOnly = replyPending;
    $('#send-answer').disabled = replyPending;
    input.maxLength = question?.maxLength || 180;
    input.inputMode = question?.inputMode || 'text';
    input.autocomplete = question?.autocomplete || 'off';
    $('#composer').classList.toggle('is-multiline', !replyPending && Boolean(question?.multiline));
    input.placeholder = replyPending ? 'Your reply…' : (mobile() && question?.mobilePlaceholder) || question?.placeholder || 'Your answer';
    $('#answer-label').textContent = replyPending ? 'Your reply' : question?.question || 'Your answer';
    $('#input-hint').textContent = replyPending ? '' : question?.hint || 'Use the pencil to change an answer.';
    $('#chat-ready').hidden = !complete || replyPending;
    submitButton.disabled = submitting;
    log.querySelectorAll('.bubble-edit').forEach(button => { button.disabled = submitting; });
    requestAnimationFrame(sizeAnswer);
  }


  function send(raw) {
    if (replyPending || submitting) return;
    try {
      state = answerQuestion(state, raw, tier);
      save();
      input.value = '';
      showError('');
      prepareReply();
    } catch (error) {
      showError(error.message);
      input.focus();
    }
  }

  function showError(message) {
    $('#input-error').textContent = message;
    if (message) input.setAttribute('aria-invalid', 'true');
    else input.removeAttribute('aria-invalid');
  }

  function edit(key) {
    if (submitting) return;
    cancelReply();
    state = { ...state, editing:key };
    save();
    showError('');
    render();
    input.value = state.answers[key] || '';
    sizeAnswer();
    input.focus();
  }

  // The only submit event on the page is the onboarding form's own, as before.
  function outcome() {
    return new Promise(resolve => {
      const observer = new MutationObserver(() => {
        const status = form.querySelector('[data-form-status]');
        if (form.hidden || success?.style.display === 'block') finish({ ok:true });
        else if (status?.classList.contains('form-status--error') && status.textContent) finish({ ok:false, message:status.textContent });
      });
      const finish = result => { observer.disconnect(); resolve(result); };
      observer.observe(formSection, { subtree:true, childList:true, characterData:true, attributes:true });
    });
  }

  async function submit() {
    if (submitting || !isComplete(state, tier)) return;
    save();
    // Every answer was checked as it arrived; this catches anything the form still refuses.
    const invalid = [...form.elements].find(control => control.willValidate && !control.checkValidity());
    const question = invalid && questionForControl(invalid.name);
    if (question) {
      edit(question.key);
      showError(`Please check this answer. ${invalid.validationMessage}`);
      return;
    }
    if (invalid) { useForm(); form.reportValidity(); return; }
    // script.js owns the submit handler. Without it the browser would send the form as a
    // plain GET, putting contact details in the address.
    if (!window.driveRightClient) { $('#chat-error').textContent = 'The page is still loading. Please try again in a moment.'; return; }
    submitting = true;
    form.querySelector('[data-form-status]')?.remove();
    $('#chat-error').textContent = '';
    submitButton.setAttribute('aria-busy', 'true');
    submitButton.textContent = 'Sending…';
    render();
    const result = outcome();
    form.requestSubmit($('#onboarding-submit'));
    const { ok, message } = await result;
    submitting = false;
    submitButton.removeAttribute('aria-busy');
    submitButton.textContent = submitLabel;
    if (ok) {
      draft.clear();
      leaveChat();
      success?.querySelector('h3')?.setAttribute('tabindex', '-1');
      success?.querySelector('h3')?.focus({ preventScroll:true });
      success?.scrollIntoView({ block:'start' });
      return;
    }
    $('#chat-error').textContent = `${message} Your answers are saved here.`;
    render();
  }

  function leaveChat() {
    cancelReply();
    delete document.body.dataset.view;
    syncViewport();
    chat.hidden = true;
    formSection.hidden = false;
  }

  function useForm() {
    save();
    draft.prefersForm = true;
    leaveChat();
    window.scrollTo({ top:0, behavior:'instant' });
    const firstEmpty = [...form.elements].find(control => control.required && !control.value);
    (firstEmpty || form.querySelector('.section-heading') || form).focus?.({ preventScroll:true });
    formSection.scrollIntoView({ block:'start' });
  }

  function start() {
    if (started || chat.hidden || document.body.dataset.purchaseVerified !== 'true') return;
    started = true;
    document.body.dataset.view = 'conversation';
    syncViewport();
    $('[data-welcome] .assistant-reply').textContent = `Payment verified. Welcome to ${plans[tier]}. Tell us about the car, one question at a time, and we’ll start your search.`;
    save();
    // A buyer returning to this tab picks up where they left off.
    if (Object.keys(state.answers).length) { render(); input.focus({ preventScroll:true }); shown = true; $('.composer-area').scrollIntoView({ block:'nearest' }); }
    else prepareReply();
  }

  $('#send-answer').addEventListener('click', () => send(input.value));
  input.addEventListener('keydown', event => {
    // Enter sends; Shift+Enter adds a line in the longer answers.
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) { event.preventDefault(); send(input.value); }
  });
  input.addEventListener('input', () => { showError(''); sizeAnswer(); });
  $('#choices').addEventListener('click', event => { const button = event.target.closest('[data-choice]'); if (button) send(button.dataset.choice); });
  $('#skip-detail').addEventListener('click', () => {
    if (replyPending) return;
    if (state.editing) { state = { ...state, editing:null }; save(); input.value = ''; showError(''); render(); input.focus(); return; }
    state = skipQuestion(state, tier);
    save();
    input.value = '';
    showError('');
    prepareReply();
  });
  log.addEventListener('click', event => { const button = event.target.closest('[data-edit]'); if (button) edit(button.dataset.edit); });
  submitButton.addEventListener('click', submit);
  $('#use-form').addEventListener('click', useForm);
  window.addEventListener('resize', () => { syncViewport(); requestAnimationFrame(sizeAnswer); });
  window.visualViewport?.addEventListener('resize', () => { syncViewport(); requestAnimationFrame(sizeAnswer); });
  window.visualViewport?.addEventListener('scroll', syncViewport);
  new MutationObserver(start).observe(document.body, { attributes:true, attributeFilter:['data-purchase-verified'] });
  start();
}
