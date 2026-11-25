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
  '/new-car-buying-service.html', '/car-buying-help.html',
  '/cars-selling-below-msrp.html', '/new-car-deals-this-month.html', '/best-compact-suvs.html',
  '/best-hybrid-suvs-under-35000.html', '/cheapest-new-pickup-trucks.html']);
const publicPathPatterns = [
  /^\/[a-z0-9-]+-price\.html$/, // vehicle price guides
  /^\/(?!blog-)[a-z0-9-]+-vs-[a-z0-9-]+\.html$/, // car-versus-car pages (blog-*-vs-* stay noindex)
  /^\/car-buying-service-[a-z0-9-]+\.html$/, // city pages, the near-me hub and the cost page
  /^\/[a-z0-9-]+-problems\.html$/, // problems-by-year pages (hybrid-vs-gas pages match the -vs- pattern)
];
// Conversion events Vercel may record, and the only data keys each may carry. Lead and checkout IDs,
// button labels and anything a person typed stay out; a value must be a short slug.
const eventFields = { cta_click: ['cta_location'], generate_lead: ['form_name'], begin_checkout: ['service_tier'], phone_click: [] };
const slugValue = /^[a-z0-9][a-z0-9_./-]{0,79}$/i;
export function eventPayload(name, data) {
  const fields = Object.hasOwn(eventFields, name) ? eventFields[name] : null;
  if (!fields) return null;
  const clean = {};
  for (const key of fields) {
    const value = data?.[key];
    if (typeof value === 'string' && slugValue.test(value)) clean[key] = value;
  }
  return { name, data: clean };
}
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
    if (!permitted() || !safeReferrer() || (event?.type !== 'pageview' && event?.type !== 'event')) return null;
    try {
      const url = new URL(event.url);
      if (url.origin !== w.location.origin || !isPublicPath(url.pathname) || url.username || url.password) return null;
      const clean = `${url.origin}${url.pathname === '/index.html' ? '/' : url.pathname}`;
      if (event.type === 'pageview') return { type: 'pageview', url: clean };
      // The SDK sends the original payload when the returned one is missing, so always return a rebuilt one.
      const payload = eventPayload(event.payload?.name, event.payload?.data);
      return payload ? { type: 'event', url: clean, payload } : null;
    } catch { return null; }
  }
  function track(name, data) {
    if (!loaded || !permitted()) return;
    const payload = eventPayload(name, data);
    if (payload) w.va('event', payload);
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
  return { setConsent, beforeSend, track };
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
