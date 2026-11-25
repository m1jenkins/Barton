// Renders a vehicle price guide in the Bento Buyer Dashboard layout (default for all vehicle price pages).
// Preserves all governed data, source links, Reddit sentiment test hooks, and approved plan copy while replacing
// long editorial prose with a scannable buyer command center and tabbed deep-dive workspace.
import { summarizeCar } from './reddit-sentiment.mjs';

const longDate = iso => new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
const monthYear = iso => new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const count = value => value.toLocaleString('en-US');
const dollars = value => `$${value.toLocaleString('en-US')}`;
const percent = (value, max) => `${Math.round((value / max) * 1000) / 10}%`;
const roundTo50 = value => Math.round(value / 50) * 50;
const tick = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
const makeNames = ['Chevrolet', 'Ford', 'GMC', 'Honda', 'Hyundai', 'Kia', 'Mazda', 'Nissan', 'Ram', 'Subaru', 'Tesla', 'Toyota', 'Volkswagen', 'Jeep'];

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
    sub = base === 'asking' ? 'Under asking' : 'Under sticker';
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

function expandPayTokens(trimsText, trimIsHybrid, allowSharedHybridBare = false) {
  const rawParts = trimsText.split(/\s*,\s*|\s+and\s+/i).map(s => s.trim()).filter(Boolean);
  const tokens = new Set();
  const first = rawParts[0] || '';
  let sharedPrefix = '';
  if (/^Hybrid\s+/i.test(first)) sharedPrefix = 'Hybrid ';
  else if (/^2\.5\s+S\s+/i.test(first)) sharedPrefix = '2.5 S ';
  const last = rawParts.at(-1) || '';
  const sharedHybridSuffix = rawParts.length > 1 && /\s+Hybrid$/i.test(last) && !/^Hybrid\s+/i.test(first);

  for (const part of rawParts) {
    if (sharedPrefix && !part.toLowerCase().startsWith(sharedPrefix.toLowerCase())) {
      tokens.add((sharedPrefix + part).toLowerCase());
    } else if (!sharedHybridSuffix || trimIsHybrid || allowSharedHybridBare || /hybrid$/i.test(part)) {
      tokens.add(part.toLowerCase());
    }
    if (sharedHybridSuffix && trimIsHybrid && !/hybrid$/i.test(part)) {
      tokens.add((part + ' Hybrid').toLowerCase());
    }
  }
  return tokens;
}

const matchTrimDealRow = (trim, payRows) => {
  const name = trim.name.trim();
  const lower = name.toLowerCase();
  const isPlugin = /plug-in|gr sport/i.test(name) || /plug-in/i.test(trim.engine || '');
  const isHybrid = !isPlugin && (/\bhybrid\b/i.test(name) || /i-force max/i.test(name));

  // 1. Year-based matching for used car rows (e.g. "2024 Model Y", "2019 to 2023")
  const yearMatch = name.match(/^(20\d{2})\b/);
  if (yearMatch) {
    const year = Number(yearMatch[1]);
    const byYear = payRows.find(row => {
      const range = row.trims.match(/\b(20\d{2})\s+to\s+(20\d{2})\b/i);
      if (range && year >= Number(range[1]) && year <= Number(range[2])) return true;
      return new RegExp(`\\b${year}\\b`).test(row.trims);
    });
    if (byYear) return byYear;
  }

  // 2. Plug-in trims -> plug-in row
  if (isPlugin) {
    const pluginRow = payRows.find(row => /plug-in/i.test(row.trims));
    if (pluginRow) return pluginRow;
  }

  // 3. Exact token match (including shared prefix/suffix expansion)
  const exact = payRows.find(row => expandPayTokens(row.trims, isHybrid).has(lower));
  if (exact) return exact;

  // 4. Hatchback category match (e.g. Corolla "XSE, Hatchback", Civic "Hatchback, Si")
  if (/^hatchback\b/i.test(name)) {
    const hbRow = payRows.find(row => /\bhatchback\b/i.test(row.trims));
    if (hbRow) return hbRow;
  }

  // 5. i-FORCE MAX hybrids/versions (Tacoma, Tundra)
  if (/i-force max/i.test(name)) {
    const ifmRow = payRows.find(row => /i-force max/i.test(row.trims));
    if (ifmRow) return ifmRow;
  }

  // 6. Gas trims catch-all (Kia Sportage)
  if (!isHybrid && !isPlugin) {
    const gasRow = payRows.find(row => /\bgas trims\b/i.test(row.trims));
    if (gasRow) return gasRow;
  }

  // 7. Prefix/sub-trim match (e.g. Forester "Sport Onyx Edition" -> "Sport")
  const byPrefix = payRows.find(row => [...expandPayTokens(row.trims, isHybrid)].some(tok => lower.startsWith(`${tok} `) && !(/\bhybrid\b/i.test(lower) && !/\bhybrid\b/i.test(tok))));
  if (byPrefix) return byPrefix;

  // 8. Mixed gas+hybrid suffix rows (e.g. Forester "Base and Sport Hybrid", Accord "LX, SE and Sport Hybrid")
  if (!isHybrid && !isPlugin) {
    const mixedExact = payRows.find(row => expandPayTokens(row.trims, false, true).has(lower));
    if (mixedExact) return mixedExact;
  }

  return payRows[0];
};

function classifyTrimPowertrain(trim) {
  const name = trim.name;
  const stdEng = (trim.engine || '').split(';')[0];
  if (/plug-in|gr sport/i.test(name) || /plug-in/i.test(stdEng)) return { key: 'plugin', label: 'Plug-in' };
  if (/i-force max/i.test(name) || /\bhybrid\b/i.test(name) || /\bhybrid\b/i.test(stdEng) || /generator with two electric motors/i.test(stdEng)) {
    return { key: 'hybrid', label: 'Hybrid' };
  }
  if (/duramax|diesel/i.test(stdEng)) return { key: 'diesel', label: 'Diesel' };
  if (/5\.3L V8|6\.2L V8/i.test(stdEng)) return { key: 'v8', label: 'V8' };
  if (/turbomax/i.test(stdEng)) return { key: 'turbo4', label: 'Turbo 4' };
  if (/hurricane/i.test(stdEng)) return { key: 'hurricane', label: 'Hurricane I6' };
  if (/3\.5L.*ecoboost/i.test(stdEng)) return { key: '35v6', label: '3.5L EcoBoost' };
  if (/2\.7L ecoboost/i.test(stdEng)) return { key: '27v6', label: '2.7L EcoBoost' };
  if (/3\.0L twin-turbo/i.test(stdEng)) return { key: '30v6', label: '3.0L V6' };
  if (/2\.3L turbo/i.test(stdEng)) return { key: '23i4', label: '2.3L Turbo' };
  if ((/1\.5L turbo/i.test(stdEng) && /\bSi\b/.test(name)) || /1\.6L turbo/i.test(stdEng)) return { key: 'turbo', label: 'Turbo' };
  if (/3\.6L V6/i.test(stdEng)) return { key: 'v6', label: 'V6' };
  return { key: 'gas', label: 'Gas' };
}

function defaultTrimsHeading(vehicle) {
  const years = vehicle.trims.columns.map(col => col.match(/\b(20\d{2})\b/)?.[1]).filter(Boolean);
  if (years.length === 2) return `${years[0]} vs. ${years[1]} ${vehicle.name} trims &amp; MSRP`;
  return `${vehicle.modelYear} ${vehicle.name} trims &amp; MSRP`;
}

function shortEndDate(text) {
  const m = text.match(/Ends\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})/i);
  if (!m) return null;
  const abbr = { january: 'Jan', february: 'Feb', march: 'Mar', april: 'Apr', may: 'May', june: 'Jun', july: 'Jul', august: 'Aug', september: 'Sep', october: 'Oct', november: 'Nov', december: 'Dec' };
  return `Ends ${abbr[m[1].toLowerCase()]} ${m[2]}`;
}

function offerSub(vehicle, isUsed) {
  const card = vehicle.incentives.cards[0];
  if (!card) return '';
  if (isUsed) return card.word ? `${card.word} · Direct from Tesla` : 'Direct from Tesla';
  const mo = card.text.match(/(\d+)\s+months?/i)?.[1];
  const end = shortEndDate(card.text) || shortEndDate(`Ends ${vehicle.incentives.rows[0]?.ends || ''}`);
  const parts = [];
  if (mo) parts.push(`${mo} mo`);
  if (end) parts.push(end);
  if (!parts.length && card.label) parts.push(card.label);
  return parts.join(' · ');
}

function supplyEyebrow(vehicle, checked) {
  const intro = (vehicle.pay.evidence?.intro ?? []).join(' ');
  const days = intro.match(/(\d+)\s+days(?:\s+of\s+supply|\s+to\s+sell|\s+from\s+listing\s+to\s+sale)/i);
  const avg = intro.match(/against\s+(?:\d+\s+for[^,]*and\s+)?(\d+)\s+for\s+the\s+industry|against\s+(?:a\s+)?(\d+)-day/i);
  if (days && (avg?.[1] || avg?.[2])) {
    const d = Number(days[1]);
    const a = Number(avg[1] || avg[2]);
    const tone = d <= a * 0.65 ? 'Tight supply' : d >= a * 1.15 ? 'Plentiful supply' : 'Balanced supply';
    return `<span class="vd-meta-label${d <= a * 0.65 ? ' vd-meta-label--warn' : ''}">${tone} · ${d} days vs. ${a} avg</span>`;
  }
  if (days) {
    return `<span class="vd-meta-label">${days[1]} days supply</span>`;
  }
  return `<span class="vd-meta-label">Checked ${checked}</span>`;
}

function incentivesMeta(vehicle, isUsed, checked) {
  if (isUsed) return `Checked ${checked}`;
  const cardTexts = vehicle.incentives.cards.map(c => c.text).join(' ');
  const end = shortEndDate(cardTexts) || shortEndDate(`Ends ${vehicle.incentives.rows[0]?.ends || ''}`);
  return end ? `${vehicle.modelYear} models · ${end}` : `${vehicle.modelYear} models · Checked ${checked}`;
}

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
  const brandName = makeNames.find(entry => name.startsWith(`${entry} `) || name === entry) ?? short;
  const isUsed = vehicle.pay.base === 'asking';
  const ask = '<a class="vd-link" href="/schedule.html">Ask us</a>';
  const sourceMark = (source, eager = false) => sourceLogos[source] ? mark(sourceLogos[source], { alt: source, eager }) : source;
  const picture = (image, widths, sizes, priority) => `<picture>${['avif', 'webp'].map(type => `<source type="image/${type}" srcset="${widths.map(width => `/assets/external/optimized/${image.file}-${width}.${type} ${width}w`).join(', ')}" sizes="${sizes}">`).join('')}<img src="/assets/external/source/${image.file}-original.jpg" alt="${image.alt}" width="${image.width}" height="${image.height}" decoding="async"${priority ? ' fetchpriority="high"' : ' loading="lazy"'}></picture>`;
  const credit = (label, image) => `<li>${label}: <a href="${image.sourceUrl}" rel="noopener">${image.author}</a>, ${image.licenseUrl ? `<a href="${image.licenseUrl}" rel="noopener">${image.license}</a>` : image.license}${image.note ? `, ${image.note}` : ''}</li>`;

  const text = {
    crumb: `${name} price`,
    payHeading: 'What to pay at dealerships',
    trimsTab: 'Trims &amp; Our Pick',
    trimsHeading: defaultTrimsHeading(vehicle),
    trimsCaption: `${vehicle.modelYear} ${name} starting MSRP by trim, checked ${checked}`,
    trimsColumn: 'Trim &amp; key equipment',
    engineColumn: 'Powertrain',
    pickHeading: 'The trim we’d buy',
    pickPriceNote: 'starting MSRP',
    incentivesTab: 'Current offers',
    incentivesHeading: `Current ${brandName} offers`,
    incentivesMore: 'All regional offers &amp; end dates',
    incentivesCaption: `Manufacturer offers on the ${name}, checked ${checked}`,
    incentivesColumns: ['Offer', 'What it is', 'Applies to', 'Ends'],
    conditionTab: 'New vs. Used vs. CPO',
    conditionHeading: 'New, used or CPO?',
    negotiate: `Yes. Steer Me Right charges a flat $395 for one model or $695 for up to three. We find it in dealer stock, get written out-the-door offers and negotiate for a price below MSRP. We can’t promise a specific discount: the market for a given car sets what a dealer will do.`,
    related: '<a href="/new-car-buying-service.html">new car buying service</a>, <a href="/blog-buy-new-car-below-msrp.html">comparing complete new-car quotes</a> and <a href="/car-negotiation-service.html">car negotiation service</a>',
    ...vehicle.labels,
  };

  const allPhotos = [vehicle.photo, ...vehicle.gallery];
  const pickRow = vehicle.trims.rows.find(row => row.pick) ?? vehicle.trims.rows.find(row => typeof row.prices[0] === 'number');
  const numericFirstPrices = vehicle.trims.rows.map(row => row.prices[0]).filter(p => typeof p === 'number' && p > 0);
  const topPrice = Math.max(...numericFirstPrices);
  const lowPrice = Math.min(...numericFirstPrices);
  const walk = vehicle.pay.walk;
  const afterText = (vehicle.trims.after ?? []).join(' ');
  const destMatch = afterText.match(/(?:Add\s+\$([\d,]+)\s+for\s+destination|Destination\s+is\s+\$([\d,]+))/i);
  const destination = isUsed ? 0 : Number((destMatch?.[1] || destMatch?.[2] || '0').replaceAll(',', ''));

  // KPI summary values from governed data
  const trimsLabel = vehicle.glance.find(tile => tile.section === 'trims')?.label ?? 'Starting MSRP';
  const kpiDeal = vehicle.glance.find(tile => tile.section === 'pay')?.value ?? '1–2% under MSRP';
  const pickDealRow = matchTrimDealRow(pickRow, vehicle.pay.rows);
  const strongShort = pickDealRow.strong === 'Any discount'
    ? 'Any discount strong'
    : `${pickDealRow.strong.replace(/\s+under$/i, '')} strong`;
  const kpiDealSub = `${pickDealRow.fair === 'MSRP' ? 'MSRP target' : 'Fair target'} · ${strongShort}`;
  const kpiOffer = vehicle.glance.find(tile => tile.section === 'incentives')?.value ?? '';
  const kpiOfferSub = offerSub(vehicle, isUsed);
  const kpiPickLabel = vehicle.glance.find(tile => tile.section === 'pick')?.label ?? 'Our pick';
  const kpiPick = vehicle.pick.trim;
  const kpiCond = vehicle.glance.find(tile => tile.section === 'new-used')?.value ?? 'Buy new';

  // Safety helpers
  const safetyLogo = /IIHS/.test(vehicle.safety.label) ? 'iihs-hldi' : 'nhtsa';
  const safetySources = [
    ...(/NHTSA/.test(vehicle.safety.label) || vehicle.safety.rows.some(row => row.stars) ? ['nhtsa'] : []),
    ...(safetyLogo === 'iihs-hldi' || vehicle.safety.rows.some(row => row.grade) ? ['iihs-hldi'] : []),
  ];
  const starsHtml = n => `<span class="vd-stars" role="img" aria-label="${n} out of 5 stars" style="--n:${n}"></span>`;
  const tallyHtml = vehicle.safety.outOf
    ? `<span class="vd-tally" role="img" aria-label="${vehicle.safety.overall} of ${vehicle.safety.outOf} rated Good">${Array.from({ length: vehicle.safety.outOf }, (_, i) => `<i${i < vehicle.safety.overall ? ' class="on"' : ''}></i>`).join('')}</span>`
    : '';
  const safetyOverallLabel = vehicle.safety.outOf
    ? `${vehicle.safety.overall}/${vehicle.safety.outOf} ${vehicle.safety.label}`
    : `${vehicle.safety.overall}/5 ${vehicle.safety.label}`;
  const safetyOverallMark = vehicle.safety.outOf ? tallyHtml : starsHtml(vehicle.safety.overall);
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
  const scoredTopics = Object.entries(sentiment.topics)
    .filter(([, figure]) => figure.mentions >= redditMin && figure.net !== null)
    .sort((x, y) => y[1].net - x[1].net);
  const unscoredTopics = Object.entries(sentiment.topics)
    .filter(([, figure]) => figure.mentions > 0 && (figure.mentions < redditMin || figure.net === null))
    .sort((x, y) => y[1].mentions - x[1].mentions);
  const topicRows = [...scoredTopics, ...unscoredTopics];

  const netBar = figure => {
    if (figure.mentions < redditMin || figure.net === null) {
      return '<span class="vd-rd-bar vd-rd-bar--none"><b>Too few to score</b></span>';
    }
    const value = figure.net;
    return `<span class="vd-rd-bar vd-rd-bar--${value >= 0 ? 'pos' : 'neg'}" style="--w:${Math.abs(value)}%"><i aria-hidden="true"></i><b>${value > 0 ? '+' : value < 0 ? '−' : ''}${Math.abs(value)}<span class="sr-only"> net, from ${figure.mentions} mentions</span></b></span>`;
  };
  const themeList = side => Object.entries(sentiment.topics)
    .filter(([topic, figure]) => figure[side] >= 5 && coded.themes?.[topic]?.[side]?.length)
    .sort((x, y) => y[1][side] - x[1][side]).slice(0, 4)
    .map(([topic]) => `<li><b>${sentimentTopics[topic]}.</b> ${coded.themes[topic][side][0]}</li>`).join('');
  const praise = themeList('pos');
  const gripes = themeList('neg');
  const picks = sentiment.picks;
  const enoughPicks = picks.all >= 20;
  const topRivalPick = Object.entries(picks.by).filter(([key]) => key !== sentiment.car).sort((x, y) => y[1] - x[1])[0];
  const cross = sentiment.crossShopped;
  const crossTop = Math.max(...cross.map(item => item.threads), 1);

  // Optional Reddit focus block (e.g., Nissan Rogue Hybrid)
  let focusBlock = '';
  const focusKey = vehicle.reddit?.focus;
  if (focusKey) {
    const focus = coded.focus?.[focusKey];
    if (!focus) throw new Error(`${coded.car.key}.json has no focus "${focusKey}"`);
    const ids = new Set(focus.threads);
    const threads = coded.threads.filter(entry => ids.has(entry.id));
    if (threads.length !== ids.size) throw new Error(`${coded.car.key}.json focus "${focusKey}" lists threads the file doesn’t have`);
    const sub = summarizeCar({ ...coded, threads, comments: coded.comments.filter(comment => ids.has(comment.thread)) });
    const dates = threads.map(entry => entry.created).sort();
    const focusRows = Object.entries(sub.topics).filter(([, figure]) => figure.mentions >= redditMin).sort((x, y) => y[1].net - x[1].net);
    const focusNotes = side => Object.entries(sub.topics)
      .filter(([topic, figure]) => figure[side] >= 5 && focus.themes?.[topic]?.[side]?.length)
      .sort((x, y) => y[1][side] - x[1][side]).slice(0, 3)
      .map(([topic]) => `<li><b>${sentimentTopics[topic]}.</b> ${focus.themes[topic][side][0]}</li>`).join('');
    focusBlock = `<section id="reddit-focus" class="vd-rd-focus">
      <h3>The ${focus.name} on Reddit</h3>
      <p class="vd-rd-focus__intro">${count(sub.threads)} threads and ${count(sub.comments)} comments about ${focus.scope}, ${monthYear(dates[0])} to ${monthYear(dates.at(-1))}.</p>
      <div class="vd-rd-focus__grid">
        <div class="vd-rd-stat" style="background:var(--paper);">
          <p class="vd-rd-stat__label">Sentiment in these threads</p>
          <p class="vp-rd-big">${sub.index}<small> / 100</small></p>
          <div class="vd-rd-scale" aria-hidden="true"><i style="--w:${sub.index}%"></i></div>
          <p class="vd-rd-sub">Against ${sentiment.index} across every ${short} thread (${count(sub.opinions)} opinions).</p>
        </div>
        <ul class="vd-rd-net" role="list">
          ${focusRows.map(([topic, figure]) => `<li><span class="vd-rd-net__label">${sentimentTopics[topic]}<small>${count(figure.mentions)} mentions</small></span>${netBar(figure)}</li>`).join('\n          ')}
        </ul>
      </div>
      <div class="vd-rd-themes">
        <div class="vd-rd-theme-box"><h3>What they like</h3><ul role="list">${focusNotes('pos')}</ul></div>
        <div class="vd-rd-theme-box vd-rd-theme-box--neg"><h3>What worries them</h3><ul role="list">${focusNotes('neg')}</ul></div>
      </div>
    </section>`;
  }

  // Incentives loan rate comparison — compact visual table showing total cost vs. average loan.
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
    const topCreditMatch = choice.text.match(/(\d+\.\d+%)\s+top[- ]credit|top[- ]credit[^.]*?(\d+\.\d+%)/i);
    const bankRate = topCreditMatch?.[1] || topCreditMatch?.[2] || null;
    const tipText = bankRate
      ? `Top-credit buyers averaged ${bankRate} — check your bank’s rate too.`
      : choice.text.replace(/\bsaved\b/gi, 'less');
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
<p class="vd-rate-box__tip">${tipText}</p>
</div>`;
  }

  // Dynamic trims classification for powertrain filter (shown only when > 1 group on new cars)
  const trimGroups = new Map();
  const trimGroupList = vehicle.trims.rows.map(row => {
    const group = classifyTrimPowertrain(row);
    trimGroups.set(group.key, { label: group.label, count: (trimGroups.get(group.key)?.count ?? 0) + 1 });
    return group.key;
  });
  const showTrimFilter = !isUsed && trimGroups.size > 1;

  // Calculator initial option & multi-step cash back (e.g., Ford F-150)
  const pricedTrims = vehicle.trims.rows.filter(row => typeof row.prices[0] === 'number' && row.prices[0] > 0);
  const matchesWalkTitle = trim => new RegExp(`\\b${trim.name.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&')}\\b`, 'i').test(walk.title);
  const walkTrim = (pickRow && matchesWalkTitle(pickRow) ? pickRow : pricedTrims.find(matchesWalkTitle)) ?? pickRow;
  const extraCash = walk.steps.slice(1).reduce((sum, step) => sum + step.amount, 0);
  const hasConfigWalk = !isUsed && walk.sticker !== walkTrim.prices[0] + destination;
  const configTitle = walk.title
    .replace(/^What that looks like on an?\s+/i, '')
    .replace(new RegExp(`^${vehicle.modelYear}\\s+`, 'i'), '')
    .trim();
  const defaultStickerLabel = isUsed ? 'Typical asking price' : 'Sticker with destination';
  const walkDealRow = matchTrimDealRow(walkTrim, vehicle.pay.rows);
  const calcOptions = pricedTrims.flatMap(trim => {
    const row = matchTrimDealRow(trim, vehicle.pay.rows);
    const fairPct = midpointPct(row.fair);
    const strongPct = midpointPct(row.strong);
    const optCash = extraCash > 0 && trim === walkTrim ? extraCash : 0;
    const optLabel = /^(20\d{2})\b/.test(trim.name)
      ? `${trim.name} (${dollars(trim.prices[0])})`
      : `${vehicle.modelYear} ${trim.name} (${dollars(trim.prices[0])})`;
    const isWorkedTrim = !hasConfigWalk && trim === walkTrim;
    const baseOpt = {
      value: trim.name,
      msrp: trim.prices[0],
      fairPct,
      strongPct,
      extraCash: optCash,
      stickerLabel: isWorkedTrim ? walk.stickerLabel : defaultStickerLabel,
      label: optLabel,
      selected: isWorkedTrim,
    };
    if (hasConfigWalk && trim === walkTrim) {
      const configMsrp = walk.sticker - destination;
      return [
        baseOpt,
        {
          value: configTitle,
          msrp: configMsrp,
          fairPct: midpointPct(walkDealRow.fair),
          strongPct: midpointPct(walkDealRow.strong),
          extraCash,
          stickerLabel: walk.stickerLabel,
          label: `${vehicle.modelYear} ${configTitle} (${dollars(configMsrp)})`,
          selected: true,
        },
      ];
    }
    return [baseOpt];
  });
  const selectedCalcOpt = calcOptions.find(opt => opt.selected) ?? calcOptions[0];
  const initialSticker = selectedCalcOpt.msrp + destination;
  const initialFairPct = selectedCalcOpt.fairPct;
  const initialDisc = Math.round(initialSticker * (initialFairPct / 100) / 5) * 5;
  const initialExtraCash = selectedCalcOpt.extraCash;
  const initialTotal = initialSticker - initialDisc - initialExtraCash;
  const initialTotalOff = initialSticker - initialTotal;
  const calcBase = vehicle.pay.base ?? 'sticker';
  const calcUnderLabel = walk.under ?? 'under sticker';
  const initialDiscLabel = initialFairPct > 0
    ? `Dealer discount, ${initialFairPct}%`
    : `Dealer discount (${calcBase})`;
  const initialUnderText = initialTotalOff > 0
    ? `${dollars(initialTotalOff)} ${calcUnderLabel}`
    : isUsed
      ? 'Pay asking price, no markup'
      : 'Pay MSRP, no markup';

  // Reviews & Reddit Row B cards (honors vehicle.reddit.first)
  const reviewsCard = `<section id="reviews" class="vd-card vd-col-5">
        <div class="vd-card__head">
          <h2>How well reviewed it is</h2>
          <span class="vd-card__eyebrow">${vehicle.scores.cards.length} major outlets</span>
        </div>
        ${vehicle.scores.intro ? `<p class="vd-note" style="margin-top:0;margin-bottom:12px;">${vehicle.scores.intro}</p>` : ''}
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
            <div class="vd-safety-mini__logos">${safetySources.map(s => mark(s, { eager: false })).join('')}</div>
            <div>
              <p class="vd-safety-mini__title">${safetyOverallLabel}</p>
              ${safetyOverallMark}
              <p class="vd-safety-mini__sub">${vehicle.safety.vehicle}</p>
            </div>
          </div>
          <a class="vd-link" href="#safety" style="font-size:13px;font-weight:600;white-space:nowrap;">Full report</a>
        </div>
        <p class="vd-note">${vehicle.scores.note}</p>
      </section>`;

  const redditCard = `<div class="vd-card vd-col-7" data-vd-subtabs>
        <section id="reddit" class="vp-section">
          <div class="vd-card__head">
            <div class="vd-card__title">
              <h2>Reddit sentiment</h2>
              ${vehicle.reddit?.strip
                ? `<span class="vd-rd-header-logo">${mark('reddit', { alt: 'Reddit Sentiment Index' })}</span><span class="vp-strip__score">${sentiment.index}<small>/100</small></span>`
                : `<span class="vd-rd-header-logo">${mark('reddit', { alt: 'Reddit' })}</span>`}
            </div>
            <span class="vd-meta-label">${count(sentiment.comments)} comments · ${count(sentiment.threads)} threads</span>
          </div>

          <div class="vd-rd-metrics">
            <div class="vd-rd-stat">
              <p class="vd-rd-stat__label">Reddit Sentiment Index</p>
              <p class="vp-rd-big">${sentiment.index}<small> / 100</small></p>
              <div class="vd-rd-scale" aria-hidden="true"><i style="--w:${sentiment.index}%"></i></div>
              <p class="vd-rd-ends" aria-hidden="true"><span>Negative</span><span>50 = even</span><span>Positive</span></p>
              <p class="vd-rd-sub">${homeText}: <strong>${sentiment.venues.home.index ?? 'too few to score'}</strong> · Rest of Reddit: <strong>${sentiment.venues.neutral.index ?? 'too few to score'}</strong> (${count(sentiment.opinions)} opinions)</p>
            </div>
            <div class="vd-rd-stat">
              <p class="vd-rd-stat__label">Picked when cross-shopped</p>
              ${enoughPicks
                ? `<p class="vp-rd-big">${picks.share}%</p>
              <div class="vd-rd-scale vd-rd-scale--plain" aria-hidden="true"><i style="--w:${picks.share}%"></i></div>
              <p class="vd-rd-sub">${count(picks.car)} of ${count(picks.all)} picks in ${count(picks.threads)} neutral threads.${topRivalPick ? ` Next closest: ${modelName(topRivalPick[0])} (${count(topRivalPick[1])}).` : ''}</p>`
                : `<p class="vp-rd-big">${count(picks.all)}<small> picks</small></p>
              <p class="vd-rd-sub">Too few picks outside ${homeText} to give a share: ${count(picks.car)} of ${count(picks.all)} went to the ${short}.</p>`}
            </div>
          </div>

          ${focusBlock}

          <div class="vd-rd-controls">
            <div class="vd-seg" role="tablist" aria-label="Reddit breakdown views">
              <button type="button" class="vd-seg__btn" role="tab" data-vd-subtab="topics" aria-selected="true">By topic (${topicRows.length})</button>
              ${praise || gripes ? '<button type="button" class="vd-seg__btn" role="tab" data-vd-subtab="themes" aria-selected="false">Praise vs. gripes</button>' : ''}
              ${cross.length ? `<button type="button" class="vd-seg__btn" role="tab" data-vd-subtab="cross" aria-selected="false">Cross-shopped (${cross.length})</button>` : ''}
            </div>
            <span class="vd-card__eyebrow">${monthYear(coded.threadsFrom)} – ${monthYear(coded.threadsTo)}</span>
          </div>

          <div class="vd-rd-panel" data-vd-subpanel="topics" role="tabpanel">
            <ul class="vd-rd-net" role="list">
              ${topicRows.map(([topic, figure]) => `<li><span class="vd-rd-net__label">${sentimentTopics[topic]}<small>${count(figure.mentions)} mentions</small></span>${netBar(figure)}</li>`).join('\n              ')}
              <li class="vd-rd-net__axis" aria-hidden="true"><span></span><span><span>−100 negative</span><span>0 even</span><span>+100 positive</span></span></li>
            </ul>
          </div>

          ${praise || gripes ? `<div class="vd-rd-panel" data-vd-subpanel="themes" role="tabpanel" hidden>
            <div class="vd-rd-themes">
              <div class="vd-rd-theme-box">
                <h3>What owners praise</h3>
                <ul role="list">${praise}</ul>
              </div>
              <div class="vd-rd-theme-box vd-rd-theme-box--neg">
                <h3>What owners complain about</h3>
                <ul role="list">${gripes}</ul>
              </div>
            </div>
          </div>` : ''}

          ${cross.length ? `<div class="vd-rd-panel" data-vd-subpanel="cross" role="tabpanel" hidden>
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
          </div>` : ''}

          <p class="vd-note">Our own reading of public Reddit comments (Arctic Shift archive, collected ${longDate(coded.collected)}), coded to a fixed rubric with ${homeSubs.length > 1 ? 'the car’s own subreddits' : homeText} and neutral subreddits weighted equally. Not a survey; complaints reflect owner reports, not confirmed defects.</p>
        </section>
      </div>`;

  // Spotlight tab (Corolla GR Corolla, Civic Type R, Elantra N, Rogue Hybrid)
  const spot = vehicle.spotlight;
  let spotTabBtn = '';
  let spotPanelHtml = '';
  if (spot) {
    const spotTop = Math.max(...spot.trims.rows.map(row => row.prices[0]));
    spotTabBtn = `\n        <button type="button" class="vd-tab" role="tab" id="tab-${spot.id}" data-vd-tab="${spot.id}" aria-controls="panel-${spot.id}" aria-selected="false">${spot.tab}</button>`;
    spotPanelHtml = `
      <!-- SPOTLIGHT TAB: ${spot.tab} -->
      <div id="panel-${spot.id}" class="vd-tabpanel" role="tabpanel" aria-labelledby="tab-${spot.id}" data-vd-panel="${spot.id}" hidden>
        <section id="${spot.id}" class="vd-spotlight">
          <div class="vd-spotlight__head">
            <h3>${spot.heading}</h3>
            ${spot.intro.map(p => `<p class="vd-spotlight__intro">${p}</p>`).join('\n            ')}
          </div>
          <figure class="vd-spotlight__photo">
            ${picture(spot.photo, [640, 960, 1600], '(max-width: 1120px) 94vw, 780px', false)}
            <figcaption>${spot.photo.caption}</figcaption>
          </figure>
          <ul class="vd-spotlight__stats" role="list">
            ${spot.stats.map(card => `<li class="vd-offer">
              <p class="vd-offer__label">${card.label}</p>
              <p class="vd-offer__big">${card.figure} <span>${card.word}</span></p>
              <p class="vd-offer__text">${card.text}</p>
            </li>`).join('\n            ')}
          </ul>
          <div class="vd-scroll">
            <table class="vd-table vd-table--wide">
              <caption class="sr-only">${spot.trims.caption}, checked ${checked}</caption>
              <thead><tr><th scope="col">Trim</th>${spot.trims.columns.map(col => `<th scope="col">${col}</th>`).join('')}</tr></thead>
              <tbody>
                ${spot.trims.rows.map(row => `<tr>
                  <th scope="row">${row.name}<span class="vd-sub">${row.gets}</span></th>
                  <td class="vd-price-cell"><div class="vd-price-cell__wrap"><span class="vd-price-cell__num">${dollars(row.prices[0])}</span><span class="vd-bar" aria-hidden="true"><span style="--w:${percent(row.prices[0], spotTop)}"></span></span></div></td>
                </tr>`).join('\n                ')}
              </tbody>
            </table>
          </div>
          <div class="vd-spotlight__deal">
            <h4>${spot.pay.tableTitle}</h4>
            ${spot.pay.intro.map(p => `<p class="vd-note" style="margin-top:0;margin-bottom:10px;">${p}</p>`).join('\n            ')}
            <ul class="vd-deal-rows" role="list">
              ${spot.pay.rows.map(row => {
                const exPrice = spot.trims.rows.find(t => t.name === row.example)?.prices[0] ?? spot.trims.rows[0].prices[0];
                return `<li class="vd-deal-row">
                <div class="vd-deal-row__name"><h3>${row.trims}</h3><p>${row.why}</p></div>
                ${formatDealCell('fair', 'Fair deal', row.fair, exPrice, vehicle.pay.base)}
                ${formatDealCell('strong', 'Strong deal', row.strong, exPrice, vehicle.pay.base)}
              </li>`;
              }).join('\n              ')}
            </ul>
          </div>
          <div class="vd-mini-charts${spot.charts.length === 2 ? ' vd-mini-charts--2' : ''}">
            ${spot.charts.map(chart => {
              const maxVal = Math.max(...chart.bars.map(b => b.value), 1);
              return `<section class="vd-mini-chart">
              <h3>${chart.title}</h3>
              <ul class="vd-bars" role="list">
                ${chart.bars.map(bar => `<li><span>${bar.label}</span><span class="vd-bars__val">${bar.display ?? bar.value}</span><span class="vd-bar" aria-hidden="true"><span style="--w:${percent(bar.value, maxVal)}"></span></span></li>`).join('\n                ')}
              </ul>
              <p class="vd-note" style="margin-top:8px;">Source: ${chart.source}</p>
            </section>`;
            }).join('\n            ')}
          </div>
          ${spot.after.map(p => `<p class="vd-note" style="margin-top:0;">${p}</p>`).join('\n          ')}
        </section>
      </div>`;
  }

  // Rivals content
  const rivalsContent = vehicle.rivals.cars.length < 2
    ? `<p class="vd-take-bar">${vehicle.rivals.note}</p>
        <p class="vd-note">Torn between two or three? <a href="#plans">Steer Me Right Pro</a> prices up to three models side by side and gives you our pick.</p>`
    : (() => {
        const rivalRows = [{ ...vehicle.rivals.self, self: true }, ...vehicle.rivals.cars];
        const rivalTop = Math.max(...rivalRows.map(row => row.price), 1);
        const priceLabel = vehicle.rivals.priceLabel ?? 'Starting MSRP';
        const statLabel = vehicle.rivals.statLabel;
        return `<div class="vd-scroll">
          <table class="vd-table vd-table--wide">
            <caption class="sr-only">${name} and its rivals: ${statLabel ? `${statLabel.toLowerCase()} and ` : ''}${priceLabel.toLowerCase()}</caption>
            <thead><tr><th scope="col">Model</th>${statLabel ? `<th scope="col">${statLabel}</th>` : ''}<th scope="col">${priceLabel}</th></tr></thead>
            <tbody>
              ${rivalRows.map(row => {
                const rowMake = makeOf(row.self ? name : row.name);
                const badge = rowMake ? mark(rowMake, { alt: '' }) : `<span class="vd-rival-mono" aria-hidden="true">${row.name[0]}</span>`;
                const title = row.href ? `<a class="vd-link" href="${row.href}">${row.name}</a>` : row.name;
                return `<tr>
                <th scope="row">
                  <div class="vd-rival-name">
                    <span class="vd-rival-badge">${badge}</span>
                    <span>${title}${row.self ? ' <span class="vd-inline-label">This guide</span>' : ''}<span class="vd-sub">${row.text}</span></span>
                  </div>
                </th>
                ${statLabel ? `<td class="vd-rival-stat">${row.stat ?? '–'}</td>` : ''}
                <td class="vd-price-cell"><div class="vd-price-cell__wrap"><span class="vd-price-cell__num">${dollars(row.price)}</span><span class="vd-bar" aria-hidden="true"><span style="--w:${percent(row.price, rivalTop)}"></span></span></div></td>
              </tr>`;
              }).join('\n              ')}
            </tbody>
          </table>
        </div>
        <p class="vd-note">${vehicle.rivals.note ? `${vehicle.rivals.note} ` : ''}Torn between two or three? <a href="#plans">Steer Me Right Pro</a> prices up to three models side by side and gives you our pick.</p>`;
      })();

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
    [`Can you negotiate a ${vehicle.labels?.negotiateName ?? name} for me?`, text.negotiate],
    ['Do dealers pay you?', 'No. Dealers and lenders pay us nothing. You pay the flat fee, and you’re the only one we work for.'],
    ['What if I change my mind?', 'Cancel before negotiations begin and you get a full refund. During negotiations, refund eligibility depends on the work already done. Read the <a href="/policy.html#refund-policy">refund policy</a>.'],
  ];

  const creditPhotos = spot ? [...vehicle.gallery, spot.photo] : vehicle.gallery;

  const body = `<article class="vd" data-vehicle-dashboard>
  <header class="vd-topbar">
    <div class="vd-wrap">
      <div class="vd-meta">
        <p><a href="/blog.html">Resources</a> / ${text.crumb}</p>
        <p>By <a href="/about.html">Mason</a> · Updated <time datetime="${updated}">${longDate(updated)}</time></p>
      </div>
      <div class="vd-title-row">
        <div class="vd-title-main">
          ${make ? `<span class="vd-make-mark">${mark(make, { alt: '', eager: true })}</span>` : ''}
          <div>
            <h1>${vehicle.h1}</h1>
            <p class="vd-title-sub">${isUsed ? `Used ${name}` : `${vehicle.modelYear} ${name}`} buyer dashboard · Reviews, Reddit sentiment, and ${isUsed ? 'asking-price' : 'dealer'} targets</p>
          </div>
        </div>
        <div class="vd-title-actions">
          <a class="vd-btn" href="#plans">Let us negotiate it · $395</a>
          <p class="vd-fine">Dealers and lenders pay us nothing.</p>
        </div>
      </div>
      <nav class="vd-kpis" aria-label="${name} key metrics">
        <a class="vd-kpi" href="#trims">
          <span class="vd-kpi__label">${trimsLabel}</span>
          <span class="vd-kpi__value">${dollars(lowPrice)}–${dollars(topPrice)}</span>
          <span class="vd-kpi__sub">${isUsed ? `${vehicle.trims.rows.length} model years · Avg. asking` : `${vehicle.trims.rows.length} trims${destination > 0 ? ` · +${dollars(destination)} dest.` : ''}`}</span>
        </a>
        <a class="vd-kpi" href="#pay">
          <span class="vd-kpi__label">Dealer target</span>
          <span class="vd-kpi__value vd-kpi__value--accent">${kpiDeal.replace(/<[^>]+>/g, '')}</span>
          <span class="vd-kpi__sub">${kpiDealSub}</span>
        </a>
        <a class="vd-kpi" href="#incentives">
          <span class="vd-kpi__label">${text.incentivesTab}</span>
          <span class="vd-kpi__value">${kpiOffer.replace(/<[^>]+>/g, '')}</span>
          ${kpiOfferSub ? `<span class="vd-kpi__sub">${kpiOfferSub}</span>` : ''}
        </a>
        <a class="vd-kpi" href="#reddit">
          <span class="vd-kpi__label">Reddit sentiment</span>
          <span class="vd-kpi__value vd-kpi__value--accent">${sentiment.index} / 100</span>
          <span class="vd-kpi__sub">${count(sentiment.comments)} comments · ${enoughPicks ? `${picks.share}% pick` : `${count(picks.all)} picks`}</span>
        </a>
        <a class="vd-kpi" href="#pick">
          <span class="vd-kpi__label">${kpiPickLabel}</span>
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
          <span class="vd-meta-label vd-meta-label--accent">${kpiCond}</span>
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
          <a class="vd-btn vd-btn--ghost" href="#trims">${isUsed ? 'Compare model years' : 'Compare trims'}</a>
        </div>
      </section>
    </div>

    <!-- ROW B: Expert Review Scores + Reddit Sentiment Pulse -->
    <div class="vd-grid">
      ${vehicle.reddit?.first ? `${redditCard}\n      ${reviewsCard}` : `${reviewsCard}\n      ${redditCard}`}
    </div>

    <!-- ROW C: Dealership Deals & Target Price + Current Offers -->
    <div class="vd-grid">
      <section id="pay" class="vd-card vd-col-7">
        <div class="vd-card__head">
          <h2>${text.payHeading}</h2>
          ${supplyEyebrow(vehicle, checked)}
        </div>

        <ul class="vd-deal-rows" role="list">
          ${vehicle.pay.rows.map(row => {
            const exTrim = vehicle.trims.rows.find(trim => trim.name === row.example);
            const examplePrice = typeof exTrim?.prices[0] === 'number' ? exTrim.prices[0] : lowPrice;
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

        <div class="vd-calc" data-vd-calc data-vd-destination="${destination}" data-vd-base="${calcBase}" data-vd-under="${calcUnderLabel}">
          <div class="vd-calc__top">
            <label class="vd-calc__title" for="vd-trim-picker">Estimate your target price</label>
            <div class="vd-calc__controls">
              <select id="vd-trim-picker" class="vd-select" data-vd-trim-select aria-label="Choose a ${short} ${vehicle.labels?.trimsColumn ? vehicle.labels.trimsColumn.toLowerCase() : 'trim'}">
                ${calcOptions.map(opt => `<option value="${opt.value}" data-msrp="${opt.msrp}" data-fair-pct="${opt.fairPct}" data-strong-pct="${opt.strongPct}" data-extra-cash="${opt.extraCash}" data-sticker-label="${opt.stickerLabel}"${opt.selected ? ' selected' : ''}>${opt.label}</option>`).join('\n                ')}
              </select>
              <div class="vd-seg" role="group" aria-label="Target deal tier">
                <button type="button" class="vd-seg__btn" data-vd-tier="fair" aria-pressed="true">Fair deal</button>
                <button type="button" class="vd-seg__btn" data-vd-tier="strong" aria-pressed="false">Strong deal</button>
              </div>
            </div>
          </div>
          <div class="vd-math-grid">
            <div class="vd-math-box">
              <span data-vd-calc-sticker-label>${selectedCalcOpt.stickerLabel}</span>
              <strong data-vd-calc-sticker>${dollars(initialSticker)}</strong>
            </div>
            ${walk.steps.map((step, idx) => `<span class="vd-math-op" aria-hidden="true">−</span>
            <div class="vd-math-box">
              <span${idx === 0 ? ' data-vd-calc-disc-label' : ''}>${idx === 0 ? initialDiscLabel : step.label}</span>
              <strong${idx === 0 ? ' data-vd-calc-disc' : ' data-vd-calc-extra'}><span class="sr-only">minus </span>${dollars(idx === 0 ? initialDisc : step.amount)}</strong>
            </div>`).join('\n            ')}
            <span class="vd-math-op" aria-hidden="true">=</span>
            <div class="vd-math-box vd-math-box--total">
              <span>${walk.totalLabel}</span>
              <strong data-vd-calc-total>${dollars(initialTotal)}</strong>
              <em data-vd-calc-under>${initialUnderText}</em>
            </div>
          </div>
          <div class="vd-calc-cta">
            <p><strong>Rather not haggle for <span data-vd-calc-cta-total>${dollars(initialTotal)}</span> yourself?</strong> We contact the dealers that have your ${short} in stock and negotiate the price and fees for you. $395 one time, with a full refund if you cancel before negotiations begin.</p>
            <a class="vd-btn" href="/schedule.html#full-service" data-cta-location="vehicle-${vehicle.slug.replace(/-price\.html$/, '')}-calculator">Get my ${short} negotiated</a>
          </div>
        </div>

        <details class="vd-more">
          <summary>How we set these discount targets</summary>
          <div class="vd-more__body">
            ${(vehicle.pay.evidence?.intro ?? []).map(p => `<p style="margin-bottom:8px;">${p}</p>`).join('')}
            ${vehicle.pay.evidence?.rows?.length ? `<ul style="list-style:disc;padding-left:18px;margin-bottom:8px;">${vehicle.pay.evidence.rows.map(r => `<li style="margin-bottom:4px;"><strong>${r.trims}.</strong> ${r.why}</li>`).join('')}</ul>` : ''}
            ${(vehicle.pay.after ?? []).map(p => `<p style="margin-bottom:8px;">${p}</p>`).join('')}
            ${(vehicle.pay.after ?? []).some(p => /hello@steermeright\.com|Talk to Mason/i.test(p)) ? '' : '<p>Have a dealer quote in hand? Email <a class="vd-link" href="mailto:hello@steermeright.com">hello@steermeright.com</a> or use “Talk to Mason” on the <a class="vd-link" href="/schedule.html">pricing page</a> for a free gut check within one business day.</p>'}
          </div>
        </details>
        <p class="vd-note">${vehicle.pay.note} Ranges are our estimate from public market data, not a promise.</p>
      </section>

      <section id="incentives" class="vd-card vd-col-5">
        <div class="vd-card__head">
          <h2>${text.incentivesHeading}</h2>
          <span class="vd-meta-label">${incentivesMeta(vehicle, isUsed, checked)}</span>
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
          <summary>${text.incentivesMore}</summary>
          <div class="vd-more__body vd-scroll">
            <table class="vd-table">
              <caption class="sr-only">${text.incentivesCaption}</caption>
              <thead><tr>${text.incentivesColumns.map(col => `<th scope="col">${col}</th>`).join('')}</tr></thead>
              <tbody>
                ${vehicle.incentives.rows.map(row => `<tr><th scope="row">${row.offer}</th><td>${row.detail}</td><td>${row.applies}</td><td style="white-space:nowrap;">${row.ends || ask}</td></tr>`).join('\n                ')}
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
        <button type="button" class="vd-tab" role="tab" id="tab-trims" data-vd-tab="trims" aria-controls="panel-trims" aria-selected="true">${text.trimsTab}</button>${spotTabBtn}
        <button type="button" class="vd-tab" role="tab" id="tab-new-used" data-vd-tab="new-used" aria-controls="panel-new-used" aria-selected="false">${text.conditionTab}</button>
        <button type="button" class="vd-tab" role="tab" id="tab-rivals" data-vd-tab="rivals" aria-controls="panel-rivals" aria-selected="false">Rivals</button>
        <button type="button" class="vd-tab" role="tab" id="tab-safety" data-vd-tab="safety" aria-controls="panel-safety" aria-selected="false">Safety &amp; Dealer Watch-Outs</button>
        <button type="button" class="vd-tab" role="tab" id="tab-faq" data-vd-tab="faq" aria-controls="panel-faq" aria-selected="false">Common Questions (${faqEntries.length})</button>
      </div>

      <!-- TAB 1: Trims & Our Pick -->
      <div id="panel-trims" class="vd-tabpanel" role="tabpanel" aria-labelledby="tab-trims" data-vd-panel="trims">
        <div id="pick" class="vd-pick-banner">
          <div class="vd-pick-banner__hero">
            <p class="vd-pick-banner__eyebrow">${text.pickHeading}</p>
            <p class="vd-pick-banner__name">${vehicle.pick.trim}</p>
            <p class="vd-pick-banner__price">${vehicle.pick.price ?? dollars(pickRow.prices[0])} <span>${vehicle.pick.priceNote ?? text.pickPriceNote}</span></p>
          </div>
          <ul class="vd-pick-banner__why" role="list">
            ${vehicle.pick.reasons.map(reason => `<li>${tick}<span>${reason}</span></li>`).join('\n            ')}
          </ul>
        </div>
        <div class="vd-alts${vehicle.pick.also.length === 3 ? ' vd-alts--3' : ''}">
          ${vehicle.pick.also.map(alt => `<div class="vd-alt">
            <div class="vd-alt__head">
              <span class="vd-kicker${/^skip/i.test(alt.label) ? ' vd-kicker--warn' : ''}">${alt.label}</span>
              ${alt.price ? `<span class="vd-alt__price">${alt.price}</span>` : ''}
            </div>
            <p style="margin-top:6px;"><strong class="vd-alt__name">${alt.name}</strong> — ${alt.text}</p>
          </div>`).join('\n          ')}
        </div>

        <div id="trims" class="vd-table-head">
          <h3>${text.trimsHeading}</h3>
          ${showTrimFilter ? `<div class="vd-seg" role="group" aria-label="Filter trims by powertrain">
            <button type="button" class="vd-seg__btn" data-vd-trim-filter="all" aria-pressed="true">All (${vehicle.trims.rows.length})</button>
            ${[...trimGroups.entries()].map(([key, grp]) => `<button type="button" class="vd-seg__btn" data-vd-trim-filter="${key}" aria-pressed="false">${grp.label} (${grp.count})</button>`).join('\n            ')}
          </div>` : ''}
        </div>
        <div class="vd-scroll">
          <table class="vd-table vd-table--wide">
            <caption class="sr-only">${text.trimsCaption}</caption>
            <thead><tr><th scope="col">${text.trimsColumn}</th>${vehicle.trims.columns.map(col => `<th scope="col">${col}</th>`).join('')}<th scope="col">${text.engineColumn}</th></tr></thead>
            <tbody>
              ${vehicle.trims.rows.map((trim, idx) => {
                const p0 = trim.prices[0];
                const firstPriceCell = typeof p0 === 'number' && p0 > 0
                  ? `<td class="vd-price-cell"><div class="vd-price-cell__wrap"><span class="vd-price-cell__num">${dollars(p0)}</span><span class="vd-bar" aria-hidden="true"><span style="--w:${percent(p0, topPrice)}"></span></span></div></td>`
                  : `<td class="vd-price-cell"><span style="color:var(--muted);">${p0 || ask}</span></td>`;
                const extraPriceCells = trim.prices.slice(1).map(price => typeof price === 'number' && price > 0
                  ? `<td><strong>${dollars(price)}</strong></td>`
                  : `<td style="color:var(--muted);">${price || ask}</td>`).join('');
                return `<tr${showTrimFilter ? ` data-vd-trim-group="${trimGroupList[idx]}"` : ''}>
                <th scope="row">${trim.name}${trim.pick ? ' <span class="vd-inline-label">Our pick</span>' : ''}<span class="vd-sub">${trim.gets}</span></th>
                ${firstPriceCell}${extraPriceCells}
                <td style="font-size:13px;color:var(--muted);">${trim.engine || ask}</td>
              </tr>`;
              }).join('\n              ')}
            </tbody>
          </table>
        </div>
        <p class="vd-note">${vehicle.trims.after.join(' ')} ${vehicle.pick.text ?? ''}</p>
      </div>${spotPanelHtml}

      <!-- TAB 2: New vs Used vs CPO -->
      <div id="panel-new-used" class="vd-tabpanel" role="tabpanel" aria-labelledby="tab-new-used" data-vd-panel="new-used" hidden>
        <div id="new-used" class="vd-table-head">
          <h3>${text.conditionHeading}</h3>
        </div>
        <div class="vd-take-bar">${vehicle.condition.intro.join(' ')}</div>
        <div class="vd-mini-charts${vehicle.condition.charts.length === 2 ? ' vd-mini-charts--2' : ''}">
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
        ${rivalsContent}
      </div>

      <!-- TAB 4: Safety & Dealer Watch-Outs -->
      <div id="panel-safety" class="vd-tabpanel" role="tabpanel" aria-labelledby="tab-safety" data-vd-panel="safety" hidden>
        <div class="vd-two-col">
          <section id="safety">
            <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;">
              <h3>Safety &amp; NHTSA recalls</h3>
              <div class="vd-safety-mini__logos">${safetySources.map(s => mark(s)).join('')}</div>
            </div>
            <div class="vd-safety-overall-inline">
              <div>
                <strong>${safetyOverallLabel}</strong>
                <span>${vehicle.safety.vehicle}</span>
              </div>
              ${safetyOverallMark}
            </div>
            <dl class="vd-safety-tests">
              ${vehicle.safety.rows.map(row => {
                let markCell;
                if (row.grade) {
                  const gradeCls = row.grade === 'Good'
                    ? ''
                    : row.grade === 'Acceptable'
                      ? ' vd-grade--acceptable'
                      : ' vd-grade--poor';
                  markCell = `<span class="vd-grade${gradeCls}" aria-hidden="true">${row.grade[0]}</span><span>${row.grade}</span>`;
                } else {
                  markCell = `${starsHtml(row.stars)}<span>${row.stars}/5</span>`;
                }
                return `<div><dt>${row.label}</dt><dd>${row.note ? `<span style="font-size:12px;color:var(--muted);">${row.note}</span>` : ''}${markCell}</dd></div>`;
              }).join('\n              ')}
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
            ${[credit('Main photo', vehicle.photo), ...creditPhotos.map(item => credit(item.caption, item))].join('')}
          </ul>
        </details>
      </div>
      <p class="vd-note">Related: ${text.related}.</p>
    </section>
  </div>
</article>`;

  return {
    slug: vehicle.slug,
    title: vehicle.title,
    description: vehicle.description,
    h1: vehicle.h1,
    crumbs: [['Resources', `${origin}/blog.html`], [text.crumb, `${origin}/${vehicle.slug}`]],
    body: body.replace(/[ \t]+$/gm, ''),
  };
}
