'use strict';
/**
 * weather_source.js - Unified weather data access module for PUE calculation system.
 * Manages weather catalog discovery, on-demand hourly loading, caching, and data adaptation.
 */
(function (root) {
    class WeatherSourceError extends Error {
        constructor(code, detail) {
            let msg = code;
            if (code === 'FILE_PROTOCOL') {
                msg = '直接開啟 HTML 檔案時，瀏覽器不允許讀取本機氣象資料。請改用桌面版 PUE計算系統.exe、線上版，或在此資料夾執行 npx serve 後用 http://localhost 開啟。也可以下載該站 EPW 後用「上傳 EPW」。';
            } else if (code === 'BAD_HOURLY') {
                msg = `逐時氣象資料格式錯誤或時數不足 8760 (筆數: ${detail})`;
            } else if (code === 'NOT_FOUND') {
                msg = `找不到測站氣象資料: ${detail}`;
            }
            super(msg);
            this.name = 'WeatherSourceError';
            this.code = code;
            this.detail = detail;
        }
    }

    const BUILTIN_STATION_MAP = {
        'SGP_SG_Singapore-Changi.Intl.AP.486980_TMYx.2011-2025': '新加坡 (Singapore)',
        'TWN_NOR_Taoyuan.589650_TMYx.2011-2025': '桃園 (Taoyuan Pilot)',
        'TWN_SOR_Kaohsiung.Intl.AP.467400_TMYx.2011-2025': '高雄 (Kaohsiung)',
        'TWN_NOR_Hsinchu.AP.467560_TMYx.2011-2025': '新竹 (Hsinchu)',
        'TWN_CNR_Taichung.591580_TMYx.2011-2025': '台中 (Taichung)',
        'PHL_CAL_Ambulong(菲律賓).984320_TMYx.2011-2025': '菲律賓 (Ambulong)',
        'USA_AL_Andalusia-South.Alabama.Rgnl.AP.722275_TMYx.2011-2025': '美國 (Alabama Andalusia)'
    };

    const REVERSE_BUILTIN_MAP = {
        '新加坡 (Singapore)': 'SGP_SG_Singapore-Changi.Intl.AP.486980_TMYx.2011-2025',
        '桃園 (Taoyuan Pilot)': 'TWN_NOR_Taoyuan.589650_TMYx.2011-2025',
        '高雄 (Kaohsiung)': 'TWN_SOR_Kaohsiung.Intl.AP.467400_TMYx.2011-2025',
        '新竹 (Hsinchu)': 'TWN_NOR_Hsinchu.AP.467560_TMYx.2011-2025',
        '台中 (Taichung)': 'TWN_CNR_Taichung.591580_TMYx.2011-2025',
        '菲律賓 (Ambulong)': 'PHL_CAL_Ambulong(菲律賓).984320_TMYx.2011-2025',
        '美國 (Alabama Andalusia)': 'USA_AL_Andalusia-South.Alabama.Rgnl.AP.722275_TMYx.2011-2025'
    };

    // Node.js file system support for CLI & regression testing
    let fsModule = null;
    let pathModule = null;
    try {
        const req = (typeof require === 'function' ? require : null) || (root && root.__nodeRequire);
        if (req) {
            fsModule = req('fs');
            pathModule = req('path');
        }
    } catch (_) {}

    function getNodeWeatherDir() {
        if (pathModule && fsModule) {
            if (typeof __dirname !== 'undefined') {
                const p1 = pathModule.resolve(__dirname, '../../天氣資料');
                if (fsModule.existsSync(p1)) return p1;
            }
            if (typeof process !== 'undefined' && process.cwd) {
                const p2 = pathModule.resolve(process.cwd(), 'public/天氣資料');
                if (fsModule.existsSync(p2)) return p2;
            }
        }
        return null;
    }

    // 5-entry LRU station cache
    const cache = new Map();
    function cacheGet(key) {
        if (!cache.has(key)) return null;
        const val = cache.get(key);
        cache.delete(key);
        cache.set(key, val);
        return val;
    }
    function cachePut(key, val) {
        if (cache.has(key)) {
            cache.delete(key);
        } else if (cache.size >= 5) {
            const oldestKey = cache.keys().next().value;
            cache.delete(oldestKey);
        }
        cache.set(key, val);
    }

    function calcMonthlyStats(hourlyData) {
        if (!Array.isArray(hourlyData) || hourlyData.length === 0) return [];
        const monthly = Array.from({ length: 12 }, () => ({
            count: 0, sumDB: 0, maxDB: -999, minDB: 999, sumWB: 0, maxWB: -999, minWB: 999, sumDP: 0, sumRH: 0
        }));
        hourlyData.forEach((h, idx) => {
            const m = (h.month ? h.month - 1 : Math.min(11, Math.floor(idx / 730)));
            const mo = monthly[m];
            mo.count++;
            mo.sumDB += h.db;
            if (h.db > mo.maxDB) mo.maxDB = h.db;
            if (h.db < mo.minDB) mo.minDB = h.db;
            mo.sumWB += h.wb;
            if (h.wb > mo.maxWB) mo.maxWB = h.wb;
            if (h.wb < mo.minWB) mo.minWB = h.wb;
            const rh = h.rh !== undefined ? h.rh : 75;
            const dp = h.dp !== undefined ? h.dp : h.db;
            mo.sumDP += dp;
            mo.sumRH += rh;
        });
        return monthly.map((m, idx) => ({
            month: idx + 1,
            avgDB: parseFloat((m.sumDB / (m.count || 1)).toFixed(1)),
            maxDB: parseFloat(m.maxDB.toFixed(1)),
            minDB: parseFloat(m.minDB.toFixed(1)),
            avgWB: parseFloat((m.sumWB / (m.count || 1)).toFixed(1)),
            maxWB: parseFloat(m.maxWB.toFixed(1)),
            minWB: parseFloat(m.minWB.toFixed(1)),
            avgDP: parseFloat((m.sumDP / (m.count || 1)).toFixed(1)),
            avgRH: parseFloat((m.sumRH / (m.count || 1)).toFixed(1))
        }));
    }

    function calcGlobalStats(hourlyData) {
        let sumDB = 0, sumWB = 0, sumDP = 0, sumRH = 0;
        let maxDB = -999, minDB = 999, maxWB = -999, minWB = 999;
        const count = hourlyData.length || 1;
        hourlyData.forEach(h => {
            sumDB += h.db;
            if (h.db > maxDB) maxDB = h.db;
            if (h.db < minDB) minDB = h.db;
            sumWB += h.wb;
            if (h.wb > maxWB) maxWB = h.wb;
            if (h.wb < minWB) minWB = h.wb;
            sumDP += (h.dp !== undefined ? h.dp : h.db);
            sumRH += (h.rh !== undefined ? h.rh : 75);
        });
        return {
            avgDB: parseFloat((sumDB / count).toFixed(1)),
            maxDB: parseFloat(maxDB.toFixed(1)),
            minDB: parseFloat(minDB.toFixed(1)),
            avgWB: parseFloat((sumWB / count).toFixed(1)),
            maxWB: parseFloat(maxWB.toFixed(1)),
            minWB: parseFloat(minWB.toFixed(1)),
            avgDP: parseFloat((sumDP / count).toFixed(1)),
            avgRH: parseFloat((sumRH / count).toFixed(1)),
            hoursCount: count
        };
    }

    const WeatherSource = {
        WeatherSourceError,
        BUILTIN_STATION_MAP,
        REVERSE_BUILTIN_MAP,

        mode() {
            if (typeof location !== 'undefined' && location.protocol === 'file:') {
                return 'file';
            }
            return 'http';
        },

        basePath() {
            if (typeof window !== 'undefined' && window.__PUE_EXE__) {
                return 'weather_catalog/';
            }
            return '../天氣資料/';
        },

        adaptHourly(raw) {
            if (!Array.isArray(raw) || raw.length < 8760) {
                throw new WeatherSourceError('BAD_HOURLY', raw?.length);
            }
            return raw.slice(0, 8760).map((r, i) => ({
                hourIndex: i,
                month: r.m + 1, // 165 站原始為 0～11，轉換為標準 1～12
                day: r.d,
                hour: r.h,
                db: r.db,
                wb: r.wb,
                dp: r.dp,
                rh: r.rh
            }));
        },

        async ensureCatalogLoaded() {
            if (root.BUILTIN_WEATHER_STATIONS && root.BUILTIN_WEATHER_STATIONS.length > 0) {
                return root.BUILTIN_WEATHER_STATIONS;
            }

            // In Node.js environment:
            const nodeDir = getNodeWeatherDir();
            if (nodeDir && fsModule && pathModule) {
                try {
                    const jsPath = pathModule.join(nodeDir, 'weather_data.js');
                    if (fsModule.existsSync(jsPath)) {
                        const code = fsModule.readFileSync(jsPath, 'utf8');
                        const fn = new Function('window', 'global', code);
                        fn(root, root);
                        if (root.BUILTIN_WEATHER_STATIONS) return root.BUILTIN_WEATHER_STATIONS;
                    }
                } catch (_) {}
            }

            // In browser environment:
            if (typeof document !== 'undefined') {
                return new Promise((resolve) => {
                    const script = document.createElement('script');
                    script.src = this.basePath() + 'weather_data.js';
                    script.onload = () => resolve(root.BUILTIN_WEATHER_STATIONS || null);
                    script.onerror = () => resolve(null);
                    (document.head || document.documentElement).appendChild(script);
                });
            }

            return null;
        },

        async listStations() {
            await this.ensureCatalogLoaded();
            const catalog = root.BUILTIN_WEATHER_STATIONS || [];
            const builtinData = root.BUILTIN_WEATHER_DATA || {};
            const isFile = this.mode() === 'file';

            const result = [];
            const processedBuiltinKeys = new Set();

            if (catalog.length > 0) {
                for (const s of catalog) {
                    const matchedBuiltinKey = BUILTIN_STATION_MAP[s.id] ||
                        Object.keys(builtinData).find(k => {
                            const b = builtinData[k];
                            return b.stationInfo && (b.stationInfo.location === s.stationName || b.stationInfo.location === s.city);
                        });

                    const isBuiltin = Boolean(matchedBuiltinKey && builtinData[matchedBuiltinKey]);
                    if (isBuiltin) processedBuiltinKeys.add(matchedBuiltinKey);

                    result.push({
                        id: s.id,
                        city: s.city,
                        cityZh: s.cityZh,
                        stationName: s.stationName,
                        country: s.country,
                        countryZh: s.countryZh,
                        countryCode: s.countryCode,
                        flag: s.flag,
                        continent: s.continent,
                        lat: s.lat,
                        lng: s.lng,
                        elev: s.elev,
                        wmo: s.wmo,
                        zone: s.zone,
                        minDB: s.minDB,
                        maxDB: s.maxDB,
                        avgDB: s.avgDB,
                        extDB: s.designConditions?.cooling?.db004 ?? s.extDB,
                        extWB: s.designConditions?.cooling?.evapWb004 ?? s.extWB,
                        freeCooling: s.freeCooling,
                        pue: s.pue,
                        designConditions: s.designConditions || null,
                        source: isBuiltin ? 'builtin' : 'catalog',
                        available: isBuiltin ? true : !isFile,
                        builtinKey: matchedBuiltinKey || null
                    });
                }
            }

            // Append any builtin cities not present in catalog
            for (const [key, bData] of Object.entries(builtinData)) {
                if (processedBuiltinKeys.has(key)) continue;
                const info = bData.stationInfo || {};
                const stats = bData.stats || {};
                const dc = bData.designConditions || {};
                result.push({
                    id: REVERSE_BUILTIN_MAP[key] || key,
                    city: info.location || key,
                    cityZh: key,
                    stationName: info.location || key,
                    country: info.country || '',
                    countryZh: key.includes('(') ? key.split('(')[0].trim() : info.country,
                    countryCode: info.country || '',
                    flag: key.includes('台灣') || key.includes('桃園') || key.includes('高雄') || key.includes('新竹') || key.includes('台中') ? '🇹🇼' : '🌐',
                    continent: key.includes('美國') ? 'Americas' : 'Asia',
                    lat: info.lat,
                    lng: info.lon,
                    elev: info.elev,
                    wmo: '',
                    zone: '',
                    minDB: stats.minDB,
                    maxDB: stats.maxDB,
                    avgDB: stats.avgDB,
                    extDB: dc.cooling?.db004,
                    extWB: dc.cooling?.evapWb004,
                    freeCooling: null,
                    pue: null,
                    designConditions: dc,
                    source: 'builtin',
                    available: true,
                    builtinKey: key
                });
            }

            // Default sorting: Taiwan first, then continent, country, city
            result.sort((a, b) => {
                const aIsTw = (a.countryZh === '台灣' || a.countryCode === 'TWN' || a.country === 'TWN' || a.cityZh?.includes('桃園') || a.cityZh?.includes('台北') || a.cityZh?.includes('高雄') || a.cityZh?.includes('新竹') || a.cityZh?.includes('台中'));
                const bIsTw = (b.countryZh === '台灣' || b.countryCode === 'TWN' || b.country === 'TWN' || b.cityZh?.includes('桃園') || b.cityZh?.includes('台北') || b.cityZh?.includes('高雄') || b.cityZh?.includes('新竹') || b.cityZh?.includes('台中'));
                if (aIsTw && !bIsTw) return -1;
                if (!aIsTw && bIsTw) return 1;

                const contA = a.continent || '';
                const contB = b.continent || '';
                if (contA !== contB) return contA.localeCompare(contB);

                const ctyA = a.countryZh || a.country || '';
                const ctyB = b.countryZh || b.country || '';
                if (ctyA !== ctyB) return ctyA.localeCompare(ctyB, 'zh-Hant');

                const cityA = a.cityZh || a.city || '';
                const cityB = b.cityZh || b.city || '';
                return cityA.localeCompare(cityB, 'zh-Hant');
            });

            return result;
        },

        async loadStation(id) {
            if (!id) throw new WeatherSourceError('NOT_FOUND', 'Empty station id');

            // 1. Check cache
            const cached = cacheGet(id);
            if (cached) return cached;

            const builtinData = root.BUILTIN_WEATHER_DATA || {};
            const catalog = root.BUILTIN_WEATHER_STATIONS || [];

            // 2. Check if id maps directly or via alias to built-in data
            const builtinKey = BUILTIN_STATION_MAP[id] || (builtinData[id] ? id : null);
            if (builtinKey && builtinData[builtinKey]) {
                const b = builtinData[builtinKey];
                const res = {
                    id,
                    stationInfo: b.stationInfo,
                    hourlyData: b.hourlyData,
                    designConditions: b.designConditions || null,
                    stats: b.stats,
                    monthlyStats: b.monthlyStats,
                    source: 'builtin'
                };
                cachePut(id, res);
                return res;
            }

            // 3. 165 Catalog Station
            if (this.mode() === 'file') {
                throw new WeatherSourceError('FILE_PROTOCOL', id);
            }

            let raw = null;
            const nodeDir = getNodeWeatherDir();

            // Try Node.js fs if available
            if (nodeDir && fsModule && pathModule) {
                const jsonPath = pathModule.join(nodeDir, 'hourly', `${id}.json`);
                if (fsModule.existsSync(jsonPath)) {
                    try {
                        raw = JSON.parse(fsModule.readFileSync(jsonPath, 'utf8'));
                    } catch (e) {
                        throw new WeatherSourceError('BAD_HOURLY', e.message);
                    }
                }
            }

            // Fallback to fetch (Browser / Server)
            if (!raw) {
                if (typeof fetch !== 'function') {
                    throw new WeatherSourceError('NOT_FOUND', `Cannot load hourly data for ${id} without fetch`);
                }
                const url = this.basePath() + 'hourly/' + encodeURIComponent(id) + '.json';
                const resp = await fetch(url);
                if (!resp.ok) {
                    throw new WeatherSourceError('NOT_FOUND', `${id} (HTTP ${resp.status})`);
                }
                raw = await resp.json();
            }

            const hourlyData = this.adaptHourly(raw);
            const meta = catalog.find(s => s.id === id || s.wmo === id) || {};

            const stationInfo = {
                location: meta.stationName || meta.city || id,
                country: meta.countryCode || meta.country || '',
                lat: meta.lat ?? 0,
                lon: meta.lng ?? meta.lon ?? 0,
                elev: meta.elev ?? 0,
                wmo: meta.wmo || ''
            };

            const designConditions = meta.designConditions || null;
            const monthlyStats = calcMonthlyStats(hourlyData);
            const stats = calcGlobalStats(hourlyData);

            const result = {
                id,
                stationInfo,
                hourlyData,
                designConditions,
                stats,
                monthlyStats,
                source: 'catalog'
            };

            cachePut(id, result);
            return result;
        },

        clearCache() {
            cache.clear();
        }
    };

    root.WeatherSource = WeatherSource;
    root.WeatherSourceError = WeatherSourceError;

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = WeatherSource;
    }
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
