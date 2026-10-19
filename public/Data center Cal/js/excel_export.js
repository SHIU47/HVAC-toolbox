/**
 * excel_export.js — 可驗證的資料中心 PUE 年度能耗計算書（R8 重寫，中 / 英雙語）
 *
 * 設計原則
 *  1. 可追溯：年度、月度、尖峰數值一律以公式由「11.附錄-8760逐時資料」加總；
 *     公式同時寫入快取結果，未重算的檢視器也能正確顯示，Excel 開檔時會全部重算。
 *  2. 儲存格顏色慣例：藍字 = 輸入值（專案設定或計算引擎輸出）、黑字 = 公式、綠字 = 跨工作表連結。
 *  3. 「9.驗證檢核」以公式把 Excel 重算值與計算引擎結果並排比對，逐項判定通過與否。
 *  4. 不寫入未經計算的合規聲明；架構、水溫、運轉模式說明一律取自專案實際設定與模擬結果。
 */
(function (window) {
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
        if (targetLang !== 'en') return def.ref || '';
        if (def.ref_en) return def.ref_en;
        const r = def.ref || '';
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
            .replace(/[一-龥]/g, '')
            .replace(/\s{2,}/g, ' ')
            .trim();
    }

    // 欄號 → 欄位字母（1 → A）
    function colL(n) {
        let s = '';
        while (n > 0) {
            const m = (n - 1) % 26;
            s = String.fromCharCode(65 + m) + s;
            n = Math.floor((n - 1) / 26);
        }
        return s;
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
                return this._build(ExcelJS, targetLang);
            } finally {
                if (i18n) i18n.lang = prevLang;
            }
        },

        _build(ExcelJS, targetLang) {
            const EN = targetLang === 'en';
            const L = (zh, en) => (EN ? en : zh);
            const FONT = EN ? 'Segoe UI' : 'Microsoft JhengHei';
            // 引擎提供的中文說明字串（如回歸期依據）在英文版轉成英文，其餘 CJK 移除
            const enText = (s) => {
                if (!EN || typeof s !== 'string') return s;
                return s.replace(/n=(\d+)\s*年回歸/g, 'n=$1-yr return period')
                    .replace(/年最高 DB/g, 'Annual max DB')
                    .replace(/[一-龥]/g, '')
                    .replace(/\s{2,}/g, ' ')
                    .trim();
            };

            // ─────────────────────────────────────────────────────────
            // 資料準備
            // ─────────────────────────────────────────────────────────
            const appStore = (typeof window !== 'undefined' && window.AppStore) ? window.AppStore : (typeof AppStore !== 'undefined' ? AppStore : {});
            const state = appStore.state || {};
            let res = state.results || {};
            if ((!Array.isArray(res.hourlyProfile) || res.hourlyProfile.length < 8760) && typeof appStore.calculate === 'function') {
                appStore.calculate();
                res = state.results || {};
            }
            const hp = res.hourlyProfile || [];
            if (hp.length < 8760) {
                throw new Error(L('尚無 8,760 小時模擬結果，請先完成計算再匯出', 'No 8,760-hour simulation results available. Please run the calculation first.'));
            }
            const overall = res.overall || {};
            const bk = overall.breakdownKwh || {};
            const site = state.site || {};
            const halls = state.halls || [];
            const pods = (state.corePods || []).filter(p => p.enabled !== false);
            const plants = (state.coolingPlants || []).filter(p => !p.isEmpty && Array.isArray(p.memberIds) && p.memberIds.length > 0);
            const lossPct = Number(state.facilityElectricalLossPct ?? 0);
            const itKwTotal = Number(overall.totalItKw || 0);
            const designCond = (typeof appStore.designConditions === 'function') ? (appStore.designConditions() || {}) : {};
            const Areg = (typeof window !== 'undefined' && typeof window.A === 'function') ? window.A : (typeof A === 'function' ? A : null);
            const Aval = (key, fb) => { try { return Areg ? Areg(key, state) : fb; } catch (_) { return fb; } };
            const archReg = (typeof window !== 'undefined' && window.CoolingArchRegistry) ? window.CoolingArchRegistry : (typeof CoolingArchRegistry !== 'undefined' ? CoolingArchRegistry : null);
            const archLabel = (id) => {
                const a = archReg ? archReg.get(id) : null;
                return enText((a && (a.cardLabel || a.dashboardLabel)) || id || '—');
            };

            const byUnits = [...(res.byDu || []), ...(res.byCorePod || [])];
            const hasLiquid = byUnits.some(u => (u.liquidHeatKw || 0) > 0);
            const hasAir = byUnits.some(u => ((u.airHeatKw || 0) + (u.lossKw || 0)) > 0);

            const MODE_TXT = {
                free: L('自然冷卻', 'Free cooling'),
                partial: L('部分自然冷卻', 'Partial free cooling'),
                mechanical: L('機械製冷', 'Mechanical')
            };
            const NA_TXT = '—';

            // 逐時資料（與「11.附錄-8760逐時資料」一一對應）
            const H = hp.slice(0, 8760).map(h => {
                const it = Number(h.itKw || 0);
                const cdu = Number(h.cduPumpKw || 0);
                const crah = Number(h.crahFanKw || 0);
                const hr = Number(h.heatRejKw || 0);
                const ch = Number(h.chillerKw || 0);
                const loss = it * lossPct / 100;
                const cool = cdu + crah + hr + ch;
                const tot = it + loss + cool;
                return {
                    m: h.month, d: h.dayOfYear, hh: h.hourOfDay, db: Number(h.db), wb: Number(h.wb),
                    lm: hasLiquid ? (MODE_TXT[h.cduMode] || MODE_TXT.free) : NA_TXT,
                    am: hasAir ? (MODE_TXT[h.fwMode] || MODE_TXT.free) : NA_TXT,
                    it, cdu, crah, hr, ch, loss, cool, tot,
                    pue: it > 0 ? tot / it : 0,
                    water: Number(h.waterM3 || 0)
                };
            });
            const sumBy = (arr, f) => arr.reduce((s, x) => s + f(x), 0);
            const ANN = {
                it: sumBy(H, x => x.it), cdu: sumBy(H, x => x.cdu), crah: sumBy(H, x => x.crah),
                hr: sumBy(H, x => x.hr), ch: sumBy(H, x => x.ch), loss: sumBy(H, x => x.loss),
                cool: sumBy(H, x => x.cool), tot: sumBy(H, x => x.tot), water: sumBy(H, x => x.water)
            };
            const MON = Array.from({ length: 12 }, (_, i) => {
                const rows = H.filter(x => x.m === i + 1);
                const n = rows.length;
                return {
                    n,
                    dbAvg: n ? sumBy(rows, x => x.db) / n : 0,
                    dbMax: n ? Math.max(...rows.map(x => x.db)) : 0,
                    dbMin: n ? Math.min(...rows.map(x => x.db)) : 0,
                    wbAvg: n ? sumBy(rows, x => x.wb) / n : 0,
                    wbMax: n ? Math.max(...rows.map(x => x.wb)) : 0,
                    it: sumBy(rows, x => x.it), cdu: sumBy(rows, x => x.cdu), crah: sumBy(rows, x => x.crah),
                    hr: sumBy(rows, x => x.hr), ch: sumBy(rows, x => x.ch), loss: sumBy(rows, x => x.loss),
                    water: sumBy(rows, x => x.water),
                    lm: Object.fromEntries(Object.values(MODE_TXT).map(t => [t, rows.filter(x => x.lm === t).length])),
                    am: Object.fromEntries(Object.values(MODE_TXT).map(t => [t, rows.filter(x => x.am === t).length]))
                };
            });

            // ─────────────────────────────────────────────────────────
            // 樣式系統
            // ─────────────────────────────────────────────────────────
            const C = {
                navy: 'FF0F332C', brand: 'FF16483F', brandMid: 'FF1F6354', brandSoft: 'FFEEF5F2', brandLine: 'FFB3D5C6',
                line: 'FFD4D4D8', lineSoft: 'FFE4E4E7', zebra: 'FFF8FAF9', text: 'FF18181B', muted: 'FF71717A',
                input: 'FF1D4ED8', link: 'FF047857', white: 'FFFFFFFF', subtitle: 'FFD9EAE3', total: 'FFF1F5F3',
                passBg: 'FFDCFCE7', passFg: 'FF166534', failBg: 'FFFEE2E2', failFg: 'FF991B1B', warnBg: 'FFFEF3C7', warnFg: 'FF92400E'
            };
            const fnt = (o = {}) => ({ name: FONT, size: o.size || 10, bold: !!o.bold, italic: !!o.italic, color: { argb: o.color || C.text } });
            const fill = (argb) => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } });
            const thin = (argb) => ({ style: 'thin', color: { argb } });
            const BORDER = { top: thin(C.lineSoft), bottom: thin(C.lineSoft), left: thin(C.lineSoft), right: thin(C.lineSoft) };
            const STYLE = {
                text: fnt(), bold: fnt({ bold: true }), muted: fnt({ size: 9, color: C.muted }),
                note: fnt({ size: 9, italic: true, color: C.muted }),
                input: fnt({ color: C.input }), formula: fnt(), link: fnt({ color: C.link }),
                header: fnt({ bold: true, color: C.white, size: 9.5 })
            };
            const FMT = {
                int: '#,##0', d1: '#,##0.0', d2: '#,##0.00', pue: '0.000', d4: '0.0000', pct1: '0.0%', pct2: '0.00%',
                temp: '0.0', signed: '+#,##0.00;-#,##0.00;0.00', signed4: '+0.0000;-0.0000;0.0000', signedPct: '+0.0%;-0.0%;0.0%',
                month: EN ? '"Month "0' : '0"月"'
            };
            const PASS = L('✔ 通過', '✔ PASS');
            const FAIL = L('✘ 不一致', '✘ MISMATCH');
            const SHORT = L('✘ 不足', '✘ SHORT');
            const WARN = L('⚠ 需檢討', '⚠ REVIEW');

            const F = (formula, result) => ({ formula, result: (typeof result === 'number' && !Number.isFinite(result)) ? 0 : result });
            const isNumVal = (v) => typeof v === 'number' || (v && typeof v === 'object' && 'formula' in v && typeof v.result === 'number');

            const put = (ws, r, c, v, kind = 'text', numFmt, opts = {}) => {
                const cell = ws.getCell(r, c);
                cell.value = (v === undefined) ? null : v;
                cell.font = opts.font || STYLE[kind] || STYLE.text;
                const align = opts.align || (isNumVal(v) ? 'right' : 'left');
                cell.alignment = { vertical: 'middle', horizontal: align, indent: (align === 'left') ? 1 : 0, wrapText: !!opts.wrap };
                if (numFmt) cell.numFmt = numFmt;
                cell.border = BORDER;
                if (opts.fill) cell.fill = fill(opts.fill);
                return cell;
            };
            const merge = (ws, r, c1, c2) => { if (c2 > c1) ws.mergeCells(r, c1, r, c2); };
            const span = (ws, r, c1, c2, v, kind = 'text', opts = {}) => {
                for (let c = c1; c <= c2; c++) put(ws, r, c, c === c1 ? v : null, kind, undefined, opts);
                merge(ws, r, c1, c2);
                return ws.getCell(r, c1);
            };
            const fillRow = (ws, r, c1, c2, argb) => { for (let c = c1; c <= c2; c++) ws.getCell(r, c).fill = fill(argb); };
            const boldRow = (ws, r, c1, c2) => { for (let c = c1; c <= c2; c++) { const cell = ws.getCell(r, c); cell.font = { ...cell.font, bold: true }; } };

            const genDate = new Date().toLocaleString(EN ? 'en-US' : 'zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });
            let stationLabel = site.selectedCity || site.stationName || site.stationId || L('自訂氣象資料', 'Custom weather data');
            if (EN && /[一-龥]/.test(stationLabel)) {
                const m = stationLabel.match(/\(([^)]+)\)/);
                stationLabel = m ? m[1] : (site.stationName || site.stationId || 'Custom weather data');
            }
            const reportTitle = L('資料中心 PUE 年度能耗計算書', 'Data Center Annual PUE Calculation Report');
            const subtitle = `${stationLabel}   ·   ${L('IT 設計容量', 'IT design load')} ${(itKwTotal / 1000).toFixed(2)} MW   ·   ${L('8,760 小時逐時模擬', '8,760-hour hourly simulation')}   ·   ${L('產製', 'Generated')} ${genDate}`;

            const titleBlock = (ws, ncols, title) => {
                for (let c = 1; c <= ncols; c++) { ws.getCell(1, c).fill = fill(C.navy); ws.getCell(2, c).fill = fill(C.navy); }
                ws.mergeCells(1, 1, 1, ncols);
                ws.mergeCells(2, 1, 2, ncols);
                const t = ws.getCell(1, 1);
                t.value = title;
                t.font = fnt({ size: 15, bold: true, color: C.white });
                t.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
                const s = ws.getCell(2, 1);
                s.value = subtitle;
                s.font = fnt({ size: 9, color: C.subtitle });
                s.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
                ws.getRow(1).height = 34;
                ws.getRow(2).height = 18;
                return 4;
            };
            const section = (ws, r, ncols, text) => {
                for (let c = 1; c <= ncols; c++) {
                    const cell = ws.getCell(r, c);
                    cell.fill = fill(C.brandSoft);
                    cell.border = { bottom: { style: 'medium', color: { argb: C.brandMid } } };
                }
                ws.mergeCells(r, 1, r, ncols);
                const cell = ws.getCell(r, 1);
                cell.value = text;
                cell.font = fnt({ size: 11, bold: true, color: C.brand });
                cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
                ws.getRow(r).height = 24;
                return r + 1;
            };
            const header = (ws, r, labels, startCol = 1) => {
                labels.forEach((t, i) => {
                    const c = ws.getCell(r, startCol + i);
                    c.value = t;
                    c.font = STYLE.header;
                    c.fill = fill(C.brand);
                    c.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
                    c.border = { left: thin(C.brandMid), right: thin(C.brandMid), top: thin(C.brandMid), bottom: thin(C.brandMid) };
                });
                ws.getRow(r).height = 32;
                return r + 1;
            };
            const note = (ws, r, ncols, text) => {
                ws.mergeCells(r, 1, r, ncols);
                const cell = ws.getCell(r, 1);
                cell.value = text;
                cell.font = STYLE.note;
                cell.alignment = { vertical: 'top', horizontal: 'left', indent: 1, wrapText: true };
                ws.getRow(r).height = Math.max(18, Math.ceil(String(text).length / (ncols * 9)) * 15);
                return r + 1;
            };
            const statusCF = (ws, ref) => {
                const tl = ref.split(':')[0].replace(/\$/g, '');
                ws.addConditionalFormatting({
                    ref,
                    rules: [
                        { type: 'expression', priority: 1, formulae: [`ISNUMBER(SEARCH("✔",${tl}))`], style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: C.passBg } }, font: { color: { argb: C.passFg }, bold: true } } },
                        { type: 'expression', priority: 2, formulae: [`ISNUMBER(SEARCH("✘",${tl}))`], style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: C.failBg } }, font: { color: { argb: C.failFg }, bold: true } } },
                        { type: 'expression', priority: 3, formulae: [`ISNUMBER(SEARCH("⚠",${tl}))`], style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: C.warnBg } }, font: { color: { argb: C.warnFg }, bold: true } } }
                    ]
                });
            };

            // ─────────────────────────────────────────────────────────
            // 工作表（依顯示順序建立，內容依公式相依順序填入）
            // ─────────────────────────────────────────────────────────
            const SN = {
                cover: L('1.封面與專案資訊', '1.Cover & Project Info'),
                basis: L('2.設計基準與假設', '2.Design Basis & Assumptions'),
                weather: L('3.氣象與自由冷卻分析', '3.Weather & Free Cooling'),
                it: L('4.IT負載明細', '4.IT Load Schedule'),
                sizing: L('5.冷卻系統設計', '5.Cooling System Design'),
                energy: L('6.能耗與PUE-WUE計算', '6.Energy & PUE-WUE'),
                monthly: L('7.月度趨勢', '7.Monthly Trend'),
                peak: L('8.尖峰工況分析', '8.Peak Condition Analysis'),
                verify: L('9.驗證檢核', '9.Verification Checks'),
                hottest: L('10.附錄-最熱日24h明細', '10.Appx-Hottest Day 24h'),
                hourly: L('11.附錄-8760逐時資料', '11.Appx-8760h Hourly Data'),
                scen: L('12.方案比較', '12.Scenario Comparison')
            };
            const qn = (name) => `'${name.replace(/'/g, "''")}'`;
            const X = (key, addr) => `${qn(SN[key])}!${addr}`;
            const abs = (c, r) => `$${colL(c)}$${r}`;

            const wb = new ExcelJS.Workbook();
            wb.creator = 'PUE Calculation Tool';
            wb.lastModifiedBy = 'PUE Calculation Tool';
            wb.created = new Date();
            wb.modified = new Date();
            wb.calcProperties = { fullCalcOnLoad: true };

            const S = {};
            const mk = (key, tab, widths, opts = {}) => {
                const ws = wb.addWorksheet(SN[key], {
                    properties: { tabColor: { argb: tab } },
                    views: [opts.view || { showGridLines: false }]
                });
                ws.columns = widths.map(w => ({ width: w }));
                ws.pageSetup = {
                    paperSize: 9, orientation: opts.portrait ? 'portrait' : 'landscape',
                    fitToPage: true, fitToWidth: 1, fitToHeight: 0,
                    margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.6, header: 0.3, footer: 0.3 }
                };
                ws.headerFooter = { oddFooter: `&L&8${reportTitle}&C&8&A&R&8&P / &N` };
                S[key] = ws;
                return ws;
            };
            mk('cover', C.navy, [2, 24, 20, 3, 24, 20, 3, 24, 20], { portrait: true });
            mk('basis', 'FF334155', [30, 26, 14, 12, 14, 14, 50]);
            mk('weather', 'FF0F766E', [26, 12, 12, 12, 12, 14, 14, 14, 14, 14, 14]);
            mk('it', 'FF1F6354', [26, 16, 10, 10, 46, 9, 11, 10, 10, 13, 13, 13, 6]);
            mk('sizing', 'FF1E40AF', [24, 24, 16, 30, 30, 13, 13, 11, 13, 11, 10, 10, 10, 14, 11, 10, 13, 13, 13]);
            mk('energy', 'FF0F766E', [40, 22, 13, 13, 13, 13, 13, 13, 13, 13, 14, 11, 13, 11, 28]);
            mk('monthly', 'FF0F766E', [11, 9, 11, 11, 11, 13, 12, 12, 12, 12, 12, 13, 14, 10, 10, 12, 10]);
            mk('peak', 'FF9A3412', [38, 18, 12, 54]);
            mk('verify', 'FF166534', [6, 34, 50, 16, 16, 14, 13, 14]);
            mk('hottest', 'FF9A3412', [9, 9, 9, 16, 16, 11, 11, 11, 11, 11, 11, 12, 12, 9]);
            const HR0 = 4;
            const HRN = HR0 + 8760 - 1;
            mk('hourly', 'FF52525B', [8, 6, 7, 6, 8, 8, 16, 16, 11, 13, 15, 11, 11, 14, 14, 15, 9, 10],
                { view: { state: 'frozen', xSplit: 4, ySplit: 3, showGridLines: false } });

            const hR = (col) => `${qn(SN.hourly)}!$${col}$${HR0}:$${col}$${HRN}`;
            // 逐時資料依月份連續排列：月 m 的列範圍（用 MAX/MIN 取代 Excel 2019 才有的 MAXIFS/MINIFS，相容所有版本）
            const MON_ROWS = MON.map((_, i) => {
                const first = H.findIndex(x => x.m === i + 1);
                let last = first;
                for (let k = first; k >= 0 && k < H.length && H[k].m === i + 1; k++) last = k;
                return [HR0 + first, HR0 + last];
            });
            const hMon = (col, i) => `${qn(SN.hourly)}!$${col}$${MON_ROWS[i][0]}:$${col}$${MON_ROWS[i][1]}`;
            const REF = {};

            // ═════════════════════════════════════════════════════════
            // 2. 設計基準與假設
            // ═════════════════════════════════════════════════════════
            {
                const ws = S.basis;
                let r = titleBlock(ws, 7, L('設計基準、計算方法與工程假設', 'Design Basis, Method & Engineering Assumptions'));
                r = section(ws, r, 7, L('A. 專案計算基準', 'A. Project Calculation Basis'));
                r = header(ws, r, [L('項目', 'Item'), '', L('數值', 'Value'), L('單位', 'Unit'), L('說明 / 來源', 'Note / Source'), '', '']);
                merge(ws, r - 1, 1, 2);
                merge(ws, r - 1, 5, 7);
                const kv = (label, value, kind, unit, noteText, fmt) => {
                    span(ws, r, 1, 2, label, 'bold');
                    put(ws, r, 3, value, kind, fmt);
                    put(ws, r, 4, unit, 'muted', undefined, { align: 'center' });
                    span(ws, r, 5, 7, noteText, 'muted', { wrap: true });
                    ws.getRow(r).height = 30;
                    return r++;
                };
                const pk = designCond.peakDb || {};
                REF.loss = X('basis', abs(3, kv(L('配電損耗率', 'Electrical loss ratio'), lossPct, 'input', '%',
                    L('變壓器、UPS、PDU 與輔助負載損耗；以「IT 功率 × 此比例」計入全廠用電，其熱量計入氣冷系統負載。', 'Transformer, UPS, PDU and auxiliary losses; counted as IT power × this ratio, with the heat added to the air-side cooling load.'), FMT.d2)));
                kv(L('IT 負載率', 'IT load factor'), 1, 'input', '-', L('全年 8,760 小時以設計滿載定值計算（未套用負載變動曲線）。', 'Constant design full load for all 8,760 hours (no load profile applied).'), FMT.pct1);
                REF.hours = X('basis', abs(3, kv(L('模擬時數', 'Simulated hours'), F(`COUNT(${hR('A')})`, 8760), 'link', 'h', L('= 逐時資料筆數', '= number of hourly records'), FMT.int)));
                kv(L('氣象資料', 'Weather data'), site.stationId || site.stationName || stationLabel, 'input', '-',
                    site.stationSource === 'builtin' ? L('內建 TMY 典型氣象年資料', 'Built-in TMY typical meteorological year') : L('使用者匯入 EPW / TMY 檔', 'User-imported EPW / TMY file'));
                REF.designDb = X('basis', abs(3, kv(L('設計乾球溫度', 'Design dry-bulb'), Number(designCond.designDb ?? 0), 'input', '°C', enText(designCond.designBasis || ''), FMT.temp)));
                REF.designWb = X('basis', abs(3, kv(L('設計濕球溫度', 'Design wet-bulb'), Number(designCond.designWb ?? 0), 'input', '°C', enText(designCond.designBasis || ''), FMT.temp)));
                REF.peakDb = X('basis', abs(3, kv(L('極端尖峰乾球', 'Extreme peak dry-bulb'), Number(pk.value ?? designCond.maxDb ?? 0), 'input', '°C', enText(pk.basis || ''), FMT.temp)));
                REF.cpWater = X('basis', abs(3, kv(L('水比熱', 'Water specific heat'), 4.186, 'input', 'kJ/(kg·K)', L('水力計算用；密度取 1 kg/L', 'Used in hydraulic calculations; density taken as 1 kg/L'), FMT.d4)));
                REF.cpGlycol = X('basis', abs(3, kv(L('排熱迴路溶液比熱', 'Rejection loop fluid specific heat'), Aval('glycol_cp_kj_kgk', 3.9), 'input', 'kJ/(kg·K)', L('乾冷器 / 閉式塔排熱迴路', 'Dry cooler / closed-tower rejection loops'), FMT.d4)));
                REF.g = X('basis', abs(3, kv(L('重力加速度', 'Gravitational acceleration'), 9.80665, 'input', 'm/s²', '', FMT.d4)));

                r++;
                r = section(ws, r, 7, L('B. 計算方法', 'B. Calculation Method'));
                const method = [
                    L('1. 逐時模擬：以典型氣象年逐時資料（8,760 h）計算各 DU / CorePOD 冷卻系統耗電；設備性能採 AHRI 雙二次曲線、親和定律與各冷卻架構之自然冷卻判定。',
                      '1. Hourly simulation: cooling power of each DU / CorePOD is computed for all 8,760 hours of the typical meteorological year, using AHRI bi-quadratic curves, affinity laws and per-architecture free-cooling logic.'),
                    L('2. 全廠功率 P(h) = IT + 配電損耗 + CDU/泵 + CRAH/風牆 + 排熱設備 + 冰機。', '2. Facility power P(h) = IT + electrical loss + CDU/pumps + CRAH/fanwall + heat rejection + chillers.'),
                    L('3. 年度 PUE = Σ P(h) ÷ Σ IT(h)（ISO/IEC 30134-2 之年度能源比）。', '3. Annual PUE = Σ P(h) ÷ Σ IT(h) (annual energy ratio per ISO/IEC 30134-2).'),
                    L('4. 冷卻 pPUE（含泵）= (Σ IT + Σ 冷卻耗電) ÷ Σ IT；pPUE（不含泵）與系統儀表板定義相同，排除 CDU 與水泵。', '4. Cooling pPUE (incl. pumps) = (Σ IT + Σ cooling power) ÷ Σ IT; pPUE (excl. pumps) matches the dashboard definition and excludes CDUs and pumps.'),
                    L('5. WUE = 年耗水量 (L) ÷ IT 年耗電 (kWh)。', '5. WUE = annual water use (L) ÷ annual IT energy (kWh).'),
                    L('6. 共用冷卻機房的耗電依各成員單元熱負載比例分攤。', '6. Shared cooling plant energy is allocated to member units in proportion to their heat load.'),
                    L('7. 本計算書的年度、月度與尖峰數值皆以公式由「11.附錄-8760逐時資料」加總，可在 Excel 中直接覆核；「9.驗證檢核」比對 Excel 重算值與計算引擎結果。', '7. Annual, monthly and peak values in this report are formulas summing "11.Appx-8760h Hourly Data" and can be re-checked in Excel; "9.Verification Checks" compares the Excel recalculation with the engine results.')
                ];
                method.forEach(t => { r = note(ws, r, 7, t); ws.getCell(r - 1, 1).font = fnt({ size: 9.5 }); });

                r++;
                r = section(ws, r, 7, L('C. 工程假設登錄表', 'C. Engineering Assumption Register'));
                r = header(ws, r, [L('參數代碼', 'Key'), L('說明', 'Description'), L('目前值', 'Current'), L('單位', 'Unit'), L('預設值', 'Default'), L('狀態', 'Status'), L('依據 / 參考', 'Basis / Reference')]);
                const defaultAssump = (typeof ASSUMPTIONS !== 'undefined') ? ASSUMPTIONS : ((typeof window !== 'undefined' && window.ASSUMPTIONS) ? window.ASSUMPTIONS : {});
                const overrides = state.assumptions_override || {};
                Object.keys(defaultAssump).forEach((k, idx) => {
                    const def = defaultAssump[k] || {};
                    const isOv = overrides[k] !== undefined && overrides[k] !== null;
                    const label = (EN && def.label_en) ? def.label_en : (def.label || k);
                    put(ws, r, 1, k, 'muted');
                    put(ws, r, 2, label, 'text', undefined, { wrap: true });
                    put(ws, r, 3, isOv ? overrides[k] : def.val, 'input', '0.####');
                    put(ws, r, 4, def.unit || '-', 'muted', undefined, { align: 'center' });
                    put(ws, r, 5, def.val, 'muted', '0.####');
                    put(ws, r, 6, isOv ? L('專案覆寫', 'Overridden') : L('預設', 'Default'), isOv ? 'bold' : 'muted', undefined, { align: 'center', fill: isOv ? C.warnBg : undefined });
                    put(ws, r, 7, getRefText(def, targetLang), 'muted', undefined, { wrap: true });
                    if (idx % 2 === 1) fillRow(ws, r, 1, 5, C.zebra);
                    ws.getRow(r).height = 30;
                    r++;
                });
            }

            // ═════════════════════════════════════════════════════════
            // 11. 附錄：8760 逐時資料（所有彙總的資料來源）
            // ═════════════════════════════════════════════════════════
            {
                const ws = S.hourly;
                const labels = [
                    L('序號', '#'), L('月', 'Mon'), L('日序', 'Day'), L('時', 'Hr'), 'DB °C', 'WB °C',
                    L('液冷迴路模式', 'Liquid-loop mode'), L('氣冷迴路模式', 'Air-loop mode'),
                    'IT kW', L('CDU/泵 kW', 'CDU/Pump kW'), L('CRAH/風牆 kW', 'CRAH/Fan kW'), L('排熱 kW', 'Heat rej. kW'),
                    L('冰機 kW', 'Chiller kW'), L('配電損耗 kW', 'Elec. loss kW'), L('冷卻小計 kW', 'Cooling kW'),
                    L('全廠總功率 kW', 'Facility kW'), 'PUE', L('耗水 m³', 'Water m³')
                ];
                // 欄位樣式必須先設定：ExcelJS 設定欄樣式時會覆寫該欄既有儲存格（含標題、表頭）
                const colStyle = (c, kind, numFmt) => {
                    const col = ws.getColumn(c);
                    col.font = STYLE[kind];
                    if (numFmt) col.numFmt = numFmt;
                    col.alignment = { vertical: 'middle', horizontal: (c === 7 || c === 8) ? 'left' : 'right', indent: (c === 7 || c === 8) ? 1 : 0 };
                };
                [[1, 'muted', FMT.int], [2, 'input', '0'], [3, 'input', '0'], [4, 'input', '0'], [5, 'input', FMT.temp], [6, 'input', FMT.temp],
                    [7, 'input'], [8, 'input'], [9, 'input', FMT.d1], [10, 'input', FMT.d1], [11, 'input', FMT.d1], [12, 'input', FMT.d1],
                    [13, 'input', FMT.d1], [14, 'formula', FMT.d1], [15, 'formula', FMT.d1], [16, 'formula', FMT.d1], [17, 'formula', FMT.pue], [18, 'input', FMT.d4]]
                    .forEach(([c, k, f]) => colStyle(c, k, f));
                titleBlock(ws, 18, L('附錄：8,760 小時逐時模擬資料（全廠）', 'Appendix: 8,760-Hour Simulation Data (Facility)'));
                header(ws, 3, labels);
                const lossRef = REF.loss;
                for (let i = 0; i < 8760; i++) {
                    const x = H[i];
                    const r = HR0 + i;
                    ws.getRow(r).values = [
                        i + 1, x.m, x.d, x.hh, x.db, x.wb, x.lm, x.am, x.it, x.cdu, x.crah, x.hr, x.ch,
                        F(`I${r}*${lossRef}/100`, x.loss),
                        F(`SUM(J${r}:M${r})`, x.cool),
                        F(`I${r}+N${r}+O${r}`, x.tot),
                        F(`IF(I${r}>0,P${r}/I${r},0)`, x.pue),
                        x.water
                    ];
                }
                ws.autoFilter = { from: 'A3', to: 'R3' };
            }

            // ═════════════════════════════════════════════════════════
            // 4. IT 負載明細
            // ═════════════════════════════════════════════════════════
            {
                const ws = S.it;
                let r = titleBlock(ws, 12, L('IT 負載明細與液冷 / 氣冷熱負載拆分', 'IT Load Schedule and Liquid / Air Heat Split'));
                r = section(ws, r, 12, L('A. 設備明細（數量 × 單機功耗）', 'A. Equipment Schedule (quantity × unit power)'));
                r = header(ws, r, [L('機房', 'Hall'), L('單元', 'Unit'), 'SU', L('類別', 'Type'), L('機櫃 / 設備型號', 'Rack / Model'), L('數量', 'Qty'),
                    L('單機 kW', 'kW / unit'), L('液冷 %', 'Liquid %'), L('氣冷 %', 'Air %'), L('IT 功率 kW', 'IT kW'), L('液冷熱 kW', 'Liquid kW'), L('氣冷熱 kW', 'Air kW'), L('列別', 'Row')]);
                const startItems = r;
                const subtotalCells = [];
                let totIt = 0, totLiq = 0;
                const writeItem = (hallName, unitName, suName, eq) => {
                    const qty = Number(eq.qty || 1);
                    const kw = Number(eq.itLoadKw || 0);
                    const liqPct = Number(eq.liquidPct || 0);
                    const it = qty * kw;
                    const liq = it * liqPct / 100;
                    put(ws, r, 1, hallName, 'text');
                    put(ws, r, 2, unitName, 'text');
                    put(ws, r, 3, suName, 'text');
                    put(ws, r, 4, eq.category || '-', 'muted', undefined, { align: 'center' });
                    put(ws, r, 5, eq.model || '-', 'text');
                    put(ws, r, 6, qty, 'input', FMT.int);
                    put(ws, r, 7, kw, 'input', FMT.d1);
                    put(ws, r, 8, liqPct, 'input', FMT.d1);
                    put(ws, r, 9, F(`100-H${r}`, 100 - liqPct), 'formula', FMT.d1);
                    put(ws, r, 10, F(`F${r}*G${r}`, it), 'formula', FMT.d1);
                    put(ws, r, 11, F(`J${r}*H${r}/100`, liq), 'formula', FMT.d1);
                    put(ws, r, 12, F(`J${r}-K${r}`, it - liq), 'formula', FMT.d1);
                    put(ws, r, 13, 1, 'muted', '0', { align: 'center' });
                    r++;
                    return { it, liq };
                };
                const writeSubtotal = (label, first, last, it, liq) => {
                    span(ws, r, 1, 9, label, 'bold');
                    put(ws, r, 10, F(`SUM(J${first}:J${last})`, it), 'formula', FMT.d1);
                    put(ws, r, 11, F(`SUM(K${first}:K${last})`, liq), 'formula', FMT.d1);
                    put(ws, r, 12, F(`SUM(L${first}:L${last})`, it - liq), 'formula', FMT.d1);
                    put(ws, r, 13, 0, 'muted', '0', { align: 'center' });
                    fillRow(ws, r, 1, 13, C.total);
                    boldRow(ws, r, 10, 12);
                    subtotalCells.push(r);
                    r++;
                };
                halls.forEach(h => (h.dus || []).forEach(du => {
                    const first = r;
                    let it = 0, liq = 0;
                    (du.sus || []).forEach(su => (su.equipment || []).forEach(eq => {
                        const v = writeItem(h.name, du.name, su.name, eq);
                        it += v.it; liq += v.liq;
                    }));
                    if (r > first) {
                        writeSubtotal(`${L('小計', 'Subtotal')}  ${du.name}`, first, r - 1, it, liq);
                        totIt += it; totLiq += liq;
                    }
                }));
                pods.forEach(p => {
                    const first = r;
                    let it = 0, liq = 0;
                    (p.equipment || []).forEach(eq => {
                        const v = writeItem('CorePOD', p.name, '-', eq);
                        it += v.it; liq += v.liq;
                    });
                    if (r > first) {
                        writeSubtotal(`${L('小計', 'Subtotal')}  ${p.name}`, first, r - 1, it, liq);
                        totIt += it; totLiq += liq;
                    }
                });
                const lastItem = r - 1;
                const totRow = r;
                span(ws, r, 1, 9, L('全廠合計（僅加總設備列，列別 = 1）', 'Facility total (equipment rows only, Row = 1)'), 'bold');
                put(ws, r, 10, F(`SUMIF(M${startItems}:M${lastItem},1,J${startItems}:J${lastItem})`, totIt), 'formula', FMT.d1);
                put(ws, r, 11, F(`SUMIF(M${startItems}:M${lastItem},1,K${startItems}:K${lastItem})`, totLiq), 'formula', FMT.d1);
                put(ws, r, 12, F(`SUMIF(M${startItems}:M${lastItem},1,L${startItems}:L${lastItem})`, totIt - totLiq), 'formula', FMT.d1);
                put(ws, r, 13, null, 'muted');
                fillRow(ws, r, 1, 13, C.brandSoft);
                boldRow(ws, r, 10, 12);
                r += 2;

                r = section(ws, r, 12, L('B. 熱負載彙總', 'B. Heat Load Summary'));
                r = header(ws, r, [L('項目', 'Item'), '', '', '', L('計算式', 'Formula'), '', '', '', '', L('數值', 'Value'), L('單位', 'Unit'), '']);
                merge(ws, r - 1, 1, 4); merge(ws, r - 1, 5, 9);
                const sumRow = (label, formulaText, f, fmt, unit) => {
                    span(ws, r, 1, 4, label, 'bold');
                    span(ws, r, 5, 9, formulaText, 'muted');
                    put(ws, r, 10, f, 'formula', fmt);
                    put(ws, r, 11, unit, 'muted', undefined, { align: 'center' });
                    put(ws, r, 12, null);
                    return r++;
                };
                REF.itKw = X('it', abs(10, sumRow(L('全廠 IT 功率', 'Facility IT power'), L('= 設備表合計', '= equipment total'), F(`J${totRow}`, totIt), FMT.d1, 'kW')));
                REF._itKw = totIt;
                REF.liqKw = X('it', abs(10, sumRow(L('液冷熱負載', 'Liquid heat load'), L('= Σ IT × 液冷 %', '= Σ IT × liquid %'), F(`K${totRow}`, totLiq), FMT.d1, 'kW')));
                sumRow(L('氣冷熱負載（IT）', 'Air heat load (IT)'), L('= Σ IT × 氣冷 %', '= Σ IT × air %'), F(`L${totRow}`, totIt - totLiq), FMT.d1, 'kW');
                sumRow(L('液冷比例', 'Liquid share'), L('= 液冷熱 ÷ IT', '= liquid ÷ IT'), F(`IF(J${totRow}>0,K${totRow}/J${totRow},0)`, totIt > 0 ? totLiq / totIt : 0), FMT.pct1, '-');
                const lossRow = sumRow(L('配電損耗（熱量計入氣冷負載）', 'Electrical loss (heat added to air load)'), L('= IT × 配電損耗率', '= IT × loss ratio'), F(`J${totRow}*${REF.loss}/100`, totIt * lossPct / 100), FMT.d1, 'kW');
                sumRow(L('需排除總熱量', 'Total heat to remove'), L('= IT + 配電損耗', '= IT + loss'), F(`J${totRow}+J${lossRow}`, totIt * (1 + lossPct / 100)), FMT.d1, 'kW');
                r = note(ws, r + 1, 12, L('「列別」欄：1 = 設備列、0 = 小計列；全廠合計以 SUMIF 只加總設備列，避免小計重複計入。',
                    '"Row" column: 1 = equipment row, 0 = subtotal row; the facility total uses SUMIF over equipment rows only to avoid double counting subtotals.'));
                ws.views = [{ state: 'frozen', ySplit: 6, showGridLines: false }];
            }

            // ═════════════════════════════════════════════════════════
            // 6. 能耗與 PUE / WUE
            // ═════════════════════════════════════════════════════════
            {
                const ws = S.energy;
                let r = titleBlock(ws, 15, L('年度能耗、PUE 與 WUE 計算', 'Annual Energy, PUE and WUE'));
                r = section(ws, r, 15, L('A. 全廠年度能耗（由逐時資料加總）', 'A. Facility Annual Energy (summed from hourly data)'));
                r = header(ws, r, [L('項目', 'Item'), L('年耗電 MWh', 'Annual MWh'), L('佔全廠', 'Share'), L('計算式', 'Formula'), '', '', '', L('引擎結果 MWh', 'Engine MWh'), L('差異 MWh', 'Diff MWh')]);
                merge(ws, r - 1, 4, 7);
                const engMwh = (k) => Number(bk[k] || 0) / 1000;
                const E = {};
                const rowsA = [
                    ['it', L('IT 設備', 'IT equipment'), 'I', ANN.it, engMwh('it')],
                    ['cdu', L('CDU 與水泵', 'CDUs and pumps'), 'J', ANN.cdu, engMwh('cduPump')],
                    ['crah', L('CRAH / 風牆風扇', 'CRAH / fanwall fans'), 'K', ANN.crah, engMwh('crahFan')],
                    ['hr', L('排熱設備（冷卻塔 / 乾冷器 / 絕熱塔）', 'Heat rejection (towers / dry coolers)'), 'L', ANN.hr, engMwh('heatRejection')],
                    ['ch', L('冰機壓縮機', 'Chiller compressors'), 'M', ANN.ch, engMwh('chiller')],
                    ['loss', L('配電損耗', 'Electrical loss'), 'N', ANN.loss, engMwh('loss')]
                ];
                const firstA = r;
                const totalRowA = firstA + rowsA.length + 1;
                rowsA.forEach(([k, label, col, v, eng]) => {
                    E[k] = r;
                    put(ws, r, 1, label, 'bold');
                    put(ws, r, 2, F(`SUM(${hR(col)})/1000`, v / 1000), 'link', FMT.d1);
                    put(ws, r, 3, F(`IF($B$${totalRowA}>0,B${r}/$B$${totalRowA},0)`, ANN.tot > 0 ? v / ANN.tot : 0), 'formula', FMT.pct1);
                    span(ws, r, 4, 7, L(`= Σ 逐時 ${col} 欄 ÷ 1000`, `= Σ hourly column ${col} ÷ 1000`), 'muted');
                    put(ws, r, 8, eng, 'input', FMT.d1);
                    put(ws, r, 9, F(`B${r}-H${r}`, v / 1000 - eng), 'formula', FMT.signed);
                    r++;
                });
                E.cool = r;
                const engCool = engMwh('cduPump') + engMwh('crahFan') + engMwh('heatRejection') + engMwh('chiller');
                put(ws, r, 1, L('冷卻系統小計', 'Cooling subtotal'), 'bold');
                put(ws, r, 2, F(`SUM(B${E.cdu}:B${E.ch})`, ANN.cool / 1000), 'formula', FMT.d1);
                put(ws, r, 3, F(`IF($B$${totalRowA}>0,B${r}/$B$${totalRowA},0)`, ANN.tot > 0 ? ANN.cool / ANN.tot : 0), 'formula', FMT.pct1);
                span(ws, r, 4, 7, L('= CDU/泵 + CRAH + 排熱 + 冰機', '= CDU/pumps + CRAH + heat rejection + chillers'), 'muted');
                put(ws, r, 8, engCool, 'input', FMT.d1);
                put(ws, r, 9, F(`B${r}-H${r}`, ANN.cool / 1000 - engCool), 'formula', FMT.signed);
                fillRow(ws, r, 1, 9, C.total);
                r++;
                E.tot = r;
                const engTot = engMwh('it') + engMwh('loss') + engCool;
                put(ws, r, 1, L('全廠合計', 'Facility total'), 'bold');
                put(ws, r, 2, F(`B${E.it}+B${E.loss}+B${E.cool}`, ANN.tot / 1000), 'formula', FMT.d1);
                put(ws, r, 3, F(`IF($B$${totalRowA}>0,B${r}/$B$${totalRowA},0)`, 1), 'formula', FMT.pct1);
                span(ws, r, 4, 7, L('= IT + 配電損耗 + 冷卻小計', '= IT + loss + cooling'), 'muted');
                put(ws, r, 8, engTot, 'input', FMT.d1);
                put(ws, r, 9, F(`B${r}-H${r}`, ANN.tot / 1000 - engTot), 'formula', FMT.signed);
                fillRow(ws, r, 1, 9, C.brandSoft);
                boldRow(ws, r, 1, 3);
                r += 2;

                r = section(ws, r, 15, L('B. 能效指標', 'B. Efficiency Metrics'));
                r = header(ws, r, [L('指標', 'Metric'), L('Excel 計算值', 'Excel value'), L('單位', 'Unit'), L('計算式', 'Formula'), '', '', '', L('引擎結果', 'Engine'), L('差異', 'Diff')]);
                merge(ws, r - 1, 4, 7);
                const B = (k) => `B${E[k]}`;
                const kpi = (key, label, f, fmt, unit, formulaText, eng, diffFmt) => {
                    REF[key] = X('energy', abs(2, r));
                    put(ws, r, 1, label, 'bold');
                    put(ws, r, 2, f, 'formula', fmt);
                    put(ws, r, 3, unit, 'muted', undefined, { align: 'center' });
                    span(ws, r, 4, 7, formulaText, 'muted');
                    if (eng === null || eng === undefined) {
                        put(ws, r, 8, NA_TXT, 'muted', undefined, { align: 'center' });
                        put(ws, r, 9, NA_TXT, 'muted', undefined, { align: 'center' });
                    } else {
                        put(ws, r, 8, eng, 'input', fmt);
                        put(ws, r, 9, F(`B${r}-H${r}`, f.result - eng), 'formula', diffFmt || FMT.signed4);
                    }
                    REF[key + 'Eng'] = X('energy', abs(8, r));
                    r++;
                };
                const pue = ANN.tot / ANN.it;
                const ppueIncl = (ANN.it + ANN.cool) / ANN.it;
                const ppueExcl = (ANN.it + ANN.crah + ANN.hr + ANN.ch) / ANN.it;
                kpi('pue', L('年度 PUE', 'Annual PUE'), F(`IF(${B('it')}>0,${B('tot')}/${B('it')},0)`, pue), FMT.pue, '-', L('= 全廠合計 ÷ IT', '= facility total ÷ IT'), overall.annualPue);
                kpi('ppueIncl', L('冷卻 pPUE（含泵）', 'Cooling pPUE (incl. pumps)'), F(`IF(${B('it')}>0,(${B('it')}+${B('cool')})/${B('it')},0)`, ppueIncl), FMT.pue, '-', L('= (IT + 冷卻小計) ÷ IT', '= (IT + cooling) ÷ IT'), null);
                kpi('ppueExcl', L('冷卻 pPUE（不含泵，儀表板定義）', 'Cooling pPUE (excl. pumps, dashboard)'), F(`IF(${B('it')}>0,(${B('it')}+${B('crah')}+${B('hr')}+${B('ch')})/${B('it')},0)`, ppueExcl), FMT.pue, '-', L('= (IT + CRAH + 排熱 + 冰機) ÷ IT', '= (IT + CRAH + heat rej. + chillers) ÷ IT'), overall.annualP_Pue);
                kpi('clf', L('冷卻負載係數 CLF', 'Cooling load factor CLF'), F(`IF(${B('it')}>0,${B('cool')}/${B('it')},0)`, ANN.cool / ANN.it), FMT.d4, '-', L('= 冷卻小計 ÷ IT', '= cooling ÷ IT'), null);
                kpi('elf', L('配電損耗係數 ELF', 'Electrical loss factor ELF'), F(`IF(${B('it')}>0,${B('loss')}/${B('it')},0)`, ANN.loss / ANN.it), FMT.d4, '-', L('= 配電損耗 ÷ IT', '= loss ÷ IT'), null);
                kpi('water', L('年耗水量', 'Annual water use'), F(`SUM(${hR('R')})`, ANN.water), FMT.int, 'm³', L('= Σ 逐時 R 欄', '= Σ hourly column R'), Number(overall.annualWaterM3 ?? 0), FMT.signed);
                kpi('wue', 'WUE', F(`IF(${B('it')}>0,${REF.water.split('!')[1]}/${B('it')},0)`, ANN.water / (ANN.it / 1000)), FMT.d4, 'L/kWh', L('= 年耗水 (m³) ÷ IT 年耗電 (MWh)，單位等同 L/kWh', '= water (m³) ÷ IT energy (MWh), equivalent to L/kWh'), Number(overall.annualWue ?? 0));
                REF.annTotMwh = X('energy', abs(2, E.tot));
                REF.annItMwh = X('energy', abs(2, E.it));
                REF.annLossMwh = X('energy', abs(2, E.loss));
                REF.annCoolMwh = X('energy', abs(2, E.cool));
                REF.annTotEng = X('energy', abs(8, E.tot));
                REF.annLossEng = X('energy', abs(8, E.loss));
                REF.annCoolEng = X('energy', abs(8, E.cool));
                r++;

                r = section(ws, r, 15, L('C. 各單元能耗（計算引擎逐單元結果）', 'C. Energy by Unit (engine results per unit)'));
                r = header(ws, r, [L('單元', 'Unit'), L('機房', 'Hall'), 'IT kW', 'IT MWh', L('CDU/泵 MWh', 'CDU/Pump MWh'), L('CRAH MWh', 'CRAH MWh'), L('排熱 MWh', 'Heat rej. MWh'),
                    L('冰機 MWh', 'Chiller MWh'), L('損耗 MWh', 'Loss MWh'), L('冷卻小計 MWh', 'Cooling MWh'), L('全廠 MWh', 'Total MWh'), 'PUE', L('耗水 m³', 'Water m³'), 'WUE', L('共用冷卻機房', 'Shared plant')]);
                const plantName = (id) => (plants.find(p => p.id === id)?.name) || '';
                const firstC = r;
                byUnits.forEach((u, idx) => {
                    const cool = (u.cduPumpMwh || 0) + (u.crahFanMwh || 0) + (u.heatRejectionMwh || 0) + (u.chillerMwh || 0);
                    const tot = (u.annualItMwh || 0) + (u.lossMwh || 0) + cool;
                    put(ws, r, 1, u.duName || u.podName || '-', 'bold');
                    put(ws, r, 2, u.hallName || 'CorePOD', 'muted');
                    put(ws, r, 3, Number(u.totalItKw || 0), 'input', FMT.d1);
                    put(ws, r, 4, Number(u.annualItMwh || 0), 'input', FMT.int);
                    put(ws, r, 5, Number(u.cduPumpMwh || 0), 'input', FMT.int);
                    put(ws, r, 6, Number(u.crahFanMwh || 0), 'input', FMT.int);
                    put(ws, r, 7, Number(u.heatRejectionMwh || 0), 'input', FMT.int);
                    put(ws, r, 8, Number(u.chillerMwh || 0), 'input', FMT.int);
                    put(ws, r, 9, Number(u.lossMwh || 0), 'input', FMT.int);
                    put(ws, r, 10, F(`SUM(E${r}:H${r})`, cool), 'formula', FMT.int);
                    put(ws, r, 11, F(`D${r}+I${r}+J${r}`, tot), 'formula', FMT.int);
                    put(ws, r, 12, F(`IF(D${r}>0,K${r}/D${r},0)`, u.annualItMwh > 0 ? tot / u.annualItMwh : 0), 'formula', FMT.pue);
                    put(ws, r, 13, Number(u.annualWaterM3 || 0), 'input', FMT.int);
                    put(ws, r, 14, F(`IF(D${r}>0,M${r}/D${r},0)`, u.annualItMwh > 0 ? (u.annualWaterM3 || 0) / u.annualItMwh : 0), 'formula', FMT.d4);
                    const pn = [u.liquidPlantId ? `${L('液冷', 'Liquid')}: ${plantName(u.liquidPlantId)}` : '', u.airPlantId ? `${L('氣冷', 'Air')}: ${plantName(u.airPlantId)}` : ''].filter(Boolean).join(' / ');
                    put(ws, r, 15, pn || L('獨立', 'Dedicated'), 'muted', undefined, { wrap: true });
                    if (idx % 2 === 1) fillRow(ws, r, 1, 15, C.zebra);
                    r++;
                });
                const lastC = r - 1;
                const uSum = (f) => sumBy(byUnits, f);
                const uIt = uSum(u => u.annualItMwh || 0), uLoss = uSum(u => u.lossMwh || 0);
                const uCool = uSum(u => (u.cduPumpMwh || 0) + (u.crahFanMwh || 0) + (u.heatRejectionMwh || 0) + (u.chillerMwh || 0));
                const uWater = uSum(u => u.annualWaterM3 || 0);
                const totC = r;
                put(ws, r, 1, L('合計', 'Total'), 'bold');
                put(ws, r, 2, null);
                [[3, uSum(u => u.totalItKw || 0), FMT.d1], [4, uIt, FMT.int], [5, uSum(u => u.cduPumpMwh || 0), FMT.int], [6, uSum(u => u.crahFanMwh || 0), FMT.int],
                    [7, uSum(u => u.heatRejectionMwh || 0), FMT.int], [8, uSum(u => u.chillerMwh || 0), FMT.int], [9, uLoss, FMT.int], [10, uCool, FMT.int],
                    [11, uIt + uLoss + uCool, FMT.int], [13, uWater, FMT.int]]
                    .forEach(([c, v, f]) => put(ws, r, c, F(`SUM(${colL(c)}${firstC}:${colL(c)}${lastC})`, v), 'formula', f));
                put(ws, r, 12, F(`IF(D${r}>0,K${r}/D${r},0)`, uIt > 0 ? (uIt + uLoss + uCool) / uIt : 0), 'formula', FMT.pue);
                put(ws, r, 14, F(`IF(D${r}>0,M${r}/D${r},0)`, uIt > 0 ? uWater / uIt : 0), 'formula', FMT.d4);
                put(ws, r, 15, null);
                fillRow(ws, r, 1, 15, C.brandSoft);
                boldRow(ws, r, 1, 14);
                r++;
                put(ws, r, 1, L('與逐時加總差異（MWh）', 'Diff vs hourly sum (MWh)'), 'muted');
                put(ws, r, 2, null);
                put(ws, r, 3, null);
                [[4, 'it', uIt, ANN.it], [5, 'cdu', uSum(u => u.cduPumpMwh || 0), ANN.cdu], [6, 'crah', uSum(u => u.crahFanMwh || 0), ANN.crah],
                    [7, 'hr', uSum(u => u.heatRejectionMwh || 0), ANN.hr], [8, 'ch', uSum(u => u.chillerMwh || 0), ANN.ch], [9, 'loss', uLoss, ANN.loss],
                    [10, 'cool', uCool, ANN.cool], [11, 'tot', uIt + uLoss + uCool, ANN.tot]]
                    .forEach(([c, k, uv, av]) => put(ws, r, c, F(`${colL(c)}${totC}-B${E[k]}`, uv - av / 1000), 'formula', FMT.signed));
                [12, 13, 14, 15].forEach(c => put(ws, r, c, null));
                REF.unitTotMwh = X('energy', abs(11, totC));
                REF.nUnits = byUnits.length;
                r++;
                r = note(ws, r + 1, 15, L('C 表為計算引擎逐單元輸出（MWh 已四捨五入至整數）；共用冷卻機房的能耗已依熱負載比例分攤到各成員單元。合計與 A 表的差異應僅為進位誤差。',
                    'Table C lists engine output per unit (MWh rounded to integers); shared plant energy is already allocated to member units by heat load. Differences from table A should be rounding only.'));
            }

            // ═════════════════════════════════════════════════════════
            // 7. 月度趨勢
            // ═════════════════════════════════════════════════════════
            {
                const ws = S.monthly;
                let r = titleBlock(ws, 17, L('月度能耗與 PUE 趨勢（由逐時資料加總）', 'Monthly Energy and PUE (summed from hourly data)'));
                r = header(ws, r, [L('月份', 'Month'), L('時數', 'Hours'), L('平均 DB °C', 'Avg DB °C'), L('最高 DB °C', 'Max DB °C'), L('平均 WB °C', 'Avg WB °C'),
                    'IT MWh', L('CDU/泵 MWh', 'CDU/Pump MWh'), L('CRAH MWh', 'CRAH MWh'), L('排熱 MWh', 'Heat rej. MWh'), L('冰機 MWh', 'Chiller MWh'), L('損耗 MWh', 'Loss MWh'),
                    L('冷卻小計 MWh', 'Cooling MWh'), L('全廠 MWh', 'Total MWh'), 'PUE', L('pPUE 含泵', 'pPUE incl.'), L('耗水 m³', 'Water m³'), 'WUE']);
                const first = r;
                const sumifH = (col, m) => `SUMIF(${hR('B')},A${m},${hR(col)})`;
                MON.forEach((m, i) => {
                    const cool = m.cdu + m.crah + m.hr + m.ch;
                    const tot = m.it + m.loss + cool;
                    put(ws, r, 1, i + 1, 'input', FMT.month, { align: 'center' });
                    put(ws, r, 2, F(`COUNTIF(${hR('B')},A${r})`, m.n), 'link', FMT.int);
                    put(ws, r, 3, F(`IF(B${r}>0,${sumifH('E', r)}/B${r},0)`, m.dbAvg), 'link', FMT.temp);
                    put(ws, r, 4, F(`MAX(${hMon('E', i)})`, m.dbMax), 'link', FMT.temp);
                    put(ws, r, 5, F(`IF(B${r}>0,${sumifH('F', r)}/B${r},0)`, m.wbAvg), 'link', FMT.temp);
                    put(ws, r, 6, F(`${sumifH('I', r)}/1000`, m.it / 1000), 'link', FMT.d1);
                    put(ws, r, 7, F(`${sumifH('J', r)}/1000`, m.cdu / 1000), 'link', FMT.d1);
                    put(ws, r, 8, F(`${sumifH('K', r)}/1000`, m.crah / 1000), 'link', FMT.d1);
                    put(ws, r, 9, F(`${sumifH('L', r)}/1000`, m.hr / 1000), 'link', FMT.d1);
                    put(ws, r, 10, F(`${sumifH('M', r)}/1000`, m.ch / 1000), 'link', FMT.d1);
                    put(ws, r, 11, F(`${sumifH('N', r)}/1000`, m.loss / 1000), 'link', FMT.d1);
                    put(ws, r, 12, F(`SUM(G${r}:J${r})`, cool / 1000), 'formula', FMT.d1);
                    put(ws, r, 13, F(`F${r}+K${r}+L${r}`, tot / 1000), 'formula', FMT.d1);
                    put(ws, r, 14, F(`IF(F${r}>0,M${r}/F${r},0)`, m.it > 0 ? tot / m.it : 0), 'formula', FMT.pue);
                    put(ws, r, 15, F(`IF(F${r}>0,(F${r}+L${r})/F${r},0)`, m.it > 0 ? (m.it + cool) / m.it : 0), 'formula', FMT.pue);
                    put(ws, r, 16, F(`${sumifH('R', r)}`, m.water), 'link', FMT.d1);
                    put(ws, r, 17, F(`IF(F${r}>0,P${r}/F${r},0)`, m.it > 0 ? m.water / (m.it / 1000) : 0), 'formula', FMT.d4);
                    if (i % 2 === 1) fillRow(ws, r, 1, 17, C.zebra);
                    r++;
                });
                const last = r - 1;
                const annCool = ANN.cool;
                put(ws, r, 1, L('全年', 'Year'), 'bold', undefined, { align: 'center' });
                put(ws, r, 2, F(`SUM(B${first}:B${last})`, 8760), 'formula', FMT.int);
                put(ws, r, 3, F(`AVERAGE(${hR('E')})`, sumBy(H, x => x.db) / 8760), 'link', FMT.temp);
                put(ws, r, 4, F(`MAX(${hR('E')})`, Math.max(...H.map(x => x.db))), 'link', FMT.temp);
                put(ws, r, 5, F(`AVERAGE(${hR('F')})`, sumBy(H, x => x.wb) / 8760), 'link', FMT.temp);
                [[6, ANN.it], [7, ANN.cdu], [8, ANN.crah], [9, ANN.hr], [10, ANN.ch], [11, ANN.loss], [12, annCool], [13, ANN.tot]]
                    .forEach(([c, v]) => put(ws, r, c, F(`SUM(${colL(c)}${first}:${colL(c)}${last})`, v / 1000), 'formula', FMT.d1));
                put(ws, r, 14, F(`IF(F${r}>0,M${r}/F${r},0)`, ANN.tot / ANN.it), 'formula', FMT.pue);
                put(ws, r, 15, F(`IF(F${r}>0,(F${r}+L${r})/F${r},0)`, (ANN.it + annCool) / ANN.it), 'formula', FMT.pue);
                put(ws, r, 16, F(`SUM(P${first}:P${last})`, ANN.water), 'formula', FMT.d1);
                put(ws, r, 17, F(`IF(F${r}>0,P${r}/F${r},0)`, ANN.water / (ANN.it / 1000)), 'formula', FMT.d4);
                fillRow(ws, r, 1, 17, C.brandSoft);
                boldRow(ws, r, 1, 17);
                REF.monTotMwh = X('monthly', abs(13, r));
                ws.addConditionalFormatting({
                    ref: `N${first}:N${last}`,
                    rules: [{ type: 'colorScale', priority: 1, cfvo: [{ type: 'min' }, { type: 'percentile', value: 50 }, { type: 'max' }], color: [{ argb: 'FFD9EAE3' }, { argb: 'FFFFF7D6' }, { argb: 'FFFAD4CF' }] }]
                });
                r = note(ws, r + 2, 17, L('月度數值以 SUMIF / COUNTIF 依「月」欄由 11.附錄-8760逐時資料加總，最高溫取該月連續列範圍的 MAX；PUE 欄以色階標示月份間的相對高低。',
                    'Monthly values are SUMIF / COUNTIF over the month column of 11.Appx-8760h Hourly Data; the maximum temperature is the MAX of that month\'s contiguous row range. The PUE column is colour-scaled to show the relative monthly variation.'));
                ws.views = [{ state: 'frozen', ySplit: 4, xSplit: 1, showGridLines: false }];
            }

            // ═════════════════════════════════════════════════════════
            // 3. 氣象與自由冷卻（運轉模式）
            // ═════════════════════════════════════════════════════════
            {
                const ws = S.weather;
                let r = titleBlock(ws, 11, L('氣象條件與冷卻系統運轉模式分析', 'Weather Conditions and Cooling Operating Modes'));
                r = section(ws, r, 11, L('A. 設計工況與典型氣象年極值', 'A. Design Conditions and TMY Extremes'));
                r = header(ws, r, [L('項目', 'Item'), L('數值', 'Value'), L('單位', 'Unit'), L('說明', 'Note'), '', '', '', '', '', '', '']);
                merge(ws, r - 1, 4, 11);
                const dbMax = Math.max(...H.map(x => x.db));
                const dbMin = Math.min(...H.map(x => x.db));
                const wbMax = Math.max(...H.map(x => x.wb));
                const dDb = Number(designCond.designDb ?? 0), dWb = Number(designCond.designWb ?? 0);
                const wRow = (label, f, kind, unit, noteText, fmt) => {
                    put(ws, r, 1, label, 'bold');
                    put(ws, r, 2, f, kind, fmt);
                    put(ws, r, 3, unit, 'muted', undefined, { align: 'center' });
                    span(ws, r, 4, 11, noteText, 'muted');
                    return r++;
                };
                wRow(L('設計乾球溫度', 'Design dry-bulb'), F(REF.designDb, dDb), 'link', '°C', enText(designCond.designBasis || ''), FMT.temp);
                wRow(L('設計濕球溫度', 'Design wet-bulb'), F(REF.designWb, dWb), 'link', '°C', enText(designCond.designBasis || ''), FMT.temp);
                wRow(L('典型氣象年最高乾球', 'TMY maximum dry-bulb'), F(`MAX(${hR('E')})`, dbMax), 'link', '°C', L('= 逐時 E 欄最大值', '= max of hourly column E'), FMT.temp);
                wRow(L('典型氣象年最低乾球', 'TMY minimum dry-bulb'), F(`MIN(${hR('E')})`, dbMin), 'link', '°C', L('= 逐時 E 欄最小值', '= min of hourly column E'), FMT.temp);
                wRow(L('典型氣象年最高濕球', 'TMY maximum wet-bulb'), F(`MAX(${hR('F')})`, wbMax), 'link', '°C', L('= 逐時 F 欄最大值', '= max of hourly column F'), FMT.temp);
                wRow(L('乾球高於設計值時數', 'Hours above design DB'), F(`COUNTIF(${hR('E')},">"&${REF.designDb})`, H.filter(x => x.db > dDb).length), 'link', 'h', L('典型氣象年中超過設計乾球的小時數', 'Hours in the TMY exceeding the design dry-bulb'), FMT.int);
                wRow(L('濕球高於設計值時數', 'Hours above design WB'), F(`COUNTIF(${hR('F')},">"&${REF.designWb})`, H.filter(x => x.wb > dWb).length), 'link', 'h', L('典型氣象年中超過設計濕球的小時數', 'Hours in the TMY exceeding the design wet-bulb'), FMT.int);
                r++;

                r = section(ws, r, 11, L('B. 逐月氣候與運轉模式時數', 'B. Monthly Climate and Operating-Mode Hours'));
                const ML = [MODE_TXT.free, MODE_TXT.partial, MODE_TXT.mechanical];
                r = header(ws, r, [L('月份', 'Month'), L('平均 DB °C', 'Avg DB °C'), L('最高 DB °C', 'Max DB °C'), L('最低 DB °C', 'Min DB °C'), L('平均 WB °C', 'Avg WB °C'),
                    `${L('液冷', 'Liquid')}\n${ML[0]}`, `${L('液冷', 'Liquid')}\n${ML[1]}`, `${L('液冷', 'Liquid')}\n${ML[2]}`,
                    `${L('氣冷', 'Air')}\n${ML[0]}`, `${L('氣冷', 'Air')}\n${ML[1]}`, `${L('氣冷', 'Air')}\n${ML[2]}`]);
                ws.getRow(r - 1).height = 40;
                const MODE_COLS = [[6, 'G', ML[0]], [7, 'G', ML[1]], [8, 'G', ML[2]], [9, 'H', ML[0]], [10, 'H', ML[1]], [11, 'H', ML[2]]];
                const firstM = r;
                MON.forEach((m, i) => {
                    put(ws, r, 1, i + 1, 'input', FMT.month, { align: 'center' });
                    put(ws, r, 2, F(`SUMIF(${hR('B')},A${r},${hR('E')})/COUNTIF(${hR('B')},A${r})`, m.dbAvg), 'link', FMT.temp);
                    put(ws, r, 3, F(`MAX(${hMon('E', i)})`, m.dbMax), 'link', FMT.temp);
                    put(ws, r, 4, F(`MIN(${hMon('E', i)})`, m.dbMin), 'link', FMT.temp);
                    put(ws, r, 5, F(`SUMIF(${hR('B')},A${r},${hR('F')})/COUNTIF(${hR('B')},A${r})`, m.wbAvg), 'link', FMT.temp);
                    MODE_COLS.map(([c, col, txt]) => [c, col, txt, col === 'G' ? m.lm : m.am]).forEach(([c, col, txt, cnt]) => {
                        const has = col === 'G' ? hasLiquid : hasAir;
                        if (has) put(ws, r, c, F(`COUNTIFS(${hR('B')},A${r},${hR(col)},"${txt}")`, cnt[txt] || 0), 'link', FMT.int);
                        else put(ws, r, c, NA_TXT, 'muted', undefined, { align: 'center' });
                    });
                    if (i % 2 === 1) fillRow(ws, r, 1, 11, C.zebra);
                    r++;
                });
                const lastM = r - 1;
                put(ws, r, 1, L('全年', 'Year'), 'bold', undefined, { align: 'center' });
                put(ws, r, 2, F(`AVERAGE(${hR('E')})`, sumBy(H, x => x.db) / 8760), 'link', FMT.temp);
                put(ws, r, 3, F(`MAX(C${firstM}:C${lastM})`, dbMax), 'formula', FMT.temp);
                put(ws, r, 4, F(`MIN(D${firstM}:D${lastM})`, dbMin), 'formula', FMT.temp);
                put(ws, r, 5, F(`AVERAGE(${hR('F')})`, sumBy(H, x => x.wb) / 8760), 'link', FMT.temp);
                const annMode = (col, txt) => H.filter(x => (col === 'G' ? x.lm : x.am) === txt).length;
                MODE_COLS.forEach(([c, col, txt]) => {
                    const has = col === 'G' ? hasLiquid : hasAir;
                    if (has) put(ws, r, c, F(`SUM(${colL(c)}${firstM}:${colL(c)}${lastM})`, annMode(col, txt)), 'formula', FMT.int);
                    else put(ws, r, c, NA_TXT, 'muted', undefined, { align: 'center' });
                });
                fillRow(ws, r, 1, 11, C.brandSoft);
                boldRow(ws, r, 1, 11);
                const yearRow = r;
                r++;
                put(ws, r, 1, L('佔全年比例', 'Share of year'), 'muted', undefined, { align: 'center' });
                for (let c = 2; c <= 5; c++) put(ws, r, c, null);
                MODE_COLS.forEach(([c, col, txt]) => {
                    const has = col === 'G' ? hasLiquid : hasAir;
                    if (has) put(ws, r, c, F(`${colL(c)}${yearRow}/8760`, annMode(col, txt) / 8760), 'formula', FMT.pct1);
                    else put(ws, r, c, NA_TXT, 'muted', undefined, { align: 'center' });
                });
                r++;
                const liqArchs = [...new Set(byUnits.filter(u => (u.liquidHeatKw || 0) > 0).map(u => archLabel(u.cduArchitecture)))];
                const airArchs = [...new Set(byUnits.filter(u => ((u.airHeatKw || 0) + (u.lossKw || 0)) > 0).map(u => archLabel(u.fwArchitecture)))];
                r = note(ws, r + 1, 11, L(
                    `運轉模式取自逐時模擬結果（多個單元時取最不利者）。液冷架構：${liqArchs.join('、') || '無'}；氣冷架構：${airArchs.join('、') || '無'}。「自然冷卻」= 冰機停機；「部分自然冷卻」= 預冷後由冰機補足；「機械製冷」= 冰機全載承擔。`,
                    `Operating modes come from the hourly simulation (worst case across units). Liquid architectures: ${liqArchs.join(', ') || 'none'}; air architectures: ${airArchs.join(', ') || 'none'}. "Free cooling" = chillers off; "Partial" = pre-cooling with chiller trim; "Mechanical" = chillers carry the full load.`));
                r++;

                r = section(ws, r, 11, L('C. 乾球溫度區間分析（Bin）', 'C. Dry-Bulb Bin Analysis'));
                r = header(ws, r, [L('區間下限 °C', 'Bin from °C'), L('區間上限 °C', 'Bin to °C'), L('時數', 'Hours'), L('佔比', 'Share'), L('累積佔比', 'Cumulative'), L('區間平均 PUE', 'Avg PUE in bin'), '', '', '', '', '']);
                const lo0 = Math.floor(dbMin / 2) * 2;
                const hiN = Math.floor(dbMax / 2) * 2 + 2;
                const firstB = r;
                for (let lo = lo0; lo < hiN; lo += 2) {
                    const inBin = H.filter(x => x.db >= lo && x.db < lo + 2);
                    const n = inBin.length;
                    put(ws, r, 1, lo, 'input', FMT.temp);
                    put(ws, r, 2, F(`A${r}+2`, lo + 2), 'formula', FMT.temp);
                    put(ws, r, 3, F(`COUNTIFS(${hR('E')},">="&A${r},${hR('E')},"<"&B${r})`, n), 'link', FMT.int);
                    put(ws, r, 4, F(`C${r}/8760`, n / 8760), 'formula', FMT.pct1);
                    const cum = H.filter(x => x.db < lo + 2).length;
                    put(ws, r, 5, F(`SUM(C$${firstB}:C${r})/8760`, cum / 8760), 'formula', FMT.pct1);
                    put(ws, r, 6, F(`IF(C${r}>0,SUMIFS(${hR('Q')},${hR('E')},">="&A${r},${hR('E')},"<"&B${r})/C${r},0)`, n ? sumBy(inBin, x => x.pue) / n : 0), 'link', FMT.pue);
                    for (let c = 7; c <= 11; c++) put(ws, r, c, null);
                    r++;
                }
                ws.addConditionalFormatting({
                    ref: `C${firstB}:C${r - 1}`,
                    rules: [{ type: 'dataBar', priority: 1, minLength: 0, maxLength: 100, cfvo: [{ type: 'min' }, { type: 'max' }], color: { argb: 'FF7FB8A4' } }]
                });
            }

            // ═════════════════════════════════════════════════════════
            // 5. 冷卻系統設計：系統參數、設備選型冗餘檢核、水力驗算
            // ═════════════════════════════════════════════════════════
            {
                const ws = S.sizing;
                const NC = 19;
                let r = titleBlock(ws, NC, L('冷卻系統設計參數、設備選型與水力驗算', 'Cooling System Parameters, Equipment Sizing and Hydraulic Check'));

                // 收集系統：共用機房 + 各單元
                const systems = [];
                plants.forEach(p => systems.push({
                    loc: _t('xls.sharedCentralPlant', {}, '中央主機房'),
                    name: (_t('xls.sharedPlantPrefix', {}, '【共用】') + p.name).trim(),
                    loop: p.loop, sys: p.system || {}, isPlant: true, plantName: ''
                }));
                const unitList = [];
                halls.forEach(h => (h.dus || []).forEach(d => unitList.push({ loc: h.name, name: d.name, pd: d.plantDesign || {} })));
                pods.forEach(p => unitList.push({ loc: 'CorePOD', name: p.name, pd: p.plantDesign || {} }));
                const plantOf = (id) => plants.find(p => p.id === id);
                unitList.forEach(u => {
                    const c = u.pd.cduSystem || {};
                    const f = u.pd.fanwallSystem || {};
                    systems.push({ loc: u.loc, name: u.name, loop: 'liquid', sys: c, isPlant: false, plantName: plantOf(c.plantId)?.name || '' });
                    systems.push({ loc: u.loc, name: u.name, loop: 'air', sys: f, isPlant: false, plantName: plantOf(f.plantId)?.name || '' });
                });
                const loopTxt = (loop) => loop === 'liquid' ? L('液冷 (CDU)', 'Liquid (CDU)') : L('氣冷 (CRAH)', 'Air (CRAH)');
                const sysTemps = (s) => s.loop === 'liquid'
                    ? [Number(s.sys.fwsSupplyC ?? 40), Number(s.sys.fwsReturnC ?? 55)]
                    : [Number(s.sys.chwSupplyC ?? 12), Number(s.sys.chwReturnC ?? 18)];
                const sysLoad = (s) => s.loop === 'liquid' ? Number(s.sys.designBasis?.liq_load_kw || 0) : Number(s.sys.designBasis?.air_load_kw || 0);

                r = section(ws, r, NC, L('A. 系統設計參數', 'A. System Design Parameters'));
                r = header(ws, r, [L('位置', 'Location'), L('單元 / 機房', 'Unit / Plant'), L('迴路', 'Loop'), L('冷卻架構', 'Architecture'), L('共用機房', 'Shared plant'),
                    L('供水 °C', 'Supply °C'), L('回水 °C', 'Return °C'), 'ΔT °C', L('設計熱負載 kW', 'Design load kW')]);
                const dtCell = new Map();
                systems.forEach((s, idx) => {
                    const [sup, ret] = sysTemps(s);
                    const load = sysLoad(s);
                    put(ws, r, 1, s.loc, 'muted');
                    put(ws, r, 2, s.name, 'bold');
                    put(ws, r, 3, loopTxt(s.loop), 'text');
                    put(ws, r, 4, archLabel(s.sys.architecture), 'text', undefined, { wrap: true });
                    put(ws, r, 5, s.plantName || (s.isPlant ? L('（本機房）', '(this plant)') : L('獨立', 'Dedicated')), 'muted');
                    put(ws, r, 6, sup, 'input', FMT.temp);
                    put(ws, r, 7, ret, 'input', FMT.temp);
                    put(ws, r, 8, F(`G${r}-F${r}`, ret - sup), 'formula', FMT.temp);
                    put(ws, r, 9, load, 'input', FMT.d1);
                    if (idx % 2 === 1) fillRow(ws, r, 1, 9, C.zebra);
                    ws.getRow(r).height = 28;
                    dtCell.set(s, { row: r, dt: ret - sup, load });
                    r++;
                });
                r++;

                r = section(ws, r, NC, L('B. 設備選型與冗餘檢核', 'B. Equipment Sizing and Redundancy Check'));
                r = header(ws, r, [L('位置', 'Location'), L('單元 / 機房', 'Unit / Plant'), L('系統', 'System'), L('設備', 'Equipment'), L('型號', 'Model'),
                    L('需求 kW', 'Required kW'), L('單機額定 kW', 'Rated kW / unit'), L('降額係數', 'Derate'), L('有效單機 kW', 'Effective kW / unit'), L('選定台數', 'Selected qty'),
                    L('冗餘', 'Redundancy'), L('備用台數', 'Standby'), L('運轉台數', 'Running'), L('有效容量 kW', 'Effective kW'), L('裕度', 'Margin'), L('最少台數', 'Min qty'), L('判定', 'Result')]);
                const firstS = r;
                let sizingFails = 0;
                const equipLabel = (item) => {
                    if (EN) {
                        const k = _t(`equip.${item.key}`, {}, '');
                        if (k && !/[一-龥]/.test(k)) return k;
                        return String(item.label || item.key || '').replace(/[一-龥（）]/g, '').replace(/\s{2,}/g, ' ').trim() || item.key;
                    }
                    return item.label || item.key;
                };
                const sizingRow = (loc, name, sysTxt, item) => {
                    const req = Number(item.requiredKw || 0);
                    const cap = Number(item.unitCapKw || 0);
                    const der = (typeof item.derateFactor === 'number' && item.derateFactor > 0) ? item.derateFactor : 1;
                    const qty = Number(item.selectedQty || 0);
                    const red = item.redundancy || 'N+1';
                    const standby = red === 'N' ? 0 : red === 'N+1' ? 1 : red === 'N+2' ? 2 : red === '2N' ? Math.ceil(qty / 2) : 1;
                    const run = Math.max(0, qty - standby);
                    const eff = run * cap * der;
                    const minQ = red === 'N' ? 1 : red === 'N+2' ? 3 : 2;
                    const ok = eff >= req && qty >= minQ;
                    const status = req <= 0 ? NA_TXT : (ok ? PASS : SHORT);
                    if (req > 0 && !ok) sizingFails++;
                    put(ws, r, 1, loc, 'muted');
                    put(ws, r, 2, name, 'text');
                    put(ws, r, 3, sysTxt, 'text');
                    put(ws, r, 4, equipLabel(item), 'text', undefined, { wrap: true });
                    put(ws, r, 5, item.selectedModel || L('（未選型）', '(not selected)'), 'text', undefined, { wrap: true });
                    put(ws, r, 6, req, 'input', FMT.d1);
                    put(ws, r, 7, cap, 'input', FMT.d1);
                    put(ws, r, 8, der, 'input', FMT.pue);
                    put(ws, r, 9, F(`G${r}*H${r}`, cap * der), 'formula', FMT.d1);
                    put(ws, r, 10, qty, 'input', FMT.int, { align: 'center' });
                    put(ws, r, 11, red, 'input', undefined, { align: 'center' });
                    put(ws, r, 12, F(`IF(K${r}="N",0,IF(K${r}="N+1",1,IF(K${r}="N+2",2,IF(K${r}="2N",ROUNDUP(J${r}/2,0),1))))`, standby), 'formula', FMT.int);
                    put(ws, r, 13, F(`MAX(0,J${r}-L${r})`, run), 'formula', FMT.int);
                    put(ws, r, 14, F(`M${r}*I${r}`, eff), 'formula', FMT.d1);
                    put(ws, r, 15, F(`IF(F${r}>0,N${r}/F${r}-1,0)`, req > 0 ? eff / req - 1 : 0), 'formula', FMT.signedPct);
                    put(ws, r, 16, F(`IF(K${r}="N",1,IF(K${r}="N+2",3,2))`, minQ), 'formula', FMT.int);
                    put(ws, r, 17, F(`IF(F${r}<=0,"${NA_TXT}",IF(AND(N${r}>=F${r},J${r}>=P${r}),"${PASS}","${SHORT}"))`, status), 'formula', undefined, { align: 'center' });
                    ws.getRow(r).height = 28;
                    r++;
                };
                const sysCat = (loop) => loop === 'liquid' ? _t('xls.cduSysCategory', {}, 'CDU液冷系統') : _t('xls.fwSysCategory', {}, '氣冷排熱系統');
                plants.forEach(p => (p.system?.sizing || []).forEach(item => sizingRow(_t('xls.sharedCentralPlant', {}, '中央主機房'), (_t('xls.sharedPlantPrefix', {}, '【共用】') + p.name).trim(), sysCat(p.loop), item)));
                if (plants.length > 0) {
                    span(ws, r, 1, NC, _t('xls.plantAllocationNote', {}, '※ 註：共用冷卻系統主機房設備能耗依各成員單元熱負載比例自動分攤'), 'note');
                    r++;
                }
                unitList.forEach(u => {
                    let cdu = u.pd.cduSystem?.sizing || [];
                    let fw = u.pd.fanwallSystem?.sizing || [];
                    if (u.pd.cduSystem?.plantId) cdu = cdu.filter(it => it.role === 'terminal' || it.key === 'cdu_unit');
                    if (u.pd.fanwallSystem?.plantId) fw = fw.filter(it => it.role === 'terminal' || it.key === 'crah_unit' || it.key === 'rdhx_unit');
                    cdu.forEach(item => sizingRow(u.loc, u.name, sysCat('liquid'), item));
                    fw.forEach(item => sizingRow(u.loc, u.name, sysCat('air'), item));
                });
                const lastS = r - 1;
                statusCF(ws, `Q${firstS}:Q${Math.max(firstS, lastS)}`);
                REF.sizingStatus = `${qn(SN.sizing)}!$Q$${firstS}:$Q$${Math.max(firstS, lastS)}`;
                REF._sizingFails = sizingFails;
                r = note(ws, r, NC, L('判定規則：運轉台數 = 選定台數 − 備用台數（N:0、N+1:1、N+2:2、2N:台數÷2 進位）；有效容量 = 運轉台數 × 單機額定 × 降額係數；需「有效容量 ≥ 需求」且「選定台數 ≥ 最少台數」才通過。水泵列的需求為水力計算之泵電功率，單機額定為馬達額定功率。可直接修改藍字欄位試算。',
                    'Rule: running = selected − standby (N:0, N+1:1, N+2:2, 2N: qty÷2 rounded up); effective capacity = running × rated × derate; PASS requires effective ≥ required and selected ≥ minimum qty. For pumps, "required" is the hydraulic pump power and "rated" is the motor rating. Blue cells can be edited for what-if checks.'));
                r++;

                r = section(ws, r, NC, L('C. 泵組水力計算與選型（泵電功率 = 流量 × 揚程 × g ÷ 效率）', 'C. Pump Hydraulics and Selection (pump power = flow × head × g ÷ efficiency)'));
                r = header(ws, r, [L('單元 / 機房', 'Unit / Plant'), L('泵組', 'Pump group'), L('迴路熱負載 kW', 'Loop heat kW'), L('負載係數', 'Load factor'), L('比熱 kJ/kg·K', 'cp kJ/kg·K'), 'ΔT °C',
                    L('流量 LPM', 'Flow LPM'), L('管徑 DN', 'Pipe DN'), L('流速 m/s', 'Velocity m/s'), L('揚程 m', 'Head m'), L('泵效率', 'Pump η'), L('馬達效率', 'Motor η'),
                    L('泵電功率 kW', 'Pump kW'), L('引擎值 kW', 'Engine kW'), L('差異', 'Diff'), L('運轉台數', 'Running'), L('型錄流量 m³/h·台', 'Catalog m³/h each'), L('型錄揚程 m', 'Catalog head m'), L('選型判定', 'Selection')]);
                const firstHy = r;
                const g = 9.80665;
                const cpG = Aval('glycol_cp_kj_kgk', 3.9);
                let pumpSelFails = 0;
                systems.forEach(s => {
                    if (!s.isPlant && s.plantName) return; // 成員單元的泵由共用機房統一計算
                    const load = sysLoad(s);
                    const pumps = s.sys.hydraulics?.pumps || [];
                    if (!(load > 0) || !pumps.length) return;
                    const info = dtCell.get(s);
                    const loopDt = Math.max(1, info.dt);
                    pumps.forEach(p => {
                        const factor = p.q_kw / load;
                        const isGly = Math.abs(p.cp - cpG) < 1e-9;
                        const dn = parseInt(String(p.pipe_dn || '').replace(/\D/g, ''), 10) || 0;
                        const flow = p.q_kw * 60 / (p.cp * p.dt_c);
                        const vel = dn > 0 ? flow / 60000 / (Math.PI * (dn / 1000) ** 2 / 4) : 0;
                        const kw = flow * p.head_m * g / (60000 * p.eta_pump * p.eta_motor);
                        const item = (s.sys.sizing || []).find(it => it.key === p.key);
                        const cat = item ? (item.catalog || []).find(c => c.model === item.selectedModel) : null;
                        const catFlow = Number(cat?.designFlowM3h || cat?.design_flow_m3h || 0);
                        const catHead = Number(cat?.designHeadM || cat?.design_head_m || 0);
                        const running = item?.pumpChecks?.active ?? 0;
                        const selOk = running * catFlow >= flow * 0.06 - 1e-9 && catHead >= p.head_m - 1e-9;
                        const selTxt = (catFlow > 0 && catHead > 0) ? (selOk ? PASS : SHORT) : NA_TXT;
                        if (selTxt === SHORT) pumpSelFails++;
                        put(ws, r, 1, s.name, 'text');
                        put(ws, r, 2, _t(p.labelKey, {}, p.key), 'text', undefined, { wrap: true });
                        const sameDt = Math.abs(p.dt_c - loopDt) < 1e-9;
                        put(ws, r, 3, F(`I${info.row}`, load), 'formula', FMT.d1);
                        put(ws, r, 4, factor, Math.abs(factor - 1) < 1e-12 ? 'muted' : 'input', FMT.d4);
                        put(ws, r, 5, F(isGly ? REF.cpGlycol : REF.cpWater, p.cp), 'link', FMT.d4);
                        put(ws, r, 6, sameDt ? F(`MAX(1,H${info.row})`, loopDt) : p.dt_c, sameDt ? 'formula' : 'input', FMT.temp);
                        put(ws, r, 7, F(`IF(E${r}*F${r}>0,C${r}*D${r}*60/(E${r}*F${r}),0)`, flow), 'formula', FMT.int);
                        put(ws, r, 8, dn, 'input', '0');
                        put(ws, r, 9, F(`IF(H${r}>0,G${r}/60000/(PI()*(H${r}/1000)^2/4),0)`, vel), 'formula', FMT.d2);
                        put(ws, r, 10, p.head_m, 'input', FMT.d1);
                        put(ws, r, 11, p.eta_pump, 'input', FMT.pue);
                        put(ws, r, 12, p.eta_motor, 'input', FMT.pue);
                        put(ws, r, 13, F(`IF(K${r}*L${r}>0,G${r}*J${r}*${REF.g}/(60000*K${r}*L${r}),0)`, kw), 'formula', FMT.d2);
                        put(ws, r, 14, p.power_kw, 'input', FMT.d2);
                        put(ws, r, 15, F(`IF(N${r}>0,ABS(M${r}/N${r}-1),0)`, p.power_kw > 0 ? Math.abs(kw / p.power_kw - 1) : 0), 'formula', FMT.pct2);
                        put(ws, r, 16, running, 'input', FMT.int, { align: 'center' });
                        put(ws, r, 17, catFlow, 'input', FMT.d1);
                        put(ws, r, 18, catHead, 'input', FMT.d1);
                        put(ws, r, 19, F(`IF(Q${r}*R${r}=0,"${NA_TXT}",IF(AND(P${r}*Q${r}>=G${r}*0.06,R${r}>=J${r}),"${PASS}","${SHORT}"))`, selTxt), 'formula', undefined, { align: 'center' });
                        ws.getRow(r).height = 28;
                        r++;
                    });
                });
                if (r > firstHy) {
                    REF.hydDiff = `${qn(SN.sizing)}!$O$${firstHy}:$O$${r - 1}`;
                    REF.pumpSelStatus = `${qn(SN.sizing)}!$S$${firstHy}:$S$${r - 1}`;
                    statusCF(ws, `S${firstHy}:S${r - 1}`);
                    REF._hydMax = (() => {
                        let mx = 0;
                        for (let rr = firstHy; rr < r; rr++) mx = Math.max(mx, ws.getCell(rr, 15).result || 0);
                        return mx;
                    })();
                }
                REF._sizingFails += pumpSelFails;
                r = note(ws, r, NC, L('流量 = 迴路熱負載 × 負載係數 × 60 ÷ (比熱 × ΔT)（密度 1 kg/L）；負載係數：排熱側泵含冰機壓縮機熱、冷卻水泵 = 1 + 1/COP、Trim 冰水泵 = 尖峰冰機負擔比例。泵電功率 = 流量 × 揚程 × g ÷ (60000 × 泵效率 × 馬達效率)。選型判定：運轉台數 × 型錄流量 ≥ 需求流量，且型錄揚程 ≥ 需求揚程（型錄無流量 / 揚程資料者不判定）。共用機房成員單元的泵由機房統一計算，不重複列出。',
                    'Flow = loop heat × load factor × 60 ÷ (cp × ΔT) (density 1 kg/L). Load factor: heat-rejection pump includes chiller compressor heat; condenser pump = 1 + 1/COP; trim CHW pump = peak chiller share. Pump power = flow × head × g ÷ (60000 × pump η × motor η). Selection: running units × catalog flow ≥ required flow and catalog head ≥ required head (not judged when catalog flow / head data are missing). Pumps of shared-plant members are calculated once at the plant.'));
                ws.views = [{ showGridLines: false }];
            }

            // ═════════════════════════════════════════════════════════
            // 8. 尖峰工況分析
            // ═════════════════════════════════════════════════════════
            {
                const ws = S.peak;
                let r = titleBlock(ws, 4, L('尖峰工況分析', 'Peak Condition Analysis'));
                const kv = (label, f, kind, unit, noteText, fmt) => {
                    put(ws, r, 1, label, 'bold');
                    put(ws, r, 2, f, kind, fmt);
                    put(ws, r, 3, unit, 'muted', undefined, { align: 'center' });
                    put(ws, r, 4, noteText, 'muted', undefined, { wrap: true });
                    return r++;
                };
                let iPk = 0;
                H.forEach((x, i) => { if (x.pue > H[iPk].pue) iPk = i; });
                const pk = H[iPk];
                r = section(ws, r, 4, L('A. 全年最高瞬時 PUE 發生時刻', 'A. Hour of Highest Instantaneous PUE'));
                r = header(ws, r, [L('項目', 'Item'), L('數值', 'Value'), L('單位', 'Unit'), L('計算式 / 說明', 'Formula / Note')]);
                const pkRow = kv(L('尖峰 PUE', 'Peak PUE'), F(`MAX(${hR('Q')})`, pk.pue), 'link', '-', L('= 逐時 Q 欄最大值', '= max of hourly column Q'), FMT.pue);
                REF.peakPue = X('peak', abs(2, pkRow));
                const idxRow = kv(L('發生於逐時資料第幾筆', 'Record number in hourly data'), F(`MATCH(B${pkRow},${hR('Q')},0)`, iPk + 1), 'link', '#', L('= MATCH(尖峰 PUE, 逐時 Q 欄)', '= MATCH(peak PUE, hourly column Q)'), FMT.int);
                const at = (col, v, fmt, label, unit) => kv(label, F(`INDEX(${hR(col)},B${idxRow})`, v), 'link', unit, L(`= 該筆之逐時 ${col} 欄`, `= hourly column ${col} of that record`), fmt);
                at('B', pk.m, FMT.month, L('月份', 'Month'), '-');
                at('C', pk.d, FMT.int, L('日序（1–365）', 'Day of year'), '-');
                at('D', pk.hh, FMT.int, L('時', 'Hour'), 'h');
                at('E', pk.db, FMT.temp, L('乾球溫度', 'Dry-bulb'), '°C');
                at('F', pk.wb, FMT.temp, L('濕球溫度', 'Wet-bulb'), '°C');
                at('G', pk.lm, undefined, L('液冷迴路模式', 'Liquid-loop mode'), '-');
                at('H', pk.am, undefined, L('氣冷迴路模式', 'Air-loop mode'), '-');
                at('O', pk.cool, FMT.d1, L('冷卻功率', 'Cooling power'), 'kW');
                at('P', pk.tot, FMT.d1, L('全廠總功率', 'Facility power'), 'kW');
                r++;

                r = section(ws, r, 4, L('B. 尖峰需量（配電設計參考）', 'B. Peak Demand (for electrical design)'));
                r = header(ws, r, [L('項目', 'Item'), L('數值', 'Value'), L('單位', 'Unit'), L('計算式 / 說明', 'Formula / Note')]);
                const maxTot = Math.max(...H.map(x => x.tot));
                const maxCool = Math.max(...H.map(x => x.cool));
                const maxCh = Math.max(...H.map(x => x.ch));
                kv(L('最大全廠功率', 'Maximum facility power'), F(`MAX(${hR('P')})`, maxTot), 'link', 'kW', L('= 逐時 P 欄最大值', '= max of hourly column P'), FMT.d1);
                const mcRow = kv(L('最大冷卻功率', 'Maximum cooling power'), F(`MAX(${hR('O')})`, maxCool), 'link', 'kW', L('= 逐時 O 欄最大值（不一定與尖峰 PUE 同一小時）', '= max of hourly column O (not necessarily the peak-PUE hour)'), FMT.d1);
                kv(L('冷卻需量係數', 'Cooling demand factor'), F(`IF(${REF.itKw}>0,B${mcRow}/${REF.itKw},0)`, itKwTotal > 0 ? maxCool / itKwTotal : 0), 'formula', 'kW/kW', L('= 最大冷卻功率 ÷ IT 功率', '= maximum cooling power ÷ IT power'), FMT.d4);
                kv(L('最大冰機功率', 'Maximum chiller power'), F(`MAX(${hR('M')})`, maxCh), 'link', 'kW', L('= 逐時 M 欄最大值', '= max of hourly column M'), FMT.d1);
                r++;

                r = section(ws, r, 4, L('C. 容量檢核（計算引擎逐時判定）', 'C. Capacity Check (engine hourly evaluation)'));
                r = header(ws, r, [L('項目', 'Item'), L('數值', 'Value'), L('單位', 'Unit'), L('判定', 'Result')]);
                const capRow = (label, v, unit) => {
                    put(ws, r, 1, label, 'bold');
                    put(ws, r, 2, v, 'input', FMT.int);
                    put(ws, r, 3, unit, 'muted', undefined, { align: 'center' });
                    put(ws, r, 4, F(`IF(B${r}=0,"${PASS}","${WARN}")`, v === 0 ? PASS : WARN), 'formula', undefined, { align: 'center' });
                    return r++;
                };
                const firstCap = r;
                REF.deficitHours = X('peak', abs(2, capRow(L('容量不足時數（任一單元）', 'Capacity-deficit hours (any unit)'), Number(overall.capacityDeficitHours || 0), 'h')));
                capRow(L('最大容量缺口', 'Maximum capacity shortfall'), Number(overall.maxCapacityDeficitKw || 0), 'kW');
                REF.envelopeHours = X('peak', abs(2, capRow(L('冰機超出運轉範圍時數', 'Chiller out-of-envelope hours'), Number(overall.chillerEnvelopeHours || 0), 'h')));
                statusCF(ws, `D${firstCap}:D${r - 1}`);
                r++;
                const defUnits = byUnits.filter(u => (u.deficitHours || 0) > 0 || (u.chillerEnvelopeHours || 0) > 0);
                if (defUnits.length > 0) {
                    r = header(ws, r, [L('單元', 'Unit'), L('容量不足時數 h', 'Deficit hours'), L('最大缺口 kW', 'Max shortfall kW'), L('建議', 'Action')]);
                    defUnits.forEach(u => {
                        put(ws, r, 1, u.duName || u.podName, 'bold');
                        put(ws, r, 2, Number(u.deficitHours || 0), 'input', FMT.int);
                        put(ws, r, 3, Number(u.maxDeficitKw || 0), 'input', FMT.int);
                        put(ws, r, 4, L('回到 Step 4 檢查「5.冷卻系統設計」B 表未通過的設備並增加台數或容量', 'Return to Step 4 and resize the items failing in table B of "5.Cooling System Design"'), 'muted', undefined, { wrap: true });
                        r++;
                    });
                }
                r = note(ws, r + 1, 4, L('容量不足的小時，未能排除的熱量不計入耗電，因此年度 PUE 會偏低（偏樂觀）。正式結論前應先讓容量不足時數為 0。',
                    'During capacity-deficit hours the unremoved heat carries no energy, so the annual PUE is understated (optimistic). Resolve all deficit hours before drawing conclusions.'));
            }

            // ═════════════════════════════════════════════════════════
            // 10. 附錄：最熱日 24 小時
            // ═════════════════════════════════════════════════════════
            {
                const ws = S.hottest;
                let bestDay = 0, bestAvg = -Infinity;
                for (let d = 0; d < 365; d++) {
                    const avg = sumBy(H.slice(d * 24, d * 24 + 24), x => x.db) / 24;
                    if (avg > bestAvg) { bestAvg = avg; bestDay = d; }
                }
                let r = titleBlock(ws, 14, L('附錄：最熱日 24 小時逐時明細', 'Appendix: Hottest Day, Hour by Hour'));
                r = note(ws, r, 14, L(`最熱日 = 日平均乾球最高的一天：第 ${bestDay + 1} 天（${H[bestDay * 24].m} 月），日平均乾球 ${bestAvg.toFixed(1)} °C。下表每一格皆連結至 11.附錄-8760逐時資料對應列。`,
                    `Hottest day = day with the highest mean dry-bulb: day ${bestDay + 1} (month ${H[bestDay * 24].m}), mean DB ${bestAvg.toFixed(1)} °C. Every cell links to the matching row of 11.Appx-8760h Hourly Data.`));
                r++;
                r = header(ws, r, [L('時', 'Hour'), 'DB °C', 'WB °C', L('液冷模式', 'Liquid mode'), L('氣冷模式', 'Air mode'), 'IT kW', L('CDU/泵 kW', 'CDU/Pump kW'), L('CRAH kW', 'CRAH kW'),
                    L('排熱 kW', 'Heat rej. kW'), L('冰機 kW', 'Chiller kW'), L('損耗 kW', 'Loss kW'), L('冷卻小計 kW', 'Cooling kW'), L('全廠 kW', 'Facility kW'), 'PUE']);
                const first = r;
                const cols = [['E', FMT.temp, 'db'], ['F', FMT.temp, 'wb'], ['G', undefined, 'lm'], ['H', undefined, 'am'], ['I', FMT.d1, 'it'], ['J', FMT.d1, 'cdu'], ['K', FMT.d1, 'crah'],
                    ['L', FMT.d1, 'hr'], ['M', FMT.d1, 'ch'], ['N', FMT.d1, 'loss'], ['O', FMT.d1, 'cool'], ['P', FMT.d1, 'tot'], ['Q', FMT.pue, 'pue']];
                for (let h = 0; h < 24; h++) {
                    const i = bestDay * 24 + h;
                    const src = HR0 + i;
                    put(ws, r, 1, `${String(h).padStart(2, '0')}:00`, 'text', undefined, { align: 'center' });
                    cols.forEach(([col, fmt, k], j) => put(ws, r, 2 + j, F(X('hourly', `${col}${src}`), H[i][k]), 'link', fmt));
                    if (h % 2 === 1) fillRow(ws, r, 1, 14, C.zebra);
                    r++;
                }
                const last = r - 1;
                const day = H.slice(bestDay * 24, bestDay * 24 + 24);
                put(ws, r, 1, L('日合計', 'Day'), 'bold', undefined, { align: 'center' });
                put(ws, r, 2, F(`AVERAGE(B${first}:B${last})`, bestAvg), 'formula', FMT.temp);
                put(ws, r, 3, F(`AVERAGE(C${first}:C${last})`, sumBy(day, x => x.wb) / 24), 'formula', FMT.temp);
                put(ws, r, 4, L('kWh ↓', 'kWh ↓'), 'muted', undefined, { align: 'center' });
                put(ws, r, 5, null);
                [[6, 'it'], [7, 'cdu'], [8, 'crah'], [9, 'hr'], [10, 'ch'], [11, 'loss'], [12, 'cool'], [13, 'tot']]
                    .forEach(([c, k]) => put(ws, r, c, F(`SUM(${colL(c)}${first}:${colL(c)}${last})`, sumBy(day, x => x[k])), 'formula', FMT.int));
                put(ws, r, 14, F(`IF(F${r}>0,M${r}/F${r},0)`, sumBy(day, x => x.tot) / sumBy(day, x => x.it)), 'formula', FMT.pue);
                fillRow(ws, r, 1, 14, C.brandSoft);
                boldRow(ws, r, 1, 14);
                ws.views = [{ state: 'frozen', ySplit: first - 1, showGridLines: false }];
            }

            // ═════════════════════════════════════════════════════════
            // 9. 驗證檢核
            // ═════════════════════════════════════════════════════════
            {
                const ws = S.verify;
                let r = titleBlock(ws, 8, L('驗證檢核：Excel 重算值 vs 計算引擎結果', 'Verification: Excel Recalculation vs Engine Results'));
                const sumRowA = r, sumRowB = r + 1;
                r += 3;
                r = section(ws, r, 8, L('A. 計算一致性（Excel 公式重算 vs 計算引擎）', 'A. Calculation Consistency (Excel formulas vs engine)'));
                r = header(ws, r, ['#', L('檢核項目', 'Check'), L('驗證方法', 'Method'), L('Excel 計算值', 'Excel value'), L('引擎 / 目標值', 'Engine / target'), L('差異', 'Difference'), L('容許誤差', 'Tolerance'), L('判定', 'Result')]);
                const firstA = r;
                let nA = 0, passA = 0;
                const num = (ref) => ref; // 公式片段
                const check = (label, method, dF, dv, eF, ev, tolF, tol, fmt) => {
                    nA++;
                    const diff = dv - ev;
                    const ok = Math.abs(diff) <= tol + 1e-12;
                    if (ok) passA++;
                    put(ws, r, 1, nA, 'muted', '0', { align: 'center' });
                    put(ws, r, 2, label, 'bold', undefined, { wrap: true });
                    put(ws, r, 3, method, 'muted', undefined, { wrap: true });
                    put(ws, r, 4, F(dF, dv), 'link', fmt);
                    put(ws, r, 5, typeof eF === 'string' ? F(eF, ev) : ev, typeof eF === 'string' ? 'link' : 'input', fmt);
                    put(ws, r, 6, F(`D${r}-E${r}`, diff), 'formula', fmt);
                    put(ws, r, 7, typeof tolF === 'string' ? F(tolF.replace(/#/g, r), tol) : tol, typeof tolF === 'string' ? 'formula' : 'input', fmt);
                    put(ws, r, 8, F(`IF(ABS(F${r})<=G${r},"${PASS}","${FAIL}")`, ok ? PASS : FAIL), 'formula', undefined, { align: 'center' });
                    ws.getRow(r).height = 32;
                    r++;
                };
                const totMwh = ANN.tot / 1000, itMwh = ANN.it / 1000, lossMwh = ANN.loss / 1000, coolMwh = ANN.cool / 1000;
                const engTot = (Number(bk.it || 0) + Number(bk.loss || 0) + Number(bk.cduPump || 0) + Number(bk.crahFan || 0) + Number(bk.heatRejection || 0) + Number(bk.chiller || 0)) / 1000;
                const engCool = (Number(bk.cduPump || 0) + Number(bk.crahFan || 0) + Number(bk.heatRejection || 0) + Number(bk.chiller || 0)) / 1000;
                check(L('模擬時數', 'Simulated hours'), L('逐時資料筆數 = 8,760', 'Hourly record count = 8,760'), num(REF.hours), 8760, null, 8760, null, 0, FMT.int);
                check(L('IT 設計功率', 'IT design power'), L('4.IT負載明細 設備加總 vs 引擎 IT 總功率', '4.IT Load Schedule total vs engine IT power'), num(REF.itKw), REF._itKw, null, itKwTotal, null, 0.01, FMT.d2);
                check(L('IT 年耗電', 'Annual IT energy'), L('逐時加總 vs IT 功率 × 8,760 h', 'Hourly sum vs IT power × 8,760 h'), num(REF.annItMwh), itMwh, `${REF.itKw}*8760/1000`, itKwTotal * 8.76, `ABS(E#)*0.0001`, Math.abs(itKwTotal * 8.76) * 0.0001, FMT.d1);
                check(L('配電損耗年耗電', 'Annual electrical loss'), L('逐時加總（IT × 損耗率）vs 引擎', 'Hourly sum (IT × loss ratio) vs engine'), num(REF.annLossMwh), lossMwh, num(REF.annLossEng), Number(bk.loss || 0) / 1000, `MAX(0.1,ABS(E#)*0.0005)`, Math.max(0.1, Math.abs(Number(bk.loss || 0) / 1000) * 0.0005), FMT.d1);
                check(L('冷卻系統年耗電', 'Annual cooling energy'), L('逐時加總 vs 引擎分項加總', 'Hourly sum vs engine component sum'), num(REF.annCoolMwh), coolMwh, num(REF.annCoolEng), engCool, `MAX(0.1,ABS(E#)*0.0005)`, Math.max(0.1, Math.abs(engCool) * 0.0005), FMT.d1);
                check(L('全廠年耗電', 'Annual facility energy'), L('逐時加總 vs 引擎', 'Hourly sum vs engine'), num(REF.annTotMwh), totMwh, num(REF.annTotEng), engTot, `ABS(E#)*0.0005`, Math.abs(engTot) * 0.0005, FMT.d1);
                check(L('年度 PUE', 'Annual PUE'), L('Excel 重算 vs 引擎（引擎取 3 位小數）', 'Excel vs engine (engine rounded to 3 dp)'), num(REF.pue), ANN.tot / ANN.it, num(REF.pueEng), Number(overall.annualPue || 0), null, 0.0006, FMT.d4);
                check(L('冷卻 pPUE（不含泵）', 'Cooling pPUE (excl. pumps)'), L('Excel 重算 vs 引擎', 'Excel vs engine'), num(REF.ppueExcl), (ANN.it + ANN.crah + ANN.hr + ANN.ch) / ANN.it, num(REF.ppueExclEng), Number(overall.annualP_Pue || 0), null, 0.0006, FMT.d4);
                check(L('尖峰 PUE', 'Peak PUE'), L('逐時最大值 vs 引擎', 'Hourly maximum vs engine'), num(REF.peakPue), Math.max(...H.map(x => x.pue)), null, Number(overall.peakPue || 0), null, 0.0006, FMT.d4);
                check('WUE', L('Excel 重算 vs 引擎', 'Excel vs engine'), num(REF.wue), ANN.water / (ANN.it / 1000), num(REF.wueEng), Number(overall.annualWue || 0), null, 0.0006, FMT.d4);
                check(L('各單元能耗合計', 'Sum of unit energy'), L('6.能耗 C 表合計 vs 逐時加總（各單元 MWh 已進位）', 'Table C total in 6.Energy vs hourly sum (unit MWh rounded)'),
                    num(REF.unitTotMwh), sumBy(byUnits, u => (u.annualItMwh || 0) + (u.lossMwh || 0) + (u.cduPumpMwh || 0) + (u.crahFanMwh || 0) + (u.heatRejectionMwh || 0) + (u.chillerMwh || 0)),
                    num(REF.annTotMwh), totMwh, null, Math.max(1, REF.nUnits * 3), FMT.d1);
                check(L('月度合計 = 年度', 'Monthly sum = annual'), L('7.月度趨勢 全年列 vs 6.能耗 全廠合計', 'Year row of 7.Monthly vs facility total in 6.Energy'), num(REF.monTotMwh), totMwh, num(REF.annTotMwh), totMwh, null, 0.001, FMT.d1);
                if (REF.hydDiff) {
                    check(L('泵電功率公式重算', 'Pump power recalculation'), L('5.冷卻系統設計 C 表：最大相對差異', 'Table C of 5.Cooling System Design: maximum relative difference'), `MAX(${REF.hydDiff})`, REF._hydMax, null, 0, null, 0.01, FMT.pct2);
                }
                const lastA = r - 1;
                statusCF(ws, `H${firstA}:H${lastA}`);
                r++;

                r = section(ws, r, 8, L('B. 設計檢核（影響結論可信度）', 'B. Design Checks (affect how far the result can be relied on)'));
                r = header(ws, r, ['#', L('檢核項目', 'Check'), L('說明', 'Note'), L('數值', 'Value'), L('目標', 'Target'), '', '', L('判定', 'Result')]);
                const firstB = r;
                let nB = 0, warnB = 0;
                const design = (label, method, f, v, target, fmt) => {
                    nB++;
                    const ok = v <= target;
                    if (!ok) warnB++;
                    put(ws, r, 1, nB, 'muted', '0', { align: 'center' });
                    put(ws, r, 2, label, 'bold', undefined, { wrap: true });
                    put(ws, r, 3, method, 'muted', undefined, { wrap: true });
                    put(ws, r, 4, f, typeof f === 'object' ? 'link' : 'input', fmt);
                    put(ws, r, 5, target, 'input', fmt);
                    put(ws, r, 6, null);
                    put(ws, r, 7, null);
                    put(ws, r, 8, F(`IF(D${r}<=E${r},"${PASS}","${WARN}")`, ok ? PASS : WARN), 'formula', undefined, { align: 'center' });
                    ws.getRow(r).height = 32;
                    r++;
                };
                design(L('設備選型未通過檢核', 'Failed sizing checks'), L('5.冷卻系統設計 B 表容量判定 + C 表泵流量 / 揚程判定為「不足」的項目數', 'Items marked SHORT in table B (capacity) and table C (pump flow / head) of 5.Cooling System Design'),
                    F(`COUNTIF(${REF.sizingStatus},"✘*")` + (REF.pumpSelStatus ? `+COUNTIF(${REF.pumpSelStatus},"✘*")` : ''), REF._sizingFails), REF._sizingFails, 0, FMT.int);
                design(L('容量不足時數', 'Capacity-deficit hours'), L('引擎逐時判定，任一單元冷卻容量不足的小時數', 'Engine hourly check: hours in which any unit lacks cooling capacity'),
                    F(REF.deficitHours, Number(overall.capacityDeficitHours || 0)), Number(overall.capacityDeficitHours || 0), 0, FMT.int);
                const tl = overall.thermalLedger || {};
                const imb = Math.abs(Number(tl.imbalance_kwh || 0)) / 1000;
                design(L('熱量平衡差', 'Heat balance gap'), L('|Σ(IT + 損耗) − Σ 已排除熱量|，容量不足時不為 0', '|Σ(IT + loss) − Σ heat removed|; non-zero when capacity is short'),
                    imb, imb, Math.max(0.001, Math.abs(Number(tl.total_heat_generated_kwh || 0)) / 1000 * 1e-6), FMT.d1);
                design(L('冰機超出運轉範圍時數', 'Chiller out-of-envelope hours'), L('冷凝進水溫超過冰機型錄上限的小時數', 'Hours with condenser inlet above the chiller limit'),
                    F(REF.envelopeHours, Number(overall.chillerEnvelopeHours || 0)), Number(overall.chillerEnvelopeHours || 0), 0, FMT.int);
                const lastB = r - 1;
                statusCF(ws, `H${firstB}:H${lastB}`);

                // 摘要（置頂）
                const consistText = passA === nA ? L(`✔ ${nA} 項全部通過`, `✔ All ${nA} checks passed`) : L(`✘ ${nA - passA} 項不一致`, `✘ ${nA - passA} mismatches`);
                const designText = warnB === 0 ? L('✔ 無待檢討項目', '✔ No open items') : L(`⚠ ${warnB} 項需檢討`, `⚠ ${warnB} items to review`);
                const sumLine = (row, label, f) => {
                    span(ws, row, 1, 3, label, 'bold');
                    for (let c = 4; c <= 8; c++) put(ws, row, c, c === 4 ? f : null, 'formula', undefined, { align: 'center' });
                    merge(ws, row, 4, 8);
                    ws.getRow(row).height = 24;
                };
                sumLine(sumRowA, L('計算一致性', 'Calculation consistency'),
                    F(EN
                        ? `IF(COUNTIF(H${firstA}:H${lastA},"✔*")=${nA},"✔ All ${nA} checks passed","✘ "&(${nA}-COUNTIF(H${firstA}:H${lastA},"✔*"))&" mismatches")`
                        : `IF(COUNTIF(H${firstA}:H${lastA},"✔*")=${nA},"✔ ${nA} 項全部通過","✘ "&(${nA}-COUNTIF(H${firstA}:H${lastA},"✔*"))&" 項不一致")`, consistText));
                sumLine(sumRowB, L('設計檢核', 'Design checks'),
                    F(EN
                        ? `IF(COUNTIF(H${firstB}:H${lastB},"⚠*")=0,"✔ No open items","⚠ "&COUNTIF(H${firstB}:H${lastB},"⚠*")&" items to review")`
                        : `IF(COUNTIF(H${firstB}:H${lastB},"⚠*")=0,"✔ 無待檢討項目","⚠ "&COUNTIF(H${firstB}:H${lastB},"⚠*")&" 項需檢討")`, designText));
                statusCF(ws, `D${sumRowA}:D${sumRowB}`);
                REF.verifyA = X('verify', abs(4, sumRowA));
                REF.verifyB = X('verify', abs(4, sumRowB));
                REF._verifyA = consistText;
                REF._verifyB = designText;
                r = note(ws, r + 1, 8, L('A 表任一項不一致代表 Excel 公式與計算引擎結果有落差，應先釐清再使用本計算書；B 表為設計面待檢討事項，不影響公式正確性，但會影響 PUE 結論的可信度。',
                    'Any mismatch in table A means the Excel formulas disagree with the engine and must be resolved before using this report; table B lists design issues that do not affect formula correctness but do affect how far the PUE result can be relied on.'));
                ws.views = [{ state: 'frozen', ySplit: 3, showGridLines: false }];
            }

            // ═════════════════════════════════════════════════════════
            // 1. 封面與摘要
            // ═════════════════════════════════════════════════════════
            {
                const ws = S.cover;
                const NC = 9;
                let r = titleBlock(ws, NC, reportTitle);
                r = section(ws, r, NC, L('專案資訊', 'Project Information'));
                const unitCount = halls.reduce((s, h) => s + (h.dus || []).length, 0);
                const info = [
                    [L('地點 / 氣象測站', 'Site / weather station'), `${stationLabel}${site.lat !== undefined ? `   (${site.lat}°, ${site.lon}°, ${L('海拔', 'elev.')} ${site.elev ?? '-'} m)` : ''}`],
                    [L('氣象資料', 'Weather data'), site.stationId || site.stationName || '-'],
                    [L('計算範圍', 'Scope'), L(`${halls.length} 個機房、${unitCount} 個 DU、${pods.length} 個 CorePOD、${plants.length} 個共用冷卻機房`, `${halls.length} halls, ${unitCount} DUs, ${pods.length} CorePODs, ${plants.length} shared cooling plants`)],
                    [L('計算方法', 'Method'), L('8,760 小時逐時模擬；IT 以設計滿載定值計算', '8,760-hour hourly simulation; IT at constant design load')],
                    [L('產製時間', 'Generated'), genDate]
                ];
                info.forEach(([k, v]) => {
                    span(ws, r, 2, 3, k, 'bold');
                    span(ws, r, 4, NC, v, 'text');
                    ws.getRow(r).height = 20;
                    r++;
                });
                r++;

                r = section(ws, r, NC, L('關鍵指標（皆為公式連結，點選可追溯）', 'Key Results (all linked formulas — click to trace)'));
                const tile = (row, col, label, f, fmt, caption) => {
                    for (let rr = row; rr <= row + 2; rr++) for (let c = col; c <= col + 1; c++) {
                        const cell = ws.getCell(rr, c);
                        cell.fill = fill(rr === row ? C.brandSoft : C.white);
                        cell.border = {
                            top: rr === row ? thin(C.brandLine) : undefined, bottom: rr === row + 2 ? thin(C.brandLine) : undefined,
                            left: c === col ? thin(C.brandLine) : undefined, right: c === col + 1 ? thin(C.brandLine) : undefined
                        };
                    }
                    ws.mergeCells(row, col, row, col + 1);
                    ws.mergeCells(row + 1, col, row + 1, col + 1);
                    ws.mergeCells(row + 2, col, row + 2, col + 1);
                    const l = ws.getCell(row, col);
                    l.value = label;
                    l.font = fnt({ size: 9, bold: true, color: C.brand });
                    l.alignment = { vertical: 'middle', horizontal: 'center' };
                    const v = ws.getCell(row + 1, col);
                    v.value = f;
                    v.numFmt = fmt;
                    v.font = fnt({ size: 22, bold: true, color: C.link });
                    v.alignment = { vertical: 'middle', horizontal: 'center' };
                    const c2 = ws.getCell(row + 2, col);
                    c2.value = caption;
                    c2.font = fnt({ size: 8.5, color: C.muted });
                    c2.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
                };
                const pue = ANN.tot / ANN.it;
                tile(r, 2, L('年度 PUE', 'Annual PUE'), F(REF.pue, pue), FMT.pue, L('全廠年耗電 ÷ IT 年耗電', 'Facility energy ÷ IT energy'));
                tile(r, 5, L('冷卻 pPUE（含泵）', 'Cooling pPUE (incl. pumps)'), F(REF.ppueIncl, (ANN.it + ANN.cool) / ANN.it), FMT.pue, L('(IT + 冷卻耗電) ÷ IT', '(IT + cooling) ÷ IT'));
                tile(r, 8, L('尖峰瞬時 PUE', 'Peak hourly PUE'), F(REF.peakPue, Math.max(...H.map(x => x.pue))), FMT.pue, L('全年最差小時', 'Worst hour of the year'));
                ws.getRow(r).height = 20; ws.getRow(r + 1).height = 38; ws.getRow(r + 2).height = 20;
                r += 4;
                tile(r, 2, 'WUE (L/kWh)', F(REF.wue, ANN.water / (ANN.it / 1000)), FMT.d4, L('年耗水 ÷ IT 年耗電', 'Water ÷ IT energy'));
                tile(r, 5, L('全廠年耗電 (MWh)', 'Facility energy (MWh)'), F(REF.annTotMwh, ANN.tot / 1000), FMT.int, L('含 IT、冷卻與配電損耗', 'IT + cooling + electrical loss'));
                tile(r, 8, L('IT 設計功率 (kW)', 'IT design power (kW)'), F(REF.itKw, itKwTotal), FMT.int, L('4.IT負載明細 加總', 'Total of 4.IT Load Schedule'));
                ws.getRow(r).height = 20; ws.getRow(r + 1).height = 38; ws.getRow(r + 2).height = 20;
                r += 4;

                r = section(ws, r, NC, L('驗證狀態', 'Verification Status'));
                const vLine = (label, f) => {
                    span(ws, r, 2, 3, label, 'bold');
                    for (let c = 4; c <= NC; c++) put(ws, r, c, c === 4 ? f : null, 'link', undefined, { align: 'left' });
                    merge(ws, r, 4, NC);
                    ws.getRow(r).height = 22;
                    return r++;
                };
                const v1 = vLine(L('計算一致性（9.驗證檢核 A）', 'Consistency (9.Verification A)'), F(REF.verifyA, REF._verifyA));
                const v2 = vLine(L('設計檢核（9.驗證檢核 B）', 'Design checks (9.Verification B)'), F(REF.verifyB, REF._verifyB));
                statusCF(ws, `D${v1}:D${v2}`);
                if ((overall.capacityDeficitHours || 0) > 0) {
                    for (let c = 2; c <= NC; c++) put(ws, r, c, null, 'text', undefined, { fill: C.failBg });
                    ws.mergeCells(r, 2, r, NC);
                    const w = ws.getCell(r, 2);
                    const dh = Number(overall.capacityDeficitHours).toLocaleString('en-US');
                    const dk = Math.round(overall.maxCapacityDeficitKw || 0).toLocaleString('en-US');
                    w.value = L(`⚠ 有 ${dh} 小時冷卻容量不足（最大缺口 ${dk} kW）。不足的熱量未計入耗電，年度 PUE 偏低，正式採用前請先修正設備選型（見 5、8 頁）。`,
                        `⚠ Cooling capacity is short for ${dh} hours (max shortfall ${dk} kW). Unremoved heat carries no energy, so the annual PUE is understated; fix the equipment sizing before relying on it (see sheets 5 and 8).`);
                    w.font = fnt({ size: 9.5, bold: true, color: C.failFg });
                    w.alignment = { vertical: 'middle', horizontal: 'left', indent: 1, wrapText: true };
                    ws.getRow(r).height = 34;
                    r++;
                }
                r++;

                r = section(ws, r, NC, L('冷卻系統配置', 'Cooling System Configuration'));
                // 欄位配置：B 單元、C IT kW、D:E 液冷架構、F FWS、G:H 氣冷架構、I CHW（D、G 為封面卡片間隔欄，需與右欄合併）
                r = header(ws, r, [L('單元', 'Unit'), 'IT kW', L('液冷架構', 'Liquid architecture'), '', L('FWS 供 / 回 °C', 'FWS sup / ret °C'), L('氣冷架構', 'Air architecture'), '', L('CHW 供 / 回 °C', 'CHW sup / ret °C')], 2);
                merge(ws, r - 1, 4, 5);
                merge(ws, r - 1, 7, 8);
                const unitsCfg = [];
                halls.forEach(h => (h.dus || []).forEach(d => unitsCfg.push({ name: d.name, pd: d.plantDesign || {}, res: byUnits.find(u => u.duId === d.id) })));
                pods.forEach(p => unitsCfg.push({ name: p.name, pd: p.plantDesign || {}, res: byUnits.find(u => u.podId === p.id) }));
                unitsCfg.forEach((u, idx) => {
                    const c = u.pd.cduSystem || {}, f = u.pd.fanwallSystem || {};
                    const hasL = (u.res?.liquidHeatKw || 0) > 0;
                    const hasA = ((u.res?.airHeatKw || 0) + (u.res?.lossKw || 0)) > 0;
                    const withPlant = (label, plantId) => {
                        const pn = plants.find(p => p.id === plantId)?.name;
                        return pn ? `${label}\n${L('共用', 'Shared')}: ${pn}` : label;
                    };
                    put(ws, r, 2, u.name, 'bold', undefined, { wrap: true });
                    put(ws, r, 3, Number(u.res?.totalItKw || 0), 'input', FMT.int);
                    span(ws, r, 4, 5, hasL ? withPlant(archLabel(c.architecture), c.plantId) : NA_TXT, 'text', { wrap: true });
                    put(ws, r, 6, hasL ? `${c.fwsSupplyC ?? '-'} / ${c.fwsReturnC ?? '-'}` : NA_TXT, 'text', undefined, { align: 'center' });
                    span(ws, r, 7, 8, hasA ? withPlant(archLabel(f.architecture), f.plantId) : NA_TXT, 'text', { wrap: true });
                    put(ws, r, 9, hasA ? `${f.chwSupplyC ?? '-'} / ${f.chwReturnC ?? '-'}` : NA_TXT, 'text', undefined, { align: 'center' });
                    if (idx % 2 === 1) fillRow(ws, r, 2, 9, C.zebra);
                    ws.getRow(r).height = (c.plantId || f.plantId) ? 40 : 30;
                    r++;
                });
                r++;

                r = section(ws, r, NC, L('計算書目錄', 'Contents'));
                const contents = [
                    ['basis', L('專案計算基準、計算方法、工程假設登錄表', 'Project basis, calculation method, assumption register')],
                    ['weather', L('設計工況、逐月氣候、運轉模式時數、乾球區間分析', 'Design conditions, monthly climate, operating-mode hours, DB bins')],
                    ['it', L('IT 設備明細與液冷 / 氣冷熱負載拆分', 'IT equipment schedule and liquid / air heat split')],
                    ['sizing', L('系統參數、設備選型冗餘檢核、水力驗算', 'System parameters, sizing & redundancy, hydraulic check')],
                    ['energy', L('年度能耗、PUE / pPUE / WUE、各單元能耗', 'Annual energy, PUE / pPUE / WUE, energy by unit')],
                    ['monthly', L('逐月能耗與 PUE', 'Monthly energy and PUE')],
                    ['peak', L('尖峰 PUE 時刻、尖峰需量、容量檢核', 'Peak-PUE hour, peak demand, capacity check')],
                    ['verify', L('Excel 重算 vs 計算引擎的逐項比對', 'Item-by-item Excel vs engine comparison')],
                    ['hottest', L('最熱日 24 小時明細', 'Hottest day, hour by hour')],
                    ['hourly', L('8,760 小時原始逐時資料（所有彙總的來源）', '8,760-hour source data for every total')]
                ];
                contents.forEach(([k, desc]) => {
                    for (let c = 2; c <= NC; c++) put(ws, r, c, null);
                    ws.mergeCells(r, 2, r, 3);
                    ws.mergeCells(r, 4, r, NC);
                    const lc = ws.getCell(r, 2);
                    lc.value = { text: SN[k], hyperlink: `#${qn(SN[k])}!A1` };
                    lc.font = fnt({ color: C.input, bold: true });
                    const dc = ws.getCell(r, 4);
                    dc.value = desc;
                    dc.font = STYLE.muted;
                    r++;
                });
                r++;

                r = section(ws, r, NC, L('閱讀說明', 'How to Read'));
                const legend = [
                    [L('藍字', 'Blue text'), L('輸入值：專案設定或計算引擎輸出，可修改試算', 'Input: project setting or engine output; may be edited for what-if checks'), C.input],
                    [L('黑字', 'Black text'), L('公式：由同頁資料計算', 'Formula: calculated from data on the same sheet'), C.text],
                    [L('綠字', 'Green text'), L('連結：引用其他工作表（多數源自 11.附錄-8760逐時資料）', 'Link: references another sheet (mostly 11.Appx-8760h Hourly Data)'), C.link]
                ];
                legend.forEach(([k, v, color]) => {
                    span(ws, r, 2, 3, k, 'bold').font = fnt({ bold: true, color });
                    span(ws, r, 4, NC, v, 'muted');
                    r++;
                });
                r++;

                r = section(ws, r, NC, L('模型假設與限制', 'Modelling Assumptions and Limitations'));
                const limits = [
                    L('IT 負載全年以設計滿載定值計算，未套用負載變動曲線；部分負載運轉時實際 PUE 通常較高。', 'IT load is held at design full load all year; no load profile is applied. Real PUE at part load is usually higher.'),
                    L('CRAH / 風牆風扇與 CDU 泵的發熱未回加到冷卻負載。', 'Heat from CRAH / fanwall fans and CDU pumps is not added back to the cooling load.'),
                    L(`CDU 容量依型錄標稱值計算（目前降額率 ${Aval('cdu_derate_pct_per_c', 0)} %/°C）；乾冷器容量不隨外氣溫度降額。`, `CDU capacity uses the catalog rating (current derate ${Aval('cdu_derate_pct_per_c', 0)} %/°C); dry cooler capacity is not derated with ambient temperature.`),
                    L('冰機、冷卻塔等設備性能採 AHRI 通用曲線或型錄單點值，非廠商逐點認證數據。', 'Chiller and tower performance uses generic AHRI curves or single catalog points, not certified vendor performance maps.'),
                    L('本計算書供設計階段能效評估，非 PUE 實測或認證文件。', 'This report is a design-stage energy assessment, not a measured or certified PUE.')
                ];
                limits.forEach((t, i) => {
                    span(ws, r, 2, NC, `${i + 1}. ${t}`, 'text', { wrap: true });
                    ws.getRow(r).height = 30;
                    r++;
                });
                r++;

                r = section(ws, r, NC, L('簽核', 'Sign-off'));
                [[L('設計', 'Prepared by'), L('審核', 'Checked by'), L('核准', 'Approved by')], [L('日期', 'Date'), L('日期', 'Date'), L('日期', 'Date')]].forEach(labels => {
                    labels.forEach((t, i) => {
                        const c = 2 + i * 3;
                        put(ws, r, c, t, 'bold');
                        put(ws, r, c + 1, null);
                    });
                    ws.getRow(r).height = 30;
                    r++;
                });
            }

            // ═════════════════════════════════════════════════════════
            // 12. 方案比較（有儲存方案時）
            // ═════════════════════════════════════════════════════════
            const scenarios = state.scenarios || [];
            if (scenarios.length > 0) {
                const ws = mk('scen', 'FF4F46E5', [22, 12, 30, 11, 11, 11, 11, 11, 14, 13, 12, 12, 12, 12, 12, 10, 10, 10, 12, 26]);
                let r = titleBlock(ws, 20, L('冷卻設計方案比較', 'Cooling Design Scenario Comparison'));
                r = header(ws, r, [_t('scen.thName', {}, '方案名稱'), L('狀態', 'Status'), _t('scen.thCoolingConfig', {}, '冷卻架構與分組'), _t('scen.thAnnualPue', {}, '年 PUE'), 'Δ PUE',
                    'pPUE', _t('scen.thPeakPue', {}, '尖峰 PUE'), 'WUE', _t('scen.thTotalPower', {}, '年總耗電 (MWh)'), 'Δ MWh',
                    _t('scen.thChillerMwh', {}, '冰機 (MWh)'), _t('scen.thHeatRejMwh', {}, '排熱 (MWh)'), _t('scen.thPumpMwh', {}, '泵+CDU (MWh)'), _t('scen.thCrahMwh', {}, 'CRAH (MWh)'), _t('scen.thLossMwh', {}, '電損 (MWh)'),
                    L('冰機台數', 'Chillers'), L('排熱台數', 'Heat rej. units'), L('水泵台數', 'Pumps'), _t('scen.thDeficitHours', {}, '容量不足 (h)'), _t('scen.scenarioNote', {}, '備註說明')]);
                const base = r;
                scenarios.forEach((scen, idx) => {
                    let summ = scen.resultSummary;
                    if (!summ && typeof appStore.evaluateScenario === 'function') summ = appStore.evaluateScenario(scen);
                    const b = summ?.breakdownMwh || {};
                    const isActive = scen.id === state.activeScenarioId;
                    const cfg = (typeof appStore.getCoolingConfigSummary === 'function') ? appStore.getCoolingConfigSummary(scen) : (summ?.coolingConfigSummary || '');
                    const vals = [summ?.annualPue ?? 0, summ?.annualP_Pue ?? 0, summ?.peakPue ?? 0, summ?.annualWue ?? 0, summ?.annualTotalMwh ?? 0];
                    put(ws, r, 1, scen.name || '', 'bold');
                    put(ws, r, 2, isActive ? _t('scen.activeBadge', {}, '當前方案') : (idx === 0 ? _t('scen.baseline', {}, '基準') : ''), 'muted', undefined, { align: 'center' });
                    put(ws, r, 3, enText(cfg), 'text', undefined, { wrap: true });
                    put(ws, r, 4, vals[0], 'input', FMT.pue);
                    put(ws, r, 5, idx === 0 ? NA_TXT : F(`D${r}-D${base}`, vals[0] - (scenarios[0].resultSummary?.annualPue ?? vals[0])), idx === 0 ? 'muted' : 'formula', '+0.000;-0.000;0.000', { align: 'right' });
                    put(ws, r, 6, vals[1], 'input', FMT.pue);
                    put(ws, r, 7, vals[2], 'input', FMT.pue);
                    put(ws, r, 8, vals[3], 'input', FMT.d4);
                    put(ws, r, 9, vals[4], 'input', FMT.int);
                    put(ws, r, 10, idx === 0 ? NA_TXT : F(`I${r}-I${base}`, vals[4] - (scenarios[0].resultSummary?.annualTotalMwh ?? vals[4])), idx === 0 ? 'muted' : 'formula', '+#,##0;-#,##0;0', { align: 'right' });
                    [b.chiller, b.heatRejection, b.cduPump, b.crahFan, b.loss, summ?.totalChillers, summ?.totalHeatRej, summ?.totalPumps, summ?.capacityDeficitHours]
                        .forEach((v, j) => put(ws, r, 11 + j, Number(v ?? 0), 'input', FMT.int));
                    put(ws, r, 20, scen.note || '', 'muted', undefined, { wrap: true });
                    ws.getRow(r).height = 30;
                    r++;
                });
                note(ws, r + 1, 20, L('方案數值為儲存方案時的計算結果快照；「容量不足」大於 0 的方案，其 PUE 偏低，不宜直接比較。',
                    'Scenario values are snapshots taken when each scenario was saved; scenarios with capacity-deficit hours have an understated PUE and should not be compared directly.'));
                ws.views = [{ state: 'frozen', ySplit: 4, xSplit: 1, showGridLines: false }];
            }

            return wb;
        },

        async generate(exportLang) {
            const i18n = (typeof window !== 'undefined' && window.I18N) ? window.I18N : (typeof I18N !== 'undefined' ? I18N : (typeof global !== 'undefined' && global.I18N ? global.I18N : null));
            const prevLang = i18n ? i18n.lang : 'zh-TW';
            const targetLang = exportLang || (typeof document !== 'undefined' && document.getElementById('excelExportLang')?.value) || prevLang;

            try {
                await this.ensureExcelJS();
                const wb = this.buildWorkbook(targetLang);
                const buffer = await wb.xlsx.writeBuffer();
                const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
                const fileName = `PUE_Calculation_Report_${targetLang}_${dateStr}.xlsx`;

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

                console.log(`[ExcelExport] 計算書匯出成功: ${fileName}`);
                return buffer;
            } catch (err) {
                console.error('[ExcelExport] 匯出失敗:', err);
                if (typeof alert === 'function') alert('匯出 Excel 計算書失敗: ' + err.message);
                throw err;
            } finally {
                if (i18n) i18n.lang = prevLang;
            }
        }
    };

    window.ExcelExport = ExcelExport;
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
