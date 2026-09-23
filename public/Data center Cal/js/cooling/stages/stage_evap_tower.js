'use strict';
/**
 * stage_evap_tower.js - Evaporative Cooling Tower Stage
 * Handles wet bulb evaporative heat rejection for open/closed cooling towers,
 * calculating fan power, sensible/latent heat removal, and evaporation/blowdown water consumption.
 */
(function (root) {
    const CoolingStages = root.CoolingStages;
    if (!CoolingStages) {
        throw new Error('CoolingStages must be loaded before stage_evap_tower.js');
    }

    CoolingStages.register('evap_tower', {
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
            const ctApproach = ctx.approach_c ?? (sys.ctApproachC ?? 6.0);
            const loadRatio = ctx.loadRatio ?? 1.0;
            const fanMinSpeed = ctx.fanMinSpeed ?? 0.20;
            const ctDevices = ctx.equip?.cooling_tower || ctx.devices || [];
            const evapFactor = ctx.evapFactor ?? ((typeof root.A === 'function') ? root.A('ct_evap_m3h_per_kw') : 0.00124);
            const cycles = ctx.cycles ?? (sys.cyclesOfConcentration || 5);

            // Rejection only mode (e.g. Rejecting chiller condenser heat)
            if (ctx.isCondenserRejection) {
                const fanKw = (ctDevices.length > 0 && typeof root.CoolingTowerEngine !== 'undefined')
                    ? root.CoolingTowerEngine.calcFanPower(ctDevices, loadRatio, false, fanMinSpeed)
                    : (Q_kw / 500) * 14.0;

                const evap = Q_kw * evapFactor;
                const bd = evap / Math.max(1, cycles - 1);
                const waterM3 = evap + bd;

                return {
                    Q_removed_kw: Q_kw,
                    t_out_c: t_supply_c,
                    fanKw,
                    pumpKw: 0,
                    compressorKw: 0,
                    waterM3,
                    rejectToSinkKw: 0,
                    mode: 'mechanical',
                    deficitKw: 0,
                    diag: { evap, bd }
                };
            }

            // Direct wet-bulb evaporative cooling mode
            const isLowFan = w.wb <= (t_supply_c - 8.0);
            const ctFanKw = (ctDevices.length > 0 && typeof root.CoolingTowerEngine !== 'undefined')
                ? root.CoolingTowerEngine.calcFanPower(ctDevices, loadRatio, isLowFan, fanMinSpeed)
                : null;
            const fanKw = ctFanKw ?? ((Q_kw / 500) * (isLowFan ? 8.0 : 12.0));

            const evap = Q_kw * evapFactor;
            const bd = evap / Math.max(1, cycles - 1);
            const waterM3 = evap + bd;

            const ctActualSupplyC = w.wb + ctApproach;
            const ctExceeded = ctActualSupplyC > t_supply_c;
            let deficitKw = 0;
            let t_out_c = t_supply_c;
            if (ctExceeded) {
                const ctTempOvershoot = ctActualSupplyC - t_supply_c;
                const ctUnservedRatio = Math.min(1.0, ctTempOvershoot / Math.max(1.0, t_return_c - t_supply_c));
                deficitKw = Math.round(Q_kw * ctUnservedRatio);
                t_out_c = ctActualSupplyC;
            }

            return {
                Q_removed_kw: Math.max(0, Q_kw - deficitKw),
                t_out_c,
                fanKw,
                pumpKw: 0,
                compressorKw: 0,
                waterM3,
                rejectToSinkKw: 0,
                mode: ctExceeded ? 'partial' : 'free',
                deficitKw,
                diag: { ctActualSupplyC, ctExceeded, evap, bd }
            };
        }
    });
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
