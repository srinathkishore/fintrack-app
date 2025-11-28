const CACHE_NAME = "fintrack-cache-v2";

const FILES_TO_CACHE = [
    "./",
    "./index.html",
    "./manifest.json",
    "./style.css",
    "./script.js",
    "./icons/icon-192.svg",
    "./icons/icon-512.svg"
];

self.addEventListener("install", (event) => {
    console.log("Service Worker installing");
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log("Caching app shell");
                return cache.addAll(FILES_TO_CACHE);
            })
    );
    self.skipWaiting();
});

self.addEventListener("activate", (event) => {
    console.log("Service Worker activating");
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(
                keys.map(key => {
                    if (key !== CACHE_NAME) {
                        console.log("Deleting old cache:", key);
                        return caches.delete(key);
                    }
                })
            )
        )
    );
    self.clients.claim();
});

self.addEventListener("fetch", (event) => {
    event.respondWith(
        caches.match(event.request).then(response => {
            return response || fetch(event.request);
        })
    );
});