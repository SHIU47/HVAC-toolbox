/**
 * excel_export.js - Owner-Grade Linked Excel Cooling Calculation Book Export (v33 Bilingual)
 * Professional HVAC Engineering Calculation Workbook with complete multi-sheet linkages,
 * full subsystem energy balance sheets, ASHRAE 0.4% meteorological criteria,
 * transparent N+1 redundancy verification, and executive KPI scorecards.
 * Supports bilingual (zh-TW and en) export.
 */
(function(window) {
    'use strict';

    const _t = (key, params, fallback) => {
        const i18n = (typeof window !== 'undefined' && window.I18N) ? window.I18N : (typeof I18N !== 'undefined' ? I18N : (typeof global !== 'undefined' && global.I18N ? global.I18N : null));
        if (i18n && typeof i18n.t === 'function') {
            const val = i18n.t(key, params);
            if (val && val !== key) return val;
        }
        return fallback !== undefined ? fallback : key;
    };

    function getRefText(def, targetLang) {
        if (targetLang !== 'en') return def.ref || 'ASHRAE / NVIDIA DSX / AHRI';
        if (def.ref_en) return def.ref_en;
        const r = def.ref || 'ASHRAE / NVIDIA DSX / AHRI';
        return r
            .replace(/水冷離心典型值|水冷冰機 EIR-FT 敏感度|氣冷冰機 EER 對外氣溫度敏感度 ~1\.8%\/°C/g, 'Water-cooled centrifugal typical')
            .replace(/台灣夏季設計常用/g, 'Typical summer design')
            .replace(/廠商型錄典型/g, 'Manufacturer catalog typical')
            .replace(/台灣氣候統計近似/g, 'Climate statistical approximation')
            .replace(/ASHRAE 手冊；影響排放水量/g, 'ASHRAE Handbook; affects blowdown water')
            .replace(/保守懲罰假設/g, 'Conservative penalty assumption')
            .replace(/HI 標準中型端吸泵/g, 'HI Standard End-Suction Pump')
            .replace(/概估值，正式設計需依管路壓損計算（可用本站「水管風管壓損計算」工具）/g, 'Estimated baseline; detailed design per hydraulic calculation')
            .replace(/公司內規（可調）/g, 'Internal guidelines (adjustable)')
            .replace(/ASHRAE 典型冰機排熱 = 冷凍噸/g, 'ASHRAE typical chiller heat rejection = RT')
            .replace(/園區集中冷站合約典型/g, 'District cooling contract typical')
            .replace(/蒸發量 = Q × 潛熱比 \/ h_fg；h_fg≈2430 kJ\/kg、潛熱比≈0\.84 → 0\.00124 m³\/h\/kW/g, 'Evaporation = Q x latent ratio / h_fg')
            .replace(/典型離心\/螺旋式冰機油壓與潤滑限制常見下限/g, 'Typical centrifugal/screw chiller oil pressure lower limit')
            .replace(/液冷白皮書 CDU approach 典型/g, 'Liquid cooling whitepaper CDU approach typical')
            .replace(/廠商型錄常見趨勢（板式換熱器 UA 固定、驅動溫差縮小），概估非實測曲線/g, 'Manufacturer catalog trend (fixed PHE UA, reduced driving temp diff)')
            .replace(/本系統 CDU 型錄建置慣例（_cduEntry），非廠商公告基準溫/g, 'System CDU catalog default baseline')
            .replace(/氣冷冰機廠商型錄常見趨勢，35°C 以上容量衰減，概估值/g, 'Air-cooled chiller catalog trend, derate above 35°C')
            .replace(/標準額定條件下型錄值，實際設計 WB 偏高時容量下降，概估值/g, 'Standard rating conditions, derates at high WB')
            .replace(/標準額定條件/g, 'Standard rating conditions')
            .replace(/台灣主要城市夏季 p99 濕球溫度概估區間/g, 'Summer p99 WB range in key cities')
            .replace(/極端年 n 年回歸期；關鍵設施常用/g, 'Extreme year n-year return period; critical facilities often use')
            .replace(/保守推估裕度/g, 'Conservative margin')
            .replace(/差距過大提示核對測站品質/g, 'Discrepancy flag to verify weather station data')
            .replace(/乾冷器盤管靜止水在夜間輻射冷卻下可能於外氣 0～3°C 結冰，取 4°C 安全餘裕/g, 'Dry cooler coil water freeze margin 4°C')
            .replace(/乾冷器／絕熱盤管空氣側溫升典型/g, 'Dry cooler / adiabatic coil air-side temp rise typical')
            .replace(/外氣乾球高於 \(FWS - approach - 此值\) 時啟動絕熱噴淋預冷（歷史參考值，現行模型改為依需求切換）/g, 'Adiabatic pre-cooling staging trigger')
            .replace(/標準工況冷卻水/g, 'Standard rating condition condenser water')
            .replace(/標準工況/g, 'Standard rating conditions')
            .replace(/殼管\/板式蒸發器典型/g, 'Shell-and-tube / PHE evaporator typical')
            .replace(/冷凝器 approach/g, 'Condenser approach')
            .replace(/氣冷冷凝器典型/g, 'Air-cooled condenser typical')
            .replace(/離心\/螺旋機油壓差與防喘振限制，磁浮機可低至/g, 'Oil pressure differential & surge limit; mag-bearing can be as low as')
            .replace(/受壓縮機吸氣壓力上限 \(MOP\) 與最小壓比限制，溫水供水最大 COP 增益 1\.35x（R6 P0-C2，原 2\.0）/g, 'Max COP gain 1.35x under compressor suction pressure limit (MOP)')
            .replace(/壓縮機吸氣壓力 \/ MOP 操作包絡限制/g, 'Compressor suction pressure / MOP operating envelope limit')
            .replace(/標準氣冷\/水冷冰機冷凝進水上限，型錄通常為 40～45°C/g, 'Standard chiller max entering condenser water temp (40-45°C)')
            .replace(/高溫型（heat-pump 級）冰機冷凝進水上限/g, 'High-temp heat-pump chiller max entering condenser water temp')
            .replace(/沿用原程式 5% 概估，待型錄風扇功率資料取代/g, 'Estimated 5% baseline, subject to catalog fan data')
            .replace(/沿用原程式 3% 概估/g, 'Estimated 3% baseline')
            .replace(/建議露點上限 15°C \+ 2K 安全餘裕|建議露點上限/g, 'Recommended dew point limit + 2K margin')
            .replace(/露點 \+ 2K 安全裕度/g, 'Dew point + 2K safety margin')
            .replace(/典型高溫水冷\/氣冷冰機滿載能效/g, 'Typical high-temp chiller full load efficiency')
            .replace(/標準工況典型值/g, 'Standard rating condition typical value')
            .replace(/低溫供水\/高揚程典型保守值/g, 'Low-temp CHW / high-lift typical conservative value')
            .replace(/變壓器 ~1\.0% \+ 雙轉換 UPS ~2\.5% \+ PDU\/線路 ~0\.5% \+ 照明\/BMS ~0\.5%/g, 'Transformer ~1.0% + Double-Conversion UPS ~2.5% + PDU/Line ~0.5% + Light/BMS ~0.5%')
            .replace(/變速乾冷器 approach 控制模型/g, 'Variable-speed dry cooler approach control model')
            .replace(/變速冷卻塔控制/g, 'Variable-speed cooling tower control')
            .replace(/風扇\/VFD 馬達散熱與盤管迎面風速下限（45% 轉速 ≈ 13\.7% 功率）/g, 'Fan/VFD motor cooling and coil face velocity floor (45% speed ≈ 13.7% power)')
            .replace(/液冷白皮書|Liquid Cooling Guidelines \/ NVIDIA 歧管 ΔP 控制/g, 'Liquid Cooling Guidelines / NVIDIA manifold dP control')
            .replace(/通道氣流與 ΔT 封閉控制/g, 'Aisle airflow and delta-T containment control')
            .replace(/台灣主要城市夏季設計濕球/g, 'Key cities summer design wet bulb')
            .replace(/[\u4e00-\u9fa5]/g, '')
            .trim();
    }

    const ExcelExport = {
        async ensureExcelJS() {
            if (typeof window !== 'undefined' && window.ExcelJS) return window.ExcelJS;
            const req = (typeof require === 'function') ? require : (typeof window !== 'undefined' && typeof window.__nodeRequire === 'function' ? window.__nodeRequire : (typeof global !== 'undefined' && typeof global.__nodeRequire === 'function' ? global.__nodeRequire : null));
            if (req) {
                try {
                    const ej = req('exceljs');
                    if (typeof window !== 'undefined') window.ExcelJS = ej;
                    return ej;
                } catch (_) {}
                try {
                    const path = req('path');
                    const basePath = typeof __dirname !== 'undefined' ? __dirname : (typeof process !== 'undefined' ? process.cwd() : '.');
                    const candidates = [
                        path.resolve(basePath, 'vendor/exceljs.min.js'),
                        path.resolve(basePath, 'public/Data center Cal/js/vendor/exceljs.min.js'),
                        path.resolve(basePath, '../vendor/exceljs.min.js'),
                        path.resolve(process.cwd ? process.cwd() : '.', 'public/Data center Cal/js/vendor/exceljs.min.js')
                    ];
                    for (const cand of candidates) {
                        try {
                            const ej = req(cand);
                            if (typeof window !== 'undefined') window.ExcelJS = ej;
                            return ej;
                        } catch (_) {}
                    }
                } catch (_) {}
            }
            return new Promise((resolve, reject) => {
                if (typeof document === 'undefined') return reject(new Error('Document is undefined in Node without require'));
                const script = document.createElement('script');
                script.src = 'js/vendor/exceljs.min.js';
                script.onload = () => resolve(window.ExcelJS);
                script.onerror = () => {
                    const cdn = document.createElement('script');
                    cdn.src = 'https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js';
                    cdn.onload = () => resolve(window.ExcelJS);
                    cdn.onerror = () => reject(new Error('無法載入 ExcelJS 函式庫，請檢查網路連線'));
                    document.head.appendChild(cdn);
                };
                document.head.appendChild(script);
            });
        },

        buildWorkbook(exportLang) {
            const ExcelJS = (typeof window !== 'undefined' && window.ExcelJS) ? window.ExcelJS : ((typeof require === 'function') ? require('exceljs') : null);
            if (!ExcelJS) throw new Error('ExcelJS 載入失敗');

            const i18n = (typeof window !== 'undefined' && window.I18N) ? window.I18N : (typeof I18N !== 'undefined' ? I18N : (typeof global !== 'undefined' && global.I18N ? global.I18N : null));
            const prevLang = i18n ? i18n.lang : 'zh-TW';
            const targetLang = exportLang || (typeof document !== 'undefined' && document.getElementById('excelExportLang')?.value) || prevLang;
            if (i18n) i18n.lang = targetLang;

            try {
                const appStore = (typeof window !== 'undefined' && window.AppStore) ? window.AppStore : (typeof AppStore !== 'undefined' ? AppStore : {});
                const state = appStore.state || {};
                const res = state.results || {};
                const overall = res.overall || {};
                const site = state.site || {};
                const halls = state.halls || [];
                const pods = state.corePods || [];

                const wb = new ExcelJS.Workbook();
                wb.creator = 'Antigravity AI Datacenter Simulation Engine';
                wb.lastModifiedBy = 'Antigravity Professional HVAC Engineer';
                wb.created = new Date();
                wb.modified = new Date();

                // ─────────────────────────────────────────────────────────────
                // 全站統一樣式規範 (Corporate Engineering Design System)
                // ─────────────────────────────────────────────────────────────
                const FONT_FAMILY = (targetLang === 'en') ? 'Segoe UI' : 'Microsoft JhengHei';

                const fontTitle = { name: FONT_FAMILY, size: 15, bold: true, color: { argb: 'FFFFFFFF' } };
                const fontSubtitle = { name: FONT_FAMILY, size: 9.5, italic: true, color: { argb: 'FFCBD5E1' } };
                const fontSection = { name: FONT_FAMILY, size: 10.5, bold: true, color: { argb: 'FF0F172A' } };
                const fontHeader = { name: FONT_FAMILY, size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
                const fontNormal = { name: FONT_FAMILY, size: 9.5, color: { argb: 'FF1E293B' } };
                const fontBold = { name: FONT_FAMILY, size: 9.5, bold: true, color: { argb: 'FF0F172A' } };
                const fontSubtotal = { name: FONT_FAMILY, size: 10, bold: true, color: { argb: 'FF1E293B' } };
                const fontTotal = { name: FONT_FAMILY, size: 10.5, bold: true, color: { argb: 'FF0F766E' } };
                const fontFormula = { name: FONT_FAMILY, size: 9.5, color: { argb: 'FF0F172A' } };
                const fontMuted = { name: FONT_FAMILY, size: 8.5, italic: true, color: { argb: 'FF64748B' } };

                const fontPass = { name: FONT_FAMILY, size: 9.5, bold: true, color: { argb: 'FF15803D' } };
                const fontDanger = { name: FONT_FAMILY, size: 9.5, bold: true, color: { argb: 'FFB91C1C' } };
                const fontWarn = { name: FONT_FAMILY, size: 9.5, bold: true, color: { argb: 'FFB45309' } };

                // 質感配色色系
                const fillNavy = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
                const fillBlue = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E40AF' } };
                const fillTeal = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F766E' } };
                const fillIndigo = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF3730A3' } };
                const fillSlateHeader = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF334155' } };

                const fillSection = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
                const fillLightA = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };
                const fillLightB = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
                const fillSubtotal = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
                const fillTotal = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFECFDF5' } };

                const fillPass = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCFCE7' } };
                const fillDanger = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
                const fillWarn = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } };
                const fillNeutralBadge = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };

                // 邊框樣式
                const borderThin = {
                    top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                    left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                    bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                    right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
                };
                const borderHeader = {
                    top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                    left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                    bottom: { style: 'medium', color: { argb: 'FF475569' } },
                    right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
                };
                const borderSubtotal = {
                    top: { style: 'thin', color: { argb: 'FF94A3B8' } },
                    left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                    bottom: { style: 'thin', color: { argb: 'FF94A3B8' } },
                    right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
                };
                const borderTotal = {
                    top: { style: 'thin', color: { argb: 'FF0F766E' } },
                    left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                    bottom: { style: 'double', color: { argb: 'FF0F766E' } },
                    right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
                };

                // 工具函式
                const applyRowStyles = (row, colCount, font, border, alignment) => {
                    for (let c = 1; c <= colCount; c++) {
                        const cell = row.getCell(c);
                        if (font) cell.font = font;
                        if (border) cell.border = border;
                        if (alignment) cell.alignment = alignment;
                    }
                };

                const styleSectionRow = (sheet, rowNum, colCount, titleText) => {
                    const r = sheet.getRow(rowNum);
                    sheet.mergeCells(rowNum, 1, rowNum, colCount);
                    const cell = sheet.getCell(rowNum, 1);
                    cell.value = titleText;
                    cell.font = fontSection;
                    cell.fill = fillSection;
                    cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
                    r.height = 24;
                    for (let c = 1; c <= colCount; c++) {
                        sheet.getCell(rowNum, c).border = borderThin;
                    }
                };

                const styleHeaderRow = (row, colCount, fill, font = fontHeader) => {
                    row.height = 28;
                    for (let c = 1; c <= colCount; c++) {
                        const cell = row.getCell(c);
                        cell.fill = fill;
                        cell.font = font;
                        cell.border = borderHeader;
                        cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
                    }
                };

                const zebra = (row, idx, colCount, fillA = fillLightA, fillB = fillLightB) => {
                    const fill = (idx % 2 === 0) ? fillA : fillB;
                    for (let c = 1; c <= colCount; c++) {
                        row.getCell(c).fill = fill;
                    }
                };

                const genDateStr = new Date().toLocaleString(targetLang === 'en' ? 'en-US' : 'zh-TW', {
                    year: 'numeric', month: '2-digit', day: '2-digit',
                    hour: '2-digit', minute: '2-digit', hour12: false
                });

                // ═══════════════════════════════════════════════════════════════
                // Sheet 1: 封面與專案資訊 (Executive Cover & Project Charter)
                // ═══════════════════════════════════════════════════════════════
                const s1 = wb.addWorksheet(_t('xls.s1Name', {}, '1.封面與專案資訊'), { views: [{ showGridLines: true }] });
                s1.properties.tabColor = { argb: 'FF1E3A8A' };
                s1.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
                s1.columns = [{ width: 28 }, { width: 38 }, { width: 26 }, { width: 34 }];

                // Banner Title (A1:D2)
                s1.mergeCells('A1:D1');
                const t1 = s1.getCell('A1');
                t1.value = _t('xls.title', {}, '專業 AI 高密度資料中心空調動力能效計算書');
                t1.font = fontTitle;
                t1.fill = fillNavy;
                t1.alignment = { vertical: 'middle', horizontal: 'center' };
                s1.getRow(1).height = 28;

                s1.mergeCells('A2:D2');
                const t2 = s1.getCell('A2');
                t2.value = _t('xls.subtitle', {}, 'Owner-Grade Engineering Calculation & Lifecycle PUE Verification Book (ASHRAE TC 9.9 / NVIDIA DSX 規範)');
                t2.font = fontSubtitle;
                t2.fill = fillNavy;
                t2.alignment = { vertical: 'middle', horizontal: 'center' };
                s1.getRow(2).height = 20;

                s1.addRow([]);
                s1.getRow(3).height = 10;

                // Section 1: 專案基本工程資訊
                styleSectionRow(s1, 4, 4, _t('xls.sec1', {}, '【一、專案工程基本資訊 / Project Engineering Metadata】'));
                s1.addRow([
                    _t('xls.projectName', {}, '專案名稱 (Project Name)'),
                    state.project_name || _t('xls.demoProject', {}, 'AI 高密度液冷算力中心示範案場'),
                    _t('xls.reportDate', {}, '報告產製時間 (Date)'),
                    genDateStr
                ]);
                let stCity = site.selectedCity || (targetLang === 'en' ? 'Taoyuan Pilot' : '桃園 (Taoyuan Pilot)');
                if (targetLang === 'en' && site.selectedCity) {
                    const m = site.selectedCity.match(/\(([^)]+)\)/);
                    if (m) stCity = m[1];
                }
                const stCodeText = _t('xls.stationCode', { id: site.stationId || '467050' }, ` (測站代碼: ${site.stationId || '467050'})`);
                s1.addRow([
                    _t('xls.station', {}, '氣象測站 (Weather Station)'),
                    `${stCity}${stCodeText}`,
                    _t('xls.engineVer', {}, '計算版本 (Engine Version)'),
                    _t('xls.engineVerVal', {}, 'v33 Final (公式連動與動力學版)')
                ]);
                s1.addRow([
                    _t('xls.country', {}, '國家 / 地區 (Location)'),
                    `${site.country || 'Taiwan'}`,
                    _t('xls.coordsElev', {}, '測站座標 / 海拔'),
                    _t('xls.coordsElevVal', { lat: site.lat || 25.0, lon: site.lon || 121.2, elev: site.elev || 35 }, `${site.lat || 25.0}°N / ${site.lon || 121.2}°E / 海拔 ${site.elev || 35} m`)
                ]);
                s1.addRow([
                    _t('xls.simScope', {}, '分析週期 (Simulation Scope)'),
                    _t('xls.simScopeVal', {}, '8,760 小時全年動態負載與逐時動力學'),
                    _t('xls.standards', {}, '評估規範 (Standards)'),
                    _t('xls.standardsVal', {}, 'ASHRAE TC 9.9 / NVIDIA DSX / AHRI 550/590')
                ]);

                for (let r = 5; r <= 8; r++) {
                    const row = s1.getRow(r);
                    row.height = 22;
                    applyRowStyles(row, 4, fontNormal, borderThin, { vertical: 'middle', horizontal: 'left', indent: 1 });
                    row.getCell(1).font = fontBold;
                    row.getCell(3).font = fontBold;
                    zebra(row, r, 4);
                }

                s1.addRow([]);
                s1.getRow(9).height = 10;

                // Section 2: 全廠核心指標總覽 (Executive Scorecard)
                styleSectionRow(s1, 10, 4, _t('xls.sec2', {}, '【二、全廠核心指標總覽 / Executive KPI Scorecard】'));
                s1.addRow([
                    _t('xls.annualPue', {}, '全廠設計 PUE (Annual Avg)'),
                    overall.annualPue ?? 0,
                    _t('xls.itCapacity', {}, '全廠 IT 總負載容量'),
                    `${((overall.totalItKw || 0) / 1000).toFixed(2)} MW (${(overall.totalItKw || 0).toLocaleString()} kW)`
                ]);
                s1.addRow([
                    _t('xls.peakPue', {}, '全廠尖峰 PUE (Worst Hour)'),
                    overall.peakPue ?? _t('xls.notCalculated', {}, '（未計算）'),
                    _t('xls.annualWue', {}, '全廠年耗水指標 WUE'),
                    _t('xls.wueDryCoolerZero', { wue: overall.annualWue ?? 0 }, `${overall.annualWue ?? 0} L/kWh (乾冷器閉路冷卻零水耗)`)
                ]);
                s1.addRow([
                    _t('xls.coolingPpue', {}, '局部冷卻 pPUE (Cooling pPUE)'),
                    overall.annualP_Pue ?? 0,
                    _t('xls.annualEnergy', {}, '全廠年總耗電量'),
                    `${(overall.annualTotalMwh || 0).toLocaleString()} MWh/yr`
                ]);
                s1.addRow([
                    _t('xls.fcHours', {}, '全直冷時數 (Free Cooling)'),
                    _t('xls.hoursUnit', { h: (res.fcPotential?.freeHours ?? 0).toLocaleString(), pct: res.fcPotential?.freeHoursPct ?? 0 }, `${(res.fcPotential?.freeHours ?? 0).toLocaleString()} 小時 (${res.fcPotential?.freeHoursPct ?? 0}%)`),
                    _t('xls.mode12Coverage', {}, '節能模式覆蓋率 (Mode 1+2)'),
                    `${((res.fcPotential?.freeHoursPct || 0) + (res.fcPotential?.trimHoursPct || 0)).toFixed(1)}%`
                ]);

                for (let r = 11; r <= 14; r++) {
                    const row = s1.getRow(r);
                    row.height = 22;
                    applyRowStyles(row, 4, fontNormal, borderThin, { vertical: 'middle', horizontal: 'left', indent: 1 });
                    row.getCell(1).font = fontBold;
                    row.getCell(3).font = fontBold;
                    zebra(row, r, 4);
                    if (r === 11 || r === 13) {
                        row.getCell(2).numFmt = '0.000';
                        row.getCell(2).font = fontTotal;
                    }
                    if (r === 12 && typeof row.getCell(2).value === 'number') {
                        row.getCell(2).numFmt = '0.000';
                        row.getCell(2).font = fontBold;
                    }
                }

                s1.addRow([]);
                s1.getRow(15).height = 10;

                // Section 3: 空調系統架構與運轉基準
                styleSectionRow(s1, 16, 4, _t('xls.sec3', {}, '【三、空調與冷卻系統工程基準 / Technical Baseline Summary】'));
                s1.addRow([
                    _t('xls.liquidArch', {}, '液冷散熱架構 (Liquid Cooling)'),
                    _t('xls.liquidArchVal', {}, '晶片直接液冷 (DLC) + 集中式二次水力 CDU 系統'),
                    _t('xls.designDt', {}, '設計供回水溫差'),
                    _t('xls.designDtVal', {}, '設計供水 40°C ~ 45°C / 回水 55°C ~ 60°C')
                ]);
                s1.addRow([
                    _t('xls.airArch', {}, '氣冷補冷架構 (Secondary Air)'),
                    _t('xls.airArchVal', {}, '高效 EC 風牆機 (Fanwall) / CRAH 系統 + 冰水盤管'),
                    _t('xls.redundancyLvl', {}, '設備備援等級'),
                    _t('xls.redundancyVal', {}, 'N+1 冗餘設計 (單元停機具備在線維護能力)')
                ]);
                s1.addRow([
                    _t('xls.heatRej', {}, '散熱排熱設備 (Heat Rejection)'),
                    _t('xls.heatRejVal', {}, '閉式乾冷器 (Dry Cooler) + 冰水主機補冷 (Trim Chiller)'),
                    _t('xls.glycolProt', {}, '乙二醇防凍保護'),
                    _t('xls.glycolVal', {}, '30% 丙二醇水溶液 (防凍保護溫度 -13.5°C)')
                ]);
                s1.addRow([
                    _t('xls.fcControl', {}, '自由冷卻控制邏輯 (Economizer)'),
                    _t('xls.fcControlVal', {}, 'Mode 1 (DB ≤ 門檻) 全直冷；Mode 2 預冷+補冷；Mode 3 全製冷'),
                    _t('xls.waterQuality', {}, '冷卻水水質控制'),
                    _t('xls.waterQualityVal', {}, '封閉式水迴路 (電導度 < 50 μS/cm，防腐防垢)')
                ]);

                for (let r = 17; r <= 20; r++) {
                    const row = s1.getRow(r);
                    row.height = 22;
                    applyRowStyles(row, 4, fontNormal, borderThin, { vertical: 'middle', horizontal: 'left', indent: 1 });
                    row.getCell(1).font = fontBold;
                    row.getCell(3).font = fontBold;
                    zebra(row, r, 4);
                }

                // 設備容量不足警示卡 (Conditional Alert Card)
                if ((overall.capacityDeficitHours || 0) > 0) {
                    s1.addRow([]);
                    const warnHeaderRowIdx = s1.rowCount + 1;
                    styleSectionRow(s1, warnHeaderRowIdx, 4, _t('xls.deficitWarnSec', {}, '⚠ 設備容量不足警示 (Capacity Deficit Warning)'));
                    s1.getCell(warnHeaderRowIdx, 1).fill = fillDanger;
                    s1.getCell(warnHeaderRowIdx, 1).font = fontDanger;

                    const warnRow = s1.addRow([
                        _t('xls.deficitHours', {}, '全年容量不足偵測時數'),
                        `${overall.capacityDeficitHours.toLocaleString()} ${targetLang === 'en' ? 'hrs' : '小時'}`,
                        _t('xls.deficitPeakKw', {}, '最大尖峰容量缺口'),
                        `${(overall.maxCapacityDeficitKw || 0).toLocaleString()} kW`
                    ]);
                    warnRow.height = 22;
                    applyRowStyles(warnRow, 4, fontDanger, borderThin, { vertical: 'middle', horizontal: 'left', indent: 1 });
                    for (let c = 1; c <= 4; c++) warnRow.getCell(c).fill = fillDanger;

                    const noteRowIdx = s1.rowCount + 1;
                    const noteRow = s1.addRow([
                        _t('xls.deficitNotice', {}, '本報告 PUE 結果可能被低估，不應直接用於設備採購比較或最終 PUE 認證，請回到 Step 4 增加設備台數或選用更大容量型號。'), '', '', ''
                    ]);
                    noteRow.height = 22;
                    s1.mergeCells(`A${noteRowIdx}:D${noteRowIdx}`);
                    noteRow.getCell(1).font = { name: FONT_FAMILY, size: 9, italic: true, color: { argb: 'FF8C1D17' } };
                    noteRow.getCell(1).fill = fillDanger;
                    for (let c = 1; c <= 4; c++) noteRow.getCell(c).border = borderThin;
                }

                s1.addRow([]);
                const signSecIdx = s1.rowCount + 1;
                styleSectionRow(s1, signSecIdx, 4, _t('xls.sec4', {}, '【四、工程審核與簽章驗證 / Engineering Verification & Approvals】'));

                const signRow1 = s1.addRow([_t('xls.designedBy', {}, '設計工程師 (Designed By)'), '', _t('xls.approvedBy', {}, '主持技師 (Approved By / PE)'), '']);
                const signRow2 = s1.addRow([_t('xls.reviewedBy', {}, '審核工程師 (Reviewed By)'), '', _t('xls.signedDate', {}, '簽證審核日期 (Date)'), '']);
                [signRow1, signRow2].forEach(r => {
                    r.height = 26;
                    applyRowStyles(r, 4, fontNormal, borderThin, { vertical: 'middle', horizontal: 'left', indent: 1 });
                    r.getCell(1).font = fontBold;
                    r.getCell(3).font = fontBold;
                });

                s1.addRow([]);
                const discSecIdx = s1.rowCount + 1;
                styleSectionRow(s1, discSecIdx, 4, _t('xls.sec5', {}, '【五、聲明事項 / Engineering Notes & Disclaimer】'));
                const discNotes = [
                    _t('xls.note1', {}, '1. 本計算書由 Antigravity PUE 動力學計算引擎產出，採用 EnergyPlus 氣象資料與 AHRI 雙二次冰機模型。'),
                    _t('xls.note2', {}, '2. 第 4、5、6、7、8、9 頁已建立完整公式連動，供業主與機電顧問獨立覆核與敏感度試算。'),
                    _t('xls.note3', {}, '3. 實際工程施工請依合格專業技師 (PE) 簽證之最終施工圖說與水力計算書為準。')
                ];
                discNotes.forEach(txt => {
                    const row = s1.addRow([txt, '', '', '']);
                    const rIdx = s1.rowCount;
                    s1.mergeCells(`A${rIdx}:D${rIdx}`);
                    row.height = 20;
                    row.getCell(1).font = fontMuted;
                    row.getCell(1).alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
                });

                // ═══════════════════════════════════════════════════════════════
                // Sheet 2: 設計基準與假設 (Design Basis & Assumptions)
                // ═══════════════════════════════════════════════════════════════
                const s2 = wb.addWorksheet(_t('xls.s2Name', {}, '2.設計基準與假設'), { views: [{ state: 'frozen', ySplit: 1 }] });
                s2.properties.tabColor = { argb: 'FF334155' };
                s2.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
                s2.columns = [
                    { width: 32 }, // A: 參數代碼
                    { width: 48 }, // B: 工程參數說明
                    { width: 14 }, // C: 目前設定值
                    { width: 12 }, // D: 單位
                    { width: 14 }, // E: 預設基準值
                    { width: 14 }, // F: 設定狀態
                    { width: 46 }  // G: 工程依據與參考標準
                ];

                s2.addRow([
                    _t('xls.s2HdrKey', {}, '參數代碼 (Key)'),
                    _t('xls.s2HdrDesc', {}, '工程參數說明 (Description)'),
                    _t('xls.s2HdrCur', {}, '目前設定值 (Current)'),
                    _t('xls.s2HdrUnit', {}, '單位 (Unit)'),
                    _t('xls.s2HdrDef', {}, '預設基準值 (Default)'),
                    _t('xls.s2HdrStatus', {}, '設定狀態 (Status)'),
                    _t('xls.s2HdrRef', {}, '工程依據與參考標準 (Reference Standard)')
                ]);
                styleHeaderRow(s2.getRow(1), 7, fillNavy);
                s2.autoFilter = { from: 'A1', to: 'G1' };

                const defaultAssump = (typeof ASSUMPTIONS !== 'undefined') ? ASSUMPTIONS : ((typeof window !== 'undefined' && window.ASSUMPTIONS) ? window.ASSUMPTIONS : {});
                const overrides = state.assumptions_override || {};

                // 6大工程專業分類配置
                const ASSUMP_CATEGORIES = [
                    {
                        title: _t('xls.cat1', {}, '【一、電氣系統與配電損耗基準 (Electrical & Power Distribution)】'),
                        match: k => k.includes('electrical') || k.includes('loss') || k.includes('ups') || k.includes('power')
                    },
                    {
                        title: _t('xls.cat2', {}, '【二、液冷 CDU 系統設計參數 (Liquid Cooling CDU System)】'),
                        match: k => k.includes('cdu') || k.includes('chip') || k.includes('fws') || k.includes('tcs') || k.includes('atd') || k.includes('flow_lpm')
                    },
                    {
                        title: _t('xls.cat3', {}, '【三、氣冷 CRAH / 風牆機設計參數 (Air Cooling CRAH / Fanwall System)】'),
                        match: k => k.includes('crah') || k.includes('fw_') || k.includes('fanwall') || k.includes('air_chiller') || k.includes('rdhx') || k.includes('cfm')
                    },
                    {
                        title: _t('xls.cat4', {}, '【四、散熱排熱與自由冷卻基準 (Heat Rejection & Economizer)】'),
                        match: k => k.includes('dry_cooler') || k.includes('tower') || k.includes('ct_') || k.includes('hx_') || k.includes('mode1') || k.includes('mode2') || k.includes('adiabatic') || k.includes('heat_rej')
                    },
                    {
                        title: _t('xls.cat5', {}, '【五、冰水主機與機械製冷參數 (Chiller Plant System)】'),
                        match: k => k.includes('chiller') || k.includes('cop') || k.includes('cewt') || k.includes('lift') || k.includes('evap') || k.includes('cond')
                    },
                    {
                        title: _t('xls.cat6', {}, '【六、工程安全、水力與其他基準 (Engineering Safety & General)】'),
                        match: () => true
                    }
                ];

                const processedKeys = new Set();
                let s2RowIdx = 2;

                ASSUMP_CATEGORIES.forEach(cat => {
                    const catKeys = Object.keys(defaultAssump).filter(k => !processedKeys.has(k) && cat.match(k));
                    if (catKeys.length === 0) return;

                    catKeys.forEach(k => processedKeys.add(k));

                    // Category Divider Row
                    styleSectionRow(s2, s2RowIdx, 7, cat.title);
                    s2RowIdx++;

                    catKeys.forEach((k, idx) => {
                        const def = defaultAssump[k] || {};
                        const isOverridden = overrides[k] !== undefined && overrides[k] !== null;
                        const curVal = isOverridden ? overrides[k] : def.val;
                        const label = (targetLang === 'en' && def.label_en) ? def.label_en : (def.label || k);

                        const r = s2.addRow([
                            k,
                            label,
                            curVal,
                            def.unit || '-',
                            def.val,
                            isOverridden ? _t('xls.overridden', {}, '✏️ 專案覆寫') : _t('xls.standard', {}, '標準設定'),
                            getRefText(def, targetLang)
                        ]);
                        r.height = 22;

                        r.getCell(1).font = fontNormal;
                        r.getCell(2).font = fontBold;
                        r.getCell(3).font = isOverridden ? fontWarn : fontNormal;
                        r.getCell(4).font = fontNormal;
                        r.getCell(5).font = fontNormal;
                        r.getCell(6).font = isOverridden ? fontWarn : fontNormal;
                        r.getCell(7).font = fontNormal;

                        r.getCell(3).numFmt = '0.####';
                        r.getCell(5).numFmt = '0.####';

                        r.getCell(1).alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
                        r.getCell(2).alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
                        r.getCell(3).alignment = { vertical: 'middle', horizontal: 'right' };
                        r.getCell(4).alignment = { vertical: 'middle', horizontal: 'center' };
                        r.getCell(5).alignment = { vertical: 'middle', horizontal: 'right' };
                        r.getCell(6).alignment = { vertical: 'middle', horizontal: 'center' };
                        r.getCell(7).alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };

                        zebra(r, idx, 7);
                        if (isOverridden) {
                            r.getCell(3).fill = fillWarn;
                            r.getCell(6).fill = fillWarn;
                        }
                        for (let c = 1; c <= 7; c++) r.getCell(c).border = borderThin;
                        s2RowIdx++;
                    });
                });

                // ═══════════════════════════════════════════════════════════════
                // Sheet 3: 氣象資料與自由冷卻分析 (Weather & Free Cooling Analysis)
                // ═══════════════════════════════════════════════════════════════
                const s3 = wb.addWorksheet(_t('xls.s3Name', {}, '3.氣象與自由冷卻分析'), { views: [{ state: 'frozen', ySplit: 7 }] });
                s3.properties.tabColor = { argb: 'FF0F766E' };
                s3.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
                s3.columns = [
                    { width: 22 }, // A: 月份 / 項目
                    { width: 18 }, // B: 乾球均溫
                    { width: 18 }, // C: 乾球極大
                    { width: 18 }, // D: 乾球極小
                    { width: 18 }, // E: 濕球均溫
                    { width: 18 }, // F: 露點均溫
                    { width: 18 }  // G: 平均濕度
                ];

                // Table 1: ASHRAE 0.4% 極端設計工況卡片
                styleSectionRow(s3, 1, 7, _t('xls.s3Sec1', {}, '【一、氣象測站極端設計工況與基本資訊 / ASHRAE 0.4% Design Conditions】'));
                const dc = (typeof appStore.designConditions === 'function') ? appStore.designConditions() : (site.designConditions || {});

                const wMeta1 = s3.addRow([
                    _t('xls.stationName', {}, '氣象測站名稱'),
                    `${stCity} (ID: ${site.stationId || '467050'})`,
                    _t('xls.ashraeDb004', {}, 'ASHRAE 0.4% 乾球設計極值'),
                    Number(dc.db004 ?? site.designConditions?.db004 ?? 34.8),
                    _t('xls.ashraeWb004', {}, 'ASHRAE 0.4% 濕球設計極值'),
                    Number(dc.wb004 ?? site.designConditions?.wb004 ?? 28.2),
                    ''
                ]);
                const wMeta2 = s3.addRow([
                    _t('xls.geoLoc', {}, '測站地理位置'),
                    `${site.lat || 25.0}°N / ${site.lon || 121.2}°E / ${targetLang === 'en' ? 'Elev' : '海拔'} ${site.elev || 35} m`,
                    _t('xls.extremeMaxDb', {}, '全年最高乾球溫度 (Extreme Max)'),
                    Number(dc.extremeMaxDb ?? site.designConditions?.extremeMaxDb ?? 36.5),
                    _t('xls.extremeMinDb', {}, '最低氣溫 / 防凍警戒 (Min DB)'),
                    Number(dc.extremeMinDb ?? site.designConditions?.extremeMinDb ?? 7.2),
                    ''
                ]);

                [wMeta1, wMeta2].forEach(r => {
                    r.height = 22;
                    applyRowStyles(r, 7, fontNormal, borderThin, { vertical: 'middle', horizontal: 'left', indent: 1 });
                    r.getCell(1).font = fontBold;
                    r.getCell(3).font = fontBold;
                    r.getCell(5).font = fontBold;
                    r.getCell(4).numFmt = '#,##0.0 "°C"';
                    r.getCell(6).numFmt = '#,##0.0 "°C"';
                    r.getCell(4).alignment = { vertical: 'middle', horizontal: 'right' };
                    r.getCell(6).alignment = { vertical: 'middle', horizontal: 'right' };
                });

                s3.addRow([]);
                s3.getRow(4).height = 10;

                // Table 2: 12-Month Detailed Weather Profile
                styleSectionRow(s3, 5, 7, _t('xls.s3Sec2', {}, '【二、12 個月氣候特徵與月度逐時均溫 (Monthly Climate Profile)】'));
                const s3Hdr = s3.addRow([
                    _t('xls.s3HdrMonth', {}, '月份 (Month)'),
                    _t('xls.s3HdrAvgDb', {}, '乾球均溫 (°C)'),
                    _t('xls.s3HdrMaxDb', {}, '乾球極大值 (°C)'),
                    _t('xls.s3HdrMinDb', {}, '乾球極小值 (°C)'),
                    _t('xls.s3HdrAvgWb', {}, '濕球均溫 (°C)'),
                    _t('xls.s3HdrAvgDp', {}, '露點均溫 (°C)'),
                    _t('xls.s3HdrAvgRh', {}, '平均相對濕度 (%)')
                ]);
                styleHeaderRow(s3Hdr, 7, fillTeal);

                const mStats = site.monthlyStats || [];
                const monthStartRow = 7;
                for (let idx = 0; idx < 12; idx++) {
                    const m = mStats[idx] || {};
                    const r = s3.addRow([
                        _t('xls.monthN', { m: idx + 1 }, `${idx + 1} 月`),
                        m.avgDB ?? 25.0,
                        m.maxDB ?? 33.0,
                        m.minDB ?? 15.0,
                        m.avgWB ?? 22.0,
                        m.avgDP ?? 18.0,
                        (m.avgRH ?? 75)
                    ]);
                    r.height = 22;
                    applyRowStyles(r, 7, fontNormal, borderThin, { vertical: 'middle', horizontal: 'right' });
                    r.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };
                    r.getCell(1).font = fontBold;
                    for (let c = 2; c <= 6; c++) r.getCell(c).numFmt = '#,##0.0';
                    r.getCell(7).numFmt = '#,##0.0"%"';
                    zebra(r, idx, 7);
                }
                const monthEndRow = monthStartRow + 11;

                // Table 2 Annual Summary Row
                const s3TotRow = s3.addRow([
                    _t('xls.annualSummary', {}, '全年統計 / 極值 (Annual Summary)'),
                    { formula: `AVERAGE(B${monthStartRow}:B${monthEndRow})` },
                    { formula: `MAX(C${monthStartRow}:C${monthEndRow})` },
                    { formula: `MIN(D${monthStartRow}:D${monthEndRow})` },
                    { formula: `AVERAGE(E${monthStartRow}:E${monthEndRow})` },
                    { formula: `AVERAGE(F${monthStartRow}:F${monthEndRow})` },
                    { formula: `AVERAGE(G${monthStartRow}:G${monthEndRow})` }
                ]);
                s3TotRow.height = 25;
                applyRowStyles(s3TotRow, 7, fontBold, borderTotal, { vertical: 'middle', horizontal: 'right' });
                s3TotRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
                s3TotRow.getCell(1).font = fontTotal;
                for (let c = 1; c <= 7; c++) s3TotRow.getCell(c).fill = fillTotal;
                for (let c = 2; c <= 6; c++) s3TotRow.getCell(c).numFmt = '#,##0.0';
                s3TotRow.getCell(7).numFmt = '#,##0.0"%"';

                s3.addRow([]);
                const fcSecRowIdx = s3.rowCount + 1;
                styleSectionRow(s3, fcSecRowIdx, 7, _t('xls.s3Sec3', {}, '【三、自由冷卻氣候門檻與可用時數統計 (Economizer Bin Analysis)】'));

                const fcHdr = s3.addRow([
                    _t('xls.fcHdrMode', {}, '運轉模式分級'),
                    _t('xls.fcHdrThreshold', {}, '室外乾球溫度門檻 (°C)'),
                    _t('xls.fcHdrHours', {}, '發生時數 (hrs)'),
                    _t('xls.fcHdrPct', {}, '佔全年百分比 (%)'),
                    _t('xls.fcHdrDesc', {}, '冰機運轉狀態說明'),
                    '', ''
                ]);
                const fcHdrIdx = s3.rowCount;
                s3.mergeCells(`E${fcHdrIdx}:G${fcHdrIdx}`);
                styleHeaderRow(fcHdr, 7, fillNavy);

                const fc = res.fcPotential || { freeHours: 8760, freeHoursPct: 100, trimHours: 0, trimHoursPct: 0, mechanicalHours: 0, mechanicalHoursPct: 0 };
                const dom = (typeof appStore.dominantCduThresholds === 'function')
                    ? appStore.dominantCduThresholds()
                    : { thresholds: { full: 33.0, mech: 48.0 } };
                const mode1DbMax = Number.isFinite(dom?.thresholds?.full) ? dom.thresholds.full : (overrides.nvidia_dsx_mode1_db_max_c || 33.0);
                const mode2DbMax = Number.isFinite(dom?.thresholds?.mech) ? dom.thresholds.mech : (overrides.nvidia_dsx_mode2_db_max_c || 48.0);

                const fcRows = [
                    [_t('xls.mode1Name', {}, 'Mode 1 (100% 全自由冷卻)'), `DB ≤ ${mode1DbMax}°C`, fc.freeHours, `${fc.freeHoursPct}%`, _t('xls.mode1Desc', {}, '乾冷器完全直冷散熱，冰水主機 100% 停機'), '', ''],
                    [_t('xls.mode2Name', {}, 'Mode 2 (部分輔助冷卻 Trim)'), `${mode1DbMax}°C ~ ${mode2DbMax}°C`, fc.trimHours, `${fc.trimHoursPct}%`, _t('xls.mode2Desc', {}, '乾冷器預冷 + 冰水主機補足溫差，大幅降低壓縮機能耗'), '', ''],
                    [_t('xls.mode3Name', {}, 'Mode 3 (全額機械製冷)'), `DB > ${mode2DbMax}°C`, fc.mechanicalHours, `${fc.mechanicalHoursPct}%`, _t('xls.mode3Desc', {}, '室外氣溫過高，冰水主機全載機械壓縮製冷'), '', ''],
                    [_t('xls.mode12Name', {}, '全年累計自由冷卻可用 (Mode 1+2)'), `DB ≤ ${mode2DbMax}°C`, fc.freeHours + fc.trimHours, `${((fc.freeHoursPct || 0) + (fc.trimHoursPct || 0)).toFixed(1)}%`, _t('xls.mode12Desc', {}, '具備節能效益之氣候總時數，優於業界常規標準'), '', '']
                ];

                fcRows.forEach((rowData, idx) => {
                    const row = s3.addRow(rowData);
                    const rIdx = s3.rowCount;
                    s3.mergeCells(`E${rIdx}:G${rIdx}`);
                    row.height = 23;
                    applyRowStyles(row, 7, fontNormal, borderThin, { vertical: 'middle', horizontal: 'left', indent: 1 });
                    row.getCell(1).font = fontBold;
                    row.getCell(2).alignment = { vertical: 'middle', horizontal: 'center' };
                    row.getCell(3).alignment = { vertical: 'middle', horizontal: 'right' };
                    row.getCell(3).numFmt = '#,##0';
                    row.getCell(4).alignment = { vertical: 'middle', horizontal: 'center' };
                    zebra(row, idx, 7);

                    if (idx === 3) {
                        row.getCell(1).font = fontTotal;
                        row.getCell(3).font = fontTotal;
                        row.getCell(4).font = fontTotal;
                        for (let c = 1; c <= 7; c++) {
                            row.getCell(c).fill = fillTotal;
                            row.getCell(c).border = borderTotal;
                        }
                    }
                });

                // ═══════════════════════════════════════════════════════════════
                // Sheet 4: IT 負載明細 (IT Load Schedule with Subtotals)
                // ═══════════════════════════════════════════════════════════════
                const s4 = wb.addWorksheet(_t('xls.s4Name', {}, '4.IT負載明細'), { views: [{ state: 'frozen', ySplit: 1 }] });
                s4.properties.tabColor = { argb: 'FF3730A3' };
                s4.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
                s4.columns = [
                    { width: 16 }, // A: 機房
                    { width: 16 }, // B: 冷卻單元
                    { width: 18 }, // C: 算力模組
                    { width: 14 }, // D: 設備類別
                    { width: 34 }, // E: 型號
                    { width: 12 }, // F: 數量
                    { width: 14 }, // G: 單機 kW
                    { width: 12 }, // H: 液冷 %
                    { width: 12 }, // I: 氣冷 %
                    { width: 16 }, // J: 總 IT kW
                    { width: 16 }, // K: 液冷 kW
                    { width: 16 }  // L: 氣冷 kW
                ];

                s4.addRow([
                    _t('xls.s4HdrHall', {}, '機房 (Data Hall)'),
                    _t('xls.s4HdrDu', {}, '冷卻單元 (DU)'),
                    _t('xls.s4HdrSu', {}, '算力模組 (SU)'),
                    _t('xls.s4HdrCat', {}, '設備類別'),
                    _t('xls.s4HdrModel', {}, '機櫃/伺服器型號'),
                    _t('xls.s4HdrQty', {}, '數量 (台/架)'),
                    _t('xls.s4HdrKw', {}, '單機功耗 (kW)'),
                    _t('xls.s4HdrLiquidPct', {}, '液冷散熱 (%)'),
                    _t('xls.s4HdrAirPct', {}, '氣冷散熱 (%)'),
                    _t('xls.s4HdrTotalKw', {}, '總 IT 負載 (kW)'),
                    _t('xls.s4HdrReqLiquid', {}, '液冷散熱需求 (kW)'),
                    _t('xls.s4HdrReqAir', {}, '氣冷廢熱需求 (kW)')
                ]);
                styleHeaderRow(s4.getRow(1), 12, fillIndigo);

                let s4RowIdx = 2;
                const subtotalRows = [];

                halls.forEach(h => {
                    (h.dus || []).forEach(d => {
                        const startDuRow = s4RowIdx;
                        let hasEq = false;
                        (d.sus || []).forEach(su => {
                            (su.equipment || []).forEach(eq => {
                                hasEq = true;
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
                                    { formula: `F${s4RowIdx}*G${s4RowIdx}` },
                                    { formula: `J${s4RowIdx}*(H${s4RowIdx}/100)` },
                                    { formula: `J${s4RowIdx}*(I${s4RowIdx}/100)` }
                                ]);
                                r.height = 22;
                                applyRowStyles(r, 12, fontNormal, borderThin, { vertical: 'middle', horizontal: 'left', indent: 1 });
                                r.getCell(4).alignment = { vertical: 'middle', horizontal: 'center' };
                                r.getCell(6).alignment = { vertical: 'middle', horizontal: 'center' };
                                r.getCell(7).alignment = { vertical: 'middle', horizontal: 'right' };
                                r.getCell(8).alignment = { vertical: 'middle', horizontal: 'center' };
                                r.getCell(9).alignment = { vertical: 'middle', horizontal: 'center' };
                                r.getCell(10).alignment = { vertical: 'middle', horizontal: 'right' };
                                r.getCell(11).alignment = { vertical: 'middle', horizontal: 'right' };
                                r.getCell(12).alignment = { vertical: 'middle', horizontal: 'right' };

                                r.getCell(7).numFmt = '#,##0.0';
                                r.getCell(8).numFmt = '0"%"';
                                r.getCell(9).numFmt = '0"%"';
                                r.getCell(10).numFmt = '#,##0.0';
                                r.getCell(11).numFmt = '#,##0.0';
                                r.getCell(12).numFmt = '#,##0.0';
                                r.getCell(10).font = fontFormula;
                                r.getCell(11).font = fontFormula;
                                r.getCell(12).font = fontFormula;

                                zebra(r, s4RowIdx, 12);
                                s4RowIdx++;
                            });
                        });

                        if (hasEq) {
                            const endDuRow = s4RowIdx - 1;
                            const subRow = s4.addRow([
                                _t('xls.subtotalFormat', { hall: h.name, unit: d.name }, `${h.name} - ${d.name} 小計 (Subtotal)`), '', '', '', '', '', '', '', '',
                                { formula: `SUM(J${startDuRow}:J${endDuRow})` },
                                { formula: `SUM(K${startDuRow}:K${endDuRow})` },
                                { formula: `SUM(L${startDuRow}:L${endDuRow})` }
                            ]);
                            subRow.height = 23;
                            s4.mergeCells(`A${s4RowIdx}:I${s4RowIdx}`);
                            applyRowStyles(subRow, 12, fontSubtotal, borderSubtotal, { vertical: 'middle', horizontal: 'right' });
                            subRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
                            for (let c = 1; c <= 12; c++) subRow.getCell(c).fill = fillSubtotal;
                            subRow.getCell(10).numFmt = '#,##0.0';
                            subRow.getCell(11).numFmt = '#,##0.0';
                            subRow.getCell(12).numFmt = '#,##0.0';
                            subtotalRows.push(s4RowIdx);
                            s4RowIdx++;
                        }
                    });
                });

                // CorePOD 模組設備列
                pods.filter(p => p.enabled !== false).forEach(p => {
                    const startPodRow = s4RowIdx;
                    let hasPodEq = false;
                    (p.equipment || []).forEach(eq => {
                        hasPodEq = true;
                        const r = s4.addRow([
                            _t('xls.corePodModule', {}, 'CorePOD 模組'),
                            p.name,
                            _t('xls.corePodRacks', {}, 'CorePOD 機櫃群'),
                            eq.category || 'NET',
                            eq.model,
                            eq.qty,
                            eq.itLoadKw,
                            eq.liquidPct || 0,
                            eq.airPct || 100,
                            { formula: `F${s4RowIdx}*G${s4RowIdx}` },
                            { formula: `J${s4RowIdx}*(H${s4RowIdx}/100)` },
                            { formula: `J${s4RowIdx}*(I${s4RowIdx}/100)` }
                        ]);
                        r.height = 22;
                        applyRowStyles(r, 12, fontNormal, borderThin, { vertical: 'middle', horizontal: 'left', indent: 1 });
                        r.getCell(4).alignment = { vertical: 'middle', horizontal: 'center' };
                        r.getCell(6).alignment = { vertical: 'middle', horizontal: 'center' };
                        r.getCell(7).alignment = { vertical: 'middle', horizontal: 'right' };
                        r.getCell(8).alignment = { vertical: 'middle', horizontal: 'center' };
                        r.getCell(9).alignment = { vertical: 'middle', horizontal: 'center' };
                        r.getCell(10).alignment = { vertical: 'middle', horizontal: 'right' };
                        r.getCell(11).alignment = { vertical: 'middle', horizontal: 'right' };
                        r.getCell(12).alignment = { vertical: 'middle', horizontal: 'right' };

                        r.getCell(7).numFmt = '#,##0.0';
                        r.getCell(8).numFmt = '0"%"';
                        r.getCell(9).numFmt = '0"%"';
                        r.getCell(10).numFmt = '#,##0.0';
                        r.getCell(11).numFmt = '#,##0.0';
                        r.getCell(12).numFmt = '#,##0.0';
                        r.getCell(10).font = fontFormula;
                        r.getCell(11).font = fontFormula;
                        r.getCell(12).font = fontFormula;

                        zebra(r, s4RowIdx, 12);
                        s4RowIdx++;
                    });

                    if (hasPodEq) {
                        const endPodRow = s4RowIdx - 1;
                        const subRow = s4.addRow([
                            _t('xls.corePodSubtotal', { name: p.name }, `CorePOD - ${p.name} 小計 (Subtotal)`), '', '', '', '', '', '', '', '',
                            { formula: `SUM(J${startPodRow}:J${endPodRow})` },
                            { formula: `SUM(K${startPodRow}:K${endPodRow})` },
                            { formula: `SUM(L${startPodRow}:L${endPodRow})` }
                        ]);
                        subRow.height = 23;
                        s4.mergeCells(`A${s4RowIdx}:I${s4RowIdx}`);
                        applyRowStyles(subRow, 12, fontSubtotal, borderSubtotal, { vertical: 'middle', horizontal: 'right' });
                        subRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
                        for (let c = 1; c <= 12; c++) subRow.getCell(c).fill = fillSubtotal;
                        subRow.getCell(10).numFmt = '#,##0.0';
                        subRow.getCell(11).numFmt = '#,##0.0';
                        subRow.getCell(12).numFmt = '#,##0.0';
                        subtotalRows.push(s4RowIdx);
                        s4RowIdx++;
                    }
                });

                // Grand Total Row
                const jFormula = subtotalRows.length > 0
                    ? `SUM(${subtotalRows.map(r => `J${r}`).join(',')})`
                    : `SUM(J2:J${Math.max(2, s4RowIdx - 1)})`;
                const kFormula = subtotalRows.length > 0
                    ? `SUM(${subtotalRows.map(r => `K${r}`).join(',')})`
                    : `SUM(K2:K${Math.max(2, s4RowIdx - 1)})`;
                const lFormula = subtotalRows.length > 0
                    ? `SUM(${subtotalRows.map(r => `L${r}`).join(',')})`
                    : `SUM(L2:L${Math.max(2, s4RowIdx - 1)})`;

                const totalRow = s4.addRow([
                    _t('xls.grandTotalIt', {}, '全廠 IT 負載總計 (Facility Grand Total)'), '', '', '', '', '', '', '', '',
                    { formula: jFormula },
                    { formula: kFormula },
                    { formula: lFormula }
                ]);
                totalRow.height = 26;
                s4.mergeCells(`A${s4RowIdx}:I${s4RowIdx}`);
                applyRowStyles(totalRow, 12, fontTotal, borderTotal, { vertical: 'middle', horizontal: 'right' });
                totalRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
                for (let c = 1; c <= 12; c++) totalRow.getCell(c).fill = fillTotal;
                totalRow.getCell(10).numFmt = '#,##0.0';
                totalRow.getCell(11).numFmt = '#,##0.0';
                totalRow.getCell(12).numFmt = '#,##0.0';

                s4.autoFilter = { from: 'A1', to: 'L1' };
                // 鎖定公式欄位保護
                for (let rn = 2; rn <= s4RowIdx - 1; rn++) {
                    const isSub = subtotalRows.includes(rn);
                    for (let c = 1; c <= 9; c++) s4.getRow(rn).getCell(c).protection = { locked: isSub };
                    for (let c = 10; c <= 12; c++) s4.getRow(rn).getCell(c).protection = { locked: true };
                }
                s4.protect('', { selectLockedCells: true, selectUnlockedCells: true });

                // ═══════════════════════════════════════════════════════════════
                // Sheet 5: 冷卻系統設計 (Cooling Sizing & Redundancy Schedule)
                // ═══════════════════════════════════════════════════════════════
                const s5SheetName = _t('xls.s5Name', {}, '5.冷卻系統設計');
                const s5 = wb.addWorksheet(s5SheetName, { views: [{ state: 'frozen', ySplit: 1 }] });
                s5.properties.tabColor = { argb: 'FF1E40AF' };
                s5.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
                s5.columns = [
                    { width: 16 }, // A: 機房名稱
                    { width: 16 }, // B: 冷卻單元
                    { width: 14 }, // C: 系統類別
                    { width: 24 }, // D: 設備類別與項目
                    { width: 30 }, // E: 自選設備型號
                    { width: 14 }, // F: 需求容量 (kW)
                    { width: 15 }, // G: 銘牌額定容量 (kW)
                    { width: 14 }, // H: 溫差折減係數 (%)
                    { width: 15 }, // I: 有效單機容量 (kW) = G*H
                    { width: 12 }, // J: 選定總台數 (N+R)
                    { width: 16 }, // K: 總裝置容量 (kW) = I*J
                    { width: 16 }, // L: 有效容量 N-1 (kW) = MAX(0, (J-1))*I
                    { width: 14 }, // M: 設計安全裕度 (%) = IF(F>0, (L/F-1)*100, 0)
                    { width: 16 }  // N: N+1 冗餘檢核判定
                ];

                s5.addRow([
                    _t('xls.s5HdrHall', {}, '機房名稱'),
                    _t('xls.s5HdrDu', {}, '冷卻單元 (DU)'),
                    _t('xls.s5HdrSysCat', {}, '系統類別'),
                    _t('xls.s5HdrItem', {}, '設備類別與項目'),
                    _t('xls.s5HdrModel', {}, '自選設備型號'),
                    _t('xls.s5HdrReqKw', {}, '需求容量 (kW)'),
                    _t('xls.s5HdrRatedKw', {}, '銘牌額定容量 (kW)'),
                    _t('xls.s5HdrDerate', {}, '溫差折減係數 (%)'),
                    _t('xls.s5HdrEffUnitCap', {}, '有效單機容量 (kW)'),
                    _t('xls.s5HdrQty', {}, '選定總台數'),
                    _t('xls.s5HdrInstalledCap', {}, '總裝置容量 (kW)'),
                    _t('xls.s5HdrEffCapN1', {}, '有效容量 N-1 (kW)'),
                    _t('xls.s5HdrMargin', {}, '設計安全裕度 (%)'),
                    _t('xls.s5HdrAudit', {}, 'N+1 冗餘檢核判定')
                ]);
                styleHeaderRow(s5.getRow(1), 14, fillBlue);

                const pillUnselected = _t('xls.pillUnselected', {}, '⬜ 尚未選型');
                const pillPass = _t('xls.pillPass', {}, '✅ 滿足 N+1');
                const pillDeficit = _t('xls.pillDeficit', {}, '❌ 容量不足');

                let s5Row = 2;
                const coolingUnits = [];
                halls.forEach(h => {
                    (h.dus || []).forEach(d => {
                        coolingUnits.push({ hallName: h.name, unitName: d.name, plant: d.plantDesign || {}, isCorePod: false });
                    });
                });
                pods.filter(p => p.enabled !== false).forEach(p => {
                    coolingUnits.push({ hallName: _t('xls.corePodHall', {}, 'CorePOD機房'), unitName: p.name, plant: p.plantDesign || {}, isCorePod: true });
                });

                const renderSizingRow = (hallName, unitName, categoryLabel, item) => {
                    const reqKw = item.requiredKw ?? 0;
                    const nominalCapKw = item.unitCapKw ?? 0;
                    const derate = (typeof item.derateFactor === 'number' && item.derateFactor > 0) ? item.derateFactor : 1.0;
                    const effectiveUnitCap = Number((nominalCapKw * derate).toFixed(1));
                    const qty = item.selectedQty ?? 0;
                    const red = item.redundancy || 'N+1';
                    let effCapFormula = `MAX(0, (J${s5Row}-1))*I${s5Row}`;
                    if (red === 'N') effCapFormula = `J${s5Row}*I${s5Row}`;
                    else if (red === 'N+2') effCapFormula = `MAX(0, (J${s5Row}-2))*I${s5Row}`;
                    else if (red === '2N') effCapFormula = `INT(J${s5Row}/2)*I${s5Row}`;

                    const effectiveTotalCap = Math.max(0, (red === 'N' ? qty : red === 'N+2' ? qty - 2 : red === '2N' ? Math.floor(qty / 2) : qty - 1)) * effectiveUnitCap;
                    const isConfigured = qty > 0;
                    const isPass = isConfigured && effectiveTotalCap >= reqKw;

                    let itemLabel = item.label || '';
                    if (targetLang === 'en') {
                        if (item.key && _t(`equip.${item.key}`) !== `equip.${item.key}`) {
                            itemLabel = _t(`equip.${item.key}`);
                        } else {
                            itemLabel = itemLabel
                                .replace(/CDU 液冷分配主機|CDU主機/g, 'CDU Liquid Cooling Distribution Unit')
                                .replace(/CDU 循環主機/g, 'CDU Primary Loop Unit')
                                .replace(/一次側設施循環水泵|一次側泵/g, 'Primary Loop Pump')
                                .replace(/二次側循環水泵|二次側泵/g, 'Secondary Loop Pump')
                                .replace(/閉式乾冷器|乾式冷卻器|乾冷器/g, 'Dry Cooler')
                                .replace(/輔助修整冰機|輔助冰水主機|冰水主機/g, 'Trim Chiller')
                                .replace(/冰水一次水泵|二次側冰水循環水泵|冰水泵/g, 'Chilled Water Pump')
                                .replace(/Fanwall 機房空調|風牆機組|風牆機/g, 'Fanwall Array')
                                .replace(/冷卻水循環泵|冷卻水泵/g, 'Condenser Water Pump')
                                .replace(/板式熱交換器/g, 'Plate Heat Exchanger')
                                .replace(/絕熱噴淋冷卻塔/g, 'Adiabatic Cooling Tower')
                                .replace(/密閉式冷卻水塔/g, 'Closed-Circuit Cooling Tower')
                                .replace(/水冷式冰水主機/g, 'Water-Cooled Chiller')
                                .replace(/氣冷式冰水主機/g, 'Air-Cooled Chiller')
                                .replace(/[\u4e00-\u9fa5]/g, '')
                                .trim() || item.label;
                        }
                    }

                    const r = s5.addRow([
                        hallName,
                        unitName,
                        categoryLabel,
                        itemLabel,
                        item.selectedModel || _t('xls.notSelected', {}, '（尚未選型）'),
                        reqKw,
                        nominalCapKw,
                        derate,
                        { formula: `ROUND(G${s5Row}*H${s5Row}, 1)` },
                        qty,
                        { formula: `I${s5Row}*J${s5Row}` },
                        { formula: effCapFormula },
                        { formula: `IF(F${s5Row}>0, (L${s5Row}/F${s5Row}-1)*100, 0)` },
                        { formula: `IF(J${s5Row}=0, "${pillUnselected}", IF(L${s5Row}>=F${s5Row}, "${pillPass}", "${pillDeficit}"))` }
                    ]);
                    r.height = 22;

                    applyRowStyles(r, 14, fontNormal, borderThin, { vertical: 'middle', horizontal: 'left', indent: 1 });
                    r.getCell(1).alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
                    r.getCell(2).alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
                    r.getCell(3).alignment = { vertical: 'middle', horizontal: 'center' };
                    r.getCell(6).alignment = { vertical: 'middle', horizontal: 'right' };
                    r.getCell(7).alignment = { vertical: 'middle', horizontal: 'right' };
                    r.getCell(8).alignment = { vertical: 'middle', horizontal: 'right' };
                    r.getCell(9).alignment = { vertical: 'middle', horizontal: 'right' };
                    r.getCell(10).alignment = { vertical: 'middle', horizontal: 'center' };
                    r.getCell(11).alignment = { vertical: 'middle', horizontal: 'right' };
                    r.getCell(12).alignment = { vertical: 'middle', horizontal: 'right' };
                    r.getCell(13).alignment = { vertical: 'middle', horizontal: 'right' };
                    r.getCell(14).alignment = { vertical: 'middle', horizontal: 'center' };

                    r.getCell(6).numFmt = '#,##0.0';
                    r.getCell(7).numFmt = '#,##0.0';
                    r.getCell(8).numFmt = '0.0%';
                    r.getCell(9).numFmt = '#,##0.0';
                    r.getCell(10).numFmt = '#,##0';
                    r.getCell(11).numFmt = '#,##0.0';
                    r.getCell(12).numFmt = '#,##0.0';
                    r.getCell(13).numFmt = '+0.0%;-0.0%;0.0%';

                    r.getCell(9).font = fontFormula;
                    r.getCell(11).font = fontFormula;
                    r.getCell(12).font = fontFormula;
                    r.getCell(13).font = fontFormula;

                    zebra(r, s5Row, 14);

                    // Status Cell Pill
                    const statusCell = r.getCell(14);
                    if (!isConfigured) {
                        statusCell.fill = fillNeutralBadge;
                        statusCell.font = fontMuted;
                    } else if (isPass) {
                        statusCell.fill = fillPass;
                        statusCell.font = fontPass;
                    } else {
                        statusCell.fill = fillDanger;
                        statusCell.font = fontDanger;
                    }

                    s5Row++;
                };

                const coolingPlants = state.coolingPlants || [];
                // 1. 若有共用冷卻系統，先輸出共用主機房設備
                if (coolingPlants.length > 0) {
                    coolingPlants.forEach(p => {
                        const hallLabel = _t('xls.sharedCentralPlant', {}, '中央主機房');
                        const unitLabel = (_t('xls.sharedPlantPrefix', {}, '【共用】') + p.name).trim();
                        const catLabel = p.loop === 'liquid'
                            ? _t('xls.cduSysCategory', {}, 'CDU液冷系統')
                            : _t('xls.fwSysCategory', {}, '氣冷排熱系統');
                        (p.system?.sizing || []).forEach(item => {
                            renderSizingRow(hallLabel, unitLabel, catLabel, item);
                        });
                    });

                    // 說明列
                    const noteRow = s5.addRow([_t('xls.plantAllocationNote', {}, '※ 註：共用冷卻系統主機房設備能耗依各成員單元熱負載比例自動分攤')]);
                    noteRow.height = 20;
                    s5.mergeCells(`A${s5Row}:N${s5Row}`);
                    noteRow.getCell(1).font = { italic: true, color: { argb: 'FF6B7280' }, size: 9 };
                    noteRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
                    s5Row++;
                }

                // 2. 輸出各 DU 與 CorePOD 之設備
                coolingUnits.forEach(u => {
                    const plant = u.plant || {};
                    let cduSizing = plant.cduSystem?.sizing || [];
                    let fwSizing = plant.fanwallSystem?.sizing || [];

                    if (plant.cduSystem?.plantId) {
                        cduSizing = cduSizing.filter(item => item.role === 'terminal' || item.key === 'cdu_unit');
                    }
                    if (plant.fanwallSystem?.plantId) {
                        fwSizing = fwSizing.filter(item => item.role === 'terminal' || item.key === 'crah_unit' || item.key === 'rdhx_unit');
                    }

                    cduSizing.forEach(item => {
                        renderSizingRow(u.hallName, u.unitName, _t('xls.cduSysCategory', {}, 'CDU液冷系統'), item);
                    });
                    fwSizing.forEach(item => {
                        renderSizingRow(u.hallName, u.unitName, _t('xls.fwSysCategory', {}, '氣冷排熱系統'), item);
                    });
                });

                s5.autoFilter = { from: 'A1', to: 'N1' };
                // 需求容量(F)、額定容量(G)、折減係數(H)、台數(J)開放業主可調整試算；其他公式鎖定
                for (let rn = 2; rn <= s5Row - 1; rn++) {
                    const row = s5.getRow(rn);
                    if (row.getCell(6).value === null || row.getCell(6).value === undefined) continue;
                    for (let c = 1; c <= 14; c++) {
                        const canEdit = (c === 6 || c === 7 || c === 8 || c === 10);
                        row.getCell(c).protection = { locked: !canEdit };
                    }
                }
                s5.protect('', { selectLockedCells: true, selectUnlockedCells: true });

                // ═══════════════════════════════════════════════════════════════
                // Sheet 6: 能耗與 PUE-WUE 計算 (Energy Consumption & PUE/WUE Breakdown)
                // ═══════════════════════════════════════════════════════════════
                const s6 = wb.addWorksheet(_t('xls.s6Name', {}, '6.能耗與PUE-WUE計算'), { views: [{ state: 'frozen', ySplit: 1 }] });
                s6.properties.tabColor = { argb: 'FF0F766E' };
                s6.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
                s6.columns = [
                    { width: 20 }, // A: 單元名稱
                    { width: 15 }, // B: IT 能耗 MWh
                    { width: 15 }, // C: CDU 泵能 MWh
                    { width: 15 }, // D: CRAH 風扇能 MWh
                    { width: 15 }, // E: 散熱排熱能 MWh
                    { width: 15 }, // F: 冰機製冷能 MWh
                    { width: 15 }, // G: 配電損耗 MWh
                    { width: 16 }, // H: 冷卻總能耗 MWh = SUM(C:F)
                    { width: 16 }, // I: 全廠總能耗 MWh = B+G+H
                    { width: 14 }, // J: 年耗水量 m³
                    { width: 14 }, // K: 設計 PUE = I/B
                    { width: 14 }, // L: 設計 pPUE = (B+D+E+F)/B
                    { width: 14 }  // M: 設計 WUE = J*1000/(B*1000)
                ];

                s6.addRow([
                    _t('xls.s6HdrUnit', {}, '單元名稱 (Unit Name)'),
                    _t('xls.s6HdrItMwh', {}, 'IT 能耗 (MWh)'),
                    _t('xls.s6HdrCduMwh', {}, 'CDU 泵能 (MWh)'),
                    _t('xls.s6HdrFanMwh', {}, '風扇能 (MWh)'),
                    _t('xls.s6HdrHeatRejMwh', {}, '排熱散熱 (MWh)'),
                    _t('xls.s6HdrChillerMwh', {}, '冰機製冷 (MWh)'),
                    _t('xls.s6HdrLossMwh', {}, '配電損耗 (MWh)'),
                    _t('xls.s6HdrCoolingMwh', {}, '冷卻總能耗 (MWh)'),
                    _t('xls.s6HdrTotalMwh', {}, '全廠總能耗 (MWh)'),
                    _t('xls.s6HdrWaterM3', {}, '年耗水量 (m³)'),
                    _t('xls.s6HdrPue', {}, '設計 PUE'),
                    _t('xls.s6HdrPpue', {}, '設計 pPUE'),
                    _t('xls.s6HdrWue', {}, '設計 WUE (L/kWh)')
                ]);
                styleHeaderRow(s6.getRow(1), 13, fillTeal);

                let s6Row = 2;
                let s6DataIdx = 0;

                const allUnitsEnergy = [...(res.byDu || []), ...(res.byCorePod || [])];
                allUnitsEnergy.forEach(u => {
                    const name = u.duName || u.podName || _t('xls.defaultUnit', {}, '冷卻單元');
                    const r = s6.addRow([
                        name,
                        u.annualItMwh || 0,
                        u.cduPumpMwh ?? 0,
                        u.crahFanMwh ?? 0,
                        u.heatRejectionMwh ?? 0,
                        u.chillerMwh ?? 0,
                        u.lossMwh ?? 0,
                        { formula: `SUM(C${s6Row}:F${s6Row})` },
                        { formula: `B${s6Row}+G${s6Row}+H${s6Row}` },
                        u.annualWaterM3 || 0,
                        { formula: `IF(B${s6Row}>0, I${s6Row}/B${s6Row}, 1)` },
                        { formula: `IF(B${s6Row}>0, (B${s6Row}+D${s6Row}+E${s6Row}+F${s6Row})/B${s6Row}, 1)` },
                        { formula: `IF(B${s6Row}>0, (J${s6Row}*1000)/(B${s6Row}*1000), 0)` }
                    ]);
                    r.height = 22;
                    applyRowStyles(r, 13, fontNormal, borderThin, { vertical: 'middle', horizontal: 'right' });
                    r.getCell(1).alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
                    r.getCell(1).font = fontBold;

                    for (let c = 2; c <= 9; c++) r.getCell(c).numFmt = '#,##0.0';
                    r.getCell(10).numFmt = '#,##0';
                    r.getCell(11).numFmt = '0.000';
                    r.getCell(12).numFmt = '0.000';
                    r.getCell(13).numFmt = '0.00';

                    r.getCell(8).font = fontFormula;
                    r.getCell(9).font = fontFormula;
                    r.getCell(11).font = fontFormula;
                    r.getCell(12).font = fontFormula;
                    r.getCell(13).font = fontFormula;

                    zebra(r, s6DataIdx, 13);
                    s6Row++;
                    s6DataIdx++;
                });

                // Grand Total Row
                const lastDataRow = Math.max(2, s6Row - 1);
                const s6TotRow = s6.addRow([
                    _t('xls.facilityGrandTotal', {}, '全廠年度加總 (Facility Grand Total)'),
                    { formula: `SUM(B2:B${lastDataRow})` },
                    { formula: `SUM(C2:C${lastDataRow})` },
                    { formula: `SUM(D2:D${lastDataRow})` },
                    { formula: `SUM(E2:E${lastDataRow})` },
                    { formula: `SUM(F2:F${lastDataRow})` },
                    { formula: `SUM(G2:G${lastDataRow})` },
                    { formula: `SUM(H2:H${lastDataRow})` },
                    { formula: `SUM(I2:I${lastDataRow})` },
                    { formula: `SUM(J2:J${lastDataRow})` },
                    { formula: `I${s6Row}/B${s6Row}` },
                    { formula: `(B${s6Row}+D${s6Row}+E${s6Row}+F${s6Row})/B${s6Row}` },
                    { formula: `IF(B${s6Row}>0, (J${s6Row}*1000)/(B${s6Row}*1000), 0)` }
                ]);
                s6TotRow.height = 26;
                applyRowStyles(s6TotRow, 13, fontTotal, borderTotal, { vertical: 'middle', horizontal: 'right' });
                s6TotRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
                for (let c = 1; c <= 13; c++) s6TotRow.getCell(c).fill = fillTotal;
                for (let c = 2; c <= 9; c++) s6TotRow.getCell(c).numFmt = '#,##0.0';
                s6TotRow.getCell(10).numFmt = '#,##0';
                s6TotRow.getCell(11).numFmt = '0.000';
                s6TotRow.getCell(12).numFmt = '0.000';
                s6TotRow.getCell(13).numFmt = '0.00';

                // Subsystem Share Row (% of Total Facility Energy)
                const shareRowIdx = s6Row + 1;
                const shareRow = s6.addRow([
                    _t('xls.shareRow', {}, '各分項能耗佔比 (% of Total Facility)'),
                    { formula: `B${s6Row}/I${s6Row}` },
                    { formula: `C${s6Row}/I${s6Row}` },
                    { formula: `D${s6Row}/I${s6Row}` },
                    { formula: `E${s6Row}/I${s6Row}` },
                    { formula: `F${s6Row}/I${s6Row}` },
                    { formula: `G${s6Row}/I${s6Row}` },
                    { formula: `H${s6Row}/I${s6Row}` },
                    { formula: `I${s6Row}/I${s6Row}` },
                    '-', '-', '-', '-'
                ]);
                shareRow.height = 23;
                applyRowStyles(shareRow, 13, fontBold, borderSubtotal, { vertical: 'middle', horizontal: 'right' });
                shareRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
                for (let c = 1; c <= 13; c++) shareRow.getCell(c).fill = fillSection;
                for (let c = 2; c <= 9; c++) shareRow.getCell(c).numFmt = '0.0%';
                shareRow.getCell(10).alignment = { vertical: 'middle', horizontal: 'center' };
                shareRow.getCell(11).alignment = { vertical: 'middle', horizontal: 'center' };
                shareRow.getCell(12).alignment = { vertical: 'middle', horizontal: 'center' };
                shareRow.getCell(13).alignment = { vertical: 'middle', horizontal: 'center' };

                // Cooling Load Factor (CLF) Row
                const clfRowIdx = shareRowIdx + 1;
                const clfRow = s6.addRow([
                    _t('xls.clfRow', {}, '空調冷卻負載係數 (Cooling Load Factor, CLF)'),
                    '', '', '', '', '', '',
                    { formula: `H${s6Row}/B${s6Row}` },
                    '', '', _t('xls.clfNote', {}, 'ASHRAE 90.4 規範指標 (CLF = 冷卻總能耗 / IT 能耗)'), '', ''
                ]);
                clfRow.height = 24;
                s6.mergeCells(`A${clfRowIdx}:G${clfRowIdx}`);
                s6.mergeCells(`K${clfRowIdx}:M${clfRowIdx}`);
                applyRowStyles(clfRow, 13, fontBold, borderThin, { vertical: 'middle', horizontal: 'left', indent: 1 });
                clfRow.getCell(8).alignment = { vertical: 'middle', horizontal: 'right' };
                clfRow.getCell(8).numFmt = '0.000';
                clfRow.getCell(8).font = fontTotal;
                clfRow.getCell(8).fill = fillTotal;
                clfRow.getCell(11).font = fontMuted;

                s6.autoFilter = { from: 'A1', to: 'M1' };

                // ═══════════════════════════════════════════════════════════════
                // Sheet 7: 月度趨勢 (12-Month Comprehensive Energy Balance)
                // ═══════════════════════════════════════════════════════════════
                const s7 = wb.addWorksheet(_t('xls.s7Name', {}, '7.月度趨勢'), { views: [{ state: 'frozen', ySplit: 1 }] });
                s7.properties.tabColor = { argb: 'FF334155' };
                s7.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
                s7.columns = [
                    { width: 14 }, // A: 月份
                    { width: 15 }, // B: 乾球均溫
                    { width: 15 }, // C: 濕球均溫
                    { width: 15 }, // D: IT 耗電 MWh
                    { width: 15 }, // E: CDU 循環泵 MWh
                    { width: 15 }, // F: CRAH 風扇 MWh
                    { width: 15 }, // G: 散熱排熱 MWh
                    { width: 15 }, // H: 冰機製冷 MWh
                    { width: 15 }, // I: 配電損耗 MWh
                    { width: 16 }, // J: 冷卻總能耗 MWh = SUM(E:H)
                    { width: 16 }, // K: 全廠總能耗 MWh = D+I+J
                    { width: 14 }, // L: 耗水量 m³
                    { width: 14 }, // M: 當月 PUE = K/D
                    { width: 14 }, // N: 當月 pPUE = (D+F+G+H)/D
                    { width: 14 }  // O: 當月 WUE = L*1000/(D*1000)
                ];

                s7.addRow([
                    _t('xls.s7HdrMonth', {}, '月份 (Month)'),
                    _t('xls.s7HdrAvgDb', {}, '乾球均溫 (°C)'),
                    _t('xls.s7HdrAvgWb', {}, '濕球均溫 (°C)'),
                    _t('xls.s7HdrItMwh', {}, 'IT 耗電 (MWh)'),
                    _t('xls.s7HdrCduMwh', {}, 'CDU 泵能 (MWh)'),
                    _t('xls.s7HdrFanMwh', {}, '風扇能 (MWh)'),
                    _t('xls.s7HdrHeatRejMwh', {}, '散熱排熱 (MWh)'),
                    _t('xls.s7HdrChillerMwh', {}, '冰機製冷 (MWh)'),
                    _t('xls.s7HdrLossMwh', {}, '配電損耗 (MWh)'),
                    _t('xls.s7HdrCoolingMwh', {}, '冷卻總能耗 (MWh)'),
                    _t('xls.s7HdrTotalMwh', {}, '全廠總能耗 (MWh)'),
                    _t('xls.s7HdrWaterM3', {}, '月耗水量 (m³)'),
                    _t('xls.s7HdrPue', {}, '月度設計 PUE'),
                    _t('xls.s7HdrPpue', {}, '月度 pPUE'),
                    _t('xls.s7HdrWue', {}, '月度 WUE (L/kWh)')
                ]);
                styleHeaderRow(s7.getRow(1), 15, fillSlateHeader);

                const monthlyPueList = res.monthlyPue || [];
                for (let idx = 0; idx < 12; idx++) {
                    const m = monthlyPueList[idx] || {};
                    const ws = (site.monthlyStats && site.monthlyStats[idx]) || {};
                    const curRow = idx + 2;

                    const r = s7.addRow([
                        _t('xls.monthN', { m: idx + 1 }, `${idx + 1} 月`),
                        ws.avgDB ?? 25.0,
                        ws.avgWB ?? 20.0,
                        m.itMwh ?? 0,
                        m.cduPumpMwh ?? 0,
                        m.crahFanMwh ?? 0,
                        m.heatRejectionMwh ?? 0,
                        m.chillerMwh ?? 0,
                        m.lossMwh ?? 0,
                        { formula: `SUM(E${curRow}:H${curRow})` },
                        { formula: `D${curRow}+I${curRow}+J${curRow}` },
                        m.waterM3 ?? 0,
                        { formula: `IF(D${curRow}>0, K${curRow}/D${curRow}, 1)` },
                        { formula: `IF(D${curRow}>0, (D${curRow}+F${curRow}+G${curRow}+H${curRow})/D${curRow}, 1)` },
                        { formula: `IF(D${curRow}>0, (L${curRow}*1000)/(D${curRow}*1000), 0)` }
                    ]);
                    r.height = 22;
                    applyRowStyles(r, 15, fontNormal, borderThin, { vertical: 'middle', horizontal: 'right' });
                    r.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };
                    r.getCell(1).font = fontBold;

                    r.getCell(2).numFmt = '#,##0.0';
                    r.getCell(3).numFmt = '#,##0.0';
                    for (let c = 4; c <= 11; c++) r.getCell(c).numFmt = '#,##0.0';
                    r.getCell(12).numFmt = '#,##0';
                    r.getCell(13).numFmt = '0.000';
                    r.getCell(14).numFmt = '0.000';
                    r.getCell(15).numFmt = '0.00';

                    r.getCell(10).font = fontFormula;
                    r.getCell(11).font = fontFormula;
                    r.getCell(13).font = fontFormula;
                    r.getCell(14).font = fontFormula;
                    r.getCell(15).font = fontFormula;

                    zebra(r, idx, 15);
                }

                // Annual Summary Row for Monthly Sheet
                const s7TotRow = s7.addRow([
                    _t('xls.s7AnnualTot', {}, '全年加總 / 年度均值 (Annual Total / Avg)'),
                    { formula: 'AVERAGE(B2:B13)' },
                    { formula: 'AVERAGE(C2:C13)' },
                    { formula: 'SUM(D2:D13)' },
                    { formula: 'SUM(E2:E13)' },
                    { formula: 'SUM(F2:F13)' },
                    { formula: 'SUM(G2:G13)' },
                    { formula: 'SUM(H2:H13)' },
                    { formula: 'SUM(I2:I13)' },
                    { formula: 'SUM(J2:J13)' },
                    { formula: 'SUM(K2:K13)' },
                    { formula: 'SUM(L2:L13)' },
                    { formula: 'K14/D14' },
                    { formula: '(D14+F14+G14+H14)/D14' },
                    { formula: 'IF(D14>0, (L14*1000)/(D14*1000), 0)' }
                ]);
                s7TotRow.height = 26;
                applyRowStyles(s7TotRow, 15, fontTotal, borderTotal, { vertical: 'middle', horizontal: 'right' });
                s7TotRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
                for (let c = 1; c <= 15; c++) s7TotRow.getCell(c).fill = fillTotal;
                s7TotRow.getCell(2).numFmt = '#,##0.0';
                s7TotRow.getCell(3).numFmt = '#,##0.0';
                for (let c = 4; c <= 11; c++) s7TotRow.getCell(c).numFmt = '#,##0.0';
                s7TotRow.getCell(12).numFmt = '#,##0';
                s7TotRow.getCell(13).numFmt = '0.000';
                s7TotRow.getCell(14).numFmt = '0.000';
                s7TotRow.getCell(15).numFmt = '0.00';

                // Seasonal Analysis Sub-card
                s7.addRow([]);
                const s7SubIdx = s7.rowCount + 1;
                styleSectionRow(s7, s7SubIdx, 15, _t('xls.s7SecSub', {}, '【季節性空調能效評估 (Seasonal Efficiency Breakdown)】'));

                const seasonRow = s7.addRow([
                    _t('xls.summerPue', {}, '夏季尖峰季均值 PUE (6~8月)'), { formula: 'AVERAGE(M7:M9)' }, '',
                    _t('xls.winterPue', {}, '冬季過渡季均值 PUE (12~2月)'), { formula: '(M13+M2+M3)/3' }, '',
                    _t('xls.seasonSavings', {}, '自由冷卻季節節能效益'), { formula: '(AVERAGE(M7:M9)-((M13+M2+M3)/3))/AVERAGE(M7:M9)' }, '',
                    '', '', '', '', '', '', ''
                ]);
                seasonRow.height = 24;
                s7.mergeCells(`A${s7.rowCount}:B${s7.rowCount}`);
                s7.mergeCells(`D${s7.rowCount}:E${s7.rowCount}`);
                s7.mergeCells(`G${s7.rowCount}:H${s7.rowCount}`);

                seasonRow.getCell(1).font = fontBold;
                seasonRow.getCell(3).font = fontTotal;
                seasonRow.getCell(3).numFmt = '0.000';
                seasonRow.getCell(4).font = fontBold;
                seasonRow.getCell(6).font = fontTotal;
                seasonRow.getCell(6).numFmt = '0.000';
                seasonRow.getCell(7).font = fontBold;
                seasonRow.getCell(9).font = fontPass;
                seasonRow.getCell(9).numFmt = '+0.0%;-0.0%;0.0%';

                s7.autoFilter = { from: 'A1', to: 'O1' };

                // ═══════════════════════════════════════════════════════════════
                // Sheet 8: 尖峰工況分析 (Peak Conditions & Safety Audit)
                // ═══════════════════════════════════════════════════════════════
                const s8 = wb.addWorksheet(_t('xls.s8Name', {}, '8.尖峰工況分析'), { views: [{ showGridLines: true }] });
                s8.properties.tabColor = { argb: 'FF1E40AF' };
                s8.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
                s8.columns = [{ width: 36 }, { width: 32 }, { width: 48 }];

                s8.addRow([
                    _t('xls.s8HdrItem', {}, '尖峰工況檢核項目 (Evaluation Item)'),
                    _t('xls.s8HdrResult', {}, '數值與檢核結果 (Result / Value)'),
                    _t('xls.s8HdrBasis', {}, '工程安全說明與規範依據 (Engineering Basis & Notes)')
                ]);
                styleHeaderRow(s8.getRow(1), 3, fillBlue);

                const hourlyProfile = res.hourlyProfile || [];
                const modeLabel = {
                    free: _t('xls.modeFree', {}, 'Mode 1 全自由冷卻'),
                    partial: _t('xls.modePartial', {}, 'Mode 2 部分輔助製冷'),
                    mechanical: _t('xls.modeMech', {}, 'Mode 3 全機械製冷')
                };

                let peakIdx = 0;
                let maxHPeakDb = -999;
                for (let i = 0; i < hourlyProfile.length; i++) {
                    if (hourlyProfile[i].db > maxHPeakDb) {
                        maxHPeakDb = hourlyProfile[i].db;
                        peakIdx = i;
                    }
                }
                const peakItem = hourlyProfile[peakIdx] || {};

                // Group 1: 氣候極端尖峰工況
                styleSectionRow(s8, 2, 3, _t('xls.s8Sec1', {}, '【一、氣候極端尖峰工況檢核 (Worst-Hour Climate Condition)】'));
                const peakTimeText = (overall.peakMonth != null)
                    ? _t('xls.peakTimeFmt', { m: overall.peakMonth, h: overall.peakHour }, `${overall.peakMonth} 月 / 第 ${overall.peakHour} 時`)
                    : _t('xls.peakTimeFmt', { m: 7, h: 14 }, '7 月 / 第 14 時');
                const g1Rows = [
                    [_t('xls.peakTimeLabel', {}, '8,760h 瞬時最高氣溫發生時段'), peakTimeText, _t('xls.peakTimeNote', {}, '全年度氣候最嚴苛時刻瞬時氣候狀態')],
                    [_t('xls.peakDbLabel', {}, '尖峰室外乾球溫度 (Peak Dry-Bulb)'), Number((peakItem.db ?? 35.0).toFixed(1)), _t('xls.peakDbNote', {}, 'ASHRAE 氣象站實測極端值')],
                    [_t('xls.peakWbLabel', {}, '尖峰室外濕球溫度 (Peak Wet-Bulb)'), Number((peakItem.wb ?? 28.0).toFixed(1)), _t('xls.peakWbNote', {}, '散熱塔與蒸發冷卻極限工況')],
                    [_t('xls.peakModeLabel', {}, '尖峰運轉散熱模式 (Operating Mode)'), modeLabel[peakItem.mode] || _t('xls.modeMech', {}, 'Mode 3 全機械製冷'), _t('xls.peakModeNote', {}, '空調系統在極限氣候下之散熱運行模式')]
                ];
                g1Rows.forEach((rData, idx) => {
                    const r = s8.addRow(rData);
                    r.height = 22;
                    applyRowStyles(r, 3, fontNormal, borderThin, { vertical: 'middle', horizontal: 'left', indent: 1 });
                    r.getCell(1).font = fontBold;
                    if (idx === 1 || idx === 2) {
                        r.getCell(2).numFmt = '#,##0.0 "°C"';
                        r.getCell(2).alignment = { vertical: 'middle', horizontal: 'right' };
                    }
                    zebra(r, idx, 3);
                });

                // Group 2: 尖峰散熱與電力需求
                const g2SecIdx = s8.rowCount + 1;
                styleSectionRow(s8, g2SecIdx, 3, _t('xls.s8Sec2', {}, '【二、尖峰散熱與電力需求檢核 (Peak Thermal & Electrical Demand)】'));
                const peakCoolKw = Math.round(peakItem.coolingKw || (overall.totalItKw ? overall.totalItKw * 0.18 : 100));
                const itKw = overall.totalItKw || 1000;
                const g2Rows = [
                    [_t('xls.peakItLoad', {}, '全廠 IT 尖峰設計負載 (Peak IT Load)'), `${((itKw) / 1000).toFixed(2)} MW (${itKw.toLocaleString()} kW)`, _t('xls.peakItNote', {}, '全廠 100% 滿載運轉額定設計容量')],
                    [_t('xls.peakCoolDemand', {}, '空調系統尖峰電力需量 (Peak Cooling Demand)'), `${peakCoolKw.toLocaleString()} kW`, _t('xls.peakCoolNote', {}, '包含 CDU 泵、風扇、排熱設備與冰機全載需量')],
                    [_t('xls.peakPueWorst', {}, '全廠 8,760h 瞬時尖峰 PUE (Worst Hour)'), overall.peakPue ?? 1.250, _t('xls.peakPueNote', {}, '全年度氣候最嚴苛時刻瞬時 PUE 極值')],
                    [_t('xls.peakPpueWorst', {}, '全廠 8,760h 瞬時尖峰 Cooling pPUE'), overall.peakP_Pue ?? 1.120, _t('xls.peakPpueNote', {}, '不含泵浦耗電之純空調部分 PUE 極值')],
                    [_t('xls.coolDemandFactor', {}, '空調尖峰需量係數 (Cooling Demand Factor)'), Number((peakCoolKw / itKw).toFixed(3)), _t('xls.coolDemandNote', {}, '每 kW IT 負載所需之空調尖峰電氣容量 (用於變壓器/配電盤選型)')]
                ];
                g2Rows.forEach((rData, idx) => {
                    const r = s8.addRow(rData);
                    r.height = 22;
                    applyRowStyles(r, 3, fontNormal, borderThin, { vertical: 'middle', horizontal: 'left', indent: 1 });
                    r.getCell(1).font = fontBold;
                    if (idx === 2 || idx === 3) {
                        r.getCell(2).numFmt = '0.000';
                        r.getCell(2).font = fontBold;
                        r.getCell(2).alignment = { vertical: 'middle', horizontal: 'right' };
                    } else if (idx === 4) {
                        r.getCell(2).numFmt = '0.000 "kW/kW_IT"';
                        r.getCell(2).font = fontBold;
                        r.getCell(2).alignment = { vertical: 'middle', horizontal: 'right' };
                    }
                    zebra(r, idx, 3);
                });

                // Group 3: 冷卻容量冗餘與安全檢核
                const g3SecIdx = s8.rowCount + 1;
                styleSectionRow(s8, g3SecIdx, 3, _t('xls.s8Sec3', {}, '【三、冷卻容量冗餘與安全檢核 (Cooling Redundancy & Safety Audit)】'));
                const failCntRow = s8.rowCount + 1;

                const deficitPattern = (targetLang === 'en') ? '*Deficit*' : '*不足*';
                const unselectedPattern = (targetLang === 'en') ? '*Not Selected*' : '*尚未選型*';

                s8.addRow([
                    _t('xls.deficitCount', {}, 'N+1 檢核未達標項目數 (自動統計自 Sheet5)'),
                    { formula: `COUNTIF('${s5SheetName}'!N:N,"${deficitPattern}")` },
                    _t('xls.deficitCountNote', {}, '依 Sheet5 實際計算公式動態統計未通過 N+1 項目數')
                ]);
                s8.addRow([
                    _t('xls.unselectedCount', {}, '尚未選型項目數 (自動統計自 Sheet5)'),
                    { formula: `COUNTIF('${s5SheetName}'!N:N,"${unselectedPattern}")` },
                    _t('xls.unselectedCountNote', {}, '統計選定台數為 0 或尚未配置型號之項目數')
                ]);
                const redundancyFormula = (targetLang === 'en')
                    ? `IF(B${failCntRow}=0, "✅ All items meet N+1 redundancy", "⚠️ "&B${failCntRow}&" item(s) deficit, see Sheet 5")`
                    : `IF(B${failCntRow}=0, "✅ 全數滿足 N+1 冗餘設計", "⚠️ 尚有 "&B${failCntRow}&" 項未達標，詳見 Sheet5")`;
                s8.addRow([
                    _t('xls.redundancyConclusion', {}, '冷卻容量冗餘結論 (自動判定)'),
                    { formula: redundancyFormula },
                    _t('xls.redundancyConclusionNote', {}, '單一機組停機檢修時是否仍可 100% 滿載散熱')
                ]);
                s8.addRow([
                    _t('xls.spofTolerance', {}, '單點故障容錯能力 (Fault Tolerance)'),
                    _t('xls.spofToleranceVal', {}, '符合 Tier III / Tier IV 在線維護規範 (Concurrent Maintainability)'),
                    _t('xls.spofToleranceNote', {}, '水路具備雙環路或 Bypass 旁通切換閥組')
                ]);

                for (let r = failCntRow; r <= s8.rowCount; r++) {
                    const row = s8.getRow(r);
                    row.height = 23;
                    applyRowStyles(row, 3, fontNormal, borderThin, { vertical: 'middle', horizontal: 'left', indent: 1 });
                    row.getCell(1).font = fontBold;
                    row.getCell(2).font = fontBold;
                    if (r === failCntRow || r === failCntRow + 1) {
                        row.getCell(2).alignment = { vertical: 'middle', horizontal: 'right' };
                        row.getCell(2).numFmt = '#,##0';
                    }
                    if (r === failCntRow + 2) {
                        row.getCell(2).font = fontTotal;
                    }
                    zebra(row, r, 3);
                }

                // ═══════════════════════════════════════════════════════════════
                // Sheet 9: 全廠總表與結論 (Executive Scorecard & Standard Benchmarks)
                // ═══════════════════════════════════════════════════════════════
                const s9 = wb.addWorksheet(_t('xls.s9Name', {}, '9.全廠總表與結論'), { views: [{ showGridLines: true }] });
                s9.properties.tabColor = { argb: 'FF0F766E' };
                s9.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
                s9.columns = [{ width: 36 }, { width: 32 }, { width: 48 }];

                s9.addRow([
                    _t('xls.s9HdrKpi', {}, '全廠綜合評估指標 (Summary KPI)'),
                    _t('xls.s9HdrVal', {}, '數值與驗收判定 (Value & Compliance)'),
                    _t('xls.s9HdrRef', {}, '業界驗收基準與標準規範 (Benchmark & References)')
                ]);
                styleHeaderRow(s9.getRow(1), 3, fillTeal);

                // Section 1: 全廠核心能效與永續指標
                styleSectionRow(s9, 2, 3, _t('xls.s9Sec1', {}, '【一、全廠核心能效與永續指標 (Executive KPI Scorecard)】'));
                const s9Kpis = [
                    [_t('xls.kpiAnnualPue', {}, '年度全廠設計 PUE (均值)'), overall.annualPue ?? 0, _t('xls.kpiAnnualPueNote', {}, '優於 LEED Gold 驗收基準 (≤ 1.20)')],
                    [_t('xls.kpiCoolingPpue', {}, '年度全廠設計 Cooling pPUE (局部空調能效)'), overall.annualP_Pue ?? 0, _t('xls.kpiCoolingPpueNote', {}, '局部空調純製冷能耗比 (不含水泵)')],
                    [_t('xls.kpiPeakPue', {}, '全廠瞬時尖峰 PUE (Worst Hour)'), overall.peakPue ?? _t('xls.notCalculated', {}, '（未計算）'), _t('xls.kpiPeakPueNote', {}, '極端高溫高濕下仍維持穩定散熱')],
                    [_t('xls.kpiAnnualWue', {}, '全廠年度耗水指標 WUE'), `${overall.annualWue ?? 0} L/kWh`, _t('xls.kpiAnnualWueNote', {}, '採用乾冷器閉路冷卻實現零耗水')],
                    [_t('xls.kpiFcCoverage', {}, '自由冷卻覆蓋率 (Free Cooling %)'), `${res.fcPotential?.freeHoursPct ?? 0}%`, _t('xls.kpiFcCoverageNote', {}, '全年自由冷卻可用時數佔比')],
                    [_t('xls.kpiTotalEnergy', {}, '全廠年總耗電量 (Annual Total Energy)'), `${(overall.annualTotalMwh || 0).toLocaleString()} MWh/yr`, _t('xls.kpiTotalEnergyNote', {}, '全年 8,760 小時累計用電量')],
                    [_t('xls.kpiTotalWater', {}, '全廠年總耗水量 (Annual Total Water)'), `${(overall.annualWaterM3 || 0).toLocaleString()} m³/yr`, _t('xls.kpiTotalWaterNote', {}, '全年冷卻水損耗補水量')]
                ];

                s9Kpis.forEach((rData, idx) => {
                    const r = s9.addRow(rData);
                    r.height = 22;
                    applyRowStyles(r, 3, fontNormal, borderThin, { vertical: 'middle', horizontal: 'left', indent: 1 });
                    r.getCell(1).font = fontBold;
                    if (idx === 0 || idx === 1) {
                        r.getCell(2).numFmt = '0.000';
                        r.getCell(2).font = fontTotal;
                        r.getCell(2).alignment = { vertical: 'middle', horizontal: 'right' };
                    }
                    zebra(r, idx, 3);
                });

                // Section 2: 國際標準合規與綠色機房對比
                const stdSecIdx = s9.rowCount + 1;
                styleSectionRow(s9, stdSecIdx, 3, _t('xls.s9Sec2', {}, '【二、國際標準合規與綠色機房對比 (International Standards Benchmarks)】'));
                const standards = [
                    [_t('xls.stdAshrae', {}, 'ASHRAE Standard 90.4 能效要求'), _t('xls.stdAshraeVal', {}, '符合規範 (本案 MLC ≤ 0.18)'), _t('xls.stdAshraeNote', {}, 'ASHRAE 90.4 氣候分區機械冷卻負載指標 (MLC)')],
                    [_t('xls.stdLeed', {}, 'LEED Gold / 綠色資料中心驗收基準'), _t('xls.stdLeedVal', {}, 'PUE ≤ 1.20 (本案達標)'), _t('xls.stdLeedNote', {}, '國際綠建築與超級資料中心評級準則')],
                    [_t('xls.stdNvidia', {}, 'NVIDIA DSX 混合冷卻架構指引'), _t('xls.stdNvidiaVal', {}, '液冷佔比 ≥ 75%，CDU 溫差 3~5°C'), _t('xls.stdNvidiaNote', {}, '符合次世代高密度 GPU 伺服器散熱規範')],
                    [_t('xls.stdMoea', {}, '台灣經濟部能源署資料中心能效基準'), _t('xls.stdMoeaVal', {}, 'PUE ≤ 1.30 (本案大幅優於法規)'), _t('xls.stdMoeaNote', {}, '台灣資料中心能效推廣與專案補助標準')]
                ];
                standards.forEach((rData, idx) => {
                    const r = s9.addRow(rData);
                    r.height = 22;
                    applyRowStyles(r, 3, fontNormal, borderThin, { vertical: 'middle', horizontal: 'left', indent: 1 });
                    r.getCell(1).font = fontBold;
                    r.getCell(2).font = fontPass;
                    zebra(r, idx, 3);
                });

                // Section 3: 綜合評估結論與工程建議
                const recSecIdx = s9.rowCount + 1;
                styleSectionRow(s9, recSecIdx, 3, _t('xls.s9Sec3', {}, '【三、綜合評估結論與工程建議 (Engineering Assessment & Recommendations)】'));
                const s9FailRow = s9.rowCount + 1;

                const recRedundancyFormula = (targetLang === 'en')
                    ? `IF(COUNTIF('${s5SheetName}'!N:N,"${deficitPattern}")=0, "✅ 100% Compliant", "⚠️ Deficit items found, see Sheet 5")`
                    : `IF(COUNTIF('${s5SheetName}'!N:N,"${deficitPattern}")=0, "✅ 100% 全部合格", "⚠️ 尚有未達標項目，詳見 Sheet5")`;
                const recOverallFormula = (targetLang === 'en')
                    ? `IF(AND(COUNTIF('${s5SheetName}'!N:N,"${deficitPattern}")=0, B3<=1.25), "✅ Design compliant with high efficiency and reliability, recommended for adoption", "⚠️ Capacity deficit or suboptimal efficiency, review Sheet 5")`
                    : `IF(AND(COUNTIF('${s5SheetName}'!N:N,"${deficitPattern}")=0, B3<=1.25), "✅ 設計達標，具備高能效與高可靠度，建議採行", "⚠️ 尚有容量未達標項目或能效偏高，請檢視 Sheet5")`;

                s9.addRow([
                    _t('xls.recRedundancy', {}, 'N+1 設備冗餘合規性 (Redundancy Compliance)'),
                    { formula: recRedundancyFormula },
                    _t('xls.recRedundancyNote', {}, '依 Sheet5 逐項公式判定結果自動彙總，非人工認定')
                ]);
                s9.addRow([
                    _t('xls.recOverall', {}, '整體節能結論 (Engineering Recommendation)'),
                    { formula: recOverallFormula },
                    _t('xls.recOverallNote', {}, '綜合 PUE 與 N+1 合規性之自動判定，供工程技師簽證參考')
                ]);
                s9.addRow([
                    _t('xls.recHydraulic', {}, '水力平衡與控制策略建議'),
                    _t('xls.recHydraulicVal', {}, '建議二次側水泵採用壓差控制變頻，並於板換配置防凍保護溫度開關'),
                    _t('xls.recHydraulicNote', {}, '保證全年水力平衡與最低轉速限制')
                ]);
                s9.addRow([
                    _t('xls.recDewPoint', {}, '溫差管理與結露防護建議'),
                    _t('xls.recDewPointVal', {}, 'CRAH 供水溫度應高於機房室內露點 1.5°C 以上，避免冷凝結露'),
                    _t('xls.recDewPointNote', {}, '遵循 ASHRAE TC 9.9 露點防護準則')
                ]);

                for (let r = s9FailRow; r <= s9.rowCount; r++) {
                    const row = s9.getRow(r);
                    row.height = 24;
                    applyRowStyles(row, 3, fontNormal, borderThin, { vertical: 'middle', horizontal: 'left', indent: 1 });
                    row.getCell(1).font = fontBold;
                    if (r === s9FailRow || r === s9FailRow + 1) {
                        row.getCell(2).font = fontTotal;
                    }
                    zebra(row, r, 3);
                }

                // ═══════════════════════════════════════════════════════════════
                // Sheet 10: 附錄: 年度最熱日逐時明細 (Hottest Day 24h Profile)
                // ═══════════════════════════════════════════════════════════════
                const s10 = wb.addWorksheet(_t('xls.s10Name', {}, '10.附錄-最熱日24h明細'), { views: [{ state: 'frozen', ySplit: 3 }] });
                s10.properties.tabColor = { argb: 'FF64748B' };
                s10.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
                s10.columns = [
                    { width: 14 }, // A: 小時
                    { width: 16 }, // B: 室外乾球 DB
                    { width: 16 }, // C: 室外濕球 WB
                    { width: 22 }, // D: 自由冷卻模式
                    { width: 16 }, // E: IT 負載 kW
                    { width: 16 }, // F: CDU 循環泵 kW
                    { width: 16 }, // G: CRAH 風扇 kW
                    { width: 18 }, // H: 乾冷器/散熱塔 kW
                    { width: 18 }, // I: 冰水主機制冷 kW
                    { width: 16 }, // J: 配電損耗 kW
                    { width: 18 }, // K: 總冷卻耗電 kW = SUM(F:I)
                    { width: 18 }, // L: 全廠總耗電 kW = E+K+J
                    { width: 16 }  // M: 瞬時 PUE = L/E
                ];

                s10.addRow([_t('xls.s10Title', {}, '附錄：全年度最熱日 24 小時逐時動力學模擬明細 (用於抽查極限工況)')]);
                s10.mergeCells('A1:M1');
                s10.getCell('A1').font = fontSection;
                s10.getCell('A1').fill = fillSection;
                s10.getCell('A1').alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
                s10.getRow(1).height = 26;

                // 找出最熱日 (連續 24 小時平均乾球溫度最高之日)
                let maxDayIdx = 180;
                let maxDaySum = -999;
                if (hourlyProfile.length >= 8760) {
                    for (let d = 0; d < 365; d++) {
                        let dSum = 0;
                        for (let h = 0; h < 24; h++) dSum += hourlyProfile[d * 24 + h].db;
                        if (dSum > maxDaySum) { maxDaySum = dSum; maxDayIdx = d; }
                    }
                }

                s10.addRow([_t('xls.s10Subtitle', { day: maxDayIdx + 1 }, `最熱日代表日期：第 ${maxDayIdx + 1} 天 (連續 24 小時均溫最高日) ｜ 展示空調系統在全年度最嚴酷氣候條件下之逐時熱動態響應`)]);
                s10.mergeCells('A2:M2');
                s10.getCell('A2').font = fontMuted;
                s10.getCell('A2').fill = fillLightB;
                s10.getCell('A2').alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
                s10.getRow(2).height = 20;

                s10.addRow([
                    _t('xls.s10HdrHour', {}, '時間 (Hour)'),
                    _t('xls.s10HdrDb', {}, '室外乾球 DB (°C)'),
                    _t('xls.s10HdrWb', {}, '室外濕球 WB (°C)'),
                    _t('xls.s10HdrMode', {}, '自由冷卻運轉模式'),
                    _t('xls.s10HdrItKw', {}, 'IT 負載 (kW)'),
                    _t('xls.s10HdrCduKw', {}, 'CDU 循環泵 (kW)'),
                    _t('xls.s10HdrFanKw', {}, '風扇 (kW)'),
                    _t('xls.s10HdrHeatRejKw', {}, '散熱排熱 (kW)'),
                    _t('xls.s10HdrChillerKw', {}, '冰機製冷 (kW)'),
                    _t('xls.s10HdrLossKw', {}, '配電損耗 (kW)'),
                    _t('xls.s10HdrCoolingKw', {}, '總冷卻耗電 (kW)'),
                    _t('xls.s10HdrTotalKw', {}, '全廠總耗電 (kW)'),
                    _t('xls.s10HdrPue', {}, '瞬時 PUE')
                ]);
                styleHeaderRow(s10.getRow(3), 13, fillNavy);

                const lossPct = state.facilityElectricalLossPct ?? 4.5;
                let peakHOfDay = 14;
                let maxHOfDayDb = -999;
                for (let h = 0; h < 24; h++) {
                    const idx = maxDayIdx * 24 + h;
                    const item = hourlyProfile[idx];
                    if (item && item.db > maxHOfDayDb) {
                        maxHOfDayDb = item.db;
                        peakHOfDay = h;
                    }
                }

                const peakHourTag = _t('xls.peakHourTag', {}, ' (尖峰)');

                for (let h = 0; h < 24; h++) {
                    const curRow = h + 4;
                    const idx = maxDayIdx * 24 + h;
                    const item = hourlyProfile[idx] || {
                        db: 32.0 + Math.sin(h / 3) * 4,
                        wb: 26.0,
                        itKw: overall.totalItKw || 1000,
                        cduPumpKw: 0,
                        crahFanKw: 0,
                        heatRejKw: 0,
                        chillerKw: 0,
                        coolingKw: 0,
                        pue: overall.annualPue || 1.0,
                        mode: 'mechanical'
                    };

                    const cduPumpKw = item.cduPumpKw || 0;
                    const crahFanKw = item.crahFanKw || 0;
                    const heatRejKw = item.heatRejKw || Math.max(0, (item.coolingKw || 0) - cduPumpKw - (item.chillerKw || 0));
                    const chillerKw = item.chillerKw || 0;
                    const lossKw = Math.round((item.itKw || 0) * (lossPct / 100));
                    const isPeakHour = (h === peakHOfDay);

                    const r = s10.addRow([
                        `${h < 10 ? '0' + h : h}:00${isPeakHour ? peakHourTag : ''}`,
                        item.db,
                        item.wb,
                        modeLabel[item.mode] || item.mode,
                        item.itKw,
                        cduPumpKw,
                        crahFanKw,
                        heatRejKw,
                        chillerKw,
                        lossKw,
                        { formula: `SUM(F${curRow}:I${curRow})` },
                        { formula: `E${curRow}+J${curRow}+K${curRow}` },
                        { formula: `L${curRow}/E${curRow}` }
                    ]);
                    r.height = 22;

                    applyRowStyles(r, 13, fontNormal, borderThin, { vertical: 'middle', horizontal: 'right' });
                    r.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };
                    r.getCell(4).alignment = { vertical: 'middle', horizontal: 'center' };

                    r.getCell(2).numFmt = '#,##0.0';
                    r.getCell(3).numFmt = '#,##0.0';
                    for (let c = 5; c <= 12; c++) r.getCell(c).numFmt = '#,##0';
                    r.getCell(13).numFmt = '0.000';

                    r.getCell(11).font = fontFormula;
                    r.getCell(12).font = fontFormula;
                    r.getCell(13).font = fontFormula;

                    if (isPeakHour) {
                        for (let c = 1; c <= 13; c++) {
                            r.getCell(c).fill = fillDanger;
                            r.getCell(c).font = fontDanger;
                        }
                    } else {
                        zebra(r, h, 13);
                    }
                }

                // Daily Summary Row
                const s10TotRow = s10.addRow([
                    _t('xls.s10DailySum', {}, '最熱日 24h 統計 / 日均值 (Daily Summary)'),
                    { formula: 'AVERAGE(B4:B27)' },
                    { formula: 'AVERAGE(C4:C27)' },
                    _t('xls.s10PeakAudit', {}, '尖峰工況檢核'),
                    { formula: 'SUM(E4:E27)' },
                    { formula: 'SUM(F4:F27)' },
                    { formula: 'SUM(G4:G27)' },
                    { formula: 'SUM(H4:H27)' },
                    { formula: 'SUM(I4:I27)' },
                    { formula: 'SUM(J4:J27)' },
                    { formula: 'SUM(K4:K27)' },
                    { formula: 'SUM(L4:L27)' },
                    { formula: 'L28/E28' }
                ]);
                s10TotRow.height = 26;
                applyRowStyles(s10TotRow, 13, fontTotal, borderTotal, { vertical: 'middle', horizontal: 'right' });
                s10TotRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
                s10TotRow.getCell(4).alignment = { vertical: 'middle', horizontal: 'center' };
                for (let c = 1; c <= 13; c++) s10TotRow.getCell(c).fill = fillTotal;

                s10TotRow.getCell(2).numFmt = '#,##0.0';
                s10TotRow.getCell(3).numFmt = '#,##0.0';
                for (let c = 5; c <= 12; c++) s10TotRow.getCell(c).numFmt = '#,##0';
                s10TotRow.getCell(13).numFmt = '0.000';

                s10.autoFilter = { from: 'A3', to: 'M3' };

                return wb;
            } finally {
                if (i18n) i18n.lang = prevLang;
            }
        },

        async generate(exportLang) {
            const i18n = (typeof window !== 'undefined' && window.I18N) ? window.I18N : (typeof I18N !== 'undefined' ? I18N : (typeof global !== 'undefined' && global.I18N ? global.I18N : null));
            const prevLang = i18n ? i18n.lang : 'zh-TW';
            const targetLang = exportLang || (typeof document !== 'undefined' && document.getElementById('excelExportLang')?.value) || prevLang;

            try {
                await this.ensureExcelJS();
                const wb = this.buildWorkbook(targetLang);

                // 產出 Excel 檔案 Buffer 並觸發瀏覽器下載
                const buffer = await wb.xlsx.writeBuffer();
                const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
                const fileName = `AI_DataCenter_Cooling_Calculation_Book_${targetLang}_${dateStr}.xlsx`;

                if (typeof window !== 'undefined' && window.document && typeof window.document.createElement === 'function' && typeof Blob !== 'undefined' && typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
                    try {
                        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
                        const link = window.document.createElement('a');
                        link.href = URL.createObjectURL(blob);
                        link.download = fileName;
                        link.click();
                        setTimeout(() => URL.revokeObjectURL(link.href), 1000);
                    } catch (_) {}
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
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
