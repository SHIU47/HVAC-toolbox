'use strict';
/**
 * ashrae_design_conditions.js - ASHRAE HOF Ch.14 Climatic Design Information Parser
 * Shared module for PUE system (browser) and weather data builder (Node.js).
 * Parses line 2 (DESIGN CONDITIONS) of EnergyPlus EPW files.
 */
(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        define([], factory);
    } else if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.AshraeDesign = factory();
    }
}(typeof self !== 'undefined' ? self : this, function () {

    function parseNum(token) {
        if (!token) return null;
        const str = String(token).trim();
        if (str === '' || str === 'N/A' || str === 'NA') return null;
        const v = parseFloat(str);
        return Number.isFinite(v) ? v : null;
    }

    function parseEpwDesignConditions(line2) {
        if (!line2 || typeof line2 !== 'string') return null;
        if (!line2.includes('DESIGN CONDITIONS')) return null;

        const tokens = line2.split(',').map(s => s.trim());
        const cIdx = tokens.indexOf('Cooling');
        if (cIdx === -1) return null;

        const cooling = {
            db004: parseNum(tokens[cIdx + 3]),
            mcwb004: parseNum(tokens[cIdx + 4]),
            evapWb004: parseNum(tokens[cIdx + 9])
        };

        const eIdx = tokens.indexOf('Extremes');
        let extremes = null;

        if (eIdx !== -1) {
            const dbMinMean = parseNum(tokens[eIdx + 4]);
            const dbMaxMean = parseNum(tokens[eIdx + 5]);
            const min5 = parseNum(tokens[eIdx + 8]);
            const max5 = parseNum(tokens[eIdx + 9]);
            const min10 = parseNum(tokens[eIdx + 10]);
            const max10 = parseNum(tokens[eIdx + 11]);
            const min20 = parseNum(tokens[eIdx + 12]);
            const max20 = parseNum(tokens[eIdx + 13]);
            const min50 = parseNum(tokens[eIdx + 14]);
            const max50 = parseNum(tokens[eIdx + 15]);

            const hasAnyExtremes = (
                dbMinMean !== null || dbMaxMean !== null ||
                min5 !== null || max5 !== null ||
                min10 !== null || max10 !== null ||
                min20 !== null || max20 !== null ||
                min50 !== null || max50 !== null
            );

            if (hasAnyExtremes) {
                extremes = {
                    dbMaxMean,
                    dbMinMean,
                    dbMax: { 5: max5, 10: max10, 20: max20, 50: max50 },
                    dbMin: { 5: min5, 10: min10, 20: min20, 50: min50 }
                };
            }
        }

        return {
            source: 'ASHRAE HOF Ch.14 (EPW header)',
            cooling,
            extremes
        };
    }

    return {
        parseEpwDesignConditions
    };
}));
