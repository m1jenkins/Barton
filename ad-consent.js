export const AD_CONSENT_KEY = 'drive_right_openai_consent_v1';
const lifetime = 180 * 24 * 60 * 60 * 1000;

export function readAdConsent(storage, now = Date.now()) {
  try {
    const value = JSON.parse(storage.getItem(AD_CONSENT_KEY));
    if (value?.version === 1 && typeof value.measurement === 'boolean'
      && Number.isFinite(value.savedAt) && value.savedAt <= now && now - value.savedAt < lifetime) {
      return value;
    }
  } catch { /* Missing or unavailable storage means no permission. */ }
  return null;
}

export function initializeAdConsent(w, d, setConsent) {
  if (d.getElementById('drive-right-ad-privacy')) return;
  let storage;
  try { storage = w.localStorage; } catch { /* The choice can still apply to this page. */ }
  let choice = readAdConsent(storage);
  let returnFocus;
  const gpc = () => w.navigator.globalPrivacyControl === true;
  const apply = () => setConsent({ measurement: !gpc() && choice?.measurement === true, personalization: false });
  apply();

  const styles = d.createElement('link');
  styles.rel = 'stylesheet';
  styles.href = '/ad-consent.css';
  d.head.appendChild(styles);
  const panel = d.createElement('section');
  panel.id = 'drive-right-ad-privacy';
  panel.setAttribute('aria-labelledby', 'drive-right-ad-privacy-title');
  panel.innerHTML = `
    <h2 id="drive-right-ad-privacy-title" tabindex="-1">Your ad privacy</h2>
    <p>May we use OpenAI ad measurement? It shares page visits, saved inquiries and checkout starts with OpenAI to measure our ads. It uses a cookie and may match contact details you enter after hashing them in your browser.</p>
    <p>Optional. You can use the site either way and change your choice with “Ad privacy” in the footer. <a href="/policy.html#openai-ad-measurement">Read the details</a>.</p>
    <p data-ad-privacy-status role="status"></p>
    <div class="ad-privacy-actions">
      <button type="button" data-ad-privacy-reject>No thanks</button>
      <button type="button" data-ad-privacy-accept>Allow ad measurement</button>
    </div>`;
  // Do not interrupt paid intake with a first-visit measurement prompt.
  panel.hidden = Boolean(choice) || gpc() || /^\/(?:payment-success[^/]*|success)\.html$/.test(w.location.pathname);
  d.body.appendChild(panel);

  const preferences = d.createElement('button');
  preferences.type = 'button';
  preferences.className = 'ad-privacy-preferences';
  preferences.textContent = 'Ad privacy';
  preferences.setAttribute('aria-controls', panel.id);
  preferences.setAttribute('aria-expanded', String(!panel.hidden));
  (d.querySelector('footer') || d.body).appendChild(preferences);

  const status = panel.querySelector('[data-ad-privacy-status]');
  const accept = panel.querySelector('[data-ad-privacy-accept]');
  function renderStatus() {
    accept.disabled = gpc();
    status.textContent = gpc() ? 'Your browser’s Global Privacy Control keeps OpenAI ad measurement off.'
      : choice ? `OpenAI ad measurement is ${choice.measurement ? 'on' : 'off'}.` : '';
  }
  function open() {
    returnFocus = d.activeElement;
    renderStatus();
    panel.hidden = false;
    preferences.setAttribute('aria-expanded', 'true');
    panel.querySelector('h2').focus();
  }
  function close() {
    panel.hidden = true;
    preferences.setAttribute('aria-expanded', 'false');
    if (panel.contains(d.activeElement)) (returnFocus || preferences).focus({ preventScroll: true });
  }
  function save(measurement) {
    choice = { version: 1, measurement: measurement === true && !gpc(), savedAt: Date.now() };
    try { storage?.setItem(AD_CONSENT_KEY, JSON.stringify(choice)); } catch { /* No persistence; re-ask next page. */ }
    apply();
    close();
  }
  renderStatus();
  preferences.addEventListener('click', open);
  d.querySelectorAll('[data-open-ad-privacy]').forEach(button => button.addEventListener('click', open));
  panel.querySelector('[data-ad-privacy-reject]').addEventListener('click', () => save(false));
  accept.addEventListener('click', () => save(true));
  panel.addEventListener('keydown', event => { if (event.key === 'Escape') close(); });
  w.addEventListener('storage', event => {
    if (event.key !== AD_CONSENT_KEY && event.key !== null) return;
    choice = readAdConsent(storage);
    apply();
    renderStatus();
  });
  w.addEventListener('pageshow', event => {
    if (!event.persisted) return;
    choice = readAdConsent(storage);
    apply();
    renderStatus();
  });
}
