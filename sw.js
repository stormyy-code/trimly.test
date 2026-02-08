
/* Service Worker za Trimly Zagreb */
self.addEventListener('push', function(event) {
  let data = { title: 'Trimly Zagreb', body: 'Imate novu obavijest!' };
  
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data = { title: 'Trimly Zagreb', body: event.data.text() };
    }
  }

  const options = {
    body: data.body,
    icon: 'https://i.ibb.co/C5fL3Pz/trimly-logo.png',
    badge: 'https://i.ibb.co/C5fL3Pz/trimly-logo.png',
    vibrate: [200, 100, 200],
    data: {
      url: self.registration.scope
    },
    actions: [
      { action: 'open', title: 'Otvori aplikaciju' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data.url)
  );
});

// Instalacija i aktivacija
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});
