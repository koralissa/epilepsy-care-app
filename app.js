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

// ── Navigation ────────────────────────────────
function showHome() {
  const logScreen = document.getElementById('screen-log');
  const homeScreen = document.getElementById('screen-home');
  logScreen.classList.remove('active');
  logScreen.setAttribute('aria-hidden', 'true');
  homeScreen.classList.add('active');
  homeScreen.removeAttribute('aria-hidden');
  window.scrollTo({ top: 0 });
  renderHome();
}

function showLog() {
  const homeScreen = document.getElementById('screen-home');
  const logScreen = document.getElementById('screen-log');
  homeScreen.classList.remove('active');
  homeScreen.setAttribute('aria-hidden', 'true');
  logScreen.classList.add('active');
  logScreen.removeAttribute('aria-hidden');
  window.scrollTo({ top: 0 });
  resetForm();
}

// ── Form helpers ──────────────────────────────
function resetForm() {
  const form = document.getElementById('seizure-form');
  form.reset();
  // form.reset() restores "Not sure" (checked in HTML) and clears notes/duration.
  // Override the time input to right now.
  document.getElementById('seizure-time').value = localISO();
}

function localISO() {
  const d = new Date();
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// ── Render home ───────────────────────────────
function renderHome() {
  const entries = getEntries();
  const list = document.getElementById('entries-list');
  const countEl = document.getElementById('entry-count');

  if (entries.length === 0) {
    countEl.textContent = '';
    list.innerHTML = '<p class="empty-state">No entries yet.<br>Tap <strong>+ Log Seizure</strong> when you need it.</p>';
    return;
  }

  countEl.textContent = entries.length === 1 ? '1 entry' : `${entries.length} entries`;

  list.innerHTML = entries.map(e => `
    <article class="entry-card" role="listitem">
      <div class="entry-row">
        <span class="entry-type">${esc(e.type)}</span>
        ${e.duration ? `<span class="entry-pill">${esc(e.duration)}</span>` : ''}
      </div>
      <time class="entry-time" datetime="${esc(e.time)}">${fmtTime(e.time)}</time>
      ${e.notes ? `<p class="entry-notes">${esc(e.notes)}</p>` : ''}
    </article>
  `).join('');
}

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

// ── Success feedback ──────────────────────────
function showSuccess() {
  const overlay = document.getElementById('success-overlay');
  overlay.hidden = false;
  setTimeout(() => {
    overlay.hidden = true;
    showHome();
  }, 1800);
}

// ── Events ────────────────────────────────────
document.getElementById('btn-log').addEventListener('click', showLog);
document.getElementById('btn-back').addEventListener('click', showHome);

document.getElementById('seizure-form').addEventListener('submit', e => {
  e.preventDefault();
  const fd = new FormData(e.target);

  // datetime-local value is local time; convert to ISO string for unambiguous storage
  const rawTime = fd.get('time');
  const timeISO = rawTime ? new Date(rawTime).toISOString() : new Date().toISOString();

  addEntry({
    id: String(Date.now()),
    time: timeISO,
    type: fd.get('type') || 'Unknown',
    duration: fd.get('duration') || '',
    notes: String(fd.get('notes') || '').trim(),
  });

  showSuccess();
});

// ── PWA: offline support ──────────────────────
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}

// ── Boot ──────────────────────────────────────
renderHome();
