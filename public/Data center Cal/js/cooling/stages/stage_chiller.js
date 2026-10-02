'use strict';
/**
 * stage_chiller.js - Mechanical Chiller Stage (Water-cooled & Air-cooled)
 * Evaluates compressor power consumption, staging, part-load ratios, Carnot lift corrections,
 * and capacity deficits using ChillerEngine.
 */
(function (root) {
    const CoolingStages = root.CoolingStages;
    if (!CoolingStages) {
        throw new Error('CoolingStages must be loaded before stage_chiller.js');
    }

    CoolingStages.register('chiller', {
        availableTemp(ctx) {
            return null; // Mechanical chiller is not an ambient-driven economizer
        },

        rejectionCost(ctx, Q_reject_kw, isFullFc) {
            return { fanKw: 0, waterM3: 0 };
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
            const chillerType = ctx.chillerType || 'water_cooled';
            const t_chws_c = ctx.t_chws_c ?? ctx.t_supply_c ?? sys.fwsSupplyC ?? 42.0;
            const minCewt = (typeof root.A === 'function') ? root.A('min_cewt_c') : 16.0;
            const towerApproach = ctx.towerApproach ?? ((typeof root.A === 'function') ? root.A('tower_approach_c') : 4.0);
            const t_cewt_c = ctx.t_cewt_c ?? (chillerType === 'water_cooled' ? Math.max(minCewt, w.wb + towerApproach) : undefined);

            const chillers = ctx.equip?.chillers || ctx.devices || [];
            let compressorKw = 0;
            let deficitKw = 0;
            let diag = {};

            if (chillers.length > 0 && typeof root.ChillerEngine !== 'undefined') {
                const staging = root.ChillerEngine.calcLeadLagStaging(Q_kw, chillers);
                const chRes = root.ChillerEngine.calcPower(Q_kw, staging.staged, t_chws_c, t_cewt_c, w.db);
                compressorKw = chRes.power_kw;
                if (chRes.warnings && chRes.warnings.length) {
                    deficitKw = chRes.warnings.reduce((s, x) => s + (x.deficit_kw || 0), 0);
                }
                diag = { staging, chRes, t_chws_c, t_cewt_c };
            } else {
                const fallbackCop = ctx.fallbackCop ?? (chillerType === 'water_cooled' ? 5.5 : 3.5);
                compressorKw = Q_kw / fallbackCop;
                diag = { fallbackCop, t_chws_c, t_cewt_c };
            }

            return {
                Q_removed_kw: Q_kw,
                t_out_c: t_chws_c,
                fanKw: 0,
                pumpKw: 0,
                compressorKw,
                waterM3: 0,
                rejectToSinkKw: Q_kw + compressorKw,
                mode: 'mechanical',
                deficitKw,
                diag
            };
        }
    });
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
