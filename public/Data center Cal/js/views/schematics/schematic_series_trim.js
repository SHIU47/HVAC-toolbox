'use strict';
/**
 * schematic_series_trim.js - NVIDIA DSX Series Trim Hybrid Cooling Topology SVG
 * Used by: dry_cooler_trim (and legacy alias dry_cooler_hx)
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

    root.CoolingSchematics.register('series_trim', {
        render(ctx) {
            const t = ctx.t;
            const cduSys = ctx.cduSys || t.obj.plantDesign.cduSystem;
            const arch = ctx.arch || cduSys.architecture || 'dry_cooler_trim';

            const dcApproach = cduSys.dryCoolerApproachC ?? 5.0;
            const pheApproach = (arch === 'dry_cooler_trim' || arch === 'dry_cooler_hx') ? (cduSys.pheApproachC ?? 2.0) : 0.0;
            const cduApproachC = cduSys.cduApproachC ?? 3.0;
            const fwsSupplyC = cduSys.fwsSupplyC ?? Number((cduSys.secSupplyC - cduApproachC).toFixed(1));
            const cduFcThresh = (fwsSupplyC - dcApproach - pheApproach).toFixed(1);
            const mode1DbMax = parseFloat(cduFcThresh);
            const mode2DbMax = (mode1DbMax + ((typeof A === 'function') ? A('nvidia_dsx_mode2_offset_c') : 5.7)).toFixed(1);

            const rejTitle = '乾冷器 (Dry Cooler)';
            const liqLoadKw = (cduSys.designBasis?.liq_load_kw || t.summ.liquidHeatKw || 0);
            const dtSec = Math.max(0.5, (cduSys.secReturnC || 57) - (cduSys.secSupplyC || 45));
            const dtPrim = Math.max(0.5, (cduSys.fwsReturnC || 55) - (cduSys.fwsSupplyC || 40));
            const flowSecLpm = Math.round((liqLoadKw * 14.33) / dtSec);
            const flowPrimLpm = Math.round((liqLoadKw * 14.33) / dtPrim);
            const cduUnitQty = (cduSys.sizing || []).find(s => s.key === 'cdu_unit')?.selectedQty || 3;
            const trimChillerItem = (cduSys.sizing || []).find(s => s.key === 'trim_chiller');
            const trimChillerModel = trimChillerItem?.selectedModel || 'Carrier 30XW-500kW (COP 5.8)';

            // 專業廠務工程 P&ID 拓樸架構 — 確切單點物理設計水溫
            const designCond = (typeof AppStore !== 'undefined' && AppStore.designConditions) ? AppStore.designConditions() : { designDb: 35.0 };
            const opTrim = (typeof AppStore !== 'undefined' && AppStore.trimOperatingPoint) ? AppStore.trimOperatingPoint(cduSys, designCond.designDb) : null;
            const precoolTemp = opTrim ? Number(opTrim.tPre.toFixed(1)) : Number((cduSys.fwsSupplyC + (cduSys.fwsReturnC - cduSys.fwsSupplyC) * 0.4).toFixed(1));
            const dcWaterSupplyExact = opTrim ? opTrim.tDc.toFixed(1) : (cduSys.fwsSupplyC - pheApproach).toFixed(1); // 乾冷器供水設計溫 (如 35.0°C)
            const condWaterEnterExact = opTrim ? opTrim.tCewt.toFixed(1) : (cduSys.fwsReturnC - pheApproach).toFixed(1); // 預冷後進冷凝器設計溫 (如 45.0°C)
            const trimCop = trimChillerItem?.catalog?.find(c => c.model === trimChillerItem.selectedModel)?.cop || 5.8;
            const condWaterLeaveExact = opTrim ? (opTrim.tCewt + (opTrim.tPre - opTrim.tSup) * (1 + 1 / trimCop)).toFixed(1) : (cduSys.fwsReturnC - pheApproach + 4.8).toFixed(1); // 冷凝排熱總回水設計溫 (如 49.8°C)
            const chwSupplyTemp = opTrim ? Number(opTrim.tChws.toFixed(1)) : Math.min(30, cduSys.fwsSupplyC - 7); // 冰機供水設計溫 (如 30.0°C)
            const chwReturnTempExact = (chwSupplyTemp + 5.0).toFixed(1); // 冰機回水設計溫 (如 35.0°C)
            const secSupplyC = cduSys.secSupplyC;
            const secReturnC = cduSys.secReturnC;

            // =========================================================================
            // 雙迴路混合架構 (dry_cooler_trim 專屬: NVIDIA DSX 官方標準 Trim/Hybrid Cooling)
            // =========================================================================
            const facilitySchematicSvg = `
                <!-- ======================================================= -->
                <!-- 1. PRIMARY FWS LOOP (廠務側串聯換熱鏈) -->
                <!-- ======================================================= -->
                <!-- CDU 熱回水出口 (X=320, Y=75) → Primary HX 入口 (X=430, Y=75) -->
                <line x1="320" y1="75" x2="430" y2="75" stroke="#ea580c" stroke-width="4.5" stroke-linecap="round" />
                <rect x="330" y="42" width="80" height="24" rx="5" fill="#881337" stroke="#f43f5e" stroke-width="1.5" />
                <text x="370" y="58" fill="#ffe4e6" font-size="10.5" font-weight="bold" text-anchor="middle">${cduSys.fwsReturnC}°C</text>

                <!-- Primary HX 預冷出水 (X=430, Y=115) → 串聯進入 Secondary HX 入口 (X=430, Y=205) -->
                <path d="M 430 115 L 365 115 L 365 205 L 430 205" stroke="#f59e0b" stroke-width="4" stroke-dasharray="6,4" stroke-linecap="round" stroke-linejoin="round" fill="none" />
                <rect x="330" y="148" width="70" height="22" rx="4" fill="#1e293b" stroke="#f59e0b" stroke-width="1.5" />
                <text x="365" y="163" fill="#fef3c7" font-size="10" font-weight="bold" text-anchor="middle">${precoolTemp}°C</text>

                <!-- Secondary HX 修整出水 (X=430, Y=265) → Secondary Pump → CDU 冷供水入口 (X=320, Y=265) -->
                <line x1="430" y1="265" x2="385" y2="265" stroke="#0284c7" stroke-width="4.5" stroke-linecap="round" />
                
                <!-- Secondary Pump (二次側設施供水泵) -->
                <circle cx="370" cy="265" r="14" fill="#0369a1" stroke="#38bdf8" stroke-width="2" />
                <polygon points="376,259 364,265 376,271" fill="#ffffff" />
                <text x="370" y="293" fill="#38bdf8" font-size="9" font-weight="bold" text-anchor="middle">FWS Pump</text>

                <line x1="355" y1="265" x2="320" y2="265" stroke="#0284c7" stroke-width="4.5" stroke-linecap="round" />
                <rect x="330" y="222" width="80" height="24" rx="5" fill="#0c4a6e" stroke="#0284c7" stroke-width="1.5" />
                <text x="370" y="238" fill="#e0f2fe" font-size="10.5" font-weight="bold" text-anchor="middle">${cduSys.fwsSupplyC}°C</text>

                <!-- ======================================================= -->
                <!-- 2. PRIMARY HEAT EXCHANGER (Primary 板換 / 預冷) -->
                <!-- ======================================================= -->
                <rect x="430" y="35" width="200" height="100" rx="10" fill="#0f172a" stroke="#10b981" stroke-width="2" />
                <rect x="430" y="35" width="200" height="26" rx="10" fill="#064e3b" />
                <text x="530" y="53" fill="#d1fae5" font-size="11" font-weight="bold" text-anchor="middle">Liquid-to-Liquid HX (Primary)</text>

                <rect x="442" y="68" width="22" height="55" rx="4" fill="#1e293b" stroke="#34d399" stroke-width="1" />
                <path d="M 447 75 L 455 85 L 447 95 M 453 75 L 461 85 L 453 95 M 447 95 L 455 105 L 447 115" stroke="#34d399" stroke-width="1.3" fill="none" stroke-linecap="round" />
                <text x="540" y="82" fill="#34d399" font-size="11" font-weight="bold" text-anchor="middle">自然預冷 (Free Pre-Cool)</text>
                <text x="540" y="100" fill="#a7f3d0" font-size="9.5" text-anchor="middle">回水預冷至 ${precoolTemp}°C</text>
                <text x="540" y="118" fill="#cbd5e1" font-size="9" text-anchor="middle">以乾冷器出水為冷源</text>

                <!-- ======================================================= -->
                <!-- 3. SECONDARY HEAT EXCHANGER (Secondary 板換 / Trim 修整) -->
                <!-- ======================================================= -->
                <rect x="430" y="185" width="200" height="100" rx="10" fill="#0f172a" stroke="#818cf8" stroke-width="2" />
                <rect x="430" y="185" width="200" height="26" rx="10" fill="#312e81" />
                <text x="530" y="203" fill="#e0e7ff" font-size="11" font-weight="bold" text-anchor="middle">Liquid-to-Liquid HX (Secondary)</text>

                <rect x="442" y="218" width="22" height="55" rx="4" fill="#1e293b" stroke="#a5b4fc" stroke-width="1" />
                <path d="M 447 225 L 455 235 L 447 245 M 453 225 L 461 235 L 453 245 M 447 245 L 455 255 L 447 265" stroke="#a5b4fc" stroke-width="1.3" fill="none" stroke-linecap="round" />
                <text x="540" y="232" fill="#818cf8" font-size="11" font-weight="bold" text-anchor="middle">接力修整 (Trim Cooling)</text>
                <text x="540" y="250" fill="#c7d2fe" font-size="9.5" text-anchor="middle">精確修整至 ${cduSys.fwsSupplyC}°C</text>
                <text x="540" y="268" fill="#cbd5e1" font-size="9" text-anchor="middle">由 Trim Chiller ${chwSupplyTemp}°C 冰水冷卻</text>

                <!-- ======================================================= -->
                <!-- 4. TRIM CHILLER EVAPORATOR LOOP (冰水主機蒸發器迴路) -->
                <!-- ======================================================= -->
                <!-- Chiller 產出冰水 (X=730, Y=205) → Secondary HX 右上入口 (X=630, Y=205) -->
                <line x1="730" y1="205" x2="630" y2="205" stroke="#0284c7" stroke-width="4" stroke-linecap="round" />
                <rect x="655" y="180" width="60" height="20" rx="4" fill="#0c4a6e" stroke="#0284c7" stroke-width="1.2" />
                <text x="685" y="194" fill="#e0f2fe" font-size="9.5" font-weight="bold" text-anchor="middle">${chwSupplyTemp}°C</text>

                <!-- Secondary HX 吸熱回水 (X=630, Y=265) → 冰機蒸發器入口 (X=730, Y=265) -->
                <line x1="630" y1="265" x2="730" y2="265" stroke="#ea580c" stroke-width="4" stroke-linecap="round" />
                <rect x="655" y="272" width="60" height="20" rx="4" fill="#881337" stroke="#f43f5e" stroke-width="1.2" />
                <text x="685" y="286" fill="#ffe4e6" font-size="9" font-weight="bold" text-anchor="middle">${chwReturnTempExact}°C</text>

                <!-- ======================================================= -->
                <!-- 5. WATER COOLED CHILLERS (水冷式冰水主機) -->
                <!-- ======================================================= -->
                <rect x="730" y="185" width="200" height="100" rx="10" fill="#1e1b4b" stroke="#818cf8" stroke-width="2" />
                <rect x="730" y="185" width="200" height="26" rx="10" fill="#312e81" />
                <text x="830" y="203" fill="#f8fafc" font-size="11.5" font-weight="bold" text-anchor="middle">Water Cooled Chillers</text>

                <circle cx="755" cy="235" r="13" fill="#312e81" stroke="#a5b4fc" stroke-width="1.5" />
                <text x="755" y="239" fill="#ffffff" font-size="8.5" font-weight="bold" text-anchor="middle">Trim</text>

                <text x="845" y="235" fill="#e0e7ff" font-size="10.5" font-weight="bold" text-anchor="middle">冷凝熱串聯排放至 Dry Coolers</text>
                <text x="845" y="258" fill="#94a3b8" font-size="9.5" text-anchor="middle">高效離心/螺桿式機械壓縮製冷</text>

                <!-- ======================================================= -->
                <!-- 6. DRY COOLER & CONDENSER SERIES LOOP (乾冷器與冷凝器串聯排熱鏈) -->
                <!-- ======================================================= -->
                <!-- A. Dry Coolers 出水 (X=1060, Y=105) → Primary HX 右上冷源入口 (X=630, Y=75) -->
                <path d="M 1060 105 L 1010 105 L 1010 75 L 630 75" stroke="#0284c7" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" fill="none" />
                <rect x="795" y="50" width="70" height="20" rx="4" fill="#0c4a6e" stroke="#0284c7" stroke-width="1.2" />
                <text x="830" y="64" fill="#e0f2fe" font-size="9.5" font-weight="bold" text-anchor="middle">${dcWaterSupplyExact}°C</text>

                <!-- B. Primary HX 預冷吸熱出水 (X=630, Y=115) → 串聯進入 Chiller 冷凝器 (X=930, Y=205) [X=960 立管] -->
                <path d="M 630 115 L 960 115 L 960 205 L 930 205" stroke="#ec4899" stroke-width="3.5" stroke-dasharray="6,4" stroke-linecap="round" stroke-linejoin="round" fill="none" />
                <rect x="795" y="93" width="70" height="20" rx="4" fill="#831843" stroke="#f472b6" stroke-width="1.2" />
                <text x="830" y="107" fill="#fdf2f8" font-size="9.5" font-weight="bold" text-anchor="middle">${condWaterEnterExact}°C</text>

                <!-- C. Chiller 冷凝熱全額排熱水 (X=930, Y=245) → Dry Coolers 下方入口 (X=1060, Y=185) [X=1010 立管，完全不重疊] -->
                <path d="M 930 245 L 1010 245 L 1010 185 L 1060 185" stroke="#ea580c" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" fill="none" />
                <rect x="942" y="222" width="65" height="20" rx="4" fill="#881337" stroke="#f43f5e" stroke-width="1.2" />
                <text x="974" y="236" fill="#ffe4e6" font-size="9" font-weight="bold" text-anchor="middle">${condWaterLeaveExact}°C</text>

                <!-- ======================================================= -->
                <!-- 7. DRY COOLERS (室外乾式冷卻器模組) -->
                <!-- ======================================================= -->
                <!-- 頂部氣流箭頭 (進風外氣設計乾球溫) -->
                <text x="1160" y="55" fill="#38bdf8" font-size="10" font-weight="bold" text-anchor="middle">外氣乾球溫: ${mode1DbMax}°C</text>
                <polygon points="1110,60 1120,60 1115,70" fill="#38bdf8" />
                <polygon points="1160,60 1170,60 1165,70" fill="#38bdf8" />
                <polygon points="1210,60 1220,60 1215,70" fill="#38bdf8" />

                <rect x="1060" y="75" width="200" height="150" rx="10" fill="#042f2e" stroke="#14b8a6" stroke-width="2" />
                <rect x="1060" y="75" width="200" height="28" rx="10" fill="#0f172a" />
                <text x="1160" y="94" fill="#f8fafc" font-size="12" font-weight="bold" text-anchor="middle">Dry Coolers</text>
                
                <text x="1075" y="122" fill="#f1f5f9" font-size="11" font-weight="bold">零耗水自然風冷</text>
                <text x="1075" y="142" fill="#a7f3d0" font-size="10">Approach: ${dcApproach}°C ｜ 門檻: ≤${cduFcThresh}°C</text>
                <text x="1075" y="162" fill="#cbd5e1" font-size="9.5">Mode 1: 滿載自然風冷</text>
                <text x="1075" y="178" fill="#cbd5e1" font-size="9.5">Mode 2: 串聯預冷與主機冷凝排熱</text>

                <!-- 底部排熱箭頭 -->
                <polygon points="1110,230 1120,230 1115,240" fill="#ef4444" />
                <polygon points="1160,230 1170,230 1165,240" fill="#ef4444" />
                <polygon points="1210,230 1220,230 1215,240" fill="#ef4444" />
                `;

            return `
                <div class="p-4 bg-slate-950 rounded-2xl text-white font-mono border border-slate-800 shadow-xl overflow-hidden">
                    <style>
                        .valve-glyph { fill: #1e293b; stroke: #94a3b8; stroke-width: 1.5; }
                    </style>

                    <!-- 頂部標題與 NVIDIA 參考規範標籤 -->
                    <div class="flex flex-col sm:flex-row sm:items-center justify-between text-xs pb-3 border-b border-slate-800/80 gap-2">
                        <div class="flex items-center gap-2">
                            <span class="inline-flex items-center justify-center px-3 py-1 rounded-md bg-emerald-950 text-emerald-300 font-black text-xs border border-emerald-700">NVIDIA Reference Schematic</span>
                            <span class="font-bold text-slate-100 text-sm">AI 算力中心廠務排熱拓樸 (Facility Heat Rejection System)</span>
                        </div>
                        <div class="flex items-center gap-2">
                            <span class="px-3 py-1 rounded-md bg-purple-950/80 text-purple-300 text-xs font-bold border border-purple-800 flex items-center gap-1.5">
                                <span class="w-2 h-2 rounded-full bg-purple-400"></span>
                                排熱架構: ${rejTitle}
                            </span>
                        </div>
                    </div>

                    <!-- 運轉模式狀態橫幅 -->
                    
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-2 my-2.5 text-xs">
                        <div class="p-2.5 rounded-lg bg-emerald-950/40 border border-emerald-800/60 flex items-center gap-2">
                            <span class="w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
                            <span class="text-emerald-300 font-bold">Mode 1 全直冷 (≤${mode1DbMax}°C)</span>
                            <span class="text-slate-300 ml-auto">100% 走 Economizer</span>
                        </div>
                        <div class="p-2.5 rounded-lg bg-amber-950/40 border border-amber-800/60 flex items-center gap-2">
                            <span class="w-2.5 h-2.5 rounded-full bg-amber-400"></span>
                            <span class="text-amber-300 font-bold">Mode 2 串聯修整 (≤${mode2DbMax}°C)</span>
                            <span class="text-slate-300 ml-auto">預冷至 ${precoolTemp}°C → Trim 冰機</span>
                        </div>
                        <div class="p-2.5 rounded-lg bg-red-950/40 border border-red-800/60 flex items-center gap-2">
                            <span class="w-2.5 h-2.5 rounded-full bg-red-400"></span>
                            <span class="text-red-300 font-bold">Mode 3 全機械製冷 (>${mode2DbMax}°C)</span>
                            <span class="text-slate-300 ml-auto">全額走 Trim 冰機製冷</span>
                        </div>
                    </div>

                    <!-- SVG 拓樸畫布 (viewBox 0 0 1160 340，標準工程正交佈局、零重疊、大字體) -->
                    <div class="w-full overflow-x-auto pt-1">
                        <svg viewBox="0 0 1260 330" class="w-full min-w-[1050px] h-auto select-none font-sans">
                            <!-- ======================================================= -->
                            <!-- 1. COMPUTE DATA HALL (AI GPU 機櫃與冷板) -->
                            <!-- ======================================================= -->
                            <rect x="20" y="35" width="130" height="250" rx="10" fill="#0f172a" stroke="#475569" stroke-width="2" />
                            <rect x="20" y="35" width="130" height="28" rx="10" fill="#1e293b" />
                            <text x="85" y="54" fill="#f8fafc" font-size="11" font-weight="bold" text-anchor="middle">Compute Data Hall</text>
                            
                            <rect x="28" y="72" width="114" height="60" rx="8" fill="#1e293b" stroke="#334155" stroke-width="1.5" />
                            <text x="85" y="92" fill="#f1f5f9" font-size="9.5" font-weight="bold" text-anchor="middle">Cold Plate 晶片液冷</text>
                            <text x="85" y="118" fill="#ec4899" font-size="14" font-weight="900" text-anchor="middle">${liqLoadKw.toFixed(0)} kW</text>

                            <text x="85" y="160" fill="#38bdf8" font-size="10.5" font-weight="bold" text-anchor="middle">晶片水溫: ${secSupplyC} ⇄ ${secReturnC}°C</text>
                            <text x="85" y="185" fill="#a5b4fc" font-size="10" text-anchor="middle">二次側流量: ${flowSecLpm.toLocaleString()} LPM</text>
                            <text x="85" y="208" fill="#94a3b8" font-size="9" text-anchor="middle">ΔT = ${dtSec}°C (晶片溫升)</text>

                            <!-- ======================================================= -->
                            <!-- 2. SECONDARY TCS PIPING (機櫃 ⇄ CDU 二次側水路) -->
                            <!-- ======================================================= -->
                            <!-- Hot Secondary Return: ≤56°C -->
                            <line x1="150" y1="95" x2="190" y2="95" stroke="#f43f5e" stroke-width="4" stroke-linecap="round" />
                            <rect x="150" y="68" width="40" height="18" rx="3" fill="#881337" />
                            <text x="170" y="81" fill="#ffe4e6" font-size="8" font-weight="bold" text-anchor="middle">≤${secReturnC}°C</text>

                            <!-- Cold Secondary Supply: ≤45°C -->
                            <line x1="190" y1="245" x2="150" y2="245" stroke="#0284c7" stroke-width="4" stroke-linecap="round" />
                            <rect x="150" y="218" width="40" height="18" rx="3" fill="#0c4a6e" />
                            <text x="170" y="231" fill="#e0f2fe" font-size="8" font-weight="bold" text-anchor="middle">≤${secSupplyC}°C</text>

                            <!-- ======================================================= -->
                            <!-- 3. CDU - LC (100% 液冷分配單元) -->
                            <!-- ======================================================= -->
                            <rect x="190" y="35" width="130" height="250" rx="10" fill="#1e1b4b" stroke="#8b5cf6" stroke-width="2" />
                            <rect x="190" y="35" width="130" height="28" rx="10" fill="#3b0764" />
                            <text x="255" y="54" fill="#faf5ff" font-size="11.5" font-weight="bold" text-anchor="middle">CDU - LC (100%)</text>

                            <rect x="200" y="72" width="110" height="95" rx="8" fill="#0f172a" stroke="#6d28d9" stroke-width="1.5" />
                            <!-- CDU 板換內部板片 -->
                            <path d="M 230 82 L 238 157 M 244 82 L 252 157 M 258 82 L 266 157 M 272 82 L 280 157" stroke="#a78bfa" stroke-width="2" stroke-linecap="round" />
                            
                            <rect x="215" y="110" width="80" height="20" rx="4" fill="#2e1065" stroke="#c084fc" stroke-width="1" />
                            <text x="255" y="124" fill="#f5d0fe" font-size="9" font-weight="bold" text-anchor="middle">Approach ${cduApproachC}°C</text>

                            <text x="255" y="195" fill="#e9d5ff" font-size="11" font-weight="bold" text-anchor="middle">${cduUnitQty} 台 (N+1)</text>
                            <text x="255" y="215" fill="#a78bfa" font-size="9.5" text-anchor="middle">一二次側 100% 隔離</text>
                            <text x="255" y="235" fill="#34d399" font-size="10" font-weight="bold" text-anchor="middle">設施流量: ${flowPrimLpm.toLocaleString()} LPM</text>

                            <!-- ======================================================= -->
                            <!-- 4. FACILITY HEAT REJECTION SCHEMATIC (一次側廠務拓樸) -->
                            <!-- ======================================================= -->
                            ${facilitySchematicSvg}
                        </svg>
                    </div>

                    <!-- 底部即時物理驗算摘要條 -->
                    <div class="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-3 pt-3 border-t border-slate-800 text-[11px]">
                        <div class="flex items-center gap-1.5 text-slate-300">
                            <span class="w-2 h-2 rounded-full bg-pink-500"></span>
                            <span>二次側水流: <strong class="text-pink-300">${flowSecLpm.toLocaleString()} LPM</strong> (ΔT=${dtSec}°C)</span>
                        </div>
                        <div class="flex items-center gap-1.5 text-slate-300">
                            <span class="w-2 h-2 rounded-full bg-teal-400"></span>
                            <span>一次側水流: <strong class="text-teal-300">${flowPrimLpm.toLocaleString()} LPM</strong> (ΔT=${dtPrim}°C)</span>
                        </div>
                        <div class="flex items-center gap-1.5 text-slate-300">
                            <span class="w-2 h-2 rounded-full bg-emerald-400"></span>
                            <span>自然冷卻門檻: <strong class="text-emerald-300">≤${cduFcThresh}°C (Mode 1 滿載風冷)</strong></span>
                        </div>
                    </div>
                </div>
            `;
        }
    });
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
