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

    const tr = (key, fallback) => {
        const i18n = root.I18N;
        if (i18n && typeof i18n.t === 'function') {
            const v = i18n.t(key);
            if (v && v !== key) return v;
        }
        return fallback;
    };

    /**
     * R8: 系統是否配置板式熱交換器（PHE）。sys.hasPhe 未設定時取架構參數預設值；
     * Trim 架構固定有一次 / 二次兩組換熱器。修正舊邏輯「hasPhe 未設定即視為有 PHE」。
     */
    function archHasPhe(archDesc, sys) {
        if (sys && sys.hasPhe !== undefined && sys.hasPhe !== null) return !!sys.hasPhe;
        if (archDesc?.flags?.isTrim) return true;
        const p = (archDesc?.params || []).find(x => x.key === 'hasPhe');
        return p ? !!p.default : false;
    }

    /** R8: 冰水系統是否採一次＋二次泵（預設）；false = 變流量一次泵 (VPF) */
    function usesPrimarySecondary(sys) {
        return !(sys && sys.chwPrimarySecondary === false);
    }

    /** R8: 冰水泵配置參數（勾選 = 一次＋二次泵，取消 = VPF）；idPrefix 需依迴路區分避免 DOM id 衝突 */
    function chwPumpingParam(idPrefix) {
        return {
            key: 'chwPrimarySecondary',
            panel: 'custom',
            type: 'boolean',
            get label() { return tr('arch.param.chwPrimarySecondary', '冰水泵採「一次泵（冰機定流量）＋二次泵（變頻輸配）」配置；取消勾選為變流量一次泵 (VPF)'); },
            idPrefix,
            default: true
        };
    }

    /**
     * R8: 泵設備的標準 sizing 定義。需求功率取自 sys.hydraulics.pumps（store.computeHydraulics 產生），
     * when(sys) 決定此泵是否存在（例如有 PHE 才有排熱側泵）。
     */
    function pumpEquipment(key, fallbackLabel, when) {
        return {
            key,
            get label() { return tr(`equip.${key}`, fallbackLabel); },
            category: 'Pump',
            catalog: 'pump',
            role: 'pump',
            defaultModel: 'Grundfos TPE 5.5kW Inverter Pump (標準)',
            defaultUnitCapKw: 5.5,
            requiredKw: (ctx) => ((ctx.helpers?.sys?.hydraulics?.pumps) || []).find(p => p.key === key)?.power_kw || 0,
            calcQty: () => ({ qty: 2, n1: 2 }),
            when
        };
    }

    const CoolingArchHelpers = {
        emptyHourResult,
        isFullFc,
        modeFromEco,
        chillerFallbackCop,
        archHasPhe,
        usesPrimarySecondary,
        chwPumpingParam,
        pumpEquipment
    };

    root.CoolingArchHelpers = CoolingArchHelpers;

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = CoolingArchHelpers;
    }
})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this));
