self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()))
// Keep authenticated content on the network; do not persist personal data.
self.addEventListener('fetch', event => event.respondWith(fetch(event.request)))
