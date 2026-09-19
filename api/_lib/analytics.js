const CITY_BY_FILE = Object.freeze({
  '/arlington.html': 'Arlington',
  '/austin.html': 'Austin',
  '/dallas.html': 'Dallas',
  '/el-paso.html': 'El Paso',
  '/fort-worth.html': 'Fort Worth',
  '/houston.html': 'Houston',
  '/new-braunfels.html': 'New Braunfels',
  '/san-antonio.html': 'San Antonio',
  '/san-marcos.html': 'San Marcos'
});

const HUB_CLUSTERS = Object.freeze({
  '/blog.html': 'all_topics',
  '/ai-car-buying-agent.html': 'agent_service',
  '/how-it-works.html': 'service_comparison',
  '/texas-car-buying-rules-paperwork.html': 'texas_rules_and_risk',
  '/auto-financing-credit-fi.html': 'financing',
  '/used-car-due-diligence.html': 'used_car_due_diligence',
  '/new-car-pricing-incentives.html': 'new_car_pricing',
  '/vehicle-selection-total-cost.html': 'vehicle_selection',
  '/texas-local-market-intelligence.html': 'texas_metros'
});

export function analyticsPath(value) {
  return typeof value === 'string' && value.startsWith('/') && !value.startsWith('//') ? value.split(/[?#]/)[0].slice(0, 300) : '/';
}

export function analyticsProperties(payload) {
  const result = {};
  for (const key of ['event_id','transaction_id','checkout_session_id','purchase_id','checkout_attempt_id','lead_id','onboarding_id','page_type','topic_cluster','city','service_tier','value','currency']) {
    if (Object.hasOwn(payload, key)) result[key] = payload[key];
  }
  if (Object.hasOwn(payload, 'source_page')) result.source_page = analyticsPath(payload.source_page);
  if (payload.attribution && typeof payload.attribution === 'object') {
    result.attribution = {};
    for (const key of ['first_touch', 'last_touch']) {
      if (!Object.hasOwn(payload.attribution, key)) continue;
      const touch = payload.attribution[key];
      if (!touch || typeof touch !== 'object' || Array.isArray(touch)) { result.attribution[key] = null; continue; }
      const clean = {};
      for (const field of ['captured_at','utm_source','utm_medium','utm_campaign','utm_content','utm_term']) {
        if (typeof touch[field] === 'string') clean[field] = touch[field].slice(0, field === 'captured_at' ? 40 : field === 'utm_source' || field === 'utm_medium' ? 200 : 300);
      }
      if (Object.hasOwn(touch, 'landing_path')) clean.landing_path = analyticsPath(touch.landing_path);
      if (Object.hasOwn(touch, 'referrer')) {
        clean.referrer = '';
        try { const url = new URL(touch.referrer); if (['https:', 'http:'].includes(url.protocol)) clean.referrer = url.origin; } catch {}
      }
      result.attribution[key] = clean;
    }
  }
  return result;
}

export function pageContext(sourcePage) {
  const path = analyticsPath(sourcePage);
  const isArticle = /^\/blog-[a-z0-9-]+\.html$/.test(path);
  return {
    page_type: path === '/' || path === '/index.html'
      ? 'home'
      : path === '/ai-car-buying-agent.html'
        ? 'service_landing'
      : path === '/schedule.html'
        ? 'service'
        : CITY_BY_FILE[path]
          ? 'local_service_area'
          : isArticle
            ? 'article'
            : HUB_CLUSTERS[path]
              ? 'resource_hub'
              : 'other',
    topic_cluster: isArticle ? path.slice(6, -5) : (HUB_CLUSTERS[path] || ''),
    city: CITY_BY_FILE[path] || ''
  };
}

export function purchaseEventPayload({
  checkoutSessionId,
  purchaseId,
  checkoutAttemptId,
  leadId,
  sourcePage,
  serviceTier,
  amountTotal,
  currency,
  attribution
}) {
  return analyticsProperties({
    event_id: `purchase:${checkoutSessionId}`,
    transaction_id: checkoutSessionId,
    checkout_session_id: checkoutSessionId,
    purchase_id: purchaseId,
    checkout_attempt_id: checkoutAttemptId,
    lead_id: leadId,
    source_page: sourcePage,
    ...pageContext(sourcePage),
    service_tier: serviceTier,
    value: amountTotal / 100,
    currency: currency.toUpperCase(),
    attribution
  });
}
