/*
 * DevNidhi service worker
 * Caches the app shell and uses runtime caching for static GET requests.
 * Firestore manages record-level offline persistence and synchronization.
 */

const CACHE_VERSION = "devnidhi-v23";
const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.json",
  "./firebase-config.js",
  "./app.js?v=18",
  "./logo.svg",
  "./icon-192.png",
  "./icon-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key !== CACHE_VERSION)
          .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put("./index.html", copy));
          return response;
        })
        .catch(async () => (await caches.match(request)) || (await caches.match("./index.html")))
    );
    return;
  }

  const shouldCache =
    url.origin === self.location.origin ||
    url.hostname === "fonts.googleapis.com" ||
    url.hostname === "fonts.gstatic.com" ||
    url.hostname === "www.gstatic.com";

  if (!shouldCache) return;

  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      const networkResponse = fetch(request)
        .then((response) => {
          if (response && (response.ok || response.type === "opaque")) {
            const copy = response.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => cachedResponse);
      return cachedResponse || networkResponse;
    })
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});
