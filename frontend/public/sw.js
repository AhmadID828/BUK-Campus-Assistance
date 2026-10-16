const CACHE_NAME = "buk-campus-map-tiles-v2";
const PREVIOUS_CACHE_NAME = "buk-map-tiles-v1";
const TILE_HOST = "tile.openstreetmap.org";
const CAMPUS_BOUNDS = {
  south: 11.93,
  west: 8.36,
  north: 12.04,
  east: 8.53,
};

function isCampusTile(url) {
  if (url.hostname !== TILE_HOST) return false;

  const match = url.pathname.match(/^\/(\d+)\/(\d+)\/(\d+)\.png$/);
  if (!match) return false;

  const zoom = Number(match[1]);
  const x = Number(match[2]);
  const y = Number(match[3]);
  const tileCount = 2 ** zoom;
  if (zoom < 12 || zoom > 19 || x < 0 || y < 0 || x >= tileCount || y >= tileCount) {
    return false;
  }

  const west = (x / tileCount) * 360 - 180;
  const east = ((x + 1) / tileCount) * 360 - 180;
  const north = (Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / tileCount))) * 180) / Math.PI;
  const south =
    (Math.atan(Math.sinh(Math.PI * (1 - (2 * (y + 1)) / tileCount))) * 180) / Math.PI;

  return (
    east >= CAMPUS_BOUNDS.west &&
    west <= CAMPUS_BOUNDS.east &&
    north >= CAMPUS_BOUNDS.south &&
    south <= CAMPUS_BOUNDS.north
  );
}

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .delete(PREVIOUS_CACHE_NAME)
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const requestUrl = new URL(event.request.url);
  if (event.request.method !== "GET" || !isCampusTile(requestUrl)) {
    return;
  }

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(event.request);
      if (cached) return cached;

      try {
        const response = await fetch(event.request);
        if (response.ok) {
          await cache.put(event.request, response.clone());
        }
        return response;
      } catch {
        return new Response(null, {
          status: 503,
          statusText: "Map tile unavailable offline",
        });
      }
    }),
  );
});
