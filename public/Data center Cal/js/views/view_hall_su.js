/**
 * view_hall_su.js - Step 2: Hall -> DU -> SU Collapsible Architecture with Template Builders (V21)
 */
(function(window) {
    'use strict';

    let selectedHallId = 'hall_1';
    let expandedDuIds = new Set(['du_1_1']); // 預設展開第 1 個 DU
    const t = (k, p, fb) => (window.I18N ? window.I18N.t(k, p) : (fb || k));

    const ViewHallSU = {
        render(container) {
            const S = window.AppStore;
            const state = S.state;
            const halls = state.halls || [];

            if (halls.length === 0) {
                container.innerHTML = '<div class="p-8 text-center bg-white rounded-2xl border">' + t('hall.noHalls', null, '尚無 Data Hall 機房資料，請點選「+ 新增 Hall」開始設計') + '</div>';
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
                    + (halls.length > 1 ? '<button onclick="event.stopPropagation(); ViewHallSU.deleteHall(\'' + h.id + '\')" title="' + t('hall.deleteTitle', null, '刪除此 Hall 機房') + '" class="px-2.5 py-2 text-xs font-black ' + (isSel ? 'hover:bg-purple-700 text-purple-200 hover:text-white border-l border-purple-500' : 'hover:bg-red-100 text-slate-400 hover:text-red-600 border-l border-slate-200') + ' transition">✕</button>' : '')
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
                            + '<td class="py-2 px-2.5 text-center"><div class="flex items-center justify-center gap-1"><input type="number" min="0" max="100" step="1" value="' + liqPct + '" oninput="ViewHallSU.updateEquipLiquid(\'' + currentHall.id + '\', \'' + du.id + '\', \'' + su.id + '\', ' + eqIdx + ', parseFloat(this.value)||0)" class="w-14 text-center font-black text-emerald-800 border border-emerald-300 rounded p-1 bg-emerald-50/50 focus:bg-white"><span class="text-xs font-bold text-slate-500">%</span></div><div class="text-[10px] text-slate-400 font-normal">' + t('su.airPct', { pct: airPct.toFixed(0) }, '氣冷 ' + airPct.toFixed(0) + '%') + '</div></td>'
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
                        + '<button onclick="ViewHallSU.promptCopySU(\'' + currentHall.id + '\', \'' + du.id + '\', \'' + su.id + '\')" class="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold rounded-lg border border-blue-200 transition">' + t('su.copyBtn', null, '📋 複製 SU×N') + '</button>'
                        + (du.sus.length > 1 ? '<button onclick="ViewHallSU.deleteSU(\'' + currentHall.id + '\', \'' + du.id + '\', \'' + su.id + '\')" class="px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-600 text-xs font-bold rounded-lg border border-red-200 transition">' + t('su.deleteBtn', null, '🗑️ 刪除 SU') + '</button>' : '')
                        + '</div>'
                        + '</div>'
                        + '<div class="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">'
                        + '<div class="flex justify-between items-center text-[11px] font-bold text-slate-700">'
                        + '<span>' + t('su.quickAdd', null, '⚡ 快速加入標準機架與網通設備 (Quick Add)') + '</span>'
                        + '<button onclick="ViewHallSU.addCustomEquip(\'' + currentHall.id + '\', \'' + du.id + '\', \'' + su.id + '\')" class="text-purple-700 hover:underline font-bold">' + t('su.customEquip', null, '+ 自訂設備') + '</button>'
                        + '</div>'
                        + '<div class="flex items-center gap-1.5 flex-wrap">' + quickChipsHtml + '</div>'
                        + '</div>'
                        + '<div class="overflow-x-auto">'
                        + '<table class="w-full text-left">'
                        + '<thead><tr class="text-[11px] font-bold text-slate-400 uppercase tracking-wider border-b"><th class="py-2 px-2.5">' + t('eqd.thCategory', null, '類別') + '</th><th class="py-2 px-2.5">' + t('eqd.thModel', null, '設備型號名稱') + '</th><th class="py-2 px-2.5 text-center">' + t('eqd.thQty', null, '台數') + '</th><th class="py-2 px-2.5 text-right">' + t('eqd.thUnitKw', null, '單台功耗') + '</th><th class="py-2 px-2.5 text-center">' + t('eqd.thLiquidPct', null, '液冷比') + '</th><th class="py-2 px-2.5 text-right">' + t('eqd.thSubtotal', null, '小計 IT (液冷)') + '</th><th class="py-2 px-2.5 text-center">' + t('eqd.thAction', null, '操作') + '</th></tr></thead>'
                        + '<tbody>' + (equipRows || '<tr><td colspan="7" class="py-4 text-center text-xs text-slate-400">' + t('su.emptyEquip', null, '目前尚無設備，請點選上方按鈕加入') + '</td></tr>') + '</tbody>'
                        + '</table>'
                        + '</div>'
                        + '<div class="grid grid-cols-3 gap-3 p-3 bg-slate-50 rounded-xl border text-xs">'
                        + '<div><span class="text-slate-400 font-bold">' + t('su.totalIt', null, '總 IT 負載') + '</span><div class="font-extrabold text-slate-900 mt-0.5 text-sm">' + suSumm.totalItKw.toFixed(1) + ' kW</div></div>'
                        + '<div><span class="text-purple-900 font-bold">' + t('su.liquidLoad', null, '💧 液冷散熱量') + '</span><div class="font-extrabold text-purple-950 mt-0.5 text-sm">' + suSumm.liquidHeatKw.toFixed(1) + ' kW (' + suSumm.dlcPct.toFixed(0) + '%)</div></div>'
                        + '<div><span class="text-indigo-900 font-bold">' + t('su.airLoad', null, '💨 氣冷散熱量') + '</span><div class="font-extrabold text-indigo-950 mt-0.5 text-sm">' + suSumm.airHeatKw.toFixed(1) + ' kW</div></div>'
                        + '</div>'
                        + '</div>';
                });

                const isLinked = !!du.templateRef?.linked;
                const tpl = isLinked ? S.getTemplate(du.templateRef.id) : null;
                const isOutdated = tpl ? (tpl.version > (du.templateRef.version || 1)) : false;

                let templateActionsHtml = '';
                if (isLinked) {
                    templateActionsHtml = '<div class="flex items-center gap-1.5 flex-wrap">'
                        + '<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200" title="' + (tpl ? window.UIKit.escapeHTML(tpl.name) : '') + '">'
                        + '🔗 ' + (tpl ? window.UIKit.escapeHTML(tpl.name) : t('template.linked', null, '已連結範本')) + ' v' + (du.templateRef.version || 1)
                        + '</span>'
                        + (isOutdated ? '<button onclick="ViewHallSU.syncDU(\'' + du.id + '\')" class="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs rounded-xl shadow-xs transition animate-pulse" title="' + t('template.updated', null, '範本已更新') + '">' + t('template.sync', null, '🔄 同步新版') + ' (v' + tpl.version + ')</button>' : '')
                        + '<button onclick="ViewHallSU.unlinkDU(\'' + du.id + '\')" class="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition">' + t('template.unlink', null, '解除連結') + '</button>'
                        + '</div>';
                } else {
                    const hasDuTemplates = (S.state.templates || []).some(t => t.kind === 'du');
                    templateActionsHtml = '<div class="flex items-center gap-1.5 flex-wrap">'
                        + '<button onclick="ViewHallSU.saveAsTemplate(\'' + du.id + '\')" class="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold text-xs rounded-xl border border-emerald-200 transition" title="' + t('template.saveAsTemplate', null, '💾 存為範本') + '">' + t('template.saveAsTemplate', null, '💾 存為範本') + '</button>'
                        + (hasDuTemplates ? '<button onclick="ViewHallSU.promptApplyTemplate(\'' + du.id + '\')" class="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-800 font-bold text-xs rounded-xl border border-blue-200 transition" title="' + t('template.applyTemplate', null, '📥 套用範本') + '">' + t('template.applyTemplate', null, '📥 套用範本') + '</button>' : '')
                        + '</div>';
                }

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
                    + t('du.summaryHtml', { it: duSumm.totalItKw.toFixed(1), liq: duSumm.liquidHeatKw.toFixed(1), dlc: duSumm.dlcPct.toFixed(1), n: du.sus.length })
                    + '</div>'
                    + '</div>'
                    + '</div>'
                    + '<div class="flex items-center gap-2 flex-wrap" onclick="event.stopPropagation()">'
                    + templateActionsHtml
                    + '<button onclick="ViewHallSU.addSU(\'' + currentHall.id + '\', \'' + du.id + '\')" class="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition">' + t('du.addSu', null, '➕ 新增 SU 模組') + '</button>'
                    + '<button onclick="ViewHallSU.copyDU(\'' + currentHall.id + '\', \'' + du.id + '\')" class="px-3.5 py-2 bg-purple-100 hover:bg-purple-200 text-purple-950 font-bold text-xs rounded-xl transition">' + t('du.copy', null, '📋 複製 DU') + '</button>'
                    + (currentHall.dus.length > 1 ? '<button onclick="ViewHallSU.deleteDU(\'' + currentHall.id + '\', \'' + du.id + '\')" class="px-3 py-2 bg-red-100 hover:bg-red-200 text-red-700 font-bold text-xs rounded-xl transition">✕</button>' : '')
                    + '</div>'
                    + '</div>'
                    + (isExpanded ? ('<div class="space-y-4">' + (isLinked ? ('<div class="p-3 bg-indigo-50/70 rounded-2xl border border-indigo-200 text-xs text-indigo-900 font-medium flex items-center justify-between"><span>🔗 ' + t('template.linkedNotice', null, '此 DU 已連結標準範本，設備由範本統一管理。如需個別微調，請點選上方「解除連結」。') + '</span></div>') : '') + suCardsHtml + '</div>') : '')
                    + '</div>';
            });

            let canSyncCount = 0;
            (S.state.halls || []).forEach(h => {
                (h.dus || []).forEach(d => {
                    if (d.templateRef?.linked && d.templateRef.id) {
                        const tpl = S.getTemplate(d.templateRef.id);
                        if (tpl && tpl.version > (d.templateRef.version || 1)) {
                            canSyncCount++;
                        }
                    }
                });
            });

            container.innerHTML = `
                <div class="space-y-6">
                    <!-- 頂部 Hall 機房導航與模板一鍵建立 -->
                    <div class="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 space-y-4">
                        <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div>
                                <h2 class="text-xl font-black text-slate-900 flex items-center gap-2">
                                    <span>🧩</span> ${t('hall.stepTitle', null, 'Step 2: Hall → DU → SU 模組與設備設計 (Hierarchy & Equipment Designer)')}
                                </h2>
                                <p class="text-xs text-slate-500 mt-1">
                                    ${t('hall.stepDesc', null, '建立 Hall 機房、劃分 <strong>DU (Data Center Unit 冷卻單元)</strong>，並於 DU 內組合 <strong>SU (Scalable Unit 算力模組)</strong> 自由配置 Vera Rubin / Blackwell / AMD Helios / 網通機架。')}
                                </p>
                            </div>
                            <div class="flex items-center gap-2 flex-wrap">
                                <button onclick="ViewHallSU.openTemplateManager()" class="px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 font-bold text-xs rounded-xl border border-indigo-200 transition flex items-center gap-1.5 shadow-2xs">
                                    <span>📚</span> ${t('template.title', null, '範本庫')} (${(S.state.templates || []).length})
                                </button>
                                ${(S.state.templates || []).filter(t => t.kind === 'du').length > 0 ? `
                                    <button onclick="ViewHallSU.promptBatchCreateDU('${currentHall.id}')" class="px-3.5 py-2 bg-purple-50 hover:bg-purple-100 text-purple-900 font-bold text-xs rounded-xl border border-purple-200 transition flex items-center gap-1.5 shadow-2xs">
                                        <span>📦</span> ${t('template.batchCreate', null, '從範本批次新增 DU')}
                                    </button>
                                ` : ''}
                                ${canSyncCount > 0 ? `
                                    <button onclick="ViewHallSU.syncAllOutdatedDUs()" class="px-3.5 py-2 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs rounded-xl shadow-xs transition animate-pulse flex items-center gap-1.5">
                                        <span>🔄</span> ${t('template.syncAll', null, '全部同步')} (${canSyncCount})
                                    </button>
                                ` : ''}
                                <button onclick="ViewHallSU.addHall()" class="px-4 py-2 bg-purple-700 hover:bg-purple-800 text-white font-black text-xs rounded-xl shadow-xs transition flex items-center gap-1.5">
                                    <span>➕</span> ${t('hall.addHallBtn', null, '新增 Hall 機房')}
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
                                    <span class="text-[11px] font-bold text-slate-500">${t('hall.nameLabel', null, '機房名稱:')}</span>
                                    <input type="text" value="${window.UIKit.escapeHTML(currentHall.name)}" onchange="ViewHallSU.renameHall('${currentHall.id}', this.value)" class="text-xs font-black text-purple-950 border border-purple-300 rounded-lg px-2 py-0.5 bg-white focus:ring-2 focus:ring-purple-400">
                                    ${halls.length > 1 ? `<button onclick="ViewHallSU.deleteHall('${currentHall.id}')" title="${t('hall.deleteCurrent', null, '刪除當前機房')}" class="px-2 py-0.5 text-xs font-bold bg-red-50 hover:bg-red-100 text-red-700 rounded-lg border border-red-200 transition">${t('hall.deleteCurrent', null, '🗑️ 刪除 Hall')}</button>` : ''}
                                </div>
                                <button onclick="ViewHallSU.expandAllDUs()" class="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition">
                                    ${t('hall.expandAll', null, '📂 全部展開')}
                                </button>
                                <button onclick="ViewHallSU.collapseAllDUs()" class="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition">
                                    ${t('hall.collapseAll', null, '📁 全部收合')}
                                </button>
                                <div class="text-xs text-purple-900 font-black px-3 py-1.5 bg-purple-50 rounded-xl border border-purple-200">
                                    ${t('hall.currentLoad', { mw: (hallSumm.totalItKw / 1000).toFixed(2), dlc: hallSumm.dlcPct.toFixed(1) })}
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
                            <span>←</span> ${t('hall.prevStep', null, '上一步: 案場氣象')}
                        </button>
                        <button onclick="window.App.nextStep()" class="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl shadow-sm transition flex items-center gap-2">
                            ${t('hall.nextStep', null, '下一步: CorePOD 核心機房設計')} <span>→</span>
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
            const hallName = hall ? hall.name : t('hall.thisHall', null, '此 Hall');
            if (typeof confirm === 'function' && !confirm(t('hall.deleteConfirm', { name: hallName }, `確定要刪除「${hallName}」及其包含的所有 DU/SU 設備嗎？`))) {
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
            const countStr = prompt(t('su.copyPrompt', null, '請輸入要複製的 SU 數量 (1~16):'), '3');
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
                    model: t('eqd.customUnitModel', null, '自訂設備單元'),
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
        },

        saveAsTemplate(duId) {
            const S = window.AppStore;
            let du = null;
            for (const h of (S.state.halls || [])) {
                du = (h.dus || []).find(d => d.id === duId);
                if (du) break;
            }
            if (!du) return;
            const defaultName = du.name + ' ' + t('template.defaultSuffix', null, '標準範本');
            const name = prompt(t('template.templateNamePrompt', null, '請輸入範本名稱:'), defaultName);
            if (!name) return;
            const hasTerminal = !!(du.plantDesign?.cduSystem?.sizing?.length || du.plantDesign?.fanwallSystem?.sizing?.length);
            let includeTerminal = false;
            if (hasTerminal) {
                includeTerminal = confirm(t('template.includeTerminalPrompt', null, '是否同時將終端設備選型 (CDU / CRAH 型號與冗餘) 納入範本？'));
            }
            S.saveDuAsTemplate(duId, name.trim(), includeTerminal);
            this.render(document.getElementById('stepContent'));
        },

        promptApplyTemplate(duId) {
            const S = window.AppStore;
            const duTemplates = (S.state.templates || []).filter(item => item.kind === 'du');
            if (duTemplates.length === 0) {
                alert(t('template.empty', null, '目前無已儲存的範本。'));
                return;
            }
            let choiceText = t('template.applyTemplate', null, '套用範本') + ':\n';
            duTemplates.forEach((tpl, idx) => {
                choiceText += (idx + 1) + '. ' + tpl.name + ' (v' + (tpl.version || 1) + ')\n';
            });
            choiceText += '\n' + t('template.selectTemplatePrompt', { n: duTemplates.length }, '請輸入欲套用的範本編號 (1-' + duTemplates.length + '):');
            const choice = prompt(choiceText, '1');
            if (!choice) return;
            const idx = parseInt(choice, 10) - 1;
            if (isNaN(idx) || idx < 0 || idx >= duTemplates.length) {
                return;
            }
            const selectedTpl = duTemplates[idx];
            S.applyTemplateToDu(duId, selectedTpl.id, true);
            this.render(document.getElementById('stepContent'));
        },

        unlinkDU(duId) {
            window.AppStore.unlinkDu(duId);
            this.render(document.getElementById('stepContent'));
        },

        syncDU(duId) {
            window.AppStore.syncDuWithTemplate(duId);
            this.render(document.getElementById('stepContent'));
        },

        syncAllOutdatedDUs() {
            const S = window.AppStore;
            const outdatedTplIds = new Set();
            (S.state.halls || []).forEach(h => {
                (h.dus || []).forEach(d => {
                    if (d.templateRef?.linked && d.templateRef.id) {
                        const tpl = S.getTemplate(d.templateRef.id);
                        if (tpl && tpl.version > (d.templateRef.version || 1)) {
                            outdatedTplIds.add(tpl.id);
                        }
                    }
                });
            });
            (S.state.corePods || []).forEach(p => {
                if (p.templateRef?.linked && p.templateRef.id) {
                    const tpl = S.getTemplate(p.templateRef.id);
                    if (tpl && tpl.version > (p.templateRef.version || 1)) {
                        outdatedTplIds.add(tpl.id);
                    }
                }
            });
            outdatedTplIds.forEach(id => S.syncAllDusLinkedToTemplate(id));
            this.render(document.getElementById('stepContent'));
        },

        promptBatchCreateDU(hallId) {
            const S = window.AppStore;
            const duTemplates = (S.state.templates || []).filter(item => item.kind === 'du');
            if (duTemplates.length === 0) {
                alert(t('template.empty', null, '目前無已儲存的範本。'));
                return;
            }
            let selectedTpl = duTemplates[0];
            if (duTemplates.length > 1) {
                let choiceText = t('template.batchCreate', null, '從範本批次新增 DU') + ':\n';
                duTemplates.forEach((tpl, idx) => {
                    choiceText += (idx + 1) + '. ' + tpl.name + ' (v' + (tpl.version || 1) + ')\n';
                });
                choiceText += '\n' + t('template.selectTemplatePrompt', { n: duTemplates.length }, '請輸入欲套用的範本編號 (1-' + duTemplates.length + '):');
                const choice = prompt(choiceText, '1');
                if (!choice) return;
                const idx = parseInt(choice, 10) - 1;
                if (isNaN(idx) || idx < 0 || idx >= duTemplates.length) return;
                selectedTpl = duTemplates[idx];
            }
            const countStr = prompt(t('template.countPrompt', null, '請輸入要新增的 DU 數量 (1 ~ 50):'), '4');
            if (!countStr) return;
            const count = parseInt(countStr, 10);
            if (isNaN(count) || count < 1 || count > 50) return;
            const prefix = prompt(t('template.namePrefixPrompt', null, '請輸入 DU 名稱前綴 (預設 DU-):'), 'DU-') || 'DU-';
            S.batchCreateDusFromTemplate(hallId, selectedTpl.id, count, prefix);
            this.render(document.getElementById('stepContent'));
        },

        openTemplateManager() {
            let modalEl = document.getElementById('templateManagerModal');
            if (!modalEl) {
                modalEl = document.createElement('div');
                modalEl.id = 'templateManagerModal';
                document.body.appendChild(modalEl);
            }
            this._renderTemplateManagerModal(modalEl);
        },

        closeTemplateManager() {
            const modalEl = document.getElementById('templateManagerModal');
            if (modalEl) {
                modalEl.remove();
            }
        },

        _renderTemplateManagerModal(modalEl) {
            const S = window.AppStore;
            const templates = S.state.templates || [];
            let duListHtml = '';
            let corePodListHtml = '';

            const getRefCount = (tplId) => {
                let cnt = 0;
                (S.state.halls || []).forEach(h => {
                    (h.dus || []).forEach(d => {
                        if (d.templateRef?.id === tplId && d.templateRef.linked) cnt++;
                    });
                });
                (S.state.corePods || []).forEach(p => {
                    if (p.templateRef?.id === tplId && p.templateRef.linked) cnt++;
                });
                return cnt;
            };

            templates.forEach(tpl => {
                const refCount = getRefCount(tpl.id);
                const itemHtml = '<div class="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">'
                    + '<div>'
                    + '<div class="flex items-center gap-2">'
                    + '<span class="font-extrabold text-sm text-slate-800">' + window.UIKit.escapeHTML(tpl.name) + '</span>'
                    + '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-700">v' + (tpl.version || 1) + '</span>'
                    + '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 text-slate-600">' + (tpl.kind === 'corepod' ? t('template.corePodTemplates', null, 'CorePOD') : t('template.duTemplates', null, 'DU')) + '</span>'
                    + '</div>'
                    + '<div class="text-xs text-slate-500 mt-1 flex items-center gap-3">'
                    + '<span>' + t('template.unitsLinked', { n: refCount }, '已連結 ' + refCount + ' 個單元') + '</span>'
                    + (tpl.updatedAt ? ('<span>' + new Date(tpl.updatedAt).toLocaleDateString() + '</span>') : '')
                    + '</div>'
                    + '</div>'
                    + '<div class="flex items-center gap-2">'
                    + '<button onclick="ViewHallSU.renameTemplate(\'' + tpl.id + '\')" class="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 font-bold text-xs rounded-xl transition">' + t('template.rename', null, '重新命名') + '</button>'
                    + '<button onclick="ViewHallSU.deleteTemplate(\'' + tpl.id + '\')" class="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 font-bold text-xs rounded-xl transition">' + t('template.delete', null, '刪除') + '</button>'
                    + '</div>'
                    + '</div>';

                if (tpl.kind === 'corepod') {
                    corePodListHtml += itemHtml;
                } else {
                    duListHtml += itemHtml;
                }
            });

            modalEl.className = 'fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs';
            modalEl.innerHTML = '<div class="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in duration-200">'
                + '<div class="p-6 border-b border-slate-200 flex items-center justify-between bg-gradient-to-r from-purple-50 to-indigo-50">'
                + '<div>'
                + '<h3 class="text-lg font-black text-slate-900 flex items-center gap-2"><span>📚</span> ' + t('template.title', null, '模組範本庫') + '</h3>'
                + '<p class="text-xs text-slate-500 mt-0.5">' + t('template.subtitle', null, '管理標準化 IT 與終端冷卻模組範本，支援一鍵套用與全場批次同步') + '</p>'
                + '</div>'
                + '<button onclick="ViewHallSU.closeTemplateManager()" class="text-slate-400 hover:text-slate-700 p-2 text-xl font-bold rounded-xl transition leading-none">✕</button>'
                + '</div>'
                + '<div class="p-6 overflow-y-auto space-y-6 flex-1">'
                + '<div class="flex items-center justify-between gap-3 flex-wrap pb-3 border-b border-slate-200">'
                + '<div class="flex items-center gap-2">'
                + '<button onclick="ViewHallSU.exportTemplates()" class="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 font-bold text-xs rounded-xl border border-indigo-200 transition flex items-center gap-1.5">'
                + '<span>📤</span> ' + t('template.export', null, '匯出範本 (.json)')
                + '</button>'
                + '<label class="px-3 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-900 font-bold text-xs rounded-xl border border-purple-200 transition flex items-center gap-1.5 cursor-pointer">'
                + '<span>📥</span> ' + t('template.import', null, '匯入範本')
                + '<input type="file" accept=".json" class="hidden" onchange="ViewHallSU.handleImportTemplates(this)">'
                + '</label>'
                + '</div>'
                + '<span class="text-xs text-slate-500 font-semibold">' + t('template.totalCount', { n: templates.length }, '共 ' + templates.length + ' 個範本') + '</span>'
                + '</div>'
                + '<div class="space-y-3">'
                + '<h4 class="text-xs font-black text-purple-950 uppercase tracking-wider flex items-center gap-2"><span>🏢</span> ' + t('template.duTemplates', null, 'DU 算力單元範本') + ' (' + ((templates.filter(item=>item.kind==='du')).length) + ')</h4>'
                + (duListHtml || ('<div class="p-6 text-center text-xs text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200">' + t('template.empty', null, '目前無已儲存的範本。') + '</div>'))
                + '</div>'
                + '<div class="space-y-3">'
                + '<h4 class="text-xs font-black text-teal-950 uppercase tracking-wider flex items-center gap-2"><span>📦</span> ' + t('template.corePodTemplates', null, 'CorePOD 核心機房範本') + ' (' + ((templates.filter(item=>item.kind==='corepod')).length) + ')</h4>'
                + (corePodListHtml || ('<div class="p-6 text-center text-xs text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200">' + t('template.empty', null, '目前無已儲存的範本。') + '</div>'))
                + '</div>'
                + '</div>'
                + '<div class="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">'
                + '<button onclick="ViewHallSU.closeTemplateManager()" class="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs rounded-xl transition">' + t('template.close', null, '關閉') + '</button>'
                + '</div>'
                + '</div>';
        },

        deleteTemplate(tplId) {
            if (!confirm(t('template.deleteConfirm', null, '確定要刪除此範本嗎？所有已連結之單元將自動解除連結。'))) return;
            window.AppStore.deleteTemplate(tplId);
            const modalEl = document.getElementById('templateManagerModal');
            if (modalEl) this._renderTemplateManagerModal(modalEl);
            this.render(document.getElementById('stepContent'));
        },

        renameTemplate(tplId) {
            const tpl = window.AppStore.getTemplate(tplId);
            if (!tpl) return;
            const newName = prompt(t('template.templateNamePrompt', null, '請輸入範本名稱:'), tpl.name);
            if (!newName || !newName.trim()) return;
            window.AppStore.updateTemplate(tplId, { name: newName.trim() });
            const modalEl = document.getElementById('templateManagerModal');
            if (modalEl) this._renderTemplateManagerModal(modalEl);
            this.render(document.getElementById('stepContent'));
        },

        exportTemplates() {
            const jsonStr = window.AppStore.exportTemplatesJson();
            if (typeof document === 'undefined') return;
            const blob = new Blob([jsonStr], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `pue_templates_${new Date().toISOString().slice(0, 10)}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        },

        handleImportTemplates(inputEl) {
            const file = inputEl.files?.[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const imported = window.AppStore.importTemplatesJson(e.target.result);
                    alert(t('template.importSuccess', { n: imported.length }, '成功匯入 ' + imported.length + ' 個範本！'));
                    const modalEl = document.getElementById('templateManagerModal');
                    if (modalEl) this._renderTemplateManagerModal(modalEl);
                    this.render(document.getElementById('stepContent'));
                } catch (err) {
                    alert(t('template.importFailed', { err: err.message || err }, '範本匯入失敗: ' + (err.message || err)));
                }
            };
            reader.readAsText(file);
        }
    };

    window.ViewHallSU = ViewHallSU;
})(window);
