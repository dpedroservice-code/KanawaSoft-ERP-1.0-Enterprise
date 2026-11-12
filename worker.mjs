const CONFIG_PATH = "/runtime-config.js";
const SERVICE_WORKER_PATH = "/service-worker.js";
const SERVICE_WORKER_SOURCE = String.raw`
const CACHE_NAME = "kanawa-shell-v1.0.20261112.4";
const SERVICE_WORKER_PATH = "/service-worker.js";
const CORE_URLS = ["/", "/index.html", "/manifest.json", "/runtime-config.js"];
const isApiPath = (path) => ["/auth/","/rest/","/functions/","/storage/","/realtime/"].some((prefix) => path.startsWith(prefix));
const isStaticPath = (path) => ["js","mjs","css","woff","woff2","ttf","otf","png","svg","ico","webp","jpg","jpeg"].includes(path.toLowerCase().split(".").pop());
const isSupabaseHost = (host) => host === "supabase.co" || host.endsWith(".supabase.co");
async function cacheUrl(cache, value) {
  try {
    const url = new URL(value, self.location.origin);
    const request = new Request(url.href, { mode: url.origin === self.location.origin ? "same-origin" : "no-cors", credentials: "omit" });
    const response = await fetch(request);
    if (response.ok || response.type === "opaque") await cache.put(request, response.clone());
  } catch (_) {}
}
self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await Promise.all(CORE_URLS.map((url) => cacheUrl(cache, url)));
    const html = await cache.match("/index.html") || await cache.match("/");
    if (html) {
      const source = await html.text();
      const urls = new Set();
      for (const match of source.matchAll(/(?:src|href)\s*=\s*["']([^"']+)["']/gi)) {
        try {
          const url = new URL(match[1], self.location.origin);
          if (!isStaticPath(url.pathname) || isSupabaseHost(url.hostname)) continue;
          urls.add(url.href);
        } catch (_) {}
      }
      await Promise.all(Array.from(urls).map((url) => cacheUrl(cache, url)));
    }
    await self.skipWaiting();
  })());
});
self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key.startsWith("kanawa-shell-") && key !== CACHE_NAME).map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});
self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin === self.location.origin) {
    if (isApiPath(url.pathname) || url.pathname === SERVICE_WORKER_PATH) return;
    if (url.pathname === "/runtime-config.js" || url.pathname === "/" || url.pathname === "/index.html") {
      event.respondWith((async () => {
        const cache = await caches.open(CACHE_NAME);
        try {
          const response = await fetch(request);
          if (response.ok) await cache.put(request, response.clone());
          return response;
        } catch (_) {
          return (await cache.match(request)) || (await cache.match("/")) || Response.error();
        }
      })());
      return;
    }
    if (isStaticPath(url.pathname)) {
      event.respondWith((async () => {
        const cache = await caches.open(CACHE_NAME);
        const cached = await cache.match(request);
        const network = fetch(request).then(async (response) => {
          if (response.ok) await cache.put(request, response.clone());
          return response;
        }).catch(() => cached || Response.error());
        return cached || network;
      })());
      return;
    }
  } else if (!isSupabaseHost(url.hostname) && ["script","style","font","image"].includes(request.destination)) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(request);
      const network = fetch(request).then(async (response) => {
        if (response.ok || response.type === "opaque") await cache.put(request, response.clone());
        return response;
      }).catch(() => cached || Response.error());
      return cached || network;
    })());
  }
});
`;


function buildRuntimeConfig(env) {
  const isProduction = env.KANAWA_ENV === "production";
  const url = isProduction && typeof env.KANAWA_SUPABASE_URL === "string"
    ? env.KANAWA_SUPABASE_URL.trim()
    : "";
  const publishableKey = isProduction && typeof env.KANAWA_SUPABASE_PUBLISHABLE_KEY === "string"
    ? env.KANAWA_SUPABASE_PUBLISHABLE_KEY.trim()
    : "";
  const enabled = isProduction && Boolean(url && publishableKey);

  const config = {
    enabled,
    url: enabled ? url : "",
    publishableKey: enabled ? publishableKey : ""
  };

  return [
    "window.KANAWA_SUPABASE_CONFIG = Object.freeze(" + JSON.stringify(config) + ");",
    "window.KANAWA_PREVIEW_DEMO = " + String(!isProduction) + ";",
    "window.KANAWA_PREVIEW_READ_ONLY = " + String(!enabled) + ";",
    ""
  ].join("\n");
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === SERVICE_WORKER_PATH) {
      return new Response(request.method === "HEAD" ? null : SERVICE_WORKER_SOURCE, {
        status: 200,
        headers: {
          "Content-Type": "application/javascript; charset=utf-8",
          "Cache-Control": "no-cache, no-store, must-revalidate",
          "Service-Worker-Allowed": "/",
          "X-Content-Type-Options": "nosniff"
        }
      });
    }

    if (url.pathname === CONFIG_PATH) {
      const body = buildRuntimeConfig(env);
      return new Response(request.method === "HEAD" ? null : body, {
        status: 200,
        headers: {
          "Content-Type": "application/javascript; charset=utf-8",
          "Cache-Control": "no-store, max-age=0",
          "Pragma": "no-cache",
          "X-Content-Type-Options": "nosniff"
        }
      });
    }

    return env.ASSETS.fetch(request);
  }
};
