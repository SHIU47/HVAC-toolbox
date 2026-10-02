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
        availableTemp(ctx) {
            const closedCtx = {
                ...ctx,
                approach_c: ctx.approach_c ?? ctx.params?.approach_c ?? (ctx.sys?.ctApproachC ?? 6.0)
            };
            return CoolingStages.get('evap_tower').availableTemp(closedCtx);
        },

        rejectionCost(ctx, Q_reject_kw, isFullFc) {
            const closedCtx = {
                ...ctx,
                approach_c: ctx.approach_c ?? ctx.params?.approach_c ?? (ctx.sys?.ctApproachC ?? 6.0)
            };
            return CoolingStages.get('evap_tower').rejectionCost(closedCtx, Q_reject_kw, isFullFc);
        },

        simulate(ctx) {
            const closedCtx = {
                ...ctx,
                approach_c: ctx.approach_c ?? ctx.params?.approach_c ?? (ctx.sys?.ctApproachC ?? 6.0)
            };
            return CoolingStages.get('evap_tower').simulate(closedCtx);
        }
    });
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
