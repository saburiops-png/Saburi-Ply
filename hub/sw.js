// Old helper for this page. It is no longer needed: it clears its saved files and removes itself.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(
  caches.keys()
    .then(keys => Promise.all(keys.filter(k => /^saburi-(hub|dsr|shell)-/.test(k)).map(k => caches.delete(k))))
    .then(() => self.registration.unregister())
));
