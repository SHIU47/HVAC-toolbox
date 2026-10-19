/**
 * view_corepod.js - Step 3: CorePOD Core Facilities with Equipment Designer
 */
(function(window) {
    'use strict';

    let selectedPodId = 'corepod_01';

    const ViewCorePod = {
        _renderTimer: null,
        scheduleRender() {
            if (this._renderTimer) clearTimeout(this._renderTimer);
            this._renderTimer = setTimeout(() => {
                this._renderTimer = null;
                const container = document.getElementById('stepContent');
                if (container && window.App && window.App.currentStep === 3) {
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

            const S = window.AppStore;
            const state = S.state;
            const pods = state.corePods || [];
            const halls = state.halls || [];

            if (!pods.find(p => p.id === selectedPodId)) {
                selectedPodId = pods[0] ? pods[0].id : null;
            }
            const currentPod = pods.find(p => p.id === selectedPodId) || pods[0];
            const t = (k, p, fb) => (window.I18N ? window.I18N.t(k, p) : (fb || k));

            const isLinked = !!currentPod?.templateRef?.linked;
            const tpl = (isLinked && currentPod?.templateRef?.id) ? S.getTemplate(currentPod.templateRef.id) : null;
            const isOutdated = tpl ? (tpl.version > (currentPod.templateRef.version || 1)) : false;

            let templateActionsHtml = '';
            if (isLinked) {
                templateActionsHtml = '<div class="flex items-center gap-1.5 flex-wrap">'
                    + '<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200" title="' + (tpl ? window.UIKit.escapeHTML(tpl.name) : '') + '">'
                    + '🔗 ' + (tpl ? window.UIKit.escapeHTML(tpl.name) : t('template.linked', null, '已連結範本')) + ' v' + (currentPod.templateRef.version || 1)
                    + '</span>'
                    + (isOutdated ? '<button onclick="ViewCorePod.syncPod(\'' + currentPod.id + '\')" class="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs rounded-xl shadow-xs transition animate-pulse" title="' + t('template.updated', null, '範本已更新') + '">' + t('template.sync', null, '🔄 同步新版') + ' (v' + tpl.version + ')</button>' : '')
                    + '<button onclick="ViewCorePod.unlinkPod(\'' + currentPod.id + '\')" class="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition">' + t('template.unlink', null, '解除連結') + '</button>'
                    + '</div>';
            } else {
                const hasCorePodTemplates = (S.state.templates || []).some(item => item.kind === 'corepod');
                templateActionsHtml = '<div class="flex items-center gap-1.5 flex-wrap">'
                    + '<button onclick="ViewCorePod.saveAsTemplate(\'' + (currentPod ? currentPod.id : '') + '\')" class="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold text-xs rounded-xl border border-emerald-200 transition" title="' + t('template.saveAsTemplate', null, '💾 存為範本') + '">' + t('template.saveAsTemplate', null, '💾 存為範本') + '</button>'
                    + (hasCorePodTemplates ? '<button onclick="ViewCorePod.promptApplyTemplate(\'' + (currentPod ? currentPod.id : '') + '\')" class="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-800 font-bold text-xs rounded-xl border border-blue-200 transition" title="' + t('template.applyTemplate', null, '📥 套用範本') + '">' + t('template.applyTemplate', null, '📥 套用範本') + '</button>' : '')
                    + '</div>';
            }

            let podButtons = '';
            pods.forEach((pod, idx) => {
                const isSel = pod.id === selectedPodId;
                const ps = window.AppStore.calcCorePodSummary(pod);
                const topoModeLabel = (pod.topologyMode === 'dedicated' ? t('corepod.dedicated', null, '獨立Utility') : t('corepod.sharedPlant', null, '共用全廠冷水'));
                podButtons += '<div class="p-3 rounded-xl border transition cursor-pointer flex items-center justify-between ' + (isSel ? 'border-teal-500 bg-teal-50/80 shadow-sm ring-2 ring-teal-400' : 'border-slate-200 hover:border-slate-300 bg-white') + '" onclick="ViewCorePod.selectPod(\'' + pod.id + '\')">'
                    + '<div class="flex-1 min-w-0 pr-2">'
                    + '<div class="text-xs font-extrabold text-slate-900 truncate">' + window.UIKit.escapeHTML(pod.name) + '</div>'
                    + '<div class="text-[11px] text-teal-800 font-bold mt-0.5">' + ps.totalItKw.toFixed(1) + ' kW <span class="text-[10px] font-normal text-slate-400">(' + topoModeLabel + ')</span></div>'
                    + '</div>'
                    + '<div class="flex items-center gap-1 shrink-0">'
                    + '<button onclick="event.stopPropagation(); ViewCorePod.copyPod(\'' + pod.id + '\')" title="' + t('corepod.copyTitle', null, '複製此 CorePOD') + '" class="px-1.5 py-0.5 text-xs bg-slate-100 hover:bg-teal-100 text-slate-600 hover:text-teal-900 rounded font-bold transition">📋</button>'
                    + (pods.length > 1 ? '<button onclick="event.stopPropagation(); ViewCorePod.deletePod(\'' + pod.id + '\')" title="' + t('corepod.deleteTitle', null, '刪除此 CorePOD') + '" class="px-1.5 py-0.5 text-xs bg-slate-100 hover:bg-red-100 text-slate-400 hover:text-red-600 rounded font-bold transition">✕</button>' : '')
                    + '</div>'
                    + '</div>';
            });

            container.innerHTML = `
                <div class="space-y-6">
                    <div class="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-4">
                        <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div>
                                <h2 class="text-xl font-bold text-slate-900 flex items-center gap-2">
                                    <span>📦</span> ${t('corepod.title', null, 'Step 3: CorePOD 核心機房設計 (Cross-Hall Core Facility)')}
                                </h2>
                                <p class="text-sm text-slate-500 mt-1">
                                    ${t('corepod.desc', null, '配置跨 Hall 共用之<strong>核心網通（Spine / Router）、集中式儲存與管理叢集</strong>（不含 GPU 運算機櫃）。')}
                                </p>
                            </div>
                            <div class="flex items-center gap-2 flex-wrap">
                                <button onclick="ViewHallSU.openTemplateManager()" class="px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 font-bold text-xs rounded-xl border border-indigo-200 transition flex items-center gap-1.5 shadow-2xs">
                                    <span>📚</span> ${t('template.title', null, '範本庫')} (${(S.state.templates || []).length})
                                </button>
                                <button onclick="ViewCorePod.addPod()" class="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs rounded-xl shadow-sm transition flex items-center gap-1.5">
                                    <span>➕</span> ${t('corepod.addBtn', null, '新增 CorePOD')}
                                </button>
                            </div>
                        </div>
                    </div>

                    <div class="grid grid-cols-1 lg:grid-cols-4 gap-6">
                        <!-- 左側: CorePOD 清單 -->
                        <div class="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 space-y-3">
                            <div class="flex items-center justify-between">
                                <span class="text-xs font-extrabold text-slate-700 uppercase">${t('corepod.list', { n: pods.length }, `CorePOD 清單 (${pods.length})`)}</span>
                                <button onclick="ViewCorePod.addPod()" class="text-[11px] font-bold text-teal-700 hover:underline">${t('corepod.add', null, '+ 新增')}</button>
                            </div>
                            <div class="space-y-2">
                                ${podButtons}
                            </div>
                        </div>

                        <!-- 右側: 編輯與冷卻模式 -->
                        <div class="lg:col-span-3 space-y-4">
                            ${currentPod ? `
                                <!-- 冷卻模式與關聯 Hall -->
                                <div class="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 space-y-3">
                                    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-3">
                                        <div class="flex items-center gap-2 flex-1 max-w-md">
                                            <span class="text-base font-bold text-slate-900 shrink-0">${t('corepod.facilityLabel', null, '📦 核心機房:')}</span>
                                            <input type="text" id="corepodNameIn_${currentPod.id}" value="${window.UIKit.escapeHTML(currentPod.name)}" onchange="ViewCorePod.updatePodName(this.value)" onkeydown="if(event.key==='Enter')this.blur()" class="w-full font-extrabold text-teal-900 border rounded-lg px-2.5 py-1 text-sm bg-teal-50/60 focus:bg-white focus:ring-2 focus:ring-teal-400">
                                        </div>
                                        <div class="flex items-center gap-2 flex-wrap">
                                            ${templateActionsHtml}
                                            <button onclick="ViewCorePod.copyPod('${currentPod.id}')" class="px-3 py-1 bg-slate-100 hover:bg-teal-50 text-slate-700 hover:text-teal-900 text-xs font-bold rounded-lg border border-slate-200 transition flex items-center gap-1">
                                                <span>📋</span> ${t('corepod.copyBtn', null, '複製此 CorePOD')}
                                            </button>
                                            <div class="flex items-center gap-1.5 pl-2 border-l border-slate-200">
                                                <span class="text-xs text-slate-500 font-bold">${t('corepod.topoLabel', null, '冷卻拓撲:')}</span>
                                                <button onclick="ViewCorePod.setMode('dedicated')" class="px-3 py-1 text-xs font-bold rounded-lg transition ${currentPod.topologyMode === 'dedicated' ? 'bg-teal-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}">${t('corepod.modeDedicated', null, '獨立 Utility 系統')}</button>
                                                <button onclick="ViewCorePod.setMode('shared_plant')" class="px-3 py-1 text-xs font-bold rounded-lg transition ${currentPod.topologyMode === 'shared_plant' ? 'bg-teal-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}">${t('corepod.modeShared', null, '共用全廠冷水')}</button>
                                            </div>
                                        </div>
                                    </div>
                                    <div class="text-xs text-slate-500 flex items-center gap-2">
                                        <span>${t('corepod.servicedHalls', null, '🔗 服務關聯 Hall:')}</span>
                                        <span class="font-bold text-slate-800">${halls.map(h=>h.name).join(', ') || t('corepod.allHalls', null, '全廠共用')}</span>
                                    </div>
                                </div>

                                ${isLinked ? `<div class="p-3 bg-indigo-50/70 rounded-2xl border border-indigo-200 text-xs text-indigo-900 font-medium flex items-center justify-between"><span>🔗 ${t('template.linkedNotice', null, '此單元已連結標準範本，設備由範本統一管理。如需個別微調，請點選上方「解除連結」。')}</span></div>` : ''}

                                <!-- Equipment Designer (No GPU) -->
                                <div id="corePodEquipmentDesignerContainer"></div>
                            ` : `<div class="bg-white p-8 rounded-2xl border text-center text-slate-400 text-xs">${t('corepod.empty', null, '請先選擇或建立 CorePOD')}</div>`}
                        </div>
                    </div>

                    <div class="flex justify-between pt-2">
                        <button onclick="window.App.prevStep()" class="px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm rounded-xl transition">
                            <span>←</span> ${t('corepod.prevStep', null, '上一步: Hall/SU 設計')}
                        </button>
                        <button onclick="window.App.nextStep()" class="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl shadow-sm transition flex items-center gap-2">
                            ${t('corepod.nextStep', null, '下一步: 廠務冷卻工程設計 (Plant Model)')} <span>→</span>
                        </button>
                    </div>
                </div>
            `;

            if (currentPod) {
                window.EquipmentDesigner.render('corePodEquipmentDesignerContainer', {
                    equipment: currentPod.equipment || [],
                    allowGpu: false, // CorePOD Quick Add 不含 GPU
                    onChange: (newEq) => {
                        currentPod.equipment = newEq;
                        window.AppStore.notify();
                    }
                });
            }
            if (window.UIKit) window.UIKit.refreshIcons(container);

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
        },

        selectPod(id) {
            selectedPodId = id;
            this.render(document.getElementById('stepContent'));
        },
        addPod() {
            const newPod = window.AppStore.addCorePod({});
            if (newPod) {
                selectedPodId = newPod.id;
            }
            this.render(document.getElementById('stepContent'));
        },
        copyPod(id) {
            const newPod = window.AppStore.copyCorePod(id);
            if (newPod) {
                selectedPodId = newPod.id;
            }
            this.render(document.getElementById('stepContent'));
        },
        deletePod(id) {
            if (window.AppStore.deleteCorePod(id)) {
                const pods = window.AppStore.state.corePods;
                selectedPodId = pods[0] ? pods[0].id : null;
                this.render(document.getElementById('stepContent'));
            }
        },
        updatePodName(name) {
            const p = window.AppStore.state.corePods.find(pod => pod.id === selectedPodId);
            if (p) {
                p.name = name;
                window.AppStore.notify();
                this.scheduleRender();
            }
        },
        setMode(mode) {
            window.AppStore.updateCorePod(selectedPodId, { topologyMode: mode });
            if (mode === 'shared_plant' && window.App && typeof window.App.renderStep === 'function') {
                window.App.renderStep(4);
            } else {
                this.render(document.getElementById('stepContent'));
            }
        },
        saveAsTemplate(podId) {
            const S = window.AppStore;
            const t = (k, p, fb) => (window.I18N ? window.I18N.t(k, p) : (fb || k));
            const pod = (S.state.corePods || []).find(p => p.id === podId);
            if (!pod) return;
            const defaultName = pod.name + ' ' + t('template.defaultSuffix', null, '標準範本');
            const name = prompt(t('template.templateNamePrompt', null, '請輸入範本名稱:'), defaultName);
            if (!name) return;
            const hasTerminal = !!(pod.plantDesign?.cduSystem?.sizing?.length || pod.plantDesign?.fanwallSystem?.sizing?.length);
            let includeTerminal = false;
            if (hasTerminal) {
                includeTerminal = confirm(t('template.includeTerminalPrompt', null, '是否同時將終端設備選型 (CDU / CRAH 型號與冗餘) 納入範本？'));
            }
            S.saveCorePodAsTemplate(podId, name.trim(), includeTerminal);
            this.render(document.getElementById('stepContent'));
        },
        promptApplyTemplate(podId) {
            const S = window.AppStore;
            const t = (k, p, fb) => (window.I18N ? window.I18N.t(k, p) : (fb || k));
            const cpTemplates = (S.state.templates || []).filter(item => item.kind === 'corepod');
            if (cpTemplates.length === 0) {
                alert(t('template.empty', null, '目前無已儲存的範本。'));
                return;
            }
            let choiceText = t('template.applyTemplate', null, '套用範本') + ':\n';
            cpTemplates.forEach((tpl, idx) => {
                choiceText += (idx + 1) + '. ' + tpl.name + ' (v' + (tpl.version || 1) + ')\n';
            });
            choiceText += '\n' + t('template.selectTemplatePrompt', { n: cpTemplates.length }, '請輸入欲套用的範本編號 (1-' + cpTemplates.length + '):');
            const choice = prompt(choiceText, '1');
            if (!choice) return;
            const idx = parseInt(choice, 10) - 1;
            if (isNaN(idx) || idx < 0 || idx >= cpTemplates.length) {
                return;
            }
            const selectedTpl = cpTemplates[idx];
            S.applyTemplateToCorePod(podId, selectedTpl.id, true);
            this.render(document.getElementById('stepContent'));
        },
        unlinkPod(podId) {
            window.AppStore.unlinkCorePod(podId);
            this.render(document.getElementById('stepContent'));
        },
        syncPod(podId) {
            window.AppStore.syncCorePodWithTemplate(podId);
            this.render(document.getElementById('stepContent'));
        }
    };

    window.ViewCorePod = ViewCorePod;
})(window);
