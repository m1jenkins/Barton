const dialog = document.getElementById('car-search-inquiry');
const form = document.getElementById('car-search-inquiry-form');

if (dialog && form) {
  const submit = form.querySelector('[type="submit"]');
  const status = form.querySelector('[data-form-status]');
  const emailHandoff = form.querySelector('[data-email-inquiry]');
  const interest = form.elements.namedItem('service_interest');
  const contactField = form.elements.namedItem('contact');
  const detailsField = form.elements.namedItem('details');
  const defaultPrompt = detailsField?.placeholder || '';
  let pendingKey = '';
  let pendingPayload = '';
  let opener;
  // Pages about one car pass it along with the message; there is no car field to fill in.
  let pageVehicle = '';
  let emailDraft = '';

  emailHandoff.addEventListener('click', event => {
    if (!emailDraft) return;
    event.preventDefault();
    // Keep private form contents out of the recorded DOM. Only the visitor's
    // explicit email handoff opens their own email app with these details.
    window.location.assign(emailDraft);
  });

  document.querySelectorAll('[data-open-inquiry]').forEach(button => {
    button.addEventListener('click', () => {
      opener = button;
      interest.value = button.dataset.openInquiry || 'Not sure yet';
      pageVehicle = button.dataset.inquiryVehicle || '';
      if (detailsField) detailsField.placeholder = button.dataset.inquiryPrompt || defaultPrompt;
      status.textContent = '';
      emailHandoff.hidden = true;
      emailDraft = '';
      dialog.showModal();
    });
  });
  dialog.querySelector('[data-close-inquiry]').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => opener?.focus({ preventScroll: true }));

  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (submit.disabled) return;
    const client = window.driveRightClient;
    if (!client) {
      status.textContent = 'Please try again, or email Mason at hello@steermeright.com.';
      status.className = 'form-status form-status--error';
      return;
    }
    const fields = new FormData(form);
    const contact = String(fields.get('contact') || '').trim();
    const details = String(fields.get('details') || '').trim();
    // One box takes an email address or a phone number: an @ means email.
    const isEmail = contact.includes('@');
    const contactError = isEmail
      ? (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact) ? '' : 'Check the email address, or enter a phone number instead.')
      : (contact.replace(/\D/g, '').length >= 7 ? '' : 'Enter an email address or a phone number Mason can reach you at.');
    if (contactError || !details) {
      status.className = 'form-status form-status--error';
      status.textContent = contactError || 'Tell Mason what you’re looking for.';
      (contactError ? contactField : detailsField)?.focus();
      return;
    }
    const payload = JSON.stringify({
      name: '',
      email: isEmail ? contact : '',
      phone: isEmail ? '' : contact,
      vehicle: pageVehicle,
      message: [
        `Service interest: ${interest.value}`,
        pageVehicle ? `Car on the page: ${pageVehicle}` : '',
        `Message:\n${details}`
      ].filter(Boolean).join('\n'),
      source: 'pricing_inquiry',
      source_page: window.location.pathname,
      honeypot: String(fields.get('website') || ''),
      attribution: client.attribution
    });
    if (!pendingKey || payload !== pendingPayload) {
      pendingKey = client.createId();
      pendingPayload = payload;
    }
    submit.disabled = true;
    submit.setAttribute('aria-busy', 'true');
    submit.textContent = 'Sending your inquiry…';
    status.textContent = '';
    emailHandoff.hidden = true;
    try {
      const result = await client.requestJson('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': pendingKey },
        body: pendingPayload
      });
      if (typeof result?.lead_id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(result.lead_id)) throw new Error('Missing saved inquiry ID');
      // Use the shared success boundary and durable ID; contact details stay out of analytics.
      try { client.track('generate_lead', { form_name: 'pricing_inquiry', lead_id: result.lead_id }); } catch { /* Measurement cannot undo a saved inquiry. */ }
      const saved = JSON.parse(pendingPayload);
      const topic = saved.vehicle || (details.length > 60 ? `${details.slice(0, 57)}…` : details);
      // A phone-only inquiry has no reply address, so the email to Mason carries none.
      const emailed = result.forwarding_configured === true || (!saved.honeypot && await client.emailMason?.({ ...saved, email: saved.email || undefined, subject: `New car search inquiry: ${topic}` }, result.lead_id));
      if (!emailed) {
        const body = `${saved.email ? `Reply email: ${saved.email}\n` : ''}${saved.phone ? `Phone: ${saved.phone}\n` : ''}\n${saved.message}\n\nSaved inquiry: ${result.lead_id}`;
        emailDraft = `mailto:hello@steermeright.com?subject=${encodeURIComponent('My car search inquiry')}&body=${encodeURIComponent(body)}`;
        emailHandoff.hidden = false;
      }
      pendingKey = '';
      pendingPayload = '';
      form.reset();
      status.className = 'form-status form-status--success';
      status.textContent = emailed
        ? 'Thanks. Your car search inquiry is saved. Mason replies within one business day, or email hello@steermeright.com.'
        : 'Your car search inquiry is saved. To get in touch, email Mason these details with the button below, or email hello@steermeright.com.';
      status.focus();
    } catch {
      status.className = 'form-status form-status--error';
      status.textContent = 'Your inquiry could not be sent. Please try again, or email Mason at hello@steermeright.com.';
    } finally {
      submit.disabled = false;
      submit.removeAttribute('aria-busy');
      submit.textContent = 'Send to Mason';
    }
  });
}
