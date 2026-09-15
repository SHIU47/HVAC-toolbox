/**
 * HVAC Pro — 自動化混淆建置腳本
 * 執行方式：node build.js
 * 效果：將 public/ 的所有 HTML 的 JS 程式碼混淆加密，輸出到 dist/
 */

const fs   = require('fs');
const path = require('path');
const JavaScriptObfuscator = require('javascript-obfuscator');

const SRC_DIR  = path.join(__dirname, 'public');
const DIST_DIR = path.join(__dirname, 'dist');

// 混淆強度設定（安全穩定且效能優化版本，確保 3D/2D 渲染流暢，且不導致 iframe 沙盒崩潰）
const OBFUSCATOR_OPTIONS = {
  compact: true,
  controlFlowFlattening: false,       // 關閉控制流平坦化，避免 3D 與 60fps 畫布動畫卡死
  controlFlowFlatteningThreshold: 0,
  deadCodeInjection: false,
  deadCodeInjectionThreshold: 0,
  debugProtection: false,             // 關閉 debugger 陷阱，避免 iframe 沙盒崩潰
  debugProtectionInterval: 0,
  disableConsoleOutput: false,        // 不關閉 console，以維護跨 frame 事件通訊
  identifierNamesGenerator: 'hexadecimal',
  log: false,
  numbersToExpressions: false,        // 關閉數字轉表達式，確保極速數值與座標運算
  renameGlobals: false,               // 不改全域名稱，確保 API/DOM 交互正常
  selfDefending: false,               // 關閉自我防禦，避免 iframe 格式化檢測崩潰
  simplify: true,
  splitStrings: false,                // 不拆分字串，維持 DOM 操作與 CSS 性能
  stringArray: true,
  stringArrayCallsTransform: true,
  stringArrayEncoding: [],            // 關閉 Base64/RC4 編碼以獲得最穩定的相容性與載入速度
  stringArrayIndexShift: true,
  stringArrayRotate: true,
  stringArrayShuffle: true,
  stringArrayWrappersCount: 1,
  stringArrayWrappersChainedCalls: true,
  stringArrayWrappersParametersMaxCount: 2,
  stringArrayWrappersType: 'variable',
  stringArrayThreshold: 0.75,
  transformObjectKeys: false,         // 不轉換物件 key，確保物件成員正確調用
  unicodeEscapeSequence: false,
};

// 不應混淆的 script type（Babel JSX、ES Module、JSON-LD、importmap）
const SKIP_TYPES = ['text/babel', 'module', 'text/jsx', 'application/ld+json', 'importmap'];

// 腳本內容含有這些關鍵字 → 跳過（是框架程式碼，不是我們自己的邏輯）
const SKIP_CONTENT_PATTERNS = [
  'tailwind.config',          // Tailwind 設定物件
  '__clerk_frontend_api',     // Clerk 認證
  'window.MathJax',           // MathJax 設定
  'THREE.BufferGeometry',     // Three.js 物件
  'const App = () =>',        // React 箭頭元件
  'ReactDOM.createRoot',      // React 18 root
  'const root = ReactDOM',    // React root
];

function shouldSkipScript(scriptContent, scriptTag) {
  // 1. 跳過有特殊 type 的腳本
  for (const t of SKIP_TYPES) {
    if (scriptTag.includes(`type="${t}"`) || scriptTag.includes(`type='${t}'`)) return true;
  }
  // 2. 跳過太短的腳本（行內設定）
  if (scriptContent.trim().length < 120) return true;
  // 3. 跳過含有特定框架標記的腳本
  for (const pat of SKIP_CONTENT_PATTERNS) {
    if (scriptContent.includes(pat)) return true;
  }
  return false;
}

// 壓縮 CSS：移除註解、多餘空白、換行
function minifyCSS(css) {
  return css
    .replace(/\/\*[\s\S]*?\*\//g, '')     // 移除 /* 多行註解 */（CSS 標準唯一的註解形式）
    // 注意：不移除 // 因為 CSS URL 如 https:// 也含有 //
    .replace(/\s*\{\s*/g, '{')            // { 前後空白
    .replace(/\s*\}\s*/g, '}')            // } 前後空白
    .replace(/\s*:\s*/g, ':')             // : 前後空白（屬性冒號）
    .replace(/\s*;\s*/g, ';')             // ; 前後空白
    .replace(/\s*,\s*/g, ',')             // , 前後空白
    .replace(/;\s*}/g, '}')              // 移除最後一個分號
    .replace(/\n+/g, ' ')                // 換行合併
    .replace(/  +/g, ' ')               // 多餘空格
    .trim();
}

// 注入到每個 HTML <head> 的防護腳本
const ANTI_DEVTOOLS_SCRIPT = `<script>
(function(){
  // 禁用右鍵選單
  document.addEventListener('contextmenu',function(e){e.preventDefault();});
  // 禁用 F12、Ctrl+Shift+I/J/C/K、Ctrl+U、Ctrl+S
  document.addEventListener('keydown',function(e){
    if(
      e.key==='F12'||
      (e.ctrlKey&&e.shiftKey&&['i','I','j','J','c','C','k','K'].includes(e.key))||
      (e.ctrlKey&&['u','U','s','S'].includes(e.key))
    ){e.preventDefault();e.stopPropagation();return false;}
  });
})();
<\/script>`;

function obfuscateHTML(htmlContent, filename) {
  let modifiedHTML = htmlContent;
  let count = 0;

  // 0. 注入防 DevTools 腳本到 <head> 最前面
  modifiedHTML = modifiedHTML.replace(/(<head[^>]*>)/i, '$1\n' + ANTI_DEVTOOLS_SCRIPT);

  // 1. 移除 HTML 註解（保留 IE conditional comments）
  modifiedHTML = modifiedHTML.replace(/<!--(?!\[if)[\s\S]*?-->/g, '');

  // 2. 壓縮 <style>...</style> 區塊
  modifiedHTML = modifiedHTML.replace(/(<style[^>]*>)([\s\S]*?)(<\/style>)/gi, (full, open, css, close) => {
    return open + minifyCSS(css) + close;
  });

  // 3. 混淆 <script>...</script> 區塊（排除有 src 屬性的外部腳本）
  const scriptRegex = /(<script(?![^>]*\bsrc\b)([^>]*)>)([\s\S]*?)(<\/script>)/gi;

  modifiedHTML = modifiedHTML.replace(scriptRegex, (fullMatch, openTag, attrs, scriptContent, closeTag) => {
    if (shouldSkipScript(scriptContent, openTag)) {
      return fullMatch; // 保留原本
    }
    try {
      const obfuscated = JavaScriptObfuscator.obfuscate(scriptContent, OBFUSCATOR_OPTIONS).getObfuscatedCode();
      count++;
      return openTag + '\n' + obfuscated + '\n' + closeTag;
    } catch (e) {
      console.warn(`  ⚠ 混淆失敗（保留原碼）：${e.message.substring(0, 60)}`);
      return fullMatch;
    }
  });

  return { html: modifiedHTML, count };
}

function copyFileSync(src, dest) {
  const destDir = path.dirname(dest);
  if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
  fs.copyFileSync(src, dest);
}

function cleanDistDir() {
  if (!fs.existsSync(DIST_DIR)) {
    fs.mkdirSync(DIST_DIR, { recursive: true });
    return;
  }
  function cleanOrphans(dir, relDir = '') {
    for (const entry of fs.readdirSync(dir)) {
      const fullPath = path.join(dir, entry);
      const relPath = path.join(relDir, entry);
      const srcPath = path.join(SRC_DIR, relPath);
      if (!fs.existsSync(srcPath)) {
        try {
          const stat = fs.statSync(fullPath);
          if (stat.isDirectory()) {
            fs.rmSync(fullPath, { recursive: true, force: true });
            console.log(`  🗑 移除過期目錄：${relPath}`);
          } else {
            fs.unlinkSync(fullPath);
            console.log(`  🗑 移除過期孤兒檔案：${relPath}`);
          }
        } catch (e) {
          console.warn(`  ⚠ 無法刪除孤兒項目 ${relPath}: ${e.message}`);
        }
      } else if (fs.statSync(fullPath).isDirectory()) {
        cleanOrphans(fullPath, relPath);
      }
    }
  }
  cleanOrphans(DIST_DIR);
}

function buildAll() {
  console.log('🔐 HVAC Pro — JavaScript 混淆建置開始\n');

  // 建置前清理 dist 目錄，避免殘留歷史刪除的孤兒檔案
  cleanDistDir();

  // 複製 public/ 全部內容到 dist/
  const allFiles = getAllFiles(SRC_DIR);
  let htmlCount = 0, otherCount = 0;

  for (const file of allFiles) {
    const rel  = path.relative(SRC_DIR, file);
    const dest = path.join(DIST_DIR, rel);

    if (path.extname(file).toLowerCase() === '.html') {
      const raw = fs.readFileSync(file, 'utf8');
      const { html, count } = obfuscateHTML(raw, rel);
      const destDir = path.dirname(dest);
      if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
      fs.writeFileSync(dest, html, 'utf8');
      console.log(`  ✅ ${rel} — ${count} 個腳本區塊已混淆`);
      htmlCount++;
    } else {
      copyFileSync(file, dest);
      otherCount++;
    }
  }

  console.log(`\n✅ 完成！共處理 ${htmlCount} 個 HTML，複製 ${otherCount} 個其他檔案`);
  console.log(`📁 輸出目錄：${DIST_DIR}`);
  console.log('\n📋 下一步：');
  console.log('   1. 確認 firebase.json 的 hosting.public 改成 "dist"');
  console.log('   2. 執行：firebase deploy --only hosting --project hvac-pro-shiu');
}

function getAllFiles(dir) {
  let results = [];
  const EXCLUDE_NAMES = ['ZIP檔', '舊版備份檔案', '舊備份檔案', '資料中心研究清單 (Research Targets)'];
  for (const entry of fs.readdirSync(dir)) {
    if (EXCLUDE_NAMES.includes(entry)) continue;
    const full = path.join(dir, entry);
    if (fs.statSync(full).isDirectory()) {
      results = results.concat(getAllFiles(full));
    } else {
      results.push(full);
    }
  }
  return results;
}

buildAll();
