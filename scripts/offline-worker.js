/* OFFLINE is injected by the production build. No user data enters this cache. */
const base = self.registration.scope;
const prefix = `from-zero-to-gpt:offline:${base}:`;
const cacheName = prefix + OFFLINE.revision;
const urlFor = path => new URL(path, base).href;
const shell = OFFLINE.shell.map(urlFor);
const allowed = new Set(OFFLINE.assets.map(urlFor));

function cacheable(response, url) {
  if (!response.ok || response.redirected || response.status !== 200) return false;
  const type = response.headers.get('content-type') || '';
  if (url.endsWith('.html')) return type.includes('text/html');
  if (url.endsWith('.js')) return /javascript/.test(type);
  if (url.endsWith('.css')) return type.includes('text/css');
  return !type.includes('text/html');
}

self.addEventListener('install', event => {
  if (!OFFLINE.enabled) {
    event.waitUntil(self.skipWaiting());
    return;
  }
  event.waitUntil((async () => {
    const cache = await caches.open(cacheName);
    const results = await Promise.allSettled(shell.map(async url => {
      // Pair the shell with this exact build, even if a deployment changes mid-install.
      const response = url === urlFor('index.html')
        ? new Response(OFFLINE.html, {headers: {'content-type': 'text/html; charset=utf-8'}})
        : await fetch(url, {cache: 'reload', credentials: 'omit'});
      if (!cacheable(response, url)) throw new Error('Offline asset unavailable');
      await cache.put(url, response);
    }));
    if (results.some(result => result.status === 'rejected')) {
      await caches.delete(cacheName);
      throw new Error('Offline installation incomplete');
    }
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const name of await caches.keys()) {
      if (name.startsWith(prefix) && (!OFFLINE.enabled || name !== cacheName)) await caches.delete(name);
    }
    if (OFFLINE.enabled) await self.clients.claim();
    else await self.registration.unregister();
  })());
});

if (OFFLINE.enabled) self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || request.headers.has('authorization') || request.headers.has('range') || url.search) return;
  const navigation = request.mode === 'navigate' && (url.href === base || url.href === urlFor('index.html'));
  if (!navigation && !allowed.has(url.href)) return;
  const key = navigation ? urlFor('index.html') : url.href;
  const response = (async () => {
    let cache;
    try {
      cache = await caches.open(cacheName);
      const hit = await cache.match(key);
      if (hit) return hit;
    } catch { /* A storage failure should still permit online reading. */ }
    const fresh = navigation
      ? new Response(OFFLINE.html, {headers: {'content-type': 'text/html; charset=utf-8'}})
      : await fetch(request, {credentials: 'omit'});
    if (cache && cacheable(fresh, key)) {
      try { await cache.put(key, fresh.clone()); } catch { /* Quota failures must not break online reading. */ }
    }
    return fresh;
  })();
  event.respondWith(response);
  event.waitUntil(response.then(() => undefined, () => undefined));
});
