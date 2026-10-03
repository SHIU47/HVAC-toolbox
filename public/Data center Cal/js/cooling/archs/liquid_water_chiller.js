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
        params: [
            {
                key: 'hasPhe',
                panel: 'custom',
                type: 'boolean',
                label: '配置板式熱交換器 (PHE)',
                idPrefix: 'cduHasPheIn_',
                default: false
            },
            { key: 'pheApproachC', default: 2.0, min: 0, max: 10, step: 0.5, unit: '°C' }
        ],
        paramPanelTitle: '水冷式冰水主機 (Water Chiller) 專屬參數:',
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

        operatingPoint(sys, w, equip) {
            const wb_c = (typeof w === 'number') ? w : (w?.wb ?? 20.0);
            const tSup = sys?.fwsSupplyC ?? 40.0;
            const tRet = sys?.fwsReturnC ?? 55.0;
            const hasPhe = (sys?.hasPhe !== undefined && sys?.hasPhe !== null) ? !!sys.hasPhe : false;
            const pheApp = hasPhe ? (sys?.pheApproachC ?? 2.0) : 0.0;
            const tChws = tSup - pheApp;
            const tChwr = tRet - pheApp;
            const towerApp = (typeof root.A === 'function') ? root.A('tower_approach_c') : 4.0;
            const minCewt = (typeof root.A === 'function') ? root.A('min_cewt_c') : 16.0;
            const tCewt = Math.max(minCewt, wb_c + towerApp);
            const condIn = Number(tCewt.toFixed(1));
            const condOut = Number((tCewt + 5.0).toFixed(1));
            return {
                mode: 'mechanical',
                fc_fraction: 0.0,
                chiller_fraction: 1.0,
                hasPhe,
                pheApp,
                tSup,
                tRet,
                tChws,
                tChwr,
                tCewt,
                temps: {
                    fwsRet: tRet,
                    fwsSup: tSup,
                    chwSup: tChws,
                    chwRet: tChwr,
                    condIn,
                    condOut
                },
                thresholds: { basis: 'none', full: null, mech: null }
            };
        },

        topology(sys, op, design) {
            if (!op) op = this.operatingPoint(sys, design);
            const hasPhe = op?.hasPhe !== undefined ? op.hasPhe : ((sys?.hasPhe !== undefined && sys?.hasPhe !== null) ? !!sys.hasPhe : false);

            const nodes = [
                {
                    id: 'it',
                    kind: 'it',
                    title: 'Compute Data Hall',
                    lines: [
                        'Cold Plate 晶片液冷',
                        `晶片水溫: ${sys?.secSupplyC ?? 45} ⇄ ${sys?.secReturnC ?? 57}°C`
                    ]
                },
                {
                    id: 'cdu',
                    kind: 'cdu',
                    title: 'CDU Distribution'
                }
            ];

            const pipes = [];

            if (hasPhe) {
                nodes.push({
                    id: 'hx',
                    kind: 'hx',
                    title: 'PHE-1 冰水製冷板換 (Chilled Water PHE)',
                    lines: [
                        '機械壓縮製冷隔離板換',
                        `冷卻至設計供水 ${op?.temps?.fwsSup ?? 40}°C`,
                        '板換水質完全隔離保護 CDU',
                        `冰機出水: ${op?.temps?.chwSup ?? 38}°C (Approach ${op?.pheApp ?? 2}°C)`
                    ]
                });
                nodes.push({
                    id: 'pump_sec',
                    kind: 'pump',
                    title: 'Secondary Pump',
                    lines: ['CDU 設施循環泵']
                });
                nodes.push({
                    id: 'pump_outdoor',
                    kind: 'pump',
                    title: 'Chilled Water Pump',
                    lines: ['一次側冰水泵']
                });
                nodes.push({
                    id: 'heat_rejection',
                    kind: 'chiller',
                    title: '水冷式冰水主機 (Chiller)',
                    lines: [
                        '全額機械壓縮製冷 (COP 5.5)',
                        `供應 ${op?.temps?.chwSup ?? 38}°C 低溫冰水`,
                        '搭配開式冷卻水塔排熱',
                        `冷凝水溫: ${op?.temps?.condIn ?? 32} ⇄ ${op?.temps?.condOut ?? 37}°C`
                    ]
                });

                pipes.push(
                    { from: 'cdu', to: 'hx', label: `${op?.temps?.fwsRet ?? 55}°C`, tone: 'hot' },
                    { from: 'hx', to: 'cdu', label: `${op?.temps?.fwsSup ?? 40}°C`, tone: 'cold' },
                    { from: 'hx', to: 'heat_rejection', label: `${op?.temps?.fwsRet ?? 55}°C`, tone: 'hot' },
                    { from: 'heat_rejection', to: 'hx', label: `${op?.temps?.chwSup ?? 38}°C`, tone: 'cold' }
                );
            } else {
                nodes.push({
                    id: 'chiller',
                    kind: 'chiller',
                    title: '水冷式冰水主機 (Chiller)',
                    lines: [
                        '全額機械壓縮製冷核心',
                        `供應設計冰水 ${op?.temps?.chwSup ?? 40}°C (COP 5.5)`,
                        '全年 100% 壓縮機連續運轉',
                        `冷卻水需求: ${op?.temps?.condIn ?? 32} ⇄ ${op?.temps?.condOut ?? 37}°C`
                    ]
                });
                nodes.push({
                    id: 'pump_sec',
                    kind: 'pump',
                    title: 'Primary CHW Pump',
                    lines: ['一次側冰水循環泵']
                });
                nodes.push({
                    id: 'pump_outdoor',
                    kind: 'pump',
                    title: 'CW Pump',
                    lines: ['冷卻水泵 (CW Pump)']
                });
                nodes.push({
                    id: 'heat_rejection',
                    kind: 'tower',
                    title: '開式冷卻水塔 (Cooling Tower)',
                    lines: [
                        '冷凝熱蒸發散熱 (Open Tower)',
                        `設計進水: ${op?.temps?.condIn ?? 32}°C (WB + 4°C)`,
                        '承擔 100% 冰機冷凝熱與壓縮功',
                        '連續補水維持蒸發散熱'
                    ]
                });

                pipes.push(
                    { from: 'cdu', to: 'chiller', label: `${op?.temps?.fwsRet ?? 55}°C`, tone: 'hot' },
                    { from: 'chiller', to: 'cdu', label: `${op?.temps?.fwsSup ?? 40}°C`, tone: 'cold' },
                    { from: 'chiller', to: 'heat_rejection', label: `${op?.temps?.condOut ?? 37}°C`, tone: 'hot' },
                    { from: 'heat_rejection', to: 'chiller', label: `${op?.temps?.condIn ?? 32}°C`, tone: 'cold' }
                );
            }

            const towerApp = (typeof root.A === 'function') ? root.A('tower_approach_c') : 4.0;
            const d5CanFreeCool = ((design?.designWb ?? 28) + towerApp + (hasPhe ? (sys?.pheApproachC ?? 2.0) : 0)) < (op?.temps?.fwsSup ?? 40.0);
            const warnings = [];
            if (d5CanFreeCool) {
                warnings.push('設計濕球 + 塔 approach 低於 FWS 供水溫，冷卻水塔具備自然供冷潛力；建議改用閉式塔或加裝水側經濟器 (WSE)。');
            }

            return {
                title: '設施排熱拓樸 (Facility Heat Rejection)',
                referenceLabel: null,
                banners: [
                    { id: 'mode1', label: '全額機械壓縮冷卻 (COP 5.5)', detail: '無自然冷卻 (全年機械製冷)', tone: 'slate' }
                ],
                nodes,
                pipes,
                footer: [],
                warnings
            };
        },

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
            const op = this.operatingPoint(sys, ctx.w, ctx.equip);
            const chStage = CoolingStages.get('chiller');
            const chRes = chStage.simulate({
                ...ctx,
                chillerType: 'water_cooled',
                t_chws_c: op.tChws,
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
                mode: op.mode,
                deficitKw: chRes.deficitKw,
                heatRemovedKw: Q_kw,
                mechLoadKw: Q_kw,
                op,
                diag: { chRes, towerRes }
            };
        }
    });
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
