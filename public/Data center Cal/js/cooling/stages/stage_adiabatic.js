'use strict';
/**
 * stage_adiabatic.js - Adiabatic Precooling Heat Rejection Stage
 * Implements sensible air pre-cooling via adiabatic saturation pads (e.g. BAC TrilliumSeries).
 * In dry mode (DB <= drySwitchpoint): 100% dry operation, zero water consumption.
 * In wet mode (DB > drySwitchpoint): sprays water onto media to reduce air inlet DB toward WB.
 */
(function (root) {
    const CoolingStages = root.CoolingStages;
    if (!CoolingStages) {
        throw new Error('CoolingStages must be loaded before stage_adiabatic.js');
    }

    CoolingStages.register('adiabatic', {
        simulate(ctx) {
            const Q_kw = ctx.Q_kw || 0;
            if (Q_kw <= 0) {
                return {
                    Q_removed_kw: 0,
                    t_out_c: ctx.t_in_c ?? ctx.t_supply_c,
                    fanKw: 0,
                    pumpKw: 0,
                    compressorKw: 0,
                    waterM3: 0,
                    rejectToSinkKw: 0,
                    mode: 'free',
                    deficitKw: 0,
                    diag: {}
                };
            }

            const sys = ctx.sys || {};
            const w = ctx.w || { db: 25, wb: 20 };
            const t_supply_c = ctx.t_supply_c ?? sys.fwsSupplyC ?? 42.0;
            const t_return_c = ctx.t_return_c ?? sys.fwsReturnC ?? 54.0;
            const loadRatio = ctx.loadRatio ?? 1.0;
            const fanMinSpeed = ctx.fanMinSpeed ?? 0.20;
            const atDevices = ctx.equip?.adiabatic_tower || ctx.devices || [];
            const cycles = ctx.cycles ?? (sys.cyclesOfConcentration || 5);

            const satEff = (sys.adiabaticSaturationEfficiencyPct || 85) / 100;
            const switchpointOffset = (typeof root.A === 'function') ? root.A('adiabatic_switchpoint_offset_c') : 9.2;
            const drySwitchpoint = sys.adiabaticDrySwitchpointC || Math.max(26.0, t_supply_c - switchpointOffset);
            const isDry = w.db <= drySwitchpoint;

            const atFanKw = (atDevices.length > 0 && typeof root.CoolingTowerEngine !== 'undefined')
                ? root.CoolingTowerEngine.calcFanPower(atDevices, loadRatio, isDry, fanMinSpeed)
                : null;

            let effectiveDb;
            let fanKw = 0;
            let waterM3 = 0;
            let sprayPumpKw = 0;

            if (isDry) {
                fanKw = atFanKw ?? ((Q_kw / 500) * 7.5);
                effectiveDb = w.db;
            } else {
                fanKw = atFanKw ?? ((Q_kw / 500) * 11.0);
                sprayPumpKw = (Q_kw * 0.0003); // Spray pump power (~0.03% of load)
                fanKw += sprayPumpKw;

                // Air-side sensible energy balance to calculate adiabatic evaporation
                const T_eff = w.db - (w.db - w.wb) * satEff;
                const dtAir = (typeof root.A === 'function') ? root.A('adiabatic_coil_air_dt_k') : 10.0;
                const m_air = Q_kw / (1.006 * Math.max(1.0, dtAir));
                const m_evap = Math.max(0, m_air * 1.006 * (w.db - T_eff) / 2450.0);
                const evap = m_evap * 3.6;
                const bd = evap / Math.max(1, cycles - 1);
                waterM3 = evap + bd;
                effectiveDb = T_eff;
            }

            const approach = ctx.approach_c ?? (sys.dryCoolerApproachC || 5.0);
            const hxApproach = ctx.hx_approach_c ?? (sys.pheApproachC ?? 0.0);
            const atActualSupplyC = effectiveDb + approach + hxApproach;
            const atExceeded = atActualSupplyC > t_supply_c;
            let deficitKw = 0;
            let t_out_c = t_supply_c;

            if (atExceeded) {
                const atTempOvershoot = atActualSupplyC - t_supply_c;
                const atUnservedRatio = Math.min(1.0, atTempOvershoot / Math.max(1.0, t_return_c - t_supply_c));
                deficitKw = Math.round(Q_kw * atUnservedRatio);
                t_out_c = atActualSupplyC;
            }

            return {
                Q_removed_kw: Math.max(0, Q_kw - deficitKw),
                t_out_c,
                fanKw,
                pumpKw: 0,
                compressorKw: 0,
                waterM3,
                rejectToSinkKw: 0,
                mode: atExceeded ? 'partial' : 'free',
                deficitKw,
                diag: { isDry, drySwitchpoint, effectiveDb, atActualSupplyC, atExceeded, sprayPumpKw }
            };
        }
    });
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
