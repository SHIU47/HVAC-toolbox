const CACHE_NAME = 'hvac-v3'; 
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './splash.png',
  './sw.js',
  './Clean room master.html',
  './冰機換算水泵.html',
  './冰水管路計算.html',
  './冷卻水塔補水量計算.html',
  './空氣性質分析.html',
  './空氣線圖Pro 計算器.html',
  './空調工程專業換算工具.html',
  './風管計算.html'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(keys.map((key) => {
        if (key !== CACHE_NAME) return caches.delete(key);
      }));
    })
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((res) => res || fetch(event.request))
  );
});
