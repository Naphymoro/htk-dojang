// ═══════════════════════════════════════════════════════════════
// HAN TAEKWONDO KOREA — Service Worker
// Handles offline caching and background sync
// Version: bump CACHE_VERSION to force update on all devices
// ═══════════════════════════════════════════════════════════════

const CACHE_VERSION  = 'han-tkd-v4-scroll-back-child-search';
const STATIC_CACHE   = `${CACHE_VERSION}-static`;
const DYNAMIC_CACHE  = `${CACHE_VERSION}-dynamic`;

// Files to cache immediately on install (app shell)
const STATIC_ASSETS = [
  '/han-taekwondo-dojang/',
  '/han-taekwondo-dojang/index.html',
  'https://fonts.googleapis.com/css2?family=Rajdhani:wght@400;500;600;700&family=Outfit:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;700&display=swap',
];

// ── INSTALL: cache static assets ─────────────────────────────
self.addEventListener('install', event => {
  console.log('[SW] Installing Han TKD service worker…');
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting()) // activate immediately
  );
});

// ── ACTIVATE: clean old caches ───────────────────────────────
self.addEventListener('activate', event => {
  console.log('[SW] Activating…');
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== STATIC_CACHE && key !== DYNAMIC_CACHE)
          .map(key => {
            console.log('[SW] Deleting old cache:', key);
            return caches.delete(key);
          })
      )
    ).then(() => self.clients.claim()) // take control immediately
  );
});

// ── FETCH: serve from cache, fall back to network ────────────
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Don't intercept Apps Script API calls — always go to network
  if (url.hostname.includes('script.google.com')) {
    event.respondWith(
      fetch(request).catch(() =>
        new Response(JSON.stringify({ error: 'Offline — API unavailable', offline: true }), {
          headers: { 'Content-Type': 'application/json' }
        })
      )
    );
    return;
  }

  // Don't intercept non-GET requests
  if (request.method !== 'GET') return;

  // Cache-first for static assets (fonts, icons, the app itself)
  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;

      // Not in cache — fetch from network and cache dynamically
      return fetch(request)
        .then(networkResponse => {
          // Only cache successful responses
          if (
            networkResponse &&
            networkResponse.status === 200 &&
            networkResponse.type !== 'opaque'
          ) {
            const responseClone = networkResponse.clone();
            caches.open(DYNAMIC_CACHE).then(cache => cache.put(request, responseClone));
          }
          return networkResponse;
        })
        .catch(() => {
          // Offline fallback for navigation requests
          if (request.mode === 'navigate') {
            return caches.match('/han-taekwondo-dojang/index.html');
          }
          return new Response('Offline', { status: 503 });
        });
    })
  );
});

// ── BACKGROUND SYNC: queue writes when offline ───────────────
self.addEventListener('sync', event => {
  if (event.tag === 'sync-to-sheets') {
    console.log('[SW] Background sync triggered');
    event.waitUntil(
      self.clients.matchAll().then(clients => {
        clients.forEach(client =>
          client.postMessage({ type: 'SYNC_NOW' })
        );
      })
    );
  }
});

// ── PUSH NOTIFICATIONS ────────────────────────────────────────
self.addEventListener('push', event => {
  if (!event.data) return;

  let data;
  try { data = event.data.json(); }
  catch { data = { title: 'Han TKD', body: event.data.text() }; }

  const options = {
    body:    data.body  || 'You have a new notification',
    icon:    '/han-taekwondo-dojang/icons/icon-192.png',
    badge:   '/han-taekwondo-dojang/icons/icon-72.png',
    vibrate: [200, 100, 200],
    data:    { url: data.url || '/han-taekwondo-dojang/' },
    actions: data.actions || [],
    tag:     data.tag || 'han-tkd-notif',
    renotify: true,
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'Han Taekwondo Korea', options)
  );
});

// ── NOTIFICATION CLICK ────────────────────────────────────────
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/han-taekwondo-dojang/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
      // Focus existing window if open
      for (const client of windowClients) {
        if (client.url.includes('han-taekwondo-dojang') && 'focus' in client) {
          return client.focus();
        }
      }
      // Otherwise open new window
      if (clients.openWindow) return clients.openWindow(targetUrl);
    })
  );
});

// ── MESSAGE HANDLER (from app) ────────────────────────────────
self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data?.type === 'CACHE_URLS') {
    const urls = event.data.payload;
    event.waitUntil(
      caches.open(DYNAMIC_CACHE).then(cache => cache.addAll(urls))
    );
  }
});
