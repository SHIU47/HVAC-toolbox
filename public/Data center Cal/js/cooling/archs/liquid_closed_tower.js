'use strict';
/**
 * liquid_closed_tower.js - Closed-Circuit Cooling Tower (Direct Wet-Bulb Free Cooling / Zero Chiller)
 */
(function (root) {
    const CoolingArchRegistry = root.CoolingArchRegistry;
    const CoolingStages = root.CoolingStages;
    if (!CoolingArchRegistry || !CoolingStages) {
        throw new Error('CoolingArchRegistry and CoolingStages must be loaded before liquid_closed_tower.js');
    }
    const t = (k, p, fb) => (root.I18N ? root.I18N.t(k, p) : (fb || k));

    CoolingArchRegistry.register({
        id: 'cooling_tower_hx',
        aliases: [],
        loop: 'liquid',
        get optionLabel() { return t('arch.cooling_tower_hx.option', null, '密閉式冷卻水塔 (Closed-Circuit Cooling Tower / 100% 蒸發自然冷卻・零冰機)'); },
        get cardLabel() { return t('arch.cooling_tower_hx.card', null, '密閉式冷卻水塔 (零冰機)'); },
        get pillLabel() { return t('arch.cooling_tower_hx.pill', null, '閉式塔'); },
        get dashboardLabel() { return t('arch.cooling_tower_hx.dashboard', null, '密閉式冷卻水塔 (Closed-Circuit Cooling Tower)'); },
        flags: { hasMechanical: false, consumesWater: true, isClosedTower: true },
        terminal: 'cdu',
        schematic: 'single_loop',
        params: [
            { key: 'ctApproachC', default: 6.0, min: 2, max: 12, step: 0.5, unit: '°C' },
            {
                key: 'hasPhe',
                panel: 'custom',
                type: 'boolean',
                get label() { return t('arch.param.pheConfig', null, '配置板式熱交換器 (PHE)'); },
                idPrefix: 'cduHasPheIn_',
                default: false
            },
            { key: 'pheApproachC', default: 2.0, min: 0, max: 10, step: 0.5, unit: '°C' }
        ],
        get paramPanelTitle() { return t('arch.param.closedTowerTitle', null, '密閉式冷卻水塔 (Closed Tower) 專屬參數:'); },
        equipment: [
            {
                key: 'cdu_unit',
                get label() { return t('equip.cdu_unit', null, 'CDU 液冷分配主機 (Cooling Distribution Unit)'); },
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
                key: 'cooling_tower',
                get label() { return t('equip.closed_tower', null, 'Closed-Circuit Cooling Tower 密閉式冷卻水塔'); },
                category: 'CoolingTower',
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
                get label() { return t('equip.cdu_pump', null, 'CDU Primary Pump 一次側設施循環水泵'); },
                category: 'Pump',
                catalog: 'pump',
                role: 'pump',
                defaultModel: 'Grundfos TPE 5.5kW Inverter Pump (標準)',
                defaultUnitCapKw: 5.5,
                requiredKw: (ctx) => ctx.hydKw || 5.5,
                calcQty: () => ({ qty: 3, n1: 3 })
            },
            root.CoolingArchHelpers.pumpEquipment('rej_pump', 'Heat Rejection Loop Pump 排熱側循環泵', (sys) => root.CoolingArchHelpers.archHasPhe(root.CoolingArchRegistry.get('cooling_tower_hx'), sys))
        ],

        stages: [
            { type: 'closed_tower', role: 'economizer', equipKey: 'cooling_tower', hasPhe: false }
        ],

        operatingPoint(sys, w, equip) {
            const wb_c = (typeof w === 'number') ? w : (w?.wb ?? 20.0);
            const ctApp = sys?.ctApproachC ?? 6.0;
            const hasPhe = (sys?.hasPhe !== undefined && sys?.hasPhe !== null) ? !!sys.hasPhe : false;
            const pheApp = hasPhe ? (sys?.pheApproachC ?? 2.0) : 0.0;
            const tSup = sys?.fwsSupplyC ?? 40.0;
            const tRet = sys?.fwsReturnC ?? 55.0;
            const tAvail = wb_c + ctApp + pheApp;
            const isFc = tAvail <= tSup;
            const mode = isFc ? 'free' : 'mechanical';
            const unservedRatio = isFc ? 0.0 : Math.min(1.0, (tAvail - tSup) / Math.max(1.0, tRet - tSup));
            const fullThresh = Number((tSup - ctApp - pheApp).toFixed(1));
            return {
                mode,
                fc_fraction: isFc ? 1.0 : (1.0 - unservedRatio),
                chiller_fraction: isFc ? 0.0 : unservedRatio,
                unservedRatio,
                hasPhe,
                pheApp,
                tAvail,
                tSup,
                tRet,
                temps: { fwsRet: tRet, fwsSup: tSup, ctOut: (wb_c + ctApp) },
                thresholds: { basis: 'wb', full: fullThresh, mech: null }
            };
        },

        topology(sys, op, design, extra) {
            const equip = extra?.equip || design?.equip;
            if (!op) op = this.operatingPoint(sys, { db: design?.designDb ?? 35.0, wb: design?.designWb ?? 28.0 }, equip, { design });
            const ctApp = sys?.ctApproachC ?? 6.0;
            const hasPhe = op?.hasPhe !== undefined ? op.hasPhe : ((sys?.hasPhe !== undefined && sys?.hasPhe !== null) ? !!sys.hasPhe : false);
            const fullThresh = op?.thresholds?.full ?? ((op?.temps?.fwsSup ?? 40.0) - ctApp - (hasPhe ? (sys?.pheApproachC ?? 2.0) : 0.0));

            const nodes = [
                {
                    id: 'it',
                    kind: 'it',
                    title: 'Compute Data Hall',
                    lines: [
                        t('topo.coldPlateLiq', null, 'Cold Plate 晶片液冷'),
                        t('topo.chipWaterTemp', { sup: sys?.secSupplyC ?? 45, ret: sys?.secReturnC ?? 57 }, `晶片水溫: ${sys?.secSupplyC ?? 45} ⇄ ${sys?.secReturnC ?? 57}°C`)
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
                    title: t('topo.closedTowerPheTitle', null, 'PHE-1 閉式塔板換 (Closed Tower PHE)'),
                    lines: [
                        t('topo.closedTowerPheLine1', null, '密閉水側自然冷卻 (PHE 隔離)'),
                        t('topo.closedTowerPheLine2', { tSup: op?.temps?.fwsSup ?? 40 }, `濕球蒸發冷卻至 ${op?.temps?.fwsSup ?? 40}°C`),
                        t('topo.pheProtectCdu', null, '板換水質完全隔離保護 CDU'),
                        t('topo.closedTowerPheLine4', null, '全年濕球驅動零冰機排熱')
                    ]
                });
                nodes.push({
                    id: 'pump_sec',
                    kind: 'pump',
                    title: 'Secondary Pump',
                    lines: [t('topo.cduFacilityPump', null, 'CDU 設施循環泵')]
                });
                nodes.push({
                    id: 'pump_outdoor',
                    kind: 'pump',
                    title: 'Tower Pump',
                    lines: [t('topo.closedTowerPump', null, '閉式塔循環泵')]
                });
                nodes.push({
                    id: 'heat_rejection',
                    kind: 'tower',
                    title: t('topo.closedTowerTitle', null, '密閉式冷卻水塔 (Closed Cooling Tower)'),
                    lines: [
                        t('topo.closedTowerCoilEvap', null, '閉式盤管蒸發冷卻 (水質隔離・零冰機)'),
                        t('topo.closedTowerWbDriven', null, '以濕球溫度驅動全時自然冷卻，全年無需冰機'),
                        t('topo.dcApproachThresh', { app: ctApp, thresh: fullThresh }, `Approach: ${ctApp}°C ｜ 門檻: ≤${fullThresh}°C WB`),
                        t('topo.closedTowerCoilClean', null, '盤管內部乾淨迴路，噴淋蒸發散熱')
                    ]
                });

                pipes.push(
                    { from: 'cdu', to: 'hx', label: `${op?.temps?.fwsRet ?? 55}°C`, tone: 'hot' },
                    { from: 'hx', to: 'cdu', label: `${op?.temps?.fwsSup ?? 40}°C`, tone: 'cold' },
                    { from: 'hx', to: 'heat_rejection', label: `${op?.temps?.fwsRet ?? 55}°C`, tone: 'hot' },
                    { from: 'heat_rejection', to: 'hx', label: `${(op?.temps?.ctOut ?? 26).toFixed(1)}°C`, tone: 'cold' }
                );
            } else {
                nodes.push({
                    id: 'pump_sec',
                    kind: 'pump',
                    title: 'Closed Tower Pump',
                    lines: [t('topo.closedTowerPump', null, '閉式塔循環泵')]
                });
                nodes.push({
                    id: 'heat_rejection',
                    kind: 'tower',
                    title: t('topo.closedTowerTitle', null, '密閉式冷卻水塔 (Closed Cooling Tower)'),
                    lines: [
                        t('topo.closedTowerDirectCoil', null, '閉式盤管蒸發冷卻 (一次側直通盤管)'),
                        t('topo.closedTowerCduDirect', null, 'CDU 一次側水路直接循環密閉塔內部盤管'),
                        t('topo.dcApproachThresh', { app: ctApp, thresh: fullThresh }, `Approach: ${ctApp}°C ｜ 門檻: ≤${fullThresh}°C WB`),
                        t('topo.zeroPheLossMaxEff', null, '零中間板換損失，最高自然冷卻效率')
                    ]
                });

                pipes.push(
                    { from: 'cdu', to: 'heat_rejection', label: `${op?.temps?.fwsRet ?? 55}°C`, tone: 'hot' },
                    { from: 'heat_rejection', to: 'cdu', label: `${op?.temps?.fwsSup ?? 40}°C`, tone: 'cold' }
                );
            }

            const deficitHours = design?.deficitHours ?? extra?.deficitHours ?? 0;
            return {
                title: t('topo.facilityHeatRej', null, '設施排熱拓樸 (Facility Heat Rejection)'),
                referenceLabel: null,
                banners: [
                    {
                        id: 'mode1',
                        label: t('topo.closedTowerThresh', { fullThresh }, `全時蒸發自然冷卻 (WB ≤${fullThresh}°C)`),
                        detail: deficitHours > 0
                            ? t('topo.closedTowerDetailDeficit', { hours: deficitHours }, `全年 ${deficitHours} h 超出冷卻能力（供水溫上升）`)
                            : t('topo.closedTowerDetailOk', null, '水側直冷・全年零冰機'),
                        tone: deficitHours > 0 ? 'amber' : 'emerald'
                    }
                ],
                nodes,
                pipes,
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
            const ctStage = CoolingStages.get('closed_tower');
            const ctRes = ctStage.simulate({
                ...ctx,
                approach_c: sys.ctApproachC ?? 6.0,
                devices: ctx.equip?.cooling_tower
            });

            return {
                terminalKw: ctx.terminalKw || 0,
                pumpKw: ctx.pumpKw || 0,
                fanKw: ctRes.fanKw,
                compressorKw: 0,
                waterM3: ctRes.waterM3,
                mode: op.mode,
                deficitKw: ctRes.deficitKw,
                heatRemovedKw: ctRes.Q_removed_kw,
                mechLoadKw: 0,
                op,
                diag: { ctRes }
            };
        }
    });
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
