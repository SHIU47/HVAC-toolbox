/**
 * epw_parser.js - EPW 氣象數據解析器與熱力學計算工具
 */
(function(window) {
    'use strict';

    function _t(key, params, fallback) {
        if (typeof window !== 'undefined' && window.I18N && typeof window.I18N.t === 'function') {
            return window.I18N.t(key, params);
        }
        if (typeof I18N !== 'undefined' && typeof I18N.t === 'function') {
            return I18N.t(key, params);
        }
        if (fallback && params) {
            return fallback.replace(/\{(\w+)\}/g, (_, k) => (k in params ? params[k] : `{${k}}`));
        }
        return fallback || key;
    }

    const EpwParser = {
        calculateWetBulb(t, rh) {
            const rhVal = Math.max(0, Math.min(100, rh));
            const wb = t * Math.atan(0.151977 * Math.sqrt(rhVal + 8.313659))
                     + Math.atan(t + rhVal)
                     - Math.atan(rhVal - 1.676331)
                     + 0.00391838 * Math.pow(rhVal, 1.5) * Math.atan(0.023101 * rhVal)
                     - 4.686035;
            return parseFloat(wb.toFixed(2));
        },

        parse(epwText) {
            if (!epwText || typeof epwText !== 'string') {
                throw new Error(_t('epw.invalidContent', null, '無效的 EPW 內容'));
            }

            const lines = epwText.split(/\r?\n/);
            const defStation = _t('epw.customStation', null, '自定義測站');
            const defCountry = _t('epw.customCountry', null, '自定義');
            let stationInfo = {
                location: defStation,
                country: defCountry,
                lat: 25.0, lon: 121.2, elev: 35
            };

            if (lines.length > 0 && lines[0].startsWith('LOCATION')) {
                const cols = lines[0].split(',');
                stationInfo = {
                    location: (cols[1] || defStation).trim(),
                    country: (cols[3] || 'N/A').trim(),
                    lat: parseFloat(cols[6]) || 0,
                    lon: parseFloat(cols[7]) || 0,
                    elev: parseFloat(cols[9]) || 0
                };
            }

            let designConditions = null;
            if (lines.length > 1 && lines[1].includes('DESIGN CONDITIONS')) {
                const parseFn = (typeof window !== 'undefined' && window.AshraeDesign && window.AshraeDesign.parseEpwDesignConditions)
                    ? window.AshraeDesign.parseEpwDesignConditions
                    : ((typeof AshraeDesign !== 'undefined' && AshraeDesign.parseEpwDesignConditions) ? AshraeDesign.parseEpwDesignConditions : null);
                if (typeof parseFn === 'function') {
                    designConditions = parseFn(lines[1]);
                }
            }

            const startLine = lines.length > 8 ? 8 : 0;
            const hourlyData = [];

            for (let i = startLine; i < lines.length; i++) {
                const line = lines[i].trim();
                if (!line) continue;
                const cols = line.split(',');
                if (cols.length >= 25 && !isNaN(cols[0]) && !isNaN(cols[1])) {
                    const month = parseInt(cols[1], 10);
                    const day = parseInt(cols[2], 10);
                    const hour = parseInt(cols[3], 10);
                    const db = parseFloat(cols[6]);
                    const dp = parseFloat(cols[7]);
                    const rh = parseFloat(cols[8]);

                    if (month >= 1 && month <= 12 && !isNaN(db) && !isNaN(rh)) {
                        const wb = this.calculateWetBulb(db, rh);
                        hourlyData.push({
                            hourIndex: hourlyData.length,
                            month, day, hour,
                            db: parseFloat(db.toFixed(1)),
                            dp: parseFloat(dp.toFixed(1)),
                            rh: Math.round(rh),
                            wb
                        });
                    }
                }
            }

            if (hourlyData.length === 0) {
                throw new Error(_t('epw.invalid8760', null, '無法解析到有效的 8760 小時氣候資料。'));
            }

            const dbList = hourlyData.map(d => d.db);
            const wbList = hourlyData.map(d => d.wb);
            const dpList = hourlyData.map(d => d.dp);
            const rhList = hourlyData.map(d => d.rh);
            const avg = arr => arr.reduce((a, b) => a + b, 0) / arr.length;

            const stats = {
                avgDB: parseFloat(avg(dbList).toFixed(1)),
                maxDB: parseFloat(Math.max(...dbList).toFixed(1)),
                minDB: parseFloat(Math.min(...dbList).toFixed(1)),
                avgWB: parseFloat(avg(wbList).toFixed(1)),
                maxWB: parseFloat(Math.max(...wbList).toFixed(1)),
                minWB: parseFloat(Math.min(...wbList).toFixed(1)),
                avgDP: parseFloat(avg(dpList).toFixed(1)),
                avgRH: Math.round(avg(rhList)),
                hoursCount: hourlyData.length
            };

            const monthlyStats = Array.from({ length: 12 }, (_, m) => {
                const monthRows = hourlyData.filter(d => d.month === m + 1);
                if (monthRows.length === 0) return { month: m + 1, avgDB: 0, maxDB: 0, avgWB: 0, maxWB: 0 };
                return {
                    month: m + 1,
                    avgDB: parseFloat(avg(monthRows.map(d => d.db)).toFixed(1)),
                    maxDB: parseFloat(Math.max(...monthRows.map(d => d.db)).toFixed(1)),
                    avgWB: parseFloat(avg(monthRows.map(d => d.wb)).toFixed(1)),
                    maxWB: parseFloat(Math.max(...monthRows.map(d => d.wb)).toFixed(1))
                };
            });

            return { stationInfo, hourlyData, stats, monthlyStats, designConditions };
        }
    };

    window.EpwParser = EpwParser;
})(window);
