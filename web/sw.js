/* Offline-modus: bestanden van de app worden bewaard; gegevens (data/) altijd eerst vers proberen. */
const VERSIE = 'as-web-1';
const BESTANDEN = ['./', 'index.html', 'styles.css', 'js/app.js', 'js/gate.js', 'js/store.js', 'data/aandelen.js', 'data/uitleg.js', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(VERSIE).then(c => c.addAll(BESTANDEN)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== VERSIE).map(x => caches.delete(x)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;
  const vers = url.pathname.includes('/data/');
  e.respondWith(vers
    ? fetch(e.request).then(r => { const k = r.clone(); caches.open(VERSIE).then(c => c.put(e.request, k)); return r; }).catch(() => caches.match(e.request))
    : caches.match(e.request).then(h => h || fetch(e.request)));
});
