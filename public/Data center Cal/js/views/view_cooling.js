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
                const cduArchText = (window.CoolingArchRegistry && window.CoolingArchRegistry.get(cduArch)?.pillLabel) || cduArch;
                const fwArchText = (window.CoolingArchRegistry && window.CoolingArchRegistry.get(fwArch)?.pillLabel) || fwArch;

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
            const cduArchDesc = window.CoolingArchRegistry ? window.CoolingArchRegistry.get(cduArch) : null;
            const fwArchDesc = window.CoolingArchRegistry ? window.CoolingArchRegistry.get(fwArch) : null;
            const cduArchLabel = cduArchDesc ? cduArchDesc.cardLabel : cduArch;
            const fwArchLabel = fwArchDesc ? fwArchDesc.cardLabel : fwArch;

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

        // 架構專屬參數面板 (D-3: 由 archDesc.params 驅動)
        renderArchParamPanel(archDesc, sys, targetId, sysType = 'cdu') {
            if (!archDesc || !Array.isArray(archDesc.params)) return '';
            const customParams = archDesc.params.filter(p => p.archSpecific || p.panel === 'custom');
            if (customParams.length === 0) return '';

            const title = archDesc.paramPanelTitle || (archDesc.paramPanel && archDesc.paramPanel.title) || `${archDesc.cardLabel} 專屬參數:`;
            const noteObj = typeof archDesc.paramPanelNote === 'function'
                ? archDesc.paramPanelNote(sys)
                : (archDesc.paramPanel && typeof archDesc.paramPanel.note === 'function' ? archDesc.paramPanel.note(sys) : null);
            const updateFn = sysType === 'fw' ? `ViewCooling.updateFwParams('${targetId}')` : `ViewCooling.updateCduParams('${targetId}')`;

            const inputsHtml = customParams.map(p => {
                const id = (p.idPrefix || (p.key + '_')) + targetId;
                let val;
                if (p.nullable) {
                    const hasVal = sys[p.key] !== undefined && sys[p.key] !== null && sys[p.key] !== '';
                    val = hasVal ? sys[p.key] : '';
                } else {
                    val = sys[p.key] ?? (p.default !== undefined ? p.default : '');
                }
                const stepAttr = p.step !== undefined ? ` step="${p.step}"` : '';
                const minAttr = p.min !== undefined ? ` min="${p.min}"` : '';
                const maxAttr = p.max !== undefined ? ` max="${p.max}"` : '';
                const placeholderStr = typeof p.placeholder === 'function' ? p.placeholder(sys) : (p.placeholder ? p.placeholder : '');
                const placeholderAttr = placeholderStr ? ` placeholder="${placeholderStr}"` : '';

                return `                                            <div>
                                                <label class="block text-[9px] text-slate-500">${p.label}</label>
                                                <input type="number" id="${id}" value="${val}"${stepAttr}${minAttr}${maxAttr}${placeholderAttr} onchange="${updateFn}" class="w-full text-xs font-bold border rounded p-1 bg-white text-slate-800">
                                            </div>`;
            }).join('\n');

            const noteHtml = noteObj ? `
                                        <div class="text-[9.5px] leading-snug ${noteObj.hasOverride ? 'text-sky-700' : 'text-amber-700'}">
                                            ${noteObj.text}
                                        </div>` : '';

            return `
                                    <div class="p-2.5 bg-sky-50 rounded-lg border border-sky-200 space-y-2">
                                        <div class="flex justify-between items-center">
                                            <span class="text-[10px] font-extrabold text-sky-900">${title}</span>
                                        </div>
                                        <div class="grid grid-cols-2 gap-2">
${inputsHtml}
                                        </div>${noteHtml}
                                    </div>`;
        },

        // 展開狀態卡片 (Expanded Card)
        renderExpandedUnitCard(t) {
            const targetId = t.id;
            const cduSys = t.obj.plantDesign.cduSystem;
            const fwSys = t.obj.plantDesign.fanwallSystem;
            const arch = cduSys.architecture || 'dry_cooler_hx';

            // P1-10: 唯讀存取，預設值已在 store.js / defaultCduSystem 補齊，不在此改寫 state
            const secSupplyC = cduSys.secSupplyC ?? 45.0;
            const secReturnC = cduSys.secReturnC ?? 57.0;
            const cduApproachC = cduSys.cduApproachC ?? 3.0;

            const cduArchDesc = window.CoolingArchRegistry ? window.CoolingArchRegistry.get(arch) : null;
            const dcApproach = cduSys.dryCoolerApproachC ?? 5.0;
            const pheApproach = cduArchDesc?.flags?.isTrim ? (cduSys.pheApproachC ?? 2.0) : 0.0;
            const fwsSupplyC = cduSys.fwsSupplyC ?? Number((secSupplyC - cduApproachC).toFixed(1));
            const cduFcThresh = (fwsSupplyC - dcApproach - pheApproach).toFixed(1);
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
            const fwArch = fwSys.architecture || 'air_cooled_chiller';
            const fwArchDesc = window.CoolingArchRegistry ? window.CoolingArchRegistry.get(fwArch) : null;
            const isRdhx = !!fwArchDesc?.flags?.isRdhx;
            const fwSchematic = (fwArchDesc && fwArchDesc.schematic) ? fwArchDesc.schematic : 'air_plant';
            const fwTopoDiagram = window.CoolingSchematics ? window.CoolingSchematics.render(fwSchematic, { t, fwSys, fwArch }) : '';

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
            const cduSchematic = (cduArchDesc && cduArchDesc.schematic) ? cduArchDesc.schematic : 'series_trim';
            const unitRes = (window.AppStore?.results?.byDu || []).find(r => r.id === targetId)
                || (window.AppStore?.results?.byCorePod || []).find(r => r.id === targetId);
            const cduModeHours = unitRes?.cduModeHours;
            const cduTopoDiagram = window.CoolingSchematics ? window.CoolingSchematics.render(cduSchematic, { t, cduSys, arch, cduModeHours }) : '';

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
                            ${(() => {
                                const maxDb = window.AppStore?.state?.site?.stats?.maxDB ?? 38.0;
                                const fcThreshNum = parseFloat(cduFcThresh);
                                if (arch !== 'dry_cooler_pure' || maxDb <= fcThreshNum) return '';
                                return `
                            <div class="p-4 bg-amber-500/10 border-2 border-amber-500 rounded-xl space-y-2 text-xs">
                                <div class="flex items-center gap-2 font-black text-amber-900 text-sm">
                                    <span>⚠️</span> 氣候超溫與無冰機備援警示 (Pure Dry Cooler Climate Risk)
                                </div>
                                <div class="text-amber-950 font-medium leading-relaxed">
                                    當前案場氣候夏季氣溫（最高達 <strong>${maxDb.toFixed(1)}°C</strong>）高於純乾冷器自然冷卻門檻（<strong>${cduFcThresh}°C DB</strong>）。<br>
                                    由於本架構 <strong>100% 零冰機且無任何補冷設備</strong>，夏季高溫時段設施供水將飆升至 <strong>${(maxDb + dcApproach + pheApproach).toFixed(1)}°C</strong>（超出設計 ${cduSys.fwsSupplyC}°C），可能導致晶片過熱降載！
                                </div>
                                <div class="text-[11px] text-amber-800 flex items-center gap-1.5 font-bold pt-1">
                                    <span>💡 建議方案：</span>
                                    <span>切換為 <strong>「乾冷器 + Trim 冰機 (NVIDIA 推薦)」</strong>，或改用 <strong>「絕熱冷卻塔 / 密閉水塔」</strong> 即可確保全年不超溫。</span>
                                </div>
                            </div>
                            `;
                            })()}

                            <!-- CDU 架構選擇器 (整排清晰可見) -->
                            <div class="max-w-2xl">
                                <label class="block text-xs font-bold text-slate-700 mb-1">CDU 排熱架構模式 (Architecture)</label>
                                <select onchange="ViewCooling.updateCduArch('${targetId}', this.value)" class="w-full text-xs font-black border-2 border-purple-300 rounded-xl p-2.5 bg-white text-purple-950 shadow-2xs">
                                    ${(window.CoolingArchRegistry ? window.CoolingArchRegistry.list('liquid') : []).map(arch => {
                                        const isSelected = (cduSys.architecture === arch.id) || (arch.aliases && arch.aliases.includes(cduSys.architecture));
                                        return `<option value="${arch.id}" ${isSelected ? 'selected' : ''}>${arch.optionLabel}</option>`;
                                    }).join('\n                                    ')}
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
                                            <span class="text-[9px] text-purple-600 font-bold">晶片溫升 ΔT = ${(secReturnC - secSupplyC).toFixed(1)}°C</span>
                                        </div>
                                        <div class="grid grid-cols-3 gap-2">
                                            <div>
                                                <label class="block text-[9px] text-slate-500">晶片供水 (°C)</label>
                                                <input type="number" id="cduSecSupplyIn_${targetId}" value="${secSupplyC}" step="0.5" onchange="ViewCooling.updateCduParams('${targetId}')" class="w-full text-xs font-bold border rounded p-1 bg-white text-purple-950">
                                            </div>
                                            <div>
                                                <label class="block text-[9px] text-slate-500">晶片回水 (°C)</label>
                                                <input type="number" id="cduSecReturnIn_${targetId}" value="${secReturnC}" step="0.5" onchange="ViewCooling.updateCduParams('${targetId}')" class="w-full text-xs font-bold border rounded p-1 bg-white text-purple-950">
                                            </div>
                                            <div>
                                                <label class="block text-[9px] text-slate-500">CDU Approach (°C)</label>
                                                <input type="number" id="cduAppIn_${targetId}" value="${cduApproachC}" step="0.5" onchange="ViewCooling.updateCduParams('${targetId}')" class="w-full text-xs font-bold border rounded p-1 bg-white text-slate-800">
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
                                                <input type="number" id="cduApproachIn_${targetId}" value="${dcApproach}" step="0.5" onchange="ViewCooling.updateCduParams('${targetId}')" class="w-full text-xs font-bold border rounded p-1 bg-white text-slate-800">
                                            </div>
                                            <div>
                                                <label class="block text-[9px] text-slate-500">板換 (PHE) Approach (°C)</label>
                                                <input type="number" id="cduPheAppIn_${targetId}" value="${cduSys.pheApproachC ?? 2.0}" step="0.5" onchange="ViewCooling.updateCduParams('${targetId}')" class="w-full text-xs font-bold border rounded p-1 bg-white text-slate-800">
                                            </div>
                                        </div>
                                    </div>

                                    ${this.renderArchParamPanel(cduArchDesc, cduSys, targetId, 'cdu')}

                                    <div class="p-2.5 bg-emerald-50 rounded-lg border border-emerald-200 text-xs text-emerald-950 flex justify-between items-center">
                                        <div>
                                            <span class="font-bold text-[11px]">Free Cooling 門檻 (以本頁水溫與 Approach 物理動態推算):</span>
                                            <div class="text-[10px] text-emerald-700">
                                                T_fc = ${cduSys.fwsSupplyC}°C (FWS) − ${dcApproach}°C (乾冷器) ${pheApproach > 0 ? ('− ' + pheApproach + '°C (板換)') : ''} = <strong class="text-xs font-black text-emerald-900">${cduFcThresh}°C DB</strong>
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
                                    ${(window.CoolingArchRegistry ? window.CoolingArchRegistry.list('air') : []).map(arch => {
                                        const isSelected = (fwSys.architecture === arch.id) || (arch.aliases && arch.aliases.includes(fwSys.architecture));
                                        return `<option value="${arch.id}" ${isSelected ? 'selected' : ''}>${arch.optionLabel}</option>`;
                                    }).join('\n                                    ')}
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
            const num = (id, d) => {
                const el = document.getElementById(id);
                const v = parseFloat(el?.value);
                return Number.isFinite(v) ? v : d;
            };

            const secSup = num('cduSecSupplyIn_' + targetId, 45.0);
            const secRet = num('cduSecReturnIn_' + targetId, 57.0);
            const cduApp = num('cduAppIn_' + targetId, 3.0);

            // 1. 自動熱力學連動: 設施供水 FWS = 晶片供水 - CDU Approach
            const sup = Number((secSup - cduApp).toFixed(1));
            // 設施回水 FWR = 晶片回水 - CDU Approach (保持溫升 ΔT 守恆)
            const ret = Number((secRet - cduApp).toFixed(1));

            const outdoorApp = num('cduApproachIn_' + targetId, 5.0);
            const pheApp = num('cduPheAppIn_' + targetId, 2.0);

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

                // 架構專屬參數更新 (D-3: 優先自 archDesc.params 動態讀取)
                const cduArchDesc = typeof CoolingArchRegistry !== 'undefined' ? CoolingArchRegistry.get(cdu.architecture) : null;
                let handledCustom = false;
                if (cduArchDesc && Array.isArray(cduArchDesc.params)) {
                    for (const p of cduArchDesc.params) {
                        if (!p.archSpecific) continue;
                        const id = (p.idPrefix || (p.key + '_')) + targetId;
                        const el = document.getElementById(id);
                        if (!el) continue;
                        handledCustom = true;
                        const v = el.value.trim();
                        if (p.nullable && v === '') {
                            cdu[p.key] = null;
                        } else {
                            const n = parseFloat(v);
                            cdu[p.key] = Number.isFinite(n) ? n : (p.default !== undefined ? p.default : null);
                        }
                    }
                }
                if (!handledCustom) {
                    const satEffEl = document.getElementById('atSatEffIn_' + targetId);
                    if (satEffEl) cdu.adiabaticSaturationEfficiencyPct = num('atSatEffIn_' + targetId, 85.0);
                    const switchpointEl = document.getElementById('atSwitchpointIn_' + targetId);
                    if (switchpointEl) {
                        const v = switchpointEl.value.trim();
                        const n = parseFloat(v);
                        cdu.adiabaticDrySwitchpointC = v === '' || !Number.isFinite(n) ? null : n;
                    }
                }

                window.AppStore.notify();
            }
            this.render(document.getElementById('stepContent'));
        },

        updateFwParams(targetId) {
            const num = (id, d) => {
                const el = document.getElementById(id);
                const v = parseFloat(el?.value);
                return Number.isFinite(v) ? v : d;
            };

            const sup = num('fwSupplyIn_' + targetId, 12.0);
            const ret = num('fwReturnIn_' + targetId, 18.0);

            const target = this.getTargetObj(targetId);
            if (target) {
                const fw = target.plantDesign.fanwallSystem;
                fw.chwSupplyC = sup;
                fw.chwReturnC = ret;

                const fwArchDesc = typeof CoolingArchRegistry !== 'undefined' ? CoolingArchRegistry.get(fw.architecture) : null;
                if (fwArchDesc && Array.isArray(fwArchDesc.params)) {
                    for (const p of fwArchDesc.params) {
                        if (!p.archSpecific) continue;
                        const id = (p.idPrefix || (p.key + '_')) + targetId;
                        const el = document.getElementById(id);
                        if (!el) continue;
                        const v = el.value.trim();
                        if (p.nullable && v === '') {
                            fw[p.key] = null;
                        } else {
                            const n = parseFloat(v);
                            fw[p.key] = Number.isFinite(n) ? n : (p.default !== undefined ? p.default : null);
                        }
                    }
                }

                window.AppStore.notify();
            }
            this.render(document.getElementById('stepContent'));
        }
    };

    window.ViewCooling = ViewCooling;
})(window);
