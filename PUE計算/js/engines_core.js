'use strict';

// ============================================================
// CORE: Shared math helpers and AHRI performance curve presets
// Must be loaded before all other engine files.
// ============================================================

// ─── Biquadratic / quadratic polynomial evaluators ────────
function biQuad([a1, a2, a3, a4, a5, a6], T, C) {
  return a1 + a2*T + a3*T*T + a4*C + a5*C*C + a6*T*C;
}
function quadPoly([c1, c2, c3], x) {
  return c1 + c2*x + c3*x*x;
}
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}
function sumRunning(list, field) {
  if (!list || !list.length) return 0;
  return list.reduce((s, item) => {
    const n = item.qty_running ?? item.qty_total ?? 1;
    return s + n * (item[field] ?? 0);
  }, 0);
}

// ─── AHRI Biquadratic Performance Curve Presets ────────────
// Reference: T_chws=7°C, T_cewt=30°C, PLR=1.0 → all multipliers = 1.0
// CapFT / EIR_FT coef order: [a1..a6]  f(T,C)=a1+a2T+a3T²+a4C+a5C²+a6TC
// EIR_FPLR coef order: [c1,c2,c3]  f(PLR)=c1+c2·PLR+c3·PLR²
const AHRI_PRESETS = {
  centrifugal_standard: {
    name: '離心式冷機（標準）',
    note: 'Trane CTV / York YT / Carrier 19XR',
    CapFT:    [1.335,  0.025, 0.0,  -0.017, 0.0, 0.0],
    EIR_FT:   [0.406, -0.018, 0.0,   0.024, 0.0, 0.0],
    EIR_FPLR: [0.0617, 0.6923, 0.2460],
    t_chws_range: [4, 14],
    t_cewt_range: [18, 42]
  },
  centrifugal_higheff: {
    name: '離心式冷機（高效）',
    note: 'Trane Turbocor / York YVFA / Carrier AquaEdge',
    CapFT:    [1.364,  0.028, 0.0,  -0.019, 0.0, 0.0],
    EIR_FT:   [0.376, -0.022, 0.0,   0.021, 0.0, 0.0],
    EIR_FPLR: [0.030,  0.500, 0.470],
    t_chws_range: [4, 14],
    t_cewt_range: [16, 40]
  },
  screw_standard: {
    name: '螺旋式冷機（標準）',
    note: 'Trane RTWD / Carrier 30XA / Daikin EWWD',
    CapFT:    [1.298,  0.022, 0.0,  -0.015, 0.0, 0.0],
    EIR_FT:   [0.440, -0.015, 0.0,   0.026, 0.0, 0.0],
    EIR_FPLR: [0.020,  0.730, 0.250],
    t_chws_range: [4, 14],
    t_cewt_range: [20, 44]
  },
  air_cooled_screw: {
    name: '氣冷式冷機（螺旋/渦卷標準）',
    note: 'Carrier 30XA / Trane RTAC / York YVAA (Air-Cooled)',
    CapFT:    [1.085,  0.024, 0.0,  -0.012, 0.0, 0.0],
    EIR_FT:   [0.470, -0.014, 0.0,   0.018, 0.0, 0.0],
    EIR_FPLR: [0.040,  0.720, 0.240],
    t_chws_range: [4, 22],
    t_cewt_range: [15, 48]
  },
  air_cooled_vfd_centrifugal: {
    name: '氣冷式冷機（無油磁浮/高效離心）',
    note: 'Schneider Uniflair XCAC/XCAF / Smardt / Turbocor (Air-Cooled VFD)',
    CapFT:    [1.120,  0.026, 0.0,  -0.011, 0.0, 0.0],
    EIR_FT:   [0.410, -0.018, 0.0,   0.016, 0.0, 0.0],
    EIR_FPLR: [0.025,  0.520, 0.455],
    t_chws_range: [4, 25],
    t_cewt_range: [10, 48]
  }
};

const LOAD_PROFILE_PRESETS = {
  constant:   { name: '恆定滿載 (Constant 100%)', states: [{ load_pct: 100, weight_pct: 100, note: '基準滿載運行' }] },
  ai:         { name: 'AI 訓練週期 (AI Training Cycle)', states: [{ load_pct: 100, weight_pct: 70, note: 'AI 訓練階段' }, { load_pct: 25, weight_pct: 30, note: '待機 / 存檔點' }] },
  cloud:      { name: '商業雲端混合 (Cloud Hybrid - Day/Night)', states: [{ load_pct: 80, weight_pct: 50, note: '日間尖峰載' }, { load_pct: 40, weight_pct: 50, note: '夜間離峰載' }] },
  enterprise: { name: '企業辦公負載 (Enterprise / Office IT)', states: [{ load_pct: 75, weight_pct: 30, note: '上班時段尖峰' }, { load_pct: 20, weight_pct: 70, note: '非上班時段低載' }] },
  custom:     { name: '自訂負載 (Custom Load Profile)', states: [{ load_pct: 100, weight_pct: 50, note: '自訂狀態 1' }, { load_pct: 50, weight_pct: 50, note: '自訂狀態 2' }] }
};

// ─── Central Engineering Assumptions & Design Basis ───────────
// Unified reference for all engines — prevents scattered magic numbers.
// Based on ASHRAE 90.1-2022, AHRI 550/590, and DC Engineering Practice.
const EngineeringBasis = {
  // Cooling Tower (ASHRAE 2020 HVAC Systems Ch.40)
  CT_APPROACH_PHYSICAL_MIN_C: 1.5,  // 2nd Law absolute floor
  CT_APPROACH_MIN_C:          3.0,  // engineering warning below this
  CT_APPROACH_DESIGN_C:       5.0,  // ASHRAE typical open tower
  CT_APPROACH_MAX_C:          9.0,  // warning above this
  CT_RANGE_MIN_C:             2.0,  // below = flow excessive / load too light
  CT_RANGE_DESIGN_C:          5.5,  // typical HVAC range
  CT_RANGE_MAX_C:            14.0,  // critical above this = capacity deficit

  // Plate HX (AHRI 400)
  HX_APPROACH_DESIGN_C:       2.0,
  HX_APPROACH_MIN_C:          1.0,

  // CHW Loop
  CHW_DT_MIN_C:               3.0,
  CHW_DT_DESIGN_C:            5.0,
  CHW_DT_MAX_C:              12.0,

  // CDW Loop
  CDW_DT_MIN_C:               4.0,
  CDW_DT_DESIGN_C:            5.0,
  CDW_DT_MAX_C:              10.0,

  // CDU / Liquid Loop (GB300 / NVL72 warm-water)
  CDU_DT_MIN_C:               5.0,
  CDU_DT_DESIGN_C:           15.0,
  CDU_DT_MAX_C:              25.0,

  // Pump Hydraulics (ASHRAE 90.1 §6.5)
  CP_WATER:                   4.184,  // kJ/(kg·°C)
  WATER_DENSITY:           1000.0,    // kg/m³
  PUMP_STATIC_HEAD_FRAC:      0.15,   // affinity law base for static head
  PUMP_MIN_SPEED_VFD:         0.45,   // VFD absolute minimum speed

  // Chiller Staging (AHRI 550/590)
  CHILLER_PLR_OPTIMAL:        0.70,   // peak efficiency PLR
  CHILLER_PLR_STAGE_ON:       0.90,   // add next chiller above this PLR
  CHILLER_PLR_STAGE_OFF:      0.35,   // shed one chiller below this PLR
  CHILLER_COP_MIN:            2.5,    // practical warning floor
  CHILLER_COP_MAX:           12.0,    // practical warning ceiling
  CHILLER_COP_PHYSICAL_MAX:  15.0,   // 2nd Law ceiling

  // Free Cooling
  FC_PARTIAL_BAND_C:          3.0,    // partial FC transition width
  FC_SAFETY_MARGIN_C:         1.5,    // safety buffer above FC threshold

  // Dry Cooler (DB-based sensible rejection)
  DC_APPROACH_DESIGN_C:       5.0,

  // Plant Operating Modes by WB temperature
  PLANT_MODE: {
    SUMMER:   { wb_threshold_c: 24, pump_min_speed: 0.50, fan_min_speed: 0.40 },
    SHOULDER: { wb_threshold_c: 16, pump_min_speed: 0.40, fan_min_speed: 0.25 },
    WINTER:   { wb_threshold_c: -99, pump_min_speed: 0.30, fan_min_speed: 0.15 }
  }
};

if (typeof global !== 'undefined') {
  global.clamp = clamp;
  global.uuid = uuid;
  global.biQuad = biQuad;
  global.quadPoly = quadPoly;
  global.sumRunning = sumRunning;
  global.AHRI_PRESETS = AHRI_PRESETS;
  global.EngineeringBasis = EngineeringBasis;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { clamp, uuid, biQuad, quadPoly, sumRunning, AHRI_PRESETS, EngineeringBasis };
}
