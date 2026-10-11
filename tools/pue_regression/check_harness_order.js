'use strict';
/**
 * check_harness_order.js - Verifies script loading order consistency between index.html and harness.js.
 * Enforces that all non-vendor, non-view calculation modules in index.html are loaded
 * into harness.js in identical sequence.
 */
const fs = require('fs');
const path = require('path');

function checkHarnessOrder() {
  const htmlPath = path.resolve(__dirname, '../../public/Data center Cal/index.html');
  const harnessPath = path.resolve(__dirname, 'harness.js');

  const html = fs.readFileSync(htmlPath, 'utf8');
  const htmlScripts = [...html.matchAll(/<script\s+src=["']js\/([^"']+)["']/g)]
    .map(m => m[1])
    .filter(f => !f.startsWith('vendor/') && !f.startsWith('views/') && !f.startsWith('components/') && f !== 'ui_kit.js' && f !== 'excel_export.js' && f !== 'app.js');

  const harnessSrc = fs.readFileSync(harnessPath, 'utf8');
  const match = harnessSrc.match(/const FILES = \[([\s\S]*?)\];/);
  if (!match) {
    console.error('FAIL check_harness_order: Could not find FILES in harness.js');
    process.exit(1);
  }
  const harnessFiles = eval('[' + match[1] + ']');

  if (htmlScripts.length !== harnessFiles.length) {
    console.error(`FAIL check_harness_order: File count mismatch. index.html has ${htmlScripts.length}, harness.js has ${harnessFiles.length}`);
    console.error('index.html non-view/vendor:', htmlScripts);
    console.error('harness.js FILES:', harnessFiles);
    process.exit(1);
  }

  for (let i = 0; i < htmlScripts.length; i++) {
    if (htmlScripts[i] !== harnessFiles[i]) {
      console.error(`FAIL check_harness_order: Order mismatch at index ${i}: index.html has "${htmlScripts[i]}" but harness.js has "${harnessFiles[i]}"`);
      process.exit(1);
    }
  }

  console.log(`PASS check_harness_order: harness.js script loading order matches index.html (${harnessFiles.length} files)`);
  return true;
}

if (require.main === module) {
  checkHarnessOrder();
}

module.exports = { checkHarnessOrder };
