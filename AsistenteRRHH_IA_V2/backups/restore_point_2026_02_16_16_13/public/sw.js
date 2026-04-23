// Minimal Service Worker to enable Add-to-Home-Screen prompt
// This worker does not cache files yet, but satisfies Chrome PWA requirements.

self.addEventListener('install', (event) => {
    console.log('Service Worker: Installing...');
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    console.log('Service Worker: Activating...');
    return self.clients.claim();
});

self.addEventListener('fetch', (event) => {
    // Simple pass-through. No offline support for now to avoid caching issues during development.
});
