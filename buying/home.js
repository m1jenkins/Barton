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

// Legwork videos: each plays once as its card comes into view (left to right when the cards arrive
// together) and replays after it has left the screen. With reduced motion, or if playback is refused,
// the end-frame poster stays.
const videos = [...document.querySelectorAll('[data-legwork-video]')];
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');

if (videos.length && 'IntersectionObserver' in window && !reduceMotion.matches) {
  const posters = new Map(videos.map(video => [video, video.getAttribute('poster')]));
  const ready = new Set();
  const loader = new IntersectionObserver(entries => {
    for (const entry of entries.filter(entry => entry.isIntersecting)) {
      entry.target.preload = 'auto';
      loader.unobserve(entry.target);
    }
  }, { rootMargin: '400px 0px' });
  const player = new IntersectionObserver(entries => {
    const arriving = entries.filter(entry => entry.intersectionRatio >= .55 && ready.has(entry.target))
      .map(entry => entry.target).sort((a, b) => videos.indexOf(a) - videos.indexOf(b));
    arriving.forEach((video, index) => {
      ready.delete(video);
      setTimeout(() => {
        if (reduceMotion.matches) return;
        video.currentTime = 0;
        video.removeAttribute('poster');
        video.play().catch(() => video.setAttribute('poster', posters.get(video)));
      }, index * 450);
    });
    for (const entry of entries.filter(entry => !entry.isIntersecting)) {
      ready.add(entry.target);
      entry.target.pause();
    }
  }, { threshold: [0, .55] });
  videos.forEach(video => {
    ready.add(video);
    loader.observe(video);
    player.observe(video);
  });
  reduceMotion.addEventListener('change', () => videos.forEach(video => video.pause()));
}
