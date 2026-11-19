// Stale-while-revalidate: instant offline loads, picks up new files on the next launch.
const CACHE = 'clasico-v3';
const SHELL = [
  './', 'index.html', 'style.css', 'app.js', 'manifest.webmanifest',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png',
];

const PHOTOS = ['img/messi.png', 'img/messi.jpg', 'img/ronaldo.png', 'img/ronaldo.jpg'];

self.addEventListener('install', (e) => {
  // photos are optional: a missing one must not break offline install
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)
    .then(() => Promise.all(PHOTOS.map((p) => c.add(p).catch(() => {}))))));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) =>
    Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(caches.open(CACHE).then(async (c) => {
    const hit = await c.match(e.request, { ignoreSearch: true });
    const net = fetch(e.request)
      .then((r) => { if (r.ok) c.put(e.request, r.clone()); return r; })
      .catch(() => hit || c.match('./'));
    return hit || net;
  }));
});
