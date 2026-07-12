declare const APP_CACHE_NAME: string;
declare const APP_SHELL: readonly string[];

const worker = globalThis as unknown as ServiceWorkerGlobalScope;
const cachePrefix = "keychain-shell-";
const cacheableDestinations: ReadonlySet<string> = new Set([
  "font",
  "image",
  "manifest",
  "script",
  "style",
]);

const canCache = (response: Response): boolean =>
  response.ok && (response.type === "basic" || response.type === "default");

const navigationResponse = async (request: Request): Promise<Response> => {
  const cache = await caches.open(APP_CACHE_NAME);
  try {
    return await fetch(request);
  } catch (error: unknown) {
    const cached =
      (await cache.match(request, { ignoreSearch: true })) ??
      (await cache.match("./index.html")) ??
      (await cache.match("./"));
    if (cached) return cached;
    throw new Error("The offline app shell is unavailable", { cause: error });
  }
};

const assetResponse = async (request: Request): Promise<Response> => {
  const cache = await caches.open(APP_CACHE_NAME);
  const cached = await cache.match(request, { ignoreSearch: true });
  if (cached) return cached;

  const response = await fetch(request);
  if (canCache(response)) await cache.put(request, response.clone());
  return response;
};

worker.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(APP_CACHE_NAME);
      await cache.addAll([...APP_SHELL]);
      await worker.skipWaiting();
    })(),
  );
});

worker.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter((name) => name.startsWith(cachePrefix) && name !== APP_CACHE_NAME)
          .map((name) => caches.delete(name)),
      );
      await worker.clients.claim();
    })(),
  );
});

worker.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== worker.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(navigationResponse(request));
    return;
  }
  if (!url.pathname.endsWith("/sw.js") && cacheableDestinations.has(request.destination)) {
    event.respondWith(assetResponse(request));
  }
});
