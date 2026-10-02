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
                key: 'water_cooled_chiller',
                label: 'Water-Cooled Chiller 水冷式冰水主機',
                category: 'Chiller',
                catalog: 'chiller_water',
                role: 'chiller',
                chillerType: 'water_cooled',
                defaultModel: 'Trane RTHD Water-Cooled Screw 500kW (標準)',
                defaultUnitCapKw: 500,
                requiredKw: (ctx) => ctx.reqKw,
                calcQty: (reqKw, cap) => {
                    const minUnits = Math.max(1, Math.ceil(reqKw / 500));
                    return { qty: minUnits + 1, n1: minUnits + 1 };
                },
                derate: (curItem, ctx) => {
                    if (typeof root.ChillerEngine === 'undefined') return 1.0;
                    const minCewt = (typeof root.A === 'function') ? root.A('min_cewt_c') : 16.0;
                    const towerApp = (typeof root.A === 'function') ? root.A('tower_approach_c') : 4.0;
                    const T_cewt = Math.max(minCewt, ctx.designCond.designWb + towerApp);
                    const spec = {
                        cooling_capacity_kw: curItem.capKw,
                        chiller_type: 'water_cooled',
                        cop_curve: curItem.cop_curve || { type: 'fixed' }
                    };
                    return root.ChillerEngine.deratedCapacityKW(spec, ctx.sys?.fwsSupplyC || 40.0, T_cewt, ctx.designCond.designDb)?.derate_factor ?? 1.0;
                }
            },
            {
                key: 'cooling_tower',
                label: 'Cooling Tower 冰機散熱冷卻水塔',
                category: 'CoolingTower',
                catalog: 'cooling_tower',
                role: 'heat_rejection',
                resolver: 'tower',
                defaultModel: 'BAC Series 3000 600kW',
                defaultUnitCapKw: 600,
                requiredKw: (ctx) => ctx.reqKw * (ctx.getTowerRejectionFactor ? ctx.getTowerRejectionFactor() : 1.2),
                calcQty: (reqKw, cap, ctx) => {
                    const minChillerUnits = Math.max(1, Math.ceil(ctx.reqKw / 500));
                    return { qty: minChillerUnits + 1, n1: minChillerUnits + 1 };
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
