/* =============================================
   PROVENANCE — Scripts
   ============================================= */

(function () {
    'use strict';

    // ---- Sticky nav with background swap ----
    const nav = document.getElementById('nav');
    const hero = document.getElementById('hero');

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

    hamburger.addEventListener('click', openMenu);
    mobileClose.addEventListener('click', closeMenu);
    mobileLinks.forEach(function (link) {
        link.addEventListener('click', closeMenu);
    });

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

    // ---- Contact form (Google Sheets Integration) ----
    var form = document.getElementById('contact-form');
    if (form) {
        form.addEventListener('submit', function (e) {
            e.preventDefault();
            var btn = document.getElementById('contact-submit');
            var originalText = btn.textContent;
            
            // Web App URL for Google Sheets integration
            var scriptURL = 'https://script.google.com/macros/s/AKfycbzd4i7cn8vj9O8j2dhvQVdEk6ltNPweToX-oppo_N6tlzykdl7MsT77ii_cYYTDbCK6wA/exec';

            btn.textContent = 'Sending...';
            btn.disabled = true;
            btn.style.opacity = '0.7';
            btn.style.cursor = 'not-allowed';

            var formData = new FormData(form);

            fetch(scriptURL, { 
                method: 'POST', 
                body: formData, 
                mode: 'no-cors' // Allows submitting without dealing with strict CORS policy
            })
            .then(function() {
                btn.textContent = 'Inquiry Sent';
                btn.style.opacity = '0.5';
                btn.style.cursor = 'default';
                form.reset();
                
                // Redirect to success page for conversion tracking
                window.location.href = 'success.html';
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

})();
