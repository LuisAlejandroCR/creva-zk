// sw.js
// App-shell service worker. Only the fixed SHELL_ASSETS list is ever
// cached — proof outcomes, attestation responses, the ~2 MB of ZK artifacts
// under /zk/, and any future API call stay network-only and never touch
// on-device storage. Navigations go network-first with the cached shell as
// an offline fallback.

const CACHE_NAME = 'creva-zk-shell-v1';
// Never cached, and stated rather than left to the SHELL_ASSETS check: the
// prover keys under this prefix are ~2 MB, and precaching them would put
// that weight into the install payload of an app whose claim is that it is
// light enough to install.
const NEVER_CACHED_PREFIX = '/zk/';

const SHELL_ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_ASSETS)),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))),
    ),
  );
  self.clients.claim();
});

async function networkFirstNavigation(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put('/index.html', response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match('/index.html');
    return cached ?? Response.error();
  }
}

async function cacheFirstShellAsset(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return Response.error();
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith(NEVER_CACHED_PREFIX)) return;

  if (request.mode === 'navigate') {
    event.respondWith(networkFirstNavigation(request));
    return;
  }

  if (SHELL_ASSETS.includes(url.pathname)) {
    event.respondWith(cacheFirstShellAsset(request));
    return;
  }

  // Not shell, not a navigation: leave it alone. The browser fetches it
  // from the network directly, and it never gets written to the cache.
});
