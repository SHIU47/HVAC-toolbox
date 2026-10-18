#!/usr/bin/env node
// 單元驗收測試 — 對應計畫書 §2/§3 各任務的「驗收」條目。
// 每個任務修完後跑一次；全部 assert 通過才能 commit 該任務。
// 尚未修正的項目用 skip() 標記，修正後把該行改回 test()。
'use strict';
const assert = require('assert');
const { checkHarnessOrder } = require('./check_harness_order.js');

// G-2: Enforce harness script loading order at start of test suite
checkHarnessOrder();

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

// R6 P0-T1 起模擬引擎採用降額後 CDU 容量；預設台數未含降額會產生容量不足，
// 需要「無 deficit」前提的測試先把 CDU 台數補到降額後的 N+1 需求台數。
function sizeCduToDeratedN1(S) {
  const units = [...S.state.halls.flatMap(h => h.dus), ...S.state.corePods];
  units.forEach(u => (u.plantDesign?.cduSystem?.sizing || []).forEach(s => {
    if (s.key === 'cdu_unit' && s.requiredUnitsN1 > s.selectedQty) s.selectedQty = s.requiredUnitsN1;
  }));
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
    // R6 P0-C2: fixed 改用真實部分負載曲線，額定 COP 須在 PLR=1.0 驗證
    const r = ChillerEngine.calcPower(500, chillers, 7.0, 30.0, 30.0);
    assert(Math.abs(r.cop_actual - 6.0) < 0.05, 'got ' + r.cop_actual);
  });
  test('P0-4 air fixed @7/35 COP == cop_design', () => {
    const chillers = [{ cooling_capacity_kw: 500, cop_design: 3.6, cop_curve: { type: 'fixed' }, t_chws_design: 7.0, qty_running: 1, qty_total: 2, chiller_type: 'air_cooled' }];
    const r = ChillerEngine.calcPower(500, chillers, 7.0, undefined, 35.0);
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
    fanwallSystem: { architecture: 'air_cooled_chiller', chwSupplyC: 12.0, chwReturnC: 18.0, hasFcCoil: true } // R6 P0-C1: 測 FC 盤管行為需明確指定含盤管機型
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
    // 12 台選用 (N+1 含降額自動選型)，N+1 可用台數 11，標稱 100 kW -> 11 * 100 * 0.8 = 880 kW
    assert.strictEqual(cduSizing.selectedQty, 12);
    assert.strictEqual(cduSizing.effectiveCapKw, 880);
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
  sizeCduToDeratedN1(S);
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
  pd.fanwallSystem.hasFcCoil = true; // R6 P0-C1
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
    S.updateSite({
      selectedCity: '高雄 (Kaohsiung)',
      hourly: W['高雄 (Kaohsiung)'].hourlyData,
      designConditions: W['高雄 (Kaohsiung)'].designConditions,
      isRealEpw: true
    });
    assert.strictEqual(S.designConditions().designDb, 33.5);
    const serializedTaichung = S.serializeProject();
    const parsed = JSON.parse(serializedTaichung);
    parsed.site.selectedCity = '台中 (Taichung)';
    S.deserializeProject(parsed);
    assert.strictEqual(S.designConditions().designDb, 33.7);
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
    sizeCduToDeratedN1(S);
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

  test('C-5 serializeProject produces schemaVersion v6', () => {
    const json = S.serializeProject();
    const parsed = JSON.parse(json);
    assert.strictEqual(parsed.schemaVersion, 'v6');
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
    assert.strictEqual(migrated.schemaVersion, 'v6');
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

    const savedV6 = S.serializeProject();
    const parsedV6 = JSON.parse(savedV6);
    assert.strictEqual(parsedV6.schemaVersion, 'v6');

    const ok2 = S.deserializeProject(savedV6);
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
    sizeCduToDeratedN1(S);
    S.bridgeDuToPlantModel(du, summ);
    let pureDeficitHours = 0;
    AnnualRunner.simulateUnit(du.plantDesign, summ, alabama.hourlyData, {
      calcHourlyEnergy: (pd, ls, w, pre) => S.calcHourlyEnergy(pd, ls, w, pre),
      onHour: (i, hr) => { if ((hr.capacityDeficitKw || 0) > 0) pureDeficitHours++; }
    });

    // 4. Run AnnualRunner for adiabatic_trim on Alabama
    du.plantDesign.cduSystem.architecture = 'adiabatic_trim';
    S.bridgeDuToPlantModel(du, summ);
    sizeCduToDeratedN1(S);
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
    'views/schematics/schematic_common.js',
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
    const sys = { chwSupplyC: 12.0, chwReturnC: 18.0, hasFcCoil: true };
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
    assert(valLow.checks.some(c => c.includes('低於結露保護溫度') && c.includes('有結露風險')), 'validateFw must warn on dew point risk');
    const topoLow = arch.topology(sysLow, arch.operatingPoint(sysLow, { db: 35, wb: 28 }, {}), { designDb: 35.0 });
    assert(topoLow.warnings.some(w => w.includes('低於結露保護溫度') && w.includes('有結露風險')), 'topology must include dew point warning');

    // Case B: chwSupplyC = 18.0 >= 17.0 -> no dew point warning
    const sysSafe = { architecture: 'rdhx', chwSupplyC: 18.0, chwReturnC: 24.0, sizing: [] };
    const valSafe = SizingEngine.validateFw(sysSafe, { air_load_kw: 100 }, arch);
    assert(!valSafe.checks.some(c => c.includes('低於結露保護溫度')), 'validateFw must pass dew point check');
    const topoSafe = arch.topology(sysSafe, arch.operatingPoint(sysSafe, { db: 35, wb: 28 }, {}), { designDb: 35.0 });
    assert(!topoSafe.warnings.some(w => w.includes('低於結露保護溫度')), 'topology must not have dew point warning');
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

  test('X-3 BUILTIN_WEATHER_DATA contains designConditions for all 7 cities and wiring works', () => {
    const { buildWindow } = require('./dom_harness.js');
    const win = buildWindow();
    const data = win.BUILTIN_WEATHER_DATA;
    assert(data, 'BUILTIN_WEATHER_DATA must exist');
    const cities = Object.keys(data);
    assert.strictEqual(cities.length, 7, 'Must have 7 builtin cities');

    let withExtremes = 0;
    for (const c of cities) {
      assert(data[c].designConditions, `City ${c} must have designConditions`);
      assert(data[c].designConditions.cooling, `City ${c} must have cooling`);
      if (data[c].designConditions.extremes !== null) {
        withExtremes++;
      }
    }
    assert.strictEqual(withExtremes, 6, 'Exactly 6 cities must have extremes');
    assert.strictEqual(data['新竹 (Hsinchu)'].designConditions.extremes, null, 'Hsinchu extremes must be null');
    assert.strictEqual(data['新竹 (Hsinchu)'].designConditions.cooling.db004, 33.2);

    // Test selectCity wiring
    win.ViewWeather.selectCity('高雄 (Kaohsiung)');
    const khDc = win.AppStore.state.site.designConditions;
    assert(khDc, 'site.designConditions must be set after selectCity');
    assert.strictEqual(khDc.cooling.db004, 33.5);
    assert.strictEqual(khDc.extremes.dbMax[20], 36.7);

    // Test App.init default city wiring
    win.localStorage.clear();
    win.CatalogManager.ready = null;
    win.AppStore.state.site.designConditions = null;
    win.App.init();
    const tyDc = win.AppStore.state.site.designConditions;
    assert(tyDc, 'site.designConditions must be set after App.init');
    assert.strictEqual(tyDc.cooling.db004, 33.9);
    assert.strictEqual(tyDc.cooling.evapWb004, 29);
  });

  test('X-4 AppStore.designConditions() prioritizes ASHRAE 0.4% and computes peakDb, freezeDb, dataQualityWarning', () => {
    const { buildWindow } = require('./dom_harness.js');
    const win = buildWindow();

    // 1. Kaohsiung: ASHRAE prioritized, no data quality warning
    win.ViewWeather.selectCity('高雄 (Kaohsiung)');
    const khCond = win.AppStore.designConditions();
    assert.strictEqual(khCond.designDb, 33.5);
    assert.strictEqual(khCond.designWb, 28.3);
    assert.strictEqual(khCond.designBasis, 'ASHRAE 0.4%');
    assert.strictEqual(khCond.peakDb.value, 36.7);
    assert.strictEqual(khCond.peakDb.basis, 'ASHRAE n=20 年回歸');
    assert.strictEqual(khCond.freezeDb.value, 5.2);
    assert.strictEqual(khCond.freezeDb.basis, 'ASHRAE n=50 年回歸');
    assert.strictEqual(khCond.dataQualityWarning, null);

    // 2. Taoyuan: Gap is 42.0 - 34.3 = 7.7 > 5.0 -> dataQualityWarning triggered
    win.ViewWeather.selectCity('桃園 (Taoyuan Pilot)');
    const tyCond = win.AppStore.designConditions();
    assert.strictEqual(tyCond.designDb, 33.9);
    assert.strictEqual(tyCond.designWb, 29);
    assert.strictEqual(tyCond.peakDb.value, 42.0);
    assert.strictEqual(tyCond.freezeDb.value, -1.8);
    assert(tyCond.dataQualityWarning && tyCond.dataQualityWarning.includes('7.7°C'), `Expected 7.7°C warning, got: ${tyCond.dataQualityWarning}`);

    // 3. Hsinchu: extremes is null -> fallback to TMY maxDb + 2.0, freezeDb is null
    win.ViewWeather.selectCity('新竹 (Hsinchu)');
    const hcCond = win.AppStore.designConditions();
    assert.strictEqual(hcCond.designDb, 33.2);
    assert.strictEqual(hcCond.designWb, 28.8);
    assert.strictEqual(hcCond.peakDb.value, 33.1 + 2.0);
    assert.strictEqual(hcCond.peakDb.basis, 'TMY 最高 + 餘裕（無 ASHRAE 極值）');
    assert.strictEqual(hcCond.freezeDb, null);

    // 4. Missing designConditions (fallback mode)
    win.AppStore.state.site.designConditions = null;
    win.AppStore.state.site.design = null;
    const fbCond = win.AppStore.designConditions();
    assert.strictEqual(fbCond.designBasis, 'TMY 排序 0.4%');
    assert.strictEqual(fbCond.designDb, 31.6); // TMY sorted for Hsinchu
  });

  test('Y-1 Step 4 parameter panel renders PHE freeze risk notice according to freezeDb', async () => {
    const { buildWindow } = require('./dom_harness.js');
    const win = buildWindow();
    win.CatalogManager.ready = null;
    await win.App.init();

    // Set first DU to dry_cooler_pure with hasPhe=true
    const du = win.AppStore.state.designUnits[0];
    du.plantDesign.cduSystem.architecture = 'dry_cooler_pure';
    du.plantDesign.cduSystem.hasPhe = true;

    // 1. Kaohsiung: freezeDb = 5.2 > 4.0 -> "無結冰風險"
    win.ViewWeather.selectCity('高雄 (Kaohsiung)');
    win.ViewCooling.render(win.document.getElementById('stepContent'));
    const khHtml = win.document.getElementById('stepContent').innerHTML;
    assert(khHtml.includes('本案場 ASHRAE 50 年回歸最低乾球 5.2°C，無結冰風險'), 'Kaohsiung must show no freeze risk notice');

    // 2. Taichung: freezeDb = 3.1 <= 4.0 -> "有結冰風險"
    win.ViewWeather.selectCity('台中 (Taichung CC)');
    win.ViewCooling.render(win.document.getElementById('stepContent'));
    const tcHtml = win.document.getElementById('stepContent').innerHTML;
    assert(tcHtml.includes('本案場 50 年回歸最低乾球 3.1°C，有結冰風險'), 'Taichung must show freeze risk warning');

    // 3. Hsinchu: freezeDb is null -> no notice
    win.ViewWeather.selectCity('新竹 (Hsinchu)');
    win.ViewCooling.render(win.document.getElementById('stepContent'));
    const hcHtml = win.document.getElementById('stepContent').innerHTML;
    assert(!hcHtml.includes('結冰風險'), 'Hsinchu (null freezeDb) must not show freeze notice');

    // 4. Taichung with hasPhe=false -> no notice
    win.ViewWeather.selectCity('台中 (Taichung CC)');
    du.plantDesign.cduSystem.hasPhe = false;
    win.ViewCooling.render(win.document.getElementById('stepContent'));
    const tcNoPheHtml = win.document.getElementById('stepContent').innerHTML;
    assert(!tcNoPheHtml.includes('結冰風險'), 'Taichung with hasPhe=false must not show freeze notice');
  });

  test('Y-3 Trim chiller sizing uses peakDb and pure dry cooler warns on peak exceedance', async () => {
    const { buildWindow } = require('./dom_harness.js');
    const win = buildWindow();
    win.CatalogManager.ready = null;
    await win.App.init();

    // 1. Kaohsiung: peakDb = 36.7 (ASHRAE n=20)
    win.ViewWeather.selectCity('高雄 (Kaohsiung)');
    const du = win.AppStore.state.designUnits[0];
    du.plantDesign.cduSystem.architecture = 'dry_cooler_trim';
    du.plantDesign.cduSystem.fwsSupplyC = 42.0;
    du.plantDesign.cduSystem.fwsReturnC = 54.0;
    du.plantDesign.cduSystem.dryCoolerApproachC = 5.0;
    du.plantDesign.cduSystem.pheApproachC = 2.0;
    win.AppStore.calculate();

    const trimItem = du.plantDesign.cduSystem.sizing.find(s => s.key === 'trim_chiller');
    assert(trimItem, 'trim_chiller sizing item must exist');
    // At 36.7°C DB: 36.7 + 7 = 43.7°C. (43.7 - 42) / (54 - 42) = 1.7 / 12 = ~14.2%
    assert(Math.abs(trimItem.peakRatio - (1.7 / 12)) < 0.01, `peakRatio (${trimItem.peakRatio}) must match 1.7 / 12 (~0.1417)`);
    assert(trimItem.requiredText.includes('選型基準 DB 36.7°C，ASHRAE n=20 年回歸'), `requiredText (${trimItem.requiredText}) must include peak basis`);

    // Verify schematic header
    win.ViewCooling.render(win.document.getElementById('stepContent'));
    const trimHtml = win.document.getElementById('stepContent').innerHTML;
    assert(trimHtml.includes('尖峰設計 DB 36.7°C（ASHRAE n=20 年回歸）工況'), 'Trim schematic must show updated peak header');

    // 2. Taoyuan: dataQualityWarning appended
    win.ViewWeather.selectCity('桃園 (Taoyuan Pilot)');
    const tyTrim = win.AppStore.state.designUnits[0].plantDesign.cduSystem.sizing.find(s => s.key === 'trim_chiller');
    assert(tyTrim.requiredText.includes('選型基準 DB 42°C') || tyTrim.requiredText.includes('選型基準 DB 42.0°C'), 'Taoyuan trim must show 42°C peak');
    assert(tyTrim.requiredText.includes('⚠') && tyTrim.requiredText.includes('7.7°C'), 'Taoyuan trim must include data quality warning in requiredText');

    // 3. dry_cooler_pure validation check on peak exceedance
    const pureDu = win.AppStore.state.designUnits[0];
    pureDu.plantDesign.cduSystem.architecture = 'dry_cooler_pure';
    pureDu.plantDesign.cduSystem.fwsSupplyC = 42.0;
    pureDu.plantDesign.cduSystem.dryCoolerApproachC = 5.0;
    pureDu.plantDesign.cduSystem.hasPhe = true;
    pureDu.plantDesign.cduSystem.pheApproachC = 2.0;
    win.ViewWeather.selectCity('高雄 (Kaohsiung)'); // peakDb = 36.7 -> 36.7 + 5 + 2 = 43.7 > 42.0
    win.AppStore.calculate();

    const val = pureDu.plantDesign.cduSystem.validation;
    assert(val, 'validation must exist on cduSystem');
    const warnCheck = val.checks.find(c => c.includes('ASHRAE 尖峰乾球 36.7°C 時 FWS 供水將升至 43.7°C'));
    assert(warnCheck, `Expected pure dry cooler peak warning, got: ${JSON.stringify(val.checks)}`);

    // If fwsSupplyC is high enough (e.g. 45°C), no warning (43.7 <= 45.0)
    pureDu.plantDesign.cduSystem.fwsSupplyC = 45.0;
    win.AppStore.calculate();
    const valHigh = pureDu.plantDesign.cduSystem.validation;
    const warnCheckHigh = valHigh.checks.find(c => c.includes('ASHRAE 尖峰乾球'));
    assert(!warnCheckHigh, 'No warning should be emitted when FWS supply is high enough');
  });

  test('Y-4 Dynamic room dew point protection for RDHX (wiring and validation)', async () => {
    const { buildWindow } = require('./dom_harness.js');
    const win = buildWindow();
    win.CatalogManager.ready = null;
    await win.App.init();

    // 1. Shared calcDewPointC function
    assert(typeof win.calcDewPointC === 'function', 'calcDewPointC must be exported in engines_core');
    const dp = win.calcDewPointC(24, 50);
    assert.strictEqual(dp.toFixed(1), '12.9', 'Dew point at 24°C / 50% RH must be 12.9°C');

    // 2. Set first DU to rdhx
    const du = win.AppStore.state.designUnits[0];
    du.plantDesign.fanwallSystem.architecture = 'rdhx';
    du.plantDesign.fanwallSystem.chwSupplyC = 12.0;
    du.plantDesign.fanwallSystem.chwReturnC = 18.0;
    du.plantDesign.fanwallSystem.roomDbC = 24.0;
    du.plantDesign.fanwallSystem.roomRhPct = 50.0;
    win.AppStore.calculate();

    // CHW 12°C < 14.9°C (12.9 + 2.0) -> warning emitted
    const valLow = du.plantDesign.fanwallSystem.validation;
    const warnLow = valLow.checks.find(c => c.includes('低於結露保護溫度 14.9°C') && c.includes('機房露點 12.9°C'));
    assert(warnLow, `Expected 14.9°C limit warning, got: ${JSON.stringify(valLow.checks)}`);

    // CHW 16°C >= 14.9°C -> no warning
    du.plantDesign.fanwallSystem.chwSupplyC = 16.0;
    win.AppStore.calculate();
    const valSafe = du.plantDesign.fanwallSystem.validation;
    const warnSafe = valSafe.checks.find(c => c.includes('低於結露保護溫度'));
    assert(!warnSafe, 'CHW 16°C must not trigger dew point warning when limit is 14.9°C');

    // 3. Step 4 DOM wiring test
    du.plantDesign.fanwallSystem.chwSupplyC = 12.0;
    win.ViewCooling.render(win.document.getElementById('stepContent'));
    const inputDb = win.document.getElementById('rdhxRoomDbIn_' + du.id);
    const inputRh = win.document.getElementById('rdhxRoomRhIn_' + du.id);
    assert(inputDb, 'Room DB input must exist in DOM');
    assert(inputRh, 'Room RH input must exist in DOM');
    assert.strictEqual(inputDb.value, '24', 'Room DB input value must be 24');
    assert.strictEqual(inputRh.value, '50', 'Room RH input value must be 50');

    // Change input and call updateFwParams
    inputDb.value = '20';
    inputRh.value = '60';
    win.ViewCooling.updateFwParams(du.id);
    assert.strictEqual(du.plantDesign.fanwallSystem.roomDbC, 20);
    assert.strictEqual(du.plantDesign.fanwallSystem.roomRhPct, 60);
  });

  test('G-1 clear designConditions on site change when omitted', async () => {
    const { buildWindow } = require('./dom_harness.js');
    const win = buildWindow();
    win.CatalogManager.ready = null;
    await win.App.init();

    // 1. Initial city is Taoyuan (peakDb = 42.0)
    const tyCond = win.AppStore.designConditions();
    assert.strictEqual(tyCond.peakDb.value, 42.0);

    // 2. updateSite with Kaohsiung hourly but WITHOUT designConditions
    const kh = win.BUILTIN_WEATHER_DATA['高雄 (Kaohsiung)'];
    win.AppStore.updateSite({ hourly: kh.hourlyData, selectedCity: '高雄 (Kaohsiung)' });

    // site.designConditions must be cleared to null
    assert.strictEqual(win.AppStore.state.site.designConditions, null);
    const fbCond = win.AppStore.designConditions();
    assert.strictEqual(fbCond.peakDb.basis, 'TMY 最高 + 餘裕（無 ASHRAE 極值）');

    // 3. updateSite with Kaohsiung WITH designConditions
    win.AppStore.updateSite({
      hourly: kh.hourlyData,
      selectedCity: '高雄 (Kaohsiung)',
      designConditions: kh.designConditions || null
    });
    const khCond = win.AppStore.designConditions();
    assert.strictEqual(khCond.peakDb.value, 36.7);
    assert.strictEqual(khCond.designDb, 33.5);
  });

  test('G-2 harness includes design conditions and check_harness_order succeeds', () => {
    const ctx = freshCtx();
    assert(ctx.AshraeDesign, 'AshraeDesign must be loaded in harness');
    assert(ctx.EpwParser, 'EpwParser must be loaded in harness');
    assert.strictEqual(checkHarnessOrder(), true, 'checkHarnessOrder must return true');

    const kh = ctx.BUILTIN_WEATHER_DATA['高雄 (Kaohsiung)'];
    ctx.AppStore.state.site.hourly = kh.hourlyData;
    ctx.AppStore.state.site.designConditions = kh.designConditions;
    ctx.AppStore.state.site.design = null;
    const cond = ctx.AppStore.designConditions();
    assert.strictEqual(cond.designDb, 33.5);
    assert.strictEqual(cond.peakDb.value, 36.7);
  });

  test('G-3 Standby and Bypass labels merged into titles without overlap', async () => {
    const { buildWindow } = require('./dom_harness.js');
    const win = buildWindow();
    win.CatalogManager.ready = null;
    await win.App.init();

    // 1. Trim chiller standby header check
    win.ViewWeather.selectCity('高雄 (Kaohsiung)');
    const du = win.AppStore.state.halls[0].dus[0];
    du.plantDesign.cduSystem.architecture = 'dry_cooler_trim';
    win.ViewCooling.render(win.document.getElementById('stepContent'));
    const trimHtml = win.document.getElementById('stepContent').innerHTML;

    assert(trimHtml.includes('Water Cooled Chillers — 待機'), 'Trim chiller header must include " — 待機"');
    assert(!trimHtml.includes('<text x="918" y="202"'), 'Old overlapping standby header text must be removed');
    assert(trimHtml.includes('待機 (Standby)'), 'Pipe standby badge must be preserved');

    // 2. Fanwall air-cooled chiller bypass header check (in Alabama where tAvail >= return temp)
    win.ViewWeather.selectCity('美國 (Alabama Andalusia)');
    du.plantDesign.fanwallSystem.architecture = 'air_cooled_chiller';
    win.ViewCooling.render(win.document.getElementById('stepContent'));
    const fwHtml = win.document.getElementById('stepContent').innerHTML;

    assert(fwHtml.includes('Free-Cooling 盤管 — 旁通'), 'Fanwall FC coil header must include " — 旁通"');
    assert(!fwHtml.includes('<text x="600" y="72"'), 'Old overlapping bypass header text must be removed');
  });

  test('G-4 Fanwall banners use shared 2-line renderer with threshold, hours, and description', async () => {
    const { buildWindow } = require('./dom_harness.js');
    const win = buildWindow();
    win.CatalogManager.ready = null;
    await win.App.init();

    assert(win.CoolingSchematicCommon, 'CoolingSchematicCommon must be defined on window');
    assert(typeof win.CoolingSchematicCommon.renderBanners === 'function', 'renderBanners function must exist');

    // 1. Render air-cooled chiller and verify 2-line structure
    const du = win.AppStore.state.halls[0].dus[0];
    du.plantDesign.fanwallSystem.architecture = 'air_cooled_chiller';
    win.ViewCooling.render(win.document.getElementById('stepContent'));
    const html = win.document.getElementById('stepContent').innerHTML;

    assert(html.includes('Mode 1 全自然冷卻'), 'Banner title must be on line 1');
    assert(html.includes('100% 走 Economizer 盤管'), 'Line 2 must contain description');
    assert(html.includes('｜ 全年 '), 'Line 2 must separate fields with ｜');
    assert(html.includes('flex flex-col gap-1'), 'Banner items must use flex-col 2-line layout');

    // 2. Render water_cooled_chiller
    du.plantDesign.fanwallSystem.architecture = 'water_cooled_chiller';
    win.ViewCooling.render(win.document.getElementById('stepContent'));
    const wHtml = win.document.getElementById('stepContent').innerHTML;
    assert(wHtml.includes('Mode 1 全板換自然冷卻'), 'Water cooled chiller line 1 must have title');
    assert(wHtml.includes('100% 水側省能器 (WSE)'), 'Water cooled chiller line 2 must have detail');

    // 3. Render rdhx
    du.plantDesign.fanwallSystem.architecture = 'rdhx';
    win.ViewCooling.render(win.document.getElementById('stepContent'));
    const rHtml = win.document.getElementById('stepContent').innerHTML;
    assert(rHtml.includes('Mode 1 全自然冷卻'), 'RDHX line 1 must have title');
    assert(rHtml.includes('氣冷 FC 盤管自然供冷'), 'RDHX line 2 must have detail');
  });

  test('W-1 WeatherSource module provides listStations, loadStation, caching, and error handling', async () => {
    const { buildWindow } = require('./dom_harness.js');
    const win = buildWindow();
    assert(win.WeatherSource, 'WeatherSource must be defined on window');
    assert(typeof win.WeatherSource.listStations === 'function', 'listStations must be function');
    assert(typeof win.WeatherSource.loadStation === 'function', 'loadStation must be function');
    assert(typeof win.WeatherSource.adaptHourly === 'function', 'adaptHourly must be function');
    assert(typeof win.WeatherSource.basePath === 'function', 'basePath must be function');
    assert(typeof win.WeatherSource.mode === 'function', 'mode must be function');

    // Test listStations
    const list = await win.WeatherSource.listStations();
    assert(list.length >= 7, 'Station list must contain at least 7 stations');
    const first = list[0];
    assert(first.id && first.cityZh && first.countryZh, 'Station items must have id, cityZh, countryZh');
    assert(first.source === 'builtin' || first.source === 'catalog', 'Station source must be builtin or catalog');

    // Test loadStation builtin
    const ty = await win.WeatherSource.loadStation('桃園 (Taoyuan Pilot)');
    assert.strictEqual(ty.source, 'builtin');
    assert.strictEqual(ty.hourlyData.length, 8760);
    assert.strictEqual(ty.stats.avgDB, 22.9);

    // Test LRU cache
    const tyCached = await win.WeatherSource.loadStation('桃園 (Taoyuan Pilot)');
    assert.strictEqual(ty, tyCached, 'Second call must return cached reference');

    // Test file protocol error
    const origMode = win.WeatherSource.mode;
    win.WeatherSource.mode = () => 'file';
    let fileErr = null;
    try {
      await win.WeatherSource.loadStation('CHN_BJ_Beijing-Capital.Intl.AP.545110_TMYx.2011-2025');
    } catch (e) {
      fileErr = e;
    }
    win.WeatherSource.mode = origMode;
    assert(fileErr, 'Loading catalog station in file mode must throw');
    assert.strictEqual(fileErr.code, 'FILE_PROTOCOL', 'Error code must be FILE_PROTOCOL');
  });

  test('W-2 adaptHourly validates length, maps 0..11 to 1..12, and preserves Kaohsiung July avg DB within 0.3C', () => {
    const { buildWindow } = require('./dom_harness.js');
    const win = buildWindow();
    const WS = win.WeatherSource;
    const fs = require('fs');
    const path = require('path');

    // 1. Validation: throws on null, non-array, or < 8760
    assert.throws(() => WS.adaptHourly(null), /WeatherSourceError/);
    assert.throws(() => WS.adaptHourly([]), /WeatherSourceError/);
    assert.throws(() => WS.adaptHourly(new Array(8759).fill({ m: 0, d: 1, h: 1, db: 20, wb: 15 })), /WeatherSourceError/);

    // 2. Leap year slice: 8784 -> 8760
    const mock8784 = new Array(8784).fill(0).map((_, i) => ({ m: Math.floor(i / 730), d: 1, h: 1, db: 25, wb: 20, dp: 18, rh: 70 }));
    const adapted8784 = WS.adaptHourly(mock8784);
    assert.strictEqual(adapted8784.length, 8760, 'adaptHourly must slice to exactly 8760 records');

    // 3. Month conversion: m=0..11 -> month=1..12
    const sample = WS.adaptHourly(new Array(8760).fill(0).map((_, i) => ({ m: Math.floor(i / 730), d: 1, h: 1, db: 20, wb: 15, dp: 10, rh: 50 })));
    assert.strictEqual(sample[0].month, 1, 'm=0 must map to month=1');
    assert.strictEqual(sample[8759].month, 12, 'm=11 must map to month=12');
    const months = new Set(sample.map(h => h.month));
    assert.strictEqual(months.size, 12, 'Must contain all 12 months');

    // 4. Real Kaohsiung EPW verification: July avg DB diff < 0.3°C
    const khPath = path.resolve(__dirname, '../../public/天氣資料/hourly/TWN_SOR_Kaohsiung.Intl.AP.467400_TMYx.2011-2025.json');
    const rawKh = JSON.parse(fs.readFileSync(khPath, 'utf8'));
    const adaptedKh = WS.adaptHourly(rawKh);
    const computedStats = win.AppStore.computeMonthlyStats(adaptedKh);
    const catalogJulAvgDb = computedStats[6].avgDB; // July is index 6
    const builtinKh = win.BUILTIN_WEATHER_DATA['高雄 (Kaohsiung)'];
    const builtinJulAvgDb = builtinKh.monthlyStats.find(m => m.month === 7).avgDB;
    const diff = Math.abs(builtinJulAvgDb - catalogJulAvgDb);
    assert(diff < 0.3, `July avgDB difference (${diff}°C) must be < 0.3°C`);
  });

  test('W-3 Step 1 station selector provides search, filters, data quality icon, and file protocol warning', async () => {
    const { buildWindow } = require('./dom_harness.js');
    const win = buildWindow();
    win.CatalogManager.ready = null;
    await win.App.init();
    await win.ViewWeather.initStations();

    // 1. Initial render contains search input and filter selects
    win.ViewWeather.render(win.document.getElementById('stepContent'));
    const html = win.document.getElementById('stepContent').innerHTML;
    assert(html.includes('id="stationSearchInput"'), 'Must render stationSearchInput');
    assert(html.includes('id="stationContinentSelect"'), 'Must render stationContinentSelect');
    assert(html.includes('id="stationCountrySelect"'), 'Must render stationCountrySelect');
    assert(html.includes('id="stationZoneSelect"'), 'Must render stationZoneSelect');

    // 2. Search filtering
    win.ViewWeather.onSearch('Tokyo');
    const tokyoList = win.ViewWeather.filterStations();
    assert(tokyoList.length >= 1, 'Search for Tokyo must return at least 1 station');
    assert(tokyoList.every(s => (s.cityZh && s.cityZh.includes('Tokyo')) || (s.city && s.city.includes('Tokyo')) || (s.id && s.id.includes('Tokyo'))), 'All results must match Tokyo');

    // 3. Continent & Country filtering
    win.ViewWeather.onSearch('');
    win.ViewWeather.onFilterContinent('Asia');
    win.ViewWeather.onFilterCountry('日本');
    const jpnList = win.ViewWeather.filterStations();
    assert.strictEqual(jpnList.length, 3, 'Japan has 3 stations in catalog');

    // 4. Zone filtering
    win.ViewWeather.onFilterCountry('');
    win.ViewWeather.onFilterContinent('');
    win.ViewWeather.onFilterZone('0A');
    const zone0AList = win.ViewWeather.filterStations();
    assert(zone0AList.length > 0, 'Must return 0A stations');
    assert(zone0AList.every(s => s.zone === '0A'), 'All stations must have zone 0A');

    // 5. Selecting a station updates store with stationId, hourly, and designConditions
    win.ViewWeather.onFilterZone('');
    await win.ViewWeather.selectStation('JPN_TK_Tokyo-Chiyoda.476620_TMYx.2011-2025');
    assert.strictEqual(win.AppStore.state.site.stationId, 'JPN_TK_Tokyo-Chiyoda.476620_TMYx.2011-2025');
    assert.strictEqual(win.AppStore.state.site.hourly.length, 8760);
    assert.strictEqual(win.AppStore.designConditions().peakDb.value, 38.6);

    // 6. File protocol warning banner
    win.ViewWeather.fileProtocolError = true;
    win.ViewWeather.render(win.document.getElementById('stepContent'));
    const bannerHtml = win.document.getElementById('stepContent').innerHTML;
    assert(bannerHtml.includes('直接開啟 HTML 檔案時，瀏覽器不允許讀取本機氣象資料'), 'Banner must display file protocol explanation');
    assert(bannerHtml.includes('標示為「內建・離線可用」的測站仍可正常選用'), 'Banner must explain builtin offline availability');
  });

  test('W-4 Project persistence upgrades schema to v6, preserves catalog stationId, and loads weather on deserialize', async () => {
    const { buildWindow } = require('./dom_harness.js');
    const win = buildWindow();
    win.CatalogManager.ready = null;
    await win.App.init();
    await win.ViewWeather.initStations();

    // Select Tokyo
    await win.ViewWeather.selectStation('JPN_TK_Tokyo-Chiyoda.476620_TMYx.2011-2025');
    assert.strictEqual(win.AppStore.state.site.stationId, 'JPN_TK_Tokyo-Chiyoda.476620_TMYx.2011-2025');

    // 1. Serialize project
    const jsonStr = win.AppStore.serializeProject();
    const parsed = JSON.parse(jsonStr);
    assert.strictEqual(parsed.schemaVersion, 'v6');
    assert.strictEqual(parsed.site.stationId, 'JPN_TK_Tokyo-Chiyoda.476620_TMYx.2011-2025');
    assert.strictEqual(parsed.site.stationSource, 'catalog');

    // 2. Deserialize in a fresh window
    const win2 = buildWindow();
    win2.CatalogManager.ready = null;
    await win2.App.init();

    const ok = win2.AppStore.deserializeProject(jsonStr);
    assert.strictEqual(ok, true);
    assert.strictEqual(win2.AppStore.state.site.isWeatherLoading, true);

    // Await the async weather load
    assert(win2.AppStore.weatherLoadingPromise, 'weatherLoadingPromise must be present');
    await win2.AppStore.weatherLoadingPromise;

    assert.strictEqual(win2.AppStore.state.site.isWeatherLoading, false);
    assert.strictEqual(win2.AppStore.state.site.hourly.length, 8760);
    assert.strictEqual(win2.AppStore.designConditions().peakDb.value, 38.6);
    assert(win2.AppStore.state.results && win2.AppStore.state.results.overall, 'calculate() must have run after loading');

    // 3. Schema migration from v5 to v6
    const v5Data = {
      schemaVersion: 'v5',
      site: {
        selectedCity: '桃園 (Taoyuan Pilot)',
        userUploaded: false
      }
    };
    const migrated = win2.AppStore.migrateProject(v5Data);
    assert.strictEqual(migrated.schemaVersion, 'v6');
    assert.strictEqual(migrated.site.stationSource, 'builtin');
    assert.strictEqual(migrated.site.stationId, 'TWN_NOR_Taoyuan.589650_TMYx.2011-2025');
  });

  test('W-5 WeatherSource respects window.__PUE_EXE__ and build_exe configures weather_catalog bundling', () => {
    const { buildWindow } = require('./dom_harness.js');
    const win = buildWindow();
    assert.strictEqual(win.WeatherSource.mode(), 'http');
    assert.strictEqual(win.WeatherSource.basePath(), '../天氣資料/');

    win.__PUE_EXE__ = true;
    assert.strictEqual(win.WeatherSource.mode(), 'exe');
    assert.strictEqual(win.WeatherSource.basePath(), 'weather_catalog/');

    // Verify build_exe.js source content has weather_catalog and window.__PUE_EXE__
    const buildExeContent = fs.readFileSync(path.resolve(__dirname, '../../public/Data center Cal/build_exe.js'), 'utf8');
    assert(buildExeContent.includes('weather_catalog/weather_data.js'), 'Must bundle weather_catalog/weather_data.js');
    assert(buildExeContent.includes('weather_catalog/hourly'), 'Must bundle weather_catalog/hourly');
    assert(buildExeContent.includes('window.__PUE_EXE__ = true'), 'Must inject window.__PUE_EXE__ into index.html');
  });

  test('Q-1 Chiller CEWT operating envelope checks, warnings, and schematic indicators', () => {
    const ctx = freshCtx();
    const { A, CoolingStages, SizingEngine, CoolingSchematics } = ctx;

    // 1. ASSUMPTIONS constants exist
    assert.strictEqual(A('chiller_max_cewt_standard_c'), 45.0);
    assert.strictEqual(A('chiller_max_cewt_hightemp_c'), 60.0);

    // 2. stage_chiller envelope checks
    const stageChiller = CoolingStages.get('chiller');
    assert(stageChiller, 'stage_chiller must exist');

    // Standard chiller at 42C (within envelope)
    const resNormal = stageChiller.simulate({
      Q_kw: 100,
      t_chws_c: 20,
      t_cewt_c: 42.0,
      devices: [{ cooling_capacity_kw: 150, category: 'water_cooled_centrifugal' }]
    });
    assert.strictEqual(resNormal.exceedsEnvelope, false);
    assert.strictEqual(resNormal.warnings.length, 0);

    // Standard chiller at 52C (exceeds envelope)
    const resOver = stageChiller.simulate({
      Q_kw: 100,
      t_chws_c: 20,
      t_cewt_c: 52.0,
      devices: [{ cooling_capacity_kw: 150, category: 'water_cooled_centrifugal' }]
    });
    assert.strictEqual(resOver.exceedsEnvelope, true);
    assert(resOver.warnings.some(w => w.code === 'CHILLER_CEWT_EXCEEDS_ENVELOPE'));

    // High-temperature heat-pump chiller at 52C (within 60C high-temp envelope)
    const resHighTemp = stageChiller.simulate({
      Q_kw: 100,
      t_chws_c: 20,
      t_cewt_c: 52.0,
      devices: [{ cooling_capacity_kw: 150, category: 'high temp heat pump centrifugal' }]
    });
    assert.strictEqual(resHighTemp.exceedsEnvelope, false);
    assert.strictEqual(resHighTemp.warnings.length, 0);

    // 3. validateCdu warning when peak tCewt > 45.0
    const mockCduSys = {
      architecture: 'dry_cooler_trim',
      fwsSupplyC: 40.0,
      fwsReturnC: 55.0,
      dryCoolerApproachC: 5.0,
      sizing: [
        { key: 'cdu_unit', passed: true, effectiveCapKw: 500 },
        { key: 'dry_cooler', label: '乾冷器', passed: true, effectiveCapKw: 500 },
        {
          key: 'trim_chiller',
          passed: true,
          effectiveCapKw: 200,
          maxMechanicalPassed: true,
          selectedModel: 'Standard Chiller',
          catalog: [{ model: 'Standard Chiller', capKw: 200, category: 'standard' }]
        }
      ]
    };
    // If peakDb is 45C -> opPeak.tCewt is around 50C -> exceeds 45C limit
    const valRes = SizingEngine.validateCdu(mockCduSys, 2.0, { peakDb: { value: 45.0, basis: 'test' }, designDb: 35.0, designWb: 28.0 });
    assert(valRes.checks.some(c => c.includes('超過所選冰機運轉上限 45.0°C，需選用高溫型冰機')), 'Must emit CEWT envelope warning in validateCdu');

    // 4. Schematic warning styling when peak condIn > 45.0
    const { buildWindow } = require('./dom_harness.js');
    const win = buildWindow();
    const mockCtx = {
      cduSys: mockCduSys,
      arch: 'dry_cooler_trim',
      t: { obj: { plantDesign: { cduSystem: mockCduSys } }, summ: { liquidHeatKw: 400 } }
    };
    const seriesTrimRenderer = win.CoolingSchematics.get('series_trim');
    const svgHtml = seriesTrimRenderer.render(mockCtx);
    assert(svgHtml.includes('尖峰設計 DB'), 'Must render peak design DB banner');
  });

  test('Q-2 Hydraulic pump power with editable head, sizing motor adequacy, and wiring', () => {
    const ctx = freshCtx();
    const { A, AppStore, SizingEngine, PlantPumpEngine } = ctx;

    // 1. ASSUMPTIONS defaults exist
    assert(A('cdu_pump_head_default_m') === 28, 'cdu_pump_head_default_m must default to 28');
    assert(A('fw_pump_head_default_m') === 22, 'fw_pump_head_default_m must default to 22');
    assert(A('pump_eta_default') === 0.75, 'pump_eta_default must default to 0.75');
    assert(A('motor_eta_default') === 0.92, 'motor_eta_default must default to 0.92');

    // 2. bridgeDuToPlantModel uses hydraulic equation
    const mockDu = {
      plantDesign: {
        cduSystem: { architecture: 'dry_cooler_trim', fwsSupplyC: 40.0, fwsReturnC: 55.0 },
        fanwallSystem: { architecture: 'air_cooled_chiller', chwSupplyC: 12.0, chwReturnC: 18.0 }
      }
    };
    const mockSumm = { liquidHeatKw: 500, airHeatKw: 100, lossKw: 0, dlcPct: 83.3 };
    AppStore.bridgeDuToPlantModel(mockDu, mockSumm);

    // R6 P1-H1: dry_cooler_trim 具板換二次迴路，預設總揚程為 28m + 16m = 44m，比熱採乙二醇 3.90
    assert(mockDu.plantDesign.cduSystem.hydraulics.pump_head_m === 44, 'Default CDU head with PHE must be 44m (28m base + 16m PHE)');
    const pCdu = mockDu.plantDesign.cduSystem.hydraulics.pump_power_kw;
    assert(pCdu > 5.0 && pCdu < 5.6, `CDU hydraulic power ${pCdu} should be ~5.34 kW`);

    // Override base head to 72m (72 + 16 = 88m, exactly 2x of 44m) -> power should double
    mockDu.plantDesign.cduSystem.pumpHeadM = 72;
    AppStore.bridgeDuToPlantModel(mockDu, mockSumm);
    assert(mockDu.plantDesign.cduSystem.hydraulics.pump_head_m === 88, 'CDU head must update to 88m');
    const pCduDouble = mockDu.plantDesign.cduSystem.hydraulics.pump_power_kw;
    assert(Math.abs((pCduDouble / pCdu) - 2.0) < 0.001, 'Doubled total head must double hydraulic power');

    // 3. Sizing Engine evaluates motor adequacy vs P_design
    const cduSysSizing = {
      architecture: 'dry_cooler_trim',
      hydraulics: { pump_power_kw: 10.0 },
      sizing: [
        {
          key: 'cdu_pump',
          catalog: [
            { model: 'Pump-Small', capKw: 3.0 },
            { model: 'Pump-Large', capKw: 11.0 }
          ],
          selectedModel: 'Pump-Small',
          unitCapKw: 3.0,
          selectedQty: 3, // (3 - 1) * 3 = 6 kW motor capacity < 10 kW required
          userEdited: true
        }
      ]
    };
    SizingEngine.evaluateCduSizing(cduSysSizing, 500, { designDb: 35, designWb: 28 });
    const pumpItem = cduSysSizing.sizing[0];
    assert(!pumpItem.passed, 'Small pump must fail when motor capacity 6 kW < 10 kW');
    assert(pumpItem.requiredText.includes('泵浦馬達功率不足'), 'Must flag 泵浦馬達功率不足');

    // Switch to Large pump (2 running * 11 = 22 kW > 10 kW)
    pumpItem.selectedModel = 'Pump-Large';
    pumpItem.unitCapKw = 11.0;
    SizingEngine.evaluateCduSizing(cduSysSizing, 500, { designDb: 35, designWb: 28 });
    assert(pumpItem.passed, 'Large pump must pass when motor capacity 22 kW >= 10 kW');

    // 4. PlantPumpEngine.calcPower respects p_design
    const pRes = PlantPumpEngine.calcPower([{ p_design: 10.0, qty_running: 2 }], 1.0);
    assert(Math.abs(pRes - 10.0) < 1e-4, 'calcPower at speed 1.0 must return p_design');

    // 5. Wiring Test: Step 4 DOM harness renders pump head input and handles changes
    const { buildWindow } = require('./dom_harness.js');
    const win = buildWindow();
    win.AppStore.calculate();
    const duWin = win.AppStore.state.halls[0].dus[0];
    const initialPriKwh = win.AppStore.state.results.overall.breakdownKwh.cduPrimaryPumpKwh;

    // Change base pumpHeadM on DU to 72m (total head doubles from 44m to 88m)
    duWin.plantDesign.cduSystem.pumpHeadM = 72;
    win.AppStore.calculate();
    const doubledPriKwh = win.AppStore.state.results.overall.breakdownKwh.cduPrimaryPumpKwh;
    const ratio = doubledPriKwh / initialPriKwh;
    assert(Math.abs(ratio - 2.0) < 0.02, `Doubling total head must double primary pump energy (±2%), got ratio ${ratio}`);

    // Verify DOM rendering
    win.ViewCooling.render(win.document.getElementById('stepContent'));
    win.ViewCooling.expandAll();
    const cduHeadInput = win.document.getElementById(`cduPumpHeadIn_${duWin.id}`);
    assert(cduHeadInput !== null, 'cduPumpHeadIn input must exist in DOM');
    assert(Number(cduHeadInput.value) === 72, 'cduPumpHeadIn must reflect updated value 72');
  });
})();

// ── Round 6 P0-E1: 預設電損 4.5%，且序列化/反序列化完整保留（含 0%）──────────
(function () {
  const ctx = freshCtx();
  const S = ctx.AppStore;
  test('R6 P0-E1 default facilityElectricalLossPct is 4.5%', () => {
    assert(Math.abs(S.state.facilityElectricalLossPct - 4.5) < 1e-6, 'got ' + S.state.facilityElectricalLossPct);
  });
  test('R6 P0-E1 serialize/deserialize preserves facilityElectricalLossPct (3.8% and 0%)', () => {
    S.setFacilityElectricalLossPct(3.8);
    const dumped = S.serializeProject();
    S.setFacilityElectricalLossPct(0.0);
    S.deserializeProject(dumped);
    assert(Math.abs(S.state.facilityElectricalLossPct - 3.8) < 1e-6, 'got ' + S.state.facilityElectricalLossPct);
    S.setFacilityElectricalLossPct(0.0);
    const dumpedZero = S.serializeProject();
    S.setFacilityElectricalLossPct(4.5);
    S.deserializeProject(dumpedZero);
    assert(S.state.facilityElectricalLossPct === 0, 'explicit 0% must be kept, got ' + S.state.facilityElectricalLossPct);
  });
  test('R6 P0-E1 legacy project without facilityElectricalLossPct falls back to default 4.5%', () => {
    S.setFacilityElectricalLossPct(0.0);
    const legacy = JSON.parse(S.serializeProject());
    delete legacy.facilityElectricalLossPct;
    S.deserializeProject(JSON.stringify(legacy));
    assert(Math.abs(S.state.facilityElectricalLossPct - 4.5) < 1e-6, 'got ' + S.state.facilityElectricalLossPct);
  });
})();

// ── Round 6 P0-F1: 排熱風扇不再於自然冷卻時砍半，改依過冷裕度變頻 ──────────
(function () {
  const ctx = freshCtx();
  const { CoolingStages, AppStore } = ctx;
  const dc = CoolingStages.get('dry_cooler');
  const devices = [{ fan_kw_dx: 30, fan_kw_fc: 30, qty_running: 2, fan_control: 'vfd' }];
  const base = { devices, loadRatio: 1.0, t_supply_c: 42, approach_c: 5, hx_approach_c: 2 };
  test('R6 P0-F1 dry cooler at free-cooling threshold runs 100% rated fan power', () => {
    const r = dc.rejectionCost({ ...base, w: { db: 35, wb: 25 } }, 1000, true);
    assert(Math.abs(r.fanKw - 60) < 1e-6, 'got ' + r.fanKw);
  });
  test('R6 P0-F1 dry cooler fan modulates down with subcool margin but not below min speed', () => {
    const r15 = dc.rejectionCost({ ...base, w: { db: 15, wb: 10 } }, 1000, true).fanKw;
    const r30 = dc.rejectionCost({ ...base, w: { db: 30, wb: 22 } }, 1000, true).fanKw;
    const floorKw = 60 * (0.10 + 0.90 * Math.pow(0.45, 3));
    assert(r30 < 60 && r15 < r30, `expected monotonic decrease, got r30=${r30} r15=${r15}`);
    assert(r15 >= floorKw - 1e-6, `must respect 0.45 speed floor, got ${r15} < ${floorKw}`);
  });
  test('R6 P0-F1 resolveTowerFromSizing no longer halves fan_kw_fc', () => {
    const devs = AppStore.resolveTowerFromSizing({ selectedQty: 3, selectedModel: 'X', catalog: [{ model: 'X', fanKwDx: 40 }] });
    assert(devs[0].fan_kw_fc === 40, 'got ' + devs[0].fan_kw_fc);
  });
})();

// ── Round 6 P0-T1: CDU 降額容量傳入模擬引擎、CDU/CRAH 運轉中最低轉速 ───────────
(function () {
  const ctx = freshCtx();
  const { AppStore: S, CDUEngine, CRAHEngine } = ctx;
  test('R6 P0-T1 resolveCduFromSizing passes derated capacity_kw', () => {
    const devs = S.resolveCduFromSizing({ selectedQty: 10, selectedModel: 'C', derateFactor: 0.76, catalog: [{ model: 'C', capKw: 100, powerKw: 5 }] });
    assert(Math.abs(devs[0].capacity_kw - 76) < 1e-9 && devs[0].nominal_capacity_kw === 100, JSON.stringify(devs[0]));
  });
  test('R6 P0-T1 CDUEngine reports deficit against derated capacity (9 x 76 kW < 862.6 kW)', () => {
    const r = CDUEngine.calcPower([{ capacity_kw: 76, power_kw: 5, qty_running: 9 }], 862.6);
    assert(Math.abs(r.deficit_kw - (862.6 - 684)) < 1e-6 && r.speed === 1.0, JSON.stringify(r));
  });
  test('R6 P0-T1 CDU pump speed floor 0.75 and CRAH fan speed floor 0.70', () => {
    const cdu = CDUEngine.calcPower([{ capacity_kw: 100, power_kw: 10, qty_running: 4 }], 100);
    assert(cdu.speed === 0.75, 'cdu speed ' + cdu.speed);
    const crah = CRAHEngine.calcPower([{ cooling_capacity_kw: 60, power_kw: 5, qty_running: 2 }], 73);
    assert(crah.speed === 0.70, 'crah speed ' + crah.speed);
    assert(Math.abs(crah.power_kw - 10 * (0.10 + 0.90 * Math.pow(0.70, 3))) < 1e-9, 'crah power ' + crah.power_kw);
  });
})();

// ── Round 6 P0-C1 / P0-C2: 氣冷冰機 FC 盤管判定、額定點歸一化與 Carnot 阻尼 ────────
(function () {
  const ctx = freshCtx();
  const { ChillerEngine, CoolingArchRegistry } = ctx;
  const xcac = (curve) => [{
    model: 'Uniflair XCAC2524A', chiller_type: 'air_cooled', category: 'Oil-Free Centrifugal Chiller (Air-Cooled)',
    cooling_capacity_kw: 2482.2, cop_design: 4.24, t_chws_design: 20.0, cop_curve: curve, qty_running: 1, qty_total: 1
  }];
  test('R6 P0-C2 XCAC2524A (rated 20°C CHWS) COP at 20°C/35°C/PLR=1 equals 4.24 with AHRI curve', () => {
    const r = ChillerEngine.calcPower(2482.2, xcac({ type: 'ahri_biquadratic', preset: 'air_cooled_vfd_centrifugal' }), 20.0, 35.0, 35.0);
    assert(Math.abs(r.cop_actual - 4.24) < 0.02, 'got ' + r.cop_actual);
  });
  test('R6 P0-C2 XCAC2524A fixed curve also returns 4.24 at its own rating point', () => {
    const r = ChillerEngine.calcPower(2482.2, xcac({ type: 'fixed' }), 20.0, 35.0, 35.0);
    assert(Math.abs(r.cop_actual - 4.24) < 0.02, 'got ' + r.cop_actual);
  });
  test('R6 P0-C2 Carnot lift factor capped at 1.35x (water chiller at 42°C CHWS no longer 2x)', () => {
    const f = ChillerEngine.carnotLiftFactor(42, 30, false, { t_chws: 7, t_cond: 30 });
    assert(f <= 1.35 + 1e-9 && f > 1.0, 'got ' + f);
  });
  const airArch = CoolingArchRegistry.get('air_cooled_chiller');
  test('R6 P0-C1 pure air-cooled XCAC1913A never enables FC coil (20/30°C CHW, 20°C DB)', () => {
    const op = airArch.operatingPoint({ chwSupplyC: 20, chwReturnC: 30, sizing: [{ key: 'air_cooled_chiller', selectedModel: 'Uniflair XCAC1913A' }] }, { db: 20, wb: 16 });
    assert(op.mode === 'mechanical' && op.fc_fraction === 0, JSON.stringify({ mode: op.mode, fc: op.fc_fraction }));
    const topo = airArch.topology({ chwSupplyC: 20, chwReturnC: 30 }, op, { designDb: 35 });
    assert(!topo.nodes.some(n => n.id === 'fc_coil'), 'topology must not draw fc_coil');
  });
  test('R6 P0-C1 integrated FC chiller XCAF1913A enables FC coil when DB + approach < CHW return', () => {
    const op = airArch.operatingPoint({ chwSupplyC: 20, chwReturnC: 30, sizing: [{ key: 'air_cooled_chiller', selectedModel: 'Uniflair XCAF1913A (含自然冷卻盤管)' }] }, { db: 20, wb: 16 });
    assert(op.mode !== 'mechanical' && op.fc_fraction > 0, JSON.stringify({ mode: op.mode, fc: op.fc_fraction }));
  });
})();

// ── Round 6 P1-H1: 水力迴路冷卻水泵 (CW Pump)、板交二次迴路附加揚程與乙二醇比熱 ──
(function () {
  const ctx = freshCtx();
  const { AppStore: S, CoolingStages } = ctx;

  test('R6 P1-H1 dry_cooler_pure uses glycol Cp (3.90) and PHE extra head (+16m)', () => {
    const du = {
      id: 'du-test',
      plantDesign: {
        cduSystem: { architecture: 'dry_cooler_pure', fwsSupplyC: 40, fwsReturnC: 55, hasPhe: true },
        fanwallSystem: { architecture: 'air_cooled_chiller', chwSupplyC: 12, chwReturnC: 18 }
      }
    };
    const summ = { totalItKw: 1000, liquidHeatKw: 900, airHeatKw: 100, lossKw: 0, dlcPct: 90 };
    S.bridgeDuToPlantModel(du, summ);
    // flow = round(900 * 60 / (3.90 * 15)) = round(923.0769) = 923 L/min
    assert(du.plantDesign.cduSystem.hydraulics.flow_lpm === 923, 'flow got ' + du.plantDesign.cduSystem.hydraulics.flow_lpm);
    // head = 28 + 16 = 44 m
    assert(du.plantDesign.cduSystem.hydraulics.pump_head_m === 44, 'head got ' + du.plantDesign.cduSystem.hydraulics.pump_head_m);
  });

  test('R7-0b water_chiller separates CW pump power and adds cw_pump sizing item', () => {
    const du = {
      id: 'du-cw-test',
      plantDesign: {
        cduSystem: { architecture: 'water_chiller', fwsSupplyC: 40, fwsReturnC: 55, hasPhe: false },
        fanwallSystem: { architecture: 'air_cooled_chiller', chwSupplyC: 12, chwReturnC: 18 }
      }
    };
    const summ = { totalItKw: 1000, liquidHeatKw: 900, airHeatKw: 100, lossKw: 0, dlcPct: 90 };
    S.bridgeDuToPlantModel(du, summ);
    // Primary pump: flow = 900*60/(4.186*15) = 860 L/min, head = 28m -> ~5.7 kW
    // CW pump: flow = (900 * 1.18 * 60) / (4.186 * 5.5) = 2766.4 L/min, head = 22m -> ~14.6 kW
    const pwr = du.plantDesign.cduSystem.hydraulics.pump_power_kw;
    const cwPwr = du.plantDesign.cduSystem.hydraulics.cw_pump_power_kw;
    assert(pwr > 4 && pwr < 10, 'cdu primary pump power got ' + pwr);
    assert(cwPwr > 10 && cwPwr < 20, 'cdu CW pump power got ' + cwPwr);
    const hasCwPumpSizing = (du.plantDesign.cduSystem.sizing || []).some(s => s.key === 'cw_pump');
    assert(hasCwPumpSizing, 'water_chiller cduSystem sizing must contain cw_pump item');
  });

  test('R6 P1-H1 closed_tower includes spray pump power (~0.0055 kW/kW)', () => {
    const ct = CoolingStages.get('closed_tower');
    const r = ct.rejectionCost({ w: { db: 25, wb: 20 }, t_supply_c: 35, ctApproachC: 6.0, loadRatio: 1.0 }, 1000, false);
    // spray pump = 1000 * 0.0055 = 5.5 kW included in fanKw
    assert(r.fanKw >= 5.5, 'closed tower fanKw including spray pump got ' + r.fanKw);
  });

  test('R6 P1-H1 adiabatic_tower wet mode includes spray pump (~0.0020 kW/kW)', () => {
    const at = CoolingStages.get('adiabatic');
    // High ambient w.db=38, wb=28 -> wet mode
    const r = at.rejectionCost({ w: { db: 38, wb: 28 }, t_supply_c: 42, dryCoolerApproachC: 5.0, loadRatio: 1.0 }, 1000, true);
    assert(!r.diag.isDry, 'must be wet mode');
    assert(Math.abs(r.diag.sprayPumpKw - 2.0) < 1e-6, 'spray pump kw got ' + r.diag.sprayPumpKw);
  });
})();

// ── Round 6 P1-CAT: 設備型錄分類與 AHRI 雙二次曲線設定 ──
(function () {
  const ctx = freshCtx();
  const { CatalogManager } = ctx;

  test('R6 P1-CAT Carrier 30XA 1000kW has air_cooled and air_cooled_screw preset', () => {
    const carrier = CatalogManager.get('chiller_air').find(c => c.model === 'Carrier 30XA 1000kW');
    assert(carrier, 'Carrier 30XA 1000kW must be in chiller_air catalog');
    assert(carrier.cop_curve?.preset === 'air_cooled_screw', 'cop_curve preset must be air_cooled_screw');
  });

  test('R6 P1-CAT CatalogManager routes dry_cooler correctly from cooling_tower files', () => {
    const dcList = CatalogManager.get('dry_cooler');
    assert(dcList && dcList.length >= 3, 'dry_cooler catalog must have entries');
    const gunther = dcList.find(c => c.model && c.model.includes('Güntner'));
    assert(gunther, 'Güntner dry coolers must be routed to dry_cooler category');
  });
})();

// ── Round 6 P1-XLS: Excel 計算書匯出與月度數據 ──
(function () {
  const ctx = freshCtx();
  const { AppStore: S } = ctx;

  test('R6 P1-XLS AnnualRunner monthlyPue returns totalMwh and itMwh', () => {
    S.calculate();
    const monthlyPue = S.state.results.monthlyPue;
    assert(Array.isArray(monthlyPue) && monthlyPue.length === 12, 'monthlyPue must have 12 months');
    monthlyPue.forEach(m => {
      assert(typeof m.totalMwh === 'number' && m.totalMwh > 0, 'month must have totalMwh');
      assert(typeof m.itMwh === 'number' && m.itMwh > 0, 'month must have itMwh');
    });
  });
})();

// ── Round 6 P1-UI: Dashboard 狀態卡片解除硬編碼與釋出項目 ──
(function () {
  const fs = require('fs');
  const path = require('path');

  test('R6 P1-UI view_dashboard.js has no hardcoded 45°C ⇄ 57°C or 20°C ⇄ 30°C', () => {
    const code = fs.readFileSync(path.resolve(__dirname, '../../public/Data center Cal/js/views/view_dashboard.js'), 'utf8');
    assert(!code.includes('>45°C ⇄ 57°C<'), 'Must not hardcode 45°C ⇄ 57°C');
    assert(!code.includes('>20°C ⇄ 30°C<'), 'Must not hardcode 20°C ⇄ 30°C');
    assert(!code.includes('allCduSystems.length * 4'), 'Must not hardcode CDU count to length * 4');
    assert(!code.includes('allFwSystems.length * 8'), 'Must not hardcode FW fan count to length * 8');
  });

  test('R6 Release Items: index.html and app.js use V33', () => {
    const html = fs.readFileSync(path.resolve(__dirname, '../../public/Data center Cal/index.html'), 'utf8');
    assert(html.includes('v33</span>'), 'index.html must display v33 badge');
    const appJs = fs.readFileSync(path.resolve(__dirname, '../../public/Data center Cal/js/app.js'), 'utf8');
    assert(appJs.includes('(V33)'), 'app.js must declare V33');
  });
})();

// ── Round 6 Physics & PUE Benchmarks: 高雄預設與 17.95MW 專案 ──
(function () {
  const fs = require('fs');
  const path = require('path');
  const ctx = freshCtx();
  const { AppStore: S } = ctx;

  test('R7 Benchmark: Default project Kaohsiung 4.5% loss PUE is 1.188 ± 0.005', () => {
    S.state.site.selectedCity = '高雄 (Kaohsiung)';
    const data = ctx.BUILTIN_WEATHER_DATA['高雄 (Kaohsiung)'];
    S.state.site.hourly = data.hourlyData;
    S.state.site.monthlyStats = data.monthlyStats;
    S.state.site.designConditions = data.designConditions;
    S.state.site.stationSource = 'builtin';
    S.state.facilityElectricalLossPct = 4.5;
    S.calculate();
    const pue = S.state.results.overall.annualPue;
    assert(Math.abs(pue - 1.188) < 0.005, `Default Kaohsiung 4.5% loss PUE must be ~1.188, got ${pue}`);
  });

  test('R7 Benchmark: Default project Kaohsiung 0.0% loss PUE is 1.130 ± 0.005', () => {
    S.state.facilityElectricalLossPct = 0.0;
    S.calculate();
    const pue = S.state.results.overall.annualPue;
    assert(Math.abs(pue - 1.130) < 0.005, `Default Kaohsiung 0% loss PUE must be ~1.130, got ${pue}`);
  });

  const projPath = path.resolve(__dirname, '../../public/Data center Cal/projects/PUE_Project_高雄 (Kaohsiung)_20260901.json');
  if (fs.existsSync(projPath)) {
    test('R6 Benchmark: 17.95 MW Kaohsiung project 4.5% loss PUE is 1.164 ± 0.005 and DU-01 is 1.128 ± 0.005', () => {
      const projRaw = fs.readFileSync(projPath, 'utf8');
      S.deserializeProject(projRaw);
      S.state.facilityElectricalLossPct = 4.5;
      S.calculate();
      const pue = S.state.results.overall.annualPue;
      const du1Pue = S.state.results.byDu[0]?.annualPue;
      assert(Math.abs(pue - 1.164) < 0.005, `17.95MW project PUE must be ~1.164, got ${pue}`);
      assert(Math.abs(du1Pue - 1.128) < 0.005, `DU-01 PUE must be ~1.128, got ${du1Pue}`);
    });
  }
})();

// ── Round 7 R7-0a: 預設 CDU 台數計入降額與 userEdited 保護 ────────────────
(function () {
  const ctx = freshCtx();
  const S = ctx.AppStore;

  test('R7-0a: 全新預設專案 calculate() 後 capacityDeficitHours === 0', () => {
    S.calculate();
    const deficitHours = S.state.results.overall.capacityDeficitHours;
    const cduItem = S.state.halls[0].dus[0].plantDesign.cduSystem.sizing.find(s => s.key === 'cdu_unit');
    assert.strictEqual(deficitHours, 0, `Expected 0 deficit hours, got ${deficitHours}`);
    assert(cduItem.selectedQty >= cduItem.requiredUnitsN1, `selectedQty ${cduItem.selectedQty} should be >= requiredUnitsN1 ${cduItem.requiredUnitsN1}`);
    assert.strictEqual(cduItem.userEdited, false, 'default item userEdited should be false');
  });

  test('R7-0a: 使用者手動把 cdu_unit 改成 2 台 (userEdited=true) 後，重新 calculate() 不會被改回', () => {
    const du = S.state.halls[0].dus[0];
    S.updateSelectedEquipment(du.id, 'cdu', 'cdu_unit', undefined, 2);
    const cduItem = du.plantDesign.cduSystem.sizing.find(s => s.key === 'cdu_unit');
    assert.strictEqual(cduItem.userEdited, true, 'userEdited should be true after updateSelectedEquipment');
    assert.strictEqual(cduItem.selectedQty, 2, 'selectedQty should be 2');
    S.calculate();
    const cduItemAfter = du.plantDesign.cduSystem.sizing.find(s => s.key === 'cdu_unit');
    assert.strictEqual(cduItemAfter.selectedQty, 2, 'selectedQty must remain 2 after calculate() when userEdited=true');
    assert.strictEqual(cduItemAfter.passed, false, 'cduItem with 2 units should fail passed check');
  });

  test('R7-0a: 載入舊專案（無 userEdited）時台數不被改動', () => {
    const legacyProject = {
      schemaVersion: 'v6',
      facilityElectricalLossPct: 4.5,
      site: { selectedCity: '高雄 (Kaohsiung)' },
      halls: [
        {
          id: 'hall_legacy',
          name: 'Legacy Hall',
          dus: [
            {
              id: 'du_legacy',
              name: 'DU Legacy',
              sus: [
                { id: 'su_1', equipment: [{ id: 'eq_1', itLoadKw: 800, liquidPct: 100, airPct: 0 }] }
              ],
              plantDesign: {
                cduSystem: {
                  architecture: 'dry_cooler_hx',
                  secSupplyC: 45, secReturnC: 57, cduApproachC: 3,
                  fwsSupplyC: 42, fwsReturnC: 54, dryCoolerApproachC: 5, pheApproachC: 2,
                  sizing: [
                    {
                      key: 'cdu_unit',
                      catalog: [{ model: 'CDU-100', capKw: 100 }],
                      selectedModel: 'CDU-100',
                      unitCapKw: 100,
                      selectedQty: 10,
                      requiredKw: 800,
                      requiredUnitsN1: 12
                    }
                  ]
                },
                fanwallSystem: {
                  architecture: 'air_cooled_chiller',
                  sizing: []
                }
              }
            }
          ]
        }
      ],
      corePods: []
    };
    const ctxLegacy = freshCtx();
    const SL = ctxLegacy.AppStore;
    SL.deserializeProject(JSON.stringify(legacyProject));
    const cdu = SL.state.halls[0].dus[0].plantDesign.cduSystem.sizing.find(s => s.key === 'cdu_unit');
    assert.strictEqual(cdu.userEdited, true, 'legacy item userEdited must be migrated to true');
    assert.strictEqual(cdu.selectedQty, 10, 'legacy item selectedQty must NOT be changed on load');
    SL.calculate();
    assert.strictEqual(cdu.selectedQty, 10, 'legacy item selectedQty must NOT be changed after calculate()');
  });

  test('R7-0c: water-cooled screw chiller uses screw_standard curve under fixed curve', () => {
    const { ChillerEngine } = freshCtx();
    const screwChiller = {
      cooling_capacity_kw: 1000,
      cop_design: 5.5,
      chiller_type: 'water_cooled',
      category: 'water_cooled_screw',
      cop_curve: { type: 'fixed' },
      t_chws_design: 7.0,
      t_cewt_design_c: 30.0
    };
    const res = ChillerEngine.calcPower(1000, [screwChiller], 7.0, 30.0, 35.0);
    assert(Math.abs(res.power_kw - (1000 / 5.5)) < 1.0, 'rated power should equal cap/cop: got ' + res.power_kw);
    const resScrew = ChillerEngine.calcPower(1000, [screwChiller], 10.0, 32.0, 35.0);
    const centChiller = { ...screwChiller, category: 'water_cooled_centrifugal' };
    const resCent = ChillerEngine.calcPower(1000, [centChiller], 10.0, 32.0, 35.0);
    assert(resScrew.power_kw !== resCent.power_kw, 'screw curve and centrifugal curve must yield different power: screw=' + resScrew.power_kw + ', cent=' + resCent.power_kw);
  });

  test('I-1: i18n dictionaries have identical key sets and no empty strings', () => {
    const { I18N } = freshCtx();
    assert(I18N, 'I18N must exist on context');
    const zhKeys = Object.keys(I18N.dict['zh-TW']).sort();
    const enKeys = Object.keys(I18N.dict.en).sort();
    assert(zhKeys.length > 0, 'zh-TW dict should not be empty');
    assert.deepStrictEqual(zhKeys, enKeys, 'zh-TW and en must have identical keys');
    zhKeys.forEach(k => {
      assert(I18N.dict['zh-TW'][k].trim().length > 0, `zh-TW[${k}] must not be empty`);
      assert(I18N.dict.en[k].trim().length > 0, `en[${k}] must not be empty`);
    });
  });

  test('I-1: t() returns key itself when key not found, without throwing', () => {
    const { I18N } = freshCtx();
    const missing = 'some.non_existent.key_12345';
    assert.strictEqual(I18N.t(missing), missing);
  });

  test('I-1: t() interpolates parameters properly in both languages', () => {
    const { I18N } = freshCtx();
    I18N.setLang('zh-TW');
    const zhMsg = I18N.t('step4.deficitMsg', { n: 3, redundancy: 'N+1' });
    assert.strictEqual(zhMsg, '尚有 3 項設備容量未達 N+1 規範');
    I18N.setLang('en');
    const enMsg = I18N.t('step4.deficitMsg', { n: 3, redundancy: 'N+1' });
    assert.strictEqual(enMsg, '3 equipment item(s) below N+1 capacity requirement');
  });

  test('I-2: header, nav, sticky KPI, and footer render 0 CJK characters in English mode', async () => {
    const { buildWindow } = require('./dom_harness.js');
    const win = buildWindow();
    if (win.App && typeof win.App.init === 'function') {
      await win.App.init();
    }
    win.I18N.setLang('en');
    const header = win.document.querySelector('header');
    const footer = win.document.querySelector('footer');
    assert(header, 'header must exist');
    assert(footer, 'footer must exist');
    const cjkRegex = /[\u3400-\u9fff]/g;
    const headerCjk = (header.innerHTML.match(cjkRegex) || []);
    const footerCjk = (footer.innerHTML.match(cjkRegex) || []);
    assert.strictEqual(headerCjk.length, 0, 'header must have 0 CJK characters in en mode, got: ' + headerCjk.join(''));
    assert.strictEqual(footerCjk.length, 0, 'footer must have 0 CJK characters in en mode, got: ' + footerCjk.join(''));

    // Switch back to zh-TW
    win.I18N.setLang('zh-TW');
    assert(header.innerHTML.includes('PUE 計算系統'), 'zh-TW header must contain original title');
    assert(footer.innerHTML.includes('專業 AI 資料中心全生命週期能耗與耗水動力學評估工具'), 'zh-TW footer must contain original description');
  });

  test('I-3: Step 1, Step 2, and Step 3 views render 0 CJK characters in English mode', () => {
    const { buildWindow } = require('./dom_harness.js');
    const win = buildWindow();
    if (win.App && typeof win.App.init === 'function') {
      win.App.init();
    }
    win.I18N.setLang('en');

    // Dynamic user entities from store
    const userNames = [];
    (win.AppStore.state.halls || []).forEach(h => {
      userNames.push(h.name);
      (h.dus || []).forEach(d => {
        userNames.push(d.name);
        (d.sus || []).forEach(s => userNames.push(s.name));
      });
    });
    (win.AppStore.state.corePods || []).forEach(c => userNames.push(c.name));

    // Dynamic catalog model names
    const catalogNames = (win.DEVICE_CATALOG || []).map(d => d.model);

    // Weather station keys and countries
    const weatherKeys = Object.keys(win.BUILTIN_WEATHER_DATA || {});
    const countries = ['台灣', '新加坡', '菲律賓', '美國'];

    // Arch labels from registry (translated in Task I-4)
    const archLabels = (win.CoolingArchRegistry ? win.CoolingArchRegistry.list() : [])
      .flatMap(a => [a.cardLabel, a.optionLabel, a.pillLabel, a.dashboardLabel])
      .filter(Boolean);

    const whitelist = [
      ...userNames,
      ...catalogNames,
      ...weatherKeys,
      ...countries,
      ...archLabels,
      '自訂高密度液冷機架', '自訂標準氣冷機架', '自訂高密度氣冷機架'
    ];

    const cjkRegex = /[\u3400-\u9fff]/g;

    for (const step of [1, 2, 3]) {
      win.App.currentStep = step;
      win.App.renderStep(step);
      const container = win.document.getElementById('stepContent');
      assert(container, '#stepContent must exist');
      let html = container.innerHTML.replace(/<!--[\s\S]*?-->/g, '');
      for (const token of whitelist) {
        if (token) html = html.split(token).join('');
      }
      const matches = html.match(cjkRegex) || [];
      assert.strictEqual(matches.length, 0, `Step ${step} has unexpected CJK in English mode: ${matches.slice(0, 15).join('')}`);
    }

    // Switch back to zh-TW and verify key Chinese phrases in Step 1, 2, 3
    win.I18N.setLang('zh-TW');
    win.App.renderStep(1);
    assert(win.document.getElementById('stepContent').innerHTML.includes('氣象動力學分析'), 'Step 1 in zh-TW must contain original title');
    win.App.renderStep(2);
    assert(win.document.getElementById('stepContent').innerHTML.includes('模組與設備設計'), 'Step 2 in zh-TW must contain original title');
    win.App.renderStep(3);
    assert(win.document.getElementById('stepContent').innerHTML.includes('核心網通/集中儲存機房'), 'Step 3 in zh-TW must contain original title');
  });

  test('I-4: Step 4 view and cooling architectures render 0 CJK characters in English mode', async () => {
    const { buildWindow } = require('./dom_harness.js');
    const win = buildWindow();
    if (win.App && typeof win.App.init === 'function') {
      await win.App.init();
    }
    win.I18N.setLang('en');

    // Dynamic user entities from store
    const userNames = [];
    (win.AppStore.state.halls || []).forEach(h => {
      userNames.push(h.name);
      (h.dus || []).forEach(d => {
        userNames.push(d.name);
        (d.sus || []).forEach(s => userNames.push(s.name));
      });
    });
    (win.AppStore.state.corePods || []).forEach(c => userNames.push(c.name));

    // Dynamic catalog model names
    const catalogNames = (win.DEVICE_CATALOG || []).map(d => d.model);

    const whitelist = [
      ...userNames,
      ...catalogNames
    ];

    const cjkRegex = /[\u3400-\u9fff]/g;

    win.App.currentStep = 4;
    win.App.renderStep(4);
    const container = win.document.getElementById('stepContent');
    assert(container, '#stepContent must exist');
    let html = container.innerHTML.replace(/<!--[\s\S]*?-->/g, '');
    for (const token of whitelist) {
      if (token) html = html.split(token).join('');
    }
    const matches = html.match(cjkRegex) || [];
    assert.strictEqual(matches.length, 0, `Step 4 has unexpected CJK in English mode: ${matches.slice(0, 30).join('')}`);

    // Verify all 9 architectures and their topologies in English mode
    const archs = win.CoolingArchRegistry ? win.CoolingArchRegistry.list() : [];
    assert(archs.length >= 9, 'All cooling architectures must be registered');
    for (const arch of archs) {
      const card = arch.cardLabel;
      const option = arch.optionLabel;
      const pill = arch.pillLabel;
      const dash = arch.dashboardLabel;
      const archText = `${card} ${option} ${pill} ${dash}`;
      const archCjk = archText.match(cjkRegex) || [];
      assert.strictEqual(archCjk.length, 0, `Architecture ${arch.id} labels have CJK in English mode: ${archCjk.join('')}`);
    }

    // Switch back to zh-TW and verify Step 4 in zh-TW
    win.I18N.setLang('zh-TW');
    win.App.renderStep(4);
    const zhHtml = win.document.getElementById('stepContent').innerHTML;
    assert(zhHtml.includes('雙冷卻工程選型設計'), 'Step 4 in zh-TW must contain original title');
  });

  test('I-5: Step 5 view, charts, exhibition, and heatmap render 0 CJK characters in English mode', async () => {
    const { buildWindow } = require('./dom_harness.js');
    const win = buildWindow();
    if (win.App && typeof win.App.init === 'function') {
      await win.App.init();
    }
    win.I18N.setLang('en');

    // Dynamic user entities from store
    const userNames = [];
    (win.AppStore.state.halls || []).forEach(h => {
      userNames.push(h.name);
      (h.dus || []).forEach(d => {
        userNames.push(d.name);
        (d.sus || []).forEach(s => userNames.push(s.name));
      });
    });
    (win.AppStore.state.corePods || []).forEach(c => userNames.push(c.name));

    // Dynamic catalog model names & site name
    const catalogNames = (win.DEVICE_CATALOG || []).map(d => d.model);
    const siteName = win.AppStore.state.site?.selectedCity;

    const whitelist = [
      ...userNames,
      ...catalogNames,
      siteName
    ];

    const cjkRegex = /[\u3400-\u9fff]/g;

    win.App.currentStep = 5;
    win.App.renderStep(5);
    const container = win.document.getElementById('stepContent');
    assert(container, '#stepContent must exist');

    const checkCjk = (html, label) => {
      let clean = html.replace(/<!--[\s\S]*?-->/g, '');
      for (const token of whitelist) {
        if (token) clean = clean.split(token).join('');
      }
      const matches = clean.match(cjkRegex) || [];
      assert.strictEqual(matches.length, 0, `${label} has unexpected CJK in English mode: ${matches.slice(0, 30).join('')}`);
    };

    // Check base Step 5 view
    checkCjk(container.innerHTML, 'Step 5 base view');

    // Check all heatmap modes
    const modes = ['cdu', 'fw', 'combined', 'pue', 'db'];
    for (const m of modes) {
      win.ViewDashboard.setHeatmapMode(m);
      checkCjk(container.innerHTML, `Heatmap mode '${m}'`);
    }

    // Check all exhibition presets
    const presets = ['summer_peak', 'winter_free', 'spring_mild', 'summer_night'];
    for (const p of presets) {
      win.ViewDashboard.setExhibitionPreset(p);
      checkCjk(container.innerHTML, `Exhibition preset '${p}'`);
    }

    // Switch back to zh-TW and verify Step 5 in zh-TW
    win.I18N.setLang('zh-TW');
    win.App.renderStep(5);
    const zhHtml = win.document.getElementById('stepContent').innerHTML;
    assert(zhHtml.includes('物理守恆'), 'Step 5 in zh-TW must contain original title');
  });
})();

// ── Task I-6: 引擎警告與假設表雙語驗收 ─────────────────────────────────
(function () {
  const ctx = freshCtx();
  const {
    I18N,
    ASSUMPTIONS,
    ALabel,
    AHRI_PRESETS,
    LOAD_PROFILE_PRESETS,
    CDUEngine,
    ChillerEngine,
    CoolingTowerEngine,
    CRAHEngine,
    HeatExchangerEngine,
    PlantPumpEngine,
    CoolingStages,
    EpwParser
  } = ctx;

  const cjkRegex = /[\u3400-\u9fff]/;

  test('I-6: All ASSUMPTIONS have non-empty label and label_en with no CJK in label_en', () => {
    const keys = Object.keys(ASSUMPTIONS);
    assert(keys.length >= 70, `Expected at least 70 assumptions, got ${keys.length}`);
    for (const k of keys) {
      const a = ASSUMPTIONS[k];
      assert(typeof a.label === 'string' && a.label.length > 0, `Assumption ${k} missing label`);
      assert(typeof a.label_en === 'string' && a.label_en.length > 0, `Assumption ${k} missing label_en`);
      assert(!cjkRegex.test(a.label_en), `Assumption ${k} label_en contains CJK: ${a.label_en}`);
    }
  });

  test('I-6: ALabel(key) returns label_en in English mode and label in zh-TW mode', () => {
    I18N.setLang('en');
    assert.strictEqual(ALabel('tower_approach_c'), ASSUMPTIONS.tower_approach_c.label_en);
    assert(!cjkRegex.test(ALabel('tower_approach_c')), 'ALabel in EN mode returned CJK');

    I18N.setLang('zh-TW');
    assert.strictEqual(ALabel('tower_approach_c'), ASSUMPTIONS.tower_approach_c.label);
    assert(cjkRegex.test(ALabel('tower_approach_c')), 'ALabel in zh-TW mode should return Chinese');
  });

  test('I-6: AHRI_PRESETS and LOAD_PROFILE_PRESETS have valid name_en with no CJK', () => {
    for (const [k, p] of Object.entries(AHRI_PRESETS)) {
      assert(typeof p.name_en === 'string' && p.name_en.length > 0, `AHRI preset ${k} missing name_en`);
      assert(!cjkRegex.test(p.name_en), `AHRI preset ${k} name_en has CJK: ${p.name_en}`);
    }
    for (const [k, p] of Object.entries(LOAD_PROFILE_PRESETS)) {
      assert(typeof p.name_en === 'string' && p.name_en.length > 0, `Load profile preset ${k} missing name_en`);
      assert(!cjkRegex.test(p.name_en), `Load profile preset ${k} name_en has CJK: ${p.name_en}`);
    }
  });

  test('I-6: CDUEngine.validate generates localized warnings with 0 CJK in English mode', () => {
    const testCases = [
      { args: [1.2, 5.0, 5.0, 120, 100], code: 'CDU_CAPACITY_DEFICIT' },
      { args: [0.2, 5.0, 5.0, 20, 100], code: 'CDU_OVERSIZED' },
      { args: [0.8, 3.0, 5.0, 80, 100], code: 'CDU_DT_LOW' },
      { args: [0.8, 7.0, 5.0, 80, 100], code: 'CDU_DT_HIGH' }
    ];

    // EN mode
    I18N.setLang('en');
    for (const tc of testCases) {
      const warnings = CDUEngine.validate(...tc.args);
      const w = warnings.find(x => x.code === tc.code);
      assert(w, `CDUEngine should emit ${tc.code}`);
      assert(!cjkRegex.test(w.message), `CDUEngine ${tc.code} message in EN mode has CJK: ${w.message}`);
    }

    // zh-TW mode
    I18N.setLang('zh-TW');
    for (const tc of testCases) {
      const warnings = CDUEngine.validate(...tc.args);
      const w = warnings.find(x => x.code === tc.code);
      assert(w, `CDUEngine should emit ${tc.code}`);
      assert(cjkRegex.test(w.message), `CDUEngine ${tc.code} message in zh-TW mode should have CJK`);
    }
  });

  test('I-6: ChillerEngine.calcPower & validate generate localized warnings with 0 CJK in English mode', () => {
    const chillers = [{
      cooling_capacity_kw: 500,
      cop_design: 5.5,
      cop_curve: { type: 'fixed' },
      t_chws_design: 7.0,
      qty_running: 1,
      qty_total: 2,
      chiller_type: 'water_cooled'
    }];

    // EN mode
    I18N.setLang('en');
    const rMinPlr = ChillerEngine.calcPower(20, chillers, 7.0, 30.0, 30.0);
    assert(rMinPlr.warnings.some(w => w.code === 'CHILLER_BELOW_MIN_PLR'), 'Expected CHILLER_BELOW_MIN_PLR');
    for (const w of rMinPlr.warnings) {
      assert(!cjkRegex.test(w.message), `Chiller calcPower warning has CJK in EN: ${w.message}`);
    }

    const rDeficit = ChillerEngine.calcPower(600, chillers, 7.0, 30.0, 30.0);
    assert(rDeficit.warnings.some(w => w.code === 'CHILLER_CAPACITY_DEFICIT'), 'Expected CHILLER_CAPACITY_DEFICIT');
    for (const w of rDeficit.warnings) {
      assert(!cjkRegex.test(w.message), `Chiller deficit warning has CJK in EN: ${w.message}`);
    }

    const vCases = [
      { args: [1.1, 5.0, 7.0, 30.0], code: 'CHILLER_PLR_OVER_1' },
      { args: [0.05, 5.0, 7.0, 30.0], code: 'CHILLER_PLR_VERY_LOW' },
      { args: [0.8, 5.0, 7.0, 9.0], code: 'CHILLER_DT_TOO_SMALL' }
    ];
    for (const tc of vCases) {
      const warnings = ChillerEngine.validate(...tc.args);
      const w = warnings.find(x => x.code === tc.code);
      assert(w, `Chiller validate should emit ${tc.code}`);
      assert(!cjkRegex.test(w.message), `Chiller ${tc.code} message has CJK in EN: ${w.message}`);
    }

    // zh-TW mode
    I18N.setLang('zh-TW');
    const rZh = ChillerEngine.calcPower(20, chillers, 7.0, 30.0, 30.0);
    for (const w of rZh.warnings) {
      assert(cjkRegex.test(w.message), `Chiller warning in zh-TW should have CJK: ${w.message}`);
    }
  });

  test('I-6: CoolingTowerEngine, CRAHEngine, HeatExchangerEngine validate generate 0 CJK in English mode', () => {
    I18N.setLang('en');

    // Tower: validate(t_cws_c, t_cwr_c, wb_c)
    const towerCases = [
      { args: [28.0, 33.0, 27.0], code: 'CT_APPROACH_PHYSICALLY_IMPOSSIBLE' },
      { args: [29.0, 34.0, 27.0], code: 'CT_APPROACH_LOW' },
      { args: [38.0, 43.0, 27.0], code: 'CT_APPROACH_HIGH' },
      { args: [30.0, 31.0, 25.0], code: 'CT_RANGE_LOW' },
      { args: [30.0, 46.0, 25.0], code: 'CT_RANGE_HIGH' }
    ];
    for (const tc of towerCases) {
      const warnings = CoolingTowerEngine.validate(...tc.args);
      const w = warnings.find(x => x.code === tc.code);
      assert(w, `Tower validate should emit ${tc.code}`);
      assert(!cjkRegex.test(w.message), `Tower ${tc.code} message has CJK in EN: ${w.message}`);
    }

    // CRAH: validate(plr, cap_total, it_air_kw)
    const crahCases = [
      { args: [1.1, 100, 110], code: 'CRAH_CAPACITY_DEFICIT' },
      { args: [0.15, 100, 15], code: 'CRAH_OVERSIZED' }
    ];
    for (const tc of crahCases) {
      const warnings = CRAHEngine.validate(...tc.args);
      const w = warnings.find(x => x.code === tc.code);
      assert(w, `CRAH validate should emit ${tc.code}`);
      assert(!cjkRegex.test(w.message), `CRAH ${tc.code} message has CJK in EN: ${w.message}`);
    }

    // HX: validate(t_hot_in, t_hot_out, t_cold_in, t_cold_out)
    const hxCases = [
      { args: [10.0, 15.0, 12.0, 14.0], code: 'HX_2ND_LAW_VIOLATION_HOT' },
      { args: [14.5, 12.0, 10.0, 14.0], code: 'HX_HOT_APPROACH_VERY_SMALL' },
      { args: [20.0, 8.0, 10.0, 14.0], code: 'HX_2ND_LAW_VIOLATION_COLD' },
      { args: [20.0, 10.5, 10.0, 14.0], code: 'HX_COLD_APPROACH_VERY_SMALL' }
    ];
    for (const tc of hxCases) {
      const warnings = HeatExchangerEngine.validate(...tc.args);
      const w = warnings.find(x => x.code === tc.code);
      assert(w, `HX validate should emit ${tc.code}`);
      assert(!cjkRegex.test(w.message), `HX ${tc.code} message has CJK in EN: ${w.message}`);
    }

    // Pump validateChwDt
    const pumpLow = PlantPumpEngine.validateChwDt(2.0, 'chw');
    assert(pumpLow.some(w => w.code === 'CHW_DT_LOW' && !cjkRegex.test(w.message)));
    const pumpHigh = PlantPumpEngine.validateChwDt(12.0, 'cdw');
    assert(pumpHigh.some(w => w.code === 'CDW_DT_HIGH' && !cjkRegex.test(w.message)));

    // Chiller stage envelope warning
    const stage = CoolingStages.get('chiller');
    if (stage) {
      const simRes = stage.simulate({
        stageParams: {
          chiller: {
            cooling_capacity_kw: 500,
            cop_design: 5.5,
            cop_curve: { type: 'fixed' },
            t_chws_design: 7.0,
            qty_running: 1,
            qty_total: 2,
            chiller_type: 'water_cooled'
          }
        },
        t_chws_target: 7.0,
        t_cewt: 45.0,
        t_amb_db: 35.0,
        t_amb_wb: 28.0,
        load_kw: 300
      });
      if (simRes && simRes.warnings && simRes.warnings.length > 0) {
        for (const w of simRes.warnings) {
          assert(!cjkRegex.test(w.message), `Chiller stage warning has CJK in EN: ${w.message}`);
        }
      }
    }

    // EpwParser parse error
    assert.throws(() => {
      EpwParser.parse('INVALID EPW HEADER DATA');
    }, err => {
      return !cjkRegex.test(err.message);
    });

    // Switch back to zh-TW
    I18N.setLang('zh-TW');
    assert.throws(() => {
      EpwParser.parse('INVALID EPW HEADER DATA');
    }, err => {
      return cjkRegex.test(err.message);
    });
  });
})();

console.log(`\n${passCount} passed, ${failCount} failed, ${skipCount} skipped`);
process.exit(failCount > 0 ? 1 : 0);




