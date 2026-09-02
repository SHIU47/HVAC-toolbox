/**
 * view_corepod.js - Step 3: CorePOD Core Facilities with Equipment Designer
 */
(function(window) {
    'use strict';

    let selectedPodId = 'corepod_01';

    const ViewCorePod = {
        render(container) {
            const state = window.AppStore.state;
            const pods = state.corePods || [];
            const halls = state.halls || [];

            if (!pods.find(p => p.id === selectedPodId)) {
                selectedPodId = pods[0] ? pods[0].id : null;
            }
            const currentPod = pods.find(p => p.id === selectedPodId) || pods[0];

            let podButtons = '';
            pods.forEach((pod, idx) => {
                const isSel = pod.id === selectedPodId;
                const ps = window.AppStore.calcCorePodSummary(pod);
                podButtons += '<div class="p-3 rounded-xl border transition cursor-pointer flex items-center justify-between ' + (isSel ? 'border-teal-500 bg-teal-50/80 shadow-sm ring-2 ring-teal-400' : 'border-slate-200 hover:border-slate-300 bg-white') + '" onclick="ViewCorePod.selectPod(\'' + pod.id + '\')">'
                    + '<div class="flex-1 min-w-0 pr-2">'
                    + '<div class="text-xs font-extrabold text-slate-900 truncate">' + window.UIKit.escapeHTML(pod.name) + '</div>'
                    + '<div class="text-[11px] text-teal-800 font-bold mt-0.5">' + ps.totalItKw.toFixed(1) + ' kW <span class="text-[10px] font-normal text-slate-400">(' + (pod.topologyMode === 'dedicated' ? '獨立Utility' : '共用全廠冷水') + ')</span></div>'
                    + '</div>'
                    + '<div class="flex items-center gap-1 shrink-0">'
                    + '<button onclick="event.stopPropagation(); ViewCorePod.copyPod(\'' + pod.id + '\')" title="複製此 CorePOD" class="px-1.5 py-0.5 text-xs bg-slate-100 hover:bg-teal-100 text-slate-600 hover:text-teal-900 rounded font-bold transition">📋</button>'
                    + (pods.length > 1 ? '<button onclick="event.stopPropagation(); ViewCorePod.deletePod(\'' + pod.id + '\')" title="刪除此 CorePOD" class="px-1.5 py-0.5 text-xs bg-slate-100 hover:bg-red-100 text-slate-400 hover:text-red-600 rounded font-bold transition">✕</button>' : '')
                    + '</div>'
                    + '</div>';
            });

            container.innerHTML = `
                <div class="space-y-6">
                    <div class="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-4">
                        <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div>
                                <h2 class="text-xl font-bold text-slate-900 flex items-center gap-2">
                                    <span>📦</span> Step 3: CorePOD 核心機房設計 (Cross-Hall Core Facility)
                                </h2>
                                <p class="text-sm text-slate-500 mt-1">
                                    配置跨 Hall 共用之<strong>核心網通（Spine / Router）、集中式儲存與管理叢集</strong>（不含 GPU 運算機櫃）。
                                </p>
                            </div>
                            <div class="flex items-center gap-2">
                                <button onclick="ViewCorePod.addPod()" class="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs rounded-xl shadow-sm transition flex items-center gap-1.5">
                                    <span>➕</span> 新增 CorePOD
                                </button>
                            </div>
                        </div>
                    </div>

                    <div class="grid grid-cols-1 lg:grid-cols-4 gap-6">
                        <!-- 左側: CorePOD 清單 -->
                        <div class="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 space-y-3">
                            <div class="flex items-center justify-between">
                                <span class="text-xs font-extrabold text-slate-700 uppercase">CorePOD 清單 (${pods.length})</span>
                                <button onclick="ViewCorePod.addPod()" class="text-[11px] font-bold text-teal-700 hover:underline">+ 新增</button>
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
                                            <span class="text-base font-bold text-slate-900 shrink-0">📦 核心機房:</span>
                                            <input type="text" value="${window.UIKit.escapeHTML(currentPod.name)}" onchange="ViewCorePod.updatePodName(this.value)" class="w-full font-extrabold text-teal-900 border rounded-lg px-2.5 py-1 text-sm bg-teal-50/60 focus:bg-white focus:ring-2 focus:ring-teal-400">
                                        </div>
                                        <div class="flex items-center gap-2 flex-wrap">
                                            <button onclick="ViewCorePod.copyPod('${currentPod.id}')" class="px-3 py-1 bg-slate-100 hover:bg-teal-50 text-slate-700 hover:text-teal-900 text-xs font-bold rounded-lg border border-slate-200 transition flex items-center gap-1">
                                                <span>📋</span> 複製此 CorePOD
                                            </button>
                                            <div class="flex items-center gap-1.5 pl-2 border-l border-slate-200">
                                                <span class="text-xs text-slate-500 font-bold">冷卻拓撲:</span>
                                                <button onclick="ViewCorePod.setMode('dedicated')" class="px-3 py-1 text-xs font-bold rounded-lg transition ${currentPod.topologyMode === 'dedicated' ? 'bg-teal-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}">獨立 Utility 系統</button>
                                                <button onclick="ViewCorePod.setMode('shared_plant')" class="px-3 py-1 text-xs font-bold rounded-lg transition ${currentPod.topologyMode === 'shared_plant' ? 'bg-teal-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}">共用全廠冷水</button>
                                            </div>
                                        </div>
                                    </div>
                                    <div class="text-xs text-slate-500 flex items-center gap-2">
                                        <span>🔗 服務關聯 Hall:</span>
                                        <span class="font-bold text-slate-800">${halls.map(h=>h.name).join(', ') || '全廠共用'}</span>
                                    </div>
                                </div>

                                <!-- Equipment Designer (No GPU) -->
                                <div id="corePodEquipmentDesignerContainer"></div>
                            ` : '<div class="bg-white p-8 rounded-2xl border text-center text-slate-400 text-xs">請先選擇或建立 CorePOD</div>'}
                        </div>
                    </div>

                    <div class="flex justify-between pt-2">
                        <button onclick="window.App.prevStep()" class="px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm rounded-xl transition">
                            <span>←</span> 上一步: Hall/SU 設計
                        </button>
                        <button onclick="window.App.nextStep()" class="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl shadow-sm transition flex items-center gap-2">
                            下一步: 廠務冷卻工程設計 (Plant Model) <span>→</span>
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
                this.render(document.getElementById('stepContent'));
            }
        },
        setMode(mode) {
            window.AppStore.updateCorePod(selectedPodId, { topologyMode: mode });
            this.render(document.getElementById('stepContent'));
        }
    };

    window.ViewCorePod = ViewCorePod;
})(window);
