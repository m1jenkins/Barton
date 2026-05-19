/* =============================================
   DRIVE RIGHT — Scripts
   ============================================= */

(function () {
    'use strict';

    // ---- Sticky nav with background swap ----
    const nav = document.getElementById('nav');

    function onScroll() {
        if (window.scrollY > 60) {
            nav.classList.add('scrolled');
        } else {
            nav.classList.remove('scrolled');
        }
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    // ---- Mobile menu ----
    const hamburger = document.getElementById('hamburger');
    const mobileMenu = document.getElementById('mobile-menu');
    const mobileClose = document.getElementById('mobile-close');
    const mobileLinks = mobileMenu.querySelectorAll('a');

    function openMenu() {
        mobileMenu.classList.add('open');
        document.body.style.overflow = 'hidden';
    }

    function closeMenu() {
        mobileMenu.classList.remove('open');
        document.body.style.overflow = '';
    }

    if (hamburger && mobileMenu && mobileClose) {
        hamburger.addEventListener('click', openMenu);
        mobileClose.addEventListener('click', closeMenu);
        mobileLinks.forEach(function (link) {
            link.addEventListener('click', closeMenu);
        });
    }

    // ---- Scroll-reveal (IntersectionObserver) ----
    var reveals = document.querySelectorAll('.reveal');

    if ('IntersectionObserver' in window) {
        var observer = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (entry.isIntersecting) {
                    entry.target.classList.add('visible');
                    observer.unobserve(entry.target);
                }
            });
        }, {
            threshold: 0.15,
            rootMargin: '0px 0px -40px 0px'
        });

        reveals.forEach(function (el) {
            observer.observe(el);
        });
    } else {
        // Fallback: just show everything
        reveals.forEach(function (el) {
            el.classList.add('visible');
        });
    }

    // ---- Transform rows: fix strike animation in horizontal scroll ----
    var transformContainer = document.querySelector('.transform__rows');
    if (transformContainer && 'IntersectionObserver' in window) {
        var rows = transformContainer.querySelectorAll('.transform__row');
        if (transformContainer.scrollWidth > transformContainer.clientWidth) {
            rows.forEach(function (row) { observer.unobserve(row); });
            var scrollObserver = new IntersectionObserver(function (entries) {
                entries.forEach(function (entry) {
                    if (entry.isIntersecting) {
                        entry.target.classList.add('visible');
                        scrollObserver.unobserve(entry.target);
                    }
                });
            }, {
                root: transformContainer,
                threshold: 0.5
            });
            rows.forEach(function (row) { scrollObserver.observe(row); });
        }

        // Carousel dots + swipe hint
        var dots = document.querySelectorAll('.transform__dot');
        var hint = document.getElementById('transform-hint');
        if (dots.length && transformContainer.scrollWidth > transformContainer.clientWidth) {
            var hintDismissed = false;
            transformContainer.addEventListener('scroll', function () {
                var scrollLeft = transformContainer.scrollLeft;
                var cardWidth = transformContainer.querySelector('.transform__row').offsetWidth;
                var gap = 16;
                var idx = Math.round(scrollLeft / (cardWidth + gap));
                idx = Math.max(0, Math.min(idx, dots.length - 1));
                dots.forEach(function (d) { d.classList.remove('active'); });
                dots[idx].classList.add('active');
                if (!hintDismissed && scrollLeft > 20) {
                    hintDismissed = true;
                    if (hint) hint.classList.add('hidden');
                }
            }, { passive: true });

            // Tap dot to scroll to card
            dots.forEach(function (dot) {
                dot.addEventListener('click', function () {
                    var i = parseInt(this.dataset.index, 10);
                    var cardWidth = transformContainer.querySelector('.transform__row').offsetWidth;
                    var gap = 16;
                    transformContainer.scrollTo({ left: i * (cardWidth + gap), behavior: 'smooth' });
                });
            });
        }
    }

    // ---- Smooth scroll for anchor links (fallback for older browsers) ----
    document.querySelectorAll('a[href^="#"]').forEach(function (anchor) {
        anchor.addEventListener('click', function (e) {
            var target = document.querySelector(this.getAttribute('href'));
            if (target) {
                e.preventDefault();
                var offset = nav.offsetHeight + 8;
                var top = target.getBoundingClientRect().top + window.pageYOffset - offset;
                window.scrollTo({ top: top, behavior: 'smooth' });
            }
        });
    });

    // Google Sheets Web App URL
    var scriptURL = 'https://script.google.com/macros/s/AKfycbzd4i7cn8vj9O8j2dhvQVdEk6ltNPweToX-oppo_N6tlzykdl7MsT77ii_cYYTDbCK6wA/exec';

    // ---- Hero form submission ----
    var heroForm = document.getElementById('hero-form');
    if (heroForm) {
        heroForm.addEventListener('submit', function (e) {
            e.preventDefault();
            var btn = document.getElementById('hero-submit');
            var originalText = btn.textContent;

            btn.textContent = 'Sending...';
            btn.disabled = true;
            btn.style.opacity = '0.7';
            btn.style.cursor = 'not-allowed';

            // Map hero form fields to match the Google Sheet columns
            var formData = new FormData();
            formData.append('name', document.getElementById('hero-name').value);
            formData.append('email', document.getElementById('hero-email').value);
            formData.append('phone', '');
            formData.append('message', 'Vehicle interest: ' + (document.getElementById('hero-vehicle').value || 'Not specified'));

            fetch(scriptURL, {
                method: 'POST',
                body: formData,
                mode: 'no-cors'
            })
            .then(function() {
                btn.textContent = 'Sent!';
                btn.style.opacity = '0.5';
                btn.style.cursor = 'default';
                heroForm.reset();

                // Redirect to Stripe for payment
                window.location.href = 'https://book.stripe.com/cNi14ge357rZena29e04800';
            })
            .catch(function(error) {
                console.error('Error!', error.message);
                btn.textContent = 'Failed. Try Again.';
                btn.disabled = false;
                btn.style.opacity = '';
                btn.style.cursor = 'pointer';
            });
        });
    }

    // ---- Contact form (Google Sheets Integration) ----
    var form = document.getElementById('contact-form');
    if (form) {
        form.addEventListener('submit', function (e) {
            e.preventDefault();
            var btn = document.getElementById('contact-submit');
            var originalText = btn.textContent;

            btn.textContent = 'Sending...';
            btn.disabled = true;
            btn.style.opacity = '0.7';
            btn.style.cursor = 'not-allowed';

            var formData = new FormData(form);

            fetch(scriptURL, { 
                method: 'POST', 
                body: formData, 
                mode: 'no-cors'
            })
            .then(function() {
                btn.textContent = 'Message Sent';
                btn.style.opacity = '0.5';
                btn.style.cursor = 'default';
                form.reset();
                
                // Note: Redirect removed as this is now a general contact form for questions.
            })
            .catch(function(error) {
                console.error('Error!', error.message);
                btn.textContent = 'Failed. Try Again.';
                btn.disabled = false;
                btn.style.opacity = '';
                btn.style.cursor = 'pointer';
            });
        });
    }

    // ---- CTA click tracking (for Clarity / GA comparison) ----
    document.querySelectorAll('[data-cta-location]').forEach(function (el) {
        el.addEventListener('click', function () {
            var location = el.getAttribute('data-cta-location') || 'unknown';
            try {
                if (typeof window.gtag === 'function') {
                    window.gtag('event', 'cta_click', {
                        cta_location: location,
                        cta_label: (el.textContent || '').trim().slice(0, 40)
                    });
                }
                if (typeof window.clarity === 'function') {
                    window.clarity('set', 'cta_location', location);
                }
            } catch (err) { /* tracking should never break navigation */ }
        });
    });
    // ---- Interactive "How it Works" Pipeline ----
    const pipelineProgress = document.getElementById('pipeline-progress');
    const stepButtons = document.querySelectorAll('.pipeline__step-btn');
    const contentCards = document.querySelectorAll('.pipeline__card');

    function setStep(stepNum) {
        // Update buttons active/completed states
        stepButtons.forEach(btn => {
            const btnStep = parseInt(btn.getAttribute('data-step'), 10);
            if (btnStep === stepNum) {
                btn.classList.add('active');
                btn.classList.remove('completed');
            } else if (btnStep < stepNum) {
                btn.classList.remove('active');
                btn.classList.add('completed');
            } else {
                btn.classList.remove('active');
                btn.classList.remove('completed');
            }
        });

        // Update cards active states
        contentCards.forEach(card => {
            const cardStep = parseInt(card.getAttribute('data-step-content'), 10);
            if (cardStep === stepNum) {
                card.classList.add('active');
            } else {
                card.classList.remove('active');
            }
        });

        // Update progress line width via CSS Custom Property
        if (pipelineProgress) {
            const percent = ((stepNum - 1) / (stepButtons.length - 1)) * 100;
            pipelineProgress.style.setProperty('--progress', percent + '%');
        }
    }

    if (stepButtons.length) {
        // Initialize step 1
        setStep(1);

        stepButtons.forEach(btn => {
            btn.addEventListener('click', function () {
                const stepNum = parseInt(this.getAttribute('data-step'), 10);
                setStep(stepNum);
            });
        });
    }

    // ---- Interactive Savings Calculator ----
    const priceSlider = document.getElementById('calc-price-slider');
    const toggleButtons = document.querySelectorAll('.calculator__toggle-btn');

    function calculateSavings() {
        if (!priceSlider) return;

        const price = parseInt(priceSlider.value, 10);
        
        // Update price display
        const priceDisplay = document.getElementById('calc-price-display');
        if (priceDisplay) {
            priceDisplay.textContent = '$' + price.toLocaleString();
        }

        // Get active condition
        const activeConditionBtn = document.querySelector('.calculator__toggle-btn[data-condition].active');
        const condition = activeConditionBtn ? activeConditionBtn.getAttribute('data-condition') : 'new';

        // Get active trade
        const activeTradeBtn = document.querySelector('.calculator__toggle-btn[data-trade].active');
        const trade = activeTradeBtn ? activeTradeBtn.getAttribute('data-trade') : 'no';

        // Get active pay
        const activePayBtn = document.querySelector('.calculator__toggle-btn[data-pay].active');
        const pay = activePayBtn ? activePayBtn.getAttribute('data-pay') : 'finance';

        // Calculations
        // 1. Dealer Discount: 6% for new, 8% for used
        const discountRate = condition === 'new' ? 0.06 : 0.08;
        const dealerDiscount = Math.round(price * discountRate);

        // 2. Junk Fees: Flat $1,200
        const junkFees = 1200;

        // 3. Financing Interest Saved: price * (1750 / 45000) if financing, 0 if cash
        const interestSaved = pay === 'finance' ? Math.round(price * (1750 / 45000)) : 0;

        // 4. Trade-in Valuation: $2,500 if yes, 0 if no
        const tradeBoost = trade === 'yes' ? 2500 : 0;

        // 5. Total Estimated Savings
        const totalSavings = dealerDiscount + junkFees + interestSaved + tradeBoost;

        // 6. Net ROI
        const netRoi = totalSavings - 495;

        // 7. Multiplier
        const multiplier = (netRoi / 495).toFixed(1);

        // Update DOM elements
        const dealerDiscountEl = document.getElementById('calc-dealer-discount');
        if (dealerDiscountEl) dealerDiscountEl.textContent = '$' + dealerDiscount.toLocaleString();

        const addonsAvoidedEl = document.getElementById('calc-addons-avoided');
        if (addonsAvoidedEl) addonsAvoidedEl.textContent = '$' + junkFees.toLocaleString();

        const interestSavedEl = document.getElementById('calc-interest-saved');
        if (interestSavedEl) interestSavedEl.textContent = '$' + interestSaved.toLocaleString();

        const tradeBoostEl = document.getElementById('calc-trade-boost');
        if (tradeBoostEl) tradeBoostEl.textContent = '$' + tradeBoost.toLocaleString();

        const totalSavingsEl = document.getElementById('calc-total-savings');
        if (totalSavingsEl) totalSavingsEl.textContent = '$' + totalSavings.toLocaleString();

        const netRoiEl = document.getElementById('calc-net-roi');
        if (netRoiEl) netRoiEl.textContent = '$' + netRoi.toLocaleString();

        const roiMultiplierEl = document.getElementById('calc-roi-multiplier');
        if (roiMultiplierEl) {
            roiMultiplierEl.textContent = multiplier + 'x Return';
        }
    }

    if (priceSlider) {
        // Listen to slider changes
        priceSlider.addEventListener('input', calculateSavings);

        // Listen to active toggle buttons
        toggleButtons.forEach(button => {
            button.addEventListener('click', function () {
                const parent = this.parentElement;
                if (parent) {
                    parent.querySelectorAll('.calculator__toggle-btn').forEach(btn => {
                        btn.classList.remove('active');
                    });
                }
                this.classList.add('active');
                calculateSavings();
            });
        });

        // Run initial calculation to match active slider state on page load
        calculateSavings();
    }

})();
