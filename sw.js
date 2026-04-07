const CACHE_NAME = 'forage-cache-v3';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon.png'
];

// Install: cache static files
self.addEventListener('install', evt=>{
  evt.waitUntil(
    caches.open(CACHE_NAME).then(cache=>cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener('activate', evt=>{
  evt.waitUntil(
    caches.keys().then(keys=>Promise.all(
      keys.map(key=>{ if(key!==CACHE_NAME) return caches.delete(key); })
    ))
  );
  self.clients.claim();
});

// Fetch: serve from cache, then network, and cache images dynamically
self.addEventListener('fetch', evt=>{
  if(evt.request.method!=='GET') return;

  evt.respondWith(
    caches.match(evt.request).then(cachedRes=>{
      if(cachedRes) return cachedRes;

      return fetch(evt.request).then(fetchRes=>{
        return caches.open(CACHE_NAME).then(cache=>{
          if(evt.request.destination==='image') cache.put(evt.request, fetchRes.clone());
          return fetchRes;
        });
      }).catch(()=>{
        if(evt.request.destination==='image') return caches.match('/icon.png');
      });
    })
  );
});