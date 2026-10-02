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
            {
                key: 'cdu_unit',
                label: 'CDU 液冷分配主機 (Cooling Distribution Unit)',
                category: 'CDU',
                catalog: 'cdu',
                role: 'terminal',
                defaultModel: 'CoolIT CDU 100kW (標準)',
                defaultUnitCapKw: 100,
                requiredKw: (ctx) => ctx.reqKw,
                calcQty: (reqKw, cap) => {
                    const minUnits = Math.max(1, Math.ceil(reqKw / (cap || 100)));
                    return { qty: minUnits + 1, n1: minUnits + 1 };
                },
                derate: (curItem, ctx) => {
                    if (typeof root.CDUEngine === 'undefined') return 1.0;
                    return root.CDUEngine.deratedCapacityKW(curItem.capKw, ctx.sys?.fwsSupplyC)?.derate_factor ?? 1.0;
                }
            },
            {
                key: 'dry_cooler',
                label: 'Dry Cooler 乾式冷卻器 (純直冷・零冰機)',
                category: 'DryCooler',
                catalog: 'dry_cooler',
                role: 'heat_rejection',
                resolver: 'tower',
                defaultModelIndex: 0,
                defaultUnitCapKw: 1200,
                requiredKw: (ctx) => ctx.reqKw,
                calcQty: (reqKw, cap) => {
                    const minUnits = Math.max(1, Math.ceil(reqKw / (cap || 1200)));
                    return { qty: minUnits + 1, n1: minUnits + 1 };
                }
            },
            {
                key: 'cdu_pump',
                label: 'CDU Primary Pump 一次側設施循環水泵',
                category: 'Pump',
                catalog: 'pump',
                role: 'pump',
                defaultModel: 'Grundfos TPE 5.5kW Inverter Pump (標準)',
                defaultUnitCapKw: 5.5,
                requiredKw: (ctx) => ctx.hydKw || 5.5,
                calcQty: () => ({ qty: 3, n1: 3 })
            }
        ],

        stages: [
            { type: 'dry_cooler', role: 'economizer', equipKey: 'dry_cooler' }
        ],

        simulateHour(ctx) {
            return (typeof root.runStageChain === 'function')
                ? root.runStageChain(this.stages, ctx, this)
                : this._simulateHourFallback(ctx);
        },

        _simulateHourFallback(ctx) {
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
