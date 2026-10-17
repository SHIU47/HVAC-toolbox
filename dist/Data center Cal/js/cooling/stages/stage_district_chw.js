'use strict';
/**
 * stage_district_chw.js - District / Campus Chilled Water Stage
 * Models centralized campus chilled water loop where thermal energy is provided by a central plant.
 */
(function (root) {
    const CoolingStages = root.CoolingStages;
    if (!CoolingStages) {
        throw new Error('CoolingStages must be loaded before stage_district_chw.js');
    }

    CoolingStages.register('district_chw', {
        simulate(ctx) {
            const Q_kw = ctx.Q_kw || 0;
            if (Q_kw <= 0) {
                return {
                    Q_removed_kw: 0,
                    t_out_c: ctx.t_in_c ?? ctx.t_supply_c,
                    fanKw: 0,
                    pumpKw: 0,
                    compressorKw: 0,
                    waterM3: 0,
                    rejectToSinkKw: 0,
                    mode: 'free',
                    deficitKw: 0,
                    diag: {}
                };
            }

            const cop = ctx.cop ?? ((typeof root.A === 'function' && root.ASSUMPTIONS && root.ASSUMPTIONS['district_chw_cop']) ? root.A('district_chw_cop') : 5.0);
            const compressorKw = Q_kw / cop;

            return {
                Q_removed_kw: Q_kw,
                t_out_c: ctx.t_supply_c ?? 12.0,
                fanKw: 0,
                pumpKw: 0,
                compressorKw,
                waterM3: 0,
                rejectToSinkKw: 0, // Heat rejected outside facility boundary by central plant
                mode: 'mechanical',
                deficitKw: 0,
                diag: { cop }
            };
        }
    });
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
