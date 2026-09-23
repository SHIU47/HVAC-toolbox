#!/usr/bin/env node
// UI 結構快照 — 用 jsdom 載入全部 app JS，對預設專案依序 render Step 1–5，
// 擷取 #stepContent.innerHTML。
//   結構快照：所有數字換成 # 後存檔 → Phase B 每個任務比對必須完全相同（數字可變，結構不可變）
//   完整快照：原樣存檔 → Phase C/D 比對必須完全相同（連數字都不可變，因為那兩個 Phase 是純重構）
//
// 用法：
//   node ui_snapshot.js --save snap.json [--mode structural|full]
//   node ui_snapshot.js --compare snap.json --mode structural   （Phase B 用）
//   node ui_snapshot.js --compare snap.json --mode full         （Phase C/D 用）
'use strict';
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const JS_DIR = path.resolve(__dirname, '../../public/Data center Cal/js');

// 與 index.html 一致的載入順序，排除 vendor 套件（tailwind/lucide/chart/exceljs）—
// 這些只影響視覺樣式/字型/圖表渲染，不影響本專案 view 產生的 HTML 字串結構。
const APP_FILES = [
  'assumptions.js', 'engines_core.js', 'engines_cdu.js', 'engines_crah.js', 'engines_chiller.js',
  'engines_cooling_tower.js', 'engines_free_cooling.js', 'engines_hx.js', 'engines_pump.js',
  'weather_builtin.js', 'epw_parser.js', 'components/equipment_designer.js',
  'device_catalog_builtin.js', 'catalog_manager.js', 'ui_kit.js', 'store.js', 'excel_export.js',
  'views/view_weather.js', 'views/view_hall_su.js', 'views/view_corepod.js',
  'views/view_cooling.js', 'views/view_dashboard.js', 'app.js'
];

const SKELETON_HTML = `<!doctype html>
<html lang="zh-TW">
<head><meta charset="UTF-8"></head>
<body class="bg-bg text-primary min-h-screen flex flex-col antialiased">
  <header class="bg-surface border-b border-border sticky top-0 z-40">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-col md:flex-row items-center justify-between gap-3">
      <div class="flex items-center gap-3">
        <img src="app_icon.png" class="w-9 h-9 rounded-lg object-cover" alt="PUE Logo">
        <div>
          <h1 class="text-base font-semibold text-primary leading-tight">PUE 計算系統</h1>
        </div>
      </div>
      <div class="flex items-center gap-3 flex-wrap">
        <div class="flex items-center gap-1.5 bg-bg px-2.5 py-1.5 rounded-lg border border-border">
          <button onclick="window.App.exportProjectFile()">儲存專案</button>
          <button onclick="document.getElementById('projectFileInput').click()">開啟專案</button>
          <input type="file" id="projectFileInput" accept=".json" class="hidden" onchange="window.App.importProjectFile(event)">
          <button onclick="window.App.resetProject()">重置</button>
        </div>
        <div class="flex items-center gap-3 bg-bg px-3.5 py-1.5 rounded-lg border border-border text-xs">
          <div><div class="text-sm font-semibold text-brand-600 tabular-nums" id="stickyPue">1.071</div></div>
          <div><div class="text-sm font-semibold text-primary tabular-nums" id="stickyWue">0.00 L/kWh</div></div>
          <div><div class="text-sm font-semibold text-primary tabular-nums" id="stickyIt">1.08 MW</div></div>
          <div><div class="text-sm font-semibold text-brand-600 tabular-nums" id="stickyFc">100.0%</div></div>
        </div>
      </div>
    </div>
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2 border-t border-border-subtle overflow-x-auto flex items-center gap-2">
      <button data-step="1" class="step-btn"><span class="step-circle">1</span><span class="step-title">案場 8760h 氣象</span></button>
      <button data-step="2" class="step-btn"><span class="step-circle">2</span><span class="step-title">Hall → DU → SU 模組</span></button>
      <button data-step="3" class="step-btn"><span class="step-circle">3</span><span class="step-title">CorePOD 核心機房</span></button>
      <button data-step="4" class="step-btn"><span class="step-circle">4</span><span class="step-title">逐 DU 雙冷卻系統</span></button>
      <button data-step="5" class="step-btn"><span class="step-circle">5</span><span class="step-title">8,760h 成果儀表板</span></button>
    </div>
  </header>
  <main class="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6" id="stepContent"></main>
  <footer class="bg-surface border-t border-border py-4 text-center text-xs text-tertiary">PUE 計算系統</footer>
</body>
</html>`;

function buildWindow() {
  const dom = new JSDOM(SKELETON_HTML, { url: 'http://localhost/', runScripts: 'dangerously', pretendToBeVisual: true });
  const win = dom.window;

  // Vendor 套件 stub — 只需要不 throw，不需要真的畫圖
  win.Chart = function (el, cfg) { this._el = el; this._cfg = cfg; this.destroy = () => {}; this.update = () => {}; };
  win.lucide = { createIcons() {} };
  win.alert = () => {};
  win.confirm = () => false;
  win.requestAnimationFrame = () => 0;
  win.cancelAnimationFrame = () => {};

  // jsdom 沒有內建 <canvas> 2D context（需要另外裝 native `canvas` 套件）。
  // Dashboard 的熱力圖直接用 canvas 2D API 手繪，我們不在乎畫出來的像素，
  // 只在乎 DOM 結構，所以用 Proxy 給一個「呼叫什麼方法都不出錯」的假 context：
  // 任何方法呼叫回傳自己（可鏈式呼叫也安全），任何屬性存取/賦值都吸收掉。
  const fakeCtx2D = new Proxy({}, {
    get(_t, prop) {
      if (prop === 'canvas') return null;
      if (prop === 'measureText') return () => ({ width: 0 });
      if (prop === 'createLinearGradient' || prop === 'createRadialGradient') {
        return () => ({ addColorStop() {} });
      }
      return () => fakeCtx2D;
    },
    set() { return true; }
  });
  win.HTMLCanvasElement.prototype.getContext = () => fakeCtx2D;

  // app.js 結尾會 document.addEventListener('DOMContentLoaded', () => App.init())。
  // jsdom 的 DOMContentLoaded 何時觸發相對於我們同步塞入 <script> 的時機不保證，
  // 為了讓這支工具的執行結果完全可預期（只由我們手動呼叫 App.init()/goToStep()
  // 觸發渲染），把 DOMContentLoaded 的監聽直接濾掉。
  const origAddEventListener = win.document.addEventListener.bind(win.document);
  win.document.addEventListener = (type, ...rest) => {
    if (type === 'DOMContentLoaded') return;
    return origAddEventListener(type, ...rest);
  };

  // 注意：不可用 win.eval(code) 載入這些檔案 — 它們開頭都有 'use strict'，
  // 而 indirect eval 對 strict-mode 程式碼會建立獨立的宣告環境，導致頂層
  // function/var 宣告不會掛到 window 上（跟真正的 <script> 標籤行為不同），
  // 下一個檔案就抓不到上一個檔案定義的函式（例如 sumRunning is not defined）。
  // 改成建立真正的 <script> 元素塞進 document 執行，語意才等同瀏覽器載入。
  for (const rel of APP_FILES) {
    const code = fs.readFileSync(path.join(JS_DIR, rel), 'utf8');
    const el = win.document.createElement('script');
    el.textContent = code;
    win.document.body.appendChild(el);
  }
  return win;
}

function toStructural(html) {
  return html.replace(/\d/g, '#');
}

async function captureAllSteps() {
  const win = buildWindow();
  if (win.App && typeof win.App.init === 'function') {
    await win.App.init();
  }
  const container = win.document.getElementById('stepContent');
  const snap = {};
  for (let step = 1; step <= 5; step++) {
    // 用 renderStep() 而非 goToStep()：goToStep(5) 有 N+1 選型驗證閘門
    // (canProceedStep4)，預設專案不一定通過，會直接 return 而不渲染，
    // 讓 snapshot 誤拿到上一步的殘留內容。renderStep() 是純渲染，無此業務閘門。
    win.App.renderStep(step);
    snap['step' + step] = container.innerHTML;
  }
  return snap;
}

async function main() {
  const args = process.argv.slice(2);
  const mode = args[0];
  const idx = args.indexOf('--mode');
  const compareMode = idx >= 0 ? args[idx + 1] : 'structural';
  const file = args[1] && !args[1].startsWith('--') ? args[1] : path.join(__dirname, 'ui_snapshot_baseline.json');

  const raw = await captureAllSteps();

  if (mode === '--save') {
    fs.writeFileSync(file, JSON.stringify(raw, null, 2));
    console.log(`Saved raw UI snapshot (${Object.keys(raw).length} steps) to ${file}`);
    return;
  }

  if (mode === '--compare') {
    const baseline = JSON.parse(fs.readFileSync(file, 'utf8'));
    let anyDiff = false;
    for (const step of Object.keys(baseline)) {
      const b = compareMode === 'full' ? baseline[step] : toStructural(baseline[step]);
      const c = compareMode === 'full' ? raw[step] : toStructural(raw[step] || '');
      if (b !== c) {
        anyDiff = true;
        console.log(`--- DIFF in ${step} (mode=${compareMode}) ---`);
        // 印出第一個不同的位置附近文字，方便定位
        let i = 0;
        while (i < b.length && i < c.length && b[i] === c[i]) i++;
        console.log('baseline @', i, ':', JSON.stringify(b.slice(Math.max(0, i - 40), i + 80)));
        console.log('current  @', i, ':', JSON.stringify(c.slice(Math.max(0, i - 40), i + 80)));
      }
    }
    if (!anyDiff) {
      console.log(`No UI differences (mode=${compareMode}) across ${Object.keys(baseline).length} steps.`);
      process.exit(0);
    }
    process.exit(1);
  }

  console.log('Usage: node ui_snapshot.js --save <file> | --compare <file> [--mode structural|full]');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
