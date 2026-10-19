'use strict';
/**
 * air_water_cooled_chiller.js - Water-Cooled Chiller + Cooling Tower + WSE Plate Heat Exchanger
 */
(function (root) {
    const CoolingArchRegistry = root.CoolingArchRegistry;
    const CoolingStages = root.CoolingStages;
    if (!CoolingArchRegistry || !CoolingStages) {
        throw new Error('CoolingArchRegistry and CoolingStages must be loaded before air_water_cooled_chiller.js');
    }
    const t = (k, p, fb) => (root.I18N ? root.I18N.t(k, p) : (fb || k));

    CoolingArchRegistry.register({
        id: 'water_cooled_chiller',
        aliases: ['water_cooled_chiller_tower'],
        loop: 'air',
        get optionLabel() { return t('arch.water_cooled_chiller.option', null, '水冷式冰水主機 + 濕式冷卻塔 (Water-Cooled Chiller)'); },
        get cardLabel() { return t('arch.water_cooled_chiller.card', null, '水冷式冰機'); },
        get pillLabel() { return t('arch.water_cooled_chiller.pill', null, '水冷冰機'); },
        get dashboardLabel() { return t('arch.water_cooled_chiller.dashboard', null, '水冷式冰水主機 (Water-Cooled Chiller)'); },
        flags: { hasMechanical: true, consumesWater: true, needsCwPump: true },
        terminal: 'crah',
        schematic: 'air_plant',
        params: [
            root.CoolingArchHelpers.chwPumpingParam('fwChwPsIn_'),
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
                key: 'water_cooled_chiller',
                get label() { return t('equip.water_cooled_chiller', null, 'Water-Cooled Chiller 水冷式冰水主機'); },
                category: 'Chiller',
                catalog: 'chiller_water',
                role: 'chiller',
                chillerType: 'water_cooled',
                defaultModel: 'Trane RTHD Water-Cooled Screw 500kW (標準)',
                defaultUnitCapKw: 500,
                requiredKw: (ctx) => ctx.reqKw,
                calcQty: (reqKw, cap) => {
                    const minUnits = Math.max(1, Math.ceil(reqKw / 400));
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
                        cop_curve: curItem.cop_curve || { type: 'fixed' },
                        t_chws_design: curItem.t_chws_c,
                        category: curItem.category
                    };
                    return root.ChillerEngine.deratedCapacityKW(spec, ctx.sys?.chwSupplyC || 12.0, T_cewt, ctx.designCond.designDb)?.derate_factor ?? 1.0;
                }
            },
            {
                key: 'cooling_tower',
                get label() { return t('equip.cooling_tower', null, 'Cooling Tower 冰機散熱冷卻水塔'); },
                category: 'CoolingTower',
                catalog: 'cooling_tower',
                role: 'heat_rejection',
                resolver: 'tower',
                defaultModel: 'BAC Series 3000 600kW',
                defaultUnitCapKw: 600,
                requiredKw: (ctx) => ctx.reqKw * (ctx.getTowerRejectionFactor ? ctx.getTowerRejectionFactor() : 1.2),
                calcQty: (reqKw, cap, ctx) => {
                    const towerFactor = ctx.getTowerRejectionFactor ? ctx.getTowerRejectionFactor() : 1.2;
                    const minCtUnits = Math.max(1, Math.ceil(ctx.reqKw * towerFactor / 600));
                    return { qty: minCtUnits + 1, n1: minCtUnits + 1 };
                },
                derate: (curItem, ctx) => {
                    if (typeof root.CoolingTowerEngine === 'undefined') return 1.0;
                    const spec = { heat_rejection_kw: curItem.capKw || curItem.heat_rejection_kw };
                    return root.CoolingTowerEngine.deratedCapacityKW(spec, ctx.designCond.designWb)?.derate_factor ?? 1.0;
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
            },
            {
                key: 'cw_pump',
                get label() { return t('equip.cw_pump', null, 'Condenser Water Pump 冷卻水循環泵'); },
                category: 'Pump',
                catalog: 'pump',
                role: 'pump',
                defaultModel: 'Grundfos TPE 5.5kW Inverter Pump (標準)',
                defaultUnitCapKw: 5.5,
                requiredKw: (ctx) => ctx.cwPumpKw || 5.5,
                selectModel: (cat, ctx) => {
                    const pumpKw = ctx.cwPumpKw || 5.5;
                    const model = pumpKw <= 3.5 ? 'Grundfos TPE 3.0kW Inverter Pump' : (pumpKw <= 6.0 ? 'Grundfos TPE 5.5kW Inverter Pump (標準)' : 'Armstrong Design Envelope 11.0kW');
                    const capKw = pumpKw <= 3.5 ? 3.0 : (pumpKw <= 6.0 ? 5.5 : 11.0);
                    return { model, capKw };
                },
                calcQty: () => ({ qty: 2, n1: 2 })
            },
            root.CoolingArchHelpers.pumpEquipment('chw_primary_pump', 'Primary CHW Pump 一次冰水泵（冰機定流量）', (sys) => root.CoolingArchHelpers.usesPrimarySecondary(sys))
        ],

        stages: [
            { type: 'evap_tower', role: 'economizer', hasPhe: true, equipKey: 'cooling_tower' },
            { type: 'chiller', role: 'mechanical', chillerType: 'water_cooled', condenserSink: 'evap_tower', equipKey: 'water_cooled_chiller' }
        ],

        operatingPoint(sys, w, equip, opts) {
            const wb_c = (typeof w === 'number') ? w : (w?.wb ?? 20.0);
            const db_c = (typeof w === 'object' && w?.db !== undefined) ? w.db : 35.0;
            const chwSupplyC = sys?.chwSupplyC ?? 12.0;
            const chwReturnC = sys?.chwReturnC ?? 18.0;
            const hxApproach = (typeof root.A === 'function') ? root.A('hx_approach_c') : 1.5;
            const towerApproach = (typeof root.A === 'function') ? root.A('tower_approach_c') : 4.0;
            const minCewt = (typeof root.A === 'function') ? root.A('min_cewt_c') : 16.0;
            const tAvail = Number((wb_c + towerApproach + hxApproach).toFixed(1));
            const tCewt = Number(Math.max(minCewt, wb_c + towerApproach).toFixed(1));
            const eco = (typeof root.FreeCoolingEngine?.calcSeriesEconomizer === 'function')
                ? root.FreeCoolingEngine.calcSeriesEconomizer(tAvail, chwSupplyC, chwReturnC)
                : { fc_fraction: (tAvail <= chwSupplyC ? 1.0 : 0.0), chiller_fraction: (tAvail <= chwSupplyC ? 0.0 : 1.0), mode: (tAvail <= chwSupplyC ? 'FULL_FC' : 'MECH'), t_precooled_c: Math.min(chwReturnC, Math.max(chwSupplyC, tAvail)) };
            const chwPre = Number((eco.t_precooled_c ?? Math.min(chwReturnC, Math.max(chwSupplyC, tAvail))).toFixed(1));
            const mode = (typeof root.CoolingArchHelpers !== 'undefined')
                ? root.CoolingArchHelpers.modeFromEco(eco)
                : ((eco.mode === (root.FreeCoolingEngine?.MODE?.FULL_FC || 'FULL_FC')) ? 'free' : ((eco.mode === (root.FreeCoolingEngine?.MODE?.PARTIAL_FC || 'PARTIAL_FC')) ? 'partial' : 'mechanical'));
            const fullThresh = Number((chwSupplyC - towerApproach - hxApproach).toFixed(1));
            const mechThresh = Number((chwReturnC - towerApproach - hxApproach).toFixed(1));

            const Q_air = sys?.designBasis?.air_load_kw || opts?.qKw || 200;
            const Q_mech = Q_air * (eco.chiller_fraction || 0);
            let pComp = 0;
            let chillerCop = 5.8;
            let isFallbackCop = true;

            const chillers = equip?.water_cooled_chiller || equip?.chillers || [];
            if (chillers.length > 0 && typeof root.ChillerEngine !== 'undefined') {
                const staging = root.ChillerEngine.calcLeadLagStaging(Math.max(1, Q_mech), chillers);
                const chRes = root.ChillerEngine.calcPower(Math.max(1, Q_mech), staging.staged, chwSupplyC, tCewt, db_c);
                pComp = Q_mech > 0 ? chRes.power_kw : 0;
                chillerCop = chRes.cop_actual || 5.8;
                isFallbackCop = false;
            } else {
                chillerCop = (typeof root.CoolingArchHelpers !== 'undefined') ? root.CoolingArchHelpers.chillerFallbackCop(chwSupplyC) : 5.8;
                pComp = Q_mech / chillerCop;
                isFallbackCop = true;
            }

            const cdwDt = (typeof root.A === 'function') ? root.A('cdw_dt_design_c') : 5.0;
            const m_cp_cw = (Math.max(1, Q_air) * (1 + 1 / chillerCop)) / cdwDt;
            const condOut = Number((Q_mech > 0 ? (tCewt + (Q_mech + pComp) / m_cp_cw) : tCewt).toFixed(1));

            return {
                ...eco,
                mode,
                tAvail,
                tCewt,
                chwSupplyC,
                chwReturnC,
                chwPre,
                chillerCop,
                pComp,
                isFallbackCop,
                temps: { chwSup: chwSupplyC, chwRet: chwReturnC, chwPre, condIn: tCewt, condOut, tAvail },
                thresholds: { basis: 'wb', full: fullThresh, mech: mechThresh }
            };
        },

        topology(sys, op, design, extra) {
            const equip = extra?.equip || design?.equip;
            if (!op) op = this.operatingPoint(sys, { db: design?.designDb ?? 35.0, wb: design?.designWb ?? 28.0 }, equip, { withChiller: true, design });
            const chwSup = op?.temps?.chwSup ?? sys?.chwSupplyC ?? 12.0;
            const chwRet = op?.temps?.chwRet ?? sys?.chwReturnC ?? 18.0;
            const chwPre = op?.temps?.chwPre ?? chwSup;
            const designWb = design?.designWb ?? 28.0;
            const towerApp = (typeof root.A === 'function') ? root.A('tower_approach_c') : 4.0;
            const hxApp = (typeof root.A === 'function') ? root.A('hx_approach_c') : 1.5;
            const minCewt = (typeof root.A === 'function') ? root.A('min_cewt_c') : 16.0;
            const tCw = op?.temps?.condIn ?? Number(Math.max(minCewt, designWb + towerApp).toFixed(1));
            const tCwOut = op?.temps?.condOut ?? Number((tCw + 5.0).toFixed(1));
            const fullThresh = op?.thresholds?.full ?? Number((chwSup - towerApp - hxApp).toFixed(1));
            const mechThresh = op?.thresholds?.mech ?? Number((chwRet - towerApp - hxApp).toFixed(1));
            const tAvail = op?.tAvail ?? (designWb + towerApp + hxApp);

            const copDesign = op?.chillerCop ?? 5.8;
            const copLabel = op?.isFallbackCop ? `${copDesign.toFixed(1)} ${t('topo.copFallback', null, '(後備值)')}` : `${copDesign.toFixed(2)} ${t('topo.copSimulated', null, '(設計工況模擬)')}`;

            const modeHours = design?.fwModeHours || op?.fwModeHours || extra?.fwModeHours;
            const h_free = modeHours?.free !== undefined ? `${modeHours.free} h` : '';
            const h_partial = modeHours?.partial !== undefined ? `${modeHours.partial} h` : '';
            const h_mech = modeHours?.mechanical !== undefined ? `${modeHours.mechanical} h` : '';

            const isBypass = (op?.fc_fraction === 0) || (tAvail >= chwRet);

            return {
                title: t('topo.waterCooledChillerTower', null, '水冷式冰水主機 + 濕式冷卻塔'),
                referenceLabel: null,
                banners: [
                    {
                        id: 'mode1',
                        title: t('topo.waterChillerM1', null, 'Mode 1 全板換自然冷卻'),
                        label: t('topo.waterChillerM1Label', { fullThresh, hours: h_free ? ` — 全年 ${h_free}` : '' }, `Mode 1 全板換自然冷卻 (WB ≤ ${fullThresh}°C)${h_free ? ` — 全年 ${h_free}` : ''}`),
                        sub: t('topo.waterChillerM1Sub', { fullThresh, hours: h_free || '0 h' }, `WB ≤ ${fullThresh}°C ｜ 全年 ${h_free || '0 h'} ｜ 100% 水側省能器 (WSE)`),
                        detail: t('topo.waterChillerM1Sub', { fullThresh, hours: h_free || '0 h' }, `WB ≤ ${fullThresh}°C ｜ 全年 ${h_free || '0 h'} ｜ 100% 水側省能器 (WSE)`),
                        tone: 'emerald'
                    },
                    {
                        id: 'mode2',
                        title: t('topo.waterChillerM2', null, 'Mode 2 部分板換預冷'),
                        label: t('topo.waterChillerM2Label', { fullThresh, mechThresh, hours: h_partial ? ` — 全年 ${h_partial}` : '' }, `Mode 2 部分板換預冷 (${fullThresh} < WB < ${mechThresh}°C)${h_partial ? ` — 全年 ${h_partial}` : ''}`),
                        sub: t('topo.waterChillerM2Sub', { fullThresh, mechThresh, hours: h_partial || '0 h' }, `${fullThresh} < WB < ${mechThresh}°C ｜ 全年 ${h_partial || '0 h'} ｜ WSE 預冷 + 冰機修整`),
                        detail: t('topo.waterChillerM2Sub', { fullThresh, mechThresh, hours: h_partial || '0 h' }, `${fullThresh} < WB < ${mechThresh}°C ｜ 全年 ${h_partial || '0 h'} ｜ WSE 預冷 + 冰機修整`),
                        tone: 'amber'
                    },
                    {
                        id: 'mode3',
                        title: t('topo.waterChillerM3', null, 'Mode 3 全機械製冷'),
                        label: t('topo.waterChillerM3Label', { mechThresh, hours: h_mech ? ` — 全年 ${h_mech}` : '' }, `Mode 3 全機械製冷 (WB ≥ ${mechThresh}°C)${h_mech ? ` — 全年 ${h_mech}` : ''}`),
                        sub: t('topo.waterChillerM3Sub', { mechThresh, hours: h_mech || '0 h' }, `WB ≥ ${mechThresh}°C ｜ 全年 ${h_mech || '0 h'} ｜ 全額冰機壓縮製冷`),
                        detail: t('topo.waterChillerM3Sub', { mechThresh, hours: h_mech || '0 h' }, `WB ≥ ${mechThresh}°C ｜ 全年 ${h_mech || '0 h'} ｜ 全額冰機壓縮製冷`),
                        tone: 'blue'
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
                        id: 'wse',
                        kind: 'hx',
                        title: t('topo.wsePheTitle', null, '水側經濟器 (WSE 板式熱交換器)'),
                        lines: [
                            t('topo.wsePrecool', null, '板式熱交換器自然預冷'),
                            t('topo.wseThresh', { thresh: fullThresh }, `門檻: WB ≤ ${fullThresh}°C 滿載自冷`),
                            t('topo.wsePrecoolReturn', { cw: tCw }, `冷卻水供水 ${tCw}°C 預冷冰水回水`),
                            t('topo.wseTowerDirect', null, '冷卻塔出水直接供冷')
                        ]
                    },
                    {
                        id: 'evaporator',
                        kind: 'chiller',
                        title: t('topo.waterChillerCentScrew', null, '水冷式冰機 (Centrifugal/Screw)'),
                        lines: [
                            t('topo.effWaterChiller', null, '高效率水冷壓縮製冷'),
                            t('topo.evapSupplyReturn', { sup: chwSup, ret: chwRet }, `供水 ${chwSup}°C ⇄ 回水 ${chwRet}°C`),
                            t('topo.designCop', { cop: copDesign.toFixed(1) }, `設計 COP: ${copDesign.toFixed(1)} (設計工況)`),
                            t('topo.condenserRejToTower', null, '冷凝熱經冷卻水路排放至水塔')
                        ]
                    },
                    {
                        id: 'heat_rejection',
                        kind: 'tower',
                        title: t('topo.openTowerWetTitle', null, '濕式冷卻水塔 (Cooling Tower)'),
                        lines: [
                            t('topo.openTowerWetLine1', null, '高效開放式冷卻水塔'),
                            t('topo.openTowerWetLine2', { cwIn: tCw, wb: Number(designWb).toFixed(1), app: towerApp, cwOut: tCwOut }, `出水 ${tCw}°C (設計 WB ${Number(designWb).toFixed(1)}°C + ${towerApp}°C) ⇄ 進水 ${tCwOut}°C`),
                            t('topo.openTowerWetLine3', null, '冷卻塔出水同時供給 WSE 板換與冰機冷凝器'),
                            t('topo.openTowerWetLine4', null, '連續排污與自動補水控制')
                        ]
                    },
                    {
                        id: 'pump',
                        kind: 'pump',
                        title: 'Secondary CHW Pump',
                        lines: [t('topo.secChwPump', null, '二次側冰水循環泵')]
                    },
                    {
                        id: 'pump_cw',
                        kind: 'pump',
                        title: 'CW Pump',
                        lines: [t('topo.cwPump', null, '冷卻水循環泵')]
                    }
                ],
                pipes: [
                    { from: 'crah', to: 'wse', label: `${chwRet}°C`, tone: 'hot' },
                    { from: 'wse', to: 'evaporator', label: `${chwPre}°C`, tone: 'warm' },
                    { from: 'evaporator', to: 'crah', label: `${chwSup}°C`, tone: 'cold' },
                    { from: 'heat_rejection', to: 'wse', label: `${tCw}°C`, tone: 'cold' },
                    { from: 'heat_rejection', to: 'evaporator', label: `${tCw}°C`, tone: 'cold' },
                    { from: 'evaporator', to: 'heat_rejection', label: `${tCwOut}°C`, tone: 'hot' }
                ],
                footer: [],
                warnings: [],
                op
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
            const chwSupplyC = op.temps.chwSup;
            const fwBaseCop = (typeof root.CoolingArchHelpers !== 'undefined')
                ? root.CoolingArchHelpers.chillerFallbackCop(chwSupplyC)
                : (chwSupplyC >= 20 ? 5.8 : (chwSupplyC >= 12 ? 4.2 : 3.0));

            const fwIsFullFc = (op.mode === 'free');
            const fwChillerFraction = op.chiller_fraction;
            const fwChillerLoadKw = fwIsFullFc ? 0 : (Q_kw * fwChillerFraction);

            const fwTowerDevices = ctx.equip?.cooling_tower || [];
            const loadRatio = ctx.loadRatio ?? 1.0;
            const fanMinSpeed = ctx.fanMinSpeed ?? 0.20;

            const fwTowerFanKw = (fwTowerDevices.length > 0 && typeof root.CoolingTowerEngine !== 'undefined')
                ? root.CoolingTowerEngine.calcFanPower(fwTowerDevices, loadRatio, fwIsFullFc, fanMinSpeed)
                : null;

            let fanKw = 0;
            let compressorKw = 0;
            let deficitKw = 0;
            let chRes = null;

            if (fwIsFullFc) {
                fanKw = fwTowerFanKw ?? (Q_kw * 0.04);
            } else {
                if (fwChillerLoadKw > 0) {
                    const chStage = CoolingStages.get('chiller');
                    const T_cewt = Math.max(minCewt, w.wb + towerApproach);
                    chRes = chStage.simulate({
                        ...ctx,
                        Q_kw: fwChillerLoadKw,
                        chillerType: 'water_cooled',
                        t_chws_c: chwSupplyC,
                        t_cewt_c: T_cewt,
                        fallbackCop: fwBaseCop,
                        devices: ctx.equip?.water_cooled_chiller
                    });
                    compressorKw = chRes.compressorKw;
                    deficitKw = chRes.deficitKw || 0;
                }
                fanKw = fwTowerFanKw ?? ((Q_kw / 500) * 14.0);
            }

            // P1-3: Evaporative water consumption includes both building load and compressor power
            const evapFactor = ctx.evapFactor ?? ((typeof root.A === 'function') ? root.A('ct_evap_m3h_per_kw') : 0.00124);
            const cycles = ctx.cycles ?? (sys.cyclesOfConcentration || 5);
            const fwHeatRejKw = Q_kw + compressorKw;
            const evap = fwHeatRejKw * evapFactor;
            const bd = evap / Math.max(1, cycles - 1);
            const waterM3 = evap + bd;

            return {
                terminalKw: ctx.terminalKw || 0,
                pumpKw: ctx.pumpKw || 0,
                fanKw,
                compressorKw,
                waterM3,
                mode,
                deficitKw,
                heatRemovedKw: Math.max(0, Q_kw - deficitKw),
                mechLoadKw: fwChillerLoadKw,
                chillerEnvelopeExceeded: chRes?.exceedsEnvelope || false,
                diag: { eco, fwChillerLoadKw, chRes, evap, bd }
            };
        }
    });
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
