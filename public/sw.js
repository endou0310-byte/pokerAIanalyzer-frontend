const CACHE_NAME = 'poker-analyzer-v2';
const ASSETS = [
    './',
    './index.html',
    './login.html',
    './history.html',
    './css/style.css', // Keeping legacy just in case
    // Note: src/styles.css is bundled but we should cache build artifacts in a real setup.
    // For this dev setup, we'll cache the main HTMLs.
    './pwa-icons/icon-192.png',
    './pwa-icons/icon-512.png',
    './noise.svg'
];

self.addEventListener('install', (event) => {
    // Force new SW to take control immediately
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
    );
});

self.addEventListener('activate', (event) => {
    // Claim clients immediately so the page is controlled by the new SW
    event.waitUntil(clients.claim());
    // Cleanup old caches
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.map((key) => {
                    if (key !== CACHE_NAME) return caches.delete(key);
                })
            );
        })
    );
});

self.addEventListener('fetch', (event) => {
    // Simple Network-falling-back-to-cache strategy
    // For analysis API calls, we always want network.
    if (event.request.method !== 'GET') return;
    if (!event.request.url.startsWith('http')) return; // Ignore chrome-extension:// etc.

    event.respondWith(
        fetch(event.request)
            .then((networkRes) => {
                return caches.open(CACHE_NAME).then((cache) => {
                    // Update cache with new version
                    cache.put(event.request, networkRes.clone());
                    return networkRes;
                });
            })
            .catch(() => {
                return caches.match(event.request);
            })
    );
});
