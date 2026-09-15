const CACHE_NAME = 'hvac-v4';
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

// 動態子模組（whitespace/mep-room/chiller-plant）不快取，永遠從網路取
const BYPASS_PATTERNS = [
  /\/whitespace\//,
  /\/mep-room\//,
  /\/chiller-plant\//,
  /\/Data center\.html/,
  /\/Data%20center\.html/,
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
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = event.request.url;
  if (BYPASS_PATTERNS.some((p) => p.test(url))) {
    event.respondWith(fetch(event.request));
    return;
  }
  event.respondWith(
    caches.match(event.request).then((res) => res || fetch(event.request))
  );
});
