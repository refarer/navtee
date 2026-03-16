const CACHE_NAME = "overpass-v1";
const OVERPASS_ORIGINS = [
  "https://overpass-api.de",
  "https://overpass.private.coffee",
];
const TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

self.addEventListener("fetch", (event) => {
  if (!OVERPASS_ORIGINS.some((o) => event.request.url.startsWith(o))) return;
  event.respondWith(handleOverpass(event.request));
});

async function getCacheKey(request) {
  if (request.method === "POST") {
    const body = await request.clone().text();
    return new Request(`${request.url}?${body}`);
  }
  return request;
}

async function handleOverpass(request) {
  const cache = await caches.open(CACHE_NAME);
  const cacheKey = await getCacheKey(request);
  const cached = await cache.match(cacheKey);

  if (cached) {
    const cachedTime = cached.headers.get("X-Cache-Time");
    if (cachedTime && Date.now() - Number(cachedTime) < TTL_MS) {
      return cached;
    }
  }

  const response = await fetch(request);
  if (response.ok) {
    const body = await response.arrayBuffer();
    const headers = new Headers(response.headers);
    headers.set("X-Cache-Time", String(Date.now()));
    await cache.put(
      cacheKey,
      new Response(body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      }),
    );
    return new Response(body, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
  }

  return response;
}
