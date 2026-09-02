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

    const ViewWeather = {
        builtinList: [
            { key: '桃園 (Taoyuan Pilot)', desc: 'Vera Rubin Pilot 標竿案場 (真實 EPW)', db: 22.8, wb: 19.5, dp: 17.2, rh: 76.5 },
            { key: '高雄 (Kaohsiung)', desc: '南台灣高溫高濕案場 (真實 EPW)', db: 25.5, wb: 22.0, dp: 20.1, rh: 78.0 },
            { key: '新竹 (Hsinchu)', desc: '竹科半導體園區 (真實 EPW)', db: 23.0, wb: 19.8, dp: 17.5, rh: 75.0 },
            { key: '台中 (Taichung)', desc: '中台灣氣候 (真實 EPW)', db: 23.8, wb: 20.2, dp: 18.0, rh: 74.0 },
            { key: '菲律賓 (Ambulong)', desc: '東南亞熱帶氣候 (真實 EPW)', db: 27.8, wb: 24.5, dp: 23.0, rh: 82.0 },
            { key: '美國 (Alabama Andalusia)', desc: '美洲海外資料中心 (真實 EPW)', db: 18.5, wb: 15.2, dp: 13.0, rh: 68.0 }
        ],

        render(container) {
            const state = window.AppStore.state;
            const site = state.site;
            const stats = site.stats || { avgDB: 22.8, maxDB: 36.4, minDB: 8.5, avgWB: 19.5, avgDP: 17.2, avgRH: 76.5 };

            const fcThresh = window.AppStore ? window.AppStore.getEffectiveFcThresholds() : { mode1DbMax: 30.0, mode2DbMax: 35.7 };
            const mode1DbMax = fcThresh.mode1DbMax;
            const mode2DbMax = fcThresh.mode2DbMax;

            // 計算 8,760h 自由冷卻時數與佔比
            const hourly = site.hourly || [];
            let climateFreeCount = 0, climateTrimCount = 0, climateMechCount = 0;

            if (hourly.length >= 8760) {
                for (let i = 0; i < 8760; i++) {
                    const w = hourly[i] || { db: 25 };
                    if (w.db <= mode1DbMax) {
                        climateFreeCount++;
                    } else if (w.db <= mode2DbMax) {
                        climateTrimCount++;
                    } else {
                        climateMechCount++;
                    }
                }
            } else {
                climateFreeCount = 8760;
                climateTrimCount = 0;
                climateMechCount = 0;
            }

            const freePct = ((climateFreeCount / 8760) * 100).toFixed(1);
            const trimPct = ((climateTrimCount / 8760) * 100).toFixed(1);
            const mechPct = ((climateMechCount / 8760) * 100).toFixed(1);
            const totalFcHours = climateFreeCount + climateTrimCount;
            const totalFcPct = (((climateFreeCount + climateTrimCount) / 8760) * 100).toFixed(1);

            let cityBtns = '';
            this.builtinList.forEach(c => {
                const isSelected = site.selectedCity === c.key;
                const activeCls = isSelected ? 'border-emerald-500 bg-emerald-50/80 shadow-md ring-2 ring-emerald-400' : 'border-slate-200 hover:border-slate-300 bg-slate-50/50';
                cityBtns += '<button onclick="ViewWeather.selectCity(\'' + c.key + '\')" class="p-3 text-left rounded-xl border transition ' + activeCls + '">'
                    + '<div class="flex items-center justify-between"><span class="text-xs font-extrabold text-slate-800">' + c.key + '</span><span class="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-bold">8760h EPW</span></div>'
                    + '<div class="text-[11px] text-emerald-800 font-semibold mt-1">' + c.desc + '</div>'
                    + '<div class="text-[10px] text-slate-500 mt-0.5">年均溫: ' + c.db + '°C / 濕球: ' + c.wb + '°C</div>'
                    + '</button>';
            });

            container.innerHTML = `
                <div class="space-y-6">
                    <!-- 標題與聲明 -->
                    <div class="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                        <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div>
                                <h2 class="text-xl font-bold text-slate-900 flex items-center gap-2">
                                    <span>📍</span> Step 1: 案場 8,760h 氣象動力學分析 (EPW Climate Analyzer)
                                </h2>
                                <p class="text-sm text-slate-500 mt-1">
                                    完整載入 EnergyPlus EPW 逐時數據。<strong>本頁為先天環境氣候分析（Bin Analysis / FC可用時數 / 雙軸趨勢），不依賴後續設備配置</strong>。
                                </p>
                            </div>
                            <span class="px-3.5 py-1.5 bg-emerald-100 text-emerald-900 text-xs font-bold rounded-xl border border-emerald-300 shadow-2xs">
                                8,760h EPW 完整解析
                            </span>
                        </div>

                        <!-- 測站與城市選擇 -->
                        <div class="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-6">
                            <div class="lg:col-span-2 space-y-2">
                                <label class="block text-xs font-bold text-slate-600 uppercase tracking-wider">選擇案場站點 (Built-in EPW)</label>
                                <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                                    ${cityBtns}
                                </div>
                            </div>
                            <div>
                                <label class="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">上傳自定義 EPW 檔案</label>
                                <div id="weatherDropZone" class="border-2 border-dashed border-emerald-400 hover:border-emerald-600 rounded-xl p-5 text-center bg-emerald-50/40 cursor-pointer flex flex-col items-center justify-center min-h-[120px] transition">
                                    <span class="text-xl">📂</span>
                                    <div class="text-xs font-bold text-emerald-950 mt-1">點擊或拖曳 .epw 檔案</div>
                                    <input type="file" id="weatherFileInput" accept=".epw,.csv" class="hidden">
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- 版面 1: 測站核心氣候 KPI 卡片 -->
                    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                            <span class="text-xs font-bold uppercase text-slate-400">乾球溫度 (DB)</span>
                            <div class="text-2xl font-black text-slate-900 mt-1.5">${stats.avgDB}°C</div>
                            <div class="text-[11px] text-slate-500 mt-1">極小 ${stats.minDB}°C ~ 極大 ${stats.maxDB}°C</div>
                        </div>
                        <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                            <span class="text-xs font-bold uppercase text-slate-400">濕球溫度 (WB)</span>
                            <div class="text-2xl font-black text-cyan-700 mt-1.5">${stats.avgWB}°C</div>
                            <div class="text-[11px] text-slate-500 mt-1">極小 ${stats.minWB}°C ~ 極大 ${stats.maxWB}°C</div>
                        </div>
                        <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                            <span class="text-xs font-bold uppercase text-slate-400">露點溫度 (DP)</span>
                            <div class="text-2xl font-black text-blue-700 mt-1.5">${stats.avgDP || 17.2}°C</div>
                            <div class="text-[11px] text-slate-500 mt-1">防結露控制基準</div>
                        </div>
                        <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                            <span class="text-xs font-bold uppercase text-slate-400">相對濕度 (RH)</span>
                            <div class="text-2xl font-black text-teal-700 mt-1.5">${stats.avgRH || 76.5}%</div>
                            <div class="text-[11px] text-slate-500 mt-1">全年度 8,760 小時均值</div>
                        </div>
                    </div>

                    <!-- 版面 1.5: 自由冷卻氣候門檻設定 (NVIDIA DSX Mode 1 & 2) -->
                    <div class="bg-gradient-to-r from-emerald-50/80 to-teal-50/80 p-5 rounded-2xl border-2 border-emerald-300 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                        <div>
                            <h3 class="text-sm font-black text-emerald-950 flex items-center gap-1.5">
                                <span>⚙️</span> 自由冷卻直冷/輔助氣候門檻設定 (NVIDIA DSX Climate Thresholds)
                            </h3>
                            <p class="text-xs text-emerald-800/90 mt-0.5">
                                設定晶片液冷直冷 (Mode 1 Full Free Cooling) 與部分輔助 (Mode 2 Trim Cooling) 之室外乾球溫度切點，即時動態連動下方圖表。
                            </p>
                        </div>
                        <div class="flex items-center gap-3 flex-wrap">
                            <div class="bg-white px-3 py-1.5 rounded-xl border border-emerald-300 shadow-xs flex items-center gap-2 text-xs">
                                <span class="font-bold text-emerald-900">🟢 Mode 1 全直冷上限:</span>
                                <input type="number" step="0.1" value="${mode1DbMax}" onchange="ViewWeather.updateFcThreshold('nvidia_dsx_mode1_db_max_c', parseFloat(this.value))" class="w-16 font-black text-emerald-800 text-center border rounded p-1 bg-slate-50">
                                <span class="font-bold text-slate-500">°C</span>
                            </div>
                            <div class="bg-white px-3 py-1.5 rounded-xl border border-emerald-300 shadow-xs flex items-center gap-2 text-xs">
                                <span class="font-bold text-teal-900">🔵 Mode 2 部分輔助上限:</span>
                                <input type="number" step="0.1" value="${mode2DbMax}" onchange="ViewWeather.updateFcThreshold('nvidia_dsx_mode2_db_max_c', parseFloat(this.value))" class="w-16 font-black text-teal-800 text-center border rounded p-1 bg-slate-50">
                                <span class="font-bold text-slate-500">°C</span>
                            </div>
                        </div>
                    </div>

                    <!-- 全年自由冷卻可用時數即時儀表板 (Free Cooling Potential Real-time KPI Card) -->
                    <div class="bg-white p-6 rounded-2xl shadow-sm border border-emerald-300 space-y-4">
                        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-emerald-100 pb-3">
                            <div>
                                <div class="flex items-center gap-2">
                                    <span class="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-800 font-black flex items-center justify-center text-sm shadow-2xs">❄️</span>
                                    <h3 class="text-base font-black text-slate-900">
                                        8,760h 全年自由冷卻可用時數 (Free Cooling Potential)
                                    </h3>
                                </div>
                                <p class="text-xs text-slate-500 mt-1">
                                    依據當前設定之 <strong>Mode 1 (≤ ${mode1DbMax}°C)</strong> 與 <strong>Mode 2 (≤ ${mode2DbMax}°C)</strong> 門檻統計
                                </p>
                            </div>
                            <div class="flex items-center gap-2">
                                <span class="px-3 py-1.5 bg-emerald-600 text-white font-black text-xs rounded-xl shadow-xs">
                                    100% 全直冷潛力: ${climateFreeCount.toLocaleString()} 小時 (${freePct}%)
                                </span>
                            </div>
                        </div>

                        <!-- 4 大指標卡片 -->
                        <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
                            <div class="p-4 bg-emerald-50 rounded-xl border border-emerald-200">
                                <div class="text-[11px] font-bold text-emerald-800 flex items-center justify-between">
                                    <span>Mode 1 100% 全直冷</span>
                                    <span class="text-[10px] bg-emerald-200 text-emerald-900 px-1.5 py-0.5 rounded font-black">≤ ${mode1DbMax}°C</span>
                                </div>
                                <div class="text-2xl font-black text-emerald-950 mt-1">${climateFreeCount.toLocaleString()} <span class="text-xs font-bold text-emerald-700">小時</span></div>
                                <div class="text-[11px] text-emerald-700 font-bold mt-0.5">佔全年 ${freePct}% (冰機 100% 停機)</div>
                            </div>

                            <div class="p-4 bg-teal-50 rounded-xl border border-teal-200">
                                <div class="text-[11px] font-bold text-teal-800 flex items-center justify-between">
                                    <span>Mode 2 部分輔助冷卻</span>
                                    <span class="text-[10px] bg-teal-200 text-teal-900 px-1.5 py-0.5 rounded font-black">${mode1DbMax}°C ~ ${mode2DbMax}°C</span>
                                </div>
                                <div class="text-2xl font-black text-teal-950 mt-1">${climateTrimCount.toLocaleString()} <span class="text-xs font-bold text-teal-700">小時</span></div>
                                <div class="text-[11px] text-teal-700 font-bold mt-0.5">佔全年 ${trimPct}% (乾冷器+部分製冷)</div>
                            </div>

                            <div class="p-4 bg-amber-50 rounded-xl border border-amber-200">
                                <div class="text-[11px] font-bold text-amber-800 flex items-center justify-between">
                                    <span>Mode 3 全額機械製冷</span>
                                    <span class="text-[10px] bg-amber-200 text-amber-900 px-1.5 py-0.5 rounded font-black">> ${mode2DbMax}°C</span>
                                </div>
                                <div class="text-2xl font-black text-amber-950 mt-1">${climateMechCount.toLocaleString()} <span class="text-xs font-bold text-amber-700">小時</span></div>
                                <div class="text-[11px] text-amber-700 font-bold mt-0.5">佔全年 ${mechPct}% (冰機全負載)</div>
                            </div>

                            <div class="p-4 bg-emerald-50/70 rounded-xl border border-emerald-300">
                                <div class="text-[11px] font-bold text-emerald-900">
                                    <span>全自然冷卻潛力 (FC Potential)</span>
                                </div>
                                <div class="text-2xl font-black text-emerald-950 mt-1">${freePct}%</div>
                                <div class="text-[11px] text-emerald-700 font-bold mt-0.5">共 ${climateFreeCount.toLocaleString()} / 8,760 小時</div>
                            </div>
                        </div>

                        <!-- 3 色堆疊進度條 -->
                        <div class="space-y-1.5 pt-1">
                            <div class="flex justify-between text-[11px] font-bold text-slate-500">
                                <span>8,760 小時全年度氣候分佈佔比</span>
                                <span>直冷: ${freePct}% | 輔助: ${trimPct}% | 機械: ${mechPct}%</span>
                            </div>
                            <div class="w-full h-4 bg-slate-100 rounded-full overflow-hidden flex shadow-inner border border-slate-200">
                                <div style="width: ${freePct}%" class="bg-emerald-500 hover:opacity-90 transition" title="Mode 1 全直冷: ${climateFreeCount}h (${freePct}%)"></div>
                                <div style="width: ${trimPct}%" class="bg-teal-400 hover:opacity-90 transition" title="Mode 2 輔助直冷: ${climateTrimCount}h (${trimPct}%)"></div>
                                <div style="width: ${mechPct}%" class="bg-amber-400 hover:opacity-90 transition" title="Mode 3 機械製冷: ${climateMechCount}h (${mechPct}%)"></div>
                            </div>
                        </div>
                    </div>

                    <!-- 版面 2: Bin Analysis (直方圖 + 明細表) -->
                    <div class="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-4">
                        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-3">
                            <div>
                                <h3 class="text-base font-bold text-slate-900 flex items-center gap-2">
                                    <span>📊</span> 氣候區間頻率分析 (Bin Analysis)
                                </h3>
                                <p class="text-xs text-slate-400 mt-0.5">
                                    統計 8,760 小時落在各溫度/濕度區間之發生時數。乾球溫度直方圖已自動標記門檻區間 (🟢 Mode 1 ≤${mode1DbMax}°C | 🔵 Mode 2 ≤${mode2DbMax}°C | 🟡 Mode 3 >${mode2DbMax}°C)
                                </p>
                            </div>
                            <div class="flex items-center gap-2">
                                <select onchange="ViewWeather.changeBinMetric(this.value)" class="text-xs font-bold border rounded-lg p-1.5 bg-white text-slate-800">
                                    <option value="db" ${selectedBinMetric==='db'?'selected':''}>乾球溫度 DB (°C)</option>
                                    <option value="wb" ${selectedBinMetric==='wb'?'selected':''}>濕球溫度 WB (°C)</option>
                                    <option value="dp" ${selectedBinMetric==='dp'?'selected':''}>露點溫度 DP (°C)</option>
                                    <option value="rh" ${selectedBinMetric==='rh'?'selected':''}>相對濕度 RH (%)</option>
                                </select>
                            </div>
                        </div>

                        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            <div class="lg:col-span-2 h-64">
                                <canvas id="binHistogramChart"></canvas>
                            </div>
                            <div class="overflow-y-auto max-h-64 border rounded-xl p-2 text-xs">
                                <table class="w-full text-left">
                                    <thead><tr class="border-b text-[10px] text-slate-400 uppercase"><th>區間</th><th class="text-right">時數</th><th class="text-right">佔比</th></tr></thead>
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
                                    <h3 class="text-sm font-bold text-slate-800">📅 各月份 Free Cooling 潛力時數堆疊分析</h3>
                                    <div class="text-[11px] text-slate-400">綠色: 全直冷 (≤${mode1DbMax}°C) | 藍色: 輔助直冷 | 黃色: 全機械製冷</div>
                                </div>
                                <span class="text-xs text-emerald-600 font-bold">三階模式堆疊</span>
                            </div>
                            <div class="h-60">
                                <canvas id="monthlyFcChart"></canvas>
                            </div>
                        </div>

                        <div class="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                            <div class="flex items-center justify-between mb-3">
                                <div>
                                    <h3 class="text-sm font-bold text-slate-800">📈 12 個月氣候雙軸走勢 (含設定門檻線標記)</h3>
                                    <div class="text-[11px] text-slate-400">包含 Mode 1 (${mode1DbMax}°C) 與 Mode 2 (${mode2DbMax}°C) 基準參考線</div>
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
                            <h3 class="text-sm font-bold text-slate-800">📋 12 個月氣候摘要明細表 (Monthly Summary)</h3>
                            <div class="flex items-center gap-2">
                                <button onclick="ViewWeather.copyTable()" class="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition">複製表格</button>
                                <button onclick="ViewWeather.exportCsv()" class="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition">匯出 CSV</button>
                            </div>
                        </div>
                        <div class="overflow-x-auto">
                            <table class="w-full text-xs text-left" id="monthlySummaryTable">
                                <thead>
                                    <tr class="border-b text-[11px] font-bold text-slate-400 uppercase">
                                        <th class="py-2">月份</th>
                                        <th class="py-2 text-right">乾球均溫 (°C)</th>
                                        <th class="py-2 text-right">乾球極大 (°C)</th>
                                        <th class="py-2 text-right">乾球極小 (°C)</th>
                                        <th class="py-2 text-right">濕球均溫 (°C)</th>
                                        <th class="py-2 text-right">露點均溫 (°C)</th>
                                        <th class="py-2 text-right">平均濕度 (%)</th>
                                    </tr>
                                </thead>
                                <tbody id="monthlyTableBody"></tbody>
                            </table>
                        </div>
                    </div>

                    <div class="flex justify-end pt-2">
                        <button onclick="window.App.nextStep()" class="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl shadow-sm transition flex items-center gap-2">
                            下一步: Hall → DU → SU 模組設計 <span>→</span>
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

        selectCity(cityName) {
            if (window.BUILTIN_WEATHER_DATA && window.BUILTIN_WEATHER_DATA[cityName]) {
                const data = window.BUILTIN_WEATHER_DATA[cityName];
                window.AppStore.updateSite({
                    selectedCity: cityName,
                    stationName: data.stationInfo.location,
                    country: data.stationInfo.country,
                    lat: data.stationInfo.lat,
                    lon: data.stationInfo.lon,
                    elev: data.stationInfo.elev,
                    isRealEpw: true,
                    hourly: data.hourlyData,
                    stats: data.stats,
                    monthlyStats: data.monthlyStats
                });
            }
            const container = document.getElementById('stepContent');
            if (container && window.App.currentStep === 1) this.render(container);
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
                        monthlyStats: parsed.monthlyStats
                    });
                    const container = document.getElementById('stepContent');
                    if (container && window.App.currentStep === 1) this.render(container);
                } catch(err) {
                    alert('EPW 解析失敗: ' + err.message);
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

            const fcThresh = window.AppStore ? window.AppStore.getEffectiveFcThresholds() : { mode1DbMax: 30.0, mode2DbMax: 35.7 };
            const mode1DbMax = fcThresh.mode1DbMax;
            const mode2DbMax = fcThresh.mode2DbMax;

            const labels = keys.map(k => k + ' ~ ' + (k+selectedBinStep));
            const data = keys.map(k => bins[k] || 0);

            // 乾球溫度時依設定的門檻點給予三色標記
            const bgColors = keys.map(k => {
                if (selectedBinMetric === 'db') {
                    if (k <= mode1DbMax) return '#10b981'; // 綠色: Mode 1 全直冷
                    if (k <= mode2DbMax) return '#06b6d4'; // 藍色: Mode 2 輔助直冷
                    return '#f59e0b'; // 黃色: Mode 3 機械製冷
                }
                return '#3b82f6';
            });

            const ctx = document.getElementById('binHistogramChart');
            if (ctx) {
                if (binChart) binChart.destroy();
                binChart = new Chart(ctx, {
                    type: 'bar',
                    data: {
                        labels,
                        datasets: [{
                            label: selectedBinMetric === 'db' ? `發生時數 (綠: ≤${mode1DbMax}°C直冷, 藍: ≤${mode2DbMax}°C輔助, 黃: >${mode2DbMax}°C機械)` : '發生時數 (hrs)',
                            data,
                            backgroundColor: bgColors,
                            borderRadius: 4
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        scales: { y: { title: { display: true, text: '小時 (hrs)' } } }
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
                    if (selectedBinMetric === 'db') {
                        if (k <= mode1DbMax) badge = '<span class="text-[9px] font-black text-emerald-700 bg-emerald-100 px-1 py-0.2 rounded ml-1">Mode 1 直冷</span>';
                        else if (k <= mode2DbMax) badge = '<span class="text-[9px] font-black text-teal-700 bg-teal-100 px-1 py-0.2 rounded ml-1">Mode 2 輔助</span>';
                        else badge = '<span class="text-[9px] font-black text-amber-700 bg-amber-100 px-1 py-0.2 rounded ml-1">Mode 3 機械</span>';
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
            const labels = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];

            const fcThresh = window.AppStore ? window.AppStore.getEffectiveFcThresholds() : { mode1DbMax: 30.0, mode2DbMax: 35.7 };
            const mode1DbMax = fcThresh.mode1DbMax;
            const mode2DbMax = fcThresh.mode2DbMax;

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
                    const w = hourly[i] || { db: 25 };
                    const m = hourToMonthFC(i);
                    if (w.db <= mode1DbMax) {
                        mode1Monthly[m]++;
                    } else if (w.db <= mode2DbMax) {
                        mode2Monthly[m]++;
                    } else {
                        mode3Monthly[m]++;
                    }
                }
            } else {
                for (let m = 0; m < 12; m++) mode1Monthly[m] = MONTH_HOURS_FC[m];
            }

            if (fcChart) fcChart.destroy();
            fcChart = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels,
                    datasets: [
                        { label: `Mode 1 全直冷 (≤${mode1DbMax}°C)`, data: mode1Monthly, backgroundColor: '#10b981' },
                        { label: `Mode 2 輔助冷卻 (${mode1DbMax}~${mode2DbMax}°C)`, data: mode2Monthly, backgroundColor: '#06b6d4' },
                        { label: `Mode 3 機械製冷 (>${mode2DbMax}°C)`, data: mode3Monthly, backgroundColor: '#f59e0b' }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        x: { stacked: true },
                        y: { stacked: true, title: { display: true, text: '小時 (hrs)' } }
                    }
                }
            });
        },

        updateFcThreshold(key, val) {
            if (isNaN(val)) return;
            const state = window.AppStore.state;
            state.assumptions_override = state.assumptions_override || {};
            state.assumptions_override[key] = val;
            if (key === 'nvidia_dsx_mode1_db_max_c') {
                state.assumptions_override.nvidia_dsx_mode2_db_max_c = Number((val + 5.7).toFixed(1));
            }
            window.AppStore.notify();
            this.render(document.getElementById('stepContent'));
        },

        renderMonthlyTrends() {
            const ctx = document.getElementById('monthlyTrendChart');
            if (!ctx) return;
            const state = window.AppStore.state;
            const site = state.site;
            const labels = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
            const monthly = site.monthlyStats || [];
            const dbData = monthly.map(m => m.avgDB);
            const wbData = monthly.map(m => m.avgWB);
            const rhData = monthly.map(m => m.avgRH);

            const fcThresh = window.AppStore ? window.AppStore.getEffectiveFcThresholds() : { mode1DbMax: 30.0, mode2DbMax: 35.7 };
            const mode1DbMax = fcThresh.mode1DbMax;
            const mode2DbMax = fcThresh.mode2DbMax;

            const mode1Line = new Array(12).fill(mode1DbMax);
            const mode2Line = new Array(12).fill(mode2DbMax);

            if (trendChart) trendChart.destroy();
            trendChart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels,
                    datasets: [
                        { label: '乾球均溫 DB (°C)', data: dbData, borderColor: '#ef4444', backgroundColor: 'rgba(239, 68, 68, 0.1)', tension: 0.3, yAxisID: 'y' },
                        { label: '濕球均溫 WB (°C)', data: wbData, borderColor: '#0284c7', backgroundColor: 'rgba(2, 132, 199, 0.1)', tension: 0.3, yAxisID: 'y' },
                        { label: `Mode 1 全直冷門檻 (${mode1DbMax}°C)`, data: mode1Line, borderColor: '#10b981', borderDash: [6, 4], pointRadius: 0, borderWidth: 2, yAxisID: 'y' },
                        { label: `Mode 2 輔助冷卻上限 (${mode2DbMax}°C)`, data: mode2Line, borderColor: '#06b6d4', borderDash: [4, 4], pointRadius: 0, borderWidth: 2, yAxisID: 'y' },
                        { label: '平均濕度 RH (%)', data: rhData, borderColor: '#8b5cf6', borderDash: [2, 2], tension: 0.3, yAxisID: 'y1' }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: { position: 'left', title: { display: true, text: '溫度 (°C)' }, grid: { color: '#f1f5f9' } },
                        y1: { position: 'right', min: 40, max: 100, title: { display: true, text: 'RH (%)' }, grid: { display: false } }
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
                    <td class="py-2.5 font-bold text-slate-800">${idx + 1} 月</td>
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
            let txt = "月份\t乾球均溫\t乾球極大\t乾球極小\t濕球均溫\t露點均溫\t平均濕度\n";
            monthly.forEach((m, idx) => {
                txt += `${idx+1}月\t${m.avgDB}\t${m.maxDB}\t${m.minDB}\t${m.avgWB}\t${m.avgDP}\t${m.avgRH}\n`;
            });
            navigator.clipboard.writeText(txt).then(() => alert('氣候摘要表已複製到剪貼簿！'));
        },

        exportCsv() {
            const site = window.AppStore.state.site;
            const monthly = site.monthlyStats || [];
            let csv = "\uFEFF月份,乾球均溫(°C),乾球極大(°C),乾球極小(°C),濕球均溫(°C),露點均溫(°C),平均濕度(%)\n";
            monthly.forEach((m, idx) => {
                csv += `${idx+1}月,${m.avgDB},${m.maxDB},${m.minDB},${m.avgWB},${m.avgDP},${m.avgRH}\n`;
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
