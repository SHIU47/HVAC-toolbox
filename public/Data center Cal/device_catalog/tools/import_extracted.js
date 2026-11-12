/**
 * import_extracted.js — 把 AGV 抽取、經人工抽查的設備資料（_extracted/*.json）
 * 轉成 Data center Cal 型錄格式，輸出到 device_catalog/verified/。
 *
 * 用法：
 *   node device_catalog/tools/import_extracted.js <_extracted 資料夾路徑>
 *
 * 原則（見 PUE_V11_設備型錄併入計畫.md）：
 *   - 不修改既有型錄檔；只寫 verified/ 底下的檔案，可重複執行。
 *   - 數值一律照抽取檔；換算（例：多台合計 → 單台、流量×溫差 → 排熱量）在 _derived 註明。
 *   - 關鍵欄位缺漏、數值取自圖片（⚠ 需人工確認）、或引擎目前沒有對應類別者，
 *     不進可選型錄，改列在 verified/_unmapped.json 並寫明原因。
 *   - 型號名稱附設計工況標記，避免和既有同名型號互相覆蓋。
 */
const fs = require('fs');
const path = require('path');

const SRC_DIR = process.argv[2];
if (!SRC_DIR || !fs.existsSync(SRC_DIR)) {
    console.error('用法：node device_catalog/tools/import_extracted.js <_extracted 資料夾路徑>');
    process.exit(1);
}
const OUT_DIR = path.join(__dirname, '..', 'verified');
fs.mkdirSync(OUT_DIR, { recursive: true });

const TODAY = new Date().toISOString().slice(0, 10);
const load = (name) => {
    const f = path.join(SRC_DIR, name + '.json');
    return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')).models || [] : [];
};
const num = (v) => (typeof v === 'number' && isFinite(v)) ? v : null;
const r1 = (v) => Math.round(v * 10) / 10;
const notesText = (m) => [].concat(m.notes || []).join(' ');

// 人工排除清單：抽取正確，但不適合當「額定」型錄值（原因寫明，會列進 _unmapped.json）
const MANUAL_EXCLUDE = [
    { file: '02_chiller.json', model: 'XCAF1212A', chws: 25,
      reason: '選型報告是依「需求冷量 1000 kW」計算的運轉點（Maximum Cooling Capacity 欄空白），不是滿載額定；EER 6.15 屬部分負載值，當設計 COP 會偏樂觀' }
];
function manualExclusion(file, m) {
    const hit = MANUAL_EXCLUDE.find(x => x.file === file && x.model === m.model && (x.chws == null || (m.rating || {}).chws_c === x.chws));
    return hit ? hit.reason : null;
}

// 廠商名稱統一
const VENDOR_ALIAS = [
    [/^施耐德\s*Motivair|Motivair/i, 'Motivair (Schneider)'],
    [/^施耐德|Schneider/i, 'Schneider Electric'],
    [/^三菱|Mitsubishi/i, 'Mitsubishi Electric'],
    [/^維諦|Vertiv/i, 'Vertiv']
];
// 廠商簡稱：取括號前的名稱，中英並列者取英文
function vendorShort(v) {
    const s = String(v || '').trim();
    for (const [re, name] of VENDOR_ALIAS) if (re.test(s)) return name;
    const paren = s.match(/\(([A-Za-z][^)]*)\)/);
    if (/^[^A-Za-z]/.test(s) && paren) return paren[1].trim();          // 良機 (Liang Chi) → Liang Chi
    return s.replace(/\s*\(.*$/, '').trim() || 'Vendor';
}
// 顯示名稱：廠商 + 型號（型號已含廠商名者不重複）
function displayName(m) {
    const vendor = vendorShort(m.vendor), model = String(m.model || '').trim();
    const first = vendor.split(/\s+/)[0].toLowerCase();
    return model.toLowerCase().startsWith(first) ? model : `${vendor} ${model}`;
}
// 出處：抽取檔的 src 可能是 {欄位: "檔名 頁碼"} 或 {file, page}
function sourceText(m) {
    const src = m.src || {};
    if (src.file) return `${src.file}${src.page != null ? ' p.' + src.page : ''}`;
    const set = new Set();
    Object.values(src).forEach(v => { if (typeof v === 'string') set.add(v.replace(/\s*第[\d\-、,～~]+頁.*$/, '').trim()); });
    return [...set].join('；');
}
// 數值取自圖片、需人工確認者
function isImageOnly(m) {
    const t = JSON.stringify(m);
    return /⚠/.test(t) && /(圖片|圖表|曲線圖|性能曲線)/.test(t) && /人工確認/.test(t);
}
// 移除案名、報價號等專案資訊（型錄會進 git，不放案場資料）
function scrubProjectInfo(s) {
    return String(s)
        .replace(/專案[:：]?\s*[^，,。；;]*Project[^，,。；;]*/gi, '專案資訊略')
        .replace(/[^，,。；;\s]*(Foxconn|鴻海|龍慶)[^，,。；;]*/gi, '專案資訊略')
        .replace(/報價(號|單號)?[:：]?\s*[\w\-\/]+/g, '報價號略');
}
function flagsOf(m) {
    const out = [];
    const ck = m.check || {};
    if (ck.flag) out.push(ck.flag);
    if (ck.heat_balance_ok === false && !ck.flag) out.push('⚠ 熱平衡檢查未通過');
    return out;
}
function baseMeta(m, file) {
    return {
        _verified: true,
        _model_raw: m.model,
        _source: sourceText(m),
        _extracted_from: file,
        _doc_type: m.doc_type,
        _imported_at: TODAY,
        _flags: flagsOf(m),
        _rating: m.rating,
        _part_load: (m.part_load && m.part_load.length) ? m.part_load : undefined,
        _notes: [].concat(m.notes || []).map(scrubProjectInfo)
    };
}

const out = { chiller: {}, cooling_tower: {}, dry_cooler: {}, cdu: {}, crah: [], rdhx: {} };
const unmapped = [];
const report = { imported: {}, skipped: [] };
const names = new Set();
function uniqueName(n) {
    let name = n, i = 2;
    while (names.has(name)) name = `${n} #${i++}`;
    names.add(name);
    return name;
}
function skip(file, m, reason, toUnmapped = true) {
    report.skipped.push({ file, model: m.model, vendor: m.vendor, reason });
    if (toUnmapped) unmapped.push({ reason, _extracted_from: file, ...m, notes: [].concat(m.notes || []).map(scrubProjectInfo) });
}
function count(cat) { report.imported[cat] = (report.imported[cat] || 0) + 1; }

// ───────── 冰水主機 ─────────
// 曲線對照（同 device_catalog/chiller/*.json 舊型錄的用法）：
//   氣冷 磁浮／離心 → air_cooled_vfd_centrifugal（vertiv、schneider.json）；氣冷 螺旋／渦卷 → air_cooled_screw
//   水冷 磁浮 → centrifugal_higheff（trane Turbocor）；水冷 離心 → centrifugal_standard；水冷 螺旋／渦卷 → screw_standard
function curvePreset(isAir, comp) {
    const c = String(comp || '');
    if (isAir) return /magnetic|centrifugal/.test(c) ? 'air_cooled_vfd_centrifugal' : 'air_cooled_screw';
    if (/magnetic/.test(c)) return 'centrifugal_higheff';
    if (/centrifugal/.test(c)) return 'centrifugal_standard';
    return 'screw_standard';
}
const COMPRESSOR_LABEL = {
    magnetic_bearing: 'Magnetic Bearing Centrifugal',
    centrifugal: 'Centrifugal',
    screw: 'Screw',
    scroll: 'Scroll'
};
for (const m of load('02_chiller')) {
    const F = '02_chiller.json', v = m.values || {}, r = m.rating || {};
    if (isImageOnly(m)) { skip(F, m, '數值取自圖片，待使用者確認'); continue; }
    const ex = manualExclusion(F, m);
    if (ex) { skip(F, m, ex); continue; }
    const cap = num(v.cooling_capacity_kw), pw = num(v.power_input_kw);
    let cop = num(v.cop), derived = null;
    if (cop == null && cap && pw) { cop = Math.round(cap / pw * 100) / 100; derived = `cop = 冷量 ${cap} / 耗電 ${pw}（文件未直接列 COP）`; }
    if (!cap || !cop) { skip(F, m, '缺冷量或 COP／耗電'); continue; }
    const units = num(r.units_in_selection) || 1;
    const isAir = v.chiller_type === 'air_cooled';
    const tCond = isAir ? num(r.ambient_c) : num(r.cond_in_c);
    const cond = isAir ? (tCond != null ? `OA ${tCond}°C` : 'OA ?') : (tCond != null ? `CW ${tCond}°C` : 'CW ?');
    const tag = `CHW ${r.chws_c ?? '?'}/${r.chwr_c ?? '?'}°C, ${cond}`;
    const name = uniqueName(`${displayName(m)} [${tag}]`);
    out.chiller[name] = {
        model: name,
        vendor: vendorShort(m.vendor),
        chiller_type: isAir ? 'air_cooled' : 'water_cooled',
        category: `${COMPRESSOR_LABEL[v.compressor] || v.compressor || 'Chiller'} (${isAir ? 'Air-Cooled' : 'Water-Cooled'})`,
        cooling_capacity_kw: cap,
        cop_design: cop,
        power_input_kw: pw,
        t_chws_c: num(r.chws_c),
        t_chwr_c: num(r.chwr_c),
        t_cewt_design_c: tCond,
        glycol_pct: num(r.glycol_pct),
        // 與舊型錄同型式機種用同一條 AHRI 曲線（含部分負載 EIR_FPLR），引擎以本機額定點歸一化
        cop_curve: { type: 'ahri_biquadratic', preset: curvePreset(isAir, v.compressor) },
        refrigerant: v.refrigerant,
        has_free_cooling_coil: v.has_free_cooling_coil,
        seer: num(v.seer), sepr: num(v.sepr), iplv: num(v.iplv), nplv: num(v.nplv),
        chw_flow_m3h: num(v.chw_flow_m3h),
        evap_pressure_drop_kpa: num(v.evap_pressure_drop_kpa),
        units_in_selection: units,
        _derived: derived || undefined,
        ...baseMeta(m, F)
    };
    count('chiller');
}

// ───────── 冷卻水塔（目前抽取資料全為密閉式） ─────────
for (const m of load('03_cooling_tower')) {
    const F = '03_cooling_tower.json', v = m.values || {}, r = m.rating || {};
    if (isImageOnly(m)) { skip(F, m, '數值取自圖片，待使用者確認'); continue; }
    const units = num(r.units_in_selection) || 1;
    let q = num(v.heat_rejection_kw_per_unit), derived = [];
    if (q == null && num(v.heat_rejection_kw) != null) { q = v.heat_rejection_kw / units; derived.push(`單台排熱 = ${v.heat_rejection_kw} / ${units} 台`); }
    if (q == null && num(v.heat_rejection_kw_calc) != null) {
        q = r1(v.heat_rejection_kw_calc / units);
        derived.push(`單台排熱 = 1.163 × 流量 ${v.flow_m3h} m³/h × ΔT ${r.fluid_in_c - r.fluid_out_c} K${units > 1 ? ' / ' + units + ' 台' : ''}（型錄只列流量）`);
    }
    const fan = num(v.fan_kw);
    if (!q || !fan) { skip(F, m, '缺排熱量或風扇功率'); continue; }
    const tag = `${r.fluid_in_c}→${r.fluid_out_c}°C, WB ${r.wb_c}°C`;
    const name = uniqueName(`${displayName(m)} [${tag}]`);
    out.cooling_tower[name] = {
        model: name,
        vendor: vendorShort(m.vendor),
        tower_type: v.tower_type || 'closed_tower',
        heat_rejection_kw: q,
        fan_kw_dx: fan,
        fan_kw_fc: null,
        approach_design_c: num(v.approach_c),
        fluid_temp_in_c: num(r.fluid_in_c),
        fluid_temp_out_c: num(r.fluid_out_c),
        wet_bulb_design_c: num(r.wb_c),
        glycol_pct: num(r.glycol_pct),
        flow_rate_m3h: num(v.flow_m3h) != null ? r1(v.flow_m3h / units) : null,
        spray_pump_kw: num(v.spray_pump_kw),
        fan_qty: num(v.fan_qty),
        cell_qty: num(v.cell_qty),
        fluid_pressure_drop_kpa: num(v.coil_pressure_drop_kpa),
        weight_kg: num(v.weight_operating_kg),
        units_in_selection: units,
        _derived: derived.length ? derived.join('；') : undefined,
        ...baseMeta(m, F)
    };
    count('cooling_tower');
}

// ───────── 乾冷器（絕熱型目前引擎無專屬類別 → _unmapped） ─────────
for (const m of load('04_dry_cooler')) {
    const F = '04_dry_cooler.json', v = m.values || {}, r = m.rating || {};
    if (isImageOnly(m)) { skip(F, m, '數值取自圖片，待使用者確認'); continue; }
    if (r.type !== 'dry_cooler') { skip(F, m, `類型 ${r.type}：絕熱（噴淋）工況容量，引擎目前沒有對應的型錄類別`); continue; }
    const units = num(r.units_in_selection) || 1;
    const q = num(v.heat_rejection_kw_per_unit) ?? (num(v.heat_rejection_kw_total) != null ? v.heat_rejection_kw_total / units : null);
    const fan = num(v.fan_kw);
    if (!q || !fan) { skip(F, m, '缺排熱量或風扇功率'); continue; }
    const tag = `${r.fluid_in_c}→${r.fluid_out_c}°C, DB ${r.design_db_c}°C${r.glycol_pct ? ', glycol ' + r.glycol_pct + '%' : ''}`;
    const name = uniqueName(`${displayName(m)} [${tag}]`);
    out.dry_cooler[name] = {
        category: 'dry_cooler',
        model: name,
        vendor: vendorShort(m.vendor),
        heat_rejection_kw: q,
        fan_kw_dx: fan,            // 選型點（設計外氣、額定排熱）的風扇功率；引擎以此為 100% 負載點
        fan_kw_fc: null,
        approach_temp_c: num(v.approach_c),
        design_db_c: num(r.design_db_c),
        fluid_temp_in_c: num(r.fluid_in_c),
        fluid_temp_out_c: num(r.fluid_out_c),
        glycol_type: r.glycol_type, glycol_pct: num(r.glycol_pct),
        flow_rate_m3h: num(v.flow_m3h) != null ? r1(v.flow_m3h / units) : null,
        pressure_drop_kpa: num(v.pressure_drop_kpa),
        fan_qty: num(v.fan_qty), fan_type: v.fan_type,
        weight_kg: num(v.weight_operating_kg),
        units_in_selection: units,
        _annual: m.annual || undefined,
        ...baseMeta(m, F)
    };
    count('dry_cooler');
}

// ───────── CDU ─────────
for (const m of load('01_cdu')) {
    const F = '01_cdu.json', v = m.values || {}, r = m.rating || {};
    if (isImageOnly(m)) { skip(F, m, '數值取自圖片，待使用者確認'); continue; }
    if (r.primary_fluid === 'air') { skip(F, m, '一次側為空氣（液對氣 CDU），不適用設施水系統架構'); continue; }
    const cap = num(v.capacity_kw), pw = num(v.power_kw);
    if (!cap || !pw) { skip(F, m, '缺容量或耗電（文件未列 CDU 耗電）'); continue; }
    const name = uniqueName(`${displayName(m)}`);
    out.cdu[name] = {
        category: 'CDU',
        model: name,
        vendor: vendorShort(m.vendor),
        cooling_capacity_kw: cap,
        power_kw: pw,
        approach_c: num(v.approach_c),
        primary_supply_c: num(r.primary_supply_c),
        secondary_supply_c: num(r.secondary_supply_c),
        secondary_return_c: num(r.secondary_return_c),
        secondary_fluid: r.secondary_fluid, glycol_pct: num(r.glycol_pct),
        pump_qty: num(v.pump_qty), pump_config: v.pump_config,
        secondary_flow_lpm: num(v.secondary_flow_lpm), primary_flow_lpm: num(v.primary_flow_lpm),
        external_pressure_drop_kpa: num(v.external_pressure_drop_kpa),
        mounting: v.mounting,
        ...baseMeta(m, F)
    };
    count('cdu');
}

// ───────── 冰水末端：風牆、AHU、InRow CHW → crah；RDHx → rdhx；DX 類 → _unmapped ─────────
function pushCrah(m, F) {
    const v = m.values || {}, r = m.rating || {};
    const sens = num(v.sensible_cooling_kw) ?? num(v.total_cooling_kw);
    const fan = num(v.fan_power_kw);
    if (!sens || !fan) { skip(F, m, '缺冷量或風扇功率'); return; }
    const dT = (num(r.chw_in_c) != null && num(r.chw_out_c) != null) ? r1(r.chw_out_c - r.chw_in_c) : null;
    const tag = `CHW ${r.chw_in_c ?? '?'}/${r.chw_out_c ?? '?'}°C, RA ${r.return_air_db_c ?? '?'}°C`;
    const name = uniqueName(`${displayName(m)} [${tag}]`);
    out.crah.push({
        model: name,
        vendor: vendorShort(m.vendor),
        unit_type: r.unit_type,
        capacityKw: sens,                 // 以顯熱冷量選台數（IT 負載為顯熱）
        totalCapacityKw: num(v.total_cooling_kw),
        shr: num(v.shr),
        fanPowerKw: fan,
        fanQty: num(v.fan_qty),
        airflowM3h: num(v.airflow_m3h),
        chwInletTempC: num(r.chw_in_c),
        chwDeltaTC: dT,
        returnAirDbC: num(r.return_air_db_c),
        externalStaticPa: num(r.external_static_pa),
        chwFlowM3h: num(v.chw_flow_m3h),
        waterPressureDropKpa: num(v.water_pressure_drop_kpa),
        ...baseMeta(m, F)
    });
    count('crah');
}
for (const m of load('05_06_crah')) {
    const F = '05_06_crah.json', t = (m.rating || {}).unit_type;
    if (isImageOnly(m)) { skip(F, m, '數值取自圖片，待使用者確認'); continue; }
    if (t === 'crac_dx') { skip(F, m, '直膨式（DX）機組，引擎目前沒有對應類別'); continue; }
    pushCrah(m, F);
}
for (const m of load('07_08_inrow_rdhx')) {
    const F = '07_08_inrow_rdhx.json', v = m.values || {}, r = m.rating || {}, t = r.unit_type;
    if (isImageOnly(m)) { skip(F, m, '數值取自圖片，待使用者確認'); continue; }
    if (t === 'inrow_chw') { pushCrah(m, F); continue; }
    if (t === 'rdhx_active' || t === 'rdhx_passive') {
        const cap = num(v.total_cooling_kw), fan = num(v.fan_power_kw);
        if (!cap || fan == null) { skip(F, m, '缺冷量或風扇功率'); continue; }
        const name = uniqueName(`${displayName(m)} [CHW ${r.chw_in_c ?? '?'}°C, room ${r.return_air_db_c ?? '?'}°C]`);
        out.rdhx[name] = {
            category: 'RDHX',
            model: name,
            vendor: vendorShort(m.vendor),
            unit_type: t,
            cooling_capacity_kw: cap,
            fan_power_kw: fan,
            chw_supply_temp_c: num(r.chw_in_c),
            fan_qty: num(v.fan_qty),
            ...baseMeta(m, F)
        };
        count('rdhx');
        continue;
    }
    skip(F, m, `${t}（直膨／水冷直膨）機組，引擎目前沒有對應類別`);
}

// ───────── 泵 ─────────
for (const m of load('10_pump')) {
    const F = '10_pump.json';
    if (isImageOnly(m)) { skip(F, m, '數值取自圖片，待使用者確認'); continue; }
    skip(F, m, '泵目前只有 2 筆且待確認，暫不匯入');
}

// ───────── 輸出 ─────────
const META = (cat, desc) => ({
    vendor: 'Verified (extracted)',
    category: cat,
    description: desc,
    generated_by: 'device_catalog/tools/import_extracted.js',
    generated_at: TODAY,
    note: '自動產生，勿手改；修正請改 _extracted 抽取檔後重跑腳本。所有記錄 _verified=true，出處見 _source。'
});
const write = (file, obj) => fs.writeFileSync(path.join(OUT_DIR, file), JSON.stringify(obj, null, 2) + '\n', 'utf8');
write('chiller.json', { _meta: META('chiller', '冰水主機（已核對）'), ...out.chiller });
write('cooling_tower.json', { _meta: META('cooling_tower', '冷卻水塔（已核對）'), ...out.cooling_tower });
write('dry_cooler.json', { _meta: META('dry_cooler', '乾冷器（已核對）'), ...out.dry_cooler });
write('cdu_xdu.json', { _meta: META('cdu_xdu', 'CDU（已核對）'), ...out.cdu });
write('crah.json', { manufacturer: 'Verified (extracted)', category: 'crac_crah', _meta: META('crac_crah', '風牆／AHU／InRow 冰水型（已核對）'), models: out.crah });
write('rdhx.json', { _meta: META('rdhx', '背門熱交換器（已核對）'), ...out.rdhx });
write('_unmapped.json', { _meta: META('unmapped', '未進可選型錄的記錄（原因見 reason）'), models: unmapped });

// ───────── 與既有型錄比對（只讀 catalog_index.json 列出的原有檔案，不含 verified/） ─────────
const CAT_DIR = path.join(__dirname, '..');
function existingEntries() {
    const idx = JSON.parse(fs.readFileSync(path.join(CAT_DIR, 'catalog_index.json'), 'utf8'));
    const list = [];
    for (const [cat, def] of Object.entries(idx.categories || {})) {
        for (const vd of def.vendors || []) {
            if (/^verified\//.test(vd.file)) continue;
            const f = path.join(CAT_DIR, vd.file);
            if (!fs.existsSync(f)) continue;
            const data = JSON.parse(fs.readFileSync(f, 'utf8'));
            const recs = Array.isArray(data.models) ? data.models : Object.entries(data).filter(([k]) => k !== '_meta').map(([, v]) => v);
            recs.forEach(v => v && typeof v === 'object' && list.push({
                cat, file: vd.file, model: v.model,
                cap: v.cooling_capacity_kw ?? v.heat_rejection_kw ?? v.capacityKw ?? v.capKw,
                cop: v.cop_design ?? v.cop,
                power: v.fan_kw_dx ?? v.power_kw ?? v.fanPowerKw ?? v.fan_power_kw ?? v.power_input_kw,
                verified: v._verified
            }));
        }
    }
    return list;
}
const normKey = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
function modelTokens(model) {
    return String(model || '').replace(/\[.*?\]|\(.*?\)/g, ' ').split(/\s+/)
        .filter(t => /[A-Za-z]/.test(t) && /\d/.test(t) && normKey(t).length >= 5).map(normKey);
}
function compare() {
    const ex = existingEntries();
    const rows = [];
    const add = (cat, rec, cap, cop, power) => {
        const toks = modelTokens(rec._model_raw);
        if (!toks.length) return;
        ex.filter(e => toks.some(t => normKey(e.model).includes(t))).forEach(e => rows.push({ cat, newModel: rec.model, cap, cop, power, old: e }));
    };
    Object.values(out.chiller).forEach(c => add('冰水主機', c, c.cooling_capacity_kw, c.cop_design, c.power_input_kw));
    Object.values(out.cooling_tower).forEach(c => add('冷卻水塔', c, c.heat_rejection_kw, null, c.fan_kw_dx));
    Object.values(out.dry_cooler).forEach(c => add('乾冷器', c, c.heat_rejection_kw, null, c.fan_kw_dx));
    Object.values(out.cdu).forEach(c => add('CDU', c, c.cooling_capacity_kw, null, c.power_kw));
    out.crah.forEach(c => add('風牆/InRow', c, c.capacityKw, null, c.fanPowerKw));
    Object.values(out.rdhx).forEach(c => add('RDHx', c, c.cooling_capacity_kw, null, c.fan_power_kw));
    return rows;
}

function writeReport() {
    const rows = compare();
    const f = (v) => (v == null || v === '') ? '—' : (typeof v === 'number' ? String(Math.round(v * 100) / 100) : String(v));
    const L = [];
    L.push('# 已核對型錄匯入報告', '');
    L.push(`> 自動產生（${TODAY}），由 \`device_catalog/tools/import_extracted.js\` 產出，勿手改。`, '');
    L.push('## 1. 匯入筆數', '', '| 類別 | 檔案 | 筆數 |', '|:--|:--|--:|');
    const fileOf = { chiller: 'verified/chiller.json', cooling_tower: 'verified/cooling_tower.json', dry_cooler: 'verified/dry_cooler.json', cdu: 'verified/cdu_xdu.json', crah: 'verified/crah.json', rdhx: 'verified/rdhx.json' };
    for (const [k, n] of Object.entries(report.imported)) L.push(`| ${k} | \`${fileOf[k]}\` | ${n} |`);
    L.push(`| **合計** | | **${Object.values(report.imported).reduce((a, b) => a + b, 0)}** |`, '');

    L.push('## 2. 未匯入（列在 `verified/_unmapped.json`）', '');
    const byReason = {};
    report.skipped.forEach(s => { (byReason[s.reason] = byReason[s.reason] || []).push(`${s.model}`); });
    L.push('| 原因 | 筆數 | 型號 |', '|:--|--:|:--|');
    for (const [r, ms] of Object.entries(byReason)) L.push(`| ${r} | ${ms.length} | ${ms.slice(0, 8).join('、')}${ms.length > 8 ? ' …' : ''} |`);
    L.push('');

    L.push('## 3. 換算值與 ⚠ 標記', '');
    const all = [...Object.values(out.chiller), ...Object.values(out.cooling_tower), ...Object.values(out.dry_cooler), ...Object.values(out.cdu), ...out.crah, ...Object.values(out.rdhx)];
    const derived = all.filter(c => c._derived);
    const flagged = all.filter(c => c._flags && c._flags.length);
    L.push(`- 含換算值（\`_derived\`）：${derived.length} 筆`);
    derived.slice(0, 40).forEach(c => L.push(`  - ${c.model}：${c._derived}`));
    L.push(`- 帶 ⚠ 標記：${flagged.length} 筆`);
    flagged.forEach(c => L.push(`  - ${c.model}：${c._flags.join('；')}`));
    L.push('');

    L.push('## 4. 與既有型錄同型號比對', '');
    L.push('既有型錄檔不會被修改；下表只列出型號代碼相同的記錄，供判斷舊資料是否需要汰換。', '');
    L.push('| 類別 | 新（已核對） | 容量 kW | COP | 耗電/風扇 kW | 既有型號（檔案） | 容量 kW | COP | 耗電/風扇 kW |', '|:--|:--|--:|--:|--:|:--|--:|--:|--:|');
    rows.forEach(r => L.push(`| ${r.cat} | ${r.newModel} | ${f(r.cap)} | ${f(r.cop)} | ${f(r.power)} | ${r.old.model}（${r.old.file}） | ${f(r.old.cap)} | ${f(r.old.cop)} | ${f(r.old.power)} |`));
    if (!rows.length) L.push('| — | 無同型號 | | | | | | | |');
    L.push('');
    fs.writeFileSync(path.join(OUT_DIR, '_import_report.md'), L.join('\n') + '\n', 'utf8');
    return rows.length;
}

module.exports = { out, report };
if (require.main === module) {
    const n = writeReport();
    console.log('匯入筆數：', JSON.stringify(report.imported));
    const byReason = {};
    report.skipped.forEach(s => { byReason[s.reason] = (byReason[s.reason] || 0) + 1; });
    console.log('略過筆數：', report.skipped.length, JSON.stringify(byReason, null, 1));
    console.log('與既有型錄同型號：', n, '筆（見 verified/_import_report.md）');
}
