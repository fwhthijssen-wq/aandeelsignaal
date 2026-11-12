/* Offline-modus: bestanden van de app worden bewaard; gegevens (data/) altijd eerst vers proberen (1.11.2). */
const VERSIE = 'as-web-29';
const BESTANDEN = ['./', 'index.html', 'styles.css', 'js/app.js', 'js/gate.js', 'js/store.js', 'js/portefeuille.js', 'js/vergelijk.js', 'js/naic.js', 'js/dashboard.js', 'js/timing.js', 'js/kortetermijn.js', 'js/termijn.js', 'js/management.js', 'js/signaal.js', 'js/signalen.js', 'js/hulp.js', 'js/checklist.js', 'js/afdruk.js', 'data/aandelen.js', 'data/uitleg.js', 'data/model.js', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(VERSIE).then(c => c.addAll(BESTANDEN)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== VERSIE).map(x => caches.delete(x)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;
  /* Altijd eerst vers proberen; alleen zonder internet komt de bewaarde kopie. Zo bereiken verbeteringen elk toestel. */
  e.respondWith(fetch(e.request, { cache: 'no-cache' }).then(r => { if (r.ok) { const k = r.clone(); caches.open(VERSIE).then(c => c.put(e.request, k)); } return r; }).catch(() => caches.match(e.request)));
});
/* Pushmeldingen voor de eigen portefeuilles (vanaf 1.12): verstuurd door de nachtelijke update (meldingen.js). */
self.addEventListener('push', e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (x) { d = { tekst: e.data ? e.data.text() : '' }; }
  // ontvangst vastleggen (Instellingen › Meldingen toont 'laatst ontvangen'), ook als het systeem het bericht niet laat zien
  const merk = caches.open('as-meta').then(c => c.put('laatste-push', new Response(JSON.stringify({ t: Date.now(), titel: d.titel || '', tekst: d.tekst || '' })))).catch(() => {});
  e.waitUntil(Promise.all([merk, self.registration.showNotification(d.titel || 'Aandeel Signaal', { body: d.tekst || '', icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', data: { url: d.url || '#/' } })]));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const doel = new URL('./' + ((e.notification.data && e.notification.data.url) || '#/'), self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(lijst => {
    for (const c of lijst) { if ('focus' in c) { c.navigate(doel).catch(() => {}); return c.focus(); } }
    return self.clients.openWindow(doel);
  }));
});
