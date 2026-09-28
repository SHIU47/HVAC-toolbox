'use strict';
/**
 * liquid_dry_cooler_trim.js - Dry Cooler + Series Trim Chiller (NVIDIA DSX Hybrid Mode)
 */
(function (root) {
    const CoolingArchRegistry = root.CoolingArchRegistry;
    const CoolingStages = root.CoolingStages;
    if (!CoolingArchRegistry || !CoolingStages) {
        throw new Error('CoolingArchRegistry and CoolingStages must be loaded before liquid_dry_cooler_trim.js');
    }

    CoolingArchRegistry.register({
        id: 'dry_cooler_trim',
        aliases: ['dry_cooler_hx'],
        loop: 'liquid',
        optionLabel: '🟡 乾冷器 + 串聯修整冰機 (NVIDIA DSX 混合三模式 / 推薦標準)',
        cardLabel: '乾冷器 + Trim 冰機 (NVIDIA DSX)',
        dashboardLabel: '乾冷器 + 修整冰機 (Dry Cooler + Trim Chiller)',
        aliasDashboardLabels: {
            dry_cooler_hx: '乾冷器 + 板換 + 修整冰機 (Dry Cooler + PHE + Trim Chiller)'
        },
        flags: { hasMechanical: true, consumesWater: false },
        terminal: 'cdu',
        schematic: 'series_trim',
        params: [
            { key: 'dryCoolerApproachC', default: 5.0, min: 0, max: 15, step: 0.5, unit: '°C' },
            { key: 'pheApproachC', default: 2.0, min: 0, max: 10, step: 0.5, unit: '°C' }
        ],

        simulateHour(ctx) {
            const Q_kw = ctx.Q_kw || 0;
            if (Q_kw <= 0) {
                return {
                    terminalKw: 0,
                    pumpKw: 0,
                    fanKw: 0,
                    compressorKw: 0,
                    waterM3: 0,
                    mode: 'free',
                    deficitKw: 0,
                    heatRemovedKw: 0,
                    mechLoadKw: 0,
                    diag: {}
                };
            }

            const sys = ctx.sys || {};
            const w = ctx.w || { db: 25, wb: 20 };
            const dcStage = CoolingStages.get('dry_cooler');
            const dcRes = dcStage.simulate({
                ...ctx,
                isTrimMode: true,
                approach_c: sys.dryCoolerApproachC || 5.0,
                hx_approach_c: sys.pheApproachC ?? 2.0,
                equip: { dry_cooler: ctx.equip?.dry_cooler }
            });

            let compressorKw = 0;
            let deficitKw = dcRes.deficitKw || 0;
            let mechLoadKw = 0;
            let chRes = null;

            if (dcRes.trimLoadKw > 0) {
                mechLoadKw = dcRes.trimLoadKw;
                const chStage = CoolingStages.get('chiller');
                const tChws = dcRes.diag.op ? dcRes.diag.op.tChws : Math.min(30, (sys.fwsSupplyC || 42.0) - 7);
                const tCewt = dcRes.diag.op ? dcRes.diag.op.tCewt : (w.db + 5.0);
                chRes = chStage.simulate({
                    ...ctx,
                    Q_kw: dcRes.trimLoadKw,
                    chillerType: 'water_cooled',
                    t_chws_c: tChws,
                    t_cewt_c: tCewt,
                    fallbackCop: ctx.trimCop || ctx.fallbackCop || 6.2,
                    devices: ctx.equip?.trim_chiller
                });
                compressorKw = chRes.compressorKw;
                if (chRes.deficitKw) deficitKw += chRes.deficitKw;
            }

            return {
                terminalKw: ctx.terminalKw || 0,
                pumpKw: ctx.pumpKw || 0,
                fanKw: dcRes.fanKw,
                compressorKw,
                waterM3: 0,
                mode: dcRes.mode,
                deficitKw,
                heatRemovedKw: Math.max(0, Q_kw - deficitKw),
                mechLoadKw,
                diag: { dcRes, chRes }
            };
        }
    });
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
