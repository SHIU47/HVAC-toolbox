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

    CoolingArchRegistry.register({
        id: 'water_cooled_chiller',
        aliases: ['water_cooled_chiller_tower'],
        loop: 'air',
        optionLabel: '💧 水冷式冰水主機 + 濕式冷卻塔 (Water-Cooled Chiller)',
        cardLabel: '水冷式冰機',
        pillLabel: '水冷冰機',
        dashboardLabel: '水冷式冰水主機 (Water-Cooled Chiller)',
        flags: { hasMechanical: true, consumesWater: true },
        terminal: 'crah',
        schematic: 'air_plant',
        params: [
            { key: 'chwSupplyC', default: 12.0, min: 7, max: 25, step: 0.5, unit: '°C' },
            { key: 'chwReturnC', default: 18.0, min: 12, max: 35, step: 0.5, unit: '°C' }
        ],
        equipment: [
            {
                key: 'crah_unit',
                label: 'CRAH / Fanwall 機房空調',
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
                label: 'Water-Cooled Chiller 水冷式冰水主機',
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
                        cop_curve: curItem.cop_curve || { type: 'fixed' }
                    };
                    return root.ChillerEngine.deratedCapacityKW(spec, ctx.sys?.chwSupplyC || 12.0, T_cewt, ctx.designCond.designDb)?.derate_factor ?? 1.0;
                }
            },
            {
                key: 'cooling_tower',
                label: 'Cooling Tower 冰機散熱冷卻水塔',
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

        stages: [
            { type: 'evap_tower', role: 'economizer', hasPhe: true, equipKey: 'cooling_tower' },
            { type: 'chiller', role: 'mechanical', chillerType: 'water_cooled', condenserSink: 'evap_tower', equipKey: 'water_cooled_chiller' }
        ],

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
            const chwSupplyC = ctx.t_supply_c ?? sys.chwSupplyC ?? 12.0;
            const chwReturnC = ctx.t_return_c ?? sys.chwReturnC ?? 18.0;
            const fwBaseCop = (typeof root.CoolingArchHelpers !== 'undefined')
                ? root.CoolingArchHelpers.chillerFallbackCop(chwSupplyC)
                : (chwSupplyC >= 20 ? 5.8 : (chwSupplyC >= 12 ? 4.2 : 3.0));

            const hxApproach = (typeof root.A === 'function') ? root.A('hx_approach_c') : 1.5;
            const towerApproach = (typeof root.A === 'function') ? root.A('tower_approach_c') : 4.0;
            const minCewt = (typeof root.A === 'function') ? root.A('min_cewt_c') : 16.0;
            const tAvail = w.wb + towerApproach + hxApproach;

            const eco = (typeof root.FreeCoolingEngine?.calcSeriesEconomizer === 'function')
                ? root.FreeCoolingEngine.calcSeriesEconomizer(tAvail, chwSupplyC, chwReturnC)
                : { fc_fraction: (tAvail <= chwSupplyC ? 1.0 : 0.0), chiller_fraction: (tAvail <= chwSupplyC ? 0.0 : 1.0), mode: (tAvail <= chwSupplyC ? 'FULL_FC' : 'MECH') };

            const mode = (typeof root.CoolingArchHelpers !== 'undefined')
                ? root.CoolingArchHelpers.modeFromEco(eco)
                : ((eco.mode === (root.FreeCoolingEngine?.MODE?.FULL_FC || 'FULL_FC')) ? 'free' : ((eco.mode === (root.FreeCoolingEngine?.MODE?.PARTIAL_FC || 'PARTIAL_FC')) ? 'partial' : 'mechanical'));
            const fwIsFullFc = (mode === 'free');
            const fwChillerFraction = eco.chiller_fraction;
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
                diag: { eco, fwChillerLoadKw, chRes, evap, bd }
            };
        }
    });
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
