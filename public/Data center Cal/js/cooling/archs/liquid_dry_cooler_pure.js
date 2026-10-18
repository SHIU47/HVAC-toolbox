'use strict';
/**
 * liquid_dry_cooler_pure.js - Standalone Pure Dry Cooler (100% Free Cooling / Zero Chiller)
 */
(function (root) {
    const CoolingArchRegistry = root.CoolingArchRegistry;
    const CoolingStages = root.CoolingStages;
    if (!CoolingArchRegistry || !CoolingStages) {
        throw new Error('CoolingArchRegistry and CoolingStages must be loaded before liquid_dry_cooler_pure.js');
    }
    const t = (k, p, fb) => (root.I18N ? root.I18N.t(k, p) : (fb || k));

    CoolingArchRegistry.register({
        id: 'dry_cooler_pure',
        aliases: [],
        loop: 'liquid',
        get optionLabel() { return t('arch.dry_cooler_pure.option', null, '🟢 純乾冷器節能直冷 (Dry Cooler Pure FC / 100% 自然風冷・零冰機・零耗水)'); },
        get cardLabel() { return t('arch.dry_cooler_pure.card', null, '純乾冷器 (零冰機)'); },
        get pillLabel() { return t('arch.dry_cooler_pure.pill', null, '純乾冷器'); },
        get dashboardLabel() { return t('arch.dry_cooler_pure.dashboard', null, '純乾冷器自然排熱 (Dry Cooler)'); },
        flags: { hasMechanical: false, consumesWater: false },
        terminal: 'cdu',
        schematic: 'single_loop',
        params: [
            { key: 'dryCoolerApproachC', default: 5.0, min: 0, max: 15, step: 0.5, unit: '°C' },
            {
                key: 'hasPhe',
                panel: 'custom',
                type: 'boolean',
                get label() { return t('arch.param.pheConfig', null, '配置板式熱交換器 (PHE)'); },
                idPrefix: 'cduHasPheIn_',
                default: true
            },
            { key: 'pheApproachC', default: 2.0, min: 0, max: 10, step: 0.5, unit: '°C' }
        ],
        get paramPanelTitle() { return t('arch.param.dryCoolerPureTitle', null, '純乾冷器 (Dry Cooler Pure) 專屬參數:'); },
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
                key: 'dry_cooler',
                get label() { return t('equip.dry_cooler_pure', null, 'Dry Cooler 乾式冷卻器 (純直冷・零冰機)'); },
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
                get label() { return t('equip.cdu_pump', null, 'CDU Primary Pump 一次側設施循環水泵'); },
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
            { type: 'dry_cooler', role: 'economizer', equipKey: 'dry_cooler', hasPhe: true }
        ],

        operatingPoint(sys, w, equip) {
            const db_c = (typeof w === 'number') ? w : (w?.db ?? 25.0);
            const dcApp = sys?.dryCoolerApproachC ?? 5.0;
            const hasPhe = (sys?.hasPhe !== undefined && sys?.hasPhe !== null) ? !!sys.hasPhe : true;
            const pheApp = hasPhe ? (sys?.pheApproachC ?? 2.0) : 0.0;
            const tSup = sys?.fwsSupplyC ?? 40.0;
            const tRet = sys?.fwsReturnC ?? 55.0;
            const tDc = db_c + dcApp;
            const T_avail = tDc + pheApp;
            const isFc = T_avail <= tSup;
            const mode = isFc ? 'free' : 'mechanical';
            const unservedRatio = isFc ? 0.0 : Math.min(1.0, (T_avail - tSup) / Math.max(1.0, tRet - tSup));
            const fullThresh = Number((tSup - dcApp - pheApp).toFixed(1));
            return {
                mode,
                fc_fraction: isFc ? 1.0 : (1.0 - unservedRatio),
                chiller_fraction: isFc ? 0.0 : unservedRatio,
                unservedRatio,
                hasPhe,
                pheApp,
                tDc,
                T_avail,
                tSup,
                tRet,
                temps: { fwsRet: tRet, fwsSup: tSup, dcOut: tDc, dcIn: tRet },
                thresholds: { basis: 'db', full: fullThresh, mech: null }
            };
        },

        topology(sys, op, design, extra) {
            const equip = extra?.equip || design?.equip;
            if (!op) op = this.operatingPoint(sys, { db: design?.designDb ?? 35.0, wb: design?.designWb ?? 28.0 }, equip, { design });
            const dcApp = sys?.dryCoolerApproachC ?? 5.0;
            const hasPhe = op?.hasPhe !== undefined ? op.hasPhe : ((sys?.hasPhe !== undefined && sys?.hasPhe !== null) ? !!sys.hasPhe : true);
            const fullThresh = op?.thresholds?.full ?? ((op?.temps?.fwsSup ?? 40.0) - dcApp - (hasPhe ? (sys?.pheApproachC ?? 2.0) : 0.0));

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
                    title: t('topo.dcPheTitle', null, 'PHE-1 乾冷器板換 (Dry Cooler PHE)'),
                    lines: [
                        t('topo.pheDcCore', null, '自然風冷換熱核心 (PHE)'),
                        t('topo.pheCoolToSup', { tSup: op?.temps?.fwsSup ?? 40 }, `冷卻至設計供水 ${op?.temps?.fwsSup ?? 40}°C`),
                        t('topo.pheZeroWaterAllYear', null, '零耗水全時自然散熱'),
                        t('topo.pheProtectCdu', null, '水質完全隔離保護 CDU')
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
                    title: 'Glycol Pump',
                    lines: [t('topo.glycolPump', null, '乙二醇循環泵')]
                });
                nodes.push({
                    id: 'heat_rejection',
                    kind: 'dry_cooler',
                    title: t('topo.dryCoolerTitle', null, '乾冷器 (Dry Cooler)'),
                    lines: [
                        t('topo.dcZeroWater', null, '零耗水自然風冷'),
                        t('topo.dcApproachThresh', { app: dcApp, thresh: fullThresh }, `Approach: ${dcApp}°C ｜ 門檻: ≤${fullThresh}°C DB`),
                        t('topo.pureDcZeroChiller', null, '自然風冷，全年零冰機'),
                        t('topo.pureDcNoBackup', { app: dcApp }, `Approach: ${dcApp}°C ｜ 無機械備援 (需高於門檻時降載)`)
                    ]
                });

                pipes.push(
                    { from: 'cdu', to: 'hx', label: `${op?.temps?.fwsRet ?? 55}°C`, tone: 'hot' },
                    { from: 'hx', to: 'cdu', label: `${op?.temps?.fwsSup ?? 40}°C`, tone: 'cold' },
                    { from: 'hx', to: 'heat_rejection', label: `${op?.temps?.fwsRet ?? 55}°C`, tone: 'hot' },
                    { from: 'heat_rejection', to: 'hx', label: `${op?.temps?.dcOut ?? 35}°C`, tone: 'cold' }
                );
            } else {
                nodes.push({
                    id: 'pump_sec',
                    kind: 'pump',
                    title: 'Dry Cooler Pump',
                    lines: [t('topo.cduFacilityPump', null, 'CDU 設施循環泵')]
                });
                nodes.push({
                    id: 'heat_rejection',
                    kind: 'dry_cooler',
                    title: t('topo.dryCoolerDirectTitle', null, '乾冷器 (Dry Cooler - 直冷式)'),
                    lines: [
                        t('topo.pureDcDirect', null, '零耗水自然風冷 (無板換直冷)'),
                        t('topo.dcApproachThresh', { app: dcApp, thresh: fullThresh }, `Approach: ${dcApp}°C ｜ 門檻: ≤${fullThresh}°C DB`),
                        t('topo.pureDcPriConnect', null, '一次側直接連接乾冷器'),
                        t('topo.pureDcZeroChiller', null, '自然風冷，全年零冰機')
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
                        label: t('topo.pureDcThresh', { fullThresh }, `自然冷卻門檻 DB ≤ ${fullThresh}°C`),
                        detail: deficitHours > 0
                            ? t('topo.pureDcDetailDeficit', { hours: deficitHours }, `全年 ${deficitHours} h 超出冷卻能力（供水溫上升）`)
                            : t('topo.pureDcDetailOk', null, '乾式自然風冷・全年零冰機・零水耗'),
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
            const dcStage = CoolingStages.get('dry_cooler');
            const dcRes = dcStage.simulate({
                ...ctx,
                isTrimMode: false,
                approach_c: sys.dryCoolerApproachC || 5.0,
                hx_approach_c: op.pheApp,
                devices: ctx.equip?.dry_cooler
            });

            return {
                terminalKw: ctx.terminalKw || 0,
                pumpKw: ctx.pumpKw || 0,
                fanKw: dcRes.fanKw,
                compressorKw: 0,
                waterM3: 0,
                mode: op.mode,
                deficitKw: dcRes.deficitKw,
                heatRemovedKw: dcRes.Q_removed_kw,
                mechLoadKw: 0,
                op,
                diag: { dcRes }
            };
        }
    });
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
