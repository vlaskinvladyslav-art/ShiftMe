// ---------- Shift schedule logic ----------
// Reference: Aug 3, 2026 is day 0 of an off-block (3 off, then 3 work, repeating every 6 days).
// The 6-day cycle is continuous, so it naturally extends backward too —
// Aug 1–2, 2026 fall on the tail of the previous work-block and are correctly 'work' days.
const REF_OFF_START = Date.UTC(2026, 7, 3); // Aug 3 2026

function utcDay(y, m, d) { return Date.UTC(y, m, d); }

function getStatus(y, m, d) {
  const t = utcDay(y, m, d);
  const diffDays = Math.round((t - REF_OFF_START) / 86400000);
  const mod = ((diffDays % 6) + 6) % 6;
  return mod < 3 ? 'off' : 'work';
}

const monthNames = ['січня','лютого','березня','квітня','травня','червня','липня','серпня','вересня','жовтня','листопада','грудня'];
const monthNamesNom = ['Січень','Лютий','Березень','Квітень','Травень','Червень','Липень','Серпень','Вересень','Жовтень','Листопад','Грудень'];
const weekdayNames = ['неділю','понеділок','вівторок','середу','четвер','пʼятницю','суботу'];

const now = new Date();
let viewYear = now.getFullYear();
let viewMonth = now.getMonth();

// ---------- Earnings logic ----------
const CORE_PRODUCTS = [
  { code: '3115', rate: 7.47 },
  { code: '4320', rate: 14.10 }
];

const STORAGE_KEY = 'shiftTrackerEarnings';

let earningsData = {};   // { 'YYYY-MM-DD': [{code, qty, rate, amount}, ...] }
let dataReady = false;
let selectedProduct = CORE_PRODUCTS[0].code;
let activeDateKey = null; // date currently open in the modal

// ---------- Products: 2 built-in + any the person adds themselves ----------
// Extra products stay hidden behind a "показати всі" toggle so the modal
// doesn't get cluttered once someone has added a handful of them.
const PRODUCTS_KEY = 'shiftTrackerCustomProducts';
let customProducts = [];        // [{code, rate}]
let showAllProducts = false;    // toggle inside the entry modal (resets each open)
let statsShowAllProducts = false; // toggle inside the "По виробах" stats card

function loadCustomProducts() {
  try {
    const raw = localStorage.getItem(PRODUCTS_KEY);
    customProducts = raw ? JSON.parse(raw) : [];
  } catch (e) {
    customProducts = [];
  }
}
function saveCustomProducts() {
  try {
    localStorage.setItem(PRODUCTS_KEY, JSON.stringify(customProducts));
    return true;
  } catch (e) {
    return false;
  }
}
function deleteCustomProduct(code) {
  // Only removes it from the pick-list for new entries — earnings already
  // logged with this code keep their own stored code/rate regardless.
  customProducts = customProducts.filter(p => p.code !== code);
  saveCustomProducts();
  if (selectedProduct === code) selectedProduct = CORE_PRODUCTS[0].code;
}
function allProducts() { return CORE_PRODUCTS.concat(customProducts); }
function findProduct(code) { return allProducts().find(p => p.code === code); }

function pad(n) { return String(n).padStart(2, '0'); }
function fmtTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return pad(d.getHours()) + ':' + pad(d.getMinutes());
}
function dateKey(y, m, d) { return y + '-' + pad(m + 1) + '-' + pad(d); }
function fmtMoney(v) {
  return v.toLocaleString('uk-UA', { maximumFractionDigits: 2, minimumFractionDigits: v % 1 === 0 ? 0 : 2 }) + ' ₴';
}
function fmtMoneyShort(v) {
  // compact for tiny calendar cells
  if (v >= 1000) return Math.round(v / 100) / 10 + 'к';
  return Math.round(v) + '';
}
function dayTotal(key) {
  const entries = earningsData[key] || [];
  return entries.reduce((s, e) => s + e.amount, 0);
}

// ---------- Animated number helper ----------
// Smoothly counts a displayed value from its previous number to the new
// one instead of just snapping the text, so entering an amount *feels*
// like it lands rather than just appearing.
const animFrames = new WeakMap();
function animateNumber(el, toValue, formatFn) {
  if (!el) return;
  const fromValue = parseFloat(el.dataset.rawValue || '0');
  if (Math.abs(fromValue - toValue) < 0.005) {
    el.dataset.rawValue = toValue;
    el.textContent = formatFn(toValue);
    return;
  }
  if (animFrames.has(el)) cancelAnimationFrame(animFrames.get(el));
  const duration = 500;
  const start = performance.now();
  function step(ts) {
    const t = Math.min(1, (ts - start) / duration);
    const eased = 1 - Math.pow(1 - t, 3);
    const current = fromValue + (toValue - fromValue) * eased;
    el.textContent = formatFn(current);
    if (t < 1) {
      animFrames.set(el, requestAnimationFrame(step));
    } else {
      el.dataset.rawValue = toValue;
      el.textContent = formatFn(toValue);
    }
  }
  animFrames.set(el, requestAnimationFrame(step));
}

// ---------- Persistence ----------
// Earnings are kept in the browser's localStorage, so they survive page
// reloads and browser restarts automatically, with no server needed.
// On top of that, "Експорт JSON" / "Імпорт JSON" let you save a real .json
// backup file to disk (or move your data to another device/browser).
function loadEarnings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    earningsData = raw ? JSON.parse(raw) : {};
  } catch (e) {
    earningsData = {};
  }
  dataReady = true;
}

function saveEarnings() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(earningsData));
    return true;
  } catch (e) {
    return false;
  }
}

function exportData() {
  const blob = new Blob([JSON.stringify(earningsData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'earnings-' + dateKey(now.getFullYear(), now.getMonth(), now.getDate()) + '.json';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  const note = document.getElementById('dataNote');
  note.textContent = 'Файл завантажено';
}

function importDataFromFile(file) {
  const note = document.getElementById('dataNote');
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const parsed = JSON.parse(e.target.result);
      if (typeof parsed !== 'object' || parsed === null) throw new Error('bad shape');
      earningsData = parsed;
      saveEarnings();
      renderToday();
      renderCalendar();
      renderStats();
      renderGoal();
      note.textContent = 'Дані імпортовано';
    } catch (err) {
      note.textContent = 'Помилка: файл не схожий на коректний бекап';
    }
  };
  reader.onerror = () => { note.textContent = 'Не вдалося прочитати файл'; };
  reader.readAsText(file);
}

function renderToday() {
  const y = now.getFullYear(), m = now.getMonth(), d = now.getDate();
  document.getElementById('todayDate').textContent =
    d + ' ' + monthNames[m] + ', ' + weekdayNames[now.getDay()];

  const status = getStatus(y, m, d);
  const card = document.getElementById('statusCard');
  card.className = 'status-card is-' + status;
  document.getElementById('statusValue').textContent = status === 'work' ? 'Робочий день' : 'Вихідний';
  document.getElementById('statusIcon').src = status === 'work' ? 'workDay.png' : 'offDay.png';

  let nd = new Date(Date.UTC(y, m, d));
  let cur = status;
  let steps = 0;
  while (steps < 10) {
    nd = new Date(nd.getTime() + 86400000);
    steps++;
    const s = getStatus(nd.getUTCFullYear(), nd.getUTCMonth(), nd.getUTCDate());
    if (s !== cur) break;
  }
  // Phrased around *what's coming*, not a "current → next" arrow — the
  // label already says what kind of day it is, so the value only needs
  // to answer "when".
  const daysWord = steps === 1 ? 'день' : (steps < 5 ? 'дні' : 'днів');
  const whenText = steps === 1 ? 'завтра' : 'за ' + steps + ' ' + daysWord;
  document.getElementById('statusNextLabel').textContent =
    cur === 'work' ? 'Наступний вихідний' : 'Наступна робоча зміна';
  document.getElementById('statusNextValue').textContent =
    nd.getUTCDate() + ' ' + monthNames[nd.getUTCMonth()] + ' · ' + whenText;

  const strip = document.getElementById('cycleStrip');
  strip.innerHTML = '';
  for (let off = -2; off <= 3; off++) {
    const dt = new Date(Date.UTC(y, m, d) + off * 86400000);
    const s = getStatus(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate());
    const cell = document.createElement('div');
    cell.className = 'cycle-tick ' + s + (off === 0 ? ' current' : '');
    cell.textContent = dt.getUTCDate();
    strip.appendChild(cell);
  }

  const tKey = dateKey(y, m, d);
  const tTotal = dayTotal(tKey);
  const row = document.getElementById('todayEarnRow');
  if (tTotal > 0) {
    row.style.display = 'flex';
    animateNumber(document.getElementById('todayEarnValue'), tTotal, fmtMoney);
  } else {
    row.style.display = 'none';
  }

  const addBtn = document.getElementById('addEarnToday');
  if (status === 'work') {
    addBtn.disabled = false;
    addBtn.textContent = '+ Записати заробіток за сьогодні';
  } else {
    addBtn.disabled = true;
    addBtn.textContent = 'Сьогодні вихідний — запис недоступний';
  }
}

function renderCalendar() {
  document.getElementById('calTitle').textContent = monthNamesNom[viewMonth] + ' ' + viewYear;
  const grid = document.getElementById('calGrid');
  grid.innerHTML = '';

  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const leadingEmpty = (firstDay + 6) % 7;
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  for (let i = 0; i < leadingEmpty; i++) {
    const e = document.createElement('div');
    e.className = 'day-cell empty';
    grid.appendChild(e);
  }

  let monthSum = 0;

  for (let day = 1; day <= daysInMonth; day++) {
    const s = getStatus(viewYear, viewMonth, day);
    const key = dateKey(viewYear, viewMonth, day);
    const total = dayTotal(key);
    monthSum += total;

    const cell = document.createElement('button');
    cell.type = 'button';
    cell.className = 'day-cell ' + s;
    const isToday = viewYear === now.getFullYear() && viewMonth === now.getMonth() && day === now.getDate();
    if (isToday) cell.classList.add('today');

    let inner = day;
    if (total > 0) {
      inner += '<span class="earn-tag">' + fmtMoneyShort(total) + '₴</span>';
    } else {
      inner += '<span class="dot"></span>';
    }
    cell.innerHTML = inner;
    cell.addEventListener('click', () => openModal(viewYear, viewMonth, day));
    grid.appendChild(cell);
  }

  animateNumber(document.getElementById('monthTotal'), monthSum, fmtMoney);
}

// ---------- Statistics ----------
function allDatesSorted() {
  return Object.keys(earningsData).filter(k => dayTotal(k) > 0).sort();
}

function computeRecord() {
  let best = 0, bestKey = null;
  for (const key of Object.keys(earningsData)) {
    const t = dayTotal(key);
    if (t > best) { best = t; bestKey = key; }
  }
  return { amount: best, key: bestKey };
}

function computeAllTimeTotal() {
  let sum = 0;
  for (const key of Object.keys(earningsData)) sum += dayTotal(key);
  return sum;
}

function computeProductTotals() {
  const totals = {};
  for (const key of Object.keys(earningsData)) {
    (earningsData[key] || []).forEach(e => {
      if (!totals[e.code]) totals[e.code] = { qty: 0, amount: 0 };
      totals[e.code].qty += e.qty;
      totals[e.code].amount += e.amount;
    });
  }
  return totals;
}

function last14Days() {
  // Returns [{key, date, total}] for the 14-day window ending today.
  const days = [];
  for (let i = 13; i >= 0; i--) {
    const dt = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    dt.setDate(dt.getDate() - i);
    const key = dateKey(dt.getFullYear(), dt.getMonth(), dt.getDate());
    days.push({ key, date: dt, total: dayTotal(key) });
  }
  return days;
}

// Used for the chart specifically: off days always have 0 earned (nothing
// to earn), so mixing them in made the line dip in a way that had nothing
// to do with performance. This walks backward from today and only keeps
// work days, so the chart reflects actual shifts worked.
function last14WorkDays() {
  const days = [];
  const cursor = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let guard = 0;
  while (days.length < 14 && guard < 120) {
    const y = cursor.getFullYear(), m = cursor.getMonth(), d = cursor.getDate();
    if (getStatus(y, m, d) === 'work') {
      const key = dateKey(y, m, d);
      days.unshift({ key, date: new Date(y, m, d), total: dayTotal(key) });
    }
    cursor.setDate(cursor.getDate() - 1);
    guard++;
  }
  return days;
}

function formatShortDate(dt) {
  return dt.getDate() + ' ' + monthNames[dt.getMonth()];
}

function renderTrendBadge(days) {
  const badge = document.getElementById('trendBadge');
  const todayTotal = days[days.length - 1].total;
  const priorDays = days.slice(0, -1).filter(d => d.total > 0);
  if (todayTotal <= 0 || priorDays.length === 0) {
    badge.style.display = 'none';
    return;
  }
  const avg = priorDays.reduce((s, d) => s + d.total, 0) / priorDays.length;
  const diff = todayTotal - avg;
  const pct = avg > 0 ? Math.round((diff / avg) * 100) : 0;
  badge.style.display = 'inline-flex';
  if (diff >= 0) {
    badge.className = 'trend-badge up';
    badge.textContent = '↑ на ' + Math.abs(pct) + '% більше за середнє';
  } else {
    badge.className = 'trend-badge down';
    badge.textContent = '↓ на ' + Math.abs(pct) + '% менше за середнє';
  }
}

function renderChart(days) {
  const workDays = days.filter(d => d.total > 0);
  const avg = workDays.length ? workDays.reduce((s, d) => s + d.total, 0) / workDays.length : 0;
  document.getElementById('chartAvgLabel').textContent = 'сер. ' + fmtMoney(Math.round(avg));

  const w = 320, h = 130, padL = 4, padR = 4, padT = 14, padB = 18;
  const innerW = w - padL - padR;
  const innerH = h - padT - padB;
  const maxVal = Math.max(...days.map(d => d.total), avg, 1) * 1.15;

  const stepX = innerW / (days.length - 1);
  const xAt = (i) => padL + i * stepX;
  const yAt = (v) => padT + innerH - (v / maxVal) * innerH;

  const linePts = days.map((d, i) => xAt(i) + ',' + yAt(d.total).toFixed(1)).join(' ');
  const avgY = yAt(avg).toFixed(1);

  let dots = '';
  let labels = '';
  const todayKeyStr = dateKey(now.getFullYear(), now.getMonth(), now.getDate());
  days.forEach((d, i) => {
    const x = xAt(i), y = yAt(d.total);
    const isToday = d.key === todayKeyStr;
    const above = d.total >= avg;
    const color = d.total === 0 ? 'var(--line)' : (above ? 'var(--off)' : 'var(--work)');
    const r = isToday ? 4.5 : 3;
    dots += '<circle class="chart-dot" cx="' + x + '" cy="' + y.toFixed(1) + '" r="' + r + '" fill="' + color + '"' +
      (isToday ? ' stroke="var(--today-ring)" stroke-width="2"' : '') + '></circle>';
    if (i % 2 === 0 || isToday) {
      labels += '<text x="' + x + '" y="' + (h - 4) + '" text-anchor="middle" class="chart-day-label">' + d.date.getDate() + '</text>';
    }
  });

  const svg =
    '<svg viewBox="0 0 ' + w + ' ' + h + '" width="100%" height="' + h + '" xmlns="http://www.w3.org/2000/svg">' +
    '<line x1="' + padL + '" y1="' + avgY + '" x2="' + (w - padR) + '" y2="' + avgY + '" stroke="var(--muted)" stroke-width="1" stroke-dasharray="4 4" opacity="0.5"></line>' +
    '<polyline id="earningsPolyline" class="chart-line-path" points="' + linePts + '" fill="none" stroke="var(--money)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"></polyline>' +
    dots + labels +
    '</svg>';

  document.getElementById('earningsChart').innerHTML = svg;
  requestAnimationFrame(() => {
    const card = document.querySelector('.chart-card');
    if (card && isInViewport(card)) playChartAnimation();
  });
}

// Draws the earnings line in stroke-by-stroke and pops each dot in,
// either right away (if already on screen) or the moment it scrolls
// into view — set up once via IntersectionObserver below.
function isInViewport(el) {
  const r = el.getBoundingClientRect();
  return r.top < window.innerHeight * 0.92 && r.bottom > 0;
}

function playChartAnimation() {
  const poly = document.getElementById('earningsPolyline');
  if (poly && poly.getTotalLength) {
    const length = poly.getTotalLength();
    poly.style.transition = 'none';
    poly.style.strokeDasharray = length;
    poly.style.strokeDashoffset = length;
    poly.getBoundingClientRect(); // force reflow
    poly.style.transition = 'stroke-dashoffset 0.9s cubic-bezier(0.22, 0.9, 0.32, 1)';
    poly.style.strokeDashoffset = '0';
  }
  document.querySelectorAll('.chart-dot').forEach((dot, i) => {
    setTimeout(() => {
      dot.style.transition = 'opacity 0.35s ease, transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)';
      dot.style.opacity = '1';
      dot.style.transform = 'scale(1)';
    }, 500 + i * 35);
  });
}

let chartObserver;
function setupChartObserver() {
  if (chartObserver) return;
  const card = document.querySelector('.chart-card');
  if (!card) return;
  chartObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) playChartAnimation();
    });
  }, { threshold: 0.35 });
  chartObserver.observe(card);
}

function productStatRowHtml(t) {
  const pct = t.pct;
  return (
    '<div class="product-stat-row">' +
      '<div class="product-stat-top">' +
        '<span class="code">' + t.code + '</span>' +
        '<span class="qty">' + t.qty.toLocaleString('uk-UA') + ' шт</span>' +
        '<span class="amt">' + fmtMoney(t.amount) + '</span>' +
      '</div>' +
      '<div class="product-bar-track"><div class="product-bar-fill" style="width:' + pct + '%"></div></div>' +
    '</div>'
  );
}

function renderProductStats() {
  const totals = computeProductTotals();
  const wrap = document.getElementById('productStats');
  const grandTotal = Object.values(totals).reduce((s, t) => s + t.amount, 0);

  if (grandTotal === 0) {
    wrap.innerHTML = '<p class="stats-empty">Ще немає жодного запису</p>';
    return;
  }

  const withPct = (code) => {
    const t = totals[code] || { qty: 0, amount: 0 };
    const pct = grandTotal > 0 ? Math.round((t.amount / grandTotal) * 100) : 0;
    return { code, qty: t.qty, amount: t.amount, pct };
  };

  const core = CORE_PRODUCTS.map(p => withPct(p.code));
  const extraUsed = customProducts
    .map(p => withPct(p.code))
    .filter(p => p.amount > 0)
    .sort((a, b) => b.amount - a.amount);

  const visible = statsShowAllProducts ? core.concat(extraUsed) : core;
  const hiddenCount = statsShowAllProducts ? 0 : extraUsed.length;

  wrap.innerHTML = visible.map(productStatRowHtml).join('') +
    (hiddenCount > 0 ? '<button type="button" class="product-stats-toggle" id="productStatsToggle">Показати ще ' + hiddenCount + '</button>' : '');

  const toggleBtn = document.getElementById('productStatsToggle');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => { statsShowAllProducts = true; renderProductStats(); });
  }
}

function renderStats() {
  animateNumber(document.getElementById('statAllTime'), computeAllTimeTotal(), fmtMoney);

  const record = computeRecord();
  document.getElementById('statRecord').textContent = fmtMoney(record.amount);
  document.getElementById('statRecordDate').textContent = record.key
    ? formatShortDate(new Date(record.key + 'T00:00:00'))
    : '—';

  renderTrendBadge(last14Days());
  renderChart(last14WorkDays());
  renderProductStats();
}

// ---------- Monthly income goal ----------
const GOALS_KEY = 'shiftTrackerGoals';
let goalsData = {};
let goalEditing = false;

function loadGoals() {
  try {
    const raw = localStorage.getItem(GOALS_KEY);
    goalsData = raw ? JSON.parse(raw) : {};
  } catch (e) {
    goalsData = {};
  }
}
function saveGoals() {
  try {
    localStorage.setItem(GOALS_KEY, JSON.stringify(goalsData));
    return true;
  } catch (e) {
    return false;
  }
}
function currentMonthKey() { return now.getFullYear() + '-' + pad(now.getMonth() + 1); }

function countWorkDaysInMonth(y, m) {
  const days = new Date(y, m + 1, 0).getDate();
  let count = 0;
  for (let d = 1; d <= days; d++) if (getStatus(y, m, d) === 'work') count++;
  return count;
}
function monthEarnedSoFar(y, m) {
  const days = new Date(y, m + 1, 0).getDate();
  let sum = 0;
  for (let d = 1; d <= days; d++) sum += dayTotal(dateKey(y, m, d));
  return sum;
}

// The core "compensation" logic: whatever is left of the goal gets spread
// evenly across the work days still ahead (today included). Fall behind
// one day, and the split over the remaining days quietly grows to catch up.
function computeGoalPlan() {
  const mk = currentMonthKey();
  const goal = goalsData[mk];
  if (!(goal > 0)) return null;

  const y = now.getFullYear(), m = now.getMonth(), today = now.getDate();
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const totalWorkDays = countWorkDaysInMonth(y, m);
  const earned = monthEarnedSoFar(y, m);
  const remaining = Math.max(0, goal - earned);
  const reached = earned >= goal;

  // Two counts: every remaining work day (used to know if the month is
  // simply over), and only the ones that are still genuinely "open" — no
  // earnings recorded for them yet. Today always counts as open even if
  // it already has something logged, since the shift isn't over yet.
  // Splitting the remaining amount only across open days is what makes
  // the compensation logic correct: a day that already has money on it
  // shouldn't also get a slice of what's still owed.
  let trueWorkDaysLeft = 0;
  let openWorkDaysLeft = 0;
  for (let d = today; d <= daysInMonth; d++) {
    if (getStatus(y, m, d) !== 'work') continue;
    trueWorkDaysLeft++;
    if (d === today || dayTotal(dateKey(y, m, d)) === 0) openWorkDaysLeft++;
  }
  const workDaysLeft = openWorkDaysLeft > 0 ? openWorkDaysLeft : trueWorkDaysLeft;

  const perDayTarget = workDaysLeft > 0 ? remaining / workDaysLeft : 0;
  const todayIsWork = getStatus(y, m, today) === 'work';
  const progressPct = goal > 0 ? Math.min(100, (earned / goal) * 100) : 0;

  return { goal, earned, remaining, totalWorkDays, workDaysLeft, trueWorkDaysLeft, perDayTarget, todayIsWork, reached, progressPct, y, m, today, daysInMonth };
}

function partsForAmount(amount) {
  return CORE_PRODUCTS.map(p => ({ code: p.code, qty: Math.ceil(amount / p.rate) }));
}

function renderGoal() {
  const card = document.getElementById('goalCard');
  const plan = computeGoalPlan();

  if (!plan || goalEditing) {
    card.dataset.state = plan ? 'editing' : 'setup';
    document.getElementById('goalSetupIcon').style.display = plan ? 'none' : '';
    document.getElementById('goalSetupTitle').textContent = plan
      ? 'Змінити ціль на ' + monthNames[now.getMonth()]
      : 'Встанови ціль на місяць';
    document.getElementById('goalSetupSub').style.display = plan ? 'none' : '';
    document.getElementById('goalInput').value = plan ? plan.goal : '';
    return;
  }

  document.getElementById('goalMonthName').textContent = monthNames[now.getMonth()];
  document.getElementById('goalFill').classList.toggle('reached', plan.reached);
  requestAnimationFrame(() => {
    document.getElementById('goalFill').style.width = plan.progressPct + '%';
  });
  animateNumber(document.getElementById('goalEarned'), plan.earned, fmtMoney);
  document.getElementById('goalTargetLabel').textContent = fmtMoney(plan.goal);
  document.getElementById('goalPct').textContent = Math.round(plan.progressPct) + '%';

  if (plan.reached) {
    card.dataset.state = 'reached';
    document.getElementById('goalReachedMsg').textContent =
      '🎉 Ціль досягнута! Понад план: +' + fmtMoney(plan.earned - plan.goal);
  } else if (plan.trueWorkDaysLeft === 0) {
    card.dataset.state = 'no-shifts';
  } else {
    card.dataset.state = 'normal';

    const todayBox = document.getElementById('goalTodayBox');
    const valueEl = document.getElementById('goalTodayValue');
    todayBox.classList.toggle('next-shift', !plan.todayIsWork);
    valueEl.classList.toggle('next-shift', !plan.todayIsWork);
    document.getElementById('goalTodayLabel').textContent =
      'Потрібно ' + (plan.todayIsWork ? 'сьогодні' : 'у наступну зміну');
    valueEl.textContent = fmtMoney(Math.round(plan.perDayTarget));

    const parts = partsForAmount(plan.perDayTarget);
    document.getElementById('goalPartsRow').innerHTML = parts.map(p =>
      '<div class="goal-part-chip"><b>' + p.qty + '</b><span>шт (' + p.code + ')</span></div>'
    ).join('<span class="goal-part-or">або</span>');

    renderGoalUpcoming(plan);
  }
}

// The list of upcoming days genuinely varies in content each time (which
// days, whether they already have earnings), so it stays dynamically
// built — unlike the rest of the card, which no longer rebuilds itself.
function renderGoalUpcoming(plan) {
  const chipsWrap = document.getElementById('goalUpcoming');
  let chipsHtml = '';
  let shown = 0;
  for (let d = plan.today; d <= plan.daysInMonth && shown < 6; d++) {
    const isWork = getStatus(plan.y, plan.m, d) === 'work';
    const isToday = d === plan.today;
    const key = dateKey(plan.y, plan.m, d);
    const already = !isToday && dayTotal(key) > 0;
    let valueHtml;
    if (!isWork) valueHtml = 'вих.';
    else if (already) valueHtml = '✓ ' + fmtMoneyShort(Math.round(dayTotal(key))) + '₴';
    else valueHtml = fmtMoneyShort(Math.round(plan.perDayTarget)) + '₴';
    chipsHtml +=
      '<div class="goal-chip' + (isToday ? ' chip-today' : '') + (isWork ? '' : ' chip-off') + (already ? ' chip-done' : '') + '">' +
        '<p class="chip-day">' + (isToday ? 'сьогодні' : d + ' ' + monthNames[plan.m].slice(0, 3)) + '</p>' +
        '<p class="chip-val">' + valueHtml + '</p>' +
      '</div>';
    shown++;
  }
  chipsWrap.innerHTML = chipsHtml;
}

// Wired once at startup since the goal-card elements are now permanent
// DOM nodes that renderGoal() never tears down.
function initGoalCardListeners() {
  document.getElementById('goalSetBtn').addEventListener('click', () => {
    const val = parseFloat(document.getElementById('goalInput').value);
    if (!(val > 0)) return;
    goalsData[currentMonthKey()] = val;
    saveGoals();
    goalEditing = false;
    renderGoal();
  });
  document.getElementById('goalInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') document.getElementById('goalSetBtn').click();
  });
  document.getElementById('goalEditBtn').addEventListener('click', () => { goalEditing = true; renderGoal(); });
  document.getElementById('goalRemoveBtn').addEventListener('click', () => {
    delete goalsData[currentMonthKey()];
    saveGoals();
    goalEditing = false;
    renderGoal();
  });
}

// ---------- Modal ----------
function statusLabel(s) { return s === 'work' ? 'Робочий день' : 'Вихідний'; }

function productTile(p) {
  // Only ever used for custom products now — the two core tiles are
  // static nodes in index.html, set up once by initCoreProductTiles().
  const btn = document.createElement('div');
  btn.className = 'product-btn' + (p.code === selectedProduct ? ' active' : '');
  btn.dataset.code = p.code;
  btn.innerHTML =
    '<span class="code">' + p.code + '</span>' +
    '<span class="rate">' + p.rate.toFixed(2) + ' ₴/шт</span>' +
    '<span class="product-del" title="Видалити виріб">✕</span>';
  btn.addEventListener('click', () => { selectedProduct = p.code; updateProductSelection(); updatePreview(); });
  btn.querySelector('.product-del').addEventListener('click', (e) => {
    e.stopPropagation(); // don't let the click also select the tile
    if (confirm('Видалити виріб ' + p.code + ' зі списку?')) {
      deleteCustomProduct(p.code);
      renderProductChoice();
      updatePreview();
    }
  });
  return btn;
}

// Sets the two fixed built-in tiles' text once at startup and wires their
// click handlers — they never get torn down or rebuilt after this.
function initCoreProductTiles() {
  const tileIds = ['coreTile0', 'coreTile1'];
  CORE_PRODUCTS.forEach((p, i) => {
    const tile = document.getElementById(tileIds[i]);
    if (!tile) return;
    tile.dataset.code = p.code;
    document.getElementById(tileIds[i] + 'Code').textContent = p.code;
    document.getElementById(tileIds[i] + 'Rate').textContent = p.rate.toFixed(2) + ' ₴/шт';
    tile.addEventListener('click', () => { selectedProduct = p.code; updateProductSelection(); updatePreview(); });
  });

  document.getElementById('productToggleTile').addEventListener('click', () => {
    showAllProducts = true;
    renderProductChoice();
  });
  document.getElementById('productAddTile').addEventListener('click', openAddProductForm);
  document.getElementById('newProdCancel').addEventListener('click', closeAddProductForm);
  document.getElementById('newProdSave').addEventListener('click', () => {
    const code = document.getElementById('newProdCode').value.trim();
    const rate = parseFloat(document.getElementById('newProdRate').value);
    const err = document.getElementById('productAddError');
    if (!code || !(rate > 0)) {
      err.textContent = 'Вкажи код і ставку більше нуля';
      return;
    }
    if (findProduct(code)) {
      err.textContent = 'Такий код вже є';
      return;
    }
    customProducts.push({ code, rate });
    saveCustomProducts();
    selectedProduct = code;
    showAllProducts = true;
    closeAddProductForm();
    renderProductChoice();
    updatePreview();
  });
}

// Updates just the "active" highlight on whichever tile matches the
// current selection — no rebuild, just a class toggle.
function updateProductSelection() {
  document.querySelectorAll('#productChoice .product-btn[data-code]').forEach(tile => {
    tile.classList.toggle('active', tile.dataset.code === selectedProduct);
  });
}

function renderProductChoice() {
  // The core tiles, toggle tile, and add tile are permanent DOM nodes —
  // only the custom-products list actually needs rebuilding, since it's
  // the one part with a genuinely variable length.
  const customWrap = document.getElementById('customProductTiles');
  customWrap.innerHTML = '';
  if (showAllProducts) {
    customProducts.forEach(p => customWrap.appendChild(productTile(p)));
  }

  const toggleTile = document.getElementById('productToggleTile');
  if (!showAllProducts && customProducts.length > 0) {
    toggleTile.style.display = '';
    document.getElementById('toggleCountLabel').textContent = '+' + customProducts.length;
  } else {
    toggleTile.style.display = 'none';
  }

  updateProductSelection();
}

function openAddProductForm() {
  document.getElementById('productChoice').style.display = 'none';
  document.getElementById('productAddForm').style.display = 'flex';
  document.getElementById('newProdCode').value = '';
  document.getElementById('newProdRate').value = '';
  document.getElementById('productAddError').textContent = '';
}

function closeAddProductForm() {
  document.getElementById('productAddForm').style.display = 'none';
  document.getElementById('productChoice').style.display = '';
  renderProductChoice();
}

function updatePreview() {
  const qty = parseFloat(document.getElementById('qtyInput').value);
  const product = findProduct(selectedProduct);
  const preview = document.getElementById('previewLine');
  const submitBtn = document.getElementById('submitEntry');
  if (qty > 0 && product) {
    const amount = qty * product.rate;
    preview.innerHTML = qty + ' шт × ' + product.rate.toFixed(2) + ' ₴ = <b>' + fmtMoney(amount) + '</b>';
    submitBtn.disabled = false;
  } else {
    preview.textContent = '';
    submitBtn.disabled = true;
  }
}

function renderEntryList() {
  const list = document.getElementById('entryList');
  const entries = earningsData[activeDateKey] || [];
  list.innerHTML = '';
  if (entries.length === 0) {
    list.innerHTML = '<p class="empty-note">Ще немає записів за цей день</p>';
  } else {
    entries.forEach((e, idx) => {
      const row = document.createElement('div');
      row.className = 'entry-row';
      row.innerHTML =
        '<div class="entry-info"><b>' + e.code + '</b><span> · ' + e.qty + ' шт</span><span class="entry-rate">' + (e.order ? 'Зам. №' + e.order + ' · ' : '') + e.rate.toFixed(2) + ' ₴/шт' + (fmtTime(e.time) ? ' · ' + fmtTime(e.time) : '') + '</span></div>' +
        '<div class="entry-row-right"><span class="entry-amount">' + fmtMoney(e.amount) + '</span>' +
        '<button class="entry-del" data-idx="' + idx + '">✕</button></div>';
      list.appendChild(row);
    });
    list.querySelectorAll('.entry-del').forEach(btn => {
      btn.addEventListener('click', (ev) => {
        const idx = parseInt(ev.currentTarget.getAttribute('data-idx'), 10);
        entries.splice(idx, 1);
        if (entries.length === 0) delete earningsData[activeDateKey];
        const ok = saveEarnings();
        document.getElementById('saveNote').textContent = ok ? '' : 'Не вдалося зберегти, спробуйте ще раз';
        renderEntryList();
        document.getElementById('dayTotal').textContent = fmtMoney(dayTotal(activeDateKey));
        renderCalendar();
        renderToday();
        renderStats();
        renderGoal();
      });
    });
  }
  document.getElementById('dayTotal').textContent = fmtMoney(dayTotal(activeDateKey));
}

function openModal(y, m, d) {
  activeDateKey = dateKey(y, m, d);
  const status = getStatus(y, m, d);
  const dt = new Date(y, m, d);
  document.getElementById('modalTitle').textContent = d + ' ' + monthNames[m] + ' ' + y;
  document.getElementById('modalStatus').textContent = statusLabel(status) + ' · ' + weekdayNames[dt.getDay()];
  document.getElementById('qtyInput').value = '';
  document.getElementById('orderInput').value = '';
  document.getElementById('saveNote').textContent = '';
  document.getElementById('modalBox').classList.toggle('day-off', status !== 'work');
  document.getElementById('productAddForm').style.display = 'none';
  document.getElementById('productChoice').style.display = '';
  showAllProducts = false;
  renderProductChoice();
  updatePreview();
  renderEntryList();
  document.getElementById('overlay').classList.add('open');
}

function closeModal() {
  document.getElementById('overlay').classList.remove('open');
}

document.getElementById('modalClose').addEventListener('click', closeModal);
document.getElementById('overlay').addEventListener('click', (e) => {
  if (e.target.id === 'overlay') closeModal();
});
document.getElementById('qtyInput').addEventListener('input', updatePreview);

document.getElementById('submitEntry').addEventListener('click', () => {
  const qty = parseFloat(document.getElementById('qtyInput').value);
  const product = findProduct(selectedProduct);
  const order = document.getElementById('orderInput').value.trim();
  const [ey, em, ed] = activeDateKey.split('-').map(Number);
  if (!(qty > 0) || !product || getStatus(ey, em - 1, ed) !== 'work') return;

  const amount = Math.round(qty * product.rate * 100) / 100;
  if (!earningsData[activeDateKey]) earningsData[activeDateKey] = [];
  earningsData[activeDateKey].push({ code: product.code, qty: qty, rate: product.rate, amount: amount, order: order || null, time: new Date().toISOString() });

  const ok = saveEarnings();
  document.getElementById('saveNote').textContent = ok ? 'Збережено' : 'Не вдалося зберегти, спробуйте ще раз';

  document.getElementById('qtyInput').value = '';
  document.getElementById('orderInput').value = '';
  updatePreview();
  renderEntryList();
  renderCalendar();
  renderToday();
  renderStats();
  renderGoal();
});

document.getElementById('addEarnToday').addEventListener('click', () => {
  openModal(now.getFullYear(), now.getMonth(), now.getDate());
});

document.getElementById('prevMonth').addEventListener('click', () => {
  viewMonth--;
  if (viewMonth < 0) { viewMonth = 11; viewYear--; }
  renderCalendar();
});
document.getElementById('nextMonth').addEventListener('click', () => {
  viewMonth++;
  if (viewMonth > 11) { viewMonth = 0; viewYear++; }
  renderCalendar();
});

document.getElementById('exportBtn').addEventListener('click', exportData);
document.getElementById('importFile').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) importDataFromFile(file);
  e.target.value = '';
});

// ---------- Init ----------
// Staged on purpose: the status card is what the person looks at first,
// so it's rendered synchronously. Everything else (calendar grid, chart,
// stats) is pushed one frame later via requestAnimationFrame, so the
// browser gets to paint in between instead of doing all the DOM work in
// a single blocking chunk. Barely matters today, but keeps things smooth
// as more months of history / products pile up.
(function init() {
  loadEarnings();
  loadGoals();
  loadCustomProducts();

  initGoalCardListeners();
  initCoreProductTiles();

  renderToday();
  renderGoal();

  requestAnimationFrame(() => {
    renderCalendar();
    requestAnimationFrame(() => {
      renderStats();
      setupChartObserver();
    });
  });
})();

// ---------- Splash screen ----------
// Shown instantly on load; hidden once init() above has run, with a small
// minimum display time so it doesn't just flash on fast devices, then the
// app shell fades/slides in with a staggered entrance.
(function handleSplash() {
  const splash = document.getElementById('splash');
  const minVisible = 700;
  const shownAt = performance.now();

  function reveal() {
    const elapsed = performance.now() - shownAt;
    const wait = Math.max(0, minVisible - elapsed);
    setTimeout(() => {
      splash.classList.add('splash-hide');
      document.body.classList.add('app-ready');
      setTimeout(() => splash.remove(), 550);
    }, wait);
  }

  if (document.readyState === 'complete') {
    reveal();
  } else {
    window.addEventListener('load', reveal);
    // Safety net in case 'load' is delayed by slow external fonts/assets
    setTimeout(reveal, 2500);
  }
})();

// ---------- PWA: offline support + installability ----------
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => { /* offline caching just won't be available */ });
  });
}
