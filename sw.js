// Service Worker: speichert die App-Dateien, damit sie offline startet.
// Bei jeder Änderung an der App VERSION erhöhen, damit Handys das Update laden.
const VERSION = 'kc-v1';
const FILES = [
  './', './index.html', './manifest.webmanifest', './css/app.css',
  './icons/icon.svg', './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png',
  './js/main.js', './js/util.js', './js/store.js', './js/ui.js', './js/timer.js',
  './js/data/exercises.js',
  './js/logic/e1rm.js', './js/logic/progression.js', './js/logic/timing.js', './js/logic/history.js', './js/logic/planner.js', './js/logic/stats.js',
  './js/ai/gemini.js', './js/ai/plan.js', './js/ai/schema.js',
  './js/views/today.js', './js/views/workout.js', './js/views/progress.js', './js/views/exercise.js', './js/views/settings.js', './js/views/picker.js', './js/views/chart.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  // KI-Anfragen und fremde Seiten nie zwischenspeichern.
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;
  // Erst Netz (für Updates), bei Offline aus dem Speicher.
  e.respondWith(
    fetch(e.request, { cache: 'no-cache' }) // beim Server nachfragen, ob es Neues gibt
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put(e.request, copy));
        }
        return res;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true }).then((r) => r || caches.match('./index.html'))),
  );
});
