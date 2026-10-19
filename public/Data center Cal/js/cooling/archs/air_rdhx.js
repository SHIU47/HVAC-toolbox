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
    const t = (k, p, fb) => (root.I18N ? root.I18N.t(k, p) : (fb || k));

    CoolingArchRegistry.register({
        id: 'rdhx',
        aliases: [],
        loop: 'air',
        get optionLabel() { return t('arch.rdhx.option', null, '🚪 背板式熱交換器 (Rear Door Heat Exchanger, RDHX)'); },
        get cardLabel() { return t('arch.rdhx.card', null, 'RDHX 背板'); },
        get pillLabel() { return t('arch.rdhx.pill', null, 'RDHX 背板'); },
        get dashboardLabel() { return t('arch.rdhx.dashboard', null, '背板熱交換器 (RDHx Neutral Loop)'); },
        flags: { hasMechanical: true, consumesWater: false, isRdhx: true },
        terminal: 'rdhx',
        schematic: 'air_plant',
        params: [
            { key: 'chwSupplyC', default: 12.0, min: 7, max: 25, step: 0.5, unit: '°C' },
            { key: 'chwReturnC', default: 18.0, min: 12, max: 35, step: 0.5, unit: '°C' },
            {
                key: 'roomDbC',
                archSpecific: true,
                nullable: true,
                get label() { return t('rdhx.roomDb', null, '機房冷通道乾球溫度 (°C，留空=15°C基準)'); },
                idPrefix: 'rdhxRoomDbIn_',
                default: null,
                min: 10,
                max: 40,
                step: 0.5,
                unit: '°C',
                get placeholder() { return t('rdhx.roomDbPlaceholder', null, '預設 24°C'); }
            },
            {
                key: 'roomRhPct',
                archSpecific: true,
                nullable: true,
                get label() { return t('rdhx.roomRh', null, '機房相對濕度 (%，留空=15°C基準)'); },
                idPrefix: 'rdhxRoomRhIn_',
                default: null,
                min: 10,
                max: 95,
                step: 1,
                unit: '%',
                get placeholder() { return t('rdhx.roomRhPlaceholder', null, '預設 50%'); }
            }
        ],
        get paramPanelTitle() { return t('rdhx.paramPanelTitle', null, 'RDHX 背板 (Neutral Loop) 專屬參數:'); },
        equipment: [
            {
                key: 'rdhx_unit',
                get label() { return t('equip.rdhx_unit', null, 'RDHX 背板式熱交換器 (Rear Door HX)'); },
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
                        cop_curve: curItem.cop_curve || { type: 'fixed' },
                        t_chws_design: curItem.t_chws_c,
                        category: curItem.category
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
            const roomDb = sys?.roomDbC;
            const roomRh = sys?.roomRhPct;
            const marginK = (typeof root.A === 'function') ? root.A('rdhx_dewpoint_margin_k') : 2.0;
            let dp, source;
            if (roomDb !== null && roomDb !== undefined && roomRh !== null && roomRh !== undefined && Number.isFinite(Number(roomDb)) && Number.isFinite(Number(roomRh))) {
                const calcDp = (typeof root.calcDewPointC === 'function') ? root.calcDewPointC : (typeof calcDewPointC === 'function' ? calcDewPointC : null);
                dp = calcDp ? calcDp(Number(roomDb), Number(roomRh)) : 15.0;
                source = t('sizing.rdhxRoomCond', { db: Number(roomDb), rh: Number(roomRh) }, `機房 ${Number(roomDb)}°C / ${Number(roomRh)}%`);
            } else {
                dp = (typeof root.A === 'function') ? root.A('rdhx_default_room_dp_c') : 15.0;
                source = t('sizing.rdhxAshraeDefault', null, 'ASHRAE TC9.9 預設');
            }
            const minChws = dp + marginK;

            const modeHours = design?.fwModeHours || op?.fwModeHours || extra?.fwModeHours;
            const h_free = modeHours?.free !== undefined ? `${modeHours.free} h` : '';
            const h_partial = modeHours?.partial !== undefined ? `${modeHours.partial} h` : '';
            const h_mech = modeHours?.mechanical !== undefined ? `${modeHours.mechanical} h` : '';

            const warnings = [];
            if (chwSup < minChws) {
                warnings.push(t('sizing.warnRdhxCondensation', { sup: chwSup.toFixed(1), limit: minChws.toFixed(1), dp: dp.toFixed(1), source }, `RDHX 供水 ${chwSup.toFixed(1)}°C 低於結露保護溫度 ${minChws.toFixed(1)}°C（機房露點 ${dp.toFixed(1)}°C，${source}），有結露風險`));
            }

            return {
                title: t('topo.rdhxTopo', null, 'RDHX 背板水冷散熱拓樸'),
                referenceLabel: null,
                banners: [
                    {
                        id: 'mode1',
                        title: t('topo.rdhxM1', null, 'Mode 1 全自然冷卻'),
                        label: t('topo.rdhxM1Label', { fullThresh, hours: h_free ? ` — 全年 ${h_free}` : '' }, `Mode 1 全自然冷卻 (DB ≤ ${fullThresh}°C)${h_free ? ` — 全年 ${h_free}` : ''}`),
                        sub: t('topo.rdhxM1Sub', { thresh: fullThresh, hours: h_free || '0 h' }, `DB ≤ ${fullThresh}°C ｜ 全年 ${h_free || '0 h'} ｜ 氣冷 FC 盤管自然供冷`),
                        detail: t('topo.rdhxM1Sub', { thresh: fullThresh, hours: h_free || '0 h' }, `DB ≤ ${fullThresh}°C ｜ 全年 ${h_free || '0 h'} ｜ 氣冷 FC 盤管自然供冷`),
                        tone: 'emerald'
                    },
                    {
                        id: 'mode2',
                        title: t('topo.rdhxM2', null, 'Mode 2 部分預冷'),
                        label: t('topo.rdhxM2Label', { fullThresh, mechThresh, hours: h_partial ? ` — 全年 ${h_partial}` : '' }, `Mode 2 部分預冷 (${fullThresh} < DB < ${mechThresh}°C)${h_partial ? ` — 全年 ${h_partial}` : ''}`),
                        sub: t('topo.rdhxM2Sub', { fullThresh, mechThresh, hours: h_partial || '0 h' }, `${fullThresh} < DB < ${mechThresh}°C ｜ 全年 ${h_partial || '0 h'} ｜ FC 盤管預冷 + 氣冷冰機接力`),
                        detail: t('topo.rdhxM2Sub', { fullThresh, mechThresh, hours: h_partial || '0 h' }, `${fullThresh} < DB < ${mechThresh}°C ｜ 全年 ${h_partial || '0 h'} ｜ FC 盤管預冷 + 氣冷冰機接力`),
                        tone: 'amber'
                    },
                    {
                        id: 'mode3',
                        title: t('topo.rdhxM3', null, 'Mode 3 全機械製冷'),
                        label: t('topo.rdhxM3Label', { mechThresh, hours: h_mech ? ` — 全年 ${h_mech}` : '' }, `Mode 3 全機械製冷 (DB ≥ ${mechThresh}°C)${h_mech ? ` — 全年 ${h_mech}` : ''}`),
                        sub: t('topo.rdhxM3Sub', { thresh: mechThresh, hours: h_mech || '0 h' }, `DB ≥ ${mechThresh}°C ｜ 全年 ${h_mech || '0 h'} ｜ 氣冷冰水主機供冷`),
                        detail: t('topo.rdhxM3Sub', { thresh: mechThresh, hours: h_mech || '0 h' }, `DB ≥ ${mechThresh}°C ｜ 全年 ${h_mech || '0 h'} ｜ 氣冷冰水主機供冷`),
                        tone: 'indigo'
                    }
                ],
                nodes: [
                    {
                        id: 'rdhx',
                        kind: 'rdhx',
                        title: 'Compute Data Hall (RDHX)',
                        lines: [
                            t('topo.rdhxRearDoor', null, 'RDHX 伺服器水冷背板'),
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
                        title: t('topo.airChillerEvapTitle', null, '氣冷冰水主機 (Air-Cooled Chiller)'),
                        lines: [
                            t('topo.airChillerFcIntegrate', null, '氣冷壓縮製冷 + FC 盤管整合'),
                            t('topo.evapSupplyReturn', { sup: chwSup, ret: chwRet }, `供水 ${chwSup}°C ⇄ 回水 ${chwRet}°C`),
                            t('topo.airChillerTrimHigh', null, '高溫時接力修整至目標供水溫'),
                            t('topo.sealedRefrigZeroWater2', null, '全封閉冷媒迴路・零水耗 (WUE = 0)')
                        ]
                    },
                    {
                        id: 'heat_rejection',
                        kind: 'chiller',
                        title: t('topo.airCooledPlantTitle', null, '室外氣冷排熱機組 (Air-Cooled Plant)'),
                        lines: [
                            t('topo.vbankCondenserCoilFan', null, 'V-Bank 氣冷冷凝盤管 + 變頻風扇'),
                            t('topo.dbAirRejection', null, '以室外乾球溫度 (DB) 直接風冷散熱'),
                            t('topo.sealedRefrigZeroWater', null, '全封閉冷媒迴路 ｜ 零水耗 (WUE = 0)'),
                            (chwSup < minChws ? t('topo.warnRdhxCondensation', { limit: minChws.toFixed(1) }, `⚠ 供水低於結露保護溫度 ${minChws.toFixed(1)}°C，有結露風險`) : t('topo.rdhxCondSafe', null, '無結露風險 (高於結露保護溫度)'))
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
                chillerEnvelopeExceeded: chRes?.exceedsEnvelope || false,
                op,
                diag: { eco: op, Q_fc, Q_mech, chRes }
            };
        }
    });
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
