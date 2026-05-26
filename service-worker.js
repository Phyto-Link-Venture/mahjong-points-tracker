const CACHE = 'mahjong-v9';
const STATIC = [
  '/', '/index.html', '/styles.css', '/manifest.json',
  '/icon-192.png', '/icon-512.png',
  '/scoring.js', '/i18n.js', '/config.js',
  '/tweaks-panel.jsx', '/setup.jsx', '/fan-helper.jsx',
  '/round-entry.jsx', '/game.jsx', '/review.jsx',
  '/export.jsx', '/auth-modal.jsx', '/stats-view.jsx',
  '/settlement.jsx', '/chart.jsx', '/summary.jsx', '/voice-entry.jsx', '/app.jsx',
];

// Domains that manage their own cache (Whisper model files, CDN libs)
const BYPASS_CACHE_HOSTS = ['cdn.jsdelivr.net', 'huggingface.co'];

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(STATIC).catch(() => {}))
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  // Let external CDN/model hosts manage their own cache
  if (BYPASS_CACHE_HOSTS.includes(url.hostname)) return;
  // Network-first for API calls
  if (url.pathname.startsWith('/api/')) {
    e.respondWith(fetch(e.request).catch(() => new Response('{"error":"offline"}', { headers: { 'Content-Type': 'application/json' } })));
    return;
  }
  // Cache-first for static assets
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, copy));
        }
        return res;
      });
    })
  );
});
