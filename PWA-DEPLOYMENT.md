# Han Taekwondo Korea — PWA Deployment Guide
## Install on Android & iPhone without an App Store

---

## WHAT YOU GET

After deploying these files, parents and instructors can:

- **Android** — Chrome shows "Install app" banner automatically
- **iPhone** — Safari shows instructions to "Add to Home Screen"
- App appears on home screen with the Han TKD logo
- Opens full-screen (no browser address bar)
- Works **offline** — schedule and cached data available without internet
- Receives **push notifications** — payment reminders, grading alerts
- App shortcuts on long-press (Attendance, Schedule, Parent Portal)

---

## FOLDER STRUCTURE ON GITHUB

Your GitHub repo must look like this:

```
han-taekwondo-dojang/          ← repo root
├── index.html                 ← your han-taekwondo-v3.html renamed
├── manifest.json              ← from this folder
├── sw.js                      ← from this folder
└── icons/
    ├── icon-72.png
    ├── icon-96.png
    ├── icon-128.png
    ├── icon-144.png
    ├── icon-152.png
    ├── icon-192.png
    ├── icon-384.png
    ├── icon-512.png
    └── apple-touch-icon.png
```

---

## STEP 1 — Upload files to GitHub (iPad)

1. Go to `github.com/Naphymoro/han-taekwondo-dojang`
2. Switch to branch `Olympic-redesign`

### Upload index.html
- Click `index.html` → pencil ✏️ → select all → delete → paste `han-taekwondo-v3.html` contents → Commit

### Upload manifest.json
- Click **Add file → Upload files**
- Upload `manifest.json` from this folder
- Commit

### Upload sw.js
- Click **Add file → Upload files**
- Upload `sw.js` from this folder
- Commit

### Create icons/ folder and upload icons
GitHub doesn't let you create folders directly — use this trick:
- Click **Add file → Create new file**
- In the filename box type: `icons/placeholder.txt`
- Add any text → Commit
- Now click **Add file → Upload files**
- Navigate into the `icons/` folder
- Upload all 9 PNG files from this folder
- Commit
- Delete `placeholder.txt` after uploading

---

## STEP 2 — Verify GitHub Pages is enabled

1. Repo → **Settings → Pages**
2. Source: **Deploy from branch**
3. Branch: `Olympic-redesign` → folder: `/ (root)`
4. Save → wait 2 minutes

---

## STEP 3 — Test on Android

1. Open Chrome on Android
2. Go to `https://naphymoro.github.io/han-taekwondo-dojang/`
3. Chrome shows a banner: **"Add Han TKD to Home screen"**
4. Tap **Install** → app appears on home screen
5. Open it → runs full screen, no browser bar

If no banner appears:
- Open Chrome menu (⋮) → **Add to Home screen** → Install

---

## STEP 4 — Test on iPhone

1. Open **Safari** (must be Safari — Chrome on iOS can't install PWAs)
2. Go to `https://naphymoro.github.io/han-taekwondo-dojang/`
3. Tap the **Share button** (box with arrow pointing up)
4. Scroll down → tap **"Add to Home Screen"**
5. Tap **Add** → app appears on home screen
6. Opens full screen

> ⚠️ The app will show a banner with these exact instructions when opened on iPhone

---

## STEP 5 — Share with parents

Send parents this single message:

```
Han Taekwondo Korea App is now available!

To install:
📱 Android: Open this link in Chrome → tap "Install"
🍎 iPhone: Open in Safari → tap Share → "Add to Home Screen"

🔗 https://naphymoro.github.io/han-taekwondo-dojang/

No app store needed. Works offline.
```

---

## HOW OFFLINE MODE WORKS

- The app caches itself on first load
- Schedule, student list, and recent attendance are available offline
- When back online, data syncs to Google Sheets automatically
- A gold bar appears at the top when offline: "You are offline — showing cached data"

---

## HOW UPDATES WORK

When you upload a new version of `index.html`:
1. Bump the cache version in `sw.js` line 9:
   ```javascript
   const CACHE_VERSION = 'han-tkd-v2'; // ← increment this
   ```
2. Commit and push
3. Users see an **"Update available"** bar at the bottom of the app
4. They tap **"Update now"** — app reloads with new version

---

## GOING FURTHER — Real App Store submission

Once the PWA is working, you can wrap it as a native app using **Capacitor**:

### Prerequisites (needs a laptop, not iPad)
```bash
npm install -g @capacitor/cli
npm init
npm install @capacitor/core @capacitor/android @capacitor/ios
npx cap init "Han Taekwondo Korea" "com.hantkd.dojang"
```

### Android (Google Play Store)
- Requires: Android Studio on a laptop
- Cost: $25 one-time Google Play developer fee
- Bundle ID: `com.hantkd.dojang`

### iPhone (Apple App Store)
- Requires: Xcode on a Mac
- Cost: $99/year Apple Developer Program
- Bundle ID: `com.hantkd.dojang`

For now, the PWA gives parents a native-feeling experience on both platforms
at zero cost and zero app store review delay.
