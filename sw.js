// sw.js - Service Worker for Congresso Kombat PWA
const CACHE_NAME = 'congresso-kombat-v1';

const STATIC_ASSETS = [
  './',
  './index.html',
  './style.css',
  './manifest.json',
  './game.js',
  './fighter.js',
  './characters.js',
  './projectile.js',
  './particles.js',
  './audio.js',
  './gamepad.js',
  './touchControls.js',
  './network.js',
  './littlejs.esm.js',
  './peerjs.min.js',
  './assets/icon-192.png',
  './assets/icon-512.png',
  './assets/bg_congress.jpg',
  './assets/logo_title.jpg',
  './assets/portrait_lula.jpg',
  './assets/portrait_dilma.jpg',
  './assets/portrait_haddad.jpg',
  './assets/portrait_boulos.jpg',
  './assets/portrait_jones.jpg',
  './assets/portrait_bolsonaro.jpg',
  './assets/portrait_tarcisio.jpg',
  './assets/portrait_nikolas.jpg',
  './assets/portrait_flavio.jpg',
  './assets/portrait_campopiano.jpg',
  './assets/spritesheet_lula.jpg',
  './assets/spritesheet_dilma.jpg',
  './assets/spritesheet_haddad.jpg',
  './assets/spritesheet_boulos.jpg',
  './assets/spritesheet_jones.jpg',
  './assets/spritesheet_bolsonaro.jpg',
  './assets/spritesheet_tarcisio.jpg',
  './assets/spritesheet_nikolas.jpg',
  './assets/spritesheet_flavio.jpg',
  './assets/spritesheet_campopiano.jpg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  // Only handle GET requests
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // For peerjs signaling or external APIs, bypass service worker
  if (url.origin !== self.location.origin) return;

  // Stale-While-Revalidate strategy for internal assets
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      }).catch(() => cachedResponse);

      return cachedResponse || fetchPromise;
    })
  );
});
