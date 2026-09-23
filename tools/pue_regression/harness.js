// 把瀏覽器端 script 載入同一個 vm context，模擬 window 全域
// 用法： const ctx = require('./harness.js');  → ctx.AppStore / ctx.ChillerEngine / ...
const fs = require('fs'), vm = require('vm'), path = require('path');
const JS = path.resolve(__dirname, '../../public/Data center Cal/js');
const ctx = { console, Math, JSON, Date, setTimeout, clearTimeout, parseFloat, parseInt, Number, String, Array, Object, isFinite, isNaN, Promise };
ctx.window = ctx; ctx.global = ctx; ctx.globalThis = ctx;
vm.createContext(ctx);
// ⚠ 順序需與 index.html 一致；Phase C 新增檔案時同步更新此清單
const FILES = ['assumptions.js','engines_core.js','engines_cdu.js','engines_crah.js','engines_chiller.js',
  'engines_cooling_tower.js','engines_free_cooling.js','engines_hx.js','engines_pump.js','weather_builtin.js',
  'device_catalog_builtin.js','catalog_manager.js','store.js'];
for (const f of FILES) vm.runInContext(fs.readFileSync(path.join(JS, f), 'utf8'), ctx, { filename: f });
module.exports = ctx;
