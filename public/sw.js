const CACHE_NAME = 'poker-analyzer-v1';
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
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
    );
});

self.addEventListener('fetch', (event) => {
    // Simple Network-falling-back-to-cache strategy
    // For analysis API calls, we always want network.
    if (event.request.method !== 'GET') return;

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
