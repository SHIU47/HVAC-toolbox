'use strict';
/**
 * stage_chain.js - Cooling Stage Chain Pipeline
 * Evaluates series cooling stage pipelines: economizers precool water from return to supply,
 * mechanical chillers trim remaining load, and condenser heat is rejected to specified heat sinks.
 */
(function (root) {
    const CoolingStages = root.CoolingStages;
    if (!CoolingStages) {
        throw new Error('CoolingStages must be loaded before stage_chain.js');
    }

    // Register built-in fc_coil stage (air-cooled chiller economizer coil)
    if (!CoolingStages.has('fc_coil')) {
        CoolingStages.register('fc_coil', {
            availableTemp(ctx) {
                const approach = ctx.approach_c ?? ctx.params?.approach_c ?? ((typeof root.A === 'function') ? root.A('air_chiller_fc_coil_approach_c') : 4.0);
                const w = ctx.w || { db: 25, wb: 20 };
                return w.db + approach;
            },
            rejectionCost(ctx, Q_reject_kw, isFullFc) {
                const kwPerKw = ctx.params?.kw_per_kw ?? ((typeof root.A === 'function') ? root.A('air_chiller_fc_fan_kw_per_kw') : 0.05);
                return { fanKw: Q_reject_kw * kwPerKw, waterM3: 0 };
            },
            simulate(ctx) {
                const Q_kw = ctx.Q_kw || 0;
                const T_avail = this.availableTemp(ctx);
                const t_supply_c = ctx.t_supply_c ?? 12.0;
                const isFc = T_avail <= t_supply_c;
                const cost = this.rejectionCost(ctx, Q_kw, isFc);
                return {
                    Q_removed_kw: Q_kw,
                    t_out_c: t_supply_c,
                    fanKw: cost.fanKw,
                    pumpKw: 0,
                    compressorKw: 0,
                    waterM3: 0,
                    rejectToSinkKw: 0,
                    mode: isFc ? 'free' : 'mechanical',
                    deficitKw: 0,
                    diag: { T_avail }
                };
            }
        });
    }

    /**
     * Executes a cooling stage chain.
     * @param {Array<Object>} stages Array of stage descriptors
     * @param {Object} ctx Simulation context { Q_kw, sys, w, t_supply_c, t_return_c, equip, loadRatio, fanMinSpeed, ... }
     * @param {Object} [arch] Parent architecture descriptor (optional)
     * @returns {Object} Simulation result conforming to simulateHour contract + op (OperatingPoint)
     */
    function runStageChain(stages, ctx, arch) {
        const Q_kw = ctx.Q_kw || 0;
        if (Q_kw <= 0) {
            const emptyRes = (typeof root.CoolingArchHelpers !== 'undefined')
                ? root.CoolingArchHelpers.emptyHourResult()
                : {
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
            emptyRes.terminalKw = ctx.terminalKw || 0;
            emptyRes.pumpKw = ctx.pumpKw || 0;
            emptyRes.op = null;
            return emptyRes;
        }

        const sys = ctx.sys || {};
        const w = ctx.w || { db: 25, wb: 20 };
        const t_supply_c = ctx.t_supply_c ?? sys.fwsSupplyC ?? sys.chwSupplyC ?? 42.0;
        const t_return_c = ctx.t_return_c ?? sys.fwsReturnC ?? sys.chwReturnC ?? 54.0;
        const loadRatio = ctx.loadRatio ?? 1.0;
        const fanMinSpeed = ctx.fanMinSpeed ?? 0.20;

        const stageList = stages || [];
        const economizer = stageList.find(s => s.role === 'economizer');
        const mechanical = stageList.find(s => s.role === 'mechanical');

        // Check if arch provides a custom operatingPoint method (e.g. liquid_dry_cooler_trim)
        let op = null;
        if (arch && typeof arch.operatingPoint === 'function') {
            op = arch.operatingPoint(sys, w, ctx.equip);
        }

        let fanKw = 0;
        let compressorKw = 0;
        let waterM3 = 0;
        let deficitKw = 0;
        let mechLoadKw = 0;
        let mode = 'free';
        let diag = {};

        if (economizer && mechanical) {
            // Combined Economizer + Mechanical Chiller (e.g. Dry Cooler + Trim, Air-Cooled Chiller + FC, WSE)
            const ecoStage = CoolingStages.get(economizer.type);
            const ecoParams = economizer.params || {};
            const approach = economizer.type === 'fc_coil'
                ? (ecoParams.approach_c ?? ((typeof root.A === 'function') ? root.A('air_chiller_fc_coil_approach_c') : 4.0))
                : (ecoParams.approach_c ?? (economizer.type === 'evap_tower' || economizer.type === 'closed_tower' ? (sys.ctApproachC ?? ((typeof root.A === 'function') ? root.A('tower_approach_c') : 4.0)) : (sys.dryCoolerApproachC || 5.0)));
            const pheApproach = economizer.hasPhe
                ? (ecoParams.hx_approach_c ?? sys.pheApproachC ?? ((typeof root.A === 'function') ? root.A('hx_approach_c') : 2.0))
                : 0.0;

            const stageCtx = {
                ...ctx,
                sys,
                w,
                t_supply_c,
                t_return_c,
                loadRatio,
                fanMinSpeed,
                approach_c: approach,
                hx_approach_c: pheApproach,
                params: ecoParams,
                devices: ctx.equip?.[economizer.equipKey || economizer.type]
            };

            let eco;
            let isFullFc;
            let chillerFraction;
            let T_avail;

            if (op) {
                eco = op;
                isFullFc = (op.mode === 'free' || op.mode === (root.FreeCoolingEngine?.MODE?.FULL_FC || 'FULL_FC'));
                chillerFraction = op.chiller_fraction ?? 0;
                T_avail = op.tDc ? (op.tDc + pheApproach) : (ecoStage.availableTemp(stageCtx) + pheApproach);
            } else {
                T_avail = ecoStage.availableTemp(stageCtx) + pheApproach;
                eco = (typeof root.FreeCoolingEngine?.calcSeriesEconomizer === 'function')
                    ? root.FreeCoolingEngine.calcSeriesEconomizer(T_avail, t_supply_c, t_return_c)
                    : {
                        fc_fraction: T_avail <= t_supply_c ? 1.0 : 0.0,
                        chiller_fraction: T_avail <= t_supply_c ? 0.0 : 1.0,
                        mode: T_avail <= t_supply_c ? 'FULL_FC' : 'MECH',
                        t_precooled_c: Math.min(t_return_c, Math.max(t_supply_c, T_avail))
                    };
                const mode = (typeof root.CoolingArchHelpers !== 'undefined')
                    ? root.CoolingArchHelpers.modeFromEco(eco)
                    : ((eco.mode === (root.FreeCoolingEngine?.MODE?.FULL_FC || 'FULL_FC')) ? 'free' : (eco.chiller_fraction >= 1.0 ? 'mechanical' : 'partial'));
                isFullFc = (mode === 'free');
                chillerFraction = isFullFc ? 0 : eco.chiller_fraction;
            }

            const Q_fc = isFullFc ? Q_kw : (Q_kw * (1.0 - chillerFraction));
            const Q_mech = isFullFc ? 0 : (Q_kw * chillerFraction);
            mechLoadKw = Q_mech;

            // Economizer fan and water consumption
            if (economizer.type === 'fc_coil') {
                const ecoCost = ecoStage.rejectionCost(stageCtx, Q_fc, isFullFc);
                fanKw = ecoCost.fanKw;
                waterM3 = ecoCost.waterM3 || 0;
            } else if (economizer.type === 'evap_tower' && mechanical.condenserSink === 'evap_tower') {
                // Cooling tower serves both WSE economizer and chiller condenser
                const fwTowerDevices = ctx.equip?.[economizer.equipKey] || ctx.equip?.cooling_tower || [];
                const fwTowerFanKw = (fwTowerDevices.length > 0 && typeof root.CoolingTowerEngine !== 'undefined')
                    ? root.CoolingTowerEngine.calcFanPower(fwTowerDevices, loadRatio, isFullFc, fanMinSpeed)
                    : null;

                if (isFullFc) {
                    fanKw = fwTowerFanKw ?? (Q_kw * 0.04);
                } else {
                    fanKw = fwTowerFanKw ?? ((Q_kw / 500) * 14.0);
                }
            } else {
                const ecoCost = ecoStage.rejectionCost(stageCtx, Q_kw, isFullFc);
                fanKw = ecoCost.fanKw;
                waterM3 = ecoCost.waterM3 || 0;
            }

            // Mechanical Chiller simulation
            let chRes = null;
            if (Q_mech > 0) {
                const mechStage = CoolingStages.get(mechanical.type);
                let t_chws_c;
                let t_cewt_c;
                let fallbackCop;

                const fwBaseCop = (typeof root.CoolingArchHelpers !== 'undefined')
                    ? root.CoolingArchHelpers.chillerFallbackCop(t_supply_c)
                    : (t_supply_c >= 20 ? 5.8 : (t_supply_c >= 12 ? 4.2 : 3.0));

                if (mechanical.chillerType === 'water_cooled') {
                    if (op) {
                        t_chws_c = op.tChws ?? Math.min(30, t_supply_c - 7);
                        t_cewt_c = op.tCewt ?? (w.db + 5.0);
                        fallbackCop = mechanical.fallbackCop ?? ctx.trimCop ?? ctx.fallbackCop ?? 6.2;
                    } else {
                        const towerApproach = (typeof root.A === 'function') ? root.A('tower_approach_c') : 4.0;
                        const minCewt = (typeof root.A === 'function') ? root.A('min_cewt_c') : 16.0;
                        t_chws_c = t_supply_c;
                        t_cewt_c = Math.max(minCewt, w.wb + towerApproach);
                        fallbackCop = mechanical.fallbackCop ?? (sys.chwSupplyC !== undefined ? fwBaseCop : 5.5);
                    }
                } else {
                    t_chws_c = t_supply_c;
                    fallbackCop = mechanical.fallbackCop ?? fwBaseCop;
                }

                chRes = mechStage.simulate({
                    ...ctx,
                    Q_kw: Q_mech,
                    chillerType: mechanical.chillerType,
                    t_chws_c,
                    t_cewt_c,
                    fallbackCop,
                    devices: ctx.equip?.[mechanical.equipKey] || ctx.equip?.chillers
                });

                compressorKw = chRes.compressorKw;
                if (chRes.deficitKw) deficitKw += chRes.deficitKw;
            }

            // Evaporative water consumption for water-cooled chiller systems
            if (economizer.type === 'evap_tower' && mechanical.condenserSink === 'evap_tower') {
                const evapFactor = ctx.evapFactor ?? ((typeof root.A === 'function') ? root.A('ct_evap_m3h_per_kw') : 0.00124);
                const cycles = ctx.cycles ?? (sys.cyclesOfConcentration || 5);
                const fwHeatRejKw = Q_kw + compressorKw;
                const evap = fwHeatRejKw * evapFactor;
                const bd = evap / Math.max(1, cycles - 1);
                waterM3 = evap + bd;
            }

            mode = isFullFc ? 'free' : ((eco.mode === (root.FreeCoolingEngine?.MODE?.PARTIAL_FC || 'PARTIAL_FC') || eco.mode === 'partial') ? 'partial' : 'mechanical');
            diag = { eco, chRes, op, T_avail, isFullFc };

        } else if (economizer) {
            // Pure Economizer (e.g. Pure Dry Cooler, Closed Cooling Tower, Adiabatic Tower)
            const ecoStage = CoolingStages.get(economizer.type);
            const ecoParams = economizer.params || {};
            const approach = ecoParams.approach_c ?? (economizer.type === 'closed_tower' || economizer.type === 'evap_tower' ? (sys.ctApproachC ?? 6.0) : (sys.dryCoolerApproachC || 5.0));
            const pheApproach = economizer.hasPhe ? (ecoParams.hx_approach_c ?? sys.pheApproachC ?? 0.0) : 0.0;

            const stageCtx = {
                ...ctx,
                sys,
                w,
                t_supply_c,
                t_return_c,
                loadRatio,
                fanMinSpeed,
                approach_c: approach,
                hx_approach_c: pheApproach,
                params: ecoParams,
                isPureEconomizer: true,
                devices: ctx.equip?.[economizer.equipKey || economizer.type]
            };

            const T_avail = ecoStage.availableTemp(stageCtx) + pheApproach;
            const isFc = T_avail <= t_supply_c;
            const cost = ecoStage.rejectionCost(stageCtx, Q_kw, isFc);
            fanKw = cost.fanKw;
            waterM3 = cost.waterM3 || 0;

            if (!isFc) {
                const tempOvershoot = T_avail - t_supply_c;
                const unservedRatio = Math.min(1.0, tempOvershoot / Math.max(1.0, t_return_c - t_supply_c));
                deficitKw = Math.round(Q_kw * unservedRatio);
            }

            mode = isFc ? 'free' : 'partial';
            diag = { T_avail, isFc, cost };

        } else if (mechanical) {
            // Mechanical only (e.g. Liquid Water Chiller, District CHW)
            const mechStage = CoolingStages.get(mechanical.type);
            const mechDevices = ctx.equip?.[mechanical.equipKey] || ctx.equip?.chillers || ctx.devices;
            const fallbackCop = mechanical.fallbackCop ?? 5.5;

            const chRes = mechStage.simulate({
                ...ctx,
                Q_kw,
                chillerType: mechanical.chillerType,
                t_chws_c: ctx.t_supply_c ?? sys.fwsSupplyC,
                fallbackCop,
                devices: mechDevices
            });

            compressorKw = chRes.compressorKw;
            deficitKw = chRes.deficitKw || 0;
            mechLoadKw = Q_kw;
            mode = 'mechanical';

            if (mechanical.condenserSink) {
                const sinkStage = CoolingStages.get(mechanical.condenserSink);
                const sinkCost = sinkStage.rejectionCost({
                    ...ctx,
                    heatLoadKw: Q_kw,
                    devices: ctx.equip?.[mechanical.sinkEquipKey || 'cooling_tower']
                }, chRes.rejectToSinkKw, false);
                fanKw = sinkCost.fanKw;
                waterM3 = sinkCost.waterM3 || 0;
            }

            diag = { chRes };
        }

        const heatRemovedKw = Math.max(0, Q_kw - deficitKw);

        return {
            terminalKw: ctx.terminalKw || 0,
            pumpKw: ctx.pumpKw || 0,
            fanKw,
            compressorKw,
            waterM3,
            mode,
            deficitKw,
            heatRemovedKw,
            mechLoadKw,
            op: op || {
                mode,
                fc_fraction: 1.0 - (mechLoadKw / Math.max(1, Q_kw)),
                chiller_fraction: mechLoadKw / Math.max(1, Q_kw),
                temps: {
                    fwsRet: t_return_c,
                    fwsPre: t_supply_c,
                    fwsSup: t_supply_c,
                    chwSup: t_supply_c,
                    chwRet: t_return_c
                }
            },
            diag
        };
    }

    root.runStageChain = runStageChain;
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
