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
        dashboardLabel: '水冷式冰水主機 (Water-Cooled Chiller)',
        flags: { hasMechanical: true, consumesWater: true },
        terminal: 'crah',
        schematic: 'air_plant',
        params: [
            { key: 'chwSupplyC', default: 12.0, min: 7, max: 25, step: 0.5, unit: '°C' },
            { key: 'chwReturnC', default: 18.0, min: 12, max: 35, step: 0.5, unit: '°C' }
        ],

        simulateHour(ctx) {
            const Q_kw = ctx.Q_kw || 0;
            if (Q_kw <= 0) {
                return {
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
            const fwBaseCop = chwSupplyC >= 20 ? 5.8 : (chwSupplyC >= 12 ? 4.2 : 3.0);

            const hxApproach = (typeof root.A === 'function') ? root.A('hx_approach_c') : 1.5;
            const towerApproach = (typeof root.A === 'function') ? root.A('tower_approach_c') : 4.0;
            const minCewt = (typeof root.A === 'function') ? root.A('min_cewt_c') : 16.0;
            const tAvail = w.wb + towerApproach + hxApproach;

            const eco = (typeof root.FreeCoolingEngine?.calcSeriesEconomizer === 'function')
                ? root.FreeCoolingEngine.calcSeriesEconomizer(tAvail, chwSupplyC, chwReturnC)
                : { fc_fraction: (tAvail <= chwSupplyC ? 1.0 : 0.0), chiller_fraction: (tAvail <= chwSupplyC ? 0.0 : 1.0), mode: (tAvail <= chwSupplyC ? 'FULL_FC' : 'MECH') };

            const fwIsFullFc = (eco.mode === (root.FreeCoolingEngine?.MODE?.FULL_FC || 'FULL_FC'));
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

            const mode = fwIsFullFc ? 'free' : ((eco.mode === (root.FreeCoolingEngine?.MODE?.PARTIAL_FC || 'PARTIAL_FC')) ? 'partial' : 'mechanical');

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
