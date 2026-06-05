const CACHE = 'mahjong-v17';

const BYPASS_HOSTS = [
  'cdn.jsdelivr.net',
  'unpkg.com',
  'fonts.googleapis.com',
  'fonts.gstatic.com',
  'accounts.google.com',
  'generativelanguage.googleapis.com',
];

const APP_FILES = [
  '/', '/index.html', '/manifest.json',
  '/config.js', '/i18n.js', '/scoring.js', '/styles.css',
  '/app.jsx', '/auth-modal.jsx', '/chart.jsx', '/export.jsx',
  '/fan-helper.jsx', '/game.jsx', '/review.jsx', '/round-entry.jsx',
  '/settlement.jsx', '/setup.jsx', '/stats-view.jsx', '/summary.jsx',
  '/tweaks-panel.jsx', '/voice-entry.jsx',
  '/icon-192.png', '/icon-512.png',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(APP_FILES)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Never intercept API calls or external CDNs
  if (url.pathname.startsWith('/api/') || BYPASS_HOSTS.includes(url.hostname)) return;

  // Cache-first for app files, network fallback
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(resp => {
        if (resp.ok && e.request.method === 'GET') {
          const clone = resp.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return resp;
      });
    })
  );
});
