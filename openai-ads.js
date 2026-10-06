import { initializeAdConsent } from './ad-consent.js?v=7647dbdce8d4';

// Public Pixel ID supplied by the site owner on September 28, 2026.
// This static site does not substitute server environment variables into JS.
export const OPENAI_ADS_PIXEL_ID = '4FeqFBVzJFUMdu8S8gatam';

const productionHosts = new Set(['www.driverightcarbuying.com', 'driverightcarbuying.com']);

export function createOpenAIAds(w, d, pixelId = OPENAI_ADS_PIXEL_ID) {
  let initialized = false;
  let failed = false;
  let pageViewed = false;
  let consent = { measurement: false, personalization: false };
  const sent = new Set();

  function allowed(event) {
    if (!pixelId.trim() || !productionHosts.has(w.location.hostname)
      || w.navigator.globalPrivacyControl === true || consent.measurement !== true || failed) return false;
    if (/^\/payment-success[^/]*\.html$/.test(w.location.pathname)) {
      // Receipt visits alone are not conversions. The paid-session verifier removes the
      // bearer from the address before setting this marker and reporting the ledger UUID.
      return event === 'order_created' && d.body?.dataset.purchaseVerified === 'true'
        && !/(?:[?#&]|^)(?:session_id|checkout_session_id)=/i.test(`${w.location.search || ''}${w.location.hash || ''}`);
    }
    return w.location.pathname !== '/success.html' && event !== 'order_created';
  }

  function initialize() {
    if (initialized) return true;
    // Another owner (for example GTM) must not initialize a second copy.
    if (w.oaiq) return false;
    const q = function () { if (!failed && q.q.length < 100) q.q.push(arguments); };
    q.q = [];
    w.oaiq = q;
    w.oaiq('consent', true);
    w.oaiq('init', { pixelId });
    const script = d.createElement('script');
    script.async = true;
    script.src = 'https://bzrcdn.openai.com/sdk/oaiq.min.js';
    script.onerror = () => { failed = true; q.q.length = 0; };
    d.head.appendChild(script);
    initialized = true;
    return true;
  }

  function measure(event, data, eventId) {
    try {
      if (!allowed(event)) return false;
      const key = eventId ? `drive_right_openai_ads:${event}:${eventId}` : '';
      if (key) {
        if (sent.has(key)) return false;
        try { if (w.sessionStorage.getItem(key)) return false; } catch { /* Storage is optional. */ }
      }
      if (!initialize()) return false;
      const options = { opt_out: consent.personalization !== true };
      if (eventId) options.event_id = eventId;
      w.oaiq('measure', event, data, options);
      if (key) {
        sent.add(key);
        try { w.sessionStorage.setItem(key, '1'); } catch { /* In-memory dedupe still applies. */ }
      }
      return true;
    } catch {
      // Reporting must never interrupt a form submission or checkout redirect.
      failed = true;
      return false;
    }
  }

  function setConsent(value) {
    try {
      consent = {
        measurement: value?.measurement === true,
        personalization: value?.personalization === true
      };
      if (initialized) {
        // Remove queued events on withdrawal before a slow SDK has loaded.
        const measurementAllowed = allowed() || allowed('order_created');
        if (!measurementAllowed && Array.isArray(w.oaiq.q)) {
          w.oaiq.q = w.oaiq.q.filter(args => args[0] !== 'measure');
        }
        w.oaiq('consent', measurementAllowed);
      }
      if (!pageViewed && measure('page_viewed', { type: 'contents' })) pageViewed = true;
    } catch { failed = true; }
  }

  function track(event, properties = {}) {
    try {
      if (event === 'generate_lead' && properties.lead_id) {
        measure('lead_created', { type: 'customer_action' }, `lead:${properties.lead_id}`);
      } else if (event === 'begin_checkout' && properties.checkout_attempt_id) {
        measure('checkout_started', { type: 'contents' }, `checkout:${properties.checkout_attempt_id}`);
      } else if (event === 'purchase_verified') {
        const { transaction_id: id, value, currency } = properties;
        if (typeof id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
          || typeof value !== 'number' || !Number.isFinite(value) || value <= 0
          || typeof currency !== 'string' || !/^[A-Z]{3}$/.test(currency)) return;
        const amount = Math.round(value * 100);
        if (!Number.isSafeInteger(amount) || amount <= 0) return;
        measure('order_created', { type: 'contents', amount, currency }, `purchase:${id}`);
      }
    } catch { /* No analytics error may affect the business flow. */ }
  }

  return { track, setConsent };
}

// The site's Ad privacy controls supply the actual visitor choice.
export const openAIAds = (() => {
  const noop = { track() {}, setConsent() {} };
  if (typeof window === 'undefined' || typeof document === 'undefined') return noop;
  try {
    if (window.driveRightOpenAIAds) return window.driveRightOpenAIAds;
    const ads = createOpenAIAds(window, document);
    window.driveRightOpenAIAds = ads;
    window.addEventListener('drive-right:ads-consent', event => ads.setConsent(event.detail));
    initializeAdConsent(window, document, ads.setConsent);
    return ads;
  } catch { return noop; }
})();
