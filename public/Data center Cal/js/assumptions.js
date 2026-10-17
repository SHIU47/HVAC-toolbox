/**
 * [v3-T1] 全站工程假設登錄表 —— 唯一真相源，禁止在他處硬編碼。
 * 被問「憑什麼」時，答案就在這裡：每個假設都附 label + 出處(ref)。
 *
 * 使用方式：
 *   - index.html 內的 UI 函式（有全域 st 可用）：A('key')
 *   - js/engines.js、js/plantModel.js 等計算函式（state 以參數傳入，
 *     Node 測試環境無全域 st）：A('key', state)  —— 明確傳入 state 較安全，
 *     見附錄 A「engines.js 內若無法存取 st，以參數傳入」。
 *   - st.assumptions_override[key] 存在時覆寫預設值，隨專案存檔一併保存，
 *     團隊成員載入同一個專案檔即套用相同假設。
 */
const ASSUMPTIONS = {
  chiller_cop_est:        { val: 5.5,  unit: '-',   label: '冰機估算 COP（排熱/需求粗算用）', ref: 'AHRI 550/590 水冷離心典型值' },
  tower_approach_c:       { val: 4.0,  unit: '°C',  label: '冷卻塔 approach', ref: 'CTI ATC-105；台灣夏季設計常用 3.5–5' },
  hx_approach_c:          { val: 1.5,  unit: '°C',  label: '板式熱交換器 approach', ref: '廠商型錄典型 1–2°C' },
  dry_cooler_approach_c:  { val: 6.0,  unit: '°C',  label: '乾冷器 approach', ref: '廠商型錄典型 5–8°C' },
  db_wb_depression_c:     { val: 8.0,  unit: '°C',  label: '乾球估算 = 濕球 + 此值（夏）', ref: '台灣氣候統計近似' },
  ct_cycles:              { val: 5,    unit: '-',   label: '冷卻水濃縮倍數', ref: 'ASHRAE 手冊；影響排放水量' },
  penalty_chiller_cop:    { val: 2.0,  unit: '-',   label: '熱力極限應急冰機 COP', ref: '保守懲罰假設' },
  pump_eta_default:       { val: 0.75, unit: '-',   label: '泵效率預設', ref: 'HI 標準中型端吸泵' },
  motor_eta_default:      { val: 0.92, unit: '-',   label: '馬達效率預設', ref: 'IE3' },
  cdu_pump_head_default_m:{ val: 28,   unit: 'm',   label: 'CDU 一次側泵浦預設揚程', ref: '概估值，正式設計需依管路壓損計算（可用本站「水管風管壓損計算」工具）' },
  fw_pump_head_default_m: { val: 22,   unit: 'm',   label: 'Fanwall 二次側泵浦預設揚程', ref: '概估值，正式設計需依管路壓損計算（可用本站「水管風管壓損計算」工具）' },
  sizing_margin_target:   { val: 15,   unit: '%',   label: '選型建議目標裕度', ref: '公司內規（可調）' },
  tower_heat_rejection_factor: { val: 1.2, unit: '-', label: '冷卻塔排熱裕度係數（含壓縮機輸入功或換熱裕度）', ref: 'ASHRAE 典型冰機排熱 = 冷凍噸 × 1.2' },
  district_chw_cop:       { val: 5.0,  unit: '-',   label: '區域冷水／外來冰水等效 COP', ref: 'ASHRAE 90.1 / 園區集中冷站合約典型 4.5–5.5' },
  ct_evap_m3h_per_kw:      { val: 0.00124, unit: 'm³/(h·kW)', label: '濕式冷卻塔蒸發耗水係數（每 kW 排熱）', ref: '蒸發量 = Q × 潛熱比 / h_fg；h_fg≈2430 kJ/kg、潛熱比≈0.84 → 0.00124 m³/h/kW' },
  min_cewt_c:              { val: 16.0, unit: '°C', label: '冰機冷凝器最低進水溫下限（condenser water relief 下限，避免冬季 COP 失真偏高）', ref: 'AHRI 550/590；典型離心/螺旋式冰機油壓與潤滑限制常見下限 15–18°C' },
  cdu_approach_c:          { val: 3.0, unit: '°C', label: 'CDU 二次側供水（FWS）相對一次側供水（TCS）的最小溫差（approach）', ref: 'ASHRAE TC9.9 液冷白皮書 CDU approach 典型 2–4°C' },
  cdu_derate_pct_per_c:    { val: 2.0, unit: '%/°C', label: 'CDU 容量隨一次側供水溫每升高 1°C 的線性降額率', ref: '廠商型錄常見趨勢（板式換熱器 UA 固定、驅動溫差縮小），概估非實測曲線' },
  cdu_nominal_fws_design_c:{ val: 30.0, unit: '°C', label: 'CDU 型錄標稱容量對應的一次側（FWS）設計供水溫', ref: '本系統 CDU 型錄建置慣例（_cduEntry），非廠商公告基準溫' },
  chiller_air_derate_pct_per_c_above35: { val: 1.2, unit: '%/°C', label: '氣冷式冰機容量隨室外乾球溫超過 35°C 每升高 1°C 的降額率', ref: '氣冷冰機廠商型錄常見趨勢，35°C 以上容量衰減，概估值' },
  ct_rerate_pct_per_c_above_std: { val: 2.5, unit: '%/°C', label: '冷卻水塔容量隨設計濕球溫超過 CTI 標準額定濕球每升高 1°C 的降額率', ref: 'CTI ATC-105 標準額定條件下型錄值，實際設計 WB 偏高時容量下降，概估值' },
  ct_standard_rating_wb_c: { val: 25.6, unit: '°C', label: '冷卻水塔型錄額定容量對應的 CTI 標準額定濕球溫（78°F）', ref: 'CTI ATC-105 標準額定條件' },
  design_wb_fallback_c:    { val: 28.0, unit: '°C', label: '無氣象逐時資料可查時的設計濕球溫度後備值（設備選型降額用）', ref: '台灣主要城市夏季 p99 濕球溫度概估區間 27–29°C' },
  design_extreme_return_years:      { val: 20,    unit: 'years', label: 'ASHRAE 極端年最高乾球回歸期', ref: 'ASHRAE HOF Ch.14 極端年 n 年回歸期；關鍵設施常用 n=20' },
  design_extreme_fallback_margin_c: { val: 2.0,   unit: '°C',    label: '無 ASHRAE 極值時之 TMY 最高溫安全餘裕', ref: '保守推估裕度' },
  design_extreme_tmy_gap_warn_c:    { val: 5.0,   unit: '°C',    label: 'ASHRAE 極值與 TMY 最高溫差距警示門檻', ref: '差距過大提示核對測站品質' },
  freeze_risk_db_c:                 { val: 4.0,   unit: '°C',    label: '外氣結霜/結冰風險門檻', ref: '乾冷器盤管靜止水在夜間輻射冷卻下可能於外氣 0～3°C 結冰，取 4°C 安全餘裕' },

  // ── 絕熱冷卻塔常數 (P1-4 / P4-4) ─────────────────────────────────────────
  adiabatic_coil_air_dt_k:        { val: 10.0, unit: 'K',  label: '絕熱預冷盤管空氣側溫升', ref: '乾冷器／絕熱盤管空氣側溫升典型 8–12 K' },
  adiabatic_switchpoint_offset_c: { val: 9.2,  unit: '°C', label: '絕熱乾轉濕切換溫差偏移（已改為依需求切換，僅供參考）', ref: '外氣乾球高於 (FWS - approach - 此值) 時啟動絕熱噴淋預冷（歷史參考值，現行模型改為依需求切換）' },

  // ── NVIDIA DSX 設施設計指引基準常數 ────────────────────────────────────
  nvidia_dsx_t_chip_s45:          { val: 45.0,  unit: '°C',     label: 'NVIDIA Vera Rubin (S45) 晶片進水溫度上限', ref: 'NVIDIA DSX Facilities Guide v2.0 p.62' },
  nvidia_dsx_t_chip_w32:          { val: 32.0,  unit: '°C',     label: 'NVIDIA Blackwell (W32) 晶片進水溫度上限', ref: 'NVIDIA DSX Facilities Guide v2.0' },
  nvidia_dsx_cdu_atd:             { val: 4.0,   unit: '°C',     label: 'NVIDIA DSX CDU 逼近溫差 (ATD)', ref: 'NVIDIA DSX BOD Rev5 Section 6.4.4' },
  nvidia_dsx_dry_cooler_approach: { val: 5.0,   unit: '°C',     label: 'NVIDIA DSX Raised-bed 乾冷器逼近溫差', ref: 'NVIDIA DSX BOD Rev5 Section 6.3.2' },
  nvidia_dsx_flow_lpm_per_kw:     { val: 1.5,   unit: 'LPM/kW', label: 'NVIDIA DSX TCS PG25 標準冷卻液流量基準', ref: 'NVIDIA DSX Facilities Guide v2.0 p.62' },
  nvidia_dsx_crah_cfm_per_kw:     { val: 150.0, unit: 'CFM/kW', label: 'NVIDIA DSX HAC 空側 CRAH 標準風量基準', ref: 'NVIDIA DSX Facilities Guide v2.0 p.62' },
  nvidia_dsx_tes_ride_through_min:{ val: 7.0,   unit: 'min',    label: 'NVIDIA DSX 儲冷槽 (TES) 故障過渡維持時間', ref: 'NVIDIA DSX BOD Rev5 Section 6.9.2' },
  nvidia_dsx_ht_supply_c:         { val: 37.0,  unit: '°C',     label: 'NVIDIA DSX HTFW 高溫一次側供水基準', ref: 'NVIDIA DSX BOD Rev5 Section 6.9.2 (98.6°F)' },
  nvidia_dsx_ht_return_c:         { val: 47.0,  unit: '°C',     label: 'NVIDIA DSX HTFW 高溫一次側回水基準', ref: 'NVIDIA DSX BOD Rev5 Section 6.9.2 (116.6°F)' },
  nvidia_dsx_mt_supply_c:         { val: 22.0,  unit: '°C',     label: 'NVIDIA DSX MTFW 中溫一次側供水基準', ref: 'NVIDIA DSX BOD Rev5 Section 6.9.2 (71.6°F)' },
  nvidia_dsx_mode1_db_max_c:      { val: 34.8,  unit: '°C',     label: 'NVIDIA DSX Full Free Cooling 乾球上限', ref: 'NVIDIA DSX Facilities Guide v2.0 p.42' },
  nvidia_dsx_mode2_db_max_c:      { val: 40.5,  unit: '°C',     label: 'NVIDIA DSX Trim Cooling 乾球上限', ref: 'NVIDIA DSX Facilities Guide v2.0 p.42' },
  trim_chw_dt_default_c:          { val: 5.0,   unit: '°C',     label: 'Trim 冰機蒸發器設計溫差 (ΔT)', ref: 'AHRI 550/590 標準工況 5°C (44-54°F)' },
  cdw_dt_design_c:                { val: 5.0,   unit: '°C',     label: '水冷冰機冷凝冷卻水設計溫差 (ΔT)', ref: 'AHRI 550/590 標準工況冷卻水 30→35°C' },

  // ── 冰機揚程與外推保護常數 (P0-4) ──────────────────────────────────────
  chiller_evap_approach_k:        { val: 2.0,   unit: 'K',      label: '冰機蒸發溫度 = 冰水出水溫 − 此值', ref: '殼管/板式蒸發器典型 1.5–3 K' },
  chiller_cond_offset_water_k:    { val: 7.0,   unit: 'K',      label: '水冷冰機冷凝溫度 = 冷卻水進水溫 + 此值（含冷卻水溫升 5K + approach 2K）', ref: 'AHRI 550/590 標準工況 30→35°C，冷凝器 approach ≈ 2K' },
  chiller_cond_offset_air_k:      { val: 15.0,  unit: 'K',      label: '氣冷冰機冷凝溫度 = 外氣乾球 + 此值', ref: '氣冷冷凝器典型 TD 12–17 K' },
  chiller_min_lift_k:             { val: 10.0,  unit: 'K',      label: '壓縮機最小揚程（冷凝−蒸發），低於此值以此值計', ref: '離心/螺旋機油壓差與防喘振限制，磁浮機可低至 5–8 K' },
  chiller_lift_factor_max:        { val: 1.35,  unit: '-',      label: '揚程修正後 COP 最多為設計 COP 的倍數', ref: '受壓縮機吸氣壓力上限 (MOP) 與最小壓比限制，溫水供水最大 COP 增益 1.35x（R6 P0-C2，原 2.0）' },
  chiller_carnot_damp_air:        { val: 0.40,  unit: 'ratio',  label: '氣冷冰機 Carnot 揚程修正阻尼係數（扣除佔總功耗 ~25% 之冷凝風扇與固定損耗）', ref: 'AHRI 550/590 氣冷冰機 EER 對外氣溫度敏感度 ~1.8%/°C' },
  chiller_carnot_damp_water:      { val: 0.65,  unit: 'ratio',  label: '水冷冰機 Carnot 揚程修正阻尼係數（反映壓縮機壓比極限與馬達/變頻固定損耗）', ref: 'AHRI 550/590 水冷冰機 EIR-FT 敏感度' },
  chiller_evap_temp_cap_c:        { val: 20.0,  unit: '°C',     label: '冰機供水溫度增益上限（高於此值不再獲得額外 Carnot 減載增益）', ref: '壓縮機吸氣壓力 / MOP 操作包絡限制' },
  chiller_max_cewt_standard_c:    { val: 45.0,  unit: '°C',     label: '標準氣冷/水冷冰機冷凝進水上限', ref: '標準氣冷/水冷冰機冷凝進水上限，型錄通常為 40～45°C' },
  chiller_max_cewt_hightemp_c:    { val: 60.0,  unit: '°C',     label: '高溫型（heat-pump 級）冰機冷凝進水上限', ref: '高溫型（heat-pump 級）冰機冷凝進水上限' },

  // ── Fanwall 氣冷系統自然冷卻常數 (P0-7) ───────────────────────────────
  air_chiller_fc_coil_approach_c: { val: 4.0,   unit: '°C',     label: '氣冷冰機 free-cooling 盤管 approach（外氣 DB → 預冷後回水）', ref: '廠商型錄典型 3–5°C' },
  air_chiller_fc_fan_kw_per_kw:   { val: 0.05,  unit: 'kW/kW',  label: '氣冷冰機自然冷卻模式風扇耗電（每 kW 自然冷卻量）', ref: '沿用原程式 5% 概估，待型錄風扇功率資料取代' },
  rdhx_fc_fan_kw_per_kw:          { val: 0.03,  unit: 'kW/kW',  label: 'RDHX 系統自然冷卻模式排熱風扇耗電', ref: '沿用原程式 3% 概估' },
  rdhx_default_room_dp_c:         { val: 15.0,  unit: '°C',     label: 'RDHX 機房預設露點上限', ref: 'ASHRAE TC9.9 A1 建議露點上限' },
  rdhx_dewpoint_margin_k:         { val: 2.0,   unit: 'K',      label: 'RDHX 結露保護安全溫差餘裕', ref: '露點 + 2K 安全裕度' },
  rdhx_min_chws_c:                { val: 17.0,  unit: '°C',     label: 'RDHX 供水露點保護溫度下限', ref: 'ASHRAE TC9.9 A1 建議露點上限 15°C + 2K 安全餘裕' },

  // ── 冰機降級/兜底 COP 基準常數 (P2-6) ────────────────────────────────────
  chiller_fallback_cop_chw_ge20:  { val: 5.8,   unit: '-',      label: '高溫冰水 (≥20°C) 兜底 COP', ref: '典型高溫水冷/氣冷冰機滿載能效' },
  chiller_fallback_cop_chw_ge12:  { val: 4.2,   unit: '-',      label: '標準冰水 (12–20°C) 兜底 COP', ref: 'ASHRAE 90.1 / AHRI 550/590 標準工況典型值' },
  chiller_fallback_cop_chw_lt12:  { val: 3.0,   unit: '-',      label: '低溫冰水 (<12°C) 兜底 COP', ref: '低溫供水/高揚程典型保守值' },

  // ── [Round 6] 全廠電力損耗 (P0-E1) ───────────────────────────────────────
  electrical_loss_default_pct:    { val: 4.5,   unit: '%',      label: '預設全廠電力轉換與分配損耗率（變壓器 + UPS + PDU + 照明輔助）', ref: 'ISO/IEC 30134-2 / LBNL：MV/LV 變壓器 ~1.0% + 雙轉換 UPS ~2.5% + PDU/線路 ~0.5% + 照明/BMS ~0.5%' },

  // ── [Round 6] 室外排熱風扇變頻 (P0-F1) ───────────────────────────────────
  heat_rej_vfd_slope_per_k:       { val: 0.022, unit: '1/K',    label: '乾冷器/絕熱塔外氣低於自然冷卻門檻時，每低 1°C 風扇轉速調降比例', ref: 'ASHRAE 90.1 / EnergyPlus 變速乾冷器 approach 控制模型' },
  evap_tower_vfd_slope_per_k:     { val: 0.025, unit: '1/K',    label: '蒸發式冷卻塔濕球低於設計基準時，每低 1°C 風扇轉速調降比例', ref: 'ASHRAE 90.1 / CTI ATC-105 變速冷卻塔控制' },
  heat_rej_fan_min_speed:         { val: 0.45,  unit: 'ratio',  label: '室外排熱風扇（乾冷器/冷卻塔/絕熱塔）連續運轉最低變頻轉速', ref: 'EC 風扇/VFD 馬達散熱與盤管迎面風速下限（45% 轉速 ≈ 13.7% 功率）' },
  // ── [Round 6] 終端設備運轉中最低轉速 (P0-T1) ────────────────────────────
  cdu_pump_min_speed_active:      { val: 0.75,  unit: 'ratio',  label: 'CDU 內建變頻泵運轉中最低轉速（維持冷板歧管最低壓差 ΔP 與最小雷諾數）', ref: 'ASHRAE TC9.9 Liquid Cooling Guidelines / NVIDIA 歧管 ΔP 控制' },
  crah_fan_min_speed_active:      { val: 0.70,  unit: 'ratio',  label: 'CRAH/Fanwall EC 風機運轉中最低轉速（維持冷熱通道氣流組織與送風量）', ref: 'ASHRAE TC9.9 Thermal Guidelines — 通道氣流與 ΔT 封閉控制' },

  ct_fan_ref_wb_max_c:           { val: 28.0,  unit: '°C',     label: '冷卻塔風扇 100% 轉速對應之濕球基準上限（冷凝排熱用途之設計濕球）', ref: '台灣主要城市夏季設計濕球 27–29°C' },
  ct_vfd_static_fraction:        { val: 0.10,  unit: 'ratio',  label: '排熱風扇無型錄資料時之固定功率比例（與 CoolingTowerEngine.calcFanPower 一致）', ref: 'P = P_rated × (0.10 + 0.90 × s³)' },

  // ── [Round 6] 水力迴路揚程、冷卻水泵與噴淋水泵 (P1-H1) ───────────────────
  glycol_cp_kj_kgk: {
    val: 3.90, unit: 'kJ/(kg·K)',
    label: '30% 乙二醇/丙二醇水溶液比熱容（乾冷器與閉式塔防凍/防腐迴路）',
    ref: 'ASHRAE Fundamentals Handbook Chapter 31 — Physical Properties of Secondary Coolants (EG/PG 25-30%)'
  },
  phe_secondary_loop_head_m: {
    val: 16.0, unit: 'm',
    label: '板式熱交換器 (PHE) 雙迴路隔離或串聯雙熱交換器之附加水頭損失 (含 PHE 壓降 + 二次側管損)',
    ref: 'Alfa Laval / SWEP Brazed & Gasketed PHE Hydraulic Drop (50-70 kPa) + Secondary Loop Piping (90-100 kPa)'
  },
  cw_pump_head_default_m: {
    val: 22.0, unit: 'm',
    label: '水冷式冰水主機之冷卻水迴路 (CW Loop: 冷凝器 + 冷卻塔噴嘴 + 管路) 預設揚程',
    ref: 'ASHRAE HVAC Systems and Equipment Handbook — Condenser Water Pump Sizing'
  },
  cw_loop_delta_t_c: {
    val: 5.5, unit: '°C',
    label: '水冷式冰機冷凝器冷卻水設計溫差 (AHRI 550/590 標準 30°C 進 / 35.5°C 出)',
    ref: 'AHRI Standard 550/590 Condenser Water Rating ΔT'
  },
  closed_tower_spray_pump_kw_per_kw: {
    val: 0.0055, unit: 'kW/kW_th',
    label: '閉式冷卻水塔 (Closed-Circuit Tower) 盤管外部噴淋水泵單位排熱量功耗比 (~5.5 W/kW)',
    ref: 'BAC FXV3 / Evapcoeco-ATWB Catalog Spray Pump Motor Spec (e.g. 7.5-11 kW per 1500 kW cell)'
  },
  adiabatic_spray_pump_kw_per_kw: {
    val: 0.0020, unit: 'kW/kW_th',
    label: '絕熱預冷塔 (Adiabatic Cooler) 濕模式增濕循環水泵與水處理電磁閥單位排熱量功耗比 (~2.0 W/kW)',
    ref: 'BAC TrilliumSeries / Güntner HydroPad Recirculation Pump Spec'
  },
};

function A(key, state) {
  const s = state ?? (typeof st !== 'undefined' ? st : undefined);
  const override = s?.assumptions_override?.[key];
  return override ?? ASSUMPTIONS[key].val;
}

// Node（projects/verify_engine.js 等）需要 module.exports 才能個別引用；
// 瀏覽器端以 <script> 全域載入，ASSUMPTIONS / A 直接可用，此段不影響瀏覽器行為。
if (typeof window !== 'undefined') {
  window.ASSUMPTIONS = ASSUMPTIONS;
  window.A = A;
}
if (typeof global !== 'undefined') {
  global.ASSUMPTIONS = ASSUMPTIONS;
  global.A = A;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ASSUMPTIONS, A };
}
