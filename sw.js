// Saburi Ply service worker.
// - The home screen opens fast and still opens with no internet.
// - A new upload to GitHub reaches phones on their next open.
// - The Hub and DSR themselves always load live from Google (never cached here).
const CACHE = 'saburi-home-v11';
const FONT_CACHE = 'saburi-fonts-v1';
const FILES = [
  './', 'index.html', 'manifest.json',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/favicon-32.png', 'icons/favicon-64.png',
  'assets/saburi-logo-white.webp', 'assets/saburi-mark-white.webp', 'assets/saburi-wordmark-white.webp',
  'assets/saburi-mark-shadow.webp', 'assets/saburi-wordmark-shadow.webp'
];
const PAGE_TIMEOUT = 3000;   // on a weak signal, show the saved copy after 3 seconds

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(FILES.map(f => new Request(f, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE && k !== FONT_CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function save(cacheName, req, res) {
  // "opaque" is how the Google Fonts style sheet arrives; it is safe to keep
  if (res && (res.ok || (cacheName === FONT_CACHE && res.type === 'opaque'))) { const copy = res.clone(); caches.open(cacheName).then(c => c.put(req, copy)); }
  return res;
}

// saved copy first, refreshed in the background
function staleWhileRevalidate(cacheName, req) {
  return caches.open(cacheName).then(c => c.match(req).then(hit => {
    const fresh = fetch(req).then(res => save(cacheName, req, res)).catch(() => hit);
    return hit || fresh;
  }));
}

// newest copy first; the saved copy if the network is slow or gone
function networkFirst(req) {
  const saved = () => caches.match(req, { ignoreSearch: true }).then(hit => hit || caches.match('index.html'));
  return new Promise(resolve => {
    let done = false;
    const timer = setTimeout(() => { saved().then(hit => { if (hit && !done) { done = true; resolve(hit); } }); }, PAGE_TIMEOUT);
    fetch(req).then(res => {
      clearTimeout(timer);
      save(CACHE, req, res);
      if (!done) { done = true; resolve(res); }
    }).catch(() => {
      clearTimeout(timer);
      if (!done) saved().then(hit => { done = true; resolve(hit || Response.error()); });
    });
  });
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // fonts: keep a copy so the app looks right with no internet
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(staleWhileRevalidate(FONT_CACHE, req));
    return;
  }
  if (url.origin !== location.origin) return;          // never touch Google Apps Script requests

  const isPage = req.mode === 'navigate' || /(\/|index\.html|manifest\.json|sw\.js)$/.test(url.pathname);
  e.respondWith(isPage ? networkFirst(req) : staleWhileRevalidate(CACHE, req));
});
