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
        /**
         * Calculates available leaving water temperature from evaporative cooling tower.
         * @param {Object} ctx
         * @returns {number} Available temperature (°C)
         */
        availableTemp(ctx) {
            const approach = ctx.approach_c ?? ctx.params?.approach_c ?? (ctx.sys?.ctApproachC ?? 4.0);
            const w = ctx.w || { db: 25, wb: 20 };
            return w.wb + approach;
        },

        /**
         * Calculates fan power and evaporative water consumption.
         * @param {Object} ctx
         * @param {number} Q_reject_kw
         * @param {boolean} isFullFc
         * @returns {{ fanKw: number, waterM3: number, diag: Object }}
         */
        rejectionCost(ctx, Q_reject_kw, isFullFc) {
            if (Q_reject_kw <= 0) return { fanKw: 0, waterM3: 0, diag: { evap: 0, bd: 0 } };
            const ctDevices = ctx.equip?.cooling_tower || ctx.devices || [];
            const loadRatio = ctx.loadRatio ?? 1.0;
            const fanMinSpeed = Math.max(ctx.fanMinSpeed ?? 0, root.A('heat_rej_fan_min_speed'));
            const evapFactor = ctx.evapFactor ?? ((typeof root.A === 'function') ? root.A('ct_evap_m3h_per_kw') : 0.00124);
            const cycles = ctx.cycles ?? (ctx.sys?.cyclesOfConcentration || 5);
            const w = ctx.w || { db: 25, wb: 20 };
            const t_supply_c = ctx.t_supply_c ?? ctx.sys?.fwsSupplyC ?? 42.0;
            const approach = ctx.approach_c ?? (ctx.sys?.ctApproachC ?? 4.0);

            // R6 P0-F1: 濕球低於設計基準（出水溫 − approach，上限 ct_fan_ref_wb_max_c）越多，風扇轉速越低；
            // 冷凝排熱用途由呼叫端以 refWbC 指定基準
            const refWb = ctx.refWbC ?? Math.min(root.A('ct_fan_ref_wb_max_c'), t_supply_c - approach);
            const subcoolMarginC = Math.max(0, refWb - w.wb);
            const ambSpeed = Math.max(fanMinSpeed, 1.0 - root.A('evap_tower_vfd_slope_per_k') * subcoolMarginC);
            const speedRatio = Math.max(fanMinSpeed, Math.min(1.0, loadRatio * ambSpeed));

            const fStatic = root.A('ct_vfd_static_fraction');
            const fanKw = (ctDevices.length > 0 && typeof root.CoolingTowerEngine !== 'undefined')
                ? root.CoolingTowerEngine.calcFanPower(ctDevices, speedRatio, false, fanMinSpeed)
                : (((ctx.heatLoadKw ?? Q_reject_kw) / 500) * 14.0 * (fStatic + (1 - fStatic) * Math.pow(speedRatio, 3)));

            const evap = Q_reject_kw * evapFactor;
            const bd = evap / Math.max(1, cycles - 1);
            const waterM3 = evap + bd;

            return { fanKw, waterM3, diag: { evap, bd, speedRatio } };
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
            const w = ctx.w || { db: 25, wb: 20 };
            const t_supply_c = ctx.t_supply_c ?? sys.fwsSupplyC ?? 42.0;
            const t_return_c = ctx.t_return_c ?? sys.fwsReturnC ?? 54.0;

            // Rejection only mode delegated to rejectionCost
            if (ctx.isCondenserRejection) {
                const cost = this.rejectionCost(ctx, Q_kw, false);
                return {
                    Q_removed_kw: Q_kw,
                    t_out_c: t_supply_c,
                    fanKw: cost.fanKw,
                    pumpKw: 0,
                    compressorKw: 0,
                    waterM3: cost.waterM3,
                    rejectToSinkKw: 0,
                    mode: 'mechanical',
                    deficitKw: 0,
                    diag: cost.diag
                };
            }

            const ctApproach = ctx.approach_c ?? (sys.ctApproachC ?? 6.0);
            const ctActualSupplyC = w.wb + ctApproach;
            const ctExceeded = ctActualSupplyC > t_supply_c;
            const isFullFc = !ctExceeded;

            const cost = this.rejectionCost(ctx, Q_kw, isFullFc);
            const fanKw = cost.fanKw;
            const waterM3 = cost.waterM3;

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
                diag: { ctActualSupplyC, ctExceeded, ...cost.diag }
            };
        }
    });
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
