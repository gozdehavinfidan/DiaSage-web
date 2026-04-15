// Patient Analytics Dashboard.
//
// Subscribes to the `patients/{uid}/healthMetrics` collection, transforms each
// metric series into chart-ready data, renders trend charts into <canvas>
// elements, and updates per-metric analytics panels in #patient-monitor.
//
// Charts use plain Canvas 2D (no chart library) to match the source HTML.
// Time-range buttons re-issue the listener with a new `days` window.
//
// Call openMonitor(patientUid) to open; closeMonitor() to tear down listeners.

import { fbAuth, fbDb } from '../../shared/firebase-init.js';
import { metricConfigs, metricLabels } from './metrics-config.js';

let currentRange = 30;
let currentPatientUid = null;
let healthMetricsUnsubscribe = null;
let lastReceivedDocs = null;
let timeRangeBound = false;
let resizeBound = false;
let resizeTimer = null;

// ==================== LISTENER ====================
function setupHealthMetricsListener(patientUid, days) {
  if (healthMetricsUnsubscribe) { healthMetricsUnsubscribe(); healthMetricsUnsubscribe = null; }
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  healthMetricsUnsubscribe = fbDb.collection('patients').doc(patientUid)
    .collection('healthMetrics')
    .where('timestamp', '>=', cutoff)
    .orderBy('timestamp', 'asc')
    .onSnapshot(function (snapshot) {
      const docs = [];
      snapshot.forEach(function (doc) { docs.push(doc.data()); });
      lastReceivedDocs = docs;
      renderDashboardWithDocs(docs, days);
      const el = document.getElementById('monitorLastUpdated');
      if (el) el.textContent = 'Son güncelleme: ' + new Date().toLocaleTimeString('tr-TR');
    }, function (err) {
      console.error('Health metrics listener error:', err);
    });
}

// ==================== TRANSFORM / STATS ====================
function transformMetrics(docs, key) {
  const cfg = metricConfigs[key];
  const data = [];
  for (let i = 0; i < docs.length; i++) {
    const d = docs[i];
    const val = d[cfg.field];
    if (val == null || val === 0) continue;
    if (val < cfg.min) continue;
    const entry = { day: data.length, value: parseFloat(Number(val).toFixed(cfg.decimal)), timestamp: d.timestamp };
    if (key === 'bp' && d[cfg.diaField]) {
      entry.dia = Math.round(d[cfg.diaField]);
    }
    data.push(entry);
  }
  return data;
}

function getAnalytics(data, key) {
  const vals = data.map(function (d) { return d.value; });
  const min = Math.min.apply(null, vals);
  const max = Math.max.apply(null, vals);
  const avg = vals.reduce(function (a, b) { return a + b; }, 0) / vals.length;
  const dec = metricConfigs[key].decimal;
  const result = { min: parseFloat(min.toFixed(dec)), max: parseFloat(max.toFixed(dec)), avg: parseFloat(avg.toFixed(dec)) };
  if (key === 'bp') {
    const dias = data.map(function (d) { return d.dia; }).filter(function (v) { return v != null; });
    if (dias.length > 0) {
      result.diaMin = Math.min.apply(null, dias);
      result.diaMax = Math.max.apply(null, dias);
      result.diaAvg = Math.round(dias.reduce(function (a, b) { return a + b; }, 0) / dias.length);
    } else {
      result.diaMin = '-'; result.diaMax = '-'; result.diaAvg = '-';
    }
  }
  return result;
}

function computeStdDev(data) {
  const vals = data.map(function (d) { return d.value; });
  const avg = vals.reduce(function (a, b) { return a + b; }, 0) / vals.length;
  const sqDiffs = vals.map(function (v) { return (v - avg) * (v - avg); });
  return Math.sqrt(sqDiffs.reduce(function (a, b) { return a + b; }, 0) / vals.length);
}

function computeNormalPct(data, key) {
  const cfg = metricConfigs[key];
  let inRange;
  if (key === 'bp') {
    inRange = data.filter(function (d) {
      const sysOk = d.value >= cfg.normalMin && d.value <= cfg.normalMax;
      const diaOk = d.dia == null || (d.dia >= 60 && d.dia <= 90);
      return sysOk && diaOk;
    });
  } else {
    inRange = data.filter(function (d) { return d.value >= cfg.normalMin && d.value <= cfg.normalMax; });
  }
  return Math.round((inRange.length / data.length) * 100);
}

function computeTrend(data) {
  const n = data.length;
  const third = Math.max(Math.floor(n / 3), 1);
  const firstAvg = data.slice(0, third).reduce(function (a, d) { return a + d.value; }, 0) / third;
  const lastAvg = data.slice(n - third).reduce(function (a, d) { return a + d.value; }, 0) / third;
  const diff = lastAvg - firstAvg;
  const pct = ((diff / firstAvg) * 100).toFixed(1);
  if (Math.abs(pct) < 1.5) return { dir: 'stable', pct: pct };
  return { dir: diff > 0 ? 'up' : 'down', pct: pct };
}

// ==================== RENDERING ====================
function drawTrendChart(canvasId, data, color, absMin, absMax) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  ctx.scale(dpr, dpr);
  const w = rect.width, h = rect.height;
  const pad = { top: 8, bottom: 20, left: 4, right: 4 };
  const cw = w - pad.left - pad.right, ch = h - pad.top - pad.bottom;
  const vals = data.map(function (d) { return d.value; });
  const range = absMax - absMin || 1;

  // Grid lines
  const isLight = document.documentElement.dataset.theme === 'light';
  ctx.strokeStyle = isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.04)';
  ctx.lineWidth = 1;
  for (let g = 0; g < 4; g++) {
    const gy = pad.top + (ch / 3) * g;
    ctx.beginPath(); ctx.moveTo(pad.left, gy); ctx.lineTo(w - pad.right, gy); ctx.stroke();
  }

  // Gradient fill
  const grad = ctx.createLinearGradient(0, pad.top, 0, h - pad.bottom);
  if (isLight) {
    grad.addColorStop(0, color + '30');
    grad.addColorStop(1, color + '06');
  } else {
    grad.addColorStop(0, color + '25');
    grad.addColorStop(1, color + '02');
  }
  ctx.beginPath();
  for (let i = 0; i < vals.length; i++) {
    const x = pad.left + (i / (vals.length - 1)) * cw;
    const y = pad.top + (1 - (vals[i] - absMin) / range) * ch;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.lineTo(pad.left + cw, pad.top + ch);
  ctx.lineTo(pad.left, pad.top + ch);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();

  // Line
  ctx.beginPath();
  ctx.strokeStyle = color;
  ctx.lineWidth = isLight ? 2.5 : 2;
  ctx.lineJoin = 'round';
  for (let i = 0; i < vals.length; i++) {
    const x = pad.left + (i / (vals.length - 1)) * cw;
    const y = pad.top + (1 - (vals[i] - absMin) / range) * ch;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.stroke();

  // X-axis date labels
  ctx.fillStyle = isLight ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.2)';
  ctx.font = '10px "Plus Jakarta Sans", sans-serif';
  ctx.textAlign = 'center';
  const labelCount = Math.min(data.length, 6);
  for (let i = 0; i < labelCount; i++) {
    const idx = Math.round(i * (data.length - 1) / (labelCount - 1));
    const x = pad.left + (idx / (data.length - 1)) * cw;
    const d = new Date();
    d.setDate(d.getDate() - (data.length - 1 - idx));
    const label = d.getDate() + '/' + (d.getMonth() + 1);
    ctx.fillText(label, x, h - 4);
  }
}

function capKey(key) {
  return key === 'hr' ? 'HR' : key === 'spo2' ? 'SpO2' : key === 'temp' ? 'Temp' : key === 'bp' ? 'BP' : key === 'hrv' ? 'HRV' : 'Glucose';
}

function updateMinMaxBar(key, analytics) {
  const cfg = metricConfigs[key];
  const ck = capKey(key);
  const fullRange = cfg.max - cfg.min;
  const minPct = ((analytics.min - cfg.min) / fullRange) * 100;
  const maxPct = ((analytics.max - cfg.min) / fullRange) * 100;
  const avgPct = ((analytics.avg - cfg.min) / fullRange) * 100;
  const bar = document.getElementById('bar' + ck);
  const marker = document.getElementById('marker' + ck);
  if (bar) { bar.style.left = minPct + '%'; bar.style.width = (maxPct - minPct) + '%'; }
  if (marker) { marker.style.left = avgPct + '%'; }
  const minEl = document.getElementById('min' + ck);
  const maxEl = document.getElementById('max' + ck);
  if (minEl) minEl.textContent = key === 'bp' ? analytics.min + '/' + analytics.diaMin : analytics.min;
  if (maxEl) maxEl.textContent = key === 'bp' ? analytics.max + '/' + analytics.diaMax : analytics.max;
}

function renderAnalyticsPanel(key, data, analytics) {
  const ck = capKey(key);
  const cfg = metricConfigs[key];
  const ml = metricLabels[key];
  const panel = document.getElementById('analytics' + ck);
  if (!panel) return;

  const stdDev = computeStdDev(data).toFixed(cfg.decimal);
  const normalPct = computeNormalPct(data, key);
  const trend = computeTrend(data);
  let lastVal = data[data.length - 1].value;
  if (cfg.decimal === 1) lastVal = lastVal.toFixed(1);

  const avgDisplay = key === 'bp' ? analytics.avg + '/' + analytics.diaAvg : analytics.avg;
  const unitDisplay = key === 'bp' ? 'mmHg' : ml.unit;
  const lastDisplay = key === 'bp' ? lastVal + '/' + data[data.length - 1].dia : lastVal;
  const minDisplay = key === 'bp' ? analytics.min + '/' + analytics.diaMin : analytics.min;
  const maxDisplay = key === 'bp' ? analytics.max + '/' + analytics.diaMax : analytics.max;
  const rangeLabels = { 7: 'Son 7 gün', 30: 'Son 30 gün', 90: 'Son 3 ay' };
  const periodLabel = rangeLabels[currentRange] || 'Son ' + currentRange + ' gün';

  // Badge — son ölçüm değerine göre Normal / Dikkat
  const badge = document.getElementById('badge' + ck);
  if (badge) {
    const lastEntry = data[data.length - 1];
    let lastInRange = lastEntry.value >= cfg.normalMin && lastEntry.value <= cfg.normalMax;
    if (key === 'bp' && lastEntry.dia != null) {
      lastInRange = lastInRange && lastEntry.dia >= 60 && lastEntry.dia <= 90;
    }
    if (lastInRange) {
      badge.textContent = 'Normal';
      badge.className = 'monitor-card-normal-badge normal-badge-ok';
    } else {
      badge.textContent = 'Dikkat';
      badge.className = 'monitor-card-normal-badge normal-badge-warn';
    }
  }

  // Trend arrow
  const trendClass = trend.dir === 'up' ? 'trend-up' : trend.dir === 'down' ? 'trend-down' : 'trend-stable';
  const trendArrow = trend.dir === 'up' ? '&#8593;' : trend.dir === 'down' ? '&#8595;' : '&#8596;';
  const trendLabel = trend.dir === 'up' ? 'Yükseliş' : trend.dir === 'down' ? 'Düşüş' : 'Sabit';

  // normalPct is computed but not displayed in the HTML template below; kept
  // available in case future templates re-introduce it.
  void normalPct;

  panel.innerHTML =
    '<div class="analytics-avg-block">' +
      '<div class="analytics-avg-label">Son Ölçüm</div>' +
      '<div class="analytics-avg-val">' + lastDisplay + '</div>' +
      '<div class="analytics-avg-unit">' + unitDisplay + '</div>' +
    '</div>' +
    '<div class="analytics-stats">' +
      '<div class="analytics-stat-row"><span class="analytics-stat-label">' + periodLabel + ' Ort.</span><span class="analytics-stat-val">' + avgDisplay + ' ' + unitDisplay + '</span></div>' +
      '<div class="analytics-stat-row"><span class="analytics-stat-label">' + periodLabel + ' Min</span><span class="analytics-stat-val" style="color:var(--spo2);">&#8595; ' + minDisplay + ' ' + unitDisplay + '</span></div>' +
      '<div class="analytics-stat-row"><span class="analytics-stat-label">' + periodLabel + ' Max</span><span class="analytics-stat-val" style="color:var(--heart);">&#8593; ' + maxDisplay + ' ' + unitDisplay + '</span></div>' +
      '<div class="analytics-stat-row"><span class="analytics-stat-label">Std. Sapma</span><span class="analytics-stat-val">&plusmn;' + stdDev + '</span></div>' +
      '<div class="analytics-stat-row"><span class="analytics-stat-label">Normal Aralık</span><span class="analytics-stat-val">' + ml.normalRange + '</span></div>' +
    '</div>' +
    '<div class="analytics-trend ' + trendClass + '">' +
      '<span class="trend-arrow">' + trendArrow + '</span>' +
      '<span>' + trendLabel + ' (' + (trend.pct > 0 ? '+' : '') + trend.pct + '%)</span>' +
    '</div>';
}

function buildSummary(allAnalytics) {
  const container = document.getElementById('monitorSummary');
  const chips = [
    { label: 'Nabız Ort.', val: allAnalytics.hr.avg + ' BPM', color: 'var(--heart)' },
    { label: 'SpO2 Ort.', val: allAnalytics.spo2.avg + '%', color: 'var(--spo2)' },
    { label: 'Sıcaklık Ort.', val: allAnalytics.temp.avg + '°C', color: 'var(--temp)' },
    { label: 'Tansiyon Ort.', val: allAnalytics.bp.avg + '/' + allAnalytics.bp.diaAvg, color: 'var(--bp)' },
    { label: 'HRV Ort.', val: allAnalytics.hrv.avg + ' ms', color: 'var(--hrv)' },
    { label: 'Kan Şekeri Ort.', val: allAnalytics.glucose.avg + ' mg/dL', color: 'var(--calories)' }
  ];
  container.innerHTML = '';
  chips.forEach(function (c) {
    container.innerHTML += '<div class="summary-chip"><div class="summary-chip-dot" style="background:' + c.color + ';"></div><div><div class="summary-chip-label">' + c.label + '</div><div class="summary-chip-val" style="color:' + c.color + ';">' + c.val + '</div></div></div>';
  });
}

function renderDashboard(days) {
  currentRange = days;
  const rangeLabels = { 7: 'Son 7 gün', 30: 'Son 30 gün', 90: 'Son 3 ay' };
  const timeEl = document.getElementById('monitorTime');
  if (timeEl) timeEl.textContent = 'Seçili dönem: ' + (rangeLabels[days] || days + ' gün');

  if (!currentPatientUid) {
    const summary = document.getElementById('monitorSummary');
    if (summary) summary.innerHTML = '<div style="text-align:center;color:rgba(255,255,255,0.5);padding:20px;">Hasta bağlantısı bekleniyor...</div>';
    return;
  }

  setupHealthMetricsListener(currentPatientUid, days);
}

function renderDashboardWithDocs(docs, days) {
  void days;
  const keys = ['hr', 'spo2', 'temp', 'bp', 'hrv', 'glucose'];
  const chartMap = { hr: 'chartHR', spo2: 'chartSpO2', temp: 'chartTemp', bp: 'chartBP', hrv: 'chartHRV', glucose: 'chartGlucose' };

  if (!docs || docs.length === 0) {
    const summary = document.getElementById('monitorSummary');
    if (summary) {
      summary.innerHTML = '<div style="text-align:center;color:rgba(255,255,255,0.5);padding:40px 20px;font-size:20px;">Henüz sağlık verisi yok.<br><span style="font-size:17px;opacity:0.6;">Hasta mobil uygulamadan veri senkronize ettiğinde burada görünecektir.</span></div>';
    }
    keys.forEach(function (key) {
      const canvas = document.getElementById(chartMap[key]);
      if (canvas) { const ctx = canvas.getContext('2d'); ctx.clearRect(0, 0, canvas.width, canvas.height); }
      const ck = capKey(key);
      const panel = document.getElementById('analytics' + ck);
      if (panel) panel.innerHTML = '<div style="text-align:center;color:rgba(255,255,255,0.3);padding:20px;">Veri yok</div>';
    });
    return;
  }

  const allData = {};
  const allAnalytics = {};
  keys.forEach(function (key) {
    allData[key] = transformMetrics(docs, key);
    if (allData[key].length > 0) {
      allAnalytics[key] = getAnalytics(allData[key], key);
    }
  });

  const hasSomeData = keys.some(function (key) { return allAnalytics[key]; });
  if (hasSomeData) {
    const summaryAnalytics = {};
    keys.forEach(function (key) {
      summaryAnalytics[key] = allAnalytics[key] || { avg: '-', min: '-', max: '-', diaAvg: '-', diaMin: '-', diaMax: '-' };
    });
    buildSummary(summaryAnalytics);
  } else {
    const summary = document.getElementById('monitorSummary');
    if (summary) summary.innerHTML = '';
  }

  keys.forEach(function (key) {
    const cfg = metricConfigs[key];
    if (allData[key].length > 1) {
      drawTrendChart(chartMap[key], allData[key], cfg.color, cfg.min, cfg.max);
      updateMinMaxBar(key, allAnalytics[key]);
      renderAnalyticsPanel(key, allData[key], allAnalytics[key]);
    } else {
      const canvas = document.getElementById(chartMap[key]);
      if (canvas) { const ctx = canvas.getContext('2d'); ctx.clearRect(0, 0, canvas.width, canvas.height); }
      const ck = capKey(key);
      const panel = document.getElementById('analytics' + ck);
      if (panel) panel.innerHTML = '<div style="text-align:center;color:rgba(255,255,255,0.3);padding:20px;">' + (allData[key].length === 0 ? 'Veri yok' : 'Yetersiz veri') + '</div>';
    }
  });
}

// ==================== PUBLIC API ====================
export function openMonitor(patientUid) {
  if (patientUid) {
    currentPatientUid = patientUid;
  }
  const nameEl = document.getElementById('monitorPatientName');
  const idEl = document.getElementById('monitorPatientId');
  if (nameEl) {
    nameEl.textContent = currentPatientUid ? 'Hasta: ' + currentPatientUid.substring(0, 8) + '...' : 'Hasta';
  }
  if (idEl) {
    idEl.textContent = currentPatientUid ? 'UID: ' + currentPatientUid : '';
  }
  // Fetch patient name from linkedDevices if available
  if (currentPatientUid && fbAuth.currentUser) {
    const linkDocId = fbAuth.currentUser.uid + '_' + currentPatientUid;
    fbDb.collection('linkedDevices').doc(linkDocId).get().then(function (doc) {
      if (doc.exists) {
        const data = doc.data();
        if (data.patientName && nameEl) {
          nameEl.textContent = data.patientName;
        }
        if (data.linkedAt && idEl) {
          idEl.textContent = 'Bağlantı: ' + new Date(data.linkedAt).toLocaleDateString('tr-TR');
        }
      }
    }).catch(function () {});
  }
  const monitor = document.getElementById('patient-monitor');
  if (!monitor) return;
  monitor.classList.add('open');
  document.body.style.overflow = 'hidden';

  // Bind time-range selector once
  if (!timeRangeBound) {
    const selector = document.getElementById('timeRangeSelector');
    if (selector) {
      selector.addEventListener('click', function (e) {
        const btn = e.target.closest('.time-range-btn');
        if (!btn) return;
        this.querySelectorAll('.time-range-btn').forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');
        const days = parseInt(btn.dataset.range, 10);
        renderDashboard(days);
      });
      timeRangeBound = true;
    }
  }

  // Redraw charts on window resize (once)
  if (!resizeBound) {
    window.addEventListener('resize', function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () {
        const m = document.getElementById('patient-monitor');
        if (m && m.classList.contains('open') && lastReceivedDocs) {
          renderDashboardWithDocs(lastReceivedDocs, currentRange);
        }
      }, 200);
    });
    resizeBound = true;
  }

  setTimeout(function () { renderDashboard(currentRange); }, 100);
}

export function closeMonitor() {
  if (healthMetricsUnsubscribe) { healthMetricsUnsubscribe(); healthMetricsUnsubscribe = null; }
  const monitor = document.getElementById('patient-monitor');
  if (monitor) monitor.classList.remove('open');
  document.body.style.overflow = '';
  currentPatientUid = null;
  lastReceivedDocs = null;
  const el = document.getElementById('monitorLastUpdated');
  if (el) el.textContent = '';
}
