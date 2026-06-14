/* CipherShield — Service Worker
 * Cache-first for static assets. Network-first for API calls.
 * No analytics, no third-party requests, no tracking.
 */

var CACHE = 'ciphershield-v1';
var STATIC = [
  '/',
  '/submission/',
  '/status/',
  '/threat-model/',
  '/submission/css/style.css',
  '/submission/js/submit.js',
  '/status/js/status.js',
  '/css/style.css',
  '/js/main.js',
  '/manifest.json',
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (cache) {
      return cache.addAll(STATIC);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.filter(function (k) { return k !== CACHE; })
            .map(function (k) { return caches.delete(k); })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', function (e) {
  var url = new URL(e.request.url);

  // Always go to network for API calls
  if (url.pathname.startsWith('/api/')) return;

  // Cache-first for everything else
  e.respondWith(
    caches.match(e.request).then(function (cached) {
      return cached || fetch(e.request).then(function (response) {
        // Only cache same-origin successful responses
        if (response.ok && url.origin === self.location.origin) {
          var clone = response.clone();
          caches.open(CACHE).then(function (cache) {
            cache.put(e.request, clone);
          });
        }
        return response;
      });
    })
  );
});
