'use strict';

/**
 * i18n_zh.js - Traditional Chinese (zh-TW) Dictionary
 */
(function(root) {
  const dict = {
    // Header & App
    'app.title': 'PUE 計算系統',
    'app.version': 'v33',
    'app.subtitle': '全球 8,760hr 年度PUE估算',
    'app.save': '儲存專案',
    'app.open': '開啟專案',
    'app.reset': '重置',
    'app.resetTitle': '重置為初始範例專案',
    'app.importSuccess': '✅ 專案檔載入成功！',
    'app.importError': '❌ 專案檔格式錯誤，無法載入。',
    'app.resetConfirm': '確定要清除所有自訂配置並重置為預設範例專案嗎？',
    'app.step5Blocked': '⚠️ 尚有冷卻設備選型容量未達 N+1 規範，請先修正後方可檢視 Dashboard！',
    'app.viewLoadError': '⚠️ 視圖模組 (Step {step}) 載入異常，請確認相關 JS 檔案是否已正確引入。',

    // Sticky KPI Bar
    'kpi.designPue': '設計 PUE',
    'kpi.waterWue': '耗水 WUE',
    'kpi.itCapacity': 'IT 容量',
    'kpi.freeCooling': '自然冷卻 FC',
    'kpi.freeCoolingTitle': 'CDU 液冷自然冷卻時數佔比 (Free Cooling Ratio)',

    // Steps Navigation
    'nav.step1': '案場 8760h 氣象',
    'nav.step2': 'Hall → DU → SU 模組',
    'nav.step3': 'CorePOD 核心機房',
    'nav.step4': '逐 DU 雙冷卻系統',
    'nav.step5': '8,760h 成果儀表板',

    // Footer
    'footer.desc': 'PUE 計算系統 · 專業 AI 資料中心全生命週期能耗與耗水動力學評估工具',

    // Sample interpolation
    'step4.deficitMsg': '尚有 {n} 項設備容量未達 {redundancy} 規範'
  };

  const target = (typeof window !== 'undefined' ? window.I18N : (typeof global !== 'undefined' ? global.I18N : null));
  if (target) {
    target.dict = target.dict || {};
    target.dict['zh-TW'] = Object.assign(target.dict['zh-TW'] || {}, dict);
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = dict;
  }
})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this));
