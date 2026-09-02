/**
 * build_builtin.js — 產生 js/device_catalog_builtin.js
 *
 * 目的：CatalogManager 原本用 fetch() 讀取 device_catalog/*.json，這在使用者直接
 * 雙擊 index.html（file:// 協議）時會被瀏覽器擋掉（CORS），導致抓不到任何本檔案夾
 * 新增的真實廠商資料，只能用內建的極簡通用資料。
 *
 * 解法沿用本專案 weather_builtin.js 的既有作法：把 device_catalog/ 底下所有
 * catalog_index.json 引用到的廠商 JSON 檔案內容，內嵌進一個純 JS 檔（用
 * <script> 標籤載入，不受 file:// 限制），CatalogManager 在偵測到 file:// 時
 * 改用這份內嵌資料而非 fetch。
 *
 * 使用方式：每次新增/修改 device_catalog/*.json 後，執行
 *   node device_catalog/build_builtin.js
 * 重新產生 js/device_catalog_builtin.js。
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DEVICE_CATALOG_DIR = __dirname;
const OUT_FILE = path.join(ROOT, 'js', 'device_catalog_builtin.js');

const idx = JSON.parse(fs.readFileSync(path.join(DEVICE_CATALOG_DIR, 'catalog_index.json'), 'utf8'));

const raw = {};
let fileCount = 0;

for (const [catKey, catDef] of Object.entries(idx.categories || {})) {
    raw[catKey] = [];
    for (const vendor of (catDef.vendors || [])) {
        const filePath = path.join(DEVICE_CATALOG_DIR, vendor.file);
        if (!fs.existsSync(filePath)) {
            console.warn(`[build_builtin] 找不到檔案，略過: ${vendor.file}`);
            continue;
        }
        try {
            const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            raw[catKey].push(data);
            fileCount++;
        } catch (e) {
            console.warn(`[build_builtin] JSON 解析失敗，略過: ${vendor.file} (${e.message})`);
        }
    }
}

const header = `/**
 * device_catalog_builtin.js — 自動產生檔案，勿手動編輯
 * 由 device_catalog/build_builtin.js 從 device_catalog/*.json 內嵌產生。
 * 用途：當頁面以 file:// 協議開啟（直接雙擊 index.html）時，CatalogManager
 * 無法用 fetch() 讀取 device_catalog/ 底下的 JSON 檔案（瀏覽器 CORS 限制），
 * 此檔案把相同內容內嵌為 JS 物件，改用 <script> 標籤載入即可繞過限制。
 * 產生時間：${new Date().toISOString()}
 * 若修改了 device_catalog/*.json，請重新執行：node device_catalog/build_builtin.js
 */
window.DEVICE_CATALOG_BUILTIN_RAW = `;

const content = header + JSON.stringify(raw, null, 2) + ';\n';

fs.writeFileSync(OUT_FILE, content, 'utf8');
console.log(`[build_builtin] 已產生 ${path.relative(ROOT, OUT_FILE)}，共內嵌 ${fileCount} 個廠商檔案，${Object.keys(raw).length} 個分類。`);
