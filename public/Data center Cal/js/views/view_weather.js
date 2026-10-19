/**
 * view_weather.js - Step 1: 1:1 Port of epw原始氣象資料解析器.html (Real Climate Analyzer)
 * - 8,760h Free Cooling Potential KPI Dashboard (Mode 1 Full Free Cooling, Mode 2 Trim, Mode 3 Mechanical)
 * - Dynamic Bin Analysis with threshold-based color coding
 * - Monthly FC stacked breakdown & 12-month climate trend charts with threshold guideline overlays
 */
(function(window) {
    'use strict';

    let binChart = null;
    let fcChart = null;
    let trendChart = null;
    let selectedBinMetric = 'db'; // 'db' | 'wb' | 'dp' | 'rh'
    let selectedBinStep = 2;
    const t = (k, p, fb) => (window.I18N ? window.I18N.t(k, p) : (fb || k));

    const ViewWeather = {
        builtinList: [
            { key: '桃園 (Taoyuan Pilot)', country: 'Taiwan', countryZh: '台灣', countryCode: 'TWN', flag: '🇹🇼', continent: 'Asia', desc: 'Vera Rubin Pilot 標竿案場 (真實 EPW)', db: 22.8, wb: 19.5, dp: 17.2, rh: 76.5 },
            { key: '新加坡 (Singapore)', country: 'Singapore', countryZh: '新加坡', countryCode: 'SGP', flag: '🇸🇬', continent: 'Asia', desc: '東南亞超大規模數據中心樞紐 (樟宜 EPW)', db: 28.0, wb: 25.1, dp: 24.1, rh: 80.0 },
            { key: '高雄 (Kaohsiung)', country: 'Taiwan', countryZh: '台灣', countryCode: 'TWN', flag: '🇹🇼', continent: 'Asia', desc: '南台灣高溫高濕案場 (真實 EPW)', db: 25.5, wb: 22.0, dp: 20.1, rh: 78.0 },
            { key: '新竹 (Hsinchu)', country: 'Taiwan', countryZh: '台灣', countryCode: 'TWN', flag: '🇹🇼', continent: 'Asia', desc: '竹科半導體園區 (真實 EPW)', db: 23.0, wb: 19.8, dp: 17.5, rh: 75.0 },
            { key: '台中 (Taichung)', country: 'Taiwan', countryZh: '台灣', countryCode: 'TWN', flag: '🇹🇼', continent: 'Asia', desc: '中台灣氣候 (真實 EPW)', db: 23.8, wb: 20.2, dp: 18.0, rh: 74.0 },
            { key: '菲律賓 (Ambulong)', country: 'Philippines', countryZh: '菲律賓', countryCode: 'PHL', flag: '🇵🇭', continent: 'Asia', desc: '東南亞熱帶氣候 (真實 EPW)', db: 27.8, wb: 24.5, dp: 23.0, rh: 82.0 },
            { key: '美國 (Alabama Andalusia)', country: 'United States', countryZh: '美國', countryCode: 'USA', flag: '🇺🇸', continent: 'Americas', desc: '美洲海外資料中心 (真實 EPW)', db: 18.5, wb: 15.2, dp: 13.0, rh: 68.0 }
        ],
        searchQuery: '',
        continentFilter: '',
        countryFilter: '',
        zoneFilter: '',
        fileProtocolError: false,
        isLoading: false,
        loadingStationId: null,
        stationsList: null,

        initStations() {
            if (this.stationsList && this.stationsList.length > 0) {
                return Promise.resolve(this.stationsList);
            }
            if (window.WeatherSource) {
                return window.WeatherSource.listStations().then(list => {
                    this.stationsList = list || [];
                    this.renderStationList();
                    const sel = document.getElementById('stationCountrySelect');
                    if (sel) sel.innerHTML = '<option value="">' + t('weather.allCountries', null, '全部國家') + '</option>' + this.getCountryOptions();
                    const countEl = document.getElementById('stationCountBadge');
                    if (countEl) countEl.innerText = t('weather.stationCount', { n: this.stationsList.length }, `共 ${this.stationsList.length} 站`);
                    return this.stationsList;
                });
            }
            return Promise.resolve([]);
        },

        getInitialStations() {
            if (this.stationsList && this.stationsList.length > 0) return this.stationsList;
            const globalStations = (typeof window !== 'undefined' ? window.BUILTIN_WEATHER_STATIONS : null) ||
                                   (typeof BUILTIN_WEATHER_STATIONS !== 'undefined' ? BUILTIN_WEATHER_STATIONS : null);
            if (globalStations && globalStations.length > 0) {
                return globalStations;
            }
            return this.builtinList.map(c => ({
                id: window.WeatherSource?.REVERSE_BUILTIN_MAP?.[c.key] || c.key,
                city: c.key,
                cityZh: c.key,
                stationName: c.key,
                country: c.country,
                countryZh: c.countryZh,
                countryCode: c.countryCode,
                flag: c.flag,
                continent: c.continent,
                extDB: c.db,
                extWB: c.wb,
                source: 'builtin',
                available: true,
                builtinKey: c.key
            }));
        },

        onSearch(q) {
            this.searchQuery = q || '';
            this.renderStationList();
        },

        onFilterContinent(val) {
            this.continentFilter = val || '';
            this.countryFilter = '';
            const sel = document.getElementById('stationCountrySelect');
            if (sel) sel.innerHTML = '<option value="">' + t('weather.allCountries', null, '全部國家') + '</option>' + this.getCountryOptions();
            this.renderStationList();
        },

        onFilterCountry(val) {
            this.countryFilter = val || '';
            this.renderStationList();
        },

        onFilterZone(val) {
            this.zoneFilter = val || '';
            this.renderStationList();
        },

        getCountryOptions() {
            const list = this.stationsList || this.getInitialStations();
            const filtered = this.continentFilter ? list.filter(s => s.continent === this.continentFilter) : list;
            const isEn = (window.I18N && window.I18N.lang === 'en');
            const countries = [...new Set(filtered.map(s => (isEn ? (s.country || s.countryZh) : (s.countryZh || s.country))).filter(Boolean))].sort((a,b) => a.localeCompare(b, isEn ? 'en' : 'zh-Hant'));
            return countries.map(c => `<option value="${c}" ${this.countryFilter === c ? 'selected' : ''}>${c}</option>`).join('');
        },

        filterStations() {
            let list = this.stationsList || this.getInitialStations();
            if (this.searchQuery) {
                const q = this.searchQuery.trim().toLowerCase();
                list = list.filter(s => {
                    return (s.cityZh && s.cityZh.toLowerCase().includes(q)) ||
                           (s.city && s.city.toLowerCase().includes(q)) ||
                           (s.countryZh && s.countryZh.toLowerCase().includes(q)) ||
                           (s.country && s.country.toLowerCase().includes(q)) ||
                           (s.countryCode && s.countryCode.toLowerCase().includes(q)) ||
                           (s.id && s.id.toLowerCase().includes(q)) ||
                           (s.wmo && String(s.wmo).includes(q));
                });
            }
            if (this.continentFilter) {
                list = list.filter(s => s.continent === this.continentFilter);
            }
            if (this.countryFilter) {
                list = list.filter(s => (s.countryZh === this.countryFilter || s.country === this.countryFilter || s.countryCode === this.countryFilter));
            }
            if (this.zoneFilter) {
                list = list.filter(s => s.zone === this.zoneFilter);
            }
            return list;
        },

        renderStationCardsHtml() {
            if (this.isLoading) {
                return '<div class="p-4 text-center text-xs text-emerald-800 font-bold bg-emerald-50 rounded-lg flex items-center justify-center gap-2">' + t('weather.loadingHourly', null, '⏳ 正在載入測站逐時氣象資料...') + '</div>';
            }
            const site = window.AppStore.state.site || {};
            const filtered = this.filterStations();
            if (filtered.length === 0) {
                return '<div class="p-6 text-center text-xs text-slate-400">' + t('weather.noStations', null, '無符合條件之氣象測站') + '</div>';
            }
            const toShow = filtered.slice(0, 50);
            return toShow.map(s => {
                const isSelected = (site.stationId && s.id === site.stationId) ||
                    (s.builtinKey && site.selectedCity === s.builtinKey) ||
                    (site.selectedCity === s.cityZh) ||
                    (site.selectedCity === s.id);
                const activeCls = isSelected
                    ? 'border-emerald-500 bg-emerald-50/90 shadow-md ring-2 ring-emerald-400'
                    : 'border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50/70';
                const v20 = s.designConditions?.extremes?.dbMax?.['20'] ?? s.designConditions?.extremes?.dbMax?.[20];
                const hasWarn = (v20 != null && s.maxDB != null && (v20 - s.maxDB > 5.0));

                const isEn = (window.I18N && window.I18N.lang === 'en');
                const cityDisplay = isEn ? (s.stationName || s.city || s.cityZh) : (s.cityZh || s.city);
                const countryDisplay = isEn ? (s.country || s.countryCode || s.countryZh) : (s.countryZh || s.country);

                return `
                    <button type="button" onclick="ViewWeather.selectStation('${s.id}')" class="w-full text-left p-2.5 rounded-xl border transition ${activeCls}">
                        <div class="flex items-center justify-between gap-2">
                            <div class="flex items-center gap-1.5 min-w-0">
                                <span class="text-base shrink-0">${s.flag || '🌐'}</span>
                                <span class="text-xs font-black text-slate-800 truncate">${cityDisplay}</span>
                                <span class="text-[10px] text-slate-400 truncate">(${countryDisplay})</span>
                            </div>
                            <div class="flex items-center gap-1.5 shrink-0">
                                ${s.source === 'builtin' ? '<span class="text-[10px] bg-emerald-100 text-emerald-800 border border-emerald-300 px-1.5 py-0.5 rounded font-bold">' + t('weather.offlineBadge', null, '內建・離線可用') + '</span>' : ''}
                                ${hasWarn ? '<span title="' + t('weather.warnDiff', null, '本站 ASHRAE 20年極值與 TMY 最高溫相差 > 5°C') + '" class="text-xs cursor-help">⚠️</span>' : ''}
                            </div>
                        </div>
                        <div class="flex items-center gap-3 mt-1 text-[10px] text-slate-500">
                            <span>${t('weather.designDb', null, '0.4% 設計乾球:')} <b class="text-slate-700">${s.extDB != null ? s.extDB + '°C' : '-'}</b></span>
                            ${v20 != null ? `<span>${t('weather.extremeDb20', null, '20年回歸最高:')} <b class="text-amber-700">${v20}°C</b></span>` : ''}
                            ${s.zone ? `<span>${t('weather.climateZone', null, '氣候區:')} <b class="text-slate-600">${s.zone}</b></span>` : ''}
                        </div>
                    </button>
                `;
            }).join('');
        },

        renderStationList() {
            const listEl = document.getElementById('stationListContainer');
            if (listEl) {
                listEl.innerHTML = this.renderStationCardsHtml();
            }
        },

        render(container) {
            const state = window.AppStore.state;
            const site = state.site;
            const stats = site.stats || { avgDB: 22.8, maxDB: 36.4, minDB: 8.5, avgWB: 19.5, avgDP: 17.2, avgRH: 76.5 };

            const domThresh = window.AppStore ? window.AppStore.dominantCduThresholds() : null;
            const archName = domThresh?.archName || t('weather.dominantArch', null, '主要液冷架構');
            const basis = domThresh?.basis || 'db';
            const thresholds = domThresh?.thresholds || { basis: 'db', full: 35.0, mech: 47.0 };
            const mode1Max = thresholds.full;
            const mode2Max = thresholds.mech;

            // 計算 8,760h 自由冷卻時數與佔比
            const hourly = site.hourly || [];
            let climateFreeCount = 0, climateTrimCount = 0, climateMechCount = 0;

            if (hourly.length >= 8760) {
                for (let i = 0; i < 8760; i++) {
                    const w = hourly[i] || { db: 25, wb: 20 };
                    const val = (basis === 'wb') ? (w.wb ?? 20) : (w.db ?? 25);
                    if (mode1Max != null && val <= mode1Max) {
                        climateFreeCount++;
                    } else if (mode2Max != null && val <= mode2Max) {
                        climateTrimCount++;
                    } else {
                        climateMechCount++;
                    }
                }
            } else {
                climateFreeCount = (mode1Max != null) ? 8760 : 0;
                climateTrimCount = 0;
                climateMechCount = (mode1Max != null) ? 0 : 8760;
            }

            const freePct = ((climateFreeCount / 8760) * 100).toFixed(1);
            const trimPct = ((climateTrimCount / 8760) * 100).toFixed(1);
            const mechPct = ((climateMechCount / 8760) * 100).toFixed(1);
            const totalFcHours = climateFreeCount + climateTrimCount;
            const totalFcPct = (((climateFreeCount + climateTrimCount) / 8760) * 100).toFixed(1);

            if (!this.stationsList) {
                this.initStations();
            }

            const countryOptions = this.getCountryOptions();
            const totalStationsCount = (this.stationsList || this.getInitialStations()).length;
            const fileProtocolWarning = this.fileProtocolError ? `
                <div class="p-3 mb-3 bg-amber-50 border border-amber-300 rounded-xl text-xs text-amber-900 flex items-start gap-2 shadow-xs">
                    <span class="text-base shrink-0">⚠️</span>
                    <div class="space-y-1">
                        <div class="font-bold">${t('weather.fileProtocolTitle', null, '直接開啟 HTML 檔案時，瀏覽器不允許讀取本機氣象資料。')}</div>
                        <div class="text-[11px] text-amber-800">${t('weather.fileProtocolDesc', null, '請改用桌面版 <b>PUE計算系統.exe</b>、線上版，或在此資料夾執行 <code>npx serve</code> 後用 <code>http://localhost</code> 開啟。也可以下載該站 EPW 後用「上傳 EPW」。')}</div>
                        <div class="text-[11px] text-emerald-800 font-semibold pt-0.5">${t('weather.fileProtocolOffline', null, '標示為「內建・離線可用」的測站仍可正常選用。')}</div>
                    </div>
                </div>
            ` : '';

            container.innerHTML = `
                <div class="space-y-6">
                    <!-- 標題與聲明 -->
                    <div class="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                        <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div>
                                <h2 class="text-xl font-bold text-slate-900 flex items-center gap-2">
                                    <span>📍</span> ${t('weather.stepTitle', null, 'Step 1: 案場 8,760h 氣象動力學分析 (EPW Climate Analyzer)')}
                                </h2>
                                <p class="text-sm text-slate-500 mt-1">
                                    ${t('weather.stepDescHtml', null, '完整載入 EnergyPlus EPW 逐時數據。<strong>本頁為先天環境氣候分析（Bin Analysis / FC可用時數 / 雙軸趨勢），不依賴後續設備配置</strong>。')}
                                </p>
                            </div>
                            <span class="px-3.5 py-1.5 bg-emerald-100 text-emerald-900 text-xs font-bold rounded-xl border border-emerald-300 shadow-2xs">
                                ${t('weather.badgeEpw', null, '8,760h EPW 完整解析')}
                            </span>
                        </div>

                        <!-- 測站與城市選擇 -->
                        <div class="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-6">
                            <div class="lg:col-span-2 space-y-2.5">
                                <div class="flex items-center justify-between">
                                    <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider">${t('weather.selectStation', null, '選擇案場氣象測站 (165 站全球氣候資料庫)')}</label>
                                    <span id="stationCountBadge" class="text-[11px] text-slate-400 font-medium">${t('weather.stationCount', { n: totalStationsCount }, `共 ${totalStationsCount} 站`)}</span>
                                </div>

                                ${fileProtocolWarning}

                                <!-- 搜尋與篩選列 -->
                                <div class="grid grid-cols-1 sm:grid-cols-12 gap-2">
                                    <div class="sm:col-span-6 relative">
                                        <input type="text" id="stationSearchInput" placeholder="${t('weather.searchPlaceholder', null, '搜尋城市、國家、WMO (例如: 台北, Tokyo, 545110)...')}"
                                            value="${this.searchQuery || ''}"
                                            oninput="ViewWeather.onSearch(this.value)"
                                            class="w-full text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 pl-7 bg-white text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none">
                                        <span class="absolute left-2 top-2 text-xs text-slate-400">🔍</span>
                                    </div>
                                    <div class="sm:col-span-2">
                                        <select id="stationContinentSelect" onchange="ViewWeather.onFilterContinent(this.value)" class="w-full text-xs border border-slate-300 rounded-lg px-2 py-1.5 bg-white text-slate-700">
                                            <option value="">${t('weather.allContinents', null, '全部洲別')}</option>
                                            <option value="Asia" ${this.continentFilter === 'Asia' ? 'selected' : ''}>${t('weather.continentAsia', null, '亞洲 (Asia)')}</option>
                                            <option value="Americas" ${this.continentFilter === 'Americas' ? 'selected' : ''}>${t('weather.continentAmericas', null, '美洲 (Americas)')}</option>
                                            <option value="Europe" ${this.continentFilter === 'Europe' ? 'selected' : ''}>${t('weather.continentEurope', null, '歐洲 (Europe)')}</option>
                                            <option value="Africa" ${this.continentFilter === 'Africa' ? 'selected' : ''}>${t('weather.continentAfrica', null, '非洲 (Africa)')}</option>
                                            <option value="Oceania" ${this.continentFilter === 'Oceania' ? 'selected' : ''}>${t('weather.continentOceania', null, '大洋洲 (Oceania)')}</option>
                                        </select>
                                    </div>
                                    <div class="sm:col-span-2">
                                        <select id="stationCountrySelect" onchange="ViewWeather.onFilterCountry(this.value)" class="w-full text-xs border border-slate-300 rounded-lg px-2 py-1.5 bg-white text-slate-700">
                                            <option value="">${t('weather.allCountries', null, '全部國家')}</option>
                                            ${countryOptions}
                                        </select>
                                    </div>
                                    <div class="sm:col-span-2">
                                        <select id="stationZoneSelect" onchange="ViewWeather.onFilterZone(this.value)" class="w-full text-xs border border-slate-300 rounded-lg px-2 py-1.5 bg-white text-slate-700">
                                            <option value="">${t('weather.allZones', null, '全部氣候區')}</option>
                                            <option value="0A" ${this.zoneFilter === '0A' ? 'selected' : ''}>${t('weather.zone0A', null, '0A (極端濕熱)')}</option>
                                            <option value="1A" ${this.zoneFilter === '1A' ? 'selected' : ''}>${t('weather.zone1A', null, '1A (極熱濕潤)')}</option>
                                            <option value="2A" ${this.zoneFilter === '2A' ? 'selected' : ''}>${t('weather.zone2A', null, '2A (高溫濕潤)')}</option>
                                            <option value="3A" ${this.zoneFilter === '3A' ? 'selected' : ''}>${t('weather.zone3A', null, '3A (溫暖濕潤)')}</option>
                                            <option value="4A" ${this.zoneFilter === '4A' ? 'selected' : ''}>${t('weather.zone4A', null, '4A (混和濕潤)')}</option>
                                            <option value="5A" ${this.zoneFilter === '5A' ? 'selected' : ''}>${t('weather.zone5A', null, '5A (冷涼)')}</option>
                                            <option value="6A" ${this.zoneFilter === '6A' ? 'selected' : ''}>${t('weather.zone6A', null, '6A (寒冷)')}</option>
                                        </select>
                                    </div>
                                </div>

                                <!-- 測站清單滾動區 (顯示前 50 筆) -->
                                <div id="stationListContainer" class="max-h-[300px] overflow-y-auto space-y-1.5 pr-1 border border-slate-200 rounded-xl p-2 bg-slate-50/40">
                                    ${this.renderStationCardsHtml()}
                                </div>
                            </div>
                            <div>
                                <label class="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">${t('weather.uploadEpwTitle', null, '上傳自定義 EPW 檔案')}</label>
                                <div id="weatherDropZone" class="border-2 border-dashed border-emerald-400 hover:border-emerald-600 rounded-xl p-5 text-center bg-emerald-50/40 cursor-pointer flex flex-col items-center justify-center min-h-[160px] transition">
                                    <span class="text-xl">📂</span>
                                    <div class="text-xs font-bold text-emerald-950 mt-1">${t('weather.dropPrompt', null, '點擊或拖曳 .epw 檔案')}</div>
                                    <div class="text-[10px] text-slate-500 mt-0.5">${t('weather.dropSub', null, '支援 EnergyPlus EPW 格式')}</div>
                                    <input type="file" id="weatherFileInput" accept=".epw,.csv" class="hidden">
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- 版面 1: 測站核心氣候 KPI 卡片 -->
                    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                            <span class="text-xs font-bold uppercase text-slate-400">${t('weather.kpiDb', null, '乾球溫度 (DB)')}</span>
                            <div class="text-2xl font-black text-slate-900 mt-1.5">${stats.avgDB}°C</div>
                            <div class="text-[11px] text-slate-500 mt-1">${t('weather.kpiDbRange', { min: stats.minDB, max: stats.maxDB }, `極小 ${stats.minDB}°C ~ 極大 ${stats.maxDB}°C`)}</div>
                        </div>
                        <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                            <span class="text-xs font-bold uppercase text-slate-400">${t('weather.kpiWb', null, '濕球溫度 (WB)')}</span>
                            <div class="text-2xl font-black text-cyan-700 mt-1.5">${stats.avgWB}°C</div>
                            <div class="text-[11px] text-slate-500 mt-1">${t('weather.kpiWbRange', { min: stats.minWB, max: stats.maxWB }, `極小 ${stats.minWB}°C ~ 極大 ${stats.maxWB}°C`)}</div>
                        </div>
                        <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                            <span class="text-xs font-bold uppercase text-slate-400">${t('weather.kpiDp', null, '露點溫度 (DP)')}</span>
                            <div class="text-2xl font-black text-blue-700 mt-1.5">${stats.avgDP || 17.2}°C</div>
                            <div class="text-[11px] text-slate-500 mt-1">${t('weather.kpiDpDesc', null, '防結露控制基準')}</div>
                        </div>
                        <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                            <span class="text-xs font-bold uppercase text-slate-400">${t('weather.kpiRh', null, '相對濕度 (RH)')}</span>
                            <div class="text-2xl font-black text-teal-700 mt-1.5">${stats.avgRH || 76.5}%</div>
                            <div class="text-[11px] text-slate-500 mt-1">${t('weather.kpiRhDesc', null, '全年度 8,760 小時均值')}</div>
                        </div>
                    </div>

                    <!-- 版面 1.5: 自由冷卻氣候門檻 (依主要架構物理門檻) -->
                    <div class="bg-gradient-to-r from-emerald-50/80 to-teal-50/80 p-5 rounded-2xl border-2 border-emerald-300 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                        <div>
                            <h3 class="text-sm font-black text-emerald-950 flex items-center gap-1.5">
                                <span>⚙️</span> ${t('weather.threshTitle', { arch: archName }, `自由冷卻運轉模式氣候門檻（依 ${archName} 門檻）`)}
                            </h3>
                            <p class="text-xs text-emerald-800/90 mt-0.5">
                                ${basis === 'wb' ? t('weather.threshDescWb', null, '以室外濕球溫度 (WB) 為基準，依密閉塔與板換溫差計算全時直冷門檻。') : t('weather.threshDescDb', null, '以室外乾球溫度 (DB) 為基準，依乾冷器與板換溫差計算全直冷與輔助冷卻門檻。')}
                            </p>
                        </div>
                        <div class="flex items-center gap-3 flex-wrap">
                            <div class="bg-white px-3 py-1.5 rounded-xl border border-emerald-300 shadow-xs flex items-center gap-2 text-xs">
                                <span class="font-bold text-emerald-900">${t('weather.mode1Thresh', null, '🟢 Mode 1 全直冷門檻:')}</span>
                                <span class="font-black text-emerald-800 text-sm">${mode1Max != null ? `${mode1Max}°C` : t('weather.none', null, '無')}</span>
                                <span class="text-[10px] text-slate-500 font-bold">${basis.toUpperCase()}</span>
                            </div>
                            ${mode2Max != null ? `
                            <div class="bg-white px-3 py-1.5 rounded-xl border border-emerald-300 shadow-xs flex items-center gap-2 text-xs">
                                <span class="font-bold text-teal-900">${t('weather.mode2Thresh', null, '🔵 Mode 2 部分輔助上限:')}</span>
                                <span class="font-black text-teal-800 text-sm">${mode2Max}°C</span>
                                <span class="text-[10px] text-slate-500 font-bold">${basis.toUpperCase()}</span>
                            </div>
                            ` : ''}
                        </div>
                    </div>

                    <!-- 全年自由冷卻可用時數即時儀表板 (Free Cooling Potential Real-time KPI Card) -->
                    <div class="bg-white p-6 rounded-2xl shadow-sm border border-emerald-300 space-y-4">
                        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-emerald-100 pb-3">
                            <div>
                                <div class="flex items-center gap-2">
                                    <span class="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-800 font-black flex items-center justify-center text-sm shadow-2xs">❄️</span>
                                    <h3 class="text-base font-black text-slate-900">
                                        ${t('weather.fcPotentialTitle', null, '8,760h 全年自由冷卻可用時數 (Free Cooling Potential)')}
                                    </h3>
                                </div>
                                <p class="text-xs text-slate-500 mt-1">
                                    ${t('weather.fcStatSubtitleHtml', { arch: archName, m1: mode1Max != null ? `${mode1Max}°C` : 'N/A', m2Html: mode2Max != null ? t('weather.andMode2Html', { m2: `${mode2Max}°C` }, ` 與 <strong>Mode 2 (≤ ${mode2Max}°C)</strong>`) : '' }, `依 ${archName} 門檻統計：<strong>Mode 1 (≤ ${mode1Max != null ? `${mode1Max}°C` : 'N/A'})</strong>${mode2Max != null ? ` 與 <strong>Mode 2 (≤ ${mode2Max}°C)</strong>` : ''}`)}
                                </p>
                            </div>
                            <div class="flex items-center gap-2">
                                <span class="px-3 py-1.5 bg-emerald-600 text-white font-black text-xs rounded-xl shadow-xs">
                                    ${t('weather.fullPotentialBadge', { hours: climateFreeCount.toLocaleString(), pct: freePct }, `100% 全直冷潛力: ${climateFreeCount.toLocaleString()} 小時 (${freePct}%)`)}
                                </span>
                            </div>
                        </div>

                        <!-- 4 大指標卡片 -->
                        <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
                            <div class="p-4 bg-emerald-50 rounded-xl border border-emerald-200">
                                <div class="text-[11px] font-bold text-emerald-800 flex items-center justify-between">
                                    <span>${t('weather.mode1Card', null, 'Mode 1 100% 全直冷')}</span>
                                    <span class="text-[10px] bg-emerald-200 text-emerald-900 px-1.5 py-0.5 rounded font-black">${mode1Max != null ? `≤ ${mode1Max}°C` : 'N/A'}</span>
                                </div>
                                <div class="text-2xl font-black text-emerald-950 mt-1">${climateFreeCount.toLocaleString()} <span class="text-xs font-bold text-emerald-700">${t('weather.hoursUnit', null, '小時')}</span></div>
                                <div class="text-[11px] text-emerald-700 font-bold mt-0.5">${t('weather.mode1Sub', { pct: freePct }, `佔全年 ${freePct}% (冰機 100% 停機)`)}</div>
                            </div>

                            <div class="p-4 bg-teal-50 rounded-xl border border-teal-200">
                                <div class="text-[11px] font-bold text-teal-800 flex items-center justify-between">
                                    <span>${t('weather.mode2Card', null, 'Mode 2 部分輔助冷卻')}</span>
                                    <span class="text-[10px] bg-teal-200 text-teal-900 px-1.5 py-0.5 rounded font-black">${mode2Max != null ? `${mode1Max}°C ~ ${mode2Max}°C` : t('weather.none', null, '無')}</span>
                                </div>
                                <div class="text-2xl font-black text-teal-950 mt-1">${climateTrimCount.toLocaleString()} <span class="text-xs font-bold text-teal-700">${t('weather.hoursUnit', null, '小時')}</span></div>
                                <div class="text-[11px] text-teal-700 font-bold mt-0.5">${mode2Max != null ? t('weather.mode2Sub', { pct: trimPct }, `佔全年 ${trimPct}% (乾冷器+部分製冷)`) : t('weather.mode2None', null, '無此模式')}</div>
                            </div>

                            <div class="p-4 bg-amber-50 rounded-xl border border-amber-200">
                                <div class="text-[11px] font-bold text-amber-800 flex items-center justify-between">
                                    <span>${t('weather.mode3Card', null, 'Mode 3 全額機械製冷')}</span>
                                    <span class="text-[10px] bg-amber-200 text-amber-900 px-1.5 py-0.5 rounded font-black">${mode2Max != null ? `> ${mode2Max}°C` : (mode1Max != null ? `> ${mode1Max}°C` : t('weather.allYear', null, '全年'))}</span>
                                </div>
                                <div class="text-2xl font-black text-amber-950 mt-1">${climateMechCount.toLocaleString()} <span class="text-xs font-bold text-amber-700">${t('weather.hoursUnit', null, '小時')}</span></div>
                                <div class="text-[11px] text-amber-700 font-bold mt-0.5">${t('weather.mode3Sub', { pct: mechPct }, `佔全年 ${mechPct}% (冰機全負載)`)}</div>
                            </div>

                            <div class="p-4 bg-emerald-50/70 rounded-xl border border-emerald-300">
                                <div class="text-[11px] font-bold text-emerald-900">
                                    <span>${t('weather.fcPotentialCard', null, '全自然冷卻潛力 (FC Potential)')}</span>
                                </div>
                                <div class="text-2xl font-black text-emerald-950 mt-1">${freePct}%</div>
                                <div class="text-[11px] text-emerald-700 font-bold mt-0.5">${t('weather.fcHoursOf', { hours: climateFreeCount.toLocaleString() }, `共 ${climateFreeCount.toLocaleString()} / 8,760 小時`)}</div>
                            </div>
                        </div>

                        <!-- 3 色堆疊進度條 -->
                        <div class="space-y-1.5 pt-1">
                            <div class="flex justify-between text-[11px] font-bold text-slate-500">
                                <span>${t('weather.barTitle', null, '8,760 小時全年度氣候分佈佔比')}</span>
                                <span>${t('weather.barLegend', { free: freePct, trim: trimPct, mech: mechPct }, `直冷: ${freePct}% | 輔助: ${trimPct}% | 機械: ${mechPct}%`)}</span>
                            </div>
                            <div class="w-full h-4 bg-slate-100 rounded-full overflow-hidden flex shadow-inner border border-slate-200">
                                <div style="width: ${freePct}%" class="bg-emerald-500 hover:opacity-90 transition" title="${t('weather.mode1Tooltip', { h: climateFreeCount, pct: freePct }, `Mode 1 全直冷: ${climateFreeCount}h (${freePct}%)`)}"></div>
                                <div style="width: ${trimPct}%" class="bg-teal-400 hover:opacity-90 transition" title="${t('weather.mode2Tooltip', { h: climateTrimCount, pct: trimPct }, `Mode 2 輔助直冷: ${climateTrimCount}h (${trimPct}%)`)}"></div>
                                <div style="width: ${mechPct}%" class="bg-amber-400 hover:opacity-90 transition" title="${t('weather.mode3Tooltip', { h: climateMechCount, pct: mechPct }, `Mode 3 機械製冷: ${climateMechCount}h (${mechPct}%)`)}"></div>
                            </div>
                        </div>
                    </div>

                    <!-- 版面 2: Bin Analysis (直方圖 + 明細表) -->
                    <div class="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-4">
                        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-3">
                            <div>
                                <h3 class="text-base font-bold text-slate-900 flex items-center gap-2">
                                    <span>📊</span> ${t('weather.binTitle', null, '氣候區間頻率分析 (Bin Analysis)')}
                                </h3>
                                <p class="text-xs text-slate-400 mt-0.5">
                                    ${t('weather.binSubtitle', { m1: mode1Max != null ? `≤${mode1Max}°C` : t('weather.none', null, '無'), m2: mode2Max != null ? `≤${mode2Max}°C` : t('weather.none', null, '無'), m3: mode2Max != null ? `>${mode2Max}°C` : t('weather.allYear', null, '全年') }, `統計 8,760 小時落在各溫度/濕度區間之發生時數。直方圖已自動標記門檻區間 (🟢 Mode 1 ${mode1Max != null ? `≤${mode1Max}°C` : '無'} | 🔵 Mode 2 ${mode2Max != null ? `≤${mode2Max}°C` : '無'} | 🟡 Mode 3 ${mode2Max != null ? `>${mode2Max}°C` : '全年'})`)}
                                </p>
                            </div>
                            <div class="flex items-center gap-2">
                                <select onchange="ViewWeather.changeBinMetric(this.value)" class="text-xs font-bold border rounded-lg p-1.5 bg-white text-slate-800">
                                    <option value="db" ${selectedBinMetric==='db'?'selected':''}>${t('weather.metricDb', null, '乾球溫度 DB (°C)')}</option>
                                    <option value="wb" ${selectedBinMetric==='wb'?'selected':''}>${t('weather.metricWb', null, '濕球溫度 WB (°C)')}</option>
                                    <option value="dp" ${selectedBinMetric==='dp'?'selected':''}>${t('weather.metricDp', null, '露點溫度 DP (°C)')}</option>
                                    <option value="rh" ${selectedBinMetric==='rh'?'selected':''}>${t('weather.metricRh', null, '相對濕度 RH (%)')}</option>
                                </select>
                            </div>
                        </div>

                        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            <div class="lg:col-span-2 h-64">
                                <canvas id="binHistogramChart"></canvas>
                            </div>
                            <div class="overflow-y-auto max-h-64 border rounded-xl p-2 text-xs">
                                <table class="w-full text-left">
                                    <thead><tr class="border-b text-[10px] text-slate-400 uppercase"><th>${t('weather.thInterval', null, '區間')}</th><th class="text-right">${t('weather.thHours', null, '時數')}</th><th class="text-right">${t('weather.thRatio', null, '佔比')}</th></tr></thead>
                                    <tbody id="binTableBody"></tbody>
                                </table>
                            </div>
                        </div>
                    </div>

                    <!-- 版面 3: 月度 Free Cooling 堆疊時數 + 12個月雙軸走勢(含門檻線標記) -->
                    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div class="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                            <div class="flex items-center justify-between mb-3">
                                <div>
                                    <h3 class="text-sm font-bold text-slate-800">${t('weather.monthlyFcTitle', null, '📅 各月份 Free Cooling 潛力時數堆疊分析')}</h3>
                                    <div class="text-[11px] text-slate-400">${t('weather.monthlyFcLegend', { m1: mode1Max != null ? `≤${mode1Max}°C` : t('weather.none', null, '無') }, `綠色: 全直冷 (${mode1Max != null ? `≤${mode1Max}°C` : '無'}) | 藍色: 輔助直冷 | 黃色: 全機械製冷`)}</div>
                                </div>
                                <span class="text-xs text-emerald-600 font-bold">${t('weather.threeTierStack', null, '三階模式堆疊')}</span>
                            </div>
                            <div class="h-60">
                                <canvas id="monthlyFcChart"></canvas>
                            </div>
                        </div>

                        <div class="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                            <div class="flex items-center justify-between mb-3">
                                <div>
                                    <h3 class="text-sm font-bold text-slate-800">${t('weather.monthlyTrendTitle', null, '📈 12 個月氣候雙軸走勢 (含設定門檻線標記)')}</h3>
                                    <div class="text-[11px] text-slate-400">${t('weather.monthlyTrendSub', { m1: mode1Max != null ? `${mode1Max}°C` : t('weather.none', null, '無'), m2: mode2Max != null ? `${mode2Max}°C` : t('weather.none', null, '無') }, `包含 Mode 1 (${mode1Max != null ? `${mode1Max}°C` : '無'}) 與 Mode 2 (${mode2Max != null ? `${mode2Max}°C` : '無'}) 基準參考線`)}</div>
                                </div>
                                <span class="text-xs text-blue-600 font-bold">Monthly Trends</span>
                            </div>
                            <div class="h-60">
                                <canvas id="monthlyTrendChart"></canvas>
                            </div>
                        </div>
                    </div>

                    <!-- 版面 4: 月度氣象資料摘要表 (含複製/匯出) -->
                    <div class="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-4">
                        <div class="flex justify-between items-center border-b pb-3">
                            <h3 class="text-sm font-bold text-slate-800">${t('weather.monthlySummaryTitle', null, '📋 12 個月氣候摘要明細表 (Monthly Summary)')}</h3>
                            <div class="flex items-center gap-2">
                                <button onclick="ViewWeather.copyTable()" class="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition">${t('weather.copyTable', null, '複製表格')}</button>
                                <button onclick="ViewWeather.exportCsv()" class="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition">${t('weather.exportCsv', null, '匯出 CSV')}</button>
                            </div>
                        </div>
                        <div class="overflow-x-auto">
                            <table class="w-full text-xs text-left" id="monthlySummaryTable">
                                <thead>
                                    <tr class="border-b text-[11px] font-bold text-slate-400 uppercase">
                                        <th class="py-2">${t('weather.thMonth', null, '月份')}</th>
                                        <th class="py-2 text-right">${t('weather.thAvgDb', null, '乾球均溫 (°C)')}</th>
                                        <th class="py-2 text-right">${t('weather.thMaxDb', null, '乾球極大 (°C)')}</th>
                                        <th class="py-2 text-right">${t('weather.thMinDb', null, '乾球極小 (°C)')}</th>
                                        <th class="py-2 text-right">${t('weather.thAvgWb', null, '濕球均溫 (°C)')}</th>
                                        <th class="py-2 text-right">${t('weather.thAvgDp', null, '露點均溫 (°C)')}</th>
                                        <th class="py-2 text-right">${t('weather.thAvgRh', null, '平均濕度 (%)')}</th>
                                    </tr>
                                </thead>
                                <tbody id="monthlyTableBody"></tbody>
                            </table>
                        </div>
                    </div>

                    <div class="flex justify-end pt-2">
                        <button onclick="window.App.nextStep()" class="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl shadow-sm transition flex items-center gap-2">
                            ${t('weather.nextStep', null, '下一步: Hall → DU → SU 模組設計')} <span>→</span>
                        </button>
                    </div>
                </div>
            `;

            this.setupEvents();
            this.renderBinAnalysis();
            this.renderMonthlyFc();
            this.renderMonthlyTrends();
            this.renderMonthlyTable();
            if (window.UIKit) window.UIKit.refreshIcons(container);
        },

        setupEvents() {
            const dropZone = document.getElementById('weatherDropZone');
            const fileInput = document.getElementById('weatherFileInput');
            if (dropZone && fileInput) {
                dropZone.addEventListener('click', () => fileInput.click());
                fileInput.addEventListener('change', (e) => {
                    if (e.target.files && e.target.files[0]) this.loadEpwFile(e.target.files[0]);
                });
            }
        },

        async selectStation(id) {
            this.isLoading = true;
            this.loadingStationId = id;
            this.fileProtocolError = false;
            this.renderStationList();

            try {
                const stationData = await window.WeatherSource.loadStation(id);
                this.isLoading = false;
                this.loadingStationId = null;

                const meta = (this.stationsList || []).find(s => s.id === id) || {};
                const cityName = stationData.source === 'builtin' && stationData.builtinKey
                    ? stationData.builtinKey
                    : (meta.cityZh || stationData.stationInfo?.location || id);

                window.AppStore.updateSite({
                    selectedCity: cityName,
                    stationId: stationData.id,
                    stationSource: stationData.source,
                    stationName: stationData.stationInfo?.location || id,
                    country: stationData.stationInfo?.country || meta.country || '',
                    lat: stationData.stationInfo?.lat ?? 0,
                    lon: stationData.stationInfo?.lon ?? 0,
                    elev: stationData.stationInfo?.elev ?? 0,
                    isRealEpw: true,
                    hourly: stationData.hourlyData,
                    stats: stationData.stats,
                    monthlyStats: stationData.monthlyStats,
                    designConditions: stationData.designConditions || null
                });

                const container = document.getElementById('stepContent');
                if (container && window.App.currentStep === 1) {
                    this.render(container);
                }
            } catch (err) {
                this.isLoading = false;
                this.loadingStationId = null;
                if (err && err.code === 'FILE_PROTOCOL') {
                    this.fileProtocolError = true;
                    const container = document.getElementById('stepContent');
                    if (container && window.App.currentStep === 1) {
                        this.render(container);
                    }
                } else {
                    alert(t('weather.loadFail') + (err?.message || err));
                    this.renderStationList();
                }
            }
        },

        selectCity(cityName) {
            const globalScope = (typeof window !== 'undefined') ? window : globalThis;
            if (globalScope.BUILTIN_WEATHER_DATA && globalScope.BUILTIN_WEATHER_DATA[cityName]) {
                const data = globalScope.BUILTIN_WEATHER_DATA[cityName];
                const stationId = window.WeatherSource?.REVERSE_BUILTIN_MAP?.[cityName] || cityName;
                window.AppStore.updateSite({
                    selectedCity: cityName,
                    stationId: stationId,
                    stationSource: 'builtin',
                    stationName: data.stationInfo.location,
                    country: data.stationInfo.country,
                    lat: data.stationInfo.lat,
                    lon: data.stationInfo.lon,
                    elev: data.stationInfo.elev,
                    isRealEpw: true,
                    hourly: data.hourlyData,
                    stats: data.stats,
                    monthlyStats: data.monthlyStats,
                    designConditions: data.designConditions || null
                });
                const container = document.getElementById('stepContent');
                if (container && window.App.currentStep === 1) this.render(container);
                return;
            }
            this.selectStation(cityName);
        },

        loadEpwFile(file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const parsed = window.EpwParser.parse(e.target.result);
                    window.AppStore.updateSite({
                        selectedCity: file.name.replace('.epw', ''),
                        stationName: parsed.stationInfo.location,
                        country: parsed.stationInfo.country,
                        lat: parsed.stationInfo.lat,
                        lon: parsed.stationInfo.lon,
                        elev: parsed.stationInfo.elev,
                        isRealEpw: true,
                        hourly: parsed.hourlyData,
                        stats: parsed.stats,
                        monthlyStats: parsed.monthlyStats,
                        designConditions: parsed.designConditions || null
                    });
                    const container = document.getElementById('stepContent');
                    if (container && window.App.currentStep === 1) this.render(container);
                } catch(err) {
                    alert(t('weather.parseFail') + err.message);
                }
            };
            reader.readAsText(file);
        },

        changeBinMetric(metric) {
            selectedBinMetric = metric;
            this.renderBinAnalysis();
        },

        renderBinAnalysis() {
            const state = window.AppStore.state;
            const site = state.site;
            const bins = site.binAnalysis[selectedBinMetric] || {};
            const keys = Object.keys(bins).map(Number).sort((a,b) => a-b);
            const total = Object.values(bins).reduce((a,b) => a+b, 0) || 8760;

            const domThresh = window.AppStore ? window.AppStore.dominantCduThresholds() : null;
            const basis = domThresh?.basis || 'db';
            const thresholds = domThresh?.thresholds || { basis: 'db', full: 35.0, mech: 47.0 };
            const mode1Max = thresholds.full;
            const mode2Max = thresholds.mech;

            const labels = keys.map(k => k + ' ~ ' + (k+selectedBinStep));
            const data = keys.map(k => bins[k] || 0);

            // 當選取的溫度指標與架構基準相符時給予三色標記
            const isMatchingMetric = (basis === 'wb' && selectedBinMetric === 'wb') || (basis !== 'wb' && selectedBinMetric === 'db');

            const bgColors = keys.map(k => {
                if (isMatchingMetric) {
                    if (mode1Max != null && k <= mode1Max) return '#10b981'; // 綠色: Mode 1 全直冷
                    if (mode2Max != null && k <= mode2Max) return '#06b6d4'; // 藍色: Mode 2 輔助直冷
                    return '#f59e0b'; // 黃色: Mode 3 機械製冷
                }
                return '#3b82f6';
            });

            const ctx = document.getElementById('binHistogramChart');
            if (ctx) {
                if (binChart) binChart.destroy();
                let datasetLabel = t('weather.binOccur');
                if (isMatchingMetric) {
                    const m2Suffix = mode2Max != null
                        ? t('weather.binM2Suffix', { m2: mode2Max })
                        : t('weather.binM2NoneSuffix', { m1: mode1Max });
                    datasetLabel = t('weather.binOccurArch', {
                        arch: domThresh?.archName || '',
                        m1: mode1Max,
                        m2Suffix: m2Suffix
                    });
                }
                binChart = new Chart(ctx, {
                    type: 'bar',
                    data: {
                        labels,
                        datasets: [{
                            label: datasetLabel,
                            data,
                            backgroundColor: bgColors,
                            borderRadius: 4
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        scales: { y: { title: { display: true, text: t('weather.chartHours') } } }
                    }
                });
            }

            const tb = document.getElementById('binTableBody');
            if (tb) {
                let html = '';
                keys.forEach(k => {
                    const h = bins[k] || 0;
                    const pct = ((h / total) * 100).toFixed(1);
                    let badge = '';
                    if (isMatchingMetric) {
                        if (mode1Max != null && k <= mode1Max) badge = `<span class="text-[9px] font-black text-emerald-700 bg-emerald-100 px-1 py-0.2 rounded ml-1">${t('weather.badgeMode1')}</span>`;
                        else if (mode2Max != null && k <= mode2Max) badge = `<span class="text-[9px] font-black text-teal-700 bg-teal-100 px-1 py-0.2 rounded ml-1">${t('weather.badgeMode2')}</span>`;
                        else badge = `<span class="text-[9px] font-black text-amber-700 bg-amber-100 px-1 py-0.2 rounded ml-1">${t('weather.badgeMode3')}</span>`;
                    }
                    html += '<tr class="border-b border-slate-100"><td>' + k + ' ~ ' + (k+selectedBinStep) + badge + '</td><td class="text-right font-bold">' + h + '</td><td class="text-right text-slate-500">' + pct + '%</td></tr>';
                });
                tb.innerHTML = html;
            }
        },

        renderMonthlyFc() {
            const ctx = document.getElementById('monthlyFcChart');
            if (!ctx) return;
            const state = window.AppStore.state;
            const site = state.site;
            const labels = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(m => t('weather.m' + m));

            const domThresh = window.AppStore ? window.AppStore.dominantCduThresholds() : null;
            const basis = domThresh?.basis || 'db';
            const thresholds = domThresh?.thresholds || { basis: 'db', full: 35.0, mech: 47.0 };
            const mode1Max = thresholds.full;
            const mode2Max = thresholds.mech;

            const MONTH_HOURS_FC = [744, 672, 744, 720, 744, 720, 744, 744, 720, 744, 720, 744];
            const MONTH_START_FC = [];
            { let acc = 0; for (let m = 0; m < 12; m++) { MONTH_START_FC.push(acc); acc += MONTH_HOURS_FC[m]; } }
            function hourToMonthFC(h) { for (let m = 11; m >= 0; m--) { if (h >= MONTH_START_FC[m]) return m; } return 0; }

            const hourly = site.hourly || [];
            const mode1Monthly = new Array(12).fill(0);
            const mode2Monthly = new Array(12).fill(0);
            const mode3Monthly = new Array(12).fill(0);

            if (hourly.length >= 8760) {
                for (let i = 0; i < 8760; i++) {
                    const w = hourly[i] || { db: 25, wb: 20 };
                    const m = hourToMonthFC(i);
                    const val = (basis === 'wb') ? (w.wb ?? 20) : (w.db ?? 25);
                    if (mode1Max != null && val <= mode1Max) {
                        mode1Monthly[m]++;
                    } else if (mode2Max != null && val <= mode2Max) {
                        mode2Monthly[m]++;
                    } else {
                        mode3Monthly[m]++;
                    }
                }
            } else {
                for (let m = 0; m < 12; m++) mode1Monthly[m] = (mode1Max != null) ? MONTH_HOURS_FC[m] : 0;
            }

            if (fcChart) fcChart.destroy();
            fcChart = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels,
                    datasets: [
                        { label: t('weather.mode1Label', { m1: mode1Max != null ? `≤${mode1Max}°C` : t('weather.none') }), data: mode1Monthly, backgroundColor: '#10b981' },
                        { label: t('weather.mode2Label', { m2: mode2Max != null ? `${mode1Max}~${mode2Max}°C` : t('weather.none') }), data: mode2Monthly, backgroundColor: '#06b6d4' },
                        { label: t('weather.mode3Label', { m3: mode2Max != null ? `>${mode2Max}°C` : (mode1Max != null ? `>${mode1Max}°C` : t('weather.allYear')) }), data: mode3Monthly, backgroundColor: '#f59e0b' }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        x: { stacked: true },
                        y: { stacked: true, title: { display: true, text: t('weather.chartHours') } }
                    }
                }
            });
        },

        renderMonthlyTrends() {
            const ctx = document.getElementById('monthlyTrendChart');
            if (!ctx) return;
            const state = window.AppStore.state;
            const site = state.site;
            const labels = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(m => t('weather.m' + m));
            const monthly = site.monthlyStats || [];
            const dbData = monthly.map(m => m.avgDB);
            const wbData = monthly.map(m => m.avgWB);
            const rhData = monthly.map(m => m.avgRH);

            const domThresh = window.AppStore ? window.AppStore.dominantCduThresholds() : null;
            const thresholds = domThresh?.thresholds || { basis: 'db', full: 35.0, mech: 47.0 };
            const mode1Max = thresholds.full;
            const mode2Max = thresholds.mech;

            const mode1Line = mode1Max != null ? new Array(12).fill(mode1Max) : [];
            const mode2Line = mode2Max != null ? new Array(12).fill(mode2Max) : [];

            if (trendChart) trendChart.destroy();
            trendChart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels,
                    datasets: [
                        { label: t('weather.trendDb'), data: dbData, borderColor: '#ef4444', backgroundColor: 'rgba(239, 68, 68, 0.1)', tension: 0.3, yAxisID: 'y' },
                        { label: t('weather.trendWb'), data: wbData, borderColor: '#0284c7', backgroundColor: 'rgba(2, 132, 199, 0.1)', tension: 0.3, yAxisID: 'y' },
                        ...(mode1Max != null ? [{ label: t('weather.trendMode1', { m1: mode1Max }), data: mode1Line, borderColor: '#10b981', borderDash: [6, 4], pointRadius: 0, borderWidth: 2, yAxisID: 'y' }] : []),
                        ...(mode2Max != null ? [{ label: t('weather.trendMode2', { m2: mode2Max }), data: mode2Line, borderColor: '#06b6d4', borderDash: [4, 4], pointRadius: 0, borderWidth: 2, yAxisID: 'y' }] : []),
                        { label: t('weather.trendRh'), data: rhData, borderColor: '#8b5cf6', borderDash: [2, 2], tension: 0.3, yAxisID: 'y1' }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: { position: 'left', title: { display: true, text: t('weather.chartTemp') }, grid: { color: '#f1f5f9' } },
                        y1: { position: 'right', min: 40, max: 100, title: { display: true, text: t('weather.chartRh') }, grid: { display: false } }
                    }
                }
            });
        },

        renderMonthlyTable() {
            const tb = document.getElementById('monthlyTableBody');
            if (!tb) return;
            const site = window.AppStore.state.site;
            const monthly = site.monthlyStats || [];
            let html = '';
            monthly.forEach((m, idx) => {
                html += `<tr class="border-b border-slate-100 hover:bg-slate-50 transition">
                    <td class="py-2.5 font-bold text-slate-800">${t('weather.monthUnit', { m: idx + 1 })}</td>
                    <td class="py-2.5 text-right font-extrabold text-slate-900">${m.avgDB}°C</td>
                    <td class="py-2.5 text-right text-red-600">${m.maxDB}°C</td>
                    <td class="py-2.5 text-right text-blue-600">${m.minDB}°C</td>
                    <td class="py-2.5 text-right font-bold text-cyan-700">${m.avgWB}°C</td>
                    <td class="py-2.5 text-right text-slate-600">${m.avgDP}°C</td>
                    <td class="py-2.5 text-right font-bold text-teal-700">${m.avgRH}%</td>
                </tr>`;
            });
            tb.innerHTML = html;
        },

        copyTable() {
            const site = window.AppStore.state.site;
            const monthly = site.monthlyStats || [];
            let txt = `${t('weather.thMonth')}\t${t('weather.thAvgDb')}\t${t('weather.thMaxDb')}\t${t('weather.thMinDb')}\t${t('weather.thAvgWb')}\t${t('weather.thAvgDp')}\t${t('weather.thAvgRh')}\n`;
            monthly.forEach((m, idx) => {
                txt += `${t('weather.m' + (idx+1))}\t${m.avgDB}\t${m.maxDB}\t${m.minDB}\t${m.avgWB}\t${m.avgDP}\t${m.avgRH}\n`;
            });
            navigator.clipboard.writeText(txt).then(() => alert(t('weather.copied')));
        },

        exportCsv() {
            const site = window.AppStore.state.site;
            const monthly = site.monthlyStats || [];
            let csv = `\uFEFF${t('weather.thMonth')},${t('weather.thAvgDb')},${t('weather.thMaxDb')},${t('weather.thMinDb')},${t('weather.thAvgWb')},${t('weather.thAvgDp')},${t('weather.thAvgRh')}\n`;
            monthly.forEach((m, idx) => {
                csv += `${t('weather.m' + (idx+1))},${m.avgDB},${m.maxDB},${m.minDB},${m.avgWB},${m.avgDP},${m.avgRH}\n`;
            });
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement("a");
            link.href = URL.createObjectURL(blob);
            link.download = `${site.selectedCity || 'Climate'}_Monthly_Summary.csv`;
            link.click();
        }
    };

    window.ViewWeather = ViewWeather;
})(window);
