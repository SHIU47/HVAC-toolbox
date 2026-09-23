#!/usr/bin/env node
// 回歸測試：7 個內建城市 × CDU 5 種架構 × Fanwall 4 種架構 = 140 組
// 用法：
//   node run.js --save baseline.json         存基準
//   node run.js --compare baseline.json      跟基準比對，印出差異，有差異則 exit code 1
'use strict';
const fs = require('fs');
const path = require('path');

const CDU_ARCHS = ['dry_cooler_trim', 'dry_cooler_pure', 'adiabatic_tower', 'cooling_tower_hx', 'water_chiller'];
const FW_ARCHS = ['air_cooled_chiller', 'water_cooled_chiller', 'chilled_water_plant', 'rdhx'];

function freshCtx() {
  // 每次都重新載入一份乾淨的模組環境，避免不同組合之間互相污染 module-level 狀態
  delete require.cache[require.resolve('./harness.js')];
  return require('./harness.js');
}

function runAll() {
  const ctx = freshCtx();
  const { AppStore: S } = ctx;
  const cities = Object.keys(ctx.BUILTIN_WEATHER_DATA);
  // 深拷貝一份初始 state（含預設 1 Hall/1 DU + 1 CorePOD）供每組重置使用
  const initialStateJson = JSON.stringify(S.state);

  const results = {};
  for (const city of cities) {
    const weather = ctx.BUILTIN_WEATHER_DATA[city];
    for (const cduArch of CDU_ARCHS) {
      for (const fwArch of FW_ARCHS) {
        S.state = JSON.parse(initialStateJson);
        S.state.site.hourly = weather.hourlyData;
        S.state.site.monthlyStats = [];
        S.state.site.isRealEpw = true;
        S.state.site.stationName = weather.stationInfo?.location;
        S.state.site.country = weather.stationInfo?.country;
        S.state.site.lat = weather.stationInfo?.lat;
        S.state.site.lon = weather.stationInfo?.lon;
        S.state.site.elev = weather.stationInfo?.elev;

        const applyArch = (obj) => {
          obj.plantDesign.cduSystem.architecture = cduArch;
          obj.plantDesign.cduSystem.sizing = [];
          obj.plantDesign.fanwallSystem.architecture = fwArch;
          obj.plantDesign.fanwallSystem.sizing = [];
        };
        S.state.halls.forEach(h => h.dus.forEach(applyArch));
        S.state.corePods.forEach(applyArch);

        S.calculate();

        const o = S.state.results.overall;
        const key = `${city} | cdu=${cduArch} | fw=${fwArch}`;
        const sizingSnapshot = [];
        const collectSizing = (obj, label) => {
          (obj.plantDesign.cduSystem.sizing || []).forEach(s => sizingSnapshot.push(`${label}.cdu.${s.key}=${s.passed}`));
          (obj.plantDesign.fanwallSystem.sizing || []).forEach(s => sizingSnapshot.push(`${label}.fw.${s.key}=${s.passed}`));
        };
        S.state.halls.forEach(h => h.dus.forEach(d => collectSizing(d, d.id)));
        S.state.corePods.forEach(p => collectSizing(p, p.id));

        results[key] = {
          annualPue: o.annualPue,
          annualP_Pue: o.annualP_Pue,
          annualWue: o.annualWue,
          annualWaterM3: o.annualWaterM3,
          fcHoursPct: o.fcHoursPct,
          peakPue: o.peakPue,
          capacityDeficitHours: o.capacityDeficitHours,
          maxCapacityDeficitKw: o.maxCapacityDeficitKw,
          breakdownKwh: o.breakdownKwh,
          fwFcStats_freeHours: S.state.results.fwFcStats.freeHours,
          cduFcStats_freeHours: S.state.results.cduFcStats.freeHours,
          thermalIsBalanced: o.thermalLedger.is_balanced,
          sizing: sizingSnapshot
        };
      }
    }
  }
  return results;
}

function diffNum(a, b, tol) {
  if (a === undefined || b === undefined) return true;
  return Math.abs(a - b) > tol;
}

function compare(baseline, current) {
  const diffs = [];
  const keys = new Set([...Object.keys(baseline), ...Object.keys(current)]);
  for (const key of keys) {
    const b = baseline[key], c = current[key];
    if (!b || !c) { diffs.push({ key, reason: 'missing in ' + (!b ? 'baseline' : 'current') }); continue; }
    const fields = [];
    if (diffNum(b.annualPue, c.annualPue, 0.0005)) fields.push(`PUE ${b.annualPue}→${c.annualPue}`);
    if (diffNum(b.annualP_Pue, c.annualP_Pue, 0.0005)) fields.push(`pPUE ${b.annualP_Pue}→${c.annualP_Pue}`);
    if (diffNum(b.annualWue, c.annualWue, 0.0005)) fields.push(`WUE ${b.annualWue}→${c.annualWue}`);
    if (diffNum(b.capacityDeficitHours, c.capacityDeficitHours, 0)) fields.push(`deficitH ${b.capacityDeficitHours}→${c.capacityDeficitHours}`);
    if (JSON.stringify(b.sizing) !== JSON.stringify(c.sizing)) {
      const bs = new Set(b.sizing), cs = new Set(c.sizing);
      const changed = [...bs, ...cs].filter(x => !(bs.has(x) && cs.has(x)));
      if (changed.length) fields.push(`sizing changed: ${[...new Set(changed)].join(', ')}`);
    }
    if (b.thermalIsBalanced !== c.thermalIsBalanced) fields.push(`thermalBalanced ${b.thermalIsBalanced}→${c.thermalIsBalanced}`);
    if (fields.length) diffs.push({ key, fields });
  }
  return diffs;
}

function main() {
  const args = process.argv.slice(2);
  const mode = args[0];
  const file = args[1] || path.join(__dirname, 'baseline.json');

  const current = runAll();

  if (mode === '--save') {
    fs.writeFileSync(file, JSON.stringify(current, null, 2));
    console.log(`Saved ${Object.keys(current).length} combos to ${file}`);
    return;
  }

  if (mode === '--compare') {
    const baseline = JSON.parse(fs.readFileSync(file, 'utf8'));
    const diffs = compare(baseline, current);
    if (!diffs.length) {
      console.log(`No differences across ${Object.keys(current).length} combos.`);
      process.exit(0);
    }
    console.log(`${diffs.length} combos differ:`);
    for (const d of diffs) {
      if (d.reason) { console.log(' -', d.key, ':', d.reason); continue; }
      console.log(' -', d.key);
      d.fields.forEach(f => console.log('     ', f));
    }
    process.exit(1);
  }

  // 無參數：印出預設組合（dry_cooler_trim / air_cooled_chiller）摘要，方便肉眼檢查
  console.log('Usage: node run.js --save <file> | --compare <file>');
  const sample = Object.entries(current).filter(([k]) => k.includes('cdu=dry_cooler_trim') && k.includes('fw=air_cooled_chiller'));
  console.table(Object.fromEntries(sample.map(([k, v]) => [k.split(' | ')[0], { pue: v.annualPue, pPue: v.annualP_Pue, wue: v.annualWue, fc: v.fcHoursPct, defH: v.capacityDeficitHours }])));
}

main();
