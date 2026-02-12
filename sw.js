
/* Service Worker za Trimly Zagreb (FCM Support) */
self.addEventListener('push', function(event) {
  let data = { 
    title: 'Trimly Zagreb', 
    body: 'Imate novu obavijest!', 
    priority: 'high',
    icon: 'https://i.ibb.co/C5fL3Pz/trimly-logo.png' 
  };
  
  if (event.data) {
    try {
      const payload = event.data.json();
      data = { ...data, ...payload };
    } catch (e) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: data.icon,
    badge: 'https://i.ibb.co/C5fL3Pz/trimly-logo.png',
    vibrate: [300, 100, 300, 100, 300], // Jaka vibracija za pažnju
    tag: 'trimly-high-priority',
    renotify: true,
    requireInteraction: true, // Ključno za Heads-up behavior (ostaje dok se ne klikne)
    data: {
      url: self.registration.scope
    },
    actions: [
      { action: 'open', title: 'Prikaži' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
      for (let client of windowClients) {
        if (client.url === event.notification.data.url && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(event.notification.data.url);
      }
    })
  );
});

// Instalacija i aktivacija
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});
