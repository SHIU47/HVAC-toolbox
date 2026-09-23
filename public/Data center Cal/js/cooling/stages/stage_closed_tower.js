'use strict';
/**
 * stage_closed_tower.js - Closed-Circuit Cooling Tower Stage
 * Handles closed-loop evaporative cooling towers (e.g. cooling_tower_hx),
 * isolating process water inside coils while evaporative water cools the outer coil surface.
 */
(function (root) {
    const CoolingStages = root.CoolingStages;
    if (!CoolingStages) {
        throw new Error('CoolingStages must be loaded before stage_closed_tower.js');
    }

    CoolingStages.register('closed_tower', {
        simulate(ctx) {
            // Closed-circuit towers share the evaporative heat balance and fan power model
            // with a closed coil approach temperature (default 6.0°C).
            const closedCtx = {
                ...ctx,
                approach_c: ctx.approach_c ?? (ctx.sys?.ctApproachC ?? 6.0)
            };
            return CoolingStages.get('evap_tower').simulate(closedCtx);
        }
    });
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
