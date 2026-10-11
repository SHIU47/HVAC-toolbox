'use strict';
/**
 * dom_harness.js - Shared jsdom harness for UI snapshots and DOM wiring unit tests.
 */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const JS_DIR = path.resolve(__dirname, '../../public/Data center Cal/js');

const APP_FILES = [
  'assumptions.js', 'engines_core.js', 'engines_cdu.js', 'engines_crah.js', 'engines_chiller.js',
  'engines_cooling_tower.js', 'engines_free_cooling.js', 'engines_hx.js', 'engines_pump.js',
  'cooling/registry.js',
  'cooling/stages/stage_dry_cooler.js',
  'cooling/stages/stage_evap_tower.js',
  'cooling/stages/stage_closed_tower.js',
  'cooling/stages/stage_adiabatic.js',
  'cooling/stages/stage_chiller.js',
  'cooling/stages/stage_district_chw.js',
  'cooling/stage_chain.js',
  'cooling/arch_helpers.js',
  'cooling/archs/liquid_dry_cooler_trim.js',
  'cooling/archs/liquid_dry_cooler_pure.js',
  'cooling/archs/liquid_adiabatic_tower.js',
  'cooling/archs/liquid_closed_tower.js',
  'cooling/archs/liquid_water_chiller.js',
  'cooling/archs/air_air_cooled_chiller.js',
  'cooling/archs/air_water_cooled_chiller.js',
  'cooling/archs/air_district_chw.js',
  'cooling/archs/air_rdhx.js',
  'sizing/sizing_engine.js',
  'simulation/annual_runner.js',
  'weather_builtin.js', 'weather_source.js', 'ashrae_design_conditions.js', 'epw_parser.js', 'components/equipment_designer.js',
  'device_catalog_builtin.js', 'catalog_manager.js', 'ui_kit.js', 'store.js', 'excel_export.js',
  'views/view_weather.js', 'views/view_hall_su.js', 'views/view_corepod.js',
  'views/schematics/schematic_common.js',
  'views/schematics/schematic_single_loop.js',
  'views/schematics/schematic_series_trim.js',
  'views/schematics/schematic_air_plant.js',
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

function buildWindow(options = {}) {
  const dom = new JSDOM(SKELETON_HTML, { url: 'http://localhost/', runScripts: 'dangerously', pretendToBeVisual: true });
  const win = dom.window;
  win.__nodeRequire = require;

  // Vendor 套件 stub — 只需要不 throw，不需要真的畫圖
  win.Chart = function (el, cfg) { this._el = el; this._cfg = cfg; this.destroy = () => {}; this.update = () => {}; };
  win.lucide = { createIcons() {} };
  win.alert = () => {};
  win.confirm = () => false;
  win.requestAnimationFrame = () => 0;
  win.cancelAnimationFrame = () => {};

  // jsdom 假 canvas 2D context
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

  const origAddEventListener = win.document.addEventListener.bind(win.document);
  win.document.addEventListener = (type, ...rest) => {
    if (type === 'DOMContentLoaded') return;
    return origAddEventListener(type, ...rest);
  };

  const files = options.appFiles || APP_FILES;
  for (const rel of files) {
    const fullPath = path.join(JS_DIR, rel);
    if (!fs.existsSync(fullPath)) continue;
    const code = fs.readFileSync(fullPath, 'utf8');
    const el = win.document.createElement('script');
    el.textContent = code;
    win.document.body.appendChild(el);
  }
  return win;
}

module.exports = {
  buildWindow,
  APP_FILES,
  SKELETON_HTML,
  JS_DIR
};
