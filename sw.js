/* Isai service worker: keeps the app shell available offline so Chrome never shows its "You're offline" page.
   Deploy next to isai.html (replaces the old sw.js). Audio/API requests are never touched. */
const CACHE = 'isai-shell-v1';
const SHELL = self.location.origin + '/__isai_shell__';

self.addEventListener('install', e => { self.skipWaiting(); });
self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== CACHE && k.startsWith('isai-')) await caches.delete(k);
    await self.clients.claim();
  })());
});

async function put(req, res) {
  if (!res || !res.ok) return;
  const c = await caches.open(CACHE);
  await c.put(req, res.clone());
  if (req.mode === 'navigate') await c.put(SHELL, res.clone());
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Page loads: network first, fall back to the cached copy when offline
  if (req.mode === 'navigate') {
    e.respondWith((async () => {
      try { const res = await fetch(req); e.waitUntil(put(req, res.clone())); return res; }
      catch {
        const c = await caches.open(CACHE);
        return (await c.match(req, { ignoreSearch: true })) || (await c.match(SHELL)) || Response.error();
      }
    })());
    return;
  }

  // Same-origin static files + the Thirai logo: serve cached, refresh in background
  const static_ = url.origin === self.location.origin && /\.(png|jpg|jpeg|svg|ico|webp|json|css|js|woff2?)$/i.test(url.pathname);
  const logo = url.hostname === 'thirai.uk' && url.pathname.startsWith('/static/');
  if (static_ || logo) {
    e.respondWith((async () => {
      const c = await caches.open(CACHE), hit = await c.match(req);
      const net = fetch(req).then(res => { if (res && (res.ok || res.type === 'opaque')) c.put(req, res.clone()); return res; }).catch(() => null);
      return hit || (await net) || Response.error();
    })());
  }
});
