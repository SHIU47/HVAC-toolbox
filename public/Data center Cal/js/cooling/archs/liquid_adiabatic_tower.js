'use strict';
/**
 * liquid_adiabatic_tower.js - Adiabatic Cooling Tower (Dual Dry/Wet Modes / Zero Chiller)
 */
(function (root) {
    const CoolingArchRegistry = root.CoolingArchRegistry;
    const CoolingStages = root.CoolingStages;
    if (!CoolingArchRegistry || !CoolingStages) {
        throw new Error('CoolingArchRegistry and CoolingStages must be loaded before liquid_adiabatic_tower.js');
    }

    CoolingArchRegistry.register({
        id: 'adiabatic_tower',
        aliases: [],
        loop: 'liquid',
        optionLabel: '🔵 絕熱冷卻塔 (Adiabatic Tower / 100% 絕熱預冷自然散熱・零冰機)',
        cardLabel: '絕熱冷卻塔 (零冰機)',
        dashboardLabel: '絕熱密閉冷卻水塔 (Adiabatic Tower)',
        flags: { hasMechanical: false, consumesWater: true },
        terminal: 'cdu',
        schematic: 'single_loop',
        params: [
            { key: 'dryCoolerApproachC', default: 5.0, min: 0, max: 15, step: 0.5, unit: '°C' },
            { key: 'pheApproachC', default: 0.0, min: 0, max: 10, step: 0.5, unit: '°C' },
            { key: 'adiabaticSaturationEfficiencyPct', default: 85.0, min: 50, max: 95, step: 1, unit: '%' }
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
            const atStage = CoolingStages.get('adiabatic');
            const atRes = atStage.simulate({
                ...ctx,
                approach_c: sys.dryCoolerApproachC || 5.0,
                hx_approach_c: 0.0,
                devices: ctx.equip?.adiabatic_tower
            });

            return {
                terminalKw: ctx.terminalKw || 0,
                pumpKw: ctx.pumpKw || 0,
                fanKw: atRes.fanKw,
                compressorKw: 0,
                waterM3: atRes.waterM3,
                mode: atRes.mode,
                deficitKw: atRes.deficitKw,
                heatRemovedKw: atRes.Q_removed_kw,
                mechLoadKw: 0,
                diag: { atRes }
            };
        }
    });
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
