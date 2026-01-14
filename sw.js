const CACHE_NAME = 'hvac-v1';
const ASSETS = [
  './',
  './index.html',
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
