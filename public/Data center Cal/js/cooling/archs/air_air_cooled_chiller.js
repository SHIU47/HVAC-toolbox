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

    CoolingArchRegistry.register({
        id: 'air_cooled_chiller',
        aliases: [],
        loop: 'air',
        optionLabel: '💨 氣冷式冰水主機 (Air-Cooled Chiller / 零耗水)',
        cardLabel: '氣冷式冰機',
        pillLabel: '氣冷冰機',
        dashboardLabel: '氣冷式冰水主機 (Air-Cooled Chiller)',
        flags: { hasMechanical: true, consumesWater: false },
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

            const fcApproach = (typeof root.A === 'function') ? root.A('air_chiller_fc_coil_approach_c') : 4.0;
            const airFcKwPerKw = (typeof root.A === 'function') ? root.A('air_chiller_fc_fan_kw_per_kw') : 0.05;

            const eco = (typeof root.FreeCoolingEngine?.calcSeriesEconomizer === 'function')
                ? root.FreeCoolingEngine.calcSeriesEconomizer(w.db + fcApproach, chwSupplyC, chwReturnC)
                : { fc_fraction: (w.db + fcApproach <= chwSupplyC ? 1.0 : 0.0), chiller_fraction: (w.db + fcApproach <= chwSupplyC ? 0.0 : 1.0), mode: (w.db + fcApproach <= chwSupplyC ? 'FULL_FC' : 'MECH') };

            const Q_fc = Q_kw * eco.fc_fraction;
            const Q_mech = Q_kw * eco.chiller_fraction;
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

            const mode = (eco.mode === (root.FreeCoolingEngine?.MODE?.FULL_FC || 'FULL_FC'))
                ? 'free'
                : ((eco.mode === (root.FreeCoolingEngine?.MODE?.PARTIAL_FC || 'PARTIAL_FC')) ? 'partial' : 'mechanical');

            return {
                terminalKw: ctx.terminalKw || 0,
                pumpKw: ctx.pumpKw || 0,
                fanKw,
                compressorKw,
                waterM3: 0,
                mode,
                deficitKw,
                heatRemovedKw: Math.max(0, Q_kw - deficitKw),
                mechLoadKw: Q_mech,
                diag: { eco, Q_fc, Q_mech, chRes }
            };
        }
    });
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
