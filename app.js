'use strict';

const STORAGE_KEY    = 'epitrack_entries';
const OB_DONE_KEY    = 'vivea_onboarded';
const OB_PROFILE_KEY = 'vivea_profile';

function getProfile() {
  try { return JSON.parse(localStorage.getItem(OB_PROFILE_KEY)); } catch { return null; }
}

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
  if (tabName === 'insights') { renderInsights(); showHint('insights'); }
  else renderHome();
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
  addEntry({
    id: String(Date.now()),
    time: rawTime ? new Date(rawTime).toISOString() : new Date().toISOString(),
    category: 'Seizure',
    type: fd.get('type') || 'Unknown',
    intensity: fd.get('intensity') || '',
    duration: fd.get('duration') || '',
    triggers: fd.getAll('triggers'),
    deviceUsed: fd.get('device-used') || '',
    notes: String(fd.get('notes') || '').trim(),
  });
  closeLog();
  showSuccess();
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
  closeQuickLog();
  addEntry(entry);
  showSuccess();
});

// ── PWA ───────────────────────────────────────
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}

// ── Onboarding ─────────────────────────────────
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

let obMedCount = 1;

function obAddMed() {
  if (obMedCount >= 3) return;
  const input = document.createElement('input');
  input.type = 'text';
  input.id = `ob-med-${obMedCount}`;
  input.className = 'input-field ob-med-input';
  input.placeholder = 'Medication name';
  input.autocomplete = 'off';
  input.autocapitalize = 'words';
  document.getElementById('ob-med-extra').appendChild(input);
  obMedCount++;
  if (obMedCount >= 3) document.getElementById('ob-med-add').hidden = true;
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
  for (let i = 0; i < 3; i++) {
    const el = document.getElementById(`ob-med-${i}`);
    if (el) { const v = el.value.trim(); if (v) medications.push(v); }
  }

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

  const shell = document.getElementById('screen-onboarding');
  shell.style.opacity = '0';
  setTimeout(() => { shell.hidden = true; shell.style.opacity = ''; }, 350);

  applyProfile(profile);
}

// ── Profile application ────────────────────────
function applyProfile(profile) {
  if (!profile) return;

  // 1. Trigger chip: replace "Missed meds" label with "Missed [MedName]"
  if (profile.takingMeds === 'yes' && profile.medications.length > 0) {
    const name = profile.medications[0];
    const inp = document.getElementById('tr-meds');
    const lbl = document.querySelector('label[for="tr-meds"]');
    if (inp && lbl) { inp.value = `Missed ${name}`; lbl.textContent = `Missed ${name}`; }
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

  // Screen 3: reveal medication inputs on "Yes"
  document.getElementById('ob-med-yes').addEventListener('change', () => {
    document.getElementById('ob-med-inputs').hidden = false;
  });
  document.getElementById('ob-med-not').addEventListener('change', () => {
    document.getElementById('ob-med-inputs').hidden = true;
  });
  document.getElementById('ob-med-skip').addEventListener('change', () => {
    document.getElementById('ob-med-inputs').hidden = true;
  });
  document.getElementById('ob-med-add').addEventListener('click', obAddMed);

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
  document.getElementById('ob-dev-yes').addEventListener('change', () => {
    document.getElementById('ob-device-types').hidden = false;
  });
  document.getElementById('ob-dev-no').addEventListener('change', () => {
    document.getElementById('ob-device-types').hidden = true;
  });
})();

// ── Boot ──────────────────────────────────────
const greetEl = document.getElementById('greeting');
if (greetEl) greetEl.textContent = greeting();
renderHome();

// Show onboarding or apply saved profile
if (localStorage.getItem(OB_DONE_KEY)) {
  document.getElementById('screen-onboarding').hidden = true;
  applyProfile(getProfile());
} else {
  // Init screen 1 at translateX(0), all others off to the right
  const obScreens = document.querySelectorAll('.ob-screen');
  obScreens.forEach((el, i) => {
    el.style.transform   = i === 0 ? 'translateX(0)'   : 'translateX(100%)';
    el.style.opacity     = i === 0 ? '1'               : '0';
    el.style.pointerEvents = i === 0 ? 'auto' : 'none';
  });
  obUpdateHeader();
}
