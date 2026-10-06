// The footer opt-out works like Global Privacy Control for this site. It is a
// first-party cookie so the API can also skip its OpenAI conversion events;
// api/_lib/openai-ads-capi.js reads the same name.
export const MEASUREMENT_OPT_OUT_COOKIE = 'dr_ad_measurement';
const optOutPattern = /(?:^|;\s*)dr_ad_measurement=off(?:;|$)/;
const lifetimeSeconds = 365 * 24 * 60 * 60;

export function measurementOptedOut(cookie) {
  return typeof cookie === 'string' && optOutPattern.test(cookie);
}

export function initializePrivacyChoices(w, d) {
  if (d.querySelector('[data-measurement-opt-out-link]')) return;
  const gpc = () => w.navigator?.globalPrivacyControl === true;
  const off = () => gpc() || measurementOptedOut(d.cookie);

  const link = d.createElement('a');
  link.href = '/policy.html#opt-out';
  link.dataset.measurementOptOutLink = '';
  // Beside the Policy link in both footer styles; a list item for the legacy list.
  const policy = d.querySelector('footer a[href$="policy.html"]');
  if (policy?.parentElement?.tagName === 'LI') {
    const item = d.createElement('li');
    item.appendChild(link);
    policy.parentElement.after(item);
  } else if (policy) {
    policy.after(link);
  } else {
    (d.querySelector('footer') || d.body).appendChild(link);
  }

  const toggle = d.querySelector('[data-measurement-toggle]');
  const status = d.querySelector('[data-measurement-status]');
  let last = off();
  function changed() {
    last = off();
    w.dispatchEvent(new CustomEvent('drive-right:measurement-choice'));
    render();
  }
  function render() {
    link.textContent = off() ? 'Ad measurement is off' : 'Opt out of ad measurement';
    if (!toggle) return;
    toggle.hidden = false;
    toggle.disabled = gpc();
    toggle.textContent = off() ? 'Turn ad measurement back on' : 'Turn off ad measurement';
    if (status) {
      status.textContent = gpc() ? 'Your browser’s Global Privacy Control keeps ad measurement off.'
        : `Ad measurement is ${off() ? 'off' : 'on'} in this browser.`;
    }
  }
  function choose(optOut) {
    const secure = w.location.protocol === 'https:' ? '; Secure' : '';
    d.cookie = optOut
      ? `${MEASUREMENT_OPT_OUT_COOKIE}=off; Max-Age=${lifetimeSeconds}; Path=/; SameSite=Lax${secure}`
      : `${MEASUREMENT_OPT_OUT_COOKIE}=; Max-Age=0; Path=/; SameSite=Lax${secure}`;
    if (optOut) {
      // Forget the OpenAI ad click reference too, whichever domain the Pixel used.
      d.cookie = '__oppref=; Max-Age=0; Path=/';
      d.cookie = `__oppref=; Max-Age=0; Path=/; Domain=${w.location.hostname.replace(/^www\./, '')}`;
    }
    changed();
  }
  toggle?.addEventListener('click', () => choose(!measurementOptedOut(d.cookie)));
  // Another tab may have changed the choice; cookies raise no storage event.
  const sync = () => { if (off() !== last) changed(); };
  w.addEventListener('pageshow', sync);
  d.addEventListener('visibilitychange', () => { if (d.visibilityState === 'visible') sync(); });
  render();
}
