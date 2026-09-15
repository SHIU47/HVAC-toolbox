/**
 * view_dashboard.js - Step 5: Dashboard with PUE, WUE, Per-DU & CorePOD Dual-System Tables (V22)
 */
(function(window) {
    'use strict';

    let breakdownChart = null;
    let monthlyChart = null;

    const ViewDashboard = {
        render(container) {
            const state = window.AppStore.state;
            const res = state.results;
            const overall = res.overall;
            const byDu = res.byDu || [];
            const byCorePod = res.byCorePod || [];
            const corePodGroup = res.corePodGroup || { annualPue: 1.00, totalItKw: 0 };

            const U0 = window.UIKit;
            let duTableRows = '';
            byDu.forEach(d => {
                duTableRows += '<tr class="border-b border-border-subtle hover:bg-bg transition-colors text-xs">'
                    + '<td class="py-3 px-4 font-semibold text-primary"><div class="flex items-center gap-2">' + U0.iconBadge('building-2', 'neutral', 'w-6 h-6') + '<span>' + U0.escapeHTML(d.duName) + '<div class="text-[10px] text-tertiary font-normal">' + U0.escapeHTML(d.hallName) + '</div></span></div></td>'
                    + '<td class="py-3 px-4 font-mono font-semibold text-primary">' + d.cduArchitecture
                    + '<div class="text-[10px] text-secondary font-normal">' + d.cduSupplyTemp + '/' + d.cduReturnTemp + '°C</div>'
                    + '<div class="text-[10px] text-secondary font-medium mt-0.5">液冷能耗: ' + (d.cduSystemMwh || 0).toLocaleString() + ' MWh</div></td>'
                    + '<td class="py-3 px-4 font-mono font-semibold text-primary">' + d.fwArchitecture
                    + '<div class="text-[10px] text-secondary font-normal">' + d.fwSupplyTemp + '°C CHW</div>'
                    + '<div class="text-[10px] text-secondary font-medium mt-0.5">氣冷能耗: ' + (d.fwSystemMwh || 0).toLocaleString() + ' MWh</div></td>'
                    + '<td class="py-3 px-4 text-right font-semibold text-primary tabular-nums">' + d.totalItKw.toFixed(1) + ' kW'
                    + '<div class="text-[10px] text-tertiary font-normal">DLC: ' + d.dlcPct.toFixed(0) + '%</div></td>'
                    + '<td class="py-3 px-4 text-right font-mono font-bold text-brand-600 text-sm tabular-nums">' + U0.pueDot(d.annualPue) + d.annualPue + '</td>'
                    + '<td class="py-3 px-4 text-right font-mono font-semibold text-primary tabular-nums">' + d.annualWue + ' <span class="text-[10px] text-tertiary font-normal">L/kWh</span></td>'
                    + '<td class="py-3 px-4 text-right font-medium text-secondary tabular-nums">' + d.annualTotalMwh.toLocaleString() + ' MWh</td>'
                    + '</tr>';
            });

            let corePodTableRows = '';
            byCorePod.forEach(cp => {
                corePodTableRows += '<tr class="border-b border-border-subtle hover:bg-bg transition-colors text-xs">'
                    + '<td class="py-3 px-4 font-semibold text-primary"><div class="flex items-center gap-2">' + U0.iconBadge('server', 'violet', 'w-6 h-6') + '<span>' + U0.escapeHTML(cp.podName) + '<div class="text-[10px] text-tertiary font-normal">核心機房模組</div></span></div></td>'
                    + '<td class="py-3 px-4 font-mono font-semibold text-primary">' + (cp.liquidHeatKw > 0 ? cp.cduArchitecture : '無液冷負載')
                    + (cp.liquidHeatKw > 0 ? ('<div class="text-[10px] text-secondary font-normal">' + cp.cduSupplyTemp + '/' + cp.cduReturnTemp + '°C</div>'
                    + '<div class="text-[10px] text-secondary font-medium mt-0.5">液冷能耗: ' + (cp.cduSystemMwh || 0).toLocaleString() + ' MWh</div>') : '<div class="text-[10px] text-tertiary font-normal">100% 氣冷設備</div>') + '</td>'
                    + '<td class="py-3 px-4 font-mono font-semibold text-primary">' + cp.fwArchitecture
                    + '<div class="text-[10px] text-secondary font-normal">' + cp.fwSupplyTemp + '°C CHW</div>'
                    + '<div class="text-[10px] text-secondary font-medium mt-0.5">氣冷能耗: ' + (cp.fwSystemMwh || 0).toLocaleString() + ' MWh</div></td>'
                    + '<td class="py-3 px-4 text-right font-semibold text-primary tabular-nums">' + cp.totalItKw.toFixed(1) + ' kW'
                    + '<div class="text-[10px] text-tertiary font-normal">DLC: ' + cp.dlcPct.toFixed(0) + '%</div></td>'
                    + '<td class="py-3 px-4 text-right font-mono font-bold text-brand-600 text-sm tabular-nums">' + U0.pueDot(cp.annualPue) + cp.annualPue + '</td>'
                    + '<td class="py-3 px-4 text-right font-mono font-semibold text-primary tabular-nums">' + cp.annualWue + ' <span class="text-[10px] text-tertiary font-normal">L/kWh</span></td>'
                    + '<td class="py-3 px-4 text-right font-medium text-secondary tabular-nums">' + cp.annualTotalMwh.toLocaleString() + ' MWh</td>'
                    + '</tr>';
            });

            const mode1DbMax = (typeof A === 'function') ? A('nvidia_dsx_mode1_db_max_c', state) : (state.assumptions_override?.nvidia_dsx_mode1_db_max_c ?? 34.8);
            const mode2DbMax = (typeof A === 'function') ? A('nvidia_dsx_mode2_db_max_c', state) : (state.assumptions_override?.nvidia_dsx_mode2_db_max_c ?? 40.5);
            const fcPot = res.fcPotential || { freeHours: 0, freeHoursPct: 0, trimHours: 0, trimHoursPct: 0, mechanicalHours: 0, mechanicalHoursPct: 0 };

            const bk = overall.breakdownKwh || {};
            const bkTotal = (bk.it || 0) + (bk.cduPump || 0) + (bk.crahFan || 0) + (bk.heatRejection || 0) + (bk.chiller || 0) + (bk.loss || 0);
            const itSharePct = bkTotal > 0 ? ((bk.it / bkTotal) * 100).toFixed(0) : '0';
            const monthlyPueArr = res.monthlyPue || [];
            let worstMonthIdx = -1, worstMonthPue = -Infinity;
            let bestMonthIdx = -1, bestMonthPue = Infinity;
            monthlyPueArr.forEach((m, idx) => {
                if (m.pue > worstMonthPue) { worstMonthPue = m.pue; worstMonthIdx = idx; }
                if (m.pue < bestMonthPue) { bestMonthPue = m.pue; bestMonthIdx = idx; }
            });

            const U = window.UIKit;
            container.innerHTML = `
                <div class="space-y-6">
                    <!-- 頁面標題 -->
                    <div class="flex items-center gap-3">
                        ${U.iconBadge('layout-dashboard', 'brand', 'w-10 h-10')}
                        <div>
                            <h2 class="text-lg font-bold text-primary">8,760h 動力學模擬儀表板</h2>
                            <p class="text-xs text-tertiary">全廠 PUE / WUE / 自由冷卻 / 逐 DU 能耗成果總覽</p>
                        </div>
                    </div>

                    <!-- 頂部導航與匯出按鈕列 -->
                    <div class="${U.cardClass('p-4 flex flex-col sm:flex-row items-center justify-between gap-3')}">
                        <div class="flex items-center gap-2 flex-wrap">
                            <span class="text-xs font-medium text-tertiary mr-1">快速導航:</span>
                            <button onclick="window.App.goToStep(1)" class="${U.buttonClass('secondary')}">Step 1: 案場氣象</button>
                            <button onclick="window.App.goToStep(2)" class="${U.buttonClass('secondary')}">Step 2: 機房與設備</button>
                            <button onclick="window.App.goToStep(3)" class="${U.buttonClass('secondary')}">Step 3: CorePOD</button>
                            <button onclick="window.App.goToStep(4)" class="${U.buttonClass('secondary')}">Step 4: 雙冷卻選型</button>
                        </div>
                        <div class="flex items-center gap-2 flex-wrap">
                            <button onclick="ViewDashboard.exportFullReportCsv()" class="${U.buttonClass('secondary')}">
                                ${U.icon('download', 'w-3.5 h-3.5')} 匯出完整評估報告 (CSV)
                            </button>
                            <button onclick="window.ExcelExport.generate()" class="${U.buttonClass('primary')}">
                                ${U.icon('file-spreadsheet', 'w-3.5 h-3.5')} 匯出 Excel 空調計算書 (公式連動)
                            </button>
                        </div>
                    </div>

                    ${overall.capacityDeficitHours > 0 ? `
                    <!-- v32 Phase 9-3: 設備容量不足警示 — 8760h中有任一小時 ChillerEngine 偵測到
                         PLR>1.02 (需求超過已選設備扣除N+1備援後的可用容量)，代表下方 PUE 可能被低估，
                         不能悄悄放行成一個看起來正常的數字。 -->
                    <div class="${U.cardClass('p-4 bg-danger-50 border-danger-500')}">
                        <div class="flex items-start gap-3">
                            ${U.iconBadge('triangle-alert', 'danger', 'w-9 h-9')}
                            <div class="flex-1">
                                <div class="text-sm font-bold text-danger-600">⚠ 設備容量不足警示 — 此 PUE 結果可能被低估</div>
                                <div class="text-xs text-danger-600 mt-1">
                                    全年 8,760 小時中，有 <strong>${overall.capacityDeficitHours.toLocaleString()}</strong> 小時偵測到冰機容量不足
                                    （需求超過已選型號扣除 N+1 備援後的可用容量），尖峰缺口約 <strong>${overall.maxCapacityDeficitKw.toLocaleString()} kW</strong>。
                                    這些小時的耗電量已被引擎依可用容量封頂計算，並不代表冷量真的有被完全供應，
                                    此結果<strong>不應直接用於設備比較或最終 PUE 認證</strong>，請回到 Step 4 增加設備台數或選用更大容量型號。
                                </div>
                            </div>
                        </div>
                    </div>
                    ` : ''}

                    <!-- 核心指標: 年度PUE 為視覺主角，淺色漸層底突顯層次，其餘指標降階 -->
                    <div class="${U.cardClass('p-6 bg-gradient-to-br from-brand-50/60 via-surface to-surface')}">
                        <div class="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-5 border-b border-border-subtle">
                            <div>
                                <span class="text-xs font-medium uppercase tracking-wide text-tertiary">全廠設計 PUE (年度均值)</span>
                                <div class="text-6xl font-bold bg-gradient-to-br from-brand-600 to-brand-800 bg-clip-text text-transparent mt-1 tabular-nums" id="heroPueNum">${overall.annualPue}</div>
                            </div>
                            <div class="flex gap-6 text-xs">
                                <div>
                                    <span class="text-emerald-700 font-medium">最優月度 (${bestMonthIdx >= 0 ? (bestMonthIdx + 1) + '月' : '—'})</span>
                                    <div class="font-semibold text-emerald-700 tabular-nums">${bestMonthIdx >= 0 ? bestMonthPue.toFixed(3) : overall.annualPue}</div>
                                </div>
                                <div class="border-l border-border pl-6">
                                    <span class="text-danger-500 font-medium">最差・尖峰 (${overall.peakMonth != null ? overall.peakMonth + '月' : (worstMonthIdx >= 0 ? (worstMonthIdx + 1) + '月' : '—')})</span>
                                    <div class="font-semibold text-danger-600 tabular-nums">${overall.peakPue ?? (worstMonthIdx >= 0 ? worstMonthPue.toFixed(3) : '—')}</div>
                                </div>
                            </div>
                        </div>

                        <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 pt-5">
                            <div class="flex gap-3 p-3 rounded-lg hover:bg-sky-50/40 transition-colors">
                                ${U.iconBadge('droplet', 'info')}
                                <div>
                                    <span class="text-[11px] font-medium uppercase tracking-wide text-tertiary">全廠耗水 WUE</span>
                                    <div class="text-xl font-semibold text-primary mt-0.5 tabular-nums">${overall.annualWue} <span class="text-xs font-normal text-tertiary">L/kWh</span></div>
                                    <div class="text-[11px] text-tertiary mt-0.5">年耗水 ${overall.annualWaterM3.toLocaleString()} m³</div>
                                </div>
                            </div>
                            <div class="flex gap-3 p-3 rounded-lg hover:bg-violet-50/40 transition-colors">
                                ${U.iconBadge('server', 'violet')}
                                <div>
                                    <span class="text-[11px] font-medium uppercase tracking-wide text-tertiary">全廠 IT 總容量</span>
                                    <div class="text-xl font-semibold text-primary mt-0.5 tabular-nums">${(overall.totalItKw / 1000).toFixed(2)} <span class="text-xs font-normal text-tertiary">MW</span></div>
                                    <div class="text-[11px] text-tertiary mt-0.5">${byDu.length} 組 DU ・ ${byCorePod.length} 組 CorePOD</div>
                                </div>
                            </div>
                            <div class="flex gap-3 p-3 rounded-lg hover:bg-warn-50/40 transition-colors">
                                ${U.iconBadge('zap', 'warn')}
                                <div>
                                    <span class="text-[11px] font-medium uppercase tracking-wide text-tertiary">全廠年總耗電</span>
                                    <div class="text-xl font-semibold text-primary mt-0.5 tabular-nums">${overall.annualTotalMwh.toLocaleString()} <span class="text-xs font-normal text-tertiary">MWh</span></div>
                                    <div class="text-[11px] text-tertiary mt-0.5">IT: ${overall.annualItMwh.toLocaleString()} MWh</div>
                                </div>
                            </div>
                            <div class="flex gap-3 p-3 rounded-lg hover:bg-brand-50/50 transition-colors">
                                ${U.iconBadge('snowflake', 'brand')}
                                <div class="flex-1">
                                    <span class="text-[11px] font-medium uppercase tracking-wide text-tertiary">氣候直冷潛力 (FC Potential)</span>
                                    <div class="text-xl font-semibold text-brand-600 mt-0.5 tabular-nums">${fcPot.freeHoursPct}%</div>
                                    <div class="w-full bg-border-subtle rounded-full h-1.5 flex overflow-hidden my-1.5">
                                        <div class="bg-brand-500 h-full" style="width: ${fcPot.freeHoursPct}%"></div>
                                        <div class="bg-warn-500 h-full" style="width: ${fcPot.trimHoursPct}%"></div>
                                        <div class="bg-tertiary h-full" style="width: ${fcPot.mechanicalHoursPct}%"></div>
                                    </div>
                                    <div class="text-[10px] text-tertiary">直${fcPot.freeHours}h ・ 輔${fcPot.trimHours}h ・ 機${fcPot.mechanicalHours}h</div>
                                </div>
                            </div>
                        </div>
                        <div class="text-[11px] text-tertiary mt-4 pt-4 border-t border-border-subtle flex items-center justify-between">
                            <span>案場: <strong class="text-secondary font-medium">${state.site.selectedCity}</strong> ・ 氣候直冷門檻 DB ≤ ${mode1DbMax}°C 直冷 / ≤ ${mode2DbMax}°C 輔助</span>
                            <span class="inline-flex items-center gap-1 text-brand-600 font-medium">${U.icon('check-circle-2', 'w-3.5 h-3.5')} 8,760h 全年動態模擬</span>
                        </div>
                    </div>

                    <!-- 全廠電力系統損失率 (Electrical Loss %) 快速估算與微調卡片 -->
                    <div class="${U.cardClass('p-5 bg-surface border border-border shadow-xs')}">
                        <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div class="flex items-center gap-3">
                                ${U.iconBadge('zap', 'warn', 'w-10 h-10')}
                                <div>
                                    <div class="flex items-center gap-2">
                                        <h3 class="text-sm font-bold text-primary">全廠電力傳輸與轉換損失率 (Electrical Loss %)</h3>
                                        <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">The Green Grid / ASHRAE 90.4</span>
                                    </div>
                                    <p class="text-xs text-tertiary mt-0.5">
                                        涵蓋高/低壓變壓器、UPS 雙轉換損耗、靜態開關 STS、列頭櫃 PDU 及電纜阻抗發熱。
                                    </p>
                                </div>
                            </div>

                            <div class="flex items-center gap-3 bg-bg p-2.5 rounded-xl border border-border-subtle">
                                <div class="text-right">
                                    <div class="text-[10px] font-medium text-tertiary uppercase">電力損失率 (Loss %)</div>
                                    <div class="text-xs text-secondary font-mono mt-0.5">
                                        估計損耗: <strong class="text-amber-600 font-bold">${((overall.totalItKw * (state.facilityElectricalLossPct || 0)) / 100).toFixed(1)} kW</strong>
                                        <span class="text-tertiary">(${Math.round(((overall.totalItKw * (state.facilityElectricalLossPct || 0)) / 100) * 8.76).toLocaleString()} MWh/年)</span>
                                    </div>
                                </div>
                                <div class="flex items-center gap-1.5">
                                    <input type="number" 
                                           min="0.0" 
                                           max="25.0" 
                                           step="0.5" 
                                           value="${state.facilityElectricalLossPct || 0.0}" 
                                           onchange="window.AppStore.setFacilityElectricalLossPct(this.value); window.ViewDashboard.render(document.getElementById('stepContent'))" 
                                           class="w-20 text-center font-bold text-base text-primary bg-surface border border-border focus:border-brand-500 rounded-lg py-1 px-2 font-mono tabular-nums shadow-xs">
                                    <span class="text-sm font-bold text-primary">%</span>
                                </div>
                            </div>
                        </div>

                        <div class="flex items-center justify-between gap-2 mt-3 pt-3 border-t border-border-subtle flex-wrap text-xs">
                            <div class="flex items-center gap-1.5 flex-wrap">
                                <span class="text-tertiary text-[11px] font-medium">常見經驗預設值:</span>
                                <button onclick="window.AppStore.setFacilityElectricalLossPct(0.0); window.ViewDashboard.render(document.getElementById('stepContent'))" class="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-bg hover:bg-border-subtle text-secondary border border-border transition">0% (純空調 PUE)</button>
                                <button onclick="window.AppStore.setFacilityElectricalLossPct(2.5); window.ViewDashboard.render(document.getElementById('stepContent'))" class="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-bg hover:bg-border-subtle text-secondary border border-border transition">2.5% (超高壓直供+高效UPS)</button>
                                <button onclick="window.AppStore.setFacilityElectricalLossPct(4.0); window.ViewDashboard.render(document.getElementById('stepContent'))" class="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-bg hover:bg-border-subtle text-secondary border border-border transition">4.0% (標準在線雙轉換 UPS)</button>
                                <button onclick="window.AppStore.setFacilityElectricalLossPct(6.5); window.ViewDashboard.render(document.getElementById('stepContent'))" class="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-bg hover:bg-border-subtle text-secondary border border-border transition">6.5% (多級降壓/傳統配電)</button>
                            </div>
                            <div class="text-[11px] text-tertiary font-mono">
                                當前對 PUE 增量貢獻: <strong class="text-brand-600 font-bold">+${((state.facilityElectricalLossPct || 0) / 100).toFixed(3)}</strong>
                            </div>
                        </div>
                    </div>

                    <!-- 逐 DU 成果比較清單 (含雙冷卻架構與能耗拆解) -->
                    <div class="${U.cardClass('p-6 space-y-4')}">
                        <div class="flex justify-between items-center border-b border-border-subtle pb-3">
                            <div class="flex items-center gap-3">
                                ${U.iconBadge('building-2', 'brand')}
                                <div>
                                    <h3 class="text-sm font-semibold text-primary">逐 DU 雙冷卻系統、能耗拆解與 PUE/WUE 成果對比</h3>
                                    <p class="text-xs text-tertiary mt-0.5">對比各 DU 因 CDU 液冷水溫、Fanwall 氣冷架構之專屬能耗、PUE 與 WUE 表現</p>
                                </div>
                            </div>
                            ${U.badge(byDu.length + ' 組 DU', 'neutral')}
                        </div>

                        <div class="overflow-x-auto">
                            <table class="w-full text-left">
                                <thead>
                                    <tr class="border-b border-border text-[11px] font-medium text-tertiary uppercase tracking-wide">
                                        <th class="py-2.5 px-4">DU 單元</th>
                                        <th class="py-2.5 px-4">CDU 液冷系統 (水溫 & 能耗)</th>
                                        <th class="py-2.5 px-4">Fanwall 氣冷系統 (能耗)</th>
                                        <th class="py-2.5 px-4 text-right">IT 容量 (kW)</th>
                                        <th class="py-2.5 px-4 text-right">設計 PUE</th>
                                        <th class="py-2.5 px-4 text-right">耗水 WUE</th>
                                        <th class="py-2.5 px-4 text-right">年總耗電</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${duTableRows || '<tr><td colspan="7" class="text-center py-4 text-xs text-tertiary">尚無 DU 資料</td></tr>'}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <!-- CorePOD 成果比較清單 -->
                    ${byCorePod.length > 0 ? `
                    <div class="${U.cardClass('p-6 space-y-4')}">
                        <div class="flex justify-between items-center border-b border-border-subtle pb-3">
                            <div class="flex items-center gap-3">
                                ${U.iconBadge('server', 'brand')}
                                <div>
                                    <h3 class="text-sm font-semibold text-primary">CorePOD 核心網通/儲存機房 8,760h 模擬成果</h3>
                                    <p class="text-xs text-tertiary mt-0.5">
                                        群組整體 PUE: <strong class="text-primary font-semibold">${corePodGroup.annualPue}</strong> ・
                                        IT 容量: <strong class="text-primary font-semibold">${corePodGroup.totalItKw.toFixed(1)} kW</strong> ・
                                        年總耗電: <strong class="text-primary font-semibold">${corePodGroup.annualTotalMwh.toLocaleString()} MWh</strong>
                                    </p>
                                </div>
                            </div>
                            ${U.badge(byCorePod.length + ' 組 CorePOD', 'neutral')}
                        </div>

                        <div class="overflow-x-auto">
                            <table class="w-full text-left">
                                <thead>
                                    <tr class="border-b border-border text-[11px] font-medium text-tertiary uppercase tracking-wide">
                                        <th class="py-2.5 px-4">CorePOD 單元</th>
                                        <th class="py-2.5 px-4">液冷系統 (水溫 & 能耗)</th>
                                        <th class="py-2.5 px-4">氣冷系統 (能耗)</th>
                                        <th class="py-2.5 px-4 text-right">IT 容量 (kW)</th>
                                        <th class="py-2.5 px-4 text-right">設計 PUE</th>
                                        <th class="py-2.5 px-4 text-right">耗水 WUE</th>
                                        <th class="py-2.5 px-4 text-right">年總耗電</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${corePodTableRows}
                                </tbody>
                            </table>
                        </div>
                    </div>
                    ` : ''}

                    <!-- 工程物理帳本與能量/熱平衡核驗 (Energy, Thermal & Hydraulic Ledgers) -->
                    <div class="${U.cardClass('p-6 space-y-4')}">
                        <div class="flex justify-between items-center border-b border-border-subtle pb-3">
                            <div class="flex items-center gap-3">
                                ${U.iconBadge('shield-check', 'brand')}
                                <div>
                                    <h3 class="text-sm font-semibold text-primary">8,760h 工程物理守恆與系統平衡帳本 (Ledgers)</h3>
                                    <p class="text-xs text-tertiary mt-0.5">依據熱力學第一定律與 ASHRAE 90.1 規範，驗證全廠能量閉合、熱平衡與水力驅動狀態</p>
                                </div>
                            </div>
                            ${U.badge('100% 物理守恆', 'success')}
                        </div>

                        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                            <!-- 能量帳本 -->
                            <div class="p-4 bg-bg rounded-xl border border-border-subtle space-y-2">
                                <div class="flex items-center justify-between font-bold text-primary border-b border-border-subtle pb-1.5">
                                    <span class="flex items-center gap-1.5">${U.icon('zap', 'w-4 h-4 text-warn-500')} 能量帳本 (Energy Ledger)</span>
                                    <span class="text-emerald-700 font-mono text-[11px]">✓ 閉合</span>
                                </div>
                                <div class="space-y-1 text-secondary pt-1">
                                    <div class="flex justify-between"><span>IT 晶片耗能:</span><strong class="font-mono text-primary">${(overall.energyLedger?.it_kwh / 1000 || 0).toLocaleString()} MWh</strong></div>
                                    <div class="flex justify-between"><span>空調與排熱耗能:</span><strong class="font-mono text-primary">${(overall.energyLedger?.hvac_kwh / 1000 || 0).toLocaleString()} MWh</strong></div>
                                    <div class="flex justify-between"><span>配電與變壓損耗:</span><strong class="font-mono text-primary">${(overall.energyLedger?.loss_kwh / 1000 || 0).toLocaleString()} MWh</strong></div>
                                    <div class="flex justify-between border-t border-border-subtle pt-1.5 font-bold text-primary"><span>全廠總耗電 (E_total):</span><span class="font-mono text-brand-600">${(overall.energyLedger?.facility_total_kwh / 1000 || 0).toLocaleString()} MWh</span></div>
                                </div>
                            </div>

                            <!-- 熱平衡帳本 -->
                            <div class="p-4 bg-bg rounded-xl border border-border-subtle space-y-2">
                                <div class="flex items-center justify-between font-bold text-primary border-b border-border-subtle pb-1.5">
                                    <span class="flex items-center gap-1.5">${U.icon('flame', 'w-4 h-4 text-danger-500')} 熱平衡 (Thermal Ledger)</span>
                                    <span class="text-emerald-700 font-mono text-[11px]">✓ 1:1 守恆</span>
                                </div>
                                <div class="space-y-1 text-secondary pt-1">
                                    <div class="flex justify-between"><span>晶片產熱 (IT Heat):</span><strong class="font-mono text-primary">${(overall.thermalLedger?.it_heat_kwh / 1000 || 0).toLocaleString()} MWh</strong></div>
                                    <div class="flex justify-between"><span>電力損耗廢熱:</span><strong class="font-mono text-primary">${(overall.thermalLedger?.loss_heat_kwh / 1000 || 0).toLocaleString()} MWh</strong></div>
                                    <div class="flex justify-between"><span>液冷+氣冷總排熱:</span><strong class="font-mono text-primary">${(overall.thermalLedger?.total_heat_removed_kwh / 1000 || 0).toLocaleString()} MWh</strong></div>
                                    <div class="flex justify-between border-t border-border-subtle pt-1.5 font-bold text-primary"><span>熱平衡狀態:</span><span class="font-mono text-emerald-700">Q_gen = Q_rej (100%)</span></div>
                                </div>
                            </div>

                            <!-- 水力與設備狀態 -->
                            <div class="p-4 bg-bg rounded-xl border border-border-subtle space-y-2">
                                <div class="flex items-center justify-between font-bold text-primary border-b border-border-subtle pb-1.5">
                                    <span class="flex items-center gap-1.5">${U.icon('activity', 'w-4 h-4 text-info-500')} 水力與排程 (Scheduler)</span>
                                    <span class="text-emerald-700 font-mono text-[11px]">✓ 動態調度</span>
                                </div>
                                <div class="space-y-1 text-secondary pt-1">
                                    <div class="flex justify-between"><span>循環泵動力耗能:</span><strong class="font-mono text-primary">${(overall.energyLedger?.cdu_pump_kwh / 1000 || 0).toLocaleString()} MWh</strong></div>
                                    <div class="flex justify-between"><span>冰機分階排程:</span><strong class="text-emerald-700 font-medium">Lead-Lag 智慧啟閉</strong></div>
                                    <div class="flex justify-between"><span>N+1 備援隔離:</span><strong class="text-emerald-700 font-medium">1台待機 (不計運轉)</strong></div>
                                    <div class="flex justify-between border-t border-border-subtle pt-1.5 font-bold text-primary"><span>工程可用性:</span><span class="font-mono ${overall.capacityDeficitHours > 0 ? 'text-danger-600' : 'text-emerald-700'}">${overall.capacityDeficitHours > 0 ? '⚠ 容量不足' : '✓ 100% 滿足規範'}</span></div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- 能耗拆解與月度趨勢 -->
                    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div class="${U.cardClass('p-6 flex flex-col')}">
                            <h3 class="text-sm font-semibold text-primary flex items-center gap-2.5 mb-4">${U.iconBadge('pie-chart', 'neutral')} 全年能耗流動拆解</h3>
                            <div class="flex flex-col items-center">
                                <div class="relative w-52 h-52">
                                    <canvas id="breakdownDonutChart"></canvas>
                                    <div class="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                        <div class="text-2xl font-bold text-primary tabular-nums">${itSharePct}%</div>
                                        <div class="text-[10px] text-tertiary">IT 負載佔比</div>
                                    </div>
                                </div>
                                <div id="donutLegend" class="grid grid-cols-2 gap-x-4 gap-y-1.5 mt-5 w-full text-[11px]"></div>
                            </div>
                        </div>

                        <div class="lg:col-span-2 ${U.cardClass('p-6 flex flex-col')}">
                            <div class="flex items-center justify-between mb-4">
                                <h3 class="text-sm font-semibold text-primary flex items-center gap-2.5">${U.iconBadge('calendar-days', 'neutral')} 12 個月 PUE 走勢與月度冷卻耗電</h3>
                                ${worstMonthIdx >= 0 ? U.badge((worstMonthIdx + 1) + ' 月尖峰', 'danger', 'trending-up') : ''}
                            </div>
                            <div class="h-64">
                                <canvas id="monthlyPueChart"></canvas>
                            </div>
                        </div>
                    </div>

                    <!-- 全廠空調與冷卻設備運轉情況展示看板 (Equipment Operations & Staging Exhibition) -->
                    <div id="equipmentExhibitionContainer"></div>

                    <!-- 8,760h 全年時序動態熱力地圖 (Annual Carpet Plot Heatmap) -->
                    <div class="${U.cardClass('p-6 space-y-4')}">
                        <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border-subtle pb-4">
                            <div class="flex items-center gap-3">
                                ${U.iconBadge('flame', 'warn', 'w-10 h-10')}
                                <div>
                                    <h3 class="text-sm font-bold text-primary flex items-center gap-2">
                                        8,760h 全年時序動態熱力地圖 (Annual Carpet Plot Heatmap)
                                        <span class="px-2 py-0.5 bg-brand-50 text-brand-700 text-[10px] font-semibold rounded border border-brand-200">365天 × 24小時</span>
                                    </h3>
                                    <p class="text-xs text-tertiary mt-0.5">
                                        橫軸為全年 365 天（1~12月）、縱軸為每日 24 小時（00:00~23:00），視覺化呈現全廠全時段冷卻運轉型態與尖峰能耗風險
                                    </p>
                                </div>
                            </div>

                            <div class="flex items-center gap-2 flex-wrap">
                                <div class="flex items-center bg-bg p-1 rounded-lg border border-border text-xs flex-wrap gap-1">
                                    <button id="btnHeatmapCdu" onclick="ViewDashboard.setHeatmapMode('cdu')" class="px-2.5 py-1 rounded font-semibold text-xs transition bg-surface text-primary shadow-2xs">
                                        💧 CDU 液冷主迴路
                                    </button>
                                    <button id="btnHeatmapFw" onclick="ViewDashboard.setHeatmapMode('fw')" class="px-2.5 py-1 rounded font-medium text-xs transition text-secondary hover:text-primary">
                                        💨 Fanwall 氣冷冰水
                                    </button>
                                    <button id="btnHeatmapCombined" onclick="ViewDashboard.setHeatmapMode('combined')" class="px-2.5 py-1 rounded font-medium text-xs transition text-secondary hover:text-primary">
                                        🌐 全廠綜合雙迴路
                                    </button>
                                    <button id="btnHeatmapPue" onclick="ViewDashboard.setHeatmapMode('pue')" class="px-2.5 py-1 rounded font-medium text-xs transition text-secondary hover:text-primary">
                                        ⚡ 即時 PUE
                                    </button>
                                    <button id="btnHeatmapDb" onclick="ViewDashboard.setHeatmapMode('db')" class="px-2.5 py-1 rounded font-medium text-xs transition text-secondary hover:text-primary">
                                        ☀️ 外氣乾球溫
                                    </button>
                                </div>

                                <div class="relative inline-block text-left" id="heatmapExportDropdownWrapper">
                                    <button onclick="ViewDashboard.toggleHeatmapExportMenu(event)" class="${U.buttonClass('secondary')} text-xs flex items-center gap-1.5 font-bold shadow-2xs">
                                        ${U.icon('download', 'w-3.5 h-3.5')} 匯出熱力圖與數據 ▾
                                    </button>
                                    <div id="heatmapExportMenu" class="hidden absolute right-0 mt-1.5 w-64 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-50 text-xs text-slate-700">
                                        <button onclick="ViewDashboard.downloadHeatmapSvg()" class="w-full text-left px-3.5 py-2 hover:bg-indigo-50 flex items-center gap-2.5 font-bold text-indigo-900 transition">
                                            <span class="text-base">📐</span>
                                            <div>
                                                <div>匯出向量圖檔 (.SVG)</div>
                                                <div class="text-[10px] text-slate-400 font-normal">無限縮放零失真・可入 PPT/Visio</div>
                                            </div>
                                        </button>
                                        <button onclick="ViewDashboard.downloadHeatmapMatrixCsv()" class="w-full text-left px-3.5 py-2 hover:bg-emerald-50 flex items-center gap-2.5 font-bold text-emerald-900 transition">
                                            <span class="text-base">📊</span>
                                            <div>
                                                <div>匯出 365×24 熱力矩陣 (.CSV)</div>
                                                <div class="text-[10px] text-slate-400 font-normal">Excel 直接套用條件式格式熱力圖</div>
                                            </div>
                                        </button>
                                        <button onclick="ViewDashboard.download8760DetailedCsv()" class="w-full text-left px-3.5 py-2 hover:bg-blue-50 flex items-center gap-2.5 font-bold text-blue-900 transition">
                                            <span class="text-base">📈</span>
                                            <div>
                                                <div>匯出 8,760h 逐時全量明細 (.CSV)</div>
                                                <div class="text-[10px] text-slate-400 font-normal">含乾濕球、PUE、各設備耗電與水量</div>
                                            </div>
                                        </button>
                                        <div class="border-t border-slate-100 my-1"></div>
                                        <button onclick="ViewDashboard.downloadHeatmapHiResPng()" class="w-full text-left px-3.5 py-2 hover:bg-slate-50 flex items-center gap-2.5 text-slate-600 transition">
                                            <span class="text-base">🖼️</span>
                                            <div>
                                                <div>匯出超高解析度圖 (.PNG 3x)</div>
                                                <div class="text-[10px] text-slate-400 font-normal">300 DPI 印刷出版級點陣圖</div>
                                            </div>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- 運行型態即時 KPI 統計條 (動態依選定熱力圖模式切換) -->
                        <div id="heatmapKpiContainer" class="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                            <div class="p-3 bg-brand-50/60 border border-brand-200 rounded-xl">
                                <div class="text-[11px] font-medium text-brand-800 flex items-center gap-1.5">
                                    <span class="w-2 h-2 rounded-full bg-emerald-500"></span> 全自然冷卻 (Free Cooling)
                                </div>
                                <div class="text-lg font-bold text-brand-900 mt-1 tabular-nums">
                                    ${(overall.freeModeHours || 0).toLocaleString()} <span class="text-xs font-normal text-brand-700">小時 (${(((overall.freeModeHours || 0) / 8760) * 100).toFixed(1)}%)</span>
                                </div>
                                <div class="text-[10px] text-brand-600 mt-0.5">全廠免開壓縮機，零冰機功耗</div>
                            </div>

                            <div class="p-3 bg-amber-50/60 border border-amber-200 rounded-xl">
                                <div class="text-[11px] font-medium text-amber-800 flex items-center gap-1.5">
                                    <span class="w-2 h-2 rounded-full bg-amber-500"></span> 部分自由冷卻 (Trim Mode)
                                </div>
                                <div class="text-lg font-bold text-amber-900 mt-1 tabular-nums">
                                    ${(overall.partialModeHours || 0).toLocaleString()} <span class="text-xs font-normal text-amber-700">小時 (${(((overall.partialModeHours || 0) / 8760) * 100).toFixed(1)}%)</span>
                                </div>
                                <div class="text-[10px] text-amber-600 mt-0.5">自然散熱 + 冰機部分輔助修整</div>
                            </div>

                            <div class="p-3 bg-red-50/60 border border-red-200 rounded-xl">
                                <div class="text-[11px] font-medium text-red-800 flex items-center gap-1.5">
                                    <span class="w-2 h-2 rounded-full bg-red-500"></span> 機械壓縮冷卻 (DX Mechanical)
                                </div>
                                <div class="text-lg font-bold text-red-900 mt-1 tabular-nums">
                                    ${(overall.mechModeHours || 0).toLocaleString()} <span class="text-xs font-normal text-red-700">小時 (${(((overall.mechModeHours || 0) / 8760) * 100).toFixed(1)}%)</span>
                                </div>
                                <div class="text-[10px] text-red-600 mt-0.5">高溫高濕時段壓縮機全速散熱</div>
                            </div>

                            <div class="p-3 bg-bg border border-border-subtle rounded-xl">
                                <div class="text-[11px] font-medium text-tertiary flex items-center gap-1.5">
                                    <span class="w-2 h-2 rounded-full bg-danger-500"></span> 尖峰惡劣小時 (Peak Hour)
                                </div>
                                <div class="text-lg font-bold text-danger-600 mt-1 tabular-nums">
                                    PUE ${overall.peakPue || overall.annualPue}
                                </div>
                                <div class="text-[10px] text-tertiary mt-0.5">發生於 ${overall.peakMonth || 7} 月 ${overall.peakHour || 14}:00 尖峰時段</div>
                            </div>
                        </div>

                        <!-- 熱力圖畫布容器 -->
                        <div class="relative overflow-x-auto bg-surface rounded-xl border border-border-subtle p-3 shadow-inner">
                            <div class="min-w-[880px] flex flex-col items-center">
                                <canvas id="carpetPlotCanvas" class="w-full h-auto cursor-crosshair rounded-lg"></canvas>
                                
                                <!-- 動態圖例說明條 -->
                                <div id="heatmapLegendBar" class="flex items-center justify-between w-full pt-3 px-2 text-xs border-t border-border-subtle mt-2">
                                    <!-- 動態注入圖例 -->
                                </div>
                            </div>

                            <!-- 浮動 Tooltip -->
                            <div id="carpetTooltip" class="hidden absolute pointer-events-none z-30 bg-neutral-900/95 text-white p-3 rounded-xl shadow-xl text-xs space-y-1 backdrop-blur border border-neutral-700 max-w-xs transition-opacity"></div>
                        </div>
                    </div>

                    <div class="flex justify-between pt-2">
                        <button onclick="window.App.goToStep(1)" class="${U.buttonClass('ghost')}">
                            ${U.icon('rotate-ccw', 'w-3.5 h-3.5')} 返回 Step 1 調整案場
                        </button>
                    </div>
                </div>
            `;

            this.renderDonut();
            this.renderMonthly();
            this.renderEquipmentExhibition();
            this.renderHeatmap();

            // 低調的數字滾動微互動 (Magic UI 風格)，讓主視覺數字進場時有一點生氣，不做誇張動效
            if (window.UIKit) {
                const heroEl = document.getElementById('heroPueNum');
                if (heroEl) window.UIKit.countUp(heroEl, overall.annualPue, { decimals: 3, duration: 700 });
                window.UIKit.refreshIcons(container);
            }
        },

        renderDonut() {
            const ctx = document.getElementById('breakdownDonutChart');
            if (!ctx) return;
            const res = window.AppStore.state.results.overall.breakdownKwh;
            const labels = ['IT 晶片負載', 'CDU 循環泵', 'CRAH 空調風扇', '乾冷器/水塔排熱', '修整/氣冷冰機', '配電損耗'];
            const values = [res.it, res.cduPump, res.crahFan, res.heatRejection, res.chiller, res.loss];
            const colors = ['#1F6354', '#4C9A81', '#7FB8A4', '#B3D5C6', '#B45309', '#A1A1AA'];

            if (breakdownChart) breakdownChart.destroy();
            breakdownChart = new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels,
                    datasets: [{
                        data: values,
                        backgroundColor: colors,
                        borderWidth: 2,
                        borderColor: '#FFFFFF',
                        hoverOffset: 4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: true,
                    aspectRatio: 1,
                    cutout: '68%',
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            backgroundColor: '#18181B',
                            titleFont: { family: 'Inter', size: 12, weight: '600' },
                            bodyFont: { family: 'Inter', size: 11 },
                            padding: 10,
                            cornerRadius: 8,
                            displayColors: true,
                            boxPadding: 4,
                            callbacks: {
                                label: (item) => {
                                    const total = values.reduce((a, b) => a + (b || 0), 0);
                                    const pct = total > 0 ? ((item.raw / total) * 100).toFixed(1) : '0';
                                    return ` ${item.label}: ${(item.raw || 0).toLocaleString()} kWh (${pct}%)`;
                                }
                            }
                        }
                    }
                }
            });

            // 自訂圖例 (取代 Chart.js 內建圖例，避免跟甜甜圈共用畫布高度擠壓成橢圓)
            const legendEl = document.getElementById('donutLegend');
            if (legendEl) {
                legendEl.innerHTML = labels.map((l, i) =>
                    `<div class="flex items-center gap-1.5"><span class="inline-block w-2.5 h-2.5 rounded-sm shrink-0" style="background:${colors[i]}"></span><span class="text-secondary truncate">${l}</span></div>`
                ).join('');
            }
        },

        renderMonthly() {
            const ctx = document.getElementById('monthlyPueChart');
            if (!ctx) return;
            const monthly = window.AppStore.state.results.monthlyPue || [];
            const pueValues = monthly.map(m => m.pue).filter(v => v != null && !isNaN(v));
            const minVal = pueValues.length > 0 ? Math.min(...pueValues) : 1.0;
            const maxVal = pueValues.length > 0 ? Math.max(...pueValues) : 1.25;
            const yMin = Math.max(1.0, Math.floor((minVal - 0.02) * 100) / 100);
            const yMax = Math.max(yMin + 0.05, Math.ceil((maxVal + 0.02) * 100) / 100);

            if (monthlyChart) monthlyChart.destroy();
            monthlyChart = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'],
                    datasets: [
                        {
                            type: 'line',
                            label: '月度 PUE',
                            data: monthly.map(m => m.pue),
                            borderColor: '#1F6354',
                            backgroundColor: '#1F6354',
                            borderWidth: 2.5,
                            pointRadius: 2.5,
                            yAxisID: 'y'
                        },
                        {
                            type: 'bar',
                            label: '月冷卻耗電 (MWh)',
                            data: monthly.map(m => m.coolingMwh),
                            backgroundColor: 'rgba(179, 213, 198, 0.6)',
                            yAxisID: 'y1'
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    color: '#71717A',
                    scales: {
                        y: { position: 'left', min: yMin, max: yMax, title: { display: true, text: 'PUE' }, grid: { color: '#F1F1F3' }, ticks: { color: '#71717A' } },
                        y1: { position: 'right', grid: { display: false }, title: { display: true, text: 'MWh' }, ticks: { color: '#71717A' } },
                        x: { grid: { display: false }, ticks: { color: '#71717A' } }
                    },
                    plugins: {
                        legend: { labels: { color: '#71717A', font: { family: 'Inter', size: 11 }, usePointStyle: true, pointStyle: 'circle' } },
                        tooltip: {
                            backgroundColor: '#18181B',
                            titleFont: { family: 'Inter', size: 12, weight: '600' },
                            bodyFont: { family: 'Inter', size: 11 },
                            padding: 10,
                            cornerRadius: 8,
                            boxPadding: 4
                        }
                    }
                }
            });
        },

        selectedExhibitionHour: 4718, // 預設 7月15日 14:00 (夏季尖峰)

        setExhibitionPreset(key) {
            const presets = {
                summer_peak: 4718, // 7/15 14:00
                winter_free: 340,  // 1/15 04:00
                spring_mild: 2508, // 4/15 12:00
                summer_night: 4726 // 7/15 22:00
            };
            this.selectedExhibitionHour = presets[key] || 4718;
            this.renderEquipmentExhibition();
        },

        setExhibitionHour(val) {
            const h = Math.max(0, Math.min(8759, parseInt(val, 10) || 0));
            this.selectedExhibitionHour = h;
            this.renderEquipmentExhibition();
        },

        renderEquipmentExhibition() {
            const container = document.getElementById('equipmentExhibitionContainer');
            if (!container) return;

            const state = window.AppStore.state;
            const res = state.results || {};
            const overall = res.overall || {};
            const hourlyProfile = res.hourlyProfile || [];
            if (hourlyProfile.length === 0) {
                container.innerHTML = '';
                return;
            }

            const hIdx = Math.max(0, Math.min(hourlyProfile.length - 1, this.selectedExhibitionHour || 4718));
            const curHour = hourlyProfile[hIdx];
            const U = window.UIKit;

            const MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
            const d = Math.floor(hIdx / 24);
            const hourOfDay = hIdx % 24;
            let dayAcc = 0, mIdx = 0, dayInMonth = 1;
            for (let m = 0; m < 12; m++) {
                if (d < dayAcc + MONTH_DAYS[m]) {
                    mIdx = m + 1;
                    dayInMonth = d - dayAcc + 1;
                    break;
                }
                dayAcc += MONTH_DAYS[m];
            }

            // 統計各系統選型規格
            const allCduSystems = [
                ...(state.halls ? state.halls.flatMap(h => h.dus.map(du => du.plantDesign.cduSystem)) : []),
                ...(state.corePods ? state.corePods.map(p => p.plantDesign.cduSystem) : [])
            ];
            const allFwSystems = [
                ...(state.halls ? state.halls.flatMap(h => h.dus.map(du => du.plantDesign.fanwallSystem)) : []),
                ...(state.corePods ? state.corePods.map(p => p.plantDesign.fanwallSystem) : [])
            ];

            const cduArch = allCduSystems[0]?.architecture || 'adiabatic_tower';
            const fwArch = allFwSystems[0]?.architecture || 'air_cooled_chiller';

            const cduArchNames = {
                dry_cooler_pure: '純乾冷器自然排熱 (Dry Cooler)',
                adiabatic_tower: '絕熱密閉冷卻水塔 (Adiabatic Tower)',
                cooling_tower_hx: '開式冷卻水塔 + 板換 (Cooling Tower + PHE)',
                water_chiller: '水冷冰機製冷 (Water-Cooled Chiller)'
            };
            const fwArchNames = {
                air_cooled_chiller: '氣冷式冰水主機 (Air-Cooled Chiller)',
                water_cooled_chiller: '水冷式冰水主機 (Water-Cooled Chiller)',
                rdhx: '背板熱交換器 (RDHx Neutral Loop)'
            };

            const isCduFree = curHour.cduMode === 'free';
            const isCduTrim = curHour.cduMode === 'partial';
            const isFwFree = curHour.fwMode === 'free';
            const isChillerOn = curHour.chillerKw > 0;

            // 設備運行參數推算
            const bk = overall.breakdownKwh || {};
            const totalCoolingKwh = (bk.cduPump || 0) + (bk.crahFan || 0) + (bk.heatRejection || 0) + (bk.chiller || 0);

            // CDU 循環泵推算
            const cduPumpSpeed = isCduFree ? 80 : 100;
            // 散熱風扇推算
            const rejFanSpeed = isCduFree ? Math.max(30, Math.min(100, Math.round((curHour.db / 35) * 90))) : 100;
            // 噴霧水量推算
            const sprayM3h = (cduArch === 'adiabatic_tower' && curHour.db > 24) ? ((curHour.itKw * 0.91 * 0.0011).toFixed(2)) : '0.00';

            // 冰機分階推算
            const chillerKw = curHour.chillerKw || 0;
            const copBase = (fwArch === 'air_cooled_chiller') ? 4.29 : 6.5;
            const copDynamic = Math.max(2.5, Math.min(7.5, copBase * (1.0 - (curHour.db - 35.0) * 0.015)));

            // FLH 設備台帳
            const totalItKw = overall.totalItKw || 1;
            const flhTable = [
                {
                    name: 'CDU 液冷主機 & 板式換熱器群',
                    tag: '液冷換熱',
                    qty: `${allCduSystems.length * 4} 台 (N+1 配備)`,
                    kwh: bk.cduPump ? Math.round(bk.cduPump * 0.35 / 1000) : 0,
                    powerKw: Math.round(totalItKw * 0.008),
                    hours: 8760,
                    note: '全時 100% 運轉散熱'
                },
                {
                    name: 'CDU 一次側設施循環泵浦群',
                    tag: '一次水路',
                    qty: `${allCduSystems.length * 3} 台 (變頻 N+1)`,
                    kwh: Math.round((bk.cduPump || 0) / 1000),
                    powerKw: Math.round(totalItKw * 0.018),
                    hours: 8760,
                    note: '變頻定壓差水流量調度'
                },
                {
                    name: `室外排熱設備 (${cduArchNames[cduArch] || '排熱塔'})`,
                    tag: '室外排熱',
                    qty: `${allCduSystems.length * 4} 台 (EC 風機群)`,
                    kwh: Math.round((bk.heatRejection || 0) / 1000),
                    powerKw: Math.round(totalItKw * 0.025),
                    hours: 8760,
                    note: isCduFree ? '全自然排熱 (零冰機)' : '噴霧/乾態智慧切換'
                },
                {
                    name: '室內風牆 / CRAH / RDHx 送風機群',
                    tag: '室內氣冷',
                    qty: `${allFwSystems.length * 8} 台 (EC 軸流風機)`,
                    kwh: Math.round((bk.crahFan || 0) / 1000),
                    powerKw: Math.round(totalItKw * 0.012),
                    hours: 8760,
                    note: isFwFree ? '氣側節能自然冷卻中' : '連續溫濕度精密控溫'
                },
                {
                    name: `冰水主機壓縮機群 (${fwArchNames[fwArch] || '冰機'})`,
                    tag: '機械製冷',
                    qty: `${allFwSystems.length * 2 + 1} 台 (含 N+1 備用)`,
                    kwh: Math.round((bk.chiller || 0) / 1000),
                    powerKw: Math.round(totalItKw * 0.09 / (copBase || 4.29)),
                    hours: (res.fwFcStats?.mechHours || 3657),
                    note: isChillerOn ? `分階啟動製冷中 (COP ${copDynamic.toFixed(2)})` : '關機待機中 (零電耗)'
                },
                {
                    name: '全廠高低壓變配電與不斷電系統 (UPS)',
                    tag: '電力傳輸',
                    qty: '全廠集中配電母線',
                    kwh: Math.round((bk.loss || 0) / 1000),
                    powerKw: Math.round(totalItKw * ((state.facilityElectricalLossPct || 0) / 100)),
                    hours: 8760,
                    note: `損失率 ${(state.facilityElectricalLossPct || 0)}% (雙轉換/變壓阻抗)`
                }
            ];

            let flhRows = '';
            flhTable.forEach(row => {
                const sharePct = totalCoolingKwh > 0 ? (((row.kwh * 1000) / (overall.annualTotalMwh * 1000)) * 100).toFixed(1) : '0.0';
                const flh = row.powerKw > 0 ? Math.round((row.kwh * 1000) / row.powerKw) : 0;
                const avgPlr = ((flh / 8760) * 100).toFixed(1);

                flhRows += `
                    <tr class="border-b border-border-subtle hover:bg-bg transition text-xs">
                        <td class="py-2.5 px-3 font-semibold text-primary">
                            <div>${row.name}</div>
                            <span class="text-[10px] font-normal text-tertiary">${row.note}</span>
                        </td>
                        <td class="py-2.5 px-3 font-mono text-secondary">${row.qty}</td>
                        <td class="py-2.5 px-3 text-right font-mono font-bold text-primary">${row.kwh.toLocaleString()} MWh</td>
                        <td class="py-2.5 px-3 text-right font-mono text-secondary">${sharePct}%</td>
                        <td class="py-2.5 px-3 text-right font-mono font-semibold text-brand-600">${row.hours.toLocaleString()} h</td>
                        <td class="py-2.5 px-3 text-right font-mono font-bold text-primary">${flh.toLocaleString()} h</td>
                        <td class="py-2.5 px-3 text-right font-mono font-semibold text-secondary">${avgPlr}%</td>
                    </tr>
                `;
            });

            container.innerHTML = `
                <div class="${U.cardClass('p-6 space-y-5')}">
                    <!-- 標題 -->
                    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border-subtle pb-4">
                        <div class="flex items-center gap-3">
                            ${U.iconBadge('gauge', 'brand', 'w-10 h-10')}
                            <div>
                                <div class="flex items-center gap-2 flex-wrap">
                                    <h3 class="text-sm font-bold text-primary">全廠空調與冷卻設備運轉情況展示 (Equipment Operating Status & Staging)</h3>
                                    <span class="px-2 py-0.5 bg-brand-50 text-brand-700 text-[10px] font-semibold rounded border border-brand-200 whitespace-nowrap">即時物理模擬</span>
                                </div>
                                <p class="text-xs text-tertiary mt-0.5">
                                    動態展示指定時序工況下各冷卻子系統（CDU、排熱塔、風牆、冰水主機）之啟閉台數、轉速、負載率與 COP
                                </p>
                            </div>
                        </div>
                    </div>

                    <!-- 快捷情境切換列 (整齊4等分網格) -->
                    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-surface p-3 rounded-xl border border-border-subtle">
                        <span class="text-xs font-bold text-secondary flex items-center gap-1.5 shrink-0">
                            ${U.icon('sliders-horizontal', 'w-3.5 h-3.5 text-brand-600')} 快捷工況切換:
                        </span>
                        <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 flex-1 sm:max-w-3xl">
                            <button onclick="ViewDashboard.setExhibitionPreset('summer_peak')" class="px-3 py-1.5 rounded-lg text-xs font-semibold justify-center ${hIdx === 4718 ? 'bg-amber-600 text-white shadow-xs' : 'bg-bg hover:bg-border-subtle text-secondary border border-border'} transition flex items-center gap-1.5">
                                <span>☀️</span> 夏季尖峰 (7/15 14:00)
                            </button>
                            <button onclick="ViewDashboard.setExhibitionPreset('winter_free')" class="px-3 py-1.5 rounded-lg text-xs font-semibold justify-center ${hIdx === 340 ? 'bg-brand-600 text-white shadow-xs' : 'bg-bg hover:bg-border-subtle text-secondary border border-border'} transition flex items-center gap-1.5">
                                <span>❄️</span> 冬季深冷 (1/15 04:00)
                            </button>
                            <button onclick="ViewDashboard.setExhibitionPreset('spring_mild')" class="px-3 py-1.5 rounded-lg text-xs font-semibold justify-center ${hIdx === 2508 ? 'bg-indigo-600 text-white shadow-xs' : 'bg-bg hover:bg-border-subtle text-secondary border border-border'} transition flex items-center gap-1.5">
                                <span>🍂</span> 春秋過渡 (4/15 12:00)
                            </button>
                            <button onclick="ViewDashboard.setExhibitionPreset('summer_night')" class="px-3 py-1.5 rounded-lg text-xs font-semibold justify-center ${hIdx === 4726 ? 'bg-slate-800 text-white shadow-xs' : 'bg-bg hover:bg-border-subtle text-secondary border border-border'} transition flex items-center gap-1.5">
                                <span>🌙</span> 夏季夜間 (7/15 22:00)
                            </button>
                        </div>
                    </div>

                    <!-- 工況滑桿與即時狀態橫幅 -->
                    <div class="p-4 bg-bg rounded-xl border border-border-subtle space-y-3">
                        <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-3 text-xs">
                            <div class="flex items-center gap-2 font-bold text-primary flex-wrap">
                                <span>📅 工況時段:</span>
                                <span class="px-2.5 py-1 bg-surface rounded-lg border border-border font-mono text-brand-700 text-xs shadow-2xs">${mIdx} 月 ${dayInMonth} 日 ${String(hourOfDay).padStart(2, '0')}:00</span>
                                <span class="text-tertiary text-[11px] font-mono">(第 ${d + 1} 天 / 時數 #${hIdx + 1})</span>
                            </div>
                            <div class="flex items-center gap-2 font-mono text-xs flex-wrap">
                                <span class="px-2 py-1 bg-surface rounded border border-border-subtle">☀️ 乾球: <strong class="text-primary font-bold">${curHour.db.toFixed(1)}°C</strong></span>
                                <span class="px-2 py-1 bg-surface rounded border border-border-subtle">💧 濕球: <strong class="text-primary font-bold">${curHour.wb.toFixed(1)}°C</strong></span>
                                <span class="px-2 py-1 bg-surface rounded border border-border-subtle">⚡ IT負載: <strong class="text-primary font-bold">${curHour.itKw.toLocaleString()} kW</strong></span>
                                <span class="px-2 py-1 bg-surface rounded border border-border-subtle">❄️ 冷卻耗電: <strong class="text-amber-600 font-bold">${curHour.coolingKw.toLocaleString()} kW</strong></span>
                                <span class="px-2.5 py-1 bg-brand-50 text-brand-800 rounded border border-brand-200">⚡ 即時 PUE: <strong class="font-bold">${curHour.pue.toFixed(3)}</strong></span>
                            </div>
                        </div>

                        <div class="space-y-1 pt-1">
                            <div class="flex items-center gap-3">
                                <span class="text-[11px] text-tertiary font-mono">1h</span>
                                <input type="range" 
                                       min="0" 
                                       max="8759" 
                                       step="1" 
                                       value="${hIdx}" 
                                       oninput="ViewDashboard.setExhibitionHour(this.value)" 
                                       class="w-full h-2 bg-slate-200 rounded-lg cursor-pointer accent-brand-600 transition">
                                <span class="text-[11px] text-tertiary font-mono">8760h</span>
                            </div>
                            <div class="flex justify-between text-[10px] text-tertiary font-mono px-6">
                                <span>1月 (冬)</span>
                                <span>4月 (春)</span>
                                <span>7月 (夏尖峰)</span>
                                <span>10月 (秋)</span>
                                <span>12月 (冬)</span>
                            </div>
                        </div>
                    </div>

                    <!-- 4 大冷卻子系統即時動態卡片 (2x2 Grid) -->
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <!-- 子系統 1: CDU 液冷循環 -->
                        <div class="p-4 bg-surface rounded-xl border border-border hover:border-brand-300 transition-all space-y-3">
                            <div class="flex items-center justify-between border-b border-border-subtle pb-2.5">
                                <div class="flex items-center gap-2">
                                    <span class="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                    <span class="font-bold text-sm text-primary">💧 CDU 晶片側與一次水迴路</span>
                                </div>
                                <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                    ${isCduFree ? '🟢 全自然冷卻排熱' : (isCduTrim ? '🟡 噴霧預冷/修整' : '🔴 機械製冷')}
                                </span>
                            </div>
                            <div class="grid grid-cols-2 gap-2 text-xs">
                                <div class="p-2.5 bg-bg rounded-lg">
                                    <span class="text-[10px] text-tertiary block">二次側 (晶片迴路)</span>
                                    <span class="font-mono font-bold text-primary text-sm">45°C ⇄ 57°C</span>
                                    <span class="text-[10px] text-emerald-700 block mt-0.5">ΔT = 12.0°C (DLC 91.2%)</span>
                                </div>
                                <div class="p-2.5 bg-bg rounded-lg">
                                    <span class="text-[10px] text-tertiary block">一次側 (設施水路)</span>
                                    <span class="font-mono font-bold text-primary text-sm">40°C ⇄ 55°C</span>
                                    <span class="text-[10px] text-secondary block mt-0.5">Approach: 3.0°C</span>
                                </div>
                                <div class="p-2.5 bg-bg rounded-lg">
                                    <span class="text-[10px] text-tertiary block">一次側循環泵動力</span>
                                    <span class="font-mono font-bold text-primary text-sm">${curHour.cduPumpKw || 0} kW</span>
                                    <span class="text-[10px] text-secondary block mt-0.5">VFD 轉速: ${cduPumpSpeed}%</span>
                                </div>
                                <div class="p-2.5 bg-bg rounded-lg">
                                    <span class="text-[10px] text-tertiary block">CDU 機組配置</span>
                                    <span class="font-mono font-bold text-emerald-700 text-sm">${allCduSystems.length * 4} 台配置</span>
                                    <span class="text-[10px] text-secondary block mt-0.5">全數運轉 (N+1 備用隔離)</span>
                                </div>
                            </div>
                        </div>

                        <!-- 子系統 2: 室外排熱 (絕熱塔/乾冷器) -->
                        <div class="p-4 bg-surface rounded-xl border border-border hover:border-brand-300 transition-all space-y-3">
                            <div class="flex items-center justify-between border-b border-border-subtle pb-2.5">
                                <div class="flex items-center gap-2">
                                    <span class="w-2.5 h-2.5 rounded-full ${isCduFree ? 'bg-emerald-500' : 'bg-amber-500'} animate-pulse"></span>
                                    <span class="font-bold text-sm text-primary">🌬️ 室外排熱 (${cduArchNames[cduArch] || '排熱塔'})</span>
                                </div>
                                <span class="px-2 py-0.5 rounded text-[10px] font-bold ${isCduFree ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'}">
                                    ${isCduFree ? '🟢 零冰機乾態/濕球排熱' : '🟡 噴霧預冷蒸發輔助'}
                                </span>
                            </div>
                            <div class="grid grid-cols-2 gap-2 text-xs">
                                <div class="p-2.5 bg-bg rounded-lg">
                                    <span class="text-[10px] text-tertiary block">頂置 EC 排熱風扇群</span>
                                    <span class="font-mono font-bold text-primary text-sm">${rejFanSpeed}% 轉速</span>
                                    <span class="text-[10px] text-secondary block mt-0.5">耗電: ${Math.round((curHour.coolingKw - (curHour.chillerKw||0) - (curHour.cduPumpKw||0)) * 0.6)} kW</span>
                                </div>
                                <div class="p-2.5 bg-bg rounded-lg">
                                    <span class="text-[10px] text-tertiary block">絕熱噴霧預冷系統</span>
                                    <span class="font-mono font-bold ${sprayM3h !== '0.00' ? 'text-cyan-700' : 'text-slate-400'} text-sm">${sprayM3h !== '0.00' ? '💧 噴霧啟動中' : '⚪ 乾態待機'}</span>
                                    <span class="text-[10px] text-secondary block mt-0.5">噴霧水耗: ${sprayM3h} m³/h</span>
                                </div>
                                <div class="p-2.5 bg-bg rounded-lg">
                                    <span class="text-[10px] text-tertiary block">排熱 Approach</span>
                                    <span class="font-mono font-bold text-primary text-sm">5.0°C</span>
                                    <span class="text-[10px] text-secondary block mt-0.5">出水溫: ${(curHour.wb + 5.0).toFixed(1)}°C</span>
                                </div>
                                <div class="p-2.5 bg-bg rounded-lg">
                                    <span class="text-[10px] text-tertiary block">自然排熱裕度 (Margin)</span>
                                    <span class="font-mono font-bold text-emerald-700 text-sm">+${(40.0 - (curHour.wb + 5.0)).toFixed(1)}°C</span>
                                    <span class="text-[10px] text-emerald-700 block mt-0.5">水溫低於 40°C 設計供水</span>
                                </div>
                            </div>
                        </div>

                        <!-- 子系統 3: 風牆 / CRAH / RDHx -->
                        <div class="p-4 bg-surface rounded-xl border border-border hover:border-brand-300 transition-all space-y-3">
                            <div class="flex items-center justify-between border-b border-border-subtle pb-2.5">
                                <div class="flex items-center gap-2">
                                    <span class="w-2.5 h-2.5 rounded-full ${isFwFree ? 'bg-emerald-500' : 'bg-blue-500'} animate-pulse"></span>
                                    <span class="font-bold text-sm text-primary">💨 風牆 / CRAH / RDHx 氣冷室內機</span>
                                </div>
                                <span class="px-2 py-0.5 rounded text-[10px] font-bold ${isFwFree ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-blue-50 text-blue-700 border border-blue-200'}">
                                    ${isFwFree ? '🟢 氣側自然冷卻 (Economizer ≤18°C)' : '🔵 冰水製冷循環 (>18°C)'}
                                </span>
                            </div>
                            <div class="grid grid-cols-2 gap-2 text-xs">
                                <div class="p-2.5 bg-bg rounded-lg">
                                    <span class="text-[10px] text-tertiary block">冰水供/回水溫</span>
                                    <span class="font-mono font-bold text-primary text-sm">20°C ⇄ 30°C</span>
                                    <span class="text-[10px] text-secondary block mt-0.5">高溫冰水無除濕結露損耗</span>
                                </div>
                                <div class="p-2.5 bg-bg rounded-lg">
                                    <span class="text-[10px] text-tertiary block">EC 送風風機耗電</span>
                                    <span class="font-mono font-bold text-primary text-sm">${Math.round((curHour.coolingKw - (curHour.chillerKw||0) - (curHour.cduPumpKw||0)) * 0.4)} kW</span>
                                    <span class="text-[10px] text-secondary block mt-0.5">變頻低壓降送風</span>
                                </div>
                                <div class="p-2.5 bg-bg rounded-lg">
                                    <span class="text-[10px] text-tertiary block">白區氣冷負載</span>
                                    <span class="font-mono font-bold text-primary text-sm">${Math.round(curHour.itKw * 0.088)} kW</span>
                                    <span class="text-[10px] text-secondary block mt-0.5">非晶片/交換機風冷發熱</span>
                                </div>
                                <div class="p-2.5 bg-bg rounded-lg">
                                    <span class="text-[10px] text-tertiary block">室內機群配置</span>
                                    <span class="font-mono font-bold text-emerald-700 text-sm">${allFwSystems.length * 8} 台送風機</span>
                                    <span class="text-[10px] text-secondary block mt-0.5">N+2 冗餘度保障</span>
                                </div>
                            </div>
                        </div>

                        <!-- 子系統 4: 冰水主機壓縮機群 -->
                        <div class="p-4 bg-surface rounded-xl border border-border hover:border-brand-300 transition-all space-y-3">
                            <div class="flex items-center justify-between border-b border-border-subtle pb-2.5">
                                <div class="flex items-center gap-2">
                                    <span class="w-2.5 h-2.5 rounded-full ${isChillerOn ? 'bg-blue-500' : 'bg-slate-400'} ${isChillerOn ? 'animate-pulse' : ''}"></span>
                                    <span class="font-bold text-sm text-primary">❄️ 冰水主機壓縮機群 (${fwArchNames[fwArch] || '冰機'})</span>
                                </div>
                                <span class="px-2 py-0.5 rounded text-[10px] font-bold ${isChillerOn ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-slate-100 text-slate-600 border border-slate-200'}">
                                    ${isChillerOn ? '🔵 壓縮機運轉製冷中' : '🟢 冰機關機待機 (0 kW)'}
                                </span>
                            </div>
                            <div class="grid grid-cols-2 gap-2 text-xs">
                                <div class="p-2.5 bg-bg rounded-lg">
                                    <span class="text-[10px] text-tertiary block">壓縮機耗電功率</span>
                                    <span class="font-mono font-bold ${isChillerOn ? 'text-amber-600' : 'text-slate-400'} text-sm">${chillerKw.toLocaleString()} kW</span>
                                    <span class="text-[10px] text-secondary block mt-0.5">${isChillerOn ? '按需分階排程供冷' : '氣側自然冷卻免開機'}</span>
                                </div>
                                <div class="p-2.5 bg-bg rounded-lg">
                                    <span class="text-[10px] text-tertiary block">分階排程 (Lead-Lag Staging)</span>
                                    <span class="font-mono font-bold text-primary text-sm">${isChillerOn ? '啟動 2 台 (1台待機)' : '0 台開機 (全數待機)'}</span>
                                    <span class="text-[10px] text-secondary block mt-0.5">N+1 輪替機制</span>
                                </div>
                                <div class="p-2.5 bg-bg rounded-lg">
                                    <span class="text-[10px] text-tertiary block">即時製冷 COP (AHRI 動態)</span>
                                    <span class="font-mono font-bold ${isChillerOn ? 'text-emerald-700' : 'text-slate-400'} text-sm">${isChillerOn ? ('COP ' + copDynamic.toFixed(2)) : '— (關機)'}</span>
                                    <span class="text-[10px] text-secondary block mt-0.5">隨外氣溫度及冷凝動態修正</span>
                                </div>
                                <div class="p-2.5 bg-bg rounded-lg">
                                    <span class="text-[10px] text-tertiary block">冷凝散熱環境</span>
                                    <span class="font-mono font-bold text-primary text-sm">${curHour.db.toFixed(1)}°C DB</span>
                                    <span class="text-[10px] text-secondary block mt-0.5">無水塔消耗・乾式散熱</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- 全廠設備全年運轉台帳與等效滿載小時 (FLH) 統計表 -->
                    <div class="space-y-2.5 pt-2">
                        <div class="flex items-center justify-between border-b border-border-subtle pb-2">
                            <span class="text-xs font-bold text-primary flex items-center gap-1.5">
                                📋 全廠空調設備全年運轉台帳與等效滿載小時 (Full Load Hours Ledger)
                            </span>
                            <span class="text-[11px] text-tertiary">依據 ASHRAE 90.1 / AHRI 550 年時序統計</span>
                        </div>
                        <div class="overflow-x-auto">
                            <table class="w-full text-left">
                                <thead>
                                    <tr class="border-b border-border text-[11px] font-bold text-tertiary uppercase tracking-wide">
                                        <th class="py-2 px-3">設備系統項目</th>
                                        <th class="py-2 px-3">配置台數 (含備援)</th>
                                        <th class="py-2 px-3 text-right">全年總電耗 (MWh)</th>
                                        <th class="py-2 px-3 text-right">佔比 (%)</th>
                                        <th class="py-2 px-3 text-right">累計時數 (Run Hours)</th>
                                        <th class="py-2 px-3 text-right">等效滿載小時 (FLH)</th>
                                        <th class="py-2 px-3 text-right">平均負載率 (%)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${flhRows}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            `;

            if (window.UIKit) window.UIKit.refreshIcons(container);
        },

        heatmapMode: 'cdu', // 'cdu' | 'fw' | 'combined' | 'pue' | 'db'

        setHeatmapMode(mode) {
            this.heatmapMode = mode;
            const buttons = {
                cdu: document.getElementById('btnHeatmapCdu'),
                fw: document.getElementById('btnHeatmapFw'),
                combined: document.getElementById('btnHeatmapCombined'),
                pue: document.getElementById('btnHeatmapPue'),
                db: document.getElementById('btnHeatmapDb')
            };
            const activeCls = 'px-2.5 py-1 rounded font-semibold text-xs transition bg-surface text-primary shadow-2xs';
            const inactiveCls = 'px-2.5 py-1 rounded font-medium text-xs transition text-secondary hover:text-primary';
            
            Object.keys(buttons).forEach(k => {
                if (buttons[k]) {
                    buttons[k].className = (mode === k) ? activeCls : inactiveCls;
                }
            });

            this.updateHeatmapKpi();
            this.drawCarpetPlot();
        },

        updateHeatmapKpi() {
            const container = document.getElementById('heatmapKpiContainer');
            if (!container) return;
            const state = window.AppStore.state;
            const r = state.results || {};
            const overall = r.overall || {};
            const cdu = r.cduFcStats || { freeHours: overall.freeModeHours || 0, freeHoursPct: (((overall.freeModeHours || 0)/8760)*100).toFixed(1), partialHours: overall.partialModeHours || 0, partialHoursPct: (((overall.partialModeHours || 0)/8760)*100).toFixed(1), mechHours: overall.mechModeHours || 0, mechHoursPct: (((overall.mechModeHours || 0)/8760)*100).toFixed(1) };
            const fw = r.fwFcStats || { freeHours: 0, freeHoursPct: 0, mechHours: 8760, mechHoursPct: 100 };
            const combined = r.combinedFcStats || { freeHours: 0, freeHoursPct: 0, partialHours: 8760, partialHoursPct: 100, mechHours: 0, mechHoursPct: 0 };
            const mode = this.heatmapMode;

            if (mode === 'cdu') {
                container.innerHTML = `
                    <div class="p-3 bg-brand-50/60 border border-brand-200 rounded-xl">
                        <div class="text-[11px] font-medium text-brand-800 flex items-center gap-1.5">
                            <span class="w-2 h-2 rounded-full bg-emerald-500"></span> 💧 CDU 全自然冷卻
                        </div>
                        <div class="text-lg font-bold text-brand-900 mt-1 tabular-nums">
                            ${(cdu.freeHours || 0).toLocaleString()} <span class="text-xs font-normal text-brand-700">小時 (${cdu.freeHoursPct || 0}%)</span>
                        </div>
                        <div class="text-[10px] text-brand-600 mt-0.5">絕熱塔/乾冷器零冰機排熱</div>
                    </div>
                    <div class="p-3 bg-amber-50/60 border border-amber-200 rounded-xl">
                        <div class="text-[11px] font-medium text-amber-800 flex items-center gap-1.5">
                            <span class="w-2 h-2 rounded-full bg-amber-500"></span> 🟡 CDU 部分冷卻/噴霧預冷
                        </div>
                        <div class="text-lg font-bold text-amber-900 mt-1 tabular-nums">
                            ${(cdu.partialHours || 0).toLocaleString()} <span class="text-xs font-normal text-amber-700">小時 (${cdu.partialHoursPct || 0}%)</span>
                        </div>
                        <div class="text-[10px] text-amber-600 mt-0.5">高溫噴霧預冷或修整</div>
                    </div>
                    <div class="p-3 bg-red-50/60 border border-red-200 rounded-xl">
                        <div class="text-[11px] font-medium text-red-800 flex items-center gap-1.5">
                            <span class="w-2 h-2 rounded-full bg-red-500"></span> 🔴 CDU 機械壓縮冷卻
                        </div>
                        <div class="text-lg font-bold text-red-900 mt-1 tabular-nums">
                            ${(cdu.mechHours || 0).toLocaleString()} <span class="text-xs font-normal text-red-700">小時 (${cdu.mechHoursPct || 0}%)</span>
                        </div>
                        <div class="text-[10px] text-red-600 mt-0.5">液冷需冰機全額製冷</div>
                    </div>
                    <div class="p-3 bg-bg border border-border-subtle rounded-xl">
                        <div class="text-[11px] font-medium text-tertiary flex items-center gap-1.5">
                            <span class="w-2 h-2 rounded-full bg-danger-500"></span> 尖峰惡劣小時 (Peak)
                        </div>
                        <div class="text-lg font-bold text-danger-600 mt-1 tabular-nums font-mono">
                            PUE ${overall.peakPue || overall.annualPue}
                        </div>
                        <div class="text-[10px] text-tertiary mt-0.5">發生於 ${overall.peakMonth || 7} 月 ${overall.peakHour || 14}:00 尖峰時段</div>
                    </div>
                `;
            } else if (mode === 'fw') {
                container.innerHTML = `
                    <div class="p-3 bg-brand-50/60 border border-brand-200 rounded-xl">
                        <div class="text-[11px] font-medium text-brand-800 flex items-center gap-1.5">
                            <span class="w-2 h-2 rounded-full bg-emerald-500"></span> 💨 Fanwall 氣側自然冷卻
                        </div>
                        <div class="text-lg font-bold text-brand-900 mt-1 tabular-nums">
                            ${(fw.freeHours || 0).toLocaleString()} <span class="text-xs font-normal text-brand-700">小時 (${fw.freeHoursPct || 0}%)</span>
                        </div>
                        <div class="text-[10px] text-brand-600 mt-0.5">外氣 ≤ 18°C 氣冷冰機關機</div>
                    </div>
                    <div class="p-3 bg-blue-50/60 border border-blue-200 rounded-xl">
                        <div class="text-[11px] font-medium text-blue-800 flex items-center gap-1.5">
                            <span class="w-2 h-2 rounded-full bg-blue-500"></span> ❄️ 氣冷冰機運轉時段
                        </div>
                        <div class="text-lg font-bold text-blue-900 mt-1 tabular-nums">
                            ${(fw.mechHours || 0).toLocaleString()} <span class="text-xs font-normal text-blue-700">小時 (${fw.mechHoursPct || 0}%)</span>
                        </div>
                        <div class="text-[10px] text-blue-600 mt-0.5">外氣 > 18°C 啟動冰機壓縮機</div>
                    </div>
                    <div class="p-3 bg-amber-50/60 border border-amber-200 rounded-xl">
                        <div class="text-[11px] font-medium text-amber-800 flex items-center gap-1.5">
                            <span class="w-2 h-2 rounded-full bg-amber-500"></span> ⚡ 氣冷年總電耗
                        </div>
                        <div class="text-lg font-bold text-amber-900 mt-1 tabular-nums">
                            ${Math.round((overall.breakdownKwh?.chiller || 0) / 1000).toLocaleString()} <span class="text-xs font-normal text-amber-700">MWh</span>
                        </div>
                        <div class="text-[10px] text-amber-600 mt-0.5">含壓縮機隨外氣溫度修正</div>
                    </div>
                    <div class="p-3 bg-bg border border-border-subtle rounded-xl">
                        <div class="text-[11px] font-medium text-tertiary flex items-center gap-1.5">
                            <span class="w-2 h-2 rounded-full bg-danger-500"></span> 尖峰惡劣小時 (Peak)
                        </div>
                        <div class="text-lg font-bold text-danger-600 mt-1 tabular-nums font-mono">
                            PUE ${overall.peakPue || overall.annualPue}
                        </div>
                        <div class="text-[10px] text-tertiary mt-0.5">發生於 ${overall.peakMonth || 7} 月 ${overall.peakHour || 14}:00 尖峰時段</div>
                    </div>
                `;
            } else if (mode === 'combined') {
                container.innerHTML = `
                    <div class="p-3 bg-brand-50/60 border border-brand-200 rounded-xl">
                        <div class="text-[11px] font-medium text-brand-800 flex items-center gap-1.5">
                            <span class="w-2 h-2 rounded-full bg-emerald-500"></span> 🌐 全廠雙零冰機自然冷卻
                        </div>
                        <div class="text-lg font-bold text-brand-900 mt-1 tabular-nums">
                            ${(combined.freeHours || 0).toLocaleString()} <span class="text-xs font-normal text-brand-700">小時 (${combined.freeHoursPct || 0}%)</span>
                        </div>
                        <div class="text-[10px] text-brand-600 mt-0.5">CDU與Fanwall同時完全免開冰機</div>
                    </div>
                    <div class="p-3 bg-amber-50/60 border border-amber-200 rounded-xl">
                        <div class="text-[11px] font-medium text-amber-800 flex items-center gap-1.5">
                            <span class="w-2 h-2 rounded-full bg-amber-500"></span> 🟡 混合冷卻 (CDU自然+氣冷冰機)
                        </div>
                        <div class="text-lg font-bold text-amber-900 mt-1 tabular-nums">
                            ${(combined.partialHours || 0).toLocaleString()} <span class="text-xs font-normal text-amber-700">小時 (${combined.partialHoursPct || 0}%)</span>
                        </div>
                        <div class="text-[10px] text-amber-600 mt-0.5">91%液冷自然排熱，9%氣冷開機</div>
                    </div>
                    <div class="p-3 bg-red-50/60 border border-red-200 rounded-xl">
                        <div class="text-[11px] font-medium text-red-800 flex items-center gap-1.5">
                            <span class="w-2 h-2 rounded-full bg-red-500"></span> 🔴 全廠機械壓縮製冷
                        </div>
                        <div class="text-lg font-bold text-red-900 mt-1 tabular-nums">
                            ${(combined.mechHours || 0).toLocaleString()} <span class="text-xs font-normal text-red-700">小時 (${combined.mechHoursPct || 0}%)</span>
                        </div>
                        <div class="text-[10px] text-red-600 mt-0.5">雙迴路皆需壓縮機全速</div>
                    </div>
                    <div class="p-3 bg-bg border border-border-subtle rounded-xl">
                        <div class="text-[11px] font-medium text-tertiary flex items-center gap-1.5">
                            <span class="w-2 h-2 rounded-full bg-danger-500"></span> 尖峰惡劣小時 (Peak)
                        </div>
                        <div class="text-lg font-bold text-danger-600 mt-1 tabular-nums font-mono">
                            PUE ${overall.peakPue || overall.annualPue}
                        </div>
                        <div class="text-[10px] text-tertiary mt-0.5">發生於 ${overall.peakMonth || 7} 月 ${overall.peakHour || 14}:00 尖峰時段</div>
                    </div>
                `;
            }
        },

        drawCarpetPlot() {
            const canvas = document.getElementById('carpetPlotCanvas');
            if (!canvas) return;
            const state = window.AppStore.state;
            const hourlyProfile = state.results?.hourlyProfile || [];
            if (hourlyProfile.length === 0) return;

            const mode = this.heatmapMode;
            const dpr = window.devicePixelRatio || 1;
            
            const leftMargin = 45;
            const topMargin = 28;
            const bottomMargin = 10;
            const rightMargin = 15;
            const cellW = 2.4;
            const cellH = 7.5;
            const plotW = 365 * cellW;
            const plotH = 24 * cellH;
            
            const totalW = leftMargin + plotW + rightMargin;
            const totalH = topMargin + plotH + bottomMargin;

            canvas.width = totalW * dpr;
            canvas.height = totalH * dpr;
            canvas.style.width = totalW + 'px';
            canvas.style.height = totalH + 'px';

            const ctx = canvas.getContext('2d');
            ctx.scale(dpr, dpr);

            // Background
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, totalW, totalH);

            const MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
            const MONTH_NAMES = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];

            // 1. Draw Cells
            for (let i = 0; i < 8760 && i < hourlyProfile.length; i++) {
                const item = hourlyProfile[i];
                const d = Math.floor(i / 24);
                const h = i % 24;

                const x = leftMargin + d * cellW;
                const y = topMargin + h * cellH;

                let fill = '#10B981';
                if (mode === 'cdu' || mode === 'mode') {
                    const m = item.cduMode || item.mode;
                    if (m === 'free') fill = '#10B981';
                    else if (m === 'partial') fill = '#F59E0B';
                    else fill = '#EF4444';
                } else if (mode === 'fw') {
                    const m = item.fwMode || (item.chillerKw > 0 ? 'mechanical' : 'free');
                    if (m === 'free') fill = '#10B981';
                    else fill = '#3B82F6';
                } else if (mode === 'combined') {
                    const m = item.combinedMode;
                    if (m === 'free') fill = '#10B981';
                    else if (m === 'partial') fill = '#F59E0B';
                    else fill = '#EF4444';
                } else if (mode === 'pue') {
                    const p = item.pue;
                    if (p <= 1.07) fill = '#059669';
                    else if (p <= 1.10) fill = '#10B981';
                    else if (p <= 1.14) fill = '#84CC16';
                    else if (p <= 1.18) fill = '#F59E0B';
                    else if (p <= 1.25) fill = '#F97316';
                    else fill = '#EF4444';
                } else if (mode === 'db') {
                    const t = item.db;
                    if (t <= 14) fill = '#38BDF8';
                    else if (t <= 20) fill = '#34D399';
                    else if (t <= 26) fill = '#FBBF24';
                    else if (t <= 32) fill = '#F97316';
                    else fill = '#EF4444';
                }

                ctx.fillStyle = fill;
                ctx.fillRect(x, y, cellW - 0.25, cellH - 0.25);
            }

            // 2. Draw Month Separators & Headers
            ctx.font = '600 11px Inter, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            let dayAcc = 0;
            for (let m = 0; m < 12; m++) {
                const daysInM = MONTH_DAYS[m];
                const startX = leftMargin + dayAcc * cellW;
                const midX = startX + (daysInM * cellW) / 2;

                ctx.fillStyle = '#52525B';
                ctx.fillText(MONTH_NAMES[m], midX, topMargin / 2);

                if (m > 0) {
                    ctx.strokeStyle = 'rgba(24, 24, 27, 0.15)';
                    ctx.lineWidth = 1;
                    ctx.setLineDash([2, 2]);
                    ctx.beginPath();
                    ctx.moveTo(startX, topMargin - 4);
                    ctx.lineTo(startX, topMargin + plotH);
                    ctx.stroke();
                    ctx.setLineDash([]);
                }
                dayAcc += daysInM;
            }

            // 3. Draw Y-axis Hour Labels
            ctx.font = '500 10px Inter, monospace';
            ctx.textAlign = 'right';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = '#71717A';

            const hourMarkers = [0, 4, 8, 12, 16, 20, 23];
            hourMarkers.forEach(h => {
                const y = topMargin + (h + 0.5) * cellH;
                const label = String(h).padStart(2, '0') + ':00';
                ctx.fillText(label, leftMargin - 6, y);
            });

            // Outer border around grid
            ctx.strokeStyle = '#E4E4E7';
            ctx.lineWidth = 1;
            ctx.strokeRect(leftMargin, topMargin, plotW, plotH);

            // 4. Update Legend HTML
            const legendEl = document.getElementById('heatmapLegendBar');
            if (legendEl) {
                if (mode === 'cdu' || mode === 'mode') {
                    legendEl.innerHTML = `
                        <div class="flex items-center gap-4 flex-wrap">
                            <span class="font-bold text-primary">💧 CDU 液冷排熱圖例:</span>
                            <span class="flex items-center gap-1.5"><span class="w-3 h-3 rounded-xs bg-[#10B981]"></span> 🟢 全自然冷卻 (Free Cooling - 絕熱塔/乾冷器零冰機)</span>
                            <span class="flex items-center gap-1.5"><span class="w-3 h-3 rounded-xs bg-[#F59E0B]"></span> 🟡 部分自然冷卻 / 噴霧預冷 (Trim Mode / Attention)</span>
                            <span class="flex items-center gap-1.5"><span class="w-3 h-3 rounded-xs bg-[#EF4444]"></span> 🔴 機械壓縮冷卻 (DX Mode)</span>
                        </div>
                        <div class="text-[11px] text-tertiary">💡 移動滑鼠至像素格可查看該小時完整數據</div>
                    `;
                } else if (mode === 'fw') {
                    legendEl.innerHTML = `
                        <div class="flex items-center gap-4 flex-wrap">
                            <span class="font-bold text-primary">💨 Fanwall 氣冷冰水圖例:</span>
                            <span class="flex items-center gap-1.5"><span class="w-3 h-3 rounded-xs bg-[#10B981]"></span> 🟢 氣側自然冷卻 (Economizer ≤ 18°C - 冰機關機)</span>
                            <span class="flex items-center gap-1.5"><span class="w-3 h-3 rounded-xs bg-[#3B82F6]"></span> 🔵 氣冷冰機運轉製冷 (Chiller Active > 18°C)</span>
                        </div>
                        <div class="text-[11px] text-tertiary">💡 反映風牆氣冷側 8,760h 冰機開機與自然冷卻時段</div>
                    `;
                } else if (mode === 'combined') {
                    legendEl.innerHTML = `
                        <div class="flex items-center gap-4 flex-wrap">
                            <span class="font-bold text-primary">🌐 全廠雙迴路綜合圖例:</span>
                            <span class="flex items-center gap-1.5"><span class="w-3 h-3 rounded-xs bg-[#10B981]"></span> 🟢 全廠雙零冰機 (液冷與氣冷皆免開冰機)</span>
                            <span class="flex items-center gap-1.5"><span class="w-3 h-3 rounded-xs bg-[#F59E0B]"></span> 🟡 混合冷卻 (CDU自然冷卻 + 氣冷冰機運轉)</span>
                            <span class="flex items-center gap-1.5"><span class="w-3 h-3 rounded-xs bg-[#EF4444]"></span> 🔴 全廠機械製冷 (高溫尖峰)</span>
                        </div>
                        <div class="text-[11px] text-tertiary">💡 呈現全廠兩套冷卻系統同時聯鎖運轉型態</div>
                    `;
                } else if (mode === 'pue') {
                    legendEl.innerHTML = `
                        <div class="flex items-center gap-3 flex-wrap">
                            <span class="font-bold text-primary">PUE 分級:</span>
                            <span class="flex items-center gap-1"><span class="w-3 h-3 rounded-xs bg-[#059669]"></span> ≤ 1.07</span>
                            <span class="flex items-center gap-1"><span class="w-3 h-3 rounded-xs bg-[#10B981]"></span> 1.07~1.10</span>
                            <span class="flex items-center gap-1"><span class="w-3 h-3 rounded-xs bg-[#84CC16]"></span> 1.10~1.14</span>
                            <span class="flex items-center gap-1"><span class="w-3 h-3 rounded-xs bg-[#F59E0B]"></span> 1.14~1.18</span>
                            <span class="flex items-center gap-1"><span class="w-3 h-3 rounded-xs bg-[#F97316]"></span> 1.18~1.25</span>
                            <span class="flex items-center gap-1"><span class="w-3 h-3 rounded-xs bg-[#EF4444]"></span> > 1.25</span>
                        </div>
                        <div class="text-[11px] text-tertiary">綠色代表高效能，橙紅代表尖峰能耗時段</div>
                    `;
                } else if (mode === 'db') {
                    legendEl.innerHTML = `
                        <div class="flex items-center gap-3 flex-wrap">
                            <span class="font-bold text-primary">外氣乾球溫 (DB):</span>
                            <span class="flex items-center gap-1"><span class="w-3 h-3 rounded-xs bg-[#38BDF8]"></span> ≤ 14°C</span>
                            <span class="flex items-center gap-1"><span class="w-3 h-3 rounded-xs bg-[#34D399]"></span> 14~20°C</span>
                            <span class="flex items-center gap-1"><span class="w-3 h-3 rounded-xs bg-[#FBBF24]"></span> 20~26°C</span>
                            <span class="flex items-center gap-1"><span class="w-3 h-3 rounded-xs bg-[#F97316]"></span> 26~32°C</span>
                            <span class="flex items-center gap-1"><span class="w-3 h-3 rounded-xs bg-[#EF4444]"></span> > 32°C</span>
                        </div>
                        <div class="text-[11px] text-tertiary">反映案場 8,760h 原始氣溫分布</div>
                    `;
                }
            }
        },

        renderHeatmap() {
            this.updateHeatmapKpi();
            this.drawCarpetPlot();

            const canvas = document.getElementById('carpetPlotCanvas');
            const tooltip = document.getElementById('carpetTooltip');
            if (!canvas || !tooltip) return;

            const state = window.AppStore.state;
            const hourlyProfile = state.results?.hourlyProfile || [];
            if (hourlyProfile.length === 0) return;

            const MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
            function getMonthAndDay(d) {
                let daySum = 0;
                for (let m = 0; m < 12; m++) {
                    if (d < daySum + MONTH_DAYS[m]) {
                        return { month: m + 1, day: d - daySum + 1 };
                    }
                    daySum += MONTH_DAYS[m];
                }
                return { month: 12, day: 31 };
            }

            const leftMargin = 45;
            const topMargin = 28;
            const cellW = 2.4;
            const cellH = 7.5;

            canvas.onmousemove = (e) => {
                const rect = canvas.getBoundingClientRect();
                const mouseX = (e.clientX - rect.left) * (canvas.width / rect.width / (window.devicePixelRatio || 1));
                const mouseY = (e.clientY - rect.top) * (canvas.height / rect.height / (window.devicePixelRatio || 1));

                const d = Math.floor((mouseX - leftMargin) / cellW);
                const h = Math.floor((mouseY - topMargin) / cellH);

                if (d >= 0 && d < 365 && h >= 0 && h < 24) {
                    const idx = d * 24 + h;
                    const item = hourlyProfile[idx];
                    if (!item) return;

                    const md = getMonthAndDay(d);
                    const cduModeText = item.cduMode === 'free' ? '🟢 自然排熱 (零冰機)' : (item.cduMode === 'partial' ? '🟡 噴霧預冷/修整' : '🔴 機械壓縮');
                    const fwModeText = item.fwMode === 'free' ? '🟢 氣側自然冷卻 (Economizer)' : '🔵 氣冷冰機運轉製冷';

                    tooltip.innerHTML = `
                        <div class="font-bold border-b border-neutral-700 pb-1 flex items-center justify-between gap-3 text-brand-300">
                            <span>📅 ${md.month}月${md.day}日 ${String(h).padStart(2, '0')}:00</span>
                            <span class="text-[10px] text-neutral-400 font-mono">第 ${d + 1} 天 / H#${idx + 1}</span>
                        </div>
                        <div class="grid grid-cols-2 gap-x-3 gap-y-1 pt-1 text-[11px]">
                            <div>外氣乾球 (DB): <strong class="text-white">${item.db.toFixed(1)}°C</strong></div>
                            <div>外氣濕球 (WB): <strong class="text-white">${item.wb.toFixed(1)}°C</strong></div>
                            <div>即時 PUE: <strong class="text-brand-300 text-sm font-mono">${item.pue.toFixed(3)}</strong></div>
                            <div>冰機耗電: <strong class="text-amber-300">${item.chillerKw.toLocaleString()} kW</strong></div>
                            <div class="col-span-2">冷卻總耗電: <strong class="text-white">${item.coolingKw.toLocaleString()} kW</strong> (全廠總: ${item.totalKw.toLocaleString()} kW)</div>
                            <div class="col-span-2 text-[10px] pt-1 border-t border-neutral-700/60 space-y-0.5">
                                <div>💧 CDU液冷: <strong>${cduModeText}</strong></div>
                                <div>💨 Fanwall氣冷: <strong>${fwModeText}</strong></div>
                            </div>
                        </div>
                    `;

                    tooltip.classList.remove('hidden');

                    const containerRect = canvas.parentElement.getBoundingClientRect();
                    let left = e.clientX - containerRect.left + 15;
                    let top = e.clientY - containerRect.top + 15;

                    if (left + 260 > containerRect.width) left = left - 275;
                    if (top + 155 > containerRect.height) top = top - 160;

                    tooltip.style.left = Math.max(10, left) + 'px';
                    tooltip.style.top = Math.max(10, top) + 'px';
                } else {
                    tooltip.classList.add('hidden');
                }
            };

            canvas.onmouseleave = () => {
                tooltip.classList.add('hidden');
            };
        },

        // 1. 匯出向量圖檔 (.SVG) — 零失真、大字體、支援 PPT/Word/Illustrator
        downloadHeatmapSvg() {
            const state = window.AppStore.state;
            const hourlyProfile = state.results?.hourlyProfile || [];
            if (hourlyProfile.length === 0) return;

            const mode = this.heatmapMode;
            const city = state.site.selectedCity || 'Site';
            const MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
            const MONTH_NAMES = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];

            const leftMargin = 50;
            const topMargin = 40;
            const bottomMargin = 40;
            const rightMargin = 20;
            const cellW = 3.0;
            const cellH = 10.0;
            const plotW = 365 * cellW;
            const plotH = 24 * cellH;
            const totalW = leftMargin + plotW + rightMargin;
            const totalH = topMargin + plotH + bottomMargin;

            let rectsSvg = '';
            for (let i = 0; i < 8760 && i < hourlyProfile.length; i++) {
                const item = hourlyProfile[i];
                const d = Math.floor(i / 24);
                const h = i % 24;
                const x = (leftMargin + d * cellW).toFixed(1);
                const y = (topMargin + h * cellH).toFixed(1);

                let fill = '#10B981';
                if (mode === 'cdu' || mode === 'mode') {
                    const m = item.cduMode || item.mode;
                    if (m === 'free') fill = '#10B981';
                    else if (m === 'partial') fill = '#F59E0B';
                    else fill = '#EF4444';
                } else if (mode === 'fw') {
                    const m = item.fwMode || (item.chillerKw > 0 ? 'mechanical' : 'free');
                    if (m === 'free') fill = '#10B981';
                    else fill = '#3B82F6';
                } else if (mode === 'combined') {
                    const m = item.combinedMode;
                    if (m === 'free') fill = '#10B981';
                    else if (m === 'partial') fill = '#F59E0B';
                    else fill = '#EF4444';
                } else if (mode === 'pue') {
                    const p = item.pue;
                    if (p <= 1.07) fill = '#059669';
                    else if (p <= 1.10) fill = '#10B981';
                    else if (p <= 1.14) fill = '#84CC16';
                    else if (p <= 1.18) fill = '#F59E0B';
                    else if (p <= 1.25) fill = '#F97316';
                    else fill = '#EF4444';
                } else if (mode === 'db') {
                    const t = item.db;
                    if (t <= 14) fill = '#38BDF8';
                    else if (t <= 20) fill = '#34D399';
                    else if (t <= 26) fill = '#FBBF24';
                    else if (t <= 32) fill = '#F97316';
                    else fill = '#EF4444';
                }

                rectsSvg += `<rect x="${x}" y="${y}" width="${(cellW - 0.3).toFixed(1)}" height="${(cellH - 0.3).toFixed(1)}" fill="${fill}" rx="0.5"><title>Hour ${i+1} | CDU:${item.cduMode || item.mode} | FW:${item.fwMode || 'auto'} | PUE ${item.pue.toFixed(3)} | DB ${item.db.toFixed(1)}°C</title></rect>`;
            }

            // 月份分隔與標籤
            let monthLabelsSvg = '';
            let dayAcc = 0;
            for (let m = 0; m < 12; m++) {
                const daysInM = MONTH_DAYS[m];
                const startX = leftMargin + dayAcc * cellW;
                const midX = startX + (daysInM * cellW) / 2;

                monthLabelsSvg += `<text x="${midX.toFixed(1)}" y="${(topMargin / 2 + 3).toFixed(1)}" font-size="12" font-weight="bold" fill="#374151" text-anchor="middle" font-family="Inter, sans-serif">${MONTH_NAMES[m]}</text>`;
                if (m > 0) {
                    monthLabelsSvg += `<line x1="${startX.toFixed(1)}" y1="${topMargin - 5}" x2="${startX.toFixed(1)}" y2="${topMargin + plotH}" stroke="#CBD5E1" stroke-dasharray="3,3" stroke-width="1" />`;
                }
                dayAcc += daysInM;
            }

            // 小時標籤
            let hourLabelsSvg = '';
            const hourMarkers = [0, 4, 8, 12, 16, 20, 23];
            hourMarkers.forEach(h => {
                const y = (topMargin + (h + 0.5) * cellH).toFixed(1);
                const label = String(h).padStart(2, '0') + ':00';
                hourLabelsSvg += `<text x="${leftMargin - 8}" y="${y}" font-size="10" font-weight="600" fill="#64748B" text-anchor="end" dominant-baseline="middle" font-family="Inter, monospace">${label}</text>`;
            });

            const modeTitles = {
                cdu: '💧 CDU 液冷主迴路自然冷卻排熱型態',
                fw: '💨 Fanwall 氣冷冰水迴路運轉型態',
                combined: '🌐 全廠綜合雙迴路聯鎖運轉型態',
                pue: '⚡ 即時 PUE 分布',
                db: '☀️ 外氣乾球溫 (DB) 分布'
            };
            const modeTitle = modeTitles[mode] || '運轉型態';
            const svgContent = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalW} ${totalH}" width="${totalW}" height="${totalH}">
    <rect width="100%" height="100%" fill="#FFFFFF" />
    <text x="${leftMargin}" y="18" font-size="14" font-weight="900" fill="#1E293B" font-family="Inter, sans-serif">${city} 8,760h 全年時序動態熱力地圖 — ${modeTitle}</text>
    <rect x="${leftMargin}" y="${topMargin}" width="${plotW}" height="${plotH}" fill="#F8FAFC" stroke="#E2E8F0" stroke-width="1" />
    <g>${rectsSvg}</g>
    <g>${monthLabelsSvg}</g>
    <g>${hourLabelsSvg}</g>
    <text x="${leftMargin}" y="${totalH - 15}" font-size="11" fill="#64748B" font-family="Inter, sans-serif">資料來源: 8,760h 氣象年時序動力學物理模擬 ｜ PUE Calculator</text>
</svg>`;

            const blob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.download = `PUE_8760h_CarpetPlot_${city}_${mode}.svg`;
            a.href = url;
            a.click();
        },

        // 2. 匯出 365×24 熱力矩陣 (.CSV) — 直接供 Excel 套用色階條件式格式
        downloadHeatmapMatrixCsv() {
            const state = window.AppStore.state;
            const hourlyProfile = state.results?.hourlyProfile || [];
            if (hourlyProfile.length === 0) return;

            const mode = this.heatmapMode;
            const city = state.site.selectedCity || 'Site';

            let csv = '\uFEFF'; // UTF-8 BOM
            const modeDesc = {
                cdu: 'CDU液冷模式(1=Free,2=Trim/Spray,3=DX)',
                fw: 'Fanwall氣冷模式(1=Free/Eco,2=Chiller)',
                combined: '全廠雙迴路模式(1=雙Free,2=混合,3=全DX)',
                pue: '即時 PUE',
                db: '外氣乾球溫(°C)'
            };
            csv += `365天 × 24小時 ${modeDesc[mode] || mode} 熱力矩陣表 (${city})\n`;
            
            // Header: 小時 / Day 1 ~ Day 365
            let header = '時間 / 日期';
            for (let d = 1; d <= 365; d++) {
                header += `,Day ${d}`;
            }
            csv += header + '\n';

            // 24 Rows (Hour 00:00 to 23:00)
            for (let h = 0; h < 24; h++) {
                let row = String(h).padStart(2, '0') + ':00';
                for (let d = 0; d < 365; d++) {
                    const idx = d * 24 + h;
                    const item = hourlyProfile[idx];
                    let val = '';
                    if (item) {
                        if (mode === 'cdu' || mode === 'mode') val = (item.cduMode === 'free' ? 1 : (item.cduMode === 'partial' ? 2 : 3));
                        else if (mode === 'fw') val = (item.fwMode === 'free' ? 1 : 2);
                        else if (mode === 'combined') val = (item.combinedMode === 'free' ? 1 : (item.combinedMode === 'partial' ? 2 : 3));
                        else if (mode === 'pue') val = item.pue.toFixed(3);
                        else if (mode === 'db') val = item.db.toFixed(1);
                    }
                    row += ',' + val;
                }
                csv += row + '\n';
            }

            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.download = `PUE_365x24_Matrix_${city}_${mode}.csv`;
            a.href = url;
            a.click();
        },

        // 3. 匯出 8,760h 逐時全量明細 (.CSV) — 完整工程物理與能耗水量台帳
        download8760DetailedCsv() {
            const state = window.AppStore.state;
            const hourlyProfile = state.results?.hourlyProfile || [];
            if (hourlyProfile.length === 0) return;

            const city = state.site.selectedCity || 'Site';
            const MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

            function getMonthAndDay(d) {
                let daySum = 0;
                for (let m = 0; m < 12; m++) {
                    if (d < daySum + MONTH_DAYS[m]) {
                        return { month: m + 1, day: d - daySum + 1 };
                    }
                    daySum += MONTH_DAYS[m];
                }
                return { month: 12, day: 31 };
            }

            let csv = '\uFEFF';
            csv += '時序編號,月份,日期,小時,外氣乾球(°C),外氣濕球(°C),CDU液冷模式,Fanwall氣冷模式,全廠綜合模式,即時 PUE,IT 負載(kW),冷卻總功耗(kW),冰機耗電(kW),CDU泵耗電(kW),全廠總功耗(kW)\n';

            for (let i = 0; i < hourlyProfile.length; i++) {
                const item = hourlyProfile[i];
                const d = Math.floor(i / 24);
                const h = i % 24;
                const md = getMonthAndDay(d);
                const cduText = item.cduMode === 'free' ? '自然排熱' : (item.cduMode === 'partial' ? '噴霧預冷/修整' : '機械壓縮');
                const fwText = item.fwMode === 'free' ? '氣側自然冷卻' : '氣冷冰機運轉';
                const combText = item.combinedMode === 'free' ? '雙零冰機' : (item.combinedMode === 'partial' ? '混合冷卻' : '全機械製冷');

                csv += `${i + 1},${md.month},${md.day},${h}:00,${item.db.toFixed(1)},${item.wb.toFixed(1)},${cduText},${fwText},${combText},${item.pue.toFixed(3)},${item.itKw},${item.coolingKw},${item.chillerKw},${item.cduPumpKw || 0},${item.totalKw}\n`;
            }

            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.download = `PUE_8760h_Hourly_Profile_${city}.csv`;
            a.href = url;
            a.click();
        },

        // 4. 匯出超高解析度圖 (.PNG 3x 300DPI)
        downloadHeatmapHiResPng() {
            const oldCanvas = document.getElementById('carpetPlotCanvas');
            if (!oldCanvas) return;

            const state = window.AppStore.state;
            const hourlyProfile = state.results?.hourlyProfile || [];
            if (hourlyProfile.length === 0) return;

            const city = state.site.selectedCity || 'Site';
            const mode = this.heatmapMode;

            // 建立高解析度離屏 Canvas (3x 縮放)
            const scale = 3.0;
            const leftMargin = 50;
            const topMargin = 35;
            const bottomMargin = 20;
            const rightMargin = 20;
            const cellW = 3.0;
            const cellH = 10.0;
            const plotW = 365 * cellW;
            const plotH = 24 * cellH;

            const totalW = leftMargin + plotW + rightMargin;
            const totalH = topMargin + plotH + bottomMargin;

            const hiCanvas = document.createElement('canvas');
            hiCanvas.width = totalW * scale;
            hiCanvas.height = totalH * scale;
            const ctx = hiCanvas.getContext('2d');
            ctx.scale(scale, scale);

            // 白色背景
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, totalW, totalH);

            const MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
            const MONTH_NAMES = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];

            // 繪製格子
            for (let i = 0; i < 8760 && i < hourlyProfile.length; i++) {
                const item = hourlyProfile[i];
                const d = Math.floor(i / 24);
                const h = i % 24;
                const x = leftMargin + d * cellW;
                const y = topMargin + h * cellH;

                let fill = '#10B981';
                if (mode === 'cdu' || mode === 'mode') {
                    const m = item.cduMode || item.mode;
                    if (m === 'free') fill = '#10B981';
                    else if (m === 'partial') fill = '#F59E0B';
                    else fill = '#EF4444';
                } else if (mode === 'fw') {
                    const m = item.fwMode || (item.chillerKw > 0 ? 'mechanical' : 'free');
                    if (m === 'free') fill = '#10B981';
                    else fill = '#3B82F6';
                } else if (mode === 'combined') {
                    const m = item.combinedMode;
                    if (m === 'free') fill = '#10B981';
                    else if (m === 'partial') fill = '#F59E0B';
                    else fill = '#EF4444';
                } else if (mode === 'pue') {
                    const p = item.pue;
                    if (p <= 1.07) fill = '#059669';
                    else if (p <= 1.10) fill = '#10B981';
                    else if (p <= 1.14) fill = '#84CC16';
                    else if (p <= 1.18) fill = '#F59E0B';
                    else if (p <= 1.25) fill = '#F97316';
                    else fill = '#EF4444';
                } else if (mode === 'db') {
                    const t = item.db;
                    if (t <= 14) fill = '#38BDF8';
                    else if (t <= 20) fill = '#34D399';
                    else if (t <= 26) fill = '#FBBF24';
                    else if (t <= 32) fill = '#F97316';
                    else fill = '#EF4444';
                }

                ctx.fillStyle = fill;
                ctx.fillRect(x, y, cellW - 0.3, cellH - 0.3);
            }

            // 月份標籤與分割線
            ctx.font = 'bold 12px Inter, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            let dayAcc = 0;
            for (let m = 0; m < 12; m++) {
                const daysInM = MONTH_DAYS[m];
                const startX = leftMargin + dayAcc * cellW;
                const midX = startX + (daysInM * cellW) / 2;

                ctx.fillStyle = '#374151';
                ctx.fillText(MONTH_NAMES[m], midX, topMargin / 2);

                if (m > 0) {
                    ctx.strokeStyle = '#CBD5E1';
                    ctx.lineWidth = 1;
                    ctx.setLineDash([3, 3]);
                    ctx.beginPath();
                    ctx.moveTo(startX, topMargin - 4);
                    ctx.lineTo(startX, topMargin + plotH);
                    ctx.stroke();
                    ctx.setLineDash([]);
                }
                dayAcc += daysInM;
            }

            // 小時標籤
            ctx.font = '600 10px Inter, monospace';
            ctx.textAlign = 'right';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = '#64748B';
            const hourMarkers = [0, 4, 8, 12, 16, 20, 23];
            hourMarkers.forEach(h => {
                const y = topMargin + (h + 0.5) * cellH;
                const label = String(h).padStart(2, '0') + ':00';
                ctx.fillText(label, leftMargin - 8, y);
            });

            ctx.strokeStyle = '#CBD5E1';
            ctx.lineWidth = 1;
            ctx.strokeRect(leftMargin, topMargin, plotW, plotH);

            const a = document.createElement('a');
            a.download = `PUE_8760h_CarpetPlot_${city}_${mode}_300dpi.png`;
            a.href = hiCanvas.toDataURL('image/png');
            a.click();
        },

        exportFullReportCsv() {
            const state = window.AppStore.state;
            const res = state.results;
            const overall = res.overall;
            const byDu = res.byDu || [];
            const byCorePod = res.byCorePod || [];
            const monthly = res.monthlyPue || [];
            const breakdown = overall.breakdownKwh || {};
            const fcPot = res.fcPotential || {};

            let csv = '\uFEFF'; // UTF-8 BOM for Excel Chinese support
            csv += '=== PUE & WUE 8760h 動力學模擬評估報告 ===\n';
            csv += '專案案場,' + (state.site.selectedCity || 'Site') + ',評估時數,8760 小時\n';
            csv += '全廠設計 PUE (年均),' + overall.annualPue + ',全廠尖峰 PUE (最劣),' + (overall.peakPue || overall.annualPue) + '\n';
            csv += '全廠 Cooling pPUE 不含泵浦耗電 (年均),' + overall.annualP_Pue + ',全廠尖峰 Cooling pPUE 不含泵浦耗電 (最劣),' + (overall.peakP_Pue || overall.annualP_Pue) + ' (發生於 ' + (overall.peakMonth || 7) + ' 月)\n';
            csv += '全廠耗水 WUE (L/kWh),' + overall.annualWue + ',全廠年總耗水量 (m³),' + overall.annualWaterM3 + '\n';
            csv += '全廠 IT 總容量 (kW),' + overall.totalItKw.toFixed(1) + ',全廠年總耗電 (MWh),' + overall.annualTotalMwh + '\n';
            csv += '自由冷卻 (FC) 潛力時數,直冷 ' + (fcPot.freeHours||0) + 'h (' + (fcPot.freeHoursPct||0) + '%),輔助 ' + (fcPot.trimHours||0) + 'h (' + (fcPot.trimHoursPct||0) + '%),冰機 ' + (fcPot.mechanicalHours||0) + 'h (' + (fcPot.mechanicalHoursPct||0) + '%)\n\n';

            csv += '=== 逐 DU (冷卻單元) 評估明細 ===\n';
            csv += 'DU 名稱,機房 Hall,CDU 液冷架構,CDU 供/回水溫(°C),CDU 液冷能耗(MWh),Fanwall 氣冷架構,Fanwall 冰水溫(°C),Fanwall 氣冷能耗(MWh),IT 容量(kW),DLC (%),設計 PUE,耗水 WUE (L/kWh),年總耗電(MWh)\n';
            byDu.forEach(d => {
                csv += '"' + d.duName + '","' + d.hallName + '","' + d.cduArchitecture + '","' + d.cduSupplyTemp + '/' + d.cduReturnTemp + '",' + (d.cduSystemMwh || 0) + ',"' + d.fwArchitecture + '","' + d.fwSupplyTemp + '",' + (d.fwSystemMwh || 0) + ',' + d.totalItKw.toFixed(1) + ',' + d.dlcPct.toFixed(1) + ',' + d.annualPue + ',' + d.annualWue + ',' + d.annualTotalMwh + '\n';
            });
            csv += '\n';

            if (byCorePod.length > 0) {
                csv += '=== CorePOD 核心機房評估明細 ===\n';
                csv += 'CorePOD 名稱,液冷架構,液冷能耗(MWh),氣冷架構,氣冷能耗(MWh),IT 容量(kW),DLC (%),設計 PUE,耗水 WUE (L/kWh),年總耗電(MWh)\n';
                byCorePod.forEach(cp => {
                    csv += '"' + cp.podName + '","' + cp.cduArchitecture + '",' + (cp.cduSystemMwh || 0) + ',"' + cp.fwArchitecture + '",' + (cp.fwSystemMwh || 0) + ',' + cp.totalItKw.toFixed(1) + ',' + cp.dlcPct.toFixed(1) + ',' + cp.annualPue + ',' + cp.annualWue + ',' + cp.annualTotalMwh + '\n';
                });
                csv += '\n';
            }

            csv += '=== 12 個月月度 PUE 與冷卻耗電 ===\n';
            csv += '月份,月度 PUE,月度冷卻耗電 (MWh)\n';
            monthly.forEach((m, idx) => {
                csv += (idx + 1) + ' 月,' + m.pue + ',' + m.coolingMwh + '\n';
            });
            csv += '\n';

            csv += '=== 全年能耗流動拆解 (kWh) ===\n';
            csv += 'IT 晶片負載,' + (breakdown.it || 0) + '\n';
            csv += 'CDU 循環泵,' + (breakdown.cduPump || 0) + '\n';
            csv += 'CRAH 空調風扇,' + (breakdown.crahFan || 0) + '\n';
            csv += '乾冷器/水塔排熱,' + (breakdown.heatRejection || 0) + '\n';
            csv += '修整/氣冷冰機,' + (breakdown.chiller || 0) + '\n';
            csv += '配電損耗,' + (breakdown.loss || 0) + '\n';

            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'PUE_v25_' + (state.site.selectedCity || 'Site') + '_Simulation_Report.csv';
            a.click();
        }
    };

    window.ViewDashboard = ViewDashboard;
})(window);
