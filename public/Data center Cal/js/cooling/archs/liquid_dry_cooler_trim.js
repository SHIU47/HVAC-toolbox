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
                    const peakDb = designCond.maxDb ?? ((designCond.designDb ?? 34.0) + 3.0);
                    const dummyCduSys = ctx.sys || { fwsSupplyC: 40.0, fwsReturnC: 55.0, dryCoolerApproachC: 5.0, pheApproachC: 2.0 };
                    const opPeak = (typeof ctx.helpers?.trimOperatingPoint === 'function')
                        ? ctx.helpers.trimOperatingPoint(dummyCduSys, peakDb)
                        : (root.AppStore?.trimOperatingPoint
                            ? root.AppStore.trimOperatingPoint(dummyCduSys, peakDb)
                            : { chiller_fraction: 0.35, tChws: 30, tCewt: 39 });
                    return Math.max(50, Math.round(ctx.reqKw * (opPeak.chiller_fraction ?? 0.35)));
                },
                extraProps: (ctx) => {
                    const designCond = (typeof ctx.helpers?.designConditions === 'function')
                        ? ctx.helpers.designConditions()
                        : (root.AppStore?.designConditions ? root.AppStore.designConditions() : { designDb: 34.0, designWb: 28.0, maxDb: 38.0 });
                    const peakDb = designCond.maxDb ?? ((designCond.designDb ?? 34.0) + 3.0);
                    const dummyCduSys = ctx.sys || { fwsSupplyC: 40.0, fwsReturnC: 55.0, dryCoolerApproachC: 5.0, pheApproachC: 2.0 };
                    const opPeak = (typeof ctx.helpers?.trimOperatingPoint === 'function')
                        ? ctx.helpers.trimOperatingPoint(dummyCduSys, peakDb)
                        : (root.AppStore?.trimOperatingPoint
                            ? root.AppStore.trimOperatingPoint(dummyCduSys, peakDb)
                            : { chiller_fraction: 0.35, tChws: 30, tCewt: 39 });
                    return {
                        peakRatio: opPeak.chiller_fraction ?? 0.35,
                        maxMechanicalKw: Math.round(ctx.reqKw)
                    };
                },
                calcQty: (reqKw, cap) => {
                    const minUnits = Math.max(1, Math.ceil(reqKw / (cap || 500)));
                    return { qty: minUnits + 1, n1: minUnits + 1 };
                },
                derate: (curItem, ctx) => {
                    if (typeof root.ChillerEngine === 'undefined') return 1.0;
                    const peakDb = ctx.designCond?.maxDb ?? ((ctx.designCond?.designDb ?? 34.0) + 3.0);
                    const opPeak = ctx.helpers?.trimOperatingPoint
                        ? ctx.helpers.trimOperatingPoint(ctx.sys, peakDb)
                        : (root.AppStore?.trimOperatingPoint ? root.AppStore.trimOperatingPoint(ctx.sys, peakDb) : {});
                    const spec = {
                        cooling_capacity_kw: curItem.capKw,
                        chiller_type: 'water_cooled',
                        cop_curve: curItem.cop_curve || { type: 'fixed' }
                    };
                    return root.ChillerEngine.deratedCapacityKW(spec, opPeak.tChws, opPeak.tCewt, peakDb)?.derate_factor ?? 1.0;
                }
            }
        ],

        stages: [
            { type: 'dry_cooler', role: 'economizer', hasPhe: true, equipKey: 'dry_cooler' },
            { type: 'chiller', role: 'mechanical', chillerType: 'water_cooled', equipKey: 'trim_chiller', fallbackCop: 6.2 }
        ],

        operatingPoint(sys, w, equip, opts) {
            const db_c = (typeof w === 'number') ? w : (w?.db ?? 25.0);
            const wb_c = (typeof w === 'object' && w?.wb !== undefined) ? w.wb : 20.0;
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

            const Q_liq = sys?.designBasis?.liq_load_kw || opts?.qKw || 1000;
            const Q_trim = Math.round(Q_liq * (eco.chiller_fraction || 0));
            let chillerKw = 0;
            let chillerCop = 6.2;
            let pComp = 0;

            if (opts?.withChiller && Q_trim > 0) {
                chillerKw = Q_trim;
                const stageChiller = root.CoolingStages?.get('chiller');
                const chillers = equip?.trim_chiller || equip?.chillers || [];
                if (stageChiller) {
                    const simRes = stageChiller.simulate({
                        Q_kw: Q_trim,
                        devices: chillers,
                        t_chws_c: tChws,
                        t_cewt_c: tCewt,
                        w: { db: db_c, wb: wb_c },
                        chillerType: 'water_cooled',
                        fallbackCop: 6.2
                    });
                    pComp = simRes.compressorKw || 0;
                    chillerCop = pComp > 0 ? Number((Q_trim / pComp).toFixed(2)) : 6.2;
                } else {
                    pComp = Q_trim / 6.2;
                    chillerCop = 6.2;
                }
            } else if (Q_trim === 0) {
                const trimItem = (sys?.sizing || []).find(s => s.key === 'trim_chiller');
                chillerCop = trimItem?.catalog?.find(c => c.model === trimItem.selectedModel)?.cop || 6.2;
            }

            const dtFws = Math.max(0.5, tRet - tSup);
            const m_cp = Math.max(1, Q_liq) / dtFws;
            const condOut = Number((Q_trim > 0 ? (tCewt + (Q_trim + pComp) / m_cp) : tCewt).toFixed(1));

            return {
                ...eco,
                mode,
                tDc,
                tPre,
                tChws,
                tCewt,
                tRet,
                tSup,
                chillerKw,
                chillerCop,
                pComp,
                temps: { fwsRet: tRet, fwsPre: tPre, fwsSup: tSup, dcOut: tDc, condIn: tCewt, condOut, chwSup: tChws, chwRet },
                thresholds: { basis: 'db', full: fullThresh, mech: mechThresh }
            };
        },

        peakPoint(sys, design, equip) {
            const peakDb = design?.peakDb?.value ?? design?.maxDb ?? ((design?.designDb ?? 35.0) + 3.0);
            const designWb = design?.designWb ?? 28.0;
            const res = this.operatingPoint(sys, { db: peakDb, wb: designWb }, equip, { withChiller: true, design });
            return { ...res, db: peakDb };
        },

        topology(sys, op, design, extra) {
            const equip = extra?.equip || design?.equip;
            if (!op) op = this.operatingPoint(sys, { db: design?.designDb ?? 35.0, wb: design?.designWb ?? 28.0 }, equip, { withChiller: true, design });
            const peak = this.peakPoint(sys, design, equip);
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
                title: 'NVIDIA DSX 參考拓樸',
                referenceLabel: 'NVIDIA Reference Schematic',
                banners: [
                    {
                        id: 'mode1',
                        title: 'Mode 1 全自然冷卻',
                        label: `Mode 1 全自然冷卻 (DB ≤ ${fullThresh}°C)${h1 ? ` — 全年 ${h1}` : ''}`,
                        sub: `DB ≤ ${fullThresh}°C ｜ 全年 ${h1 || '0 h'} ｜ 100% 走 Economizer`,
                        detail: `DB ≤ ${fullThresh}°C ｜ 全年 ${h1 || '0 h'} ｜ 100% 走 Economizer`,
                        tone: 'emerald'
                    },
                    {
                        id: 'mode2',
                        title: 'Mode 2 串聯預冷 + Trim 修整',
                        label: `Mode 2 串聯預冷 + Trim 修整 (${fullThresh} < DB < ${mechThresh}°C)${h2 ? ` — 全年 ${h2}` : ''}`,
                        sub: `${fullThresh} < DB < ${mechThresh}°C ｜ 全年 ${h2 || '0 h'} ｜ 預冷至 ${tPre}°C → Trim 冰機`,
                        detail: `${fullThresh} < DB < ${mechThresh}°C ｜ 全年 ${h2 || '0 h'} ｜ 預冷至 ${tPre}°C → Trim 冰機`,
                        tone: 'amber'
                    },
                    {
                        id: 'mode3',
                        title: 'Mode 3 乾冷器僅排冷凝熱',
                        label: `Mode 3 乾冷器僅排冷凝熱 (DB ≥ ${mechThresh}°C)${h3 ? ` — 全年 ${h3}` : ''}`,
                        sub: `DB ≥ ${mechThresh}°C ｜ 全年 ${h3 || '0 h'} ｜ 乾冷器僅排冷凝熱`,
                        detail: `DB ≥ ${mechThresh}°C ｜ 全年 ${h3 || '0 h'} ｜ 乾冷器僅排冷凝熱`,
                        tone: 'red'
                    }
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
                warnings: [],
                op,
                peak
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
