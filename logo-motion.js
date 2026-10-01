// Header mascot: the Mariner Blue Miata beside the wordmark (styles in logo-motion.css, art in assets/mascot/).
// On the first page of a visit it drives in and reveals the wordmark, then parks facing you. Its pop-up
// headlights are its only expression: a hello after parking, a wink or flash on hover, a few random idle
// moments, lights on while the homepage search box has focus, and a celebration after a verified payment.
// Nothing loops on a timer, and reduced motion gets a still, parked car.
const html = document.documentElement;
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const HEADLIGHTS = { down: 0, half: 1, up: 2, on: 3, winkLeft: 4, winkRight: 5 };
const MOVES = {
  hello: () => [['half', 70], ['up', 620], ['half', 70], ['down', 0]],
  wink: () => [[Math.random() < .5 ? 'winkLeft' : 'winkRight', 440], ['down', 0]],
  flip: () => [['half', 60], ['up', 260], ['half', 60], ['down', 0]],
  flash: () => [['half', 70], ['up', 110], ['on', 170], ['up', 130], ['on', 170], ['up', 180], ['half', 70], ['down', 0]],
  hunt: () => [['half', 70], ['up', 110], ['on', 0]],
  fold: () => [['up', 90], ['half', 70], ['down', 0]],
  celebrate: () => [['half', 70], ['up', 120], ['on', 180], ['up', 140], ['on', 180], ['up', 0]],
};
const KEY = '<svg viewBox="0 0 17 9"><circle cx="4.3" cy="4.5" r="3.1" fill="none" stroke="#6B4A00" stroke-width="2.6"/><circle cx="4.3" cy="4.5" r="3.1" fill="none" stroke="#F0B429" stroke-width="1.4"/><path d="M7.2 3.6h8.6v1.8h-1.3v2h-1.5v-2h-1.1v1.5h-1.5V5.4H7.2z" fill="#F0B429" stroke="#6B4A00" stroke-width=".6"/></svg>';

// Load events, not decode(): decode() never settles in a hidden tab.
const loaded = names => Promise.all(names.map(name => new Promise((resolve, reject) => {
  const img = new Image();
  img.onload = resolve; img.onerror = reject;
  img.src = `/assets/mascot/${name}.webp`;
})));
const within = (promise, ms) => Promise.race([promise.then(() => true, () => false), sleep(ms).then(() => false)]);
const animate = (el, frames, options) => el.animate(frames, options).finished.catch(() => {});

function bezier(x1, y1, x2, y2) {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx, cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const sx = t => ((ax * t + bx) * t + cx) * t, sy = t => ((ay * t + by) * t + cy) * t;
  return x => {
    let lo = 0, hi = 1, t = x;
    for (let i = 0; i < 30 && Math.abs(sx(t) - x) > 1e-5; i++) { if (sx(t) < x) lo = t; else hi = t; t = (lo + hi) / 2; }
    return sy(t);
  };
}

class Car {
  constructor(parent, { withKey = false } = {}) {
    parent.insertAdjacentHTML('beforeend', `<span class="mx" data-pose="q" aria-hidden="true"><span class="mx-side"><span class="mx-body"></span><span class="mx-wheel r"></span><span class="mx-wheel f"></span></span><span class="mx-q"></span>${withKey ? `<span class="mx-key">${KEY}</span>` : ''}</span>`);
    this.el = parent.lastElementChild;
    [this.side, this.q] = this.el.children;
    this.body = this.side.firstElementChild;
    this.wheels = [...this.side.querySelectorAll('.mx-wheel')];
    this.key = this.el.querySelector('.mx-key');
    this.turn = 0;
  }
  headlights(state) { this.q.style.setProperty('--mx-hl', HEADLIGHTS[state]); }
  // One expression at a time: a newer one takes over at the older one's next step.
  async express(move) {
    const turn = ++this.turn;
    for (const [state, ms] of MOVES[move]()) {
      if (turn !== this.turn) return;
      this.headlights(state);
      if (ms && !reduced.matches) await sleep(ms);
    }
  }
  brake(delay) {
    return animate(this.body, [{ transform: 'none' }, { transform: 'translateY(2%) rotate(2.2deg)', offset: .32 }, { transform: 'rotate(-.8deg)', offset: .68 }, { transform: 'none' }], { duration: 520, delay, easing: 'ease-out' });
  }
  // A quick squash swap from the side view to the three-quarter view, as if the car turns to face you.
  async faceForward() {
    await animate(this.side, [{ transform: 'none' }, { transform: 'scaleX(.86)' }], { duration: 90, easing: 'ease-in' });
    this.el.dataset.pose = 'q';
    await animate(this.q, [{ transform: 'scaleX(.86)' }, { transform: 'none' }], { duration: 140, easing: 'cubic-bezier(.2,1.4,.4,1)' });
  }
  // Drive in from past the left edge of the window and stop at the parking spot, wheels turning with the distance.
  drive(duration, { delay = 0, reveal } = {}) {
    this.el.dataset.pose = 'side';
    const rect = this.side.getBoundingClientRect(), start = -rect.right - 8;
    const turns = Math.max(1, Math.round(-start / (Math.PI * this.wheels[0].getBoundingClientRect().width)));
    const ease = bezier(.28, .5, .2, 1), carFrames = [], wheelFrames = [], textFrames = [];
    const textRect = reveal?.getBoundingClientRect();
    for (let i = 0; i <= 40; i++) {
      const offset = i / 40, eased = ease(offset), x = start * (1 - eased);
      carFrames.push({ offset, transform: `translateX(${x.toFixed(2)}px)` });
      wheelFrames.push({ offset, transform: `rotate(${(eased * turns * 360).toFixed(1)}deg)` });
      // The text shows up to the car's rear bumper, so the wordmark appears in its wake.
      if (reveal) {
        const shown = Math.max(0, Math.min(textRect.width, rect.left - textRect.left + x));
        textFrames.push({ offset, clipPath: `inset(-40% ${(textRect.width - shown).toFixed(2)}px -45% -12%)` });
      }
    }
    const timing = { duration, delay, fill: 'backwards' };
    this.wheels.forEach(wheel => animate(wheel, wheelFrames, timing));
    this.brake(delay + duration * .8);
    return Promise.all([animate(this.el, carFrames, timing), reveal && animate(reveal, textFrames, timing)]);
  }
}

async function setUpHeader(wordmark) {
  clearTimeout(window.driveRightLogoFallback);
  const text = document.createElement('span'), spot = document.createElement('span'), line = document.createElement('span');
  text.className = 'mx-text'; spot.className = 'mx-spot'; line.className = 'mx-line';
  text.textContent = wordmark.textContent.trim();
  line.append(text, spot);
  wordmark.replaceChildren(line);
  const car = new Car(spot);
  let busy = false, hovering = false, holding = false;

  // A page opened in a background tab skips the intro without using it up, so the first page actually seen gets it.
  if (html.classList.contains('logo-intro') && !reduced.matches && !document.hidden && await within(loaded(['side', 'wheel', 'q']), 1200)) {
    try { sessionStorage.setItem('dr-logo-intro', '1'); } catch {}
    busy = true;
    const driving = car.drive(1250, { reveal: text });
    html.classList.remove('logo-intro');
    await driving;
    await sleep(120);
    await car.faceForward();
    await sleep(160);
    busy = false;
    await car.express('hello');
    if (holding) car.express('hunt'); // the search box got focus during the intro
  }
  html.classList.remove('logo-intro');

  // A few random idle moments per page, never on a fixed rhythm.
  let idleLeft = reduced.matches ? 0 : 4;
  const idle = () => {
    if (idleLeft <= 0) return;
    setTimeout(() => {
      if (!document.hidden && !hovering && !holding) { idleLeft--; car.express(['wink', 'flip', 'wink', 'flash'][Math.floor(Math.random() * 4)]); }
      idle();
    }, 7000 + Math.random() * 8000);
  };
  idle();

  // Hover or keyboard focus: a wink, then a flash next time.
  let hovers = 0, lastHover = 0;
  const greet = () => {
    if (busy || holding || reduced.matches || performance.now() - lastHover < 700) return;
    lastHover = performance.now();
    car.express(++hovers % 2 ? 'wink' : 'flash');
  };
  wordmark.addEventListener('pointerenter', event => { if (event.pointerType !== 'touch') { hovering = true; greet(); } });
  wordmark.addEventListener('pointerleave', () => { hovering = false; });
  wordmark.addEventListener('focus', greet);

  // Homepage: headlights up and on while the visitor types what they're looking for.
  const search = document.getElementById('answer');
  if (search) {
    search.addEventListener('focus', () => { holding = true; if (!busy) car.express('hunt'); });
    search.addEventListener('blur', () => { holding = false; if (!busy) car.express('fold'); });
    if (document.activeElement === search) { holding = true; car.express('hunt'); }
    loaded(['front']).catch(() => {}); // the chat avatar; warm it before the first reply
  }
}

// Payment success: once verification succeeds, the car drives in, faces you, flashes, and a key pops up.
function setUpPayment(gate, paid) {
  const stage = document.createElement('div');
  stage.className = 'mx-celebrate';
  (paid.querySelector('.paid-intro') ?? paid).prepend(stage);
  const car = new Car(stage, { withKey: true });
  car.el.style.visibility = 'hidden';
  const celebrate = async () => {
    const ready = await within(loaded(['side-lg', 'wheel-lg', 'q-lg']), 1500);
    car.el.style.visibility = '';
    if (reduced.matches || !ready) { car.headlights('up'); car.el.classList.add('has-key'); return; }
    await car.drive(1000);
    await sleep(140);
    await car.faceForward();
    await car.express('celebrate');
    car.el.classList.add('has-key');
    animate(car.key, [{ transform: 'translateY(40%) scale(.3)', opacity: 0 }, { transform: 'translateY(-12%) scale(1.12) rotate(-14deg)', opacity: 1, offset: .55 }, { transform: 'rotate(-8deg)', opacity: 1 }], { duration: 560, easing: 'cubic-bezier(.2,1.2,.4,1)', fill: 'forwards' });
  };
  if (gate.dataset.state === 'verified') celebrate();
  else new MutationObserver((_, observer) => { if (gate.dataset.state === 'verified') { observer.disconnect(); celebrate(); } }).observe(gate, { attributes: true, attributeFilter: ['data-state'] });
}

const gate = document.getElementById('payment-verification'), paid = document.getElementById('verified-purchase-content');
if (gate && paid) setUpPayment(gate, paid);
const wordmark = document.querySelector('.site-header .wordmark, .nav__wordmark');
if (wordmark) setUpHeader(wordmark);
