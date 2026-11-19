// Network-first: online opens always get the latest files; offline (or a network slower
// than 3s) falls back to the saved copy.
const CACHE = 'clasico-v4';
const SHELL = [
  './', 'index.html', 'style.css', 'app.js', 'manifest.webmanifest',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png',
];

const PHOTOS = ['img/messi.png', 'img/messi.jpg', 'img/ronaldo.png', 'img/ronaldo.jpg'];
const fresh = (u) => new Request(u, { cache: 'reload' }); // skip the browser's HTTP cache

self.addEventListener('install', (e) => {
  // photos are optional: a missing one must not break offline install
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL.map(fresh))
    .then(() => Promise.all(PHOTOS.map((p) => c.add(fresh(p)).catch(() => {}))))));
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
    const net = fetch(e.request, { cache: 'no-cache' })
      .then((r) => { if (r.ok) c.put(e.request, r.clone()); return r; });
    net.catch(() => {});
    try {
      const r = await Promise.race([net, new Promise((res) => setTimeout(res, 3000))]);
      if (r) return r;
    } catch { /* offline */ }
    const hit = await c.match(e.request, { ignoreSearch: true }) ||
      (e.request.mode === 'navigate' && await c.match('./'));
    return hit || net; // nothing saved yet: keep waiting on the network
  }));
});
