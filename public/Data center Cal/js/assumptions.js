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

  // ── 絕熱冷卻塔常數 (P1-4) ─────────────────────────────────────────────
  adiabatic_coil_air_dt_k:        { val: 10.0, unit: 'K',  label: '絕熱預冷盤管空氣側溫升', ref: '乾冷器／絕熱盤管空氣側溫升典型 8–12 K' },
  adiabatic_switchpoint_offset_c: { val: 9.2,  unit: '°C', label: '絕熱乾轉濕切換溫差偏移', ref: '外氣乾球高於 (FWS - approach - 此值) 時啟動絕熱噴淋預冷' },

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
  // [P1-4 審查] 暫時保留供 schematic_series_trim.js 使用，待 P4-1 改為動態溫差物理門檻後移除
  nvidia_dsx_mode2_offset_c:      { val: 5.7,   unit: '°C',     label: 'Mode 2 Trim 區間寬度 (保留至P4-1)', ref: '40.5 - 34.8 = 5.7°C' },

  // ── 冰機揚程與外推保護常數 (P0-4) ──────────────────────────────────────
  chiller_evap_approach_k:        { val: 2.0,   unit: 'K',      label: '冰機蒸發溫度 = 冰水出水溫 − 此值', ref: '殼管/板式蒸發器典型 1.5–3 K' },
  chiller_cond_offset_water_k:    { val: 7.0,   unit: 'K',      label: '水冷冰機冷凝溫度 = 冷卻水進水溫 + 此值（含冷卻水溫升 5K + approach 2K）', ref: 'AHRI 550/590 標準工況 30→35°C，冷凝器 approach ≈ 2K' },
  chiller_cond_offset_air_k:      { val: 15.0,  unit: 'K',      label: '氣冷冰機冷凝溫度 = 外氣乾球 + 此值', ref: '氣冷冷凝器典型 TD 12–17 K' },
  chiller_min_lift_k:             { val: 10.0,  unit: 'K',      label: '壓縮機最小揚程（冷凝−蒸發），低於此值以此值計', ref: '離心/螺旋機油壓差與防喘振限制，磁浮機可低至 5–8 K' },
  chiller_lift_factor_max:        { val: 2.0,   unit: '-',      label: '揚程修正後 COP 最多為設計 COP 的倍數', ref: '保守上限，避免低揚程外推過度樂觀' },

  // ── Fanwall 氣冷系統自然冷卻常數 (P0-7) ───────────────────────────────
  air_chiller_fc_coil_approach_c: { val: 4.0,   unit: '°C',     label: '氣冷冰機 free-cooling 盤管 approach（外氣 DB → 預冷後回水）', ref: '廠商型錄典型 3–5°C' },
  air_chiller_fc_fan_kw_per_kw:   { val: 0.05,  unit: 'kW/kW',  label: '氣冷冰機自然冷卻模式風扇耗電（每 kW 自然冷卻量）', ref: '沿用原程式 5% 概估，待型錄風扇功率資料取代' },
  rdhx_fc_fan_kw_per_kw:          { val: 0.03,  unit: 'kW/kW',  label: 'RDHX 系統自然冷卻模式排熱風扇耗電', ref: '沿用原程式 3% 概估' },
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
