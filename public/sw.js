/* PWA service worker.
 *
 * Pages (navigations) are network-first: a fresh page is always fetched when
 * online, so a redeploy never leaves users on stale HTML that points at
 * deleted /_next/static chunks (ChunkLoadError). The cached shell is only an
 * offline fallback. Hashed /_next/static assets are immutable, so they are
 * cache-first. Everything else goes straight to the network.
 *
 * Bump CACHE when this file's strategy changes; activate deletes old caches.
 */
const CACHE = "fitness360-shell-v2";
const OFFLINE_SHELL = "/dashboard";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll([OFFLINE_SHELL, "/manifest.webmanifest"]).catch(() => undefined)),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  // Pages: network-first, offline fallback to the cached shell.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match(request).then((cached) => cached ?? caches.match(OFFLINE_SHELL)),
      ),
    );
    return;
  }

  // Content-hashed build assets never change: cache-first.
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ??
          fetch(request).then((response) => {
            if (response.ok) {
              const copy = response.clone();
              caches.open(CACHE).then((cache) => cache.put(request, copy));
            }
            return response;
          }),
      ),
    );
  }
  // Anything else: default browser handling (network).
});
