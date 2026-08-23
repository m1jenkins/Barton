const skipLink = document.querySelector('.skip-link');

function activateSkipLink(event) {
    const targetId = skipLink.getAttribute('href')?.slice(1);
    const target = targetId ? document.getElementById(targetId) : null;
    if (!target) return;

    event.preventDefault();
    event.stopImmediatePropagation();
    target.focus({ preventScroll: true });
    target.scrollIntoView({
        block: 'start',
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
    });
    history.replaceState(null, '', `${location.pathname}${location.search}#${targetId}`);
}

skipLink?.addEventListener('click', activateSkipLink, { capture: true });
skipLink?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') activateSkipLink(event);
});

const menuButton = document.getElementById('hamburger');
const menuCloseButton = document.getElementById('mobile-close');

if (menuButton && menuCloseButton) {
    const focusOpenMenu = new MutationObserver(() => {
        if (menuButton.getAttribute('aria-expanded') === 'true') menuCloseButton.focus();
    });
    focusOpenMenu.observe(menuButton, { attributes: true, attributeFilter: ['aria-expanded'] });
}
