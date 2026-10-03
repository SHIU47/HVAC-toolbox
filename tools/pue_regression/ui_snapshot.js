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
const { buildWindow, APP_FILES, SKELETON_HTML, JS_DIR } = require('./dom_harness.js');

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
