/**
 * view_hall_su.js - Step 2: Hall -> DU -> SU Collapsible Architecture with Template Builders (V21)
 */
(function(window) {
    'use strict';

    let selectedHallId = 'hall_1';
    let expandedDuIds = new Set(['du_1_1']); // 預設展開第 1 個 DU

    const ViewHallSU = {
        render(container) {
            const state = window.AppStore.state;
            const halls = state.halls || [];

            if (halls.length === 0) {
                container.innerHTML = '<div class="p-8 text-center bg-white rounded-2xl border">尚無 Data Hall 機房資料，請點選「+ 新增 Hall」開始設計</div>';
                return;
            }

            if (!halls.find(h => h.id === selectedHallId)) {
                selectedHallId = halls[0].id;
            }
            const currentHall = halls.find(h => h.id === selectedHallId) || halls[0];
            const hallSumm = window.AppStore.calcHallSummary(currentHall);

            // Hall 標籤頁
            let hallTabs = '';
            halls.forEach(h => {
                const isSel = h.id === selectedHallId;
                const hs = window.AppStore.calcHallSummary(h);
                hallTabs += '<div class="inline-flex items-center rounded-xl overflow-hidden border ' + (isSel ? 'bg-purple-600 border-purple-700 text-white shadow-md' : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200') + '">'
                    + '<button onclick="ViewHallSU.selectHall(\'' + h.id + '\')" class="px-3.5 py-2 text-xs font-bold transition flex items-center gap-2">'
                    + '<span>🏢 ' + h.name + '</span>'
                    + '<span class="px-2 py-0.5 rounded-full text-[10px] ' + (isSel ? 'bg-purple-800 text-purple-100' : 'bg-slate-200 text-slate-800') + '">' + (hs.totalItKw / 1000).toFixed(2) + ' MW</span>'
                    + '</button>'
                    + (halls.length > 1 ? '<button onclick="event.stopPropagation(); ViewHallSU.deleteHall(\'' + h.id + '\')" title="刪除此 Hall 機房" class="px-2.5 py-2 text-xs font-black ' + (isSel ? 'hover:bg-purple-700 text-purple-200 hover:text-white border-l border-purple-500' : 'hover:bg-red-100 text-slate-400 hover:text-red-600 border-l border-slate-200') + ' transition">✕</button>' : '')
                    + '</div>';
            });

            // 渲染當前 Hall 內的所有 DU 卡片
            let duCardsHtml = '';
            (currentHall.dus || []).forEach((du, duIdx) => {
                const duSumm = window.AppStore.calcDuSummary(du);
                const isExpanded = expandedDuIds.has(du.id);

                // 渲染該 DU 內的所有 SU 卡片
                let suCardsHtml = '';
                (du.sus || []).forEach((su, suIdx) => {
                    const suSumm = window.AppStore.calcSuSummary(su);

                    // 設備表格行
                    let equipRows = '';
                    (su.equipment || []).forEach((item, eqIdx) => {
                        const qty = item.qty || 1;
                        const itKw = (item.itLoadKw || 0) * qty;
                        const liqPct = (item.liquidPct !== undefined) ? item.liquidPct : 0;
                        const airPct = (item.airPct !== undefined) ? item.airPct : (100 - liqPct);
                        const liqKw = itKw * (liqPct / 100);

                        equipRows += '<tr class="border-b border-slate-100 hover:bg-slate-50/70 text-xs">'
                            + '<td class="py-2 px-2.5 font-mono font-black ' + (item.category === 'GPU' ? 'text-purple-700' : 'text-indigo-700') + '">' + (item.category || 'GPU') + '</td>'
                            + '<td class="py-2 px-2.5"><input type="text" value="' + window.UIKit.escapeHTML(item.model) + '" onchange="ViewHallSU.updateEquipModel(\'' + currentHall.id + '\', \'' + du.id + '\', \'' + su.id + '\', ' + eqIdx + ', this.value)" class="w-full font-bold text-slate-800 border border-transparent hover:border-slate-300 focus:border-indigo-500 rounded p-1 bg-transparent text-xs"></td>'
                            + '<td class="py-2 px-2.5 text-center"><input type="number" min="1" max="128" value="' + qty + '" oninput="ViewHallSU.updateEquipQty(\'' + currentHall.id + '\', \'' + du.id + '\', \'' + su.id + '\', ' + eqIdx + ', parseInt(this.value,10)||1)" class="w-14 text-center font-bold border rounded p-1 bg-white"></td>'
                            + '<td class="py-2 px-2.5 text-right"><div class="flex items-center justify-end gap-1"><input type="number" min="0" max="1000" step="0.5" value="' + (item.itLoadKw || 0) + '" oninput="ViewHallSU.updateEquipKw(\'' + currentHall.id + '\', \'' + du.id + '\', \'' + su.id + '\', ' + eqIdx + ', parseFloat(this.value)||0)" class="w-16 text-right font-bold border rounded p-1 bg-white"><span class="text-xs text-slate-500">kW</span></div></td>'
                            + '<td class="py-2 px-2.5 text-center"><div class="flex items-center justify-center gap-1"><input type="number" min="0" max="100" step="1" value="' + liqPct + '" oninput="ViewHallSU.updateEquipLiquid(\'' + currentHall.id + '\', \'' + du.id + '\', \'' + su.id + '\', ' + eqIdx + ', parseFloat(this.value)||0)" class="w-14 text-center font-black text-emerald-800 border border-emerald-300 rounded p-1 bg-emerald-50/50 focus:bg-white"><span class="text-xs font-bold text-slate-500">%</span></div><div class="text-[10px] text-slate-400 font-normal">氣冷 ' + airPct.toFixed(0) + '%</div></td>'
                            + '<td class="py-2 px-2.5 text-right font-black text-purple-950">' + itKw.toFixed(1) + ' kW <div class="text-[10px] text-emerald-800 font-normal">💧 ' + liqKw.toFixed(1) + ' kW</div></td>'
                            + '<td class="py-2 px-2.5 text-center"><button onclick="ViewHallSU.deleteEquip(\'' + currentHall.id + '\', \'' + du.id + '\', \'' + su.id + '\', ' + eqIdx + ')" class="text-slate-400 hover:text-red-500 font-bold p-1">✕</button></td>'
                            + '</tr>';
                    });

                    // 快速加入按鈕 Chips
                    const quickChips = [
                        { cat: 'GPU', model: 'NVIDIA Vera Rubin VR200 NVL72', kw: 227, liq: 95, air: 5 },
                        { cat: 'GPU', model: 'NVIDIA Blackwell GB300 NVL72', kw: 187, liq: 87, air: 13 },
                        { cat: 'GPU', model: 'AMD Helios', kw: 246, liq: 89, air: 11 },
                        { cat: 'GPU', model: 'NVIDIA Blackwell GB200 NVL72', kw: 120, liq: 90, air: 10 },
                        { cat: 'IB', model: 'NDR Leaf Switch (64p)', kw: 6, liq: 0, air: 100 },
                        { cat: 'CIN', model: '100G Leaf Switch (ToR)', kw: 8, liq: 0, air: 100 },
                        { cat: 'STG', model: 'NVMe Flash Storage JBOF', kw: 18, liq: 0, air: 100 },
                        { cat: 'CIN', model: 'CIN Leaf Rack (Cluster Interconnect Network)', kw: 45, liq: 100, air: 0 },
                        { cat: 'SPARE', model: 'LC Spare Rack (Liquid Cooled Spare)', kw: 45, liq: 100, air: 0 },
                        { cat: 'N-S', model: 'N/S TAN Rack (Tenant Access Network)', kw: 15, liq: 0, air: 100 },
                        { cat: 'MGMT', model: 'SMN Rack (Secure Management Network / OOB)', kw: 15, liq: 0, air: 100 },
                        { cat: 'CME', model: 'CME Rack (Context Memory Extension)', kw: 35, liq: 0, air: 100 }
                    ];

                    let quickChipsHtml = '';
                    quickChips.forEach(qc => {
                        quickChipsHtml += '<button onclick="ViewHallSU.quickAddEquip(\'' + currentHall.id + '\', \'' + du.id + '\', \'' + su.id + '\', \'' + qc.cat + '\', \'' + qc.model + '\', ' + qc.kw + ', ' + qc.liq + ', ' + qc.air + ')" class="px-2 py-1 bg-white hover:bg-slate-100 text-slate-800 text-[10px] font-bold rounded-lg border border-slate-200 shadow-2xs transition">+ ' + qc.model + ' (' + qc.kw + 'kW)</button>';
                    });

                    suCardsHtml += '<div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">'
                        + '<div class="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b gap-2">'
                        + '<div class="flex items-center gap-2">'
                        + '<span class="text-base font-black text-indigo-950">🧩</span>'
                        + '<input type="text" value="' + window.UIKit.escapeHTML(su.name) + '" onchange="ViewHallSU.renameSU(\'' + currentHall.id + '\', \'' + du.id + '\', \'' + su.id + '\', this.value)" class="font-extrabold text-slate-900 border rounded-lg px-2 py-1 text-sm bg-slate-50 border-slate-200">'
                        + '<span class="px-2 py-0.5 bg-indigo-50 text-indigo-950 text-xs font-bold rounded-md border border-indigo-200">'
                        + 'IT: <strong>' + suSumm.totalItKw.toFixed(1) + ' kW</strong> (💧 ' + suSumm.liquidHeatKw.toFixed(1) + ' kW &middot; ' + suSumm.dlcPct.toFixed(0) + '%)'
                        + '</span>'
                        + '</div>'
                        + '<div class="flex items-center gap-2">'
                        + '<button onclick="ViewHallSU.promptCopySU(\'' + currentHall.id + '\', \'' + du.id + '\', \'' + su.id + '\')" class="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold rounded-lg border border-blue-200 transition">📋 複製 SU×N</button>'
                        + (du.sus.length > 1 ? '<button onclick="ViewHallSU.deleteSU(\'' + currentHall.id + '\', \'' + du.id + '\', \'' + su.id + '\')" class="px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-600 text-xs font-bold rounded-lg border border-red-200 transition">🗑️ 刪除 SU</button>' : '')
                        + '</div>'
                        + '</div>'
                        + '<div class="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">'
                        + '<div class="flex justify-between items-center text-[11px] font-bold text-slate-700">'
                        + '<span>⚡ 快速加入標準機架與網通設備 (Quick Add)</span>'
                        + '<button onclick="ViewHallSU.addCustomEquip(\'' + currentHall.id + '\', \'' + du.id + '\', \'' + su.id + '\')" class="text-purple-700 hover:underline font-bold">+ 自訂設備</button>'
                        + '</div>'
                        + '<div class="flex items-center gap-1.5 flex-wrap">' + quickChipsHtml + '</div>'
                        + '</div>'
                        + '<div class="overflow-x-auto">'
                        + '<table class="w-full text-left">'
                        + '<thead><tr class="text-[11px] font-bold text-slate-400 uppercase tracking-wider border-b"><th class="py-2 px-2.5">類別</th><th class="py-2 px-2.5">設備型號名稱</th><th class="py-2 px-2.5 text-center">台數</th><th class="py-2 px-2.5 text-right">單台功耗</th><th class="py-2 px-2.5 text-center">液冷比</th><th class="py-2 px-2.5 text-right">小計 IT (液冷)</th><th class="py-2 px-2.5 text-center">操作</th></tr></thead>'
                        + '<tbody>' + (equipRows || '<tr><td colspan="7" class="py-4 text-center text-xs text-slate-400">目前尚無設備，請點選上方按鈕加入</td></tr>') + '</tbody>'
                        + '</table>'
                        + '</div>'
                        + '<div class="grid grid-cols-3 gap-3 p-3 bg-slate-50 rounded-xl border text-xs">'
                        + '<div><span class="text-slate-400 font-bold">總 IT 負載</span><div class="font-extrabold text-slate-900 mt-0.5 text-sm">' + suSumm.totalItKw.toFixed(1) + ' kW</div></div>'
                        + '<div><span class="text-purple-900 font-bold">💧 液冷散熱量</span><div class="font-extrabold text-purple-950 mt-0.5 text-sm">' + suSumm.liquidHeatKw.toFixed(1) + ' kW (' + suSumm.dlcPct.toFixed(0) + '%)</div></div>'
                        + '<div><span class="text-indigo-900 font-bold">💨 氣冷散熱量</span><div class="font-extrabold text-indigo-950 mt-0.5 text-sm">' + suSumm.airHeatKw.toFixed(1) + ' kW</div></div>'
                        + '</div>'
                        + '</div>';
                });

                duCardsHtml += '<div class="bg-gradient-to-br from-slate-50 to-purple-50/30 p-6 rounded-3xl border-2 border-purple-200 shadow-sm space-y-5">'
                    + '<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-purple-200 cursor-pointer" onclick="ViewHallSU.toggleDU(\'' + du.id + '\')">'
                    + '<div class="flex items-center gap-3">'
                    + '<span class="text-lg text-purple-700 font-black transition transform ' + (isExpanded ? 'rotate-90' : '') + '">▶</span>'
                    + '<div>'
                    + '<div class="flex items-center gap-2">'
                    + '<span class="text-xl font-black text-purple-950">🏢</span>'
                    + '<input type="text" value="' + window.UIKit.escapeHTML(du.name) + '" onclick="event.stopPropagation()" onchange="ViewHallSU.renameDU(\'' + currentHall.id + '\', \'' + du.id + '\', this.value)" class="text-base font-black text-purple-950 border rounded-xl px-3 py-1 bg-white border-purple-300">'
                    + '</div>'
                    + '<div class="text-xs text-purple-800 font-bold mt-1">'
                    + '冷卻單元彙總：IT <strong>' + duSumm.totalItKw.toFixed(1) + ' kW</strong> &middot; 💧 液冷 <strong>' + duSumm.liquidHeatKw.toFixed(1) + ' kW (' + duSumm.dlcPct.toFixed(1) + '%)</strong> &middot; 包含 <strong>' + du.sus.length + ' 組 SU</strong>'
                    + '</div>'
                    + '</div>'
                    + '</div>'
                    + '<div class="flex items-center gap-2" onclick="event.stopPropagation()">'
                    + '<button onclick="ViewHallSU.addSU(\'' + currentHall.id + '\', \'' + du.id + '\')" class="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition">➕ 新增 SU 模組</button>'
                    + '<button onclick="ViewHallSU.copyDU(\'' + currentHall.id + '\', \'' + du.id + '\')" class="px-3.5 py-2 bg-purple-100 hover:bg-purple-200 text-purple-950 font-bold text-xs rounded-xl transition">📋 複製 DU</button>'
                    + (currentHall.dus.length > 1 ? '<button onclick="ViewHallSU.deleteDU(\'' + currentHall.id + '\', \'' + du.id + '\')" class="px-3 py-2 bg-red-100 hover:bg-red-200 text-red-700 font-bold text-xs rounded-xl transition">✕</button>' : '')
                    + '</div>'
                    + '</div>'
                    + (isExpanded ? '<div class="space-y-4">' + suCardsHtml + '</div>' : '')
                    + '</div>';
            });

            container.innerHTML = `
                <div class="space-y-6">
                    <!-- 頂部 Hall 機房導航與模板一鍵建立 -->
                    <div class="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 space-y-4">
                        <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div>
                                <h2 class="text-xl font-black text-slate-900 flex items-center gap-2">
                                    <span>🧩</span> Step 2: Hall → DU → SU 模組與設備設計 (Hierarchy & Equipment Designer)
                                </h2>
                                <p class="text-xs text-slate-500 mt-1">
                                    建立 Hall 機房、劃分 <strong>DU (Data Center Unit 冷卻單元)</strong>，並於 DU 內組合 <strong>SU (Scalable Unit 算力模組)</strong> 自由配置 Vera Rubin / Blackwell / AMD Helios / 網通機架。
                                </p>
                            </div>
                            <div class="flex items-center gap-2 flex-wrap">
                                <button onclick="ViewHallSU.addHall()" class="px-4 py-2 bg-purple-700 hover:bg-purple-800 text-white font-black text-xs rounded-xl shadow-xs transition flex items-center gap-1.5">
                                    <span>➕</span> 新增 Hall 機房
                                </button>
                            </div>
                        </div>

                        <!-- Hall 切換頁籤與全展開/收合控制 -->
                        <div class="flex flex-col sm:flex-row sm:items-center justify-between pt-3 border-t gap-3">
                            <div class="flex items-center gap-2 overflow-x-auto">
                                ${hallTabs}
                            </div>
                            <div class="flex items-center gap-2 flex-wrap">
                                <div class="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1 rounded-xl border border-slate-200">
                                    <span class="text-[11px] font-bold text-slate-500">機房名稱:</span>
                                    <input type="text" value="${window.UIKit.escapeHTML(currentHall.name)}" onchange="ViewHallSU.renameHall('${currentHall.id}', this.value)" class="text-xs font-black text-purple-950 border border-purple-300 rounded-lg px-2 py-0.5 bg-white focus:ring-2 focus:ring-purple-400">
                                    ${halls.length > 1 ? `<button onclick="ViewHallSU.deleteHall('${currentHall.id}')" title="刪除當前機房" class="px-2 py-0.5 text-xs font-bold bg-red-50 hover:bg-red-100 text-red-700 rounded-lg border border-red-200 transition">🗑️ 刪除 Hall</button>` : ''}
                                </div>
                                <button onclick="ViewHallSU.expandAllDUs()" class="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition">
                                    📂 全部展開
                                </button>
                                <button onclick="ViewHallSU.collapseAllDUs()" class="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition">
                                    📁 全部收合
                                </button>
                                <div class="text-xs text-purple-900 font-black px-3 py-1.5 bg-purple-50 rounded-xl border border-purple-200">
                                    當前 Hall 總負載: ${(hallSumm.totalItKw / 1000).toFixed(2)} MW (💧 ${hallSumm.dlcPct.toFixed(1)}% 液冷)
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- DU 列表 -->
                    <div class="space-y-6">
                        ${duCardsHtml}
                    </div>

                    <div class="flex justify-between pt-2">
                        <button onclick="window.App.prevStep()" class="px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm rounded-xl transition">
                            <span>←</span> 上一步: 案場氣象
                        </button>
                        <button onclick="window.App.nextStep()" class="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl shadow-sm transition flex items-center gap-2">
                            下一步: CorePOD 核心機房設計 <span>→</span>
                        </button>
                    </div>
                </div>
            `;
            if (window.UIKit) window.UIKit.refreshIcons(container);
        },

        selectHall(id) {
            selectedHallId = id;
            this.render(document.getElementById('stepContent'));
        },
        toggleDU(duId) {
            if (expandedDuIds.has(duId)) {
                expandedDuIds.delete(duId);
            } else {
                expandedDuIds.add(duId);
            }
            this.render(document.getElementById('stepContent'));
        },
        expandAllDUs() {
            const currentHall = window.AppStore.state.halls.find(h => h.id === selectedHallId);
            if (currentHall) {
                currentHall.dus.forEach(d => expandedDuIds.add(d.id));
            }
            this.render(document.getElementById('stepContent'));
        },
        collapseAllDUs() {
            expandedDuIds.clear();
            this.render(document.getElementById('stepContent'));
        },
        addHall() {
            const newHall = window.AppStore.addHall();
            if (newHall) selectedHallId = newHall.id;
            this.render(document.getElementById('stepContent'));
        },
        deleteHall(hallId) {
            const hall = window.AppStore.state.halls.find(h => h.id === hallId);
            const hallName = hall ? hall.name : '此 Hall';
            if (typeof confirm === 'function' && !confirm(`確定要刪除「${hallName}」及其包含的所有 DU/SU 設備嗎？`)) {
                return;
            }
            const ok = window.AppStore.deleteHall(hallId);
            if (ok) {
                selectedHallId = window.AppStore.state.halls[0]?.id;
                this.render(document.getElementById('stepContent'));
            }
        },
        renameHall(hallId, name) {
            window.AppStore.renameHall(hallId, name);
            this.render(document.getElementById('stepContent'));
        },
        renameDU(hallId, duId, name) {
            const hall = window.AppStore.state.halls.find(h => h.id === hallId);
            if (hall) {
                const du = hall.dus.find(d => d.id === duId);
                if (du) {
                    du.name = name;
                    window.AppStore.notify();
                }
            }
        },
        renameSU(hallId, duId, suId, name) {
            const hall = window.AppStore.state.halls.find(h => h.id === hallId);
            if (hall) {
                const du = hall.dus.find(d => d.id === duId);
                if (du) {
                    const su = du.sus.find(s => s.id === suId);
                    if (su) {
                        su.name = name;
                        window.AppStore.notify();
                    }
                }
            }
        },
        addSU(hallId, duId) {
            window.AppStore.addSU(hallId, duId);
            expandedDuIds.add(duId);
            this.render(document.getElementById('stepContent'));
        },
        copyDU(hallId, duId) {
            window.AppStore.copyDU(hallId, duId);
            this.render(document.getElementById('stepContent'));
        },
        deleteDU(hallId, duId) {
            window.AppStore.deleteDU(hallId, duId);
            this.render(document.getElementById('stepContent'));
        },
        promptCopySU(hallId, duId, suId) {
            const countStr = prompt('請輸入要複製的 SU 數量 (1~16):', '3');
            if (countStr) {
                const n = parseInt(countStr, 10);
                if (n > 0) {
                    window.AppStore.copySU(hallId, duId, suId, n);
                    this.render(document.getElementById('stepContent'));
                }
            }
        },
        deleteSU(hallId, duId, suId) {
            window.AppStore.deleteSU(hallId, duId, suId);
            this.render(document.getElementById('stepContent'));
        },
        updateEquipQty(hallId, duId, suId, eqIdx, qty) {
            const hall = window.AppStore.state.halls.find(h => h.id === hallId);
            if (!hall) return;
            const du = hall.dus.find(d => d.id === duId);
            if (!du) return;
            const su = du.sus.find(s => s.id === suId);
            if (su && su.equipment && su.equipment[eqIdx]) {
                su.equipment[eqIdx].qty = qty;
                window.AppStore.notify();
                this.render(document.getElementById('stepContent'));
            }
        },
        updateEquipLiquid(hallId, duId, suId, eqIdx, liqPct) {
            const hall = window.AppStore.state.halls.find(h => h.id === hallId);
            if (!hall) return;
            const du = hall.dus.find(d => d.id === duId);
            if (!du) return;
            const su = du.sus.find(s => s.id === suId);
            if (su && su.equipment && su.equipment[eqIdx]) {
                const clamped = Math.max(0, Math.min(100, liqPct));
                su.equipment[eqIdx].liquidPct = clamped;
                su.equipment[eqIdx].airPct = 100 - clamped;
                window.AppStore.notify();
                this.render(document.getElementById('stepContent'));
            }
        },
        updateEquipKw(hallId, duId, suId, eqIdx, kw) {
            const hall = window.AppStore.state.halls.find(h => h.id === hallId);
            if (!hall) return;
            const du = hall.dus.find(d => d.id === duId);
            if (!du) return;
            const su = du.sus.find(s => s.id === suId);
            if (su && su.equipment && su.equipment[eqIdx]) {
                su.equipment[eqIdx].itLoadKw = Math.max(0, kw);
                window.AppStore.notify();
                this.render(document.getElementById('stepContent'));
            }
        },
        updateEquipModel(hallId, duId, suId, eqIdx, model) {
            const hall = window.AppStore.state.halls.find(h => h.id === hallId);
            if (!hall) return;
            const du = hall.dus.find(d => d.id === duId);
            if (!du) return;
            const su = du.sus.find(s => s.id === suId);
            if (su && su.equipment && su.equipment[eqIdx]) {
                su.equipment[eqIdx].model = model;
                window.AppStore.notify();
            }
        },
        deleteEquip(hallId, duId, suId, eqIdx) {
            const hall = window.AppStore.state.halls.find(h => h.id === hallId);
            if (!hall) return;
            const du = hall.dus.find(d => d.id === duId);
            if (!du) return;
            const su = du.sus.find(s => s.id === suId);
            if (su && su.equipment) {
                su.equipment.splice(eqIdx, 1);
                window.AppStore.notify();
                this.render(document.getElementById('stepContent'));
            }
        },
        quickAddEquip(hallId, duId, suId, cat, model, kw, liq, air) {
            const hall = window.AppStore.state.halls.find(h => h.id === hallId);
            if (!hall) return;
            const du = hall.dus.find(d => d.id === duId);
            if (!du) return;
            const su = du.sus.find(s => s.id === suId);
            if (su) {
                su.equipment = su.equipment || [];
                su.equipment.push({
                    id: 'eq_' + Date.now() + '_' + Math.floor(Math.random()*1000),
                    category: cat,
                    model: model,
                    qty: 1,
                    itLoadKw: kw,
                    liquidPct: liq,
                    airPct: air
                });
                window.AppStore.notify();
                this.render(document.getElementById('stepContent'));
            }
        },
        addCustomEquip(hallId, duId, suId) {
            const hall = window.AppStore.state.halls.find(h => h.id === hallId);
            if (!hall) return;
            const du = hall.dus.find(d => d.id === duId);
            if (!du) return;
            const su = du.sus.find(s => s.id === suId);
            if (su) {
                su.equipment = su.equipment || [];
                su.equipment.push({
                    id: 'eq_' + Date.now(),
                    category: 'CUSTOM',
                    model: '自訂設備單元',
                    qty: 1,
                    itLoadKw: 10.0,
                    liquidPct: 0,
                    airPct: 100
                });
                window.AppStore.notify();
                this.render(document.getElementById('stepContent'));
            }
        },
        addVeraRubinSU(hallId) {
            const hall = window.AppStore.state.halls.find(h => h.id === hallId);
            if (!hall) return;
            let targetDu = hall.dus[0];
            if (!targetDu) {
                window.AppStore.addDU(hallId, 'DU-01');
                targetDu = hall.dus[0];
            }
            const suIdx = targetDu.sus.length + 1;
            targetDu.sus.push({
                id: 'su_' + Date.now() + '_' + suIdx,
                name: 'SU-VR' + (suIdx < 10 ? '0' + suIdx : suIdx) + ' (Vera Rubin NVL72)',
                electricalLossFactorPct: 0.0,
                equipment: [
                    { id: 'eq_' + Date.now() + '_1', category: 'GPU', model: 'NVIDIA Vera Rubin VR200 NVL72', qty: 10, itLoadKw: 227.0, liquidPct: 95.0, airPct: 5.0 },
                    { id: 'eq_' + Date.now() + '_2', category: 'IB', model: 'NDR Leaf Switch (64p)', qty: 8, itLoadKw: 6.0, liquidPct: 0, airPct: 100.0 }
                ]
            });
            expandedDuIds.add(targetDu.id);
            window.AppStore.notify();
            this.render(document.getElementById('stepContent'));
        },
        addAmdHeliosSU(hallId) {
            const hall = window.AppStore.state.halls.find(h => h.id === hallId);
            if (!hall) return;
            let targetDu = hall.dus[0];
            if (!targetDu) {
                window.AppStore.addDU(hallId, 'DU-01');
                targetDu = hall.dus[0];
            }
            const suIdx = targetDu.sus.length + 1;
            targetDu.sus.push({
                id: 'su_' + Date.now() + '_' + suIdx,
                name: 'SU-Helios' + (suIdx < 10 ? '0' + suIdx : suIdx) + ' (AMD Helios)',
                electricalLossFactorPct: 0.0,
                equipment: [
                    { id: 'eq_' + Date.now() + '_1', category: 'GPU', model: 'AMD Helios', qty: 10, itLoadKw: 246.0, liquidPct: 89.0, airPct: 11.0 },
                    { id: 'eq_' + Date.now() + '_2', category: 'IB', model: 'NDR Leaf Switch (64p)', qty: 8, itLoadKw: 6.0, liquidPct: 0, airPct: 100.0 }
                ]
            });
            expandedDuIds.add(targetDu.id);
            window.AppStore.notify();
            this.render(document.getElementById('stepContent'));
        },
        addGB200SU(hallId) {
            const hall = window.AppStore.state.halls.find(h => h.id === hallId);
            if (!hall) return;
            let targetDu = hall.dus[0];
            if (!targetDu) {
                window.AppStore.addDU(hallId, 'DU-01');
                targetDu = hall.dus[0];
            }
            const suIdx = targetDu.sus.length + 1;
            targetDu.sus.push({
                id: 'su_' + Date.now() + '_' + suIdx,
                name: 'SU-GB' + (suIdx < 10 ? '0' + suIdx : suIdx) + ' (Blackwell GB200)',
                electricalLossFactorPct: 0.0,
                equipment: [
                    { id: 'eq_' + Date.now() + '_1', category: 'GPU', model: 'NVIDIA Blackwell GB200 NVL72', qty: 10, itLoadKw: 120.0, liquidPct: 90.0, airPct: 10.0 },
                    { id: 'eq_' + Date.now() + '_2', category: 'IB', model: 'NDR Leaf Switch (64p)', qty: 4, itLoadKw: 6.0, liquidPct: 0, airPct: 100.0 }
                ]
            });
            expandedDuIds.add(targetDu.id);
            window.AppStore.notify();
            this.render(document.getElementById('stepContent'));
        }
    };

    window.ViewHallSU = ViewHallSU;
})(window);
