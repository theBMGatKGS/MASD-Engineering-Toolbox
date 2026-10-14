/* MASD Engineering Toolbox — service worker. Fully offline: fonts and icons are inlined; no CDN. */
const CACHE_VERSION = 'masd-toolbox-00-01-000';
const APP_SHELL = ['./', './index.html', './quickstart.html', './manifest.json', './icons/icon-192.png', './icons/icon-512.png', './icons/icon-512-maskable.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE_VERSION).then(c => c.addAll(APP_SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(hit => hit || fetch(e.request).then(r => { const c = r.clone(); caches.open(CACHE_VERSION).then(x => x.put(e.request, c)); return r; }).catch(() => caches.match('./index.html'))));
});
