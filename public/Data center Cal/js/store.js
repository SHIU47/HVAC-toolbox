/**
 * store.js - V21 Dual-Loop Temperatures & Architecture-Specific Sizing Generators
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
            facilityElectricalLossPct: (typeof A === 'function') ? A('electrical_loss_default_pct') : 4.5,

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

            coolingPlants: [],

            scenarios: [],
            activeScenarioId: null,

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
                schemaVersion: 'v7',
                savedAt: new Date().toISOString(),
                facilityElectricalLossPct: s.facilityElectricalLossPct ?? A('electrical_loss_default_pct'),
                site: {
                    selectedCity: s.site.selectedCity,
                    stationId: s.site.stationId || null,
                    stationSource: s.site.stationSource || (s.site.userUploaded ? 'epw' : 'builtin'),
                    stats: s.site.stats,
                    userUploaded: s.site.userUploaded || false,
                    designConditions: s.site.designConditions || null
                },
                halls: s.halls,
                corePods: s.corePods,
                coolingPlants: s.coolingPlants || [],
                scenarios: s.scenarios || [],
                activeScenarioId: s.activeScenarioId || null,
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

                if (!sys.sizingArch && sys.architecture) {
                    sys.sizingArch = sys.architecture;
                }

                // 若架構有新設備 (例如 cw_pump)，補齊缺少的 sizing 項目
                if (sys.architecture && typeof CoolingArchRegistry !== 'undefined' && CoolingArchRegistry.has(sys.architecture)) {
                    const archDesc = CoolingArchRegistry.get(sys.architecture);
                    if (Array.isArray(archDesc.equipment) && Array.isArray(sys.sizing)) {
                        for (const eq of archDesc.equipment) {
                            if (!sys.sizing.some(s => s.key === eq.key)) {
                                if (typeof SizingEngine !== 'undefined') {
                                    const dummyCtx = { reqKw: 0, hydKw: 0, cwPumpKw: 0, getTowerRejectionFactor: () => 1.2 };
                                    const newItem = SizingEngine._createSizingItem(eq, dummyCtx);
                                    newItem.userEdited = false;
                                    sys.sizing.push(newItem);
                                }
                            }
                        }
                    }
                }

                // Sizing 項目補齊 redundancy = 'N+1' (為 Phase E 預留) 與 userEdited = true
                if (Array.isArray(sys.sizing)) {
                    sys.sizing.forEach(s => {
                        if (!s.redundancy) s.redundancy = 'N+1';
                        if (!s.runMode) s.runMode = 'standby';
                        if (s.userEdited === undefined) s.userEdited = true;
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
                if (cdu.hasPhe === undefined) {
                    const archDesc = (typeof CoolingArchRegistry !== 'undefined') ? CoolingArchRegistry.get(cdu.architecture) : null;
                    const def = archDesc?.params?.find(p => p.key === 'hasPhe')?.default;
                    cdu.hasPhe = (def !== undefined) ? def : (archDesc?.flags?.isTrim ? true : false);
                }
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

            if (stateData.site) {
                if (!stateData.site.stationSource) {
                    if (stateData.site.userUploaded) {
                        stateData.site.stationSource = 'epw';
                    } else if (stateData.site.selectedCity) {
                        stateData.site.stationSource = 'builtin';
                        const ws = (typeof window !== 'undefined' && window.WeatherSource) ? window.WeatherSource : ((typeof WeatherSource !== 'undefined') ? WeatherSource : null);
                        stateData.site.stationId = ws?.REVERSE_BUILTIN_MAP?.[stateData.site.selectedCity] || stateData.site.selectedCity;
                    }
                }
            }

            // P-1: 冷卻系統分組 (coolingPlants) 遷移至 schema v7
            if (!Array.isArray(stateData.coolingPlants)) {
                stateData.coolingPlants = [];
            } else {
                stateData.coolingPlants.forEach(p => {
                    if (!p.redundancy) p.redundancy = 'N+1';
                    if (p.diversityFactor === undefined) p.diversityFactor = 1.0;
                    if (!Array.isArray(p.memberIds)) p.memberIds = [];
                    if (p.system) {
                        migrateSystem(p.system);
                        if (p.loop === 'liquid') backfillCdu(p.system);
                    }
                });
            }

            // 確保所有單元與 coolingPlants 雙向一致
            const allUnits = [];
            (stateData.halls || []).forEach(h => (h.dus || []).forEach(d => allUnits.push(d)));
            (stateData.corePods || []).forEach(p => allUnits.push(p));

            allUnits.forEach(u => {
                if (u.plantDesign) {
                    ['cduSystem', 'fanwallSystem'].forEach(sysKey => {
                        const loop = sysKey === 'cduSystem' ? 'liquid' : 'air';
                        const plantId = u.plantDesign[sysKey]?.plantId;
                        if (plantId) {
                            const plant = stateData.coolingPlants.find(cp => cp.id === plantId && cp.loop === loop);
                            if (plant) {
                                if (!plant.memberIds.includes(u.id)) plant.memberIds.push(u.id);
                            } else {
                                delete u.plantDesign[sysKey].plantId;
                            }
                        }
                    });
                }
            });

            // CorePOD topologyMode === 'shared_plant' 的舊專案：不自動建群組，改在載入後提示
            if (Array.isArray(stateData.corePods)) {
                stateData.corePods.forEach(p => {
                    if (p.topologyMode === 'shared_plant') {
                        const hasPlant = stateData.coolingPlants.some(cp => cp.loop === 'air' && cp.memberIds.includes(p.id));
                        if (!hasPlant) {
                            p._showSharedPlantNotice = true;
                        }
                    }
                });
            }

            // Phase S: 方案資料模型 (scenarios) 遷移
            if (!Array.isArray(stateData.scenarios)) {
                stateData.scenarios = [];
                stateData.activeScenarioId = null;
            } else {
                stateData.scenarios.forEach(scen => {
                    if (!scen.id) scen.id = makeId('scen');
                    if (!scen.name) scen.name = '方案';
                    if (!scen.snapshot) scen.snapshot = {};
                });
            }

            stateData.schemaVersion = 'v7';
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
                if (stateData.coolingPlants && Array.isArray(stateData.coolingPlants)) {
                    this.state.coolingPlants = stateData.coolingPlants;
                } else {
                    this.state.coolingPlants = [];
                }
                if (stateData.scenarios && Array.isArray(stateData.scenarios)) {
                    this.state.scenarios = stateData.scenarios;
                    this.state.activeScenarioId = stateData.activeScenarioId || null;
                } else {
                    this.state.scenarios = [];
                    this.state.activeScenarioId = null;
                }
                if (stateData.assumptions_override) {
                    this.state.assumptions_override = stateData.assumptions_override;
                }
                // P0-E1: 舊專案檔未存電損時套用預設值；使用者主動設 0% 時保留 0%
                const lossPct = Number(stateData.facilityElectricalLossPct);
                this.state.facilityElectricalLossPct = (stateData.facilityElectricalLossPct !== undefined && stateData.facilityElectricalLossPct !== null && Number.isFinite(lossPct))
                    ? Math.max(0, Math.min(50, lossPct))
                    : A('electrical_loss_default_pct');
                if (stateData.site) {
                    if (stateData.site.selectedCity) {
                        this.state.site.selectedCity = stateData.site.selectedCity;
                    }
                    this.state.site.stationId = stateData.site.stationId || null;
                    this.state.site.stationSource = stateData.site.stationSource || (stateData.site.userUploaded ? 'epw' : 'builtin');
                    if (stateData.site.stats) {
                        this.state.site.stats = stateData.site.stats;
                    }
                    if (stateData.site.designConditions !== undefined) {
                        this.state.site.designConditions = stateData.site.designConditions;
                    }

                    const cityName = stateData.site.selectedCity;
                    const stationSource = this.state.site.stationSource;
                    const stationId = this.state.site.stationId;

                    if (stationSource === 'builtin') {
                        const globalScope = (typeof window !== 'undefined') ? window : globalThis;
                        if (cityName && globalScope.BUILTIN_WEATHER_DATA && globalScope.BUILTIN_WEATHER_DATA[cityName]) {
                            const data = globalScope.BUILTIN_WEATHER_DATA[cityName];
                            this.state.site.hourly = data.hourlyData;
                            this.state.site.monthlyStats = data.monthlyStats;
                            this.state.site.isRealEpw = true;
                            this.state.site.stationName = data.stationInfo?.location;
                            this.state.site.country = data.stationInfo?.country;
                            this.state.site.lat = data.stationInfo?.lat;
                            this.state.site.lon = data.stationInfo?.lon;
                            this.state.site.elev = data.stationInfo?.elev;
                            this.state.site.designConditions = data.designConditions || null;
                        } else if (cityName) {
                            console.warn('[deserializeProject] 找不到「' + cityName + '」的內建氣象資料 (可能是使用者自行上傳的EPW，匯出檔未保存原始逐時資料)，本次計算將使用溫和的合成氣候近似值，結果不代表真實案場氣候，請重新於 Step1 上傳/選擇氣象資料。');
                        }
                        this.state.site.design = null;
                        this.calculate();
                    } else if (stationSource === 'catalog' && stationId) {
                        this.state.site.isWeatherLoading = true;
                        this.state.site.design = null;
                        const ws = (typeof window !== 'undefined' && window.WeatherSource) ? window.WeatherSource : ((typeof WeatherSource !== 'undefined') ? WeatherSource : null);
                        if (ws) {
                            this.weatherLoadingPromise = ws.loadStation(stationId).then(stationData => {
                                this.state.site.isWeatherLoading = false;
                                this.state.site.hourly = stationData.hourlyData;
                                this.state.site.monthlyStats = stationData.monthlyStats;
                                this.state.site.stats = stationData.stats;
                                this.state.site.isRealEpw = true;
                                this.state.site.stationName = stationData.stationInfo?.location;
                                this.state.site.country = stationData.stationInfo?.country;
                                this.state.site.lat = stationData.stationInfo?.lat;
                                this.state.site.lon = stationData.stationInfo?.lon;
                                this.state.site.elev = stationData.stationInfo?.elev;
                                this.state.site.designConditions = stationData.designConditions || null;
                                this.state.site.design = null;
                                this.calculate();
                                this.notify();
                                return stationData;
                            }).catch(err => {
                                this.state.site.isWeatherLoading = false;
                                console.error('[deserializeProject] Failed to load catalog weather:', err);
                                this.notify();
                                throw err;
                            });
                        }
                    } else {
                        if (cityName) {
                            console.warn('[deserializeProject] 找不到「' + cityName + '」的內建氣象資料 (可能是使用者自行上傳的EPW，匯出檔未保存原始逐時資料)，本次計算將使用溫和的合成氣候近似值，結果不代表真實案場氣候，請重新於 Step1 上傳/選擇氣象資料。');
                        }
                        this.state.site.design = null;
                        this.calculate();
                    }
                } else {
                    this.calculate();
                }
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
            if (siteData && siteData.hourly && !('designConditions' in siteData)) {
                this.state.site.designConditions = null;
            }
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
            const archDesc = (typeof CoolingArchRegistry !== 'undefined') ? CoolingArchRegistry.get(arch) : null;
            const def = archDesc?.params?.find(p => p.key === 'hasPhe')?.default;
            const hasPheDefault = (def !== undefined) ? def : (archDesc?.flags?.isTrim ? true : false);
            return {
                architecture: arch,
                secSupplyC,
                secReturnC,
                cduApproachC,
                fwsSupplyC: Number((secSupplyC - cduApproachC).toFixed(1)), // 42.0
                fwsReturnC: Number((secReturnC - cduApproachC).toFixed(1)), // 54.0
                dryCoolerApproachC: 5.0,
                hasPhe: hasPheDefault,
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
            const defPodLabel = _t('store.defaultPodDesc', null, '核心網通/集中儲存');
            const newPod = {
                id: podId,
                name: data.name || `CorePOD-${letter} (${defPodLabel})`,
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
            clonedPod.name = `${pod.name} (${_t('store.copy', null, '複製')})`;
            clonedPod.equipment.forEach((eq) => {
                eq.id = makeId('eq');
            });
            if (clonedPod.plantDesign) {
                if (clonedPod.plantDesign.cduSystem) {
                    clonedPod.plantDesign.cduSystem.sizing = [];
                    delete clonedPod.plantDesign.cduSystem.plantId;
                }
                if (clonedPod.plantDesign.fanwallSystem) {
                    clonedPod.plantDesign.fanwallSystem.sizing = [];
                    delete clonedPod.plantDesign.fanwallSystem.plantId;
                }
            }
            this.state.corePods.push(clonedPod);
            this.notify();
            return clonedPod;
        },

        deleteCorePod(podId) {
            if (this.state.corePods.length <= 1) {
                alert(_t('store.minCorePod', null, '⚠️ 系統中至少需保留 1 組 CorePOD 核心機房！'));
                return false;
            }
            const idx = this.state.corePods.findIndex(p => p.id === podId);
            if (idx !== -1) {
                if (Array.isArray(this.state.coolingPlants)) {
                    this.state.coolingPlants.forEach(plant => {
                        plant.memberIds = plant.memberIds.filter(id => id !== podId);
                    });
                }
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
                alert(_t('store.minHall', null, '⚠️ 系統中至少需保留 1 間 Data Hall 機房！'));
                return false;
            }
            const idx = this.state.halls.findIndex(h => h.id === hallId);
            if (idx !== -1) {
                const deletedHall = this.state.halls[idx];
                const duIds = (deletedHall.dus || []).map(d => d.id);
                if (Array.isArray(this.state.coolingPlants)) {
                    this.state.coolingPlants.forEach(plant => {
                        plant.memberIds = plant.memberIds.filter(id => !duIds.includes(id));
                    });
                }
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
                        name: 'SU-01 (' + _t('store.defaultSuDesc', null, '預設配置') + ')',
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
            clonedDu.name = `${du.name} (${_t('store.copy', null, '複製')})`;
            clonedDu.sus.forEach((su) => {
                su.id = makeId('su');
                su.equipment.forEach((eq) => {
                    eq.id = makeId('eq');
                });
            });
            if (clonedDu.plantDesign) {
                if (clonedDu.plantDesign.cduSystem) {
                    clonedDu.plantDesign.cduSystem.sizing = [];
                    delete clonedDu.plantDesign.cduSystem.plantId;
                }
                if (clonedDu.plantDesign.fanwallSystem) {
                    clonedDu.plantDesign.fanwallSystem.sizing = [];
                    delete clonedDu.plantDesign.fanwallSystem.plantId;
                }
            }
            hall.dus.push(clonedDu);
            this.notify();
            return clonedDu;
        },

        deleteDU(hallId, duId) {
            const hall = this.state.halls.find(h => h.id === hallId);
            if (!hall) return false;
            if (hall.dus.length <= 1) {
                alert(_t('store.minDu', null, '⚠️ 每個機房至少需保留 1 組 DU 冷卻單元！'));
                return false;
            }
            const idx = hall.dus.findIndex(d => d.id === duId);
            if (idx !== -1) {
                if (Array.isArray(this.state.coolingPlants)) {
                    this.state.coolingPlants.forEach(plant => {
                        plant.memberIds = plant.memberIds.filter(id => id !== duId);
                    });
                }
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
                alert(_t('store.minSu', null, '⚠️ 每個 DU 至少需保留 1 組 SU 算力單元！'));
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

        // ═══════════════════════════════════════════════════════════════
        // Phase P: 冷卻系統分組 (Cooling Plants / Shared Plants)
        // ═══════════════════════════════════════════════════════════════
        _findUnit(unitId) {
            for (const h of (this.state.halls || [])) {
                const du = (h.dus || []).find(d => d.id === unitId);
                if (du) return du;
            }
            return (this.state.corePods || []).find(p => p.id === unitId) || null;
        },

        _setUnitPlantId(unitId, loop, plantId) {
            const unit = this._findUnit(unitId);
            if (!unit || !unit.plantDesign) return;
            const sysKey = loop === 'liquid' ? 'cduSystem' : 'fanwallSystem';
            if (unit.plantDesign[sysKey]) {
                if (plantId) {
                    unit.plantDesign[sysKey].plantId = plantId;
                } else {
                    delete unit.plantDesign[sysKey].plantId;
                }
            }
        },

        getCoolingPlant(plantId) {
            return (this.state.coolingPlants || []).find(p => p.id === plantId) || null;
        },

        getPlantForUnit(unitId, loop) {
            return (this.state.coolingPlants || []).find(p => p.loop === loop && (p.memberIds || []).includes(unitId)) || null;
        },

        addCoolingPlant(options = {}) {
            if (!Array.isArray(this.state.coolingPlants)) {
                this.state.coolingPlants = [];
            }
            const id = options.id || makeId('plant');
            const loop = options.loop === 'air' ? 'air' : 'liquid';
            const num = this.state.coolingPlants.filter(p => p.loop === loop).length + 1;
            const defName = loop === 'liquid'
                ? _t('cooling.defaultLiquidPlantName', { n: num }, `液冷系統 ${num}`)
                : _t('cooling.defaultAirPlantName', { n: num }, `氣冷系統 ${num}`);
            const name = options.name || defName;
            const redundancy = options.redundancy || 'N+1';
            const diversityFactor = typeof options.diversityFactor === 'number' ? options.diversityFactor : 1.0;
            const memberIds = Array.isArray(options.memberIds) ? [...options.memberIds] : [];

            let system;
            if (options.system) {
                system = JSON.parse(JSON.stringify(options.system));
            } else if (loop === 'liquid') {
                system = {
                    architecture: options.architecture || 'dry_cooler_trim',
                    secSupplyC: 45.0, secReturnC: 57.0, cduApproachC: 3.0,
                    fwsSupplyC: 42.0, fwsReturnC: 54.0, dryCoolerApproachC: 5.0, pheApproachC: 2.0,
                    adiabaticSaturationEfficiencyPct: 85.0, blowdownLossPct: 15.0, cyclesOfConcentration: 5,
                    designBasis: {}, sizing: [], hydraulics: {}, validation: { ok: true, checks: [] }
                };
            } else {
                system = {
                    architecture: options.architecture || 'water_cooled_chiller',
                    chwSupplyC: 12.0, chwReturnC: 18.0, airSideEconomizerThresholdC: 18.0,
                    designBasis: {}, sizing: [], hydraulics: {}, validation: { ok: true, checks: [] }
                };
            }

            const plant = {
                id,
                name,
                loop,
                memberIds,
                system,
                redundancy,
                diversityFactor
            };

            this.state.coolingPlants.push(plant);

            // 更新成員單元的 plantId
            memberIds.forEach(mId => {
                this._setUnitPlantId(mId, loop, id);
            });

            this.notify();
            return plant;
        },

        updateCoolingPlant(plantId, patch) {
            if (!Array.isArray(this.state.coolingPlants)) return false;
            const plant = this.state.coolingPlants.find(p => p.id === plantId);
            if (!plant) return false;

            if (patch.memberIds && Array.isArray(patch.memberIds)) {
                const oldMembers = plant.memberIds || [];
                oldMembers.forEach(mId => {
                    if (!patch.memberIds.includes(mId)) {
                        this._setUnitPlantId(mId, plant.loop, null);
                    }
                });
                patch.memberIds.forEach(mId => {
                    this.state.coolingPlants.forEach(other => {
                        if (other.id !== plantId && other.loop === plant.loop) {
                            other.memberIds = other.memberIds.filter(id => id !== mId);
                        }
                    });
                    this._setUnitPlantId(mId, plant.loop, plantId);
                });
            }

            Object.assign(plant, patch);
            this.notify();
            return true;
        },

        deleteCoolingPlant(plantId) {
            if (!Array.isArray(this.state.coolingPlants)) return false;
            const idx = this.state.coolingPlants.findIndex(p => p.id === plantId);
            if (idx === -1) return false;
            const plant = this.state.coolingPlants[idx];
            (plant.memberIds || []).forEach(mId => {
                this._setUnitPlantId(mId, plant.loop, null);
            });
            this.state.coolingPlants.splice(idx, 1);
            this.notify();
            return true;
        },

        addPlantMember(plantId, unitId) {
            const plant = (this.state.coolingPlants || []).find(p => p.id === plantId);
            if (!plant) return false;
            if (!plant.memberIds.includes(unitId)) {
                this.state.coolingPlants.forEach(other => {
                    if (other.id !== plantId && other.loop === plant.loop) {
                        other.memberIds = other.memberIds.filter(id => id !== unitId);
                    }
                });
                plant.memberIds.push(unitId);
                this._setUnitPlantId(unitId, plant.loop, plantId);
                this.notify();
            }
            return true;
        },

        removePlantMember(plantId, unitId) {
            const plant = (this.state.coolingPlants || []).find(p => p.id === plantId);
            if (!plant) return false;
            plant.memberIds = plant.memberIds.filter(id => id !== unitId);
            this._setUnitPlantId(unitId, plant.loop, null);
            this.notify();
            return true;
        },

        syncUnitFromPlant(unit, loop) {
            const sysKey = loop === 'liquid' ? 'cduSystem' : 'fanwallSystem';
            const sys = unit?.plantDesign?.[sysKey];
            if (!sys || !sys.plantId) return;
            const plant = this.getCoolingPlant(sys.plantId);
            if (!plant || plant.loop !== loop || !plant.system) return;

            const pSys = plant.system;
            if (pSys.architecture) sys.architecture = pSys.architecture;
            if (loop === 'liquid') {
                if (pSys.fwsSupplyC !== undefined) sys.fwsSupplyC = pSys.fwsSupplyC;
                if (pSys.fwsReturnC !== undefined) sys.fwsReturnC = pSys.fwsReturnC;
                if (pSys.dryCoolerApproachC !== undefined) sys.dryCoolerApproachC = pSys.dryCoolerApproachC;
                if (pSys.pheApproachC !== undefined) sys.pheApproachC = pSys.pheApproachC;
                if (pSys.hasPhe !== undefined) sys.hasPhe = pSys.hasPhe;
                if (pSys.freezeDbC !== undefined) sys.freezeDbC = pSys.freezeDbC;
            } else {
                if (pSys.chwSupplyC !== undefined) sys.chwSupplyC = pSys.chwSupplyC;
                if (pSys.chwReturnC !== undefined) sys.chwReturnC = pSys.chwReturnC;
                if (pSys.airSideEconomizerThresholdC !== undefined) sys.airSideEconomizerThresholdC = pSys.airSideEconomizerThresholdC;
            }
        },

        syncAllUnitsFromPlants() {
            if (!Array.isArray(this.state.coolingPlants) || this.state.coolingPlants.length === 0) return;
            const allUnits = [];
            (this.state.halls || []).forEach(h => (h.dus || []).forEach(d => allUnits.push(d)));
            (this.state.corePods || []).forEach(p => allUnits.push(p));
            allUnits.forEach(u => {
                this.syncUnitFromPlant(u, 'liquid');
                this.syncUnitFromPlant(u, 'air');
            });
        },

        // P-4: 快速配置預設 (Quick Config Presets)
        applyDedicatedConfig() {
            this.state.coolingPlants = [];
            const allUnits = [];
            (this.state.halls || []).forEach(h => (h.dus || []).forEach(d => allUnits.push(d)));
            (this.state.corePods || []).forEach(p => allUnits.push(p));
            allUnits.forEach(u => {
                if (u.plantDesign?.cduSystem) u.plantDesign.cduSystem.plantId = null;
                if (u.plantDesign?.fanwallSystem) u.plantDesign.fanwallSystem.plantId = null;
            });
            this.notify();
        },

        applySiteSharedConfig() {
            this.applyDedicatedConfig();
            const allUnits = [];
            (this.state.halls || []).forEach(h => (h.dus || []).forEach(d => allUnits.push(d)));
            (this.state.corePods || []).forEach(p => allUnits.push(p));

            const liqMembers = allUnits.filter(u => {
                const s = u.sus ? this.calcDuSummary(u) : this.calcCorePodSummary(u);
                return (s?.liquidHeatKw || 0) > 0;
            }).map(u => u.id);

            const airMembers = allUnits.filter(u => {
                const s = u.sus ? this.calcDuSummary(u) : this.calcCorePodSummary(u);
                return ((s?.airHeatKw || 0) + (s?.lossKw || 0)) > 0;
            }).map(u => u.id);

            if (liqMembers.length > 0) {
                let maxLiqKw = -1, maxLiqUnit = null;
                allUnits.forEach(u => {
                    const s = u.sus ? this.calcDuSummary(u) : this.calcCorePodSummary(u);
                    if ((s?.liquidHeatKw || 0) > maxLiqKw) {
                        maxLiqKw = s.liquidHeatKw;
                        maxLiqUnit = u;
                    }
                });
                const sys = maxLiqUnit?.plantDesign?.cduSystem ? JSON.parse(JSON.stringify(maxLiqUnit.plantDesign.cduSystem)) : null;
                this.addCoolingPlant({
                    loop: 'liquid',
                    name: _t('cooling.siteSharedLiquidName', null, '全廠共用液冷系統'),
                    memberIds: liqMembers,
                    system: sys
                });
            }

            if (airMembers.length > 0) {
                let maxAirKw = -1, maxAirUnit = null;
                allUnits.forEach(u => {
                    const s = u.sus ? this.calcDuSummary(u) : this.calcCorePodSummary(u);
                    const load = (s?.airHeatKw || 0) + (s?.lossKw || 0);
                    if (load > maxAirKw) {
                        maxAirKw = load;
                        maxAirUnit = u;
                    }
                });
                const sys = maxAirUnit?.plantDesign?.fanwallSystem ? JSON.parse(JSON.stringify(maxAirUnit.plantDesign.fanwallSystem)) : null;
                this.addCoolingPlant({
                    loop: 'air',
                    name: _t('cooling.siteSharedAirName', null, '全廠共用氣冷系統'),
                    memberIds: airMembers,
                    system: sys
                });
            }
        },

        applyHallGroupedConfig() {
            this.applyDedicatedConfig();
            (this.state.halls || []).forEach(hall => {
                const dus = hall.dus || [];
                const liqDus = dus.filter(d => (this.calcDuSummary(d)?.liquidHeatKw || 0) > 0);
                const airDus = dus.filter(d => ((this.calcDuSummary(d)?.airHeatKw || 0) + (this.calcDuSummary(d)?.lossKw || 0)) > 0);

                let liqPlant = null;
                if (liqDus.length > 0) {
                    const sys = JSON.parse(JSON.stringify(liqDus[0].plantDesign.cduSystem));
                    liqPlant = this.addCoolingPlant({
                        loop: 'liquid',
                        name: `${hall.name} - ${_t('cooling.hallLiquidPlant', null, '液冷系統')}`,
                        memberIds: liqDus.map(d => d.id),
                        system: sys
                    });
                }

                let airPlant = null;
                if (airDus.length > 0) {
                    const sys = JSON.parse(JSON.stringify(airDus[0].plantDesign.fanwallSystem));
                    airPlant = this.addCoolingPlant({
                        loop: 'air',
                        name: `${hall.name} - ${_t('cooling.hallAirPlant', null, '氣冷系統')}`,
                        memberIds: airDus.map(d => d.id),
                        system: sys
                    });
                }

                (this.state.corePods || []).filter(p => p.enabled !== false).forEach(pod => {
                    if (Array.isArray(pod.supportsHallIds) && pod.supportsHallIds.includes(hall.id)) {
                        const ps = this.calcCorePodSummary(pod);
                        if (liqPlant && (ps?.liquidHeatKw || 0) > 0 && !liqPlant.memberIds.includes(pod.id)) {
                            this.addPlantMember(liqPlant.id, pod.id);
                        }
                        if (airPlant && ((ps?.airHeatKw || 0) + (ps?.lossKw || 0)) > 0 && !airPlant.memberIds.includes(pod.id)) {
                            this.addPlantMember(airPlant.id, pod.id);
                        }
                    }
                });
            });
        },

        // ─────────────────────────────────────────────────────────────
        // Phase S: 方案管理與快照 (Scenario Management & Snapshot)
        // ─────────────────────────────────────────────────────────────

        createCoolingSnapshot() {
            const unitPlants = {};
            (this.state.halls || []).forEach(h => {
                (h.dus || []).forEach(d => {
                    if (d.plantDesign) {
                        unitPlants[d.id] = JSON.parse(JSON.stringify(d.plantDesign));
                    }
                });
            });
            (this.state.corePods || []).forEach(p => {
                if (p.plantDesign) {
                    unitPlants[p.id] = JSON.parse(JSON.stringify(p.plantDesign));
                }
            });

            return {
                coolingPlants: JSON.parse(JSON.stringify(this.state.coolingPlants || [])),
                unitPlants,
                facilityElectricalLossPct: this.state.facilityElectricalLossPct ?? 4.5
            };
        },

        applyCoolingSnapshot(snapshot) {
            if (!snapshot) return;
            if (Array.isArray(snapshot.coolingPlants)) {
                this.state.coolingPlants = JSON.parse(JSON.stringify(snapshot.coolingPlants));
            } else {
                this.state.coolingPlants = [];
            }

            if (snapshot.unitPlants && typeof snapshot.unitPlants === 'object') {
                (this.state.halls || []).forEach(h => {
                    (h.dus || []).forEach(d => {
                        if (snapshot.unitPlants[d.id]) {
                            d.plantDesign = JSON.parse(JSON.stringify(snapshot.unitPlants[d.id]));
                        }
                    });
                });
                (this.state.corePods || []).forEach(p => {
                    if (snapshot.unitPlants[p.id]) {
                        p.plantDesign = JSON.parse(JSON.stringify(snapshot.unitPlants[p.id]));
                    }
                });
            }

            if (snapshot.facilityElectricalLossPct !== undefined) {
                this.state.facilityElectricalLossPct = snapshot.facilityElectricalLossPct;
            }
        },

        saveCurrentAsScenario(name, note = '') {
            if (!Array.isArray(this.state.scenarios)) {
                this.state.scenarios = [];
            }
            if (this.state.scenarios.length >= 8) {
                return { ok: false, error: _t('scen.maxReached', null, '方案數量已達上限 (最多 8 個方案)') };
            }

            this.calculate();

            const id = makeId('scen');
            const scenNum = this.state.scenarios.length + 1;
            const finalName = (name && name.trim()) ? name.trim() : _t('scen.defaultName', { n: scenNum }, `方案 ${scenNum}`);
            const scenario = {
                id,
                name: finalName,
                note: (note || '').trim(),
                createdAt: new Date().toISOString(),
                snapshot: this.createCoolingSnapshot(),
                resultSummary: null
            };

            this.state.scenarios.push(scenario);
            this.state.activeScenarioId = id;
            this.notify();
            return { ok: true, scenario };
        },

        duplicateScenario(id) {
            if (!Array.isArray(this.state.scenarios)) return null;
            if (this.state.scenarios.length >= 8) {
                return { ok: false, error: _t('scen.maxReached', null, '方案數量已達上限 (最多 8 個方案)') };
            }
            const src = this.state.scenarios.find(s => s.id === id);
            if (!src) return null;

            const newId = makeId('scen');
            const copyName = `${src.name} (${_t('common.copy', null, '副本')})`;
            const clone = {
                id: newId,
                name: copyName,
                note: src.note || '',
                createdAt: new Date().toISOString(),
                snapshot: JSON.parse(JSON.stringify(src.snapshot)),
                resultSummary: src.resultSummary ? JSON.parse(JSON.stringify(src.resultSummary)) : null
            };

            this.state.scenarios.push(clone);
            this.notify();
            return { ok: true, scenario: clone };
        },

        applyScenario(id) {
            if (!Array.isArray(this.state.scenarios)) return false;
            const scen = this.state.scenarios.find(s => s.id === id);
            if (!scen) return false;

            this.applyCoolingSnapshot(scen.snapshot);
            this.state.activeScenarioId = id;
            this.notify();
            return true;
        },

        deleteScenario(id) {
            if (!Array.isArray(this.state.scenarios)) return false;
            const idx = this.state.scenarios.findIndex(s => s.id === id);
            if (idx === -1) return false;

            this.state.scenarios.splice(idx, 1);
            if (this.state.activeScenarioId === id) {
                this.state.activeScenarioId = null;
            }
            this.notify();
            return true;
        },

        updateScenario(id, updates = {}) {
            if (!Array.isArray(this.state.scenarios)) return false;
            const scen = this.state.scenarios.find(s => s.id === id);
            if (!scen) return false;

            if (updates.name !== undefined) scen.name = updates.name.trim();
            if (updates.note !== undefined) scen.note = updates.note;
            this.notify();
            return true;
        },

        saveActiveScenario() {
            if (!this.state.activeScenarioId || !Array.isArray(this.state.scenarios)) return false;
            const scen = this.state.scenarios.find(s => s.id === this.state.activeScenarioId);
            if (!scen) return false;

            this.calculate();
            scen.snapshot = this.createCoolingSnapshot();
            scen.resultSummary = null;
            this.notify();
            return true;
        },

        hasActiveScenarioUnsavedChanges() {
            if (!this.state.activeScenarioId || !Array.isArray(this.state.scenarios)) return false;
            const scen = this.state.scenarios.find(s => s.id === this.state.activeScenarioId);
            if (!scen || !scen.snapshot) return false;

            const curr = this.createCoolingSnapshot();
            return JSON.stringify(curr) !== JSON.stringify(scen.snapshot);
        },

        getScenarioInputHash(scenario) {
            let itSum = 0;
            (this.state.halls || []).forEach(h => (h.dus || []).forEach(d => {
                (d.sus || []).forEach(su => (su.equipment || []).forEach(eq => {
                    itSum += (eq.qty || 0) * (eq.itLoadKw || 0);
                }));
            }));
            const station = this.state.site.stationId || this.state.site.selectedCity || '';
            const snapStr = JSON.stringify(scenario?.snapshot || {});
            const key = `${itSum}_${station}_${snapStr}`;
            let hash = 0;
            for (let i = 0; i < key.length; i++) {
                hash = ((hash << 5) - hash) + key.charCodeAt(i);
                hash |= 0;
            }
            return String(hash);
        },

        getCoolingConfigSummary(scenario) {
            const plants = scenario?.snapshot?.coolingPlants || [];
            if (plants.length === 0) {
                return _t('cooling.dedicated', null, '獨立');
            }
            const liqPlants = plants.filter(p => p.loop === 'liquid');
            const airPlants = plants.filter(p => p.loop === 'air');
            const parts = [];
            const setsWord = _t('common.sets', null, '套');
            if (liqPlants.length > 0) {
                parts.push(`${_t('cooling.liquidLoop', null, '液冷')} ${liqPlants.length} ${setsWord} (${liqPlants[0].redundancy})`);
            }
            if (airPlants.length > 0) {
                parts.push(`${_t('cooling.airLoop', null, '氣冷')} ${airPlants.length} ${setsWord} (${airPlants[0].redundancy})`);
            }
            return parts.join(' / ');
        },

        evaluateScenario(scenario) {
            if (!scenario || !scenario.snapshot) return null;
            if (typeof AnnualRunner === 'undefined') return null;

            const currentHash = this.getScenarioInputHash(scenario);
            if (scenario.resultSummary && scenario.resultSummary.inputHash === currentHash) {
                return scenario.resultSummary;
            }

            const clonedState = JSON.parse(JSON.stringify({
                halls: this.state.halls,
                corePods: this.state.corePods,
                coolingPlants: scenario.snapshot.coolingPlants || [],
                facilityElectricalLossPct: scenario.snapshot.facilityElectricalLossPct ?? this.state.facilityElectricalLossPct,
                assumptions_override: this.state.assumptions_override || {},
                site: {
                    selectedCity: this.state.site.selectedCity,
                    stats: this.state.site.stats,
                    designConditions: this.state.site.designConditions
                }
            }));

            if (scenario.snapshot.unitPlants && typeof scenario.snapshot.unitPlants === 'object') {
                (clonedState.halls || []).forEach(h => {
                    (h.dus || []).forEach(d => {
                        if (scenario.snapshot.unitPlants[d.id]) {
                            d.plantDesign = JSON.parse(JSON.stringify(scenario.snapshot.unitPlants[d.id]));
                        }
                    });
                });
                (clonedState.corePods || []).forEach(p => {
                    if (scenario.snapshot.unitPlants[p.id]) {
                        p.plantDesign = JSON.parse(JSON.stringify(scenario.snapshot.unitPlants[p.id]));
                    }
                });
            }

            const hourlyWeather = (this.state.site.hourly && this.state.site.hourly.length >= 8760) 
                ? this.state.site.hourly 
                : this.generateFallbackWeather();

            const simResults = AnnualRunner.run(clonedState, hourlyWeather, {
                calcDuSummary: (du) => this.calcDuSummary(du),
                calcCorePodSummary: (pod) => this.calcCorePodSummary(pod),
                bridgeDuToPlantModel: (unit, summ) => this.bridgeDuToPlantModel(unit, summ),
                bridgePlantModel: (plant) => this.bridgePlantModel(plant),
                calcHourlyEnergy: (plant, summ, w, pre) => this.calcHourlyEnergy(plant, summ, w, pre),
                calcLiquidLoopHour: (sys, summ, w, pre) => this.calcLiquidLoopHour(sys, summ, w, pre),
                calcAirLoopHour: (sys, summ, w, pre) => this.calcAirLoopHour(sys, summ, w, pre),
                resolveEquipment: (arch, sys) => this.resolveEquipment(arch, sys)
            });

            const overall = simResults.overall || {};
            const bk = overall.breakdownKwh || {};

            let totalChillers = 0;
            let totalHeatRej = 0;
            let totalPumps = 0;

            const countSizingItems = (sizing = []) => {
                (sizing || []).forEach(item => {
                    const qty = item.selectedQty || 0;
                    if (item.key?.includes('chiller')) totalChillers += qty;
                    else if (item.key?.includes('cooler') || item.key?.includes('tower')) totalHeatRej += qty;
                    else if (item.key?.includes('pump')) totalPumps += qty;
                });
            };

            (clonedState.coolingPlants || []).forEach(cp => {
                countSizingItems(cp.system?.sizing);
            });

            (clonedState.halls || []).forEach(h => {
                (h.dus || []).forEach(d => {
                    if (!d.plantDesign?.cduSystem?.plantId) {
                        countSizingItems(d.plantDesign?.cduSystem?.sizing);
                    }
                    if (!d.plantDesign?.fanwallSystem?.plantId) {
                        countSizingItems(d.plantDesign?.fanwallSystem?.sizing);
                    }
                });
            });
            (clonedState.corePods || []).forEach(p => {
                if (!p.plantDesign?.cduSystem?.plantId) {
                    countSizingItems(p.plantDesign?.cduSystem?.sizing);
                }
                if (!p.plantDesign?.fanwallSystem?.plantId) {
                    countSizingItems(p.plantDesign?.fanwallSystem?.sizing);
                }
            });

            const coolingConfigSummary = this.getCoolingConfigSummary(scenario);

            const summary = {
                inputHash: currentHash,
                annualPue: overall.annualPue,
                annualP_Pue: overall.annualP_Pue,
                peakPue: overall.peakPue,
                annualWue: overall.annualWue,
                annualTotalMwh: overall.annualTotalMwh,
                breakdownMwh: {
                    it: Math.round((bk.it || 0) / 1000),
                    cduPump: Math.round(((bk.cduPump || 0) + (bk.cduUnitKwh || 0)) / 1000),
                    crahFan: Math.round((bk.crahFan || 0) / 1000),
                    heatRejection: Math.round((bk.heatRejection || 0) / 1000),
                    chiller: Math.round((bk.chiller || 0) / 1000),
                    loss: Math.round((bk.loss || 0) / 1000)
                },
                coolingConfigSummary,
                totalChillers,
                totalHeatRej,
                totalPumps,
                capacityDeficitHours: overall.capacityDeficitHours || 0
            };

            scenario.resultSummary = summary;
            return summary;
        },

        evaluateAllScenarios() {
            if (!Array.isArray(this.state.scenarios)) return [];
            return this.state.scenarios.map(scen => this.evaluateScenario(scen));
        },

        designConditions() {
            if (this.state.site.design) return this.state.site.design;
            const site = this.state.site;
            const hourly = site.hourly;
            let tmy;
            if (hourly && hourly.length >= 8760) {
                const dbSorted = hourly.map(h => h.db).sort((a, b) => b - a);
                const wbSorted = hourly.map(h => h.wb).sort((a, b) => b - a);
                tmy = {
                    designDb: dbSorted[34], // 35th largest (0.4% exceedance: 8760 * 0.004 = 35.04)
                    designWb: wbSorted[34],
                    maxDb: dbSorted[0]
                };
            } else {
                const maxDb = site.stats?.maxDB ?? 38.0;
                const designDb = site.stats?.maxDB ?? 35.0;
                const designWb = (typeof A === 'function') ? A('design_wb_fallback_c') : 28.0;
                tmy = { designDb, designWb, maxDb };
            }

            const dc = site.designConditions || null;
            const designDb = dc?.cooling?.db004 ?? tmy.designDb;
            const designWb = dc?.cooling?.evapWb004 ?? tmy.designWb;
            const designBasis = dc?.cooling?.db004 != null ? 'ASHRAE 0.4%' : _t('store.tmyRank004', null, 'TMY 排序 0.4%');
            const maxDb = tmy.maxDb;
            const extremes = dc?.extremes ?? null;

            const peakDb = (() => {
                const n = (typeof A === 'function') ? A('design_extreme_return_years') : 20;
                const v = extremes?.dbMax?.[n];
                if (Number.isFinite(v)) {
                    return { value: Math.max(v, tmy.maxDb), basis: _t('store.ashraeRegression', { n }, `ASHRAE n=${n} 年回歸`) };
                }
                const fallbackMargin = (typeof A === 'function') ? A('design_extreme_fallback_margin_c') : 2.0;
                return { value: tmy.maxDb + fallbackMargin, basis: _t('store.tmyMaxMargin', null, 'TMY 最高 + 餘裕（無 ASHRAE 極值）') };
            })();

            const freezeDb = (() => {
                const v = extremes?.dbMin?.[50];
                return Number.isFinite(v) ? { value: v, basis: _t('store.ashrae50Regression', null, 'ASHRAE n=50 年回歸') } : null;
            })();

            let dataQualityWarning = null;
            const n = (typeof A === 'function') ? A('design_extreme_return_years') : 20;
            const vMax = extremes?.dbMax?.[n];
            const gapWarnThreshold = (typeof A === 'function') ? A('design_extreme_tmy_gap_warn_c') : 5.0;
            if (Number.isFinite(vMax) && (peakDb.value - tmy.maxDb > gapWarnThreshold)) {
                const gap = (peakDb.value - tmy.maxDb).toFixed(1);
                dataQualityWarning = _t('warn.ashraeTmyGap', { gap }, `本站 ASHRAE 極值與 TMY 最高溫相差 ${gap}°C，建議核對測站資料`);
            }

            this.state.site.design = {
                designDb,
                designWb,
                designBasis,
                maxDb,
                extremes,
                peakDb,
                freezeDb,
                dataQualityWarning
            };
            return this.state.site.design;
        },

        trimOperatingPoint(cduSys, db_c) {
            const arch = (typeof CoolingArchRegistry !== 'undefined') ? CoolingArchRegistry.get('dry_cooler_trim') : null;
            if (arch && typeof arch.operatingPoint === 'function') {
                return arch.operatingPoint(cduSys, typeof db_c === 'number' ? { db: db_c } : db_c);
            }
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
        generateCduSizing(arch, reqKw, hydKw, helpers = {}) {
            if (typeof SizingEngine !== 'undefined') {
                return SizingEngine.generateCduSizing(arch, reqKw, hydKw, {
                    designConditions: () => this.designConditions(),
                    trimOperatingPoint: (sys, db) => this.trimOperatingPoint(sys, db),
                    ...helpers
                });
            }
            return [];
        },

        // V24 & V27: 依 Fanwall / RDHX 架構動態生成選型清單 (透過 SizingEngine)
        generateFwSizing(arch, reqKw, pumpPowerKw, helpers = {}) {
            if (typeof SizingEngine !== 'undefined') {
                return SizingEngine.generateFwSizing(arch, reqKw, pumpPowerKw, helpers);
            }
            return [];
        },

        updateSelectedEquipment(targetId, sysType, equipKey, model, qty, redundancy, runMode) {
            let targetObj = null;
            this.state.halls.forEach(h => {
                const d = h.dus.find(du => du.id === targetId);
                if (d) targetObj = d;
            });
            if (!targetObj) {
                targetObj = this.state.corePods.find(p => p.id === targetId);
            }
            if (!targetObj) {
                targetObj = (this.state.coolingPlants || []).find(p => p.id === targetId);
                if (targetObj) {
                    const sys = targetObj.system;
                    const item = (sys?.sizing || []).find(s => s.key === equipKey);
                    if (item) {
                        if (model !== undefined) item.selectedModel = model;
                        if (qty !== undefined) item.selectedQty = parseInt(qty, 10);
                        if (redundancy !== undefined) {
                            item.redundancy = redundancy;
                            item.userRedundancyEdited = true;
                        }
                        if (runMode !== undefined) item.runMode = runMode;
                        item.userEdited = true;
                        this.notify();
                    }
                    return;
                }
            }
            if (!targetObj) return;

            const sys = (sysType === 'cdu' || sysType === 'liquid') ? targetObj.plantDesign.cduSystem : targetObj.plantDesign.fanwallSystem;
            const item = (sys.sizing || []).find(s => s.key === equipKey);
            if (item) {
                if (model !== undefined) item.selectedModel = model;
                if (qty !== undefined) item.selectedQty = parseInt(qty, 10);
                if (redundancy !== undefined) {
                    item.redundancy = redundancy;
                    item.userRedundancyEdited = true;
                }
                if (runMode !== undefined) item.runMode = runMode;
                item.userEdited = true;
                this.notify();
            }
        },

        changeSizingRedundancy(targetId, sysType, equipKey, redundancy) {
            this.updateSelectedEquipment(targetId, sysType, equipKey, undefined, undefined, redundancy, undefined);
        },

        changeSizingRunMode(targetId, sysType, equipKey, runMode) {
            this.updateSelectedEquipment(targetId, sysType, equipKey, undefined, undefined, undefined, runMode);
        },

        // v31 修正：localStorage 還原的舊專案裡，sizing[].catalog 是產生當下的靜態快照，
        // 新增/更新 device_catalog 廠商資料後不會自動反映。此函式只替換 catalog 選項清單，
        // 保留使用者已選的 selectedModel/selectedQty，讓舊專案重新整理頁面就能看到新型號。
        refreshDeviceCatalogs() {
            if (typeof CatalogManager === 'undefined') return;

            const KEY_TO_CATEGORY = {
                cdu_unit: 'cdu',
                cdu_pump: 'pump',
                cw_pump: 'pump',
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
            (this.state.coolingPlants || []).forEach(plant => {
                refreshSys(plant.system);
            });
        },

        canProceedStep4() {
            let allPassed = true;
            const failedItems = [];

            const checkSys = (name, targetId, sys, isCdu) => {
                (sys.sizing || []).forEach(item => {
                    if (!item.passed) {
                        allPassed = false;
                        const red = item.redundancy || 'N+1';
                        const standbyLbl = (typeof SizingEngine !== 'undefined' && typeof SizingEngine.standbyLabel === 'function')
                            ? SizingEngine.standbyLabel(red)
                            : (red === 'N' ? 'N' : (red === 'N+2' ? 'N-2' : (red === '2N' ? '2N' : 'N-1')));
                        failedItems.push({
                            targetId: targetId,
                            targetName: name,
                            systemName: isCdu ? _t('store.cduLiquidSys', null, '💧 CDU 液冷') : _t('store.fwAirSys', null, '💨 Fanwall 氣冷'),
                            equipName: item.label,
                            reqText: item.requiredText,
                            selText: item.selectedQty + _t('store.units', null, '台') + ' (' + _t('store.effectiveCap', null, '有效 ') + (item.effectiveCapKw !== undefined ? item.effectiveCapKw : (item.selectedQty * item.unitCapKw)) + ' kW / ' + standbyLbl + ')'
                        });
                    }
                });
            };

            const checkTempCompat = (name, targetId, cduSys) => {
                if (cduSys?.plantId) {
                    const plant = (this.state.coolingPlants || []).find(p => p.id === cduSys.plantId);
                    if (plant && plant.system) {
                        const plantFws = plant.system.fwsSupplyC ?? 42.0;
                        const cduApp = cduSys.cduApproachC ?? 3.0;
                        const chipSupplyReq = cduSys.secSupplyC ?? 45.0;
                        if (chipSupplyReq < plantFws + cduApp) {
                            allPassed = false;
                            failedItems.push({
                                targetId: targetId,
                                targetName: name,
                                systemName: _t('store.cduLiquidSys', null, '💧 CDU 液冷'),
                                equipName: _t('cooling.secSupply', null, '晶片供水溫度'),
                                reqText: `${chipSupplyReq}°C`,
                                selText: `${(plantFws + cduApp).toFixed(1)}°C (${_t('cooling.tempIncompatibleBrief', null, '群組FWS+CDU趨近超出要求')})`
                            });
                        }
                    }
                }
            };

            this.state.halls.forEach(h => {
                h.dus.forEach(du => {
                    checkSys(h.name + ' - ' + du.name, du.id, du.plantDesign.cduSystem, true);
                    checkSys(h.name + ' - ' + du.name, du.id, du.plantDesign.fanwallSystem, false);
                    checkTempCompat(h.name + ' - ' + du.name, du.id, du.plantDesign.cduSystem);
                });
            });

            // P0-1 fix: 跟 view_cooling.js / excel_export.js 使用同一個判定
            // (`!== false`)，避免缺 `enabled` 欄位的舊專案 CorePOD 被悄悄排除。
            this.state.corePods.filter(p => p.enabled !== false).forEach(pod => {
                checkSys(pod.name, pod.id, pod.plantDesign.cduSystem, true);
                checkSys(pod.name, pod.id, pod.plantDesign.fanwallSystem, false);
                checkTempCompat(pod.name, pod.id, pod.plantDesign.cduSystem);
            });

            (this.state.coolingPlants || []).forEach(plant => {
                if (plant.system && !plant.isEmpty && (plant.memberIds || []).length > 0) {
                    checkSys(plant.name, plant.id, plant.system, plant.loop === 'liquid');
                }
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
        runningQtyFromItem(item, allowShare = true) {
            if (!item) return 1;
            const qty = item.selectedQty || 1;
            const redundancy = item.redundancy || 'N+1';
            const runMode = item.runMode || 'standby';
            if (allowShare && runMode === 'share') {
                return Math.max(1, qty);
            }
            if (typeof SizingEngine !== 'undefined' && typeof SizingEngine.runningQty === 'function') {
                return SizingEngine.runningQty(qty, redundancy);
            }
            return Math.max(1, qty - 1);
        },

        runningQtyFromSelected(selectedQty, redundancy = 'N+1') {
            if (typeof SizingEngine !== 'undefined' && typeof SizingEngine.runningQty === 'function') {
                return SizingEngine.runningQty(selectedQty, redundancy);
            }
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
            // 冰機一律 'standby'，不提供 share
            const nRunning = this.runningQtyFromItem(item, false);
            return [{
                model: item.selectedModel,
                cooling_capacity_kw: capKw,
                cop_design: cop,
                t_chws_design: catEntry?.t_chws_c ?? 7.0,
                cop_curve: catEntry?.cop_curve, // 有真實 AHRI 曲線資料時 ChillerEngine 會自動採用，否則退回 flat COP
                qty_running: nRunning,
                qty_total: item.selectedQty,
                redundancy: item.redundancy || 'N+1',
                run_mode: 'standby',
                category: catEntry?.category,
                chiller_type: catEntry?.chiller_type ?? chillerType
            }];
        },

        // v31 Phase 2 / Q-2: 泵浦 → PlantPumpEngine.calcPower() 要的陣列格式。
        // 以水力公式計算之設計點電功率 P_design (hydraulics.pump_power_kw) 取代馬達額定功率。
        resolvePumpFromSizing(item, sys) {
            if (!item || !item.selectedQty) return [];
            const catEntry = (item.catalog || []).find(c => c.model === item.selectedModel);
            const nRunning = this.runningQtyFromItem(item, true);
            const pDesign = (item.key === 'cw_pump')
                ? (sys?.hydraulics?.cw_pump_power_kw ?? item?.requiredKw)
                : (sys?.hydraulics?.pump_power_kw ?? item?.requiredKw);
            const motorCapKw = catEntry?.capKw ?? item.unitCapKw ?? 0;
            const powerKw = (typeof pDesign === 'number' && pDesign > 0 && nRunning > 0)
                ? (pDesign / nRunning)
                : motorCapKw;
            if (!powerKw && !motorCapKw) return [];
            return [{
                model: item.selectedModel,
                power_kw: powerKw,
                p_design: pDesign,
                motor_cap_kw: motorCapKw,
                qty_running: nRunning,
                qty_total: item.selectedQty,
                redundancy: item.redundancy || 'N+1',
                run_mode: item.runMode || 'standby'
            }];
        },

        // v31 Phase 2: CDU 主機 → CDUEngine.calcPower() 要的陣列格式（型錄需同時有 capKw 與 powerKw）。
        // R6 P0-T1: 傳入選型時的高溫降額係數，讓模擬引擎的 PLR 與容量不足判定和 Step 4 一致。
        resolveCduFromSizing(item) {
            if (!item || !item.selectedQty) return [];
            const catEntry = (item.catalog || []).find(c => c.model === item.selectedModel);
            const capKw = catEntry?.capKw ?? item.unitCapKw;
            const powerKw = catEntry?.powerKw;
            if (!capKw || !powerKw) return [];
            const derateFactor = (typeof item.derateFactor === 'number' && item.derateFactor > 0) ? item.derateFactor : 1.0;
            const nRunning = this.runningQtyFromItem(item, true);
            return [{
                model: item.selectedModel,
                nominal_capacity_kw: capKw,
                capacity_kw: capKw * derateFactor,
                derate_factor: derateFactor,
                power_kw: powerKw,
                qty_running: nRunning,
                qty_total: item.selectedQty,
                redundancy: item.redundancy || 'N+1',
                run_mode: item.runMode || 'standby'
            }];
        },

        // v31 Phase 2: CRAH/RDHX 機組 → CRAHEngine.calcPower() 要的陣列格式（型錄需同時有 capKw 與 fanPowerKw）。
        resolveCrahFromSizing(item) {
            if (!item || !item.selectedQty) return [];
            const catEntry = (item.catalog || []).find(c => c.model === item.selectedModel);
            const capKw = catEntry?.capKw ?? item.unitCapKw;
            const fanPowerKw = catEntry?.fanPowerKw;
            if (!capKw || !fanPowerKw) return [];
            const nRunning = this.runningQtyFromItem(item, true);
            return [{
                model: item.selectedModel,
                cooling_capacity_kw: capKw,
                power_kw: fanPowerKw,
                qty_running: nRunning,
                qty_total: item.selectedQty,
                redundancy: item.redundancy || 'N+1',
                run_mode: item.runMode || 'standby'
            }];
        },

        // v31 Phase 2/3: 冷卻塔/乾冷器風扇 → CoolingTowerEngine.calcFanPower() 要的陣列格式（型錄需有 fanKwDx）。
        // fanKwFc 優先用型錄真實值(device_catalog 廠商規格書已有部分機型提供)。
        // R6 P0-F1: 缺乏時沿用額定 fanKwDx，不再無條件砍半；低溫減載由各 Stage 的 VFD 轉速三次方處理。
        resolveTowerFromSizing(item) {
            if (!item || !item.selectedQty) return [];
            const catEntry = (item.catalog || []).find(c => c.model === item.selectedModel);
            const fanKwDx = catEntry?.fanKwDx;
            if (!fanKwDx) return [];
            const nRunning = this.runningQtyFromItem(item, true);
            return [{
                model: item.selectedModel,
                fan_kw_dx: fanKwDx,
                fan_kw_fc: catEntry?.fanKwFc ?? fanKwDx,
                qty_running: nRunning,
                qty_total: item.selectedQty,
                redundancy: item.redundancy || 'N+1',
                run_mode: item.runMode || 'standby',
                fan_control: 'vfd'
            }];
        },

        // P2-1: 依架構描述檔的 equipment 清單解析設備實例
        resolveEquipment(arch, sys) {
            const archDesc = (typeof arch === 'string')
                ? ((typeof CoolingArchRegistry !== 'undefined') ? CoolingArchRegistry.get(arch) : null)
                : arch;
            const equipList = archDesc?.equipment || [];
            const result = {};

            for (const eq of equipList) {
                const item = (sys?.sizing || []).find(s => s.key === eq.key);
                let devices = [];
                const resolver = eq.resolver || eq.role;
                if (resolver === 'tower' || resolver === 'heat_rejection') {
                    devices = this.resolveTowerFromSizing(item);
                } else if (resolver === 'chiller') {
                    devices = this.resolveChillerFromSizing(item, eq.chillerType);
                } else if (resolver === 'cdu') {
                    devices = this.resolveCduFromSizing(item);
                } else if (resolver === 'crah') {
                    devices = this.resolveCrahFromSizing(item);
                } else if (resolver === 'pump') {
                    devices = this.resolvePumpFromSizing(item, sys);
                } else if (eq.role === 'terminal') {
                    if (eq.key === 'cdu_unit') {
                        devices = this.resolveCduFromSizing(item);
                    } else if (eq.key === 'crah_unit' || eq.key === 'rdhx_unit') {
                        devices = this.resolveCrahFromSizing(item);
                    }
                }
                result[eq.key] = devices;
            }
            return result;
        },

        // ═══════════════════════════════════════════════════════════════
        // V22 / C-2: 共用逐時能耗計算函式 — 透過 CoolingArchRegistry 分派
        // ═══════════════════════════════════════════════════════════════
        calcLiquidLoopHour(cduSys, summ, w, pre = null) {
            const liquidHeatKw = (typeof summ === 'number') ? summ : (summ?.liquidHeatKw || 0);
            const cduArch = cduSys.architecture || 'dry_cooler_hx';
            const cduArchDesc = pre ? pre.cduArchDesc : ((typeof CoolingArchRegistry !== 'undefined') ? CoolingArchRegistry.get(cduArch) : null);
            if (!cduArchDesc) throw new Error(`Unknown CDU cooling architecture: "${cduArch}"`);

            const evapFactor = (typeof A === 'function') ? A('ct_evap_m3h_per_kw') : 0.00124;
            const cycles = cduSys.cyclesOfConcentration || 5;
            const cduEquip = pre ? pre.cduEquip : this.resolveEquipment(cduArchDesc, cduSys);

            const designLiqKw = pre ? pre.designLiqKw : (cduSys.designBasis?.liq_load_kw || liquidHeatKw);
            const cduLoadRatio = pre ? pre.cduLoadRatio : (designLiqKw > 0 ? Math.min(1.0, liquidHeatKw / designLiqKw) : 1.0);
            const pt = pre?.pumpTable ? pre.pumpTable[w.wb >= 24 ? 0 : (w.wb >= 16 ? 1 : 2)] : null;
            const cduPumpSpeed = pt ? pt.cduPumpSpeed : (() => {
                const cduOperatingMode = (typeof FreeCoolingEngine !== 'undefined') ? FreeCoolingEngine.getOperatingMode(w.wb) : null;
                const cduPumpMinSpeed = (typeof FreeCoolingEngine !== 'undefined')
                    ? FreeCoolingEngine.getPumpMinSpeed(cduOperatingMode)
                    : 0.45;
                return Math.max(cduPumpMinSpeed, cduLoadRatio);
            })();
            const cduFanMinSpeed = pt ? pt.cduFanMinSpeed : (() => {
                const cduOperatingMode = (typeof FreeCoolingEngine !== 'undefined') ? FreeCoolingEngine.getOperatingMode(w.wb) : null;
                return (typeof FreeCoolingEngine !== 'undefined')
                    ? FreeCoolingEngine.getCtFanMinSpeed(cduOperatingMode)
                    : 0.20;
            })();

            const cduUnitKw = pre ? pre.cduUnitKw : (() => {
                const cduUnits = cduEquip.cdu_unit || [];
                if (cduUnits.length > 0 && typeof CDUEngine !== 'undefined' && liquidHeatKw > 0) {
                    return CDUEngine.calcPower(cduUnits, liquidHeatKw).power_kw;
                } else if (liquidHeatKw > 0) {
                    return (liquidHeatKw / 400) * 2.0;
                }
                return 0;
            })();

            const cduDeficitKw = pre ? pre.cduDeficitKw : (() => {
                const cduUnits = cduEquip.cdu_unit || [];
                if (cduUnits.length > 0 && typeof CDUEngine !== 'undefined' && liquidHeatKw > 0) {
                    return CDUEngine.calcPower(cduUnits, liquidHeatKw).deficit_kw || 0;
                }
                return 0;
            })();

            const cduPumps = pre ? pre.cduPumps : (cduEquip.cdu_pump || []);
            const cduCwPumps = pre ? pre.cduCwPumps : (cduEquip.cw_pump || []);
            let cduPrimaryPumpKw = pt ? pt.cduPrimaryPumpKw : ((cduPumps.length > 0 && typeof PlantPumpEngine !== 'undefined' && liquidHeatKw > 0)
                ? PlantPumpEngine.calcPower(cduPumps, cduPumpSpeed)
                : (liquidHeatKw > 0 ? (liquidHeatKw / 500) * (cduSys.hydraulics?.pump_power_kw || 11.0) : 0));
            if (!pt && liquidHeatKw > 0) {
                if (cduCwPumps.length > 0 && typeof PlantPumpEngine !== 'undefined') {
                    cduPrimaryPumpKw += PlantPumpEngine.calcPower(cduCwPumps, cduPumpSpeed);
                } else if (cduSys.hydraulics?.cw_pump_power_kw) {
                    const baseFrac = 0.15;
                    cduPrimaryPumpKw += cduSys.hydraulics.cw_pump_power_kw * (baseFrac + (1 - baseFrac) * Math.pow(cduPumpSpeed, 3));
                }
            }

            const cduPumpKw = pt ? pt.cduPumpKw : (cduUnitKw + cduPrimaryPumpKw);

            const trimCop = pre ? pre.trimCop : (() => {
                const trimItem = (cduSys.sizing || []).find(s => s.key === 'trim_chiller');
                return trimItem?.catalog?.find(c => c.model === trimItem.selectedModel)?.cop || 6.2;
            })();

            const cduSim = (liquidHeatKw > 0) ? cduArchDesc.simulateHour({
                Q_kw: liquidHeatKw,
                t_supply_c: cduSys.fwsSupplyC,
                t_return_c: cduSys.fwsReturnC,
                w,
                sys: cduSys,
                equip: cduEquip,
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

            const deficitKw = cduDeficitKw + (cduSim.deficitKw || 0);
            const heatRemovedKw = Math.max(0, liquidHeatKw - deficitKw);

            return {
                pumpKw: cduPumpKw,
                unitKw: cduUnitKw,
                primaryPumpKw: cduPrimaryPumpKw,
                fanKw: cduSim.fanKw || 0,
                compressorKw: cduSim.compressorKw || 0,
                waterM3: cduSim.waterM3 || 0,
                mode: cduSim.mode || 'free',
                deficitKw,
                heatRemovedKw,
                mechLoadKw: cduSim.mechLoadKw || 0,
                chillerEnvelopeExceeded: !!cduSim.chillerEnvelopeExceeded
            };
        },

        calcAirLoopHour(fwSys, summ, w, pre = null) {
            const airHeatTotal = (typeof summ === 'number') ? summ : ((summ?.airHeatKw || 0) + (summ?.lossKw || 0));
            const fwArch = fwSys.architecture || 'air_cooled_chiller';
            const fwArchDesc = pre ? pre.fwArchDesc : ((typeof CoolingArchRegistry !== 'undefined') ? CoolingArchRegistry.get(fwArch) : null);
            if (!fwArchDesc) throw new Error(`Unknown Fanwall cooling architecture: "${fwArch}"`);

            const evapFactor = (typeof A === 'function') ? A('ct_evap_m3h_per_kw') : 0.00124;
            const cycles = fwSys.cyclesOfConcentration || 5;
            const fwEquip = pre ? pre.fwEquip : this.resolveEquipment(fwArchDesc, fwSys);

            const chwSupplyC = pre ? pre.chwSupplyC : (fwSys.chwSupplyC || 12.0);
            const chwReturnC = pre ? pre.chwReturnC : (fwSys.chwReturnC || 18.0);
            const fwBaseCop = pre ? pre.fwBaseCop : (chwSupplyC >= 20 ? 5.8 : (chwSupplyC >= 12 ? 4.2 : 3.0));

            const designAirKw = pre ? pre.designAirKw : (fwSys.designBasis?.air_load_kw || airHeatTotal);
            const fwLoadRatio = pre ? pre.fwLoadRatio : (designAirKw > 0 ? Math.min(1.0, airHeatTotal / designAirKw) : 1.0);

            const isFwRdhx = !!fwArchDesc?.flags?.isRdhx;
            const fwUnits = (isFwRdhx ? fwEquip.rdhx_unit : fwEquip.crah_unit) || [];
            const crahFanKw = pre ? pre.crahFanKw : (() => {
                if (fwUnits.length > 0 && typeof CRAHEngine !== 'undefined' && airHeatTotal > 0) {
                    return CRAHEngine.calcPower(fwUnits, airHeatTotal).power_kw;
                }
                return isFwRdhx ? (airHeatTotal / 60) * 1.2 : (airHeatTotal / 60) * 4.8;
            })();

            const crahDeficitKw = pre ? pre.crahDeficitKw : (() => {
                if (fwUnits.length > 0 && typeof CRAHEngine !== 'undefined' && airHeatTotal > 0) {
                    return CRAHEngine.calcPower(fwUnits, airHeatTotal).deficit_kw || 0;
                }
                return 0;
            })();

            const fwPumps = pre ? pre.fwPumps : (fwEquip.fw_pump || []);
            const fwCwPumps = pre ? pre.fwCwPumps : (fwEquip.cw_pump || []);
            const pt = pre?.pumpTable ? pre.pumpTable[w.wb >= 24 ? 0 : (w.wb >= 16 ? 1 : 2)] : null;
            const fwPumpSpeed = pt ? pt.fwPumpSpeed : (() => {
                const fwOperatingMode = (typeof FreeCoolingEngine !== 'undefined') ? FreeCoolingEngine.getOperatingMode(w.wb) : null;
                const fwPumpMinSpeed = (typeof FreeCoolingEngine !== 'undefined')
                    ? FreeCoolingEngine.getPumpMinSpeed(fwOperatingMode)
                    : 0.45;
                return Math.max(fwPumpMinSpeed, fwLoadRatio);
            })();

            const fwFanMinSpeed = pt ? pt.fwFanMinSpeed : (() => {
                const fwOperatingMode = (typeof FreeCoolingEngine !== 'undefined') ? FreeCoolingEngine.getOperatingMode(w.wb) : null;
                return (typeof FreeCoolingEngine !== 'undefined')
                    ? FreeCoolingEngine.getCtFanMinSpeed(fwOperatingMode)
                    : 0.20;
            })();

            let fwPumpKw = pt ? pt.fwPumpKw : ((fwPumps.length > 0 && typeof PlantPumpEngine !== 'undefined' && airHeatTotal > 0)
                ? PlantPumpEngine.calcPower(fwPumps, fwPumpSpeed)
                : 0);
            if (!pt && airHeatTotal > 0) {
                if (fwCwPumps.length > 0 && typeof PlantPumpEngine !== 'undefined') {
                    fwPumpKw += PlantPumpEngine.calcPower(fwCwPumps, fwPumpSpeed);
                } else if (fwSys.hydraulics?.cw_pump_power_kw) {
                    const baseFrac = 0.15;
                    fwPumpKw += fwSys.hydraulics.cw_pump_power_kw * (baseFrac + (1 - baseFrac) * Math.pow(fwPumpSpeed, 3));
                }
            }

            const fwSim = (airHeatTotal > 0) ? fwArchDesc.simulateHour({
                Q_kw: airHeatTotal,
                t_supply_c: chwSupplyC,
                t_return_c: chwReturnC,
                w,
                sys: fwSys,
                equip: fwEquip,
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

            const deficitKw = crahDeficitKw + (fwSim.deficitKw || 0);
            const heatRemovedKw = Math.max(0, airHeatTotal - deficitKw);

            return {
                pumpKw: fwPumpKw,
                crahFanKw,
                fanKw: fwSim.fanKw || 0,
                compressorKw: fwSim.compressorKw || 0,
                waterM3: fwSim.waterM3 || 0,
                mode: fwSim.mode || 'free',
                deficitKw,
                heatRemovedKw,
                mechLoadKw: fwSim.mechLoadKw || 0,
                chillerEnvelopeExceeded: !!fwSim.chillerEnvelopeExceeded
            };
        },

        calcHourlyEnergy(plantDesign, summ, w, pre = null) {
            const cduRes = this.calcLiquidLoopHour(plantDesign.cduSystem, summ, w, pre);
            const fwRes  = this.calcAirLoopHour(plantDesign.fanwallSystem, summ, w, pre);

            const totalDeficitKw = cduRes.deficitKw + fwRes.deficitKw;
            const combinedMode = (cduRes.mode === 'free' && fwRes.mode === 'free')
                ? 'free'
                : ((cduRes.mode === 'mechanical' && fwRes.mode === 'mechanical') ? 'mechanical' : 'partial');
            const airHeatTotal = (typeof summ === 'number') ? summ : ((summ?.airHeatKw || 0) + (summ?.lossKw || 0));
            const liquidHeatKw = (typeof summ === 'number') ? summ : (summ?.liquidHeatKw || 0);
            const isFreeHour = (liquidHeatKw === 0 || cduRes.mode === 'free') && (airHeatTotal === 0 || fwRes.mode === 'free');
            const heatRemovedKw = Math.max(0, liquidHeatKw + airHeatTotal - totalDeficitKw);
            const mechLoadKw = (cduRes.mechLoadKw || 0) + (fwRes.mechLoadKw || 0);

            return {
                cduPumpKw: cduRes.pumpKw + fwRes.pumpKw,
                crahFanKw: fwRes.crahFanKw,
                heatRejKw: cduRes.fanKw + fwRes.fanKw,
                chillerKw: cduRes.compressorKw + fwRes.compressorKw,
                lossKw: summ?.lossKw || 0,
                waterM3: cduRes.waterM3 + fwRes.waterM3,
                isFreeHour,
                capacityDeficitKw: totalDeficitKw,
                heatRemovedKw,
                cduMode: cduRes.mode,
                fwMode: fwRes.mode,
                combinedMode,
                mechLoadKw,
                chillerEnvelopeExceeded: !!(cduRes.chillerEnvelopeExceeded || fwRes.chillerEnvelopeExceeded),
                cduKwh: {
                    unit: cduRes.unitKw,
                    pump: cduRes.primaryPumpKw,
                    heatRej: cduRes.fanKw,
                    chiller: cduRes.compressorKw,
                    trimLoadKw: cduRes.mechLoadKw || 0
                },
                fwKwh: {
                    pump: fwRes.pumpKw,
                    crahFan: fwRes.crahFanKw,
                    heatRej: fwRes.fanKw,
                    chiller: fwRes.compressorKw,
                    chillerLoadKw: fwRes.mechLoadKw || 0
                }
            };
        },

        // ═══════════════════════════════════════════════════════════════
        // 主要液冷架構物理門檻查詢 (Single Source of Truth)
        // 取液冷負載最大單元之架構描述檔計算動態物理門檻供 Step 1 使用
        // ═══════════════════════════════════════════════════════════════
        dominantCduThresholds() {
            let maxLiqKw = -1;
            let targetCduSys = null;

            if (this.state.halls) {
                for (const h of this.state.halls) {
                    if (h.dus) {
                        for (const du of h.dus) {
                            const summ = (typeof this.calcDuSummary === 'function') ? this.calcDuSummary(du) : null;
                            const liqKw = summ?.liquidHeatKw ?? du.plantDesign?.cduSystem?.designBasis?.liq_load_kw ?? 0;
                            if (liqKw > maxLiqKw) {
                                maxLiqKw = liqKw;
                                targetCduSys = du.plantDesign?.cduSystem;
                            }
                        }
                    }
                }
            }
            if (this.state.corePods) {
                for (const pod of this.state.corePods) {
                    const summ = (typeof this.calcCorePodSummary === 'function') ? this.calcCorePodSummary(pod) : null;
                    const liqKw = summ?.liquidHeatKw ?? pod.plantDesign?.cduSystem?.designBasis?.liq_load_kw ?? 0;
                    if (liqKw > maxLiqKw) {
                        maxLiqKw = liqKw;
                        targetCduSys = pod.plantDesign?.cduSystem;
                    }
                }
            }

            if (!targetCduSys) {
                targetCduSys = { architecture: 'dry_cooler_trim', fwsSupplyC: 40.0, fwsReturnC: 55.0, dryCoolerApproachC: 5.0, hasPhe: true, pheApproachC: 2.0 };
            }

            const archKey = targetCduSys.architecture || 'dry_cooler_trim';
            const registry = (typeof window !== 'undefined' && window.CoolingArchRegistry)
                ? window.CoolingArchRegistry
                : ((typeof CoolingArchRegistry !== 'undefined') ? CoolingArchRegistry : null);
            const archDesc = registry ? registry.get(archKey) : null;
            const archName = archDesc?.cardLabel || archDesc?.name || archKey;

            const designCond = (typeof this.designConditions === 'function')
                ? this.designConditions()
                : { designDb: 35.0, designWb: 28.0 };
            const designPoint = { db: designCond.designDb ?? 35.0, wb: designCond.designWb ?? 28.0 };
            const equip = (typeof this.resolveEquipment === 'function' && archDesc)
                ? this.resolveEquipment(archDesc, targetCduSys)
                : {};

            let thresholds = { basis: 'db', full: 33.0, mech: 48.0 };
            if (archDesc?.operatingPoint) {
                const op = archDesc.operatingPoint(targetCduSys, designPoint, equip, { design: designCond });
                if (op?.thresholds) {
                    thresholds = op.thresholds;
                }
            }

            return {
                thresholds,
                archName,
                basis: thresholds.basis || 'db'
            };
        },

        calculate() {
            if (this.state.site && this.state.site.isWeatherLoading) {
                return;
            }
            this.syncAllUnitsFromPlants();
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
                    bridgePlantModel: (plant) => this.bridgePlantModel(plant),
                    calcHourlyEnergy: (plant, summ, w, pre) => this.calcHourlyEnergy(plant, summ, w, pre),
                    calcLiquidLoopHour: (sys, summ, w, pre) => this.calcLiquidLoopHour(sys, summ, w, pre),
                    calcAirLoopHour: (sys, summ, w, pre) => this.calcAirLoopHour(sys, summ, w, pre),
                    resolveEquipment: (arch, sys) => this.resolveEquipment(arch, sys)
                });
            }
        },

        simulateUnit(plantDesign, loadSumm, hourlyWeather, helpers = {}) {
            if (typeof AnnualRunner !== 'undefined') {
                return AnnualRunner.simulateUnit(plantDesign, loadSumm, hourlyWeather, {
                    calcHourlyEnergy: (plant, summ, w, pre) => this.calcHourlyEnergy(plant, summ, w, pre),
                    ...helpers
                });
            }
            throw new Error('AnnualRunner is not loaded');
        },

        bridgeDuToPlantModel(du, duSumm) {
            this.syncUnitFromPlant(du, 'liquid');
            this.syncUnitFromPlant(du, 'air');
            const cduSys = du.plantDesign.cduSystem;
            const fwSys = du.plantDesign.fanwallSystem;

            // 1. CDU 液冷系統
            cduSys.designBasis = {
                liq_load_kw: duSumm.liquidHeatKw,
                dlc_ratio: duSumm.dlcPct
            };

            const arch = cduSys.architecture || 'dry_cooler_hx';
            const cduArchDesc = (typeof CoolingArchRegistry !== 'undefined') ? CoolingArchRegistry.get(arch) : null;
            const hasGlycol = ['dry_cooler_hx', 'dry_cooler_pure', 'dry_cooler_trim', 'cooling_tower_hx'].includes(cduSys.architecture);
            const cpCdu = hasGlycol ? ((typeof A === 'function') ? A('glycol_cp_kj_kgk') : 3.90) : 4.186;
            const dT_cdu = Math.max(1.0, (cduSys.fwsReturnC || 55) - (cduSys.fwsSupplyC || 40));
            const flowLpm_cdu = duSumm.liquidHeatKw > 0 ? Math.round((duSumm.liquidHeatKw * 60) / (cpCdu * 1.0 * dT_cdu)) : 0;
            const pipeCdu = this.selectPipeDnAndVelocity(flowLpm_cdu);

            const baseCduHeadM = cduSys.pumpHeadM ?? ((typeof A === 'function') ? A('cdu_pump_head_default_m') : 28);
            const extraPheHeadM = (cduSys.hasPhe !== false || cduArchDesc?.flags?.isTrim || cduSys.architecture === 'dry_cooler_trim')
                ? ((typeof A === 'function') ? A('phe_secondary_loop_head_m') : 16.0)
                : 0.0;
            const cduHeadM = baseCduHeadM + extraPheHeadM;

            const pumpItemCdu = (cduSys.sizing || []).find(s => s.key === 'cdu_pump');
            const catEntryCdu = pumpItemCdu ? (pumpItemCdu.catalog || []).find(c => c.model === pumpItemCdu.selectedModel) : null;
            const etaPumpCdu = catEntryCdu?.pumpEtaDesign ?? catEntryCdu?.pump_eta_design ?? ((typeof A === 'function') ? A('pump_eta_default') : 0.75);
            const etaMotorCdu = (typeof catEntryCdu?.motor_efficiency_pct === 'number' && catEntryCdu.motor_efficiency_pct > 0)
                ? (catEntryCdu.motor_efficiency_pct / 100)
                : (catEntryCdu?.motorEtaDesign ?? ((typeof A === 'function') ? A('motor_eta_default') : 0.92));
            let cduPumpPowerKw = flowLpm_cdu > 0
                ? (flowLpm_cdu * cduHeadM * 9.80665) / (60000 * etaPumpCdu * etaMotorCdu)
                : 0;

            // P1-H1 / R7-0b: 分離冷凝器側冷卻水泵 (CW Pump) 水力功耗
            let cwPumpPowerKwCdu = 0;
            if ((cduArchDesc?.flags?.needsCwPump || cduArchDesc?.flags?.isWaterChiller || cduSys.architecture === 'water_chiller') && duSumm.liquidHeatKw > 0) {
                const cwDt = (typeof A === 'function') ? A('cw_loop_delta_t_c') : 5.5;
                const cwHeadM = (typeof A === 'function') ? A('cw_pump_head_default_m') : 22.0;
                const chillerItem = (cduSys.sizing || []).find(s => s.key === 'water_cooled_chiller' || s.key === 'trim_chiller');
                const catChiller = chillerItem ? (chillerItem.catalog || []).find(c => c.model === chillerItem.selectedModel) : null;
                const copDesign = catChiller?.cop ?? catChiller?.cop_design;
                const rejFactor = (typeof copDesign === 'number' && copDesign > 0)
                    ? (1 + 1 / copDesign)
                    : ((typeof A === 'function') ? A('tower_heat_rejection_factor') : 1.2);
                const qRejCdu = duSumm.liquidHeatKw * rejFactor;
                const flowLpmCw = (qRejCdu * 60) / (4.186 * cwDt);
                cwPumpPowerKwCdu = (flowLpmCw * cwHeadM * 9.80665) / (60000 * etaPumpCdu * etaMotorCdu);
            }

            cduSys.hydraulics = {
                flow_lpm: flowLpm_cdu,
                pipe_dn: pipeCdu.pipe_dn,
                velocity_mps: pipeCdu.velocity_mps,
                pump_head_m: cduHeadM,
                pump_power_kw: cduPumpPowerKw,
                cw_pump_power_kw: cwPumpPowerKwCdu
            };

            const reqCduKw = duSumm.liquidHeatKw;

            // V21 依架構生成專屬 sizing 清單 (若品項不符則重置)；若加入共用群組則單元端只保留 terminal 終端設備
            if (cduSys.plantId) {
                if (!cduSys.sizing || cduSys.sizing.length === 0 || cduSys.sizingArch !== arch || cduSys.sizing.some(s => s.role !== 'terminal')) {
                    const fullSizing = this.generateCduSizing(arch, reqCduKw, cduSys.hydraulics.pump_power_kw, { cwPumpKw: cduSys.hydraulics.cw_pump_power_kw });
                    cduSys.sizing = fullSizing.filter(s => s.role === 'terminal');
                    cduSys.sizingArch = arch;
                }
            } else {
                if (!cduSys.sizing || cduSys.sizing.length === 0 || cduSys.sizingArch !== arch || cduSys.sizing.every(s => s.role === 'terminal')) {
                    cduSys.sizing = this.generateCduSizing(arch, reqCduKw, cduSys.hydraulics.pump_power_kw, { cwPumpKw: cduSys.hydraulics.cw_pump_power_kw });
                    cduSys.sizingArch = arch;
                }
            }

            if (typeof SizingEngine !== 'undefined') {
                const dCond = this.designConditions();
                SizingEngine.evaluateCduSizing(cduSys, reqCduKw, dCond, {
                    trimOperatingPoint: this.trimOperatingPoint.bind(this)
                });
                cduSys.validation = SizingEngine.validateCdu(cduSys, pipeCdu.velocity_mps, dCond, cduArchDesc);
            }

            // 2. Fanwall 氣冷系統
            fwSys.designBasis = {
                air_load_kw: duSumm.airHeatKw + duSumm.lossKw
            };

            const dT_fw = Math.max(1.0, (fwSys.chwReturnC || 18) - (fwSys.chwSupplyC || 12));
            const airHeatTotal = duSumm.airHeatKw + duSumm.lossKw;
            const flowLpm_fw = airHeatTotal > 0 ? Math.round((airHeatTotal * 60) / (4.186 * 1.0 * dT_fw)) : 0;
            const pipeFw = this.selectPipeDnAndVelocity(flowLpm_fw);

            const fwHeadM = fwSys.pumpHeadM ?? ((typeof A === 'function') ? A('fw_pump_head_default_m') : 22);
            const pumpItemFw = (fwSys.sizing || []).find(s => s.key === 'fw_pump');
            const catEntryFw = pumpItemFw ? (pumpItemFw.catalog || []).find(c => c.model === pumpItemFw.selectedModel) : null;
            const etaPumpFw = catEntryFw?.pumpEtaDesign ?? catEntryFw?.pump_eta_design ?? ((typeof A === 'function') ? A('pump_eta_default') : 0.75);
            const etaMotorFw = (typeof catEntryFw?.motor_efficiency_pct === 'number' && catEntryFw.motor_efficiency_pct > 0)
                ? (catEntryFw.motor_efficiency_pct / 100)
                : (catEntryFw?.motorEtaDesign ?? ((typeof A === 'function') ? A('motor_eta_default') : 0.92));
            const fwArch = fwSys.architecture || 'air_cooled_chiller';
            const fwArchDesc = (typeof CoolingArchRegistry !== 'undefined') ? CoolingArchRegistry.get(fwArch) : null;
            let fwPumpPowerKw = flowLpm_fw > 0
                ? (flowLpm_fw * fwHeadM * 9.80665) / (60000 * etaPumpFw * etaMotorFw)
                : 0;

            // R7-0b: 分離冷凝器側冷卻水泵 (CW Pump) 水力功耗
            let cwPumpPowerKwFw = 0;
            if ((fwArchDesc?.flags?.needsCwPump || fwSys.architecture === 'water_cooled_chiller') && airHeatTotal > 0) {
                const cwDt = (typeof A === 'function') ? A('cw_loop_delta_t_c') : 5.5;
                const cwHeadM = (typeof A === 'function') ? A('cw_pump_head_default_m') : 22.0;
                const chillerItem = (fwSys.sizing || []).find(s => s.key === 'water_cooled_chiller');
                const catChiller = chillerItem ? (chillerItem.catalog || []).find(c => c.model === chillerItem.selectedModel) : null;
                const copDesign = catChiller?.cop ?? catChiller?.cop_design;
                const rejFactor = (typeof copDesign === 'number' && copDesign > 0)
                    ? (1 + 1 / copDesign)
                    : ((typeof A === 'function') ? A('tower_heat_rejection_factor') : 1.2);
                const qRejFw = airHeatTotal * rejFactor;
                const flowLpmCwFw = (qRejFw * 60) / (4.186 * cwDt);
                cwPumpPowerKwFw = (flowLpmCwFw * cwHeadM * 9.80665) / (60000 * etaPumpFw * etaMotorFw);
            }

            fwSys.hydraulics = {
                flow_lpm: flowLpm_fw,
                pipe_dn: pipeFw.pipe_dn,
                velocity_mps: pipeFw.velocity_mps,
                pump_head_m: fwHeadM,
                pump_power_kw: fwPumpPowerKw,
                cw_pump_power_kw: cwPumpPowerKwFw
            };

            const reqAirKw = airHeatTotal;

            // V24 Phase 2: 若架構變更或尚未初始化，依新架構動態生成選型清單；若加入共用群組則單元端只保留 terminal 終端設備
            if (fwSys.plantId) {
                if (!fwSys.sizing || fwSys.sizing.length === 0 || fwSys.sizingArch !== fwArch || fwSys.sizing.some(s => s.role !== 'terminal')) {
                    const fullSizing = this.generateFwSizing(fwArch, reqAirKw, fwSys.hydraulics.pump_power_kw, { cwPumpKw: fwSys.hydraulics.cw_pump_power_kw });
                    fwSys.sizing = fullSizing.filter(s => s.role === 'terminal');
                    fwSys.sizingArch = fwArch;
                }
            } else {
                if (!fwSys.sizing || fwSys.sizing.length === 0 || fwSys.sizingArch !== fwArch || fwSys.sizing.every(s => s.role === 'terminal')) {
                    fwSys.sizing = this.generateFwSizing(fwArch, reqAirKw, fwSys.hydraulics.pump_power_kw, { cwPumpKw: fwSys.hydraulics.cw_pump_power_kw });
                    fwSys.sizingArch = fwArch;
                }
            }

            if (typeof SizingEngine !== 'undefined') {
                SizingEngine.evaluateFwSizing(fwSys, reqAirKw, this.designConditions());
                fwSys.validation = SizingEngine.validateFw(fwSys, pipeFw.velocity_mps);
            }
        },

        // P-3: 共用冷卻系統群組 (Cooling Plant) 橋接、水力計算與設備選型評估
        bridgePlantModel(plant) {
            if (!plant || !plant.system) return;
            if (!Array.isArray(plant.memberIds)) plant.memberIds = [];

            // 建立所有單元快照並清理已被刪除或負載為 0 的成員
            const allUnitsMap = new Map();
            (this.state.halls || []).forEach(h => (h.dus || []).forEach(d => allUnitsMap.set(d.id, d)));
            (this.state.corePods || []).forEach(p => allUnitsMap.set(p.id, p));

            plant.memberIds = plant.memberIds.filter(id => {
                const u = allUnitsMap.get(id);
                if (!u) return false;
                const summ = u.sus ? this.calcDuSummary(u) : this.calcCorePodSummary(u);
                const load = plant.loop === 'liquid' ? summ.liquidHeatKw : (summ.airHeatKw + (summ.lossKw || 0));
                return load > 0;
            });

            if (plant.memberIds.length === 0) {
                plant.isEmpty = true;
                return;
            }
            plant.isEmpty = false;

            // 計算群組成員負載合計
            let sumLoadKw = 0;
            plant.memberIds.forEach(id => {
                const u = allUnitsMap.get(id);
                if (u) {
                    const summ = u.sus ? this.calcDuSummary(u) : this.calcCorePodSummary(u);
                    const load = plant.loop === 'liquid' ? summ.liquidHeatKw : (summ.airHeatKw + (summ.lossKw || 0));
                    sumLoadKw += load;
                }
            });

            const diversity = (typeof plant.diversityFactor === 'number' && plant.diversityFactor > 0)
                ? Math.min(1.0, Math.max(0.1, plant.diversityFactor))
                : 1.0;
            const requiredKw = sumLoadKw * diversity;
            const dCond = this.designConditions();

            if (plant.loop === 'liquid') {
                const cduSys = plant.system;
                cduSys.designBasis = {
                    liq_load_kw: requiredKw,
                    dlc_ratio: 100
                };
                const arch = cduSys.architecture || 'dry_cooler_hx';
                const cduArchDesc = (typeof CoolingArchRegistry !== 'undefined') ? CoolingArchRegistry.get(arch) : null;
                const hasGlycol = ['dry_cooler_hx', 'dry_cooler_pure', 'dry_cooler_trim', 'cooling_tower_hx'].includes(arch);
                const cpCdu = hasGlycol ? ((typeof A === 'function') ? A('glycol_cp_kj_kgk') : 3.90) : 4.186;
                const dT_cdu = Math.max(1.0, (cduSys.fwsReturnC || 55) - (cduSys.fwsSupplyC || 40));
                const flowLpm_cdu = requiredKw > 0 ? Math.round((requiredKw * 60) / (cpCdu * 1.0 * dT_cdu)) : 0;
                const pipeCdu = this.selectPipeDnAndVelocity(flowLpm_cdu);

                const baseCduHeadM = cduSys.pumpHeadM ?? ((typeof A === 'function') ? A('cdu_pump_head_default_m') : 28);
                const extraPheHeadM = (cduSys.hasPhe !== false || cduArchDesc?.flags?.isTrim || cduSys.architecture === 'dry_cooler_trim')
                    ? ((typeof A === 'function') ? A('phe_secondary_loop_head_m') : 16.0)
                    : 0.0;
                const cduHeadM = baseCduHeadM + extraPheHeadM;

                const pumpItemCdu = (cduSys.sizing || []).find(s => s.key === 'cdu_pump');
                const catEntryCdu = pumpItemCdu ? (pumpItemCdu.catalog || []).find(c => c.model === pumpItemCdu.selectedModel) : null;
                const etaPumpCdu = catEntryCdu?.pumpEtaDesign ?? catEntryCdu?.pump_eta_design ?? ((typeof A === 'function') ? A('pump_eta_default') : 0.75);
                const etaMotorCdu = (typeof catEntryCdu?.motor_efficiency_pct === 'number' && catEntryCdu.motor_efficiency_pct > 0)
                    ? (catEntryCdu.motor_efficiency_pct / 100)
                    : (catEntryCdu?.motorEtaDesign ?? ((typeof A === 'function') ? A('motor_eta_default') : 0.92));
                let cduPumpPowerKw = flowLpm_cdu > 0
                    ? (flowLpm_cdu * cduHeadM * 9.80665) / (60000 * etaPumpCdu * etaMotorCdu)
                    : 0;

                let cwPumpPowerKwCdu = 0;
                if ((cduArchDesc?.flags?.needsCwPump || cduArchDesc?.flags?.isWaterChiller || cduSys.architecture === 'water_chiller') && requiredKw > 0) {
                    const cwDt = (typeof A === 'function') ? A('cw_loop_delta_t_c') : 5.5;
                    const cwHeadM = (typeof A === 'function') ? A('cw_pump_head_default_m') : 22.0;
                    const chillerItem = (cduSys.sizing || []).find(s => s.key === 'water_cooled_chiller' || s.key === 'trim_chiller');
                    const catChiller = chillerItem ? (chillerItem.catalog || []).find(c => c.model === chillerItem.selectedModel) : null;
                    const copDesign = catChiller?.cop ?? catChiller?.cop_design;
                    const rejFactor = (typeof copDesign === 'number' && copDesign > 0)
                        ? (1 + 1 / copDesign)
                        : ((typeof A === 'function') ? A('tower_heat_rejection_factor') : 1.2);
                    const qRejCdu = requiredKw * rejFactor;
                    const flowLpmCw = (qRejCdu * 60) / (4.186 * cwDt);
                    cwPumpPowerKwCdu = (flowLpmCw * cwHeadM * 9.80665) / (60000 * etaPumpCdu * etaMotorCdu);
                }

                cduSys.hydraulics = {
                    flow_lpm: flowLpm_cdu,
                    pipe_dn: pipeCdu.pipe_dn,
                    velocity_mps: pipeCdu.velocity_mps,
                    pump_head_m: cduHeadM,
                    pump_power_kw: cduPumpPowerKw,
                    cw_pump_power_kw: cwPumpPowerKwCdu
                };

                // 群組 sizing 只包含主機房設備 (排除 terminal)
                if (!cduSys.sizing || cduSys.sizing.length === 0 || cduSys.sizingArch !== arch || cduSys.sizing.some(s => s.role === 'terminal')) {
                    const fullSizing = this.generateCduSizing(arch, requiredKw, cduSys.hydraulics.pump_power_kw, {
                        cwPumpKw: cduSys.hydraulics.cw_pump_power_kw,
                        defaultRedundancy: plant.redundancy || 'N+1'
                    });
                    cduSys.sizing = fullSizing.filter(s => s.role !== 'terminal');
                    cduSys.sizingArch = arch;
                }

                cduSys.sizing.forEach(s => {
                    if (!s.redundancy) s.redundancy = plant.redundancy || 'N+1';
                });

                if (typeof SizingEngine !== 'undefined') {
                    SizingEngine.evaluateCduSizing(cduSys, requiredKw, dCond, {
                        trimOperatingPoint: this.trimOperatingPoint.bind(this)
                    });
                    cduSys.validation = SizingEngine.validateCdu(cduSys, pipeCdu.velocity_mps, dCond, cduArchDesc);
                }
            } else {
                // Air loop
                const fwSys = plant.system;
                fwSys.designBasis = {
                    air_load_kw: requiredKw
                };
                const fwArch = fwSys.architecture || 'air_cooled_chiller';
                const fwArchDesc = (typeof CoolingArchRegistry !== 'undefined') ? CoolingArchRegistry.get(fwArch) : null;
                const dT_fw = Math.max(1.0, (fwSys.chwReturnC || 18) - (fwSys.chwSupplyC || 12));
                const flowLpm_fw = requiredKw > 0 ? Math.round((requiredKw * 60) / (4.186 * 1.0 * dT_fw)) : 0;
                const pipeFw = this.selectPipeDnAndVelocity(flowLpm_fw);

                const fwHeadM = fwSys.pumpHeadM ?? ((typeof A === 'function') ? A('fw_pump_head_default_m') : 22);
                const pumpItemFw = (fwSys.sizing || []).find(s => s.key === 'fw_pump');
                const catEntryFw = pumpItemFw ? (pumpItemFw.catalog || []).find(c => c.model === pumpItemFw.selectedModel) : null;
                const etaPumpFw = catEntryFw?.pumpEtaDesign ?? catEntryFw?.pump_eta_design ?? ((typeof A === 'function') ? A('pump_eta_default') : 0.75);
                const etaMotorFw = (typeof catEntryFw?.motor_efficiency_pct === 'number' && catEntryFw.motor_efficiency_pct > 0)
                    ? (catEntryFw.motor_efficiency_pct / 100)
                    : (catEntryFw?.motorEtaDesign ?? ((typeof A === 'function') ? A('motor_eta_default') : 0.92));
                let fwPumpPowerKw = flowLpm_fw > 0
                    ? (flowLpm_fw * fwHeadM * 9.80665) / (60000 * etaPumpFw * etaMotorFw)
                    : 0;

                let cwPumpPowerKwFw = 0;
                if ((fwArchDesc?.flags?.needsCwPump || fwSys.architecture === 'water_cooled_chiller') && requiredKw > 0) {
                    const cwDt = (typeof A === 'function') ? A('cw_loop_delta_t_c') : 5.5;
                    const cwHeadM = (typeof A === 'function') ? A('cw_pump_head_default_m') : 22.0;
                    const chillerItem = (fwSys.sizing || []).find(s => s.key === 'water_cooled_chiller');
                    const catChiller = chillerItem ? (chillerItem.catalog || []).find(c => c.model === chillerItem.selectedModel) : null;
                    const copDesign = catChiller?.cop ?? catChiller?.cop_design;
                    const rejFactor = (typeof copDesign === 'number' && copDesign > 0)
                        ? (1 + 1 / copDesign)
                        : ((typeof A === 'function') ? A('tower_heat_rejection_factor') : 1.2);
                    const qRejFw = requiredKw * rejFactor;
                    const flowLpmCwFw = (qRejFw * 60) / (4.186 * cwDt);
                    cwPumpPowerKwFw = (flowLpmCwFw * cwHeadM * 9.80665) / (60000 * etaPumpFw * etaMotorFw);
                }

                fwSys.hydraulics = {
                    flow_lpm: flowLpm_fw,
                    pipe_dn: pipeFw.pipe_dn,
                    velocity_mps: pipeFw.velocity_mps,
                    pump_head_m: fwHeadM,
                    pump_power_kw: fwPumpPowerKw,
                    cw_pump_power_kw: cwPumpPowerKwFw
                };

                // 群組 sizing 只包含主機房設備 (排除 terminal)
                if (!fwSys.sizing || fwSys.sizing.length === 0 || fwSys.sizingArch !== fwArch || fwSys.sizing.some(s => s.role === 'terminal')) {
                    const fullSizing = this.generateFwSizing(fwArch, requiredKw, fwSys.hydraulics.pump_power_kw, {
                        cwPumpKw: fwSys.hydraulics.cw_pump_power_kw,
                        defaultRedundancy: plant.redundancy || 'N+1'
                    });
                    fwSys.sizing = fullSizing.filter(s => s.role !== 'terminal');
                    fwSys.sizingArch = fwArch;
                }

                fwSys.sizing.forEach(s => {
                    if (!s.redundancy) s.redundancy = plant.redundancy || 'N+1';
                });

                if (typeof SizingEngine !== 'undefined') {
                    SizingEngine.evaluateFwSizing(fwSys, requiredKw, dCond);
                    fwSys.validation = SizingEngine.validateFw(fwSys, pipeFw.velocity_mps);
                }
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
