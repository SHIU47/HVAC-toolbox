'use strict';

// ============================================================
// ChillerEngine — isolated chiller thermodynamics
// Depends on: engines_core.js (AHRI_PRESETS, biQuad, quadPoly, clamp)
// ASHRAE 90.1 / AHRI 550/590 reference
// ============================================================
const ChillerEngine = {

  // Compressor type → minimum stable PLR (ASHRAE 90.1 Table G3.1.3.2)
  MIN_PLR: {
    centrifugal: 0.20,
    magnetic_bearing: 0.10,
    screw: 0.12,
    scroll: 0.10,
    default: 0.15
  },

  // COP physical ceiling — no real chiller exceeds 15 (2nd Law constraint)
  COP_MAX: 15.0,

  /**
   * Compute chiller electrical power at given operating conditions.
   * Replaces legacy CoolingEngine.calcChillerPower with modular form.
   *
   * @param {number} Q_load       - Required cooling load (kW)
   * @param {Array}  chillers     - Array of chiller config objects
   * @param {number} T_chws       - Chilled water supply temperature (°C)
   * @param {number} T_cewt       - Condenser entering water temperature (°C), or OAT for air-cooled
   * @param {number} db_c         - Outdoor drybulb (°C), for air-cooled COP
   * @returns {{ power_kw, PLR, cop_actual, available_kw, warnings[] }}
   */
  calcPower(Q_load, chillers, T_chws, T_cewt, db_c) {
    if (!chillers?.length || Q_load <= 0)
      return { power_kw: 0, PLR: 0, cop_actual: Infinity, available_kw: 0, warnings: [] };

    const warnings = [];
    let total_available = 0;
    let total_rated_eir = 0;
    let weighted_c1 = 0, weighted_c2 = 0, weighted_c3 = 0;
    let total_fplr_weight = 0;
    let min_plr_effective = this.MIN_PLR.default;

    for (const ch of chillers) {
      const n   = ch.qty_running ?? ch.qty_total ?? 1;
      const cap = ch.cooling_capacity_kw ?? 0;
      const cop = ch.cop_design ?? 5.0;
      const curve = ch.cop_curve ?? { type: 'fixed' };
      const is_air_cooled = (ch.chiller_type === 'air_cooled');
      const T_cond = is_air_cooled ? db_c : T_cewt;

      // Minimum PLR by compressor type
      const cat = (ch.category ?? '').toLowerCase();
      const ch_min_plr = cat.includes('centrifugal') ? this.MIN_PLR.centrifugal
                       : cat.includes('mag')         ? this.MIN_PLR.magnetic_bearing
                       : cat.includes('screw')       ? this.MIN_PLR.screw
                       : cat.includes('scroll')      ? this.MIN_PLR.scroll
                       : this.MIN_PLR.default;
      min_plr_effective = Math.max(min_plr_effective, ch_min_plr);

      let CapFT = 1.0, EIR_FT = 1.0;
      let current_fplr = null;

      const is_air_curve = curve.preset?.startsWith('air_cooled_');
      if (is_air_cooled && curve.type === 'ahri_biquadratic' && !is_air_curve) {
        warnings.push({ code: 'AIR_COOLED_CURVE_MISMATCH', severity: 'warning',
          message: `氣冷式冰機套用水冷式 AHRI 曲線 (${curve.preset ?? ''})，建議改用 air_cooled_screw, air_cooled_vfd_centrifugal 或 fixed/custom_poly` });
      }

      if (curve.type === 'ahri_biquadratic') {
        const coefs = AHRI_PRESETS[curve.preset] ?? curve.coef_override;
        if (coefs) {
          const [T_lo, T_hi] = coefs.t_chws_range ?? [4, 14];
          const [C_lo, C_hi] = coefs.t_cewt_range ?? [18, 42];
          const T_c = clamp(T_chws, T_lo, T_hi);
          const C_c = clamp(T_cond, C_lo, C_hi);
          if (T_chws !== T_c || T_cond !== C_c) {
            warnings.push({ code: 'CHILLER_OUT_OF_RANGE', severity: 'info',
              message: `冰機工況超出曲線範圍：CHWS ${T_chws.toFixed(1)}°C [${T_lo}-${T_hi}], CEWT/DB ${T_cond.toFixed(1)}°C [${C_lo}-${C_hi}]，已截斷至邊界值計算` });
          }
          CapFT  = clamp(biQuad(coefs.CapFT,  T_c, C_c), 0.4, 1.6);
          EIR_FT = clamp(biQuad(coefs.EIR_FT, T_c, C_c), 0.4, 2.0);
          current_fplr = coefs.EIR_FPLR;
        }
      } else if (curve.type === 'custom_poly') {
        const { a, b, c = 0 } = curve.coef;
        const cop_t = Math.max(1.0, a + b * T_cond + c * T_cond * T_cond);
        EIR_FT = cop / cop_t;
        current_fplr = [0, 1, 0]; // linear PLR for scroll/screw without AHRI data
      } else {
        // type === 'fixed' 或預設：採用 ASHRAE 90.1 / AHRI 550/590 基準外氣與冰水供水溫度物理修正
        const chws_base = ch.t_chws_design ?? 7.0;
        if (is_air_cooled) {
          // 氣冷式冰機額定基準：35°C 乾球溫 (DB)，chws_base 冰水供水 (CHWS)
          CapFT  = clamp(1.0 - 0.012 * (T_cond - 35.0) + 0.025 * (T_chws - chws_base), 0.5, 1.4);
          EIR_FT = clamp(1.0 + 0.018 * (T_cond - 35.0) - 0.015 * (T_chws - chws_base), 0.5, 2.0);
          current_fplr = (cat.includes('centrifugal') || cat.includes('mag')) ? [0.025, 0.520, 0.455] : [0.040, 0.720, 0.240];
        } else {
          // 水冷式冰機額定基準：30°C 冷凝器進水 (CEWT)，chws_base 冰水供水 (CHWS)
          CapFT  = clamp(1.0 - 0.015 * (T_cond - 30.0) + 0.025 * (T_chws - chws_base), 0.5, 1.5);
          EIR_FT = clamp(1.0 + 0.016 * (T_cond - 30.0) - 0.018 * (T_chws - chws_base), 0.5, 2.0);
          current_fplr = (cat.includes('centrifugal') || cat.includes('mag')) ? [0.030, 0.500, 0.470] : [0.020, 0.730, 0.250];
        }
      }

      total_available += n * cap * CapFT;
      total_rated_eir += (n * cap / cop) * CapFT * EIR_FT; // A-4 fix: 加入 CapFT 修正因子（ASHRAE 90.1 標準公式）

      if (current_fplr) {
        const w = n * cap;
        weighted_c1 += w * current_fplr[0];
        weighted_c2 += w * current_fplr[1];
        weighted_c3 += w * current_fplr[2];
        total_fplr_weight += w;
      }
    }

    const PLR_raw = total_available > 0 ? Q_load / total_available : 1.0;
    const PLR = Math.min(1.0, PLR_raw);

    if (PLR_raw > 1.02) {
      warnings.push({ code: 'CHILLER_CAPACITY_DEFICIT', severity: 'critical',
        required_kw: Q_load, available_kw: total_available,
        deficit_kw: Q_load - total_available,
        message: `冰機容量不足：需求 ${Q_load.toFixed(0)} kW，可用 ${total_available.toFixed(0)} kW，缺口 ${(Q_load - total_available).toFixed(0)} kW` });
    }

    let c1 = 0, c2 = 1, c3 = 0;
    if (total_fplr_weight > 0) {
      c1 = weighted_c1 / total_fplr_weight;
      c2 = weighted_c2 / total_fplr_weight;
      c3 = weighted_c3 / total_fplr_weight;
    }

    let power_kw;
    if (PLR <= 0) {
      power_kw = 0;
    } else if (PLR < min_plr_effective) {
      // Below min stable PLR: on/off cycling — power prorated from min PLR point
      const eir_at_min = clamp(quadPoly([c1, c2, c3], min_plr_effective), 0.1, 1.3);
      power_kw = total_rated_eir * eir_at_min * (PLR / min_plr_effective);
      warnings.push({ code: 'CHILLER_BELOW_MIN_PLR', severity: 'info',
        PLR: PLR.toFixed(3), min_PLR: min_plr_effective,
        message: `冰機 PLR=${(PLR*100).toFixed(1)}% 低於最低穩定負載 ${(min_plr_effective*100).toFixed(0)}%，進入 ON/OFF 循環模式` });
    } else {
      const EIR_FPLR = clamp(quadPoly([c1, c2, c3], PLR), 0.1, 1.3);
      power_kw = total_rated_eir * EIR_FPLR;
    }

    const cop_raw    = power_kw > 0 ? Q_load / power_kw : Infinity;
    const cop_actual = Math.min(cop_raw, this.COP_MAX);
    const power_final = (cop_actual < cop_raw && Q_load > 0) ? Q_load / cop_actual : power_kw;

    // Warn if COP is unrealistically high even after ceiling
    if (cop_actual > 10.0 && Q_load > 10) {
      warnings.push({ code: 'CHILLER_COP_HIGH', severity: 'info',
        cop: cop_actual.toFixed(2),
        message: `冰機 COP=${cop_actual.toFixed(2)} 高於典型最大值 10，請確認設備曲線設定` });
    }
    if (cop_actual < 2.5 && Q_load > 10 && power_final > 0) {
      warnings.push({ code: 'CHILLER_COP_LOW', severity: 'warning',
        cop: cop_actual.toFixed(2),
        message: `冰機 COP=${cop_actual.toFixed(2)} 偏低，確認冷凝水溫與設備型號是否符合` });
    }

    return { power_kw: power_final, PLR, cop_actual, available_kw: total_available, warnings };
  },

  /**
   * [V7-P6] 設計工況降額容量 — 選型時不得用型錄「標稱容量」直接比對負載，
   * 必須用「設計工況（設計 CHWS/CEWT 或設計 DB）下實際可交付容量」。
   * 水冷機有 AHRI biquadratic 曲線者用 CapFT(T_chws, T_cewt)；無曲線資料
   * （fixed / custom_poly）者容量不隨溫度變化，回傳標稱值。
   * 氣冷機用線性降額（35°C 以上每 1°C 降 chiller_air_derate_pct_per_c_above35%）。
   *
   * @param {object} spec           - 型錄規格（含 cooling_capacity_kw, chiller_type, cop_curve）
   * @param {number} T_chws_design  - 設計冰水供水溫 (°C)
   * @param {number} T_cewt_design  - 設計冷凝器進水溫 (°C)，水冷機專用
   * @param {number} db_design      - 設計乾球溫 (°C)，氣冷機專用
   * @returns {{ derated_kw, nominal_kw, derate_factor }}
   */
  deratedCapacityKW(spec, T_chws_design, T_cewt_design, db_design) {
    const nominal_kw = spec?.cooling_capacity_kw ?? 0;
    if (nominal_kw <= 0) return { derated_kw: 0, nominal_kw: 0, derate_factor: 1.0 };

    const is_air_cooled = (spec.chiller_type === 'air_cooled');
    if (is_air_cooled) {
      const pct_per_c = A('chiller_air_derate_pct_per_c_above35');
      const factor = Math.max(0.5, 1 - (pct_per_c / 100) * Math.max(0, (db_design ?? 35) - 35));
      return { derated_kw: nominal_kw * factor, nominal_kw, derate_factor: factor };
    }

    const curve = spec.cop_curve ?? { type: 'fixed' };
    if (curve.type === 'ahri_biquadratic') {
      const coefs = AHRI_PRESETS[curve.preset] ?? curve.coef_override;
      if (coefs) {
        const [T_lo, T_hi] = coefs.t_chws_range ?? [4, 14];
        const [C_lo, C_hi] = coefs.t_cewt_range ?? [18, 42];
        const T_c = clamp(T_chws_design ?? 7, T_lo, T_hi);
        const C_c = clamp(T_cewt_design ?? 30, C_lo, C_hi);
        const factor = clamp(biQuad(coefs.CapFT, T_c, C_c), 0.4, 1.6);
        return { derated_kw: nominal_kw * factor, nominal_kw, derate_factor: factor };
      }
    }
    // fixed / custom_poly：無容量-溫度曲線資料，保留標稱容量（不臆測）
    return { derated_kw: nominal_kw, nominal_kw, derate_factor: 1.0 };
  },

  /**
   * Lead-Lag chiller staging: determines optimal running count per chiller group.
   * High-efficiency units (higher cop_design) are staged on first (lead).
   * Stages on sequentially to keep PLR below PLR_STAGE_ON (0.90).
   * Returns a modified chillers array with qty_running adjusted for current load.
   *
   * @param {number} Q_load_kw - Required cooling load (kW)
   * @param {Array}  chillers  - Chiller array [{cooling_capacity_kw, qty_running, cop_design, ...}]
   * @returns {{ staged: Array, summary: { n_running, n_standby, avg_plr, lead_chiller } }}
   */
  calcLeadLagStaging(Q_load_kw, chillers) {
    if (!chillers?.length || Q_load_kw <= 0) {
      return { staged: chillers ?? [], summary: { n_running: 0, n_standby: 0, avg_plr: 0, lead_chiller: null } };
    }

    const PLR_STAGE_ON = 0.90;  // stage next chiller on above this PLR
    const staged = [];
    let remaining = Q_load_kw;
    let n_running_total = 0, n_standby_total = 0;
    let lead_chiller = null;

    // Sort lead → lag: highest cop_design first for energy efficiency
    const sorted = [...chillers].sort((a, b) => (b.cop_design ?? 5.0) - (a.cop_design ?? 5.0));

    for (const ch of sorted) {
      const unit_cap  = ch.cooling_capacity_kw ?? 0;
      const qty_avail = ch.qty_running ?? ch.qty_total ?? 1;
      const qty_total = ch.qty_total ?? qty_avail;

      if (unit_cap <= 0) { staged.push({ ...ch }); continue; }

      let qty_staged;
      if (remaining <= 0) {
        qty_staged = 0;
      } else {
        // Stage minimum units so no single unit exceeds PLR_STAGE_ON
        const n_needed = Math.ceil(remaining / (unit_cap * PLR_STAGE_ON));
        qty_staged = Math.max(1, Math.min(qty_avail, n_needed));
      }

      if (!lead_chiller && qty_staged > 0) lead_chiller = ch.model ?? 'Lead Chiller';
      n_running_total  += qty_staged;
      n_standby_total  += Math.max(0, qty_total - qty_staged);

      const handled = qty_staged > 0 ? Math.min(remaining, qty_staged * unit_cap) : 0;
      remaining -= handled;
      staged.push({ ...ch, qty_running: qty_staged });
    }

    const total_staged_cap = staged.reduce((s, ch) =>
      s + (ch.qty_running ?? 0) * (ch.cooling_capacity_kw ?? 0), 0);
    const avg_plr = total_staged_cap > 0 ? Math.min(1.0, Q_load_kw / total_staged_cap) : 0;

    return {
      staged,
      summary: { n_running: n_running_total, n_standby: n_standby_total, avg_plr, lead_chiller }
    };
  },

  /**
   * Validate chiller operating conditions against physics constraints.
   * Called by PhysicsValidator.
   */
  validate(PLR, cop_actual, T_chws, T_cewt) {
    const warnings = [];
    if (PLR > 1.01) warnings.push({ code: 'CHILLER_PLR_OVER_1', severity: 'critical',
      message: `冰機 PLR=${(PLR*100).toFixed(1)}% 超過 100%，容量嚴重不足` });
    if (PLR < 0.10 && PLR > 0)  warnings.push({ code: 'CHILLER_PLR_VERY_LOW', severity: 'warning',
      message: `冰機 PLR=${(PLR*100).toFixed(1)}% 極低，建議停機一台或使用旁路` });
    if (T_cewt - T_chws < 5) warnings.push({ code: 'CHILLER_DT_TOO_SMALL', severity: 'warning',
      message: `冰機 CEWT(${T_cewt.toFixed(1)}°C) - CHWS(${T_chws.toFixed(1)}°C) = ${(T_cewt-T_chws).toFixed(1)}°C 過小，COP 可能不準確` });
    return warnings;
  }
};

if (typeof window !== 'undefined') window.ChillerEngine = ChillerEngine;
if (typeof global !== 'undefined') global.ChillerEngine = ChillerEngine;
if (typeof module !== 'undefined' && module.exports) module.exports = ChillerEngine;
