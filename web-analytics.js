import { readAdConsent } from './ad-consent.js?v=7647dbdce8d4';

// Measure only the released informational pages. Receipts, forms' private
// results, the quote worksheet, APIs and unknown routes are outside this list.
const publicPaths = new Set(['/', '/index.html', '/about.html', '/how-it-works.html',
  '/car-buying-service.html', '/schedule.html', '/blog.html', '/policy.html',
  '/austin.html', '/texas-local-market-intelligence.html',
  '/blog-buy-new-car-below-msrp.html', '/blog-dealership-addons-complete-guide.html',
  '/blog-used-car-inspection-checklist.html']);
const hosts = new Set(['www.driverightcarbuying.com', 'driverightcarbuying.com']);

export function createWebAnalytics(w, d) {
  let consent = false, loaded = false;
  const permitted = () => consent && w.navigator?.globalPrivacyControl !== true
    && hosts.has(w.location.hostname) && publicPaths.has(w.location.pathname);
  const safeReferrer = () => {
    if (!d.referrer) return true;
    try {
      const url = new URL(d.referrer);
      // The SDK omits same-host referrers. It sends external referrers intact,
      // so suppress the view unless the external URL contains only an origin.
      return !url.username && !url.password && (/^https?:$/.test(url.protocol))
        && (url.host === w.location.host || (!url.search && !url.hash && url.pathname === '/'));
    } catch { return false; }
  };
  function beforeSend(event) {
    if (!permitted() || !safeReferrer() || event?.type !== 'pageview') return null;
    try {
      const url = new URL(event.url);
      if (url.origin !== w.location.origin || !publicPaths.has(url.pathname) || url.username || url.password) return null;
      return { type: 'pageview', url: `${url.origin}${url.pathname === '/index.html' ? '/' : url.pathname}` };
    } catch { return null; }
  }
  function setConsent(value) {
    consent = value === true;
    if (loaded || !permitted() || !safeReferrer()) return;
    loaded = true;
    w.va ||= function (...args) { (w.vaq ||= []).push(args); };
    w.va('beforeSend', beforeSend);
    w.va('reset'); // This site never sets an analytics user identity.
    const script = d.createElement('script');
    script.defer = true;
    script.src = '/_vercel/insights/script.js';
    script.referrerPolicy = 'no-referrer';
    d.head.appendChild(script);
  }
  return { setConsent, beforeSend };
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  try {
    if (!window.driveRightWebAnalytics) {
      const analytics = createWebAnalytics(window, document);
      window.driveRightWebAnalytics = analytics;
      const refresh = () => {
        let choice;
        try { choice = readAdConsent(window.localStorage); } catch {}
        // Old permission for OpenAI is not permission for this additional tool.
        analytics.setConsent(choice?.webAnalytics === true);
      };
      window.addEventListener('drive-right:web-analytics-consent', event => analytics.setConsent(event.detail === true));
      window.addEventListener('storage', refresh);
      window.addEventListener('pageshow', refresh);
      refresh();
    }
  } catch { /* Measurement cannot block any site interaction. */ }
}
