/* Service worker: caches the app shell so saved plans open offline. */
const CACHE = 'paktorlah-v3';
const SHELL = ['./', './index.html', './styles.css', './manifest.webmanifest', './icon.svg',
  './js/data.js', './js/store.js', './js/engine.js', './js/invite.js', './js/events-eventbrite.js',
  './js/calendar.js', './js/memories.js', './js/app.js'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
// Network-first for same-origin files (fresh content), falling back to cache when offline.
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  if (url.origin !== location.origin) {
    if (url.hostname.includes('fonts.')) e.respondWith(caches.match(e.request).then((r) => r || fetch(e.request).then((res) => { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); return res; })));
    return;
  }
  e.respondWith(fetch(e.request).then((res) => {
    const copy = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); return res;
  }).catch(() => caches.match(e.request, { ignoreSearch: true }).then((r) => r || caches.match('./index.html'))));
});
