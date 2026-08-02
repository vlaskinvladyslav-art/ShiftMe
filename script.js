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
const PRODUCTS = [
  { code: '3115', rate: 7.47 },
  { code: '4320', rate: 14.21 }
];

const STORAGE_KEY = 'shiftTrackerEarnings';

let earningsData = {};   // { 'YYYY-MM-DD': [{code, qty, rate, amount}, ...] }
let dataReady = false;
let selectedProduct = PRODUCTS[0].code;
let activeDateKey = null; // date currently open in the modal

function pad(n) { return String(n).padStart(2, '0'); }
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

  let nd = new Date(Date.UTC(y, m, d));
  let cur = status;
  let steps = 0;
  while (steps < 10) {
    nd = new Date(nd.getTime() + 86400000);
    steps++;
    const s = getStatus(nd.getUTCFullYear(), nd.getUTCMonth(), nd.getUTCDate());
    if (s !== cur) break;
  }
  const label = cur === 'work' ? 'вихідний' : 'робочий день';
  document.getElementById('nextChange').textContent =
    steps + (steps === 1 ? ' день' : (steps < 5 ? ' дні' : ' днів')) + ' (' + nd.getUTCDate() + ' ' + monthNames[nd.getUTCMonth()] + ') → ' + label;

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
    document.getElementById('todayEarnValue').textContent = fmtMoney(tTotal);
  } else {
    row.style.display = 'none';
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

  document.getElementById('monthTotal').textContent = fmtMoney(monthSum);
}

// ---------- Statistics ----------
function allDatesSorted() {
  return Object.keys(earningsData).filter(k => dayTotal(k) > 0).sort();
}

function computeStreak() {
  let d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayKey = dateKey(d.getFullYear(), d.getMonth(), d.getDate());
  // The day isn't "broken" until it's fully over, so an empty *today*
  // doesn't reset the streak — we just start counting from yesterday.
  if (!(dayTotal(todayKey) > 0)) {
    d.setDate(d.getDate() - 1);
  }
  let streak = 0;
  while (true) {
    const key = dateKey(d.getFullYear(), d.getMonth(), d.getDate());
    if (dayTotal(key) > 0) {
      streak++;
      d.setDate(d.getDate() - 1);
    } else {
      break;
    }
  }
  return streak;
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
  PRODUCTS.forEach(p => { totals[p.code] = { qty: 0, amount: 0 }; });
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
  days.forEach((d, i) => {
    const x = xAt(i), y = yAt(d.total);
    const isToday = i === days.length - 1;
    const above = d.total >= avg;
    const color = d.total === 0 ? 'var(--line)' : (above ? 'var(--off)' : 'var(--work)');
    const r = isToday ? 4.5 : 3;
    dots += '<circle cx="' + x + '" cy="' + y.toFixed(1) + '" r="' + r + '" fill="' + color + '"' +
      (isToday ? ' stroke="var(--today-ring)" stroke-width="2"' : '') + '></circle>';
    if (i % 2 === 0 || isToday) {
      labels += '<text x="' + x + '" y="' + (h - 4) + '" text-anchor="middle" class="chart-day-label">' + d.date.getDate() + '</text>';
    }
  });

  const svg =
    '<svg viewBox="0 0 ' + w + ' ' + h + '" width="100%" height="' + h + '" xmlns="http://www.w3.org/2000/svg">' +
    '<line x1="' + padL + '" y1="' + avgY + '" x2="' + (w - padR) + '" y2="' + avgY + '" stroke="var(--muted)" stroke-width="1" stroke-dasharray="4 4" opacity="0.5"></line>' +
    '<polyline points="' + linePts + '" fill="none" stroke="var(--money)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"></polyline>' +
    dots + labels +
    '</svg>';

  document.getElementById('earningsChart').innerHTML = svg;
}

function renderProductStats() {
  const totals = computeProductTotals();
  const wrap = document.getElementById('productStats');
  const grandTotal = Object.values(totals).reduce((s, t) => s + t.amount, 0);

  if (grandTotal === 0) {
    wrap.innerHTML = '<div class="stats-empty">Ще немає жодного запису</div>';
    return;
  }

  wrap.innerHTML = PRODUCTS.map(p => {
    const t = totals[p.code] || { qty: 0, amount: 0 };
    const pct = grandTotal > 0 ? Math.round((t.amount / grandTotal) * 100) : 0;
    return (
      '<div class="product-stat-row">' +
        '<div class="product-stat-top">' +
          '<span class="code">' + p.code + '</span>' +
          '<span class="qty">' + t.qty.toLocaleString('uk-UA') + ' шт</span>' +
          '<span class="amt">' + fmtMoney(t.amount) + '</span>' +
        '</div>' +
        '<div class="product-bar-track"><div class="product-bar-fill" style="width:' + pct + '%"></div></div>' +
      '</div>'
    );
  }).join('');
}

function renderStats() {
  document.getElementById('statAllTime').textContent = fmtMoney(computeAllTimeTotal());

  const streak = computeStreak();
  document.getElementById('statStreak').textContent = streak + (streak === 1 ? ' день' : (streak >= 2 && streak <= 4 ? ' дні' : ' днів'));

  const record = computeRecord();
  document.getElementById('statRecord').textContent = fmtMoney(record.amount);
  document.getElementById('statRecordDate').textContent = record.key
    ? formatShortDate(new Date(record.key + 'T00:00:00'))
    : '—';

  const days = last14Days();
  renderTrendBadge(days);
  renderChart(days);
  renderProductStats();
}

// ---------- Modal ----------
function statusLabel(s) { return s === 'work' ? 'Робочий день' : 'Вихідний'; }

function renderProductChoice() {
  const wrap = document.getElementById('productChoice');
  wrap.innerHTML = '';
  PRODUCTS.forEach(p => {
    const btn = document.createElement('div');
    btn.className = 'product-btn' + (p.code === selectedProduct ? ' active' : '');
    btn.innerHTML = '<span class="code">' + p.code + '</span><span class="rate">' + p.rate.toFixed(2) + ' ₴/шт</span>';
    btn.addEventListener('click', () => { selectedProduct = p.code; renderProductChoice(); updatePreview(); });
    wrap.appendChild(btn);
  });
}

function updatePreview() {
  const qty = parseFloat(document.getElementById('qtyInput').value);
  const product = PRODUCTS.find(p => p.code === selectedProduct);
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
    list.innerHTML = '<div class="empty-note">Ще немає записів за цей день</div>';
  } else {
    entries.forEach((e, idx) => {
      const row = document.createElement('div');
      row.className = 'entry-row';
      row.innerHTML =
        '<div class="entry-info"><b>' + e.code + '</b> · ' + e.qty + ' шт<span>' + e.rate.toFixed(2) + ' ₴/шт</span></div>' +
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
  document.getElementById('saveNote').textContent = '';
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
  const product = PRODUCTS.find(p => p.code === selectedProduct);
  if (!(qty > 0) || !product) return;

  const amount = Math.round(qty * product.rate * 100) / 100;
  if (!earningsData[activeDateKey]) earningsData[activeDateKey] = [];
  earningsData[activeDateKey].push({ code: product.code, qty: qty, rate: product.rate, amount: amount });

  const ok = saveEarnings();
  document.getElementById('saveNote').textContent = ok ? 'Збережено' : 'Не вдалося зберегти, спробуйте ще раз';

  document.getElementById('qtyInput').value = '';
  updatePreview();
  renderEntryList();
  renderCalendar();
  renderToday();
  renderStats();
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
(function init() {
  loadEarnings();
  renderToday();
  renderCalendar();
  renderStats();
})();

// ---------- PWA: offline support + installability ----------
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => { /* offline caching just won't be available */ });
  });
}
