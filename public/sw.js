/* Buyam Sellam service worker.
 *
 * Goal: the installed app opens fast and still shows something useful on
 * a weak or dropped connection (common on mobile data in Cameroon),
 * without ever serving someone a stale cart, order, payment or account
 * page.
 *
 *  - Build files (/_next/static): cache-first. Their names change with
 *    every release, so a cached copy is never out of date.
 *  - Product photos and app icons: served from cache, refreshed in the
 *    background, capped in number.
 *  - Public pages (home, browse, products, shops, guides…): network
 *    first; the last good copy is kept so a page already seen can be
 *    reopened offline.
 *  - Private or money pages (account, dashboard, admin, bag, checkout,
 *    pay, order, login…) and all API calls: never cached, straight to
 *    the network. Offline they get the offline screen.
 *
 * A new version waits until the visitor taps "Refresh" in the app (or
 * closes it), so nobody is reloaded in the middle of paying.
 */
const VERSION = "bs-v2";
const SHELL_CACHE = `${VERSION}-shell`;
const STATIC_CACHE = `${VERSION}-static`;
const PAGE_CACHE = `${VERSION}-pages`;
const IMAGE_CACHE = `${VERSION}-images`;
const OFFLINE_URL = "/offline.html";
const MAX_PAGES = 40;
const MAX_IMAGES = 120;
const MAX_STATIC = 300;

const PRIVATE_PREFIXES = [
  "/account", "/dashboard", "/admin", "/bag", "/checkout", "/pay", "/order",
  "/login", "/signup", "/buyer-signup", "/forgot-password", "/reset-password",
  "/sell", "/become-seller", "/track-order", "/group-buy",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll([OFFLINE_URL, "/app-icon/192"]))
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

async function trim(cacheName, max) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - max; i++) await cache.delete(keys[i]);
}

function isPrivate(pathname) {
  return PRIVATE_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/") || pathname.startsWith(p + "?"));
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);

  // Product photos live on Supabase Storage (another origin).
  const isStorageImage = url.hostname.endsWith(".supabase.co") && url.pathname.startsWith("/storage/v1/object/public/");
  if (url.origin !== self.location.origin && !isStorageImage) return;

  if (isStorageImage || url.pathname.startsWith("/_next/image") || url.pathname.startsWith("/app-icon/")) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(request));
    return;
  }

  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/auth/")) return;

  if (request.mode === "navigate") {
    event.respondWith(isPrivate(url.pathname) ? networkOnlyPage(request) : networkFirstPage(request));
  }
});

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(STATIC_CACHE);
    cache.put(request, response.clone()).then(() => trim(STATIC_CACHE, MAX_STATIC));
  }
  return response;
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(IMAGE_CACHE);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then((response) => {
      if (response.ok || response.type === "opaque") {
        cache.put(request, response.clone()).then(() => trim(IMAGE_CACHE, MAX_IMAGES));
      }
      return response;
    })
    .catch(() => cached);
  return cached || network;
}

async function networkOnlyPage(request) {
  try {
    return await fetch(request);
  } catch {
    return (await caches.match(OFFLINE_URL)) || Response.error();
  }
}

async function networkFirstPage(request) {
  const cache = await caches.open(PAGE_CACHE);
  try {
    const response = await fetch(request);
    // Only keep ordinary, successful pages — never redirects or errors.
    if (response.ok && response.type === "basic" && !response.redirected) {
      cache.put(request, response.clone()).then(() => trim(PAGE_CACHE, MAX_PAGES));
    }
    return response;
  } catch {
    const cached = await cache.match(request, { ignoreSearch: false });
    return cached || (await caches.match(OFFLINE_URL)) || Response.error();
  }
}

self.addEventListener("message", (event) => {
  if (event.data === "skip-waiting") self.skipWaiting();
});

/* ---- Push notifications (orders, offers, payments) ---- */

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "Buyam Sellam", body: event.data ? event.data.text() : "" };
  }
  const title = data.title || "Buyam Sellam";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || "",
      icon: "/app-icon/192",
      badge: "/app-icon/badge",
      tag: data.tag || undefined,
      renotify: Boolean(data.tag),
      data: { url: typeof data.url === "string" && data.url.startsWith("/") ? data.url : "/" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL((event.notification.data && event.notification.data.url) || "/", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((wins) => {
      // Reuse an open Buyam Sellam window if there is one.
      for (const win of wins) {
        if (new URL(win.url).origin === self.location.origin && "focus" in win) {
          return win.navigate(url).then((w) => (w || win).focus()).catch(() => win.focus());
        }
      }
      return self.clients.openWindow(url);
    })
  );
});

// The browser rotated this device's push address: tell the server so
// notifications keep arriving without the person doing anything.
self.addEventListener("pushsubscriptionchange", (event) => {
  const old = event.oldSubscription;
  event.waitUntil(
    (async () => {
      const keyRes = await fetch("/api/push/key");
      const { publicKey } = await keyRes.json();
      const sub = event.newSubscription || (await self.registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: publicKey }));
      if (!old || !sub) return;
      const json = sub.toJSON();
      await fetch("/api/push/renew", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ oldEndpoint: old.endpoint, endpoint: json.endpoint, keys: json.keys }),
      });
    })().catch(() => {})
  );
});

