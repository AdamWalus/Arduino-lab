// Offline: aplikacja z cache, dane (projekty) najpierw z sieci.
const V = 'al-v13';
const SHELL = ['./', 'index.html', 'css/app.css', 'js/app.js', 'js/boards.js', 'js/parts.js', 'js/check.js', 'js/diagram.js', 'js/wokwi.js', 'js/report.js', 'js/util.js', 'js/breadboard.js', 'assets/ubb-logo.png', 'assets/icon-192.png', 'manifest.webmanifest'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(V).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== V).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  // sieć najpierw (żeby nowe projekty i poprawki były od razu), cache gdy offline
  e.respondWith(fetch(req, { cache: 'no-cache' }).then((r) => { const copy = r.clone(); caches.open(V).then((c) => c.put(req, copy)); return r; }).catch(() => caches.match(req, { ignoreSearch: true }).then((r) => r || caches.match('index.html'))));
});
