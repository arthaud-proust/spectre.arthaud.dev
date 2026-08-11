const CACHE_NAME = 'spectre-v1';

const ASSETS = [
    '/',
    '/css/styles.css',
    '/js/main.js',
    '/js/biometric.js',
    '/js/spectre/spectre-types.js',
    '/js/spectre/spectre-service.js',
    '/js/spectre/spectre-algorithm.js',
    '/js/spectre/spectre-worker.js',
    '/js/spectre/pbkdf2.js',
    '/js/spectre/scrypt.js',
    '/plugins/fontawesome/css/all.min.css',
    '/plugins/fontawesome/webfonts/fa-brands-400.woff2',
    '/plugins/fontawesome/webfonts/fa-duotone-900.woff2',
    '/plugins/fontawesome/webfonts/fa-light-300.woff2',
    '/plugins/fontawesome/webfonts/fa-regular-400.woff2',
    '/plugins/fontawesome/webfonts/fa-solid-900.woff2',
    '/plugins/fontawesome/webfonts/fa-thin-100.woff2',
    '/images/apple-touch-icon.png',
    '/images/favicon-96x96.png',
    '/images/favicon.svg',
    '/images/web-app-manifest-192x192.png',
    '/images/web-app-manifest-512x512.png',
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
    );
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
        )
    );
    self.clients.claim();
});

self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET') return;

    event.respondWith(
        caches.match(event.request).then((cached) => {
            return cached ?? fetch(event.request).then((response) => {
                if (response.ok) {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
                }
                return response;
            });
        })
    );
});
