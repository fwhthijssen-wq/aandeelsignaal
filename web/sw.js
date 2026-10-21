/* Offline-modus: bestanden van de app worden bewaard; gegevens (data/) altijd eerst vers proberen. */
const VERSIE = 'as-web-3';
const BESTANDEN = ['./', 'index.html', 'styles.css', 'js/app.js', 'js/gate.js', 'js/store.js', 'js/portefeuille.js', 'js/vergelijk.js', 'js/naic.js', 'js/dashboard.js', 'js/timing.js', 'js/signaal.js', 'js/checklist.js', 'data/aandelen.js', 'data/uitleg.js', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(VERSIE).then(c => c.addAll(BESTANDEN)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== VERSIE).map(x => caches.delete(x)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;
  /* Altijd eerst vers proberen; alleen zonder internet komt de bewaarde kopie. Zo bereiken verbeteringen elk toestel. */
  e.respondWith(fetch(e.request, { cache: 'no-cache' }).then(r => { if (r.ok) { const k = r.clone(); caches.open(VERSIE).then(c => c.put(e.request, k)); } return r; }).catch(() => caches.match(e.request)));
});
