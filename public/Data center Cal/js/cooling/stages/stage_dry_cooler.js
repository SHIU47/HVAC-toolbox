'use strict';
/**
 * stage_dry_cooler.js - Dry Cooler Heat Rejection / Pre-cooling Stage
 * Handles sensible air heat exchange for dry coolers in standalone or series economizer configurations.
 */
(function (root) {
    const CoolingStages = root.CoolingStages;
    if (!CoolingStages) {
        throw new Error('CoolingStages must be loaded before stage_dry_cooler.js');
    }

    CoolingStages.register('dry_cooler', {
        /**
         * Calculates available leaving water temperature from dry cooler (excluding plate HX).
         * @param {Object} ctx
         * @returns {number} Available temperature (°C)
         */
        availableTemp(ctx) {
            const approach = ctx.approach_c ?? ctx.params?.approach_c ?? (ctx.sys?.dryCoolerApproachC || 5.0);
            const w = ctx.w || { db: 25, wb: 20 };
            return w.db + approach;
        },

        /**
         * Calculates heat rejection fan power.
         * @param {Object} ctx
         * @param {number} Q_reject_kw
         * @param {boolean} isFullFc
         * @returns {{ fanKw: number, waterM3: number }}
         */
        rejectionCost(ctx, Q_reject_kw, isFullFc) {
            const dcDevices = ctx.equip?.dry_cooler || ctx.devices || [];
            const loadRatio = ctx.loadRatio ?? 1.0;
            const fanMinSpeed = ctx.fanMinSpeed ?? 0.20;
            const w = ctx.w || { db: 25, wb: 20 };
            const approach = ctx.approach_c ?? ctx.params?.approach_c ?? (ctx.sys?.dryCoolerApproachC || 5.0);
            const pheApproach = ctx.hx_approach_c ?? ctx.params?.hx_approach_c ?? 0.0;
            const t_supply_c = ctx.t_supply_c ?? ctx.sys?.fwsSupplyC ?? 42.0;
            const freeThresh = t_supply_c - approach - pheApproach;

            let fanKw = 0;
            if (dcDevices.length > 0 && typeof root.CoolingTowerEngine !== 'undefined') {
                const speedRatio = (ctx.isPureEconomizer || isFullFc) ? loadRatio : 1.0;
                fanKw = root.CoolingTowerEngine.calcFanPower(dcDevices, speedRatio, isFullFc, fanMinSpeed);
            } else if (isFullFc) {
                const minRatio = ctx.isPureEconomizer ? 0.2 : 0.15;
                const fanRatio = Math.max(minRatio, Math.min(1.0, (w.db + 273.15) / (freeThresh + 273.15)));
                fanKw = (Q_reject_kw / 500) * 8.0 * fanRatio;
            } else {
                if (ctx.isPureEconomizer) {
                    const fanRatio = Math.max(0.2, Math.min(1.0, (w.db + 273.15) / (freeThresh + 273.15)));
                    fanKw = (Q_reject_kw / 500) * 8.0 * fanRatio;
                } else {
                    fanKw = (Q_reject_kw / 500) * 15.0;
                }
            }
            return { fanKw, waterM3: 0 };
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
            const dcApproach = ctx.approach_c ?? (sys.dryCoolerApproachC || 5.0);
            const pheApproach = ctx.hx_approach_c ?? (sys.pheApproachC ?? 0.0);
            const t_supply_c = ctx.t_supply_c ?? sys.fwsSupplyC ?? 42.0;
            const t_return_c = ctx.t_return_c ?? sys.fwsReturnC ?? 54.0;
            const freeThresh = t_supply_c - dcApproach - pheApproach;

            const isFc = w.db <= freeThresh;
            const cost = this.rejectionCost({ ...ctx, isPureEconomizer: true }, Q_kw, isFc);
            const fanKw = cost.fanKw;

            let deficitKw = 0;
            let t_out_c = t_supply_c;
            if (!isFc) {
                const actualSupplyC = w.db + dcApproach + pheApproach;
                const tempOvershoot = actualSupplyC - t_supply_c;
                const unservedRatio = Math.min(1.0, tempOvershoot / Math.max(1.0, t_return_c - t_supply_c));
                deficitKw = Math.round(Q_kw * unservedRatio);
                t_out_c = actualSupplyC;
            }

            return {
                Q_removed_kw: Math.max(0, Q_kw - deficitKw),
                t_out_c,
                fanKw,
                pumpKw: 0,
                compressorKw: 0,
                waterM3: 0,
                rejectToSinkKw: 0,
                mode: isFc ? 'free' : 'partial',
                deficitKw,
                diag: { freeThresh, isFc }
            };
        }
    });
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
