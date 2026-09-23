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
  S2.calculate();
  const du = S2.state.halls[0].dus[0];
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

console.log(`\n${passCount} passed, ${failCount} failed, ${skipCount} skipped`);
process.exit(failCount > 0 ? 1 : 0);

