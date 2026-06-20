'use strict';

const STORAGE_KEY = 'epitrack_entries';

// ── Storage ───────────────────────────────────
function getEntries() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

function addEntry(entry) {
  const entries = getEntries();
  entries.unshift(entry);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

// ── Tab navigation ────────────────────────────
function switchTab(tabName) {
  document.querySelectorAll('.tab-view').forEach(v => {
    v.hidden = v.id !== `view-${tabName}`;
  });
  document.querySelectorAll('.nav-btn[data-view]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === tabName);
  });
  if (tabName === 'insights') renderInsights();
  else renderHome();
}

// ── Log modal ─────────────────────────────────
function openLog() {
  const modal = document.getElementById('screen-log');
  modal.classList.add('active');
  modal.removeAttribute('aria-hidden');
  resetForm();
}

function closeLog() {
  const modal = document.getElementById('screen-log');
  modal.classList.remove('active');
  modal.setAttribute('aria-hidden', 'true');
}

// ── Form ──────────────────────────────────────
function resetForm() {
  document.getElementById('seizure-form').reset();
  // form.reset() restores "Not sure" (has checked in HTML) and clears checkboxes/textarea
  document.getElementById('seizure-time').value = localISO();
}

function localISO() {
  const d = new Date();
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

// ── Render home ───────────────────────────────
function renderHome() {
  const entries = getEntries();

  // Stats
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const thisMonth = entries.filter(e => new Date(e.time) >= startOfMonth).length;
  document.getElementById('stat-month').textContent = String(thisMonth);

  if (entries.length > 0) {
    const diff = Math.floor((now - new Date(entries[0].time)) / 86_400_000);
    document.getElementById('stat-last').textContent = diff === 0 ? 'Today' : String(diff);
  } else {
    document.getElementById('stat-last').textContent = '—';
  }

  // Entry list
  const list = document.getElementById('entries-list');
  if (entries.length === 0) {
    list.innerHTML = '<p class="empty-state">No entries yet.<br>Tap <strong>Log Seizure</strong> when you need it.</p>';
    return;
  }
  list.innerHTML = entries.slice(0, 20).map(entryCardHTML).join('');
}

// ── Render insights ───────────────────────────
function renderInsights() {
  const entries = getEntries();
  const body = document.getElementById('insights-body');

  if (entries.length === 0) {
    body.innerHTML = `
      <div class="empty-insights">
        <span class="empty-insights-emoji">📊</span>
        <p class="empty-insights-title">No data yet</p>
        <p class="empty-insights-sub">Log seizures to see patterns emerge.<br>Your data stays private on your device.</p>
      </div>
    `;
    return;
  }

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const thisMonth = entries.filter(e => new Date(e.time) >= startOfMonth).length;

  const typeCounts = {};
  entries.forEach(e => {
    const k = e.type || 'Unknown';
    typeCounts[k] = (typeCounts[k] || 0) + 1;
  });
  const topType = Object.entries(typeCounts).sort((a, b) => b[1] - a[1])[0];

  const triggerCounts = {};
  entries.forEach(e => (e.triggers || []).forEach(t => {
    triggerCounts[t] = (triggerCounts[t] || 0) + 1;
  }));
  const topTrigger = Object.entries(triggerCounts).sort((a, b) => b[1] - a[1])[0];

  const byMonth = {};
  entries.forEach(e => {
    const key = new Date(e.time).toLocaleDateString([], { year: 'numeric', month: 'long' });
    if (!byMonth[key]) byMonth[key] = [];
    byMonth[key].push(e);
  });

  body.innerHTML = `
    <div class="insights-grid">
      <div class="insight-card">
        <span class="insight-num">${entries.length}</span>
        <span class="insight-label">Total</span>
      </div>
      <div class="insight-card">
        <span class="insight-num">${thisMonth}</span>
        <span class="insight-label">This month</span>
      </div>
      <div class="insight-card">
        <span class="insight-num ${topType ? 'is-text' : ''}">${topType ? esc(topType[0]) : '—'}</span>
        <span class="insight-label">Top type</span>
      </div>
    </div>

    ${topTrigger ? `
    <div>
      <h3 class="section-label">Most common trigger</h3>
      <div class="top-trigger-card">
        <span class="top-trigger-name">${esc(topTrigger[0])}</span>
        <span class="top-trigger-count">${topTrigger[1]} ${topTrigger[1] === 1 ? 'time' : 'times'}</span>
      </div>
    </div>` : ''}

    <div>
      <h3 class="section-label">By month</h3>
      ${Object.entries(byMonth).map(([month, mes]) => `
        <div class="month-group">
          <p class="month-heading">
            ${esc(month)}
            <span class="month-count">${mes.length}</span>
          </p>
          <div class="month-entries">
            ${mes.map(entryCardHTML).join('')}
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

// ── Entry card HTML ───────────────────────────
// Lucide "activity" icon — ECG waveform, used for all seizure entries
const SEIZURE_ICON = `<svg class="cat-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>`;

function entryCardHTML(e) {
  const emoji = { Mild: '😐', Moderate: '😟', Severe: '😰' }[e.intensity] || '';
  const triggers = e.triggers || [];
  return `
    <article class="entry-card cat-seizure" role="listitem">
      <div class="entry-top">
        <div class="entry-heading">
          ${SEIZURE_ICON}
          <span class="entry-type-badge">${esc(e.type || 'Unknown')}</span>
        </div>
        <div class="entry-meta">
          ${e.duration ? `<span class="entry-pill">${esc(e.duration)}</span>` : ''}
          ${emoji ? `<span class="entry-intensity" title="${esc(e.intensity)}">${emoji}</span>` : ''}
        </div>
      </div>
      <time class="entry-time" datetime="${esc(e.time)}">${fmtTime(e.time)}</time>
      ${triggers.length ? `
        <div class="entry-triggers">
          ${triggers.map(t => `<span class="entry-trigger-pill">${esc(t)}</span>`).join('')}
        </div>` : ''}
      ${e.notes ? `<p class="entry-notes">${esc(e.notes)}</p>` : ''}
    </article>
  `;
}

// ── Success overlay ───────────────────────────
function showSuccess() {
  const overlay = document.getElementById('success-overlay');
  overlay.hidden = false;
  setTimeout(() => {
    overlay.hidden = true;
    renderHome();
  }, 1800);
}

// ── Utilities ─────────────────────────────────
function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function fmtTime(iso) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return String(iso);
  const now = new Date();
  const diffDays = Math.floor((now - d) / 86_400_000);
  const t = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  if (diffDays === 0) return `Today at ${t}`;
  if (diffDays === 1) return `Yesterday at ${t}`;
  if (diffDays > 1 && diffDays < 7) return `${d.toLocaleDateString([], { weekday: 'long' })} at ${t}`;
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ` at ${t}`;
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

// ── Event listeners ───────────────────────────
document.querySelectorAll('.nav-btn[data-view]').forEach(btn => {
  btn.addEventListener('click', () => switchTab(btn.dataset.view));
});

document.getElementById('btn-log').addEventListener('click', openLog);
document.getElementById('nav-log-btn').addEventListener('click', openLog);
document.getElementById('btn-cancel').addEventListener('click', closeLog);

document.getElementById('seizure-form').addEventListener('submit', e => {
  e.preventDefault();
  const fd = new FormData(e.target);
  const rawTime = fd.get('time');

  addEntry({
    id: String(Date.now()),
    time: rawTime ? new Date(rawTime).toISOString() : new Date().toISOString(),
    type: fd.get('type') || 'Unknown',
    intensity: fd.get('intensity') || '',
    duration: fd.get('duration') || '',
    triggers: fd.getAll('triggers'),
    notes: String(fd.get('notes') || '').trim(),
  });

  closeLog();
  showSuccess();
});

// ── PWA ───────────────────────────────────────
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}

// ── Boot ──────────────────────────────────────
const greetEl = document.getElementById('greeting');
if (greetEl) greetEl.textContent = greeting();
renderHome();
