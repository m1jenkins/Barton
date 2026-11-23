// Progressive enhancement for the Vehicle Buyer Dashboard (buying/vehicle-dashboard.css).
// Handles photo gallery switching, Reddit sub-view toggles, interactive target-price math,
// trim powertrain filters, and deep-dive workspace tabs with URL hash deep-linking.

const dollars = value => `$${Math.round(value).toLocaleString('en-US')}`;

function initGallery(root) {
  const figures = [...root.querySelectorAll('[data-vd-slide]')];
  const thumbs = [...root.querySelectorAll('[data-vd-thumb]')];
  if (!figures.length || !thumbs.length) return;
  const show = index => {
    figures.forEach((fig, i) => { fig.hidden = i !== index; });
    thumbs.forEach((btn, i) => { btn.setAttribute('aria-pressed', String(i === index)); });
  };
  thumbs.forEach((btn, i) => btn.addEventListener('click', () => show(i)));
}

function initSubTabs(container) {
  const tabs = [...container.querySelectorAll('[data-vd-subtab]')];
  const panels = [...container.querySelectorAll('[data-vd-subpanel]')];
  if (!tabs.length || !panels.length) return;
  const activate = key => {
    tabs.forEach(btn => btn.setAttribute('aria-selected', String(btn.dataset.vdSubtab === key)));
    panels.forEach(panel => { panel.hidden = panel.dataset.vdSubpanel !== key; });
  };
  tabs.forEach(btn => btn.addEventListener('click', () => activate(btn.dataset.vdSubtab)));
  activate(tabs[0].dataset.vdSubtab);
}

function initCalculator(root) {
  const select = root.querySelector('[data-vd-trim-select]');
  const tierButtons = [...root.querySelectorAll('[data-vd-tier]')];
  const stickerEl = root.querySelector('[data-vd-calc-sticker]');
  const discLabelEl = root.querySelector('[data-vd-calc-disc-label]');
  const discValEl = root.querySelector('[data-vd-calc-disc]');
  const totalEl = root.querySelector('[data-vd-calc-total]');
  const underEl = root.querySelector('[data-vd-calc-under]');
  if (!select || !tierButtons.length || !stickerEl || !discValEl || !totalEl) return;

  const destination = Number(root.dataset.vdDestination || 0);
  let tier = 'fair';

  const update = () => {
    const opt = select.selectedOptions[0];
    if (!opt) return;
    const msrp = Number(opt.dataset.msrp || 0);
    const pct = Number(tier === 'strong' ? opt.dataset.strongPct : opt.dataset.fairPct);
    const sticker = msrp + destination;
    const discount = Math.round(sticker * (pct / 100) / 5) * 5;
    const total = sticker - discount;

    stickerEl.textContent = dollars(sticker);
    if (discLabelEl) {
      discLabelEl.textContent = pct > 0
        ? `Dealer discount, ${pct}%`
        : 'Dealer discount (sticker)';
    }
    discValEl.innerHTML = `<span class="sr-only">minus </span>${dollars(discount)}`;
    totalEl.textContent = dollars(total);
    if (underEl) {
      underEl.textContent = discount > 0 ? `${dollars(discount)} under sticker` : 'Pay MSRP, no markup';
    }
  };

  tierButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      tier = btn.dataset.vdTier;
      tierButtons.forEach(other => other.setAttribute('aria-pressed', String(other === btn)));
      update();
    });
  });

  select.addEventListener('change', update);
}

function initTrimFilter(root) {
  const buttons = [...root.querySelectorAll('[data-vd-trim-filter]')];
  const rows = [...root.querySelectorAll('[data-vd-trim-group]')];
  if (!buttons.length || !rows.length) return;
  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      const group = btn.dataset.vdTrimFilter;
      buttons.forEach(other => other.setAttribute('aria-pressed', String(other === btn)));
      rows.forEach(row => { row.hidden = group !== 'all' && row.dataset.vdTrimGroup !== group; });
    });
  });
}

function initWorkspace(root) {
  const tabs = [...root.querySelectorAll('[data-vd-tab]')];
  const panels = [...root.querySelectorAll('[data-vd-panel]')];
  if (!tabs.length || !panels.length) return;

  const hashToTab = {
    trims: 'trims',
    pick: 'trims',
    'new-used': 'new-used',
    rivals: 'rivals',
    safety: 'safety',
    watch: 'safety',
    faq: 'faq',
  };

  const activate = (key, { focus = false } = {}) => {
    tabs.forEach(tab => {
      const active = tab.dataset.vdTab === key;
      tab.setAttribute('aria-selected', String(active));
      tab.tabIndex = active ? 0 : -1;
      if (active && focus) tab.focus();
    });
    panels.forEach(panel => { panel.hidden = panel.dataset.vdPanel !== key; });
  };

  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => activate(tab.dataset.vdTab));
    tab.addEventListener('keydown', event => {
      if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
      event.preventDefault();
      const next = (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
      activate(tabs[next].dataset.vdTab, { focus: true });
    });
  });

  const openForHash = hash => {
    const id = hash.replace(/^#/, '');
    const targetTab = hashToTab[id];
    if (!targetTab) return false;
    activate(targetTab);
    return true;
  };

  // Initial state: honor URL hash if it points into a tab, otherwise open the first tab.
  if (!openForHash(window.location.hash)) activate(tabs[0].dataset.vdTab);

  // Intercept in-page links pointing inside a tab so the tab switches before scrolling.
  document.addEventListener('click', event => {
    const link = event.target.closest('a[href^="#"]');
    if (!link) return;
    const hash = link.getAttribute('href');
    if (openForHash(hash)) {
      const target = document.getElementById(hash.slice(1));
      if (target) {
        event.preventDefault();
        history.replaceState(null, '', hash);
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  });

  window.addEventListener('hashchange', () => openForHash(window.location.hash));
}

for (const dashboard of document.querySelectorAll('[data-vehicle-dashboard]')) {
  initGallery(dashboard);
  dashboard.querySelectorAll('[data-vd-subtabs]').forEach(initSubTabs);
  dashboard.querySelectorAll('[data-vd-calc]').forEach(initCalculator);
  initTrimFilter(dashboard);
  dashboard.querySelectorAll('[data-vd-workspace]').forEach(initWorkspace);
}
