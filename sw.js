// Minimal Service Worker for PWA support
const CACHE_NAME = 'hr-kiosk-v1';

self.addEventListener('install', (event) => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(clients.claim());
});

self.addEventListener('fetch', (event) => {
    // Simple pass-through or offline fallback could go here
    // For now, we just let requests go to the network
    event.respondWith(fetch(event.request));
});
