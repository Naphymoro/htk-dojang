// ═══════════════════════════════════════════════════════════════
// HAN TAEKWONDO — API Bridge
// Paste this entire block into the <script> section of
// han-taekwondo-v3.html, BEFORE the APP object definition.
//
// Then replace the APP getters/setters with the versions below.
// ═══════════════════════════════════════════════════════════════

// ── CONFIG — paste your Apps Script Web App URL here ─────────
const API_URL = 'YOUR_APPS_SCRIPT_WEB_APP_URL_HERE';
// Example:
// const API_URL = 'https://script.google.com/macros/s/AKfycby.../exec';

const API_KEY = 'YOUR_API_KEY_HERE'; // ← must match Code.gs API_KEY exactly

// ── LOW-LEVEL FETCH HELPERS ───────────────────────────────────
async function apiGet(params) {
  const url = API_URL + '?' + new URLSearchParams({ ...params, key: API_KEY });
  const res = await fetch(url);
  return res.json();
}

async function apiPost(body) {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...body, key: API_KEY }),
  });
  return res.json();
}

// ── SYNC: load all data from Sheets into localStorage ─────────
async function syncFromSheets() {
  try {
    showSyncIndicator(true);
    const result = await apiGet({ action: 'readAll' });
    if (!result.ok) throw new Error(result.error);

    const { data } = result;
    if (data.students    && data.students.length)    sv('ht_st', data.students);
    if (data.instructors && data.instructors.length) sv('ht_i',  data.instructors);
    if (data.sessions    && data.sessions.length)    sv('ht_s',  data.sessions);
    if (data.attendance  && data.attendance.length)  sv('ht_a',  data.attendance);
    if (data.instrAtt    && data.instrAtt.length)    sv('ht_ia', data.instrAtt);
    if (data.payments    && data.payments.length)    sv('ht_p',  data.payments);

    showToast('Synced from Google Sheets ✓');
    showSyncIndicator(false);
    return true;
  } catch (err) {
    showToast('Sync failed: ' + err.message, 'err');
    showSyncIndicator(false);
    return false;
  }
}

// ── SYNC: push all localStorage data to Sheets ───────────────
async function syncToSheets() {
  try {
    showSyncIndicator(true);
    const payload = {
      action: 'writeAll',
      data: {
        students:    ld('ht_st', []),
        instructors: ld('ht_i',  []),
        sessions:    ld('ht_s',  []),
        attendance:  ld('ht_a',  []),
        instrAtt:    ld('ht_ia', []),
        payments:    ld('ht_p',  []),
      }
    };
    const result = await apiPost(payload);
    if (!result.ok) throw new Error(result.error);
    showToast('Saved to Google Sheets ✓');
    showSyncIndicator(false);
    return true;
  } catch (err) {
    showToast('Save failed: ' + err.message, 'err');
    showSyncIndicator(false);
    return false;
  }
}

// ── AUTO-SYNC WRAPPER ─────────────────────────────────────────
// Call this after any data mutation (add/edit/delete student, payment, etc.)
// It debounces so rapid changes don't fire multiple requests
let syncDebounceTimer = null;
function autoSync() {
  clearTimeout(syncDebounceTimer);
  syncDebounceTimer = setTimeout(() => syncToSheets(), 2000); // 2s debounce
}

// ── SYNC INDICATOR (adds a small dot to topbar) ───────────────
function showSyncIndicator(active) {
  const btn = document.getElementById('sync-btn');
  if (!btn) return;
  btn.style.opacity = active ? '0.5' : '1';
  btn.title = active ? 'Syncing…' : 'Sync to Google Sheets';
}
