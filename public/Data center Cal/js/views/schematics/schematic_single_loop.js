'use strict';
/**
 * schematic_single_loop.js - Single Loop Heat Rejection System Topology SVG
 * Used by: dry_cooler_pure, adiabatic_tower, cooling_tower_hx, water_chiller
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

    root.CoolingSchematics.register('single_loop', {
        render(ctx) {
            const t = ctx.t;
            const cduSys = ctx.cduSys || t.obj.plantDesign.cduSystem;
            const arch = ctx.arch || cduSys.architecture || 'dry_cooler_pure';

            const dcApproach = cduSys.dryCoolerApproachC ?? 5.0;
            const pheApproach = (arch === 'dry_cooler_trim' || arch === 'dry_cooler_hx') ? (cduSys.pheApproachC ?? 2.0) : 0.0;
            const cduApproachC = cduSys.cduApproachC ?? 3.0;
            const fwsSupplyC = cduSys.fwsSupplyC ?? Number((cduSys.secSupplyC - cduApproachC).toFixed(1));
            const cduFcThresh = (fwsSupplyC - dcApproach - pheApproach).toFixed(1);
            const mode1DbMax = parseFloat(cduFcThresh);

            const isZeroChiller = (arch === 'dry_cooler_pure' || arch === 'adiabatic_tower' || arch === 'cooling_tower_hx');
            const isFullMech = arch === 'water_chiller';
            let rejTitle = '乾冷器 (Dry Cooler)';
            let rejSub = '零耗水・自然風冷 (WUE=0)';
            let rejFill = '#042f2e';
            let rejStroke = '#14b8a6';
            let rejIconSvg = '<circle cx="710" cy="62" r="12" fill="#0f766e" stroke="#2dd4bf" stroke-width="1" /><path d="M 710 53 L 710 71 M 701 62 L 719 62" stroke="#ccfbf1" stroke-width="1.5" />';
            let rejLine1 = '零耗水自然風冷';
            let rejLine2 = `Approach: ${dcApproach}°C ｜ 門檻: ≤${cduFcThresh}°C DB`;

            if (arch === 'adiabatic_tower') {
                rejTitle = '絕熱冷卻塔 (Adiabatic Tower)';
                rejSub = '高溫噴霧預冷 (100% 自然冷卻・零冰機)';
                rejFill = '#082f49';
                rejStroke = '#38bdf8';
                rejIconSvg = '<circle cx="710" cy="62" r="12" fill="#0369a1" stroke="#38bdf8" stroke-width="1" /><path d="M 704 58 L 704 54 M 710 58 L 710 52 M 716 58 L 716 54" stroke="#7dd3fc" stroke-width="1.3" stroke-linecap="round" stroke-dasharray="1.5,1.5" />';
                rejLine1 = '高溫噴霧預冷 + 乾式自然散熱 (零冰機)';
                rejLine2 = `飽和效率: ${cduSys.adiabaticSaturationEfficiencyPct||85}% ｜ 全年 100% 自然冷卻`;
            } else if (arch === 'cooling_tower_hx') {
                rejTitle = '密閉式冷卻水塔 (Closed Cooling Tower)';
                rejSub = '全時蒸發自然冷卻 (100% 水側直冷・零冰機)';
                rejFill = '#164e63';
                rejStroke = '#06b6d4';
                rejIconSvg = '<circle cx="710" cy="62" r="12" fill="#0e7490" stroke="#06b6d4" stroke-width="1" /><circle cx="705" cy="63" r="1.6" fill="#a5f3fc" /><circle cx="710" cy="59" r="1.6" fill="#a5f3fc" /><circle cx="715" cy="64" r="1.6" fill="#a5f3fc" />';
                rejLine1 = '閉式盤管蒸發冷卻 (水質隔離・零冰機)';
                rejLine2 = '以濕球溫度驅動全時自然冷卻，全年無需冰機';
            } else if (arch === 'water_chiller') {
                rejTitle = '水冷式冰水主機 (Chiller)';
                rejSub = '全額機械壓縮冷卻 (COP 5.5)';
                rejFill = '#1e293b';
                rejStroke = '#94a3b8';
                rejIconSvg = '<circle cx="710" cy="62" r="11" fill="#334155" stroke="#94a3b8" stroke-width="1" /><text x="710" y="65" fill="#f8fafc" font-size="8" font-weight="900" text-anchor="middle">DX</text>';
                rejLine1 = '全額機械壓縮製冷 (無經濟盤管)';
                rejLine2 = '搭配濕式冷卻水塔散熱，全年 100% 壓縮機運轉';
            } else if (arch === 'dry_cooler_pure') {
                rejTitle = '乾冷器 (Dry Cooler)';
                rejSub = '純自然冷卻 (零冰機・WUE=0)';
                rejLine1 = '100% 自然風冷，全年零冰機';
                rejLine2 = `Approach: ${dcApproach}°C ｜ 無機械備援 (需高於門檻時降載)`;
            }

            const liqLoadKw = (cduSys.designBasis?.liq_load_kw || t.summ.liquidHeatKw || 0);
            const dtSec = Math.max(0.5, (cduSys.secReturnC || 57) - (cduSys.secSupplyC || 45));
            const dtPrim = Math.max(0.5, (cduSys.fwsReturnC || 55) - (cduSys.fwsSupplyC || 40));
            const flowSecLpm = Math.round((liqLoadKw * 14.33) / dtSec);
            const flowPrimLpm = Math.round((liqLoadKw * 14.33) / dtPrim);
            const cduUnitQty = (cduSys.sizing || []).find(s => s.key === 'cdu_unit')?.selectedQty || 3;
            const secSupplyC = cduSys.secSupplyC;
            const secReturnC = cduSys.secReturnC;

            const buildSingleLoopSchematic = (o) => {
                const boxTop = 70;
                const boxH = 175;
                const rowSupplyY = 110;
                const rowReturnY = 200;

                return `
                <!-- ======================================================= -->
                <!-- 1. 廠務熱回水總管 (From CDU ⇄ PHE) -->
                <!-- ======================================================= -->
                <line x1="320" y1="${rowSupplyY}" x2="510" y2="${rowSupplyY}" stroke="#ea580c" stroke-width="4.5" stroke-linecap="round" />
                
                <rect x="365" y="65" width="135" height="24" rx="5" fill="#881337" stroke="#f43f5e" stroke-width="1.5" />
                <text x="432" y="81" fill="#ffe4e6" font-size="10.5" font-weight="bold" text-anchor="middle">熱回水: ${cduSys.fwsReturnC}°C (FWS Return)</text>

                <!-- ======================================================= -->
                <!-- 2. 板式熱交換器 (PHE 單迴路換熱核心) -->
                <!-- ======================================================= -->
                <rect x="510" y="${boxTop}" width="200" height="${boxH}" rx="10" fill="#0f172a" stroke="${o.boxStroke}" stroke-width="2" />
                <rect x="510" y="${boxTop}" width="200" height="30" rx="10" fill="${o.boxHeaderFill}" />
                <text x="610" y="${boxTop + 20}" fill="#f1f5f9" font-size="12" font-weight="bold" text-anchor="middle">${o.boxTitle}</text>
                
                <!-- 換熱板片細節圖標 -->
                <rect x="525" y="${boxTop + 48}" width="26" height="100" rx="4" fill="#1e293b" stroke="${o.pheStroke}" stroke-width="1.2" />
                <path d="M 531 ${boxTop + 58} L 542 ${boxTop + 73} L 531 ${boxTop + 88} M 538 ${boxTop + 58} L 549 ${boxTop + 73} L 538 ${boxTop + 88} M 531 ${boxTop + 88} L 542 ${boxTop + 103} L 531 ${boxTop + 118} M 538 ${boxTop + 88} L 549 ${boxTop + 103} L 538 ${boxTop + 118} M 531 ${boxTop + 118} L 542 ${boxTop + 133} L 531 ${boxTop + 143}" stroke="${o.pheStroke}" stroke-width="1.5" fill="none" stroke-linecap="round" />
                
                <text x="630" y="${boxTop + 65}" fill="#f8fafc" font-size="12" font-weight="bold" text-anchor="middle">${o.label1}</text>
                <text x="630" y="${boxTop + 92}" fill="#a7f3d0" font-size="11" font-weight="bold" text-anchor="middle">${o.label2}</text>
                <text x="630" y="${boxTop + 118}" fill="#cbd5e1" font-size="10" text-anchor="middle">${o.label3}</text>
                <text x="630" y="${boxTop + 142}" fill="#94a3b8" font-size="9.5" text-anchor="middle">${o.label4}</text>

                <!-- ======================================================= -->
                <!-- 3. 室外側循環管路與水泵 -->
                <!-- ======================================================= -->
                <!-- 供水管至水泵 -->
                <line x1="710" y1="${rowSupplyY}" x2="745" y2="${rowSupplyY}" stroke="${o.loopColor}" stroke-width="4" stroke-linecap="round" />
                
                <!-- 循環水泵 -->
                <circle cx="760" cy="${rowSupplyY}" r="15" fill="${o.pumpFill}" stroke="${o.pumpStroke}" stroke-width="2" />
                <polygon points="755,${rowSupplyY - 6} 767,${rowSupplyY} 755,${rowSupplyY + 6}" fill="#ffffff" />
                <text x="760" y="${rowSupplyY + 28}" fill="${o.pumpStroke}" font-size="10" font-weight="bold" text-anchor="middle">${o.pumpLabel}</text>

                <!-- 水泵出水至室外設備 -->
                <line x1="775" y1="${rowSupplyY}" x2="820" y2="${rowSupplyY}" stroke="${o.loopColor}" stroke-width="4" stroke-linecap="round" />

                <!-- 室外設備回水管至 PHE -->
                <line x1="820" y1="${rowReturnY}" x2="710" y2="${rowReturnY}" stroke="${o.loopColor}" stroke-width="4" stroke-linecap="round" />

                <!-- ======================================================= -->
                <!-- 4. 室外排熱設備模組 -->
                <!-- ======================================================= -->
                <rect x="820" y="${boxTop}" width="315" height="${boxH}" rx="10" fill="${rejFill}" stroke="${rejStroke}" stroke-width="2" />
                <rect x="820" y="${boxTop}" width="315" height="30" rx="10" fill="#0f172a" />
                <text x="977" y="${boxTop + 20}" fill="#f8fafc" font-size="13" font-weight="bold" text-anchor="middle">${rejTitle}</text>
                
                <text x="840" y="${boxTop + 62}" fill="#f1f5f9" font-size="12" font-weight="bold">${rejLine1}</text>
                <text x="840" y="${boxTop + 88}" fill="#a7f3d0" font-size="11">${rejLine2}</text>
                <text x="840" y="${boxTop + 115}" fill="#cbd5e1" font-size="10.5">${o.outdoorLine3}</text>
                <text x="840" y="${boxTop + 140}" fill="#94a3b8" font-size="9.5">${o.outdoorLine4}</text>

                <!-- ======================================================= -->
                <!-- 5. 廠務冷供水總管 (PHE ⇄ Secondary Pump ⇄ CDU) -->
                <!-- ======================================================= -->
                <line x1="510" y1="${rowReturnY}" x2="445" y2="${rowReturnY}" stroke="#059669" stroke-width="4.5" stroke-linecap="round" />

                <!-- Secondary Pump (二次側設施主供水泵) -->
                <circle cx="430" cy="${rowReturnY}" r="15" fill="#065f46" stroke="#34d399" stroke-width="2" />
                <polygon points="436,${rowReturnY - 6} 424,${rowReturnY} 436,${rowReturnY + 6}" fill="#ffffff" />
                <text x="430" y="${rowReturnY + 28}" fill="#34d399" font-size="10" font-weight="bold" text-anchor="middle">Secondary Pump</text>

                <line x1="415" y1="${rowReturnY}" x2="320" y2="${rowReturnY}" stroke="#059669" stroke-width="4.5" stroke-linecap="round" />

                <rect x="365" y="${rowReturnY + 38}" width="135" height="24" rx="5" fill="#064e3b" stroke="#10b981" stroke-width="1.5" />
                <text x="432" y="${rowReturnY + 54}" fill="#d1fae5" font-size="10.5" font-weight="bold" text-anchor="middle">冷供水: ${cduSys.fwsSupplyC}°C (FWS Supply)</text>
            `; };

            let facilitySchematicSvg;
            if (arch === 'dry_cooler_pure') {
                facilitySchematicSvg = buildSingleLoopSchematic({
                    boxTitle: 'PHE-1 自然冷卻板換 (Economizer)',
                    boxHeaderFill: '#064e3b', boxStroke: '#10b981', pheStroke: '#34d399',
                    label1: '自然熱交換 (Free Cooling)',
                    label2: `全額直冷至 ${cduSys.fwsSupplyC}°C`,
                    label3: '100% 乾冷器自然冷卻',
                    label4: '無冰機・零壓縮機耗電',
                    pumpLabel: 'Condenser Pump', pumpFill: '#0369a1', pumpStroke: '#38bdf8',
                    loopColor: '#0d9488',
                    outdoorLine3: `設計乾球溫度門檻: ≤${mode1DbMax}°C`,
                    outdoorLine4: '高於門檻時依氣溫安全降載或調高供水水溫'
                });
            } else if (arch === 'adiabatic_tower') {
                const atSwitchpointDisp = (cduSys.adiabaticDrySwitchpointC !== undefined && cduSys.adiabaticDrySwitchpointC !== null && cduSys.adiabaticDrySwitchpointC !== '')
                    ? cduSys.adiabaticDrySwitchpointC
                    : Math.max(26.0, cduSys.fwsSupplyC - ((typeof A === 'function') ? A('adiabatic_switchpoint_offset_c') : 9.2)).toFixed(1);
                facilitySchematicSvg = buildSingleLoopSchematic({
                    boxTitle: 'PHE-1 絕熱預冷板換 (Adiabatic PHE)',
                    boxHeaderFill: '#0c4a6e', boxStroke: '#38bdf8', pheStroke: '#7dd3fc',
                    label1: '絕熱預冷自然散熱 (Adiabatic)',
                    label2: `噴霧輔助冷卻至 ${cduSys.fwsSupplyC}°C`,
                    label3: '蒸發預冷大幅降低進風溫',
                    label4: '高溫氣候仍維持 100% 自然排熱',
                    pumpLabel: 'Spray Pump', pumpFill: '#0369a1', pumpStroke: '#38bdf8',
                    loopColor: '#0284c7',
                    outdoorLine3: `噴霧飽和效率: ${cduSys.adiabaticSaturationEfficiencyPct||85}% ｜ 乾式切換點(估算): ≤${atSwitchpointDisp}°C`,
                    outdoorLine4: `氣溫 ≤${atSwitchpointDisp}°C 乾式 0 耗水，超過後啟動蒸發預冷`
                });
            } else if (arch === 'cooling_tower_hx') {
                facilitySchematicSvg = buildSingleLoopSchematic({
                    boxTitle: 'Closed Coil 密閉蒸發冷卻盤管',
                    boxHeaderFill: '#164e63', boxStroke: '#06b6d4', pheStroke: '#67e8f9',
                    label1: '密閉水側自然冷卻 (Closed Loop)',
                    label2: `濕球蒸發直冷至 ${cduSys.fwsSupplyC}°C`,
                    label3: '盤管隔離維持廠務一級水質',
                    label4: '全年濕球驅動零冰機排熱',
                    pumpLabel: 'Circulation Pump', pumpFill: '#0891b2', pumpStroke: '#06b6d4',
                    loopColor: '#0891b2',
                    outdoorLine3: '以室外濕球溫度 (Wet-Bulb) 為散熱基準',
                    outdoorLine4: '水側自然冷卻高效率運轉'
                });
            } else if (isFullMech) {
                facilitySchematicSvg = buildSingleLoopSchematic({
                    boxTitle: 'PHE-1 冰水製冷板換 (Chilled Water PHE)',
                    boxHeaderFill: '#312e81', boxStroke: '#818cf8', pheStroke: '#a5b4fc',
                    label1: '機械壓縮製冷 (Mechanical Cooling)',
                    label2: `連續穩定供應 ${cduSys.fwsSupplyC}°C 冰水`,
                    label3: '全額冷卻負載由壓縮機承擔',
                    label4: '無經濟盤管自然冷卻',
                    pumpLabel: 'Chilled Water Pump', pumpFill: '#3730a3', pumpStroke: '#818cf8',
                    loopColor: '#4f46e5',
                    outdoorLine3: '全天候 8,760h 機械壓縮連續運轉',
                    outdoorLine4: '搭配冷卻水塔進行主機冷凝熱排放'
                });
            }

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
                    ${isZeroChiller ? `
                    <div class="grid grid-cols-1 gap-2 my-2.5 text-xs">
                        <div class="p-2.5 rounded-lg bg-emerald-950/40 border border-emerald-800/60 flex items-center gap-2">
                            <span class="w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
                            <span class="text-emerald-300 font-bold text-sm">全時自然冷卻 (100% 零冰機・無壓縮機耗電)</span>
                            <span class="text-slate-300 ml-auto">廠務設施側由 ${rejTitle} 進行全時自然冷卻，直接產出 ${cduSys.fwsSupplyC}°C 供水</span>
                        </div>
                    </div>` : isFullMech ? `
                    <div class="grid grid-cols-1 gap-2 my-2.5 text-xs">
                        <div class="p-2.5 rounded-lg bg-indigo-950/40 border border-indigo-800/60 flex items-center gap-2">
                            <span class="w-2.5 h-2.5 rounded-full bg-indigo-400"></span>
                            <span class="text-indigo-300 font-bold text-sm">全時機械壓縮製冷 (Full Mechanical Chiller)</span>
                            <span class="text-slate-300 ml-auto">全年 8,760 小時由冰水主機壓縮製冷，提供恆定 ${cduSys.fwsSupplyC}°C 冰水</span>
                        </div>
                    </div>` : ''}

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
