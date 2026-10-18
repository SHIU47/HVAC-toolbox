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
    name_en: 'Centrifugal Chiller (Standard)',
    note: 'Trane CTV / York YT / Carrier 19XR',
    CapFT:    [1.335,  0.025, 0.0,  -0.017, 0.0, 0.0],
    EIR_FT:   [0.406, -0.018, 0.0,   0.024, 0.0, 0.0],
    EIR_FPLR: [0.0617, 0.6923, 0.2460],
    t_chws_range: [4, 14],
    t_cewt_range: [18, 42]
  },
  centrifugal_higheff: {
    name: '離心式冷機（高效）',
    name_en: 'Centrifugal Chiller (High Efficiency)',
    note: 'Trane Turbocor / York YVFA / Carrier AquaEdge',
    CapFT:    [1.364,  0.028, 0.0,  -0.019, 0.0, 0.0],
    EIR_FT:   [0.376, -0.022, 0.0,   0.021, 0.0, 0.0],
    EIR_FPLR: [0.030,  0.500, 0.470],
    t_chws_range: [4, 14],
    t_cewt_range: [16, 40]
  },
  screw_standard: {
    name: '螺旋式冷機（標準）',
    name_en: 'Screw Chiller (Standard)',
    note: 'Trane RTWD / Carrier 30XA / Daikin EWWD',
    CapFT:    [1.298,  0.022, 0.0,  -0.015, 0.0, 0.0],
    EIR_FT:   [0.440, -0.015, 0.0,   0.026, 0.0, 0.0],
    EIR_FPLR: [0.020,  0.730, 0.250],
    t_chws_range: [4, 14],
    t_cewt_range: [20, 44]
  },
  air_cooled_screw: {
    name: '氣冷式冷機（螺旋/渦卷標準）',
    name_en: 'Air-Cooled Chiller (Screw/Scroll Standard)',
    note: 'Carrier 30XA / Trane RTAC / York YVAA (Air-Cooled)',
    CapFT:    [1.085,  0.024, 0.0,  -0.012, 0.0, 0.0],
    EIR_FT:   [0.470, -0.014, 0.0,   0.018, 0.0, 0.0],
    EIR_FPLR: [0.040,  0.720, 0.240],
    t_chws_range: [4, 22],
    t_cewt_range: [15, 48]
  },
  air_cooled_vfd_centrifugal: {
    name: '氣冷式冷機（無油磁浮/高效離心）',
    name_en: 'Air-Cooled Chiller (Oil-Free Magnetic/High-Eff Centrifugal)',
    note: 'Schneider Uniflair XCAC/XCAF / Smardt / Turbocor (Air-Cooled VFD)',
    CapFT:    [1.120,  0.026, 0.0,  -0.011, 0.0, 0.0],
    EIR_FT:   [0.410, -0.018, 0.0,   0.016, 0.0, 0.0],
    EIR_FPLR: [0.025,  0.520, 0.455],
    t_chws_range: [4, 25],
    t_cewt_range: [10, 48]
  }
};

// 額定點：AHRI 550/590 水冷 LCHWT 7°C / ECWT 30°C；氣冷 LCHWT 7°C / 外氣 DB 35°C
const AHRI_RATING_POINT = { water: { t_chws: 7, t_cond: 30 }, air: { t_chws: 7, t_cond: 35 } };
for (const [key, p] of Object.entries(AHRI_PRESETS)) {
  const r = key.startsWith('air_') ? AHRI_RATING_POINT.air : AHRI_RATING_POINT.water;
  const fCap = biQuad(p.CapFT, r.t_chws, r.t_cond);
  const fEir = biQuad(p.EIR_FT, r.t_chws, r.t_cond);
  p.CapFT  = p.CapFT.map(c => c / fCap);
  p.EIR_FT = p.EIR_FT.map(c => c / fEir);
  p.rating = r;
}

const LOAD_PROFILE_PRESETS = {
  constant:   { name: '恆定滿載 (Constant 100%)', name_en: 'Constant 100%', states: [{ load_pct: 100, weight_pct: 100, note: '基準滿載運行' }] },
  ai:         { name: 'AI 訓練週期 (AI Training Cycle)', name_en: 'AI Training Cycle', states: [{ load_pct: 100, weight_pct: 70, note: 'AI 訓練階段' }, { load_pct: 25, weight_pct: 30, note: '待機 / 存檔點' }] },
  cloud:      { name: '商業雲端混合 (Cloud Hybrid - Day/Night)', name_en: 'Cloud Hybrid - Day/Night', states: [{ load_pct: 80, weight_pct: 50, note: '日間尖峰載' }, { load_pct: 40, weight_pct: 50, note: '夜間離峰載' }] },
  enterprise: { name: '企業辦公負載 (Enterprise / Office IT)', name_en: 'Enterprise / Office IT', states: [{ load_pct: 75, weight_pct: 30, note: '上班時段尖峰' }, { load_pct: 20, weight_pct: 70, note: '非上班時段低載' }] },
  custom:     { name: '自訂負載 (Custom Load Profile)', name_en: 'Custom Load Profile', states: [{ load_pct: 100, weight_pct: 50, note: '自訂狀態 1' }, { load_pct: 50, weight_pct: 50, note: '自訂狀態 2' }] }
};
// ─── Psychrometric: Magnus-Tetens approximation ───────────
function calcDewPointC(db_c, rh_pct) {
  const rh = Math.min(100, Math.max(0.1, rh_pct));
  const a = 17.27, b = 237.7;
  const alpha = (a * db_c) / (b + db_c) + Math.log(rh / 100);
  return (b * alpha) / (a - alpha);
}

if (typeof global !== 'undefined') {
  global.clamp = clamp;
  global.uuid = uuid;
  global.biQuad = biQuad;
  global.quadPoly = quadPoly;
  global.sumRunning = sumRunning;
  global.calcDewPointC = calcDewPointC;
  global.AHRI_PRESETS = AHRI_PRESETS;
  global.LOAD_PROFILE_PRESETS = LOAD_PROFILE_PRESETS;
}
if (typeof window !== 'undefined') {
  window.clamp = clamp;
  window.uuid = uuid;
  window.biQuad = biQuad;
  window.quadPoly = quadPoly;
  window.sumRunning = sumRunning;
  window.calcDewPointC = calcDewPointC;
  window.AHRI_PRESETS = AHRI_PRESETS;
  window.LOAD_PROFILE_PRESETS = LOAD_PROFILE_PRESETS;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { clamp, uuid, biQuad, quadPoly, sumRunning, calcDewPointC, AHRI_PRESETS, LOAD_PROFILE_PRESETS };
}
