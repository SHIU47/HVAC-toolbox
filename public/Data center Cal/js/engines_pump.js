'use strict';

// ============================================================
// PlantPumpEngine — hydraulic pump power with affinity laws
// Depends on: engines_core.js
// Reference: ASHRAE 90.1 Section 6.5 / pump affinity law
// ============================================================
const PlantPumpEngine = {

  CP_WATER: 4.184,  // kJ/(kg·°C)

  /**
   * Calculate pump power array with static-head compensation.
   * Affinity law: P ∝ speed³, but real pump has static head (friction, valve pressure)
   * P(speed) = P_rated × (base_frac + (1 - base_frac) × speed³)
   * base_frac = 0.15 conservatively accounts for pump motor min speed + static head.
   *
   * @param {Array}  pumps          - [{qty_running, qty_total, power_kw, kw_per_gpm}]
   * @param {number} speed          - Normalized speed (0–1), typically from VFD
   * @param {number} [flow_gpm]     - Design flow in GPM (used with kw_per_gpm pumps)
   * @param {number} [base_frac]    - Static head fraction (default 0.15)
   */
  calcPower(pumps, speed, flow_gpm = 0, base_frac = 0.15) {
    const spd = Math.max(0.0, Math.min(1.0, speed));
    const ratio = base_frac + (1 - base_frac) * Math.pow(spd, 3);

    return (pumps ?? []).reduce((sum, p) => {
      const n = p.qty_running ?? p.qty_total ?? 1;
      const p_rated = (p.kw_per_gpm && flow_gpm > 0)
        ? p.kw_per_gpm * (flow_gpm / Math.max(1, n))
        : (p.power_kw ?? 0);
      return sum + n * p_rated * ratio;
    }, 0);
  },

  /**
   * Compute design flow (m³/h) from thermal load.
   * Q_kw = m_dot × Cp × ΔT  →  m_dot = Q_kw / (Cp × ΔT)
   */
  calcFlowM3h(q_kw, dt_c) {
    if (dt_c <= 0) return 0;
    return (q_kw * 3.6) / (this.CP_WATER * dt_c);
  },

  /** Convert m³/h → GPM */
  m3hToGpm(m3h) { return m3h * 1000 / (3.785 * 60); },

  /**
   * Derive normalized pump speed from actual vs. rated flow.
   * Enforces minimum speed floor (VFD physical limit).
   */
  calcSpeed(flow_actual_m3h, flow_rated_m3h, min_speed = 0.45) {
    if (flow_rated_m3h <= 0) return min_speed;
    return Math.max(min_speed, Math.min(1.0, flow_actual_m3h / flow_rated_m3h));
  },

  /**
   * Validate CHW ΔT (chilled water temperature differential).
   * Typical HVAC CHW: ΔT = 5–10°C.
   * GB300 warm water loop: ΔT = 10–20°C.
   */
  validateChwDt(dt_c, loop_type = 'chw') {
    const warnings = [];
    const [lo, hi] = loop_type === 'cdw' ? [4, 10] : [3, 15];
    if (dt_c < lo) warnings.push({ code: `${loop_type.toUpperCase()}_DT_LOW`, severity: 'warning',
      value: dt_c.toFixed(1),
      message: `${loop_type.toUpperCase()} ΔT=${dt_c.toFixed(1)}°C 過低（< ${lo}°C），流量可能過大，建議降低泵速` });
    if (dt_c > hi) warnings.push({ code: `${loop_type.toUpperCase()}_DT_HIGH`, severity: 'warning',
      value: dt_c.toFixed(1),
      message: `${loop_type.toUpperCase()} ΔT=${dt_c.toFixed(1)}°C 過高（> ${hi}°C），流量可能不足，建議提高泵速` });
    return warnings;
  }
};

if (typeof window !== 'undefined') window.PlantPumpEngine = PlantPumpEngine;
if (typeof global !== 'undefined') global.PlantPumpEngine = PlantPumpEngine;
if (typeof module !== 'undefined' && module.exports) module.exports = PlantPumpEngine;
