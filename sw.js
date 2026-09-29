/* 东莞中考数学知识地图 · Service Worker
 * 作用：让页面在 https/localhost 下可"添加到主屏幕"并离线打开。
 * 更新：只改 index.html 即可 —— 页面导航请求走"网络优先"，联网打开一次就是最新内容，
 *       离线时回退到上次缓存；改动较大时也可把下面的 VERSION 改一下强制刷新缓存。 */
const VERSION = "2026-09-29-1";
const CACHE = "dg-math-map-" + VERSION;

const SCOPE = self.registration.scope; // 形如 https://example.com/xxx/
const PAGE = new URL("index.html", SCOPE).href;
const CORE = ["index.html", "manifest.json", "icon-180.png", "icon-192.png", "icon-512.png"]
  .map(f => new URL(f, SCOPE).href);

self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // 逐个缓存：个别文件缺失也不至于整包安装失败
    await Promise.all(CORE.map(url =>
      cache.add(new Request(url, { cache: "reload" })).catch(() => {})
    ));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", event => {
  const req = event.request;
  if (req.method !== "GET") return;

  let url;
  try { url = new URL(req.url); } catch (e) { return; }
  if (url.origin !== self.location.origin) return;

  // 页面本身：网络优先，离线时回退缓存（保证内容始终是最新的）
  if (req.mode === "navigate") {
    event.respondWith((async () => {
      try {
        const res = await fetch(req);
        if (res && res.ok) {
          const cache = await caches.open(CACHE);
          cache.put(PAGE, res.clone());
        }
        return res;
      } catch (err) {
        const cache = await caches.open(CACHE);
        return (await cache.match(PAGE)) || (await cache.match(SCOPE)) || Response.error();
      }
    })());
    return;
  }

  // 其余同源静态资源：缓存优先，后台静默更新
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(req);
    const network = fetch(req).then(res => {
      if (res && res.ok && res.type === "basic") cache.put(req, res.clone());
      return res;
    }).catch(() => null);
    return cached || (await network) || Response.error();
  })());
});
