import { initializeAdConsent } from './ad-consent.js';

// Public Pixel ID verified in the SpurAuto account used for Drive Right.
// This static site does not substitute server environment variables into JS.
export const OPENAI_ADS_PIXEL_ID = '1FkmT28b6AkfCMFBEcxsHP';

const productionHosts = new Set(['www.driverightcarbuying.com', 'driverightcarbuying.com']);

export function createOpenAIAds(w, d, pixelId = OPENAI_ADS_PIXEL_ID) {
  let initialized = false;
  let failed = false;
  let pageViewed = false;
  let consent = { measurement: false, personalization: false };
  const sent = new Set();

  function allowed() {
    return Boolean(pixelId.trim()) && productionHosts.has(w.location.hostname)
      && !/^\/(?:payment-success[^/]*|success)\.html$/.test(w.location.pathname)
      && w.navigator.globalPrivacyControl !== true
      && consent.measurement === true && !failed;
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
      if (!allowed() || !initialize()) return false;
      const key = eventId ? `drive_right_openai_ads:${event}:${eventId}` : '';
      if (key) {
        if (sent.has(key)) return false;
        try { if (w.sessionStorage.getItem(key)) return false; } catch { /* Storage is optional. */ }
      }
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
        if (!allowed() && Array.isArray(w.oaiq.q)) {
          w.oaiq.q = w.oaiq.q.filter(args => args[0] !== 'measure');
        }
        w.oaiq('consent', allowed());
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
