#!/usr/bin/env node
// 單元驗收測試 — 對應計畫書 §2/§3 各任務的「驗收」條目。
// 每個任務修完後跑一次；全部 assert 通過才能 commit 該任務。
// 尚未修正的項目用 skip() 標記，修正後把該行改回 test()。
'use strict';
const assert = require('assert');

let passCount = 0, failCount = 0, skipCount = 0;
function test(name, fn) {
  try {
    fn();
    console.log('  PASS  ' + name);
    passCount++;
  } catch (e) {
    console.log('  FAIL  ' + name);
    console.log('        ' + e.message);
    failCount++;
  }
}
function skip(name, reason) {
  console.log('  SKIP  ' + name + '  (' + reason + ')');
  skipCount++;
}

function freshCtx() {
  delete require.cache[require.resolve('./harness.js')];
  return require('./harness.js');
}

// ── P0-3: AHRI 曲線在額定點必須正規化為 1.000 ──────────────────────────
(function () {
  const ctx = freshCtx();
  const { AHRI_PRESETS, biQuad } = ctx;
  for (const [k, p] of Object.entries(AHRI_PRESETS)) {
    const C = k.startsWith('air_') ? 35 : 30;
    test('P0-3 ' + k + ' CapFT(7,' + C + ')=1.000', () => {
      assert(Math.abs(biQuad(p.CapFT, 7, C) - 1) < 1e-9, 'got ' + biQuad(p.CapFT, 7, C));
    });
    test('P0-3 ' + k + ' EIR_FT(7,' + C + ')=1.000', () => {
      assert(Math.abs(biQuad(p.EIR_FT, 7, C) - 1) < 1e-9, 'got ' + biQuad(p.EIR_FT, 7, C));
    });
  }
})();

// ── P0-4: fixed 曲線在額定點 COP 必須等於 cop_design；揚程越大 COP 越低 ──
(function () {
  const ctx = freshCtx();
  const { ChillerEngine } = ctx;
  test('P0-4 water fixed @7/30 COP == cop_design', () => {
    const chillers = [{ cooling_capacity_kw: 500, cop_design: 6.0, cop_curve: { type: 'fixed' }, t_chws_design: 7.0, qty_running: 1, qty_total: 2, chiller_type: 'water_cooled' }];
    const r = ChillerEngine.calcPower(400, chillers, 7.0, 30.0, 30.0);
    assert(Math.abs(r.cop_actual - 6.0) < 0.05, 'got ' + r.cop_actual);
  });
  test('P0-4 air fixed @7/35 COP == cop_design', () => {
    const chillers = [{ cooling_capacity_kw: 500, cop_design: 3.6, cop_curve: { type: 'fixed' }, t_chws_design: 7.0, qty_running: 1, qty_total: 2, chiller_type: 'air_cooled' }];
    const r = ChillerEngine.calcPower(400, chillers, 7.0, undefined, 35.0);
    assert(Math.abs(r.cop_actual - 3.6) < 0.05, 'got ' + r.cop_actual);
  });
  test('P0-4 water CHWS30/CEWT45 COP < CHWS30/CEWT35 COP (higher lift -> lower COP)', () => {
    const chillers = [{ cooling_capacity_kw: 500, cop_design: 6.0, cop_curve: { type: 'fixed' }, t_chws_design: 7.0, qty_running: 1, qty_total: 2, chiller_type: 'water_cooled' }];
    const rLow = ChillerEngine.calcPower(400, chillers, 30.0, 35.0, 30.0);
    const rHigh = ChillerEngine.calcPower(400, chillers, 30.0, 45.0, 30.0);
    assert(rHigh.cop_actual < rLow.cop_actual, `high-lift COP ${rHigh.cop_actual} should be < low-lift COP ${rLow.cop_actual}`);
  });
  test('P0-4 water CHWS40/CEWT32 COP <= 2x cop_design (no more COP 14.6 blowup)', () => {
    const chillers = [{ cooling_capacity_kw: 500, cop_design: 5.8, cop_curve: { type: 'fixed' }, t_chws_design: 7.0, qty_running: 1, qty_total: 2, chiller_type: 'water_cooled' }];
    const r = ChillerEngine.calcPower(400, chillers, 40.0, 32.0, 30.0);
    assert(r.cop_actual <= 5.8 * 2.0 + 1e-6, 'got ' + r.cop_actual);
  });
})();

// ── P0-1: 新增的 CorePOD 要進計算 ──────────────────────────────────────
(function () {
  const ctx = freshCtx();
  const S = ctx.AppStore;
  S.state.site.hourly = ctx.BUILTIN_WEATHER_DATA['桃園 (Taoyuan Pilot)'].hourlyData;
  S.calculate();
  const before = S.state.results.byCorePod.length;
  const beforeIt = S.state.results.overall.totalItKw;
  S.addCorePod();
  test('P0-1 addCorePod() appears in results.byCorePod', () => {
    assert.strictEqual(S.state.results.byCorePod.length, before + 1, 'byCorePod length did not increase');
  });
  test('P0-1 addCorePod() adds its IT load to overall.totalItKw', () => {
    assert(S.state.results.overall.totalItKw > beforeIt, `totalItKw ${S.state.results.overall.totalItKw} should be > ${beforeIt}`);
  });
  test('P0-1 deserializeProject preserves/defaults missing enabled to true', () => {
    const rawState = JSON.parse(JSON.stringify(S.state));
    delete rawState.corePods[0].enabled;
    S.deserializeProject(JSON.stringify({ state: rawState }));
    assert.strictEqual(S.state.corePods[0].enabled, true, 'missing enabled should default to true');
  });
})();

// ── P0-2: water_chiller 架構要抓到 Step4 選型的冰機（改選高 COP 型號一定要影響結果）──
(function () {
  const ctx = freshCtx();
  const S = ctx.AppStore;
  S.state.site.hourly = ctx.BUILTIN_WEATHER_DATA['高雄 (Kaohsiung)'].hourlyData;
  const du = S.state.halls[0].dus[0];
  du.plantDesign.cduSystem.architecture = 'water_chiller';
  du.plantDesign.cduSystem.sizing = [];
  S.calculate();
  const item = du.plantDesign.cduSystem.sizing.find(s => s.key === 'water_cooled_chiller');
  const lowCopModel = item.catalog.find(c => c.cop && c.cop < 6.5) || item.catalog[0];
  const highCopModel = [...item.catalog].sort((a, b) => (b.cop || 0) - (a.cop || 0))[0];

  item.selectedModel = lowCopModel.model;
  du.plantDesign.cduSystem.sizing = du.plantDesign.cduSystem.sizing; // keep array ref
  S.calculate();
  const chillerMwhLow = S.state.results.overall.breakdownKwh.chiller;

  du.plantDesign.cduSystem.sizing.find(s => s.key === 'water_cooled_chiller').selectedModel = highCopModel.model;
  S.calculate();
  const chillerMwhHigh = S.state.results.overall.breakdownKwh.chiller;

  test('P0-2 switching to a higher-COP selected chiller model actually lowers chiller kWh', () => {
    assert(lowCopModel.cop !== highCopModel.cop, 'test catalog has no COP spread to distinguish');
    assert(chillerMwhHigh < chillerMwhLow, `high-COP model (${highCopModel.cop}) kWh=${chillerMwhHigh} should be < low-COP model (${lowCopModel.cop}) kWh=${chillerMwhLow} — selection is being ignored (still using fallback /5.5)`);
  });
})();

// ── P0-5: 串聯經濟器公式（分母應為迴路溫差，不是固定 3°C）────────────
(function () {
  const ctx = freshCtx();
  const { FreeCoolingEngine } = ctx;
  if (typeof FreeCoolingEngine.calcSeriesEconomizer !== 'function') {
    skip('P0-5 calcSeriesEconomizer', 'not implemented yet');
  } else {
    test('P0-5 calcSeriesEconomizer denominator uses loop dT, not fixed 3K', () => {
      // FWS 40/55 (15K loop), T_available = 43 -> f_mech = (43-40)/15 = 0.2, not (43-40)/3=1.0
      const r = FreeCoolingEngine.calcSeriesEconomizer(43, 40, 55);
      assert(Math.abs(r.chiller_fraction - 0.2) < 1e-6, 'got chiller_fraction=' + r.chiller_fraction);
    });
  }
})();

// ── P0-7: Fanwall 氣冷系統自然冷卻門檻（外氣需低於供水溫減盤管 approach 才能全冷）────
(function () {
  const ctx = freshCtx();
  const S = ctx.AppStore;
  const plant = {
    cduSystem: { architecture: 'dry_cooler_pure', fwsSupplyC: 40, fwsReturnC: 55, dryCoolerApproachC: 5, pheApproachC: 2 },
    fanwallSystem: { architecture: 'air_cooled_chiller', chwSupplyC: 12.0, chwReturnC: 18.0 }
  };
  const summ = { totalItKw: 1000, liquidHeatKw: 0, airHeatKw: 100, lossKw: 0 };

  // Case 1: 外氣 DB 7°C，coil approach 4K -> T_avail = 11°C <= 12°C -> 100% full FC
  const r7 = S.calcHourlyEnergy(plant, summ, { db: 7.0, wb: 5.0 });
  test('P0-7 air_cooled_chiller DB=7C (T_avail 11 <= 12) is 100% free cooling', () => {
    assert.strictEqual(r7.fwMode, 'free');
    assert.strictEqual(r7.fwKwh.chiller, 0);
    assert(Math.abs(r7.heatRejKw - 100 * 0.05) < 1e-4, 'fan power should be 5% of air load');
  });

  // Case 2: 外氣 DB 12°C，coil approach 4K -> T_avail = 16°C (between 12 and 18) -> partial FC
  const r12 = S.calcHourlyEnergy(plant, summ, { db: 12.0, wb: 10.0 });
  test('P0-7 air_cooled_chiller DB=12C (T_avail 16 in 12-18) is partial cooling, not 100% free', () => {
    assert.strictEqual(r12.fwMode, 'partial');
    assert(r12.fwKwh.chiller > 0, 'chiller must run for 66.7% mechanical load');
  });

  // Case 3: 外氣 DB 16°C，coil approach 4K -> T_avail = 20°C >= 18°C -> 100% mechanical
  const r16 = S.calcHourlyEnergy(plant, summ, { db: 16.0, wb: 14.0 });
  test('P0-7 air_cooled_chiller DB=16C (T_avail 20 >= 18) is mechanical, not free under old <=18 threshold', () => {
    assert.strictEqual(r16.fwMode, 'mechanical');
    assert(r16.fwKwh.chiller > 0, 'chiller must handle 100% load');
  });
})();

// ── P1-5: CDU 與 CRAH 容量不足時回傳 plr_raw 與 deficit_kw ──────────────
(function () {
  const ctx = freshCtx();
  const { CDUEngine, CRAHEngine } = ctx;

  // CDU overload: 100 kW load > 80 kW capacity -> plr_raw = 1.25, deficit_kw = 20
  const cduList = [{ capacity_kw: 80, power_kw: 2.0, qty_running: 1 }];
  const rCdu = CDUEngine.calcPower(cduList, 100);
  test('P1-5 CDUEngine.calcPower returns plr_raw and deficit_kw when overloaded', () => {
    assert.strictEqual(rCdu.plr, 1.0);
    assert.strictEqual(rCdu.plr_raw, 1.25);
    assert.strictEqual(rCdu.deficit_kw, 20);
  });

  // CRAH overload: 150 kW load > 100 kW capacity -> plr_raw = 1.5, deficit_kw = 50
  const crahList = [{ cooling_capacity_kw: 100, power_kw: 5.0, qty_running: 1 }];
  const rCrah = CRAHEngine.calcPower(crahList, 150);
  test('P1-5 CRAHEngine.calcPower returns plr_raw and deficit_kw when overloaded', () => {
    assert.strictEqual(rCrah.plr, 1.0);
    assert.strictEqual(rCrah.plr_raw, 1.5);
    assert.strictEqual(rCrah.deficit_kw, 50);
  });
})();

// ── P1-1: 設計工況快取/失效 與 設備降額選型 ────────────────────────────
(function () {
  const ctx = freshCtx();
  const S = ctx.AppStore;
  S.calculate();

  // Test 1: 快取與 updateSite 失效
  const d1 = S.designConditions();
  test('P1-1 designConditions returns designDb/designWb/maxDb and caches in state.site.design', () => {
    assert(d1 && d1.designDb !== undefined && d1.designWb !== undefined && d1.maxDb !== undefined);
    assert.strictEqual(S.state.site.design, d1);
  });

  S.updateSite({ hourly: [], stats: { maxDB: 41.5 } });
  const d2 = S.designConditions();
  test('P1-1 updateSite invalidates state.site.design cache', () => {
    assert.notStrictEqual(d2, d1);
    assert.strictEqual(d2.maxDb, 41.5);
  });

  // Test 2: CDU 降額選型 (40°C FWS -> 0.80 derate)
  const ctx2 = freshCtx();
  const S2 = ctx2.AppStore;
  const du = S2.state.halls[0].dus[0];
  du.plantDesign.cduSystem.fwsSupplyC = 40.0;
  S2.calculate();
  const cduSizing = du.plantDesign.cduSystem.sizing.find(s => s.key === 'cdu_unit');

  test('P1-1 CDU sizing applies derateFactor at 40C FWS', () => {
    assert(cduSizing, 'cdu_unit sizing must exist');
    assert.strictEqual(cduSizing.derateFactor, 0.8);
    // 10 台選用，N+1 可用台數 9，標稱 100 kW -> 9 * 100 * 0.8 = 720 kW
    assert.strictEqual(cduSizing.effectiveCapKw, 720);
    assert.strictEqual(cduSizing.unitCapKw, 100);
    assert(cduSizing.requiredText.includes('（已依設計工況降額 ×0.80）'), 'requiredText should note derating');
  });

  const dcSizing = du.plantDesign.cduSystem.sizing.find(s => s.key === 'dry_cooler');
  test('P1-1 Dry cooler keeps derateFactor 1.0 without derate note', () => {
    assert(dcSizing, 'dry_cooler sizing must exist');
    assert.strictEqual(dcSizing.derateFactor, 1.0);
    assert(!dcSizing.requiredText.includes('已依設計工況降額'), 'should not have derate note for 1.0');
  });
})();

// ── P1-2: 損失熱計算與動態熱平衡帳本 ─────────────────────────────────────
(function () {
  const ctx = freshCtx();
  const S = ctx.AppStore;

  // Test 1: calcHourlyEnergy returns heatRemovedKw
  S.calculate();
  const du = S.state.halls[0].dus[0];
  const duSumm = S.calcDuSummary(du);
  const totalHeat = duSumm.liquidHeatKw + duSumm.airHeatKw + duSumm.lossKw;
  const hrNormal = S.calcHourlyEnergy(du.plantDesign, duSumm, { db: 25, wb: 20 });
  test('P1-2 calcHourlyEnergy returns heatRemovedKw equal to total heat when no deficit', () => {
    assert.strictEqual(hrNormal.capacityDeficitKw, 0);
    assert(Math.abs(hrNormal.heatRemovedKw - totalHeat) < 1e-4);
  });

  const hrDeficit = S.calcHourlyEnergy(du.plantDesign, duSumm, { db: 45, wb: 35 });
  test('P1-2 calcHourlyEnergy heatRemovedKw subtracts capacityDeficitKw', () => {
    assert(hrDeficit.capacityDeficitKw > 0, 'extreme weather should trigger capacity deficit');
    assert(Math.abs(hrDeficit.heatRemovedKw - (totalHeat - hrDeficit.capacityDeficitKw)) < 1e-4);
  });

  // Test 2: setFacilityElectricalLossPct propagates to byDu and thermalLedger
  S.setFacilityElectricalLossPct(5);
  const byDu = S.state.results.byDu[0];
  const ledger = S.state.results.overall.thermalLedger;

  test('P1-2 setFacilityElectricalLossPct sets lossKw and reflects in thermalLedger', () => {
    assert.strictEqual(byDu.lossKw, byDu.totalItKw * 0.05);
    assert(ledger.loss_heat_kwh > 0);
    assert(Math.abs(ledger.total_heat_generated_kwh - (ledger.it_heat_kwh + ledger.loss_heat_kwh)) < 1e-4);
  });
})();

// ── P1-3 & P1-4: 耗水計算標準化、保護與絕熱冷卻塔熱平衡 ───────────────────
(function () {
  const ctx = freshCtx();
  const S = ctx.AppStore;
  S.calculate();

  // Test 1: P1-3 cooling_tower_hx cyclesOfConcentration = 1 does not divide by 0
  const du = S.state.halls[0].dus[0];
  const pd1 = JSON.parse(JSON.stringify(du.plantDesign));
  pd1.cduSystem.architecture = 'cooling_tower_hx';
  pd1.cduSystem.cyclesOfConcentration = 1;
  const duSumm = S.calcDuSummary(du);
  const hrCt1 = S.calcHourlyEnergy(pd1, duSumm, { db: 25, wb: 20 });
  test('P1-3 cooling_tower_hx cycles=1 does not produce NaN/Infinity', () => {
    assert(Number.isFinite(hrCt1.waterM3) && hrCt1.waterM3 > 0);
  });

  // Test 2: P1-3 Fanwall water_cooled_chiller includes compressor power in water consumption
  const pd2 = JSON.parse(JSON.stringify(du.plantDesign));
  pd2.cduSystem.architecture = 'dry_cooler_trim';
  pd2.fanwallSystem.architecture = 'water_cooled_chiller';
  const hrWc = S.calcHourlyEnergy(pd2, duSumm, { db: 35, wb: 28 });
  test('P1-3 Fanwall water_cooled_chiller includes compressor power in evaporative water', () => {
    assert(hrWc.fwKwh.chiller > 0, 'mechanical chiller must run at WB 28');
    const airHeatTotal = duSumm.airHeatKw + duSumm.lossKw;
    const expectedWater = (airHeatTotal + hrWc.fwKwh.chiller) * 0.00124 * (1 + 1/4);
    assert(Math.abs(hrWc.waterM3 - expectedWater) < 1e-4);
  });

  // Test 3: P1-4 adiabatic_tower wet mode uses sensible air-side heat balance
  const pd3 = JSON.parse(JSON.stringify(du.plantDesign));
  pd3.cduSystem.architecture = 'adiabatic_tower';
  pd3.cduSystem.fwsSupplyC = 40;
  pd3.fanwallSystem.architecture = 'air_cooled_chiller';
  const db = 35, wb = 28, satEff = 0.85;
  const hrAt = S.calcHourlyEnergy(pd3, duSumm, { db, wb });
  test('P1-4 adiabatic_tower wet mode calculates water via sensible energy balance', () => {
    const T_eff = db - (db - wb) * satEff;
    const m_air = duSumm.liquidHeatKw / (1.006 * 10.0);
    const m_evap = m_air * 1.006 * (db - T_eff) / 2450.0;
    const expectedWater = (m_evap * 3.6) * (1 + 1/4);
    assert(Math.abs(hrAt.waterM3 - expectedWater) < 1e-4);
  });
})();

// ── P1-7: isFreeHour 統一定義 ──────────────────────────────────────────
(function () {
  const ctx = freshCtx();
  const S = ctx.AppStore;
  S.calculate();

  const du = S.state.halls[0].dus[0];
  const pd = JSON.parse(JSON.stringify(du.plantDesign));
  pd.cduSystem.architecture = 'dry_cooler_trim';
  pd.fanwallSystem.architecture = 'air_cooled_chiller';
  const duSumm = S.calcDuSummary(du);

  // Case 1: 冬季外氣低溫 (DB 5°C, WB 3°C) -> CDU free, FW free -> isFreeHour is true
  const hrWinter = S.calcHourlyEnergy(pd, duSumm, { db: 5, wb: 3 });
  test('P1-7 isFreeHour is true only when both CDU and Fanwall are in free mode', () => {
    assert.strictEqual(hrWinter.cduMode, 'free');
    assert.strictEqual(hrWinter.fwMode, 'free');
    assert.strictEqual(hrWinter.isFreeHour, true);
  });

  // Case 2: 過渡季 (DB 10°C, WB 8°C) -> CDU free, FW partial -> isFreeHour is false
  const hrMild = S.calcHourlyEnergy(pd, duSumm, { db: 10, wb: 8 });
  test('P1-7 isFreeHour is false when CDU is free but Fanwall is partial', () => {
    assert.strictEqual(hrMild.cduMode, 'free');
    assert.strictEqual(hrMild.fwMode, 'partial');
    assert.strictEqual(hrMild.isFreeHour, false);
  });

  // Case 3: 純氣冷負載 (liquidHeatKw = 0) -> 僅由 Fanwall 決定
  const airOnlySumm = { totalItKw: 100, liquidHeatKw: 0, airHeatKw: 100, lossKw: 0, dlcPct: 0 };
  const hrAirOnlyFree = S.calcHourlyEnergy(pd, airOnlySumm, { db: 5, wb: 3 });
  test('P1-7 isFreeHour ignores liquid loop when liquidHeatKw is 0', () => {
    assert.strictEqual(hrAirOnlyFree.isFreeHour, true);
  });
})();

// ── P1-8: Dashboard FLH 台帳真實資料與 cduUnitKwh 拆分 ─────────────────────────
(function () {
  const ctx = freshCtx();
  const S = ctx.AppStore;
  S.calculate();

  const du = S.state.halls[0].dus[0];
  const duSumm = S.calcDuSummary(du);
  const hr = S.calcHourlyEnergy(du.plantDesign, duSumm, { db: 35, wb: 28 });

  test('P1-8 calcHourlyEnergy returns split cduKwh.unit and cduKwh.pump and mechLoadKw', () => {
    assert(hr.cduKwh && typeof hr.cduKwh.unit === 'number' && typeof hr.cduKwh.pump === 'number');
    assert(typeof hr.mechLoadKw === 'number');
    assert(hr.cduKwh.unit > 0, 'CDU unit power must be positive');
  });

  const bk = S.state.results.overall.breakdownKwh;
  test('P1-8 overall.breakdownKwh and byDu contain cduUnitKwh', () => {
    assert(bk && typeof bk.cduUnitKwh === 'number' && bk.cduUnitKwh > 0);
    assert(typeof S.state.results.byDu[0].cduUnitKwh === 'number');
    assert(typeof S.state.results.byDu[0].cduUnitMwh === 'number');
    assert(bk.cduUnitKwh <= bk.cduPump, 'cduUnitKwh must not exceed total cduPump (unit + pumps)');
  });

  const hp = S.state.results.hourlyProfile || [];
  test('P1-8 hourlyProfile contains mechLoadKw and chillerKw', () => {
    assert(hp.length === 8760);
    const summerHour = hp[4718]; // 7/15 14:00
    assert(summerHour && summerHour.mechLoadKw !== undefined && summerHour.chillerKw !== undefined);
    assert(summerHour.chillerKw > 0, 'chiller must be running in summer peak');
    assert(summerHour.mechLoadKw > 0, 'mechanical load must be positive when chiller is running');
  });
})();

// ═══════════════════════════════════════════════════════════════
// P1-9 Catalog Async Gate & P1-10 Input Handling / CDU Defaults
// ═══════════════════════════════════════════════════════════════
(function () {
  const ctx = freshCtx();
  const { CatalogManager, AppStore: S } = ctx;

  test('P1-9 CatalogManager.ready is a Promise', () => {
    assert(CatalogManager && CatalogManager.ready && typeof CatalogManager.ready.then === 'function');
  });

  test('P1-10 defaultCduSystem returns consistent thermodynamic temperatures', () => {
    const cdu = S.defaultCduSystem('dry_cooler_hx');
    assert.strictEqual(cdu.secSupplyC, 45.0);
    assert.strictEqual(cdu.secReturnC, 57.0);
    assert.strictEqual(cdu.cduApproachC, 3.0);
    assert.strictEqual(cdu.fwsSupplyC, 42.0);
    assert.strictEqual(cdu.fwsReturnC, 54.0);
    assert.strictEqual(cdu.pheApproachC, 2.0);
    assert.strictEqual(cdu.dryCoolerApproachC, 5.0);
  });

  test('P1-10 addDU uses defaultCduSystem with FWS derived from sec and approach', () => {
    const hallId = S.state.halls[0].id;
    const du = S.addDU(hallId, 'Test-DU');
    assert(du && du.plantDesign && du.plantDesign.cduSystem);
    const cdu = du.plantDesign.cduSystem;
    assert.strictEqual(cdu.secSupplyC, 45.0);
    assert.strictEqual(cdu.cduApproachC, 3.0);
    assert.strictEqual(cdu.fwsSupplyC, 42.0);
    assert.strictEqual(cdu.fwsReturnC, 54.0);
  });

  test('P1-10 addCorePod uses defaultCduSystem with FWS derived from sec and approach', () => {
    const pod = S.addCorePod({ name: 'Test-CorePOD' });
    assert(pod && pod.plantDesign && pod.plantDesign.cduSystem);
    const cdu = pod.plantDesign.cduSystem;
    assert.strictEqual(cdu.secSupplyC, 45.0);
    assert.strictEqual(cdu.cduApproachC, 3.0);
    assert.strictEqual(cdu.fwsSupplyC, 42.0);
    assert.strictEqual(cdu.fwsReturnC, 54.0);
  });

  test('P1-10 deserializeProject backfills missing CDU parameters', () => {
    const dummyProject = {
      state: {
        halls: [
          {
            id: 'h1',
            dus: [
              {
                id: 'd1',
                sus: [],
                plantDesign: {
                  cduSystem: {
                    architecture: 'dry_cooler_hx'
                    // missing secSupplyC, secReturnC, cduApproachC, etc.
                  },
                  fanwallSystem: { architecture: 'air_cooled_chiller' }
                }
              }
            ]
          }
        ]
      }
    };
    S.deserializeProject(dummyProject);
    const cdu = S.state.halls[0].dus[0].plantDesign.cduSystem;
    assert.strictEqual(cdu.secSupplyC, 45.0);
    assert.strictEqual(cdu.secReturnC, 57.0);
    assert.strictEqual(cdu.cduApproachC, 3.0);
    assert.strictEqual(cdu.fwsSupplyC, 42.0);
    assert.strictEqual(cdu.fwsReturnC, 54.0);
  });

  test('P1-1 deserializeProject clears site.design cache', () => {
    const W = ctx.BUILTIN_WEATHER_DATA;
    S.updateSite({ selectedCity: '高雄 (Kaohsiung)', hourly: W['高雄 (Kaohsiung)'].hourlyData, isRealEpw: true });
    assert.strictEqual(S.designConditions().designDb, 34);
    const serializedTaichung = S.serializeProject();
    const parsed = JSON.parse(serializedTaichung);
    parsed.site.selectedCity = '台中 (Taichung)';
    S.deserializeProject(parsed);
    assert.strictEqual(S.designConditions().designDb, 33.8);
  });
})();

// ═══════════════════════════════════════════════════════════════
// C-1: Cooling Architecture & Stage Registry
// ═══════════════════════════════════════════════════════════════
(function () {
  const ctx = freshCtx();
  const { CoolingStages, CoolingArchRegistry } = ctx;

  test('C-1 CoolingStages registers all 6 built-in stages', () => {
    assert(CoolingStages.has('dry_cooler'), 'dry_cooler stage must exist');
    assert(CoolingStages.has('evap_tower'), 'evap_tower stage must exist');
    assert(CoolingStages.has('closed_tower'), 'closed_tower stage must exist');
    assert(CoolingStages.has('adiabatic'), 'adiabatic stage must exist');
    assert(CoolingStages.has('chiller'), 'chiller stage must exist');
    assert(CoolingStages.has('district_chw'), 'district_chw stage must exist');
    assert(CoolingStages.list().length >= 6);
  });

  test('C-1 CoolingArchRegistry register, get, resolveAlias, and list work', () => {
    CoolingArchRegistry.register({
      id: 'mock_test_arch',
      aliases: ['mock_alias_1', 'mock_alias_2'],
      loop: 'liquid'
    });
    assert(CoolingArchRegistry.has('mock_test_arch'));
    assert(CoolingArchRegistry.has('mock_alias_1'));
    assert.strictEqual(CoolingArchRegistry.resolveAlias('mock_alias_1'), 'mock_test_arch');
    assert.strictEqual(CoolingArchRegistry.get('mock_alias_2').id, 'mock_test_arch');
    const liquidArchs = CoolingArchRegistry.list('liquid');
    assert(liquidArchs.some(a => a.id === 'mock_test_arch'));
  });

  test('C-1 stage_dry_cooler simulate returns valid StageResult in pure mode', () => {
    const s = CoolingStages.get('dry_cooler');
    const res = s.simulate({
      Q_kw: 500,
      t_supply_c: 42.0,
      t_return_c: 54.0,
      approach_c: 5.0,
      hx_approach_c: 2.0,
      w: { db: 25, wb: 20 },
      isTrimMode: false
    });
    assert(res.Q_removed_kw === 500);
    assert(res.fanKw > 0);
    assert.strictEqual(res.mode, 'free');
    assert.strictEqual(res.waterM3, 0);
  });

  test('C-1 stage_adiabatic simulate handles dry vs wet mode', () => {
    const s = CoolingStages.get('adiabatic');
    const dryRes = s.simulate({
      Q_kw: 500,
      t_supply_c: 42.0,
      t_return_c: 54.0,
      w: { db: 20, wb: 15 },
      sys: { adiabaticDrySwitchpointC: 30.0 }
    });
    assert.strictEqual(dryRes.waterM3, 0, 'dry mode must consume 0 water');
    assert.strictEqual(dryRes.mode, 'free');

    const wetRes = s.simulate({
      Q_kw: 500,
      t_supply_c: 42.0,
      t_return_c: 54.0,
      w: { db: 35, wb: 25 },
      sys: { adiabaticDrySwitchpointC: 30.0 }
    });
    assert(wetRes.waterM3 > 0, 'wet mode must consume water');
  });

  test('C-1 stage_chiller simulate calculates compressor power and heat to sink', () => {
    const s = CoolingStages.get('chiller');
    const res = s.simulate({
      Q_kw: 200,
      chillerType: 'water_cooled',
      t_chws_c: 30.0,
      t_cewt_c: 35.0,
      w: { db: 35, wb: 28 }
    });
    assert(res.compressorKw > 0, 'compressor must consume power');
    assert.strictEqual(res.rejectToSinkKw, 200 + res.compressorKw, 'condenser must reject Q + P');
    assert.strictEqual(res.mode, 'mechanical');
  });
})();

// ═══════════════════════════════════════════════════════════════
// C-2 9 Architecture Descriptors & calcHourlyEnergy Registry Dispatch
// ═══════════════════════════════════════════════════════════════
(function () {
  const ctx = freshCtx();
  const { CoolingArchRegistry, AppStore: S } = ctx;

  const EXPECTED_ARCHS = [
    'dry_cooler_trim', 'dry_cooler_pure', 'adiabatic_tower', 'cooling_tower_hx', 'water_chiller',
    'air_cooled_chiller', 'water_cooled_chiller', 'chilled_water_plant', 'rdhx'
  ];

  test('C-2 CoolingArchRegistry has all 9 architecture descriptors registered', () => {
    for (const id of EXPECTED_ARCHS) {
      assert(CoolingArchRegistry.has(id), `CoolingArchRegistry must have "${id}"`);
      const arch = CoolingArchRegistry.get(id);
      assert(arch && arch.id === id, `arch descriptor "${id}" must have correct id`);
      assert(typeof arch.simulateHour === 'function', `arch "${id}" must implement simulateHour`);
      assert(Array.isArray(arch.params), `arch "${id}" must define params array`);
      assert(arch.flags && typeof arch.flags.hasMechanical === 'boolean', `arch "${id}" must define flags`);
    }
  });

  test('C-2 CoolingArchRegistry resolves all legacy aliases', () => {
    assert.strictEqual(CoolingArchRegistry.get('dry_cooler_hx').id, 'dry_cooler_trim');
    assert.strictEqual(CoolingArchRegistry.get('water_cooled_chiller_tower').id, 'water_cooled_chiller');
    assert.strictEqual(CoolingArchRegistry.get('campus_chilled_water').id, 'chilled_water_plant');
  });

  test('C-2 simulateHour returns standard contract for zero and non-zero loads', () => {
    for (const id of EXPECTED_ARCHS) {
      const arch = CoolingArchRegistry.get(id);
      const res0 = arch.simulateHour({ Q_kw: 0 });
      assert.strictEqual(res0.fanKw, 0);
      assert.strictEqual(res0.compressorKw, 0);
      assert.strictEqual(res0.waterM3, 0);

      const resLoad = arch.simulateHour({
        Q_kw: 500,
        t_supply_c: arch.loop === 'liquid' ? 42.0 : 12.0,
        t_return_c: arch.loop === 'liquid' ? 54.0 : 18.0,
        w: { db: 25, wb: 20 },
        sys: { fwsSupplyC: 42.0, fwsReturnC: 54.0, chwSupplyC: 12.0, chwReturnC: 18.0 }
      });
      assert(typeof resLoad.fanKw === 'number');
      assert(typeof resLoad.compressorKw === 'number');
      assert(typeof resLoad.waterM3 === 'number');
      assert(['free', 'partial', 'mechanical'].includes(resLoad.mode));
      assert(typeof resLoad.heatRemovedKw === 'number');
      assert(typeof resLoad.deficitKw === 'number');
    }
  });

  test('C-2 calcHourlyEnergy dispatches through registry and preserves result contract', () => {
    const du = S.state.halls[0].dus[0];
    const duSumm = S.calcDuSummary(du);
    duSumm.lossKw = duSumm.totalItKw * 0.03;
    const hr = S.calcHourlyEnergy(du.plantDesign, duSumm, { db: 28, wb: 22 });

    const requiredFields = [
      'cduPumpKw', 'crahFanKw', 'heatRejKw', 'chillerKw', 'lossKw', 'waterM3',
      'isFreeHour', 'capacityDeficitKw', 'heatRemovedKw', 'cduMode', 'fwMode',
      'combinedMode', 'mechLoadKw', 'cduKwh', 'fwKwh'
    ];
    for (const f of requiredFields) {
      assert(hr[f] !== undefined, `calcHourlyEnergy result must contain "${f}"`);
    }
    assert(hr.cduKwh.unit !== undefined && hr.cduKwh.pump !== undefined);
    assert(hr.fwKwh.pump !== undefined && hr.fwKwh.crahFan !== undefined);
  });
})();

// ═══════════════════════════════════════════════════════════════
// C-3 Generic Sizing Engine (SizingEngine)
// ═══════════════════════════════════════════════════════════════
(function () {
  const ctx = freshCtx();
  const { SizingEngine } = ctx;

  test('C-3 SizingEngine methods exist', () => {
    assert(SizingEngine, 'SizingEngine must be defined');
    assert(typeof SizingEngine.generateCduSizing === 'function', 'generateCduSizing must exist');
    assert(typeof SizingEngine.generateFwSizing === 'function', 'generateFwSizing must exist');
    assert(typeof SizingEngine.evaluateCduSizing === 'function', 'evaluateCduSizing must exist');
    assert(typeof SizingEngine.evaluateFwSizing === 'function', 'evaluateFwSizing must exist');
    assert(typeof SizingEngine.validateCdu === 'function', 'validateCdu must exist');
    assert(typeof SizingEngine.validateFw === 'function', 'validateFw must exist');
  });

  test('C-3 SizingEngine generates CDU sizing items for all liquid archs', () => {
    const liquidArchs = ['dry_cooler_trim', 'dry_cooler_pure', 'adiabatic_tower', 'cooling_tower_hx', 'water_chiller'];
    for (const a of liquidArchs) {
      const items = SizingEngine.generateCduSizing(a, 1000, 15);
      assert(Array.isArray(items) && items.length >= 2, `CDU sizing for ${a} must have items`);
      items.forEach(it => {
        assert(it.key, 'item must have key');
        assert(it.label, 'item must have label');
        assert(typeof it.unitCapKw === 'number' && it.unitCapKw > 0, 'item must have unitCapKw');
        assert(typeof it.selectedQty === 'number' && it.selectedQty >= 2, 'selectedQty must be >= 2');
        assert(typeof it.requiredKw === 'number', 'requiredKw must be number');
      });
    }
  });

  test('C-3 SizingEngine generates Fanwall/RDHX sizing items for all air archs', () => {
    const airArchs = ['air_cooled_chiller', 'water_cooled_chiller', 'chilled_water_plant', 'rdhx'];
    for (const a of airArchs) {
      const items = SizingEngine.generateFwSizing(a, 300, 10);
      assert(Array.isArray(items) && items.length >= 2, `FW sizing for ${a} must have items`);
      items.forEach(it => {
        assert(it.key, 'item must have key');
        assert(it.label, 'item must have label');
        assert(typeof it.unitCapKw === 'number' && it.unitCapKw > 0, 'item must have unitCapKw');
        assert(typeof it.selectedQty === 'number' && it.selectedQty >= 2, 'selectedQty must be >= 2');
        assert(typeof it.requiredKw === 'number', 'requiredKw must be number');
      });
    }
  });

  test('C-3 SizingEngine evaluates CDU and Fanwall sizing and validates successfully', () => {
    const cduSys = {
      architecture: 'dry_cooler_trim',
      fwsSupplyC: 40.0,
      fwsReturnC: 55.0,
      hydraulics: { pump_power_kw: 11.0 }
    };
    cduSys.sizing = SizingEngine.generateCduSizing('dry_cooler_trim', 1000, 11.0);
    const designCond = { designDb: 34.0, designWb: 28.0, maxDb: 38.0 };
    SizingEngine.evaluateCduSizing(cduSys, 1000, designCond, {
      trimOperatingPoint: (sys, db) => ({ chiller_fraction: 0.35, tChws: 30, tCewt: 39 })
    });
    const cduVal = SizingEngine.validateCdu(cduSys, 1.8);
    assert(typeof cduVal.ok === 'boolean', 'cduVal.ok must be boolean');
    assert(Array.isArray(cduVal.checks) && cduVal.checks.length > 0, 'cduVal.checks must be non-empty');

    const fwSys = {
      architecture: 'air_cooled_chiller',
      chwSupplyC: 12.0,
      chwReturnC: 18.0,
      hydraulics: { pump_power_kw: 8.0 }
    };
    fwSys.sizing = SizingEngine.generateFwSizing('air_cooled_chiller', 200, 8.0);
    SizingEngine.evaluateFwSizing(fwSys, 200, designCond);
    const fwVal = SizingEngine.validateFw(fwSys, 1.8);
    assert(typeof fwVal.ok === 'boolean', 'fwVal.ok must be boolean');
    assert(Array.isArray(fwVal.checks) && fwVal.checks.length > 0, 'fwVal.checks must be non-empty');
  });
})();

// ═══════════════════════════════════════════════════════════════
// C-4 Annual Simulation Runner & simulateUnit (AnnualRunner)
// ═══════════════════════════════════════════════════════════════
(function () {
  const ctx = freshCtx();
  const { AnnualRunner, AppStore: S } = ctx;

  test('C-4 AnnualRunner and AppStore.simulateUnit exist', () => {
    assert(AnnualRunner, 'AnnualRunner must be defined');
    assert(typeof AnnualRunner.simulateUnit === 'function', 'AnnualRunner.simulateUnit must exist');
    assert(typeof AnnualRunner.formatUnitResult === 'function', 'AnnualRunner.formatUnitResult must exist');
    assert(typeof AnnualRunner.calculateLedgers === 'function', 'AnnualRunner.calculateLedgers must exist');
    assert(typeof AnnualRunner.buildHourlyProfile === 'function', 'AnnualRunner.buildHourlyProfile must exist');
    assert(typeof AnnualRunner.run === 'function', 'AnnualRunner.run must exist');
    assert(typeof S.simulateUnit === 'function', 'AppStore.simulateUnit must exist');
  });

  test('C-4 AnnualRunner.simulateUnit runs 8760h and returns complete unit metrics', () => {
    const du = S.state.halls[0].dus[0];
    const duSumm = S.calcDuSummary(du);
    duSumm.lossKw = duSumm.totalItKw * 0.03;
    const weather = S.state.site.hourly && S.state.site.hourly.length >= 8760
      ? S.state.site.hourly
      : S.generateFallbackWeather();

    const sim = AnnualRunner.simulateUnit(du.plantDesign, duSumm, weather, {
      calcHourlyEnergy: (plant, summ, w) => S.calcHourlyEnergy(plant, summ, w)
    });

    assert(sim.kwh && typeof sim.kwh.it === 'number', 'kwh.it must be number');
    assert(typeof sim.kwh.cduPump === 'number', 'kwh.cduPump must be number');
    assert(typeof sim.kwh.crahFan === 'number', 'kwh.crahFan must be number');
    assert(typeof sim.kwh.heatRejection === 'number', 'kwh.heatRejection must be number');
    assert(typeof sim.kwh.chiller === 'number', 'kwh.chiller must be number');
    assert(typeof sim.kwh.loss === 'number', 'kwh.loss must be number');
    assert(typeof sim.waterM3 === 'number', 'waterM3 must be number');
    assert(typeof sim.fcHours === 'number', 'fcHours must be number');
    assert(typeof sim.deficitHours === 'number', 'deficitHours must be number');
    assert(typeof sim.maxDeficitKw === 'number', 'maxDeficitKw must be number');
    assert(typeof sim.pue === 'number' && sim.pue >= 1.0, 'pue must be >= 1.0');
    assert(typeof sim.wue === 'number' && sim.wue >= 0, 'wue must be >= 0');
  });

  test('C-4 AnnualRunner.run produces valid overall, byDu, byCorePod, and ledgers', () => {
    S.calculate();
    const r = S.state.results;
    assert(r.overall, 'results.overall must exist');
    assert(r.byDu && Array.isArray(r.byDu), 'results.byDu must be array');
    assert(r.byCorePod && Array.isArray(r.byCorePod), 'results.byCorePod must be array');
    assert(r.corePodGroup, 'results.corePodGroup must exist');
    assert(r.overall.energyLedger, 'overall.energyLedger must exist');
    assert(r.overall.thermalLedger, 'overall.thermalLedger must exist');
    assert(r.overall.hydraulicLedger, 'overall.hydraulicLedger must exist');
    assert(r.overall.energyLedger.is_balanced === true, 'energyLedger must be balanced');
    assert(r.overall.thermalLedger.is_balanced === true, 'thermalLedger must be balanced');
    assert(r.overall.hydraulicLedger.is_hydraulic_ok === true, 'hydraulicLedger must be ok');
    assert(Array.isArray(r.hourlyProfile) && r.hourlyProfile.length === 8760, 'hourlyProfile must have 8760 records');
    assert(Array.isArray(r.monthlyPue) && r.monthlyPue.length === 12, 'monthlyPue must have 12 records');
  });
})();

// ═══════════════════════════════════════════════════════════════
// C-5 Schema v5 and migrateProject
// ═══════════════════════════════════════════════════════════════
(function () {
  const ctx = freshCtx();
  const fs = require('fs');
  const path = require('path');
  const { AppStore: S } = ctx;

  test('C-5 serializeProject produces schemaVersion v5', () => {
    const json = S.serializeProject();
    const parsed = JSON.parse(json);
    assert.strictEqual(parsed.schemaVersion, 'v5');
  });

  test('C-5 migrateProject resolves legacy aliases, adds redundancy and enabled', () => {
    const v4State = {
      schemaVersion: 'v4',
      corePods: [{ id: 'pod1', name: 'POD 1' }],
      halls: [{
        id: 'h1',
        dus: [{
          id: 'du1',
          plantDesign: {
            cduSystem: {
              architecture: 'dry_cooler_hx',
              sizing: [{ key: 'cdu_unit', selectedModel: 'Vertiv XDU 80kW' }]
            },
            fanwallSystem: {
              architecture: 'water_cooled_chiller_tower',
              sizing: [{ key: 'crah_unit', selectedModel: 'Standard' }]
            }
          }
        }]
      }]
    };

    const migrated = S.migrateProject(v4State);
    assert.strictEqual(migrated.schemaVersion, 'v5');
    assert.strictEqual(migrated.corePods[0].enabled, true);
    assert.strictEqual(migrated.halls[0].dus[0].plantDesign.cduSystem.architecture, 'dry_cooler_trim');
    assert.strictEqual(migrated.halls[0].dus[0].plantDesign.fanwallSystem.architecture, 'water_cooled_chiller');
    assert.strictEqual(migrated.halls[0].dus[0].plantDesign.cduSystem.sizing[0].redundancy, 'N+1');
    assert.strictEqual(migrated.halls[0].dus[0].plantDesign.fanwallSystem.sizing[0].redundancy, 'N+1');
    assert(migrated.halls[0].dus[0].plantDesign.cduSystem.secSupplyC !== undefined);
  });

  test('C-5 round-trip migration test with sample project file', () => {
    const samplePath = path.resolve(__dirname, '../../public/Data center Cal/projects/PUE_Project_高雄 (Kaohsiung)_20260901.json');
    if (!fs.existsSync(samplePath)) {
      console.warn('Sample project file not found, skipping round-trip test');
      return;
    }
    const sampleRaw = fs.readFileSync(samplePath, 'utf8');
    const ok1 = S.deserializeProject(sampleRaw);
    assert.strictEqual(ok1, true);
    const pue1 = S.state.results.overall.annualPue;
    const water1 = S.state.results.overall.annualWaterM3;

    const savedV5 = S.serializeProject();
    const parsedV5 = JSON.parse(savedV5);
    assert.strictEqual(parsedV5.schemaVersion, 'v5');

    const ok2 = S.deserializeProject(savedV5);
    assert.strictEqual(ok2, true);
    const pue2 = S.state.results.overall.annualPue;
    const water2 = S.state.results.overall.annualWaterM3;

    assert.strictEqual(pue1, pue2, `PUE after round-trip must match: ${pue1} vs ${pue2}`);
    assert.strictEqual(water1, water2, `Water after round-trip must match: ${water1} vs ${water2}`);
  });
})();

// ═══════════════════════════════════════════════════════════════
// C-6 Dead Code Elimination, Magic Numbers, M9 IDs & Catalog Clean
// ═══════════════════════════════════════════════════════════════
(function () {
  const ctx = freshCtx();
  const {
    CRACEngine, EngineeringBasis, CDUEngine, CoolingTowerEngine,
    FreeCoolingEngine, LOAD_PROFILE_PRESETS, ASSUMPTIONS, AppStore: S
  } = ctx;

  test('C-6 M7 dead code functions and classes are eliminated', () => {
    assert.strictEqual(typeof CRACEngine, 'undefined', 'CRACEngine must be deleted');
    assert.strictEqual(typeof EngineeringBasis, 'undefined', 'EngineeringBasis must be deleted');
    assert.strictEqual(typeof CDUEngine.calcThermalHydraulics, 'undefined', 'CDUEngine.calcThermalHydraulics must be deleted');
    assert.strictEqual(typeof CoolingTowerEngine.calcApproachAtWB, 'undefined', 'CoolingTowerEngine.calcApproachAtWB must be deleted');
    assert.strictEqual(typeof FreeCoolingEngine.calcAirSideEconomizer, 'undefined', 'calcAirSideEconomizer must be deleted');
    assert.strictEqual(typeof FreeCoolingEngine.calcPartialFCEnergy, 'undefined', 'calcPartialFCEnergy must be deleted');
    assert.strictEqual(typeof FreeCoolingEngine.calcSeaWaterFC, 'undefined', 'calcSeaWaterFC must be deleted');
    assert.strictEqual(typeof FreeCoolingEngine.calcArchitectureFC, 'undefined', 'calcArchitectureFC must be deleted');
    assert.strictEqual(typeof FreeCoolingEngine.calcNvidiaDSXFreeCooling, 'undefined', 'calcNvidiaDSXFreeCooling must be deleted');
    assert.strictEqual(typeof FreeCoolingEngine.getSeaWaterTemp, 'undefined', 'getSeaWaterTemp must be deleted');
    assert.strictEqual(typeof ASSUMPTIONS.cooling_diversity_factor, 'undefined', 'cooling_diversity_factor must be deleted');
    assert.strictEqual(typeof ASSUMPTIONS.future_margin_pct, 'undefined', 'future_margin_pct must be deleted');
  });

  test('C-6 §7-D3 LOAD_PROFILE_PRESETS is preserved for Phase E', () => {
    assert(LOAD_PROFILE_PRESETS && typeof LOAD_PROFILE_PRESETS === 'object', 'LOAD_PROFILE_PRESETS must be preserved');
  });

  test('C-6 M4 magic numbers added to ASSUMPTIONS with labels and refs', () => {
    assert(ASSUMPTIONS.tower_heat_rejection_factor, 'tower_heat_rejection_factor must exist');
    assert.strictEqual(ASSUMPTIONS.tower_heat_rejection_factor.val, 1.2);
    assert(ASSUMPTIONS.tower_heat_rejection_factor.ref, 'must have ref');

    assert(ASSUMPTIONS.district_chw_cop, 'district_chw_cop must exist');
    assert.strictEqual(ASSUMPTIONS.district_chw_cop.val, 5.0);
    assert(ASSUMPTIONS.district_chw_cop.ref, 'must have ref');
  });

  test('C-6 M9 IDs generated in copySU loop are all strictly unique', () => {
    const hallId = S.state.halls[0].id;
    const duId = S.state.halls[0].dus[0].id;
    const suId = S.state.halls[0].dus[0].sus[0].id;

    const ok = S.copySU(hallId, duId, suId, 5);
    assert.strictEqual(ok, true);

    const sus = S.state.halls[0].dus[0].sus;
    const suIds = sus.map(s => s.id);
    const uniqueSuIds = new Set(suIds);
    assert.strictEqual(suIds.length, uniqueSuIds.size, 'All SU IDs must be unique');

    const eqIds = sus.flatMap(s => s.equipment.map(e => e.id));
    const uniqueEqIds = new Set(eqIds);
    assert.strictEqual(eqIds.length, uniqueEqIds.size, 'All EQ IDs must be unique');
  });
})();

// ── D-1: CoolingArchRegistry UI labels & options ──────────────────────────────
(function () {
  const ctx = freshCtx();
  const Registry = ctx.CoolingArchRegistry;

  test('D-1 getDashboardLabel returns correct labels for standard IDs and aliases', () => {
    assert.strictEqual(Registry.getDashboardLabel('dry_cooler_trim'), '乾冷器 + 修整冰機 (Dry Cooler + Trim Chiller)');
    assert.strictEqual(Registry.getDashboardLabel('dry_cooler_hx'), '乾冷器 + 板換 + 修整冰機 (Dry Cooler + PHE + Trim Chiller)');
    assert.strictEqual(Registry.getDashboardLabel('dry_cooler_pure'), '純乾冷器自然排熱 (Dry Cooler)');
    assert.strictEqual(Registry.getDashboardLabel('adiabatic_tower'), '絕熱密閉冷卻水塔 (Adiabatic Tower)');
    assert.strictEqual(Registry.getDashboardLabel('cooling_tower_hx'), '密閉式冷卻水塔 (Closed-Circuit Cooling Tower)');
    assert.strictEqual(Registry.getDashboardLabel('water_chiller'), '水冷冰機製冷 (Water-Cooled Chiller)');
    assert.strictEqual(Registry.getDashboardLabel('air_cooled_chiller'), '氣冷式冰水主機 (Air-Cooled Chiller)');
    assert.strictEqual(Registry.getDashboardLabel('water_cooled_chiller'), '水冷式冰水主機 (Water-Cooled Chiller)');
    assert.strictEqual(Registry.getDashboardLabel('water_cooled_chiller_tower'), '水冷式冰水主機 (Water-Cooled Chiller)');
    assert.strictEqual(Registry.getDashboardLabel('rdhx'), '背板熱交換器 (RDHx Neutral Loop)');
    assert.strictEqual(Registry.getDashboardLabel('chilled_water_plant'), '廠區集中冷站 (Chilled Water Plant)');
    assert.strictEqual(Registry.getDashboardLabel('campus_chilled_water'), '廠區集中冷站 (Chilled Water Plant)');
  });

  test('D-1 cardLabel matches expectations across all architectures', () => {
    assert.strictEqual(Registry.get('dry_cooler_trim').cardLabel, '乾冷器 + Trim 冰機 (NVIDIA DSX)');
    assert.strictEqual(Registry.get('dry_cooler_pure').cardLabel, '純乾冷器 (零冰機)');
    assert.strictEqual(Registry.get('adiabatic_tower').cardLabel, '絕熱冷卻塔 (零冰機)');
    assert.strictEqual(Registry.get('cooling_tower_hx').cardLabel, '密閉式冷卻水塔 (零冰機)');
    assert.strictEqual(Registry.get('water_chiller').cardLabel, '全額水冷式冰機');
    assert.strictEqual(Registry.get('air_cooled_chiller').cardLabel, '氣冷式冰機');
    assert.strictEqual(Registry.get('water_cooled_chiller').cardLabel, '水冷式冰機');
    assert.strictEqual(Registry.get('chilled_water_plant').cardLabel, '廠區集中冰水');
    assert.strictEqual(Registry.get('rdhx').cardLabel, 'RDHX 背板');
  });

  test('D-1 list(loop) returns ordered options with optionLabel', () => {
    const liquidList = Registry.list('liquid');
    assert.strictEqual(liquidList.length, 5);
    assert.deepStrictEqual(liquidList.map(a => a.id), [
      'dry_cooler_trim', 'dry_cooler_pure', 'adiabatic_tower', 'cooling_tower_hx', 'water_chiller'
    ]);
    liquidList.forEach(a => assert(typeof a.optionLabel === 'string' && a.optionLabel.length > 0));

    const airList = Registry.list('air');
    assert.strictEqual(airList.length, 4);
    assert.deepStrictEqual(airList.map(a => a.id), [
      'air_cooled_chiller', 'water_cooled_chiller', 'chilled_water_plant', 'rdhx'
    ]);
    airList.forEach(a => assert(typeof a.optionLabel === 'string' && a.optionLabel.length > 0));
  });
})();

// ── D-2: CoolingSchematics & arch.schematic dispatching ─────────────────────────
(function () {
  const fs = require('fs');
  const path = require('path');
  const vm = require('vm');
  const ctx = freshCtx();
  const Registry = ctx.CoolingArchRegistry;

  const schematicsDir = path.resolve(__dirname, '../../public/Data center Cal/js/views/schematics');
  ['schematic_single_loop.js', 'schematic_series_trim.js', 'schematic_air_plant.js'].forEach(f => {
    vm.runInContext(fs.readFileSync(path.join(schematicsDir, f), 'utf8'), ctx);
  });

  const Schematics = ctx.CoolingSchematics;

  test('D-2 all 9 architectures specify valid schematic property matching registered schematics', () => {
    const allArchs = Registry.list();
    assert.strictEqual(allArchs.length, 9);
    allArchs.forEach(arch => {
      assert(typeof arch.schematic === 'string' && arch.schematic.length > 0, `${arch.id} must define schematic`);
      assert(Schematics.get(arch.schematic), `${arch.id} schematic '${arch.schematic}' must be registered in CoolingSchematics`);
    });
  });

  test('D-2 CoolingSchematics renders non-empty SVG for each schematic type', () => {
    const dummyTarget = {
      id: 'du_test',
      name: 'Test DU',
      summ: { totalItKw: 1000, liquidHeatKw: 800, airHeatKw: 200, lossKw: 0, dlcPct: 80 }
    };
    const dummyCduSys = {
      architecture: 'dry_cooler_trim',
      secSupplyC: 45, secReturnC: 57, cduApproachC: 3, fwsSupplyC: 42, fwsReturnC: 54,
      dryCoolerApproachC: 5, pheApproachC: 2
    };
    const dummyFwSys = {
      architecture: 'air_cooled_chiller',
      chwSupplyC: 12, chwReturnC: 18
    };

    const outTrim = Schematics.render('series_trim', { t: dummyTarget, cduSys: dummyCduSys, arch: 'dry_cooler_trim' });
    assert(outTrim.includes('<svg') && outTrim.includes('</svg>'), 'series_trim must produce SVG');

    const outSingle = Schematics.render('single_loop', { t: dummyTarget, cduSys: dummyCduSys, arch: 'dry_cooler_pure' });
    assert(outSingle.includes('<svg') && outSingle.includes('</svg>'), 'single_loop must produce SVG');

    const outAir = Schematics.render('air_plant', { t: dummyTarget, fwSys: dummyFwSys, fwArch: 'air_cooled_chiller' });
    assert(outAir.includes('<svg') && outAir.includes('</svg>'), 'air_plant must produce SVG');
  });
})();

// ═══════════════════════════════════════════════════════════════
// D-3 Architecture-specific parameter panel from arch.params
// ═══════════════════════════════════════════════════════════════
(function () {
  const fs = require('fs');
  const path = require('path');
  const vm = require('vm');
  const JS_DIR = path.resolve(__dirname, '../../public/Data center Cal/js');
  const ctx = freshCtx();
  const Registry = ctx.CoolingArchRegistry;
  // Load schematics and view_cooling
  const extraFiles = [
    'views/schematics/schematic_single_loop.js',
    'views/schematics/schematic_series_trim.js',
    'views/schematics/schematic_air_plant.js',
    'views/view_cooling.js'
  ];
  for (const f of extraFiles) {
    const code = fs.readFileSync(path.join(JS_DIR, f), 'utf8');
    vm.runInContext(code, ctx);
  }
  const ViewCooling = ctx.ViewCooling;

  test('D-3 adiabatic_tower defines archSpecific params and paramPanel properties', () => {
    const atArch = Registry.get('adiabatic_tower');
    assert(atArch, 'adiabatic_tower arch must exist');
    assert(Array.isArray(atArch.params), 'adiabatic_tower must have params array');
    const custom = atArch.params.filter(p => p.archSpecific);
    assert.strictEqual(custom.length, 2, 'must have 2 archSpecific params');
    assert.strictEqual(custom[0].key, 'adiabaticSaturationEfficiencyPct');
    assert.strictEqual(custom[0].idPrefix, 'atSatEffIn_');
    assert.strictEqual(custom[1].key, 'adiabaticDrySwitchpointC');
    assert.strictEqual(custom[1].idPrefix, 'atSwitchpointIn_');
    assert(typeof atArch.paramPanelTitle === 'string');
    assert(typeof atArch.paramPanelNote === 'function');
  });

  test('D-3 renderArchParamPanel returns empty string for archs without archSpecific params', () => {
    const dcArch = Registry.get('dry_cooler_trim');
    const out = ViewCooling.renderArchParamPanel(dcArch, { fwsSupplyC: 42 }, 'du_1', 'cdu');
    assert.strictEqual(out, '', 'dry_cooler_trim must return empty string');
  });

  test('D-3 renderArchParamPanel generates correct inputs and notes for adiabatic_tower', () => {
    const atArch = Registry.get('adiabatic_tower');
    // Case A: default / no manual override
    const sysA = { fwsSupplyC: 42, adiabaticSaturationEfficiencyPct: 85 };
    const outA = ViewCooling.renderArchParamPanel(atArch, sysA, 'du_1', 'cdu');
    assert(outA.includes('id="atSatEffIn_du_1"'), 'must include sat eff input');
    assert(outA.includes('id="atSwitchpointIn_du_1"'), 'must include switchpoint input');
    assert(outA.includes('value="85"'), 'sat eff input must have value 85');
    assert(outA.includes('placeholder="估算值 35.0°C"'), 'placeholder must show estimated switchpoint');
    assert(outA.includes('目前依需求自動切換'), 'must show formula estimation note when no override');

    // Case B: with manual override
    const sysB = { fwsSupplyC: 42, adiabaticSaturationEfficiencyPct: 80, adiabaticDrySwitchpointC: 30.5 };
    const outB = ViewCooling.renderArchParamPanel(atArch, sysB, 'du_1', 'cdu');
    assert(outB.includes('value="30.5"'), 'must include manual override value in input');
    assert(outB.includes('目前使用手動輸入值 <strong>30.5°C</strong>'), 'must show manual override note');
  });
})();

// ═══════════════════════════════════════════════════════════════
// P1-2 CoolingArchRegistry pillLabel
// ═══════════════════════════════════════════════════════════════
(function () {
  const ctx = freshCtx();
  const Registry = ctx.CoolingArchRegistry;
  const expectedPillLabels = {
    dry_cooler_trim: '乾冷器+Trim',
    dry_cooler_pure: '純乾冷器',
    adiabatic_tower: '絕熱塔',
    cooling_tower_hx: '閉式塔',
    water_chiller: '水冷冰機',
    air_cooled_chiller: '氣冷冰機',
    water_cooled_chiller: '水冷冰機',
    chilled_water_plant: '廠區冰水',
    rdhx: 'RDHX 背板'
  };

  test('P1-2 all 9 architectures define expected pillLabel', () => {
    for (const [id, label] of Object.entries(expectedPillLabels)) {
      const arch = Registry.get(id);
      assert(arch, `${id} must exist in registry`);
      assert.strictEqual(arch.pillLabel, label, `${id} pillLabel must be '${label}'`);
    }
    // Also test alias resolution
    assert.strictEqual(Registry.get('dry_cooler_hx').pillLabel, '乾冷器+Trim');
  });
})();

// ═══════════════════════════════════════════════════════════════
// P1-3 hourlyProfile.waterM3 and dashboard display
// ═══════════════════════════════════════════════════════════════
(function () {
  const ctx = freshCtx();
  const { AppStore: S } = ctx;
  S.calculate();
  const hp = S.state.results.hourlyProfile;

  test('P1-3 hourlyProfile contains waterM3 field for all hours', () => {
    assert(Array.isArray(hp) && hp.length === 8760, 'hourlyProfile must have 8760 entries');
    assert(typeof hp[0].waterM3 === 'number', 'waterM3 must be a number');
    assert(hp.every(h => typeof h.waterM3 === 'number' && !isNaN(h.waterM3)), 'every hour must have valid waterM3');
  });

  test('P1-3 adiabatic_tower produces waterM3 > 0 during spray hours in hourlyProfile', () => {
    S.state.site.hourly = ctx.BUILTIN_WEATHER_DATA['高雄 (Kaohsiung)'].hourlyData;
    S.state.halls[0].dus[0].plantDesign.cduSystem.architecture = 'adiabatic_tower';
    S.calculate();
    const hpAdiabatic = S.state.results.hourlyProfile;
    const sprayHours = hpAdiabatic.filter(h => h.waterM3 > 0);
    assert(sprayHours.length > 0, 'adiabatic tower must have spray hours with waterM3 > 0');
    const sumHourlyWater = hpAdiabatic.reduce((sum, h) => sum + h.waterM3, 0);
    const overallWater = S.state.results.overall.annualWaterM3;
    assert(Math.abs(sumHourlyWater - overallWater) < 2.0, `sum of hourly water (${sumHourlyWater}) should match annualWaterM3 (${overallWater})`);
  });
})();

// ═══════════════════════════════════════════════════════════════
// F-8 dominantCduThresholds replaces getEffectiveFcThresholds
// ═══════════════════════════════════════════════════════════════
(function () {
  const ctx = freshCtx();
  const { AppStore: S, ASSUMPTIONS } = ctx;

  test('F-8 dominantCduThresholds returns thresholds from dominant CDU unit and legacy functions are deleted', () => {
    assert.strictEqual(S.getEffectiveFcThresholds, undefined, 'getEffectiveFcThresholds must be deleted');
    assert.strictEqual(ASSUMPTIONS.nvidia_dsx_mode2_offset_c, undefined, 'nvidia_dsx_mode2_offset_c must be deleted');
    assert(typeof S.dominantCduThresholds === 'function', 'dominantCduThresholds must exist');
    const dom = S.dominantCduThresholds();
    assert(dom && dom.thresholds, 'dominantCduThresholds must return thresholds');
    assert(dom.archName, 'dominantCduThresholds must return archName');
    assert(dom.basis, 'dominantCduThresholds must return basis');
  });
})();

// ═══════════════════════════════════════════════════════════════
// P2-1 Architecture Equipment Descriptors & resolveEquipment
// ═══════════════════════════════════════════════════════════════
(function () {
  const ctx = freshCtx();
  const { AppStore: S, CoolingArchRegistry } = ctx;

  const archIds = [
    'dry_cooler_trim', 'dry_cooler_pure', 'adiabatic_tower', 'cooling_tower_hx', 'water_chiller',
    'air_cooled_chiller', 'water_cooled_chiller', 'chilled_water_plant', 'rdhx'
  ];

  test('P2-1 all 9 architectures define valid equipment list', () => {
    for (const id of archIds) {
      const arch = CoolingArchRegistry.get(id);
      assert(arch, `${id} must exist in registry`);
      assert(Array.isArray(arch.equipment) && arch.equipment.length > 0, `${id} must have non-empty equipment array`);
      for (const eq of arch.equipment) {
        assert(typeof eq.key === 'string' && eq.key.length > 0, `${id} equip key must be string`);
        assert(typeof eq.role === 'string' && eq.role.length > 0, `${id} equip role must be string`);
      }
    }
  });

  test('P2-1 AppStore.resolveEquipment resolves devices from sizing items', () => {
    assert(typeof S.resolveEquipment === 'function', 'resolveEquipment must be a function on AppStore');
    const du = S.state.halls[0].dus[0];
    const cduSys = du.plantDesign.cduSystem;
    const fwSys = du.plantDesign.fanwallSystem;

    const cduEquip = S.resolveEquipment('dry_cooler_trim', cduSys);
    assert(cduEquip.cdu_unit !== undefined, 'cdu_unit must be resolved');
    assert(cduEquip.dry_cooler !== undefined, 'dry_cooler must be resolved');
    assert(cduEquip.cdu_pump !== undefined, 'cdu_pump must be resolved');
    assert(cduEquip.trim_chiller !== undefined, 'trim_chiller must be resolved');

    const fwEquip = S.resolveEquipment('air_cooled_chiller', fwSys);
    assert(fwEquip.crah_unit !== undefined, 'crah_unit must be resolved');
    assert(fwEquip.air_cooled_chiller !== undefined, 'air_cooled_chiller must be resolved');
    assert(fwEquip.fw_pump !== undefined, 'fw_pump must be resolved');

    const rdhxEquip = S.resolveEquipment('rdhx', fwSys);
    assert(rdhxEquip.rdhx_unit !== undefined, 'rdhx_unit must be resolved');
  });
})();

// ── P2-2: Performance optimization via hoisted loop invariants ────────────────
(function () {
  const ctx = freshCtx();
  const S = ctx.AppStore;
  const AnnualRunner = ctx.AnnualRunner;

  test('P2-2 calcHourlyEnergy yields identical results with and without pre', () => {
    const du = S.state.halls[0].dus[0];
    const summ = S.calcDuSummary(du);
    summ.lossKw = 10;
    S.bridgeDuToPlantModel(du, summ);

    const testWeathers = [
      { db: 35, wb: 28 }, // Summer
      { db: 22, wb: 18 }, // Shoulder
      { db: 10, wb: 8 }   // Winter
    ];

    for (const w of testWeathers) {
      const resWithoutPre = S.calcHourlyEnergy(du.plantDesign, summ, w, null);
      // Run simulateUnit which constructs pre
      let capturedPre = null;
      AnnualRunner.simulateUnit(du.plantDesign, summ, [w], {
        calcHourlyEnergy: (p, s, weather, pre) => {
          capturedPre = pre;
          return resWithoutPre;
        }
      });
      assert(capturedPre !== null, 'pre must be constructed and passed by simulateUnit');
      assert(capturedPre.cduEquip, 'pre must have cduEquip');
      assert(capturedPre.pumpTable, 'pre must have pumpTable');

      const resWithPre = S.calcHourlyEnergy(du.plantDesign, summ, w, capturedPre);

      assert.strictEqual(resWithPre.cduPumpKw, resWithoutPre.cduPumpKw, `cduPumpKw must match for db=${w.db}`);
      assert.strictEqual(resWithPre.crahFanKw, resWithoutPre.crahFanKw, `crahFanKw must match for db=${w.db}`);
      assert.strictEqual(resWithPre.heatRejKw, resWithoutPre.heatRejKw, `heatRejKw must match for db=${w.db}`);
      assert.strictEqual(resWithPre.chillerKw, resWithoutPre.chillerKw, `chillerKw must match for db=${w.db}`);
      assert.strictEqual(resWithPre.waterM3, resWithoutPre.waterM3, `waterM3 must match for db=${w.db}`);
      assert.strictEqual(resWithPre.mode, resWithoutPre.mode, `mode must match for db=${w.db}`);
      assert.strictEqual(resWithPre.capacityDeficitKw, resWithoutPre.capacityDeficitKw, `deficitKw must match for db=${w.db}`);
    }
  });

  test('P2-2 10 DU + 1 Pod calculate runtime is well under 500 ms', () => {
    const hallId = S.state.halls[0].id;
    for (let i = 0; i < 9; i++) {
      S.addDU(hallId);
    }
    assert.strictEqual(S.state.halls[0].dus.length, 10, 'must have 10 DUs');
    assert.strictEqual(S.state.corePods.length, 1, 'must have 1 CorePod');

    // Warmup
    S.calculate();

    const t0 = Date.now();
    const runs = 5;
    for (let i = 0; i < runs; i++) {
      S.calculate();
    }
    const elapsedMs = (Date.now() - t0) / runs;
    assert(elapsedMs < 500, `Average calculate() (${elapsedMs.toFixed(1)} ms) must be < 500 ms`);
  });
})();

// ── P2-3: SizingEngine iterates arch.equipment without arch === '...' checks ──
(function () {
  const ctx = freshCtx();
  const SE = ctx.SizingEngine;
  const fs = require('fs');
  const path = require('path');

  test('P2-3 sizing_engine.js contains 0 occurrences of arch ===', () => {
    const code = fs.readFileSync(path.resolve(__dirname, '../../public/Data center Cal/js/sizing/sizing_engine.js'), 'utf8');
    const matches = code.match(/arch\s*===/g);
    assert.strictEqual(matches, null, 'sizing_engine.js must not contain any arch === checks');
  });

  test('P2-3 SizingEngine generates valid sizing items from arch.equipment for all archs', () => {
    const cduArchs = ['dry_cooler_trim', 'dry_cooler_pure', 'adiabatic_tower', 'cooling_tower_hx', 'water_chiller'];
    for (const a of cduArchs) {
      const items = SE.generateCduSizing(a, 850, 11);
      assert(Array.isArray(items) && items.length >= 2, `${a} must generate at least 2 sizing items`);
      for (const item of items) {
        assert(item.key, 'sizing item must have key');
        assert(item.label, 'sizing item must have label');
        assert(item.category, 'sizing item must have category');
        assert(item.selectedModel, 'sizing item must have selectedModel');
        assert(item.unitCapKw > 0, 'sizing item must have positive unitCapKw');
        assert(item.selectedQty >= 2, 'sizing item must have at least 2 qty');
        assert(item.requiredKw > 0, 'sizing item must have positive requiredKw');
      }
    }

    const fwArchs = ['air_cooled_chiller', 'water_cooled_chiller', 'chilled_water_plant', 'rdhx'];
    for (const a of fwArchs) {
      const items = SE.generateFwSizing(a, 200, 5);
      assert(Array.isArray(items) && items.length >= 2, `${a} must generate at least 2 sizing items`);
      for (const item of items) {
        assert(item.key, 'sizing item must have key');
        assert(item.label, 'sizing item must have label');
        assert(item.category, 'sizing item must have category');
        assert(item.selectedModel, 'sizing item must have selectedModel');
        assert(item.unitCapKw > 0, 'sizing item must have positive unitCapKw');
        assert(item.selectedQty >= 2, 'sizing item must have at least 2 qty');
        assert(item.requiredKw > 0, 'sizing item must have positive requiredKw');
      }
    }
  });
})();

// ── P2-4: 階段鏈實作與可擴充性驗收 ──────────────────────────────────────────
(function () {
  const ctx = freshCtx();
  const { CoolingStages, CoolingArchRegistry, runStageChain, AnnualRunner, BUILTIN_WEATHER } = ctx;

  test('P2-4 runStageChain function is defined', () => {
    assert.strictEqual(typeof runStageChain, 'function');
  });

  test('P2-4 stages implement availableTemp and rejectionCost interfaces', () => {
    const stageIds = ['dry_cooler', 'evap_tower', 'closed_tower', 'adiabatic', 'chiller', 'fc_coil'];
    for (const sid of stageIds) {
      assert(CoolingStages.has(sid), `Stage ${sid} must be registered`);
      const stage = CoolingStages.get(sid);
      assert.strictEqual(typeof stage.availableTemp, 'function', `${sid} must implement availableTemp`);
      assert.strictEqual(typeof stage.rejectionCost, 'function', `${sid} must implement rejectionCost`);
    }
  });

  test('P2-4 AppStore.trimOperatingPoint forwards to liquid_dry_cooler_trim.operatingPoint', () => {
    const dummyCduSys = { fwsSupplyC: 40.0, fwsReturnC: 55.0, dryCoolerApproachC: 5.0, pheApproachC: 2.0 };
    const resStore = ctx.AppStore.trimOperatingPoint(dummyCduSys, 32.0);
    const arch = CoolingArchRegistry.get('dry_cooler_trim');
    const resArch = arch.operatingPoint(dummyCduSys, { db: 32.0 });
    assert.strictEqual(resStore.chiller_fraction, resArch.chiller_fraction);
    assert.strictEqual(resStore.tPre, resArch.tPre);
    assert.strictEqual(resStore.tCewt, resArch.tCewt);
    assert.strictEqual(resStore.tChws, resArch.tChws);
  });

  test('P2-4 scalability: adiabatic_trim runs Alabama 8760h with 0 deficit and positive chiller MWh', () => {
    // 1. Get Alabama weather
    const alabamaKey = Object.keys(ctx.BUILTIN_WEATHER_DATA || {}).find(k => k.includes('Alabama'));
    const alabama = ctx.BUILTIN_WEATHER_DATA[alabamaKey];
    assert(alabama && Array.isArray(alabama.hourlyData), 'Alabama weather must exist in BUILTIN_WEATHER_DATA');

    // 2. Register temporary architecture adiabatic_trim by composing adiabatic_tower with trim_chiller
    const adiabaticDesc = CoolingArchRegistry.get('adiabatic_tower');
    const trimDesc = CoolingArchRegistry.get('dry_cooler_trim');
    const trimChillerEquip = trimDesc.equipment.find(e => e.key === 'trim_chiller');

    CoolingArchRegistry.register({
      id: 'adiabatic_trim',
      name: 'Adiabatic Trim Test',
      loop: 'liquid',
      equipment: [
        ...adiabaticDesc.equipment,
        trimChillerEquip
      ],
      stages: [
        { type: 'adiabatic', role: 'economizer', equipKey: 'adiabatic_tower' },
        { type: 'chiller', role: 'mechanical', chillerType: 'water_cooled', equipKey: 'trim_chiller', fallbackCop: 6.2 }
      ],
      simulateHour(simCtx) {
        return runStageChain(this.stages, simCtx, this);
      }
    });

    // 3. Run AnnualRunner for pure adiabatic tower on Alabama at 35C FWS (where pure has summer deficit)
    const S = ctx.AppStore;
    const du = S.state.halls[0].dus[0];
    du.plantDesign.cduSystem.fwsSupplyC = 35.0;
    du.plantDesign.cduSystem.fwsReturnC = 47.0;
    const summ = S.calcDuSummary(du);

    du.plantDesign.cduSystem.architecture = 'adiabatic_tower';
    S.bridgeDuToPlantModel(du, summ);
    let pureDeficitHours = 0;
    AnnualRunner.simulateUnit(du.plantDesign, summ, alabama.hourlyData, {
      calcHourlyEnergy: (pd, ls, w, pre) => S.calcHourlyEnergy(pd, ls, w, pre),
      onHour: (i, hr) => { if ((hr.capacityDeficitKw || 0) > 0) pureDeficitHours++; }
    });

    // 4. Run AnnualRunner for adiabatic_trim on Alabama
    du.plantDesign.cduSystem.architecture = 'adiabatic_trim';
    S.bridgeDuToPlantModel(du, summ);
    let trimDeficitHours = 0;
    let chillerHours = 0;
    let chillerKwh = 0;
    const trimSim = AnnualRunner.simulateUnit(du.plantDesign, summ, alabama.hourlyData, {
      calcHourlyEnergy: (pd, ls, w, pre) => S.calcHourlyEnergy(pd, ls, w, pre),
      onHour: (i, hr) => {
        if ((hr.capacityDeficitKw || 0) > 0) trimDeficitHours++;
        if ((hr.cduKwh?.trimLoadKw || 0) > 0 || (hr.cduKwh?.chiller || 0) > 0) {
          chillerHours++;
          chillerKwh += (hr.cduKwh?.chiller || 0);
        }
      }
    });

    assert(pureDeficitHours > 0, 'pure adiabatic tower must have deficit hours in Alabama summer at 35C FWS');
    assert.strictEqual(trimDeficitHours, 0, 'adiabatic_trim must have 0 capacity deficit hours');
    assert(chillerHours > 0, 'adiabatic_trim chiller run hours must be > 0 in Alabama');
    assert(chillerKwh > 0, 'adiabatic_trim chiller total kWh must be > 0 in Alabama');
    assert(chillerHours <= pureDeficitHours, `chiller hours (${chillerHours}) must be <= pure adiabatic deficit hours (${pureDeficitHours})`);
  });
})();

// ═══════════════════════════════════════════════════════════════
// P2-5 Residual architecture string elimination & role-driven sizing
// ═══════════════════════════════════════════════════════════════
(function () {
  const ctx = freshCtx();
  const fs = require('fs');
  const path = require('path');
  const jsDir = path.resolve(__dirname, '../../public/Data center Cal/js');

  test('P2-5 zero occurrences of arch/fwArch/cduArch string comparisons in js/', () => {
    function walk(dir) {
      let files = [];
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          files = files.concat(walk(full));
        } else if (entry.name.endsWith('.js')) {
          files.push(full);
        }
      }
      return files;
    }

    const jsFiles = walk(jsDir);
    const pattern = /(arch|fwArch|cduArch)\s*===\s*'(dry_cooler|adiabatic|cooling_tower|water_chiller|rdhx|air_cooled|water_cooled|chilled)/;
    const matches = [];

    for (const f of jsFiles) {
      const content = fs.readFileSync(f, 'utf8');
      const lines = content.split('\n');
      lines.forEach((line, idx) => {
        if (pattern.test(line)) {
          matches.push(`${path.relative(jsDir, f)}:${idx + 1}: ${line.trim()}`);
        }
      });
    }

    assert.strictEqual(matches.length, 0, `Residual arch string comparisons found:\n${matches.join('\n')}`);
  });

  test('P2-5 SizingEngine items carry role property from equipment descriptor', () => {
    const { SizingEngine, CoolingArchRegistry } = ctx;
    const archs = CoolingArchRegistry.list();
    for (const arch of archs) {
      const items = arch.loop === 'liquid'
        ? SizingEngine.generateCduSizing(arch.id, 500, 20)
        : SizingEngine.generateFwSizing(arch.id, 500, 20);
      assert(items.length > 0, `Arch ${arch.id} must generate sizing items`);
      for (const item of items) {
        assert(item.role, `Sizing item ${item.key} in ${arch.id} must have role defined`);
      }
    }
  });

  test('P2-5 dominantCduThresholds respects dominant architecture thresholds', () => {
    const S = ctx.AppStore;
    const dom = S.dominantCduThresholds();
    assert(typeof dom.thresholds.full === 'number', 'full threshold must be number');
    assert(typeof dom.thresholds.mech === 'number', 'mech threshold must be number');
  });
})();

// ═══════════════════════════════════════════════════════════════
// P2-6 CoolingArchHelpers & ASSUMPTIONS fallback COP
// ═══════════════════════════════════════════════════════════════
(function () {
  const ctx = freshCtx();
  const { CoolingArchHelpers, ASSUMPTIONS, A } = ctx;

  test('P2-6 CoolingArchHelpers is defined with required helper methods', () => {
    assert(CoolingArchHelpers, 'CoolingArchHelpers must be defined');
    assert(typeof CoolingArchHelpers.emptyHourResult === 'function', 'emptyHourResult must be function');
    assert(typeof CoolingArchHelpers.modeFromEco === 'function', 'modeFromEco must be function');
    assert(typeof CoolingArchHelpers.isFullFc === 'function', 'isFullFc must be function');
    assert(typeof CoolingArchHelpers.chillerFallbackCop === 'function', 'chillerFallbackCop must be function');
  });

  test('P2-6 emptyHourResult returns standardized zeroed result contract', () => {
    const res1 = CoolingArchHelpers.emptyHourResult();
    assert.strictEqual(res1.pumpKw, 0);
    assert.strictEqual(res1.fanKw, 0);
    assert.strictEqual(res1.compressorKw, 0);
    assert.strictEqual(res1.waterM3, 0);
    assert.strictEqual(res1.deficitKw, 0);
    assert.strictEqual(res1.heatRemovedKw, 0);
    assert.strictEqual(res1.mechLoadKw, 0);
    assert.strictEqual(res1.mode, 'free');

    const res2 = CoolingArchHelpers.emptyHourResult('mechanical');
    assert.strictEqual(res2.mode, 'mechanical');
  });

  test('P2-6 modeFromEco correctly determines free, partial, and mechanical modes', () => {
    assert.strictEqual(CoolingArchHelpers.modeFromEco({ mode: 'FULL_FC', chiller_fraction: 0 }), 'free');
    assert.strictEqual(CoolingArchHelpers.modeFromEco({ mode: 'full_fc', chiller_fraction: 0 }), 'free');
    assert.strictEqual(CoolingArchHelpers.modeFromEco({ fc_fraction: 1.0, chiller_fraction: 0 }), 'free');
    assert.strictEqual(CoolingArchHelpers.modeFromEco({ mode: 'PARTIAL_FC', chiller_fraction: 0.3 }), 'partial');
    assert.strictEqual(CoolingArchHelpers.modeFromEco({ mode: 'MECH', chiller_fraction: 1.0 }), 'mechanical');
    assert.strictEqual(CoolingArchHelpers.modeFromEco(null), 'free');
  });

  test('P2-6 chillerFallbackCop reads 3-tier values from ASSUMPTIONS', () => {
    assert(ASSUMPTIONS.chiller_fallback_cop_chw_ge20, 'ASSUMPTIONS must define chiller_fallback_cop_chw_ge20');
    assert(ASSUMPTIONS.chiller_fallback_cop_chw_ge12, 'ASSUMPTIONS must define chiller_fallback_cop_chw_ge12');
    assert(ASSUMPTIONS.chiller_fallback_cop_chw_lt12, 'ASSUMPTIONS must define chiller_fallback_cop_chw_lt12');

    assert.strictEqual(A('chiller_fallback_cop_chw_ge20'), 5.8);
    assert.strictEqual(A('chiller_fallback_cop_chw_ge12'), 4.2);
    assert.strictEqual(A('chiller_fallback_cop_chw_lt12'), 3.0);

    assert.strictEqual(CoolingArchHelpers.chillerFallbackCop(22.0), 5.8);
    assert.strictEqual(CoolingArchHelpers.chillerFallbackCop(20.0), 5.8);
    assert.strictEqual(CoolingArchHelpers.chillerFallbackCop(15.0), 4.2);
    assert.strictEqual(CoolingArchHelpers.chillerFallbackCop(12.0), 4.2);
    assert.strictEqual(CoolingArchHelpers.chillerFallbackCop(10.0), 3.0);
    assert.strictEqual(CoolingArchHelpers.chillerFallbackCop(7.0), 3.0);
  });
})();

// ═══════════════════════════════════════════════════════════════
// P3-1 Architecture OperatingPoint & Topology Data Models
// ═══════════════════════════════════════════════════════════════
(function () {
  const ctx = freshCtx();
  const { CoolingArchRegistry } = ctx;

  const archIds = [
    'dry_cooler_trim',
    'dry_cooler_pure',
    'adiabatic_tower',
    'cooling_tower_hx',
    'water_chiller',
    'air_cooled_chiller',
    'water_cooled_chiller',
    'chilled_water_plant',
    'rdhx'
  ];

  test('P3-1 all 9 architectures implement operatingPoint and topology methods', () => {
    for (const id of archIds) {
      const arch = CoolingArchRegistry.get(id);
      assert(arch, `Architecture ${id} must be registered`);
      assert.strictEqual(typeof arch.operatingPoint, 'function', `${id} must implement operatingPoint(sys, w, equip)`);
      assert.strictEqual(typeof arch.topology, 'function', `${id} must implement topology(sys, op, design)`);
    }
  });

  test('P3-1 operatingPoint returns conforming OperatingPoint contract across all 9 archs', () => {
    for (const id of archIds) {
      const arch = CoolingArchRegistry.get(id);
      const isLiquid = arch.loop === 'liquid';
      const sys = isLiquid
        ? { fwsSupplyC: 40, fwsReturnC: 55, secSupplyC: 45, secReturnC: 57, dryCoolerApproachC: 5.0, pheApproachC: 2.0, ctApproachC: 6.0 }
        : { chwSupplyC: 12, chwReturnC: 18, secSupplyC: 45, secReturnC: 57 };
      const op = arch.operatingPoint(sys, { db: 30, wb: 25 }, {});
      assert(op, `${id} operatingPoint must return an object`);
      assert(['free', 'partial', 'mechanical'].includes(op.mode), `${id} op.mode must be free/partial/mechanical, got: ${op.mode}`);
      assert(typeof op.fc_fraction === 'number' && op.fc_fraction >= 0 && op.fc_fraction <= 1, `${id} op.fc_fraction must be in [0, 1]`);
      assert(typeof op.chiller_fraction === 'number' && op.chiller_fraction >= 0 && op.chiller_fraction <= 1, `${id} op.chiller_fraction must be in [0, 1]`);
      assert(op.temps && typeof op.temps === 'object', `${id} op.temps must be an object`);
      assert(Object.values(op.temps).every(v => typeof v === 'number' && !isNaN(v)), `${id} op.temps values must be numbers`);
      assert(op.thresholds && typeof op.thresholds === 'object', `${id} op.thresholds must be an object`);
      assert(['db', 'wb', 'db_eff', 'none'].includes(op.thresholds.basis), `${id} thresholds.basis invalid: ${op.thresholds.basis}`);
    }
  });

  test('P3-1 topology returns conforming TopologyModel contract across all 9 archs', () => {
    for (const id of archIds) {
      const arch = CoolingArchRegistry.get(id);
      const isLiquid = arch.loop === 'liquid';
      const sys = isLiquid
        ? { fwsSupplyC: 40, fwsReturnC: 55, secSupplyC: 45, secReturnC: 57, dryCoolerApproachC: 5.0, pheApproachC: 2.0, ctApproachC: 6.0 }
        : { chwSupplyC: 12, chwReturnC: 18, secSupplyC: 45, secReturnC: 57 };
      const op = arch.operatingPoint(sys, { db: 30, wb: 25 }, {});
      const topo = arch.topology(sys, op, { designDb: 35, designWb: 28 });
      assert(topo, `${id} topology must return an object`);
      assert(typeof topo.title === 'string' && topo.title.length > 0, `${id} topo.title must be a non-empty string`);
      assert(Array.isArray(topo.banners) && topo.banners.length >= 1, `${id} topo.banners must have at least 1 banner`);
      assert(topo.banners.every(b => b.id && b.label), `${id} all banners must have id and label`);
      assert(Array.isArray(topo.nodes) && topo.nodes.length >= 1, `${id} topo.nodes must have nodes`);
      assert(topo.nodes.every(n => n.id && n.kind && n.title), `${id} all nodes must have id, kind, title`);
      assert(Array.isArray(topo.pipes) && topo.pipes.length >= 1, `${id} topo.pipes must have pipes`);
      assert(topo.pipes.every(p => p.from && p.to && p.label), `${id} all pipes must have from, to, label`);
    }
  });

  test('P3-1 simulateHour returns op OperatingPoint on result contract for non-zero load', () => {
    for (const id of archIds) {
      const arch = CoolingArchRegistry.get(id);
      const isLiquid = arch.loop === 'liquid';
      const sys = isLiquid
        ? { fwsSupplyC: 40, fwsReturnC: 55, secSupplyC: 45, secReturnC: 57, dryCoolerApproachC: 5.0, pheApproachC: 2.0, ctApproachC: 6.0 }
        : { chwSupplyC: 12, chwReturnC: 18, secSupplyC: 45, secReturnC: 57 };
      const sim = arch.simulateHour({
        Q_kw: 100,
        sys,
        w: { db: 28, wb: 22 },
        t_supply_c: isLiquid ? 40 : 12,
        t_return_c: isLiquid ? 55 : 18,
        equip: {}
      });
      assert(sim, `${id} simulateHour must return result`);
      assert(sim.op, `${id} simulateHour result must contain op OperatingPoint`);
      assert(['free', 'partial', 'mechanical'].includes(sim.op.mode), `${id} sim.op.mode invalid: ${sim.op.mode}`);
      assert.strictEqual(sim.mode, sim.op.mode, `${id} sim.mode must match sim.op.mode`);
    }
  });
})();

// ═══════════════════════════════════════════════════════════════
// P4-1 Trim Topology & Mode Banners (T-1) & cduModeHours
// ═══════════════════════════════════════════════════════════════
(function () {
  const ctx = freshCtx();
  const { AppStore: S, CoolingArchRegistry, ASSUMPTIONS, AnnualRunner } = ctx;

  test('P4-1 trim_chw_dt_default_c exists in ASSUMPTIONS with val 5.0', () => {
    assert(ASSUMPTIONS.trim_chw_dt_default_c, 'trim_chw_dt_default_c must exist in ASSUMPTIONS');
    assert.strictEqual(ASSUMPTIONS.trim_chw_dt_default_c.val, 5.0);
  });

  test('P4-1 liquid_dry_cooler_trim thresholds use physical FWS supply and return boundaries', () => {
    const arch = CoolingArchRegistry.get('dry_cooler_trim');
    const sys = { fwsSupplyC: 40.0, fwsReturnC: 55.0, dryCoolerApproachC: 5.0, pheApproachC: 2.0, trimChwDtC: 5.0 };
    const op = arch.operatingPoint(sys, { db: 35, wb: 25 }, {});
    assert.strictEqual(op.thresholds.basis, 'db');
    assert.strictEqual(op.thresholds.full, 33.0, 'full threshold must be 40 - 5 - 2 = 33.0');
    assert.strictEqual(op.thresholds.mech, 48.0, 'mech threshold must be 55 - 5 - 2 = 48.0');
    assert.strictEqual(op.temps.chwRet, op.temps.chwSup + 5.0, 'chwRet must be chwSup + trimChwDtC');
  });

  test('P4-1 AnnualRunner records cduModeHours on unit results and formats in byDu', () => {
    S.calculate();
    const du0 = S.state.results.byDu?.[0];
    assert(du0, 'byDu[0] must exist');
    assert(du0.cduModeHours, 'du0 must have cduModeHours');
    assert(typeof du0.cduModeHours.free === 'number');
    assert(typeof du0.cduModeHours.partial === 'number');
    assert(typeof du0.cduModeHours.mechanical === 'number');
    const totalHours = du0.cduModeHours.free + du0.cduModeHours.partial + du0.cduModeHours.mechanical;
    assert.strictEqual(totalHours, 8760, 'total cduModeHours must sum to 8760');
  });

  test('P4-1 liquid_dry_cooler_trim topology formats 3-stage banners with cduModeHours', () => {
    const arch = CoolingArchRegistry.get('dry_cooler_trim');
    const sys = { fwsSupplyC: 40.0, fwsReturnC: 55.0, dryCoolerApproachC: 5.0, pheApproachC: 2.0 };
    const op = arch.operatingPoint(sys, { db: 35, wb: 25 }, {});
    const topo = arch.topology(sys, op, { designDb: 35, designWb: 28, maxDb: 38, cduModeHours: { free: 8000, partial: 700, mechanical: 60 } });
    assert.strictEqual(topo.banners.length, 3, 'must have 3 mode banners');
    assert(topo.banners[0].label.includes('Mode 1') && topo.banners[0].label.includes('8000 h'), 'banner 1 must include Mode 1 and hours');
    assert(topo.banners[1].label.includes('Mode 2') && topo.banners[1].label.includes('700 h'), 'banner 2 must include Mode 2 and hours');
    assert(topo.banners[2].label.includes('Mode 3') && topo.banners[2].label.includes('60 h'), 'banner 3 must include Mode 3 and hours');
  });
})();

// ═══════════════════════════════════════════════════════════════
// P4-2 PHE Consistency & Topology Rules (T-2)
// ═══════════════════════════════════════════════════════════════
(function () {
  const ctx = freshCtx();
  const { AppStore: S, CoolingArchRegistry, CoolingSchematics } = ctx;

  test('P4-2 dry_cooler_pure and adiabatic_tower define hasPhe=true and pheApproachC=2.0 by default', () => {
    const dcArch = CoolingArchRegistry.get('dry_cooler_pure');
    const atArch = CoolingArchRegistry.get('adiabatic_tower');

    const dcHasPhe = dcArch.params.find(p => p.key === 'hasPhe');
    assert(dcHasPhe, 'dry_cooler_pure must have hasPhe param');
    assert.strictEqual(dcHasPhe.default, true, 'dry_cooler_pure hasPhe default must be true');

    const dcPheApp = dcArch.params.find(p => p.key === 'pheApproachC');
    assert(dcPheApp, 'dry_cooler_pure must have pheApproachC param');
    assert.strictEqual(dcPheApp.default, 2.0, 'dry_cooler_pure pheApproachC default must be 2.0');

    const atHasPhe = atArch.params.find(p => p.key === 'hasPhe');
    assert(atHasPhe, 'adiabatic_tower must have hasPhe param');
    assert.strictEqual(atHasPhe.default, true, 'adiabatic_tower hasPhe default must be true');

    const atPheApp = atArch.params.find(p => p.key === 'pheApproachC');
    assert(atPheApp, 'adiabatic_tower must have pheApproachC param');
    assert.strictEqual(atPheApp.default, 2.0, 'adiabatic_tower pheApproachC default must be 2.0');
  });

  test('P4-2 dry_cooler_pure threshold and topology change with hasPhe toggle', () => {
    const arch = CoolingArchRegistry.get('dry_cooler_pure');
    const sysWithPhe = { fwsSupplyC: 40.0, fwsReturnC: 55.0, dryCoolerApproachC: 5.0, hasPhe: true, pheApproachC: 2.0 };
    const opWith = arch.operatingPoint(sysWithPhe, { db: 30 }, {});
    assert.strictEqual(opWith.thresholds.full, 33.0, 'threshold must subtract pheApproach: 40 - 5 - 2 = 33');
    const topoWith = arch.topology(sysWithPhe, opWith, {});
    assert(topoWith.nodes.some(n => n.id === 'hx'), 'topology must include PHE node when hasPhe=true');
    assert(topoWith.nodes.some(n => n.title?.includes('Glycol Pump') || n.lines?.some(l => l.includes('乙二醇'))), 'outdoor pump must be Glycol Pump');

    const sysWithoutPhe = { fwsSupplyC: 40.0, fwsReturnC: 55.0, dryCoolerApproachC: 5.0, hasPhe: false, pheApproachC: 2.0 };
    const opWithout = arch.operatingPoint(sysWithoutPhe, { db: 30 }, {});
    assert.strictEqual(opWithout.thresholds.full, 35.0, 'threshold without PHE: 40 - 5 = 35');
    const topoWithout = arch.topology(sysWithoutPhe, opWithout, {});
    assert(!topoWithout.nodes.some(n => n.id === 'hx'), 'topology must NOT include PHE node when hasPhe=false');
    assert(!topoWithout.nodes.some(n => n.id === 'pump_outdoor'), 'topology must NOT include outdoor pump when hasPhe=false');
  });

  test('P4-2 adiabatic_tower topology names Coil Pump and separates spray pump from process loop', () => {
    const arch = CoolingArchRegistry.get('adiabatic_tower');
    const sys = { fwsSupplyC: 40.0, fwsReturnC: 55.0, dryCoolerApproachC: 5.0, hasPhe: true, pheApproachC: 2.0 };
    const op = arch.operatingPoint(sys, { db: 30, wb: 22 }, {});
    const topo = arch.topology(sys, op, {});
    const outdoorPump = topo.nodes.find(n => n.id === 'pump_outdoor');
    assert(outdoorPump, 'must have outdoor pump when hasPhe=true');
    assert(outdoorPump.title?.includes('Coil Pump') || outdoorPump.lines?.some(l => l.includes('盤管循環泵')), 'pump must be named Coil Pump');
    const towerNode = topo.nodes.find(n => n.kind === 'adiabatic');
    assert(towerNode, 'must have adiabatic tower node');
    assert(towerNode.lines?.some(l => l.includes('噴淋水泵') || l.includes('噴霧')), 'spray pump must be on tower body, not process loop');
  });

  test('P4-2 cooling_tower_hx hasPhe defaults to false and topology connects directly without separate Closed Coil box', () => {
    const arch = CoolingArchRegistry.get('cooling_tower_hx');
    const hasPheParam = arch.params.find(p => p.key === 'hasPhe');
    assert(hasPheParam, 'cooling_tower_hx must define hasPhe');
    assert.strictEqual(hasPheParam.default, false, 'cooling_tower_hx hasPhe default must be false');

    const sys = { fwsSupplyC: 40.0, fwsReturnC: 55.0, ctApproachC: 6.0 };
    const op = arch.operatingPoint(sys, { wb: 22 }, {});
    assert.strictEqual(op.thresholds.full, 34.0, 'threshold must be 40 - 6 = 34');
    const topo = arch.topology(sys, op, {});
    assert(!topo.nodes.some(n => n.id === 'hx'), 'must NOT have separate Closed Coil / PHE box');
    assert(!topo.nodes.some(n => n.id === 'pump_outdoor'), 'must NOT have second outdoor pump');
    assert(topo.nodes.some(n => n.id === 'heat_rejection' && n.kind === 'tower'), 'must connect to closed cooling tower directly');
  });

  test('P4-2 water_chiller hasPhe defaults to false, t_chws respects hasPhe, and topology includes condenser circuit with cooling tower', () => {
    const arch = CoolingArchRegistry.get('water_chiller');
    const hasPheParam = arch.params.find(p => p.key === 'hasPhe');
    assert(hasPheParam, 'water_chiller must define hasPhe');
    assert.strictEqual(hasPheParam.default, false, 'water_chiller hasPhe default must be false');

    // Default without PHE
    const sys = { fwsSupplyC: 40.0, fwsReturnC: 55.0, hasPhe: false, pheApproachC: 2.0 };
    const op = arch.operatingPoint(sys, { wb: 28 }, {});
    assert.strictEqual(op.tChws, 40.0, 'tChws must equal fwsSupplyC when hasPhe=false');
    assert.strictEqual(op.temps.condIn, 32.0, 'condIn must be max(16, 28 + 4) = 32.0');
    assert.strictEqual(op.temps.condOut, 37.0, 'condOut must be 32 + 5 = 37.0');

    const topo = arch.topology(sys, op, {});
    assert(topo.nodes.some(n => n.id === 'chiller'), 'must have chiller node');
    assert(topo.nodes.some(n => n.id === 'heat_rejection' && n.kind === 'tower'), 'must have open cooling tower node');
    assert(topo.nodes.some(n => n.id === 'pump_outdoor' && (n.title?.includes('CW') || n.lines?.some(l => l.includes('冷卻水泵')))), 'must have CW pump');

    // With PHE
    const sysWith = { fwsSupplyC: 40.0, fwsReturnC: 55.0, hasPhe: true, pheApproachC: 2.0 };
    const opWith = arch.operatingPoint(sysWith, { wb: 28 }, {});
    assert.strictEqual(opWith.tChws, 38.0, 'tChws must be 40 - 2 = 38.0 when hasPhe=true');
  });

  test('P4-2 migrateProject backfills hasPhe according to architecture defaults', () => {
    const rawData = {
      halls: [{
        dus: [
          { plantDesign: { cduSystem: { architecture: 'dry_cooler_pure' } } },
          { plantDesign: { cduSystem: { architecture: 'adiabatic_tower' } } },
          { plantDesign: { cduSystem: { architecture: 'cooling_tower_hx' } } },
          { plantDesign: { cduSystem: { architecture: 'water_chiller' } } }
        ]
      }],
      corePods: []
    };
    const migrated = S.migrateProject(rawData);
    const dus = migrated.halls[0].dus;
    assert.strictEqual(dus[0].plantDesign.cduSystem.hasPhe, true, 'dry_cooler_pure must backfill hasPhe=true');
    assert.strictEqual(dus[1].plantDesign.cduSystem.hasPhe, true, 'adiabatic_tower must backfill hasPhe=true');
    assert.strictEqual(dus[2].plantDesign.cduSystem.hasPhe, false, 'cooling_tower_hx must backfill hasPhe=false');
    assert.strictEqual(dus[3].plantDesign.cduSystem.hasPhe, false, 'water_chiller must backfill hasPhe=false');
  });
})();

// ═══════════════════════════════════════════════════════════════
// P4-3 Schematic Threshold Dynamic Basis, D5 Warning, and Text Fit
// ═══════════════════════════════════════════════════════════════
(function () {
  const fs = require('fs');
  const path = require('path');
  const vm = require('vm');
  const JS_DIR = path.resolve(__dirname, '../../public/Data center Cal/js');
  const ctx = freshCtx();
  const Registry = ctx.CoolingArchRegistry;

  // Load schematics into context
  const schematicFiles = [
    'views/schematics/schematic_single_loop.js',
    'views/schematics/schematic_series_trim.js',
    'views/schematics/schematic_air_plant.js'
  ];
  for (const f of schematicFiles) {
    const code = fs.readFileSync(path.join(JS_DIR, f), 'utf8');
    vm.runInContext(code, ctx);
  }
  const Schematics = ctx.CoolingSchematics;

  // 1. Titles & Reference labels
  test('P4-3 dry_cooler_trim has NVIDIA DSX title, others have standard facility title with no referenceLabel', () => {
    const trim = Registry.get('dry_cooler_trim');
    const pure = Registry.get('dry_cooler_pure');
    const closed = Registry.get('cooling_tower_hx');
    const adiabatic = Registry.get('adiabatic_tower');
    const chiller = Registry.get('water_chiller');

    const opTrim = trim.operatingPoint({ fwsSupplyC: 40, fwsReturnC: 55 }, { db: 30, wb: 25 }, {});
    const topoTrim = trim.topology({ fwsSupplyC: 40, fwsReturnC: 55 }, opTrim, {});
    assert.strictEqual(topoTrim.title, 'NVIDIA DSX 參考拓樸');
    assert.strictEqual(topoTrim.referenceLabel, 'NVIDIA Reference Schematic');

    for (const [id, arch] of [['dry_cooler_pure', pure], ['cooling_tower_hx', closed], ['adiabatic_tower', adiabatic], ['water_chiller', chiller]]) {
      const op = arch.operatingPoint({ fwsSupplyC: 40, fwsReturnC: 55 }, { db: 30, wb: 25 }, {});
      const topo = arch.topology({ fwsSupplyC: 40, fwsReturnC: 55 }, op, {});
      assert.strictEqual(topo.title, '設施排熱拓樸 (Facility Heat Rejection)', `${id} title must be '設施排熱拓樸 (Facility Heat Rejection)'`);
      assert.strictEqual(topo.referenceLabel, null, `${id} referenceLabel must be null`);
    }
  });

  // 2. Dynamic thresholds rendered by schematic_single_loop
  test('P4-3 schematic_single_loop displays dynamic natural cooling thresholds based on op.thresholds.basis', () => {
    // A: dry cooler (basis: db) -> "自然冷卻門檻: DB ≤"
    const svgDc = Schematics.render('single_loop', {
      cduSys: { architecture: 'dry_cooler_pure', fwsSupplyC: 40, fwsReturnC: 55, dryCoolerApproachC: 5, hasPhe: true, pheApproachC: 2 }
    });
    assert(svgDc.includes('自然冷卻門檻: <strong class="text-emerald-300">DB ≤ 33°C</strong>'), 'dry cooler must show DB threshold');

    // B: closed cooling tower (basis: wb) -> "自然冷卻門檻: WB ≤"
    const svgClosed = Schematics.render('single_loop', {
      cduSys: { architecture: 'cooling_tower_hx', fwsSupplyC: 40, fwsReturnC: 55, ctApproachC: 6, hasPhe: false }
    });
    assert(svgClosed.includes('自然冷卻門檻: <strong class="text-cyan-300">WB ≤ 34°C</strong>'), 'closed tower must show WB threshold');

    // C: adiabatic tower (basis: db_eff) -> "自然冷卻門檻: 乾式 DB ≤ ... ／ 噴霧後有效乾球 ≤ ..."
    const svgAd = Schematics.render('single_loop', {
      cduSys: { architecture: 'adiabatic_tower', fwsSupplyC: 40, fwsReturnC: 55, dryCoolerApproachC: 5, hasPhe: true, pheApproachC: 2, adiabaticDrySwitchpointC: 30 }
    });
    assert(svgAd.includes('自然冷卻門檻: <strong class="text-emerald-300">乾式 DB ≤ 30°C ／ 噴霧後有效乾球 ≤ 33°C</strong>'), 'adiabatic tower must show dry switchpoint and effective DB');

    // D: water chiller (basis: none) -> "冷卻模式: 無自然冷卻（全年機械製冷）"
    const svgChiller = Schematics.render('single_loop', {
      cduSys: { architecture: 'water_chiller', fwsSupplyC: 40, fwsReturnC: 55, ctApproachC: 4, hasPhe: false }
    });
    assert(svgChiller.includes('冷卻模式: <strong class="text-amber-300">無自然冷卻（全年機械製冷）</strong>'), 'water chiller must indicate no free cooling');
  });

  // 3. Water chiller D5 warning when designWb + towerApp + pheApp < fwsSupplyC
  test('P4-3 water_chiller produces D5 warning and schematic renders warning banner when free cooling potential exists', () => {
    const arch = Registry.get('water_chiller');
    // fwsSupplyC = 40, designWb = 28, ctApproachC = 4, hasPhe = false -> 28 + 4 = 32 < 40 -> potential exists!
    const sys = { architecture: 'water_chiller', fwsSupplyC: 40, fwsReturnC: 55, ctApproachC: 4, hasPhe: false };
    const op = arch.operatingPoint(sys, { wb: 28 }, {});
    const topo = arch.topology(sys, op, { designDb: 35, designWb: 28 });
    assert(topo.warnings && topo.warnings.length > 0, 'must have warning when designWb + towerApp < fwsSupplyC');
    assert(topo.warnings.some(w => w.includes('冷卻水塔具備自然供冷潛力；建議改用閉式塔或加裝水側經濟器')), 'warning text must recommend closed tower or WSE');

    const svg = Schematics.render('single_loop', { cduSys: sys });
    assert(svg.includes('⚠️ 建議改用閉式塔或加裝水側經濟器'), 'schematic must render warning in summary or banner');
    assert(svg.includes('自然供冷潛力'), 'schematic must render warning banner');
  });

  // 4. SVG textLength overflow protection (fitTextAttr)
  test('P4-3 fitTextAttr adds textLength and lengthAdjust only when text width exceeds container boundary', () => {
    const svg = Schematics.render('single_loop', {
      cduSys: {
        architecture: 'dry_cooler_pure',
        fwsSupplyC: 40,
        fwsReturnC: 55,
        dryCoolerApproachC: 5,
        hasPhe: true,
        pheApproachC: 2
      }
    });
    assert(svg.includes('lengthAdjust="spacingAndGlyphs"'), 'schematic must contain lengthAdjust for fitted text');
  });
})();

// ═══════════════════════════════════════════════════════════════
// P4-4 K-3 Adiabatic Tower Demand-Driven Switchpoint
// ═══════════════════════════════════════════════════════════════
(function () {
  const ctx = freshCtx();
  const { AppStore: S, CoolingArchRegistry, CoolingStages, ASSUMPTIONS, AnnualRunner } = ctx;

  test('P4-4 ASSUMPTIONS.adiabatic_switchpoint_offset_c is retained with reference label', () => {
    assert(ASSUMPTIONS.adiabatic_switchpoint_offset_c, 'adiabatic_switchpoint_offset_c must exist');
    assert.strictEqual(ASSUMPTIONS.adiabatic_switchpoint_offset_c.val, 9.2);
    assert(ASSUMPTIONS.adiabatic_switchpoint_offset_c.label.includes('依需求切換'), 'label must indicate demand-driven switchpoint');
  });

  test('P4-4 liquid_adiabatic_tower operatingPoint defaults switchpoint = FWS - dcApp - (hasPhe ? pheApp : 0)', () => {
    const arch = CoolingArchRegistry.get('adiabatic_tower');

    // Case 1: with PHE (default) -> 40 - 5 - 2 = 33
    const sysWithPhe = { fwsSupplyC: 40.0, fwsReturnC: 55.0, dryCoolerApproachC: 5.0, hasPhe: true, pheApproachC: 2.0 };
    const opWith = arch.operatingPoint(sysWithPhe, { db: 30, wb: 22 }, {});
    assert.strictEqual(opWith.drySwitchpoint, 33.0, 'switchpoint with PHE must be 40 - 5 - 2 = 33.0');
    assert.strictEqual(opWith.thresholds.switchpoint, 33.0);
    assert.strictEqual(opWith.thresholds.full, 33.0);

    // Case 2: without PHE -> 40 - 5 = 35
    const sysWithoutPhe = { fwsSupplyC: 40.0, fwsReturnC: 55.0, dryCoolerApproachC: 5.0, hasPhe: false, pheApproachC: 2.0 };
    const opWithout = arch.operatingPoint(sysWithoutPhe, { db: 30, wb: 22 }, {});
    assert.strictEqual(opWithout.drySwitchpoint, 35.0, 'switchpoint without PHE must be 40 - 5 = 35.0');
    assert.strictEqual(opWithout.thresholds.switchpoint, 35.0);

    // Case 3: manual override -> overrides formula
    const sysOverride = { fwsSupplyC: 40.0, fwsReturnC: 55.0, dryCoolerApproachC: 5.0, hasPhe: true, pheApproachC: 2.0, adiabaticDrySwitchpointC: 31.5 };
    const opOverride = arch.operatingPoint(sysOverride, { db: 30, wb: 22 }, {});
    assert.strictEqual(opOverride.drySwitchpoint, 31.5, 'manual override must be used');
    assert.strictEqual(opOverride.thresholds.switchpoint, 31.5);
  });

  test('P4-4 stage_adiabatic respects demand-driven drySwitchpoint in dry vs wet modes', () => {
    const stage = CoolingStages.get('adiabatic');
    const sys = { fwsSupplyC: 40.0, fwsReturnC: 55.0, dryCoolerApproachC: 5.0, hasPhe: true, pheApproachC: 2.0, adiabaticSaturationEfficiencyPct: 85 };

    // At DB=32 <= 33 (dry mode): no water consumed, effectiveDb = db
    const wDry = { db: 32.0, wb: 24.0 };
    const costDry = stage.rejectionCost({ sys, w: wDry, t_supply_c: 40.0, hasPhe: true, hx_approach_c: 2.0 }, 1000, true);
    assert.strictEqual(costDry.waterM3, 0, 'dry mode must consume 0 water');
    assert.strictEqual(costDry.diag.isDry, true);
    assert.strictEqual(costDry.diag.drySwitchpoint, 33.0);
    const tAvailDry = stage.availableTemp({ sys, w: wDry, t_supply_c: 40.0, hasPhe: true, hx_approach_c: 2.0 });
    assert.strictEqual(tAvailDry, 32.0 + 5.0, 'dry mode availableTemp = db + approach');

    // At DB=34 > 33 (wet mode): spray turns on, water consumed, effectiveDb < db
    const wWet = { db: 34.0, wb: 24.0 };
    const costWet = stage.rejectionCost({ sys, w: wWet, t_supply_c: 40.0, hasPhe: true, hx_approach_c: 2.0 }, 1000, true);
    assert(costWet.waterM3 > 0, 'wet mode must consume water');
    assert.strictEqual(costWet.diag.isDry, false);
    const tAvailWet = stage.availableTemp({ sys, w: wWet, t_supply_c: 40.0, hasPhe: true, hx_approach_c: 2.0 });
    const expectedEffDb = 34.0 - (34.0 - 24.0) * 0.85; // 25.5
    assert(Math.abs(tAvailWet - (expectedEffDb + 5.0)) < 1e-6, `availableTemp should use effectiveDb (${expectedEffDb + 5.0}), got ${tAvailWet}`);
  });

  test('P4-4 demand-driven switchpoint reduces annual water consumption vs old fixed 9.2 offset', () => {
    const kaohsiung = ctx.BUILTIN_WEATHER_DATA['高雄 (Kaohsiung)'];
    S.state.site.hourly = kaohsiung.hourlyData;
    const du = S.state.halls[0].dus[0];
    du.plantDesign.cduSystem.architecture = 'adiabatic_tower';
    du.plantDesign.cduSystem.fwsSupplyC = 40.0;
    du.plantDesign.cduSystem.fwsReturnC = 55.0;
    du.plantDesign.cduSystem.dryCoolerApproachC = 5.0;
    du.plantDesign.cduSystem.hasPhe = true;
    du.plantDesign.cduSystem.pheApproachC = 2.0;

    // Run A: with new demand-driven switchpoint (40 - 5 - 2 = 33°C)
    delete du.plantDesign.cduSystem.adiabaticDrySwitchpointC;
    S.calculate();
    const waterDemandDriven = S.state.results.overall.annualWaterM3;
    const pueDemandDriven = S.state.results.overall.annualPue;

    // Run B: simulating old 9.2°C offset (40 - 9.2 = 30.8°C)
    du.plantDesign.cduSystem.adiabaticDrySwitchpointC = 30.8;
    S.calculate();
    const waterOldOffset = S.state.results.overall.annualWaterM3;
    const pueOldOffset = S.state.results.overall.annualPue;

    // Higher switchpoint (33 > 30.8) means fewer hours spraying -> less water consumed!
    assert(waterDemandDriven < waterOldOffset, `demand-driven water (${waterDemandDriven} m3) must be < old offset water (${waterOldOffset} m3)`);
    assert(pueDemandDriven <= pueOldOffset, `demand-driven PUE (${pueDemandDriven}) should be <= old offset PUE (${pueOldOffset})`);
  });
})();

// ═══════════════════════════════════════════════════════════════
// P4-5 Fanwall Topologies: FC Coil, WSE, RDHX Dew Point & District COP
// ═══════════════════════════════════════════════════════════════
(function () {
  const ctx = freshCtx();
  const { CoolingArchRegistry, SizingEngine, AppStore: S, ASSUMPTIONS, A } = ctx;

  test('P4-5 rdhx_min_chws_c exists in ASSUMPTIONS with default 17.0', () => {
    assert(ASSUMPTIONS.rdhx_min_chws_c, 'rdhx_min_chws_c must be defined in ASSUMPTIONS');
    assert.strictEqual(ASSUMPTIONS.rdhx_min_chws_c.val, 17.0);
    assert.strictEqual(A('rdhx_min_chws_c'), 17.0);
  });

  test('P4-5 air_air_cooled_chiller topology includes fc_coil node and series pre-cooling banners without continuous mechanical text', () => {
    const arch = CoolingArchRegistry.get('air_cooled_chiller');
    const sys = { chwSupplyC: 12.0, chwReturnC: 18.0 };
    const op = arch.operatingPoint(sys, { db: 30, wb: 22 }, {});
    const topo = arch.topology(sys, op, { designDb: 35.0, fwModeHours: { free: 1200, partial: 2800, mechanical: 4760 } });

    const fcNode = topo.nodes.find(n => n.id === 'fc_coil');
    assert(fcNode, 'Must contain fc_coil node');
    assert.strictEqual(fcNode.title, 'Free-Cooling 盤管 (串聯預冷)');

    const topoStr = JSON.stringify(topo);
    assert(!topoStr.includes('全時連續供冷'), 'Must not contain "全時連續供冷"');
    assert(topo.banners.some(b => b.label.includes('全自然冷卻') && b.label.includes('1200 h')), 'Banner must display free cooling hours');
    assert(topo.banners.some(b => b.label.includes('部分預冷') && b.label.includes('2800 h')), 'Banner must display partial hours');
  });

  test('P4-5 air_water_cooled_chiller topology includes wse node, cooling water temp with tower approach, and simulated COP', () => {
    const arch = CoolingArchRegistry.get('water_cooled_chiller');
    const sys = { chwSupplyC: 12.0, chwReturnC: 18.0 };
    const op = arch.operatingPoint(sys, { db: 35, wb: 28 }, {});
    const topo = arch.topology(sys, op, { designWb: 28.0, fwModeHours: { free: 500, partial: 1500, mechanical: 6760 } });

    const wseNode = topo.nodes.find(n => n.id === 'wse');
    assert(wseNode, 'Must contain wse node');
    assert.strictEqual(wseNode.title, '水側經濟器 (WSE 板式熱交換器)');

    const evapNode = topo.nodes.find(n => n.id === 'evaporator');
    assert(evapNode, 'Must contain evaporator node');
    assert(evapNode.lines.some(l => l.includes('設計 COP:')), 'Evaporator lines must show design COP');

    const rejNode = topo.nodes.find(n => n.id === 'heat_rejection');
    assert(rejNode, 'Must contain heat_rejection node');
    assert(rejNode.lines.some(l => l.includes('32') && l.includes('設計 WB 28')), 'Heat rejection must show designWb + tower approach');
  });

  test('P4-5 air_rdhx describes air-cooled chiller + FC coil and does not contain 22°C or dry cooler direct cooling', () => {
    const arch = CoolingArchRegistry.get('rdhx');
    const sys = { chwSupplyC: 18.0, chwReturnC: 24.0 };
    const op = arch.operatingPoint(sys, { db: 25, wb: 18 }, {});
    const topo = arch.topology(sys, op, { designDb: 35.0 });

    const topoStr = JSON.stringify(topo);
    assert(!topoStr.includes('22°C 高溫供水'), 'Must not contain "22°C 高溫供水"');
    assert(!topoStr.includes('乾冷器直冷'), 'Must not contain "乾冷器直冷"');

    const rdhxNode = topo.nodes.find(n => n.id === 'rdhx');
    const fcNode = topo.nodes.find(n => n.id === 'fc_coil');
    const evapNode = topo.nodes.find(n => n.id === 'evaporator');
    assert(rdhxNode && fcNode && evapNode, 'Must contain rdhx, fc_coil, and evaporator nodes');
  });

  test('P4-5 RDHX dew point check generates warning below 17°C and passes at/above 17°C', () => {
    const arch = CoolingArchRegistry.get('rdhx');
    
    // Case A: chwSupplyC = 12.0 < 17.0 -> warning in validateFw and topology
    const sysLow = { architecture: 'rdhx', chwSupplyC: 12.0, chwReturnC: 18.0, sizing: [] };
    const valLow = SizingEngine.validateFw(sysLow, { air_load_kw: 100 }, arch);
    assert(valLow.checks.some(c => c.includes('RDHX 供水低於露點保護溫度，有結露風險')), 'validateFw must warn on dew point risk');
    const topoLow = arch.topology(sysLow, arch.operatingPoint(sysLow, { db: 35, wb: 28 }, {}), { designDb: 35.0 });
    assert(topoLow.warnings.some(w => w.includes('RDHX 供水低於露點保護溫度，有結露風險')), 'topology must include dew point warning');

    // Case B: chwSupplyC = 18.0 >= 17.0 -> no dew point warning
    const sysSafe = { architecture: 'rdhx', chwSupplyC: 18.0, chwReturnC: 24.0, sizing: [] };
    const valSafe = SizingEngine.validateFw(sysSafe, { air_load_kw: 100 }, arch);
    assert(!valSafe.checks.some(c => c.includes('RDHX 供水低於露點保護溫度，有結露風險')), 'validateFw must pass dew point check');
    const topoSafe = arch.topology(sysSafe, arch.operatingPoint(sysSafe, { db: 35, wb: 28 }, {}), { designDb: 35.0 });
    assert(!topoSafe.warnings.some(w => w.includes('RDHX 供水低於露點保護溫度，有結露風險')), 'topology must not have dew point warning');
  });

  test('P4-5 air_district_chw topology displays A(district_chw_cop)', () => {
    const arch = CoolingArchRegistry.get('chilled_water_plant');
    const sys = { chwSupplyC: 12.0, chwReturnC: 18.0 };
    const topo = arch.topology(sys, arch.operatingPoint(sys, { db: 35, wb: 28 }, {}), { designDb: 35.0 });
    const distCop = A('district_chw_cop');
    const rejNode = topo.nodes.find(n => n.id === 'heat_rejection');
    assert(rejNode, 'Must contain heat_rejection node');
    assert(rejNode.lines.some(l => l.includes(`合約等效 COP: ${distCop.toFixed(1)}`)), 'Heat rejection lines must display district COP');
  });

  test('P4-5 AnnualRunner tracks fwModeHours for air loop systems', () => {
    const kaohsiung = ctx.BUILTIN_WEATHER_DATA['高雄 (Kaohsiung)'];
    S.state.site.hourly = kaohsiung.hourlyData;
    const du = S.state.halls[0].dus[0];
    du.plantDesign.fanwallSystem.architecture = 'air_cooled_chiller';
    du.plantDesign.fanwallSystem.chwSupplyC = 12.0;
    du.plantDesign.fanwallSystem.chwReturnC = 18.0;
    S.calculate();

    const du0 = S.state.results.byDu?.[0];
    assert(du0, 'byDu[0] must exist');
    assert(du0.fwModeHours, 'du0 must have fwModeHours');
    const { free, partial, mechanical } = du0.fwModeHours;
    assert.strictEqual(free + partial + mechanical, 8760, 'fwModeHours sum must equal 8760');
  });
})();

// ═══════════════════════════════════════════════════════════════
// P4-6 Water Chiller Free Cooling Potential Sizing Warning in validateCdu
// ═══════════════════════════════════════════════════════════════
(function () {
  const ctx = freshCtx();
  const { CoolingArchRegistry, SizingEngine, AppStore: S } = ctx;

  test('P4-6 SizingEngine.validateCdu warns when designWb + towerApp (+ pheApp) < fwsSupplyC for water_chiller', () => {
    const arch = CoolingArchRegistry.get('water_chiller');
    
    // Case 1: Without PHE: designWb (28) + towerApp (4) = 32°C < fwsSupplyC (40°C) -> warning
    const cduSys1 = {
      architecture: 'water_chiller',
      fwsSupplyC: 40.0,
      hasPhe: false,
      sizing: [
        { passed: true, effectiveCapKw: 1000, label: 'CDU' },
        { passed: true, effectiveCapKw: 1000, label: 'Chiller' }
      ]
    };
    const val1 = SizingEngine.validateCdu(cduSys1, 1.8, { designWb: 28.0 }, arch);
    assert(val1.checks.some(c => c.includes('設計濕球 + 塔 approach 已低於 FWS 供水溫，冷卻水塔可直接供冷；建議改用閉式塔或加裝水側經濟器')), 'Must warn when free cooling potential exists without PHE');

    // Case 2: With PHE: designWb (28) + towerApp (4) + pheApp (2) = 34°C < fwsSupplyC (40°C) -> warning
    const cduSys2 = {
      architecture: 'water_chiller',
      fwsSupplyC: 40.0,
      hasPhe: true,
      pheApproachC: 2.0,
      sizing: [
        { passed: true, effectiveCapKw: 1000, label: 'CDU' },
        { passed: true, effectiveCapKw: 1000, label: 'Chiller' }
      ]
    };
    const val2 = SizingEngine.validateCdu(cduSys2, 1.8, { designWb: 28.0 }, arch);
    assert(val2.checks.some(c => c.includes('設計濕球 + 塔 approach 已低於 FWS 供水溫，冷卻水塔可直接供冷；建議改用閉式塔或加裝水側經濟器')), 'Must warn when free cooling potential exists with PHE');

    // Case 3: High wet bulb or low FWS: designWb (32) + towerApp (4) + pheApp (2) = 38°C >= fwsSupplyC (35°C) -> no warning
    const cduSys3 = {
      architecture: 'water_chiller',
      fwsSupplyC: 35.0,
      hasPhe: true,
      pheApproachC: 2.0,
      sizing: [
        { passed: true, effectiveCapKw: 1000, label: 'CDU' },
        { passed: true, effectiveCapKw: 1000, label: 'Chiller' }
      ]
    };
    const val3 = SizingEngine.validateCdu(cduSys3, 1.8, { designWb: 32.0 }, arch);
    assert(!val3.checks.some(c => c.includes('冷卻水塔可直接供冷')), 'Must NOT warn when free cooling cannot reach FWS supply');

    // Case 4: Other architecture (e.g. dry_cooler_trim) -> no warning
    const cduSysTrim = {
      architecture: 'dry_cooler_trim',
      fwsSupplyC: 40.0,
      sizing: [{ passed: true, effectiveCapKw: 1000, label: 'CDU' }]
    };
    const valTrim = SizingEngine.validateCdu(cduSysTrim, 1.8, { designWb: 28.0 });
    assert(!valTrim.checks.some(c => c.includes('冷卻水塔可直接供冷')), 'Other architectures must not generate water_chiller warning');
  });

  test('P4-6 AppStore.calculate populates validation warning on water_chiller cduSystem', () => {
    const kaohsiung = ctx.BUILTIN_WEATHER_DATA['高雄 (Kaohsiung)'];
    S.state.site.hourly = kaohsiung.hourlyData;
    const du = S.state.halls[0].dus[0];
    du.plantDesign.cduSystem.architecture = 'water_chiller';
    du.plantDesign.cduSystem.fwsSupplyC = 40.0;
    S.calculate();

    const val = du.plantDesign.cduSystem.validation;
    assert(val, 'validation must exist on cduSystem');
    assert(val.checks.some(c => c.includes('冷卻水塔可直接供冷')), 'Store calculate must include free cooling warning on water_chiller');
  });
})();

// ═══════════════════════════════════════════════════════════════
// P4-7 Trim Chiller Sizing Basis: Peak DB N+1 & 100% Mode 3 Load
// ═══════════════════════════════════════════════════════════════
(function () {
  const ctx = freshCtx();
  const { CoolingArchRegistry, SizingEngine, AppStore: S } = ctx;

  test('P4-7 Trim chiller sizing basis uses maxDb for requiredKw and 100% load for maxMechanicalKw', () => {
    const arch = CoolingArchRegistry.get('dry_cooler_trim');
    const cduSys = {
      architecture: 'dry_cooler_trim',
      fwsSupplyC: 40.0,
      fwsReturnC: 55.0,
      dryCoolerApproachC: 5.0,
      pheApproachC: 2.0,
      hydraulics: { pump_power_kw: 11.0 }
    };
    cduSys.sizing = SizingEngine.generateCduSizing('dry_cooler_trim', 1000, 11.0);

    // Design condition: designDb = 34.0 (Mode 1 full FC -> 0 kW trim), maxDb = 42.0 (Mode 2 trim)
    const designCond = { designDb: 34.0, designWb: 28.0, maxDb: 42.0 };
    SizingEngine.evaluateCduSizing(cduSys, 1000, designCond, {
      trimOperatingPoint: S.trimOperatingPoint.bind(S)
    });

    const trimItem = cduSys.sizing.find(s => s.key === 'trim_chiller');
    assert(trimItem, 'trim_chiller item must exist');

    // Under maxDb = 42°C, full threshold = 40 - 5 - 2 = 33°C. DB 42 > 33 -> Trim needed!
    assert(trimItem.requiredKw > 50, `requiredKw (${trimItem.requiredKw}) should be based on peak DB (42°C), not designDb (34°C)`);
    assert.strictEqual(trimItem.maxMechanicalKw, 1000, 'maxMechanicalKw must equal 100% liquid load (1000 kW)');
    assert(typeof trimItem.maxMechanicalPassed === 'boolean', 'maxMechanicalPassed must be boolean');
  });

  test('P4-7 liquid_dry_cooler_trim equipment descriptor requiredKw and extraProps reflect peakDb', () => {
    const arch = CoolingArchRegistry.get('dry_cooler_trim');
    const trimEquip = arch.equipment.find(e => e.key === 'trim_chiller');
    assert(trimEquip, 'trim_chiller equipment descriptor must exist');

    const ctxMock = {
      reqKw: 1000,
      sys: { fwsSupplyC: 40.0, fwsReturnC: 55.0, dryCoolerApproachC: 5.0, pheApproachC: 2.0 },
      helpers: {
        designConditions: () => ({ designDb: 33.0, designWb: 28.0, maxDb: 40.0 }),
        trimOperatingPoint: S.trimOperatingPoint.bind(S)
      }
    };

    const reqKw = trimEquip.requiredKw(ctxMock);
    const extra = trimEquip.extraProps(ctxMock);
    assert(reqKw > 50, 'requiredKw must be based on maxDb 40°C');
    assert.strictEqual(extra.maxMechanicalKw, 1000, 'maxMechanicalKw must be 1000 kW');
  });
})();

// ── S-1: dom_harness renders DOM properly for wiring tests ─────────────────
(function () {
  const { buildWindow } = require('./dom_harness.js');
  test('S-1 dom_harness builds window, App initializes and renders Step 4', async () => {
    const win = buildWindow();
    assert(win.App, 'win.App must exist');
    await win.App.init();
    win.App.renderStep(4);
    const container = win.document.getElementById('stepContent');
    assert(container, '#stepContent must exist');
    assert(container.innerHTML.length > 500, 'Step 4 innerHTML must not be empty');
    assert(container.querySelector('.bg-slate-950'), 'Schematic container must exist in Step 4');
  });
})();

// ── F-9: topo_preview city suffix prevents overwriting default ─────────────
(function () {
  test('F-9 topo_preview appends city suffix when city is non-default', () => {
    const topoScript = require('fs').readFileSync(require('path').join(__dirname, 'topo_preview.js'), 'utf8');
    assert(topoScript.includes('getCitySuffix'), 'topo_preview must define getCitySuffix');
    assert(topoScript.includes('__'), 'topo_preview must format city suffix with double underscore');
  });
})();

// ── F-1: mode hours wiring in Step 4 schematic ─────────────────────────────
(function () {
  const { buildWindow } = require('./dom_harness.js');
  test('F-1 Step 4 DOM wiring displays annual mode hours in schematics', async () => {
    const win = buildWindow();
    await win.App.init();
    win.AppStore.calculate();
    win.App.renderStep(4);
    const container = win.document.getElementById('stepContent');
    const html = container.innerHTML;
    const du0 = win.AppStore.state.results.byDu[0];
    assert(du0 && du0.cduModeHours, 'byDu[0].cduModeHours must exist');
    const { free, partial, mechanical } = du0.cduModeHours;
    assert.strictEqual(free + partial + mechanical, 8760, 'cduModeHours must sum to 8760');
    assert(html.includes('全年'), 'Step 4 innerHTML must contain 全年');
    assert(html.includes(`${free} h`), `Step 4 innerHTML must contain cduModeHours.free (${free} h)`);

    // Verify fwModeHours presence in DOM
    assert(du0.fwModeHours, 'byDu[0].fwModeHours must exist');
    const fwFree = du0.fwModeHours.free;
    assert(html.includes(`${fwFree} h`), `Step 4 innerHTML must contain fwModeHours.free (${fwFree} h)`);
  });
})();

// ── F-2: dynamic condenser water outlet temperature formulas ───────────────
(function () {
  const { buildWindow } = require('./dom_harness.js');
  test('F-2 Kaohsiung design point Trim schematic has identical condIn and condOut temperatures', async () => {
    const win = buildWindow();
    await win.App.init();
    win.AppStore.calculate();
    win.App.renderStep(4);
    const container = win.document.getElementById('stepContent');
    const du0 = win.AppStore.state.halls[0].dus[0];
    const sys = du0.plantDesign.cduSystem;
    const arch = win.CoolingArchRegistry.get(sys.architecture);
    const design = win.AppStore.designConditions();
    const op = arch.operatingPoint(sys, { db: design.designDb, wb: design.designWb }, {}, { withChiller: true });
    assert.strictEqual(op.mode, 'free', 'Kaohsiung design point must be free cooling (Mode 1)');
    assert.strictEqual(op.temps.condIn, op.temps.condOut, 'condIn and condOut must be identical when trim chiller is idle');
    const html = container.innerHTML;
    assert(html.includes(`${op.temps.condIn.toFixed(1)}°C`), `Step 4 HTML must contain ${op.temps.condIn.toFixed(1)}°C`);
  });
})();

// ── F-3: renderer de-physicalization and zero hardcoded decimals ────────────
(function () {
  const fs = require('fs');
  const path = require('path');
  test('F-3 schematic renderers contain 0 physical simulation calls or hardcoded decimal fallbacks', () => {
    const schemDir = path.join(__dirname, '../../public/Data center Cal/js/views/schematics');
    const files = fs.readdirSync(schemDir).filter(f => f.endsWith('.js'));
    const pattern = /ChillerEngine|operatingPoint\(|calcSeriesEconomizer|'[0-9]+\.[0-9]'/;
    for (const f of files) {
      const content = fs.readFileSync(path.join(schemDir, f), 'utf8');
      const lines = content.split('\n');
      lines.forEach((line, idx) => {
        assert(!pattern.test(line), `F-3 violation in ${f}:${idx + 1}: ${line.trim()}`);
      });
    }
  });
})();

// ── F-4: Trim schematic design DB label ────────────────────────────────────
(function () {
  const { buildWindow } = require('./dom_harness.js');
  test('F-4 Trim schematic displays design DB label instead of threshold', async () => {
    const win = buildWindow();
    await win.App.init();
    win.AppStore.calculate();
    win.App.renderStep(4);
    const container = win.document.getElementById('stepContent');
    const html = container.innerHTML;
    const design = win.AppStore.designConditions();
    const expectedLabel = `設計乾球 (0.4%): ${Number(design.designDb).toFixed(1)}°C`;
    assert(html.includes(expectedLabel), `Step 4 HTML must contain "${expectedLabel}"`);
  });
})();

// ── F-5: Fanwall pre-cooling temperature clamp and bypass standby style ─────
(function () {
  const { buildWindow } = require('./dom_harness.js');
  test('F-5 Fanwall pre-cooling temperature is clamped to return and Economizer shows bypass when fc_fraction=0', async () => {
    const win = buildWindow();
    await win.App.init();
    const fanwallArchs = ['air_cooled_chiller', 'rdhx', 'water_cooled_chiller'];
    for (const archId of fanwallArchs) {
      const arch = win.CoolingArchRegistry.get(archId);
      const op = arch.operatingPoint({ chwSupplyC: 12, chwReturnC: 18 }, { db: 40.0, wb: 30.0 });
      assert(op.temps.chwPre !== undefined, `${archId} must define chwPre`);
      assert(op.temps.chwPre <= op.temps.chwRet, `${archId} chwPre (${op.temps.chwPre}) must be <= chwRet (${op.temps.chwRet})`);
      assert.strictEqual(op.temps.chwPre, 18.0, `${archId} chwPre must clamp to 18.0°C when completely unfeasible`);
    }
    const html = win.CoolingSchematics.render('air_plant', {
      fwSys: { chwSupplyC: 12, chwReturnC: 18, architecture: 'air_cooled_chiller' },
      t: { obj: { plantDesign: { fanwallSystem: { architecture: 'air_cooled_chiller' } } } }
    });
    assert(html.includes('旁通停用 (Bypass)'), 'air_plant schematic must display bypass when economizer is disabled');
    assert(html.includes('旁通（'), 'air_plant schematic must display bypass detail with basis and temperatures');
  });
})();

// ── F-6: Trim Mode 2/3 banner format, Mode 3 detail, and standby overlap ───
(function () {
  const { buildWindow } = require('./dom_harness.js');
  test('F-6 Trim banners use 2-line format, Mode 3 specifies condenser rejection only, and chiller icon does not overlap', async () => {
    const win = buildWindow();
    await win.App.init();
    const trimArch = win.CoolingArchRegistry.get('dry_cooler_trim');
    const model = trimArch.topology({ fwsSupplyC: 40, fwsReturnC: 55 }, null, { designDb: 35, designWb: 28 });
    assert(!model.banners[2].detail.includes('全額走 Trim 冰機製冷'), 'Mode 3 banner detail must not say 全額走 Trim 冰機製冷');
    assert(model.banners[2].detail.includes('乾冷器僅排冷凝熱'), 'Mode 3 banner detail must say 乾冷器僅排冷凝熱');

    win.AppStore.calculate();
    win.App.renderStep(4);
    const html = win.document.getElementById('stepContent').innerHTML;
    assert(!html.includes('全額走 Trim 冰機製冷'), 'Step 4 HTML must not contain 全額走 Trim 冰機製冷');
    assert(!html.includes('>待機 (Standby)</text>'), 'Chiller circle must not contain 待機 (Standby)');
  });
})();

// ── F-7: Deficit hours display on zero-chiller topologies and remove 100% ────
(function () {
  const { buildWindow } = require('./dom_harness.js');
  test('F-7 Zero-chiller topologies display deficit hours warning and remove 100% wording', async () => {
    const win = buildWindow();
    await win.App.init();

    const pure = win.CoolingArchRegistry.get('dry_cooler_pure');
    const adiabatic = win.CoolingArchRegistry.get('adiabatic_tower');
    const closed = win.CoolingArchRegistry.get('cooling_tower_hx');

    // 1. Direct topology check when deficitHours > 0 vs === 0
    const topoPureDeficit = pure.topology({ fwsSupplyC: 40, fwsReturnC: 55 }, null, { designDb: 35, deficitHours: 2 });
    assert(topoPureDeficit.banners[0].detail.includes('全年 2 h 超出冷卻能力（供水溫上升）'), 'dry_cooler_pure banner must display deficit hours warning');
    assert.strictEqual(topoPureDeficit.banners[0].tone, 'amber');
    assert(!JSON.stringify(topoPureDeficit.nodes).includes('100%'), 'dry_cooler_pure nodes must not contain 100%');

    const topoPureNormal = pure.topology({ fwsSupplyC: 40, fwsReturnC: 55 }, null, { designDb: 35, deficitHours: 0 });
    assert(topoPureNormal.banners[0].detail.includes('乾式自然風冷・全年零冰機・零水耗'), 'dry_cooler_pure normal banner must have expected text');
    assert(!topoPureNormal.banners[0].detail.includes('100%'), 'dry_cooler_pure normal banner must not contain 100%');
    assert.strictEqual(topoPureNormal.banners[0].tone, 'emerald');

    const topoAdiaDeficit = adiabatic.topology({ fwsSupplyC: 40, fwsReturnC: 55 }, null, { designDb: 35, deficitHours: 5 });
    assert(topoAdiaDeficit.banners[0].detail.includes('全年 5 h 超出冷卻能力（供水溫上升）'), 'adiabatic_tower banner must display deficit hours warning');
    assert.strictEqual(topoAdiaDeficit.banners[0].tone, 'amber');

    const topoAdiaNormal = adiabatic.topology({ fwsSupplyC: 40, fwsReturnC: 55 }, null, { designDb: 35, deficitHours: 0 });
    assert(topoAdiaNormal.banners[0].detail.includes('高溫噴霧預冷 (自然冷卻・零冰機)'), 'adiabatic_tower normal banner must have expected text');
    assert(!topoAdiaNormal.banners[0].detail.includes('100%'), 'adiabatic_tower normal banner must not contain 100%');

    const topoClosedDeficit = closed.topology({ fwsSupplyC: 40, fwsReturnC: 55 }, null, { designDb: 35, deficitHours: 3 });
    assert(topoClosedDeficit.banners[0].detail.includes('全年 3 h 超出冷卻能力（供水溫上升）'), 'cooling_tower_hx banner must display deficit hours warning');
    assert.strictEqual(topoClosedDeficit.banners[0].tone, 'amber');

    const topoClosedNormal = closed.topology({ fwsSupplyC: 40, fwsReturnC: 55 }, null, { designDb: 35, deficitHours: 0 });
    assert(topoClosedNormal.banners[0].detail.includes('水側直冷・全年零冰機'), 'cooling_tower_hx normal banner must have expected text');
    assert(!topoClosedNormal.banners[0].detail.includes('100%'), 'cooling_tower_hx normal banner must not contain 100%');

    // 2. Full DOM harness with Kaohsiung (which has 2 h deficit on dry_cooler_pure)
    const du = win.AppStore.state.designUnits[0];
    du.plantDesign.cduSystem.architecture = 'dry_cooler_pure';
    win.AppStore.calculate();
    win.App.renderStep(4);
    const html = win.document.getElementById('stepContent').innerHTML;
    assert(html.includes('全年 2 h 超出冷卻能力（供水溫上升）'), 'Step 4 HTML must display Kaohsiung 2 h deficit warning for pure dry cooler');
    assert(!html.includes('100% 乾式自然風冷'), 'Step 4 HTML must not contain 100% 乾式自然風冷');
  });
})();

// ── F-8: Step 1 dominant CDU thresholds and Mode 3 mechanical hours ────────
(function () {
  const { buildWindow } = require('./dom_harness.js');
  test('F-8 Step 1 displays dominant CDU thresholds and Mode 3 mechanical hours drops to 0 in default project', async () => {
    const win = buildWindow();
    await win.App.init();

    // 1. Default Kaohsiung project: dominant arch is dry_cooler_hx (dry_cooler_trim)
    const dom = win.AppStore.dominantCduThresholds();
    assert.strictEqual(dom.basis, 'db');
    assert.strictEqual(dom.thresholds.full, 35.0, 'Mode 1 full FC threshold must be 35.0°C (42 - 5 - 2)');
    assert.strictEqual(dom.thresholds.mech, 47.0, 'Mode 2 mech threshold must be 47.0°C (54 - 5 - 2)');

    win.App.renderStep(1);
    const html = win.document.getElementById('stepContent').innerHTML;
    assert(html.includes('依 乾冷器 + Trim 冰機 門檻') || html.includes('依') && html.includes('門檻'), 'Step 1 must cite dominant arch thresholds');
    assert(html.includes('35°C') || html.includes('35.0°C'), 'Step 1 must display Mode 1 threshold');
    assert(html.includes('47°C') || html.includes('47.0°C'), 'Step 1 must display Mode 2 threshold');
    // Mode 3 mechanical hours is 0 (Kaohsiung max DB is 36.4°C <= 47.0°C)
    assert(html.includes('>0 <span class="text-xs font-bold text-amber-700">小時</span>') || html.includes('>0 小時<'), 'Mode 3 hours must drop to 0');

    // 2. Switch dominant CDU to cooling_tower_hx (wet bulb basis)
    const du = win.AppStore.state.designUnits[0];
    du.plantDesign.cduSystem.architecture = 'cooling_tower_hx';
    const domWb = win.AppStore.dominantCduThresholds();
    assert.strictEqual(domWb.basis, 'wb');
    win.App.renderStep(1);
    const htmlWb = win.document.getElementById('stepContent').innerHTML;
    assert(htmlWb.includes('WB'), 'Step 1 must reflect WB basis for closed cooling tower');
  });
})();

// ── X-1: ASHRAE design conditions parsing and serialization ────────────────
(function () {
  const fs = require('fs');
  const path = require('path');
  const AshraeDesign = require('../../public/Data center Cal/js/ashrae_design_conditions.js');

  test('X-1 parseEpwDesignConditions correctly parses Kaohsiung and Hsinchu EPW headers', () => {
    assert(typeof AshraeDesign.parseEpwDesignConditions === 'function', 'parseEpwDesignConditions must be a function');

    // 1. Kaohsiung EPW line 2
    const dir = path.resolve(__dirname, '../../public/Data center Cal/weather/ZIP檔');
    const khSub = fs.readdirSync(dir).find(s => s.includes('Kaohsiung'));
    const khEpw = path.join(dir, khSub, fs.readdirSync(path.join(dir, khSub)).find(f => f.endsWith('.epw')));
    const khLine2 = fs.readFileSync(khEpw, 'utf8').split('\n')[1];
    const khRes = AshraeDesign.parseEpwDesignConditions(khLine2);

    assert(khRes !== null, 'Kaohsiung line 2 must parse');
    assert.strictEqual(khRes.source, 'ASHRAE HOF Ch.14 (EPW header)');
    assert.strictEqual(khRes.cooling.db004, 33.5);
    assert.strictEqual(khRes.cooling.evapWb004, 28.3);
    assert.strictEqual(khRes.extremes.dbMax[20], 36.7);
    assert.strictEqual(khRes.extremes.dbMin[50], 5.2);

    // 2. Hsinchu EPW line 2 (Extremes is all N/A)
    const hcSub = fs.readdirSync(dir).find(s => s.includes('Hsinchu'));
    const hcEpw = path.join(dir, hcSub, fs.readdirSync(path.join(dir, hcSub)).find(f => f.endsWith('.epw')));
    const hcLine2 = fs.readFileSync(hcEpw, 'utf8').split('\n')[1];
    const hcRes = AshraeDesign.parseEpwDesignConditions(hcLine2);

    assert(hcRes !== null, 'Hsinchu line 2 must parse');
    assert.strictEqual(hcRes.cooling.db004, 33.2);
    assert.strictEqual(hcRes.cooling.evapWb004, 28.8);
    assert.strictEqual(hcRes.extremes, null, 'Hsinchu extremes must be null');

    // 3. Invalid / non-design conditions input returns null
    assert.strictEqual(AshraeDesign.parseEpwDesignConditions(''), null);
    assert.strictEqual(AshraeDesign.parseEpwDesignConditions('LOCATION,foo,bar'), null);
  });

  test('X-1 EpwParser.parse extracts designConditions and serializeProject/deserializeProject preserves it', () => {
    const { buildWindow } = require('./dom_harness.js');
    const win = buildWindow();
    const dir = path.resolve(__dirname, '../../public/Data center Cal/weather/ZIP檔');
    const khSub = fs.readdirSync(dir).find(s => s.includes('Kaohsiung'));
    const khEpw = path.join(dir, khSub, fs.readdirSync(path.join(dir, khSub)).find(f => f.endsWith('.epw')));
    const epwContent = fs.readFileSync(khEpw, 'utf8');

    const parsed = win.EpwParser.parse(epwContent);
    assert(parsed.designConditions, 'EpwParser.parse must return designConditions');
    assert.strictEqual(parsed.designConditions.cooling.db004, 33.5);

    win.AppStore.updateSite({
      selectedCity: 'Kaohsiung_Custom',
      designConditions: parsed.designConditions
    });
    assert.strictEqual(win.AppStore.state.site.designConditions.cooling.db004, 33.5);

    const jsonStr = win.AppStore.serializeProject();
    assert(jsonStr.includes('"designConditions"'), 'serializeProject must serialize designConditions');

    win.AppStore.state.site.designConditions = null;
    win.AppStore.deserializeProject(jsonStr);
    assert(win.AppStore.state.site.designConditions !== null, 'deserializeProject must restore designConditions');
    assert.strictEqual(win.AppStore.state.site.designConditions.cooling.db004, 33.5);
  });
})();

console.log(`\n${passCount} passed, ${failCount} failed, ${skipCount} skipped`);
process.exit(failCount > 0 ? 1 : 0);




