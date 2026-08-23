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
  '/how-it-works.html': 'service_comparison',
  '/texas-car-buying-rules-paperwork.html': 'texas_rules_and_risk',
  '/auto-financing-credit-fi.html': 'financing',
  '/used-car-due-diligence.html': 'used_car_due_diligence',
  '/new-car-pricing-incentives.html': 'new_car_pricing',
  '/vehicle-selection-total-cost.html': 'vehicle_selection',
  '/texas-local-market-intelligence.html': 'texas_metros'
});

export function pageContext(sourcePage) {
  const path = typeof sourcePage === 'string' ? sourcePage : '';
  const isArticle = /^\/blog-[a-z0-9-]+\.html$/.test(path);
  return {
    page_type: path === '/' || path === '/index.html'
      ? 'home'
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
  return {
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
  };
}
