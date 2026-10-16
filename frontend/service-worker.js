/**
 * Service Worker for Object Recovery Platform (PWA & Offline Cache)
 */

const CACHE_NAME = "lost-found-cache-v1";
const STATIC_ASSETS = [
    "/",
    "/index.html",
    "/search.html",
    "/report-lost.html",
    "/report-found.html",
    "/rewards.html",
    "/chat.html",
    "/admin.html",
    "/item-details.html",
    "/css/style.css",
    "/js/main.js",
    "/js/auth.js",
    "/js/i18n.js",
    "/js/voiceAssistant.js",
    "/js/rewards.js"
];

// Install Event - Cache Core Assets
self.addEventListener("install", (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log("[ServiceWorker] Pre-caching offline assets");
            return cache.addAll(STATIC_ASSETS).catch((err) => {
                console.warn("[ServiceWorker] Caching failed for some static assets:", err);
            });
        })
    );
    self.skipWaiting();
});

// Activate Event - Clean old caches
self.addEventListener("activate", (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cache) => {
                    if (cache !== CACHE_NAME) {
                        console.log("[ServiceWorker] Clearing old cache:", cache);
                        return caches.delete(cache);
                    }
                })
            );
        })
    );
    self.clients.claim();
});

// Fetch Event - Network First with Cache Fallback for Static, Network Only for APIs
self.addEventListener("fetch", (event) => {
    const url = new URL(event.request.url);

    // Skip caching for dynamic API calls and upload routes
    if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/uploads/")) {
        return;
    }

    event.respondWith(
        fetch(event.request)
            .then((networkResponse) => {
                if (networkResponse && networkResponse.status === 200 && event.request.method === "GET") {
                    const responseToCache = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseToCache);
                    });
                }
                return networkResponse;
            })
            .catch(() => {
                return caches.match(event.request).then((cachedResponse) => {
                    if (cachedResponse) return cachedResponse;
                    if (event.request.headers.get("accept")?.includes("text/html")) {
                        return caches.match("/index.html");
                    }
                });
            })
    );
});

// Push Notification Event Listener
self.addEventListener("push", (event) => {
    let payload = { title: "Lost & Found Alert", body: "You have a new update regarding your reported item." };
    if (event.data) {
        try {
            payload = event.data.json();
        } catch (e) {
            payload.body = event.data.text();
        }
    }

    const options = {
        body: payload.body,
        icon: "/favicon.ico",
        badge: "/favicon.ico",
        vibrate: [100, 50, 100],
        data: {
            dateOfArrival: Date.now(),
            primaryKey: 1,
            url: payload.url || "/index.html"
        },
        actions: [
            { action: "explore", title: "View Details" },
            { action: "close", title: "Dismiss" }
        ]
    };

    event.waitUntil(
        self.registration.showNotification(payload.title, options)
    );
});

// Notification Click Handler
self.addEventListener("notificationclick", (event) => {
    event.notification.close();
    if (event.action === "explore" || !event.action) {
        event.waitUntil(
            clients.openWindow(event.notification.data.url || "/index.html")
        );
    }
});
