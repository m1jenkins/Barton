import { measurementOptedOut } from './privacy-choices.js?v=13903db6444b';

// Measure only the released, indexable informational pages. Receipts, forms'
// private results, the quote worksheet, APIs, noindex pages and unknown routes
// are outside this list. The generated page families are matched by pattern so
// new price guides, comparisons and city pages count without an edit here.
const publicPaths = new Set(['/', '/index.html', '/about.html', '/how-it-works.html',
  '/car-buying-service.html', '/schedule.html', '/blog.html', '/policy.html',
  '/austin.html', '/texas-local-market-intelligence.html',
  '/blog-buy-new-car-below-msrp.html', '/blog-dealership-addons-complete-guide.html',
  '/blog-used-car-inspection-checklist.html',
  '/compare-car-buying-services.html', '/caredge-alternatives.html', '/delivrd-alternatives.html',
  '/delivrd-review.html', '/is-caredge-concierge-worth-it.html', '/used-car-buying-service.html',
  '/car-negotiation-service.html', '/car-buying-concierge.html', '/car-finder-service.html',
  '/new-car-buying-service.html', '/car-buying-help.html']);
const publicPathPatterns = [
  /^\/[a-z0-9-]+-price\.html$/, // vehicle price guides
  /^\/[a-z0-9-]+-problems\.html$/, // problems-by-year pages
  /^\/(?!blog-)[a-z0-9-]+-vs-[a-z0-9-]+\.html$/, // car-versus-car pages (blog-*-vs-* stay noindex)
  /^\/car-buying-service-[a-z0-9-]+\.html$/, // city pages, the near-me hub and the cost page
];
const isPublicPath = (path) => publicPaths.has(path) || publicPathPatterns.some((re) => re.test(path));
const hosts = new Set(['www.steermeright.com', 'steermeright.com', 'www.driverightcarbuying.com', 'driverightcarbuying.com']);

export function createWebAnalytics(w, d) {
  let consent = false, loaded = false;
  const permitted = () => consent && w.navigator?.globalPrivacyControl !== true && !measurementOptedOut(d.cookie)
    && hosts.has(w.location.hostname) && isPublicPath(w.location.pathname);
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
      if (url.origin !== w.location.origin || !isPublicPath(url.pathname) || url.username || url.password) return null;
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
      // On by default; the footer opt-out and Global Privacy Control turn it off in permitted().
      analytics.setConsent(true);
      window.addEventListener('drive-right:measurement-choice', () => analytics.setConsent(true));
    }
  } catch { /* Measurement cannot block any site interaction. */ }
}
