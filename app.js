'use strict';

const STORAGE_KEY    = 'epitrack_entries';
const OB_DONE_KEY    = 'vivea_onboarded';
const OB_PROFILE_KEY = 'vivea_profile';
const WELCOME_KEY    = 'vivea_welcomed';
const BANNER_KEY     = 'vivea_banner_dismissed';
const MED_LOG_PFX    = 'vivea_meds_';
const ACCOUNT_KEY    = 'vivea_account';

function getProfile() {
  try { return JSON.parse(localStorage.getItem(OB_PROFILE_KEY)); } catch { return null; }
}

function getAccount() {
  try { return JSON.parse(localStorage.getItem(ACCOUNT_KEY)); } catch { return null; }
}

function setAccount(a) { localStorage.setItem(ACCOUNT_KEY, JSON.stringify(a)); }

let _lastLoggedEntry = null;

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
let insightsGateDismissed = false;

function switchTab(tabName) {
  document.querySelectorAll('.tab-view').forEach(v => {
    v.hidden = v.id !== `view-${tabName}`;
  });
  document.querySelectorAll('.nav-btn[data-view]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === tabName);
  });
  if (tabName === 'insights') {
    const gate = document.getElementById('insights-gate');
    if (gate) gate.hidden = !!localStorage.getItem('vivea_account') || insightsGateDismissed;
    renderInsights();
    showHint('insights');
  } else {
    renderHome();
  }
}

// ── Log modal ─────────────────────────────────
function openLog() {
  const modal = document.getElementById('screen-log');
  modal.classList.add('active');
  modal.removeAttribute('aria-hidden');
  resetForm();
  showHint('seizure');
}

function closeLog() {
  const modal = document.getElementById('screen-log');
  modal.classList.remove('active');
  modal.setAttribute('aria-hidden', 'true');
}

// ── Form ──────────────────────────────────────
function resetForm() {
  document.getElementById('seizure-form').reset();
  document.getElementById('seizure-time').value = localISO();
  // Pre-select seizure type from profile if exactly one was set
  const profile = getProfile();
  if (profile && profile.seizureTypes && profile.seizureTypes.length === 1) {
    const val = profile.seizureTypes[0];
    const input = document.querySelector(`input[name="type"][value="${val}"]`);
    if (input) input.checked = true;
  }
}

function localISO() {
  const d = new Date();
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

// ── Render home ───────────────────────────────
function renderHome() {
  const entries = getEntries();
  const profile = getProfile();
  const greetEl = document.getElementById('greeting');
  if (greetEl) greetEl.textContent = greeting();

  // Stats
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const thisMonth = entries.filter(e => new Date(e.time) >= startOfMonth).length;
  document.getElementById('stat-month').textContent = String(thisMonth);

  // Seizure-type context in "This month" label
  const monthLabel = document.getElementById('stat-month-label');
  if (monthLabel) {
    const types = profile && profile.seizureTypes;
    monthLabel.textContent = (types && types.length === 1)
      ? `${types[0]} this month`
      : 'This month';
  }

  if (entries.length > 0) {
    const diff = Math.floor((now - new Date(entries[0].time)) / 86_400_000);
    document.getElementById('stat-last').textContent = diff === 0 ? 'Today' : String(diff);
  } else {
    document.getElementById('stat-last').textContent = '—';
  }

  renderMedsWidget();

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

// ── Category map ──────────────────────────────
// Maps category name → { css class, card icon SVG }
const CATEGORY_MAP = {
  Seizure: {
    cls:  'cat-seizure',
    icon: `<svg class="cat-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`,
  },
  Aura: {
    cls:  'cat-aura',
    icon: `<svg class="cat-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>`,
  },
  'Side effect': {
    cls:  'cat-side-effects',
    icon: `<svg class="cat-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg>`,
  },
  Medication: {
    cls:  'cat-medication',
    icon: `<svg class="cat-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z"/><path d="m8.5 8.5 7 7"/></svg>`,
  },
  Note: {
    cls:  'cat-journal',
    icon: `<svg class="cat-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="22"/></svg>`,
  },
};

const SEIZURE_SUBTYPES = new Set(['Tonic-clonic','Absence','Focal aware','Focal impaired','Myoclonic','Atonic','Unknown']);

function getEntryCategory(e) {
  if (e.category && CATEGORY_MAP[e.category]) return e.category;
  if (SEIZURE_SUBTYPES.has(e.type)) return 'Seizure';
  return CATEGORY_MAP[e.type] ? e.type : 'Seizure';
}

// ── Entry card HTML ───────────────────────────
function entryCardHTML(e) {
  const cat = getEntryCategory(e);
  const { cls, icon } = CATEGORY_MAP[cat] || CATEGORY_MAP.Seizure;
  const emoji = { Mild: '😐', Moderate: '😟', Severe: '😰' }[e.intensity] || '';
  const triggers = e.triggers || [];
  const displayType = cat === 'Seizure' ? esc(e.type || 'Unknown') : esc(cat);
  return `
    <article class="entry-card ${cls}" role="listitem">
      <div class="entry-top">
        <div class="entry-heading">
          ${icon}
          <span class="entry-type-badge">${displayType}</span>
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
    if (_lastLoggedEntry) {
      checkProgressiveProfiling(_lastLoggedEntry);
      _lastLoggedEntry = null;
    }
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
  const h    = new Date().getHours();
  const part = h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening';
  const acct = getAccount();
  const name = acct && acct.firstName ? `, ${acct.firstName}` : '';
  return `Good ${part}${name}`;
}

// ── Picker ────────────────────────────────────
function openPicker() {
  const sheet = document.getElementById('screen-picker');
  const scrim = document.getElementById('picker-scrim');
  sheet.classList.add('active');
  sheet.removeAttribute('aria-hidden');
  scrim.classList.add('active');
}

function closePicker() {
  const sheet = document.getElementById('screen-picker');
  const scrim = document.getElementById('picker-scrim');
  sheet.classList.remove('active');
  sheet.setAttribute('aria-hidden', 'true');
  scrim.classList.remove('active');
}

// ── Quick log (Aura / Side Effect / Medication / Note) ──
let quickCat = null;

function quickFormSections(cat) {
  if (cat === 'Aura') {
    return `
      <section class="form-section">
        <h3 class="form-section-label">Symptoms <span class="optional-tag">optional · select all that apply</span></h3>
        <div class="chip-row">
          <input type="checkbox" name="symptoms" id="au-sym-vis"   value="Visual disturbance" class="sr-only">
          <label for="au-sym-vis"   class="chip">Visual disturbance</label>
          <input type="checkbox" name="symptoms" id="au-sym-smell" value="Strange smell"       class="sr-only">
          <label for="au-sym-smell" class="chip">Strange smell</label>
          <input type="checkbox" name="symptoms" id="au-sym-deja"  value="Déjà vu"            class="sr-only">
          <label for="au-sym-deja"  class="chip">Déjà vu</label>
          <input type="checkbox" name="symptoms" id="au-sym-ting"  value="Tingling"           class="sr-only">
          <label for="au-sym-ting"  class="chip">Tingling</label>
          <input type="checkbox" name="symptoms" id="au-sym-fear"  value="Fear"               class="sr-only">
          <label for="au-sym-fear"  class="chip">Fear</label>
          <input type="checkbox" name="symptoms" id="au-sym-naus"  value="Nausea"             class="sr-only">
          <label for="au-sym-naus"  class="chip">Nausea</label>
          <input type="checkbox" name="symptoms" id="au-sym-oth"   value="Other"              class="sr-only">
          <label for="au-sym-oth"   class="chip">Other</label>
        </div>
      </section>
      <section class="form-section">
        <h3 class="form-section-label">Possible trigger <span class="optional-tag">optional · select all that apply</span></h3>
        <div class="chip-row">
          <input type="checkbox" name="triggers" id="au-tr-horm" value="Hormonal/cycle" class="sr-only">
          <label for="au-tr-horm" class="chip">Hormonal/cycle</label>
          <input type="checkbox" name="triggers" id="au-tr-bg"   value="Blood sugar"    class="sr-only">
          <label for="au-tr-bg"   class="chip">Blood sugar</label>
          <input type="checkbox" name="triggers" id="au-tr-str"  value="Stress"         class="sr-only">
          <label for="au-tr-str"  class="chip">Stress</label>
          <input type="checkbox" name="triggers" id="au-tr-slp"  value="Poor sleep"     class="sr-only">
          <label for="au-tr-slp"  class="chip">Poor sleep</label>
          <input type="checkbox" name="triggers" id="au-tr-unk"  value="Unknown"        class="sr-only">
          <label for="au-tr-unk"  class="chip">Unknown</label>
          <input type="checkbox" name="triggers" id="au-tr-oth"  value="Other"          class="sr-only">
          <label for="au-tr-oth"  class="chip">Other</label>
        </div>
      </section>
      <section class="form-section">
        <h3 class="form-section-label">Did it lead to a seizure?</h3>
        <div class="chip-row">
          <input type="radio" name="led-to-seizure" id="au-lts-y"  value="Yes"      class="sr-only">
          <label for="au-lts-y"  class="chip">Yes</label>
          <input type="radio" name="led-to-seizure" id="au-lts-n"  value="No"       class="sr-only">
          <label for="au-lts-n"  class="chip">No</label>
          <input type="radio" name="led-to-seizure" id="au-lts-ns" value="Not sure" class="sr-only" checked>
          <label for="au-lts-ns" class="chip">Not sure</label>
        </div>
      </section>
      <section class="form-section">
        <h3 class="form-section-label">Notes <span class="optional-tag">optional</span></h3>
        <textarea name="notes" class="input-field input-notes" rows="3" placeholder="Any other details…" autocomplete="off"></textarea>
      </section>`;
  }

  if (cat === 'Side effect') {
    return `
      <section class="form-section">
        <h3 class="form-section-label">Symptoms <span class="optional-tag">select all that apply</span></h3>
        <div class="chip-row">
          <input type="checkbox" name="symptoms" id="se-sym-diz"  value="Dizziness"     class="sr-only">
          <label for="se-sym-diz"  class="chip">Dizziness</label>
          <input type="checkbox" name="symptoms" id="se-sym-fat"  value="Fatigue"       class="sr-only">
          <label for="se-sym-fat"  class="chip">Fatigue</label>
          <input type="checkbox" name="symptoms" id="se-sym-mem"  value="Memory issues" class="sr-only">
          <label for="se-sym-mem"  class="chip">Memory issues</label>
          <input type="checkbox" name="symptoms" id="se-sym-mood" value="Mood changes"  class="sr-only">
          <label for="se-sym-mood" class="chip">Mood changes</label>
          <input type="checkbox" name="symptoms" id="se-sym-naus" value="Nausea"        class="sr-only">
          <label for="se-sym-naus" class="chip">Nausea</label>
          <input type="checkbox" name="symptoms" id="se-sym-oth"  value="Other"         class="sr-only">
          <label for="se-sym-oth"  class="chip">Other</label>
        </div>
      </section>
      <section class="form-section">
        <h3 class="form-section-label">Severity</h3>
        <div class="chip-row">
          <input type="radio" name="severity" id="se-sev-mild" value="Mild"     class="sr-only">
          <label for="se-sev-mild" class="chip">Mild</label>
          <input type="radio" name="severity" id="se-sev-mod"  value="Moderate" class="sr-only">
          <label for="se-sev-mod"  class="chip">Moderate</label>
          <input type="radio" name="severity" id="se-sev-sev"  value="Severe"   class="sr-only">
          <label for="se-sev-sev"  class="chip">Severe</label>
        </div>
      </section>
      <section class="form-section">
        <h3 class="form-section-label">Suspected medication <span class="optional-tag">optional</span></h3>
        <input type="text" name="medication" class="input-field" placeholder="e.g. Levetiracetam" autocomplete="off">
      </section>
      <section class="form-section">
        <h3 class="form-section-label">Notes <span class="optional-tag">optional</span></h3>
        <textarea name="notes" class="input-field input-notes" rows="3" placeholder="Any other details…" autocomplete="off"></textarea>
      </section>`;
  }

  if (cat === 'Medication') {
    return `
      <section class="form-section">
        <h3 class="form-section-label">Medication name</h3>
        <input type="text" name="medication" class="input-field" placeholder="e.g. Levetiracetam" autocomplete="off">
      </section>
      <section class="form-section">
        <h3 class="form-section-label">Dose <span class="optional-tag">optional</span></h3>
        <input type="text" name="dose" class="input-field" placeholder="e.g. 500 mg" autocomplete="off">
      </section>
      <section class="form-section">
        <h3 class="form-section-label">Reason</h3>
        <div class="chip-row">
          <input type="radio" name="reason" id="med-rsn-sch" value="Scheduled" class="sr-only">
          <label for="med-rsn-sch" class="chip">Scheduled</label>
          <input type="radio" name="reason" id="med-rsn-res" value="Rescue"    class="sr-only">
          <label for="med-rsn-res" class="chip">Rescue</label>
          <input type="radio" name="reason" id="med-rsn-mis" value="Missed"    class="sr-only">
          <label for="med-rsn-mis" class="chip">Missed</label>
          <input type="radio" name="reason" id="med-rsn-oth" value="Other"     class="sr-only">
          <label for="med-rsn-oth" class="chip">Other</label>
        </div>
      </section>
      <section class="form-section">
        <h3 class="form-section-label">Notes <span class="optional-tag">optional</span></h3>
        <textarea name="notes" class="input-field input-notes" rows="3" placeholder="Any other details…" autocomplete="off"></textarea>
      </section>`;
  }

  // Note
  return `
    <section class="form-section">
      <h3 class="form-section-label">Notes <span class="optional-tag">optional</span></h3>
      <textarea name="notes" class="input-field input-notes" rows="4" placeholder="What happened?" autocomplete="off"></textarea>
    </section>`;
}

function openQuickLog(cat) {
  quickCat = cat;
  document.getElementById('quick-log-title').textContent = cat;
  document.getElementById('quick-time').value = localISO();
  document.getElementById('quick-form-body').innerHTML = quickFormSections(cat);
  const modal = document.getElementById('screen-quick-log');
  modal.classList.add('active');
  modal.removeAttribute('aria-hidden');
  const hintKey = cat === 'Side effect' ? 'side-effect' : cat.toLowerCase();
  showHint(hintKey);
}

function closeQuickLog() {
  document.getElementById('screen-quick-log').classList.remove('active');
  document.getElementById('screen-quick-log').setAttribute('aria-hidden', 'true');
  quickCat = null;
}

// ── Event listeners ───────────────────────────
document.querySelectorAll('.nav-btn[data-view]').forEach(btn => {
  btn.addEventListener('click', () => switchTab(btn.dataset.view));
});

// Both log entry points open the picker
document.getElementById('btn-log').addEventListener('click', openPicker);
document.getElementById('nav-log-btn').addEventListener('click', openPicker);

// Picker dismiss
document.getElementById('btn-picker-cancel').addEventListener('click', closePicker);
document.getElementById('picker-scrim').addEventListener('click', closePicker);

// Picker item selection
document.querySelectorAll('.picker-item').forEach(btn => {
  btn.addEventListener('click', () => {
    const cat = btn.dataset.cat;
    closePicker();
    if (cat === 'Seizure') {
      openLog();
    } else {
      openQuickLog(cat);
    }
  });
});

// Seizure form
document.getElementById('btn-cancel').addEventListener('click', closeLog);

document.getElementById('seizure-form').addEventListener('submit', e => {
  e.preventDefault();
  const fd = new FormData(e.target);
  const rawTime = fd.get('time');
  _lastLoggedEntry = {
    id: String(Date.now()),
    time: rawTime ? new Date(rawTime).toISOString() : new Date().toISOString(),
    category: 'Seizure',
    type: fd.get('type') || 'Unknown',
    intensity: fd.get('intensity') || '',
    duration: fd.get('duration') || '',
    triggers: fd.getAll('triggers'),
    deviceUsed: fd.get('device-used') || '',
    notes: String(fd.get('notes') || '').trim(),
  };
  addEntry(_lastLoggedEntry);
  closeLog();
  showSuccess();
  showAccountBannerIfNeeded();
  setTimeout(showCaregiverPrompt, 900);
});

// Quick log form
document.getElementById('btn-quick-cancel').addEventListener('click', closeQuickLog);

document.getElementById('quick-form').addEventListener('submit', e => {
  e.preventDefault();
  const fd = new FormData(e.target);
  const rawTime = fd.get('time');
  const entry = {
    id: String(Date.now()),
    time: rawTime ? new Date(rawTime).toISOString() : new Date().toISOString(),
    category: quickCat,
    type: quickCat,
    notes: String(fd.get('notes') || '').trim(),
  };
  if (quickCat === 'Aura') {
    entry.symptoms = fd.getAll('symptoms');
    entry.triggers = fd.getAll('triggers');
    entry.ledToSeizure = fd.get('led-to-seizure') || 'Not sure';
  } else if (quickCat === 'Side effect') {
    entry.symptoms = fd.getAll('symptoms');
    entry.severity = fd.get('severity') || '';
    entry.medication = String(fd.get('medication') || '').trim();
  } else if (quickCat === 'Medication') {
    entry.medication = String(fd.get('medication') || '').trim();
    entry.dose = String(fd.get('dose') || '').trim();
    entry.reason = fd.get('reason') || '';
  }
  _lastLoggedEntry = entry;
  closeQuickLog();
  addEntry(entry);
  showSuccess();
});

// ── PWA ───────────────────────────────────────
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}

// ── Onboarding ─────────────────────────────────
const MED_LIST = [
  { brand: 'Keppra',    generic: 'levetiracetam' },
  { brand: 'Lamictal',  generic: 'lamotrigine' },
  { brand: 'Depakote',  generic: 'valproate' },
  { brand: 'Vimpat',    generic: 'lacosamide' },
  { brand: 'Topamax',   generic: 'topiramate' },
  { brand: 'Lyrica',    generic: 'pregabalin' },
  { brand: 'Tegretol',  generic: 'carbamazepine' },
  { brand: 'Zonegran',  generic: 'zonisamide' },
  { brand: 'Trileptal', generic: 'oxcarbazepine' },
  { brand: 'Onfi',      generic: 'clobazam' },
  { brand: 'Epidiolex', generic: 'cannabidiol' },
  { brand: 'Fycompa',   generic: 'perampanel' },
  { brand: 'Briviact',  generic: 'brivaracetam' },
  { brand: 'Xcopri',    generic: 'cenobamate' },
  { brand: 'Other',     generic: '' },
];

const FREQ_CONFIG = [
  null, // index 0 unused
  { label: 'Once daily',        labels: ['Time'],                                    defaults: ['08:00'] },
  { label: 'Twice daily',       labels: ['Morning', 'Evening'],                      defaults: ['08:00', '20:00'] },
  { label: 'Three times daily', labels: ['Morning', 'Afternoon', 'Evening'],         defaults: ['08:00', '14:00', '20:00'] },
  { label: 'Four times daily',  labels: ['Morning', 'Midday', 'Afternoon', 'Evening'], defaults: ['08:00', '12:00', '16:00', '20:00'] },
];

function buildMedCard(idx) {
  const card = document.createElement('div');
  card.className = 'ob-med-card';
  card.id = `ob-med-card-${idx}`;
  card.innerHTML = `
    <div class="ob-med-name-wrap">
      <input type="text" class="input-field ob-med-name" id="ob-med-${idx}"
        placeholder="Search medication…" autocomplete="off"
        autocapitalize="off" autocorrect="off" spellcheck="false">
      <div class="ob-med-dropdown" id="ob-dd-${idx}" hidden></div>
      <input type="text" class="input-field ob-med-other" id="ob-med-other-${idx}"
        placeholder="Enter medication name" autocomplete="off"
        autocapitalize="words" hidden>
    </div>

    <p class="ob-card-label">Dosage</p>
    <div class="ob-med-row">
      <input type="number" class="input-field ob-med-strength" id="ob-med-str-${idx}"
        placeholder="Amount" inputmode="decimal" min="0" autocomplete="off">
      <select class="input-field ob-med-unit" id="ob-med-unit-${idx}">
        <option value="mg">mg</option>
        <option value="mcg">mcg</option>
        <option value="g">g</option>
      </select>
    </div>

    <p class="ob-card-label">Frequency</p>
    <div class="chip-row ob-freq-chips" role="radiogroup" aria-label="Frequency">
      ${FREQ_CONFIG.slice(1).map((cfg, i) => `
        <input type="radio" name="ob-freq-${idx}" id="ob-freq-${idx}-${i+1}" value="${i+1}" class="sr-only">
        <label for="ob-freq-${idx}-${i+1}" class="chip">${esc(cfg.label)}</label>
      `).join('')}
    </div>

    <div class="ob-reminder-section" id="ob-rem-sec-${idx}" hidden>
      <div class="ob-reminder-toggle-row">
        <span class="ob-card-label" style="margin:0">Reminders</span>
        <label class="ob-toggle" aria-label="Enable reminders">
          <input type="checkbox" class="ob-rem-toggle" id="ob-rem-${idx}" checked>
          <span class="ob-toggle-track"></span>
        </label>
      </div>
      <div class="ob-times-list" id="ob-times-${idx}"></div>
    </div>`;

  // — Name search —
  const nameInput  = card.querySelector('.ob-med-name');
  const dropdown   = card.querySelector('.ob-med-dropdown');
  const otherInput = card.querySelector('.ob-med-other');

  function renderDropdown(q) {
    const lower = q.toLowerCase();
    const matches = lower
      ? MED_LIST.filter(m => m.brand.toLowerCase().includes(lower) || m.generic.toLowerCase().includes(lower))
      : MED_LIST;
    dropdown.innerHTML = matches.map(m =>
      `<button type="button" class="ob-dd-item" data-brand="${esc(m.brand)}">
        <span class="ob-dd-brand">${esc(m.brand)}</span>
        ${m.generic ? `<span class="ob-dd-generic">${esc(m.generic)}</span>` : ''}
       </button>`
    ).join('');
    dropdown.hidden = matches.length === 0;
    dropdown.querySelectorAll('.ob-dd-item').forEach(btn => {
      btn.addEventListener('mousedown', e => { e.preventDefault(); selectMed(btn.dataset.brand); });
    });
  }

  function selectMed(brand) {
    nameInput.value = brand;
    dropdown.hidden = true;
    otherInput.hidden = brand !== 'Other';
    if (brand === 'Other') setTimeout(() => otherInput.focus(), 0);
  }

  nameInput.addEventListener('focus', () => renderDropdown(nameInput.value));
  nameInput.addEventListener('input', () => renderDropdown(nameInput.value));
  nameInput.addEventListener('blur',  () => setTimeout(() => { dropdown.hidden = true; }, 160));

  // — Frequency → show reminder section + render time pickers —
  const remSection = card.querySelector('.ob-reminder-section');
  const timesList  = card.querySelector('.ob-times-list');
  const remToggle  = card.querySelector('.ob-rem-toggle');

  function renderTimes(freq) {
    const cfg = FREQ_CONFIG[freq];
    if (!cfg) return;
    timesList.innerHTML = cfg.labels.map((lbl, j) =>
      `<div class="ob-time-row">
        <span class="ob-time-label">${esc(lbl)}</span>
        <input type="time" class="input-field ob-time-input" id="ob-time-${idx}-${j}" value="${cfg.defaults[j]}">
       </div>`
    ).join('');
  }

  card.querySelectorAll('.ob-freq-chips input[type="radio"]').forEach(radio => {
    radio.addEventListener('change', () => {
      const freq = parseInt(radio.value, 10);
      remSection.hidden = false;
      renderTimes(freq);
    });
  });

  remToggle.addEventListener('change', () => {
    timesList.style.display = remToggle.checked ? '' : 'none';
  });

  return card;
}

let obIdx = 0;

function obGetFlow() {
  const who = document.querySelector('input[name="ob-who"]:checked');
  return (who && who.value === 'caregiver') ? [1,2,3,4,6,7] : [1,2,3,4,5,6,7];
}

function obUpdateHeader() {
  const flow = obGetFlow();
  const total = flow.length;
  const current = obIdx + 1;
  document.getElementById('ob-step').textContent = `Step ${current} of ${total}`;
  document.getElementById('ob-back').style.visibility = obIdx === 0 ? 'hidden' : 'visible';
  document.getElementById('ob-progress-fill').style.width = `${Math.round((current / total) * 100)}%`;
}

function obNavigate(nextIdx, direction) {
  const flow = obGetFlow();
  const fromEl = document.getElementById(`ob-s${flow[obIdx]}`);
  const toEl   = document.getElementById(`ob-s${flow[nextIdx]}`);

  // Place incoming at its start position without transition
  toEl.style.transition = 'none';
  toEl.style.transform  = direction === 'forward' ? 'translateX(100%)' : 'translateX(-30%)';
  toEl.style.opacity    = '0';
  toEl.style.pointerEvents = 'none';

  // Force reflow
  toEl.getBoundingClientRect();

  // Re-enable transitions and animate both screens
  toEl.style.transition = '';
  fromEl.style.transform    = direction === 'forward' ? 'translateX(-30%)' : 'translateX(100%)';
  fromEl.style.opacity      = '0';
  fromEl.style.pointerEvents = 'none';
  toEl.style.transform    = 'translateX(0)';
  toEl.style.opacity      = '1';
  toEl.style.pointerEvents = 'auto';

  obIdx = nextIdx;
  obUpdateHeader();
  obOnArrive(flow[nextIdx]);
}

function obOnArrive(screenNum) {
  if (screenNum === 2) {
    const who = document.querySelector('input[name="ob-who"]:checked');
    document.getElementById('ob-s2-helper').hidden = !(who && who.value === 'newly_diagnosed');
    // Recalculate total now that we know user type
    obUpdateHeader();
  }
  if (screenNum === 4) {
    const who = document.querySelector('input[name="ob-who"]:checked');
    document.getElementById('ob-s4-helper').hidden = !(who && who.value === 'newly_diagnosed');
  }
}

function obGoNext() {
  const flow = obGetFlow();
  if (obIdx < flow.length - 1) obNavigate(obIdx + 1, 'forward');
}

function obGoBack() {
  if (obIdx > 0) obNavigate(obIdx - 1, 'back');
}

let obMedCount = 0;

function obInitMedCards() {
  if (obMedCount > 0) return;
  obAddMedCard();
}

function obAddMedCard() {
  if (obMedCount >= 3) return;
  document.getElementById('ob-med-cards').appendChild(buildMedCard(obMedCount));
  obMedCount++;
  document.getElementById('ob-med-add').hidden = obMedCount >= 3;
}

function obCollectProfile() {
  const who = document.querySelector('input[name="ob-who"]:checked');
  const meds = document.querySelector('input[name="ob-meds"]:checked');
  const cycle = document.querySelector('input[name="ob-cycle"]:checked');
  const device = document.querySelector('input[name="ob-device"]:checked');
  const deviceType = document.querySelector('input[name="ob-device-type"]:checked');
  const noneEl = document.getElementById('ob-tr-none');
  const dontKnow = noneEl && noneEl.checked;

  const medications = [];
  document.querySelectorAll('.ob-med-card').forEach(card => {
    const nameInput  = card.querySelector('.ob-med-name');
    const otherInput = card.querySelector('.ob-med-other');
    const strInput   = card.querySelector('.ob-med-strength');
    const unitSel    = card.querySelector('.ob-med-unit');
    const freqRadio  = card.querySelector('.ob-freq-chips input[type="radio"]:checked');
    const remToggle  = card.querySelector('.ob-rem-toggle');
    const rawName    = nameInput ? nameInput.value.trim() : '';
    if (!rawName) return;
    const finalName  = rawName === 'Other'
      ? (otherInput && otherInput.value.trim() ? otherInput.value.trim() : 'Other')
      : rawName;
    medications.push({
      name:          finalName,
      strength:      strInput   ? strInput.value.trim()         : '',
      unit:          unitSel    ? unitSel.value                 : 'mg',
      timesPerDay:   freqRadio  ? parseInt(freqRadio.value, 10) : null,
      reminders:     remToggle  ? remToggle.checked             : false,
      reminderTimes: [...card.querySelectorAll('.ob-time-input')].map(t => t.value).filter(Boolean),
    });
  });

  return {
    userType:     who ? who.value : null,
    seizureTypes: [...document.querySelectorAll('input[name="ob-types"]:checked')].map(i => i.value),
    takingMeds:   meds ? meds.value : null,
    medications,
    triggers:     dontKnow ? [] : [...document.querySelectorAll('input[name="ob-triggers"]:checked')].map(i => i.value),
    dontKnowTriggers: dontKnow || false,
    trackCycle:   cycle ? cycle.value : null,
    hasDevice:    device ? device.value : null,
    deviceType:   deviceType ? deviceType.value : null,
  };
}

function obComplete() {
  const profile = obCollectProfile();
  localStorage.setItem(OB_DONE_KEY, 'true');
  localStorage.setItem(OB_PROFILE_KEY, JSON.stringify(profile));
  const acct = getAccount();
  if (acct) {
    acct.hasProfile = true;
    acct.profileCompleteness = calcProfileCompleteness(profile);
    setAccount(acct);
  }

  const shell = document.getElementById('screen-onboarding');
  shell.style.opacity = '0';
  setTimeout(() => { shell.hidden = true; shell.style.opacity = ''; }, 350);

  localStorage.setItem(WELCOME_KEY, '1');
  applyProfile(profile);
  renderHome();
}

// ── Profile application ────────────────────────
function applyProfile(profile) {
  if (!profile) return;

  // 1. Trigger chip(s): replace "Missed meds" with per-medication chips
  if (profile.takingMeds === 'yes' && profile.medications && profile.medications.length > 0) {
    const names = profile.medications
      .map(m => (typeof m === 'object' ? m.name : String(m)))
      .filter(Boolean);
    const inp = document.getElementById('tr-meds');
    const lbl = document.querySelector('label[for="tr-meds"]');
    if (inp && lbl && names.length > 0) {
      inp.value = `Missed ${names[0]}`;
      lbl.textContent = `Missed ${names[0]}`;
      // Add extra chips for each additional medication
      let anchor = lbl;
      names.slice(1).forEach((name, i) => {
        const id  = `tr-meds-extra-${i}`;
        const ni  = document.createElement('input');
        ni.type   = 'checkbox'; ni.name = 'triggers'; ni.id = id;
        ni.value  = `Missed ${name}`; ni.className = 'sr-only';
        const nl  = document.createElement('label');
        nl.htmlFor = id; nl.className = 'chip';
        nl.textContent = `Missed ${name}`;
        anchor.after(nl);
        anchor.after(ni);
        anchor = nl;
      });
    }
  }

  // 2. Show/hide Hormonal/cycle trigger chip
  if (profile.trackCycle === 'no' || profile.userType === 'caregiver') {
    const inp = document.getElementById('tr-horm');
    const lbl = document.querySelector('label[for="tr-horm"]');
    if (inp) inp.style.display = 'none';
    if (lbl) lbl.style.display = 'none';
  }

  // 3. Show device section if user has a neurostimulator
  if (profile.hasDevice === 'yes') {
    const sec = document.getElementById('device-section');
    if (sec) sec.hidden = false;
  }

  // 4. Caregiver mode: swap language
  if (profile.userType === 'caregiver') {
    document.querySelectorAll('[data-caregiver-placeholder]').forEach(el => {
      el.placeholder = el.dataset.caregiverPlaceholder;
    });
    document.querySelectorAll('[data-caregiver-text]').forEach(el => {
      el.textContent = el.dataset.caregiverText;
    });
  }

  // 5. Newly diagnosed: enable feature hints
  if (profile.userType === 'newly_diagnosed') {
    window._viveaHints = true;
  }

  // Profile stored in localStorage for any future Pattern Agent calls
}

// ── Feature hints (newly diagnosed) ───────────
const HINT_TEXT = {
  seizure:      'Log every seizure, even mild ones — patterns in your data help your doctor adjust treatment.',
  aura:         'An aura is an early warning sign before a seizure. Logging auras helps identify what to watch for.',
  'side-effect':'Side effects are important to track. Your doctor needs this to fine-tune your medication.',
  medication:   'Tracking each dose — scheduled, missed, or rescue — helps show your adherence over time.',
  insights:     'Your seizure patterns will appear here over time. Share this view with your neurologist.',
};

function showHint(key) {
  if (!window._viveaHints) return;
  const hintKey = `vivea_hint_${key}`;
  if (localStorage.getItem(hintKey)) return;
  localStorage.setItem(hintKey, '1');

  const text = HINT_TEXT[key];
  if (!text) return;

  const targetMap = {
    seizure:       document.querySelector('#screen-log .form-scroll'),
    insights:      document.getElementById('view-insights'),
  };
  const target = targetMap[key] || document.querySelector('#screen-quick-log .form-scroll');
  if (!target) return;

  const hint = document.createElement('div');
  hint.className = 'ob-hint';
  hint.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg><span>${esc(text)}</span>`;
  target.prepend(hint);

  setTimeout(() => {
    hint.style.transition = 'opacity 0.4s ease';
    hint.style.opacity = '0';
    setTimeout(() => hint.remove(), 400);
  }, 6000);
}

// ── Today's medications widget ────────────────
function todayDateKey() {
  const d = new Date();
  return `${MED_LOG_PFX}${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function getMedLog() {
  try { return JSON.parse(localStorage.getItem(todayDateKey())) || {}; } catch { return {}; }
}

function saveMedLog(log) {
  localStorage.setItem(todayDateKey(), JSON.stringify(log));
}

function markMedTaken(mi, ti) {
  const log = getMedLog();
  log[`${mi}_${ti}`] = { taken: true, at: new Date().toISOString() };
  saveMedLog(log);
  renderMedsWidget();
}

function fmt12(h, m) {
  return `${h % 12 || 12}:${String(m).padStart(2,'0')} ${h >= 12 ? 'PM' : 'AM'}`;
}

function renderMedsWidget() {
  const widget = document.getElementById('meds-widget');
  if (!widget) return;

  const profile = getProfile();
  if (!profile || profile.takingMeds !== 'yes') { widget.hidden = true; return; }

  const meds = (profile.medications || []).filter(
    m => typeof m === 'object' && m.timesPerDay > 0 && m.reminders !== false
  );
  if (!meds.length) { widget.hidden = true; return; }

  const log    = getMedLog();
  const now    = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();

  let total = 0, taken = 0;

  const rows = meds.map((med, mi) => {
    const name   = esc(med.name || '?');
    const dose   = med.strength ? esc(`${med.strength}${med.unit || 'mg'}`) : '';
    const freq   = FREQ_CONFIG[med.timesPerDay];
    const times  = (med.reminderTimes && med.reminderTimes.length) ? med.reminderTimes : (freq ? freq.defaults : []);
    const labels = freq ? freq.labels : times.map((_, i) => `Dose ${i+1}`);

    const slots = times.map((t, ti) => {
      const key   = `${mi}_${ti}`;
      const isTaken = !!(log[key] && log[key].taken);
      total++;
      if (isTaken) taken++;

      const [h, m] = t.split(':').map(Number);
      const slotMin = h * 60 + m;
      let icon, statusText, cls;
      if (isTaken)            { icon = '✓'; statusText = 'Taken';           cls = 'taken'; }
      else if (nowMin < slotMin) { icon = '○'; statusText = fmt12(h, m);   cls = 'due';   }
      else                    { icon = '—'; statusText = 'Missed';          cls = 'missed';}

      return `<button class="med-slot med-slot-${cls}" data-mi="${mi}" data-ti="${ti}"${isTaken ? ' disabled aria-disabled="true"' : ''}>
        <span class="med-slot-icon">${icon}</span>
        <span class="med-slot-label">${esc(labels[ti] || `Dose ${ti+1}`)}</span>
        <span class="med-slot-status">${statusText}</span>
      </button>`;
    }).join('');

    return `<div class="meds-widget-row">
      <div class="meds-widget-med-name">${name}${dose ? `<span class="meds-widget-dose">${dose}</span>` : ''}</div>
      <div class="meds-widget-slots">${slots}</div>
    </div>`;
  }).join('');

  widget.hidden = false;

  if (total > 0 && taken === total) {
    widget.innerHTML = `<div class="meds-widget-all-taken">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6L9 17l-5-5"/></svg>
      All medications taken today</div>`;
    return;
  }

  widget.innerHTML = `<h3 class="meds-widget-title">Today's Medications</h3>${rows}`;
  widget.querySelectorAll('.med-slot:not([disabled])').forEach(btn => {
    btn.addEventListener('click', () => markMedTaken(+btn.dataset.mi, +btn.dataset.ti));
  });
}

// ── Account banner ────────────────────────────
function showAccountBannerIfNeeded() {
  if (getAccount()) return;
  if (localStorage.getItem(BANNER_KEY)) return;
  if (!getEntries().length) return;
  const banner = document.getElementById('account-banner');
  if (banner) banner.hidden = false;
}

// ── Account / auth ─────────────────────────────
function createAccount(firstName, email, password) {
  // Replace with Supabase auth V2
  const account = {
    firstName: firstName.trim(),
    email: email.trim().toLowerCase(),
    _passwordHash: btoa(encodeURIComponent(password)),
    createdAt: new Date().toISOString(),
    hasProfile: false,
    profileCompleteness: 0,
  };
  setAccount(account);
  localStorage.setItem(WELCOME_KEY, '1');
  return account;
}

function signInWithEmail(email, password) {
  // Replace with Supabase auth V2
  const acct = getAccount();
  if (!acct) return false;
  if (acct.email !== email.trim().toLowerCase()) return false;
  return acct._passwordHash === btoa(encodeURIComponent(password));
}

function openAuthCreate() {
  document.getElementById('screen-welcome').hidden = true;
  document.getElementById('screen-auth-signin').hidden = true;
  document.getElementById('screen-auth-create').hidden = false;
}

function closeAuthCreate() {
  document.getElementById('screen-auth-create').hidden = true;
}

function openAuthSuccess(firstName) {
  const nameEl = document.getElementById('auth-success-name');
  if (nameEl) nameEl.textContent = firstName || 'there';
  closeAuthCreate();
  document.getElementById('screen-auth-signin').hidden = true;
  document.getElementById('screen-auth-success').hidden = false;
}

function closeAuthSuccess() {
  document.getElementById('screen-auth-success').hidden = true;
}

function openAuthSignin() {
  document.getElementById('screen-welcome').hidden = true;
  document.getElementById('screen-auth-create').hidden = true;
  document.getElementById('screen-auth-signin').hidden = false;
}

function returnToWelcome() {
  document.getElementById('screen-auth-create').hidden = true;
  document.getElementById('screen-auth-signin').hidden = true;
  document.getElementById('screen-welcome').hidden = false;
}

// ── Progressive profiling ──────────────────────
let _ppShownThisSession = false;

function ppGetAsked() {
  const p = getProfile() || {};
  return p.askedQuestions || [];
}

function ppMarkAsked(questionId) {
  const p = getProfile() || {};
  if (!p.askedQuestions) p.askedQuestions = [];
  if (!p.askedQuestions.includes(questionId)) p.askedQuestions.push(questionId);
  localStorage.setItem(OB_PROFILE_KEY, JSON.stringify(p));
}

function ppSaveAnswer(key, value) {
  const p = getProfile() || {};
  p[key] = value;
  localStorage.setItem(OB_PROFILE_KEY, JSON.stringify(p));
}

function checkProgressiveProfiling(entry) {
  if (_ppShownThisSession) return;
  const entries = getEntries();
  const asked   = ppGetAsked();
  let question  = null;

  // Trigger 1: first seizure with known type
  if (!question && !asked.includes('pp-seizure-type') &&
      entry.category === 'Seizure' && entry.type && entry.type !== 'Unknown') {
    if (entries.filter(e => e.category === 'Seizure').length === 1) {
      const t = entry.type;
      question = {
        id: 'pp-seizure-type',
        text: `Is ${t} your most common seizure type?`,
        choices: [
          { label: 'Yes, most common',        action: () => ppSaveAnswer('seizureTypes', [t]) },
          { label: 'No, I have multiple types', action: () => ppSaveAnswer('seizureTypes', ['Multiple types']) },
          { label: 'Not sure yet',             action: () => {} },
        ],
      };
    }
  }

  // Trigger 2: first medication logged
  if (!question && !asked.includes('pp-med-daily') &&
      entry.category === 'Medication' && entry.medication) {
    if (entries.filter(e => e.category === 'Medication').length === 1) {
      const m = entry.medication;
      question = {
        id: 'pp-med-daily',
        text: `Is ${m} a daily medication?`,
        choices: [
          { label: 'Yes, I take it daily', action: () => {
            const p = getProfile() || {};
            const meds = p.medications || [];
            if (!meds.some(x => x.name === m)) {
              meds.push({ name: m, strength: '', unit: 'mg', timesPerDay: 1, reminders: false, reminderTimes: [] });
            }
            ppSaveAnswer('medications', meds);
            ppSaveAnswer('takingMeds', 'yes');
          }},
          { label: 'No, only as needed', action: () => {} },
          { label: 'Not sure',           action: () => {} },
        ],
      };
    }
  }

  // Trigger 3: same trigger selected twice
  if (!question && !asked.includes('pp-common-trigger') && (entry.triggers || []).length) {
    const allTriggers = entries.flatMap(e => e.triggers || []);
    const counts = {};
    allTriggers.forEach(t => { counts[t] = (counts[t] || 0) + 1; });
    const repeated = (entry.triggers || []).find(t => (counts[t] || 0) >= 2);
    if (repeated) {
      question = {
        id: 'pp-common-trigger',
        text: `${repeated} has come up a few times. Is this a common trigger for you?`,
        choices: [
          { label: 'Yes, track it closely', action: () => {
            const p = getProfile() || {};
            const confirmed = p.confirmedTriggers || [];
            if (!confirmed.includes(repeated)) confirmed.push(repeated);
            ppSaveAnswer('confirmedTriggers', confirmed);
          }},
          { label: 'Sometimes',    action: () => {} },
          { label: 'Not sure yet', action: () => {} },
        ],
      };
    }
  }

  // Trigger 4: 3rd seizure logged
  if (!question && !asked.includes('pp-frequency-baseline')) {
    if (entries.filter(e => e.category === 'Seizure').length === 3) {
      question = {
        id: 'pp-frequency-baseline',
        text: "You've logged 3 seizures. Is this typical for you?",
        choices: [
          { label: 'Higher than usual', action: () => ppSaveAnswer('frequencyBaseline', 'higher') },
          { label: 'About typical',     action: () => ppSaveAnswer('frequencyBaseline', 'typical') },
          { label: 'Lower than usual',  action: () => ppSaveAnswer('frequencyBaseline', 'lower') },
        ],
      };
    }
  }

  // Trigger 5: 7+ unique logging days
  if (!question && !asked.includes('pp-user-type')) {
    const uniqueDays = new Set(entries.map(e => new Date(e.time).toDateString())).size;
    if (uniqueDays >= 7) {
      question = {
        id: 'pp-user-type',
        text: "How long have you been living with epilepsy?",
        choices: [
          { label: 'Under 6 months',      action: () => ppSaveAnswer('userType', 'newly_diagnosed') },
          { label: '6 months to 2 years', action: () => ppSaveAnswer('userType', 'living') },
          { label: 'More than 2 years',   action: () => ppSaveAnswer('userType', 'living') },
          { label: "I'm a caregiver",     action: () => ppSaveAnswer('userType', 'caregiver') },
        ],
      };
    }
  }

  // Trigger 6: first aura logged
  if (!question && !asked.includes('pp-aura-pattern') && entry.category === 'Aura') {
    if (entries.filter(e => e.category === 'Aura').length === 1) {
      question = {
        id: 'pp-aura-pattern',
        text: "Do your auras usually come before a seizure?",
        choices: [
          { label: "Yes, they're a warning sign", action: () => ppSaveAnswer('auraPattern', 'warning') },
          { label: 'Sometimes',                   action: () => ppSaveAnswer('auraPattern', 'sometimes') },
          { label: 'Not usually',                 action: () => ppSaveAnswer('auraPattern', 'rarely') },
          { label: 'Not sure',                    action: () => ppSaveAnswer('auraPattern', 'unknown') },
        ],
      };
    }
  }

  if (question) {
    _ppShownThisSession = true;
    showPPSheet(question);
  }
}

function showPPSheet(question) {
  const scrim = document.getElementById('pp-scrim');
  const sheet = document.getElementById('screen-pp-sheet');
  const qEl   = document.getElementById('pp-question');
  const cEl   = document.getElementById('pp-choices');

  qEl.textContent = question.text;
  cEl.innerHTML   = '';

  question.choices.forEach(choice => {
    const btn = document.createElement('button');
    btn.className   = 'pp-choice';
    btn.textContent = choice.label;
    btn.addEventListener('click', () => {
      choice.action();
      ppMarkAsked(question.id);
      closePPSheet();
      renderHome();
    });
    cEl.appendChild(btn);
  });

  scrim.hidden = false;
  sheet.hidden = false;
  requestAnimationFrame(() => requestAnimationFrame(() => {
    sheet.classList.add('active');
  }));
}

function closePPSheet() {
  const sheet = document.getElementById('screen-pp-sheet');
  const scrim = document.getElementById('pp-scrim');
  sheet.classList.remove('active');
  setTimeout(() => { sheet.hidden = true; scrim.hidden = true; }, 320);
}

// ── Caregiver notify ──────────────────────────
function showCaregiverPrompt() {
  const profile = getProfile();
  if (!profile || !profile.caregiver || !profile.caregiver.name) return;
  const overlay = document.getElementById('caregiver-notify');
  const nameEl  = document.getElementById('caregiver-notify-name');
  if (nameEl) nameEl.textContent = profile.caregiver.name;
  if (overlay) overlay.hidden = false;
}

// ── Profile modal ─────────────────────────────
function calcProfileCompleteness(profile) {
  if (!profile) return 0;
  const checks = [
    !!profile.userType,
    (profile.seizureTypes || []).length > 0,
    !!profile.takingMeds,
    (profile.triggers || []).length > 0 || !!profile.dontKnowTriggers,
    profile.trackCycle !== null && profile.trackCycle !== undefined,
    !!(profile.caregiver && profile.caregiver.name),
  ];
  return Math.round(checks.filter(Boolean).length / checks.length * 100);
}

function accountProfileHTML() {
  const acct = getAccount();
  if (!acct) return '';
  return `<div class="form-section profile-account-section">
    <h3 class="form-section-label">Account</h3>
    <div class="profile-row">
      <span class="profile-row-label">Name</span>
      <span class="profile-row-value">${esc(acct.firstName)}</span>
    </div>
    <div class="profile-row">
      <span class="profile-row-label">Email</span>
      <span class="profile-row-value">${esc(acct.email)}</span>
    </div>
  </div>`;
}

function profileCompletionHTML(profile) {
  const pct = calcProfileCompleteness(profile);
  return `<div class="form-section profile-completion">
    <div class="profile-completion-row">
      <span>Profile complete</span>
      <strong>${pct}%</strong>
    </div>
    <div class="profile-completion-bar">
      <div class="profile-completion-fill" style="width:${pct}%"></div>
    </div>
  </div>`;
}

function openProfile() {
  const modal = document.getElementById('screen-profile');
  renderProfile();
  modal.classList.add('active');
  modal.removeAttribute('aria-hidden');
}

function closeProfile() {
  const modal = document.getElementById('screen-profile');
  modal.classList.remove('active');
  modal.setAttribute('aria-hidden', 'true');
}

function renderProfile() {
  const profile = getProfile();
  const scroll  = document.getElementById('profile-scroll');

  if (!profile) {
    scroll.innerHTML = `
      ${accountProfileHTML()}
      <div class="form-section profile-empty-state">
        <p class="profile-empty-text">Complete your profile to personalize Vivea and enable medication reminders.</p>
        <button class="btn-save" id="btn-profile-setup-link" style="margin-top:4px">Set up my profile</button>
      </div>
      ${caregiverSectionHTML(null)}`;
    document.getElementById('btn-profile-setup-link').addEventListener('click', () => {
      closeProfile();
      document.getElementById('screen-onboarding').hidden = false;
      obInitScreens();
    });
  } else {
    scroll.innerHTML = accountProfileHTML() + profileCompletionHTML(profile) + myProfileHTML(profile) + medsProfileHTML(profile) + caregiverSectionHTML(profile);
    const addMedBtn = document.getElementById('btn-profile-add-med');
    if (addMedBtn) addMedBtn.addEventListener('click', () => {
      closeProfile();
      document.getElementById('screen-onboarding').hidden = false;
      obInitScreens();
    });
  }
  wireCaregiverSection();
}

function myProfileHTML(profile) {
  const typeLabels = {
    newly_diagnosed: 'Newly diagnosed',
    living:          'Living with epilepsy',
    caregiver:       'Caregiver',
    professional:    'Healthcare professional',
  };
  const seiz = (profile.seizureTypes || []).join(', ') || '—';
  return `<div class="form-section">
    <h3 class="form-section-label">My Profile</h3>
    <div class="profile-row">
      <span class="profile-row-label">I am</span>
      <span class="profile-row-value">${esc(typeLabels[profile.userType] || profile.userType || '—')}</span>
    </div>
    ${(profile.seizureTypes || []).length ? `
    <div class="profile-row">
      <span class="profile-row-label">Seizure types</span>
      <span class="profile-row-value">${esc(seiz)}</span>
    </div>` : ''}
  </div>`;
}

function medsProfileHTML(profile) {
  if (profile.takingMeds !== 'yes' || !(profile.medications || []).length) {
    return `<div class="form-section">
      <h3 class="form-section-label">Medications</h3>
      <p class="profile-empty-text">No medications set up.</p>
      <button class="ob-btn-add" id="btn-profile-add-med">+ Add medications</button>
    </div>`;
  }
  const medRows = profile.medications.map(med => {
    const name = esc(typeof med === 'object' ? (med.name || '?') : String(med));
    const dose = (med.strength) ? esc(`${med.strength}${med.unit || 'mg'}`) : '';
    const freq = med.timesPerDay ? (FREQ_CONFIG[med.timesPerDay] || {}).label || '' : '';
    return `<div class="profile-med-row">
      <div class="profile-med-name">${name}${dose ? `<span class="profile-med-dose">${dose}</span>` : ''}</div>
      ${freq ? `<div class="profile-med-freq">${esc(freq)}</div>` : ''}
    </div>`;
  }).join('');
  return `<div class="form-section"><h3 class="form-section-label">Medications</h3>${medRows}</div>`;
}

function caregiverSectionHTML(profile) {
  const cg = profile && profile.caregiver;
  const prefLabels = {
    every: 'Notified after every seizure',
    severe: 'Severe seizures only',
    notify_me_first: 'You contact them',
  };
  if (cg && cg.name) {
    return `<div class="form-section">
      <h3 class="form-section-label">Caregiver</h3>
      <div class="profile-cg-card">
        <div class="profile-cg-name">${esc(cg.name)}</div>
        <div class="profile-cg-detail">${esc(cg.phone)}${cg.email ? ` · ${esc(cg.email)}` : ''}</div>
        <div class="profile-cg-pref">${esc(prefLabels[cg.notifyPref] || cg.notifyPref || '')}</div>
      </div>
      <button class="ob-btn-add" id="btn-edit-caregiver">Edit</button>
      <div id="caregiver-form-wrap" hidden>${caregiverFormHTML(cg)}</div>
    </div>`;
  }
  return `<div class="form-section">
    <h3 class="form-section-label">Caregiver</h3>
    <p class="profile-section-desc">Add a caregiver who can see your logs and be notified after a seizure is logged.</p>
    <button class="ob-btn-add" id="btn-add-caregiver">+ Add caregiver</button>
    <div id="caregiver-form-wrap" hidden>${caregiverFormHTML(null)}</div>
  </div>`;
}

function caregiverFormHTML(cg) {
  const v = cg || {};
  const checked = pref => (v.notifyPref === pref || (!v.notifyPref && pref === 'every')) ? ' checked' : '';
  return `<div class="caregiver-form">
    <div class="form-section-inner">
      <label class="ob-card-label" for="cg-name">Name</label>
      <input type="text"  id="cg-name"  class="input-field" placeholder="Jane Smith"        value="${esc(v.name  || '')}">
    </div>
    <div class="form-section-inner">
      <label class="ob-card-label" for="cg-phone">Phone</label>
      <input type="tel"   id="cg-phone" class="input-field" placeholder="+1 555 000 0000"   value="${esc(v.phone || '')}">
    </div>
    <div class="form-section-inner">
      <label class="ob-card-label" for="cg-email">Email <span class="optional-tag">optional</span></label>
      <input type="email" id="cg-email" class="input-field" placeholder="jane@example.com"  value="${esc(v.email || '')}">
    </div>
    <div class="form-section-inner">
      <p class="ob-card-label" style="margin-bottom:8px">Notification preference</p>
      <div class="chip-row">
        <input type="radio" name="cg-notify" id="cg-n-every"  value="every"           class="sr-only"${checked('every')}>
        <label for="cg-n-every"  class="chip">After every seizure</label>
        <input type="radio" name="cg-notify" id="cg-n-severe" value="severe"          class="sr-only"${checked('severe')}>
        <label for="cg-n-severe" class="chip">Severe only</label>
        <input type="radio" name="cg-notify" id="cg-n-me"     value="notify_me_first" class="sr-only"${checked('notify_me_first')}>
        <label for="cg-n-me"     class="chip">Notify me first</label>
      </div>
    </div>
    <button type="button" class="btn-save" id="btn-save-caregiver" style="margin-top:8px">Save caregiver</button>
  </div>`;
}

function wireCaregiverSection() {
  const addBtn   = document.getElementById('btn-add-caregiver');
  const editBtn  = document.getElementById('btn-edit-caregiver');
  const formWrap = document.getElementById('caregiver-form-wrap');
  const saveBtn  = document.getElementById('btn-save-caregiver');

  if (addBtn)  addBtn.addEventListener('click',  () => { formWrap.hidden = false; addBtn.hidden = true; });
  if (editBtn) editBtn.addEventListener('click', () => { formWrap.hidden = false; });
  if (saveBtn) saveBtn.addEventListener('click', saveCaregiverProfile);
}

function saveCaregiverProfile() {
  const name     = (document.getElementById('cg-name')  || {}).value || '';
  const phone    = (document.getElementById('cg-phone') || {}).value || '';
  const email    = (document.getElementById('cg-email') || {}).value || '';
  const prefEl   = document.querySelector('input[name="cg-notify"]:checked');
  const notifyPref = prefEl ? prefEl.value : 'every';

  if (!name.trim() || !phone.trim()) {
    alert('Name and phone number are required.');
    return;
  }

  const profile = getProfile() || {};
  profile.caregiver = { name: name.trim(), phone: phone.trim(), email: email.trim(), notifyPref };
  localStorage.setItem(OB_PROFILE_KEY, JSON.stringify(profile));
  renderProfile();
}

// ── Welcome screen ────────────────────────────
function obInitScreens() {
  obIdx = 0;
  obMedCount = 0;
  document.getElementById('ob-med-cards').innerHTML = '';
  document.getElementById('ob-med-inputs').hidden = true;
  document.getElementById('ob-med-add').hidden = false;
  // Reset radio states for med question
  document.querySelectorAll('input[name="ob-meds"]').forEach(r => { r.checked = false; });

  document.getElementById('screen-onboarding').hidden = false;
  const obScreens = document.querySelectorAll('.ob-screen');
  obScreens.forEach((el, i) => {
    el.style.transform     = i === 0 ? 'translateX(0)'   : 'translateX(100%)';
    el.style.opacity       = i === 0 ? '1'               : '0';
    el.style.pointerEvents = i === 0 ? 'auto'            : 'none';
  });
  obUpdateHeader();
}

// ── Onboarding event wiring ────────────────────
(function wireOnboarding() {
  // Screen 1: enable Next when a selection is made
  document.querySelectorAll('input[name="ob-who"]').forEach(r => {
    r.addEventListener('change', () => {
      document.getElementById('ob-next-1').disabled = false;
    });
  });

  // Back button
  document.getElementById('ob-back').addEventListener('click', obGoBack);

  // Next buttons
  document.getElementById('ob-next-1').addEventListener('click', obGoNext);
  document.getElementById('ob-next-2').addEventListener('click', obGoNext);
  document.getElementById('ob-next-3').addEventListener('click', obGoNext);
  document.getElementById('ob-next-4').addEventListener('click', obGoNext);
  document.getElementById('ob-next-5').addEventListener('click', obGoNext);
  document.getElementById('ob-next-6').addEventListener('click', obGoNext);

  // Skip buttons
  document.getElementById('ob-skip-2').addEventListener('click', obGoNext);
  document.getElementById('ob-skip-4').addEventListener('click', obGoNext);
  document.getElementById('ob-skip-6').addEventListener('click', obGoNext);

  // Finish button (screen 7)
  document.getElementById('ob-finish').addEventListener('click', obComplete);

  // Screen 3: reveal medication cards on "Yes"
  // Use click on labels (not change on sr-only inputs) for iOS Safari compatibility
  document.querySelector('label[for="ob-med-yes"]').addEventListener('click', () => {
    document.getElementById('ob-med-inputs').hidden = false;
    obInitMedCards();
  });
  document.querySelector('label[for="ob-med-not"]').addEventListener('click', () => {
    document.getElementById('ob-med-inputs').hidden = true;
  });
  document.querySelector('label[for="ob-med-skip"]').addEventListener('click', () => {
    document.getElementById('ob-med-inputs').hidden = true;
  });
  document.getElementById('ob-med-add').addEventListener('click', obAddMedCard);

  // Screen 4: "I don't know yet" exclusive behavior
  const obTrNone = document.getElementById('ob-tr-none');
  const obTrAll  = document.querySelectorAll('input[name="ob-triggers"]');
  obTrNone.addEventListener('change', () => {
    if (obTrNone.checked) obTrAll.forEach(cb => { cb.checked = false; });
  });
  obTrAll.forEach(cb => {
    cb.addEventListener('change', () => {
      if (cb.checked) obTrNone.checked = false;
    });
  });

  // Screen 6: reveal device type chips on "Yes"
  document.querySelector('label[for="ob-dev-yes"]').addEventListener('click', () => {
    document.getElementById('ob-device-types').hidden = false;
  });
  document.querySelector('label[for="ob-dev-no"]').addEventListener('click', () => {
    document.getElementById('ob-device-types').hidden = true;
  });
})();

// ── Event wiring (global UI) ──────────────────

// Profile modal
document.getElementById('btn-profile').addEventListener('click', openProfile);
document.getElementById('btn-profile-close').addEventListener('click', closeProfile);

// Account banner dismiss
document.getElementById('btn-banner-dismiss').addEventListener('click', () => {
  localStorage.setItem(BANNER_KEY, '1');
  document.getElementById('account-banner').hidden = true;
});

// Insights gate: continue without account
document.getElementById('btn-insights-continue').addEventListener('click', () => {
  insightsGateDismissed = true;
  document.getElementById('insights-gate').hidden = true;
});

// Caregiver notify overlay
document.getElementById('btn-notify-send').addEventListener('click', () => {
  document.getElementById('caregiver-notify').hidden = true;
});
document.getElementById('btn-notify-skip').addEventListener('click', () => {
  document.getElementById('caregiver-notify').hidden = true;
});

// Welcome screen
document.getElementById('btn-create-account').addEventListener('click', openAuthCreate);
document.getElementById('btn-go-signin').addEventListener('click', openAuthSignin);
document.getElementById('btn-start-tracking').addEventListener('click', () => {
  localStorage.setItem(WELCOME_KEY, '1');
  const w = document.getElementById('screen-welcome');
  w.style.transition = 'opacity 0.3s ease';
  w.style.opacity    = '0';
  setTimeout(() => { w.hidden = true; }, 300);
});

// Auth: Create Account screen
document.getElementById('btn-auth-create-back').addEventListener('click', returnToWelcome);
document.getElementById('btn-ca-pw-toggle').addEventListener('click', () => {
  const inp = document.getElementById('ca-password');
  inp.type  = inp.type === 'password' ? 'text' : 'password';
});
document.getElementById('btn-auth-apple').addEventListener('click', () => {
  // Replace with Apple Sign In V2
});
document.getElementById('btn-auth-google').addEventListener('click', () => {
  // Replace with Google Sign In V2
});

document.getElementById('create-account-form').addEventListener('submit', e => {
  e.preventDefault();
  const firstName = document.getElementById('ca-first-name').value.trim();
  const email     = document.getElementById('ca-email').value.trim();
  const password  = document.getElementById('ca-password').value;
  const errEl     = document.getElementById('create-account-error');

  if (!firstName) {
    errEl.textContent = 'Please enter your first name.'; errEl.hidden = false; return;
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errEl.textContent = 'Please enter a valid email address.'; errEl.hidden = false; return;
  }
  if (password.length < 8) {
    errEl.textContent = 'Password must be at least 8 characters.'; errEl.hidden = false; return;
  }
  const existing = getAccount();
  if (existing && existing.email === email.toLowerCase()) {
    errEl.textContent = 'An account with this email already exists.'; errEl.hidden = false; return;
  }
  errEl.hidden = true;

  createAccount(firstName, email, password);
  openAuthSuccess(firstName);
  renderHome();
});

// Auth: You're in screen
document.getElementById('btn-start-logging').addEventListener('click', () => {
  closeAuthSuccess();
  renderHome();
});
document.getElementById('btn-setup-profile-now').addEventListener('click', () => {
  closeAuthSuccess();
  document.getElementById('screen-onboarding').hidden = false;
  obInitScreens();
});

// Auth: Sign In screen
document.getElementById('btn-auth-signin-back').addEventListener('click', returnToWelcome);
document.getElementById('btn-si-pw-toggle').addEventListener('click', () => {
  const inp = document.getElementById('si-password');
  inp.type  = inp.type === 'password' ? 'text' : 'password';
});
document.getElementById('btn-go-create-account').addEventListener('click', () => {
  document.getElementById('screen-auth-signin').hidden = true;
  openAuthCreate();
});
document.getElementById('btn-forgot-password').addEventListener('click', () => {
  // Replace with password reset V2
  const errEl = document.getElementById('signin-error');
  errEl.textContent = 'Password reset is coming soon.';
  errEl.hidden = false;
});

document.getElementById('signin-form').addEventListener('submit', e => {
  e.preventDefault();
  const email    = document.getElementById('si-email').value.trim();
  const password = document.getElementById('si-password').value;
  const errEl    = document.getElementById('signin-error');

  if (!email || !password) {
    errEl.textContent = 'Please enter your email and password.'; errEl.hidden = false; return;
  }
  if (signInWithEmail(email, password)) {
    errEl.hidden = true;
    document.getElementById('screen-auth-signin').hidden = true;
    localStorage.setItem(WELCOME_KEY, '1');
    renderHome();
  } else {
    errEl.textContent = 'Email or password is incorrect.'; errEl.hidden = false;
  }
});

// Banner + insights gate "Create account" CTAs
document.getElementById('btn-banner-create-account').addEventListener('click', openAuthCreate);
document.getElementById('btn-insights-create-account').addEventListener('click', openAuthCreate);

// PP sheet skip
document.getElementById('btn-pp-skip').addEventListener('click', closePPSheet);

// ── Boot ──────────────────────────────────────
const greetEl = document.getElementById('greeting');
if (greetEl) greetEl.textContent = greeting();
renderHome();

// Existing onboarding-complete users and account holders skip the welcome screen
const hasWelcomed = !!(localStorage.getItem(WELCOME_KEY) || localStorage.getItem(OB_DONE_KEY) || getAccount());

if (hasWelcomed) {
  // Already past welcome — go straight to app
  document.getElementById('screen-welcome').hidden = true;
  document.getElementById('screen-onboarding').hidden = true;
  if (localStorage.getItem(OB_DONE_KEY)) {
    applyProfile(getProfile());
    renderHome(); // re-render with profile (meds widget, stat label)
  }
  showAccountBannerIfNeeded();
} else {
  // First ever launch — show welcome screen, hide onboarding
  document.getElementById('screen-onboarding').hidden = true;
  document.getElementById('screen-welcome').hidden = false;
}
