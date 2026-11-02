// tiny service worker for the walkie: shows notifications for pings / voice notes and opens the walkie when one is tapped
// (no fetch handler: it never touches page loads)
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || '/door/?walkie=1';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(cs => {
    const c = cs.find(c => new URL(c.url).pathname === new URL(url, self.location.origin).pathname);
    if (c) { c.postMessage({ walkie: 1 }); return c.focus(); }
    return self.clients.openWindow(url);
  }));
});
