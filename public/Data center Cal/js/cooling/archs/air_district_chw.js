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
        flags: { hasMechanical: true, consumesWater: false, isDistrict: true },
        terminal: 'crah',
        schematic: 'air_plant',
        params: [],
        equipment: [
            {
                key: 'crah_unit',
                label: 'CRAH / Fanwall 機房空調',
                category: 'CRAH',
                catalog: 'crah',
                role: 'terminal',
                resolver: 'crah',
                defaultModel: 'Stulz CyberAir 4 CFD 600 A (60kW)',
                defaultUnitCapKw: 60,
                requiredKw: (ctx) => ctx.reqKw,
                calcQty: (reqKw, cap) => {
                    const minUnits = Math.max(1, Math.ceil(reqKw / 60));
                    return { qty: minUnits + 1, n1: minUnits + 1 };
                }
            },
            {
                key: 'plant_decoupler_hx',
                label: 'Central Plant Decoupler / 廠務冰水介面',
                category: 'Decoupler',
                catalog: 'heat_exchanger',
                role: 'decoupler',
                defaultModel: 'Alfa Laval M10 Plate HX 500kW',
                defaultUnitCapKw: 500,
                requiredKw: (ctx) => ctx.reqKw,
                calcQty: () => ({ qty: 2, n1: 2 })
            },
            {
                key: 'fw_pump',
                label: 'Secondary CHW Pump 二次側冰水循環水泵',
                category: 'Pump',
                catalog: 'pump',
                role: 'pump',
                requiredKw: (ctx) => ctx.pumpPowerKw || 5.0,
                selectModel: (cat, ctx) => {
                    const pumpKw = ctx.pumpPowerKw || 5.0;
                    const model = pumpKw <= 3.5 ? 'Grundfos TPE 3.0kW Inverter Pump' : (pumpKw <= 6.0 ? 'Grundfos TPE 5.5kW Inverter Pump (標準)' : 'Armstrong Design Envelope 11.0kW');
                    const capKw = pumpKw <= 3.5 ? 3.0 : (pumpKw <= 6.0 ? 5.5 : 11.0);
                    return { model, capKw };
                },
                calcQty: () => ({ qty: 2, n1: 2 })
            }
        ],

        simulateHour(ctx) {
            const Q_kw = ctx.Q_kw || 0;
            if (Q_kw <= 0) {
                return (typeof root.CoolingArchHelpers !== 'undefined')
                    ? root.CoolingArchHelpers.emptyHourResult('mechanical')
                    : {
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
