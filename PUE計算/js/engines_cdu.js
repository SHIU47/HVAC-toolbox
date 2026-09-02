'use strict';

// ============================================================
// CDUEngine — Coolant Distribution Unit / XDU thermodynamics
// Depends on: engines_core.js
// Reference: ASHRAE TC9.9 / Vertiv XDU/CDU specs
// ============================================================
const CDUEngine = {

  CP_WATER: 4.186,

  /**
   * CDU fan/pump power using affinity-law VFD model.
   * CDU internal pump follows: P = P_rated × (0.15 + 0.85 × speed³)
   *
   * @param {Array}  cdu_list      - CDU/XDU array
   * @param {number} it_liquid_kw  - IT liquid cooling load (kW)
   * @returns {{ power_kw, plr, speed, delta_t_actual, flow_m3h }}
   */
  calcPower(cdu_list, it_liquid_kw) {
    if (!cdu_list?.length || it_liquid_kw <= 0)
      return { power_kw: 0, plr: 0, speed: 0, delta_t_actual: 0, flow_m3h: 0 };

    const cap_total   = sumRunning(cdu_list, 'capacity_kw');
    const power_rated = sumRunning(cdu_list, 'power_kw');
    const plr         = cap_total > 0 ? Math.min(1.0, it_liquid_kw / cap_total) : 1.0;
    const speed       = Math.max(0.45, Math.min(1.0, plr));
    const power_kw    = power_rated * (0.15 + 0.85 * Math.pow(speed, 3));

    return { power_kw, plr, speed, cap_total, power_rated };
  },

  /**
   * CDU ΔT and flow from thermal-hydraulic balance.
   * At design: ΔT = delta_t_design, flow = Q / (Cp × ΔT)
   * With VFD: flow ∝ speed, ΔT = (plr / speed) × ΔT_design
   *
   * @param {number} it_liquid_kw    - IT liquid load
   * @param {number} cap_total       - Total CDU capacity
   * @param {number} plr             - Part-load ratio
   * @param {number} speed           - VFD speed (0–1)
   * @param {number} delta_t_design  - Design CDU ΔT (°C)
   */
  calcThermalHydraulics(it_liquid_kw, cap_total, plr, speed, delta_t_design) {
    const delta_t_actual   = (speed > 0) ? (plr / speed) * delta_t_design : delta_t_design;
    const flow_m3h_primary = (cap_total > 0)
      ? (cap_total * 3.6 / (this.CP_WATER * delta_t_design)) * speed
      : 0;
    const flow_lpm = flow_m3h_primary * 1000 / 60;
    return { delta_t_actual, flow_m3h_primary, flow_lpm };
  },

  /**
   * [V7-P6] 設計工況降額容量 — CDU 型錄標稱容量對應一顆固定的一次側（FWS）設計供水溫
   * （cdu_nominal_fws_design_c）。實際專案一次側供水溫不同時（例如較低溫供水提升板式
   * 熱交換器驅動溫差、較高溫供水降低），可交付的二次側容量會隨之變化。
   * 用線性近似（cdu_derate_pct_per_c，每 °C 約 2%）估算，非廠商實測多點曲線。
   * @param {number} cap_nominal_kw - 型錄標稱容量 (kW)
   * @param {number} t_fws_actual   - 實際設計一次側供水溫 (°C)
   * @param {number} [t_fws_nominal]- 型錄標稱容量對應的一次側供水溫 (°C)，預設讀假設值
   * @returns {{ derated_kw, nominal_kw, derate_factor }}
   */
  deratedCapacityKW(cap_nominal_kw, t_fws_actual, t_fws_nominal) {
    const nominal_kw = cap_nominal_kw ?? 0;
    if (nominal_kw <= 0) return { derated_kw: 0, nominal_kw: 0, derate_factor: 1.0 };
    const t_nom     = t_fws_nominal ?? A('cdu_nominal_fws_design_c');
    const pct_per_c = A('cdu_derate_pct_per_c');
    // 供水溫「高於」標稱值 → 驅動溫差縮小 → 容量下降；「低於」標稱值則容量略增，
    // 上限不超過 1.15×標稱值（避免線性外推到不合理區間）。
    const factor = clamp(1 - (pct_per_c / 100) * ((t_fws_actual ?? t_nom) - t_nom), 0.5, 1.15);
    return { derated_kw: nominal_kw * factor, nominal_kw, derate_factor: factor };
  },

  /**
   * Validate CDU operating parameters.
   */
  validate(plr, delta_t_actual, delta_t_design, it_liquid_kw, cap_total) {
    const warnings = [];

    if (it_liquid_kw > 0 && cap_total > 0) {
      if (plr > 1.0) {
        warnings.push({ code: 'CDU_CAPACITY_DEFICIT', severity: 'critical',
          value: (plr * 100).toFixed(1),
          message: `CDU 容量不足：負載 ${it_liquid_kw.toFixed(0)} kW > 可用 ${cap_total.toFixed(0)} kW` });
      } else if (plr < 0.30) {
        warnings.push({ code: 'CDU_OVERSIZED', severity: 'info',
          value: (plr * 100).toFixed(1),
          message: `CDU 負載率 ${(plr*100).toFixed(0)}% 偏低，建議停用部分台數以提升 ΔT 與效率` });
      }
    }

    if (delta_t_actual !== null && delta_t_actual < 5.0) {
      warnings.push({ code: 'CDU_DT_LOW', severity: 'warning',
        value: delta_t_actual.toFixed(1),
        message: `CDU ΔT=${delta_t_actual.toFixed(1)}°C 過低 (設計 ${delta_t_design}°C)，流量過大，應降低泵速` });
    } else if (delta_t_actual !== null && delta_t_actual > delta_t_design * 1.15) {
      warnings.push({ code: 'CDU_DT_HIGH', severity: 'warning',
        value: delta_t_actual.toFixed(1),
        message: `CDU ΔT=${delta_t_actual.toFixed(1)}°C 超出設計 ${delta_t_design}°C 的 15%，流量不足或台數不夠` });
    }

    return warnings;
  }
};

if (typeof window !== 'undefined') window.CDUEngine = CDUEngine;
if (typeof global !== 'undefined') global.CDUEngine = CDUEngine;
if (typeof module !== 'undefined' && module.exports) module.exports = CDUEngine;
