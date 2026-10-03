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
        pillLabel: '絕熱塔',
        dashboardLabel: '絕熱密閉冷卻水塔 (Adiabatic Tower)',
        flags: { hasMechanical: false, consumesWater: true, isAdiabatic: true },
        terminal: 'cdu',
        schematic: 'single_loop',
        params: [
            { key: 'dryCoolerApproachC', default: 5.0, min: 0, max: 15, step: 0.5, unit: '°C' },
            {
                key: 'hasPhe',
                panel: 'custom',
                type: 'boolean',
                label: '配置板式熱交換器 (PHE)',
                idPrefix: 'cduHasPheIn_',
                default: true
            },
            { key: 'pheApproachC', default: 2.0, min: 0, max: 10, step: 0.5, unit: '°C' },
            {
                key: 'adiabaticSaturationEfficiencyPct',
                archSpecific: true,
                label: '噴霧飽和效率 (%)',
                idPrefix: 'atSatEffIn_',
                default: 85.0,
                min: 0,
                max: 100,
                step: 1,
                unit: '%'
            },
            {
                key: 'adiabaticDrySwitchpointC',
                archSpecific: true,
                nullable: true,
                label: '乾式切換點 (°C，留空=自動估算)',
                idPrefix: 'atSwitchpointIn_',
                step: 0.5,
                unit: '°C',
                placeholder: (sys) => {
                    const offset = (typeof A === 'function') ? A('adiabatic_switchpoint_offset_c') : (root.A ? root.A('adiabatic_switchpoint_offset_c') : 9.2);
                    const est = Math.max(26.0, (sys.fwsSupplyC ?? 42.0) - offset);
                    return `估算值 ${est.toFixed(1)}°C`;
                }
            }
        ],
        paramPanelTitle: '絕熱冷卻塔 (Adiabatic Tower) 專屬參數:',
        paramPanelNote(sys) {
            const offset = (typeof A === 'function') ? A('adiabatic_switchpoint_offset_c') : (root.A ? root.A('adiabatic_switchpoint_offset_c') : 9.2);
            const estimatedSwitchpoint = Math.max(26.0, (sys.fwsSupplyC ?? 42.0) - offset);
            const hasOverride = sys.adiabaticDrySwitchpointC !== undefined && sys.adiabaticDrySwitchpointC !== null && sys.adiabaticDrySwitchpointC !== '';
            const effectiveSwitchpoint = hasOverride ? sys.adiabaticDrySwitchpointC : estimatedSwitchpoint;
            return {
                hasOverride,
                text: hasOverride
                    ? `目前使用手動輸入值 <strong>${effectiveSwitchpoint}°C</strong>（來自實際廠商選型報告）。`
                    : `⚠ 目前使用粗估公式 <strong>供水溫 − 9.2°C = ${effectiveSwitchpoint.toFixed(1)}°C</strong>（此9.2°C是從單一份BAC參考案例反推，不同案子的設計乾濕球溫度會讓這個offset在4~9°C之間變動，準確度有限）。正式設計前建議向廠商索取針對本案實際供水溫與設計氣候條件的選型報告，並把報告上的真實 Dry Switchpoint 填入上方欄位覆蓋此估算值。`
            };
        },
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
                key: 'adiabatic_tower',
                label: 'Adiabatic Tower 絕熱噴淋冷卻塔',
                category: 'AdiabaticTower',
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

        stages: [
            { type: 'adiabatic', role: 'economizer', equipKey: 'adiabatic_tower', hasPhe: true }
        ],

        operatingPoint(sys, w, equip) {
            const db_c = (typeof w === 'number') ? w : (w?.db ?? 25.0);
            const wb_c = (typeof w === 'number') ? w * 0.8 : (w?.wb ?? 20.0);
            const tSup = sys?.fwsSupplyC ?? 40.0;
            const tRet = sys?.fwsReturnC ?? 55.0;
            const dcApp = sys?.dryCoolerApproachC ?? 5.0;
            const hasPhe = (sys?.hasPhe !== undefined && sys?.hasPhe !== null) ? !!sys.hasPhe : true;
            const pheApp = hasPhe ? (sys?.pheApproachC ?? 2.0) : 0.0;
            const satEff = (sys?.adiabaticSaturationEfficiencyPct ?? 85) / 100;
            const switchpointOffset = (typeof root.A === 'function') ? root.A('adiabatic_switchpoint_offset_c') : 9.2;
            const drySwitchpoint = (sys?.adiabaticDrySwitchpointC !== undefined && sys?.adiabaticDrySwitchpointC !== null && sys?.adiabaticDrySwitchpointC !== '')
                ? Number(sys.adiabaticDrySwitchpointC)
                : Math.max(26.0, tSup - switchpointOffset);
            const isDry = db_c <= drySwitchpoint;
            const effectiveDb = isDry ? db_c : (db_c - (db_c - wb_c) * satEff);
            const tTowerOut = effectiveDb + dcApp;
            const tAvail = tTowerOut + pheApp;
            const isFc = tAvail <= tSup;
            const mode = isFc ? 'free' : 'mechanical';
            const unservedRatio = isFc ? 0.0 : Math.min(1.0, (tAvail - tSup) / Math.max(1.0, tRet - tSup));
            const fullThresh = Number((tSup - dcApp - pheApp).toFixed(1));
            return {
                mode,
                fc_fraction: isFc ? 1.0 : (1.0 - unservedRatio),
                chiller_fraction: isFc ? 0.0 : unservedRatio,
                unservedRatio,
                hasPhe,
                pheApp,
                isDry,
                drySwitchpoint,
                effectiveDb,
                tTowerOut,
                tAvail,
                tSup,
                tRet,
                temps: { fwsRet: tRet, fwsSup: tSup, towerOut: tTowerOut },
                thresholds: { basis: 'db_eff', full: fullThresh, switchpoint: Number(drySwitchpoint.toFixed(1)), mech: null }
            };
        },

        topology(sys, op, design) {
            if (!op) op = this.operatingPoint(sys, design);
            const fullThresh = op?.thresholds?.full ?? 35.0;
            const switchpoint = op?.thresholds?.switchpoint ?? 30.8;
            const hasPhe = op?.hasPhe !== undefined ? op.hasPhe : ((sys?.hasPhe !== undefined && sys?.hasPhe !== null) ? !!sys.hasPhe : true);

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
                    title: 'PHE-1 絕熱預冷板換 (Adiabatic PHE)',
                    lines: [
                        '絕熱預冷自然散熱 (Adiabatic)',
                        `噴霧輔助冷卻至 ${op?.temps?.fwsSup ?? 40}°C`,
                        '蒸發預冷大幅降低進風溫',
                        '水質完全隔離保護 CDU'
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
                    title: 'Coil Pump',
                    lines: ['盤管循環泵']
                });
                nodes.push({
                    id: 'heat_rejection',
                    kind: 'adiabatic',
                    title: '絕熱冷卻塔 (Adiabatic Tower)',
                    lines: [
                        '高溫噴霧預冷 + 乾式自然散熱 (零冰機)',
                        `噴霧飽和效率: ${sys?.adiabaticSaturationEfficiencyPct ?? 85}% ｜ 乾式切換點: ≤${switchpoint}°C`,
                        `氣溫 ≤${switchpoint}°C 乾式 0 耗水，超過後啟動蒸發預冷`,
                        '噴淋水泵 (附屬噴霧系統，依氣候啟閉)'
                    ]
                });

                pipes.push(
                    { from: 'cdu', to: 'hx', label: `${op?.temps?.fwsRet ?? 55}°C`, tone: 'hot' },
                    { from: 'hx', to: 'cdu', label: `${op?.temps?.fwsSup ?? 40}°C`, tone: 'cold' },
                    { from: 'hx', to: 'heat_rejection', label: `${op?.temps?.fwsRet ?? 55}°C`, tone: 'hot' },
                    { from: 'heat_rejection', to: 'hx', label: `${(op?.temps?.towerOut ?? 35).toFixed(1)}°C`, tone: 'cold' }
                );
            } else {
                nodes.push({
                    id: 'pump_sec',
                    kind: 'pump',
                    title: 'Coil Pump',
                    lines: ['盤管循環泵']
                });
                nodes.push({
                    id: 'heat_rejection',
                    kind: 'adiabatic',
                    title: '絕熱冷卻塔 (Adiabatic Tower - 直冷式)',
                    lines: [
                        '高溫噴霧預冷 + 乾式自然散熱 (零冰機)',
                        `噴霧飽和效率: ${sys?.adiabaticSaturationEfficiencyPct ?? 85}% ｜ 乾式切換點: ≤${switchpoint}°C`,
                        '一次側直接連接絕熱塔內部盤管',
                        '噴淋水泵 (附屬噴霧系統，依氣候啟閉)'
                    ]
                });

                pipes.push(
                    { from: 'cdu', to: 'heat_rejection', label: `${op?.temps?.fwsRet ?? 55}°C`, tone: 'hot' },
                    { from: 'heat_rejection', to: 'cdu', label: `${op?.temps?.fwsSup ?? 40}°C`, tone: 'cold' }
                );
            }

            return {
                title: '設施排熱拓樸 (Facility Heat Rejection)',
                referenceLabel: null,
                banners: [
                    { id: 'mode1', label: `絕熱預冷自然冷卻 (有效乾球 ≤${fullThresh}°C)`, detail: '高溫噴霧預冷 (100% 自然冷卻・零冰機)', tone: 'emerald' }
                ],
                nodes,
                pipes,
                footer: [],
                warnings: []
            };
        },

        simulateHour(ctx) {
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
            const atStage = CoolingStages.get('adiabatic');
            const atRes = atStage.simulate({
                ...ctx,
                approach_c: sys.dryCoolerApproachC || 5.0,
                hx_approach_c: op.pheApp,
                devices: ctx.equip?.adiabatic_tower
            });

            return {
                terminalKw: ctx.terminalKw || 0,
                pumpKw: ctx.pumpKw || 0,
                fanKw: atRes.fanKw,
                compressorKw: 0,
                waterM3: atRes.waterM3,
                mode: op.mode,
                deficitKw: atRes.deficitKw,
                heatRemovedKw: atRes.Q_removed_kw,
                mechLoadKw: 0,
                op,
                diag: { atRes }
            };
        }
    });
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
