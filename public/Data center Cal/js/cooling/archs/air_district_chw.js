'use strict';
/**
 * air_district_chw.js - Campus / District Chilled Water Supply Network
 */
(function (root) {
    const CoolingArchRegistry = root.CoolingArchRegistry;
    const CoolingStages = root.CoolingStages;
    if (!CoolingArchRegistry || !CoolingStages) {
        throw new Error('CoolingArchRegistry and CoolingStages must be loaded before air_district_chw.js');
    }

    CoolingArchRegistry.register({
        id: 'chilled_water_plant',
        aliases: ['campus_chilled_water'],
        loop: 'air',
        optionLabel: '🏢 廠區集中冰水管網 (Central Chilled Water Plant)',
        cardLabel: '廠區集中冰水',
        pillLabel: '廠區冰水',
        dashboardLabel: '廠區集中冷站 (Chilled Water Plant)',
        flags: { hasMechanical: true, consumesWater: false },
        terminal: 'crah',
        schematic: 'air_plant',
        params: [],
        equipment: [
            { key: 'crah_unit', catalog: 'crah', role: 'terminal', resolver: 'crah' },
            { key: 'plant_decoupler_hx', catalog: 'heat_exchanger', role: 'decoupler' },
            { key: 'fw_pump', catalog: 'pump', role: 'pump' }
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

            const distStage = CoolingStages.get('district_chw');
            const distRes = distStage.simulate(ctx);

            return {
                terminalKw: ctx.terminalKw || 0,
                pumpKw: ctx.pumpKw || 0,
                fanKw: 0,
                compressorKw: distRes.compressorKw,
                waterM3: 0,
                mode: 'mechanical',
                deficitKw: 0,
                heatRemovedKw: Q_kw,
                mechLoadKw: Q_kw,
                diag: { distRes }
            };
        }
    });
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
