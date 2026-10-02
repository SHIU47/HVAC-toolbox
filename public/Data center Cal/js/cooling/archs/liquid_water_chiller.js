'use strict';
/**
 * liquid_water_chiller.js - Full Mechanical Water-Cooled Chiller Plant + Open Cooling Tower
 */
(function (root) {
    const CoolingArchRegistry = root.CoolingArchRegistry;
    const CoolingStages = root.CoolingStages;
    if (!CoolingArchRegistry || !CoolingStages) {
        throw new Error('CoolingArchRegistry and CoolingStages must be loaded before liquid_water_chiller.js');
    }

    CoolingArchRegistry.register({
        id: 'water_chiller',
        aliases: [],
        loop: 'liquid',
        optionLabel: '⚙️ 全額水冷式冰水主機 (Full Mechanical Water Chiller / 全機械壓縮製冷)',
        cardLabel: '全額水冷式冰機',
        pillLabel: '水冷冰機',
        dashboardLabel: '水冷冰機製冷 (Water-Cooled Chiller)',
        flags: { hasMechanical: true, consumesWater: true },
        terminal: 'cdu',
        schematic: 'single_loop',
        params: [],
        equipment: [
            { key: 'cdu_unit', catalog: 'cdu', role: 'terminal' },
            { key: 'water_cooled_chiller', catalog: 'chiller_water', role: 'chiller', chillerType: 'water_cooled' },
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
                    mode: 'mechanical',
                    deficitKw: 0,
                    heatRemovedKw: 0,
                    mechLoadKw: 0,
                    diag: {}
                };
            }

            const sys = ctx.sys || {};
            const chStage = CoolingStages.get('chiller');
            const chRes = chStage.simulate({
                ...ctx,
                chillerType: 'water_cooled',
                t_chws_c: sys.fwsSupplyC,
                fallbackCop: 5.5,
                devices: ctx.equip?.water_cooled_chiller
            });

            // Condenser heat rejection: Q_cond = Q_evap + P_compressor
            const towerStage = CoolingStages.get('evap_tower');
            const towerRes = towerStage.simulate({
                ...ctx,
                Q_kw: chRes.rejectToSinkKw,
                heatLoadKw: Q_kw,
                originalQ_kw: Q_kw,
                isCondenserRejection: true,
                devices: ctx.equip?.cooling_tower
            });

            return {
                terminalKw: ctx.terminalKw || 0,
                pumpKw: ctx.pumpKw || 0,
                fanKw: towerRes.fanKw,
                compressorKw: chRes.compressorKw,
                waterM3: towerRes.waterM3,
                mode: 'mechanical',
                deficitKw: chRes.deficitKw,
                heatRemovedKw: Q_kw,
                mechLoadKw: Q_kw,
                diag: { chRes, towerRes }
            };
        }
    });
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
