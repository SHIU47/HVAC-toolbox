'use strict';
/**
 * liquid_dry_cooler_trim.js - Dry Cooler + Series Trim Chiller (NVIDIA DSX Hybrid Mode)
 */
(function (root) {
    const CoolingArchRegistry = root.CoolingArchRegistry;
    const CoolingStages = root.CoolingStages;
    if (!CoolingArchRegistry || !CoolingStages) {
        throw new Error('CoolingArchRegistry and CoolingStages must be loaded before liquid_dry_cooler_trim.js');
    }

    CoolingArchRegistry.register({
        id: 'dry_cooler_trim',
        aliases: ['dry_cooler_hx'],
        loop: 'liquid',
        optionLabel: '🟡 乾冷器 + 串聯修整冰機 (NVIDIA DSX 混合三模式 / 推薦標準)',
        cardLabel: '乾冷器 + Trim 冰機 (NVIDIA DSX)',
        pillLabel: '乾冷器+Trim',
        dashboardLabel: '乾冷器 + 修整冰機 (Dry Cooler + Trim Chiller)',
        aliasDashboardLabels: {
            dry_cooler_hx: '乾冷器 + 板換 + 修整冰機 (Dry Cooler + PHE + Trim Chiller)'
        },
        flags: { hasMechanical: true, consumesWater: false },
        terminal: 'cdu',
        schematic: 'series_trim',
        params: [
            { key: 'dryCoolerApproachC', default: 5.0, min: 0, max: 15, step: 0.5, unit: '°C' },
            { key: 'pheApproachC', default: 2.0, min: 0, max: 10, step: 0.5, unit: '°C' }
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
                label: 'Dry Cooler 乾式冷卻器 (零耗水)',
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
            },
            {
                key: 'trim_chiller',
                label: 'In-line Trim Chiller 輔助修整冰機 (NVIDIA Mode 2/3 機械製冷)',
                category: 'Chiller',
                catalog: 'chiller_water',
                role: 'chiller',
                chillerType: 'water_cooled',
                defaultModelIndex: 0,
                defaultUnitCapKw: 500,
                requiredKw: (ctx) => {
                    const designCond = (typeof ctx.helpers?.designConditions === 'function')
                        ? ctx.helpers.designConditions()
                        : (root.AppStore?.designConditions ? root.AppStore.designConditions() : { designDb: 34.0, designWb: 28.0, maxDb: 38.0 });
                    const dummyCduSys = { fwsSupplyC: 40.0, fwsReturnC: 55.0, dryCoolerApproachC: 5.0, pheApproachC: 2.0 };
                    const opDesign = (typeof ctx.helpers?.trimOperatingPoint === 'function')
                        ? ctx.helpers.trimOperatingPoint(dummyCduSys, designCond.designDb)
                        : (root.AppStore?.trimOperatingPoint
                            ? root.AppStore.trimOperatingPoint(dummyCduSys, designCond.designDb)
                            : { chiller_fraction: 0.35, tChws: 30, tCewt: 39 });
                    return Math.max(50, Math.round(ctx.reqKw * opDesign.chiller_fraction));
                },
                extraProps: (ctx) => {
                    const designCond = (typeof ctx.helpers?.designConditions === 'function')
                        ? ctx.helpers.designConditions()
                        : (root.AppStore?.designConditions ? root.AppStore.designConditions() : { designDb: 34.0, designWb: 28.0, maxDb: 38.0 });
                    const dummyCduSys = { fwsSupplyC: 40.0, fwsReturnC: 55.0, dryCoolerApproachC: 5.0, pheApproachC: 2.0 };
                    const opDesign = (typeof ctx.helpers?.trimOperatingPoint === 'function')
                        ? ctx.helpers.trimOperatingPoint(dummyCduSys, designCond.designDb)
                        : (root.AppStore?.trimOperatingPoint
                            ? root.AppStore.trimOperatingPoint(dummyCduSys, designCond.designDb)
                            : { chiller_fraction: 0.35, tChws: 30, tCewt: 39 });
                    return { peakRatio: opDesign.chiller_fraction };
                },
                calcQty: (reqKw, cap) => {
                    const minUnits = Math.max(1, Math.ceil(reqKw / (cap || 500)));
                    return { qty: minUnits + 1, n1: minUnits + 1 };
                },
                derate: (curItem, ctx) => {
                    if (typeof root.ChillerEngine === 'undefined') return 1.0;
                    const opDesign = ctx.helpers?.trimOperatingPoint
                        ? ctx.helpers.trimOperatingPoint(ctx.sys, ctx.designCond.designDb)
                        : (root.AppStore?.trimOperatingPoint ? root.AppStore.trimOperatingPoint(ctx.sys, ctx.designCond.designDb) : {});
                    const spec = {
                        cooling_capacity_kw: curItem.capKw,
                        chiller_type: 'water_cooled',
                        cop_curve: curItem.cop_curve || { type: 'fixed' }
                    };
                    return root.ChillerEngine.deratedCapacityKW(spec, opDesign.tChws, opDesign.tCewt, ctx.designCond.designDb)?.derate_factor ?? 1.0;
                }
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
            const w = ctx.w || { db: 25, wb: 20 };
            const dcStage = CoolingStages.get('dry_cooler');
            const dcRes = dcStage.simulate({
                ...ctx,
                isTrimMode: true,
                approach_c: sys.dryCoolerApproachC || 5.0,
                hx_approach_c: sys.pheApproachC ?? 2.0,
                equip: { dry_cooler: ctx.equip?.dry_cooler }
            });

            let compressorKw = 0;
            let deficitKw = dcRes.deficitKw || 0;
            let mechLoadKw = 0;
            let chRes = null;

            if (dcRes.trimLoadKw > 0) {
                mechLoadKw = dcRes.trimLoadKw;
                const chStage = CoolingStages.get('chiller');
                const tChws = dcRes.diag.op ? dcRes.diag.op.tChws : Math.min(30, (sys.fwsSupplyC || 42.0) - 7);
                const tCewt = dcRes.diag.op ? dcRes.diag.op.tCewt : (w.db + 5.0);
                chRes = chStage.simulate({
                    ...ctx,
                    Q_kw: dcRes.trimLoadKw,
                    chillerType: 'water_cooled',
                    t_chws_c: tChws,
                    t_cewt_c: tCewt,
                    fallbackCop: ctx.trimCop || ctx.fallbackCop || 6.2,
                    devices: ctx.equip?.trim_chiller
                });
                compressorKw = chRes.compressorKw;
                if (chRes.deficitKw) deficitKw += chRes.deficitKw;
            }

            return {
                terminalKw: ctx.terminalKw || 0,
                pumpKw: ctx.pumpKw || 0,
                fanKw: dcRes.fanKw,
                compressorKw,
                waterM3: 0,
                mode: dcRes.mode,
                deficitKw,
                heatRemovedKw: Math.max(0, Q_kw - deficitKw),
                mechLoadKw,
                diag: { dcRes, chRes }
            };
        }
    });
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
