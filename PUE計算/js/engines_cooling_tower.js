'use strict';

// ============================================================
// CoolingTowerEngine — evaporative cooling tower physics
// Depends on: engines_core.js
// Reference: ASHRAE 2020 HVAC Systems & Equipment Chapter 40
// ============================================================
const CoolingTowerEngine = {

  /**
   * CT leaving water temperature (cold water basin temperature).
   * T_cws = WB + Approach  (core physics identity)
   */
  calcLeavingWaterTemp(wb_c, approach_c) {
    return wb_c + approach_c;
  },

  /**
   * CT Range = T_cwr (hot) - T_cws (cold) — temperature drop across tower.
   * Range = Q_reject / (m_dot × Cp)
   * Typical range: 5-8°C for HVAC towers
   */
  calcRange(q_reject_kw, flow_lps, cp_kj_kg_c = 4.187) {
    if (flow_lps <= 0) return 0;
    return q_reject_kw / (flow_lps * cp_kj_kg_c);
  },

  /**
   * Design condenser water entering temp for chiller sizing.
   * T_cewt = WB + Approach  (same as leaving water temp from tower)
   */
  calcCondenserEnteringTemp(wb_c, approach_c) {
    return wb_c + approach_c;
  },

  /**
   * Physics-based approach temperature at a given WB.
   * At design WB: use design approach.
   * At lower WB: fan speed reduces → approach increases.
   * Curve: ΔAPP ≈ +0.12°C per 1°C below design WB.
   * @param {number} wb_c           - Current wet-bulb (°C)
   * @param {number} design_wb_c    - Design WB (p90 summer) (°C)
   * @param {number} design_approach_c - Design approach at design_wb (°C)
   * @param {Array}  [annual_data]  - Weather annual_data [{wb, approach}] (preferred source)
   */
  calcApproachAtWB(wb_c, design_wb_c, design_approach_c, annual_data) {
    if (annual_data) {
      const row = annual_data.find(r => r.wb === Math.round(wb_c));
      if (row?.approach != null) return row.approach;
    }
    const delta = Math.max(0, design_wb_c - wb_c);
    return Math.min(design_approach_c * 1.8, design_approach_c + delta * 0.12);
  },

  /**
   * CT fan power using affinity laws with static-head base.
   * VFD: P = P_rated × (0.10 + 0.90 × speed³)
   * Two-speed: full / 12.5%
   * Single-speed: fixed full power
   *
   * @param {Array}  devices    - CT device array [{qty_running, fan_kw_fc, fan_kw_dx, fan_control}]
   * @param {number} plr_ct     - Tower load fraction (0–1)
   * @param {boolean} is_fc     - True = use fan_kw_fc (reduced fan load in FC)
   * @param {number} [min_speed=0.20] - VFD minimum turndown speed floor (季節性下限，
   *   由呼叫端傳入 FreeCoolingEngine.getCtFanMinSpeed()；未傳入時退回舊版固定值 0.20)
   */
  calcFanPower(devices, plr_ct, is_fc, min_speed = 0.20) {
    const fan_key = is_fc ? 'fan_kw_fc' : 'fan_kw_dx';
    const speed   = Math.max(min_speed, Math.min(1.0, plr_ct));

    return (devices ?? []).reduce((sum, d) => {
      const n  = d.qty_running ?? d.qty_total ?? 1;
      const fw = d[fan_key] ?? 0;
      const ctrl = d.fan_control ?? 'vfd';
      if (ctrl === 'single_speed') return sum + n * fw;
      if (ctrl === 'two_speed')    return sum + n * fw * (speed >= 0.6 ? 1.0 : 0.125);
      return sum + n * fw * (0.10 + 0.90 * Math.pow(speed, 3));
    }, 0);
  },

  /**
   * [V7-P6] 設計工況降額容量 — 冷卻水塔型錄 heat_rejection_kw 是 CTI 標準額定濕球溫
   * （ct_standard_rating_wb_c，78°F≈25.6°C）下的容量。設計地點夏季 WB 高於標準額定
   * 濕球溫時（台灣多數城市皆是），同一台塔實際散熱能力會下降，選型須用降額後容量。
   * @param {object} spec        - 型錄規格（含 heat_rejection_kw）
   * @param {number} wb_design   - 設計濕球溫 (°C)
   * @returns {{ derated_kw, nominal_kw, derate_factor }}
   */
  deratedCapacityKW(spec, wb_design) {
    const nominal_kw = spec?.heat_rejection_kw ?? 0;
    if (nominal_kw <= 0) return { derated_kw: 0, nominal_kw: 0, derate_factor: 1.0 };
    const std_wb    = A('ct_standard_rating_wb_c');
    const pct_per_c = A('ct_rerate_pct_per_c_above_std');
    const factor = Math.max(0.5, 1 - (pct_per_c / 100) * Math.max(0, (wb_design ?? std_wb) - std_wb));
    return { derated_kw: nominal_kw * factor, nominal_kw, derate_factor: factor };
  },

  /**
   * Validate CT operating parameters.
   * Returns array of warning objects with ASHRAE-based limits.
   */
  validate(t_cws_c, t_cwr_c, wb_c) {
    const warnings = [];
    const approach = t_cws_c - wb_c;
    const range    = t_cwr_c - t_cws_c;

    // Approach limits (evaporative CT physical constraints)
    if (approach < 1.5) {
      warnings.push({ code: 'CT_APPROACH_PHYSICALLY_IMPOSSIBLE', severity: 'critical',
        value: approach.toFixed(1),
        message: `冷卻水塔接近溫差 ${approach.toFixed(1)}°C < 1.5°C，違反物理限制 (T_cws 不能接近 WB)` });
    } else if (approach < 3.0) {
      warnings.push({ code: 'CT_APPROACH_LOW', severity: 'warning',
        value: approach.toFixed(1),
        message: `冷卻水塔接近溫差 ${approach.toFixed(1)}°C 偏低，需要超大散熱面積，建議 ≥ 3.5°C` });
    } else if (approach > 9.0) {
      warnings.push({ code: 'CT_APPROACH_HIGH', severity: 'warning',
        value: approach.toFixed(1),
        message: `冷卻水塔接近溫差 ${approach.toFixed(1)}°C 偏高，顯示冷卻塔面積過小或風機轉速不足` });
    }

    // Range limits (ASHRAE typical: 5-8°C)
    if (range < 2.0) {
      warnings.push({ code: 'CT_RANGE_LOW', severity: 'warning',
        value: range.toFixed(1),
        message: `冷卻水塔溫差 (Range) ${range.toFixed(1)}°C 過低，散熱水流量可能過大或冷卻負載過輕` });
    } else if (range > 14.0) {
      warnings.push({ code: 'CT_RANGE_HIGH', severity: 'critical',
        value: range.toFixed(1),
        message: `冷卻水塔溫差 (Range) ${range.toFixed(1)}°C 過高，冷卻塔散熱容量嚴重不足` });
    }

    return warnings;
  }
};

if (typeof window !== 'undefined') window.CoolingTowerEngine = CoolingTowerEngine;
if (typeof global !== 'undefined') global.CoolingTowerEngine = CoolingTowerEngine;
if (typeof module !== 'undefined' && module.exports) module.exports = CoolingTowerEngine;
