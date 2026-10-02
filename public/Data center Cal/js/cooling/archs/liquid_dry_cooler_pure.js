'use strict';
/**
 * liquid_dry_cooler_pure.js - Standalone Pure Dry Cooler (100% Free Cooling / Zero Chiller)
 */
(function (root) {
    const CoolingArchRegistry = root.CoolingArchRegistry;
    const CoolingStages = root.CoolingStages;
    if (!CoolingArchRegistry || !CoolingStages) {
        throw new Error('CoolingArchRegistry and CoolingStages must be loaded before liquid_dry_cooler_pure.js');
    }

    CoolingArchRegistry.register({
        id: 'dry_cooler_pure',
        aliases: [],
        loop: 'liquid',
        optionLabel: '🟢 純乾冷器節能直冷 (Dry Cooler Pure FC / 100% 自然風冷・零冰機・零耗水)',
        cardLabel: '純乾冷器 (零冰機)',
        pillLabel: '純乾冷器',
        dashboardLabel: '純乾冷器自然排熱 (Dry Cooler)',
        flags: { hasMechanical: false, consumesWater: false },
        terminal: 'cdu',
        schematic: 'single_loop',
        params: [
            { key: 'dryCoolerApproachC', default: 5.0, min: 0, max: 15, step: 0.5, unit: '°C' },
            { key: 'pheApproachC', default: 0.0, min: 0, max: 10, step: 0.5, unit: '°C' }
        ],
        equipment: [
            { key: 'cdu_unit', catalog: 'cdu', role: 'terminal' },
            { key: 'dry_cooler', catalog: 'dry_cooler', role: 'heat_rejection', resolver: 'tower' },
            { key: 'cdu_pump', catalog: 'pump', role: 'pump' }
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
            const dcStage = CoolingStages.get('dry_cooler');
            const dcRes = dcStage.simulate({
                ...ctx,
                isTrimMode: false,
                approach_c: sys.dryCoolerApproachC || 5.0,
                hx_approach_c: 0.0,
                devices: ctx.equip?.dry_cooler
            });

            return {
                terminalKw: ctx.terminalKw || 0,
                pumpKw: ctx.pumpKw || 0,
                fanKw: dcRes.fanKw,
                compressorKw: 0,
                waterM3: 0,
                mode: dcRes.mode,
                deficitKw: dcRes.deficitKw,
                heatRemovedKw: dcRes.Q_removed_kw,
                mechLoadKw: 0,
                diag: { dcRes }
            };
        }
    });
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
