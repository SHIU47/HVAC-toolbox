'use strict';

// ============================================================
// CRAHEngine / CRACEngine — room air handling unit power
// Depends on: engines_core.js
// Reference: ASHRAE 90.1 / ASHRAE TC9.9 / AHRI 1360
// ============================================================

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
    if (!crah_list?.length) return { power_kw: 0, plr: 0, speed: 0, cap_total: 0 };

    const cap_total   = sumRunning(crah_list, 'cooling_capacity_kw');
    const power_rated = sumRunning(crah_list, 'power_kw');
    const plr         = cap_total > 0 ? Math.min(1.0, it_air_kw / cap_total) : (it_air_kw > 0 ? 1.0 : 0);
    const speed       = Math.max(0.30, Math.min(1.0, plr));
    // CRAH fan: 10% static base (AHU filter & duct resistance)
    const power_kw    = power_rated * (0.10 + 0.90 * Math.pow(speed, 3));

    return { power_kw, plr, speed, cap_total };
  },

  validate(plr, cap_total, it_air_kw) {
    const warnings = [];
    if (it_air_kw > 0 && cap_total > 0 && plr > 1.02) {
      warnings.push({ code: 'CRAH_CAPACITY_DEFICIT', severity: 'critical',
        value: (plr * 100).toFixed(1),
        message: `CRAH 容量不足：氣冷 IT ${it_air_kw.toFixed(0)} kW > CRAH 可用 ${cap_total.toFixed(0)} kW` });
    }
    if (plr < 0.25 && it_air_kw > 0) {
      warnings.push({ code: 'CRAH_OVERSIZED', severity: 'info',
        value: (plr * 100).toFixed(1),
        message: `CRAH 負載率 ${(plr*100).toFixed(0)}% 過低，可考慮停用部分台數以節省風機電力` });
    }
    return warnings;
  }
};

const CRACEngine = {
  /**
   * CRAC (Direct Expansion) power.
   * DX COP varies with outdoor drybulb: typical 2.8 at 30°C, drops at high OAT.
   * COP(DB) ≈ max(1.5, 3.2 − 0.04 × (DB − 30))
   *
   * @param {Array}  crac_list   - [{qty_running, power_kw, cooling_capacity_kw}]
   * @param {number} it_air_kw   - Air-cooled IT load (kW)
   * @param {number} db_c        - Outdoor drybulb temperature (°C)
   */
  calcPower(crac_list, it_air_kw, db_c) {
    if (!crac_list?.length && it_air_kw <= 0) return { power_kw: 0, cop: 0 };

    const cap_total   = crac_list?.reduce((s, d) => s + (d.qty_running ?? d.qty_total ?? 1) * (d.cooling_capacity_kw ?? 0), 0) ?? 0;
    const power_rated = crac_list?.reduce((s, d) => s + (d.qty_running ?? d.qty_total ?? 1) * (d.power_kw ?? 0), 0) ?? 0;

    if (cap_total > 0 && power_rated > 0) {
      // Use rated data when available
      const plr   = Math.min(1.0, it_air_kw / cap_total);
      const cop   = cap_total / power_rated;
      return { power_kw: it_air_kw / cop, cop, plr };
    }

    // Fallback: dynamic COP model
    const cop = Math.max(1.5, 3.2 - 0.04 * (db_c - 30.0));
    return { power_kw: it_air_kw > 0 ? it_air_kw / cop : 0, cop, plr: 1.0 };
  }
};

if (typeof window !== 'undefined') window.CRAHEngine = CRAHEngine;
if (typeof global !== 'undefined') global.CRAHEngine = CRAHEngine;
if (typeof module !== 'undefined' && module.exports) module.exports = CRAHEngine;
