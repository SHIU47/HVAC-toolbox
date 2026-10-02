'use strict';
/**
 * liquid_closed_tower.js - Closed-Circuit Cooling Tower (Direct Wet-Bulb Free Cooling / Zero Chiller)
 */
(function (root) {
    const CoolingArchRegistry = root.CoolingArchRegistry;
    const CoolingStages = root.CoolingStages;
    if (!CoolingArchRegistry || !CoolingStages) {
        throw new Error('CoolingArchRegistry and CoolingStages must be loaded before liquid_closed_tower.js');
    }

    CoolingArchRegistry.register({
        id: 'cooling_tower_hx',
        aliases: [],
        loop: 'liquid',
        optionLabel: '🔷 密閉式冷卻水塔 (Closed-Circuit Cooling Tower / 100% 蒸發自然冷卻・零冰機)',
        cardLabel: '密閉式冷卻水塔 (零冰機)',
        pillLabel: '閉式塔',
        dashboardLabel: '密閉式冷卻水塔 (Closed-Circuit Cooling Tower)',
        flags: { hasMechanical: false, consumesWater: true },
        terminal: 'cdu',
        schematic: 'single_loop',
        params: [
            { key: 'ctApproachC', default: 6.0, min: 2, max: 12, step: 0.5, unit: '°C' }
        ],
        equipment: [
            { key: 'cdu_unit', catalog: 'cdu', role: 'terminal' },
            { key: 'cooling_tower', catalog: 'cooling_tower', role: 'heat_rejection', resolver: 'tower' },
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
            const ctStage = CoolingStages.get('closed_tower');
            const ctRes = ctStage.simulate({
                ...ctx,
                approach_c: sys.ctApproachC ?? 6.0,
                devices: ctx.equip?.cooling_tower
            });

            return {
                terminalKw: ctx.terminalKw || 0,
                pumpKw: ctx.pumpKw || 0,
                fanKw: ctRes.fanKw,
                compressorKw: 0,
                waterM3: ctRes.waterM3,
                mode: ctRes.mode,
                deficitKw: ctRes.deficitKw,
                heatRemovedKw: ctRes.Q_removed_kw,
                mechLoadKw: 0,
                diag: { ctRes }
            };
        }
    });
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
