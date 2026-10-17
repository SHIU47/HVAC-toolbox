'use strict';

// ============================================================
// FreeCoolingEngine — proper free cooling determination
// Depends on: engines_core.js, engines_cooling_tower.js, engines_hx.js
//
// Supports five modes:
//   1. Mechanical Cooling     — no FC, full compressor load
//   2. Waterside Free Cooling — CT + Plate HX → CHW
//   3. Hybrid / Partial FC    — blend of FC + mechanical
//   4. Dry Cooler FC          — sensible (DB-based), for warm-water liquid loops
//   5. Air Side Economizer    — direct outside air (DB + RH based)
//
// Key physics:
//   Waterside FC chain: WB → CT approach → T_ct_leaving → HX approach → T_available_CHWS
//   Partial FC when: T_chws_design < T_available < T_chws_design + fc_band
// ============================================================
const FreeCoolingEngine = {

  /** Operating mode constants */
  MODE: Object.freeze({
    MECHANICAL: 'mechanical',
    PARTIAL_FC: 'partial_fc',
    FULL_FC:    'full_fc'
  }),

  /** Plant operating mode (seasonal/operational context) */
  PLANT_MODE: Object.freeze({
    SUMMER:    'summer',    // WB ≥ 24°C — full mechanical, peak demand
    SHOULDER:  'shoulder',  // 16 ≤ WB < 24°C — partial FC opportunity
    WINTER:    'winter'     // WB < 16°C — strong FC, minimal mechanical
  }),

  // ─────────────────────────────────────────────────────────
  // Series Economizer Common Physics (P0-5)
  //    f_mech = clamp((T_available - T_supply) / (T_return - T_supply), 0, 1)
  // ─────────────────────────────────────────────────────────
  calcSeriesEconomizer(t_available_c, t_supply_c, t_return_c) {
    const dt = t_return_c - t_supply_c;
    if (!(dt > 0)) return {
      mode: t_available_c <= t_supply_c ? this.MODE.FULL_FC : this.MODE.MECHANICAL,
      fc_fraction: t_available_c <= t_supply_c ? 1 : 0,
      chiller_fraction: t_available_c <= t_supply_c ? 0 : 1
    };
    const f_mech = clamp((t_available_c - t_supply_c) / dt, 0, 1);
    const mode = f_mech <= 0 ? this.MODE.FULL_FC : (f_mech >= 1 ? this.MODE.MECHANICAL : this.MODE.PARTIAL_FC);
    return {
      mode,
      fc_fraction: 1 - f_mech,
      chiller_fraction: f_mech,
      t_precooled_c: clamp(t_available_c, t_supply_c, t_return_c)
    };
  },

  // ─────────────────────────────────────────────────────────
  // A. WATERSIDE FREE COOLING
  //    CT → CT approach → CT leaving water → Plate HX → HX approach → Available CHWS
  //    Compare available CHWS against design CHWS to determine FC mode.
  // ─────────────────────────────────────────────────────────
  /**
   * @param {number} wb_c  - Ambient wet-bulb temperature (°C)
   * @param {object} cc    - cooling_config from project state
   * @returns {{
   *   mode, fc_fraction, chiller_fraction,
   *   t_ct_leaving, t_available_chws, t_chws_design,
   *   ct_approach_c, hx_approach_c, fc_band_c, wb_c
   * }}
   */
  calcWatersideFC(wb_c, cc) {
    // Parameters — prefer explicit config, fall back to physics-based defaults
    const ct_approach_c  = cc.ct_approach_c   ?? cc.wb_depression   ?? 5.0;
    const hx_approach_c  = cc.hx_approach_c   ?? 2.0;
    const t_chws_design  = cc.t_supply_chw_c  ?? 7.0;
    const fc_band_c      = cc.fc_partial_band_c ?? 3.0;  // width of partial-FC transition band

    // Step 1: CT leaving water = WB + CT approach
    const t_ct_leaving = CoolingTowerEngine.calcLeavingWaterTemp(wb_c, ct_approach_c);

    // Step 2: Available CHWS after plate HX = CT leaving + HX approach
    const t_available_chws = t_ct_leaving + hx_approach_c;

    const t_return_c = cc.t_return_chw_c ?? cc.t_return_cdu_c;
    if (t_return_c !== undefined) {
      const eco = this.calcSeriesEconomizer(t_available_chws, t_chws_design, t_return_c);
      return {
        ...eco,
        t_ct_leaving, t_available_chws,
        ct_approach_c, hx_approach_c, t_chws_design, fc_band_c, wb_c
      };
    }
    if (!FreeCoolingEngine._warnedNoReturn) {
      console.warn('[FreeCoolingEngine] calcWatersideFC missing return temperature, falling back to legacy 3K band');
      FreeCoolingEngine._warnedNoReturn = true;
    }

    // Step 3: Classify mode and compute fractions
    let mode, fc_fraction, chiller_fraction;
    if (t_available_chws <= t_chws_design) {
      // CT + HX can supply CHW at or below set point → full free cooling
      mode             = this.MODE.FULL_FC;
      fc_fraction      = 1.0;
      chiller_fraction = 0.0;
    } else if (t_available_chws <= t_chws_design + fc_band_c) {
      // Transition zone: partial free cooling
      // Linear interpolation: at T_available = T_design, FC=100%; at T_design+band, FC=0%
      fc_fraction      = (t_chws_design + fc_band_c - t_available_chws) / fc_band_c;
      fc_fraction      = Math.max(0, Math.min(1, fc_fraction));
      chiller_fraction = 1.0 - fc_fraction;
      mode             = this.MODE.PARTIAL_FC;
    } else {
      // Available CHWS too warm → full mechanical cooling
      mode             = this.MODE.MECHANICAL;
      fc_fraction      = 0.0;
      chiller_fraction = 1.0;
    }

    return {
      mode, fc_fraction, chiller_fraction,
      t_ct_leaving, t_available_chws,
      ct_approach_c, hx_approach_c, t_chws_design, fc_band_c, wb_c
    };
  },

  // ─────────────────────────────────────────────────────────
  // B. DRY COOLER FREE COOLING (sensible, DB-based)
  //    Used for: warm-water liquid loops (CDU supply ≥ 35°C)
  //    where CDU water is rejected directly to a dry cooler.
  //    No wet-side evaporation — DB determines available temp.
  // ─────────────────────────────────────────────────────────
  /**
   * @param {number} db_c  - Ambient dry-bulb temperature (°C)
   * @param {object} cc    - cooling_config
   */
  calcDryCoolerFC(db_c, cc) {
    const approach_c      = cc.dry_cooler_approach_c ?? cc.ct_approach_c ?? 5.0;
    const hx_approach_c   = cc.hx_approach_c ?? cc.phe_approach_c ?? 0.0;
    const t_supply_design = cc.t_supply_cdu_c ?? 40.0;  // CDU facility water supply set point
    const safety_margin   = hx_approach_c > 0 ? hx_approach_c : 0.0; // Use explicit PHE approach
    const fc_band_c       = cc.fc_partial_band_c ?? 3.0;

    // Dry cooler leaving water = DB + approach (sensible cooling only)
    const t_dc_leaving = db_c + approach_c;

    // Available supply to CDU = dry cooler leaving + PHE/HX approach
    const t_available_supply = t_dc_leaving + safety_margin;

    const t_return_c = cc.t_return_cdu_c ?? cc.t_return_chw_c;
    if (t_return_c !== undefined) {
      const eco = this.calcSeriesEconomizer(t_available_supply, t_supply_design, t_return_c);
      return {
        ...eco,
        t_dc_leaving, t_available_supply, approach_c, t_supply_design, safety_margin, db_c
      };
    }
    if (!FreeCoolingEngine._warnedNoReturn) {
      console.warn('[FreeCoolingEngine] calcDryCoolerFC missing return temperature, falling back to legacy 3K band');
      FreeCoolingEngine._warnedNoReturn = true;
    }

    let mode, fc_fraction, chiller_fraction;
    if (t_available_supply <= t_supply_design) {
      mode             = this.MODE.FULL_FC;
      fc_fraction      = 1.0;
      chiller_fraction = 0.0;
    } else if (t_available_supply <= t_supply_design + fc_band_c) {
      fc_fraction      = (t_supply_design + fc_band_c - t_available_supply) / fc_band_c;
      fc_fraction      = Math.max(0, Math.min(1, fc_fraction));
      chiller_fraction = 1.0 - fc_fraction;
      mode             = this.MODE.PARTIAL_FC;
    } else {
      mode             = this.MODE.MECHANICAL;
      fc_fraction      = 0.0;
      chiller_fraction = 1.0;
    }

    return {
      mode, fc_fraction, chiller_fraction,
      t_dc_leaving, t_available_supply, approach_c, t_supply_design, safety_margin, db_c
    };
  },

  // ─────────────────────────────────────────────────────────
  // C. COOLING TOWER → CDU (WB-based, evaporative)
  //    Used for: direct-to-tower liquid loops where CDU water
  //    goes through cooling tower rather than dry cooler.
  //    Supply temp limited by WB + CT approach.
  // ─────────────────────────────────────────────────────────
  /**
   * @param {number} wb_c         - Ambient wet-bulb (°C)
   * @param {number} ct_approach_c- CT approach temperature (°C)
   * @param {object} cc           - cooling_config
   */
  calcCoolingTowerFC(wb_c, ct_approach_c, cc) {
    const t_supply_design = cc.t_supply_cdu_c ?? 40.0;
    const safety_margin   = 1.5;
    const fc_band_c       = cc.fc_partial_band_c ?? 3.0;

    const t_ct_leaving       = CoolingTowerEngine.calcLeavingWaterTemp(wb_c, ct_approach_c);
    const t_available_supply = t_ct_leaving + safety_margin;

    const t_return_c = cc.t_return_cdu_c ?? cc.t_return_chw_c;
    if (t_return_c !== undefined) {
      const eco = this.calcSeriesEconomizer(t_available_supply, t_supply_design, t_return_c);
      return {
        ...eco,
        t_ct_leaving, t_available_supply, ct_approach_c, t_supply_design, wb_c
      };
    }
    if (!FreeCoolingEngine._warnedNoReturn) {
      console.warn('[FreeCoolingEngine] calcCoolingTowerFC missing return temperature, falling back to legacy 3K band');
      FreeCoolingEngine._warnedNoReturn = true;
    }

    let mode, fc_fraction, chiller_fraction;
    if (t_available_supply <= t_supply_design) {
      mode             = this.MODE.FULL_FC;
      fc_fraction      = 1.0;
      chiller_fraction = 0.0;
    } else if (t_available_supply <= t_supply_design + fc_band_c) {
      fc_fraction      = (t_supply_design + fc_band_c - t_available_supply) / fc_band_c;
      fc_fraction      = Math.max(0, Math.min(1, fc_fraction));
      chiller_fraction = 1.0 - fc_fraction;
      mode             = this.MODE.PARTIAL_FC;
    } else {
      mode             = this.MODE.MECHANICAL;
      fc_fraction      = 0.0;
      chiller_fraction = 1.0;
    }

    return {
      mode, fc_fraction, chiller_fraction,
      t_ct_leaving, t_available_supply, ct_approach_c, t_supply_design, wb_c
    };
  },



  // ─────────────────────────────────────────────────────────
  // F. PLANT OPERATING MODE (seasonal strategy)
  //    Determines the seasonal control strategy from WB temperature.
  //    This affects CT fan sequencing, chiller staging, pump speed floors.
  // ─────────────────────────────────────────────────────────
  /**
   * @param {number} wb_c - Current ambient wet-bulb (°C)
   * @returns {'summer'|'shoulder'|'winter'}
   */
  getOperatingMode(wb_c) {
    if (wb_c >= 24) return this.PLANT_MODE.SUMMER;
    if (wb_c >= 16) return this.PLANT_MODE.SHOULDER;
    return this.PLANT_MODE.WINTER;
  },

  /**
   * Get min pump speed floor for the current operating mode.
   * Summer: run pumps harder to ensure cooling capacity.
   * Winter: allow pumps to throttle more aggressively.
   */
  getPumpMinSpeed(operating_mode) {
    switch (operating_mode) {
      case this.PLANT_MODE.SUMMER:   return 0.50;
      case this.PLANT_MODE.SHOULDER: return 0.40;
      case this.PLANT_MODE.WINTER:   return 0.30;
      default:                       return 0.45;
    }
  },

  /**
   * Get CT fan minimum speed for the operating mode.
   * Summer: fans may run full speed; winter: deep throttle or off.
   */
  getCtFanMinSpeed(operating_mode) {
    switch (operating_mode) {
      case this.PLANT_MODE.SUMMER:   return 0.40;
      case this.PLANT_MODE.SHOULDER: return 0.25;
      case this.PLANT_MODE.WINTER:   return 0.15;
      default:                       return 0.20;
    }
  },



  // ─────────────────────────────────────────────────────────
  // G. DIRECT LIQUID COOLING — Warm Water FC
  //    GPU supply temp is high (35–45°C). Cooling tower or dry
  //    cooler can often reject heat without a compressor.
  //    CDU supply limited by: WB + CT approach + safety margin.
  // ─────────────────────────────────────────────────────────
  /**
   * @param {number} wb_c   - Ambient wet-bulb (°C)
   * @param {object} cc     - cooling_config
   */
  calcDLCWarmWaterFC(wb_c, cc) {
    const ct_approach_c   = cc.ct_approach_c   ?? 5.0;
    const safety_margin   = cc.sw_loop_margin_c ?? 2.0;
    const t_cdu_supply    = cc.t_supply_cdu_c   ?? 40.0;
    const fc_band_c       = cc.fc_partial_band_c ?? 3.0;

    // CT leaves water = WB + approach; CDU receives CT leaving + safety
    const t_ct_leaving       = CoolingTowerEngine.calcLeavingWaterTemp(wb_c, ct_approach_c);
    const t_available_supply = t_ct_leaving + safety_margin;

    const t_return_c = cc.t_return_cdu_c ?? cc.t_return_chw_c;
    if (t_return_c !== undefined) {
      const eco = this.calcSeriesEconomizer(t_available_supply, t_cdu_supply, t_return_c);
      return {
        ...eco,
        wb_c, t_ct_leaving, t_available_supply,
        ct_approach_c, safety_margin, t_cdu_supply, fc_band_c
      };
    }
    if (!FreeCoolingEngine._warnedNoReturn) {
      console.warn('[FreeCoolingEngine] calcDLCWarmWaterFC missing return temperature, falling back to legacy 3K band');
      FreeCoolingEngine._warnedNoReturn = true;
    }

    let mode, fc_fraction, chiller_fraction;
    if (t_available_supply <= t_cdu_supply) {
      mode             = this.MODE.FULL_FC;
      fc_fraction      = 1.0;
      chiller_fraction = 0.0;
    } else if (t_available_supply <= t_cdu_supply + fc_band_c) {
      fc_fraction      = (t_cdu_supply + fc_band_c - t_available_supply) / fc_band_c;
      fc_fraction      = Math.max(0, Math.min(1, fc_fraction));
      chiller_fraction = 1.0 - fc_fraction;
      mode             = this.MODE.PARTIAL_FC;
    } else {
      mode             = this.MODE.MECHANICAL;
      fc_fraction      = 0.0;
      chiller_fraction = 1.0;
    }

    return {
      mode, fc_fraction, chiller_fraction,
      wb_c, t_ct_leaving, t_available_supply,
      ct_approach_c, safety_margin, t_cdu_supply, fc_band_c
    };
  },



  // ─────────────────────────────────────────────────────────
  // K. OPERATING SCHEDULE FILTER
  //    Supports '24_7' (8760h Data Center), '12_6' (Mon-Sat 8-20), '10_5' (Mon-Fri 8-18)
  // ─────────────────────────────────────────────────────────
  isHourInSchedule(record, schedule = '24_7') {
    if (!record || schedule === '24_7') return true;
    const hour = record.hour !== undefined ? record.hour : (record.h ?? 0);
    const day = record.day !== undefined ? record.day : (record.d ?? 1);
    const dayOfWeek = (day % 7); // 0=Sun, 1=Mon, ..., 6=Sat

    if (schedule === '12_6') {
      const isMonToSat = dayOfWeek >= 1 && dayOfWeek <= 6;
      return isMonToSat && hour >= 8 && hour < 20;
    } else if (schedule === '10_5') {
      const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;
      return isWeekday && hour >= 8 && hour < 18;
    }
    return true;
  },

  // ─────────────────────────────────────────────────────────
  // L. 8,760h CLIMATE BIN ANALYSIS HELPER
  //    Bin statistical distribution for DB, WB, DP, RH
  // ─────────────────────────────────────────────────────────
  calcBinAnalysis(records = [], varKey = 'db', step = 2, schedule = '24_7') {
    const filtered = records.filter(r => this.isHourInSchedule(r, schedule));
    if (!filtered.length) return { bins: [], totalHours: 0 };

    const values = filtered.map(r => {
      if (varKey === 'db') return r.db ?? r.temp_c ?? r.t_db_c ?? 25;
      if (varKey === 'wb') return r.wb ?? r.t_wb_c ?? 22;
      if (varKey === 'dp') return r.dp ?? r.t_dp_c ?? (r.db - ((100 - (r.rh ?? 70)) / 5));
      if (varKey === 'rh') return r.rh ?? 70;
      return r[varKey] ?? 0;
    });

    const minVal = Math.floor(Math.min(...values));
    const maxVal = Math.ceil(Math.max(...values));

    const bins = [];
    for (let v = minVal; v < maxVal; v += step) {
      bins.push({
        min: v,
        max: v + step,
        label: `${v} ~ ${v + step}`,
        count: 0
      });
    }

    values.forEach(v => {
      let placed = false;
      for (const b of bins) {
        if (v >= b.min && v < b.max) {
          b.count++;
          placed = true;
          break;
        }
      }
      if (!placed && bins.length > 0) {
        bins[bins.length - 1].count++;
      }
    });

    let accum = 0;
    const totalHours = filtered.length;
    const binResults = bins.map(b => {
      accum += b.count;
      return {
        ...b,
        pct: +((b.count / totalHours) * 100).toFixed(1),
        accumHours: accum,
        accumPct: +((accum / totalHours) * 100).toFixed(1)
      };
    });

    return { bins: binResults, totalHours };
  }
};

if (typeof window !== 'undefined') {
  window.FreeCoolingEngine = FreeCoolingEngine;
}
if (typeof global !== 'undefined') {
  global.FreeCoolingEngine = FreeCoolingEngine;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = FreeCoolingEngine;
}
