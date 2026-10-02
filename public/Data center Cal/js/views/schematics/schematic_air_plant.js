'use strict';
/**
 * schematic_air_plant.js - Air & Fanwall Heat Rejection System Topology SVG
 */
(function (root) {
    root.CoolingSchematics = root.CoolingSchematics || {
        _map: {},
        register(id, renderer) {
            this._map[id] = renderer;
        },
        get(id) {
            return this._map[id] || null;
        },
        render(id, ctx) {
            const s = this._map[id];
            if (!s) return '';
            return typeof s.render === 'function' ? s.render(ctx) : s(ctx);
        }
    };

    root.CoolingSchematics.register('air_plant', {
        render(ctx) {
            const t = ctx.t;
            const fwSys = ctx.fwSys || t.obj.plantDesign.fanwallSystem;
            const fwArch = ctx.fwArch || fwSys.architecture || 'air_cooled_chiller';

            const airLoadKw = (fwSys.designBasis?.air_load_kw || (t.summ.airHeatKw + t.summ.lossKw) || 0);
            const chwSupplyC = fwSys.chwSupplyC || 12.0;
            const chwReturnC = fwSys.chwReturnC || 18.0;
            const dtChw = Math.max(1.0, chwReturnC - chwSupplyC);
            const flowChwLpm = Math.round((airLoadKw * 60) / (4.184 * dtChw));
            const fwArchDesc = (typeof root.CoolingArchRegistry !== 'undefined') ? root.CoolingArchRegistry.get(fwArch) : null;
            const isRdhx = !!fwArchDesc?.flags?.isRdhx;
            const isDistrict = !!fwArchDesc?.flags?.isDistrict;
            const isWaterCooled = !!fwArchDesc?.flags?.consumesWater;

            const fwUnitItem = (fwSys.sizing || []).find(s => s.key === (isRdhx ? 'rdhx_unit' : 'crah_unit'));
            const fwUnitQty = fwUnitItem ? fwUnitItem.selectedQty : 4;
            const fwUnitModel = fwUnitItem ? fwUnitItem.selectedModel : (isRdhx ? 'Envicool RDHX 45kW Door' : 'Vertiv Liebert 100kW CRAH');

            let fwRejTitle = '氣冷式冰水主機 (Air-Cooled Chiller)';
            let fwRejFill = '#1e1b4b';
            let fwRejStroke = '#6366f1';
            let fwPlantSvg = '';

            if (!isDistrict && !isWaterCooled && !isRdhx) {
                fwRejTitle = '氣冷式冰水主機 (Air-Cooled Chiller)';
                fwPlantSvg = `
                    <!-- 蒸發器換熱核心 -->
                    <rect x="510" y="70" width="200" height="175" rx="10" fill="#0f172a" stroke="#6366f1" stroke-width="2" />
                    <rect x="510" y="70" width="200" height="30" rx="10" fill="#312e81" />
                    <text x="610" y="90" fill="#e0e7ff" font-size="12" font-weight="bold" text-anchor="middle">冰水蒸發器 (CHW Evaporator)</text>
                    
                    <rect x="525" y="118" width="26" height="100" rx="4" fill="#1e293b" stroke="#818cf8" stroke-width="1.2" />
                    <path d="M 531 128 L 542 143 L 531 158 M 538 128 L 549 143 L 538 158 M 531 158 L 542 173 L 531 188 M 538 158 L 549 173 L 538 188" stroke="#a5b4fc" stroke-width="1.5" fill="none" stroke-linecap="round" />
                    <text x="630" y="135" fill="#f8fafc" font-size="12" font-weight="bold" text-anchor="middle">機械壓縮製冷</text>
                    <text x="630" y="162" fill="#a5b4fc" font-size="11" font-weight="bold" text-anchor="middle">供水 ${chwSupplyC}°C ⇄ 回水 ${chwReturnC}°C</text>
                    <text x="630" y="188" fill="#cbd5e1" font-size="10" text-anchor="middle">全時連續供冷・穩定控溫</text>
                    <text x="630" y="212" fill="#94a3b8" font-size="9.5" text-anchor="middle">氣冷散熱・無冷卻水塔耗水</text>

                    <!-- 室外冷凝器與風扇模組 -->
                    <line x1="710" y1="110" x2="820" y2="110" stroke="#6366f1" stroke-width="4" stroke-linecap="round" />
                    <line x1="820" y1="200" x2="710" y2="200" stroke="#6366f1" stroke-width="4" stroke-linecap="round" />

                    <rect x="820" y="70" width="315" height="175" rx="10" fill="#1e1b4b" stroke="#6366f1" stroke-width="2" />
                    <rect x="820" y="70" width="315" height="30" rx="10" fill="#0f172a" />
                    <text x="977" y="90" fill="#f8fafc" font-size="13" font-weight="bold" text-anchor="middle">室外氣冷冷凝機組 (Air-Cooled Plant)</text>
                    
                    <text x="840" y="132" fill="#f1f5f9" font-size="12" font-weight="bold">V-Bank 氣冷冷凝盤管 + 變頻 EC 風扇</text>
                    <text x="840" y="158" fill="#a5b4fc" font-size="11">以室外乾球溫度 (DB) 直接風冷散熱</text>
                    <text x="840" y="185" fill="#cbd5e1" font-size="10.5">全封閉冷媒迴路 ｜ 零水耗 (WUE = 0)</text>
                    <text x="840" y="210" fill="#94a3b8" font-size="9.5">低溫時支援冷媒自然循環節能模式 (Economizer)</text>
                `;
            } else if (isWaterCooled) {
                fwRejTitle = '水冷式冰水主機 + 濕式冷卻塔';
                fwPlantSvg = `
                    <!-- 水冷式冰機主機 -->
                    <rect x="510" y="70" width="200" height="175" rx="10" fill="#0f172a" stroke="#3b82f6" stroke-width="2" />
                    <rect x="510" y="70" width="200" height="30" rx="10" fill="#1e3a8a" />
                    <text x="610" y="90" fill="#dbeafe" font-size="12" font-weight="bold" text-anchor="middle">水冷式冰機 (Centrifugal/Screw)</text>
                    
                    <rect x="525" y="118" width="26" height="100" rx="4" fill="#1e293b" stroke="#60a5fa" stroke-width="1.2" />
                    <path d="M 531 128 L 542 143 L 531 158 M 538 128 L 549 143 L 538 158 M 531 158 L 542 173 L 531 188 M 538 158 L 549 173 L 538 188" stroke="#93c5fd" stroke-width="1.5" fill="none" stroke-linecap="round" />
                    <text x="630" y="135" fill="#f8fafc" font-size="12" font-weight="bold" text-anchor="middle">高效率水冷壓縮製冷</text>
                    <text x="630" y="162" fill="#93c5fd" font-size="11" font-weight="bold" text-anchor="middle">供水 ${chwSupplyC}°C ⇄ 回水 ${chwReturnC}°C</text>
                    <text x="630" y="188" fill="#cbd5e1" font-size="10" text-anchor="middle">設計 COP: 5.8 ~ 6.5</text>
                    <text x="630" y="212" fill="#94a3b8" font-size="9.5" text-anchor="middle">冷凝熱經冷卻水路排放至水塔</text>

                    <!-- 冷卻水循環泵 -->
                    <line x1="710" y1="110" x2="745" y2="110" stroke="#0284c7" stroke-width="4" stroke-linecap="round" />
                    <circle cx="760" cy="110" r="15" fill="#0369a1" stroke="#38bdf8" stroke-width="2" />
                    <polygon points="755,104 767,110 755,116" fill="#ffffff" />
                    <text x="760" y="138" fill="#38bdf8" font-size="10" font-weight="bold" text-anchor="middle">CW Pump</text>
                    <line x1="775" y1="110" x2="820" y2="110" stroke="#0284c7" stroke-width="4" stroke-linecap="round" />
                    <line x1="820" y1="200" x2="710" y2="200" stroke="#0284c7" stroke-width="4" stroke-linecap="round" />

                    <!-- 室外濕式冷卻塔 -->
                    <rect x="820" y="70" width="315" height="175" rx="10" fill="#082f49" stroke="#0284c7" stroke-width="2" />
                    <rect x="820" y="70" width="315" height="30" rx="10" fill="#0f172a" />
                    <text x="977" y="90" fill="#f8fafc" font-size="13" font-weight="bold" text-anchor="middle">濕式冷卻水塔 (Cooling Tower)</text>
                    
                    <text x="840" y="132" fill="#f1f5f9" font-size="12" font-weight="bold">濕球溫度蒸發排熱</text>
                    <text x="840" y="158" fill="#7dd3fc" font-size="11">連續排放冰機壓縮機冷凝廢熱</text>
                    <text x="840" y="185" fill="#cbd5e1" font-size="10.5">自動補水與排污控制</text>
                    <text x="840" y="210" fill="#94a3b8" font-size="9.5">提供 30~32°C 冷卻水至冰機冷凝器</text>
                `;
            } else if (isDistrict) {
                fwRejTitle = '廠區集中冰水管網 (Central Plant)';
                fwPlantSvg = `
                    <!-- 廠區板換解耦器 -->
                    <rect x="510" y="70" width="200" height="175" rx="10" fill="#0f172a" stroke="#0d9488" stroke-width="2" />
                    <rect x="510" y="70" width="200" height="30" rx="10" fill="#134e4a" />
                    <text x="610" y="90" fill="#ccfbf1" font-size="12" font-weight="bold" text-anchor="middle">廠房水力解耦板換 (Campus PHE)</text>
                    
                    <rect x="525" y="118" width="26" height="100" rx="4" fill="#1e293b" stroke="#2dd4bf" stroke-width="1.2" />
                    <path d="M 531 128 L 542 143 L 531 158 M 538 128 L 549 143 L 538 158 M 531 158 L 542 173 L 531 188" stroke="#5eead4" stroke-width="1.5" fill="none" stroke-linecap="round" />
                    <text x="630" y="135" fill="#f8fafc" font-size="12" font-weight="bold" text-anchor="middle">園區一次側集中供冷</text>
                    <text x="630" y="162" fill="#5eead4" font-size="11" font-weight="bold" text-anchor="middle">供水 ${chwSupplyC}°C ⇄ 回水 ${chwReturnC}°C</text>
                    <text x="630" y="188" fill="#cbd5e1" font-size="10" text-anchor="middle">一二次側壓差獨立調節</text>
                    <text x="630" y="212" fill="#94a3b8" font-size="9.5" text-anchor="middle">廠務中央調度與熱計量計費</text>

                    <!-- 廠區環網管路 -->
                    <line x1="710" y1="110" x2="820" y2="110" stroke="#0d9488" stroke-width="4" stroke-linecap="round" />
                    <line x1="820" y1="200" x2="710" y2="200" stroke="#0d9488" stroke-width="4" stroke-linecap="round" />

                    <!-- 園區中央能源站 -->
                    <rect x="820" y="70" width="315" height="175" rx="10" fill="#042f2e" stroke="#0d9488" stroke-width="2" />
                    <rect x="820" y="70" width="315" height="30" rx="10" fill="#0f172a" />
                    <text x="977" y="90" fill="#f8fafc" font-size="13" font-weight="bold" text-anchor="middle">園區中央能源站 (Campus Energy Center)</text>
                    
                    <text x="840" y="132" fill="#f1f5f9" font-size="12" font-weight="bold">大型離心式冰水機群 + 水側節能器</text>
                    <text x="840" y="158" fill="#5eead4" font-size="11">N+2 園區級高可用性集中供冷</text>
                    <text x="840" y="185" fill="#cbd5e1" font-size="10.5">多建築共用負載平滑化效益</text>
                    <text x="840" y="210" fill="#94a3b8" font-size="9.5">超高能效比 (綜合年均 COP > 7.0)</text>
                `;
            } else if (isRdhx) {
                fwRejTitle = '背板熱交換器排熱 (RDHX Plant)';
                fwPlantSvg = `
                    <!-- 高溫冰水換熱核心 -->
                    <rect x="510" y="70" width="200" height="175" rx="10" fill="#0f172a" stroke="#8b5cf6" stroke-width="2" />
                    <rect x="510" y="70" width="200" height="30" rx="10" fill="#3b0764" />
                    <text x="610" y="90" fill="#f3e8ff" font-size="12" font-weight="bold" text-anchor="middle">中溫水路解耦 (Neutral Water Loop)</text>
                    
                    <rect x="525" y="118" width="26" height="100" rx="4" fill="#1e293b" stroke="#c084fc" stroke-width="1.2" />
                    <path d="M 531 128 L 542 143 L 531 158 M 538 128 L 549 143 L 538 158 M 531 158 L 542 173 L 531 188" stroke="#d8b4fe" stroke-width="1.5" fill="none" stroke-linecap="round" />
                    <text x="630" y="135" fill="#f8fafc" font-size="12" font-weight="bold" text-anchor="middle">中溫無結露水路</text>
                    <text x="630" y="162" fill="#d8b4fe" font-size="11" font-weight="bold" text-anchor="middle">供水 ${chwSupplyC}°C ⇄ 回水 ${chwReturnC}°C</text>
                    <text x="630" y="188" fill="#cbd5e1" font-size="10" text-anchor="middle">高水溫極大化自然冷卻潛力</text>
                    <text x="630" y="212" fill="#94a3b8" font-size="9.5" text-anchor="middle">近端吸熱・白區零熱島效應</text>

                    <!-- 排熱管路 -->
                    <line x1="710" y1="110" x2="820" y2="110" stroke="#8b5cf6" stroke-width="4" stroke-linecap="round" />
                    <line x1="820" y1="200" x2="710" y2="200" stroke="#8b5cf6" stroke-width="4" stroke-linecap="round" />

                    <!-- 高水溫排熱主機 -->
                    <rect x="820" y="70" width="315" height="175" rx="10" fill="#2e1065" stroke="#8b5cf6" stroke-width="2" />
                    <rect x="820" y="70" width="315" height="30" rx="10" fill="#0f172a" />
                    <text x="977" y="90" fill="#f8fafc" font-size="13" font-weight="bold" text-anchor="middle">高水溫節能排熱源 (High-Temp Loop)</text>
                    
                    <text x="840" y="132" fill="#f1f5f9" font-size="12" font-weight="bold">乾冷器直冷 / 高溫冰機輔助</text>
                    <text x="840" y="158" fill="#d8b4fe" font-size="11">22°C 高溫供水支援全年大比例 Free Cooling</text>
                    <text x="840" y="185" fill="#cbd5e1" font-size="10.5">消除傳統低溫冰水之除濕凝露耗能</text>
                    <text x="840" y="210" fill="#94a3b8" font-size="9.5">極致 PUE 表現・現代高密 AI 機房首選</text>
                `;
            }

            return `
                <div class="p-4 bg-slate-950 rounded-2xl text-white font-mono border border-slate-800 shadow-xl overflow-hidden">
                    <!-- 頂部標題 -->
                    <div class="flex flex-col sm:flex-row sm:items-center justify-between text-xs pb-3 border-b border-slate-800/80 gap-2">
                        <div class="flex items-center gap-2">
                            <span class="inline-flex items-center justify-center px-3 py-1 rounded-md bg-indigo-950 text-indigo-300 font-black text-xs border border-indigo-700">Air Cooling Schematic</span>
                            <span class="font-bold text-slate-100 text-sm">白區氣冷與輔助排熱拓樸 (Air & Fanwall Heat Rejection System)</span>
                        </div>
                        <div class="flex items-center gap-2">
                            <span class="px-3 py-1 rounded-md bg-indigo-950/80 text-indigo-300 text-xs font-bold border border-indigo-800 flex items-center gap-1.5">
                                <span class="w-2 h-2 rounded-full bg-indigo-400"></span>
                                排熱架構: ${fwRejTitle}
                            </span>
                        </div>
                    </div>

                    <!-- 運轉狀態橫幅 -->
                    <div class="grid grid-cols-1 gap-2 my-2.5 text-xs">
                        <div class="p-2.5 rounded-lg bg-indigo-950/40 border border-indigo-800/60 flex items-center gap-2">
                            <span class="w-2.5 h-2.5 rounded-full bg-indigo-400"></span>
                            <span class="text-indigo-300 font-bold text-sm">${isRdhx ? 'RDHX 背板近端熱移除模式' : 'Fanwall / CRAH 機房側冷卻模式'}</span>
                            <span class="text-slate-300 ml-auto">白區氣冷負載: ${airLoadKw.toFixed(1)} kW ｜ 冰水溫差: ${dtChw}°C (${chwSupplyC}°C ⇄ ${chwReturnC}°C)</span>
                        </div>
                    </div>

                    <!-- SVG 畫布 (viewBox 0 0 1160 300) -->
                    <div class="w-full overflow-x-auto pt-1">
                        <svg viewBox="0 0 1160 300" class="w-full min-w-[1000px] h-auto select-none font-sans">
                            <!-- ======================================================= -->
                            <!-- 1. 白區 IT 機櫃廢熱源 (Air Heat Load) -->
                            <!-- ======================================================= -->
                            <rect x="20" y="25" width="150" height="250" rx="10" fill="#0f172a" stroke="#475569" stroke-width="2" />
                            <rect x="20" y="25" width="150" height="30" rx="10" fill="#1e293b" />
                            <text x="95" y="46" fill="#f8fafc" font-size="12" font-weight="bold" text-anchor="middle">IT 白區氣流廢熱</text>

                            <rect x="30" y="70" width="130" height="65" rx="8" fill="#1e293b" stroke="#334155" stroke-width="1.5" />
                            <rect x="37" y="78" width="116" height="18" rx="4" fill="#334155" />
                            <circle cx="49" cy="87" r="3" fill="#6366f1" />
                            <circle cx="59" cy="87" r="3" fill="#38bdf8" />
                            <text x="100" y="91" fill="#f1f5f9" font-size="9.5" font-weight="bold" text-anchor="middle">網通 / 儲存 / 輔助廢熱</text>
                            <text x="95" y="123" fill="#818cf8" font-size="14" font-weight="900" text-anchor="middle">${airLoadKw.toFixed(0)} kW</text>

                            <text x="95" y="165" fill="#38bdf8" font-size="11" font-weight="bold" text-anchor="middle">進風冷通道: 24 ~ 27°C</text>
                            <text x="95" y="190" fill="#f43f5e" font-size="10.5" text-anchor="middle">排風熱通道: 36 ~ 40°C</text>
                            <text x="95" y="215" fill="#94a3b8" font-size="9.5" text-anchor="middle">氣流溫升: ΔT ≈ 12°C</text>

                            <!-- ======================================================= -->
                            <!-- 2. 白區空調機組 (Fanwall / CRAH / RDHX) -->
                            <!-- ======================================================= -->
                            <!-- 熱回風管路 -->
                            <line x1="170" y1="90" x2="210" y2="90" stroke="#f43f5e" stroke-width="4.5" stroke-linecap="round" />
                            <!-- 冷送風管路 -->
                            <line x1="210" y1="210" x2="170" y2="210" stroke="#0284c7" stroke-width="4.5" stroke-linecap="round" />

                            <rect x="210" y="25" width="145" height="250" rx="10" fill="#1e1b4b" stroke="#6366f1" stroke-width="2" />
                            <rect x="210" y="25" width="145" height="30" rx="10" fill="#312e81" />
                            <text x="282" y="46" fill="#faf5ff" font-size="12" font-weight="bold" text-anchor="middle">${isRdhx ? 'RDHX 背板換熱器' : 'Fanwall / CRAH'}</text>

                            <rect x="222" y="70" width="121" height="100" rx="8" fill="#0f172a" stroke="#4f46e5" stroke-width="1.5" />
                            <!-- 空調盤管與風扇圖標 -->
                            <path d="M 245 80 L 245 160 M 255 80 L 255 160 M 265 80 L 265 160" stroke="#818cf8" stroke-width="2" stroke-linecap="round" />
                            <circle cx="295" cy="100" r="14" fill="#1e1b4b" stroke="#818cf8" stroke-width="1.2" />
                            <text x="295" y="104" fill="#a5b4fc" font-size="9" font-weight="bold" text-anchor="middle">FAN</text>
                            <circle cx="295" cy="135" r="14" fill="#1e1b4b" stroke="#818cf8" stroke-width="1.2" />
                            <text x="295" y="139" fill="#a5b4fc" font-size="9" font-weight="bold" text-anchor="middle">FAN</text>

                            <text x="282" y="195" fill="#e0e7ff" font-size="11" font-weight="bold" text-anchor="middle">${fwUnitQty} 台 (N+1)</text>
                            <text x="282" y="215" fill="#a5b4fc" font-size="9.5" text-anchor="middle">${isRdhx ? '背板無風扇/微風扇' : 'EC 變頻風機牆矩陣'}</text>
                            <text x="282" y="235" fill="#34d399" font-size="10" font-weight="bold" text-anchor="middle">冰水流量: ${flowChwLpm.toLocaleString()} LPM</text>

                            <!-- ======================================================= -->
                            <!-- 3. 冰水管路 (CHW Piping & Secondary Pump) -->
                            <!-- ======================================================= -->
                            <!-- CHW Return: Hot water from CRAH back to Chiller -->
                            <line x1="355" y1="110" x2="510" y2="110" stroke="#ea580c" stroke-width="4.5" stroke-linecap="round" />
                            <rect x="365" y="65" width="135" height="24" rx="5" fill="#881337" stroke="#f43f5e" stroke-width="1.5" />
                            <text x="432" y="81" fill="#ffe4e6" font-size="10" font-weight="bold" text-anchor="middle">回水: ${chwReturnC}°C (CHW Return)</text>

                            <!-- CHW Supply: Cold water to CRAH from Chiller -->
                            <line x1="510" y1="200" x2="445" y2="200" stroke="#0284c7" stroke-width="4.5" stroke-linecap="round" />
                            
                            <!-- CHW Secondary Pump -->
                            <circle cx="430" cy="200" r="15" fill="#0369a1" stroke="#38bdf8" stroke-width="2" />
                            <polygon points="436,194 424,200 436,206" fill="#ffffff" />
                            <text x="430" y="228" fill="#38bdf8" font-size="10" font-weight="bold" text-anchor="middle">CHW Pump</text>

                            <line x1="415" y1="200" x2="355" y2="200" stroke="#0284c7" stroke-width="4.5" stroke-linecap="round" />
                            <rect x="365" y="238" width="135" height="24" rx="5" fill="#0c4a6e" stroke="#0284c7" stroke-width="1.5" />
                            <text x="432" y="254" fill="#e0f2fe" font-size="10" font-weight="bold" text-anchor="middle">供水: ${chwSupplyC}°C (CHW Supply)</text>

                            <!-- ======================================================= -->
                            <!-- 4. 排熱與冰機拓樸 (Plant Schematic) -->
                            <!-- ======================================================= -->
                            ${fwPlantSvg}
                        </svg>
                    </div>
                </div>
            `;
        }
    });
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
