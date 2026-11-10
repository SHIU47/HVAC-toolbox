#!/usr/bin/env node
// 專案檔檢核：載入一份專案 JSON，跑 8760h 計算，印出分項耗電與一致性檢核。
// 用法：
//   node project_check.js <project.json>                    印出摘要
//   node project_check.js <project.json> --save out.json     存成基準
//   node project_check.js <project.json> --compare out.json  與基準比對（差異 > 0.1% 列出，有差異 exit 1）
'use strict';
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const projPath = args[0];
if (!projPath) { console.error('用法：node project_check.js <project.json> [--save|--compare file]'); process.exit(2); }

const ctx = require('./harness.js');
const S = ctx.AppStore;
S.deserializeProject(fs.readFileSync(projPath, 'utf8'));
const R = S.state.results;
const o = R.overall;
const b = o.breakdownKwh;
const MWh = v => Math.round((v || 0) / 1000);

const summary = {
  annualPue: o.annualPue,
  annualP_Pue: o.annualP_Pue,
  peakPue: o.peakPue,
  annualWue: o.annualWue,
  totalItKw: Math.round(o.totalItKw),
  lossPct: S.state.facilityElectricalLossPct,
  mwh: {
    it: MWh(b.it), cduPump: MWh(b.cduPump), cduUnit: MWh(b.cduUnitKwh), cduPrimaryPump: MWh(b.cduPrimaryPumpKwh),
    crahFan: MWh(b.crahFan), heatRejection: MWh(b.heatRejection), chiller: MWh(b.chiller), loss: MWh(b.loss),
    total: Math.round(o.annualTotalMwh)
  },
  fc: {
    overallFcHours: o.fcHours,
    cdu: R.cduFcStats || null,
    fw: R.fwFcStats || null,
    combined: R.combinedFcStats || null
  },
  checks: {
    capacityDeficitHours: o.capacityDeficitHours,
    maxCapacityDeficitKw: Math.round(o.maxCapacityDeficitKw || 0),
    thermalBalanced: o.thermalLedger?.is_balanced,
    thermalImbalanceMwh: MWh(o.thermalLedger?.imbalance_kwh),
    energyBalanced: o.energyLedger?.is_balanced,
    plantAllocBalanced: o.energyLedger?.plant_allocations_balanced ?? null
  },
  plants: (S.state.coolingPlants || []).map(p => ({
    name: p.name, loop: p.loop, members: (p.memberIds || []).length,
    modeHours: p._sim?.modeHours, mwh: p._sim ? {
      chiller: MWh(p._sim.annualKwh.chiller), heatRej: MWh(p._sim.annualKwh.heatRej), pump: MWh(p._sim.annualKwh.pump)
    } : null,
    sizing: (p.system?.sizing || []).map(s => `${s.key}: ${s.selectedModel} ×${s.selectedQty} (cap ${s.unitCapKw}, req ${Math.round(s.requiredKw)}, ${s.passed ? 'OK' : 'NG'})`)
  })),
  units: [...(R.byDu || []), ...(R.byCorePod || [])].map(u => ({
    name: u.duName || u.podName, fcHours: u.fcHours, deficitHours: u.deficitHours, maxDeficitKw: Math.round(u.maxDeficitKw || 0)
  }))
};

const modeIdx = args.indexOf('--save') >= 0 ? 'save' : (args.indexOf('--compare') >= 0 ? 'compare' : null);
if (modeIdx === 'save') {
  const out = args[args.indexOf('--save') + 1];
  fs.writeFileSync(out, JSON.stringify(summary, null, 2));
  console.log('已存：' + out);
} else if (modeIdx === 'compare') {
  const ref = JSON.parse(fs.readFileSync(args[args.indexOf('--compare') + 1], 'utf8'));
  const diffs = [];
  const walk = (a, c, p) => {
    if (typeof a === 'number' && typeof c === 'number') {
      const d = Math.abs(a - c), base = Math.max(Math.abs(c), 1e-9);
      if (d / base > 0.001 && d > 1e-6) diffs.push(`${p}: ${c} → ${a}`);
    } else if (a && c && typeof a === 'object') {
      new Set([...Object.keys(a), ...Object.keys(c)]).forEach(k => walk(a[k], c[k], p ? `${p}.${k}` : k));
    } else if (a !== c) diffs.push(`${p}: ${JSON.stringify(c)} → ${JSON.stringify(a)}`);
  };
  walk(summary, ref, '');
  if (diffs.length) { console.log(diffs.join('\n')); process.exit(1); }
  console.log('與基準一致。');
} else {
  console.log(JSON.stringify(summary, null, 2));
}
