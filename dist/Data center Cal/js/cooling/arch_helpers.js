'use strict';
/**
 * arch_helpers.js - Shared Architecture & Stage Chain Utility Helpers (P2-6)
 * Provides standardized result builders, mode interpreters, and fallback COP lookups.
 */
(function (root) {
    /**
     * Standardized empty hour result structure for zero or sub-zero cooling loads.
     * @param {'free'|'partial'|'mechanical'} [mode='free']
     * @returns {Object}
     */
    function emptyHourResult(mode = 'free') {
        return {
            pumpKw: 0,
            fanKw: 0,
            compressorKw: 0,
            waterM3: 0,
            mode: mode,
            deficitKw: 0,
            heatRemovedKw: 0,
            mechLoadKw: 0,
            diag: {}
        };
    }

    /**
     * Tests if an economizer calculation result represents full free cooling.
     * @param {Object} eco
     * @returns {boolean}
     */
    function isFullFc(eco) {
        if (!eco) return false;
        const fullMode = (typeof root !== 'undefined' && root.FreeCoolingEngine?.MODE?.FULL_FC) || 'full_fc';
        return eco.mode === fullMode || eco.mode === 'FULL_FC' || (eco.fc_fraction !== undefined && eco.fc_fraction >= 1.0);
    }

    /**
     * Interprets standard 3-tier operating mode ('free' | 'partial' | 'mechanical') from economizer result.
     * @param {Object} eco
     * @returns {'free'|'partial'|'mechanical'}
     */
    function modeFromEco(eco) {
        if (!eco) return 'free';
        if (isFullFc(eco)) return 'free';
        return ((eco.chiller_fraction ?? 0) >= 1.0) ? 'mechanical' : 'partial';
    }

    /**
     * Standard 3-tier fallback chiller COP based on chilled water supply temperature.
     * Values read from ASSUMPTIONS:
     *   chiller_fallback_cop_chw_ge20 (5.8)
     *   chiller_fallback_cop_chw_ge12 (4.2)
     *   chiller_fallback_cop_chw_lt12 (3.0)
     * @param {number} chwSupplyC
     * @returns {number}
     */
    function chillerFallbackCop(chwSupplyC) {
        const A_fn = (typeof root.A === 'function') ? root.A : ((typeof A === 'function') ? A : null);
        const copGe20 = A_fn ? A_fn('chiller_fallback_cop_chw_ge20') : 5.8;
        const copGe12 = A_fn ? A_fn('chiller_fallback_cop_chw_ge12') : 4.2;
        const copLt12 = A_fn ? A_fn('chiller_fallback_cop_chw_lt12') : 3.0;
        return chwSupplyC >= 20 ? copGe20 : (chwSupplyC >= 12 ? copGe12 : copLt12);
    }

    const CoolingArchHelpers = {
        emptyHourResult,
        isFullFc,
        modeFromEco,
        chillerFallbackCop
    };

    root.CoolingArchHelpers = CoolingArchHelpers;

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = CoolingArchHelpers;
    }
})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this));
