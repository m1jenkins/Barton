// Renders a vehicle price guide in the Bento Buyer Dashboard layout (`layout: "dashboard"` in data/vehicle-pages.json).
// Preserves all governed data, source links, Reddit sentiment test hooks, and approved plan copy while replacing
// long editorial prose with a scannable buyer command center and tabbed deep-dive workspace.

const longDate = iso => new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
const monthYear = iso => new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const count = value => value.toLocaleString('en-US');
const dollars = value => `$${value.toLocaleString('en-US')}`;
const percent = (value, max) => `${Math.round((value / max) * 1000) / 10}%`;
const roundTo50 = value => Math.round(value / 50) * 50;
const tick = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';

const discountRange = text => {
  if (text === 'MSRP') return [0, 0];
  if (text === 'Any discount') return [0, null];
  const found = text.match(/^(\d+(?:\.\d+)?)(?:–(\d+(?:\.\d+)?))?% (under|or more)$/);
  if (!found) throw new Error(`Unreadable discount "${text}"`);
  const from = Number(found[1]);
  return [from, found[3] === 'or more' ? null : Number(found[2] ?? found[1])];
};

const midpointPct = text => {
  const [from, to] = discountRange(text);
  if (to === null) return from;
  return Math.round(((from + to) / 2) * 10) / 10;
};

const formatDealCell = (kind, label, text, price, base = 'MSRP') => {
  const [from, to] = discountRange(text);
  let figure, sub;
  if (text === 'MSRP') {
    figure = 'MSRP';
    sub = 'No markup';
  } else if (text === 'Any discount') {
    figure = 'Any off';
    sub = 'Under sticker';
  } else {
    figure = to === null ? `${from}%+ off` : from === to ? `${from}% off` : `${from}–${to}% off`;
    sub = to === null
      ? `${dollars(roundTo50(price * from / 100))}+ under ${base}`
      : from === to
        ? `~${dollars(roundTo50(price * from / 100))} under ${base}`
        : `~${dollars(roundTo50(price * from / 100))}–${dollars(roundTo50(price * to / 100))} off`;
  }
  return `<div class="vd-deal-cell${kind === 'strong' ? ' vd-deal-cell--strong' : ''}"><span class="vd-deal-cell__k">${label}</span><span class="vd-deal-cell__v">${figure}</span><span class="vd-deal-cell__sub">${sub}</span></div>`;
};

const matchTrimDealRow = (trim, payRows) => {
  const name = trim.name.toLowerCase();
  const exact = payRows.find(row => row.trims.split(',').some(part => part.trim().toLowerCase() === name));
  if (exact) return exact;
  if (/plug-in|gr sport/i.test(trim.name)) {
    const pluginRow = payRows.find(row => /plug-in/i.test(row.trims));
    if (pluginRow) return pluginRow;
  }
  return payRows[0];
};

const totalPaid = (amount, apr, months) => {
  if (!apr) return amount;
  const r = apr / 1200;
  return (amount * r / (1 - (1 + r) ** -months)) * months;
};

export function renderDashboardVehiclePage({
  vehicle,
  updated,
  coded,
  sentiment,
  origin,
  models,
  vehicles,
  comparisons,
  planCards,
  mark,
  makeOf,
  sourceLogos,
  sentimentTopics,
  moreItems,
}) {
  const checked = longDate(vehicle.checkedOn);
  const name = vehicle.name;
  const short = vehicle.reddit?.short ?? name.split(' ').slice(1).join(' ');
  const make = makeOf(name);
  const ask = '<a class="vd-link" href="/schedule.html">Ask us</a>';
  const sourceMark = (source, eager = false) => sourceLogos[source] ? mark(sourceLogos[source], { alt: source, eager }) : source;
  const picture = (image, widths, sizes, priority) => `<picture>${['avif', 'webp'].map(type => `<source type="image/${type}" srcset="${widths.map(width => `/assets/external/optimized/${image.file}-${width}.${type} ${width}w`).join(', ')}" sizes="${sizes}">`).join('')}<img src="/assets/external/source/${image.file}-original.jpg" alt="${image.alt}" width="${image.width}" height="${image.height}" decoding="async"${priority ? ' fetchpriority="high"' : ' loading="lazy"'}></picture>`;
  const credit = (label, image) => `<li>${label}: <a href="${image.sourceUrl}" rel="noopener">${image.author}</a>, ${image.licenseUrl ? `<a href="${image.licenseUrl}" rel="noopener">${image.license}</a>` : image.license}${image.note ? `, ${image.note}` : ''}</li>`;

  const allPhotos = [vehicle.photo, ...vehicle.gallery];
  const pickRow = vehicle.trims.rows.find(row => row.pick) ?? vehicle.trims.rows[0];
  const topPrice = Math.max(...vehicle.trims.rows.map(row => row.prices[0]));
  const lowPrice = Math.min(...vehicle.trims.rows.map(row => row.prices[0]));
  const walk = vehicle.pay.walk;
  const destination = walk.sticker - (pickRow ? pickRow.prices[0] : lowPrice);

  // KPI summary values from governed data
  const kpiDeal = vehicle.glance.find(tile => tile.section === 'pay')?.value ?? '1–2% under MSRP';
  const kpiOffer = vehicle.glance.find(tile => tile.section === 'incentives')?.value ?? '4.99% APR';
  const kpiPick = vehicle.pick.trim;
  const kpiCond = vehicle.glance.find(tile => tile.section === 'new-used')?.value ?? 'Buy new';

  // Safety helpers
  const safetyLogo = /IIHS/.test(vehicle.safety.label) ? 'iihs-hldi' : 'nhtsa';
  const tallyHtml = vehicle.safety.outOf
    ? `<span class="vd-tally" role="img" aria-label="${vehicle.safety.overall} of ${vehicle.safety.outOf} rated Good">${Array.from({ length: vehicle.safety.outOf }, (_, i) => `<i${i < vehicle.safety.overall ? ' class="on"' : ''}></i>`).join('')}</span>`
    : '';
  const maxRecalls = Math.max(...vehicle.safety.recalls.map(row => row.value), 1);

  // Reddit sentiment helpers (keeps exact test hooks from scripts/_tests/vehicle-pages.test.mjs)
  const homeSubs = [coded.home].flat().map(sub => `r/${sub}`);
  const homeText = homeSubs.length > 1 ? `${homeSubs.slice(0, -1).join(', ')} and ${homeSubs.at(-1)}` : homeSubs[0];
  const modelName = key => {
    if (!models[key]) throw new Error(`data/reddit-sentiment/models.json has no name for ${key}`);
    return models[key];
  };
  const guideFor = key => vehicles.find(entry => entry.slug === `${key}-price.html`);
  const versusFor = key => comparisons.find(cmp => cmp.cars.map(car => car.slug).toSorted().join() === [vehicle.slug, `${key}-price.html`].toSorted().join());

  const redditMin = 15;
  const topicRows = Object.entries(sentiment.topics)
    .filter(([, figure]) => figure.mentions >= redditMin && figure.net !== null)
    .sort((x, y) => y[1].net - x[1].net);
  const netBar = figure => {
    const value = figure.net;
    return `<span class="vd-rd-bar vd-rd-bar--${value >= 0 ? 'pos' : 'neg'}" style="--w:${Math.abs(value)}%"><i aria-hidden="true"></i><b>${value > 0 ? '+' : value < 0 ? '−' : ''}${Math.abs(value)}<span class="sr-only"> net, from ${figure.mentions} mentions</span></b></span>`;
  };
  const themeList = side => Object.entries(sentiment.topics)
    .filter(([topic, figure]) => figure[side] >= 5 && coded.themes?.[topic]?.[side]?.length)
    .sort((x, y) => y[1][side] - x[1][side]).slice(0, 4)
    .map(([topic]) => `<li><b>${sentimentTopics[topic]}.</b> ${coded.themes[topic][side][0]}</li>`).join('');
  const picks = sentiment.picks;
  const topRivalPick = Object.entries(picks.by).filter(([key]) => key !== sentiment.car).sort((x, y) => y[1] - x[1])[0];
  const cross = sentiment.crossShopped;
  const crossTop = Math.max(...cross.map(item => item.threads), 1);

  // Incentives loan rate comparison — compact visual table showing total 4-year cost vs. average loan (no prose paragraph).
  const choice = vehicle.incentives.choice;
  let rateComparisonHtml = '';
  if (choice) {
    const base = roundTo50(totalPaid(choice.price, choice.baseRate, choice.months));
    const rows = choice.options
      .map(option => {
        const total = roundTo50(totalPaid(choice.price - option.cash, option.rate, choice.months));
        const diff = base - total;
        return { ...option, total, diff };
      })
      .sort((a, b) => a.total - b.total);
    const best = Math.max(...rows.map(row => row.diff), 1);
    const bestTotal = rows[0].total;
    const bankRate = choice.text.match(/(\d+\.\d+%)/g)?.at(-1);
    rateComparisonHtml = `<div class="vd-rate-box">
<div class="vd-rate-box__head">
  <h3>${choice.months}-month loan on ${dollars(choice.price)}</h3>
  <span class="vd-rate-box__col">Total paid</span>
</div>
<ul class="vd-rate-rows" role="list">
${rows.map(row => {
  const isBest = row.total === bestTotal && row.diff > 0;
  const barWidth = row.diff > 0 ? percent(row.diff, best) : '8%';
  const diffHtml = row.diff > 0
    ? `<span class="vd-rate-row__diff">−${dollars(row.diff)}</span>`
    : '<span class="vd-rate-row__diff vd-rate-row__diff--base">avg rate</span>';
  return `<li class="vd-rate-row${isBest ? ' vd-rate-row--best' : ''}">
  <span class="vd-rate-row__name"><strong>${row.name}</strong> · ${row.detail}</span>
  <span class="vd-rate-row__nums"><span class="vd-rate-row__total">${dollars(row.total)}</span>${diffHtml}</span>
  <div class="vd-rate-track" aria-hidden="true"><span style="--w:${barWidth}"></span></div>
</li>`;
}).join('\n')}
</ul>
${bankRate ? `<p class="vd-rate-box__tip">Top-credit buyers averaged ${bankRate} — check your bank’s rate too.</p>` : ''}
</div>`;
  }

  // Trims classification for powertrain filter
  const trimGroupOf = row => /plug-in|gr sport/i.test(row.name) || /plug-in/i.test(row.engine || '') ? 'plugin' : 'hybrid';
  const hybridCount = vehicle.trims.rows.filter(row => trimGroupOf(row) === 'hybrid').length;
  const pluginCount = vehicle.trims.rows.filter(row => trimGroupOf(row) === 'plugin').length;

  // Rivals rows
  const rivalRows = [{ ...vehicle.rivals.self, self: true }, ...vehicle.rivals.cars];
  const rivalTop = Math.max(...rivalRows.map(row => row.price), 1);

  // Plan cards (exact homepage copy, tested by vehicle-pages.test.mjs & deal-pages.test.mjs)
  const planCardHtml = (card, location) => `<article class="vp-plan${card.pro ? ' vp-plan--pro' : ''}">
<span class="vp-plan__photo"><img src="/assets/external/optimized/${card.photo}" alt="" width="64" height="64" loading="lazy" decoding="async"></span>
<h3>${card.name}</h3>
<p class="vp-plan__fit">${card.fit}</p>
<p class="vp-plan__price">${card.price} <span>one-time</span></p>
<ul role="list">
${card.items.map(item => `<li>${tick}${item}</li>`).join('\n')}
</ul>
<a class="vp-plan__button" href="${card.href}" data-cta-location="${location}">Get ${card.name}</a>
</article>`;

  const faqEntries = [
    ...vehicle.faq,
    [`Can you negotiate a ${name} for me?`, 'Yes. Steer Me Right charges a flat $395 for one model or $695 for up to three. We find it in dealer stock, get written out-the-door offers and negotiate for a price below MSRP. We can’t promise a specific discount: the market for a given car sets what a dealer will do.'],
    ['Do dealers pay you?', 'No. Dealers and lenders pay us nothing. You pay the flat fee, and you’re the only one we work for.'],
    ['What if I change my mind?', 'Cancel before negotiations begin and you get a full refund. During negotiations, refund eligibility depends on the work already done. Read the <a href="/policy.html#refund-policy">refund policy</a>.'],
  ];

  const body = `<article class="vd" data-vehicle-dashboard>
  <header class="vd-topbar">
    <div class="vd-wrap">
      <div class="vd-meta">
        <p><a href="/blog.html">Resources</a> / ${name} price</p>
        <p>By <a href="/about.html">Mason</a> · Updated <time datetime="${updated}">${longDate(updated)}</time></p>
      </div>
      <div class="vd-title-row">
        <div class="vd-title-main">
          ${make ? `<span class="vd-make-mark">${mark(make, { alt: '', eager: true })}</span>` : ''}
          <div>
            <h1>${vehicle.h1}</h1>
            <p class="vd-title-sub">${vehicle.modelYear} ${name} buyer dashboard · Reviews, Reddit sentiment, and live dealer pricing targets</p>
          </div>
        </div>
        <div class="vd-title-actions">
          <a class="vd-btn" href="#plans">Let us negotiate it · $395</a>
          <p class="vd-fine">Dealers and lenders pay us nothing.</p>
        </div>
      </div>
      <nav class="vd-kpis" aria-label="${name} key metrics">
        <a class="vd-kpi" href="#trims">
          <span class="vd-kpi__label">Starting MSRP</span>
          <span class="vd-kpi__value">${dollars(lowPrice)}–${dollars(topPrice)}</span>
          <span class="vd-kpi__sub">${vehicle.trims.rows.length} trims · +${dollars(destination)} dest.</span>
        </a>
        <a class="vd-kpi" href="#pay">
          <span class="vd-kpi__label">Dealer target</span>
          <span class="vd-kpi__value vd-kpi__value--accent">${kpiDeal.replace(/<[^>]+>/g, '')}</span>
          <span class="vd-kpi__sub">Fair target · 3–4% strong</span>
        </a>
        <a class="vd-kpi" href="#incentives">
          <span class="vd-kpi__label">Current offer</span>
          <span class="vd-kpi__value">${kpiOffer.replace(/<[^>]+>/g, '')}</span>
          <span class="vd-kpi__sub">48 mo · Ends Nov 30</span>
        </a>
        <a class="vd-kpi" href="#reddit">
          <span class="vd-kpi__label">Reddit sentiment</span>
          <span class="vd-kpi__value vd-kpi__value--accent">${sentiment.index} / 100</span>
          <span class="vd-kpi__sub">${count(sentiment.comments)} comments · ${picks.share}% pick</span>
        </a>
        <a class="vd-kpi" href="#pick">
          <span class="vd-kpi__label">Our pick</span>
          <span class="vd-kpi__value">${kpiPick}</span>
          <span class="vd-kpi__sub">${kpiCond}</span>
        </a>
      </nav>
    </div>
  </header>

  <div class="vd-wrap vd-canvas">
    <!-- ROW A: Photo Showcase + Quick Verdict -->
    <div class="vd-grid">
      <section class="vd-card vd-gallery-card vd-col-7" aria-label="${name} photos">
        <div class="vd-stage-photo">
          ${allPhotos.map((photo, index) => `<figure data-vd-slide="${index}"${index === 0 ? '' : ' hidden'}>${picture(photo, index === 0 ? [640, 960, 1600] : [480, 960], '(max-width: 1120px) 94vw, 720px', index === 0)}<figcaption>${photo.caption}</figcaption></figure>`).join('\n          ')}
        </div>
        <div class="vd-thumbs" role="group" aria-label="Choose a photo">
          ${allPhotos.map((photo, index) => `<button type="button" class="vd-thumb" data-vd-thumb="${index}" aria-pressed="${index === 0 ? 'true' : 'false'}" aria-label="Show ${photo.caption}">${picture(photo, index === 0 ? [640] : [480], '160px', false)}</button>`).join('\n          ')}
        </div>
      </section>

      <section id="overview" class="vd-card vd-col-5">
        <div class="vd-card__head">
          <h2>The bottom line</h2>
          <span class="vd-meta-label vd-meta-label--accent">Buy new · 2026</span>
        </div>
        <p class="vd-verdict-lead">${vehicle.summary}</p>
        <div class="vd-verdict-split">
          <div class="vd-verdict-group">
            <h3>Why buyers pick it</h3>
            <ul class="vd-verdict-list" role="list">
              ${vehicle.pros.map(item => `<li>${item}</li>`).join('\n              ')}
            </ul>
          </div>
          <div class="vd-verdict-group">
            <h3>What to watch out for</h3>
            <ul class="vd-verdict-list vd-verdict-list--cons" role="list">
              ${vehicle.cons.map(item => `<li>${item}</li>`).join('\n              ')}
            </ul>
          </div>
        </div>
        <div class="vd-verdict-foot">
          <a class="vd-btn" href="#pay">See dealer deals</a>
          <a class="vd-btn vd-btn--ghost" href="#trims">Compare trims</a>
        </div>
      </section>
    </div>

    <!-- ROW B: Expert Review Scores + Reddit Sentiment Pulse -->
    <div class="vd-grid">
      <section id="reviews" class="vd-card vd-col-5">
        <div class="vd-card__head">
          <h2>How well reviewed it is</h2>
          <span class="vd-card__eyebrow">4 major outlets</span>
        </div>
        <ul class="vd-scores" role="list">
          ${vehicle.scores.cards.map(card => `<li>
            <a class="vd-score-row" href="${card.url}" rel="noopener">
              <span class="vd-score-row__brand">${sourceMark(card.source, true)}</span>
              <span class="vd-score-row__num">${card.display}<small>/${card.scale}</small></span>
              <span class="vd-bar" aria-hidden="true"><span style="--w:${percent(card.value, card.scale)}"></span></span>
              <span class="vd-score-row__detail">${card.detail}</span>
            </a>
          </li>`).join('\n          ')}
        </ul>
        <div class="vd-safety-mini">
          <div class="vd-safety-mini__left">
            ${mark(safetyLogo, { eager: false })}
            <div>
              <p class="vd-safety-mini__title">${vehicle.safety.overall}/${vehicle.safety.outOf} ${vehicle.safety.label}</p>
              ${tallyHtml}
              <p class="vd-safety-mini__sub">Consumer Reports: more reliable than average</p>
            </div>
          </div>
          <a class="vd-link" href="#safety" style="font-size:13px;font-weight:600;white-space:nowrap;">Full report</a>
        </div>
        <p class="vd-note">${vehicle.scores.note}</p>
      </section>

      <div class="vd-card vd-col-7" data-vd-subtabs>
        <section id="reddit" class="vp-section">
          <div class="vd-card__head">
            <div class="vd-card__title">
              <h2>Reddit sentiment</h2>
              <span class="vd-rd-header-logo">${mark('reddit', { alt: 'Reddit' })}</span>
            </div>
            <span class="vd-meta-label">${count(sentiment.comments)} comments · ${count(sentiment.threads)} threads</span>
          </div>

          <div class="vd-rd-metrics">
            <div class="vd-rd-stat">
              <p class="vd-rd-stat__label">Reddit Sentiment Index</p>
              <p class="vp-rd-big">${sentiment.index}<small> / 100</small></p>
              <div class="vd-rd-scale" aria-hidden="true"><i style="--w:${sentiment.index}%"></i></div>
              <p class="vd-rd-ends" aria-hidden="true"><span>Negative</span><span>50 = even</span><span>Positive</span></p>
              <p class="vd-rd-sub">${homeText}: <strong>${sentiment.venues.home.index}</strong> · Rest of Reddit: <strong>${sentiment.venues.neutral.index}</strong> (${count(sentiment.opinions)} opinions)</p>
            </div>
            <div class="vd-rd-stat">
              <p class="vd-rd-stat__label">Picked when cross-shopped</p>
              <p class="vp-rd-big">${picks.share}%</p>
              <div class="vd-rd-scale vd-rd-scale--plain" aria-hidden="true"><i style="--w:${picks.share}%"></i></div>
              <p class="vd-rd-sub">${count(picks.car)} of ${count(picks.all)} picks in ${count(picks.threads)} neutral threads.${topRivalPick ? ` Next closest: ${modelName(topRivalPick[0])} (${count(topRivalPick[1])}).` : ''}</p>
            </div>
          </div>

          <div class="vd-rd-controls">
            <div class="vd-seg" role="tablist" aria-label="Reddit breakdown views">
              <button type="button" class="vd-seg__btn" role="tab" data-vd-subtab="topics" aria-selected="true">By topic (${topicRows.length})</button>
              <button type="button" class="vd-seg__btn" role="tab" data-vd-subtab="themes" aria-selected="false">Praise vs. gripes</button>
              <button type="button" class="vd-seg__btn" role="tab" data-vd-subtab="cross" aria-selected="false">Cross-shopped (${cross.length})</button>
            </div>
            <span class="vd-card__eyebrow">${monthYear(coded.threadsFrom)} – ${monthYear(coded.threadsTo)}</span>
          </div>

          <div class="vd-rd-panel" data-vd-subpanel="topics" role="tabpanel">
            <ul class="vd-rd-net" role="list">
              ${topicRows.map(([topic, figure]) => `<li><span class="vd-rd-net__label">${sentimentTopics[topic]}<small>${count(figure.mentions)} mentions</small></span>${netBar(figure)}</li>`).join('\n              ')}
              <li class="vd-rd-net__axis" aria-hidden="true"><span></span><span><span>−100 negative</span><span>0 even</span><span>+100 positive</span></span></li>
            </ul>
          </div>

          <div class="vd-rd-panel" data-vd-subpanel="themes" role="tabpanel" hidden>
            <div class="vd-rd-themes">
              <div class="vd-rd-theme-box">
                <h3>What owners praise</h3>
                <ul role="list">${themeList('pos')}</ul>
              </div>
              <div class="vd-rd-theme-box vd-rd-theme-box--neg">
                <h3>What owners complain about</h3>
                <ul role="list">${themeList('neg')}</ul>
              </div>
            </div>
          </div>

          <div class="vd-rd-panel" data-vd-subpanel="cross" role="tabpanel" hidden>
            <ol class="vd-cross-list" role="list">
              ${cross.map(item => {
                const cmp = versusFor(item.key);
                const other = guideFor(item.key);
                const label = cmp
                  ? `<a href="/${cmp.slug}">${modelName(item.key)}</a><small>Head-to-head comparison</small>`
                  : other
                    ? `<a href="/${other.slug}">${modelName(item.key)}</a><small>Price guide</small>`
                    : `<span>${modelName(item.key)}</span>`;
                return `<li><div>${label}</div><span class="vd-bar" aria-hidden="true"><span style="--w:${percent(item.threads, crossTop)}"></span></span><span class="vd-cross-list__val">${item.threads} thread${item.threads === 1 ? '' : 's'}</span></li>`;
              }).join('\n              ')}
            </ol>
          </div>

          <p class="vd-note">Our own reading of public Reddit comments (Arctic Shift archive, collected ${longDate(coded.collected)}), coded to a fixed rubric with ${homeSubs.length > 1 ? 'the car’s own subreddits' : homeText} and neutral subreddits weighted equally. Not a survey; complaints reflect owner reports, not confirmed defects.</p>
        </section>
      </div>
    </div>

    <!-- ROW C: Dealership Deals & Target Price + Current Toyota Offers -->
    <div class="vd-grid">
      <section id="pay" class="vd-card vd-col-7">
        <div class="vd-card__head">
          <h2>What to pay at dealerships</h2>
          <span class="vd-meta-label vd-meta-label--warn">Tight supply · 24 days vs. 87 avg</span>
        </div>

        <ul class="vd-deal-rows" role="list">
          ${vehicle.pay.rows.map(row => {
            const examplePrice = vehicle.trims.rows.find(trim => trim.name === row.example).prices[0];
            return `<li class="vd-deal-row">
            <div class="vd-deal-row__name">
              <h3>${row.trims}</h3>
              <p>${row.why}</p>
            </div>
            ${formatDealCell('fair', 'Fair deal', row.fair, examplePrice, vehicle.pay.base)}
            ${formatDealCell('strong', 'Strong deal', row.strong, examplePrice, vehicle.pay.base)}
          </li>`;
          }).join('\n          ')}
        </ul>

        <div class="vd-calc" data-vd-calc data-vd-destination="${destination}">
          <div class="vd-calc__top">
            <label class="vd-calc__title" for="vd-trim-picker">Estimate your target price</label>
            <div class="vd-calc__controls">
              <select id="vd-trim-picker" class="vd-select" data-vd-trim-select aria-label="Choose a RAV4 trim">
                ${vehicle.trims.rows.map(trim => {
                  const row = matchTrimDealRow(trim, vehicle.pay.rows);
                  const fairPct = midpointPct(row.fair);
                  const strongPct = midpointPct(row.strong);
                  return `<option value="${trim.name}" data-msrp="${trim.prices[0]}" data-fair-pct="${fairPct}" data-strong-pct="${strongPct}"${trim.pick ? ' selected' : ''}>${vehicle.modelYear} ${trim.name} (${dollars(trim.prices[0])})</option>`;
                }).join('\n                ')}
              </select>
              <div class="vd-seg" role="group" aria-label="Target deal tier">
                <button type="button" class="vd-seg__btn" data-vd-tier="fair" aria-pressed="true">Fair deal</button>
                <button type="button" class="vd-seg__btn" data-vd-tier="strong" aria-pressed="false">Strong deal</button>
              </div>
            </div>
          </div>
          <div class="vd-math-grid">
            <div class="vd-math-box">
              <span>${walk.stickerLabel}</span>
              <strong data-vd-calc-sticker>${dollars(walk.sticker)}</strong>
            </div>
            <span class="vd-math-op" aria-hidden="true">−</span>
            <div class="vd-math-box">
              <span data-vd-calc-disc-label>${walk.steps[0].label}</span>
              <strong data-vd-calc-disc><span class="sr-only">minus </span>${dollars(walk.steps[0].amount)}</strong>
            </div>
            <span class="vd-math-op" aria-hidden="true">=</span>
            <div class="vd-math-box vd-math-box--total">
              <span>${walk.totalLabel}</span>
              <strong data-vd-calc-total>${dollars(walk.total)}</strong>
              <em data-vd-calc-under>${dollars(walk.sticker - walk.total)} ${walk.under ?? 'under sticker'}</em>
            </div>
          </div>
        </div>

        <details class="vd-more">
          <summary>How we set these discount targets</summary>
          <div class="vd-more__body">
            ${vehicle.pay.evidence.intro.map(p => `<p style="margin-bottom:8px;">${p}</p>`).join('')}
            <p>Have a dealer quote in hand? Email <a class="vd-link" href="mailto:hello@steermeright.com">hello@steermeright.com</a> or use “Talk to Mason” on the <a class="vd-link" href="/schedule.html">pricing page</a> for a free gut check within one business day.</p>
          </div>
        </details>
        <p class="vd-note">${vehicle.pay.note} Ranges are our estimate from public market data, not a promise.</p>
      </section>

      <section id="incentives" class="vd-card vd-col-5">
        <div class="vd-card__head">
          <h2>Current Toyota offers</h2>
          <span class="vd-meta-label">2026 models · Ends Nov 30</span>
        </div>

        <ul class="vd-offers-grid" role="list">
          ${vehicle.incentives.cards.map(card => `<li class="vd-offer">
            <p class="vd-offer__label">${card.label}</p>
            <p class="vd-offer__big">${card.figure} <span>${card.word}</span></p>
            <p class="vd-offer__text">${card.text}</p>
          </li>`).join('\n          ')}
        </ul>

        ${rateComparisonHtml}

        ${vehicle.incentives.addons.map(addon => `<div class="vd-addon-row">
          <div>
            <strong>${addon.title} · ${addon.figure} ${addon.unit}</strong>
            <span>${addon.detail}</span>
          </div>
          <a href="${addon.href}">${addon.link}</a>
        </div>`).join('\n        ')}

        <details class="vd-more">
          <summary>All regional offers &amp; end dates</summary>
          <div class="vd-more__body vd-scroll">
            <table class="vd-table">
              <caption class="sr-only">Manufacturer offers on the ${name}, checked ${checked}</caption>
              <thead><tr><th scope="col">Offer</th><th scope="col">Details</th><th scope="col">Ends</th></tr></thead>
              <tbody>
                ${vehicle.incentives.rows.map(row => `<tr><th scope="row">${row.offer}<span class="vd-sub">${row.applies}</span></th><td>${row.detail}</td><td style="white-space:nowrap;">${row.ends || ask}</td></tr>`).join('\n                ')}
              </tbody>
            </table>
          </div>
        </details>
        <p class="vd-note">${vehicle.incentives.note}</p>
      </section>
    </div>

    <!-- ZONE 3: Interactive Deep-Dive Tabbed Workspace -->
    <section class="vd-workspace" data-vd-workspace aria-label="${name} deep-dive research">
      <div class="vd-tabbar" role="tablist" aria-label="Research sections">
        <button type="button" class="vd-tab" role="tab" id="tab-trims" data-vd-tab="trims" aria-controls="panel-trims" aria-selected="true">Trims &amp; Our Pick</button>
        <button type="button" class="vd-tab" role="tab" id="tab-new-used" data-vd-tab="new-used" aria-controls="panel-new-used" aria-selected="false">New vs. Used vs. CPO</button>
        <button type="button" class="vd-tab" role="tab" id="tab-rivals" data-vd-tab="rivals" aria-controls="panel-rivals" aria-selected="false">Rivals</button>
        <button type="button" class="vd-tab" role="tab" id="tab-safety" data-vd-tab="safety" aria-controls="panel-safety" aria-selected="false">Safety &amp; Dealer Watch-Outs</button>
        <button type="button" class="vd-tab" role="tab" id="tab-faq" data-vd-tab="faq" aria-controls="panel-faq" aria-selected="false">Common Questions (${faqEntries.length})</button>
      </div>

      <!-- TAB 1: Trims & Our Pick -->
      <div id="panel-trims" class="vd-tabpanel" role="tabpanel" aria-labelledby="tab-trims" data-vd-panel="trims">
        <div id="pick" class="vd-pick-banner">
          <div class="vd-pick-banner__hero">
            <p class="vd-pick-banner__eyebrow">The trim we’d buy</p>
            <p class="vd-pick-banner__name">${vehicle.pick.trim}</p>
            <p class="vd-pick-banner__price">${dollars(pickRow.prices[0])} <span>starting MSRP</span></p>
          </div>
          <ul class="vd-pick-banner__why" role="list">
            ${vehicle.pick.reasons.map(reason => `<li>${tick}<span>${reason}</span></li>`).join('\n            ')}
          </ul>
        </div>
        <div class="vd-alts">
          ${vehicle.pick.also.map(alt => `<div class="vd-alt">
            <div class="vd-alt__head">
              <span class="vd-kicker${/^skip/i.test(alt.label) ? ' vd-kicker--warn' : ''}">${alt.label}</span>
              ${alt.price ? `<span class="vd-alt__price">${alt.price}</span>` : ''}
            </div>
            <p style="margin-top:6px;"><strong class="vd-alt__name">${alt.name}</strong> — ${alt.text}</p>
          </div>`).join('\n          ')}
        </div>

        <div id="trims" class="vd-table-head">
          <h3>${vehicle.modelYear} vs. 2027 ${name} trims &amp; MSRP</h3>
          <div class="vd-seg" role="group" aria-label="Filter trims by powertrain">
            <button type="button" class="vd-seg__btn" data-vd-trim-filter="all" aria-pressed="true">All (${vehicle.trims.rows.length})</button>
            <button type="button" class="vd-seg__btn" data-vd-trim-filter="hybrid" aria-pressed="false">Hybrid (${hybridCount})</button>
            <button type="button" class="vd-seg__btn" data-vd-trim-filter="plugin" aria-pressed="false">Plug-in (${pluginCount})</button>
          </div>
        </div>
        <div class="vd-scroll">
          <table class="vd-table vd-table--wide">
            <caption class="sr-only">${vehicle.modelYear} ${name} starting MSRP by trim, checked ${checked}</caption>
            <thead><tr><th scope="col">Trim &amp; key equipment</th><th scope="col">2026 MSRP</th><th scope="col">2027 MSRP</th><th scope="col">Powertrain</th></tr></thead>
            <tbody>
              ${vehicle.trims.rows.map(trim => `<tr data-vd-trim-group="${trimGroupOf(trim)}">
                <th scope="row">${trim.name}${trim.pick ? ' <span class="vd-inline-label">Our pick</span>' : ''}<span class="vd-sub">${trim.gets}</span></th>
                <td class="vd-price-cell"><div class="vd-price-cell__wrap"><span class="vd-price-cell__num">${dollars(trim.prices[0])}</span><span class="vd-bar" aria-hidden="true"><span style="--w:${percent(trim.prices[0], topPrice)}"></span></span></div></td>
                <td><strong>${dollars(trim.prices[1])}</strong></td>
                <td style="font-size:13px;color:var(--muted);">${trim.engine}</td>
              </tr>`).join('\n              ')}
            </tbody>
          </table>
        </div>
        <p class="vd-note">${vehicle.trims.after.join(' ')} ${vehicle.pick.text ?? ''}</p>
      </div>

      <!-- TAB 2: New vs Used vs CPO -->
      <div id="panel-new-used" class="vd-tabpanel" role="tabpanel" aria-labelledby="tab-new-used" data-vd-panel="new-used" hidden>
        <div id="new-used" class="vd-take-bar">${vehicle.condition.intro.join(' ')}</div>
        <div class="vd-mini-charts">
          ${vehicle.condition.charts.map(chart => {
            const maxVal = Math.max(...chart.bars.map(b => b.value), 1);
            return `<section class="vd-mini-chart">
            <h3>${chart.title}</h3>
            <ul class="vd-bars" role="list">
              ${chart.bars.map(bar => `<li><span>${bar.label}</span><span class="vd-bars__val">${bar.display ?? bar.value}</span><span class="vd-bar" aria-hidden="true"><span style="--w:${percent(bar.value, maxVal)}"></span></span></li>`).join('\n              ')}
            </ul>
            <p class="vd-note" style="margin-top:8px;">Source: ${chart.source}</p>
          </section>`;
          }).join('\n          ')}
        </div>
        <div class="vd-routes">
          ${vehicle.condition.rows.map(row => `<article class="vd-route">
            <h4>${row.route}</h4>
            <p><strong>Best when:</strong> ${row.when}</p>
            <p><strong>Check:</strong> ${row.check}</p>
          </article>`).join('\n          ')}
        </div>
        <p class="vd-note">${vehicle.condition.after.join(' ')}</p>
      </div>

      <!-- TAB 3: Rivals -->
      <div id="panel-rivals" class="vd-tabpanel" role="tabpanel" aria-labelledby="tab-rivals" data-vd-panel="rivals" hidden>
        <div id="rivals" class="vd-table-head">
          <h3>Rivals worth pricing against the ${short}</h3>
          <a class="vd-link" href="#plans" style="font-size:13.5px;font-weight:600;">Price up to 3 models with Pro</a>
        </div>
        <div class="vd-scroll">
          <table class="vd-table vd-table--wide">
            <caption class="sr-only">${name} and its rivals: starting MSRP</caption>
            <thead><tr><th scope="col">Model</th><th scope="col">Starting MSRP</th></tr></thead>
            <tbody>
              ${rivalRows.map(row => {
                const rowMake = makeOf(row.self ? name : row.name);
                return `<tr>
                <th scope="row">
                  <div class="vd-rival-name">
                    <span class="vd-rival-badge">${rowMake ? mark(rowMake, { alt: '' }) : ''}</span>
                    <span>${row.name}${row.self ? ' <span class="vd-inline-label">This guide</span>' : ''}<span class="vd-sub">${row.text}</span></span>
                  </div>
                </th>
                <td class="vd-price-cell"><div class="vd-price-cell__wrap"><span class="vd-price-cell__num">${dollars(row.price)}</span><span class="vd-bar" aria-hidden="true"><span style="--w:${percent(row.price, rivalTop)}"></span></span></div></td>
              </tr>`;
              }).join('\n              ')}
            </tbody>
          </table>
        </div>
        <p class="vd-note">${vehicle.rivals.note} Torn between two or three? <a href="#plans">Steer Me Right Pro</a> prices up to three models side by side and gives you our pick.</p>
      </div>

      <!-- TAB 4: Safety & Dealer Watch-Outs -->
      <div id="panel-safety" class="vd-tabpanel" role="tabpanel" aria-labelledby="tab-safety" data-vd-panel="safety" hidden>
        <div class="vd-two-col">
          <section id="safety">
            <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;">
              <h3>IIHS safety &amp; NHTSA recalls</h3>
              ${mark(safetyLogo, { alt: 'IIHS-HLDI' })}
            </div>
            <dl class="vd-safety-tests">
              ${vehicle.safety.rows.map(row => `<div><dt>${row.label}</dt><dd>${row.note ? `<span style="font-size:12px;color:var(--muted);">${row.note}</span>` : ''}<span class="vd-grade${row.grade !== 'Good' ? ' vd-grade--acceptable' : ''}" aria-hidden="true">${row.grade[0]}</span><span>${row.grade}</span></dd></div>`).join('\n              ')}
            </dl>
            <div class="vd-recalls">
              <h3>${vehicle.safety.recallsTitle}</h3>
              <ol class="vd-cols" role="list">
                ${vehicle.safety.recalls.map(row => `<li><span class="vd-cols__val">${row.value}</span><span class="vd-cols__bar" aria-hidden="true" style="--h:${Math.round((row.value / maxRecalls) * 100)}"></span><span class="vd-cols__label">${row.label}</span></li>`).join('\n                ')}
              </ol>
            </div>
            <p class="vd-note">${vehicle.safety.reliability}</p>
            <p class="vd-note">${vehicle.safety.note}</p>
          </section>

          <section id="watch">
            <h3>What to watch for at the dealer</h3>
            <ul class="vd-watch-list" role="list">
              ${vehicle.watch.map(item => `<li>${item}</li>`).join('\n              ')}
            </ul>
            <p class="vd-note">Compare dealers on the whole price in writing. Use our free <a href="/compare-car-quotes.html">quote comparison worksheet</a> and read the <a href="/blog-dealership-addons-complete-guide.html">dealership add-ons guide</a>.</p>
          </section>
        </div>
      </div>

      <!-- TAB 5: Common Questions -->
      <div id="panel-faq" class="vd-tabpanel" role="tabpanel" aria-labelledby="tab-faq" data-vd-panel="faq" hidden>
        <div id="faq" class="vd-faq">
          ${faqEntries.map(([q, a]) => `<details><summary>${q}</summary><p>${a}</p></details>`).join('\n          ')}
        </div>
      </div>
    </section>

    <!-- ZONE 4: Steer Me Right Plans + More Research + Sources -->
    <section id="plans" class="vd-card vd-plans">
      <div class="vd-card__head">
        <h2>Want us to negotiate your ${short}?</h2>
        <span class="vd-meta-label">Full refund if you cancel before negotiations begin.</span>
      </div>
      <div class="vd-plans__grid">
        ${planCards.map(card => planCardHtml(card, `vehicle-${vehicle.slug.replace(/-price\.html$/, '')}`)).join('\n        ')}
      </div>
      <p class="vd-note">You can upgrade to Steer Me Right Pro later by paying the $300 difference. The fee doesn’t cover the car, taxes or registration. <a href="/policy.html#refund-policy">Refund policy</a></p>
    </section>

    <section id="more" class="vd-card">
      <div class="vd-card__head">
        <h2>More on the ${name}</h2>
        <span class="vd-card__eyebrow">Related buyer guides</span>
      </div>
      <ul class="vd-more-links" role="list">
        ${moreItems.map(item => `<li>${item}</li>`).join('\n        ')}
      </ul>
    </section>

    <section class="vd-card vd-sources" aria-labelledby="guide-sources">
      <h2 id="guide-sources" style="font-size:15px;font-weight:600;color:var(--ink);margin-bottom:6px;">Sources, methodology &amp; credits</h2>
      <p>Written by <a href="/about.html">Mason</a>, Steer Me Right’s founder and lead advisor. Prices, incentives and market figures were checked on ${checked} and change often, so confirm them with the dealer before you sign. The discount ranges are our estimate from the sources below, not a promise. If something is out of date or wrong, email <a href="mailto:hello@steermeright.com">hello@steermeright.com</a> and we will correct it.</p>
      <div class="vd-sources-toggles">
        <details class="vd-more">
          <summary>All ${vehicle.sources.length} sources</summary>
          <ul>
            ${vehicle.sources.map(source => `<li><a href="${source.url}" rel="noopener">${source.title}</a>${source.note ? `: ${source.note}` : ''}</li>`).join('\n            ')}
          </ul>
        </details>
        <details class="vd-more">
          <summary>Photo credits</summary>
          <ul>
            ${[credit('Main photo', vehicle.photo), ...vehicle.gallery.map(item => credit(item.caption, item))].join('')}
          </ul>
        </details>
      </div>
      <p class="vd-note">Related: <a href="/new-car-buying-service.html">new car buying service</a>, <a href="/blog-buy-new-car-below-msrp.html">comparing complete new-car quotes</a> and <a href="/car-negotiation-service.html">car negotiation service</a>.</p>
    </section>
  </div>
</article>`;

  return {
    slug: vehicle.slug,
    title: vehicle.title,
    description: vehicle.description,
    h1: vehicle.h1,
    crumbs: [['Resources', `${origin}/blog.html`], [`${name} price`, `${origin}/${vehicle.slug}`]],
    body,
  };
}
