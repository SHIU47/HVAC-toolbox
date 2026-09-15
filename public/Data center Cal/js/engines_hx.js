'use strict';

// ============================================================
// HeatExchangerEngine — plate heat exchanger thermodynamics
// Depends on: engines_core.js
// Used for Waterside Free Cooling via CT → Plate HX → CHW
// Reference: ASHRAE 2020 Handbook, Brazed Plate HX design
// ============================================================
const HeatExchangerEngine = {

  /**
   * Available CHWS temperature through a plate HX.
   * Physical chain:
   *   WB → CT approach → CT leaving water (T_ct_leaving)
   *       → HX approach → Available CHW supply (T_available_chws)
   *
   * HX approach (TTD) = T_primary_out - T_secondary_in ≈ 1–3°C for brazed plate
   * We measure "cold-end approach": T_ct_leaving − T_available_chws
   *
   * @param {number} wb_c           - Ambient wet-bulb (°C)
   * @param {number} ct_approach_c  - Cooling tower approach (°C)
   * @param {number} hx_approach_c  - Plate HX approach / TTD (°C), typically 1.5–3.0
   * @returns {{ t_ct_leaving, t_available_chws }}
   */
  calcAvailableChws(wb_c, ct_approach_c, hx_approach_c) {
    const t_ct_leaving      = wb_c + ct_approach_c;
    const t_available_chws  = t_ct_leaving + hx_approach_c;
    return { t_ct_leaving, t_available_chws };
  },

  /**
   * Validate plate HX temperatures — checks 2nd-Law compliance.
   * @param {number} t_hot_in  - Primary (CT) entering temp (hot side in)
   * @param {number} t_hot_out - Primary (CT) leaving temp (hot side out)
   * @param {number} t_cold_in - Secondary (CHW return) entering temp (cold side in)
   * @param {number} t_cold_out- Secondary (CHW supply) leaving temp (cold side out)
   */
  validate(t_hot_in, t_hot_out, t_cold_in, t_cold_out) {
    const warnings = [];
    // Hot-end approach (T_hot_in − T_cold_out)
    const approach_hot = t_hot_in - t_cold_out;
    // Cold-end approach (T_hot_out − T_cold_in)
    const approach_cold = t_hot_out - t_cold_in;

    if (approach_hot < 0) {
      warnings.push({ code: 'HX_2ND_LAW_VIOLATION_HOT', severity: 'critical',
        value: approach_hot.toFixed(1),
        message: `板式換熱器熱端接近溫差 ${approach_hot.toFixed(1)}°C 為負，違反熱力學第二定律` });
    } else if (approach_hot < 1.0) {
      warnings.push({ code: 'HX_HOT_APPROACH_VERY_SMALL', severity: 'warning',
        value: approach_hot.toFixed(1),
        message: `板式換熱器熱端接近溫差 ${approach_hot.toFixed(1)}°C 過小，需要極大換熱面積` });
    }

    if (approach_cold < 0) {
      warnings.push({ code: 'HX_2ND_LAW_VIOLATION_COLD', severity: 'critical',
        value: approach_cold.toFixed(1),
        message: `板式換熱器冷端接近溫差 ${approach_cold.toFixed(1)}°C 為負，違反熱力學第二定律` });
    } else if (approach_cold < 1.0) {
      warnings.push({ code: 'HX_COLD_APPROACH_VERY_SMALL', severity: 'warning',
        value: approach_cold.toFixed(1),
        message: `板式換熱器冷端接近溫差 ${approach_cold.toFixed(1)}°C 過小 (設計建議 ≥ 1.5°C)` });
    }

    return warnings;
  }
};

if (typeof window !== 'undefined') window.HeatExchangerEngine = HeatExchangerEngine;
if (typeof global !== 'undefined') global.HeatExchangerEngine = HeatExchangerEngine;
if (typeof module !== 'undefined' && module.exports) module.exports = HeatExchangerEngine;
