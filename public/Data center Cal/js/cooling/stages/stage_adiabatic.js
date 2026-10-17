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

    function resolveDrySwitchpoint(ctx, sys, t_supply_c, approach) {
        if (sys.adiabaticDrySwitchpointC !== undefined && sys.adiabaticDrySwitchpointC !== null && sys.adiabaticDrySwitchpointC !== '') {
            return Number(sys.adiabaticDrySwitchpointC);
        }
        const hasPhe = (ctx.hasPhe !== undefined) ? !!ctx.hasPhe : ((sys.hasPhe !== undefined && sys.hasPhe !== null) ? !!sys.hasPhe : true);
        const pheApp = hasPhe ? (ctx.hx_approach_c ?? sys.pheApproachC ?? 2.0) : 0.0;
        return t_supply_c - approach - pheApp;
    }

    CoolingStages.register('adiabatic', {
        availableTemp(ctx) {
            const sys = ctx.sys || {};
            const w = ctx.w || { db: 25, wb: 20 };
            const t_supply_c = ctx.t_supply_c ?? sys.fwsSupplyC ?? 42.0;
            const satEff = (sys.adiabaticSaturationEfficiencyPct || 85) / 100;
            const approach = ctx.approach_c ?? ctx.params?.approach_c ?? (sys.dryCoolerApproachC || 5.0);
            const drySwitchpoint = resolveDrySwitchpoint(ctx, sys, t_supply_c, approach);
            const isDry = w.db <= drySwitchpoint;
            const effectiveDb = isDry ? w.db : (w.db - (w.db - w.wb) * satEff);
            return effectiveDb + approach;
        },

        rejectionCost(ctx, Q_reject_kw, isFullFc) {
            const sys = ctx.sys || {};
            const w = ctx.w || { db: 25, wb: 20 };
            const t_supply_c = ctx.t_supply_c ?? sys.fwsSupplyC ?? 42.0;
            const satEff = (sys.adiabaticSaturationEfficiencyPct || 85) / 100;
            const approach = ctx.approach_c ?? ctx.params?.approach_c ?? (sys.dryCoolerApproachC || 5.0);
            const drySwitchpoint = resolveDrySwitchpoint(ctx, sys, t_supply_c, approach);
            const isDry = w.db <= drySwitchpoint;
            const atDevices = ctx.equip?.adiabatic_tower || ctx.devices || [];
            const loadRatio = ctx.loadRatio ?? 1.0;
            const fanMinSpeed = Math.max(ctx.fanMinSpeed ?? 0, root.A('heat_rej_fan_min_speed'));
            const cycles = ctx.cycles ?? (sys.cyclesOfConcentration || 5);

            // R6 P0-F1: 有效進風溫度（乾式=DB，濕式=噴霧預冷後）低於切換點越多，風扇轉速越低
            const effectiveDb = isDry ? w.db : (w.db - (w.db - w.wb) * satEff);
            const subcoolMarginC = Math.max(0, drySwitchpoint - effectiveDb);
            const ambSpeed = Math.max(fanMinSpeed, 1.0 - root.A('heat_rej_vfd_slope_per_k') * subcoolMarginC);
            const speedRatio = Math.max(fanMinSpeed, Math.min(1.0, loadRatio * ambSpeed));

            const fStatic = root.A('ct_vfd_static_fraction');
            let fanKw = (atDevices.length > 0 && typeof root.CoolingTowerEngine !== 'undefined')
                ? root.CoolingTowerEngine.calcFanPower(atDevices, speedRatio, false, fanMinSpeed)
                : ((Q_reject_kw / 500) * 14.0 * (fStatic + (1 - fStatic) * Math.pow(speedRatio, 3)));
            let waterM3 = 0;
            let sprayPumpKw = 0;

            if (!isDry) {
                sprayPumpKw = (Q_reject_kw * 0.0003); // Spray pump power (~0.03% of load)
                fanKw += sprayPumpKw;

                // Air-side sensible energy balance to calculate adiabatic evaporation
                const T_eff = effectiveDb;
                const dtAir = (typeof root.A === 'function') ? root.A('adiabatic_coil_air_dt_k') : 10.0;
                const m_air = Q_reject_kw / (1.006 * Math.max(1.0, dtAir));
                const m_evap = Math.max(0, m_air * 1.006 * (w.db - T_eff) / 2450.0);
                const evap = m_evap * 3.6;
                const bd = evap / Math.max(1, cycles - 1);
                waterM3 = evap + bd;
            }

            return { fanKw, waterM3, diag: { isDry, drySwitchpoint, sprayPumpKw, speedRatio } };
        },

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
            const t_supply_c = ctx.t_supply_c ?? sys.fwsSupplyC ?? 42.0;
            const t_return_c = ctx.t_return_c ?? sys.fwsReturnC ?? 54.0;
            const hasPhe = (ctx.hasPhe !== undefined) ? !!ctx.hasPhe : ((sys.hasPhe !== undefined && sys.hasPhe !== null) ? !!sys.hasPhe : true);
            const hxApproach = ctx.hx_approach_c ?? (hasPhe ? (sys.pheApproachC ?? 2.0) : 0.0);
            const subCtx = { ...ctx, hasPhe, hx_approach_c: hxApproach };

            const cost = this.rejectionCost(subCtx, Q_kw, true);
            const atActualSupplyC = this.availableTemp(subCtx) + hxApproach;
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
                fanKw: cost.fanKw,
                pumpKw: 0,
                compressorKw: 0,
                waterM3: cost.waterM3,
                rejectToSinkKw: 0,
                mode: atExceeded ? 'partial' : 'free',
                deficitKw,
                diag: { ...cost.diag, atActualSupplyC, atExceeded }
            };
        }
    });
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
