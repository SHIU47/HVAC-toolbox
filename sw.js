const CACHE_NAME = 'hvac-v1';
const ASSETS = [
  './',
  './index.html',
  './Clean room master.html',
  './icon-512.png',
  './icon-192.png',
   './splash.png',
  './冰機換算水泵.html',
  './冰水管路計算.html',
  './冷卻水塔補水量計算.html',
  './空氣性質分析.html',
  './空氣線圖Pro 計算器.html',
  './空調專業換算工具.html',
  './風管計算.html',
  // 如果你有其他的 css 或 js 檔案，請在下面列出路徑
  // './style.css',
  // './script.js'
];

// 安裝並快取資源
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
});

// 攔截請求並回傳快取內容
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});
