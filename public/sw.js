/* Trace service worker：应用壳缓存 + 页面网络优先 + 离线兜底 */
const VERSION = "v2";
const SHELL = `trace-shell-${VERSION}`;
const PAGES = `trace-pages-${VERSION}`;
const IMAGES = `trace-images-${VERSION}`;
const OFFLINE_URL = "/offline.html";

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(SHELL).then((c) => c.addAll([OFFLINE_URL, "/icons/icon-192.png"])).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => ![SHELL, PAGES, IMAGES].includes(k)).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

self.addEventListener("push", (event) => {
  if (!event.data) return;
  let payload = {};
  try {
    payload = event.data.json();
  } catch {
    payload = { title: "Trace", body: event.data.text() };
  }
  event.waitUntil(
    self.registration.showNotification(payload.title || "Trace", {
      body: payload.body || "",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      tag: payload.tag,
      renotify: false,
      data: { url: payload.url || "/trips" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/trips";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if (c.url.includes(url) && "focus" in c) return c.focus();
      }
      return self.clients.openWindow(url);
    })
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Next 静态资源：cache-first（内容哈希）
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(caches.open(SHELL).then(async (c) => (await c.match(req)) ?? fetch(req).then((r) => (c.put(req, r.clone()), r))));
    return;
  }
  // 图片：stale-while-revalidate（限量）
  if (url.pathname.startsWith("/api/files/")) {
    event.respondWith(
      caches.open(IMAGES).then(async (c) => {
        const cached = await c.match(req);
        const net = fetch(req).then((r) => {
          if (r.ok) c.put(req, r.clone());
          return r;
        }).catch(() => cached);
        return cached ?? net;
      })
    );
    return;
  }
  // API / 服务端动作：不缓存
  if (url.pathname.startsWith("/api/") || req.headers.get("accept")?.includes("text/x-component") || req.headers.has("next-action")) return;

  // 页面：network-first，失败回落缓存或离线页
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((r) => {
          if (r.ok) caches.open(PAGES).then((c) => c.put(req, r.clone()));
          return r;
        })
        .catch(async () => (await caches.match(req)) ?? caches.match(OFFLINE_URL))
    );
  }
});
