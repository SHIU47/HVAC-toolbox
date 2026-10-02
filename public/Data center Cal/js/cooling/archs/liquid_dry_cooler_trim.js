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
        flags: { hasMechanical: true, consumesWater: false, isTrim: true },
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

        stages: [
            { type: 'dry_cooler', role: 'economizer', hasPhe: true, equipKey: 'dry_cooler' },
            { type: 'chiller', role: 'mechanical', chillerType: 'water_cooled', equipKey: 'trim_chiller', fallbackCop: 6.2 }
        ],

        operatingPoint(sys, w, equip) {
            const db_c = (typeof w === 'number') ? w : (w?.db ?? 25.0);
            const dcApp   = sys?.dryCoolerApproachC ?? 5.0;          // 乾冷器 approach
            const pheApp  = sys?.pheApproachC ?? 2.0;                // Primary HX approach
            const tSup    = sys?.fwsSupplyC ?? 40.0;
            const tRet    = sys?.fwsReturnC ?? 55.0;
            const tDc     = db_c + dcApp;                              // 乾冷器出水
            const eco     = (typeof root.FreeCoolingEngine?.calcSeriesEconomizer === 'function')
                ? root.FreeCoolingEngine.calcSeriesEconomizer(tDc + pheApp, tSup, tRet)
                : { fc_fraction: (tDc + pheApp <= tSup ? 1.0 : 0.0), chiller_fraction: (tDc + pheApp <= tSup ? 0.0 : 1.0), mode: (tDc + pheApp <= tSup ? 'FULL_FC' : 'MECH'), t_precooled_c: Math.min(tRet, Math.max(tSup, tDc + pheApp)) };
            const tPre    = eco.t_precooled_c;                         // FWS 經 Primary HX 預冷後溫度
            const tChws   = sys?.trimChwSupplyC ?? Math.min(30, tSup - 7);   // 與 view_cooling.js:724 同一公式
            const minCewt = (typeof root.A === 'function') ? root.A('min_cewt_c') : 16.0;
            // 乾冷器側水在 Primary HX 吸收預冷熱後進冷凝器（平衡流量假設，與拓樸圖一致）
            const tCewt   = Math.max(minCewt, tDc + (tRet - tPre));
            const mode = (typeof root.CoolingArchHelpers !== 'undefined')
                ? root.CoolingArchHelpers.modeFromEco(eco)
                : ((eco.mode === (root.FreeCoolingEngine?.MODE?.FULL_FC || 'FULL_FC'))
                    ? 'free'
                    : ((eco.mode === (root.FreeCoolingEngine?.MODE?.PARTIAL_FC || 'PARTIAL_FC')) ? 'partial' : 'mechanical'));
            const fullThresh = Number((tSup - dcApp - pheApp).toFixed(1));
            const mechThresh = Number((tRet - dcApp - pheApp).toFixed(1));
            const trimChwDtC = sys?.trimChwDtC ?? ((typeof root.A === 'function') ? root.A('trim_chw_dt_default_c') : 5.0);
            const chwRet = tChws + trimChwDtC;
            return {
                ...eco,
                mode,
                tDc,
                tPre,
                tChws,
                tCewt,
                tRet,
                tSup,
                temps: { fwsRet: tRet, fwsPre: tPre, fwsSup: tSup, dcOut: tDc, condIn: tCewt, condOut: tCewt + 5.0, chwSup: tChws, chwRet },
                thresholds: { basis: 'db', full: fullThresh, mech: mechThresh }
            };
        },

        topology(sys, op, design, extra) {
            if (!op) op = this.operatingPoint(sys, design);
            const dcApp = sys?.dryCoolerApproachC ?? 5.0;
            const tSup = op?.temps?.fwsSup ?? sys?.fwsSupplyC ?? 40.0;
            const tPre = op?.temps?.fwsPre ?? tSup;
            const tChws = op?.temps?.chwSup ?? 30.0;
            const chwRet = op?.temps?.chwRet ?? (tChws + 5.0);
            const fullThresh = op?.thresholds?.full ?? 33.0;
            const mechThresh = op?.thresholds?.mech ?? 48.0;

            const modeHours = design?.cduModeHours || op?.cduModeHours || extra?.cduModeHours;
            const h1 = modeHours?.free !== undefined ? `${modeHours.free} h` : '';
            const h2 = modeHours?.partial !== undefined ? `${modeHours.partial} h` : '';
            const h3 = modeHours?.mechanical !== undefined ? `${modeHours.mechanical} h` : '';

            return {
                title: 'AI 算力中心廠務排熱拓樸 (Facility Heat Rejection System)',
                referenceLabel: 'NVIDIA Reference Schematic',
                banners: [
                    { id: 'mode1', label: `Mode 1 全自然冷卻 (DB ≤ ${fullThresh}°C)${h1 ? ` — 全年 ${h1}` : ''}`, detail: '100% 走 Economizer', tone: 'emerald' },
                    { id: 'mode2', label: `Mode 2 串聯預冷 + Trim 修整 (${fullThresh} < DB < ${mechThresh}°C)${h2 ? ` — 全年 ${h2}` : ''}`, detail: `預冷至 ${tPre}°C → Trim 冰機`, tone: 'amber' },
                    { id: 'mode3', label: `Mode 3 乾冷器無法預冷，Trim 冰機承擔 100%，乾冷器僅排冷凝熱 (DB ≥ ${mechThresh}°C)${h3 ? ` — 全年 ${h3}` : ''}`, detail: '全額走 Trim 冰機製冷', tone: 'red' }
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
                        id: 'hx_primary',
                        kind: 'hx',
                        title: 'Liquid-to-Liquid HX (Primary)',
                        lines: [
                            '自然預冷 (Free Pre-Cool)',
                            `回水預冷至 ${tPre}°C`,
                            '以乾冷器出水為冷源'
                        ]
                    },
                    {
                        id: 'hx_secondary',
                        kind: 'hx',
                        title: 'Liquid-to-Liquid HX (Secondary)',
                        lines: [
                            '接力修整 (Trim Cooling)',
                            `精確修整至 ${tSup}°C`,
                            `由 Trim Chiller ${tChws}°C 冰水冷卻`
                        ]
                    },
                    {
                        id: 'chiller',
                        kind: 'chiller',
                        title: 'Water Cooled Chillers',
                        lines: [
                            'Trim',
                            '冷凝熱串聯排放至 Dry Coolers',
                            '高效離心/螺桿式機械壓縮製冷'
                        ]
                    },
                    {
                        id: 'dry_cooler',
                        kind: 'dry_cooler',
                        title: 'Dry Coolers',
                        lines: [
                            '零耗水自然風冷',
                            `Approach: ${dcApp}°C ｜ 門檻: ≤${fullThresh}°C`,
                            'Mode 1: 滿載自然風冷',
                            'Mode 2: 串聯預冷與主機冷凝排熱'
                        ]
                    },
                    {
                        id: 'pump_fws',
                        kind: 'pump',
                        title: 'FWS Pump',
                        lines: ['二次側設施供水泵']
                    }
                ],
                pipes: [
                    { from: 'cdu', to: 'hx_primary', label: `${op?.temps?.fwsRet ?? 55}°C`, tone: 'hot' },
                    { from: 'hx_primary', to: 'hx_secondary', label: `${tPre}°C`, tone: 'warm' },
                    { from: 'hx_secondary', to: 'cdu', label: `${tSup}°C`, tone: 'cold' },
                    { from: 'chiller', to: 'hx_secondary', label: `${tChws}°C`, tone: 'cold' },
                    { from: 'hx_secondary', to: 'chiller', label: `${chwRet}°C`, tone: 'hot' },
                    { from: 'dry_cooler', to: 'hx_primary', label: `${op?.temps?.dcOut ?? 35}°C`, tone: 'cold' },
                    { from: 'hx_primary', to: 'chiller', label: `${op?.temps?.condIn ?? 45}°C`, tone: 'warm' },
                    { from: 'chiller', to: 'dry_cooler', label: `${op?.temps?.condOut ?? 49.8}°C`, tone: 'hot' }
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
