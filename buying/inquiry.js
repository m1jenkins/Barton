const dialog = document.getElementById('car-search-inquiry');
const form = document.getElementById('car-search-inquiry-form');
// Web3Forms emails each saved inquiry to Mason. The access key is public by design.
const WEB3FORMS_ACCESS_KEY = '316da49d-33c3-4a6a-9324-6fdd8b5dff0b';

async function emailMason(saved, leadId) {
  try {
    const response = await window.fetch('https://api.web3forms.com/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        access_key: WEB3FORMS_ACCESS_KEY,
        subject: `New car search inquiry: ${saved.vehicle}`,
        from_name: 'Drive Right website',
        name: saved.name || 'Not given',
        email: saved.email,
        phone: saved.phone || 'Not given',
        message: `${saved.message}\n\nPage: ${saved.source_page}\nSaved inquiry: ${leadId}`
      })
    });
    return (await response.json())?.success === true;
  } catch {
    return false;
  }
}

if (dialog && form) {
  const submit = form.querySelector('[type="submit"]');
  const status = form.querySelector('[data-form-status]');
  const emailHandoff = form.querySelector('[data-email-inquiry]');
  const interest = form.elements.namedItem('service_interest');
  let pendingKey = '';
  let pendingPayload = '';
  let opener;
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
      status.textContent = 'Please try again, or call Mason at (512) 910-4938.';
      status.className = 'form-status form-status--error';
      return;
    }
    const fields = new FormData(form);
    const vehicle = String(fields.get('vehicle') || '').trim();
    const budget = String(fields.get('budget') || '').trim();
    const timeline = String(fields.get('timeline') || '').trim();
    const payload = JSON.stringify({
      name: String(fields.get('name') || '').trim(),
      email: String(fields.get('email') || '').trim(),
      phone: String(fields.get('phone') || '').trim(),
      vehicle,
      message: [
        `Service interest: ${interest.value}`,
        `Vehicle: ${vehicle}`,
        budget ? `Vehicle budget: ${budget}` : '',
        timeline ? `Buying timeline: ${timeline}` : ''
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
      const emailed = result.forwarding_configured === true || (!saved.honeypot && await emailMason(saved, result.lead_id));
      if (!emailed) {
        const body = `${saved.name ? `Name: ${saved.name}\n` : ''}Reply email: ${saved.email}\n${saved.phone ? `Phone: ${saved.phone}\n` : ''}\n${saved.message}\n\nSaved inquiry: ${result.lead_id}`;
        emailDraft = `mailto:hello@driverightcarbuying.com?subject=${encodeURIComponent('My car search inquiry')}&body=${encodeURIComponent(body)}`;
        emailHandoff.hidden = false;
      }
      pendingKey = '';
      pendingPayload = '';
      form.reset();
      status.className = 'form-status form-status--success';
      status.textContent = emailed
        ? 'Thanks. Your car search inquiry is saved. Mason replies within one business day, or call (512) 910-4938.'
        : 'Your car search inquiry is saved. To get in touch, email Mason these details with the button below, or call (512) 910-4938.';
      status.focus();
    } catch {
      status.className = 'form-status form-status--error';
      status.textContent = 'Your inquiry could not be sent. Please try again, or call Mason at (512) 910-4938.';
    } finally {
      submit.disabled = false;
      submit.removeAttribute('aria-busy');
      submit.textContent = 'Send my car search inquiry';
    }
  });
}
