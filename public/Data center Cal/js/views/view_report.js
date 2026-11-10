/**
 * Step 6：可驗證的 PUE／WUE 年度能耗計算書（V9 Phase 4）
 * - 只讀取 AppStore.state 與 state.results，不做任何計算修改（報表層）
 * - 每個結果都列出公式與代入值，可由輸入逐步推導；附逐時 8,760 h CSV 供第三方重算
 * - 列印：瀏覽器「列印 → 另存 PDF」，A4 直式
 */
(function (root) {
    'use strict';

    const isEn = () => !!(root.I18N && root.I18N.lang === 'en');
    const L = (zh, en) => (isEn() ? en : zh);
    const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const num = (v, d = 0) => (Number.isFinite(Number(v)) ? Number(v).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }) : '—');
    const mwh = (kwh, d = 0) => num((Number(kwh) || 0) / 1000, d);

    const META_FIELDS = [
        ['projectName', '專案名稱', 'Project name'],
        ['projectNo', '專案案號', 'Project No.'],
        ['docNo', '文件編號', 'Doc No.'],
        ['revision', '版次', 'Revision'],
        ['client', '業主', 'Client'],
        ['preparedBy', '計算', 'Prepared by'],
        ['checkedBy', '審核', 'Checked by'],
        ['approvedBy', '核准', 'Approved by'],
        ['issueDate', '發行日期', 'Issue date']
    ];

    const ViewReport = {
        getMeta() {
            const st = root.AppStore.state;
            if (!st.reportMeta || typeof st.reportMeta !== 'object') st.reportMeta = {};
            return st.reportMeta;
        },

        updateMeta(field, value) {
            this.getMeta()[field] = String(value || '').slice(0, 200);
            if (typeof root.AppStore.autoSave === 'function') root.AppStore.autoSave();
        },

        print() { root.print(); },

        downloadCsv() {
            if (root.ViewDashboard && typeof root.ViewDashboard.download8760DetailedCsv === 'function') {
                root.ViewDashboard.download8760DetailedCsv();
            }
        },

        // ───────────────────────── 資料整理 ─────────────────────────
        archLabel(id) {
            const a = root.CoolingArchRegistry ? root.CoolingArchRegistry.get(id) : null;
            return (a && (a.optionLabel || a.cardLabel || a.dashboardLabel)) || id || '—';
        },

        pumpLabel(p) {
            const t = root.I18N && root.I18N.t ? root.I18N.t(p.labelKey) : null;
            return (t && t !== p.labelKey) ? t : (p.labelKey || p.key);
        },

        collectUnits(st) {
            const units = [];
            (st.halls || []).forEach(h => (h.dus || []).forEach(d => units.push({ kind: 'DU', hall: h.name, obj: d, summ: root.AppStore.calcDuSummary(d) })));
            (st.corePods || []).filter(p => p.enabled !== false).forEach(p => units.push({ kind: 'CorePOD', hall: '—', obj: p, summ: root.AppStore.calcCorePodSummary(p) }));
            return units;
        },

        collectSystems(st, units) {
            // V10：改用 EquipmentSchedule.collectSystems（與設備統整共用同一套邏輯）
            if (root.EquipmentSchedule) return root.EquipmentSchedule.collectSystems(st);
            const out = [];
            const plants = (st.coolingPlants || []).filter(p => !p.isEmpty && Array.isArray(p.memberIds) && p.memberIds.length > 0);
            plants.forEach(p => out.push({
                title: p.name, loop: p.loop, shared: true, sys: p.system || {},
                members: p.memberIds.map(id => (units.find(u => u.obj.id === id)?.obj.name) || id)
            }));
            units.forEach(u => {
                const pd = u.obj.plantDesign || {};
                [['cduSystem', 'liquid'], ['fanwallSystem', 'air']].forEach(([k, loop]) => {
                    const sys = pd[k];
                    if (!sys || !(sys.sizing || []).length) return;
                    const load = loop === 'liquid' ? u.summ.liquidHeatKw : (u.summ.airHeatKw + (u.summ.lossKw || 0));
                    if (!(load > 0)) return;
                    const plant = sys.plantId ? plants.find(p => p.id === sys.plantId) : null;
                    out.push({ title: u.obj.name, loop, shared: false, sys, terminalOnly: !!plant, plantName: plant ? plant.name : null });
                });
            });
            return out;
        },

        peakHour(hp) {
            let best = null;
            (hp || []).forEach(h => { if (h.itKw > 0 && (!best || h.totalKw / h.itKw > best.totalKw / best.itKw)) best = h; });
            return best;
        },

        // ───────────────────────── 版面元件 ─────────────────────────
        sec(id, no, title, body) {
            return `<section class="rpt-sec" id="rpt-${id}"><h2 class="rpt-h2">${no}　${title}</h2>${body}</section>`;
        },

        table(head, rows, opts = {}) {
            const th = head.map((h, i) => `<th class="${(opts.alignRight || []).includes(i) ? 'r' : ''}">${h}</th>`).join('');
            const tr = rows.map(r => `<tr class="${r._cls || ''}">${(r.cells || r).map((c, i) => `<td class="${(opts.alignRight || []).includes(i) ? 'r' : ''}">${c}</td>`).join('')}</tr>`).join('');
            return `<table class="rpt-tbl"><thead><tr>${th}</tr></thead><tbody>${tr}</tbody></table>`;
        },

        formula(lines) {
            return `<div class="rpt-formula">${lines.map(l => `<div>${l}</div>`).join('')}</div>`;
        },

        note(text, warn) {
            return `<p class="rpt-note ${warn ? 'warn' : ''}">${text}</p>`;
        },

        styles() {
            return `<style id="rpt-style">
                .rpt-wrap { max-width: 210mm; margin: 0 auto; background: #fff; color: #111; font-size: 12px; line-height: 1.55; }
                .rpt-page { padding: 18mm 16mm; border: 1px solid #e5e7eb; margin-bottom: 16px; background: #fff; }
                .rpt-hdr { display: flex; justify-content: space-between; font-family: ui-monospace, Consolas, monospace; font-size: 10px; color: #555; border-bottom: 1px solid #999; padding-bottom: 4px; margin-bottom: 18px; }
                .rpt-h1 { font-size: 22px; font-weight: 700; text-align: center; margin: 8px 0 4px; }
                .rpt-h2 { font-size: 15px; font-weight: 700; border-bottom: 2px solid #111; padding-bottom: 3px; margin: 22px 0 10px; }
                .rpt-h3 { font-size: 13px; font-weight: 700; margin: 14px 0 6px; }
                .rpt-tbl { width: 100%; border-collapse: collapse; margin: 6px 0 10px; font-size: 11px; }
                .rpt-tbl th, .rpt-tbl td { border: 1px solid #bbb; padding: 3px 6px; vertical-align: top; }
                .rpt-tbl th { background: #f3f4f6; font-weight: 600; text-align: left; }
                .rpt-tbl .r { text-align: right; font-variant-numeric: tabular-nums; }
                .rpt-tbl tr.ng td { background: #fdecea; }
                .rpt-tbl tr.tot td { font-weight: 700; background: #f9fafb; }
                .rpt-formula { font-family: ui-monospace, Consolas, monospace; font-size: 11px; background: #f8fafc; border-left: 3px solid #64748b; padding: 6px 10px; margin: 6px 0 10px; white-space: pre-wrap; }
                .rpt-note { font-size: 11px; color: #444; margin: 4px 0 8px; }
                .rpt-note.warn { color: #92400e; }
                .rpt-kv { width: 100%; border-collapse: collapse; font-size: 12px; }
                .rpt-kv th { width: 34%; text-align: left; background: #f5f5f4; border: 1px solid #bbb; padding: 5px 8px; font-weight: 600; }
                .rpt-kv td { border: 1px solid #bbb; padding: 3px 8px; font-family: ui-monospace, Consolas, monospace; }
                .rpt-in { width: 100%; border: none; border-bottom: 1px dashed #cbd5e1; background: transparent; font: inherit; padding: 2px 0; }
                .rpt-sign { display: grid; grid-template-columns: repeat(3, 1fr); border: 1px solid #999; margin-top: 28px; }
                .rpt-sign > div { padding: 8px 10px; min-height: 70px; border-right: 1px solid #999; font-size: 11px; }
                .rpt-sign > div:last-child { border-right: none; }
                .rpt-stamp { display: inline-block; padding: 4px 14px; border: 2px solid; font-weight: 700; font-size: 13px; letter-spacing: 1px; }
                .rpt-stamp.pass { color: #166534; border-color: #166534; }
                .rpt-stamp.warn { color: #92400e; border-color: #92400e; }
                .rpt-stamp.fail { color: #b91c1c; border-color: #b91c1c; }
                .rpt-toc li, .rpt-ol li { margin: 2px 0; }
                .rpt-toc, .rpt-ol { list-style: decimal; }
                @media print {
                    @page { size: A4; margin: 12mm; }
                    header, .no-print, #stickyBar { display: none !important; }
                    body { background: #fff !important; }
                    main#stepContent { max-width: none !important; padding: 0 !important; }
                    .rpt-page { border: none; padding: 0; margin: 0; page-break-after: always; }
                    .rpt-sec { page-break-inside: auto; }
                    .rpt-tbl tr, .rpt-formula { page-break-inside: avoid; }
                    .rpt-in { border-bottom: none; }
                }
            </style>`;
        },

        // ───────────────────── §5 設備規格與數量統整 ─────────────────────
        renderEquipmentSection(st) {
            const ES = root.EquipmentSchedule;
            if (!ES) return '';
            const eq = ES.build(st);
            const srcTxt = (r) => r.verified === true ? L('✓ 已驗證', '✓ verified')
                : (r.source ? L('⚠ 有出處，未驗證', '⚠ source, unverified') : L('⚠ 無出處', '⚠ no source'));
            const pwrMark = (r) => r.unitPowerBasis === 'cap/cop' ? ' *' : (r.unitPowerBasis === 'motor' ? ' †' : '');
            const locTxt = (r) => r.locations.map(l => esc(l.name) + ' ×' + l.qty).join('<br>');
            const mainRows = (cat) => eq.rows.filter(r => r.category === cat).map(r => [
                esc(r.label), esc(r.model) + (r.vendor ? `<br><span style="color:#666">${esc(r.vendor)}</span>` : ''), num(r.unitCapKw, 0),
                r.unitPowerKw != null ? num(r.unitPowerKw, 1) + pwrMark(r) : '—',
                `${r.qtyTotal} (${r.qtyRunning}+${r.qtyStandby})`, num(r.installedCapKw, 0), locTxt(r), srcTxt(r)
            ]);
            const head = [L('設備', 'Equipment'), L('型號／廠商', 'Model / vendor'), L('單機容量 kW', 'Unit cap. kW'), L('單機耗電 kW', 'Unit power kW'),
                L('台數（運轉+備用）', 'Qty (run+stby)'), L('總裝置容量 kW', 'Installed cap. kW'), L('使用位置', 'Location'), L('出處', 'Source')];
            const plantRows = mainRows('plant'), termRows = mainRows('terminal');

            // 5.2 規格明細：依分組選欄位，整欄都沒有值就不顯示
            const dims = (sp) => (sp.widthMm || sp.depthMm || sp.heightMm) ? `${num(sp.widthMm)}×${num(sp.depthMm)}×${num(sp.heightMm)}` : null;
            const COLS = {
                chiller: [['capKw', L('容量 kW', 'Cap. kW'), 0], ['unitPowerKw', L('輸入功率 kW', 'Input kW'), 1], ['cop', 'COP', 2], ['iplv', 'IPLV', 2], ['refrigerant', L('冷媒', 'Refrigerant')], ['tChwsC', L('出水溫 °C', 'CHWS °C'), 1], ['flowM3h', L('水量 m³/h', 'Water m³/h'), 1], ['airflowM3h', L('風量 m³/h', 'Air m³/h'), 0], ['weightKg', L('重量 kg', 'Weight kg'), 0]],
                heatRejection: [['capKw', L('排熱量 kW', 'Rejection kW'), 0], ['fanKwDx', L('風扇 kW（乾式）', 'Fan kW (dry)'), 1], ['fanKwFc', L('風扇 kW（自然冷卻）', 'Fan kW (FC)'), 1], ['approachC', L('趨近溫度 °C', 'Approach °C'), 1], ['flowM3h', L('水量 m³/h', 'Water m³/h'), 1], ['weightKg', L('重量 kg', 'Weight kg'), 0]],
                pump: [['capKw', L('馬達 kW', 'Motor kW'), 1], ['flowM3h', L('流量 m³/h', 'Flow m³/h'), 1], ['headM', L('揚程 m', 'Head m'), 1], ['pumpEta', 'η<sub>p</sub>', 2], ['motorEta', 'η<sub>m</sub>', 2], ['motorClass', L('馬達等級', 'Motor class')]],
                cdu: [['capKw', L('容量 kW', 'Cap. kW'), 0], ['unitPowerKw', L('耗電 kW', 'Power kW'), 1], ['flowM3h', L('流量 m³/h', 'Flow m³/h'), 1], ['pressureDropBar', L('外部壓降 bar', 'Ext. ΔP bar'), 1], ['pumpType', L('泵配置', 'Pumps')], ['dims', L('尺寸 W×D×H mm', 'W×D×H mm')], ['weightKg', L('重量 kg', 'Weight kg'), 0]],
                crah: [['capKw', L('容量 kW', 'Cap. kW'), 1], ['sensibleKw', L('顯熱 kW', 'Sensible kW'), 1], ['unitPowerKw', L('風扇 kW', 'Fan kW'), 1], ['airflowM3h', L('風量 m³/h', 'Air m³/h'), 0], ['tChwsC', L('進水溫 °C', 'CHW in °C'), 1], ['chwDtC', 'ΔT K', 1], ['dims', L('尺寸 W×D×H mm', 'W×D×H mm')]]
            };
            const GNAME = { chiller: L('冰水主機', 'Chillers'), heatRejection: L('排熱設備', 'Heat rejection'), pump: L('水泵', 'Pumps'), cdu: 'CDU', crah: L('CRAH／風牆／背板', 'CRAH / fan wall / RDHX'), other: L('其他', 'Other') };
            let specHtml = '';
            Object.keys(COLS).forEach(g => {
                // 同一型號用在多個用途時，規格只列一次
                const seenModel = new Set();
                const rs = eq.rows.filter(r => r.group === g && !seenModel.has(r.model) && seenModel.add(r.model));
                if (!rs.length) return;
                const val = (r, c) => c[0] === 'dims' ? dims(r.spec) : (c[0] === 'unitPowerKw' ? r.unitPowerKw : r.spec[c[0]]);
                const cols = COLS[g].filter(c => rs.some(r => val(r, c) != null));
                const rows = rs.map(r => [esc(r.model), ...cols.map(c => {
                    const v = val(r, c);
                    if (v == null) return '—';
                    return (typeof v === 'number') ? num(v, c[2] ?? 1) : esc(v);
                })]);
                specHtml += `<h3 class="rpt-h3">${GNAME[g]}</h3>` + this.table([L('型號', 'Model'), ...cols.map(c => c[1])], rows, { alignRight: cols.map((c, i) => i + 1).filter(i => typeof val(rs[0], cols[i - 1]) === 'number') });
            });

            // 5.3 電力需求彙總
            const pRows = Object.keys(GNAME).filter(g => eq.totals.byGroup[g] && eq.totals.byGroup[g].qty > 0).map(g => {
                const x = eq.totals.byGroup[g];
                return [GNAME[g], String(x.qty), num(x.installedCapKw, 0), num(x.connectedKw, 0), num(x.runningKw, 0)];
            });
            pRows.push({ _cls: 'tot', cells: [L('合計', 'Total'), String(eq.rows.reduce((a, r) => a + r.qtyTotal, 0)), '—', num(eq.totals.connectedKw, 0), num(eq.totals.runningKw, 0)] });

            return this.sec('equip', '5', L('設備規格與數量統整', 'Equipment schedule and quantities'), `
                ${this.note(L('全案相同「設備＋型號」合併為一列；共用機房的成員單元只計終端設備（CDU、CRAH 等），主機房設備計在機房。規格全部取自設備型錄，型錄沒有的欄位以「—」表示。',
                    'Identical equipment + model rows are merged project-wide; members of shared plants contribute terminal units only. All specs come from the device catalogue; missing fields show "—".'))}
                <h3 class="rpt-h3">5.1　${L('設備總表', 'Equipment summary')}</h3>
                <p class="rpt-note"><b>${L('主機房設備', 'Central plant equipment')}</b></p>
                ${plantRows.length ? this.table(head, plantRows, { alignRight: [2, 3, 5] }) : this.note('—')}
                <p class="rpt-note"><b>${L('終端設備', 'Terminal equipment')}</b></p>
                ${termRows.length ? this.table(head, termRows, { alignRight: [2, 3, 5] }) : this.note('—')}
                ${this.note(L('* 型錄無輸入功率，以「容量 ÷ COP」估算；† 泵為馬達額定功率（非軸功率）。', '* No input power in catalogue; estimated as capacity ÷ COP. † Pumps: rated motor power (not shaft power).'))}
                <h3 class="rpt-h3">5.2　${L('設備規格明細', 'Equipment specifications')}</h3>
                ${specHtml || this.note('—')}
                <h3 class="rpt-h3">5.3　${L('冷卻設備電力需求彙總', 'Cooling equipment electrical demand')}</h3>
                ${this.table([L('分組', 'Group'), L('台數', 'Qty'), L('裝置容量 kW', 'Installed cap. kW'), L('連接負載 kW', 'Connected kW'), L('運轉負載 kW（不含備用）', 'Running kW (excl. standby)')], pRows, { alignRight: [1, 2, 3, 4] })}
                ${this.formula([L('連接負載 = Σ 台數 × 單機耗電；運轉負載 = Σ 運轉台數 × 單機耗電（額定值，非逐時模擬值）', 'Connected = Σ qty × unit power; running = Σ running qty × unit power (rated, not hourly simulation)')])}
                ${this.note(L('電氣容量（變壓器、配電盤、緊急電源）檢討請相關專業另行審查。', 'Electrical capacity (transformers, switchboards, standby power) to be reviewed by the electrical discipline.'), true)}`);
        },

        // ───────────────────────── 主畫面 ─────────────────────────
        render(container) {
            const S = root.AppStore;
            const st = S.state;
            const R = st.results || {};
            const o = R.overall || {};
            const b = o.breakdownKwh || {};
            const meta = this.getMeta();
            const comp = o.compliance || { status: 'pass', sizingFailures: [] };
            const units = this.collectUnits(st);
            const systems = this.collectSystems(st, units);
            const lt = S.facilityLossTotals ? S.facilityLossTotals() : { totalPct: st.facilityElectricalLossPct || 0, heatPct: st.facilityElectricalLossPct || 0, auxKw: 0 };
            const fl = S.getFacilityLoads ? S.getFacilityLoads() : { lossItems: [], auxLoads: [] };
            const dc = S.designConditions ? S.designConditions() : {};
            const site = st.site || {};
            const stationName = site.stationName || site.selectedCity || '—';
            const docNo = meta.docNo || 'PUE-CALC-001';
            const rev = meta.revision || 'A';
            const statusTxt = comp.status === 'fail' ? L('不合格', 'NOT COMPLIANT') : (comp.status === 'warn' ? L('有待確認項目', 'REVIEW REQUIRED') : L('合格', 'COMPLIANT'));
            const hdr = (p) => `<div class="rpt-hdr"><span>${esc(docNo)}</span><span>${esc(meta.projectName || L('資料中心 PUE 計算書', 'Data Center PUE Calculation'))}</span><span>Rev ${esc(rev)}${p ? ' · ' + p : ''}</span></div>`;

            const coolKwh = (b.cduPump || 0) + (b.crahFan || 0) + (b.heatRejection || 0) + (b.chiller || 0);
            const totKwh = (b.it || 0) + coolKwh + (b.loss || 0);
            const itKwh = b.it || 0;

            // ── 封面 ──
            const metaRows = META_FIELDS.map(([k, zh, en]) => `<tr><th>${L(zh, en)}</th><td><input class="rpt-in" value="${esc(meta[k] || '')}" onchange="ViewReport.updateMeta('${k}', this.value)"></td></tr>`).join('');
            const cover = `<div class="rpt-page">${hdr('')}
                <div style="text-align:center;font-size:10px;letter-spacing:2px;color:#555;margin-top:24px">${L('業主審查用', 'FOR OWNER REVIEW')}</div>
                <div class="rpt-h1">${esc(meta.projectName || L('資料中心冷卻系統', 'Data Center Cooling System'))}</div>
                <div style="text-align:center;font-size:15px;margin-bottom:4px">${L('PUE／WUE 年度能耗計算書（8,760 h 逐時模擬）', 'Annual PUE / WUE Energy Calculation Report (8,760-h hourly simulation)')}</div>
                <div style="text-align:center;margin:14px 0 22px"><span class="rpt-stamp ${comp.status}">${statusTxt}</span></div>
                <table class="rpt-kv">${metaRows}
                    <tr><th>${L('計算依據', 'Basis')}</th><td>ISO/IEC 30134-2 / 30134-9 · ASHRAE TC 9.9 · ASHRAE 90.4 · AHRI 550/590 · CTI</td></tr>
                    <tr><th>${L('計算結果', 'Result')}</th><td>PUE ${num(o.annualPue, 3)}　·　${L('冷卻 pPUE（含泵）', 'Cooling pPUE (incl. pumps)')} ${num(o.annualCoolingPpue, 3)}　·　WUE ${num(o.annualWue, 3)} L/kWh</td></tr>
                </table>
                <div class="rpt-sign">
                    <div><b>${L('計算', 'Prepared')}</b><br><br>${esc(meta.preparedBy || '')}</div>
                    <div><b>${L('審核', 'Checked')}</b><br><br>${esc(meta.checkedBy || '')}</div>
                    <div><b>${L('核准', 'Approved')}</b><br><br>${esc(meta.approvedBy || '')}</div>
                </div>
                <h3 class="rpt-h3" style="margin-top:26px">${L('目錄', 'Contents')}</h3>
                <ol class="rpt-toc" style="padding-left:20px">
                    <li>${L('計算依據與方法', 'Basis and method')}</li><li>${L('設計條件', 'Design conditions')}</li><li>${L('負載彙總', 'Load summary')}</li>
                    <li>${L('冷卻系統選型核算', 'Cooling equipment sizing check')}</li><li>${L('設備規格與數量統整', 'Equipment schedule and quantities')}</li><li>${L('水力與泵耗', 'Hydraulics and pump power')}</li>
                    <li>${L('年度能量帳本', 'Annual energy ledger')}</li><li>${L('PUE／WUE 計算', 'PUE / WUE calculation')}</li>
                    <li>${L('平衡與合格檢核', 'Balance and compliance checks')}</li><li>${L('驗算範例（尖峰小時）', 'Worked example (peak hour)')}</li>
                    <li>${L('待確認事項', 'Open items')}</li><li>${L('附錄 A：工程假設值總表', 'Appendix A: Engineering assumptions')}</li><li>${L('附錄 B：逐時資料欄位說明', 'Appendix B: Hourly data columns')}</li>
                </ol>
            </div>`;

            // ── §1 依據與方法 ──
            const s1 = this.sec('basis', '1', L('計算依據與方法', 'Basis and method'), `
                ${this.table([L('項目', 'Item'), L('依據', 'Reference')], [
                    [L('PUE 定義', 'PUE definition'), 'ISO/IEC 30134-2：PUE = E<sub>DC</sub> ÷ E<sub>IT</sub>（' + L('年度能量比', 'annual energy ratio') + '）'],
                    [L('WUE 定義', 'WUE definition'), 'ISO/IEC 30134-9：WUE = W<sub>site</sub> [L] ÷ E<sub>IT</sub> [kWh]'],
                    [L('IT 進風環境', 'IT inlet environment'), 'ASHRAE TC 9.9 Thermal Guidelines, 5th ed.'],
                    [L('冰機性能', 'Chiller performance'), L('AHRI 550/590；ASHRAE 90.1 性能曲線（CapFT／EIRFT／EIRFPLR）', 'AHRI 550/590; ASHRAE 90.1 performance curves (CapFT / EIRFT / EIRFPLR)')],
                    [L('冷卻水塔', 'Cooling towers'), 'CTI STD-201 / ATC-105'],
                    [L('設計氣象', 'Design weather'), 'ASHRAE Handbook—Fundamentals ' + L('氣候資料（0.4%、n 年極值）', 'climatic data (0.4%, n-year extremes)')],
                    [L('能源標準', 'Energy standard'), 'ASHRAE 90.4']
                ])}
                ${this.note(L('方法：以 8,760 小時逐時氣象（乾球 DB、濕球 WB）逐時計算各冷卻設備的耗電，加總成年度能量後計算 PUE。設備選型（台數、降額、N+1）以設計工況核算；IT 負載為設計值 100%（另列部分負載情境）。',
                    'Method: equipment power is simulated for each of 8,760 hours from hourly dry-bulb / wet-bulb weather and summed to annual energy for PUE. Sizing (quantity, derating, N+1) is checked at design conditions; IT load is 100% of design (a partial-load case is listed separately).'))}
                ${this.formula([
                    'P_fac(h) = P_IT(h) + P_loss(h) + P_CDU+pump(h) + P_CRAH(h) + P_rej(h) + P_chiller(h)',
                    'P_loss(h) = P_IT(h) × Σ loss% ÷ 100 + Σ P_aux',
                    'E = Σ_h P(h) × 1 h　　PUE = E_fac ÷ E_IT'
                ])}`);

            // ── §2 設計條件 ──
            const s2 = this.sec('design', '2', L('設計條件', 'Design conditions'), this.table(
                [L('項目', 'Item'), L('數值', 'Value'), L('依據', 'Basis')], [
                    [L('氣象站', 'Weather station'), esc(stationName), site.userUploaded ? L('使用者匯入 EPW', 'User EPW') : L('內建 TMY', 'Built-in TMY')],
                    [L('設計乾球 DB', 'Design DB'), num(dc.designDb, 1) + ' °C', esc(dc.designBasis || '0.4%')],
                    [L('設計濕球 WB', 'Design WB'), num(dc.designWb, 1) + ' °C', esc(dc.designBasis || '0.4%')],
                    [L('極端乾球（尖峰選型）', 'Extreme DB (peak sizing)'), num(dc.peakDb?.value, 1) + ' °C', esc(dc.peakDb?.basis || '—')],
                    [L('TMY 最高乾球', 'TMY max DB'), num(dc.maxDb, 1) + ' °C', 'TMY'],
                    [L('年平均乾球／濕球', 'Annual mean DB / WB'), num(site.stats?.avgDB, 1) + ' / ' + num(site.stats?.avgWB, 1) + ' °C', 'TMY']
                ], { alignRight: [1] }) + (dc.dataQualityWarning ? this.note('⚠ ' + esc(dc.dataQualityWarning), true) : ''));

            // ── §3 負載 ──
            let tIt = 0, tLiq = 0, tAir = 0;
            const loadRows = units.map(u => {
                tIt += u.summ.totalItKw; tLiq += u.summ.liquidHeatKw; tAir += u.summ.airHeatKw;
                return [esc(u.kind), esc(u.hall), esc(u.obj.name), num(u.summ.totalItKw, 1), num(u.summ.liquidHeatKw, 1), num(u.summ.airHeatKw, 1), num(u.summ.dlcPct, 1) + '%'];
            });
            loadRows.push({ _cls: 'tot', cells: ['', '', L('合計', 'Total'), num(tIt, 1), num(tLiq, 1), num(tAir, 1), num(tIt > 0 ? tLiq / tIt * 100 : 0, 1) + '%'] });
            const lossHeatKw = tIt * lt.heatPct / 100;
            const lossRows = (fl.lossItems || []).map(x => [esc(L({ transformer: '變壓器', ups: 'UPS', pdu: 'PDU／配電線路', other: '其他配電損耗' }[x.key] || x.key, x.key)), num(x.pct, 2) + ' %', num(tIt * x.pct / 100, 1), x.heatToAir ? L('是', 'Yes') : L('否', 'No')]);
            const auxRows = (fl.auxLoads || []).map(x => [esc(L({ lighting: '照明', officeHvac: '辦公／支援區空調', mau: 'MAU／除濕', other: '其他輔助' }[x.key] || x.key, x.key)), '—', num(x.kw, 1), L('否', 'No')]);
            const s3 = this.sec('load', '3', L('負載彙總', 'Load summary'), `
                ${this.table([L('類別', 'Type'), 'Hall', L('單元', 'Unit'), 'IT kW', L('液冷 kW', 'Liquid kW'), L('氣冷 kW', 'Air kW'), 'DLC'], loadRows, { alignRight: [3, 4, 5, 6] })}
                <h3 class="rpt-h3">${L('配電損耗與輔助負載', 'Electrical losses and auxiliary loads')}</h3>
                ${this.table([L('項目', 'Item'), '% of IT', 'kW', L('熱進入氣冷區', 'Heat to air side')], [...lossRows, ...auxRows], { alignRight: [1, 2] })}
                ${this.formula([
                    `${L('需移除熱量', 'Heat to remove')} = IT + IT × ${num(lt.heatPct, 2)}% = ${num(tIt, 1)} + ${num(lossHeatKw, 1)} = ${num(tIt + lossHeatKw, 1)} kW`,
                    `${L('液冷側', 'Liquid side')} = ${num(tLiq, 1)} kW；${L('氣冷側', 'Air side')} = ${num(tAir, 1)} + ${num(lossHeatKw, 1)} = ${num(tAir + lossHeatKw, 1)} kW`
                ])}
                ${(fl.lossItems || []).some(x => x.key !== 'other' && x.pct > 0) ? '' : this.note(L('⚠ 配電損耗尚未依案場電力設計分項（全部在「其他」），數值待確認。', '⚠ Electrical losses not itemised from the site electrical design (all under "Other"); value to be confirmed.'), true)}`);

            // ── §4 選型核算 ──
            const SE = root.SizingEngine;
            const sizingBlocks = systems.map((sy, i) => {
                const sys = sy.sys;
                const rows = (sys.sizing || []).filter(s => !sy.terminalOnly || s.role === 'terminal').map(s => {
                    const red = s.redundancy || 'N+1';
                    const standby = SE ? SE.standbyUnits(s.selectedQty, red) : 1;
                    const run = Math.max(0, (s.selectedQty || 0) - standby);
                    const isPump = SE && SE.isPumpItem(s);
                    const margin = s.requiredKw > 0 ? ((s.effectiveCapKw / s.requiredKw) - 1) * 100 : 0;
                    return { _cls: s.passed === false && s.requiredKw > 0 ? 'ng' : '', cells: [
                        esc(String(s.label || s.key)), esc(s.selectedModel || '—'), num(s.unitCapKw, 1) + (isPump ? ' kW<sub>m</sub>' : ''),
                        isPump ? '—' : num(s.derateFactor ?? 1, 3), esc(red), num(s.requiredKw, 1), String(s.requiredUnits ?? '—'),
                        `${s.selectedQty} (${run}+${standby})`, num(s.effectiveCapKw, 0), (s.requiredKw > 0 ? num(margin, 1) + '%' : '—'),
                        s.requiredKw > 0 ? (s.passed ? '✓' : '✗') : '—'
                    ] };
                });
                const temps = sy.loop === 'liquid'
                    ? `FWS ${num(sys.fwsSupplyC, 1)} / ${num(sys.fwsReturnC, 1)} °C`
                    : `CHW ${num(sys.chwSupplyC, 1)} / ${num(sys.chwReturnC, 1)} °C`;
                return `<h3 class="rpt-h3">4.${i + 1}　${esc(sy.title)}（${sy.loop === 'liquid' ? L('液冷', 'Liquid') : L('氣冷', 'Air')}${sy.shared ? '・' + L('共用機房', 'shared plant') : ''}）</h3>
                    <p class="rpt-note">${L('架構', 'Architecture')}：${esc(this.archLabel(sys.architecture))}　·　${temps}${sy.members ? '　·　' + L('成員', 'Members') + '：' + esc(sy.members.join('、')) : ''}${sy.terminalOnly ? '　·　' + L('主機房設備見', 'Central plant: see') + ' ' + esc(sy.plantName) : ''}</p>
                    ${this.table([L('設備', 'Equipment'), L('型號', 'Model'), L('單機容量', 'Unit cap.'), L('降額', 'Derate'), L('冗餘', 'Redund.'), L('需求 kW', 'Req. kW'), L('需求台數', 'Req. qty'), L('選定（運轉+備用）', 'Selected (run+stby)'), L('有效容量 kW', 'Eff. cap kW'), L('餘裕', 'Margin'), L('判定', 'OK')], rows, { alignRight: [2, 3, 5, 6, 8, 9] })}`;
            }).join('');
            const s4 = this.sec('sizing', '4', L('冷卻系統選型核算', 'Cooling equipment sizing check'), `
                ${this.formula([
                    L('有效容量 = 運轉台數 × 單機容量 × 降額係數；運轉台數 = 選定台數 − 備用台數（N+1：1 台；N+2：2 台；2N：一半）',
                      'Effective capacity = running units × unit capacity × derate; running = selected − standby (N+1: 1; N+2: 2; 2N: half)'),
                    L('判定：有效容量 ≥ 需求，且台數 ≥ 冗餘最少台數。泵另檢核型錄流量與揚程（單機容量欄為馬達 kW）。',
                      'Pass: effective capacity ≥ requirement and quantity ≥ redundancy minimum. Pumps are also checked for catalog flow and head (unit capacity = motor kW).')
                ])}
                ${sizingBlocks || this.note(L('無選型資料', 'No sizing data'))}`);

            // ── §5 設備規格與數量統整（V10 Phase 6）──
            const sEq = this.renderEquipmentSection(st);

            // ── §6 水力 ──
            let pumpExample = null;
            const hydBlocks = systems.filter(sy => !sy.terminalOnly).map((sy, i) => {
                const pumps = sy.sys.hydraulics?.pumps || [];
                if (!pumps.length) return '';
                const rows = pumps.map(p => {
                    if (!pumpExample && p.power_kw > 0) pumpExample = p;
                    return [esc(this.pumpLabel(p)), num(p.q_kw, 0), num(p.dt_c, 1), num(p.cp, 2), num(p.flow_lpm, 0), num(p.flow_lpm * 0.06, 1), num(p.head_m, 1), num(p.eta_pump, 2), num(p.eta_motor, 2), num(p.power_kw, 1), p.operation === 'mechanical' ? L('冰機運轉時', 'chiller on') : L('連續', 'always')];
                });
                return `<h3 class="rpt-h3">6.${i + 1}　${esc(sy.title)}</h3>${this.table([L('泵組', 'Pump set'), 'Q kW', 'ΔT K', 'cp', 'L/min', 'm³/h', L('揚程 m', 'Head m'), 'η<sub>p</sub>', 'η<sub>m</sub>', L('設計 kW', 'Design kW'), L('運轉', 'Operation')], rows, { alignRight: [1, 2, 3, 4, 5, 6, 7, 8, 9] })}`;
            }).join('');
            const ex = pumpExample;
            const s5 = this.sec('hyd', '6', L('水力與泵耗', 'Hydraulics and pump power'), `
                ${this.formula([
                    L('流量 V [L/min] = Q [kW] × 60 ÷ (cp [kJ/kg·K] × ΔT [K])（密度取 1 kg/L）', 'Flow V [L/min] = Q [kW] × 60 ÷ (cp × ΔT) (density 1 kg/L)'),
                    L('電功率 P [kW] = V × H [m] × g ÷ (60,000 × η泵 × η馬達)，g = 9.81 m/s²', 'Electric power P [kW] = V × H × g ÷ (60,000 × η_pump × η_motor), g = 9.81 m/s²'),
                    L('逐時：P(h) = P_design × (0.15 + 0.85 × n³)，n = max(最低轉速, 負載率)（相似定律，保留 15% 靜壓）', 'Hourly: P(h) = P_design × (0.15 + 0.85 × n³), n = max(min speed, load ratio) (affinity laws with 15% static)'),
                    ex ? `${L('例', 'e.g.')} ${esc(this.pumpLabel(ex))}：V = ${num(ex.q_kw, 0)} × 60 ÷ (${num(ex.cp, 2)} × ${num(ex.dt_c, 1)}) = ${num(ex.flow_lpm, 0)} L/min；P = ${num(ex.flow_lpm, 0)} × ${num(ex.head_m, 1)} × 9.81 ÷ (60,000 × ${num(ex.eta_pump, 2)} × ${num(ex.eta_motor, 2)}) = ${num(ex.power_kw, 1)} kW` : ''
                ].filter(Boolean))}
                ${hydBlocks || this.note(L('無泵組資料', 'No pump data'))}
                ${this.note(L('⚠ 揚程為假設值（見附錄 A：*_pump_head_*），尚未依實際管路壓損計算；請以管路水力計算書核對。', '⚠ Pump heads are assumed values (Appendix A: *_pump_head_*), not computed from actual piping losses; verify against the piping hydraulic calculation.'), true)}`);

            // ── §6 能量帳本 ──
            const pct = (v) => itKwh > 0 ? num(v / itKwh * 100, 2) + '%' : '—';
            const ledRows = [
                ['IT', mwh(itKwh), '100%'],
                [L('CDU 本體＋全部循環泵', 'CDU units + all pumps'), mwh(b.cduPump), pct(b.cduPump)],
                [L('CRAH／風牆風扇', 'CRAH / fan-wall fans'), mwh(b.crahFan), pct(b.crahFan)],
                [L('排熱設備（乾冷器／冷卻塔風扇等）', 'Heat rejection fans'), mwh(b.heatRejection), pct(b.heatRejection)],
                [L('冰機壓縮機', 'Chiller compressors'), mwh(b.chiller), pct(b.chiller)],
                [L('配電損耗＋輔助負載', 'Electrical losses + auxiliary'), mwh(b.loss), pct(b.loss)],
                { _cls: 'tot', cells: [L('全廠合計', 'Facility total'), mwh(totKwh), pct(totKwh)] }
            ];
            const mRows = (R.monthlyPue || []).map(m => [String(m.month), num(m.itMwh, 0), num(m.coolingMwh, 0), num(m.lossMwh, 0), num(m.totalMwh, 0), num(m.pue, 3), num(m.coolingPpue ?? m.p_pue, 3)]);
            const cs = o.chillerCopStats || {};
            const fc = (x) => x ? `${num(x.freeHours)} / ${num(x.partialHours)} / ${num(x.mechHours)}` : '—';
            const s6 = this.sec('energy', '7', L('年度能量帳本', 'Annual energy ledger'), `
                ${this.table([L('項目', 'Item'), 'MWh/yr', '% of IT'], ledRows, { alignRight: [1, 2] })}
                <h3 class="rpt-h3">${L('月別', 'Monthly')}</h3>
                ${this.table([L('月', 'Month'), 'IT MWh', L('冷卻 MWh', 'Cooling MWh'), L('損耗 MWh', 'Loss MWh'), L('合計 MWh', 'Total MWh'), 'PUE', L('冷卻 pPUE', 'Cooling pPUE')], mRows, { alignRight: [1, 2, 3, 4, 5, 6] })}
                <h3 class="rpt-h3">${L('運轉模式時數（自然冷卻／部分／機械）', 'Operating mode hours (free / partial / mechanical)')}</h3>
                ${this.table([L('迴路', 'Loop'), 'h'], [[L('液冷側', 'Liquid loop'), fc(R.cduFcStats)], [L('氣冷側', 'Air loop'), fc(R.fwFcStats)], [L('全廠（兩側同時）', 'Facility (both loops)'), fc(R.combinedFcStats)]])}
                <h3 class="rpt-h3">${L('冰機 COP 統計', 'Chiller COP statistics')}</h3>
                ${this.table([L('運轉時數', 'Run hours'), L('季節 COP', 'Seasonal COP'), L('最低', 'Min'), L('最高', 'Max'), 'COP > 10 h'], [[num(cs.runHours), num(cs.seasonalCop, 2), num(cs.minCop, 2), num(cs.maxCop, 2), num(cs.hoursAbove10)]], { alignRight: [0, 1, 2, 3, 4] })}
                ${this.formula([L('COP(h) = 機械冷卻負載(h) ÷ 冰機耗電(h)；季節 COP = Σ 機械冷卻負載 ÷ Σ 冰機耗電', 'COP(h) = mechanical cooling load(h) ÷ chiller power(h); seasonal COP = Σ load ÷ Σ power')])}
                ${(cs.hoursAbove10 > 0) ? this.note(L(`⚠ 有 ${num(cs.hoursAbove10)} 小時冰機 COP > 10，請對照型錄部分負載資料確認模型是否偏樂觀。`, `⚠ ${num(cs.hoursAbove10)} h with chiller COP > 10; verify against catalogue part-load data.`), true) : ''}`);

            // ── §7 PUE / WUE ──
            const pl = R.partialLoad;
            const s7 = this.sec('pue', '8', L('PUE／WUE 計算', 'PUE / WUE calculation'), `
                ${this.formula([
                    `E_IT = ${mwh(itKwh, 1)} MWh`,
                    `E_cool = ${mwh(b.cduPump, 1)} + ${mwh(b.crahFan, 1)} + ${mwh(b.heatRejection, 1)} + ${mwh(b.chiller, 1)} = ${mwh(coolKwh, 1)} MWh`,
                    `E_loss = ${mwh(b.loss, 1)} MWh`,
                    `E_DC = ${mwh(itKwh, 1)} + ${mwh(coolKwh, 1)} + ${mwh(b.loss, 1)} = ${mwh(totKwh, 1)} MWh`,
                    `PUE = E_DC ÷ E_IT = ${mwh(totKwh, 1)} ÷ ${mwh(itKwh, 1)} = ${num(itKwh > 0 ? totKwh / itKwh : 0, 4)}　→　${num(o.annualPue, 3)}`,
                    `${L('冷卻 pPUE（含泵）', 'Cooling pPUE (incl. pumps)')} = (E_IT + E_cool) ÷ E_IT = ${num(itKwh > 0 ? (itKwh + coolKwh) / itKwh : 0, 4)}`,
                    `WUE = ${num(o.annualWaterM3, 0)} m³ × 1,000 ÷ ${num(itKwh, 0)} kWh = ${num(o.annualWue, 3)} L/kWh`,
                    `${L('尖峰小時 PUE', 'Peak-hour PUE')} = ${num(o.peakPue, 3)}（${o.peakMonth}${L(' 月 ', '/')}${o.peakHour}:00）`
                ])}
                ${pl ? this.table([L('情境', 'Case'), 'PUE', L('冷卻 pPUE', 'Cooling pPUE'), 'IT MWh', L('全廠 MWh', 'Total MWh')], [
                    [L('設計值 100%', 'Design 100%'), num(o.annualPue, 3), num(o.annualCoolingPpue, 3), num(o.annualItMwh), num(o.annualTotalMwh)],
                    [L(`部分負載 ${pl.factorPct}%`, `Partial ${pl.factorPct}%`), num(pl.annualPue, 3), num(pl.annualCoolingPpue, 3), num(pl.annualItMwh), num(pl.annualTotalMwh)]
                ], { alignRight: [1, 2, 3, 4] }) + this.note(L('部分負載情境：選型與水力維持 100% 設計值，只把模擬時的負載乘上負載率；配電損耗按 IT 比例計算，沒有模擬固定損耗。', 'Partial-load case: sizing and hydraulics at 100% design; only simulated loads scaled; electrical losses proportional (no fixed losses).')) : ''}`);

            // ── §8 檢核 ──
            const el = o.energyLedger || {}, th = o.thermalLedger || {};
            const chk = (ok) => ok ? '✓' : '✗';
            const failRows = (comp.sizingFailures || []).map(f => ({ _cls: 'ng', cells: [esc(f.owner), f.system === 'liquid' ? L('液冷', 'Liquid') : L('氣冷', 'Air'), esc(f.key), esc(f.model) + ' × ' + f.qty, num(f.effectiveCapKw), num(f.requiredKw)] }));
            const s8 = this.sec('checks', '9', L('平衡與合格檢核', 'Balance and compliance checks'), `
                ${this.table([L('檢核項目', 'Check'), L('內容', 'Detail'), L('結果', 'Result')], [
                    [L('能量平衡', 'Energy balance'), `E_DC = E_IT + E_cool + E_loss：${mwh(el.facility_total_kwh, 1)} = ${mwh(el.it_kwh, 1)} + ${mwh(el.hvac_kwh, 1)} + ${mwh(el.loss_kwh, 1)} MWh`, chk(el.is_balanced)],
                    [L('熱平衡', 'Thermal balance'), `${L('產生熱', 'Heat generated')} ${mwh(th.total_heat_generated_kwh, 1)} MWh − ${L('移除熱', 'removed')} ${mwh(th.total_heat_removed_kwh, 1)} MWh = ${mwh(th.imbalance_kwh, 1)} MWh`, chk(th.is_balanced)],
                    [L('共用機房分攤', 'Shared-plant allocation'), (el.plant_allocations || []).map(p => `${esc(p.plantName)}：${mwh(p.plantTotalKwh, 1)} → ${mwh(p.allocatedKwh, 1)} MWh`).join('<br>') || '—', el.plant_allocations ? chk(el.plant_allocations_balanced) : '—'],
                    [L('容量不足時數', 'Capacity deficit hours'), `${num(comp.deficitHours)} h，${L('最大缺口', 'max')} ${num(comp.maxDeficitKw)} kW`, chk(!(comp.deficitHours > 0))],
                    [L('選型檢核', 'Sizing checks'), `${(comp.sizingFailures || []).length} ${L('項不合格', 'item(s) failed')}`, chk(!(comp.sizingFailures || []).length)]
                ])}
                ${failRows.length ? this.table([L('單元', 'Unit'), L('迴路', 'Loop'), L('設備', 'Equip.'), L('型號 × 台數', 'Model × qty'), L('有效容量', 'Eff. cap'), L('需求', 'Req.')], failRows, { alignRight: [4, 5] }) : ''}
                ${comp.status === 'fail' ? this.note(L('⚠ 判定不合格：存在容量不足或熱平衡未閉合，本計算書的 PUE 可能被低估，不可作為最終結果。', '⚠ NOT COMPLIANT: capacity deficit or open thermal balance; PUE may be underestimated and must not be used as final.'), true) : ''}`);

            // ── §9 驗算範例 ──
            const ph = this.peakHour(R.hourlyProfile);
            let s9 = '';
            const modeTxt = (m) => ({ free: L('自然冷卻', 'free cooling'), partial: L('部分自然冷卻', 'partial'), mechanical: L('機械冷卻', 'mechanical') }[m] || m || '—');
            if (ph) {
                const lossH = ph.itKw * lt.totalPct / 100 + lt.auxKw;
                const sumH = ph.itKw + ph.cduPumpKw + ph.crahFanKw + ph.heatRejKw + ph.chillerKw + lossH;
                s9 = this.sec('example', '10', L('驗算範例（尖峰小時）', 'Worked example (peak hour)'), `
                    ${this.note(L(`第 ${ph.hourIndex + 1} 小時（${ph.month} 月第 ${ph.dayOfYear} 天 ${ph.hourOfDay}:00），DB ${num(ph.db, 1)} °C、WB ${num(ph.wb, 1)} °C；液冷 ${modeTxt(ph.cduMode)}、氣冷 ${modeTxt(ph.fwMode)}。`, `Hour ${ph.hourIndex + 1} (month ${ph.month}, day ${ph.dayOfYear}, ${ph.hourOfDay}:00), DB ${num(ph.db, 1)} °C, WB ${num(ph.wb, 1)} °C; liquid ${modeTxt(ph.cduMode)}, air ${modeTxt(ph.fwMode)}.`))}
                    ${this.formula([
                        `P_IT = ${num(ph.itKw, 1)} kW`,
                        `P_loss = ${num(ph.itKw, 1)} × ${num(lt.totalPct, 2)}% + ${num(lt.auxKw, 1)} = ${num(lossH, 1)} kW`,
                        `P_cool = ${num(ph.cduPumpKw, 1)} + ${num(ph.crahFanKw, 1)} + ${num(ph.heatRejKw, 1)} + ${num(ph.chillerKw, 1)} = ${num(ph.coolingKw, 1)} kW`,
                        `P_fac = ${num(ph.itKw, 1)} + ${num(lossH, 1)} + ${num(ph.coolingKw, 1)} = ${num(sumH, 1)} kW　(${L('引擎', 'engine')} ${num(ph.totalKw, 1)} kW)`,
                        `PUE(h) = ${num(sumH, 1)} ÷ ${num(ph.itKw, 1)} = ${num(ph.itKw > 0 ? sumH / ph.itKw : 0, 4)}`,
                        ph.chillerKw > 0 ? `COP(h) = ${num(ph.mechLoadKw, 1)} ÷ ${num(ph.chillerKw, 1)} = ${num(ph.mechLoadKw / ph.chillerKw, 2)}` : ''
                    ].filter(Boolean))}
                    ${this.note(L('審查方可下載逐時 CSV（附錄 B），任選一小時以相同方式重算，再加總 8,760 小時核對第 7、8 節。', 'Reviewers can download the hourly CSV (Appendix B), recompute any hour the same way, and sum 8,760 hours to verify Sections 7–8.'))}`);
            }

            // ── §10 待確認事項 ──
            const open = [];
            if (!(fl.lossItems || []).some(x => x.key !== 'other' && x.pct > 0)) open.push(L('配電損耗未分項（變壓器、UPS、PDU），請依電力設計填入。', 'Electrical losses not itemised (transformer, UPS, PDU).'));
            if (!(fl.auxLoads || []).some(x => x.kw > 0)) open.push(L('未計入照明、辦公空調、MAU 等輔助負載。', 'Lighting, office HVAC, MAU and other auxiliary loads not entered.'));
            open.push(L('泵揚程為假設值，未依實際管路壓損計算（第 6 節）。', 'Pump heads are assumed, not from piping loss calculation (Section 6).'));
            open.push(L('部分負載未模擬變壓器空載損失與 UPS 低負載效率曲線。', 'Transformer no-load loss and UPS low-load efficiency not modelled.'));
            if (cs.hoursAbove10 > 0) open.push(L('冰機 COP 有超過 10 的時段，需對照型錄。', 'Chiller COP exceeds 10 in some hours; check catalogue.'));
            if (comp.status !== 'pass') open.push(L('合格檢核未通過，見第 9 節。', 'Compliance checks not passed; see Section 9.'));
            const eqW = (root.EquipmentSchedule ? root.EquipmentSchedule.build(st).warnings : []);
            const noSrc = eqW.filter(w => w.type === 'noSource').map(w => w.model);
            const unver = eqW.filter(w => w.type === 'unverified').map(w => w.model);
            const noPwr = eqW.filter(w => w.type === 'noPower').map(w => w.model);
            if (noSrc.length) open.push(L('下列設備型錄沒有出處，需以送審型錄核對：', 'No catalogue source for: ') + esc(noSrc.join('、')));
            if (unver.length) open.push(L('下列設備型錄有出處但未驗證：', 'Catalogue source present but unverified: ') + esc(unver.join('、')));
            if (noPwr.length) open.push(L('下列設備型錄沒有耗電資料，電力需求彙總未計入：', 'No power data (excluded from power summary): ') + esc(noPwr.join('、')));
            const s10 = this.sec('open', '11', L('待確認事項', 'Open items'), `<ol class="rpt-ol" style="padding-left:20px">${open.map(x => `<li>⚠ ${x}</li>`).join('')}</ol>`);

            // ── 附錄 A：假設值 ──
            const AS = root.ASSUMPTIONS || {};
            const ov = st.assumptions_override || {};
            const aRows = Object.keys(AS).map(k => {
                const a = AS[k];
                const val = (ov[k] !== undefined) ? ov[k] : a.val;
                return { _cls: ov[k] !== undefined ? 'ng' : '', cells: [`<code>${esc(k)}</code>`, esc(isEn() && a.label_en ? a.label_en : a.label), esc(typeof val === 'object' ? JSON.stringify(val) : val) + (ov[k] !== undefined ? ' *' : ''), esc(a.unit || ''), esc(a.ref || '—')] };
            });
            const sA = this.sec('appA', L('附錄 A', 'Appendix A'), L('工程假設值總表', 'Engineering assumptions'), `
                ${this.note(L('來源：js/assumptions.js。標 * 並著色者為本專案覆寫值。', 'Source: js/assumptions.js. Rows marked * are project overrides.'))}
                ${this.table(['Key', L('說明', 'Description'), L('數值', 'Value'), L('單位', 'Unit'), L('出處', 'Reference')], aRows, { alignRight: [2] })}`);

            // ── 附錄 B ──
            const sB = this.sec('appB', L('附錄 B', 'Appendix B'), L('逐時資料欄位說明', 'Hourly data columns'), `
                ${this.note(L('按上方「下載 8,760 h 逐時 CSV」取得資料。欄位：時序、月、日、時、DB、WB、各迴路運轉模式、IT kW、CDU＋泵 kW、CRAH kW、排熱 kW、冰機 kW、機械冷卻負載 kW、冷卻小計 kW、全廠 kW、PUE(h)、耗水 m³。', 'Use "Download 8,760-h CSV" above. Columns: index, month, day, hour, DB, WB, loop modes, IT kW, CDU+pumps kW, CRAH kW, heat rejection kW, chiller kW, mechanical load kW, cooling kW, facility kW, PUE(h), water m³.'))}
                ${this.formula([L('核對：Σ 全廠 kW × 1 h ÷ 1,000 = 第 8 節 E_DC（MWh）；Σ IT kW × 1 h ÷ 1,000 = E_IT', 'Check: Σ facility kW × 1 h ÷ 1,000 = E_DC in Section 8; Σ IT kW × 1 h ÷ 1,000 = E_IT')])}`);

            const toolbar = `<div class="no-print flex items-center justify-between gap-2 flex-wrap mb-4 p-3 rounded-xl border border-border bg-surface">
                <div class="text-xs text-secondary">${L('Step 6：可驗證計算書。封面欄位可直接編輯（隨專案儲存）；列印時選「另存為 PDF」、A4 直式。', 'Step 6: verifiable report. Cover fields are editable (saved with the project); print to PDF, A4 portrait.')}</div>
                <div class="flex gap-2">
                    <button onclick="ViewReport.downloadCsv()" class="px-3 py-1.5 rounded-lg border border-border text-xs font-semibold bg-bg hover:bg-border-subtle">${L('下載 8,760 h 逐時 CSV', 'Download 8,760-h CSV')}</button>
                    <button onclick="ViewReport.print()" class="px-3 py-1.5 rounded-lg text-xs font-semibold bg-brand-600 text-white hover:bg-brand-700">${L('列印／另存 PDF', 'Print / Save PDF')}</button>
                </div>
            </div>`;

            let body = `<div class="rpt-wrap" id="reportRoot">${cover}<div class="rpt-page">${hdr(L('本文', 'Body'))}${s1}${s2}${s3}${s4}${sEq}${s5}${s6}${s7}${s8}${s9}${s10}</div><div class="rpt-page">${hdr(L('附錄', 'Appendix'))}${sA}${sB}</div></div>`;
            // 英文模式：把版面用的全形標點換成半形（使用者資料中的全形標點一併轉換，不影響內容）
            if (isEn()) {
                body = body.replace(/　/g, ' ').replace(/：/g, ': ').replace(/（/g, ' (').replace(/）/g, ')')
                    .replace(/、/g, ', ').replace(/，/g, ', ').replace(/；/g, '; ').replace(/／/g, '/');
            }
            container.innerHTML = this.styles() + toolbar + body;
        }
    };

    root.ViewReport = ViewReport;
})(typeof window !== 'undefined' ? window : this);
