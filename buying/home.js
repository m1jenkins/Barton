// Mobile sticky buttons: shown only while no other way to start is on screen
// (hero buttons, plan cards, closing band) and hidden over the footer.
const bar = document.querySelector('[data-sticky-cta]');
const mobile = matchMedia('(max-width: 760px)');
const targets = ['.hero-checkout', '#pricing .plan-grid', '.home-closing', '.site-footer']
  .map(selector => document.querySelector(selector))
  .filter(Boolean);

if (bar && targets.length && 'IntersectionObserver' in window) {
  const onScreen = new Set();
  const update = () => {
    const show = mobile.matches && onScreen.size === 0;
    bar.classList.toggle('is-visible', show);
    bar.inert = !show;
  };
  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (entry.isIntersecting) onScreen.add(entry.target);
      else onScreen.delete(entry.target);
    }
    update();
  });
  targets.forEach(target => observer.observe(target));
  mobile.addEventListener('change', update);
}
