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

console.log(`\n${passCount} passed, ${failCount} failed, ${skipCount} skipped`);
process.exit(failCount > 0 ? 1 : 0);

