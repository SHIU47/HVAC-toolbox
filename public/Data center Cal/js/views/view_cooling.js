/**
 * view_cooling.js - Step 4: Smart Accordion & Real Equipment Catalogs with RDHX (V27)
 * - Smart Accordion: Completed units (🟢) collapse by default, while incomplete/attention units (🔴/⚪) auto-expand
 * - Top Action Controls: [📂 全部展開] / [📁 全部收合] / [⚠️ 智慧聚焦 (僅展開需調整單元)]
 * - Full Device Catalog Wiring: Dynamic selection connected to device_catalog/ database via CatalogManager
 * - RDHX (Rear Door Heat Exchanger) architecture support in System 2
 * - Real-time N+1 checks and design margin calculations
 */
(function(window) {
    'use strict';

    let filterMode = 'all'; // 'all' | 'attention'
    const expandedUnitIds = {}; // targetId -> boolean

    const ViewCooling = {
        render(container) {
            const scrollPos = (typeof window !== 'undefined') ? (window.scrollY || document.documentElement.scrollTop || 0) : 0;
            const activeId = (typeof document !== 'undefined' && document.activeElement) ? document.activeElement.id : null;

            const state = window.AppStore.state;
            const halls = state.halls;
            const pods = state.corePods;

            const targets = [];
            halls.forEach(h => {
                h.dus.forEach(d => {
                    const summ = window.AppStore.calcDuSummary(d);
                    targets.push({ 
                        id: d.id, 
                        name: h.name + ' - ' + d.name, 
                        shortName: d.name,
                        hallName: h.name,
                        type: 'du', 
                        hallId: h.id, 
                        obj: d,
                        summ: summ
                    });
                });
            });
            pods.filter(p => p.enabled !== false).forEach(p => {
                const summ = window.AppStore.calcCorePodSummary(p);
                targets.push({ 
                    id: p.id, 
                    name: p.name + ' (CorePOD)', 
                    shortName: p.name,
                    hallName: 'CorePOD 模組',
                    type: 'pod', 
                    obj: p,
                    summ: summ
                });
            });

            if (targets.length === 0) {
                container.innerHTML = '<div class="p-8 text-center bg-white rounded-2xl border">無可配置的 DU 或 CorePOD</div>';
                return;
            }

            const proceedStatus = window.AppStore.canProceedStep4();

            // 1. 分析各單元狀態 (通過 / 需注意 / 未選型)
            let attentionCount = 0;
            targets.forEach(t => {
                const cduSys = t.obj.plantDesign.cduSystem;
                const fwSys = t.obj.plantDesign.fanwallSystem;
                const allSizing = [...(cduSys.sizing || []), ...(fwSys.sizing || [])];

                let hasZero = allSizing.some(s => s.selectedQty === 0);
                let hasFail = allSizing.some(s => !s.passed && s.selectedQty > 0);
                let allPass = allSizing.length > 0 && allSizing.every(s => s.passed);

                if (allPass) {
                    t.status = 'pass';
                    t.statusBadge = '<span class="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-black rounded-md border border-emerald-200">🟢 滿足 N+1</span>';
                } else if (hasFail) {
                    t.status = 'fail';
                    t.statusBadge = '<span class="px-2 py-0.5 bg-red-100 text-red-800 text-[10px] font-black rounded-md border border-red-200">🔴 容量不足</span>';
                    attentionCount++;
                } else {
                    t.status = 'incomplete';
                    t.statusBadge = '<span class="px-2 py-0.5 bg-slate-100 text-slate-600 text-[10px] font-black rounded-md border border-slate-300">⚪ 尚未選型</span>';
                    attentionCount++;
                }

                // 智慧收合預設: 綠燈收合，紅/灰燈自動展開
                if (expandedUnitIds[t.id] === undefined) {
                    expandedUnitIds[t.id] = (t.status !== 'pass');
                }
            });

            const displayTargets = filterMode === 'attention' ? targets.filter(t => t.status !== 'pass') : targets;

            // 2. 頂部全廠冷卻總覽條 (Plant Overview Bar)
            let overviewPillsHtml = '';
            targets.forEach(t => {
                const cduArch = t.obj.plantDesign.cduSystem.architecture || 'dry_cooler_hx';
                const fwArch = t.obj.plantDesign.fanwallSystem.architecture || 'air_cooled_chiller';
                const cduArchText = cduArch === 'dry_cooler_hx' ? '乾冷器' : (cduArch === 'adiabatic_tower' ? '絕熱塔' : (cduArch === 'cooling_tower_hx' ? '濕水塔' : '水冰機'));
                const fwArchText = fwArch === 'rdhx' ? 'RDHX 背板' : (fwArch === 'air_cooled_chiller' ? '氣冷冰機' : (fwArch === 'water_cooled_chiller' ? '水冷冰機' : '廠區冰水'));

                let cardBorder = t.status === 'pass' ? 'border-emerald-300 bg-emerald-50/40 hover:bg-emerald-50' : (t.status === 'fail' ? 'border-red-300 bg-red-50/60 hover:bg-red-50' : 'border-slate-300 bg-slate-50 hover:bg-slate-100');
                const safeName = window.UIKit ? window.UIKit.escapeHTML(t.name) : t.name;

                overviewPillsHtml += `
                    <div onclick="ViewCooling.scrollToUnit('${t.id}')" class="cursor-pointer p-3 rounded-xl border ${cardBorder} shadow-2xs transition flex flex-col justify-between">
                        <div class="flex items-center justify-between gap-1">
                            <span class="font-bold text-xs text-slate-900 truncate">${safeName}</span>
                            ${t.statusBadge}
                        </div>
                        <div class="text-[11px] text-slate-500 mt-1 flex justify-between">
                            <span>IT: <strong>${t.summ.totalItKw.toFixed(0)} kW</strong> (DLC ${t.summ.dlcPct.toFixed(0)}%)</span>
                        </div>
                        <div class="text-[10px] text-slate-400 mt-1 flex items-center justify-between border-t border-slate-200/60 pt-1">
                            <span class="truncate inline-flex items-center gap-1"><i data-lucide="droplets" class="w-3 h-3 text-purple-500 shrink-0"></i>${cduArchText}<span class="text-slate-300">|</span><i data-lucide="wind" class="w-3 h-3 text-indigo-500 shrink-0"></i>${fwArchText}</span>
                            <span class="text-purple-700 font-bold ml-1">${expandedUnitIds[t.id] ? '捲動 ↓' : '展開 ↓'}</span>
                        </div>
                    </div>
                `;
            });

            // 3. 逐單元智慧折疊卡片列表
            let unitsListHtml = '';
            displayTargets.forEach(t => {
                const isExpanded = expandedUnitIds[t.id];
                if (isExpanded) {
                    unitsListHtml += this.renderExpandedUnitCard(t);
                } else {
                    unitsListHtml += this.renderCollapsedUnitCard(t);
                }
            });

            if (displayTargets.length === 0 && filterMode === 'attention') {
                unitsListHtml = `
                    <div class="p-12 text-center bg-white rounded-2xl border border-emerald-300 shadow-sm space-y-2">
                        <div class="text-4xl">🎉</div>
                        <div class="text-base font-black text-emerald-800">所有單元冷卻設備選型皆已滿足 N+1 規範！</div>
                        <div class="text-xs text-slate-500">無任何需注意或未完成之單元。</div>
                    </div>
                `;
            }

            // 防呆警示列
            let proceedAlert = '';
            if (!proceedStatus.ok) {
                let errList = '';
                proceedStatus.failedItems.forEach(fi => {
                    const safeTargetName = window.UIKit ? window.UIKit.escapeHTML(fi.targetName) : fi.targetName;
                    const safeSysName = window.UIKit ? window.UIKit.escapeHTML(fi.systemName) : fi.systemName;
                    const safeEquipName = window.UIKit ? window.UIKit.escapeHTML(fi.equipName) : fi.equipName;
                    errList += `<li><strong>[${safeTargetName}]</strong> ${safeSysName} - ${safeEquipName}：${fi.reqText}（目前僅選 ${fi.selText}） <a href="#unit_${fi.targetId}" onclick="ViewCooling.scrollToUnit('${fi.targetId}')" class="text-red-700 underline font-bold ml-1">前往調整</a></li>`;
                });

                proceedAlert = `
                    <div class="p-4 bg-red-50 border-2 border-red-400 rounded-2xl space-y-2 text-xs">
                        <div class="flex items-center gap-2 font-black text-red-900 text-sm">
                            <span>⚠️</span> 尚有 ${proceedStatus.failedItems.length} 項設備容量未達 N+1 規範，系統已鎖定無法前往 Step 5：
                        </div>
                        <ul class="list-disc list-inside text-red-800 space-y-1 pl-1 font-medium">
                            ${errList}
                        </ul>
                        <div class="pt-1 text-[11px] text-red-600">
                            💡 系統已自動為您展開需調整之單元，請增加配置使所有檢核燈號全數轉為綠色即可解鎖。
                        </div>
                    </div>
                `;
            }

            container.innerHTML = `
                <div class="space-y-6">
                    <!-- 頂部: 標題與智慧收合控制 -->
                    <div class="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                        <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div>
                                <h2 class="text-xl font-bold text-slate-900 flex items-center gap-2">
                                    <span>❄️</span> Step 4: 雙冷卻工程選型設計 (智慧收合 & 設備目錄接線)
                                </h2>
                                <p class="text-sm text-slate-500 mt-1">
                                    已完成單元智慧收折，未完成單元自動展開。支援 <strong>4 款 CDU 架構</strong>、<strong>4 款氣冷架構 (含 RDHX 背板)</strong> 與真實設備型錄庫。
                                </p>
                            </div>
                            <div class="flex items-center gap-2 bg-slate-100 p-1.5 rounded-xl border border-slate-200 flex-wrap">
                                <button onclick="ViewCooling.smartAccordion()" class="px-3 py-1.5 text-xs font-bold rounded-lg transition bg-white text-slate-900 shadow-2xs hover:bg-slate-50">
                                    💡 智慧聚焦
                                </button>
                                <button onclick="ViewCooling.expandAll()" class="px-2.5 py-1.5 text-xs font-bold rounded-lg transition text-slate-700 hover:bg-white hover:text-slate-900">
                                    📂 全部展開
                                </button>
                                <button onclick="ViewCooling.collapseAll()" class="px-2.5 py-1.5 text-xs font-bold rounded-lg transition text-slate-700 hover:bg-white hover:text-slate-900">
                                    📁 全部收合
                                </button>
                                <button onclick="ViewCooling.toggleFilterAttention()" class="px-3 py-1.5 text-xs font-bold rounded-lg transition ${filterMode==='attention' ? 'bg-red-600 text-white' : 'text-red-700 hover:bg-red-50'}">
                                    ⚠️ 僅看需調整 (${attentionCount})
                                </button>
                            </div>
                        </div>
                    </div>

                    <!-- 全廠冷卻配置狀態導覽條 (Plant Overview Bar) -->
                    <div class="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 space-y-3">
                        <div class="flex justify-between items-center text-xs font-bold text-slate-600 border-b pb-2">
                            <span>全廠冷卻單元即時狀態總覽 (點擊可快速展開並定位至該單元)</span>
                            <span class="text-slate-400 font-normal">已完成: ${targets.length - attentionCount} / ${targets.length}</span>
                        </div>
                        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                            ${overviewPillsHtml}
                        </div>
                    </div>

                    <!-- 逐單元智慧折疊列表 -->
                    <div class="space-y-6">
                        ${unitsListHtml}
                    </div>

                    <!-- 卡關防呆警示列 -->
                    ${proceedAlert}

                    <div class="flex justify-between pt-2">
                        <button onclick="window.App.prevStep()" class="px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm rounded-xl transition">
                            <span>←</span> 上一步: CorePOD 設計
                        </button>
                        
                        <button ${proceedStatus.ok ? 'onclick="window.App.nextStep()"' : 'disabled'} 
                            class="px-6 py-3 ${proceedStatus.ok ? 'bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer shadow-md' : 'bg-slate-300 text-slate-500 cursor-not-allowed'} font-black text-sm rounded-xl transition flex items-center gap-2">
                            ${proceedStatus.ok ? '計算並檢視 8,760h PUE / WUE 成果儀表板 📊' : '⚠️ 設備選型未達 N+1 (已鎖定)'}
                        </button>
                    </div>
                </div>
            `;

            if (typeof window !== 'undefined' && scrollPos > 0) {
                window.scrollTo({ top: scrollPos, behavior: 'instant' });
            }
            if (activeId) {
                const el = document.getElementById(activeId);
                if (el) {
                    el.focus();
                }
            }
            if (window.UIKit) window.UIKit.refreshIcons(container);
        },

        // 收合狀態卡片 (Collapsed Card)
        renderCollapsedUnitCard(t) {
            const targetId = t.id;
            const cduSys = t.obj.plantDesign.cduSystem;
            const fwSys = t.obj.plantDesign.fanwallSystem;
            const cduArch = cduSys.architecture || 'dry_cooler_trim';
            const fwArch = fwSys.architecture || 'air_cooled_chiller';
            const cduArchLabel = (cduArch === 'dry_cooler_trim' || cduArch === 'dry_cooler_hx') ? '乾冷器 + Trim 冰機 (NVIDIA DSX)' : (cduArch === 'dry_cooler_pure' ? '純乾冷器 (零冰機)' : (cduArch === 'adiabatic_tower' ? '絕熱冷卻塔 (零冰機)' : (cduArch === 'cooling_tower_hx' ? '密閉式冷卻水塔 (零冰機)' : '全額水冷式冰機')));
            const fwArchLabel = fwArch === 'rdhx' ? 'RDHX 背板' : (fwArch === 'air_cooled_chiller' ? '氣冷式冰機' : (fwArch === 'water_cooled_chiller' ? '水冷式冰機' : '廠區集中冰水'));

            const safeName = window.UIKit ? window.UIKit.escapeHTML(t.name) : t.name;
            return `
                <div id="unit_${targetId}" class="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-emerald-300 transition">
                    <div class="flex items-center gap-3">
                        <span class="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-200 shadow-2xs"><i data-lucide="building-2" class="w-4.5 h-4.5"></i></span>
                        <div>
                            <div class="flex items-center gap-2">
                                <h3 class="text-base font-black text-slate-900">${safeName}</h3>
                                ${t.statusBadge}
                            </div>
                            <div class="text-xs text-slate-500 mt-0.5">
                                IT: <strong>${t.summ.totalItKw.toFixed(0)} kW</strong> (DLC ${t.summ.dlcPct.toFixed(0)}%) &middot;
                                液冷: <strong class="text-purple-900">${cduArchLabel}</strong> &middot;
                                氣冷: <strong class="text-indigo-900">${fwArchLabel}</strong>
                            </div>
                        </div>
                    </div>
                    <div class="flex items-center gap-2">
                        <button onclick="ViewCooling.toggleExpand('${targetId}')" class="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition flex items-center gap-1 shadow-2xs">
                            <span>展開詳細選型 ▾</span>
                        </button>
                    </div>
                </div>
            `;
        },

        // 展開狀態卡片 (Expanded Card)
        renderExpandedUnitCard(t) {
            const targetId = t.id;
            const cduSys = t.obj.plantDesign.cduSystem;
            const fwSys = t.obj.plantDesign.fanwallSystem;
            const arch = cduSys.architecture || 'dry_cooler_hx';

            cduSys.secSupplyC = cduSys.secSupplyC || 45.0;
            cduSys.secReturnC = cduSys.secReturnC || 57.0;
            cduSys.cduApproachC = cduSys.cduApproachC || 3.0;

            const cduApproach = cduSys.dryCoolerApproachC || 5.0;
            const pheApproach = (arch === 'dry_cooler_trim' || arch === 'dry_cooler_hx') ? (cduSys.pheApproachC ?? 2.0) : 0.0;
            const cduFcThresh = (cduSys.fwsSupplyC - cduApproach - pheApproach).toFixed(1);
            const mode1DbMax = parseFloat(cduFcThresh);
            const mode2DbMax = (mode1DbMax + 5.7).toFixed(1);

            // CDU 設備選型表格
            let cduSizingHtml = '';
            (cduSys.sizing || []).forEach(item => {
                let modelOptions = '';
                item.catalog.forEach(cat => {
                    const vendorPrefix = cat.vendor ? '[' + cat.vendor + '] ' : '';
                    modelOptions += '<option value="' + cat.model + '" ' + (cat.model === item.selectedModel ? 'selected' : '') + '>' + vendorPrefix + cat.model + ' (' + cat.capKw + ' kW)</option>';
                });

                const effCap = item.effectiveCapKw !== undefined ? item.effectiveCapKw : (item.selectedQty * item.unitCapKw);
                const isTrimChiller = item.key === 'trim_chiller';
                const marginPct = (item.requiredKw > 0) ? (((effCap / item.requiredKw) - 1) * 100) : 0;
                let marginBadge = '';
                if (marginPct < 0) {
                    marginBadge = `<span class="px-2 py-0.5 bg-red-100 text-red-700 text-[10px] font-black rounded-md border border-red-200">餘度: ${marginPct.toFixed(1)}%</span>`;
                } else if (marginPct < 10) {
                    marginBadge = `<span class="px-2 py-0.5 bg-amber-100 text-amber-800 text-[10px] font-black rounded-md border border-amber-200">餘度: +${marginPct.toFixed(1)}%</span>`;
                } else {
                    marginBadge = `<span class="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-black rounded-md border border-emerald-200">餘度: +${marginPct.toFixed(1)}%</span>`;
                }

                let badge = '';
                if (item.selectedQty === 0) {
                    badge = '<span class="px-2 py-0.5 bg-slate-100 text-slate-500 text-[10px] font-black rounded-md flex items-center gap-1 border border-slate-300">⚪ 尚未選型</span>';
                } else if (item.passed) {
                    badge = '<span class="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-black rounded-md flex items-center gap-1 border border-emerald-200">🟢 滿足 N+1</span>';
                } else {
                    badge = '<span class="px-2 py-0.5 bg-red-100 text-red-800 text-[10px] font-black rounded-md flex items-center gap-1 border border-red-200">🔴 容量不足</span>';
                }

                cduSizingHtml += `
                    <div class="p-3 bg-slate-50 rounded-xl border ${item.passed ? 'border-slate-200' : 'border-red-300 bg-red-50/40'} space-y-2 text-xs">
                        <div class="flex justify-between items-center">
                            <div>
                                <span class="font-bold text-slate-900 text-sm">${item.label}</span>
                                <div class="text-xs text-slate-500 mt-1">系統需求: <strong class="text-slate-900 font-bold bg-white px-1.5 py-0.5 rounded border border-slate-200">${item.requiredText}</strong></div>
                            </div>
                            <div class="flex items-center gap-1.5">
                                ${marginBadge}
                                ${badge}
                            </div>
                        </div>
                        <div class="grid grid-cols-3 gap-2 pt-1">
                            <div class="col-span-2">
                                <label class="block text-[9px] text-slate-400 font-bold mb-0.5">自選型號 (真實設備型錄庫)</label>
                                <select onchange="ViewCooling.changeModel('${targetId}', 'cdu', '${item.key}', this.value)" class="w-full text-xs font-bold border rounded-lg p-1.5 bg-white text-slate-800">
                                    ${modelOptions}
                                </select>
                            </div>
                            <div>
                                <label class="block text-[9px] text-slate-400 font-bold mb-0.5">選定台數 (含備用)</label>
                                <input type="number" min="1" max="50" id="qty_cdu_${targetId}_${item.key}" value="${item.selectedQty}" onchange="ViewCooling.changeQty('${targetId}', 'cdu', '${item.key}', this.value)" class="w-full text-xs font-black border rounded-lg p-1.5 bg-white text-purple-950 text-center">
                            </div>
                        </div>
                        <div class="text-[10px] flex justify-between text-slate-400 pt-0.5 border-t border-slate-200">
                            <span>總容量: ${(item.selectedQty * item.unitCapKw).toFixed(1)} kW</span>
                            <span>有效容量 (N-1): <strong class="${item.passed ? 'text-emerald-700 font-bold' : 'text-red-600 font-bold'}">${effCap.toFixed(1)} kW</strong></span>
                        </div>
                        ${isTrimChiller && item.maxMechanicalKw !== undefined ? `
                        <div class="text-[10px] flex justify-between items-center pt-1.5 mt-1 border-t border-dashed border-slate-300">
                            <span class="text-slate-500">⚠ 若進入 Mode 3 全機械製冷，最大需求 <strong class="text-slate-700">${item.maxMechanicalKw.toFixed(0)} kW</strong></span>
                            <span class="${item.maxMechanicalPassed ? 'text-emerald-700' : 'text-red-600'} font-bold">${item.maxMechanicalPassed ? '✓ N+1可用容量足夠' : '✗ N+1可用容量不足！'}</span>
                        </div>
                        <div class="text-[9px] text-slate-400">上方「滿足N+1」只代表通過 ${((item.peakRatio ?? 0.35) * 100).toFixed(0)}% 典型修整負載，實際是否會發生全機械超載請以 Dashboard 的容量缺口小時數為準</div>
                        ` : ''}
                    </div>
                `;
            });


            // =========================================================================
            // 系統 2: Fanwall / RDHX 氣冷系統 P&ID 拓樸圖生成
            // =========================================================================
            const airLoadKw = (fwSys.designBasis?.air_load_kw || (t.summ.airHeatKw + t.summ.lossKw) || 0);
            const chwSupplyC = fwSys.chwSupplyC || 12.0;
            const chwReturnC = fwSys.chwReturnC || 18.0;
            const dtChw = Math.max(1.0, chwReturnC - chwSupplyC);
            const flowChwLpm = Math.round((airLoadKw * 60) / (4.184 * dtChw));
            const fwArch = fwSys.architecture || 'air_cooled_chiller';
            const isRdhx = fwArch === 'rdhx';

            const fwUnitItem = (fwSys.sizing || []).find(s => s.key === (isRdhx ? 'rdhx_unit' : 'crah_unit'));
            const fwUnitQty = fwUnitItem ? fwUnitItem.selectedQty : 4;
            const fwUnitModel = fwUnitItem ? fwUnitItem.selectedModel : (isRdhx ? 'Envicool RDHX 45kW Door' : 'Vertiv Liebert 100kW CRAH');

            let fwRejTitle = '氣冷式冰水主機 (Air-Cooled Chiller)';
            let fwRejFill = '#1e1b4b';
            let fwRejStroke = '#6366f1';
            let fwPlantSvg = '';

            if (fwArch === 'air_cooled_chiller') {
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
            } else if (fwArch === 'water_cooled_chiller') {
                fwRejTitle = '水冷式冰水主機 + 濕式冷卻塔';
                fwPlantSvg = `
                    <!-- 水冷式冰機主機 -->
                    <rect x="510" y="70" width="200" height="175" rx="10" fill="#0f172a" stroke="#3b82f6" stroke-width="2" />
                    <rect x="510" y="70" width="200" height="30" rx="10" fill="#1e3a8a" />
                    <text x="610" y="90" fill="#dbeafe" font-size="12" font-weight="bold" text-anchor="middle">水冷式冰機 (Centrifugal/Screw)</text>
                    
                    <rect x="525" y="118" width="26" height="100" rx="4" fill="#1e293b" stroke="#60a5fa" stroke-width="1.2" />
                    <path d="M 531 128 L 542 143 L 531 158 M 538 128 L 549 143 L 538 158 M 531 158 L 542 173 L 531 188" stroke="#93c5fd" stroke-width="1.5" fill="none" stroke-linecap="round" />
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
            } else if (fwArch === 'chilled_water_plant') {
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

            const fwTopoDiagram = `
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

            // Fanwall / RDHX 設備選型表格
            let fwSizingHtml = '';
            (fwSys.sizing || []).forEach(item => {
                let modelOptions = '';
                item.catalog.forEach(cat => {
                    const vendorPrefix = cat.vendor ? '[' + cat.vendor + '] ' : '';
                    modelOptions += '<option value="' + cat.model + '" ' + (cat.model === item.selectedModel ? 'selected' : '') + '>' + vendorPrefix + cat.model + ' (' + cat.capKw + ' kW)</option>';
                });

                const effCap = item.effectiveCapKw !== undefined ? item.effectiveCapKw : (item.selectedQty * item.unitCapKw);
                const marginPct = (item.requiredKw > 0) ? (((effCap / item.requiredKw) - 1) * 100) : 0;
                let marginBadge = '';
                if (marginPct < 0) {
                    marginBadge = `<span class="px-2 py-0.5 bg-red-100 text-red-700 text-[10px] font-black rounded-md border border-red-200">餘度: ${marginPct.toFixed(1)}%</span>`;
                } else if (marginPct < 10) {
                    marginBadge = `<span class="px-2 py-0.5 bg-amber-100 text-amber-800 text-[10px] font-black rounded-md border border-amber-200">餘度: +${marginPct.toFixed(1)}%</span>`;
                } else {
                    marginBadge = `<span class="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-black rounded-md border border-emerald-200">餘度: +${marginPct.toFixed(1)}%</span>`;
                }

                let badge = '';
                if (item.selectedQty === 0) {
                    badge = '<span class="px-2 py-0.5 bg-slate-100 text-slate-500 text-[10px] font-black rounded-md flex items-center gap-1 border border-slate-300">⚪ 尚未選型</span>';
                } else if (item.passed) {
                    badge = '<span class="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-black rounded-md flex items-center gap-1 border border-emerald-200">🟢 滿足 N+1</span>';
                } else {
                    badge = '<span class="px-2 py-0.5 bg-red-100 text-red-800 text-[10px] font-black rounded-md flex items-center gap-1 border border-red-200">🔴 容量不足</span>';
                }

                fwSizingHtml += `
                    <div class="p-3 bg-slate-50 rounded-xl border ${item.passed ? 'border-slate-200' : 'border-red-300 bg-red-50/40'} space-y-2 text-xs">
                        <div class="flex justify-between items-center">
                            <div>
                                <span class="font-bold text-slate-900 text-sm">${item.label}</span>
                                <div class="text-xs text-slate-500 mt-1">系統需求: <strong class="text-slate-900 font-bold bg-white px-1.5 py-0.5 rounded border border-slate-200">${item.requiredText}</strong></div>
                            </div>
                            <div class="flex items-center gap-1.5">
                                ${marginBadge}
                                ${badge}
                            </div>
                        </div>
                        <div class="grid grid-cols-3 gap-2 pt-1">
                            <div class="col-span-2">
                                <label class="block text-[9px] text-slate-400 font-bold mb-0.5">自選型號 (真實設備型錄庫)</label>
                                <select onchange="ViewCooling.changeModel('${targetId}', 'fanwall', '${item.key}', this.value)" class="w-full text-xs font-bold border rounded-lg p-1.5 bg-white text-slate-800">
                                    ${modelOptions}
                                </select>
                            </div>


                            <div>
                                <label class="block text-[9px] text-slate-400 font-bold mb-0.5">選定台數 (含備用)</label>
                                <input type="number" min="1" max="50" id="qty_fw_${targetId}_${item.key}" value="${item.selectedQty}" onchange="ViewCooling.changeQty('${targetId}', 'fanwall', '${item.key}', this.value)" class="w-full text-xs font-black border rounded-lg p-1.5 bg-white text-indigo-950 text-center">
                            </div>
                        </div>
                        <div class="text-[10px] flex justify-between text-slate-400 pt-0.5 border-t border-slate-200">
                            <span>總容量: ${(item.selectedQty * item.unitCapKw).toFixed(1)} kW</span>
                            <span>有效容量 (N-1): <strong class="${item.passed ? 'text-emerald-700 font-bold' : 'text-red-600 font-bold'}">${effCap.toFixed(1)} kW</strong></span>
                        </div>
                    </div>
                `;
            });

            // SVG 拓樸圖 — 工業級 P&ID 一二次側物理分離雙閉環拓樸
            // v38: 絕熱冷卻塔 (Adiabatic) 與 密閉式冷卻水塔 (Closed-Circuit CT) 均為 100% 零冰機自然冷卻架構
            const isZeroChiller = (arch === 'dry_cooler_pure' || arch === 'adiabatic_tower' || arch === 'cooling_tower_hx');
            const isFullMech = arch === 'water_chiller';
            let rejTitle = '乾冷器 (Dry Cooler)';
            let rejSub = '零耗水・自然風冷 (WUE=0)';
            let rejFill = '#042f2e';
            let rejStroke = '#14b8a6';
            let rejIconSvg = '<circle cx="710" cy="62" r="12" fill="#0f766e" stroke="#2dd4bf" stroke-width="1" /><path d="M 710 53 L 710 71 M 701 62 L 719 62" stroke="#ccfbf1" stroke-width="1.5" />';
            let rejLine1 = '零耗水自然風冷';
            let rejLine2 = `Approach: ${cduApproach}°C ｜ 門檻: ≤${cduFcThresh}°C DB`;

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
                rejLine2 = `Approach: ${cduApproach}°C ｜ 無機械備援 (需高於門檻時降載)`;
            }

            const liqLoadKw = (cduSys.designBasis?.liq_load_kw || t.summ.liquidHeatKw || 0);
            const dtSec = Math.max(0.5, (cduSys.secReturnC || 57) - (cduSys.secSupplyC || 45));
            const dtPrim = Math.max(0.5, (cduSys.fwsReturnC || 55) - (cduSys.fwsSupplyC || 40));
            const flowSecLpm = Math.round((liqLoadKw * 14.33) / dtSec);
            const flowPrimLpm = Math.round((liqLoadKw * 14.33) / dtPrim);
            const cduUnitQty = (cduSys.sizing || []).find(s => s.key === 'cdu_unit')?.selectedQty || 3;
            const trimChillerItem = (cduSys.sizing || []).find(s => s.key === 'trim_chiller');
            const trimChillerModel = trimChillerItem?.selectedModel || 'Carrier 30XW-500kW (COP 5.8)';

            // 專業廠務工程 P&ID 拓樸架構 — 確切單點物理設計水溫
            const precoolTemp = Number((cduSys.fwsSupplyC + (cduSys.fwsReturnC - cduSys.fwsSupplyC) * 0.4).toFixed(1));
            const dcWaterSupplyExact = (cduSys.fwsSupplyC - pheApproach).toFixed(1); // 乾冷器供水設計溫 (如 35.0°C)
            const condWaterEnterExact = (cduSys.fwsReturnC - pheApproach).toFixed(1); // 預冷後進冷凝器設計溫 (如 45.0°C)
            const condWaterLeaveExact = (cduSys.fwsReturnC - pheApproach + 4.8).toFixed(1); // 冷凝排熱總回水設計溫 (如 49.8°C)
            const chwSupplyTemp = Math.min(30, cduSys.fwsSupplyC - 7); // 冰機供水設計溫 (如 30.0°C)
            const chwReturnTempExact = (chwSupplyTemp + 5.0).toFixed(1); // 冰機回水設計溫 (如 35.0°C)

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
                // v46 fix: 乾式切換點原本是寫死的「≤31°C」，跟實際依供水溫算出來的門檻(通常
                // 不是31°C)完全對不上。改成即時算出來的值，並標示這是估算值(來源見上方
                // 專屬參數面板的說明)，若使用者已手動輸入實測值就顯示那個。
                const atSwitchpointDisp = (cduSys.adiabaticDrySwitchpointC !== undefined && cduSys.adiabaticDrySwitchpointC !== null && cduSys.adiabaticDrySwitchpointC !== '')
                    ? cduSys.adiabaticDrySwitchpointC
                    : Math.max(26.0, cduSys.fwsSupplyC - 9.2).toFixed(1);
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
            } else {
                // =========================================================================
                // 雙迴路混合架構 (dry_cooler_trim 專屬: NVIDIA DSX 官方標準 Trim/Hybrid Cooling)
                // 100% 精準還原 NVIDIA 官方串聯拓樸路徑：
                // 1. 廠務設施側 (Primary FWS Loop):
                //    CDU 熱回水 (≤51°C) → Primary HX (預冷至 >43.5°C) → Secondary HX (修整至 ≤41°C) → CDU 冷供水
                // 2. 修整冰水側 (Trim Chiller Evaporator Loop):
                //    Water Cooled Chiller 產出 30°C 冰水 → Secondary HX (吸收修整熱升溫至 32.5~40°C) → 回冰機蒸發器
                // 3. 室外排熱串聯側 (Dry Cooler & Condenser Series Loop):
                //    Dry Cooler 供水 (>39.8~45.5°C) → Primary HX (吸收預冷熱升溫至 <53°C) → 進入 Chiller 冷凝器 (吸收主機冷凝熱升溫至 <55.8°C) → 回 Dry Cooler 自然風冷
                // =========================================================================
                facilitySchematicSvg = `
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
                <text x="1075" y="142" fill="#a7f3d0" font-size="10">Approach: ${cduApproach}°C ｜ 門檻: ≤${cduFcThresh}°C</text>
                <text x="1075" y="162" fill="#cbd5e1" font-size="9.5">Mode 1: 滿載自然風冷</text>
                <text x="1075" y="178" fill="#cbd5e1" font-size="9.5">Mode 2: 串聯預冷與主機冷凝排熱</text>

                <!-- 底部排熱箭頭 -->
                <polygon points="1110,230 1120,230 1115,240" fill="#ef4444" />
                <polygon points="1160,230 1170,230 1165,240" fill="#ef4444" />
                <polygon points="1210,230 1220,230 1215,240" fill="#ef4444" />
                `;
            }
            const cduTopoDiagram = `
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
                    </div>` : `
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
                    </div>`}

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

                            <text x="85" y="160" fill="#38bdf8" font-size="10.5" font-weight="bold" text-anchor="middle">晶片水溫: ${cduSys.secSupplyC} ⇄ ${cduSys.secReturnC}°C</text>
                            <text x="85" y="185" fill="#a5b4fc" font-size="10" text-anchor="middle">二次側流量: ${flowSecLpm.toLocaleString()} LPM</text>
                            <text x="85" y="208" fill="#94a3b8" font-size="9" text-anchor="middle">ΔT = ${dtSec}°C (晶片溫升)</text>

                            <!-- ======================================================= -->
                            <!-- 2. SECONDARY TCS PIPING (機櫃 ⇄ CDU 二次側水路) -->
                            <!-- ======================================================= -->
                            <!-- Hot Secondary Return: ≤56°C -->
                            <line x1="150" y1="95" x2="190" y2="95" stroke="#f43f5e" stroke-width="4" stroke-linecap="round" />
                            <rect x="150" y="68" width="40" height="18" rx="3" fill="#881337" />
                            <text x="170" y="81" fill="#ffe4e6" font-size="8" font-weight="bold" text-anchor="middle">≤${cduSys.secReturnC}°C</text>

                            <!-- Cold Secondary Supply: ≤45°C -->
                            <line x1="190" y1="245" x2="150" y2="245" stroke="#0284c7" stroke-width="4" stroke-linecap="round" />
                            <rect x="150" y="218" width="40" height="18" rx="3" fill="#0c4a6e" />
                            <text x="170" y="231" fill="#e0f2fe" font-size="8" font-weight="bold" text-anchor="middle">≤${cduSys.secSupplyC}°C</text>

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
                            <text x="255" y="124" fill="#f5d0fe" font-size="9" font-weight="bold" text-anchor="middle">Approach ${cduSys.cduApproachC}°C</text>

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

            const safeName = window.UIKit ? window.UIKit.escapeHTML(t.name) : t.name;
            return `
                <div id="unit_${targetId}" class="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden space-y-6 p-6">
                    <!-- 單元標題列 -->
                    <div class="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-200 gap-2">
                        <div class="flex items-center gap-3">
                            <span class="w-8 h-8 rounded-xl bg-purple-100 text-purple-800 flex items-center justify-center shadow-2xs"><i data-lucide="building-2" class="w-4 h-4"></i></span>
                            <div>
                                <h3 class="text-base font-black text-slate-900">${safeName}</h3>
                                <div class="text-xs text-slate-500">IT 容量: <strong>${t.summ.totalItKw.toFixed(1)} kW</strong> &middot; 液冷散熱量: <strong class="text-purple-700">${t.summ.liquidHeatKw.toFixed(1)} kW (${t.summ.dlcPct.toFixed(1)}%)</strong> &middot; 氣冷廢熱: <strong class="text-indigo-700">${t.summ.airHeatKw.toFixed(1)} kW</strong></div>
                            </div>
                        </div>
                        <div class="flex items-center gap-2">
                            ${t.statusBadge}
                            <button onclick="ViewCooling.toggleExpand('${targetId}')" class="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold rounded-lg transition">
                                <span>收合 ▴</span>
                            </button>
                        </div>
                    </div>

                    <!-- 雙系統獨立面板 (改為上下堆疊佈局，拓樸圖獲得 100% 全寬伸展，不再受左右擠壓) -->
                    <div class="space-y-6">
                        <!-- ========================================== -->
                        <!-- 系統 1: CDU 液冷排熱系統 (白區液冷 - 上層全寬) -->
                        <!-- ========================================== -->
                        <div class="bg-slate-50/70 p-5 rounded-2xl border border-purple-200 space-y-4">
                            <div class="flex flex-col sm:flex-row sm:items-center justify-between border-b border-purple-100 pb-3 gap-2">
                                <div>
                                    <h4 class="text-sm font-black text-purple-950 flex items-center gap-1.5">
                                        <i data-lucide="droplets" class="w-4 h-4 text-purple-600"></i> 系統 1: CDU 液冷排熱系統 (白區液冷)
                                    </h4>
                                    <div class="text-[11px] text-slate-500">專門處理晶片高溫液冷散熱 (一二次側水路物理完全隔離)</div>
                                </div>
                                <div class="flex items-center gap-2">
                                    <span class="px-2.5 py-1 bg-purple-100 text-purple-900 text-xs font-black rounded-lg border border-purple-200">
                                        ${(cduSys.designBasis.liq_load_kw||0).toFixed(1)} kW 液冷負載
                                    </span>
                                </div>
                            </div>

                            <!-- 純乾冷器氣候不可行警示橫幅 (當案場夏季氣溫超出 FC 門檻時自動警示) -->
                            ${arch === 'dry_cooler_pure' && parseFloat(cduFcThresh) < 36.0 ? `
                            <div class="p-4 bg-amber-500/10 border-2 border-amber-500 rounded-xl space-y-2 text-xs">
                                <div class="flex items-center gap-2 font-black text-amber-900 text-sm">
                                    <span>⚠️</span> 氣候超溫與無冰機備援警示 (Pure Dry Cooler Climate Risk)
                                </div>
                                <div class="text-amber-950 font-medium leading-relaxed">
                                    當前案場氣候夏季氣溫（最高達 <strong>38.0°C</strong>）高於純乾冷器自然冷卻門檻（<strong>${cduFcThresh}°C DB</strong>）。<br>
                                    由於本架構 <strong>100% 零冰機且無任何補冷設備</strong>，夏季高溫時段設施供水將飆升至 <strong>${(38.0 + cduApproach + pheApproach).toFixed(1)}°C</strong>（超出設計 ${cduSys.fwsSupplyC}°C），可能導致晶片過熱降載！
                                </div>
                                <div class="text-[11px] text-amber-800 flex items-center gap-1.5 font-bold pt-1">
                                    <span>💡 建議方案：</span>
                                    <span>切換為 <strong>「乾冷器 + Trim 冰機 (NVIDIA 推薦)」</strong>，或改用 <strong>「絕熱冷卻塔 / 密閉水塔」</strong> 即可確保全年不超溫。</span>
                                </div>
                            </div>
                            ` : ''}

                            <!-- CDU 架構選擇器 (整排清晰可見) -->
                            <div class="max-w-2xl">
                                <label class="block text-xs font-bold text-slate-700 mb-1">CDU 排熱架構模式 (Architecture)</label>
                                <select onchange="ViewCooling.updateCduArch('${targetId}', this.value)" class="w-full text-xs font-black border-2 border-purple-300 rounded-xl p-2.5 bg-white text-purple-950 shadow-2xs">
                                    <option value="dry_cooler_trim" ${cduSys.architecture==='dry_cooler_trim'||cduSys.architecture==='dry_cooler_hx'?'selected':''}>🟡 乾冷器 + 串聯修整冰機 (NVIDIA DSX 混合三模式 / 推薦標準)</option>
                                    <option value="dry_cooler_pure" ${cduSys.architecture==='dry_cooler_pure'?'selected':''}>🟢 純乾冷器節能直冷 (Dry Cooler Pure FC / 100% 自然風冷・零冰機・零耗水)</option>
                                    <option value="adiabatic_tower" ${cduSys.architecture==='adiabatic_tower'?'selected':''}>🔵 絕熱冷卻塔 (Adiabatic Tower / 100% 絕熱預冷自然散熱・零冰機)</option>
                                    <option value="cooling_tower_hx" ${cduSys.architecture==='cooling_tower_hx'?'selected':''}>🔷 密閉式冷卻水塔 (Closed-Circuit Cooling Tower / 100% 蒸發自然冷卻・零冰機)</option>
                                    <option value="water_chiller" ${cduSys.architecture==='water_chiller'?'selected':''}>⚙️ 全額水冷式冰水主機 (Full Mechanical Water Chiller / 全機械壓縮製冷)</option>
                                </select>
                            </div>

                            <!-- 全寬拓樸圖 SVG (獲得完整呼吸空間與極致視覺) -->
                            ${cduTopoDiagram}

                            <!-- 下方 2 欄子面板: 水溫設定 (左) + 設備選型清單 (右) -->
                            <div class="grid grid-cols-1 lg:grid-cols-2 gap-5 pt-1">
                                <!-- 雙迴路供回水溫設定 -->
                                <div class="p-4 bg-white rounded-xl border border-slate-200 space-y-3 shadow-2xs">
                                    <div class="flex justify-between items-center border-b border-slate-100 pb-2">
                                        <span class="text-xs font-bold text-slate-800">一二次側雙迴路水溫鏈設定</span>
                                        <div class="flex items-center gap-1.5">
                                            <button onclick="ViewCooling.applyCduPreset('${targetId}', 'nvidia')" class="px-2 py-0.5 bg-purple-100 hover:bg-purple-200 text-purple-900 text-[10px] font-extrabold rounded">NVIDIA 基準</button>
                                            <button onclick="ViewCooling.applyCduPreset('${targetId}', 'site')" class="px-2 py-0.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-900 text-[10px] font-extrabold rounded">案場慣用值</button>
                                        </div>
                                    </div>

                                    <!-- 二次側 (晶片側) -->
                                    <div class="p-2.5 bg-purple-50/60 rounded-lg border border-purple-200 space-y-1.5">
                                        <div class="flex justify-between items-center">
                                            <span class="text-[10px] font-extrabold text-purple-900">二次側 (晶片側 / IT ↔ CDU):</span>
                                            <span class="text-[9px] text-purple-600 font-bold">晶片溫升 ΔT = ${(cduSys.secReturnC - cduSys.secSupplyC).toFixed(1)}°C</span>
                                        </div>
                                        <div class="grid grid-cols-3 gap-2">
                                            <div>
                                                <label class="block text-[9px] text-slate-500">晶片供水 (°C)</label>
                                                <input type="number" id="cduSecSupplyIn_${targetId}" value="${cduSys.secSupplyC}" step="0.5" onchange="ViewCooling.updateCduParams('${targetId}')" class="w-full text-xs font-bold border rounded p-1 bg-white text-purple-950">
                                            </div>
                                            <div>
                                                <label class="block text-[9px] text-slate-500">晶片回水 (°C)</label>
                                                <input type="number" id="cduSecReturnIn_${targetId}" value="${cduSys.secReturnC}" step="0.5" onchange="ViewCooling.updateCduParams('${targetId}')" class="w-full text-xs font-bold border rounded p-1 bg-white text-purple-950">
                                            </div>
                                            <div>
                                                <label class="block text-[9px] text-slate-500">CDU Approach (°C)</label>
                                                <input type="number" id="cduAppIn_${targetId}" value="${cduSys.cduApproachC}" step="0.5" onchange="ViewCooling.updateCduParams('${targetId}')" class="w-full text-xs font-bold border rounded p-1 bg-white text-slate-800">
                                            </div>
                                        </div>
                                    </div>

                                    <!-- 一次側 (設施側 / CDU ↔ 排熱端) -->
                                    <div class="p-2.5 bg-teal-50/60 rounded-lg border border-teal-200 space-y-1.5">
                                        <div class="flex justify-between items-center">
                                            <span class="text-[10px] font-extrabold text-teal-900">一次側 (設施側 / CDU ↔ 排熱端):</span>
                                            <span class="text-[9px] text-teal-700 font-bold">⚡ FWS 供回水由 CDU Approach 自動連動推算</span>
                                        </div>
                                        <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                            <div>
                                                <label class="block text-[9px] text-slate-500">設施供水 FWS (°C)</label>
                                                <div class="w-full text-xs font-black border border-teal-300 rounded p-1 bg-teal-100/70 text-teal-950 flex items-center justify-between">
                                                    <span>${cduSys.fwsSupplyC}°C</span>
                                                    <span class="text-[8px] text-teal-700 font-normal">自動</span>
                                                </div>
                                            </div>
                                            <div>
                                                <label class="block text-[9px] text-slate-500">設施回水 FWR (°C)</label>
                                                <div class="w-full text-xs font-black border border-teal-300 rounded p-1 bg-teal-100/70 text-teal-950 flex items-center justify-between">
                                                    <span>${cduSys.fwsReturnC}°C</span>
                                                    <span class="text-[8px] text-teal-700 font-normal">自動</span>
                                                </div>
                                            </div>
                                            <div>
                                                <label class="block text-[9px] text-slate-500">排熱端 Approach (°C)</label>
                                                <input type="number" id="cduApproachIn_${targetId}" value="${cduApproach}" step="0.5" onchange="ViewCooling.updateCduParams('${targetId}')" class="w-full text-xs font-bold border rounded p-1 bg-white text-slate-800">
                                            </div>
                                            <div>
                                                <label class="block text-[9px] text-slate-500">板換 (PHE) Approach (°C)</label>
                                                <input type="number" id="cduPheAppIn_${targetId}" value="${cduSys.pheApproachC ?? 2.0}" step="0.5" onchange="ViewCooling.updateCduParams('${targetId}')" class="w-full text-xs font-bold border rounded p-1 bg-white text-slate-800">
                                            </div>
                                        </div>
                                    </div>

                                    ${arch === 'adiabatic_tower' ? (() => {
                                        const satEffIn = cduSys.adiabaticSaturationEfficiencyPct ?? 85;
                                        const estimatedSwitchpoint = Math.max(26.0, cduSys.fwsSupplyC - 9.2);
                                        const hasOverride = cduSys.adiabaticDrySwitchpointC !== undefined && cduSys.adiabaticDrySwitchpointC !== null && cduSys.adiabaticDrySwitchpointC !== '';
                                        const effectiveSwitchpoint = hasOverride ? cduSys.adiabaticDrySwitchpointC : estimatedSwitchpoint;
                                        return `
                                    <div class="p-2.5 bg-sky-50 rounded-lg border border-sky-200 space-y-2">
                                        <div class="flex justify-between items-center">
                                            <span class="text-[10px] font-extrabold text-sky-900">絕熱冷卻塔 (Adiabatic Tower) 專屬參數:</span>
                                        </div>
                                        <div class="grid grid-cols-2 gap-2">
                                            <div>
                                                <label class="block text-[9px] text-slate-500">噴霧飽和效率 (%)</label>
                                                <input type="number" id="atSatEffIn_${targetId}" value="${satEffIn}" step="1" min="0" max="100" onchange="ViewCooling.updateCduParams('${targetId}')" class="w-full text-xs font-bold border rounded p-1 bg-white text-slate-800">
                                            </div>
                                            <div>
                                                <label class="block text-[9px] text-slate-500">乾式切換點 (°C，留空=自動估算)</label>
                                                <input type="number" id="atSwitchpointIn_${targetId}" value="${hasOverride ? cduSys.adiabaticDrySwitchpointC : ''}" step="0.5" placeholder="估算值 ${estimatedSwitchpoint.toFixed(1)}°C" onchange="ViewCooling.updateCduParams('${targetId}')" class="w-full text-xs font-bold border rounded p-1 bg-white text-slate-800">
                                            </div>
                                        </div>
                                        <div class="text-[9.5px] leading-snug ${hasOverride ? 'text-sky-700' : 'text-amber-700'}">
                                            ${hasOverride
                                                ? `目前使用手動輸入值 <strong>${effectiveSwitchpoint}°C</strong>（來自實際廠商選型報告）。`
                                                : `⚠ 目前使用粗估公式 <strong>供水溫 − 9.2°C = ${effectiveSwitchpoint.toFixed(1)}°C</strong>（此9.2°C是從單一份BAC參考案例反推，不同案子的設計乾濕球溫度會讓這個offset在4~9°C之間變動，準確度有限）。正式設計前建議向廠商索取針對本案實際供水溫與設計氣候條件的選型報告，並把報告上的真實 Dry Switchpoint 填入上方欄位覆蓋此估算值。`}
                                        </div>
                                    </div>`; })() : ''}

                                    <div class="p-2.5 bg-emerald-50 rounded-lg border border-emerald-200 text-xs text-emerald-950 flex justify-between items-center">
                                        <div>
                                            <span class="font-bold text-[11px]">Free Cooling 門檻 (以本頁水溫與 Approach 物理動態推算):</span>
                                            <div class="text-[10px] text-emerald-700">
                                                T_fc = ${cduSys.fwsSupplyC}°C (FWS) − ${cduApproach}°C (乾冷器) ${pheApproach > 0 ? ('− ' + pheApproach + '°C (板換)') : ''} = <strong class="text-xs font-black text-emerald-900">${cduFcThresh}°C DB</strong>
                                            </div>
                                        </div>
                                        <span class="px-1.5 py-0.5 bg-white text-emerald-900 border border-emerald-300 rounded font-black text-[9px]">物理連動</span>
                                    </div>
                                </div>

                                <!-- Required vs Selected 選型表 -->
                                <div class="space-y-2.5">
                                    <span class="text-xs font-bold text-slate-700 uppercase flex items-center gap-1.5">
                                        <i data-lucide="settings-2" class="w-3.5 h-3.5 text-slate-500"></i> CDU 設備自選與 N+1 檢核 (專屬架構型錄庫)
                                    </span>
                                    <div class="space-y-2">
                                        ${cduSizingHtml}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- ========================================== -->
                        <!-- 系統 2: Fanwall / RDHX 氣冷排熱系統 (白區氣冷 - 下層全寬) -->
                        <!-- ========================================== -->
                        <div class="bg-slate-50/70 p-5 rounded-2xl border border-indigo-200 space-y-4">
                            <div class="flex flex-col sm:flex-row sm:items-center justify-between border-b border-indigo-100 pb-3 gap-2">
                                <div>
                                    <h4 class="text-sm font-black text-indigo-950 flex items-center gap-1.5">
                                        <i data-lucide="${isRdhx ? 'door-open' : 'wind'}" class="w-4 h-4 text-indigo-600"></i> 系統 2: Fanwall/RDHX 氣冷排熱系統 (白區氣冷)
                                    </h4>
                                    <div class="text-[11px] text-slate-500">專門處理網通、儲存與機櫃輔助廢熱</div>
                                </div>
                                <span class="px-2.5 py-1 bg-indigo-100 text-indigo-900 text-xs font-black rounded-lg border border-indigo-200">
                                    ${(fwSys.designBasis.air_load_kw||0).toFixed(1)} kW 氣冷負載
                                </span>
                            </div>

                            <!-- Fanwall / RDHX 架構選擇器 -->
                            <div class="max-w-2xl">
                                <label class="block text-xs font-bold text-slate-700 mb-1">氣冷 / 背板排熱架構模式 (Architecture)</label>
                                <select onchange="ViewCooling.updateFwArch('${targetId}', this.value)" class="w-full text-xs font-black border-2 border-indigo-300 rounded-xl p-2.5 bg-white text-indigo-950 shadow-2xs">
                                    <option value="air_cooled_chiller" ${fwSys.architecture==='air_cooled_chiller'?'selected':''}>💨 氣冷式冰水主機 (Air-Cooled Chiller / 零耗水)</option>
                                    <option value="water_cooled_chiller" ${fwSys.architecture==='water_cooled_chiller'?'selected':''}>💧 水冷式冰水主機 + 濕式冷卻塔 (Water-Cooled Chiller)</option>
                                    <option value="chilled_water_plant" ${fwSys.architecture==='chilled_water_plant'?'selected':''}>🏢 廠區集中冰水管網 (Central Chilled Water Plant)</option>
                                    <option value="rdhx" ${fwSys.architecture==='rdhx'?'selected':''}>🚪 背板式熱交換器 (Rear Door Heat Exchanger, RDHX)</option>
                                </select>
                            </div>

                            <!-- 全寬氣冷拓樸圖 SVG (系統 2 專屬拓樸圖) -->
                            ${fwTopoDiagram}

                            <!-- 下方 2 欄子面板: 水溫設定 (左) + 設備選型清單 (右) -->
                            <div class="grid grid-cols-1 lg:grid-cols-2 gap-5 pt-1">
                                <!-- 供回水溫設定與建議按鈕 -->
                                <div class="p-4 bg-white rounded-xl border border-slate-200 space-y-3 shadow-2xs">
                                    <div class="flex justify-between items-center border-b border-slate-100 pb-2">
                                        <span class="text-xs font-bold text-slate-800">冰水供回水溫 (CHW Supply / Return)</span>
                                        <div class="flex items-center gap-1.5">
                                            <button onclick="ViewCooling.applyFwTemps('${targetId}', 22, 32)" class="px-2 py-0.5 bg-indigo-100 hover:bg-indigo-200 text-indigo-900 text-[10px] font-extrabold rounded">NVIDIA 22/32°C</button>
                                            <button onclick="ViewCooling.applyFwTemps('${targetId}', 12, 18)" class="px-2 py-0.5 bg-teal-100 hover:bg-teal-200 text-teal-900 text-[10px] font-extrabold rounded">案場寬溫 12/18°C</button>
                                        </div>
                                    </div>
                                    <div class="grid grid-cols-2 gap-3 pt-1">
                                        <div>
                                            <label class="block text-[9px] text-slate-500 mb-0.5">供水溫 CHW Supply (°C)</label>
                                            <input type="number" id="fwSupplyIn_${targetId}" value="${fwSys.chwSupplyC}" step="0.5" onchange="ViewCooling.updateFwParams('${targetId}')" class="w-full text-xs font-bold border rounded-lg p-2 bg-white text-indigo-950">
                                        </div>
                                        <div>
                                            <label class="block text-[9px] text-slate-500 mb-0.5">回水溫 CHW Return (°C)</label>
                                            <input type="number" id="fwReturnIn_${targetId}" value="${fwSys.chwReturnC}" step="0.5" onchange="ViewCooling.updateFwParams('${targetId}')" class="w-full text-xs font-bold border rounded-lg p-2 bg-white text-indigo-950">
                                        </div>
                                    </div>
                                    <div class="p-2.5 bg-indigo-50 rounded-lg border border-indigo-100 text-[11px] text-indigo-900">
                                        💡 冰水主機溫差: <strong class="font-bold">${Math.max(1, fwSys.chwReturnC - fwSys.chwSupplyC)}°C</strong>，供水溫越高對冰機 COP 越有利。
                                    </div>
                                </div>

                                <!-- Required vs Selected 選型表 -->
                                <div class="space-y-2.5">
                                    <span class="text-xs font-bold text-slate-700 uppercase flex items-center gap-1.5">
                                        <span>⚙️</span> ${isRdhx ? 'RDHX 設備自選與 N+1 檢核' : 'Fanwall 設備自選與 N+1 檢核'}
                                    </span>
                                    <div class="space-y-2">
                                        ${fwSizingHtml}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        },

        toggleExpand(targetId) {
            expandedUnitIds[targetId] = !expandedUnitIds[targetId];
            this.render(document.getElementById('stepContent'));
        },

        expandAll() {
            Object.keys(expandedUnitIds).forEach(k => { expandedUnitIds[k] = true; });
            const state = window.AppStore.state;
            state.halls.forEach(h => h.dus.forEach(d => { expandedUnitIds[d.id] = true; }));
            state.corePods.forEach(p => { expandedUnitIds[p.id] = true; });
            this.render(document.getElementById('stepContent'));
        },

        collapseAll() {
            Object.keys(expandedUnitIds).forEach(k => { expandedUnitIds[k] = false; });
            this.render(document.getElementById('stepContent'));
        },

        smartAccordion() {
            filterMode = 'all';
            const state = window.AppStore.state;
            state.halls.forEach(h => h.dus.forEach(d => {
                const s = [...(d.plantDesign.cduSystem.sizing||[]), ...(d.plantDesign.fanwallSystem.sizing||[])];
                expandedUnitIds[d.id] = !s.every(x => x.passed);
            }));
            state.corePods.forEach(p => {
                const s = [...(p.plantDesign.cduSystem.sizing||[]), ...(p.plantDesign.fanwallSystem.sizing||[])];
                expandedUnitIds[p.id] = !s.every(x => x.passed);
            });
            this.render(document.getElementById('stepContent'));
        },

        toggleFilterAttention() {
            filterMode = (filterMode === 'attention') ? 'all' : 'attention';
            this.render(document.getElementById('stepContent'));
        },

        setFilterMode(mode) {
            filterMode = mode;
            this.render(document.getElementById('stepContent'));
        },

        scrollToUnit(targetId) {
            expandedUnitIds[targetId] = true;
            this.render(document.getElementById('stepContent'));
            setTimeout(() => {
                const el = document.getElementById('unit_' + targetId);
                if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 30);
        },

        getTargetObj(targetId) {
            const state = window.AppStore.state;
            let targetObj = null;
            state.halls.forEach(h => {
                const du = h.dus.find(d => d.id === targetId);
                if (du) targetObj = du;
            });
            if (!targetObj) {
                targetObj = state.corePods.find(p => p.id === targetId);
            }
            return targetObj;
        },

        updateCduArch(targetId, arch) {
            const target = this.getTargetObj(targetId);
            if (target) {
                target.plantDesign.cduSystem.architecture = arch;
                target.plantDesign.cduSystem.sizing = [];
                window.AppStore.notify();
            }
            this.render(document.getElementById('stepContent'));
        },

        updateFwArch(targetId, arch) {
            const target = this.getTargetObj(targetId);
            if (target) {
                target.plantDesign.fanwallSystem.architecture = arch;
                target.plantDesign.fanwallSystem.sizing = [];
                window.AppStore.notify();
            }
            this.render(document.getElementById('stepContent'));
        },

        changeModel(targetId, sysType, equipKey, model) {
            window.AppStore.updateSelectedEquipment(targetId, sysType, equipKey, model, undefined);
            this.render(document.getElementById('stepContent'));
        },

        changeQty(targetId, sysType, equipKey, qty) {
            window.AppStore.updateSelectedEquipment(targetId, sysType, equipKey, undefined, qty);
            this.render(document.getElementById('stepContent'));
        },

        applyCduPreset(targetId, preset) {
            const target = this.getTargetObj(targetId);
            if (target) {
                const c = target.plantDesign.cduSystem;
                if (preset === 'nvidia') {
                    c.secSupplyC = 45.0; c.secReturnC = 57.0; c.cduApproachC = 4.0;
                    c.fwsSupplyC = 41.0; c.fwsReturnC = 53.0; c.dryCoolerApproachC = 5.0; c.pheApproachC = 2.0;
                } else {
                    c.secSupplyC = 41.0; c.secReturnC = 51.0; c.cduApproachC = 4.0;
                    c.fwsSupplyC = 37.0; c.fwsReturnC = 47.0; c.dryCoolerApproachC = 5.0; c.pheApproachC = 2.0;
                }
                window.AppStore.notify();
            }
            this.render(document.getElementById('stepContent'));
        },

        applyFwTemps(targetId, sup, ret) {
            const target = this.getTargetObj(targetId);
            if (target) {
                target.plantDesign.fanwallSystem.chwSupplyC = sup;
                target.plantDesign.fanwallSystem.chwReturnC = ret;
                window.AppStore.notify();
            }
            this.render(document.getElementById('stepContent'));
        },

        updateCduParams(targetId) {
            const secSup = parseFloat(document.getElementById('cduSecSupplyIn_' + targetId)?.value) || 45.0;
            const secRet = parseFloat(document.getElementById('cduSecReturnIn_' + targetId)?.value) || 57.0;
            const cduApp = parseFloat(document.getElementById('cduAppIn_' + targetId)?.value) || 4.0;

            // 1. 自動熱力學連動: 設施供水 FWS = 晶片供水 - CDU Approach
            const sup = Number((secSup - cduApp).toFixed(1));
            // 設施回水 FWR = 晶片回水 - CDU Approach (保持溫升 ΔT 守恆)
            const ret = Number((secRet - cduApp).toFixed(1));

            const outdoorApp = parseFloat(document.getElementById('cduApproachIn_' + targetId)?.value) || 5.0;
            const pheApp = parseFloat(document.getElementById('cduPheAppIn_' + targetId)?.value) || 2.0;

            const target = this.getTargetObj(targetId);
            if (target) {
                const cdu = target.plantDesign.cduSystem;
                cdu.secSupplyC = secSup;
                cdu.secReturnC = secRet;
                cdu.cduApproachC = cduApp;
                cdu.fwsSupplyC = sup;
                cdu.fwsReturnC = ret;
                cdu.dryCoolerApproachC = outdoorApp;
                cdu.pheApproachC = pheApp;

                // 絕熱冷卻塔專屬欄位 (只有該架構才會渲染出這兩個輸入框，其他架構這裡會是 null)
                const satEffEl = document.getElementById('atSatEffIn_' + targetId);
                if (satEffEl) cdu.adiabaticSaturationEfficiencyPct = parseFloat(satEffEl.value) || 85;
                const switchpointEl = document.getElementById('atSwitchpointIn_' + targetId);
                if (switchpointEl) {
                    const v = switchpointEl.value.trim();
                    cdu.adiabaticDrySwitchpointC = v === '' ? null : parseFloat(v);
                }

                window.AppStore.notify();
            }
            this.render(document.getElementById('stepContent'));
        },

        updateFwParams(targetId) {
            const sup = parseFloat(document.getElementById('fwSupplyIn_' + targetId)?.value) || 12.0;
            const ret = parseFloat(document.getElementById('fwReturnIn_' + targetId)?.value) || 18.0;

            const target = this.getTargetObj(targetId);
            if (target) {
                const fw = target.plantDesign.fanwallSystem;
                fw.chwSupplyC = sup;
                fw.chwReturnC = ret;
                window.AppStore.notify();
            }
            this.render(document.getElementById('stepContent'));
        }
    };

    window.ViewCooling = ViewCooling;
})(window);
