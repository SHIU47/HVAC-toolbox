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

    // M9: 統一 ID 產生器，避免 Date.now() 在快速迴圈（如 copySU）中重複
    function makeId(prefix) {
        const u = (typeof uuid === 'function')
            ? uuid().replace(/-/g, '').slice(0, 12)
            : (Date.now().toString(36) + Math.random().toString(36).slice(2, 7));
        return prefix ? `${prefix}_${u}` : u;
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
                                    fwsSupplyC: 42.0,              // 一次側 (設施側) 供水溫 (45 - 3)
                                    fwsReturnC: 54.0,              // 一次側 (設施側) 回水溫 (57 - 3)
                                    dryCoolerApproachC: 5.0,       // 排熱端 (乾冷器/水塔) Approach
                                    pheApproachC: 2.0,
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
                            fwsSupplyC: 42.0, fwsReturnC: 54.0, dryCoolerApproachC: 5.0, pheApproachC: 2.0,
                            adiabaticSaturationEfficiencyPct: 85.0, blowdownLossPct: 15.0, cyclesOfConcentration: 5,
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
                    breakdownKwh: { it: 0, cduPump: 0, crahFan: 0, heatRejection: 0, chiller: 0, loss: 0, cduUnitKwh: 0 }
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
                schemaVersion: 'v5',
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

        migrateProject(stateData) {
            if (!stateData) return stateData;

            // P0-1: 確保 corePods enabled 欄位存在
            if (Array.isArray(stateData.corePods)) {
                stateData.corePods.forEach(p => {
                    p.enabled = (p.enabled !== false);
                });
            }

            const migrateSystem = (sys) => {
                if (!sys) return;

                // 架構別名解析 (如 dry_cooler_hx -> dry_cooler_trim)
                if (sys.architecture && typeof CoolingArchRegistry !== 'undefined') {
                    sys.architecture = CoolingArchRegistry.resolveAlias(sys.architecture);
                }

                // 架構專屬 params 預設值補齊
                if (sys.architecture && typeof CoolingArchRegistry !== 'undefined' && CoolingArchRegistry.has(sys.architecture)) {
                    const archDesc = CoolingArchRegistry.get(sys.architecture);
                    if (archDesc && Array.isArray(archDesc.params)) {
                        for (const p of archDesc.params) {
                            if (p.key && sys[p.key] === undefined && p.default !== undefined) {
                                sys[p.key] = p.default;
                            }
                        }
                    }
                }

                // Sizing 項目補齊 redundancy = 'N+1' (為 Phase E 預留)
                if (Array.isArray(sys.sizing)) {
                    sys.sizing.forEach(s => {
                        if (!s.redundancy) s.redundancy = 'N+1';
                    });
                }
            };

            const backfillCdu = (cdu) => {
                if (!cdu) return;
                if (cdu.secSupplyC === undefined) cdu.secSupplyC = 45.0;
                if (cdu.secReturnC === undefined) cdu.secReturnC = 57.0;
                if (cdu.cduApproachC === undefined) cdu.cduApproachC = 3.0;
                if (cdu.fwsSupplyC === undefined) cdu.fwsSupplyC = Number((cdu.secSupplyC - cdu.cduApproachC).toFixed(1));
                if (cdu.fwsReturnC === undefined) cdu.fwsReturnC = Number((cdu.secReturnC - cdu.cduApproachC).toFixed(1));
                if (cdu.dryCoolerApproachC === undefined) cdu.dryCoolerApproachC = 5.0;
                if (cdu.pheApproachC === undefined) cdu.pheApproachC = 2.0;
            };

            if (Array.isArray(stateData.halls)) {
                stateData.halls.forEach(h => {
                    (h.dus || []).forEach(d => {
                        if (d.plantDesign) {
                            migrateSystem(d.plantDesign.cduSystem);
                            backfillCdu(d.plantDesign.cduSystem);
                            migrateSystem(d.plantDesign.fanwallSystem);
                        }
                    });
                });
            }

            if (Array.isArray(stateData.corePods)) {
                stateData.corePods.forEach(p => {
                    if (p.plantDesign) {
                        migrateSystem(p.plantDesign.cduSystem);
                        backfillCdu(p.plantDesign.cduSystem);
                        migrateSystem(p.plantDesign.fanwallSystem);
                    }
                });
            }

            stateData.schemaVersion = 'v5';
            return stateData;
        },

        deserializeProject(jsonStr) {
            try {
                const parsed = typeof jsonStr === 'string' ? JSON.parse(jsonStr) : jsonStr;
                const rawStateData = parsed.state || parsed;
                const stateData = this.migrateProject(rawStateData);
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
                    this.state.site.design = null;
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
            const lossPct = (this.state && this.state.facilityElectricalLossPct) ? this.state.facilityElectricalLossPct : 0;
            const lossKw = totalItKw * (lossPct / 100);
            return { totalItKw, liquidHeatKw, airHeatKw, dlcPct, lossKw };
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
            const lossPct = (this.state && this.state.facilityElectricalLossPct) ? this.state.facilityElectricalLossPct : 0;
            const lossKw = totalItKw * (lossPct / 100);
            return { totalItKw, liquidHeatKw, airHeatKw, dlcPct, lossKw };
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
            const lossPct = (this.state && this.state.facilityElectricalLossPct) ? this.state.facilityElectricalLossPct : 0;
            const lossKw = totalItKw * (lossPct / 100);
            return { totalItKw, liquidHeatKw, airHeatKw, dlcPct, lossKw };
        },

        setFacilityElectricalLossPct(pct) {
            const val = Math.max(0, Math.min(50, parseFloat(pct) || 0.0));
            this.state.facilityElectricalLossPct = Number(val.toFixed(2));
            this.calculate();
            this.notify();
        },

        updateSite(siteData) {
            Object.assign(this.state.site, siteData);
            this.state.site.design = null;
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

        // P1-10: 產生標準 CDU 系統設定，確保 sec、approach、fws 衍生關係一致
        defaultCduSystem(arch = 'dry_cooler_hx') {
            const secSupplyC = 45.0;
            const secReturnC = 57.0;
            const cduApproachC = 3.0;
            return {
                architecture: arch,
                secSupplyC,
                secReturnC,
                cduApproachC,
                fwsSupplyC: Number((secSupplyC - cduApproachC).toFixed(1)), // 42.0
                fwsReturnC: Number((secReturnC - cduApproachC).toFixed(1)), // 54.0
                dryCoolerApproachC: 5.0,
                pheApproachC: 2.0,
                adiabaticSaturationEfficiencyPct: 85.0,
                blowdownLossPct: 15.0,
                cyclesOfConcentration: 5,
                designBasis: {},
                sizing: [],
                hydraulics: {},
                validation: { ok: true, checks: [] }
            };
        },

        // ═══════════════════════════════════════════════════════════════
        // CorePOD CRUD & 複製管理方法
        // ═══════════════════════════════════════════════════════════════
        addCorePod(data = {}) {
            const podNum = this.state.corePods.length + 1;
            const letter = String.fromCharCode(65 + (podNum - 1) % 26);
            const podId = makeId('corepod');
            const newPod = {
                id: podId,
                name: data.name || `CorePOD-${letter} (核心網通/集中儲存)`,
                // P0-1 fix: 沒有這個欄位時，calculate()/canProceedStep4() 用的
                // `p.enabled` 過濾（嚴格真值）會把新增的 CorePOD 整組排除在 PUE
                // 計算與 N+1 檢核之外，即使它明明出現在 Step4 畫面和 Excel 匯出。
                enabled: (data.enabled !== undefined) ? data.enabled : true,
                topologyMode: data.topologyMode || 'dedicated',
                electricalLossFactorPct: 0.0,
                equipment: data.equipment ? JSON.parse(JSON.stringify(data.equipment)) : [
                    { id: makeId('eq'), category: 'IB', model: 'Quantum-2 Spine Switch (128p)', qty: 8, itLoadKw: 12.0, liquidPct: 0, airPct: 100 },
                    { id: makeId('eq'), category: 'CIN', model: 'SN5600 800GbE Spine (64p)', qty: 8, itLoadKw: 10.0, liquidPct: 0, airPct: 100 },
                    { id: makeId('eq'), category: 'STG', model: 'High-Density NVMe Storage Rack', qty: 10, itLoadKw: 25.0, liquidPct: 0, airPct: 100 }
                ],
                plantDesign: data.plantDesign ? JSON.parse(JSON.stringify(data.plantDesign)) : {
                    cduSystem: this.defaultCduSystem('dry_cooler_hx'),
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
            clonedPod.id = makeId('corepod');
            clonedPod.name = `${pod.name} (複製)`;
            clonedPod.equipment.forEach((eq) => {
                eq.id = makeId('eq');
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
            const hallId = makeId('hall');
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
            const duId = makeId('du');
            const newDu = {
                id: duId,
                name: namePrefix || `DU-${duIdx < 10 ? '0' + duIdx : duIdx}`,
                sus: [
                    {
                        id: makeId('su'),
                        name: 'SU-01 (預設配置)',
                        electricalLossFactorPct: 0.0,
                        equipment: [
                            { id: makeId('eq'), category: 'GPU', model: 'NVIDIA Vera Rubin VR200 NVL72', qty: 2, itLoadKw: 227.0, liquidPct: 95.0, airPct: 5.0 },
                            { id: makeId('eq'), category: 'IB', model: 'NDR Leaf Switch (64p)', qty: 2, itLoadKw: 6.0, liquidPct: 0, airPct: 100.0 }
                        ]
                    }
                ],
                plantDesign: {
                    cduSystem: this.defaultCduSystem('dry_cooler_hx'),
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
                id: makeId('su'),
                name: name || `SU-${suIdx < 10 ? '0' + suIdx : suIdx}`,
                electricalLossFactorPct: 0.0,
                equipment: [
                    { id: makeId('eq'), category: 'GPU', model: 'NVIDIA Vera Rubin VR200 NVL72', qty: 1, itLoadKw: 227.0, liquidPct: 95.0, airPct: 5.0 }
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
            clonedDu.id = makeId('du');
            clonedDu.name = `${du.name} (複製)`;
            clonedDu.sus.forEach((su) => {
                su.id = makeId('su');
                su.equipment.forEach((eq) => {
                    eq.id = makeId('eq');
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
                clonedSu.id = makeId('su');
                clonedSu.name = `${su.name} (Copy ${i + 1})`;
                clonedSu.equipment.forEach((eq) => {
                    eq.id = makeId('eq');
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

        designConditions() {
            if (this.state.site.design) return this.state.site.design;
            const hourly = this.state.site.hourly;
            let designDb, designWb, maxDb;
            if (hourly && hourly.length >= 8760) {
                const dbSorted = hourly.map(h => h.db).sort((a, b) => b - a);
                const wbSorted = hourly.map(h => h.wb).sort((a, b) => b - a);
                designDb = dbSorted[34]; // 35th largest (0.4% exceedance: 8760 * 0.004 = 35.04)
                designWb = wbSorted[34];
                maxDb = dbSorted[0];
            } else {
                maxDb = this.state.site.stats?.maxDB ?? 38.0;
                designDb = this.state.site.stats?.maxDB ?? 35.0;
                designWb = (typeof A === 'function') ? A('design_wb_fallback_c') : 28.0;
            }
            this.state.site.design = { designDb, designWb, maxDb };
            return this.state.site.design;
        },

        trimOperatingPoint(cduSys, db_c) {
            const dcApp   = cduSys.dryCoolerApproachC ?? 5.0;          // 乾冷器 approach
            const pheApp  = cduSys.pheApproachC ?? 2.0;                // Primary HX approach
            const tSup    = cduSys.fwsSupplyC ?? 40.0;
            const tRet    = cduSys.fwsReturnC ?? 55.0;
            const tDc     = db_c + dcApp;                              // 乾冷器出水
            const eco     = FreeCoolingEngine.calcSeriesEconomizer(tDc + pheApp, tSup, tRet);
            const tPre    = eco.t_precooled_c;                         // FWS 經 Primary HX 預冷後溫度
            const tChws   = cduSys.trimChwSupplyC ?? Math.min(30, tSup - 7);   // 與 view_cooling.js:724 同一公式
            const minCewt = (typeof A === 'function') ? A('min_cewt_c') : 16.0;
            // 乾冷器側水在 Primary HX 吸收預冷熱後進冷凝器（平衡流量假設，與拓樸圖一致）
            const tCewt   = Math.max(minCewt, tDc + (tRet - tPre));
            return { ...eco, tDc, tPre, tChws, tCewt, tRet, tSup };
        },

        // V21 依架構生成專屬的 sizing 清單 (透過 SizingEngine)
        generateCduSizing(arch, reqKw, hydKw) {
            if (typeof SizingEngine !== 'undefined') {
                return SizingEngine.generateCduSizing(arch, reqKw, hydKw, {
                    designConditions: () => this.designConditions(),
                    trimOperatingPoint: (sys, db) => this.trimOperatingPoint(sys, db)
                });
            }
            return [];
        },

        // V24 & V27: 依 Fanwall / RDHX 架構動態生成選型清單 (透過 SizingEngine)
        generateFwSizing(arch, reqKw, pumpPowerKw) {
            if (typeof SizingEngine !== 'undefined') {
                return SizingEngine.generateFwSizing(arch, reqKw, pumpPowerKw);
            }
            return [];
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

            // P0-1 fix: 跟 view_cooling.js / excel_export.js 使用同一個判定
            // (`!== false`)，避免缺 `enabled` 欄位的舊專案 CorePOD 被悄悄排除。
            this.state.corePods.filter(p => p.enabled !== false).forEach(pod => {
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
                category: catEntry?.category,
                chiller_type: catEntry?.chiller_type ?? chillerType
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
        // V22 / C-2: 共用逐時能耗計算函式 — 透過 CoolingArchRegistry 分派
        // ═══════════════════════════════════════════════════════════════
        calcHourlyEnergy(plantDesign, summ, w) {
            const cduSys = plantDesign.cduSystem;
            const fwSys  = plantDesign.fanwallSystem;
            const cduArch = cduSys.architecture || 'dry_cooler_hx';
            const fwArch  = fwSys.architecture || 'air_cooled_chiller';

            const cduArchDesc = (typeof CoolingArchRegistry !== 'undefined') ? CoolingArchRegistry.get(cduArch) : null;
            const fwArchDesc  = (typeof CoolingArchRegistry !== 'undefined') ? CoolingArchRegistry.get(fwArch) : null;

            if (!cduArchDesc) throw new Error(`Unknown CDU cooling architecture: "${cduArch}"`);
            if (!fwArchDesc)  throw new Error(`Unknown Fanwall cooling architecture: "${fwArch}"`);

            const evapFactor = (typeof A === 'function') ? A('ct_evap_m3h_per_kw') : 0.00124;
            const cycles = cduSys.cyclesOfConcentration || 5;

            // --- CDU terminal and primary pump ---
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
            let cduUnitKw = 0;
            let cduDeficitKw = 0;
            if (cduUnits.length > 0 && typeof CDUEngine !== 'undefined' && summ.liquidHeatKw > 0) {
                const cduRes = CDUEngine.calcPower(cduUnits, summ.liquidHeatKw);
                cduUnitKw = cduRes.power_kw;
                cduDeficitKw = cduRes.deficit_kw || 0;
            } else if (summ.liquidHeatKw > 0) {
                cduUnitKw = (summ.liquidHeatKw / 400) * 2.0;
            }

            const cduPumpItem = (cduSys.sizing || []).find(s => s.key === 'cdu_pump');
            const cduPumps = this.resolvePumpFromSizing(cduPumpItem);
            const cduPrimaryPumpKw = (cduPumps.length > 0 && typeof PlantPumpEngine !== 'undefined' && summ.liquidHeatKw > 0)
                ? PlantPumpEngine.calcPower(cduPumps, cduPumpSpeed)
                : (summ.liquidHeatKw / 500) * (cduSys.hydraulics?.pump_power_kw || 11.0);

            const cduPumpKw = cduUnitKw + cduPrimaryPumpKw;

            // --- Fanwall / CRAH terminal and secondary pump ---
            const chwSupplyC = fwSys.chwSupplyC || 12.0;
            const chwReturnC = fwSys.chwReturnC || 18.0;
            const fwBaseCop = chwSupplyC >= 20 ? 5.8 : (chwSupplyC >= 12 ? 4.2 : 3.0);
            const airHeatTotal = summ.airHeatKw + summ.lossKw;

            const designAirKw = fwSys.designBasis?.air_load_kw || airHeatTotal;
            const fwLoadRatio = designAirKw > 0 ? Math.min(1.0, airHeatTotal / designAirKw) : 1.0;

            const fwUnitKey = fwArch === 'rdhx' ? 'rdhx_unit' : 'crah_unit';
            const fwUnitItem = (fwSys.sizing || []).find(s => s.key === fwUnitKey);
            const fwUnits = this.resolveCrahFromSizing(fwUnitItem);
            let crahFanKw = 0;
            let crahDeficitKw = 0;
            if (fwUnits.length > 0 && typeof CRAHEngine !== 'undefined' && airHeatTotal > 0) {
                const crahRes = CRAHEngine.calcPower(fwUnits, airHeatTotal);
                crahFanKw = crahRes.power_kw;
                if (crahRes.deficit_kw > 0) {
                    crahDeficitKw = crahRes.deficit_kw;
                }
            } else {
                crahFanKw = ((fwArch === 'rdhx') ? (airHeatTotal / 60) * 1.2 : (airHeatTotal / 60) * 4.8);
            }

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
                : 0;

            // --- Resolve Equipment Lists from Sizing ---
            const dcItem = (cduSys.sizing || []).find(s => s.key === 'dry_cooler');
            const dcDevices = this.resolveTowerFromSizing(dcItem);

            const trimItem = (cduSys.sizing || []).find(s => s.key === 'trim_chiller');
            const trimChillers = this.resolveChillerFromSizing(trimItem, 'water_cooled');
            const trimCop = trimItem?.catalog?.find(c => c.model === trimItem.selectedModel)?.cop || 6.2;

            const atItem = (cduSys.sizing || []).find(s => s.key === 'adiabatic_tower');
            const atDevices = this.resolveTowerFromSizing(atItem);

            const ctItem = (cduSys.sizing || []).find(s => s.key === 'cooling_tower');
            const ctDevices = this.resolveTowerFromSizing(ctItem);

            const cduChillerItem = (cduSys.sizing || []).find(s => s.key === 'water_cooled_chiller');
            const cduChillers = this.resolveChillerFromSizing(cduChillerItem, 'water_cooled');

            const fwAirChillerItem = (fwSys.sizing || []).find(s => s.key === 'air_cooled_chiller');
            const fwAirChillers = this.resolveChillerFromSizing(fwAirChillerItem, 'air_cooled');

            const fwWaterChillerItem = (fwSys.sizing || []).find(s => s.key === 'water_cooled_chiller');
            const fwWaterChillers = this.resolveChillerFromSizing(fwWaterChillerItem, 'water_cooled');

            const fwTowerItem = (fwSys.sizing || []).find(s => s.key === 'cooling_tower');
            const fwTowerDevices = this.resolveTowerFromSizing(fwTowerItem);

            // --- Dispatch CDU Simulation ---
            const cduSim = (summ.liquidHeatKw > 0) ? cduArchDesc.simulateHour({
                Q_kw: summ.liquidHeatKw,
                t_supply_c: cduSys.fwsSupplyC,
                t_return_c: cduSys.fwsReturnC,
                w,
                sys: cduSys,
                equip: {
                    dry_cooler: dcDevices,
                    trim_chiller: trimChillers,
                    adiabatic_tower: atDevices,
                    cooling_tower: ctDevices,
                    water_cooled_chiller: cduChillers
                },
                loadRatio: cduLoadRatio,
                fanMinSpeed: cduFanMinSpeed,
                evapFactor,
                cycles,
                trimCop,
                terminalKw: cduUnitKw,
                pumpKw: cduPrimaryPumpKw
            }) : {
                terminalKw: 0,
                pumpKw: 0,
                fanKw: 0,
                compressorKw: 0,
                waterM3: 0,
                mode: 'free',
                deficitKw: 0,
                heatRemovedKw: 0,
                mechLoadKw: 0
            };

            // --- Dispatch Fanwall Simulation ---
            const fwSim = (airHeatTotal > 0) ? fwArchDesc.simulateHour({
                Q_kw: airHeatTotal,
                t_supply_c: chwSupplyC,
                t_return_c: chwReturnC,
                w,
                sys: fwSys,
                equip: {
                    air_cooled_chiller: fwAirChillers,
                    water_cooled_chiller: fwWaterChillers,
                    cooling_tower: fwTowerDevices
                },
                loadRatio: fwLoadRatio,
                fanMinSpeed: fwFanMinSpeed,
                evapFactor,
                cycles,
                fwBaseCop,
                terminalKw: crahFanKw,
                pumpKw: fwPumpKw
            }) : {
                terminalKw: 0,
                pumpKw: 0,
                fanKw: 0,
                compressorKw: 0,
                waterM3: 0,
                mode: 'free',
                deficitKw: 0,
                heatRemovedKw: 0,
                mechLoadKw: 0
            };

            const totalDeficitKw = cduDeficitKw + crahDeficitKw + (cduSim.deficitKw || 0) + (fwSim.deficitKw || 0);
            const combinedMode = (cduSim.mode === 'free' && fwSim.mode === 'free')
                ? 'free'
                : ((cduSim.mode === 'mechanical' && fwSim.mode === 'mechanical') ? 'mechanical' : 'partial');
            const isFreeHour = (summ.liquidHeatKw === 0 || cduSim.mode === 'free') && (airHeatTotal === 0 || fwSim.mode === 'free');
            const heatRemovedKw = Math.max(0, summ.liquidHeatKw + airHeatTotal - totalDeficitKw);
            const mechLoadKw = (cduSim.mechLoadKw || 0) + (fwSim.mechLoadKw || 0);

            return {
                cduPumpKw: cduPumpKw + fwPumpKw,
                crahFanKw,
                heatRejKw: cduSim.fanKw + fwSim.fanKw,
                chillerKw: cduSim.compressorKw + fwSim.compressorKw,
                lossKw: summ.lossKw,
                waterM3: cduSim.waterM3 + fwSim.waterM3,
                isFreeHour,
                capacityDeficitKw: totalDeficitKw,
                heatRemovedKw,
                cduMode: cduSim.mode,
                fwMode: fwSim.mode,
                combinedMode,
                mechLoadKw,
                cduKwh: {
                    unit: cduUnitKw,
                    pump: cduPrimaryPumpKw,
                    heatRej: cduSim.fanKw,
                    chiller: cduSim.compressorKw,
                    trimLoadKw: cduSim.mechLoadKw || 0
                },
                fwKwh: {
                    pump: fwPumpKw,
                    crahFan: crahFanKw,
                    heatRej: fwSim.fanKw,
                    chiller: fwSim.compressorKw,
                    chillerLoadKw: fwSim.mechLoadKw || 0
                }
            };
        },

        // ═══════════════════════════════════════════════════════════════
        // 自由冷卻動態物理門檻統一查詢 (Single Source of Truth)
        // [P1-4 審查] 此函式供 view_weather.js 繪製氣象直方圖與全時自由冷卻標記；
        // 主計算引擎與 AnnualRunner 不依賴此函式。待後續 UI 重構整併。
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

            if (typeof AnnualRunner !== 'undefined') {
                this.state.results = AnnualRunner.run(this.state, hourlyWeather, {
                    calcDuSummary: (du) => this.calcDuSummary(du),
                    calcCorePodSummary: (pod) => this.calcCorePodSummary(pod),
                    bridgeDuToPlantModel: (unit, summ) => this.bridgeDuToPlantModel(unit, summ),
                    calcHourlyEnergy: (plant, summ, w) => this.calcHourlyEnergy(plant, summ, w)
                });
            }
        },

        simulateUnit(plantDesign, loadSumm, hourlyWeather, helpers = {}) {
            if (typeof AnnualRunner !== 'undefined') {
                return AnnualRunner.simulateUnit(plantDesign, loadSumm, hourlyWeather, {
                    calcHourlyEnergy: (plant, summ, w) => this.calcHourlyEnergy(plant, summ, w),
                    ...helpers
                });
            }
            throw new Error('AnnualRunner is not loaded');
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

            if (typeof SizingEngine !== 'undefined') {
                SizingEngine.evaluateCduSizing(cduSys, reqCduKw, this.designConditions(), {
                    trimOperatingPoint: this.trimOperatingPoint.bind(this)
                });
                cduSys.validation = SizingEngine.validateCdu(cduSys, pipeCdu.velocity_mps);
            }

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

            if (typeof SizingEngine !== 'undefined') {
                SizingEngine.evaluateFwSizing(fwSys, reqAirKw, this.designConditions());
                fwSys.validation = SizingEngine.validateFw(fwSys, pipeFw.velocity_mps);
            }
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
