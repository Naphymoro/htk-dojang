# Han Taekwondo Korea — Deployment Guide
## Google Sheets + Apps Script + GitHub Pages

---

## OVERVIEW

```
[GitHub Pages]  ←  han-taekwondo-v3.html  (frontend)
      ↕
[Apps Script]   ←  Code.gs               (API / backend)
      ↕
[Google Sheets]                           (database)
```

---

## STEP 1 — Create the Google Spreadsheet

1. Go to **sheets.google.com**
2. Click **+ Blank spreadsheet**
3. Name it: `Han Taekwondo Korea — Database`
4. **Copy the Spreadsheet ID** from the URL:
   ```
   https://docs.google.com/spreadsheets/d/  ← THIS PART →  /edit
   ```
   Example: `1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms`
5. Keep this tab open

---

## STEP 2 — Create the Apps Script Project

1. In your Google Sheet, click **Extensions → Apps Script**
2. A new tab opens with `Code.gs`
3. **Delete** the default `myFunction()` code
4. **Copy the entire contents** of `Code.gs` (from this folder) and paste it
5. On **line 8**, replace `YOUR_SPREADSHEET_ID_HERE` with your actual ID:
   ```javascript
   const SPREADSHEET_ID = '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms';
   ```
6. Click **Save** (Ctrl+S / Cmd+S)
7. Name the project: `Han TKD API`

---

## STEP 3 — Run Setup (create sheet tabs)

1. In Apps Script, select `setupSheets` from the function dropdown
2. Click **▶ Run**
3. If prompted for permissions:
   - Click **Review permissions**
   - Choose your Google account
   - Click **Advanced → Go to Han TKD API (unsafe)** (it's your own script)
   - Click **Allow**
4. Go back to your Google Sheet — you should see 6 tabs created:
   `Students | Instructors | Sessions | Attendance | InstructorAttendance | Payments`

---

## STEP 4 — Deploy as Web App

1. In Apps Script, click **Deploy → New deployment**
2. Click the **gear icon ⚙** next to "Select type" → choose **Web app**
3. Fill in:
   - **Description**: `Han TKD API v1`
   - **Execute as**: `Me`
   - **Who has access**: `Anyone`
4. Click **Deploy**
5. Click **Authorize access** if prompted (same permissions flow as Step 3)
6. **Copy the Web App URL** — it looks like:
   ```
   https://script.google.com/macros/s/AKfycby.../exec
   ```
   ⚠️ Save this URL — you'll need it in Step 5

---

## STEP 5 — Connect the HTML App to the API

Open `han-taekwondo-v3.html` in a text editor (on iPad: use **Working Copy** app or edit directly in GitHub).

Find this line near the top of the `<script>` section:
```javascript
const API_URL = 'YOUR_APPS_SCRIPT_WEB_APP_URL_HERE';
```

Replace it with your actual URL:
```javascript
const API_URL = 'https://script.google.com/macros/s/AKfycby.../exec';
```

Also find the `APP` object and add `autoSync()` calls. After any line that does `APP.students = students`, add `autoSync();` on the next line.

**Key lines to update** (search for each):
```javascript
APP.students = students;    // after this → autoSync();
APP.instructors = instrs;   // after this → autoSync();
APP.sessions = sessions;    // after this → autoSync();
APP.attendance = att;       // after this → autoSync();
APP.instrAtt = ia;          // after this → autoSync();
APP.payments = payments;    // after this → autoSync();
```

---

## STEP 6 — Add Sync Button to Topbar (optional but recommended)

Find the topbar buttons in the HTML and add this button before the bell icon:
```html
<button class="tb-icon" id="sync-btn" onclick="syncToSheets()" title="Sync to Google Sheets">
  <svg viewBox="0 0 24 24"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
</button>
```

And add this button to load data from Sheets on startup:
```html
<button class="tb-icon" onclick="syncFromSheets()" title="Load from Google Sheets">
  <svg viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
</button>
```

---

## STEP 7 — Deploy to GitHub Pages

### Option A — GitHub Web (iPad friendly)

1. Go to `github.com/Naphymoro/han-taekwondo-dojang`
2. Switch to branch `Olympic-redesign`
3. Click `index.html` → pencil icon ✏️
4. Select all (Ctrl+A / Cmd+A) → Delete → Paste your updated HTML
5. Scroll down → **Commit changes** → `feat: connect Google Sheets API`
6. Go to **Settings → Pages**
7. Source: **Deploy from branch** → Branch: `Olympic-redesign` → `/root`
8. Click **Save**
9. Wait 2 minutes → your app is live at:
   ```
   https://naphymoro.github.io/han-taekwondo-dojang/
   ```

### Option B — Git CLI

```bash
git clone https://github.com/Naphymoro/han-taekwondo-dojang.git
cd han-taekwondo-dojang
git checkout Olympic-redesign
cp /path/to/han-taekwondo-v3.html index.html
git add index.html
git commit -m "feat: connect Google Sheets API"
git push origin Olympic-redesign
```

---

## STEP 8 — Test the connection

1. Open your GitHub Pages URL
2. Add a student (Students tab → + Add student)
3. Open your Google Sheet → Students tab
4. The new student should appear within 2–3 seconds
5. Reload the page → data should persist (loaded from Sheets, not just localStorage)

---

## TROUBLESHOOTING

| Problem | Fix |
|---|---|
| "Sync failed: 401" | Re-deploy Apps Script with "Anyone" access |
| Data not appearing in Sheets | Check SPREADSHEET_ID is correct in Code.gs |
| CORS error in browser | Apps Script deployment must be "Anyone" access |
| Data disappears on reload | API_URL not set correctly in HTML |
| "Script not authorized" | Re-run setupSheets() and go through permission flow again |

---

## FILE SUMMARY

| File | Purpose |
|---|---|
| `han-taekwondo-v3.html` | Main app — upload as `index.html` to GitHub |
| `Code.gs` | Paste into Google Apps Script editor |
| `api.js` | Reference — the API functions to add to the HTML |

---

## SECURITY NOTE

API key authentication is **already enforced** in both `Code.gs` and `api.js`.
You only need to set the same key in both files before deploying.

### Setting your API key

**In `Code.gs`** (line 9):
```javascript
const API_KEY = 'YOUR_API_KEY_HERE'; // ← change this
```

**In `api.js` / your HTML app** (after the API_URL line):
```javascript
const API_KEY = 'YOUR_API_KEY_HERE'; // ← same key as Code.gs
```

### Choosing a strong key
Use something hard to guess — combine the academy name, year, and random chars:
```
htk-2026-rw-x9f2kp
HanTKD-Kigali-2026-api
```

### How it works
- Every GET request appends `?key=YOUR_KEY` to the URL
- Every POST request includes `key` in the JSON body
- Apps Script checks the key before doing anything
- Wrong or missing key returns `{ error: 'Unauthorized', code: 401 }`
- The URL being public doesn't matter — without the key, no data is accessible

### Rotating the key
If the key is ever compromised: update `API_KEY` in `Code.gs`, redeploy the Apps Script,
and update `API_KEY` in your HTML file. All old requests immediately stop working.
