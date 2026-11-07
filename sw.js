// Service worker: gör att appen kan installeras och fungerar offline.
// Strategi: hämta från nätet först (så att man alltid får senaste versionen när man är uppkopplad);
// svarar nätet inte inom några sekunder, eller är man offline, används cachen.
// Kör tools/bump_version.py vid varje ny version (höjer VERSION här och ?v= i index.html).

const VERSION = 'hover-pads-v53';
const ASSETS = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/style.css',
  'js/synth.js',
  'js/pm-worklet.js',
  'js/sound-library.js',
  'js/layout.js',
  'js/core.js',
  'js/audio.js',
  'js/pads.js',
  'js/arp.js',
  'js/xy.js',
  'js/osc.js',
  'js/vibrato.js',
  'js/notes.js',
  'js/chords.js',
  'js/sound.js',
  'js/view.js',
  'js/controls.js',
  'js/access.js',
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
const NETWORK_TIMEOUT_MS = 4000;

self.addEventListener('install', (event) => {
  // cache: 'reload' = förbi webbläsarens vanliga cache, så att det verkligen är senaste filerna
  event.waitUntil(
    caches.open(VERSION)
      .then((cache) => cache.addAll(ASSETS.map((u) => new Request(u, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
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
  const key = req.mode === 'navigate' ? './' : req.url;

  event.respondWith((async () => {
    const cache = await caches.open(VERSION);
    const cached = cache.match(key, { ignoreSearch: true });
    const network = fetch(req.url, { cache: 'no-cache', credentials: 'same-origin' }).then((res) => {
      if (res.ok) cache.put(key, res.clone());
      return res;
    });
    network.catch(() => {}); // hanteras nedan; undvik "unhandled rejection" när cachen hann först
    const slow = new Promise((resolve) => setTimeout(resolve, NETWORK_TIMEOUT_MS))
      .then(async () => (await cached) || network);
    try {
      return await Promise.race([network, slow]);
    } catch {
      return (await cached) || new Response('Offline', { status: 503, statusText: 'Offline' });
    }
  })());
});
