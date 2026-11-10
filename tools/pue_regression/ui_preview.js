#!/usr/bin/env node
// 產生 UI 預覽頁並用 Edge headless 截圖（使用暫存設定檔，不影響使用者的瀏覽器）
// 用法：node ui_preview.js <project.json> <step> <out.png> [--js "<App.init 完成後要執行的 JS>"] [--h 3000]
// 注意：不要加 --virtual-time-budget（本機 Edge 會卡住並殘留程序）。
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
const { spawn } = require('child_process');

const [projPath, step, outPng] = process.argv.slice(2);
const argVal = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
const extraJs = argVal('--js') || '';
const height = Number(argVal('--h') || 3000);
if (!projPath || !step || !outPng) { console.error('用法：node ui_preview.js <project.json> <step> <out.png>'); process.exit(2); }

const APP = path.resolve(__dirname, '../../public/Data center Cal');
const html0 = fs.readFileSync(path.join(APP, 'index.html'), 'utf8');
const proj = fs.readFileSync(projPath, 'utf8');
// 1) <head> 停用 alert/confirm（headless 會卡住）
const headInject = `<script>window.alert = function (m) { console.log("[alert]", m); }; window.confirm = function () { return true; }; </script>`;
// 2) 包住 App.init：還原完成後切到指定步驟、展開所有 <details>
const bodyInject = `<script>
(function () {
  var orig = window.App.init.bind(window.App);
  window.App.init = function () {
    return orig().then(function () {
      try {
        window.AppStore.deserializeProject(${JSON.stringify(proj)});
        window.AppStore.calculate();
        ${extraJs}
        window.App.goToStep(${Number(step)});
        document.querySelectorAll('details').forEach(function (d) { d.open = true; });
      } catch (e) { document.body.insertAdjacentHTML('afterbegin', '<pre style="color:red">' + e.stack + '</pre>'); }
    });
  };
})();
</script>`;
const previewPath = path.join(APP, '_ui_preview.html');
const html = html0;
fs.writeFileSync(previewPath, html.replace('<head>', '<head>' + headInject).replace('</body>', bodyInject + '</body>'));
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'edge-preview-'));
const out = path.resolve(outPng);
if (fs.existsSync(out)) fs.unlinkSync(out);
const edge = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
spawn(edge, ['--headless=new', '--disable-gpu', `--user-data-dir=${profile}`, '--hide-scrollbars',
  `--window-size=1400,${height}`, `--screenshot=${out}`, previewPath], { stdio: 'ignore', detached: true }).unref();
// Edge 啟動程式會先結束，截圖檔稍後才寫出：輪詢等待
const t0 = Date.now();
const timer = setInterval(() => {
  if (fs.existsSync(out) || Date.now() - t0 > 90000) {
    clearInterval(timer);
    if (!process.env.KEEP_PREVIEW) { try { fs.unlinkSync(previewPath); } catch (_) {} }
    console.log(fs.existsSync(out) ? '截圖：' + out : '截圖失敗（逾時）');
  }
}, 1000);
