// Homepage behavior for the Wise-style layout: phone menu, Google review carousel,
// resource tabs and the mobile sticky buttons.

// Phone menu
const menuButton = document.querySelector('[data-menu-toggle]');
const menu = document.getElementById('wz-menu');
if (menuButton && menu) {
  const setOpen = open => { menu.hidden = !open; menuButton.setAttribute('aria-expanded', String(open)); };
  menuButton.addEventListener('click', () => setOpen(menu.hidden));
  menu.addEventListener('click', event => { if (event.target.closest('a, button')) setOpen(false); });
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && !menu.hidden) { setOpen(false); menuButton.focus(); } });
}

// Scrolling rows (the Google reviews, and the pricing page's plan cards on phones): the arrows
// scroll one card at a time, grey out at either end, and hide when every card fits.
function scrollRow(list, nav, cardSelector, key) {
  if (!list || !nav) return;
  const arrows = [...nav.querySelectorAll(`[data-${key}-step]`)];
  const step = arrow => Number(arrow.getAttribute(`data-${key}-step`));
  const update = () => {
    const max = list.scrollWidth - list.clientWidth;
    nav.hidden = max <= 1;
    arrows.forEach(arrow => {
      arrow.disabled = step(arrow) < 0 ? list.scrollLeft <= 1 : list.scrollLeft >= max - 1;
    });
  };
  arrows.forEach(arrow => arrow.addEventListener('click', () => {
    const card = list.querySelector(cardSelector);
    const gap = parseFloat(getComputedStyle(list).columnGap) || 0;
    list.scrollBy({ left: step(arrow) * ((card?.offsetWidth ?? 300) + gap) });
  }));
  list.addEventListener('scroll', update, { passive: true });
  window.addEventListener('resize', update);
  update();
}
scrollRow(document.querySelector('.wz-greviews-list'), document.querySelector('[data-greviews-nav]'), 'li', 'greviews');
scrollRow(document.querySelector('.wz-plan-row'), document.querySelector('[data-plans-nav]'), '.wz-plan', 'plans');

// Resource tabs
const tabs = [...document.querySelectorAll('[data-tab]')];
tabs.forEach((tab, index) => {
  const select = () => tabs.forEach(other => {
    const on = other === tab;
    other.setAttribute('aria-selected', String(on));
    other.tabIndex = on ? 0 : -1;
    document.getElementById(other.getAttribute('aria-controls')).hidden = !on;
  });
  tab.addEventListener('click', select);
  tab.addEventListener('keydown', event => {
    const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
    if (!step) return;
    const next = tabs[(index + step + tabs.length) % tabs.length];
    next.focus();
    next.click();
  });
});

// Mobile sticky buttons: visible once the hero is scrolled past, hidden over the
// plan cards, the closing band and the footer, where a button is already on screen.
const bar = document.querySelector('[data-sticky-cta]');
if (bar && 'IntersectionObserver' in window) {
  const watched = ['.wz-hero', '#plans .wz-plan-grid', '#pricing .wz-plan-grid', '.wz-band', '.wz-footer'].map(selector => document.querySelector(selector)).filter(Boolean);
  const visible = new Set();
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => entry.isIntersecting ? visible.add(entry.target) : visible.delete(entry.target));
    const show = visible.size === 0;
    bar.classList.toggle('is-visible', show);
    bar.inert = !show;
  });
  watched.forEach(element => observer.observe(element));
}
