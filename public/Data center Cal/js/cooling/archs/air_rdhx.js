'use strict';
/**
 * air_rdhx.js - Rear Door Heat Exchanger (RDHX Neutral Loop / Air-to-Liquid Rack Backdoor)
 */
(function (root) {
    const CoolingArchRegistry = root.CoolingArchRegistry;
    const CoolingStages = root.CoolingStages;
    if (!CoolingArchRegistry || !CoolingStages) {
        throw new Error('CoolingArchRegistry and CoolingStages must be loaded before air_rdhx.js');
    }

    CoolingArchRegistry.register({
        id: 'rdhx',
        aliases: [],
        loop: 'air',
        optionLabel: '🚪 背板式熱交換器 (Rear Door Heat Exchanger, RDHX)',
        cardLabel: 'RDHX 背板',
        pillLabel: 'RDHX 背板',
        dashboardLabel: '背板熱交換器 (RDHx Neutral Loop)',
        flags: { hasMechanical: true, consumesWater: false, isRdhx: true },
        terminal: 'rdhx',
        schematic: 'air_plant',
        params: [
            { key: 'chwSupplyC', default: 12.0, min: 7, max: 25, step: 0.5, unit: '°C' },
            { key: 'chwReturnC', default: 18.0, min: 12, max: 35, step: 0.5, unit: '°C' }
        ],
        equipment: [
            {
                key: 'rdhx_unit',
                label: 'RDHX 背板式熱交換器 (Rear Door HX)',
                category: 'RDHX',
                catalog: 'rdhx',
                role: 'terminal',
                resolver: 'crah',
                defaultModel: 'Vertiv Geist RDHX 60kW (標準)',
                defaultUnitCapKw: 60,
                requiredKw: (ctx) => ctx.reqKw,
                calcQty: (reqKw, cap) => {
                    const minUnits = Math.max(1, Math.ceil(reqKw / 60));
                    return { qty: minUnits + 1, n1: minUnits + 1 };
                }
            },
            {
                key: 'air_cooled_chiller',
                label: 'Air-Cooled Chiller 氣冷式冰水主機',
                category: 'Chiller',
                catalog: 'chiller_air',
                role: 'chiller',
                chillerType: 'air_cooled',
                defaultModel: 'Carrier 30XA 300kW Screw Air-Cooled (標準)',
                defaultUnitCapKw: 300,
                requiredKw: (ctx) => ctx.reqKw,
                calcQty: (reqKw, cap) => {
                    const minUnits = Math.max(1, Math.ceil(reqKw / 300));
                    return { qty: minUnits + 1, n1: minUnits + 1 };
                },
                derate: (curItem, ctx) => {
                    if (typeof root.ChillerEngine === 'undefined') return 1.0;
                    const spec = {
                        cooling_capacity_kw: curItem.capKw,
                        chiller_type: 'air_cooled',
                        cop_curve: curItem.cop_curve || { type: 'fixed' }
                    };
                    return root.ChillerEngine.deratedCapacityKW(spec, ctx.sys?.chwSupplyC || 12.0, undefined, ctx.designCond.designDb)?.derate_factor ?? 1.0;
                }
            },
            {
                key: 'fw_pump',
                label: 'Secondary CHW Pump 二次側冰水循環水泵',
                category: 'Pump',
                catalog: 'pump',
                role: 'pump',
                requiredKw: (ctx) => ctx.pumpPowerKw || 5.0,
                selectModel: (cat, ctx) => {
                    const pumpKw = ctx.pumpPowerKw || 5.0;
                    const model = pumpKw <= 3.5 ? 'Grundfos TPE 3.0kW Inverter Pump' : (pumpKw <= 6.0 ? 'Grundfos TPE 5.5kW Inverter Pump (標準)' : 'Armstrong Design Envelope 11.0kW');
                    const capKw = pumpKw <= 3.5 ? 3.0 : (pumpKw <= 6.0 ? 5.5 : 11.0);
                    return { model, capKw };
                },
                calcQty: () => ({ qty: 2, n1: 2 })
            }
        ],

        operatingPoint(sys, w, equip) {
            const db_c = (typeof w === 'number') ? w : (w?.db ?? 25.0);
            const chwSupplyC = sys?.chwSupplyC ?? 12.0;
            const chwReturnC = sys?.chwReturnC ?? 18.0;
            const fcApproach = (typeof root.A === 'function') ? root.A('air_chiller_fc_coil_approach_c') : 4.0;
            const tAvail = db_c + fcApproach;
            const eco = (typeof root.FreeCoolingEngine?.calcSeriesEconomizer === 'function')
                ? root.FreeCoolingEngine.calcSeriesEconomizer(tAvail, chwSupplyC, chwReturnC)
                : { fc_fraction: (tAvail <= chwSupplyC ? 1.0 : 0.0), chiller_fraction: (tAvail <= chwSupplyC ? 0.0 : 1.0), mode: (tAvail <= chwSupplyC ? 'FULL_FC' : 'MECH') };
            const mode = (typeof root.CoolingArchHelpers !== 'undefined')
                ? root.CoolingArchHelpers.modeFromEco(eco)
                : ((eco.mode === (root.FreeCoolingEngine?.MODE?.FULL_FC || 'FULL_FC'))
                    ? 'free'
                    : ((eco.mode === (root.FreeCoolingEngine?.MODE?.PARTIAL_FC || 'PARTIAL_FC')) ? 'partial' : 'mechanical'));
            const fullThresh = Number((chwSupplyC - fcApproach).toFixed(1));
            const mechThresh = Number((chwReturnC - fcApproach).toFixed(1));
            const chwPre = Number((eco.t_precooled_c ?? Math.min(chwReturnC, Math.max(chwSupplyC, tAvail))).toFixed(1));
            return {
                ...eco,
                mode,
                tAvail,
                chwSupplyC,
                chwReturnC,
                chwPre,
                temps: { chwSup: chwSupplyC, chwRet: chwReturnC, chwPre, coilAvail: tAvail, tAvail },
                thresholds: { basis: 'db', full: fullThresh, mech: mechThresh }
            };
        },

        topology(sys, op, design, extra) {
            const equip = extra?.equip || design?.equip;
            if (!op) op = this.operatingPoint(sys, { db: design?.designDb ?? 35.0, wb: design?.designWb ?? 28.0 }, equip, { withChiller: true, design });
            const chwSup = op?.temps?.chwSup ?? sys?.chwSupplyC ?? 12.0;
            const chwRet = op?.temps?.chwRet ?? sys?.chwReturnC ?? 18.0;
            const fcApproach = (typeof root.A === 'function') ? root.A('air_chiller_fc_coil_approach_c') : 4.0;
            const fullThresh = op?.thresholds?.full ?? Number((chwSup - fcApproach).toFixed(1));
            const mechThresh = op?.thresholds?.mech ?? Number((chwRet - fcApproach).toFixed(1));
            const minChws = (typeof root.A === 'function') ? root.A('rdhx_min_chws_c') : 17.0;

            const modeHours = design?.fwModeHours || op?.fwModeHours || extra?.fwModeHours;
            const h_free = modeHours?.free !== undefined ? `${modeHours.free} h` : '';
            const h_partial = modeHours?.partial !== undefined ? `${modeHours.partial} h` : '';
            const h_mech = modeHours?.mechanical !== undefined ? `${modeHours.mechanical} h` : '';

            const warnings = [];
            if (chwSup < minChws) {
                warnings.push('RDHX 供水低於露點保護溫度，有結露風險');
            }

            return {
                title: 'RDHX 背板水冷散熱拓樸',
                referenceLabel: null,
                banners: [
                    { id: 'mode1', label: `全自然冷卻 (DB ≤ ${fullThresh}°C)${h_free ? ` — 全年 ${h_free}` : ''}`, detail: '氣冷 FC 盤管自然供冷', tone: 'emerald' },
                    { id: 'mode2', label: `部分預冷 (${fullThresh} < DB < ${mechThresh}°C)${h_partial ? ` — 全年 ${h_partial}` : ''}`, detail: 'FC 盤管預冷 + 氣冷冰機接力', tone: 'amber' },
                    { id: 'mode3', label: `全機械製冷 (DB ≥ ${mechThresh}°C)${h_mech ? ` — 全年 ${h_mech}` : ''}`, detail: '氣冷冰水主機供冷', tone: 'indigo' }
                ],
                nodes: [
                    {
                        id: 'rdhx',
                        kind: 'rdhx',
                        title: 'Compute Data Hall (RDHX)',
                        lines: [
                            'RDHX 伺服器水冷背板',
                            `供回水: ${chwSup} ⇄ ${chwRet}°C`
                        ]
                    },
                    {
                        id: 'fc_coil',
                        kind: 'hx',
                        title: 'Free-Cooling 盤管 (串聯預冷)',
                        lines: [
                            `全自然冷卻 DB ≤ ${fullThresh}°C`,
                            `部分預冷 DB < ${mechThresh}°C${(h_free || h_partial) ? ` — 全年 ${h_free || '0 h'}/${h_partial || '0 h'}` : ''}`,
                            '室外低溫乾球直接預冷冰水回水',
                            '串聯於蒸發器前段，節省壓縮機功耗'
                        ]
                    },
                    {
                        id: 'evaporator',
                        kind: 'hx',
                        title: '氣冷冰水主機 (Air-Cooled Chiller)',
                        lines: [
                            '氣冷壓縮製冷 + FC 盤管整合',
                            `供水 ${chwSup}°C ⇄ 回水 ${chwRet}°C`,
                            '高溫時接力修整至目標供水溫',
                            '全封閉冷媒迴路・零水耗 (WUE = 0)'
                        ]
                    },
                    {
                        id: 'heat_rejection',
                        kind: 'chiller',
                        title: '室外氣冷排熱機組 (Air-Cooled Plant)',
                        lines: [
                            'V-Bank 氣冷冷凝盤管 + 變頻風扇',
                            '以室外乾球溫度 (DB) 直接風冷散熱',
                            '全封閉冷媒迴路 ｜ 零水耗 (WUE = 0)',
                            (chwSup < minChws ? '⚠ 供水低於露點保護溫度，有結露風險' : '無結露風險 (高於機房露點溫度)')
                        ]
                    },
                    {
                        id: 'pump',
                        kind: 'pump',
                        title: 'Secondary CHW Pump',
                        lines: ['二次側冰水循環泵']
                    }
                ],
                pipes: [
                    { from: 'rdhx', to: 'fc_coil', label: `${chwRet}°C`, tone: 'hot' },
                    { from: 'fc_coil', to: 'evaporator', label: `${op?.temps?.chwPre ?? chwSup}°C`, tone: 'warm' },
                    { from: 'evaporator', to: 'rdhx', label: `${chwSup}°C`, tone: 'cold' }
                ],
                footer: [],
                warnings,
                op
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
            const chwSupplyC = op.temps.chwSup;
            const fwBaseCop = (typeof root.CoolingArchHelpers !== 'undefined')
                ? root.CoolingArchHelpers.chillerFallbackCop(chwSupplyC)
                : (chwSupplyC >= 20 ? 5.8 : (chwSupplyC >= 12 ? 4.2 : 3.0));

            const rdhxFanKwPerKw = (typeof root.A === 'function') ? root.A('rdhx_fc_fan_kw_per_kw') : 0.03;

            const Q_fc = Q_kw * op.fc_fraction;
            const Q_mech = Q_kw * op.chiller_fraction;

            let fanKw = Q_fc * rdhxFanKwPerKw;
            let compressorKw = 0;
            let deficitKw = 0;
            let chRes = null;

            if (Q_mech > 0) {
                const chStage = CoolingStages.get('chiller');
                chRes = chStage.simulate({
                    ...ctx,
                    Q_kw: Q_mech,
                    chillerType: 'air_cooled',
                    t_chws_c: chwSupplyC,
                    fallbackCop: fwBaseCop,
                    devices: ctx.equip?.air_cooled_chiller
                });
                compressorKw = chRes.compressorKw;
                deficitKw = chRes.deficitKw || 0;
                fanKw += (Q_mech / 500) * 8.0;
            }

            return {
                terminalKw: ctx.terminalKw || 0,
                pumpKw: ctx.pumpKw || 0,
                fanKw,
                compressorKw,
                waterM3: 0,
                mode: op.mode,
                deficitKw,
                heatRemovedKw: Math.max(0, Q_kw - deficitKw),
                mechLoadKw: Q_mech,
                op,
                diag: { eco: op, Q_fc, Q_mech, chRes }
            };
        }
    });
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
