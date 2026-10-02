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
                key: 'cooling_tower',
                label: 'Closed-Circuit Cooling Tower 密閉式冷卻水塔',
                category: 'CoolingTower',
                catalog: 'cooling_tower',
                role: 'heat_rejection',
                resolver: 'tower',
                defaultModelIndex: 1,
                defaultUnitCapKw: 1000,
                requiredKw: (ctx) => ctx.reqKw,
                calcQty: (reqKw, cap) => {
                    const minUnits = Math.max(1, Math.ceil(reqKw / (cap || 1000)));
                    return { qty: minUnits + 1, n1: minUnits + 1 };
                },
                derate: (curItem, ctx) => {
                    if (typeof root.CoolingTowerEngine === 'undefined') return 1.0;
                    const spec = { heat_rejection_kw: curItem.capKw || curItem.heat_rejection_kw };
                    return root.CoolingTowerEngine.deratedCapacityKW(spec, ctx.designCond.designWb)?.derate_factor ?? 1.0;
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
