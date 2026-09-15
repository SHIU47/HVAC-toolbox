/**
 * store.js - V21 Dual-Loop Temperatures & Architecture-Specific Sizing Generators
 */
(function(window) {
    'use strict';

    // A-5 fix: 正確月份時數對照表（非閏年）
    const MONTH_HOURS = [744, 672, 744, 720, 744, 720, 744, 744, 720, 744, 720, 744]; // 合計 8760
    const MONTH_START = [];
    { let acc = 0; for (let m = 0; m < 12; m++) { MONTH_START.push(acc); acc += MONTH_HOURS[m]; } }
    function hourToMonth(hourIdx) {
        for (let m = 11; m >= 0; m--) {
            if (hourIdx >= MONTH_START[m]) return m;
        }
        return 0;
    }

    // v33: 露點溫度 fallback 公式升級為 Magnus-Tetens 近似式，取代原本粗略的
    // 線性經驗式 dp = wb-(db-wb)/3（高濕熱帶氣候下誤差較大）。僅在氣象來源本身
    // 沒有提供 dp 欄位時才會用到 —— 真實 EPW 解析出來的資料 (js/weather_builtin.js)
    // 每小時都已經有原始 dp 值，這裡只是統計顯示用 fallback，不影響 PUE/冷卻計算
    // (那些一律直接用 db/wb)。
    function calcDewPointC(db_c, rh_pct) {
        const rh = Math.min(100, Math.max(0.1, rh_pct));
        const a = 17.27, b = 237.7;
        const alpha = (a * db_c) / (b + db_c) + Math.log(rh / 100);
        return (b * alpha) / (a - alpha);
    }

    const AppStore = {
        state: {
            site: {
                selectedCity: '桃園 (Taoyuan Pilot)',
                stationName: 'Taoyuan Intl Airport EPW',
                country: 'Taiwan',
                lat: 25.08,
                lon: 121.23,
                elev: 32,
                isRealEpw: true,
                hourly: [],
                stats: { avgDB: 22.8, maxDB: 36.4, minDB: 8.5, avgWB: 19.5, maxWB: 28.2, minWB: 6.2, avgDP: 17.2, avgRH: 76.5 },
                monthlyStats: [],
                binAnalysis: { db: {}, wb: {}, dp: {}, rh: {} }
            },

            // 全廠電力系統損失率 (Facility Electrical Loss %, e.g., 0.0% ~ 15.0%)
            // 涵蓋高/低壓變壓器、UPS 雙轉換損耗、PDU、電纜配電阻抗發熱等
            facilityElectricalLossPct: 0.0,

            // Step 2: Hall -> DU -> SU Hierarchy
            halls: [
                {
                    id: 'hall_1',
                    name: 'Hall A (旗艦 AI 算力中心)',
                    dus: [
                        {
                            id: 'du_1_1',
                            name: 'DU-01 (Vera Rubin NVL72 叢集)',
                            sus: [
                                {
                                    id: 'su_1_1_1',
                                    name: 'SU-01 (運算單元 1)',
                                    electricalLossFactorPct: 0.0,
                                    equipment: [
                                        { id: 'eq_1', category: 'GPU', model: 'NVIDIA Vera Rubin VR200 NVL72', qty: 1, itLoadKw: 227.0, liquidPct: 95.0, airPct: 5.0 },
                                        { id: 'eq_2', category: 'IB', model: 'NDR Leaf Switch (64p)', qty: 2, itLoadKw: 6.0, liquidPct: 0, airPct: 100.0 }
                                    ]
                                },
                                {
                                    id: 'su_1_1_2',
                                    name: 'SU-02 (運算單元 2)',
                                    electricalLossFactorPct: 0.0,
                                    equipment: [
                                        { id: 'eq_3', category: 'GPU', model: 'NVIDIA Vera Rubin VR200 NVL72', qty: 1, itLoadKw: 227.0, liquidPct: 95.0, airPct: 5.0 },
                                        { id: 'eq_4', category: 'CIN', model: '100G Leaf Switch (ToR)', qty: 2, itLoadKw: 8.0, liquidPct: 0, airPct: 100.0 }
                                    ]
                                },
                                {
                                    id: 'su_1_1_3',
                                    name: 'SU-03 (運算單元 3)',
                                    electricalLossFactorPct: 0.0,
                                    equipment: [
                                        { id: 'eq_5', category: 'GPU', model: 'NVIDIA Vera Rubin VR200 NVL72', qty: 1, itLoadKw: 227.0, liquidPct: 95.0, airPct: 5.0 }
                                    ]
                                },
                                {
                                    id: 'su_1_1_4',
                                    name: 'SU-04 (運算單元 4)',
                                    electricalLossFactorPct: 0.0,
                                    equipment: [
                                        { id: 'eq_6', category: 'GPU', model: 'NVIDIA Vera Rubin VR200 NVL72', qty: 1, itLoadKw: 227.0, liquidPct: 95.0, airPct: 5.0 }
                                    ]
                                }
                            ],
                            plantDesign: {
                                cduSystem: {
                                    architecture: 'dry_cooler_hx', // 'dry_cooler_hx' | 'adiabatic_tower' | 'cooling_tower_hx' | 'water_chiller'
                                    secSupplyC: 45.0,              // 二次側 (晶片側) 供水溫
                                    secReturnC: 57.0,              // 二次側 (晶片側) 回水溫
                                    cduApproachC: 3.0,             // CDU 熱交換 Approach
                                    fwsSupplyC: 40.0,              // 一次側 (設施側) 供水溫
                                    fwsReturnC: 55.0,              // 一次側 (設施側) 回水溫
                                    dryCoolerApproachC: 5.0,       // 排熱端 (乾冷器/水塔) Approach
                                    adiabaticSaturationEfficiencyPct: 85.0,
                                    blowdownLossPct: 15.0,
                                    cyclesOfConcentration: 5,
                                    designBasis: {},
                                    sizing: [],
                                    hydraulics: {},
                                    validation: { ok: true, checks: [] }
                                },
                                fanwallSystem: {
                                    architecture: 'air_cooled_chiller', // 'air_cooled_chiller' | 'water_cooled_chiller' | 'chilled_water_plant'
                                    chwSupplyC: 12.0,
                                    chwReturnC: 18.0,
                                    airSideEconomizerThresholdC: 18.0,
                                    designBasis: {},
                                    sizing: [],
                                    hydraulics: {},
                                    validation: { ok: true, checks: [] }
                                }
                            }
                        }
                    ]
                }
            ],

            // Step 3: CorePODs
            corePods: [
                {
                    id: 'corepod_01',
                    name: 'CorePOD-A (核心網通/集中儲存機房)',
                    enabled: true,
                    supportsHallIds: ['hall_1'],
                    electricalLossFactorPct: 0.0,
                    topologyMode: 'dedicated',
                    equipment: [
                        { id: 'cp_eq_1', category: 'IB', model: 'NDR Spine Switch (Modular)', qty: 4, itLoadKw: 15.0, liquidPct: 0, airPct: 100.0 },
                        { id: 'cp_eq_2', category: 'N/S', model: 'Border Core Router', qty: 2, itLoadKw: 12.0, liquidPct: 0, airPct: 100.0 },
                        { id: 'cp_eq_3', category: 'STG', model: 'NVMe Flash Storage JBOF', qty: 2, itLoadKw: 18.0, liquidPct: 0, airPct: 100.0 },
                        { id: 'cp_eq_4', category: 'MGMT', model: 'SMN / K8s Cluster Rack', qty: 2, itLoadKw: 10.0, liquidPct: 0, airPct: 100.0 }
                    ],
                    plantDesign: {
                        cduSystem: {
                            architecture: 'dry_cooler_hx',
                            secSupplyC: 45.0, secReturnC: 57.0, cduApproachC: 3.0,
                            fwsSupplyC: 40.0, fwsReturnC: 55.0, dryCoolerApproachC: 5.0,
                            designBasis: {}, sizing: [], hydraulics: {}, validation: { ok: true, checks: [] }
                        },
                        fanwallSystem: {
                            architecture: 'air_cooled_chiller',
                            chwSupplyC: 12.0, chwReturnC: 18.0, airSideEconomizerThresholdC: 18.0,
                            designBasis: {}, sizing: [], hydraulics: {}, validation: { ok: true, checks: [] }
                        }
                    }
                }
            ],

            assumptions_override: {},

            results: {
                overall: {
                    annualPue: 1.000, annualP_Pue: 1.000, annualWue: 0.00, annualWaterM3: 0,
                    totalItKw: 0, annualTotalMwh: 0, annualItMwh: 0, fcHoursPct: 0,
                    breakdownKwh: { it: 0, cduPump: 0, crahFan: 0, heatRejection: 0, chiller: 0, loss: 0 }
                },
                byDu: [],
                byCorePod: [],
                corePodGroup: { annualPue: 1.000, annualWue: 0.00, totalItKw: 0, annualTotalMwh: 0, annualWaterM3: 0 },
                fcPotential: { freeHoursPct: 0, trimHoursPct: 0, mechanicalHoursPct: 0, freeHours: 0, trimHours: 0, mechanicalHours: 0 }
            }
        },

        listeners: [],

        subscribe(fn) {
            this.listeners.push(fn);
        },

        notify() {
            // v33: calculate() 不能延遲 — 呼叫端(view_cooling.js等)幾乎都是
            // notify() 後緊接著同步呼叫 render()，會直接讀取 calculate() 算出來
            // 的 results/sizing.passed/effectiveCapKw，若把 calculate() 也丟進
            // debounce，render() 會讀到上一次的舊結果，畫面就會「慢一拍」。
            // autoSave() 純粹是 localStorage 寫入的旁路副作用，沒有任何呼叫端會
            // 緊接著同步讀取它的結果，才是真正安全、值得 debounce 的部分——
            // 連續調整多個欄位時，只會在最後一次變動後寫一次，而不是每次都寫。
            this.calculate();
            this._debouncedAutoSave();
            this.listeners.forEach(fn => fn(this.state));
        },

        _autoSaveDebounceTimer: null,
        _debouncedAutoSave() {
            clearTimeout(this._autoSaveDebounceTimer);
            this._autoSaveDebounceTimer = setTimeout(() => this.autoSave(), 400);
        },

        serializeProject() {
            const s = this.state;
            const exportData = {
                schemaVersion: 'v4',
                savedAt: new Date().toISOString(),
                site: {
                    selectedCity: s.site.selectedCity,
                    stats: s.site.stats,
                    userUploaded: s.site.userUploaded || false
                },
                halls: s.halls,
                corePods: s.corePods,
                assumptions_override: s.assumptions_override || {}
            };
            return JSON.stringify(exportData, null, 2);
        },

        deserializeProject(jsonStr) {
            try {
                const parsed = typeof jsonStr === 'string' ? JSON.parse(jsonStr) : jsonStr;
                const stateData = parsed.state || parsed;
                if (stateData.halls && Array.isArray(stateData.halls)) {
                    this.state.halls = stateData.halls;
                }
                if (stateData.corePods && Array.isArray(stateData.corePods)) {
                    this.state.corePods = stateData.corePods;
                }
                if (stateData.assumptions_override) {
                    this.state.assumptions_override = stateData.assumptions_override;
                }
                if (stateData.site) {
                    if (stateData.site.selectedCity) {
                        this.state.site.selectedCity = stateData.site.selectedCity;
                    }
                    if (stateData.site.stats) {
                        this.state.site.stats = stateData.site.stats;
                    }
                    // v45 fix: 專案匯出檔(serializeProject)從來沒有內嵌完整8760小時氣象陣列
                    // (只存 selectedCity/stats)，但這裡之前完全沒有補讀，導致重新開啟專案檔後
                    // this.state.site.hourly 是空的，calculate() 會悄悄退回 generateFallbackWeather()
                    // 那個溫和的合成氣候(全年幾乎不超過32°C)，而不是案場真實氣候(例如高雄夏天
                    // 常態超過36°C) —— 畫面上城市名稱/氣象統計還是對的，但實際8760小時模擬
                    // 用的是假天氣，PUE/WUE會嚴重失真且完全不會有任何警示。
                    // 對內建城市，比照 Step1 選擇城市(view_weather.js selectCity)同一個
                    // BUILTIN_WEATHER_DATA 來源重新載入真實逐時氣象；使用者自行上傳的EPW
                    // 目前匯出檔本來就沒存原始逐時資料，無法在這裡復原，只能請使用者重新上傳。
                    const cityName = stateData.site.selectedCity;
                    if (cityName && !stateData.site.userUploaded && typeof window !== 'undefined' && window.BUILTIN_WEATHER_DATA && window.BUILTIN_WEATHER_DATA[cityName]) {
                        const data = window.BUILTIN_WEATHER_DATA[cityName];
                        this.state.site.hourly = data.hourlyData;
                        this.state.site.monthlyStats = data.monthlyStats;
                        this.state.site.isRealEpw = true;
                        this.state.site.stationName = data.stationInfo?.location;
                        this.state.site.country = data.stationInfo?.country;
                        this.state.site.lat = data.stationInfo?.lat;
                        this.state.site.lon = data.stationInfo?.lon;
                        this.state.site.elev = data.stationInfo?.elev;
                    } else if (cityName) {
                        console.warn('[deserializeProject] 找不到「' + cityName + '」的內建氣象資料 (可能是使用者自行上傳的EPW，匯出檔未保存原始逐時資料)，本次計算將使用溫和的合成氣候近似值，結果不代表真實案場氣候，請重新於 Step1 上傳/選擇氣象資料。');
                    }
                }
                this.calculate();
                return true;
            } catch (e) {
                console.error('Failed to parse project JSON:', e);
                return false;
            }
        },

        autoSave() {
            try {
                if (typeof localStorage !== 'undefined') {
                    const data = this.serializeProject();
                    localStorage.setItem('pue_calc_autosave', data);
                }
            } catch (e) {
                console.warn('AutoSave failed:', e);
            }
        },

        loadAutoSave() {
            try {
                if (typeof localStorage !== 'undefined') {
                    const saved = localStorage.getItem('pue_calc_autosave');
                    if (saved) {
                        return this.deserializeProject(saved);
                    }
                }
            } catch (e) {
                console.warn('LoadAutoSave failed:', e);
            }
            return false;
        },

        resetProject() {
            if (typeof localStorage !== 'undefined') {
                localStorage.removeItem('pue_calc_autosave');
            }
        },

        calcSuSummary(su) {
            let totalItKw = 0, liquidHeatKw = 0, airHeatKw = 0;
            (su.equipment || []).forEach(item => {
                const qty = item.qty || 1;
                const it = (item.itLoadKw || 0) * qty;
                const liq = it * ((item.liquidPct || 0) / 100);
                const air = it - liq;
                totalItKw += it;
                liquidHeatKw += liq;
                airHeatKw += air;
            });
            const dlcPct = totalItKw > 0 ? (liquidHeatKw / totalItKw) * 100 : 0;
            return { totalItKw, liquidHeatKw, airHeatKw, dlcPct, lossKw: 0 };
        },

        calcDuSummary(du) {
            let totalItKw = 0, liquidHeatKw = 0, airHeatKw = 0;
            (du.sus || []).forEach(su => {
                const s = this.calcSuSummary(su);
                totalItKw += s.totalItKw;
                liquidHeatKw += s.liquidHeatKw;
                airHeatKw += s.airHeatKw;
            });
            const dlcPct = totalItKw > 0 ? (liquidHeatKw / totalItKw) * 100 : 0;
            return { totalItKw, liquidHeatKw, airHeatKw, dlcPct, lossKw: 0 };
        },

        calcHallSummary(hall) {
            let totalItKw = 0, liquidHeatKw = 0, airHeatKw = 0;
            (hall.dus || []).forEach(du => {
                const d = this.calcDuSummary(du);
                totalItKw += d.totalItKw;
                liquidHeatKw += d.liquidHeatKw;
                airHeatKw += d.airHeatKw;
            });
            const dlcPct = totalItKw > 0 ? (liquidHeatKw / totalItKw) * 100 : 0;
            return { totalItKw, liquidHeatKw, airHeatKw, dlcPct, lossKw: 0 };
        },

        calcCorePodSummary(pod) {
            let totalItKw = 0, liquidHeatKw = 0, airHeatKw = 0;
            (pod.equipment || []).forEach(item => {
                const qty = item.qty || 1;
                const it = (item.itLoadKw || 0) * qty;
                const liq = it * ((item.liquidPct || 0) / 100);
                const air = it - liq;
                totalItKw += it;
                liquidHeatKw += liq;
                airHeatKw += air;
            });
            const dlcPct = totalItKw > 0 ? (liquidHeatKw / totalItKw) * 100 : 0;
            return { totalItKw, liquidHeatKw, airHeatKw, dlcPct, lossKw: 0 };
        },

        setFacilityElectricalLossPct(pct) {
            const val = Math.max(0, Math.min(50, parseFloat(pct) || 0.0));
            this.state.facilityElectricalLossPct = Number(val.toFixed(2));
            this.calculate();
            this.notify();
        },

        updateSite(siteData) {
            Object.assign(this.state.site, siteData);
            if (siteData.hourly && siteData.hourly.length >= 8760) {
                this.state.site.monthlyStats = this.computeMonthlyStats(siteData.hourly);
                this.state.site.stats = this.computeGlobalStats(siteData.hourly, this.state.site.monthlyStats);
            }
            this.recalculateBinAnalysis();
            this.notify();
        },

        computeMonthlyStats(hourlyData) {
            if (!hourlyData || hourlyData.length === 0) return [];
            const monthly = Array.from({ length: 12 }, () => ({
                count: 0, sumDB: 0, maxDB: -999, minDB: 999, sumWB: 0, maxWB: -999, minWB: 999, sumDP: 0, sumRH: 0
            }));
            hourlyData.forEach((h, idx) => {
                const m = (h.month ? h.month - 1 : hourToMonth(h.hourIndex !== undefined ? h.hourIndex : idx)); // A-5 fix
                const mo = monthly[m];
                mo.count++;
                mo.sumDB += h.db;
                if (h.db > mo.maxDB) mo.maxDB = h.db;
                if (h.db < mo.minDB) mo.minDB = h.db;
                mo.sumWB += h.wb;
                if (h.wb > mo.maxWB) mo.maxWB = h.wb;
                if (h.wb < mo.minWB) mo.minWB = h.wb;
                const rh = h.rh !== undefined ? h.rh : 75;
                const dp = h.dp !== undefined ? h.dp : calcDewPointC(h.db, rh);
                mo.sumDP += dp;
                mo.sumRH += rh;
            });
            return monthly.map(m => ({
                avgDB: parseFloat((m.sumDB / (m.count || 1)).toFixed(1)),
                maxDB: parseFloat(m.maxDB.toFixed(1)),
                minDB: parseFloat(m.minDB.toFixed(1)),
                avgWB: parseFloat((m.sumWB / (m.count || 1)).toFixed(1)),
                maxWB: parseFloat(m.maxWB.toFixed(1)),
                minWB: parseFloat(m.minWB.toFixed(1)),
                avgDP: parseFloat((m.sumDP / (m.count || 1)).toFixed(1)),
                avgRH: parseFloat((m.sumRH / (m.count || 1)).toFixed(1))
            }));
        },

        computeGlobalStats(hourlyData, monthlyStats) {
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
                const rh = h.rh !== undefined ? h.rh : 75;
                const dp = h.dp !== undefined ? h.dp : calcDewPointC(h.db, rh);
                sumDP += dp;
                sumRH += rh;
            });
            return {
                avgDB: parseFloat((sumDB / count).toFixed(1)),
                maxDB: parseFloat(maxDB.toFixed(1)),
                minDB: parseFloat(minDB.toFixed(1)),
                avgWB: parseFloat((sumWB / count).toFixed(1)),
                maxWB: parseFloat(maxWB.toFixed(1)),
                minWB: parseFloat(minWB.toFixed(1)),
                avgDP: parseFloat((sumDP / count).toFixed(1)),
                avgRH: parseFloat((sumRH / count).toFixed(1))
            };
        },

        recalculateBinAnalysis() {
            const hourly = (this.state.site.hourly && this.state.site.hourly.length >= 8760) 
                ? this.state.site.hourly 
                : this.generateFallbackWeather();
            if (!this.state.site.monthlyStats || this.state.site.monthlyStats.length === 0) {
                this.state.site.monthlyStats = this.computeMonthlyStats(hourly);
                this.state.site.stats = this.computeGlobalStats(hourly, this.state.site.monthlyStats);
            }
            const dbBins = {}, wbBins = {}, dpBins = {}, rhBins = {};
            hourly.forEach(h => {
                const dbStep = Math.floor(h.db / 2) * 2;
                dbBins[dbStep] = (dbBins[dbStep] || 0) + 1;
                const wbStep = Math.floor(h.wb / 2) * 2;
                wbBins[wbStep] = (wbBins[wbStep] || 0) + 1;
                const rh = h.rh !== undefined ? h.rh : 75;
                const dp = h.dp !== undefined ? h.dp : calcDewPointC(h.db, rh);
                const dpStep = Math.floor(dp / 2) * 2;
                dpBins[dpStep] = (dpBins[dpStep] || 0) + 1;
                const rhStep = Math.floor(rh / 10) * 10;
                rhBins[rhStep] = (rhBins[rhStep] || 0) + 1;
            });
            this.state.site.binAnalysis = { db: dbBins, wb: wbBins, dp: dpBins, rh: rhBins };
        },

        // ═══════════════════════════════════════════════════════════════
        // CorePOD CRUD & 複製管理方法
        // ═══════════════════════════════════════════════════════════════
        addCorePod(data = {}) {
            const podNum = this.state.corePods.length + 1;
            const letter = String.fromCharCode(65 + (podNum - 1) % 26);
            const podId = 'corepod_' + Date.now() + '_' + podNum;
            const newPod = {
                id: podId,
                name: data.name || `CorePOD-${letter} (核心網通/集中儲存)`,
                topologyMode: data.topologyMode || 'dedicated',
                electricalLossFactorPct: 0.0,
                equipment: data.equipment ? JSON.parse(JSON.stringify(data.equipment)) : [
                    { id: 'eq_' + Date.now() + '_1', category: 'IB', model: 'Quantum-2 Spine Switch (128p)', qty: 8, itLoadKw: 12.0, liquidPct: 0, airPct: 100 },
                    { id: 'eq_' + Date.now() + '_2', category: 'CIN', model: 'SN5600 800GbE Spine (64p)', qty: 8, itLoadKw: 10.0, liquidPct: 0, airPct: 100 },
                    { id: 'eq_' + Date.now() + '_3', category: 'STG', model: 'High-Density NVMe Storage Rack', qty: 10, itLoadKw: 25.0, liquidPct: 0, airPct: 100 }
                ],
                plantDesign: data.plantDesign ? JSON.parse(JSON.stringify(data.plantDesign)) : {
                    cduSystem: {
                        architecture: 'dry_cooler_hx',
                        secSupplyC: 45.0,
                        secReturnC: 55.0,
                        cduApproachC: 3.0,
                        fwsSupplyC: 37.0,
                        fwsReturnC: 47.0,
                        dryCoolerApproachC: 5.0,
                        sizing: []
                    },
                    fanwallSystem: {
                        architecture: 'air_cooled_chiller',
                        chwSupplyC: 12.0,
                        chwReturnC: 18.0,
                        sizing: []
                    }
                }
            };
            this.state.corePods.push(newPod);
            this.notify();
            return newPod;
        },

        copyCorePod(podId) {
            const pod = this.state.corePods.find(p => p.id === podId);
            if (!pod) return null;
            const clonedPod = JSON.parse(JSON.stringify(pod));
            const podNum = this.state.corePods.length + 1;
            const letter = String.fromCharCode(65 + (podNum - 1) % 26);
            clonedPod.id = 'corepod_' + Date.now() + '_' + podNum;
            clonedPod.name = `${pod.name} (複製)`;
            clonedPod.equipment.forEach((eq, eqIdx) => {
                eq.id = 'eq_' + Date.now() + '_' + (eqIdx + 1);
            });
            if (clonedPod.plantDesign) {
                if (clonedPod.plantDesign.cduSystem) clonedPod.plantDesign.cduSystem.sizing = [];
                if (clonedPod.plantDesign.fanwallSystem) clonedPod.plantDesign.fanwallSystem.sizing = [];
            }
            this.state.corePods.push(clonedPod);
            this.notify();
            return clonedPod;
        },

        deleteCorePod(podId) {
            if (this.state.corePods.length <= 1) {
                alert('⚠️ 系統中至少需保留 1 組 CorePOD 核心機房！');
                return false;
            }
            const idx = this.state.corePods.findIndex(p => p.id === podId);
            if (idx !== -1) {
                this.state.corePods.splice(idx, 1);
                this.notify();
                return true;
            }
            return false;
        },

        updateCorePod(podId, fields) {
            const pod = this.state.corePods.find(p => p.id === podId);
            if (pod) {
                Object.assign(pod, fields);
                this.notify();
                return true;
            }
            return false;
        },

        // ═══════════════════════════════════════════════════════════════
        // V28: Hall / DU / SU CRUD 階層管理方法
        // ═══════════════════════════════════════════════════════════════
        addHall(name) {
            const hallNum = this.state.halls.length + 1;
            const hallId = 'hall_' + Date.now();
            const newHall = {
                id: hallId,
                name: name || `Hall ${hallNum}`,
                dus: []
            };
            this.state.halls.push(newHall);
            this.addDU(hallId, 'DU-01');
            this.notify();
            return newHall;
        },

        deleteHall(hallId) {
            if (this.state.halls.length <= 1) {
                alert('⚠️ 系統中至少需保留 1 間 Data Hall 機房！');
                return false;
            }
            const idx = this.state.halls.findIndex(h => h.id === hallId);
            if (idx !== -1) {
                this.state.halls.splice(idx, 1);
                this.notify();
                return true;
            }
            return false;
        },

        renameHall(hallId, name) {
            const hall = this.state.halls.find(h => h.id === hallId);
            if (hall) {
                hall.name = name;
                this.notify();
                return true;
            }
            return false;
        },

        addDU(hallId, namePrefix) {
            const hall = this.state.halls.find(h => h.id === hallId);
            if (!hall) return null;
            const duIdx = hall.dus.length + 1;
            const duId = 'du_' + Date.now() + '_' + duIdx;
            const newDu = {
                id: duId,
                name: namePrefix || `DU-${duIdx < 10 ? '0' + duIdx : duIdx}`,
                sus: [
                    {
                        id: 'su_' + Date.now() + '_1',
                        name: 'SU-01 (預設配置)',
                        electricalLossFactorPct: 0.0,
                        equipment: [
                            { id: 'eq_' + Date.now() + '_1', category: 'GPU', model: 'NVIDIA Vera Rubin VR200 NVL72', qty: 2, itLoadKw: 227.0, liquidPct: 95.0, airPct: 5.0 },
                            { id: 'eq_' + Date.now() + '_2', category: 'IB', model: 'NDR Leaf Switch (64p)', qty: 2, itLoadKw: 6.0, liquidPct: 0, airPct: 100.0 }
                        ]
                    }
                ],
                plantDesign: {
                    cduSystem: {
                        architecture: 'dry_cooler_hx',
                        secSupplyC: 45.0,
                        secReturnC: 57.0,
                        cduApproachC: 3.0,
                        fwsSupplyC: 37.0,
                        fwsReturnC: 47.0,
                        dryCoolerApproachC: 5.0,
                        sizing: []
                    },
                    fanwallSystem: {
                        architecture: 'air_cooled_chiller',
                        chwSupplyC: 12.0,
                        chwReturnC: 18.0,
                        sizing: []
                    }
                }
            };
            hall.dus.push(newDu);
            this.notify();
            return newDu;
        },

        addSU(hallId, duId, name) {
            const hall = this.state.halls.find(h => h.id === hallId);
            if (!hall) return null;
            const du = hall.dus.find(d => d.id === duId);
            if (!du) return null;
            const suIdx = du.sus.length + 1;
            const newSu = {
                id: 'su_' + Date.now() + '_' + suIdx,
                name: name || `SU-${suIdx < 10 ? '0' + suIdx : suIdx}`,
                electricalLossFactorPct: 0.0,
                equipment: [
                    { id: 'eq_' + Date.now() + '_1', category: 'GPU', model: 'NVIDIA Vera Rubin VR200 NVL72', qty: 1, itLoadKw: 227.0, liquidPct: 95.0, airPct: 5.0 }
                ]
            };
            du.sus.push(newSu);
            this.notify();
            return newSu;
        },

        copyDU(hallId, duId) {
            const hall = this.state.halls.find(h => h.id === hallId);
            if (!hall) return null;
            const du = hall.dus.find(d => d.id === duId);
            if (!du) return null;
            const clonedDu = JSON.parse(JSON.stringify(du));
            const duIdx = hall.dus.length + 1;
            clonedDu.id = 'du_' + Date.now() + '_' + duIdx;
            clonedDu.name = `${du.name} (複製)`;
            clonedDu.sus.forEach((su, sIdx) => {
                su.id = 'su_' + Date.now() + '_' + (sIdx + 1);
                su.equipment.forEach((eq, eqIdx) => {
                    eq.id = 'eq_' + Date.now() + '_' + (eqIdx + 1);
                });
            });
            if (clonedDu.plantDesign) {
                if (clonedDu.plantDesign.cduSystem) clonedDu.plantDesign.cduSystem.sizing = [];
                if (clonedDu.plantDesign.fanwallSystem) clonedDu.plantDesign.fanwallSystem.sizing = [];
            }
            hall.dus.push(clonedDu);
            this.notify();
            return clonedDu;
        },

        deleteDU(hallId, duId) {
            const hall = this.state.halls.find(h => h.id === hallId);
            if (!hall) return false;
            if (hall.dus.length <= 1) {
                alert('⚠️ 每個機房至少需保留 1 組 DU 冷卻單元！');
                return false;
            }
            const idx = hall.dus.findIndex(d => d.id === duId);
            if (idx !== -1) {
                hall.dus.splice(idx, 1);
                this.notify();
                return true;
            }
            return false;
        },

        copySU(hallId, duId, suId, n = 1) {
            const hall = this.state.halls.find(h => h.id === hallId);
            if (!hall) return false;
            const du = hall.dus.find(d => d.id === duId);
            if (!du) return false;
            const su = du.sus.find(s => s.id === suId);
            if (!su) return false;

            for (let i = 0; i < n; i++) {
                const clonedSu = JSON.parse(JSON.stringify(su));
                const suIdx = du.sus.length + 1;
                clonedSu.id = 'su_' + Date.now() + '_' + (i + 1);
                clonedSu.name = `${su.name} (Copy ${i + 1})`;
                clonedSu.equipment.forEach((eq, eqIdx) => {
                    eq.id = 'eq_' + Date.now() + '_' + (i + 1) + '_' + eqIdx;
                });
                du.sus.push(clonedSu);
            }
            this.notify();
            return true;
        },

        deleteSU(hallId, duId, suId) {
            const hall = this.state.halls.find(h => h.id === hallId);
            if (!hall) return false;
            const du = hall.dus.find(d => d.id === duId);
            if (!du) return false;
            if (du.sus.length <= 1) {
                alert('⚠️ 每個 DU 至少需保留 1 組 SU 算力單元！');
                return false;
            }
            const idx = du.sus.findIndex(s => s.id === suId);
            if (idx !== -1) {
                du.sus.splice(idx, 1);
                this.notify();
                return true;
            }
            return false;
        },

        // V21 依架構生成專屬的 sizing 清單
        generateCduSizing(arch, reqKw, hydKw) {
            const minCduUnits = Math.max(1, Math.ceil(reqKw / 100));
            const cduCat = (typeof CatalogManager !== 'undefined') ? CatalogManager.getCatalog('cdu') : [
                { model: 'Vertiv XDU 80kW', capKw: 80 },
                { model: 'CoolIT CDU 100kW (標準)', capKw: 100 },
                { model: 'Vertiv XDU 150kW', capKw: 150 },
                { model: 'Airedale CoolTrap CDU 200kW', capKw: 200 }
            ];
            const cduUnit = {
                key: 'cdu_unit',
                label: 'CDU 液冷分配主機 (Cooling Distribution Unit)',
                category: 'CDU',
                catalog: cduCat,
                selectedModel: 'CoolIT CDU 100kW (標準)',
                unitCapKw: 100,
                selectedQty: minCduUnits + 1,
                requiredKw: reqKw,
                requiredUnitsN1: minCduUnits + 1
            };

            const pumpCat = (typeof CatalogManager !== 'undefined') ? CatalogManager.getCatalog('pump') : [
                { model: 'Grundfos CR64 VFD (5.5kW)', capKw: 5.5 },
                { model: 'Grundfos CR120 VFD (11.0kW)', capKw: 11.0 },
                { model: 'Armstrong 4300 VFD (15.0kW)', capKw: 15.0 },
                { model: 'Wilo IL-E Mega (22.0kW)', capKw: 22.0 }
            ];
            const pump = {
                key: 'cdu_pump',
                label: 'CDU Primary Pump 一次側設施循環水泵',
                category: 'Pump',
                catalog: pumpCat,
                selectedModel: 'Grundfos TPE 5.5kW Inverter Pump (標準)',
                unitCapKw: 5.5,
                selectedQty: 3,
                requiredKw: hydKw || 5.5,
                requiredUnitsN1: 3
            };

            const trimChillerCat = (typeof CatalogManager !== 'undefined') ? CatalogManager.getCatalog('chiller_water') : [
                { model: 'Carrier 30XW-500kW Water Chiller (COP 5.8)', capKw: 500, cop: 5.8 },
                { model: 'Trane RTHD 800kW Water Chiller (COP 6.2)', capKw: 800, cop: 6.2 },
                { model: 'York YVWH 1000kW VFD Chiller (COP 6.5)', capKw: 1000, cop: 6.5 }
            ];
            const trimReqKw = Math.max(50, Math.round(reqKw * 0.35)); // NVIDIA Mode 2 Trim 負擔約 35% 尖峰修整量
            const minTrimUnits = Math.max(1, Math.ceil(trimReqKw / (trimChillerCat[0]?.capKw || 500)));
            const trimChiller = {
                key: 'trim_chiller',
                label: 'In-line Trim Chiller 輔助修整冰機 (NVIDIA Mode 2/3 機械製冷)',
                category: 'Chiller',
                catalog: trimChillerCat,
                selectedModel: trimChillerCat[0]?.model || 'Carrier 30XW-500kW Water Chiller (COP 5.8)',
                unitCapKw: trimChillerCat[0]?.capKw || 500,
                selectedQty: minTrimUnits + 1,
                requiredKw: trimReqKw,
                requiredUnitsN1: minTrimUnits + 1
            };

            if (arch === 'dry_cooler_trim' || arch === 'dry_cooler_hx') {
                const minDryUnits = Math.max(1, Math.ceil(reqKw / 1200));
                const dcCat = (typeof CatalogManager !== 'undefined') ? CatalogManager.getCatalog('dry_cooler') : [
                    { model: 'Güntner 1200kW V-Bank Dry Cooler', capKw: 1200 },
                    { model: 'BAC Trillium 2000kW Closed-Loop', capKw: 2000 },
                    { model: 'Güntner 6000kW Raised-Bed (DSX Standard)', capKw: 6000 }
                ];
                return [
                    cduUnit,
                    {
                        key: 'dry_cooler',
                        label: 'Dry Cooler 乾式冷卻器 (零耗水)',
                        category: 'DryCooler',
                        catalog: dcCat,
                        selectedModel: dcCat[0]?.model || 'Güntner 1200kW V-Bank Dry Cooler',
                        unitCapKw: dcCat[0]?.capKw || 1200,
                        selectedQty: minDryUnits + 1,
                        requiredKw: reqKw,
                        requiredUnitsN1: minDryUnits + 1
                    },
                    pump,
                    trimChiller
                ];
            } else if (arch === 'dry_cooler_pure') {
                const minDryUnits = Math.max(1, Math.ceil(reqKw / 1200));
                const dcCat = (typeof CatalogManager !== 'undefined') ? CatalogManager.getCatalog('dry_cooler') : [
                    { model: 'Güntner 1200kW V-Bank Dry Cooler', capKw: 1200 },
                    { model: 'BAC Trillium 2000kW Closed-Loop', capKw: 2000 },
                    { model: 'Güntner 6000kW Raised-Bed (DSX Standard)', capKw: 6000 }
                ];
                return [
                    cduUnit,
                    {
                        key: 'dry_cooler',
                        label: 'Dry Cooler 乾式冷卻器 (純直冷・零冰機)',
                        category: 'DryCooler',
                        catalog: dcCat,
                        selectedModel: dcCat[0]?.model || 'Güntner 1200kW V-Bank Dry Cooler',
                        unitCapKw: dcCat[0]?.capKw || 1200,
                        selectedQty: minDryUnits + 1,
                        requiredKw: reqKw,
                        requiredUnitsN1: minDryUnits + 1
                    },
                    pump
                ];
            } else if (arch === 'adiabatic_tower') {
                const minAdiaUnits = Math.max(1, Math.ceil(reqKw / 1000));
                const ctCat = (typeof CatalogManager !== 'undefined') ? CatalogManager.getCatalog('cooling_tower') : [
                    { model: 'BAC Series 3000 600kW', capKw: 600 },
                    { model: 'BAC Series 3000 1000kW (標準)', capKw: 1000 },
                    { model: 'BAC VFL-1200 2000kW', capKw: 2000 }
                ];
                return [
                    cduUnit,
                    {
                        key: 'adiabatic_tower',
                        label: 'Adiabatic Tower 絕熱噴淋冷卻塔',
                        category: 'AdiabaticTower',
                        catalog: ctCat,
                        selectedModel: ctCat[1]?.model || 'BAC Series 3000 1000kW (標準)',
                        unitCapKw: ctCat[1]?.capKw || 1000,
                        selectedQty: minAdiaUnits + 1,
                        requiredKw: reqKw,
                        requiredUnitsN1: minAdiaUnits + 1
                    },
                    pump
                ];
            } else if (arch === 'cooling_tower_hx') {
                const minCtUnits = Math.max(1, Math.ceil(reqKw / 1000));
                const ctCat = (typeof CatalogManager !== 'undefined') ? CatalogManager.getCatalog('cooling_tower') : [
                    { model: 'BAC Closed-Circuit FXV 600kW', capKw: 600 },
                    { model: 'BAC Closed-Circuit FXV 1000kW (標準)', capKw: 1000 },
                    { model: 'BAC Closed-Circuit FXV 2000kW', capKw: 2000 }
                ];
                return [
                    cduUnit,
                    {
                        key: 'cooling_tower',
                        label: 'Closed-Circuit Cooling Tower 密閉式冷卻水塔',
                        category: 'CoolingTower',
                        catalog: ctCat,
                        selectedModel: ctCat[1]?.model || 'BAC Closed-Circuit FXV 1000kW (標準)',
                        unitCapKw: ctCat[1]?.capKw || 1000,
                        selectedQty: minCtUnits + 1,
                        requiredKw: reqKw,
                        requiredUnitsN1: minCtUnits + 1
                    },
                    pump
                ];
            } else if (arch === 'water_chiller') {
                const minChillerUnits = Math.max(1, Math.ceil(reqKw / 500));
                const chillerCat = (typeof CatalogManager !== 'undefined') ? CatalogManager.getCatalog('chiller_water') : [
                    { model: 'Carrier 23XRV Variable-Speed Screw 350kW', capKw: 350 },
                    { model: 'Trane RTHD Water-Cooled Screw 500kW (標準)', capKw: 500 },
                    { model: 'York YZ Magnetic Bearing Centrifugal 800kW', capKw: 800 }
                ];
                const ctCat = (typeof CatalogManager !== 'undefined') ? CatalogManager.getCatalog('cooling_tower') : [
                    { model: 'BAC Series 3000 600kW', capKw: 600 },
                    { model: 'BAC Series 3000 1200kW (標準)', capKw: 1200 }
                ];
                return [
                    cduUnit,
                    {
                        key: 'water_cooled_chiller',
                        label: 'Water-Cooled Chiller 水冷式冰水主機',
                        category: 'Chiller',
                        catalog: chillerCat,
                        selectedModel: 'Trane RTHD Water-Cooled Screw 500kW (標準)',
                        unitCapKw: 500,
                        selectedQty: minChillerUnits + 1,
                        requiredKw: reqKw,
                        requiredUnitsN1: minChillerUnits + 1
                    },
                    {
                        key: 'cooling_tower',
                        label: 'Cooling Tower 冰機散熱冷卻水塔',
                        category: 'CoolingTower',
                        catalog: ctCat,
                        selectedModel: 'BAC Series 3000 600kW',
                        unitCapKw: 600,
                        selectedQty: minChillerUnits + 1,
                        requiredKw: reqKw * 1.2,
                        requiredUnitsN1: minChillerUnits + 1
                    },
                    pump
                ];
            }
            return [cduUnit, pump];
        },

        // V24 & V27: 依 Fanwall / RDHX 架構動態生成選型清單 (連接真實設備目錄)
        generateFwSizing(arch, reqKw, pumpPowerKw) {
            const minCrahUnits = Math.max(1, Math.ceil(reqKw / 60));
            const crahCat = (typeof CatalogManager !== 'undefined') ? CatalogManager.getCatalog('crah') : [
                { model: 'Stulz CyberAir 4 CFD 600 A (60kW)', capKw: 60 },
                { model: 'Stulz CyberAir 4 CFD 1000 A (100kW)', capKw: 100 },
                { model: 'Vertiv Liebert PCW 100kW EC Fan', capKw: 100 },
                { model: 'FanWall FW-150-EC (Network/AI Optim 150kW)', capKw: 150 }
            ];
            const crahUnit = {
                key: 'crah_unit',
                label: 'CRAH / Fanwall 機房空調',
                category: 'CRAH',
                catalog: crahCat,
                selectedModel: 'Stulz CyberAir 4 CFD 600 A (60kW)',
                unitCapKw: 60,
                selectedQty: minCrahUnits + 1,
                requiredKw: reqKw,
                requiredUnitsN1: minCrahUnits + 1
            };

            const pumpKw = pumpPowerKw || 5.0;
            const pumpCat = (typeof CatalogManager !== 'undefined') ? CatalogManager.getCatalog('pump') : [
                { model: 'Grundfos TPE 3.0kW Inverter Pump', capKw: 3.0 },
                { model: 'Grundfos TPE 5.5kW Inverter Pump (標準)', capKw: 5.5 },
                { model: 'Armstrong Design Envelope 11.0kW', capKw: 11.0 }
            ];
            const pumpUnit = {
                key: 'fw_pump',
                label: 'Secondary CHW Pump 二次側冰水循環水泵',
                category: 'Pump',
                catalog: pumpCat,
                selectedModel: pumpKw <= 3.5 ? 'Grundfos TPE 3.0kW Inverter Pump' : (pumpKw <= 6.0 ? 'Grundfos TPE 5.5kW Inverter Pump (標準)' : 'Armstrong Design Envelope 11.0kW'),
                unitCapKw: pumpKw <= 3.5 ? 3.0 : (pumpKw <= 6.0 ? 5.5 : 11.0),
                selectedQty: 2, // 1用1備 (N+1)
                requiredKw: pumpKw,
                requiredUnitsN1: 2
            };

            const chillerAirCat = (typeof CatalogManager !== 'undefined') ? CatalogManager.getCatalog('chiller_air') : [
                { model: 'Carrier 30XA 150kW Screw Air-Cooled', capKw: 150 },
                { model: 'Carrier 30XA 300kW Screw Air-Cooled (標準)', capKw: 300 },
                { model: 'York YVAA 500kW VFD Screw Air-Cooled', capKw: 500 }
            ];
            const chillerWaterCat = (typeof CatalogManager !== 'undefined') ? CatalogManager.getCatalog('chiller_water') : [
                { model: 'Carrier 23XRV Variable-Speed Screw 350kW', capKw: 350 },
                { model: 'Trane RTHD Water-Cooled Screw 500kW (標準)', capKw: 500 },
                { model: 'York YZ Magnetic Bearing Centrifugal 800kW', capKw: 800 }
            ];

            if (arch === 'rdhx') {
                const rdhxCat = (typeof CatalogManager !== 'undefined') ? CatalogManager.getCatalog('rdhx') : [
                    { model: 'Stulz CyberDoor RDHX 35kW', capKw: 35 },
                    { model: 'Motivair ChilledDoor 45kW Active RDHX', capKw: 45 },
                    { model: 'Vertiv Geist RDHX 60kW (標準)', capKw: 60 },
                    { model: 'High-Density RDHX 80kW MegaDoor', capKw: 80 }
                ];
                const minRdhxUnits = Math.max(1, Math.ceil(reqKw / 60));
                const rdhxUnit = {
                    key: 'rdhx_unit',
                    label: 'RDHX 背板式熱交換器 (Rear Door HX)',
                    category: 'RDHX',
                    catalog: rdhxCat,
                    selectedModel: 'Vertiv Geist RDHX 60kW (標準)',
                    unitCapKw: 60,
                    selectedQty: minRdhxUnits + 1,
                    requiredKw: reqKw,
                    requiredUnitsN1: minRdhxUnits + 1
                };
                const minChillerUnits = Math.max(1, Math.ceil(reqKw / 300));
                return [
                    rdhxUnit,
                    {
                        key: 'air_cooled_chiller',
                        label: 'Air-Cooled Chiller 氣冷式冰水主機',
                        category: 'Chiller',
                        catalog: chillerAirCat,
                        selectedModel: 'Carrier 30XA 300kW Screw Air-Cooled (標準)',
                        unitCapKw: 300,
                        selectedQty: minChillerUnits + 1,
                        requiredKw: reqKw,
                        requiredUnitsN1: minChillerUnits + 1
                    },
                    pumpUnit
                ];
            } else if (arch === 'air_cooled_chiller') {
                const minChillerUnits = Math.max(1, Math.ceil(reqKw / 300));
                return [
                    crahUnit,
                    {
                        key: 'air_cooled_chiller',
                        label: 'Air-Cooled Chiller 氣冷式冰水主機',
                        category: 'Chiller',
                        catalog: chillerAirCat,
                        selectedModel: 'Carrier 30XA 300kW Screw Air-Cooled (標準)',
                        unitCapKw: 300,
                        selectedQty: minChillerUnits + 1,
                        requiredKw: reqKw,
                        requiredUnitsN1: minChillerUnits + 1
                    },
                    pumpUnit
                ];
            } else if (arch === 'water_cooled_chiller' || arch === 'water_cooled_chiller_tower') {
                const minChillerUnits = Math.max(1, Math.ceil(reqKw / 400));
                const minCtUnits = Math.max(1, Math.ceil(reqKw * 1.2 / 600));
                const ctCat = (typeof CatalogManager !== 'undefined') ? CatalogManager.getCatalog('cooling_tower') : [
                    { model: 'BAC Series 3000 600kW', capKw: 600 },
                    { model: 'BAC Series 3000 1200kW (標準)', capKw: 1200 }
                ];
                return [
                    crahUnit,
                    {
                        key: 'water_cooled_chiller',
                        label: 'Water-Cooled Chiller 水冷式冰水主機',
                        category: 'Chiller',
                        catalog: chillerWaterCat,
                        selectedModel: 'Trane RTHD Water-Cooled Screw 500kW (標準)',
                        unitCapKw: 500,
                        selectedQty: minChillerUnits + 1,
                        requiredKw: reqKw,
                        requiredUnitsN1: minChillerUnits + 1
                    },
                    {
                        key: 'cooling_tower',
                        label: 'Cooling Tower 冰機散熱冷卻水塔',
                        category: 'CoolingTower',
                        catalog: ctCat,
                        selectedModel: 'BAC Series 3000 600kW',
                        unitCapKw: 600,
                        selectedQty: minCtUnits + 1,
                        requiredKw: reqKw * 1.2,
                        requiredUnitsN1: minCtUnits + 1
                    },
                    pumpUnit
                ];
            } else if (arch === 'chilled_water_plant' || arch === 'campus_chilled_water') {
                const hxCat = (typeof CatalogManager !== 'undefined') ? CatalogManager.getCatalog('heat_exchanger') : [
                    { model: 'Alfa Laval M10 Plate HX 500kW', capKw: 500 },
                    { model: 'Alfa Laval M15 Plate HX 1000kW (標準)', capKw: 1000 }
                ];
                return [
                    crahUnit,
                    {
                        key: 'plant_decoupler_hx',
                        label: 'Central Plant Decoupler / 廠務冰水介面',
                        category: 'Decoupler',
                        catalog: hxCat,
                        selectedModel: 'Alfa Laval M10 Plate HX 500kW',
                        unitCapKw: 500,
                        selectedQty: 2,
                        requiredKw: reqKw,
                        requiredUnitsN1: 2
                    },
                    pumpUnit
                ];
            }

            return [crahUnit, pumpUnit];
        },

        updateSelectedEquipment(targetId, sysType, equipKey, model, qty) {
            let targetObj = null;
            this.state.halls.forEach(h => {
                const d = h.dus.find(du => du.id === targetId);
                if (d) targetObj = d;
            });
            if (!targetObj) {
                targetObj = this.state.corePods.find(p => p.id === targetId);
            }
            if (!targetObj) return;

            const sys = (sysType === 'cdu') ? targetObj.plantDesign.cduSystem : targetObj.plantDesign.fanwallSystem;
            const item = (sys.sizing || []).find(s => s.key === equipKey);
            if (item) {
                if (model !== undefined) item.selectedModel = model;
                if (qty !== undefined) item.selectedQty = parseInt(qty, 10);
                this.notify();
            }
        },

        // v31 修正：localStorage 還原的舊專案裡，sizing[].catalog 是產生當下的靜態快照，
        // 新增/更新 device_catalog 廠商資料後不會自動反映。此函式只替換 catalog 選項清單，
        // 保留使用者已選的 selectedModel/selectedQty，讓舊專案重新整理頁面就能看到新型號。
        refreshDeviceCatalogs() {
            if (typeof CatalogManager === 'undefined') return;

            const KEY_TO_CATEGORY = {
                cdu_unit: 'cdu',
                cdu_pump: 'pump',
                fw_pump: 'pump',
                dry_cooler: 'dry_cooler',
                adiabatic_tower: 'cooling_tower',
                cooling_tower: 'cooling_tower',
                heat_exchanger: 'heat_exchanger',
                plant_decoupler_hx: 'heat_exchanger',
                water_cooled_chiller: 'chiller_water',
                air_cooled_chiller: 'chiller_air',
                trim_chiller: 'chiller_water',
                crah_unit: 'crah',
                rdhx_unit: 'rdhx'
            };

            const refreshSys = (sys) => {
                if (!sys || !Array.isArray(sys.sizing)) return;
                sys.sizing.forEach(item => {
                    const catKey = KEY_TO_CATEGORY[item.key];
                    if (!catKey) return;
                    const freshCatalog = CatalogManager.getCatalog(catKey);
                    if (freshCatalog && freshCatalog.length) item.catalog = freshCatalog;
                });
            };

            this.state.halls.forEach(h => {
                h.dus.forEach(du => {
                    refreshSys(du.plantDesign?.cduSystem);
                    refreshSys(du.plantDesign?.fanwallSystem);
                });
            });
            this.state.corePods.forEach(pod => {
                refreshSys(pod.plantDesign?.cduSystem);
                refreshSys(pod.plantDesign?.fanwallSystem);
            });
        },

        canProceedStep4() {
            let allPassed = true;
            const failedItems = [];

            const checkSys = (name, targetId, sys, isCdu) => {
                (sys.sizing || []).forEach(item => {
                    if (!item.passed) {
                        allPassed = false;
                        failedItems.push({
                            targetId: targetId,
                            targetName: name,
                            systemName: isCdu ? '💧 CDU 液冷' : '💨 Fanwall 氣冷',
                            equipName: item.label,
                            reqText: item.requiredText,
                            selText: item.selectedQty + '台 (有效 ' + (item.effectiveCapKw !== undefined ? item.effectiveCapKw : (item.selectedQty * item.unitCapKw)) + ' kW / N-1)'
                        });
                    }
                });
            };

            this.state.halls.forEach(h => {
                h.dus.forEach(du => {
                    checkSys(h.name + ' - ' + du.name, du.id, du.plantDesign.cduSystem, true);
                    checkSys(h.name + ' - ' + du.name, du.id, du.plantDesign.fanwallSystem, false);
                });
            });

            this.state.corePods.filter(p => p.enabled).forEach(pod => {
                checkSys(pod.name, pod.id, pod.plantDesign.cduSystem, true);
                checkSys(pod.name, pod.id, pod.plantDesign.fanwallSystem, false);
            });

            return { ok: allPassed, failedItems };
        },

        // ═══════════════════════════════════════════════════════════════
        // v31 Phase 1: 設備選型接入計算 — 把 sizing[] 選定的真實冰機型號/COP/台數
        // 轉成 ChillerEngine.calcPower() 要的陣列格式。找不到真實 COP 資料(型錄
        // 缺欄位、尚未選型)時回傳空陣列，呼叫端會退回舊有的固定比例近似值，
        // 不會用假資料硬算。
        // ═══════════════════════════════════════════════════════════════
        // v32 Phase 9-1: Installed(selectedQty，含N+1備援) 與 Running(實際運轉)
        // 必須分開 — 備援機組全年待機不運轉、不耗電、不貢獻容量。沿用本專案
        // 既有的 effectiveCapKw = (selectedQty - 1) * unitCapKw 這個 N+1 慣例
        // (1台備援)，qty_running 用同一個公式，讓「容量夠不夠判定」跟「實際
        // 耗電量計算」用同一套備援假設，不再各算各的。
        runningQtyFromSelected(selectedQty) {
            return Math.max(1, (selectedQty || 1) - 1);
        },

        // v35: 管徑/流速改用真實水力公式 V=Q/A 挑選，取代先前寫死的
        // 「flow > 門檻 → 固定流速值」對照表(那組流速數字跟 DN 完全無關，
        // 只是配 DN 一起硬編碼的裝飾數字，UI 卻拿它打「符合防腐標準」)。
        // DN 對照表用標稱值(mm)近似當內徑，逐級找出流速落在 ≤2.5 m/s 的最小管徑。
        PIPE_DN_TABLE_MM: [65, 80, 100, 125, 150, 200, 250, 300, 350, 400],
        selectPipeDnAndVelocity(flowLpm) {
            const table = this.PIPE_DN_TABLE_MM;
            if (!flowLpm || flowLpm <= 0) return { pipe_dn: 'DN' + table[0], velocity_mps: 0 };
            const flow_m3s = flowLpm / 60000;
            for (const dn of table) {
                const area_m2 = Math.PI * (dn / 1000) ** 2 / 4;
                const v = flow_m3s / area_m2;
                if (v <= 2.5) return { pipe_dn: 'DN' + dn, velocity_mps: Math.round(v * 100) / 100 };
            }
            const lastDn = table[table.length - 1];
            const area_m2 = Math.PI * (lastDn / 1000) ** 2 / 4;
            return { pipe_dn: 'DN' + lastDn, velocity_mps: Math.round((flow_m3s / area_m2) * 100) / 100 };
        },

        resolveChillerFromSizing(item, chillerType) {
            if (!item || !item.selectedQty) return [];
            const catEntry = (item.catalog || []).find(c => c.model === item.selectedModel);
            const capKw = catEntry?.capKw ?? item.unitCapKw;
            const cop = catEntry?.cop;
            if (!capKw || !cop) return [];
            return [{
                model: item.selectedModel,
                cooling_capacity_kw: capKw,
                cop_design: cop,
                t_chws_design: catEntry?.t_chws_c ?? 7.0,
                cop_curve: catEntry?.cop_curve, // 有真實 AHRI 曲線資料時 ChillerEngine 會自動採用，否則退回 flat COP
                qty_running: this.runningQtyFromSelected(item.selectedQty),
                qty_total: item.selectedQty,
                chiller_type: chillerType
            }];
        },

        // v31 Phase 2: 泵浦 → PlantPumpEngine.calcPower() 要的陣列格式。
        // 型錄 pump 分類目前只有 capKw(=額定馬達功率)，尚無額定流量/揚程資料，
        // 先用 capKw 當 power_kw 近似（比原本跟熱負載硬綁的比例公式更貼近真實選型）。
        resolvePumpFromSizing(item) {
            if (!item || !item.selectedQty) return [];
            const catEntry = (item.catalog || []).find(c => c.model === item.selectedModel);
            const powerKw = catEntry?.capKw ?? item.unitCapKw;
            if (!powerKw) return [];
            return [{ model: item.selectedModel, power_kw: powerKw, qty_running: this.runningQtyFromSelected(item.selectedQty), qty_total: item.selectedQty }];
        },

        // v31 Phase 2: CDU 主機 → CDUEngine.calcPower() 要的陣列格式（型錄需同時有 capKw 與 powerKw）。
        resolveCduFromSizing(item) {
            if (!item || !item.selectedQty) return [];
            const catEntry = (item.catalog || []).find(c => c.model === item.selectedModel);
            const capKw = catEntry?.capKw ?? item.unitCapKw;
            const powerKw = catEntry?.powerKw;
            if (!capKw || !powerKw) return [];
            return [{ model: item.selectedModel, capacity_kw: capKw, power_kw: powerKw, qty_running: this.runningQtyFromSelected(item.selectedQty), qty_total: item.selectedQty }];
        },

        // v31 Phase 2: CRAH/RDHX 機組 → CRAHEngine.calcPower() 要的陣列格式（型錄需同時有 capKw 與 fanPowerKw）。
        resolveCrahFromSizing(item) {
            if (!item || !item.selectedQty) return [];
            const catEntry = (item.catalog || []).find(c => c.model === item.selectedModel);
            const capKw = catEntry?.capKw ?? item.unitCapKw;
            const fanPowerKw = catEntry?.fanPowerKw;
            if (!capKw || !fanPowerKw) return [];
            return [{ model: item.selectedModel, cooling_capacity_kw: capKw, power_kw: fanPowerKw, qty_running: this.runningQtyFromSelected(item.selectedQty), qty_total: item.selectedQty }];
        },

        // v31 Phase 2/3: 冷卻塔/乾冷器風扇 → CoolingTowerEngine.calcFanPower() 要的陣列格式（型錄需有 fanKwDx）。
        // fanKwFc 優先用型錄真實值(device_catalog 廠商規格書已有部分機型提供)，
        // 缺乏時才退回 dx 風扇功率的一半概估。
        resolveTowerFromSizing(item) {
            if (!item || !item.selectedQty) return [];
            const catEntry = (item.catalog || []).find(c => c.model === item.selectedModel);
            const fanKwDx = catEntry?.fanKwDx;
            if (!fanKwDx) return [];
            return [{
                model: item.selectedModel,
                fan_kw_dx: fanKwDx,
                fan_kw_fc: catEntry?.fanKwFc ?? (fanKwDx * 0.5),
                qty_running: this.runningQtyFromSelected(item.selectedQty),
                qty_total: item.selectedQty,
                fan_control: 'vfd'
            }];
        },

        // ═══════════════════════════════════════════════════════════════
        // V22: 共用逐時能耗計算函式 — DU 與 CorePOD 共用同一套物理邏輯
        // ═══════════════════════════════════════════════════════════════
        calcHourlyEnergy(plantDesign, summ, w) {
            const cduSys = plantDesign.cduSystem;
            const fwSys  = plantDesign.fanwallSystem;
            const cduArch = cduSys.architecture || 'dry_cooler_hx';
            const evapFactor = 0.00124;
            const cycles = cduSys.cyclesOfConcentration || 5;

            // === CDU 液冷系統 (以 Step 4 水溫設定為唯一基準) ===
            const cduApproach = cduSys.dryCoolerApproachC || 5.0;
            const pheApproach = (cduArch === 'dry_cooler_trim' || cduArch === 'dry_cooler_hx') ? (cduSys.pheApproachC ?? 2.0) : 0.0;
            const freeThresh = cduSys.fwsSupplyC - cduApproach - pheApproach;
            const mechThresh = freeThresh + 5.7;

            // v31 Phase 2: CDU主機本身 + 一次側循環泵，一律先用 Step4 選定的真實設備算，
            // 找不到型錄資料(capKw/powerKw)時退回原本的熱負載比例近似值。
            const designLiqKw = cduSys.designBasis?.liq_load_kw || summ.liquidHeatKw;
            const cduLoadRatio = designLiqKw > 0 ? Math.min(1.0, summ.liquidHeatKw / designLiqKw) : 1.0;
            const cduOperatingMode = (typeof FreeCoolingEngine !== 'undefined') ? FreeCoolingEngine.getOperatingMode(w.wb) : null;
            const cduPumpMinSpeed = (typeof FreeCoolingEngine !== 'undefined')
                ? FreeCoolingEngine.getPumpMinSpeed(cduOperatingMode)
                : 0.45;
            const cduPumpSpeed = Math.max(cduPumpMinSpeed, cduLoadRatio);
            const cduFanMinSpeed = (typeof FreeCoolingEngine !== 'undefined')
                ? FreeCoolingEngine.getCtFanMinSpeed(cduOperatingMode)
                : 0.20;

            const cduUnitItem = (cduSys.sizing || []).find(s => s.key === 'cdu_unit');
            const cduUnits = this.resolveCduFromSizing(cduUnitItem);
            const cduUnitKw = (cduUnits.length > 0 && typeof CDUEngine !== 'undefined' && summ.liquidHeatKw > 0)
                ? CDUEngine.calcPower(cduUnits, summ.liquidHeatKw).power_kw
                : (summ.liquidHeatKw / 400) * 2.0;

            const cduPumpItem = (cduSys.sizing || []).find(s => s.key === 'cdu_pump');
            const cduPumps = this.resolvePumpFromSizing(cduPumpItem);
            const cduPrimaryPumpKw = (cduPumps.length > 0 && typeof PlantPumpEngine !== 'undefined' && summ.liquidHeatKw > 0)
                ? PlantPumpEngine.calcPower(cduPumps, cduPumpSpeed)
                : (summ.liquidHeatKw / 500) * (cduSys.hydraulics?.pump_power_kw || 11.0);

            const cduPumpKw = cduUnitKw + cduPrimaryPumpKw;
            let cduHeatRejKw = 0;
            let cduChillerKw = 0;
            let waterM3 = 0;
            let isFreeHour = false;
            let cduMode = 'free';
            let fwMode = 'free';
            // v32 Phase 9-3: 累計冰機容量不足缺口 (ChillerEngine.calcPower 內建的
            // CHILLER_CAPACITY_DEFICIT warning，PLR>1.02 時才觸發)，供 Dashboard
            // 顯示「此結果可能低估」的警示，不讓容量不足悄悄變成一個好看的低 PUE。
            let capacityDeficitKw = 0;
            const trackChillerDeficit = (chRes) => {
                if (chRes && chRes.warnings && chRes.warnings.length) {
                    capacityDeficitKw += chRes.warnings.reduce((s, x) => s + (x.deficit_kw || 0), 0);
                }
                return chRes;
            };

            if (summ.liquidHeatKw > 0) {
                if (cduArch === 'dry_cooler_pure') {
                    // 純乾冷器自然冷卻模式 (零冰機) — 嚴格物理檢核氣候超溫與冷量不足
                    const dcItem = (cduSys.sizing || []).find(s => s.key === 'dry_cooler');
                    const dcDevices = this.resolveTowerFromSizing(dcItem);
                    const isFc = w.db <= freeThresh;
                    const dcFanKw = (dcDevices.length > 0 && typeof CoolingTowerEngine !== 'undefined')
                        ? CoolingTowerEngine.calcFanPower(dcDevices, cduLoadRatio, isFc, cduFanMinSpeed)
                        : null;
                    const fanRatio = Math.max(0.2, Math.min(1.0, (w.db + 273.15) / (freeThresh + 273.15)));
                    cduHeatRejKw += dcFanKw ?? ((summ.liquidHeatKw / 500) * 8.0 * fanRatio);
                    isFreeHour = isFc;
                    cduMode = isFc ? 'free' : 'partial';
                    // 當外氣大於門檻且無冰機時，觸發氣候水溫超標 (Thermal Deficit)
                    if (!isFc) {
                        const actualSupplyC = w.db + cduApproach + pheApproach;
                        const tempOvershoot = actualSupplyC - cduSys.fwsSupplyC;
                        const unservedRatio = Math.min(1.0, tempOvershoot / Math.max(1.0, cduSys.fwsReturnC - cduSys.fwsSupplyC));
                        capacityDeficitKw += Math.round(summ.liquidHeatKw * unservedRatio);
                    }
                } else if (cduArch === 'dry_cooler_trim' || cduArch === 'dry_cooler_hx') {
                    // NVIDIA DSX 標準混合三模式 (乾冷器預冷 + 串聯修整冰機)
                    const dcFc = (typeof FreeCoolingEngine !== 'undefined')
                        ? FreeCoolingEngine.calcDryCoolerFC(w.db, { dry_cooler_approach_c: cduApproach, hx_approach_c: pheApproach, t_supply_cdu_c: cduSys.fwsSupplyC })
                        : null;
                    const dcIsFullFc = dcFc ? (dcFc.mode === FreeCoolingEngine.MODE.FULL_FC) : (w.db <= freeThresh);
                    const dcChillerFraction = dcFc ? dcFc.chiller_fraction : (w.db <= mechThresh ? 0 : 1);

                    const dcItem = (cduSys.sizing || []).find(s => s.key === 'dry_cooler');
                    const dcDevices = this.resolveTowerFromSizing(dcItem);
                    const dcFanKw = (dcDevices.length > 0 && typeof CoolingTowerEngine !== 'undefined')
                        ? CoolingTowerEngine.calcFanPower(dcDevices, cduLoadRatio, dcIsFullFc, cduFanMinSpeed)
                        : null;
                    if (dcIsFullFc) {
                        const fanRatio = Math.max(0.15, Math.min(1.0, (w.db + 273.15) / (freeThresh + 273.15)));
                        cduHeatRejKw += dcFanKw ?? ((summ.liquidHeatKw / 500) * 8.0 * fanRatio);
                        isFreeHour = true;
                        cduMode = 'free';
                    } else {
                        cduHeatRejKw += dcFanKw ?? ((summ.liquidHeatKw / 500) * 15.0);
                        const trimItem = (cduSys.sizing || []).find(s => s.key === 'trim_chiller');
                        const trimChillers = this.resolveChillerFromSizing(trimItem, 'water_cooled');
                        const trimLoadKw = summ.liquidHeatKw * dcChillerFraction;
                        if (trimChillers.length > 0 && typeof ChillerEngine !== 'undefined' && trimLoadKw > 0) {
                            const staging = ChillerEngine.calcLeadLagStaging(trimLoadKw, trimChillers);
                            const minCewt = (typeof A === 'function') ? A('min_cewt_c') : 16.0;
                            const T_cewt = Math.max(minCewt, w.db + (cduSys.cduApproachC || 5.0));
                            const chRes = trackChillerDeficit(ChillerEngine.calcPower(trimLoadKw, staging.staged, cduSys.fwsSupplyC, T_cewt, w.db));
                            cduChillerKw += chRes.power_kw;
                        } else if (trimLoadKw > 0) {
                            const trimCop = trimItem?.catalog?.find(c => c.model === trimItem.selectedModel)?.cop || 6.2;
                            cduChillerKw += trimLoadKw / trimCop;
                        }
                        cduMode = (dcChillerFraction < 1.0) ? 'partial' : 'mechanical';
                    }
                } else if (cduArch === 'adiabatic_tower') {
                    // BAC TrilliumSeries 絕熱冷卻塔 (Adiabatic Tower) — 100% 自然排熱 (零冰機)
                    // 運作原理：
                    // 1. 乾球溫 ≤ 乾式切換點 (Dry Switchpoint, 約 T_supply - 9°C ~ 31°C) 時：100% 乾式運轉，噴水泵關閉，0 耗水。
                    // 2. 乾球溫 > 乾式切換點時：開啟噴水泵潤濕預冷墊片，利用絕熱蒸發將進風溫降至有效乾球溫，此時產生蒸發耗水與排污耗水。
                    const satEff = (cduSys.adiabaticSaturationEfficiencyPct || 85) / 100;
                    const drySwitchpoint = cduSys.adiabaticDrySwitchpointC || Math.max(26.0, (cduSys.fwsSupplyC || 40.0) - 9.2);
                    const atItem = (cduSys.sizing || []).find(s => s.key === 'adiabatic_tower');
                    const atDevices = this.resolveTowerFromSizing(atItem);
                    const isDry = w.db <= drySwitchpoint;
                    const atFanKw = (atDevices.length > 0 && typeof CoolingTowerEngine !== 'undefined')
                        ? CoolingTowerEngine.calcFanPower(atDevices, cduLoadRatio, isDry, cduFanMinSpeed)
                        : null;
                    let effectiveDb;
                    if (isDry) {
                        // 純乾式運轉模式 (0 耗水)
                        cduHeatRejKw += atFanKw ?? ((summ.liquidHeatKw / 500) * 7.5);
                        effectiveDb = w.db;
                    } else {
                        // 絕熱噴霧預冷模式 (依 BAC 絕熱預冷熱平衡計算耗水量)
                        cduHeatRejKw += atFanKw ?? ((summ.liquidHeatKw / 500) * 11.0);
                        // 噴水泵額外功耗 (約 0.25 kW/台，或負載之 0.03%)
                        cduHeatRejKw += (summ.liquidHeatKw * 0.0003);

                        // 蒸發量計算：當乾球超出切換點時，噴霧蒸發降溫所需水量
                        const deltaT = Math.max(0.5, w.db - drySwitchpoint);
                        const maxWetDepression = Math.max(1.0, (w.db - w.wb) * satEff);
                        const wetFraction = Math.min(1.0, Math.max(0.2, deltaT / maxWetDepression));
                        // 依 BAC 實測數據：15MW 在台北夏季尖峰蒸發量約 1.2~1.5 m3/h per MW，年均約 0.4~0.6 L/kWh per wetted hour
                        const evapRatePerKw = evapFactor * 0.45 * wetFraction;
                        const evap = summ.liquidHeatKw * evapRatePerKw;
                        const bd = evap / Math.max(1.0, cycles - 1);
                        waterM3 += (evap + bd);
                        // 絕熱預冷後的「有效乾球溫」= 濕球溫 + (1-飽和效率)*(乾球-濕球)，
                        // 對應 BAC TrilliumSeries 選型報告的物理模型：噴霧只能讓進風溫逼近
                        // 濕球溫(依飽和效率打折)，不是逼近乾球溫，所以絕熱模式終究被濕球溫度卡住
                        // (BAC 選型報告的 Reserve Capability / Maximum Heat Rejection at 0% Reserve
                        // 就是在講這件事)。
                        effectiveDb = w.db - (w.db - w.wb) * satEff;
                    }
                    // v44: 之前這裡完全沒有像 dry_cooler_pure 一樣做「外氣超出冷卻能力」的
                    // 超標判定，導致不管天氣多熱多濕，模型永遠假設絕熱塔成功達到設計供水溫，
                    // 在濕熱氣候(如高雄)這會讓 PUE 被系統性低估。改成比照 dry_cooler_pure 的
                    // 判定方式，只是溫度基準換成絕熱預冷後的 effectiveDb (受濕球限制)，
                    // 而不是原始乾球溫。
                    const atActualSupplyC = effectiveDb + (cduSys.dryCoolerApproachC || 5.0) + pheApproach;
                    const atExceeded = atActualSupplyC > cduSys.fwsSupplyC;
                    if (atExceeded) {
                        const atTempOvershoot = atActualSupplyC - cduSys.fwsSupplyC;
                        const atUnservedRatio = Math.min(1.0, atTempOvershoot / Math.max(1.0, cduSys.fwsReturnC - cduSys.fwsSupplyC));
                        capacityDeficitKw += Math.round(summ.liquidHeatKw * atUnservedRatio);
                    }
                    isFreeHour = !atExceeded; // 供水溫實際達標時才計為完全自由冷卻
                    cduMode = atExceeded ? 'partial' : 'free';
                } else if (cduArch === 'cooling_tower_hx') {
                    // 密閉式冷卻水塔 (Closed-Circuit Cooling Tower) — 100% 濕球蒸發自然冷卻 (零冰機)
                    const ctItem = (cduSys.sizing || []).find(s => s.key === 'cooling_tower');
                    const ctDevices = this.resolveTowerFromSizing(ctItem);
                    const isLowFan = w.wb <= (cduSys.fwsSupplyC - 8.0);
                    const ctFanKw = (ctDevices.length > 0 && typeof CoolingTowerEngine !== 'undefined')
                        ? CoolingTowerEngine.calcFanPower(ctDevices, cduLoadRatio, isLowFan, cduFanMinSpeed)
                        : null;
                    cduHeatRejKw += ctFanKw ?? ((summ.liquidHeatKw / 500) * (isLowFan ? 8.0 : 12.0));
                    const evap = summ.liquidHeatKw * evapFactor;
                    const bd = evap / (cycles - 1);
                    waterM3 += (evap + bd);
                    // v44: 同 adiabatic_tower 的修正 — 密閉式冷卻水塔的冷卻能力終究被濕球溫度
                    // 卡住(供水溫 ≈ WB + 密閉式塔approach，approach通常比開放式塔高，因為多一層
                    // 盤管熱交換)，之前完全沒做超標判定，等於假設濕球溫度再高都能達標。
                    const ctApproach = cduSys.ctApproachC ?? 6.0;
                    const ctActualSupplyC = w.wb + ctApproach;
                    const ctExceeded = ctActualSupplyC > cduSys.fwsSupplyC;
                    if (ctExceeded) {
                        const ctTempOvershoot = ctActualSupplyC - cduSys.fwsSupplyC;
                        const ctUnservedRatio = Math.min(1.0, ctTempOvershoot / Math.max(1.0, cduSys.fwsReturnC - cduSys.fwsSupplyC));
                        capacityDeficitKw += Math.round(summ.liquidHeatKw * ctUnservedRatio);
                    }
                    isFreeHour = !ctExceeded; // 供水溫實際達標時才計為完全自由冷卻
                    cduMode = ctExceeded ? 'partial' : 'free';
                } else if (cduArch === 'water_chiller') {
                    // V24 Phase 3: 全額水冷式冰水主機 + 濕式冷卻塔（需計算散熱塔耗水量）
                    // v31 Phase 1/2: 冰機耗電與冷卻塔風扇一律先用 Step4 選定的真實設備算，
                    // T_cewt 用氣象濕球溫 + 冷卻塔 approach 概估（完整冷卻塔熱平衡模型留待 Phase 3）。
                    const wcTowerItem = (cduSys.sizing || []).find(s => s.key === 'cooling_tower');
                    const wcTowerDevices = this.resolveTowerFromSizing(wcTowerItem);
                    cduHeatRejKw += (wcTowerDevices.length > 0 && typeof CoolingTowerEngine !== 'undefined')
                        ? CoolingTowerEngine.calcFanPower(wcTowerDevices, cduLoadRatio, false, cduFanMinSpeed)
                        : (summ.liquidHeatKw / 500) * 14.0;
                    const cduChillerItem = (cduSys.sizing || []).find(s => s.key === 'water_chiller');
                    const cduChillers = this.resolveChillerFromSizing(cduChillerItem, 'water_cooled');
                    let cduChillerPowerKwThisHour;
                    if (cduChillers.length > 0 && typeof ChillerEngine !== 'undefined') {
                        const towerApproach = (typeof A === 'function') ? A('tower_approach_c') : 4.0;
                        const minCewt = (typeof A === 'function') ? A('min_cewt_c') : 16.0;
                        const T_cewt = Math.max(minCewt, w.wb + towerApproach);
                        const staging = ChillerEngine.calcLeadLagStaging(summ.liquidHeatKw, cduChillers);
                        const chRes = trackChillerDeficit(ChillerEngine.calcPower(summ.liquidHeatKw, staging.staged, cduSys.fwsSupplyC, T_cewt, w.db));
                        cduChillerPowerKwThisHour = chRes.power_kw;
                    } else {
                        cduChillerPowerKwThisHour = summ.liquidHeatKw / 5.5; // 尚未選型或型錄缺COP資料時的保守近似值
                    }
                    cduChillerKw += cduChillerPowerKwThisHour;
                    cduMode = 'mechanical';
                    // v41 fix: 冷卻水塔實際要排的熱是「冰水負載 + 冰機壓縮機耗電」(冷凝器熱)，
                    // 不是只有冰水負載本身 — 壓縮機耗電最終也是靠冷卻水塔蒸發排掉的熱，
                    // 之前漏算這塊會讓全額水冷架構的耗水量/WUE系統性低估。
                    const wcHeatRejKw = summ.liquidHeatKw + cduChillerPowerKwThisHour;
                    const evap = wcHeatRejKw * evapFactor;
                    const bd = evap / (cycles - 1);
                    waterM3 += (evap + bd);
                } else {
                    cduHeatRejKw += (summ.liquidHeatKw / 500) * 14.0;
                    cduChillerKw += summ.liquidHeatKw / 5.5;
                    cduMode = 'mechanical';
                }
            }

            // === Fanwall / RDHX 氣冷系統 ===
            const fwChwIn = fwSys.chwSupplyC || 12.0;
            const fwBaseCop = fwChwIn >= 20 ? 5.8 : (fwChwIn >= 12 ? 4.2 : 3.0);
            const airHeatTotal = summ.airHeatKw + summ.lossKw;
            const fwArch = fwSys.architecture || 'air_cooled_chiller';

            // v31 Phase 2: CRAH/RDHX 機組風扇 + 二次側循環泵，一律先用 Step4 選定的真實設備算，
            // 找不到型錄資料時退回原本 RDHX ~2% / CRAH ~8% 功耗比的近似值。
            const designAirKw = fwSys.designBasis?.air_load_kw || airHeatTotal;
            const fwLoadRatio = designAirKw > 0 ? Math.min(1.0, airHeatTotal / designAirKw) : 1.0;

            const fwUnitKey = fwArch === 'rdhx' ? 'rdhx_unit' : 'crah_unit';
            const fwUnitItem = (fwSys.sizing || []).find(s => s.key === fwUnitKey);
            const fwUnits = this.resolveCrahFromSizing(fwUnitItem);
            const crahFanKw = (fwUnits.length > 0 && typeof CRAHEngine !== 'undefined' && airHeatTotal > 0)
                ? CRAHEngine.calcPower(fwUnits, airHeatTotal).power_kw
                : ((fwArch === 'rdhx') ? (airHeatTotal / 60) * 1.2 : (airHeatTotal / 60) * 4.8);

            const fwPumpItem = (fwSys.sizing || []).find(s => s.key === 'fw_pump');
            const fwPumps = this.resolvePumpFromSizing(fwPumpItem);
            const fwOperatingMode = (typeof FreeCoolingEngine !== 'undefined') ? FreeCoolingEngine.getOperatingMode(w.wb) : null;
            const fwPumpMinSpeed = (typeof FreeCoolingEngine !== 'undefined')
                ? FreeCoolingEngine.getPumpMinSpeed(fwOperatingMode)
                : 0.45;
            const fwPumpSpeed = Math.max(fwPumpMinSpeed, fwLoadRatio);
            const fwFanMinSpeed = (typeof FreeCoolingEngine !== 'undefined')
                ? FreeCoolingEngine.getCtFanMinSpeed(fwOperatingMode)
                : 0.20;
            const fwPumpKw = (fwPumps.length > 0 && typeof PlantPumpEngine !== 'undefined' && airHeatTotal > 0)
                ? PlantPumpEngine.calcPower(fwPumps, fwPumpSpeed)
                : 0; // 舊版本從未計入此項，找不到型錄資料時維持 0（不新增未經驗證的假設值）

            let fwChillerKw = 0;
            // v42 fix: fwRejKw 之前把 fwPumpKw 當初始值疊加進去，等於把 Fanwall 二次側泵浦
            // 耗電歸進「散熱(heatRejKw)」，導致 pPUE(刻意排除泵浦耗電)其實還是漏網跑進了
            // fwPumpKw。改成泵浦獨立累計，不再摻進 fwRejKw/heatRejKw。
            let fwRejKw = 0;

            // v31 Phase 1: 氣冷/水冷冰機一律先算出 Step4 選定的真實設備陣列，
            // 找不到真實COP資料時 chillers 為空陣列，各分支會退回舊有固定COP近似值。
            const fwAirChillerItem = (fwSys.sizing || []).find(s => s.key === 'air_cooled_chiller');
            const fwAirChillers = this.resolveChillerFromSizing(fwAirChillerItem, 'air_cooled');
            const fwWaterChillerItem = (fwSys.sizing || []).find(s => s.key === 'water_cooled_chiller');
            const fwWaterTowerApproach = (typeof A === 'function') ? A('tower_approach_c') : 4.0;
            const fwWaterChillers = this.resolveChillerFromSizing(fwWaterChillerItem, 'water_cooled');

            if (airHeatTotal > 0) {
                if (fwArch === 'rdhx') {
                    // RDHX 背板式熱交換器 (氣-液背板換熱 + 氣冷冰機)
                    if (w.db <= (fwSys.airSideEconomizerThresholdC || 18)) {
                        fwRejKw += airHeatTotal * 0.03;
                        if (!isFreeHour) isFreeHour = true;
                        fwMode = 'free';
                    } else if (fwAirChillers.length > 0 && typeof ChillerEngine !== 'undefined') {
                        const staging = ChillerEngine.calcLeadLagStaging(airHeatTotal, fwAirChillers);
                        const chRes = trackChillerDeficit(ChillerEngine.calcPower(airHeatTotal, staging.staged, fwSys.chwSupplyC || 12.0, undefined, w.db));
                        fwChillerKw += chRes.power_kw;
                        fwRejKw += (airHeatTotal / 500) * 8.0;
                        fwMode = 'mechanical';
                    } else {
                        fwChillerKw += airHeatTotal / fwBaseCop;
                        fwRejKw += (airHeatTotal / 500) * 8.0;
                        fwMode = 'mechanical';
                    }
                } else if (fwArch === 'water_cooled_chiller' || fwArch === 'water_cooled_chiller_tower') {
                    // 水冷式冰水主機 + 濕式冷卻塔
                    // v32 Phase 9-2: 同上，改用 FreeCoolingEngine.calcCoolingTowerFC() 統一判定。
                    const fwFc = (typeof FreeCoolingEngine !== 'undefined')
                        ? FreeCoolingEngine.calcCoolingTowerFC(w.wb, fwWaterTowerApproach, { t_supply_cdu_c: fwSys.chwSupplyC || 12.0 })
                        : null;
                    const fwIsFullFc = fwFc ? (fwFc.mode === FreeCoolingEngine.MODE.FULL_FC) : (w.wb <= ((fwSys.chwSupplyC || 12.0) - 3.0 - 1.5));
                    const fwChillerFraction = fwFc ? fwFc.chiller_fraction : (fwIsFullFc ? 0 : 1);
                    const fwTowerItem = (fwSys.sizing || []).find(s => s.key === 'cooling_tower');
                    const fwTowerDevices = this.resolveTowerFromSizing(fwTowerItem);
                    const fwTowerFanKw = (fwTowerDevices.length > 0 && typeof CoolingTowerEngine !== 'undefined')
                        ? CoolingTowerEngine.calcFanPower(fwTowerDevices, fwLoadRatio, fwIsFullFc, fwFanMinSpeed)
                        : null;
                    if (fwIsFullFc) {
                        fwRejKw += fwTowerFanKw ?? (airHeatTotal * 0.04);
                        if (!isFreeHour) isFreeHour = true;
                        fwMode = 'free';
                    } else {
                        const fwChillerLoadKw = airHeatTotal * fwChillerFraction;
                        if (fwWaterChillers.length > 0 && typeof ChillerEngine !== 'undefined' && fwChillerLoadKw > 0) {
                            const minCewt = (typeof A === 'function') ? A('min_cewt_c') : 16.0;
                            const T_cewt = Math.max(minCewt, w.wb + fwWaterTowerApproach);
                            const staging = ChillerEngine.calcLeadLagStaging(fwChillerLoadKw, fwWaterChillers);
                            const chRes = trackChillerDeficit(ChillerEngine.calcPower(fwChillerLoadKw, staging.staged, fwSys.chwSupplyC || 12.0, T_cewt, w.db));
                            fwChillerKw += chRes.power_kw;
                        } else if (fwChillerLoadKw > 0) {
                            fwChillerKw += fwChillerLoadKw / fwBaseCop;
                        }
                        fwRejKw += fwTowerFanKw ?? ((airHeatTotal / 500) * 14.0);
                        fwMode = (fwChillerFraction < 1.0) ? 'partial' : 'mechanical';
                    }
                    const fwEvap = airHeatTotal * evapFactor;
                    const fwBd = fwEvap / (cycles - 1);
                    waterM3 += (fwEvap + fwBd);
                } else if (fwArch === 'chilled_water_plant' || fwArch === 'campus_chilled_water') {
                    // 廠區集中冰水管網 — 冷卻能耗由外部中央冷站承擔，此處僅計 CRAH 風扇與集中冷站分配
                    fwChillerKw += airHeatTotal / 5.0; // 集中冷站 COP 通常較高，且無 Step4 可選設備可綁定
                    fwMode = 'mechanical';
                } else {
                    // 預設: air_cooled_chiller 氣冷式冰水主機
                    if (w.db <= (fwSys.airSideEconomizerThresholdC || 18)) {
                        fwRejKw += airHeatTotal * 0.05;
                        fwMode = 'free';
                    } else if (fwAirChillers.length > 0 && typeof ChillerEngine !== 'undefined') {
                        const staging = ChillerEngine.calcLeadLagStaging(airHeatTotal, fwAirChillers);
                        const chRes = trackChillerDeficit(ChillerEngine.calcPower(airHeatTotal, staging.staged, fwSys.chwSupplyC || 12.0, undefined, w.db));
                        fwChillerKw += chRes.power_kw;
                        fwMode = 'mechanical';
                    } else {
                        fwChillerKw += airHeatTotal / fwBaseCop;
                        fwMode = 'mechanical';
                    }
                }
            }

            const combinedMode = (cduMode === 'free' && fwMode === 'free')
                ? 'free'
                : ((cduMode === 'mechanical' && fwMode === 'mechanical') ? 'mechanical' : 'partial');

            return {
                // v42 fix: 這個欄位是「全廠泵浦耗電(pPUE刻意排除的那塊)」的加總，不是只有CDU一次泵，
                // 名稱沿用 cduPumpKw 是為了不動到所有既有呼叫端(duKwh/podKwh/hourlyFacilityStats
                // 都用這個欄位名稱)，但實際值 = CDU一次泵 + Fanwall二次側泵。
                cduPumpKw: cduPumpKw + fwPumpKw,
                crahFanKw,
                heatRejKw: cduHeatRejKw + fwRejKw,
                chillerKw: cduChillerKw + fwChillerKw,
                lossKw: summ.lossKw,
                waterM3,
                isFreeHour,
                capacityDeficitKw,
                cduMode,
                fwMode,
                combinedMode,
                // Phase 4: CDU vs Fanwall 拆分
                cduKwh: { pump: cduPumpKw, heatRej: cduHeatRejKw, chiller: cduChillerKw },
                fwKwh:  { pump: fwPumpKw, crahFan: crahFanKw, heatRej: fwRejKw, chiller: fwChillerKw }
            };
        },

        // ═══════════════════════════════════════════════════════════════
        // 自由冷卻動態物理門檻統一查詢 (Single Source of Truth)
        // ═══════════════════════════════════════════════════════════════
        getEffectiveFcThresholds() {
            let plantFcThresh = 34.8;
            const allCduSystems = [
                ...(this.state.halls ? this.state.halls.flatMap(h => h.dus.map(d => d.plantDesign.cduSystem)) : []),
                ...(this.state.corePods ? this.state.corePods.map(p => p.plantDesign.cduSystem) : [])
            ];
            if (allCduSystems.length > 0) {
                const minFc = Math.min(...allCduSystems.map(c => {
                    const arch = c.architecture || 'dry_cooler_hx';
                    const dcApp = c.dryCoolerApproachC || 5.0;
                    const pheApp = (arch === 'dry_cooler_trim' || arch === 'dry_cooler_hx') ? (c.pheApproachC ?? 2.0) : 0.0;
                    return (c.fwsSupplyC || 40.0) - dcApp - pheApp;
                }));
                plantFcThresh = minFc;
            }
            if (this.state.assumptions_override?.nvidia_dsx_mode1_db_max_c !== undefined) {
                plantFcThresh = this.state.assumptions_override.nvidia_dsx_mode1_db_max_c;
            }
            const mode1 = Number(plantFcThresh.toFixed(1));
            const mode2 = (this.state.assumptions_override?.nvidia_dsx_mode2_db_max_c !== undefined)
                ? Number(this.state.assumptions_override.nvidia_dsx_mode2_db_max_c.toFixed(1))
                : Number((mode1 + 5.7).toFixed(1));
            return { mode1DbMax: mode1, mode2DbMax: mode2 };
        },

        calculate() {
            this.recalculateBinAnalysis();
            this.state.results = this.state.results || {};
            const hourlyWeather = (this.state.site.hourly && this.state.site.hourly.length >= 8760) 
                ? this.state.site.hourly 
                : this.generateFallbackWeather();

            // 動態分析全廠冷卻架構與排熱模式 (以 Step 4 為唯一真理源)
            const allCduSystems = [
                ...this.state.halls.flatMap(h => h.dus.map(d => d.plantDesign.cduSystem)),
                ...this.state.corePods.map(p => p.plantDesign.cduSystem)
            ];
            const allCduArchs = allCduSystems.map(c => c.architecture || 'dry_cooler_hx');
            const isAllZeroChiller = allCduArchs.length > 0 && allCduArchs.every(a => a === 'dry_cooler_pure' || a === 'adiabatic_tower' || a === 'cooling_tower_hx');
            const isAllFullChiller = allCduArchs.length > 0 && allCduArchs.every(a => a === 'water_chiller');

            const fcThresh = this.getEffectiveFcThresholds();
            const mode1DbMax = fcThresh.mode1DbMax;
            const mode2DbMax = fcThresh.mode2DbMax;

            let climateFreeCount = 0, climateTrimCount = 0, climateMechCount = 0;
            for (let i = 0; i < 8760; i++) {
                const w = hourlyWeather[i] || { db: 25, wb: 20 };
                if (isAllZeroChiller) {
                    // v45 fix: 之前這裡不管實際天氣，零冰機架構一律算成自由冷卻，導致「氣候FC
                    // 潛力」儀表板無論案場多熱都顯示100%。改成跟下面 hourlyProfile mode 分類
                    // 迴圈(1975行附近)同一套邏輯 — 依真實外氣DB對比門檻，超標算「輔助/需注意」。
                    if (w.db <= mode1DbMax) {
                        climateFreeCount++;
                    } else {
                        climateTrimCount++;
                    }
                } else if (isAllFullChiller) {
                    climateMechCount++;
                } else if (w.db <= mode1DbMax) {
                    climateFreeCount++;
                } else if (w.db <= mode2DbMax) {
                    climateTrimCount++;
                } else {
                    climateMechCount++;
                }
            }
            this.state.results.fcPotential = {
                freeHours: climateFreeCount,
                freeHoursPct: parseFloat(((climateFreeCount / 8760) * 100).toFixed(1)),
                trimHours: climateTrimCount,
                trimHoursPct: parseFloat(((climateTrimCount / 8760) * 100).toFixed(1)),
                mechanicalHours: climateMechCount,
                mechanicalHoursPct: parseFloat(((climateMechCount / 8760) * 100).toFixed(1))
            };

            const facilityLossPct = this.state.facilityElectricalLossPct ?? 0.0;
            const byDuResults = [];
            let totalAllItKw = 0;
            let totalAllWaterM3 = 0;
            let overallKwh = { it: 0, cduPump: 0, crahFan: 0, heatRejection: 0, chiller: 0, loss: 0 };
            let monthlyStats = Array.from({ length: 12 }, () => ({ totalKwh: 0, itKwh: 0, coolKwh: 0 }));
            const hourlyFacilityStats = Array.from({ length: 8760 }, () => ({
                itKw: 0,
                totalKw: 0,
                coolingNoPumpKw: 0,
                cduPumpKw: 0,
                chillerKw: 0,
                cduMode: 'free',
                fwMode: 'free'
            }));

            this.state.halls.forEach(hall => {
                hall.dus.forEach(du => {
                    const duSumm = this.calcDuSummary(du);
                    const duLossKw = duSumm.totalItKw * (facilityLossPct / 100);
                    totalAllItKw += duSumm.totalItKw;

                    this.bridgeDuToPlantModel(du, duSumm);

                    const cduSys = du.plantDesign.cduSystem;
                    const fwSys = du.plantDesign.fanwallSystem;
                    const cduArch = cduSys.architecture || 'dry_cooler_hx';
                    const fwArch = fwSys.architecture || 'air_cooled_chiller';

                    let duKwh = { it: 0, cduPump: 0, crahFan: 0, heatRejection: 0, chiller: 0, loss: 0 };
                    let duCduKwh = { pump: 0, heatRej: 0, chiller: 0 }; // Phase 4
                    let duFwKwh  = { crahFan: 0, heatRej: 0, chiller: 0 }; // Phase 4
                    let duWaterM3 = 0;
                    let duFcHours = 0;
                    let duDeficitHours = 0;
                    let duMaxDeficitKw = 0;

                    // V22: 使用共用函式跑 8760h 逐時迴圈
                    for (let i = 0; i < 8760; i++) {
                        const w = hourlyWeather[i] || { db: 25, wb: 20 };
                        const mIdx = hourToMonth(i);
                        const hr = this.calcHourlyEnergy(du.plantDesign, duSumm, w);

                        duKwh.it += duSumm.totalItKw;
                        duKwh.cduPump += hr.cduPumpKw;
                        duKwh.crahFan += hr.crahFanKw;
                        duKwh.heatRejection += hr.heatRejKw;
                        duKwh.chiller += hr.chillerKw;
                        duKwh.loss += duLossKw;
                        duWaterM3 += hr.waterM3;
                        if (hr.isFreeHour) duFcHours++;
                        if (hr.capacityDeficitKw > 0) {
                            duDeficitHours++;
                            if (hr.capacityDeficitKw > duMaxDeficitKw) duMaxDeficitKw = hr.capacityDeficitKw;
                        }

                        // Phase 4: CDU vs Fanwall 拆分累計
                        duCduKwh.pump    += hr.cduKwh.pump;
                        duCduKwh.heatRej += hr.cduKwh.heatRej;
                        duCduKwh.chiller += hr.cduKwh.chiller;
                        duFwKwh.crahFan  += hr.fwKwh.crahFan;
                        duFwKwh.heatRej  += hr.fwKwh.heatRej;
                        duFwKwh.chiller  += hr.fwKwh.chiller;

                        const hourCoolingNoPump = hr.crahFanKw + hr.heatRejKw + hr.chillerKw;
                        const hourCooling = hr.cduPumpKw + hourCoolingNoPump;
                        const hourTotal = duSumm.totalItKw + hourCooling + duLossKw;
                        monthlyStats[mIdx].totalKwh += hourTotal;
                        monthlyStats[mIdx].itKwh += duSumm.totalItKw;
                        monthlyStats[mIdx].coolKwh += hourCooling;

                        hourlyFacilityStats[i].itKw += duSumm.totalItKw;
                        hourlyFacilityStats[i].totalKw += hourTotal;
                        hourlyFacilityStats[i].coolingNoPumpKw += hourCoolingNoPump;
                        hourlyFacilityStats[i].cduPumpKw += hr.cduPumpKw;
                        hourlyFacilityStats[i].chillerKw += hr.chillerKw;

                        if (hr.cduMode === 'mechanical' || (hr.cduMode === 'partial' && hourlyFacilityStats[i].cduMode !== 'mechanical')) {
                            hourlyFacilityStats[i].cduMode = hr.cduMode;
                        }
                        if (hr.fwMode === 'mechanical' || (hr.fwMode === 'partial' && hourlyFacilityStats[i].fwMode !== 'mechanical')) {
                            hourlyFacilityStats[i].fwMode = hr.fwMode;
                        }
                    }

                    const duTotalFacKwh = duKwh.it + duKwh.cduPump + duKwh.crahFan + duKwh.heatRejection + duKwh.chiller + duKwh.loss;
                    const duPue = duKwh.it > 0 ? (duTotalFacKwh / duKwh.it).toFixed(3) : '1.000';
                    const duItKwh = duKwh.it;
                    const duWue = duItKwh > 0 ? ((duWaterM3 * 1000) / duItKwh).toFixed(3) : '0.000';

                    byDuResults.push({
                        duId: du.id,
                        duName: du.name,
                        hallName: hall.name,
                        cduArchitecture: cduArch,
                        cduSupplyTemp: cduSys.fwsSupplyC,
                        cduReturnTemp: cduSys.fwsReturnC,
                        fwArchitecture: fwArch,
                        fwSupplyTemp: fwSys.chwSupplyC,
                        totalItKw: duSumm.totalItKw,
                        liquidHeatKw: duSumm.liquidHeatKw,
                        airHeatKw: duSumm.airHeatKw,
                        lossKw: duLossKw,
                        dlcPct: duSumm.dlcPct,
                        annualPue: parseFloat(duPue),
                        annualWue: parseFloat(duWue),
                        annualWaterM3: Math.round(duWaterM3),
                        annualTotalMwh: Math.round(duTotalFacKwh / 1000),
                        annualItMwh: Math.round(duKwh.it / 1000),
                        fcHours: duFcHours,
                        deficitHours: duDeficitHours,
                        maxDeficitKw: Math.round(duMaxDeficitKw),
                        // Phase 4: CDU vs Fanwall 系統能耗拆分
                        cduSystemMwh: Math.round((duCduKwh.pump + duCduKwh.heatRej + duCduKwh.chiller) / 1000),
                        fwSystemMwh: Math.round((duFwKwh.crahFan + duFwKwh.heatRej + duFwKwh.chiller) / 1000),
                        // v29 Excel計算書: 逐分項真實能耗 (取代匯出模組原本的假比例推算)
                        cduPumpMwh: Math.round(duKwh.cduPump / 1000),
                        crahFanMwh: Math.round(duKwh.crahFan / 1000),
                        heatRejectionMwh: Math.round(duKwh.heatRejection / 1000),
                        chillerMwh: Math.round(duKwh.chiller / 1000),
                        lossMwh: Math.round(duKwh.loss / 1000)
                    });

                    totalAllWaterM3 += duWaterM3;
                    overallKwh.it += duKwh.it;
                    overallKwh.cduPump += duKwh.cduPump;
                    overallKwh.crahFan += duKwh.crahFan;
                    overallKwh.heatRejection += duKwh.heatRejection;
                    overallKwh.chiller += duKwh.chiller;
                    overallKwh.loss += duKwh.loss;
                });
            });

            // 3. 彙總 CorePODs (V22 Phase 1 & 2: 8,760h 逐時模擬與共用物理計算)
            const byCorePodResults = [];
            let totalCorePodItKw = 0;
            let totalCorePodTotalKwh = 0;
            let totalCorePodItKwh = 0;
            let totalCorePodWaterM3 = 0;

            this.state.corePods.filter(p => p.enabled).forEach(pod => {
                const ps = this.calcCorePodSummary(pod);
                const podLossKw = ps.totalItKw * (facilityLossPct / 100);
                this.bridgeDuToPlantModel(pod, ps);
                totalCorePodItKw += ps.totalItKw;
                totalAllItKw += ps.totalItKw;

                const cduSys = pod.plantDesign.cduSystem;
                const fwSys = pod.plantDesign.fanwallSystem;
                const cduArch = cduSys.architecture || 'dry_cooler_hx';
                const fwArch = fwSys.architecture || 'air_cooled_chiller';

                let podKwh = { it: 0, cduPump: 0, crahFan: 0, heatRejection: 0, chiller: 0, loss: 0 };
                let podCduKwh = { pump: 0, heatRej: 0, chiller: 0 };
                let podFwKwh  = { crahFan: 0, heatRej: 0, chiller: 0 };
                let podWaterM3 = 0;
                let podFcHours = 0;
                let podDeficitHours = 0;
                let podMaxDeficitKw = 0;

                for (let i = 0; i < 8760; i++) {
                    const w = hourlyWeather[i] || { db: 25, wb: 20 };
                    const mIdx = hourToMonth(i);
                    const hr = this.calcHourlyEnergy(pod.plantDesign, ps, w);

                    podKwh.it += ps.totalItKw;
                    podKwh.cduPump += hr.cduPumpKw;
                    podKwh.crahFan += hr.crahFanKw;
                    podKwh.heatRejection += hr.heatRejKw;
                    podKwh.chiller += hr.chillerKw;
                    podKwh.loss += podLossKw;
                    podWaterM3 += hr.waterM3;
                    if (hr.isFreeHour) podFcHours++;
                    if (hr.capacityDeficitKw > 0) {
                        podDeficitHours++;
                        if (hr.capacityDeficitKw > podMaxDeficitKw) podMaxDeficitKw = hr.capacityDeficitKw;
                    }

                    // Phase 4: CDU vs Fanwall 拆分
                    podCduKwh.pump    += hr.cduKwh.pump;
                    podCduKwh.heatRej += hr.cduKwh.heatRej;
                    podCduKwh.chiller += hr.cduKwh.chiller;
                    podFwKwh.crahFan  += hr.fwKwh.crahFan;
                    podFwKwh.heatRej  += hr.fwKwh.heatRej;
                    podFwKwh.chiller  += hr.fwKwh.chiller;

                    const hourCoolingNoPump = hr.crahFanKw + hr.heatRejKw + hr.chillerKw;
                    const hourCooling = hr.cduPumpKw + hourCoolingNoPump;
                    const hourTotal = ps.totalItKw + hourCooling + podLossKw;
                    monthlyStats[mIdx].totalKwh += hourTotal;
                    monthlyStats[mIdx].itKwh += ps.totalItKw;
                    monthlyStats[mIdx].coolKwh += hourCooling;

                    hourlyFacilityStats[i].itKw += ps.totalItKw;
                    hourlyFacilityStats[i].totalKw += hourTotal;
                    hourlyFacilityStats[i].coolingNoPumpKw += hourCoolingNoPump;
                    hourlyFacilityStats[i].cduPumpKw += hr.cduPumpKw;
                    hourlyFacilityStats[i].chillerKw += hr.chillerKw;

                    if (hr.cduMode === 'mechanical' || (hr.cduMode === 'partial' && hourlyFacilityStats[i].cduMode !== 'mechanical')) {
                        hourlyFacilityStats[i].cduMode = hr.cduMode;
                    }
                    if (hr.fwMode === 'mechanical' || (hr.fwMode === 'partial' && hourlyFacilityStats[i].fwMode !== 'mechanical')) {
                        hourlyFacilityStats[i].fwMode = hr.fwMode;
                    }
                }

                const podTotalFacKwh = podKwh.it + podKwh.cduPump + podKwh.crahFan + podKwh.heatRejection + podKwh.chiller + podKwh.loss;
                const podPue = podKwh.it > 0 ? (podTotalFacKwh / podKwh.it).toFixed(3) : '1.000';
                const podItKwh = podKwh.it;
                const podWue = podItKwh > 0 ? ((podWaterM3 * 1000) / podItKwh).toFixed(3) : '0.000';

                byCorePodResults.push({
                    podId: pod.id,
                    podName: pod.name,
                    cduArchitecture: cduArch,
                    cduSupplyTemp: cduSys.fwsSupplyC,
                    cduReturnTemp: cduSys.fwsReturnC,
                    fwArchitecture: fwArch,
                    fwSupplyTemp: fwSys.chwSupplyC,
                    totalItKw: ps.totalItKw,
                    liquidHeatKw: ps.liquidHeatKw,
                    airHeatKw: ps.airHeatKw,
                    lossKw: podLossKw,
                    dlcPct: ps.dlcPct,
                    annualPue: parseFloat(podPue),
                    annualWue: parseFloat(podWue),
                    annualWaterM3: Math.round(podWaterM3),
                    annualTotalMwh: Math.round(podTotalFacKwh / 1000),
                    annualItMwh: Math.round(podKwh.it / 1000),
                    fcHours: podFcHours,
                    deficitHours: podDeficitHours,
                    maxDeficitKw: Math.round(podMaxDeficitKw),
                    // Phase 4: CDU vs Fanwall 系統能耗拆分
                    cduSystemMwh: Math.round((podCduKwh.pump + podCduKwh.heatRej + podCduKwh.chiller) / 1000),
                    fwSystemMwh: Math.round((podFwKwh.crahFan + podFwKwh.heatRej + podFwKwh.chiller) / 1000),
                    // v29 Excel計算書: 逐分項真實能耗
                    cduPumpMwh: Math.round(podKwh.cduPump / 1000),
                    crahFanMwh: Math.round(podKwh.crahFan / 1000),
                    heatRejectionMwh: Math.round(podKwh.heatRejection / 1000),
                    chillerMwh: Math.round(podKwh.chiller / 1000),
                    lossMwh: Math.round(podKwh.loss / 1000)
                });

                totalAllWaterM3 += podWaterM3;
                totalCorePodTotalKwh += podTotalFacKwh;
                totalCorePodItKwh += podKwh.it;
                totalCorePodWaterM3 += podWaterM3;

                overallKwh.it += podKwh.it;
                overallKwh.cduPump += podKwh.cduPump;
                overallKwh.crahFan += podKwh.crahFan;
                overallKwh.heatRejection += podKwh.heatRejection;
                overallKwh.chiller += podKwh.chiller;
                overallKwh.loss += podKwh.loss;
            });

            const overallTotalKwh = overallKwh.it + overallKwh.cduPump + overallKwh.crahFan + overallKwh.heatRejection + overallKwh.chiller + overallKwh.loss;
            const overallPue = overallKwh.it > 0 ? (overallTotalKwh / overallKwh.it).toFixed(3) : '1.000';
            const overallP_Pue = overallKwh.it > 0 ? ((overallKwh.it + overallKwh.crahFan + overallKwh.heatRejection + overallKwh.chiller) / overallKwh.it).toFixed(3) : '1.000'; // A-1 fix: pPUE 僅含冷卻能耗，不含泵能
            const overallWue = overallKwh.it > 0 ? ((totalAllWaterM3 * 1000) / overallKwh.it).toFixed(3) : '0.000';

            // V26: 8,760h 瞬時尖峰 PUE 與尖峰 pPUE 追蹤 (最惡劣工況)
            let maxPue = 1.0, maxP_Pue = 1.0;
            let peakMonth = 1, peakHour = 0;
            for (let i = 0; i < 8760; i++) {
                const it = hourlyFacilityStats[i].itKw;
                if (it > 0) {
                    const hPue = hourlyFacilityStats[i].totalKw / it;
                    const hP_Pue = (it + hourlyFacilityStats[i].coolingNoPumpKw) / it;
                    if (hPue > maxPue) {
                        maxPue = hPue;
                        peakMonth = hourToMonth(i) + 1;
                        peakHour = i % 24;
                    }
                    if (hP_Pue > maxP_Pue) {
                        maxP_Pue = hP_Pue;
                    }
                }
            }

            const corePodGroupPue = totalCorePodItKwh > 0 ? parseFloat((totalCorePodTotalKwh / totalCorePodItKwh).toFixed(3)) : 1.000;
            const corePodGroupWue = totalCorePodItKwh > 0 ? parseFloat(((totalCorePodWaterM3 * 1000) / totalCorePodItKwh).toFixed(3)) : 0.000;

            // v32 Phase 9-3: 彙整各 DU/CorePod 的冰機容量不足小時數/尖峰缺口，
            // 讓 Dashboard 能警示「此結果的PUE可能被低估」，而不是悄悄放行。
            const allUnitDeficitHours = [...byDuResults, ...byCorePodResults].map(r => r.deficitHours || 0);
            const allUnitMaxDeficitKw = [...byDuResults, ...byCorePodResults].map(r => r.maxDeficitKw || 0);
            const overallDeficitHours = allUnitDeficitHours.length ? Math.max(...allUnitDeficitHours) : 0;
            const overallMaxDeficitKw = allUnitMaxDeficitKw.length ? Math.max(...allUnitMaxDeficitKw) : 0;

            const hvacTotalKwh = overallKwh.cduPump + overallKwh.crahFan + overallKwh.heatRejection + overallKwh.chiller;
            const totalGenHeatKwh = overallKwh.it + overallKwh.loss;
            // v32 Phase 9-8: 用「未四捨五入」的 lossKw(kW，非之前重建自四捨五入 lossMwh 的近似值)，
            // 讓 liquid_heat_kwh/air_heat_kwh 是從 byDu/byCorePod 逐項獨立重新加總算出來的，
            // 跟 overallKwh 是兩條不同的計算路徑 — 這才是真正有意義的 double-entry 交叉驗證，
            // 不是「反正這個值本來就等於那個值」的套套邏輯。
            const totalLiquidHeatKwh = byDuResults.reduce((s, d) => s + (d.liquidHeatKw * 8760), 0) + byCorePodResults.reduce((s, p) => s + (p.liquidHeatKw * 8760), 0);
            const totalAirHeatKwh = byDuResults.reduce((s, d) => s + (((d.airHeatKw || 0) + (d.lossKw || 0)) * 8760), 0) + byCorePodResults.reduce((s, p) => s + (((p.airHeatKw || 0) + (p.lossKw || 0)) * 8760), 0);
            const totalHeatRemovedKwh = totalLiquidHeatKwh + totalAirHeatKwh;
            const thermalImbalanceKwh = totalGenHeatKwh - totalHeatRemovedKwh;
            // 相對容差(百萬分之一)取代絕對 1e-3，因為年度熱量常是百萬 kWh 等級的數字，
            // 絕對容差在這個量級下沒有意義；同時保留一個很小的絕對下限應付近零負載的極端情況。
            const thermalTolKwh = Math.max(1e-3, Math.abs(totalGenHeatKwh) * 1e-6);
            const thermalIsBalanced = Math.abs(thermalImbalanceKwh) < thermalTolKwh;

            // v32 Phase 9-8: Hydraulic Ledger 目前仍缺真實流量/揚程型錄資料(Pump P=Q·ΔP/η
            // 模型待補，見 GPT稽核 Claim 2)，因此不假裝已有完整水力平衡驗證。這裡改成一個
            // 誠實但有限的健全性檢查：泵浦能耗不得為負值，且只要有任何液冷/氣冷熱負載，
            // 對應的泵浦能耗就必須 > 0（沒有泵在跑，冷卻迴路不可能真的循環）。
            const totalPumpEnergyKwh = overallKwh.cduPump;
            const hasAnyCoolingLoad = (totalLiquidHeatKwh + totalAirHeatKwh) > 0;
            const hydraulicIsOk = totalPumpEnergyKwh >= 0 && (!hasAnyCoolingLoad || totalPumpEnergyKwh > 0);

            const energyLedger = {
                it_kwh: overallKwh.it,
                hvac_kwh: hvacTotalKwh,
                loss_kwh: overallKwh.loss,
                facility_total_kwh: overallTotalKwh,
                cdu_pump_kwh: overallKwh.cduPump,
                crah_fan_kwh: overallKwh.crahFan,
                heat_rejection_kwh: overallKwh.heatRejection,
                chiller_kwh: overallKwh.chiller,
                is_balanced: Math.abs(overallTotalKwh - (overallKwh.it + hvacTotalKwh + overallKwh.loss)) < 1e-3
            };

            const thermalLedger = {
                it_heat_kwh: overallKwh.it,
                loss_heat_kwh: overallKwh.loss,
                total_heat_generated_kwh: totalGenHeatKwh,
                liquid_heat_kwh: totalLiquidHeatKwh,
                air_heat_kwh: totalAirHeatKwh,
                total_heat_removed_kwh: totalHeatRemovedKwh,
                imbalance_kwh: thermalImbalanceKwh,
                is_balanced: thermalIsBalanced
            };

            const hydraulicLedger = {
                total_pump_energy_kwh: totalPumpEnergyKwh,
                // 誠實標示這只是健全性檢查，不是完整水力帳本(還缺流量/揚程/效率模型)
                note: 'partial_sanity_check_only_no_flow_head_model_yet',
                is_hydraulic_ok: hydraulicIsOk
            };

            // 8,760h 全年逐時時序資料 (支援 CDU、Fanwall 與全廠綜合多維度熱力圖)
            let cduFreeHours = 0, cduPartialHours = 0, cduMechHours = 0;
            let fwFreeHours = 0, fwPartialHours = 0, fwMechHours = 0;
            let combinedFreeHours = 0, combinedPartialHours = 0, combinedMechHours = 0;
            const hourlyProfile = [];

            for (let i = 0; i < 8760; i++) {
                const w = hourlyWeather[i] || { db: 25, wb: 20 };
                const it = hourlyFacilityStats[i].itKw;
                const tot = hourlyFacilityStats[i].totalKw;
                const chKw = hourlyFacilityStats[i].chillerKw || 0;
                const coolKw = (hourlyFacilityStats[i].coolingNoPumpKw || 0) + (hourlyFacilityStats[i].cduPumpKw || 0);
                const pue = it > 0 ? parseFloat((tot / it).toFixed(3)) : 1.0;

                const cduMode = hourlyFacilityStats[i].cduMode || 'free';
                const fwMode = hourlyFacilityStats[i].fwMode || (chKw > 0 ? 'mechanical' : 'free');
                const combinedMode = (cduMode === 'free' && fwMode === 'free')
                    ? 'free'
                    : ((cduMode === 'mechanical' && fwMode === 'mechanical') ? 'mechanical' : 'partial');

                if (cduMode === 'free') cduFreeHours++;
                else if (cduMode === 'partial') cduPartialHours++;
                else cduMechHours++;

                if (fwMode === 'free') fwFreeHours++;
                else if (fwMode === 'partial') fwPartialHours++;
                else fwMechHours++;

                if (combinedMode === 'free') combinedFreeHours++;
                else if (combinedMode === 'partial') combinedPartialHours++;
                else combinedMechHours++;

                hourlyProfile.push({
                    hourIndex: i,
                    month: hourToMonth(i) + 1,
                    dayOfYear: Math.floor(i / 24) + 1,
                    hourOfDay: i % 24,
                    db: w.db,
                    wb: w.wb,
                    itKw: Math.round(it),
                    pue: pue,
                    mode: cduMode, // default compatibility
                    cduMode: cduMode,
                    fwMode: fwMode,
                    combinedMode: combinedMode,
                    chillerKw: Math.round(chKw),
                    cduPumpKw: Math.round(hourlyFacilityStats[i].cduPumpKw || 0),
                    coolingKw: Math.round(coolKw),
                    totalKw: Math.round(tot)
                });
            }

            this.state.results = {
                cduFcStats: {
                    freeHours: cduFreeHours,
                    freeHoursPct: parseFloat(((cduFreeHours / 8760) * 100).toFixed(1)),
                    partialHours: cduPartialHours,
                    partialHoursPct: parseFloat(((cduPartialHours / 8760) * 100).toFixed(1)),
                    mechHours: cduMechHours,
                    mechHoursPct: parseFloat(((cduMechHours / 8760) * 100).toFixed(1))
                },
                fwFcStats: {
                    freeHours: fwFreeHours,
                    freeHoursPct: parseFloat(((fwFreeHours / 8760) * 100).toFixed(1)),
                    partialHours: fwPartialHours,
                    partialHoursPct: parseFloat(((fwPartialHours / 8760) * 100).toFixed(1)),
                    mechHours: fwMechHours,
                    mechHoursPct: parseFloat(((fwMechHours / 8760) * 100).toFixed(1))
                },
                combinedFcStats: {
                    freeHours: combinedFreeHours,
                    freeHoursPct: parseFloat(((combinedFreeHours / 8760) * 100).toFixed(1)),
                    partialHours: combinedPartialHours,
                    partialHoursPct: parseFloat(((combinedPartialHours / 8760) * 100).toFixed(1)),
                    mechHours: combinedMechHours,
                    mechHoursPct: parseFloat(((combinedMechHours / 8760) * 100).toFixed(1))
                },
                overall: {
                    annualPue: parseFloat(overallPue),
                    annualP_Pue: parseFloat(overallP_Pue),
                    peakPue: parseFloat(maxPue.toFixed(3)),
                    peakP_Pue: parseFloat(maxP_Pue.toFixed(3)),
                    peakMonth: peakMonth,
                    peakHour: peakHour,
                    annualWue: parseFloat(overallWue),
                    annualWaterM3: Math.round(totalAllWaterM3),
                    totalItKw: totalAllItKw,
                    annualTotalMwh: Math.round(overallTotalKwh / 1000),
                    annualItMwh: Math.round(overallKwh.it / 1000),
                    fcHours: cduFreeHours,
                    fcHoursPct: parseFloat(((cduFreeHours / 8760) * 100).toFixed(1)),
                    freeModeHours: cduFreeHours,
                    partialModeHours: cduPartialHours,
                    mechModeHours: cduMechHours,
                    capacityDeficitHours: overallDeficitHours,
                    maxCapacityDeficitKw: overallMaxDeficitKw,
                    breakdownKwh: overallKwh,
                    energyLedger,
                    thermalLedger,
                    hydraulicLedger
                },
                byDu: byDuResults,
                byCorePod: byCorePodResults,
                corePodGroup: {
                    annualPue: corePodGroupPue,
                    annualWue: corePodGroupWue,
                    totalItKw: totalCorePodItKw,
                    annualTotalMwh: Math.round(totalCorePodTotalKwh / 1000),
                    annualItMwh: Math.round(totalCorePodItKwh / 1000),
                    annualWaterM3: Math.round(totalCorePodWaterM3)
                },
                fcPotential: {
                    freeHours: cduFreeHours,
                    freeHoursPct: parseFloat(((cduFreeHours / 8760) * 100).toFixed(1)),
                    trimHours: cduPartialHours,
                    trimHoursPct: parseFloat(((cduPartialHours / 8760) * 100).toFixed(1)),
                    mechanicalHours: cduMechHours,
                    mechanicalHoursPct: parseFloat(((cduMechHours / 8760) * 100).toFixed(1))
                },
                monthlyPue: monthlyStats.map((m, idx) => ({
                    month: idx + 1,
                    pue: parseFloat((m.totalKwh / (m.itKwh || 1)).toFixed(3)),
                    coolingMwh: Math.round(m.coolKwh / 1000)
                })),
                hourlyProfile: hourlyProfile
            };
        },

        bridgeDuToPlantModel(du, duSumm) {
            const cduSys = du.plantDesign.cduSystem;
            const fwSys = du.plantDesign.fanwallSystem;

            // 1. CDU 液冷系統
            cduSys.designBasis = {
                liq_load_kw: duSumm.liquidHeatKw,
                dlc_ratio: duSumm.dlcPct
            };

            const dT_cdu = Math.max(1.0, (cduSys.fwsReturnC || 55) - (cduSys.fwsSupplyC || 40));
            const flowLpm_cdu = duSumm.liquidHeatKw > 0 ? Math.round((duSumm.liquidHeatKw * 60) / (4.186 * 1.0 * dT_cdu)) : 0;
            const pipeCdu = this.selectPipeDnAndVelocity(flowLpm_cdu);

            cduSys.hydraulics = {
                flow_lpm: flowLpm_cdu,
                pipe_dn: pipeCdu.pipe_dn,
                velocity_mps: pipeCdu.velocity_mps,
                pump_head_m: 28,
                // v35: 移除無物理來源的 +1.0 kW 假底載，flow=0 時泵浦功率就是 0
                pump_power_kw: Math.round(flowLpm_cdu > 0 ? (flowLpm_cdu * 28 * 9.81) / (60000 * 0.75 * 0.9) : 0)
            };

            const reqCduKw = duSumm.liquidHeatKw;

            // V21 依架構生成專屬 sizing 清單 (若品項不符則重置)
            const arch = cduSys.architecture || 'dry_cooler_hx';
            if (!cduSys.sizing || cduSys.sizing.length === 0 || cduSys.sizingArch !== arch) {
                cduSys.sizing = this.generateCduSizing(arch, reqCduKw, cduSys.hydraulics.pump_power_kw);
                cduSys.sizingArch = arch;
            }

            cduSys.sizing.forEach(s => {
                s.requiredKw = reqCduKw;
                if (s.key === 'cooling_tower' || s.key === 'heat_exchanger') s.requiredKw = reqCduKw * 1.2; // V25 fix: 保留 1.2 倍排熱裕度
                if (s.key === 'cdu_pump') s.requiredKw = cduSys.hydraulics.pump_power_kw;
                // v35 fix: Trim Chiller 依設計只需扛 NVIDIA Mode 2 修整負載(約35%尖峰)，
                // 不是扛全部液冷負載 — 之前這裡沒有排除 trim_chiller，導致它跟其他100%
                // 全額設備一樣被要求覆蓋 reqCduKw，逼使用者多買遠超過設計意圖的冰機容量。
                // 換算比例須與 generateCduSizing() 產生 trimReqKw 時用的 0.35 保持一致。
                if (s.key === 'trim_chiller') {
                    const fcThresh = (cduSys.fwsSupplyC || 40.0) - (cduSys.dryCoolerApproachC || 5.0) - (cduSys.pheApproachC ?? 2.0);
                    const peakDb = 38.0;
                    const dtSec = Math.max(1.0, (cduSys.secReturnC || 57.0) - (cduSys.secSupplyC || 45.0));
                    const peakRatio = (peakDb <= fcThresh) ? 0.35 : Math.min(1.0, Math.max(0.35, (peakDb - fcThresh) / dtSec));
                    s.requiredKw = Math.max(50, Math.round(reqCduKw * peakRatio));
                    s.peakRatio = peakRatio;
                    // v43: 「典型修整負載(peakRatio，多半落在35%附近)」跟「Mode 3 全機械製冷時
                    // 最大可能負擔(100%液冷負載)」是兩件不同的事——上面的 requiredKw/passed 只檢查
                    // 前者。這裡額外算一個不影響現有 passed 判定的「全機械最大需求」供 UI 額外顯示，
                    // 讓使用者自己看得到兩個數字，不會誤把「典型工況通過」當成「任何天氣都夠用」。
                    s.maxMechanicalKw = reqCduKw;
                }

                const curItem = s.catalog.find(c => c.model === s.selectedModel) || s.catalog[0];
                s.unitCapKw = curItem.capKw;
                s.requiredUnitsN1 = Math.max(2, Math.ceil(s.requiredKw / s.unitCapKw) + 1);
                s.effectiveCapKw = Math.max(0, s.selectedQty - 1) * s.unitCapKw;
                s.passed = (s.effectiveCapKw >= s.requiredKw) && (s.selectedQty >= 2);
                s.requiredText = '需求 ≥ ' + s.requiredKw.toFixed(1) + ' kW (N+1 最少 ' + s.requiredUnitsN1 + ' 台)';
                if (s.key === 'cdu_pump') {
                    s.passed = s.selectedQty >= 2 && (s.effectiveCapKw >= s.requiredKw * 0.9);
                    s.requiredText = '水力揚程需求 ' + s.requiredKw + ' kW (2用1備 N+1)';
                }
                if (s.key === 'trim_chiller') {
                    // v43: 獨立於上面 s.passed(典型修整負載) 之外的第二個資訊性檢查，不影響
                    // 既有 passed/N+1台數判定，只是把「全機械製冷(Mode 3)最大需求」這個數字
                    // 攤開給使用者看，實際是否會發生要看 Dashboard 的 capacityDeficitHours。
                    s.maxMechanicalPassed = s.effectiveCapKw >= s.maxMechanicalKw;
                }
            });

            // v35: 流速改用 selectPipeDnAndVelocity() 真實算出的值，不再是配 DN 寫死的裝飾數字，
            // 所以這裡的 ✓/✗ 也必須真的檢查算出來的流速是否落在合理範圍 (1.0~3.0 m/s)，
            // 不能再無條件打 ✓。
            const cduVelOk = pipeCdu.velocity_mps >= 1.0 && pipeCdu.velocity_mps <= 3.0;
            const trimChillerForCheck = cduSys.sizing.find(s => s.key === 'trim_chiller');
            cduSys.validation = {
                ok: cduSys.sizing.every(s => s.passed),
                checks: [
                    (cduSys.sizing[0].passed ? '✓' : '✗') + ' CDU 總有效容量 ' + cduSys.sizing[0].effectiveCapKw + ' kW (N-1) ' + (cduSys.sizing[0].passed ? '滿足' : '不足！'),
                    (cduSys.sizing[1] ? ((cduSys.sizing[1].passed ? '✓' : '✗') + ' ' + cduSys.sizing[1].label + ' 有效容量 ' + cduSys.sizing[1].effectiveCapKw + ' kW (N-1) ' + (cduSys.sizing[1].passed ? '滿足' : '不足！')) : ''),
                    (cduVelOk ? '✓' : '⚠') + ' 一次側管路流速 (計算值) ' + pipeCdu.velocity_mps + ' m/s，建議範圍 1.0~3.0 m/s' + (cduVelOk ? '' : '，建議調整管徑'),
                    trimChillerForCheck ? ((trimChillerForCheck.maxMechanicalPassed ? '✓' : '⚠') + ' Trim Chiller 全機械製冷(Mode 3)最大需求 ' + trimChillerForCheck.maxMechanicalKw + ' kW，N+1可用 ' + trimChillerForCheck.effectiveCapKw + ' kW' + (trimChillerForCheck.maxMechanicalPassed ? '（足夠）' : '（不足！極端高溫時可能超載，實際是否發生請以Dashboard的容量缺口小時數為準）')) : ''
                ]
            };

            // 2. Fanwall 氣冷系統
            fwSys.designBasis = {
                air_load_kw: duSumm.airHeatKw + duSumm.lossKw
            };

            const dT_fw = Math.max(1.0, (fwSys.chwReturnC || 18) - (fwSys.chwSupplyC || 12));
            const airHeatTotal = duSumm.airHeatKw + duSumm.lossKw;
            const flowLpm_fw = airHeatTotal > 0 ? Math.round((airHeatTotal * 60) / (4.186 * 1.0 * dT_fw)) : 0;
            const pipeFw = this.selectPipeDnAndVelocity(flowLpm_fw);

            fwSys.hydraulics = {
                flow_lpm: flowLpm_fw,
                pipe_dn: pipeFw.pipe_dn,
                velocity_mps: pipeFw.velocity_mps,
                pump_head_m: 22,
                // v35: 移除無物理來源的 +0.5 kW 假底載
                pump_power_kw: Math.round(flowLpm_fw > 0 ? (flowLpm_fw * 22 * 9.81) / (60000 * 0.75 * 0.9) : 0)
            };

            const reqAirKw = airHeatTotal;
            const fwArch = fwSys.architecture || 'air_cooled_chiller';

            // V24 Phase 2: 若架構變更或尚未初始化，依新架構動態生成選型清單
            if (!fwSys.sizing || fwSys.sizing.length === 0 || fwSys.sizingArch !== fwArch) {
                fwSys.sizing = this.generateFwSizing(fwArch, reqAirKw, fwSys.hydraulics.pump_power_kw);
                fwSys.sizingArch = fwArch;
            }

            fwSys.sizing.forEach(s => {
                s.requiredKw = reqAirKw;
                if (s.key === 'cooling_tower') s.requiredKw = reqAirKw * 1.2;
                if (s.key === 'fw_pump') s.requiredKw = fwSys.hydraulics.pump_power_kw;

                const curItem = s.catalog.find(c => c.model === s.selectedModel) || s.catalog[0];
                s.unitCapKw = curItem.capKw;
                s.requiredUnitsN1 = Math.max(2, Math.ceil(s.requiredKw / s.unitCapKw) + 1);
                s.effectiveCapKw = Math.max(0, s.selectedQty - 1) * s.unitCapKw;
                s.passed = (s.effectiveCapKw >= s.requiredKw) && (s.selectedQty >= 2);
                s.requiredText = '需求 ≥ ' + s.requiredKw.toFixed(1) + ' kW (N+1 最少 ' + s.requiredUnitsN1 + ' 台)';
                if (s.key === 'fw_pump') {
                    s.passed = s.selectedQty >= 2 && (s.effectiveCapKw >= s.requiredKw * 0.9);
                    s.requiredText = '二次側水力揚程需求 ' + s.requiredKw + ' kW (2用1備 N+1)';
                }
            });

            const fwVelOk = pipeFw.velocity_mps >= 1.0 && pipeFw.velocity_mps <= 3.0;
            fwSys.validation = {
                ok: fwSys.sizing.every(s => s.passed),
                checks: [
                    (fwSys.sizing[0] ? ((fwSys.sizing[0].passed ? '✓' : '✗') + ' ' + fwSys.sizing[0].label + ' 有效容量 ' + fwSys.sizing[0].effectiveCapKw + ' kW (N-1) ' + (fwSys.sizing[0].passed ? '滿足' : '不足！')) : ''),
                    (fwSys.sizing[1] ? ((fwSys.sizing[1].passed ? '✓' : '✗') + ' ' + fwSys.sizing[1].label + ' 有效容量 ' + fwSys.sizing[1].effectiveCapKw + ' kW (N-1) ' + (fwSys.sizing[1].passed ? '滿足' : '不足！')) : ''),
                    (fwSys.sizing[2] ? ((fwSys.sizing[2].passed ? '✓' : '✗') + ' ' + fwSys.sizing[2].label + ' 有效容量 ' + fwSys.sizing[2].effectiveCapKw + ' kW (N-1) ' + (fwSys.sizing[2].passed ? '滿足' : '不足！')) : ''),
                    (fwVelOk ? '✓' : '⚠') + ' 二次側管路流速 (計算值) ' + pipeFw.velocity_mps + ' m/s，建議範圍 1.0~3.0 m/s' + (fwVelOk ? '' : '，建議調整管徑')
                ].filter(Boolean)
            };
        },

        generateFallbackWeather() {
            const arr = [];
            for (let i = 0; i < 8760; i++) {
                const month = hourToMonth(i); // A-5 fix
                const baseDb = 15 + 13 * Math.sin((month - 1) * Math.PI / 6);
                const dailyVar = 4 * Math.sin((i % 24) * Math.PI / 12);
                const db = parseFloat((baseDb + dailyVar).toFixed(1));
                const wb = parseFloat((db - 3.5).toFixed(1));
                arr.push({ db, wb, dp: db - 4, rh: 75 });
            }
            return arr;
        }
    };

    window.AppStore = AppStore;
})(window);
