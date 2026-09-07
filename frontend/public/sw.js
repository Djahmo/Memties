self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()))
// Keep authenticated content on the network; do not persist personal data.
self.addEventListener('fetch', event => event.respondWith(fetch(event.request)))
self.addEventListener('push', event => {
  if (!event.data) return
  const message = event.data.json()
  event.waitUntil(self.registration.showNotification('Memties', {
    body: message.body, tag: message.tag, icon: '/icon-192.png',
  }))
})
self.addEventListener('notificationclick', event => {
  event.notification.close()
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    const existing = windows.find(client => new URL(client.url).origin === self.location.origin)
    if (existing) return existing.focus()
    return self.clients.openWindow('/')
  })())
})
