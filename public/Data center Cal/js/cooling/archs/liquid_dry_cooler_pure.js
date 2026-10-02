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

        operatingPoint(sys, w, equip) {
            const db_c = (typeof w === 'number') ? w : (w?.db ?? 25.0);
            const dcApp = sys?.dryCoolerApproachC ?? 5.0;
            const pheApp = sys?.pheApproachC ?? 0.0;
            const tSup = sys?.fwsSupplyC ?? 40.0;
            const tRet = sys?.fwsReturnC ?? 55.0;
            const tDc = db_c + dcApp;
            const T_avail = tDc + pheApp;
            const isFc = T_avail <= tSup;
            const mode = isFc ? 'free' : 'mechanical';
            const unservedRatio = isFc ? 0.0 : Math.min(1.0, (T_avail - tSup) / Math.max(1.0, tRet - tSup));
            const fullThresh = Number((tSup - dcApp - pheApp).toFixed(1));
            return {
                mode,
                fc_fraction: isFc ? 1.0 : (1.0 - unservedRatio),
                chiller_fraction: isFc ? 0.0 : unservedRatio,
                unservedRatio,
                tDc,
                T_avail,
                tSup,
                tRet,
                temps: { fwsRet: tRet, fwsSup: tSup, dcOut: tDc, dcIn: tRet },
                thresholds: { basis: 'db', full: fullThresh, mech: null }
            };
        },

        topology(sys, op, design) {
            if (!op) op = this.operatingPoint(sys, design);
            const dcApp = sys?.dryCoolerApproachC ?? 5.0;
            const fullThresh = op?.thresholds?.full ?? ((op?.temps?.fwsSup ?? 40.0) - dcApp);
            return {
                title: '設施排熱拓樸 (Facility Heat Rejection System)',
                referenceLabel: null,
                banners: [
                    { id: 'mode1', label: `自然冷卻門檻 DB ≤ ${fullThresh}°C`, detail: '100% 乾式自然風冷・零冰機・零水耗', tone: 'emerald' }
                ],
                nodes: [
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
                    },
                    {
                        id: 'hx',
                        kind: 'hx',
                        title: 'PHE-1 乾冷器板換 (Dry Cooler PHE)',
                        lines: [
                            '自然風冷換熱核心 (PHE)',
                            `冷卻至設計供水 ${op?.temps?.fwsSup ?? 40}°C`,
                            '零耗水全時自然散熱',
                            '水質完全隔離保護 CDU'
                        ]
                    },
                    {
                        id: 'pump_sec',
                        kind: 'pump',
                        title: 'Secondary Pump',
                        lines: ['二次側設施主供水泵']
                    },
                    {
                        id: 'pump_outdoor',
                        kind: 'pump',
                        title: 'Dry Cooler Pump',
                        lines: ['乾冷器循環水泵']
                    },
                    {
                        id: 'heat_rejection',
                        kind: 'dry_cooler',
                        title: '乾冷器 (Dry Cooler)',
                        lines: [
                            '零耗水自然風冷',
                            `Approach: ${dcApp}°C ｜ 門檻: ≤${fullThresh}°C DB`,
                            '100% 自然風冷，全年零冰機',
                            `Approach: ${dcApp}°C ｜ 無機械備援 (需高於門檻時降載)`
                        ]
                    }
                ],
                pipes: [
                    { from: 'cdu', to: 'hx', label: `${op?.temps?.fwsRet ?? 55}°C`, tone: 'hot' },
                    { from: 'hx', to: 'cdu', label: `${op?.temps?.fwsSup ?? 40}°C`, tone: 'cold' },
                    { from: 'hx', to: 'heat_rejection', label: `${op?.temps?.fwsRet ?? 55}°C`, tone: 'hot' },
                    { from: 'heat_rejection', to: 'hx', label: `${op?.temps?.dcOut ?? 35}°C`, tone: 'cold' }
                ],
                footer: [],
                warnings: []
            };
        },

        simulateHour(ctx) {
            return (typeof root.runStageChain === 'function')
                ? root.runStageChain(this.stages, ctx, this)
                : this._simulateHourFallback(ctx);
        },

        _simulateHourFallback(ctx) {
            const Q_kw = ctx.Q_kw || 0;
            if (Q_kw <= 0) {
                return (typeof root.CoolingArchHelpers !== 'undefined')
                    ? root.CoolingArchHelpers.emptyHourResult()
                    : {
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
            const op = this.operatingPoint(sys, ctx.w, ctx.equip);
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
                mode: op.mode,
                deficitKw: dcRes.deficitKw,
                heatRemovedKw: dcRes.Q_removed_kw,
                mechLoadKw: 0,
                op,
                diag: { dcRes }
            };
        }
    });
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
