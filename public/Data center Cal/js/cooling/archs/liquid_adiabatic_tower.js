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
        flags: { hasMechanical: false, consumesWater: true },
        terminal: 'cdu',
        schematic: 'single_loop',
        params: [
            { key: 'dryCoolerApproachC', default: 5.0, min: 0, max: 15, step: 0.5, unit: '°C' },
            { key: 'pheApproachC', default: 0.0, min: 0, max: 10, step: 0.5, unit: '°C' },
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
