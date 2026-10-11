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
        S.state.site.designConditions = weather.designConditions || null;
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
        const dCond = S.designConditions();
        const key = `${city} | cdu=${cduArch} | fw=${fwArch}`;
        const sizingSnapshot = [];
        const sizingRequiredKw = [];
        const collectSizing = (obj, label) => {
          (obj.plantDesign.cduSystem.sizing || []).forEach(s => {
            sizingSnapshot.push(`${label}.cdu.${s.key}=${s.passed}`);
            sizingRequiredKw.push(`${label}.cdu.${s.key}=${Math.round(s.requiredKw || 0)}`);
          });
          (obj.plantDesign.fanwallSystem.sizing || []).forEach(s => {
            sizingSnapshot.push(`${label}.fw.${s.key}=${s.passed}`);
            sizingRequiredKw.push(`${label}.fw.${s.key}=${Math.round(s.requiredKw || 0)}`);
          });
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
          designDb: dCond.designDb,
          designWb: dCond.designWb,
          peakDb: dCond.peakDb?.value ?? null,
          sizing: sizingSnapshot,
          sizingRequiredKw
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
    if (b.designDb !== undefined && diffNum(b.designDb, c.designDb, 0.05)) fields.push(`designDb ${b.designDb}→${c.designDb}`);
    if (b.designWb !== undefined && diffNum(b.designWb, c.designWb, 0.05)) fields.push(`designWb ${b.designWb}→${c.designWb}`);
    if (b.peakDb !== undefined && diffNum(b.peakDb, c.peakDb, 0.05)) fields.push(`peakDb ${b.peakDb}→${c.peakDb}`);
    if (JSON.stringify(b.sizing) !== JSON.stringify(c.sizing)) {
      const bs = new Set(b.sizing), cs = new Set(c.sizing);
      const changed = [...bs, ...cs].filter(x => !(bs.has(x) && cs.has(x)));
      if (changed.length) fields.push(`sizing changed: ${[...new Set(changed)].join(', ')}`);
    }
    if (b.sizingRequiredKw && JSON.stringify(b.sizingRequiredKw) !== JSON.stringify(c.sizingRequiredKw)) {
      const bs = new Set(b.sizingRequiredKw), cs = new Set(c.sizingRequiredKw);
      const changed = [...bs, ...cs].filter(x => !(bs.has(x) && cs.has(x)));
      if (changed.length) fields.push(`sizingRequiredKw changed: ${[...new Set(changed)].join(', ')}`);
    }
    if (b.thermalIsBalanced !== c.thermalIsBalanced) fields.push(`thermalBalanced ${b.thermalIsBalanced}→${c.thermalIsBalanced}`);
    if (fields.length) diffs.push({ key, fields });
  }
  return diffs;
}

async function runCatalogScan(csvPath) {
  const ctx = freshCtx();
  const { AppStore: S, WeatherSource } = ctx;
  const stations = await WeatherSource.listStations();
  console.log(`Starting catalog scan for ${stations.length} stations...`);

  const initialStateJson = JSON.stringify(S.state);
  const rows = [];
  const qualityWarnings = [];
  let minPue = 999, maxPue = -999;
  let hasNaN = false;

  for (let i = 0; i < stations.length; i++) {
    const station = stations[i];
    const stationData = await WeatherSource.loadStation(station.id);

    S.state = JSON.parse(initialStateJson);
    S.state.site.selectedCity = station.cityZh || station.city;
    S.state.site.stationId = station.id;
    S.state.site.stationSource = station.source || 'catalog';
    S.state.site.hourly = stationData.hourlyData;
    S.state.site.designConditions = stationData.designConditions || null;
    S.state.site.monthlyStats = stationData.monthlyStats || [];
    S.state.site.stats = stationData.stats;
    S.state.site.isRealEpw = true;
    S.state.site.stationName = stationData.stationInfo?.location || station.city;
    S.state.site.country = stationData.stationInfo?.country || station.country;
    S.state.site.lat = stationData.stationInfo?.lat ?? station.lat;
    S.state.site.lon = stationData.stationInfo?.lon ?? station.lng;
    S.state.site.elev = stationData.stationInfo?.elev ?? station.elev;
    S.state.site.design = null;

    const applyArch = (obj) => {
      obj.plantDesign.cduSystem.architecture = 'dry_cooler_trim';
      obj.plantDesign.cduSystem.sizing = [];
      obj.plantDesign.fanwallSystem.architecture = 'air_cooled_chiller';
      obj.plantDesign.fanwallSystem.sizing = [];
    };
    S.state.halls.forEach(h => h.dus.forEach(applyArch));
    S.state.corePods.forEach(applyArch);

    S.calculate();

    const o = S.state.results.overall;
    const dCond = S.designConditions();
    const cduFcHours = S.state.results.cduFcStats?.freeHours ?? 0;
    const fwFcHours = S.state.results.fwFcStats?.freeHours ?? 0;

    let trimRequiredKw = 0;
    for (const h of S.state.halls) {
      for (const du of h.dus) {
        const ts = du.plantDesign.cduSystem.sizing?.find(s => s.key === 'trim_chiller');
        if (ts && ts.requiredKw) trimRequiredKw += ts.requiredKw;
      }
    }
    trimRequiredKw = Math.round(trimRequiredKw);

    const isWarn = !!dCond.dataQualityWarning;
    if (isWarn) {
      qualityWarnings.push({
        id: station.id,
        cityZh: station.cityZh || station.city,
        countryZh: station.countryZh || station.country,
        maxDB: dCond.maxDb,
        peakDB: dCond.peakDb?.value,
        warning: dCond.dataQualityWarning
      });
    }

    if (isNaN(o.annualPue) || isNaN(o.annualWue)) {
      hasNaN = true;
      console.error(`NaN detected in station ${station.id}`);
    }
    if (o.annualPue < minPue) minPue = o.annualPue;
    if (o.annualPue > maxPue) maxPue = o.annualPue;

    rows.push({
      id: station.id,
      city: station.city,
      cityZh: station.cityZh || station.city,
      countryZh: station.countryZh || station.country,
      pue: o.annualPue,
      wue: o.annualWue,
      fcHoursPct: o.fcHoursPct,
      cduFcHours,
      fwFcHours,
      trimRequiredKw,
      peakDb: dCond.peakDb?.value ?? null,
      designDb: dCond.designDb ?? null,
      dataQualityWarning: isWarn ? 'YES' : 'NO'
    });
  }

  // Write CSV
  const headers = ['id', 'city', 'cityZh', 'countryZh', 'pue', 'wue', 'fcHoursPct', 'cduFcHours', 'fwFcHours', 'trimRequiredKw', 'peakDb', 'designDb', 'dataQualityWarning'];
  const csvLines = [headers.join(',')];
  for (const r of rows) {
    csvLines.push(headers.map(h => {
      const v = r[h];
      if (typeof v === 'string' && (v.includes(',') || v.includes('"'))) {
        return `"${v.replace(/"/g, '""')}"`;
      }
      return v;
    }).join(','));
  }
  const outPath = csvPath || path.join(__dirname, 'catalog_scan.csv');
  fs.writeFileSync(outPath, csvLines.join('\n'), 'utf8');
  console.log(`\nCatalog scan complete: ${rows.length} stations scanned.`);
  console.log(`Saved results to ${outPath}`);
  console.log(`PUE Range: [${minPue.toFixed(3)}, ${maxPue.toFixed(3)}]`);
  console.log(`Data Quality Warnings: ${qualityWarnings.length} stations triggered gap > 5°C`);
  console.log(`NaN Detected: ${hasNaN ? 'YES (FAIL)' : 'NO (PASS)'}`);

  if (qualityWarnings.length > 0) {
    console.log('\nStations with Data Quality Warnings:');
    qualityWarnings.forEach(w => {
      console.log(` - [${w.id}] ${w.cityZh} (${w.countryZh}): peakDB=${w.peakDB}°C, TMY maxDB=${w.maxDB}°C`);
    });
  }

  if (hasNaN) {
    process.exit(1);
  }
  if (minPue < 1.02 || maxPue > 1.60) {
    console.error(`PUE out of expected [1.02, 1.60] range!`);
    process.exit(1);
  }
  return { rows, qualityWarnings, minPue, maxPue };
}

async function main() {
  const args = process.argv.slice(2);
  const mode = args[0];
  const file = args[1] || (mode === '--catalog' ? path.join(__dirname, 'catalog_scan.csv') : path.join(__dirname, 'baseline.json'));

  if (mode === '--catalog') {
    await runCatalogScan(file);
    return;
  }

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
  console.log('Usage: node run.js --save <file> | --compare <file> | --catalog [catalog_scan.csv]');
  const sample = Object.entries(current).filter(([k]) => k.includes('cdu=dry_cooler_trim') && k.includes('fw=air_cooled_chiller'));
  console.table(Object.fromEntries(sample.map(([k, v]) => [k.split(' | ')[0], { pue: v.annualPue, pPue: v.annualP_Pue, wue: v.annualWue, fc: v.fcHoursPct, defH: v.capacityDeficitHours }])));
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
