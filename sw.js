// Service worker: gör att appen kan installeras och fungerar offline.
// Strategi: svara direkt från cachen och hämta en färsk version i bakgrunden
// (nästa start får den nya). Höj VERSION när filistan ändras.

const VERSION = 'hover-pads-v1';
const ASSETS = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/style.css',
  'js/synth.js',
  'js/sound-library.js',
  'js/layout.js',
  'js/core.js',
  'js/audio.js',
  'js/pads.js',
  'js/notes.js',
  'js/chords.js',
  'js/sound.js',
  'js/view.js',
  'js/settings.js',
  'js/user-presets.js',
  'js/pwa.js',
  'js/main.js',
  'icons/icon.svg',
  'icons/favicon-32.png',
  'icons/apple-touch-icon.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(VERSION).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;

  event.respondWith((async () => {
    const cache = await caches.open(VERSION);
    // Sidan själv (även med ?fast osv.) hämtas som index
    const key = req.mode === 'navigate' ? './' : req;
    const cached = await cache.match(key, { ignoreSearch: true });
    const fresh = fetch(req)
      .then((res) => {
        if (res.ok) cache.put(key, res.clone());
        return res;
      })
      .catch(() => null);
    if (cached) {
      event.waitUntil(fresh);
      return cached;
    }
    return (await fresh) || new Response('Offline', { status: 503, statusText: 'Offline' });
  })());
});
