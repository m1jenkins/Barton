/* =============================================
   DRIVE RIGHT — shared browser behavior
   ============================================= */

(function () {
    'use strict';

    var dataLayer = window.dataLayer = window.dataLayer || [];
    var nav = document.getElementById('nav');
    var hamburger = document.getElementById('hamburger');
    var mobileMenu = document.getElementById('mobile-menu');
    var mobileClose = document.getElementById('mobile-close');
    var lastFocusedElement = null;

    function createId() {
        if (window.crypto && typeof window.crypto.randomUUID === 'function') {
            return window.crypto.randomUUID();
        }
        return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);
    }

    function pageContext() {
        var filename = window.location.pathname.split('/').pop() || 'index.html';
        var cityFiles = {
            'arlington.html': 'Arlington',
            'austin.html': 'Austin',
            'dallas.html': 'Dallas',
            'el-paso.html': 'El Paso',
            'fort-worth.html': 'Fort Worth',
            'houston.html': 'Houston',
            'new-braunfels.html': 'New Braunfels',
            'san-antonio.html': 'San Antonio',
            'san-marcos.html': 'San Marcos'
        };
        var hubClusters = {
            'blog.html': 'all_topics',
            'how-it-works.html': 'service_comparison',
            'texas-car-buying-rules-paperwork.html': 'texas_rules_and_risk',
            'auto-financing-credit-fi.html': 'financing',
            'used-car-due-diligence.html': 'used_car_due_diligence',
            'new-car-pricing-incentives.html': 'new_car_pricing',
            'vehicle-selection-total-cost.html': 'vehicle_selection',
            'texas-local-market-intelligence.html': 'texas_metros'
        };
        var type = filename === 'index.html' ? 'home'
            : filename.indexOf('blog-') === 0 ? 'article'
            : hubClusters[filename] ? 'resource_hub'
            : cityFiles[filename] ? 'local_service_area'
            : filename === 'schedule.html' ? 'service'
            : filename.indexOf('payment-success') === 0 ? 'payment_confirmation'
            : 'other';

        return {
            page_type: type,
            cluster: type === 'article' ? filename.replace(/^blog-/, '').replace(/\.html$/, '') : (hubClusters[filename] || ''),
            city: cityFiles[filename] || ''
        };
    }

    function track(eventName, details) {
        var context = pageContext();
        var firstTouch = attributionData && attributionData.first_touch ? attributionData.first_touch : {};
        var lastTouch = attributionData && attributionData.last_touch ? attributionData.last_touch : {};
        dataLayer.push(Object.assign({
            event: eventName,
            event_id: createId(),
            page_type: context.page_type,
            topic_cluster: context.cluster,
            city: context.city,
            first_touch_source: firstTouch.utm_source || '',
            first_touch_medium: firstTouch.utm_medium || '',
            first_touch_campaign: firstTouch.utm_campaign || '',
            last_touch_source: lastTouch.utm_source || '',
            last_touch_medium: lastTouch.utm_medium || '',
            last_touch_campaign: lastTouch.utm_campaign || ''
        }, details || {}));
    }

    function onScroll() {
        if (!nav) return;
        nav.classList.toggle('scrolled', window.scrollY > 60);
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    function setMenuState(open) {
        if (!mobileMenu || !hamburger) return;
        mobileMenu.classList.toggle('open', open);
        mobileMenu.setAttribute('aria-hidden', String(!open));
        mobileMenu.inert = !open;
        hamburger.setAttribute('aria-expanded', String(open));
        document.body.style.overflow = open ? 'hidden' : '';

        if (open) {
            lastFocusedElement = document.activeElement;
            var firstFocusable = mobileMenu.querySelector('button, a, input, select, textarea, [tabindex]:not([tabindex="-1"])');
            if (firstFocusable) firstFocusable.focus();
        } else if (lastFocusedElement && typeof lastFocusedElement.focus === 'function') {
            lastFocusedElement.focus();
        }
    }

    if (hamburger && mobileMenu && mobileClose) {
        hamburger.addEventListener('click', function () { setMenuState(true); });
        mobileClose.addEventListener('click', function () { setMenuState(false); });
        mobileMenu.querySelectorAll('a').forEach(function (link) {
            link.addEventListener('click', function () { setMenuState(false); });
        });
        mobileMenu.addEventListener('keydown', function (event) {
            if (event.key === 'Escape') {
                setMenuState(false);
                return;
            }
            if (event.key !== 'Tab') return;
            var focusable = Array.from(mobileMenu.querySelectorAll('button, a, input, select, textarea, [tabindex]:not([tabindex="-1"])'))
                .filter(function (element) { return !element.disabled && element.offsetParent !== null; });
            if (!focusable.length) return;
            var first = focusable[0];
            var last = focusable[focusable.length - 1];
            if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first.focus();
            }
        });
    }

    document.querySelectorAll('.reveal').forEach(function (element) {
        element.classList.add('visible');
    });

    document.querySelectorAll('a[href^="#"]').forEach(function (anchor) {
        anchor.addEventListener('click', function (event) {
            var href = anchor.getAttribute('href');
            if (!href || href === '#') return;
            var target;
            try {
                target = document.querySelector(href);
            } catch (error) {
                return;
            }
            if (!target) return;
            event.preventDefault();
            var offset = nav ? nav.offsetHeight + 8 : 8;
            var top = target.getBoundingClientRect().top + window.pageYOffset - offset;
            window.scrollTo({ top: top, behavior: 'smooth' });
        });
    });

    function attribution() {
        var params = new URLSearchParams(window.location.search);
        var current = {
            captured_at: new Date().toISOString(),
            landing_path: window.location.pathname,
            referrer: (function () {
                if (!document.referrer) return '';
                try { return new URL(document.referrer).origin; } catch (error) { return ''; }
            }()),
            utm_source: params.get('utm_source') || '',
            utm_medium: params.get('utm_medium') || '',
            utm_campaign: params.get('utm_campaign') || '',
            utm_content: params.get('utm_content') || '',
            utm_term: params.get('utm_term') || ''
        };
        try {
            if (!window.localStorage.getItem('drive_right_first_touch')) {
                window.localStorage.setItem('drive_right_first_touch', JSON.stringify(current));
            }
            window.sessionStorage.setItem('drive_right_last_touch', JSON.stringify(current));
            return {
                first_touch: JSON.parse(window.localStorage.getItem('drive_right_first_touch') || 'null'),
                last_touch: current
            };
        } catch (error) {
            return { first_touch: current, last_touch: current };
        }
    }

    var attributionData = attribution();

    function objectFromForm(form) {
        var result = {};
        new FormData(form).forEach(function (value, key) {
            if (Object.prototype.hasOwnProperty.call(result, key)) {
                result[key] = Array.isArray(result[key]) ? result[key].concat(value) : [result[key], value];
            } else {
                result[key] = value;
            }
        });
        return result;
    }

    async function requestJson(url, options) {
        var controller = new AbortController();
        var timeout = window.setTimeout(function () { controller.abort(); }, 15000);
        var response;

        try {
            response = await fetch(url, Object.assign({
                credentials: 'same-origin',
                headers: { 'Content-Type': 'application/json' },
                signal: controller.signal
            }, options || {}));
        } finally {
            window.clearTimeout(timeout);
        }

        var payload = {};
        try {
            payload = await response.json();
        } catch (error) {
            payload = {};
        }
        if (!response.ok || payload.ok !== true) {
            var failure = new Error(payload.error || 'The request could not be completed.');
            failure.status = response.status;
            throw failure;
        }
        return payload;
    }

    function setButtonState(button, busy, busyText) {
        if (!button) return;
        if (!button.dataset.originalText) button.dataset.originalText = button.textContent;
        button.disabled = busy;
        button.textContent = busy ? busyText : button.dataset.originalText;
        button.setAttribute('aria-busy', String(busy));
    }

    function showFormStatus(form, message, isError) {
        var status = form.querySelector('[data-form-status]');
        if (!status) {
            status = document.createElement('p');
            status.dataset.formStatus = '';
            status.setAttribute('role', 'status');
            status.setAttribute('aria-live', 'polite');
            form.appendChild(status);
        }
        status.className = isError ? 'form-status form-status--error' : 'form-status form-status--success';
        status.textContent = message;
    }

    function idempotencyKey(scope) {
        var storageKey = 'drive_right_idem_' + scope;
        try {
            var existing = window.sessionStorage.getItem(storageKey);
            if (existing) return existing;
            var value = createId();
            window.sessionStorage.setItem(storageKey, value);
            return value;
        } catch (error) {
            return createId();
        }
    }

    function clearIdempotencyKey(scope) {
        try {
            window.sessionStorage.removeItem('drive_right_idem_' + scope);
        } catch (error) {
            // Storage is an optimization; request correctness still comes from the server.
        }
    }

    async function startCheckout(tier, leadId) {
        var scope = 'checkout_' + tier;
        var payload = await requestJson('/api/checkout-start', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Idempotency-Key': idempotencyKey(scope)
            },
            body: JSON.stringify({
                tier: tier,
                lead_id: leadId || null,
                source_page: window.location.pathname,
                attribution: attributionData
            })
        });
        track('begin_checkout', {
            service_tier: tier,
            checkout_attempt_id: payload.attempt_id || ''
        });
        clearIdempotencyKey(scope);
        window.location.assign(payload.url);
    }

    var heroForm = document.getElementById('hero-form');
    if (heroForm) {
        heroForm.addEventListener('submit', async function (event) {
            event.preventDefault();
            var button = document.getElementById('hero-submit');
            setButtonState(button, true, 'Sending…');

            var fields = objectFromForm(heroForm);
            try {
                if (heroForm.dataset.leadId) {
                    showFormStatus(heroForm, 'Your request is saved. Reopening secure checkout…', false);
                    await startCheckout('full_service', heroForm.dataset.leadId);
                    return;
                }
                var result = await requestJson('/api/leads', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Idempotency-Key': idempotencyKey('hero_lead')
                    },
                    body: JSON.stringify({
                        name: fields.name,
                        email: fields.email,
                        phone: fields.phone || '',
                        vehicle: fields.vehicle,
                        message: fields.vehicle ? 'Vehicle interest: ' + fields.vehicle : '',
                        source_page: window.location.pathname,
                        honeypot: fields.website || '',
                        turnstile_token: fields['cf-turnstile-response'] || '',
                        attribution: attributionData
                    })
                });
                heroForm.dataset.leadId = result.lead_id || '';
                clearIdempotencyKey('hero_lead');
                track('generate_lead', { form_name: 'hero_lead', lead_id: result.lead_id || '' });
                showFormStatus(heroForm, 'Saved. Opening secure checkout…', false);
                await startCheckout('full_service', result.lead_id);
            } catch (error) {
                showFormStatus(heroForm, error.message || 'We could not save your request. Please try again.', true);
                setButtonState(button, false);
            }
        });
    }

    document.querySelectorAll('#contact-form').forEach(function (form) {
        form.addEventListener('submit', async function (event) {
            event.preventDefault();
            var button = form.querySelector('[type="submit"]');
            setButtonState(button, true, 'Sending…');
            var fields = objectFromForm(form);

            try {
                var result = await requestJson('/api/leads', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Idempotency-Key': idempotencyKey('contact_' + window.location.pathname)
                    },
                    body: JSON.stringify({
                        name: fields.name,
                        email: fields.email,
                        phone: fields.phone || '',
                        message: fields.message,
                        source_page: window.location.pathname,
                        honeypot: fields.website || '',
                        turnstile_token: fields['cf-turnstile-response'] || '',
                        attribution: attributionData
                    })
                });
                clearIdempotencyKey('contact_' + window.location.pathname);
                track('generate_lead', { form_name: 'contact', lead_id: result.lead_id || '' });
                form.reset();
                showFormStatus(form, 'Thanks—your message was saved. We will follow up shortly.', false);
                setButtonState(button, false);
            } catch (error) {
                showFormStatus(form, error.message || 'We could not save your message. Please try again.', true);
                setButtonState(button, false);
            }
        });
    });

    document.querySelectorAll('[data-service-tier]').forEach(function (link) {
        link.addEventListener('click', async function (event) {
            event.preventDefault();
            if (link.getAttribute('aria-disabled') === 'true') return;
            link.setAttribute('aria-disabled', 'true');
            var originalText = link.textContent;
            link.textContent = 'Opening secure checkout…';
            try {
                await startCheckout(link.dataset.serviceTier);
            } catch (error) {
                link.textContent = originalText;
                link.removeAttribute('aria-disabled');
                window.alert(error.message || 'Checkout is temporarily unavailable. Please try again.');
            }
        });
    });

    document.querySelectorAll('[data-cta-location]').forEach(function (element) {
        element.addEventListener('click', function () {
            track('cta_click', {
                cta_location: element.getAttribute('data-cta-location') || 'unknown',
                cta_label: (element.textContent || '').trim().slice(0, 80)
            });
        });
    });

    document.querySelectorAll('a[href^="tel:"]').forEach(function (element) {
        element.addEventListener('click', function () {
            track('phone_click', { link_text: (element.textContent || '').trim().slice(0, 80) });
        });
    });

    function purchaseSessionId() {
        var params = new URLSearchParams(window.location.search);
        return params.get('session_id') || params.get('checkout_session_id') || '';
    }

    function updatePaymentGate(state, message) {
        var gate = document.getElementById('payment-verification');
        var content = document.getElementById('verified-purchase-content');
        if (gate) {
            gate.dataset.state = state;
            var heading = gate.querySelector('[data-verification-heading]');
            var body = gate.querySelector('[data-verification-message]');
            if (heading) {
                heading.textContent = state === 'verified'
                    ? 'Payment verified'
                    : state === 'error' ? 'Payment could not be verified' : 'Verifying payment';
            }
            if (body) body.textContent = message;
            gate.hidden = state === 'verified';
        }
        if (content) content.hidden = state !== 'verified';
    }

    async function initializePaidOnboarding() {
        var tier = document.body.dataset.purchaseTier;
        if (!tier) return;

        var sessionId = purchaseSessionId();
        if (!sessionId) {
            updatePaymentGate('error', 'This page needs the secure checkout session link from your Stripe receipt. No purchase was recorded from this page visit.');
            return;
        }

        var retryDelays = [0, 1000, 2000, 4000, 8000];
        for (var attempt = 0; attempt < retryDelays.length; attempt += 1) {
            if (retryDelays[attempt]) {
                updatePaymentGate('pending', 'Stripe confirmed payment; waiting for the signed webhook record…');
                await new Promise(function (resolve) {
                    window.setTimeout(resolve, retryDelays[attempt]);
                });
            }
            try {
                var status = await requestJson('/api/purchase-status?session_id=' + encodeURIComponent(sessionId) + '&tier=' + encodeURIComponent(tier), {
                    method: 'GET'
                });
                if (status.verified) {
                    document.body.dataset.verifiedSessionId = sessionId;
                    updatePaymentGate('verified', 'Payment verified.');
                    return;
                }
                if (status.status === 'processing' && attempt < retryDelays.length - 1) {
                    continue;
                }
                updatePaymentGate('error', 'Stripe has not confirmed a paid checkout for this service. No purchase was recorded from this page visit.');
                return;
            } catch (error) {
                if (attempt < retryDelays.length - 1 && (!error.status || error.status >= 500)) {
                    continue;
                }
                updatePaymentGate('error', error.message || 'We could not verify this checkout. Please use the link in your receipt or contact support.');
                return;
            }
        }
    }

    var onboardingForm = document.getElementById('onboarding-form');
    if (onboardingForm) {
        onboardingForm.addEventListener('submit', async function (event) {
            event.preventDefault();
            var sessionId = document.body.dataset.verifiedSessionId;
            var tier = document.body.dataset.purchaseTier;
            if (!sessionId || !tier) {
                showFormStatus(onboardingForm, 'Verify the paid checkout before submitting this intake.', true);
                return;
            }

            var button = document.getElementById('onboarding-submit');
            setButtonState(button, true, 'Submitting…');
            try {
                var result = await requestJson('/api/onboarding', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Idempotency-Key': idempotencyKey('onboarding_' + sessionId)
                    },
                    body: JSON.stringify({
                        session_id: sessionId,
                        tier: tier,
                        fields: objectFromForm(onboardingForm)
                    })
                });
                var success = document.getElementById('onboarding-success');
                onboardingForm.hidden = true;
                if (success) {
                    success.style.display = 'block';
                    success.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            } catch (error) {
                showFormStatus(onboardingForm, error.message || 'We could not save your intake. Please try again.', true);
                setButtonState(button, false);
            }
        });
    }

    var budgetSelect = document.getElementById('ob-budget');
    var budgetOther = document.getElementById('ob-budget-other');
    if (budgetSelect && budgetOther) {
        budgetSelect.addEventListener('change', function () {
            var show = budgetSelect.value === 'other';
            budgetOther.style.display = show ? 'block' : 'none';
            budgetOther.required = show;
        });
    }

    var otherCheck = document.getElementById('features-other-check');
    var otherText = document.getElementById('features-other-text');
    if (otherCheck && otherText) {
        otherCheck.addEventListener('change', function () {
            otherText.style.display = otherCheck.checked ? 'block' : 'none';
            otherText.required = otherCheck.checked;
        });
    }

    initializePaidOnboarding();
})();
