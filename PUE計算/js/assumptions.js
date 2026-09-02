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
  cooling_diversity_factor: { val: 0.9, unit: '-', label: '冷卻負載同時使用係數（多迴路/多機列不會同時達峰值）', ref: 'ASHRAE 系統設計常用 0.85–0.95' },
  future_margin_pct:       { val: 10,  unit: '%', label: '未來擴充設計裕度（放大至 Design Load 再進行設備選型）', ref: '公司內規（可調，AI DC 常見 10–20%）' },
  ct_evap_m3h_per_kw:      { val: 0.00124, unit: 'm³/(h·kW)', label: '濕式冷卻塔蒸發耗水係數（每 kW 排熱）', ref: 'ASHRAE Handbook — CT evaporation ≈1.8 L/min / 100 kW 排熱' },
  min_cewt_c:              { val: 16.0, unit: '°C', label: '冰機冷凝器最低進水溫下限（condenser water relief 下限，避免冬季 COP 失真偏高）', ref: 'AHRI 550/590；典型離心/螺旋式冰機油壓與潤滑限制常見下限 15–18°C' },
  cdu_approach_c:          { val: 3.0, unit: '°C', label: 'CDU 二次側供水（FWS）相對一次側供水（TCS）的最小溫差（approach）', ref: 'ASHRAE TC9.9 液冷白皮書 CDU approach 典型 2–4°C' },
  cdu_derate_pct_per_c:    { val: 2.0, unit: '%/°C', label: 'CDU 容量隨一次側供水溫每升高 1°C 的線性降額率', ref: '廠商型錄常見趨勢（板式換熱器 UA 固定、驅動溫差縮小），概估非實測曲線' },
  cdu_nominal_fws_design_c:{ val: 30.0, unit: '°C', label: 'CDU 型錄標稱容量對應的一次側（FWS）設計供水溫', ref: '本系統 CDU 型錄建置慣例（_cduEntry），非廠商公告基準溫' },
  chiller_air_derate_pct_per_c_above35: { val: 1.2, unit: '%/°C', label: '氣冷式冰機容量隨室外乾球溫超過 35°C 每升高 1°C 的降額率', ref: '氣冷冰機廠商型錄常見趨勢，35°C 以上容量衰減，概估值' },
  ct_rerate_pct_per_c_above_std: { val: 2.5, unit: '%/°C', label: '冷卻水塔容量隨設計濕球溫超過 CTI 標準額定濕球每升高 1°C 的降額率', ref: 'CTI ATC-105 標準額定條件下型錄值，實際設計 WB 偏高時容量下降，概估值' },
  ct_standard_rating_wb_c: { val: 25.6, unit: '°C', label: '冷卻水塔型錄額定容量對應的 CTI 標準額定濕球溫（78°F）', ref: 'CTI ATC-105 標準額定條件' },
  design_wb_fallback_c:    { val: 28.0, unit: '°C', label: '無氣象逐時資料可查時的設計濕球溫度後備值（設備選型降額用）', ref: '台灣主要城市夏季 p99 濕球溫度概估區間 27–29°C' },

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
  nvidia_dsx_mt_return_c:         { val: 32.0,  unit: '°C',     label: 'NVIDIA DSX MTFW 中溫一次側回水基準', ref: 'NVIDIA DSX BOD Rev5 Section 6.9.2 (89.6°F)' },
  nvidia_dsx_mode1_db_max_c:      { val: 34.8,  unit: '°C',     label: 'NVIDIA DSX Full Free Cooling 乾球上限', ref: 'NVIDIA DSX Facilities Guide v2.0 p.42' },
  nvidia_dsx_mode2_db_max_c:      { val: 40.5,  unit: '°C',     label: 'NVIDIA DSX Trim Cooling 乾球上限', ref: 'NVIDIA DSX Facilities Guide v2.0 p.42' },
};

function A(key, state) {
  const s = state ?? (typeof st !== 'undefined' ? st : undefined);
  const override = s?.assumptions_override?.[key];
  return override ?? ASSUMPTIONS[key].val;
}

// Node（projects/verify_engine.js 等）需要 module.exports 才能個別引用；
// 瀏覽器端以 <script> 全域載入，ASSUMPTIONS / A 直接可用，此段不影響瀏覽器行為。
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ASSUMPTIONS, A };
}
