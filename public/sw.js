/* HBOS service worker (conservative)
 *
 * Goal: speed up repeat loads by caching Next.js build assets + icons.
 * Do NOT cache HTML routes or API responses.
 */

const CACHE_VERSION = "hbos-sw-v1";
const RUNTIME_CACHE = `${CACHE_VERSION}:runtime`;

self.addEventListener("install", (event) => {
  // Activate as soon as the user accepts an update.
  self.skipWaiting();
  event.waitUntil(self.clients.claim());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key.startsWith("hbos-sw-") && !key.startsWith(CACHE_VERSION))
          .map((key) => caches.delete(key))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener("message", (event) => {
  if (!event.data) return;
  if (event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

const shouldHandleRequest = (request) => {
  if (request.method !== "GET") return false;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return false;

  // Never cache API routes.
  if (url.pathname.startsWith("/api/")) return false;

  // Only cache Next.js static build assets + icons.
  if (url.pathname.startsWith("/_next/static/")) return true;
  if (url.pathname === "/favicon-32.png") return true;
  if (url.pathname === "/apple-touch-icon.png") return true;
  if (url.pathname === "/icon-192.png") return true;
  if (url.pathname === "/icon-512.png") return true;
  if (url.pathname === "/hbos-icon.svg") return true;

  return false;
};

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (!shouldHandleRequest(request)) return;

  event.respondWith(
    (async () => {
      const cache = await caches.open(RUNTIME_CACHE);
      const cached = await cache.match(request);
      const networkFetch = fetch(request)
        .then((response) => {
          // Only cache successful responses.
          if (response && response.ok) {
            cache.put(request, response.clone());
          }
          return response;
        })
        .catch(() => null);

      // Stale-while-revalidate.
      return cached || (await networkFetch) || new Response("", { status: 504 });
    })()
  );
});
