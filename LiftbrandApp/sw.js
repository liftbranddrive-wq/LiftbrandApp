// ============================================================
// Liftbrand.ai — Service Worker (sw.js)
// Handles background push notifications via Firebase FCM
// Place this file at the ROOT of your Vercel project
// ============================================================

importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyAYnKMSoja6Q9pRgdj303IdxnxFoH-TVEw",
  authDomain: "liftbrand-s--sops.firebaseapp.com",
  projectId: "liftbrand-s--sops",
  databaseURL: "https://liftbrand-s--sops-default-rtdb.firebaseio.com",
  storageBucket: "liftbrand-s--sops.firebasestorage.app",
  messagingSenderId: "699084171927",
  appId: "1:699084171927:web:3f340d5be748c9b35b97d2"
});

const messaging = firebase.messaging();

// ── Background message handler ──────────────────────────────
messaging.onBackgroundMessage(function(payload) {
  console.log('[sw.js] Background message received:', payload);

  const notifTitle = payload.notification?.title || 'Liftbrand.ai';
  const notifOptions = {
    body: payload.notification?.body || '',
    icon: 'https://assets.cdn.filesafe.space/kStDsoJsyMuEVTowimeB/media/695e8653f4549a075dee967f.png',
    badge: 'https://assets.cdn.filesafe.space/kStDsoJsyMuEVTowimeB/media/695e8653f4549a075dee967f.png',
    vibrate: [200, 100, 200, 100, 200],
    requireInteraction: false,
    data: payload.data || {},
    actions: [
      { action: 'open', title: 'Open App' },
      { action: 'dismiss', title: 'Dismiss' }
    ]
  };

  self.registration.showNotification(notifTitle, notifOptions);
});

// ── Notification click handler ──────────────────────────────
self.addEventListener('notificationclick', function(event) {
  event.notification.close();

  if (event.action === 'dismiss') return;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      return clients.openWindow('/');
    })
  );
});

// ── Cache strategy for offline support ─────────────────────
const CACHE_NAME = 'liftbrand-v1';
const OFFLINE_ASSETS = ['/'];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(OFFLINE_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match('/'))
    );
  }
});