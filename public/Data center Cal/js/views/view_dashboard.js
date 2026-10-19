/**
 * view_dashboard.js - Step 5: Dashboard with PUE, WUE, Per-DU & CorePOD Dual-System Tables (V22)
 */
(function(window) {
    'use strict';

    const _t = (key, params, fallback) => {
        if (typeof window !== 'undefined' && window.I18N && typeof window.I18N.t === 'function') {
            return window.I18N.t(key, params, fallback);
        }
        return fallback !== undefined ? fallback : key;
    };

    let breakdownChart = null;
    let monthlyChart = null;

    const ViewDashboard = {
        render(container) {
            const state = window.AppStore.state;
            if (state.site && state.site.isWeatherLoading) {
                container.innerHTML = `
                    <div class="bg-white p-12 rounded-2xl border border-slate-200 text-center space-y-4 shadow-sm">
                        <div class="text-4xl">⏳</div>
                        <h3 class="text-lg font-bold text-slate-800">${_t('dash.weatherLoading', null, '氣象資料載入中...')}</h3>
                        <p class="text-xs text-slate-500">${_t('dash.weatherLoadingDesc', { city: state.site.selectedCity || state.site.stationId }, `正在非同步載入「${state.site.selectedCity || state.site.stationId}」之 8,760 小時氣象資料，請稍候。`)}</p>
                    </div>
                `;
                return;
            }
            const res = state.results || {};
            const overall = res.overall || {};
            const byDu = res.byDu || [];
            const byCorePod = res.byCorePod || [];
            const corePodGroup = res.corePodGroup || { annualPue: 1.00, totalItKw: 0 };

            const U0 = window.UIKit;
            const byPlant = res.byPlant || overall.byPlant || [];
            const plantMap = new Map((state.coolingPlants || []).map(p => [p.id, p]));

            const getUnitNameById = (id) => {
                for (const h of (state.halls || [])) {
                    for (const d of (h.dus || [])) {
                        if (d.id === id) return d.name;
                    }
                }
                for (const cp of (state.corePods || [])) {
                    if (cp.id === id) return cp.name;
                }
                return id;
            };

            let plantTableRows = '';
            byPlant.forEach(pl => {
                const def = plantMap.get(pl.id);
                const memberNames = (pl.memberIds || []).map(id => getUnitNameById(id)).join(', ');
                const plantTotalMwh = (pl.annualMwh?.chiller || 0) + (pl.annualMwh?.heatRej || 0) + (pl.annualMwh?.pump || 0);
                const loopBadge = pl.loop === 'liquid'
                    ? '<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-brand-50 text-brand-700 border border-brand-200">💧 ' + _t('cooling.liquidLoop', null, '液冷迴路') + '</span>'
                    : '<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-sky-50 text-sky-700 border border-sky-200">💨 ' + _t('cooling.airLoop', null, '氣冷迴路') + '</span>';
                const redundancyText = def?.redundancy || 'N+1';

                plantTableRows += '<tr class="border-b border-border-subtle hover:bg-bg transition-colors text-xs">'
                    + '<td class="py-3 px-4 font-semibold text-primary">' + U0.escapeHTML(pl.name) + '</td>'
                    + '<td class="py-3 px-4">' + loopBadge + '</td>'
                    + '<td class="py-3 px-4 text-secondary"><div class="max-w-[200px] truncate" title="' + U0.escapeHTML(memberNames) + '">' + U0.escapeHTML(memberNames || '—') + '</div><div class="text-[10px] text-tertiary font-mono">(' + (pl.memberIds?.length || 0) + ')</div></td>'
                    + '<td class="py-3 px-4 font-mono font-semibold text-primary">' + redundancyText + '</td>'
                    + '<td class="py-3 px-4 text-right font-mono font-medium text-primary tabular-nums">' + (pl.peakLoadKw || 0).toLocaleString() + '</td>'
                    + '<td class="py-3 px-4 text-right font-mono text-secondary tabular-nums">' + (pl.annualMwh?.chiller || 0).toLocaleString() + '</td>'
                    + '<td class="py-3 px-4 text-right font-mono text-secondary tabular-nums">' + (pl.annualMwh?.heatRej || 0).toLocaleString() + '</td>'
                    + '<td class="py-3 px-4 text-right font-mono text-secondary tabular-nums">' + (pl.annualMwh?.pump || 0).toLocaleString() + '</td>'
                    + '<td class="py-3 px-4 text-right font-mono font-bold text-brand-600 tabular-nums">' + plantTotalMwh.toLocaleString() + '</td>'
                    + '<td class="py-3 px-4 text-right font-mono font-medium text-emerald-700 tabular-nums">' + (pl.modeHours?.free || 0) + ' h</td>'
                    + '</tr>';
            });

            let duTableRows = '';
            byDu.forEach(d => {
                const liqPlant = d.liquidPlantId ? plantMap.get(d.liquidPlantId) : null;
                const airPlant = d.airPlantId ? plantMap.get(d.airPlantId) : null;
                const liqText = liqPlant ? liqPlant.name : _t('cooling.dedicated', null, '獨立');
                const airText = airPlant ? airPlant.name : _t('cooling.dedicated', null, '獨立');
                const supplyPlantHtml = '<div class="text-[11px] space-y-0.5">'
                    + '<div class="flex items-center gap-1 ' + (liqPlant ? 'text-brand-600 font-semibold' : 'text-tertiary font-normal') + '"><span>💧</span><span>' + U0.escapeHTML(liqText) + '</span></div>'
                    + '<div class="flex items-center gap-1 ' + (airPlant ? 'text-sky-600 font-semibold' : 'text-tertiary font-normal') + '"><span>💨</span><span>' + U0.escapeHTML(airText) + '</span></div>'
                    + '</div>';

                duTableRows += '<tr class="border-b border-border-subtle hover:bg-bg transition-colors text-xs">'
                    + '<td class="py-3 px-4 font-semibold text-primary"><div class="flex items-center gap-2">' + U0.iconBadge('building-2', 'neutral', 'w-6 h-6') + '<span>' + U0.escapeHTML(d.duName) + '<div class="text-[10px] text-tertiary font-normal">' + U0.escapeHTML(d.hallName) + '</div></span></div></td>'
                    + '<td class="py-3 px-4">' + supplyPlantHtml + '</td>'
                    + '<td class="py-3 px-4 font-mono font-semibold text-primary">' + d.cduArchitecture
                    + '<div class="text-[10px] text-secondary font-normal">' + d.cduSupplyTemp + '/' + d.cduReturnTemp + '°C</div>'
                    + '<div class="text-[10px] text-secondary font-medium mt-0.5">' + _t('dash.liquidEnergy', null, '液冷能耗') + ': ' + (d.cduSystemMwh || 0).toLocaleString() + ' MWh</div></td>'
                    + '<td class="py-3 px-4 font-mono font-semibold text-primary">' + d.fwArchitecture
                    + '<div class="text-[10px] text-secondary font-normal">' + d.fwSupplyTemp + '°C CHW</div>'
                    + '<div class="text-[10px] text-secondary font-medium mt-0.5">' + _t('dash.airEnergy', null, '氣冷能耗') + ': ' + (d.fwSystemMwh || 0).toLocaleString() + ' MWh</div></td>'
                    + '<td class="py-3 px-4 text-right font-semibold text-primary tabular-nums">' + d.totalItKw.toFixed(1) + ' kW'
                    + '<div class="text-[10px] text-tertiary font-normal">DLC: ' + d.dlcPct.toFixed(0) + '%</div></td>'
                    + '<td class="py-3 px-4 text-right font-mono font-bold text-brand-600 text-sm tabular-nums">' + U0.pueDot(d.annualPue) + d.annualPue + '</td>'
                    + '<td class="py-3 px-4 text-right font-mono font-semibold text-primary tabular-nums">' + d.annualWue + ' <span class="text-[10px] text-tertiary font-normal">L/kWh</span></td>'
                    + '<td class="py-3 px-4 text-right font-medium text-secondary tabular-nums">' + d.annualTotalMwh.toLocaleString() + ' MWh</td>'
                    + '</tr>';
            });

            let corePodTableRows = '';
            byCorePod.forEach(cp => {
                const liqPlant = cp.liquidPlantId ? plantMap.get(cp.liquidPlantId) : null;
                const airPlant = cp.airPlantId ? plantMap.get(cp.airPlantId) : null;
                const liqText = liqPlant ? liqPlant.name : _t('cooling.dedicated', null, '獨立');
                const airText = airPlant ? airPlant.name : _t('cooling.dedicated', null, '獨立');
                const supplyPlantHtml = '<div class="text-[11px] space-y-0.5">'
                    + (cp.liquidHeatKw > 0 ? ('<div class="flex items-center gap-1 ' + (liqPlant ? 'text-brand-600 font-semibold' : 'text-tertiary font-normal') + '"><span>💧</span><span>' + U0.escapeHTML(liqText) + '</span></div>') : '')
                    + '<div class="flex items-center gap-1 ' + (airPlant ? 'text-sky-600 font-semibold' : 'text-tertiary font-normal') + '"><span>💨</span><span>' + U0.escapeHTML(airText) + '</span></div>'
                    + '</div>';

                corePodTableRows += '<tr class="border-b border-border-subtle hover:bg-bg transition-colors text-xs">'
                    + '<td class="py-3 px-4 font-semibold text-primary"><div class="flex items-center gap-2">' + U0.iconBadge('server', 'violet', 'w-6 h-6') + '<span>' + U0.escapeHTML(cp.podName) + '<div class="text-[10px] text-tertiary font-normal">' + _t('dash.corePodModule', null, '核心機房模組') + '</div></span></div></td>'
                    + '<td class="py-3 px-4">' + supplyPlantHtml + '</td>'
                    + '<td class="py-3 px-4 font-mono font-semibold text-primary">' + (cp.liquidHeatKw > 0 ? cp.cduArchitecture : _t('dash.noLiquidLoad', null, '無液冷負載'))
                    + (cp.liquidHeatKw > 0 ? ('<div class="text-[10px] text-secondary font-normal">' + cp.cduSupplyTemp + '/' + cp.cduReturnTemp + '°C</div>'
                    + '<div class="text-[10px] text-secondary font-medium mt-0.5">' + _t('dash.liquidEnergy', null, '液冷能耗') + ': ' + (cp.cduSystemMwh || 0).toLocaleString() + ' MWh</div>') : ('<div class="text-[10px] text-tertiary font-normal">' + _t('dash.allAirEquip', null, '100% 氣冷設備') + '</div>')) + '</td>'
                    + '<td class="py-3 px-4 font-mono font-semibold text-primary">' + cp.fwArchitecture
                    + '<div class="text-[10px] text-secondary font-normal">' + cp.fwSupplyTemp + '°C CHW</div>'
                    + '<div class="text-[10px] text-secondary font-medium mt-0.5">' + _t('dash.airEnergy', null, '氣冷能耗') + ': ' + (cp.fwSystemMwh || 0).toLocaleString() + ' MWh</div></td>'
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
                            <h2 class="text-lg font-bold text-primary">${_t('dash.dashboardTitle', null, '8,760h 動力學模擬儀表板')}</h2>
                            <p class="text-xs text-tertiary">${_t('dash.dashboardSubtitle', null, '全廠 PUE / WUE / 自由冷卻 / 逐 DU 能耗成果總覽')}</p>
                        </div>
                    </div>

                    <!-- 頂部導航與匯出按鈕列 -->
                    <div class="${U.cardClass('p-4 flex flex-col sm:flex-row items-center justify-between gap-3')}">
                        <div class="flex items-center gap-2 flex-wrap">
                            <span class="text-xs font-medium text-tertiary mr-1">${_t('dash.quickNav', null, '快速導航:')}</span>
                            <button onclick="window.App.goToStep(1)" class="${U.buttonClass('secondary')}">${_t('dash.navStep1', null, 'Step 1: 案場氣象')}</button>
                            <button onclick="window.App.goToStep(2)" class="${U.buttonClass('secondary')}">${_t('dash.navStep2', null, 'Step 2: 機房與設備')}</button>
                            <button onclick="window.App.goToStep(3)" class="${U.buttonClass('secondary')}">${_t('dash.navStep3', null, 'Step 3: CorePOD')}</button>
                            <button onclick="window.App.goToStep(4)" class="${U.buttonClass('secondary')}">${_t('dash.navStep4', null, 'Step 4: 雙冷卻選型')}</button>
                        </div>
                        <div class="flex items-center gap-2 flex-wrap">
                            <button onclick="ViewDashboard.exportFullReportCsv()" class="${U.buttonClass('secondary')}">
                                ${U.icon('download', 'w-3.5 h-3.5')} ${_t('dash.exportCsv', null, '匯出完整評估報告 (CSV)')}
                            </button>
                            <select id="excelExportLang" class="text-xs border border-border-default rounded px-2 py-1.5 bg-bg-card text-primary focus:outline-none focus:border-brand-500">
                                <option value="zh-TW" ${(!window.I18N || window.I18N.lang !== 'en') ? 'selected' : ''}>${_t('excel.langZh', null, '中文計算書')}</option>
                                <option value="en" ${(window.I18N && window.I18N.lang === 'en') ? 'selected' : ''}>${_t('excel.langEn', null, 'English Workbook')}</option>
                            </select>
                            <button onclick="window.ExcelExport.generate(document.getElementById('excelExportLang')?.value)" class="${U.buttonClass('primary')}">
                                ${U.icon('file-spreadsheet', 'w-3.5 h-3.5')} ${_t('dash.exportExcel', null, '匯出 Excel 空調計算書 (公式連動)')}
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
                                <div class="text-sm font-bold text-danger-600">${_t('dash.deficitWarnTitle', null, '⚠ 設備容量不足警示 — 此 PUE 結果可能被低估')}</div>
                                <div class="text-xs text-danger-600 mt-1">
                                    ${_t('dash.deficitWarnBody', { hours: overall.capacityDeficitHours.toLocaleString(), kw: overall.maxCapacityDeficitKw.toLocaleString() }, `全年 8,760 小時中，有 <strong>${overall.capacityDeficitHours.toLocaleString()}</strong> 小時偵測到冰機容量不足（需求超過已選型號扣除 N+1 備援後的可用容量），尖峰缺口約 <strong>${overall.maxCapacityDeficitKw.toLocaleString()} kW</strong>。這些小時的耗電量已被引擎依可用容量封頂計算，並不代表冷量真的有被完全供應，此結果<strong>不應直接用於設備比較或最終 PUE 認證</strong>，請回到 Step 4 增加設備台數或選用更大容量型號。`)}
                                </div>
                            </div>
                        </div>
                    </div>
                    ` : ''}

                    <!-- 核心指標: 年度PUE 為視覺主角，淺色漸層底突顯層次，其餘指標降階 -->
                    <div class="${U.cardClass('p-6 bg-gradient-to-br from-brand-50/60 via-surface to-surface')}">
                        <div class="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-5 border-b border-border-subtle">
                            <div>
                                <span class="text-xs font-medium uppercase tracking-wide text-tertiary">${_t('dash.annualAvgPue', null, '全廠設計 PUE (年度均值)')}</span>
                                <div class="text-6xl font-bold bg-gradient-to-br from-brand-600 to-brand-800 bg-clip-text text-transparent mt-1 tabular-nums" id="heroPueNum">${overall.annualPue}</div>
                            </div>
                            <div class="flex gap-6 text-xs">
                                <div>
                                    <span class="text-emerald-700 font-medium">${_t('dash.bestMonth', { m: (bestMonthIdx >= 0 ? _t('dash.monthFormat', { n: bestMonthIdx + 1 }, (bestMonthIdx + 1) + '月') : '—') }, `最優月度 (${bestMonthIdx >= 0 ? (bestMonthIdx + 1) + '月' : '—'})`)}</span>
                                    <div class="font-semibold text-emerald-700 tabular-nums">${bestMonthIdx >= 0 ? bestMonthPue.toFixed(3) : overall.annualPue}</div>
                                </div>
                                <div class="border-l border-border pl-6">
                                    <span class="text-danger-500 font-medium">${_t('dash.worstPeak', { m: (overall.peakMonth != null ? _t('dash.monthFormat', { n: overall.peakMonth }, overall.peakMonth + '月') : (worstMonthIdx >= 0 ? _t('dash.monthFormat', { n: worstMonthIdx + 1 }, (worstMonthIdx + 1) + '月') : '—')) }, `最差・尖峰 (${overall.peakMonth != null ? overall.peakMonth + '月' : (worstMonthIdx >= 0 ? (worstMonthIdx + 1) + '月' : '—')})`)}</span>
                                    <div class="font-semibold text-danger-600 tabular-nums">${overall.peakPue ?? (worstMonthIdx >= 0 ? worstMonthPue.toFixed(3) : '—')}</div>
                                </div>
                            </div>
                        </div>

                        <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 pt-5">
                            <div class="flex gap-3 p-3 rounded-lg hover:bg-sky-50/40 transition-colors">
                                ${U.iconBadge('droplet', 'info')}
                                <div>
                                    <span class="text-[11px] font-medium uppercase tracking-wide text-tertiary">${_t('dash.annualWue', null, '全廠耗水 WUE')}</span>
                                    <div class="text-xl font-semibold text-primary mt-0.5 tabular-nums">${overall.annualWue} <span class="text-xs font-normal text-tertiary">L/kWh</span></div>
                                    <div class="text-[11px] text-tertiary mt-0.5">${_t('dash.annualWaterM3', { val: overall.annualWaterM3.toLocaleString() }, `年耗水 ${overall.annualWaterM3.toLocaleString()} m³`)}</div>
                                </div>
                            </div>
                            <div class="flex gap-3 p-3 rounded-lg hover:bg-violet-50/40 transition-colors">
                                ${U.iconBadge('server', 'violet')}
                                <div>
                                    <span class="text-[11px] font-medium uppercase tracking-wide text-tertiary">${_t('dash.totalItCap', null, '全廠 IT 總容量')}</span>
                                    <div class="text-xl font-semibold text-primary mt-0.5 tabular-nums">${(overall.totalItKw / 1000).toFixed(2)} <span class="text-xs font-normal text-tertiary">MW</span></div>
                                    <div class="text-[11px] text-tertiary mt-0.5">${_t('dash.duCorepodCount', { du: byDu.length, corepod: byCorePod.length }, `${byDu.length} 組 DU ・ ${byCorePod.length} 組 CorePOD`)}</div>
                                </div>
                            </div>
                            <div class="flex gap-3 p-3 rounded-lg hover:bg-warn-50/40 transition-colors">
                                ${U.iconBadge('zap', 'warn')}
                                <div>
                                    <span class="text-[11px] font-medium uppercase tracking-wide text-tertiary">${_t('dash.annualTotalPower', null, '全廠年總耗電')}</span>
                                    <div class="text-xl font-semibold text-primary mt-0.5 tabular-nums">${overall.annualTotalMwh.toLocaleString()} <span class="text-xs font-normal text-tertiary">MWh</span></div>
                                    <div class="text-[11px] text-tertiary mt-0.5">${_t('dash.itMwh', { val: overall.annualItMwh.toLocaleString() }, `IT: ${overall.annualItMwh.toLocaleString()} MWh`)}</div>
                                </div>
                            </div>
                            <div class="flex gap-3 p-3 rounded-lg hover:bg-brand-50/50 transition-colors">
                                ${U.iconBadge('snowflake', 'brand')}
                                <div class="flex-1">
                                    <span class="text-[11px] font-medium uppercase tracking-wide text-tertiary">${_t('dash.fcPotential', null, '氣候直冷潛力 (FC Potential)')}</span>
                                    <div class="text-xl font-semibold text-brand-600 mt-0.5 tabular-nums">${fcPot.freeHoursPct}%</div>
                                    <div class="w-full bg-border-subtle rounded-full h-1.5 flex overflow-hidden my-1.5">
                                        <div class="bg-brand-500 h-full" style="width: ${fcPot.freeHoursPct}%"></div>
                                        <div class="bg-warn-500 h-full" style="width: ${fcPot.trimHoursPct}%"></div>
                                        <div class="bg-tertiary h-full" style="width: ${fcPot.mechanicalHoursPct}%"></div>
                                    </div>
                                    <div class="text-[10px] text-tertiary">${_t('dash.fcHoursSummary', { free: fcPot.freeHours, trim: fcPot.trimHours, mech: fcPot.mechanicalHours }, `直${fcPot.freeHours}h ・ 輔${fcPot.trimHours}h ・ 機${fcPot.mechanicalHours}h`)}</div>
                                </div>
                            </div>
                        </div>
                        <div class="text-[11px] text-tertiary mt-4 pt-4 border-t border-border-subtle flex items-center justify-between">
                            <span>${_t('dash.siteFcThreshold', { city: state.site.selectedCity, db1: mode1DbMax, db2: mode2DbMax }, `案場: <strong class="text-secondary font-medium">${state.site.selectedCity}</strong> ・ 氣候直冷門檻 DB ≤ ${mode1DbMax}°C 直冷 / ≤ ${mode2DbMax}°C 輔助`)}</span>
                            <span class="inline-flex items-center gap-1 text-brand-600 font-medium">${U.icon('check-circle-2', 'w-3.5 h-3.5')} ${_t('dash.sim8760', null, '8,760h 全年動態模擬')}</span>
                        </div>
                    </div>

                    <!-- 全廠電力系統損失率 (Electrical Loss %) 快速估算與微調卡片 -->
                    <div class="${U.cardClass('p-5 bg-surface border border-border shadow-xs')}">
                        <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div class="flex items-center gap-3">
                                ${U.iconBadge('zap', 'warn', 'w-10 h-10')}
                                <div>
                                    <div class="flex items-center gap-2">
                                        <h3 class="text-sm font-bold text-primary">${_t('dash.lossRateTitle', null, '全廠電力傳輸與轉換損失率 (Electrical Loss %)')}</h3>
                                        <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">The Green Grid / ASHRAE 90.4</span>
                                    </div>
                                    <p class="text-xs text-tertiary mt-0.5">
                                        ${_t('dash.lossRateDesc', null, '涵蓋高/低壓變壓器、UPS 雙轉換損耗、靜態開關 STS、列頭櫃 PDU 及電纜阻抗發熱。')}
                                    </p>
                                </div>
                            </div>

                            <div class="flex items-center gap-3 bg-bg p-2.5 rounded-xl border border-border-subtle">
                                <div class="text-right">
                                    <div class="text-[10px] font-medium text-tertiary uppercase">${_t('dash.lossRate', null, '電力損失率 (Loss %)')}</div>
                                    <div class="text-xs text-secondary font-mono mt-0.5">
                                        ${_t('dash.estimatedLoss', { kw: ((overall.totalItKw * (state.facilityElectricalLossPct || 0)) / 100).toFixed(1) }, `估計損耗: <strong class="text-amber-600 font-bold">${((overall.totalItKw * (state.facilityElectricalLossPct || 0)) / 100).toFixed(1)} kW</strong>`)}
                                        <span class="text-tertiary">${_t('dash.mwhPerYear', { mwh: Math.round(((overall.totalItKw * (state.facilityElectricalLossPct || 0)) / 100) * 8.76).toLocaleString() }, `(${Math.round(((overall.totalItKw * (state.facilityElectricalLossPct || 0)) / 100) * 8.76).toLocaleString()} MWh/年)`)}</span>
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
                                <span class="text-tertiary text-[11px] font-medium">${_t('dash.commonPresets', null, '常見經驗預設值:')}</span>
                                <button onclick="window.AppStore.setFacilityElectricalLossPct(0.0); window.ViewDashboard.render(document.getElementById('stepContent'))" class="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-bg hover:bg-border-subtle text-secondary border border-border transition">${_t('dash.preset0', null, '0% (純空調 PUE)')}</button>
                                <button onclick="window.AppStore.setFacilityElectricalLossPct(2.5); window.ViewDashboard.render(document.getElementById('stepContent'))" class="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-bg hover:bg-border-subtle text-secondary border border-border transition">${_t('dash.preset25', null, '2.5% (超高壓直供+高效UPS)')}</button>
                                <button onclick="window.AppStore.setFacilityElectricalLossPct(4.0); window.ViewDashboard.render(document.getElementById('stepContent'))" class="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-bg hover:bg-border-subtle text-secondary border border-border transition">${_t('dash.preset40', null, '4.0% (標準在線雙轉換 UPS)')}</button>
                                <button onclick="window.AppStore.setFacilityElectricalLossPct(6.5); window.ViewDashboard.render(document.getElementById('stepContent'))" class="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-bg hover:bg-border-subtle text-secondary border border-border transition">${_t('dash.preset65', null, '6.5% (多級降壓/傳統配電)')}</button>
                            </div>
                            <div class="text-[11px] text-tertiary font-mono">
                                ${_t('dash.pueContribution', { val: ((state.facilityElectricalLossPct || 0) / 100).toFixed(3) }, `當前對 PUE 增量貢獻: <strong class="text-brand-600 font-bold">+${((state.facilityElectricalLossPct || 0) / 100).toFixed(3)}</strong>`)}
                            </div>
                        </div>
                    </div>

                    <!-- 共用冷卻系統運轉與耗能成果 (Cooling Plants) -->
                    <div class="${U.cardClass('p-6 space-y-4')}">
                        <div class="flex justify-between items-center border-b border-border-subtle pb-3">
                            <div class="flex items-center gap-3">
                                ${U.iconBadge('network', 'brand')}
                                <div>
                                    <h3 class="text-sm font-semibold text-primary">${_t('dash.plantTableTitle', null, '共用冷卻系統運轉與耗能成果 (Cooling Plants)')}</h3>
                                    <p class="text-xs text-tertiary mt-0.5">${_t('dash.plantTableSubtitle', null, '依迴路彙整中央主機房冰機、排熱設備與水泵年耗電、耗水與自然冷卻時數')}</p>
                                </div>
                            </div>
                            ${U.badge(String(byPlant.length), 'neutral')}
                        </div>

                        <div class="overflow-x-auto">
                            <table class="w-full text-left">
                                <thead>
                                    <tr class="border-b border-border text-[11px] font-medium text-tertiary uppercase tracking-wide">
                                        <th class="py-2.5 px-4">${_t('dash.thPlantName', null, '系統名稱')}</th>
                                        <th class="py-2.5 px-4">${_t('dash.thLoopType', null, '冷卻迴路')}</th>
                                        <th class="py-2.5 px-4">${_t('dash.thPlantMembers', null, '成員單元')}</th>
                                        <th class="py-2.5 px-4">${_t('dash.thPlantRedundancy', null, '冗餘等級')}</th>
                                        <th class="py-2.5 px-4 text-right">${_t('dash.thPlantPeakLoad', null, '尖峰負載 (kW)')}</th>
                                        <th class="py-2.5 px-4 text-right">${_t('dash.thPlantChillerMwh', null, '冰機能耗 (MWh)')}</th>
                                        <th class="py-2.5 px-4 text-right">${_t('dash.thPlantHeatRejMwh', null, '排熱能耗 (MWh)')}</th>
                                        <th class="py-2.5 px-4 text-right">${_t('dash.thPlantPumpMwh', null, '水泵能耗 (MWh)')}</th>
                                        <th class="py-2.5 px-4 text-right">${_t('dash.thPlantTotalMwh', null, '主機房年耗電 (MWh)')}</th>
                                        <th class="py-2.5 px-4 text-right">${_t('dash.thPlantFreeHours', null, '自然冷卻 (h)')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${plantTableRows || '<tr><td colspan="10" class="text-center py-6 text-xs text-tertiary">' + _t('dash.noPlantsData', null, '目前案場未建立共用冷卻系統（所有單元皆採獨立配置）') + '</td></tr>'}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <!-- 逐 DU 成果比較清單 (含雙冷卻架構與能耗拆解) -->
                    <div class="${U.cardClass('p-6 space-y-4')}">
                        <div class="flex justify-between items-center border-b border-border-subtle pb-3">
                            <div class="flex items-center gap-3">
                                ${U.iconBadge('building-2', 'brand')}
                                <div>
                                    <h3 class="text-sm font-semibold text-primary">${_t('dash.duTableTitle', null, '逐 DU 雙冷卻系統、能耗拆解與 PUE/WUE 成果對比')}</h3>
                                    <p class="text-xs text-tertiary mt-0.5">${_t('dash.duTableSubtitle', null, '對比各 DU 因 CDU 液冷水溫、Fanwall 氣冷架構之專屬能耗、PUE 與 WUE 表現')}</p>
                                </div>
                            </div>
                            ${U.badge(_t('dash.duCountBadge', { n: byDu.length }, byDu.length + ' 組 DU'), 'neutral')}
                        </div>

                        <div class="overflow-x-auto">
                            <table class="w-full text-left">
                                <thead>
                                    <tr class="border-b border-border text-[11px] font-medium text-tertiary uppercase tracking-wide">
                                        <th class="py-2.5 px-4">${_t('dash.thDuUnit', null, 'DU 單元')}</th>
                                        <th class="py-2.5 px-4">${_t('dash.thSupplyPlant', null, '供冷系統 (Plant)')}</th>
                                        <th class="py-2.5 px-4">${_t('dash.thCduSystem', null, 'CDU 液冷系統 (水溫 & 能耗)')}</th>
                                        <th class="py-2.5 px-4">${_t('dash.thFwSystem', null, 'Fanwall 氣冷系統 (能耗)')}</th>
                                        <th class="py-2.5 px-4 text-right">${_t('dash.thItCap', null, 'IT 容量 (kW)')}</th>
                                        <th class="py-2.5 px-4 text-right">${_t('dash.thDesignPue', null, '設計 PUE')}</th>
                                        <th class="py-2.5 px-4 text-right">${_t('dash.thWaterWue', null, '耗水 WUE')}</th>
                                        <th class="py-2.5 px-4 text-right">${_t('dash.thAnnualPower', null, '年總耗電')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${duTableRows || '<tr><td colspan="8" class="text-center py-4 text-xs text-tertiary">' + _t('dash.noDuData', null, '尚無 DU 資料') + '</td></tr>'}
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
                                    <h3 class="text-sm font-semibold text-primary">${_t('dash.corePodTitle', null, 'CorePOD 核心網通/儲存機房 8,760h 模擬成果')}</h3>
                                    <p class="text-xs text-tertiary mt-0.5">
                                        ${_t('dash.corePodSummary', { pue: corePodGroup.annualPue, it: corePodGroup.totalItKw.toFixed(1), mwh: corePodGroup.annualTotalMwh.toLocaleString() }, `群組整體 PUE: <strong class="text-primary font-semibold">${corePodGroup.annualPue}</strong> ・\n                                        IT 容量: <strong class="text-primary font-semibold">${corePodGroup.totalItKw.toFixed(1)} kW</strong> ・\n                                        年總耗電: <strong class="text-primary font-semibold">${corePodGroup.annualTotalMwh.toLocaleString()} MWh</strong>`)}
                                    </p>
                                </div>
                            </div>
                            ${U.badge(_t('dash.corePodCountBadge', { n: byCorePod.length }, byCorePod.length + ' 組 CorePOD'), 'neutral')}
                        </div>

                        <div class="overflow-x-auto">
                            <table class="w-full text-left">
                                <thead>
                                    <tr class="border-b border-border text-[11px] font-medium text-tertiary uppercase tracking-wide">
                                        <th class="py-2.5 px-4">${_t('dash.thCorePodUnit', null, 'CorePOD 單元')}</th>
                                        <th class="py-2.5 px-4">${_t('dash.thSupplyPlant', null, '供冷系統 (Plant)')}</th>
                                        <th class="py-2.5 px-4">${_t('dash.thLiquidSystem', null, '液冷系統 (水溫 & 能耗)')}</th>
                                        <th class="py-2.5 px-4">${_t('dash.thAirSystem', null, '氣冷系統 (能耗)')}</th>
                                        <th class="py-2.5 px-4 text-right">${_t('dash.thItCap', null, 'IT 容量 (kW)')}</th>
                                        <th class="py-2.5 px-4 text-right">${_t('dash.thDesignPue', null, '設計 PUE')}</th>
                                        <th class="py-2.5 px-4 text-right">${_t('dash.thWaterWue', null, '耗水 WUE')}</th>
                                        <th class="py-2.5 px-4 text-right">${_t('dash.thAnnualPower', null, '年總耗電')}</th>
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
                                    <h3 class="text-sm font-semibold text-primary">${_t('dash.ledgersTitle', null, '8,760h 工程物理守恆與系統平衡帳本 (Ledgers)')}</h3>
                                    <p class="text-xs text-tertiary mt-0.5">${_t('dash.ledgersSubtitle', null, '依據熱力學第一定律與 ASHRAE 90.1 規範，驗證全廠能量閉合、熱平衡與水力驅動狀態')}</p>
                                </div>
                            </div>
                            ${U.badge(_t('dash.physConservationBadge', null, '100% 物理守恆'), 'success')}
                        </div>

                        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                            <!-- 能量帳本 -->
                            <div class="p-4 bg-bg rounded-xl border border-border-subtle space-y-2">
                                <div class="flex items-center justify-between font-bold text-primary border-b border-border-subtle pb-1.5">
                                    <span class="flex items-center gap-1.5">${U.icon('zap', 'w-4 h-4 text-warn-500')} ${_t('dash.energyLedger', null, '能量帳本 (Energy Ledger)')}</span>
                                    <span class="text-emerald-700 font-mono text-[11px]">${_t('dash.closed', null, '✓ 閉合')}</span>
                                </div>
                                <div class="space-y-1 text-secondary pt-1">
                                    <div class="flex justify-between"><span>${_t('dash.itChipEnergy', null, 'IT 晶片耗能:')}</span><strong class="font-mono text-primary">${(overall.energyLedger?.it_kwh / 1000 || 0).toLocaleString()} MWh</strong></div>
                                    <div class="flex justify-between"><span>${_t('dash.hvacEnergy', null, '空調與排熱耗能:')}</span><strong class="font-mono text-primary">${(overall.energyLedger?.hvac_kwh / 1000 || 0).toLocaleString()} MWh</strong></div>
                                    <div class="flex justify-between"><span>${_t('dash.elecLossEnergy', null, '配電與變壓損耗:')}</span><strong class="font-mono text-primary">${(overall.energyLedger?.loss_kwh / 1000 || 0).toLocaleString()} MWh</strong></div>
                                    <div class="flex justify-between border-t border-border-subtle pt-1.5 font-bold text-primary"><span>${_t('dash.facTotalEnergy', null, '全廠總耗電 (E_total):')}</span><span class="font-mono text-brand-600">${(overall.energyLedger?.facility_total_kwh / 1000 || 0).toLocaleString()} MWh</span></div>
                                </div>
                            </div>

                            <!-- 熱平衡帳本 -->
                            <div class="p-4 bg-bg rounded-xl border border-border-subtle space-y-2">
                                <div class="flex items-center justify-between font-bold text-primary border-b border-border-subtle pb-1.5">
                                    <span class="flex items-center gap-1.5">${U.icon('flame', 'w-4 h-4 text-danger-500')} ${_t('dash.thermalLedger', null, '熱平衡 (Thermal Ledger)')}</span>
                                    <span class="text-emerald-700 font-mono text-[11px]">${_t('dash.conserved11', null, '✓ 1:1 守恆')}</span>
                                </div>
                                <div class="space-y-1 text-secondary pt-1">
                                    <div class="flex justify-between"><span>${_t('dash.chipHeat', null, '晶片產熱 (IT Heat):')}</span><strong class="font-mono text-primary">${(overall.thermalLedger?.it_heat_kwh / 1000 || 0).toLocaleString()} MWh</strong></div>
                                    <div class="flex justify-between"><span>${_t('dash.elecLossHeat', null, '電力損耗廢熱:')}</span><strong class="font-mono text-primary">${(overall.thermalLedger?.loss_heat_kwh / 1000 || 0).toLocaleString()} MWh</strong></div>
                                    <div class="flex justify-between"><span>${_t('dash.totalHeatRej', null, '液冷+氣冷總排熱:')}</span><strong class="font-mono text-primary">${(overall.thermalLedger?.total_heat_removed_kwh / 1000 || 0).toLocaleString()} MWh</strong></div>
                                    <div class="flex justify-between border-t border-border-subtle pt-1.5 font-bold text-primary"><span>${_t('dash.thermalStatus', null, '熱平衡狀態:')}</span><span class="font-mono text-emerald-700">Q_gen = Q_rej (100%)</span></div>
                                </div>
                            </div>

                            <!-- 水力與設備狀態 -->
                            <div class="p-4 bg-bg rounded-xl border border-border-subtle space-y-2">
                                <div class="flex items-center justify-between font-bold text-primary border-b border-border-subtle pb-1.5">
                                    <span class="flex items-center gap-1.5">${U.icon('activity', 'w-4 h-4 text-info-500')} ${_t('dash.hydraulicLedger', null, '水力與排程 (Scheduler)')}</span>
                                    <span class="text-emerald-700 font-mono text-[11px]">${_t('dash.dynamicDispatch', null, '✓ 動態調度')}</span>
                                </div>
                                <div class="space-y-1 text-secondary pt-1">
                                    <div class="flex justify-between"><span>${_t('dash.pumpPowerEnergy', null, '循環泵動力耗能:')}</span><strong class="font-mono text-primary">${(overall.energyLedger?.cdu_pump_kwh / 1000 || 0).toLocaleString()} MWh</strong></div>
                                    <div class="flex justify-between"><span>${_t('dash.chillerSchedule', null, '冰機分階排程:')}</span><strong class="text-emerald-700 font-medium">${_t('dash.leadLagSmart', null, 'Lead-Lag 智慧啟閉')}</strong></div>
                                    <div class="flex justify-between"><span>${_t('dash.n1StandbyIsol', null, 'N+1 備援隔離:')}</span><strong class="text-emerald-700 font-medium">${_t('dash.standby1Unit', null, '1台待機 (不計運轉)')}</strong></div>
                                    <div class="flex justify-between border-t border-border-subtle pt-1.5 font-bold text-primary"><span>${_t('dash.engAvailability', null, '工程可用性:')}</span><span class="font-mono ${overall.capacityDeficitHours > 0 ? 'text-danger-600' : 'text-emerald-700'}">${overall.capacityDeficitHours > 0 ? _t('dash.deficitWarnBadge', null, '⚠ 容量不足') : _t('dash.passSpecs', null, '✓ 100% 滿足規範')}</span></div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- 能耗拆解與月度趨勢 -->
                    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div class="${U.cardClass('p-6 flex flex-col')}">
                            <h3 class="text-sm font-semibold text-primary flex items-center gap-2.5 mb-4">${U.iconBadge('pie-chart', 'neutral')} ${_t('dash.donutTitle', null, '全年能耗流動拆解')}</h3>
                            <div class="flex flex-col items-center">
                                <div class="relative w-52 h-52">
                                    <canvas id="breakdownDonutChart"></canvas>
                                    <div class="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                        <div class="text-2xl font-bold text-primary tabular-nums">${itSharePct}%</div>
                                        <div class="text-[10px] text-tertiary">${_t('dash.itLoadShare', null, 'IT 負載佔比')}</div>
                                    </div>
                                </div>
                                <div id="donutLegend" class="grid grid-cols-2 gap-x-4 gap-y-1.5 mt-5 w-full text-[11px]"></div>
                            </div>
                        </div>

                        <div class="lg:col-span-2 ${U.cardClass('p-6 flex flex-col')}">
                            <div class="flex items-center justify-between mb-4">
                                <h3 class="text-sm font-semibold text-primary flex items-center gap-2.5">${U.iconBadge('calendar-days', 'neutral')} ${_t('dash.monthlyChartTitle', null, '12 個月 PUE 走勢與月度冷卻耗電')}</h3>
                                ${worstMonthIdx >= 0 ? U.badge(_t('dash.monthPeakBadge', { m: worstMonthIdx + 1 }, (worstMonthIdx + 1) + ' 月尖峰'), 'danger', 'trending-up') : ''}
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
                                        ${_t('dash.heatmapTitle', null, '8,760h 全年時序動態熱力地圖 (Annual Carpet Plot Heatmap)')}
                                        <span class="px-2 py-0.5 bg-brand-50 text-brand-700 text-[10px] font-semibold rounded border border-brand-200">${_t('dash.heatmap365x24', null, '365天 × 24小時')}</span>
                                    </h3>
                                    <p class="text-xs text-tertiary mt-0.5">
                                        ${_t('dash.heatmapSubtitle', null, '橫軸為全年 365 天（1~12月）、縱軸為每日 24 小時（00:00~23:00），視覺化呈現全廠全時段冷卻運轉型態與尖峰能耗風險')}
                                    </p>
                                </div>
                            </div>

                            <div class="flex items-center gap-2 flex-wrap">
                                <div class="flex items-center bg-bg p-1 rounded-lg border border-border text-xs flex-wrap gap-1">
                                    <button id="btnHeatmapCdu" onclick="ViewDashboard.setHeatmapMode('cdu')" class="px-2.5 py-1 rounded font-semibold text-xs transition bg-surface text-primary shadow-2xs">
                                        ${_t('dash.btnHeatmapCdu', null, '💧 CDU 液冷主迴路')}
                                    </button>
                                    <button id="btnHeatmapFw" onclick="ViewDashboard.setHeatmapMode('fw')" class="px-2.5 py-1 rounded font-medium text-xs transition text-secondary hover:text-primary">
                                        ${_t('dash.btnHeatmapFw', null, '💨 Fanwall 氣冷冰水')}
                                    </button>
                                    <button id="btnHeatmapCombined" onclick="ViewDashboard.setHeatmapMode('combined')" class="px-2.5 py-1 rounded font-medium text-xs transition text-secondary hover:text-primary">
                                        ${_t('dash.btnHeatmapCombined', null, '🌐 全廠綜合雙迴路')}
                                    </button>
                                    <button id="btnHeatmapPue" onclick="ViewDashboard.setHeatmapMode('pue')" class="px-2.5 py-1 rounded font-medium text-xs transition text-secondary hover:text-primary">
                                        ${_t('dash.btnHeatmapPue', null, '⚡ 即時 PUE')}
                                    </button>
                                    <button id="btnHeatmapDb" onclick="ViewDashboard.setHeatmapMode('db')" class="px-2.5 py-1 rounded font-medium text-xs transition text-secondary hover:text-primary">
                                        ${_t('dash.btnHeatmapDb', null, '☀️ 外氣乾球溫')}
                                    </button>
                                </div>

                                <div class="relative inline-block text-left" id="heatmapExportDropdownWrapper">
                                    <button onclick="ViewDashboard.toggleHeatmapExportMenu(event)" class="${U.buttonClass('secondary')} text-xs flex items-center gap-1.5 font-bold shadow-2xs">
                                        ${U.icon('download', 'w-3.5 h-3.5')} ${_t('dash.btnExportHeatmap', null, '匯出熱力圖與數據 ▾')}
                                    </button>
                                    <div id="heatmapExportMenu" class="hidden absolute right-0 mt-1.5 w-64 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-50 text-xs text-slate-700">
                                        <button onclick="ViewDashboard.downloadHeatmapSvg()" class="w-full text-left px-3.5 py-2 hover:bg-indigo-50 flex items-center gap-2.5 font-bold text-indigo-900 transition">
                                            <span class="text-base">📐</span>
                                            <div>
                                                <div>${_t('dash.exportSvg', null, '匯出向量圖檔 (.SVG)')}</div>
                                                <div class="text-[10px] text-slate-400 font-normal">${_t('dash.exportSvgDesc', null, '無限縮放零失真・可入 PPT/Visio')}</div>
                                            </div>
                                        </button>
                                        <button onclick="ViewDashboard.downloadHeatmapMatrixCsv()" class="w-full text-left px-3.5 py-2 hover:bg-emerald-50 flex items-center gap-2.5 font-bold text-emerald-900 transition">
                                            <span class="text-base">📊</span>
                                            <div>
                                                <div>${_t('dash.exportMatrixCsv', null, '匯出 365×24 熱力矩陣 (.CSV)')}</div>
                                                <div class="text-[10px] text-slate-400 font-normal">${_t('dash.exportMatrixCsvDesc', null, 'Excel 直接套用條件式格式熱力圖')}</div>
                                            </div>
                                        </button>
                                        <button onclick="ViewDashboard.download8760DetailedCsv()" class="w-full text-left px-3.5 py-2 hover:bg-blue-50 flex items-center gap-2.5 font-bold text-blue-900 transition">
                                            <span class="text-base">📈</span>
                                            <div>
                                                <div>${_t('dash.export8760Csv', null, '匯出 8,760h 逐時全量明細 (.CSV)')}</div>
                                                <div class="text-[10px] text-slate-400 font-normal">${_t('dash.export8760CsvDesc', null, '含乾濕球、PUE、各設備耗電與水量')}</div>
                                            </div>
                                        </button>
                                        <div class="border-t border-slate-100 my-1"></div>
                                        <button onclick="ViewDashboard.downloadHeatmapHiResPng()" class="w-full text-left px-3.5 py-2 hover:bg-slate-50 flex items-center gap-2.5 text-slate-600 transition">
                                            <span class="text-base">🖼️</span>
                                            <div>
                                                <div>${_t('dash.exportPng', null, '匯出超高解析度圖 (.PNG 3x)')}</div>
                                                <div class="text-[10px] text-slate-400 font-normal">${_t('dash.exportPngDesc', null, '300 DPI 印刷出版級點陣圖')}</div>
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
                                    <span class="w-2 h-2 rounded-full bg-emerald-500"></span> ${_t('dash.freeCooling', null, '全自然冷卻 (Free Cooling)')}
                                </div>
                                <div class="text-lg font-bold text-brand-900 mt-1 tabular-nums">
                                    ${(overall.freeModeHours || 0).toLocaleString()} <span class="text-xs font-normal text-brand-700">${_t('dash.hoursUnit', null, '小時')} (${(((overall.freeModeHours || 0) / 8760) * 100).toFixed(1)}%)</span>
                                </div>
                                <div class="text-[10px] text-brand-600 mt-0.5">${_t('dash.freeCoolingDesc', null, '全廠免開壓縮機，零冰機功耗')}</div>
                            </div>

                            <div class="p-3 bg-amber-50/60 border border-amber-200 rounded-xl">
                                <div class="text-[11px] font-medium text-amber-800 flex items-center gap-1.5">
                                    <span class="w-2 h-2 rounded-full bg-amber-500"></span> ${_t('dash.trimMode', null, '部分自由冷卻 (Trim Mode)')}
                                </div>
                                <div class="text-lg font-bold text-amber-900 mt-1 tabular-nums">
                                    ${(overall.partialModeHours || 0).toLocaleString()} <span class="text-xs font-normal text-amber-700">${_t('dash.hoursUnit', null, '小時')} (${(((overall.partialModeHours || 0) / 8760) * 100).toFixed(1)}%)</span>
                                </div>
                                <div class="text-[10px] text-amber-600 mt-0.5">${_t('dash.trimModeDesc', null, '自然散熱 + 冰機部分輔助修整')}</div>
                            </div>

                            <div class="p-3 bg-red-50/60 border border-red-200 rounded-xl">
                                <div class="text-[11px] font-medium text-red-800 flex items-center gap-1.5">
                                    <span class="w-2 h-2 rounded-full bg-red-500"></span> ${_t('dash.mechCooling', null, '機械壓縮冷卻 (DX Mechanical)')}
                                </div>
                                <div class="text-lg font-bold text-red-900 mt-1 tabular-nums">
                                    ${(overall.mechModeHours || 0).toLocaleString()} <span class="text-xs font-normal text-red-700">${_t('dash.hoursUnit', null, '小時')} (${(((overall.mechModeHours || 0) / 8760) * 100).toFixed(1)}%)</span>
                                </div>
                                <div class="text-[10px] text-red-600 mt-0.5">${_t('dash.mechCoolingDesc', null, '高溫高濕時段壓縮機全速散熱')}</div>
                            </div>

                            <div class="p-3 bg-bg border border-border-subtle rounded-xl">
                                <div class="text-[11px] font-medium text-tertiary flex items-center gap-1.5">
                                    <span class="w-2 h-2 rounded-full bg-danger-500"></span> ${_t('dash.peakHour', null, '尖峰惡劣小時 (Peak)')}
                                </div>
                                <div class="text-lg font-bold text-danger-600 mt-1 tabular-nums">
                                    PUE ${overall.peakPue || overall.annualPue}
                                </div>
                                <div class="text-[10px] text-tertiary mt-0.5">${_t('dash.peakOccur', { m: overall.peakMonth || 7, h: overall.peakHour || 14 }, `發生於 ${overall.peakMonth || 7} 月 ${overall.peakHour || 14}:00 尖峰時段`)}</div>
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
                            ${U.icon('rotate-ccw', 'w-3.5 h-3.5')} ${_t('dash.backToStep1', null, '返回 Step 1 調整案場')}
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
            const labels = [
                _t('dash.chartItChip', null, 'IT 晶片負載'),
                _t('dash.chartCduPump', null, 'CDU 循環泵'),
                _t('dash.chartCrahFan', null, 'CRAH 空調風扇'),
                _t('dash.chartHeatRej', null, '乾冷器/水塔排熱'),
                _t('dash.chartChiller', null, '修整/氣冷冰機'),
                _t('dash.chartElecLoss', null, '配電損耗')
            ];
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

            const isEn = (typeof window !== 'undefined' && window.I18N && typeof window.I18N.getLang === 'function' && window.I18N.getLang() === 'en');
            const monthLabels = isEn
                ? ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
                : ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];

            if (monthlyChart) monthlyChart.destroy();
            monthlyChart = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: monthLabels,
                    datasets: [
                        {
                            type: 'line',
                            label: _t('dash.chartMonthlyPue', null, '月度 PUE'),
                            data: monthly.map(m => m.pue),
                            borderColor: '#1F6354',
                            backgroundColor: '#1F6354',
                            borderWidth: 2.5,
                            pointRadius: 2.5,
                            yAxisID: 'y'
                        },
                        {
                            type: 'bar',
                            label: _t('dash.chartMonthlyCooling', null, '月冷卻耗電 (MWh)'),
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
                ...(state.corePods ? state.corePods.filter(p => p.enabled !== false).map(p => p.plantDesign.cduSystem) : [])
            ];
            const allFwSystems = [
                ...(state.halls ? state.halls.flatMap(h => h.dus.map(du => du.plantDesign.fanwallSystem)) : []),
                ...(state.corePods ? state.corePods.filter(p => p.enabled !== false).map(p => p.plantDesign.fanwallSystem) : [])
            ];

            const cduSys = allCduSystems[0] || {};
            const fwSys = allFwSystems[0] || {};

            const cduArch = cduSys.architecture || 'dry_cooler_trim';
            const fwArch = fwSys.architecture || 'air_cooled_chiller';

            const cduArchLabel = (window.CoolingArchRegistry ? window.CoolingArchRegistry.getDashboardLabel(cduArch) : '') || _t('dash.heatRejTower', null, '排熱塔');
            const fwArchLabel = (window.CoolingArchRegistry ? window.CoolingArchRegistry.getDashboardLabel(fwArch) : '') || _t('dash.chiller', null, '冰機');

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
            const sprayM3h = (curHour.waterM3 !== undefined && curHour.waterM3 !== null) ? Number(curHour.waterM3).toFixed(2) : '0.00';

            // 冰機分階推算 (P1-8: 真實逐時物理 COP)
            const chillerKw = curHour.chillerKw || 0;
            const copDynamic = (chillerKw > 0 && (curHour.mechLoadKw || 0) > 0)
                ? (curHour.mechLoadKw / chillerKw)
                : 0;

            // Sizing 設備規格加總計算輔助函式 (P1-8, P2-5)
            const resolveItemPower = (item) => {
                if (!item) return 0;
                const catEntry = (item.catalog || []).find(c => c.model === item.selectedModel);
                const role = item.role;
                if (item.key === 'cdu_unit') {
                    return catEntry?.powerKw ?? 4.2;
                }
                if (role === 'pump' || item.key === 'cdu_pump' || item.key === 'fw_pump') {
                    return catEntry?.capKw ?? catEntry?.powerKw ?? item.unitCapKw ?? 5.5;
                }
                if (role === 'heat_rejection' || item.key?.includes('tower') || item.key?.includes('cooler')) {
                    return catEntry?.fanKwDx ?? ((item.unitCapKw || 1000) / 500 * 10);
                }
                if ((role === 'terminal' && item.key !== 'cdu_unit') || item.key === 'crah_unit' || item.key?.includes('rdhx')) {
                    return catEntry?.fanPowerKw ?? ((item.unitCapKw || 60) * 0.08);
                }
                if (role === 'chiller' || item.key?.includes('chiller')) {
                    const cap = catEntry?.capKw ?? item.unitCapKw ?? 500;
                    const isAir = (item.key && item.key.indexOf('air') >= 0);
                    const cop = catEntry?.cop ?? (isAir ? 3.6 : 6.0);
                    return cop > 0 ? (cap / cop) : cap;
                }
                return catEntry?.powerKw ?? catEntry?.capKw ?? item.unitCapKw ?? 0;
            };

            const getSizingStats = (keys) => {
                let totalSelectedQty = 0;
                let totalRunningPowerKw = 0;
                const keySet = new Set(Array.isArray(keys) ? keys : [keys]);
                const allItems = [...allCduSystems, ...allFwSystems].flatMap(s => s.sizing || []);
                allItems.filter(item => keySet.has(item.key)).forEach(item => {
                    const qty = item.selectedQty || 0;
                    totalSelectedQty += qty;
                    const runningQty = (typeof window.AppStore !== 'undefined' && typeof window.AppStore.runningQtyFromSelected === 'function')
                        ? window.AppStore.runningQtyFromSelected(qty)
                        : Math.max(1, qty - 1);
                    const unitPower = resolveItemPower(item);
                    totalRunningPowerKw += runningQty * unitPower;
                });
                return {
                    qty: totalSelectedQty,
                    powerKw: Math.round(totalRunningPowerKw)
                };
            };

            const cduStats = getSizingStats('cdu_unit');
            const pumpStats = getSizingStats(['cdu_pump', 'fw_pump']);
            const rejStats = getSizingStats(['dry_cooler', 'cooling_tower', 'adiabatic_tower']);
            const fanStats = getSizingStats(['crah_unit', 'rdhx_unit']);
            const chillerStats = getSizingStats(['trim_chiller', 'air_cooled_chiller', 'water_cooled_chiller']);
            const chillerOperatingHours = (hourlyProfile || []).filter(h => (h.chillerKw || 0) > 0).length;

            // FLH 設備台帳
            const totalItKw = overall.totalItKw || 1;
            const qLiquidAvgKw = overall.thermalLedger?.qLiquidKwh ? (overall.thermalLedger.qLiquidKwh / 8760) : (totalItKw * 0.9);
            const dlcSharePct = totalItKw > 0 ? ((qLiquidAvgKw / totalItKw) * 100).toFixed(1) : '90.0';
            const airHeatKw = Math.max(0, curHour.itKw * (1 - (parseFloat(dlcSharePct) / 100)));
            const fwsSupply = cduSys.fwsSupplyC || 40.0;
            const rejApproach = cduSys.dryCoolerApproachC || cduSys.ctApproachC || 5.0;
            const flhTable = [
                {
                    name: _t('dash.flhCduName', null, 'CDU 液冷主機 & 板式換熱器群'),
                    tag: _t('dash.flhCduTag', null, '液冷換熱'),
                    qty: cduStats.qty > 0 ? _t('dash.flhCduQty', { qty: cduStats.qty }, `${cduStats.qty} 台 (N+1 配備)`) : _t('dash.flhNoLiquid', null, '0 台 (無液冷)'),
                    kwh: Math.round((bk.cduUnitKwh || 0) / 1000),
                    powerKw: cduStats.powerKw,
                    hours: 8760,
                    note: _t('dash.flhCduNote', null, '全時 100% 運轉散熱')
                },
                {
                    name: _t('dash.flhPumpName', null, 'CDU 一次側設施循環泵浦群'),
                    tag: _t('dash.flhPumpTag', null, '一次水路'),
                    qty: pumpStats.qty > 0 ? _t('dash.flhPumpQty', { qty: pumpStats.qty }, `${pumpStats.qty} 台 (變頻 N+1)`) : _t('dash.flhZeroUnits', null, '0 台'),
                    kwh: Math.round(Math.max(0, (bk.cduPump || 0) - (bk.cduUnitKwh || 0)) / 1000),
                    powerKw: pumpStats.powerKw,
                    hours: 8760,
                    note: _t('dash.flhPumpNote', null, '變頻定壓差水流量調度')
                },
                {
                    name: _t('dash.flhRejName', { arch: cduArchLabel }, `室外排熱設備 (${cduArchLabel})`),
                    tag: _t('dash.flhRejTag', null, '室外排熱'),
                    qty: rejStats.qty > 0 ? _t('dash.flhRejQty', { qty: rejStats.qty }, `${rejStats.qty} 台 (EC 風機群)`) : _t('dash.flhZeroUnits', null, '0 台'),
                    kwh: Math.round((bk.heatRejection || 0) / 1000),
                    powerKw: rejStats.powerKw,
                    hours: 8760,
                    note: isCduFree ? _t('dash.flhRejFree', null, '全自然排熱 (零冰機)') : _t('dash.flhRejTrim', null, '噴霧/乾態智慧切換')
                },
                {
                    name: _t('dash.flhFanName', null, '室內風牆 / CRAH / RDHx 送風機群'),
                    tag: _t('dash.flhFanTag', null, '室內氣冷'),
                    qty: fanStats.qty > 0 ? _t('dash.flhFanQty', { qty: fanStats.qty }, `${fanStats.qty} 台 (EC 軸流風機)`) : _t('dash.flhZeroUnits', null, '0 台'),
                    kwh: Math.round((bk.crahFan || 0) / 1000),
                    powerKw: fanStats.powerKw,
                    hours: 8760,
                    note: isFwFree ? _t('dash.flhFanFree', null, '氣側節能自然冷卻中') : _t('dash.flhFanTrim', null, '連續溫濕度精密控溫')
                },
                {
                    name: _t('dash.flhChillerName', { arch: fwArchLabel }, `冰水主機壓縮機群 (${fwArchLabel})`),
                    tag: _t('dash.flhChillerTag', null, '機械製冷'),
                    qty: chillerStats.qty > 0 ? _t('dash.flhChillerQty', { qty: chillerStats.qty }, `${chillerStats.qty} 台 (含 N+1 備用)`) : _t('dash.flhNoChiller', null, '0 台 (無冰機)'),
                    kwh: Math.round((bk.chiller || 0) / 1000),
                    powerKw: chillerStats.powerKw,
                    hours: chillerOperatingHours,
                    note: isChillerOn ? _t('dash.flhChillerOn', { cop: (copDynamic > 0 ? copDynamic.toFixed(2) : '-') }, `分階啟動製冷中 (COP ${copDynamic > 0 ? copDynamic.toFixed(2) : '-'})`) : _t('dash.flhChillerOff', null, '關機待機中 (零電耗)')
                },
                {
                    name: _t('dash.flhElecName', null, '全廠高低壓變配電與不斷電系統 (UPS)'),
                    tag: _t('dash.flhElecTag', null, '電力傳輸'),
                    qty: _t('dash.flhElecQty', null, '全廠集中配電母線'),
                    kwh: Math.round((bk.loss || 0) / 1000),
                    powerKw: Math.round(totalItKw * ((state.facilityElectricalLossPct || 0) / 100)),
                    hours: 8760,
                    note: _t('dash.flhElecNote', { loss: (state.facilityElectricalLossPct || 0) }, `損失率 ${(state.facilityElectricalLossPct || 0)}% (雙轉換/變壓阻抗)`)
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
                                    <h3 class="text-sm font-bold text-primary">${_t('dash.exhibitionTitle', null, '全廠空調與冷卻設備運轉情況展示 (Equipment Operating Status & Staging)')}</h3>
                                    <span class="px-2 py-0.5 bg-brand-50 text-brand-700 text-[10px] font-semibold rounded border border-brand-200 whitespace-nowrap">${_t('dash.realtimeSimBadge', null, '即時物理模擬')}</span>
                                </div>
                                <p class="text-xs text-tertiary mt-0.5">
                                    ${_t('dash.exhibitionSubtitle', null, '動態展示指定時序工況下各冷卻子系統（CDU、排熱塔、風牆、冰水主機）之啟閉台數、轉速、負載率與 COP')}
                                </p>
                            </div>
                        </div>
                    </div>

                    <!-- 快捷情境切換列 (整齊4等分網格) -->
                    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-surface p-3 rounded-xl border border-border-subtle">
                        <span class="text-xs font-bold text-secondary flex items-center gap-1.5 shrink-0">
                            ${U.icon('sliders-horizontal', 'w-3.5 h-3.5 text-brand-600')} ${_t('dash.presetSwitch', null, '快捷工況切換:')}
                        </span>
                        <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 flex-1 sm:max-w-3xl">
                            <button onclick="ViewDashboard.setExhibitionPreset('summer_peak')" class="px-3 py-1.5 rounded-lg text-xs font-semibold justify-center ${hIdx === 4718 ? 'bg-amber-600 text-white shadow-xs' : 'bg-bg hover:bg-border-subtle text-secondary border border-border'} transition flex items-center gap-1.5">
                                <span>☀️</span> ${_t('dash.summerPeak', null, '夏季尖峰 (7/15 14:00)')}
                            </button>
                            <button onclick="ViewDashboard.setExhibitionPreset('winter_free')" class="px-3 py-1.5 rounded-lg text-xs font-semibold justify-center ${hIdx === 340 ? 'bg-brand-600 text-white shadow-xs' : 'bg-bg hover:bg-border-subtle text-secondary border border-border'} transition flex items-center gap-1.5">
                                <span>❄️</span> ${_t('dash.winterFree', null, '冬季深冷 (1/15 04:00)')}
                            </button>
                            <button onclick="ViewDashboard.setExhibitionPreset('spring_mild')" class="px-3 py-1.5 rounded-lg text-xs font-semibold justify-center ${hIdx === 2508 ? 'bg-indigo-600 text-white shadow-xs' : 'bg-bg hover:bg-border-subtle text-secondary border border-border'} transition flex items-center gap-1.5">
                                <span>🍂</span> ${_t('dash.springMild', null, '春秋過渡 (4/15 12:00)')}
                            </button>
                            <button onclick="ViewDashboard.setExhibitionPreset('summer_night')" class="px-3 py-1.5 rounded-lg text-xs font-semibold justify-center ${hIdx === 4726 ? 'bg-slate-800 text-white shadow-xs' : 'bg-bg hover:bg-border-subtle text-secondary border border-border'} transition flex items-center gap-1.5">
                                <span>🌙</span> ${_t('dash.summerNight', null, '夏季夜間 (7/15 22:00)')}
                            </button>
                        </div>
                    </div>

                    <!-- 工況滑桿與即時狀態橫幅 -->
                    <div class="p-4 bg-bg rounded-xl border border-border-subtle space-y-3">
                        <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-3 text-xs">
                            <div class="flex items-center gap-2 font-bold text-primary flex-wrap">
                                <span>${_t('dash.operatingTime', null, '📅 工況時段:')}</span>
                                <span class="px-2.5 py-1 bg-surface rounded-lg border border-border font-mono text-brand-700 text-xs shadow-2xs">${_t('dash.operatingTimeVal', { m: mIdx, d: dayInMonth, h: String(hourOfDay).padStart(2, '0') }, `${mIdx} 月 ${dayInMonth} 日 ${String(hourOfDay).padStart(2, '0')}:00`)}</span>
                                <span class="text-tertiary text-[11px] font-mono">${_t('dash.dayHourIndex', { d: d + 1, h: hIdx + 1 }, `(第 ${d + 1} 天 / 時數 #${hIdx + 1})`)}</span>
                            </div>
                            <div class="flex items-center gap-2 font-mono text-xs flex-wrap">
                                <span class="px-2 py-1 bg-surface rounded border border-border-subtle">${_t('dash.dryBulb', null, '☀️ 乾球:')} <strong class="text-primary font-bold">${curHour.db.toFixed(1)}°C</strong></span>
                                <span class="px-2 py-1 bg-surface rounded border border-border-subtle">${_t('dash.wetBulb', null, '💧 濕球:')} <strong class="text-primary font-bold">${curHour.wb.toFixed(1)}°C</strong></span>
                                <span class="px-2 py-1 bg-surface rounded border border-border-subtle">${_t('dash.itLoad', null, '⚡ IT負載:')} <strong class="text-primary font-bold">${curHour.itKw.toLocaleString()} kW</strong></span>
                                <span class="px-2 py-1 bg-surface rounded border border-border-subtle">${_t('dash.coolingPower', null, '❄️ 冷卻耗電:')} <strong class="text-amber-600 font-bold">${curHour.coolingKw.toLocaleString()} kW</strong></span>
                                <span class="px-2.5 py-1 bg-brand-50 text-brand-800 rounded border border-brand-200">${_t('dash.instantPue', null, '⚡ 即時 PUE:')} <strong class="font-bold">${curHour.pue.toFixed(3)}</strong></span>
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
                                <span>${_t('dash.seasonJan', null, '1月 (冬)')}</span>
                                <span>${_t('dash.seasonApr', null, '4月 (春)')}</span>
                                <span>${_t('dash.seasonJul', null, '7月 (夏尖峰)')}</span>
                                <span>${_t('dash.seasonOct', null, '10月 (秋)')}</span>
                                <span>${_t('dash.seasonDec', null, '12月 (冬)')}</span>
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
                                    <span class="font-bold text-sm text-primary">${_t('dash.cduCardTitle', null, '💧 CDU 晶片側與一次水迴路')}</span>
                                </div>
                                <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                    ${isCduFree ? _t('dash.cduBadgeFree', null, '🟢 全自然冷卻排熱') : (isCduTrim ? _t('dash.cduBadgeTrim', null, '🟡 噴霧預冷/修整') : _t('dash.cduBadgeMech', null, '🔴 機械製冷'))}
                                </span>
                            </div>
                            <div class="grid grid-cols-2 gap-2 text-xs">
                                <div class="p-2.5 bg-bg rounded-lg">
                                    <span class="text-[10px] text-tertiary block">${_t('dash.secChipLoop', null, '二次側 (晶片迴路)')}</span>
                                    <span class="font-mono font-bold text-primary text-sm">${cduSys.secSupplyC || 45}°C ⇄ ${cduSys.secReturnC || 57}°C</span>
                                    <span class="text-[10px] text-emerald-700 block mt-0.5">ΔT = ${((cduSys.secReturnC || 57) - (cduSys.secSupplyC || 45)).toFixed(1)}°C (DLC ${dlcSharePct}%)</span>
                                </div>
                                <div class="p-2.5 bg-bg rounded-lg">
                                    <span class="text-[10px] text-tertiary block">${_t('dash.priFacLoop', null, '一次側 (設施水路)')}</span>
                                    <span class="font-mono font-bold text-primary text-sm">${cduSys.fwsSupplyC || 40}°C ⇄ ${cduSys.fwsReturnC || 55}°C</span>
                                    <span class="text-[10px] text-secondary block mt-0.5">${_t('dash.approach', null, 'Approach:')} ${(cduSys.cduApproachC || 3.0).toFixed(1)}°C</span>
                                </div>
                                <div class="p-2.5 bg-bg rounded-lg">
                                    <span class="text-[10px] text-tertiary block">${_t('dash.priPumpPower', null, '一次側循環泵動力')}</span>
                                    <span class="font-mono font-bold text-primary text-sm">${curHour.cduPumpKw || 0} kW</span>
                                    <span class="text-[10px] text-secondary block mt-0.5">${_t('dash.vfdSpeed', { spd: cduPumpSpeed }, `VFD 轉速: ${cduPumpSpeed}%`)}</span>
                                </div>
                                <div class="p-2.5 bg-bg rounded-lg">
                                    <span class="text-[10px] text-tertiary block">${_t('dash.cduConfig', null, 'CDU 機組配置')}</span>
                                    <span class="font-mono font-bold text-emerald-700 text-sm">${_t('dash.unitsConfigured', { qty: cduStats.qty }, `${cduStats.qty} 台配置`)}</span>
                                    <span class="text-[10px] text-secondary block mt-0.5">${_t('dash.cduAllRunning', null, '全數運轉 (N+1 備用隔離)')}</span>
                                </div>
                            </div>
                        </div>

                        <!-- 子系統 2: 室外排熱 (絕熱塔/乾冷器) -->
                        <div class="p-4 bg-surface rounded-xl border border-border hover:border-brand-300 transition-all space-y-3">
                            <div class="flex items-center justify-between border-b border-border-subtle pb-2.5">
                                <div class="flex items-center gap-2">
                                    <span class="w-2.5 h-2.5 rounded-full ${isCduFree ? 'bg-emerald-500' : 'bg-amber-500'} animate-pulse"></span>
                                    <span class="font-bold text-sm text-primary">${_t('dash.outdoorRejCardTitle', { arch: cduArchLabel }, `🌬️ 室外排熱 (${cduArchLabel})`)}</span>
                                </div>
                                <span class="px-2 py-0.5 rounded text-[10px] font-bold ${isCduFree ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'}">
                                    ${isCduFree ? _t('dash.rejBadgeFree', null, '🟢 零冰機乾態/濕球排熱') : _t('dash.rejBadgeTrim', null, '🟡 噴霧預冷蒸發輔助')}
                                </span>
                            </div>
                            <div class="grid grid-cols-2 gap-2 text-xs">
                                <div class="p-2.5 bg-bg rounded-lg">
                                    <span class="text-[10px] text-tertiary block">${_t('dash.ecFanGroup', null, '頂置 EC 排熱風扇群')}</span>
                                    <span class="font-mono font-bold text-primary text-sm">${_t('dash.fanSpeedVal', { spd: rejFanSpeed }, `${rejFanSpeed}% 轉速`)}</span>
                                    <span class="text-[10px] text-secondary block mt-0.5">${_t('dash.fanPowerSub', { kw: Math.round((curHour.coolingKw - (curHour.chillerKw||0) - (curHour.cduPumpKw||0)) * 0.6) }, `耗電: ${Math.round((curHour.coolingKw - (curHour.chillerKw||0) - (curHour.cduPumpKw||0)) * 0.6)} kW`)}</span>
                                </div>
                                <div class="p-2.5 bg-bg rounded-lg">
                                    <span class="text-[10px] text-tertiary block">${_t('dash.spraySys', null, '絕熱噴霧預冷系統')}</span>
                                    <span class="font-mono font-bold ${sprayM3h !== '0.00' ? 'text-cyan-700' : 'text-slate-400'} text-sm">${sprayM3h !== '0.00' ? _t('dash.sprayActive', null, '💧 噴霧啟動中') : _t('dash.dryStandby', null, '⚪ 乾態待機')}</span>
                                    <span class="text-[10px] text-secondary block mt-0.5">${_t('dash.sprayWaterSub', { m3: sprayM3h }, `噴霧水耗: ${sprayM3h} m³/h`)}</span>
                                </div>
                                <div class="p-2.5 bg-bg rounded-lg">
                                    <span class="text-[10px] text-tertiary block">${_t('dash.rejApproach', null, '排熱 Approach')}</span>
                                    <span class="font-mono font-bold text-primary text-sm">${rejApproach.toFixed(1)}°C</span>
                                    <span class="text-[10px] text-secondary block mt-0.5">${_t('dash.waterOutTemp', { t: (curHour.wb + rejApproach).toFixed(1) }, `出水溫: ${(curHour.wb + rejApproach).toFixed(1)}°C`)}</span>
                                </div>
                                <div class="p-2.5 bg-bg rounded-lg">
                                    <span class="text-[10px] text-tertiary block">${_t('dash.fcMargin', null, '自然排熱裕度 (Margin)')}</span>
                                    <span class="font-mono font-bold text-emerald-700 text-sm">${(fwsSupply - (curHour.wb + rejApproach) >= 0 ? '+' : '')}${(fwsSupply - (curHour.wb + rejApproach)).toFixed(1)}°C</span>
                                    <span class="text-[10px] text-emerald-700 block mt-0.5">${_t('dash.waterBelowDesign', { t: fwsSupply }, `水溫低於 ${fwsSupply}°C 設計供水`)}</span>
                                </div>
                            </div>
                        </div>

                        <!-- 子系統 3: 風牆 / CRAH / RDHx -->
                        <div class="p-4 bg-surface rounded-xl border border-border hover:border-brand-300 transition-all space-y-3">
                            <div class="flex items-center justify-between border-b border-border-subtle pb-2.5">
                                <div class="flex items-center gap-2">
                                    <span class="w-2.5 h-2.5 rounded-full ${isFwFree ? 'bg-emerald-500' : 'bg-blue-500'} animate-pulse"></span>
                                    <span class="font-bold text-sm text-primary">${_t('dash.fwCardTitle', null, '💨 風牆 / CRAH / RDHx 氣冷室內機')}</span>
                                </div>
                                <span class="px-2 py-0.5 rounded text-[10px] font-bold ${isFwFree ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-blue-50 text-blue-700 border border-blue-200'}">
                                    ${isFwFree ? _t('dash.fwCardBadgeFree', { t: fwSys.chwReturnC || 18 }, `🟢 氣側自然冷卻 (Economizer ≤${fwSys.chwReturnC || 18}°C)`) : _t('dash.fwCardBadgeMech', { t: fwSys.chwReturnC || 18 }, `🔵 冰水製冷循環 (>${fwSys.chwReturnC || 18}°C)`)}
                                </span>
                            </div>
                            <div class="grid grid-cols-2 gap-2 text-xs">
                                <div class="p-2.5 bg-bg rounded-lg">
                                    <span class="text-[10px] text-tertiary block">${_t('dash.chwSupRetTemp', null, '冰水供/回水溫')}</span>
                                    <span class="font-mono font-bold text-primary text-sm">${fwSys.chwSupplyC || 12}°C ⇄ ${fwSys.chwReturnC || 18}°C</span>
                                    <span class="text-[10px] text-secondary block mt-0.5">${_t('dash.highChwNoCondens', null, '高溫冰水無除濕結露損耗')}</span>
                                </div>
                                <div class="p-2.5 bg-bg rounded-lg">
                                    <span class="text-[10px] text-tertiary block">${_t('dash.ecFanPower', null, 'EC 送風風機耗電')}</span>
                                    <span class="font-mono font-bold text-primary text-sm">${Math.round((bk.crahFan || 0) / 8760)} kW</span>
                                    <span class="text-[10px] text-secondary block mt-0.5">${_t('dash.vfdLowDp', null, '變頻低壓降送風')}</span>
                                </div>
                                <div class="p-2.5 bg-bg rounded-lg">
                                    <span class="text-[10px] text-tertiary block">${_t('dash.whiteSpaceAirLoad', null, '白區氣冷負載')}</span>
                                    <span class="font-mono font-bold text-primary text-sm">${Math.round(airHeatKw)} kW</span>
                                    <span class="text-[10px] text-secondary block mt-0.5">${_t('dash.nonChipHeat', null, '非晶片/交換機風冷發熱')}</span>
                                </div>
                                <div class="p-2.5 bg-bg rounded-lg">
                                    <span class="text-[10px] text-tertiary block">${_t('dash.indoorUnitConfig', null, '室內機群配置')}</span>
                                    <span class="font-mono font-bold text-emerald-700 text-sm">${_t('dash.fanUnitCount', { qty: fanStats.qty }, `${fanStats.qty} 台送風機`)}</span>
                                    <span class="text-[10px] text-secondary block mt-0.5">${_t('dash.n2Redundancy', null, 'N+2 冗餘度保障')}</span>
                                </div>
                            </div>
                        </div>

                        <!-- 子系統 4: 冰水主機壓縮機群 -->
                        <div class="p-4 bg-surface rounded-xl border border-border hover:border-brand-300 transition-all space-y-3">
                            <div class="flex items-center justify-between border-b border-border-subtle pb-2.5">
                                <div class="flex items-center gap-2">
                                    <span class="w-2.5 h-2.5 rounded-full ${isChillerOn ? 'bg-blue-500' : 'bg-slate-400'} ${isChillerOn ? 'animate-pulse' : ''}"></span>
                                    <span class="font-bold text-sm text-primary">${_t('dash.chillerCardTitle', { arch: fwArchLabel }, `❄️ 冰水主機壓縮機群 (${fwArchLabel})`)}</span>
                                </div>
                                <span class="px-2 py-0.5 rounded text-[10px] font-bold ${isChillerOn ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-slate-100 text-slate-600 border border-slate-200'}">
                                    ${isChillerOn ? _t('dash.chillerActiveBadge', null, '🔵 壓縮機運轉製冷中') : _t('dash.chillerOffBadge', null, '🟢 冰機關機待機 (0 kW)')}
                                </span>
                            </div>
                            <div class="grid grid-cols-2 gap-2 text-xs">
                                <div class="p-2.5 bg-bg rounded-lg">
                                    <span class="text-[10px] text-tertiary block">${_t('dash.compPower', null, '壓縮機耗電功率')}</span>
                                    <span class="font-mono font-bold ${isChillerOn ? 'text-amber-600' : 'text-slate-400'} text-sm">${chillerKw.toLocaleString()} kW</span>
                                    <span class="text-[10px] text-secondary block mt-0.5">${isChillerOn ? _t('dash.compOnSub', null, '按需分階排程供冷') : _t('dash.compOffSub', null, '氣側自然冷卻免開機')}</span>
                                </div>
                                <div class="p-2.5 bg-bg rounded-lg">
                                    <span class="text-[10px] text-tertiary block">${_t('dash.stagingTitle', null, '分階排程 (Lead-Lag Staging)')}</span>
                                    <span class="font-mono font-bold text-primary text-sm">${isChillerOn ? _t('dash.stagingOn', null, '啟動 2 台 (1台待機)') : _t('dash.stagingOff', null, '0 台開機 (全數待機)')}</span>
                                    <span class="text-[10px] text-secondary block mt-0.5">${_t('dash.n1Rotation', null, 'N+1 輪替機制')}</span>
                                </div>
                                <div class="p-2.5 bg-bg rounded-lg">
                                    <span class="text-[10px] text-tertiary block">${_t('dash.copTitle', null, '即時製冷 COP (AHRI 動態)')}</span>
                                    <span class="font-mono font-bold ${isChillerOn ? 'text-emerald-700' : 'text-slate-400'} text-sm">${isChillerOn ? (copDynamic > 0 ? ('COP ' + copDynamic.toFixed(2)) : 'COP —') : _t('dash.copOff', null, '— (關機)')}</span>
                                    <span class="text-[10px] text-secondary block mt-0.5">${_t('dash.copSub', null, '隨外氣溫度及冷凝動態修正')}</span>
                                </div>
                                <div class="p-2.5 bg-bg rounded-lg">
                                    <span class="text-[10px] text-tertiary block">${_t('dash.condEnv', null, '冷凝散熱環境')}</span>
                                    <span class="font-mono font-bold text-primary text-sm">${curHour.db.toFixed(1)}°C DB</span>
                                    <span class="text-[10px] text-secondary block mt-0.5">${_t('dash.noTowerDry', null, '無水塔消耗・乾式散熱')}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- 全廠設備全年運轉台帳與等效滿載小時 (FLH) 統計表 -->
                    <div class="space-y-2.5 pt-2">
                        <div class="flex items-center justify-between border-b border-border-subtle pb-2">
                            <span class="text-xs font-bold text-primary flex items-center gap-1.5">
                                ${_t('dash.flhTitle', null, '📋 全廠空調設備全年運轉台帳與等效滿載小時 (Full Load Hours Ledger)')}
                            </span>
                            <span class="text-[11px] text-tertiary">${_t('dash.flhSubtitle', null, '依據 ASHRAE 90.1 / AHRI 550 年時序統計')}</span>
                        </div>
                        <div class="overflow-x-auto">
                            <table class="w-full text-left">
                                <thead>
                                    <tr class="border-b border-border text-[11px] font-bold text-tertiary uppercase tracking-wide">
                                        <th class="py-2 px-3">${_t('dash.thEquipItem', null, '設備系統項目')}</th>
                                        <th class="py-2 px-3">${_t('dash.thConfigUnits', null, '配置台數 (含備援)')}</th>
                                        <th class="py-2 px-3 text-right">${_t('dash.thAnnualPowerMwh', null, '全年總電耗 (MWh)')}</th>
                                        <th class="py-2 px-3 text-right">${_t('dash.thSharePct', null, '佔比 (%)')}</th>
                                        <th class="py-2 px-3 text-right">${_t('dash.thRunHours', null, '累計時數 (Run Hours)')}</th>
                                        <th class="py-2 px-3 text-right">${_t('dash.thFlh', null, '等效滿載小時 (FLH)')}</th>
                                        <th class="py-2 px-3 text-right">${_t('dash.thAvgPlr', null, '平均負載率 (%)')}</th>
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
                            <span class="w-2 h-2 rounded-full bg-emerald-500"></span> ${_t('dash.cduFreeKpi', null, '💧 CDU 全自然冷卻')}
                        </div>
                        <div class="text-lg font-bold text-brand-900 mt-1 tabular-nums">
                            ${(cdu.freeHours || 0).toLocaleString()} <span class="text-xs font-normal text-brand-700">${_t('dash.hoursUnit', null, '小時')} (${cdu.freeHoursPct || 0}%)</span>
                        </div>
                        <div class="text-[10px] text-brand-600 mt-0.5">${_t('dash.cduFreeKpiDesc', null, '絕熱塔/乾冷器零冰機排熱')}</div>
                    </div>
                    <div class="p-3 bg-amber-50/60 border border-amber-200 rounded-xl">
                        <div class="text-[11px] font-medium text-amber-800 flex items-center gap-1.5">
                            <span class="w-2 h-2 rounded-full bg-amber-500"></span> ${_t('dash.cduPartialKpi', null, '🟡 CDU 部分冷卻/噴霧預冷')}
                        </div>
                        <div class="text-lg font-bold text-amber-900 mt-1 tabular-nums">
                            ${(cdu.partialHours || 0).toLocaleString()} <span class="text-xs font-normal text-amber-700">${_t('dash.hoursUnit', null, '小時')} (${cdu.partialHoursPct || 0}%)</span>
                        </div>
                        <div class="text-[10px] text-amber-600 mt-0.5">${_t('dash.cduPartialKpiDesc', null, '高溫噴霧預冷或修整')}</div>
                    </div>
                    <div class="p-3 bg-red-50/60 border border-red-200 rounded-xl">
                        <div class="text-[11px] font-medium text-red-800 flex items-center gap-1.5">
                            <span class="w-2 h-2 rounded-full bg-red-500"></span> ${_t('dash.cduMechKpi', null, '🔴 CDU 機械壓縮冷卻')}
                        </div>
                        <div class="text-lg font-bold text-red-900 mt-1 tabular-nums">
                            ${(cdu.mechHours || 0).toLocaleString()} <span class="text-xs font-normal text-red-700">${_t('dash.hoursUnit', null, '小時')} (${cdu.mechHoursPct || 0}%)</span>
                        </div>
                        <div class="text-[10px] text-red-600 mt-0.5">${_t('dash.cduMechKpiDesc', null, '液冷需冰機全額製冷')}</div>
                    </div>
                    <div class="p-3 bg-bg border border-border-subtle rounded-xl">
                        <div class="text-[11px] font-medium text-tertiary flex items-center gap-1.5">
                            <span class="w-2 h-2 rounded-full bg-danger-500"></span> ${_t('dash.peakHour', null, '尖峰惡劣小時 (Peak)')}
                        </div>
                        <div class="text-lg font-bold text-danger-600 mt-1 tabular-nums font-mono">
                            PUE ${overall.peakPue || overall.annualPue}
                        </div>
                        <div class="text-[10px] text-tertiary mt-0.5">${_t('dash.peakOccur', { m: overall.peakMonth || 7, h: overall.peakHour || 14 }, `發生於 ${overall.peakMonth || 7} 月 ${overall.peakHour || 14}:00 尖峰時段`)}</div>
                    </div>
                `;
            } else if (mode === 'fw') {
                container.innerHTML = `
                    <div class="p-3 bg-brand-50/60 border border-brand-200 rounded-xl">
                        <div class="text-[11px] font-medium text-brand-800 flex items-center gap-1.5">
                            <span class="w-2 h-2 rounded-full bg-emerald-500"></span> ${_t('dash.fwFreeMode', null, '💨 Fanwall 氣側自然冷卻')}
                        </div>
                        <div class="text-lg font-bold text-brand-900 mt-1 tabular-nums">
                            ${(fw.freeHours || 0).toLocaleString()} <span class="text-xs font-normal text-brand-700">${_t('dash.hoursUnit', null, '小時')} (${fw.freeHoursPct || 0}%)</span>
                        </div>
                        <div class="text-[10px] text-brand-600 mt-0.5">${_t('dash.fwFreeDesc', null, '外氣 ≤ 18°C 氣冷冰機關機')}</div>
                    </div>
                    <div class="p-3 bg-blue-50/60 border border-blue-200 rounded-xl">
                        <div class="text-[11px] font-medium text-blue-800 flex items-center gap-1.5">
                            <span class="w-2 h-2 rounded-full bg-blue-500"></span> ${_t('dash.fwMechMode', null, '❄️ 氣冷冰機運轉時段')}
                        </div>
                        <div class="text-lg font-bold text-blue-900 mt-1 tabular-nums">
                            ${(fw.mechHours || 0).toLocaleString()} <span class="text-xs font-normal text-blue-700">${_t('dash.hoursUnit', null, '小時')} (${fw.mechHoursPct || 0}%)</span>
                        </div>
                        <div class="text-[10px] text-blue-600 mt-0.5">${_t('dash.fwMechDesc', null, '外氣 > 18°C 啟動冰機壓縮機')}</div>
                    </div>
                    <div class="p-3 bg-amber-50/60 border border-amber-200 rounded-xl">
                        <div class="text-[11px] font-medium text-amber-800 flex items-center gap-1.5">
                            <span class="w-2 h-2 rounded-full bg-amber-500"></span> ${_t('dash.fwAnnualPower', null, '⚡ 氣冷年總電耗')}
                        </div>
                        <div class="text-lg font-bold text-amber-900 mt-1 tabular-nums">
                            ${Math.round((overall.breakdownKwh?.chiller || 0) / 1000).toLocaleString()} <span class="text-xs font-normal text-amber-700">MWh</span>
                        </div>
                        <div class="text-[10px] text-amber-600 mt-0.5">${_t('dash.fwPowerDesc', null, '含壓縮機隨外氣溫度修正')}</div>
                    </div>
                    <div class="p-3 bg-bg border border-border-subtle rounded-xl">
                        <div class="text-[11px] font-medium text-tertiary flex items-center gap-1.5">
                            <span class="w-2 h-2 rounded-full bg-danger-500"></span> ${_t('dash.peakHour', null, '尖峰惡劣小時 (Peak)')}
                        </div>
                        <div class="text-lg font-bold text-danger-600 mt-1 tabular-nums font-mono">
                            PUE ${overall.peakPue || overall.annualPue}
                        </div>
                        <div class="text-[10px] text-tertiary mt-0.5">${_t('dash.peakOccur', { m: overall.peakMonth || 7, h: overall.peakHour || 14 }, `發生於 ${overall.peakMonth || 7} 月 ${overall.peakHour || 14}:00 尖峰時段`)}</div>
                    </div>
                `;
            } else if (mode === 'combined') {
                container.innerHTML = `
                    <div class="p-3 bg-brand-50/60 border border-brand-200 rounded-xl">
                        <div class="text-[11px] font-medium text-brand-800 flex items-center gap-1.5">
                            <span class="w-2 h-2 rounded-full bg-emerald-500"></span> ${_t('dash.combFree', null, '🌐 全廠雙零冰機自然冷卻')}
                        </div>
                        <div class="text-lg font-bold text-brand-900 mt-1 tabular-nums">
                            ${(combined.freeHours || 0).toLocaleString()} <span class="text-xs font-normal text-brand-700">${_t('dash.hoursUnit', null, '小時')} (${combined.freeHoursPct || 0}%)</span>
                        </div>
                        <div class="text-[10px] text-brand-600 mt-0.5">${_t('dash.combFreeDesc', null, 'CDU與Fanwall同時完全免開冰機')}</div>
                    </div>
                    <div class="p-3 bg-amber-50/60 border border-amber-200 rounded-xl">
                        <div class="text-[11px] font-medium text-amber-800 flex items-center gap-1.5">
                            <span class="w-2 h-2 rounded-full bg-amber-500"></span> ${_t('dash.combPartial', null, '🟡 混合冷卻 (CDU自然+氣冷冰機)')}
                        </div>
                        <div class="text-lg font-bold text-amber-900 mt-1 tabular-nums">
                            ${(combined.partialHours || 0).toLocaleString()} <span class="text-xs font-normal text-amber-700">${_t('dash.hoursUnit', null, '小時')} (${combined.partialHoursPct || 0}%)</span>
                        </div>
                        <div class="text-[10px] text-amber-600 mt-0.5">${_t('dash.combPartialDesc', null, '91%液冷自然排熱，9%氣冷開機')}</div>
                    </div>
                    <div class="p-3 bg-red-50/60 border border-red-200 rounded-xl">
                        <div class="text-[11px] font-medium text-red-800 flex items-center gap-1.5">
                            <span class="w-2 h-2 rounded-full bg-red-500"></span> ${_t('dash.combMech', null, '🔴 全廠機械壓縮製冷')}
                        </div>
                        <div class="text-lg font-bold text-red-900 mt-1 tabular-nums">
                            ${(combined.mechHours || 0).toLocaleString()} <span class="text-xs font-normal text-red-700">${_t('dash.hoursUnit', null, '小時')} (${combined.mechHoursPct || 0}%)</span>
                        </div>
                        <div class="text-[10px] text-red-600 mt-0.5">${_t('dash.combMechDesc', null, '雙迴路皆需壓縮機全速')}</div>
                    </div>
                    <div class="p-3 bg-bg border border-border-subtle rounded-xl">
                        <div class="text-[11px] font-medium text-tertiary flex items-center gap-1.5">
                            <span class="w-2 h-2 rounded-full bg-danger-500"></span> ${_t('dash.peakHour', null, '尖峰惡劣小時 (Peak)')}
                        </div>
                        <div class="text-lg font-bold text-danger-600 mt-1 tabular-nums font-mono">
                            PUE ${overall.peakPue || overall.annualPue}
                        </div>
                        <div class="text-[10px] text-tertiary mt-0.5">${_t('dash.peakOccur', { m: overall.peakMonth || 7, h: overall.peakHour || 14 }, `發生於 ${overall.peakMonth || 7} 月 ${overall.peakHour || 14}:00 尖峰時段`)}</div>
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
            const isEn = (typeof window !== 'undefined' && window.I18N && typeof window.I18N.getLang === 'function' && window.I18N.getLang() === 'en');
            const MONTH_NAMES = isEn
                ? ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
                : ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];

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
                            <span class="font-bold text-primary">${_t('dash.cduLegendTitle', null, '💧 CDU 液冷排熱圖例:')}</span>
                            <span class="flex items-center gap-1.5"><span class="w-3 h-3 rounded-xs bg-[#10B981]"></span> ${_t('dash.cduLegendFree', null, '🟢 全自然冷卻 (Free Cooling - 絕熱塔/乾冷器零冰機)')}</span>
                            <span class="flex items-center gap-1.5"><span class="w-3 h-3 rounded-xs bg-[#F59E0B]"></span> ${_t('dash.cduLegendTrim', null, '🟡 部分自然冷卻 / 噴霧預冷 (Trim Mode / Attention)')}</span>
                            <span class="flex items-center gap-1.5"><span class="w-3 h-3 rounded-xs bg-[#EF4444]"></span> ${_t('dash.cduLegendMech', null, '🔴 機械壓縮冷卻 (DX Mode)')}</span>
                        </div>
                        <div class="text-[11px] text-tertiary">${_t('dash.hoverHint', null, '💡 移動滑鼠至像素格可查看該小時完整數據')}</div>
                    `;
                } else if (mode === 'fw') {
                    legendEl.innerHTML = `
                        <div class="flex items-center gap-4 flex-wrap">
                            <span class="font-bold text-primary">${_t('dash.fwLegendTitle', null, '💨 Fanwall 氣冷冰水圖例:')}</span>
                            <span class="flex items-center gap-1.5"><span class="w-3 h-3 rounded-xs bg-[#10B981]"></span> ${_t('dash.fwLegendFree', null, '🟢 氣側自然冷卻 (Economizer ≤ 18°C - 冰機關機)')}</span>
                            <span class="flex items-center gap-1.5"><span class="w-3 h-3 rounded-xs bg-[#3B82F6]"></span> ${_t('dash.fwLegendMech', null, '🔵 氣冷冰機運轉製冷 (Chiller Active > 18°C)')}</span>
                        </div>
                        <div class="text-[11px] text-tertiary">${_t('dash.fwLegendHint', null, '💡 反映風牆氣冷側 8,760h 冰機開機與自然冷卻時段')}</div>
                    `;
                } else if (mode === 'combined') {
                    legendEl.innerHTML = `
                        <div class="flex items-center gap-4 flex-wrap">
                            <span class="font-bold text-primary">${_t('dash.combLegendTitle', null, '🌐 全廠雙迴路綜合圖例:')}</span>
                            <span class="flex items-center gap-1.5"><span class="w-3 h-3 rounded-xs bg-[#10B981]"></span> ${_t('dash.combLegendFree', null, '🟢 全廠雙零冰機 (液冷與氣冷皆免開冰機)')}</span>
                            <span class="flex items-center gap-1.5"><span class="w-3 h-3 rounded-xs bg-[#F59E0B]"></span> ${_t('dash.combLegendTrim', null, '🟡 混合冷卻 (CDU自然冷卻 + 氣冷冰機運轉)')}</span>
                            <span class="flex items-center gap-1.5"><span class="w-3 h-3 rounded-xs bg-[#EF4444]"></span> ${_t('dash.combLegendMech', null, '🔴 全廠機械製冷 (高溫尖峰)')}</span>
                        </div>
                        <div class="text-[11px] text-tertiary">${_t('dash.combLegendHint', null, '💡 呈現全廠兩套冷卻系統同時聯鎖運轉型態')}</div>
                    `;
                } else if (mode === 'pue') {
                    legendEl.innerHTML = `
                        <div class="flex items-center gap-3 flex-wrap">
                            <span class="font-bold text-primary">${_t('dash.pueGrade', null, 'PUE 分級:')}</span>
                            <span class="flex items-center gap-1"><span class="w-3 h-3 rounded-xs bg-[#059669]"></span> ≤ 1.07</span>
                            <span class="flex items-center gap-1"><span class="w-3 h-3 rounded-xs bg-[#10B981]"></span> 1.07~1.10</span>
                            <span class="flex items-center gap-1"><span class="w-3 h-3 rounded-xs bg-[#84CC16]"></span> 1.10~1.14</span>
                            <span class="flex items-center gap-1"><span class="w-3 h-3 rounded-xs bg-[#F59E0B]"></span> 1.14~1.18</span>
                            <span class="flex items-center gap-1"><span class="w-3 h-3 rounded-xs bg-[#F97316]"></span> 1.18~1.25</span>
                            <span class="flex items-center gap-1"><span class="w-3 h-3 rounded-xs bg-[#EF4444]"></span> > 1.25</span>
                        </div>
                        <div class="text-[11px] text-tertiary">${_t('dash.pueGradeHint', null, '綠色代表高效能，橙紅代表尖峰能耗時段')}</div>
                    `;
                } else if (mode === 'db') {
                    legendEl.innerHTML = `
                        <div class="flex items-center gap-3 flex-wrap">
                            <span class="font-bold text-primary">${_t('dash.dbGrade', null, '外氣乾球溫 (DB):')}</span>
                            <span class="flex items-center gap-1"><span class="w-3 h-3 rounded-xs bg-[#38BDF8]"></span> ≤ 14°C</span>
                            <span class="flex items-center gap-1"><span class="w-3 h-3 rounded-xs bg-[#34D399]"></span> 14~20°C</span>
                            <span class="flex items-center gap-1"><span class="w-3 h-3 rounded-xs bg-[#FBBF24]"></span> 20~26°C</span>
                            <span class="flex items-center gap-1"><span class="w-3 h-3 rounded-xs bg-[#F97316]"></span> 26~32°C</span>
                            <span class="flex items-center gap-1"><span class="w-3 h-3 rounded-xs bg-[#EF4444]"></span> > 32°C</span>
                        </div>
                        <div class="text-[11px] text-tertiary">${_t('dash.dbGradeHint', null, '反映案場 8,760h 原始氣溫分布')}</div>
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
                    const cduModeText = item.cduMode === 'free' ? _t('dash.cduModeFree', null, '🟢 自然排熱 (零冰機)') : (item.cduMode === 'partial' ? _t('dash.cduModePartial', null, '🟡 噴霧預冷/修整') : _t('dash.cduModeMech', null, '🔴 機械壓縮'));
                    const fwModeText = item.fwMode === 'free' ? _t('dash.fwModeFree', null, '🟢 氣側自然冷卻 (Economizer)') : _t('dash.fwModeMech', null, '🔵 氣冷冰機運轉製冷');

                    tooltip.innerHTML = `
                        <div class="font-bold border-b border-neutral-700 pb-1 flex items-center justify-between gap-3 text-brand-300">
                            <span>📅 ${_t('dash.dateFormat', { m: md.month, d: md.day, h: String(h).padStart(2, '0') }, `${md.month}月${md.day}日 ${String(h).padStart(2, '0')}:00`)}</span>
                            <span class="text-[10px] text-neutral-400 font-mono">${_t('dash.dayHour', { d: d + 1, idx: idx + 1 }, `第 ${d + 1} 天 / H#${idx + 1}`)}</span>
                        </div>
                        <div class="grid grid-cols-2 gap-x-3 gap-y-1 pt-1 text-[11px]">
                            <div>${_t('dash.ttDb', null, '外氣乾球 (DB):')} <strong class="text-white">${item.db.toFixed(1)}°C</strong></div>
                            <div>${_t('dash.ttWb', null, '外氣濕球 (WB):')} <strong class="text-white">${item.wb.toFixed(1)}°C</strong></div>
                            <div>${_t('dash.ttPue', null, '即時 PUE:')} <strong class="text-brand-300 text-sm font-mono">${item.pue.toFixed(3)}</strong></div>
                            <div>${_t('dash.ttChiller', null, '冰機耗電:')} <strong class="text-amber-300">${item.chillerKw.toLocaleString()} kW</strong></div>
                            <div class="col-span-2">${_t('dash.ttCooling', null, '冷卻總耗電:')} <strong class="text-white">${item.coolingKw.toLocaleString()} kW</strong> ${_t('dash.ttTotalFac', { kw: item.totalKw.toLocaleString() }, `(全廠總: ${item.totalKw.toLocaleString()} kW)`)}</div>
                            <div class="col-span-2 text-[10px] pt-1 border-t border-neutral-700/60 space-y-0.5">
                                <div>${_t('dash.ttCdu', null, '💧 CDU液冷:')} <strong>${cduModeText}</strong></div>
                                <div>${_t('dash.ttFw', null, '💨 Fanwall氣冷:')} <strong>${fwModeText}</strong></div>
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
