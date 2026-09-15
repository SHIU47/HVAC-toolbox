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
  // D. AIR-SIDE ECONOMIZER
  //    Direct outside air introduction (bypass chiller when OA is cool)
  //    FC when: DB + safety ≤ supply air set point
  // ─────────────────────────────────────────────────────────
  /**
   * @param {number} db_c    - Ambient dry-bulb (°C)
   * @param {number} [rh]    - Relative humidity 0–100 (optional, for condensation guard)
   * @param {object} cc      - cooling_config
   */
  calcAirSideEconomizer(db_c, rh, cc) {
    const t_supply_air  = cc.crah_supply_air_c ?? 18.0;
    const safety_margin = 2.0;
    const fc_band_c     = 3.0;
    const max_rh        = 80;  // disable ASE above 80% RH (condensation risk)

    const rh_ok   = (rh == null) || (rh < max_rh);
    const t_limit = t_supply_air + safety_margin;

    let mode, fc_fraction, chiller_fraction;
    if (db_c <= t_limit && rh_ok) {
      mode             = this.MODE.FULL_FC;
      fc_fraction      = 1.0;
      chiller_fraction = 0.0;
    } else if (db_c <= t_limit + fc_band_c && rh_ok) {
      fc_fraction      = (t_limit + fc_band_c - db_c) / fc_band_c;
      fc_fraction      = Math.max(0, Math.min(1, fc_fraction));
      chiller_fraction = 1.0 - fc_fraction;
      mode             = this.MODE.PARTIAL_FC;
    } else {
      mode             = this.MODE.MECHANICAL;
      fc_fraction      = 0.0;
      chiller_fraction = 1.0;
    }

    return { mode, fc_fraction, chiller_fraction, db_c, t_limit, rh_ok };
  },

  // ─────────────────────────────────────────────────────────
  // E. PARTIAL FC ENERGY CALCULATION
  //    Split cooling load between FC and mechanical chiller.
  //    Ensures chiller PLR, CT heat rejection, and pump flows
  //    are computed consistently for the mixed-mode scenario.
  // ─────────────────────────────────────────────────────────
  /**
   * @param {object} fc_result     - Output from calcWatersideFC / calcDryCoolerFC
   * @param {number} Q_total_kw    - Total cooling load (kW)
   * @param {Array}  chillers      - Chiller configuration array
   * @param {number} T_chws_design - CHW supply set point (°C)
   * @param {number} T_condenser_c - Condenser entering water or OAT (°C)
   * @param {number} db_c          - OAT (°C) for air-cooled COP
   */
  calcPartialFCEnergy(fc_result, Q_total_kw, chillers, T_chws_design, T_condenser_c, db_c) {
    const { fc_fraction, chiller_fraction, mode } = fc_result;

    const Q_fc   = Q_total_kw * fc_fraction;    // load handled by free cooling
    const Q_mech = Q_total_kw * chiller_fraction; // load requiring compressor

    let chiller_power_kw = 0, chiller_plr = 0, chiller_cop = Infinity, chiller_warnings = [];
    if (Q_mech > 0 && chillers?.length > 0) {
      const ch_res      = ChillerEngine.calcPower(Q_mech, chillers, T_chws_design, T_condenser_c, db_c);
      chiller_power_kw  = ch_res.power_kw;
      chiller_plr       = ch_res.PLR;
      chiller_cop       = ch_res.cop_actual;
      chiller_warnings  = ch_res.warnings ?? [];
    }

    // Heat to be rejected by tower:
    // FC portion: IT heat bypasses compressor but still needs tower fan (CT must still run)
    // Mechanical portion: Q_mech + compressor heat
    const Q_reject_fc   = Q_fc;
    const Q_reject_mech = Q_mech + chiller_power_kw;
    const Q_reject_total = Q_reject_fc + Q_reject_mech;

    return {
      fc_fraction, chiller_fraction,
      Q_fc, Q_mech,
      chiller_power_kw, chiller_plr, chiller_cop, chiller_warnings,
      Q_reject_fc, Q_reject_mech, Q_reject_total,
      mode
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
  // F. SEA WATER COOLING (First-Class Architecture)
  //    Sea Water Intake → Plate HX → Primary Loop → CDU → GPU
  //
  //    Physics chain:
  //      T_hx_leaving   = T_seawater + hx_approach
  //      T_primary_loop = T_hx_leaving + loop_margin
  //      FC when: T_primary_loop ≤ T_cdu_supply_design
  //
  //    Unlike traditional waterside FC (compares to 7°C CHW),
  //    sea water cooling compares against CDU supply temp (30-45°C).
  //    This means FC hours are far higher for warm-water DLC systems.
  // ─────────────────────────────────────────────────────────
  /**
   * @param {number} t_seawater_c  - Sea water temperature at intake (°C)
   * @param {object} cc            - cooling_config
   * @returns {{
   *   mode, fc_fraction, chiller_fraction,
   *   t_seawater_c, t_hx_leaving, t_available_primary,
   *   hx_approach_c, loop_margin_c, t_cdu_supply, fc_band_c
   * }}
   */
  calcSeaWaterFC(t_seawater_c, cc) {
    const hx_approach_c    = cc.sw_hx_approach_c   ?? 3.0;  // plate HX terminal temp diff
    const loop_margin_c    = cc.sw_loop_margin_c    ?? 2.0;  // piping + pump heat gain
    const t_cdu_supply     = cc.t_supply_cdu_c      ?? 35.0; // CDU facility water supply set point
    const fc_band_c        = cc.fc_partial_band_c   ?? 3.0;  // transition band width

    // Step 1: Plate HX leaving water = sea water + HX approach
    const t_hx_leaving = t_seawater_c + hx_approach_c;

    // Step 2: Available CDU supply = HX leaving + loop margin (pump/pipe heat gain)
    const t_available_primary = t_hx_leaving + loop_margin_c;

    // Step 3: Compare against CDU supply design set point
    let mode, fc_fraction, chiller_fraction;
    if (t_available_primary <= t_cdu_supply) {
      mode             = this.MODE.FULL_FC;
      fc_fraction      = 1.0;
      chiller_fraction = 0.0;
    } else if (t_available_primary <= t_cdu_supply + fc_band_c) {
      fc_fraction      = (t_cdu_supply + fc_band_c - t_available_primary) / fc_band_c;
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
      t_seawater_c, t_hx_leaving, t_available_primary,
      hx_approach_c, loop_margin_c, t_cdu_supply, fc_band_c
    };
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
  // H. ARCHITECTURE-DRIVEN FC DISPATCH
  //    Single entry point: selects the correct FC method based
  //    on cooling_arch field. Allows all callers to be agnostic
  //    about which physical path is being used.
  // ─────────────────────────────────────────────────────────
  /**
   * @param {string} cooling_arch - Architecture code from COOLING_ARCHITECTURES
   * @param {object} climate      - { wb_c, db_c, t_seawater_c }
   * @param {object} cc           - cooling_config
   * @returns {object} FC result with mode, fc_fraction, chiller_fraction
   */
  calcArchitectureFC(cooling_arch, climate, cc) {
    const { wb_c = 25, db_c = 30, t_seawater_c = null } = climate ?? {};

    switch (cooling_arch) {
      case 'sea_water': {
        const sw_temp = t_seawater_c ?? cc.t_seawater_design_c ?? 28;
        return this.calcSeaWaterFC(sw_temp, cc);
      }
      case 'dlc_warm_water':
      case 'direct_liquid': {
        return this.calcDLCWarmWaterFC(wb_c, cc);
      }
      case 'waterside_fc':
      case 'water_cooled_chiller': {
        return this.calcWatersideFC(wb_c, cc);
      }
      case 'air_cooled_chiller': {
        // Air-cooled chiller: limited FC via dry cooler mode
        return this.calcDryCoolerFC(db_c, cc);
      }
      case 'hybrid': {
        // Hybrid: try sea water first; fall back to waterside FC
        if (t_seawater_c != null) {
          const sw_res = this.calcSeaWaterFC(t_seawater_c, cc);
          if (sw_res.mode === this.MODE.FULL_FC) return sw_res;
          // Blend with waterside FC for partial mode
          const ws_res = this.calcWatersideFC(wb_c, cc);
          if (ws_res.fc_fraction > sw_res.fc_fraction) return ws_res;
          return sw_res;
        }
        return this.calcWatersideFC(wb_c, cc);
      }
      case 'nvidia_dsx_dual_loop': {
        return this.calcNvidiaDSXFreeCooling(db_c, cc);
      }
      default:
        return this.calcWatersideFC(wb_c, cc);
    }
  },

  // ─────────────────────────────────────────────────────────
  // J. NVIDIA DSX 3-STAGE FREE COOLING (S45 Raised-Bed Dry Cooler + Trim Chiller)
  //    Ref: NVIDIA DSX Facilities Guide v2.0 (p.39-42) & BOD Rev 5
  //    Mode 1: DB ≤ 34.8°C  → 100% Full Free Cooling (Dry Cooler only, Chiller Bypass)
  //    Mode 2: 34.8 < DB < 40.5°C → Partial / Trim Cooling (Dry Cooler precool + Trim Chiller dT)
  //    Mode 3: DB ≥ 40.5°C  → 100% Mechanical Cooling (Chiller 100%, Dry Cooler as Condenser)
  // ─────────────────────────────────────────────────────────
  /**
   * @param {number} db_c - Outdoor Dry-Bulb Temperature (°C)
   * @param {object} cc   - cooling_config / state
   */
  calcNvidiaDSXFreeCooling(db_c, cc = {}) {
    const mode1_limit = cc.nvidia_dsx_mode1_db_max_c ?? (typeof A === 'function' ? A('nvidia_dsx_mode1_db_max_c') : 34.8);
    const mode2_limit = cc.nvidia_dsx_mode2_db_max_c ?? (typeof A === 'function' ? A('nvidia_dsx_mode2_db_max_c') : 40.5);
    const dc_approach = cc.dry_cooler_approach_c ?? (typeof A === 'function' ? A('nvidia_dsx_dry_cooler_approach') : 5.0);

    const t_dc_leaving = db_c + dc_approach;

    let mode, fc_fraction, chiller_fraction;
    if (db_c <= mode1_limit) {
      mode = this.MODE.FULL_FC;
      fc_fraction = 1.0;
      chiller_fraction = 0.0;
    } else if (db_c < mode2_limit) {
      mode = this.MODE.PARTIAL_FC;
      // Linear trim delta T proportion
      fc_fraction = Math.max(0, Math.min(1, (mode2_limit - db_c) / (mode2_limit - mode1_limit)));
      chiller_fraction = 1.0 - fc_fraction;
    } else {
      mode = this.MODE.MECHANICAL;
      fc_fraction = 0.0;
      chiller_fraction = 1.0;
    }

    return {
      mode,
      fc_fraction,
      chiller_fraction,
      db_c,
      t_dc_leaving,
      mode1_limit,
      mode2_limit,
      dc_approach
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
  },

  // ─────────────────────────────────────────────────────────
  // I. SEA WATER TEMPERATURE — Monthly Profile
  //    Returns estimated sea water temperature given month (1-12)
  //    and location key. Used when annual simulation is running.
  // ─────────────────────────────────────────────────────────
  getSeaWaterTemp(location_key, month) {
    const profiles = {
      kaohsiung: [22,22,23,25,27,28,29,29,28,27,25,23],
      tainan:    [22,22,23,25,27,28,29,29,28,27,25,23],
      tokyo:     [14,14,16,18,21,24,27,28,26,23,19,15],
      osaka:     [14,14,16,18,21,24,27,28,26,23,19,15],
      fukuoka:   [14,14,16,18,22,25,27,28,27,24,20,16],
      singapore: [28,29,29,30,30,30,29,29,29,29,29,28],
      san_jose:  [12,12,13,14,15,16,16,17,17,16,15,13],
      ireland:   [9,8,9,10,12,14,15,16,15,13,11,10],
      amsterdam: [6,5,6,9,12,15,17,18,16,13,10,7],
      default:   [26,26,26,27,28,29,30,30,29,28,27,26]
    };
    const key = (location_key ?? '').toLowerCase();
    const profile = profiles[key] ?? profiles.default;
    const idx = Math.max(0, Math.min(11, (month ?? 6) - 1));
    return profile[idx];
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
