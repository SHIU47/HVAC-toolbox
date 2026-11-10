/**
 * view_cooling.js - Step 4: Smart Accordion & Real Equipment Catalogs with RDHX (V27)
 * - Smart Accordion: Completed units collapse by default, while incomplete/attention units auto-expand
 * - Top Action Controls: [全部展開] / [全部收合] / [智慧聚焦 (僅展開需調整單元)]
 * - Full Device Catalog Wiring: Dynamic selection connected to device_catalog/ database via CatalogManager
 * - RDHX (Rear Door Heat Exchanger) architecture support in System 2
 * - Real-time N+1 checks and design margin calculations
 */
(function(window) {
    'use strict';
    const _t = (k, p, fb) => (window.I18N ? window.I18N.t(k, p) : (fb || k));

    let filterMode = 'all'; // 'all' | 'attention'
    const expandedUnitIds = {}; // targetId -> boolean

    const ViewCooling = {
        _lastPreset: null,

        detectActivePreset() {
            const state = window.AppStore?.state || {};
            const plants = state.coolingPlants || [];
            if (plants.length === 0) {
                return 'dedicated';
            }
            if (this._lastPreset) {
                if (this._lastPreset === 'site_shared') {
                    const liq = plants.filter(p => p.loop === 'liquid');
                    const air = plants.filter(p => p.loop === 'air');
                    if (liq.length <= 1 && air.length <= 1) return 'site_shared';
                } else if (this._lastPreset === 'hall_grouped') {
                    return 'hall_grouped';
                } else if (this._lastPreset === 'custom') {
                    return 'custom';
                }
            }
            const liq = plants.filter(p => p.loop === 'liquid');
            const air = plants.filter(p => p.loop === 'air');
            if (liq.length <= 1 && air.length <= 1 && plants.some(p => p.name && (p.name.includes('全廠') || p.name.includes('Site')))) {
                return 'site_shared';
            }
            if (plants.some(p => p.name && (p.name.includes('Hall') || p.name.includes('區')))) {
                return 'hall_grouped';
            }
            return (plants.length === 0) ? 'dedicated' : (this._lastPreset || 'custom');
        },

        _renderTimer: null,
        scheduleRender() {
            if (this._renderTimer) clearTimeout(this._renderTimer);
            this._renderTimer = setTimeout(() => {
                this._renderTimer = null;
                const container = document.getElementById('stepContent');
                if (container && window.App && window.App.currentStep === 4) {
                    this.render(container);
                }
            }, 0);
        },

        render(container) {
            if (this._renderTimer) {
                clearTimeout(this._renderTimer);
                this._renderTimer = null;
            }
            const scrollPos = (typeof window !== 'undefined') ? (window.scrollY || document.documentElement.scrollTop || 0) : 0;
            const activeEl = (typeof document !== 'undefined' && document.activeElement) ? document.activeElement : null;
            const activeId = (activeEl && activeEl.id) ? activeEl.id : null;
            const selStart = (activeEl && typeof activeEl.selectionStart === 'number') ? activeEl.selectionStart : null;
            const selEnd = (activeEl && typeof activeEl.selectionEnd === 'number') ? activeEl.selectionEnd : null;

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
                    hallName: _t('cooling.corePodModule', null, 'CorePOD 模組'), 
                    type: 'pod', 
                    obj: p,
                    summ: summ
                });
            });

            if (targets.length === 0) {
                container.innerHTML = `<div class="p-8 text-center bg-white rounded-2xl border">${_t('cooling.noTargets', null, '無可配置的 DU 或 CorePOD')}</div>`;
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
                    const dominantRed = (allSizing.every(s => (s.redundancy || 'N+1') === (allSizing[0]?.redundancy || 'N+1')))
                        ? (allSizing[0]?.redundancy || 'N+1')
                        : 'N+1';
                    const passText = (dominantRed === 'N+1')
                        ? _t('cooling.statusPassed', null, '滿足 N+1')
                        : _t('cooling.statusPassedRedundancy', { redundancy: dominantRed }, `滿足 ${dominantRed}`);
                    t.statusBadge = `<span class="inline-flex items-center gap-1.5 px-2 py-0.5 bg-emerald-50 text-emerald-800 text-[10px] font-bold rounded-md border border-emerald-200"><span class="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></span>${passText}</span>`;
                } else if (hasFail) {
                    t.status = 'fail';
                    t.statusBadge = `<span class="inline-flex items-center gap-1.5 px-2 py-0.5 bg-red-50 text-red-800 text-[10px] font-bold rounded-md border border-red-200"><span class="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0"></span>${_t('cooling.statusDeficit', null, '容量不足')}</span>`;
                    attentionCount++;
                } else {
                    t.status = 'incomplete';
                    t.statusBadge = `<span class="inline-flex items-center gap-1.5 px-2 py-0.5 bg-slate-100 text-slate-600 text-[10px] font-bold rounded-md border border-slate-300"><span class="w-1.5 h-1.5 rounded-full bg-slate-400 shrink-0"></span>${_t('cooling.statusNoEquip', null, '尚未選型')}</span>`;
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
                            <span class="text-purple-700 font-bold ml-1">${expandedUnitIds[t.id] ? _t('cooling.scrollDown', null, '捲動 ↓') : _t('cooling.expandDown', null, '展開 ↓')}</span>
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
                    <div class="p-12 text-center bg-white rounded-2xl border border-emerald-300 shadow-sm space-y-3">
                        <div class="w-12 h-12 mx-auto rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
                            <i data-lucide="check-circle-2" class="w-7 h-7"></i>
                        </div>
                        <div class="text-base font-black text-emerald-800">${_t('cooling.allPassedBanner', null, '所有單元冷卻設備選型皆已滿足 N+1 規範！')}</div>
                        <div class="text-xs text-slate-500">${_t('cooling.allPassedSub', null, '無任何需注意或未完成之單元。')}</div>
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
                    errList += `<li><strong>[${safeTargetName}]</strong> ${safeSysName} - ${safeEquipName}：${fi.reqText}${_t('cooling.currentlySelected', { sel: fi.selText }, `（目前僅選 ${fi.selText}）`)} <a href="#unit_${fi.targetId}" onclick="ViewCooling.scrollToUnit('${fi.targetId}')" class="text-red-700 underline font-bold ml-1">${_t('cooling.goToAdjust', null, '前往調整')}</a></li>`;
                });

                proceedAlert = `
                    <div class="p-4 bg-red-50 border-2 border-red-400 rounded-2xl space-y-2 text-xs">
                        <div class="flex items-center gap-2 font-black text-red-900 text-sm">
                            <i data-lucide="alert-triangle" class="w-4 h-4 text-red-600 shrink-0"></i>
                            <span>${_t('cooling.lockedBanner', { n: proceedStatus.failedItems.length }, `尚有 ${proceedStatus.failedItems.length} 項設備容量未達 N+1 規範，系統已鎖定無法前往 Step 5：`)}</span>
                        </div>
                        <ul class="list-disc list-inside text-red-800 space-y-1 pl-1 font-medium">
                            ${errList}
                        </ul>
                        <div class="pt-1 text-[11px] text-red-600 flex items-center gap-1.5">
                            <i data-lucide="info" class="w-3.5 h-3.5 text-red-500 shrink-0"></i>
                            <span>${_t('cooling.lockedTip', null, '系統已自動為您展開需調整之單元，請增加配置使所有檢核燈號全數轉為綠色即可解鎖。')}</span>
                        </div>
                    </div>
                `;
            }

            // 舊專案 CorePOD 共用全廠冷水提示
            let sharedPlantNoticesHtml = '';
            (window.AppStore.state.corePods || []).forEach(p => {
                if (p._showSharedPlantNotice) {
                    const podName = window.UIKit ? window.UIKit.escapeHTML(p.name) : p.name;
                    sharedPlantNoticesHtml += `
                        <div class="p-4 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 text-xs flex items-center justify-between gap-3 shadow-2xs">
                            <div class="flex items-center gap-2">
                                <i data-lucide="alert-triangle" class="w-4 h-4 text-amber-600 shrink-0"></i>
                                <span>${_t('cooling.sharedPlantNotice', { name: podName }, `此 CorePOD (${podName}) 原設定為共用全廠冷水，請在冷卻系統分組中指定`)}</span>
                            </div>
                            <button onclick="const pod = window.AppStore.state.corePods.find(x => x.id === '${p.id}'); if (pod) delete pod._showSharedPlantNotice; ViewCooling.render(document.getElementById('stepContent'));" class="px-2.5 py-1 bg-amber-200/80 hover:bg-amber-300 text-amber-950 font-bold rounded-lg text-[11px] transition">
                                ${_t('cooling.dismissNotice', null, '知道了')}
                            </button>
                        </div>
                    `;
                }
            });

            let plantsListHtml = '';
            (state.coolingPlants || []).forEach(plant => {
                plantsListHtml += this.renderSharedPlantCard(plant);
            });

            container.innerHTML = `
                <div class="space-y-6">
                    <!-- 頂部: 標題與智慧收合控制 -->
                    <div class="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                        <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div>
                                <h2 class="text-xl font-bold text-slate-900 flex items-center gap-2">
                                    <i data-lucide="snowflake" class="w-5 h-5 text-sky-600"></i>
                                    <span>${_t('cooling.stepTitle', null, 'Step 4: 冷卻系統設計 (共用群組 & 雙迴路選型)')}</span>
                                </h2>
                                <p class="text-sm text-slate-500 mt-1">
                                    ${_t('cooling.stepDesc', null, '支援單元獨立或共用冷卻系統群組 (N/N+1/N+2/2N 冗餘)，4 款液冷架構、4 款氣冷架構 (含 RDHX 背板) 與真實設備型錄庫。')}
                                </p>
                            </div>
                            <div class="flex items-center gap-2 bg-slate-100 p-1.5 rounded-xl border border-slate-200 flex-wrap">
                                <button onclick="ViewCooling.smartAccordion()" class="px-3 py-1.5 text-xs font-bold rounded-lg transition bg-white text-slate-900 shadow-2xs hover:bg-slate-50 flex items-center gap-1.5">
                                    <i data-lucide="sparkles" class="w-3.5 h-3.5 text-amber-500"></i>
                                    <span>${_t('cooling.smartFocus', null, '智慧聚焦')}</span>
                                </button>
                                <button onclick="ViewCooling.expandAll()" class="px-2.5 py-1.5 text-xs font-bold rounded-lg transition text-slate-700 hover:bg-white hover:text-slate-900 flex items-center gap-1.5">
                                    <i data-lucide="folder-open" class="w-3.5 h-3.5"></i>
                                    <span>${_t('cooling.expandAll', null, '全部展開')}</span>
                                </button>
                                <button onclick="ViewCooling.collapseAll()" class="px-2.5 py-1.5 text-xs font-bold rounded-lg transition text-slate-700 hover:bg-white hover:text-slate-900 flex items-center gap-1.5">
                                    <i data-lucide="folder" class="w-3.5 h-3.5"></i>
                                    <span>${_t('cooling.collapseAll', null, '全部收合')}</span>
                                </button>
                                <button onclick="ViewCooling.toggleFilterAttention()" class="px-3 py-1.5 text-xs font-bold rounded-lg transition ${filterMode==='attention' ? 'bg-red-600 text-white' : 'text-red-700 hover:bg-red-50'} flex items-center gap-1.5">
                                    <i data-lucide="alert-circle" class="w-3.5 h-3.5"></i>
                                    <span>${_t('cooling.attentionOnly', { n: attentionCount }, `僅看需調整 (${attentionCount})`)}</span>
                                </button>
                            </div>
                        </div>
                    </div>${sharedPlantNoticesHtml ? `\n\n                    ${sharedPlantNoticesHtml}` : ''}

                    <!-- V10：① 全廠設計條件 -->
                    ${this.sectionHeader(1, _t('cooling.sec1Title', null, '全廠設計條件'), _t('cooling.sec1Desc', null, '設定整場共用的水溫。白框是輸入值，灰框是自動算出的值。'), this.secStatus(true, _t('cooling.secLinked', null, '已設定')))}
                    ${this.renderSitePanel()}

                    <!-- V10：② 冷卻系統分組 -->
                    ${this.sectionHeader(2, _t('cooling.sec2Title', null, '冷卻系統分組'), _t('cooling.sec2Desc', null, '決定哪些單元共用同一套主機房（冰機、乾冷器、水泵）。一般 AI 機房選「整場共用」。'), this.secStatus(true, _t('cooling.sec2Status', { n: (state.coolingPlants || []).filter(p => (p.memberIds || []).length).length }, `${(state.coolingPlants || []).filter(p => (p.memberIds || []).length).length} 組共用機房`)))}
                    ${this.collapsible('grouping', _t('cooling.groupingSummary', { n: (state.coolingPlants || []).filter(p => (p.memberIds || []).length).length }, `冷卻系統分組（目前 ${(state.coolingPlants || []).filter(p => (p.memberIds || []).length).length} 組共用機房，點擊展開調整）`), this.renderPlantGroupingPanel(targets))}

                    <!-- V10：③ 主機房設備選型 -->
                    ${this.sectionHeader(3, _t('cooling.sec3Title', null, '主機房設備選型'), _t('cooling.sec3Desc', null, '選冰機、排熱設備、水泵的型號與台數。不知道選哪台就按「自動」，型號下拉會顯示選這台需要幾台、餘裕多少。'), this.plantsStatus(state))}
                    ${(state.coolingPlants || []).filter(p => (p.memberIds || []).length).length ? '' : `<div class="text-xs text-slate-500 px-1">${_t('cooling.sec3NoPlant', null, '目前沒有共用機房，各單元的主機房設備在 ⑤ 各單元細節裡設定。')}</div>`}

                    <!-- 共用冷卻系統設備配置 (Shared Cooling Plants) -->
                    ${plantsListHtml ? `
                    <div class="space-y-4">
                        <div class="flex items-center justify-between text-xs font-bold text-slate-600 px-1">
                            <span class="flex items-center gap-1.5"><i data-lucide="network" class="w-4 h-4 text-purple-600"></i> ${_t('cooling.plantOverview', null, '共用冷卻系統設備配置')}</span>
                            <span class="text-slate-400 font-normal">${_t('cooling.membersCount', { n: (state.coolingPlants || []).length })}</span>
                        </div>
                        <div class="space-y-6">
                            ${plantsListHtml}
                        </div>
                    </div>` : ''}

                    <!-- V10：④ 終端設備 -->
                    ${this.sectionHeader(4, _t('cooling.sec4Title', null, '終端設備（CDU、CRAH）'), _t('cooling.sec4Desc', null, '每個單元機房內的 CDU 與 CRAH／風牆。相同的 DU 可以選一個設好，再按「套用到所有 DU」。'), this.terminalStatus(targets))}
                    ${this.renderTerminalTable(targets)}

                    <!-- 全廠冷卻配置狀態導覽條 (Plant Overview Bar)：V10 Phase 8 起由終端設備總表取代，預設收合 -->
                    ${this.collapsible('overviewBar', _t('cooling.overviewCompleted', { done: targets.length - attentionCount, total: targets.length }, `已完成: ${targets.length - attentionCount} / ${targets.length}`), `
                    <div class="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 space-y-3">
                        <div class="flex justify-between items-center text-xs font-bold text-slate-600 border-b pb-2">
                            <span>${_t('cooling.overviewBar', null, '全廠冷卻單元即時狀態總覽 (點擊可快速展開並定位至該單元)')}</span>
                            <span class="text-slate-400 font-normal">${_t('cooling.overviewCompleted', { done: targets.length - attentionCount, total: targets.length }, `已完成: ${targets.length - attentionCount} / ${targets.length}`)}</span>
                        </div>
                        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                            ${overviewPillsHtml}
                        </div>
                    </div>`)}

                    <!-- V10：⑤ 各單元細節 -->
                    ${this.sectionHeader(5, _t('cooling.sec5Title', null, '各單元細節'), _t('cooling.sec5Desc', null, '只有例外才需要展開：某個單元要獨立設定水溫、或沒有加入共用機房時的設備選型。'), this.secStatus(attentionCount === 0, attentionCount === 0 ? _t('cooling.secAllOk', null, '全部合格') : _t('cooling.secNeedFix', { n: attentionCount }, `${attentionCount} 個單元需調整`)))}

                    <!-- 逐單元智慧折疊列表 -->
                    <div class="space-y-6">
                        ${unitsListHtml}
                    </div>

                    <!-- 卡關防呆警示列 -->
                    ${proceedAlert}

                    <div class="flex justify-between pt-2">
                        <button onclick="window.App.prevStep()" class="px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm rounded-xl transition">
                            <span>←</span> ${_t('cooling.prevStep', null, '上一步: CorePOD 設計')}
                        </button>
                        
                        <button onclick="window.App.nextStep()"
                            class="px-6 py-3 ${proceedStatus.ok ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'bg-amber-500 hover:bg-amber-600 text-white'} cursor-pointer shadow-md font-black text-sm rounded-xl transition flex items-center gap-2">
                            ${proceedStatus.ok ? `<span class="inline-flex items-center gap-1.5"><i data-lucide="bar-chart-2" class="w-4 h-4"></i><span>${_t('cooling.nextStepOk', null, '計算並檢視 8,760h PUE / WUE 成果儀表板')}</span></span>` : `<span class="inline-flex items-center gap-1.5"><i data-lucide="alert-triangle" class="w-4 h-4"></i><span>${_t('cooling.nextStepWarn', null, '選型有不合格項目，仍可檢視儀表板（結果會標示不合格）')}</span></span>`}
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
                    if (selStart !== null && selEnd !== null && typeof el.setSelectionRange === 'function') {
                        try { el.setSelectionRange(selStart, selEnd); } catch (_) {}
                    }
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
            const cduPlant = cduSys.plantId ? (window.AppStore?.state?.coolingPlants || []).find(p => p.id === cduSys.plantId) : null;
            const fwPlant = fwSys.plantId ? (window.AppStore?.state?.coolingPlants || []).find(p => p.id === fwSys.plantId) : null;
            const cduArchLabel = cduPlant ? `${cduPlant.name} (${_t('cooling.sharedBadge', null, '共用')})` : (cduArchDesc ? cduArchDesc.cardLabel : cduArch);
            const fwArchLabel = fwPlant ? `${fwPlant.name} (${_t('cooling.sharedBadge', null, '共用')})` : (fwArchDesc ? fwArchDesc.cardLabel : fwArch);

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
                                ${_t('cooling.liquidLabel', null, '液冷:')} <strong class="text-purple-900">${cduArchLabel}</strong> &middot;
                                ${_t('cooling.airLabel', null, '氣冷:')} <strong class="text-indigo-900">${fwArchLabel}</strong>
                            </div>
                        </div>
                    </div>
                    <div class="flex items-center gap-2">
                        <button onclick="ViewCooling.toggleExpand('${targetId}')" class="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition flex items-center gap-1 shadow-2xs">
                            <span>${_t('cooling.expandDetails', null, '展開詳細選型 ▾')}</span>
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

            const title = archDesc.paramPanelTitle || (archDesc.paramPanel && archDesc.paramPanel.title) || _t('cooling.archParamTitle', { arch: archDesc.cardLabel }, `${archDesc.cardLabel} 專屬參數:`);
            const noteObj = typeof archDesc.paramPanelNote === 'function'
                ? archDesc.paramPanelNote(sys)
                : (archDesc.paramPanel && typeof archDesc.paramPanel.note === 'function' ? archDesc.paramPanel.note(sys) : null);
            const updateFn = sysType === 'fw' ? `ViewCooling.updateFwParams('${targetId}')` : `ViewCooling.updateCduParams('${targetId}')`;

            const inputsHtml = customParams.map(p => {
                const id = (p.idPrefix || (p.key + '_')) + targetId;
                if (p.type === 'boolean') {
                    const checked = sys[p.key] !== undefined ? !!sys[p.key] : (p.default !== undefined ? !!p.default : false);
                    let freezeNotice = '';
                    if (p.key === 'hasPhe' && checked && ['dry_cooler_pure', 'dry_cooler_trim', 'adiabatic_tower'].includes(archDesc.id)) {
                        const dc = (typeof window !== 'undefined' && window.AppStore) ? window.AppStore.designConditions() : null;
                        const freezeDb = dc?.freezeDb;
                        if (freezeDb && Number.isFinite(freezeDb.value)) {
                            const riskLimit = typeof A === 'function' ? A('freeze_risk_db_c') : 4.0;
                            const pheApp = sys.pheApproachC ?? 2.0;
                            if (freezeDb.value > riskLimit) {
                                freezeNotice = `<div class="text-[9.5px] text-slate-500 mt-1">${_t('cooling.freezeNoticeSafe', { db: freezeDb.value, app: pheApp }, `本案場 ASHRAE 50 年回歸最低乾球 ${freezeDb.value}°C，無結冰風險。若室外側使用防腐處理純水且不需壓力隔離，可取消 PHE，自然冷卻門檻可提高 ${pheApp}°C。`)}</div>`;
                            } else {
                                freezeNotice = `<div class="text-[9.5px] text-amber-700 font-medium mt-1 flex items-center gap-1"><i data-lucide="alert-triangle" class="w-3 h-3 shrink-0 text-amber-600"></i>${_t('cooling.freezeNoticeRisk', { db: freezeDb.value }, `本案場 50 年回歸最低乾球 ${freezeDb.value}°C，有結冰風險，室外側需防凍保護並保留 PHE 隔離。`)}</div>`;
                            }
                        }
                    }
                    return `                                            <div class="col-span-2 py-1">
                                                <div class="flex items-center gap-2">
                                                    <input type="checkbox" id="${id}" ${checked ? 'checked' : ''} onchange="${updateFn}" class="w-4 h-4 rounded text-sky-600 focus:ring-sky-500 border-slate-300">
                                                    <label for="${id}" class="text-xs font-bold text-slate-700 select-none cursor-pointer">${p.label || p.key}</label>
                                                </div>
                                                ${freezeNotice}
                                            </div>`;
                }
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

            const state = window.AppStore?.state || {};
            const unitRes = (state.results?.byDu || []).find(r => r.duId === t.id)
                || (state.results?.byCorePod || []).find(r => r.podId === t.id);
            const cduModeHours = unitRes?.cduModeHours;
            const fwModeHours = unitRes?.fwModeHours;
            const deficitHours = unitRes?.deficitHours;

            // P1-10: 唯讀存取，預設值已在 store.js / defaultCduSystem 補齊，不在此改寫 state
            const secSupplyC = cduSys.secSupplyC ?? 45.0;
            const secReturnC = cduSys.secReturnC ?? 57.0;
            const cduApproachC = cduSys.cduApproachC ?? 3.0;

            const cduArchDesc = window.CoolingArchRegistry ? window.CoolingArchRegistry.get(arch) : null;
            const dcApproach = cduSys.dryCoolerApproachC ?? 5.0;
            const defHasPhe = cduArchDesc?.params?.find(p => p.key === 'hasPhe')?.default ?? (cduArchDesc?.flags?.isTrim ? true : false);
            const hasPhe = cduSys.hasPhe !== undefined ? !!cduSys.hasPhe : defHasPhe;
            const pheApproach = hasPhe ? (cduSys.pheApproachC ?? 2.0) : 0.0;
            const fwsSupplyC = cduSys.fwsSupplyC ?? Number((secSupplyC - cduApproachC).toFixed(1));
            const cduFcThresh = (fwsSupplyC - dcApproach - pheApproach).toFixed(1);
            const mode1DbMax = parseFloat(cduFcThresh);
            const mode2DbMax = (mode1DbMax + 5.7).toFixed(1);

            // CDU 設備選型表格
            const cduPlant = cduSys.plantId ? (window.AppStore?.state?.coolingPlants || []).find(p => p.id === cduSys.plantId) : null;
            const fwPlant = fwSys.plantId ? (window.AppStore?.state?.coolingPlants || []).find(p => p.id === fwSys.plantId) : null;
            const cduSizingList = cduPlant
                ? (cduSys.sizing || []).filter(s => s.role === 'terminal' || s.key === 'cdu_unit')
                : (cduSys.sizing || []);
            const fwSizingList = fwPlant
                ? (fwSys.sizing || []).filter(s => s.role === 'terminal' || s.key === 'crah_unit' || s.key === 'rdhx_unit')
                : (fwSys.sizing || []);

            let cduSizingHtml = '';
            cduSizingList.forEach(item => {
                let modelOptions = '';
                item.catalog.forEach(cat => {
                    const vendorPrefix = cat.vendor ? '[' + cat.vendor + '] ' : '';
                    modelOptions += '<option value="' + cat.model + '" ' + (cat.model === item.selectedModel ? 'selected' : '') + '>' + ViewCooling.favMark(item.key, cat.model) + vendorPrefix + cat.model + ' (' + cat.capKw + ' kW)</option>';
                });

                const effCap = item.effectiveCapKw !== undefined ? item.effectiveCapKw : (item.selectedQty * item.unitCapKw);
                const isTrimChiller = item.key === 'trim_chiller';
                const marginPct = (item.requiredKw > 0) ? (((effCap / item.requiredKw) - 1) * 100) : 0;
                let marginBadge = '';
                if (marginPct < 0) {
                    marginBadge = `<span class="px-2 py-0.5 bg-red-100 text-red-700 text-[10px] font-black rounded-md border border-red-200">${_t('cooling.margin', { sign: '', pct: marginPct.toFixed(1) }, `餘度: ${marginPct.toFixed(1)}%`)}</span>`;
                } else if (marginPct < 10) {
                    marginBadge = `<span class="px-2 py-0.5 bg-amber-100 text-amber-800 text-[10px] font-black rounded-md border border-amber-200">${_t('cooling.margin', { sign: '+', pct: marginPct.toFixed(1) }, `餘度: +${marginPct.toFixed(1)}%`)}</span>`;
                } else {
                    marginBadge = `<span class="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-black rounded-md border border-emerald-200">${_t('cooling.margin', { sign: '+', pct: marginPct.toFixed(1) }, `餘度: +${marginPct.toFixed(1)}%`)}</span>`;
                }

                let badge = '';
                if (item.selectedQty === 0) {
                    badge = `<span class="inline-flex items-center gap-1.5 px-2 py-0.5 bg-slate-100 text-slate-600 text-[10px] font-bold rounded-md border border-slate-300"><span class="w-1.5 h-1.5 rounded-full bg-slate-400 shrink-0"></span>${_t('cooling.statusNoEquip', null, '尚未選型')}</span>`;
                } else if (item.passed) {
                    const red = item.redundancy || 'N+1';
                    const passText = (red === 'N+1')
                        ? _t('cooling.statusPassed', null, '滿足 N+1')
                        : _t('cooling.statusPassedRedundancy', { redundancy: red }, `滿足 ${red}`);
                    badge = `<span class="inline-flex items-center gap-1.5 px-2 py-0.5 bg-emerald-50 text-emerald-800 text-[10px] font-bold rounded-md border border-emerald-200"><span class="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></span>${passText}</span>`;
                } else if ((item.key === 'cdu_pump' || item.key === 'fw_pump' || item.role === 'pump') && item.selectedQty >= 2 && item.requiredKw > (item.effectiveCapKw ?? 0)) {
                    badge = `<span class="inline-flex items-center gap-1.5 px-2 py-0.5 bg-red-50 text-red-800 text-[10px] font-bold rounded-md border border-red-200"><span class="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0"></span>${_t('cooling.pumpMotorDeficit', null, '泵浦馬達功率不足')}</span>`;
                } else {
                    badge = `<span class="inline-flex items-center gap-1.5 px-2 py-0.5 bg-red-50 text-red-800 text-[10px] font-bold rounded-md border border-red-200"><span class="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0"></span>${_t('cooling.statusDeficit', null, '容量不足')}</span>`;
                }

                const red = item.redundancy || 'N+1';
                const standbyLbl = (typeof SizingEngine !== 'undefined' && typeof SizingEngine.standbyLabel === 'function')
                    ? SizingEngine.standbyLabel(red)
                    : (red === 'N' ? 'N' : (red === 'N+2' ? 'N-2' : (red === '2N' ? '2N' : 'N-1')));
                const effCapLabel = (standbyLbl === 'N-1')
                    ? _t('cooling.effectiveCap', null, '有效容量 (N-1):')
                    : _t('cooling.effectiveCapRedundancy', { label: standbyLbl }, `有效容量 (${standbyLbl}):`);

                cduSizingHtml += `
                    <div class="p-3 bg-slate-50 rounded-xl border ${item.passed ? 'border-slate-200' : 'border-red-300 bg-red-50/40'} space-y-2 text-xs">
                        <div class="flex justify-between items-center">
                            <div>
                                <span class="font-bold text-slate-900 text-sm">${item.label}</span>
                                <div class="text-xs text-slate-500 mt-1">${_t('cooling.sysDemand', null, '系統需求:')} <strong class="text-slate-900 font-bold bg-white px-1.5 py-0.5 rounded border border-slate-200">${item.requiredText}</strong></div>
                            </div>
                            <div class="flex items-center gap-1.5">
                                ${marginBadge}
                                ${badge}
                            </div>
                        </div>
                        <div class="grid grid-cols-3 gap-2 pt-1">
                            <div class="col-span-2">
                                <label class="block text-[9px] text-slate-400 font-bold mb-0.5">${_t('cooling.customModel', null, '自選型號 (真實設備型錄庫)')}</label>
                                <select onchange="ViewCooling.changeModel('${targetId}', 'cdu', '${item.key}', this.value)" class="w-full text-xs font-bold border rounded-lg p-1.5 bg-white text-slate-800">
                                    ${modelOptions}
                                </select>
                            </div>
                            <div>
                                <label class="block text-[9px] text-slate-400 font-bold mb-0.5">${_t('cooling.selectedQty', null, '選定台數 (含備用)')}</label>
                                <input type="number" min="1" max="999" id="qty_cdu_${targetId}_${item.key}" value="${item.selectedQty}" onchange="ViewCooling.changeQty('${targetId}', 'cdu', '${item.key}', this.value)" class="w-full text-xs font-black border rounded-lg p-1.5 bg-white text-purple-950 text-center">
                            </div>
                        </div>
                        ${ViewCooling.equipToolsHtml(targetId, 'cdu', item)}
                        <div class="text-[10px] flex justify-between text-slate-400 pt-0.5 border-t border-slate-200">
                            <span>${_t('cooling.totalCap', null, '總容量:')} ${(item.selectedQty * item.unitCapKw).toFixed(1)} kW</span>
                            <span>${effCapLabel} <strong class="${item.passed ? 'text-emerald-700 font-bold' : 'text-red-600 font-bold'}">${effCap.toFixed(1)} kW</strong></span>
                        </div>
                        ${isTrimChiller && item.maxMechanicalKw !== undefined ? `
                        <div class="text-[10px] flex justify-between items-center pt-1.5 mt-1 border-t border-dashed border-slate-300">
                            <span class="text-slate-500 inline-flex items-center gap-1"><i data-lucide="info" class="w-3 h-3 text-slate-400 shrink-0"></i>${_t('cooling.mode3MaxDemand', { maxKw: item.maxMechanicalKw.toFixed(0) }, `若進入 Mode 3 全機械製冷，最大需求 <strong class="text-slate-700">${item.maxMechanicalKw.toFixed(0)} kW</strong>`)}</span>
                            <span class="${item.maxMechanicalPassed ? 'text-emerald-700' : 'text-red-600'} font-bold">${item.maxMechanicalPassed ? _t('cooling.mode3AvailOk', null, '✓ N+1可用容量足夠') : _t('cooling.mode3AvailFail', null, '✗ N+1可用容量不足！')}</span>
                        </div>
                        <div class="text-[9px] text-slate-400">${_t('cooling.mode3Note', null, '上方「滿足N+1」以年最高乾球修整負載為基準；若進入 Mode 3 全機械製冷（乾冷器完全無法預冷），需求為 100% 液冷負載，此項僅供參考，實際請以 Dashboard 容量缺口小時為準')}</div>
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
            const fwTopoDiagram = window.CoolingSchematics ? window.CoolingSchematics.render(fwSchematic, { t, fwSys, fwArch, fwModeHours, deficitHours }) : '';

            // Fanwall / RDHX 設備選型表格
            let fwSizingHtml = '';
            fwSizingList.forEach(item => {
                let modelOptions = '';
                item.catalog.forEach(cat => {
                    const vendorPrefix = cat.vendor ? '[' + cat.vendor + '] ' : '';
                    modelOptions += '<option value="' + cat.model + '" ' + (cat.model === item.selectedModel ? 'selected' : '') + '>' + ViewCooling.favMark(item.key, cat.model) + vendorPrefix + cat.model + ' (' + cat.capKw + ' kW)</option>';
                });

                const effCap = item.effectiveCapKw !== undefined ? item.effectiveCapKw : (item.selectedQty * item.unitCapKw);
                const marginPct = (item.requiredKw > 0) ? (((effCap / item.requiredKw) - 1) * 100) : 0;
                let marginBadge = '';
                if (marginPct < 0) {
                    marginBadge = `<span class="px-2 py-0.5 bg-red-100 text-red-700 text-[10px] font-black rounded-md border border-red-200">${_t('cooling.margin', { sign: '', pct: marginPct.toFixed(1) }, `餘度: ${marginPct.toFixed(1)}%`)}</span>`;
                } else if (marginPct < 10) {
                    marginBadge = `<span class="px-2 py-0.5 bg-amber-100 text-amber-800 text-[10px] font-black rounded-md border border-amber-200">${_t('cooling.margin', { sign: '+', pct: marginPct.toFixed(1) }, `餘度: +${marginPct.toFixed(1)}%`)}</span>`;
                } else {
                    marginBadge = `<span class="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-black rounded-md border border-emerald-200">${_t('cooling.margin', { sign: '+', pct: marginPct.toFixed(1) }, `餘度: +${marginPct.toFixed(1)}%`)}</span>`;
                }

                let badge = '';
                if (item.selectedQty === 0) {
                    badge = `<span class="inline-flex items-center gap-1.5 px-2 py-0.5 bg-slate-100 text-slate-600 text-[10px] font-bold rounded-md border border-slate-300"><span class="w-1.5 h-1.5 rounded-full bg-slate-400 shrink-0"></span>${_t('cooling.statusNoEquip', null, '尚未選型')}</span>`;
                } else if (item.passed) {
                    const red = item.redundancy || 'N+1';
                    const passText = (red === 'N+1')
                        ? _t('cooling.statusPassed', null, '滿足 N+1')
                        : _t('cooling.statusPassedRedundancy', { redundancy: red }, `滿足 ${red}`);
                    badge = `<span class="inline-flex items-center gap-1.5 px-2 py-0.5 bg-emerald-50 text-emerald-800 text-[10px] font-bold rounded-md border border-emerald-200"><span class="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></span>${passText}</span>`;
                } else if ((item.key === 'cdu_pump' || item.key === 'fw_pump' || item.role === 'pump') && item.selectedQty >= 2 && item.requiredKw > (item.effectiveCapKw ?? 0)) {
                    badge = `<span class="inline-flex items-center gap-1.5 px-2 py-0.5 bg-red-50 text-red-800 text-[10px] font-bold rounded-md border border-red-200"><span class="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0"></span>${_t('cooling.pumpMotorDeficit', null, '泵浦馬達功率不足')}</span>`;
                } else {
                    badge = `<span class="inline-flex items-center gap-1.5 px-2 py-0.5 bg-red-50 text-red-800 text-[10px] font-bold rounded-md border border-red-200"><span class="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0"></span>${_t('cooling.statusDeficit', null, '容量不足')}</span>`;
                }

                const red = item.redundancy || 'N+1';
                const standbyLbl = (typeof SizingEngine !== 'undefined' && typeof SizingEngine.standbyLabel === 'function')
                    ? SizingEngine.standbyLabel(red)
                    : (red === 'N' ? 'N' : (red === 'N+2' ? 'N-2' : (red === '2N' ? '2N' : 'N-1')));
                const effCapLabel = (standbyLbl === 'N-1')
                    ? _t('cooling.effectiveCap', null, '有效容量 (N-1):')
                    : _t('cooling.effectiveCapRedundancy', { label: standbyLbl }, `有效容量 (${standbyLbl}):`);

                fwSizingHtml += `
                    <div class="p-3 bg-slate-50 rounded-xl border ${item.passed ? 'border-slate-200' : 'border-red-300 bg-red-50/40'} space-y-2 text-xs">
                        <div class="flex justify-between items-center">
                            <div>
                                <span class="font-bold text-slate-900 text-sm">${item.label}</span>
                                <div class="text-xs text-slate-500 mt-1">${_t('cooling.sysDemand', null, '系統需求:')} <strong class="text-slate-900 font-bold bg-white px-1.5 py-0.5 rounded border border-slate-200">${item.requiredText}</strong></div>
                            </div>
                            <div class="flex items-center gap-1.5">
                                ${marginBadge}
                                ${badge}
                            </div>
                        </div>
                        <div class="grid grid-cols-3 gap-2 pt-1">
                            <div class="col-span-2">
                                <label class="block text-[9px] text-slate-400 font-bold mb-0.5">${_t('cooling.customModel', null, '自選型號 (真實設備型錄庫)')}</label>
                                <select onchange="ViewCooling.changeModel('${targetId}', 'fanwall', '${item.key}', this.value)" class="w-full text-xs font-bold border rounded-lg p-1.5 bg-white text-slate-800">
                                    ${modelOptions}
                                </select>
                            </div>


                            <div>
                                <label class="block text-[9px] text-slate-400 font-bold mb-0.5">${_t('cooling.selectedQty', null, '選定台數 (含備用)')}</label>
                                <input type="number" min="1" max="999" id="qty_fw_${targetId}_${item.key}" value="${item.selectedQty}" onchange="ViewCooling.changeQty('${targetId}', 'fanwall', '${item.key}', this.value)" class="w-full text-xs font-black border rounded-lg p-1.5 bg-white text-indigo-950 text-center">
                            </div>
                        </div>
                        ${ViewCooling.equipToolsHtml(targetId, 'fanwall', item)}
                        <div class="text-[10px] flex justify-between text-slate-400 pt-0.5 border-t border-slate-200">
                            <span>${_t('cooling.totalCap', null, '總容量:')} ${(item.selectedQty * item.unitCapKw).toFixed(1)} kW</span>
                            <span>${effCapLabel} <strong class="${item.passed ? 'text-emerald-700 font-bold' : 'text-red-600 font-bold'}">${effCap.toFixed(1)} kW</strong></span>
                        </div>
                    </div>
                `;
            });

            // SVG 拓樸圖 — 工業級 P&ID 一二次側物理分離雙閉環拓樸
            const cduSchematic = (cduArchDesc && cduArchDesc.schematic) ? cduArchDesc.schematic : 'series_trim';
            const cduTopoDiagram = window.CoolingSchematics ? window.CoolingSchematics.render(cduSchematic, { t, cduSys, arch, cduModeHours, deficitHours }) : '';

            const safeName = window.UIKit ? window.UIKit.escapeHTML(t.name) : t.name;
            return `
                <div id="unit_${targetId}" class="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden space-y-6 p-6">
                    <!-- 單元標題列 -->
                    <div class="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-200 gap-2">
                        <div class="flex items-center gap-3">
                            <span class="w-8 h-8 rounded-xl bg-purple-100 text-purple-800 flex items-center justify-center shadow-2xs"><i data-lucide="building-2" class="w-4 h-4"></i></span>
                            <div>
                                <h3 class="text-base font-black text-slate-900">${safeName}</h3>
                                <div class="text-xs text-slate-500">${_t('cooling.itCapacity', null, 'IT 容量:')} <strong>${t.summ.totalItKw.toFixed(1)} kW</strong> &middot; ${_t('cooling.liquidHeatLoadLabel', null, '液冷散熱量:')} <strong class="text-purple-700">${t.summ.liquidHeatKw.toFixed(1)} kW (${t.summ.dlcPct.toFixed(1)}%)</strong> &middot; ${_t('cooling.airHeatLoadLabel', null, '氣冷廢熱:')} <strong class="text-indigo-700">${t.summ.airHeatKw.toFixed(1)} kW</strong></div>
                            </div>
                        </div>
                        <div class="flex items-center gap-2">
                            ${t.statusBadge}
                            <button onclick="ViewCooling.toggleExpand('${targetId}')" class="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold rounded-lg transition">
                                <span>${_t('cooling.collapseDetails', null, '收合 ▴')}</span>
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
                                        <i data-lucide="droplets" class="w-4 h-4 text-purple-600"></i> ${_t('cooling.sys1Title', null, '系統 1: CDU 液冷排熱系統 (白區液冷)')}
                                    </h4>
                                    <div class="text-[11px] text-slate-500">${_t('cooling.sys1Desc', null, '專門處理晶片高溫液冷散熱 (一二次側水路物理完全隔離)')}</div>
                                </div>
                                <div class="flex items-center gap-2">
                                    <span class="px-2.5 py-1 bg-purple-100 text-purple-900 text-xs font-black rounded-lg border border-purple-200">
                                        ${_t('cooling.liquidHeatLoad', { kw: (cduSys.designBasis.liq_load_kw||0).toFixed(1) }, `${(cduSys.designBasis.liq_load_kw||0).toFixed(1)} kW 液冷負載`)}
                                    </span>
                                </div>
                            </div>

                            ${cduPlant ? `
                            <div class="p-3.5 bg-purple-100/70 rounded-xl border border-purple-300 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-2xs">
                                <div class="flex items-center gap-2">
                                    <span class="px-2 py-0.5 bg-purple-700 text-white font-black rounded text-[10px]">${_t('cooling.sharedBadge', null, '共用')}</span>
                                    <span class="font-bold text-purple-950">${_t('cooling.suppliedBy', { name: cduPlant.name, redundancy: cduPlant.redundancy || 'N+1' })}</span>
                                </div>
                                <button onclick="ViewCooling.scrollToPlant('${cduPlant.id}')" class="px-2.5 py-1 bg-white hover:bg-purple-50 text-purple-800 font-bold rounded-lg text-xs border border-purple-200 transition">
                                    ${_t('cooling.goToPlant', null, '前往群組調整 →')}
                                </button>
                            </div>
                            ${(() => {
                                const pFws = cduPlant.system?.fwsSupplyC ?? 42.0;
                                const cApp = cduSys.cduApproachC ?? 3.0;
                                const req = secSupplyC;
                                if (req < pFws + cApp) {
                                    return `
                                    <div class="p-3 bg-red-50 border-2 border-red-400 rounded-xl space-y-1 text-xs">
                                        <div class="font-black text-red-900 flex items-center gap-1.5">
                                            <i data-lucide="alert-triangle" class="w-4 h-4 text-red-600 shrink-0"></i>
                                            <span>${_t('cooling.tempIncompatible', { fws: pFws.toFixed(1), cduApp: cApp.toFixed(1), sup: (pFws + cApp).toFixed(1), req: req.toFixed(1) })}</span>
                                        </div>
                                    </div>
                                    `;
                                }
                                return '';
                            })()}
                            ` : `
                            <!-- 純乾冷器氣候不可行警示橫幅 (當案場夏季氣溫超出 FC 門檻時自動警示) -->
                            ${(() => {
                                const maxDb = window.AppStore?.state?.site?.stats?.maxDB ?? 38.0;
                                const fcThreshNum = parseFloat(cduFcThresh);
                                if (arch !== 'dry_cooler_pure' || maxDb <= fcThreshNum) return '';
                                return `
                            <div class="p-4 bg-amber-500/10 border-2 border-amber-500 rounded-xl space-y-2 text-xs">
                                <div class="flex items-center gap-2 font-black text-amber-900 text-sm">
                                    <i data-lucide="alert-triangle" class="w-4 h-4 text-amber-600 shrink-0"></i>
                                    <span>${_t('cooling.pureDcWarnTitle', null, '氣候超溫與無冰機備援警示 (Pure Dry Cooler Climate Risk)')}</span>
                                </div>
                                <div class="text-amber-950 font-medium leading-relaxed">
                                    ${_t('cooling.pureDcWarnDesc', { maxDb: maxDb.toFixed(1), thresh: cduFcThresh, peakSup: (maxDb + dcApproach + pheApproach).toFixed(1), designSup: cduSys.fwsSupplyC }, `當前案場氣候夏季氣溫（最高達 <strong>${maxDb.toFixed(1)}°C</strong>）高於純乾冷器自然冷卻門檻（<strong>${cduFcThresh}°C DB</strong>）。<br>\n                                    由於本架構 <strong>100% 零冰機且無任何補冷設備</strong>，夏季高溫時段設施供水將飆升至 <strong>${(maxDb + dcApproach + pheApproach).toFixed(1)}°C</strong>（超出設計 ${cduSys.fwsSupplyC}°C），可能導致晶片過熱降載！`)}
                                </div>
                                <div class="text-[11px] text-amber-800 flex items-center gap-1.5 font-bold pt-1">
                                    <span class="inline-flex items-center gap-1"><i data-lucide="lightbulb" class="w-3.5 h-3.5 text-amber-600"></i>${_t('cooling.suggestedFix', null, '建議方案：')}</span>
                                    <span>${_t('cooling.suggestedFixText', null, '切換為 <strong>「乾冷器 + Trim 冰機 (NVIDIA 推薦)」</strong>，或改用 <strong>「絕熱冷卻塔 / 密閉水塔」</strong> 即可確保全年不超溫。')}</span>
                                </div>
                            </div>
                            `;
                            })()}

                            <!-- CDU 架構選擇器 (整排清晰可見) -->
                            <div class="max-w-2xl">
                                <label class="block text-xs font-bold text-slate-700 mb-1">${_t('cooling.cduArchMode', null, 'CDU 排熱架構模式 (Architecture)')}</label>
                                <select onchange="ViewCooling.updateCduArch('${targetId}', this.value)" class="w-full text-xs font-black border-2 border-purple-300 rounded-xl p-2.5 bg-white text-purple-950 shadow-2xs">
                                    ${(window.CoolingArchRegistry ? window.CoolingArchRegistry.list('liquid') : []).map(arch => {
                                        const isSelected = (cduSys.architecture === arch.id) || (arch.aliases && arch.aliases.includes(cduSys.architecture));
                                        return `<option value="${arch.id}" ${isSelected ? 'selected' : ''}>${arch.optionLabel}</option>`;
                                    }).join('\n                                    ')}
                                </select>
                            </div>

                            <!-- 全寬拓樸圖 SVG (獲得完整呼吸空間與極致視覺) -->
                            ${ViewCooling.collapsible('schem_cdu_' + targetId, _t('cooling.showSchematic', null, '系統示意圖'), cduTopoDiagram)}
                            `}

                            <!-- 下方 2 欄子面板: 水溫設定 (左) + 設備選型清單 (右) -->
                            <div class="grid grid-cols-1 lg:grid-cols-2 gap-5 pt-1">
                                <!-- 雙迴路供回水溫設定 -->
                                <div class="p-4 bg-white rounded-xl border border-slate-200 space-y-3 shadow-2xs">
                                    <div class="flex justify-between items-center border-b border-slate-100 pb-2">
                                        <span class="text-xs font-bold text-slate-800">${_t('cooling.tempSettingsTitle', null, '一二次側雙迴路水溫鏈設定')}</span>
                                        <div class="flex items-center gap-1.5">
                                            <button onclick="ViewCooling.applyCduPreset('${targetId}', 'nvidia')" class="px-2 py-0.5 bg-purple-100 hover:bg-purple-200 text-purple-900 text-[10px] font-extrabold rounded">${_t('cooling.presetNvidia', null, 'NVIDIA 基準')}</button>
                                            <button onclick="ViewCooling.applyCduPreset('${targetId}', 'site')" class="px-2 py-0.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-900 text-[10px] font-extrabold rounded">${_t('cooling.presetSite', null, '案場慣用值')}</button>
                                        </div>
                                    </div>

                                    <!-- 二次側 (晶片側) -->
                                    <div class="p-2.5 bg-purple-50/60 rounded-lg border border-purple-200 space-y-1.5">
                                        <div class="flex justify-between items-center">
                                            <span class="text-[10px] font-extrabold text-purple-900">${_t('cooling.secSideTitle', null, '二次側 (晶片側 / IT ↔ CDU):')}</span>
                                            <span class="text-[9px] text-purple-600 font-bold">${_t('cooling.chipDeltaT', { dt: (secReturnC - secSupplyC).toFixed(1) }, `晶片溫升 ΔT = ${(secReturnC - secSupplyC).toFixed(1)}°C`)}</span>
                                        </div>
                                        <div class="grid grid-cols-3 gap-2">
                                            <div>
                                                <label class="block text-[9px] text-slate-500">${_t('cooling.chipSupply', null, '晶片供水 (°C)')}</label>
                                                <input type="number" id="cduSecSupplyIn_${targetId}" value="${secSupplyC}" step="0.5" onchange="ViewCooling.updateCduParams('${targetId}')" class="w-full text-xs font-bold border rounded p-1 bg-white text-purple-950">
                                            </div>
                                            <div>
                                                <label class="block text-[9px] text-slate-500">${_t('cooling.chipReturn', null, '晶片回水 (°C)')}</label>
                                                <input type="number" id="cduSecReturnIn_${targetId}" value="${secReturnC}" step="0.5" onchange="ViewCooling.updateCduParams('${targetId}')" class="w-full text-xs font-bold border rounded p-1 bg-white text-purple-950">
                                            </div>
                                            <div>
                                                <label class="block text-[9px] text-slate-500">${_t('cooling.cduApproach', null, 'CDU Approach (°C)')}</label>
                                                <input type="number" id="cduAppIn_${targetId}" value="${cduApproachC}" step="0.5" onchange="ViewCooling.updateCduParams('${targetId}')" class="w-full text-xs font-bold border rounded p-1 bg-white text-slate-800">
                                            </div>
                                        </div>
                                    </div>

                                    ${cduPlant ? `
                                    <div class="p-3 bg-slate-100 rounded-lg text-xs text-slate-600 border border-slate-200">
                                        <div class="font-bold text-slate-800">${_t('cooling.plantUnifiedConfig', { name: cduPlant.name })}</div>
                                        <div class="text-[11px] text-slate-500 mt-1">FWS: ${(cduPlant.system?.fwsSupplyC ?? 42).toFixed(1)}°C &middot; FWR: ${(cduPlant.system?.fwsReturnC ?? 54).toFixed(1)}°C &middot; Approach: ${(cduPlant.system?.dryCoolerApproachC ?? 5).toFixed(1)}°C</div>
                                    </div>
                                    ` : `
                                    <!-- 一次側 (設施側 / CDU ↔ 排熱端) -->
                                    <div class="p-2.5 bg-teal-50/60 rounded-lg border border-teal-200 space-y-1.5">
                                        <div class="flex justify-between items-center">
                                            <span class="text-[10px] font-extrabold text-teal-900">${_t('cooling.priSideTitle', null, '一次側 (設施側 / CDU ↔ 排熱端):')}</span>
                                            <span class="text-[9px] text-teal-700 font-bold inline-flex items-center gap-1"><i data-lucide="zap" class="w-3 h-3 text-teal-600"></i>${_t('cooling.fwsAutoLinked', null, 'FWS 供回水由 CDU Approach 自動連動推算')}</span>
                                        </div>
                                        <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                            <div>
                                                <label class="block text-[9px] text-slate-500">${_t('cooling.fwsSupply', null, '設施供水 FWS (°C)')}</label>
                                                <div class="w-full text-xs font-black border border-teal-300 rounded p-1 bg-teal-100/70 text-teal-950 flex items-center justify-between">
                                                    <span>${cduSys.fwsSupplyC}°C</span>
                                                    <span class="text-[8px] text-teal-700 font-normal">${_t('cooling.auto', null, '自動')}</span>
                                                </div>
                                            </div>
                                            <div>
                                                <label class="block text-[9px] text-slate-500">${_t('cooling.fwsReturn', null, '設施回水 FWR (°C)')}</label>
                                                <div class="w-full text-xs font-black border border-teal-300 rounded p-1 bg-teal-100/70 text-teal-950 flex items-center justify-between">
                                                    <span>${cduSys.fwsReturnC}°C</span>
                                                    <span class="text-[8px] text-teal-700 font-normal">${_t('cooling.auto', null, '自動')}</span>
                                                </div>
                                            </div>
                                            <div>
                                                <label class="block text-[9px] text-slate-500">${_t('cooling.rejApproach', null, '排熱端 Approach (°C)')}</label>
                                                <input type="number" id="cduApproachIn_${targetId}" value="${dcApproach}" step="0.5" onchange="ViewCooling.updateCduParams('${targetId}')" class="w-full text-xs font-bold border rounded p-1 bg-white text-slate-800">
                                            </div>
                                            ${hasPhe ? `
                                            <div>
                                                <label class="block text-[9px] text-slate-500">${_t('cooling.pheApproach', null, '板換 (PHE) Approach (°C)')}</label>
                                                <input type="number" id="cduPheAppIn_${targetId}" value="${cduSys.pheApproachC ?? 2.0}" step="0.5" onchange="ViewCooling.updateCduParams('${targetId}')" class="w-full text-xs font-bold border rounded p-1 bg-white text-slate-800">
                                            </div>` : `
                                            <div>
                                                <label class="block text-[9px] text-slate-400">${_t('cooling.pheIsolation', null, '板換 (PHE) 隔離')}</label>
                                                <div class="w-full text-xs font-medium border border-slate-200 rounded p-1 bg-slate-100 text-slate-400 flex items-center justify-between">
                                                    <span>${_t('cooling.noPheDirect', null, '無板換 (直冷)')}</span>
                                                    <span class="text-[8px] text-slate-400 font-normal">0.0°C</span>
                                                </div>
                                            </div>`}
                                        </div>
                                    </div>

                                    ${this.renderArchParamPanel(cduArchDesc, cduSys, targetId, 'cdu')}

                                    <div class="p-2.5 bg-emerald-50 rounded-lg border border-emerald-200 text-xs text-emerald-950 flex justify-between items-center">
                                        <div>
                                            <span class="font-bold text-[11px]">${_t('cooling.fcThreshFormula', null, 'Free Cooling 門檻 (以本頁水溫與 Approach 物理動態推算):')}</span>
                                            <div class="text-[10px] text-emerald-700">
                                                T_fc = ${cduSys.fwsSupplyC}°C (FWS) − ${dcApproach}°C (${_t('cooling.dryCoolerAbbr', null, '乾冷器')}) ${pheApproach > 0 ? ('− ' + pheApproach + '°C (' + _t('cooling.pheAbbr', null, '板換') + ')') : ''} = <strong class="text-xs font-black text-emerald-900">${cduFcThresh}°C DB</strong>
                                            </div>
                                        </div>
                                        <span class="px-1.5 py-0.5 bg-white text-emerald-900 border border-emerald-300 rounded font-black text-[9px]">${_t('cooling.physicsLinked', null, '物理連動')}</span>
                                    </div>

                                    <div class="p-2.5 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
                                        <div class="flex justify-between items-center">
                                            <label class="block text-[10px] font-bold text-slate-700">${_t('cooling.pumpHeadM', null, '泵浦系統揚程 (m)')}</label>
                                            <span class="text-[9px] text-slate-400">${_t('cooling.pumpHeadEstimate', null, '概估值，請依管路壓損計算覆寫')}</span>
                                        </div>
                                        <input type="number" id="cduPumpHeadIn_${targetId}" value="${cduSys.pumpHeadM ?? ((typeof A === 'function') ? A('cdu_pump_head_default_m') : 28)}" min="1" max="150" step="1" onchange="ViewCooling.updateCduParams('${targetId}')" class="w-full text-xs font-bold border rounded p-1.5 bg-white text-slate-800">
                                    </div>
                                    `}
                                </div>

                                <!-- Required vs Selected 選型表 -->
                                <div class="space-y-2.5">
                                    <span class="text-xs font-bold text-slate-700 uppercase flex items-center gap-1.5">
                                        <i data-lucide="settings-2" class="w-3.5 h-3.5 text-slate-500"></i> ${_t('cooling.cduEquipSizingTitle', null, 'CDU 設備自選與 N+1 檢核 (專屬架構型錄庫)')}
                                    </span>
                                    <div class="space-y-2">
                                        ${ViewCooling.renderEquipTable(targetId, 'cdu', cduSizingList, 'qty_cdu_' + targetId + '_')}
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
                                        <i data-lucide="${isRdhx ? 'door-open' : 'wind'}" class="w-4 h-4 text-indigo-600"></i> ${_t('cooling.sys2Title', null, '系統 2: Fanwall/RDHX 氣冷排熱系統 (白區氣冷)')}
                                    </h4>
                                    <div class="text-[11px] text-slate-500">${_t('cooling.sys2Desc', null, '專門處理網通、儲存與機櫃輔助廢熱')}</div>
                                </div>
                                <span class="px-2.5 py-1 bg-indigo-100 text-indigo-900 text-xs font-black rounded-lg border border-indigo-200">
                                    ${_t('cooling.airHeatLoad', { kw: (fwSys.designBasis.air_load_kw||0).toFixed(1) }, `${(fwSys.designBasis.air_load_kw||0).toFixed(1)} kW 氣冷負載`)}
                                </span>
                            </div>

                            ${fwPlant ? `
                            <div class="p-3.5 bg-indigo-100/70 rounded-xl border border-indigo-300 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-2xs">
                                <div class="flex items-center gap-2">
                                    <span class="px-2 py-0.5 bg-indigo-700 text-white font-black rounded text-[10px]">${_t('cooling.sharedBadge', null, '共用')}</span>
                                    <span class="font-bold text-indigo-950">${_t('cooling.suppliedBy', { name: fwPlant.name, redundancy: fwPlant.redundancy || 'N+1' })}</span>
                                </div>
                                <button onclick="ViewCooling.scrollToPlant('${fwPlant.id}')" class="px-2.5 py-1 bg-white hover:bg-indigo-50 text-indigo-800 font-bold rounded-lg text-xs border border-indigo-200 transition">
                                    ${_t('cooling.goToPlant', null, '前往群組調整 →')}
                                </button>
                            </div>
                            ` : `
                            <!-- Fanwall / RDHX 架構選擇器 -->
                            <div class="max-w-2xl">
                                <label class="block text-xs font-bold text-slate-700 mb-1">${_t('cooling.fwArchMode', null, '氣冷 / 背板排熱架構模式 (Architecture)')}</label>
                                <select onchange="ViewCooling.updateFwArch('${targetId}', this.value)" class="w-full text-xs font-black border-2 border-indigo-300 rounded-xl p-2.5 bg-white text-indigo-950 shadow-2xs">
                                    ${(window.CoolingArchRegistry ? window.CoolingArchRegistry.list('air') : []).map(arch => {
                                        const isSelected = (fwSys.architecture === arch.id) || (arch.aliases && arch.aliases.includes(fwSys.architecture));
                                        return `<option value="${arch.id}" ${isSelected ? 'selected' : ''}>${arch.optionLabel}</option>`;
                                    }).join('\n                                    ')}
                                </select>
                            </div>

                            <!-- 全寬氣冷拓樸圖 SVG (系統 2 專屬拓樸圖) -->
                            ${ViewCooling.collapsible('schem_fw_' + targetId, _t('cooling.showSchematic', null, '系統示意圖'), fwTopoDiagram)}
                            `}

                            <!-- 下方 2 欄子面板: 水溫設定 (左) + 設備選型清單 (右) -->
                            <div class="grid grid-cols-1 lg:grid-cols-2 gap-5 pt-1">
                                <!-- 供回水溫設定與建議按鈕 -->
                                <div class="p-4 bg-white rounded-xl border border-slate-200 space-y-3 shadow-2xs">
                                    ${fwPlant ? `
                                    <div class="p-3 bg-slate-100 rounded-lg text-xs text-slate-600 border border-slate-200">
                                        <div class="font-bold text-slate-800">${_t('cooling.plantUnifiedConfig', { name: fwPlant.name })}</div>
                                        <div class="text-[11px] text-slate-500 mt-1">CHWS: ${(fwPlant.system?.chwSupplyC ?? 12).toFixed(1)}°C &middot; CHWR: ${(fwPlant.system?.chwReturnC ?? 18).toFixed(1)}°C</div>
                                    </div>
                                    ` : `
                                    <div class="flex justify-between items-center border-b border-slate-100 pb-2">
                                        <span class="text-xs font-bold text-slate-800">${_t('cooling.chwTempTitle', null, '冰水供回水溫 (CHW Supply / Return)')}</span>
                                        <div class="flex items-center gap-1.5">
                                            <button onclick="ViewCooling.applyFwTemps('${targetId}', 22, 32)" class="px-2 py-0.5 bg-indigo-100 hover:bg-indigo-200 text-indigo-900 text-[10px] font-extrabold rounded">${_t('cooling.fwPresetNvidia', null, 'NVIDIA 22/32°C')}</button>
                                            <button onclick="ViewCooling.applyFwTemps('${targetId}', 12, 18)" class="px-2 py-0.5 bg-teal-100 hover:bg-teal-200 text-teal-900 text-[10px] font-extrabold rounded">${_t('cooling.fwPresetSite', null, '案場寬溫 12/18°C')}</button>
                                        </div>
                                    </div>
                                    <div class="grid grid-cols-2 gap-3 pt-1">
                                        <div>
                                            <label class="block text-[9px] text-slate-500 mb-0.5">${_t('cooling.chwSupply', null, '供水溫 CHW Supply (°C)')}</label>
                                            <input type="number" id="fwSupplyIn_${targetId}" value="${fwSys.chwSupplyC}" step="0.5" onchange="ViewCooling.updateFwParams('${targetId}')" class="w-full text-xs font-bold border rounded-lg p-2 bg-white text-indigo-950">
                                        </div>
                                        <div>
                                            <label class="block text-[9px] text-slate-500 mb-0.5">${_t('cooling.chwReturn', null, '回水溫 CHW Return (°C)')}</label>
                                            <input type="number" id="fwReturnIn_${targetId}" value="${fwSys.chwReturnC}" step="0.5" onchange="ViewCooling.updateFwParams('${targetId}')" class="w-full text-xs font-bold border rounded-lg p-2 bg-white text-indigo-950">
                                        </div>
                                    </div>
                                    <div class="p-2.5 bg-indigo-50 rounded-lg border border-indigo-100 text-[11px] text-indigo-900 flex items-center gap-1.5">
                                        <i data-lucide="info" class="w-3.5 h-3.5 text-indigo-600 shrink-0"></i>
                                        <span>${_t('cooling.chillerDeltaTNote', { dt: Math.max(1, fwSys.chwReturnC - fwSys.chwSupplyC) }, `冰水主機溫差: <strong class="font-bold">${Math.max(1, fwSys.chwReturnC - fwSys.chwSupplyC)}°C</strong>，供水溫越高對冰機 COP 越有利。`)}</span>
                                    </div>
                                    ${this.renderArchParamPanel(fwArchDesc, fwSys, targetId, 'fw')}
                                    <div class="p-2.5 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
                                        <div class="flex justify-between items-center">
                                            <label class="block text-[10px] font-bold text-slate-700">${_t('cooling.pumpHeadM', null, '泵浦系統揚程 (m)')}</label>
                                            <span class="text-[9px] text-slate-400">${_t('cooling.pumpHeadEstimate', null, '概估值，請依管路壓損計算覆寫')}</span>
                                        </div>
                                        <input type="number" id="fwPumpHeadIn_${targetId}" value="${fwSys.pumpHeadM ?? ((typeof A === 'function') ? A('fw_pump_head_default_m') : 22)}" min="1" max="150" step="1" onchange="ViewCooling.updateFwParams('${targetId}')" class="w-full text-xs font-bold border rounded p-1.5 bg-white text-slate-800">
                                    </div>
                                    `}
                                </div>
                                </div>

                                <!-- Required vs Selected 選型表 -->
                                <div class="space-y-2.5">
                                    <span class="text-xs font-bold text-slate-700 uppercase flex items-center gap-1.5">
                                        <i data-lucide="sliders" class="w-4 h-4 text-slate-600"></i>
                                        <span>${isRdhx ? _t('cooling.rdhxEquipSizing', null, 'RDHX 設備自選與 N+1 檢核') : _t('cooling.fwEquipSizing', null, 'Fanwall 設備自選與 N+1 檢核')}</span>
                                    </span>
                                    <div class="space-y-2">
                                        ${ViewCooling.renderEquipTable(targetId, 'fanwall', fwSizingList, 'qty_fw_' + targetId + '_')}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        },

        renderPlantGroupingPanel(targets) {
            const state = window.AppStore.state;
            const plants = state.coolingPlants || [];
            const liqPlants = plants.filter(p => p.loop === 'liquid');
            const airPlants = plants.filter(p => p.loop === 'air');

            // 具有液冷/氣冷負載的單元
            const liqTargets = targets.filter(t => (t.summ.liquidHeatKw || 0) > 0);
            const airTargets = targets.filter(t => ((t.summ.airHeatKw || 0) + (t.summ.lossKw || 0)) > 0);

            const renderLoopColumn = (loop, loopPlants, loopTargets) => {
                const isLiquid = loop === 'liquid';
                const loopTitle = isLiquid ? _t('cooling.liquidLoop', null, '液冷迴路') : _t('cooling.airLoop', null, '氣冷迴路');
                const loopIcon = isLiquid ? 'droplets' : 'wind';
                const loopBadgeColor = isLiquid ? 'bg-purple-100 text-purple-900 border-purple-200' : 'bg-indigo-100 text-indigo-900 border-indigo-200';
                const addBtnText = isLiquid ? _t('cooling.addLiquidPlant', null, '+ 新增液冷系統') : _t('cooling.addAirPlant', null, '+ 新增氣冷系統');

                let plantsHtml = '';
                if (loopPlants.length === 0) {
                    plantsHtml = `<div class="p-3 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200 text-xs text-slate-400 font-medium">${_t('cooling.noPlantsInLoop', null, '目前無共用系統（所有單元獨立）')}</div>`;
                } else {
                    loopPlants.forEach(plant => {
                        const memberCount = (plant.memberIds || []).length;
                        const redundancy = plant.redundancy || 'N+1';
                        const diversity = plant.diversityFactor ?? 1.0;

                        // 成員勾選清單
                        const memberChecksHtml = loopTargets.map(t => {
                            const isChecked = (plant.memberIds || []).includes(t.id);
                            const otherPlant = !isChecked ? loopPlants.find(p => p.id !== plant.id && (p.memberIds || []).includes(t.id)) : null;
                            const otherBadge = otherPlant ? `<span class="text-[10px] text-slate-400 font-normal">${_t('cooling.belongsToOther', { name: otherPlant.name }, `(${otherPlant.name})`)}</span>` : '';
                            return `
                                <label class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium cursor-pointer transition ${isChecked ? 'bg-purple-50 border-purple-300 text-purple-900 shadow-2xs' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'}">
                                    <input type="checkbox" ${isChecked ? 'checked' : ''} onchange="ViewCooling.togglePlantMember('${plant.id}', '${t.id}')" class="rounded text-purple-600 focus:ring-purple-500">
                                    <span>${window.UIKit ? window.UIKit.escapeHTML(t.shortName) : t.shortName}</span>
                                    ${otherBadge}
                                </label>
                            `;
                        }).join('\n');

                        plantsHtml += `
                            <div class="p-4 bg-slate-50/80 rounded-xl border border-slate-200 space-y-3 shadow-2xs">
                                <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/60 pb-2.5">
                                    <div class="flex items-center gap-2 flex-wrap">
                                        <input type="text" id="plantNameIn_${plant.id}" value="${window.UIKit ? window.UIKit.escapeHTML(plant.name) : plant.name}" onchange="ViewCooling.renamePlant('${plant.id}', this.value)" onkeydown="if(event.key==='Enter')this.blur()" class="text-xs font-bold bg-white border border-slate-300 rounded px-2 py-1 text-slate-900 w-36 sm:w-44 focus:ring-1 focus:ring-purple-500" placeholder="${_t('cooling.plantName', null, '系統名稱')}">
                                        <select onchange="ViewCooling.changePlantRedundancy('${plant.id}', this.value)" class="text-xs font-bold bg-white border border-slate-300 rounded px-2 py-1 text-slate-800">
                                            <option value="N" ${redundancy === 'N' ? 'selected' : ''}>N</option>
                                            <option value="N+1" ${redundancy === 'N+1' ? 'selected' : ''}>N+1</option>
                                            <option value="N+2" ${redundancy === 'N+2' ? 'selected' : ''}>N+2</option>
                                            <option value="2N" ${redundancy === '2N' ? 'selected' : ''}>2N</option>
                                        </select>
                                        <div class="flex items-center gap-1 text-[11px] text-slate-600">
                                            <span>${_t('cooling.diversityFactor', null, '同時使用係數')}</span>
                                            <input type="number" id="plantDiversityIn_${plant.id}" step="0.05" min="0.5" max="1.2" value="${diversity}" onchange="ViewCooling.changePlantDiversity('${plant.id}', this.value)" onkeydown="if(event.key==='Enter')this.blur()" class="w-16 text-xs font-bold bg-white border border-slate-300 rounded px-1.5 py-0.5 text-slate-900 text-center">
                                        </div>
                                    </div>
                                    <div class="flex items-center gap-2 shrink-0">
                                        <button onclick="ViewCooling.scrollToPlant('${plant.id}')" class="px-2 py-1 text-[11px] font-bold bg-white hover:bg-slate-100 text-slate-700 rounded border border-slate-200 transition">
                                            ${_t('cooling.goToPlant', null, '前往群組調整 →')}
                                        </button>
                                        <button onclick="ViewCooling.deletePlant('${plant.id}')" class="px-2 py-1 text-[11px] font-bold text-red-600 hover:bg-red-50 rounded border border-red-200 transition">
                                            ${_t('common.delete', null, '刪除')}
                                        </button>
                                    </div>
                                </div>
                                <div class="space-y-1.5">
                                    <div class="text-[11px] font-bold text-slate-500 flex items-center justify-between">
                                        <span>${_t('cooling.membersCount', { n: memberCount }, `${memberCount} 成員`)}:</span>
                                    </div>
                                    <div class="flex flex-wrap gap-1.5">
                                        ${memberChecksHtml || `<span class="text-xs text-slate-400 font-medium">${_t('cooling.emptyPlant', null, '尚未加入任何成員單元')}</span>`}
                                    </div>
                                </div>
                            </div>
                        `;
                    });
                }

                // 獨立單元列表 (未加入此 loop 任何共用群組的單元)
                const assignedIds = new Set(loopPlants.flatMap(p => p.memberIds || []));
                const dedicatedTargets = loopTargets.filter(t => !assignedIds.has(t.id));
                const dedicatedPillsHtml = dedicatedTargets.map(t => `
                    <span class="px-2 py-0.5 bg-slate-100 text-slate-600 text-[11px] font-medium rounded border border-slate-200">${window.UIKit ? window.UIKit.escapeHTML(t.shortName) : t.shortName} (${_t('cooling.dedicatedUnit', null, '獨立')})</span>
                `).join(' ');

                return `
                    <div class="space-y-3">
                        <div class="flex items-center justify-between">
                            <span class="text-xs font-black text-slate-800 flex items-center gap-1.5">
                                <i data-lucide="${loopIcon}" class="w-3.5 h-3.5 text-slate-600"></i> ${loopTitle}
                            </span>
                            <span class="px-2 py-0.5 text-[10px] font-black rounded-full border ${loopBadgeColor}">
                                ${_t('cooling.membersCount', { n: loopPlants.length }, `${loopPlants.length} 群組`)}
                            </span>
                        </div>
                        <div class="space-y-3">
                            ${plantsHtml}
                        </div>
                        ${dedicatedTargets.length > 0 ? `
                        <div class="p-2.5 bg-slate-50/60 rounded-xl border border-slate-200/80 text-[11px] text-slate-500 space-y-1">
                            <div class="font-bold text-slate-700">${_t('cooling.dedicated', null, '獨立單元')} (${dedicatedTargets.length}):</div>
                            <div class="flex flex-wrap gap-1">${dedicatedPillsHtml}</div>
                        </div>
                        ` : ''}
                        <button onclick="ViewCooling.createNewPlant('${loop}')" class="w-full py-2 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-xl border border-dashed border-slate-300 transition flex items-center justify-center gap-1 shadow-2xs">
                            ${addBtnText}
                        </button>
                    </div>
                `;
            };

            const activePreset = this.detectActivePreset();
            const isDed = (activePreset === 'dedicated');
            const isSite = (activePreset === 'site_shared');
            const isHall = (activePreset === 'hall_grouped');

            const btnClsDedicated = isDed
                ? 'px-3 py-1.5 text-xs font-black bg-slate-800 text-white rounded-lg transition border border-slate-800 shadow-sm ring-2 ring-slate-400/50 flex items-center gap-1.5 cursor-pointer'
                : 'px-3 py-1.5 text-xs font-semibold bg-white hover:bg-slate-100 text-slate-600 rounded-lg transition border border-slate-200 shadow-2xs flex items-center gap-1.5 cursor-pointer';

            const btnClsSiteShared = isSite
                ? 'px-3 py-1.5 text-xs font-black bg-purple-700 text-white rounded-lg transition border border-purple-700 shadow-sm ring-2 ring-purple-300 flex items-center gap-1.5 cursor-pointer'
                : 'px-3 py-1.5 text-xs font-semibold bg-white hover:bg-purple-50 text-slate-600 hover:text-purple-700 rounded-lg transition border border-slate-200 shadow-2xs flex items-center gap-1.5 cursor-pointer';

            const btnClsHallGrouped = isHall
                ? 'px-3 py-1.5 text-xs font-black bg-indigo-700 text-white rounded-lg transition border border-indigo-700 shadow-sm ring-2 ring-indigo-300 flex items-center gap-1.5 cursor-pointer'
                : 'px-3 py-1.5 text-xs font-semibold bg-white hover:bg-indigo-50 text-slate-600 hover:text-indigo-700 rounded-lg transition border border-slate-200 shadow-2xs flex items-center gap-1.5 cursor-pointer';

            return `
                <div class="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-4">
                    <div class="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                        <div>
                            <h3 class="text-sm font-black text-slate-900 flex items-center gap-2">
                                <i data-lucide="network" class="w-4 h-4 text-purple-600"></i> ${_t('cooling.plantGroupingTitle', null, '冷卻系統分組')}
                            </h3>
                            <p class="text-xs text-slate-500 mt-0.5">${_t('cooling.plantGroupingSubtitle', null, '可為多個 DU / CorePOD 建立共用主機房設備群組，或個別採用獨立系統')}</p>
                        </div>
                        <div class="flex items-center gap-2 flex-wrap">
                            <span class="text-xs font-bold text-slate-600">${_t('cooling.quickConfig', null, '快速配置：')}</span>
                            <button type="button" onclick="ViewCooling.applyDedicatedConfig()" class="${btnClsDedicated}">
                                ${isDed ? '<i data-lucide="check" class="w-3.5 h-3.5 stroke-[3]"></i>' : ''}
                                ${_t('cooling.quickConfigDedicated', null, '每個單元獨立')}
                            </button>
                            <button type="button" onclick="ViewCooling.applySiteSharedConfig()" class="${btnClsSiteShared}">
                                ${isSite ? '<i data-lucide="check" class="w-3.5 h-3.5 stroke-[3]"></i>' : ''}
                                ${_t('cooling.quickConfigSiteShared', null, '整場共用一套')}
                            </button>
                            <button type="button" onclick="ViewCooling.applyHallGroupedConfig()" class="${btnClsHallGrouped}">
                                ${isHall ? '<i data-lucide="check" class="w-3.5 h-3.5 stroke-[3]"></i>' : ''}
                                ${_t('cooling.quickConfigHallGrouped', null, '依 Hall 分組')}
                            </button>
                        </div>
                    </div>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-6 pt-1">
                        ${renderLoopColumn('liquid', liqPlants, liqTargets)}
                        ${renderLoopColumn('air', airPlants, airTargets)}
                    </div>
                </div>
            `;
        },

        renderSharedPlantCard(plant) {
            const isLiquid = plant.loop === 'liquid';
            const sys = plant.system || {};
            const arch = sys.architecture || (isLiquid ? 'dry_cooler_trim' : 'air_cooled_chiller');
            const archDesc = window.CoolingArchRegistry ? window.CoolingArchRegistry.get(arch) : null;
            const schematic = (archDesc && archDesc.schematic) ? archDesc.schematic : (isLiquid ? 'series_trim' : 'air_plant');

            const state = window.AppStore?.state || {};
            const plantRes = (state.results?.byPlant || []).find(r => r.plantId === plant.id);
            const modeHours = isLiquid ? plantRes?.cduModeHours : plantRes?.fwModeHours;
            const deficitHours = plantRes?.deficitHours;

            const safeName = window.UIKit ? window.UIKit.escapeHTML(plant.name) : plant.name;
            const loopIcon = isLiquid ? 'droplets' : 'wind';
            const themeBorder = isLiquid ? 'border-purple-200' : 'border-indigo-200';
            const themeBg = isLiquid ? 'bg-purple-50/70' : 'bg-indigo-50/70';
            const themeText = isLiquid ? 'text-purple-950' : 'text-indigo-950';

            // 成員清單與負載計算
            const allTargets = [];
            (state.halls || []).forEach(h => (h.dus || []).forEach(d => {
                const summ = window.AppStore.calcDuSummary(d);
                allTargets.push({ id: d.id, name: h.name + ' - ' + d.name, shortName: d.name, summ });
            }));
            (state.corePods || []).filter(p => p.enabled !== false).forEach(p => {
                const summ = window.AppStore.calcCorePodSummary(p);
                allTargets.push({ id: p.id, name: p.name, shortName: p.name, summ });
            });

            const members = allTargets.filter(t => (plant.memberIds || []).includes(t.id));
            let totalMemberKw = 0;
            const memberPillsHtml = members.map(m => {
                const kw = isLiquid ? (m.summ.liquidHeatKw || 0) : ((m.summ.airHeatKw || 0) + (m.summ.lossKw || 0));
                totalMemberKw += kw;
                return `<span class="px-2 py-0.5 bg-white text-slate-700 text-xs font-semibold rounded-md border border-slate-200 shadow-2xs">${window.UIKit ? window.UIKit.escapeHTML(m.shortName) : m.shortName} <strong class="text-slate-900 font-bold">${kw.toFixed(1)} kW</strong></span>`;
            }).join(' ');

            const diversity = plant.diversityFactor ?? 1.0;
            const designKw = totalMemberKw * diversity;

            // 拓樸圖
            const topoDiagram = window.CoolingSchematics ? window.CoolingSchematics.render(schematic, {
                t: { id: plant.id, name: plant.name },
                cduSys: isLiquid ? sys : undefined,
                fwSys: !isLiquid ? sys : undefined,
                arch: isLiquid ? arch : undefined,
                fwArch: !isLiquid ? arch : undefined,
                cduModeHours: isLiquid ? modeHours : undefined,
                fwModeHours: !isLiquid ? modeHours : undefined,
                deficitHours: deficitHours
            }) : '';

            // Sizing 清單 (僅主機房設備，SizingEngine 已排除 terminal)
            const sizingList = sys.sizing || [];
            let sizingHtml = '';
            sizingList.forEach(item => {
                let modelOptions = '';
                (item.catalog || []).forEach(cat => {
                    const vendorPrefix = cat.vendor ? '[' + cat.vendor + '] ' : '';
                    modelOptions += '<option value="' + cat.model + '" ' + (cat.model === item.selectedModel ? 'selected' : '') + '>' + ViewCooling.favMark(item.key, cat.model) + vendorPrefix + cat.model + ' (' + cat.capKw + ' kW)</option>';
                });

                const effCap = item.effectiveCapKw !== undefined ? item.effectiveCapKw : (item.selectedQty * item.unitCapKw);
                const marginPct = (item.requiredKw > 0) ? (((effCap / item.requiredKw) - 1) * 100) : 0;
                let marginBadge = '';
                if (marginPct < 0) {
                    marginBadge = `<span class="px-2 py-0.5 bg-red-100 text-red-700 text-[10px] font-black rounded-md border border-red-200">${_t('cooling.margin', { sign: '', pct: marginPct.toFixed(1) }, `餘度: ${marginPct.toFixed(1)}%`)}</span>`;
                } else if (marginPct < 10) {
                    marginBadge = `<span class="px-2 py-0.5 bg-amber-100 text-amber-800 text-[10px] font-black rounded-md border border-amber-200">${_t('cooling.margin', { sign: '+', pct: marginPct.toFixed(1) }, `餘度: +${marginPct.toFixed(1)}%`)}</span>`;
                } else {
                    marginBadge = `<span class="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-black rounded-md border border-emerald-200">${_t('cooling.margin', { sign: '+', pct: marginPct.toFixed(1) }, `餘度: +${marginPct.toFixed(1)}%`)}</span>`;
                }

                let badge = '';
                if (item.selectedQty === 0) {
                    badge = `<span class="inline-flex items-center gap-1.5 px-2 py-0.5 bg-slate-100 text-slate-600 text-[10px] font-bold rounded-md border border-slate-300"><span class="w-1.5 h-1.5 rounded-full bg-slate-400 shrink-0"></span>${_t('cooling.statusNoEquip', null, '尚未選型')}</span>`;
                } else if (item.passed) {
                    badge = `<span class="inline-flex items-center gap-1.5 px-2 py-0.5 bg-emerald-50 text-emerald-800 text-[10px] font-bold rounded-md border border-emerald-200"><span class="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></span>${_t('cooling.statusMeetsN1', null, '符合')}</span>`;
                } else {
                    badge = `<span class="inline-flex items-center gap-1.5 px-2 py-0.5 bg-red-50 text-red-800 text-[10px] font-bold rounded-md border border-red-200"><span class="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0"></span>${_t('cooling.statusDeficit', null, '容量不足')}</span>`;
                }

                const red = item.redundancy || plant.redundancy || 'N+1';
                const standbyLbl = (typeof SizingEngine !== 'undefined' && typeof SizingEngine.standbyLabel === 'function')
                    ? SizingEngine.standbyLabel(red)
                    : red;

                sizingHtml += `
                    <div class="p-3 bg-slate-50 rounded-xl border ${item.passed ? 'border-slate-200' : 'border-red-300 bg-red-50/40'} space-y-2 text-xs">
                        <div class="flex justify-between items-center">
                            <div>
                                <span class="font-bold text-slate-900 text-sm">${item.label}</span>
                                <div class="text-xs text-slate-500 mt-1">${_t('cooling.sysDemand', null, '系統需求:')} <strong class="text-slate-900 font-bold bg-white px-1.5 py-0.5 rounded border border-slate-200">${item.requiredText}</strong></div>
                            </div>
                            <div class="flex items-center gap-1.5">
                                ${marginBadge}
                                ${badge}
                            </div>
                        </div>
                        <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                            <div class="col-span-2">
                                <label class="block text-[9px] text-slate-400 font-bold mb-0.5">${_t('cooling.customModel', null, '自選型號 (真實設備型錄庫)')}</label>
                                <select onchange="ViewCooling.changeModel('${plant.id}', '${plant.loop}', '${item.key}', this.value)" class="w-full text-xs font-bold border rounded-lg p-1.5 bg-white text-slate-800">
                                    ${modelOptions}
                                </select>
                            </div>
                            <div>
                                <label class="block text-[9px] text-slate-400 font-bold mb-0.5">${_t('cooling.redundancyLevel', null, '冗餘等級')}</label>
                                <select onchange="ViewCooling.changeRedundancy('${plant.id}', '${plant.loop}', '${item.key}', this.value)" class="w-full text-xs font-black border rounded-lg p-1.5 bg-white text-slate-900">
                                    <option value="N" ${red==='N' ? 'selected' : ''}>N</option>
                                    <option value="N+1" ${red==='N+1' ? 'selected' : ''}>N+1</option>
                                    <option value="N+2" ${red==='N+2' ? 'selected' : ''}>N+2</option>
                                    <option value="2N" ${red==='2N' ? 'selected' : ''}>2N</option>
                                </select>
                            </div>
                            <div>
                                <label class="block text-[9px] text-slate-400 font-bold mb-0.5">${_t('cooling.selectedQty', null, '選定台數')}</label>
                                <input type="number" id="qty_plant_${plant.id}_${plant.loop}_${item.key}" min="1" max="999" value="${item.selectedQty}" onchange="ViewCooling.changeQty('${plant.id}', '${plant.loop}', '${item.key}', this.value)" onkeydown="if(event.key==='Enter')this.blur()" class="w-full text-xs font-black border rounded-lg p-1.5 bg-white text-slate-900 text-center">
                            </div>
                        </div>
                        ${ViewCooling.equipToolsHtml(plant.id, plant.loop, item)}
                        <div class="text-[10px] flex justify-between text-slate-400 pt-0.5 border-t border-slate-200">
                            <span>${_t('cooling.totalCap', null, '總容量:')} ${(item.selectedQty * item.unitCapKw).toFixed(1)} kW</span>
                            <span>${_t('cooling.effectiveCapRedundancy', { label: standbyLbl }, `有效容量 (${standbyLbl}):`)} <strong class="${item.passed ? 'text-emerald-700 font-bold' : 'text-red-600 font-bold'}">${effCap.toFixed(1)} kW</strong></span>
                        </div>
                    </div>
                `;
            });

            // 參數面板
            let paramsPanelHtml = '';
            if (isLiquid) {
                const dcApproach = sys.dryCoolerApproachC ?? 5.0;
                const pheApproach = sys.pheApproachC ?? 2.0;
                const fwsSupplyC = sys.fwsSupplyC ?? 42.0;
                const cduFcThresh = (fwsSupplyC - dcApproach - pheApproach).toFixed(1);
                paramsPanelHtml = `
                    <div class="p-4 bg-white rounded-xl border border-slate-200 space-y-3 shadow-2xs">
                        <div class="flex justify-between items-center border-b border-slate-100 pb-2">
                            <span class="text-xs font-bold text-slate-800">${_t('cooling.priSideTitle', null, '一次側 (設施側 FWS 供回水溫):')}</span>
                        </div>
                        <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            <div>
                                <label class="block text-[9px] text-slate-500">${_t('cooling.fwsSupply', null, '設施供水 FWS (°C)')}</label>
                                <input type="number" id="plantFwsSupplyIn_${plant.id}" value="${fwsSupplyC}" step="0.5" onchange="ViewCooling.updatePlantParams('${plant.id}')" class="w-full text-xs font-bold border rounded p-1 bg-white text-slate-800">
                            </div>
                            <div>
                                <label class="block text-[9px] text-slate-500">${_t('cooling.fwsReturn', null, '設施回水 FWR (°C)')}</label>
                                <input type="number" id="plantFwsReturnIn_${plant.id}" value="${sys.fwsReturnC ?? 54.0}" step="0.5" onchange="ViewCooling.updatePlantParams('${plant.id}')" class="w-full text-xs font-bold border rounded p-1 bg-white text-slate-800">
                            </div>
                            <div>
                                <label class="block text-[9px] text-slate-500">${_t('cooling.rejApproach', null, '排熱端 Approach (°C)')}</label>
                                <input type="number" id="plantDcAppIn_${plant.id}" value="${dcApproach}" step="0.5" onchange="ViewCooling.updatePlantParams('${plant.id}')" class="w-full text-xs font-bold border rounded p-1 bg-white text-slate-800">
                            </div>
                            <div>
                                <label class="block text-[9px] text-slate-500">${_t('cooling.pheApproach', null, '板換 (PHE) Approach (°C)')}</label>
                                <input type="number" id="plantPheAppIn_${plant.id}" value="${pheApproach}" step="0.5" onchange="ViewCooling.updatePlantParams('${plant.id}')" class="w-full text-xs font-bold border rounded p-1 bg-white text-slate-800">
                            </div>
                        </div>
                        <div class="p-2.5 bg-emerald-50 rounded-lg border border-emerald-200 text-xs text-emerald-950 flex justify-between items-center">
                            <div>
                                <span class="font-bold text-[11px]">${_t('cooling.fcThreshFormula', null, 'Free Cooling 門檻:')}</span>
                                <div class="text-[10px] text-emerald-700">T_fc = ${fwsSupplyC}°C − ${dcApproach}°C − ${pheApproach}°C = <strong class="text-xs font-black text-emerald-900">${cduFcThresh}°C DB</strong></div>
                            </div>
                            <span class="px-1.5 py-0.5 bg-white text-emerald-900 border border-emerald-300 rounded font-black text-[9px]">${_t('cooling.physicsLinked', null, '物理連動')}</span>
                        </div>
                        <div class="p-2.5 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
                            <label class="block text-[10px] font-bold text-slate-700">${_t('cooling.pumpHeadM', null, '泵浦系統揚程 (m)')}</label>
                            <input type="number" id="plantHeadIn_${plant.id}" value="${sys.pumpHeadM ?? 28}" min="1" max="150" step="1" onchange="ViewCooling.updatePlantParams('${plant.id}')" class="w-full text-xs font-bold border rounded p-1.5 bg-white text-slate-800">
                        </div>
                    </div>
                `;
            } else {
                paramsPanelHtml = `
                    <div class="p-4 bg-white rounded-xl border border-slate-200 space-y-3 shadow-2xs">
                        <div class="flex justify-between items-center border-b border-slate-100 pb-2">
                            <span class="text-xs font-bold text-slate-800">${_t('cooling.chwTempTitle', null, '冰水供回水溫 (CHW Supply / Return)')}</span>
                        </div>
                        <div class="grid grid-cols-2 gap-3 pt-1">
                            <div>
                                <label class="block text-[9px] text-slate-500 mb-0.5">${_t('cooling.chwSupply', null, '供水溫 CHW Supply (°C)')}</label>
                                <input type="number" id="plantChwSupplyIn_${plant.id}" value="${sys.chwSupplyC ?? 12.0}" step="0.5" onchange="ViewCooling.updatePlantParams('${plant.id}')" class="w-full text-xs font-bold border rounded-lg p-2 bg-white text-indigo-950">
                            </div>
                            <div>
                                <label class="block text-[9px] text-slate-500 mb-0.5">${_t('cooling.chwReturn', null, '回水溫 CHW Return (°C)')}</label>
                                <input type="number" id="plantChwReturnIn_${plant.id}" value="${sys.chwReturnC ?? 18.0}" step="0.5" onchange="ViewCooling.updatePlantParams('${plant.id}')" class="w-full text-xs font-bold border rounded-lg p-2 bg-white text-indigo-950">
                            </div>
                        </div>
                        <div class="p-2.5 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
                            <label class="block text-[10px] font-bold text-slate-700">${_t('cooling.pumpHeadM', null, '泵浦系統揚程 (m)')}</label>
                            <input type="number" id="plantHeadIn_${plant.id}" value="${sys.pumpHeadM ?? 22}" min="1" max="150" step="1" onchange="ViewCooling.updatePlantParams('${plant.id}')" class="w-full text-xs font-bold border rounded p-1.5 bg-white text-slate-800">
                        </div>
                    </div>
                `;
            }

            return `
                <div id="plant_${plant.id}" class="bg-white rounded-2xl shadow-sm border ${themeBorder} overflow-hidden space-y-5 p-6">
                    <!-- 標題列 -->
                    <div class="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-200 gap-3">
                        <div class="flex items-center gap-3">
                            <span class="w-8 h-8 rounded-xl ${themeBg} ${themeText} flex items-center justify-center shadow-2xs">
                                <i data-lucide="${loopIcon}" class="w-4 h-4"></i>
                            </span>
                            <div>
                                <div class="flex items-center gap-2">
                                    <h3 class="text-base font-black text-slate-900">${safeName}</h3>
                                    <span class="px-2 py-0.5 bg-purple-700 text-white font-black rounded text-[10px]">${_t('cooling.sharedBadge', null, '共用')}</span>
                                    <span class="px-2 py-0.5 bg-slate-100 text-slate-700 font-bold rounded text-[10px] border border-slate-200">${plant.redundancy || 'N+1'}</span>
                                </div>
                                <div class="text-xs text-slate-500 mt-1 flex items-center gap-2 flex-wrap">
                                    <span>${_t('cooling.plantTotalLoad', { kw: designKw.toFixed(1) }, `群組合計負載: ${designKw.toFixed(1)} kW`)}</span>
                                    ${diversity !== 1.0 ? `<span class="text-slate-400">(${totalMemberKw.toFixed(1)} kW × ${diversity})</span>` : ''}
                                    <span class="text-slate-300">|</span>
                                    <span>${_t('cooling.membersCount', { n: members.length }, `${members.length} 成員`)}</span>
                                </div>
                            </div>
                        </div>
                        <div class="flex items-center gap-2">
                            <button onclick="ViewCooling.deletePlant('${plant.id}')" class="px-2.5 py-1 text-xs font-bold text-red-600 hover:bg-red-50 rounded-lg border border-red-200 transition">
                                ${_t('common.delete', null, '刪除')}
                            </button>
                        </div>
                    </div>

                    <!-- 成員單元：V10 收成一行，點開才看完整清單 -->
                    ${ViewCooling.collapsible('members_' + plant.id, _t('cooling.membersLine', { n: members.length, names: ViewCooling.memberNames(members) }, `${members.length} 個成員：${ViewCooling.memberNames(members)}`), `
                    <div class="flex flex-wrap gap-1.5">
                        ${memberPillsHtml || `<span class="text-xs text-slate-400">${_t('cooling.emptyPlant', null, '尚未加入任何成員單元')}</span>`}
                    </div>`)}

                    <!-- 架構選擇器 -->
                    <div class="max-w-2xl">
                        <label class="block text-xs font-bold text-slate-700 mb-1">${isLiquid ? _t('cooling.cduArchMode', null, '液冷排熱架構模式 (Architecture)') : _t('cooling.fwArchMode', null, '氣冷 / 背板排熱架構模式 (Architecture)')}</label>
                        <select onchange="ViewCooling.updatePlantArch('${plant.id}', this.value)" class="w-full text-xs font-black border-2 border-slate-300 rounded-xl p-2.5 bg-white text-slate-900 shadow-2xs">
                            ${(window.CoolingArchRegistry ? window.CoolingArchRegistry.list(plant.loop) : []).map(a => {
                                const isSelected = (arch === a.id) || (a.aliases && a.aliases.includes(arch));
                                return `<option value="${a.id}" ${isSelected ? 'selected' : ''}>${a.optionLabel}</option>`;
                            }).join('\n                            ')}
                        </select>
                    </div>


                    <!-- 全寬拓樸圖 SVG（預設收合） -->
                    ${ViewCooling.collapsible('schem_plant_' + plant.id, _t('cooling.showSchematic', null, '系統示意圖'), topoDiagram)}

                    <!-- V10 Phase 8：主機房設備表佔整列寬；水溫連動時參數面板改成一行摘要（水溫由全廠設計條件決定） -->
                    <div class="space-y-2.5 pt-1">
                        <span class="text-xs font-bold text-slate-700 uppercase flex items-center gap-1.5">
                            <i data-lucide="settings-2" class="w-3.5 h-3.5 text-slate-500"></i> ${_t('cooling.plantOverview', null, '共用主機房設備選型')}
                        </span>
                        ${sizingList.length ? ViewCooling.renderEquipTable(plant.id, plant.loop, sizingList, 'qty_plant_' + plant.id + '_' + plant.loop + '_') : `<div class="p-4 text-center bg-slate-50 rounded-xl border text-xs text-slate-400">${_t('cooling.emptyPlant', null, '尚未產生選型資料')}</div>`}
                    </div>
                    ${(window.AppStore.getSiteCooling && window.AppStore.getSiteCooling().linkTemps) ? `
                    <div class="flex flex-wrap items-center gap-3 text-xs text-slate-600 px-1">
                        <span>${isLiquid
                            ? _t('cooling.plantLinkedLiq', { s: sys.fwsSupplyC, r: sys.fwsReturnC }, `水溫依全廠設計條件：FWS ${sys.fwsSupplyC} / ${sys.fwsReturnC} °C`)
                            : _t('cooling.plantLinkedAir', { s: sys.chwSupplyC, r: sys.chwReturnC }, `水溫依全廠設計條件：冰水 ${sys.chwSupplyC} / ${sys.chwReturnC} °C`)}</span>
                        <span class="text-slate-400">|</span>
                        <label class="flex items-center gap-1">${_t('cooling.plantHead', null, '本系統泵揚程 m')}
                            <input type="number" id="plantHeadIn_${plant.id}" value="${sys.pumpHeadM ?? (isLiquid ? 28 : 22)}" step="1" onchange="ViewCooling.updatePlantParams('${plant.id}')" onkeydown="if(event.key==='Enter')this.blur()" class="w-16 text-xs font-bold text-center border border-slate-300 rounded-md py-0.5 bg-white">
                        </label>
                    </div>` : `
                    <div>${paramsPanelHtml}</div>`}
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

        scrollToPlant(plantId) {
            this.render(document.getElementById('stepContent'));
            setTimeout(() => {
                const el = document.getElementById('plant_' + plantId);
                if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 30);
        },

        createNewPlant(loop) {
            this._lastPreset = 'custom';
            const plant = window.AppStore.addCoolingPlant({ loop });
            this.render(document.getElementById('stepContent'));
            if (plant) this.scrollToPlant(plant.id);
        },

        deletePlant(plantId) {
            if (typeof confirm === 'function' && !confirm(_t('cooling.deletePlantConfirm', null, '確定要刪除此共用冷卻系統嗎？其成員單元將恢復為獨立系統。'))) {
                return;
            }
            window.AppStore.deleteCoolingPlant(plantId);
            const remaining = (window.AppStore.state?.coolingPlants || []).length;
            this._lastPreset = (remaining === 0) ? 'dedicated' : 'custom';
            this.render(document.getElementById('stepContent'));
        },

        renamePlant(plantId, name) {
            window.AppStore.updateCoolingPlant(plantId, { name: name.trim() });
            this.scheduleRender();
        },

        changePlantRedundancy(plantId, redundancy) {
            const plant = window.AppStore.getCoolingPlant(plantId);
            if (plant) {
                plant.redundancy = redundancy;
                (plant.system?.sizing || []).forEach(s => {
                    if (!s.userRedundancyEdited) s.redundancy = redundancy;
                });
                window.AppStore.notify();
            }
            this.render(document.getElementById('stepContent'));
        },

        changePlantDiversity(plantId, diversity) {
            const d = parseFloat(diversity);
            if (Number.isFinite(d)) {
                window.AppStore.updateCoolingPlant(plantId, { diversityFactor: d });
            }
            this.scheduleRender();
        },

        togglePlantMember(plantId, memberId) {
            this._lastPreset = 'custom';
            const plant = window.AppStore.getCoolingPlant(plantId);
            if (plant) {
                if ((plant.memberIds || []).includes(memberId)) {
                    window.AppStore.removePlantMember(plantId, memberId);
                } else {
                    window.AppStore.addPlantMember(plantId, memberId);
                }
            }
            this.render(document.getElementById('stepContent'));
        },

        applyDedicatedConfig() {
            this._lastPreset = 'dedicated';
            window.AppStore.applyDedicatedConfig();
            this.render(document.getElementById('stepContent'));
        },

        applySiteSharedConfig() {
            this._lastPreset = 'site_shared';
            window.AppStore.applySiteSharedConfig();
            this.render(document.getElementById('stepContent'));
        },

        applyHallGroupedConfig() {
            this._lastPreset = 'hall_grouped';
            window.AppStore.applyHallGroupedConfig();
            this.render(document.getElementById('stepContent'));
        },

        updatePlantArch(plantId, arch) {
            const plant = window.AppStore.getCoolingPlant(plantId);
            if (plant && plant.system) {
                plant.system.architecture = arch;
                plant.system.sizing = [];
                delete plant.system.sizingArch;
                window.AppStore.syncAllUnitsFromPlants();
                window.AppStore.notify();
            }
            this.render(document.getElementById('stepContent'));
        },

        updatePlantParams(plantId) {
            const num = (id, d) => {
                const el = document.getElementById(id);
                const v = parseFloat(el?.value);
                return Number.isFinite(v) ? v : d;
            };
            const plant = window.AppStore.getCoolingPlant(plantId);
            if (!plant || !plant.system) return;
            const sys = plant.system;
            // V10 Phase 7：全廠水溫連動時，機房的水溫改為修改全廠設定
            const S = window.AppStore;
            const linked = S.getSiteCooling && S.getSiteCooling().linkTemps;
            if (linked) {
                if (plant.loop === 'liquid') {
                    const fwsS = num('plantFwsSupplyIn_' + plantId, sys.fwsSupplyC);
                    const fwsR = num('plantFwsReturnIn_' + plantId, sys.fwsReturnC);
                    if (Math.abs(fwsS - sys.fwsSupplyC) > 1e-9) S.setSiteCoolingTemp('liquid', 'fwsSupplyC', fwsS);
                    else if (Math.abs(fwsR - sys.fwsReturnC) > 1e-9) S.setSiteCoolingTemp('liquid', 'fwsReturnC', fwsR);
                    const dc = num('plantDcAppIn_' + plantId, sys.dryCoolerApproachC);
                    if (Math.abs(dc - (sys.dryCoolerApproachC ?? dc)) > 1e-9) S.setSiteCoolingTemp('liquid', 'dryCoolerApproachC', dc);
                    if (document.getElementById('plantPheAppIn_' + plantId)) {
                        const ph = num('plantPheAppIn_' + plantId, sys.pheApproachC);
                        if (Math.abs(ph - (sys.pheApproachC ?? ph)) > 1e-9) S.setSiteCoolingTemp('liquid', 'pheApproachC', ph);
                    }
                } else {
                    const cs = num('plantChwSupplyIn_' + plantId, sys.chwSupplyC);
                    const cr = num('plantChwReturnIn_' + plantId, sys.chwReturnC);
                    if (Math.abs(cs - sys.chwSupplyC) > 1e-9) S.setSiteCoolingTemp('air', 'chwSupplyC', cs);
                    else if (Math.abs(cr - sys.chwReturnC) > 1e-9) S.setSiteCoolingTemp('air', 'chwReturnC', cr);
                }
                const headEl0 = document.getElementById('plantHeadIn_' + plantId);
                if (headEl0) {
                    const v = parseFloat(headEl0.value);
                    if (Number.isFinite(v)) sys.pumpHeadM = v;
                }
                S.syncAllUnitsFromPlants();
                S.notify();
                this.scheduleRender();
                return;
            }
            if (plant.loop === 'liquid') {
                sys.fwsSupplyC = num('plantFwsSupplyIn_' + plantId, 42.0);
                sys.fwsReturnC = num('plantFwsReturnIn_' + plantId, 54.0);
                sys.dryCoolerApproachC = num('plantDcAppIn_' + plantId, 5.0);
                const pheEl = document.getElementById('plantPheAppIn_' + plantId);
                if (pheEl) sys.pheApproachC = num('plantPheAppIn_' + plantId, 2.0);
                const headEl = document.getElementById('plantHeadIn_' + plantId);
                if (headEl) {
                    const v = parseFloat(headEl.value);
                    sys.pumpHeadM = Number.isFinite(v) ? v : 28;
                }
            } else {
                sys.chwSupplyC = num('plantChwSupplyIn_' + plantId, 12.0);
                sys.chwReturnC = num('plantChwReturnIn_' + plantId, 18.0);
                const headEl = document.getElementById('plantHeadIn_' + plantId);
                if (headEl) {
                    const v = parseFloat(headEl.value);
                    sys.pumpHeadM = Number.isFinite(v) ? v : 22;
                }
            }
            window.AppStore.syncAllUnitsFromPlants();
            window.AppStore.notify();
            this.scheduleRender();
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
            if (!targetObj) {
                targetObj = (state.coolingPlants || []).find(p => p.id === targetId);
            }
            return targetObj;
        },

        updateCduArch(targetId, arch) {
            const target = this.getTargetObj(targetId);
            if (target) {
                if (target.system) {
                    target.system.architecture = arch;
                    target.system.sizing = [];
                    delete target.system.sizingArch;
                    window.AppStore.syncAllUnitsFromPlants();
                } else if (target.plantDesign?.cduSystem) {
                    target.plantDesign.cduSystem.architecture = arch;
                    target.plantDesign.cduSystem.sizing = [];
                }
                window.AppStore.notify();
            }
            this.render(document.getElementById('stepContent'));
        },

        updateFwArch(targetId, arch) {
            const target = this.getTargetObj(targetId);
            if (target) {
                if (target.system) {
                    target.system.architecture = arch;
                    target.system.sizing = [];
                    delete target.system.sizingArch;
                    window.AppStore.syncAllUnitsFromPlants();
                } else if (target.plantDesign?.fanwallSystem) {
                    target.plantDesign.fanwallSystem.architecture = arch;
                    target.plantDesign.fanwallSystem.sizing = [];
                }
                window.AppStore.notify();
            }
            this.render(document.getElementById('stepContent'));
        },

        // ===== V10 Phase 8：Step 4 改版 =====
        sectionHeader(no, title, desc, statusHtml) {
            return `<div class="flex items-start justify-between gap-3 pt-2 px-1" id="step4sec${no}">
                <div class="flex items-start gap-2.5">
                    <span class="w-7 h-7 shrink-0 rounded-full bg-sky-600 text-white text-sm font-black flex items-center justify-center">${no}</span>
                    <div>
                        <div class="text-sm font-black text-slate-900">${title}</div>
                        <div class="text-[11px] text-slate-500">${desc}</div>
                    </div>
                </div>
                <div class="shrink-0">${statusHtml || ''}</div>
            </div>`;
        },
        secStatus(ok, text) {
            return `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[11px] font-bold ${ok ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'}">${ok ? '✓' : '✗'} ${text}</span>`;
        },
        plantsStatus(state) {
            const plants = (state.coolingPlants || []).filter(p => (p.memberIds || []).length);
            if (!plants.length) return '';
            const fails = plants.reduce((n, p) => n + (p.system?.sizing || []).filter(x => x.requiredKw > 0 && x.passed === false).length, 0);
            return this.secStatus(fails === 0, fails === 0 ? _t('cooling.secAllOk', null, '全部合格') : _t('cooling.secFailN', { n: fails }, `${fails} 項不合格`));
        },
        terminalStatus(targets) {
            let fails = 0;
            targets.forEach(t => ['cduSystem', 'fanwallSystem'].forEach(k => (t.obj.plantDesign[k]?.sizing || []).forEach(x => {
                if (['cdu_unit', 'crah_unit', 'rdhx_unit'].includes(x.key) && x.requiredKw > 0 && x.passed === false) fails++;
            })));
            return this.secStatus(fails === 0, fails === 0 ? _t('cooling.secAllOk', null, '全部合格') : _t('cooling.secFailN', { n: fails }, `${fails} 項不合格`));
        },
        memberNames(members) {
            return (members || []).map(m => {
                const n = String(m.shortName || m.name || '').split(/\s*\(/)[0];
                return window.UIKit ? window.UIKit.escapeHTML(n) : n;
            }).join('、');
        },

        _num(v, d = 1) {
            return (v === null || v === undefined || !Number.isFinite(Number(v))) ? '—' : Number(v).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
        },

        // A. 全廠設計條件
        renderSitePanel() {
            const S = window.AppStore;
            if (!S || typeof S.getSiteCooling !== 'function') return '';
            const sc = S.getSiteCooling();
            const L = sc.liquid, Ai = sc.air, fws = S.siteFws();
            const units = S._allCoolingUnits();
            const plants = (S.state.coolingPlants || []);
            const anyPhe = [...units.map(u => u.plantDesign?.cduSystem), ...plants.filter(p => p.loop === 'liquid').map(p => p.system)].some(x => x && x.hasPhe);
            const fcThresh = fws.supplyC - L.dryCoolerApproachC - (anyPhe ? L.pheApproachC : 0);
            const inp = (id, loop, key, val, step = 0.5) => `<input type="number" id="${id}" value="${val}" step="${step}" onchange="ViewCooling.setSiteTemp('${loop}', '${key}', this.value)" onkeydown="if(event.key==='Enter')this.blur()" class="w-16 text-xs font-bold text-center border border-slate-400 rounded-md py-1 bg-white">`;
            // 算出來的值（仍可修改）：灰底
            const der = (id, loop, key, val, step = 0.5) => `<input type="number" id="${id}" value="${val}" step="${step}" title="${_t('cooling.derivedTip', null, '自動算出的值；修改時會反推上游數值')}" onchange="ViewCooling.setSiteTemp('${loop}', '${key}', this.value)" onkeydown="if(event.key==='Enter')this.blur()" class="w-16 text-xs font-bold text-center border border-slate-200 rounded-md py-1 bg-slate-100 text-slate-600">`;
            const node = (title, body, cls) => `<div class="flex flex-col items-center gap-1 px-2.5 py-2 rounded-xl border ${cls}"><span class="text-[10px] font-bold">${title}</span><div class="flex items-center gap-1">${body}</div></div>`;
            const link = (label, body) => `<div class="flex flex-col items-center gap-0.5 text-slate-400"><span class="text-[10px]">${label}</span><div class="flex items-center gap-1">${body}<span class="text-lg leading-none">→</span></div></div>`;
            const lbl = (t) => `<span class="text-[11px] text-slate-500">${t}</span>`;
            const btn = 'px-2 py-0.5 rounded-md border text-[10px] font-bold bg-white hover:bg-slate-100 text-slate-700 border-slate-300';
            const headOf = (loop) => {
                const p = plants.find(x => x.loop === loop && x.system?.pumpHeadM);
                if (p) return p.system.pumpHeadM;
                const u = units.find(x => (loop === 'liquid' ? x.plantDesign?.cduSystem : x.plantDesign?.fanwallSystem)?.pumpHeadM);
                return u ? (loop === 'liquid' ? u.plantDesign.cduSystem.pumpHeadM : u.plantDesign.fanwallSystem.pumpHeadM) : '';
            };
            const overrides = units.filter(u => u.plantDesign?.cduSystem?.tempOverride || u.plantDesign?.fanwallSystem?.tempOverride).map(u => u.name);
            const liquidRow = sc.linkTemps ? `
                <div class="space-y-1.5">
                    <div class="text-xs font-black text-purple-900">${_t('cooling.siteLiquidChain', null, '液冷水溫鏈（晶片 → CDU → 設施水 FWS → 排熱設備 → 外氣）')}</div>
                    <div class="flex flex-wrap items-center gap-2">
                        ${node(_t('cooling.nodeChip', null, '晶片側 TCS 供 / 回 °C'), inp('siteSecSupplyIn', 'liquid', 'secSupplyC', L.secSupplyC) + '<span class="text-slate-400">/</span>' + inp('siteSecReturnIn', 'liquid', 'secReturnC', L.secReturnC), 'border-purple-200 bg-purple-50/60 text-purple-900')}
                        ${link(_t('cooling.linkCdu', null, 'CDU approach'), inp('siteCduAppIn', 'liquid', 'cduApproachC', L.cduApproachC))}
                        ${node(_t('cooling.nodeFws', null, '設施水 FWS 供 / 回 °C'), der('siteFwsSupplyIn', 'liquid', 'fwsSupplyC', fws.supplyC) + '<span class="text-slate-400">/</span>' + der('siteFwsReturnIn', 'liquid', 'fwsReturnC', fws.returnC), 'border-slate-200 bg-slate-50 text-slate-700')}
                        ${anyPhe ? link(_t('cooling.linkPhe', null, 'PHE approach'), inp('sitePheAppIn', 'liquid', 'pheApproachC', L.pheApproachC)) : ''}
                        ${link(_t('cooling.linkRej', null, '排熱 approach'), inp('siteDcAppIn', 'liquid', 'dryCoolerApproachC', L.dryCoolerApproachC))}
                        ${node(_t('cooling.nodeOutdoor', null, '外氣全自然冷卻門檻'), `<span class="px-2 py-1 rounded-md bg-emerald-50 border border-emerald-200 text-xs font-black text-emerald-800">DB ≤ ${this._num(fcThresh, 1)} °C</span>`, 'border-emerald-200 bg-white text-emerald-800')}
                    </div>
                    <div class="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
                        <span>${_t('cooling.presetLabel', null, '快速套用：')}</span>
                        <button class="${btn}" onclick="ViewCooling.applySitePreset('general')">${_t('cooling.presetGeneral', null, '一般設計（晶片 45/55、approach 4／5／2、冰水 22/32）')}</button>
                        <button class="${btn}" onclick="ViewCooling.applySitePreset('nvidia')">${_t('cooling.presetNvidiaRef', null, 'NVIDIA 參考（晶片 45/57）')}</button>
                    </div>
                </div>
                <div class="space-y-1.5">
                    <div class="text-xs font-black text-indigo-900">${_t('cooling.siteAirChain', null, '氣冷水溫（冰水 → CRAH／風牆）')}</div>
                    <div class="flex flex-wrap items-center gap-2">
                        ${node(_t('cooling.nodeChw', null, '冰水 CHW 供 / 回 °C'), inp('siteChwSupplyIn', 'air', 'chwSupplyC', Ai.chwSupplyC) + '<span class="text-slate-400">/</span>' + inp('siteChwReturnIn', 'air', 'chwReturnC', Ai.chwReturnC), 'border-indigo-200 bg-indigo-50/60 text-indigo-900')}
                        <span class="text-lg leading-none text-slate-400">→</span>
                        ${node(_t('cooling.nodeCrah', null, 'CRAH／風牆'), `<span class="text-[11px] text-slate-500">${_t('cooling.nodeCrahNote', null, '冰水溫度越高，自然冷卻時數越多')}</span>`, 'border-slate-200 bg-white text-slate-700')}
                        <span class="flex gap-1 ml-2">
                            <button class="${btn}" onclick="ViewCooling.applySiteAirPreset(22, 32)">22/32</button>
                            <button class="${btn}" onclick="ViewCooling.applySiteAirPreset(12, 18)">12/18</button>
                        </span>
                    </div>
                </div>` : `
                <div class="text-xs text-slate-600">${_t('cooling.siteUnlinked', null, '全廠水溫連動已關閉：各系統水溫在各自卡片中獨立設定。')}</div>`;
            return `
                <div class="bg-white p-4 rounded-2xl shadow-sm border-2 border-sky-200 space-y-3" id="sitePanel">
                    <div class="flex items-center justify-between flex-wrap gap-2">
                        <span class="text-[11px] text-slate-500 flex items-center gap-1.5"><i data-lucide="thermometer" class="w-4 h-4 text-sky-600"></i>${_t('cooling.siteHint', null, '改任何一格，其他相關數值會自動跟著算')}</span>
                        <label class="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                            <input type="checkbox" id="siteLinkChk" ${sc.linkTemps ? 'checked' : ''} onchange="ViewCooling.setTempLink(this.checked)">
                            ${_t('cooling.siteLink', null, '全廠水溫連動（改一處，所有單元與機房一起改）')}
                        </label>
                    </div>
                    ${liquidRow}
                    <div class="flex flex-wrap items-center gap-x-3 gap-y-2 pt-2 border-t border-slate-100">
                        <span class="text-xs font-black text-slate-700">${_t('cooling.siteBatch', null, '批次設定')}</span>
                        ${lbl(_t('cooling.siteHeadLiq', null, '液冷泵揚程 m'))}<input type="number" id="siteHeadLiqIn" value="${headOf('liquid')}" step="1" class="w-16 text-xs font-bold text-center border border-slate-300 rounded-md py-1 bg-white">
                        <button class="${btn}" onclick="ViewCooling.applyHeadAll('liquid')">${_t('cooling.applyAll', null, '套用到全部')}</button>
                        ${lbl(_t('cooling.siteHeadAir', null, '氣冷泵揚程 m'))}<input type="number" id="siteHeadAirIn" value="${headOf('air')}" step="1" class="w-16 text-xs font-bold text-center border border-slate-300 rounded-md py-1 bg-white">
                        <button class="${btn}" onclick="ViewCooling.applyHeadAll('air')">${_t('cooling.applyAll', null, '套用到全部')}</button>
                        ${lbl(_t('cooling.siteRedundancy', null, '冗餘等級'))}
                        <select id="siteRedSel" class="text-xs font-bold border border-slate-300 rounded-md py-1 px-1 bg-white">
                            ${['N', 'N+1', 'N+2', '2N'].map(r => `<option value="${r}" ${r === 'N+1' ? 'selected' : ''}>${r}</option>`).join('')}
                        </select>
                        <button class="${btn}" onclick="ViewCooling.applyRedundancyAll()">${_t('cooling.applyAll', null, '套用到全部')}</button>
                    </div>
                    ${overrides.length ? `<div class="text-[11px] text-amber-700">${_t('cooling.siteOverrides', { names: overrides.join('、') }, `獨立設定水溫的單元：${overrides.join('、')}`)}</div>` : ''}
                </div>`;
        },

        setSiteTemp(loop, key, value) {
            window.AppStore.setSiteCoolingTemp(loop, key, value);
            this.scheduleRender();
        },
        setTempLink(on) {
            window.AppStore.setTempLink(on);
            this.render(document.getElementById('stepContent'));
        },
        // 預設值：'nvidia' = NVIDIA 參考 45/57（沿用既有數值）；其他 = 一般設計（assumptions.js design_*，使用者指定）
        presetLiquid(preset) {
            const A0 = (k, fb) => (typeof window.A === 'function') ? window.A(k) : fb;
            if (preset === 'nvidia') return { secSupplyC: 45.0, secReturnC: 57.0, cduApproachC: 4.0, dryCoolerApproachC: 5.0, pheApproachC: 2.0 };
            return {
                secSupplyC: A0('design_tcs_supply_c', 45.0), secReturnC: A0('design_tcs_return_c', 55.0), cduApproachC: A0('design_cdu_approach_c', 4.0),
                dryCoolerApproachC: A0('design_rej_approach_c', 5.0), pheApproachC: A0('design_phe_approach_c', 2.0)
            };
        },
        applySitePreset(preset) {
            const S = window.AppStore, L = S.getSiteCooling().liquid;
            Object.assign(L, this.presetLiquid(preset));
            if (preset !== 'nvidia') {
                const A0 = (k, fb) => (typeof window.A === 'function') ? window.A(k) : fb;
                Object.assign(S.getSiteCooling().air, { chwSupplyC: A0('design_chw_supply_c', 22.0), chwReturnC: A0('design_chw_return_c', 32.0) });
            }
            S.applySiteCoolingToAll();
            S.notify();
            this.render(document.getElementById('stepContent'));
        },
        applySiteAirPreset(sup, ret) {
            const S = window.AppStore;
            Object.assign(S.getSiteCooling().air, { chwSupplyC: sup, chwReturnC: ret });
            S.applySiteCoolingToAll();
            S.notify();
            this.render(document.getElementById('stepContent'));
        },
        applyHeadAll(loop) {
            const el = document.getElementById(loop === 'liquid' ? 'siteHeadLiqIn' : 'siteHeadAirIn');
            const v = parseFloat(el?.value);
            if (!Number.isFinite(v) || v <= 0) return;
            window.AppStore.applyPumpHeadToAll(loop, v);
            this.render(document.getElementById('stepContent'));
        },
        applyRedundancyAll() {
            const v = document.getElementById('siteRedSel')?.value;
            if (!v) return;
            if (typeof confirm === 'function' && !confirm(_t('cooling.confirmRedAll', { r: v }, `將所有設備的冗餘等級改為 ${v}？`))) return;
            window.AppStore.applyRedundancyToAll(v);
            this.render(document.getElementById('stepContent'));
        },

        // 型號下拉：★常用 → 可行且台數少 → 其他；選項顯示需要台數與餘裕
        modelOptionsHtml(item) {
            const prev = item.optionPreview || [];
            const byModel = new Map(prev.map(p => [p.model, p]));
            const isPump = window.SizingEngine && window.SizingEngine.isPumpItem && window.SizingEngine.isPumpItem(item);
            const S = window.AppStore;
            const fav = (m) => !!(S && S.isFavoriteModel && S.isFavoriteModel(item.key, m));
            const cats = (item.catalog || []).slice().sort((a, b) => {
                const pa = byModel.get(a.model), pb = byModel.get(b.model);
                const ka = [fav(a.model) ? 0 : 1, pa && pa.feasible ? 0 : 1, pa ? pa.units : 9999, a.capKw];
                const kb = [fav(b.model) ? 0 : 1, pb && pb.feasible ? 0 : 1, pb ? pb.units : 9999, b.capKw];
                for (let i = 0; i < ka.length; i++) if (ka[i] !== kb[i]) return ka[i] - kb[i];
                return 0;
            });
            return cats.map(c => {
                const p = byModel.get(c.model);
                const vendor = c.vendor ? '[' + c.vendor + '] ' : '';
                const warn = (c._verified === false || !c._source) ? '⚠ ' : '';
                let tail = ' (' + c.capKw + ' kW)';
                if (p && item.requiredKw > 0) {
                    tail = _t('cooling.optTail', { cap: c.capKw, n: p.units, m: p.marginPct == null ? '—' : p.marginPct.toFixed(0) }, `｜${c.capKw} kW｜需 ${p.units} 台｜餘裕 ${p.marginPct == null ? '—' : p.marginPct.toFixed(0)}%`)
                        + (isPump && p.headOk === false ? _t('cooling.optHeadShort', null, '｜揚程不足') : '');
                }
                const label = (fav(c.model) ? '★ ' : '') + warn + vendor + c.model + tail;
                const safe = String(label).replace(/&/g, '&amp;').replace(/</g, '&lt;');
                return `<option value="${String(c.model).replace(/"/g, '&quot;')}" ${c.model === item.selectedModel ? 'selected' : ''}>${safe}</option>`;
            }).join('');
        },

        // 設備表格（一列一台設備）
        renderEquipTable(ownerId, sysType, list, qtyIdPrefix) {
            const SE = window.SizingEngine;
            // V10：不合格的列排到最前面
            const sorted = (list || []).slice().sort((a, b) => ((a.requiredKw > 0 && a.passed === false) ? 0 : 1) - ((b.requiredKw > 0 && b.passed === false) ? 0 : 1));
            const rows = sorted.map(item => {
                const isPump = SE && SE.isPumpItem && SE.isPumpItem(item);
                const red = item.redundancy || 'N+1';
                const effCap = item.effectiveCapKw !== undefined ? item.effectiveCapKw : (item.selectedQty * item.unitCapKw);
                const margin = item.requiredKw > 0 ? ((effCap / item.requiredKw) - 1) * 100 : null;
                const ok = item.requiredKw > 0 ? !!item.passed : true;
                const marginCls = margin == null ? 'text-slate-400' : (margin < 0 ? 'text-red-600' : (margin < 10 ? 'text-amber-700' : 'text-emerald-700'));
                const notes = [], infos = [];
                if (isPump && item.pumpChecks && item.requiredKw > 0) {
                    const pc = item.pumpChecks;
                    if (!pc.motorOk) notes.push(_t('cooling.pumpMotorShort', null, '馬達功率不足'));
                    if (!pc.flowOk) notes.push(_t('cooling.pumpFlowShort', null, '流量不足'));
                    if (!pc.headOk) notes.push(_t('cooling.pumpHeadShort', null, '揚程不足'));
                }
                if (item.key === 'trim_chiller' && item.maxMechanicalKw !== undefined && item.maxMechanicalPassed === false) {
                    // Trim 冰機本來就不是設計成全機械製冷，Mode 3 不足只是提示，不算不合格
                    infos.push(_t('cooling.mode3Short', { kw: Number(item.maxMechanicalKw).toFixed(0) }, `Mode 3 全機械製冷 ${Number(item.maxMechanicalKw).toFixed(0)} kW 不足`));
                }
                if ((item.selectedQty || 0) > 20) infos.push(_t('cooling.tooManyShort', null, '台數偏多，建議自動選型'));
                const reqTitle = String(item.requiredText || '').replace(/<[^>]+>/g, '').replace(/"/g, '&quot;');
                const fav = window.AppStore?.isFavoriteModel ? window.AppStore.isFavoriteModel(item.key, item.selectedModel) : false;
                const safeModel = String(item.selectedModel || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '&quot;');
                const qid = qtyIdPrefix + item.key;
                const ib = 'w-6 h-6 rounded border border-slate-300 bg-white hover:bg-slate-100 text-xs font-black';
                return `
                    <tr class="border-t border-slate-200 ${ok ? '' : 'bg-red-50/60'}">
                        <td class="py-1.5 px-2 align-top" title="${reqTitle}">
                            <div class="text-xs font-bold text-slate-900 min-w-[9rem]">${String(item.label || item.key).split(' (')[0]}</div>
                            <div class="text-[10px] text-slate-500">${_t('cooling.reqShort', { kw: this._num(item.requiredKw, 0) }, `需求 ${this._num(item.requiredKw, 0)} kW`)}${isPump ? ' ' + _t('cooling.motorShaft', null, '(軸功率)') : ''}</div>
                            ${notes.length ? `<div class="text-[10px] font-bold text-red-600">${notes.join('；')}</div>` : ''}
                            ${infos.length ? `<div class="text-[10px] text-amber-700">${infos.join('；')}</div>` : ''}
                        </td>
                        <td class="py-1.5 px-2 align-top">
                            <select onchange="ViewCooling.changeModel('${ownerId}', '${sysType}', '${item.key}', this.value)" class="w-full max-w-[22rem] text-[11px] font-bold border border-slate-300 rounded-md p-1 bg-white text-slate-800">${this.modelOptionsHtml(item)}</select>
                        </td>
                        <td class="py-1.5 px-2 align-top">
                            <select onchange="ViewCooling.changeRedundancy('${ownerId}', '${sysType}', '${item.key}', this.value)" class="text-[11px] font-bold border border-slate-300 rounded-md p-1 bg-white">
                                ${['N', 'N+1', 'N+2', '2N'].map(r => `<option value="${r}" ${r === red ? 'selected' : ''}>${r}</option>`).join('')}
                            </select>
                        </td>
                        <td class="py-1.5 px-2 align-top whitespace-nowrap">
                            <button id="${qid}_dec" class="${ib}" onclick="ViewCooling.stepQty('${ownerId}', '${sysType}', '${item.key}', -1, this.id)">−</button>
                            <input type="number" id="${qid}" min="1" max="999" value="${item.selectedQty}" onchange="ViewCooling.changeQty('${ownerId}', '${sysType}', '${item.key}', this.value)" onkeydown="if(event.key==='Enter')this.blur()" class="w-12 text-xs font-black text-center border border-slate-300 rounded-md py-0.5 bg-white">
                            <button id="${qid}_inc" class="${ib}" onclick="ViewCooling.stepQty('${ownerId}', '${sysType}', '${item.key}', 1, this.id)">+</button>
                        </td>
                        <td class="py-1.5 px-2 align-top text-right text-[11px] tabular-nums whitespace-nowrap">${this._num(effCap, 0)} / ${this._num(item.requiredKw, 0)}</td>
                        <td class="py-1.5 px-2 align-top text-right text-[11px] font-bold tabular-nums ${marginCls}">${margin == null ? '—' : margin.toFixed(1) + '%'}</td>
                        <td class="py-1.5 px-2 align-top text-center text-sm font-black ${ok ? 'text-emerald-600' : 'text-red-600'}">${ok ? '✓' : '✗'}</td>
                        <td class="py-1.5 px-2 align-top whitespace-nowrap">
                            ${isPump ? '' : `<button title="${_t('cooling.autoSelectTitle', null, '從型錄挑選降額後台數最少、容量不過大的型號')}" onclick="ViewCooling.autoSelect('${ownerId}', '${sysType}', '${item.key}')" class="px-1.5 py-0.5 rounded border border-slate-300 bg-white hover:bg-slate-100 text-[10px] font-bold">${_t('cooling.autoShort', null, '自動')}</button>`}
                            <button title="${_t('cooling.favOff', null, '☆ 設為常用')}" onclick="ViewCooling.toggleFavorite('${item.key}', '${safeModel}')" class="px-1.5 py-0.5 rounded border text-[10px] font-bold ${fav ? 'bg-amber-50 text-amber-700 border-amber-300' : 'bg-white text-slate-400 border-slate-300'}">${fav ? '★' : '☆'}</button>
                        </td>
                    </tr>`;
            }).join('');
            if (!rows) return '';
            const th = (txt, tip, cls = '') => `<th class="py-1.5 px-2 ${cls}" title="${tip}"><span class="border-b border-dotted border-slate-400 cursor-help">${txt}</span></th>`;
            return `
                <div class="text-[11px] text-slate-500 px-1 pb-1">${_t('cooling.tableLegend', null, '「自動」：從型錄挑台數最少、容量不過大的型號。☆：設為常用，下次優先列出。⚠：型錄數值沒有出處。紅底列：容量不足，需要加台數或換大型號。')}</div>
                <div class="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                    <table class="w-full text-left">
                        <thead class="bg-slate-50 text-[10px] text-slate-500 font-bold">
                            <tr>
                                ${th(_t('cooling.thEquip', null, '設備'), _t('cooling.thEquipTip', null, '游標停在設備名稱上可看完整需求說明'))}
                                ${th(_t('cooling.thModel', null, '型號（需要台數／餘裕）'), _t('cooling.thModelTip', null, '每個選項後面是「選這台時需要的台數（含備用）」與「有效容量比需求多出的百分比」'))}
                                ${th(_t('cooling.thRed', null, '冗餘'), _t('cooling.thRedTip', null, 'N+1：多 1 台備用；N+2：多 2 台；2N：全部雙份'))}
                                ${th(_t('cooling.thQty', null, '台數'), _t('cooling.thQtyTip', null, '含備用的總台數；−／＋ 可微調'))}
                                ${th(_t('cooling.thEffReq', null, '有效／需求 kW'), _t('cooling.thEffReqTip', null, '有效容量 = 運轉台數（扣掉備用）× 單機容量 × 降額係數'), 'text-right')}
                                ${th(_t('cooling.thMargin', null, '餘裕'), _t('cooling.thMarginTip', null, '有效容量 ÷ 需求 − 1；負值代表容量不足'), 'text-right')}
                                <th class="py-1.5 px-2 text-center">${_t('cooling.thOk', null, '判定')}</th>
                                <th class="py-1.5 px-2"></th>
                            </tr>
                        </thead>
                        <tbody>${rows}</tbody>
                    </table>
                </div>`;
        },

        stepQty(ownerId, sysType, key, delta, focusId) {
            const item = window.AppStore._findSizingItem(ownerId, sysType, key);
            if (!item) return;
            const q = Math.max(1, Math.min(999, (Number(item.selectedQty) || 0) + delta));
            window.AppStore.updateSelectedEquipment(ownerId, sysType, key, undefined, q);
            this.render(document.getElementById('stepContent'));
            if (focusId) { const b = document.getElementById(focusId); if (b) b.focus(); }
        },

        // D. 終端設備總表：每個單元一列，CDU 與 CRAH／RDHX 各一組
        renderTerminalTable(targets) {
            const SE = window.SizingEngine;
            const find = (sys, keys) => (sys?.sizing || []).find(s => keys.includes(s.key));
            const cell = (t, sysType, item, prefix) => {
                if (!item || !(item.requiredKw > 0)) return `<td class="py-1.5 px-2 text-[11px] text-slate-400" colspan="3">—</td>`;
                const effCap = item.effectiveCapKw !== undefined ? item.effectiveCapKw : (item.selectedQty * item.unitCapKw);
                const margin = ((effCap / item.requiredKw) - 1) * 100;
                const qid = prefix + t.id + '_' + item.key;
                const ib = 'w-5 h-5 rounded border border-slate-300 bg-white hover:bg-slate-100 text-[11px] font-black';
                return `
                    <td class="py-1.5 px-2"><select onchange="ViewCooling.changeModel('${t.id}', '${sysType}', '${item.key}', this.value)" class="w-full max-w-[15rem] text-[11px] font-bold border border-slate-300 rounded-md p-1 bg-white">${this.modelOptionsHtml(item)}</select></td>
                    <td class="py-1.5 px-2 whitespace-nowrap">
                        <button id="${qid}_dec" class="${ib}" onclick="ViewCooling.stepQty('${t.id}', '${sysType}', '${item.key}', -1, this.id)">−</button>
                        <input type="number" id="${qid}" min="1" max="999" value="${item.selectedQty}" onchange="ViewCooling.changeQty('${t.id}', '${sysType}', '${item.key}', this.value)" onkeydown="if(event.key==='Enter')this.blur()" class="w-11 text-xs font-black text-center border border-slate-300 rounded-md py-0.5 bg-white">
                        <button id="${qid}_inc" class="${ib}" onclick="ViewCooling.stepQty('${t.id}', '${sysType}', '${item.key}', 1, this.id)">+</button>
                    </td>
                    <td class="py-1.5 px-2 text-right text-[11px] font-bold tabular-nums ${item.passed ? (margin < 10 ? 'text-amber-700' : 'text-emerald-700') : 'text-red-600'}">${item.passed ? '✓' : '✗'} ${margin.toFixed(1)}%</td>`;
            };
            const rows = targets.map(t => {
                const cdu = find(t.obj.plantDesign.cduSystem, ['cdu_unit']);
                const air = find(t.obj.plantDesign.fanwallSystem, ['crah_unit', 'rdhx_unit']);
                const airLoad = (t.summ.airHeatKw || 0) + (t.summ.lossKw || 0);
                const safe = window.UIKit ? window.UIKit.escapeHTML(t.shortName || t.name) : (t.shortName || t.name);
                return `
                    <tr class="border-t border-slate-200">
                        <td class="py-1.5 px-2 text-xs font-bold text-slate-900 whitespace-nowrap"><button class="hover:underline text-left" onclick="ViewCooling.scrollToUnit('${t.id}')">${safe}</button></td>
                        <td class="py-1.5 px-2 text-right text-[11px] tabular-nums">${this._num(t.summ.totalItKw, 0)}</td>
                        <td class="py-1.5 px-2 text-right text-[11px] tabular-nums text-purple-900">${this._num(t.summ.liquidHeatKw, 0)}</td>
                        ${cell(t, 'cdu', cdu, 'tq_cdu_')}
                        <td class="py-1.5 px-2 text-right text-[11px] tabular-nums text-indigo-900">${this._num(airLoad, 0)}</td>
                        ${cell(t, 'fanwall', air, 'tq_fw_')}
                    </tr>`;
            }).join('');
            const dus = targets.filter(t => t.type === 'du');
            const srcSel = dus.length > 1 ? `
                <div class="flex items-center gap-2 flex-wrap text-xs">
                    <span class="text-slate-600">${_t('cooling.applyFrom', null, '把')}</span>
                    <select id="termSrcSel" class="text-xs font-bold border border-slate-300 rounded-md py-1 px-1 bg-white">${dus.map(t => `<option value="${t.id}">${window.UIKit ? window.UIKit.escapeHTML(t.shortName) : t.shortName}</option>`).join('')}</select>
                    <span class="text-slate-600">${_t('cooling.applyTo', null, '的 CDU／CRAH 型號與冗餘')}</span>
                    <button onclick="ViewCooling.applyTerminalToAllDus()" class="px-3 py-1 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold">${_t('cooling.applyToAllDus', null, '套用到所有 DU')}</button>
                    <span class="text-[11px] text-slate-500">${_t('cooling.applyNote', null, '台數會依各 DU 自己的負載重新計算')}</span>
                </div>` : '';
            return `
                <div class="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 space-y-3" id="terminalTable">
                    <h3 class="text-sm font-black text-slate-900 flex items-center gap-1.5"><i data-lucide="table" class="w-4 h-4 text-slate-600"></i>${_t('cooling.terminalTitle', null, '終端設備（CDU、CRAH／RDHX）總表')}</h3>
                    ${srcSel}
                    <div class="overflow-x-auto">
                        <table class="w-full text-left">
                            <thead class="bg-slate-50 text-[10px] text-slate-500 font-bold">
                                <tr>
                                    <th class="py-1.5 px-2">${_t('cooling.thUnit', null, '單元')}</th>
                                    <th class="py-1.5 px-2 text-right">IT kW</th>
                                    <th class="py-1.5 px-2 text-right">${_t('cooling.thLiqKw', null, '液冷 kW')}</th>
                                    <th class="py-1.5 px-2">${_t('cooling.thCduModel', null, 'CDU 型號')}</th>
                                    <th class="py-1.5 px-2">${_t('cooling.thQty', null, '台數')}</th>
                                    <th class="py-1.5 px-2 text-right">${_t('cooling.thMargin', null, '餘裕')}</th>
                                    <th class="py-1.5 px-2 text-right">${_t('cooling.thAirKw', null, '氣冷 kW')}</th>
                                    <th class="py-1.5 px-2">${_t('cooling.thCrahModel', null, 'CRAH／RDHX 型號')}</th>
                                    <th class="py-1.5 px-2">${_t('cooling.thQty', null, '台數')}</th>
                                    <th class="py-1.5 px-2 text-right">${_t('cooling.thMargin', null, '餘裕')}</th>
                                </tr>
                            </thead>
                            <tbody>${rows}</tbody>
                        </table>
                    </div>
                </div>`;
        },

        applyTerminalToAllDus() {
            const srcId = document.getElementById('termSrcSel')?.value;
            const S = window.AppStore;
            const src = this.getTargetObj(srcId);
            if (!src) return;
            const cdu = (src.plantDesign.cduSystem.sizing || []).find(s => s.key === 'cdu_unit');
            const air = (src.plantDesign.fanwallSystem.sizing || []).find(s => s.key === 'crah_unit' || s.key === 'rdhx_unit');
            const dus = [];
            (S.state.halls || []).forEach(h => (h.dus || []).forEach(d => { if (d.id !== srcId) dus.push(d.name); }));
            const msg = _t('cooling.confirmApplyAll', { src: src.name, list: dus.join('、') }, `把 ${src.name} 的 CDU／CRAH 型號與冗餘套用到：${dus.join('、')}？台數會依各 DU 負載重新計算。`);
            if (typeof confirm === 'function' && !confirm(msg)) return;
            if (cdu) S.applyToAllUnits('liquid', 'cdu_unit', { model: cdu.selectedModel, redundancy: cdu.redundancy, kind: 'du' });
            if (air) S.applyToAllUnits('air', air.key, { model: air.selectedModel, redundancy: air.redundancy, kind: 'du' });
            this.render(document.getElementById('stepContent'));
        },

        // ===== V9 Phase 3：UX 輔助 =====
        _openSections: {},

        collapsible(id, label, content) {
            if (!content) return '';
            const open = !!this._openSections[id];
            return `<details class="rounded-xl border border-slate-200 bg-white" ${open ? 'open' : ''} ontoggle="ViewCooling._openSections['${id}'] = this.open">
                <summary class="cursor-pointer select-none px-3 py-2 text-xs font-bold text-slate-600">${label}</summary>
                <div class="p-2">${content}</div>
            </details>`;
        },

        favMark(equipKey, model) {
            return (window.AppStore && window.AppStore.isFavoriteModel && window.AppStore.isFavoriteModel(equipKey, model)) ? '★ ' : '';
        },

        equipToolsHtml(targetId, sysType, item) {
            if (!item || (window.SizingEngine && window.SizingEngine.isPumpItem && window.SizingEngine.isPumpItem(item))) return '';
            const fav = window.AppStore?.isFavoriteModel ? window.AppStore.isFavoriteModel(item.key, item.selectedModel) : false;
            const runQty = (window.SizingEngine && item.redundancy) ? window.SizingEngine.runningQty(item.selectedQty, item.redundancy) : item.selectedQty;
            const tooMany = (item.selectedQty || 0) > 20;
            const btn = 'px-2 py-0.5 rounded-md border text-[10px] font-bold transition';
            return `<div class="flex items-center gap-1.5 flex-wrap">
                <button onclick="ViewCooling.autoSelect('${targetId}', '${sysType}', '${item.key}')" class="${btn} bg-white hover:bg-slate-100 text-slate-700 border-slate-300" title="${_t('cooling.autoSelectTitle', null, '從型錄挑選降額後台數最少、容量不過大的型號')}">${_t('cooling.autoSelect', null, '自動選型')}</button>
                <button onclick="ViewCooling.toggleFavorite('${item.key}', '${String(item.selectedModel || '').replace(/'/g, "\\'")}')" class="${btn} ${fav ? 'bg-amber-50 text-amber-700 border-amber-300' : 'bg-white hover:bg-slate-100 text-slate-500 border-slate-300'}">${fav ? _t('cooling.favOn', null, '★ 常用') : _t('cooling.favOff', null, '☆ 設為常用')}</button>
                ${item.autoSelected ? `<span class="text-[10px] text-slate-500">${_t('cooling.autoSelectedNote', null, '已自動選型')}</span>` : ''}
                ${item.fromLastModel ? `<span class="text-[10px] text-slate-500">${_t('cooling.lastModelNote', null, '沿用上次選型')}</span>` : ''}
                ${tooMany ? `<span class="text-[10px] font-bold text-amber-700">${_t('cooling.tooManyUnits', { n: item.selectedQty, run: runQty }, `台數偏多（${item.selectedQty} 台），建議按「自動選型」或改選較大型號`)}</span>` : ''}
            </div>`;
        },

        sizingSummaryHtml(sizingList) {
            if (!Array.isArray(sizingList) || !sizingList.length) return '';
            const chips = sizingList.map(s => `<span class="inline-flex items-center gap-1 px-2 py-1 rounded-lg border text-[11px] ${s.passed ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-red-300 bg-red-50 text-red-800'}">
                <strong>${s.passed ? '✓' : '✗'}</strong> ${String(s.label || s.key).split(' ')[0]}：${s.selectedModel || '—'} × ${s.selectedQty}</span>`).join('');
            return `<div class="flex flex-wrap gap-1.5">${chips}</div>`;
        },

        autoSelect(targetId, sysType, equipKey) {
            window.AppStore.requestAutoSelect(targetId, sysType, equipKey);
            this.render(document.getElementById('stepContent'));
        },

        toggleFavorite(equipKey, model) {
            window.AppStore.toggleFavoriteModel(equipKey, model);
            this.render(document.getElementById('stepContent'));
        },

        changeModel(targetId, sysType, equipKey, model) {
            window.AppStore.updateSelectedEquipment(targetId, sysType, equipKey, model, undefined);
            this.render(document.getElementById('stepContent'));
        },

        changeQty(targetId, sysType, equipKey, qty) {
            window.AppStore.updateSelectedEquipment(targetId, sysType, equipKey, undefined, qty);
            this.scheduleRender();
        },

        changeRedundancy(targetId, sysType, equipKey, redundancy) {
            window.AppStore.changeSizingRedundancy(targetId, sysType, equipKey, redundancy);
            this.render(document.getElementById('stepContent'));
        },

        changeRunMode(targetId, sysType, equipKey, runMode) {
            window.AppStore.changeSizingRunMode(targetId, sysType, equipKey, runMode);
            this.render(document.getElementById('stepContent'));
        },

        applyCduPreset(targetId, preset) {
            const target = this.getTargetObj(targetId);
            // V10 Phase 7：連動開啟且該單元未獨立設定時，預設值套用到全廠
            const S0 = window.AppStore;
            if (target && S0.getSiteCooling && S0.getSiteCooling().linkTemps && !target.plantDesign.cduSystem.tempOverride) {
                const L0 = S0.getSiteCooling().liquid;
                Object.assign(L0, ViewCooling.presetLiquid(preset));
                S0.applySiteCoolingToAll();
                S0.notify();
                this.render(document.getElementById('stepContent'));
                return;
            }
            if (target) {
                const c = target.plantDesign.cduSystem;
                const p = ViewCooling.presetLiquid(preset);
                Object.assign(c, p);
                c.fwsSupplyC = Number((p.secSupplyC - p.cduApproachC).toFixed(2));
                c.fwsReturnC = Number((p.secReturnC - p.cduApproachC).toFixed(2));
                window.AppStore.notify();
            }
            this.render(document.getElementById('stepContent'));
        },

        applyFwTemps(targetId, sup, ret) {
            const target = this.getTargetObj(targetId);
            const S0 = window.AppStore;
            if (target && S0.getSiteCooling && S0.getSiteCooling().linkTemps && !target.plantDesign.fanwallSystem.tempOverride) {
                Object.assign(S0.getSiteCooling().air, { chwSupplyC: sup, chwReturnC: ret });
                S0.applySiteCoolingToAll();
                S0.notify();
                this.render(document.getElementById('stepContent'));
                return;
            }
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
            const pheEl = document.getElementById('cduPheAppIn_' + targetId);
            const pheApp = pheEl ? num('cduPheAppIn_' + targetId, 2.0) : 2.0;

            const target = this.getTargetObj(targetId);
            if (target) {
                const cdu = target.plantDesign.cduSystem;
                const S0 = window.AppStore;
                const linked = S0.getSiteCooling && S0.getSiteCooling().linkTemps && !cdu.tempOverride;
                if (linked) {
                    // V10 Phase 7：連動開啟 → 有變動的溫度欄位改寫全廠設定（套用到所有單元與機房）
                    const L0 = S0.getSiteCooling().liquid;
                    const diff = (a, b) => Math.abs(Number(a) - Number(b)) > 1e-9;
                    if (diff(secSup, L0.secSupplyC)) L0.secSupplyC = secSup;
                    if (diff(secRet, L0.secReturnC)) L0.secReturnC = secRet;
                    if (diff(cduApp, L0.cduApproachC)) L0.cduApproachC = cduApp;
                    if (diff(outdoorApp, L0.dryCoolerApproachC)) L0.dryCoolerApproachC = outdoorApp;
                    if (pheEl && diff(pheApp, L0.pheApproachC)) L0.pheApproachC = pheApp;
                    S0.applySiteCoolingToAll();
                } else {
                cdu.secSupplyC = secSup;
                cdu.secReturnC = secRet;
                cdu.cduApproachC = cduApp;
                cdu.fwsSupplyC = sup;
                cdu.fwsReturnC = ret;
                cdu.dryCoolerApproachC = outdoorApp;
                if (pheEl) {
                    cdu.pheApproachC = pheApp;
                }
                }

                const cduHeadEl = document.getElementById('cduPumpHeadIn_' + targetId);
                if (cduHeadEl) {
                    const v = parseFloat(cduHeadEl.value);
                    cdu.pumpHeadM = Number.isFinite(v) ? v : ((typeof A === 'function') ? A('cdu_pump_head_default_m') : 28);
                }

                // 架構專屬參數更新 (D-3: 優先自 archDesc.params 動態讀取)
                const cduArchDesc = typeof CoolingArchRegistry !== 'undefined' ? CoolingArchRegistry.get(cdu.architecture) : null;
                let handledCustom = false;
                if (cduArchDesc && Array.isArray(cduArchDesc.params)) {
                    for (const p of cduArchDesc.params) {
                        if (!p.archSpecific && p.panel !== 'custom') continue;
                        const id = (p.idPrefix || (p.key + '_')) + targetId;
                        const el = document.getElementById(id);
                        if (!el) continue;
                        handledCustom = true;
                        if (p.type === 'boolean') {
                            cdu[p.key] = el.checked;
                        } else {
                            const v = el.value.trim();
                            if (p.nullable && v === '') {
                                cdu[p.key] = null;
                            } else {
                                const n = parseFloat(v);
                                cdu[p.key] = Number.isFinite(n) ? n : (p.default !== undefined ? p.default : null);
                            }
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
            this.scheduleRender();
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
                const S0 = window.AppStore;
                if (S0.getSiteCooling && S0.getSiteCooling().linkTemps && !fw.tempOverride) {
                    // V10 Phase 7：連動開啟 → 改全廠冰水溫度
                    const A0 = S0.getSiteCooling().air;
                    A0.chwSupplyC = sup;
                    A0.chwReturnC = ret;
                    S0.applySiteCoolingToAll();
                } else {
                    fw.chwSupplyC = sup;
                    fw.chwReturnC = ret;
                }

                const fwHeadEl = document.getElementById('fwPumpHeadIn_' + targetId);
                if (fwHeadEl) {
                    const v = parseFloat(fwHeadEl.value);
                    fw.pumpHeadM = Number.isFinite(v) ? v : ((typeof A === 'function') ? A('fw_pump_head_default_m') : 22);
                }

                const fwArchDesc = typeof CoolingArchRegistry !== 'undefined' ? CoolingArchRegistry.get(fw.architecture) : null;
                if (fwArchDesc && Array.isArray(fwArchDesc.params)) {
                    for (const p of fwArchDesc.params) {
                        if (!p.archSpecific && p.panel !== 'custom') continue;
                        const id = (p.idPrefix || (p.key + '_')) + targetId;
                        const el = document.getElementById(id);
                        if (!el) continue;
                        if (p.type === 'boolean') {
                            fw[p.key] = el.checked;
                        } else {
                            const v = el.value.trim();
                            if (p.nullable && v === '') {
                                fw[p.key] = null;
                            } else {
                                const n = parseFloat(v);
                                fw[p.key] = Number.isFinite(n) ? n : (p.default !== undefined ? p.default : null);
                            }
                        }
                    }
                }

                window.AppStore.notify();
            }
            this.scheduleRender();
        }
    };

    window.ViewCooling = ViewCooling;
})(window);
