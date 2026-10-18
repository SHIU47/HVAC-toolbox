'use strict';
/**
 * air_air_cooled_chiller.js - Air-Cooled Chiller with Integrated Free-Cooling Coil
 */
(function (root) {
    const CoolingArchRegistry = root.CoolingArchRegistry;
    const CoolingStages = root.CoolingStages;
    if (!CoolingArchRegistry || !CoolingStages) {
        throw new Error('CoolingArchRegistry and CoolingStages must be loaded before air_air_cooled_chiller.js');
    }
    const t = (k, p, fb) => (root.I18N ? root.I18N.t(k, p) : (fb || k));

    CoolingArchRegistry.register({
        id: 'air_cooled_chiller',
        aliases: [],
        loop: 'air',
        get optionLabel() { return t('arch.air_cooled_chiller.option', null, '💨 氣冷式冰水主機 (Air-Cooled Chiller / 零耗水)'); },
        get cardLabel() { return t('arch.air_cooled_chiller.card', null, '氣冷式冰機'); },
        get pillLabel() { return t('arch.air_cooled_chiller.pill', null, '氣冷冰機'); },
        get dashboardLabel() { return t('arch.air_cooled_chiller.dashboard', null, '氣冷式冰水主機 (Air-Cooled Chiller)'); },
        flags: { hasMechanical: true, consumesWater: false },
        terminal: 'crah',
        schematic: 'air_plant',
        params: [
            { key: 'chwSupplyC', default: 12.0, min: 7, max: 25, step: 0.5, unit: '°C' },
            { key: 'chwReturnC', default: 18.0, min: 12, max: 35, step: 0.5, unit: '°C' }
        ],
        equipment: [
            {
                key: 'crah_unit',
                get label() { return t('equip.crah_unit', null, 'CRAH / Fanwall 機房空調'); },
                category: 'CRAH',
                catalog: 'crah',
                role: 'terminal',
                resolver: 'crah',
                defaultModel: 'Stulz CyberAir 4 CFD 600 A (60kW)',
                defaultUnitCapKw: 60,
                requiredKw: (ctx) => ctx.reqKw,
                calcQty: (reqKw, cap) => {
                    const minUnits = Math.max(1, Math.ceil(reqKw / 60));
                    return { qty: minUnits + 1, n1: minUnits + 1 };
                }
            },
            {
                key: 'air_cooled_chiller',
                get label() { return t('equip.air_cooled_chiller', null, 'Air-Cooled Chiller 氣冷式冰水主機'); },
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
                get label() { return t('equip.fw_pump', null, 'Secondary CHW Pump 二次側冰水循環水泵'); },
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

        stages: [
            { type: 'fc_coil', role: 'economizer' },
            { type: 'chiller', role: 'mechanical', chillerType: 'air_cooled', equipKey: 'air_cooled_chiller' }
        ],

        // R6 P0-C1: 只有內建水側自然冷卻盤管的機型（如 Uniflair XCAF）才串聯 fc_coil；
        // 30XA / YVAA / CGAF / CoolLoop / XCAC 等純氣冷壓縮機型全年走機械製冷。
        // sys.hasFcCoil 明確設定時優先。
        hasIntegratedFcCoil(sys, equip) {
            if (sys?.hasFcCoil === true) return true;
            if (sys?.hasFcCoil === false) return false;
            const item = (sys?.sizing || []).find(s => s.key === 'air_cooled_chiller');
            const catEntry = item ? (item.catalog || []).find(c => c.model === item.selectedModel) : null;
            const text = [item?.selectedModel, catEntry?.category, equip?.air_cooled_chiller?.[0]?.model, equip?.air_cooled_chiller?.[0]?.category]
                .filter(Boolean).join(' ');
            return /XCAF|Free-?Cool|Economizer|自然冷卻/i.test(text);
        },

        operatingPoint(sys, w, equip) {
            const db_c = (typeof w === 'number') ? w : (w?.db ?? 25.0);
            const chwSupplyC = sys?.chwSupplyC ?? 12.0;
            const chwReturnC = sys?.chwReturnC ?? 18.0;
            const fcApproach = (typeof root.A === 'function') ? root.A('air_chiller_fc_coil_approach_c') : 4.0;
            const tAvail = db_c + fcApproach;
            if (!this.hasIntegratedFcCoil(sys, equip)) {
                return {
                    fc_fraction: 0.0,
                    chiller_fraction: 1.0,
                    mode: 'mechanical',
                    hasFcCoil: false,
                    tAvail,
                    chwSupplyC,
                    chwReturnC,
                    chwPre: chwReturnC,
                    temps: { chwSup: chwSupplyC, chwRet: chwReturnC, chwPre: chwReturnC, coilAvail: tAvail, tAvail },
                    thresholds: { basis: 'db', full: null, mech: null }
                };
            }
            const eco =(typeof root.FreeCoolingEngine?.calcSeriesEconomizer === 'function')
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
                hasFcCoil: true,
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

            const modeHours = design?.fwModeHours || op?.fwModeHours || extra?.fwModeHours;
            const h_free = modeHours?.free !== undefined ? `${modeHours.free} h` : '';
            const h_partial = modeHours?.partial !== undefined ? `${modeHours.partial} h` : '';
            const h_mech = modeHours?.mechanical !== undefined ? `${modeHours.mechanical} h` : '';

            const model = {
                title: t('topo.airCooledChiller', null, '氣冷式冰水主機 (Air-Cooled Chiller)'),
                referenceLabel: null,
                banners: [
                    {
                        id: 'mode1',
                        title: t('topo.rdhxM1', null, 'Mode 1 全自然冷卻'),
                        label: t('topo.m1FullFcLabel', { fullThresh, hours: h_free ? ` — 全年 ${h_free}` : '' }, `Mode 1 全自然冷卻 (DB ≤ ${fullThresh}°C)${h_free ? ` — 全年 ${h_free}` : ''}`),
                        sub: t('topo.fullFcEconomizerCoil', null, `DB ≤ ${fullThresh}°C ｜ 全年 ${h_free || '0 h'} ｜ 100% 走 Economizer 盤管`),
                        detail: t('topo.fullFcEconomizerCoil', null, `DB ≤ ${fullThresh}°C ｜ 全年 ${h_free || '0 h'} ｜ 100% 走 Economizer 盤管`),
                        tone: 'emerald'
                    },
                    {
                        id: 'mode2',
                        title: t('topo.rdhxM2', null, 'Mode 2 部分預冷'),
                        label: t('topo.rdhxM2Label', { fullThresh, mechThresh, hours: h_partial ? ` — 全年 ${h_partial}` : '' }, `Mode 2 部分預冷 (${fullThresh} < DB < ${mechThresh}°C)${h_partial ? ` — 全年 ${h_partial}` : ''}`),
                        sub: t('topo.fcCoilPrecoolChiller', null, `${fullThresh} < DB < ${mechThresh}°C ｜ 全年 ${h_partial || '0 h'} ｜ FC 盤管預冷 + 冰機接力`),
                        detail: t('topo.fcCoilPrecoolChiller', null, `${fullThresh} < DB < ${mechThresh}°C ｜ 全年 ${h_partial || '0 h'} ｜ FC 盤管預冷 + 冰機接力`),
                        tone: 'amber'
                    },
                    {
                        id: 'mode3',
                        title: t('topo.rdhxM3', null, 'Mode 3 全機械製冷'),
                        label: t('topo.rdhxM3Label', { mechThresh, hours: h_mech ? ` — 全年 ${h_mech}` : '' }, `Mode 3 全機械製冷 (DB ≥ ${mechThresh}°C)${h_mech ? ` — 全年 ${h_mech}` : ''}`),
                        sub: t('topo.airCompressionCooling', null, `DB ≥ ${mechThresh}°C ｜ 全年 ${h_mech || '0 h'} ｜ 氣冷壓縮製冷`),
                        detail: t('topo.airCompressionCooling', null, `DB ≥ ${mechThresh}°C ｜ 全年 ${h_mech || '0 h'} ｜ 氣冷壓縮製冷`),
                        tone: 'indigo'
                    }
                ],
                nodes: [
                    {
                        id: 'crah',
                        kind: 'crah',
                        title: 'Compute Data Hall (CRAH)',
                        lines: [
                            t('topo.crahAirUnit', null, 'CRAH 氣冷機組'),
                            t('topo.crahSupplyReturn', { sup: chwSup, ret: chwRet }, `供回水: ${chwSup} ⇄ ${chwRet}°C`)
                        ]
                    },
                    {
                        id: 'fc_coil',
                        kind: 'hx',
                        title: t('topo.fcCoilTitle', null, 'Free-Cooling 盤管 (串聯預冷)'),
                        lines: [
                            t('topo.fcCoilFull', { thresh: fullThresh }, `全自然冷卻 DB ≤ ${fullThresh}°C`),
                            t('topo.fcCoilPartial', { thresh: mechThresh }, `部分預冷 DB < ${mechThresh}°C${(h_free || h_partial) ? ` — 全年 ${h_free || '0 h'}/${h_partial || '0 h'}` : ''}`),
                            t('topo.fcCoilDirect', null, '室外低溫乾球直接預冷冰水回水'),
                            t('topo.fcCoilSeries', null, '串聯於蒸發器前段，節省壓縮機功耗')
                        ]
                    },
                    {
                        id: 'evaporator',
                        kind: 'hx',
                        title: t('schematic.chwEvaporator', null, '冰水蒸發器 (CHW Evaporator)'),
                        lines: [
                            t('topo.evapCore', null, '機械壓縮製冷核心'),
                            t('topo.evapSupplyReturn', { sup: chwSup, ret: chwRet }, `供水 ${chwSup}°C ⇄ 回水 ${chwRet}°C`),
                            t('topo.evapAirRejNoTower', null, '氣冷散熱・無冷卻水塔耗水'),
                            t('topo.evapTrimSupply', null, '接力修整供水溫度')
                        ]
                    },
                    {
                        id: 'heat_rejection',
                        kind: 'chiller',
                        title: t('topo.airCooledPlantTitle', null, '室外氣冷冷凝機組 (Air-Cooled Plant)'),
                        lines: [
                            t('topo.vbankCondenserCoil', null, 'V-Bank 氣冷冷凝盤管 + 變頻 EC 風扇'),
                            t('topo.dbAirRejection', null, '以室外乾球溫度 (DB) 直接風冷散熱'),
                            t('topo.sealedRefrigZeroWater', null, '全封閉冷媒迴路 ｜ 零水耗 (WUE = 0)'),
                            t('topo.integratedFcCoil', null, '整合式冷媒/水側自然冷卻盤管')
                        ]
                    },
                    {
                        id: 'pump',
                        kind: 'pump',
                        title: 'Secondary CHW Pump',
                        lines: [t('topo.secChwPump', null, '二次側冰水循環泵')]
                    }
                ],
                pipes: [
                    { from: 'crah', to: 'fc_coil', label: `${chwRet}°C`, tone: 'hot' },
                    { from: 'fc_coil', to: 'evaporator', label: `${op?.temps?.chwPre ?? chwSup}°C`, tone: 'warm' },
                    { from: 'evaporator', to: 'crah', label: `${chwSup}°C`, tone: 'cold' }
                ],
                footer: [],
                warnings: [],
                op
            };

            // R6 P0-C1: 純氣冷機型無自然冷卻盤管 → 單一全機械模式、移除 fc_coil 節點
            if (op?.hasFcCoil === false) {
                model.banners = [{
                    id: 'mode3',
                    title: t('topo.airChillerAllYearMech', null, '全年機械製冷'),
                    label: t('topo.airChillerNoFcCoil', null, `全年機械製冷（機型無自然冷卻盤管）${h_mech ? ` — 全年 ${h_mech}` : ''}`),
                    sub: t('topo.noFcCoilAllYearMech', { hours: h_mech || '8760 h' }, `機型無水側自然冷卻盤管 ｜ 全年 ${h_mech || '8760 h'} ｜ 氣冷壓縮製冷`),
                    detail: t('topo.noFcCoilAllYearMech', { hours: h_mech || '8760 h' }, `機型無水側自然冷卻盤管 ｜ 全年 ${h_mech || '8760 h'} ｜ 氣冷壓縮製冷`),
                    tone: 'indigo'
                }];
                model.nodes = model.nodes.filter(n => n.id !== 'fc_coil');
                const rej = model.nodes.find(n => n.id === 'heat_rejection');
                if (rej) rej.lines = rej.lines.filter(l => !l.includes('自然冷卻盤管') && !l.includes('FC coil'));
                model.pipes = [
                    { from: 'crah', to: 'evaporator', label: `${chwRet}°C`, tone: 'hot' },
                    { from: 'evaporator', to: 'crah', label: `${chwSup}°C`, tone: 'cold' }
                ];
            }
            return model;
        },

        simulateHour(ctx) {
            const activeStages = this.hasIntegratedFcCoil(ctx.sys, ctx.equip)
                ? this.stages
                : [{ type: 'chiller', role: 'mechanical', chillerType: 'air_cooled', equipKey: 'air_cooled_chiller' }];
            return (typeof root.runStageChain === 'function')
                ? root.runStageChain(activeStages, ctx, this)
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
            const chwSupplyC = op.temps.chwSup;
            const fwBaseCop = (typeof root.CoolingArchHelpers !== 'undefined')
                ? root.CoolingArchHelpers.chillerFallbackCop(chwSupplyC)
                : (chwSupplyC >= 20 ? 5.8 : (chwSupplyC >= 12 ? 4.2 : 3.0));

            const airFcKwPerKw = (typeof root.A === 'function') ? root.A('air_chiller_fc_fan_kw_per_kw') : 0.05;

            const Q_fc = Q_kw * op.fc_fraction;
            const Q_mech = Q_kw * op.chiller_fraction;
            let fanKw = Q_fc * airFcKwPerKw;
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
                chillerEnvelopeExceeded: chRes?.exceedsEnvelope || false,
                op,
                diag: { eco: op, chRes }
            };
        }
    });
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
