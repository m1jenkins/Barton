// Homepage behavior for the Wise-style layout: phone menu, resource tabs, the dealer
// quote checker and the mobile sticky buttons. The quote checker only does arithmetic
// in the browser; nothing leaves the page until the visitor submits the inquiry form.

const money = value => Number(String(value).replace(/[^0-9.]/g, '')) || 0;
const format = value => value ? Math.round(value).toLocaleString('en-US') : '';

// Phone menu
const menuButton = document.querySelector('[data-menu-toggle]');
const menu = document.getElementById('wz-menu');
if (menuButton && menu) {
  const setOpen = open => { menu.hidden = !open; menuButton.setAttribute('aria-expanded', String(open)); };
  menuButton.addEventListener('click', () => setOpen(menu.hidden));
  menu.addEventListener('click', event => { if (event.target.closest('a, button')) setOpen(false); });
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && !menu.hidden) { setOpen(false); menuButton.focus(); } });
}

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

// Dealer quote checker
const tool = document.querySelector('[data-quote-tool]');
if (tool) {
  const otd = tool.elements.namedItem('otd');
  const addons = tool.elements.namedItem('addons');
  const items = [...tool.querySelectorAll('[data-item]')];
  const result = tool.querySelector('[data-quote-result]');
  const itemize = tool.querySelector('[data-itemize]');
  const list = document.getElementById('quote-items');

  const update = () => {
    const total = money(otd.value);
    const extra = money(addons.value);
    result.textContent = total && extra && extra < total ? `$${format(total - extra)}` : '—';
  };
  // Browsers without CSS field-sizing size the big amounts by character count instead.
  const fit = input => { input.size = Math.max(input.value.length, input.placeholder.length, 1); };
  [otd, addons].forEach(fit);
  tool.querySelectorAll('[data-money]').forEach(input => {
    input.addEventListener('input', () => {
      const end = input.value.length - input.selectionStart;
      input.value = format(money(input.value));
      const caret = Math.max(0, input.value.length - end);
      input.setSelectionRange(caret, caret);
      if (input.hasAttribute('data-item')) addons.value = format(items.reduce((sum, item) => sum + money(item.value), 0));
      [otd, addons].forEach(fit);
      update();
    });
  });
  itemize.addEventListener('click', () => {
    const open = list.hidden;
    list.hidden = !open;
    itemize.setAttribute('aria-expanded', String(open));
    itemize.textContent = open ? 'Hide list' : 'Itemize';
    if (open) items[0].focus();
  });
  tool.addEventListener('submit', event => event.preventDefault());

  // Prefill the inquiry form with the quote. inquiry.js opens the dialog on the same click.
  tool.querySelector('[data-quote-send]').addEventListener('click', () => {
    const details = document.getElementById('inquiry-details');
    if (!details) return;
    const total = money(otd.value);
    const extra = money(addons.value);
    const lines = items.filter(item => money(item.value)).map(item => `- ${document.querySelector(`label[for="${item.id}"]`).textContent.trim()}: $${format(money(item.value))}`);
    const summary = [
      `Dealer quote (${tool.elements.namedItem('condition').value.toLowerCase()} car)`,
      total ? `Out-the-door price: $${format(total)}` : '',
      extra ? `Add-ons and dealer fees: $${format(extra)}` : '',
      ...lines
    ].filter(Boolean);
    if (total || extra) details.value = `${summary.join('\n')}\n\n${details.value.replace(/^Dealer quote[\s\S]*?\n\n/, '')}`.trim();
  });
}

// Mobile sticky buttons: visible once the hero is scrolled past, hidden over the
// plan cards, the closing band and the footer, where a button is already on screen.
const bar = document.querySelector('[data-sticky-cta]');
if (bar && 'IntersectionObserver' in window) {
  const watched = ['.wz-hero', '#plans .wz-plan-grid', '.wz-band', '.wz-footer'].map(selector => document.querySelector(selector)).filter(Boolean);
  const visible = new Set();
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => entry.isIntersecting ? visible.add(entry.target) : visible.delete(entry.target));
    const show = visible.size === 0;
    bar.classList.toggle('is-visible', show);
    bar.inert = !show;
  });
  watched.forEach(element => observer.observe(element));
}
