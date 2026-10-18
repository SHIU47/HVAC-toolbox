'use strict';

// ============================================================
// CRAHEngine / CRACEngine — room air handling unit power
// Depends on: engines_core.js
// Reference: ASHRAE 90.1 / ASHRAE TC9.9 / AHRI 1360
// ============================================================

function _t(key, params, fallback) {
  if (typeof I18N !== 'undefined' && typeof I18N.t === 'function') {
    return I18N.t(key, params);
  }
  if (fallback && params) {
    return fallback.replace(/\{(\w+)\}/g, (_, k) => (k in params ? params[k] : `{${k}}`));
  }
  return fallback || key;
}

const CRAHEngine = {
  /**
   * CRAH fan power using cubic VFD affinity law.
   * CRAHs serve air-cooled IT load via central chilled water.
   *
   * @param {Array}  crah_list   - [{qty_running, qty_total, power_kw, cooling_capacity_kw}]
   * @param {number} it_air_kw   - Air-cooled IT load (kW)
   * @returns {{ power_kw, plr, speed, cap_total }}
   */
  calcPower(crah_list, it_air_kw) {
    if (!crah_list?.length || it_air_kw <= 0) return { power_kw: 0, plr: 0, speed: 0, cap_total: 0 };

    const cap_total   = sumRunning(crah_list, 'cooling_capacity_kw');
    const power_rated = sumRunning(crah_list, 'power_kw');
    const plr_raw     = cap_total > 0 ? (it_air_kw / cap_total) : (it_air_kw > 0 ? 1.0 : 0);
    const plr         = Math.min(1.0, plr_raw);
    const deficit_kw  = Math.max(0, it_air_kw - cap_total);
    // R6 P0-T1: 運轉中最低轉速維持冷熱通道氣流組織
    const speed       = Math.max(A('crah_fan_min_speed_active'), Math.min(1.0, plr));
    // CRAH fan: 10% static base (AHU filter & duct resistance)
    const power_kw    = power_rated * (0.10 + 0.90 * Math.pow(speed, 3));

    return { power_kw, plr, plr_raw, deficit_kw, speed, cap_total };
  },

  validate(plr, cap_total, it_air_kw) {
    const warnings = [];
    if (it_air_kw > 0 && cap_total > 0 && plr > 1.02) {
      warnings.push({ code: 'CRAH_CAPACITY_DEFICIT', severity: 'critical',
        value: (plr * 100).toFixed(1),
        message: _t('warn.CRAH_CAPACITY_DEFICIT', { itAir: it_air_kw.toFixed(0), cap: cap_total.toFixed(0) },
          `CRAH 容量不足：氣冷 IT ${it_air_kw.toFixed(0)} kW > CRAH 可用 ${cap_total.toFixed(0)} kW`) });
    }
    if (plr < 0.25 && it_air_kw > 0) {
      warnings.push({ code: 'CRAH_OVERSIZED', severity: 'info',
        value: (plr * 100).toFixed(1),
        message: _t('warn.CRAH_OVERSIZED', { plr: (plr*100).toFixed(0) },
          `CRAH 負載率 ${(plr*100).toFixed(0)}% 過低，可考慮停用部分台數以節省風機電力`) });
    }
    return warnings;
  }
};


if (typeof window !== 'undefined') window.CRAHEngine = CRAHEngine;
if (typeof global !== 'undefined') global.CRAHEngine = CRAHEngine;
if (typeof module !== 'undefined' && module.exports) module.exports = CRAHEngine;
