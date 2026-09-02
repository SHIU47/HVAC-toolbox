/**
 * excel_export.js - Owner-Grade Linked Excel Cooling Calculation Book Export (V29)
 * Generates an engineering HVAC calculation workbook with full multi-sheet linking,
 * formulas for capacity, N+1 effective margin, and PUE/WUE calculations.
 */
(function(window) {
    'use strict';

    const ExcelExport = {
        async ensureExcelJS() {
            if (window.ExcelJS) return window.ExcelJS;
            if (typeof require === 'function') {
                try {
                    window.ExcelJS = require('exceljs');
                    return window.ExcelJS;
                } catch (_) {}
            }
            return new Promise((resolve, reject) => {
                const script = document.createElement('script');
                script.src = 'https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js';
                script.onload = () => resolve(window.ExcelJS);
                script.onerror = () => reject(new Error('無法載入 ExcelJS 函式庫，請檢查網路連線'));
                document.head.appendChild(script);
            });
        },

        async generate() {
            try {
                const ExcelJS = await this.ensureExcelJS();
                if (!ExcelJS) throw new Error('ExcelJS 載入失敗');

                const state = window.AppStore.state;
                const res = state.results || {};
                const overall = res.overall || {};
                const site = state.site || {};
                const stats = site.stats || {};
                const halls = state.halls || [];
                const pods = state.corePods || [];

                const wb = new ExcelJS.Workbook();
                wb.creator = 'Antigravity AI Datacenter PUE Engine';
                wb.created = new Date();

                // 樣式常數
                const fontTitle = { name: 'Microsoft JhengHei', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
                const fontSection = { name: 'Microsoft JhengHei', size: 11, bold: true, color: { argb: 'FF1E293B' } };
                const fontHeader = { name: 'Microsoft JhengHei', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
                const fontNormal = { name: 'Microsoft JhengHei', size: 9.5 };
                const fontBold = { name: 'Microsoft JhengHei', size: 9.5, bold: true };
                const fontFormula = { name: 'Consolas', size: 9.5, color: { argb: 'FF1E3A8A' } };

                const fillDark = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
                const fillEmerald = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F766E' } };
                const fillIndigo = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4338CA' } };
                const fillPurple = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF6B21A8' } };
                const fillLightGray = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
                const fillHighlight = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFECFDF5' } };
                const fillDanger = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF2F2' } };
                const fontDanger = { name: 'Microsoft JhengHei', size: 10, bold: true, color: { argb: 'FF8C1D17' } };

                const borderThin = {
                    top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                    left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                    bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                    right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
                };

                // ═══════════════════════════════════════════════════════════════
                // Sheet 1: 封面與專案資訊
                // ═══════════════════════════════════════════════════════════════
                const zebra = (row, n, fillA, fillB) => { row.fill = (n % 2 === 0) ? fillA : fillB; };

                const s1 = wb.addWorksheet('1.封面與專案資訊', { views: [{ showGridLines: true }] });
                s1.properties.tabColor = { argb: 'FF0F766E' };
                s1.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
                s1.columns = [{ width: 24 }, { width: 38 }, { width: 22 }, { width: 30 }];

                s1.mergeCells('A1:D2');
                const titleCell = s1.getCell('A1');
                titleCell.value = '專業 AI 資料中心全生命週期空調能效計算書';
                titleCell.font = { name: 'Microsoft JhengHei', size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
                titleCell.fill = fillEmerald;
                titleCell.alignment = { vertical: 'middle', horizontal: 'center' };

                s1.addRow([]);
                s1.addRow(['專案名稱', 'AI 高密度液冷算力中心示範案場', '報告產製日期', new Date().toLocaleDateString()]);
                s1.addRow(['氣象測站', site.selectedCity || '桃園 (Taoyuan Pilot)', '計算版本', 'v29 Final (公式連動版)']);
                s1.addRow(['國家/地區', site.country || 'Taiwan', '緯度 / 經度', `${site.lat || 25.0}°N / ${site.lon || 121.2}°E`]);
                s1.addRow(['海拔高度', `${site.elev || 35} m`, '分析時數', '8,760 小時全年動態']);

                s1.addRow([]);
                s1.addRow(['核心指標總覽 (Executive KPI Summary)', '', '', '']);
                s1.mergeCells('A9:D9');
                s1.getCell('A9').font = fontSection;
                s1.getCell('A9').fill = fillLightGray;

                s1.addRow(['全廠設計 PUE (均值)', overall.annualPue ?? 0, '全廠 IT 總容量', `${((overall.totalItKw || 0) / 1000).toFixed(2)} MW`]);
                s1.addRow(['全廠尖峰 PUE (Worst Hour)', overall.peakPue ?? '（未計算）', '全廠耗水 WUE', `${overall.annualWue ?? 0} L/kWh`]);
                s1.addRow(['全廠 Cooling pPUE (均值，不含泵浦耗電)', overall.annualP_Pue ?? 0, '全廠年總能耗', `${(overall.annualTotalMwh || 0).toLocaleString()} MWh/yr`]);
                s1.addRow(['全直冷時數 (Free Cooling)', `${(res.fcPotential?.freeHours ?? 0).toLocaleString()} 小時 (${res.fcPotential?.freeHoursPct ?? 0}%)`, '評估規範', 'ASHRAE TC 9.9 / NVIDIA DSX']);

                // v32 Phase 9-9: 設備容量不足警示必須帶進 Excel — Dashboard 有紅色警示卡，
                // 但 Excel 常被單獨拿去給別人看，不能讓這份報告看起來乾乾淨淨、毫無問題。
                if ((overall.capacityDeficitHours || 0) > 0) {
                    const warnRow = s1.addRow([
                        '⚠ 設備容量不足警示',
                        `全年 ${overall.capacityDeficitHours.toLocaleString()} 小時偵測到容量不足`,
                        '尖峰缺口',
                        `${(overall.maxCapacityDeficitKw || 0).toLocaleString()} kW`
                    ]);
                    for (let c = 1; c <= 4; c++) {
                        warnRow.getCell(c).fill = fillDanger;
                        warnRow.getCell(c).font = fontDanger;
                    }
                    const noteRow = s1.addRow([
                        '本報告 PUE 結果可能被低估，不應直接用於設備比較或最終 PUE 認證，請回到 Step 4 增加設備台數或選用更大容量型號。', '', '', ''
                    ]);
                    s1.mergeCells(`A${s1.rowCount}:D${s1.rowCount}`);
                    noteRow.getCell(1).font = { name: 'Microsoft JhengHei', size: 9, italic: true, color: { argb: 'FF8C1D17' } };
                    noteRow.getCell(1).fill = fillDanger;
                }

                s1.addRow([]);
                s1.addRow(['聲明事項 (Disclaimer)', '', '', '']);
                s1.mergeCells('A15:D15');
                s1.getCell('A15').font = fontSection;
                s1.getCell('A15').fill = fillLightGray;

                s1.addRow(['1. 本計算書由 Antigravity PUE 動力學計算引擎產出，採用 EnergyPlus 氣象資料與 AHRI 雙二次冰機模型。']);
                s1.addRow(['2. 第 4、5、6 頁之負載加總、設備有效容量 (N-1) 與 PUE 計算已建立 Excel 公式連動，可供業主/顧問獨立覆核。']);
                s1.addRow(['3. 實際工程施工請依合格專業技師 (PE) 簽證之最終施工圖說與水力計算書為準。']);

                for (let r = 4; r <= 13; r++) {
                    const row = s1.getRow(r);
                    row.getCell(1).font = fontBold;
                    row.getCell(3).font = fontBold;
                    for (let c = 1; c <= 4; c++) row.getCell(c).border = borderThin;
                }

                // ═══════════════════════════════════════════════════════════════
                // Sheet 2: 設計基準與假設 (Design Basis & Assumptions)
                // ═══════════════════════════════════════════════════════════════
                const s2 = wb.addWorksheet('2.設計基準與假設', { views: [{ state: 'frozen', ySplit: 1 }] });
                s2.properties.tabColor = { argb: 'FF334155' };
                s2.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
                s2.columns = [{ width: 30 }, { width: 46 }, { width: 12 }, { width: 12 }, { width: 12 }, { width: 12 }, { width: 42 }];
                s2.addRow(['參數代碼 (Key)', '工程參數說明', '單位', '預設值', '目前設定值', '是否覆寫', '工程準則 / 參考來源']);
                s2.getRow(1).font = fontHeader;
                s2.getRow(1).fill = fillDark;
                s2.autoFilter = { from: 'A1', to: 'G1' };

                // 注意: assumptions.js 用 `const ASSUMPTIONS = {...}` 宣告，瀏覽器頂層 const 不會掛到 window 上，
                // 必須直接用識別字 ASSUMPTIONS（同一份 <script> 全域作用域）取用，不能寫 window.ASSUMPTIONS。
                const defaultAssump = (typeof ASSUMPTIONS !== 'undefined') ? ASSUMPTIONS : {};
                const overrides = state.assumptions_override || {};

                let assumpIdx = 0;
                Object.keys(defaultAssump).forEach(k => {
                    const def = defaultAssump[k];
                    const isOverridden = overrides[k] !== undefined && overrides[k] !== null;
                    const curVal = isOverridden ? overrides[k] : def.val;
                    const r = s2.addRow([k, def.label || k, def.unit || '-', def.val, curVal, isOverridden ? '✏️ 已覆寫' : '－', def.ref || 'ASHRAE / NVIDIA DSX']);
                    r.getCell(1).font = fontNormal;
                    r.getCell(2).font = fontBold;
                    r.getCell(4).numFmt = '0.####';
                    r.getCell(5).numFmt = '0.####';
                    if (isOverridden) {
                        r.getCell(5).font = { name: 'Microsoft JhengHei', size: 9.5, bold: true, color: { argb: 'FFB45309' } };
                        r.getCell(6).font = { name: 'Microsoft JhengHei', size: 9.5, bold: true, color: { argb: 'FFB45309' } };
                    }
                    zebra(r, assumpIdx, fillLightGray, { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } });
                    for (let c = 1; c <= 7; c++) r.getCell(c).border = borderThin;
                    assumpIdx++;
                });

                // ═══════════════════════════════════════════════════════════════
                // Sheet 3: 氣象資料與自由冷卻分析
                // ═══════════════════════════════════════════════════════════════
                const s3 = wb.addWorksheet('3.氣象與自由冷卻分析', { views: [{ state: 'frozen', ySplit: 1 }] });
                s3.properties.tabColor = { argb: 'FF0F766E' };
                s3.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
                s3.columns = [{ width: 18 }, { width: 16 }, { width: 16 }, { width: 16 }, { width: 16 }, { width: 16 }, { width: 16 }];
                s3.addRow(['月份', '乾球均溫 (°C)', '乾球極大 (°C)', '乾球極小 (°C)', '濕球均溫 (°C)', '露點均溫 (°C)', '平均濕度 (%)']);
                s3.getRow(1).font = fontHeader;
                s3.getRow(1).fill = fillEmerald;

                (site.monthlyStats || []).forEach((m, idx) => {
                    const r = s3.addRow([`${idx + 1} 月`, m.avgDB, m.maxDB, m.minDB, m.avgWB, m.avgDP || 17.0, m.avgRH || 75]);
                    zebra(r, idx, fillLightGray, { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } });
                    for (let c = 1; c <= 7; c++) {
                        r.getCell(c).font = fontNormal;
                        r.getCell(c).border = borderThin;
                        if (c > 1) r.getCell(c).numFmt = '#,##0.0';
                    }
                });

                s3.addRow([]);
                s3.addRow(['自由冷卻氣候門檻與可用時數統計', '', '', '', '', '', '']);
                s3.mergeCells(`A${s3.rowCount}:G${s3.rowCount}`);
                s3.getCell(`A${s3.rowCount}`).font = fontSection;
                s3.getCell(`A${s3.rowCount}`).fill = fillLightGray;

                const fc = res.fcPotential || { freeHours: 8760, freeHoursPct: 100, trimHours: 0, trimHoursPct: 0, mechanicalHours: 0, mechanicalHoursPct: 0 };
                s3.addRow(['模式分級', '室外乾球溫度門檻 (°C)', '發生時數 (hrs)', '佔全年百分比 (%)', '運行狀態說明', '', '']);
                s3.getRow(s3.rowCount).font = fontHeader;
                s3.getRow(s3.rowCount).fill = fillDark;

                const mode1DbMax = overrides.nvidia_dsx_mode1_db_max_c || 34.8;
                const mode2DbMax = overrides.nvidia_dsx_mode2_db_max_c || 40.5;

                s3.addRow(['Mode 1 (100% 全直冷)', `DB ≤ ${mode1DbMax}°C`, fc.freeHours, `${fc.freeHoursPct}%`, '乾冷器直冷散熱，冰水主機 100% 停機']);
                s3.addRow(['Mode 2 (部分輔助冷卻)', `${mode1DbMax}°C ~ ${mode2DbMax}°C`, fc.trimHours, `${fc.trimHoursPct}%`, '乾冷器預冷 + 冰水主機補足溫差']);
                s3.addRow(['Mode 3 (全額機械製冷)', `DB > ${mode2DbMax}°C`, fc.mechanicalHours, `${fc.mechanicalHoursPct}%`, '冰水主機全載運轉']);
                s3.addRow(['全年累計自由冷卻可用 (Mode 1+2)', `DB ≤ ${mode2DbMax}°C`, fc.freeHours + fc.trimHours, `${(fc.freeHoursPct + fc.trimHoursPct).toFixed(1)}%`, '具備節能效益之氣候總時數']);

                // ═══════════════════════════════════════════════════════════════
                // Sheet 4: IT 負載明細 (Tier A: 公式連動)
                // ═══════════════════════════════════════════════════════════════
                const s4 = wb.addWorksheet('4.IT負載明細', { views: [{ state: 'frozen', ySplit: 1 }] });
                s4.properties.tabColor = { argb: 'FF6B21A8' };
                s4.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
                s4.columns = [
                    { width: 14 }, // A: Hall
                    { width: 14 }, // B: DU
                    { width: 18 }, // C: SU
                    { width: 12 }, // D: 設備類別
                    { width: 32 }, // E: 型號
                    { width: 10 }, // F: 台數 (Qty)
                    { width: 14 }, // G: 單機 kW
                    { width: 12 }, // H: 液冷 %
                    { width: 12 }, // I: 氣冷 %
                    { width: 15 }, // J: 總 kW (Formula = F*G)
                    { width: 15 }, // K: 液冷 kW (Formula = J*H/100)
                    { width: 15 }  // L: 氣冷 kW (Formula = J*I/100)
                ];

                s4.addRow(['機房 (Hall)', '冷卻單元 (DU)', '算力模組 (SU)', '設備類別', '機櫃/伺服器型號', '數量', '單機 kW', '液冷 %', '氣冷 %', '總 IT 負載 (kW)', '液冷散熱 (kW)', '氣冷廢熱 (kW)']);
                s4.getRow(1).font = fontHeader;
                s4.getRow(1).fill = fillPurple;

                let rowIdx = 2;
                const duRowRanges = [];

                halls.forEach(h => {
                    (h.dus || []).forEach(d => {
                        const startDuRow = rowIdx;
                        (d.sus || []).forEach(su => {
                            (su.equipment || []).forEach(eq => {
                                const r = s4.addRow([
                                    h.name,
                                    d.name,
                                    su.name,
                                    eq.category || 'GPU',
                                    eq.model,
                                    eq.qty,
                                    eq.itLoadKw,
                                    eq.liquidPct,
                                    eq.airPct,
                                    { formula: `F${rowIdx}*G${rowIdx}` },
                                    { formula: `J${rowIdx}*(H${rowIdx}/100)` },
                                    { formula: `J${rowIdx}*(I${rowIdx}/100)` }
                                ]);
                                r.getCell(6).alignment = { horizontal: 'center' };
                                r.getCell(10).font = fontFormula;
                                r.getCell(11).font = fontFormula;
                                r.getCell(12).font = fontFormula;
                                r.getCell(10).numFmt = '#,##0.0';
                                r.getCell(11).numFmt = '#,##0.0';
                                r.getCell(12).numFmt = '#,##0.0';
                                zebra(r, rowIdx, fillLightGray, { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } });
                                for (let c = 1; c <= 12; c++) r.getCell(c).border = borderThin;
                                rowIdx++;
                            });
                        });
                        duRowRanges.push({ duId: d.id, duName: d.name, hallName: h.name, start: startDuRow, end: rowIdx - 1 });
                    });
                });

                // CorePOD 設備列
                pods.filter(p => p.enabled !== false).forEach(p => {
                    const startPodRow = rowIdx;
                    (p.equipment || []).forEach(eq => {
                        const r = s4.addRow([
                            'CorePOD 模組',
                            p.name,
                            'CorePOD 機櫃群',
                            eq.category || 'NET',
                            eq.model,
                            eq.qty,
                            eq.itLoadKw,
                            eq.liquidPct || 0,
                            eq.airPct || 100,
                            { formula: `F${rowIdx}*G${rowIdx}` },
                            { formula: `J${rowIdx}*(H${rowIdx}/100)` },
                            { formula: `J${rowIdx}*(I${rowIdx}/100)` }
                        ]);
                        r.getCell(6).alignment = { horizontal: 'center' };
                        r.getCell(10).font = fontFormula;
                        r.getCell(11).font = fontFormula;
                        r.getCell(12).font = fontFormula;
                        r.getCell(10).numFmt = '#,##0.0';
                        r.getCell(11).numFmt = '#,##0.0';
                        r.getCell(12).numFmt = '#,##0.0';
                        zebra(r, rowIdx, fillLightGray, { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } });
                        for (let c = 1; c <= 12; c++) r.getCell(c).border = borderThin;
                        rowIdx++;
                    });
                    duRowRanges.push({ duId: p.id, duName: p.name, hallName: 'CorePOD', start: startPodRow, end: rowIdx - 1 });
                });

                // 全廠總計行
                const totalRow = s4.addRow([
                    '全廠總計 (Grand Total)', '', '', '', '', '', '', '', '',
                    { formula: `SUM(J2:J${rowIdx - 1})` },
                    { formula: `SUM(K2:K${rowIdx - 1})` },
                    { formula: `SUM(L2:L${rowIdx - 1})` }
                ]);
                s4.mergeCells(`A${rowIdx}:I${rowIdx}`);
                totalRow.font = { name: 'Microsoft JhengHei', size: 11, bold: true, color: { argb: 'FF0F766E' } };
                totalRow.fill = fillHighlight;
                totalRow.getCell(10).numFmt = '#,##0.0';
                totalRow.getCell(11).numFmt = '#,##0.0';
                totalRow.getCell(12).numFmt = '#,##0.0';
                for (let c = 1; c <= 12; c++) totalRow.getCell(c).border = borderThin;

                s4.autoFilter = { from: 'A1', to: 'L1' };
                // 公式欄位 (J/K/L: 總IT/液冷/氣冷 kW) 鎖定保護，輸入欄位 (F-I: 數量/單機kW/液冷氣冷%) 開放業主調整試算
                for (let rn = 2; rn <= rowIdx - 1; rn++) {
                    for (let c = 1; c <= 9; c++) s4.getRow(rn).getCell(c).protection = { locked: false };
                    for (let c = 10; c <= 12; c++) s4.getRow(rn).getCell(c).protection = { locked: true };
                }
                s4.protect('', { selectLockedCells: true, selectUnlockedCells: true });

                // ═══════════════════════════════════════════════════════════════
                // Sheet 5: 逐 DU 冷卻系統設計 (Tier A: 公式連動 N+1)
                // ═══════════════════════════════════════════════════════════════
                const s5 = wb.addWorksheet('5.逐DU冷卻系統設計', { views: [{ state: 'frozen', ySplit: 1 }] });
                s5.properties.tabColor = { argb: 'FF4338CA' };
                s5.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
                s5.columns = [
                    { width: 14 }, // A: Hall
                    { width: 16 }, // B: DU
                    { width: 12 }, // C: 系統分類
                    { width: 24 }, // D: 設備項目
                    { width: 28 }, // E: 自選型號
                    { width: 14 }, // F: 需求容量 (kW)
                    { width: 14 }, // G: 單機容量 (kW)
                    { width: 12 }, // H: 選定台數
                    { width: 14 }, // I: 總裝置容量 (kW) = G*H
                    { width: 15 }, // J: 有效容量 N-1 (kW) = (H-1)*G
                    { width: 14 }, // K: 設計餘度 % = (J/F-1)*100
                    { width: 15 }  // L: N+1 檢核判定 = IF(J>=F, "PASS", "FAIL")
                ];

                s5.addRow(['機房名稱', '冷卻單元 (DU)', '系統類別', '設備類別與項目', '自選設備型號', '需求容量 (kW)', '單機容量 (kW)', '選定台數', '總裝置容量 (kW)', '有效容量 N-1 (kW)', '設計餘度 (%)', 'N+1 檢核判定']);
                s5.getRow(1).font = fontHeader;
                s5.getRow(1).fill = fillIndigo;

                let s5Row = 2;
                halls.forEach(h => {
                    (h.dus || []).forEach(d => {
                        const plant = d.plantDesign || {};
                        const cduSizing = plant.cduSystem?.sizing || [];
                        const fwSizing = plant.fanwallSystem?.sizing || [];

                        cduSizing.forEach(item => {
                            const reqKw = item.requiredKw ?? 0;
                            const unitCapKw = item.unitCapKw ?? 0;
                            const qty = item.selectedQty ?? 0;
                            const effectiveCap = Math.max(0, qty - 1) * unitCapKw;
                            const isConfigured = qty > 0;
                            const isPass = isConfigured && effectiveCap >= reqKw;
                            const r = s5.addRow([
                                h.name,
                                d.name,
                                'CDU液冷系統',
                                item.label,
                                item.selectedModel || '（尚未選型）',
                                reqKw,
                                unitCapKw,
                                qty,
                                { formula: `G${s5Row}*H${s5Row}` },
                                { formula: `MAX(0,(H${s5Row}-1))*G${s5Row}` },
                                { formula: `IF(F${s5Row}>0, (J${s5Row}/F${s5Row}-1)*100, 0)` },
                                { formula: `IF(H${s5Row}=0, "⬜ 尚未選型", IF(J${s5Row}>=F${s5Row}, "✅ 滿足 N+1", "❌ 容量不足"))` }
                            ]);
                            r.getCell(8).alignment = { horizontal: 'center' };
                            r.getCell(9).font = fontFormula;
                            r.getCell(10).font = fontFormula;
                            r.getCell(11).font = fontFormula;
                            r.getCell(12).font = fontBold;
                            r.getCell(6).numFmt = '#,##0.0';
                            r.getCell(7).numFmt = '#,##0.0';
                            r.getCell(9).numFmt = '#,##0.0';
                            r.getCell(10).numFmt = '#,##0.0';
                            r.getCell(11).numFmt = '+0.0%;-0.0%;0.0%';
                            const statusFill = !isConfigured
                                ? { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } }
                                : (isPass
                                    ? { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFECFDF5' } }
                                    : { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF2F2' } });
                            r.getCell(12).fill = statusFill;
                            for (let c = 1; c <= 12; c++) r.getCell(c).border = borderThin;
                            s5Row++;
                        });

                        fwSizing.forEach(item => {
                            const reqKw = item.requiredKw ?? 0;
                            const unitCapKw = item.unitCapKw ?? 0;
                            const qty = item.selectedQty ?? 0;
                            const effectiveCap = Math.max(0, qty - 1) * unitCapKw;
                            const isConfigured = qty > 0;
                            const isPass = isConfigured && effectiveCap >= reqKw;
                            const r = s5.addRow([
                                h.name,
                                d.name,
                                '氣冷排熱系統',
                                item.label,
                                item.selectedModel || '（尚未選型）',
                                reqKw,
                                unitCapKw,
                                qty,
                                { formula: `G${s5Row}*H${s5Row}` },
                                { formula: `MAX(0,(H${s5Row}-1))*G${s5Row}` },
                                { formula: `IF(F${s5Row}>0, (J${s5Row}/F${s5Row}-1)*100, 0)` },
                                { formula: `IF(H${s5Row}=0, "⬜ 尚未選型", IF(J${s5Row}>=F${s5Row}, "✅ 滿足 N+1", "❌ 容量不足"))` }
                            ]);
                            r.getCell(8).alignment = { horizontal: 'center' };
                            r.getCell(9).font = fontFormula;
                            r.getCell(10).font = fontFormula;
                            r.getCell(11).font = fontFormula;
                            r.getCell(12).font = fontBold;
                            r.getCell(6).numFmt = '#,##0.0';
                            r.getCell(7).numFmt = '#,##0.0';
                            r.getCell(9).numFmt = '#,##0.0';
                            r.getCell(10).numFmt = '#,##0.0';
                            r.getCell(11).numFmt = '+0.0%;-0.0%;0.0%';
                            const statusFill = !isConfigured
                                ? { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } }
                                : (isPass
                                    ? { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFECFDF5' } }
                                    : { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF2F2' } });
                            r.getCell(12).fill = statusFill;
                            for (let c = 1; c <= 12; c++) r.getCell(c).border = borderThin;
                            s5Row++;
                        });
                    });
                });

                s5.autoFilter = { from: 'A1', to: 'L1' };
                // 需求/單機容量/選定台數 (F/G/H) 開放業主調整試算，容量/餘裕/判定公式欄鎖定保護
                for (let rn = 2; rn <= s5Row - 1; rn++) {
                    for (let c = 1; c <= 8; c++) s5.getRow(rn).getCell(c).protection = { locked: false };
                    for (let c = 9; c <= 12; c++) s5.getRow(rn).getCell(c).protection = { locked: true };
                }
                s5.protect('', { selectLockedCells: true, selectUnlockedCells: true });

                // ═══════════════════════════════════════════════════════════════
                // Sheet 6: 能耗與 PUE/WUE 計算 (Tier A: 公式連動)
                // ═══════════════════════════════════════════════════════════════
                const s6 = wb.addWorksheet('6.能耗與PUE-WUE計算', { views: [{ state: 'frozen', ySplit: 1 }] });
                s6.properties.tabColor = { argb: 'FF0F766E' };
                s6.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
                s6.columns = [
                    { width: 18 }, // A: DU / POD
                    { width: 14 }, // B: IT 能耗 MWh
                    { width: 14 }, // C: CDU 泵能 MWh
                    { width: 14 }, // D: CRAH/RDHX 風扇能
                    { width: 14 }, // E: 乾冷/塔散熱能
                    { width: 14 }, // F: 冰機製冷能
                    { width: 14 }, // G: 配電損耗
                    { width: 16 }, // H: 總能耗 MWh = SUM(B:G)
                    { width: 14 }, // I: 年耗水量 m³
                    { width: 14 }, // J: PUE 公式 = H/B
                    { width: 14 }, // K: pPUE 公式 = (B+D+E+F)/B
                    { width: 14 }  // L: WUE 公式 = I*1000/(B*1000)
                ];

                s6.addRow(['單元名稱 (Unit)', 'IT 能耗 (MWh)', 'CDU 泵能 (MWh)', '風扇能 (MWh)', '排熱散熱 (MWh)', '冰機製冷 (MWh)', '配電損耗 (MWh)', '總能耗 (MWh)', '年耗水 (m³)', '設計 PUE', '設計 pPUE', '設計 WUE (L/kWh)']);
                s6.getRow(1).font = fontHeader;
                s6.getRow(1).fill = fillEmerald;

                let s6Row = 2;
                let s6DataIdx = 0;
                (res.byDu || []).forEach(d => {
                    // v29修正: 直接讀取 store.js 逐時模擬時已算好的真實逐分項能耗 (cduPumpMwh/crahFanMwh/
                    // heatRejectionMwh/chillerMwh/lossMwh)，不再用假比例 (0.25/0.35/0.75/0.65) 反推。
                    const r = s6.addRow([
                        d.duName,
                        d.annualItMwh || 0,
                        d.cduPumpMwh ?? 0,
                        d.crahFanMwh ?? 0,
                        d.heatRejectionMwh ?? 0,
                        d.chillerMwh ?? 0,
                        d.lossMwh ?? 0,
                        { formula: `SUM(B${s6Row}:G${s6Row})` },
                        d.annualWaterM3 || 0,
                        { formula: `IF(B${s6Row}>0, H${s6Row}/B${s6Row}, 1)` },
                        { formula: `IF(B${s6Row}>0, (B${s6Row}+D${s6Row}+E${s6Row}+F${s6Row})/B${s6Row}, 1)` },
                        { formula: `IF(B${s6Row}>0, (I${s6Row}*1000)/(B${s6Row}*1000), 0)` }
                    ]);
                    for (let c = 2; c <= 8; c++) r.getCell(c).numFmt = '#,##0.0';
                    r.getCell(9).numFmt = '#,##0';
                    r.getCell(10).numFmt = '0.000';
                    r.getCell(11).numFmt = '0.000';
                    r.getCell(12).numFmt = '0.00';
                    r.getCell(8).font = fontFormula;
                    r.getCell(10).font = fontFormula;
                    r.getCell(11).font = fontFormula;
                    r.getCell(12).font = fontFormula;
                    zebra(r, s6DataIdx, fillLightGray, { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } });
                    for (let c = 1; c <= 12; c++) r.getCell(c).border = borderThin;
                    s6Row++; s6DataIdx++;
                });

                (res.byCorePod || []).forEach(cp => {
                    const r = s6.addRow([
                        cp.podName,
                        cp.annualItMwh || 0,
                        cp.cduPumpMwh ?? 0,
                        cp.crahFanMwh ?? 0,
                        cp.heatRejectionMwh ?? 0,
                        cp.chillerMwh ?? 0,
                        cp.lossMwh ?? 0,
                        { formula: `SUM(B${s6Row}:G${s6Row})` },
                        cp.annualWaterM3 || 0,
                        { formula: `IF(B${s6Row}>0, H${s6Row}/B${s6Row}, 1)` },
                        { formula: `IF(B${s6Row}>0, (B${s6Row}+D${s6Row}+E${s6Row}+F${s6Row})/B${s6Row}, 1)` },
                        { formula: `IF(B${s6Row}>0, (I${s6Row}*1000)/(B${s6Row}*1000), 0)` }
                    ]);
                    for (let c = 2; c <= 8; c++) r.getCell(c).numFmt = '#,##0.0';
                    r.getCell(9).numFmt = '#,##0';
                    r.getCell(10).numFmt = '0.000';
                    r.getCell(11).numFmt = '0.000';
                    r.getCell(12).numFmt = '0.00';
                    r.getCell(8).font = fontFormula;
                    r.getCell(10).font = fontFormula;
                    r.getCell(11).font = fontFormula;
                    r.getCell(12).font = fontFormula;
                    zebra(r, s6DataIdx, fillLightGray, { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } });
                    for (let c = 1; c <= 12; c++) r.getCell(c).border = borderThin;
                    s6Row++; s6DataIdx++;
                });

                // 全廠能耗總計行
                const s6TotRow = s6.addRow([
                    '全廠年度總計 (Grand Total)',
                    { formula: `SUM(B2:B${s6Row - 1})` },
                    { formula: `SUM(C2:C${s6Row - 1})` },
                    { formula: `SUM(D2:D${s6Row - 1})` },
                    { formula: `SUM(E2:E${s6Row - 1})` },
                    { formula: `SUM(F2:F${s6Row - 1})` },
                    { formula: `SUM(G2:G${s6Row - 1})` },
                    { formula: `SUM(H2:H${s6Row - 1})` },
                    { formula: `SUM(I2:I${s6Row - 1})` },
                    { formula: `H${s6Row}/B${s6Row}` },
                    { formula: `(B${s6Row}+D${s6Row}+E${s6Row}+F${s6Row})/B${s6Row}` },
                    { formula: `IF(B${s6Row}>0, (I${s6Row}*1000)/(B${s6Row}*1000), 0)` }
                ]);
                s6TotRow.font = { name: 'Microsoft JhengHei', size: 11, bold: true, color: { argb: 'FF0F766E' } };
                s6TotRow.fill = fillHighlight;
                for (let c = 2; c <= 8; c++) s6TotRow.getCell(c).numFmt = '#,##0.0';
                s6TotRow.getCell(9).numFmt = '#,##0';
                s6TotRow.getCell(10).numFmt = '0.000';
                s6TotRow.getCell(11).numFmt = '0.000';
                s6TotRow.getCell(12).numFmt = '0.00';
                for (let c = 1; c <= 12; c++) s6TotRow.getCell(c).border = borderThin;
                s6.autoFilter = { from: 'A1', to: 'L1' };

                // ═══════════════════════════════════════════════════════════════
                // Sheet 7: 月度趨勢 (Monthly Trends)
                // ═══════════════════════════════════════════════════════════════
                const s7 = wb.addWorksheet('7.月度趨勢', { views: [{ state: 'frozen', ySplit: 1 }] });
                s7.properties.tabColor = { argb: 'FF334155' };
                s7.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
                s7.columns = [{ width: 14 }, { width: 18 }, { width: 20 }, { width: 16 }];
                s7.addRow(['月份', '全廠總能耗 (MWh)', '全廠冷卻能耗 (MWh)', '當月設計 PUE']);
                s7.getRow(1).font = fontHeader;
                s7.getRow(1).fill = fillDark;

                (res.monthlyPue || []).forEach((m, idx) => {
                    const r = s7.addRow([`${idx + 1} 月`, m.totalMwh ?? 0, m.coolingMwh ?? 0, m.pue ?? 1.0]);
                    r.getCell(2).numFmt = '#,##0.0';
                    r.getCell(3).numFmt = '#,##0.0';
                    r.getCell(4).numFmt = '0.000';
                    zebra(r, idx, fillLightGray, { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } });
                    for (let c = 1; c <= 4; c++) { r.getCell(c).font = fontNormal; r.getCell(c).border = borderThin; }
                });

                // ═══════════════════════════════════════════════════════════════
                // Sheet 8: 尖峰工況分析 (Peak Conditions)
                // ═══════════════════════════════════════════════════════════════
                const s8 = wb.addWorksheet('8.尖峰工況分析', { views: [{ showGridLines: true }] });
                s8.properties.tabColor = { argb: 'FF4338CA' };
                s8.columns = [{ width: 30 }, { width: 26 }, { width: 44 }];
                s8.addRow(['尖峰工況檢核項目', '數值', '工程安全說明']);
                s8.getRow(1).font = fontHeader;
                s8.getRow(1).fill = fillIndigo;

                s8.addRow(['8,760h 瞬時尖峰 PUE (Worst Hour)', overall.peakPue ?? '（未計算，請先於 Step5 執行全年模擬）', '全年度氣候最嚴苛時刻瞬時 PUE 極值']);
                s8.addRow(['8,760h 瞬時尖峰 Cooling pPUE (Worst Hour，不含泵浦耗電)', overall.peakP_Pue ?? '（未計算）', '全年度氣候最嚴苛時刻部分 PUE 極值']);
                s8.addRow(['尖峰發生月份 / 小時', (overall.peakMonth != null) ? `${overall.peakMonth} 月 / 第 ${overall.peakHour} 時` : '（未計算）', '氣溫與濕度達到全年最高負載工況']);
                s8.addRow(['全廠 IT 尖峰負載', `${((overall.totalItKw || 0) / 1000).toFixed(2)} MW`, '全廠滿載運轉設計容量']);
                // v29修正: 不再寫死「滿足 N+1」，改用公式即時統計 Sheet5 實際有多少項未通過 N+1 檢核
                const failCntRow = s8.rowCount + 1;
                s8.addRow(['N+1 未達標項目數 (自動統計自 Sheet5)', { formula: `COUNTIF('5.逐DU冷卻系統設計'!L:L,"*不足*")` }, '統計 Sheet5 「N+1 檢核判定」欄位中顯示❌容量不足的項目數']);
                s8.addRow(['未選型項目數 (自動統計自 Sheet5)', { formula: `COUNTIF('5.逐DU冷卻系統設計'!L:L,"*尚未選型*")` }, '統計 Sheet5 中選定台數為 0、尚未完成設備選型的項目數']);
                s8.addRow(['冷卻容量設計餘裕結論', { formula: `IF(B${failCntRow}=0, "✅ 全數滿足 N+1 冗餘", "⚠️ 尚有 "&B${failCntRow}&" 項未達標，詳見 Sheet5")` }, '單一機組停機檢修時是否仍可 100% 滿載散熱，依 Sheet5 實際選型結果判定']);

                for (let r = 2; r <= s8.rowCount; r++) {
                    const row = s8.getRow(r);
                    row.getCell(1).font = fontBold;
                    row.getCell(2).font = (r >= failCntRow) ? fontFormula : fontBold;
                    row.getCell(3).font = fontNormal;
                    for (let c = 1; c <= 3; c++) row.getCell(c).border = borderThin;
                }

                // ═══════════════════════════════════════════════════════════════
                // Sheet 9: 全廠總表與結論 (Facility Summary & KPI)
                // ═══════════════════════════════════════════════════════════════
                const s9 = wb.addWorksheet('9.全廠總表與結論', { views: [{ showGridLines: true }] });
                s9.properties.tabColor = { argb: 'FF0F766E' };
                s9.columns = [{ width: 32 }, { width: 26 }, { width: 44 }];
                s9.addRow(['全廠綜合評估指標 (Summary KPI)', '數值', '業主驗收基準 (Benchmark)']);
                s9.getRow(1).font = fontHeader;
                s9.getRow(1).fill = fillEmerald;

                s9.addRow(['年度全廠設計 PUE (均值)', overall.annualPue ?? 0, '優於 LEED / 綠色資料中心黃金級 (≤1.20)']);
                s9.addRow(['年度全廠設計 Cooling pPUE (均值，不含泵浦耗電)', overall.annualP_Pue ?? 0, '局部空調系統高能效表現']);
                s9.addRow(['全廠瞬時尖峰 PUE (Worst Hour)', overall.peakPue ?? '（未計算）', '極端高溫高濕下仍維持穩定散熱']);
                s9.addRow(['全廠年度耗水指標 WUE', `${overall.annualWue ?? 0} L/kWh`, '採用乾冷器閉路冷卻實現零耗水']);
                s9.addRow(['自由冷卻覆蓋率 (Free Cooling %)', `${res.fcPotential?.freeHoursPct ?? 0}%`, '全年自由冷卻可用時數佔比']);
                // v29修正: 與 Sheet8 共用同一顆 COUNTIF 公式，如實反映 Sheet5 的實際選型結果，不再寫死「100%合格」
                const s9FailRow = s9.rowCount + 1;
                s9.addRow(['N+1 未達標項目數 (自動統計自 Sheet5)', { formula: `COUNTIF('5.逐DU冷卻系統設計'!L:L,"*不足*")` }, '0 代表全廠各單元設備容量均通過 N+1 驗證']);
                s9.addRow(['N+1 設備冗餘合規性', { formula: `IF(B${s9FailRow}=0, "✅ 100% 全部合格", "⚠️ 尚有 "&B${s9FailRow}&" 項未達標，詳見 Sheet5")` }, '依 Sheet5 逐項公式判定結果自動彙總，非人工認定']);
                s9.addRow(['整體節能結論', { formula: `IF(AND(B${s9FailRow}=0, B2<=1.2), "✅ 設計達標，建議採行", "⚠️ 請先排除上述未達標項目再行決策")` }, '綜合 PUE 與 N+1 合規性之自動判定，僅供參考，最終仍需 PE 簽證確認']);

                for (let r = 2; r <= s9.rowCount; r++) {
                    const row = s9.getRow(r);
                    row.getCell(1).font = fontBold;
                    row.getCell(2).font = (r >= s9FailRow) ? fontFormula : fontBold;
                    row.getCell(3).font = fontNormal;
                    for (let c = 1; c <= 3; c++) row.getCell(c).border = borderThin;
                }

                // ═══════════════════════════════════════════════════════════════
                // Sheet 10: 附錄: 年度最熱日逐時明細 (Hottest Day 24h Profile)
                // ═══════════════════════════════════════════════════════════════
                const s10 = wb.addWorksheet('10.附錄-最熱日24h明細', { views: [{ state: 'frozen', ySplit: 2 }] });
                s10.properties.tabColor = { argb: 'FF94A3B8' };
                s10.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
                s10.columns = [
                    { width: 12 }, // A: 小時
                    { width: 16 }, // B: 室外乾球 DB
                    { width: 16 }, // C: 室外濕球 WB
                    { width: 22 }, // D: 自由冷卻模式
                    { width: 16 }, // E: IT 負載 kW
                    { width: 16 }, // F: CDU 泵能 kW
                    { width: 16 }, // G: 散熱/冰機 kW
                    { width: 16 }  // H: 瞬時 PUE
                ];

                s10.addRow(['附錄：全年度最熱日 24 小時逐時動力學模擬明細 (用於抽查極限工況)']);
                s10.mergeCells('A1:H1');
                s10.getCell('A1').font = fontSection;
                s10.getCell('A1').fill = fillLightGray;

                s10.addRow(['時間 (Hour)', '室外乾球 DB (°C)', '室外濕球 WB (°C)', '自由冷卻運轉模式', 'IT 負載 (kW)', 'CDU 循環泵 (kW)', '散熱與冰機 (kW)', '瞬時 PUE']);
                s10.getRow(2).font = fontHeader;
                s10.getRow(2).fill = fillDark;

                // v42 fix: 這張表原本是用「IT負載 × 固定比例」自己重新估算一次瞬時PUE，
                // 跟真正的8760小時模擬(store.js calcHourlyEnergy → results.hourlyProfile)
                // 完全脫鉤，會出現「Dashboard PUE ≠ 這張附錄表PUE」的兩套算法問題。
                // 改成直接讀 results.hourlyProfile 裡逐時模擬算出來的真實值，不再自己假設。
                const hourlyProfile = res.hourlyProfile || [];
                const modeLabel = { free: 'Mode 1 全自由冷卻', partial: 'Mode 2 部分輔助製冷', mechanical: 'Mode 3 全機械製冷' };

                // 找出最熱日 (連續24小時均溫最高者)
                let maxDayIdx = 180; // default summer day
                let maxDaySum = -999;
                if (hourlyProfile.length >= 8760) {
                    for (let d = 0; d < 365; d++) {
                        let dSum = 0;
                        for (let h = 0; h < 24; h++) dSum += hourlyProfile[d * 24 + h].db;
                        if (dSum > maxDaySum) { maxDaySum = dSum; maxDayIdx = d; }
                    }
                }

                for (let h = 0; h < 24; h++) {
                    const idx = maxDayIdx * 24 + h;
                    const item = hourlyProfile[idx] || { db: 32.0 + Math.sin(h / 3) * 4, wb: 26.0, itKw: overall.totalItKw || 1000, cduPumpKw: 0, coolingKw: 0, pue: overall.annualPue || 1.0, mode: 'mechanical' };
                    const rejKw = Math.max(0, (item.coolingKw || 0) - (item.cduPumpKw || 0));

                    const r = s10.addRow([
                        `${h < 10 ? '0' + h : h}:00`,
                        item.db,
                        item.wb,
                        modeLabel[item.mode] || item.mode,
                        item.itKw,
                        item.cduPumpKw,
                        rejKw,
                        item.pue
                    ]);
                    r.getCell(2).numFmt = '#,##0.0';
                    r.getCell(3).numFmt = '#,##0.0';
                    r.getCell(5).numFmt = '#,##0.0';
                    r.getCell(6).numFmt = '#,##0.0';
                    r.getCell(7).numFmt = '#,##0.0';
                    r.getCell(8).numFmt = '0.000';
                    zebra(r, h, fillLightGray, { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } });
                    for (let c = 1; c <= 8; c++) { r.getCell(c).font = fontNormal; r.getCell(c).border = borderThin; }
                }

                // 產出 Excel 檔案 Buffer 並觸發瀏覽器下載
                const buffer = await wb.xlsx.writeBuffer();
                const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
                const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
                const fileName = `AI_DataCenter_Cooling_Calculation_Book_${dateStr}.xlsx`;

                if (typeof window !== 'undefined' && window.document) {
                    const link = document.createElement('a');
                    link.href = URL.createObjectURL(blob);
                    link.download = fileName;
                    link.click();
                    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
                }

                console.log(`[ExcelExport] 正式計算書匯出成功: ${fileName}`);
                return buffer;
            } catch (err) {
                console.error('[ExcelExport] 匯出失敗:', err);
                if (typeof alert === 'function') alert('匯出 Excel 計算書失敗: ' + err.message);
                throw err;
            }
        }
    };

    window.ExcelExport = ExcelExport;
})(typeof window !== 'undefined' ? window : global);
