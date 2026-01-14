const CACHE_NAME = 'hvac-v2'; // 更新版本號以強迫更新
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './sw.js',
  './splash.png',
  './icon-192.png',
  './icon-512.png',
  './Clean room master.html',
  './冰機換算水泵.html',
  './冰水管路計算.html',
  './冷卻水塔補水量計算.html',
  './空氣性質分析.html',
  './空氣線圖Pro 計算器.html',
  './空調工程專業換算工具.html', // 修正為檔案截圖中的正確名稱
  './風管計算.html'
];

// 安裝時強迫跳過等待，立即生效
self.addEventListener('install', (event) => {
  self.skipWaiting(); 
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('正在快取資源...');
      return cache.addAll(ASSETS);
    })
  );
});

// 清理舊版本的快取
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('清理舊快取:', cache);
            return caches.delete(cache);
          }
        })
      );
    })
  );
});

// 攔截請求
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});
