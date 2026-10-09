// sw.js - Service Worker for Congresso Kombat PWA
// Increment this version on every release so installed PWAs must refresh their app shell.
const CACHE_NAME = 'congresso-kombat-v7';

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
      const freshRequests = STATIC_ASSETS.map((asset) => new Request(
        new URL(asset, self.location.href),
        { cache: 'reload' }
      ));
      return cache.addAll(freshRequests);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  let replacingExistingVersion = false;
  event.waitUntil(
    caches.keys().then((keys) => {
      replacingExistingVersion = keys.some(
        (key) => key.startsWith('congresso-kombat-') && key !== CACHE_NAME
      );
      return Promise.all(
        keys.map((key) => {
          if (key.startsWith('congresso-kombat-') && key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim()).then(async () => {
      if (!replacingExistingVersion) return;
      const windowClients = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true
      });
      await Promise.all(windowClients.map(async (client) => {
        try {
          await client.navigate(client.url);
        } catch (error) {
          console.error('[PWA] Não foi possível recarregar o cliente após a atualização:', error);
        }
      }));
    })
  );
});

self.addEventListener('fetch', (event) => {
  // Only handle GET requests
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // For peerjs signaling or external APIs, bypass service worker
  if (url.origin !== self.location.origin) return;

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request, { cache: 'no-store' }).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put('./index.html', responseToCache));
        }
        return networkResponse;
      }).catch(() => caches.match('./index.html').then((cachedResponse) => {
        if (cachedResponse) return cachedResponse;
        throw new Error('Página inicial indisponível offline.');
      }))
    );
    return;
  }

  // The versioned cache is populated before activation; missing runtime assets fall back to network.
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) return cachedResponse;
      return fetch(event.request).then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200) return networkResponse;
        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseToCache));
        return networkResponse;
      });
    })
  );
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
